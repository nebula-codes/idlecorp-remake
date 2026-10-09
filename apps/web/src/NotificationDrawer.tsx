import { useState } from 'react';
import { ArrowRight, Bell, Check, CircleAlert, Factory, FlaskConical, Truck } from 'lucide-react';
import { Action, Badge, Empty, list, titleCase, useGame, type Data, type Screen } from './ui';
import { Drawer } from './drawer';

export function NotificationDrawer({onClose}:{onClose:()=>void}){
 const {state,content,go,act}=useGame(),[tab,setTab]=useState('attention');
 const alerts:Data[]=[];
 for(const [regionId,holding]of Object.entries(state.holdings) as [string,Data][]){
  const region=list(state.regions).find(r=>r.id===regionId);
  for(const facility of list(holding.facilities).filter(f=>f.enabled&&['starved','capacity'].includes(f.status))){
   const def=list(content.facilities).find(d=>d.id===facility.type);
   alerts.push({id:facility.id,icon:Factory,title:`${def?.name||titleCase(facility.type)} needs attention`,message:facility.capacityReason||`Missing ${list(facility.missingInputs).map(i=>list(content.assets).find(a=>a.id===i.assetId)?.name||titleCase(i.assetId)).join(', ')}`,region:region?.name,screen:'facilities',intent:{regionId,tab:'owned',facilityId:facility.type,id:facility.id}});
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
  if(!note.read)await act('notification.read',{ids:[note.id]});
  const trade=list(state.trades).find(t=>t.id===note.relatedId),order=list(state.orders).find(o=>o.id===note.relatedId);
  if(note.type==='arrival'){
   const shipment=list(state.shipments).find(s=>s.id===note.relatedId);open('logistics',{tab:'exports',id:note.relatedId,regionId:shipment?.toRegionId});
  }else if(note.type==='research'){
   const target=Object.entries(state.holdings).find(([,h]:[string,any])=>list(h.research).some(r=>r.id===note.relatedId));open('research',{tab:'projects',id:note.relatedId,regionId:target?.[0]});
  }else if(note.type==='space')open('space',{});
  else if(note.type==='order_fill')open('market',{tab:'history',assetId:trade?.assetId||order?.assetId,id:note.relatedId});
  else if(note.type?.startsWith('contract')||note.type?.startsWith('project'))open('cooperation',{tab:note.type.startsWith('project')?'projects':'contracts',id:note.relatedId});
  else open('settings',{tab:'activity',id:note.relatedId});
 };
 return <Drawer title="Notifications" onClose={onClose}><div className="tabs drawer-tabs"><button className={tab==='attention'?'active':''} onClick={()=>setTab('attention')}>Needs attention <span>{alerts.length}</span></button><button className={tab==='events'?'active':''} onClick={()=>setTab('events')}>Events <span>{unread}</span></button></div>
  {tab==='attention'?<div className="drawer-alerts">{alerts.map(alert=><button className="drawer-alert" key={alert.id} onClick={()=>open(alert.screen,alert.intent)}><alert.icon size={19}/><span><strong>{alert.title}</strong><small>{alert.message}</small>{alert.region&&<small>{alert.region}</small>}</span><ArrowRight size={16}/></button>)}{!alerts.length&&<Empty icon={Check} title="Everything is in hand">No blocked production or unclaimed completions in your latest snapshot.</Empty>}</div>:<><div className="drawer-actions"><Badge>{unread} unread</Badge><Action type="notification.read" data={{all:true}} variant="quiet" disabled={!unread}>Mark all read</Action></div><div className="drawer-alerts">{notes.map(note=><div className={`drawer-event ${note.read?'read':''}`} key={note.id}><button className="drawer-alert" onClick={()=>void openRecorded(note)}><Bell size={18}/><span><strong>{note.title}</strong><small>{note.message}</small><small>{new Date(note.at).toLocaleString()}</small></span><ArrowRight size={15}/></button>{!note.read&&<Action type="notification.read" data={{ids:[note.id]}} variant="quiet small">Mark read</Action>}</div>)}{!notes.length&&<Empty icon={Bell} title="No recorded events yet">Trade fills and other corporation events will appear here.</Empty>}</div></>}
 </Drawer>;
}
