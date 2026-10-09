import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { content,rules } from '../../../packages/rules/src/index.js';
import { getSnapshot,getPlan,migrate,performAction,pool,tick } from './database.js';
import { expansionRules, enhancementRules } from '../../../packages/rules/src/expansion.js';
import { GameError } from './types.js';
import { authenticate, registerAuth } from './auth.js';
import { recordTick, registerOperations } from './operations.js';
export { hashPassword } from './auth.js';

export async function buildApp(){
 const app=Fastify({logger:process.env.NODE_ENV!=='test',bodyLimit:32768,trustProxy:process.env.TRUST_PROXY==='true'});
 await app.register(cookie);await app.register(cors,{origin:(process.env.PUBLIC_ORIGIN||'http://localhost:5173,http://localhost:3001').split(','),credentials:true});await app.register(rateLimit,{max:180,timeWindow:'1 minute',allowList:req=>!req.url.startsWith('/api/')});
 app.addHook('onRequest',async(req,reply)=>{reply.header('X-Content-Type-Options','nosniff');reply.header('Referrer-Policy','same-origin');reply.header('X-Frame-Options','DENY');if(req.url.startsWith('/api'))reply.header('Cache-Control','no-store');
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&req.headers.origin){const allowed=(process.env.PUBLIC_ORIGIN||'http://localhost:5173,http://localhost:3001').split(',');if(!allowed.includes(req.headers.origin))throw new GameError('This origin is not allowed.',403);}
 });
 app.setErrorHandler((error,req,reply)=>{const e=error as Error & {statusCode?:number;code?:string};if(e.statusCode&&e.statusCode<500)return reply.code(e.statusCode).send({error:e.message});if(e.code==='23505')return reply.code(409).send({error:'This username is already registered.'});req.log.error(error);return reply.code(500).send({error:'The server could not complete the request. No economic changes were committed.'});});
 await registerAuth(app);await registerOperations(app);
 async function account(req:any){return (await authenticate(req)).accountId;}
 app.get('/api/health',async()=>{await pool.query('SELECT 1');return {ok:true,protocol:1,ruleset:rules.version,database:'postgresql'};});
 app.get('/api/content',async()=>({...content,expansionRules,enhancementRules,protocol:1}));
 app.get('/api/state',async req=>getSnapshot(await account(req)));
 app.get('/api/plan',async req=>{const a=req.query as any;if(a.regionId!==undefined&&typeof a.regionId!=='string'||a.facilityId!==undefined&&typeof a.facilityId!=='string'||a.quantity!==undefined&&typeof a.quantity!=='string')throw new GameError('Invalid planner query.');return getPlan(await account(req),{regionId:a.regionId,facilityId:a.facilityId,quantity:a.quantity===undefined?undefined:Number(a.quantity)});});
 const subscribers=new Set<any>();function publish(revision:number){for(const response of subscribers){if(!response.destroyed)response.write(`event: revision\ndata: ${JSON.stringify({revision})}\n\n`);}}
 app.post('/api/action',async(req)=>{const id=await account(req),key=req.headers['idempotency-key'];if(typeof key!=='string'||key.length<8||key.length>128)throw new GameError('Supply an Idempotency-Key of 8–128 characters.');if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))throw new GameError('Expected an action object.');const result=await performAction(id,key,req.body as any);publish(result.revision);return result;});
 app.get('/api/events',async(req,reply)=>{await account(req);reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});reply.raw.write('event: connected\ndata: {"protocol":1}\n\n');subscribers.add(reply.raw);req.raw.on('close',()=>subscribers.delete(reply.raw));});
 const heartbeat=setInterval(()=>{for(const s of subscribers)s.write(': heartbeat\n\n');},25000);heartbeat.unref();
 let running=false;const timer=setInterval(async()=>{if(running)return;running=true;const started=Date.now();try{const result=await tick();recordTick(Date.now(),Date.now()-started);if(result.events)publish(result.revision);}catch(e){recordTick(Date.now(),Date.now()-started,e);app.log.error(e);}finally{running=false;}},2000);timer.unref();
 app.addHook('onClose',async()=>{clearInterval(timer);clearInterval(heartbeat);for(const s of subscribers)s.end();});
 const dist=fileURLToPath(new URL('../../web/dist',import.meta.url));if(existsSync(dist)){await app.register(staticPlugin,{root:dist,prefix:'/'});app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api')?reply.code(404).send({error:'API route not found.'}):reply.sendFile('index.html'));}
 return app;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){await migrate();const app=await buildApp();await app.listen({port:Number(process.env.PORT||3001),host:process.env.HOST||'0.0.0.0'});for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,async()=>{await app.close();await pool.end();process.exit(0);});}
