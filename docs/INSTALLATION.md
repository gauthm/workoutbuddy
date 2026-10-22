# Installing WorkoutBuddy

[Documentation home](INDEX.md) · [README](../README.md)

## Requirements

Requirements: Node.js 24.x LTS (selected in `.nvmrc`) and npm. On macOS, install the
Xcode Command Line Tools if needed to compile SQLite: `xcode-select --install`.

## Install and start

```sh
git clone https://github.com/gauthm/workoutbuddy.git
cd workoutbuddy
npm ci
node scripts/download-vendors.js
node scripts/download-exercise-images.js
npm start
```

Open [http://localhost:3000](http://localhost:3000). `npm start` starts the server and applies
migrations and the bundled catalog. No frontend build is required. Vue and Chart.js libraries
are downloaded once, then served locally.

## Exercise photos

Photos are downloaded once from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db), at a pinned revision, then served
locally with the application.

The script fetches only the 1,746 JPEGs referenced by the catalog: it resumes missing downloads,
checks their format and changes neither the catalog nor SQLite. `node
scripts/download-exercise-images.js --check` verifies the installation without network access.
These reproducible files are excluded from Git and must be installed on each new machine.
