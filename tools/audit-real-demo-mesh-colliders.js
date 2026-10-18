'use strict';
// Qualification-only geometry inventory. Never changes project content.
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'games/catalog.json'))).games.filter(g=>g.visibility==='public');
const report={observedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),method:'Compare measured static asset vertex bounds against historical scale/2 collision box; inventory is not gameplay acceptance.',games:[]};
for(const game of catalog){
  const project=JSON.parse(fs.readFileSync(path.join(root,'games',game.file))),assets=new Map((project.assets||[]).map(a=>[a.id,a]));
  const row={id:game.id,solidAssetObjects:0,mismatches:[]};report.games.push(row);
  for(const level of project.levels)for(const item of level.objects){
    if(!item.solid||item.kind!=='cube'||!item.assetId)continue;
    row.solidAssetObjects++;const asset=assets.get(item.assetId);if(!asset?.positions?.length)continue;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<asset.positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],asset.positions[i]);max[axis]=Math.max(max[axis],asset.positions[i]);}
    const scale=item.scale||[1,1,1],size=min.map((v,i)=>(max[i]-v)*Math.abs(scale[i])),center=min.map((v,i)=>(max[i]+v)*scale[i]/2);
    const differs=min.some((v,i)=>Math.abs(v+.5)>.05||Math.abs(max[i]-.5)>.05);
    if(differs)row.mismatches.push({level:level.id,object:item.id,name:item.name||null,asset:item.assetId,
      meshLocalBounds:{min,max},historicalBoxSize:scale,measuredSize:size,measuredLocalScaledCenter:center,
      explicitCollider:item.collider||null,rotationY:item.rotationY||0,quaternion:item.quaternion||null,parentId:item.parentId||null,
      likelyBlockingRole:/wall|gate|cover|barrier|barricade|pillar|blocker|obstacle/i.test(item.name||''),
      status:item.collider?'EXPLICIT_SHAPE_REQUIRES_ALIGNMENT_REVIEW':'DEFAULT_BOX_DOES_NOT_MATCH_ASSET_BOUNDS'});
  }
}
report.summary={games:report.games.length,gamesWithMismatches:report.games.filter(g=>g.mismatches.length).length,
  mismatchedObjects:report.games.reduce((n,g)=>n+g.mismatches.length,0),blockingRoleMismatches:report.games.flatMap(g=>g.mismatches).filter(o=>o.likelyBlockingRole).length};
const out=path.join(root,'qualification/real-demo-collision','mesh-collider-inventory.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
