'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(source.slice(at-6,at)==='async '?at-6:at,source.indexOf('\n}',at)+2);}
function fixture(){
 let fetches=0,serializations=0,composed,reviewed,fetchHook;
 const c={playMode:false,levels:[{id:'level',objects:[]}],currentLevelIndex:0,undoStack:[{keep:'undo'}],redoStack:[{keep:'redo'}],authoring:{assets:[{id:'private-library',keep:true}],title:'Original'},tierSnapshots:[{levels:[],tier:'Editable'},{levels:[],tier:'Playable'}],projectMeta:{title:'Private'},currentUiConfig:{startScreen:{}},window:{},document:{querySelector:()=>null},activateTab:()=>{},renderProjectValidation:()=>{},collectLootTableIssues:()=>[],collectTouchLayoutIssues:()=>[],OpusInputContexts:{collectIssues:()=>[]},OpusSignals:{collectDependencies:()=>({issues:[]})},OpusGraphValues:{},GRAPH_NODE_TYPES:{}};
 // This test owns lease/I/O boundaries, not a second validator. Structured
 // collection is an explicit injectable boundary; actual schemas and aggregate
 // severities/snapshot inputs are exercised by the other registered217 tests.
 c.collectStructuredProjectIssues=project=>{reviewed=project;return{issues:project.fixtureIssues||[]};};
 c.serializeProject=options=>{serializations++;return c.tierSnapshots[options.includeTilesets?0:1];};
 c.captureAssetReplacementState=()=>({project:c.authoring});
 c.fetch=async()=>{fetches++;if(fetchHook)await fetchHook();return{ok:true,text:async()=>''};};
 c.composeExportHTML=options=>{composed=options;return 'HTML';};
 vm.createContext(c);vm.runInContext('let exportPreflightGeneration=0;\n'+['prepareExportPreflight','cancelExportPreflight','assertExportPreflightLease','buildReviewedExport'].map(extract).join('\n'),c);
 vm.runInContext(source.match(/async function buildExportHTML\(playableOnly\) \{[\s\S]*?\n\}/)[0],c);
 return{c,fetches:()=>fetches,serializations:()=>serializations,composed:()=>composed,reviewed:()=>reviewed,setFetchHook:hook=>fetchHook=hook};
}
(async()=>{
 for(const tier of [false,true]){
  const f=fixture(),{c}=f,before=JSON.stringify([c.authoring,c.levels,c.undoStack,c.redoStack,c.tierSnapshots]);
  c.tierSnapshots[Number(tier)].fixtureIssues=[{severity:'warning',code:'private-warning',message:'Retained warning'}];
  const prepared=c.prepareExportPreflight(tier),captured=prepared.projectJSON;
  assert.equal(f.fetches(),0,'Review performs no source I/O before confirmation');assert.equal(f.serializations(),1);assert.equal(prepared.playableOnly,tier);assert.equal(JSON.parse(captured).tier,tier?'Playable':'Editable');assert.equal(prepared.review.issues[0].severity,'warning');
  for(const frozen of [prepared,prepared.lease,prepared.review,prepared.review.issues,prepared.review.issues[0]])assert(Object.isFrozen(frozen));
  assert.notStrictEqual(f.reviewed(),c.tierSnapshots[Number(tier)],'Review receives a detached snapshot');
  // Neither a retained snapshot alias nor the report can replace reviewed bytes.
  f.reviewed().tier='mutated-detached-review';
  assert.equal(prepared.projectJSON,captured);
  assert.equal(await c.buildReviewedExport(prepared),'HTML');assert(f.fetches()>0);assert.equal(f.serializations(),1,'Reviewed build must not reserialize');assert.equal(f.composed().embeddedProjectJSON,captured);assert.equal(f.composed().playableOnly,tier);
  delete c.tierSnapshots[Number(tier)].fixtureIssues;assert.equal(JSON.stringify([c.authoring,c.levels,c.undoStack,c.redoStack,c.tierSnapshots]),before);
 }
 for(const tier of [false,true]){
  const f=fixture();f.c.tierSnapshots[Number(tier)].fixtureIssues=[{severity:'error',code:'private-error'}];const p=f.c.prepareExportPreflight(tier);assert.equal(f.fetches(),0);await assert.rejects(()=>f.c.buildReviewedExport(p),/preflight blocked/);assert.equal(f.fetches(),0);
 }
 const mutations=[['Play',c=>{c.playMode=true;}],['project replacement',c=>{c.levels=[];}],['level switch',c=>{c.currentLevelIndex++;}],['library edit',c=>{c.authoring.assets[0].keep=false;}],['Undo owner',c=>{c.undoStack=c.undoStack.slice();}],['Redo owner',c=>{c.redoStack=c.redoStack.slice();}],['Undo length',c=>{c.undoStack.push({new:true});}],['Redo length',c=>{c.redoStack.push({new:true});}],['Undo tail',c=>{c.undoStack[0]={changed:true};}],['Redo tail',c=>{c.redoStack[0]={changed:true};}]];
 for(const [name,mutate]of mutations){
  const f=fixture(),p=f.c.prepareExportPreflight(false);mutate(f.c);await assert.rejects(()=>f.c.buildReviewedExport(p),/Stop Play|stale/,name);assert.equal(f.fetches(),0,name+' must refuse before source I/O');
  const asyncF=fixture(),asyncP=asyncF.c.prepareExportPreflight(true);let release,first=true;
  asyncF.setFetchHook(()=>{if(first){first=false;return new Promise(resolve=>{release=resolve;});}});
  const pending=asyncF.c.buildReviewedExport(asyncP);assert(release,'Actual async builder must reach held source fetch');mutate(asyncF.c);release();let delivered=false;
  await assert.rejects(()=>pending.then(value=>{delivered=true;return value;}),/Stop Play|stale/,name+' after async work');assert.equal(delivered,false,'Stale result must not reach download caller');assert.equal(asyncF.serializations(),1);
 }
 for(const during of [false,true]){
  const f=fixture(),p=f.c.prepareExportPreflight(false);let pending,release,first=true;
  if(during){f.setFetchHook(()=>{if(first){first=false;return new Promise(resolve=>{release=resolve;});}});pending=f.c.buildReviewedExport(p);}
  f.c.cancelExportPreflight(p);if(during){release();await assert.rejects(()=>pending,/canceled|superseded/);}else{await assert.rejects(()=>f.c.buildReviewedExport(p),/canceled|superseded/);assert.equal(f.fetches(),0);}
 }
 const superseded=fixture(),old=superseded.c.prepareExportPreflight(false),fresh=superseded.c.prepareExportPreflight(true);superseded.c.cancelExportPreflight(old);assert.doesNotThrow(()=>superseded.c.assertExportPreflightLease(fresh));await assert.rejects(()=>superseded.c.buildReviewedExport(old),/superseded/);
 const playing=fixture();playing.c.playMode=true;assert.throws(()=>playing.c.prepareExportPreflight(false),/Stop Play/);assert.equal(playing.serializations(),0);
 const legacy=fixture();assert.equal(await legacy.c.buildExportHTML(false),'HTML');assert.equal(legacy.serializations(),1,'Legacy actual-builder entry retains exactly one serialization');
 console.log('Phase217 actual export lease: immutable exact-tier review, errors/warnings, no pre-confirm I/O, Cancel/superseded, Play/project/library/level/history before+after async refusal, reviewed single serialization and legacy builder compatibility PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
