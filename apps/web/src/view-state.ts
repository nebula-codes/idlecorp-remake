import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useGame } from './ui';

export function readPreference<T>(key:string, fallback:T):T {
  try {
    const value=JSON.parse(localStorage.getItem(key)||'null');
    if(value===null||typeof value!==typeof fallback||Array.isArray(value)!==Array.isArray(fallback))return fallback;
    return value;
  }catch{return fallback;}
}
export function writePreference(key:string,value:unknown){
  try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Preferences are optional when storage is unavailable. */}
}

/** Non-economic display preferences stay private to this browser/account/region. */
export function useViewPreference<T>(name:string,initial:T):[T,Dispatch<SetStateAction<T>>]{
  const {state,regionId}=useGame();
  const key=`idlecorp-view-v2:${state.corporation.id}:${regionId}:${name}`;
  const [entry,setEntry]=useState(()=>({key,value:readPreference(key,initial)}));
  const value=entry.key===key?entry.value:readPreference(key,initial);
  useEffect(()=>{
    const update=()=>setEntry({key,value:readPreference(key,initial)});
    update();window.addEventListener('idlecorp-preference',update);window.addEventListener('storage',update);
    return()=>{window.removeEventListener('idlecorp-preference',update);window.removeEventListener('storage',update);};
  // The fallback is only a default, not a reason to reset a saved preference.
  },[key]);
  const setValue=useCallback<Dispatch<SetStateAction<T>>>(next=>{
    const previous=readPreference(key,initial);
    const updated=typeof next==='function'?(next as (value:T)=>T)(previous):next;
    writePreference(key,updated);setEntry({key,value:updated});window.dispatchEvent(new Event('idlecorp-preference'));
  },[key,initial]);
  return [value,setValue];
}
