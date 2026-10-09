import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const executable=path.resolve(`release/IdleCorp-${JSON.parse(fs.readFileSync('package.json','utf8')).version}-Windows-x64.exe`);
const child=spawn(executable,['--remote-debugging-port=9333'],{windowsHide:true,stdio:'ignore',env:{...process.env,IDLECORP_TEST:'1',IDLECORP_SERVER:'http://localhost:3001'}});
let browser;
try{
 let ready=false;for(let n=0;n<120;n++){try{if((await fetch('http://127.0.0.1:9333/json/version')).ok){ready=true;break;}}catch{/* Portable extraction/startup */}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Portable executable did not start its Chromium endpoint');
 browser=await chromium.connectOverCDP('http://127.0.0.1:9333');const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('idlecorp://app'))||browser.contexts()[0].pages()[0];await page.waitForLoadState('domcontentloaded');
 const health=await page.evaluate(async()=>await(await fetch('/api/health')).json());assert.equal(health.ok,true);assert.equal(await page.evaluate(()=>typeof window.require),'undefined');assert.equal(await page.evaluate(()=>window.idlecorp.getServerOrigin()),'http://localhost:3001');
 await page.locator('.loading-screen').waitFor({state:'hidden',timeout:30000});await page.getByRole('button',{name:/Start building|Overview/}).first().waitFor({timeout:30000});
 const result={date:new Date().toISOString(),portableExecutable:executable,launched:true,packagedUi:page.url(),sharedServerHealth:health,rendererNodeDisabled:true};fs.writeFileSync('artifacts/portable-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(browser){const session=await browser.newBrowserCDPSession();await Promise.race([session.send('Browser.close').catch(()=>{}),new Promise(r=>setTimeout(r,1000))]);await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,1000))]);}if(child.exitCode===null)child.kill();}
