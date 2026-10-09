import { describe, expect, it } from 'vitest';
import { createCorp, createWorld, advance, cycleMs, recipe, snapshot, landCost, netWorth, preview, stock, roll, marketPrice } from '../apps/server/src/engine.js';
import { executeAction } from '../apps/server/src/actions.js';
import { facilities, services, rules } from '../packages/rules/src/index.js';
import type { Corp, Facility, Game } from '../apps/server/src/types.js';

// Explicit deterministic progression fixtures. These never enter production API.
const NOW = Date.parse('2026-10-09T12:00:00Z');
function fixture() {
  const world = createWorld(NOW);
  for (const r of world.regions) { r.modifiers = { soil:1,oil:1,minerals:1,industry:1,solar:1 }; r.happiness=50; }
  const corp=createCorp('10000000-0000-4000-8000-000000000001','Source Fixture',NOW,world);
  corp.cash=300_000_000_000; corp.createdAt=NOW-86400000; corp.rng=123456;
  const game:Game={world,corps:[corp]};const regionId=world.regions[0]!.id;
  const h=corp.holdings[regionId]!;h.land=100;
  return {game,corp,regionId,h,r:world.regions[0]!,action:(a:Record<string,unknown>,at=NOW)=>executeAction(game,corp,{regionId,...a},at)};
}
function factory(c:Corp,regionId:string,type:string,id:string):Facility {
  const spec=facilities.find(x=>x.id===type)!;
  const f:Facility={id,type,level:0,xp:0,nextCycle:NOW+Math.max(1,spec.cycleSeconds)*1000,enabled:true,plus:true,allowPlus:false,installed:[],costPaid:spec.cost,materialsPaid:{...spec.materials},builtAt:NOW};
  c.holdings[regionId]!.facilities.push(f);return f;
}

describe('source-backed regional technology and shared services',()=>{
  it('combines nine log loaders into UU, consumes the technology and improves all regional tree farms',()=>{
    const {game,corp,regionId,h,r,action}=fixture();
    const a=factory(corp,regionId,'tree_farm','a'),b=factory(corp,regionId,'tree_farm','b');
    const other=game.world.regions[1]!;const distant=factory(corp,other.id,'tree_farm','other');
    h.inventory.log_loader=9;
    for(let i=0;i<3;i++)action({type:'technology.upgrade',technologyId:'log_loader'});
    action({type:'technology.upgrade',technologyId:'log_loader_u'});
    expect(h.inventory.log_loader_uu).toBe(1);
    const before=corp.cash,worthBefore=netWorth(corp);action({type:'technology.install',id:a.id,technologyId:'log_loader_uu'});
    expect(before-corp.cash).toBe(50_000_000);
    expect(netWorth(corp)).toBe(worthBefore-50_000_000);
    expect(h.inventory.log_loader_uu).toBe(0);
    expect(cycleMs(a,corp,r)).toBe(1000);expect(cycleMs(b,corp,r)).toBe(1000);
    expect(cycleMs(distant,corp,other)).toBe(5000);
    action({type:'technology.uninstall',id:a.id,technologyId:'log_loader_uu'});
    expect(h.inventory.log_loader_uu).toBe(1);expect(cycleMs(b,corp,r)).toBe(5000);
  });
  it('oil mapping changes every regional oil-well output without leaking into other regions',()=>{
    const {corp,game,regionId,h,r,action}=fixture();const a=factory(corp,regionId,'oil_well','a'),b=factory(corp,regionId,'oil_well','b');
    const other=game.world.regions[1]!;const distant=factory(corp,other.id,'oil_well','other');h.inventory.oil_mapping=1;
    action({type:'technology.install',id:a.id,technologyId:'oil_mapping'});
    expect(recipe(a,corp,r).outputs).toEqual({crude_oil:14});expect(recipe(b,corp,r).outputs).toEqual({crude_oil:14});
    expect(recipe(distant,corp,other).outputs).toEqual({crude_oil:10});
    const s=snapshot(game,corp,NOW);expect(s.holdings[regionId].facilities[0].outputRates.crude_oil).toBe(84);
  });
  it('funded fiber infrastructure affects both corporations and policies spend documented funding points',()=>{
    const {corp,game,regionId,r,action}=fixture();corp.cash=2_000_000_000_000;const other=createCorp('20000000-0000-4000-8000-000000000002','Second',NOW,game.world);game.corps.push(other);
    factory(corp,regionId,'tree_farm','a');factory(other,regionId,'tree_farm','b');
    const fiber=services.find(s=>s.id==='fiber_infrastructure')!;action({type:'service.fund',serviceId:fiber.id,amount:fiber.cost});
    expect(snapshot(game,corp,NOW).holdings[regionId].facilities[0].effectiveLevel).toBe(5);
    expect(snapshot(game,other,NOW).holdings[regionId].facilities[0].effectiveLevel).toBe(5);
    const office=services.find(s=>s.id==='region_office')!;r.services.region_office=office.cost;r.legislator=corp.id;
    action({type:'policy.vote',policyId:'solar_subsidies'});expect(r.fundingPoints).toBe(12);
    action({type:'policy.vote',policyId:'high_income_tax'});expect(r.fundingPoints).toBe(17);
    expect(()=>action({type:'policy.vote',policyId:'solar_subsidies'},NOW+1000)).toThrow(/cooldown/i);
  });
  it('weekly election ties elect nobody instead of silently awarding the earliest candidate',()=>{
    const {game,corp,r}=fixture();r.candidates=[{corporationId:corp.id,at:NOW},{corporationId:'second',at:NOW+1}];r.votes={one:corp.id,two:'second'};
    r.electionEndsAt=NOW+3600000;r.legislator=null;advance(game,r.electionEndsAt);
    expect(r.legislator).toBeNull();expect(r.candidates).toEqual([]);expect(r.votes).toEqual({});
  });
});

describe('source-backed prestige accounting and persistence',()=>{
  it('values land and facility construction at forty percent, including historical materials',()=>{
    const {corp,h,regionId}=fixture();corp.cash=0;h.landSpent=60_000;
    const f=factory(corp,regionId,'coal_mine','a');f.costPaid=25_000;f.materialsPaid={wood:1000};
    // Coal mine: $250 cash + 1000 wood at $0.15, worth 40% = $160; land $600 => $240.
    expect(netWorth(corp)).toBe(40_000);
  });
  it('free token land does not raise the next paid-land exponent',()=>{
    const {corp,h,r,action}=fixture();h.land=10;h.purchasedLand=0;corp.tokens=1;const before=landCost(h,1,corp,r);
    action({type:'upgrade.buy',upgradeId:'land'});expect(h.land).toBe(14);expect(landCost(h,1,corp,r)).toBe(before);
  });
  it('prestige stacks seasonal starter bonuses and preserves permanent/global resources',()=>{
    const {corp,game,regionId,h,action}=fixture();corp.cash=200_000_000_000;corp.tokens=7;corp.gratitude=13;corp.upgrades={land_discount:2,tech_slots:1};corp.season.claimed=[1,2,3,4,5,6,7,8,9,10];corp.season.xp=250000;
    h.inventory.wood=100;const predicted=preview(corp,game.world,regionId,'prestige',NOW);expect(predicted.tokens).toBe(2);
    action({type:'prestige.reset'});expect(corp.cash).toBe(6_100_000);expect(corp.holdings[regionId]!.land).toBe(35);
    expect(corp.holdings[regionId]!.inventory.wood||0).toBe(0);expect(corp.tokens).toBe(9);expect(corp.gratitude).toBe(13);
    expect(corp.upgrades).toEqual({land_discount:2,tech_slots:1});expect(corp.season.xp).toBe(252000);
    expect(corp.holdings[regionId]!.facilities.map(f=>f.type).sort()).toEqual(['air_traffic_control','hq','logistics_center']);
  });
  it('vault retention is replay-deterministic and stabilization only applies in the reset region',()=>{
    const {corp,game,regionId}=fixture();corp.cash=200_000_000_000;corp.space.vault={wood:500};
    const second=game.world.regions[1]!.id;factory(corp,second,'research_facility','outside').installed=['quantum_stabilization'];
    const original=structuredClone(game),without=structuredClone(game);without.corps[0]!.holdings[second]!.facilities[0]!.installed=[];
    executeAction(game,corp,{type:'prestige.reset',regionId},NOW);
    executeAction(original,original.corps[0]!,{type:'prestige.reset',regionId},NOW);
    executeAction(without,without.corps[0]!,{type:'prestige.reset',regionId},NOW);
    expect(corp.space.vault).toEqual(original.corps[0]!.space.vault);
    expect(corp.space.vault).toEqual(without.corps[0]!.space.vault);
    expect(corp.space.vault.wood).toBeGreaterThan(180);expect(corp.space.vault.wood).toBeLessThan(320);
  });
});

describe('late game orbital workflows with real resource accounting',()=>{
  it('launches, builds a station, dispatches fixed research coordinates, claims once, and deposits/withdraws vault items',()=>{
    const {corp,game,regionId,h,action}=fixture();factory(corp,regionId,'rocket_launch_pad','pad');
    Object.assign(h.inventory,{rocket:3,rocket_fuel:2000,space_station_parts:10000,galactic_coordinate_i:1,wood:100});
    action({type:'space.launch'});expect(h.inventory.rocket).toBe(2);expect(h.inventory.rocket_fuel).toBe(1900);
    action({type:'space.station.build'});expect(corp.space.station.level).toBe(1);expect(h.inventory.space_station_parts).toBe(0);
    action({type:'space.expedition',difficulty:1});const mission=structuredClone(corp.space.expedition);
    expect(h.inventory.galactic_coordinate_i).toBe(0);expect(h.inventory.rocket).toBe(1);expect(h.inventory.rocket_fuel).toBe(800);
    expect(mission.successChance).toBeCloseTo(0.85);
    const restarted=structuredClone(game);advance(game,mission.readyAt);advance(restarted,mission.readyAt);
    action({type:'space.claim'},mission.readyAt);executeAction(restarted,restarted.corps[0]!,{type:'space.claim',regionId},mission.readyAt);
    expect(corp.space.expedition.result).toEqual(restarted.corps[0]!.space.expedition.result);expect(corp.space.station.xp).toBe(100);
    expect(()=>action({type:'space.claim'},mission.readyAt)).toThrow(/ready/i);
    action({type:'space.vault',assetId:'wood',quantity:80},mission.readyAt);expect(h.inventory.wood).toBe(20);expect(corp.space.vault.wood).toBe(80);
    action({type:'space.vault',assetId:'wood',quantity:20,withdraw:true},mission.readyAt);expect(h.inventory.wood).toBe(40);expect(corp.space.vault.wood).toBe(60);
    action({type:'space.station.upgrade'},mission.readyAt);expect(corp.space.station.level).toBe(2);expect(corp.space.station.xp).toBe(0);
  });
  it('uses a knowledge relic exactly once to finish existing research without rerolling its outcome',()=>{
    const {corp,h,action}=fixture();h.inventory.relic_of_knowledge=1;h.research=[{id:'p',status:'working',readyAt:NOW+100000,outcome:[{assetId:'rocket',quantity:1}],facilities:1}];
    const before=structuredClone(h.research[0]!.outcome);action({type:'space.relic',assetId:'relic_of_knowledge'});
    expect(h.inventory.relic_of_knowledge).toBe(0);expect(h.research[0]!.status).toBe('ready');expect(h.research[0]!.outcome).toEqual(before);
    action({type:'research.claim',id:'p'});expect(h.inventory.rocket).toBe(1);expect(corp.stats.researched).toBe(1);
    expect(()=>action({type:'research.claim',id:'p'})).toThrow(/already claimed/i);
  });
});

describe('passive relics activate only inside the global quantum vault',()=>{
  it('five vaulted haste relics shorten both regions research by exactly 150 seconds without changing rewards',()=>{
    const {game,corp,h,regionId}=fixture();const other=game.world.regions[1]!.id;
    for(const id of [regionId,other]){factory(corp,id,'research_facility','research-'+id);corp.holdings[id]!.inventory.energy=1_000_000;}
    corp.space.station={level:1,hull:1000,xp:0};h.inventory.relic_of_haste=5;
    const control=structuredClone(game),vaulted=structuredClone(game),withdrawn=structuredClone(game);
    for(const g of [vaulted,withdrawn])executeAction(g,g.corps[0]!,{type:'space.vault',regionId,assetId:'relic_of_haste',quantity:5},NOW);
    executeAction(withdrawn,withdrawn.corps[0]!,{type:'space.vault',regionId,assetId:'relic_of_haste',quantity:5,withdraw:true},NOW);
    for(const g of [control,vaulted,withdrawn])for(const id of [regionId,other])executeAction(g,g.corps[0]!,{type:'research.start',regionId:id},NOW);
    for(const id of [regionId,other]){
      const original=control.corps[0]!.holdings[id]!.research[0]!,fast=vaulted.corps[0]!.holdings[id]!.research[0]!,removed=withdrawn.corps[0]!.holdings[id]!.research[0]!;
      expect(original.readyAt-fast.readyAt).toBe(150_000);expect(removed.readyAt).toBe(original.readyAt);
      expect(fast.outcome).toEqual(original.outcome);expect(removed.outcome).toEqual(original.outcome);
    }
    expect(vaulted.corps[0]!.space.vault.relic_of_haste).toBe(5);
    expect(vaulted.corps[0]!.holdings[regionId]!.inventory.relic_of_haste).toBe(0);
    expect(withdrawn.corps[0]!.holdings[regionId]!.inventory.relic_of_haste).toBe(5);
  });
  it('one vaulted efficiency relic converts a plus batch into twice the normal output in both regions until withdrawn',()=>{
    const {game,corp,h,regionId,action}=fixture();const other=game.world.regions[1]!.id;
    for(const id of [regionId,other]){const f=factory(corp,id,'tree_farm','tree-'+id);f.level=50;f.xp=5_000_000;}
    corp.space.station={level:1,hull:1000,xp:0};h.inventory.relic_of_efficiency=1;
    // Fixed seed yields two plus rolls at level 50. The twin control establishes actual plus output.
    corp.rng=1;const control=structuredClone(game);
    action({type:'space.vault',assetId:'relic_of_efficiency',quantity:1});
    advance(control,NOW+5000);advance(game,NOW+5000);
    for(const id of [regionId,other]){
      expect(control.corps[0]!.holdings[id]!.inventory.wood_plus).toBe(2);
      expect(control.corps[0]!.holdings[id]!.inventory.wood||0).toBe(0);
      expect(corp.holdings[id]!.inventory.wood).toBe(4);
      expect(corp.holdings[id]!.inventory.wood_plus||0).toBe(0);
    }
    expect(corp.space.vault.relic_of_efficiency).toBe(1);expect(corp.stats.produced).toBe(8);
    action({type:'space.vault',assetId:'relic_of_efficiency',quantity:1,withdraw:true},NOW+5000);
    corp.rng=1;advance(game,NOW+10000);
    for(const id of [regionId,other]){expect(corp.holdings[id]!.inventory.wood).toBe(4);expect(corp.holdings[id]!.inventory.wood_plus).toBe(2);}
    expect(h.inventory.relic_of_efficiency).toBe(1);expect(corp.space.vault.relic_of_efficiency).toBe(0);
  });
  it('vaulted prestige relics lower the token divisor with the configured cap while leaving score and valuation unchanged',()=>{
    const {game,corp,h,regionId}=fixture();corp.cash=150_000_000_000;corp.space.station={level:1,hull:1000,xp:0};h.inventory.relic_of_prestige=1000;
    const baseline=preview(corp,game.world,regionId,'prestige',NOW);expect(baseline.tokens).toBe(1);expect(baseline.score).toBe(1);
    for(const [quantity,expectedTokens] of [[250,2],[500,3],[1000,3]]){
      const g=structuredClone(game),c=g.corps[0]!;
      executeAction(g,c,{type:'space.vault',regionId,assetId:'relic_of_prestige',quantity},NOW);
      const p=preview(c,g.world,regionId,'prestige',NOW);
      expect(p.netWorth).toBe(baseline.netWorth);expect(p.score).toBe(baseline.score);expect(p.tokens).toBe(expectedTokens);
      executeAction(g,c,{type:'prestige.reset',regionId},NOW);
      expect(c.tokens).toBe(expectedTokens);expect(c.score).toBe(baseline.score);
    }
    const removed=structuredClone(game),c=removed.corps[0]!;
    executeAction(removed,c,{type:'space.vault',regionId,assetId:'relic_of_prestige',quantity:500},NOW);
    executeAction(removed,c,{type:'space.vault',regionId,assetId:'relic_of_prestige',quantity:500,withdraw:true},NOW);
    expect(preview(c,removed.world,regionId,'prestige',NOW).tokens).toBe(baseline.tokens);
  });
});

describe('research, daily tiers, and regional inventory boundaries',()=>{
  it('catches up a 72-hour absence identically to minute checkpoints across two-day regional modifier changes',()=>{
    const {corp,game,regionId}=fixture();for(const [index,type] of ['oil_well','oil_refinery','gas_station','oil_refinery'].entries())factory(corp,regionId,type,String(index));
    const reference=structuredClone(game),end=NOW+72*3600000;advance(game,end);
    for(let at=NOW+60000;at<=end;at+=60000)advance(reference,at);
    expect(corp.holdings).toEqual(reference.corps[0]!.holdings);expect(corp.cash).toBe(reference.corps[0]!.cash);expect(corp.rng).toBe(reference.corps[0]!.rng);
    expect(game.world.regions.map(r=>r.modifiers)).toEqual(reference.world.regions.map(r=>r.modifiers));
    expect(corp.stats.produced).toBeGreaterThan(100000);
  });
  it('season level seven discounts normal energy, plus energy, and money for an eight-facility project',()=>{
    const {corp,h,regionId,action}=fixture();for(let i=0;i<8;i++)factory(corp,regionId,'research_facility','r'+i);
    corp.season.claimed=[2,7];Object.assign(h.inventory,{energy:1000000,energy_plus:1000000});const cash=corp.cash;
    action({type:'research.start'});expect(cash-corp.cash).toBe(80_000_000);expect(h.inventory.energy).toBe(200000);expect(h.inventory.energy_plus).toBe(200000);
    expect(h.research[0]!.outcome).toHaveLength(8);expect(h.research[0]!.readyAt-NOW).toBeGreaterThanOrEqual(5400000);expect(h.research[0]!.readyAt-NOW).toBeLessThanOrEqual(9000000);
    expect(()=>action({type:'research.start'})).toThrow(/current regional research/i);
  });
  it('supports three free challenges and six platinum challenges with one claim each',()=>{
    const {corp,game,action}=fixture();const day=Math.floor(NOW/86400000);Object.assign(corp.season.challenges,{[`${day}:produce`]:1000,[`${day}:salesCents`]:10000000,[`${day}:builds`]:1,[`${day}:purchasesCents`]:100000});
    expect(snapshot(game,corp,NOW).season.challengesList).toHaveLength(3);
    for(const id of ['production','sales','construction'])action({type:'challenge.claim',challengeId:id});
    expect(corp.season.xp).toBe(300);expect(()=>action({type:'challenge.claim',challengeId:'production'})).toThrow(/already claimed/i);
    expect(()=>action({type:'challenge.claim',challengeId:'purchases'})).toThrow(/higher entitlement/i);
    corp.entitlement='platinum';expect(snapshot(game,corp,NOW).season.challengesList).toHaveLength(6);
    for(const id of ['purchases','production_expert','commerce_expert'])action({type:'challenge.claim',challengeId:id});
    expect(corp.season.xp).toBe(650);
  });
  it('keeps awarded blueprints regional, exportable, and unavailable to the player order book',()=>{
    const {corp,game,regionId,h,action}=fixture();h.research=[{id:'blue',status:'ready',facilities:1,outcome:[{technologyId:'oil_mapping',quantity:1}]}];
    action({type:'research.claim',id:'blue'});expect(h.inventory.blueprint_oil_mapping).toBe(1);expect(h.blueprints?.oil_mapping).toBe(1);
    const second=game.world.regions[1]!.id;expect(corp.holdings[second]!.blueprints?.oil_mapping||0).toBe(0);
    factory(corp,regionId,'logistics_center','log');factory(corp,second,'logistics_center','otherlog');
    expect(()=>action({type:'order.create',side:'sell',assetId:'blueprint_oil_mapping',quantity:1,price:400000000})).toThrow(/cannot be traded/i);
    Object.assign(h.inventory,{truck:1,gasoline:1000000});action({type:'export.dispatch',toRegionId:second,assetId:'blueprint_oil_mapping',quantity:1});
    expect(h.blueprints?.oil_mapping).toBe(0);const shipment=corp.shipments[0]!;advance(game,shipment.arrivesAt);action({type:'export.claim',id:shipment.id},shipment.arrivesAt);
    expect(corp.holdings[second]!.inventory.blueprint_oil_mapping).toBe(1);expect(corp.holdings[second]!.blueprints?.oil_mapping).toBe(1);
    stock(corp.holdings[second]!,'blueprint_oil_mapping',-1);expect(corp.holdings[second]!.blueprints?.oil_mapping).toBe(0);
  });
  it('charges gratitude only for actual identity changes and preserves privacy as free configuration',()=>{
    const {corp,action}=fixture();corp.gratitude=3;action({type:'settings.update',name:'Renamed',motto:'A new motto',privacy:false});
    expect(corp.gratitude).toBe(0);expect(corp.name).toBe('Renamed');expect(corp.motto).toBe('A new motto');expect(corp.privacy).toBe(false);
    action({type:'settings.update',name:'Renamed',motto:'A new motto',privacy:true});expect(corp.gratitude).toBe(0);
  });
});

describe('all expedition difficulties and deterministic success/failure paths',()=>{
  function seedFor(chance:number,success:boolean,returned=false) {
    for(let seed=1;seed<200000;seed++) { const state={rng:seed} as Corp;const won=roll(state)<chance;roll(state);const comesBack=roll(state)<0.5;if(won===success&&(success||comesBack===returned))return seed; }
    throw new Error('Could not find bounded deterministic fixture seed');
  }
  for(const difficulty of [1,2,3,4,5]) for(const path of ['success','failure_returned','failure_destroyed']) {
    it(`difficulty ${difficulty} ${path}: consumes documented coordinates/fuel, applies outcome once, and repairs exact damage`,()=>{
      const {corp,game,h,action}=fixture();const spec=rules.space.expeditions[difficulty-1]!;
      corp.space.orbital=true;corp.space.station={level:1,hull:rules.remake.initialStationHull,xp:0};
      const success=path==='success',returned=path==='failure_returned';corp.rng=seedFor(spec.baseSuccess+rules.space.levelSuccessBonus,success,returned);
      Object.assign(h.inventory,{rocket:10,rocket_fuel:2000,space_station_parts:2000,[spec.coordinateId]:1});
      action({type:'space.expedition',difficulty});const mission=corp.space.expedition;
      expect(h.inventory[spec.coordinateId]).toBe(0);expect(h.inventory.rocket).toBe(9);expect(h.inventory.rocket_fuel).toBe(2000-difficulty*100);
      expect(mission.outcome.success).toBe(success);expect(mission.outcome.rocketReturned).toBe(returned);
      expect(()=>action({type:'space.expedition',difficulty})).toThrow(/previous expedition/i);
      advance(game,mission.readyAt);action({type:'space.claim'},mission.readyAt);
      expect(corp.space.station.hull).toBe(rules.remake.initialStationHull-(success?0:difficulty*100));
      expect(h.inventory.rocket).toBe(returned?10:9);expect(h.inventory[mission.outcome.relicId]||0).toBe(success?difficulty:0);
      expect(corp.space.station.xp).toBe(difficulty*100);
      if(!success){action({type:'space.station.repair'},mission.readyAt);expect(h.inventory.space_station_parts).toBe(2000-difficulty*100);expect(corp.space.station.hull).toBe(rules.remake.initialStationHull);}
      expect(()=>action({type:'space.claim'},mission.readyAt)).toThrow(/ready/i);
    });
  }
});

describe('concurrent research, retail consumption, and tier rewards',()=>{
  it('runs independent projects in two regions and claims exactly their original regional outcomes',()=>{
    const {corp,game,regionId,h,action}=fixture();const other=game.world.regions[1]!.id;const distant=corp.holdings[other]!;
    factory(corp,regionId,'research_facility','a');factory(corp,regionId,'research_facility','b');factory(corp,other,'research_facility','c');
    h.inventory.energy=1000000;distant.inventory.energy=1000000;
    action({type:'research.start'});action({type:'research.start',regionId:other});const first=h.research[0]!,second=distant.research[0]!;
    expect(first.outcome).toHaveLength(2);expect(second.outcome).toHaveLength(1);const captured=structuredClone([first.outcome,second.outcome]);
    const end=Math.max(first.readyAt,second.readyAt);advance(game,end);action({type:'research.claim',id:first.id},end);action({type:'research.claim',regionId:other,id:second.id},end);
    for(const [holding,outcomes] of [[h,captured[0]],[distant,captured[1]]] as const){const totals:Record<string,number>={};for(const reward of outcomes){const id=reward.technologyId?'blueprint_'+reward.technologyId:reward.assetId;totals[id]=(totals[id]||0)+reward.quantity;}for(const[id,count]of Object.entries(totals))expect(holding.inventory[id]).toBe(count);}
    expect(corp.stats.researched).toBe(3);expect(()=>action({type:'research.claim',regionId:other,id:second.id},end)).toThrow(/already claimed/i);
  });
  it('requires global HQ, consumes retail goods, applies support demand, and preserves locked inventory',()=>{
    const {corp,game,regionId,h,r,action}=fixture();h.land=10;
    for(let i=0;i<5;i++)factory(corp,regionId,'retail_store','shop'+i);
    expect(()=>action({type:'retail.configure',assetId:'car',price:2000000})).toThrow(/headquarters/i);
    factory(corp,game.world.regions[1]!.id,'hq','global_hq');factory(corp,regionId,'customer_support_center','support');
    const saleAt=NOW+rules.retail.cycleSeconds*1000,normalPrice=marketPrice(r,'car','sell',saleAt),plusPrice=marketPrice(r,'car_plus','sell',saleAt)*2;
    h.inventory.car=100;h.inventory.car_plus=100;action({type:'retail.configure',assetId:'car',price:normalPrice});action({type:'retail.configure',assetId:'car_plus',price:plusPrice});
    const unsupported=structuredClone(game);unsupported.corps[0]!.holdings[regionId]!.facilities=unsupported.corps[0]!.holdings[regionId]!.facilities.filter(f=>f.type!=='customer_support_center');
    const locked=structuredClone(game);locked.corps[0]!.holdings[regionId]!.locks=['car','car_plus'];
    const cash=corp.cash;advance(game,saleAt);advance(unsupported,saleAt);advance(locked,saleAt);
    expect(h.inventory.car).toBe(50);expect(h.inventory.car_plus).toBe(50);expect(corp.cash-cash).toBe(50*(normalPrice+plusPrice));
    expect(unsupported.corps[0]!.holdings[regionId]!.inventory.car).toBe(95);expect(locked.corps[0]!.holdings[regionId]!.inventory.car).toBe(100);expect(locked.corps[0]!.cash).toBe(cash);
  });
  it.each(['free','plus','gold','platinum'])('%s vote/weekly rewards respect entitlements, season unlock and replay protection',tier=>{
    const {corp,action}=fixture();corp.entitlement=tier;const ent=rules.entitlements[tier as keyof typeof rules.entitlements];const initial=corp.cash;
    action({type:'reward.vote'});expect(corp.cash-initial).toBe(rules.vote.cash*ent.voteMultiplier);expect(corp.gratitude).toBe(ent.voteMultiplier);expect(corp.season.xp).toBe(rules.vote.seasonXp*ent.voteMultiplier);
    expect(()=>action({type:'reward.vote'},NOW+1)).toThrow(/cooldown/i);
    expect(()=>action({type:'reward.weekly'})).toThrow(/season level one/i);
    corp.season.xp=Math.max(corp.season.xp,rules.season.xpThresholds[0]!);action({type:'season.claim',level:1});expect(()=>action({type:'season.claim',level:1})).toThrow(/already claimed/i);
    const before=corp.cash;action({type:'reward.weekly'});expect(corp.cash-before).toBe(rules.remake.weeklyRewardCash);expect(corp.tokens).toBe(ent.weeklyTokens);
    expect(()=>action({type:'reward.weekly'},NOW+1)).toThrow(/cooldown/i);
    const dailyBefore=corp.cash;action({type:'reward.daily'});expect(corp.cash-dailyBefore).toBe(rules.remake.dailyRewardCash);expect(()=>action({type:'reward.daily'},NOW+1)).toThrow(/cooldown/i);
  });
});
