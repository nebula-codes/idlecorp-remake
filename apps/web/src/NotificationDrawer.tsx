import { useState } from 'react';
import { ArrowRight, Award, Bell, Check, CircleAlert, Factory, FlaskConical, Truck } from 'lucide-react';
import { Action, Badge, Empty, list, titleCase, useGame, type Data, type Screen } from './ui';
import { Drawer } from './drawer';

export function NotificationDrawer({onClose}:{onClose:()=>void}){
 const {state,content,go,act}=useGame(),[tab,setTab]=useState('attention');
 const alerts:Data[]=[];
 for(const [regionId,holding]of Object.entries(state.holdings) as [string,Data][]){
  const region=list(state.regions).find(r=>r.id===regionId);
  const groups=new Map<string,Data[]>();
  for(const facility of list(holding.facilities).filter(f=>f.enabled&&['starved','capacity'].includes(f.status))){const key=`${facility.type}:${facility.status}`;groups.set(key,[...(groups.get(key)||[]),facility]);}
  for(const facilities of groups.values()){
   const facility=facilities[0],def=list(content.facilities).find(d=>d.id===facility.type),name=def?.name||titleCase(facility.type);
   const missing=[...new Set(facilities.flatMap(f=>list(f.missingInputs).map(i=>i.assetId as string)))];
   const outputs=[...new Set(facilities.flatMap(f=>Object.keys(f.expectedOutputRates||f.outputRates||{})))];
   const resourceIds=facility.status==='starved'?missing:outputs;
   const resources=resourceIds.filter(id=>id!=='cash').map(id=>({id,name:list(content.assets).find(a=>a.id===id)?.name||titleCase(id)}));
   alerts.push({id:`${regionId}:${facility.type}:${facility.status}`,icon:Factory,title:facilities.length===1?`${name} needs attention`:`${facilities.length} × ${name} need attention`,message:facility.status==='capacity'?facility.capacityReason:`Missing ${missing.map(id=>id==='cash'?'cash':list(content.assets).find(a=>a.id===id)?.name||titleCase(id)).join(', ')}`,region:region?.name,screen:'facilities',intent:{regionId,tab:'owned',facilityId:facility.type,id:facility.id},resources,needsCash:resourceIds.includes('cash'),regionId,capacity:facility.status==='capacity'});
  }
  for(const research of list(holding.research).filter(r=>r.status==='ready'))alerts.push({id:research.id,icon:FlaskConical,title:'Research ready to receive',message:'Open the completed discovery to receive its result.',region:region?.name,screen:'research',intent:{regionId,tab:'projects',id:research.id}});
 }
 for(const shipment of list(state.shipments).filter(s=>s.status==='arrived'))alerts.push({id:shipment.id,icon:Truck,title:'Shipment arrived',message:`${titleCase(shipment.assetId)} is ready to receive.`,screen:'logistics',intent:{id:shipment.id,tab:'shipments',regionId:shipment.toRegionId||shipment.destinationRegionId}});
 const inbox=list(state.inbox).filter(i=>i.status==='pending');
 if(inbox.length)alerts.push({id:'inbox',icon:Truck,title:`${inbox.length} deliveries waiting`,message:'Claim resources or cash from completed trades.',screen:'logistics',intent:{tab:'inbox'}});
 if(state.space?.expedition?.status==='ready')alerts.push({id:'expedition',icon:CircleAlert,title:'Expedition returned',message:'Receive the report from your expedition.',screen:'space',intent:{tab:'expedition'}});
 const notes=list(state.notifications),unread=notes.filter(n=>!n.read).length;
 const open=(screen:Screen,intent:Data)=>{onClose();go(screen,intent);};
 const openRecorded=async(note:Data)=>{
  if(!note.read&&!await act('notification.read',{ids:[note.id]}))return;
  const trade=list(state.trades).find(t=>t.id===note.relatedId),order=list(state.orders).find(o=>o.id===note.relatedId);
  if(note.type==='facility_level'){
   const facilities=list(state.holdings[note.regionId]?.facilities),change=list(note.changes).find(item=>facilities.some(f=>f.id===item.id));
   open('facilities',{tab:'owned',regionId:note.regionId,...(change?{id:change.id,facilityId:change.type}:{})});
  }else if(note.type==='arrival'){
   const shipment=list(state.shipments).find(s=>s.id===note.relatedId);open('logistics',{tab:'exports',id:note.relatedId,regionId:shipment?.toRegionId});
  }else if(note.type==='research'){
   const target=Object.entries(state.holdings).find(([,h]:[string,any])=>list(h.research).some(r=>r.id===note.relatedId));open('research',{tab:'projects',id:note.relatedId,regionId:target?.[0]});
  }else if(note.type==='space')open('space',{});
  else if(note.type==='order_fill')open('market',{tab:'history',assetId:trade?.assetId||order?.assetId,id:note.relatedId});
  else if(note.type?.startsWith('contract')||note.type?.startsWith('project'))open('cooperation',{tab:note.type.startsWith('project')?'projects':'contracts',id:note.relatedId});
  else open('settings',{tab:'activity',id:note.relatedId});
 };
 return <Drawer title="Notifications" onClose={onClose}><div className="tabs drawer-tabs"><button className={tab==='attention'?'active':''} onClick={()=>setTab('attention')}>Needs attention <span>{alerts.length}</span></button><button className={tab==='events'?'active':''} onClick={()=>setTab('events')}>Events <span>{unread}</span></button></div>
  {tab==='attention'?<div className="drawer-alerts">{alerts.map(alert=><div key={alert.id} className={alert.resources?'drawer-production-alert':''} data-production-alert={alert.resources?alert.id:undefined}><button className="drawer-alert" onClick={()=>open(alert.screen,alert.intent)}><alert.icon size={19}/><span><strong>{alert.title}</strong><small>{alert.message}</small>{alert.region&&<small>{alert.region}</small>}</span><ArrowRight size={16}/></button>{alert.resources&&<div className="production-alert-actions">{alert.resources.map((resource:Data)=><div key={resource.id}><span>{resource.name}</span><button className="text-button" onClick={()=>open('inventory',{regionId:alert.regionId,assetId:resource.id})} aria-label={`Review ${resource.name} supply`}>{alert.capacity?'Manage stock':'Supply details'}</button><button className="text-button" onClick={()=>open('market',{regionId:alert.regionId,assetId:resource.id,tab:'npc'})} aria-label={`Review ${resource.name} market`}>Market <ArrowRight size={12}/></button></div>)}{alert.needsCash&&<button className="text-button" onClick={()=>open('overview',{regionId:alert.regionId})}>Review cash flow <ArrowRight size={12}/></button>}</div>}</div>)}{!alerts.length&&<Empty icon={Check} title="Everything is in hand">No blocked production or unclaimed completions in your latest snapshot.</Empty>}</div>:<><div className="drawer-actions"><Badge>{unread} unread</Badge><Action type="notification.read" data={{all:true}} variant="quiet" disabled={!unread}>Mark all read</Action></div><div className="drawer-alerts">{notes.map(note=><div className={`drawer-event ${note.read?'read':''}`} key={note.id} data-notification-type={note.type}><button className="drawer-alert" onClick={()=>void openRecorded(note)}>{note.type==='facility_level'?<Award size={18}/>:<Bell size={18}/>}<span><strong>{note.title}</strong><small>{note.message}</small><small>{new Date(note.at).toLocaleString()}</small></span><ArrowRight size={15}/></button>{note.type==='facility_level'&&list(note.changes).length>1&&<details className="level-event-facilities"><summary>Inspect {note.changes.length} leveled facilities</summary>{list(note.changes).map(change=>{const facility=list(state.holdings[note.regionId]?.facilities).find(f=>f.id===change.id);return <button className="text-button" key={change.id} disabled={!facility} onClick={()=>{if(!note.read)void act('notification.read',{ids:[note.id]});open('facilities',{tab:'owned',regionId:note.regionId,id:change.id,facilityId:change.type});}}>{list(content.facilities).find(f=>f.id===change.type)?.name||titleCase(change.type)} #{change.id.slice(0,8)} · Level {change.fromLevel} → {change.toLevel}{!facility?' · no longer owned':''}</button>;})}</details>}{!note.read&&<Action type="notification.read" data={{ids:[note.id]}} variant="quiet small">Mark read</Action>}</div>)}{!notes.length&&<Empty icon={Bell} title="No recorded events yet">Trade fills and other corporation events will appear here.</Empty>}</div></>}
 </Drawer>;
}
