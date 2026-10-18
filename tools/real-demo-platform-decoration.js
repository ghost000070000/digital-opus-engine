'use strict';
// Canonical Skyway artwork used platform centres as floor heights. Move the
// exact existing assemblies onto their support tops; never enlarge boxes.
function repair(project,id){
 if(id!=='skyway-trial')return {changes:[],skipped:[]};
 const l=project.levels[0],changes=[],skipped=[];
 for(let i=1;i<=5;i++){
  const anchor=l.objects.find(o=>o.id==='deep7-'+i),platform=l.objects.find(o=>o.name==='Platform'+i),key=i%2?'railing':'stone-walkway';
  if(!anchor||!platform)continue;
  const top=platform.position[1]+Math.abs(platform.scale[1])/2,original=[i%2?2.1:-2.1,i-.5,i*5+3],members=l.objects.filter(o=>o.groupId===anchor.groupId);
  if(anchor.position[1]===top&&members.every(o=>o.position[1]===top))continue;
  const source=project.assets.find(a=>a.id==='showcase-'+key),canonical=require('./showcase-assets').getMesh(key);
  if(!source||['positions','normals','uvs','indices'].some(k=>JSON.stringify(source[k])!==JSON.stringify(canonical[k]))){skipped.push({id:anchor.id,reason:'MODIFIED_SOURCE_ART_PRESERVED'});continue;}
  const parts=require('./real-demo-architectural-assemblies').architecturalParts(source,key);
  if(!anchor.groupId||members.length!==parts.length||JSON.stringify(platform.position)!==JSON.stringify([0,i-.5,i*5+3])||platform.scale[1]!==1||members.some(o=>JSON.stringify(o.position)!==JSON.stringify(original)||JSON.stringify(o.scale)!=='[0.55,0.55,0.55]'||o.rotationY!==0||o.parentId||o.ai||o.patrol||o.behaviors?.length)){skipped.push({id:anchor.id,reason:'MODIFIED_PLACEMENT_PRESERVED'});continue;}
  const valid=parts.every((part,n)=>{const o=members.find(o=>o.id===(n?anchor.id+'-section-'+n:anchor.id)),a=project.assets.find(a=>a.id===o?.assetId),s=.55,c=o?.collider;return o?.solid===true&&a&&JSON.stringify(a.positions)===JSON.stringify(part.sourceIndices.flatMap(v=>source.positions.slice(v*3,v*3+3)))&&JSON.stringify(a.normals)===JSON.stringify(part.sourceIndices.flatMap(v=>source.normals.slice(v*3,v*3+3)))&&JSON.stringify(a.indices)===JSON.stringify(part.mesh.indices)&&c?.shape==='box'&&['x','y','z'].every((k,j)=>Math.abs(c.size[k]-part.size[j]*s)<1e-10&&Math.abs(c.offset[k]-part.center[j]*s)<1e-10);});
  if(!valid){skipped.push({id:anchor.id,reason:'MODIFIED_STRUCTURAL_PART_PRESERVED'});continue;}
  const before=JSON.parse(JSON.stringify(members));for(const o of members)o.position[1]=top;
  changes.push({id:anchor.id,platform:platform.id,fromY:original[1],toY:top,before,after:JSON.parse(JSON.stringify(members)),rigidTranslationOnly:true});
 }
 return {changes,skipped};
}
module.exports={repair};
