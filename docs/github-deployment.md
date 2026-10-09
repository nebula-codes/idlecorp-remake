# Deploy the published Docker image

The [public repository](https://github.com/nebula-codes/idlecorp-remake) publishes the server and browser client together as `ghcr.io/nebula-codes/idlecorp-remake`. Use `compose.deploy.yaml` to pull that image. The separate `compose.yaml` builds from local source and is intended for development or custom builds.

You need a host with Docker Engine and Docker Compose, persistent storage, and a reachable HTTP or HTTPS address. No Node installation is needed on the deployment host. These instructions prepare your chosen host; publishing the repository does not provision a remote machine or deploy through SSH.

## First start

Clone the repository, or download just `compose.deploy.yaml` and `.env.deploy.example` from the same release. Run these commands in that directory:

```sh
git clone https://github.com/nebula-codes/idlecorp-remake.git
cd idlecorp-remake
cp .env.deploy.example .env.deploy
```

Edit `.env.deploy` before starting. Set a unique `POSTGRES_PASSWORD` and the real address players will use for `PUBLIC_ORIGIN`. The deployment passes database credentials as separate PostgreSQL environment values, so the password does not need URL encoding. Single quotes around the value preserve literal dollar signs in Compose. Keep this file private and outside version control.

For a server on a trusted LAN, an example is:

```text
POSTGRES_PASSWORD='replace-with-a-long-random-password'
PUBLIC_ORIGIN=http://192.168.1.50:3001
HOST_BIND=0.0.0.0
HOST_PORT=3001
COOKIE_SECURE=false
TRUST_PROXY=false
IDLECORP_IMAGE=ghcr.io/nebula-codes/idlecorp-remake:latest
```

Replace the example IP with the host's actual LAN address. With HTTP, `COOKIE_SECURE=false` is necessary for browsers to send the login cookie. Use HTTPS for an internet-facing server. Changing a database password in `.env.deploy` after initialization does not change the existing PostgreSQL account's password; rotate that account and its configuration together.

Start and inspect the services:

```sh
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d
docker compose --env-file .env.deploy -f compose.deploy.yaml ps
docker compose --env-file .env.deploy -f compose.deploy.yaml logs --tail=100 server
```

Compose starts `db` and `server`, waits for PostgreSQL health, and the server applies database migrations at startup. PostgreSQL has no published host port in this deployment. The named volumes `idlecorp-db` and `idlecorp-backups` retain the world and managed backup files. Do not run `down -v` when preserving either.

Open the configured origin in a browser. Windows desktop clients require HTTPS when connecting to another machine; enter that HTTPS origin under server settings to use the same world. LAN HTTP access works in the browser. `GET /api/health` reports readiness. A public GHCR image can be pulled without creating a player-facing registry account.

## HTTPS through a reverse proxy

If Caddy runs on the same host, configure:

```caddy
game.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

Use these deployment settings:

```text
PUBLIC_ORIGIN=https://game.example.com
HOST_BIND=127.0.0.1
HOST_PORT=3001
COOKIE_SECURE=true
TRUST_PROXY=true
```

Point DNS at the host and expose the proxy's ports 80/443. Enable proxy trust only when incoming application traffic is restricted to that trusted proxy. Keep browser and API on the same origin and do not cache `/api/`. Apply changed environment values with `docker compose --env-file .env.deploy -f compose.deploy.yaml up -d`; `restart` alone does not replace a container's environment.

## Image publishing and updates

The workflow in `.github/workflows/publish-image.yml` validates types, lint, unit tests, PostgreSQL API tests, and a container smoke test before publishing Linux `amd64` and `arm64` images. A push to `main` publishes `latest` and `sha-<full commit SHA>`; a `v*` release tag publishes its semantic-version tags and commit tag. Manual dispatch on `main` also publishes `latest`. Pull requests run validation without publishing.

The workflow uses GitHub's scoped Actions token for package publication; deployment hosts do not need that token. Inspect the repository's **Actions** tab for build results and the package page for available image tags and digests. A failed workflow does not produce a new successful image.

The deployment's `pull_policy: always` checks the registry when Compose starts/recreates the service with `up`. It is **not a continuous updater**. A running container keeps its current image. Docker's `restart: unless-stopped` restarts that existing image after a process failure or host reboot; it does not fetch a replacement. Publishing to GHCR alone does not redeploy your server.

To update deliberately, create a backup first, then pull and recreate:

```sh
docker compose --env-file .env.deploy -f compose.deploy.yaml exec server npm run admin -- backup
docker compose --env-file .env.deploy -f compose.deploy.yaml pull
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d
docker compose --env-file .env.deploy -f compose.deploy.yaml logs --tail=100 server
```

Use `latest` to follow the default release stream, or set `IDLECORP_IMAGE` to a published version tag or `ghcr.io/nebula-codes/idlecorp-remake@sha256:YOUR_VERIFIED_DIGEST` for a fixed image. A rollback may require restoring the matching database backup when schema changes are involved. Preserve the previous image reference and backup before upgrading. See [self-hosting](self-hosting.md) for general upgrade guidance.

## Accounts, administration, and the expansion

Register a normal account first. No account automatically receives administrator privileges. Grant an existing account the role from the deployment host:

```sh
docker compose --env-file .env.deploy -f compose.deploy.yaml exec server npm run admin -- role USERNAME admin
```

The administrator can then open **Settings → Account & security → Server operations** to inspect health, run a backup, and manage the optional expansion. Backup and expansion controls in the UI require the current password. To remove the role, use `role USERNAME player`.

Recovery codes are generated in Account & security. Save them privately: each works once, and generating a replacement set invalidates the old set. Recovery works without email and revokes existing sessions. Administrator roles and gameplay entitlements are separate; an operator can grant a tier with `npm run admin -- entitlement USERNAME gold` using the same Compose `exec server` prefix.

Supply contracts and community projects are original remake additions and default off on new or upgraded worlds. Enable them explicitly when wanted:

```sh
docker compose --env-file .env.deploy -f compose.deploy.yaml exec server npm run admin -- expansion on
docker compose --env-file .env.deploy -f compose.deploy.yaml exec server npm run admin -- expansion off
```

The choice persists in the world. Turning it off blocks new commitments while existing obligations, refunds, claims, and timed benefits can still settle. Read the [1.1 guide](enhancements.md) for player workflows and limits.

## Backups and restore

Managed backups default to enabled, every 24 hours, with seven retained files. Configure `BACKUP_ENABLED`, `BACKUP_INTERVAL_HOURS`, and `BACKUP_RETENTION` in `.env.deploy`. Their container directory is `/app/.runtime/backups`, persisted in `idlecorp-backups`. Scheduling runs inside the server process; the administrator UI reports status and failures.

Run a managed backup and copy files off the host regularly:

```sh
docker compose --env-file .env.deploy -f compose.deploy.yaml exec server npm run admin -- backup
docker compose --env-file .env.deploy -f compose.deploy.yaml cp server:/app/.runtime/backups ./backups
```

A same-host volume is not an off-host backup. Backup JSON contains password hashes, recovery-code hashes, sessions, account identities, the world, and its audit history. Keep it private and test restoration. The public repository and container image do not include your running database, `.env.deploy`, or saved backups.

Restore replaces the target world. Stop all application processes using it, preserve its current backup, and select a verified file. For example, place the chosen JSON at `./backups/idlecorp.json` and run the following in a Linux shell. The deployment already supplies the target PostgreSQL connection settings:

```sh
docker compose --env-file .env.deploy -f compose.deploy.yaml stop server
docker compose --env-file .env.deploy -f compose.deploy.yaml run --rm server npm run db:migrate
docker compose --env-file .env.deploy -f compose.deploy.yaml run --rm -v "$PWD/backups:/restore:ro" server npm run db:restore -- /restore/idlecorp.json --replace-world
docker compose --env-file .env.deploy -f compose.deploy.yaml run --rm server npm run db:migrate
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d server
```

Use the intended image version throughout restoration. Version-two backups restore recovery codes, administrator roles, and session metadata; the helper also accepts version-one backups. Re-running migrations after restoration upgrades the restored migration ledger. Native PostgreSQL dump/restore instructions are in [self-hosting](self-hosting.md).
