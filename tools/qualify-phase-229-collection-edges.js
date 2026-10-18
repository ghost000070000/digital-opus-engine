'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), runId = 'collection-edges-' + new Date().toISOString().replace(/[-:.]/g, ''), dir = path.join(root, 'qualification/phase-229', runId); fs.mkdirSync(dir, { recursive: true });
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), errors: [], external: [] };
const server = http.createServer((req, res) => { const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); } fs.readFile(file, (e, b) => { res.writeHead(e ? 404 : 200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(e ? 'Not found' : b); }); });
(async () => { let browser; try {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); browser = await chromium.launch({ channel: 'msedge', headless: true }); const p = await browser.newPage({ viewport: { width: 1280, height: 960 } }); p.setDefaultTimeout(10000); p.on('pageerror', e => proof.errors.push(e.stack)); p.on('dialog', d => d.accept()); p.on('request', r => { if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(r.url())) proof.external.push(r.url()); });
  await p.goto('http://127.0.0.1:' + server.address().port + '/editor/index.html'); await p.waitForFunction(() => typeof serializeProject === 'function'); if (await p.locator('#first-run-skip').isVisible()) await p.locator('#first-run-skip').click();

  const project = require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project; project.meta.title = 'Private229 mixed edge scene';
  const cube = (id, name, membership, parentId) => ({kind:'cube',id,name,position:[25,2,0],scale:[1,1,1],color:[.4,.6,.8],rotationY:0,mesh:'cube',behaviors:[],parentId,components:{'scene-collection':membership}});
  project.levels[0].objects.push(cube('obj700','3D parent',{version:1,name:'Props'}),cube('obj701','3D child',{version:1,name:'Props'},'obj700'),cube('obj702','Future membership',{version:99,name:'Future',extra:['obj700']}),cube('obj703','Null membership',null),cube('obj704','Extension membership',{version:1,name:'Extended',extra:{retained:true}}));
  const file = path.join(dir,'mixed.json'); fs.writeFileSync(file,JSON.stringify(project)); await p.locator('#import-project-input').setInputFiles(file); await p.waitForFunction(()=>projectMeta.title==='Private229 mixed edge scene');
  const snap = () => p.evaluate(()=>JSON.stringify(serializeProject()));
  await p.locator('[data-right-tab="scene"]').click(); await p.locator('#scene-collections > summary').click();
  const original = await snap();
  const parentIndex = await p.evaluate(()=>placed.findIndex(o=>o.id==='obj700'));
  await p.locator('[data-caret-index="'+parentIndex+'"]').click(); assert.equal(await p.locator('.scene-list-item').count(),12);
  await p.locator('#scene-collection-filter').selectOption('name:Props'); assert.equal(await p.locator('.scene-list-item').count(),2); assert.equal(await snap(),original);
  await p.locator('#scene-collection-select').click(); assert.equal(await p.evaluate(()=>selectedItems.size),2);
  await p.locator('#scene-collection-name').fill('3D Scenery'); await p.locator('#scene-collection-assign').click(); const assigned=await snap(), history=await p.evaluate(()=>undoStack.length);
  await p.locator('#scene-collection-assign').click(); assert.equal(await snap(),assigned); assert.equal(await p.evaluate(()=>undoStack.length),history);
  await p.locator('#scene-collection-clear').click(); const cleared=await snap(); assert.equal(await p.evaluate(()=>placed.filter(o=>['obj700','obj701'].includes(o.id)).some(o=>o.components?.['scene-collection'])),false);
  await p.locator('#undo-btn').click(); assert.equal(await snap(),assigned); await p.locator('#redo-btn').click(); assert.equal(await snap(),cleared);
  await p.locator('#scene-collection-filter').selectOption('__none'); const unavailableRows=await p.locator('.scene-list-item').count(); assert.equal(unavailableRows,12);
  for(const name of ['Future membership','Null membership','Extension membership']) {
    await p.locator('[data-right-tab="scene"]').click(); await p.locator('#scene-collection-filter').selectOption(''); await p.locator('#scene-search').fill(name); await p.locator('.scene-list-item').click(); await p.locator('[data-right-tab="scene"]').click();
    const before=await snap(), h=await p.evaluate(()=>undoStack.length); await p.locator('#scene-collection-name').fill('Replace'); await p.locator('#scene-collection-clear').click(); assert.equal(await snap(),before); assert.equal(await p.evaluate(()=>undoStack.length),h);
    if(name!=='Extension membership') { await p.locator('#scene-collection-assign').click(); assert.equal(await snap(),before); assert.equal(await p.evaluate(()=>undoStack.length),h); }
  }
  await p.locator('#scene-search').fill(''); await p.locator('#scene-collection-filter').selectOption('name:Extended'); await p.locator('#scene-collection-select').click();
  const beforePlay=await snap(), h=await p.evaluate(()=>undoStack.length); await p.locator('#play-btn').click(); await p.waitForFunction(()=>playMode);
  for(const id of ['assign','rename','clear','select']) assert(await p.locator('#scene-collection-'+id).isDisabled());
  // Explicit stale dispatch adversary, not a normal authored gesture.
  assert.equal(await p.evaluate(()=>changeSceneCollection('clear')),false); assert.equal(await p.evaluate(()=>undoStack.length),h);
  await p.keyboard.press('Escape'); await p.locator('#play-btn').click(); await p.waitForFunction(()=>!playMode); assert.equal(await snap(),beforePlay);
  await p.setViewportSize({width:920,height:780}); await p.locator('[data-right-tab="scene"]').click(); await p.screenshot({path:path.join(dir,'Collections-narrow.png')});
  assert.deepStrictEqual(proof.errors,[]); assert.deepStrictEqual(proof.external,[]);
  proof.status='NATIVE_MIXED_3D_HIERARCHY_CLEAR_NOOP_FUTURE_NULL_EXTENSION_PLAY_NARROW_PASS'; proof.unavailableRows=unavailableRows;
} catch(e) {proof.status='FAIL';proof.failure=e.stack;process.exitCode=1;} finally {if(browser)await browser.close();await new Promise(r=>server.close(r));proof.resourcesClosed=true;proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}})();

