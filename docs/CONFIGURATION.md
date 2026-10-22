# Server configuration and protections

[Documentation home](INDEX.md) · [README](../README.md)

Environment variables take precedence over saved settings. They can be defined in
an `.env` file at the root, using [.env.example](../.env.example) as a reference.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Listening address |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `data/workoutbuddy.db` | SQLite database, path relative to startup directory or absolute |
| `NODE_ENV` | development | `production` requires an explicit HTTPS origin |
| `PUBLIC_ORIGIN` | Request's local HTTP origin | Exact public URL, for example `https://workout.example.com` |
| `TRUST_PROXY` | disabled | `loopback` only when the proxy is local, protected and rewrites forwarded headers |

If `HOST` or `PORT` is defined in `.env`, changing the corresponding setting in the interface
does not override that variable. Restart the server after a network change. Configure the
AI Coach key in the application.

### HTTP protections and hosting

### Origin and HTTP requests

Responses include a CSP, iframe and content-sniffing protections, and a restrictive referrer
policy. API data is not cached. API calls with a foreign origin or marked as coming from
another site are rejected; writes with a body require JSON.

Without `PUBLIC_ORIGIN`, only `localhost` hosts and IP addresses are accepted to block
DNS rebinding; for a custom local name, set its exact HTTP origin. Clients without an
Origin header (CLI and local tools) remain supported: these checks do not replace
authentication.

### Content policy

The CSP allows `unsafe-eval` for current Vue template compilation and inline styles used
by the interface; inline scripts are prohibited. Removing `unsafe-eval` would require
precompiling templates. Service worker registration is in the application's external module.
HSTS applies to the configured HTTPS origin or a connection recognized as HTTPS, without
forcing HTTPS on an HTTP LAN.

### Request limits

Per-IP, per-minute limits: 600 API calls; within this total, 60 program creations/previews,
30 imports/backups/resets and 12 AI calls (chat, connection, models, advice). At most two
AI calls and one import can be in progress for the single-user instance; the import slot
is reserved before reading the large request body.

A 429 response includes `Retry-After`; limits use bounded memory and reset on restart.
JSON bodies are limited to 100 KB, except imports at 20 MB; compressed bodies are rejected.
The server also bounds request/header reception timeouts.

### Public hosting

On a VPS, bind Node to `127.0.0.1`, behind a proxy or tunnel with HTTPS **and external
authentication**. Set `NODE_ENV=production` and
`PUBLIC_ORIGIN=https://workout.example.com`.

The proxy must preserve the public Host field and redirect HTTP to HTTPS; do not expose
Node's port directly. `TRUST_PROXY=loopback` allows reading the forwarded IP only from a
trusted local proxy; it must remove or rewrite client-provided headers. Proxy headers
are ignored by default. Do not run the application as root.

### Versions and dependencies

Server dependencies are locked in `package-lock.json`. Check with `npm audit`, install with
`npm ci` and test updates before deployment. The target is Node 24 LTS; Node 20 is no longer
supported.

### Linux hosting and Authelia sessions

The [Linux deployment guide](DEPLOYMENT_LINUX.md) covers Red Hat and Debian/Ubuntu,
including shared public hosting configuration with Caddy and Authelia.
Both families provide backups, systemd protections and nightly maintenance
specific to their package manager. npm dependencies remain audited weekly and updated
after testing.

On a trusted device, selecting **Remember me** in Authelia keeps the full login session
for 60 days, including after maintenance. Without this option: 15 minutes of inactivity,
one hour maximum. Logging out invalidates the remembered session; the browser may also
remove its cookie earlier.
