'use strict';
const assert=require('assert');
const p=require('../editor/src/00-authoring-plumbing.js');
const seeds=[35,1035,2035,3035,4035,5035,6035,7035,8035,9035];
const operationsPerSeed=5000,batchSize=50;
function rng(seed){let state=seed>>>0;return()=>((state=Math.imul(1664525,state)+1013904223>>>0)/4294967296);}
function tileset(mode){const tiles=Array.from({length:64},(_,i)=>({id:`t${i}`,name:`Tile ${i}`,spriteAssetRef:null,collision:{mode:'none'}}));const masks=p.canonicalAutoTileMasks(mode);return p.createTileset({id:'tiles',name:'Fuzz Tiles',tiles,autoTileSets:[{id:'a',name:'A',neighborMode:mode,defaultTileId:'t0',rules:masks.map((mask,i)=>({mask,tileId:`t${i%64}`}))},{id:'b',name:'B',neighborMode:mode,defaultTileId:'t63',rules:masks.map((mask,i)=>({mask,tileId:`t${63-(i%64)}`}))}]});}
function snapshot(map){return JSON.stringify(p.serializeTilemapLayers(map));}
let operations=0,comparisons=0;
for(const seed of seeds){const random=rng(seed),mode=seed%2?'four-way':'eight-way',ts=tileset(mode);let map=p.createTilemapRecord({id:`map-${seed}`,name:'Fuzz',tilesetRef:'tiles'});const layer=map.layers[0].id;const recent=[];
  for(let op=0;op<operationsPerSeed;op++){const x=Math.floor(random()*31)-15,y=Math.floor(random()*31)-15,choice=Math.floor(random()*8);recent.push({op,choice,x,y});if(recent.length>12)recent.shift();
    if(choice===0)p.paintAutoTileCell(map,layer,x,y,ts,'a');
    else if(choice===1)p.paintAutoTileCell(map,layer,x,y,ts,'b');
    else if(choice===2)p.paintManualTileCell(map,layer,x,y,`t${Math.floor(random()*64)}`,ts);
    else if(choice===3)p.eraseAutoTileCell(map,layer,x,y,ts);
    else if(choice===4){const cell=p.getTilemapCell(map,layer,x,y);p.paintAutoTileCell(map,layer,x,y,ts,cell&&cell.autoTileSetId||'a');}
    else if(choice===5){const cell=p.getTilemapCell(map,layer,x,y);p.paintAutoTileCell(map,layer,x,y,ts,cell&&cell.autoTileSetId==='a'?'b':'a');}
    else if(choice===6&&op%17===0){const set=ts.autoTileSets[Math.floor(random()*2)],masks=p.canonicalAutoTileMasks(mode),mask=masks[Math.floor(random()*masks.length)];p.setAutoTileRule(set,mask,`t${Math.floor(random()*64)}`);p.recomputeAutoTilemap(map,ts,set.id);}
    else if(choice===7&&op%23===0){map=p.createTilemapRecord(JSON.parse(JSON.stringify(map)));p.recomputeAutoTilemap(map,ts);}
    operations++;
    if((op+1)%batchSize===0){const reference=p.createTilemapRecord(JSON.parse(JSON.stringify(map)));p.recomputeAutoTilemap(reference,ts);try{assert.strictEqual(snapshot(map),snapshot(reference));}catch(error){console.error(JSON.stringify({seed,mode,op,recent,actual:snapshot(map),expected:snapshot(reference)},null,2));throw error;}comparisons++;}
  }
}
console.log(JSON.stringify({phase:35,seeds,operationsPerSeed,operations,comparisons,modes:['four-way','eight-way'],result:'PASS_INCREMENTAL_EQUALS_FULL_REFERENCE'}));
