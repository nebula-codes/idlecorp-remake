import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { testServer } from './test-support.mjs';
const source=process.argv[2]||'artifacts/before-enhancements.json';
const original=JSON.parse(fs.readFileSync(source,'utf8'));
const server=await testServer('upgrade_clone',3020);
try{
 await server.stop();
 const restore=spawnSync(process.execPath,['scripts/restore.mjs',source,'--replace-world'],{encoding:'utf8',windowsHide:true,env:{...process.env,DATABASE_URL:server.databaseUrl}});assert.equal(restore.status,0,restore.stdout+restore.stderr);
 const migration=spawnSync(process.execPath,['--import','tsx','apps/server/src/migrate.ts'],{encoding:'utf8',windowsHide:true,env:{...process.env,DATABASE_URL:server.databaseUrl,NODE_ENV:'test'}});assert.equal(migration.status,0,migration.stdout+migration.stderr);
 const accounts=(await server.query('SELECT * FROM accounts')).rows,corps=(await server.query('SELECT id,state FROM corporations')).rows,sessions=(await server.query('SELECT token_hash,account_id,id FROM sessions')).rows;
 assert.equal(accounts.length,original.tables.accounts.length);assert.equal(corps.length,original.tables.corporations.length);assert.equal(sessions.length,original.tables.sessions.length);
 for(const old of original.tables.corporations)assert.deepEqual(corps.find(c=>c.id===old.id).state,old.state);
 for(const old of original.tables.accounts){const migrated=accounts.find(a=>a.id===old.id);assert.equal(migrated.password_hash,old.password_hash);assert.equal(migrated.is_admin,false);}
 assert.equal(new Set(sessions.map(s=>s.id)).size,sessions.length);for(const old of original.tables.sessions)assert.ok(sessions.some(s=>s.token_hash===old.token_hash&&s.account_id===old.account_id));
 assert.equal((await server.query('SELECT max(version)::int AS version FROM schema_migrations')).rows[0].version,2);
 await server.start();assert.equal((await(await fetch(server.origin+'/api/health')).json()).ok,true);
 const report={date:new Date().toISOString(),sourceFormatVersion:original.version,accountsPreserved:accounts.length,corporationsPreserved:corps.length,sessionsPreserved:sessions.length,economyUnchangedByMigration:true,existingPasswordHashesAndSessionTokensPreserved:true,allAdminRolesDefaultFalse:true,upgradedServerHealthy:true,scope:'A private copy of the pre-enhancement backup was restored only into a unique temporary database, verified, then dropped. No live save was restored or replaced.'};
 fs.writeFileSync('artifacts/upgrade-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await server.close();}
