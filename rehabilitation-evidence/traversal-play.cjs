// Bounded native-input traversal proof; all page evaluation is read-only.
const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..');
const read=page=>page.evaluate(()=>({level:currentLevelIndex,state:window.__gameState,ended:gameEnded,sim:simElapsed,position:player.entity.position,velocity:player.velocity,grounded:thirdPersonGrounded,basis:app.camera.getBasis().forward,text:document.body.innerText,solids:placed.filter(o=>o.entity?.solid).map(o=>({id:o.id,p:o.entity.position,scale:o.entity.scale}))}));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const id of process.argv.slice(2)){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),dest=path.join(__dirname,'traversal-play',id);fs.mkdirSync(dest,{recursive:true});
  const report={id,method:'Read-only instrumentation and native keyboard input; no player/state mutation.',events:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));let keys=new Set();
  const snapshot=async label=>{const s=await read(page);report.events.push({label,...s});await page.screenshot({path:path.join(dest,label+'.png')});console.log(id,label,JSON.stringify({position:s.position,grounded:s.grounded,sim:s.sim,ended:s.ended}));return s;};
  const hold=async next=>{for(const k of keys)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!keys.has(k))await page.keyboard.down(k);keys=next;};
  async function waitSim(amount,limit=15000){const start=(await read(page)).sim,deadline=Date.now()+limit;while(Date.now()<deadline){await page.waitForTimeout(60);const s=await read(page);if(s.ended||s.sim-start>=amount)return s;}throw Error('Simulation wait bound');}
  async function brake(){const begin=await read(page),vx=begin.velocity.x,vz=begin.velocity.z;if(Math.hypot(vx,vz)<.35){await hold(new Set());return;}
   for(let i=0;i<4;i++){const s=await read(page);if(s.ended||s.velocity.x*vx+s.velocity.z*vz<=0||Math.hypot(s.velocity.x,s.velocity.z)<.65)break;const len=Math.hypot(s.basis.x,s.basis.z),fx=s.basis.x/len,fz=s.basis.z/len,dot=-vx*fx-vz*fz,right=-vx*fz+vz*fx,next=new Set();if(Math.abs(dot)>.25)next.add(dot>0?'w':'s');if(Math.abs(right)>.25)next.add(right>0?'d':'a');await hold(next);await waitSim(.06);}
   await hold(new Set());
  }
  async function move(x,z,{jump=false,tolerance=.45,seconds=6}={}){
   const begin=(await read(page)).sim,deadline=Date.now()+18000;let jumped=false;
   while(Date.now()<deadline){const s=await read(page);if(s.ended)return 'ended';if(s.sim-begin>seconds)break;const dx=x-s.position.x,dz=z-s.position.z,d=Math.hypot(dx,dz);if(d<tolerance){await brake();await waitSim(.12);return 'arrived';}
    const len=Math.hypot(s.basis.x,s.basis.z),fx=s.basis.x/len,fz=s.basis.z/len,dot=dx*fx+dz*fz,right=dx*fz-dz*fx,next=new Set();if(Math.abs(dot)>.30*d)next.add(dot>0?'w':'s');if(Math.abs(right)>.3*d)next.add(right>0?'d':'a');
    if(jump&&!jumped&&s.grounded){next.add('Space');jumped=true;report.events.push({input:'jump',position:s.position,sim:s.sim});}
    await hold(next);await waitSim(.06);
   }await hold(new Set());return 'timed-out';
  }
  try{
   await page.goto('http://localhost:8837/dist/games/'+id+'.html',{waitUntil:'load',timeout:60000});await page.locator('#start-overlay-btn').click({timeout:20000});await waitSim(.6);await snapshot('opening');
   if(id==='skyway-trial'){
    // Native crouch reduces travel speed for precise steps without turning
    // the chase camera through the 180-degree reversal caused by braking.
    await hold(new Set(['w','c']));
    for(const [edge,center]of[[3.45,8],[8.45,13],[13.45,18],[18.45,23],[23.45,28]]){
     for(let i=0;i<90;i++){const s=await read(page);if(s.ended||s.position.z>=edge)break;await waitSim(.06);}let s=await snapshot('edge-'+edge);if(s.ended)break;
     report.events.push({input:'native jump with forward momentum',position:s.position,sim:s.sim});await hold(new Set(['w','Space']));await waitSim(.16);await hold(new Set(['w']));await waitSim(.32);await hold(new Set());
     for(let i=0;i<50;i++){s=await read(page);if(s.ended||(s.grounded&&s.position.z>=center-2))break;await waitSim(.06);}s=await snapshot('land-'+center);if(s.ended||s.position.y<-.5)break;await hold(new Set(['w','c']));
    }
   }else{
    await move(1.2,0,{tolerance:.2});await waitSim(.2);
    // Wait for the crossing slab's near half, then leap onto it.
    for(let i=0;i<70;i++){const s=await read(page),m=s.solids.find(o=>o.id==='obj57');if(m.p.x<5.2)break;await waitSim(.08);}
    let s=await read(page),m=s.solids.find(o=>o.id==='obj57');await move(m.p.x+.6,0,{jump:true,tolerance:.45,seconds:1.2});await waitSim(.35);await snapshot('crossing-slab');
    for(let i=0;i<70;i++){s=await read(page);m=s.solids.find(o=>o.id==='obj57');if(m.p.x>7.5)break;await waitSim(.08);}
    await move(11,0,{jump:true,tolerance:.45,seconds:2});await waitSim(.4);await snapshot('far-platform');
    await move(15.5,0,{jump:true,tolerance:.4,seconds:2});await waitSim(.35);await snapshot('lift-boarded');
    await page.keyboard.press('f',{delay:120});await waitSim(8.4,22000);await snapshot('lift-raised');
    await move(20,0,{jump:true,tolerance:.6,seconds:3});await waitSim(.6);await snapshot('summit-attempt');
   }
   await hold(new Set());report.final=await snapshot('outcome');
   if(report.final.ended){await page.getByRole('button',{name:'Restart',exact:true}).click();await page.waitForLoadState('load');await page.locator('#start-overlay-btn').click({timeout:20000});await waitSim(.35);report.restart=await snapshot('restart');}
  }catch(e){report.failure=e.stack;report.final=await read(page).catch(()=>null);await page.screenshot({path:path.join(dest,'failure.png')}).catch(()=>{});}
  fs.writeFileSync(path.join(dest,'play.json'),JSON.stringify(report,null,2));await context.close();
 }await browser.close();})();
