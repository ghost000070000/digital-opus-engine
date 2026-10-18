'use strict';
// Bounded canonical presentation repair. The controlled solid itself renders
// its door, so existing no-code Set Position moves art and collision together.
// Do not add another physics body, change the gate's Transform or change logic.
function repair(project,id){
 const configs={'power-grid':{gate:'obj1007',decor:'promo-22',position:[17,1.5,0],scale:[1,3,4],xFacing:true},'temple-switch-puzzle':{gate:'obj46',decor:'deep7-9',position:[0,1.25,8],scale:[6,2.5,.6],xFacing:false}};
 const config=configs[id];if(!config)return {changes:[],skipped:[]};
 const l=project.levels[0],gate=l.objects.find(o=>o.id===config.gate),decor=l.objects.find(o=>o.id===config.decor);
 const assetId='collision-gate-visual-'+id;
 const hide={trigger:'start',action:'setVisibility',params:{targetId:config.decor,visible:false}};
 if(gate?.assetId===assetId&&decor?.hiddenInPlay){
  if(decor.behaviors?.some(b=>JSON.stringify(b)===JSON.stringify(hide)))return {changes:[],skipped:[]};
  if(decor.behaviors?.length)return {changes:[],skipped:[{reason:'MODIFIED_REDUNDANT_VISUAL_BEHAVIORS_PRESERVED'}]};
  const before=JSON.parse(JSON.stringify(decor));decor.behaviors=[hide];
  return {changes:[{level:l.id,id:decor.id,before,after:JSON.parse(JSON.stringify(decor)),physicsAndLogicUnchanged:true,reason:'Canonical start visibility action, not unsupported hiddenInPlay metadata'}],skipped:[]};
 }
 if(!gate||!decor||gate.mesh!=='cube'||!gate.solid||gate.collider||gate.parentId||gate.rotationY!==0||JSON.stringify(gate.position)!==JSON.stringify(config.position)||JSON.stringify(gate.scale)!==JSON.stringify(config.scale)||decor.assetId!=='showcase-blast-door'||decor.parentId||decor.behaviors?.length||decor.solid)return {changes:[],skipped:[{reason:'MODIFIED_CONTROLLED_GATE_OR_VISUAL_PRESERVED'}]};
 const a=project.assets.find(a=>a.id===decor.assetId),canonical=require('./showcase-assets').getMesh('blast-door');
 if(!a||['positions','normals','uvs','indices'].some(k=>JSON.stringify(a[k])!==JSON.stringify(canonical[k])))return {changes:[],skipped:[{reason:'MODIFIED_DOOR_ART_PRESERVED'}]};
 // Rotate the source door into the gate's existing X-facing plane, then
 // normalize it to the existing cube footprint. Existing collision semantics
 // (1 x 3 x 4 world box) stay unchanged, with no yaw/scale/teleport rewrite.
 const rotated=[];for(let n=0;n<a.positions.length;n+=3)rotated.push(...(config.xFacing?[a.positions[n+2],a.positions[n+1],-a.positions[n]]:a.positions.slice(n,n+3)));
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];rotated.forEach((v,n)=>{const k=n%3;min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
 const ext=min.map((v,k)=>max[k]-v),centre=min.map((v,k)=>(v+max[k])/2);if(ext.some(v=>!(v>0)))throw new Error('Invalid canonical gate geometry');
 const normals=[];for(let n=0;n<a.normals.length;n+=3){const normal=config.xFacing?[a.normals[n+2],a.normals[n+1],-a.normals[n]]:a.normals.slice(n,n+3),v=normal.map((v,k)=>v*ext[k]),len=Math.hypot(...v)||1;normals.push(...v.map(v=>v/len));}
 const derived={...a,id:assetId,name:id+' / controlled blast door',positions:rotated.map((v,n)=>(v-centre[n%3])/ext[n%3]),normals,bounds:{min:[-.5,-.5,-.5],max:[.5,.5,.5]},provenance:{source:'Canonical showcase blast door normalized to existing controlled gate footprint; real-demo-gate-visuals.js',license:'MIT',documentation:'SHOWCASE-ASSET-LICENSES.md'}};
 const existing=project.assets.find(a=>a.id===assetId);if(existing&&JSON.stringify(existing)!==JSON.stringify(derived))throw new Error('Protect modified derived gate art');if(!existing)project.assets.push(derived);
 const before={gate:JSON.parse(JSON.stringify(gate)),decor:JSON.parse(JSON.stringify(decor))};
 Object.assign(gate,{mesh:'asset',assetId,textureAssetId:'showcase-palette',uvScale:[1,1],color:[1,1,1]});
 // Preserve the obsolete static visual and its source art in the project;
 // hide only the redundant closed slab rather than leave it across an open gate.
 Object.assign(decor,{visible:false,hiddenInPlay:true,behaviors:[hide]});
 return {changes:[{level:l.id,id:gate.id,decorId:decor.id,before,after:{gate:JSON.parse(JSON.stringify(gate)),decor:JSON.parse(JSON.stringify(decor))},physicsAndLogicUnchanged:true}],skipped:[]};
}
module.exports={repair};
