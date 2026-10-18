'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-032');
const actionsPerSeed = Number(process.argv[2]) || 100000;
function rng(seed){let x=seed|0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
const report={phase:32,kind:'deterministic-tilemap-fuzz',seeds:[],actionsPerSeed,totalActions:0,ok:false};
for(let seed=1;seed<=10;seed++){
  const random=rng(seed); const map=plumbing.createTilemapRecord({id:`fuzz-${seed}`,name:'Fuzz',tilesetRef:'ts'}); const reference=new Map(); const started=Date.now();
  for(let i=0;i<actionsPerSeed;i++){
    const x=Math.floor(random()*2048)-1024, y=Math.floor(random()*2048)-1024, key=`${x},${y}`;
    if(random()<0.72){const tileId=`tile-${Math.floor(random()*17)}`;plumbing.setTilemapCell(map,x,y,tileId);reference.set(key,tileId);}
    else{plumbing.eraseTilemapCell(map,x,y);reference.delete(key);}
    if((i&8191)===0){const probe=plumbing.getTilemapCell(map,x,y);assert.strictEqual(probe&&probe.tileId,reference.get(key));}
  }
  const serialized=plumbing.serializeTilemapCells(map); assert.strictEqual(serialized.length,reference.size);
  for(const cell of serialized)assert.strictEqual(reference.get(`${cell.x},${cell.y}`),cell.tileId);
  const json=JSON.stringify(serialized); assert.strictEqual(JSON.stringify(plumbing.canonicalizeTilemapCells(JSON.parse(json))),json);
  report.seeds.push({seed,actions:actionsPerSeed,occupied:serialized.length,serializedBytes:Buffer.byteLength(json),durationMs:Date.now()-started,shaLike:`${serialized.length}:${json.length}:${json.charCodeAt(Math.floor(json.length/2)||0)||0}`}); report.totalActions+=actionsPerSeed;
}
report.ok=true; report.verdict='PASS'; fs.mkdirSync(QUAL,{recursive:true}); fs.writeFileSync(path.join(QUAL,'phase-032-fuzz.json'),`${JSON.stringify(report,null,2)}\n`); console.log(`Phase 032 fuzz passed: ${report.totalActions} actions across ${report.seeds.length} seeds`);
