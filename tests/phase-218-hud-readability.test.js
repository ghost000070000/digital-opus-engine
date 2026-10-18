'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const code=fs.readFileSync(require.resolve('../editor/src/00-hud-canvas.js'),'utf8');
function fixture(){
 class Node{
  constructor(){this.style={};this.dataset={};this.children=[];this.attrs={};this.listeners={};this.isConnected=true;this.offsetWidth=100;this.offsetHeight=30;this.offsetLeft=0;this.offsetTop=0;this.clientWidth=100;this.clientHeight=30;this.scrollWidth=100;this.scrollHeight=30;this.computed={display:'block',visibility:'visible',transform:'none'};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}
  set innerHTML(value){this.markup=value;this.children=[];this.controls=[];for(const match of value.matchAll(/data-hud-create-kind="([^"]+)"/g)){const button=new Node();button.dataset.hudCreateKind=match[1];this.controls.push(button);}if(value.includes('<select')){this.select=new Node();this.select.value='';}}
  get innerHTML(){return this.markup||'';}
  querySelector(selector){if(selector==='select'||selector==='[data-hud-image-asset]')return this.select;if(selector==='[data-hud-create-kind="image"]')return this.controls.find(node=>node.dataset.hudCreateKind==='image');return null;}
  querySelectorAll(selector){return selector==='[data-hud-create-kind]'?this.controls||[]:[];}
  append(child){this.children.push(child);child.offsetParent=this;}appendChild(child){this.append(child);}replaceChildren(){this.children=[];}after(){}setAttribute(name,value){this.attrs[name]=value;}removeAttribute(name){delete this.attrs[name];}addEventListener(type,fn){this.listeners[type]=fn;}removeEventListener(type){delete this.listeners[type];}focus(){}contains(node){return this.children.includes(node);}closest(){return this;}setPointerCapture(){}hasPointerCapture(){return false;}getClientRects(){return this.isConnected?[{}]:[];}getBoundingClientRect(){throw Error('Readability must not use transformed screen rectangle coordinates');}
 }
 const host=new Node(),stage=new Node(),frame=new Node(),toolbar=new Node(),expand=new Node(),help=new Node();
 host.querySelector=selector=>({'.hud-canvas-stage':stage,'.hud-canvas-frame':frame,'.hud-canvas-toolbar':toolbar,'.hud-canvas-expand':expand})[selector];
 Object.defineProperty(host,'lastElementChild',{get:()=>help});frame.clientWidth=320;stage.offsetWidth=1280;stage.offsetHeight=720;
 let elements=[],editable=true,renders=0,changes=0,reads=0;
 const created=[],metrics=new Map(),document={createElement:()=>{const node=new Node();created.push(node);return node;},addEventListener(){},removeEventListener(){}},window={addEventListener(){},removeEventListener(){},getComputedStyle:node=>{reads++;return node.computed;}};
 const c={document,window,module:{exports:{}}};vm.createContext(c);vm.runInContext(code,c);
 const api=c.module.exports.mount(host,{getElements:()=>elements,getImageAssets:()=>[],isEditable:()=>editable,renderMarkup:()=>{renders++;return '';},onSelect:()=>changes++,onCreate:()=>changes++,onCommitMove:()=>changes++,onAfterRender:layer=>{for(const node of layer.children)Object.assign(node,metrics.get(node.dataset.hudId)||{});}});
 return{api,host,stage,metrics,viewportSelect:created.find(node=>node.markup?.includes('hud-preview-size')).select,setElements(value){elements=value;api.render();},setEditable(value){editable=value;},renders:()=>renders,changes:()=>changes,reads:()=>reads,elements:()=>elements};
}
const plain=value=>JSON.parse(JSON.stringify(value));
const f=fixture();
f.metrics.set('center',{offsetLeft:640,offsetTop:360,offsetWidth:100,offsetHeight:30,computed:{display:'block',visibility:'visible',transform:'matrix(1, 0, 0, 1, -50, -15)'}});
f.metrics.set('outside',{offsetLeft:1260,offsetTop:0});
f.metrics.set('overflow',{offsetLeft:20,offsetTop:20,clientWidth:80,scrollWidth:150});
f.metrics.set('button',{clientWidth:80,scrollWidth:400,querySelector:()=>({clientWidth:400,clientHeight:30,scrollWidth:400,scrollHeight:30})});
f.metrics.set('hidden',{offsetLeft:-9000,scrollWidth:9000});
f.metrics.set('near',{offsetLeft:-0.5});
f.metrics.set('rotated',{computed:{display:'block',visibility:'visible',transform:'matrix(0, 1, -1, 0, 0, 0)'}});
const records=['center','outside','overflow','button','hidden','near','rotated'].map(id=>({id,kind:id==='button'?'button':'label',text:'<img src=x onerror=bad()>',...(id==='hidden'?{visible:false}:{})}));
f.setElements(records);const before=JSON.stringify(records),renders=f.renders(),changes=f.changes(),stageStyle=JSON.stringify(f.stage.style),nodeStyles=JSON.stringify(f.stage.children.map(node=>node.style));
const report=f.api.inspectReadability();assert.equal(report.available,true);assert.deepStrictEqual(plain(report.viewport),{width:1280,height:720});
assert.deepStrictEqual(plain(report.issues.map(issue=>issue.id).sort()),['button','outside','overflow']);assert(report.issues.some(issue=>issue.code==='hud-preview-outside'));assert(report.issues.some(issue=>issue.code==='hud-preview-text-overflow'));
assert.deepStrictEqual(plain(report.entries.find(entry=>entry.id==='center').bounds),{x:590,y:345,width:100,height:30});assert.equal(report.entries.find(entry=>entry.id==='hidden').status,'hidden');assert.equal(report.entries.find(entry=>entry.id==='rotated').status,'unavailable');
assert.equal(JSON.stringify(records),before);assert.equal(f.renders(),renders);assert.equal(f.changes(),changes);assert.equal(JSON.stringify(f.stage.style),stageStyle);assert.equal(JSON.stringify(f.stage.children.map(node=>node.style)),nodeStyles);assert(!report.issues.some(issue=>issue.message.includes('<img')),'Messages are plain fixed text, not authored markup');assert(report.limitations[0].includes('No contrast'));
f.stage.offsetWidth=0;assert.equal(f.api.inspectReadability().available,false);f.stage.offsetWidth=1280;f.stage.isConnected=false;assert.equal(f.api.inspectReadability().available,false);f.stage.isConnected=true;
f.stage.parentElement={tagName:'DETAILS',open:false};assert.equal(f.api.inspectReadability().available,false,'Native closed details may retain nonzero cached geometry');f.stage.parentElement.open=true;assert.equal(f.api.inspectReadability().available,true);f.stage.parentElement={hidden:true};assert.equal(f.api.inspectReadability().available,false);f.stage.parentElement=null;
f.setEditable(false);assert(f.api.inspectReadability().reason.includes('Stop Play'));f.setEditable(true);
f.metrics.set('cssHidden',{computed:{display:'none',visibility:'visible',transform:'none'},offsetLeft:-4000});f.setElements([{id:'cssHidden',kind:'label'}]);assert.equal(f.api.inspectReadability().entries[0].status,'hidden');assert.equal(f.api.inspectReadability().issues.length,0);
f.setElements(Array.from({length:300},(_,index)=>({id:'item-'+index,kind:'panel'})));const bounded=f.api.inspectReadability();assert.equal(bounded.truncated,true);assert.equal(bounded.entries.length,256);assert.equal(bounded.issues.length,0);
// Mounted actual viewport selector changes only preview dimensions, never the
// authored records. Reports do not confuse the320px frame with this viewport.
const beforeViewport=JSON.stringify(f.elements());f.viewportSelect.onchange({target:{value:'phone'}});assert.deepStrictEqual(plain(f.api.inspectReadability().viewport),{width:390,height:844});assert.equal(JSON.stringify(f.elements()),beforeViewport);
f.stage.listeners.pointerdown({button:0,target:f.stage.children[0],pointerId:1,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}});assert(f.api.inspectReadability().reason.includes('drag'));f.stage.listeners.pointercancel();
f.api.destroy();assert.equal(f.api.inspectReadability().available,false);assert(f.api.inspectReadability().reason.includes('destroyed'));
console.log('Phase218 mounted actual HUD readability: local offset/center translation, outside/text advisories, hidden/unavailable/Play/destroy, bounded records, plain messages and no render/history/authored mutations PASS');
