# Linux operations and maintenance

[Documentation home](INDEX.md) · [README](../README.md)

## Backups and administration

### Nightly backups

Each night, the timer creates consistent SQLite backups of both databases, checks
`integrity_check`, archives their configuration, and retains **7 snapshots** in
`/var/backups/workoutbuddy`, accessible only to root. The application's internal backups are
separate and limited to seven files. Archives contain private data and the keys needed
for decryption: protect them.

Copies on the same VPS do not cover its loss or compromise.

### Transfer an archive

From your computer, adjust the user and SSH port:

```sh
umask 077
ssh -t ADMIN@VPS 'umask 077; sudo tar -C /var/backups -czf - workoutbuddy > "$HOME/workoutbuddy-backups.tar.gz"'
scp ADMIN@VPS:workoutbuddy-backups.tar.gz .
```

### Restore and check

The first command requests the sudo password in the terminal and prepares a private archive
in the SSH account's home directory; delete this server copy after verifying the transfer.
Keep the local archive on an encrypted disk.

To restore: back up the current state, stop Node and Authelia, extract a snapshot **into an
isolated directory**, check both databases with `sqlite3 COPY 'PRAGMA integrity_check;'`,
and start an isolated instance (`DB_PATH` pointing to the copy, loopback, and another port).
Then restore the databases and corresponding configuration, with their original owners and modes.

Move the previous SQLite file set, including WAL/SHM, before replacement. Restart and check
the application and MFA. Never run a destructive trial on the personal database.

### Server commands and protections

- Status: `systemctl status workoutbuddy authelia workoutbuddy-sessions caddy`; also check the firewall and fail2ban if installed.
- Logs: `journalctl -u workoutbuddy -u authelia -u caddy --since today`.
- Restart: `systemctl restart workoutbuddy`; HTTP draining, 25 s limit
  for persistent streams, SQLite closure; systemd waits 35 s.
- Immediate backup: `systemctl start workoutbuddy-backup.service`.
- Timers/resources: `systemctl list-timers`, `free -m`, `df -h /`,
  `systemctl show workoutbuddy authelia caddy -p MemoryCurrent`.
- Install `journald-limits.conf` in `/etc/systemd/journald.conf.d/` and reload
  journald: limits of 128 MB persistent / 32 MB volatile, 14 days. Caddy rotates
  access logs at 5 MB, three archives, seven days. Do not enable `log_credentials`.
- Authelia: ban after three failures within two minutes, lasting fifteen minutes.
  If SSH accepts passwords, install `fail2ban-server` (Red Hat) or `fail2ban` (Debian/Ubuntu) and the
  `sshd-jail.local` template in `/etc/fail2ban/jail.d/`; adjust the port, validate with
  `fail2ban-client -t`, and enable the service. Test the filter on a synthetic line,
  then ban/unban `192.0.2.123` while checking the firewalld rule.
- In LXC, the host manages the clock: do not bypass `adjtimex`. Chrony may remain
  absent; check the NTP offset without changing the time and contact the provider
  in case of drift, because TOTP depends on it.

## Nightly updates

### Install maintenance for the chosen family

Set `WB_DEPLOY_DIR=deploy/linux/redhat-based` or `WB_DEPLOY_DIR=deploy/linux/debian-based`.
Install the `workoutbuddy-maintenance`, `workoutbuddy-maintenance.service`,
and `workoutbuddy-maintenance.timer` files from that variant:

```sh
install -o root -g root -m 0750 "$WB_DEPLOY_DIR/workoutbuddy-maintenance" /usr/local/sbin/workoutbuddy-maintenance
install -o root -g root -m 0644 "$WB_DEPLOY_DIR/workoutbuddy-maintenance.service" /etc/systemd/system/workoutbuddy-maintenance.service
install -o root -g root -m 0644 "$WB_DEPLOY_DIR/workoutbuddy-maintenance.timer" /etc/systemd/system/workoutbuddy-maintenance.timer
```

The backup must succeed before the first transaction. The Red Hat variant uses
DNF 4/5 and its `needs-restarting` plugin. The Debian variant uses APT and `needrestart`
in batch/list mode. They follow configured repositories without changing Linux releases.
Keep Node on branch 24 through repository policy or package pinning;
no script guarantees the major branch of a third-party repository that changes its policy.
Do not enable untrusted repositories.

Disable competing schedulers on a dedicated installation:

- Red Hat: `dnf-automatic.timer`, `dnf-automatic-install.timer`, or the DNF 5 timer,
  according to the units actually installed. The old `dnf-automatic*.conf` drop-ins
  remain in the repository for existing DNF 4 installations; their wrapper still
  works, but only one timer must start maintenance.
- Debian/Ubuntu: `apt-daily.timer` and `apt-daily-upgrade.timer`. If `unattended-upgrades`
  remains installed, disable periodic execution in the APT configuration and
  retain `Unattended-Upgrade::Automatic-Reboot "false";`. Also disable any third-party
  scheduler that would install updates in parallel.

Do not interrupt a package transaction in progress during migration.
Check active units before changing schedulers.

### Schedule and restarts

The timer starts between **04:00 and 04:15, Europe/Paris**, including daylight saving changes.
A required reboot is allowed only between **04:00 and 06:00**. Long processing postpones
reboot until the following night; the indicator is checked again even without new RPMs.
A missed timer does not catch up during the day.

Without a full reboot, application services using an updated binary or library are restarted;
a newly installed Node is therefore actually used. In LXC, this reboot applies to the
container: the host's kernel and clock remain the provider's responsibility.

### Check without changing the server

`workoutbuddy-maintenance --check` checks state without installing packages,
restarting services, or rebooting. `--apply` starts only between 04:00 and 06:00.
After a long transaction, affected services may restart even if the window has just
closed; only the reboot is postponed until the next night.
Internal package scripts may also restart their own services.

Test both variants without changing the server:

```sh
python3 deploy/linux/redhat-based/test-maintenance.py
python3 deploy/linux/debian-based/test-maintenance.py
python3 deploy/linux/test-deployment.py
```

### Dependency audit

Create `workoutbuddy-audit` with `useradd --system --shell /sbin/nologin --home-dir
/var/cache/workoutbuddy-audit workoutbuddy-audit`, install `workoutbuddy-audit.*` in
`/etc/systemd/system/`, then `service-hardening.conf` in its `zzz-lxc-service.conf` drop-in.
It can read code, without access to databases or secrets.

The weekly npm audit reads the production lockfile on Sundays around 05:30; a moderate
or higher vulnerability fails the service and appears in the journal. Registry
unavailability also fails the check. No external notification is configured.

### Enable and monitor timers

```sh
systemctl daemon-reload
systemctl enable --now workoutbuddy-maintenance.timer workoutbuddy-audit.timer
systemctl restart workoutbuddy-maintenance.timer
systemctl list-timers workoutbuddy-maintenance.timer workoutbuddy-audit.timer
/usr/local/sbin/workoutbuddy-maintenance --check
journalctl -u workoutbuddy-maintenance -u workoutbuddy-audit --since '7 days ago'

# Suspend nightly maintenance if necessary:
systemctl disable --now workoutbuddy-maintenance.timer
```

### Weekly Authelia release notification

For native Linux installations, install the shared files from `deploy/linux/`:

```sh
install -o root -g root -m 0755 deploy/linux/authelia-update-check /usr/local/sbin/authelia-update-check
install -o root -g root -m 0644 deploy/linux/authelia-update-check.service /etc/systemd/system/
install -o root -g root -m 0644 deploy/linux/authelia-update-check.timer /etc/systemd/system/
install -o root -g root -m 0644 deploy/linux/authelia-update-status.sh /etc/profile.d/
systemctl daemon-reload
systemctl enable --now authelia-update-check.timer
systemctl start authelia-update-check.service
/usr/local/sbin/authelia-update-check --status
```

The timer checks the official GitHub latest stable release API every Sunday between
06:00 and 06:15 Europe/Paris, catching up after downtime. It only saves release metadata
in `/var/lib/authelia-update-check/status.json`; it never installs or restarts Authelia.
Interactive SSH login shells using `/etc/profile.d/*.sh` display the cached result,
comparing it with the currently installed binary. Logins make no network request.
A newer release includes a link to its release notes. Failed checks and information
older than eight days are reported explicitly. Check logs with
`journalctl -u authelia-update-check`; run the service manually to refresh the cache.

Validate notification behavior without network access or production changes:
`python3 deploy/linux/test-authelia-update-check.py`.

### Manual updates

No automatic `npm update` or `npm audit fix`: update the lockfile in the repository, test,
then install with `npm ci --omit=dev`. The Authelia binary is installed outside the package
manager: check its official releases, configuration, and migrations, back up, and test before
replacement. It is not updated without validation.
