// Normal-input standalone routes, with read-only telemetry for route selection.
// No teleporting, inventory grants, AI changes or objective mutation.
const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const ids=process.argv.slice(2);if(!ids.length)ids.push('power-grid','foglight','relic-island');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const id of ids){
  const out=path.join(root,'rehabilitation-evidence','playthroughs',id);fs.mkdirSync(out,{recursive:true});
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),events=[],errors=[];
  const report={id,inputOnly:true,startedAt:new Date().toISOString(),events,errors};page.on('pageerror',e=>errors.push(e.message));
  const read=()=>page.evaluate(()=>({
   pos:player&&player.entity.position,controller:player&&player.controllerType,basis:app.camera.getBasis(),eye:app.camera.eye,
   yaw:fpYaw,pitch:fpPitch,sensitivity:currentPlayerSettings.mouseSensitivity||.0022,pointerLocked:!!document.pointerLockElement,sim:window.__gamePlaytimeSeconds,ended:gameEnded,frozen:playerFrozen,health:window.__gameState,inventory:window.__gameInventory,
   objectives:window.__gameObjectives,held:heldObjectItem&&heldObjectItem.id,nearest:nearestInteractable&&nearestInteractable.id,
   text:document.body.innerText,beacons:placed.filter(o=>/^Foglight\d$/.test(o.name||'')).map(o=>({id:o.id,lit:o.variables?.lit})),
   objs:placed.filter(o=>o.name&&o.entity&&!o.isWaypoint&&!o.isTrigger).map(o=>({id:o.id,name:o.name,pos:o.entity.position,visible:o.entity.visible}))
  }));
  const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});events.push({capture:name,state:await read()});};
  async function hold(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
  async function walk(target,label,maxSeconds=50,tolerance=1.2){
   const started=Date.now();let prev=null,stuck=0;
   while(Date.now()-started<maxSeconds*1000){
    let s=await read();if(s.ended)break;
    const dx=target[0]-s.pos.x,dz=target[1]-s.pos.z,dist=Math.hypot(dx,dz);
    if(dist<tolerance){events.push({walk:label,reached:true,state:s});return true;}
    if(s.frozen){await page.waitForTimeout(500);continue;}
    const f=s.basis.forward,fl=Math.hypot(f.x,f.z)||1,fx=f.x/fl,fz=f.z/fl;
    // Runtime thirdperson uses right=(forward.z,0,-forward.x); FPS the same.
    const forward=dx*fx+dz*fz,side=dx*fz-dz*fx;
    const key=Math.abs(forward)>Math.abs(side)?(forward>0?'w':'s'):(side>0?'d':'a');
    const ms=Math.min(240,Math.max(65,dist/6*650));
    if(prev&&Math.hypot(s.pos.x-prev.x,s.pos.z-prev.z)<.045)stuck++;else stuck=0;prev={...s.pos};
    if(stuck>4){await hold('Space',250);stuck=0;}
    await hold(key,ms);
   }
   events.push({walk:label,reached:false,state:await read()});return false;
  }
  let mx=640,my=360;
  async function aimAt(point){
    let st=await read();if(st.ended)return;if(!st.pointerLocked){await page.mouse.move(mx,my);await page.mouse.click(mx,my);await page.waitForTimeout(150);st=await read();}
    const dx=point[0]-st.eye.x,dz=point[2]-st.eye.z,dy=point[1]-st.eye.y,yaw=Math.atan2(dx,dz),pitch=-Math.atan2(dy,Math.hypot(dx,dz));
    for(let k=0;k<4;k++){st=await read();const dyaw=Math.atan2(Math.sin(yaw-st.yaw),Math.cos(yaw-st.yaw)),dp=pitch-st.pitch;if(Math.abs(dyaw)<.006&&Math.abs(dp)<.006)break;mx-=dyaw/st.sensitivity;my-=dp/st.sensitivity;await page.mouse.move(mx,my,{steps:1});await page.waitForTimeout(120);}
    events.push({mouseAim:point,state:await read()});
  }
  async function interact(label){await hold('f',160);await page.waitForTimeout(250);events.push({interact:label,state:await read()});}
  try{
   await page.goto('http://localhost:8837/dist/games/'+id+'.html',{waitUntil:'load',timeout:60000});
   await page.waitForTimeout(400);await shot('start');
   const project=JSON.parse(fs.readFileSync(path.join(root,'games',id+'.json')));
   await page.getByRole('button',{name:project.levels[0].ui.startScreen.buttonText,exact:true}).click({timeout:20000});
   await page.waitForTimeout(1200);await shot('opening');
   if(id==='power-grid'){
    await walk([-14,-4.4],'Power cell',35,.3);await interact('Pick up cell');await shot('cell-carried');
    await walk([-14,4.2],'Generator',35,.3);await interact('Insert power cell');await walk([-14,1],'View powered generator',20,.4);await aimAt([-14,1.2,6]);await shot('generator');
    await walk([-4,0],'West passage');await walk([4,0],'East passage');
    await walk([12.5,-6],'Coolant A',35,.3);await interact('Coolant A');await shot('coolant');
    await walk([10,0],'Center return');await walk([12.5,6],'Coolant B',35,.3);await interact('Coolant B');
    await walk([15,0],'Gate');await shot('gate');await walk([19,0],'Extraction',35,.7);
   }else if(id==='foglight'){
    await walk([0,20],'First beacon',65,.3);await interact('Ignite first beacon');await shot('first-beacon');
    await walk([-9,22],'Vale key',40,.18);await shot('guardian-court');
    await walk([0,24.5],'Return to path',45);await walk([0,27.4],'Grove gate');
    await walk([0,41],'Second beacon',60,.3);await interact('Ignite second beacon');await shot('grove');
    for(const z of [47,52,57,62])await walk([0,z],'Causeway '+z,25,.5);await walk([0,67],'Third beacon',40,.3);await interact('Ignite third beacon');await shot('last-beacon');
    await walk([0,72.4],'Sanctuary gate',25,.4);await walk([0,77],'Sanctuary path',25,.4);await walk([0,81],'Sanctuary',35,.4);
   }else if(id==='relic-island'){
    for(const [target,label] of [[[8,8],'east relic'],[[-8,6],'west relic'],[[0,-10],'south relic'],[[10,-6],'gate key']]){await walk(target,label,45,.5);await shot(label.replace(/ /g,'-'));}
    await walk([1.5,7],'Gate lever');await interact('Open gate');await page.waitForTimeout(2500);await shot('gate');await walk([0,14],'Shrine',50,.75);
   }else if(id==='silent-sector'){
    await page.waitForFunction(()=>!playerFrozen,{timeout:60000});
    await page.keyboard.down('c');
    for(const target of [[-22,-8],[-12,-8],[-6,-8],[1,-8],[4,-8],[12,-8]])await walk(target,'Stealth route',50);
    await aimAt([14,1,-3]);await shot('core-approach');await page.keyboard.up('c');await walk([14,-3],'Data Core',30,.4);await interact('Data Core');await shot('core');
    await walk([20,-6],'Exit corridor');await walk([28,-3],'Extraction approach');await walk([29,0],'Extraction',35,.75);await page.keyboard.up('c');
   }
   await page.waitForTimeout(1500);report.final=await read();await shot('outcome');
   if(report.final.ended){await page.getByRole('button',{name:'Restart',exact:true}).click();await page.waitForTimeout(600);report.restart=await read();}
   else{await page.keyboard.press('Escape');await page.waitForTimeout(300);report.pauseText=await page.locator('body').innerText();}
  }catch(e){report.failure=e.stack;}
  report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'playtest.json'),JSON.stringify(report,null,2));
  console.log(id,report.final?.sim,report.final?.ended,report.failure||'captured');await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
