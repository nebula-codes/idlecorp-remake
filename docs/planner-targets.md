# Production targets, resource balances, and saved plans

The production planner is server-calculated advice. It does not build, buy, pause, sell, or transfer anything. Existing construction goals remain available independently. Named plans are private to a corporation, shared across its sessions, and preserved across corporation resets.

## Targets and assumptions

`GET /api/production-plan` requires an authenticated session and accepts `regionId`, `assetId`, `mode=rate|stock`, `amount`, and `source=produce|buy`. A rate is a desired **net surplus in units per minute**, after all existing enabled consumers of the same resource. A stock target is the desired total regional inventory, including what is already owned. The optional `horizonMinutes` (default 60) determines the extra capacity proposed for a stock shortfall; it is not a promised completion time.

`choices` is an optional JSON object mapping upstream asset IDs to `produce` or `buy`. `producerChoices` maps asset IDs to a selected factory type. Rates must be finite, from 0.000001 to 1,000,000 per minute. Stock targets are whole units up to the inventory limit. Horizons range from one minute to seven days. At most 50 overrides of each kind are accepted.

The planner expands backward through actual recipes, rounds required factories upward, and merges demand on shared resources. Existing producers are preferred; otherwise the deterministic heuristic selects construction cash per expected unit. Paused factories can be proposed for resumption before new construction. This is a bounded practical plan, not a globally cheapest or mathematically optimal build. It never silently resumes a paused factory.

New factories use level zero and ordinary input preference, while retaining applicable existing regional technology, services and modifiers. Existing factories use their actual levels, quality settings and current plus-input availability. Quality quantities are expectations, not guarantees. Future level gains, new technology installation, research outcomes, player-order availability and future policy changes are not invented. Unsupported sources, cycles, economic limits and the 2,000-facility regional cap produce explicit blockers.

Construction requirements separately report money, land, materials, locks and prerequisites. Construction materials are not automatically added to the operating production chain. Graph construction edges show one-time material/cash requirements; production edges show ongoing rates. Cash totals cover construction and land, while manual resource purchases have separate quotes.

Purchase rows use current authoritative NPC quotes and share the corporation's current hourly allowance and cash budget across all listed rows, after deducting the proposed construction and land costs. `requirements.cash.availableForPurchases` shows that remainder. Operating purchases quote one hour of supply; a directly purchased stock target quotes the missing units. Player-only or unavailable assets are called out. Buying is a manual action; projected throughput assumes recurring supplies are maintained. No purchase quote spends or reserves anything.

## Three distinct rates

Each target and regional resource balance separates:

- **Capacity:** expected full-speed rates of enabled facilities under current recipes and modifiers. It can exceed what inputs support.
- **Sustainable throughput:** a conservative steady-state estimate excluding finite stored inputs. Each resource's supply is reserved proportionally against full enabled demand, preventing the same supply from being assigned to multiple consumers. Shares left unused by a separately blocked consumer are not optimistically reassigned. Capacity-blocked factories contribute no sustainable production.
- **Recorded actual:** real automated production input/output counters divided by their observation duration. Quality units are counted by the actual outcome. This is a historical average, not a prediction. It excludes retail, manual trades, exports and construction.

Actual counters begin when this version first processes a region; earlier history is not fabricated. They persist across ordinary restarts and reset when their region is reset. Until an observation interval exists, `actual` is `null`. Very large counters saturate at the safe-integer limit and report `capped=true` rather than falsely claiming exact history.

`holdings[regionId].resourceBalances` includes stock, nominal and sustainable input/output/net rates, recorded actual rates, grouped producers and consumers, and warnings. `depletionSeconds` describes how long stock would cover a negative full-capacity net rate; it is conditional on that rate continuing. `fullSeconds` uses positive sustainable net flow to estimate reaching the numeric inventory limit. These are not storage upgrades or guaranteed timers. Retail, manual changes, shared inputs, random quality and future regional changes can alter both.

A stockpile ETA is available only from currently sustainable net production, with pending-cycle waits included. It excludes unbuilt factories and required manual purchases. A region may have enough finite inputs to finish a small batch despite a blocked sustainable ETA; the planner labels that limitation instead of inventing guaranteed ongoing supply. Estimates beyond one year are not displayed.

## Saved plan actions

`plan.save` uses the ordinary idempotent action endpoint with `name` plus target fields. Omit `id` to create a server-generated ID, or pass an owned plan ID to update it. `plan.delete` accepts an owned `id`. Names contain 1–60 characters, and a corporation may keep 20 plans. Snapshots expose its own `savedPlans` array. Saving stores intent, not a frozen result: opening a saved plan recalculates against current authoritative state.

The response includes `target`, `current`, `projected`, `facilities`, `requirements`, `purchases`, `blockers`, `warnings`, `eta`, `resourceBalances`, and a layered graph. `status=ready` means the existing stock or estimated sustainable rate meets the target; `planned` describes an actionable proposal whose construction/purchase steps may remain; `blocked` means the selected approach cannot currently establish the target within the stated bounds.

Validation is covered by `tests/production-targets.test.ts` and `node scripts/test-production-targets.mjs`. The API suite uses a separate temporary PostgreSQL database and tests read-only estimates, malformed requests, duplicate saves, ownership isolation, restart persistence, real production observations and deletion.
