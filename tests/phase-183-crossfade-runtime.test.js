'use strict';
const assert=require('assert'),{c,skin,probe}=require('../tools/characterize-phase-183-real-sampler');
const delta=(a,b)=>Math.max(...Array.from(a,(v,i)=>Math.abs(v-b[i])));
assert.equal(probe(0,1,2).maxPaletteDelta,0,'Interrupted actual Ranger pose must remain continuous at zero time');
assert.equal(probe(null,1,2).maxPaletteDelta,0,'Bind-pose source must also blend continuously');
function entity(blend=1){return {skin,animationClip:0,animationTime:0,animationSpeed:1,animationBlendTime:blend,_blendFromClip:null};}
const e=entity();c.actualUpdate.call(e,.1);assert(delta(e._palette,c.computeSkinPalette(skin,0,.1))<1e-6,'First assignment stays direct');
e.animationClip=1;c.actualUpdate.call(e,.25);assert(delta(e._palette,c.computeSkinPaletteBlended(skin,0,.35,1,.25,.25))<1e-6,'Uninterrupted source clock stays historical');
const visible=e._palette;e.animationClip=2;c.actualUpdate.call(e,0);assert.equal(delta(visible,e._palette),0);c.actualUpdate.call(e,1);assert(delta(e._palette,c.computeSkinPalette(skin,2,e.animationTime))<1e-6,'Endpoint exactly matches wrapped destination clock');assert.equal(e._blendFromPose,null);
const cut=entity(0);c.actualUpdate.call(cut,0);cut.animationClip=1;c.actualUpdate.call(cut,.2);assert(delta(cut._palette,c.computeSkinPalette(skin,1,.2))<1e-6,'Zero remains instant cut');
const bind=entity();bind.animationClip=null;c.actualUpdate.call(bind,0);bind.animationClip=1;c.actualUpdate.call(bind,.25);assert(delta(bind._palette,c.computeSkinPaletteBlended(skin,null,0,1,.25,.25))<1e-6,'Null is valid bind source, not inactive sentinel');
for(let i=0;i<100;i++){e.animationClip=i%3;c.actualUpdate.call(e,.007);assert(Array.from(e._palette).every(Number.isFinite));}assert.notEqual(e._sampledLocalTRS,bind._sampledLocalTRS,'Poses remain owner-local');
e.skin={jointCount:1,jointParents:[-1],jointLocalBind:[skin.jointLocalBind[0]],inverseBindMatrices:[skin.inverseBindMatrices[0]],clips:[]};c.actualUpdate.call(e,0);assert.equal(e._palette.length,16,'Replacement skeleton at same clip index never borrows old blend pose');assert(Array.from(e._palette).every(Number.isFinite));
for(const duration of [Infinity,NaN,'1',null,-1]){const invalid=entity();c.actualUpdate.call(invalid,0);invalid.animationBlendTime=duration;invalid.animationClip=1;c.actualUpdate.call(invalid,.2);assert.equal(delta(invalid._palette,c.computeSkinPalette(skin,1,.2)),0,'Malformed runtime duration cuts safely');}
console.log('PASS183 actual Ranger sampler rapid/bind continuity, first/zero cuts, advancing source, endpoint and100 rapid switches; creator gates pending');
