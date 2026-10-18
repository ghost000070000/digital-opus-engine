'use strict';
const assert=require('assert'),{orthogonalCorner}=require('../tools/real-demo-evidence');
const event=(time,target,x,z,solid=true)=>({time,target,solid,requested:{x:0,z:0},result:{x,z}});
const captured=[0,1,2].flatMap(t=>[event(t,'post',.007,0),event(t,'arch',0,-.004)]);
assert.strictEqual(orthogonalCorner(captured,'post',['post','arch']).simultaneousFrames,3);
assert.strictEqual(orthogonalCorner(captured,'post',['post']),null);
assert.strictEqual(orthogonalCorner(captured.map(e=>({...e,solid:false})),'post',['post','arch']),null);
assert.strictEqual(orthogonalCorner(captured.slice(0,4),'post',['post','arch']),null);
assert.strictEqual(orthogonalCorner(captured.map(e=>e.target==='arch'?{...e,time:e.time+.1}:e),'post',['post','arch']),null);
assert.strictEqual(orthogonalCorner(captured.map(e=>e.target==='arch'?{...e,result:{x:.004,z:0}}:e),'post',['post','arch']),null);
// Execute the exact read-only predicate injected into real browsers, rather
// than a copied implementation. Captured Signal Zero l2-ground has topY=0.
const source=require('fs').readFileSync(require('path').join(__dirname,'../tools/real-demo-browser-probe.js'),'utf8');
const match=source.match(/function observedAiFootInsideBox\([^]*?\n    \}/);
assert(match,'Actual browser AI-foot predicate must remain testable');
const footInside=require('vm').runInNewContext('('+match[0]+')');
assert.strictEqual(footInside(0,-.5,.5),false,'captured ground-top crossing is supporting passage');
assert.strictEqual(footInside(-.01,-.5,.5),true,'real slab-volume entry is still rejected');
assert.strictEqual(footInside(0,1,1),true,'ground-level wall lower plane remains eligible');
assert.strictEqual(footInside(2.01,1,1),false,'above the wall is not volume entry');
console.log('real-demo-evidence: orthogonal corner/five rejection and four exact-browser AI support boundary regressions PASS');
