import { randomUUID } from 'node:crypto';
import { enhancementRules } from '../../../packages/rules/src/expansion.js';
import { assetMap, marketPrice, netWorth, recipe, cycleMs, R, integer, bounded, getAsset } from './engine.js';
import type { Corp, Dict, Facility, Game, Holding, Region } from './types.js';
import { GameError } from './types.js';

export function normalizeEnhancements(game:Game){
  game.world.expansionEnabled ??= false;game.world.contracts ??=[];game.world.projects ??=[];
  for(const c of game.corps){c.pinnedGoals??={};c.watchlist??=[];c.notificationsList??=[];c.commitments??={cash:0,assets:{}};c.insights??={corporation:[],prices:{}};}
}
export function notifyCorporation(c:Corp,type:string,title:string,message:string,at:number,relatedId?:string){
  c.notificationsList??=[];c.notificationsList.unshift({id:randomUUID(),at,type,title,message,read:false,relatedId});
  c.notificationsList=c.notificationsList.slice(0,enhancementRules.maximumNotifications);
}
export function facilityMetrics(f:Facility,_h:Holding,c:Corp,r:Region,now:number){
  const ms=cycleMs(f,c,r),rec=recipe(f,c,r);
  const inputCostPerMinute=Object.entries(rec.inputs).reduce((n,[id,q])=>n+(id==='cash'?q:q*marketPrice(r,id,'buy',now))*60000/ms,0);
  const outputValuePerMinute=Object.entries(rec.outputs).reduce((n,[id,q])=>n+(id==='cash'?q:q*marketPrice(r,id,'sell',now))*60000/ms,0);
  const observed=f.metrics||{observedSince:now,successfulCycles:0,starvedCycles:0,capacityCycles:0};
  const total=observed.successfulCycles+observed.starvedCycles+observed.capacityCycles;
  return {...observed,inputCostPerMinute,outputValuePerMinute,estimatedMarginPerMinute:outputValuePerMinute-inputCostPerMinute,
    utilization:total?observed.successfulCycles/total:null,valuation:'npc replacement-cost estimate',
    note:'Theoretical rates value ordinary outputs at NPC sell quotes and inputs at NPC buy quotes; they are not realized profit and exclude quality, retail, and player-order prices.'};
}
export function observeCycle(f:Facility,status:'successful'|'starved'|'capacity',at:number){
  f.metrics??={observedSince:at,successfulCycles:0,starvedCycles:0,capacityCycles:0};
  const key=status==='successful'?'successfulCycles':status==='starved'?'starvedCycles':'capacityCycles';
  f.metrics[key]=Math.min(Number.MAX_SAFE_INTEGER,f.metrics[key]+1);if(status==='successful'){f.metrics.lastProducedAt=at;delete f.metrics.idleSince;}else f.metrics.idleSince??=at;
}
export function quoteOrder(game:Game,c:Corp,a:Dict,now:number){
  const asset=getAsset(a.assetId),quantity=integer(a.quantity),price=integer(a.price,'Unit price');
  if(asset.tradeable===false)throw new GameError('This asset cannot be traded.');
  if(!['buy','sell'].includes(a.side))throw new GameError('Order side must be buy or sell.');
  const subtotal=bounded(quantity*price),fee=a.side==='sell'?Math.floor(subtotal*R.marketFee):0;
  let remaining=quantity,executionTotal=0,matchedFee=0;
  const matches=game.world.orders.filter(o=>o.status==='open'&&o.corporationId!==c.id&&o.assetId===asset.id&&o.side!==a.side&&(a.side==='buy'?o.price<=price:o.price>=price)).sort((x,y)=>(a.side==='buy'?x.price-y.price:y.price-x.price)||x.createdAt-y.createdAt||x.id.localeCompare(y.id));
  for(const order of matches){const q=Math.min(remaining,order.remaining),value=bounded(q*order.price);executionTotal=bounded(executionTotal+value);if(a.side==='sell')matchedFee+=Math.floor(value*R.marketFee);remaining-=q;if(!remaining)break;}
  return {side:a.side,assetId:asset.id,quantity,price,subtotal,fee,total:subtotal,netProceeds:a.side==='sell'?subtotal-fee:0,maximumEscrow:a.side==='buy'?subtotal:0,
    estimatedMatchedQuantity:quantity-remaining,estimatedExecutionTotal:executionTotal,estimatedExecutionFee:matchedFee,estimatedExecutionNet:executionTotal-matchedFee,
    asOf:now,note:'Indicative snapshot. Execution rechecks the live book under the transaction lock; fees round down per fill.'};
}
export function recordInsights(game:Game,now:number){
  normalizeEnhancements(game);
  for(const c of game.corps){const history=c.insights!;const series=history.corporation as Dict[];const last=series.at(-1);
    if(history.forceSample||!last||now-last.at>=enhancementRules.corporationSampleSeconds*1000){series.push({at:now,cash:c.cash,netWorth:netWorth(c),produced:c.stats.produced,earned:c.stats.earned});history.corporation=series.slice(-enhancementRules.corporationHistoryPoints);delete history.forceSample;}
    const watched=new Set(c.watchlist);for(const key of Object.keys(history.prices))if(!watched.has(key.split(':')[1]!))delete history.prices[key];
    for(const r of game.world.regions)for(const id of c.watchlist!){if(!assetMap.has(id))continue;const key=`${r.id}:${id}`;const points:Dict[]=history.prices[key]??=[];const previous=points.at(-1);
      if(!previous||now-previous.at>=enhancementRules.priceSampleSeconds*1000){points.push({at:now,regionId:r.id,assetId:id,buy:marketPrice(r,id,'buy',now),sell:marketPrice(r,id,'sell',now)});history.prices[key]=points.slice(-enhancementRules.priceHistoryPoints);}
    }
  }
}
function cycleTotals(c:Corp){return Object.values(c.holdings).flatMap(h=>h.facilities).reduce((n,f)=>({successful:n.successful+(f.metrics?.successfulCycles||0),starved:n.starved+(f.metrics?.starvedCycles||0),capacity:n.capacity+(f.metrics?.capacityCycles||0)}),{successful:0,starved:0,capacity:0});}
export function captureReturnBaseline(c:Corp,now:number){c.returnBaseline={at:now,cash:c.cash,produced:c.stats.produced,earned:c.stats.earned,cycles:cycleTotals(c),inventory:structuredClone(Object.fromEntries(Object.entries(c.holdings).map(([rid,h])=>[rid,h.inventory])))};}
export function makeReturnSummary(_game:Game,c:Corp,now:number){
  const b=c.returnBaseline,cycles=cycleTotals(c),changes:Dict[]=[];
  if(b)for(const[rid,h]of Object.entries(c.holdings)){const old=b.inventory[rid]||{};for(const id of new Set([...Object.keys(old),...Object.keys(h.inventory)])){const delta=(h.inventory[id]||0)-(old[id]||0);if(delta)changes.push({regionId:rid,assetId:id,quantity:delta});}}
  return {elapsedMs:Math.max(0,now-(b?.at||c.lastSeenAt||now)),produced:Math.max(0,c.stats.produced-(b?.produced??c.lastSeenProduced??c.stats.produced)),
    baselineAvailable:!!b,cashChange:b?c.cash-b.cash:0,earned:b?Math.max(0,c.stats.earned-b.earned):0,
    cyclesCompleted:b?Math.max(0,cycles.successful-b.cycles.successful):0,starvedCycles:b?Math.max(0,cycles.starved-b.cycles.starved):0,capacityCycles:b?Math.max(0,cycles.capacity-b.cycles.capacity):0,
    topChanges:changes.sort((x,y)=>Math.abs(y.quantity)-Math.abs(x.quantity)).slice(0,8),arrivals:c.shipments.filter(s=>s.status==='arrived').length,
    researchReady:Object.values(c.holdings).flatMap(h=>h.research).filter(p=>p.status==='ready').length,
    unreadNotifications:(c.notificationsList||[]).filter(n=>!n.read).length,note:b?'Changes since the last account snapshot; net cash includes spending, sales, and claims.':'Detailed comparisons begin after this visit; sampled histories never invent past values.'};
}
export function insightSnapshot(_game:Game,c:Corp){
  return {pinnedGoals:c.pinnedGoals||{},notifications:c.notificationsList||[],history:{corporation:c.insights?.corporation||[],prices:Object.values(c.insights?.prices||{}).flat()},
    enhancementRules};
}
