'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name,e.stack);}}
function fixture(key='range',play=false){
  const attrs={},control={id:'light-test',value:'4',checked:true,style:{},setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k],closest:()=>({appendChild:node=>control.feedback=node}),insertAdjacentElement:(where,node)=>control.feedback=node};
  const c={document:{createElement:()=>({style:{},setAttribute(){}})},playMode:play,undo:0,placed:[],syncLightConeViz(){},pushUndo(){c.undo++;},rgbToHex:()=> '#ffffff',hexToRgb:()=>[1,1,1]};
  c.item={kind:'light',entity:{position:{x:1,y:2,z:3}},options:{range:4,intensity:2,angle:.4,direction:{x:0,y:-1,z:0}},lightHandle:{direction:{set(x,y,z){this.x=x;this.y=y;this.z=z;}}}};c.placed.push(c.item);
  vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function changeLightAuthoringField('),source.indexOf('function renderInspectorBody(')),c);c.bindLightAuthoringField(control,c.item,key,'number');return {c,control,attrs};
}
test('Rejected range explains error, preserves model/history and restores canonical value on blur',()=>{const {c,control,attrs}=fixture();control.value='0';control.oninput();assert.equal(c.item.options.range,4);assert.equal(c.undo,0);assert.equal(attrs['aria-invalid'],'true');assert.match(control.feedback.textContent,/greater than zero/);control.onblur();assert.equal(control.value,'4');assert.equal(attrs['aria-invalid'],'false');assert.match(control.feedback.textContent,/not saved/);});
test('Literal intensity zero and continuous valid edits preserve one history capture; no-op focus captures none',()=>{const {c,control}=fixture('intensity');control.value='2';control.oninput();control.onblur();assert.equal(c.undo,0);control.value='0';control.oninput();control.value='1';control.oninput();control.onchange();assert.equal(c.undo,1);assert.equal(c.item.options.intensity,1);control.onblur();control.value='3';control.oninput();assert.equal(c.undo,2);});
test('Fractional cone degrees remain exact, invalid endpoint and zero direction recover',()=>{const {c,control}=fixture('angle');control.value='12.5';control.oninput();assert.equal(c.item.options.angle,12.5*Math.PI/180);control.value='90';control.oninput();assert.match(control.feedback.textContent,/less than 90/);control.onblur();assert(Math.abs(Number(control.value)-12.5)<1e-12);const d=fixture('direction.y');d.control.value='0';d.control.oninput();assert.equal(d.c.item.options.direction.y,-1);assert.equal(d.c.undo,0);assert.match(d.control.feedback.textContent,/non-zero/);});
test('Play disables mounted fields and guards a stale callback without history',()=>{const {c,control}=fixture('range',true);assert.equal(control.disabled,true);control.value='8';control.oninput();assert.equal(c.item.options.range,4);assert.equal(c.undo,0);assert.match(control.feedback.textContent,/Stop Play/);});
console.log(JSON.stringify({pass,fail}));if(fail)process.exitCode=1;
