'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function node(){return {style:{},children:[],textContent:'',append(n){this.children.push(n);},replaceChildren(){this.children=[];},setAttribute(){}};}
const host=node(),config={hudElements:[{id:'guide',text:'<private text>',offsetX:4096}]},level={id:'level'},levels=[level];
let focused=0,scrolled=0,selected=0;
const row={dataset:{hudId:'guide'},scrollIntoView(){scrolled++;},querySelector(){return {focus(){focused++;}};}};
const context={document:{getElementById:()=>host,createElement:node,querySelectorAll:()=>[row]},currentUiConfig:config,levels,currentLevelIndex:0,playMode:false,hudAuthoringCanvas:{inspectReadability:()=>({available:true,viewport:{width:390,height:844},issues:[{id:'guide',message:'<private advisory>'}]}),setSelection(){selected++;}}};
vm.createContext(context);vm.runInContext(source.match(/function inspectHudPreviewReadability\([^]*?\n\}/)[0],context);
const snapshot=JSON.stringify(config),check=()=>context.inspectHudPreviewReadability(),button=()=>host.children.find(n=>n.children.length)?.children[0];
check();assert(host.children.every(n=>n.style.overflowWrap==='anywhere'),'Authored long labels must wrap inside the diagnostic panel itself');
check();assert(host.children[0].textContent.includes('390 × 844'));assert(host.children.some(n=>n.textContent==='<private text> [guide]: <private advisory>'));assert(host.children.some(n=>n.textContent.includes('contrast are not verified')));button().onclick();assert.equal(focused,1);assert.equal(scrolled,1);assert.equal(selected,1);assert.equal(JSON.stringify(config),snapshot);
const old=button();config.hudElements[0].offsetX=0;old.onclick();assert.equal(focused,1);assert(host.children.at(-1).textContent.includes('stale'));
check();const beforePlay=button();context.playMode=true;beforePlay.onclick();assert.equal(focused,1);check();assert.equal(host.children.length,1);assert(host.children[0].textContent.includes('Stop Play'));
context.playMode=false;check();const beforeProject=button();context.levels=[{id:'level'}];beforeProject.onclick();assert.equal(focused,1);
context.levels=levels;context.hudAuthoringCanvas.inspectReadability=()=>({available:false});check();assert(host.children[0].textContent.includes('unavailable'));
context.hudAuthoringCanvas.inspectReadability=()=>({available:true,viewport:{width:1280,height:720},issues:[]});check();assert(host.children.at(-1).textContent.includes('does not prove readability'));
context.hudAuthoringCanvas.inspectReadability=()=>({available:true,viewport:{width:1280,height:720},issues:Array.from({length:100},()=>({id:'guide',message:'Advisory'}))});check();assert.equal(host.children.filter(n=>n.children.length).length,30);assert(host.children.at(-1).textContent.includes('70 more'));
console.log('Phase218 mounted actual readability UI: bounded advisory/plain text, no mutation, ordinary owner navigation, stale/Play/project/unavailable/empty guards PASS');
