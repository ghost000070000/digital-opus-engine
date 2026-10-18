'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const project={levels:[{id:'room',objects:[{id:'console',kind:'cube',behaviors:[{trigger:'interact',action:'graph',graph:{nodes:[{id:'open',type:'openDoor',targetId:'missing-door'}],edges:[{from:'start',to:'open',kind:'next'}]}}]}]}]};let fetches=0,serializations=0,composed;
const ctx={OpusAuthoring:require('../editor/src/00-authoring-schema'),OpusAuthoringPlumbing:require('../editor/src/00-authoring-plumbing'),ACTION_TYPES:{openDoor:{fields:[{type:'target',key:'targetId'}]}},CONDITION_TYPES:{},inputActionLabels:()=>({}),serializeProject:()=>{serializations++;return project;},collectLootTableIssues:()=>[],collectTouchLayoutIssues:()=>[],OpusInputContexts:{collectIssues:()=>[]},OpusSignals:{collectDependencies:()=>({issues:[]})},OpusGraphValues:{},GRAPH_NODE_TYPES:{},projectMeta:{title:'Private'},currentUiConfig:{startScreen:{}},window:{},document:{querySelector:()=>null},activateTab:()=>{},renderProjectValidation:issues=>ctx.issues=issues,fetch:async()=>{fetches++;return{ok:true,text:async()=>''};},composeExportHTML:value=>{composed=value;return 'HTML';}};vm.createContext(ctx);
for(const name of ['behaviorParams','visitAuthoredActions','collectEditorReferenceUses','collectCanonicalProjectIssues']){const match=source.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));if(match)vm.runInContext(match[0],ctx);}
ctx.levels=project.levels;
ctx.INPUT_ACTION_LABELS={}; // No builtin Action references in this focused fixture.
// This focused fixture owns the real canonical gate; the companion structured-
// review test executes the complete aggregate and its extra real collectors.
ctx.collectStructuredProjectIssues=project=>ctx.collectCanonicalProjectIssues(project);
project.spriteSortingLayers=ctx.OpusAuthoringPlumbing.normalizeSpriteSortingLayers();
vm.runInContext(source.match(/async function buildExportHTML\(playableOnly\) \{[\s\S]*?\n\}/)[0],ctx);
(async()=>{
 const original=JSON.stringify(project);for(const tier of [false,true]){fetches=0;serializations=0;await assert.rejects(()=>ctx.buildExportHTML(tier),/Export preflight/,'Actual builder must reject missing runtime Graph target before source fetch/composition');assert.equal(fetches,0);assert.equal(serializations,1);assert(ctx.issues.some(x=>x.code==='dangling-reference'&&x.graphNodeId==='open'&&x.objectId==='console'));assert.equal(JSON.stringify(project),original);}
 project.levels[0].objects.push({id:'door',kind:'cube'});project.levels[0].objects[0].behaviors[0].graph.nodes[0].targetId='door';for(const tier of [false,true]){fetches=0;assert.equal(await ctx.buildExportHTML(tier),'HTML');assert(fetches>0);assert.equal(composed.playableOnly,tier);assert.equal(JSON.parse(composed.embeddedProjectJSON).levels[0].objects[0].behaviors[0].graph.nodes[0].targetId,'door');}
 // Unknown component IDs are preserved inert data; the collector intentionally
 // skips them. This is distinct from a known schema's newer-version warning.
 project.levels[0].objects[0].components={'private-unknown':{version:99,retained:'keep'}};
 const unknownRetained=JSON.stringify(project);
 for(const tier of [false,true]){assert.equal(await ctx.buildExportHTML(tier),'HTML','Unknown retained component data must not become a blanket error');assert.equal(composed.embeddedProjectJSON,unknownRetained);assert.equal(JSON.stringify(project),unknownRetained);}
 const colliderSchema=ctx.OpusAuthoring.registry.get('box-collider-2d');assert(colliderSchema,'Exercise a registered real component schema');
 project.levels[0].objects[0].components['box-collider-2d']={...JSON.parse(JSON.stringify(colliderSchema.defaults)),version:colliderSchema.version+1,retainedFutureField:{keep:['exact',0,false]}};
 const futureRetained=JSON.stringify(project),warningReview=ctx.collectCanonicalProjectIssues(project);
 assert(warningReview.issues.some(entry=>entry.code==='newer-version'&&entry.severity==='warning'&&entry.componentId==='box-collider-2d'&&entry.objectId==='console'),'Real canonical collector must report the registered future component as a warning');
 assert(!warningReview.issues.some(entry=>entry.severity==='error'),'Fixture must be warning-only, not accepted by an unrelated bypass: '+JSON.stringify(warningReview.issues));
 for(const tier of [false,true]){fetches=0;assert.equal(await ctx.buildExportHTML(tier),'HTML','Actual newer-version warning must permit both export tiers');assert(fetches>0);assert.equal(composed.playableOnly,tier);assert.equal(composed.embeddedProjectJSON,futureRetained,'Embed all unknown and future component data unchanged');assert.equal(JSON.stringify(project),futureRetained,'Warning-only export must not mutate authored records');}
 // Each legacy preflight family must publish the same current report consumed
 // by ordinary Problems navigation/filtering, before any asynchronous source I/O.
 ctx.undoStack=[{privateUndo:'keep'}];ctx.redoStack=[{privateRedo:'keep'}];
 const families=[['Loot',ctx,'collectLootTableIssues',false],['Touch',ctx,'collectTouchLayoutIssues',false],['Input context',ctx.OpusInputContexts,'collectIssues',false],['Signal',ctx.OpusSignals,'collectDependencies',true]];
 for(const [family,owner,key,wrapped] of families){
  const originalCollector=owner[key],issues=[{severity:'error',code:'private-family-refusal',scope:family,message:'Repair retained private fixture',objectId:'console',levelId:'room'}];
  owner[key]=()=>wrapped?{issues}:issues;
  try{for(const tier of [false,true]){
   fetches=0;ctx.issues=null;ctx.lastProjectValidation={issues:[{code:'retired-report'}]};ctx.lastProjectValidationLevels=[];
   const beforeProject=JSON.stringify(project),beforeHistory=JSON.stringify([ctx.undoStack,ctx.redoStack]),undoOwner=ctx.undoStack,redoOwner=ctx.redoStack;
   await assert.rejects(()=>ctx.buildExportHTML(tier),new RegExp(family),'Actual '+family+' refusal must block both tiers');
   assert.equal(fetches,0);assert.strictEqual(ctx.issues,issues);assert.strictEqual(ctx.lastProjectValidation.issues,issues,'Filters must retain the freshly published '+family+' report');assert.strictEqual(ctx.lastProjectValidationLevels,ctx.levels,'Repair navigation must own the current levels');
   assert.equal(JSON.stringify(project),beforeProject);assert.equal(JSON.stringify([ctx.undoStack,ctx.redoStack]),beforeHistory);assert.strictEqual(ctx.undoStack,undoOwner);assert.strictEqual(ctx.redoStack,redoOwner);
  }}finally{owner[key]=originalCollector;}
 }
 ctx.fetch=async()=>{project.levels[0].objects[0].behaviors[0].graph.nodes[0].targetId='changed-during-fetch';return{ok:true,text:async()=>''};};await ctx.buildExportHTML(true);assert.equal(JSON.parse(composed.embeddedProjectJSON).levels[0].objects[0].behaviors[0].graph.nodes[0].targetId,'door','Embed exactly the detached snapshot validated before async work');
 console.log('Phase217 actual canonical typed Graph export gate: both tiers prefetch refusal/location/nonmutation, repaired acceptance, retained unknown data, real registered future-version warning with exact both-tier bytes/nonmutation, four legacy-family current report ownership/prefetch/history guards, exact async snapshot PASS');
})().catch(e=>{console.error(e);console.error(JSON.stringify(ctx.issues));process.exitCode=1;});
