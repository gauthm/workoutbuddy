# Deployment on the Red Hat family

[Documentation](INDEX.md) · [Common installation](DEPLOYMENT_LINUX.md) · [Debian/Ubuntu](DEPLOYMENT_DEBIAN.md)

## Scope

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

## Packages

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

## Application configuration

Follow the [common installation](DEPLOYMENT_LINUX.md) with:

```sh
WB_DEPLOY_DIR=deploy/linux/redhat-based
```

Installed paths and existing data are preserved; the rename in Git does not require
reinstalling an application already in production.

## Isolation and SELinux

The drop-ins restore protections sometimes overridden by the hosting provider. Check effective
values with `systemctl show`. The WorkoutBuddy isolation drop-in also protects the clock,
kernel logs, hostname, and `/proc`, prohibits namespace creation, and filters privileged
system calls. It disables core dumps.

Keep executable mappings needed by Node's JIT and outbound networking needed by the AI Coach.
Test protections in an instance with a disposable database before applying them to another host.
With SELinux enforcing, install `selinux-policy-targeted`, apply `restorecon` to installed paths,
and check `ps -eZ` and AVCs after the journeys. The Caddy package provides its policy.

Add only justified permissions; do not apply a broad `audit2allow` policy.

## Firewall and SSH access

Before enabling firewalld: allow **the actual SSH port**, HTTP/TCP, and HTTPS/TCP in the interface's
zone; remove other openings. Set up a temporary automatic rollback, verify SSH, then disarm it.
Do not change SSH at the same time. The templates assume port 22: adjust it if needed.

The Fail2ban `sshd-jail.local` template uses `firewallcmd-rich-rules`: install
firewalld if using this template, or adapt its action to the actual firewall.

## Maintenance

Use the standalone `workoutbuddy-maintenance.service` and
`workoutbuddy-maintenance.timer` units. Maintenance calls `dnf -y upgrade --refresh` and
`dnf needs-restarting`; it depends on neither RHEL modules nor `dnf-automatic`.

The old `dnf-automatic*.conf` files remain available for an existing DNF 4 installation.
They are not required on Fedora/DNF 5. Do not enable two schedulers:
the [maintenance procedure](DEPLOYMENT_OPERATIONS.md) describes migration and testing.
