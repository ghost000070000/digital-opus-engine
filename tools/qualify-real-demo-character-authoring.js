'use strict';
// Native authoring only; browser evaluation observes, never writes product state.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='character-authoring-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/real-demo-collision',runId);
fs.mkdirSync(dir,{recursive:true});const proof={runId,fingerprint:require('./real-demo-program-state').fingerprint(),startedAt:new Date().toISOString(),steps:[],errors:[],status:'IN_PROGRESS'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(e?'Not found':data);});});
async function level(page){await page.locator('[data-right-tab="level"]').click();if(!await page.locator('#player-body-height').isVisible())await page.locator('[data-section="player"]').click();}
async function observe(page,label){const value=await page.evaluate(()=>({height:currentPlayerSettings.collisionHeight??null,follow:currentPlayerSettings.visual?.followBodyHeight===true,offset:currentPlayerSettings.visual?.positionOffset}));proof.steps.push({label,observedAt:new Date().toISOString(),...value});return value;}
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();page.on('pageerror',e=>proof.errors.push(e.message));
 await page.goto(origin+'/editor/index.html?game=forest-range');await page.waitForFunction(()=>document.querySelector('#games-status')?.textContent.startsWith('Loaded '));if(!await page.locator('[data-right-tab="level"]').isVisible())await page.locator('#chrome-toggle-btn').click();await level(page);
 await observe(page,'Original canonical authored character');
 // Canonical stock characters may already be fitted. Exercise the historical
 // authoring starting point through the visible control, never hidden state.
 await page.locator('#player-body-height').fill('');await page.locator('#player-body-height').press('Tab');
 const original=await observe(page,'Native legacy-body starting point');assert.strictEqual(original.height,null);
 await page.locator('#player-body-fit').click();const fitted=await observe(page,'Native Fit Body to Character');assert.strictEqual(fitted.height,1.855);assert.strictEqual(fitted.offset.y,-.9275);assert.strictEqual(fitted.follow,true);
 await page.locator('#undo-btn').click();await level(page);assert.deepStrictEqual(await observe(page,'Undo fit'),original);
 await page.locator('#redo-btn').click();await level(page);assert.deepStrictEqual(await observe(page,'Redo fit'),fitted);
 await page.locator('#player-body-height').fill('2');await page.locator('#player-body-height').press('Tab');assert.strictEqual((await observe(page,'Native explicit height')).height,2);
 await page.locator('#undo-btn').click();await level(page);assert.deepStrictEqual(await observe(page,'Undo height'),fitted);
 await page.locator('[data-right-tab="project"]').click();await page.locator('#project-name-input').fill(runId);await page.locator('#save-btn').click();
 await level(page);await page.locator('#player-body-height').fill('');await page.locator('#player-body-height').press('Tab');assert.strictEqual((await observe(page,'Native restore legacy')).height,null);
 await page.locator('[data-right-tab="project"]').click();await page.locator('#project-list-select').selectOption(runId);await page.locator('#load-btn').click();await level(page);assert.deepStrictEqual(await observe(page,'Save/Load restores fit'),fitted);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#games-status')?.textContent.startsWith('Loaded '));if(!await page.locator('[data-right-tab="project"]').isVisible())await page.locator('#chrome-toggle-btn').click();await page.locator('[data-right-tab="project"]').click();await page.locator('#project-list-select').selectOption(runId);await page.locator('#load-btn').click();await level(page);assert.deepStrictEqual(await observe(page,'Browser reload and local project load'),fitted);
 await page.locator('#player-body-fit').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,'creator-fit.png')});await page.locator('[data-right-tab="project"]').click();
 for(const [tier,button] of [['editable','#export-standalone-alt-btn'],['playable','#export-playable-btn']]) {
  const pending=page.waitForEvent('download');await page.locator(button).click();const download=await pending,file=path.join(dir,tier+'.html');await download.saveAs(file);
  const exported=await context.newPage();exported.on('pageerror',e=>proof.errors.push(e.message));await exported.goto(origin+'/'+path.relative(root,file).replace(/\\/g,'/'));await exported.waitForFunction(()=>typeof currentPlayerSettings!=='undefined'&&currentPlayerSettings.visual?.assetId==='showcase-ranger');
  assert.deepStrictEqual(await observe(exported,tier+' real UI export preserves fit'),fitted);
  await exported.locator('#start-overlay-btn').click();await exported.waitForFunction(()=>!!player&&playMode);assert.strictEqual(await exported.evaluate(()=>player.entity.scale.y),1.855);
  const before=await exported.evaluate(()=>({sim:simElapsed,x:player.entity.position.x,z:player.entity.position.z}));await exported.keyboard.down('s');await exported.waitForFunction(t=>simElapsed>t+1,before.sim);await exported.keyboard.up('s');const after=await exported.evaluate(()=>({x:player.entity.position.x,z:player.entity.position.z,height:player.entity.scale.y}));assert(Math.hypot(after.x-before.x,after.z-before.z)>.1);
  await exported.keyboard.down('c');await exported.waitForFunction(()=>player.entity.scale.y<1.855);assert(Math.abs(await exported.evaluate(()=>playerVisualEntity.scale.y)-.55)<1e-8);await exported.keyboard.up('c');await exported.waitForFunction(()=>player.entity.scale.y===1.855);
  proof.steps.push({label:tier+' native movement and fitted crouch/stand',observedAt:new Date().toISOString(),before,after});await exported.screenshot({path:path.join(dir,tier+'.png')});await exported.close();
 }
 assert.strictEqual(proof.errors.length,0);proof.status='AUTHORING_HISTORY_PERSISTENCE_EXPORT_PASS';await context.close();
}catch(e){proof.status='QUALIFICATION_FAILED_NOT_COLLISION_VERDICT';proof.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,runId,steps:proof.steps.length,failure:proof.failure}));}})();
