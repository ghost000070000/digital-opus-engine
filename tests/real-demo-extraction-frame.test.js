'use strict';
const assert=require('assert'),fs=require('fs'),{repair}=require('../tools/real-demo-extraction-frame');
const p=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../games/arsenal-run.json'))),before=JSON.stringify(p.levels[0].objects.find(o=>o.id==='obj2013'));
repair(p,'arsenal-run');const parts=p.levels[0].objects.filter(o=>o.groupId==='collision-extraction-frame-arsenal-run');
assert.strictEqual(parts.length,4);assert.strictEqual(parts.filter(o=>o.solid).length,3);assert.strictEqual(JSON.stringify(p.levels[0].objects.find(o=>o.id==='obj2013')),before,'Three-sentry extraction condition is untouched');
for(const o of parts.filter(o=>o.solid)){const c=o.collider;if(o.name.includes('jamb'))assert(Math.abs(c.offset.x)-c.size.x/2>.7,'Native player has a real clear centre passage');else assert(c.offset.y-c.size.y/2>2,'Header does not fill the goal opening');}
assert.strictEqual(repair(p,'arsenal-run').changes.length,0);
const actual=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../games/arsenal-run.json')));assert.strictEqual(actual.levels[0].objects.find(o=>o.id==='rehab-57').assetId,'collision-extraction-frame-arsenal-run-0','Actual reachable extraction uses open frame, not misleading closed leaves');
console.log('Extraction frame: exact retained art, clear opening, ordinary solids, unchanged win condition and idempotence PASS');
function historical(){const q=JSON.parse(JSON.stringify(actual)),l=q.levels[0];l.objects=l.objects.filter(o=>!o.groupId?.startsWith('collision-extraction-frame-'));l.objects.push({kind:'cube',id:'rehab-57',assetId:'showcase-door',mesh:'asset',position:[0,0,-16],scale:[1.6,1.6,1.6],rotationY:Math.PI,solid:false,behaviors:[]});l.objects.find(o=>o.id==='deep1-15').behaviors=[];q.assets=q.assets.filter(a=>!a.id.startsWith('collision-extraction-frame-'));return q;}
const h=historical(),originalArt=JSON.stringify(h.assets);assert.strictEqual(repair(h,'arsenal-run').changes.length,1);assert(h.assets.filter(a=>a.id.startsWith('collision-extraction-frame-')).every(a=>a.positions.length===a.normals.length));assert.strictEqual(JSON.stringify(h.assets.filter(a=>!a.id.startsWith('collision-extraction-frame-'))),originalArt,'Original meshes preserved exactly');
const custom=historical();custom.assets.find(a=>a.id==='showcase-blast-door').positions[0]+=.01;const customBefore=JSON.stringify(custom);assert.strictEqual(repair(custom,'arsenal-run').changes.length,0);assert.strictEqual(JSON.stringify(custom),customBefore,'Modified source art is never silently hidden or overwritten');

const silent=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../games/silent-sector.json')));
function historicalSilent(){const q=JSON.parse(JSON.stringify(silent)),l=q.levels[0];l.objects=l.objects.filter(o=>o.groupId!=='collision-extraction-frame-silent-sector');l.objects.push({kind:'cube',id:'rehab-81',name:'Extraction door',assetId:'showcase-door',mesh:'asset',position:[29,0,0],scale:[1.4,1.4,1.4],rotationY:Math.PI/2,solid:false,behaviors:[]});for(const id of ['promo-33','deep1-19'])l.objects.find(o=>o.id===id).behaviors=[];q.assets=q.assets.filter(a=>!a.id.startsWith('collision-extraction-frame-silent-sector'));return q;}
const hs=historicalSilent(),silentGoal=JSON.stringify(hs.levels[0].objects.find(o=>o.id==='obj3013')),silentArt=JSON.stringify(hs.assets);
assert.strictEqual(repair(hs,'silent-sector').changes.length,1);
const sp=hs.levels[0].objects.filter(o=>o.groupId==='collision-extraction-frame-silent-sector');assert.strictEqual(sp.length,4);assert.strictEqual(sp.filter(o=>o.solid).length,3);
assert.strictEqual(JSON.stringify(hs.levels[0].objects.find(o=>o.id==='obj3013')),silentGoal,'Data-gated extraction is unchanged');
assert.strictEqual(JSON.stringify(hs.assets.filter(a=>!a.id.startsWith('collision-extraction-frame-silent-sector'))),silentArt);
for(const id of ['promo-33','deep1-19'])assert.deepStrictEqual(hs.levels[0].objects.find(o=>o.id===id).behaviors,[{trigger:'start',action:'setVisibility',params:{targetId:id,visible:false}}]);
for(const o of sp.filter(o=>o.solid))if(o.name.includes('jamb'))assert(Math.abs(o.collider.offset.z)-o.collider.size.x/2>.6,'Yaw-rotated Silent frame leaves an actual clear passage');
assert.strictEqual(repair(hs,'silent-sector').changes.length,0);
const cs=historicalSilent();cs.levels[0].objects.find(o=>o.id==='promo-33').behaviors=[{trigger:'interact',action:'win'}];const cb=JSON.stringify(cs);assert.strictEqual(repair(cs,'silent-sector').changes.length,0);assert.strictEqual(JSON.stringify(cs),cb,'Custom overlay logic is preserved');
assert.strictEqual(silent.levels[0].objects.find(o=>o.id==='rehab-81').assetId,'collision-extraction-frame-silent-sector-0','Captured native closed-leaf pass-through requires open physical frame');
console.log('Silent extraction: exact frame, both overlays, native goal preservation and custom protection PASS');
