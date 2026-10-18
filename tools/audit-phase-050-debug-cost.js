'use strict';
// Structural bounds are hard gates; timings are observations, not portable FPS claims.
const fs=require('fs'),path=require('path'),assert=require('assert'),{performance}=require('perf_hooks');
const debug=require('../editor/src/00-physics-debug-2d'),collider=require('../editor/src/00-collider-2d');
let traversals=0;const sparse={*[Symbol.iterator](){for(let i=0;i<10000;i++){traversals++;yield {id:'empty-'+i};}}};
let start=performance.now();for(let i=0;i<100000;i++)debug.snapshot(sparse);const disabledMs=performance.now()-start;assert.strictEqual(traversals,0);
const dense=Array.from({length:10000},(_,i)=>({id:'shape-'+i,kind:'cube',entity:{position:{x:i,y:0,z:0}},worldMatrix:collider.composeMatrix({position:[i,0,0]}),components:{'box-collider-2d':{version:1,enabled:true,size:[1,1],offset:[0,0]}}}));
start=performance.now();for(let i=0;i<100;i++){const proof=debug.snapshot(dense,{enabled:true});assert.strictEqual(proof.shapes.length,128);assert(proof.truncated);assert(proof.scanned<=128);}const denseMs=performance.now()-start;
start=performance.now();for(let i=0;i<100;i++){const proof=debug.snapshot(sparse,{enabled:true});assert.strictEqual(proof.scanned,1024);assert(proof.truncated);}const sparseMs=performance.now()-start;
assert(traversals<=1025*100);
const result={status:'DEBUG_STRUCTURAL_COST_BOUNDS_PASS',observedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),objects:10000,disabledCalls:100000,disabledTraversals:0,disabledMs,denseCalls:100,denseMs,sparseCalls:100,sparseMs,maxShapes:128,maxScanned:1024,note:'No Tile cell traversal, no solver tick, no portable FPS or forced-GC claim. UI updates at most10Hz.'};
const out=path.resolve(__dirname,'../qualification/phase-050/debug-cost.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
