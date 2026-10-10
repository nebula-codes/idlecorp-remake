# Management workspace 1.2

The facilities list, production planner, resource view, navigation, and notifications now share a compact management workflow. Existing corporations and their progress remain compatible. The deployment continues to publish a tested `ghcr.io/nebula-codes/idlecorp-remake:latest` image for Linux AMD64 and ARM64.

## Facilities

Your facilities opens by default once you own a building. Grouped rows show a facility type's count, mixed statuses, expected enabled input/output rates, and quick controls. Expand a group to see individual facilities and open their details for XP, technologies, quality-input preferences, statistics, and demolition. Switch to individual rows or comfortable density when useful.

Each producing facility's row fills from left to right with its estimated cycle progress and shows a percentage beside its status. This works inside expanded groups and in individual layout. Paused rows are gray, blocked rows are amber, and infrastructure has no production fill. Progress uses the server's cycle timing and waits for confirmation before beginning the next cycle.

Bonus and penalty indicators open an **Active effects** breakdown for a facility. Group summaries count affected facilities; individual rows count their effects. The breakdown identifies the sources of speed, output, quality, input, and operational changes, including eligible technologies installed on another facility in the same region. Temporary effects show their remaining duration. Paused or blocked facilities still show their potential modifiers alongside the reason they cannot currently produce.

The cycle calculation starts with the catalogue's **base cycle**, applies flat adjustments and the combined speed multiplier, and shows the effective cycle with applicable minimum-time limits. It describes current modifiers; an already scheduled cycle keeps its deadline until the next cycle is scheduled. Output and quality effects are listed separately because they do not necessarily change speed. These are server explanations of the existing rules, not new gameplay bonuses.

Search, status, group, sort, layout, and density are saved per corporation and region in this browser. The selection toolbar remains available while scrolling. Batch actions retain server ownership checks and idempotency. Rate totals represent expected capacity, not measured output or guaranteed profit.

## Production planning

The production canvas draws real resource and facility connections with automatic layout, labeled rates, pan/zoom, fit controls, branch focus and collapse, and separate production/construction layers. Select a node to inspect its connections or open a relevant game screen. The accessible list view remains available and is the mobile default. Connections describe shared regional inventory dependencies; they do not create physical routes or allocate inventory by dragging nodes.

Output targets support a net rate per minute or a total stockpile. Compare current capacity with a proposed set of whole factories, review upstream supply, choose producing or buying inputs, and inspect construction costs, land, materials, prerequisites, and purchase allowances. Save named scenarios to your corporation; they remain available after another login or server restart. Construction goals and overview pins remain available in the construction tab.

The server calculates every scenario without spending resources. Planning is a bounded, conservative heuristic rather than a cheapest-build optimizer. Construction, purchases, and resuming factories remain explicit game actions. Statistical quality yields, changing regions, retail, manual trading, and finite stock buffers can change results. Read [planner calculation details](planner-targets.md) and [the planner workspace guide](planner-workspace.md).

## Resource balances

Inventory shows stock, produced/consumed/net rates, and stock forecasts. Choose expected enabled capacity, conservative sustainable supply, or recorded production. Recorded rates begin with real production observations after this update; historical activity is not reconstructed. These are production rates and exclude manual trades and transfers.

Select a net rate to inspect contributing producers and consumers, follow the chain, plan output, or trade the resource. Depletion estimates use expected capacity; full-stock estimates use sustainable net supply. Both assume unchanged operation. Pin up to six resources to a bar available on every management page. Pins are private browser preferences scoped to the current corporation and region.

## Regional exchange

The Regional market opens with an inventory-first resource list. Search by resource name or category, show all resources when buying, and sort by name, stock, or sale value. Each row shows its regional stock and current NPC sell quote; normal and plus-quality resources remain separate.

**Sell 100**, **Sell 1,000**, **Sell 10,000**, and **Sell all** execute a sale directly. Sell all refers only to that row's resource in the active region, using the displayed stock quantity. Locked resources, unavailable NPC trades, and quantities above the available stock cannot be sold. Open a row's **Trade** controls for custom quantities or purchases.

Prices are estimates until the server confirms the trade. Production and other sessions can change stock before a request arrives; the server either executes the requested quantity or rejects the sale without a partial trade. Newly produced stock may remain after Sell all. NPC sales have no player-market fee or hourly sell limit. Player exchange orders continue to use their separate fee, escrow, and review flow.

If a quick sale is interrupted, **Retry sale** retains the original resource and quantity so a completed sale cannot execute twice. A definite server rejection can be cleared after checking the updated stock; an uncertain response must be resolved through Retry first. Sold-out rows remain visible for the current visit with a confirmation.

## Navigation and feedback

Page and region URLs support refresh and browser Back/Forward. Direct links can select a resource, facility, technology installation, or saved plan. View preferences and scroll positions are restored without resubmitting any economic action.

The bell opens a global drawer with current operational problems and recorded events. Alerts lead to their related facilities, research, shipments, or trades. Opening a recorded event marks it read. Action buttons and confirmation dialogs indicate their own progress, and completed buttons briefly show confirmation. Request keys still protect retries after interruptions, including plain HTTP LAN deployments. Logout also discards late responses from the previous session.

## Appearance

Use the palette button in the page header or **Settings → Appearance** to switch between Light, Dark, High Contrast, Ocean, Sunset, and Terminal. A picker is also available before sign-in. The selected theme applies immediately to the full interface, including production graphs and facility progress backgrounds, and is remembered on this device across reloads, sessions, and open tabs.

**Use device setting** follows the operating system's light/dark preference, or its increased-contrast preference when available. Explicit selections override the device preference. High Contrast uses stronger text, boundaries, and focus outlines; every theme retains status labels and respects reduced motion. Themes change presentation only.

## Updating

Update the existing Portainer stack with re-pull enabled, preserving the existing credentials and volumes, then hard-refresh the browser. New saved plans and production observations are optional fields in the existing corporation state; no destructive reset or SQL schema replacement is required. The native development server must be restarted to load the new planning endpoints.
