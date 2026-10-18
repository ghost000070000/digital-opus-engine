'use strict';
// Actual Entity.update sequencing with scalar sampler stubs, not GPU/palette acceptance.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require.resolve('../engine/src/11-entity.js'),'utf8'),start=source.indexOf('  update(dt, spinEnabled = true) {');assert(start>=0);let i=source.indexOf('{',start)+1,n=1;while(n){if(source[i]==='{')n++;if(source[i]==='}')n--;i++;}
const c={computeSkinPalette:(skin,index)=>index==null?0:index*10,computeSkinPaletteBlended:(skin,a,ta,b,tb,t)=>a*10*(1-t)+b*10*t};vm.createContext(c);vm.runInContext('function actualUpdate(dt, spinEnabled = true) '+source.slice(source.indexOf('{',start),i),c);
const e={skin:{clips:[{duration:1},{duration:1},{duration:1}]},animationClip:0,animationTime:0,animationSpeed:1,animationBlendTime:1,_blendFromClip:null};
c.actualUpdate.call(e,0);e.animationClip=1;c.actualUpdate.call(e,.25);const visible=e._palette;assert.equal(visible,2.5);e.animationClip=2;c.actualUpdate.call(e,0);const switched=e._palette;
console.log(JSON.stringify({status:switched===visible?'CONTINUOUS_SOURCE_SEQUENCE':'MID_BLEND_SWITCH_DISCONTINUITY_CHARACTERIZED',provenance:'Actual Entity.update with scalar sampling stubs isolates transition sequencing; not real joint-palette/native qualification.',visibleBefore:visible,visibleAfterZeroTimeSwitch:switched,jump:switched-visible,claimedComment:'rapid state change blends from CURRENT visible pose',actualFromClip:e._blendFromClip}));
