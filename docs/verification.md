# Verification record — 2026-10-09

This release implements the selected `2026.10-remake.1` ruleset. The wiki snapshot is evidence, not a recovered private backend. Formula estimates and standalone adaptations are recorded separately in [research/DECISIONS.md](research/DECISIONS.md). The [coverage matrix](research/COVERAGE.md) distinguishes implementation, server verification and GUI verification.

## Version 1.1.0 enhancement verification

All nine approved improvements are implemented. The cooperative economy is an optional original expansion, version `2026.10-expansion.1`; it does not claim original-game parity. TypeScript, ESLint, the production build and **94 unit tests** pass, including 15 planner tests and 18 enhancement regressions in addition to the original 61 cases.

- **40 browser workflow groups** pass: 24 existing workflows and 16 enhancement workflows. Coverage includes partial/completed pinned goals, network links, facility groups/favorites/batch controls, actual trend data, return-report dismissal, progressive navigation, quotes and fills, one-use recovery, current/other session revocation, admin backup/toggles, supply contracts with committed regional origins, project funding/withdrawal/completion/refunds, and mobile controls at 390px. No JavaScript page errors or throttled responses occurred. Screenshots of the overview, facilities, exchange, cooperation, account/admin controls and mobile planner were inspected.
- **14 original API/PostgreSQL acceptance groups** pass on the updated code, including actual production, two players, concurrency, restart catch-up and backup/restore. **Six new gameplay groups** verify ownership, idempotency, competing contract acceptance, delivery/cancellation conservation, deadlines, disabled-expansion settlement, shared project escrow and real fee quotes.
- **Seven account/operations groups** pass: hashed one-use recovery codes, concurrent redemption, password and session revocation, a controlled old-password-login race, admin authorization, automatic scheduling, retention, simultaneous backup processes and version-two restore. The password/session race and cross-process backup race have dedicated regression checks.
- **Five CLI operations groups** still pass for entitlement grants and explicit development fixtures. A fresh dependency install, TypeScript build, production web build, database migration and unboosted registration all pass in a separate directory/database.
- The actual pre-upgrade world was restored into a disposable database and migrated to schema 2. All six corporation states matched exactly before simulation resumed; password hashes and ten existing session hashes were preserved. The live upgrade then preserved all six accounts, six corporations and ten sessions. The cooperative expansion is enabled on the running local world. The first scheduled backup and a subsequent manual version-two backup were verified.
- A read-only planner benchmark with 2,000 mixed facilities returned 117 nodes and 144 edges in approximately 100–111 ms; the complete game state remained unchanged. This measures that fixture, not all possible dependency graphs.

The updated local load run at 16:20:47 UTC completed 120 requests from twelve clients across six corporations with sixty live factories in 8,117 ms: p50 **55 ms**, p95 **128 ms**, maximum **199 ms**, zero errors, and verified production. Requests were intentionally paced; 14.8 requests/second is not saturation capacity.

The official web-game runner was rerun after the live upgrade; its screenshot and text state were inspected. Its signed-out session probe has the expected HTTP 401, with no JavaScript exception. Docker Compose configuration validates with the persistent backup volume; the unavailable daemon still prevents claiming a container launch. Windows signing and public deployment limitations below remain applicable.

The final **1.1.0 Windows build** passed packaged Electron acceptance at 16:24:56 UTC, using an isolated database and a shared account between desktop and HTTP clients. Its overview and production planner rendered; sandboxing, context isolation, disabled renderer Node and encrypted session isolation remain intact. The actual portable wrapper launched at 16:25:09 UTC, rendered its UI and connected to the live shared server. All **207 packaged application/UI files** match the final source/build byte-for-byte. `release/IdleCorp-1.1.0-Windows-x64.exe` is **102,486,358 bytes**, SHA-256 `b9ab29eabb07322e11bba71e7478dcaf89dda635aaf515e67f855d8d51fe4ed5`. It is unsigned.

Reports are retained locally under `artifacts/`: `ui-enhancements/report.json`, `ui-workflows/report.json`, `enhancements-report.json`, `account-operations-report.json`, `upgrade-report.json`, `live-upgrade-report.json`, `planner-performance-report.json`, and the original suite reports refreshed for this release. The user-facing guide is [enhancements.md](enhancements.md).

## Original 1.0.0 baseline evidence

The remaining record preserves the original release measurements and artifact identity; the enhancement results above supersede its test counts and performance measurements.

## Environment and repeatability

Actual host: Windows, Node 24.13.1, npm 11.8, Python 3.13, native PostgreSQL 18.4. Tests use real PostgreSQL; there is no in-memory database substitution. Integration suites create unique temporary databases, start isolated Fastify processes, and remove their own databases afterward. Pure engine fixtures explicitly seed progression to verify mechanics that take hours or days in normal play.

Run `npm ci`, keep `npm run db:local` running, then use the commands in the README. `npm run build` precedes browser workflow tests. Desktop tests need the main API on port 3001. To test the packaged executable rather than development Electron:

```powershell
$env:DESKTOP_EXECUTABLE = (Resolve-Path release/win-unpacked/IdleCorp.exe).Path
npm run test:desktop
Remove-Item Env:DESKTOP_EXECUTABLE
npm run test:portable
```

## Acceptance boundaries

Final source checks passed: TypeScript, ESLint, production Vite build, and **61 Vitest cases** across content (8), chronological engine (14), and independent source parity (39). The PostgreSQL/browser acceptance suite passed **14 groups**, and the detailed GUI suite passed **24 groups**, with zero browser page errors. The final GUI run made 70 API requests and 355 static requests with zero throttled responses; static artwork is excluded from the API limit.

- Content tests check entity identifiers, recipes, references, technology tiers, prerequisites, source records and every local icon mapping. The corpus contains 196 relevant pages, 134 asset records, 44 facilities, 18 technologies, seven services, nine policies, three regions and 200 original icon mappings.
- Engine and independent source tests compare chronological catch-up with reference advancement, including a 72-hour absence, shared scarce inputs, 48-hour modifiers, quality inputs, levels and starvation. They cover regional versus global behavior, retail, funding/policies/elections, research, exports, blueprint ownership, prestige/vault persistence, seasonal rewards and all five expedition difficulties under success and both failure outcomes.
- HTTP/PostgreSQL acceptance verifies two players plus two sessions on one account; fresh unboosted onboarding; real production and sale; concurrent builds; account ownership; integer validation; account/payload-bound idempotency; partial market fills and cancellation races; goods, money and escrow conservation; restart and offline catch-up; logout isolation; persisted audit; and a consistent backup/transactional restore.
- Browser workflows exercise confirmed actions through the UI. Desktop and 390px mobile screenshots are inspected, keyboard focus and dialog Escape behavior are checked, and page errors are captured. Merely mounting a screen is recorded separately from performing its workflow.
- Desktop acceptance launches the packaged application, confirms renderer Node is disabled and sandbox/context isolation are enabled, registers a corporation through its API proxy, and signs into that same corporation over HTTP. A separate test launches the actual portable `.exe`, waits for its packaged UI and checks the shared server connection.
- Clean-install acceptance runs a fresh `npm ci`, TypeScript check, production build, migrations into a new PostgreSQL database, and normal registration with $1,000 and zero factories. Electron's binary download is skipped only in this second dependency tree; Windows packaging and launch are tested separately.
- Five operational acceptance groups exercise all four entitlement grants with audit records, rejection of invalid tiers, each early/mid/late development fixture, region-local blueprint consistency, actual time advancement, and production/opt-in/time-bound protections.

The final portable executable is `release/IdleCorp-1.0.0-Windows-x64.exe` (102,474,889 bytes). At 15:37 UTC the packaged app and the actual portable wrapper both launched successfully against the shared server. All **207 packaged application/UI files** match the source and web build byte-for-byte. SHA-256: `27c06c116a44206140d89773f7ee2477302ee81b47772f197d97d0b042a25d96`. The desktop check also rejects insecure remote origins and confirms the session credential is unavailable to renderer JavaScript.

Machine-readable results and screenshots are generated under `artifacts/`. Test scripts are retained in source; artifacts are ignored by Git because they can contain local account identifiers and backups.

## Measured load

The final run at 15:30:48 UTC used six corporations, two authenticated clients each, and 60 live tree farms. Ten bursts of 12 simultaneous writes/snapshots, paced 700 ms apart, completed 120 requests in 7,737 ms: p50 **30 ms**, p95 **101 ms**, maximum **157 ms**, **zero errors**, and verified production. The observed paced rate was 15.5 requests/second. `artifacts/load-report.json` retains the measurement. This is a local smoke load, not saturation throughput or a claim about large worlds, internet latency or an unlimited number of players.

The official web-game skill runner was also executed against the final UI and its screenshot/state inspected. The signed-out session probe receives the expected HTTP 401; this appears as one console resource message. No JavaScript exception was reported. Authenticated gameplay workflows use the richer form-aware Playwright suite.

## Operational limitations

- Docker Desktop exited without providing a daemon on this host. `docker compose --profile full config --quiet` validates the supplied configuration, but its container launch was not verified. Native PostgreSQL startup, real database migrations, backup/restore and clean installation were verified.
- Remote DNS, public TLS and multiple physical computers were not available to test. Independent browser, HTTP and desktop clients connected to the same local authoritative server. The remote topology and TLS configuration are documented in [self-hosting.md](self-hosting.md).
- Windows builds are unsigned because no signing certificate was supplied. Both the packaged executable and portable wrapper were launched locally.
- A world-wide PostgreSQL advisory transaction lock deliberately favors correctness. Very large worlds and long outages can take time to settle; no arbitrary offline cap or independent factory multiplication hides that work.
- Every original icon was unavailable in the audited snapshot. All replacements are original local SVG artwork with provenance, not representations of downloaded wiki art.
- Production dependency audit had zero findings. The full developer-tool audit reports moderate transitive Electron builder findings; no compatible fixed update was available in the checked toolchain. No forced dependency downgrade was applied.

Source-conflict resolution and uncertain formulas are release decisions, not unresolved runtime placeholders. This verification does not claim undocumented original-algorithm parity, formal security certification or unmeasured deployment capacity.
