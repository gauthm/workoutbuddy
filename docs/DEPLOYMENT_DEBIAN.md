# Deployment on Debian, Ubuntu, and derivatives

[Documentation](INDEX.md) · [Common installation](DEPLOYMENT_LINUX.md) · [Red Hat](DEPLOYMENT_REDHAT.md)

## Scope

Templates: `deploy/linux/debian-based/`. Requirements: a maintained Debian/Ubuntu distribution,
**systemd 247+, Python 3.9+, Node 24**, APT/dpkg, Caddy, Authelia, and Redis or Valkey.
Derivatives must declare their lineage through `ID`/`ID_LIKE` in `/etc/os-release`
and provide the same tools. Systems without systemd are not covered.

This variant has isolated script and configuration tests; it has not yet been validated
end to end on a Debian or Ubuntu VM. The Red Hat directory remains separate:
no RPM package, DNF module, or firewalld configuration is required here.

## Packages

```sh
apt-get update
apt-get install build-essential python3 sqlite3 redis-server needrestart tzdata curl ca-certificates gnupg
```

Install Node.js **24.x** and npm from a signed source providing that branch,
then check `/usr/bin/node --version` and `/usr/bin/npm --version`. Do not assume
that the default Node version in every Debian/Ubuntu release is suitable.
Keep an APT source/policy that stays on Node 24; otherwise use
`apt-mark hold nodejs` and update Node manually after testing.

Install Caddy from the [official stable Debian/Ubuntu repository](https://caddyserver.com/docs/install#debian-ubuntu-raspbian),
following its signing-key and repository instructions. Its package installs
`caddy.service`. Install Authelia from its official releases, after verifying
`checksums.sha256`, in `/usr/local/bin/authelia` (root:root, 0755).

If the distribution provides Valkey, install its server package instead of Redis,
then use the `valkey-sessions.conf` drop-in described in the common guide.

## Application configuration

Follow the [common installation](DEPLOYMENT_LINUX.md) with:

```sh
WB_DEPLOY_DIR=deploy/linux/debian-based
```

The private WorkoutBuddy accounts, paths, and units are the same as for Red Hat.
The Redis account is `redis`, and its binary is `/usr/bin/redis-server`. The default
Debian/Ubuntu service is usually `redis-server.service`: disable it if nothing else
uses it, without disabling `workoutbuddy-sessions.service`.

## Firewall and isolation

Keep AppArmor if enabled, along with the supplied systemd protections. Check actual
denials in the journal; adjust only the rules needed on this host.
The SELinux drop-ins from the Red Hat installation are not Debian requirements.

With UFW, allow the actual SSH port, then 80/tcp and 443/tcp before enabling the firewall.
With nftables or a hosting-provider firewall, apply equivalent rules.
Do not expose 3000, 9091, or Redis to the network. Keep an SSH session open and a way
to roll back; do not change the SSH port during this operation.

The `sshd-jail.local` template uses `nftables-multiport`, not `firewallcmd`.
To use it, install `fail2ban` and `nftables`, adjust the SSH port, then check
`fail2ban-client -t` before enabling it. If the selected firewall requires another
action, adapt it explicitly.

## APT maintenance

The `workoutbuddy-maintenance.*` units run a backup before `apt-get update`
and `apt-get -y upgrade` (with dpkg preserving local configuration files). They run neither `dist-upgrade` nor release upgrades.
`needrestart -b -r l` reports outdated services without restarting them itself.
The script restarts only the affected application services.

The reboot decision uses `/run/reboot-required` and the kernel status from
`needrestart`, because the Ubuntu marker may be absent on Debian. An unknown status
(for example the LXC host kernel) does not trigger an automatic reboot.
See the [needrestart batch format](https://sources.debian.org/src/needrestart/3.4-5%2Bdeb10u1/README.batch.md/).

Install the supplied APT policy after choosing this scheduler:

```sh
install -o root -g root -m 0644 deploy/linux/debian-based/apt-periodic.conf /etc/apt/apt.conf.d/99workoutbuddy-maintenance
```

It disables periodic APT execution and autonomous unattended-upgrades reboots.

Follow the [maintenance procedure](DEPLOYMENT_OPERATIONS.md) to disable competing
APT schedulers. Package scripts can restart their own services during the
transaction; the 04:00–06:00 window governs its start and the reboot decision,
not every internal action of a package that takes a long time to install.
