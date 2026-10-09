# IdleCorp

A self-hostable industrial management game for browsers and Windows, based on the public IdleCorp wiki. The shared PostgreSQL server owns every corporation, production cycle, trade and reward. The same account works in both clients.

This is an independent remake. Source evidence, uncertain formulas and intentional adaptations are recorded in `docs/research`. The implementation is checked against a frozen ruleset rather than claiming access to the original private backend.

## Deploy with Docker

GitHub Actions validates the game and publishes Linux AMD64/ARM64 images to **`ghcr.io/nebula-codes/idlecorp-remake`**. Your Docker server only needs the deployment Compose file and environment settings; it does not build the application.

```sh
git clone https://github.com/nebula-codes/idlecorp-remake.git
cd idlecorp-remake
cp .env.deploy.example .env.deploy
# Set POSTGRES_PASSWORD and PUBLIC_ORIGIN to your Docker server's browser-facing URL.
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d
```

The app pulls `latest`, keeps PostgreSQL private, and persists the world and backups in named volumes. Run the same `up -d` command to pull and apply a later successful build; running containers do not update by themselves. See [the deployment guide](docs/github-deployment.md) for HTTPS, update/rollback, admin access, and transferring your existing world.

## Local development on Windows

Requirements: Node.js 24 LTS and npm. Install dependencies from the repository directory:

```powershell
npm ci
```

Start a persistent native PostgreSQL database in one terminal:

```powershell
npm run db:local
```

This development helper binds only to `127.0.0.1:5432`, uses development credentials, and stores data in `.runtime/postgres`. Closing the game does not stop it. Stop the helper with Ctrl+C. Alternatively, with a working Docker engine:

```powershell
docker compose up -d db
```

Start the server and web client in another terminal:

```powershell
npm run dev
```

Open **http://localhost:5173** and create a corporation. Open a separate browser profile/private window to create a second player. Sign into the first account from another browser to verify the same corporation. The API listens on port 3001. A normal corporation starts with $1,000 and ten land; build a tree farm, watch wood accumulate, then sell from Inventory. More advanced systems explain their prerequisites in each screen.

The default database URL is `postgres://idlecorp:idlecorp@localhost:5432/idlecorp`. For another database, set `DATABASE_URL`. `.env.example` lists configuration; export the environment or use Node's `--env-file` facility. Never use the default credentials on a remotely accessible database.

## Production web build and Windows client

```powershell
npm run build
npm start
```

The server serves the built client at **http://localhost:3001**. Build and launch Electron using:

```powershell
npm run desktop:build
npm run desktop
```

Portable Windows output: `release/IdleCorp-1.1.0-Windows-x64.exe`. The desktop server setting defaults to `http://localhost:3001`. Set the same HTTPS server address on every remote desktop client. Packaging does not bundle a private game server or database.

## New in 1.2

Manage facilities in compact grouped or individual rows with expandable controls, saved filters, and batch actions. The production workspace includes a connected flowgraph, output and stockpile targets, upstream factory requirements, supply choices, and named plans saved to your corporation. Inventory adds resource balances and production observations; a customizable resource bar and notification drawer keep important information available across pages. Browser Back/Forward, refresh, direct links, and per-region view preferences retain your place.

Choose Light, Dark, High Contrast, Ocean, Sunset, or Terminal from the header palette button or Settings → Appearance. Your choice is remembered on this device; the optional device setting follows light, dark, and increased-contrast preferences.

See [the management workspace guide](docs/workspace-1.2.md) for the complete workflow and update instructions. Existing worlds remain compatible; keep your existing database volume and credentials when pulling the updated container.

## New in 1.1

Production planning now includes pinned goals, live dependency graphs and bottlenecks. Facility groups, favorites, batch controls, measured trends, attention notices, return summaries and progressive guidance help manage larger corporations. The exchange adds watchlists, observed price history, fee previews and fill notifications. Settings provides recovery codes and session management; administrators have server health, automatic backups and expansion controls.

The optional original expansion adds escrow-backed supply contracts and pooled regional projects. New worlds keep it disabled until the operator enables it. Existing corporations and sessions migrate automatically on server startup; no world reset is required.

```powershell
npm run admin -- role YOUR_USERNAME admin
npm run admin -- expansion on
```

Backups default to `.runtime/backups`, every 24 hours, retaining seven files. Store a copy outside the server too. See [the enhancement guide](docs/enhancements.md) for gameplay and account controls, and [self-hosting](docs/self-hosting.md) for configuration and recovery.

## Verification

Install the test browser once with `npx playwright install chromium` if it is not already available.

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:ui
npm run test:operations
npm run test:accounts
npm run test:enhancements
npm run test:ui-enhancements
npm run test:production-targets
npm run test:facilities
npm run test:planner-workspace
npm run test:workspace-ux
npm run test:load
npm run test:desktop
npm run test:portable
npm run test:package
npm run test:clean
```

The integration, UI, load and clean-install tests need the local PostgreSQL helper running. Desktop tests also need the main API on port 3001; portable tests require the Windows build. Server integration suites create isolated databases and delete only their own databases afterward. Desktop smoke tests register a verification corporation on the selected server. The optional `npm run test:upgrade` checks a retained local pre-upgrade backup in an isolated database. See `docs/verification.md` for actual results and their limits.

## Updating research

The retained snapshot contains 196 relevant wiki pages. To refresh the source, normalize it, discover artwork and regenerate coverage in order:

```powershell
npm run research
npm run research:content
npm run research:icons
npm run research:ledger
npm test
```

Review source differences and ruleset decisions before adopting a new snapshot. Normal builds and tests use retained data and require no wiki connection. The default ruleset includes 134 assets, 44 facilities, 18 technologies, seven services, nine policies, three persistent regions and 200 original icon mappings.

## Documentation

- `docs/architecture.md`: authority, transaction boundaries, time and desktop isolation.
- `docs/self-hosting.md`: one world for multiple computers, TLS, backup and updates.
- `docs/research/`: content evidence, revisions, interpretations and artwork provenance.
- `docs/verification.md`: measured checks and remaining limitations.
- `docs/workspace-1.2.md`: compact facilities, flowgraph planning, resource balances, navigation and notifications.
- `docs/enhancements.md`: production planning, management tools, account recovery and cooperative expansion.
- `docs/github-deployment.md`: published Docker image, Compose configuration and GitHub Actions.
- `progress.md`: implementation checkpoint.
