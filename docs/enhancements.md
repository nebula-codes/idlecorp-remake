# IdleCorp 1.1 guide

Version 1.1 adds planning, organization, recorded performance, account recovery, server operations, and an optional cooperative economy to the shared multiplayer remake. Browser and desktop clients use the same account and authoritative server. The base gameplay ruleset remains `2026.10-remake.1`.

## Plan the next production line

Open **Production planner**, choose a facility and a quantity from 1 to 100, and review current cash, materials, free land, additional land cost, and prerequisites. Cash is global; inventory, land, and most construction requirements belong to the selected region. NPC purchase options show live prices and remaining purchase allowances where buying is permitted.

Pin the goal to the overview to track it across sessions. A pin records how many facilities you own now and adds the requested quantity to form its target. Each construction advances that target; partial completion reduces the remaining requirements. A completed goal stays visible until cleared. Demolishing target facilities can increase the remaining count. Editing planner controls creates a fresh what-if quote; it does not silently replace the pin.

Completion times are qualified estimates from current production rates. Missing capital, land, unlocks, inputs, or capacity can prevent an estimate. Estimates do not assume future player trades, manual sales, purchases, or unclaimed deliveries. Planning itself spends nothing.

## Inspect bottlenecks and organize facilities

**Production chains** connects resources, producers, construction bills, technology development, and research discovery. Select a node to inspect its connections and open the relevant existing screen. Paused, starved, capacity-limited, and missing producers are distinguished. Random research discovery is not a guaranteed supply rate. Large graphs show a truncation notice when the display limit is reached.

In **Facilities**, use groups, favorites, search, and status filters to find production lines. Select several facilities to pause or resume them together, assign a group, or change favorites. Batch changes are validated together by the server. Utilization reflects recorded operating outcomes; margin sorting uses theoretical NPC replacement prices, not realized trading profit. Quality, retail, and player exchange prices are excluded from that margin estimate.

The overview recommends progression milestones from your actual holdings and activity: first production, logistics, research, regional development, and space. Advanced navigation remains available throughout.

## Read actual history and trade outcomes

The overview records cash, net worth, lifetime production, and earnings. A return report compares confirmed values with the previous visit and stays available while ordinary polling continues. Attention cards lead to stalled production, ready discoveries, deliveries, and notifications.

**History starts when 1.1 begins recording; there is no backfill.** Corporation history retains up to 720 observations, normally sampled at one-minute intervals. Market history begins when you watch a resource and retains up to 168 hourly observations per resource and region. The watchlist allows 24 resources. Charts need multiple observations before a trend can appear; removing a watched resource removes its recorded watch history.

Review a player order before submitting it to see its cash escrow or expected sale proceeds and fees. This is a live-book quote, not a guaranteed match: the server rechecks the book when the order executes. The market's executed-trade table shows your actual matches and fees. Persistent notifications can be marked read individually or together. Goods and sale proceeds still require their ordinary Logistics inbox claim.

## Protect account access

Open **Settings → Account & security** and enter your current password to generate eight one-use recovery codes. Save the displayed codes privately before closing the display. Only hashes are stored on the server, and generating another set invalidates every previous code.

If you lose your password, use the sign-in recovery form with your username, one unused code, and a new password. Recovery consumes that code and revokes every existing session; then sign in normally. Changing a password while signed in preserves the current session and ends other sessions. Passwords contain 10–128 characters. The same settings page lists your sessions and lets you revoke other devices or sign out the current one. Recovery does not depend on email or Discord.

## Optional cooperative economy

Supply contracts and community projects are **original remake additions**, not recovered IdleCorp mechanics. Their separate ruleset is `2026.10-expansion.1`. Fresh worlds and upgraded worlds default to expansion off; an administrator must enable it. The delivered local demonstration world is enabled separately during setup. The in-game status is authoritative for the server you join.

**Supply contracts:** a buyer reserves the entire price in cash and chooses a resource, amount, destination region, and deadline of 1 hour to 7 days. Another corporation accepts as supplier from a region with logistics; both committed regions require logistics centers. The supplier can deliver in parts from that committed region even after changing the viewed region. Confirmed deliveries create buyer goods and seller proceeds in their claim inboxes. Either party can cancel the undelivered remainder; expiry also refunds unused escrow. Delivered portions remain final. Each corporation may hold up to five active buyer contracts and five accepted supplier contracts; the current expansion charges no contract fee.

**Community projects:** corporations with at least 10 land in the region can propose a project. Participants contribute the displayed cash and materials toward a shared, capped target. While funding, a participant can withdraw their whole contribution, and the creator can cancel the project; refunds go to claim inboxes. Unfinished projects expire after 72 hours. Reaching the target consumes the pool and activates its timed regional benefit:

| Project | Regional benefit | Duration |
| --- | --- | --- |
| Community garden | +3 happiness | 7 days |
| Industrial improvement program | 5% production-speed bonus | 1 day |
| Freight coordination hub | 10% shorter newly dispatched exports | 3 days |

The UI shows the real contribution requirements and remaining funding. Completed projects cannot be withdrawn. Disabling the expansion blocks new commitments while accepted contract delivery, cancellation, refunds, claims, and already-earned timed benefits can still settle. Reset previews explain how pending commitments are settled.

## Administration and upgrading

Administrator status is separate from gameplay entitlements and is never automatically granted. Register a normal account, then run this on the server with the target `DATABASE_URL` configured:

```sh
npm run admin -- role USERNAME admin
```

An administrator's **Account & security** page adds database and simulation health, account/session counts, backup status, a manual backup control, and the expansion toggle. Creating a backup or changing the expansion in the UI requires the administrator's current password. Backup files stay on the server.

Useful server commands:

```sh
npm run admin -- backup
npm run admin -- expansion on
npm run admin -- expansion off
npm run admin -- role USERNAME player
npm run admin -- entitlement USERNAME gold
```

Before upgrading, back up the database and preserve the old build. Install 1.1 dependencies, run migrations, build, and restart the server without clearing its volumes. Migration 002 adds administrator roles, session metadata, and recovery-code storage. Existing progression is retained; new histories begin with real observations. Automatic backups default to every 24 hours with seven retained files. Version-two backups include roles, sessions, and recovery-code hashes; the restore tool also accepts version-one backups.

See [self-hosting](self-hosting.md) for exact deployment, backup, restore, and upgrade commands, and [planner details](enhancements-planner.md) for estimate limitations and implementation verification.
