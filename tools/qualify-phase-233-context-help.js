'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),runId='context-help-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/phase-233',runId);fs.mkdirSync(dir,{recursive:true});
const proof={runId,startedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),errors:[],external:[],topics:[]};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream'});res.end(e?'Not found':b);});});
(async()=>{let browser;try{
await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});const p=await browser.newPage({viewport:{width:1280,height:960}});p.setDefaultTimeout(10000);p.on('pageerror',e=>proof.errors.push(e.stack));p.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(r.url()))proof.external.push(r.url());});
await p.goto('http://127.0.0.1:'+server.address().port+'/editor/index.html');await p.locator('[data-first-run-choice="guided"]').click();await p.locator('#onboarding-pause').click();
const cb=await p.locator('#palette-cube').boundingBox(),vb=await p.locator('#game').boundingBox();await p.mouse.move(cb.x+cb.width*.5,cb.y+cb.height*.5);await p.mouse.down();await p.mouse.move(vb.x+vb.width*.65,vb.y+vb.height*.6,{steps:12});await p.mouse.up();await p.waitForFunction(()=>placed.length===1);
const snap=()=>p.evaluate(()=>JSON.stringify({project:serializeProject(),undo:undoStack,redo:redoStack,tutorial:onboardingStore.read()}));const before=await snap();
await p.locator('[data-help-topic="create"]').click();proof.beforeHelpText=await p.locator('#editor-help-topics').innerText();proof.hasConcreteExample=await p.locator('.editor-help-example').count()>0;await p.locator('#editor-help-close').click();proof.focusReturnedToCreate=await p.locator('[data-help-topic="create"]').evaluate(el=>document.activeElement===el);assert.equal(await snap(),before);
assert(proof.hasConcreteExample,'Contextual surface Help needs a concrete manual example, not only generic prose');assert(proof.focusReturnedToCreate,'Close must restore invoking contextual Help focus');
for(const topic of ['create','viewport','inspector','level','ui','project']){
if(['inspector','level','ui','project'].includes(topic))await p.locator('[data-right-tab="'+topic+'"]').click();
await p.locator('[data-help-topic="'+topic+'"]').click();const example=p.locator('.editor-help-example');assert.equal(await example.count(),1);const text=await example.innerText();assert(text.length>60);proof.topics.push({topic,text});await p.keyboard.press('Escape');assert(await p.locator('[data-help-topic="'+topic+'"]').evaluate(el=>document.activeElement===el));assert.equal(await snap(),before);
}
await p.setViewportSize({width:920,height:780});await p.locator('#help-btn').click();assert.equal(await p.locator('.editor-help-example').count(),7);await p.screenshot({path:path.join(dir,'Context-help-narrow.png')});await p.locator('#editor-help-close').click();assert.equal(await snap(),before);
proof.status='NATIVE_CONTEXT_HELP_MANUAL_EXAMPLES_FOCUS_READ_ONLY_NARROW_PASS';assert.deepStrictEqual(proof.errors,[]);assert.deepStrictEqual(proof.external,[]);
}catch(e){proof.status='FAIL';proof.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));proof.resourcesClosed=true;proof.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}})();

