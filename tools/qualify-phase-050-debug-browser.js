'use strict';
// Real native browser UI; evaluations read product state only.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='debug-browser-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/phase-050',runId);
fs.mkdirSync(dir,{recursive:true});
const proof={runId,startedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),steps:[],errors:[],status:'IN_PROGRESS'};
proof.consoleErrors=[];proof.externalRequests=[];
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(e?'Not found':data);});});
async function observe(page,label){const value=await page.evaluate(()=>({checked:document.querySelector('#physics-debug-2d-toggle').checked,active:document.querySelector('#physics-debug-2d-overlay').classList.contains('active'),shapes:document.querySelectorAll('#physics-debug-2d-frame polygon').length,text:document.querySelector('#physics-debug-2d-readout').textContent,project:JSON.stringify(serializeProject())}));proof.steps.push({label,observedAt:new Date().toISOString(),...value,project:undefined});return value;}
async function select(page,id){await page.locator('[data-right-tab="scene"]').click();const index=await page.evaluate(id=>placed.findIndex(i=>i.id===id),id);assert(index>=0);await page.locator(`.scene-list-item[data-index="${index}"]`).click();await page.locator('[data-right-tab="inspector"]').click();}
function differences(a,b,p=''){const result=[];if(a===b)return result;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)])){result.push(...differences(a[k],b[k],p+'.'+k));if(result.length>20)break;}}else result.push({path:p,before:a,after:b});return result;}
function persistenceValue(text){const project=JSON.parse(text);for(const prefab of project.prefabs||[])if(prefab.parameters===undefined)prefab.parameters=[];return project;}
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});context.on('page',p=>{p.on('pageerror',e=>proof.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')proof.consoleErrors.push(m.text());});p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))proof.externalRequests.push(r.url());});});const page=await context.newPage();
 await page.goto(origin+'/editor/index.html');await page.waitForFunction(()=>typeof serializeProject==='function'&&typeof body2DManager!=='undefined');
 if(await page.locator('#first-run-skip').isVisible())await page.locator('#first-run-skip').click();
 await page.locator('#import-project-input').setInputFiles(path.join(root,'qualification/phase-049/phase-049-project.json'));
 await page.waitForFunction(()=>typeof placed!=='undefined'&&placed.some(i=>String(i.id).startsWith('phase-049-')));
 if(!await page.locator('#physics-debug-2d-toggle').isVisible())await page.locator('#chrome-toggle-btn').click();
 const before=await observe(page,'Native file import; debug defaults off');assert(!before.checked&&!before.active);
 await page.locator('#physics-debug-2d-toggle').check();await page.waitForFunction(()=>document.querySelector('#physics-debug-2d-overlay').classList.contains('active'));
 const enabled=await observe(page,'Native debug checkbox on');assert(enabled.text.includes('XY'));assert.strictEqual(enabled.project,before.project,'Debug does not alter serialized project');
 await page.locator('#physics-debug-2d-target').selectOption('phase-049-accepted-character');await page.locator('#physics-debug-2d-peer').selectOption('phase-049-accepted-wall');
 assert((await observe(page,'Native mutual-mask accepted explanation')).text.includes('accepts · contact still requires geometry/Body'));
 await page.locator('#physics-debug-2d-target').selectOption('phase-049-ghost-character');await page.locator('#physics-debug-2d-peer').selectOption('phase-049-ghost-wall');
 assert((await observe(page,'Native Ghost rejected-mask explanation')).text.includes('rejects · these shapes do not interact'));
 await page.screenshot({path:path.join(dir,'source-debug.png')});
 await page.locator('#physics-debug-2d-toggle').uncheck();const disabled=await observe(page,'Native debug checkbox off');assert(!disabled.active&&disabled.shapes===0);assert.strictEqual(disabled.project,before.project);
 await page.locator('#physics-debug-2d-toggle').check();
 await page.locator('#physics-debug-2d-target').selectOption('phase-049-rider');
 await page.locator('#play-btn').click();
 await page.waitForFunction(()=>document.querySelector('#physics-debug-2d-readout').textContent.includes('carry true'));
 const carried=await observe(page,'Native Play: selected rider support/carry');
 const actual=await page.evaluate(()=>getCharacterCollision2DState('phase-049-rider'));
 assert(actual.active&&actual.grounded&&actual.onMovingPlatform);assert(carried.text.includes('Support: platform'));
 await page.screenshot({path:path.join(dir,'source-runtime-carry.png')});
 await page.locator('#physics-debug-2d-target').selectOption('phase-049-platform');await page.waitForFunction(()=>document.querySelector('#physics-debug-2d-readout').textContent.includes('Platform delta:'));
 await observe(page,'Native platform actual delta/riders');await page.locator('#physics-debug-2d-target').selectOption('phase-049-rider');
 await page.locator('#physics-debug-2d-hide').click();assert(!(await observe(page,'Native Hide while Play')).active);
 await page.locator('#play-btn').click();await page.locator('#physics-debug-2d-toggle').check();
 await page.waitForFunction(()=>document.querySelector('#physics-debug-2d-readout').textContent.includes('no active runtime state'));
 assert.strictEqual((await observe(page,'Stop restores authored transforms; debug remains transient')).project,before.project);
 await select(page,'phase-049-rider');const count=await page.evaluate(()=>placed.length);
 await page.locator('#duplicate-btn').click();assert.strictEqual(await page.evaluate(()=>placed.length),count+1);await observe(page,'Native Duplicate with diagnostics enabled');
 await page.locator('#undo-btn').click();assert.strictEqual(await page.evaluate(()=>placed.length),count);
 await page.locator('#redo-btn').click();assert.strictEqual(await page.evaluate(()=>placed.length),count+1);await observe(page,'Native Undo/Redo unaffected');await page.locator('#undo-btn').click();
 await select(page,'phase-049-rider');await page.locator('#prefab-name-input').fill(runId);await page.locator('#save-prefab-btn').click();
 const prefab=await page.evaluate(name=>JSON.parse(JSON.stringify(prefabs.find(p=>p.name===name))),runId);assert(!JSON.stringify(prefab).includes('physics-debug'));await observe(page,'Native Prefab contains no diagnostic session state');
 await page.locator('[data-right-tab="project"]').click();
 await page.locator('#project-name-input').fill(runId);await page.locator('#save-btn').click();const saved=await observe(page,'Native local Save');
 await page.reload();await page.waitForFunction(()=>typeof body2DManager!=='undefined');
 if(await page.locator('#first-run-skip').isVisible())await page.locator('#first-run-skip').click();
 if(!await page.locator('[data-right-tab="project"]').isVisible())await page.locator('#chrome-toggle-btn').click();
 await page.locator('[data-right-tab="project"]').click();await page.locator('#project-list-select').selectOption(runId);await page.locator('#load-btn').click();
 const reopened=await observe(page,'Native browser reload and local Load: debug off');assert(!reopened.checked&&!reopened.active);
 proof.persistenceNormalizations=['Only omitted Prefab parameters default to []: actual runtime treats both as no parameters; non-empty lists remain strictly compared.'];
 proof.persistenceDifferences=differences(persistenceValue(saved.project),persistenceValue(reopened.project));assert.deepStrictEqual(proof.persistenceDifferences,[]);
 for(const [tier,button] of [['Editable','#export-standalone-btn'],['Playable','#export-playable-btn']]){
  const pending=page.waitForEvent('download');await page.locator(button).click();const download=await pending,file=path.join(dir,tier+'.html');await download.saveAs(file);
  const exported=await context.newPage();exported.on('pageerror',e=>proof.errors.push(e.message));await exported.goto(origin+'/'+path.relative(root,file).replace(/\\/g,'/'));
  await exported.waitForFunction(()=>typeof OpusPhysicsDebug2D!=='undefined'&&typeof body2DManager!=='undefined');
  const initial=await observe(exported,tier+' debug defaults off');assert(!initial.checked&&!initial.active);
  if(tier==='Editable'){
   if(!await exported.locator('#physics-debug-2d-toggle').isVisible())await exported.locator('#chrome-toggle-btn').click();
   await exported.locator('#physics-debug-2d-toggle').check();await exported.waitForFunction(()=>document.querySelector('#physics-debug-2d-overlay').classList.contains('active'));
   const enabledExport=await observe(exported,'Editable native checkbox');assert(enabledExport.text.includes('XY'));await exported.screenshot({path:path.join(dir,'editable-debug.png')});
   await exported.locator('#physics-debug-2d-target').selectOption('phase-049-rider');await exported.locator('#play-btn').click();await exported.waitForFunction(()=>document.querySelector('#physics-debug-2d-readout').textContent.includes('carry true'));await observe(exported,'Editable native Play support/carry matches');await exported.locator('#play-btn').click();
  }
  await exported.close();
 }
 assert.strictEqual(proof.errors.length,0);assert.strictEqual(proof.consoleErrors.length,0);assert.strictEqual(proof.externalRequests.length,0);proof.status='DEBUG_NATIVE_AUTHORING_RUNTIME_EXPORT_PASS_PENDING_PHASE_REVIEW';
}catch(e){proof.status='FAIL_OR_AUTOMATION_FAILURE';proof.failure=e.stack;process.exitCode=1;}finally{proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({runId,status:proof.status,steps:proof.steps.length,errors:proof.errors,failure:proof.failure}));await browser?.close();server.close();}})();
