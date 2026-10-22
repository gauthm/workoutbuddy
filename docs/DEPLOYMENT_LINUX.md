# Linux installation: common configuration

[Documentation home](INDEX.md) · [README](../README.md)

Free architecture: **Caddy → Authelia (password + TOTP) → Node 24 / SQLite**. Authelia sessions
are stored in a private, persistent Redis instance. Templates are in
`deploy/linux/redhat-based/` and `deploy/linux/debian-based/`. Run system operations as root.

For a containerized installation, use the [Docker guide](DEPLOYMENT_DOCKER.md).

First choose the packages and protections from the [Red Hat](DEPLOYMENT_REDHAT.md) or
[Debian/Ubuntu](DEPLOYMENT_DEBIAN.md) guide, then follow this common procedure.
Set `WB_DEPLOY_DIR=deploy/linux/redhat-based` or `WB_DEPLOY_DIR=deploy/linux/debian-based`
in the terminal used for these commands.

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

- [Account, MFA, and sessions](AUTHENTIFICATION.md)
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
Test requirements are described in [Authentication](AUTHENTIFICATION.md).
These tests do not replace an installation trial on each target distribution.
