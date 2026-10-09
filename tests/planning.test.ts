import { describe,it,expect } from 'vitest';
import { createCorp,createWorld,buildCost,facilityMap,marketPrice } from '../apps/server/src/engine.js';
import { planProduction,onboardingProgress } from '../apps/server/src/planning.js';
import { executeAction } from '../apps/server/src/actions.js';
import { rules,services } from '../packages/rules/src/index.js';
import type { Corp,Facility,Game } from '../apps/server/src/types.js';

const NOW=Date.parse('2026-10-09T12:00:00Z');
function setup(){
  const world=createWorld(NOW);for(const r of world.regions){r.modifiers={soil:1,oil:1,minerals:1,industry:1,solar:1};r.happiness=50;}
  const corp=createCorp('planner-owner','Planner owner',NOW,world),game:Game={world,corps:[corp]},regionId=world.regions[0]!.id;
  const h=corp.holdings[regionId]!;h.land=100;corp.rng=123456;
  return {game,corp,h,regionId,r:world.regions[0]!,plan:(facilityId?:string,quantity?:number)=>planProduction(game,corp,{regionId,facilityId,quantity,now:NOW})};
}
function seed(c:Corp,regionId:string,type:string,id=type):Facility {
  const d=facilityMap.get(type)!;
  const f:Facility={id,type,level:0,xp:0,nextCycle:NOW+Math.max(1,d.cycleSeconds)*1000,enabled:true,plus:true,allowPlus:false,installed:[],costPaid:d.cost,materialsPaid:{...d.materials},builtAt:NOW};c.holdings[regionId]!.facilities.push(f);return f;
}

describe('authoritative read-only construction goals',()=>{
  it('quotes actual regional cost and land while preserving every world, inventory and RNG field',()=>{
    const {game,corp,regionId,r,plan}=setup();r.policies=['solar_subsidies'];corp.cash=3_000_000_000_000;
    const before=structuredClone(game),p=plan('solar_power_plant',2);
    expect(p.goal!.requirements.cash.required).toBe(buildCost(facilityMap.get('solar_power_plant')!,r)*2);
    expect(p.goal!.quantity).toBe(2);expect(p.goal!.requirements.land.required).toBe(facilityMap.get('solar_power_plant')!.land*2);
    expect(p.regionId).toBe(regionId);expect(p.generatedAt).toBe(NOW);expect(game).toEqual(before);
  });
  it('uses a regional pin only when an explicit goal has not been selected',()=>{
    const {game,corp,regionId,plan}=setup();(corp as Corp&{pinnedGoals:Record<string,unknown>}).pinnedGoals={[regionId]:{facilityId:'coal_mine',quantity:4,createdAt:NOW}};
    expect(plan().goal!.facilityId).toBe('coal_mine');expect(plan().goal!.quantity).toBe(4);
    expect(plan('tree_farm').goal!.quantity).toBe(1);
    expect(()=>planProduction(game,corp,{regionId:'unknown',facilityId:'tree_farm'})).toThrow(/region/i);
    expect(()=>plan('tree_farm',1.5)).toThrow(/whole number/i);expect(()=>plan('tree_farm',101)).toThrow(/100/);
    expect(()=>plan('')).toThrow(/valid facility/i);expect(()=>plan('invented_factory')).toThrow(/Unknown facility/i);
  });
  it('tracks remaining construction against the pinned baseline and completes instead of requesting the same goal forever',()=>{
    const {game,corp,regionId,plan}=setup();seed(corp,regionId,'tree_farm','original');
    executeAction(game,corp,{type:'goal.pin',regionId,facilityId:'tree_farm',quantity:2},NOW);
    expect(corp.pinnedGoals![regionId]!.baselineCount).toBe(1);expect(corp.pinnedGoals![regionId]!.targetCount).toBe(3);
    let p=plan();expect(p.pinnedGoal!.remaining).toBe(2);expect(p.goal!.quantity).toBe(2);
    executeAction(game,corp,{type:'facility.build',regionId,facilityId:'tree_farm',quantity:1},NOW);p=plan();expect(p.pinnedGoal!.remaining).toBe(1);expect(p.goal!.quantity).toBe(1);expect(p.pinnedGoal!.completed).toBe(false);
    executeAction(game,corp,{type:'facility.build',regionId,facilityId:'tree_farm',quantity:1},NOW);p=plan();expect(p.pinnedGoal!.completed).toBe(true);expect(p.pinnedGoal!.currentCount).toBe(3);expect(p.goal).toBeNull();
    expect(plan('tree_farm',1).goal!.quantity).toBe(1);
  });
  it('keeps a stable owned-facility target after demolition and quotes at most one valid construction batch',()=>{
    const {corp,regionId,plan}=setup();(corp as any).pinnedGoals={[regionId]:{facilityId:'tree_farm',quantity:2,baselineCount:150,targetCount:152,createdAt:NOW}};
    const p=plan();expect(p.pinnedGoal!.remaining).toBe(152);expect(p.pinnedGoal!.nextBatchQuantity).toBe(100);expect(p.goal!.quantity).toBe(100);
  });
  it('recognizes headquarters in another region and exposes its full prerequisite chain when absent',()=>{
    const {game,corp,plan}=setup();corp.cash=3_000_000_000_000;
    const absent=plan('retail_store');expect(absent.goal!.ready).toBe(false);expect(absent.goal!.requirements.prerequisites[0]!.scope).toBe('global');
    expect(absent.graph.edges.some(e=>e.from==='asset:logistics_expansion'&&e.to==='facility:hq'&&e.kind==='construction')).toBe(true);
    expect(absent.graph.edges.some(e=>e.from==='asset:blueprint_logistics_expansion'&&e.to==='technology:logistics_expansion'&&e.quantityPerCycle===1)).toBe(true);
    expect(absent.graph.edges.some(e=>e.to==='asset:blueprint_logistics_expansion'&&e.kind==='discovery'&&e.quantityPerCycle===null)).toBe(true);
    seed(corp,game.world.regions[1]!.id,'hq');const present=plan('retail_store');expect(present.goal!.ready).toBe(true);expect(present.goal!.eta).toEqual({status:'ready',seconds:0,reasons:[]});
    expect(present.goal!.requirements.prerequisites[0]!.ownedRegions).toEqual([game.world.regions[1]!.id]);
  });
  it('does not call an apparently stocked goal ready when materials are locked, land is missing or research is capped',()=>{
    const {corp,h,regionId,plan}=setup();h.inventory.wood=1000;h.locks=['wood'];
    let p=plan('coal_mine');expect(p.goal!.requirements.materials[0]!.missing).toBe(0);expect(p.goal!.blockers.some(b=>b.code==='locked')).toBe(true);expect(p.goal!.eta.status).toBe('blocked');
    h.locks=[];h.land=0;p=plan('coal_mine');expect(p.goal!.requirements.land.missing).toBe(1);expect(p.goal!.blockers.some(b=>b.code==='land')).toBe(true);
    h.land=100;for(let i=0;i<8;i++)seed(corp,regionId,'research_facility','research-'+i);p=plan('research_facility');expect(p.goal!.blockers.some(b=>b.code==='research-cap')).toBe(true);
  });
  it('shows live NPC quotes and the remaining hourly allowance without promising automatic purchases',()=>{
    const {h,r,plan}=setup();h.purchaseDay=Math.floor(NOW/3600000);h.npcPurchases.spent=rules.baseHourlyBuyLimit-1000;
    const material=plan('coal_mine').goal!.requirements.materials[0]!;
    expect(material.npcBuyQuote!.unitPrice).toBe(marketPrice(r,'wood','buy',NOW));expect(material.npcBuyQuote!.allowanceRemaining).toBe(1000);
    expect(material.npcBuyQuote!.affordableQuantity).toBe(Math.floor(1000/material.npcBuyQuote!.unitPrice));expect(material.estimate.status).toBe('blocked');
    expect(material.actions.some(a=>a.screen==='market')).toBe(true);
  });
});

describe('production rates, shortages and qualified ETA',()=>{
  it('estimates a stocked-capital raw-material goal from real cycles and regional technology speed',()=>{
    const {corp,h,regionId,r,plan}=setup();const tree=seed(corp,regionId,'tree_farm');
    let p=plan('coal_mine'),m=p.goal!.requirements.materials[0]!;
    expect(m.outputPerMinute).toBe(24);expect(m.netPerMinute).toBe(24);expect(p.goal!.eta.status).toBe('estimate');expect(p.goal!.eta.seconds).toBe(2505);expect(p.goal!.eta.reasons.join(' ')).toContain('not completion guarantees');
    tree.installed=['log_loader_uu'];r.modifiers.soil=2;p=plan('coal_mine');m=p.goal!.requirements.materials[0]!;
    expect(m.outputPerMinute).toBe(120); // Engine enforces a one-second minimum cycle.
    expect(p.goal!.eta.seconds).toBe(505);expect(h.inventory.wood||0).toBe(0);
  });
  it('blocks overall ETA for missing capital even when material production is healthy',()=>{
    const {corp,regionId,plan}=setup();seed(corp,regionId,'tree_farm');corp.cash=0;
    const p=plan('coal_mine');expect(p.goal!.requirements.materials[0]!.estimate.status).toBe('estimate');expect(p.goal!.eta.status).toBe('blocked');expect(p.goal!.eta.seconds).toBeNull();expect(p.goal!.blockers.some(b=>b.code==='cash')).toBe(true);
  });
  it('reports starved factories and chain supply deficits instead of assuming output is available',()=>{
    const {corp,h,regionId,plan}=setup();seed(corp,regionId,'steel_mill');h.inventory.iron=200;h.inventory.crude_oil=100;
    const p=plan('oil_refinery'),steel=p.goal!.requirements.materials.find(m=>m.assetId==='steel')!;
    expect(steel.outputPerMinute).toBeGreaterThan(0);expect(steel.estimate.status).toBe('blocked');expect(p.goal!.eta.status).toBe('blocked');
    const coal=p.graph.shortages.find(s=>s.assetId==='coal')!;expect(coal.stalledFacilityIds).toEqual(['steel_mill']);expect(coal.missingForNextCycles).toBe(4);expect(coal.netPerMinute).toBeLessThan(0);
    expect(p.graph.nodes.find(n=>n.id==='facility:steel_mill')!.status).toBe('starved');
  });
  it('recognizes shared scarce stock even when each individual factory could complete a cycle',()=>{
    const {corp,h,regionId,plan}=setup();seed(corp,regionId,'steel_mill','a');seed(corp,regionId,'steel_mill','b');h.inventory.iron=100;h.inventory.coal=4;
    const coal=plan().graph.shortages.find(s=>s.assetId==='coal')!;expect(coal.stalledFacilityIds).toEqual([]);expect(coal.requiredForNextCycles).toBe(8);expect(coal.missingForNextCycles).toBe(4);expect(coal.reasons.join(' ')).toContain('completion order matters');
  });
  it('uses quality expectation, plus preferences and passive efficiency instead of counting every output as ordinary',()=>{
    const {corp,h,regionId,plan}=setup();const tree=seed(corp,regionId,'tree_farm');tree.level=50;tree.xp=5_000_000;
    let p=plan();expect(p.graph.nodes.find(n=>n.id==='asset:wood')!.outputPerMinute).toBe(18);expect(p.graph.nodes.find(n=>n.id==='asset:wood_plus')!.outputPerMinute).toBe(6);
    corp.space.vault.relic_of_efficiency=1;p=plan();expect(p.graph.nodes.find(n=>n.id==='asset:wood')!.outputPerMinute).toBe(30);
    const refinery=seed(corp,regionId,'oil_refinery');refinery.allowPlus=true;h.inventory.crude_oil_plus=100;p=plan();
    expect(p.graph.edges.some(e=>e.from==='asset:crude_oil_plus'&&e.to==='facility:oil_refinery'&&Number(e.perMinute)>0)).toBe(true);
    expect(p.graph.nodes.find(n=>n.id==='asset:crude_oil')!.inputPerMinute).toBe(0);
  });
  it('keeps a complete bounded graph with valid references for a late construction goal',()=>{
    const {plan}=setup(),p=plan('hq');const ids=new Set(p.graph.nodes.map(n=>n.id));expect(ids.size).toBe(p.graph.nodes.length);expect(ids.size).toBeLessThanOrEqual(190);
    for(const edge of p.graph.edges){expect(ids.has(edge.from)).toBe(true);expect(ids.has(edge.to)).toBe(true);}
    expect(p.goal!.missingFactories.some(f=>f.forAssets.includes('steel'))).toBe(true);expect(p.graph.notices.join(' ')).toContain('not guaranteed recipes');
  });
});

describe('progressive advice and privacy',()=>{
  it('keeps a new corporation on early guidance even when other players funded the regional office',()=>{
    const {game,corp,r}=setup();r.services.region_office=services.find(s=>s.id==='region_office')!.cost;
    const p=onboardingProgress(game,corp,NOW);expect(p.stage).toBe('early');expect(p.next!.id).toBe('first_factory');expect(p.steps.some(s=>s.stage==='governance')).toBe(false);
    expect(p.navigation.some(n=>n.screen==='region')).toBe(true);
  });
  it('derives progression from actual holdings without hiding advanced navigation or leaking another corporation',()=>{
    const {game,corp,regionId,plan}=setup();const other=createCorp('secret-other','SECRET PRIVATE CORP',NOW,game.world);other.privacy=true;other.cash=87654321;game.corps.push(other);
    expect(onboardingProgress(game,corp,NOW).stage).toBe('early');seed(corp,regionId,'logistics_center');expect(onboardingProgress(game,corp,NOW).stage).toBe('logistics');
    seed(corp,regionId,'research_facility');expect(onboardingProgress(game,corp,NOW).stage).toBe('research');seed(corp,regionId,'hq');expect(onboardingProgress(game,corp,NOW).stage).toBe('governance');seed(corp,regionId,'rocket_launch_pad');
    const advice=onboardingProgress(game,corp,NOW);expect(advice.stage).toBe('space');expect(advice.navigation.some(n=>n.screen==='prestige')).toBe(true);expect(advice.steps.find(s=>s.id==='launch_pad')!.completed).toBe(true);
    const p=plan('tree_farm');expect(JSON.stringify(p)).not.toContain('SECRET PRIVATE CORP');expect(JSON.stringify(p)).not.toContain('87654321');
  });
});
