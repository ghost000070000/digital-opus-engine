'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'), product=path.join(root,'qualification/autonomous-product-program'), recovery=path.join(root,'qualification/real-demo-collision');
function fingerprint(){
  const hash=crypto.createHash('sha256');
  const files=['engine/src','editor/src','build','games'].flatMap(folder=>fs.readdirSync(path.join(root,folder)).filter(n=>/\.(js|json|html)$/.test(n)).map(n=>`${folder}/${n}`)).concat(['editor/index.html','no-code-capabilities.json','authoring-friction.json']).sort();
  for(const file of files){hash.update(file+'\0');hash.update(fs.readFileSync(path.join(root,file)));hash.update('\0');}return hash.digest('hex');
}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');}
function initialize(){
  const now=new Date().toISOString(),fp=fingerprint();
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'games/catalog.json'))).games.filter(g=>g.visibility==='public');
  const matrixFile=path.join(recovery,'real-demo-collision-matrix.json');
  let matrix=fs.existsSync(matrixFile)?JSON.parse(fs.readFileSync(matrixFile)): {version:1,games:catalog.map(g=>{
    const p=JSON.parse(fs.readFileSync(path.join(root,'games',g.file))),objects=p.levels.flatMap(l=>l.objects);
    return {id:g.id,title:g.title,source:g.file,controllers:[...new Set(p.levels.map(l=>l.playerSettings?.controllerType||'hovercraft'))],sourceSolidObjects:objects.filter(o=>o.solid).length,
      movementPath:'NOT_TRACED',collisionSystem:'NOT_OBSERVED',filterResult:'NOT_OBSERVED',visibleGeometry:'NOT_TESTED',colliderPresence:'NOT_OBSERVED',bodyRole:'NOT_OBSERVED',characterCollision:'NOT_OBSERVED',tileCollision:'NOT_OBSERVED',
      sourceEditor:'NOT_TESTED',editable:'NOT_TESTED',playable:'NOT_TESTED',started:false,driven:false,wall:'NOT_TESTED',floorTerrain:'NOT_TESTED',corner:'NOT_TESTED',highSpeed:'NOT_TESTED',restart:'NOT_TESTED',status:'NOT_TESTED',evidence:[]};})};
  for(const dir of fs.readdirSync(recovery).filter(n=>n.startsWith('probe-'))){
    const file=path.join(recovery,dir,'results.json');if(!fs.existsSync(file))continue;
    let proof;try{proof=JSON.parse(fs.readFileSync(file));}catch{continue;}
    for(const g of proof.games){const row=matrix.games.find(r=>r.id===g.id);if(!row)continue;
      if(g.start?.player){
        // A later harness/restart failure must not erase already observed
        // gameplay. Start is captured only after the native gameplay gate.
        row.started=true;row.driven ||=!!g.movementObserved||!!g.wallRoute?.steps.some(s=>Math.hypot(s.after.x-s.before.x,s.after.z-s.before.z)>.05);
        const tier=g.tier||proof.tier||'playable';row[tier==='source'?'sourceEditor':tier]='CHARACTERIZED_NOT_QUALIFIED';
        row.collisionSystem=g.final?.metrics?.calls?'legacy resolveItemColliderCollision observed':row.collisionSystem;
        row.filterResult=g.final?.metrics?.calls?'FILTER_NOT_APPLICABLE_LEGACY_PATH':row.filterResult;
        if(g.wallRoute){row.wallObservations ||= [];const observation={runId:proof.runId,tier,fingerprint:proof.fingerprint,status:g.wallRoute.status,target:g.wallRoute.target?.id,contacts:g.wallRoute.contactCount||0};
          const index=row.wallObservations.findIndex(o=>o.runId===proof.runId);if(index<0)row.wallObservations.push(observation);else row.wallObservations[index]=observation;}
        for(const field of ['corner','restart'])if(g[field]){
          const key=field+'Observations';row[key] ||= [];const observation={runId:proof.runId,tier,fingerprint:proof.fingerprint,status:g[field].status};
          const index=row[key].findIndex(o=>o.runId===proof.runId);if(index<0)row[key].push(observation);else row[key][index]=observation;
        }
        if(g.final?.metrics?.verticalContacts?.length||g.final?.terrainUnderPlayer){row.supportObservations ||= [];const observation={runId:proof.runId,tier,fingerprint:proof.fingerprint,verticalTargets:[...new Set((g.final.metrics.verticalContacts||[]).filter(c=>c.grounded).map(c=>c.target))],terrain:g.final.terrainUnderPlayer||null,carryEvents:g.final.metrics.carryEvents?.length||0};if(!row.supportObservations.some(o=>o.runId===proof.runId))row.supportObservations.push(observation);}
      }
      const relative=path.relative(root,file).replace(/\\/g,'/');if(!row.evidence.includes(relative))row.evidence.push(relative);
    }
  }
  matrix.updatedAt=now;matrix.sourceFingerprint=fp;write(matrixFile,matrix);
  write(path.join(recovery,'REAL-DEMO-COLLISION-MATRIX.md'),'# Actual-demo collision acceptance\n\nCharacterization is not acceptance. NOT_TESTED remains until scenario gates are observed.\n\n| Game | Family | Started | Driven | Playable | Final |\n| --- | --- | --- | --- | --- | --- |\n'+matrix.games.map(g=>`| ${g.title} | ${g.controllers.join('/')} | ${g.started} | ${g.driven} | ${g.playable} | ${g.status} |`).join('\n')+'\n');
  const stateFile=path.join(product,'CURRENT-STATE.json'), old=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{};
  const state={...old,version:1,status:'ACTIVE',currentPhase:50,currentEpoch:5,currentPhaseStatus:'PLANNED_PREREQUISITE_REPAIR',lastCompletedPhase:49,trackerAuthority:'NOT_LOCATED_240_PHASE_TRACKER',sourceFingerprint:fp,currentMajorProductGoal:'Coherent usable polished no-code-first 2D/3D game engine; established 001–240 plus integrated readiness',currentBlocker:'Actual 28-game collision acceptance unresolved',nextIntendedAction:old.nextIntendedAction||'Characterize actual controller contacts, reproduce integration failures and repair shared causes',recentRegressions:old.recentRegressions||[],activeLongRunningQualification:old.activeLongRunningQualification||null,realBrowserAcceptanceStatus:{started:matrix.games.filter(g=>g.started).length,driven:matrix.games.filter(g=>g.driven).length,qualified:matrix.games.filter(g=>g.status==='PASS').length,total:28},exportsStatus:old.exportsStatus||'Current Playables under characterization; no consistency gate claimed',testStatus:old.testStatus||'Historical Phase 049 gate PASS; current recovery gates pending',currentProductRisks:['Actual demo collision','Numbered tracker/spec authority not yet located'],last2HourCheckpoint:old.last2HourCheckpoint||now,nextReviewTime:old.nextReviewTime||new Date(Date.now()+7200000).toISOString(),stopConditionState:null,updatedAt:now,scheduler:{id:'real-demo-collision-mission-2-hour-review',kind:'heartbeat',status:'ACTIVE',intervalHours:2},legacyNativeGoal:'Previous collision-only goal remains paused; master continuation is owned by this durable program and native heartbeat'};
  write(stateFile,state);write(path.join(recovery,'REAL-DEMO-COLLISION-CURRENT-STATE.json'),{version:1,status:'ACTIVE_PREREQUISITE_OF_PRODUCT_PROGRAM',updatedAt:now,sourceFingerprint:fp,started:state.realBrowserAcceptanceStatus.started,driven:state.realBrowserAcceptanceStatus.driven,qualified:state.realBrowserAcceptanceStatus.qualified,nextAction:state.nextIntendedAction,activeRunner:null,browserHealth:state.realBrowserAcceptanceStatus.started?'PLAYWRIGHT_HEALTHY':'PROBING',productProgram:'qualification/autonomous-product-program/CURRENT-STATE.json'});
  console.log(JSON.stringify(state.realBrowserAcceptanceStatus));console.log(fp);
}
// Read-only by default: a fingerprint query must never rewrite an advanced
// product mission back to the historical Phase050 collision bootstrap.
if(require.main===module){
  if(process.argv.includes('--initialize-legacy')){
    const stateFile=path.join(root,'qualification/autonomous-product-program/CURRENT-STATE.json');
    const current=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
    if(current?.currentPhase>50)throw new Error('Refusing legacy initialization over an advanced product mission.');
    initialize();
  }else console.log(fingerprint());
}
module.exports={fingerprint,initialize};
