// Targeted normal-input play: reads scene state for navigation, never modifies it.
const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..');
const routes={
 'forest-range':[[-8,-3],[0,1],[8,4],[10,7]],
 'painted-wilds':[[-5,-4],[5,-2],[7,6]],
 'dungeon-descent':[[-10,6],[-4,8],[-9,6],[-9,-7],[4,-8],[10,-7],[11,0],[13,0]],
 'assembly-line':[[0,12,'f']],
 'shifting-facility':[[0,-12],[-4,-9],[-4,-3],[-4,3],[5,2,'f'],[-4,5],[-4,12],[0,15,'f']],
 'blacksite':[[4,2],[0,6],[0,12],[0,17],[0,4]],
 'signal-zero':[[0,8],[0,6],[0,6]],
 'textured-adventure':[[5,3],[-4,4],[0,-6],[0,8]],
 'temple-switch-puzzle':[[-10,-6],[10,-6],[0,5],[0,11]],
 'sentinel-maze':[[-6,-8],[-2,-8],[-2,-11],[5,-11],[8,-8],[8,0],[10,4],[10,9],[9,9]],
 'relic-runner-2':[[-8,-3],[-1,-3],[2,0],[7,0],[10,0]],
 'power-station':[[5,2,'f'],[-5,4,'f'],[4,-2,'engineer'],[4,-6.5,'f'],[6,-10],[4,-11,'f'],[1,-9],[0,-6,'f']],
 'npc-puzzle-adventure':[[3,1,'sailor'],[0,6,'f'],[0,11],[0,6]],
};
const snapshot=page=>page.evaluate(()=>({level:currentLevelIndex,state:window.__gameState,flags:window.__gameFlags,inventory:window.__gameInventory,ended:gameEnded,playtime:window.__gamePlaytimeSeconds,position:player?.entity.position,controller:player?.controllerType,basis:app.camera.getBasis().forward,text:document.body.innerText,dialogue:document.getElementById('dialogue-overlay').classList.contains('visible')}));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 for(const id of process.argv.slice(2)){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),report={id,inputs:[],errors:[],started:new Date().toISOString()};
  page.on('pageerror',e=>report.errors.push(e.message));const dest=path.join(__dirname,'sample-play',id);fs.mkdirSync(dest,{recursive:true});
  try{
   await page.goto('http://localhost:8837/dist/games/'+id+'.html',{waitUntil:'load',timeout:60000});
   await page.locator('#start-overlay-btn').click({timeout:20000});await page.waitForTimeout(2000);
   report.start=await snapshot(page);let keys=new Set();
   async function hold(next){for(const k of keys)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!keys.has(k))await page.keyboard.down(k);keys=next;}
   async function go(x,z){let start=Date.now(),loops=0,lastDist=Infinity,stalled=0;const initial=await snapshot(page),initialLevel=initial.level;
    while(Date.now()-start<30000){const s=await snapshot(page);if(s.ended)return 'ended';if(s.level!==initialLevel){await hold(new Set());return 'level-transition';}if(!s.position)return 'no-player';const dx=x-s.position.x,dz=z-s.position.z,dist=Math.hypot(dx,dz);if(dist<.42){await hold(new Set());await page.waitForTimeout(160);return 'arrived';}
     let forward=s.controller==='topdown'?{x:0,z:-1}:s.basis;const len=Math.hypot(forward.x,forward.z);forward={x:forward.x/len,z:forward.z/len};const dot=dx*forward.x+dz*forward.z,right=s.controller==='topdown'?dx:dx*forward.z-dz*forward.x;const next=new Set();if(Math.abs(dot)>dist*.3)next.add(dot>0?'w':'s');if(Math.abs(right)>dist*.3)next.add(right>0?'d':'a');
     await hold(next);await page.waitForTimeout(150);loops++;stalled=dist>lastDist-.01?stalled+1:0;lastDist=dist;
     if(stalled>20){await page.keyboard.press('Space');stalled=0;report.inputs.push({jump:'navigation obstacle',x,z});}
    }
    await hold(new Set());return 'timed-out';
   }
   let frameIndex=0;for(const [x,z,interaction]of routes[id]||[]){const result=await go(x,z);report.inputs.push({target:[x,z],result,state:await snapshot(page)});await page.screenshot({path:path.join(dest,'step-'+(++frameIndex)+'.png')});if(result==='ended')break;
    if(interaction){await hold(new Set());await page.keyboard.press('f');await page.waitForTimeout(300);
     if(interaction==='engineer'){await page.getByRole('button',{name:'Yes, please',exact:true}).click({timeout:4000});}
     if(interaction==='sailor'){await page.getByRole('button',{name:'May I have the key?',exact:true}).click({timeout:4000});await page.getByRole('button',{name:'Continue',exact:true}).click({timeout:4000});await page.keyboard.press('f');await page.waitForTimeout(150);if(await page.locator('#dialogue-overlay.visible').count()){const buttons=page.locator('#dialogue-choices button');await buttons.first().click();if(await page.locator('#dialogue-overlay.visible').count())await buttons.first().click();}}
     if(await page.locator('#dialogue-overlay.visible').count())await page.locator('#dialogue-choices button').first().click();
    }
    if((await snapshot(page)).ended)break;
   }
   await hold(new Set());await page.waitForTimeout(800);report.final=await snapshot(page);await page.screenshot({path:path.join(dest,'outcome.png')});report.completed=true;
   if(report.final.ended){await page.getByRole('button',{name:'Restart',exact:true}).click();await page.waitForLoadState('load');await page.locator('#start-overlay-btn').click();await page.waitForTimeout(500);report.restart=await snapshot(page);await page.screenshot({path:path.join(dest,'restart.png')});}
  }catch(e){report.failure=e.stack;report.final=await snapshot(page).catch(()=>null);await page.screenshot({path:path.join(dest,'failure.png')}).catch(()=>{});}
  report.finished=new Date().toISOString();fs.writeFileSync(path.join(dest,'play.json'),JSON.stringify(report,null,2));await context.close();console.log(id+': '+(report.final?.ended?'OUTCOME':report.failure?'FAILED':'NO OUTCOME')+' '+JSON.stringify(report.final?.state));
 }
 await browser.close();
})();


