// Apply the saved appearance before the app styles paint, including in Electron's self-only CSP.
(() => {
  const palettes = { light: ['light', '#f5f6f2'], dark: ['dark', '#101915'], contrast: ['dark', '#000000'], ocean: ['dark', '#091d2b'], sunset: ['light', '#fbf0e8'], terminal: ['dark', '#07110b'] };
  let theme = 'light';
  try { const saved = localStorage.getItem('idlecorp-theme-v1'); if (saved === 'system') theme = matchMedia('(prefers-contrast: more)').matches ? 'contrast' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; else if (Object.hasOwn(palettes, saved)) theme = saved; } catch { /* Default appearance works without browser storage. */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = palettes[theme][0];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palettes[theme][1]);
})();
