import { describe, expect, it } from 'vitest';
import { advance, createCorp, createWorld, cycleMs, facilityMap, MAX, snapshot } from '../apps/server/src/engine.js';
import { executeAction } from '../apps/server/src/actions.js';
import { facilityProgression } from '../apps/server/src/facility-progression.js';
import { facilityFlow } from '../apps/server/src/resource-balances.js';
import { levelFromXp, rules, services } from '../packages/rules/src/index.js';
import type { Corp, Facility, Game } from '../apps/server/src/types.js';

const NOW=Date.parse('2026-10-10T12:00:00Z'),PER_LEVEL=rules.facilityXpPerLevel,CAP=PER_LEVEL*rules.maxFacilityLevel;
function setup(){
 const world=createWorld(NOW),c=createCorp('progression-a','Progression A',NOW,world),r=world.regions[0]!,h=c.holdings[r.id]!,game:Game={world,corps:[c]};
 for(const region of world.regions){region.modifiers={soil:1,oil:1,solar:1,minerals:1,industry:1};region.happiness=50;}
 const make=(type='tree_farm',xp=0,corp:Corp=c,region=r)=>{const holding=corp.holdings[region.id]!,d=facilityMap.get(type)!,f:Facility={id:`${corp.id}-${region.id}-${holding.facilities.length}`,type,xp,level:levelFromXp(xp),enabled:true,plus:true,allowPlus:false,installed:[],nextCycle:NOW+(d.cycleSeconds||60)*1000,costPaid:d.cost,materialsPaid:{...d.materials},builtAt:NOW};holding.facilities.push(f);for(const[id,q]of Object.entries(d.inputs||{}))holding.inventory[id]=Number(q)*100;return f;};
 const action=(a:Record<string,unknown>,at=c.lastProcessed)=>executeAction(game,c,{type:'facility.addxp',regionId:r.id,...a},at);
 return {game,world,c,r,h,make,action};
}
function levels(c:Corp){return (c.notificationsList||[]).filter(n=>n.type==='facility_level');}

describe('facility progression projection',()=>{
 it('exposes exact XP boundaries and an ETA that retains the already scheduled first cycle',()=>{
  const {c,r,h,make}=setup(),f=make();h.inventory.scrap=10;
  let p=facilityProgression(f,c,r);expect(p).toMatchObject({level:0,xp:0,xpPerLevel:100000,xpIntoLevel:0,xpToNextLevel:100000,progress:0,xpPerCycle:1,status:'producing',etaSeconds:500000});
  f.xp=99990;f.nextCycle=NOW+1250;p=facilityProgression(f,c,r);expect(p.progress).toBe(.9999);expect(p.etaSeconds).toBe(47);expect(p.upgrades.next).toMatchObject({targetXp:100000,maxScrap:10,quantity:10,targetLevel:1,qualityChance:.005,enabled:true,reason:null});
  c.entitlement='plus';expect(cycleMs(f,c,r)).toBe(4000);expect(facilityProgression(f,c,r).etaSeconds).toBe(38);
  f.xp=100000;f.level=1;p=facilityProgression(f,c,r);expect(p).toMatchObject({level:1,xpIntoLevel:0,xpToNextLevel:100000,progress:0});expect(p.quality.nextLevelChance).toBe(.01);
 });
 it('does not fabricate running ETA for paused, starved, full, infrastructure or capped facilities',()=>{
  const {c,r,h,make}=setup(),paused=make(),starved=make('steel_mill'),full=make('oil_well'),infra=make('air_traffic_control'),capped=make('tree_farm',CAP);
  paused.enabled=false;h.inventory.coal=0;h.inventory.crude_oil=MAX;
  for(const[f,status]of [[paused,'paused'],[starved,'starved'],[full,'capacity'],[infra,'infrastructure'],[capped,'capped']] as const){const p=facilityProgression(f,c,r);expect(p.status).toBe(status);expect(p.etaSeconds).toBeNull();}
  expect(facilityProgression(infra,c,r).xpPerCycle).toBe(0);expect(facilityProgression(infra,c,r).quality).toMatchObject({eligible:false,enabled:false,chance:0,nextLevelChance:0});
  const p=facilityProgression(capped,c,r);expect(p.progress).toBe(1);expect(p.xpToNextLevel).toBe(0);expect(p.quality.nextLevelChance).toBeNull();expect(p.upgrades.next).toMatchObject({quantity:0,maxScrap:0,targetXp:CAP,targetLevel:50,enabled:false});
 });
 it('uses recipe quality eligibility, shared technologies, fiber, plus inputs and efficiency conversion',()=>{
  const {c,r,h,make}=setup(),f=make('furniture_factory',10*PER_LEVEL);f.allowPlus=true;h.inventory.wood_plus=5;h.inventory.scrap=250000;make().installed=['quality_control_u'];r.services.fiber_infrastructure=services.find(s=>s.id==='fiber_infrastructure')!.cost;c.space.vault.relic_of_efficiency=1;
  const p=facilityProgression(f,c,r);expect(p.quality).toMatchObject({eligible:true,enabled:true,effectiveLevel:19,plusInputFraction:.5,efficiencyRelic:true,nextEffectiveLevel:20});expect(p.quality.chance).toBeCloseTo(.1425);expect(p.quality.chance).toBe(facilityFlow(f,c,r).chance);expect(p.quality.nextLevelChance).toBeCloseTo(.15);expect(p.quality.description).toContain('twice the normal output');
  expect(p.upgrades.available).toMatchObject({quantity:250000,maxScrap:250000,targetXp:1250000,targetLevel:12,effectiveLevel:21,enabled:true});expect(p.upgrades.available.qualityChance).toBeCloseTo(.1575);
  const airport=make('airport',PER_LEVEL);expect(facilityProgression(airport,c,r).quality.chance).toBe(0);expect(facilityProgression(airport,c,r).quality.nextLevelChance).toBe(0);
  f.plus=false;const disabled=facilityProgression(f,c,r);expect(disabled.quality.chance).toBe(0);expect(disabled.quality.nextLevelChance).toBe(0);expect(disabled.upgrades.available.qualityChance).toBe(0);expect(disabled.quality.efficiencyRelic).toBe(false);
 });
 it('offers only real regional scrap, shows disabled reasons and caps available spend at remaining XP',()=>{
  const {c,r,h,world,make}=setup(),f=make('tree_farm',PER_LEVEL-20);c.holdings[world.regions[1]!.id]!.inventory.scrap=100000;
  let p=facilityProgression(f,c,r);expect(p.upgrades.next).toMatchObject({quantity:20,enabled:false});expect(p.upgrades.available).toMatchObject({quantity:0,enabled:false});
  h.inventory.scrap=10;p=facilityProgression(f,c,r);expect(p.upgrades.next.reason).toContain('Requires 20 scrap');expect(p.upgrades.available).toMatchObject({quantity:10,targetXp:99990,targetLevel:0,qualityChance:0,enabled:true});
  h.locks=['scrap'];p=facilityProgression(f,c,r);expect(p.upgrades.available.reason).toContain('locked');expect(p.upgrades.next.reason).toContain('locked');
  h.locks=[];h.inventory.scrap=100;f.xp=CAP-20;f.level=49;p=facilityProgression(f,c,r);expect(p.upgrades.available).toMatchObject({targetXp:CAP,quantity:20,maxScrap:20,targetLevel:50,enabled:true});
 });
 it('adds progression to snapshots without changing XP, stock, quality rolls or scheduled cycles',()=>{
  const {game,c,r,h,make}=setup(),f=make('oil_refinery',123456);h.inventory.scrap=300000;const before=JSON.stringify(game),p=facilityProgression(f,c,r),s=snapshot(game,c,NOW);
  expect(s.holdings[r.id].facilities[0].progression).toEqual(p);expect(JSON.stringify(game)).toBe(before);
 });
});

describe('confirmed XP target upgrades',()=>{
 it('spends less than the frozen maximum when production advances before confirmation',()=>{
  const {game,c,r,h,make,action}=setup(),f=make('tree_farm',99990);h.inventory.scrap=100;f.nextCycle=NOW+1000;const preview=facilityProgression(f,c,r).upgrades.next;
  advance(game,NOW+1001);const schedule=f.nextCycle;expect(f.xp).toBe(99991);const result=action({id:f.id,targetXp:preview.targetXp,maxScrap:preview.maxScrap});
  expect(result.facilityUpgrade).toMatchObject({spentScrap:9,xp:100000,level:1});expect(h.inventory.scrap).toBe(91);expect(f.nextCycle).toBe(schedule);expect(levels(c)).toHaveLength(1);expect(levels(c)[0]!.source).toBe('scrap');
 });
 it('rejects an already-reached confirmation instead of spending scrap toward a different level',()=>{
  const {game,c,r,h,make,action}=setup(),f=make('tree_farm',99999);h.inventory.scrap=100;f.nextCycle=NOW+1000;const preview=facilityProgression(f,c,r).upgrades.next;
  advance(game,NOW+1000);expect(f.xp).toBe(100000);expect(()=>action({id:f.id,targetXp:preview.targetXp,maxScrap:preview.maxScrap})).toThrow(/already reached/);expect(h.inventory.scrap).toBe(100);expect(f.xp).toBe(100000);expect(levels(c)).toHaveLength(1);expect(levels(c)[0]!.source).toBe('production');
 });
 it('preflights budget, stock, lock and cap before mutating scrap or facility state',()=>{
  const {h,make,action}=setup(),f=make('tree_farm',99990);h.inventory.scrap=9;
  const unchanged=(payload:Record<string,unknown>,match:RegExp)=>{const before=JSON.stringify({f,inventory:h.inventory});expect(()=>action({id:f.id,...payload})).toThrow(match);expect(JSON.stringify({f,inventory:h.inventory})).toBe(before);};
  unchanged({targetXp:100000,maxScrap:9},/budget/);unchanged({targetXp:100000,maxScrap:10},/Insufficient scrap/);unchanged({quantity:10},/Insufficient scrap/);
  h.inventory.scrap=100;h.locks=['scrap'];unchanged({targetXp:100000,maxScrap:10},/locked/);h.locks=[];unchanged({targetXp:CAP+1,maxScrap:MAX},/Target XP/);unchanged({quantity:CAP},/level cap/);
 });
 it('rejects malformed, unpaired and mixed target requests while preserving legacy quantities',()=>{
  const {h,make,action}=setup(),f=make();h.inventory.scrap=1000;
  for(const payload of [{targetXp:100,maxScrap:100,quantity:100},{targetXp:100},{maxScrap:100},{targetXp:0,maxScrap:100},{targetXp:1.5,maxScrap:100},{targetXp:NaN,maxScrap:100},{targetXp:'100',maxScrap:100},{targetXp:100,maxScrap:0},{targetXp:100,maxScrap:Infinity},{targetXp:100,maxScrap:1.5}])expect(()=>action({id:f.id,...payload})).toThrow();
  expect(f.xp).toBe(0);expect(h.inventory.scrap).toBe(1000);expect(action({id:f.id,quantity:100}).facilityUpgrade).toMatchObject({spentScrap:100,xp:100,level:0});expect(h.inventory.scrap).toBe(900);
 });
 it('uses at most the confirmed available scrap even if new scrap arrives, and handles the cap exactly',()=>{
  const {game,c,r,h,make,action}=setup(),f=make('tree_farm',CAP-20);h.inventory.scrap=100;const p=facilityProgression(f,c,r).upgrades.available;
  advance(game,NOW+25000);expect(f.xp).toBe(CAP-15);h.inventory.scrap=200;const result=action({id:f.id,targetXp:p.targetXp,maxScrap:p.maxScrap});expect(result.facilityUpgrade.spentScrap).toBe(15);expect(h.inventory.scrap).toBe(185);expect(f.level).toBe(50);expect(f.xp).toBe(CAP);
  expect(()=>action({id:f.id,quantity:1})).toThrow(/level cap/);expect(h.inventory.scrap).toBe(185);
 });
 it('records one scrap notification for a multi-level jump, but none for XP that does not reach a level',()=>{
  const {c,r,h,make,action}=setup(),f=make();h.inventory.scrap=300000;action({id:f.id,quantity:50});expect(levels(c)).toHaveLength(0);
  action({id:f.id,targetXp:250000,maxScrap:249950});expect(levels(c)).toHaveLength(1);expect(levels(c)[0]).toMatchObject({type:'facility_level',source:'scrap',regionId:r.id,facilityIds:[f.id],changes:[{id:f.id,type:'tree_farm',fromLevel:0,toLevel:2,levelsGained:2}],read:false});
 });
});

describe('grouped durable production level feedback',()=>{
 it('groups crossings per corporation and region, preserves facility changes and never repeats old crossings',()=>{
  const {game,world,c,r,h,make}=setup(),a=make('tree_farm',99999),b=make('tree_farm',199998),otherRegion=world.regions[1]!,distant=make('tree_farm',299999,c,otherRegion),other=createCorp('progression-b','Progression B',NOW,world);game.corps.push(other);const second=make('tree_farm',99999,other,r);
  for(const f of [a,b,distant,second])f.nextCycle=NOW+1000;
  advance(game,NOW+6000);const local=levels(c).find(n=>n.regionId===r.id)!;expect(levels(c)).toHaveLength(2);expect(local.changes).toEqual([{id:a.id,type:a.type,fromLevel:0,toLevel:1,levelsGained:1},{id:b.id,type:b.type,fromLevel:1,toLevel:2,levelsGained:1}]);expect(local.facilityIds).toEqual([a.id,b.id]);expect(levels(other)).toHaveLength(1);
  const ids=levels(c).map(n=>n.id);advance(game,NOW+6000);advance(game,NOW+11000);expect(levels(c).map(n=>n.id)).toEqual(ids);
  const restarted=JSON.parse(JSON.stringify(game)) as Game;advance(restarted,NOW+16000);expect(levels(restarted.corps[0]!).map(n=>n.id)).toEqual(ids);expect(snapshot(game,c,NOW+11000).notifications.find(n=>n.id===local.id)).toEqual(local);expect(h.facilities[0]!.xp).toBe(100002);
 });
 it('coalesces a real multi-level offline catch-up without changing one-XP-per-cycle balance',()=>{
  const {game,c,r,make}=setup(),f=make('tree_farm',99999);advance(game,NOW+600000000);
  expect(f.level).toBeGreaterThanOrEqual(2);expect(f.xp).toBe(99999+f.metrics!.successfulCycles);expect(levels(c)).toHaveLength(1);expect(levels(c)[0]).toMatchObject({regionId:r.id,source:'production',changes:[{id:f.id,type:f.type,fromLevel:0,toLevel:f.level,levelsGained:f.level}]});
 });
});
