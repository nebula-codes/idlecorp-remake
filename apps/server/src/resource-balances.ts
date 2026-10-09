import { qualityChance } from '../../../packages/rules/src/index.js';
import { assetMap, capacityReason, cycleMs, effectiveLevel, facilityMap, MAX, recipe } from './engine.js';
import type { Corp, Dict, Facility, Holding, Region } from './types.js';

export interface FacilityFlow { facility:Facility; inputs:Record<string,number>; outputs:Record<string,number>; chance:number; blocked:boolean; }
export function facilityFlow(f:Facility,c:Corp,r:Region):FacilityFlow {
 const h=c.holdings[r.id]!,rec=recipe(f,c,r),chosen:Record<string,number>={};
 for(const[id,n]of Object.entries(rec.inputs)){let left=n;if(id!=='cash'&&f.allowPlus){const plus=id.endsWith('_plus')?id:id+'_plus',q=Math.min(left,h.inventory[plus]||0);if(q)chosen[plus]=q;left-=q;}if(left)chosen[id]=(chosen[id]||0)+left;}
 const total=Object.values(chosen).reduce((n,q)=>n+q,0),plus=Object.entries(chosen).filter(([id])=>id.endsWith('_plus')).reduce((n,[,q])=>n+q,0);
 const chance=f.plus?qualityChance(effectiveLevel(f,r,c),total?plus/total:0):0,rate=60000/cycleMs(f,c,r),inputs=Object.fromEntries(Object.entries(chosen).map(([id,n])=>[id,n*rate])),outputs:Record<string,number>={};
 for(const[id,n]of Object.entries(rec.outputs)){const qualified=id!=='cash'&&assetMap.has(id+'_plus'),efficient=qualified&&(c.space.vault.relic_of_efficiency||0)>0;outputs[id]=n*rate*(qualified?(efficient?1+chance:1-chance):1);if(qualified&&!efficient&&chance)outputs[id+'_plus']=n*rate*chance;}
 return {facility:f,inputs,outputs,chance,blocked:!!capacityReason(f,h,c,r)};
}
export function regionalFlows(c:Corp,r:Region){return c.holdings[r.id]!.facilities.filter(f=>f.enabled&&facilityMap.has(f.type)&&Object.keys(facilityMap.get(f.type)!.outputs).length).map(f=>facilityFlow(f,c,r));}
function sum(flows:FacilityFlow[],side:'inputs'|'outputs',factors?:number[]){const result:Record<string,number>={};for(let i=0;i<flows.length;i++)for(const[id,n]of Object.entries(flows[i]![side]))result[id]=(result[id]||0)+n*(factors?.[i]??1);return result;}
/** Conservative full-demand reservations avoid assigning the same upstream supply twice. */
export function flowTotals(flows:FacilityFlow[],externalSupply:Record<string,number>={}){
 const input=sum(flows,'inputs'),output=sum(flows,'outputs');let factors:number[]=flows.map(f=>f.blocked?0:1),converged=false;
 for(let pass=0;pass<64;pass++){const supply=sum(flows,'outputs',factors);for(const[id,n]of Object.entries(externalSupply))supply[id]=(supply[id]||0)+n;
  const next=flows.map((f,i)=>Math.min(factors[i]!,...Object.keys(f.inputs).map(id=>input[id]!>0?Math.max(0,Math.min(1,(supply[id]||0)/input[id]!)):1)));
  if(next.every((value,i)=>Math.abs(value-factors[i]!)<1e-10)){factors=next;converged=true;break;}factors=next;
 }
 // A cyclic/nonconverging estimate is not evidence of guaranteed sustainable supply.
 if(!converged)factors=flows.map(()=>0);
 const sustainableInput=sum(flows,'inputs',factors),sustainableOutput=sum(flows,'outputs',factors);
 for(const[id,n]of Object.entries(externalSupply))sustainableOutput[id]=(sustainableOutput[id]||0)+n;
 return {input,output,sustainableInput,sustainableOutput,factors,converged};
}
export function recordProduction(h:Holding,side:'inputs'|'outputs',id:string,quantity:number,at:number){
 h.productionObservation??={since:at,inputs:{},outputs:{}};const o=h.productionObservation;const next=(o[side][id]||0)+quantity;if(next>Number.MAX_SAFE_INTEGER)o.capped=true;o[side][id]=Math.min(Number.MAX_SAFE_INTEGER,next);
}
function recorded(c:Corp,h:Holding,id:string){const o=h.productionObservation,minutes=o?(c.lastProcessed-o.since)/60000:0;if(!o||minutes<=0)return null;const input=o.inputs[id]||0,output=o.outputs[id]||0;return {observedSince:o.since,observedUntil:c.lastProcessed,input,output,inputPerMinute:input/minutes,outputPerMinute:output/minutes,netPerMinute:(output-input)/minutes,capped:!!o.capped};}
export function resourceBalances(c:Corp,r:Region){
 const h=c.holdings[r.id]!,flows=regionalFlows(c,r),totals=flowTotals(flows),ids=new Set([...Object.keys(h.inventory),...Object.keys(totals.input),...Object.keys(totals.output),...Object.keys(h.productionObservation?.inputs||{}),...Object.keys(h.productionObservation?.outputs||{})]);
 const contributors=(id:string,side:'inputs'|'outputs')=>{const groups=new Map<string,Dict>();for(const f of flows){const rate=f[side][id];if(!rate)continue;let g=groups.get(f.facility.type);if(!g){g={facilityId:f.facility.type,type:f.facility.type,name:facilityMap.get(f.facility.type)!.name,count:0,perMinute:0};groups.set(f.facility.type,g);}g.count++;g.perMinute+=rate;}return [...groups.values()];};
 return [...ids].sort().map(id=>{const stock=id==='cash'?c.cash:h.inventory[id]||0,capacityOutputPerMinute=totals.output[id]||0,capacityInputPerMinute=totals.input[id]||0,capacityNetPerMinute=capacityOutputPerMinute-capacityInputPerMinute,sustainableOutputPerMinute=totals.sustainableOutput[id]||0,sustainableInputPerMinute=totals.sustainableInput[id]||0,sustainableNetPerMinute=sustainableOutputPerMinute-sustainableInputPerMinute;
  const warnings=['Capacity assumes every enabled facility runs at its expected rate. Sustainable rates reserve shared supply proportionally and exclude finite stored inputs, manual trades and retail.'];if(!totals.converged)warnings.push('A dependency cycle prevented a stable throughput estimate.');if(flows.some(f=>f.chance>0&&(f.outputs[id]||f.inputs[id])))warnings.push('Quality output is an expectation, not a guaranteed rate.');if(flows.some(f=>f.facility.allowPlus&&(f.inputs[id]||f.outputs[id])))warnings.push('Plus-input preference uses current available quality stock and can change as stock is consumed.');if(h.retail.some(row=>row.assetId===id))warnings.push('Retail demand is not included; active retail can change stock and shorten depletion time.');
  return {assetId:id,name:assetMap.get(id)?.name||'Capital',stock,capacity:MAX,capacityOutputPerMinute,capacityInputPerMinute,capacityNetPerMinute,sustainableOutputPerMinute,sustainableInputPerMinute,sustainableNetPerMinute,actual:recorded(c,h,id),producers:contributors(id,'outputs'),consumers:contributors(id,'inputs'),depletionSeconds:capacityNetPerMinute< -1e-9?Math.max(0,Math.floor(stock/-capacityNetPerMinute*60)):null,fullSeconds:sustainableNetPerMinute>1e-9?Math.max(0,Math.ceil((MAX-stock)/sustainableNetPerMinute*60)):null,status:capacityNetPerMinute>1e-9?'surplus':capacityNetPerMinute< -1e-9?'deficit':capacityInputPerMinute||capacityOutputPerMinute?'balanced':'idle',warnings};
 });
}
