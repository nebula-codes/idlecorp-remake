import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronsUp, Sparkles, Timer } from 'lucide-react';
import { Confirm, Field, Quantity, number, remaining, useGame, type Data } from './ui';

type UpgradeAttempt = {
  facilityId: string; name: string; regionId: string; corporationId: string; serverOrigin: string;
  kind: 'next'|'available'|'custom'; targetXp: number; maxScrap: number; quantity: number;
  targetLevel?: number; qualityChance?: number; qualityBefore?: number; qualityDescription: string;
  qualityEligible: boolean; qualityEnabled: boolean; efficiencyRelic: boolean;
  status: 'review'|'pending'|'uncertain'|'rejected';
};
// A lost response must remain retryable even when its row or screen is closed.
const unresolvedUpgrades = new Map<string, UpgradeAttempt>();
const pendingUpgrades = new Set<string>();
const upgradeListeners = new Set<(scope: string, attempt: UpgradeAttempt|null) => void>();

export function useFacilityUpgrade() {
  const { state, regionId, serverOrigin, act, busy } = useGame();
  const corporationId = state.corporation.id, scope = JSON.stringify([serverOrigin,corporationId,regionId]);
  const identity = useRef(scope), mounted = useRef(true); identity.current = scope;
  const [attempt, setAttempt] = useState<UpgradeAttempt|null>(() => unresolvedUpgrades.get(scope) || null);
  const [show, setShow] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setAttempt(unresolvedUpgrades.get(scope) || null); setShow(false);
    const receive = (key: string, value: UpgradeAttempt|null) => { if (key === scope) { setAttempt(value); if (!value) setShow(false); } };
    upgradeListeners.add(receive); return () => { upgradeListeners.delete(receive); };
  }, [scope]);
  const current = attempt && attempt.serverOrigin === serverOrigin && attempt.corporationId === corporationId && attempt.regionId === regionId ? attempt : null;
  const save = (value: UpgradeAttempt|null, key = scope) => {
    if (value && ['pending','uncertain'].includes(value.status)) unresolvedUpgrades.set(key, value);
    else unresolvedUpgrades.delete(key);
    if (mounted.current && identity.current === key) setAttempt(value);
    for (const receive of upgradeListeners) receive(key,value);
  };
  const request = (facility: Data, name: string, preview: Data, kind: UpgradeAttempt['kind']) => {
    if (busy || pendingUpgrades.has(scope) || unresolvedUpgrades.has(scope) || !preview.enabled) return;
    const quality = facility.progression?.quality;
    save({ facilityId: facility.id, name, corporationId, regionId, serverOrigin, kind, targetXp: preview.targetXp,
      maxScrap: preview.maxScrap, quantity: preview.quantity, targetLevel: preview.targetLevel,
      qualityChance: preview.qualityChance, qualityBefore: quality?.chance,
      qualityEligible: !!quality?.eligible, qualityEnabled: !!quality?.enabled,
      efficiencyRelic: !!quality?.efficiencyRelic, qualityDescription: quality?.description || '', status: 'review' });
    setShow(true);
  };
  const confirm = async () => {
    if (!current || busy || pendingUpgrades.has(scope) || identity.current !== scope) return;
    const frozen = current, key = scope;
    pendingUpgrades.add(key); save({ ...frozen, status: 'pending' }, key);
    let uncertain = true;
    try {
      const result = await act('facility.addxp', { regionId: frozen.regionId, id: frozen.facilityId, targetXp: frozen.targetXp, maxScrap: frozen.maxScrap }, value => { uncertain = value; });
      save(result ? null : { ...frozen, status: uncertain ? 'uncertain' : 'rejected' }, key);
      if (result && mounted.current && identity.current === key) setShow(false);
    } catch { save({ ...frozen, status: 'uncertain' }, key); }
    finally { pendingUpgrades.delete(key); }
  };
  const close = () => { if (current?.status === 'pending') return; setShow(false); if (current?.status !== 'uncertain') save(null); };
  const locked = !!current && ['pending','uncertain'].includes(current.status);
  return {
    request, locked,
    notice: locked && !show ? <div className="facility-upgrade-pending" role="status"><span>{current.status === 'pending' ? 'Waiting for upgrade confirmation' : 'Upgrade result unknown'} · {current.name} #{current.facilityId.slice(0,8)}. The original XP target is preserved.</span><button className="button secondary small" disabled={current.status === 'pending'} onClick={() => setShow(true)}>Retry upgrade</button></div> : null,
    modal: show && current ? <Confirm title={current.kind === 'next' ? 'Reach next level?' : current.kind === 'available' ? 'Use available scrap?' : 'Apply scrap XP?'} button={current.status === 'uncertain' ? 'Retry upgrade' : current.status === 'pending' ? 'Applying scrap…' : 'Confirm upgrade'} disabled={busy || current.status === 'pending'} onClose={close} onConfirm={confirm}>
      <p><strong>{current.name} · #{current.facilityId.slice(0,8)}</strong></p>
      <div className="preview-line"><span>Target cumulative XP</span><strong>{number(current.targetXp)}</strong></div>
      <div className="preview-line"><span>Maximum scrap to spend</span><strong>{number(current.maxScrap)}</strong></div>
      {current.targetLevel != null && <div className="preview-line"><span>Projected facility level</span><strong>{number(current.targetLevel)}</strong></div>}
      {current.qualityEligible && current.qualityChance != null && <div className="preview-line"><span>{current.efficiencyRelic ? 'Efficiency roll chance' : 'Plus-quality chance'} · current modifiers</span><strong>{number((current.qualityBefore || 0)*100,2)}% → {number(current.qualityChance*100,2)}%</strong></div>}
      <p className="facility-confirm-note">This target and spending limit stay fixed while you review. Production before confirmation can reduce the scrap spent. The server checks current XP, stock, and locks; a reached target or insufficient scrap is rejected.</p>
      {current.qualityDescription && <p className="facility-confirm-note">{current.qualityDescription}</p>}
      {current.status === 'uncertain' && <p className="inline-warning" role="status">The result is unknown. Retry this exact upgrade to retrieve its result safely before choosing another target.</p>}
      {current.status === 'rejected' && <p className="inline-warning" role="status">Upgrade not completed. Resolve the reported issue, or close this preview and review a new target.</p>}
    </Confirm> : null,
  };
}

export function FacilityLevelMeter({ facility, name }: { facility: Data; name: string }) {
  const p = facility.progression;
  if (!p || p.status === 'capped') return null;
  const percent = Math.max(0,Math.min(100,Number(p.progress)*100));
  return <span className="facility-level-meter" role="progressbar" aria-label={`${name} ${facility.id.slice(0,8)} level progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(percent)} aria-valuetext={`${number(p.xpIntoLevel)} of ${number(p.xpPerLevel)} XP; ${number(p.xpToNextLevel)} XP to level ${number(p.level+1)}`}><span style={{ width: `${percent}%` }}/></span>;
}

export function FacilityProgression({ facility, name, onUpgrade, locked }: { facility: Data; name: string; onUpgrade: ReturnType<typeof useFacilityUpgrade>['request']; locked: boolean }) {
  const { busy, holding, now, content } = useGame(), [quantity,setQuantity] = useState(1);
  const p = facility.progression;
  if (!p) return <section className="facility-progression unavailable" data-facility-progression={facility.id}><h4>Level progress</h4><p>Progression details are unavailable from this server.</p></section>;
  const capped = p.status === 'capped', q = p.quality, next = p.upgrades.next, available = p.upgrades.available;
  const maxCustom = Math.max(0,Math.min(Number(holding.inventory.scrap || 0),Number(p.maxLevel)*Number(p.xpPerLevel)-Number(p.xp)));
  const customEnabled = !busy && !locked && !holding.locks?.includes?.('scrap') && available.enabled && quantity > 0 && quantity <= maxCustom;
  const targetLevel = Math.min(Number(p.maxLevel),Math.floor((Number(p.xp)+quantity)/Number(p.xpPerLevel)));
  const effectiveLevel = Number(q.effectiveLevel)+targetLevel-Number(p.level);
  const qualityChance = q.enabled ? Math.min(1,Math.max(0,effectiveLevel)*Number(content.rules.plusChancePerLevel)*(1+Math.max(0,Math.min(1,Number(q.plusInputFraction)))*Number(content.rules.plusInputChanceBonus))) : 0;
  const qualityLabel = q.efficiencyRelic ? 'Efficiency roll' : 'Plus quality';
  return <section className="facility-progression" data-facility-progression={facility.id} aria-labelledby={`facility-progression-heading-${facility.id}`}>
    <div className="facility-progression-line"><h4 id={`facility-progression-heading-${facility.id}`}>Level {number(p.level)}{capped ? ' · maximum' : <><ArrowRight size={13} aria-hidden="true"/>{number(p.level+1)}</>}</h4><span>{capped ? `${number(p.xp)} total XP` : `${number(p.xpIntoLevel)} / ${number(p.xpPerLevel)} XP`}</span></div>
    <FacilityLevelMeter facility={facility} name={name}/>
    <div className="facility-progression-facts"><span>{capped ? 'Level cap reached' : `${number(p.xpToNextLevel)} XP to next level`}</span><span><Timer size={12} aria-hidden="true"/>{p.etaSeconds != null ? `About ${remaining(now+Number(p.etaSeconds)*1000,now)} at current pace` : p.etaNote}</span></div>
    <p className="facility-quality-preview"><Sparkles size={13} aria-hidden="true"/>{q.eligible ? <><span>{qualityLabel} <strong>{number(q.chance*100,2)}%</strong>{q.nextLevelChance != null && <> → <strong>{number(q.nextLevelChance*100,2)}%</strong> next level</>}{!q.enabled && ' · currently disabled'}</span></> : <span>{q.description || 'Levels do not improve quality for this facility.'}</span>}</p>
    <div className="facility-upgrade-actions"><button className="button secondary small" disabled={busy || locked || !next.enabled} onClick={() => onUpgrade(facility,name,next,'next')}><ChevronsUp size={13}/>Reach next level{next.quantity > 0 && <span>{number(next.quantity)} scrap</span>}</button><button className="button secondary small" disabled={busy || locked || !available.enabled} onClick={() => onUpgrade(facility,name,available,'available')}>Use available scrap{available.quantity > 0 && <span>{number(available.quantity)}</span>}</button></div>
    {!next.enabled && next.reason && <p className="facility-upgrade-reason">{next.reason}</p>}
    <details className="facility-secondary-details facility-level-explanation"><summary>Progression details & custom scrap</summary><p>{p.etaNote} Successful cycles grant {number(p.xpPerCycle)} XP. Scrap grants one XP per unit.</p><p>{q.description}</p><p>Effective level {number(q.effectiveLevel)}{q.nextEffectiveLevel != null ? ` → ${number(q.nextEffectiveLevel)} at the next facility level` : ''}. Level quality benefits do not increase production speed.</p><div className="facility-xp-controls"><Field label={`Scrap for ${name} XP`}><Quantity value={quantity} onChange={setQuantity} max={Math.max(1,maxCustom)}/></Field><button className="button secondary" disabled={!customEnabled} onClick={() => onUpgrade(facility,name,{ targetXp:Number(p.xp)+quantity,maxScrap:quantity,quantity,targetLevel,effectiveLevel,qualityChance,enabled:customEnabled },'custom')}>Apply XP</button><small>{number(holding.inventory.scrap)} scrap available{holding.locks?.includes?.('scrap') ? ' · locked' : ''}</small></div></details>
  </section>;
}
