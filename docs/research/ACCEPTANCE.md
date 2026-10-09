# Independent source-parity acceptance

Checked 2026-10-09 against the pinned 196-page corpus and ruleset `2026.10-remake.1`.

Commands actually run:

```powershell
npx vitest run packages/rules/src/content.test.ts
npx vitest run tests/source-parity.test.ts
npx vitest run --reporter=json --outputFile=artifacts/unit-test-report.json
```

Results: **8 content tests passed**, **39 independent server source-parity tests passed**, and **14 server regression tests passed**: **61 total**, recorded in `artifacts/unit-test-report.json`. The separate source-parity run completed in 513 ms. This is not a server load/capacity measurement.

The source-parity fixtures seed explicit progression state directly in the test process. They do not expose production cheats or bypass normal onboarding acceptance. They exercise real action handlers and the chronological engine for:

- Nine base technologies becoming one UU technology, correct installation fee, regional effects, uninstall, and retained installed-technology valuation.
- Oil-mapping recipe changes confined to the installation region, with matching authoritative displayed rates.
- A funded regional service benefiting two corporations, documented policy funding costs, a 24-hour toggle cooldown, and election ties electing nobody.
- Forty-percent historical property/material valuation, free-token land not increasing paid-land exponent, stacked seasonal prestige bonuses, and persistent account-global progression.
- Deterministic vault retention after replay, with quantum stabilization restricted to the reset region.
- Launch, station construction, coordinate/rocket/fuel costs, persisted expedition outcome after simulated restart, claim-once protection, station upgrading, and conserved vault deposit/withdrawal.
- Knowledge relic consumption finishing an existing research outcome without rerolling it.
- Five vaulted haste relics shortening research by exactly 150 seconds in both regions without changing rewards; one vaulted efficiency relic converting actual plus batches into twice the normal output in both regions; prestige relics lowering the token divisor up to the configured cap while preserving score and worth. Withdrawing each passive relic restores the baseline behavior.
- Eight-center research discounts applying to cash, ordinary energy, and plus energy.
- Three free versus six platinum daily challenges, corresponding XP, and duplicate-claim rejection.
- Regional blueprint research awards, player-market prohibition, export/arrival, inventory/research-view synchronization, and source-backed identity-change gratitude costs.
- A 72-hour absence producing the same corporation state as minute checkpoints, including chained facilities, shared scarce inputs, and two-day regional modifier boundaries.
- Each of the five expedition difficulties under seeded success, failure with rocket return, and failure with rocket destruction; exact coordinate/fuel costs, damage, repair materials, and duplicate-claim rejection.
- Concurrent research in two regions, with two and one original rewards claimed into their respective regional inventories.
- Retail headquarters access across regions, customer-support demand, ordinary and plus-goods consumption, revenue, and locked inventory preservation.
- All four entitlement tiers' vote, weekly and daily rewards, season-level unlock, and repeat-claim rejection.

During review, discrepancies were reported to the server/UI owners and corrected: stale research rarities/duration, logistics budget, region-wide technology effects, duplicated blueprint state, installed tech net worth, historical material refunds, free-land pricing, plus retail pricing, global order books/inbox claims, recipient logistics requirements, regional airport count, tied elections, prestige bonus stacking and local vault stabilization. The extra standalone convenience rewards remain explicit adaptations in `DECISIONS.md`.

All 200 original icons have local mapping/provenance checks. The generated contact sheet `icon-preview.png` was opened and visually inspected after adding the 18 regional-blueprint pictograms. No remote game artwork was discovered in this snapshot.

The repository integration reports were independently read alongside their executable scripts. `acceptance-evidence.json` stores their exact report bodies and hashes, plus hashes of inspected test files. Run `python scripts/collect-verification.py` to refresh this record after new integration runs. `verification-state.json` promotes only the mechanic and command scopes established by report assertions.

The final `artifacts/ui-workflows/report.json` (15:37 UTC) records **24 passing workflow groups**, **425 browser requests** (70 API, 355 static), **zero throttled requests** and **zero browser errors**. `apps/web/verify-ui.mjs` runs normal registration, construction, production and sale before using isolated, explicitly seeded progression fixtures. Through visible GUI controls it exercises inventory locks; NPC selling/buying; scrap conversion/manual XP/plus-input preference/demolition refund; a player sell order and cash-inbox claim after a second-account fill; buy-order escrow/cancellation; research start/finish/claim; technology development/install/uninstall/combination; retail pricing/naming/sales/removal; office funding/candidacy/voting/policy activation; daily/weekly/season/challenge claims; exports and private-recipient gifts; space launch/construction/dispatch/result/repair/upgrade; knowledge-relic research completion; vault deposit/withdrawal; a permanent token upgrade; previewed liquidation/reincorporation; and identity, privacy and notification preferences. Deadline changes occur only inside that isolated test database; actual committed outcomes survive the restart. Keyboard modal containment, Escape, 390-pixel navigation, and overflow are also asserted. This is evidence for those workflows, not a claim that all 77 original command equivalents or every variant received a browser test.

`artifacts/e2e-report.json` separately records HTTP authentication, two sessions on one corporation, exactly-once/mismatched idempotency keys, ownership/range rejection, concurrent build affordability, actual server restart and offline production, player partial fills and cancellation races with escrow/fee conservation, logout isolation, audit evidence, and database backup/restore. Desktop and portable reports record real Windows executable launches with isolated renderer settings; the desktop and browser successfully share an account on the same server. The clean-install report records `npm ci`, typecheck, build, fresh migration, unboosted registration and built-web delivery. Docker execution was unavailable on the test host, so native PostgreSQL was used for that clean deployment check.

The final desktop report (15:37:34 UTC) records the packaged Windows application using the shared server with node integration disabled, context isolation, sandboxing and web security enabled. The portable report (15:37:51 UTC) records the actual portable executable launching its packaged UI and reaching the PostgreSQL server. `package-report.json` verifies all **207 packaged files** against final source/build hashes. The portable executable is **102,474,889 bytes**, SHA-256 `27c06c116a44206140d89773f7ee2477302ee81b47772f197d97d0b042a25d96`.

`operations-report.json` records five passing groups: real CLI grants for all four entitlement tiers with persistent audit rows; invalid tier rejection; usable early/mid/late fixtures with region-local blueprints; chronological production during a bounded development time advance; and fixture opt-in/production/invalid-time guards. These checks used an isolated temporary database, without a production fixture endpoint.

The measured load report (2026-10-09 15:30 UTC) uses six accounts, twelve concurrent clients, sixty facilities and 120 local requests: roughly 15.5 requests/second, 30 ms median and 101 ms p95, with no errors and production verified. These figures describe that bounded loopback workload, not internet latency or maximum capacity. Later reports supersede these values when regenerated.

Unexercised browser variants remain explicitly pending in the ledger, including policy disabling, cash gifting, turning plus inputs back off, supporter-vote claiming, inverse privacy/notification preferences, and leaderboard sorting/reference-search interactions. Their controls are present; corresponding server behavior has separate evidence where listed. The four-tier administrative workflow is now verified through the real CLI. No browser result is inferred solely from a visible button.

The final read-only source audit is `ui-control-audit.json`, with one entry per original command and a hash of the inspected `App.tsx`. It distinguishes a present control or view from runtime evidence. Bulk/all aliases use explicit entity/quantity controls, mentions become corporation selections/IDs, notification types become one completion preference, external MarketView becomes the player-exchange screen, and invites become shared-server URLs. Discord prefix configuration is intentionally omitted. All four relic types have dedicated runtime evidence, and knowledge-relic use is also exercised through the browser.
