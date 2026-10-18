'use strict';
// Native inputs only; evaluate reads actual editor/runtime state.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),fp=()=>require('./real-demo-program-state').fingerprint();
const runId='quality-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/phase-180',runId);fs.mkdirSync(dir,{recursive:true});
const proof={runId,startedAt:new Date().toISOString(),fingerprint:fp(),observations:[],errors:[]};
const fixture=process.argv.find(a=>a.startsWith('--fixture='))?.slice(10)||'qualification/phase-179/lighting2d-20261012T023136323Z/native-saved-project.json';
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(e?'Not found':b);});});
const state=p=>p.evaluate(()=>({project:JSON.parse(JSON.stringify(serializeProject())),undo:undoStack.length}));
async function profiles(p,tier,dpr){
 if(tier==='Playable'){
  if(!await p.evaluate(()=>playMode))await p.locator('#start-overlay-btn').click();
  await p.waitForFunction(()=>playMode&&!app.paused);await p.keyboard.press('Escape');await p.waitForFunction(()=>app.paused);const before=await state(p);
  for(const value of ['high','low']){if(await p.evaluate(()=>app.getQuality().profile)!==value)await p.locator('#pause-quality-btn').click();await p.waitForTimeout(150);const q=await p.evaluate(()=>({...app.getQuality(),clientWidth:canvas.clientWidth,clientHeight:canvas.clientHeight}));assert.equal(q.profile,value);assert.equal(q.effectivePixelRatio,Math.min(dpr,value==='low'?1:2));assert.equal(q.width,Math.floor(q.clientWidth*q.effectivePixelRatio));assert.equal(q.height,Math.floor(q.clientHeight*q.effectivePixelRatio));assert.deepStrictEqual(await state(p),before);assert.match(await p.locator('#pause-quality-btn').textContent(),value==='low'?/Low/:/High/);await p.screenshot({path:path.join(dir,`${tier}-dpr${dpr}-${value}.png`)});proof.observations.push({label:`Playable DPR${dpr} ${value}, actual Pause Settings/buffer, no authored/history mutation`,quality:q});}
  await p.reload();await p.waitForFunction(()=>typeof serializeProject==='function');assert.equal(await p.evaluate(()=>app.getQuality().profile),'low');proof.observations.push({label:`Playable DPR${dpr} local quality survives reload; no editor UI claim`});return;
 }
 if(!await p.locator('#viewport-quality-btn').isVisible())await p.locator('#chrome-toggle-btn').click();
 const before=await state(p);await p.locator('#viewport-quality-btn').click();
 for(const value of ['high','low']){
  await p.locator('#viewport-quality-profile').selectOption(value);await p.waitForTimeout(150);
  const q=await p.evaluate(()=>({...app.getQuality(),clientWidth:canvas.clientWidth,clientHeight:canvas.clientHeight}));
  assert.equal(q.profile,value);assert.equal(q.effectivePixelRatio,Math.min(dpr,value==='low'?1:2));
  assert.equal(q.width,Math.floor(q.clientWidth*q.effectivePixelRatio));assert.equal(q.height,Math.floor(q.clientHeight*q.effectivePixelRatio));
  assert.match(await p.locator('#viewport-quality-readout').textContent(),new RegExp(q.width+' × '+q.height));
  assert.deepStrictEqual(await state(p),before);await p.screenshot({path:path.join(dir,`${tier}-dpr${dpr}-${value}.png`)});
  proof.observations.push({label:`${tier} DPR${dpr} ${value}, actual buffer/readout, no authored/history mutation`,quality:q});
 }
 await p.locator('#viewport-quality-close').click();assert.equal(await p.locator('#viewport-quality-btn').getAttribute('aria-expanded'),'false');
 await p.reload();await p.waitForFunction(()=>typeof serializeProject==='function');assert.equal(await p.evaluate(()=>app.getQuality().profile),'low');if(!await p.locator('[data-right-tab="project"]').isVisible())await p.locator('#chrome-toggle-btn').click();proof.observations.push({label:`${tier} DPR${dpr} local quality survives reload`});
}
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});const base='http://127.0.0.1:'+server.address().port;
 for(const dpr of [1,2]){
  const context=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:dpr});const p=await context.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>proof.errors.push(e.stack));
  await p.goto(base+'/editor/index.html');await p.waitForFunction(()=>typeof serializeProject==='function');if(await p.locator('#first-run-skip').isVisible())await p.locator('#first-run-skip').click();
  await p.locator('#import-project-input').setInputFiles(path.join(root,fixture));await p.waitForTimeout(250);const expected=await state(p);
  await p.locator('[data-right-tab="project"]').click();await p.locator('#project-name-input').fill(runId+'-'+dpr);await p.locator('#save-btn').click();
  await profiles(p,'Source',dpr);
  await p.locator('[data-right-tab="project"]').click();await p.locator('#project-list-select').selectOption(runId+'-'+dpr);await p.locator('#load-btn').click();assert.deepStrictEqual((await state(p)).project.levels,expected.project.levels);
  for(const [tier,button] of [['Editable','#export-standalone-btn'],['Playable','#export-playable-btn']]){
   const [download]=await Promise.all([p.waitForEvent('download'),p.locator(button).click()]);const file=path.join(dir,`${tier}-dpr${dpr}.html`);await download.saveAs(file);const q=await context.newPage();q.setDefaultTimeout(10000);q.on('pageerror',e=>proof.errors.push(e.stack));await q.goto(base+'/'+path.relative(root,file).split(path.sep).join('/'));await q.waitForFunction(()=>typeof serializeProject==='function');await profiles(q,tier,dpr);
   if(!await q.evaluate(()=>playMode))await q.locator(tier==='Playable'?'#start-overlay-btn':'#play-btn').click();if(await q.evaluate(()=>app.paused))await q.locator('#pause-resume-btn').click();await q.waitForFunction(()=>playMode&&!app.paused);const start=await q.evaluate(()=>currentPlayerSettings.controllerType==='platformer2d'?placed.find(i=>i.id===currentPlayerSettings.platformerObjectRef).entity.position.x:player.entity.position.z);const key=await q.evaluate(()=>currentPlayerSettings.controllerType==='platformer2d'?'KeyD':'KeyW');await q.keyboard.down(key);await q.waitForTimeout(500);await q.keyboard.up(key);const end=await q.evaluate(()=>currentPlayerSettings.controllerType==='platformer2d'?placed.find(i=>i.id===currentPlayerSettings.platformerObjectRef).entity.position.x:player.entity.position.z);assert(end>start);assert.equal(await q.evaluate(()=>canvas.getContext('webgl2').getError()),0);proof.observations.push({label:`${tier} DPR${dpr} actual ${key} movement and GPU0`,start,end});await q.close();
  }
  await context.close();
 }
 assert.deepStrictEqual(proof.errors,[]);assert.equal(fp(),proof.fingerprint);proof.status='SCOPED_NATIVE_PASS_NOT_PHASE_QUALIFICATION';
 }catch(e){proof.status='AUTOMATION_OR_PRODUCT_FAILURE';proof.failure=e.stack;process.exitCode=1;}finally{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));proof.resourcesClosed=true;proof.finalFingerprint=fp();proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}})();
