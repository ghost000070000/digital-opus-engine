'use strict';
// Applies this specific engineering review, not a generic green-test promotion.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),base=path.join(root,'qualification/real-demo-collision');
const reviewedFingerprint='b57abe6b4b535e3e72d16034f5dbe7b77d99fc1ab76c80920701c73be2db1576';
const review='qualification/real-demo-collision/REAL-DEMO-COLLISION-ACCEPTANCE-REVIEW.md';
assert.strictEqual(require('./real-demo-program-state').fingerprint(),reviewedFingerprint,'Changed source requires a new engineering review');
assert(fs.readFileSync(path.join(root,review),'utf8').includes(reviewedFingerprint));
const audit=JSON.parse(fs.readFileSync(path.join(base,'current-acceptance-audit.json')));
assert.strictEqual(audit.sourceFingerprint,reviewedFingerprint);assert.strictEqual(audit.complete,28);assert.strictEqual(audit.total,28);
const file=path.join(base,'real-demo-collision-matrix.json'),m=JSON.parse(fs.readFileSync(file));
assert.strictEqual(m.sourceFingerprint,reviewedFingerprint);assert.strictEqual(m.games.length,28);
for(const row of m.games){
 const g=audit.games.find(g=>g.id===row.id);assert(g&&!g.gaps.length);
 assert.strictEqual(row.currentObservationFingerprint,reviewedFingerprint);
 assert(g.nativeGameplay&&g.wall&&g.corner&&g.floorTerrain&&g.restart);
 row.status='PASS';row.playable='NATIVE_SCENARIO_ACCEPTANCE_PASS_PENDING_FINAL_SOAK';
 row.visibleGeometry='REVIEWED_SCREENSHOTS_AND_AUTHORED_BOUNDS';
 row.acceptanceReview=review;row.acceptanceFingerprint=reviewedFingerprint;
 row.acceptanceScope='Observed canonical gameplay scenarios; final mission readiness still requires frozen60-minute soak and post-soak gates';
 row.filterResult='FILTER_NOT_APPLICABLE_LEGACY_PATH';
}
m.updatedAt=new Date().toISOString();m.status='PRE_SOAK_SCENARIO_ACCEPTANCE_PASS';m.acceptanceReview=review;
fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');
fs.writeFileSync(path.join(base,'REAL-DEMO-COLLISION-MATRIX.md'),'# Actual-demo collision acceptance\n\nAll28 observed canonical scenario rows pass engineering review. Final mission readiness remains pending the source-frozen60-minute native gameplay soak and post-soak checks. [Review](REAL-DEMO-COLLISION-ACCEPTANCE-REVIEW.md).\n\n| Game | Family | Started/driven | Scenario result |\n| --- | --- | --- | --- |\n'+m.games.map(g=>`| ${g.title} | ${g.controllers.join('/')} | ${g.started}/${g.driven} | ${g.status} |`).join('\n')+'\n');
console.log(JSON.stringify({fingerprint:reviewedFingerprint,total:28,scenarioPass:28,finalMissionReady:false}));
