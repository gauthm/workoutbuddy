# Release a new frontend version

[Documentation home](INDEX.md) · [README](../README.md)

## Cache, authentication, and updates

Every change to `public/` increments `CACHE_NAME` in `sw.js`. The service worker precaches
static files after access checks, never protected HTML. Navigation stays native to let
the browser follow Authelia; an API 401 also returns to the portal, while a real network
failure keeps `OFFLINE`.

The `/sw.js` worker is public so it can replace an older worker even after expiration;
`/auth/login` and `/auth/logout` are public redirects to the portal. The manifest and only
the icon files explicitly listed in the `@public_assets` matcher are public for browsers
and iPhone installation without a shared cookie. They contain no user data.

The interface, other assets, and the entire API remain authenticated; do not open `icons/*` or
other paths with a wildcard. A worker installed during an expired session precaches no private
assets and repairs visible windows already cached. Caddy prevents HTTP caching of the
bootstrap, worker, and `offline.html`.

In the foreground, the application checks connectivity and looks for a version at startup,
then every five minutes. Browsing screens reload automatically; data entry or a workout
postpones reloading and displays a button with confirmation.

### Publish validated files

After isolated tests, publish without changing code ownership to the service account: `sudo
/usr/local/sbin/workoutbuddy-deploy-assets /PATH/TO/REPOSITORY/public`. First install assets
in the clone with `node scripts/download-vendors.js` and `node scripts/download-exercise-images.js`.
The publishing script rejects a version with missing or invalid catalog photos.

JPEGs remain served locally and protected by Authelia; the browser requires no image requests
to GitHub. This root script atomically swaps two `public/` directories, keeps the old copy
in `.public-release-*` for rollback, and does not touch SQLite.
Keep only one previous copy after validation.

With SELinux enforcing, check staging and destination contexts before publishing. This script
only deploys the frontend: backend changes require deploying validated code.

### Migrate an old worker

When migrating from the old worker without a reload mechanism, closing and reopening the
application once may be necessary; do not clear site data. Subsequent versions use
automatic detection.

### Pre-release checks

Pre-update validation: `npm ci && npm test` in the source copy; isolated journeys according to
`docs/TESTS_E2E.md`. Check TLS/HTTP 308, protected UI/API/export/AI, public worker without private
data, forged headers, alternate Host, and direct ports. Test MFA, logout, expiration,
import/export/backup on a disposable database behind the proxy, restarts, and restore.

The AI Coach remains disabled without an explicitly selected free provider; no real call can
be validated without configuration.
