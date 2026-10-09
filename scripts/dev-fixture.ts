import { randomUUID } from 'node:crypto';
import { facilities, rules, technologies } from '../packages/rules/src/index.js';
if(process.env.NODE_ENV==='production'||process.env.ALLOW_DEV_TOOLS!=='1')throw new Error('Development-only: set ALLOW_DEV_TOOLS=1 explicitly, and never run against a production world.');
const {loadGame,pool,saveGame,transaction}=await import('../apps/server/src/database.js');
const {advance,createCorp,cycleMs}=await import('../apps/server/src/engine.js');
const [mode,who,value]=process.argv.slice(2);
try{
 await transaction(async db=>{
  const game=await loadGame(db),now=Date.now();advance(game,now);
  if(mode==='seed'){
   if(!['early','mid','late'].includes(value||''))throw new Error('Usage: seed USERNAME early|mid|late');
   const account=await db.query('SELECT id FROM accounts WHERE username=$1',[who]);const id=account.rows[0]?.id;const index=game.corps.findIndex(c=>c.id===id);if(index<0)throw new Error('Create this account normally first.');
   const previous=game.corps[index],c=createCorp(id,previous.name,now,game.world);c.motto='Explicit development progression fixture';
   const region=game.world.regions[0],h=c.holdings[region.id];
   const names=value==='early'?['tree_farm','coal_mine','iron_mine','steel_mill']:value==='mid'?['tree_farm','logistics_center','research_facility','hq','retail_store','customer_support_center']:facilities.map(f=>f.id);
   c.cash=value==='early'?rules.starterCash:2_000_000_000_000;h.land=value==='early'?10:100;
   for(const type of names){const d=facilities.find(f=>f.id===type)!;const f={id:randomUUID(),type,level:0,xp:0,nextCycle:now+d.cycleSeconds*1000,enabled:true,plus:true,allowPlus:false,installed:[],costPaid:d.cost,materialsPaid:{...d.materials},builtAt:now};f.nextCycle=now+cycleMs(f,c,region);h.facilities.push(f);if(value!=='early')for(const[id,q]of Object.entries({...d.materials,...d.inputs}))h.inventory[id]=Math.max(h.inventory[id]||0,q*2);}
   if(value!=='early'){Object.assign(h.inventory,{energy:5_000_000,energy_plus:1_000_000,wood:5000,gasoline:5000,truck:10,rocket:10,rocket_fuel:10000,space_station_parts:20000,galactic_coordinate_i:5});c.gratitude=20;c.tokens=20;h.blueprints=Object.fromEntries(technologies.map(t=>[t.id,10]));for(const t of technologies)h.inventory['blueprint_'+t.id]=10;}
   c.activity=[{id:randomUUID(),at:now,kind:'development',text:`Development ${value} progression fixture created. This is not an earned production state.`}];game.corps[index]=c;
  }else if(mode==='advance'){
   const seconds=Number(who);if(!Number.isInteger(seconds)||seconds<1||seconds>604800)throw new Error('Usage: advance SECONDS (1 to 604800)');const offset=seconds*1000;
   function rebase(object:any){if(!object||typeof object!=='object')return;for(const[key,val]of Object.entries(object)){if(typeof val==='number'&&val>1_000_000_000_000&&(/At$|Until$/.test(key)||['at','nextCycle','nextSale','lastProcessed','nextUpdate','lastPrestige'].includes(key)))object[key]=val-offset;else if(val&&typeof val==='object'&&key!=='season')rebase(val);}}
   for(const c of game.corps)rebase(c);for(const r of game.world.regions)rebase(r);advance(game,now);
  }else throw new Error('Usage: seed USERNAME early|mid|late, or advance SECONDS');
  game.world.revision++;await saveGame(db,game);await db.query('INSERT INTO economic_audit(action,payload,changes,revision) VALUES($1,$2,$3,$4)',['development.fixture',JSON.stringify({mode,who,value}),JSON.stringify({explicitDevelopmentFixture:true}),game.world.revision]);
 });console.log('Development fixture committed. Refresh clients to load the authoritative snapshot.');
}finally{await pool.end();}
