import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.DESKTOP_TEST_ORIGIN||'http://localhost:3001';
const executablePath=process.env.DESKTOP_EXECUTABLE;
const app=await electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env:{...process.env,IDLECORP_TEST:'1',IDLECORP_SERVER:origin},timeout:30000});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 const security=await app.evaluate(({BrowserWindow})=>{const prefs=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return {nodeIntegration:prefs.nodeIntegration,contextIsolation:prefs.contextIsolation,sandbox:prefs.sandbox,webSecurity:prefs.webSecurity};});
 assert.deepEqual(security,{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true});
 assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 const remote=await page.evaluate(()=>window.idlecorp.getServerOrigin());assert.equal(remote,origin);
 for (const invalidOrigin of ['http://example.com','https://user:secret@example.com','https://example.com/path']) {
  await assert.rejects(page.evaluate(value=>window.idlecorp.setServerOrigin(value),invalidOrigin));
 }
 assert.equal(await page.evaluate(()=>window.idlecorp.getServerOrigin()),origin);
 const health=await page.evaluate(async()=>await(await fetch('/api/health')).json());assert.ok(health);
 const username=`desktop_${Date.now()}`;const password='Desktop-test-password42!';
 const register=await page.evaluate(async({username,password})=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,name:'Desktop Verification'})});return {status:r.status,data:await r.json()};},{username,password});assert.equal(register.status,200,JSON.stringify(register));
 const state=await page.evaluate(async()=>await(await fetch('/api/state')).json());assert.ok(state.corporation?.id,JSON.stringify(state));
 assert.equal(await page.evaluate(()=>document.cookie),'','Renderer must not receive the main-process session credential');
 const browserLogin=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(browserLogin.status,200);
 const cookie=browserLogin.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 const browserState=await(await fetch(origin+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(browserState.corporation.id,state.corporation.id);
 await page.reload();await page.getByRole('heading',{name:'Corporation overview',exact:true}).waitFor({timeout:30000});
 await page.getByRole('button',{name:'Production planner',exact:true}).click();await page.getByRole('heading',{name:'Production planner',exact:true}).waitFor();await page.getByLabel('Goal facility',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Overview',exact:true}).first().click();await page.getByRole('heading',{name:'Corporation overview',exact:true}).waitFor();
 fs.mkdirSync('artifacts/screenshots',{recursive:true});const capture=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));fs.writeFileSync('artifacts/screenshots/desktop.png',Buffer.from(capture,'base64'));
 const report={date:new Date().toISOString(),packaged:!!executablePath,executablePath:executablePath||'electron development shell',origin,security,sharedAccount:true,corporationId:state.corporation.id};fs.writeFileSync('artifacts/desktop-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await app.close();}
