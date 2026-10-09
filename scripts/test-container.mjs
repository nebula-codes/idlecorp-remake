import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

// Only Docker resources carrying this run's unique ownership label may be removed.
// No host database connection, Docker login, publishing, or existing volume is used.
const execute=promisify(execFile);
const image=process.argv[2]||process.env.IDLECORP_TEST_IMAGE||'idlecorp:ci';
if(image.startsWith('-')||!/^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(image))throw new Error('Provide a valid local Docker image reference.');
const runId=`idlecorp-ci-${Date.now()}-${randomUUID().slice(0,8)}`;
const labelKey='org.idlecorp.container-test',label=`${labelKey}=${runId}`;
const names={network:`${runId}-network`,database:`${runId}-postgres`,app:`${runId}-app`,restore:`${runId}-restore`,data:`${runId}-data`,backups:`${runId}-backups`};
const containers=new Set([names.app,names.restore,names.database]);
const passed=[],cleanupErrors=[];
const databasePassword=`PG+:/?#[$]@%${randomUUID()}!`,accountPassword=`Container-account-${randomUUID()}!`;
const secrets=[databasePassword,accountPassword];
const redact=value=>secrets.reduce((text,secret)=>text.replaceAll(secret,'[REDACTED]'),String(value));
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'idlecorp-container-test-'));
const appEnv=path.join(temporary,'app.env'),dbEnv=path.join(temporary,'postgres.env');
const reportPath=path.resolve('artifacts/container-report.json');
const report={date:new Date().toISOString(),image,runId,passed,scope:'Disposable labeled Docker network, PostgreSQL container, application container and two private volumes; no host database or existing Docker data is used.'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const interruption=new globalThis.AbortController();
const onInterrupt=()=>interruption.abort(new Error('Container smoke interrupted; cleaning up its private resources.'));
process.on('SIGINT',onInterrupt);process.on('SIGTERM',onInterrupt);
let failure,cleaning=false;

async function docker(args,timeout=60000){
 try {const result=await execute('docker',args,{timeout,maxBuffer:4*1024*1024,windowsHide:true,encoding:'utf8',signal:cleaning?undefined:interruption.signal});return result.stdout.trim();}
 catch(error){throw new Error(redact(`Docker ${args[0]} failed: ${error.stderr||error.message}`),{cause:error});}
}
async function eventually(operation,{timeout=90000,interval=500,label:description='condition'}={}){
 const deadline=Date.now()+timeout;let last;
 while(Date.now()<deadline){if(interruption.signal.aborted)throw interruption.signal.reason;try{const result=await operation();if(result)return result;}catch(error){last=error;}await sleep(interval);}
 throw new Error(`Timed out waiting for ${description}${last?`: ${redact(last.message)}`:''}`);
}
function check(message){passed.push(message);console.log(`PASS ${message}`);}
async function unusedPort(){const listener=net.createServer();await new Promise((resolve,reject)=>listener.once('error',reject).listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));return port;}
async function inspect(kind,name){return JSON.parse(await docker([kind,'inspect',name]));}
async function postgresReady(){return eventually(async()=>{await docker(['exec',names.database,'pg_isready','-U','container_test','-d','idlecorp_container_test'],10000);return true;},{label:'isolated PostgreSQL readiness'});}
async function gracefulStop(name){await docker(['stop','--time','20',name],30000);const [item]=await inspect('container',name);assert.equal(item.State.Running,false);assert.equal(item.State.ExitCode,0,`${name} did not stop gracefully`);}
async function removeOwned(kind,name){
 let items;try{items=await inspect(kind,name);}catch(error){if(/No such|not found/i.test(error.message))return;throw error;}
 const owned=items[0]?.Config?.Labels?.[labelKey]||items[0]?.Labels?.[labelKey];
 if(owned!==runId)throw new Error(`Refusing to remove ${kind} ${name}: test ownership label does not match.`);
 await docker([kind,'rm',...(kind==='container'?['--force']:[]),name],30000);
}

try {
 await docker(['info','--format','{{.OSType}}']);
 const [imageInfo]=JSON.parse(await docker(['image','inspect',image]));
 assert.ok(imageInfo.Config.User&&imageInfo.Config.User!=='root'&&imageInfo.Config.User!=='0','Application image must declare a non-root user.');
 report.imageId=imageInfo.Id;
 const port=await unusedPort(),origin=`http://127.0.0.1:${port}`;
 await fs.writeFile(dbEnv,`POSTGRES_DB=idlecorp_container_test\nPOSTGRES_USER=container_test\nPOSTGRES_PASSWORD=${databasePassword}\n`,{mode:0o600});
 await fs.writeFile(appEnv,`PGHOST=${names.database}\nPGPORT=5432\nPGDATABASE=idlecorp_container_test\nPGUSER=container_test\nPGPASSWORD=${databasePassword}\nNODE_ENV=production\nHOST=0.0.0.0\nPORT=3001\nPUBLIC_ORIGIN=${origin}\nCOOKIE_SECURE=false\nBACKUP_ENABLED=false\nBACKUP_DIR=/app/.runtime/backups\n`,{mode:0o600});
 await docker(['network','create','--label',label,names.network]);
 await docker(['volume','create','--label',label,names.data]);
 await docker(['volume','create','--label',label,names.backups]);
 await docker(['run','--detach','--name',names.database,'--label',label,'--network',names.network,'--env-file',dbEnv,'--mount',`type=volume,source=${names.data},target=/var/lib/postgresql`,'postgres:18-alpine'],180000);
 await postgresReady();
 await docker(['run','--detach','--name',names.app,'--label',label,'--network',names.network,'--env-file',appEnv,'--publish',`127.0.0.1:${port}:3001`,'--mount',`type=volume,source=${names.backups},target=/app/.runtime/backups`,image]);
 const health=()=>eventually(async()=>{const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(3000)});if(!response.ok)return false;const body=await response.json();assert.equal(body.ok,true);assert.equal(body.database,'postgresql');return body;},{label:'compiled application startup and database migration'});
 await health();
 const runtime=JSON.parse(await docker(['exec',names.app,'node','--input-type=module','-e',"import fs from 'node:fs';const absent=['electron','electron-builder','playwright','tsx','typescript','embedded-postgres'].filter(name=>fs.existsSync('node_modules/'+name));console.log(JSON.stringify({uid:process.getuid(),absent,entry:fs.existsSync('apps/server/src/index.js'),migrations:fs.readdirSync('apps/server/migrations').filter(name=>name.endsWith('.sql')).length}));"]));
 assert.notEqual(runtime.uid,0);assert.equal(runtime.entry,true);assert.ok(runtime.migrations>=2);assert.deepEqual(runtime.absent,[]);
 check('Production image runs compiled JavaScript as non-root, migrates PostgreSQL, and omits Electron, Playwright, tsx and development tooling');
 const html=await(await fetch(origin)).text();assert.ok(html.includes('id="root"'));const script=html.match(/src="([^"]+\.js)"/);assert.ok(script,'Built web script is referenced');const bundle=await fetch(new URL(script[1],origin+'/'));assert.equal(bundle.status,200);assert.ok((await bundle.text()).includes('render_game_to_text'));
 check('Container serves the built management UI and authoritative health endpoint');
 let cookie='';
 async function request(endpoint,body){
  const headers={Origin:origin};if(cookie)headers.Cookie=cookie;if(body){headers['Content-Type']='application/json';headers['Idempotency-Key']=randomUUID();}
  const response=await fetch(origin+endpoint,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([AbortSignal.timeout(15000),interruption.signal])});
  for(const value of response.headers.getSetCookie()){cookie=value.split(';')[0];secrets.push(cookie);}
  const data=await response.json();assert.equal(response.status,200,redact(`${endpoint}: ${JSON.stringify(data)}`));return data;
 }
 await request('/api/auth/register',{username:'container_smoke',password:accountPassword,name:'Container Smoke Corporation'});
 let state=await request('/api/state');const corporationId=state.corporation.id,rid=state.regions[0].id;
 const action=(type,extra={})=>request('/api/action',{type,regionId:rid,...extra});
 await action('facility.build',{facilityId:'tree_farm',quantity:1});
 state=await eventually(async()=>{const current=await request('/api/state');return current.stats.produced>0&&current.holdings[rid].inventory.wood>0?current:false;},{timeout:100000,interval:1500,label:'real unboosted factory production'});
 await action('facility.toggle',{id:state.holdings[rid].facilities[0].id});
 await request('/api/auth/logout',{});await request('/api/auth/login',{username:'container_smoke',password:accountPassword});
 state=await request('/api/state');assert.equal(state.corporation.id,corporationId);assert.equal(state.holdings[rid].facilities.length,1);
 check('Account registration and login work with reserved-character PG credentials; an unboosted corporation builds and produces real goods');
 await docker(['exec',names.app,'node','apps/server/src/admin.js','role','container_smoke','admin']);
 const security=await request('/api/account/security');assert.equal(security.isAdmin,true);const adminStatus=await request('/api/admin/status');assert.ok(Number(adminStatus.database.schemaVersion)>=2);assert.equal(adminStatus.accounts,1);
 check('Compiled administrator CLI grants a role and authenticated operations report the migrated schema and isolated account');
 const persisted={id:state.corporation.id,cash:state.corporation.cash,wood:state.holdings[rid].inventory.wood,facilityId:state.holdings[rid].facilities[0].id};
 await gracefulStop(names.app);await gracefulStop(names.database);await docker(['start',names.database]);await postgresReady();await docker(['start',names.app]);await health();
 state=await request('/api/state');assert.equal(state.corporation.id,persisted.id);assert.equal(state.corporation.cash,persisted.cash);assert.equal(state.holdings[rid].inventory.wood,persisted.wood);assert.equal(state.holdings[rid].facilities[0].id,persisted.facilityId);
 check('Graceful application and PostgreSQL restarts preserve the account, session, cash, inventory and factory');
 const beforeBackup=await request('/api/state'),backupFile='/app/.runtime/backups/container-smoke.json';
 await docker(['exec',names.app,'node','scripts/backup.mjs',backupFile]);
 const metadata=JSON.parse(await docker(['exec',names.app,'node','--input-type=module','-e',"import fs from 'node:fs';const b=JSON.parse(fs.readFileSync('/app/.runtime/backups/container-smoke.json','utf8'));console.log(JSON.stringify({format:b.format,version:b.version,accounts:b.tables.accounts.length,corporations:b.tables.corporations.length,recoveryCodes:Array.isArray(b.tables.recovery_codes)}));"]));
 assert.equal(metadata.format,'idlecorp-postgres-backup');assert.equal(metadata.version,2);assert.equal(metadata.accounts,1);assert.equal(metadata.corporations,1);assert.equal(metadata.recoveryCodes,true);
 await action('land.buy',{quantity:1});assert.equal((await request('/api/state')).holdings[rid].land,beforeBackup.holdings[rid].land+1);
 await gracefulStop(names.app);
 await docker(['run','--rm','--name',names.restore,'--label',label,'--network',names.network,'--env-file',appEnv,'--mount',`type=volume,source=${names.backups},target=/app/.runtime/backups`,image,'node','scripts/restore.mjs',backupFile,'--replace-world'],90000);
 await docker(['start',names.app]);await health();state=await request('/api/state');
 assert.equal(state.corporation.id,beforeBackup.corporation.id);assert.equal(state.corporation.cash,beforeBackup.corporation.cash);assert.equal(state.holdings[rid].land,beforeBackup.holdings[rid].land);assert.equal(state.holdings[rid].inventory.wood,beforeBackup.holdings[rid].inventory.wood);assert.equal((await request('/api/account/security')).isAdmin,true);
 check('Versioned backup and stopped-server restore through a one-off production container restore real cash, land, goods, sessions and administrator role');
 report.status='passed';
} catch(error){failure=error;report.status='failed';report.error=redact(error.stack||error.message);}
finally {
 cleaning=true;
 // Capture only this run's application log, never environment files or backup bodies.
 try {report.applicationLogTail=redact((await docker(['logs','--tail','35',names.app],10000)).slice(-12000));}catch{/* Application may not have started. */}
 for(const name of containers){try{await removeOwned('container',name);}catch(error){cleanupErrors.push(redact(error.message));}}
 for(const name of [names.backups,names.data]){try{await removeOwned('volume',name);}catch(error){cleanupErrors.push(redact(error.message));}}
 try{await removeOwned('network',names.network);}catch(error){cleanupErrors.push(redact(error.message));}
 for(const file of [appEnv,dbEnv]){try{await fs.unlink(file);}catch(error){if(error.code!=='ENOENT')cleanupErrors.push(error.message);}}
 try{await fs.rmdir(temporary);}catch(error){cleanupErrors.push(error.message);}
 report.cleanup={complete:cleanupErrors.length===0,errors:cleanupErrors};if(cleanupErrors.length){report.status='failed';failure??=new Error('Test resource cleanup failed; inspect the container report.');}
 await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 process.off('SIGINT',onInterrupt);process.off('SIGTERM',onInterrupt);
}
if(failure){console.error(redact(failure.message));console.error(`Container smoke report: ${reportPath}`);process.exitCode=1;}else console.log(`Container smoke passed (${passed.length} checks). Report: ${reportPath}`);
