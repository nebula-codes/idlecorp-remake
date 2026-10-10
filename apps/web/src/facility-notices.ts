import type { Data } from './ui';

/** One toast for simultaneous region milestones; individual entries remain in Events. */
export function facilityLevelNotice(notes: Data[]): string | null {
  if (!notes.length || notes.some(note => note.type !== 'facility_level')) return null;
  const changed = new Map<string, { from: number; to: number }>();
  const regions = new Set<string>();
  for (const note of notes) {
    for (const change of note.changes || []) {
      const key = `${note.regionId}:${change.id}`, previous = changed.get(key);
      changed.set(key, { from: Math.min(previous?.from ?? change.fromLevel, change.fromLevel), to: Math.max(previous?.to ?? change.toLevel, change.toLevel) });
      regions.add(note.regionId);
    }
  }
  if (!changed.size) return null;
  if (changed.size === 1 && notes.length === 1) return `${notes[0].title}: ${notes[0].message}`;
  const levels = [...changed.values()].reduce((sum, change) => sum + change.to - change.from, 0);
  return `${changed.size} ${changed.size === 1 ? 'facility gained' : 'facilities gained'} ${levels} ${levels === 1 ? 'level' : 'levels'}${regions.size > 1 ? ` across ${regions.size} regions` : ''}. Inspect the milestones in Notifications.`;
}
