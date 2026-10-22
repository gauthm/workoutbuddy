# WorkoutBuddy documentation

[README](../README.md) · [License](../LICENSE)

Commands and code paths are relative to the repository root. The guides below
describe application behavior and operations in detail.

## Installation and usage

| Guide | Contents |
| --- | --- |
| [Installation](INSTALLATION.md) | Requirements, startup, local libraries and photos |
| [Programs and calendar](PROGRAMS.md) | Questionnaire, priorities, activation, duration and navigation |
| [Exercises and equipment](EXERCISES_EQUIPMENT.md) | Catalog, languages, inventory, pain and replacement |
| [Workouts and progression](WORKOUTS_PROGRESSION.md) | Data entry, resuming workouts, weights, calculations and history |
| [Settings and AI Coach](SETTINGS_COACH.md) | Profile, keeping the screen awake, saving settings, chat and API key |
| [Mobile access](MOBILE.md) | Local network, home screen, gestures and updates |
| [Data](DATA.md) | Export, import, backups, permissions and resets |

## Configuration and hosting

| Guide | Contents |
| --- | --- |
| [Docker](DEPLOYMENT_DOCKER.md) | Image, Compose, persistent volume, HTTPS proxy, backup and restore |
| [Server configuration](CONFIGURATION.md) | Environment variables, HTTP protections and limits |
| [Linux deployment](DEPLOYMENT_LINUX.md) | Debian/Ubuntu and Red Hat requirements, packages, firewall, accounts, Caddy, Authelia and systemd |
| [Authentication](AUTHENTICATION.md) | Account, TOTP, logout, Redis sessions and isolated tests |
| [Operations and maintenance](DEPLOYMENT_OPERATIONS.md) | Backups, restore, logs, DNF/APT and npm audit |
| [Frontend releases](DEPLOYMENT_RELEASES.md) | Cache, atomic publication, previous version and verification |

## Development and testing

| Guide | Contents |
| --- | --- |
| [Development](DEVELOPMENT.md) | Commands, architecture and test selection |
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
