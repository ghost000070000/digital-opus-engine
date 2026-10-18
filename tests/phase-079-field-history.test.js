'use strict';
const assert=require('assert');
const Fields=require('../editor/src/00-inspector-fields');
// Thin event/selector DOM adapter only: all validation, mutation and history
// ordering under test execute the actual mounted Inspector implementation.
class Node {
 constructor(dataset={},parent=null){this.dataset=dataset;this.parent=parent;this.children=[];this.disabled=false;this.checked=false;this.value='';this.innerHTML='';this.classList={add(){},remove(){},toggle(){}};if(parent)parent.children.push(this);}
 matches(selector){const clauses=[...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];return clauses.every(([,key,value])=>{const name=key.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return Object.hasOwn(this.dataset,name)&&(value===undefined||String(this.dataset[name])===value);})&&(!selector.includes(':checked')||this.checked);}
 closest(selector){for(let node=this;node;node=node.parent)if(node.matches(selector))return node;return null;}
 querySelectorAll(selector){const result=[];function visit(node){for(const child of node.children){if(child.matches(selector))result.push(child);visit(child);}}visit(this);return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 setAttribute(){}
}
function mounted(overrides={}){
 const values={distance:4,duration:2,collisionMaskRefs:['a']};
 const fields=[{key:'distance',type:'number',required:true,defaultValue:4},{key:'duration',type:'number',required:true,defaultValue:2},{key:'collisionMaskRefs',type:'collisionMaskRefs',defaultValue:['a']}];
 const container=new Node();const listeners={};container.addEventListener=(name,fn)=>listeners[name]=fn;
 new Node({fieldEditorIssues:''},container);
 for(const field of fields){const row=new Node({fieldEditorRow:field.key},container);new Node({fieldEditorReset:field.key},row).disabled=Fields.sameValue(values[field.key],field.defaultValue);new Node({fieldEditorLocalIssues:field.key},row);
  if(field.type==='collisionMaskRefs'){const group=new Node({maskGroup:field.key},row);new Node({maskSelect:'all'},group);new Node({maskSelect:'none'},group);for(const id of ['a','b']){const control=new Node({fieldEditorKey:field.key},group);control.value=id;control.checked=values[field.key].includes(id);}}
  else{const control=new Node({fieldEditorKey:field.key},row);control.value=String(values[field.key]);}
 }
 const snapshots=[],changes=[];Fields.mountSection(container,{fields,values,onBeforeChange(field){snapshots.push({key:field.key,values:JSON.parse(JSON.stringify(values))});},onChange(field,value){changes.push({key:field.key,value});},...overrides});
 const control=key=>container.querySelector(`[data-field-editor-key="${key}"]`);
 const fire=(type,target,relatedTarget=null)=>{if(listeners[type])listeners[type]({target,relatedTarget});};
 const edit=(key,value)=>{control(key).value=value;fire('input',control(key));};
 return{values,snapshots,changes,container,control,fire,edit};
}
const failures=[];let passed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failures.push(name+': '+error.message);console.error('FAIL '+name+': '+error.message);}}
test('Focus and Tab alone create no history',()=>{const f=mounted();f.fire('focusin',f.control('distance'));f.fire('focusout',f.control('distance'),f.control('duration'));f.fire('focusin',f.control('duration'));assert.equal(f.snapshots.length,0);});
test('First valid changed input snapshots before mutation; typing coalesces',()=>{const f=mounted();f.fire('focusin',f.control('distance'));assert.equal(f.snapshots.length,0);f.edit('distance','2');assert.equal(f.snapshots.length,1);assert.equal(f.snapshots[0].values.distance,4);f.edit('distance','3');f.fire('change',f.control('distance'));assert.equal(f.snapshots.length,1);assert.equal(f.values.distance,3);});
test('Blur and untouched next field do not consume the one-step Undo',()=>{const f=mounted();f.fire('focusin',f.control('distance'));f.edit('distance','2');f.fire('focusout',f.control('distance'),f.control('duration'));f.fire('focusin',f.control('duration'));assert.equal(f.snapshots.length,1);assert.equal(f.snapshots.at(-1).values.distance,4);f.edit('duration','3');assert.equal(f.snapshots.length,2);assert.equal(f.snapshots[1].values.duration,2);assert.equal(f.snapshots[1].values.distance,2);});
test('Invalid and unchanged input create no history or mutation',()=>{const f=mounted();f.fire('focusin',f.control('distance'));f.edit('distance','nonsense');assert.equal(f.snapshots.length,0);assert.equal(f.values.distance,4);f.edit('distance','4');assert.equal(f.snapshots.length,0);assert.equal(f.changes.length,0);f.edit('distance','5');assert.equal(f.snapshots.length,1);assert.equal(f.snapshots[0].values.distance,4);});
test('Refocusing a changed field begins a fresh valid edit transaction',()=>{const f=mounted();f.fire('focusin',f.control('distance'));f.edit('distance','2');f.fire('focusout',f.control('distance'));f.fire('focusin',f.control('distance'));assert.equal(f.snapshots.length,1);f.edit('distance','3');assert.equal(f.snapshots.length,2);assert.equal(f.snapshots[1].values.distance,2);});
test('Reset is one changed mutation with original snapshot',()=>{const f=mounted();f.fire('focusin',f.control('distance'));f.edit('distance','2');f.fire('focusout',f.control('distance'));f.snapshots.length=0;const button=f.container.querySelector('[data-field-editor-reset="distance"]');f.fire('click',button);assert.equal(f.snapshots.length,1);assert.equal(f.snapshots[0].values.distance,2);assert.equal(f.values.distance,4);assert.equal(f.control('distance').value,4);});
test('Mask bulk actions snapshot only changed actual mutations',()=>{const f=mounted();const all=f.container.querySelector('[data-mask-select="all"]'),none=f.container.querySelector('[data-mask-select="none"]');f.fire('click',all);assert.equal(f.snapshots.length,1);assert.deepStrictEqual(f.snapshots[0].values.collisionMaskRefs,['a']);assert.deepStrictEqual(f.values.collisionMaskRefs,['a','b']);f.fire('click',all);assert.equal(f.snapshots.length,1,'No-op Select All must not snapshot');f.fire('focusout',f.control('collisionMaskRefs'));f.fire('click',none);assert.equal(f.snapshots.length,2);assert.deepStrictEqual(f.snapshots[1].values.collisionMaskRefs,['a','b']);assert.deepStrictEqual(f.values.collisionMaskRefs,[]);assert(f.container.querySelectorAll('[data-field-editor-key="collisionMaskRefs"]').every(c=>!c.checked));});
test('Phase198 continuing edit guard refusal restores last accepted control without mutation/history',()=>{let allowed=true;const f=mounted({canChange:()=>allowed});f.edit('distance','2');allowed=false;f.edit('distance','9');assert.equal(f.values.distance,2);assert.equal(f.control('distance').value,2);assert.equal(f.snapshots.length,1);assert.equal(f.changes.length,1);});
test('Phase198 refused first-change capture restores controls and creates no history',()=>{const f=mounted({onBeforeChange:()=>false});f.edit('distance','9');assert.equal(f.values.distance,4);assert.equal(f.control('distance').value,4);assert.equal(f.snapshots.length,0);assert.equal(f.changes.length,0);});
assert.equal(failures.length,0,failures.join('\n'));console.log('Phase079 actual mounted Inspector history tests PASS ('+passed+')');
