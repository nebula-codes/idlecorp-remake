import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { testServer, client } from './test-support.mjs';

const server=await testServer('operations',3016), passed=[];
function cli(file,args,overrides={}) {
 const result=spawnSync(process.execPath,['--import','tsx',file,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,NODE_ENV:'test',DATABASE_URL:server.databaseUrl,ALLOW_DEV_TOOLS:'1',...overrides}});
 return {status:result.status,output:result.stdout+result.stderr};
}
function ok(result){assert.equal(result.status,0,result.output);}
try {
 const player=client(server.origin);
 assert.equal((await player.request('/api/auth/register',{username:'operations_user',password:'Operations-password42!',name:'Operations Test'})).status,200);
 for(const tier of ['free','plus','gold','platinum']) {
  ok(cli('apps/server/src/admin.ts',['entitlement','operations_user',tier]));
  assert.equal((await player.state()).corporation.entitlement,tier);
 }
 assert.equal((await server.query("SELECT count(*)::int AS n FROM economic_audit WHERE action='admin.entitlement'")).rows[0].n,4);
 passed.push('All four administrative entitlement grants reach the authoritative account and persist audit entries');
 assert.notEqual(cli('apps/server/src/admin.ts',['entitlement','operations_user','unknown']).status,0);
 assert.equal((await player.state()).corporation.entitlement,'platinum');
 passed.push('Invalid administrative tiers are rejected without changing entitlement');
 for(const fixture of ['early','mid','late']) {
  ok(cli('scripts/dev-fixture.ts',['seed','operations_user',fixture]));
  const state=await player.state(), holding=state.holdings.verdant;
  assert.ok(state.corporation.motto.includes('development'));
  assert.ok(holding.facilities.length >= (fixture==='early'?4:6));
  if(fixture!=='early') {
   assert.equal(holding.inventory.blueprint_oil_mapping,10);
   assert.equal(holding.blueprints.oil_mapping,10);
  }
 }
 passed.push('Explicit early, mid and late fixtures create usable facilities and region-local blueprint inventories');
 const before=await player.state();
 ok(cli('scripts/dev-fixture.ts',['advance','20']));
 const after=await player.state();
 assert.ok(after.stats.produced>before.stats.produced);
 passed.push('Development time advance settles actual chronological production and persists the result');
 for(const overrides of [{ALLOW_DEV_TOOLS:''},{NODE_ENV:'production'}]) {
  assert.notEqual(cli('scripts/dev-fixture.ts',['seed','operations_user','late'],overrides).status,0);
 }
 assert.notEqual(cli('scripts/dev-fixture.ts',['advance','NaN']).status,0);
 passed.push('Fixture opt-in, production rejection and bounded time validation enforced');
 const report={date:new Date().toISOString(),passed,fixtureScope:'Isolated temporary PostgreSQL database; administrative and development CLIs only, no production endpoint.'};
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/operations-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await server.close();}
