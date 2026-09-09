'use strict';
// Deliberate marketing-frame capture using normal keyboard input only.
// Runtime reads are telemetry for navigation; game state is never mutated.
const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'rehabilitation-evidence','public-v5-targeted');
const ids=process.argv.slice(2).length?process.argv.slice(2):['relic-frontier','npc-puzzle-adventure','power-station','signal-zero','survival-arena-2','valley-run','assembly-line','skyway-trial'];
const read=p=>p.evaluate(()=>({pos:player?.entity?.position,basis:app?.camera?.getBasis?.(),ended:typeof gameEnded!=='undefined'&&gameEnded,sim:window.__gamePlaytimeSeconds,text:document.body.innerText}));
async function hold(page,key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
async function walk(page,target,limit=14000,tolerance=.8){const end=Date.now()+limit;while(Date.now()<end){const s=await read(page);if(s.ended||!s.pos||!s.basis)return false;const dx=target[0]-s.pos.x,dz=target[1]-s.pos.z,d=Math.hypot(dx,dz);if(d<tolerance)return true;const f=s.basis.forward,fl=Math.hypot(f.x,f.z)||1,fx=f.x/fl,fz=f.z/fl,forward=dx*fx+dz*fz,side=dx*fz-dz*fx,key=Math.abs(forward)>Math.abs(side)?(forward>0?'w':'s'):(side>0?'d':'a');await hold(page,key,Math.min(180,Math.max(70,d*40)));}return false;}
(async()=>{fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 for(const id of ids){const dest=path.join(OUT,id);fs.mkdirSync(dest,{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],report={id,inputOnly:true,events:[],errors,startedAt:new Date().toISOString()};page.on('pageerror',e=>errors.push(e.message));
  const shot=async name=>{await page.screenshot({path:path.join(dest,name+'.png')});report.events.push({capture:name,state:await read(page)});};
  try{await page.goto('http://localhost:8837/dist/games/'+id+'.html',{waitUntil:'load',timeout:60000});await page.locator('#start-overlay-btn').click();await page.waitForTimeout(1800);await shot('opening');
   if(id==='signal-zero'){
    await walk(page,[0,8],18000,.7);await shot('level-1-relay');await hold(page,'f',180);await page.waitForTimeout(1800);await shot('level-2-opening');await walk(page,[0,4],9000,.8);await shot('level-2-reactor');
   }else if(id==='relic-frontier'){
    await walk(page,[-4,3],9000,.8);await shot('combat-court');await walk(page,[2,3],9000,.8);await shot('weapon-approach');
   }else if(id==='valley-run'){
    await walk(page,[0,-12],9000,.9);await shot('first-gate');await walk(page,[2,-8],9000,.9);await shot('route-depth');
   }else if(id==='survival-arena-2'){
    await hold(page,'w',700);await hold(page,'a',260);await hold(page,'w',650);await shot('storm-circuit');await page.waitForTimeout(2200);await shot('survival-action');
   }else{
    await hold(page,'w',650);await page.waitForTimeout(500);await shot('approach');await hold(page,'d',320);await hold(page,'w',480);await page.waitForTimeout(500);await shot('detail');
   }
   report.completed=true;
  }catch(e){report.failure=e.stack;report.completed=false;}
  report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(dest,'capture.json'),JSON.stringify(report,null,2)+'\n');console.log(id,report.completed?'captured':'FAILED','errors='+errors.length);await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
