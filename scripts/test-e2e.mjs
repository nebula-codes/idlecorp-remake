import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { testServer, client, sleep } from './test-support.mjs';
const server=await testServer('acceptance',3011);
const passed=[];let browser;
const check=(name)=>{passed.push(name);console.log('PASS '+name);};
async function ok(response){assert.equal(response.status,200,JSON.stringify(response));return response.data;}
try{
 const content=await(await fetch(server.origin+'/api/content')).json(),rid=content.regions[0].id;
 const alice=client(server.origin),bob=client(server.origin),alice2=client(server.origin),password='Acceptance-test-42!';
 await ok(await alice.request('/api/auth/register',{username:'accept_alice',password,name:'Northstar Works'}));
 await ok(await bob.request('/api/auth/register',{username:'accept_bob',password,name:'Foundry Partners'}));
 await ok(await alice2.request('/api/auth/login',{username:'accept_alice',password}));
 let a=await alice.state(),b=await bob.state();assert.notEqual(a.corporation.id,b.corporation.id);assert.equal((await alice2.state()).corporation.id,a.corporation.id);check('Two player accounts and a second session on one account');
 assert.equal(a.corporation.cash,content.rules.starterCash);assert.equal(a.holdings[rid].facilities.length,0);check('Clean unboosted onboarding');
 const idempotency=randomUUID(),build={facilityId:'tree_farm',quantity:1};
 const duplicate=await Promise.all([alice.action('facility.build',rid,build,idempotency),alice2.action('facility.build',rid,build,idempotency)]);await ok(duplicate[0]);await ok(duplicate[1]);assert.deepEqual(duplicate[0].data,duplicate[1].data);a=await alice.state();assert.equal(a.holdings[rid].facilities.length,1);assert.equal(a.corporation.cash,content.rules.starterCash-content.facilities.find(f=>f.id==='tree_farm').cost);
 assert.equal((await alice.action('facility.build',rid,{...build,quantity:2},idempotency)).status,409);check('Concurrent duplicate build executes once and mismatched key reuse fails');
 assert.equal((await bob.action('facility.demolish',rid,{id:a.holdings[rid].facilities[0].id})).status,404);assert.equal((await alice.action('npc.buy',rid,{assetId:'wood',quantity:-1})).status,400);assert.equal((await alice.action('npc.buy',rid,{assetId:'wood',quantity:1e30})).status,400);check('Ownership and numeric bounds enforced');
 await ok(await alice.action('land.buy',rid,{quantity:1}));
 await sleep(6000);a=await alice.state();assert.ok(a.holdings[rid].inventory.wood>=2);const beforeSale=a.corporation.cash;await ok(await alice.action('npc.sell',rid,{assetId:'wood',quantity:1}));assert.ok((await alice2.state()).corporation.cash>beforeSale);check('Land, construction, timed production, inventory, NPC sale, synchronized sessions');
 const concurrent=await Promise.all(Array.from({length:8},()=>alice.action('facility.build',rid,build)));assert.ok(concurrent.some(x=>x.status===400));a=await alice.state();assert.ok(a.corporation.cash>=0);assert.equal(a.holdings[rid].facilities.length,1+concurrent.filter(x=>x.status===200).length);check('Concurrent unaffordable builds cannot double-spend');
 const beforeRestart=a.holdings[rid].inventory.wood;await server.stop();await sleep(5500);await server.start();a=await alice.state();assert.ok(a.holdings[rid].inventory.wood>beforeRestart);check('Server restart preserves account/session/state and catches up offline production');
 await server.stop();
 // Explicit, isolated progression fixtures. Only this newly created test database is changed.
 const rows=(await server.query('SELECT id,state FROM corporations')).rows;
 for(const row of rows){const c=row.state;c.cash=2_000_000_000_000;for(const h of Object.values(c.holdings)){h.land=50;h.inventory={wood:1000,gasoline:100000,truck:10};h.facilities=[{id:randomUUID(),type:'logistics_center',level:0,xp:0,nextCycle:Date.now()+60000,enabled:false,plus:true,allowPlus:false,installed:[],costPaid:1000000000,materialsPaid:{},builtAt:Date.now()}];}c.lastProcessed=Date.now();await server.query('UPDATE corporations SET state=$1 WHERE id=$2',[JSON.stringify(c),row.id]);}
 await server.start();a=await alice.state();b=await bob.state();
 const moneyBefore=a.corporation.cash+b.corporation.cash;await ok(await alice.action('order.create',rid,{side:'sell',assetId:'wood',quantity:10,price:100}));
 a=await alice.state();const sell=a.orders.find(o=>o.corporationId===a.corporation.id&&o.status==='open');assert.equal(a.holdings[rid].inventory.wood,990);
 await ok(await bob.action('order.create',rid,{side:'buy',assetId:'wood',quantity:4,price:110}));a=await alice.state();b=await bob.state();assert.equal(b.holdings[rid].inventory.wood,1000);assert.equal(b.inbox.find(i=>i.status==='pending').quantity,4);const delivery=b.inbox.find(i=>i.status==='pending');await ok(await bob.action('logistics.claim',rid,{all:true}));await ok(await alice.action('logistics.claim',rid,{all:true}));assert.equal((await bob.action('logistics.claim',rid,{id:delivery.id})).status,400);a=await alice.state();b=await bob.state();assert.equal(b.holdings[rid].inventory.wood,1004);assert.equal(a.orders.find(o=>o.id===sell.id).remaining,6);
 await ok(await alice.action('order.cancel',rid,{id:sell.id}));a=await alice.state();b=await bob.state();assert.equal(a.holdings[rid].inventory.wood,996);const fee=a.trades.at(-1).fee;assert.equal(a.corporation.cash+b.corporation.cash,moneyBefore-fee);check('Two players trade with price priority, partial fill, escrow refund and cash conservation');
 await ok(await alice.action('order.create',rid,{side:'sell',assetId:'wood',quantity:10,price:100}));a=await alice.state();const racing=a.orders.find(o=>o.corporationId===a.corporation.id&&o.status==='open');
 const cash=a.corporation.cash+b.corporation.cash,goods=a.holdings[rid].inventory.wood+b.holdings[rid].inventory.wood+10,tradeCount=a.trades.length;
 const race=await Promise.all([alice.action('order.cancel',rid,{id:racing.id}),bob.action('order.create',rid,{side:'buy',assetId:'wood',quantity:6,price:100})]);assert.ok(race.every(x=>[200,400].includes(x.status)));a=await alice.state();b=await bob.state();const opens=a.orders.filter(o=>o.status==='open'),pending=[...a.inbox,...b.inbox].filter(i=>i.status==='pending');assert.equal(a.holdings[rid].inventory.wood+b.holdings[rid].inventory.wood+opens.filter(o=>o.side==='sell').reduce((n,o)=>n+o.remaining,0)+pending.filter(i=>i.assetId==='wood').reduce((n,i)=>n+i.quantity,0),goods);assert.equal(a.corporation.cash+b.corporation.cash+opens.filter(o=>o.side==='buy').reduce((n,o)=>n+o.remaining*o.price,0)+pending.filter(i=>i.assetId==='cash').reduce((n,i)=>n+i.quantity,0),cash-a.trades.slice(tradeCount).reduce((n,t)=>n+t.fee,0));check('Cancellation/fill race conserves escrowed goods, inbox deliveries and funds');
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.origin);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Username',{exact:true}).fill('accept_alice');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Return to corporation'}).click();await page.getByText('Northstar Works',{exact:true}).first().waitFor();
 fs.mkdirSync('artifacts/screenshots',{recursive:true});await page.screenshot({path:'artifacts/screenshots/overview-desktop.png',fullPage:true});
 const showAll=page.getByRole('button',{name:'Show all systems',exact:true});if(await showAll.isVisible())await showAll.click();
 for(const label of ['Facilities','Inventory','Production chains','Exchange','Retail','Logistics','Research & technology','Region & government','Reincorporation','Season & rewards','Space program','Leaderboard','Settings & field guide']){await page.getByRole('button',{name:label,exact:true}).first().click();await page.waitForTimeout(100);assert.equal(errors.length,0,errors.join('\n'));}
 await page.getByRole('button',{name:'Facilities',exact:true}).first().click();await page.screenshot({path:'artifacts/screenshots/facilities-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/screenshots/facilities-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile page overflows horizontally');
 await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));check('Browser login, all screens, desktop/mobile layout and keyboard focus');
 const render=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));assert.equal(render.corporation.id,a.corporation.id);check('Inspectable game state matches the authoritative account');
 await ok(await alice.request('/api/auth/logout',{}));assert.equal((await alice.request('/api/state')).status,401);assert.equal((await alice2.request('/api/state')).status,200);check('Logout invalidates only the current session');
 const audit=await server.query('SELECT count(*)::int AS count FROM economic_audit');assert.ok(audit.rows[0].count>0);check('Economic audit entries persisted');
 await server.stop();
 const run=(file,args=[])=>{const p=spawnSync(process.execPath,[file,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,DATABASE_URL:server.databaseUrl}});assert.equal(p.status,0,p.stdout+p.stderr);};
 run('scripts/backup.mjs',['artifacts/acceptance-backup.json']);
 await server.query("UPDATE corporations SET state=jsonb_set(state,'{name}', '\"Changed by restore test\"') WHERE id=$1",[a.corporation.id]);
 run('scripts/restore.mjs',['artifacts/acceptance-backup.json','--replace-world']);
 assert.equal((await server.query('SELECT state FROM corporations WHERE id=$1',[a.corporation.id])).rows[0].state.name,'Northstar Works');check('Consistent backup and transactional restore preserve the world');
 const report={date:new Date().toISOString(),passed,fixtureScope:'Fresh unboosted onboarding through production and sale; explicit isolated SQL fixtures only for midgame player-market access.',browserErrors:errors};fs.writeFileSync('artifacts/e2e-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
