# Production workspace

Open **Production planner** to compare a proposed output target with the selected region's confirmed stock, existing facilities, production modifiers, and shared input demand. Planning and saving a scenario never builds a facility or spends money.

## Output targets

Choose a resource and either **Net output per minute** or **Total stockpile**. A rate target is the desired surplus after existing regional consumption. A stockpile target includes stock already held; its collection horizon determines the additional rate being planned. Choose whether to produce the target or buy it.

The summary separates theoretical enabled capacity, sustainable throughput limited by upstream supply, and projected sustainable throughput after the proposed changes. Observed throughput, when available, comes from actual server production counters; it is not a forecast. Rates from quality outcomes are expected averages, not guarantees.

The capacity table lists existing, active, resumable, additional, and total factories. Construction cost, free land, required materials, and prerequisites remain separate from ongoing input flows. Use **Review build**, **View facilities**, or a selected node's actions to perform normal reviewed operations. Plans do not execute automatically.

Select a resource node to change its supply choice between production and buying. When several facility types can produce a resource, its detail panel also provides a producer selector. Purchase rows show current quotes and the available shared NPC allowance. Recurring rows quote one hour of supply; a direct stockpile purchase quotes the missing target units. Player offers and future prices are never guaranteed.

Give a scenario a name and choose **Save plan**. Saved plans belong to the corporation and region, and can be loaded, updated, copied with **Save as new**, or deleted. They retain targets, horizons, supply choices, and producer choices. Loading a plan recalculates it against current server state.

## Flow graph

The connected graph runs left to right: resources feed facilities, and facilities produce resources. Edges display server-calculated per-minute quantities. These arrows describe access to the shared regional inventory, not reserved physical routes between individual factories.

- Use **Production flows** for ongoing rates, **Construction & development** for one-time requirements, or **All dependencies** to compare both. Dashed edges mark one-time requirements.
- Drag the background to pan, use the zoom controls, or choose **Fit graph**. Polling updates values without changing node positions or resetting the viewport when the network's topology is unchanged.
- Click a node, search for its name, or focus a node with the keyboard and press Enter or Space to inspect it. Its panel includes connected nodes, status, rates, and relevant actions.
- **Focus selected chain** shows its upstream and downstream connections. **Collapse input branch** hides its upstream dependencies; **Expand input branch** or **Reset view** restores them. Collapsing is a display operation only.
- **List view** exposes the same nodes, connections, and actions in ordinary controls. It is the initial view on a new narrow-screen session and remains available on desktop. View preferences are scoped to the account and region in this browser.

**Production chains** provides the same graph controls for the live network. **Construction goal** retains the earlier facility bill, blockers, conservative resource wait estimate, and overview pin. Building the requested facilities advances the pinned goal through partial completion to completion.

## Boundaries of the calculation

The server uses a bounded deterministic expansion strategy, not a cheapest-build optimizer. Existing producer types are preferred before construction cash per expected unit. The model reserves shared upstream supply against all enabled demand once; it does not spend the same input twice or optimistically reassign unused shares from blocked consumers. Sustainable rates exclude finite stored inputs, so a temporarily running factory can have lower sustainable throughput than theoretical capacity.

New factories use level zero and current regional effects. Future XP, research, technology installation, changing policies, retail activity, manual sales, exports, and uncertain market fills are not silently assumed. Construction materials are listed rather than automatically manufactured. Purchase-based projected rates require the player to maintain the displayed supply. Dependency cycles, quality-only resources, manual acquisition, and capacity limits can leave a target blocked. Completion estimates appear only when current sustainable flow supports them; rate targets have no completion timer.

The API supports rates from 0.000001 to 1,000,000 units per minute, whole stock targets within the inventory limit, horizons from 1 to 10,080 minutes, and up to 20 saved scenarios. The server validates every request and recalculates every plan.

## Verification

Run `node scripts/test-planner-workspace.mjs` after building the web application. It creates a disposable PostgreSQL database, seeds an explicit production fixture, exercises real browser/server actions, captures desktop/mobile screenshots, and cleans up its own database. Results are written to `artifacts/planner-workspace/report.json`. It never changes the live world.
