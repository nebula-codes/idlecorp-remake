import { describe, expect, it } from 'vitest';
import { facilityEffects } from '../apps/server/src/facility-effects.js';
import { advance, createCorp, createWorld, cycleMs, effectiveLevel, facilityMap, MAX, recipe, snapshot } from '../apps/server/src/engine.js';
import { facilityFlow } from '../apps/server/src/resource-balances.js';
import { rules, services } from '../packages/rules/src/index.js';
import type { Facility, Game } from '../apps/server/src/types.js';

const NOW=Date.parse('2026-10-10T12:00:00Z');
function setup(){
 const world=createWorld(NOW),c=createCorp('effects-corp','Effects fixture',NOW,world),r=world.regions[0]!,h=c.holdings[r.id]!,game:Game={world,corps:[c]};
 for(const region of world.regions){region.modifiers={oil:1,soil:1,industry:1,solar:1,minerals:1};region.happiness=50;}
 const make=(type:string,holding=h)=>{const d=facilityMap.get(type)!;const f:Facility={id:`fixture-${type}-${holding.facilities.length}`,type,level:0,xp:0,nextCycle:NOW+(d.cycleSeconds||60)*1000,enabled:true,plus:true,allowPlus:false,installed:[],costPaid:d.cost,materialsPaid:{...d.materials},builtAt:NOW};holding.facilities.push(f);for(const[id,n]of Object.entries(d.inputs))holding.inventory[id]=Number(n)*100;return f;};
 return {world,c,r,h,game,make};
}
function fund(r:ReturnType<typeof setup>['r'],id:string){r.services[id]=services.find(s=>s.id===id)!.cost;}

describe('authoritative facility modifier explanations',()=>{
 it('explains the 8.889s oil cycle and retains opposing factors even when their product cancels',()=>{
  const {c,r,make}=setup(),f=make('oil_well');r.modifiers.oil=.9;c.rewards.vote=NOW;
  const effects=facilityEffects(f,c,r);expect(effects.cycle).toEqual({baseSeconds:10,adjustedSeconds:10,speedMultiplier:1.125,effectiveSeconds:8.889,floorApplied:false});
  expect(effects.entries.find(e=>e.id==='regional-roll')).toMatchObject({tone:'negative',category:'speed',scope:'Shared region'});
  expect(effects.entries.find(e=>e.id==='supporter-boon')).toMatchObject({tone:'positive',expiresAt:NOW+rules.vote.boonSeconds*1000});
  expect(effects.positiveCount).toBe(1);expect(effects.negativeCount).toBe(1);
  r.modifiers.oil=.8;const cancelled=facilityEffects(f,c,r);expect(cancelled.cycle!.effectiveSeconds).toBe(10);expect(cancelled.positiveCount).toBe(1);expect(cancelled.negativeCount).toBe(1);
 });
 it('uses current happiness rather than newly funded parks or newly enacted happiness policies',()=>{
  const {c,r,make}=setup(),f=make('oil_well');fund(r,'large_park');r.policies=['low_income_tax'];
  expect(facilityEffects(f,c,r).entries.some(e=>e.id==='happiness')).toBe(false);
  r.happiness=60;const effects=facilityEffects(f,c,r);expect(effects.entries.find(e=>e.id==='happiness')).toMatchObject({value:'60 / 100 · +2% speed',tone:'positive'});expect(effects.cycle!.effectiveSeconds).toBe(9.804);
  r.happiness=10;expect(facilityEffects(f,c,r).entries.find(e=>e.id==='happiness')!.tone).toBe('negative');
 });
 it('adds organic farming to the soil factor and excludes unrelated regional/policy modifiers',()=>{
  const {c,r,make}=setup(),farm=make('tree_farm'),steel=make('steel_mill');r.modifiers.soil=.9;r.modifiers.industry=1.8;r.policies=['organic_farming','regional_planning','solar_subsidies'];
  const effects=facilityEffects(farm,c,r);expect(effects.cycle!.speedMultiplier).toBe(1);expect(effects.entries.find(e=>e.id==='policy:organic_farming:speed')).toMatchObject({tone:'positive',category:'speed'});
  expect(effects.entries.find(e=>e.id==='regional-roll')!.tone).toBe('negative');expect(effects.entries.find(e=>e.id==='policy:organic_farming:speed')!.description).toContain('additive');
  expect(facilityEffects(steel,c,r).entries).toEqual([]);expect(facilityEffects(steel,c,r).cycle!.effectiveSeconds).toBe(35);
 });
 it('includes each stacked regional technology from other hosts and preserves the one-second floor',()=>{
  const {c,r,h,make}=setup(),f=make('tree_farm'),host=make('tree_farm');host.installed=['log_loader_uu','robotic_automation','robotic_automation_u'];h.inventory.wood=10;
  const effects=facilityEffects(f,c,r);expect(effects.cycle!.adjustedSeconds).toBe(1);expect(effects.cycle!.speedMultiplier).toBeCloseTo(1.065);expect(effects.cycle!.effectiveSeconds).toBe(1);expect(effects.cycle!.floorApplied).toBe(true);
  expect(effects.entries.filter(e=>e.id.startsWith(`technology:${host.id}:`)&&e.category==='speed')).toHaveLength(2);
  expect(effects.entries.find(e=>e.id===`technology:${host.id}:0:cycle`)!.description).toContain('Installed on Tree farm');expect(effects.entries.find(e=>e.id==='cycle-minimum')!.tone).toBe('negative');
 });
 it('handles local airport count, stacked tram reductions, tourism fuel and the pre-speed floor',()=>{
  const {c,r,h,world,make}=setup(),f=make('airport');make('airport').installed=['airport_tram','airport_tram_u'];make('airport');make('airport',c.holdings[world.regions[1]!.id]!);
  c.entitlement='plus';r.policies=['tourism_campaign'];h.inventory.jet_fuel=1000;
  const effects=facilityEffects(f,c,r);expect(effects.cycle).toEqual({baseSeconds:30,adjustedSeconds:30,speedMultiplier:1.25,effectiveSeconds:24,floorApplied:true});
  expect(effects.entries.find(e=>e.id==='airport-count')!.value).toBe('3 airports · 31 s base');expect(effects.entries.find(e=>e.id==='airport-minimum')!.tone).toBe('negative');
  expect(effects.entries.find(e=>e.id==='policy:tourism_campaign:inputs')).toMatchObject({value:'+4 jet fuel / cycle',tone:'negative'});expect(recipe(f,c,r).inputs.jet_fuel).toBe(24);
  expect(effects.quality).toBeUndefined();expect(effects.entries.some(e=>e.category==='quality')).toBe(false);
 });
 it('uses simulation time for expiring boons, haste and capped projects without double counting entitlement',()=>{
  const {c,r,make}=setup(),f=make('oil_well');c.rewards.vote=NOW-rules.vote.boonSeconds*1000;c.rewards.haste=NOW;
  r.projectBenefits=[{effect:{productionSpeed:.05},expiresAt:NOW}];expect(facilityEffects(f,c,r).entries).toEqual([]);
  c.rewards.vote=NOW;c.rewards.haste=NOW+1000;c.entitlement='gold';r.projectBenefits=[1,2,3].map(n=>({effect:{productionSpeed:.05},expiresAt:NOW+n*1000}));
  const effects=facilityEffects(f,c,r);expect(effects.entries.filter(e=>e.id==='supporter-boon')).toHaveLength(1);expect(effects.entries.find(e=>e.id==='supporter-boon')!.expiresAt).toBeUndefined();
  expect(effects.entries.find(e=>e.id==='haste')!.expiresAt).toBe(NOW+1000);expect(effects.entries.find(e=>e.id==='cooperative-speed')).toMatchObject({value:'+10% speed',expiresAt:NOW+2000});
  expect(effects.cycle!.speedMultiplier).toBeCloseTo(1.25*1.25*1.1);c.lastProcessed=NOW+2000;
  const later=facilityEffects(f,c,r);expect(later.entries.some(e=>e.id==='haste')).toBe(false);expect(later.entries.find(e=>e.id==='cooperative-speed')!.value).toBe('+5% speed');
 });
 it('separates output changes from speed and uses the final recipe after replacement',()=>{
  const {c,r,make}=setup(),oil=make('oil_well'),oilHost=make('oil_well');oilHost.installed=['oil_mapping_u'];
  const oilEffects=facilityEffects(oil,c,r);expect(oilEffects.entries.find(e=>e.category==='output')!.value).toBe('18 Crude oil / cycle');expect(oilEffects.cycle!.effectiveSeconds).toBe(10);
  const refinery=make('oil_refinery');make('oil_refinery').installed=['jet_fuel_refining_u','vacuum_distillation'];
  const effects=facilityEffects(refinery,c,r);expect(recipe(refinery,c,r).outputs).toEqual({jet_fuel:1});expect(effects.entries.find(e=>e.id.endsWith(':output-replacement'))).toMatchObject({value:'Jet fuel output',tone:'neutral'});expect(effects.cycle!.effectiveSeconds).toBe(1);expect(effects.cycle!.adjustedSeconds).toBe(-7);
 });
 it('exposes the next effective garden and freight expiry while respecting caps and avoiding duplicate speed bonuses',()=>{
  const {c,r,make}=setup(),oil=make('oil_well'),logistics=make('logistics_center');
  r.happiness=56;r.projectHappiness=6;r.projectBenefits=[1,2,3].flatMap(n=>[{effect:{happiness:3},expiresAt:NOW+n*1000},{effect:{exportSpeed:.1},expiresAt:NOW+n*1000}]);
  const effects=facilityEffects(oil,c,r),happy=effects.entries.find(e=>e.id==='happiness')!;
  expect(happy).toMatchObject({value:'56 / 100 · +1.2% speed',expiresAt:NOW+2000});expect(happy.description).toContain('counted only once');expect(effects.positiveCount).toBe(1);expect(effects.cycle!.speedMultiplier).toBe(1.012);
  expect(facilityEffects(logistics,c,r).entries.find(e=>e.id==='cooperative-exports')).toMatchObject({category:'operation',value:'20% shorter new exports',expiresAt:NOW+2000});
  r.happiness=50;r.projectHappiness=3;r.projectBenefits=[{effect:{happiness:3},expiresAt:NOW+1000}];const neutral=facilityEffects(oil,c,r);expect(neutral.entries.find(e=>e.id==='happiness')).toMatchObject({tone:'neutral',expiresAt:NOW+1000});
 });
 it('matches authoritative quality inputs, effective levels and efficiency conversion without changing speed',()=>{
  const {c,r,h,make}=setup(),f=make('furniture_factory');f.level=10;f.allowPlus=true;h.inventory.wood_plus=5;make('tree_farm').installed=['quality_control_u'];fund(r,'fiber_infrastructure');c.space.vault.relic_of_efficiency=2;
  const before=cycleMs(f,c,r),effects=facilityEffects(f,c,r);expect(effectiveLevel(f,r,c)).toBe(19);expect(effects.quality!.chance).toBeCloseTo(.1425);expect(effects.quality!.chance).toBe(facilityFlow(f,c,r).chance);
  expect(effects.entries.find(e=>e.id==='plus-inputs')!.value).toBe('50% of next-cycle inputs are plus');expect(effects.entries.find(e=>e.id==='efficiency-relic')).toMatchObject({category:'output',tone:'positive'});expect(effects.cycle!.effectiveSeconds*1000).toBe(before);
  f.plus=false;const disabled=facilityEffects(f,c,r);expect(disabled.quality!.chance).toBe(0);expect(disabled.entries.find(e=>e.id==='fiber-infrastructure')!.tone).toBe('neutral');expect(disabled.entries.some(e=>e.id==='efficiency-relic')).toBe(false);
 });
 it('caps quality at100% and does not report unused input preference as an additional buff',()=>{
  const {c,r,h,make}=setup(),f=make('furniture_factory');f.level=200;f.allowPlus=true;h.inventory.wood_plus=10;
  const effects=facilityEffects(f,c,r);expect(effects.quality!.chance).toBe(1);expect(effects.entries.some(e=>e.id==='plus-inputs'&&e.tone==='positive')).toBe(false);
 });
 it('reports simultaneous operating blockers as potential rates and does not mutate schedules or economics',()=>{
  const {game,c,r,h,make}=setup(),f=make('steel_mill');f.enabled=false;h.inventory.coal=0;h.inventory.steel=MAX;
  const before=JSON.stringify(game),next=f.nextCycle,effects=facilityEffects(f,c,r);expect(effects.entries.filter(e=>e.category==='operation').map(e=>e.id)).toEqual(['operation:paused','operation:starved','operation:capacity']);
  expect(effects.entries.filter(e=>e.category==='operation').every(e=>e.tone==='negative')).toBe(true);expect(effects.entries.find(e=>e.id==='operation:starved')!.description).toContain('potential');
  const snap=snapshot(game,c,NOW);expect(snap.holdings[r.id].facilities[0].effects).toEqual(effects);expect(f.nextCycle).toBe(next);expect(JSON.stringify(game)).toBe(before);
 });
 it('omits irrelevant production and quality effects on infrastructure while exposing operational benefits',()=>{
  const {c,r,make}=setup(),hq=make('hq'),logistics=make('logistics_center'),research=make('research_facility');hq.installed=['robotic_automation','quality_control'];logistics.installed=['logistics_expansion_u'];c.entitlement='platinum';c.rewards.haste=NOW+1000;r.happiness=100;fund(r,'fiber_infrastructure');
  const noCycle=facilityEffects(hq,c,r);expect(noCycle.cycle).toBeUndefined();expect(noCycle.quality).toBeUndefined();expect(noCycle.entries.map(e=>e.id)).toEqual(['infrastructure']);expect(noCycle.positiveCount).toBe(0);
  const logisticsEffects=facilityEffects(logistics,c,r);expect(logisticsEffects.entries.some(e=>e.id.endsWith(':buy-limit'))).toBe(true);expect(logisticsEffects.entries.every(e=>e.category==='operation')).toBe(true);expect(logisticsEffects.entries.find(e=>e.id==='logistics-total')!.value).toBe('$6,600,000 / h');
  fund(r,'university');r.policies=['research_grant'];c.space.vault.relic_of_haste=2;c.season.claimed=[2,7];const researchEffects=facilityEffects(research,c,r);
  expect(researchEffects.entries.map(e=>e.id)).toEqual(['infrastructure','university','policy:research_grant:research','research-haste-relics','season:research-time','season:research-cost']);expect(researchEffects.cycle).toBeUndefined();
 });
 it('keeps pure snapshot projections equal to simulation timings across all facility families',()=>{
  const {game,c,r,make}=setup();c.entitlement='plus';c.rewards.haste=NOW+10000;r.happiness=67;r.modifiers={oil:.88,soil:1.21,solar:.97,minerals:1.15,industry:.84};r.policies=['organic_farming','tourism_campaign'];
  const host=make('tree_farm');host.installed=['robotic_automation','robotic_automation_u'];
  for(const d of facilityMap.values())if(Object.keys(d.outputs).length){const f=make(d.id),effects=facilityEffects(f,c,r),cycle=effects.cycle!;expect(cycle.effectiveSeconds).toBe(cycleMs(f,c,r)/1000);expect(cycle.effectiveSeconds).toBe(Math.max(1000,Math.round(cycle.adjustedSeconds*1000/cycle.speedMultiplier))/1000);}
  // Snapshot explains current modifiers without altering any already scheduled cycle.
  const scheduled=game.corps[0]!.holdings[r.id]!.facilities.map(f=>f.nextCycle);snapshot(game,c,NOW);expect(game.corps[0]!.holdings[r.id]!.facilities.map(f=>f.nextCycle)).toEqual(scheduled);
 });
 it('keeps successful-cycle outcomes unchanged when explanation is requested between ticks',()=>{
  const {game,c,r,make}=setup(),f=make('oil_well');f.level=20;c.rng=123456;c.rewards.vote=NOW;r.happiness=60;make('oil_well').installed=['oil_mapping','oil_specialization'];
  const control=structuredClone(game);snapshot(game,c,NOW);advance(game,NOW+120000);advance(control,NOW+120000);
  expect(game).toEqual(control);
 });
});
