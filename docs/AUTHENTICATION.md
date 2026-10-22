# Account, MFA, and sessions

[Documentation home](INDEX.md) · [README](../README.md)

## Configure the account in your terminal

Run `sudo /usr/local/sbin/workoutbuddy-auth-setup` over interactive SSH: username, unique
and varied password of at least 20 characters, entered twice with input hidden. The script
backs up, computes Argon2id without secrets in arguments or environment variables, enables
the account, and restarts Authelia. The temporary account remains disabled until then.

### Register TOTP and test logout

Open `https://auth.DOMAIN`, log in, and request TOTP registration. Read the verification
link **only in your SSH terminal**: `sudo cat
/var/lib/authelia/notifications.txt`. Open it, scan the QR in your authenticator, and
confirm a code. No SMTP or personal address required. Then truncate this private file.
Do not send secrets through messaging.

Test in a private window: password alone is insufficient, access works after TOTP, then log out
from **Settings → Log out**, or through `https://auth.DOMAIN/logout`. The proxy advertises
the button with `X-WorkoutBuddy-Logout: /auth/logout` and redirects this route to Authelia's
native logout. The remembered session is revoked without deleting SQLite data.

### Session duration

Without **Remember me**: 15 minutes of inactivity and 1 hour maximum. With this box checked on
a trusted device: full login is remembered for **60 days**, without inactivity expiration;
a new browser, deleted cookie, logout, or expiration requires password and TOTP. The cookie
remains Secure, HttpOnly, and SameSite=Lax. This mechanism does not remember MFA separately.

See the [official configuration](https://www.authelia.com/configuration/session/introduction/).

### Private Redis and persistence

`workoutbuddy-sessions.service` uses only a 0660 Unix socket, in a 0750 directory
accessible to Authelia's dedicated group. No Redis TCP port. The provider's random password
is generated outside the repository by `render.py`; for an existing installation,
add it without changing Authelia keys or the account.

Its `/var/lib/workoutbuddy-sessions` storage has mode 0700, with AOF synchronized every second
and a 32 MiB Redis limit. The service is capped at 128 MiB total RAM and 20% of one CPU.
Measured idle usage is about 7–8 MiB. A clean shutdown preserves sessions;
an abrupt interruption may lose the last second.

Do not restore old sessions from a backup: a restore must require users to log in again.

### Isolated authentication tests

The `python3 deploy/linux/redhat-based/test-auth-sessions.py` test (or its
`deploy/linux/debian-based/test-auth-sessions.py` equivalent) uses fully disposable services,
secrets, users, TOTP, and databases on loopback; it requires the Node, Caddy, Redis, and
Authelia binaries, and does not touch real accounts.

With `WB_PLAYWRIGHT_PATH` set as for E2E tests, it adds the HTTPS browser test
`test-auth-recovery.mjs`: old cache and anonymous worker installation, actual redirect
to Authelia without activation blocking, then logout through the settings button,
cancellation of a draft, and revocation of the old remembered cookie with saved data unchanged.

Both photos of an exercise are also decoded behind real TLS, CSP, and MFA. No test
certificate is added to the system; the disposable browser accepts only this test with
its own local authority and `.test` names resolved on loopback.

### AI Coach streams

AI streams are authenticated when opened and limited to 30 seconds on the provider side;
logout does not interrupt an existing stream, but prevents subsequent requests. Stop Node
to interrupt immediately.

With Valkey, use the drop-in described in the [common installation](DEPLOYMENT_LINUX.md).
The private socket and Authelia configuration remain identical.
