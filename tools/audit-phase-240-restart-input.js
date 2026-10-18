'use strict';
// Native input only. Event observers below never cancel, dispatch, or mutate input/game state.
const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='restart-input-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/phase-240',runId);
fs.mkdirSync(dir,{recursive:true});
const proof={runId,startedAt:new Date().toISOString(),file:'qualification/phase-239/gauntlet-action-20261016T062442701Z/Editable.html',errors:[],external:[],observations:[]};
proof.fileSha256=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,proof.file))).digest('hex');
(async()=>{let browser,p;try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 if(process.argv.includes('--two-tabs')){const donor=await browser.newPage({viewport:{width:1280,height:960}});await donor.goto(pathToFileURL(path.join(root,proof.file)).href);await donor.waitForFunction(()=>typeof serializeProject==='function');if(!await donor.evaluate(()=>playMode))await donor.locator('#play-btn').click();await donor.waitForFunction(()=>playMode&&!app.paused);await donor.locator('#game').click();proof.observations.push({label:'First tab retains native pointer lock before opening second actual file',state:await donor.evaluate(()=>({lock:document.pointerLockElement?.id,focused:document.hasFocus()}))});}
 p=await browser.newPage({viewport:{width:1280,height:960}});p.setDefaultTimeout(10000);
 p.on('dialog',d=>d.accept());p.on('pageerror',e=>proof.errors.push(e.stack));p.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))proof.external.push(r.url());});
 await p.goto(pathToFileURL(path.join(root,proof.file)).href);await p.waitForFunction(()=>typeof serializeProject==='function');
 await p.evaluate(()=>{window.__restartInputEvents=[];const record=where=>e=>{const input=app?.input;window.__restartInputEvents.push({where,type:e.type,target:e.target?.id||e.target?.tagName,button:e.button,buttons:e.buttons,pointerType:e.pointerType,isTrusted:e.isTrusted,x:e.clientX,y:e.clientY,dx:e.movementX,dy:e.movementY,lock:document.pointerLockElement?.id,focus:document.activeElement?.id,keys:input?[...input.keys]:[],version:input?.pressVersion('Mouse0'),paused:app?.paused,playMode});};for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','pointermove','pointerlockchange']){document.addEventListener(type,record('document-capture'),true);document.addEventListener(type,record('document-bubble'));document.getElementById('game').addEventListener(type,record('canvas-bubble'));}});
 const frames=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const read=()=>p.evaluate(()=>({sim:simElapsed,lastAttackTime:Number.isFinite(lastAttackTime)?lastAttackTime:String(lastAttackTime),cooldown:resolveActivePlayerWeapon()?.cooldown,focused:document.hasFocus(),visibility:document.visibilityState,pressed:[...app.input.pressed],attackBinding:inputActionBinding('attack'),attackContext:inputActionContextState('attack'),paused:app.paused,playMode,lock:document.pointerLockElement?.id,focus:document.activeElement?.id,keys:[...app.input.keys],version:app.input.pressVersion('Mouse0'),blocked:[...(inputContextRuntime?.blockedPressCodes||[])],yaw:fpYaw,pitch:fpPitch,ammo:JSON.parse(JSON.stringify(weaponRuntimeState.fixed||{})),targets:placed.filter(x=>x.id?.startsWith('target-')).map(x=>({id:x.id,health:x.health.current})),events:window.__restartInputEvents.slice()}));
 if(!await p.evaluate(()=>playMode))await p.locator('#play-btn').click();await p.waitForFunction(()=>playMode&&!app.paused&&weaponRuntimeState.fixed?.magazine===2);
 await p.locator('#game').click();await frames();proof.observations.push({label:'Initial native canvas lock acquisition',state:await read()});
 for(let cycle=0;cycle<3;cycle++){
  const beforePause=await read();
  await p.keyboard.press('Escape');await p.locator('#pause-restart-btn').click();await p.waitForFunction(()=>playMode&&!app.paused&&weaponRuntimeState.fixed?.magazine===2);await frames();
  const immediate=await read();
  if(process.argv.includes('--cooldown-ready'))await p.waitForFunction(()=>simElapsed-lastAttackTime>=resolveActivePlayerWeapon().cooldown);
  const before=await read();
  // Cycle0 reproduces gauntlet's down/up without any new mouse move. Cycle1
  // changes only native pointer coordinates after Restart, not runtime state.
  if(cycle===1){const b=await p.locator('#game').boundingBox();await p.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await frames();}
  await p.mouse.down();await frames();const held=await read();await p.mouse.up();await p.waitForFunction(t=>simElapsed>=t,before.sim+.25);const after=await read();
  const hit=after.targets.find(x=>x.id==='target-1')?.health===15&&after.ammo.magazine===1;
  proof.observations.push({label:['No movement after native Restart','Native pointer move to canvas after Restart','Second no-movement native Restart'][cycle],cooldownReadyWait:process.argv.includes('--cooldown-ready'),beforePause,immediate,before,held,after,strictHealth15Ammo1:hit});
  if(process.argv.includes('--cooldown-ready'))assert(hit,'A ready weapon must produce exactly target Health15 and magazine1 after native Mouse0');
  await p.screenshot({path:path.join(dir,'cycle-'+cycle+'.png')});
 }
 assert.deepStrictEqual(proof.errors,[]);assert.deepStrictEqual(proof.external,[]);proof.status='DIAGNOSTIC_COMPLETE';
}catch(e){proof.status='FAIL';proof.failure=e.stack;process.exitCode=1;await p?.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});}finally{await browser?.close();proof.resourcesClosed=true;proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({dir,status:proof.status,failure:proof.failure,observations:proof.observations.map(x=>({label:x.label,strictHealth15Ammo1:x.strictHealth15Ammo1,held:x.held&&{keys:x.held.keys,version:x.held.version,events:x.held.events.slice(-9)},after:x.after&&{ammo:x.after.ammo,targets:x.after.targets}})),resourcesClosed:true}));}})();
