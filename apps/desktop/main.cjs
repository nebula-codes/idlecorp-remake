const { app, BrowserWindow, protocol, net, ipcMain, session, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

if(process.env.IDLECORP_TEST==='1')app.setPath('userData',path.resolve('.runtime/desktop-test'));

protocol.registerSchemesAsPrivileged([{ scheme: 'idlecorp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let settings = { serverOrigin: 'http://localhost:3001' };
let cookie = '';
const settingsPath = () => path.join(app.getPath('userData'), 'connection.json');
function validOrigin(input) {
  const u = new URL(input);
  if (u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('Enter only the server origin, such as https://game.example.com');
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) throw new Error('Remote servers require HTTPS. HTTP is allowed for localhost.');
  return u.origin;
}
function saveSettings() {
  const out = { serverOrigin: settings.serverOrigin };
  if (cookie && safeStorage.isEncryptionAvailable()) out.session = safeStorage.encryptString(cookie).toString('base64');
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(out), { mode: 0o600 });
}
function trusted(event) {
  const source=event.senderFrame&&new URL(event.senderFrame.url);
  if (!source || source.protocol!=='idlecorp:' || source.hostname!=='app') throw new Error('Untrusted caller');
}
async function run() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    settings.serverOrigin = validOrigin(saved.serverOrigin);
    if (saved.session && safeStorage.isEncryptionAvailable()) cookie = safeStorage.decryptString(Buffer.from(saved.session, 'base64'));
  } catch { /* New installation, invalid setting or expired platform encryption. */ }
  if (process.env.IDLECORP_SERVER) {
    const configuredOrigin = validOrigin(process.env.IDLECORP_SERVER);
    if (configuredOrigin !== settings.serverOrigin) cookie = '';
    settings.serverOrigin = configuredOrigin;
  }
  const root = path.resolve(__dirname, '../web/dist');
  protocol.handle('idlecorp', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') return new Response('Unknown host', { status: 403 });
    if (url.pathname.startsWith('/api/')) {
      try {
        const requestedOrigin=settings.serverOrigin;
        const headers = new Headers();
        for (const key of ['content-type', 'idempotency-key', 'accept']) { const value = request.headers.get(key); if (value) headers.set(key, value); }
        if (cookie) headers.set('cookie', cookie);
        const response = await fetch(`${requestedOrigin}${url.pathname}${url.search}`, {
          method: request.method, headers, body: ['GET','HEAD'].includes(request.method) ? undefined : await request.text(),
          redirect: 'error', signal: AbortSignal.timeout(url.pathname === '/api/events' ? 180000 : 30000),
        });
        if(settings.serverOrigin!==requestedOrigin) return Response.json({error:'The server address changed. Reconnect to continue.'},{status:409});
        for (const item of response.headers.getSetCookie()) {
          const value = item.split(';')[0];
          if (value.startsWith('session=') || value.startsWith('idlecorp_session=') || value.startsWith('sid=')) { cookie = value.split('=')[1] ? value : ''; saveSettings(); }
        }
        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('set-cookie');
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('content-length');
        return new Response(response.body, { status: response.status, headers: responseHeaders });
      } catch { return Response.json({ error: 'Cannot reach the shared server. Check your server address and connection.' }, { status: 503 }); }
    }
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) return new Response('Forbidden', { status: 403 });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const result = await net.fetch(pathToFileURL(file).href);
    const headers = new Headers(result.headers);
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    return new Response(result.body, { status: result.status, headers });
  });
  ipcMain.handle('connection:get', (event) => { trusted(event); return settings.serverOrigin; });
  ipcMain.handle('connection:set', (event, origin) => { trusted(event); if (typeof origin !== 'string' || origin.length > 2048) throw new Error('Invalid address'); settings.serverOrigin = validOrigin(origin); cookie = ''; saveSettings(); });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const window = new BrowserWindow({ width: 1440, height: 980, minWidth: 760, minHeight: 640, title: 'IdleCorp', backgroundColor: '#f5f5f1', show: process.env.IDLECORP_TEST !== '1', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => { const parsed=new URL(target);if (parsed.protocol!=='idlecorp:'||parsed.hostname!=='app') event.preventDefault(); });
  await window.loadURL('idlecorp://app/');
}
app.whenReady().then(run).catch((error) => { console.error(error); app.quit(); });
app.on('window-all-closed', () => app.quit());
