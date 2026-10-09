import { randomUUID, randomBytes } from 'node:crypto';
import { assets, facilities, technologies, services, policies, regions, rules, levelFromXp, qualityChance, retailDemand, airportInterval } from '../../../packages/rules/src/index.js';
import { Corp, Dict, Facility, Game, GameError, Holding, Region, World } from './types.js';
import { normalizeEnhancements, observeCycle, facilityMetrics, insightSnapshot, notifyCorporation } from './insights.js';
import { committedValue, expansionResetPreview, expansionSnapshot, nextExpansionEvent, projectBonus, settleExpansion } from './expansion.js';

const assetList = assets as unknown as Dict[];
const facilityList = facilities as unknown as Dict[];
const techList = technologies as unknown as Dict[];
export const assetMap = new Map(assetList.map(a=>[a.id,a]));
export const facilityMap = new Map(facilityList.map(a=>[a.id,a]));
export const techMap = new Map(techList.map(a=>[a.id,a]));
export const MAX = 9_000_000_000_000;
// Default adaptations are overridden by the versioned content rules package.
export const R:Dict = {initialCash:rules.starterCash,initialLand:rules.starterLand,landBaseCost:rules.landBaseCost,landGrowth:rules.landGrowth,
  npcBuyMarkup:rules.npcBuyMultiplier,npcSellMarkdown:1,npcDailyLimit:1000000000,marketFee:0.01,
  researchCost:rules.research.cash,researchEnergy:rules.research.energy,researchSeconds:rules.research.minimumSeconds,
  exportSeconds:rules.export.normalSeconds,exportFuelPer1000:1,prestigeCooldownSeconds:rules.prestige.cooldownSeconds,
  liquidationCooldownSeconds:3600,seasonDays:90,seasonXpPerLevel:100,
  ...((rules as Dict).remake || {})};
export function integer(v:any,label='Quantity', min=1,max=MAX):number {
  if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max) throw new GameError(`${label} must be a whole number between ${min} and ${max}.`);
  return v;
}
export function bounded(n:number):number { if(!Number.isSafeInteger(n)||Math.abs(n)>MAX) throw new GameError('Economic value exceeds the supported safe integer range.'); return n; }
export function add(c:Corp,key:'cash'|'tokens'|'score'|'gratitude',n:number){ c[key]=bounded(c[key]+n);if(c[key]<0)throw new GameError(`Insufficient ${key}.`); }
export function stock(h:Holding,id:string,n:number){h.inventory[id]=bounded((h.inventory[id]||0)+n);if(h.inventory[id]<0)throw new GameError(`Missing ${assetMap.get(id)?.name||id}.`);const blueprint=assetMap.get(id)?.blueprintTechnologyId;if(blueprint){h.blueprints||={};h.blueprints[blueprint]=h.inventory[id];}}
export function spend(c:Corp,n:number){integer(n,'Cost',0);add(c,'cash',-n);}
export function consume(h:Holding,id:string,n:number,locked=true){if(locked&&h.locks.includes(id))throw new GameError(`${id} is locked. Unlock it in inventory first.`);stock(h,id,-n);}
export function note(c:Corp,text:string,now:number,kind='economy'){c.activity.unshift({id:randomUUID(),at:now,text,kind});c.activity=c.activity.slice(0,150);}
export function roll(c:Corp){let x=c.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;c.rng=x>>>0;return c.rng/4294967296;}
export function emptyHolding():Holding{return {land:0,landSpent:0,purchasedLand:0,inventory:{},blueprints:{},locks:[],facilities:[],research:[],retail:[],npcPurchases:{},purchaseDay:0,scrap:0};}
export function createWorld(now:number):World {
  const seasonStart=Date.parse(process.env.SEASON_START||'2026-10-01T00:00:00Z');
  const seasonEnd=Date.parse(process.env.SEASON_END||'2027-01-01T00:00:00Z');
  return {revision:0,orders:[],trades:[],expansionEnabled:false,contracts:[],projects:[],season:{id:'founders-2026',name:'Founders Season',startsAt:seasonStart,endsAt:seasonEnd,xpPerLevel:R.seasonXpPerLevel},regions:(regions as unknown as Dict[]).map((r,i)=>({
    ...r,id:r.id,name:r.name,description:r.description||'',modifiers:r.modifiers||{},population:r.population||10000,happiness:50,
    services:{},policies:[],candidates:[],votes:{},policyVotes:{},legislator:null,electionEndsAt:now+rules.governance.electionSeconds*1000,nextUpdate:Math.floor(now/3600000)*3600000+3600000,policyChangedAt:{},fundingPoints:rules.governance.baseFundingPoints,
    index:i,priceEpoch:Math.floor(now/3600000)
  }))};
}
export function createCorp(id:string,name:string,now:number,world:World):Corp {
 const holdings:Record<string,Holding>={};for(const r of world.regions)holdings[r.id]=emptyHolding();
 const first=holdings[world.regions[0]!.id]!;first.land=R.initialLand;
 return {id,name,motto:'Building tomorrow.',cash:R.initialCash,tokens:0,score:0,gratitude:0,entitlement:'free',privacy:true,createdAt:now,lastProcessed:now,rng:randomBytes(4).readUInt32LE()||1,
 holdings,technologies:[],blueprints:{},upgrades:{},shipments:[],activity:[],stats:{produced:0,sold:0,built:0,earned:0,scrapped:0,exports:0,researched:0},rewards:{},season:{id:world.season.id,xp:0,claimed:[],challenges:{}},space:{orbital:false,station:{level:0,hull:0,xp:0},expedition:null,vault:{},relics:0,coordinates:0},lastPrestige:0,lastLiquidation:{}};
}
export function getHolding(c:Corp,id:any,world:World){if(typeof id!=='string'||!world.regions.some(r=>r.id===id))throw new GameError('Choose a valid region.');return c.holdings[id] ||= emptyHolding();}
export function has(h:Holding,...types:string[]){return h.facilities.some(f=>types.includes(f.type));}
export function requireFacility(h:Holding,types:string[],message:string){if(!has(h,...types))throw new GameError(message);}
export function xp(c:Corp,n:number){c.season.xp=Math.min(Number.MAX_SAFE_INTEGER,c.season.xp+n);}
export function challengeProgress(c:Corp,metric:string,n:number,at:number){const key=`${Math.floor(at/86400000)}:${metric}`;c.season.challenges[key]=Math.min(Number.MAX_SAFE_INTEGER,(c.season.challenges[key]||0)+n);}
export function plusId(id:string){return id.endsWith('_plus')?id:id+'_plus';}
export function baseId(id:string){return id.replace(/_plus$/,'');}
export function assetPrice(id:string):number {const a=assetMap.get(id);if(a)return Math.max(1,a.price);const b=assetMap.get(baseId(id));if(!b)throw new GameError('Unknown asset.');return Math.max(1,b.price*2);}
export function getAsset(id:any){if(typeof id!=='string'||!assetMap.has(id))throw new GameError('Unknown asset.');return assetMap.get(id)!;}
export function serviceActive(r:Region,id:string){const s=(services as unknown as Dict[]).find(s=>s.id===id);return !!s&&(r.services[id]||0)>=s.cost;}
export function regionalEffect(r:Region,key:string,fallback=0){return (policies as unknown as Dict[]).filter(p=>r.policies.includes(p.id)).reduce((n,p)=>n+Number(p.effect?.[key]??fallback),0);}
export function policyMultiplier(r:Region,key:string){return (policies as unknown as Dict[]).filter(p=>r.policies.includes(p.id)).reduce((n,p)=>n*Number(p.effect?.[key]??1),1);}
export function installedTech(id:string){const asset=assetMap.get(id);const t=techMap.get(asset?.technologyId||id);return {t,tier:Math.max(0,Number(asset?.tier||1)-1)};}
export function regionalTech(c:Corp,r:Region,f?:Facility){return (c.holdings[r.id]?.facilities||[]).flatMap(x=>x.installed).filter(id=>{const {t}=installedTech(id),target=t?.effect?.facility;return !f||['all','global'].includes(target)||f.type.includes(target);});}
export function effectiveLevel(f:Facility,r:Region,c:Corp){let level=f.level+(serviceActive(r,'fiber_infrastructure')?5:0);for(const id of regionalTech(c,r,f)){const {t,tier}=installedTech(id);level+=Number(t?.effect?.levelBonuses?.[tier]||0);}return level;}
export function buyingLimit(c:Corp,h:Holding,r:Region,now:number){let limit=rules.baseHourlyBuyLimit;for(const f of h.facilities.filter(f=>f.type==='logistics_center')){let part=rules.logisticsHourlyBuyLimit;for(const id of regionalTech(c,r,f)){const {t,tier}=installedTech(id);if(t?.effect?.buyLimits)part=t.effect.buyLimits[tier];}limit+=part;}if(r.policies.includes('public_logistics_access'))limit+=rules.logisticsHourlyBuyLimit;return Math.floor(limit*((c.entitlement!=='free'||(c.rewards.vote||0)+rules.vote.boonSeconds*1000>now)?1+rules.vote.buyLimitBonus:1));}
export function marketPrice(region:Region,id:string,side:'buy'|'sell',now:number):number {
 const epoch=Math.floor(now/3600000);let hash=0;for(const ch of `${region.id}:${id}:${epoch}`)hash=(hash*31+ch.charCodeAt(0))>>>0;
 const steps=Math.round(R.npcPriceSpread*100),variation=1-steps/100+(hash%(steps*2+1))/100;const policy=baseId(id)==='energy'?policyMultiplier(region,'energyPriceMultiplier'):1;
 return Math.max(1,Math.round(assetPrice(id)*variation*(side==='buy'?R.npcBuyMarkup:R.npcSellMarkdown)*policy));
}
export function cycleMs(f:Facility,c:Corp,r:Region):number {
 const d=facilityMap.get(f.type);if(!d)return 60000;
 let speed=1,seconds=Number(d.cycleSeconds||60);
 if(f.type==='airport')seconds=airportInterval(c.holdings[r.id]!.facilities.filter(x=>x.type==='airport').length);
 for(const id of regionalTech(c,r,f)){const {t,tier}=installedTech(id);speed+=Number(t?.effect?.speedBonuses?.[tier]||0);seconds-=Number(t?.effect?.cycleReductions?.[tier]||0);}
 const key=['tree_farm','cotton_farm'].includes(f.type)?'soil':f.type==='oil_well'?'oil':f.type==='solar_power_plant'?'solar':f.type.endsWith('_mine')?'minerals':['laptop_factory','coal_power_plant','gasoline_engine_factory','car_factory','television_factory','digital_camera_factory','prescription_drug_factory','truck_factory'].includes(f.type)?'industry':null;
 if(key)speed*=Math.max(0.1,Number(r.modifiers[key]||1)+regionalEffect(r,key));speed*=1+(r.happiness-50)/500;
 if(c.entitlement!=='free'||(c.rewards.vote||0)+rules.vote.boonSeconds*1000>c.lastProcessed)speed*=1+rules.vote.speedBonus;
 if((c.rewards.haste||0)>c.lastProcessed)speed*=1.25;
 speed*=1+projectBonus(r,'productionSpeed',c.lastProcessed);
 if(f.type==='airport')seconds=Math.max(30,seconds+regionalEffect(r,'airportSeconds'));
 return Math.max(1000,Math.round(seconds*1000/speed));
}
export function recipe(f:Facility,c:Corp,r?:Region):{inputs:Record<string,number>;outputs:Record<string,number>} {
 const d=facilityMap.get(f.type)!;const inputs:Record<string,number>={};const outputs:Record<string,number>={};
 for(const [id,n] of Object.entries(d.inputs||{})){inputs[id]=Number(n);}
 for(const [id,n] of Object.entries(d.outputs||{})){outputs[id]=Number(n);}
 for(const id of (r?regionalTech(c,r,f):f.installed)){const {t,tier}=installedTech(id),effect=t?.effect||{};if(effect.outputAmounts)outputs[effect.output]=effect.outputAmounts[tier];if(effect.outputReplace){const amount=Object.values(outputs)[0]||1;for(const key of Object.keys(outputs))delete outputs[key];outputs[effect.outputReplace]=amount;}}
 if(r&&f.type==='airport')inputs.jet_fuel=(inputs.jet_fuel||0)+regionalEffect(r,'airportFuel');
 return {inputs,outputs};
}
function chosenInputs(f:Facility,h:Holding,c:Corp,r?:Region){const items:Record<string,number>={};let allPlus=Object.keys(recipe(f,c,r).inputs).length>0;
 for(const [id,n] of Object.entries(recipe(f,c,r).inputs)){
  if(id==='cash'){items[id]=n;allPlus=false;continue;}
  let left=n;if(f.allowPlus&&(h.inventory[plusId(id)]||0)>0){const use=Math.min(left,h.inventory[plusId(id)]||0);items[plusId(id)]=use;left-=use;}
  if(left){items[id]=left;allPlus=false;}
 }
 return {items,allPlus};
}
export function capacityReason(f:Facility,h:Holding,c:Corp,r:Region):string|null {for(const[id,n]of Object.entries(recipe(f,c,r).outputs)){if(id==='cash'){if(c.cash>MAX-n)return 'Cash capacity reached. Spend capital to resume this facility.';}else{const efficiency=f.plus&&(c.space.vault.relic_of_efficiency||0)>0,normalAmount=efficiency?n*2:n;if((h.inventory[id]||0)>MAX-normalAmount)return `${assetMap.get(id)?.name||id} inventory capacity reached. Sell, export, or consume stock to resume.`;if(f.plus&&assetMap.has(plusId(id))&&(h.inventory[plusId(id)]||0)>MAX-n)return `${assetMap.get(plusId(id))?.name} inventory capacity reached. Sell, export, or consume stock to resume.`;}}return null;}
function produce(f:Facility,h:Holding,c:Corp,r:Region,at:number){
 const d=facilityMap.get(f.type);if(!d||!f.enabled)return;
 const chosen=chosenInputs(f,h,c,r);for(const[id,n]of Object.entries(chosen.items)){if(id==='cash'?c.cash<n:(h.inventory[id]||0)<n){observeCycle(f,'starved',at);return;}}
 if(capacityReason(f,h,c,r)){observeCycle(f,'capacity',at);return;}
 for(const[id,n]of Object.entries(chosen.items)){if(id==='cash')spend(c,n);else stock(h,id,-n);}
 const values=Object.entries(chosen.items),total=values.reduce((n,[,v])=>n+v,0),plus=values.filter(([id])=>id.endsWith('_plus')).reduce((n,[,v])=>n+v,0);
 const quality=f.plus&&roll(c)<qualityChance(effectiveLevel(f,r,c),total?plus/total:0);
 for(const[id,n]of Object.entries(recipe(f,c,r).outputs)){
  if(id==='cash'){add(c,'cash',n);c.stats.earned=Math.min(Number.MAX_SAFE_INTEGER,c.stats.earned+n);}else{const isPlus=quality&&assetMap.has(plusId(id));const efficiency=isPlus&&(c.space.vault.relic_of_efficiency||0)>0;stock(h,isPlus&&!efficiency?plusId(id):id,efficiency?n*2:n);c.stats.produced=Math.min(Number.MAX_SAFE_INTEGER,c.stats.produced+(efficiency?n*2:n));}
 }
 f.xp=Math.min(rules.maxFacilityLevel*rules.facilityXpPerLevel,f.xp+Number(d.xp||0));f.level=levelFromXp(f.xp);
 observeCycle(f,'successful',at);
 challengeProgress(c,'produce',1,at);
}
function settleRetail(h:Holding,c:Corp,r:Region,at:number){for(const retail of h.retail){if(retail.nextSale!==at)continue;
 const available=h.inventory[retail.assetId]||0;const base=marketPrice(r,retail.assetId,'sell',at)*(assetMap.get(retail.assetId)?.quality?2:1);
 const stores=h.facilities.filter(f=>f.type==='retail_store').length,support=Math.min(1,h.facilities.filter(f=>f.type==='customer_support_center').length*rules.retail.supportStores/Math.max(1,stores));
 const demand=retailDemand(retail.price,base,stores,r.population,support);
 const count=h.locks.includes(retail.assetId)?0:Math.min(available,demand,Math.floor((MAX-c.cash)/retail.price));
 if(count){consume(h,retail.assetId,count);const revenue=bounded(count*retail.price);add(c,'cash',revenue);retail.sold=Math.min(Number.MAX_SAFE_INTEGER,retail.sold+count);retail.revenue=Math.min(Number.MAX_SAFE_INTEGER,retail.revenue+revenue);c.stats.sold=Math.min(Number.MAX_SAFE_INTEGER,c.stats.sold+count);c.stats.earned=Math.min(Number.MAX_SAFE_INTEGER,c.stats.earned+revenue);challengeProgress(c,'salesCents',revenue,at);xp(c,count);}
 retail.nextSale=at+rules.retail.cycleSeconds*1000;
}}
function updateRegion(r:Region,at:number){const happiness=(services as unknown as Dict[]).filter(s=>serviceActive(r,s.id)).reduce((n,s)=>n+Number(s.effect?.happiness||0),0),base=Math.min(100,Math.max(10,50+happiness+regionalEffect(r,'happiness')));r.happiness=Math.min(100,Math.max(10,base+projectBonus(r,'happiness',at)));r.projectHappiness=r.happiness-base;
 r.population=bounded(Math.max(1000,Math.round(r.population*(1+(r.happiness-50)/100000))));
 r.priceEpoch=Math.floor(at/3600000);r.nextUpdate=at+3600000;
 if(Math.floor(at/(rules.regionModifierSeconds*1000))!==r.modifierEpoch){r.modifierEpoch=Math.floor(at/(rules.regionModifierSeconds*1000));const base=(regions as unknown as Dict[]).find(x=>x.id===r.id)?.modifiers||{};for(const key of Object.keys(base)){let value=0;for(const ch of `${r.id}:${key}:${r.modifierEpoch}`)value=(value*31+ch.charCodeAt(0))>>>0;r.modifiers[key]=Math.round((base[key]+((value%21)-10)/100)*100)/100;}}
 if(at>=r.electionEndsAt){const counts:Record<string,number>={};for(const v of Object.values(r.votes))counts[v]=(counts[v]||0)+1;const candidates=r.candidates.slice().sort((a,b)=>(counts[b.corporationId]||0)-(counts[a.corporationId]||0));r.legislator=candidates.length&&((counts[candidates[0].corporationId]||0)>(candidates[1]?counts[candidates[1].corporationId]||0:0))?candidates[0].corporationId:null;r.candidates=[];r.votes={};r.electionEndsAt=at+rules.governance.electionSeconds*1000;}
}
// Reference semantics: one global chronological event stream. Stable corporation/facility IDs
// arbitrate simultaneous scarce-input consumers. No offline cap, skipped cycles, or client clock.
export function advance(game:Game,to:number):{events:number;elapsed:number} {
 if(!Number.isSafeInteger(to)||to<0)throw new GameError('Simulation time must be a finite, nonnegative integer timestamp.');
 normalizeEnhancements(game);
 let events=0;const from=Math.min(to,...game.corps.map(c=>c.lastProcessed));
 const corps=game.corps.slice().sort((a,b)=>a.id.localeCompare(b.id));
 const orderedFacilities=new Map<Holding,Facility[]>();for(const c of corps)for(const h of Object.values(c.holdings))orderedFacilities.set(h,h.facilities.slice().sort((a,b)=>a.id.localeCompare(b.id)));
 while(true){let next=nextExpansionEvent(game);for(const r of game.world.regions)next=Math.min(next,r.nextUpdate);
  for(const c of corps)for(const h of Object.values(c.holdings)){for(const f of h.facilities)if(f.enabled&&Object.keys(facilityMap.get(f.type)?.outputs||{}).length)next=Math.min(next,f.nextCycle);for(const row of h.retail)next=Math.min(next,row.nextSale);}
  if(next>to)break;
  events+=settleExpansion(game,next);
  for(const r of game.world.regions)if(r.nextUpdate===next){updateRegion(r,next);const land=corps.reduce((n,c)=>n+(c.holdings[r.id]?.land||0),0);r.population=bounded(Math.round(land*25000*(1+(r.happiness-50)/100)));events++;}
  for(const c of corps){c.lastProcessed=next;for(const [rid,h]of Object.entries(c.holdings)){const r=game.world.regions.find(r=>r.id===rid)!;
   for(const f of orderedFacilities.get(h)!)if(f.enabled&&Object.keys(facilityMap.get(f.type)?.outputs||{}).length&&f.nextCycle===next){produce(f,h,c,r,next);f.nextCycle=next+cycleMs(f,c,r);events++;}
   if(h.retail.some(x=>x.nextSale===next)){settleRetail(h,c,r,next);events++;}
  }}
 }
 for(const c of corps){c.lastProcessed=to;for(const s of c.shipments)if(s.status==='traveling'&&s.arrivesAt<=to){s.status='arrived';note(c,`Shipment of ${s.quantity} ${s.assetId} is ready to claim.`,s.arrivesAt,'arrival');notifyCorporation(c,'arrival','Shipment arrived',`${s.quantity} ${s.assetId} is ready to claim.`,s.arrivesAt,s.id);events++;}for(const h of Object.values(c.holdings))for(const p of h.research)if(p.status==='working'&&p.readyAt<=to){p.status='ready';note(c,'Research completed; rewards are ready to claim.',p.readyAt,'research');notifyCorporation(c,'research','Research completed','Your regional research rewards are ready to claim.',p.readyAt,p.id);events++;}if(c.space.expedition?.status==='traveling'&&c.space.expedition.readyAt<=to){c.space.expedition.status='ready';note(c,'Galactic expedition returned; claim its outcome.',c.space.expedition.readyAt,'space');notifyCorporation(c,'space','Expedition returned','Your expedition result is ready to claim.',c.space.expedition.readyAt,c.space.expedition.id);events++;}}
 return {events,elapsed:to-from};
}
export function constructionWorth(f:Facility){return f.costPaid+Object.entries(f.materialsPaid).reduce((n,[id,q])=>n+assetPrice(id)*q,0);}
export function netWorth(c:Corp){let n=c.cash+committedValue(c);for(const h of Object.values(c.holdings)){n+=Math.floor(h.landSpent*rules.liquidationRefund);for(const f of h.facilities){n+=Math.floor(constructionWorth(f)*rules.liquidationRefund);for(const id of f.installed)n+=assetPrice(id);}for(const[id,q]of Object.entries(h.inventory))n+=assetPrice(id)*q;}for(const[id,q]of Object.entries(c.space.vault))n+=assetPrice(id)*Number(q);for(const s of c.shipments)if(s.status!=='claimed')n+=assetPrice(s.assetId)*s.quantity+assetPrice(s.truckId);for(const i of c.inbox||[])if(i.status==='pending')n+=(i.assetId==='cash'?1:assetPrice(i.assetId))*i.quantity;return Math.min(Number.MAX_SAFE_INTEGER,Math.floor(n));}
export function preview(c:Corp,world:World,regionId:string,kind:'prestige'|'liquidation',now:number){
 const h=c.holdings[regionId]!;const expansionPreview=expansionResetPreview({world,corps:[c]},c,regionId,kind,now);const escrow=world.orders.filter(o=>o.corporationId===c.id&&o.status==='open').reduce((n,o)=>n+o.remaining*(o.side==='buy'?o.price:assetPrice(o.assetId)),0),worth=Math.min(Number.MAX_SAFE_INTEGER,netWorth(c)+escrow);
 const score=Math.floor(worth/rules.prestige.scoreDivisor);const discount=Math.min(0.5,(c.space.vault.relic_of_prestige||0)*0.001);const tokens=Math.min(Number((rules.prestige.tokenCaps as Dict)[c.entitlement]||10),Math.floor(worth/(rules.prestige.scoreDivisor*(1-discount))));
 const r=world.regions.find(r=>r.id===regionId)!;
 const inventoryRefund=Object.entries(h.inventory).reduce((n,[id,q])=>n+q*marketPrice(r,id,'sell',now),0)+world.orders.filter(o=>o.corporationId===c.id&&o.regionId===regionId&&o.status==='open'&&o.side==='sell').reduce((n,o)=>n+o.remaining*marketPrice(r,o.assetId,'sell',now),0)+(c.inbox||[]).filter(i=>i.regionId===regionId&&i.status==='pending'&&i.assetId!=='cash').reduce((n,i)=>n+i.quantity*marketPrice(r,i.assetId,'sell',now),0)+c.shipments.filter(s=>s.fromRegionId===regionId&&s.status!=='claimed').reduce((n,s)=>n+s.quantity*marketPrice(r,s.assetId,'sell',now)+marketPrice(r,s.truckId,'sell',now),0)+h.facilities.flatMap(f=>f.installed).reduce((n,id)=>n+marketPrice(r,id,'sell',now),0);
 const refund=kind==='prestige'?0:bounded(expansionPreview.liquidatedMaterialsValue+Math.floor((h.landSpent+h.facilities.reduce((n,f)=>n+constructionWorth(f),0))*rules.liquidationRefund)+inventoryRefund);
 const installed=h.facilities.flatMap(f=>f.installed),prestigeSeconds=installed.includes('reincorporation_computer')&&installed.length>=4?7200:R.prestigeCooldownSeconds;
 const cooldownUntil=kind==='prestige'?c.lastPrestige+prestigeSeconds*1000:(c.lastLiquidation[regionId]||0)+R.liquidationCooldownSeconds*1000;
 return {type:kind,expansion:expansionPreview,netWorth:worth,score:kind==='prestige'?score:0,tokens:kind==='prestige'?tokens:0,refund:kind==='liquidation'?refund:0,cooldownUntil,eligible:now>=cooldownUntil&&(kind==='liquidation'||tokens>0),preserves:kind==='prestige'?['Tokens and score','Permanent land discounts and technology slots','Season progress and gratitude','50% quantum vault retention (75% with stabilization)','Account and settings']:['Global cash and progression','Other regions','Blueprints and technologies in other regions'],resets:kind==='prestige'?['Regional land, facilities, inventory, technologies and research','Blueprints, orders and shipments','Orbital presence and station']:['Selected region land, facilities, inventory, research and retail','Orders and unclaimed shipments involving this region']};
}
export function snapshot(game:Game,c:Corp,now:number,extra:Dict={}){
 const holdings:Dict={};for(const[rid,h]of Object.entries(c.holdings)){const r=game.world.regions.find(r=>r.id===rid)!;
  holdings[rid]={...h,groups:[...new Set(h.facilities.map(f=>f.group).filter(Boolean))].sort(),usedLand:h.facilities.reduce((n,f)=>n+Number(facilityMap.get(f.type)?.land||1),0),nextLandCost:landCost(h,1,c,r),buyLimit:buyingLimit(c,h,r,now),buyLimitUsed:h.purchaseDay===Math.floor(now/3600000)?h.npcPurchases.spent||0:0,
   buildCosts:Object.fromEntries(facilityList.map(d=>[d.id,buildCost(d,r)])),
   facilities:h.facilities.map(f=>{const ms=cycleMs(f,c,r),rec=recipe(f,c,r),chosen=chosenInputs(f,h,c,r),missing=Object.entries(chosen.items).filter(([id,n])=>id==='cash'?c.cash<n:(h.inventory[id]||0)<n).map(([id,n])=>({assetId:id,required:n,available:id==='cash'?c.cash:h.inventory[id]||0}));const capacity=capacityReason(f,h,c,r);return {...f,group:f.group||'',favorite:!!f.favorite,metrics:facilityMetrics(f,h,c,r,now),capacityReason:capacity,effectiveLevel:effectiveLevel(f,r,c),regionalTechnologies:regionalTech(c,r,f),cycleSeconds:ms/1000,status:!Object.keys(rec.outputs).length?'infrastructure':!f.enabled?'paused':missing.length?'starved':capacity?'capacity':'producing',missingInputs:missing,inputRates:Object.fromEntries(Object.entries(rec.inputs).map(([k,v])=>[k,v*60000/ms])),outputRates:Object.fromEntries(Object.entries(rec.outputs).map(([k,v])=>[k,v*60000/ms])),};}),research:h.research.map(({outcome:_outcome,...p})=>p)};
 }
 const publicCorps=game.corps.filter(x=>!x.privacy||x.id===c.id).map(x=>({id:x.id,name:x.name,score:x.score,netWorth:netWorth(x),motto:x.motto,seasonXp:x.season.xp,regionIds:Object.entries(x.holdings).filter(([,h])=>h.land>0).map(([id])=>id),regional:Object.fromEntries(Object.entries(x.holdings).map(([id,h])=>[id,{land:h.land,facilities:h.facilities.length,inventoryValue:Object.entries(h.inventory).reduce((n,[a,q])=>n+assetPrice(a)*q,0)}]))})).sort((a,b)=>b.score-a.score||b.netWorth-a.netWorth);
 return {...insightSnapshot(game,c),expansion:expansionSnapshot(game,c),protocol:1,ruleset:(rules as Dict).version||'2026.10-remake.1',revision:game.world.revision,serverTime:now,
 corporation:{id:c.id,name:c.name,motto:c.motto,cash:c.cash,tokens:c.tokens,score:c.score,gratitude:c.gratitude,entitlement:c.entitlement,privacy:c.privacy,notifications:(c as any).notifications!==false,createdAt:c.createdAt,netWorth:netWorth(c),upgrades:c.upgrades,lastPrestige:c.lastPrestige},
 regions:game.world.regions,holdings,orders:game.world.orders.filter(o=>o.status==='open'||o.corporationId===c.id).slice(-500),trades:game.world.trades.slice(-100),shipments:c.shipments,inbox:c.inbox||[],
 technologies:c.technologies,blueprints:c.blueprints,season:{...game.world.season,...c.season,level:rules.season.xpThresholds.filter(n=>c.season.xp>=n).length,rewards:rules.season.xpThresholds.map((n,i)=>({...rules.season.rewards[i],level:i+1,requiredXp:n,cash:(i+1)*R.seasonRewardCashPerLevel,tokens:0,premiumTokens:0})),challengesList:rules.season.challenges.slice(0,(rules.entitlements as Dict)[c.entitlement].dailyChallenges).map(ch=>({...ch,progress:c.season.challenges[`${Math.floor(now/86400000)}:${ch.metric==='cycles'?'produce':ch.metric}`]||0,claimed:!!c.season.challenges[`${Math.floor(now/86400000)}:claimed:${ch.id}`]})),dailyChallenge:{progress:c.season.challenges[`${Math.floor(now/86400000)}:produce`]||0,target:100,claimed:!!c.season.challenges[`${Math.floor(now/86400000)}:produce:claimed`]}},
 space:{...c.space,expedition:c.space.expedition?Object.fromEntries(Object.entries(c.space.expedition).filter(([k])=>k!=='outcome')):null},activity:c.activity,leaderboard:publicCorps,stats:c.stats,rewards:c.rewards,
 market:{watchlist:c.watchlist||[],feeRate:R.marketFee,quotes:Object.fromEntries(game.world.regions.map(r=>[r.id,Object.fromEntries(assetList.map(a=>{const buy=marketPrice(r,a.id,'buy',now),sell=marketPrice(r,a.id,'sell',now);return [a.id,{buy,sell,feeRate:R.marketFee,sellerNetPerUnit:sell-Math.floor(sell*R.marketFee),feeNote:'Player-order fee reference only; NPC sales have no additional fee.'}]}))])),currency:'USD',moneyScale:100,npcDailyLimit:R.npcDailyLimit,refreshAt:(Math.floor(now/3600000)+1)*3600000,prices:Object.fromEntries(game.world.regions.map(r=>[r.id,Object.fromEntries(assetList.map(a=>[a.id,{buy:marketPrice(r,a.id,'buy',now),sell:marketPrice(r,a.id,'sell',now)}]))]))},...extra};
}
export function buildCost(d:Dict,r:Region){let mult=policyMultiplier(r,'buildMultiplier');if(d.id==='solar_power_plant')mult*=policyMultiplier(r,'solarBuildMultiplier');if(d.id.endsWith('_farm'))mult*=policyMultiplier(r,'farmBuildMultiplier');return Math.round(d.cost*mult);}
export function landCost(h:Holding,quantity:number,c?:Corp,r?:Region){let sum=0,count=h.purchasedLand??Math.max(0,h.land-10);const discount=Math.min(0.8,(c?.upgrades.land_discount||0)*rules.prestige.landDiscountPerToken+(r&&serviceActive(r,'land_management_office')?0.05:0));for(let i=0;i<quantity;i++)if(h.land+i>=10){sum+=Math.ceil(R.landBaseCost*Math.pow(R.landGrowth,count)*(1-discount)*(r?policyMultiplier(r,'landMultiplier'):1));count++;}return bounded(sum);}
