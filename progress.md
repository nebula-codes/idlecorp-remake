Original prompt: build and verify a complete playable IdleCorp remake with a shared PostgreSQL server, responsive web UI and Windows Electron client. The verbatim request remains in CODEX_HANDOFF_PROMPT.txt.

## Delivered

- Ruleset 2026.10-remake.1 and API protocol 1. Retained evidence covers 196 wiki pages, 134 assets, 44 facilities, 18 technologies, seven services, nine policies and three persistent regions. All 200 icon mappings have original local replacements and provenance.
- The authoritative server implements chronological production, global player orders, regional inventories and exports, research and technology, retail, government, services, resets, seasons, rewards, space and quantum vaults. Transactions and account/payload-bound idempotency protect economic mutations.
- Fourteen responsive management screens render confirmed state, requirements, rates and timers. Keyboard dialogs, mobile navigation, connection recovery and accessible labels are implemented.
- The Windows app packages the same frontend and connects to the shared server. It uses sandboxing, context isolation, no renderer Node, validated server origins and platform-encrypted session persistence.
- Operational tools cover PostgreSQL setup, migrations, backups and restore, administrative entitlements, explicit development fixtures and time advancement. Remote self-hosting and TLS instructions are supplied.

## Verified final state

TypeScript, ESLint and the production build pass. All 61 Vitest cases pass: eight content, fourteen engine and thirty-nine independent source-parity tests. Coverage includes 72-hour catch-up, scarce inputs, modifier boundaries, all expedition difficulties and failure paths, relic effects, capacity saturation and resets with pending orders, shipments and research.

Fourteen PostgreSQL/API acceptance groups pass, including two accounts plus two sessions on one account, concurrent builds, cancellation/fill conservation, restart recovery, economic audits and backup/restore. Twenty-four GUI groups pass through early, middle and late progression. The final GUI run made 425 requests with no throttling or browser page errors.

Five operational groups verify every entitlement tier and its audit, invalid-tier rejection, early/mid/late fixtures, regional blueprint consistency, real time advancement and production/opt-in protections. Clean installation into a fresh dependency tree and a fresh real database passes unboosted onboarding and built-web startup.

The bounded load test used six corporations, twelve clients, sixty active factories and 120 requests: zero errors, p50 30 ms, p95 101 ms, maximum 157 ms. This is not a saturation-capacity claim.

Both the packaged Windows application and the actual portable wrapper launched against the shared server at 15:37 UTC on 2026-10-09. All 207 packaged application files match the final source build. The portable executable is 102,474,889 bytes. Desktop, mobile, authentication and icon screenshots were opened and inspected.

## Running application

Native PostgreSQL listens on 127.0.0.1:5432 and stores durable data in .runtime/postgres. The built application runs through npm start at http://localhost:3001. The Vite development preview has stopped. New accounts receive normal unboosted onboarding.

## Completion and limits

All requested implementation milestones are delivered. The database and built app remain running for local play. No external deployment or purchase was made. Docker configuration validates, but the host's unavailable Docker daemon prevented container launch verification. Native PostgreSQL was verified instead. Remote DNS/TLS and multiple physical computers were not tested; Windows builds are unsigned. Uncertain original formulas remain explicit ruleset decisions. See docs/verification.md and docs/research/COVERAGE.md for evidence and exact verification boundaries.

## Enhancement release 1.1.0 — completed

The user approved implementing all nine proposed improvements: goal planning; interactive bottlenecks; facility groups/favorites/batch controls; real trends/attention/return summaries; progressive onboarding; price history/watchlists/fee previews/fill alerts; recovery/session/admin/scheduled backups; optional supply contracts; optional cooperative regional projects.

All nine are delivered, with the shared server remaining authoritative. Pinned goals track partial builds and completion; dependency networks expose live input shortages and navigation; facility groups, favorites and atomic batch controls persist. Trends use actual observations, onboarding adapts to progression, exchange previews show fees, and fill notices persist. Recovery codes are one-use hashes; account sessions can be reviewed/revoked. Automatic consistent backups, retention and an administrator dashboard are implemented. Supply contracts escrow cash and settle deliveries/refunds; regional projects pool real resources and provide bounded timed benefits.

Final checks: TypeScript, ESLint, production build and 94 unit tests pass. The 24 existing plus 16 new GUI groups pass, with no browser exceptions or throttled responses. Fourteen original HTTP acceptance groups, six enhancement/conservation groups, seven account/backup groups and five CLI operation groups pass. The account suite includes controlled login/password-change concurrency and cross-process backup races. Fresh installation/migrations pass; the preserved legacy world migrates without changing saved corporation state before simulation resumes. The measured twelve-client/sixty-factory smoke load completed 120 requests with zero errors, p50 55 ms and p95 128 ms; this is not saturation capacity.

The live schema-2 upgrade preserved six accounts, six corporations and ten sessions; passwords are unchanged. Backups were taken before implementation and immediately before restart. Expansion is enabled on this local world. The first scheduled backup and a subsequent version-two backup are verified in .runtime/backups; backups run every 24 hours and retain seven files by default. No administrator account was guessed or auto-granted; the operator role command is documented in README.md and docs/enhancements.md.

At 16:25 UTC the final unsigned Windows portable executable and packaged app both passed launch verification. All 207 packaged application/UI files match the final build. The 1.1.0 executable is 102,486,358 bytes, SHA-256 b9ab29eabb07322e11bba71e7478dcaf89dda635aaf515e67f855d8d51fe4ed5. Authenticated desktop/planner and mobile screenshots were inspected. The official web-game script ran after the live upgrade; its sole signed-out 401 is expected.

The database and updated application remain running at http://localhost:3001. Existing progress is preserved. New history begins with actual observations after this upgrade; no prior history is invented. Docker Compose validates with a persistent backup volume, but container launch and public deployment remain unverified. The expansion is explicitly an original remake addition. See docs/enhancements.md, docs/self-hosting.md and the new 1.1.0 section in docs/verification.md.

## GitHub and container deployment

The user authorized a new public repository, nebula-codes/idlecorp-remake. The pre-existing private idlecorp repository is a different implementation and remains untouched. Publication includes the app and research evidence; runtime saves, backups, environment credentials and the original private task attachment are excluded.

The container now uses a multi-stage build, compiled server JavaScript and production dependencies only. The image runs as node, includes migration/admin/backup/restore commands, and accepts separate PostgreSQL environment fields. compose.deploy.yaml pulls the GHCR image, keeps PostgreSQL private, and preserves database/backups in named volumes. The original compose.yaml remains available for source builds.

Docker is now available on this host. An actual image build and ten deployment checks passed, including reserved-character credentials, compiled operator commands, backup/restore and recreation persistence. Six reusable container acceptance groups also pass; all temporary Docker resources were cleaned up. TypeScript, lint and 94 unit tests pass with the database environment fallback. GitHub Actions gates multi-platform GHCR publication on those source/API/container checks. See docs/github-deployment.md for first start, updates, account administration and migrating saved progress.

## LAN HTTP purchase fix — 2026-10-09

Reproduced the deployed purchase hang in a real insecure browser origin: HTTP idlecorp.test mapped to a disposable loopback test server. The previous client called secure-context-only crypto.randomUUID outside its action try/finally, causing an exception before any purchase request and leaving busy true. The client now generates 128-bit request keys with crypto.getRandomValues and protects request preparation with the same finally that releases the UI. Unreadable successful HTTP responses now preserve the original key for safe retries.

TypeScript, ESLint, production build and all 94 unit tests pass. Seven LAN HTTP browser regression groups pass, including real construction, preparation failure recovery, committed-response 503 and malformed-200 retries with no duplicate charge, a subsequent new purchase, and reload persistence. No unhandled browser exceptions occurred. Baseline/fixed screenshots and JSON reports are under artifacts/lan-http; the final screenshot shows five confirmed facilities and no waiting indicator. The official web-game client also ran; its signed-out 401 is expected. Test databases were isolated and removed; the user's world was not changed. GitHub Actions now runs the LAN browser suite before image publication. Portainer operators must pull/recreate the existing server with the updated image and refresh the browser; no database migration is required for this fix.

## Management workspace 1.2.0 — 2026-10-09

Implemented the six approved upgrades: compact expandable facility groups and individual rows; an automatically laid out production flowgraph with layers, focus/collapse, keyboard controls and a mobile list; server-calculated rate/stockpile targets with upstream factory requirements, supply choices and persistent named plans; resource balances with measured production and a customizable watchbar; persistent regional navigation/view preferences and browser history; and global notifications with contextual action confirmations.

The planner remains an explicit read-only scenario until the player performs its construction or purchase actions. Shared consumers, quality expectations, cash/land/material requirements, purchase allowances, whole-factory rounding and bounded expansion are accounted for. Actual production observations begin from real elapsed processing intervals and persist in existing corporation state. Existing saves need no destructive migration.

TypeScript, ESLint, production build and 111 unit tests pass. Focused suites cover seven PostgreSQL target-planner groups, ten compact-facility groups, thirteen graph/planner groups, workspace navigation/feedback/session safety and seven LAN HTTP retry groups. All 24 original GUI and 16 enhancement GUI groups pass. Desktop/mobile screenshots were opened and reviewed. The graph and layout engine load only when needed. The largest tested 2,000-facility target scenario completed in 1.15 seconds; this is a bounded local measurement, not a concurrency guarantee.

A consistent backup preceded the native server restart. The new server is running at http://localhost:3001; verification confirms six existing accounts, six corporations and sixteen facilities remain, with unchanged password hashes. Production time continues normally. Final browser history checks additionally cover region-bound trade/reset confirmations and late session responses. GitHub Actions now includes all focused and existing GUI suites before container smoke testing and publication. See docs/workspace-1.2.md, docs/planner-targets.md and docs/planner-workspace.md.
