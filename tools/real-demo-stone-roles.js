'use strict';
// Physical land stones, not underwater scenery or scripted collectible props.
const keys=new Set(['rock-1','rock-2','rock-3','rock-4','rock-5','cliff-spire','stump']);
function repair(project){const changes=[],skipped=[],assets=new Map(project.assets.map(a=>[a.id,a]));
 for(const level of project.levels)for(const o of level.objects){const key=(o.assetId||'').replace(/^showcase-/,'');if(!keys.has(key)||o.solid===true)continue;
  const reason=level.playerSettings?.controllerType==='hovercraft'?'HOVERCRAFT_SUBMERGED_SCENERY_REQUIRES_SEPARATE_REVIEW':o.collider||o.parentId||o.quaternion||o.spin||o.ai||o.isRamp||o.behaviors?.length||o.animationClips?.length?'AUTHORED_OR_DYNAMIC_CONTENT_PRESERVED':null;
  if(reason){skipped.push({level:level.id,id:o.id,reason});continue;}
  const a=assets.get(o.assetId),canonical=require('./showcase-assets').getMesh(key);if(!a||['positions','normals','uvs','indices'].some(k=>JSON.stringify(a[k])!==JSON.stringify(canonical[k]))){skipped.push({level:level.id,id:o.id,reason:'MODIFIED_SOURCE_ASSET_PRESERVED'});continue;}
  const fit=require('./showcase-wall-collision'),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],a.positions[i]);max[k]=Math.max(max[k],a.positions[i]);}
  const scale=o.scale||[1,1,1];if(scale.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Stone scale requires review');
  if(['Trail edging','Ground detail'].includes(o.name)&&(max[1]-min[1])*scale[1]<=.65){skipped.push({level:level.id,id:o.id,reason:'LOW_AUTHORED_TRAIL_ACCENT_REQUIRES_WALKOVER_ACCEPTANCE'});continue;}
  // Reuse the canonical measured box policy, with no enlarged bounds.
  const fields=fit('pillar',a,scale,o.rotationY||0);changes.push({level:level.id,id:o.id,name:o.name,assetId:o.assetId,beforeSolid:o.solid??false,meshBounds:{min,max},collider:fields.collider});Object.assign(o,fields);
 }return {changes,skipped};}
module.exports={repair,keys};
