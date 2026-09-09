'use strict';
// Normal input loss/restart proof. Runtime evaluation is read-only telemetry.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const id='sentinel-maze',out=path.resolve(__dirname,'../rehabilitation-evidence/health-outcomes/'+id);fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 const report={id,inputOnly:true,startedAt:new Date().toISOString(),standaloneSHA256:crypto.createHash('sha256').update(fs.readFileSync('dist/games/'+id+'.html')).digest('hex'),events:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
 const read=()=>page.evaluate(()=>({sim:simElapsed,ended:gameEnded,health:window.__gameState,inventory:window.__gameInventory,pos:player?.entity.position,basis:app.camera.getBasis(),overlay:document.querySelector('#end-overlay').className,text:document.body.innerText,enemies:placed.filter(o=>o.entity?.ai&&!o.entity.destroyed).map(o=>({id:o.id,p:o.entity.position})),visibleHelpers:placed.filter(o=>(o.isTrigger||o.isWaypoint||o.isSpawnPoint)&&o.entity?.visible).map(o=>o.id)}));
 const save=()=>fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify(report,null,2)+'\n');
 async function shot(label){const s=await read();await page.screenshot({path:path.join(out,label+'.png')});report.events.push({capture:label,...s});save();console.log(label,JSON.stringify({sim:s.sim,h:s.health,p:s.pos,enemies:s.enemies,ended:s.ended,overlay:s.overlay}));return s;}
 async function waitSim(seconds){const start=(await read()).sim,wall=Date.now();while(Date.now()-wall<30000){await page.waitForTimeout(100);const s=await read();if(s.ended||s.sim-start>=seconds)return s;}throw Error('Simulation stalled');}
 async function key(keys,seconds){if(!Array.isArray(keys))keys=[keys];report.events.push({input:keys,seconds,sim:(await read()).sim});for(const k of keys)await page.keyboard.down(k);try{return await waitSim(seconds);}finally{for(const k of keys)await page.keyboard.up(k);}}
 async function moveTo(target,limit=18){const begin=(await read()).sim;let s=await read(),prev=s.pos,stalls=0;while(!s.ended&&s.sim-begin<limit){const dx=target[0]-s.pos.x,dz=target[1]-s.pos.z;if(Math.hypot(dx,dz)<.6)return s;const f=s.basis.forward,fl=Math.hypot(f.x,f.z),forward=(dx*f.x+dz*f.z)/fl,side=(dx*f.z-dz*f.x)/fl;const k=Math.abs(forward)>Math.abs(side)?(forward>0?'w':'s'):(side>0?'d':'a');const keys=[k];if(stalls>=3){keys.push('Space');stalls=0;}s=await key(keys,.16);stalls=Math.hypot(s.pos.x-prev.x,s.pos.z-prev.z)<.05?stalls+1:0;prev={...s.pos};}return s;}
 try{
  await page.goto('http://localhost:8837/dist/games/'+id+'.html',{waitUntil:'load'});await page.getByRole('button',{name:'Begin',exact:true}).click();await waitSim(.4);await shot('opening');
  await page.keyboard.down('c');
  for(const target of [[-2,-10.7],[5,-10.7],[10,-8],[10,3],[10,8],[9,9]]){await moveTo(target,15);if((await read()).ended)break;}
  await page.keyboard.up('c');report.win=await shot('normal-walking-goal');
  if(report.win.overlay==='win visible'){await page.getByRole('button',{name:'Restart',exact:true}).click();await page.waitForLoadState('load');await page.getByRole('button',{name:'Begin',exact:true}).click();await waitSim(.4);report.winRestart=await shot('win-restart');}
  let s=await waitSim(10);await shot('waiting-for-guardian');
  if(!s.ended&&s.health.health===100){await moveTo([-8,-1.5],8);await shot('guardian-approach');}
  let damaged=false;const begin=(await read()).sim;
  while(!(s=await read()).ended&&s.sim-begin<45){
   if(!damaged&&s.health.health<100){await shot('taking-damage');damaged=true;}
   // Waiting is a real no-defense trial. If navigation cannot reach this
   // side of the wall, approach its nearest live position with keyboard input.
   if(s.sim-begin>12&&s.health.health===100&&s.enemies[0])await moveTo([s.enemies[0].p.x,s.enemies[0].p.z],10);
   s=await waitSim(1);
  }
  report.final=await shot('outcome');
  if(report.final.overlay==='lose visible'){
   await page.getByRole('button',{name:'Restart',exact:true}).click();await page.waitForLoadState('load');await page.getByRole('button',{name:'Begin',exact:true}).click();await waitSim(.4);report.restart=await shot('restart');
  }
  report.pass=report.win?.overlay==='win visible'&&report.final.overlay==='lose visible'&&report.final.health.health===0&&report.restart?.health?.health===100&&!report.restart?.ended&&report.errors.length===0;
 }catch(e){report.failure=e.stack;await shot('failure').catch(()=>{});}
 report.finishedAt=new Date().toISOString();save();await context.close();await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
