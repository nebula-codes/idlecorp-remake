# Gameplay coverage ledger

Evidence and implementation statuses are independent. A command mapping is not proof of a working control. Review JSON source revision links alongside acceptance test results.

| id | scope | implementationLocation | implementationStatus | verification |
|---|---|---|---|---|
| accounts | account auth, corp creation/name/motto/privacy | auth routes; settings.update | implemented; API and core GUI verified | artifacts/e2e-report.json: two accounts, two sessions on one account, login/logout and unboosted onboarding |
| global_local | global money/progression versus local land/inventory | state holdings | server-verified; region-switch GUI verified | tests/source-parity.test.ts: regional technology effects and blueprint research/export ownership; artifacts/ui-workflows/report.json: regional selection and selected-region liquidation; global-local matrix remains primarily source-parity tested |
| land_build | land escalation/construction/capacity/refunds | land.buy; facility.build; facility.demolish | implemented; API and core GUI verified | tests/source-parity.test.ts: 40% historical material valuation and free token land pricing; artifacts/e2e-report.json: land/build/production/sale/persistence, duplicate and concurrent build rejection; keyboard and layouts inspected |
| production | all44 facilities and chronological catch-up | engine.advance | implemented; API and core GUI verified | artifacts/e2e-report.json: land/build/production/sale/persistence, duplicate and concurrent build rejection; keyboard and layouts inspected |
| levels_quality | XP, plus inputs, starvation, levels | facility.plus; facility.addxp; qualityChance | implemented; API and core GUI verified | apps/server/test/engine.test.ts: scrap consumption, manual XP leveling, plus-input preference and starvation; packages/rules/src/content.test.ts: quality formula and level limits; artifacts/ui-workflows/report.json: scrapped one lamp, spent 100 scrap on a tree farm, enabled steel-mill plus inputs and confirmed demolition/refund; probabilistic plus output is server-tested |
| inventory | locks, scrap, rates, bottlenecks | inventory.lock; inventory.scrap; snapshots | implemented; API and core GUI verified | artifacts/ui-workflows/report.json: GUI inventory lock, blocked sale, unlock and confirmed NPC cash; other inventory controls remain separately tested |
| npc | regional NPC price/limit/eligibility | npc.buy; npc.sell | implemented; API and core GUI verified | artifacts/e2e-report.json: land/build/production/sale/persistence, duplicate and concurrent build rejection; keyboard and layouts inspected; artifacts/ui-workflows/report.json: GUI lock rejection, unlock, NPC sale and NPC buy with real funds and stock |
| market | shared orders/escrow/partial fills/cancellation/fees | order.create; order.cancel; logistics.claim | implemented; API and core GUI verified | artifacts/e2e-report.json: real two-player price-priority partial fill, cancellation/fill race, escrow and fee conservation, cash/asset inbox claims |
| exports | trucks/fuel/dispatch/arrival/claim | export.dispatch; export.claim | implemented; API and core GUI verified | artifacts/ui-workflows/report.json: wood dispatch to another region, persisted deadline advanced in isolated fixture, arrival and cargo claim |
| gifts | premium gifting/cash transfers | gift | implemented; API and core GUI verified | artifacts/ui-workflows/report.json: sent wood to private corporation ID and asserted pending recipient inbox; cash-gift variant not exercised here |
| retail | products/price/names/demand/HQ/support | retail.configure; retail.remove; retail.name | implemented; API and core GUI verified | tests/source-parity.test.ts: global HQ requirement, five-store support demand, normal/plus inventory and revenue conservation, locked goods remain untouched; artifacts/ui-workflows/report.json: configured product, price and names; actual timed sale and listing removal |
| research | cost/timers/independent reward pools/expedite | research.start; research.claim; research.finish | implemented; API and core GUI verified | tests/source-parity.test.ts: eight-facility season cost discount, concurrent two-region projects and original local outcomes, knowledge expedite and duplicate claims; artifacts/ui-workflows/report.json: GUI project start, gratitude completion and blueprint claim |
| technology | blueprint/development/install/uninstall/upgrade | technology.develop; technology.install; technology.uninstall; technology.upgrade | implemented; API and core GUI verified | tests/source-parity.test.ts: nine-to-one UU upgrade, inventory consumption, installation fee, regional output/speed, uninstall and net-worth retention; artifacts/ui-workflows/report.json: GUI blueprint development, installation, uninstall and upgrade combination |
| regions | shared population/modifiers and discovery | state regions; region selector | implemented; server and core regional GUI verified | tests/source-parity.test.ts: regional technology isolation and shared fiber benefit; 72-hour modifier boundary equivalence; artifacts/ui-workflows/report.json: region selection, services, elections and policy activation |
| services | all7 collaborative regional service projects | service.fund | implemented; API and core GUI verified | tests/source-parity.test.ts: fully funded fiber benefits two corporations in one region; artifacts/ui-workflows/report.json: funded the region office through the contribution control; cross-account fiber effects separately covered by source-parity tests |
| governance | all9 policies/costs/elections/eligibility | policy.vote; election.run; election.vote | implemented; API and core GUI verified | tests/source-parity.test.ts: policy funding cost, high-tax budget, 24-hour cooldown and tied election result; artifacts/ui-workflows/report.json: office funding, candidate registration, ballot vote, actual election completion and elected policy activation |
| prestige | transactional preview/reset/persistence/tokens | prestige.preview; prestige.reset; upgrade.buy | implemented; API and core GUI verified | tests/source-parity.test.ts: stacked seasonal starter bonuses, permanent upgrade/XP/gratitude persistence, source valuation and regional vault stabilization; artifacts/ui-workflows/report.json: token upgrade, authoritative reincorporation preview, confirmed reset, facilities cleared and carried score asserted |
| liquidation | regional reset/historical refunds/pending actions | liquidation.preview; liquidation.reset | implemented; API and core GUI verified | artifacts/ui-workflows/report.json: switched region, requested authoritative preview, confirmed twice, asserted selected region land reset |
| season | dates/challenges/XP/ten pass bonuses | reward.daily; season.claim | implemented; API and core GUI verified | tests/source-parity.test.ts: three free versus six platinum daily challenges, rewards, double-claim rejection, seasonal research and prestige bonuses; artifacts/ui-workflows/report.json: daily reward, season level-one bonus, weekly unlock/reward and daily challenge claimed; supporter vote reward is server-tested only |
| rewards | standalone voting/gratitude/boon/weekly/tier | reward.vote; reward.weekly | implemented; API and core GUI verified | tests/source-parity.test.ts: all four entitlement tiers receive configured vote/daily/weekly rewards, season unlock and cooldown/replay rejection; artifacts/ui-workflows/report.json: daily reward, season level-one bonus, weekly unlock/reward and daily challenge claimed; supporter vote reward is server-tested only |
| entitlements | admin-granted free/plus/gold/platinum gameplay | admin CLI; entitlement config | implemented; server and administrative CLI verified | tests/source-parity.test.ts: four-tier weekly tokens/vote multipliers and three-versus-six daily challenges; admin CLI grant path separate; artifacts/operations-report.json: all four real CLI entitlement grants reached authoritative state and persisted audit entries; invalid tier rejected without changes; tier-specific gameplay covered in source-parity tests |
| space | launch/station/upgrade/repair/five difficulties | space.launch; space.station.*; space.expedition; space.claim | implemented; API and core GUI verified | tests/source-parity.test.ts: launch/station build/upgrade, all five difficulties under success and both rocket-return failure paths, exact fuel/coordinate costs, damage/repair, persisted outcomes and claim once; artifacts/ui-workflows/report.json: launch/station construction/dispatch, persisted result claim, damaged-station repair and XP-funded station upgrade to level two |
| relics | four relic types and global vaulted effects | space.relic; engine modifiers | implemented; API and core GUI verified | artifacts/unit-test-report.json and tests/source-parity.test.ts: knowledge consumption/claim once; vaulted haste duration reduction in both regions without reroll; efficiency doubles actual plus output into normals globally; prestige token-divisor reduction and cap, unchanged score/worth; all passive effects deactivate after withdrawal; artifacts/ui-workflows/report.json: consumed knowledge relic to finish active research and claimed its existing outcome; other three relic effects have dedicated server fixtures |
| vault | deposit/withdraw/retention on prestige | space.vault withdraw flag; prestige.reset | implemented; API and core GUI verified | tests/source-parity.test.ts: deposit/withdraw conservation, deterministic reset rolls and local stabilization; artifacts/ui-workflows/report.json: wood deposit and withdrawal each confirmed with actual vault quantities |
| social_history | leaderboards/privacy/activity/notifications | snapshots; settings.update | implemented; API and core GUI verified | docs/research/ui-control-audit.json: Leaderboard global/regional/season selectors and Settings privacy/notification controls inspected; E2E confirms persisted economic audit entries, not all preference controls; artifacts/ui-workflows/report.json: name/motto change charged exactly three gratitude; privacy opt-in and completion notification preference persisted; leaderboard sort selectors remain code-reviewed only |
| help | searchable source-backed in-game reference/onboarding | Help UI; source links | implemented view; code-reviewed, interaction verification pending | docs/research/ui-control-audit.json: searchable field guide, source links, versioned release notes and onboarding controls inspected |
| offline_restart | server authoritative deterministic chronological advancement | engine.advance; transaction boundaries | implemented; API/restart verified | artifacts/e2e-report.json: actual server restart preserves sessions/state and advances offline production; backup/restore round trip |
| icons | discover originals and complete local replacements | scripts/collect-icons.py | complete | packages/rules/src/content.test.ts validates 200 mappings; docs/research/icon-preview.png and artifacts/screenshots/icon-audit.png visually inspected; icon-discovery.json audits all196pages |

## Every original command

| command | guiScreen | operation | implementationStatus |
|---|---|---|---|
| corporation | Overview | corporation/profile snapshot | implemented view/control; code-reviewed, workflow verification pending |
| rebirth | Prestige | prestige.preview + prestige.reset | implemented; exercised GUI operation verified |
| liquidate | Prestige | liquidation.preview + liquidation.reset | implemented; exercised GUI operation verified |
| usetoken | Prestige | upgrade.buy | implemented; exercised GUI operation verified |
| capital | Overview / Prestige / Market | cash, net worth and regional hourly purchase allowance | implemented view/control; code-reviewed, workflow verification pending |
| land | Facilities | regional plot count | implemented view/control; code-reviewed, workflow verification pending |
| assets | Inventory | search/filter inventory | implemented view/control; code-reviewed, workflow verification pending |
| price | Market | NPC quote and asset detail | implemented view/control; code-reviewed, workflow verification pending |
| buy(all) | Market | npc.buy quantity control | implemented; exercised GUI operation verified |
| sell(all) | Market | npc.sell quantity control | implemented; exercised GUI operation verified |
| examine | Facilities / Inventory / Research / Production chains | entity detail cards, requirements, recipes, quotes and effects | implemented view/control; code-reviewed, workflow verification pending |
| lockasset(all) | Inventory | inventory.lock | implemented; exercised GUI operation verified |
| unlockasset(all) | Inventory | inventory.lock toggle | implemented; exercised GUI operation verified |
| scrap(all) | Inventory | inventory.scrap quantity control | implemented; exercised GUI operation verified |
| facility | Facilities | current facilities and rates | implemented view/control; code-reviewed, workflow verification pending |
| facilitylist | Facilities | build catalog | implemented view/control; code-reviewed, workflow verification pending |
| build | Facilities | facility.build | implemented; exercised GUI operation verified |
| demolish(all) | Facilities | facility.demolish | implemented; exercised GUI operation verified |
| addxp | Facilities | facility.addxp | implemented; exercised GUI operation verified |
| setconsumeplus | Facilities | facility.plus enabled | implemented; exercised GUI operation verified |
| unsetconsumeplus | Facilities | facility.plus disabled | implemented view/control; code-reviewed, workflow verification pending |
| region | Region | shared modifiers/population/services | implemented view/control; code-reviewed, workflow verification pending |
| regioncode | Region | persistent server region ID | implemented view/control; code-reviewed, workflow verification pending |
| donateservice | Region | service.fund | implemented; exercised GUI operation verified |
| joinballot | Region | election.run | implemented; exercised GUI operation verified |
| ballot | Region | weekly ballot view | implemented view/control; code-reviewed, workflow verification pending |
| voteballot | Region | election.vote | implemented; exercised GUI operation verified |
| addpolicy | Region | policy.vote enable | implemented; exercised GUI operation verified |
| removepolicy | Region | policy.vote disable | implemented view/control; code-reviewed, workflow verification pending |
| policies | Region | policy cards/status/funding | implemented view/control; code-reviewed, workflow verification pending |
| research | Research | research.start / research.claim / research.finish | implemented; exercised GUI operation verified |
| blueprint | Research | blueprint/material requirement cards | implemented view/control; code-reviewed, workflow verification pending |
| develop | Research | technology.develop | implemented; exercised GUI operation verified |
| install | Research | technology.install regional | implemented; exercised GUI operation verified |
| uninstall | Research | technology.uninstall | implemented; exercised GUI operation verified |
| upgrade | Research | technology.upgrade | implemented; exercised GUI operation verified |
| retail | Retail | product/demand/support view | implemented view/control; code-reviewed, workflow verification pending |
| addretailproduct | Retail | retail.configure | implemented; exercised GUI operation verified |
| removeretailproduct | Retail | retail.remove | implemented; exercised GUI operation verified |
| retailproductname | Retail | retail.name assetId + name | implemented; exercised GUI operation verified |
| retailproductprice | Retail | retail.configure price | implemented; exercised GUI operation verified |
| retailname | Retail | retail.name name | implemented; exercised GUI operation verified |
| export(all) | Logistics | export.dispatch | implemented; exercised GUI operation verified |
| claim | Logistics | export.claim / logistics.claim | implemented; exercised GUI operation verified |
| logistics | Logistics | arrivals/trucks/inboxes | implemented view/control; code-reviewed, workflow verification pending |
| give | Logistics | gift | implemented; exercised GUI operation verified |
| galacticexpedition | Space | space.expedition difficulty1–5 | implemented; exercised GUI operation verified |
| orbit | Space | orbital status/station launch/build/upgrade/repair | implemented; exercised GUI operation verified |
| vault | Space | vault inventory | implemented view/control; code-reviewed, workflow verification pending |
| vaultadd | Space | space.vault | implemented; exercised GUI operation verified |
| vaultremove | Space | space.vault withdraw=true | implemented; exercised GUI operation verified |
| userelic | Space | space.relic | implemented; exercised GUI operation verified |
| vote | Season | reward.vote standalone contribution reward | server-verified; GUI verification pending |
| notification | Settings | settings.update notification preferences | implemented; exercised GUI operation verified |
| seasonpassdaily | Season | daily challenge progress/claim | implemented; exercised GUI operation verified |
| weekly | Season | reward.weekly | implemented; exercised GUI operation verified |
| seasonpass | Season | passXP and bonus claims | implemented; exercised GUI operation verified |
| marketview | Market | global shared player order book replaces external MarketView | implemented view/control; code-reviewed, workflow verification pending |
| offers | Market | own orders | implemented view/control; code-reviewed, workflow verification pending |
| canceloffer | Market | order.cancel | implemented; exercised GUI operation verified |
| buyoffers | Market | buy book | implemented view/control; code-reviewed, workflow verification pending |
| selloffers | Market | sell book | implemented view/control; code-reviewed, workflow verification pending |
| marketbuy | Market | order.create buy | implemented; exercised GUI operation verified |
| marketsell | Market | order.create sell | implemented; exercised GUI operation verified |
| leaderboards | Leaderboards | regional/global/season rankings | implemented view/control; code-reviewed, workflow verification pending |
| lboptin | Settings | settings.update privacy=false | implemented; exercised GUI operation verified |
| lboptout | Settings | settings.update privacy=true | implemented view/control; code-reviewed, workflow verification pending |
| help | Settings & help / Field guide | searchable gameplay reference | implemented view/control; code-reviewed, workflow verification pending |
| tutorial | Overview / Help | onboarding guide | implemented view/control; code-reviewed, workflow verification pending |
| name | Settings | settings.update name | implemented; exercised GUI operation verified |
| motto | Settings | settings.update motto | implemented; exercised GUI operation verified |
| invite | Settings | share server address; no bot invite | implemented view/control; code-reviewed, workflow verification pending |
| prefix | Settings | omitted: no text-command parser | intentionally-omitted |
| about | Help | ruleset/build info | implemented view/control; code-reviewed, workflow verification pending |
| changelog | Settings & help / Field guide | local versioned release notes and official update link | implemented view/control; code-reviewed, workflow verification pending |
| premium | Settings / Help | admin-grantable tier info; no payments | implemented; tier admin/server verified; help view code-reviewed |
| wiki | Help | source reference link | implemented view/control; code-reviewed, workflow verification pending |
