'use strict';
// Executes the canonical sampler and Entity.update against the actual imported Ranger.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),{window,console,Float32Array,Uint16Array,Uint32Array,ArrayBuffer,DataView,Uint8Array,TextDecoder,performance:{now:()=>0},requestAnimationFrame:()=>0,cancelAnimationFrame(){}});
const c={Vec3:window.Opus.Vec3,Quat:window.Opus.Quat,Mat4:window.Opus.Mat4,console};vm.createContext(c);
vm.runInContext(fs.readFileSync(require.resolve('../engine/src/21-gltf.js'),'utf8'),c);
const source=fs.readFileSync(require.resolve('../engine/src/11-entity.js'),'utf8'),start=source.indexOf('  update(dt, spinEnabled = true) {');assert(start>=0);let i=source.indexOf('{',start)+1,n=1;while(n){if(source[i]==='{')n++;if(source[i]==='}')n--;i++;}
vm.runInContext('function actualUpdate(dt, spinEnabled = true) '+source.slice(source.indexOf('{',start),i),c);
const skin=JSON.parse(fs.readFileSync(require.resolve('../games/moving-temple.json'),'utf8')).assets.find(a=>a.id==='showcase-ranger').skin;
for(const clip of skin.clips)for(const track of clip.tracks){track.times=new Float32Array(track.times);track.values=new Float32Array(track.values);}
function probe(initial,next,final){const e={skin,animationClip:initial,animationTime:0,animationSpeed:1,animationBlendTime:1,_blendFromClip:null};c.actualUpdate.call(e,0);e.animationClip=next;c.actualUpdate.call(e,.25);const before=Array.from(e._palette);e.animationClip=final;c.actualUpdate.call(e,0);const after=Array.from(e._palette);return {initial,next,final,maxPaletteDelta:Math.max(...before.map((v,j)=>Math.abs(v-after[j]))),before,after};}
const rapid=probe(0,1,2),bind=probe(null,1,2);
assert(rapid.before.every(Number.isFinite)&&rapid.after.every(Number.isFinite));
if(require.main===module)console.log(JSON.stringify({status:rapid.maxPaletteDelta>1e-6?'REAL_SAMPLER_DISCONTINUITY_CHARACTERIZED':'CONTINUOUS',fingerprint:require('./real-demo-program-state').fingerprint(),provenance:'Actual current Entity.update and canonical local-TRS sampler; public math from built bundle; actual 12-joint Ranger, not scalar stubs. CPU palette diagnostic, not rendered/native creator acceptance.',rapid,bind}));
module.exports={c,skin,probe};
