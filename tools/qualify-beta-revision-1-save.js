'use strict';
// Disposable browser context only. No real creator profile/storage is touched.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),run=new Date().toISOString().replace(/[^0-9TZ]/g,''),dir=path.join(root,'qualification/beta-revision-1','save-'+run);
fs.mkdirSync(dir,{recursive:true});
const proof={startedAt:new Date().toISOString(),mode:process.argv.includes('--baseline')?'baseline':'acceptance',errors:[],checks:[]};
const bundle=process.env.BETA_ENGINE_BUNDLE?path.resolve(root,process.env.BETA_ENGINE_BUNDLE):path.join(root,'dist/opus-engine.js');
assert(bundle.startsWith(root+path.sep));proof.engineBundle=bundle;proof.sourceFingerprint=require('./real-demo-program-state').fingerprint();proof.coreSubsetFingerprint=require('./phase-049-source-fingerprint').fingerprint();
const server=http.createServer((req,res)=>{const url=decodeURIComponent(req.url.split('?')[0]);let file=url==='/dist/opus-engine.js'?bundle:path.resolve(root,'.'+url);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html'});res.end(e?'Not found':b);});});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:960}}),p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>proof.errors.push(e.stack));p.on('dialog',d=>d.accept());
 await p.goto('http://127.0.0.1:'+server.address().port+'/editor/index.html');await p.locator('[data-sprite-starter-id="platformer-sky-steps"]').click();await p.waitForFunction(()=>placed.some(o=>o.kind==='sprite'));
 const edit=async()=>{await p.locator('[data-right-tab="scene"]').click();const i=await p.evaluate(()=>placed.findIndex(o=>o.id!=='obj2'&&o.kind==='sprite'));await p.locator('.scene-list-item[data-index="'+i+'"]').click();const field=p.locator('[data-sprite-transform="px"]');await field.fill(String(Number(await field.inputValue())+.25));await field.press('Tab');};
 const save=async()=>{await p.locator('[data-right-tab="project"]').click();if(!await p.locator('#project-name-input').isVisible())await p.locator('[data-section="save"]').click();await p.locator('#project-name-input').fill('Safety test A');await p.locator('#save-btn').click();await p.waitForFunction(()=>!projectDurability.saving);};
 const raw=()=>p.evaluate(()=>localStorage.getItem(app.save.namespace+':Safety test A'));
 await edit();await save();const valid=await raw();assert(valid,await p.locator('#project-durability-detail').textContent());proof.checks.push('Native starter/edit/save produced a project record');
 if(proof.mode!=='baseline'){
  await p.waitForFunction(()=>document.getElementById('project-save-state').textContent==='Saved');
  await edit();await p.waitForFunction(()=>document.getElementById('project-save-state').textContent==='Unsaved Changes');
  await p.locator('#undo-btn').click();await p.waitForFunction(()=>document.getElementById('project-save-state').textContent==='Saved');
  await p.locator('#redo-btn').click();await p.waitForFunction(()=>document.getElementById('project-save-state').textContent==='Unsaved Changes');
  await p.locator('#undo-btn').click();await p.waitForFunction(()=>document.getElementById('project-save-state').textContent==='Saved');
  await p.locator('[data-right-tab="scene"]').click();const selectedIndex=await p.evaluate(()=>placed.findIndex(o=>o.id!=='obj2'&&o.kind==='sprite'));await p.locator('.scene-list-item[data-index="'+selectedIndex+'"]').click();const f=p.locator('[data-sprite-transform="px"]');await f.fill(await f.inputValue());await f.press('Tab');assert.equal(await p.evaluate(()=>projectHasUnsavedChanges()),false);
  proof.checks.push('Native transform/Undo/Redo returns to exact saved revision; same-value input is not dirty');
 }
 await p.evaluate(()=>{window.__betaOriginalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===app.save.namespace+':Safety test A')throw new DOMException('Deterministic quota test','QuotaExceededError');return window.__betaOriginalWrite.call(this,k,v);};});
 await edit();const memory=await p.evaluate(()=>JSON.stringify(serializeProject()));await save();assert.equal(await raw(),valid);assert.equal(await p.evaluate(()=>JSON.stringify(serializeProject())),memory);proof.checks.push('Injected quota failure preserved last valid bytes and current authored memory');
 proof.failureScreen=await p.locator('body').innerText();await p.screenshot({path:path.join(dir,'quota-failure.png')});
 if(proof.mode!=='baseline')assert.equal(await p.locator('#project-save-state').innerText(),'Save Failed');
 if(proof.mode!=='baseline'){
  if(!await p.locator('#export-btn').isVisible())await p.locator('[data-section="importexport"]').click();
  const pending=p.waitForEvent('download');await p.locator('#export-btn').click();const backup=path.join(dir,'RecoveredProject.json');await(await pending).saveAs(backup);assert.deepStrictEqual(JSON.parse(fs.readFileSync(backup,'utf8')),JSON.parse(memory));
  const fresh=await browser.newContext({viewport:{width:1280,height:960}}),q=await fresh.newPage();q.on('pageerror',e=>proof.errors.push(e.stack));q.on('dialog',d=>d.accept());
  try{
   await q.goto(p.url());await q.locator('#first-run-skip').click();await q.locator('[data-right-tab="project"]').click();if(!await q.locator('#import-project-btn').isVisible())await q.locator('[data-section="importexport"]').click();
   const initial=await q.evaluate(()=>projectAuthoredSignature());await q.locator('#import-project-input').setInputFiles(backup);await q.locator('#project-backup-restore').waitFor();await q.locator('[data-backup-cancel]').click();assert.equal(await q.evaluate(()=>projectAuthoredSignature()),initial);
   await q.locator('#import-project-input').setInputFiles({name:'corrupt.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await q.waitForFunction(()=>document.body.textContent.includes('Import failed:'));assert.equal(await q.evaluate(()=>projectAuthoredSignature()),initial);
   await q.locator('#import-project-input').setInputFiles(backup);await q.locator('[data-backup-replace]').click();assert.deepStrictEqual(await q.evaluate(()=>JSON.parse(JSON.stringify(serializeProject()))),JSON.parse(memory));assert.equal(await q.evaluate(()=>scriptsTrusted),false);
   proof.checks.push('Actual JSON download after quota failure restores full authored data on fresh isolated profile; cancellation/malformed JSON keep original; script permission starts unapproved');
   await q.screenshot({path:path.join(dir,'fresh-profile-restored.png')});
   if(!await q.locator('#project-name-input').isVisible())await q.locator('[data-section="save"]').click();await q.locator('#project-name-input').fill('Recovered A');await q.locator('#save-btn').click();await q.waitForFunction(()=>document.getElementById('project-save-state').textContent==='Saved');
   await q.reload();await q.waitForFunction(()=>typeof serializeProject==='function');if(!await q.locator('#play-btn').isVisible())await q.locator('#chrome-toggle-btn').click();if(await q.evaluate(()=>playMode)){await q.keyboard.press('Escape');await q.locator('#play-btn').click();await q.waitForFunction(()=>!playMode);}
   await q.locator('#project-home-btn').click();await q.locator('#project-home-search').fill('Recovered A');await q.getByRole('button',{name:'Open Recovered A',exact:true}).click();assert.deepStrictEqual(await q.evaluate(()=>JSON.parse(JSON.stringify(serializeProject()))),JSON.parse(memory));await q.waitForFunction(()=>document.getElementById('project-save-state').textContent==='Saved');
   proof.checks.push('Restored project native Save/Reload/Home/Open retains exact authored project and reports Saved');
  }finally{await fresh.close();}
 }
 await p.evaluate(()=>{Storage.prototype.setItem=window.__betaOriginalWrite;});
 // Native new-document workflow, then a deliberately occupied local slot.
 proof.homeControls='Second document established through the existing creator function (not a native new-project acceptance claim)';
 // Existing public creator function establishes the second project; authoring/save above remain actual UI interactions.
 await p.evaluate(()=>createBlankProject('Safety test B'));
 await save();const after=await raw();proof.unrelatedSameNameOverwrote=after!==valid;
 if(proof.mode!=='baseline')assert.equal(after,valid,'Unrelated document must not overwrite occupied slot');
 proof.checks.push(proof.unrelatedSameNameOverwrote?'BASELINE DEFECT: unrelated document overwrote occupied slot without ownership protection':'Unrelated document refused occupied slot');
 assert.deepStrictEqual(proof.errors,[]);proof.status=proof.mode==='baseline'?'BASELINE_CHARACTERIZED':'PARTIAL_SAVE_GATE_PASS';
 }catch(e){proof.status='FAIL';proof.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));proof.resourcesClosed=true;proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({dir,...proof}));}})();
