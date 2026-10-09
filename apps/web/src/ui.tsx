import { cloneElement,isValidElement,useId,createContext,useContext,useEffect,useRef,type ReactElement,type ElementType,type ReactNode } from 'react';

import { Package,X } from 'lucide-react';



export type Data = Record<string, any>;

export type Screen = 'overview'|'facilities'|'inventory'|'chains'|'market'|'retail'|'logistics'|'research'|'region'|'prestige'|'season'|'space'|'leaderboard'|'settings'|'planner'|'cooperation';

export type GameContext = { state: Data; content: Data; region: Data; holding: Data; regionId: string; busy: boolean; act: (type: string, data?: Data) => Promise<any>; go: (screen: Screen, intent?: Data) => void; intent: Data; advice:Data|null; dismissReturn:()=>void; api: (path:string,opts?:RequestInit)=>Promise<any>; notify:(message:string)=>void; reportError:(message:string)=>void; now: number; refresh: () => Promise<void> };

export const Context = createContext<GameContext>(null!);

export const useGame = () => useContext(Context);

export const number = (value: unknown, digits = 0) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

export const money = (value: unknown) => '$' + number(Number(value||0)/100, 2);

export const compact = (value: unknown) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));

export const titleCase = (value: string = '') => value.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());

export const list = (value: any): Data[] => Array.isArray(value) ? value : Object.entries(value || {}).map(([id, val]) => typeof val === 'object' ? { id, ...val as Data } : { id, value: val });

export const entries = (value: any): [string, any][] => Object.entries(value || {});

export const remaining = (until: any, now: number) => { const ms = Number(until || 0)-now; if (ms<=0) return 'Ready'; const seconds=Math.ceil(ms/1000); return seconds>=86400?`${Math.floor(seconds/86400)}d ${Math.floor(seconds%86400/3600)}h`:seconds>=3600?`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m`:seconds>=60?`${Math.floor(seconds/60)}m ${seconds%60}s`:`${seconds}s`; };

export function IconBox({icon: Icon, tone='orange',small=false}:{icon:ElementType;tone?:string;small?:boolean}) { return <span className={`icon-box ${tone} ${small?'small':''}`}><Icon size={small?17:22} strokeWidth={1.7}/></span>; }

export function EntityIcon({entity, size=40}:{entity?:Data;size?:number}) { return <span className="entity-icon" style={{width:size,height:size}}>{entity?.icon?<img src={entity.icon} alt="" width={size} height={size}/>:<Package size={size*.55}/>}</span>; }

export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}) { return <span className={`badge ${tone}`}>{children}</span>; }

export function Empty({icon:Icon=Package,title,children,action}:{icon?:ElementType;title:string;children?:ReactNode;action?:ReactNode}) { return <div className="empty"><Icon size={32} strokeWidth={1.3}/><h3>{title}</h3>{children&&<p>{children}</p>}{action}</div>; }

export function Panel({title,subtitle,action,children,className=''}:{title?:string;subtitle?:string;action?:ReactNode;children:ReactNode;className?:string}) { return <section className={`panel ${className}`}>{title&&<header className="panel-header"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>}{children}</section>; }

export function Action({type,data,children,disabled=false,title,variant='primary',onDone}:{type:string;data?:Data;children:ReactNode;disabled?:boolean;title?:string;variant?:string;onDone?:(data:any)=>void}) { const {act,busy}=useGame(); return <button className={`button ${variant}`} title={title} disabled={disabled||busy} onClick={async()=>{const result=await act(type,data);if(result)onDone?.(result);}}>{children}</button>; }

export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) { const id=useId();return <label className="field"><span id={id}>{label}</span>{isValidElement(children)?cloneElement(children as ReactElement<{'aria-labelledby'?:string;'aria-describedby'?:string}>,{'aria-labelledby':id,...(hint?{'aria-describedby':id+'-hint'}:{})}):children}{hint&&<small id={id+'-hint'}>{hint}</small>}</label>; }

export function Quantity({value,onChange,min=1,max=1000000,...accessibility}:{value:number;onChange:(n:number)=>void;min?:number;max?:number;'aria-labelledby'?:string;'aria-describedby'?:string}) { return <input {...accessibility} type="number" min={min} max={max} step="1" value={value} onChange={e=>onChange(Math.max(min,Math.min(max,Math.floor(Number(e.target.value)||min))))} aria-label="Quantity"/>; }

export function AssetSelect({value,onChange,owned=false,includeCash=false,kind,...accessibility}:{value:string;onChange:(id:string)=>void;owned?:boolean;includeCash?:boolean;kind?:string;'aria-labelledby'?:string;'aria-describedby'?:string}) { const {content,holding}=useGame(); const assets=[...(includeCash?[{id:'cash',name:'Cash'}]:[]),...list(content.assets)].filter(a=>(includeCash||a.id!=='cash')&&(!owned||Number(holding.inventory?.[a.id]||0)>0)&&(!kind||a[kind]!==false)); return <select {...accessibility} value={value} onChange={e=>onChange(e.target.value)} aria-label="Resource">{assets.map(a=><option key={a.id} value={a.id}>{a.name}{owned?` (${number(holding.inventory[a.id])})`:''}</option>)}</select>; }

export function Resources({items,check=false}:{items:Data;check?:boolean}) { const {content,holding}=useGame(); return <div className="resources">{entries(items).map(([id,qty])=>{const asset=list(content.assets).find(a=>a.id===id);return <span key={id} className={check&&Number(holding.inventory?.[id]||0)<Number(qty)?'missing':''} title={check?`${number(holding.inventory?.[id])} in inventory`:asset?.name||titleCase(id)}><EntityIcon entity={asset} size={20}/>{id==='cash'?money(qty):number(qty,2)} {asset?.name||titleCase(id)}</span>;})}</div>; }

export function Confirm({title,children,onClose,onConfirm,button='Confirm',danger=false,disabled=false}:{title:string;children:ReactNode;onClose:()=>void;onConfirm:()=>void;button?:string;danger?:boolean;disabled?:boolean}) { const closeRef=useRef<HTMLButtonElement>(null),closeCallback=useRef(onClose);closeCallback.current=onClose;useEffect(()=>{const previous=document.activeElement as HTMLElement|null;closeRef.current?.focus();const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')closeCallback.current();if(e.key==='Tab'){const focusables=Array.from(document.querySelectorAll<HTMLElement>('.modal button:not(:disabled), .modal input, .modal select, .modal textarea, .modal a'));const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};window.addEventListener('keydown',fn);return()=>{window.removeEventListener('keydown',fn);if(previous?.isConnected)previous.focus();};},[]); return <div className="modal-backdrop" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e=>e.stopPropagation()}><header><h2 id="dialog-title">{title}</h2><button ref={closeRef} className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></header><div className="modal-content">{children}</div><footer><button className="button secondary" onClick={onClose}>Cancel</button><button className={`button ${danger?'danger':'primary'}`} disabled={disabled} onClick={onConfirm}>{button}</button></footer></section></div>; }



