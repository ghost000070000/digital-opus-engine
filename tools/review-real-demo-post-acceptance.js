'use strict';
// Explicit evidence IDs only. Missing evidence fails closed; this is not a build-to-READY shortcut.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),base=path.join(root,'qualification/real-demo-collision');
const fp=require('./real-demo-program-state').fingerprint(),arg=k=>{const v=process.argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3);assert(v&&/^[a-z0-9-]+$/i.test(v),'Explicit safe '+k+' evidence ID required');return v;};
const ids=Object.fromEntries(['baseline','source','editable','source-hover','editable-hover','character','group','regression'].map(k=>[k,arg(k)]));
const read=id=>JSON.parse(fs.readFileSync(path.join(base,id,'results.json'),'utf8'));
const soak=JSON.parse(fs.readFileSync(path.join(base,'real-gameplay-soak.json'))),review=JSON.parse(fs.readFileSync(path.join(base,'real-gameplay-soak-review.json')));
assert.strictEqual(review.runId,soak.runId);assert.strictEqual(review.sourceFingerprint,fp);assert(soak.activeSeconds>=3600);
assert.strictEqual(review.status,'NATIVE_SOAK_EVIDENCE_REVIEW_PASS_PENDING_POST_ACCEPTANCE');
function current(p){assert.strictEqual(p.fingerprint,fp);assert(p.endedAt&&Date.parse(p.startedAt)>=Date.parse(soak.endedAt),'Post-soak timestamp required');}
function clean(g){const m=g.final?.metrics;assert(g.status==='GAMEPLAY_STARTED'&&g.movementObserved&&g.inputAttempts>0&&m,g.id);assert.strictEqual(g.restart.status,'RESTARTED_NATIVE_MOVEMENT_OBSERVED');for(const a of [g.errors,g.consoleErrors,g.externalRequests,m.instrumentationErrors,m.independentWallPenetrations,m.aiSolidEntries])assert(Array.isArray(a)&&a.length===0,g.id);}
const baseline=read(ids.baseline);current(baseline);assert.strictEqual(baseline.tier,'playable');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'games/catalog.json'))).games.filter(g=>g.visibility==='public');assert.strictEqual(catalog.length,28);assert.strictEqual(baseline.games.length,28);assert.strictEqual(new Set(baseline.games.map(g=>g.id)).size,28);
for(const g of catalog){const observed=baseline.games.find(x=>x.id===g.id);assert(observed);clean(observed);}
const tiers={},coverageMisses=[];for(const tier of ['source','editable']){
 const p=read(ids[tier]);current(p);assert.strictEqual(p.tier,tier);assert.strictEqual(p.games.length,4);
 const hover=read(ids[tier+'-hover']);current(hover);assert.strictEqual(hover.tier,tier);assert.strictEqual(hover.games.length,1);assert.strictEqual(hover.games[0].final.player.family,'hovercraft');
 // Preserve original legitimate game-ending coverage misses; require a new
 // actual tier-specific hovercraft wall/corner/restart witness, never waive it.
 for(const g of p.games){clean(g);if(g.final.player.family==='hovercraft')coverageMisses.push({tier,runId:p.runId,id:g.id,corner:g.corner?.status,replacementRunId:hover.runId});}
 const games=[...p.games.filter(g=>g.final.player.family!=='hovercraft'),hover.games[0]],families=new Set();
 for(const g of games){clean(g);assert.strictEqual(g.wallRoute.status,'SUSTAINED_REAL_WALL_CONTACT',g.id);assert(['SINGLE_SOLID_CORNER_CONTACT_OBSERVED','TWO_SOLID_CORNER_CONTACT_OBSERVED'].includes(g.corner.status),g.id);families.add(g.final.player.family);}assert.strictEqual(families.size,4);
 tiers[tier]=games.map(g=>({id:g.id,family:g.final.player.family,wall:g.wallRoute.status,corner:g.corner.status,restart:g.restart.status}));
}
for(const [key,status] of [['character','AUTHORING_HISTORY_PERSISTENCE_EXPORT_PASS'],['group','GROUP_AUTHORING_PERSISTENCE_EXPORT_PASS']]){const p=read(ids[key]);current(p);assert.strictEqual(p.status,status);assert.strictEqual(p.errors.length,0);assert(p.steps.length>=13);}
const gates=read(ids.regression);current(gates);assert.strictEqual(gates.status,'COMMAND_GATES_PASSED_NOT_GAMEPLAY_ACCEPTANCE');assert.strictEqual(gates.finalFingerprint,fp);assert(gates.gates.length===8&&gates.gates.every(g=>g.exitCode===0||g.status==='PASS'));
const matrix=JSON.parse(fs.readFileSync(path.join(base,'real-demo-collision-matrix.json'))),audit=JSON.parse(fs.readFileSync(path.join(base,'current-acceptance-audit.json')));
assert.strictEqual(matrix.sourceFingerprint,fp);assert.strictEqual(matrix.games.length,28);assert(matrix.games.every(g=>g.status==='PASS'));assert.strictEqual(audit.sourceFingerprint,fp);assert.strictEqual(audit.complete,28);assert(audit.games.every(g=>!g.gaps.length));
const result={version:1,reviewedAt:new Date().toISOString(),sourceFingerprint:fp,status:'POST_SOAK_NATIVE_ACCEPTANCE_REVIEW_PASS_PENDING_ENGINEERING_CLOSURE',soakRunId:soak.runId,evidence:ids,catalog:28,started:28,driven:28,collisionRelevant:28,pass:28,notApplicable:0,fail:0,unrelatedBlocked:0,notTested:0,tiers,coverageMisses,characterSteps:read(ids.character).steps.length,groupSteps:read(ids.group).steps.length,scope:'Finite reviewed actual-game scenarios; final engineering report/visual adjudication required. Not full240 program readiness.'};
fs.writeFileSync(path.join(base,'post-soak-acceptance-review.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
