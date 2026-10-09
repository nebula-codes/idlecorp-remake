import pg from 'pg';
import fs from 'node:fs';
if(!(process.env.DATABASE_URL||(process.env.PGHOST&&process.env.PGDATABASE&&process.env.PGUSER))||!process.argv.includes('--replace-world')||!process.argv[2])throw new Error('Stop the game server, set DATABASE_URL or PGHOST/PGDATABASE/PGUSER to the verified target, then run node scripts/restore.mjs backup.json --replace-world. This replaces all application data.');
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const tables=['schema_migrations','accounts','corporations','world','sessions','idempotency','economic_audit'];
if(data.format!=='idlecorp-postgres-backup'||![1,2].includes(data.version)||tables.some(t=>!Array.isArray(data.tables?.[t])))throw new Error('Invalid backup format');
if(data.version===2&&data.tables.recovery_codes!==undefined&&!Array.isArray(data.tables.recovery_codes))throw new Error('Invalid recovery-code backup');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{
 await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(19014349)');
 if((await db.query("SELECT to_regclass('public.recovery_codes') AS name")).rows[0].name){tables.push('recovery_codes');data.tables.recovery_codes||=[];}
 await db.query(`TRUNCATE ${tables.join(',')} RESTART IDENTITY CASCADE`);
 for(const table of tables){const allowed=new Set((await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1',[table])).rows.map(r=>r.column_name));for(const row of data.tables[table]){const keys=Object.keys(row);if(!keys.length||keys.some(k=>!allowed.has(k)))throw new Error('Backup has unknown columns');const values=keys.map(k=>row[k]!==null&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]);await db.query(`INSERT INTO ${table} (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,values);}}
 await db.query("SELECT setval(pg_get_serial_sequence('economic_audit','id'),COALESCE((SELECT max(id) FROM economic_audit),1),EXISTS(SELECT 1 FROM economic_audit))");await db.query('COMMIT');console.log('Application world restored successfully.');
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
