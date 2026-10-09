# Shared implementation contract

Ruleset `2026.10-remake.1`, API protocol `1`. Node 24, TypeScript ESM, React/Vite, Fastify and PostgreSQL. Runtime contracts live in `packages/rules/src/index.ts`, `apps/server/src/types.ts`, `apps/server/src/actions.ts`, and the snapshot builder in `apps/server/src/engine.ts`. Consult those definitions when extending this release rather than maintaining a second handwritten action schema.

All currency is integer cents. Asset quantities are whole units. Entity identifiers use lowercase underscores. Content is retained locally in the rules package, with source URLs and revisions. Balance belongs in that package; UI rates, requirements, quotes and timers come from the server snapshot.

Corporation cash, score, tokens, entitlement, gratitude, upgrades and season progress are global. Land, inventories, facilities, research, retail, blueprint holdings and installed technology effects are regional. Shared services, elections, policies, population and modifiers belong to server-managed regions. Orders use a shared global price/time-priority book, with regional escrow and delivery origins.

## HTTP interface

- `GET /api/health`: readiness, protocol and ruleset.
- `GET /api/content`: retained rules and content.
- `POST /api/auth/register`: `{username,password,name}`, followed by an HttpOnly session cookie.
- `POST /api/auth/login`: `{username,password}`, followed by an HttpOnly session cookie.
- `POST /api/auth/logout`: revoke this session.
- `GET /api/state`: authenticated authoritative snapshot.
- `POST /api/action`: `{type,regionId,...}` plus an `Idempotency-Key` of 8–128 characters. Returns the resulting full snapshot and action-specific results.
- `GET /api/events`: optional server-sent revision hints; full snapshots recover missed updates.

Errors use `{error:string}`. Acting account IDs are resolved from server sessions. A client cannot select another acting account, submit authoritative time or set balances. Each successful economic action is transactional; replaying its account-scoped idempotency key returns its original response, and a changed payload with the same key is rejected.

## Clients and operations

Development uses Vite on 5173, proxying `/api` to Fastify on 3001. The built frontend is served by Fastify on 3001. The packaged desktop contains the same frontend, with a restricted main-process API proxy and encrypted session persistence. It connects to the configured shared server and never starts another game server.

The default development database is `postgres://idlecorp:idlecorp@localhost:5432/idlecorp`; operators override `DATABASE_URL`. Production requires private PostgreSQL and HTTPS. No production development endpoint or seeded credential exists. Explicit test fixtures operate in isolated databases or an operator-selected disposable development world.

See `docs/architecture.md`, `apps/server/README.md`, and `docs/self-hosting.md` for transaction, catch-up, deployment and numeric-bound semantics. Source uncertainty and adaptations remain in `docs/research/DECISIONS.md`; verification is separate from evidence status.
