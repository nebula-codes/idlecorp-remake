import { levelFromXp, qualityChance, rules } from '../../../packages/rules/src/index.js';
import { assetMap, capacityReason, chosenInputs, cycleMs, effectiveLevel, facilityMap, plusId, recipe } from './engine.js';
import { notifyCorporation } from './insights.js';
import type { Corp, Facility, Region } from './types.js';

export interface FacilityUpgradePreview {
 targetXp:number; maxScrap:number; quantity:number; targetLevel:number; qualityChance:number;
 effectiveLevel:number; enabled:boolean; reason:string|null;
}
export interface FacilityProgression {
 level:number; maxLevel:number; xp:number; xpPerLevel:number; xpIntoLevel:number; xpToNextLevel:number; progress:number; xpPerCycle:number;
 status:'producing'|'paused'|'starved'|'capacity'|'infrastructure'|'capped'|'no_xp';
 etaSeconds:number|null; etaNote:string;
 quality:{eligible:boolean;enabled:boolean;effectiveLevel:number;chance:number;nextLevelChance:number|null;nextEffectiveLevel:number|null;plusInputFraction:number;efficiencyRelic:boolean;description:string};
 upgrades:{next:FacilityUpgradePreview;available:FacilityUpgradePreview};
}
export interface FacilityLevelChange { id:string; type:string; fromLevel:number; toLevel:number; levelsGained:number; }

/** Read-only projections. XP remains earned only by successful cycles or consumed scrap. */
export function facilityProgression(f:Facility,c:Corp,r:Region,now=c.lastProcessed):FacilityProgression {
 const h=c.holdings[r.id]!,d=facilityMap.get(f.type),maxLevel=rules.maxFacilityLevel,xpPerLevel=rules.facilityXpPerLevel,maxXp=maxLevel*xpPerLevel;
 const xp=f.xp,level=levelFromXp(xp),capped=xp>=maxXp,xpIntoLevel=capped?xpPerLevel:xp-level*xpPerLevel,xpToNextLevel=capped?0:xpPerLevel-xpIntoLevel;
 const rec=recipe(f,c,r),inputs=chosenInputs(f,h,c,r).items,producer=Object.keys(d?.outputs||{}).length>0,xpPerCycle=producer?Number(d?.xp||0):0;
 const eligible=producer&&Object.keys(rec.outputs).some(id=>id!=='cash'&&assetMap.has(plusId(id))),enabled=eligible&&f.plus;
 const total=Object.values(inputs).reduce((sum,n)=>sum+n,0),plus=Object.entries(inputs).filter(([id])=>id.endsWith('_plus')).reduce((sum,[,n])=>sum+n,0),plusInputFraction=total?plus/total:0;
 const effectiveAt=(targetLevel:number)=>effectiveLevel({...f,level:targetLevel},r,c);
 const chanceAt=(targetLevel:number)=>enabled?qualityChance(effectiveAt(targetLevel),plusInputFraction):0;
 const efficiencyRelic=enabled&&(c.space.vault.relic_of_efficiency||0)>0;
 const missing=Object.entries(inputs).some(([id,n])=>id==='cash'?c.cash<n:(h.inventory[id]||0)<n);
 const status:FacilityProgression['status']=capped?'capped':!producer?'infrastructure':!f.enabled?'paused':missing?'starved':capacityReason(f,h,c,r)?'capacity':xpPerCycle<=0?'no_xp':'producing';
 const cycles=xpPerCycle>0?Math.ceil(xpToNextLevel/xpPerCycle):0;
 const etaSeconds=status==='producing'?Math.ceil((Math.max(0,f.nextCycle-now)+Math.max(0,cycles-1)*cycleMs(f,c,r))/1000):null;
 const etaNote=status==='producing'?'Conditional estimate: every future cycle must succeed at the current speed. The first cycle uses its saved completion time; later changes to inputs, capacity or modifiers are not predicted.':status==='capped'?'Maximum facility level reached.':status==='infrastructure'?'Infrastructure has no production cycle and earns no automatic cycle XP.':status==='no_xp'?'This recipe grants no XP per cycle.':`No running ETA while this facility is ${status}.`;
 const scrap=Number(h.inventory.scrap||0),remaining=Math.max(0,maxXp-xp);
 const preview=(quantity:number):FacilityUpgradePreview=>{
  const targetXp=xp+quantity,targetLevel=levelFromXp(targetXp);
  const reason=capped?'Maximum facility level reached.':h.locks.includes('scrap')?'Scrap is locked. Unlock it in Inventory before upgrading.':quantity<=0?'No scrap is available in this region.':scrap<quantity?`Requires ${quantity.toLocaleString('en-US')} scrap; ${scrap.toLocaleString('en-US')} is available in this region.`:null;
  return {targetXp,maxScrap:quantity,quantity,targetLevel,qualityChance:chanceAt(targetLevel),effectiveLevel:effectiveAt(targetLevel),enabled:reason===null,reason};
 };
 const description=!eligible?(producer?'This recipe has no quality-eligible output. Levels do not increase its output, speed or XP per cycle.':'Infrastructure levels do not improve its operational function; there is no production-cycle quality output.'):!enabled?'Quality output is disabled. Levels will not improve current output unless quality rolls are enabled.':efficiencyRelic?'The efficiency relic converts a successful quality roll into twice the normal output instead of plus output. The displayed chance includes current technology, services and plus-input stock, is capped at 100%, and does not change speed or XP per cycle.':'Each successful cycle rolls this chance for plus output. It includes current technology, services and plus-input stock, is capped at 100%, and does not change speed, recipe quantity or XP per cycle.';
 return {level,maxLevel,xp,xpPerLevel,xpIntoLevel,xpToNextLevel,progress:capped?1:xpIntoLevel/xpPerLevel,xpPerCycle,status,etaSeconds,etaNote,
  quality:{eligible,enabled,effectiveLevel:effectiveAt(level),chance:chanceAt(level),nextLevelChance:capped?null:chanceAt(level+1),nextEffectiveLevel:capped?null:effectiveAt(level+1),plusInputFraction,efficiencyRelic,description},
  upgrades:{next:preview(xpToNextLevel),available:preview(Math.min(scrap,remaining))}};
}

/** A single durable message per corporation/region/settlement, including multi-level catch-up. */
export function notifyFacilityLevels(c:Corp,r:Region,changes:FacilityLevelChange[],at:number,source:'production'|'scrap') {
 const gained=changes.filter(change=>change.toLevel>change.fromLevel).sort((a,b)=>a.id.localeCompare(b.id));if(!gained.length)return;
 const total=gained.reduce((sum,change)=>sum+change.levelsGained,0),count=gained.length;
 const detail=gained.slice(0,3).map(change=>`${facilityMap.get(change.type)?.name||change.type} #${change.id.slice(0,8)}: level ${change.fromLevel} to ${change.toLevel}`).join('; ');
 notifyCorporation(c,'facility_level',`${count===1?'Facility leveled up':`${count} facilities leveled up`} in ${r.name}`,`${total} ${total===1?'level':'levels'} gained ${source==='scrap'?'using scrap':'through production'}. ${detail}${count>3?`; and ${count-3} more.`:'.'}`,at,gained[0]!.id,{regionId:r.id,facilityIds:gained.map(change=>change.id),changes:gained,source});
}
