import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { ArrowRight, ChevronDown, Focus, GitBranch, List, Maximize, Network, RotateCcw, X } from 'lucide-react';
import { Badge, EntityIcon, Field, money, number, titleCase, type Data } from './ui';
import { useViewPreference } from './view-state';
import '@xyflow/react/dist/style.css';
import './planner.css';

type FlowNode = Node<{ item: Data; collapsed: boolean }, 'production'>;
const warningStatuses = new Set(['starved','shortage','missing','capacity','deficit','locked','not-built','no-production','development-required','combination-required','incomplete','blocked']);
let layoutEngine: Promise<import('elkjs/lib/elk.bundled.js').ELK> | undefined;
function rate(value: unknown, cash = false) { return `${cash ? money(value) : number(value, Number(value)>0&&Number(value)<.01?6:2)}/min`; }
function edgeLabel(edge: Data) { return edge.perMinute != null ? `${number(edge.perMinute, Number(edge.perMinute)>0&&Number(edge.perMinute)<.01?6:2)}/min${edge.qualityDependent ? ' expected' : ''}` : edge.quantityPerCycle != null ? `${number(edge.quantityPerCycle)} units` : titleCase(edge.kind); }
function nodeMetric(node: Data) {
  if (node.kind === 'asset') return `${node.assetId === 'cash' ? money(node.stock) : number(node.stock)} in stock`;
  if (node.additionalCount != null) return `${number(node.ownedCount ?? node.existingCount)} existing · +${number(node.additionalCount)} planned`;
  return node.kind === 'facility' ? `${number(node.ownedCount)} built · ${number(node.activeCount)} active` : titleCase(node.kind);
}
const ProductionNode = memo(function ProductionNode({ data, selected }: NodeProps<FlowNode>) {
  const n = data.item;
  return <div className={`flow-node ${n.kind} ${warningStatuses.has(n.status) ? 'attention' : ''} ${selected ? 'is-selected' : ''}`}>
    <Handle type="target" position={Position.Left}/><div className="flow-node-title"><EntityIcon entity={n} size={34}/><strong>{n.name}</strong></div>
    <span>{nodeMetric(n)}</span><div className="flow-node-footer"><small>{n.kind === 'asset' ? `${rate(n.netPerMinute, n.assetId === 'cash')} net` : titleCase(n.status)}</small>{data.collapsed && <small className="flow-collapsed">Branch hidden</small>}</div>
    <Handle type="source" position={Position.Right}/>
  </div>;
});
const nodeTypes = { production: ProductionNode };

function reachable(start: string, edges: Data[], direction: 'upstream'|'downstream') {
  const seen = new Set<string>([start]), queue = [start];
  while (queue.length) { const next = queue.shift()!; for (const e of edges) { const id = direction === 'upstream' && e.to === next ? e.from : direction === 'downstream' && e.from === next ? e.to : null; if (id && !seen.has(id)) { seen.add(id); queue.push(id); } } }
  return seen;
}

export function ProductionGraph({ graph, initialSelection = '', onAction, nodeControls, label = 'Production flow graph' }: {
  graph: Data; initialSelection?: string; onAction: (action: Data) => void; nodeControls?: (node: Data) => ReactNode; label?: string;
}) {
  const nodes: Data[] = graph.nodes || [], edges: Data[] = graph.edges || [];
  const [view, setView] = useViewPreference<'canvas'|'list'>('planner-graph-view', window.matchMedia('(max-width: 760px)').matches ? 'list' : 'canvas');
  const [layer, setLayer] = useViewPreference('planner-graph-layer', 'operations');
  const [selected, setSelected] = useViewPreference('planner-selected-node', initialSelection);
  const [search, setSearch] = useState(''), [focused, setFocused] = useState(false), [collapsed, setCollapsed] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, {x:number;y:number}>>({}), [layoutBusy, setLayoutBusy] = useState(false);
  const flow = useRef<ReactFlowInstance<FlowNode> | null>(null), fitFirst = useRef(true), generation = useRef(0);
  useEffect(() => { if (initialSelection) { setSelected(initialSelection); setFocused(true); } }, [initialSelection]);
  const activeEdges = edges.filter(e => layer === 'all' || (layer === 'operations' ? ['input','output'].includes(e.kind) : !['input','output'].includes(e.kind)));
  const activeIds = new Set(activeEdges.flatMap(e => [e.from,e.to]));
  let activeNodes = nodes.filter(n => activeIds.has(n.id) || n.id === selected || (activeEdges.length===0&&nodes.length===1));
  if (focused && selected) { const ids = new Set([...reachable(selected, activeEdges, 'upstream'), ...reachable(selected, activeEdges, 'downstream')]); activeNodes = activeNodes.filter(n => ids.has(n.id)); }
  const hidden = new Set<string>();
  for (const id of collapsed) for (const ancestor of reachable(id, activeEdges, 'upstream')) if (ancestor !== id && !collapsed.includes(ancestor)) hidden.add(ancestor);
  activeNodes = activeNodes.filter(n => !hidden.has(n.id));
  const visibleIds = new Set(activeNodes.map(n => n.id)), visibleEdges = activeEdges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));
  const topology = JSON.stringify({nodes:activeNodes.map(n => n.id).sort(),edges:visibleEdges.map(e => [e.id,e.from,e.to]).sort()});
  useEffect(() => {
    if(view!=='canvas')return;const current = ++generation.current, shape = JSON.parse(topology); setLayoutBusy(true);
    if (!shape.nodes.length) { setPositions({}); setLayoutBusy(false); return; }
    (layoutEngine??=import('elkjs/lib/elk.bundled.js').then(({default:ELK})=>new ELK())).then(elk=>elk.layout({id:'network',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.spacing.nodeNode':'42','elk.layered.spacing.nodeNodeBetweenLayers':'115','elk.layered.nodePlacement.strategy':'NETWORK_SIMPLEX'},children:shape.nodes.map((id:string)=>({id,width:226,height:112})),edges:shape.edges.map(([id,from,to]:string[])=>({id,sources:[from],targets:[to]}))}))
      .then(result => { if (current !== generation.current) return; setPositions(Object.fromEntries((result.children || []).map(n => [n.id,{x:n.x || 0,y:n.y || 0}]))); })
      .catch(() => { if (current === generation.current) setPositions(Object.fromEntries(shape.nodes.map((id:string,i:number)=>[id,{x:(i%4)*330,y:Math.floor(i/4)*165}]))); })
      .finally(() => { if (current === generation.current) setLayoutBusy(false); });
    return () => { generation.current++; };
  }, [topology,view]);
  useEffect(() => { if (!layoutBusy && Object.keys(positions).length && fitFirst.current) { const timer = window.setTimeout(() => { if(flow.current){void flow.current.fitView({padding:.14,maxZoom:1});fitFirst.current=false;} },80); return()=>window.clearTimeout(timer); } }, [positions,layoutBusy,view]);
  const flowNodes: FlowNode[] = activeNodes.map(n => ({id:n.id,type:'production',data:{item:n,collapsed:collapsed.includes(n.id)},position:positions[n.id] || {x:0,y:0},selected:n.id===selected,draggable:false,ariaLabel:`${n.name}, ${titleCase(n.status)}, ${nodeMetric(n)}`}));
  const flowEdges = visibleEdges.map(e => ({id:e.id,source:e.from,target:e.to,type:'smoothstep',label:edgeLabel(e),markerEnd:{type:MarkerType.ArrowClosed,color:['input','output'].includes(e.kind)?'var(--graph-line)':'var(--graph-construction)'},style:{stroke:['input','output'].includes(e.kind)?'var(--graph-line)':'var(--graph-construction)',strokeWidth:1.6,strokeDasharray:['input','output'].includes(e.kind)?undefined:'6 4'},labelStyle:{fontSize:11,fill:'var(--text-secondary)'},labelBgStyle:{fill:'var(--surface-raised)',fillOpacity:.97},labelBgPadding:[6,4] as [number,number],className:`production-edge ${e.kind}` }));
  const selectedNode = nodes.find(n => n.id === selected), connections = edges.filter(e => e.from === selected || e.to === selected);
  const matches = useMemo(() => nodes.filter(n=>!search || n.name.toLowerCase().includes(search.toLowerCase())), [nodes,search]);
  const choose = (id:string) => { setSelected(id); const position=positions[id];if(position&&flow.current&&view==='canvas')void flow.current.setCenter(position.x+113,position.y+56,{zoom:Math.max(.75,flow.current.getZoom()),duration:250}); };
  const resetView = () => { setCollapsed([]);setFocused(false);setSearch('');fitFirst.current=true; };
  return <div className="production-graph">
    <div className="graph-toolbar">
      <div className="graph-view-switch" role="group" aria-label="Network view"><button className={view==='canvas'?'active':''} onClick={()=>{setView('canvas');fitFirst.current=true;}} aria-pressed={view==='canvas'}><Network size={16}/>Flow graph</button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-pressed={view==='list'}><List size={16}/>List view</button></div>
      <Field label="Network layer"><select value={layer} onChange={e=>{setLayer(e.target.value);fitFirst.current=true;}}><option value="operations">Production flows</option><option value="construction">Construction & development</option><option value="all">All dependencies</option></select></Field>
      <Field label="Find a network node"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Resource or facility"/></Field>
    </div>
    {search && <div className="graph-search-results" aria-label="Matching network nodes">{matches.length?matches.map(n=><button key={n.id} onClick={()=>choose(n.id)}>{n.name}<ArrowRight size={13}/></button>):<p>No matching resource or facility.</p>}</div>}
    <div className="graph-tools"><button className="button secondary small" disabled={!selected} aria-pressed={focused} onClick={()=>{setFocused(!focused);fitFirst.current=true;}}><Focus size={14}/>{focused?'Show full network':'Focus selected chain'}</button><button className="button secondary small" disabled={!selected||!activeEdges.some(e=>e.to===selected)} onClick={()=>{setCollapsed(ids=>ids.includes(selected)?ids.filter(id=>id!==selected):[...ids,selected]);fitFirst.current=true;}}><ChevronDown size={14}/>{collapsed.includes(selected)?'Expand input branch':'Collapse input branch'}</button><button className="button quiet small" onClick={resetView}><RotateCcw size={14}/>Reset view</button>{view==='canvas'&&<button className="button quiet small" onClick={()=>void flow.current?.fitView({padding:.14,maxZoom:1,duration:250})}><Maximize size={14}/>Fit graph</button>}<span>{number(activeNodes.length)} nodes · {number(visibleEdges.length)} connections</span></div>
    <p className="graph-explainer">Arrows show shared regional inventory flows. Solid lines are production rates; dashed lines are one-time requirements. Expected rates can vary with quality and input availability.</p>
    {view==='canvas'?<div className="flow-canvas" role="region" aria-label={label} aria-busy={layoutBusy}>
      {activeNodes.length>0?<ReactFlow<FlowNode> nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onInit={instance=>{flow.current=instance;}} onNodeClick={(_e,n)=>setSelected(n.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){const id=(event.target as HTMLElement).closest('.react-flow__node')?.getAttribute('data-id');if(id){event.preventDefault();setSelected(id);}}}} onPaneClick={()=>setSelected('')} nodesConnectable={false} nodesDraggable={false} edgesFocusable={false} minZoom={.08} maxZoom={1.8} proOptions={{hideAttribution:false}} fitView={false}><Background color="var(--graph-grid)" gap={22}/><Controls showInteractive={false}/></ReactFlow>:<div className="graph-empty"><GitBranch size={30}/><h3>No connections in this layer</h3><p>Choose another layer or reset the view.</p></div>}
      {layoutBusy&&<span className="graph-layout-status" role="status">Arranging connections…</span>}
    </div>:<div className="network-nodes graph-accessible-list" role="list" aria-label="Production network list">{activeNodes.filter(n=>!search||matches.some(m=>m.id===n.id)).map(n=><div key={n.id} role="listitem"><button className={`network-node ${selected===n.id?'selected':''} ${warningStatuses.has(n.status)?'shortage':''}`} onClick={()=>choose(n.id)} aria-pressed={selected===n.id}><EntityIcon entity={n} size={32}/><span><strong>{n.name}</strong><small>{nodeMetric(n)}{n.kind==='asset'?` · ${rate(n.netPerMinute,n.assetId==='cash')} net`:''}</small></span><Badge>{titleCase(n.status)}</Badge></button><ul className="graph-list-edges">{visibleEdges.filter(e=>e.from===n.id).map(e=><li key={e.id}><button onClick={()=>choose(e.to)}><ArrowRight size={13}/>{nodes.find(x=>x.id===e.to)?.name}<span>{titleCase(e.kind)} · {edgeLabel(e)}</span></button></li>)}</ul></div>)}</div>}
    {selectedNode&&<aside className="node-detail graph-node-detail" aria-label="Selected network node"><div className="graph-detail-title"><EntityIcon entity={selectedNode} size={38}/><div><h3>{selectedNode.name}</h3><span>{titleCase(selectedNode.kind)} · {titleCase(selectedNode.status)}</span></div><button className="icon-button" aria-label="Clear node selection" onClick={()=>setSelected('')}><X size={16}/></button></div>
      <div className="graph-node-facts"><span>{nodeMetric(selectedNode)}</span>{selectedNode.kind==='asset'&&<><span>Output {rate(selectedNode.outputPerMinute,selectedNode.assetId==='cash')}</span><span>Demand {rate(selectedNode.inputPerMinute,selectedNode.assetId==='cash')}</span><span>Net {rate(selectedNode.netPerMinute,selectedNode.assetId==='cash')}</span></>}</div>
      {selectedNode.reasons?.map((reason:string)=><p key={reason}>{reason}</p>)}{nodeControls?.(selectedNode)}
      <div className="connection-list">{connections.map(e=><button key={e.id} onClick={()=>choose(e.from===selected?e.to:e.from)}><span>{nodes.find(n=>n.id===e.from)?.name}</span><ArrowRight size={15}/><span>{nodes.find(n=>n.id===e.to)?.name}</span><small>{titleCase(e.kind)} · {edgeLabel(e)}</small></button>)}</div>
      <div className="button-row">{selectedNode.actions?.map((action:Data,i:number)=><button className="button secondary small" key={i} onClick={()=>onAction(action)}>{action.label}<ArrowRight size={13}/></button>)}</div>
    </aside>}
    {graph.truncated&&<p className="inline-warning">This network exceeds the display limit. Focus a smaller target to inspect further branches.</p>}
  </div>;
}
