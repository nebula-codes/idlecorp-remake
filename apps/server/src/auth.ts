import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { createCorp } from './engine.js';
import { loadGame, pool, transaction } from './database.js';
import { GameError } from './types.js';

const scrypt=promisify(scryptCallback);
const sessionSeconds=60*60*24*30;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const codeDigest=(value:string)=>digest(value.toUpperCase().replace(/[\s-]/g,''));
export function validatePassword(value:unknown):asserts value is string {
 if(typeof value!=='string'||value.length<10||value.length>128)throw new GameError('Password must contain 10–128 characters.');
}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64) as Buffer).toString('hex')}`;}
async function verifyPassword(password:unknown,stored:string){if(typeof password!=='string'||password.length>128)return false;const [salt,key]=stored.split(':');const derived=await scrypt(password,salt!,64) as Buffer;const expected=Buffer.from(key!,'hex');return derived.length===expected.length&&timingSafeEqual(derived,expected);}
export interface Principal {accountId:string;sessionHash:string;sessionId:string;username:string;isAdmin:boolean;}
export async function authenticate(req:FastifyRequest):Promise<Principal>{
 const token=req.cookies.idlecorp_session;if(!token)throw new GameError('Sign in to continue.',401);
 const sessionHash=digest(token);const found=await pool.query('SELECT s.id,s.account_id,a.username,a.is_admin FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now()',[sessionHash]);
 if(!found.rowCount)throw new GameError('Your session expired. Sign in again.',401);
 await pool.query("UPDATE sessions SET last_seen_at=now() WHERE token_hash=$1 AND last_seen_at<now()-interval '1 minute'",[sessionHash]);
 const row=found.rows[0];return {accountId:row.account_id,sessionHash,sessionId:row.id,username:row.username,isAdmin:row.is_admin};
}
export async function requireAdmin(req:FastifyRequest){const identity=await authenticate(req);if(!identity.isAdmin)throw new GameError('Administrator access is required.',403);return identity;}
export async function requirePassword(db:PoolClient,accountId:string,password:unknown){
 const row=await db.query('SELECT password_hash FROM accounts WHERE id=$1 FOR UPDATE',[accountId]);
 if(!row.rowCount||!await verifyPassword(password,row.rows[0].password_hash))throw new GameError('Your current password is incorrect.',403);
}
export async function securityAudit(db:PoolClient,id:string,action:string,changes:unknown){
 await db.query("INSERT INTO economic_audit(account_id,action,payload,changes,revision) SELECT $1,$2,'{}'::jsonb,$3,COALESCE((state->>'revision')::bigint,0) FROM world WHERE id=1",[id,action,JSON.stringify(changes)]);
}
function sessionLabel(req:FastifyRequest){const ua=String(req.headers['user-agent']||'');const browser=ua.includes('Firefox')?'Firefox':ua.includes('Edg/')?'Edge':ua.includes('Chrome')?'Chrome':ua.includes('Safari')?'Safari':'Desktop / API client';const os=ua.includes('Windows')?'Windows':ua.includes('Android')?'Android':ua.includes('iPhone')?'iPhone':ua.includes('Mac')?'macOS':ua.includes('Linux')?'Linux':'';return browser+(os?' on '+os:'');}
async function createSession(req:FastifyRequest,id:string,db:PoolClient){
 const token=randomBytes(32).toString('base64url');await db.query("INSERT INTO sessions(token_hash,account_id,expires_at,label) VALUES($1,$2,now()+interval '30 days',$3)",[digest(token),id,sessionLabel(req)]);return token;
}
function setSessionCookie(reply:FastifyReply,token:string){
 const secure=process.env.COOKIE_SECURE!==undefined?process.env.COOKIE_SECURE==='true':process.env.NODE_ENV==='production'||(process.env.PUBLIC_ORIGIN||'').startsWith('https:');
 reply.setCookie('idlecorp_session',token,{path:'/',httpOnly:true,sameSite:'lax',secure,maxAge:sessionSeconds});
}
export async function registerAuth(app:FastifyInstance){
 app.post('/api/auth/register',{config:{rateLimit:{max:8,timeWindow:'1 minute'}}},async(req,reply)=>{
  const a=req.body as any;if(!a||typeof a.username!=='string'||!/^[a-zA-Z0-9_]{3,32}$/.test(a.username))throw new GameError('Username must be 3–32 letters, numbers or underscores.');validatePassword(a.password);if(typeof a.name!=='string'||!a.name.trim()||a.name.trim().length>48)throw new GameError('Corporation name must contain 1–48 characters.');
  const id=randomUUID(),passwordHash=await hashPassword(a.password);const token=await transaction(async db=>{const game=await loadGame(db);await db.query('INSERT INTO accounts(id,username,password_hash) VALUES($1,$2,$3)',[id,a.username.toLowerCase(),passwordHash]);const corp=createCorp(id,a.name.trim(),Date.now(),game.world);await db.query('INSERT INTO corporations(id,state) VALUES($1,$2)',[id,JSON.stringify(corp)]);return createSession(req,id,db);});setSessionCookie(reply,token);return {ok:true};
 });
 app.post('/api/auth/login',{config:{rateLimit:{max:12,timeWindow:'1 minute'}}},async(req,reply)=>{
  const a=req.body as any;if(!a||typeof a.username!=='string'||typeof a.password!=='string'||a.password.length>128)throw new GameError('Enter a username and password.');const token=await transaction(async db=>{const result=await db.query('SELECT id,password_hash FROM accounts WHERE username=$1 FOR UPDATE',[a.username.toLowerCase()]);if(!result.rowCount||!await verifyPassword(a.password,result.rows[0].password_hash))throw new GameError('Username or password is incorrect.',401);return createSession(req,result.rows[0].id,db);});setSessionCookie(reply,token);return {ok:true};
 });
 app.post('/api/auth/logout',async(req,reply)=>{if(req.cookies.idlecorp_session)await pool.query('DELETE FROM sessions WHERE token_hash=$1',[digest(req.cookies.idlecorp_session)]);reply.clearCookie('idlecorp_session',{path:'/'});return {ok:true};});
 app.get('/api/account/security',async req=>{
  const identity=await authenticate(req);const sessions=await pool.query('SELECT id,label,created_at,last_seen_at,expires_at FROM sessions WHERE account_id=$1 AND expires_at>now() ORDER BY created_at DESC',[identity.accountId]);
  const codes=await pool.query('SELECT count(*)::int AS count FROM recovery_codes WHERE account_id=$1',[identity.accountId]);
  return {username:identity.username,isAdmin:identity.isAdmin,recoveryCodesRemaining:codes.rows[0].count,sessions:sessions.rows.map(row=>({id:row.id,label:row.label,current:row.id===identity.sessionId,createdAt:row.created_at.getTime(),lastSeenAt:row.last_seen_at.getTime(),expiresAt:row.expires_at.getTime()}))};
 });
 app.post('/api/account/recovery-codes',{config:{rateLimit:{max:4,timeWindow:'1 minute'}}},async req=>{
  const identity=await authenticate(req);const a=req.body as any;return transaction(async db=>{
   await requirePassword(db,identity.accountId,a?.password);const codes=Array.from({length:8},()=>randomBytes(16).toString('hex').toUpperCase().match(/.{8}/g)!.join('-'));
   await db.query('DELETE FROM recovery_codes WHERE account_id=$1',[identity.accountId]);for(const code of codes)await db.query('INSERT INTO recovery_codes(account_id,code_hash) VALUES($1,$2)',[identity.accountId,codeDigest(code)]);
   await securityAudit(db,identity.accountId,'account.recovery_codes',{rotated:true,count:codes.length});return {codes};
  });
 });
 app.post('/api/auth/recover',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async req=>{
  const a=req.body as any;if(!a||typeof a.username!=='string'||typeof a.code!=='string'||a.code.length>80)throw new GameError('Enter your username and recovery code.');validatePassword(a.password);
  const passwordHash=await hashPassword(a.password);await transaction(async db=>{
   const row=await db.query('SELECT id FROM accounts WHERE username=$1 FOR UPDATE',[a.username.toLowerCase()]);if(!row.rowCount)throw new GameError('Username or recovery code is incorrect.',403);const id=row.rows[0].id;
   const used=await db.query('DELETE FROM recovery_codes WHERE account_id=$1 AND code_hash=$2 RETURNING account_id',[id,codeDigest(a.code)]);if(!used.rowCount)throw new GameError('Username or recovery code is incorrect.',403);
   await db.query('UPDATE accounts SET password_hash=$1 WHERE id=$2',[passwordHash,id]);await db.query('DELETE FROM sessions WHERE account_id=$1',[id]);await securityAudit(db,id,'account.recovered',{sessionsRevoked:true,codeConsumed:true});
  });return {ok:true};
 });
 app.post('/api/account/password',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async req=>{
  const identity=await authenticate(req),a=req.body as any;validatePassword(a?.newPassword);const passwordHash=await hashPassword(a.newPassword);
  await transaction(async db=>{await requirePassword(db,identity.accountId,a.currentPassword);await db.query('UPDATE accounts SET password_hash=$1 WHERE id=$2',[passwordHash,identity.accountId]);await db.query('DELETE FROM sessions WHERE account_id=$1 AND token_hash<>$2',[identity.accountId,identity.sessionHash]);await securityAudit(db,identity.accountId,'account.password_changed',{otherSessionsRevoked:true});});return {ok:true};
 });
 app.post('/api/account/sessions/revoke',async(req,reply)=>{
  const identity=await authenticate(req),a=req.body as any;if(a?.others!==true&&(typeof a?.id!=='string'||!/^[\da-f-]{36}$/i.test(a.id)))throw new GameError('Choose a session to revoke.');
  const current=a.id===identity.sessionId&&a.others!==true;await transaction(async db=>{
   const result=a.others===true?await db.query('DELETE FROM sessions WHERE account_id=$1 AND token_hash<>$2',[identity.accountId,identity.sessionHash]):await db.query('DELETE FROM sessions WHERE account_id=$1 AND id=$2',[identity.accountId,a.id]);
   if(a.others!==true&&!result.rowCount)throw new GameError('Session not found.',404);await securityAudit(db,identity.accountId,'account.sessions_revoked',{count:result.rowCount});
  });if(current)reply.clearCookie('idlecorp_session',{path:'/'});return {ok:true,currentRevoked:current};
 });
}
