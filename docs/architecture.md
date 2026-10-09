# Architecture and operating contracts

The web and Windows clients are views of the same server. All economic actions, clocks, random outcomes and balances are server owned. The React interface renders acknowledged snapshots; a browser does not run production. The Electron application contains the web build and connects to a configured server. It never starts a private economy.

## Components

- `packages/rules`: versioned extracted wiki data, references and explicit remake rules. Currency is integer cents; asset quantities are integers. Accepted values stay inside the exact integer range and explicit gameplay bounds.
- `apps/server`: Fastify API, PostgreSQL persistence, authentication and economic simulation.
- `apps/web`: React UI shared by browser and desktop, accessible form operations, confirmed snapshots and reconnect handling.
- `apps/desktop`: sandboxed Electron window, packaged frontend, validated server setting and API proxy. Session cookies are withheld from renderer JavaScript and persisted using Electron safeStorage when platform encryption is available; otherwise they remain memory only.
- `scripts`: repeatable content collection, tests, local database and operational helpers.

## Multiplayer transaction boundary

PostgreSQL is the sole persistent authority. Economic requests acquire database transaction locks before reading or advancing world state. Idempotency keys are scoped to the account and bound to a canonical action payload. A repeated identical action returns its prior outcome; mismatched reuse fails. Public updates follow a committed transaction. Clients can always recover through a new full snapshot.

The initial deployment is intentionally one simulation process with database coordination. It favors auditability and exact chronological resolution over speculative throughput. Capacity claims must be tied to the measured load report. Do not deploy multiple scheduler workers without reviewing event ownership and locking.

## Time

Only server timestamps enter economic actions. Before applying an action, affected production and events settle to its timestamp. Catch-up uses the same chronological event semantics as active play. Dependent factories cannot spend output before its producing event; ties have deterministic order. Downtime follows the versioned simulation rules and does not use a client-supplied clock. Pure test fixtures may advance time without creating a production endpoint.

## Deployment boundary

Use one API server for all clients. PostgreSQL stays on a private interface/network. Remote clients use HTTPS; the reverse proxy terminates TLS. Browser sessions use server-side session records and HttpOnly cookies. A desktop protocol handler proxies only `/api/` to the configured validated origin; it forwards neither arbitrary renderer headers nor redirects. Remote addresses require HTTPS. The app denies new windows, navigation to other origins and permission requests.

## Research uncertainty

The wiki is evidence rather than access to the original private backend. Cached source revisions, data inventory and conflict/adaptation ledgers live under `docs/research` and the rules package. Approximate formulas and standalone replacements are explicit. Historical season dates are not imported as live dates. No claim of undocumented algorithm parity is made.

## Primary implementation references

Verified during implementation: [Fastify documentation](https://fastify.dev/docs/latest/), [React](https://react.dev/learn), [Vite](https://vite.dev/guide/), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [MediaWiki allimages](https://www.mediawiki.org/wiki/API:Allimages), and [MediaWiki imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo).
