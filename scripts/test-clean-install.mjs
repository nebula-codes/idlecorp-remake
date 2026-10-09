import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { testServer, client } from './test-support.mjs';
const root=process.cwd(),directory=path.join(root,'.runtime',`clean-install-${Date.now()}`);fs.mkdirSync(directory,{recursive:true});
for(const item of ['package.json','package-lock.json','tsconfig.json','vitest.config.ts','apps/server','apps/web','packages'])fs.cpSync(path.join(root,item),path.join(directory,item),{recursive:true});
const npmCli=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
function run(args){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[npmCli,...args],{cwd:directory,windowsHide:true,stdio:'inherit',env:{...process.env,ELECTRON_SKIP_BINARY_DOWNLOAD:'1'}});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error('Clean install command failed: '+args.join(' '))));});}
await run(['ci']);await run(['run','typecheck']);await run(['run','build']);
const server=await testServer('clean',3014,directory);
try{
 const c=client(server.origin);const result=await c.request('/api/auth/register',{username:'clean_start',password:'Clean-test-password42',name:'Clean Installation'});assert.equal(result.status,200);const s=await c.state();assert.equal(s.corporation.cash,100000);assert.equal(s.holdings.verdant.facilities.length,0);assert.equal((await fetch(server.origin+'/')).status,200);
 const report={date:new Date().toISOString(),directory,commands:['npm ci','npm run typecheck','npm run build','fresh PostgreSQL migration on startup','normal account registration and built web HTTP200'],passed:true,limitation:'Docker daemon was unavailable; native PostgreSQL used for clean-start verification. Electron binary download skipped in this second dependency tree; Windows package verified separately.'};fs.writeFileSync('artifacts/clean-install-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await server.close();}
