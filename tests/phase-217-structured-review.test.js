'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const plumbing=require('../editor/src/00-authoring-plumbing'),schema=require('../editor/src/00-authoring-schema');
let portable,composed,fetches=0,serializationOptions=[];
// Real schema/reference, controller, Sprite action/event, camera and aggregate
// collectors. Other family implementations have dedicated tests; their empty
// boundaries here isolate the additional structured checks without fake schemas.
const ctx={OpusAuthoring:schema,OpusAuthoringPlumbing:plumbing,Opus:{SPRITE_PASS_RELATIONS:['behind-sprites','in-front-of-sprites']},CAMERA_PROJECTIONS:['perspective','orthographic'],ACTION_TYPES:{},CONDITION_TYPES:{},inputActionLabels:()=>({}),collectLootTableIssues:()=>[],collectTouchLayoutIssues:()=>[],OpusInputContexts:{collectIssues:()=>[]},OpusSignals:{collectDependencies:()=>({issues:[]})},OpusGraphValues:{},GRAPH_NODE_TYPES:{},projectMeta:{title:'Private'},currentUiConfig:{startScreen:{}},window:{},document:{querySelector:()=>null},activateTab:()=>{},renderProjectValidation:issues=>ctx.published=issues,serializeProject:options=>{serializationOptions.push(options);return portable(options);},fetch:async()=>{fetches++;return{ok:true,text:async()=>''};},composeExportHTML:value=>{composed=value;return 'HTML';}};
vm.createContext(ctx);
ctx.INPUT_ACTION_LABELS={}; // No builtin Action references in these focused records.
for(const name of ['behaviorParams','visitAuthoredActions','collectEditorReferenceUses','collectCanonicalProjectIssues','collectSpriteAnimationStateActionIssues','collectPlatformerPlayerIssues','collectTopdownPlayerIssues','collectControllerStateEventIssues','collectControllerAbilityPlayerIssues','collectSpriteAnimationEventListenerIssues','validateCameraOptions','collectStructuredProjectIssues']){
 const match=source.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));assert(match,name);vm.runInContext(match[0],ctx);
}
vm.runInContext(source.match(/async function buildExportHTML\(playableOnly\) \{[\s\S]*?\n\}/)[0],ctx);
const clean=()=>({levels:[{id:'room',objects:[{id:'owner',kind:'cube',behaviors:[]}]}],spriteSortingLayers:plumbing.normalizeSpriteSortingLayers(),prefabs:[]});
const copy=value=>JSON.parse(JSON.stringify(value));
function review(project){
 const before=JSON.stringify(project),collectors=['collectCanonicalProjectIssues','collectSpriteAnimationStateActionIssues','collectPlatformerPlayerIssues','collectTopdownPlayerIssues','collectControllerStateEventIssues','collectControllerAbilityPlayerIssues','collectSpriteAnimationEventListenerIssues','collectTouchLayoutIssues','collectLootTableIssues'],originals=collectors.map(name=>ctx[name]);let calls=0;
 for(const [index,name]of collectors.entries())ctx[name]=value=>{assert.strictEqual(value,project,'Aggregate must pass its supplied snapshot to '+name);calls++;return originals[index](value);};
 try{const result=ctx.collectStructuredProjectIssues(project);assert.equal(calls,collectors.length);assert.equal(JSON.stringify(project),before,'Structured audit must preserve supplied records');return result.issues;}
 finally{for(const [index,name]of collectors.entries())ctx[name]=originals[index];}
}
(async()=>{
 const invalid=clean();invalid.levels[0].playerSettings={controllerType:'platformer2d',platformerObjectRef:'missing-player'};
 invalid.levels[0].objects[0].spritePassRelation='private-invalid';
 invalid.levels[0].objects[0].behaviors=[{trigger:'controllerStateEvent',eventRef:{source:'other',state:'idle'}}];
 invalid.levels[0].objects.push({id:'camera',kind:'camera',options:{projection:'orthographic',orthographicHeight:0,mode:'fixed',targetGroup:{enabled:true,targetIds:['missing-camera-target'],padding:0.1}}});
 const issues=review(invalid);
 for(const code of ['platformer-player-target','controller-state-event-invalid','camera-orthographic-height-invalid','camera-target-group-reference-unavailable','hybrid-sprite-pass-relation-invalid'])assert(issues.some(entry=>entry.code===code&&entry.severity==='error'),code);
 assert(issues.every((entry,index)=>!index||plumbing.SEVERITIES.indexOf(issues[index-1].severity)<=plumbing.SEVERITIES.indexOf(entry.severity)),'Severity ordering is shared');
 portable=()=>invalid;ctx.levels=invalid.levels;
 for(const tier of [false,true]){fetches=0;serializationOptions=[];await assert.rejects(()=>ctx.buildExportHTML(tier),/Export preflight blocked/);assert.equal(fetches,0);assert.equal(serializationOptions.length,1);assert.equal(serializationOptions[0].includeTilesets,!tier);assert(ctx.published.some(entry=>entry.code==='camera-target-group-reference-unavailable'));}
 const inactive=clean();inactive.levels[0].objects[0].components={'jump-ability':{version:1}};
 assert(review(inactive).some(entry=>entry.code==='controller-ability-inactive-owner'&&entry.severity==='warning'),'Aggregate retains the real inactive-owner diagnostic alongside schema errors');
 const warning=clean(),box=schema.registry.get('box-collider-2d');warning.levels[0].objects[0].components={'box-collider-2d':{...copy(box.defaults),version:box.version+1}};
 const warningIssues=review(warning);assert(warningIssues.some(entry=>entry.code==='newer-version'&&entry.severity==='warning'));assert(!warningIssues.some(entry=>entry.severity==='error'),JSON.stringify(warningIssues));
 portable=()=>warning;ctx.levels=warning.levels;
 for(const tier of [false,true]){assert.equal(await ctx.buildExportHTML(tier),'HTML');assert.equal(composed.embeddedProjectJSON,JSON.stringify(warning));}
 // This models the serializer's existing exact-tier pruning boundary, not a
 // substitute dependency resolver: only Editable includes this unused Prefab.
 const full=clean();full.prefabs=[{name:'Unused incomplete draft',records:[{id:'draft',kind:'cube',behaviors:[{trigger:'controllerStateEvent',eventRef:{source:'invalid',state:'idle'}}]}]}];
 const playable=clean(),fullBefore=JSON.stringify(full),playableBefore=JSON.stringify(playable);
 portable=options=>options.includeTilesets?full:playable;ctx.levels=full.levels;
 assert(review(full).some(entry=>entry.prefabName==='Unused incomplete draft'&&entry.code==='controller-state-event-invalid'));
 assert(!review(playable).length);
 fetches=0;await assert.rejects(()=>ctx.buildExportHTML(false),/Export preflight blocked Editable/);assert.equal(fetches,0);
 assert.equal(await ctx.buildExportHTML(true),'HTML');assert.equal(composed.embeddedProjectJSON,playableBefore);assert.equal(JSON.stringify(full),fullBefore);assert.equal(JSON.stringify(playable),playableBefore);
 // Ordinary Problems intentionally extends serialization to the complete
 // authoring library before invoking the identical shared aggregate.
 ctx.spriteAssets=[];ctx.spriteAnimationClips=[];ctx.textureAssets=[];ctx.prefabs=full.prefabs;
 ctx.serializeTilesets=()=>[];ctx.serializeTextureAssets=()=>[];ctx.serializeProject=()=>copy(playable);
 vm.runInContext(source.match(/function prepareProjectHealthReview\([^]*?\n\}/)[0],ctx);
 vm.runInContext(source.match(/function validateCurrentProject\(\) \{[\s\S]*?\n\}/)[0],ctx);
 const fullReview=ctx.validateCurrentProject();assert(fullReview.issues.some(entry=>entry.prefabName==='Unused incomplete draft'&&entry.code==='controller-state-event-invalid'));assert.strictEqual(ctx.published,fullReview.issues);assert.strictEqual(ctx.lastProjectValidationLevels,ctx.levels);assert.equal(JSON.stringify(full),fullBefore);
 console.log('Phase217 actual structured aggregate: controller/event/camera/hybrid errors, inactive-owner warning, both-tier prefetch refusal, exact-tier unused-Prefab distinction and immutable embedded snapshot PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
