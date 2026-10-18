'use strict';
// Actual-controller browser regressions. Internal exports only, never Game 29.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {composeExportHTML}=require('../build/export-template');
const explicit=process.argv.includes('--explicit');
const support=process.argv.includes('--support');
const historicalFirstperson=process.argv.includes('--historical-firstperson');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'qualification/real-demo-collision/controller-labs');fs.mkdirSync(folder,{recursive:true});
const modules=['00-inspector-fields','00-collision-filter-2d','00-collider-2d','00-trigger-collider-2d','00-one-way-2d','00-character-slope-2d','00-moving-platform-2d','00-body-2d','00-authoring-schema','00-authoring-plumbing','00-character-tile-query','00-sprite-authoring','00-authoring-language','00-gameplay-presets','00-onboarding','00-sprite-starters','01-editor'];
const inputs={htmlTemplate:fs.readFileSync(path.join(root,'editor/index.html'),'utf8'),engineJS:fs.readFileSync(path.join(root,'dist/opus-engine.js'),'utf8'),editorJS:modules.map(n=>fs.readFileSync(path.join(root,`editor/src/${n}.js`),'utf8')).join('\n'),templateJS:fs.readFileSync(path.join(root,'build/export-template.js'),'utf8')};
function cube(id,pos,scale,solid=true){return {kind:'cube',id,name:id,position:pos,scale,color:solid?[.7,.25,.2]:[.1,.8,.35],rotationY:0,solid,behaviors:[],spin:0,patrol:null,ai:null,mesh:'cube'};}
function project(family,speed){
  const p=JSON.parse(fs.readFileSync(path.join(root,'games/arsenal-run.json'))), l=p.levels[0];
  p.meta={title:`Internal ${family} collision lab`,visibility:'internal'};p.prefabs=[];p.assets=[];p.textures=[];p.audio=[];p.itemDefs=[];p.currentLevelIndex=0;p.startLevelIndex=0;p.levels=[l];
  l.playerSettings={controllerType:family,initialYaw:0,moveSpeed:support?6:speed,acceleration:10000,collisionRadius:.5,jumpEnabled:true,gravity:20,jumpSpeed:8,maxHealth:100,rotateToMovement:false,drag:.001};
  // Canonical first-person projects historically omit this third-person flag.
  // Native browser fixture must exercise that actual compatibility surface.
  if(historicalFirstperson&&family==='firstperson')delete l.playerSettings.jumpEnabled;
  l.ui={startScreen:{enabled:true,title:p.meta.title,description:'Internal actual-controller fixture',buttonText:'Start lab'}};
  l.objects=[{...cube('spawn',[0,.55,0],[.1,.1,.1],false),isSpawnPoint:true},cube('pass-through',[0,.55,2],[2,2,.2],false),cube('pass-through-north',[0,.55,-2],[2,2,.2],false),
    cube('north-wall',[0,2,-4.98],[20,4,.1]),cube('south-wall',[0,2,4.98],[20,4,.1]),cube('west-wall',[-4.98,2,0],[.1,4,20]),cube('east-wall',[4.98,2,0],[.1,4,20])];
  if(['firstperson','thirdperson'].includes(family))l.objects.push(cube('floor',[0,-.5,0],[60,1,60]));
  if(explicit)for(const wall of l.objects.filter(o=>o.id.endsWith('-wall'))){
    wall.collider={shape:'box',size:{x:wall.scale[0],y:4,z:wall.scale[2]},offset:{x:0,y:3,z:0}};
    wall.position[1]=-1;wall.scale[1]=.1;
  }
  if(support)l.objects=[{...cube('spawn',speed==='on-footprint'?[3,1,0]:[0,1,3],[.1,.1,.1],false),isSpawnPoint:true},
    {...cube('yaw-platform',[0,0,0],[1,1,10]),rotationY:Math.PI/2},cube('ground',[0,-.5,0],[60,1,60])];
  return p;
}
async function main(){
  const id='labs-'+new Date().toISOString().replace(/[-:.]/g,''),out=path.join(folder,id);fs.mkdirSync(out);
  const report={runId:id,sourceFingerprint:require('./real-demo-program-state').fingerprint(),startedAt:new Date().toISOString(),method:'Real browser, same exported controller source, keyboard held; requestAnimationFrame cadence partitioned by qualification timer without changing dt or Transform.',cases:[]};
  const server=http.createServer((req,res)=>{const file=path.join(out,path.basename(req.url.split('?')[0]));fs.readFile(file,(e,d)=>{res.writeHead(e?404:200,{'Content-Type':'text/html'});res.end(e?'Not found':d);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    for(const family of (historicalFirstperson?['firstperson']:explicit||support?['firstperson','thirdperson']:['firstperson','thirdperson','topdown','hovercraft']))for(const speed of (support?['on-footprint','off-footprint']:[6,100]))for(const fps of [60,30,15]){
      const name=`${family}-${speed}-${fps}`,p=project(family,speed),html=composeExportHTML({...inputs,title:name,playableOnly:true,embeddedProjectJSON:JSON.stringify(p)});fs.writeFileSync(path.join(out,name+'.html'),html);
      const requestedCase=process.argv.find(a=>a.startsWith('--case='))?.slice(7);if(requestedCase&&requestedCase!==name)continue;
      const result={family,speed,fps,explicit,support,status:'UNKNOWN',errors:[]};report.cases.push(result);
      const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
      // Real elapsed time is retained; only scheduling cadence is partitioned.
      await page.addInitScript(fps=>{window.requestAnimationFrame=fn=>setTimeout(()=>fn(performance.now()),1000/fps);window.cancelAnimationFrame=id=>clearTimeout(id);},fps);
      try{
        await page.goto(`http://127.0.0.1:${server.address().port}/${name}.html`);await page.locator('#start-overlay-btn').click();await page.waitForFunction(()=>typeof player!=='undefined'&&player&&playMode);
        await page.evaluate(()=>{window.__labSamples=[];const controller=PLAYER_CONTROLLERS[player.controllerType],original=controller.update;controller.update=function(dt){const before={x:player.entity.position.x,z:player.entity.position.z},r=original.apply(this,arguments);if(window.__labSamples.length<600)window.__labSamples.push({dt,before,after:{x:player.entity.position.x,y:player.entity.position.y,z:player.entity.position.z}});return r;};});
        result.start=await page.evaluate(()=>({sim:simElapsed,position:player.entity.position,family:player.controllerType}));
        if(support){
          await page.keyboard.down('w');await page.waitForFunction(t=>simElapsed>t+.08,result.start.sim);await page.keyboard.up('w');
          await page.waitForFunction(t=>simElapsed>t+1.5,result.start.sim);
          result.final=await page.evaluate(()=>({sim:simElapsed,position:player.entity.position,samples:window.__labSamples}));
          result.expectedHeight=speed==='on-footprint'?1.05:.55;
          result.status=Math.abs(result.final.position.y-result.expectedHeight)<.02&&result.errors.length===0?'PASS':'FAIL';
          await page.screenshot({path:path.join(out,name+'.png')});console.log(JSON.stringify({name,status:result.status,expectedHeight:result.expectedHeight,position:result.final.position}));continue;
        }
        await page.keyboard.down('w');try{await page.waitForFunction(t=>simElapsed>t+1.5,result.start.sim,{timeout:20000});}finally{await page.keyboard.up('w');}
        result.final=await page.evaluate(()=>({sim:simElapsed,position:player.entity.position,samples:window.__labSamples}));
        result.wallBlocked=Math.abs(result.final.position.z)<=4.48+.01;
        result.moved=Math.hypot(result.final.position.x-result.start.position.x,result.final.position.z-result.start.position.z)>.5;
        result.passThroughObserved=Math.abs(result.final.position.z)>2.2;
        {
          let held=[];
          result.cornerSamples=[];
          try{
            for(let step=0;step<(family==='hovercraft'?80:family==='thirdperson'&&speed===100?100:20);step++) {
              let keys=['w','d'];
              if(family==='hovercraft'){
                const state=await page.evaluate(()=>({x:player.entity.position.x,z:player.entity.position.z,yaw:player.entity.rotationY}));
                let angle=Math.atan2(4.98-state.x,4.98-state.z)-state.yaw;while(angle>Math.PI)angle-=Math.PI*2;while(angle<-Math.PI)angle+=Math.PI*2;
                keys=['w',...(Math.abs(angle)>.12?[angle>0?'a':'d']:[])];
              }
              if(family==='thirdperson'){
                // Chase camera changes its basis while moving. Drive the same
                // world-space corner using native keys, never mutate camera/player.
                const state=await page.evaluate(()=>({basis:app.camera.getBasis().forward,position:player.entity.position})),basis=state.basis;
                const len=Math.hypot(basis.x,basis.z)||1,fx=basis.x/len,fz=basis.z/len;
                const dx=4.98-state.position.x,dz=4.98-state.position.z,distance=Math.hypot(dx,dz)||1;
                const f=dx*fx+dz*fz,r=dx*fz-dz*fx;
                keys=[...(Math.abs(f)/distance>.38?[f>0?'w':'s']:[]),...(Math.abs(r)/distance>.38?[r>0?'d':'a']:[])];
              }
              for(const key of held.filter(k=>!keys.includes(k)))await page.keyboard.up(key);
              for(const key of keys.filter(k=>!held.includes(k)))await page.keyboard.down(key);
              held=keys;
              const sim=await page.evaluate(()=>simElapsed);
              await page.waitForFunction(t=>simElapsed>t+.1,sim,{timeout:20000});
              result.cornerSamples.push({keys,position:await page.evaluate(()=>({x:player.entity.position.x,z:player.entity.position.z}))});
              const last=result.cornerSamples.at(-1).position;
              if(Math.abs(last.x)>4.3&&Math.abs(last.z)>4.3)break;
            }
          }finally{for(const key of held)await page.keyboard.up(key);}
          result.corner=await page.evaluate(()=>({sim:simElapsed,position:player.entity.position}));
          // Fast chase-camera-relative input can leave a previously reached
          // corner. Judge observed traversal/contact, not the arbitrary last
          // sample, and strengthen containment to EVERY observed frame.
          result.wallSlideObserved=result.cornerSamples.some(s=>Math.abs(s.position.x)>3.5);
          result.twoWallCornerObserved=result.cornerSamples.some(s=>Math.abs(s.position.x)>4.3&&Math.abs(s.position.z)>4.3);
          const allFrames=await page.evaluate(()=>window.__labSamples);
          result.cornerBlocked=[...allFrames.map(s=>s.after),...result.cornerSamples.map(s=>s.position),result.corner.position].every(p=>Math.abs(p.x)<4.5&&Math.abs(p.z)<4.5);
        }
        result.status=result.wallBlocked&&result.moved&&result.passThroughObserved&&result.wallSlideObserved&&result.twoWallCornerObserved&&result.cornerBlocked&&result.errors.length===0?'PASS':'FAIL';
        await page.screenshot({path:path.join(out,name+'.png')});
        console.log(JSON.stringify({name,status:result.status,start:result.start.position,final:result.final.position}));
      }catch(e){result.status='AUTOMATION_FAILURE';result.failure=e.stack;console.error(name,e.message);}
      finally{await context.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');}
    }
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
