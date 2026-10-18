'use strict';
// Real UI mutations; browser evaluation observes state only.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),{chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='event-baseline-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/phase-184',runId);fs.mkdirSync(dir,{recursive:true});
const proof={runId,fingerprint:require('./real-demo-program-state').fingerprint(),errors:[],observations:[]};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'application/octet-stream'});res.end(e?'Not found':b);});});
(async()=>{let browser,p;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});p=await browser.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(10000);p.on('pageerror',e=>proof.errors.push(e.message));
 await p.goto('http://127.0.0.1:'+server.address().port+'/qualification/phase-183/crossfade-20261012T053506699Z/Editable.html');await p.waitForFunction(()=>typeof serializeProject==='function');
 if(await p.getByRole('button',{name:'Begin',exact:true}).isVisible())await p.getByRole('button',{name:'Begin',exact:true}).click();
 if(!await p.locator('[data-right-tab="scene"]').isVisible())await p.locator('#chrome-toggle-btn').click();
 await p.waitForFunction(()=>!playMode&&document.querySelector('[data-right-tab="scene"]').getBoundingClientRect().top>40);
 async function select(){await p.locator('[data-right-tab="scene"]').click();const index=await p.evaluate(()=>placed.findIndex(x=>x.id==='event-indicator'));assert(index>=0);await p.locator('.scene-list-item[data-index="'+index+'"]').click();await p.locator('[data-right-tab="inspector"]').click();}
 async function observe(label){const state=await p.evaluate(()=>{const item=placed.find(x=>x.id==='event-indicator'),asset=findAssetById(item.assetId);return {assetId:asset.id,events:JSON.parse(JSON.stringify(asset.animationEvents||[])),undo:undoStack.length,redo:redoStack.length,playMode};});proof.observations.push({label,...state});return state;}
 await select();const before=await observe('before');await p.locator('#anim-event-add-btn').click();const added=await observe('native-add');assert.equal(added.events.length,before.events.length+1);assert.equal(added.undo,before.undo+1);
 const event=added.events[added.events.length-1];await p.locator('[data-event-time="'+event.id+'"]').fill('0.4');await p.locator('[data-event-time="'+event.id+'"]').press('Tab');const edited=await observe('native-time-edit');assert.equal(edited.events.at(-1).time,.4);
 await p.locator('#undo-btn').click();const undone=await observe('native-undo');await select();await p.screenshot({path:path.join(dir,'event-after-undo.png')});
 proof.timeEditMissingHistory=edited.undo===added.undo;proof.addUndoFailed=undone.events.length!==before.events.length;
 assert(proof.timeEditMissingHistory);assert(proof.addUndoFailed);assert.deepStrictEqual(proof.errors,[]);proof.status='NATIVE_EVENT_TIME_HISTORY_AND_ASSET_SNAPSHOT_DEFECTS_REPRODUCED';
 }catch(e){proof.status='FAILED_ATTEMPT';proof.failure=e.stack;process.exitCode=1;await p?.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});}finally{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));proof.resourcesClosed=true;proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}})();
