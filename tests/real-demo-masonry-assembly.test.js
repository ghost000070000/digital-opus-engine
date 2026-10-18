'use strict';
const assert=require('assert'),{components,repair}=require('../tools/real-demo-masonry-assembly');
const asset=require('../tools/showcase-assets').getMesh('broken-wall');
const parts=components(asset);assert.strictEqual(parts.length,10,'eight separate stones and two rubble pieces, not a filled wall box');
assert.strictEqual(parts.reduce((n,p)=>n+p.mesh.indices.length,0),asset.indices.length,'all original triangles retained');
for(const p of parts)for(let n=0;n<p.sourceIndices.length;n++)for(let a=0;a<3;a++){
  const rebuilt=p.mesh.positions[n*3+a]*p.size[a]+p.center[a];
  assert(Math.abs(rebuilt-asset.positions[p.sourceIndices[n]*3+a])<1e-9,'component vertex reconstruction exact');
}
for(const yaw of [0,.4,Math.PI/2]){
  const original={kind:'cube',id:'wall',assetId:asset.id,name:'Ruined masonry',position:[3,-.2,8],scale:[.9,1.2,.7],rotationY:yaw,solid:false,behaviors:[]};
  const project={assets:[asset],levels:[{id:'scene',objects:[structuredClone(original)]}]},result=repair(project),objects=project.levels[0].objects;
  assert.strictEqual(result.changes.length,1);assert.strictEqual(objects.length,10);assert(objects.every(o=>o.solid&&o.groupId===objects[0].groupId));
  assert.strictEqual(objects[0].id,'wall','existing object identity retained');
  for(let n=0;n<parts.length;n++){
    const part=parts[n],object=objects[n],mesh=project.assets.find(a=>a.id===object.assetId),c=Math.cos(yaw),s=Math.sin(yaw);
    for(let v=0;v<part.sourceIndices.length;v++){
      const before=asset.positions.slice(part.sourceIndices[v]*3,part.sourceIndices[v]*3+3).map((x,a)=>x*original.scale[a]);
      const after=mesh.positions.slice(v*3,v*3+3).map((x,a)=>x*object.scale[a]);
      const expected=[original.position[0]+before[0]*c+before[2]*s,original.position[1]+before[1],original.position[2]-before[0]*s+before[2]*c];
      const actual=[object.position[0]+after[0]*c+after[2]*s,object.position[1]+after[1],object.position[2]-after[0]*s+after[2]*c];
      assert(actual.every((x,a)=>Math.abs(x-expected[a])<1e-8),'rendered world geometry unchanged by grouped composition');
    }
  }
  assert.strictEqual(repair(project).changes.length,0,'migration idempotent');
}
const protectedProject={assets:[asset],levels:[{id:'scene',objects:[{kind:'cube',id:'custom',assetId:asset.id,solid:false,collider:{shape:'sphere',radius:3}}]}]};
assert.strictEqual(repair(protectedProject).skipped.length,1,'authored custom collision preserved');
console.log('Real-demo masonry assembly: exact triangle/world-geometry preservation, grouped solids, idempotence and custom-record protection PASS');
