'use strict';
// Read-only handoff audit. Does not grant a verdict or modify evidence.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'qualification/beta-revision-1');
const read=relative=>{const file=path.resolve(root,relative);assert(file.startsWith(root+path.sep));return JSON.parse(fs.readFileSync(file,'utf8'));};
const a=read('qualification/beta-revision-1/BETA-REVISION-1-ACCEPTANCE.json');
assert.equal(a.finalVerdict,'BETA_REVISION_1_LOCAL_HARDENING_READY');assert.equal(a.deploymentStatus,'NOT_DEPLOYED');assert.equal(a.sourceFingerprint,require('./real-demo-program-state').fingerprint());
for(const key of ['A','B','C','D','E','F','G','H']){assert.equal(a.workstreams[key].status,'PASS',key);assert(a.workstreams[key].evidence.length);}
assert.equal(a.journeys.length,10);for(const journey of a.journeys){assert.equal(journey.status,'PASS');assert(journey.evidence.length);}
for(const entry of a.nativeEvidence){const proof=read(entry.path);assert.equal(proof.sourceFingerprint||proof.fingerprint,a.sourceFingerprint,entry.path);assert.equal(proof.status,entry.status);assert(proof.status.includes('PASS')&&proof.status!=='FAIL');assert.equal((proof.errors||[]).length,0);assert.equal((proof.external||[]).length,0);assert.equal(proof.resourcesClosed,true);}
const examples=read(a.examplesEvidence);assert.equal(examples.examples.length,28);assert(examples.examples.every(e=>e.saveStatus==='Saved'&&(e.simElapsed>.15||e.gameEnded)));assert.equal(new Set(examples.examples.map(e=>e.id)).size,28);
const regression=read(a.regressionEvidence);assert.equal(regression.fingerprint,a.sourceFingerprint);assert.equal(regression.finalFingerprint,a.sourceFingerprint);assert.equal(regression.status,'COMMAND_GATES_PASSED_NOT_GAMEPLAY_ACCEPTANCE');assert.equal(regression.gates.length,8);assert(regression.gates.every(g=>g.exitCode===0||g.status==='PASS'));
const pkg=read(a.release.packageReport);assert.equal(pkg.sourceFingerprint,a.sourceFingerprint);assert.equal(pkg.deployed,false);assert.equal(pkg.files,187);assert.equal(pkg.examples,28);assert(pkg.exactSourceCopy&&pkg.allZipEntryHashesVerified);
const zipHash=crypto.createHash('sha256').update(fs.readFileSync(pkg.zipPath)).digest('hex');assert.equal(zipHash,a.release.zipSHA256);
const smoke=read(a.release.smokeEvidence);assert.equal(smoke.status,'STAGED_ROOT_SUBPATH_NATIVE_AUTHORING_SAVELOAD_RUNTIME_OFFLINE_EXPORT_PASS');assert.equal(smoke.liveHostingerTested,false);assert.deepStrictEqual(smoke.routes.map(r=>r.base),['/','/engine/']);assert.equal(smoke.errors.length+smoke.external.length+smoke.httpFailures.length,0);
const rollback=read(a.release.rollbackEvidence);assert.equal(rollback.status,'LOCAL_STATIC_ROLLBACK_REUPGRADE_READ_COMPATIBILITY_PASS');assert.equal(rollback.remoteRollbackPerformed,false);
const documents=['BETA-REVISION-1-REPORT.md','DATA-DURABILITY-CONTRACT.md','SAVE-FAILURE-RECOVERY-CONTRACT.md','PROJECT-BACKUP-RESTORE-CONTRACT.md','RUNTIME-SAVE-ISOLATION-REVIEW.md','CUSTOM-SCRIPT-TRUST-REVIEW.md','HOSTINGER-LAUNCH-CHECKLIST.md','HOSTINGER-ROLLBACK-PLAN.md'];for(const name of documents){assert(fs.statSync(path.join(base,name)).size>500,name);}
console.log(JSON.stringify({status:'READ_ONLY_FINAL_ACCEPTANCE_CROSSCHECK_PASS',sourceFingerprint:a.sourceFingerprint,workstreams:8,journeys:10,nativeEvidence:a.nativeEvidence.length,examples:28,regressionGates:8,requiredDeliverables:9,zipSHA256:zipHash,deploymentStatus:'NOT_DEPLOYED'}));
