# One shared world, many clients

## Deploy the server

Use a Linux host with Docker Engine and Compose, or Node 24 plus PostgreSQL 18. No Discord credentials, subscriptions, or paid external services are required.

Copy the repository to the host. Set a strong database password and the public HTTPS origin in an untracked `.env` used by Compose:

```text
POSTGRES_PASSWORD=replace-with-a-long-random-password
PUBLIC_ORIGIN=https://game.example.com
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION=7
```

Use a URL-safe password or URL-encode it in the connection URL if adapting the supplied Compose file. Start the database and application:

```sh
docker compose --profile full up --build -d
docker compose logs -f server
```

Migrations run on server startup; `npm run db:migrate` is also available separately. Compose persists PostgreSQL in `idlecorp-db` and managed backup files in `idlecorp-backups`, mounted at `/app/.runtime/backups`. Do not run `docker compose down -v` against a world or backups you intend to keep.

For a native installation, set process environment variables before running npm commands. The native scripts do not automatically load `.env`; `.env.example` documents available settings. For example, in PowerShell:

```powershell
$env:DATABASE_URL = 'postgres://idlecorp:YOUR_PASSWORD@localhost:5432/idlecorp'
$env:PUBLIC_ORIGIN = 'https://game.example.com'
$env:NODE_ENV = 'production'
npm ci --include=dev
npm run db:migrate
npm run build
npm start
```

Run the server under a service manager for automatic restarts. PostgreSQL and the managed backup directory must remain persistent across deployments.

## HTTPS and clients

Point DNS at the host, allow inbound 80/443, and configure a reverse proxy. A Caddy example:

```caddy
game.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

Expose only HTTPS publicly. PostgreSQL's Compose port binds to localhost; restrict port 3001 to the reverse proxy when internet facing. Browser frontend and API should share the same HTTPS origin, matching `PUBLIC_ORIGIN`. Do not cache `/api/`. Secure cookies are the default in production or with an HTTPS public origin. `COOKIE_SECURE=false` is only for deliberate loopback HTTP development. Enable `TRUST_PROXY=true` only behind a trusted proxy; add it explicitly to the container environment if needed.

Browsers visit `https://game.example.com`. Desktop clients enter that same address in server settings and sign in to the same accounts. Player machines need no database. A disconnected client reconciles with the authoritative server when it reconnects. The shared server must remain running for live play; after a restart it advances its saved timeline under the documented downtime rule.

## Accounts, recovery, and administrators

Register accounts normally. There are no seeded administrators, and the first account does not become an administrator. Grant the role through the server CLI with direct access to the correct database:

```sh
docker compose exec server npm run admin -- role USERNAME admin
```

For a native installation with `DATABASE_URL` already set:

```sh
npm run admin -- role USERNAME admin
npm run admin -- role USERNAME player
```

Administrators see **Settings → Account & security → Server operations**. It shows live database/schema health, simulation status, account/session counts, and backup status. Manual backups and expansion changes require the administrator's current password. Administrator status does not grant a gameplay entitlement. Grant those separately when desired:

```sh
npm run admin -- entitlement USERNAME gold
```

Supported tiers are `free`, `plus`, `gold`, and `platinum`; no payment or Discord account is needed.

Every player can generate eight one-use recovery codes in Account & security using their current password. Codes are displayed once, stored only as hashes, and replaced when a new set is generated. The sign-in recovery form accepts a username, unused code, and new 10–128-character password. Recovery revokes all sessions; ordinary password changes revoke other sessions while preserving the current one. Players can also inspect and revoke their own sessions. There is no email recovery service, so encourage players to save their codes before they lose access.

## Automatic and manual backups

The server runs consistent application JSON backups while online. The scheduler checks shortly after startup and once per minute; a fresh installation creates its first backup when due. Scheduling runs only while the server process is running. Each successful managed backup applies retention and writes its status manifest. Database coordination prevents competing server and administrative processes from running the same scheduled backup simultaneously.

| Process environment | Default | Meaning |
| --- | --- | --- |
| `BACKUP_ENABLED` | `true` outside tests | Enable automatic scheduling |
| `BACKUP_DIR` | `.runtime/backups` | Writable persistent backup directory; Compose fixes this to `/app/.runtime/backups` |
| `BACKUP_INTERVAL_HOURS` | `24` | Interval, bounded to 1–168 hours |
| `BACKUP_RETENTION` | `7` | Retained managed files, bounded to 1–90 |

Create a managed backup immediately from the administrator UI or CLI:

```sh
docker compose exec server npm run admin -- backup
docker compose cp server:/app/.runtime/backups ./backups
```

The native equivalent is `npm run admin -- backup`. It uses the same directory and retention policy. Files remain server-side; the UI reports their names and sizes. Copy backups away from the server regularly and test restoration. A volume on the same host does not protect against loss of that host.

For an explicit standalone export path, with `DATABASE_URL` set:

```sh
npm run db:backup -- artifacts/idlecorp.json
```

This helper also takes a consistent snapshot and atomically writes the destination, but does not participate in managed retention. Version-two JSON backups include accounts, corporations, world state, sessions, idempotency records, economic audit, migrations, and recovery-code hashes. Keep them private: they contain password hashes, session records, and account identifiers. Desktop encrypted cookies are client-local and can be replaced by signing in again.

## Restore a world

Stop every application/simulation process using the target database. Verify the target connection and preserve a backup of its current state. JSON restore replaces all application data in one transaction; it requires an explicitly supplied `DATABASE_URL` and `--replace-world`. Migrate the target schema first:

```powershell
$env:DATABASE_URL = 'postgres://idlecorp:YOUR_PASSWORD@localhost:5432/idlecorp'
npm run db:migrate
npm run db:restore -- artifacts/idlecorp.json --replace-world
npm run db:migrate
npm start
```

The restore tool accepts backup versions one and two. Version two restores recovery codes, administrator roles, and session metadata. A version-one backup has no recovery codes or administrator grants to recover; migration supplies the newer schema defaults. Run migrations again after restoring an older backup because its migration ledger is restored too.

For Compose, copy a chosen JSON backup to a host path, stop the server, then mount that directory read-only into a one-off server container. The following example assumes `./backups/idlecorp.json` is the verified backup on a Linux host:

```sh
docker compose stop server
docker compose run --rm server npm run db:migrate
docker compose run --rm -v "$PWD/backups:/restore:ro" server npm run db:restore -- /restore/idlecorp.json --replace-world
docker compose run --rm server npm run db:migrate
docker compose up -d server
```

PostgreSQL native backups are also supported. For larger databases, use its custom dump format. Avoid PowerShell binary redirection by dumping inside the container and copying the file out:

```sh
docker compose exec db pg_dump -U idlecorp -d idlecorp -Fc -f /tmp/idlecorp.dump
docker compose cp db:/tmp/idlecorp.dump ./idlecorp.dump
```

Restore a verified native dump with the application stopped:

```sh
docker compose stop server
docker compose cp ./idlecorp.dump db:/tmp/idlecorp.dump
docker compose exec db pg_restore -U idlecorp -d idlecorp --clean --if-exists /tmp/idlecorp.dump
docker compose start server
```

## Upgrade to 1.1 and choose the expansion

Back up the database, stop the game process, install the new source/dependencies, run migrations, rebuild, and restart without resetting the database. With Compose, preserve the named volumes and use `docker compose --profile full up --build -d`. Keep the previous build and matching backup for rollback; schema rollback requires that backup.

Migration 002 adds administrator roles, richer sessions, and recovery codes. Existing corporation progression remains. Planning and organization are available immediately; performance and watched-price histories begin with new observations, with no backfill. Use matching browser/desktop releases; incompatible protocols are rejected.

The optional supply contracts and regional community projects are **original remake adaptations**, documented in the [1.1 guide](enhancements.md). They default off for fresh and upgraded worlds. Enable them explicitly through the administrator UI or CLI:

```sh
npm run admin -- expansion on
npm run admin -- expansion off
```

For Compose, prefix these commands with `docker compose exec server`. The setting is saved in the world, not read from an expansion environment variable. Turning it off blocks new commitments while existing delivery, cancellation, refunds, claims, and earned timed benefits can still settle. The delivered local demonstration world is enabled separately during setup; a newly hosted world keeps the default until its administrator chooses otherwise.

## Operations and development fixtures

`GET /api/health` reports API/database readiness. Server logs are structured JSON. Keep logs and backups private. Economic writes are serialized through PostgreSQL to avoid double spending; use the measured load reports when sizing a host. Monitor large worlds and long catch-up timelines, and coordinate event ownership before adding simulation workers.

For an explicitly disposable development database, register a test account, then use:

```powershell
$env:ALLOW_DEV_TOOLS = '1'
npm run dev:fixture -- seed USERNAME mid
npm run dev:fixture -- advance 3600
```

Fixtures are `early`, `mid`, and `late`. They replace that corporation's progression and record the transformation in activity and economic audit. Time advancement rebases saved timestamps backward and settles the whole development world to the current time. The tool rejects `NODE_ENV=production`; never point it at a real shared world. Normal registration receives no fixture grants.
