'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('editor/src/01-editor.js','utf8'),context={};vm.createContext(context);
for(const name of ['createUnusedAssetPreview','hasUncertainAssetPreviewContent']){
  const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);assert(start>=0);vm.runInContext(source.slice(start,end),context);
}
const rows=[{bucket:'audioAssets',id:'voice',name:'<img>'},{bucket:'textureAssets',id:'free',name:'Free'},{bucket:'tilemapChunks',id:'recipe',name:'Recipe'},{bucket:'audioAssets',id:'lost',missing:true}],edges=[{bucket:'audioAssets',id:'voice',owner:{prefabName:'Reusable',label:'Prefab Reusable'}}];
const before=JSON.stringify({rows,edges}),preview=context.createUnusedAssetPreview(rows,edges);
assert.equal(preview[0].status,'known-reference');assert.equal(preview[1].status,'candidate');assert.match(preview[1].reason,/not proven safe to delete/);assert.equal(preview[2].status,'uncertain');assert.equal(preview[3].status,'uncertain');assert.equal(JSON.stringify({rows,edges}),before);
for(const flag of ['truncated','unknownContent','reusableRecipes'])assert.equal(context.createUnusedAssetPreview(rows,edges,{[flag]:true})[1].status,'uncertain');
assert.equal(context.createUnusedAssetPreview([rows[0],rows[0]],edges)[0].status,'uncertain');
assert.equal(context.createUnusedAssetPreview([rows[1]],[{bucket:'textureAssets',id:'free',owner:{retainedOnly:true}}])[0].status,'uncertain');
preview[0].name='changed';assert.equal(rows[0].name,'<img>');
assert(context.hasUncertainAssetPreviewContent([{behaviors:[{action:'script',param:'dynamic'}]}]));
assert(context.hasUncertainAssetPreviewContent([{nested:{type:'script'}}]));
assert(context.hasUncertainAssetPreviewContent([{}],1));const cycle={};cycle.self=cycle;assert(context.hasUncertainAssetPreviewContent(cycle));
assert.equal(context.hasUncertainAssetPreviewContent([{objects:[]}]),false);
const html=fs.readFileSync('editor/index.html','utf8');assert(html.includes('id="asset-unused-preview"'));assert(html.includes('Unused asset cleanup preview (read-only)'));
assert(html.includes('id="asset-unused-status"'));assert(html.includes('id="asset-unused-filter"'));assert(source.includes('previewRows.push(...rows.filter(row=>row.missing))'));
const scale=Array.from({length:4096},(_,i)=>({bucket:'audioAssets',id:'a'+i,name:'Audio '+i})),scaleEdges=scale.map(row=>({bucket:row.bucket,id:row.id,owner:{levelId:'other-level'}})),scaleBefore=JSON.stringify(scale);
const started=Date.now(),large=context.createUnusedAssetPreview(scale,scaleEdges);assert.equal(large.length,4096);assert(large.every(row=>row.status==='known-reference'));assert.equal(JSON.stringify(scale),scaleBefore);assert(Date.now()-started<2000,'4096-row detached projection should stay bounded and useful');
console.log('Phase199 actual pure preview typed identity/known-reference/candidate/uncertainty/retained-only/Chunk/Script/bounds/detachment PASS');
let seed=199;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
for(let run=0;run<200;run++){
  const records=Array.from({length:32},(_,i)=>({bucket:i%4===0?'tilemapChunks':'audioAssets',id:'id'+(random()%28),name:'Literal <'+i+'>',missing:random()%17===0}));
  const links=records.filter(()=>random()%3===0).map(row=>({bucket:row.bucket,id:row.id,owner:{retainedOnly:random()%2===0}}));
  const flags={unknownContent:random()%5===0,truncated:random()%7===0,reusableRecipes:random()%3===0},saved=JSON.stringify({records,links,flags});
  const result=context.createUnusedAssetPreview(records,links,flags);
  for(let i=0;i<records.length;i++){const row=records[i],matching=links.filter(e=>e.bucket===row.bucket&&e.id===row.id),duplicates=records.filter(e=>e.bucket===row.bucket&&e.id===row.id).length;
    const expected=row.missing||duplicates>1||row.bucket==='tilemapChunks'?'uncertain':matching.some(e=>!e.owner.retainedOnly)?'known-reference':matching.length||Object.values(flags).some(Boolean)?'uncertain':'candidate';assert.equal(result[i].status,expected);
  }assert.equal(JSON.stringify({records,links,flags}),saved);
}
console.log('Phase199 seeded200cases typed duplicate/missing/recipe/retained-only oracle and exact input preservation PASS');
