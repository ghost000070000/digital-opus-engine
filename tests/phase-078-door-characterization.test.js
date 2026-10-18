'use strict';
// Qualification-only characterization of existing APIs, not a Door API or
// assertions that visibility and modern Collider enablement should be unified.
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const Collider=require('../editor/src/00-collider-2d'),Body=require('../editor/src/00-body-2d');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0);const brace=source.indexOf('{',start);let depth=1,end=brace+1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(start,end);}
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new Vec3(this.x,this.y,this.z);}set(x,y,z){Object.assign(this,{x,y,z});return this;}}
class Quat{constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}}
const panel={id:'panel',kind:'cube',persistRuntimeState:true,components:{'box-collider-2d':{version:1,enabled:true,offset:[0,0],size:[2,2]}},entity:{position:new Vec3(3,0,0),scale:new Vec3(1,1,1),quaternion:new Quat(),visible:true,solid:true}};
let collisionCalls=0;
const c={placed:[panel],window:{},levels:[{id:'level'}],currentLevelIndex:0,Opus:{Vec3,Quat},playMode:true,OpusAuthoring:{stableClone:value=>JSON.parse(JSON.stringify(value))},resolveItemColliderCollision:(pos,vel)=>{collisionCalls++;return{collided:false,correctedPosition:pos,correctedVelocity:vel};}};
c.findItemById=id=>c.placed.find(item=>item.id===id);
c.validDoorGate=()=>false; // This characterizes historical non-Door panels only.
c.serializeItemRecord=item=>({kind:item.kind,id:item.id,position:[item.entity.position.x,item.entity.position.y,item.entity.position.z],scale:[1,1,1],components:JSON.parse(JSON.stringify(item.components))});
c.removeItemFromScene=item=>{c.placed=c.placed.filter(other=>other!==item);};
vm.createContext(c);
const visibility=source.slice(source.indexOf('  setVisibility: {'),source.indexOf('  enableObject: {'));
vm.runInContext('let authoredDeathBaseline=new Map(),authoredDeathJournal=new Set(),authoredSessionLevels=new Map();globalThis.ACTION_TYPES={'+visibility+'};'+['resolveTarget','targetEntity','reconcilePlayerWallContacts','collectWorldStateForLevel','applyWorldStateToCurrentLevel','captureAuthoredSessionLevels','captureAuthoredDeathBaseline','includeAuthoredDeaths','serializeScene'].map(extract).join('\n'),c);
c.reconcilePlayerWallContacts(new Vec3(),new Vec3(),.5,new Vec3(),null);assert.equal(collisionCalls,1,'Visible legacy Solid is a controller collision candidate');
c.ACTION_TYPES.setVisibility.exec({targetId:'panel',visible:false},panel);
assert.equal(panel.entity.visible,false,'Canonical legacy Show/Hide writes actual visibility');
assert.equal(panel.components['box-collider-2d'].enabled,true,'Legacy Show/Hide does not rewrite modern physics policy');
collisionCalls=0;c.reconcilePlayerWallContacts(new Vec3(),new Vec3(),.5,new Vec3(),null);assert.equal(collisionCalls,0,'Hidden legacy Solid is deliberately pass-through');
assert.equal(Collider.enumerateCollider2DWorldShapes(panel).length,1,'Modern enabled Collider remains present while rendered entity is hidden');
function modernFixture(enabled){const object=(id,x,type,velocity)=>({id,kind:'cube',components:{'box-collider-2d':{version:1,enabled:true,offset:[0,0],size:[2,2]},'body-2d':{version:1,enabled:true,type,linearVelocity:velocity}},entity:{position:{x,y:0,z:0},visible:true},worldMatrix:Collider.composeMatrix({position:[x,0,0]})});const mover=object('mover',0,'kinematic',[30,0]),wall=object('wall',3,'static',[0,0]);wall.entity.visible=false;wall.components['box-collider-2d'].enabled=enabled;Body.createBody2DManager().tick([mover,wall],.1);return mover.entity.position.x;}
assert(modernFixture(true)<3,'Actual Body2D movement is blocked by hidden enabled Collider');
assert.equal(modernFixture(false),3,'Actual Body2D movement passes when Collider is explicitly disabled');
const saved=c.collectWorldStateForLevel('level');assert.equal(saved.panel.visible,false,'Opt-in legacy World State stores live hidden state');assert.equal(saved.panel.components,undefined,'Historical World State does not own Collider component flags');
// Capture a known enabled authored configuration then inspect current policy
// independently: direct component mutation is not a canonical Door operation.
panel.components['box-collider-2d'].enabled=true;c.captureAuthoredDeathBaseline();panel.components['box-collider-2d'].enabled=false;
assert.equal(c.serializeScene()[0].components['box-collider-2d'].enabled,false,'Current project projection preserves survivor Collider edits; future Door must restore only its owned runtime override');
panel.entity.visible=true;c.window.__worldState={level:saved};c.applyWorldStateToCurrentLevel();
assert.equal(panel.entity.visible,false,'Canonical World State restores legacy hidden state');
assert.equal(panel.components['box-collider-2d'].enabled,false,'Historical World State restoration does not reconcile modern Collider enabled flags');
console.log('Phase078 characterization PASS: hidden legacy Solid passable; hidden modern enabled Collider blocks; explicit disabled Collider passes; World State owns visibility, not Collider flags; project projection preserves survivor component edits');
