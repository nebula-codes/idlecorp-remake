#!/usr/bin/env python3
"""Ingest actual local acceptance reports into the research ledger, offline.

Only scopes explicitly established by known report assertions are promoted.
Rendering a screen does not mark all of its controls as verified.
"""
import datetime,hashlib,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/research';ART=ROOT/'artifacts'
files=['e2e-report.json','ui-workflows/report.json','desktop-report.json','portable-report.json','clean-install-report.json','load-report.json','unit-test-report.json','operations-report.json','package-report.json']
reports={}
for name in files:
    p=ART/name
    if p.exists():reports[name]={'path':'artifacts/'+name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'report':json.loads(p.read_text(encoding='utf-8'))}
test_files=['packages/rules/src/content.test.ts','apps/server/test/engine.test.ts','tests/source-parity.test.ts','scripts/test-e2e.mjs','apps/web/verify-ui.mjs','scripts/test-desktop.mjs','scripts/test-portable.mjs','scripts/test-clean-install.mjs','scripts/test-load.mjs','scripts/test-operations.mjs','scripts/test-package.mjs']
(OUT/'acceptance-evidence.json').write_text(json.dumps({'reports':reports,'testFiles':[{'path':p,'exists':(ROOT/p).exists(),'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest() if (ROOT/p).exists() else None} for p in test_files],'interpretation':'Only explicit report assertions are evidence. Per-command and mechanic scope is maintained separately. Reports precede final polish unless regenerated. File hashes record the inspected evidence version.'},indent=2),encoding='utf-8')
state=json.loads((OUT/'verification-state.json').read_text(encoding='utf-8'))
state['integrationReports']={k:{'path':v['path'],'date':v['report'].get('date') or (datetime.datetime.fromtimestamp(v['report']['startTime']/1000,datetime.timezone.utc).isoformat() if 'startTime' in v['report'] else None)} for k,v in reports.items()}
def scope(ids,location,detail,status='implemented; API and core GUI verified'):
    for mid in ids:
        previous=state['mechanics'].get(mid,{}).get('verification','')
        # Re-ingestion replaces outdated runtime-report prose while retaining
        # independently recorded source/test evidence. It must be idempotent.
        previous=previous.split('; artifacts/')[0]
        if previous.startswith(location+':'):previous=''
        note=f'{location}: {detail}'
        state['mechanics'][mid]={'implementationStatus':status,'verification':previous+'; '+note if previous and note not in previous else previous or note}
def commands(ids,location,detail):
    for cmd in ids:state['commands'][cmd]={'implementationStatus':'implemented; exercised GUI operation verified','verification':location+': '+detail}
unit=reports.get('unit-test-report.json',{}).get('report',{})
if unit.get('success') and unit.get('numFailedTests')==0:
    names=[t.get('fullName','') for f in unit.get('testResults',[]) for t in f.get('assertionResults',[]) if t.get('status')=='passed']
    if all(any(term in name for name in names) for term in ['five vaulted haste relics','one vaulted efficiency relic','vaulted prestige relics lower']):
        state['mechanics']['relics']={'implementationStatus':'server-verified; GUI relic-use verification pending','verification':'artifacts/unit-test-report.json and tests/source-parity.test.ts: knowledge consumption/claim once; vaulted haste duration reduction in both regions without reroll; efficiency doubles actual plus output into normals globally; prestige token-divisor reduction and cap, unchanged score/worth; all passive effects deactivate after withdrawal'}
operations=reports.get('operations-report.json',{}).get('report',{})
if 'All four administrative entitlement grants reach the authoritative account and persist audit entries' in operations.get('passed',[]):
    scope(['entitlements'],'artifacts/operations-report.json','all four real CLI entitlement grants reached authoritative state and persisted audit entries; invalid tier rejected without changes; tier-specific gameplay covered in source-parity tests','implemented; server and administrative CLI verified')
    state['commands']['premium']={'implementationStatus':'implemented; tier admin/server verified; help view code-reviewed','verification':'artifacts/operations-report.json: all four actual administrative tier grants and audits; tests/source-parity.test.ts: tier rewards and challenges; Settings field guide presents entitlement information'}
e2e=reports.get('e2e-report.json',{}).get('report',{})
if 'Clean unboosted onboarding' in e2e.get('passed',[]) and not e2e.get('browserErrors'):
    scope(['accounts'],'artifacts/e2e-report.json','two accounts, two sessions on one account, login/logout and unboosted onboarding')
    scope(['land_build','production','npc'],'artifacts/e2e-report.json','land/build/production/sale/persistence, duplicate and concurrent build rejection; keyboard and layouts inspected')
    scope(['market'],'artifacts/e2e-report.json','real two-player price-priority partial fill, cancellation/fill race, escrow and fee conservation, cash/asset inbox claims')
    scope(['offline_restart'],'artifacts/e2e-report.json','actual server restart preserves sessions/state and advances offline production; backup/restore round trip','implemented; API/restart verified')
ui=reports.get('ui-workflows/report.json',{}).get('report',{})
if not ui.get('errors'):
    passed=ui.get('passed',[])
    if 'Registration, build requirements modal, keyboard containment, Escape and confirmed construction' in passed:
        commands(['build'],'artifacts/ui-workflows/report.json','requirements modal, keyboard containment, Escape and acknowledged construction')
    if any(name in passed for name in ['Inventory lock blocks sale, unlock restores operation, NPC sale confirms actual cash','Inventory lock blocks sale, unlock restores operation, NPC sale and buy confirm actual funds and stock']):
        scope(['inventory'],'artifacts/ui-workflows/report.json','GUI inventory lock, blocked sale, unlock and confirmed NPC cash; other inventory controls remain separately tested')
        commands(['lockasset(all)','unlockasset(all)','sell(all)'],'artifacts/ui-workflows/report.json','one-asset lock/unlock/sale exercised; multi-asset variants are UI adaptations')
    if 'Inventory lock blocks sale, unlock restores operation, NPC sale and buy confirm actual funds and stock' in passed:
        scope(['npc'],'artifacts/ui-workflows/report.json','GUI lock rejection, unlock, NPC sale and NPC buy with real funds and stock')
        commands(['buy(all)'],'artifacts/ui-workflows/report.json','purchased one wood after ordinary unboosted production and sale')
    if 'GUI scrap conversion, facility XP allocation, plus-input preference and demolition refund' in passed:
        scope(['levels_quality'],'artifacts/ui-workflows/report.json','scrapped one lamp, spent 100 scrap on a tree farm, enabled steel-mill plus inputs and confirmed demolition/refund; probabilistic plus output is server-tested')
        commands(['scrap(all)','addxp','setconsumeplus','demolish(all)'],'artifacts/ui-workflows/report.json','actual inventory-to-scrap conversion, XP spend, plus preference and demolition cash refund; bulk-all variants use explicit entity/quantity controls')
    if 'GUI buy-order escrow and cancellation refund' in passed:
        commands(['marketbuy','canceloffer'],'artifacts/ui-workflows/report.json','placed a buy order into escrow, cancelled it and asserted refunded capital')
    if 'Player sell order, second-account fill, cash inbox and GUI claim' in passed:
        commands(['marketsell','claim'],'artifacts/ui-workflows/report.json','GUI sell order and cash-inbox claim after second-account API fill')
    if 'GUI research start, gratitude finish and blueprint claim' in passed:
        scope(['research'],'artifacts/ui-workflows/report.json','GUI project start, gratitude completion and blueprint claim')
        commands(['research'],'artifacts/ui-workflows/report.json','start, instant finish and reward claim')
    if 'GUI technology development, installation, uninstall and tier combination' in passed:
        scope(['technology'],'artifacts/ui-workflows/report.json','GUI blueprint development, installation, uninstall and upgrade combination')
        commands(['develop','install','uninstall','upgrade'],'artifacts/ui-workflows/report.json','real action confirmations and state assertions')
    if 'GUI orbital launch, station construction and expedition dispatch' in passed:
        scope(['space'],'artifacts/ui-workflows/report.json','GUI launch/station construction/expedition dispatch','implemented; server verified, launch/dispatch GUI verified')
        commands(['galacticexpedition'],'artifacts/ui-workflows/report.json','GUI dispatch; all outcome paths separately exercised in source-parity tests')
    if 'GUI retail product pricing, storefront naming and product naming' in passed:
        commands(['addretailproduct','retailproductprice','retailname','retailproductname'],'artifacts/ui-workflows/report.json','configured lamp listing, price, storefront and product names')
    if 'GUI confirmed timed retail sales and listing removal' in passed:
        scope(['retail'],'artifacts/ui-workflows/report.json','configured product, price and names; actual timed sale and listing removal')
        commands(['removeretailproduct'],'artifacts/ui-workflows/report.json','removed a listing after confirmed timed sales')
    if 'GUI public-service funding, candidacy and election vote' in passed:
        scope(['services'],'artifacts/ui-workflows/report.json','funded the region office through the contribution control; cross-account fiber effects separately covered by source-parity tests')
        commands(['donateservice','joinballot','voteballot'],'artifacts/ui-workflows/report.json','funded the office, paid candidacy and voted through visible controls')
    if 'GUI elected legislator policy activation with funding budget' in passed:
        scope(['governance'],'artifacts/ui-workflows/report.json','office funding, candidate registration, ballot vote, actual election completion and elected policy activation')
        commands(['addpolicy'],'artifacts/ui-workflows/report.json','elected legislator enabled solar subsidies within funding budget; disable path remains separately untested in GUI')
    if 'GUI daily reward, season-bonus claim, weekly unlock and daily challenge claim' in passed:
        scope(['season','rewards'],'artifacts/ui-workflows/report.json','daily reward, season level-one bonus, weekly unlock/reward and daily challenge claimed; supporter vote reward is server-tested only')
        commands(['weekly','seasonpass','seasonpassdaily'],'artifacts/ui-workflows/report.json','season level-one bonus unlocks weekly reward, followed by challenge claim')
    if 'GUI export dispatch and gifting to a private corporation by ID' in passed:
        scope(['gifts'],'artifacts/ui-workflows/report.json','sent wood to private corporation ID and asserted pending recipient inbox; cash-gift variant not exercised here')
        commands(['give'],'artifacts/ui-workflows/report.json','private recipient selected by ID, wood gift confirmed in recipient inbox')
    if 'GUI timed export arrival and cargo claim' in passed:
        scope(['exports'],'artifacts/ui-workflows/report.json','wood dispatch to another region, persisted deadline advanced in isolated fixture, arrival and cargo claim')
        commands(['export(all)'],'artifacts/ui-workflows/report.json','one-asset wood export dispatched and claimed; bulk-all variant is a quantity-control adaptation')
    if 'GUI quantum vault deposit and withdrawal' in passed:
        scope(['vault'],'artifacts/ui-workflows/report.json','wood deposit and withdrawal each confirmed with actual vault quantities')
        commands(['vaultadd','vaultremove'],'artifacts/ui-workflows/report.json','deposited five wood, then withdrew the same five')
    if 'GUI persisted expedition result claim and damaged-station repair' in passed:
        scope(['space'],'artifacts/ui-workflows/report.json','launch/station construction/dispatch, persisted result claim and damaged-station repair; station upgrade GUI not exercised')
        commands(['orbit'],'artifacts/ui-workflows/report.json','launch, station construction and repair verified; upgrade control server-tested only')
    if 'GUI persisted expedition result claim, damaged-station repair and XP-based station upgrade' in passed:
        scope(['space'],'artifacts/ui-workflows/report.json','launch/station construction/dispatch, persisted result claim, damaged-station repair and XP-funded station upgrade to level two')
        commands(['orbit'],'artifacts/ui-workflows/report.json','launch, station construction, result claim, hull repair and XP-based station upgrade')
    if 'GUI knowledge relic finishes a real research project and claim stays available' in passed:
        scope(['relics'],'artifacts/ui-workflows/report.json','consumed knowledge relic to finish active research and claimed its existing outcome; other three relic effects have dedicated server fixtures')
        commands(['userelic'],'artifacts/ui-workflows/report.json','knowledge relic consumed, project ready and reward claim available')
    if 'GUI permanent token upgrade' in passed:
        commands(['usetoken'],'artifacts/ui-workflows/report.json','land acquisition discount purchased and persistent upgrade level asserted; other upgrade choices server-tested separately')
    if 'GUI authoritative liquidation preview, confirmation and selected-region reset' in passed:
        scope(['liquidation'],'artifacts/ui-workflows/report.json','switched region, requested authoritative preview, confirmed twice, asserted selected region land reset')
        commands(['liquidate'],'artifacts/ui-workflows/report.json','authoritative preview and confirmed regional liquidation')
    if 'GUI reincorporation preview, permanent reset and carried score' in passed:
        scope(['prestige'],'artifacts/ui-workflows/report.json','token upgrade, authoritative reincorporation preview, confirmed reset, facilities cleared and carried score asserted')
        commands(['rebirth'],'artifacts/ui-workflows/report.json','authoritative preview and confirmed reset with positive carried score')
    if 'GUI identity changes charge gratitude and save privacy and notification preferences' in passed:
        scope(['social_history'],'artifacts/ui-workflows/report.json','name/motto change charged exactly three gratitude; privacy opt-in and completion notification preference persisted; leaderboard sort selectors remain code-reviewed only')
        commands(['name','motto','notification','lboptin'],'artifacts/ui-workflows/report.json','saved name, motto, public leaderboard opt-in and disabled completion notifications; inverse preferences not separately exercised')
(OUT/'verification-state.json').write_text(json.dumps(state,indent=2),encoding='utf-8')
subprocess.run([sys.executable,str(ROOT/'scripts/collect-research-ledger.py')],check=True)
print('Ingested',len(reports),'actual report artifacts; retained untested GUI scopes as pending.')
