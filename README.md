<p align="center">
  <img src="public/icons/workoutbuddy.svg" alt="WorkoutBuddy logo" width="96" height="96">
</p>

<h1 align="center">WorkoutBuddy</h1>

A single-user strength-training application with personalized programs, workout tracking and exercise progression. Algorithms create programs and calculate progression; an optional AI Coach provides advice.

Data is stored in SQLite on the machine running the server. When the AI Coach is enabled, the information needed for its answers is sent to the configured provider.

## Getting started

Requirements: **Node.js 24.x LTS and npm**. On macOS, SQLite may require
the Xcode Command Line Tools (`xcode-select --install`).

```sh
git clone https://github.com/gauthm/workoutbuddy.git
cd workoutbuddy
npm ci
node scripts/download-vendors.js
node scripts/download-exercise-images.js
npm start
```

Open [localhost:3000](http://localhost:3000). No frontend build is required.
Libraries and photos are installed once, then served locally.
See the [installation guide](docs/INSTALLATION.md) for details.

## Documentation

| Need | Guide |
| --- | --- |
| Create a program and use the calendar | [Programs](docs/PROGRAMMES.md) |
| Browse exercises and manage equipment and pain | [Exercises and equipment](docs/EXERCICES_MATERIEL.md) |
| Train, choose weights and track progress | [Workouts and progression](docs/SEANCES_PROGRESSION.md) |
| Configure the application and AI Coach | [Settings and Coach](docs/REGLAGES_COACH.md) |
| Use a phone, install the application and receive updates | [Mobile access](docs/MOBILE.md) |
| Back up, import, export or reset data | [Data](docs/DONNEES.md) |
| Configure the server or host the application | [Configuration](docs/CONFIGURATION.md) · [Red Hat](docs/DEPLOYMENT_REDHAT.md) · [Debian/Ubuntu](docs/DEPLOYMENT_DEBIAN.md) · [Docker](docs/DEPLOYMENT_DOCKER.md) |
| Develop and test | [Development](docs/DEVELOPPEMENT.md) · [Code index](docs/CODEBASE.md) · [Instructions](AGENTS.md) |

Guides, audits and task tracking are collected in
[docs/INDEX.md](docs/INDEX.md).

The application has no built-in authentication: use a trusted network
or an HTTPS proxy with authentication for Internet access.
