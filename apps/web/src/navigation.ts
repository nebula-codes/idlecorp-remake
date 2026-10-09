import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Data, Screen } from './ui';
import { readPreference, writePreference } from './view-state';

const screens=new Set<Screen>(['overview','facilities','inventory','chains','market','retail','logistics','research','region','prestige','season','space','leaderboard','settings','planner','cooperation']);
const allowedParams=new Set(['tab','filter','facilityId','assetId','id','quantity','technologyId','planId','mode','amount','source']);
type Route={screen:Screen;regionId:string;intent:Data;scroll:number;nonce:number};
const fallback:Route={screen:'overview',regionId:'',intent:{},scroll:0,nonce:0};
function routeHash(route:Route){
  const query=new URLSearchParams();if(route.regionId)query.set('region',route.regionId);
  for(const [key,value]of Object.entries(route.intent))if(allowedParams.has(key)&&['string','number'].includes(typeof value))query.set(key,String(value));
  return `#/${route.screen}${query.size?'?'+query:''}`;
}
function parseRoute(hash:string):Route|null{
  const [page,query='']=hash.replace(/^#\/?/,'').split('?');if(!screens.has(page as Screen))return null;
  const params=new URLSearchParams(query),intent:Data={};
  for(const [key,value]of params)if(allowedParams.has(key)&&value.length<=160)intent[key]=['quantity','amount'].includes(key)?Number(value)||1:value;
  const regionId=params.get('region')||'';
  return {screen:page as Screen,regionId:/^[a-z0-9_-]{0,60}$/.test(regionId)?regionId:'',intent,scroll:0,nonce:Date.now()};
}
function initialRoute():Route{
  const stored=readPreference('idlecorp-last-route',fallback);
  const saved={...fallback,...stored,intent:stored.intent&&typeof stored.intent==='object'?stored.intent:{},scroll:Number.isFinite(stored.scroll)?Math.max(0,stored.scroll):0};
  const fromUrl=parseRoute(window.location.hash);
  if(fromUrl)return {...fromUrl,scroll:window.history.state?.idlecorpScroll??(routeHash(fromUrl)===routeHash(saved)?saved.scroll:0)};
  return screens.has(saved.screen)?saved:fallback;
}

export function useNavigation(ready:boolean){
  const [route,setRoute]=useState(initialRoute),current=useRef(route),restoring=useRef(true),positions=useRef(new Map<string,number>());
  current.current=route;
  const remember=useCallback(()=>{
    if(restoring.current)return;
    const next={...current.current,scroll:window.scrollY};
    positions.current.set(routeHash(next),next.scroll);writePreference('idlecorp-last-route',next);
    window.history.replaceState({...window.history.state,idlecorpScroll:next.scroll},'',routeHash(next));
  },[]);
  const go=useCallback((screen:Screen,intent:Data={})=>{
    remember();
    const regionId=typeof intent.regionId==='string'?intent.regionId:current.current.regionId;
    const next:Route={screen,regionId,intent,scroll:0,nonce:Date.now()};
    next.scroll=positions.current.get(routeHash(next))||0;
    restoring.current=true;window.history.pushState({idlecorpScroll:next.scroll},'',routeHash(next));setRoute(next);
  },[remember]);
  const ensureRegion=useCallback((holdings:Data)=>{
    setRoute(old=>holdings[old.regionId]?old:{...old,regionId:Object.keys(holdings)[0]||''});
  },[]);
  useEffect(()=>{
    let scrollTimer:ReturnType<typeof setTimeout>;
    const onHistory=()=>{clearTimeout(scrollTimer);const next=parseRoute(window.location.hash);if(next){restoring.current=true;setRoute({...next,scroll:window.history.state?.idlecorpScroll||0});}};
    const onScroll=()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(remember,180);};
    const old=window.history.scrollRestoration;window.history.scrollRestoration='manual';
    window.addEventListener('popstate',onHistory);window.addEventListener('hashchange',onHistory);window.addEventListener('scroll',onScroll,{passive:true});
    return()=>{clearTimeout(scrollTimer);window.history.scrollRestoration=old;window.removeEventListener('popstate',onHistory);window.removeEventListener('hashchange',onHistory);window.removeEventListener('scroll',onScroll);};
  },[remember]);
  useLayoutEffect(()=>{
    if(!ready)return;
    restoring.current=true;
    window.history.replaceState({...window.history.state,idlecorpScroll:route.scroll},'',routeHash(route));writePreference('idlecorp-last-route',route);
    let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{window.scrollTo({top:route.scroll,behavior:'instant'});restoring.current=false;});});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[route,ready]);
  return {screen:route.screen,regionId:route.regionId,intent:{...route.intent,nonce:route.nonce} as Data,go,ensureRegion};
}
