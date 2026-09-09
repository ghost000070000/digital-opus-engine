'use strict';

// Real-input standalone playtests. Evaluation is read-only instrumentation:
// no teleports, altered health, granted inventory, objective writes, disabled AI,
// patched timers, or artificial success transitions are permitted here.
const fs=require('fs');
const path=require('path');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'rehabilitation-evidence','combat-playtest');
const mode=process.argv[2]||'all';
const suffix=process.argv[3]||'normal';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const xyz=p=>[p.x,p.y,p.z];

async function read(page){return page.evaluate(()=>({
  title:document.title,text:document.body.innerText,sim:simElapsed,playtime:window.__gamePlaytimeSeconds,ended:gameEnded,paused:app.paused,
  overlay:{classes:document.querySelector('#end-overlay').className,title:document.querySelector('#end-overlay-title').textContent},
  state:window.__gameState,objectives:window.__gameObjectives,inventory:window.__gameInventory,
  player:player&&{position:player.entity.position,forward:player.entity.forward,visible:player.entity.visible,radius:player.radius},
  camera:{eye:app.camera.eye,target:app.camera.currentTarget,yaw:fpYaw,pitch:fpPitch,sensitivity:currentPlayerSettings.mouseSensitivity||.0022},
  pointerLocked:!!document.pointerLockElement,
  activeSlot:activeWeaponSlot,
  equipment:Object.entries(playerEquipment).map(([slot,e])=>({slot,name:e.itemName,entity:!!e.entity,visible:e.entity?.visible,destroyed:e.entity?.destroyed,position:e.entity?.position})),
  weaponRuntime:weaponRuntimeState,
  enemies:placed.filter(o=>o.entity?.ai&&!o.entity.destroyed).map(o=>({id:o.id,name:o.name,p:o.entity.position,health:o.health,tags:o.tags,solid:o.entity.solid,scale:o.entity.scale,state:o.entity.ai?.state})),
  interactables:placed.filter(o=>o.behaviors?.some(b=>b.trigger==='interact')).map(o=>({id:o.id,name:o.name,p:o.entity.position,variables:o.variables})),
  solids:placed.filter(o=>o.entity?.solid).map(o=>({id:o.id,name:o.name,p:o.entity.position,scale:o.entity.scale})),
  helpers:placed.filter(o=>o.isTrigger||o.isWaypoint||o.isSpawnPoint||o.kind==='camera'||o.kind==='spawner').filter(o=>o.entity?.visible).map(o=>o.id),
}));}

class Session{
  constructor(page,id){this.page=page;this.id=id;this.out=path.join(OUT,id+'-'+suffix);fs.mkdirSync(this.out,{recursive:true});this.report={id,method:'Native Playwright keyboard and mouse input; evaluate is read-only instrumentation.',startedAt:new Date().toISOString(),standaloneSHA256:require('crypto').createHash('sha256').update(fs.readFileSync(path.join(ROOT,'dist/games',id+'.html'))).digest('hex'),errors:[],actions:[],frames:[],observations:[]};this.mx=640;this.my=360;page.on('pageerror',e=>this.report.errors.push(e.message));}
  async snap(label){const s=await read(this.page);await this.page.screenshot({path:path.join(this.out,label+'.png')});this.report.frames.push({label,...s});console.log(this.id,label,JSON.stringify({sim:+s.sim.toFixed(2),health:s.state?.health,counters:s.state,p:s.player?.position,end:s.overlay.title,enemies:s.enemies.map(e=>[e.id,e.health?.current])}));this.save();return s;}
  save(){this.report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(this.out,'playtest.json'),JSON.stringify(this.report,null,2)+'\n');}
  async start(){const g=JSON.parse(fs.readFileSync(path.join(ROOT,'games',this.id+'.json'))),l=g.levels[g.startLevelIndex||0];await this.page.goto(`http://localhost:8837/dist/games/${this.id}.html`,{waitUntil:'load',timeout:60000});await this.page.waitForTimeout(350);await this.snap('start');await this.page.getByRole('button',{name:l.ui.startScreen.buttonText,exact:true}).click();await this.page.waitForTimeout(150);await this.page.mouse.move(this.mx,this.my);await this.page.mouse.click(this.mx,this.my);await this.waitSim(.4);return this.snap('opening');}
  async waitSim(seconds,wallLimit=20000){const start=await read(this.page),deadline=Date.now()+wallLimit;while(Date.now()<deadline){await this.page.waitForTimeout(120);const s=await read(this.page);if(s.ended||s.sim-start.sim>=seconds)return s;}throw new Error('Simulation did not advance '+seconds+' seconds within wall-time bound');}
  async key(key,seconds=.08){const before=await read(this.page);this.report.actions.push({kind:'key',key,seconds,sim:before.sim});await this.page.keyboard.down(key);try{return await this.waitSim(seconds);}finally{await this.page.keyboard.up(key);}}
  async aimAt(point,{camera=true,level=false}={}){
    let s=await read(this.page);if(s.ended)return s;
    if(!s.pointerLocked){await this.page.mouse.click(this.mx,this.my);await this.page.waitForTimeout(90);s=await read(this.page);}
    const origin=camera?s.camera.eye:s.player.position,dx=point[0]-origin.x,dz=point[2]-origin.z,dy=level?0:point[1]-origin.y;
    const yaw=Math.atan2(dx,dz),pitch=-Math.atan2(dy,Math.hypot(dx,dz));
    for(let k=0;k<3;k++){
      s=await read(this.page);const dyaw=wrap(yaw-s.camera.yaw),dpitch=pitch-s.camera.pitch;if(Math.abs(dyaw)<.006&&Math.abs(dpitch)<.006)break;
      const mx=-dyaw/s.camera.sensitivity,my=-dpitch/s.camera.sensitivity;
      this.mx+=mx;this.my+=my;await this.page.mouse.move(this.mx,this.my,{steps:1});await this.page.waitForTimeout(100);
    }
    const after=await read(this.page);this.report.actions.push({kind:'mouse-aim',point,from:camera?'camera-eye':'player-root',sim:after.sim,yawError:wrap(yaw-after.camera.yaw),pitchError:pitch-after.camera.pitch,pointerLocked:after.pointerLocked});
    if(Math.abs(wrap(yaw-after.camera.yaw))>.06||Math.abs(pitch-after.camera.pitch)>.06)throw new Error('Native mouse look did not reach intended aim; pointerLocked='+after.pointerLocked);
    return after;
  }
  async moveTo(x,z,{tolerance=.65,maxSeconds=12,combat=false}={}){
    let s=await read(this.page),begin=s.sim,stalls=0,lastDist=Infinity;
    for(let i=0;i<90;i++){
      s=await read(this.page);if(s.ended)return s;const p=s.player.position,d=Math.hypot(x-p.x,z-p.z);if(d<tolerance)return s;if(s.sim-begin>maxSeconds)break;
      if(combat&&i%4===0)await this.shootNearest(16,3);
      await this.aimAt([x,p.y,z],{level:true});
      const before=s.player.position;s=await this.key('w',Math.min(.42,Math.max(.08,(d-tolerance)/6.5)));
      const moved=Math.hypot(s.player.position.x-before.x,s.player.position.z-before.z);stalls=moved<.04?stalls+1:0;
      if(stalls>=3){this.report.observations.push({type:'collision-stop',destination:[x,z],position:s.player.position,sim:s.sim});await this.snap('collision-stop-'+this.report.observations.length);return s;}
      lastDist=d;
    }
    this.report.observations.push({type:'waypoint-not-reached',destination:[x,z],position:s.player.position,sim:s.sim});return s;
  }
  lineClear(s,e){const origin=s.camera.eye,delta=[e.p.x-origin.x,e.p.y-origin.y,e.p.z-origin.z],distance=Math.hypot(...delta),dir=delta.map(n=>n/distance);for(const b of s.solids){let lo=0,hi=distance;for(let j=0;j<3;j++){const axis=['x','y','z'][j],min=b.p[axis]-b.scale[axis]/2,max=b.p[axis]+b.scale[axis]/2;if(Math.abs(dir[j])<1e-7){if(origin[axis]<min||origin[axis]>max){hi=-1;break;}}else{const a=(min-origin[axis])/dir[j],c=(max-origin[axis])/dir[j];lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));}}if(hi>=lo&&lo<distance-.5&&hi>0)return false;}return true;}
  async shootNearest(maxDistance=30,rounds=8){let s=await read(this.page);const enemies=s.enemies.filter(e=>(e.health?.current??1)>0).sort((a,b)=>Math.hypot(a.p.x-s.player.position.x,a.p.z-s.player.position.z)-Math.hypot(b.p.x-s.player.position.x,b.p.z-s.player.position.z));const enemy=enemies.find(e=>Math.hypot(e.p.x-s.player.position.x,e.p.z-s.player.position.z)<maxDistance&&this.lineClear(s,e));if(!enemy||s.ended)return s;return this.engage(enemy.id,rounds);}
  async engage(id,rounds=12){let start=await read(this.page),enemy=start.enemies.find(e=>e.id===id);if(!enemy)return start;const startHealth=enemy.health?.current;for(let shot=0;shot<rounds;shot++){let s=await read(this.page);enemy=s.enemies.find(e=>e.id===id&&(e.health?.current??1)>0);if(!enemy||s.ended)break;await this.aimAt(xyz(enemy.p));const active=Object.entries(s.weaponRuntime).find(([k])=>k.includes(s.activeSlot))?.[1]||Object.values(s.weaponRuntime)[0];if(active?.magazine===0){await this.key('r');await this.waitSim(1.9);}const automatic=s.activeSlot==='secondaryHand';s=await this.key('q',automatic?.75:.14);await this.waitSim(automatic?.08:.39);if(shot===0)await this.snap('encounter-'+id);}
    const after=await read(this.page),remaining=after.enemies.find(e=>e.id===id)?.health?.current??0;this.report.observations.push({type:'combat-attempt',enemy:id,startHealth,endHealth:remaining,sim:after.sim});return after;
  }
  async pauseResume(){if((await read(this.page)).ended)return read(this.page);await this.page.keyboard.press('Escape');await this.page.waitForTimeout(180);let s=await this.snap('pause');if(!s.paused){await this.page.keyboard.press('Escape');await this.page.waitForTimeout(180);s=await read(this.page);}await this.page.getByRole('button',{name:/Resume/}).first().click();await this.page.waitForTimeout(120);this.mx=640;this.my=360;await this.page.mouse.move(this.mx,this.my);await this.page.mouse.click(this.mx,this.my);return this.waitSim(.15);}
  async restart(){await this.page.getByRole('button',{name:'Restart',exact:true}).click();await this.page.waitForLoadState('load');await this.page.waitForTimeout(250);const g=JSON.parse(fs.readFileSync(path.join(ROOT,'games',this.id+'.json'))),l=g.levels[g.startLevelIndex||0];await this.page.getByRole('button',{name:l.ui.startScreen.buttonText,exact:true}).click();this.mx=640;this.my=360;await this.page.mouse.move(this.mx,this.my);await this.page.mouse.click(this.mx,this.my);await this.waitSim(.25);return this.snap('restart');}
}

async function arsenal(s){
  await s.start();
  if(suffix.includes('efficient'))await s.key('v');await s.engage('obj2011',6);await s.snap('first-sentry');
  await s.key('r');await s.waitSim(1.25);await s.snap('sidearm-reloaded');
  if(!(await read(s.page)).ended&&(await read(s.page)).activeSlot!=='secondaryHand')await s.key('v');await s.snap('rifle-selected');
  await s.moveTo(-9,6,{combat:true});await s.moveTo(-10,-5,{combat:true});await s.engage('obj2009',10);await s.snap('west-lane');
  await s.moveTo(-9,-11,{combat:true});await s.moveTo(7,-11,{combat:true});await s.engage('obj2010',12);await s.snap('sentries-check');
  await s.key('r');await s.waitSim(1.9);await s.pauseResume();
  let st=await read(s.page);if(!st.ended&&st.enemies.some(e=>(e.health?.current??1)>0)){await s.moveTo(10,-4,{combat:true});await s.shootNearest(30,12);}
  await s.moveTo(0,-14.9);st=await s.snap('extraction-attempt');
  s.report.outcome=st.ended?st.overlay.classes:'No ending reached';
  if(st.ended){await s.restart();await s.snap('loss-trial-begins');for(let i=0;i<90;i++){st=await s.waitSim(.5);if(st.ended)break;if(i%15===0)console.log(s.id,'loss trial',st.sim,st.state?.health);}st=await s.snap('loss-trial-end');s.report.lossTrial=st.ended?st.overlay.classes:'No normal loss reached within 45 simulation seconds';if(st.ended)await s.restart();}
}
async function signal(s){
  await s.start();
  await s.moveTo(-25,-5.7);await s.key('f');await s.waitSim(.35);await s.aimAt([-25,1.2,-6]);await s.snap('alpha-console');
  await s.moveTo(-14,-6.8);await s.moveTo(-11,6.7);await s.snap('entry-divider-cleared');
  await s.moveTo(.5,6.7,{combat:true});await s.shootNearest(22,6);await s.moveTo(2,-5.7,{combat:true});await s.key('f');await s.waitSim(.35);await s.aimAt([2,1.2,-6]);await s.snap('beta-console');
  await s.key('r');await s.waitSim(1.3);await s.snap('reloaded');
  await s.moveTo(20,-6.7,{combat:true});await s.shootNearest(24,6);await s.moveTo(22,-5.7);await s.key('f');await s.waitSim(.35);await s.aimAt([22,1.2,-6]);await s.snap('gamma-console');
  await s.moveTo(27,-5.7);await s.moveTo(33,-5.7);await s.moveTo(38,0);const st=await s.snap('extraction-attempt');s.report.outcome=st.ended?st.overlay.classes:'No ending reached';if(st.ended)await s.restart();
}
(async()=>{fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{for(const id of mode==='all'?['arsenal-run','signal-relay']:[mode]){const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();const session=new Session(page,id);try{if(id==='arsenal-run')await arsenal(session);else if(id==='signal-relay')await signal(session);else throw new Error('Unknown game '+id);}catch(e){session.report.failure=e.stack;try{await session.snap('failure');}catch{}console.error(id,e.stack);}finally{session.save();await context.close();}}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
