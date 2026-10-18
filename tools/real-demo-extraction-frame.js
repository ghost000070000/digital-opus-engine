'use strict';
// Bounded canonical extraction art repair, not another physics system.
// Original source art remains stored. Keep exact frame triangles, remove only
// the misleading closed leaves, and use ordinary grouped no-code solids.
const {components}=require('./real-demo-masonry-assembly');
function repair(project,id){
 const config={
  'arsenal-run':{portal:'rehab-57',position:[0,0,-16],scale:[1.6,1.6,1.6],yaw:Math.PI,overlays:[{id:'deep1-15',scale:[1.2,1.2,1.2],yaw:0}],label:'Arsenal'},
  'silent-sector':{portal:'rehab-81',position:[29,0,0],scale:[1.4,1.4,1.4],yaw:Math.PI/2,overlays:[{id:'promo-33',scale:[1,1,1],yaw:Math.PI/2},{id:'deep1-19',scale:[1.25,1.25,1.25],yaw:Math.PI/2}],label:'Silent Sector'}
 }[id];if(!config)return {changes:[],skipped:[]};
 const level=project.levels[0],portal=level.objects.find(o=>o.id===config.portal),overlays=config.overlays.map(c=>level.objects.find(o=>o.id===c.id)),overlay=overlays[0],group='collision-extraction-frame-'+id;
 if(portal?.assetId===group+'-0')return {changes:[],skipped:[]};
 if(!portal||overlays.some(o=>!o)||portal.assetId!=='showcase-door'||JSON.stringify(portal.position)!==JSON.stringify(config.position)||JSON.stringify(portal.scale)!==JSON.stringify(config.scale)||portal.rotationY!==config.yaw||overlays.some((o,n)=>o.assetId!=='showcase-blast-door'||JSON.stringify(o.position)!==JSON.stringify(config.position)||JSON.stringify(o.scale)!==JSON.stringify(config.overlays[n].scale)||o.rotationY!==config.overlays[n].yaw)||[portal,...overlays].some(o=>o.solid||o.collider||o.parentId||o.ai||o.patrol||o.spin||o.behaviors?.length||o.animationClips?.length||o.customScript))return {changes:[],skipped:[{reason:'MODIFIED_EXTRACTION_ART_PRESERVED'}]};
 const source=project.assets.find(a=>a.id==='showcase-door'),canonical=require('./showcase-assets').getMesh('door');
 if(!source||['positions','normals','uvs','indices'].some(k=>JSON.stringify(source[k])!==JSON.stringify(canonical[k])))return {changes:[],skipped:[{reason:'MODIFIED_DOOR_ASSET_PRESERVED'}]};
 const blast=project.assets.find(a=>a.id===overlay.assetId),originalBlast=require('./showcase-assets').getMesh('blast-door');
 if(!blast||['positions','normals','uvs','indices'].some(k=>JSON.stringify(blast[k])!==JSON.stringify(originalBlast[k])))return {changes:[],skipped:[{reason:'MODIFIED_OVERLAY_ART_PRESERVED'}]};
 const before={portal:JSON.parse(JSON.stringify(portal)),overlay:JSON.parse(JSON.stringify(overlay)),overlays:JSON.parse(JSON.stringify(overlays))},parts=components(source),selected=[0,1,2,9],records=[];
 for(const [n,index] of selected.entries()){
  const part=parts[index],assetId=group+'-'+n;
  if(project.assets.some(a=>a.id===assetId))throw new Error('Preserve existing derived extraction art');
  const asset={...part.mesh,id:assetId,name:config.label+' extraction / '+['left jamb','right jamb','header','indicator'][n],positions:part.sourceIndices.flatMap(v=>source.positions.slice(v*3,v*3+3)),normals:part.sourceIndices.flatMap(v=>source.normals.slice(v*3,v*3+3)),uvs:part.sourceIndices.flatMap(v=>source.uvs.slice(v*2,v*2+2)),bounds:{min:part.center.map((v,k)=>v-part.size[k]/2),max:part.center.map((v,k)=>v+part.size[k]/2)},provenance:{source:'Exact canonical showcase-door frame triangles, parts 0/1/2/9; real-demo-extraction-frame.js',license:'MIT',documentation:'SHOWCASE-ASSET-LICENSES.md'}};
  project.assets.push(asset);
  const record={...before.portal,id:n?portal.id+'-frame-'+n:portal.id,assetId,groupId:group,name:'Extraction portal / '+['left jamb','right jamb','header','indicator'][n],solid:n<3};
  if(level.objects.some(o=>o.id===record.id)&&n)throw new Error('Protect extraction object identity');
  if(n<3){const s=record.scale,y=record.rotationY,c=Math.cos(y),sin=Math.sin(y),local=part.center.map((v,k)=>v*s[k]);record.collider={shape:'box',size:{x:part.size[0]*s[0],y:part.size[1]*s[1],z:part.size[2]*s[2]},offset:{x:local[0]*c+local[2]*sin,y:local[1],z:-local[0]*sin+local[2]*c}};}
  records.push(record);if(n)level.objects.push(record);else Object.assign(portal,record);
 }
 for(const o of overlays)o.behaviors=[{trigger:'start',action:'setVisibility',params:{targetId:o.id,visible:false}}];
 return {changes:[{level:level.id,before,records,overlayAfter:JSON.parse(JSON.stringify(overlay)),overlaysAfter:JSON.parse(JSON.stringify(overlays)),goalLogicUnchanged:true,frameSourceParts:selected}],skipped:[]};
}
module.exports={repair};
