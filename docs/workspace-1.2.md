# Management workspace 1.2

The facilities list, production planner, resource view, navigation, and notifications now share a compact management workflow. Existing corporations and their progress remain compatible. The deployment continues to publish a tested `ghcr.io/nebula-codes/idlecorp-remake:latest` image for Linux AMD64 and ARM64.

## Facilities

Your facilities opens by default once you own a building. Grouped rows show a facility type's count, mixed statuses, expected enabled input/output rates, and quick controls. Expand a group to see individual facilities and open their details for XP, technologies, quality-input preferences, statistics, and demolition. Switch to individual rows or comfortable density when useful.

Each producing facility's row fills from left to right with its estimated cycle progress and shows a percentage beside its status. This works inside expanded groups and in individual layout. Paused rows are gray, blocked rows are amber, and infrastructure has no production fill. Progress uses the server's cycle timing and waits for confirmation before beginning the next cycle.

Search, status, group, sort, layout, and density are saved per corporation and region in this browser. The selection toolbar remains available while scrolling. Batch actions retain server ownership checks and idempotency. Rate totals represent expected capacity, not measured output or guaranteed profit.

## Production planning

The production canvas draws real resource and facility connections with automatic layout, labeled rates, pan/zoom, fit controls, branch focus and collapse, and separate production/construction layers. Select a node to inspect its connections or open a relevant game screen. The accessible list view remains available and is the mobile default. Connections describe shared regional inventory dependencies; they do not create physical routes or allocate inventory by dragging nodes.

Output targets support a net rate per minute or a total stockpile. Compare current capacity with a proposed set of whole factories, review upstream supply, choose producing or buying inputs, and inspect construction costs, land, materials, prerequisites, and purchase allowances. Save named scenarios to your corporation; they remain available after another login or server restart. Construction goals and overview pins remain available in the construction tab.

The server calculates every scenario without spending resources. Planning is a bounded, conservative heuristic rather than a cheapest-build optimizer. Construction, purchases, and resuming factories remain explicit game actions. Statistical quality yields, changing regions, retail, manual trading, and finite stock buffers can change results. Read [planner calculation details](planner-targets.md) and [the planner workspace guide](planner-workspace.md).

## Resource balances

Inventory shows stock, produced/consumed/net rates, and stock forecasts. Choose expected enabled capacity, conservative sustainable supply, or recorded production. Recorded rates begin with real production observations after this update; historical activity is not reconstructed. These are production rates and exclude manual trades and transfers.

Select a net rate to inspect contributing producers and consumers, follow the chain, plan output, or trade the resource. Depletion estimates use expected capacity; full-stock estimates use sustainable net supply. Both assume unchanged operation. Pin up to six resources to a bar available on every management page. Pins are private browser preferences scoped to the current corporation and region.

## Navigation and feedback

Page and region URLs support refresh and browser Back/Forward. Direct links can select a resource, facility, technology installation, or saved plan. View preferences and scroll positions are restored without resubmitting any economic action.

The bell opens a global drawer with current operational problems and recorded events. Alerts lead to their related facilities, research, shipments, or trades. Opening a recorded event marks it read. Action buttons and confirmation dialogs indicate their own progress, and completed buttons briefly show confirmation. Request keys still protect retries after interruptions, including plain HTTP LAN deployments. Logout also discards late responses from the previous session.

## Updating

Update the existing Portainer stack with re-pull enabled, preserving the existing credentials and volumes, then hard-refresh the browser. New saved plans and production observations are optional fields in the existing corporation state; no destructive reset or SQL schema replacement is required. The native development server must be restarted to load the new planning endpoints.
