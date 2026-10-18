'use strict';
// Real creator controls only. Evaluation observes the model; it never authors it.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='authoring-'+new Date().toISOString().replace(/[-:.]/g,''),directory=path.join(root,'qualification/real-demo-collision',runId);
fs.mkdirSync(directory,{recursive:true});
const proof={runId,startedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),steps:[],errors:[],status:'IN_PROGRESS'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(e?'Not found':data);});});
async function observe(page,label){const value=await page.evaluate(()=>({id:selectedItem?.id,collider:selectedItem?.collider||null,status:document.querySelector('#status')?.textContent||document.querySelector('#status-bar')?.textContent}));proof.steps.push({observedAt:new Date().toISOString(),label,...value});return value;}
async function selectGate(page){await page.locator('[data-right-tab="scene"]').click();await page.locator('#scene-search').fill('Gate');await page.locator('.scene-list-item').filter({has:page.locator('.scene-list-item-name').filter({hasText:/^Gate$/})}).click();await page.locator('[data-right-tab="inspector"]').click();}
async function editChrome(page){if(!await page.locator('[data-right-tab="scene"]').isVisible())await page.locator('#chrome-toggle-btn').click();}
async function run(){let browser;try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();page.on('pageerror',e=>proof.errors.push(e.message));
  await page.goto(origin+'/editor/index.html?game=relic-island');await page.waitForFunction(()=>document.querySelector('#games-status')?.textContent.startsWith('Loaded '));await editChrome(page);await selectGate(page);
  const original=await observe(page,'canonical measured gate');assert.strictEqual(original.id,'obj49');
  await page.locator('#f-collider-shape').selectOption('auto');assert.strictEqual((await observe(page,'legacy default chosen through Inspector')).collider,null);
  await page.locator('#f-collider-fit-mesh').click();const fitted=await observe(page,'Fit Box to Mesh');assert(fitted.collider?.size.y>3);assert(Math.abs(fitted.collider.offset.y-1.54)<1e-6);
  await page.locator('#undo-btn').click();await selectGate(page);assert.strictEqual((await observe(page,'Undo fit')).collider,null);
  await page.locator('#redo-btn').click();await selectGate(page);assert.deepStrictEqual((await observe(page,'Redo fit')).collider,fitted.collider);
  await page.locator('#duplicate-btn').click();const duplicate=await observe(page,'Native Duplicate');assert.notStrictEqual(duplicate.id,'obj49');assert.deepStrictEqual(duplicate.collider,fitted.collider);
  await page.locator('#f-collider-offset-x').fill('2');await page.locator('#f-collider-offset-x').press('Tab');
  const originalAfterCopyEdit=await page.evaluate(()=>placed.find(i=>i.id==='obj49').collider);assert.deepStrictEqual(originalAfterCopyEdit,fitted.collider);proof.steps.push({label:'Duplicate collider edits do not alias original',observedAt:new Date().toISOString(),collider:originalAfterCopyEdit});
  await page.locator('#undo-btn').click();await page.locator('#undo-btn').click();await selectGate(page);
  const prefabName=runId+'-fitted-gate';await page.locator('#prefab-name-input').fill(prefabName);await page.locator('#save-prefab-btn').click();
  const payload=await page.evaluate(name=>JSON.parse(JSON.stringify(prefabs.find(p=>p.name===name))),prefabName);assert.deepStrictEqual(payload.record.collider,fitted.collider);proof.steps.push({label:'Native Save as Prefab preserves JSON-portable fit (undefined optional fields omitted)',observedAt:new Date().toISOString(),collider:payload.record.collider});
  await page.locator('[data-left-tab="prefabs"]').click();await page.locator('#palette-prefabs .palette-item').filter({hasText:prefabName}).dragTo(page.locator('#game'),{targetPosition:{x:400,y:400}});
  await page.waitForFunction(name=>selectedItem?.id!=='obj49'&&selectedItem?.sourcePrefabName===name,prefabName);assert.deepStrictEqual((await observe(page,'Native Prefab drag placement preserves fit')).collider,fitted.collider);
  await page.locator('#undo-btn').click();await selectGate(page);
  await page.locator('[data-right-tab="project"]').click();await page.locator('#project-name-input').fill(runId);await page.locator('#save-btn').click();proof.steps.push({label:'Save Project button',observedAt:new Date().toISOString()});
  await page.locator('[data-right-tab="inspector"]').click();await page.locator('#f-collider-shape').selectOption('auto');
  await page.locator('[data-right-tab="project"]').click();await page.locator('#project-list-select').selectOption(runId);await page.locator('#load-btn').click();await selectGate(page);assert.deepStrictEqual((await observe(page,'Load saved project after changing collider')).collider,fitted.collider);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#games-status')?.textContent.startsWith('Loaded '));await editChrome(page);await page.locator('[data-right-tab="project"]').click();await page.locator('#project-list-select').selectOption(runId);await page.locator('#load-btn').click();await selectGate(page);assert.deepStrictEqual((await observe(page,'Reload browser and load local saved project')).collider,fitted.collider);
  await page.locator('[data-right-tab="project"]').click();
  for(const [tier,button] of [['editable','#export-standalone-alt-btn'],['playable','#export-playable-btn']]){
    const downloadPromise=page.waitForEvent('download');await page.locator(button).click();const download=await downloadPromise,file=path.join(directory,tier+'.html');await download.saveAs(file);
    const exported=await context.newPage();exported.on('pageerror',e=>proof.errors.push(e.message));await exported.goto(origin+'/'+path.relative(root,file).replace(/\\/g,'/'));await exported.waitForFunction(()=>typeof placed!=='undefined'&&placed.some(i=>i.id==='obj49'));
    const gate=await exported.evaluate(()=>placed.find(i=>i.id==='obj49').collider);assert.deepStrictEqual(gate,fitted.collider);proof.steps.push({label:tier+' actual UI export preserves fitted box',observedAt:new Date().toISOString(),collider:gate});
    assert.deepStrictEqual(await exported.evaluate(name=>prefabs.find(p=>p.name===name)?.record.collider,prefabName),fitted.collider);proof.steps.push({label:tier+' export preserves fitted Prefab',observedAt:new Date().toISOString()});
    await exported.locator('#start-overlay-btn').click();await exported.waitForFunction(()=>!!player&&playMode);await exported.keyboard.down('w');const before=await exported.evaluate(()=>({sim:simElapsed,x:player.entity.position.x,z:player.entity.position.z}));await exported.waitForFunction(t=>simElapsed>t+1,before.sim);await exported.keyboard.up('w');const after=await exported.evaluate(()=>({x:player.entity.position.x,z:player.entity.position.z}));assert(Math.hypot(after.x-before.x,after.z-before.z)>.1);proof.steps.push({label:tier+' native gameplay movement',observedAt:new Date().toISOString(),before,after});await exported.screenshot({path:path.join(directory,tier+'.png')});await exported.close();
  }
  assert.strictEqual(proof.errors.length,0);proof.status='AUTHORING_PERSISTENCE_EXPORT_PASS';await context.close();
}catch(e){proof.status='QUALIFICATION_FAILED_NOT_COLLISION_VERDICT';proof.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,directory,failure:proof.failure,steps:proof.steps.length}));}}
run();
