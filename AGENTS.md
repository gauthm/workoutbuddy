# AGENTS.md

[Documentation home](docs/INDEX.md) · [README](README.md)

- [1. Project](#1-project)
- [2. Stack — pinned versions](#2-stack--pinned-versions)
- [3. Absolute rules](#3-absolute-rules)
- [4. Essential conventions](#4-essential-conventions)
- [5. Finding information](#5-finding-information)
- [6. Submission checklist](#6-submission-checklist)
- [7. Isolated browser journeys](#7-isolated-browser-journeys)
- [8. Deployment after validation](#8-deployment-after-validation)
- [9. Deploying to a new host](#9-deploying-to-a-new-host)

Read these instructions before working. Explicit user instructions take precedence over repository conventions.

---

## 1. Project

**WorkoutBuddy** — a single-user strength-training SPA, usable locally or self-hosted
(native Linux or Docker), accessible from desktop or mobile browsers.
Express + SQLite + Vue 3, **no frontend build**; after installing dependencies and
resources, `npm start` starts the application.

---

## 2. Stack — pinned versions

| Role | Technology | Version |
|---|---|---|
| Runtime | Node.js | 24.x LTS |
| HTTP | Express | 4.22.3 |
| DB | better-sqlite3 | 13.0.3 |
| UI | Vue 3 (local file) | 3.5.44 |
| Charts | Chart.js (local file) | 4.6.1 |
| API tests | supertest | 7.3.1 |
| Unit tests | node:test + assert | built-in |

**Never add an npm package.** Implement it manually or ask first.

The native `better-sqlite3` script is allowed for its locked version through
`package.json#allowScripts`. When updating this dependency, also review this
permission; do not globally allow all installation scripts.

---

## 3. Absolute rules

| ❌ Forbidden | ✅ Instead |
|---|---|
| `.vue`, `.ts`, `.jsx` files | Plain `.js` Vue 3 components |
| `async/await` on better-sqlite3 | Synchronous `.get()` `.all()` `.run()` |
| SQL concatenation | `?` or `@param` parameters |
| `fetch()` in a component | Go through `api.js` |
| Returning `ai_api_key` over HTTP | `ai_api_key_set: bool` only |
| Hardcoded visible text in a template | `t('key')` + `locales/fr.json` + `locales/en.json` |
| Editing an existing migration | New `NNN_description.sql` file |
| `data/workoutbuddy.db` in a test | `:memory:` DB |
| Second better-sqlite3 instance | `getDb()` singleton |

---

## 4. Essential conventions

**Language** — English is the default for all repository documentation (including README,
AGENTS and task files), source code, identifiers, comments, test descriptions and developer-facing
messages, even when the user speaks French. Keep user-facing localization resources and language-specific
test fixtures in their intended languages. Use English for new file and directory names as well;
when renaming existing files, update every link, import, script and configuration reference.
Keep standard names such as `README.md` and `AGENTS.md`, locale codes such as `fr.json`, and
externally required filenames. Preserve existing API, database and migration compatibility;
do not translate persisted values or public contracts without an explicit migration.

**DB** — every JSON field (`primary_muscles`, `equipment_required`, `signal_data`…):
`JSON.stringify()` before INSERT, `JSON.parse()` after SELECT. Always.

**Migrations** — files in `src/db/migrations/NNN_*.sql`, increasing numbering, idempotent.

**API responses** — strict JSON: `{ "error": "NAME" }` for errors. Codes: 200 OK · 201 Created ·
204 Deleted · 400 Bad request · 404 Not found · 409 Conflict · 500 Server error.

**Components** — `{ name, props, template, setup() }`. Declare typed props.

**i18n** — every new visible string: a key in `fr.json` + `en.json` + `t('key')` in the
template.

**SW cache** — every change to `public/`: bump `CACHE_NAME` in `public/sw.js`
(`workoutbuddy-vN` → `vN+1`) and add new `.js` files to `PRECACHE_URLS`.

---

## 5. Finding information

- [INDEX.md](docs/INDEX.md): guides by topic; [README.md](README.md): quick start.
- [INSTALLATION.md](docs/INSTALLATION.md), [DEVELOPMENT.md](docs/DEVELOPMENT.md): installation and test commands.
- [CODEBASE.md](docs/CODEBASE.md): index for finding relevant files.
- [TASKS.md](docs/TASKS.md): work in progress or remaining tasks.
- [Browser tests](docs/TESTS_E2E.md) and [User journeys](docs/TESTS_JOURNEYS.md): testing guides.

For each request: read current tasks, identify relevant files in the index, then load only the
sources needed. Implement, run appropriate checks and remove completed tasks after validation.
Do not recreate old plans or duplicate descriptions of application behavior in reports.

If no tasks are pending, work only on the user's explicit request. Change history and previous
tasks are in Git. Look for missing information in guides and then sources before asking a question.

All code paths and commands in this documentation are relative to the repository root.
Markdown links are relative to their document. Keep Markdown guides in `docs/`. The README,
license and this `AGENTS.md` file stay at the root to make repository instructions discoverable.

**Target size per session:** `AGENTS.md` + current task + relevant source files = **< 30
k tokens**. If a source file exceeds 500 lines, copy only the relevant sections.

---

## 6. Submission checklist

- [ ] No npm dependency added
- [ ] Targeted tests for affected areas pass; do not routinely run `npm test` or all journeys
- [ ] Visible strings in BOTH `fr.json` and `en.json`
- [ ] No API key in HTTP responses
- [ ] JSON columns correctly serialized/deserialized
- [ ] No SQL concatenation
- [ ] If `public/` changed → `CACHE_NAME` bumped in `sw.js`
- [ ] After development and testing, update affected guides in `docs/`, the `README.md` overview and `docs/CODEBASE.md` index to reflect current behavior and files
- [ ] Once checks are complete, commit changes and push them to `main`
- [ ] For an application change, deploy to production after validation, then verify the served version and service health (§8)

## 7. Isolated browser journeys

For each change, read the diff and test only affected behavior and its dependencies.
**Do not rerun all suites after every small change or repeat successful validation
without a new reason.**

- Targeted Node tests: `npm run test:affected` selects affected files (unit test imports, API domains and dependent user journeys). `npm run test:affected -- --list` previews selection without running tests. To specify files after reviewing the diff: `npm run test:affected -- tests/unit/equipmentCalc.test.js tests/integration/equipmentEnhancements.test.js`. Node options, such as `--test-name-pattern=...`, can also target a user journey scenario.
- Interface: run affected domains, for example `npm run test:e2e -- coach` or `npm run test:e2e -- exercises motion`. `npm run test:e2e:affected` selects automatically, including the dashboard, chat and modified journey files. A cache version change alone does not trigger an additional journey.
- For shared files (styles, translations, i18n, etc.), inspect changed lines: if the scope is local, explicitly choose domains with `npm run test:e2e:affected -- --domains exercises,motion`. Do not use this option to bypass a genuinely global change. If necessary, also target a case with `--grep`, keeping desktop and mobile coverage for interface changes.
- Add or adapt the domain test when user behavior changes. Documentation-only changes require no tests. Changes to test selection are checked with `tests/unit/e2eSelection.test.js` and selection commands, without running all application journeys.
- Reserve full `npm test` and `npm run test:e2e` runs for cross-cutting changes (server, schema, dependencies, global navigation…), uncertain impact or explicit requests. Selectors retain a full-suite fallback for unknown sources and global dependencies. Update the rules when adding a new domain or test.
- On failure, analyze the cause, then rerun the affected case after fixing it. Do not restart the full suite by default.

Tests in `tests/e2e/` use the already installed Playwright, the real server and a
**temporary SQLite database created by the fixture**, on a free local port. This file-based
database is required for restart tests; never supply a personal database, external URL or
already running server. Other tests retain their existing isolation rules. Guide:
`docs/TESTS_E2E.md`.

The local `.githooks/pre-push` hook, installed with `npm run hooks:install`, runs only Node files
and browser domains affected by pushed commits: Node tests without ephemeral TCP ports,
then browsers against real HTTP servers.

## 8. Deployment after validation

The user is the application's only user and grants ongoing authorization to deploy requested
changes directly to production. **Do not wait for another “go” or request deployment
confirmation**, unless the user explicitly instructs otherwise for the current request.

After every application change:

1. Complete development and review the diff.
2. Run targeted tests for modified code and check affected interface behavior, on desktop and mobile where relevant, following §7. Fix failures before delivery.
3. Update affected documentation, commit and push to `main`.
4. Deploy the validated version directly using the matching distribution section and shared procedure in `docs/DEPLOYMENT_LINUX.md`, or `docs/DEPLOYMENT_DOCKER.md` for Docker installations. For frontend-only changes, use `/usr/local/sbin/workoutbuddy-deploy-assets /usr/local/src/workoutbuddy/public`. For backend changes or migrations, follow the corresponding procedure, with a SQLite backup before migration.
5. Verify the files or version actually served in production and service health. Explicitly state in the final response that deployment was completed, or explain the blocker if delivery did not succeed.

A documentation-only change requires neither application tests nor application redeployment.

## 9. Deploying to a new host

### File sources and variant selection

**Always start from versioned `deploy/` contents in this Git repository.** The neighboring
working directory contains host-specific rendered files, configuration backups and reports;
it never replaces repository templates. Do not reuse another server's secrets.

1. Inspect the host: `uname -s`, `uname -m`, `/etc/os-release`, package manager,
   existing services and hosting mode. An installed application retains its native or Docker
   mode; do not migrate it implicitly.
2. For a native Linux installation, choose based on `ID` and `ID_LIKE`: RHEL/Fedora family
   → `deploy/linux/redhat-based/`; Debian/Ubuntu → `deploy/linux/debian-based/`.
   Check requirements and packages in that family's section of `docs/DEPLOYMENT_LINUX.md`, then run its `check-platform.py`.
   Do not force a variant onto an incompatible OS.
3. For Docker, start from `deploy/docker/` and `docs/DEPLOYMENT_DOCKER.md`.
   Do not install application systemd units inside containers. On macOS/Windows,
   use Docker or the documented local installation; native Linux scripts do not apply.

### Linux locations and permissions

The reference native layout is:

| Location | Role | Owner and permissions |
| --- | --- | --- |
| `/usr/local/src/workoutbuddy` | Git clone, development, testing and build | Deployment administrator; `0700` on this single-administrator server |
| `/usr/local/src/workoutbuddy-deploy` | Private deployment workspace, next to the clone | Same administrator, `0700`; never versioned or served over HTTP |
| `/usr/local/lib/workoutbuddy` | Running copy of validated code | `root:root`, directories `0755`, regular files `0644`, executable files only `0755`; no service write access |
| `/var/lib/workoutbuddy` | SQLite, journals and internal backups | `workoutbuddy:workoutbuddy`, directories `0700`, databases and journals `0600` |
| `/etc/workoutbuddy` | Instance configuration | Directory `root:workoutbuddy` `0750`; environment `root:root` `0600`, read by systemd |
| `/var/backups/workoutbuddy` | Private database and configuration snapshots | `root:root`, directory `0700`, private files `0600` |

`/usr/local/src` is suitable for local sources: retain this path on a new native Linux host.
If the clone is elsewhere, check its uses and move it into this directory before the first
installation, then fix dependent paths. Do not move a clone already correctly located.
The `workoutbuddy-deploy` directory must **always be created under the same parent as the
clone**; on this server both therefore remain under `/usr/local/src`.

On the current server, both directories belong to root and their permissions are limited to
`0700`; `.git/` is also `0700`. Source files can retain their Git modes: the parent directory
restriction protects the entire tree, including ignored local files. Preserve script executable
bits; do not apply `chmod -R 644` or `chmod -R 777`. Do not change global permissions on
`/usr/local/src`, or those of the active installation through a recursive command on the clone.
For another administrator, use their account for the clone and private workspace, and sudo
only for system operations.

Example **for a new host administered as root**, without overwriting an existing clone:

```sh
umask 077
install -d -o root -g root -m 0700 /usr/local/src/workoutbuddy
git clone https://github.com/gauthm/workoutbuddy.git /usr/local/src/workoutbuddy
cd /usr/local/src/workoutbuddy
WB_REPO="$(pwd -P)"
WB_WORK="$(dirname "$WB_REPO")/workoutbuddy-deploy"
install -d -o root -g root -m 0700 "$WB_WORK"
```

Never point a website at the clone or workspace. Generated secrets, private archives, `.env`,
exports and databases remain outside Git. Workspace `0700`, private rendered files `0600`,
`umask 077` when creating them; no secrets in validation logs.

### Initial native installation and subsequent releases

1. Install family-specific requirements and verified binaries. Then follow
   `docs/DEPLOYMENT_LINUX.md` to create dedicated accounts, directories, network rules,
   configuration and units. The guide includes distribution-specific packages and shared
   commands and destinations without depending on a conversation.
2. Set `WB_DEPLOY_DIR` to the chosen variant. For a new instance only, render its templates
   into a private subdirectory of `WB_WORK`, then install each rendered file with the specified
   ownership and permissions. Never regenerate keys for an existing instance.
3. Copy validated code to `/usr/local/lib/workoutbuddy`, excluding `.git`, `.env`,
   local data, test results and development dependencies. Install locked dependencies and
   resources in this copy, then enforce the code permissions above. The personal database
   remains in `/var/lib/workoutbuddy`, separate from the clone and running code.
4. Validate Caddy/Authelia and units, start services, configure the account/MFA from the
   private terminal and verify authenticated HTTPS access. Enable backups and exactly one
   maintenance scheduler following `docs/DEPLOYMENT_OPERATIONS.md`.
5. For subsequent changes: targeted tests for modified code and UI, documentation,
   commit/push, then authorized direct deployment (§8). For frontend-only changes, use
   `workoutbuddy-deploy-assets` from the chosen variant to publish validated `public/` files.
   Install system tools from these versioned sources; do not invent another procedure from
   old `WB_WORK` files. For backend changes or migrations, first create a consistent SQLite
   backup outside retention, retain previous code and check the service after delivery.
   Verify the version actually served and retain a usable rollback.

Location references: [FHS, local hierarchy](https://specifications.freedesktop.org/fhs/latest-single/).
Root instruction convention: [official OpenAI documentation](https://developers.openai.com/blog/custom-code-review-rules-for-codex).
