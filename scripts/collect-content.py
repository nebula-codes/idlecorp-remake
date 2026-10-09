#!/usr/bin/env python3
"""Build validated rules content from the pinned collect-wiki snapshot (offline).
Does not fetch network. Every override is recorded in research/decisions.json.
"""
import json,pathlib,re,html
ROOT=pathlib.Path(__file__).resolve().parents[1]; RESEARCH=ROOT/'docs/research'; TARGET=ROOT/'packages/rules/src'; TARGET.mkdir(parents=True,exist_ok=True)
pages={}
for f in (RESEARCH/'cache').glob('*.json'):
    d=json.loads(f.read_text(encoding='utf-8'))
    if 'prop=revisions' not in d['url']: continue
    for p in json.loads(d['body']).get('query',{}).get('pages',[]):
        rev=p.get('revisions',[{}])[0]
        pages[p['title'].lower()]={'title':p['title'],'wikitext':rev.get('slots',{}).get('main',{}).get('content',''),'revisionId':rev.get('revid'),'retrievedAt':d['retrievedAt'],'url':'https://wiki.idlecorp.xyz/index.php/'+p['title'].replace(' ','_')}
def id(s): return re.sub('[^a-z0-9]+','_',s.lower().replace('+','_plus')).strip('_')
def clean(s):
    s=re.sub(r'\[\[([^]|]+)\|([^]]+)\]\]',r'\2',s);s=re.sub(r'\[\[([^]]+)\]\]',r'\1',s)
    return html.unescape(re.sub(r'<[^>]*>|\{\{[^}]*\}\}|\'{2,}|data-sort-value="[^"]+"\s*\|','',s)).strip()
def src(p): return {k:p[k] for k in ('url','revisionId','retrievedAt')}
def field(w,k):
    m=re.search(r'\|\s*(?:\'\'\')?'+re.escape(k)+r'(?:\'\'\')?\s*\|\|(.*?)(?=\n\|-|\n\|\})',w,re.I|re.S)
    return m.group(1).strip() if m else ''
def money(s):
    m=re.search(r'\$([\d,]+(?:\.\d+)?)',s);return round(float(m.group(1).replace(',',''))*100) if m else 0
def quantities(s):
    result={}
    for amount,name,plus in re.findall(r'([\d,]+)\s*x?\s*\[\[([^]|]+)(?:\|[^]]+)?\]\](\+?)',s,re.I): result[id(name+plus)]=int(amount.replace(',',''))
    return result
def duration(s):
    if 'Variable' in s:return 30
    m=re.search(r'(\d+):(\d+)',s)
    if m:return int(m[1])*60+int(m[2])
    total=sum(float(n)*({'s':1,'m':60,'h':3600}[u[0].lower()]) for n,u in re.findall(r'(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?|sec|min|hrs?|s|m|h)',s,re.I))
    return int(total) or 0
def table_rows(w): return [x.split('||') for x in re.findall(r'\n\|-\s*\n\|([^\n]+)',w)]
assets=[]; facilities=[]; technologies=[]; services=[]; policies=[]; decisions=[]
asset_page=pages['category:asset']; facility_page=pages['category:facility']
retail={'lamp','clothing','furniture','bicycle','prescription_drug','cell_phone','laptop','digital_camera','television','car'}
for row in table_rows(asset_page['wikitext'].split('==Technology==')[0]):
    links=re.findall(r'\[\[([^]|]+)',row[0]);
    if not links: continue
    aid=id(links[0]); price=money(row[1])
    if aid in ('land','scrap'):continue
    p=pages.get(links[0].lower(),asset_page)
    assets.append({'id':aid,'name':links[0],'category':'product' if aid in retail else 'space' if aid in ('rocket','rocket_fuel') else 'material','price':price,'npcBuy':aid not in retail and aid not in ('rocket','rocket_fuel'),'npcSell':aid!='rocket','retail':aid in retail,'scrappable':aid in retail,'qualityEligible':aid not in ('rocket','rocket_fuel'),'description':f"{'Consumer product' if aid in retail else 'Production resource'} used in the regional economy.",'icon':f'/icons/{aid}.svg','source':src(p)})
for row in table_rows(facility_page['wikitext']):
    if len(row)<6: continue
    names=re.findall(r'\[\[([^]|]+)',row[0]);
    if not names: continue
    title=names[0]; p=pages.get(title.lower(),facility_page);w=p['wikitext']
    cost=field(w,'Cost') or row[1];inp=field(w,'Inputs') or row[2];out=field(w,'Outputs') or row[3]
    fid=id(title);is_special=fid in ('research_facility','retail_store','logistics_center','customer_support_center','hq')
    outputs={} if is_special else quantities(out)
    if money(out) and not is_special:outputs['cash']=money(out)
    requires={'airport':['global:air_traffic_control'],'retail_store':['global:hq'],'customer_support_center':['global:hq']}.get(fid,[])
    facilities.append({'id':fid,'name':title,'category':'research' if fid=='research_facility' else 'retail' if fid in ('retail_store','hq','customer_support_center') else 'logistics' if fid in ('logistics_center','airport') else 'extraction' if 'mine' in fid else 'agriculture' if 'farm' in fid else 'energy' if 'power_plant' in fid else 'manufacturing','cost':money(cost),'materials':quantities(cost),'inputs':{} if is_special else quantities(inp),'outputs':outputs,'cycleSeconds':0 if is_special else duration(field(w,'Production interval') or row[5]),'xp':0 if is_special else 1,'land':1,'requires':requires,'description':f"{clean(inp)} → {clean(out)}" if outputs else {'research_facility':'Starts research projects; maximum eight in one region.','retail_store':'Sells selected consumer goods every ten minutes.','logistics_center':'Unlocks player trading, exports, and increases hourly NPC purchases.','customer_support_center':'Improves retail customer support.','hq':'One global headquarters unlocks retail operations.'}.get(fid,'Special corporation facility.'),'icon':f'/icons/{fid}.svg','source':src(p)})
# Category tables omit these linked and individually documented facilities.
for title in ('Truck factory','Air traffic control','Space station parts factory','Rocket launch pad'):
    p=pages[title.lower()];w=p['wikitext'];fid=id(title);cost=field(w,'Cost');out=field(w,'Outputs')
    f={'id':fid,'name':title,'category':'space' if fid in ('space_station_parts_factory','rocket_launch_pad') else 'logistics','cost':money(cost),'materials':quantities(cost),'inputs':quantities(field(w,'Inputs')),'outputs':quantities(out),'cycleSeconds':duration(field(w,'Production interval')),'xp':1 if out else 0,'land':1,'requires':[],'description':clean(re.sub(r'\{\|.*?\|\}','',w,flags=re.S)).split('[[Category')[0][:300],'icon':f'/icons/{fid}.svg','source':src(p)}
    if fid=='rocket_launch_pad':f.update(cost=2200000000,materials={'rubber':4000000,'steel':5000000,'scrap':22000000},description='Allows launch into orbit and construction of a space station.')
    facilities.append(f)
# Spaceship construction is a separate orbital action, not a land production recipe.
space_station={'id':'space_station','name':'Space station','category':'space','cost':0,'materials':{'space_station_parts':10000,'rocket_fuel':1000},'requires':['rocket_launch_pad'],'icon':'/icons/space_station.svg','source':src(pages['space station']),'evidenceStatus':'estimate','description':'Orbital home for expeditions and the quantum vault; exact construction amounts are a configurable remake rule.'}
blueprint=pages['blueprint']
effects={
 'oil_mapping':{'facility':'oil_well','output':'crude_oil','outputAmounts':[14,18,100]},
 'coal_detector':{'facility':'coal_mine','output':'coal','outputAmounts':[12,16,80]},
 'log_loader':{'facility':'tree_farm','cycleReductions':[1,2,4]},
 'advanced_woodworking':{'facility':'furniture_factory','cycleReductions':[40,80,210]},
 'bauxite_detector':{'facility':'bauxite_mine','output':'bauxite','outputAmounts':[50,60]},
 'jet_fuel_refining':{'facility':'oil_refinery','outputReplace':'jet_fuel','cycleReductions':[0,22]},
 'gold_detector':{'facility':'gold_mine','output':'gold','outputAmounts':[6,8,10]},
 'vacuum_distillation':{'facility':'oil_refinery','cycleReductions':[15,22]},
 'robotic_automation':{'facility':'all','speedBonuses':[0.025,0.04,0.06]},
 'factory_specialization':{'facility':'factory','levelBonuses':[4]},
 'mining_specialization':{'facility':'mine','levelBonuses':[4]},
 'oil_specialization':{'facility':'oil_well','levelBonuses':[4]},
 'energy_specialization':{'facility':'power_plant','levelBonuses':[4]},
 'logistics_expansion':{'facility':'logistics_center','buyLimits':[400000000,500000000]},
 'airport_tram':{'facility':'airport','cycleReductions':[4,8]},
 'quality_control':{'facility':'all','levelBonuses':[2,4]},
 'reincorporation_computer':{'facility':'global','prestigeCooldownSeconds':7200,'requiresInstalled':4},
 'quantum_stabilization':{'facility':'global','vaultRetention':0.75}}
for row in table_rows(blueprint['wikitext']):
    if len(row)<7:continue
    name=clean(row[0]);tid=id(name);p=pages.get(name.lower(),blueprint);effect=effects[tid]
    levels=1+int('N/A' not in row[5])+int('N/A' not in row[6]);materials=quantities(row[3])
    technologies.append({'id':tid,'name':name,'rarity':clean(row[1]).lower(),'category':'technology','cost':0,'materials':materials,'installCost':50000000,'maxTier':levels,'upgradeCount':3,'effect':effect,'description':f"Base: {clean(row[4])}; upgraded: {clean(row[5])}; second upgrade: {clean(row[6])}.",'icon':f'/icons/{tid}.svg','source':src(p),'stackable':tid in ('robotic_automation','airport_tram','quality_control')})
service_effects={'small_park':{'happiness':1},'medium_park':{'happiness':2},'large_park':{'happiness':3},'university':{'researchSeconds':-600},'region_office':{'governance':True},'land_management_office':{'landDiscount':0.05},'fiber_infrastructure':{'levels':5}}
for p in pages.values():
    if '[[Category:Service]]' not in p['wikitext']:continue
    sid=id(p['title']);services.append({'id':sid,'name':p['title'],'cost':money(field(p['wikitext'],'Cost')),'description':clean(field(p['wikitext'],'Effect')),'effect':service_effects.get(sid,{}),'icon':f'/icons/{sid}.svg','source':src(p)})
policy_effects={'solar_subsidies':{'solarBuildMultiplier':0.9,'energyPriceMultiplier':0.9},'public_logistics_access':{'publicLogistics':True,'buildMultiplier':1.1},'regional_planning':{'buildMultiplier':0.75,'landMultiplier':1.05},'tourism_campaign':{'airportSeconds':-4,'airportFuel':4},'low_income_tax':{'happiness':2},'research_grant':{'researchSeconds':-600,'energyPriceMultiplier':1.1},'organic_farming':{'soil':0.1,'farmBuildMultiplier':1.1},'high_income_tax':{'happiness':-5,'fundingPoints':5},'land_grant':{'landMultiplier':0.95,'buildMultiplier':1.25}}
for pid,effect in policy_effects.items():
    p=pages[pid.replace('_',' ')];costtext=clean(field(p['wikitext'],'Cost'));policies.append({'id':pid,'name':p['title'],'description':clean(field(p['wikitext'],'Effect')),'effect':effect,'fundingCost':int(re.search(r'\d+',costtext)[0]) if re.search(r'\d+',costtext) else 1,'cooldownSeconds':86400,'icon':f'/icons/{pid}.svg','source':src(p)})
known={a['id'] for a in assets}
specials=[('scrap',0,'progression'),('truck',2900000,'logistics'),('space_station_parts',12000000,'space')]+[(f'galactic_coordinate_{x}',0,'space') for x in ('i','ii','iii','iv','v')]+[(f'relic_of_{x}',0,'relic') for x in ('haste','efficiency','knowledge','prestige')]
for aid,price,cat in specials:
    p=pages.get(aid.replace('_',' '),pages.get('galactic coordinate' if 'coordinate' in aid else 'galactic expedition'))
    assets.append({'id':aid,'name':aid.replace('_',' ').title(),'category':cat,'price':price,'npcBuy':False,'npcSell':False,'retail':False,'scrappable':aid=='truck','qualityEligible':aid in ('truck','space_station_parts'),'icon':f'/icons/{aid}.svg','source':src(p),'description':'Special progression resource.','evidenceStatus':'estimate' if aid in ('truck','space_station_parts') else 'documented'})
# Technologies are transferable inventory items as documented in the guide.
prices={a['id']:a['price'] for a in assets}
for t in technologies:
    for tier in range(1,t['maxTier']+1):
        aid=t['id']+('_'+'u'*(tier-1) if tier>1 else '')
        assets.append({'id':aid,'name':t['name']+(' '+'u'*(tier-1) if tier>1 else ''),'category':'technology','price':sum(prices[k]*v for k,v in t['materials'].items())*3**(tier-1),'npcBuy':False,'npcSell':False,'retail':False,'scrappable':True,'qualityEligible':False,'technologyId':t['id'],'tier':tier,'icon':f'/icons/{aid}.svg','source':t['source'],'description':t['description']})
for base in list(assets):
    if base.get('qualityEligible'):
        aid=base['id']+'_plus';assets.append({**base,'id':aid,'name':base['name']+'+','price':base['price']*2,'npcBuy':False,'qualityEligible':False,'baseAsset':base['id'],'quality':True,'icon':f'/icons/{aid}.svg'})
for t in technologies:
    aid='blueprint_'+t['id'];assets.append({'id':aid,'name':t['name']+' blueprint','category':'blueprint','blueprintTechnologyId':t['id'],'price':400000000,'npcBuy':False,'npcSell':True,'tradeable':False,'retail':False,'scrappable':False,'qualityEligible':False,'icon':f'/icons/{aid}.svg','source':src(pages['newcomer guide']),'description':'Regional research blueprint. Can be developed, exported, or sold to the NPC for its regional quote; cannot be traded on the player exchange.'})
regions=[{'id':'verdant','name':'Verdant Basin','description':'Fertile agricultural region with healthy soil and modest mineral yields.','modifiers':{'soil':1.2,'oil':0.95,'minerals':0.9,'industry':1,'solar':1.05},'population':250000,'happiness':0,'icon':'/icons/verdant.svg'}, {'id':'ironridge','name':'Ironridge','description':'A mineral rich industrial region with productive mines.','modifiers':{'soil':0.9,'oil':1,'minerals':1.25,'industry':1.1,'solar':0.95},'population':0,'happiness':0,'icon':'/icons/ironridge.svg'}, {'id':'suncoast','name':'Suncoast','description':'Strong solar output, oil reserves, and coastal manufacturing.','modifiers':{'soil':1,'oil':1.2,'minerals':0.95,'industry':1,'solar':1.25},'population':0,'happiness':0,'icon':'/icons/suncoast.svg'}]
rules={'version':'2026.10-remake.1','currency':'USD cents','moneyScale':100,'starterCash':100000,'starterLand':10,'maxSafeInteger':9007199254740991,'facilityXpPerLevel':100000,'maxFacilityLevel':50,'plusChancePerLevel':0.005,'plusInputChanceBonus':0.25,'npcBuyMultiplier':2,'baseHourlyBuyLimit':100000000,'logisticsHourlyBuyLimit':200000000,'priceRefreshSeconds':3600,'regionModifierSeconds':172800,'landBaseCost':60000,'landGrowth':1.0961757,'liquidationRefund':0.4,'technologyInstallCost':50000000,'baseTechnologySlots':3,'maxBonusTechnologySlots':6,'research':{'cash':100000000,'energy':1000000,'extraPlusEnergy':500000,'extraAfter':6,'maxFacilities':8,'minimumSeconds':7200,'maximumSeconds':10800,'rarities':{'common':0.55,'uncommon':0.37,'rare':0.07,'superior':0.01}},'export':{'maxDispatches':3,'normalSeconds':1800,'plusSeconds':900,'fuelValueRatio':0.2},'retail':{'slots':3,'cycleSeconds':600,'supportStores':5,'plusPriceMultiplier':4,'baseDemandPerStore':10,'populationScale':250000},'prestige':{'scoreDivisor':100000000000,'cooldownSeconds':86400,'tokenCaps':{'free':10,'plus':15,'gold':20,'platinum':25},'xpPerToken':1000,'landPerToken':4,'landDiscountPerToken':0.02,'maxLandDiscountTokens':40,'techSlotTokens':4,'blueprintTokens':12},'governance':{'electionSeconds':604800,'candidateCost':1000000000,'baseFundingPoints':10,'policyCooldownSeconds':86400},'vote':{'cooldownSeconds':43200,'boonSeconds':43200,'cash':100000,'gratitude':1,'seasonXp':200,'speedBonus':0.25,'buyLimitBonus':0.1},'season':{'id':'founders_2026','startsAt':'2026-10-01T00:00:00Z','endsAt':'2027-01-01T00:00:00Z','xpThresholds':[250,500,1000,2500,5000,10000,25000,50000,100000,250000]},'space':{'station':space_station,'expeditions':[{'difficulty':i,'coordinateId':'galactic_coordinate_'+['i','ii','iii','iv','v'][i-1],'rocket':1,'fuel':100*i,'baseSuccess':1-i*0.2,'failureDamage':100*i,'durationSeconds':3600*i,'xp':100*i} for i in range(1,6)],'vaultRetention':0.5,'stabilizedVaultRetention':0.75,'levelSuccessBonus':0.05,'maxStationLevel':20,'launchFuel':100,'stationParts':10000,'stationFuel':1000}}
rules['plusInputChanceBonus']=1
rules['maxBonusTechnologySlots']=3
rules['governance']['baseFundingPoints']=15
rules['remake']={'npcPriceSpread':0.1,'marketFee':0.015,'orderBaseSlots':3,'orderSlotsPerLogistics':0,'orderSlots':{'free':3,'plus':4,'gold':6,'platinum':8},'liquidationCooldownSeconds':0,'initialStationHull':1000,'stationUpgradeXpPerLevel':100,'maxFacilitiesPerRegion':2000,'dailyRewardCash':50000,'weeklyRewardCash':500000,'dailyChallengeCycles':100,'dailyChallengeCash':100000,'dailyChallengeXp':100,'rewardEligibilitySeconds':60,'seasonRewardCashPerLevel':100000,'vaultBaseCapacity':10000,'vaultCapacityPerRelic':1000,'electionMinimumWorth':1000000000,'repairPartsPerHull':1,'prestigeRelicDivisorReduction':0.001,'prestigeRelicMaximumReduction':0.5,'researchHasteSecondsPerRelic':30}
rules['research']['rewards']={
    'common':[{'kind':'blueprint','id':x} for x in ('oil_mapping','coal_detector','log_loader')]+[{'kind':'asset','id':'galactic_coordinate_i'}],
    'uncommon':[{'kind':'blueprint','id':x} for x in ('advanced_woodworking','bauxite_detector','jet_fuel_refining','gold_detector','vacuum_distillation')]+[{'kind':'asset','id':x} for x in ('galactic_coordinate_ii','galactic_coordinate_iii')],
    'rare':[{'kind':'blueprint','id':x} for x in ('robotic_automation','factory_specialization','mining_specialization','oil_specialization','energy_specialization')]+[{'kind':'asset','id':x} for x in ('rocket','galactic_coordinate_iv')],
    'superior':[{'kind':'blueprint','id':x} for x in ('logistics_expansion','airport_tram','quality_control','reincorporation_computer','quantum_stabilization')]+[{'kind':'asset','id':'galactic_coordinate_v'}]}
rules['entitlements']={tier:{'marketSlots':slots,'dailyChallenges':challenges,'voteMultiplier':multi,'weeklyTokens':tokens,'permanentBoon':tier!='free','gifting':tier!='free','customRetailNames':tier!='free'} for tier,slots,challenges,multi,tokens in [('free',3,3,1,0),('plus',4,4,2,1),('gold',6,5,3,2),('platinum',8,6,4,3)]}
rules['season']['rewards']=[{'level':1,'weeklyUnlocked':True},{'level':2,'researchSeconds':-1800},{'level':3,'startingCash':1000000},{'level':4,'startingLand':5},{'level':5,'startingCash':5000000},{'level':6,'startingLand':20},{'level':7,'researchCostMultiplier':0.8},{'level':8,'startingFacility':'logistics_center','minimumWorth':100000000000},{'level':9,'startingFacility':'air_traffic_control','minimumWorth':100000000000},{'level':10,'startingFacility':'hq','minimumWorth':100000000000}]
rules['season']['challenges']=[{'id':'production','target':100,'metric':'cycles','xp':100},{'id':'sales','target':100000,'metric':'salesCents','xp':100},{'id':'construction','target':1,'metric':'builds','xp':100},{'id':'purchases','target':100000,'metric':'purchasesCents','xp':100,'entitlement':'plus'},{'id':'production_expert','target':1000,'metric':'cycles','xp':100,'entitlement':'gold'},{'id':'commerce_expert','target':10000000,'metric':'salesCents','xp':150,'entitlement':'platinum'}]
content={'assets':assets,'facilities':facilities,'technologies':technologies,'services':services,'policies':policies,'regions':regions,'rules':rules}
(TARGET/'content.json').write_text(json.dumps(content,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print({k:len(v) for k,v in content.items() if isinstance(v,list)})
