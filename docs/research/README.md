# Pinned public-wiki evidence

Ruleset: `2026.10-remake.1`. The gameplay corpus was retrieved on **2026-10-09** from [IdleCorp Wiki](https://wiki.idlecorp.xyz/index.php/Main_Page). Public documentation is incomplete and sometimes contradictory. This project does not claim access to the private original backend.

## Reproduce

From the repository root, with Python 3.11+ and no third-party Python dependencies:

```powershell
python scripts/collect-wiki.py
python scripts/collect-content.py
python scripts/collect-icons.py
python scripts/collect-research-ledger.py
python scripts/collect-verification.py
npx vitest run packages/rules/src/content.test.ts
```

`collect-wiki.py --refresh` intentionally fetches a new snapshot. Without it, cached responses are reused. Normal builds and gameplay never fetch the wiki. The ledger generator preserves separately recorded acceptance evidence from `verification-state.json`; refresh that file after code or rules change.

The wiki collector obeys robots access rules, waits at least350ms between requests, retries at most4times with bounded backoff, enumerates namespaces0(game pages),10(templates),12(game help),14(categories), follows API continuation, stores redirects, renders transclusions, and separately enumerates every category's members. Namespace-zero spam and unrelated community utility pages are listed with exclusion reasons before fetching. User/account pages and unrelated external websites are excluded. Canonical links to nonexistent pages are retained in `missing-linked-pages.json` rather than invented.

## Files

| File | Purpose |
|---|---|
| `inventory.json` | All enumerated titles, scope decision and reason |
| `snapshot.json` |196 page records, revision IDs/dates, redirects, templates, rendered links |
| `pages/*.json` |196 distinct normalized wikitext and rendered game-content records; collision-safe filenames |
| `cache/*.json` | Verbatim HTTP response cache with retrieval timestamp and URL |
| `category-members.json` | Paginated category membership evidence |
| `missing-linked-pages.json` |11 missing coordinate/parts page names, including singular/plural aliases |
| `decisions.json`, `DECISIONS.md` |28 explicit conflict/estimate/adaptation decisions |
| `facility-comparison.json` | Detail-versus-summary comparison, including harmless ordering differences |
| `coverage-matrix.json`, `COVERAGE.md` |28 mechanic groups; evidence status separate from implementation and verification |
| `command-mapping.json` |77 unique original commands, aliases and GUI/action mapping |
| `verification-state.json`, `acceptance-evidence.json`, `ACCEPTANCE.md` |Separately recorded server/GUI/integration evidence, exact report bodies and inspected test-file hashes; unexercised variants stay pending |
| `ui-control-audit.json` |Final code review of all77 command equivalents and explicit UI adaptations, independent of runtime test evidence |
| `icon-discovery.json` | API/site statistics/rendered HTML/wikitext/template/CSS audit |
| `icon-manifest.json` |200 local entity icons, hash/dimensions/original-replacement status/provenance |

## Imported content

The shared rules package contains134 asset variants (including quality, regional blueprints and developed technology tiers),44 land facilities,18 technologies,7 services,9 policies,3 original server-managed regions, research reward pools, six challenge definitions, ten pass reward levels, four entitlement tiers, and five expedition difficulties. Orbital station construction is a separate space action in `rules.space.station`, not a land-consuming production building.

Specific facility pages supplement summary tables. The catalog includes truck factories, air traffic control, space-station parts factories, and rocket launch pads. Recipe/cost data is numeric and validated; the parser correctly recognizes compact times such as `4m20s`, quantity forms without `x`, and multi-line infobox entries. Blueprint and technology inventory are distinct concepts; developed technology is a transferable material used in some construction bills.

## Asset provenance

The renewed audit found an empty API `allimages`, zero uploaded images in site statistics, no page image titles, and zero game-artwork candidates in all196 rendered pages. Transcluded templates and source wikitext were checked; MediaWiki stylesheet images were classified as site decoration. No game images were downloaded. `imageinfo` had no file titles to query. This is evidence for this snapshot, not a claim that original artwork exists nowhere.

Every missing icon has an original local SVG replacement. These are industrial pictograms, with meaningful resource symbols, factory silhouettes, quality badges, coordinate ranks, and technology tier indicators. Replacements are explicitly marked `replaced`; source artwork licensing is left unknown rather than invented. The artwork was created for this project and is not represented as scraped IdleCorp artwork. All paths are local; no runtime image hotlinks are needed. Content hashes make duplicate originals detectable if future crawls discover them.

## Source uncertainty and acceptance

`DECISIONS.md` is the mechanic specification for the selected interpretation. Original update entries resolve research reward changes, research duration, logistics budget, regional modifier periods, prestige cooldown, and market fees. Specific-page values are selected where an unresolved summary conflict remains; those choices are recorded rather than claimed exact. Approximate land, population, retail demand, export fuel, space progress and prize amounts remain configurable remake rules.

The content test suite verifies structural references, positive recipes and timers, source IDs, icon coverage, representative documented examples, quality leveling, normalized research rewards, and stable approximation examples. Gameplay implementation and multiplayer/GUI acceptance are owned by the server and integration suites. The ledger never equates a mapped command with a tested workflow.
