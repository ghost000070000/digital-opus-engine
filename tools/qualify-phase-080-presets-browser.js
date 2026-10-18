'use strict';
// Native authoring and exact exports. All browser evaluation is read-only.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const authoring=require('../editor/src/00-authoring-schema');
const root=path.resolve(__dirname,'..'),runId='presets-browser-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/phase-080',runId);
fs.mkdirSync(dir,{recursive:true});
function component(id,values={}){const s=authoring.registry.get(id);return {version:s.version,...authoring.stableClone(s.defaults),...values};}
function sprite(id,position,size,components={}){return {kind:'sprite',id,name:id,position,scale:[1,1,1],rotationY:0,behaviors:[],components:{'sprite-renderer':component('sprite-renderer',{width:size[0],height:size[1]}),...components}};}
const fixture=JSON.parse(fs.readFileSync(path.join(root,'qualification/phase-042/phase-042-project.json'))),camera=fixture.levels[0].objects.find(o=>o.kind==='camera');
camera.options.position=[0,1,20];camera.options.orthographicHeight=8;
fixture.levels[0].objects=[camera,
  sprite('preset-donor',[30,0,0],[1,1],{'box-collider-2d':component('box-collider-2d'),'body-2d':component('body-2d',{type:'kinematic',linearVelocity:[1,0]})}),
  sprite('preset-deck',[0,0,0],[4,.5],{'box-collider-2d':component('box-collider-2d',{size:[4,.5]}),'moving-platform-2d':component('moving-platform-2d')}),
  sprite('preset-rider',[0,.75,0],[1,1],{'box-collider-2d':component('box-collider-2d'),'body-2d':component('body-2d',{type:'kinematic'}),'character-collision-2d':component('character-collision-2d')})];
fixture.prefabs=[];fixture.componentPresets=[];fixture.levels[0].name='Reusable Component Settings Workshop';fixture.world.playerSettings.controllerType='topdown';fixture.levels[0].playerSettings=fixture.world.playerSettings;fixture.world.ui.startScreen.enabled=false;
const fixturePath=path.join(dir,'fixture.json');fs.writeFileSync(fixturePath,JSON.stringify(fixture));
const proof={runId,startedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),steps:[],pageErrors:[],consoleErrors:[],externalRequests:[],heaps:[],status:'IN_PROGRESS'};
function record(label,data={}){proof.steps.push({label,observedAt:new Date().toISOString(),...data});fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2));}
async function select(page,id){await page.locator('[data-right-tab="scene"]').click();const index=await page.evaluate(id=>placed.findIndex(o=>o.id===id),id);assert(index>=0);await page.locator(`.scene-list-item[data-index="${index}"]`).click();await page.locator('[data-right-tab="inspector"]').click();}
async function velocity(page,n){const f=page.locator('[data-schema-slot="body-2d"] [data-component-field="linearVelocity"][data-component-axis="x"]');await f.fill(String(n));await f.press('Tab');}
async function state(page){return page.evaluate(()=>JSON.parse(JSON.stringify({project:serializeProject(),selectedId:selectedItem?.id||null,objects:placed.filter(o=>o.kind==='sprite').map(o=>({id:o.id,position:[o.entity.position.x,o.entity.position.y,o.entity.position.z],components:o.components})),heapEstimate:performance.memory?.usedJSHeapSize??null})));}
function deck(snapshot){return snapshot.objects.find(o=>o.id==='preset-deck');}
function library(snapshot){return snapshot.project.componentPresets;}
async function runtime(page,tier){
  await page.waitForFunction(()=>playMode&&body2DManager);
  const before=await state(page);proof.heaps.push({tier,stage:'initial',observedAt:new Date().toISOString(),usedJSHeapSizeEstimate:before.heapEstimate});
  await page.waitForFunction(()=>placed.find(o=>o.id==='preset-deck').entity.position.x>1.2);
  const actual=await page.evaluate(()=>{const p=placed.find(o=>o.id==='preset-deck'),r=placed.find(o=>o.id==='preset-rider');return {deck:[p.entity.position.x,p.entity.position.y,p.entity.position.z],rider:[r.entity.position.x,r.entity.position.y,r.entity.position.z],velocity:p.components['body-2d'].linearVelocity,support:body2DManager.getCharacterCollision2DState(r.id),projectPresets:serializeProject().componentPresets,heapEstimate:performance.memory?.usedJSHeapSize??null};});
  assert(Math.abs(actual.deck[0]-actual.rider[0])<.001);assert(Math.abs(actual.rider[1]-.75)<.001);assert.equal(actual.support.groundSupportId,'preset-deck');assert.equal(actual.support.onMovingPlatform,true);assert.deepStrictEqual(actual.velocity,[1,0]);
  record(tier+' applied preset executes canonical Body velocity and moving Character carry',{actual});proof.heaps.push({tier,stage:'final',observedAt:new Date().toISOString(),usedJSHeapSizeEstimate:actual.heapEstimate});await page.screenshot({path:path.join(dir,tier+'-preset-carry.png')});
}
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(error?'Not found':data);});});
async function confirmed(page,selector,accept=true){
  const dialogPromise=page.waitForEvent('dialog'),clickPromise=page.locator(selector).click();const dialog=await dialogPromise;
  const message=dialog.message();assert.equal(dialog.type(),'confirm');if(accept)await dialog.accept();else await dialog.dismiss();await clickPromise;return message;
}
async function choosePreset(page){
  await page.locator('#component-preset-select').selectOption('0');const preview=await page.locator('#component-preset-preview').innerText();
  assert(preview.includes('Body 2D'));assert(preview.includes('Type: Kinematic'));assert(preview.includes('Linear Velocity: 1, 0'));assert(!preview.includes('"linearVelocity"'),'Preview must use creator labels, not raw component JSON');
}
async function campaign(page,context,origin){
  await select(page,'preset-donor');await velocity(page,2);await velocity(page,1);
  const beforeSave=await state(page);const capture=page.locator('[data-component-preset-capture="body-2d"]');assert.equal(await capture.getAttribute('open'),null,'Save controls should begin collapsed');await capture.locator(':scope > summary').click();await page.locator('[data-component-preset-name="body-2d"]').fill('Carry Body');await page.locator('[data-component-preset-save="body-2d"]').click();
  const saved=await state(page);assert.equal(library(saved).length,1);assert.equal(library(saved)[0].name,'Carry Body');assert.deepStrictEqual(library(saved)[0].record.linearVelocity,[1,0]);
  await page.locator('#undo-btn').click();assert.deepStrictEqual(library(await state(page)),library(beforeSave));await page.locator('#redo-btn').click();assert.deepStrictEqual(library(await state(page)),library(saved));
  record('Native named component capture has exact project-local library Undo/Redo',{preset:library(saved)[0]});
  await select(page,'preset-deck');const beforeApply=await state(page);await choosePreset(page);assert(await page.locator('#component-preset-apply').isEnabled());await page.locator('#component-preset-apply').click();
  const applied=await state(page);assert.deepStrictEqual(deck(applied).components['body-2d'].linearVelocity,[1,0]);
  for(const id of ['sprite-renderer','box-collider-2d','moving-platform-2d'])assert.deepStrictEqual(deck(applied).components[id],deck(beforeApply).components[id]);assert.deepStrictEqual(deck(applied).position,deck(beforeApply).position);
  await page.locator('#undo-btn').click();assert.equal(deck(await state(page)).components['body-2d'],undefined);await page.locator('#redo-btn').click();assert.deepStrictEqual(deck(await state(page)).components,deck(applied).components);
  record('Native Apply adds absent Body only, preserving identity, geometry and unrelated components in one Undo',{applied:deck(applied)});
  await select(page,'preset-deck');await velocity(page,2);await choosePreset(page);const beforeCancel=await state(page);const refused=await confirmed(page,'#component-preset-apply',false);assert(refused.includes('Replace Body 2D'));assert.deepStrictEqual(deck(await state(page)),deck(beforeCancel));
  const accepted=await confirmed(page,'#component-preset-apply');assert(accepted.includes('Other components'));assert.equal(deck(await state(page)).components['body-2d'].linearVelocity[0],1);
  await page.locator('#undo-btn').click();assert.equal(deck(await state(page)).components['body-2d'].linearVelocity[0],2);await page.locator('#redo-btn').click();assert.equal(deck(await state(page)).components['body-2d'].linearVelocity[0],1);
  record('Native replacement Cancel is non-mutating; confirmed replacement has single-step Undo/Redo');
  await select(page,'preset-deck');await page.locator('#duplicate-btn').click();const duplicateId=(await state(page)).selectedId;assert.notEqual(duplicateId,'preset-deck');await velocity(page,2);
  assert.equal(deck(await state(page)).components['body-2d'].linearVelocity[0],1);assert.equal(library(await state(page))[0].record.linearVelocity[0],1);
  await page.locator('#undo-btn').click();await page.locator('#undo-btn').click();await select(page,'preset-deck');
  await page.locator('#sprite-prefab-name').fill(runId);await page.locator('#sprite-save-prefab').click();const prefab=(await state(page)).project.prefabs.find(p=>p.name===runId);assert.deepStrictEqual(prefab.record.components['body-2d'].linearVelocity,[1,0]);
  record('Applied settings have independent duplicate records and persist through native Sprite Prefab',{duplicateId,prefab});
  await choosePreset(page);const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#component-preset-export').click()]);const presetFile=path.join(dir,'Carry-Body.component-preset.json');await download.saveAs(presetFile);
  const portable=JSON.parse(fs.readFileSync(presetFile));assert.deepStrictEqual(portable,library(saved)[0]);assert.equal(portable.id,undefined);assert.equal(portable.position,undefined);record('Native JSON download is exact component settings, not Object identity or Transform',{portable});
  await page.locator('#component-preset-library').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,'preset-authoring.png')});
  const baseline=await state(page);await page.locator('[data-right-tab="project"]').click();await page.locator('#project-name-input').fill(runId);await page.locator('#save-btn').click();
  await page.reload();await page.waitForFunction(()=>typeof serializeProject==='function');if(await page.locator('#first-run-skip').isVisible())await page.locator('#first-run-skip').click();if(!await page.locator('[data-right-tab="project"]').isVisible())await page.locator('#chrome-toggle-btn').click();await page.locator('[data-right-tab="project"]').click();await page.locator('#project-list-select').selectOption(runId);await page.locator('#load-btn').click();
  const reopened=await state(page);assert.deepStrictEqual(library(reopened),library(baseline));assert.deepStrictEqual(reopened.project.levels[0].objects,baseline.project.levels[0].objects);assert.deepStrictEqual(reopened.project.prefabs,baseline.project.prefabs);
  record('Native project Save/reopen retains exact library, applied components and Prefab');
  await page.locator('#import-project-input').setInputFiles(fixturePath);await page.waitForFunction(()=>serializeProject().componentPresets.length===0);await select(page,'preset-deck');
  const fresh=await state(page);assert.equal(deck(fresh).components['body-2d'],undefined);const importDialog=page.waitForEvent('dialog');await page.locator('#component-preset-file').setInputFiles(presetFile);const confirmation=await importDialog;assert(confirmation.message().includes('Import "Carry Body"'));await confirmation.accept();await page.waitForFunction(()=>serializeProject().componentPresets.length===1);
  const imported=await state(page);assert.deepStrictEqual(library(imported),[portable]);assert.deepStrictEqual(deck(imported),deck(fresh));await page.locator('#undo-btn').click();assert.equal(library(await state(page)).length,0);await page.locator('#redo-btn').click();assert.deepStrictEqual(library(await state(page)),[portable]);
  record('Native file import into fresh project only changes library, with exact Undo/Redo and no Object mutation');
  await select(page,'preset-deck');const malformed=path.join(dir,'invalid-preset.json');fs.writeFileSync(malformed,JSON.stringify({...portable,version:99}));const beforeInvalid=await state(page);await page.locator('#component-preset-file').setInputFiles(malformed);await page.waitForTimeout(150);assert.deepStrictEqual(library(await state(page)),library(beforeInvalid));assert.deepStrictEqual(deck(await state(page)),deck(beforeInvalid));record('Unsupported portable format import leaves exact library/Object unchanged');
  await choosePreset(page);await page.locator('#component-preset-apply').click();assert.equal(deck(await state(page)).components['body-2d'].linearVelocity[0],1);
  await page.locator('#play-btn').click();await runtime(page,'Source');await page.locator('#play-btn').click();assert.deepStrictEqual(deck(await state(page)).position,[0,0,0]);record('Native Stop restores authored Transform after imported preset gameplay');
  for(const [tier,button]of [['Editable','#export-standalone-btn'],['Playable','#export-playable-btn']]){
    await page.locator('[data-right-tab="project"]').click();const [download]=await Promise.all([page.waitForEvent('download'),page.locator(button).click()]);const output=path.join(dir,tier+'.html');await download.saveAs(output);const exported=await context.newPage();await exported.goto(origin+'/'+path.relative(root,output).replace(/\\/g,'/'));await exported.waitForFunction(()=>typeof serializeProject==='function');
    if(tier==='Editable'){if(!await exported.locator('#play-btn').isVisible())await exported.locator('#chrome-toggle-btn').click();assert.deepStrictEqual(library(await state(exported)),[portable]);await exported.locator('#play-btn').click();}else{assert.deepStrictEqual(library(await state(exported)),[]);if(await exported.locator('#start-overlay-btn').isVisible())await exported.locator('#start-overlay-btn').click();}
    await runtime(exported,tier);record(tier+' exact export retains applied runtime settings'+(tier==='Editable'?' and authoring library':' without unnecessary authoring library'));await exported.close();
  }
}
(async()=>{let browser,page;try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  context.on('page',p=>{p.on('pageerror',e=>proof.pageErrors.push(e.message));p.on('console',m=>{if(m.type()==='error')proof.consoleErrors.push(m.text());});p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))proof.externalRequests.push(r.url());});});
  page=await context.newPage();await page.goto(origin+'/editor/index.html');await page.waitForFunction(()=>typeof serializeProject==='function');if(await page.locator('#first-run-skip').isVisible())await page.locator('#first-run-skip').click();await page.locator('#import-project-input').setInputFiles(fixturePath);await page.waitForFunction(()=>placed.some(o=>o.id==='preset-deck'));
  await campaign(page,context,origin);
  assert.deepStrictEqual(proof.pageErrors,[]);assert.deepStrictEqual(proof.consoleErrors,[]);assert.deepStrictEqual(proof.externalRequests,[]);proof.finalFingerprint=require('./real-demo-program-state').fingerprint();assert.equal(proof.finalFingerprint,proof.fingerprint);proof.status='NATIVE_COMPONENT_PRESET_SAVE_SHARE_HISTORY_PERSISTENCE_BOTH_EXPORTS_PASS';
}catch(error){proof.status='OBSERVED_FAILURE_OR_AUTOMATION';proof.failure=error.stack;proof.failureObservation=await state(page).catch(()=>null);await page?.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});process.exitCode=1;
}finally{proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({runId,status:proof.status,steps:proof.steps.length,failure:proof.failure,pageErrors:proof.pageErrors,consoleErrors:proof.consoleErrors,externalRequests:proof.externalRequests}));await browser?.close();server.close();}})();
