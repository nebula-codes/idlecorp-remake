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

## Individual facility cycle backgrounds — 2026-10-09

Expanded group members and individual-layout rows now use their entire row background as a subtle green production-cycle fill, with a visible percentage and accessible progressbar label. It derives from server nextCycle/effective cycleSeconds and the existing server-adjusted UI clock, clamps to 0–100%, and starts a new visual cycle only when a new server deadline arrives. Paused rows are gray, starved/capacity rows amber, and infrastructure has no production fill. Reduced-motion preferences disable the fill transition. Action controls and their inline confirmation messages remain above the fill.

TypeScript, ESLint and the production build pass. Existing compact Facilities browser checks pass. Isolated staggered Coal mine screenshots verify visible independent fills and readable controls; the native user's world is untouched. The standard web-game client also ran, with the expected signed-out session probe. No new committed tests were added for this visual change; the existing container publication workflow remains the deployment gate.

## Page themes — 2026-10-09

Added Light, Dark, High Contrast, Ocean, Sunset, and Terminal palettes throughout the interface, including facility cycle fills, graph nodes and edges, notifications, dialogs, and authentication. A palette button opens the appearance drawer, and Settings has an Appearance tab. Native radio controls support keyboard selection. The optional device setting follows light/dark and increased-contrast preferences; explicit choices persist locally, synchronize across tabs, and apply before the page paints. Light remains the default. This changes presentation only and requires no database migration.

TypeScript, ESLint, and the production build pass. All 24 existing UI and nine focused Facilities regression groups pass. Isolated browser verification covers all six themes, authentication, running/paused/blocked facilities, flowgraphs, dialogs, Settings, mobile layouts, keyboard focus, reload persistence, cross-tab updates, and device preference changes. Measured text and High Contrast boundary samples pass the selected contrast thresholds, including the full facility-fill gradient; this is a focused check rather than a formal accessibility certification. Screenshots were opened and reviewed. The standard web-game client ran against the final build; its signed-out session probe returns the expected 401. Reports and captures are under artifacts/themes. Temporary databases are separate from the user's live world.

The existing GitHub workflow remains the gate for publishing the updated latest container. Portainer operators need to pull/recreate the app container and refresh the browser to receive these themes; retain the existing database volume and credentials.

The first release run and retry were blocked before checkout by Docker Hub's unauthenticated PostgreSQL pull limit. CI now obtains the same official PostgreSQL image from the public ECR mirror and tags that already-pulled image for the existing container acceptance script. Both registries resolved to the identical image index during verification. Deployment Compose files are unchanged.

The subsequent run passed all source and browser checks but encountered Docker Hub token timeouts when installing BuildKit. CI now loads BuildKit and QEMU from Google's Docker Hub cache and configures BuildKit registry mirrors for the Node base image, Dockerfile frontend, and SBOM scanner. All five mirrored indexes were verified to match their upstream digests, including AMD64 and ARM64 variants. The Dockerfile and deployed runtime remain unchanged; the container acceptance test now explicitly selects the application module instead of the earlier theme bootstrap script. Mirror configuration follows https://docs.docker.com/build/ci/github-actions/configure-builder/.

## Facility bonuses and penalties — 2026-10-10

Added compact bonus and penalty indicators to grouped and individual facilities. Group indicators count affected facilities; individual indicators count effects. Activating an indicator opens and focuses its Active effects section, showing source, scope, value, relevant expiry, and separate cycle, speed, output, quality, input, and operating effects. The cycle explanation uses the simulation's own calculation, including additive technology stacking, regional factors, happiness, timed bonuses and minimum durations. Existing production rules and scheduled deadlines are unchanged.

Reports include technologies installed on other regional facilities, quality and efficiency effects, simultaneous blockers, and relevant infrastructure benefits without claiming production-speed benefits for infrastructure. Neutral baselines are omitted from the indicators; meaningful conditions and recipe replacements remain inspectable. Expiry reports respect capped combined project benefits. Catalogue cycle labels explicitly identify base times.

TypeScript, ESLint, production build and all 125 unit tests pass, including 14 new calculation, scope, cap, expiry and simulation-preservation cases. Nine focused effects checks and nine existing compact Facilities checks pass. Browser verification covers real pause/resume updates, grouped and individual keyboard inspection, neutral states, and Light, Dark and High Contrast at desktop, 390px and 320px widths, with no overflow, browser exceptions or throttling. Screenshots were opened and reviewed. The standard web-game client also ran; its signed-out session probe returns the expected 401. Reports are under artifacts/facility-effects and artifacts/compact-facilities. Temporary test databases were removed.

A consistent backup preceded the local server restart. Verification confirms all six original accounts, six corporations and sixteen facilities remain, with unchanged password hashes; the app is healthy at http://localhost:3001. No database migration is needed. The focused effects suite is now part of the GitHub Actions publication gate. Portainer operators must pull/recreate the app container and refresh the browser to receive this update while keeping the database volume and credentials.

## Regional exchange and quick sales — 2026-10-10

Replaced the regional NPC resource dropdown with searchable inventory-first rows, stock/all filters, name/quantity/sale-value sorting, resource icons, live unit quotes, stock value, and per-resource Sell 100, Sell 1,000, Sell 10,000 and Sell all buttons. Expand Custom trade for purchases or exact quantities. Inventory and planner resource intents reveal and focus the requested row. Normal/plus assets remain separate; locks, NPC restrictions, stock, cash capacity, purchase allowances and storage limits disable invalid controls with relevant explanations. Sold-out rows remain visible with confirmation for the current visit.

Quick sales retain an exact resource, region and quantity while awaiting confirmation. Uncertain results offer Retry using the original payload, including after polling changes stock. The client now preserves an existing uncertain request key through pre-handler rejection such as a rate-limited retry. Only a definite failure can be cleared to start a different attempt. This prevents a lost completed sale from either double-executing or masquerading as a new sale. Existing transaction and pricing rules are unchanged; no server or database migration is required.

TypeScript, ESLint and the production build pass. Twelve focused exchange browser checks pass, including exact cash/stock changes for all presets, sales above one million units, NPC-sellable blueprints, separate plus stock, locked/restricted resources, cash capacity, current region, rapid clicks, stale-stock rejection, and a committed response lost as 503 followed by a 429 retry and successful recovery with the original quantity/key. Twenty-four existing gameplay UI groups, twelve workspace navigation/feedback groups, and seven LAN HTTP regression groups pass. Desktop and 390px/320px screenshots across Light, Dark and High Contrast were inspected; no horizontal overflow, unhandled exceptions or unexpected throttling occurred. The standard web-game client ran against the final build; its unauthenticated session probe returns the expected 401.

Reports and captures are under artifacts/exchange. Tests used disposable databases which were removed; the live world was not modified. The native server is healthy and serves the new build at http://localhost:3001. GitHub Actions now runs the exchange suite before image publication; Portainer updates require re-pulling the app image and refreshing the browser.

The first publication run passed source checks, all 125 unit tests, and API/browser integration, then exposed a timing race in the existing Facilities focus assertions. The focused test now waits for the scheduled focus update before asserting it, retaining the same keyboard behavior requirement. All eight focused checks pass locally after this test-only correction.
