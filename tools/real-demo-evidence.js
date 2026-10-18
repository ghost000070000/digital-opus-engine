'use strict';
// Observation-only qualification oracle; never changes controller results.
function orthogonalCorner(events,firstId,visibleSolidIds,minFrames=3){
 const valid=new Set(visibleSolidIds),groups=new Map();
 for(const a of events){
  if(a.target!==firstId||!a.solid||!valid.has(a.target))continue;
  const ax=a.result.x-a.requested.x,az=a.result.z-a.requested.z,al=Math.hypot(ax,az);if(al<1e-6)continue;
  for(const b of events){
   if(b.target===a.target||!b.solid||!valid.has(b.target)||Math.abs(a.time-b.time)>1e-6)continue;
   const bx=b.result.x-b.requested.x,bz=b.result.z-b.requested.z,bl=Math.hypot(bx,bz);if(bl<1e-6||Math.abs((ax*bx+az*bz)/(al*bl))>.2)continue;
   if(!groups.has(b.target))groups.set(b.target,new Map());groups.get(b.target).set(a.time,[a,b]);
  }
 }
 for(const [second,frames] of groups)if(frames.size>=minFrames)return {first:firstId,second,simultaneousFrames:frames.size,contacts:[...frames.values()].flat(),method:'At least three same-frame responses from distinct visible solids with orthogonal actual horizontal correction vectors'};
 return null;
}
module.exports={orthogonalCorner};
