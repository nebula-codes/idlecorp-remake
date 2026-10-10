import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight, LockKeyhole, Package, Search, Timer, TrendingUp, X } from 'lucide-react';
import { Action, Empty, EntityIcon, Field, Quantity, list, money, number, remaining, titleCase, useGame, type Data } from './ui';
import { useViewPreference } from './view-state';
import './exchange.css';

const MAX_LEDGER = 9_000_000_000_000;
const quickQuantities = [100, 1000, 10000] as const;
type SaleAttempt = { payload: { regionId: string; assetId: string; quantity: number }; status: 'pending' | 'retry'; uncertain?: boolean };
type Confirmation = { message: string };

export function RegionalMarket({ assetId, onSelect, quantity, onQuantity, onPlayerExchange }: {
  assetId: string; onSelect: (id: string) => void; quantity: number; onQuantity: (quantity: number) => void; onPlayerExchange: () => void;
}) {
  const { state, content, holding, region, regionId, now, intent, act, busy, go, reportError } = useGame();
  const [view, setView] = useViewPreference('market.resourceView', 'stock');
  const [search, setSearch] = useViewPreference('market.resourceSearch', '');
  const [sort, setSort] = useViewPreference('market.resourceSort', 'name');
  const [expanded, setExpanded] = useState(() => intent.assetId || (holding.inventory?.[assetId] > 0 ? assetId : ''));
  const [attempts, setAttempts] = useState<Record<string, SaleAttempt>>({});
  const [confirmations, setConfirmations] = useState<Record<string, Confirmation>>({});
  const inFlight = useRef(new Set<string>()), focusTrade = useRef<string | null>(null);
  const assets = list(content.assets).filter(asset => asset.id !== 'cash');
  const prices = state.market?.prices?.[regionId] || {};
  const rowKey = (id: string) => `${regionId}:${id}`;
  const stockOf = (id: string) => Number(holding.inventory?.[id] || 0);
  const stockCount = assets.filter(asset => stockOf(asset.id) > 0).length;
  const allowance = Math.max(0, Number(holding.buyLimit || 0) - Number(holding.buyLimitUsed || 0));

  useEffect(() => {
    setExpanded(holding.inventory?.[assetId] > 0 ? assetId : '');
    if (intent.assetId && assets.some(asset => asset.id === intent.assetId)) {
      onSelect(intent.assetId); setExpanded(intent.assetId); setSearch('');
      setView(stockOf(intent.assetId) > 0 ? 'stock' : 'all'); focusTrade.current = intent.assetId;
    }
  }, [intent.nonce, regionId]);
  useEffect(() => {
    if (!focusTrade.current || expanded !== focusTrade.current) return;
    let second = 0, third = 0;
    const frame = requestAnimationFrame(() => { second = requestAnimationFrame(() => { third = requestAnimationFrame(() => {
      const target = document.getElementById(`market-trade-${focusTrade.current}`);
      if (target) { target.scrollIntoView({ block: 'nearest' }); target.focus({ preventScroll: true }); focusTrade.current = null; }
    }); }); });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(second); cancelAnimationFrame(third); };
  }, [expanded, regionId]);

  const confirmTrade = (id: string, tradedQuantity: number, side: 'bought' | 'sold', actionRegion = regionId) => {
    const name = assets.find(asset => asset.id === id)?.name || titleCase(id);
    setConfirmations(previous => ({ ...previous, [`${actionRegion}:${id}`]: { message: `${side === 'sold' ? 'Sold' : 'Bought'} ${number(tradedQuantity)} ${name}.` } }));
  };
  const sell = async (asset: Data, saleQuantity: number, retry?: SaleAttempt) => {
    const key = rowKey(asset.id);
    if (busy || inFlight.current.size > 0) return;
    const payload = retry?.payload || { regionId, assetId: asset.id, quantity: saleQuantity };
    let uncertain = true;
    inFlight.current.add(key); setAttempts(previous => ({ ...previous, [key]: { payload, status: 'pending' } }));
    try {
      const result = await act('npc.sell', payload, value => { uncertain = value; });
      if (result) {
        setAttempts(previous => { const next = { ...previous }; delete next[key]; return next; });
        confirmTrade(asset.id, payload.quantity, 'sold', payload.regionId);
      } else setAttempts(previous => ({ ...previous, [key]: { payload, status: 'retry', uncertain } }));
    } catch (error: any) {
      setAttempts(previous => ({ ...previous, [key]: { payload, status: 'retry', uncertain: true } }));
      reportError(error.message || 'Could not confirm the sale. Retry the saved quantity below.');
    } finally { inFlight.current.delete(key); }
  };
  const visible = assets.filter(asset => {
    if (attempts[rowKey(asset.id)]) return true;
    const matches = `${asset.name} ${asset.category || ''} ${asset.id}`.toLowerCase().includes(search.toLowerCase().trim());
    return matches && (view === 'all' || stockOf(asset.id) > 0 || !!confirmations[rowKey(asset.id)]);
  }).sort((a, b) => {
    if (sort === 'stock') return stockOf(b.id) - stockOf(a.id) || a.name.localeCompare(b.name);
    if (sort === 'value') return (b.npcSell === false ? 0 : stockOf(b.id) * Number(prices[b.id]?.sell || 0)) - (a.npcSell === false ? 0 : stockOf(a.id) * Number(prices[a.id]?.sell || 0)) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });

  return <div className="regional-market">
    <section className="market-summary-strip" aria-label="Regional market conditions"><div><strong>{region.name}</strong><span>Instant regional trades · No NPC sale fee</span></div><div><span><Timer size={13} aria-hidden="true"/>Quotes refresh in</span><strong>{remaining(state.market?.refreshAt || region.nextUpdate, now)}</strong></div><div><span>Buy allowance remaining / hour</span><strong>{money(allowance)} <small>of {money(holding.buyLimit)}</small></strong></div><button className="text-button" onClick={onPlayerExchange}>Visit player exchange <ArrowRight size={14}/></button></section>
    <div className="market-resource-toolbar"><div className="segmented" aria-label="Resource view"><button className={view === 'stock' ? 'active' : ''} aria-pressed={view === 'stock'} onClick={() => setView('stock')}>In stock <span>{stockCount}</span></button><button className={view === 'all' ? 'active' : ''} aria-pressed={view === 'all'} onClick={() => setView('all')}>All resources</button></div><div className="search market-resource-search"><Search size={16} aria-hidden="true"/><input aria-label="Search market resources" placeholder="Search name or category…" value={search} onChange={event => setSearch(event.target.value)}/>{search && <button className="icon-button" aria-label="Clear market search" onClick={() => setSearch('')}><X size={14}/></button>}</div><Field label="Sort market resources"><select value={sort} onChange={event => setSort(event.target.value)}><option value="name">Name</option><option value="stock">Stock · highest first</option><option value="value">Sale value · highest first</option></select></Field></div>
    <div className="market-list-caption"><span>{visible.length} resources shown</span><span>Quick sell trades immediately. Sell all applies only to that row’s resource.</span></div>
    <section className="market-resource-list panel" aria-label="Regional resources">
      {visible.map(asset => {
        const key = rowKey(asset.id), stock = stockOf(asset.id), quote = prices[asset.id] || {}, locked = holding.locks?.includes(asset.id);
        const sellPrice = Number(quote.sell || 0), buyPrice = Number(quote.buy || 0), saleAvailable = asset.npcSell !== false && sellPrice > 0, buyAvailable = asset.npcBuy !== false && buyPrice > 0;
        const maxCashSale = saleAvailable ? Math.max(0, Math.floor((MAX_LEDGER - Number(state.corporation.cash)) / sellPrice)) : 0;
        const attempt = attempts[key], confirmation = confirmations[key], isExpanded = expanded === asset.id;
        const saleReason = locked ? 'Locked. Unlock this resource in Inventory before selling.' : asset.npcSell === false ? 'This resource cannot be sold to the regional market.' : !sellPrice ? 'No live sell quote is available for this resource.' : maxCashSale < stock ? `Cash capacity limits this sale to ${number(maxCashSale)} units at the current quote. Spend funds to sell more.` : '';
        const buyReason = asset.npcBuy === false ? 'This resource cannot be bought from the regional market.' : !buyPrice ? 'No live buy quote is available for this resource.' : quantity * buyPrice > Number(state.corporation.cash) ? 'Insufficient funds for this quantity.' : quantity * buyPrice > allowance ? 'This quantity exceeds your remaining hourly buy allowance.' : quantity > MAX_LEDGER - stock ? 'This quantity exceeds the resource storage limit.' : '';
        const cannotSell = (value: number) => busy || !!attempt || locked || !saleAvailable || value < 1 || !Number.isSafeInteger(value) || value > stock || value > maxCashSale;
        return <article className={`market-resource-row ${isExpanded ? 'expanded' : ''} ${attempt?.status === 'retry' ? 'needs-retry' : ''}`} data-market-resource={asset.id} key={key}>
          <div className="market-resource-main"><div className="market-resource-identity"><EntityIcon entity={asset} size={36}/><div><strong>{asset.name}</strong><small>{titleCase(asset.category || 'Resource')}{locked && <span className="market-lock"><LockKeyhole size={11} aria-hidden="true"/>Locked</span>}</small></div></div><dl className="market-resource-values"><div><dt>Stock</dt><dd>{number(stock)}</dd></div><div><dt>Sell / unit</dt><dd>{saleAvailable ? money(sellPrice) : 'Unavailable'}</dd></div><div><dt>Stock sale value</dt><dd>{saleAvailable ? money(stock * sellPrice) : 'Unavailable'}</dd></div></dl><div className="market-quick-sales" aria-label={`Quick sell ${asset.name}`}>
            {quickQuantities.map(value => <button type="button" className="button secondary" data-quick-sell={value} key={value} disabled={cannotSell(value)} onClick={() => void sell(asset, value)}>Sell {number(value)}</button>)}
            <button type="button" className="button primary" data-quick-sell="all" disabled={cannotSell(stock)} onClick={() => void sell(asset, stock)}>Sell all</button>
          </div><button type="button" className="text-button market-trade-toggle" aria-label={`Trade ${asset.name}`} aria-expanded={isExpanded} aria-controls={`market-trade-${asset.id}`} onClick={() => { onSelect(asset.id); setExpanded(isExpanded ? '' : asset.id); }}>{isExpanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}Custom trade</button></div>
          {saleReason && <p className="market-row-explanation"><LockKeyhole size={13} aria-hidden="true"/>{saleReason}{locked && <button className="text-button" onClick={() => go('inventory', { assetId: asset.id })}>Open Inventory <ArrowRight size={12}/></button>}</p>}
          {attempt && <div className={`market-sale-attempt ${attempt.status === 'pending' ? 'pending' : ''}`} role="status">{attempt.status === 'pending' ? <><span className="spinner inline-spinner" aria-hidden="true"/>Confirming sale of {number(attempt.payload.quantity)} {asset.name}…</> : <><div><strong>{attempt.uncertain === false ? "Sale not completed" : "Sale not confirmed"}</strong><p>{attempt.uncertain === false ? `The sale did not complete. Resolve the reported issue and retry ${number(attempt.payload.quantity)} ${asset.name}, or clear the attempt to choose a different amount.` : `Retry the original ${number(attempt.payload.quantity)} ${asset.name}. A retry checks the same sale, even if your stock has changed. Resolve this retry before starting another sale of this resource.`}</p></div><div className="button-row"><button className="button secondary" disabled={busy} onClick={() => void sell(asset, attempt.payload.quantity, attempt)}>Retry sale</button>{attempt.uncertain === false && <button className="button quiet" disabled={busy} onClick={() => setAttempts(previous => { const next = { ...previous }; delete next[key]; return next; })}>Clear sale attempt</button>}</div></>}</div>}
          {confirmation && <p className="market-trade-confirmation" role="status"><CheckCircle2 size={15} aria-hidden="true"/>{confirmation.message}</p>}
          {isExpanded && <div className="market-custom-trade" id={`market-trade-${asset.id}`} tabIndex={-1} aria-label={`Custom trade for ${asset.name}`}><div className="market-custom-heading"><h3>Trade {asset.name}</h3><p>Live estimates in {region.name}. The server confirms the final price and stock.</p></div><div className="market-custom-controls"><Field label="Trade quantity"><Quantity value={quantity} onChange={onQuantity} max={MAX_LEDGER}/></Field><div className="market-custom-quote"><span>Buy / unit</span><strong>{buyAvailable ? money(buyPrice) : 'Unavailable'}</strong></div><div className="market-custom-quote"><span>Sell / unit</span><strong>{saleAvailable ? money(sellPrice) : 'Unavailable'}</strong></div><div className="button-row"><Action type="npc.buy" data={{ regionId, assetId: asset.id, quantity }} disabled={!buyAvailable || !!buyReason} onDone={() => confirmTrade(asset.id, quantity, 'bought')}><ArrowDownLeft size={15}/>Buy {number(quantity)} · {buyAvailable ? money(buyPrice * quantity) : 'Unavailable'}</Action><Action type="npc.sell" data={{ regionId, assetId: asset.id, quantity }} variant="secondary" disabled={cannotSell(quantity)} onDone={() => confirmTrade(asset.id, quantity, 'sold')}><ArrowUpRight size={15}/>Sell {number(quantity)} · {saleAvailable ? money(sellPrice * quantity) : 'Unavailable'}</Action></div></div>{buyReason && <p className="market-custom-note">Buying: {buyReason}</p>}{!attempt && saleAvailable && !locked && quantity > stock && <p className="market-custom-note">Selling: only {number(stock)} units are in this region’s stock.</p>}<p className="market-custom-note">Sell all uses the stock shown when clicked; newly produced units may remain. Normal and plus-quality resources trade separately.</p></div>}
        </article>;
      })}
      {!visible.length && <Empty icon={search ? Search : Package} title={search ? 'No resources match your search' : 'Your regional shelves are empty'} action={<button className="button secondary" onClick={() => { setView('all'); setSearch(''); }}>Browse all resources <ArrowRight size={14}/></button>}>{search ? 'Try a resource name or category.' : 'Produce resources to sell here, or browse all resources to buy supplies.'}</Empty>}
    </section>
    <p className="market-footer-note"><TrendingUp size={14} aria-hidden="true"/>Regional quotes reflect current market variation and policy effects. Sales have no hourly allowance; purchases share the allowance shown above.</p>
  </div>;
}
