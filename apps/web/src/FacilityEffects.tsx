import { ArrowDown, ArrowUp, ChevronRight, CircleHelp, Info, Minus, Timer } from 'lucide-react';
import { list, number, remaining, type Data } from './ui';

const effectCategories = [
  ['cycle', 'Cycle duration'], ['speed', 'Production speed'], ['output', 'Output'],
  ['quality', 'Quality'], ['inputs', 'Resource inputs'], ['operation', 'Operation'],
] as const;

export function FacilityEffectsSummary({ facilities, grouped = false, label, targetId, expanded, onOpen }: {
  facilities: Data[]; grouped?: boolean; label: string; targetId: string; expanded: boolean; onOpen: () => void;
}) {
  const known = facilities.filter(f => Array.isArray(f.effects?.entries)), unavailable = facilities.length - known.length;
  const positive = grouped ? known.filter(f => f.effects.positiveCount > 0).length : Number(known[0]?.effects.positiveCount || 0);
  const negative = grouped ? known.filter(f => f.effects.negativeCount > 0).length : Number(known[0]?.effects.negativeCount || 0);
  const otherEffects = known.some(f => f.effects.entries.length > 0);
  const summaryId = `facility-effects-summary-${grouped ? `group-${facilities[0]?.type}` : targetId}`;
  const description = grouped
    ? `${positive} facilities with bonuses, ${negative} facilities with penalties${unavailable ? `, ${unavailable} unavailable` : ''}. Counts refer to the visible facilities; inspect individual rows for their sources.`
    : `${positive} bonuses, ${negative} penalties${unavailable ? '; breakdown unavailable' : ''}.`;
  return <><button type="button" className="facility-effects-trigger" data-effects-for={grouped ? `group-${facilities[0]?.type}` : targetId} aria-label={`View effects for ${label}`} aria-describedby={summaryId} aria-controls={`facility-effects-${targetId}`} aria-expanded={expanded} onClick={onOpen}>
    {positive > 0 && <span className="effect-positive"><ArrowUp size={12} aria-hidden="true"/>{positive} {grouped ? 'boosted' : positive === 1 ? 'bonus' : 'bonuses'}</span>}
    {negative > 0 && <span className="effect-negative"><ArrowDown size={12} aria-hidden="true"/>{negative} {grouped ? 'penalized' : negative === 1 ? 'penalty' : 'penalties'}</span>}
    {unavailable > 0 && <span className="effect-neutral"><CircleHelp size={12} aria-hidden="true"/>{grouped && unavailable < facilities.length ? `${unavailable} unavailable` : 'Effects unavailable'}</span>}
    {!positive && !negative && !unavailable && <span className="effect-neutral"><Minus size={12} aria-hidden="true"/>{otherEffects ? 'Other effects' : 'No modifiers'}</span>}
    <ChevronRight size={12} className="effects-open-icon" aria-hidden="true"/>
  </button><span className="sr-only" id={summaryId}>{description}</span></>;
}

export function FacilityEffects({ facility, now }: { facility: Data; now: number }) {
  const effects = facility.effects, available = Array.isArray(effects?.entries), entries = list(effects?.entries);
  const cycle = facility.status !== 'infrastructure' ? effects?.cycle : null;
  const quality = facility.status !== 'infrastructure' ? effects?.quality : null;
  return <section className="facility-effects" id={`facility-effects-${facility.id}`} tabIndex={-1} aria-labelledby={`facility-effects-heading-${facility.id}`}>
    <header><h4 id={`facility-effects-heading-${facility.id}`}>Active effects</h4><span>Latest server snapshot</span></header>
    {!available ? <p className="facility-effects-empty"><CircleHelp size={16} aria-hidden="true"/>This server has not provided an effects breakdown. The displayed production rates and cycle time still come from the server.</p> : <>
      {!effects.positiveCount && !effects.negativeCount && <p className="facility-effects-empty"><Minus size={16} aria-hidden="true"/>No active bonuses or penalties.{entries.length ? ' Additional conditions are shown below.' : ''}</p>}
      {cycle && <div className="facility-cycle-breakdown">
        <div className="facility-cycle-values"><span>Base cycle<strong>{number(cycle.baseSeconds, 3)}s</strong></span><span>Adjusted duration<strong>{number(cycle.adjustedSeconds, 3)}s</strong></span><span>Combined speed<strong>×{number(cycle.speedMultiplier, 5)}</strong></span><span>Latest effective cycle<strong>{number(cycle.effectiveSeconds, 3)}s</strong></span></div>
        <p>Duration adjustments and their limits apply first. The adjusted duration is divided by combined speed, then rounded to milliseconds and bounded by the final minimum cycle.</p>
        {cycle.floorApplied && <p className="facility-cycle-limit"><Info size={14} aria-hidden="true"/>A minimum duration applies; its source is listed below.</p>}
        <p className="facility-schedule-note"><Timer size={14} aria-hidden="true"/>{facility.status === 'producing' ? `Scheduled next cycle: ${remaining(facility.nextCycle, now)}. ` : ''}Existing scheduled cycles keep their timing. These latest modifiers apply when the server schedules the following cycle.</p>
      </div>}
      {quality && <p className="facility-quality-note">Current plus-quality chance: <strong>{number(quality.chance * 100, 2)}%</strong>. Quality changes the output mix; it does not shorten the cycle.</p>}
      <div className="facility-effect-categories">{effectCategories.map(([category, heading]) => {
        const items = entries.filter(entry => entry.category === category);
        return items.length > 0 ? <div className="facility-effect-category" key={category}><h5>{heading}</h5><ul>{items.map(entry => {
          const Icon = entry.tone === 'positive' ? ArrowUp : entry.tone === 'negative' ? ArrowDown : Minus;
          return <li className={`facility-effect-entry effect-${entry.tone || 'neutral'}`} data-effect-id={entry.id} key={entry.id}>
            <Icon size={16} aria-hidden="true"/><div><div className="facility-effect-label"><strong>{entry.label}</strong><span className="facility-effect-value">{entry.value}</span></div><p>{entry.description}</p><div className="facility-effect-meta"><span>{entry.scope}</span><span>{entry.tone === 'positive' ? 'Bonus' : entry.tone === 'negative' ? 'Penalty' : 'Baseline / condition'}</span>{entry.expiresAt != null && <span className="facility-effect-expiry">{entry.expiresAt > now ? `Next change in ${remaining(entry.expiresAt, now)}` : 'Awaiting server refresh'}</span>}</div></div>
          </li>;
        })}</ul></div> : null;
      })}</div>
    </>}
  </section>;
}
