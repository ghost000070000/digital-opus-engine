'use strict';
// Read the preserved native-input evidence; never infer gameplay from build status.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),base=path.join(root,'qualification/real-demo-collision');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
const s=read('real-gameplay-soak.json'),state=read('real-gameplay-soak-state.json');
const fp=require('./real-demo-program-state').fingerprint();
assert.strictEqual(s.runId,state.runId);assert.strictEqual(s.status,'SOAK_WORKLOAD_PASSED_PENDING_FINAL_REVIEW');
assert(s.activeSeconds>=3600&&s.requiredSeconds===3600);
for(const key of ['startFingerprint','midpointFingerprint','finalFingerprint'])assert.strictEqual(s[key],fp,key);
assert(s.games.length>=12);
for(const id of ['arsenal-run','power-grid','signal-relay','silent-sector','relic-frontier'])assert(s.games.includes(id));
const families={},scenarios={},totals={inputAttempts:0,wallContacts:0,terrainFrames:0,groundedReturns:0,playerEntries:0,aiEntries:0,pageErrors:0,consoleErrors:0,externalRequests:0,instrumentationErrors:0};
let seconds=0;
for(const c of s.cycles){
 const p=read(c.probeRunId+'/results.json'),g=p.games[0],m=g.final.metrics;
 assert.strictEqual(p.fingerprint,fp);assert.strictEqual(p.runId,c.probeRunId);assert(p.endedAt&&p.games.length===1);
 assert.strictEqual(g.id,c.id);assert.strictEqual(g.status,'GAMEPLAY_STARTED');assert(g.inputAttempts>0&&g.movementObserved);
 assert.strictEqual(g.restart.status,'RESTARTED_NATIVE_MOVEMENT_OBSERVED');
 for(const a of [g.errors,g.consoleErrors,g.externalRequests,m.instrumentationErrors,m.independentWallPenetrations,m.aiSolidEntries])assert(Array.isArray(a)&&a.length===0,c.probeRunId);
 assert(m.activeControllerSeconds>0);seconds+=m.activeControllerSeconds;
 if(c.scenario==='wall-corner'){
  assert.strictEqual(g.wallRoute.status,'SUSTAINED_REAL_WALL_CONTACT');
  assert(['SINGLE_SOLID_CORNER_CONTACT_OBSERVED','TWO_SOLID_CORNER_CONTACT_OBSERVED'].includes(g.corner.status));
 }else if(c.scenario==='platform')assert(g.platformRoutes.length&&g.platformRoutes.every(x=>['NATIVE_PLATFORM_LANDING_OBSERVED','NATIVE_LANDING_AND_IDLE_CARRY_OBSERVED'].includes(x.status)));
 else if(c.scenario==='progression')assert.strictEqual(g.progression.status,'NATIVE_TRIGGER_LEVEL_TRANSITION_OBSERVED');
 else if(c.scenario==='pass-through')assert.strictEqual(g.authoredObjectRoute.status,'NATIVE_MOVEMENT_THROUGH_VISUAL_BOUNDS');
 else throw Error('Unreviewed scenario '+c.scenario);
 const f=families[c.family] ||= {cycles:0,games:[],inputAttempts:0,wallContacts:0};f.cycles++;if(!f.games.includes(c.id))f.games.push(c.id);f.inputAttempts+=g.inputAttempts;f.wallContacts+=c.wallContactReturns;
 scenarios[c.scenario]=(scenarios[c.scenario]||0)+1;
 totals.inputAttempts+=g.inputAttempts;totals.wallContacts+=c.wallContactReturns;totals.terrainFrames+=c.terrainFrames;totals.groundedReturns+=c.verticalGroundedReturns;
}
assert(Math.abs(seconds-s.observedControllerSeconds)<1e-5);assert(Math.abs(s.activeSeconds-Math.min(s.monotonicWorkloadSeconds,seconds))<1e-5);
for(const f of ['firstperson','thirdperson','topdown','hovercraft'])assert(families[f]);
const mem=s.memoryObservations;assert.strictEqual(mem.length,s.cycles.length);
function stats(values){assert(values.every(Number.isFinite));const n=Math.max(1,Math.floor(values.length/4)),mean=a=>a.reduce((x,y)=>x+y,0)/a.length;return {samples:values.length,first:values[0],last:values.at(-1),min:Math.min(...values),max:Math.max(...values),firstQuartileMean:mean(values.slice(0,n)),lastQuartileMean:mean(values.slice(-n))};}
const proof={version:1,reviewedAt:new Date().toISOString(),runId:s.runId,status:'NATIVE_SOAK_EVIDENCE_REVIEW_PASS_PENDING_POST_ACCEPTANCE',sourceFingerprint:fp,startedAt:s.startedAt,endedAt:s.endedAt,activeSeconds:s.activeSeconds,monotonicWorkloadSeconds:s.monotonicWorkloadSeconds,cycles:s.cycles.length,games:s.games,families,scenarios,totals,memory:{runnerRss:stats(mem.map(x=>x.runner.rss)),runnerHeap:stats(mem.map(x=>x.runner.heapUsed)),browserHeapEstimate:stats(mem.filter(x=>x.browserHeapEstimate).map(x=>x.browserHeapEstimate.used)),interpretation:'Fresh browser contexts are destroyed after each workload. Chromium heap is an estimate. No forced-GC, persistent-session leak stability or unbounded-runtime guarantee is claimed.'},fingerprints:{start:s.startFingerprint,midpoint:s.midpointFingerprint,final:s.finalFingerprint},finalCollisionReady:false};
fs.writeFileSync(path.join(base,'real-gameplay-soak-review.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
