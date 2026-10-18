'use strict';
const keys=new Set(['generator','terminal','vent']);
function mutatesSelf(value,object,level){if(!value||typeof value!=='object')return false;const kind=value.type||value.action;if(kind==='customScript')return true;if(['moveObject','setPosition','setRotation','setScale','animateObject'].includes(kind)){const target=value.targetId||value.params?.targetId;if(!target||target===object.id||!level.objects.some(o=>o.id===target))return true;}return Object.values(value).some(v=>mutatesSelf(v,object,level));}
function repair(project){const changes=[],skipped=[],assets=new Map(project.assets.map(a=>[a.id,a]));
 for(const level of project.levels)for(const o of level.objects){const key=(o.assetId||'').replace(/^showcase-/,'');if(!keys.has(key)||o.solid===true)continue;
  const reason=level.playerSettings?.controllerType==='hovercraft'?'HOVERCRAFT_SCENERY_REQUIRES_ALTITUDE_REVIEW':o.collider||o.parentId||o.quaternion||o.spin||o.ai||o.isRamp||o.animationClips?.length?'AUTHORED_OR_DYNAMIC_CONTENT_PRESERVED':(o.behaviors||[]).some(b=>!['start','interact'].includes(b.trigger))||mutatesSelf(o.behaviors,o,level)?'TRIGGER_OR_TRANSFORM_BEHAVIOR_PRESERVED':null;
  if(reason){skipped.push({level:level.id,id:o.id,reason});continue;}
  const a=assets.get(o.assetId),canonical=require('./showcase-assets').getMesh(key);if(!a||['positions','normals','uvs','indices'].some(k=>JSON.stringify(a[k])!==JSON.stringify(canonical[k]))){skipped.push({level:level.id,id:o.id,reason:'MODIFIED_SOURCE_ASSET_PRESERVED'});continue;}
  const scale=o.scale||[1,1,1];if(scale.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Machinery scale requires review');
  const fields=require('./showcase-wall-collision')('pillar',a,scale,o.rotationY||0);changes.push({level:level.id,id:o.id,name:o.name,assetId:o.assetId,beforeSolid:o.solid??false,collider:fields.collider,behaviorsPreserved:true});Object.assign(o,fields);
 }return {changes,skipped};}
module.exports={repair,keys};
