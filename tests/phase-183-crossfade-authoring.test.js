'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const start=source.indexOf('function changeSkeletalInstanceBlend(');let i=source.indexOf('{',start)+1,n=1;while(n){if(source[i]==='{')n++;if(source[i]==='}')n--;i++;}
const entity={skin:{clips:[]},animationBlendTime:0},item={kind:'cube',entity};let history=0;
const c={selectedItem:item,placed:[item],playMode:false,pushUndo:()=>history++};vm.createContext(c);vm.runInContext(source.slice(start,i),c);
for(const value of [0,-1,11,Infinity,NaN,'0.5',null,true])assert.equal(c.changeSkeletalInstanceBlend(item,value),false);
assert.equal(history,0);assert.equal(c.changeSkeletalInstanceBlend(item,.5),true);assert.equal(history,1);assert.equal(entity.animationBlendTime,.5);assert.equal(c.changeSkeletalInstanceBlend(item,.5),false);
c.playMode=true;assert.equal(c.changeSkeletalInstanceBlend(item,0),false);c.playMode=false;c.selectedItem={};assert.equal(c.changeSkeletalInstanceBlend(item,0),false);c.selectedItem=item;c.placed=[];assert.equal(c.changeSkeletalInstanceBlend(item,0),false);assert.equal(history,1);
console.log('PASS183 actual crossfade owner helper finite/zero/bounds/no-op/Play/stale/history; portable native gates remain');
