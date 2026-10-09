import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Drawer({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLElement>(null),close=useRef(onClose),id=useId();close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const keys=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close.current();}
   if(event.key==='Tab'){
    const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  window.addEventListener('keydown',keys);return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',keys);if(previous?.isConnected)previous.focus();};
 },[]);
 return <div className="drawer-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="workspace-drawer" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}><header><h2 id={id}>{title}</h2><button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={20}/></button></header><div className="drawer-content">{children}</div></section></div>;
}
