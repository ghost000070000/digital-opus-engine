'use strict';
// Navigation and combat proof through real keyboard input only. Evaluation reads
// telemetry; it never moves players, grants items, alters AI or completes goals.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),suffix=process.argv[2]||'normal';
const out=path.join(root,'rehabilitation-evidence','playthroughs','relic-frontier-'+suffix);fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 const report={id:'relic-frontier',inputOnly:true,startedAt:new Date().toISOString(),standaloneSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/games/relic-frontier.html'))).digest('hex'),events:[],frames:[],errors:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 const read=()=>page.evaluate(()=>({sim:simElapsed,ended:gameEnded,frozen:playerFrozen,paused:app.paused,pos:player?.entity.position,forward:player?.entity.forward,basis:app.camera.getBasis(),state:window.__gameState,inventory:window.__gameInventory,objectives:window.__gameObjectives,text:document.body.innerText,overlay:document.querySelector('#end-overlay').className,equipment:Object.entries(playerEquipment).map(([slot,e])=>({slot,name:e.itemName,visible:e.entity?.visible,pos:e.entity?.position})),enemies:placed.filter(o=>o.entity?.ai&&!o.entity.destroyed).map(o=>({id:o.id,p:o.entity.position,health:o.health,ai:o.entity.ai.state,collider:o.collider})),objects:placed.filter(o=>['relic1','obj1001','obj1003','obj1004','platform1','ramp1'].includes(o.id)).map(o=>({id:o.id,p:o.entity.position,visible:o.entity.visible,destroyed:o.entity.destroyed,solid:o.entity.solid,scale:o.entity.scale})),helpers:placed.filter(o=>(o.isTrigger||o.isWaypoint||o.isSpawnPoint)&&o.entity?.visible).map(o=>o.id)}));
 const save=()=>fs.writeFileSync(path.join(out,'playtest.json'),JSON.stringify(report,null,2)+'\n');
 async function shot(label){const state=await read();await page.screenshot({path:path.join(out,label+'.png')});report.frames.push({label,...state});save();console.log(label,JSON.stringify({sim:state.sim,pos:state.pos,health:state.state,inventory:state.inventory,enemies:state.enemies,ended:state.ended}));return state;}
 async function waitSim(seconds){const s=await read(),wall=Date.now();while(Date.now()-wall<25000){await page.waitForTimeout(75);const n=await read();if(n.ended||n.sim-s.sim>=seconds)return n;}throw Error('Simulation stalled');}
 async function key(keys,seconds){if(!Array.isArray(keys))keys=[keys];const s=await read();report.events.push({input:keys,seconds,sim:s.sim,pos:s.pos});for(const k of keys)await page.keyboard.down(k);try{return await waitSim(seconds);}finally{for(const k of keys)await page.keyboard.up(k);}}
 function direction(s,target){const dx=target[0]-s.pos.x,dz=target[1]-s.pos.z,f=s.basis.forward,fl=Math.hypot(f.x,f.z)||1,forward=dx*f.x/fl+dz*f.z/fl,side=dx*f.z/fl-dz*f.x/fl;const keys=[];if(Math.abs(forward)>Math.abs(side)*.4)keys.push(forward>0?'w':'s');if(Math.abs(side)>Math.abs(forward)*.4)keys.push(side>0?'d':'a');return keys;}
 async function walk(target,label,maxSim=30,tolerance=.65){let s=await read(),begin=s.sim,previous=s.pos,stuck=0;while(!s.ended&&s.sim-begin<maxSim){const dist=Math.hypot(target[0]-s.pos.x,target[1]-s.pos.z);if(dist<tolerance){report.events.push({walk:label,reached:true,sim:s.sim,pos:s.pos});return true;}if(s.frozen){s=await waitSim(.2);continue;}const keys=direction(s,target);if(stuck>=4){keys.push('Space');stuck=0;}s=await key(keys,Math.min(.18,Math.max(.045,dist/24)));if(Math.hypot(s.pos.x-previous.x,s.pos.z-previous.z)<.045)stuck++;else stuck=0;previous={...s.pos};}report.events.push({walk:label,reached:false,sim:s.sim,pos:s.pos});await shot(label+'-blocked');return false;}
 async function combat(id,maxSim=23){let s=await read(),begin=s.sim,shots=0;while(!s.ended&&s.sim-begin<maxSim){if((s.state?.kills||0)>=1)break;const e=s.enemies.find(e=>e.id===id);if(!e||(e.health?.current??1)<=0)break;const distance=Math.hypot(e.p.x-s.pos.x,e.p.z-s.pos.z);await key(direction(s,[e.p.x,e.p.z]),distance>3?.18:.045);s=await key('q',.08);if(shots++%5===0)await shot('combat-'+id+'-'+shots);s=await waitSim(.34);}report.events.push({combat:id,shots,sim:s.sim,state:s.state,enemies:s.enemies});return s;}
 try{
  await page.goto('http://localhost:8837/dist/games/relic-frontier.html',{waitUntil:'load'});await shot('start');
  await page.getByRole('button',{name:'Begin journey',exact:true}).click();await waitSim(2.3);await shot('opening');
  await walk([0,0],'road');await walk([3,3],'rifle',20,.5);await shot('weapon-pickup');
  if(suffix.includes('appearance')){report.final=await read();report.captureOnly=true;report.finishedAt=new Date().toISOString();save();await context.close();await browser.close();return;}
  if(!suffix.includes('probe')){await walk([-3,6],'guardian-approach',18,1);await combat('obj1002');await shot('guardian-result');}
  if(!(await read()).ended){await page.keyboard.down('c');await walk([0,0],'ramp-entry',20,.35);await walk([2,0],'ramp-foot',20,.25);await shot('ramp-foot');await walk([4,0],'ramp-middle',12,.25);await shot('ramp-middle');await walk([6,0],'ramp-upper',12,.25);await shot('ramp-upper');await walk([8,0],'ridge-ramp',12,.25);await page.keyboard.up('c');await walk([10,0],'ridge-relic',15,.35);await shot('ridge-relic');}
  if(!(await read()).ended){await walk([4,9],'gate-approach',25,1);await walk([0,14],'border-gate',20,1);await shot('gate');await walk([0,20],'extraction',20,.65);await shot('extraction');}
  report.final=await read();
  if(report.final.ended){await page.getByRole('button',{name:'Restart',exact:true}).click();await page.waitForLoadState('load');await page.getByRole('button',{name:'Begin journey',exact:true}).click();await waitSim(2);report.restart=await shot('restart');}
 }catch(e){report.failure=e.stack;await shot('failure').catch(()=>{});}
 report.finishedAt=new Date().toISOString();save();await context.close();await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
