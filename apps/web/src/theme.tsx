import { createContext, useContext, useEffect, useId, useLayoutEffect, useState, type ReactNode } from 'react';
import { Check, Monitor, Palette } from 'lucide-react';
import { Drawer } from './drawer';

export const THEME_KEY = 'idlecorp-theme-v1';
export const themes = [
  { id: 'light', name: 'Light', description: 'The classic garden of industry.', scheme: 'light', canvas: '#f5f6f2', surface: '#ffffff', accent: '#b75028', sidebar: '#182c27' },
  { id: 'dark', name: 'Dark', description: 'A quieter workspace after hours.', scheme: 'dark', canvas: '#101915', surface: '#1a2721', accent: '#f0a06a', sidebar: '#0b120e' },
  { id: 'contrast', name: 'High Contrast', description: 'Bold text, clear borders, bright focus.', scheme: 'dark', canvas: '#000000', surface: '#090909', accent: '#ffdf00', sidebar: '#000000' },
  { id: 'ocean', name: 'Ocean', description: 'Deep blue water and turquoise lights.', scheme: 'dark', canvas: '#091d2b', surface: '#112c40', accent: '#57dbda', sidebar: '#061520' },
  { id: 'sunset', name: 'Sunset', description: 'Warm peach skies and berry accents.', scheme: 'light', canvas: '#fbf0e8', surface: '#fffaf5', accent: '#a74264', sidebar: '#482936' },
  { id: 'terminal', name: 'Terminal', description: 'Green phosphor for your factory floor.', scheme: 'dark', canvas: '#07110b', surface: '#0e1d13', accent: '#8fea80', sidebar: '#030906' },
] as const;
export type ThemeId = typeof themes[number]['id'];
type ThemeChoice = ThemeId | 'system';
const validChoice = (value: unknown): ThemeChoice => value === 'system' || themes.some(theme => theme.id === value) ? value as ThemeChoice : 'light';
function readChoice(): ThemeChoice { try { return validChoice(localStorage.getItem(THEME_KEY)); } catch { return 'light'; } }
function deviceTheme(): ThemeId {
  if (window.matchMedia('(prefers-contrast: more)').matches) return 'contrast';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
const ThemeContext = createContext<{ choice: ThemeChoice; applied: ThemeId; choose: (choice: ThemeChoice) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState(readChoice), [device, setDevice] = useState(deviceTheme);
  const applied = choice === 'system' ? device : choice;
  useLayoutEffect(() => {
    const theme = themes.find(theme => theme.id === applied)!;
    document.documentElement.dataset.theme = applied;
    document.documentElement.style.colorScheme = theme.scheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.canvas);
  }, [applied]);
  useEffect(() => {
    const queries = [window.matchMedia('(prefers-color-scheme: dark)'), window.matchMedia('(prefers-contrast: more)')];
    const onDevice = () => setDevice(deviceTheme());
    const onStorage = (event: StorageEvent) => { if (event.key === THEME_KEY || event.key === null) setChoice(readChoice()); };
    queries.forEach(query => query.addEventListener('change', onDevice));
    window.addEventListener('storage', onStorage);
    return () => { queries.forEach(query => query.removeEventListener('change', onDevice)); window.removeEventListener('storage', onStorage); };
  }, []);
  const choose = (value: ThemeChoice) => { const next = validChoice(value); setChoice(next); try { localStorage.setItem(THEME_KEY, next); } catch { /* Keep the current-session choice when storage is unavailable. */ } };
  return <ThemeContext.Provider value={{ choice, applied, choose }}>{children}</ThemeContext.Provider>;
}

function useTheme() { const theme = useContext(ThemeContext); if (!theme) throw new Error('Theme controls require ThemeProvider'); return theme; }

export function ThemePicker() {
  const { choice, applied, choose } = useTheme(), name = useId();
  return <div className="theme-picker"><p className="theme-intro">Make this workspace yours. Changes apply instantly and are remembered on this device.</p>
    <fieldset className="theme-options"><legend className="sr-only">Page theme</legend>
      {themes.map(theme => <label key={theme.id} className={`theme-card ${choice === theme.id ? 'selected' : ''}`}>
        <input type="radio" name={name} value={theme.id} checked={choice === theme.id} onChange={() => choose(theme.id)} aria-label={theme.name}/>
        <span className="theme-preview" style={{ background: theme.canvas }} aria-hidden="true"><span className="theme-preview-sidebar" style={{ background: theme.sidebar }}/><span className="theme-preview-content"><span style={{ background: theme.accent }}/><span style={{ background: theme.surface }}/><span style={{ background: theme.surface }}/></span></span>
        <span className="theme-card-heading"><strong>{theme.name}</strong>{choice === theme.id && <Check size={16} aria-hidden="true"/>}</span><span className="theme-description">{theme.description}</span>
      </label>)}
      <label className={`theme-system ${choice === 'system' ? 'selected' : ''}`}><input type="radio" name={name} value="system" checked={choice === 'system'} onChange={() => choose('system')} aria-label="Use device setting"/><Monitor size={22}/><span><strong>Use device setting</strong><small>Follow your device’s light, dark, or increased contrast preference.</small></span></label>
    </fieldset><p className="theme-current" role="status">{themes.find(theme => theme.id === applied)?.name} theme active{choice === 'system' ? ' · following your device' : ''}.</p>
  </div>;
}

export function ThemeToggle({ label = false }: { label?: boolean }) {
  const [open, setOpen] = useState(false), { applied } = useTheme();
  return <><button className={`theme-toggle ${label ? 'button secondary' : 'icon-button'}`} aria-label="Choose theme" aria-haspopup="dialog" aria-expanded={open} title={`Choose theme · ${themes.find(theme => theme.id === applied)?.name}`} onClick={() => setOpen(true)}><Palette size={19}/>{label && <span>Theme</span>}</button>{open && <Drawer title="Appearance" onClose={() => setOpen(false)}><ThemePicker/><button className="button secondary full theme-done" onClick={() => setOpen(false)}>Done</button></Drawer>}</>;
}
