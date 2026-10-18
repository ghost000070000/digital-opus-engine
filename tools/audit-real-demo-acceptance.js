'use strict';
// Qualification evidence audit. No gameplay writes and no automatic READY.
const fs=require('fs'),path=require('path');
const {fingerprint}=require('./real-demo-program-state');
const root=path.resolve(__dirname,'..'),base=path.join(root,'qualification/real-demo-collision'),fp=fingerprint();
const catalog=JSON.parse(fs.readFileSync(path.join(root,'games/catalog.json'))).games.filter(g=>g.visibility==='public');
const records=[];
for(const name of fs.readdirSync(base).filter(n=>n.startsWith('probe-'))){
 const file=path.join(base,name,'results.json');if(!fs.existsSync(file))continue;
 let p;try{p=JSON.parse(fs.readFileSync(file));}catch{continue;}
 if(p.fingerprint!==fp||!p.endedAt)continue;
 for(const game of p.games)records.push({proof:p,game,file:path.relative(root,file).replace(/\\/g,'/')});
}
function clean(r){const g=r.game,m=g.final?.metrics;return g.status==='GAMEPLAY_STARTED'&&g.movementObserved&&g.inputAttempts>0&&m&&
 !g.errors.length&&!g.consoleErrors.length&&!g.externalRequests.length&&!m.instrumentationErrors.length&&!m.independentWallPenetrations.length&&!m.aiSolidEntries.length;}
const platformIds={'valley-run':['obj101','obj102','obj103','obj104'],'skyway-trial':['obj53','obj54','obj55','obj56','obj57'],'moving-temple':['obj57']};
function witness(rows,test){const r=rows.find(test);return r?{runId:r.proof.runId,file:r.file,observedAt:r.proof.endedAt}:null;}
const audit={version:1,observedAt:new Date().toISOString(),sourceFingerprint:fp,status:'PENDING_HUMAN_ENGINEERING_ADJUDICATION',method:'Completed exact-current native browser records only; failed route selection is a coverage gap, not a product FAIL. AABB pass-through observation is not triangle contact proof.',games:[]};
for(const entry of catalog){
 const p=JSON.parse(fs.readFileSync(path.join(root,'games',entry.file))),all=records.filter(r=>r.game.id===entry.id),rows=all.filter(r=>r.proof.tier==='playable'&&clean(r));
 const family=p.levels[0].playerSettings?.controllerType||'hovercraft',g={id:entry.id,family,gaps:[],evidence:[],excludedRuns:all.filter(r=>!clean(r)).map(r=>({runId:r.proof.runId,status:r.game.status,errors:r.game.errors?.length,penetrations:r.game.final?.metrics.independentWallPenetrations.length}))};
 function requireWitness(field,test){g[field]=witness(rows,test);if(g[field])g.evidence.push(g[field].file);else g.gaps.push(field);}
 requireWitness('nativeGameplay',r=>r.game.start?.player&&r.game.movementObserved);
 requireWitness('restart',r=>r.game.restart?.status==='RESTARTED_NATIVE_MOVEMENT_OBSERVED');
 // Genre is not physical intent: both platform games contain real rails or
 // upright stone structures. Do not waive wall/corner coverage by game name.
 requireWitness('wall',r=>r.game.wallRoute?.status==='SUSTAINED_REAL_WALL_CONTACT');requireWitness('corner',r=>['SINGLE_SOLID_CORNER_CONTACT_OBSERVED','TWO_SOLID_CORNER_CONTACT_OBSERVED'].includes(r.game.corner?.status));
 requireWitness('floorTerrain',r=>['firstperson','thirdperson'].includes(family)?r.game.final.metrics.verticalContacts.some(c=>c.grounded)||r.game.final.metrics.frames.some(f=>f.grounded):r.game.final.metrics.frames.some(f=>f.terrainId)||!!r.game.final.terrainUnderPlayer);
 // A missing solid flag is not intent. Restrict automatic pass-through
 // witnesses to ordinary decorative foliage, never machines or actors.
 const decorations=p.levels.flatMap(l=>l.objects).filter(o=>!o.solid&&!o.ai&&!(o.tags||[]).includes('enemy')&&/showcase-(tree-|bush|fern|grass|flower)/.test(o.assetId||''));
 if(!decorations.length)g.passThrough={status:'NOT_APPLICABLE',reason:'No authored decorative pass-through candidate; shared actual-controller non-solid fixtures still required'};
 else requireWitness('passThrough',r=>{
   const a=r.game.authoredObjectRoute;if(a?.target?.solid!==false||a.targetContacts!==0||!decorations.some(o=>o.id===a.target.id&&o.assetId===a.target.assetId))return false;
   if(family==='hovercraft'&&a.legacyFootprintEntry&&a.legacyFootprintExit&&r.game.final.metrics.frames.some(f=>f.keys.length&&f.dt>0&&f.after.x>=a.target.min.x&&f.after.x<=a.target.max.x&&f.after.z>=a.target.min.z&&f.after.z<=a.target.max.z))return true;
   const enter=a.steps.findIndex(s=>(s.segmentIntersectsVisualBounds||s.verticalBodyIntersectsVisualBounds)&&Math.hypot(s.after.x-s.before.x,s.after.z-s.before.z)>.01);if(enter<0)return false;
   if(['NATIVE_MOVEMENT_THROUGH_VISUAL_BOUNDS','NATIVE_BODY_MOVEMENT_THROUGH_VISUAL_BOUNDS'].includes(a.status)||a.bodyEntry&&a.bodyExit)return true;
   // A later unrelated solid may prevent the arbitrary route destination.
   // Exact centre entry followed by native centre exit still proves this
   // non-solid volume was traversed; preserve destination coverage separately.
   const bodyOnly=!a.steps[enter].segmentIntersectsVisualBounds&&a.steps[enter].verticalBodyIntersectsVisualBounds;
   return a.steps.slice(enter+1).some(s=>{const h=bodyOnly?s.bodyHeight/2:0;if(!Number.isFinite(h))return false;return s.after.x<a.target.min.x||s.after.x>a.target.max.x||s.after.z<a.target.min.z||s.after.z>a.target.max.z||s.after.y<a.target.min.y-h||s.after.y>a.target.max.y+h;});
 });
 g.platforms=(platformIds[entry.id]||[]).map(id=>({id,witness:witness(rows,r=>r.game.platformRoutes?.some(p=>p.target===id&&['NATIVE_PLATFORM_LANDING_OBSERVED','NATIVE_LANDING_AND_IDLE_CARRY_OBSERVED'].includes(p.status))||
   // A later native key segment can land after a dedicated route's sampling
   // window (e.g. Skyway's win trigger). Count the actual grounded return,
   // never the ending text or an unobserved assumed landing.
   r.game.final.metrics.verticalContacts.some(c=>c.target===id&&c.grounded&&c.sim>r.game.start.sim)&&r.game.final.metrics.frames.some(f=>f.keys.length&&f.dt>0)),method:'Dedicated native landing witness or actual grounded target return in the final pre-restart native-input trace; no ending-overlay inference'}));
 if(g.platforms.some(p=>!p.witness))g.gaps.push('platforms');
 if(entry.id==='moving-temple')requireWitness('idleCarry',r=>r.game.platformRoutes?.some(p=>p.target==='obj57'&&p.status==='NATIVE_LANDING_AND_IDLE_CARRY_OBSERVED'&&p.carryEvents.length>5));
 const triggers=p.levels.flatMap(l=>l.objects).some(o=>(o.behaviors||[]).some(b=>['nextLevel','switchLevel'].includes(b.action)));
 if(triggers)requireWitness('progressionTrigger',r=>r.game.progression?.status==='NATIVE_TRIGGER_LEVEL_TRANSITION_OBSERVED');else g.progressionTrigger={status:'NOT_APPLICABLE',reason:'No authored level-transition trigger'};
 const baseSpeed=p.levels[0].playerSettings?.moveSpeed||6;
 const speedProof=r=>{
   const frames=r.game.final.metrics.frames,steps=[...(r.game.wallRoute?.steps||[]),...(r.game.platformRoutes||[]).flatMap(p=>p.steps||[])];
   const requested=steps.some(s=>s.keys?.some(k=>k==='Shift'||family==='hovercraft'&&k==='Space'));
   const observed=frames.some(f=>f.keys.some(k=>/^Shift/.test(k)||family==='hovercraft'&&k==='Space'));
   const acceleratedFrames=frames.filter(f=>f.dt>0&&f.keys.length&&Math.hypot(f.after.x-f.before.x,f.after.z-f.before.z)/f.dt>baseSpeed*1.05).length;
   return observed||requested&&acceleratedFrames>=3;
 };
 const sample=rows.find(speedProof);
 g.highSpeed=sample?{runId:sample.proof.runId,file:sample.file,scope:'Actual native sprint/boost key observation or native key requests plus at least three moving frames above authored base speed; no speed setting writes'}:family==='topdown'?{status:'NOT_APPLICABLE',reason:'No authored sprint/boost control; native standard-speed real gameplay and shared high-speed controller fixture required'}:null;
 if(!g.highSpeed)g.gaps.push('highSpeed');
 g.tierConsistency={};for(const tier of ['source','editable']){const r=records.find(r=>r.proof.tier===tier&&r.game.final?.player.family===family&&clean(r)&&r.game.wallRoute?.status==='SUSTAINED_REAL_WALL_CONTACT'&&r.game.restart?.status==='RESTARTED_NATIVE_MOVEMENT_OBSERVED');g.tierConsistency[tier]=r?{representative:r.game.id,runId:r.proof.runId,file:r.file,scope:'Representative same-family native wall/restart semantics, not every scene equality'}:null;if(!r)g.gaps.push(tier+'Consistency');}
 g.evidence=[...new Set(g.evidence)];g.status=g.gaps.length?'SCENARIO_COVERAGE_PENDING':'SCENARIO_EVIDENCE_COMPLETE_REQUIRES_REVIEW';audit.games.push(g);
}
audit.complete=audit.games.filter(g=>!g.gaps.length).length;audit.total=catalog.length;
fs.writeFileSync(path.join(base,'current-acceptance-audit.json'),JSON.stringify(audit,null,2)+'\n');
for(const g of audit.games)console.log(JSON.stringify({id:g.id,gaps:g.gaps}));console.log(JSON.stringify({complete:audit.complete,total:audit.total,fingerprint:fp}));
