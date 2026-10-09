# Frozen ruleset2026.10-remake.1

All money uses integer cents. Production and balancing content is shipped locally; a build never needs wiki access. Dates represent a snapshot, not current official live-game state.

## research_rarity — conflict

Use fixed Common55%, Uncommon37%, Rare7%, Superior1%, rolling once per research facility. The v1.12 change explicitly replaces facility-count-dependent distributions; an old three-facility table does not even total100%.

Sources: [Research rev1715](https://wiki.idlecorp.xyz/index.php/Research), [Research facility rev1069](https://wiki.idlecorp.xyz/index.php/Research_facility), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## research_duration — conflict

Use a persisted2–3hour random duration: update explicitly changes2–4hours to2–3hours. Modifiers and instant completion apply without rerolling.

Sources: [Research facility rev1069](https://wiki.idlecorp.xyz/index.php/Research_facility), [Newcomer guide rev1610](https://wiki.idlecorp.xyz/index.php/Newcomer_guide), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## hq_cost — conflict

Use detailed HQ bill:$17.6M+1 logistics expansion+100k glass+2k televisions+100k steel+10k furniture+20k laptops. Summary says$32.6M. Updates confirm developed logistics expansion replaces blueprint; unresolved cash discrepancy favors specific detail, not edit date alone.

Sources: [HQ rev1409](https://wiki.idlecorp.xyz/index.php/HQ), [Category:Facility rev1357](https://wiki.idlecorp.xyz/index.php/Category%3AFacility), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## logistics_limit — conflict

Base hourly NPC purchase budget$1M; each logistics center adds$2M. Update explicitly increases$1M to$2M per center; expansion replaces per-center increment with$4M or$5M.

Sources: [Logistics center rev1343](https://wiki.idlecorp.xyz/index.php/Logistics_center), [Newcomer guide rev1610](https://wiki.idlecorp.xyz/index.php/Newcomer_guide), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## regional_clocks — conflict

Production modifiers change every48h per explicit update; use hourly asset price refresh from Asset rather than uncertain daily note. Exact original price and modifier random distributions unavailable; deterministic seeded bounded remake variation.

Sources: [Region rev1545](https://wiki.idlecorp.xyz/index.php/Region), [Category:Asset rev1133](https://wiki.idlecorp.xyz/index.php/Category%3AAsset), [Newcomer guide rev1610](https://wiki.idlecorp.xyz/index.php/Newcomer_guide), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## land — estimate

Use$600*1.0961757^purchased land, rounded to cents. Free starter/token/season land does not advance paid-land exponent. Formula is explicitly approximate in wiki. Keep actual paid costs for refunds.

Sources: [Land rev1606](https://wiki.idlecorp.xyz/index.php/Land), [FAQ rev1595](https://wiki.idlecorp.xyz/index.php/FAQ)

## population — estimate

Regional population is25,000 per regional plot; exact original formula unavailable (wiki estimate±3%). Recompute across corporations.

Sources: [Population rev482](https://wiki.idlecorp.xyz/index.php/Population)

## retail_demand — estimate

Use observed25% price rise halves demand; ten baseline sales/store/cycle at reference price, square-root population scaling, support factor floor0.1 and ceiling1. Quantities are configurable remake values, not recovered algorithm.

Sources: [Retail rev724](https://wiki.idlecorp.xyz/index.php/Retail), [Population rev482](https://wiki.idlecorp.xyz/index.php/Population), [Customer support center rev1408](https://wiki.idlecorp.xyz/index.php/Customer_support_center)

## export_fuel — estimate

Truck dispatch takes30min, plus15min,3 concurrent origins, logistics at both ends. Fuel value equals20% of cargo value, rounded up; plus trucks consume gasoline+. Historical3.5% destination-value fee predates truck logistics overhaul; selected ruleset uses fuel only.

Sources: [Export rev1514](https://wiki.idlecorp.xyz/index.php/Export), [Truck rev1122](https://wiki.idlecorp.xyz/index.php/Truck), [Newcomer guide rev1610](https://wiki.idlecorp.xyz/index.php/Newcomer_guide), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## price_table — conflict

Base prices come from NPC asset table, not historical suggested player prices. Gold+ table typo$4 is rejected in favor of consistent double-normal NPC quality price.

Sources: [Category:Asset rev1133](https://wiki.idlecorp.xyz/index.php/Category%3AAsset), [Gold rev537](https://wiki.idlecorp.xyz/index.php/Gold)

## quality — documented

Facilities gain1XP per completed cycle;100kXP/level to50; plus chance0.5%/level. All-plus inputs double that chance. Mixed-input fraction linearly interpolates (adaptation). Plus retail reference4x normal; plus scrap2x.

Sources: [Asset+ rev1636](https://wiki.idlecorp.xyz/index.php/Asset%2B), [Category:Facility rev1357](https://wiki.idlecorp.xyz/index.php/Category%3AFacility), [Scrap rev1655](https://wiki.idlecorp.xyz/index.php/Scrap)

## npc_eligibility — intentional_adaptation

NPC buy is available for normal intermediate/raw resources; consumer retail goods, trucks, space goods, technology and all plus variants require production/player trading. Wiki icons unavailable, so eligibility is inferred from documented product classes.

Sources: [Market rev1647](https://wiki.idlecorp.xyz/index.php/Market), [Newcomer guide rev1610](https://wiki.idlecorp.xyz/index.php/Newcomer_guide), [Category:Asset rev1133](https://wiki.idlecorp.xyz/index.php/Category%3AAsset)

## space_missing — estimate

Station requires10k parts inferred from833-hour factory example;1k launch construction fuel is configurable. Station hull, upgrade cost/XP, duration, repair ratio, reward quantities and station-level chance coefficient are remake values because documentation is incomplete. Difficulty base chances80/60/40/20/0%, fuel100–500 and failure damage100–500 are documented.

Sources: [Space station rev1693](https://wiki.idlecorp.xyz/index.php/Space_station), [Space station parts factory rev1646](https://wiki.idlecorp.xyz/index.php/Space_station_parts_factory), [Galactic coordinate rev1668](https://wiki.idlecorp.xyz/index.php/Galactic_coordinate), [Orbit rev1662](https://wiki.idlecorp.xyz/index.php/Orbit)

## relics — estimate

Vaulted haste subtracts30sec each from research; efficiency converts each plus output to2 normal; knowledge is consumed to finish research. Prestige divisor reduction exists but magnitude is undocumented; choose0.1%/relic capped50%.

Sources: [Relic of haste rev1719](https://wiki.idlecorp.xyz/index.php/Relic_of_haste), [Relic of prestige rev1721](https://wiki.idlecorp.xyz/index.php/Relic_of_prestige), [Relic of efficiency rev1720](https://wiki.idlecorp.xyz/index.php/Relic_of_efficiency), [Relic of knowledge rev1722](https://wiki.idlecorp.xyz/index.php/Relic_of_knowledge)

## vault — documented

Each vaulted item independently survives prestige50%, or75% with quantum stabilization installed in reset region. Retention rolls are server-persisted. Capacity10k is remake operational limit, not documented original limit.

Sources: [Quantum vault rev1694](https://wiki.idlecorp.xyz/index.php/Quantum_vault), [Quantum stabilization rev1689](https://wiki.idlecorp.xyz/index.php/Quantum_stabilization), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## region_identity — intentional_adaptation

Three persistent server-managed seed regions replace Discord server identity; accounts and clients share one world. Region IDs/names and seed modifiers are original remake content.

Sources: [Region rev1545](https://wiki.idlecorp.xyz/index.php/Region), [Help:How to play rev1560](https://wiki.idlecorp.xyz/index.php/Help%3AHow_to_play)

## seasons — intentional_adaptation

Historical Season1 dates are not live status. Local Founders season configured2026-10-01–2027-01-01; ten threshold/reward levels retained. Daily challenge target quantities are configurable as original quantities are not enumerated.

Sources: [Season rev1339](https://wiki.idlecorp.xyz/index.php/Season), [Season pass rev1325](https://wiki.idlecorp.xyz/index.php/Season_pass)

## standalone_vote — intentional_adaptation

Server eligibility and12h cooldown replace external Top.gg action. Preserve cash$1000, gratitude1, passXP200,25% boon speed and10% purchase bonus, multiplied by tier. Exact cooldown/boon lifetime is a declared local rule. No paid subscription processing.

Sources: [Voting rev1516](https://wiki.idlecorp.xyz/index.php/Voting), [Premium rev1619](https://wiki.idlecorp.xyz/index.php/Premium)

## market_ordering — intentional_adaptation

Price/time priority with escrow and partial fills; original priority algorithm undisclosed. Fee1.5% from explicit update, assigned to seller on fills. Free3 slots; tiers4/6/8. Claimed proceeds handled through logistics.

Sources: [Market rev1647](https://wiki.idlecorp.xyz/index.php/Market), [Command list rev1598](https://wiki.idlecorp.xyz/index.php/Command_list), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log), [Premium rev1619](https://wiki.idlecorp.xyz/index.php/Premium)

## startup — intentional_adaptation

Start with10 free land and$1000. Land is documented; starting cash amount is a configurable onboarding choice because tutorial omits it.

Sources: [Land rev1606](https://wiki.idlecorp.xyz/index.php/Land), [Help:How to play rev1560](https://wiki.idlecorp.xyz/index.php/Help%3AHow_to_play)

## technology_tiers — conflict

Use Blueprint upgrade table for18 technologies and3-to-1 recipe. Up to6 total regional install slots. Log loader UU field is ambiguous4; interpret as4seconds cycle reduction, giving1second base cycle. Slots are regional, effects apply to all matching regional facilities.

Sources: [Blueprint rev1692](https://wiki.idlecorp.xyz/index.php/Blueprint), [Log loader rev220](https://wiki.idlecorp.xyz/index.php/Log_loader), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## scrap_value — conflict

Scrap page says1 item:1scrap:1XP while update says each product/technology has its own unspecified value. Freeze1 per ordinary eligible product and2 per plus item; technology gives1 per item. This is a documented approximation.

Sources: [Scrap rev1655](https://wiki.idlecorp.xyz/index.php/Scrap), [Asset+ rev1636](https://wiki.idlecorp.xyz/index.php/Asset%2B), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## refunds — documented

Land/facility refunds40% historical paid cost, inventories current NPC sell valuation. Net worth counts capital, assets, developed tech and depreciated historical property value. Demolition returns40% property value per Liquidation page.

Sources: [Liquidation rev1330](https://wiki.idlecorp.xyz/index.php/Liquidation), [Land rev1606](https://wiki.idlecorp.xyz/index.php/Land), [FAQ rev1595](https://wiki.idlecorp.xyz/index.php/FAQ)

## prestige — documented

Score floor(net worth/$1B), tokens capped10/15/20/25 by tier;1000 passXP/token.24h cooldown reduced to2h with regional computer and>=4 installed technologies. Discount2%/token max80%,4land/token,4tokens/slot,12tokens/wildcard blueprint.

Sources: [Reincorporation rev1153](https://wiki.idlecorp.xyz/index.php/Reincorporation), [Reincorporation computer rev1096](https://wiki.idlecorp.xyz/index.php/Reincorporation_computer), [Updates log rev1573](https://wiki.idlecorp.xyz/index.php/Updates_log)

## governance — documented

Shared service funding; region office enables elections.15 base funding points, policy costs from detail pages,24h per-policy toggle cooldown. Candidate fee$10M, weekly term, boon required to stand/vote, ties elect nobody.

Sources: [Funding point rev1525](https://wiki.idlecorp.xyz/index.php/Funding_point), [Regional legislator rev1569](https://wiki.idlecorp.xyz/index.php/Regional_legislator), [Category:Policy rev1523](https://wiki.idlecorp.xyz/index.php/Category%3APolicy), [FAQ rev1595](https://wiki.idlecorp.xyz/index.php/FAQ)

## safety_bounds — intentional_adaptation

No arbitrary offline time cap.2000 facilities/region, safe-integer balances and finite vault are explicit implementation bounds. Event processing must preserve chronological resource consumption across downtime. Wiki itself documents unlimited inventory capacity.

Sources: [FAQ rev1595](https://wiki.idlecorp.xyz/index.php/FAQ)

## standalone_extra_rewards — intentional_adaptation

Standalone daily reward grants$500,1gratitude and50XP; weekly reward adds$5000,1gratitude and200XP plus the documented entitlement tokens; each pass-level claim adds$1000*level alongside its documented modifier; each completed daily challenge grants$1000 alongside documented100/150XP. These extra liquid rewards are configurable remake convenience sources, not original wiki rewards. The undocumented gratitude cash/blueprint/coordinate shop was removed.

Sources: [Season rev1339](https://wiki.idlecorp.xyz/index.php/Season), [Season pass rev1325](https://wiki.idlecorp.xyz/index.php/Season_pass), [Premium rev1619](https://wiki.idlecorp.xyz/index.php/Premium), [Voting rev1516](https://wiki.idlecorp.xyz/index.php/Voting)

## blueprint_regional_assets — documented

Blueprints are held in each region and represented by blueprint_<technology> inventory assets, synchronized with the region research view. Research, token wildcard awards, export arrivals, gifts, NPC sale and development must update one inventory-backed quantity. They can be exported and sold to NPC at a$4M base quote but are excluded from player orders.

Sources: [Blueprint rev1692](https://wiki.idlecorp.xyz/index.php/Blueprint), [Newcomer guide rev1610](https://wiki.idlecorp.xyz/index.php/Newcomer_guide)
