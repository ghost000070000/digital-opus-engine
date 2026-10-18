'use strict';
// Mechanical evidence synchronization only. Never promotes a final PASS,
// changes product source, or replaces authoritative active runner state.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),base=path.join(root,'qualification/real-demo-collision');
const fp=require('./real-demo-program-state').fingerprint();
const audit=JSON.parse(fs.readFileSync(path.join(base,'current-acceptance-audit.json')));
assert.strictEqual(audit.sourceFingerprint,fp,'Refresh the exact-current audit first');
const file=path.join(base,'real-demo-collision-matrix.json');
const matrix=JSON.parse(fs.readFileSync(file));
const paths={firstperson:'updateFirstPersonController',thirdperson:'updateThirdPersonController',topdown:'updateTopDownController',hovercraft:'updateHovercraftController'};
for(const row of matrix.games){
 const g=audit.games.find(g=>g.id===row.id);assert(g,'Catalog row missing');
 const project=JSON.parse(fs.readFileSync(path.join(root,'games',row.source)));
 row.sourceSolidObjects=project.levels.flatMap(l=>l.objects).filter(o=>o.solid).length;
 row.currentObservationFingerprint=fp;
 row.currentScenarioAudit='qualification/real-demo-collision/current-acceptance-audit.json';
 row.scenarioEvidenceStatus=g.status;row.remainingScenarioGaps=g.gaps;
 row.currentWitnesses={};
 for(const field of ['nativeGameplay','wall','corner','floorTerrain','restart','highSpeed','passThrough','progressionTrigger','idleCarry']){
  if(!g[field])continue;row.currentWitnesses[field]=g[field];
  if(['wall','corner','floorTerrain','restart','highSpeed'].includes(field))row[field]=g[field].status==='NOT_APPLICABLE'?'NOT_APPLICABLE':g[field].file?'NATIVE_OBSERVATION_RECORDED':'NOT_TESTED';
 }
 row.currentWitnesses.platforms=g.platforms;row.currentWitnesses.tierConsistency=g.tierConsistency;
 row.started=!!g.nativeGameplay;row.driven=!!g.nativeGameplay;
 if(g.nativeGameplay){row.movementPath='editor/src/01-editor.js: '+paths[g.family]+' -> actual legacy solid/terrain response -> final Transform';row.playable='CHARACTERIZED_NOT_QUALIFIED';}
 row.sourceEditor=g.tierConsistency.source?'SAME_FAMILY_NATIVE_WALL_RESTART_OBSERVED':'NOT_TESTED';
 row.editable=g.tierConsistency.editable?'SAME_FAMILY_NATIVE_WALL_RESTART_OBSERVED':'NOT_TESTED';
 row.currentEvidence=[...new Set([...g.evidence,...Object.values(g.tierConsistency).filter(Boolean).map(w=>w.file)])];
 // Deliberately retain row.status. Scenario completeness is not engineering
 // adjudication, visual intent, all product gates, or a completed final soak.
}
matrix.sourceFingerprint=fp;matrix.updatedAt=new Date().toISOString();
fs.writeFileSync(file,JSON.stringify(matrix,null,2)+'\n');
fs.writeFileSync(path.join(base,'REAL-DEMO-COLLISION-MATRIX.md'),'# Actual-demo collision acceptance\n\nFinal states remain unqualified until engineering review and required gates. Current evidence is fingerprint-bound; historical evidence is retained separately.\n\n| Game | Family | Started/driven | Current gaps | Final |\n| --- | --- | --- | --- | --- |\n'+matrix.games.map(g=>`| ${g.title} | ${g.controllers.join('/')} | ${g.started}/${g.driven} | ${g.remainingScenarioGaps.join(', ')||'Scenario evidence complete; review pending'} | ${g.status} |`).join('\n')+'\n');
console.log(JSON.stringify({fingerprint:fp,scenarioComplete:audit.complete,total:audit.total,finalPass:matrix.games.filter(g=>g.status==='PASS').length}));
