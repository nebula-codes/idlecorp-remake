import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function testServer(label, port=3011, workspace=process.cwd()) {
  const base = new URL(process.env.TEST_DATABASE_URL || 'postgres://idlecorp:idlecorp@localhost:5432/postgres');
  const name = `idlecorp_test_${label}_${Date.now()}`;
  const admin = new pg.Client({connectionString:base.href}); await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(base); url.pathname = '/'+name;
  let child, logs='';
  const origin=`http://127.0.0.1:${port}`;
  async function start() {
    child=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{cwd:workspace,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'test',DATABASE_URL:url.href,PORT:String(port),HOST:'127.0.0.1',PUBLIC_ORIGIN:origin}});
    child.stdout.on('data',d=>{logs+=d;});child.stderr.on('data',d=>{logs+=d;});
    for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error(`Server exited ${child.exitCode}: ${logs}`);try{if((await fetch(origin+'/api/health')).ok)return;}catch{/* Starting */}await sleep(100);}
    throw new Error('Server startup timeout: '+logs);
  }
  async function stop(){if(child&&child.exitCode===null){child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(5000)]);}}
  async function query(sql,values){const db=new pg.Client({connectionString:url.href});await db.connect();try{return await db.query(sql,values);}finally{await db.end();}}
  async function close(){await stop();fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(path.join('artifacts',`${label}-server.log`),logs);await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();}
  try{await start();}catch(e){await close();throw e;}
  return {origin,start,stop,query,close,name,databaseUrl:url.href,logs:()=>logs};
}
export function client(origin){let cookie='';return {
  async request(endpoint,body,key){const headers={};if(cookie)headers.Cookie=cookie;if(body){headers['Content-Type']='application/json';if(key)headers['Idempotency-Key']=key;}
    const response=await fetch(origin+endpoint,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
    for(const value of response.headers.getSetCookie()){cookie=value.split(';')[0];}
    const data=await response.json();return {status:response.status,data};},
  async action(type,regionId,body={},key=randomUUID()){return this.request('/api/action',{type,regionId,...body},key);},
  async state(){const r=await this.request('/api/state');if(r.status!==200)throw new Error(JSON.stringify(r));return r.data;},
  cookie:()=>cookie,
};}
