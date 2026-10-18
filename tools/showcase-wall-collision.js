'use strict';
// Architectural wall panels are blocking props, unlike foliage, route markers,
// pickups and trigger visuals. Fit the real mesh; never assume a centred cube.
module.exports=function wallCollision(key,asset,scale,yaw=0){
  if(!['wall-panel','pillar','computer-bank','support-column','crate','barricade'].includes(key))return {};
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let n=0;n<asset.positions.length;n++){const a=n%3;min[a]=Math.min(min[a],asset.positions[n]);max[a]=Math.max(max[a],asset.positions[n]);}
  const s=Array.isArray(scale)?scale:[scale,scale,scale],size=min.map((v,i)=>(max[i]-v)*s[i]),center=min.map((v,i)=>(max[i]+v)*s[i]/2);
  if(size.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Wall panel mesh must have finite positive volume');
  const c=Math.cos(yaw),sin=Math.sin(yaw);
  return {solid:true,collider:{shape:'box',size:{x:size[0],y:size[1],z:size[2]},offset:{x:center[0]*c+center[2]*sin,y:center[1],z:-center[0]*sin+center[2]*c}}};
};
