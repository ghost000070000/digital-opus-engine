// Final standalone smoke and real opening frames. Does not alter gameplay state.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),phase=process.argv[2]||'final-review';
const catalog=require('../games/catalog.json'),only=process.argv.slice(3);
const selected=only.length?catalog.games.filter(g=>only.includes(g.id)):catalog.games;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const results=[];
for(const g of selected){const out=path.join(root,'rehabilitation-evidence',phase,g.id);fs.mkdirSync(out,{recursive:true});const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const report={id:g.id,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'games',g.file))).digest('hex'),errors,capturedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/games',g.id+'.html'))).digest('hex')};
try{await page.goto('http://localhost:8837/dist/games/'+g.id+'.html',{waitUntil:'load',timeout:60000});await page.screenshot({path:path.join(out,'start.png')});
 const p=JSON.parse(fs.readFileSync(path.join(root,'games',g.file))),level=p.levels?.[p.startLevelIndex||0]||p,start=level.ui?.startScreen;
 if(start?.enabled)await page.getByRole('button',{name:start.buttonText||'Start',exact:true}).click({timeout:20000});
 await page.waitForFunction(()=>typeof player!=='undefined'&&player&&(!playerFrozen||gameEnded),{timeout:90000});
 await page.waitForFunction(()=>gameEnded||(window.__gamePlaytimeSeconds||0)>=1,{timeout:60000});
 await page.waitForTimeout(400);
 report.state=await page.evaluate(()=>({title:document.title,sim:window.__gamePlaytimeSeconds,ended:gameEnded,text:document.body.innerText,controller:player?.controllerType,bodyVisible:player?.entity?.visible,visualVisible:playerVisualEntity?.visible,canvas:[canvas.width,canvas.height],webglLost:canvas.getContext('webgl2').isContextLost(),helpers:placed.filter(o=>o.isTrigger||o.isWaypoint||o.isSpawnPoint||o.isPathPoint||['camera','light','spawner'].includes(o.kind)).filter(o=>o.entity?.visible).map(o=>o.name||o.id),objects:placed.length}));
 await page.screenshot({path:path.join(out,'opening.png')});
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');await page.keyboard.press('Escape');await page.waitForTimeout(200);
 report.pauseText=await page.locator('body').innerText();
 report.passed=!errors.length&&!report.state.webglLost&&!report.state.helpers.length&&report.state.title===g.title&&!(report.state.controller==='firstperson'&&report.state.bodyVisible);
}catch(e){report.failure=e.message;report.passed=false;}
fs.writeFileSync(path.join(out,'smoke.json'),JSON.stringify(report,null,2));results.push(report);await context.close();console.log(g.id,report.passed?'PASS':'FAIL',report.failure||errors.join(';'));
}
await browser.close();if(only.length){const summary=path.join(root,'rehabilitation-evidence',phase,'summary.json');if(fs.existsSync(summary)){const previous=JSON.parse(fs.readFileSync(summary));for(const r of previous)if(!results.some(n=>n.id===r.id))results.push(r);results.sort((a,b)=>catalog.games.findIndex(g=>g.id===a.id)-catalog.games.findIndex(g=>g.id===b.id));}}fs.writeFileSync(path.join(root,'rehabilitation-evidence',phase,'summary.json'),JSON.stringify(results,null,2));console.log(phase,results.filter(r=>r.passed).length+'/'+results.length);if(results.some(r=>!r.passed))process.exitCode=1;
})();
