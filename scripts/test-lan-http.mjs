import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';
import { testServer } from './test-support.mjs';

// Chromium's hostname mapping reaches only the disposable loopback test server.
// Unlike localhost, an HTTP .test origin is a genuinely non-secure browser context.
const baseline=process.argv.includes('--baseline');
const directory=path.resolve('artifacts/lan-http');
const reportPath=baseline?path.join(directory,'baseline-report.json'):path.resolve('artifacts/lan-http-report.json');
const passed=[],pageErrors=[],requests=[];
const listener=net.createServer();
await new Promise((resolve,reject)=>listener.once('error',reject).listen(0,'127.0.0.1',resolve));
const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const origin=`http://idlecorp.test:${port}`;
process.env.BACKUP_ENABLED='false';
const server=await testServer('lan_http',port,process.cwd(),{publicOrigin:origin});
let browser,page,failure;
const report={date:new Date().toISOString(),origin,baseline,passed,pageErrors,scope:'Isolated disposable PostgreSQL database and loopback server; Chromium maps idlecorp.test to this server without changing browser secure-context rules.'};
const check=message=>{passed.push(message);console.log('PASS '+message);};
try {
 browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP idlecorp.test 127.0.0.1','--no-proxy-server']});
 page=await browser.newPage({viewport:{width:1365,height:900}});page.setDefaultTimeout(12000);
 page.on('pageerror',error=>pageErrors.push(error.message));
 page.on('request',request=>{if(new URL(request.url()).pathname==='/api/action')requests.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});});
 const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 const settled=()=>page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy,null,{timeout:6000});
 const assertCount=async count=>{await page.waitForFunction(n=>JSON.parse(window.render_game_to_text()).holding?.facilities.length===n,count);const current=await state();assert.equal(current.holding.facilities.length,count);assert.equal(current.busy,false);return current;};
 await page.goto(origin);
 report.browserContext=await page.evaluate(()=>({origin:window.location.origin,isSecureContext:window.isSecureContext,randomUUID:typeof window.crypto.randomUUID,getRandomValues:typeof window.crypto.getRandomValues}));
 assert.equal(report.browserContext.isSecureContext,false);assert.equal(report.browserContext.randomUUID,'undefined');assert.equal(report.browserContext.getRandomValues,'function');
 check('Real HTTP hostname context is insecure and crypto.randomUUID is unavailable');
 await page.getByLabel('Corporation name',{exact:true}).fill('LAN Regression Works');
 await page.getByLabel('Username',{exact:true}).fill('lan_operator');
 await page.getByLabel('Password',{exact:true}).fill('Lan-regression-password42!');
 await page.getByRole('button',{name:'Start building',exact:true}).click();
 await page.getByText('Corporation overview',{exact:true}).waitFor();
 const initial=await state(),initialCash=initial.corporation.cash;
 await page.getByRole('button',{name:'Facilities',exact:true}).click();
 await page.getByLabel('Search facilities',{exact:true}).fill('Tree farm');
 const openBuild=async()=>{const catalogue=page.getByRole('button',{name:/Build catalogue/});await catalogue.click();await page.getByRole('button',{name:'Build facility',exact:true}).click();await page.getByRole('dialog',{name:'Build Tree farm',exact:true}).waitFor();};
 const confirmBuild=()=>page.getByRole('dialog').getByRole('button',{name:/Build for /}).click();
 await openBuild();await confirmBuild();await settled();let current=await assertCount(1);
 assert.equal(await page.getByRole('dialog').count(),0);assert.ok(current.corporation.cash<initialCash);assert.equal(requests.length,1);assert.match(requests[0].key,/^[A-Za-z0-9-]{8,128}$/);
 check('Registration and a real facility purchase confirm on LAN HTTP without a stuck busy indicator');
 const firstCost=initialCash-current.corporation.cash;

 // Key generation itself can throw. It must be covered by the mutation's finally.
 await openBuild();
 await page.evaluate(()=>{const original=window.crypto.getRandomValues.bind(window.crypto);Object.defineProperty(window.crypto,'getRandomValues',{configurable:true,value:()=>{Object.defineProperty(window.crypto,'getRandomValues',{configurable:true,value:original});throw new Error('Simulated random source failure');}});});
 const beforeGenerationFailure=requests.length;
 await confirmBuild();await page.getByRole('alert').filter({hasText:'No request was sent'}).waitFor();await settled();
 assert.equal(requests.length,beforeGenerationFailure);assert.equal((await state()).holding.facilities.length,1);assert.equal(await page.locator('.mutation-progress').count(),0);
 await confirmBuild();await settled();current=await assertCount(2);assert.equal(current.corporation.cash,initialCash-firstCost*2);
 check('A one-time random-source exception sends no action, releases busy state, and permits a successful retry');

 // Let the server commit, then replace only the delivery of its response. A retry
 // must reuse the same idempotency key and return that original committed build.
 let expectedCount=2,ambiguousKey;
 for(const fault of [{status:503,body:JSON.stringify({error:'Simulated lost committed response'}),message:'Simulated lost committed response',label:'503 response'},{status:200,body:'{"snapshot":',message:'unreadable response',label:'malformed 200 response'}]){
  await openBuild();let intercepted=false,committedRevision,routeError;
  await page.route('**/api/action',async route=>{try{const data=route.request().postDataJSON();if(!intercepted&&data.type==='facility.build'){intercepted=true;const response=await route.fetch({url:server.origin+'/api/action',headers:route.request().headers()});assert.equal(response.status(),200);committedRevision=(await response.json()).revision;await route.fulfill({status:fault.status,contentType:'application/json',body:fault.body});}else await route.continue();}catch(error){routeError=error;await route.abort('failed').catch(()=>{});}});
  const beforeAmbiguous=requests.length;expectedCount++;
  await confirmBuild();await page.getByRole('alert').filter({hasText:fault.message}).waitFor();await settled();current=await assertCount(expectedCount);
  assert.equal(routeError,undefined,'Fault-injection upstream request must succeed');assert.ok(committedRevision);assert.equal(await page.getByRole('dialog').count(),1);assert.equal(requests.length,beforeAmbiguous+1);
  ambiguousKey=requests.at(-1).key;
  await confirmBuild();await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));await settled();current=await assertCount(expectedCount);
  assert.equal(requests.length,beforeAmbiguous+2);assert.equal(requests.at(-1).key,ambiguousKey);assert.equal(current.corporation.cash,initialCash-firstCost*expectedCount);
  await page.unroute('**/api/action');
  check(`A committed ${fault.label} failure reconciles state and reuses the original key without a duplicate facility or charge`);
 }
 expectedCount++;await openBuild();await confirmBuild();await settled();current=await assertCount(expectedCount);
 assert.notEqual(requests.at(-1).key,ambiguousKey);assert.equal(current.corporation.cash,initialCash-firstCost*expectedCount);
 check('A subsequent fresh purchase gets a new key and succeeds after the ambiguous retry completes');
 await page.reload();await page.getByText('Corporation overview',{exact:true}).waitFor();current=await assertCount(expectedCount);assert.equal(current.corporation.id,initial.corporation.id);
 await page.getByRole('button',{name:'Facilities',exact:true}).click();await page.getByRole('button',{name:/Your facilities/}).click();
 await page.waitForFunction(count=>document.querySelectorAll('.owned-facility').length===count,expectedCount);
 assert.deepEqual(pageErrors,[]);check('Reload preserves the confirmed purchases and no unhandled browser errors occurred');
 report.status='passed';report.finalState=current;report.actionAttempts=requests.map(({key,body})=>({key,type:body.type,facilityId:body.facilityId}));
} catch(error){failure=error;report.status='failed';report.error=error.message;if(page)report.lastState=await page.evaluate(()=>window.render_game_to_text?JSON.parse(window.render_game_to_text()):null).catch(()=>null);}
finally {
 await fs.mkdir(directory,{recursive:true});
 if(page){await page.screenshot({path:path.join(directory,baseline?'baseline.png':'confirmed-purchases.png'),fullPage:true,animations:'disabled'}).catch(()=>{});}
 await browser?.close();await server.close();await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
}
if(failure){console.error(`${failure.message}\nReport: ${reportPath}`);process.exitCode=1;}else console.log(`LAN HTTP regression passed (${passed.length} groups). Report: ${reportPath}`);
