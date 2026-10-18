'use strict';
// Reuse ordinary, editable grouped meshes and measured legacy boxes. No new
// physics system. Keep the original anchor/ID, geometry, openings and all art.
const crypto=require('crypto'),{components}=require('./real-demo-masonry-assembly');
const keys=new Set(['doorway-frame','ruin-wall-window','corner-wall','ruin-wall','ruin-wall-tall','arch','arch-broken','arch-pointed','railing','rope-fence','stone-walkway']);
function architecturalParts(asset,key){
 const parts=components(asset),split=(part,groups)=>groups.flatMap(indices=>components({...asset,indices}));
 const triangles=part=>part.mesh.indices.map(i=>part.sourceIndices[i]);
 const merge=list=>{const indices=list.flatMap(triangles),sourceIndices=[...new Set(indices)],map=new Map(sourceIndices.map((v,i)=>[v,i])),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const v of sourceIndices)for(let a=0;a<3;a++){min[a]=Math.min(min[a],asset.positions[v*3+a]);max[a]=Math.max(max[a],asset.positions[v*3+a]);}return {center:min.map((v,a)=>(max[a]+v)/2),size:min.map((v,a)=>max[a]-v),sourceIndices,mesh:{...list[0].mesh,indices:indices.map(i=>map.get(i)),uvs:sourceIndices.flatMap(v=>asset.uvs.slice(v*2,v*2+2))}};};
 if(key==='arch'){
  if(parts.length!==11||parts[10].mesh.indices.length!==324)throw new Error('Changed round arch needs geometry review');
  const indices=triangles(parts[10]);return [merge(parts.slice(0,5)),merge(parts.slice(5,10)),...split(parts[10],Array.from({length:9},(_,n)=>indices.slice(n*36,(n+1)*36)))];
 }
 if(key==='arch-broken'){if(parts.length!==11)throw new Error('Changed broken arch needs review');return [merge(parts.slice(0,4)),merge(parts.slice(4,6)),...parts.slice(6)];}
 if(key==='rope-fence'){
  if(parts.length!==4||parts[3].mesh.indices.length!==720)throw new Error('Changed rope fence needs physical geometry review');
  const indices=triangles(parts[3]);return [...parts.slice(0,3),...split(parts[3],Array.from({length:12},(_,n)=>indices.slice(n*60,(n+1)*60)))];
 }
 if(key==='arch-pointed'){
  if(parts.length!==2||parts[0].mesh.indices.length!==312||parts[1].mesh.indices.length!==336)throw new Error('Changed pointed arch needs geometry review');
  const indices=triangles(parts[0]),bands=[];
  for(let side=0;side<2;side++)for(const [lo,hi]of [[0,2.2],[2.2,3.15],[3.15,3.8]]){const group=[];for(let i=side*156;i<(side+1)*156;i+=3){const tri=indices.slice(i,i+3),ys=tri.map(v=>asset.positions[v*3+1]);if(Math.min(...ys)>=lo&&Math.max(...ys)<=hi&&!(lo>0&&Math.max(...ys)===lo))group.push(...tri);}bands.push(group);}
  // The ornamental horizontal wood ring remains one passable trim mesh.
  // Structural loft bands provide the arch; do not create fourteen extra
  // blocking pieces or fill the ring's empty centre with a whole box.
  return [...split(parts[0],bands),parts[1]];
 }return parts;
}
function referenced(value,id){if(!value||typeof value!=='object')return value===id;return Object.entries(value).some(([k,v])=>k!=='id'&&referenced(v,id));}
function repair(project){
 const assets=new Map(project.assets.map(a=>[a.id,a])),changes=[],skipped=[];
 for(const level of project.levels){const additions=[],ids=new Set(level.objects.map(o=>o.id)),levelMeta={...level};delete levelMeta.objects;
  for(const object of level.objects){const key=(object.assetId||'').replace(/^showcase-/,'');if(!keys.has(key)||object.solid===true)continue;
   if(object.kind!=='cube'||object.collider||object.parentId||object.quaternion||object.spin||object.ai||object.patrol||object.behaviors?.length||object.animationClips?.length||level.objects.some(o=>o!==object&&referenced(o,object.id))||referenced(levelMeta,object.id)||referenced(project.prefabs,object.id)){skipped.push({id:object.id,reason:'AUTHORED_DYNAMIC_OR_REFERENCED_RECORD_PRESERVED'});continue;}
   const asset=assets.get(object.assetId),canonical=require('./showcase-assets').getMesh(key);
   if(!asset||['positions','normals','uvs','indices'].some(k=>JSON.stringify(asset[k])!==JSON.stringify(canonical[k]))){skipped.push({id:object.id,reason:'MODIFIED_OR_MISSING_SOURCE_ASSET_PRESERVED'});continue;}
   const parts=architecturalParts(asset,key),original=JSON.parse(JSON.stringify(object)),scale=object.scale||[1,1,1],yaw=object.rotationY||0,c=Math.cos(yaw),s=Math.sin(yaw);
   if(parts.length!=={'doorway-frame':6,'ruin-wall-window':12,'corner-wall':6,'ruin-wall':15,'ruin-wall-tall':15,'arch':11,'arch-broken':7,'arch-pointed':7,'railing':7,'rope-fence':15,'stone-walkway':16}[key]||scale.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Changed/invalid architectural assembly requires review');
   const group=object.groupId||'collision-architecture-'+crypto.createHash('sha256').update(level.id+':'+object.id).digest('hex').slice(0,12);
   parts.forEach((part,n)=>{
    // Preserve source coordinates and original anchor rather than shifting a
    // referenced pivot to a stone centre. Every world triangle stays identical.
    const mesh={...part.mesh,id:asset.id+'-architecture-section-'+n,name:(asset.name||key)+' / section '+(n+1),positions:part.sourceIndices.flatMap(v=>asset.positions.slice(v*3,v*3+3)),normals:part.sourceIndices.flatMap(v=>asset.normals.slice(v*3,v*3+3)),bounds:{min:part.center.map((v,a)=>v-part.size[a]/2),max:part.center.map((v,a)=>v+part.size[a]/2)}};
    mesh.provenance={source:'tools/real-demo-architectural-assemblies.js; exact source triangles from tools/showcase-assets.js '+key,license:'MIT',documentation:'SHOWCASE-ASSET-LICENSES.md'};
    const existing=project.assets.find(a=>a.id===mesh.id);if(existing&&JSON.stringify(existing)!==JSON.stringify(mesh))throw new Error('Preserve modified derived architecture asset');if(!existing)project.assets.push(mesh);
    const id=n?object.id+'-section-'+n:object.id;if(n&&ids.has(id))throw new Error('Architectural section ID collision');ids.add(id);
    const offset=part.center.map((v,a)=>v*scale[a]),size=part.size.map((v,a)=>v*scale[a]);
    // The window's gold ring is decorative trim, not a filled disk. Likewise
    // moss and thin accent strips are not blocking structural wall sections.
    const cosmetic=key==='ruin-wall-window'&&n===parts.length-1||key==='ruin-wall'&&n>=12||key==='ruin-wall-tall'&&n===parts.length-1||key==='corner-wall'&&n>=2||key==='doorway-frame'&&n>=3||key==='arch-pointed'&&n===parts.length-1;
    const record={...original,id,assetId:mesh.id,name:(original.name||key)+' / '+(cosmetic?'trim':'solid section')+' '+(n+1),groupId:group,solid:!cosmetic};
    if(!cosmetic)record.collider={shape:'box',size:{x:size[0],y:size[1],z:size[2]},offset:{x:offset[0]*c+offset[2]*s,y:offset[1],z:-offset[0]*s+offset[2]*c}};else delete record.collider;
    if(n)additions.push(record);else Object.assign(object,record);
   });changes.push({level:level.id,id:original.id,original,parts:parts.length,groupId:group,anchorPreserved:true});
  }level.objects.push(...additions);
 }return {changes,skipped};
}
module.exports={repair,keys,architecturalParts};
