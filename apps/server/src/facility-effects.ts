import { policies, qualityChance, rules } from '../../../packages/rules/src/index.js';
import { expansionRules } from '../../../packages/rules/src/expansion.js';
import { assetMap, buyingLimit, capacityReason, chosenInputs, cycleMs, effectiveLevel, facilityMap, installedTech, plusId, R, recipe, serviceActive } from './engine.js';
import type { CycleFactors } from './engine.js';
import { projectBonus } from './expansion.js';
import type { Corp, Facility, Region } from './types.js';

export interface FacilityEffect {
 id:string; label:string; value:string; description:string;
 tone:'positive'|'negative'|'neutral'; category:'speed'|'cycle'|'output'|'quality'|'inputs'|'operation';
 scope:string; expiresAt?:number;
}
export interface FacilityEffects {
 entries:FacilityEffect[]; positiveCount:number; negativeCount:number;
 cycle?:Pick<CycleFactors,'baseSeconds'|'adjustedSeconds'|'speedMultiplier'|'effectiveSeconds'|'floorApplied'>;
 quality?:{chance:number};
}
const number=(n:number)=>Number(n.toFixed(4)).toLocaleString('en-US',{maximumFractionDigits:4});
const percent=(n:number)=>`${n>0?'+':''}${number(n*100)}%`;
const money=(n:number)=>`$${(n/100).toLocaleString('en-US',{maximumFractionDigits:2})}`;
const tone=(n:number):FacilityEffect['tone']=>n>0?'positive':n<0?'negative':'neutral';
const assetName=(id:string)=>id==='cash'?'capital':assetMap.get(id)?.name||id;
const SHARED='Shared region',REGIONAL='Your corporation in this region',CORPORATION='Your corporation',LOCAL='This facility';
function projectExpiry(r:Region,key:'productionSpeed'|'happiness'|'exportSpeed',now:number){
 const times=[...new Set<number>((r.projectBenefits||[]).filter((x:{effect:Record<string,number>;expiresAt:number})=>x.expiresAt>now&&x.effect[key]).map((x:{expiresAt:number})=>x.expiresAt))].sort((a,b)=>a-b);
 const value=(at:number)=>key==='happiness'?Math.max(10,Math.min(100,r.happiness-Number(r.projectHappiness||0)+projectBonus(r,key,at))):projectBonus(r,key,at);
 return times.find(at=>value(at)!==value(now));
}

/** Presentation only. Numeric cycle values are collected by the simulation's own calculation. */
export function facilityEffects(f:Facility,c:Corp,r:Region):FacilityEffects {
 const result:FacilityEffects={entries:[],positiveCount:0,negativeCount:0},entries=result.entries;
 const add=(id:string,label:string,value:string,description:string,category:FacilityEffect['category'],effectTone:FacilityEffect['tone']='neutral',scope=LOCAL,expiresAt?:number)=>{
  entries.push({id,label,value,description,category,tone:effectTone,scope,...(expiresAt===undefined?{}:{expiresAt})});
 };
 const d=facilityMap.get(f.type),h=c.holdings[r.id]!;
 if(!d){add('infrastructure','No production cycle','Not simulated','This facility has no known production definition.','operation');return result;}
 const producing=Object.keys(d.outputs||{}).length>0,now=c.lastProcessed;
 const installed=h.facilities.flatMap(host=>host.installed.flatMap((id,slot)=>{const {t,tier}=installedTech(id);return t&&(['all','global'].includes(t.effect?.facility)||f.type.includes(t.effect?.facility))?[{host,id,slot,t,tier}]:[];}));
 const origin=(host:Facility)=>`Installed on ${facilityMap.get(host.type)?.name||host.type} (#${host.id.slice(0,8)}); applies to eligible facilities throughout your region.`;
 const boon=c.entitlement!=='free'||(c.rewards.vote||0)+rules.vote.boonSeconds*1000>now;
 const boonExpiry=c.entitlement==='free'?(c.rewards.vote||0)+rules.vote.boonSeconds*1000:undefined;
 const boonLabel=c.entitlement==='free'?'Supporter boon':`${c.entitlement[0]!.toUpperCase()+c.entitlement.slice(1)} entitlement`;

 if(producing){
  const factors={} as CycleFactors;cycleMs(f,c,r,factors);
  const {baseSeconds,adjustedSeconds,speedMultiplier,effectiveSeconds,floorApplied}=factors;
  result.cycle={baseSeconds,adjustedSeconds,speedMultiplier,effectiveSeconds,floorApplied};
  const rec=recipe(f,c,r),chosen=chosenInputs(f,h,c,r).items,eligible=Object.keys(rec.outputs).some(id=>id!=='cash'&&assetMap.has(plusId(id)));
  const total=Object.values(chosen).reduce((n,q)=>n+q,0),plus=Object.entries(chosen).filter(([id])=>id.endsWith('_plus')).reduce((n,[,q])=>n+q,0),fraction=total?plus/total:0;
  const chance=f.plus&&eligible?qualityChance(effectiveLevel(f,r,c),fraction):0;
  if(eligible)result.quality={chance};
  const missing=Object.entries(chosen).filter(([id,n])=>id==='cash'?c.cash<n:(h.inventory[id]||0)<n),capacity=capacityReason(f,h,c,r);
  if(!f.enabled)add('operation:paused','Paused','No production','This facility is paused. The cycle and modifiers below describe its potential when resumed.','operation','negative');
  if(missing.length)add('operation:starved','Missing inputs','Production blocked',`${missing.map(([id,n])=>`${assetName(id)}: ${number(id==='cash'?c.cash:h.inventory[id]||0)} of ${number(n)} required`).join('; ')}. A blocked cycle consumes nothing and grants no XP. Rates below are potential, not current output.`,'operation','negative');
  if(capacity)add('operation:capacity','Capacity limit','Production blocked',`${capacity} A blocked cycle consumes nothing and grants no XP. Rates below are potential, not current output.`,'operation','negative');

  if(f.type==='airport')add('airport-count','Regional airport count',`${factors.airportCount} airports · ${number(factors.airportBaseSeconds)} s base`,`${factors.airportCount} airports owned by your corporation in this region set the duration before technology and tourism adjustments. Airports in other regions do not count.`,'cycle',tone(baseSeconds-factors.airportBaseSeconds),REGIONAL);
  if(factors.regionalKey){
   const names:Record<string,string>={soil:'Soil health',oil:'Oil reserves',solar:'Solar intensity',minerals:'Mineral reserves',industry:'Industrial productivity'};
   add('regional-roll',names[factors.regionalKey]!,`×${number(factors.regionalBase)} speed`,`${r.name}'s current ${factors.regionalKey} roll applies to this facility. Eligible policies add to this factor; the combined regional factor is ×${number(factors.regionalMultiplier)} (minimum ×0.1).`,'speed',tone(factors.regionalBase-1),SHARED);
   for(const p of policies){const amount=Number(p.effect[factors.regionalKey]||0);if(r.policies.includes(p.id)&&amount)add(`policy:${p.id}:speed`,p.name,`${percent(amount)} points to regional factor`,`Adds ${number(amount)} to the ${factors.regionalKey} factor before it multiplies production speed. This is additive with the regional roll, not a separate ${percent(amount)} speed multiplier. Combined regional factor: ×${number(factors.regionalMultiplier)}.`,'speed',tone(amount),SHARED);}
  }
  const garden=Number(r.projectHappiness||0),gardenExpiry=garden?projectExpiry(r,'happiness',now):undefined;
  add('happiness','Regional happiness',`${number(r.happiness)} / 100 · ${percent(factors.happinessMultiplier-1)} speed`,`Current happiness multiplies speed by ×${number(factors.happinessMultiplier)} relative to 50 happiness. Each point above or below 50 changes speed by 0.2%. Services and policies are reflected after the region updates; output, inputs and XP per successful cycle do not change.${garden?` This already includes ${number(garden)} happiness from active community gardens, counted only once. The expiry shown is the next garden-related change to happiness; other sources may update sooner.`:''}`,'speed',tone(factors.happinessMultiplier-1),SHARED,gardenExpiry);
  if(factors.boonActive)add('supporter-boon',boonLabel,`${percent(rules.vote.speedBonus)} speed`,c.entitlement==='free'?'The active supporter boon multiplies production speed. It does not change amounts per cycle.':'This entitlement supplies the permanent supporter production bonus. A temporary supporter boon does not stack with it.','speed','positive',CORPORATION,boonExpiry);
  if(factors.hasteActive)add('haste','Production haste','+25% speed','Active production haste multiplies speed by ×1.25. Vaulted haste relics instead affect newly started research.','speed','positive',CORPORATION,c.rewards.haste);
  if(factors.projectSpeed){
   const projects=(r.projectBenefits||[]).filter((x:{expiresAt:number;effect:Record<string,number>})=>x.expiresAt>now&&x.effect.productionSpeed);
   // A capped total may survive the first expiry unchanged. Report the first actual change.
   const expiresAt=projectExpiry(r,'productionSpeed',now);
   add('cooperative-speed','Cooperative production projects',`${percent(factors.projectSpeed)} speed`,`${projects.length} active project benefit${projects.length===1?'':'s'} add together, capped at ${number(expansionRules.projects.maximumProductionBonus*100)}%. The expiry shown is the next change to the combined bonus; remaining projects may continue.`,'speed',tone(factors.projectSpeed),SHARED,expiresAt);
  }

  const outputs:Record<string,number>={...d.outputs};
  for(const {host,id,slot,t,tier} of installed){
   const effect=t.effect,prefix=`technology:${host.id}:${slot}`,name=assetMap.get(id)?.name||t.name,source=origin(host);
   const speed=Number(effect.speedBonuses?.[tier]||0),reduction=Number(effect.cycleReductions?.[tier]||0),levels=Number(effect.levelBonuses?.[tier]||0);
   if(speed)add(`${prefix}:speed`,name,`${percent(speed)} technology speed`,`Adds ${number(speed)} to the technology speed factor. All eligible installed copies add together: ×${number(factors.technologySpeed)} before regional and timed multipliers. ${source}`,'speed',tone(speed),REGIONAL);
   if(reduction)add(`${prefix}:cycle`,name,`${number(-reduction)} s per cycle`,`Subtracts ${number(reduction)} seconds before speed multipliers and applicable duration floors. ${source}`,'cycle',tone(reduction),REGIONAL);
   if(effect.outputAmounts){const before=outputs[effect.output]||0,amount=Number(effect.outputAmounts[tier]);outputs[effect.output]=amount;add(`${prefix}:output`,name,`${number(amount)} ${assetName(effect.output)} / cycle`,`Sets ${assetName(effect.output)} output to ${number(amount)} instead of ${number(before)} per successful cycle; this is an output replacement, not a speed bonus. ${source}`,'output',tone(amount-before),REGIONAL);}
   if(effect.outputReplace){const prior=Object.keys(outputs).map(assetName).join(', '),amount=Object.values(outputs)[0]||1;for(const key of Object.keys(outputs))delete outputs[key];outputs[effect.outputReplace]=amount;add(`${prefix}:output-replacement`,name,`${assetName(effect.outputReplace)} output`,`Replaces ${prior} with ${number(amount)} ${assetName(effect.outputReplace)} per successful cycle. Input amounts are unchanged. ${source}`,'output','neutral',REGIONAL);}
   if(levels&&eligible)add(`${prefix}:quality`,name,`${levels>0?'+':''}${number(levels)} effective levels`,`${source} These levels affect quality chance, not cycle duration. Final chance is capped at 100%.${!f.plus?' Quality output is currently disabled.':''}`,'quality',f.plus?tone(levels):'neutral',REGIONAL);
  }
  if(f.type==='airport'){
   for(const p of policies)if(r.policies.includes(p.id)){
    const seconds=Number(p.effect.airportSeconds||0),fuel=Number(p.effect.airportFuel||0);
    if(seconds)add(`policy:${p.id}:cycle`,p.name,`${number(seconds)} s per cycle`,'Changes airport duration before speed multipliers. The adjusted airport duration cannot fall below 30 seconds.','cycle',tone(-seconds),SHARED);
    if(fuel)add(`policy:${p.id}:inputs`,p.name,`${fuel>0?'+':''}${number(fuel)} jet fuel / cycle`,`Adds ${number(fuel)} jet fuel to each successful cycle, for ${number(rec.inputs.jet_fuel||0)} total. This does not multiply the existing fuel requirement.`,'inputs',tone(-fuel),SHARED);
   }
   add('airport-minimum','Airport duration floor','30 s before speed',factors.airportFloorApplied?'The 30-second airport floor limits the combined technology and tourism reductions before speed multipliers are applied.':'Airport duration is floored at 30 seconds before speed multipliers. This floor is not reducing the current bonuses.','cycle',factors.airportFloorApplied?'negative':'neutral',REGIONAL);
  }
  add('cycle-minimum','Simulation duration floor','1 s minimum',factors.minimumFloorApplied?'The final cycle has reached the one-second minimum after speed modifiers and millisecond rounding. Additional speed cannot shorten it further.':'The final duration is rounded to milliseconds and cannot be shorter than one second. This floor is not currently limiting production.','cycle',factors.minimumFloorApplied?'negative':'neutral');
  if(eligible){
   if(f.level)add('facility-level','Facility experience',`Level ${number(f.level)}`,`Earned facility levels contribute ${number(rules.plusChancePerLevel*100)} percentage points of base quality chance each, capped at 100% final chance. These levels do not increase speed.${!f.plus?' Quality output is currently disabled.':''}`,'quality',f.plus?'positive':'neutral');
   if(serviceActive(r,'fiber_infrastructure'))add('fiber-infrastructure','Fiber infrastructure','+5 effective levels',`Funded fiber adds five effective levels for quality calculations, capped at 100% final chance. It does not change XP or cycle duration.${!f.plus?' Quality output is currently disabled.':''}`,'quality',f.plus?'positive':'neutral',SHARED);
   if(!f.plus)add('quality-disabled','Quality output disabled','Normal output only','Quality rolls are disabled for this facility; level and plus-input bonuses do not create quality output.','quality','negative');
   add('quality-chance','Current quality chance',`${number(chance*100)}% per successful cycle`,`Uses effective level ${number(effectiveLevel(f,r,c))} and the plus-input share available for the next cycle. Chance is capped at 100%; it is not guaranteed output.${(c.space.vault.relic_of_efficiency||0)>0?' The efficiency relic converts successful quality rolls into extra normal output.':''}`,'quality');
   if((c.space.vault.relic_of_efficiency||0)>0&&f.plus)add('efficiency-relic','Relic of efficiency','Quality roll → 2× normal output',`On a successful quality roll, produces twice the recipe's normal quantity instead of a plus asset. With the current chance, expected normal output is ×${number(1+chance)}; speed and input costs per cycle are unchanged. Additional efficiency relics do not stack.`,'output',chance>0?'positive':'neutral',CORPORATION);
  }
  if(Object.keys(rec.inputs).some(id=>id!=='cash')){
   const increased=f.plus&&eligible&&chance>qualityChance(effectiveLevel(f,r,c),0);
   add('plus-inputs','Plus-input preference',f.allowPlus?`${number(fraction*100)}% of next-cycle inputs are plus`:'Normal inputs only',f.allowPlus?`Consumes available plus stock first, then fills the recipe with normal inputs. Current plus share multiplies base quality chance by ×${number(1+fraction*rules.plusInputChanceBonus)}, subject to the 100% cap.${!f.plus||!eligible?' There is no active quality-output benefit for this facility.':''} Recipe quantities do not change; this share can change as stock is consumed.`:'Plus stock is not substituted for normal recipe inputs. Enable plus inputs to use available plus stock first.','inputs',increased?'positive':'neutral');
  }
 }else{
  add('infrastructure','Infrastructure','No production cycle','This facility supports another system and has no production cycle. Production-speed and quality modifiers do not accelerate it. Its enabled switch does not disable its infrastructure function.','operation');
  if(f.type==='logistics_center'){
   let contribution=rules.logisticsHourlyBuyLimit;
   for(const {host,id,slot,t,tier}of installed)if(t.effect.buyLimits){const next=Number(t.effect.buyLimits[tier]);add(`technology:${host.id}:${slot}:buy-limit`,assetMap.get(id)?.name||t.name,`${money(next)} / h per center`,`Replaces each regional logistics center's ${money(contribution)} hourly NPC purchase contribution with ${money(next)}. ${origin(host)}`,'operation',tone(next-contribution),REGIONAL);contribution=next;}
   if(r.policies.includes('public_logistics_access'))add('policy:public_logistics_access:buy-limit','Public logistics access',`+${money(rules.logisticsHourlyBuyLimit)} / h`,`Adds one ${money(rules.logisticsHourlyBuyLimit)} allowance to your regional total, not once per center. It does not grant player-market access without a real center.`,'operation','positive',SHARED);
   if(boon)add('supporter-boon',boonLabel,`${percent(rules.vote.buyLimitBonus)} NPC allowance`,'Multiplies the total regional NPC purchase allowance. Entitlement and temporary supporter boon do not stack. This does not accelerate an infrastructure cycle.','operation','positive',CORPORATION,boonExpiry);
   const exportBonus=projectBonus(r,'exportSpeed',now);if(exportBonus)add('cooperative-exports','Freight coordination projects',`${number(exportBonus*100)}% shorter new exports`,`Active project benefits add together, capped at ${number(expansionRules.projects.maximumExportBonus*100)}%. Newly dispatched exports use ×${number(1-exportBonus)} of their truck travel duration. Existing shipments retain their arrival time. The expiry shown is the next change to this combined bonus.`,'operation','positive',SHARED,projectExpiry(r,'exportSpeed',now));
   add('logistics-total','Regional NPC purchase allowance',`${money(buyingLimit(c,h,r,now))} / h`,'Total allowance from the regional base, all logistics centers, applicable technology, public logistics and supporter bonus. This is a regional total, not an allowance for each center.','operation','neutral',REGIONAL);
  }
  if(f.type==='research_facility'){
   const description='Applies when a new regional research project starts. Existing projects keep their saved completion time.';
   if(serviceActive(r,'university'))add('university','University','−600 s research time',description,'operation','positive',SHARED);
   for(const p of policies){const seconds=Number(p.effect.researchSeconds||0);if(r.policies.includes(p.id)&&seconds)add(`policy:${p.id}:research`,p.name,`${number(seconds)} s research time`,description,'operation',tone(-seconds),SHARED);}
   const relics=Number(c.space.vault.relic_of_haste||0);if(relics)add('research-haste-relics','Vaulted haste relics',`−${number(relics*R.researchHasteSecondsPerRelic)} s research time`,`${relics} vaulted relics reduce newly rolled research duration. ${description}`,'operation','positive',CORPORATION);
   if(c.season.claimed.includes(2))add('season:research-time','Season research reward','−1,800 s research time',description,'operation','positive',CORPORATION);
   if(c.season.claimed.includes(7))add('season:research-cost','Season research discount','−20% research costs','Reduces capital, energy and extra plus-energy requirements when starting a new project. It does not refund an existing project.','inputs','positive',CORPORATION);
  }
  if(['retail_store','customer_support_center'].includes(f.type)){
   const stores=h.facilities.filter(x=>x.type==='retail_store').length,supports=h.facilities.filter(x=>x.type==='customer_support_center').length,coverage=Math.min(1,supports*rules.retail.supportStores/Math.max(1,stores)),factor=Math.max(0.1,coverage);
   if(stores)add('retail-support','Customer support',`×${number(factor)} retail demand`,`${supports} support centers cover ${stores} retail stores. Incomplete support reduces regional retail demand, with a minimum factor of ×0.1. Retail continues on its fixed ${number(rules.retail.cycleSeconds/60)}-minute schedule.`,'operation',tone(factor-1),REGIONAL);
   const population=Math.sqrt(r.population/rules.retail.populationScale);if(stores)add('retail-population','Regional population',`×${number(population)} retail demand`,`Current population is ${number(r.population)}. Demand scales with its square root relative to ${number(rules.retail.populationScale)} residents, before support, price and stock constraints. Happiness is already reflected in the last hourly population update.`,'operation',tone(population-1),SHARED);
  }
 }
 // Reset technologies apply to regional resets, not facility production. Show them only on their host.
 for(const {host,id,slot,t}of installed)if(host.id===f.id){
  if(t.effect.vaultRetention)add(`technology:${host.id}:${slot}:vault`,assetMap.get(id)?.name||t.name,`${number(rules.space.stabilizedVaultRetention*100)}% vault retention chance`,'Changes the survival chance of each vaulted item when prestiging from this region. It does not alter facility production.','operation','positive',REGIONAL);
  if(t.effect.prestigeCooldownSeconds){const count=h.facilities.reduce((n,x)=>n+x.installed.length,0),active=count>=Number(t.effect.requiresInstalled);add(`technology:${host.id}:${slot}:prestige`,assetMap.get(id)?.name||t.name,active?'2 h prestige cooldown':`${count} / ${t.effect.requiresInstalled} installed technologies`,active?'This region meets the installed-technology requirement for the reduced prestige cooldown. Facility production is unchanged.':'The reduced prestige cooldown requires more installed technologies in this region. Facility production is unchanged.','operation',active?'positive':'neutral',REGIONAL);}
 }
 // Baselines are available in cycle/quality totals. Badges describe changes, not ordinary defaults.
 result.entries=entries.filter(e=>!(e.tone==='neutral'&&e.expiresAt===undefined&&['regional-roll','happiness','cycle-minimum','airport-minimum','quality-chance','plus-inputs','airport-count'].includes(e.id)));
 result.positiveCount=result.entries.filter(e=>e.tone==='positive').length;result.negativeCount=result.entries.filter(e=>e.tone==='negative').length;
 return result;
}
