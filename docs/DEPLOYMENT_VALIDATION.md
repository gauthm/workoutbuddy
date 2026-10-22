# Rocky deployment validation

[Documentation home](INDEX.md) · [README](../README.md)

### Overall results

- 477 unit, integration, and business journey tests pass, with isolated databases.

### Interface and devices

- Home: six simulated iPhone sizes, portrait/landscape and safe areas,
  six-week months, no program, completed week, and all day statuses.
  Grid capped at a compact height and header buttons with visible background
  and outline in light/dark themes. No page scrolling or hidden action;
  session pagination, prioritized resume, and exact wording of the five goals
  in French/English on the home screen and detail title; reminder that only
  one program is active.
- Coach: short input without a scrollbar, growth with Shift + Enter up to
  120 px, scrolling for long text, shrinking after clearing and sending.
  Real request to isolated API without a configured provider, no external call.
- Mobile zoom: touch gestures checked with Chromium (pinch, double tap,
  native swipe), scale preserved at 1 and 16 px effort field with input
  without overflow. Actual Safari behavior still needs confirmation on iPhone.
- 112 browser journeys pass, desktop and mobile, with all 1,746 photos.
  Alternating between both photo positions, pause/resume, reduced motion,
  stopping offscreen, and in-workout help are covered.
- Light theme: measured contrasts in settings, home, and workout,
  text checked at a minimum of 4.5:1, field outlines at 3:1, visible focus,
  persistent preference, and readable validated values; screenshots reviewed.
- Settings: standalone logout button without a title or explanatory text,
  logout confirmation, cancellation with draft intact, return to the portal,
  and saved data preserved. Button absent without an authentication proxy.
  SVG/ICO icons decoded, Apple/manifest PNG dimensions and opacity checked;
  public files restricted to explicit paths.

### Photos and publishing

- Photos: all 1,746 catalog JPEGs present, about 101 MiB on disk,
  with offline format checks. Reproducible installation at a pinned source
  revision without changing the catalog or SQLite. A release with a missing
  photo is rejected before any directory swap; guard checked on a synthetic
  copy, then complete release validated.

### Release, authentication, and security

- Release and security:
  Publishing without a hard refresh, API never cached, real network failure
  distinguished from a 401, draft preserved, login assets rejected, and return
  to the portal after expiration during navigation, API requests, foregrounding,
  or with an old worker.
- Full disposable Caddy/Authelia/Redis/Node TLS test: password alone rejected,
  TOTP accepted, 60-day Secure/HttpOnly cookie, persistence after restarting
  both services, resume with retained cookie, logout through the settings
  button and revocation even with an earlier cookie copy, ordinary session
  expiration. Vue CSP and Authelia nonce preserved, authentication with
  no-referrer and bare IP forwarded without forged headers.
  Photos displayed behind real TLS, CSP, and MFA, rejected without login;
  installation icons accessible without a shared cookie.
- Public site checked without personal identity: redirect to Authelia and
  visible Remember me checkbox. A browser with synthetic old cache reaches
  the real portal after installing the repair worker. The worker, manifest,
  listed icons, and login/logout redirects are public; pages, exercise photos,
  other assets, and API remain protected.

### Maintenance and operations

- Nightly maintenance: DNF configuration parsed, Paris-time timer and no
  daytime catch-up checked. Seven simulated tests verify the time guard,
  prior backup, postponed reboot, and Node/Redis restart.
  Real daytime execution of the unit: no mutation or reboot.
  npm audit run without privileges, no access to databases/secrets,
  no production vulnerability reported. No actual VPS reboot performed
  for these tests; the next nightly window still needs observation in logs.

### Security and data checks

- 12 security browser journeys pass (desktop and mobile): icons, iOS safe area, CSP,
  service worker, foreign origins, JSON, AI limits, and interrupted import.
- Public HTTPS, HTTP redirect, protected UI/API/export/AI, forged identity
  headers rejected; password alone insufficient, TOTP accepted, logout and
  expiration checked with a disposable identity.
- Import/export/backup behind TLS tested with a disposable database. Clean
  restart, crash recovery, persistence, snapshot restore, and retention of
  seven backups over nine synthetic attempts checked.
- Actual process account checked: `workoutbuddy`, no effective capabilities,
  `NoNewPrivileges` and seccomp active. `/proc`, kernel, clock, hostname,
  namespace, and core dump protections checked on the effective service.
  Import/export, SQLite backup, restart, and outbound DNS/HTTPS tested
  in an instance with a disposable database under the same restrictions.
- Permissions checked: private directories 0700, databases and WAL/SHM 0600,
  dedicated owners; backup archives restricted to root. Both databases pass
  `quick_check`, direct access denied to Caddy and ordinary accounts.
- Caddy headers checked over HTTPS: HSTS, nosniff, DENY, no-referrer,
  Permissions Policy, and absence of Server/X-Powered-By headers. Vue CSP
  and Authelia nonce preserved, fallback CSP tested on a response without a policy.
- No real AI Coach provider call validated during these checks.

### Initial trial diagnosis

The first browser run was distorted by missing system fonts on the minimal server:
some text had no dimensions. After installing fonts, the previously reported
settings/import, equipment, and workout load journeys pass. Those tests had not
demonstrated application regressions.

### Test browser limitations

Playwright uses a fallback headless Chromium on Rocky, which is not among its
officially supported distributions. The top margin is tested with simulated safe-area
insets at load, on scroll, after navigation, and after inset changes; actual rendering
of an iPhone Safari web app still needs confirmation on an Apple device.
