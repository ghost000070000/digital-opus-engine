'use strict';
// Native creator actions; evaluate is read-only authored/runtime observation.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='ai-authoring-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/real-demo-collision',runId);
fs.mkdirSync(dir,{recursive:true});const proof={runId,fingerprint:require('./real-demo-program-state').fingerprint(),startedAt:new Date().toISOString(),steps:[],errors:[],status:'IN_PROGRESS'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(e?'Not found':data);});});
async function select(page){await page.locator('[data-right-tab="scene"]').click();await page.locator('#scene-search').fill('Sentry');await page.locator('.scene-list-item').filter({has:page.locator('.scene-list-item-name').filter({hasText:/^Sentry$/})}).first().click();await page.locator('[data-right-tab="inspector"]').click();}
async function observe(page,label){const ai=await page.evaluate(()=>({collideWithSolids:selectedItem.entity.ai.collideWithSolids===true,collisionRadius:selectedItem.entity.ai.collisionRadius}));proof.steps.push({label,observedAt:new Date().toISOString(),ai});return ai;}
(async()=>{let browser;try{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();page.on('pageerror',e=>proof.errors.push(e.message));
await page.goto(origin+'/editor/index.html?game=signal-zero');await page.waitForFunction(()=>document.querySelector('#games-status')?.textContent.startsWith('Loaded '));if(!await page.locator('[data-right-tab="scene"]').isVisible())await page.locator('#chrome-toggle-btn').click();await select(page);
assert.strictEqual((await observe(page,'Canonical Sentry opt-in')).collideWithSolids,true);
await page.locator('#f-ai-solid-collision').uncheck();assert.strictEqual((await observe(page,'Native disable')).collideWithSolids,false);
await page.locator('#undo-btn').click();await select(page);assert.strictEqual((await observe(page,'Undo restores collision')).collideWithSolids,true);
await page.locator('#redo-btn').click();await select(page);assert.strictEqual((await observe(page,'Redo restores legacy movement')).collideWithSolids,false);
await page.locator('#f-ai-solid-collision').check();await page.locator('#f-ai-collision-radius').fill('0.4');await page.locator('#f-ai-collision-radius').press('Tab');const expected=await observe(page,'Native collision radius');assert.strictEqual(expected.collisionRadius,.4);
await page.locator('[data-right-tab="project"]').click();await page.locator('#project-name-input').fill(runId);await page.locator('#save-btn').click();
await page.locator('[data-right-tab="inspector"]').click();await page.locator('#f-ai-solid-collision').uncheck();
await page.locator('[data-right-tab="project"]').click();await page.locator('#project-list-select').selectOption(runId);await page.locator('#load-btn').click();await select(page);assert.deepStrictEqual(await observe(page,'Save/Load restores policy'),expected);
await page.reload();await page.waitForFunction(()=>document.querySelector('#games-status')?.textContent.startsWith('Loaded '));if(!await page.locator('[data-right-tab="scene"]').isVisible())await page.locator('#chrome-toggle-btn').click();await page.locator('[data-right-tab="project"]').click();await page.locator('#project-list-select').selectOption(runId);await page.locator('#load-btn').click();await select(page);assert.deepStrictEqual(await observe(page,'Browser reload and local load'),expected);
await page.locator('[data-right-tab="project"]').click();
for(const [tier,button] of [['editable','#export-standalone-alt-btn'],['playable','#export-playable-btn']]){
const pending=page.waitForEvent('download');await page.locator(button).click();const download=await pending,file=path.join(dir,tier+'.html');await download.saveAs(file);
const exported=await context.newPage();exported.on('pageerror',e=>proof.errors.push(e.message));await exported.goto(origin+'/'+path.relative(root,file).replace(/\\/g,'/'));await exported.waitForFunction(()=>typeof placed!=='undefined'&&placed.some(i=>i.id==='l1-enemy'));
const ai=await exported.evaluate(()=>{const a=placed.find(i=>i.id==='l1-enemy').entity.ai;return{collideWithSolids:a.collideWithSolids,collisionRadius:a.collisionRadius};});assert.deepStrictEqual(ai,expected);proof.steps.push({label:tier+' native export policy persistence',observedAt:new Date().toISOString(),ai});
await exported.locator('#start-overlay-btn').click();await exported.waitForFunction(()=>playMode&&!!player);let moved=false;
for(const key of ['w','s','a','d']){const before=await exported.evaluate(()=>({sim:simElapsed,x:player.entity.position.x,z:player.entity.position.z}));await exported.keyboard.down(key);await exported.waitForFunction(t=>simElapsed>t+1,before.sim);await exported.keyboard.up(key);const after=await exported.evaluate(()=>({x:player.entity.position.x,z:player.entity.position.z}));moved=Math.hypot(after.x-before.x,after.z-before.z)>.1;proof.steps.push({label:tier+' native input attempt',key,observedAt:new Date().toISOString(),before,after,moved});if(moved)break;}
assert(moved,'at least one real input direction moves the player; a blocked forward direction is not a failure');await exported.screenshot({path:path.join(dir,tier+'.png')});await exported.close();
}
assert.strictEqual(proof.errors.length,0);proof.status='AI_AUTHORING_PERSISTENCE_EXPORT_PASS';await context.close();
}catch(e){proof.status='QUALIFICATION_FAILED_NOT_COLLISION_VERDICT';proof.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,dir,failure:proof.failure,steps:proof.steps.length}));}})();
