# WorkoutBuddy documentation

[README](../README.md) · [License](../LICENSE)

Commands and code paths are relative to the repository root. The guides below
describe application behavior and operations in detail.

## Installation and usage

| Guide | Contents |
| --- | --- |
| [Installation](INSTALLATION.md) | Requirements, startup, local libraries and photos |
| [Programs and calendar](PROGRAMMES.md) | Questionnaire, priorities, activation, duration and navigation |
| [Exercises and equipment](EXERCICES_MATERIEL.md) | Catalog, languages, inventory, pain and replacement |
| [Workouts and progression](SEANCES_PROGRESSION.md) | Data entry, resuming workouts, weights, calculations and history |
| [Settings and AI Coach](REGLAGES_COACH.md) | Profile, keeping the screen awake, saving settings, chat and API key |
| [Mobile access](MOBILE.md) | Local network, home screen, gestures and updates |
| [Data](DONNEES.md) | Export, import, backups, permissions and resets |

## Configuration and hosting

| Guide | Contents |
| --- | --- |
| [Docker](DEPLOYMENT_DOCKER.md) | Image, Compose, persistent volume, HTTPS proxy, backup and restore |
| [Server configuration](CONFIGURATION.md) | Environment variables, HTTP protections and limits |
| [Red Hat family](DEPLOYMENT_REDHAT.md) | DNF 4/5, RPM, SELinux and firewalld |
| [Debian and Ubuntu](DEPLOYMENT_DEBIAN.md) | APT, dpkg, needrestart and firewall |
| [Shared Linux installation](DEPLOYMENT_LINUX.md) | Accounts, private configuration, Caddy, Authelia and systemd |
| [Authentication](AUTHENTIFICATION.md) | Account, TOTP, logout, Redis sessions and isolated tests |
| [Operations and maintenance](DEPLOYMENT_OPERATIONS.md) | Backups, restore, logs, DNF/APT and npm audit |
| [Frontend releases](DEPLOYMENT_RELEASES.md) | Cache, atomic publication, previous version and verification |

## Development and testing

| Guide | Contents |
| --- | --- |
| [Development](DEVELOPPEMENT.md) | Commands, architecture and test selection |
| [Code index](CODEBASE.md) | Files by domain, services, frontend and tests |
| [Working instructions](../AGENTS.md) | Conventions, targeted validation and deployment after testing |
| [Browser tests](TESTS_E2E.md) | Playwright, domains, isolation, reports and limitations |
| [User journeys](TESTS_JOURNEYS.md) | Seven API journeys, in-memory database and coverage |
| [Current tasks](TASKS.md) | Remaining work; completed task history is in Git |

## Audits and results

These documents describe checks performed as of their publication date.

| Document | Contents |
| --- | --- |
| [Reliability audit](RELIABILITY_AUDIT.md) | Fixed defects, simulations, results and limitations |
| [Deployment validation](DEPLOYMENT_VALIDATION.md) | Frontend, data, authentication and server protections |
| [Public repository review](REPOSITORY_SECURITY.md) | Secret scanning, Git history and verification command |
