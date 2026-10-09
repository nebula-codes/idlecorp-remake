import { pool, transaction, loadGame, saveGame } from './database.js';
import { advance } from './engine.js';
import { runBackup } from './operations.js';
const [command,username,value]=process.argv.slice(2);
const usage='Usage: admin entitlement USERNAME free|plus|gold|platinum; admin role USERNAME admin|player; admin expansion on|off; admin backup';
try {
 if(command==='backup') {const result=await runBackup('administrator-cli');console.log(`Backup saved: ${result.name}`);}
 else if(command==='expansion'&&['on','off'].includes(username||'')) {
  await transaction(async db=>{const game=await loadGame(db);advance(game,Date.now());const previous=(game.world as any).expansionEnabled===true;(game.world as any).expansionEnabled=username==='on';game.world.revision++;await saveGame(db,game);await db.query('INSERT INTO economic_audit(action,payload,changes,revision) VALUES($1,$2,$3,$4)',['admin.expansion',JSON.stringify({enabled:username==='on'}),JSON.stringify({previous,next:username==='on'}),game.world.revision]);});console.log(`Expansion ${username==='on'?'enabled':'disabled'}. Existing obligations can still settle.`);
 } else if(command==='role'&&username&&['admin','player'].includes(value||'')) {
  await transaction(async db=>{const result=await db.query('SELECT id,is_admin FROM accounts WHERE username=$1 FOR UPDATE',[username.toLowerCase()]);if(!result.rowCount)throw new Error('Account not found');await db.query('UPDATE accounts SET is_admin=$1 WHERE id=$2',[value==='admin',result.rows[0].id]);const game=await loadGame(db);game.world.revision++;await saveGame(db,game);await db.query('INSERT INTO economic_audit(account_id,action,payload,changes,revision) VALUES($1,$2,$3,$4,$5)',[result.rows[0].id,'admin.role',JSON.stringify({username:username.toLowerCase(),role:value}),JSON.stringify({previous:result.rows[0].is_admin,next:value==='admin'}),game.world.revision]);});console.log(`Role for ${username}: ${value}`);
 } else if(command==='entitlement'&&username&&['free','plus','gold','platinum'].includes(value||'')) {
  await transaction(async db=>{const result=await db.query('SELECT id FROM accounts WHERE username=$1',[username.toLowerCase()]);if(!result.rowCount)throw new Error('Account not found');const game=await loadGame(db),c=game.corps.find(c=>c.id===result.rows[0].id);if(!c)throw new Error('Corporation not found');advance(game,Date.now());const previous=c.entitlement;c.entitlement=value!;game.world.revision++;await saveGame(db,game);await db.query('INSERT INTO economic_audit(account_id,action,payload,changes,revision) VALUES($1,$2,$3,$4,$5)',[c.id,'admin.entitlement',JSON.stringify({username:username.toLowerCase(),tier:value}),JSON.stringify({previous,next:value}),game.world.revision]);});console.log(`Entitlement for ${username}: ${value}`);
 } else throw new Error(usage);
} catch(error) {console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
finally {await pool.end();}
