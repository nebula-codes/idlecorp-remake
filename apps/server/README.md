# Authoritative server implementation

The runtime entry is `src/index.ts`; `src/migrate.ts` applies the idempotent PostgreSQL schema. Root `npm run dev:server`, `npm start`, and `npm run db:migrate` invoke these entries. Default database: `postgres://idlecorp:idlecorp@localhost:5432/idlecorp`. Default HTTP port: 3001. Production serves the built shared web client when `apps/web/dist` exists.

`DATABASE_URL`, `PORT`, `HOST`, `PUBLIC_ORIGIN` (comma-separated browser origins), `COOKIE_SECURE`, `TRUST_PROXY`, `SEASON_START`, and `SEASON_END` are operator settings. HTTPS origins and production mode default to secure cookies. Set `COOKIE_SECURE=false` only for an intentional HTTP loopback deployment. Configure an explicit HTTPS origin and TLS proxy for remote clients. Trust forwarded addresses only behind a configured trusted proxy.

## Persistence and concurrency

PostgreSQL stores accounts, scrypt password hashes, hashed opaque sessions, corporation JSON documents, shared world JSON, request receipts, and economic audits. The JSON representation does not imply client authority: all writes occur inside PostgreSQL transactions. One transaction-scoped advisory lock serializes the world. Registration, worker advancement, snapshots, multiplayer matching, idempotency checks, and resets share that lock. Multiple API processes can safely advance the same world, although their throughput remains limited by this deliberately simple global lock. This implementation is intended for a small self-hosted community; no unmeasured large-scale capacity is claimed.

The key `(account_id, Idempotency-Key)` is unique. Each successful mutation stores the recursively canonical payload hash and committed response. Replays return that same response; changing the payload for the same key returns HTTP 409. A rejected mutation rolls back all intermediate changes. Account IDs are derived only from an unexpired server session. Request bodies never select the acting account. Fastify applies bounded bodies, request limits, explicit Origin checks, and HttpOnly/SameSite cookies.

Read snapshots settle the world to server time and persist it before returning. A two-second worker advances disconnected corporations and publishes revision hints only after its transaction commits. SSE hints are optional: snapshot polling recovers from dropped events and from other workers. Credentials, random state, timers, escrow, outcomes, and inventories survive restarts. There is no browser-authoritative or memory-only fallback.

## Deterministic time

`engine.advance` processes one chronological stream. Regional hourly boundaries run before same-timestamp facilities; corporations and facilities use stable identifier ordering to resolve simultaneous input contention. A completed facility cycle consumes available inputs once, produces once, advances XP, and schedules its next cycle using the current modifiers. A starved facility consumes nothing and schedules another cycle. Work in progress retains the duration chosen when its cycle began; changed modifiers affect its next cycle. This is the explicit modifier-boundary interpretation.

No offline duration cap or independent per-factory multiplication is used. Catch-up uses the same events as short reference advancement. This favors correctness over extreme offline throughput; a large world with a very long outage can take time to settle. Research duration/rewards and expedition success/rewards are rolled at dispatch from the persisted corporation PRNG and stored before the request commits. Claiming cannot reroll them. Research and shipment deadlines are absolute server timestamps.

Production/sale totals have a periodic aggregate audit; every submitted economic action additionally records its payload, revision, cash/tokens/score and regional inventory before/after. Histories are bounded for in-game rendering, while audit rows and idempotency receipts remain durable. Operators should establish database retention and backups based on their workload.

## Selected rule interpretations

The content package owns source values and configurable remake rules. All money is integer US cents. Individual economic ledgers support up to 9 trillion units; non-integral, negative, and overflowing intentions are rejected. A producer that would exceed an inventory or cash limit stalls before consuming inputs, with an explicit capacity reason; retail sales also respect cash headroom. Other facilities and corporations continue, and spending or disposing of stock resumes the producer. Aggregate net-worth valuation uses the wider JavaScript safe-integer range and saturates at 9,007,199,254,740,991 cents; this is the explicit extreme-valuation ceiling rather than an offline-time limit. The frontend receives derived rates and NPC quotes from the same rules used by simulation.

Technology instances occupy regional slots, with an existing facility used as the UI location for each slot. Its effects apply to **all applicable facilities in that region**. Installed technology retains net worth. Uninstalling returns its inventory item. Development consumes a regional blueprint and creates a regional tradeable technology item; three equal-tier uninstalled technologies produce one supported higher tier. Blueprint assets mirror the regional blueprint index and can be exported, gifted, or sold to NPCs, but cannot enter player order books.

Player orders form one global price/time-priority book. Funds or goods are escrowed at creation. Matches use the older order's price, refund buy-price improvements, and deduct the source-backed 1.5% fee. Purchased goods and seller capital enter logistics inboxes and require claiming. Cancellation returns only unfilled escrow. NPC trades remain separate, have regional prices, source restrictions, and monetary hourly purchase limits.

Exports require regional logistics access on both ends, have three outstanding dispatch slots per origin, use a truck and gasoline of matching quality, and consume approximately 20% of cargo value in fuel. Their documented travel times are 30/15 minutes. Trucks return when the shipment is claimed. This reusable-truck interpretation is explicit because the wiki does not specify their final disposition.

Shared services remain funded once their threshold is reached; partial contributions have no completed-service effect. Regional policies require the elected legislator, a completed region office, available funding points, and a change cooldown. Tied elections elect nobody. The standalone supporter reward supplies the original voting boon without contacting Discord; operator-granted entitlements retain their source gameplay benefits without payment.

Regional population uses the selected approximation of 25,000 people per shared owned land unit, adjusted by happiness and refreshed hourly. Initial region values allow a readable newly created world; the first hourly update reconciles actual corporations. Commodity prices refresh hourly, and production modifiers change every 48 hours. Retail uses the package's explicitly approximate demand curve, real inventories, customer-support ratio, and shared population. There is no adjacency or invented transport penalty.

Reincorporation previews include open escrow and pending deliveries in net worth. Tokens have entitlement caps; score does not. All regions reset, and starting land is granted in the selected region. Permanent land discounts/slots, score/tokens, gratitude, settings, and season progress persist. Ordinary inventories, blueprints, installed technologies and orbital infrastructure reset. Vault units independently survive at 50%, or 75% with stabilization installed in the reset region; outcomes commit in the same transaction. Regional liquidation sells local inventory/escrow/inbox/outbound cargo and refunds 40% of historical construction value. Inbound cargo from other regions returns to its origin. Global cash inbox items survive regional liquidation.

Space station construction amounts, station hull/capacity, expedition duration/relic quantities, upgrade-point costs, and the prestige relic's discount amount are documented configurable adaptations where original formulas are unavailable. Research gives real coordinates and rockets; expeditions consume the matching coordinate, rocket, and rocket fuel, apply source success/failure values plus station level, award actual relic assets, and damage station hull. Vault relics affect research speed, prestige threshold, or plus-output conversion; consuming knowledge finishes research. These are working inventory systems rather than display-only unlocks.

Additional daily cash, weekly cash, challenge cash, and cash on season claims are standalone remake convenience rewards in `rules.remake`, distinct from the source season progression bonuses. Names/mottos consume 2/1 gratitude on actual changes. Asset locks deliberately protect explicit disposal, transfer and construction consumption as well as bulk sale; automatic production can consume locked inputs.

## Administration and tests

Grant an entitlement from the trusted server shell:

```powershell
npx tsx apps/server/src/admin.ts entitlement USERNAME free
npx tsx apps/server/src/admin.ts entitlement USERNAME plus
npx tsx apps/server/src/admin.ts entitlement USERNAME gold
npx tsx apps/server/src/admin.ts entitlement USERNAME platinum
```

There is no production fixture, clock-advance, seed-credential, or administrator HTTP endpoint. Root development fixture tools operate only against the explicitly selected development database. `apps/server/test/engine.test.ts` checks chronological catch-up, starvation, input preference, XP/scrap, deterministic outcomes, escrow conservation, exports, cooldowns and ownership. Additional root tests cover source parity and real PostgreSQL/API/browser boundaries.
