# Deploy WorkoutBuddy with Docker

[Documentation](INDEX.md) · [Native Linux deployment](DEPLOYMENT_LINUX.md)

## What is included

- `deploy/docker/Dockerfile`: Node 24 image, locked dependencies, and local Vue/Chart.js and photos.
- `deploy/docker/compose.yaml`: application only, accessible on localhost.
- `deploy/docker/compose.production.yaml`: requires an HTTPS origin behind an authenticated proxy.
- `deploy/docker/backup.mjs`, `restore.mjs`: consistent SQLite backup and offline restoration.

The application runs as `node` (UID/GID 1000), with a read-only filesystem and a writable
data volume. The image contains neither the personal database, `.env`, nor development
dependencies. Assets are downloaded during the build, rather than at startup.
The native `better-sqlite3` script is explicitly allowed for the locked version;
the build checks that it loads before producing the image. The first build requires
access to the Node registry, npm, GitHub, and library CDNs; it downloads about 101 MiB of photos.

## Requirements

Install [Docker Engine](https://docs.docker.com/engine/install/) and the
[Docker Compose plugin](https://docs.docker.com/compose/install/) on the host, or Docker Desktop
on macOS/Windows. Check `docker version` and `docker compose version`.
Node/npm are not required on the host. Use Compose with `up --wait` support.

All following commands run from the repository root. This variant is independent
of the systemd units in `deploy/linux/`: do not install those units in containers.

## Start locally

```sh
cp deploy/docker/.env.example deploy/docker/.env
```

Adjust `WB_PORT` in this file if port 3000 is occupied.
`WB_TIMEZONE` controls the server's local dates; its default is `Europe/Paris`. Define this shortcut in the terminal:

```sh
wb() {
  docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml "$@"
}
wb config --quiet
wb build --pull
wb up -d --wait
wb ps
```

Open `http://localhost:3000`, or the chosen port. The port is published only on `127.0.0.1`.
Local mode uses `NODE_ENV=development` to allow HTTP; the application code and installed
dependencies are the same as in production. Docker creates the named volume
`workoutbuddy_data`, with permissions for the application account.

The application has no built-in authentication. For access from the Internet or a phone,
use an authenticated HTTPS proxy; keeping the Docker port on localhost prevents
direct exposure.

## Use a production domain

First configure DNS, the HTTPS certificate, and external proxy authentication.
The Caddy/Authelia pair from the [Linux guides](DEPLOYMENT_LINUX.md) can serve as a host proxy,
or use a proxy already under administration. This composition does not start Caddy, Authelia, or Redis.

In `deploy/docker/.env`, enter the exact origin:

```dotenv
PUBLIC_ORIGIN=https://workout.example.com
```

Redefine the shortcut by adding the production override, then keep it for subsequent operations:

```sh
wb() {
  docker compose --env-file deploy/docker/.env \
    -f deploy/docker/compose.yaml \
    -f deploy/docker/compose.production.yaml "$@"
}
wb config --quiet
wb up -d --build --wait
```

The host proxy must reach `127.0.0.1:3000` (or `WB_PORT`) and preserve the public Host.
Require authentication for pages, photos, private assets, and the API. For Caddy/Authelia,
reuse the explicit public-path rules from the Linux template and adjust the Node destination.
Do not expose the Docker port directly or add a second public route to the API.

`TRUST_PROXY` remains disabled: a host proxy generally reaches the application through the
Docker bridge, rather than container loopback. `PUBLIC_ORIGIN` provides the expected HTTPS
origin and Host. With a containerized proxy, explicitly create a shared private network,
use the service name as the destination, and preserve the proxy's access protection.

The health check queries the API and SQLite on internal loopback with the correct Host,
even when the public origin is an HTTPS domain. An `unhealthy` state appears in `wb ps`;
the restart policy restarts a stopped process, rather than a merely unhealthy one.

## Update

Recreate the `wb` shortcut for the chosen mode in each new terminal. Keep the same Compose
project name to reuse the same volume.

```sh
wb exec -T workoutbuddy node deploy/docker/backup.mjs
git pull --ff-only
wb build --pull
wb up -d --wait
wb logs --tail=100 workoutbuddy
```

The volume is preserved on recreation. Migrations and catalog synchronization run at startup.
Before a release, copy the backup outside the volume as described below. Also retain the
previous image if rollback is needed; an older image may require the database backup
from before the migration.

Frontend changes must always increment the service worker version.
The usual browser update mechanism remains active.

## Back up

Run a backup while the server is running:

```sh
wb exec -T workoutbuddy node deploy/docker/backup.mjs
```

The command displays the path created in `/app/data/backups/`. It uses the application's
SQLite mechanism, including WAL transactions, and retains the seven latest copies.
To copy them outside the volume:

```sh
umask 077
mkdir -p "$HOME/workoutbuddy-backups"
wb cp workoutbuddy:/app/data/backups/. "$HOME/workoutbuddy-backups/"
```

Databases and their backups contain private data, including the configured API key.
Keep them outside Git and on suitable storage. JSON export from the interface remains
available and excludes the API key. Schedule the backup command on the host if periodic copies are wanted.

## Restore a SQLite backup

Stop the application first. Use a file produced by a consistent SQLite backup:

```sh
wb stop workoutbuddy
wb run --rm --no-deps -T workoutbuddy node deploy/docker/restore.mjs < /path/to/backup.db
wb up -d --wait
```

The program checks integrity and expected tables before replacement. Invalid input is rejected.
The previous SQLite files and journals are kept together in a `.restore-*` subdirectory
of the volume; they are not deleted automatically. Never run this restore while the server
is using the database. To recover on another machine, build the image, create the volume
with the `run` command, restore, then start the application.

## Stop and diagnose

```sh
wb logs --tail=100 workoutbuddy
wb ps
wb stop
wb down
```

`down` preserves the volume. The `down -v` option deletes data: it is not part of the
update procedure. Shutdown allows 35 seconds for HTTP draining and SQLite closure.

## Verify an image

After building, with Python 3 on the host:

```sh
python3 deploy/docker/test-docker.py --image workoutbuddy:local
```

Adjust the tag if `WB_IMAGE_TAG` has changed. The test creates its own containers and a fresh volume,
without publishing a port or using the personal database. It checks the API, unprivileged account,
read-only filesystem, local/production health checks, persistence after recreation,
clean shutdown, backup, and restore. Its resources are removed at the end.

References: [Compose build](https://docs.docker.com/reference/compose-file/build/),
[service options](https://docs.docker.com/reference/compose-file/services/),
[official Node image](https://github.com/nodejs/docker-node).
