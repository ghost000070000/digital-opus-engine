'use strict';
// Content repair using existing mesh assets, ordinary solids and no-code groups.
// Separate disconnected stones rather than fill the broken wall's silhouette.
const crypto=require('crypto');
function components(asset){
  const p=asset.positions,indices=asset.indices||Array.from({length:p.length/3},(_,i)=>i);
  const parent=[],coordinate=new Map(),vertices=[];
  function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  const unite=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  for(let i=0;i<p.length/3;i++){
    const key=p.slice(i*3,i*3+3).join(',');let n=coordinate.get(key);
    if(n===undefined){n=parent.length;coordinate.set(key,n);parent.push(n);}vertices.push(n);
  }
  for(let i=0;i<indices.length;i+=3){unite(vertices[indices[i]],vertices[indices[i+1]]);unite(vertices[indices[i]],vertices[indices[i+2]]);}
  const groups=new Map();for(let i=0;i<indices.length;i+=3){const key=find(vertices[indices[i]]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(...indices.slice(i,i+3));}
  return [...groups.values()].map((triangles,part)=>{
    const source=[...new Set(triangles)],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const i of source)for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[i*3+a]);max[a]=Math.max(max[a],p[i*3+a]);}
    const size=min.map((v,a)=>max[a]-v),center=min.map((v,a)=>(max[a]+v)/2);
    if(size.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Review flat or invalid masonry component');
    const map=new Map(source.map((v,i)=>[v,i])),positions=[],normals=[],uvs=[];
    for(const i of source){
      for(let a=0;a<3;a++)positions.push((p[i*3+a]-center[a])/size[a]);
      const normal=size.map((v,a)=>(asset.normals?.[i*3+a]||0)*v),length=Math.hypot(...normal)||1;normals.push(...normal.map(v=>v/length));
      uvs.push(...(asset.uvs?.slice(i*2,i*2+2)||[0,0]));
    }
    const mesh={...asset,id:asset.id+'-collision-part-'+part,name:(asset.name||'Masonry')+' / stone '+(part+1),positions,normals,uvs,indices:triangles.map(i=>map.get(i)),bounds:{min:[-.5,-.5,-.5],max:[.5,.5,.5]},tags:[...(asset.tags||[]),'collision-recovery-part']};
    mesh.provenance={source:'tools/real-demo-masonry-assembly.js; exact disconnected triangles derived from tools/showcase-assets.js broken-wall',license:'MIT',documentation:'SHOWCASE-ASSET-LICENSES.md'};
    delete mesh.joints;delete mesh.weights;delete mesh.skin;
    return {mesh,center,size,sourceIndices:source};
  });
}
function repair(project){
  const originalAssets=new Map(project.assets.map(a=>[a.id,a])),changes=[],skipped=[],provenanceUpdates=[];
  const source=originalAssets.get('showcase-broken-wall');
  if(source)for(const part of components(source)){
    const existing=originalAssets.get(part.mesh.id);if(!existing||JSON.stringify(existing.provenance)===JSON.stringify(part.mesh.provenance))continue;
    if(['positions','normals','uvs','indices'].some(k=>JSON.stringify(existing[k])!==JSON.stringify(part.mesh[k])))throw new Error('Preserve modified derived masonry asset; source attribution requires review');
    existing.provenance=part.mesh.provenance;provenanceUpdates.push(existing.id);
  }
  for(const level of project.levels){const additions=[],ids=new Set(level.objects.map(o=>o.id));
    for(const object of level.objects){
      if(object.assetId!=='showcase-broken-wall'||object.solid===true)continue;
      if(object.kind!=='cube'||object.collider||object.parentId||object.quaternion||object.spin||object.ai||object.patrol||object.behaviors?.length||object.animationClips?.length){skipped.push({id:object.id,reason:'AUTHORED_OR_DYNAMIC_RECORD_PRESERVED'});continue;}
      const original=JSON.parse(JSON.stringify(object)),parts=components(originalAssets.get(object.assetId));
      if(parts.length<2||parts.length>24)throw new Error('Masonry partition requires bounded disconnected stones');
      const scale=object.scale||[1,1,1],yaw=object.rotationY||0,c=Math.cos(yaw),s=Math.sin(yaw);
      if(scale.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Review nonpositive masonry scale');
      const group=object.groupId||'collision-masonry-'+crypto.createHash('sha256').update(level.id+':'+object.id).digest('hex').slice(0,12);
      parts.forEach((part,n)=>{
        if(!project.assets.some(a=>a.id===part.mesh.id))project.assets.push(part.mesh);
        const offset=part.center.map((v,a)=>v*scale[a]),id=n?object.id+'-stone-'+n:object.id;
        if(n&&ids.has(id))throw new Error('Masonry part ID collision');ids.add(id);
        const record={...original,id,assetId:part.mesh.id,name:(original.name||'Broken masonry')+' / stone '+(n+1),groupId:group,
          position:[original.position[0]+offset[0]*c+offset[2]*s,original.position[1]+offset[1],original.position[2]-offset[0]*s+offset[2]*c],
          scale:part.size.map((v,a)=>v*scale[a]),solid:true};
        delete record.collider;
        if(n)additions.push(record);else Object.assign(object,record);
      });
      changes.push({level:level.id,id:original.id,original,parts:parts.length,groupId:group});
    }level.objects.push(...additions);
  }return {changes,skipped,provenanceUpdates};
}
module.exports={components,repair};
