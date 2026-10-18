'use strict';
// Qualification-only. Guarded by the actual all-game acceptance matrix.
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {fingerprint}=require('./real-demo-program-state');
const root=path.resolve(__dirname,'..'),base=path.join(root,'qualification/real-demo-collision');
const expected=process.argv.find(a=>a.startsWith('--expected='))?.slice(11);
const requiredSeconds=3600;
const profileSmoke=process.argv.includes('--profile-smoke');
const profiles=[
 ['arsenal-run'],['power-grid'],['signal-relay'],['silent-sector','--wall=obj3003','--nearest-wall-point','--crouch'],['relic-frontier','--wall=rehab-2'],
 ['forest-range','--wall=obj739','--nearest-wall-point','--no-face'],['relic-island','--terrain-corner'],['npc-puzzle-adventure'],['dungeon-descent'],
 ['survival-arena','--wall=promo-4'],['survival-arena-3','--wall=deep5-1'],
 ['moving-temple','--wall=rehab-2'],['skyway-trial','--wall=obj53'],['valley-run','--wall=promo-5-section-3'],
 ['moving-temple','--platforms','--scenario=platform'],
 ['skyway-trial','--platforms','--scenario=platform'],
 ['valley-run','--platforms','--scenario=platform'],
 ['valley-run','--pass-through','--scenario=pass-through'],
 ['npc-puzzle-adventure','--progress','--scenario=progression'],
 ['blacksite','--progress','--scenario=progression'],
 ['signal-zero','--progress','--scenario=progression']
];
function save(file,data){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n');fs.renameSync(tmp,file);}
async function main(){
 if(!expected||fingerprint()!==expected)throw new Error('Exact expected product fingerprint required');
 const matrix=JSON.parse(fs.readFileSync(path.join(base,'real-demo-collision-matrix.json')));
 if(matrix.sourceFingerprint!==expected||matrix.games.length!==28||matrix.games.some(g=>!['PASS','NOT_APPLICABLE'].includes(g.status)))throw new Error('All 28 actual-demo acceptance rows must qualify before this final soak');
 const stateFile=path.join(base,profileSmoke?'real-gameplay-profile-smoke-state.json':'real-gameplay-soak-state.json');
 for(const file of ['real-gameplay-soak-state.json','real-gameplay-profile-smoke-state.json'])if(fs.existsSync(path.join(base,file))){const old=JSON.parse(fs.readFileSync(path.join(base,file)));if(old.status==='RUNNING'){try{process.kill(old.pid,0);throw new Error('An existing gameplay qualification PID is alive; do not duplicate');}catch(e){if(e.code!=='ESRCH')throw e;}}}
 const runId=(profileSmoke?'real-gameplay-profile-smoke-':'real-gameplay-soak-')+new Date().toISOString().replace(/[-:.]/g,''),out=path.join(base,runId);fs.mkdirSync(out);
 const state={runId,pid:process.pid,status:'RUNNING',startedAt:new Date().toISOString(),startFingerprint:expected,midpointFingerprint:null,finalFingerprint:null,requiredSeconds,activeSeconds:0,monotonicWorkloadSeconds:0,observedControllerSeconds:0,cycles:[],memoryObservations:[],games:[...new Set(profiles.map(p=>p[0]))],method:'Native canonical Playable/start/menu/keyboard/mouse/restart browser loops; time is min(monotonic workload time, observed actual unpaused controller dt), not wall elapsed'};
 const persist=()=>{state.updatedAt=new Date().toISOString();save(stateFile,state);save(path.join(out,'state.json'),state);};persist();
 try{
  while(state.activeSeconds<requiredSeconds&&(!profileSmoke||state.cycles.length<profiles.length)){
   const args=profiles[state.cycles.length%profiles.length],id=args[0],scenario=args.find(a=>a.startsWith('--scenario='))?.slice(11)||'wall-corner';
   if(fingerprint()!==expected)throw new Error('Frozen product changed; invalidate this entire soak');
   const before=new Set(fs.readdirSync(base)),start=process.hrtime.bigint();
   const log=fs.openSync(path.join(out,`cycle-${state.cycles.length+1}.log`),'wx');
   const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'tools/real-demo-browser-probe.js'),...args.filter(a=>!a.startsWith('--scenario=')&&a!=='--no-face'),...(scenario==='wall-corner'?['--walls','--corners',...(args.includes('--no-face')?[]:['--face'])]:[]),'--extended','--fast'],{cwd:root,windowsHide:true,stdio:['ignore',log,log]});state.childPid=child.pid;persist();child.once('error',reject);child.once('exit',resolve);}).finally(()=>fs.closeSync(log));
   delete state.childPid;
   const seconds=Number(process.hrtime.bigint()-start)/1e9;
   if(code!==0)throw new Error(`Browser workload exited ${code}; inspect log, not a collision verdict`);
   const dirs=fs.readdirSync(base).filter(n=>n.startsWith('probe-')&&!before.has(n));
   if(dirs.length!==1)throw new Error('Ambiguous new probe identity; preserve evidence and investigate');
   const result=JSON.parse(fs.readFileSync(path.join(base,dirs[0],'results.json'))),game=result.games[0];
   if(result.fingerprint!==expected||!result.endedAt||result.games.length!==1||game.id!==id)throw new Error('Incomplete/mismatched canonical workload');
   const m=game.final?.metrics;
   if(game.status!=='GAMEPLAY_STARTED'||!game.movementObserved||!game.inputAttempts||game.errors.length||game.consoleErrors.length||game.externalRequests.length||m?.instrumentationErrors.length||m?.independentWallPenetrations.length||m?.aiSolidEntries.length)throw new Error(`Unqualified actual-game workload ${id}; inspect evidence before labeling product vs automation failure`);
   if(scenario==='wall-corner'&&(game.wallRoute?.status!=='SUSTAINED_REAL_WALL_CONTACT'||!['SINGLE_SOLID_CORNER_CONTACT_OBSERVED','TWO_SOLID_CORNER_CONTACT_OBSERVED'].includes(game.corner?.status)))throw new Error(`Sustained wall/corner coverage missing in ${id}; not itself a product verdict`);
   if(scenario==='platform'&&(!game.platformRoutes?.length||game.platformRoutes.some(p=>!['NATIVE_PLATFORM_LANDING_OBSERVED','NATIVE_LANDING_AND_IDLE_CARRY_OBSERVED'].includes(p.status))))throw new Error(`Platform route coverage missing in ${id}`);
   if(scenario==='progression'&&game.progression?.status!=='NATIVE_TRIGGER_LEVEL_TRANSITION_OBSERVED')throw new Error(`Native progression trigger coverage missing in ${id}`);
   if(scenario==='pass-through'&&game.authoredObjectRoute?.status!=='NATIVE_MOVEMENT_THROUGH_VISUAL_BOUNDS')throw new Error(`Native pass-through entry/exit coverage missing in ${id}`);
   if(game.restart?.status!=='RESTARTED_NATIVE_MOVEMENT_OBSERVED')throw new Error(`Restart movement not observed in ${id}`);
   const observed=m.activeControllerSeconds;
   if(!(Number.isFinite(observed)&&observed>0))throw new Error('Actual controller-active time absent');
   state.monotonicWorkloadSeconds+=seconds;state.observedControllerSeconds+=observed;
   state.activeSeconds=Math.min(state.monotonicWorkloadSeconds,state.observedControllerSeconds);
   const fp=fingerprint();if(fp!==expected)throw new Error('Frozen product changed during native workload');
   if(!state.midpointFingerprint&&state.activeSeconds>=requiredSeconds/2)state.midpointFingerprint=fp;
   state.cycles.push({id,scenario,family:game.final.player.family,probeRunId:result.runId,observedAt:new Date().toISOString(),monotonicSeconds:seconds,controllerSeconds:observed,inputAttempts:game.inputAttempts,wall:game.wallRoute?.status,wallContactReturns:game.wallRoute?.contactCount||0,corner:game.corner?.status,platforms:game.platformRoutes?.map(p=>p.status),progression:game.progression?.status,terrainFrames:m.frames.filter(f=>f.terrainHeight!==null).length,verticalGroundedReturns:m.verticalContacts.filter(c=>c.grounded).length,restart:game.restart.status,errors:[],fingerprint:fp});
   state.memoryObservations.push({observedAt:new Date().toISOString(),id,browserHeapEstimate:game.heapEstimate,runner:process.memoryUsage(),note:'Fresh browser context estimates; no forced-GC or persistent-session leak claim'});persist();
  }
  state.finalFingerprint=fingerprint();if(state.finalFingerprint!==expected||(!profileSmoke&&!state.midpointFingerprint))throw new Error('Frozen final/midpoint fingerprint gate failed');
  if(profileSmoke){state.status='PROFILE_SMOKE_PASSED_NOT_FINAL_SOAK';state.endedAt=new Date().toISOString();persist();return;}
  state.status='SOAK_WORKLOAD_PASSED_PENDING_FINAL_REVIEW';state.endedAt=new Date().toISOString();persist();save(path.join(base,'real-gameplay-soak.json'),state);
 }catch(e){state.status='STOPPED_REQUIRES_DIAGNOSIS';state.failure=e.stack;state.endedAt=new Date().toISOString();persist();throw e;}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
