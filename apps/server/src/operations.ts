import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { pool, transaction, loadGame, saveGame } from './database.js';
import { requireAdmin, requirePassword, securityAudit } from './auth.js';
import { advance } from './engine.js';
import { GameError } from './types.js';

const startedAt=Date.now();
const backupPattern=/^idlecorp-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9]{8}\.json$/;
let pending:Promise<any>|null=null;
let lastTick:{at:number;durationMs:number;error:string|null}|null=null;
let lastFailure:string|null=null;
function boundedConfig(value:string|undefined,fallback:number,min:number,max:number){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;}
function configuration(){return {enabled:process.env.BACKUP_ENABLED!==undefined?process.env.BACKUP_ENABLED==='true':process.env.NODE_ENV!=='test',directory:path.resolve(process.env.BACKUP_DIR||'.runtime/backups'),intervalHours:boundedConfig(process.env.BACKUP_INTERVAL_HOURS,24,1,168),retention:Math.floor(boundedConfig(process.env.BACKUP_RETENTION,7,1,90))};}
export function recordTick(at:number,durationMs:number,error?:unknown){lastTick={at,durationMs,error:error?'The simulation update failed; inspect server logs.':null};}
async function manifest(){try{return JSON.parse(await fs.readFile(path.join(configuration().directory,'status.json'),'utf8'));}catch{return {lastSuccess:null,lastAttempt:null,lastError:null};}}
async function writeManifest(data:any){const directory=configuration().directory;await fs.mkdir(directory,{recursive:true});const dest=path.join(directory,'status.json'),temp=dest+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,dest);}
async function listBackups(){const directory=configuration().directory;let names:string[]=[];try{names=(await fs.readdir(directory)).filter(name=>backupPattern.test(name));}catch{/* No backup yet. */}const found=await Promise.all(names.map(async name=>{try{const info=await fs.stat(path.join(directory,name));return {name,bytes:info.size,createdAt:info.mtimeMs};}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}));return found.filter((item):item is NonNullable<typeof item>=>item!==null).sort((a,b)=>b.createdAt-a.createdAt);}
export async function backupStatus(){const config=configuration(),saved=await manifest();return {...saved,enabled:config.enabled,intervalHours:config.intervalHours,retention:config.retention,running:!!pending,lastError:lastFailure||saved.lastError,files:await listBackups(),nextRunAt:config.enabled?(saved.lastSuccess||0)+config.intervalHours*3600000:null};}
export function runBackup(reason='manual',scheduledNow=Date.now()):Promise<any>{
 if(pending)return pending.then(result=>result.skipped&&reason!=='scheduled'?runBackup(reason):result);
 pending=(async()=>{
  const config=configuration(),attempt=Date.now();const db=await pool.connect();let previous:any={},locked=false;
  try{
   await db.query('SELECT pg_advisory_lock(19014350)');locked=true;previous=await manifest();
   if(reason==='scheduled'){const last=Math.max(Number(previous.lastSuccess||0),Number(previous.lastAttempt||0));const delay=previous.lastError?Math.min(config.intervalHours*3600000,3600000):config.intervalHours*3600000;if(!config.enabled||scheduledNow-last<delay)return {skipped:true};}
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const tables:Record<string,unknown[]>={};for(const table of ['schema_migrations','accounts','corporations','world','sessions','idempotency','economic_audit','recovery_codes'])tables[table]=(await db.query(`SELECT * FROM ${table}`)).rows;
   await db.query('COMMIT');
   const name=`idlecorp-${new Date(attempt).toISOString().replaceAll(':','-').replace('.','-')}-${randomUUID().slice(0,8)}.json`;
   await fs.mkdir(config.directory,{recursive:true});const destination=path.join(config.directory,name),temporary=destination+'.tmp';
   await fs.writeFile(temporary,JSON.stringify({format:'idlecorp-postgres-backup',version:2,createdAt:new Date(attempt).toISOString(),tables}),{mode:0o600});await fs.rename(temporary,destination);
   const files=await listBackups();for(const old of files.slice(config.retention))await fs.unlink(path.join(config.directory,old.name));
   const result={lastSuccess:attempt,lastAttempt:attempt,lastError:null,reason,name};await writeManifest(result);lastFailure=null;return result;
  }catch(error){await db.query('ROLLBACK').catch(()=>{});lastFailure='Backup failed. Inspect server logs and the configured backup directory.';await writeManifest({...previous,lastAttempt:attempt,lastError:lastFailure}).catch(()=>{});throw error;}finally{if(locked)await db.query('SELECT pg_advisory_unlock(19014350)').catch(()=>{});db.release();}
 })().finally(()=>{pending=null;});return pending;
}
export async function runScheduledBackup(now=Date.now()){
 const config=configuration();if(!config.enabled||pending)return false;const saved=await manifest();
 const last=Math.max(Number(saved.lastSuccess||0),Number(saved.lastAttempt||0));
 const delay=saved.lastError?Math.min(config.intervalHours*3600000,3600000):config.intervalHours*3600000;
 if(now-last<delay)return false;const result=await runBackup('scheduled',now);return !result.skipped;
}
export function scheduleBackups(app:FastifyInstance){
 const attempt=()=>{void runScheduledBackup().catch(error=>app.log.error(error,'Scheduled backup failed'));};
 const first=setTimeout(attempt,5000);first.unref();const timer=setInterval(attempt,60000);timer.unref();
 app.addHook('onClose',async()=>{clearTimeout(first);clearInterval(timer);await pending?.catch(()=>{});});
}
export async function registerOperations(app:FastifyInstance){
 app.get('/api/admin/status',async req=>{
  await requireAdmin(req);const began=Date.now();const result=await pool.query("SELECT (SELECT count(*)::int FROM accounts) AS accounts,(SELECT count(*)::int FROM corporations) AS corporations,(SELECT count(*)::int FROM sessions WHERE expires_at>now()) AS sessions,(SELECT count(*)::int FROM sessions WHERE expires_at>now() AND last_seen_at>now()-interval '10 minutes') AS active_sessions,(SELECT max(version) FROM schema_migrations) AS schema_version,current_setting('server_version') AS postgres_version");
  const world=await pool.query('SELECT state FROM world WHERE id=1'),saved=world.rows[0].state;
  return {serverTime:Date.now(),uptimeMs:Date.now()-startedAt,database:{ok:true,latencyMs:Date.now()-began,version:result.rows[0].postgres_version,schemaVersion:result.rows[0].schema_version},accounts:result.rows[0].accounts,corporations:result.rows[0].corporations,sessions:result.rows[0].sessions,activeSessions:result.rows[0].active_sessions,world:{revision:saved.revision,expansionEnabled:saved.expansionEnabled===true,regions:saved.regions.length,openOrders:saved.orders.filter((o:any)=>o.status==='open').length},worker:lastTick,backup:await backupStatus()};
 });
 app.post('/api/admin/backup',{config:{rateLimit:{max:3,timeWindow:'1 minute'}}},async req=>{
  const identity=await requireAdmin(req);await transaction(db=>requirePassword(db,identity.accountId,(req.body as any)?.password));const result=await runBackup('administrator');await transaction(db=>securityAudit(db,identity.accountId,'admin.backup',{name:result.name}));return {ok:true,backup:await backupStatus()};
 });
 app.post('/api/admin/expansion',async req=>{
  const identity=await requireAdmin(req),a=req.body as any;if(typeof a?.enabled!=='boolean')throw new GameError('Choose whether the expansion is enabled.');
  await transaction(async db=>{await requirePassword(db,identity.accountId,a.password);const game=await loadGame(db);advance(game,Date.now());const previous=(game.world as any).expansionEnabled===true;(game.world as any).expansionEnabled=a.enabled;game.world.revision++;await saveGame(db,game);await securityAudit(db,identity.accountId,'admin.expansion',{previous,enabled:a.enabled});});return {ok:true,enabled:a.enabled};
 });
 scheduleBackups(app);
}
