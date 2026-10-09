import { facilities, technologies, rules, qualityChance } from '../../../packages/rules/src/index.js';
import { assetMap, facilityMap, buildCost, landCost, cycleMs, recipe, effectiveLevel, capacityReason, marketPrice, buyingLimit, serviceActive, integer, bounded } from './engine.js';
import { GameError, type Corp, type Facility, type Game, type Holding, type Region } from './types.js';

/** Read-only advice. Every executable hint still passes through normal actions. */
export interface PlannerAction { label:string; screen:string; actionType?:string; payload?:Record<string,unknown>; }
export interface PlannerBlocker { code:string; message:string; assetId?:string; facilityId?:string; action?:PlannerAction; }
export interface PlannerEstimate { status:'ready'|'estimate'|'blocked'; seconds:number|null; reasons:string[]; }
export interface MaterialRequirement {
  assetId:string; name:string; icon:string; required:number; available:number; missing:number; locked:boolean;
  outputPerMinute:number; inputPerMinute:number; netPerMinute:number; estimate:PlannerEstimate;
  producers:string[]; actions:PlannerAction[];
  npcBuyQuote:null|{unitPrice:number; totalForMissing:number; allowanceRemaining:number; affordableQuantity:number};
}
export interface PlannerNode {
  id:string; kind:'asset'|'facility'|'technology'|'goal'; name:string; icon?:string; assetId?:string; facilityId?:string;
  ownedCount?:number; activeCount?:number; stock?:number; inputPerMinute?:number; outputPerMinute?:number; netPerMinute?:number;
  status:string; reasons:string[]; actions:PlannerAction[];
}
export interface PlannerEdge {
  id:string; from:string; to:string; kind:'input'|'output'|'construction'|'development'|'discovery';
  quantityPerCycle:number|null; perMinute:number|null; qualityDependent?:boolean;
}
export interface PlannerShortage {
  assetId:string; name:string; stock:number; requiredForNextCycles:number; missingForNextCycles:number;
  inputPerMinute:number; outputPerMinute:number; netPerMinute:number; depletionSeconds:number|null;
  stalledFacilityIds:string[]; reasons:string[]; actions:PlannerAction[];
}
export interface PlannerStep { id:string; title:string; description:string; done:boolean; stage:string; action:PlannerAction; }
export interface ProductionPlan {
  version:1; generatedAt:number; revision:number; regionId:string;
  pinnedGoal:null|{facilityId:string; quantity:number; baselineCount:number; targetCount:number; currentCount:number; remaining:number; nextBatchQuantity:number; completed:boolean; createdAt:number};
  goal:null|{
    facilityId:string; name:string; icon:string; quantity:number; ready:boolean;
    requirements:{
      cash:{required:number; available:number; missing:number; landPurchaseCost:number; includingLand:number};
      land:{required:number; available:number; missing:number; owned:number; used:number; purchaseCost:number};
      materials:MaterialRequirement[];
      prerequisites:{facilityId:string; name:string; scope:'global'|'regional'; satisfied:boolean; ownedRegions:string[]; action:PlannerAction}[];
    };
    missingFactories:{facilityId:string; name:string; forAssets:string[]; alternative:boolean; action:PlannerAction}[];
    blockers:PlannerBlocker[]; eta:PlannerEstimate; actions:PlannerAction[];
  };
  graph:{nodes:PlannerNode[]; edges:PlannerEdge[]; shortages:PlannerShortage[]; notices:string[]; truncated:boolean};
  onboarding:{stage:string; stageLabel:string; steps:PlannerStep[]; next:PlannerStep|null; navigation:{screen:string; priority:'primary'|'secondary'; reason:string}[]};
}

interface Flow { input:number; output:number; immediateInput:number; producerTypes:Set<string>; consumerTypes:Set<string>; stalled:Set<string>; }
interface Group { type:string; count:number; active:number; producing:number; paused:number; starved:number; capacity:number; instances:Facility[]; inputs:Record<string,number>; outputs:Record<string,number>; reasons:Set<string>; }
interface Context { game:Game; corp:Corp; region:Region; holding:Holding; now:number; flows:Map<string,Flow>; groups:Map<string,Group>; }
const MAX_GRAPH_NODES=190;
const MAX_CHAIN_DEPTH=10;
const RATE_NOTICE='Rates describe expected full-speed operation at the current recipes, quality chances and regional modifiers. Shared inputs, pauses and changing conditions can reduce realized output.';
const ETA_NOTICE='Time estimates assume no further spending or construction. They exclude player trades, manual NPC sales, unclaimed deliveries and variable retail income; they are not completion guarantees.';
const nav=(label:string,screen:string,payload?:Record<string,unknown>):PlannerAction=>({label,screen,...(payload?{payload}:{})});
const buildAdvice=(id:string):PlannerAction=>nav(`Plan ${facilityMap.get(id)?.name||id}`,'facilities',{facilityId:id});
function numericAdd(target:Record<string,number>,id:string,n:number){target[id]=(target[id]||0)+n;}
function flow(ctx:Context,id:string):Flow {
  let value=ctx.flows.get(id);if(!value){value={input:0,output:0,immediateInput:0,producerTypes:new Set(),consumerTypes:new Set(),stalled:new Set()};ctx.flows.set(id,value);}return value;
}
function exemplar(type:string,now:number):Facility {return {id:`planner:${type}`,type,level:0,xp:0,nextCycle:now,enabled:true,plus:true,allowPlus:false,installed:[],costPaid:0,materialsPaid:{},builtAt:now};}
function stock(ctx:Context,id:string){return id==='cash'?ctx.corp.cash:ctx.holding.inventory[id]||0;}
function availableActions(ctx:Context,id:string):PlannerAction[] {
  if(id==='cash')return [nav('Review sellable inventory','inventory'),nav('Review regional prices','market')];
  const asset=assetMap.get(id),actions:PlannerAction[]=[];
  if(ctx.holding.locks.includes(id))actions.push({label:'Unlock this resource',screen:'inventory',actionType:'inventory.lock',payload:{regionId:ctx.region.id,assetId:id}});
  if(asset?.npcBuy)actions.push(nav('Check NPC purchase price and allowance','market',{assetId:id}));
  if(asset?.tradeable!==false)actions.push(nav('Check player offers','market',{assetId:id,tab:'players'}));
  if(asset?.blueprintTechnologyId)actions.push(nav('Research this blueprint','research',{technologyId:asset.blueprintTechnologyId}));
  if(asset?.technologyId)actions.push(nav('Develop this technology','research',{technologyId:asset.technologyId}));
  return actions;
}

/** Mirrors the engine's documented plus-input preference without consuming stock. */
function selectedInputs(ctx:Context,f:Facility,inputs:Record<string,number>) {
  const selected:Record<string,number>={};
  for(const[id,n]of Object.entries(inputs)){
    let left=n;
    if(id!=='cash'&&f.allowPlus){const plusId=id.endsWith('_plus')?id:`${id}_plus`,q=Math.min(left,ctx.holding.inventory[plusId]||0);if(q){numericAdd(selected,plusId,q);left-=q;}}
    if(left)numericAdd(selected,id,left);
  }
  return selected;
}
function inspectFlows(ctx:Context){
  for(const f of ctx.holding.facilities){
    if(!facilityMap.has(f.type))continue;
    let g=ctx.groups.get(f.type);
    if(!g){g={type:f.type,count:0,active:0,producing:0,paused:0,starved:0,capacity:0,instances:[],inputs:{},outputs:{},reasons:new Set()};ctx.groups.set(f.type,g);}
    g.count++;g.instances.push(f);
    const rec=recipe(f,ctx.corp,ctx.region);if(!Object.keys(rec.outputs).length)continue;
    if(!f.enabled){g.paused++;g.reasons.add('Some facilities are paused.');continue;}
    g.active++;
    const chosen=selectedInputs(ctx,f,rec.inputs),missing=Object.entries(chosen).filter(([id,n])=>stock(ctx,id)<n),cap=capacityReason(f,ctx.holding,ctx.corp,ctx.region);
    if(missing.length){g.starved++;g.reasons.add('Some facilities are waiting for inputs.');}
    else if(cap){g.capacity++;g.reasons.add(cap);}
    else g.producing++;
    const perMinute=60000/cycleMs(f,ctx.corp,ctx.region);
    const inputTotal=Object.values(chosen).reduce((a,b)=>a+b,0),plusTotal=Object.entries(chosen).filter(([id])=>id.endsWith('_plus')).reduce((a,[,b])=>a+b,0);
    const chance=f.plus?qualityChance(effectiveLevel(f,ctx.region,ctx.corp),inputTotal?plusTotal/inputTotal:0):0;
    for(const[id,n]of Object.entries(chosen)){
      const record=flow(ctx,id);record.input+=n*perMinute;record.immediateInput+=n;record.consumerTypes.add(f.type);numericAdd(g.inputs,id,n*perMinute);
      if(stock(ctx,id)<n)record.stalled.add(f.id);
    }
    for(const[id,n]of Object.entries(rec.outputs)){
      const plusId=`${id}_plus`,eligible=id!=='cash'&&assetMap.has(plusId),efficiency=eligible&&(ctx.corp.space.vault.relic_of_efficiency||0)>0;
      const normal=n*perMinute*(eligible?(efficiency?1+chance:1-chance):1),plus=eligible&&!efficiency?n*perMinute*chance:0;
      const record=flow(ctx,id);record.output+=normal;record.producerTypes.add(f.type);numericAdd(g.outputs,id,normal);
      if(plus>0){const p=flow(ctx,plusId);p.output+=plus;p.producerTypes.add(f.type);numericAdd(g.outputs,plusId,plus);}
    }
  }
}

function producerTypes(ctx:Context,assetId:string):string[] {
  const asset=assetMap.get(assetId),base=asset?.baseAsset||assetId;
  return facilities.filter(d=>{
    const rec=recipe(exemplar(d.id,ctx.now),ctx.corp,ctx.region);
    return Number(rec.outputs[assetId]||rec.outputs[base]||0)>0;
  }).map(d=>d.id);
}
function supplyProblems(ctx:Context,assetId:string,horizonSeconds:number,seen=new Set<string>()):string[] {
  if(seen.has(assetId))return ['The supply chain contains a dependency cycle.'];seen.add(assetId);
  const f=ctx.flows.get(assetId),types=f?[...f.producerTypes]:[];
  if(!types.length)return [`No enabled regional facility currently produces ${assetMap.get(assetId)?.name||assetId}.`];
  const reasons=new Set<string>();
  for(const type of types){
    const g=ctx.groups.get(type)!;
    if(g.capacity)reasons.add('A contributing facility is stopped by a storage or cash capacity limit.');
    if(g.starved)reasons.add('A contributing facility is currently missing inputs.');
    for(const id of Object.keys(g.inputs)){
      const input=ctx.flows.get(id)!;
      if(input.input>input.output+1e-9&&stock(ctx,id)<(input.input-input.output)*horizonSeconds/60+input.immediateInput)reasons.add(`${assetMap.get(id)?.name||id} stock would run out before the estimated completion.`);
      if(stock(ctx,id)<input.immediateInput&&input.output<=0)reasons.add(`The chain has no current supply of ${assetMap.get(id)?.name||id}.`);
      if(input.output>0&&!seen.has(id))for(const reason of supplyProblems(ctx,id,horizonSeconds,new Set(seen)))reasons.add(reason);
    }
  }
  return [...reasons];
}
function estimateAsset(ctx:Context,id:string,missing:number,locked=false):PlannerEstimate {
  if(locked)return {status:'blocked',seconds:null,reasons:['Unlock this resource before construction.']};
  if(missing<=0)return {status:'ready',seconds:0,reasons:[]};
  const f=ctx.flows.get(id),net=(f?.output||0)-(f?.input||0);
  const pendingCycles=Math.max(0,...[...(f?.producerTypes||[])].flatMap(type=>ctx.groups.get(type)!.instances.filter(x=>x.enabled).map(x=>Math.max(0,x.nextCycle-ctx.now)/1000)));
  const seconds=Math.ceil(missing*60/net+pendingCycles),reasons=supplyProblems(ctx,id,seconds);
  if(net<=0)reasons.unshift('Current consumption meets or exceeds production; stock does not accumulate.');
  if(reasons.length)return {status:'blocked',seconds:null,reasons:[...new Set(reasons)]};
  if(!Number.isFinite(seconds)||seconds>365*86400)return {status:'blocked',seconds:null,reasons:['The rate-based estimate exceeds the one-year display horizon.']};
  return {status:'estimate',seconds,reasons:[ETA_NOTICE,'The estimate includes one current cycle wait and uses expected quality output.']};
}

function shortages(ctx:Context):PlannerShortage[]{
  return [...ctx.flows].filter(([,f])=>f.input>0).map(([id,f])=>{
    const available=stock(ctx,id),missing=Math.max(0,f.immediateInput-available),net=f.output-f.input,reasons:string[]=[];
    if(f.stalled.size)reasons.push(`${f.stalled.size} facilities cannot complete their next cycle with current stock.`);
    if(missing&&!f.stalled.size)reasons.push('Shared stock cannot cover every enabled facility at once; completion order matters.');
    if(net<0)reasons.push('Full-speed consumption exceeds production.');
    const actions=availableActions(ctx,id);for(const type of producerTypes(ctx,id).slice(0,3))actions.push(buildAdvice(type));
    return {assetId:id,name:assetMap.get(id)?.name||'Capital',stock:available,requiredForNextCycles:f.immediateInput,missingForNextCycles:missing,inputPerMinute:f.input,outputPerMinute:f.output,netPerMinute:net,depletionSeconds:net<0?Math.floor(available/-net*60):null,stalledFacilityIds:[...f.stalled],reasons,actions};
  }).filter(s=>s.reasons.length>0).sort((a,b)=>b.stalledFacilityIds.length-a.stalledFacilityIds.length||b.missingForNextCycles-a.missingForNextCycles||a.assetId.localeCompare(b.assetId));
}

function makeGraph(ctx:Context,goal:ProductionPlan['goal']):ProductionPlan['graph']{
  const nodes=new Map<string,PlannerNode>(),edges=new Map<string,PlannerEdge>(),visited=new Set<string>(),buildVisited=new Set<string>();let truncated=false;
  const addNode=(node:PlannerNode)=>{if(nodes.has(node.id))return;if(nodes.size>=MAX_GRAPH_NODES){truncated=true;return;}nodes.set(node.id,node);};
  const edge=(from:string,to:string,kind:PlannerEdge['kind'],quantity:number|null,rate:number|null,qualityDependent=false)=>{
    if(!nodes.has(from)||!nodes.has(to)){truncated=true;return;}const id=`${kind}:${from}>${to}`;edges.set(id,{id,from,to,kind,quantityPerCycle:quantity,perMinute:rate,...(qualityDependent?{qualityDependent:true}:{})});
  };
  const assetNode=(id:string)=>{
    const a=assetMap.get(id),f=ctx.flows.get(id),net=(f?.output||0)-(f?.input||0),locked=ctx.holding.locks.includes(id);
    addNode({id:`asset:${id}`,kind:'asset',assetId:id,name:a?.name||(id==='cash'?'Capital':id),icon:a?.icon,stock:stock(ctx,id),inputPerMinute:f?.input||0,outputPerMinute:f?.output||0,netPerMinute:net,status:locked?'locked':net<0?'deficit':f?.output?'supplied':'no-production',reasons:locked?['Locked against manual consumption; production can still use this stock.']:[],actions:availableActions(ctx,id)});
  };
  const facilityNode=(type:string)=>{
    const d=facilityMap.get(type)!,g=ctx.groups.get(type);
    addNode({id:`facility:${type}`,kind:'facility',facilityId:type,name:d.name,icon:d.icon,ownedCount:g?.count||0,activeCount:g?.active||0,status:!g?'not-built':g.starved?'starved':g.capacity?'capacity':g.active?'producing':g.paused?'paused':'infrastructure',reasons:[...(g?.reasons||[])],actions:[buildAdvice(type),...(g?.paused?[nav('Review paused facilities','facilities',{tab:'owned',facilityId:type})]:[])]});
  };
  const expandAsset=(id:string,depth:number)=>{
    assetNode(id);if(visited.has(id))return;if(depth>MAX_CHAIN_DEPTH||nodes.size>=MAX_GRAPH_NODES){truncated=true;return;}visited.add(id);
    const asset=assetMap.get(id),technology=technologies.find(t=>t.id===(asset?.technologyId||''));
    if(technology){
      const tier=Number(asset?.tier||1),techId=`technology:${id}`;addNode({id:techId,kind:'technology',name:asset?.name||technology.name,icon:technology.icon,status:tier>1?'combination-required':'development-required',reasons:[tier>1?'Combine three items of the previous tier; upgraded items are not developed directly from a blueprint.':'Development consumes a regional blueprint, capital and materials.'],actions:[nav('Review technology development','research',{technologyId:technology.id})]});
      edge(techId,`asset:${id}`,'development',1,null);
      const previous=[...assetMap.values()].find(a=>a.technologyId===technology.id&&a.tier===tier-1);
      const requirements=tier>1&&previous?{[previous.id]:technology.upgradeCount}:{...technology.materials,[`blueprint_${technology.id}`]:1,cash:technology.cost};
      for(const[input,n]of Object.entries(requirements)){assetNode(input);edge(`asset:${input}`,techId,'development',n,null);if(input!=='cash')expandAsset(input,depth+1);}
      return;
    }
    if(asset?.blueprintTechnologyId){
      facilityNode('research_facility');edge('facility:research_facility',`asset:${id}`,'discovery',null,null);return;
    }
    for(const type of producerTypes(ctx,id)){
      facilityNode(type);const g=ctx.groups.get(type),rec=recipe(exemplar(type,ctx.now),ctx.corp,ctx.region),base=asset?.baseAsset||id;
      edge(`facility:${type}`,`asset:${id}`,'output',rec.outputs[id]||rec.outputs[base]||0,g?.outputs[id]||0,!!asset?.quality);
      for(const[input,n]of Object.entries(rec.inputs)){assetNode(input);edge(`asset:${input}`,`facility:${type}`,'input',n,g?.inputs[input]||0);if(input!=='cash')expandAsset(input,depth+1);}
      if(!g)expandConstruction(type,depth+1);
    }
  };
  const expandConstruction=(type:string,depth:number)=>{
    if(buildVisited.has(type))return;if(depth>MAX_CHAIN_DEPTH||nodes.size>=MAX_GRAPH_NODES){truncated=true;return;}buildVisited.add(type);
    const d=facilityMap.get(type);if(!d)return;facilityNode(type);
    for(const[id,n]of Object.entries(d.materials||{})){expandAsset(id,depth+1);edge(`asset:${id}`,`facility:${type}`,'construction',Number(n),null);}
    assetNode('cash');edge('asset:cash',`facility:${type}`,'construction',buildCost(d,ctx.region),null);
    for(const value of d.requires||[]){const id=String(value).replace(/^global:/,'');if(!facilityMap.has(id))continue;facilityNode(id);edge(`facility:${id}`,`facility:${type}`,'construction',1,null);const fulfilled=String(value).startsWith('global:')?Object.values(ctx.corp.holdings).some(h=>h.facilities.some(f=>f.type===id)):ctx.groups.has(id);if(!fulfilled)expandConstruction(id,depth+1);}
  };
  for(const g of ctx.groups.values()){
    facilityNode(g.type);
    const rec=recipe(g.instances[0]!,ctx.corp,ctx.region);
    for(const id of new Set([...Object.keys(rec.inputs),...Object.keys(g.inputs)])){assetNode(id);edge(`asset:${id}`,`facility:${g.type}`,'input',rec.inputs[id]??rec.inputs[assetMap.get(id)?.baseAsset]??null,g.inputs[id]||0,!!assetMap.get(id)?.quality);}
    for(const id of new Set([...Object.keys(rec.outputs),...Object.keys(g.outputs)])){assetNode(id);edge(`facility:${g.type}`,`asset:${id}`,'output',rec.outputs[id]??rec.outputs[assetMap.get(id)?.baseAsset]??null,g.outputs[id]||0,!!assetMap.get(id)?.quality);}
  }
  if(goal){
    const goalId=`goal:${goal.facilityId}`;addNode({id:goalId,kind:'goal',name:`${goal.quantity} × ${goal.name}`,facilityId:goal.facilityId,icon:goal.icon,status:goal.ready?'ready':'incomplete',reasons:goal.blockers.map(b=>b.message),actions:goal.actions});
    for(const m of goal.requirements.materials){expandAsset(m.assetId,0);edge(`asset:${m.assetId}`,goalId,'construction',m.required,null);}
    assetNode('cash');edge('asset:cash',goalId,'construction',goal.requirements.cash.required,null);
    for(const req of goal.requirements.prerequisites){
      facilityNode(req.facilityId);edge(`facility:${req.facilityId}`,goalId,'construction',1,null);
      if(req.scope==='global'&&req.satisfied&&!ctx.groups.has(req.facilityId)){
        const node=nodes.get(`facility:${req.facilityId}`);if(node){node.status='available-globally';node.reasons.push('Owned in another region; this global prerequisite is already satisfied.');}
      }
      if(!req.satisfied)expandConstruction(req.facilityId,0);
    }
  }
  return {nodes:[...nodes.values()],edges:[...edges.values()],shortages:shortages(ctx),notices:[RATE_NOTICE,ETA_NOTICE,'Discovery edges are random research possibilities, not guaranteed recipes. Construction and development edges do not imply automatic purchases.'],truncated};
}

function makeGoal(ctx:Context,facilityId:string,quantity:number):NonNullable<ProductionPlan['goal']>{
  const d=facilityMap.get(facilityId);if(!d)throw new GameError('Unknown facility goal.');integer(quantity,'Goal quantity',1,100);
  const used=ctx.holding.facilities.reduce((n,f)=>n+Number(facilityMap.get(f.type)?.land||1),0),landRequired=Number(d.land||1)*quantity,free=Math.max(0,ctx.holding.land-used),missingLand=Math.max(0,landRequired-free);
  const cash=bounded(buildCost(d,ctx.region)*quantity),purchaseCost=missingLand?landCost(ctx.holding,missingLand,ctx.corp,ctx.region):0;
  const materials:MaterialRequirement[]=Object.entries(d.materials||{}).map(([id,n])=>{
    const required=bounded(Number(n)*quantity),available=stock(ctx,id),missing=Math.max(0,required-available),f=ctx.flows.get(id),locked=ctx.holding.locks.includes(id);
    const unitPrice=marketPrice(ctx.region,id,'buy',ctx.now),spent=ctx.holding.purchaseDay===Math.floor(ctx.now/3600000)?ctx.holding.npcPurchases.spent||0:0,allowance=Math.max(0,buyingLimit(ctx.corp,ctx.holding,ctx.region,ctx.now)-spent);
    const npcBuyQuote=assetMap.get(id)?.npcBuy?{unitPrice,totalForMissing:unitPrice*missing,allowanceRemaining:allowance,affordableQuantity:Math.floor(Math.min(ctx.corp.cash,allowance)/unitPrice)}:null;
    return {assetId:id,name:assetMap.get(id)?.name||id,icon:assetMap.get(id)?.icon||'',required,available,missing,locked,outputPerMinute:f?.output||0,inputPerMinute:f?.input||0,netPerMinute:(f?.output||0)-(f?.input||0),estimate:estimateAsset(ctx,id,missing,locked),producers:producerTypes(ctx,id),actions:availableActions(ctx,id),npcBuyQuote};
  });
  const requirements=new Set<string>(d.requires||[]);
  if(['retail_store','customer_support_center'].includes(d.id))requirements.add('global:hq');
  if(d.id==='airport')requirements.add('global:air_traffic_control');
  const prerequisites=[...requirements].map(value=>{
    const global=value.startsWith('global:'),id=value.replace(/^global:/,''),ownedRegions=Object.entries(ctx.corp.holdings).filter(([,h])=>h.facilities.some(f=>f.type===id||(id==='hq'&&f.type==='headquarters'))).map(([rid])=>rid);
    return {facilityId:id,name:facilityMap.get(id)?.name||id,scope:global?'global' as const:'regional' as const,satisfied:(global?ownedRegions.length>0:ownedRegions.includes(ctx.region.id))||ctx.corp.technologies.includes(id),ownedRegions,action:buildAdvice(id)};
  });
  const blockers:PlannerBlocker[]=[];
  if(ctx.corp.cash<cash)blockers.push({code:'cash',message:'Construction capital is insufficient.',action:nav('Review capital sources','market')});
  if(missingLand)blockers.push({code:'land',message:`Purchase ${missingLand} more land before construction.`,action:{label:'Review land purchase',screen:'facilities',payload:{landQuantity:missingLand}}});
  for(const p of prerequisites)if(!p.satisfied)blockers.push({code:'prerequisite',facilityId:p.facilityId,message:`Requires ${p.name}${p.scope==='global'?' in any region':' in this region'}.`,action:p.action});
  for(const m of materials){if(m.locked)blockers.push({code:'locked',assetId:m.assetId,message:`${m.name} is locked.`,action:m.actions[0]});if(m.missing)blockers.push({code:'material',assetId:m.assetId,message:`Missing ${m.missing} ${m.name}.`,action:m.actions[0]});}
  if(ctx.holding.facilities.length+quantity>rules.remake.maxFacilitiesPerRegion)blockers.push({code:'capacity',message:'This goal would exceed the regional facility limit.'});
  if(d.id==='research_facility'&&ctx.holding.facilities.filter(f=>f.type===d.id).length+quantity>rules.research.maxFacilities)blockers.push({code:'research-cap',message:'A region supports at most eight research facilities.'});
  const needed=new Map<string,Set<string>>();
  for(const m of materials.filter(m=>m.missing))for(const type of m.producers)if(!ctx.groups.has(type)){if(!needed.has(type))needed.set(type,new Set());needed.get(type)!.add(m.assetId);}
  const missingFactories=[...needed].map(([id,ids])=>({facilityId:id,name:facilityMap.get(id)!.name,forAssets:[...ids],alternative:[...ids].some(asset=>producerTypes(ctx,asset).length>1),action:buildAdvice(id)}));
  const manual=blockers.filter(b=>!['cash','material'].includes(b.code)),cashEstimate=estimateAsset(ctx,'cash',Math.max(0,cash-ctx.corp.cash)),estimates=[cashEstimate,...materials.map(m=>m.estimate)];
  let eta:PlannerEstimate;
  if(!blockers.length)eta={status:'ready',seconds:0,reasons:[]};
  else if(manual.length||estimates.some(e=>e.status==='blocked'))eta={status:'blocked',seconds:null,reasons:[...new Set([...manual.map(b=>b.message),...estimates.filter(e=>e.status==='blocked').flatMap(e=>e.reasons)])]};
  else eta={status:'estimate',seconds:Math.max(...estimates.map(e=>e.seconds||0)),reasons:[ETA_NOTICE,RATE_NOTICE]};
  return {facilityId:d.id,name:d.name,icon:d.icon,quantity,ready:blockers.length===0,requirements:{cash:{required:cash,available:ctx.corp.cash,missing:Math.max(0,cash-ctx.corp.cash),landPurchaseCost:purchaseCost,includingLand:bounded(cash+purchaseCost)},land:{required:landRequired,available:free,missing:missingLand,owned:ctx.holding.land,used,purchaseCost},materials,prerequisites},missingFactories,blockers,eta,actions:[{label:'Review construction',screen:'facilities',payload:{facilityId:d.id,quantity}},{label:'Pin this goal',screen:'planner',actionType:'goal.pin',payload:{regionId:ctx.region.id,facilityId:d.id,quantity}}]};
}

function onboarding(ctx:Context):ProductionPlan['onboarding']{
  const all=Object.values(ctx.corp.holdings).flatMap(h=>h.facilities),has=(id:string)=>all.some(f=>f.type===id),office=serviceActive(ctx.region,'region_office');
  const participates=ctx.region.legislator===ctx.corp.id||!!ctx.region.votes[ctx.corp.id]||ctx.region.candidates.some(x=>x.corporationId===ctx.corp.id);
  const stage=ctx.corp.space.orbital||has('rocket_launch_pad')?'space':participates||has('hq')?'governance':has('research_facility')?'research':has('logistics_center')?'logistics':'early';
  const labels:Record<string,string>={early:'First production line',logistics:'Connected operations',research:'Research and technology',governance:'Regional development',space:'Orbital industry'};
  const steps:PlannerStep[]=[
    {id:'first_factory',stage:'early',title:'Build your first production line',description:'Choose a facility whose live construction requirements you can meet.',done:all.some(f=>Object.keys(facilityMap.get(f.type)?.outputs||{}).length>0),action:buildAdvice('tree_farm')},
    {id:'first_resources',stage:'early',title:'Collect your first production',description:'Completed cycles put resources into the facility’s region.',done:(ctx.corp.stats.produced||0)>0,action:nav('Inspect production','facilities',{tab:'owned'})},
    {id:'first_sale',stage:'early',title:'Turn resources into capital',description:'Review regional NPC eligibility and price before selling.',done:(ctx.corp.stats.sold||0)>0,action:nav('Review regional market','market')},
    {id:'logistics',stage:'logistics',title:'Establish logistics access',description:'Logistics expands purchase allowance and enables player deliveries and exports.',done:has('logistics_center'),action:buildAdvice('logistics_center')},
    {id:'second_region',stage:'logistics',title:'Connect a second region',description:'Exports require logistics at both ends plus a truck and matching gasoline.',done:Object.values(ctx.corp.holdings).filter(h=>h.facilities.some(f=>f.type==='logistics_center')).length>=2,action:nav('Plan an inter-region route','logistics')},
    {id:'research_facility',stage:'research',title:'Open a research facility',description:'A regional research project consumes capital and energy and awards fixed, server-committed discoveries.',done:has('research_facility'),action:buildAdvice('research_facility')},
    {id:'research_reward',stage:'research',title:'Claim a discovery',description:'Research runs independently in each region; claim completed projects before starting another.',done:(ctx.corp.stats.researched||0)>0,action:nav('Review research projects','research')},
    {id:'technology',stage:'research',title:'Install a developed technology',description:'Use a regional blueprint, development materials and the installation fee. Effects apply to eligible facilities in that region.',done:all.some(f=>f.installed.length>0),action:nav('Develop and install technology','research',{tab:'technologies'})},
    {id:'regional_office',stage:'governance',title:'Fund the region office',description:'This shared service unlocks regional elections for eligible corporations.',done:office,action:nav('Review shared services','region',{tab:'services',serviceId:'region_office'})},
    {id:'election',stage:'governance',title:'Participate in regional governance',description:'An active supporter boon or entitlement is required. Candidacy has a fee; voting is once per term.',done:participates,action:nav('Review election eligibility','region',{tab:'elections'})},
    {id:'launch_pad',stage:'space',title:'Build a rocket launch pad',description:'Follow its actual construction bill and develop the required production chain.',done:has('rocket_launch_pad'),action:buildAdvice('rocket_launch_pad')},
    {id:'orbital',stage:'space',title:'Establish orbital presence',description:'Launch consumes one rocket and the documented launch fuel in the selected region.',done:!!ctx.corp.space.orbital,action:nav('Review launch requirements','space')},
    {id:'station',stage:'space',title:'Construct an orbital station',description:'Station parts and rocket fuel unlock expeditions and the quantum vault.',done:(ctx.corp.space.station?.level||0)>0,action:nav('Review station construction','space')},
    {id:'expedition',stage:'space',title:'Complete an expedition',description:'Coordinates, rockets and fuel are consumed. Difficulty changes success chances and failure damage.',done:ctx.corp.space.expedition?.status==='claimed',action:nav('Review expedition requirements','space')},
  ];
  const order=['early','logistics','research','governance','space'],current=order.indexOf(stage),visible=steps.filter(s=>order.indexOf(s.stage)<=current+1);
  const next=visible.find(s=>s.stage===stage&&!s.done)||visible.find(s=>order.indexOf(s.stage)>current&&!s.done)||null;
  const primary=new Set(['overview','facilities','inventory','chains','market','planner','settings',...visible.filter(s=>s.stage===stage).map(s=>s.action.screen)]);
  return {stage,stageLabel:labels[stage]!,steps:visible,next,navigation:['overview','facilities','inventory','chains','market','planner','logistics','research','retail','region','prestige','season','space','leaderboard','settings'].map(screen=>({screen,priority:primary.has(screen)?'primary':'secondary',reason:primary.has(screen)?'Useful for your current progression stage.':'Available in advanced navigation; no gameplay feature is hidden or locked by this advice.'}))};
}

export function planProduction(game:Game,corp:Corp,options:{regionId:string;facilityId?:string;quantity?:number;now?:number}):ProductionPlan {
  const region=game.world.regions.find(r=>r.id===options.regionId),holding=corp.holdings[options.regionId];
  if(!region||!holding)throw new GameError('Choose a valid region.');
  const now=options.now??corp.lastProcessed;if(!Number.isFinite(now)||now<0)throw new GameError('Planning time must be a finite nonnegative timestamp.');
  const ctx:Context={game,corp,region,holding,now,flows:new Map(),groups:new Map()};inspectFlows(ctx);
  const pinned=(corp as Corp&{pinnedGoals?:Record<string,{facilityId:string;quantity:number;createdAt:number;baselineCount?:number;targetCount?:number}>}).pinnedGoals?.[region.id];
  let pinnedGoal:ProductionPlan['pinnedGoal']=null;
  if(pinned){
    const owned=holding.facilities.filter(f=>f.type===pinned.facilityId),baselineCount=pinned.baselineCount??owned.filter(f=>f.builtAt<=pinned.createdAt).length,targetCount=pinned.targetCount??baselineCount+pinned.quantity,remaining=Math.max(0,targetCount-owned.length);
    pinnedGoal={facilityId:pinned.facilityId,quantity:pinned.quantity,baselineCount,targetCount,currentCount:owned.length,remaining,nextBatchQuantity:Math.min(100,remaining),completed:remaining===0,createdAt:pinned.createdAt};
  }
  if(options.facilityId!==undefined&&(typeof options.facilityId!=='string'||!options.facilityId.trim()))throw new GameError('Choose a valid facility goal.');
  const facilityId=options.facilityId??(pinnedGoal&&!pinnedGoal.completed?pinnedGoal.facilityId:undefined),quantity=options.quantity??(options.facilityId===undefined?pinnedGoal?.nextBatchQuantity:undefined)??1;
  if(options.quantity!==undefined)integer(options.quantity,'Goal quantity',1,100);
  const goal=facilityId?makeGoal(ctx,facilityId,quantity):null;
  return {version:1,generatedAt:now,revision:game.world.revision,regionId:region.id,pinnedGoal,goal,graph:makeGraph(ctx,goal),onboarding:onboarding(ctx)};
}

/** Cheap snapshot enrichment: no graph traversal, stock mutation or simulation. */
export function onboardingProgress(game:Game,corp:Corp,now=corp.lastProcessed,regionId=game.world.regions[0]!.id){
  const region=game.world.regions.find(r=>r.id===regionId),holding=corp.holdings[regionId];
  if(!region||!holding)throw new GameError('Choose a valid region.');
  const value=onboarding({game,corp,region,holding,now,flows:new Map(),groups:new Map()});
  return {...value,steps:value.steps.map(step=>({...step,completed:step.done,screen:step.action.screen})),recommendedScreen:value.next?.action.screen||'overview'};
}
