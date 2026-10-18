'use strict';
// Qualification input policy, not a replacement controller or physics solver.
function hovercraftCornerKeys(state, target) {
  const p=state.player.position;
  let angle=Math.atan2(target.x-p.x,target.z-p.z)-state.player.yaw;
  while(angle>Math.PI)angle-=Math.PI*2;
  while(angle<-Math.PI)angle+=Math.PI*2;
  // The actual craft has angular inertia and forward thrust. Holding W while
  // facing away from a nearby vertex drives around the prop before turning.
  // Release throttle while turning; all motion remains ordinary native input.
  return [...(Math.abs(angle)<.45?['w']:[]),...(Math.abs(angle)>.15?[angle>0?'a':'d']:[])];
}
function selectEligibleCorner(corners, position) {
  return corners.filter(c=>c.verticalOverlap>.1).sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0]||null;
}
module.exports={hovercraftCornerKeys,selectEligibleCorner};
