'use strict';
// Native authoring characterization, not a new state registry or readiness verdict.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='state-key-audit-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/phase-240',runId);
fs.mkdirSync(dir,{recursive:true});
const proof={runId,startedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),errors:[],external:[]};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'});res.end(e?'Not found':b);});});
(async()=>{let browser,p;try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});p=await browser.newPage({viewport:{width:1280,height:960}});p.setDefaultTimeout(10000);
  p.on('dialog',d=>d.accept());p.on('pageerror',e=>proof.errors.push(e.stack));p.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(r.url()))proof.external.push(r.url());});
  await p.goto('http://127.0.0.1:'+server.address().port+(process.argv.includes('--package')?'/dist/engine-site/editor/index.html':'/editor/index.html'));await p.locator('[data-sprite-starter-id="platformer-sky-steps"]').click();
  if(process.argv.includes('--hints')){await p.locator('[data-left-tab="games"]').click();await p.locator('#games-starter-catalog summary').click();await p.locator('[data-catalog-starter="firstperson-wayfinder"]').click();}
  await p.keyboard.press('Control+k');await p.locator('#command-palette-input').fill('add cube');await p.keyboard.press('Enter');
  const snap=()=>p.evaluate(()=>JSON.parse(JSON.stringify(serializeProject()))),before=await snap();
  await p.locator('#b-action').selectOption('setFlagTrue');await p.locator('#b-trigger').selectOption('start');
  const input=p.locator('#b-fields [data-field="name"]');await input.fill('GateOpen');
  proof.currentFlagControl=await input.evaluate(el=>({tag:el.tagName,type:el.type,list:el.getAttribute('list'),value:el.value}));
  assert.equal(proof.currentFlagControl.type,'text');
  await p.locator('#add-behavior-btn').click();const authored=await snap();assert.notDeepStrictEqual(authored,before);
  await p.locator('#undo-btn').click();assert.deepStrictEqual(await snap(),before);await p.locator('#redo-btn').click();assert.deepStrictEqual(await snap(),authored);
  if(process.argv.includes('--hints')){
    await p.locator('[data-right-tab="scene"]').click();const index=await p.evaluate(()=>placed.findIndex(o=>o.behaviors?.some(b=>b.action==='setFlagTrue'&&b.params?.name==='GateOpen')));await p.locator('.scene-list-item[data-index="'+index+'"]').click({modifiers:['Shift']});
    await p.locator('#b-action').selectOption('setFlagFalse');const hinted=p.locator('#b-fields [data-field="name"]');
    const list=await hinted.getAttribute('list');assert(list);assert.deepStrictEqual(await p.locator('#'+list+' option').evaluateAll(els=>els.map(el=>el.value)),['GateOpen']);
    assert((await p.locator('#b-fields').textContent()).includes('does not rename other uses'));await hinted.fill('GateOpen');assert.deepStrictEqual(await snap(),authored,'Preparing a suggested name must not change project/history');
    proof.hintsReadOnly=true;await p.locator('#b-fields').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(dir,'state-key-hints.png')});
  }
  // Declaration metadata and shared condition fields are read only; no synthetic gameplay writes.
  proof.stateFields=await p.evaluate(()=>{
    const describe=([id,d])=>({id,fields:d.fields.map(f=>({key:f.key,type:f.type,label:f.label}))});
    return {actions:Object.entries(ACTION_TYPES).filter(([id])=>/Flag|Counter|Timer|ObjectVariable/.test(id)).map(describe),conditions:Object.entries(CONDITION_TYPES).filter(([id])=>/flag|counter|timer|Variable/i.test(id)).map(describe)};
  });
  assert(proof.stateFields.actions.some(d=>d.id==='setFlagTrue'));
  await p.locator('#play-btn').click();await p.waitForFunction(()=>playMode&&!app.paused&&window.__gameFlags?.GateOpen===true);
  proof.nativeOnStartFlag=true;if(await p.evaluate(()=>!!document.pointerLockElement))await p.keyboard.press('Escape');await p.locator('#play-btn').click();await p.waitForFunction(()=>!playMode);assert.deepStrictEqual(await snap(),authored);
  await p.screenshot({path:path.join(dir,'state-key-authoring.png')});
  await p.keyboard.press('Control+k');await p.locator('#command-palette-input').fill('add trigger');await p.keyboard.press('Enter');
  const zoneId=await p.evaluate(()=>selectedItem.id);
  await p.locator('[data-zone-mode]').selectOption('fog');await p.locator('[data-zone-density]').fill('0.04');
  const beforeZone=await snap();await p.locator('[data-zone-apply]').click();const afterZone=await snap();assert.notDeepStrictEqual(afterZone,beforeZone);
  await p.locator('#undo-btn').click();assert.deepStrictEqual(await snap(),beforeZone);await p.locator('#redo-btn').click();assert.deepStrictEqual(await snap(),afterZone);
  await p.locator('[data-right-tab="scene"]').click();const zoneIndex=await p.evaluate(id=>placed.findIndex(o=>o.id===id),zoneId);await p.locator('.scene-list-item[data-index="'+zoneIndex+'"]').click({modifiers:['Shift']});
  await p.locator('[data-zone-mode]').scrollIntoViewIfNeeded();assert.equal(await p.locator('[data-zone-mode]').inputValue(),'fog');
  proof.nativeFogSetupWholeHistory=true;await p.screenshot({path:path.join(dir,'discoverable-environment-zone.png')});
  if(process.argv.includes('--hints')){
    await p.locator('[data-right-tab="scene"]').click();const sourceIndex=await p.evaluate(()=>placed.findIndex(o=>o.behaviors?.some(b=>b.action==='setFlagTrue'&&b.params?.name==='GateOpen')));await p.locator('.scene-list-item[data-index="'+sourceIndex+'"]').click({modifiers:['Shift']});
    await p.locator('#prefab-name-input').fill('Flag owner reusable');const preCapture=await snap();await p.locator('#save-prefab-btn').click();const captured=await snap();await p.locator('#undo-btn').click();assert.deepStrictEqual(await snap(),preCapture);await p.locator('#redo-btn').click();assert.deepStrictEqual(await snap(),captured);
    const ids=await p.evaluate(()=>placed.map(o=>o.id));await p.locator('[data-left-tab="prefabs"]').click();const pi=await p.evaluate(()=>prefabs.findIndex(x=>x.name==='Flag owner reusable')),label=p.locator('#palette-prefab-'+pi+' > span');await label.scrollIntoViewIfNeeded();const b=await label.boundingBox(),v=await p.locator('#game').boundingBox();await p.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await p.mouse.down();await p.mouse.move(v.x+v.width*.7,v.y+v.height*.6,{steps:12});await p.mouse.up();await p.waitForFunction(ids=>placed.some(o=>!ids.includes(o.id)),ids);
    const reused=await snap();await p.locator('#undo-btn').click();assert.deepStrictEqual(await snap(),captured);await p.locator('#redo-btn').click();assert.deepStrictEqual(await snap(),reused);proof.independentPrefabReuse=true;
    await p.locator('[data-right-tab="project"]').click();if(!await p.locator('#project-name-input').isVisible())await p.locator('[data-section="save"]').click();await p.locator('#project-name-input').fill(runId);await p.locator('#save-btn').click();const saved=await snap();await p.reload();await p.waitForFunction(()=>typeof serializeProject==='function');if(!await p.locator('#play-btn').isVisible())await p.locator('#chrome-toggle-btn').click();if(await p.evaluate(()=>playMode)){await p.locator('#play-btn').click();await p.waitForFunction(()=>!playMode);}await p.locator('#project-home-btn').click();await p.locator('#project-home-search').fill(runId);await p.getByRole('button',{name:'Open '+runId,exact:true}).click();assert.deepStrictEqual(await snap(),saved);proof.namedSaveReloadHomeOpen=true;
    if(process.argv.includes('--params-noop')){
      await p.locator('[data-right-tab="scene"]').click();const index=await p.evaluate(()=>placed.findIndex(o=>o.sourcePrefabName==='Flag owner reusable'));await p.locator('.scene-list-item[data-index="'+index+'"]').click({modifiers:['Shift']});
      await p.locator('#param-new-name').fill('Unbound default');await p.locator('#param-new-type').selectOption('number');await p.locator('#param-add-btn').click();
      const beforeClear=await snap(),historyBefore=await p.evaluate(()=>undoStack.length);await p.locator('[data-override-clear]').click();
      proof.parameterNoop={projectUnchanged:JSON.stringify(await snap())===JSON.stringify(beforeClear),historyBefore,historyAfter:await p.evaluate(()=>undoStack.length)};
      assert.deepStrictEqual(await snap(),beforeClear,'Clearing an absent unbound override should preserve complete authored data');assert.equal(proof.parameterNoop.historyAfter,historyBefore,'Clearing an absent override must not add Undo');
      await p.locator('[data-override-value]').fill('12');const overridden=await snap(),beforeRealClear=await p.evaluate(()=>undoStack.length);await p.locator('[data-override-clear]').click();const cleared=await snap();assert.notDeepStrictEqual(cleared,overridden);assert.equal(await p.evaluate(()=>undoStack.length),beforeRealClear+1);await p.locator('#undo-btn').click();assert.deepStrictEqual(await snap(),overridden);await p.locator('#redo-btn').click();assert.deepStrictEqual(await snap(),cleared);proof.parameterChangedClearWholeHistory=true;
    }
    if(process.argv.includes('--params-noop')){
      await p.locator('[data-right-tab="project"]').click();if(!await p.locator('#project-name-input').isVisible())await p.locator('[data-section="save"]').click();await p.locator('#save-btn').click();const afterClearSave=await snap();await p.reload();await p.waitForFunction(()=>typeof serializeProject==='function');if(!await p.locator('#play-btn').isVisible())await p.locator('#chrome-toggle-btn').click();if(await p.evaluate(()=>playMode)){if(await p.evaluate(()=>!!document.pointerLockElement))await p.keyboard.press('Escape');await p.locator('#play-btn').click();await p.waitForFunction(()=>!playMode);}await p.locator('#project-home-btn').click();await p.locator('#project-home-search').fill(runId);await p.getByRole('button',{name:'Open '+runId,exact:true}).click();assert.deepStrictEqual(await snap(),afterClearSave);proof.parameterClearSaveReloadHomeOpen=true;
    }
    for(const[tier,selector]of[['Editable','#export-standalone-btn'],['Playable','#export-playable-btn']]){
      await p.locator('[data-right-tab="project"]').click();if(!await p.locator(selector).isVisible())await p.locator('[data-section="importexport"]').click();
      const expected=await p.evaluate(playable=>JSON.parse(JSON.stringify(serializeProject({includeTilesets:!playable}))),tier==='Playable'),pending=p.waitForEvent('download');await require('./native-export-review')(p,selector);const file=path.join(dir,tier+'.html');await(await pending).saveAs(file);
      const q=await browser.newPage({viewport:{width:1280,height:960}});q.on('pageerror',e=>proof.errors.push(e.stack));q.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))proof.external.push(r.url());});try{
        await q.goto(require('url').pathToFileURL(file).href);await q.waitForFunction(()=>typeof serializeProject==='function');assert.deepStrictEqual(await q.evaluate(()=>JSON.parse(JSON.stringify(serializeProject()))),expected);await q.waitForFunction(()=>playMode&&!app.paused&&window.__gameFlags?.GateOpen===true);
        if(!await q.evaluate(()=>!!document.pointerLockElement))await q.locator('#game').click();const x=await q.evaluate(()=>player.entity.position.x);await q.keyboard.down('KeyD');try{await q.waitForFunction(x=>player.entity.position.x>x+.5,x);}finally{await q.keyboard.up('KeyD');}proof[tier]='Actual reviewed file, canonical equality, native flag/movement PASS';
      }finally{await q.close();}
    }
  }
  assert.deepStrictEqual(proof.errors,[]);assert.deepStrictEqual(proof.external,[]);
  proof.finding=proof.hintsReadOnly?'Bounded current-level Flag/Counter/Timer hints reduce repeated-key typing. Names remain case-sensitive text, not rename-safe identities; Object Variables/slots/tags are not newly covered.':'Existing free-text Flag key authors and executes with whole-project Undo/Redo and exact Stop restoration. Typed state-key identity/rename-safe discovery is not established.';
  proof.status='NATIVE_STATE_KEY_CHARACTERIZATION_PASS';
}catch(e){proof.status='FAIL';proof.failure=e.stack;process.exitCode=1;await p?.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));proof.resourcesClosed=true;proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}})();
