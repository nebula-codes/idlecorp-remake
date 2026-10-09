import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { testServer, client, sleep } from './test-support.mjs';
const server=await testServer('load',3012);
const timings=[], errors=[];
try {
  const accounts=6, concurrentClients=12, rounds=10, clients=[];
  for(let i=0;i<accounts;i++){
    const c=client(server.origin);const result=await c.request('/api/auth/register',{username:`load_${i}`,password:'Local-test-password-42!',name:`Load Corporation ${i}`});assert.equal(result.status,200,JSON.stringify(result));assert.equal((await c.action('facility.build','verdant',{facilityId:'tree_farm',quantity:10})).status,200);clients.push(c);
    const second=client(server.origin);assert.equal((await second.request('/api/auth/login',{username:`load_${i}`,password:'Local-test-password-42!'})).status,200);clients.push(second);
  }
  const began=performance.now();
  for(let round=0;round<rounds;round++){await Promise.all(clients.map(async(c,i)=>{const t=performance.now();try{const response=round%3===0?await c.action('settings.update','verdant',{privacy:(round+i)%2===0}):await c.request('/api/state');if(response.status!==200)errors.push({round,i,status:response.status,error:response.data.error});}catch(e){errors.push({round,i,error:e.message});}timings.push(performance.now()-t);}));await sleep(700);}
  const duration=performance.now()-began;timings.sort((a,b)=>a-b);
  const production=(await clients[0].state()).holdings.verdant.inventory.wood;assert.ok(production>0);
  const report={date:new Date().toISOString(),accounts,concurrentClients,facilities:accounts*10,requests:rounds*concurrentClients,durationMs:Math.round(duration),requestsPerSecond:Math.round(timings.length/duration*10000)/10,p50Ms:Math.round(timings[Math.floor(timings.length*.5)]),p95Ms:Math.round(timings[Math.floor(timings.length*.95)]),maxMs:Math.round(timings.at(-1)),productionVerified:production>0,errors,scope:'Loopback Windows Node server + native PostgreSQL. 6 corporations, 2 authenticated clients each, 60 live tree farms. Ten bursts of 12 concurrent settings writes/snapshots, paced 700ms. No claim for saturation throughput, large production fleets or internet latency.'};
  fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/load-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);
}finally{await server.close();}

