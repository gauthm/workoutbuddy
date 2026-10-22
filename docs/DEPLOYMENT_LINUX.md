# Linux deployment

[Documentation home](INDEX.md) · [README](../README.md)

Free architecture: **Caddy → Authelia (password + TOTP) → Node 24 / SQLite**. Authelia sessions
are stored in a private, persistent Redis instance. Templates are in
`deploy/linux/redhat-based/` and `deploy/linux/debian-based/`. Run system operations as root.

For a containerized installation, use the [Docker guide](DEPLOYMENT_DOCKER.md).

This guide covers both distribution families and their shared installation. First inspect
`ID` and `ID_LIKE` in `/etc/os-release`, install the requirements for the matching family,
then follow the shared preparation and installation steps. Keep the matching `WB_DEPLOY_DIR`
set in the terminal used for those commands; do not mix templates between families.

- [Debian, Ubuntu, and derivatives](#debian-ubuntu-and-derivatives): APT, dpkg, AppArmor and nftables/UFW.
- [Red Hat family](#red-hat-family): DNF 4/5, RPM, SELinux and firewalld.
- [Shared preparation](#preparation) and [installation](#installation).
- [Additional guides](#additional-guides) and [variant checks](#variant-checks).

## Debian, Ubuntu, and derivatives

### Scope

Templates: `deploy/linux/debian-based/`. Requirements: a maintained Debian/Ubuntu distribution,
**systemd 247+, Python 3.9+, Node 24**, APT/dpkg, Caddy, Authelia, and Redis or Valkey.
Derivatives must declare their lineage through `ID`/`ID_LIKE` in `/etc/os-release`
and provide the same tools. Systems without systemd are not covered.

This variant has isolated script and configuration tests; it has not yet been validated
end to end on a Debian or Ubuntu VM. The Red Hat directory remains separate:
no RPM package, DNF module, or firewalld configuration is required here.

### Packages

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
then use the `valkey-sessions.conf` drop-in described in [the shared installation](#accounts-and-directories).

### Application configuration

Use the [shared installation](#installation) below with:

```sh
WB_DEPLOY_DIR=deploy/linux/debian-based
```

The private WorkoutBuddy accounts, paths, and units are the same as for Red Hat.
The Redis account is `redis`, and its binary is `/usr/bin/redis-server`. The default
Debian/Ubuntu service is usually `redis-server.service`: disable it if nothing else
uses it, without disabling `workoutbuddy-sessions.service`.

### Firewall and isolation

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

### APT maintenance

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

## Red Hat family

### Scope

Templates: `deploy/linux/redhat-based/`. This variant targets maintained RHEL/Fedora-family
distributions (Red Hat Enterprise Linux, Rocky, AlmaLinux, CentOS Stream, Oracle Linux, Fedora,
and derivatives providing the requirements). It uses DNF 4 or DNF 5 and RPM.

Requirements: **systemd 247+, Python 3.9+, Node 24**, Caddy, Authelia, and Redis or Valkey.
Older systems with only YUM, systems without systemd, and distributions past end of life
are not covered. The `check-platform.py` check rejects incompatible requirements:
the distribution name alone does not guarantee support.

Rocky Linux 9 is the historically validated host. Other variants have isolated script
tests; they still require full validation on their own VM before use.
Historical results remain in [Deployment validation](DEPLOYMENT_VALIDATION.md).

### Packages

```sh
dnf install gcc-c++ make sqlite python3 tzdata curl ca-certificates
```

Install Node.js **24.x** and npm through the distribution's signed repository or a provider
supporting this version. On a distribution offering the `nodejs:24` module,
`dnf module install nodejs:24` can be used; this command is not universal and is not
used by the scripts. Check `/usr/bin/node --version` and `/usr/bin/npm --version`.
Keep major branch 24 in the repository/module configuration; if that cannot be
guaranteed, exclude `nodejs*` from DNF updates and update Node separately after testing.

For DNF 4, install `dnf-plugins-core`; for DNF 5, install `dnf5-plugins`.
Check `dnf needs-restarting --help`: the plugin must provide `-r` and `-s`.
Maintenance accepts DNF 5 return codes 0 and 1 for the service list.
See the [DNF 4](https://dnf-plugins-core.readthedocs.io/en/latest/needs_restarting.html)
and [DNF 5](https://dnf5.readthedocs.io/en/latest/dnf5_plugins/needs_restarting.8.html) documentation.

Install `redis` or `valkey` according to the available repositories. Install Caddy from its
[official repository for the distribution](https://caddyserver.com/docs/install#fedora-redhat-centos),
with the appropriate DNF COPR plugin. Enabling `@caddy/caddy` is an option supplied by
Caddy; some derivatives require another compatible signed repository.

Install the architecture-appropriate Authelia binary in `/usr/local/bin/authelia`,
root:root 0755, from its official releases, after verifying `checksums.sha256`.
Historically validated versions on Rocky: Node 24.21, Caddy 2.11.7, Authelia 4.39.28.

### Application configuration

Use the [shared installation](#installation) below with:

```sh
WB_DEPLOY_DIR=deploy/linux/redhat-based
```

Installed paths and existing data are preserved; the rename in Git does not require
reinstalling an application already in production.

### Isolation and SELinux

The drop-ins restore protections sometimes overridden by the hosting provider. Check effective
values with `systemctl show`. The WorkoutBuddy isolation drop-in also protects the clock,
kernel logs, hostname, and `/proc`, prohibits namespace creation, and filters privileged
system calls. It disables core dumps.

Keep executable mappings needed by Node's JIT and outbound networking needed by the AI Coach.
Test protections in an instance with a disposable database before applying them to another host.
With SELinux enforcing, install `selinux-policy-targeted`, apply `restorecon` to installed paths,
and check `ps -eZ` and AVCs after the journeys. The Caddy package provides its policy.

Add only justified permissions; do not apply a broad `audit2allow` policy.

### Firewall and SSH access

Before enabling firewalld: allow **the actual SSH port**, HTTP/TCP, and HTTPS/TCP in the interface's
zone; remove other openings. Set up a temporary automatic rollback, verify SSH, then disarm it.
Do not change SSH at the same time. The templates assume port 22: adjust it if needed.

The Fail2ban `sshd-jail.local` template uses `firewallcmd-rich-rules`: install
firewalld if using this template, or adapt its action to the actual firewall.

### Maintenance

Use the standalone `workoutbuddy-maintenance.service` and
`workoutbuddy-maintenance.timer` units. Maintenance calls `dnf -y upgrade --refresh` and
`dnf needs-restarting`; it depends on neither RHEL modules nor `dnf-automatic`.

The old `dnf-automatic*.conf` files remain available for an existing DNF 4 installation.
They are not required on Fedora/DNF 5. Do not enable two schedulers:
the [maintenance procedure](DEPLOYMENT_OPERATIONS.md) describes migration and testing.

## Preparation

- Read `AGENTS.md`, `README.md`, `package.json`, and `.env.example`. Inspect
  `systemd-detect-virt`, `free -m`, `df -h /`, `ss -lntup`,
  `sshd -t`, `sshd -T`, and the distribution's firewall. Keep an SSH session open.
- Keep SELinux enforcing if the kernel provides it. In some LXC containers it is
  unavailable: installing its packages is insufficient to enable it; this depends on the host.
- DNS: `DOMAIN` and `auth.DOMAIN` must point to the VPS (consistent A/AAAA records).
  `duckdns.org` is a public suffix; use `name.duckdns.org` for the cookie,
  and `auth.name.duckdns.org` for the portal. Two independent DuckDNS domains
  do not share this cookie. Check the Public Suffix List before changing it.
- Back up any existing database **before migration** using the SQLite backup API
  (including the WAL), never a raw copy of an open database. Keep this
  pre-migration snapshot outside automatic retention.

## Installation

### Accounts and directories

Create the `workoutbuddy` and `authelia` accounts with `useradd --system --shell /usr/sbin/nologin
--home-dir /var/lib/NAME NAME`. Create `/var/lib/NAME` with mode 0700, owned by the corresponding account;
`/etc/authelia` as 0750 root:authelia, `/etc/workoutbuddy` as 0750 root:workoutbuddy,
`/var/backups/workoutbuddy` as 0700 root:root, and `/var/log/caddy` as 0750 caddy:caddy.

Also run `groupadd --system workoutbuddy-sessions`; the Redis package provides its system account.
On this dedicated installation, make the configuration directory accessible to the private group:

```sh
install -d -o root -g workoutbuddy-sessions -m 0750 /etc/redis
```

The `workoutbuddy-sessions.conf` file is root:workoutbuddy-sessions, 0640.
Disable the package's generic instance (`redis.service`, `redis-server.service`, or
`valkey.service`, depending on the distribution) if nothing else uses it. The private
`workoutbuddy-sessions` service remains independent.

With Valkey, install `valkey-sessions.conf` as
`/etc/systemd/system/workoutbuddy-sessions.service.d/valkey.conf`. This drop-in selects
the `valkey` account and `/usr/bin/valkey-server`; the private group remains
`workoutbuddy-sessions`. Create `/etc/redis` with the required permissions even if Redis
is not installed: backups and Authelia also use this shared path.

### Install the application

Copy the validated code to `/usr/local/lib/workoutbuddy`, root:root, without service write access.
Run `npm ci --omit=dev`, `node scripts/download-vendors.js`, and `node
scripts/download-exercise-images.js` there. Data remains exclusively in
`/var/lib/workoutbuddy`.

### Configuration and permissions

Set the non-secret domain in `$DOMAIN`, then render templates outside the repository: `python3 "$WB_DEPLOY_DIR/render.py" "$DOMAIN" /root/wb-config`. **Do not regenerate keys for an existing
installation**, especially the key encrypting TOTP secrets. Install files as follows:

| Source | Destination / permissions |
| --- | --- |
| rendered `authelia.yml`, `users.yml` | `/etc/authelia/configuration.yml`, `/etc/authelia/users.yml`, 0640 root:authelia |
| rendered `environment` | `/etc/workoutbuddy/environment`, 0600 root:root |
| rendered `Caddyfile` | `/etc/caddy/Caddyfile`, 0644 root:root |
| rendered `workoutbuddy-auth-setup` | `/usr/local/sbin/`, 0700 root:root |
| rendered `workoutbuddy-sessions.conf` | `/etc/redis/workoutbuddy-sessions.conf`, 0640 root:workoutbuddy-sessions |
| `workoutbuddy-backup` template | `/usr/local/sbin/`, 0750 root:root |
| `workoutbuddy-deploy-assets`, `workoutbuddy-maintenance` | `/usr/local/sbin/`, 0750 root:root |
| `*.service`, `*.timer` templates | `/etc/systemd/system/`, 0644 root:root |
| `caddy-hardening.conf` | `/etc/systemd/system/caddy.service.d/zzz-lxc-service.conf` |
| `valkey-sessions.conf` (if using Valkey) | `/etc/systemd/system/workoutbuddy-sessions.service.d/valkey.conf` |
| `service-hardening.conf` | same name for the workoutbuddy, authelia, and workoutbuddy-sessions services |
| `workoutbuddy-isolation.conf` | `/etc/systemd/system/workoutbuddy.service.d/zzzz-isolation.conf` |
| `authelia-sessions.conf` | `/etc/systemd/system/authelia.service.d/workoutbuddy-sessions.conf` |

### Check requirements

```sh
python3 "$WB_DEPLOY_DIR/check-platform.py"
```

This read-only check verifies the Linux family, Python 3.9+, Node 24, systemd 247+,
executables, and package manager. It does not validate a complete installation.

### Start and validate services

Validate `authelia config validate --config /etc/authelia/configuration.yml` and `caddy validate
--config /etc/caddy/Caddyfile`, then run `systemctl daemon-reload` and `systemctl enable --now
workoutbuddy workoutbuddy-sessions authelia caddy workoutbuddy-backup.timer`. Verify complete
startup before the first backup.

Node listens only on 127.0.0.1:3000, Authelia on 127.0.0.1:9091, and Caddy administration on
127.0.0.1:2019.

### HTTP headers and CSP

Caddy applies HSTS (one year, `includeSubDomains`), `nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, removes `Server` and `X-Powered-By`, and provides a default Permissions
Policy. The application (Vue) and Authelia (with nonce) CSPs are preserved; a restrictive
fallback CSP is provided for responses without a policy.

Check the headers actually received, beyond the Caddyfile, after every change.

The fallback CSP uses Caddy's `?` prefix: it replaces neither the Vue CSP (which still requires
`unsafe-eval`) nor Authelia's nonce-based CSP. `{remote_host}` forwards the address without a port;
it differs from `{remote}`. The `no-referrer` policy is compatible with the tested flow:
the return uses an explicit URL.

References: [Caddy headers](https://caddyserver.com/docs/caddyfile/directives/header),
[placeholders](https://caddyserver.com/docs/caddyfile/concepts#placeholders).

## Additional guides

- [Account, MFA, and sessions](AUTHENTICATION.md)
- [Backups, administration, and nightly maintenance](DEPLOYMENT_OPERATIONS.md)
- [Frontend releases](DEPLOYMENT_RELEASES.md)
- [Deployment validation results](DEPLOYMENT_VALIDATION.md)

## Variant checks

```sh
python3 deploy/linux/redhat-based/test-maintenance.py
python3 deploy/linux/debian-based/test-maintenance.py
python3 deploy/linux/test-deployment.py
```

Maintenance tests simulate transactions, backup failures, restarts, and time limits
without running DNF/APT or systemctl. The common test checks private configuration
rendering, family detection, and parity between shared files.

The TLS/MFA test can run with the chosen variant:

```sh
python3 "$WB_DEPLOY_DIR/test-auth-sessions.py"
```

It starts real services on temporary ports and databases. With `WB_PLAYWRIGHT_PATH`,
it adds the mobile browser check for worker recovery and logout.
Test requirements are described in [Authentication](AUTHENTICATION.md).
These tests do not replace an installation trial on each target distribution.
