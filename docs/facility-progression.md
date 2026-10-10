# Facility progression and pacing review

The server grants each producing facility its definition's XP after a successful cycle. All current producing definitions grant 1 XP. Levels use `floor(xp / 100000)`, capped at 50, and each earned level contributes 0.5 percentage points of base plus-quality chance. Regional technology, services and the actual available plus-input share can change the effective chance; the final chance is capped at 100%. Levels do not directly speed production. Infrastructure has no automatic production XP and outputs without a plus variant gain no quality benefit.

## Pacing findings

With uninterrupted supply, no upgrades and neutral modifiers, the current definitions give:

| Facility | Base cycle | XP per day | Days from level 0 to 1 |
| --- | ---: | ---: | ---: |
| Tree farm | 5 seconds | 17,280 | 5.79 |
| Oil well | 10 seconds | 8,640 | 11.57 |
| Steel mill | 35 seconds | 2,468.57 | 40.51 |

Time is based on completed cycles, not time signed in. The server processes offline production chronologically. Shortages, pauses and full output storage delay progress; speed bonuses and technologies shorten it. A first level only changes base quality chance from 0% to 0.5%, so passive milestones are slow and their immediate economic benefit is small. Scrap provides the deliberate acceleration path: 100,000 scrap buys one complete level from its starting boundary, with an opportunity cost in resources that could otherwise be sold or used.

This update preserves the existing curve and saves. Progress bars, benefit previews, safe target-based scrap upgrades and grouped milestone feedback make the existing mechanics legible. Changing the XP curve would immediately alter the levels and quality rates of existing factories and would require a versioned migration decision; changing only the threshold would also affect the scrap economy and old level caps. A future balance change should treat early-level pacing and scrap costs together and measure the effect on quality supply, rather than applying an unannounced global multiplier.

## Snapshot and action behavior

Each facility exposes a read-only progression summary with XP within the current level, XP to the next level, cap state, successful-cycle XP, conditional ETA, quality preview and two upgrade targets. The ETA uses the currently scheduled cycle and subsequent effective cycles. It does not promise that future supplies, regional modifiers or buffs will remain unchanged.

Quick upgrades send an exact `targetXp` and `maxScrap` budget. The transaction advances production before applying the action, then spends only the remaining XP deficit. It rejects an already reached target, invalid or over-cap values, insufficient/locked scrap, or a deficit exceeding the confirmed budget. Existing quantity-based `facility.addxp` clients remain supported. The existing account-bound idempotency receipt protects retries.

Production level changes are summarized once per region per simulation advance, including catch-up with multiple level jumps. Scrap-driven level changes use the same recorded-event format. Notifications are bounded by the existing event retention limit; older level history is not reconstructed for pre-update saves.
