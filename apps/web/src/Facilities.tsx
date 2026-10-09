import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ChevronDown, ChevronRight, Factory, Leaf, LoaderCircle, LockKeyhole, MapPin, Pause, Play, Plus, Search, SlidersHorizontal, Sparkles, Star, Timer, Trash2, X } from 'lucide-react';
import { Action, Badge, Confirm, Empty, EntityIcon, Field, IconBox, Quantity, Resources, entries, list, money, number, remaining, titleCase, useGame, type Data } from './ui';
import { useViewPreference } from './view-state';
import './facilities.css';

const statusNames: Record<string, string> = { producing: 'Running', paused: 'Paused', starved: 'Waiting for inputs', capacity: 'Storage full', infrastructure: 'Infrastructure' };
const statusTone: Record<string, string> = { producing: 'green', paused: 'neutral', starved: 'amber', capacity: 'amber', infrastructure: 'blue' };
const statusOf = (facility: Data) => facility.status === 'infrastructure' ? 'infrastructure' : !facility.enabled ? 'paused' : facility.status || 'producing';
const margin = (facility: Data) => Number(facility.metrics?.estimatedMarginPerMinute || 0);
const sumRates = (facilities: Data[], field: string) => facilities.reduce<Data>((rates, facility) => {
  for (const [id, value] of entries(facility[field])) if (Number.isFinite(Number(value))) rates[id] = (rates[id] || 0) + Number(value);
  return rates;
}, {});

function SelectionBox({ ids, selected, onChange, label }: { ids: string[]; selected: string[]; onChange: (ids: string[]) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null), count = ids.filter(id => selected.includes(id)).length;
  useEffect(() => { if (ref.current) ref.current.indeterminate = count > 0 && count < ids.length; }, [count, ids.length]);
  return <input ref={ref} type="checkbox" aria-label={label} checked={ids.length > 0 && count === ids.length} onChange={event => onChange(event.target.checked ? [...new Set([...selected, ...ids])] : selected.filter(id => !ids.includes(id)))}/>;
}

function StatusCounts({ facilities, cycleProgress }: { facilities: Data[]; cycleProgress?: number }) {
  const counts = facilities.reduce<Record<string, number>>((all, facility) => { const status = statusOf(facility); all[status] = (all[status] || 0) + 1; return all; }, {});
  return <span className="facility-status-counts">{Object.entries(counts).map(([status, count]) => <Badge key={status} tone={statusTone[status]}>{facilities.length > 1 ? `${count} ` : ''}{statusNames[status] || titleCase(status)}</Badge>)}{cycleProgress !== undefined && <small className="facility-cycle-percent">{Math.floor(cycleProgress)}%</small>}</span>;
}

function RateSummary({ facilities }: { facilities: Data[] }) {
  const running = facilities.filter(f => statusOf(f) === 'producing');
  const expected = facilities.every(f => f.expectedOutputRates != null), rates = sumRates(running, expected ? 'expectedOutputRates' : 'outputRates'), values = entries(rates);
  const { content } = useGame();
  return <div className="facility-rate-summary" title={expected ? 'Sum of server expected output rates for currently running facilities, including quality probabilities and current plus-input choices. Excludes paused, blocked and infrastructure facilities. Future outcomes and interruptions can change actual output.' : 'Sum of server nominal output rates for currently running facilities, before quality outcomes. Excludes paused, blocked and infrastructure facilities.'}>
    <small>{expected ? 'Expected' : 'Nominal'} running output / min</small>
    {values.length ? <div>{values.slice(0, 2).map(([id, value]) => <span key={id}>{id === 'cash' ? money(value) : number(value, 2)} {list(content.assets).find(a => a.id === id)?.name || titleCase(id)}</span>)}{values.length > 2 && <span>+{values.length - 2} resources</span>}</div> : <span className="muted">{facilities.every(f => statusOf(f) === 'infrastructure') ? 'Infrastructure · no production' : 'No running output'}</span>}
  </div>;
}

export function Facilities() {
  const { state, content, holding, act, busy, now, intent, regionId, go, mutation } = useGame();
  const defs = list(content.facilities), owned = list(holding.facilities);
  const definitions = useMemo(() => new Map(list(content.facilities).map(d => [d.id, d])), [content.facilities]);
  const [tab, setTab] = useViewPreference<string>('facilities.tab', owned.length ? 'owned' : 'catalogue');
  const [search, setSearch] = useViewPreference<string>('facilities.search', '');
  const [category, setCategory] = useViewPreference<string>('facilities.category', 'all');
  const [ownedFilter, setOwnedFilter] = useViewPreference<string>('facilities.filter', 'all');
  const [groupFilter, setGroupFilter] = useViewPreference<string>('facilities.group', 'all');
  const [ownedSort, setOwnedSort] = useViewPreference<string>('facilities.sort', 'name');
  const [layout, setLayout] = useViewPreference<string>('facilities.layout', 'grouped');
  const [density, setDensity] = useViewPreference<string>('facilities.density', 'dense');
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [expandedGroups, setExpandedGroups] = useState<string[]>([]), [expandedId, setExpandedId] = useState<string | null>(null);
  const [group, setGroup] = useState(''), [quantity, setQuantity] = useState(1), [land, setLand] = useState(1), [xpAmount, setXpAmount] = useState(1);
  const [build, setBuild] = useState<Data | null>(null), [demolish, setDemolish] = useState<Data | null>(null), [building, setBuilding] = useState(false), [demolishing, setDemolishing] = useState(false);
  const focusId = useRef<string | null>(null);
  const used = owned.reduce((sum, f) => sum + Number(definitions.get(f.type)?.land || 1), 0), free = Number(holding.land) - used;
  const ownedIds = owned.map(f => f.id).join('|');

  useEffect(() => { setSelectedIds([]); setExpandedId(null); setExpandedGroups([]); setBuild(null); setDemolish(null); }, [regionId]);
  useEffect(() => { const ids = new Set(ownedIds.split('|')); setSelectedIds(previous => previous.filter(id => ids.has(id))); }, [ownedIds]);
  useEffect(() => {
    if (intent.tab) setTab(intent.tab);
    if (intent.filter) setOwnedFilter(intent.filter);
    if (intent.facilityId || intent.id) {
      const instance = owned.find(f => f.id === intent.id || f.id === intent.facilityId);
      const def = definitions.get(instance?.type || intent.facilityId);
      if (def) {
        if (intent.tab === 'owned' || intent.id) {
          setTab('owned'); setSearch(def.name); setOwnedFilter(intent.filter || 'all'); setGroupFilter('all'); setBuild(null);
          const match = instance || owned.find(f => f.type === def.id);
          setExpandedGroups([def.id]); setExpandedId(match?.id || null); focusId.current = match?.id || null;
        } else { setBuild(def); setQuantity(Math.max(1, Math.min(100, Number(intent.quantity) || 1))); setTab('catalogue'); }
      }
    }
  }, [intent.nonce, regionId]);
  useEffect(() => {
    if (!focusId.current) return;
    const id = focusId.current;
    // The router restores page scroll over two frames; a specific instance takes priority afterward.
    let second = 0, third = 0;
    const frame = requestAnimationFrame(() => { second = requestAnimationFrame(() => { third = requestAnimationFrame(() => { const target = document.getElementById(`facility-${id}`); if (target) { target.scrollIntoView({ block: 'nearest' }); target.focus({ preventScroll: true }); focusId.current = null; } }); }); });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(second); cancelAnimationFrame(third); };
  }, [expandedId, expandedGroups, layout, tab]);

  const displayedOwned = owned.filter(f => {
    const text = `${definitions.get(f.type)?.name || f.type} ${f.group || ''} ${f.id}`.toLowerCase();
    const matchesStatus = ownedFilter === 'all' || ownedFilter === 'favorites' && f.favorite || ownedFilter === 'idle' && ['paused', 'starved', 'capacity'].includes(statusOf(f)) || ownedFilter === 'profit' && margin(f) > 0 || statusOf(f) === ownedFilter;
    return text.includes(search.toLowerCase().trim()) && (groupFilter === 'all' || (groupFilter === 'ungrouped' ? !f.group : f.group === groupFilter)) && matchesStatus;
  }).sort((a, b) => ownedSort === 'profit' ? margin(b) - margin(a) : ownedSort === 'level' ? Number(b.level) - Number(a.level) : ownedSort === 'status' ? statusOf(a).localeCompare(statusOf(b)) : (definitions.get(a.type)?.name || a.type).localeCompare(definitions.get(b.type)?.name || b.type));
  const grouped = Array.from(displayedOwned.reduce<Map<string, Data[]>>((groups, f) => { const group = groups.get(f.type) || []; group.push(f); groups.set(f.type, group); return groups; }, new Map()).entries());
  if (ownedSort === 'profit') grouped.sort((a, b) => b[1].reduce((n, f) => n + margin(f), 0) - a[1].reduce((n, f) => n + margin(f), 0));
  const visible = defs.filter(f => (category === 'all' || f.category === category) && `${f.name} ${f.description} ${f.category}`.toLowerCase().includes(search.toLowerCase()));
  const visibleIds = displayedOwned.map(f => f.id), selected = owned.filter(f => selectedIds.includes(f.id)), hiddenSelection = selectedIds.filter(id => !visibleIds.includes(id)).length;
  const costs = (f: Data, q = 1) => ({ cash: Number(holding.buildCosts?.[f.id] ?? f.cost ?? 0) * q, land: Number(f.land || 1) * q, materials: Object.fromEntries(entries(f.materials).map(([id, n]) => [id, n * q])) });
  const blockers = (f: Data, q = 1) => { const cost = costs(f, q); return [cost.cash > state.corporation.cash ? 'Insufficient capital' : null, cost.land > free ? `Needs ${number(cost.land)} available acres` : null, ...entries(cost.materials).filter(([id, n]) => (holding.inventory[id] || 0) < n).map(([id, n]) => `Needs ${number(n)} ${list(content.assets).find(a => a.id === id)?.name || titleCase(id)}`), ...(f.requires || []).filter((id: string) => !Object.values(state.holdings).some((h: any) => h.facilities?.some((o: Data) => o.type === id)) && !state.technologies?.includes(id)).map((id: string) => `Requires ${definitions.get(id)?.name || titleCase(id)}`)].filter(Boolean); };
  const resetFilters = () => { setSearch(''); setOwnedFilter('all'); setGroupFilter('all'); };
  const toggleGroup = (id: string) => setExpandedGroups(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  const mutationClass = (facilities: Data[]) => mutation && (mutation.status === 'pending' || Date.now() - mutation.at < 4000) && facilities.some(f => mutation.data.id === f.id || mutation.data.ids?.includes(f.id) || mutation.type === 'facility.build' && mutation.data.facilityId === f.type) ? ` mutation-${mutation.status}` : '';

  const details = (f: Data) => {
    const def = definitions.get(f.type), infrastructure = statusOf(f) === 'infrastructure';
    const techs = (f.installed || []).map((id: string) => list(content.assets).find(a => a.id === id) || { id, name: titleCase(id) });
    return <div className="facility-expanded" id={`facility-details-${f.id}`}>
      <div className="facility-detail-heading"><strong>{def?.name} · #{f.id.slice(0, 8)}</strong><span>Level {f.level || 0}{f.effectiveLevel !== undefined && f.effectiveLevel !== f.level ? ` · effective ${number(f.effectiveLevel)}` : ''} · {number(f.xp)} XP{f.group ? ` · ${f.group}` : ''}</span></div>
      {infrastructure ? <p>{def?.description || 'Provides infrastructure and unlocks specialized operations.'}</p> : <>
        <div className="facility-detail-rates"><div><span className="tiny-label">{f.expectedInputRates ? 'EXPECTED' : 'POTENTIAL'} INPUT / MIN</span>{entries(f.expectedInputRates || f.inputRates).length ? <Resources items={f.expectedInputRates || f.inputRates}/> : <small>No resource inputs</small>}</div><div><span className="tiny-label">{f.expectedOutputRates ? 'EXPECTED' : 'POTENTIAL'} OUTPUT / MIN</span><Resources items={f.expectedOutputRates || f.outputRates || {}}/></div><div><Timer size={14}/> {statusOf(f) === 'producing' ? `Next cycle ${remaining(f.nextCycle, now)}` : statusNames[statusOf(f)]}<small>{number(f.cycleSeconds, 2)}s effective cycle</small></div></div>
        <p className="facility-rate-note">{f.expectedOutputRates ? 'Full-speed expectations include quality probabilities and current plus-input choices; outcomes are not guaranteed.' : 'Nominal full-speed rates at current settings, before quality outcomes.'} Paused or blocked facilities are not producing these amounts.</p>
      </>}
      {f.capacityReason && <p className="inline-warning">{f.capacityReason} Spend or transfer resources to make room.</p>}
      {f.missingInputs?.length > 0 && <p className="inline-warning">Waiting for {f.missingInputs.map((item: Data) => list(content.assets).find(a => a.id === item.assetId)?.name || titleCase(item.assetId)).join(', ')}. Supply the missing resources to resume.</p>}
      <div className="facility-detail-stats"><span>Estimated margin <strong>{money(margin(f))}/min</strong></span><span><strong>{number(f.metrics?.successfulCycles)}</strong> completed cycles</span><span><strong>{number(f.metrics?.starvedCycles)}</strong> starved · <strong>{number(f.metrics?.capacityCycles)}</strong> capacity-limited</span><span>Observed utilization <strong>{f.metrics?.utilization == null ? 'Not recorded' : `${number(f.metrics.utilization * 100, 1)}%`}</strong></span></div>
      <p className="facility-rate-note">NPC replacement-cost estimate at potential rates; not realized profit. Excludes quality, retail, and player-order prices.</p>
      <div className="facility-detail-bottom"><div className="facility-xp-controls"><Field label={`Scrap for ${def?.name} XP`}><Quantity value={xpAmount} onChange={setXpAmount} max={Math.max(1, holding.inventory.scrap || 1)}/></Field><Action type="facility.addxp" data={{ id: f.id, quantity: xpAmount }} variant="secondary" disabled={xpAmount > (holding.inventory.scrap || 0)}>Apply XP</Action><small>{number(holding.inventory.scrap)} scrap available</small></div><div className="button-row">{!infrastructure && <Action type="facility.plus" data={{ id: f.id, enabled: !f.allowPlus }} variant="quiet"><Sparkles size={14}/> Plus inputs: {f.allowPlus ? 'allowed' : 'disabled'}</Action>}<button className="button quiet danger-text" disabled={busy} onClick={() => setDemolish(f)}><Trash2 size={14}/> Demolish</button></div></div>
      <div className="facility-technologies"><span className="tiny-label">{techs.length} INSTALLED TECHNOLOGIES</span>{techs.map((tech: Data, i: number) => <span className="facility-installed" key={`${tech.id}-${i}`}><EntityIcon entity={tech} size={24}/>{tech.name}<Action type="technology.uninstall" data={{ id: f.id, technologyId: tech.id }} variant="quiet" title={`Uninstall ${tech.name}`}><X size={13}/><span className="sr-only">Uninstall {tech.name}</span></Action></span>)}<button className="text-button" onClick={() => go('research', { tab: 'install', facilityId: f.id })}>Manage technologies <ChevronRight size={13}/></button></div>
    </div>;
  };

  const instanceRow = (f: Data, nested = false) => {
    const def = definitions.get(f.type), expanded = expandedId === f.id;
    const status = statusOf(f), duration = Number(f.cycleSeconds) * 1000;
    const progress = status === 'producing' && duration > 0 && Number.isFinite(duration) && Number.isFinite(f.nextCycle) && Number.isFinite(now) ? Math.max(0, Math.min(100, (1 - (f.nextCycle - now) / duration) * 100)) : undefined;
    return <article className={`facility-instance ${nested ? 'nested' : 'owned-facility'} ${expanded ? 'expanded' : ''}${mutationClass([f])}`} key={f.id} id={`facility-${f.id}`} tabIndex={-1} data-facility-id={f.id}>
      <div className={`facility-compact-row facility-cycle-row cycle-${status}`}>
        {progress !== undefined && <div key={f.nextCycle} className="facility-cycle-fill" style={{width: `${progress}%`}} role="progressbar" aria-label={`${def?.name || titleCase(f.type)} ${f.id.slice(0, 8)} production cycle`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress)} aria-valuetext={`${Math.floor(progress)}% of estimated cycle · next cycle ${remaining(f.nextCycle, now)}`}/>}
        <SelectionBox ids={[f.id]} selected={selectedIds} onChange={setSelectedIds} label={`Select ${def?.name || f.type} ${f.id}`}/>
        <button className="facility-disclosure" aria-expanded={expanded} aria-controls={`facility-details-${f.id}`} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${def?.name || f.type} ${f.id.slice(0, 8)} details`} onClick={() => setExpandedId(expanded ? null : f.id)}>{expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<EntityIcon entity={def} size={32}/><span><strong>{nested ? `#${f.id.slice(0, 8)}` : def?.name || titleCase(f.type)}</strong><small>Level {f.level || 0}{f.group ? ` · ${f.group}` : ''}{!nested ? ` · #${f.id.slice(0, 8)}` : ''}</small></span></button>
        <StatusCounts facilities={[f]} cycleProgress={progress}/><RateSummary facilities={[f]}/><div className="facility-row-actions"><Action type="facility.organize" data={{ ids: [f.id], favorite: !f.favorite }} variant="quiet" title={f.favorite ? 'Remove favorite' : 'Add favorite'}><Star size={15} fill={f.favorite ? 'currentColor' : 'none'}/><span className="sr-only">{f.favorite ? 'Unfavorite' : 'Favorite'} facility</span></Action>{statusOf(f) !== 'infrastructure' && <Action type="facility.toggle" data={{ id: f.id }} variant="secondary">{f.enabled ? <Pause size={13}/> : <Play size={13}/>} {f.enabled ? 'Pause' : 'Resume'}</Action>}</div>
      </div>{expanded && details(f)}
    </article>;
  };

  return <div className={`facilities-workspace facilities-${density}`}>
    <div className="land-banner"><IconBox icon={MapPin} tone="green"/><div className="grow"><h3>Room for your next big idea</h3><p><strong>{number(free)} acres available</strong> of {number(holding.land)} owned · {number(used)} in use</p></div><div className="inline-form"><label className="inline-label">Next acre {money(holding.nextLandCost)}<Quantity value={land} onChange={setLand} max={1000}/></label><Action type="land.buy" data={{ quantity: land }}><Plus size={16}/> Buy {land} {land === 1 ? 'acre' : 'acres'}</Action></div></div>
    <div className="toolbar"><div className="tabs"><button className={tab === 'catalogue' ? 'active' : ''} onClick={() => setTab('catalogue')}>Build catalogue <span>{defs.length}</span></button><button className={tab === 'owned' ? 'active' : ''} onClick={() => setTab('owned')}>Your facilities <span>{owned.length}</span></button></div><div className="search"><Search size={17}/><input aria-label="Search facilities" placeholder="Search facilities…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button className="icon-button" aria-label="Clear facility search" onClick={() => setSearch('')}><X size={14}/></button>}</div></div>
    {tab === 'catalogue' ? <>
      <div className="filter-chips"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All facilities</button>{Array.from(new Set(defs.map(f => f.category))).map(cat => <button key={cat} className={category === cat ? 'active' : ''} onClick={() => setCategory(cat)}>{titleCase(cat)}</button>)}</div>
      <div className="facility-grid">{visible.map(f => { const locked = blockers(f), count = owned.filter(o => o.type === f.id).length; return <article className="facility-card" key={f.id}><div className="facility-card-top"><EntityIcon entity={f} size={52}/><Badge>{titleCase(f.category)}</Badge></div><h3>{f.name}</h3><p className="facility-description">{(f.description && !f.description.includes('→') ? f.description : undefined) || `Produces ${entries(f.outputs).map(([id]) => titleCase(id)).join(', ') || 'specialized capabilities'} for your regional operations.`}</p><div className="recipe-mini"><span className="tiny-label">{entries(f.inputs).length ? 'INPUTS' : 'NATURAL PRODUCTION'}</span>{entries(f.inputs).length ? <Resources items={f.inputs}/> : <span className="natural-input"><Leaf size={13}/> No resource inputs</span>}<div className="recipe-arrow"><ArrowDownLeft size={14}/><span>{number(f.cycleSeconds)}s cycle</span></div><Resources items={f.outputs}/></div><div className="facility-cost"><strong>{money(holding.buildCosts?.[f.id] ?? f.cost)}</strong><span>{f.land || 1} {(f.land || 1) === 1 ? 'acre' : 'acres'} · {count} built</span></div>{entries(f.materials).length > 0 && <div className="build-materials"><Resources items={f.materials} check/></div>}<button className={`button full ${locked.length ? 'secondary' : 'primary'}`} onClick={() => { setQuantity(1); setBuild(f); }}>{locked.length ? <><LockKeyhole size={14}/> View requirements</> : <><Plus size={16}/> Build facility</>}</button></article>; })}</div>{!visible.length && <Empty icon={Search} title="No facilities found">Try another resource, industry, or facility name.</Empty>}
    </> : <>
      <div className="facility-status-overview" aria-label="Facility status totals"><button className={ownedFilter === 'all' ? 'active' : ''} onClick={() => setOwnedFilter('all')}><strong>{owned.length}</strong> total</button>{Object.entries(statusNames).map(([status, name]) => { const count = owned.filter(f => statusOf(f) === status).length; return count ? <button key={status} className={ownedFilter === status ? 'active' : ''} onClick={() => setOwnedFilter(status)}><span className={`facility-status-dot ${status}`}/><strong>{count}</strong> {name}</button> : null; })}</div>
      <div className="facility-filter-bar"><Field label="Facility filter"><select value={ownedFilter} onChange={e => setOwnedFilter(e.target.value)}><option value="all">All facilities</option><option value="favorites">Favorites</option><option value="idle">Idle or blocked</option><option value="profit">Positive estimated margin</option>{Object.entries(statusNames).map(([status, name]) => <option key={status} value={status}>{name}</option>)}</select></Field><Field label="Facility group"><select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}><option value="all">All groups</option><option value="ungrouped">Ungrouped</option>{(holding.groups || []).map((name: string) => <option key={name} value={name}>{name}</option>)}</select></Field><Field label="Facility sort"><select value={ownedSort} onChange={e => setOwnedSort(e.target.value)}><option value="name">Name</option><option value="profit">Estimated margin / min</option><option value="level">Level</option><option value="status">Status</option></select></Field><div className="facility-view-options"><Field label="Facility layout"><select value={layout} onChange={e => setLayout(e.target.value)}><option value="grouped">Grouped by type</option><option value="individual">Individual facilities</option></select></Field><Field label="Row density"><select value={density} onChange={e => setDensity(e.target.value)}><option value="dense">Dense</option><option value="comfortable">Comfortable</option></select></Field></div></div>
      <div className="facility-list-caption"><span>{displayedOwned.length} of {owned.length} facilities shown{layout === 'grouped' ? ` · ${grouped.length} types` : ''}</span><div className="button-row"><button className="text-button" onClick={() => setSelectedIds(visibleIds)} disabled={!visibleIds.length}>Select visible</button>{(search || ownedFilter !== 'all' || groupFilter !== 'all') && <button className="text-button" onClick={resetFilters}><SlidersHorizontal size={13}/> Reset filters</button>}</div></div>
      {selectedIds.length > 0 && <div className="bulk-toolbar facility-selection-toolbar" role="region" aria-label="Selected facility actions"><div className="facility-selection-count"><strong>{selectedIds.length} selected</strong>{hiddenSelection > 0 && <small>{hiddenSelection} hidden by filters</small>}</div><Action type="facility.batch" data={{ ids: selectedIds, enabled: false }} variant="secondary" disabled={selected.every(f => !f.enabled)}><Pause size={14}/> Pause selected</Action><Action type="facility.batch" data={{ ids: selectedIds, enabled: true }} variant="secondary" disabled={selected.every(f => f.enabled)}><Play size={14}/> Resume selected</Action><Field label="New group name"><input value={group} maxLength={40} onChange={e => setGroup(e.target.value)} placeholder="e.g. Foundry"/></Field><Action type="facility.organize" data={{ ids: selectedIds, group }} variant="secondary">{group ? 'Assign group' : 'Clear group'}</Action><Action type="facility.organize" data={{ ids: selectedIds, favorite: true }} variant="quiet"><Star size={14}/> Favorite selected</Action><Action type="facility.organize" data={{ ids: selectedIds, favorite: false }} variant="quiet">Unfavorite selected</Action><button className="button quiet" onClick={() => setSelectedIds([])}>Clear selection</button></div>}
      <section className="panel facility-list" aria-label="Owned facilities">
        {layout === 'grouped' ? grouped.map(([type, facilities]) => { const def = definitions.get(type), expanded = expandedGroups.includes(type), ids = facilities.map(f => f.id), producers = facilities.filter(f => statusOf(f) !== 'infrastructure'), total = owned.filter(f => f.type === type).length, favorites = facilities.filter(f => f.favorite).length; return <article className={`owned-facility facility-type-group ${expanded ? 'expanded' : ''}${mutationClass(facilities)}`} data-facility-type={type} key={type}>
          <div className="facility-compact-row"><SelectionBox ids={ids} selected={selectedIds} onChange={setSelectedIds} label={`Select ${def?.name || type} group (${facilities.length} facilities)`}/><button className="facility-disclosure" aria-expanded={expanded} aria-controls={`facility-group-${type}`} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${def?.name || type} group`} onClick={() => toggleGroup(type)}>{expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<EntityIcon entity={def} size={36}/><span><strong>{def?.name || titleCase(type)} <span className="facility-count">×{facilities.length}</span></strong><small>{facilities.length < total ? `${facilities.length} of ${total} match filters` : `${facilities.length} ${facilities.length === 1 ? 'facility' : 'facilities'}`}{favorites ? ` · ${favorites} favorite${favorites === 1 ? '' : 's'}` : ''}</small></span></button><StatusCounts facilities={facilities}/><RateSummary facilities={facilities}/><div className="facility-row-actions"><Action type="facility.organize" data={{ ids, favorite: favorites !== facilities.length }} variant="quiet" title={favorites === facilities.length ? 'Remove group favorites' : 'Favorite group'}><Star size={15} fill={favorites ? 'currentColor' : 'none'}/><span className="sr-only">{favorites === facilities.length ? 'Unfavorite' : 'Favorite'} {def?.name} group</span></Action>{producers.some(f => f.enabled) && <Action type="facility.batch" data={{ ids: producers.map(f => f.id), enabled: false }} variant="secondary"><Pause size={13}/> Pause</Action>}{producers.some(f => !f.enabled) && <Action type="facility.batch" data={{ ids: producers.map(f => f.id), enabled: true }} variant="secondary"><Play size={13}/> Resume</Action>}</div></div>
          {expanded && <div id={`facility-group-${type}`} className="facility-group-members"><div className="facility-group-note"><span>{facilities.length} visible facilities · select an individual for XP, technologies, and demolition.</span><span>Potential NPC margin {money(facilities.reduce((n, f) => n + margin(f), 0))}/min · estimate, not profit</span></div>{facilities.map(f => instanceRow(f, true))}</div>}
        </article>; }) : displayedOwned.map(f => instanceRow(f))}
        {!owned.length && <Empty icon={Factory} title="An open floor. Endless possibility." action={<button className="button primary" onClick={() => setTab('catalogue')}>Browse build catalogue</button>}>Build a facility to begin producing.</Empty>}
        {owned.length > 0 && !displayedOwned.length && <Empty icon={Search} title="No facilities match these filters" action={<button className="button secondary" onClick={resetFilters}>Reset filters</button>}>Change the group, status, or search to see more facilities.</Empty>}
      </section>
      {displayedOwned.length > 0 && <p className="facility-rate-note facility-list-note">Running rates sum server estimates for currently producing facilities only. Expected rates include quality probabilities and current plus-input choices; outcomes and future shortages can change actual output.</p>}
    </>}
    {build && <Confirm title={`Build ${build.name}`} disabled={busy || building || !!blockers(build, quantity).length} onClose={() => { if (!building) setBuild(null); }} onConfirm={async () => { if (busy || building || blockers(build, quantity).length) return; setBuilding(true); try { const result = await act('facility.build', { facilityId: build.id, quantity }); if (result) { setBuild(null); setTab('owned'); resetFilters(); setExpandedGroups([build.id]); } } finally { setBuilding(false); } }} button={building ? 'Building…' : blockers(build, quantity).length ? 'Requirements not met' : `Build for ${money(costs(build, quantity).cash)}`}><p>{build.description}</p><Field label="Number of facilities"><Quantity value={quantity} onChange={setQuantity} max={100}/></Field><div className="preview-line"><span>Construction cost</span><strong>{money(costs(build, quantity).cash)}</strong></div><div className="preview-line"><span>Land required</span><strong>{costs(build, quantity).land} acres</strong></div><Resources items={costs(build, quantity).materials} check/>{blockers(build, quantity).length > 0 && <div className="requirements"><strong>Before you can build</strong>{blockers(build, quantity).map((reason, i) => <p key={i}><LockKeyhole size={13}/>{reason}</p>)}</div>}{building && <p role="status"><LoaderCircle size={15} className="facility-spinner"/> Waiting for construction confirmation…</p>}</Confirm>}
    {demolish && <Confirm title="Demolish this facility?" danger disabled={busy || demolishing || !!demolish.installed?.length} button={demolishing ? 'Demolishing…' : 'Demolish facility'} onClose={() => { if (!demolishing) setDemolish(null); }} onConfirm={async () => { if (busy || demolishing) return; setDemolishing(true); try { if (await act('facility.demolish', { id: demolish.id })) { setDemolish(null); setExpandedId(null); } } finally { setDemolishing(false); } }}><p>Remove this {definitions.get(demolish.type)?.name} and free its land. Its levels are lost. Uninstall any technologies first. The server refunds {number(content.rules?.liquidationRefund * 100)}% of its recorded cash and material construction value as cash.</p>{!!demolish.installed?.length && <p className="inline-warning">Uninstall this facility's technologies before demolishing it.</p>}</Confirm>}
  </div>;
}

export default Facilities;
