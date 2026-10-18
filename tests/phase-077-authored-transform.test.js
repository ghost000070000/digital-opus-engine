'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name+' exists');const brace=source.indexOf('{',start);let depth=1,end=brace+1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return (name==='exitPlayMode'?extract('setShadowAuthoringControlsEditable')+'\n':'')+source.slice(start,end)+(name==='exitPlayMode'?'\n'+extract('clearCameraShake'):'');}
class Vec3 { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new Vec3(this.x,this.y,this.z);}set(x,y,z){Object.assign(this,{x,y,z});return this;} }
const noop=()=>{},dom={classList:{remove:noop}},owner={id:'safe-marker',kind:'cube',entity:{position:new Vec3(6,.5,2),scale:new Vec3(1,1,1),visible:true},components:{checkpoint:{version:1,enabled:true,offset:[0,1,0]}}};
const c={placed:[owner],playMode:false,gameEnded:false,collectedPickupObjects:new WeakSet(),OpusAuthoring:{stableClone:value=>JSON.parse(JSON.stringify(value))},authoredBody2DTransforms:new Map(),body2DObjects:new Set(),body2DManager:null,trigger2DManager:null,signalRuntime:{clear:noop},graphTrace:{enabled:false},syncGraphTrace:noop,updateInteract:noop,renderSignalManager:noop,restoreAuthoredObjectVariables:noop,restoreAuthoredObjectHealth:noop,updateHierarchyTransforms:noop,gamepadHeldKeys:new Set(),window:{},despawnPlayer:noop,stopAmbientAudio:noop,app:{scene:{},paused:false,camera:{},input:{simulateKeyUp:noop}},document:{getElementById:()=>dom},toastEl:dom,endOverlayEl:dom,pauseOverlayEl:dom,setObjective:noop,resetSpriteAnimationForItem:noop};
c.resetParallaxRuntime=noop;
c.stopPerformanceProfilerSession=noop; // Diagnostic lifetime has its actual adapter/native coverage in216; this fixture owns transform restoration.
c.releaseTouchInputControls=noop; // No touch nodes; actual source cleanup is covered by Phase093.
c.resetTransientScreens=noop; // Overlay lifetime is covered by Phase086's real helpers, not this transform-only fixture.
c.restoreDoorGatesForAuthoring=noop; // No Door components in this transform fixture.
c.levels=[{id:'level1',ui:{hudElements:[{id:'hud1',kind:'label',text:'Authored',visible:true}]}}];c.currentLevelIndex=0;c.currentUiConfig=JSON.parse(JSON.stringify(c.levels[0].ui));c.authoredUiConfigs=new Map();c.renderUiConfigPanel=noop;
c.findItemById=id=>c.placed.find(item=>item.id===id);
c.serializeItemRecord=item=>{const record={id:item.id,kind:item.kind,position:[item.entity.position.x,item.entity.position.y,item.entity.position.z],scale:[item.entity.scale.x,item.entity.scale.y,item.entity.scale.z],components:JSON.parse(JSON.stringify(item.components))};for(const key of ['rotationY','quaternion','parentId','socketName','localPosition','localRotationY','localQuat','localScale'])if(item[key]!==undefined)record[key]=JSON.parse(JSON.stringify(item[key]));return record;};
c.loadScene=records=>{c.placed=records.map(record=>({...record,entity:{position:new Vec3(...record.position),scale:new Vec3(...record.scale),visible:true},components:record.components}));};
vm.createContext(c);
const setPosition=source.slice(source.indexOf('  setPosition: {'),source.indexOf('  rotateObject: {'));
vm.runInContext('let authoredDeathBaseline=new Map(),authoredDeathJournal=new Set(),authoredSessionLevels=new Map();globalThis.ACTION_TYPES={'+setPosition+'};'+['defaultUiConfig','copyUiConfig','applyLevelUiConfig','captureAuthoredUiConfigs','restoreAuthoredUiConfigs','resolveTarget','targetEntity','captureAuthoredSessionLevels','captureAuthoredDeathBaseline','includeAuthoredDeaths','authoredLevelObjectRecords','restoreAuthoredDeaths','captureAuthoredBody2DTransforms','restoreAuthoredBody2DTransforms','exitPlayMode','serializeScene'].map(extract).join('\n'),c);
c.captureAuthoredDeathBaseline();c.captureAuthoredBody2DTransforms();c.captureAuthoredUiConfigs();c.playMode=true;
c.currentUiConfig.hudElements[0].text='Runtime';c.currentUiConfig.hudElements[0].visible=false;
c.ACTION_TYPES.setPosition.exec({targetId:'safe-marker',x:6,y:80.5,z:2},owner);
assert.equal(owner.entity.position.y,80.5,'Set Position remains an intentional immediate runtime teleport');
// Stop must restore authoring, rather than making runtime movement collision-
// aware or resetting the qualification fixture to conceal leaked gameplay state.
c.exitPlayMode();
assert.equal(c.currentUiConfig.hudElements[0].text,'Authored','Actual Stop restores authored HUD text through the real session helper');assert.equal(c.currentUiConfig.hudElements[0].visible,true);assert.equal(c.authoredUiConfigs.size,0);
assert.equal(c.findItemById('safe-marker').entity.position.y,.5,'Ordinary Cube runtime Set Position must not bake into authoring after Stop');
assert.equal(c.findItemById('safe-marker').components.checkpoint.offset[1],1,'Transform recovery preserves authored component configuration');
// The serialization seam produces the same explicit Cube/Sprite transform
// record keys as production. Actual serializeScene/includeAuthoredDeaths own
// projection, reference preservation and cloning, not this fixture serializer.
const second=c.findItemById('safe-marker');
Object.assign(second,{rotationY:.25,quaternion:[0,.2,0,.98],parentId:'parent',socketName:'socket',localPosition:[1,2,3],localRotationY:.1,localQuat:[0,.1,0,.99],localScale:[2,3,4]});
second.components.transform={version:1,position:[6,.5,2],rotation:[0,.25,0],scale:[1,1,1]};
const authored=JSON.parse(JSON.stringify(c.serializeItemRecord(second)));
c.captureAuthoredDeathBaseline();c.captureAuthoredUiConfigs();c.playMode=true;
c.ACTION_TYPES.setPosition.exec({targetId:second.id,x:12,y:80.5,z:9},second);
Object.assign(second,{rotationY:2,quaternion:[.5,.5,.5,.5],parentId:'runtime-parent',socketName:'runtime-socket',localPosition:[40,50,60],localRotationY:2,localQuat:[.5,.5,.5,.5],localScale:[9,9,9]});
second.components.transform.position=[12,80.5,9];
second.components.checkpoint.offset=[0,7,0];
const project=c.serializeScene()[0],runtime=c.serializeScene(true)[0];
assert.equal(runtime.position[1],80.5,'Runtime level view preserves legacy direct teleport');
assert.equal(runtime.parentId,'runtime-parent','Runtime level view preserves live hierarchy semantics');
assert.equal(runtime.components.transform.position[1],80.5,'Runtime level view keeps its live Transform mirror');
for(const key of ['position','scale','rotationY','quaternion','parentId','socketName','localPosition','localRotationY','localQuat','localScale'])assert.deepStrictEqual(JSON.parse(JSON.stringify(project[key])),authored[key],'Project owns original '+key);
assert.deepStrictEqual(JSON.parse(JSON.stringify(project.components.transform)),authored.components.transform,'Project owns original component Transform mirror');
assert.deepStrictEqual(project.components.checkpoint.offset,[0,7,0],'Transform projection retains unrelated surviving component edits');
project.position[1]=999;project.quaternion[0]=999;project.localPosition[0]=999;project.components.transform.position[0]=999;
const projectedAgain=c.serializeScene()[0];
assert.equal(projectedAgain.position[1],.5,'Project view cannot mutate authored baseline');
assert.equal(projectedAgain.quaternion[0],0,'Orientation snapshot is deep-owned');
assert.equal(projectedAgain.localPosition[0],1,'Local transform snapshot is deep-owned');
assert.equal(projectedAgain.components.transform.position[0],6,'Transform component mirror is deep-owned');
assert.equal(second.entity.position.y,80.5,'Project serialization cannot move a live gameplay object');
assert.equal(second.components.transform.position[0],12,'Project serialization cannot mutate live component mirror');
c.exitPlayMode();
assert.equal(c.findItemById(second.id).entity.position.y,.5);
assert.deepStrictEqual(c.findItemById(second.id).components.checkpoint.offset,[0,7,0],'Stop restores transforms without replacing unrelated survivor configuration');
console.log('Phase077 actual canonical teleport/Stop, project versus runtime view, hierarchy/quaternion ownership and deep independence PASS');
