import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const destination=path.resolve(process.argv[2]||path.join(process.env.BACKUP_DIR||'artifacts',`idlecorp-${new Date().toISOString().replaceAll(':','-')}.json`));
const db=new pg.Client({connectionString:process.env.DATABASE_URL||(process.env.PGHOST?undefined:'postgres://idlecorp:idlecorp@localhost:5432/idlecorp')});
const tables=['schema_migrations','accounts','corporations','world','sessions','idempotency','economic_audit'];
await db.connect();
try{
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 if((await db.query("SELECT to_regclass('public.recovery_codes') AS name")).rows[0].name)tables.push('recovery_codes');
 const backup={format:'idlecorp-postgres-backup',version:2,createdAt:new Date().toISOString(),tables:{}};
 for(const table of tables)backup.tables[table]=(await db.query(`SELECT * FROM ${table}`)).rows;
 await db.query('COMMIT');fs.mkdirSync(path.dirname(destination),{recursive:true});const temporary=destination+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temporary,JSON.stringify(backup),{mode:0o600});fs.renameSync(temporary,destination);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}console.log(`Consistent application backup saved: ${destination}`);
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
