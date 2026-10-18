'use strict';
const assert=require('assert'),A=require('../editor/src/00-authoring-schema.js');
const future={kind:'cube',health:{max:25,current:25},components:{health:{version:99,max:999,current:999,extension:'future'}}};
assert.equal(A.serializeComponents(future).health.current,999,'Unsupported future records must not be overwritten by a legacy adapter');
const vec=(x,y,z)=>({x,y,z}),item={kind:'cube',entity:{position:vec(2,3,4),scale:vec(1,2,3),quaternion:{toEuler:()=>vec(.1,.2,.3)},color:[1,0,.5]},textureAssetId:'texture-1'};
assert(A.registry.get('transform'),'Core Transform is registered');assert(A.registry.get('visual'),'Core Visual is registered');
const record=A.serializeComponents(item);assert.deepStrictEqual(record.transform.position,[2,3,4]);assert.deepStrictEqual(record.transform.scale,[1,2,3]);assert.equal(record.visual.tint,'#ff0080');assert.equal(record.visual.textureAssetRef,'texture-1');
assert.equal(A.getComponentRemovability(item,'transform').ok,false);assert.equal(A.getComponentRemovability(item,'visual').ok,false);
const placed={kind:'cube',entity:{position:vec(12,13,14),scale:vec(4,5,6),quaternion:{toEuler:()=>vec(0,.7,0)},color:[0,1,0]}};
A.applyRecord({components:record},placed);assert.deepStrictEqual(placed.entity.position,vec(12,13,14),'Prefab placement owns its transform, not stale component mirror');assert.deepStrictEqual(placed.entity.scale,vec(4,5,6));assert.equal(A.serializeComponents(placed).transform.position[0],12);assert.equal(A.serializeComponents(placed).visual.tint,'#00ff00');
const copy={kind:'cube',entity:{position:vec(22,23,24),scale:vec(1,1,1),quaternion:{toEuler:()=>vec(0,0,0)},color:[0,0,1]}};A.copyComponents(item,copy);assert.equal(copy.entity.position.x,22);assert.equal(A.serializeComponents(copy).transform.position[0],22);
record.transform.position[0]=999;assert.equal(item.entity.position.x,2);
console.log('Phase073 core component ownership/legacy placement/future adapter preservation PASS');
const fs=require('fs'),vm=require('vm'),source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const helper=source.slice(source.indexOf('function bindCoreAuthoringInput('),source.indexOf('function mountIntrinsicCoreComponentSlots('));let history=0,value=4;const events={},control={onfocus:()=>history++,addEventListener:(name,fn)=>{events[name]=fn;}};
const ctx={pushUndo:()=>{assert.equal(value,4);history++;}};vm.createContext(ctx);vm.runInContext(helper,ctx);ctx.bindCoreAuthoringInput(control,()=>{value=2;});assert.equal(control.onfocus,null);assert.equal(history,0);control.oninput({});assert.equal(history,1);control.oninput({});assert.equal(history,1);events.blur();value=4;control.oninput({});assert.equal(history,2);
console.log('Phase073 actual core input history: first change before mutation, repeated input one transaction, untouched focus no mutation PASS');
const runtime={window:{},document:{addEventListener(){},removeEventListener(){},hidden:false},localStorage:{getItem(){return null;},setItem(){}},Float32Array,Uint16Array,Uint32Array,Uint8Array,DataView,ArrayBuffer,TextDecoder,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')};runtime.window.addEventListener=()=>{};runtime.window.removeEventListener=()=>{};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),runtime);const Opus=runtime.window.Opus;
const hierarchy={Opus,hierarchyTickToken:1};let parent,child,socket;
hierarchy.findItemById=id=>id==='parent'?parent:child;hierarchy.resolveSocketSourceTransform=()=>socket;
vm.createContext(hierarchy);vm.runInContext(source.slice(source.indexOf('function hierarchyCapable('),source.indexOf('function isDescendantOf(')),hierarchy);
vm.runInContext(source.slice(source.indexOf('function resolveWorldTransform('),source.indexOf('function reparentItem(')),hierarchy);
vm.runInContext(source.slice(source.indexOf('function commitEditedWorldTransform('),source.indexOf('function bindCoreAuthoringInput(')),hierarchy);
function nearVec(a,b){for(const axis of ['x','y','z'])assert(Math.abs(a[axis]-b[axis])<1e-8,`${axis}: ${a[axis]} != ${b[axis]}`);}
for(let i=0;i<80;i++){
 parent={kind:'cube',id:'parent',entity:{position:new Opus.Vec3(i*.2,-3,7),quaternion:Opus.Quat.fromEuler(.1+i*.007,.4,-.2),scale:new Opus.Vec3(2+i*.01,3,4)}};
 const position=new Opus.Vec3(2+i*.1,7,-4),rotation=Opus.Quat.fromEuler(.2,.6+i*.003,.4),scale=new Opus.Vec3(1.5,2.5,.75);
 child={kind:i%2?'sprite':'cube',id:'child',parentId:'parent',socketName:i%3===0?'socket':null,entity:{position:position.clone(),quaternion:rotation,scale:scale.clone()},localPosition:new Opus.Vec3(0,0,0),localScale:new Opus.Vec3(1,1,1)};
 socket=i%3===0?{position:new Opus.Vec3(-5,6,3),quaternion:Opus.Quat.fromEuler(-.3,.1+i*.01,.2),scale:new Opus.Vec3(.5,2,3)}:null;
 hierarchy.commitEditedWorldTransform(child);nearVec(child.entity.position,position);nearVec(child.entity.scale,scale);
 const expectedDirection=rotation.rotateVec3(new Opus.Vec3(.4,.2,.7)),actualDirection=child.entity.quaternion.rotateVec3(new Opus.Vec3(.4,.2,.7));nearVec(actualDirection,expectedDirection);
 hierarchy.hierarchyTickToken++;hierarchy.resolveWorldTransform(child);nearVec(child.entity.position,position);nearVec(child.entity.scale,scale);
}
console.log('Phase073 actual world-edit/resolve source:80 rotated nonuniform parent/socket frames and Cube/Sprite partition PASS');
