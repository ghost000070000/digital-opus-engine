'use strict';
// Qualification-only route planning. Observed geometry in, native waypoints out.
// No player/controller writes, no synthetic gameplay or product AI dependency.
function plan(start,target,solids,{radius=.4,height=1.1,reach=.45,step=.5,padding=.12,grounded=false,stepHeight=0}={}){
 // Mirrors the actual grounded first-person tryStepUp box-height contract.
 // This is a route hypothesis, not acceptance: native input must still prove
 // that the player climbs the top face. Spheres and taller boxes stay walls.
 const feet=start.y-height/2;
 const margin=radius+padding,obstacles=solids.filter(o=>o.visible&&o.solid&&!o.ramp&&o.collisionGeometry&&o.collisionCenter).filter(o=>{const c=o.collisionCenter,g=o.collisionGeometry,h=g.shape==='box'?g.half.y:g.radius,top=c.y+h;const walkableStep=grounded&&g.shape==='box'&&top>feet&&top-feet<=stepHeight;return !walkableStep&&top>feet+.05&&c.y-h<start.y+height/2;});
 function clear(x,z){return obstacles.every(o=>{const c=o.collisionCenter,g=o.collisionGeometry,dx=x-c.x,dz=z-c.z;if(g.shape==='sphere')return Math.hypot(dx,dz)>g.radius+margin;const q=o.rotation||{y:0,w:1},yaw=Math.atan2(2*q.w*q.y,1-2*q.y*q.y),a=dx*Math.cos(yaw)-dz*Math.sin(yaw),b=dx*Math.sin(yaw)+dz*Math.cos(yaw);return Math.hypot(Math.max(0,Math.abs(a)-g.half.x),Math.max(0,Math.abs(b)-g.half.z))>margin;});}
 function segment(a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15);for(let i=1;i<=n;i++)if(!clear(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;}
 if(Math.hypot(start.x-target.x,start.z-target.z)<=reach)return {status:'ALREADY_IN_REACH',points:[]};
 // Alternating real corridor dividers can require a detour outside the
 // endpoint envelope. Keep the search bounded, but include that corridor.
 const minX=Math.min(start.x,target.x)-12,maxX=Math.max(start.x,target.x)+12,minZ=Math.min(start.z,target.z)-12,maxZ=Math.max(start.z,target.z)+12;
 const heap=[],push=n=>{heap.push(n);for(let i=heap.length-1;i>0;){const p=(i-1)>>1;if(heap[p].f<=heap[i].f)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}},pop=()=>{const r=heap[0],last=heap.pop();if(heap.length){heap[0]=last;for(let i=0;;){let k=i,l=i*2+1,r=l+1;if(l<heap.length&&heap[l].f<heap[k].f)k=l;if(r<heap.length&&heap[r].f<heap[k].f)k=r;if(k===i)break;[heap[i],heap[k]]=[heap[k],heap[i]];i=k;}}return r;};
 const key=(i,j)=>i+','+j,cost=new Map([[key(0,0),0]]);push({i:0,j:0,x:start.x,z:start.z,g:0,f:0,parent:null});let visited=0,goal=null;
 while(heap.length&&visited++<12000){const n=pop();if(n.g!==cost.get(key(n.i,n.j)))continue;if(Math.hypot(n.x-target.x,n.z-target.z)<=reach){goal=n;break;}for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){if(!di&&!dj)continue;const i=n.i+di,j=n.j+dj,x=start.x+i*step,z=start.z+j*step;if(x<minX||x>maxX||z<minZ||z>maxZ||!clear(x,z)||!segment(n,{x,z}))continue;const g=n.g+Math.hypot(di,dj)*step,k=key(i,j);if(g>=(cost.get(k)??Infinity))continue;cost.set(k,g);push({i,j,x,z,g,f:g+Math.max(0,Math.hypot(x-target.x,z-target.z)-reach),parent:n});}}
 if(!goal)return {status:'NO_CLEAR_OBSERVED_ROUTE',visited,points:[]};const raw=[];for(let n=goal;n.parent;n=n.parent)raw.unshift({x:n.x,z:n.z});const points=[];let a=start;for(let i=0;i<raw.length;){let last=i;while(last+1<raw.length&&segment(a,raw[last+1]))last++;points.push(raw[last]);a=raw[last];i=last+1;}return {status:'OBSERVED_GEOMETRY_ROUTE_PLANNED',visited,points,clearanceRadius:margin,reach};
}
module.exports={plan};
