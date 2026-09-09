'use strict';

// Original, deterministic art sources for the 28-game rehabilitation.
// No downloaded geometry, textures, audio, or runtime dependencies.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..', 'assets', 'showcase');
const TAU = Math.PI * 2;
const round = n => Math.round(n * 100000) / 100000;
const add = (a, b) => a.map((n, i) => n + b[i]);
const sub = (a, b) => a.map((n, i) => n - b[i]);
const mul = (a, n) => a.map(x => x * n);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
function random(seed) { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; }
function hash(s) { let n = 2166136261; for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }

// Eight-wide palette, two rows. Flat UV islands stay inside a single tile.
const PALETTE = ['#293440', '#455666', '#7d9297', '#b9c8c5', '#624e40', '#938064', '#28554a', '#3f7960',
  '#75a66e', '#b8c988', '#315577', '#5598b2', '#70dfe0', '#efb657', '#db634b', '#ece3c4'];
const C = { dark: 0, steel: 1, stone: 2, lightstone: 3, bark: 4, wood: 5, evergreen: 6, green: 7,
  leaf: 8, lime: 9, blue: 10, sky: 11, cyan: 12, gold: 13, red: 14, ivory: 15 };

class Builder {
  constructor() { this.positions = []; this.normals = []; this.uvs = []; this.indices = []; this.joints = []; this.weights = []; this.joint = 0; }
  tri(a, b, c, color = C.stone) {
    const n = unit(cross(sub(b, a), sub(c, a)));
    if (Math.hypot(...cross(sub(b, a), sub(c, a))) < 1e-9) return;
    const base = this.positions.length / 3;
    const uv = [(color % 8 + 0.5) / 8, 1 - (Math.floor(color / 8) + 0.5) / 2];
    for (const p of [a, b, c]) { this.positions.push(...p.map(round)); this.normals.push(...n.map(round)); this.uvs.push(...uv); this.joints.push(this.joint, 0, 0, 0); this.weights.push(1, 0, 0, 0); }
    this.indices.push(base, base + 1, base + 2);
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  box(pos, size, col = C.stone) {
    const [x, y, z] = pos, [a, b, c] = size.map(n => n / 2);
    const p = [[x-a,y-b,z-c],[x+a,y-b,z-c],[x+a,y+b,z-c],[x-a,y+b,z-c],[x-a,y-b,z+c],[x+a,y-b,z+c],[x+a,y+b,z+c],[x-a,y+b,z+c]];
    for (const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) this.quad(...f.map(i => p[i]), col);
  }
  // A loft is a sequence of [x,y,z,radiusX,radiusZ] rings. Separate flat
  // faces make the silhouettes deliberate and lighting easy to read.
  loft(rings, col = C.stone, sides = 8, twist = Math.PI / 8) {
    const rs = rings.map(([x,y,z,rx,rz]) => Array.from({length:sides}, (_,i) => [x+Math.cos(i*TAU/sides+twist)*rx,y,z+Math.sin(i*TAU/sides+twist)*rz]));
    const cc = i => Array.isArray(col) ? col[i % col.length] : col;
    for (let j=0;j<rs.length-1;j++) for(let i=0;i<sides;i++) { const k=(i+1)%sides; this.quad(rs[j][i],rs[j+1][i],rs[j+1][k],rs[j][k],cc(i+j)); }
    for(let i=1;i<sides-1;i++) { this.tri(rs[0][0],rs[0][i],rs[0][i+1],cc(i)); this.tri(rs.at(-1)[0],rs.at(-1)[i+1],rs.at(-1)[i],cc(i)); }
  }
  orb(pos, radii, col=C.stone, sides=8, bands=4, seed=0) {
    const rnd=random(seed), rings=[];
    for(let j=0;j<=bands;j++){ const a=-Math.PI/2+j*Math.PI/bands; const f=seed ? .9+rnd()*.2 : 1; rings.push([pos[0],pos[1]+Math.sin(a)*radii[1],pos[2],Math.max(.001,Math.cos(a)*radii[0]*f),Math.max(.001,Math.cos(a)*radii[2]*f)]); }
    this.loft(rings,col,sides);
  }
  tube(a,b,r1,r2,col=C.stone,sides=7) {
    const d=unit(sub(b,a)), u=unit(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])), v=cross(d,u);
    const ring=(p,r)=>Array.from({length:sides},(_,i)=>add(p,add(mul(u,Math.cos(i*TAU/sides)*r),mul(v,Math.sin(i*TAU/sides)*r))));
    const ra=ring(a,r1), rb=ring(b,r2), cc=i=>Array.isArray(col)?col[i%col.length]:col;
    for(let i=0;i<sides;i++){const j=(i+1)%sides;this.quad(ra[i],ra[j],rb[j],rb[i],cc(i));this.tri(a,ra[j],ra[i],cc(i));this.tri(b,rb[i],rb[j],cc(i));}
  }
  ring(center,inner,outer,height,col=C.stone,sides=12) {
    const [x,y,z]=center;
    for(let i=0;i<sides;i++){const a=i*TAU/sides,b=(i+1)*TAU/sides;const p=(r,h,t)=>[x+Math.cos(t)*r,y+h,z+Math.sin(t)*r];
      this.quad(p(outer,0,a),p(outer,height,a),p(outer,height,b),p(outer,0,b),col);
      this.quad(p(inner,0,b),p(inner,height,b),p(inner,height,a),p(inner,0,a),col);
      this.quad(p(inner,height,a),p(inner,height,b),p(outer,height,b),p(outer,height,a),col);
      this.quad(p(outer,0,a),p(outer,0,b),p(inner,0,b),p(inner,0,a),col);
    }
  }
  beveled(pos,size,col=C.steel,bevel=.08) {
    const [x,y,z]=pos,[w,h,d]=size;
    const b=Math.min(bevel,h*.25,w*.2,d*.2);
    this.loft([[x,y-h/2,z,w/2-b,d/2-b],[x,y-h/2+b,z,w/2,d/2],[x,y+h/2-b,z,w/2,d/2],[x,y+h/2,z,w/2-b,d/2-b]],col,4,Math.PI/4);
  }
  asset(key, family, skin) {
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(let i=0;i<this.positions.length;i++) {bounds.min[i%3]=Math.min(bounds.min[i%3],this.positions[i]);bounds.max[i%3]=Math.max(bounds.max[i%3],this.positions[i]);}
    const result={id:'showcase-'+key,name:key,type:skin?'skinnedMesh':'mesh',positions:this.positions,normals:this.normals,indices:this.indices,uvs:this.uvs,textureAssetId:'showcase-palette',sourceFilename:key+'.mesh.json',folder:'Showcase / '+family,tags:['original','showcase',family],bounds};
    if(skin) Object.assign(result,{joints:this.joints,weights:this.weights,skin});
    return result;
  }
}

function rig(spec, animations) {
  const world=spec.map(s=>s[2]), parents=spec.map(s=>s[1]);
  return {jointCount:spec.length,jointNames:spec.map(s=>s[0]),jointParents:parents,
    inverseBindMatrices:world.map(p=>[1,0,0,0,0,1,0,0,0,0,1,0,-p[0],-p[1],-p[2],1]),
    jointLocalBind:world.map((p,i)=>({translation:parents[i]<0?p:sub(p,world[parents[i]]),rotation:[0,0,0,1],scale:[1,1,1]})),clips:animations};
}
function rotationTrack(joint,angles,duration,axis='x') { return {jointLocalIndex:joint,path:'rotation',interpolation:'LINEAR',times:angles.map((_,i)=>round(i*duration/(angles.length-1))),values:angles.flatMap(a=>axis==='z'?[0,0,round(Math.sin(a/2)),round(Math.cos(a/2))]:axis==='y'?[0,round(Math.sin(a/2)),0,round(Math.cos(a/2))]:[round(Math.sin(a/2)),0,0,round(Math.cos(a/2))])}; }
function humanoid() {
  const b=new Builder();
  const spec=[['root',-1,[0,0,0]],['hips',0,[0,.86,0]],['chest',1,[0,1.13,0]],['head',2,[0,1.53,0]],['leftArm',2,[-.31,1.4,0]],['leftForearm',4,[-.4,1.12,.025]],['rightArm',2,[.31,1.4,0]],['rightForearm',6,[.4,1.12,.025]],['leftLeg',1,[-.14,.84,0]],['leftShin',8,[-.16,.46,0]],['rightLeg',1,[.14,.84,0]],['rightShin',10,[.16,.46,0]]];
  b.joint=1;b.loft([[0,.77,0,.24,.15],[0,.93,0,.24,.17],[0,1.03,0,.2,.14]],C.dark);b.ring([0,.95,0],.1,.23,.065,C.wood,8);
  b.joint=2;b.loft([[0,1,0,.2,.14],[0,1.32,0,.32,.19],[0,1.45,0,.23,.14]], [C.blue,C.blue,C.steel],8);
  b.beveled([0,1.28,.151],[.24,.22,.1],C.sky,.025);b.beveled([0,1.19,.205],[.095,.055,.045],C.gold,.008);
  // Backpack and cloak are shaped parts of the torso, not a diagnostic sheet.
  b.beveled([0,1.22,-.19],[.3,.3,.14],C.wood,.035);
  b.loft([[0,.74,-.1,.27,.055],[0,1.1,-.17,.23,.055],[0,1.4,-.14,.18,.045]],C.evergreen,4);
  b.joint=3;b.tube([0,1.43,0],[0,1.58,0],.085,.09,C.ivory);b.orb([0,1.65,0],[.17,.205,.16],C.blue,8,4);
  b.beveled([0,1.655,.13],[.2,.11,.085],C.ivory,.02);b.box([0,1.675,.178],[.17,.035,.014],C.dark);b.box([0,1.675,.188],[.12,.015,.008],C.cyan);
  for(const s of [-1,1]){
    b.joint=s<0?4:6;b.orb([s*.3,1.4,0],[.135,.105,.145],C.steel,6,3);b.tube([s*.33,1.35,0],[s*.4,1.12,.025],.095,.075,C.blue);
    b.joint=s<0?5:7;b.tube([s*.4,1.12,.025],[s*.42,.92,.09],.085,.065,C.wood);b.orb([s*.42,.875,.1],[.075,.09,.075],C.ivory,6,3);
    b.joint=s<0?8:10;b.tube([s*.14,.82,0],[s*.16,.46,0],.115,.09,C.steel);b.orb([s*.16,.47,.025],[.105,.105,.11],C.blue,6,3);
    b.joint=s<0?9:11;b.tube([s*.16,.43,0],[s*.16,.14,.015],.092,.065,C.wood);b.beveled([s*.16,.085,.07],[.2,.17,.34],C.dark,.025);
  }
  const locomotion=(name,d,a)=>({name,duration:d,tracks:[rotationTrack(4,[-a,a,-a],d),rotationTrack(6,[a,-a,a],d),rotationTrack(8,[a,-a,a],d),rotationTrack(10,[-a,a,-a],d),rotationTrack(9,[0,.45,0],d),rotationTrack(11,[.45,0,.45],d)]});
  const clips=[{name:'Idle',duration:2.4,tracks:[rotationTrack(2,[0,.035,0],2.4),rotationTrack(3,[-.035,.035,-.035],2.4,'y')]},locomotion('Walk',1,.35),locomotion('Run',.64,.62),{name:'Jump',duration:.8,tracks:[rotationTrack(4,[0,-1,-.6],.8),rotationTrack(6,[0,-1,-.6],.8),rotationTrack(8,[0,-.5,0],.8)]},{name:'Fall',duration:1,tracks:[rotationTrack(4,[-.6,-.4,-.6],1),rotationTrack(6,[-.6,-.4,-.6],1)]},{name:'Attack',duration:.55,tracks:[rotationTrack(6,[0,-1.5,.8,0],.55),rotationTrack(2,[0,-.15,.15,0],.55,'y')]},{name:'Death',duration:1,tracks:[rotationTrack(1,[0,.4,1.4],1)]}];
  const asset=b.asset('ranger','characters',rig(spec,clips));asset.sockets=[{id:'showcase-right-hand',name:'RightHand',jointName:'rightForearm',positionOffset:{x:.02,y:-.2,z:.065},rotationOffset:{x:0,y:0,z:0},scaleOffset:{x:1,y:1,z:1}}];return asset;
}

function guardian() {
  const b=new Builder(),spec=[['root',-1,[0,0,0]],['body',0,[0,1.15,0]],['head',1,[0,1.52,.68]],['frontLeft',1,[-.38,1.12,.48]],['frontRight',1,[.38,1.12,.48]],['backLeft',1,[-.38,1.12,-.5]],['backRight',1,[.38,1.12,-.5]]];
  b.joint=1;b.orb([0,1.22,-.04],[.58,.55,.86],[C.stone,C.steel,C.lightstone],9,5);b.orb([0,1.48,.45],[.53,.47,.48],[C.steel,C.stone],8,4);
  for(let i=0;i<5;i++){const z=-.65+i*.25;b.loft([[0,1.52,z,.15,.13],[0,1.86+Math.sin(i)*.12,z-.03,.17,.13],[0,2.12+Math.sin(i)*.1,z,.005,.005]],[C.sky,C.cyan,C.blue],5);}
  b.tube([0,1.15,-.75],[.08,.9,-1.3],.17,.065,C.steel);b.tube([.08,.9,-1.3],[.1,1.14,-1.56],.065,.005,C.cyan);
  b.joint=2;b.orb([0,1.59,.89],[.35,.33,.48],[C.steel,C.stone],7,4);b.beveled([0,1.47,1.21],[.4,.23,.37],C.dark,.04);
  for(const s of [-1,1]){b.beveled([s*.255,1.72,1.095],[.11,.09,.16],C.cyan,.02);b.tube([s*.23,1.8,.8],[s*.42,2.18,.74],.095,.055,C.lightstone);b.tube([s*.42,2.18,.74],[s*.34,2.46,.63],.055,.003,C.gold);b.tube([s*.39,2.09,.75],[s*.65,2.22,.78],.045,.002,C.ivory);}
  for(const [i,x,z] of [[3,-.4,.5],[4,.4,.5],[5,-.4,-.54],[6,.4,-.54]]){b.joint=i;b.orb([x,1.12,z],[.2,.28,.22],C.stone,6,3);b.tube([x,1.05,z],[x*1.15,.55,z-.05],.17,.105,C.steel);b.tube([x*1.15,.55,z-.05],[x*1.16,.14,z+.12],.105,.09,C.stone);b.beveled([x*1.16,.09,z+.2],[.27,.18,.39],C.dark,.03);for(let j=-1;j<=1;j++)b.tube([x*1.16+j*.08,.07,z+.33],[x*1.16+j*.08,.045,z+.46],.028,.002,C.ivory,4);}
  const locomotion=(name,d,a)=>({name,duration:d,tracks:[rotationTrack(3,[a,-a,a],d),rotationTrack(4,[-a,a,-a],d),rotationTrack(5,[-a,a,-a],d),rotationTrack(6,[a,-a,a],d),rotationTrack(2,[-.03,.07,-.03],d)]});
  return b.asset('guardian','characters',rig(spec,[{name:'Idle',duration:2.4,tracks:[rotationTrack(2,[-.05,.06,-.05],2.4)]},locomotion('Walk',1.1,.25),locomotion('Run',.65,.45),{name:'Attack',duration:.7,tracks:[rotationTrack(2,[0,-.35,.5,0],.7),rotationTrack(1,[0,-.12,.15,0],.7)]},{name:'Death',duration:1.1,tracks:[rotationTrack(1,[0,.4,1.1],1.1,'z')]}]));
}

function drone() {
  const b=new Builder();b.orb([0,0,0],[.49,.25,.4],[C.dark,C.steel,C.steel],8,4);b.ring([0,-.1,0],.28,.44,.13,C.sky,10);
  b.beveled([0,.025,.36],[.25,.16,.11],C.dark,.025);b.orb([0,.025,.43],[.075,.065,.025],C.red,8,3);
  for(const x of [-1,1])for(const z of [-1,1]){b.tube([x*.29,0,z*.2],[x*.65,.025,z*.45],.045,.04,C.steel,5);b.ring([x*.67,-.045,z*.46],.13,.23,.09,C.dark,10);b.tube([x*.67,-.04,z*.46],[x*.67,.075,z*.46],.04,.035,C.gold,6);b.box([x*.67,.04,z*.46],[.35,.018,.025],C.stone);b.box([x*.67,.04,z*.46],[.025,.018,.35],C.stone);}
  b.tube([0,.16,-.13],[0,.53,-.18],.018,.009,C.stone,5);b.orb([0,.53,-.18],[.035,.035,.035],C.cyan,5,2);
  return b.asset('drone','characters');
}

const MODEL_FACTORIES = {
  ranger:humanoid,guardian,drone,
  'tree-pine':()=>{const b=new Builder();b.tube([0,0,0],[.06,3.65,0],.2,.045,[C.bark,C.wood],7);for(let j=0;j<4;j++)b.loft([[0,1+j*.64,0,1.18-j*.21,1.03-j*.18],[0,1.23+j*.64,0,1.27-j*.22,1.13-j*.2],[.03,2.9+j*.35,0,.015,.015]],[C.evergreen,C.green,C.evergreen],8,j*.25);return b.asset('tree-pine','fantasy');},
  'tree-oak':()=>{const b=new Builder();b.tube([0,0,0],[.12,2.8,0],.27,.1,[C.bark,C.wood],7);for(const [i,x,z] of [[0,-.8,.1],[1,.8,.2],[2,0,-.7]]){b.tube([0,1.5,0],[x,2.7,z],.11,.035,C.bark);b.orb([x,3.1,z],[1.05,.94,1.1],[C.green,C.leaf,C.evergreen],7,4,70+i);}b.orb([.1,3.75,0],[1.2,.8,1.05],[C.leaf,C.green],8,4,58);return b.asset('tree-oak','fantasy');},
  'tree-birch':()=>{const b=new Builder();b.tube([0,0,0],[.18,4.1,0],.13,.035,C.lightstone,7);for(let i=0;i<5;i++){const s=i%2?-1:1,y=1.4+i*.46;b.tube([i*.02,y,0],[s*.48,y+.55,0],.05,.015,C.lightstone,5);b.orb([s*.48,y+.68,0],[.64,.55,.65],[C.leaf,C.lime,C.green],6,3,29+i);b.box([i*.015,y,.1],[.12,.055,.035],C.dark);}b.orb([.15,4.05,0],[.65,.75,.62],[C.lime,C.leaf],7,3);return b.asset('tree-birch','fantasy');},
  bush:()=>{const b=new Builder();for(let i=0;i<5;i++){const a=i*2.4;b.orb([Math.cos(a)*.4,.25+(i%2)*.12,Math.sin(a)*.3],[.43,.4,.38],[C.evergreen,C.green,C.leaf],6,3,7+i);}return b.asset('bush','fantasy');},
  grass:()=>{const b=new Builder();for(let i=0;i<11;i++){const a=i*2.4,x=Math.cos(a)*.24,z=Math.sin(a)*.24,h=.3+(i%4)*.08;b.tube([x,0,z],[x*1.5,h,z*1.5],.034,.001,i%3?C.green:C.leaf,3);}return b.asset('grass','fantasy');},
  'ruin-wall':()=>{const b=new Builder();for(let y=0;y<3;y++)for(let x=0;x<4;x++)b.beveled([(x-1.5)*.77+(y%2)*.06,.33+y*.66,0],[.74,.63,.55],[C.stone,C.lightstone,C.steel][(x+y)%3],.055);for(let i=0;i<3;i++)b.orb([-1+i,2,.07],[.38,.09,.28],C.green,6,2);return b.asset('ruin-wall','fantasy');},
  'broken-wall':()=>{const b=new Builder();for(let x=0;x<4;x++)for(let y=0;y<(x<2?3:1);y++)b.beveled([(x-1.5)*.7,.32+y*.63,0],[.67,.6,.58],y%2?C.stone:C.lightstone,.06);b.orb([.4,1.05,0],[.5,.4,.35],[C.stone,C.steel],6,3,85);b.orb([1.2,.24,.6],[.55,.24,.45],[C.stone,C.steel],6,3,87);return b.asset('broken-wall','fantasy');},
  arch:()=>{const b=new Builder();for(const x of [-1.35,1.35]){b.beveled([x,.12,0],[.8,.24,.85],C.lightstone,.05);for(let i=0;i<4;i++)b.beveled([x,.46+i*.55,0],[.59,.52,.65],i%2?C.stone:C.lightstone,.04);}for(let i=0;i<9;i++){const a=i*Math.PI/9,aa=(i+1)*Math.PI/9,r1=1.06,r2=1.66,y=2.05;const p=(r,t,z)=>[Math.cos(t)*r,y+Math.sin(t)*r,z];const q=[p(r1,a,-.34),p(r2,a,-.34),p(r2,aa,-.34),p(r1,aa,-.34),p(r1,a,.34),p(r2,a,.34),p(r2,aa,.34),p(r1,aa,.34)];for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[0,4,7,3]])b.quad(...f.map(j=>q[j]),i%2?C.stone:C.lightstone);}return b.asset('arch','fantasy');},
  pillar:()=>{const b=new Builder();b.loft([[0,0,0,.53,.53],[0,.2,0,.53,.53],[0,.31,0,.36,.36],[0,2.15,0,.28,.28],[0,2.26,0,.43,.43],[0,2.46,0,.43,.43]], [C.stone,C.lightstone,C.stone],8);b.ring([0,.44,0],.1,.37,.1,C.wood,8);b.ring([0,1.8,0],.1,.32,.11,C.wood,8);return b.asset('pillar','fantasy');},
  gate:()=>{const b=new Builder();for(const x of [-1.2,1.2]){b.loft([[x,0,0,.26,.26],[x,2.45,0,.2,.2],[x,2.8,0,.01,.01]],[C.steel,C.stone],6);}for(let i=-4;i<=4;i++){b.tube([i*.24,.12,0],[i*.24,2.35,0],.035,.035,C.wood,5);b.loft([[i*.24,2.35,0,.075,.075],[i*.24,2.6,0,.002,.002]],C.gold,4);}for(const y of [.5,1.8])b.box([0,y,0],[2.4,.1,.1],C.wood);b.orb([0,1.25,.1],[.2,.24,.065],C.gold,6,3);return b.asset('gate','fantasy');},
  beacon:()=>{const b=new Builder();b.loft([[0,0,0,.65,.65],[0,.16,0,.65,.65],[0,.28,0,.42,.42],[0,1.08,0,.27,.27],[0,1.2,0,.42,.42]], [C.stone,C.lightstone],8);b.ring([0,1.17,0],.2,.49,.14,C.gold,10);for(let i=0;i<4;i++){const a=i*TAU/4;b.tube([Math.cos(a)*.32,1.2,Math.sin(a)*.32],[Math.cos(a)*.25,1.92,Math.sin(a)*.25],.04,.015,C.wood,5);}b.loft([[0,1.29,0,.02,.02],[0,1.62,0,.23,.23],[0,2.09,0,.001,.001]],[C.gold,C.ivory],6);return b.asset('beacon','fantasy');},
  shrine:()=>{const b=new Builder();for(let i=0;i<3;i++)b.beveled([0,.09+i*.18,0],[2.3-i*.4,.18,1.65-i*.24],C.stone,.045);b.loft([[0,.54,0,.48,.38],[0,1.3,0,.37,.27],[0,1.45,0,.6,.46]],C.lightstone,4);b.ring([0,1.42,0],.27,.48,.15,C.gold,8);b.loft([[0,1.57,0,.005,.005],[0,1.9,0,.2,.2],[0,2.26,0,.005,.005]],[C.cyan,C.sky],5);return b.asset('shrine','fantasy');},
  relic:()=>{const b=new Builder();b.loft([[0,0,0,.003,.003],[0,.32,0,.22,.22],[0,.76,0,.003,.003]],[C.gold,C.ivory,C.gold],6);b.ring([0,.29,0],.19,.27,.045,C.wood,6);return b.asset('relic','fantasy');},
  bridge:()=>{const b=new Builder();for(let i=0;i<10;i++)b.beveled([0,.18,(i-4.5)*.39],[1.8,.15,.37],i%3?C.wood:C.bark,.025);for(const x of [-.73,.73])b.box([x,.06,0],[.15,.15,4.2],C.bark);for(const x of [-.86,.86]){for(const z of [-1.9,0,1.9])b.tube([x,.17,z],[x,1.1,z],.075,.065,C.bark,6);b.tube([x,.92,-1.9],[x,.92,1.9],.045,.045,C.wood,6);}return b.asset('bridge','fantasy');},
  'wall-panel':()=>{const b=new Builder();b.beveled([0,1.5,0],[3,3,.27],C.dark,.07);b.beveled([0,1.6,.13],[2.55,2.28,.13],C.steel,.09);for(const x of [-1.29,1.29])b.box([x,1.5,.14],[.09,2.78,.16],C.stone);for(const y of [.26,2.68])b.box([0,y,.18],[2.66,.055,.1],C.sky);b.box([.89,1.63,.25],[.065,.6,.025],C.cyan);b.box([0,.46,.21],[1.5,.045,.04],C.dark);return b.asset('wall-panel','scifi');},
  'floor-panel':()=>{const b=new Builder();b.beveled([0,.06,0],[2.8,.12,2.8],C.dark,.035);b.beveled([0,.13,0],[2.52,.025,2.52],C.steel,.005);for(let i=-4;i<=4;i++)b.box([i*.22,.15,0],[.025,.012,2.08],C.stone);for(const z of [-1.15,1.15])b.box([0,.16,z],[1.2,.012,.045],C.gold);return b.asset('floor-panel','scifi');},
  door:()=>{const b=new Builder();for(const x of [-1.08,1.08])b.beveled([x,1.4,0],[.28,2.8,.35],C.stone,.04);b.beveled([0,2.7,0],[2.3,.3,.4],C.steel,.05);for(const x of [-.49,.49]){b.beveled([x,1.28,0],[.94,2.55,.18],C.steel,.07);b.box([x*.1,1.3,.12],[.025,2.22,.025],C.cyan);b.box([x,1.27,.1],[.75,.06,.045],C.dark);}b.box([0,2.72,.23],[.65,.07,.025],C.gold);return b.asset('door','scifi');},
  terminal:()=>{const b=new Builder();b.beveled([0,.09,0],[.85,.18,.65],C.dark,.04);b.loft([[0,.18,0,.27,.22],[0,.85,-.08,.22,.18],[0,1.11,-.08,.4,.22]],C.steel,4);b.beveled([0,1.28,-.06],[.93,.64,.24],C.dark,.035);b.box([0,1.3,.07],[.66,.36,.025],C.blue);for(let i=0;i<4;i++)b.box([-.08,1.4-i*.065,.086],[.4-(i%2)*.12,.016,.008],i%2?C.cyan:C.sky);b.box([.24,1.28,.09],[.075,.2,.01],C.gold);b.beveled([0,.98,.23],[.8,.09,.32],C.steel,.01);for(let i=0;i<6;i++)b.box([-.25+i*.1,1.03,.23],[.06,.018,.11],C.stone);return b.asset('terminal','scifi');},
  'relay-console':()=>{const b=new Builder();b.beveled([0,.16,0],[1.45,.32,.85],C.dark,.07);b.beveled([0,.65,0],[1.25,.7,.65],C.steel,.06);for(const x of [-.44,.44]){b.tube([x,.91,0],[x,1.68,0],.16,.16,C.stone,8);b.ring([x,1.09,0],.1,.18,.29,C.cyan,8);b.tube([x,1.65,0],[x,2.21,0],.025,.012,C.steel,5);}b.beveled([0,1.1,.28],[.47,.38,.18],C.dark,.035);b.box([0,1.12,.38],[.28,.2,.02],C.cyan);b.box([0,.48,.35],[.7,.12,.025],C.gold);return b.asset('relay-console','scifi');},
  generator:()=>{const b=new Builder();b.beveled([0,.13,0],[2.1,.26,1.5],C.dark,.05);for(const x of [-.68,.68])b.beveled([x,.67,0],[.35,1.15,1.25],C.steel,.08);b.tube([-.78,.9,0],[.78,.9,0],.51,.51,C.stone,12);for(const x of [-.5,-.25,0,.25,.5])b.tube([x-.04,.9,0],[x+.04,.9,0],.53,.53,x===0?C.cyan:C.dark,12);for(const z of [-.51,.51])b.tube([-.8,1.16,z],[.8,1.16,z],.035,.035,C.gold,5);b.beveled([.81,1.5,0],[.3,.38,.49],C.dark,.03);b.box([.82,1.53,.25],[.19,.16,.02],C.cyan);return b.asset('generator','scifi');},
  pipe:()=>{const b=new Builder();b.tube([0,.2,-1.2],[0,.2,.6],.16,.16,C.stone,9);b.tube([0,.2,.6],[0,.46,.9],.16,.16,C.stone,9);b.tube([0,.46,.9],[0,1.2,.9],.16,.16,C.stone,9);for(const z of [-1.1,-.3,.5])b.tube([0,.2,z-.04],[0,.2,z+.04],.2,.2,C.steel,9);b.ring([0,1.1,.9],.1,.22,.1,C.gold,9);return b.asset('pipe','scifi');},
  crate:()=>{const b=new Builder();b.beveled([0,.53,0],[1.1,1.06,1.1],C.steel,.11);for(const x of [-.35,.35])for(const z of [-.35,.35])b.beveled([x,.53,z],[.2,1.08,.2],C.stone,.04);for(const y of [.16,.9]){b.box([0,y,.405],[.8,.09,.05],C.gold);b.box([0,y,-.405],[.8,.09,.05],C.gold);}b.box([0,.54,.405],[.33,.24,.06],C.dark);b.box([0,.54,.44],[.16,.035,.015],C.cyan);return b.asset('crate','scifi');},
  light:()=>{const b=new Builder();b.beveled([0,.1,0],[.8,.2,.5],C.dark,.04);b.loft([[0,.2,0,.25,.14],[0,.42,0,.32,.2],[0,.51,0,.24,.14]],C.ivory,6);for(const x of [-.24,.24])b.box([x,.35,0],[.04,.34,.34],C.steel);return b.asset('light','scifi');},
  'hazard-panel':()=>{const b=new Builder();b.beveled([0,.035,0],[1.5,.07,.64],C.dark,.025);for(let i=0;i<7;i++){const x=-.57+i*.19;b.quad([x+.11,.076,.23],[x+.26,.076,.23],[x+.07,.076,-.23],[x-.08,.076,-.23],C.gold);}return b.asset('hazard-panel','scifi');},
  'weapon-rifle':()=>{const b=new Builder();b.beveled([0,0,0],[.19,.24,.8],C.steel,.035);b.beveled([0,.075,-.54],[.17,.15,.38],C.dark,.03);b.tube([0,.035,.3],[0,.035,.88],.056,.042,C.dark,8);b.tube([0,.035,.82],[0,.035,.94],.066,.066,C.stone,8);b.beveled([0,-.17,-.18],[.13,.31,.16],C.dark,.02);b.beveled([0,-.16,.15],[.15,.32,.21],C.steel,.025);b.box([0,.15,.02],[.1,.05,.55],C.dark);b.beveled([0,.21,.02],[.11,.12,.21],C.dark,.015);b.box([0,.215,.131],[.07,.04,.009],C.cyan);b.box([.1,.04,.03],[.015,.045,.17],C.gold);return b.asset('weapon-rifle','combat');},
  turret:()=>{const b=new Builder();for(let i=0;i<3;i++){const a=i*TAU/3;b.tube([0,.65,0],[Math.cos(a)*.63,.08,Math.sin(a)*.63],.055,.035,C.stone,6);b.beveled([Math.cos(a)*.63,.06,Math.sin(a)*.63],[.27,.12,.25],C.dark,.025);}b.tube([0,.29,0],[0,.95,0],.15,.11,C.steel,8);b.orb([0,1.06,0],[.43,.28,.34],C.steel,8,4);for(const x of [-.23,.23]){b.tube([x,1.08,.18],[x,1.08,.84],.055,.055,C.dark,7);b.tube([x,1.08,.8],[x,1.08,.91],.078,.078,C.stone,7);}b.box([0,1.14,.315],[.11,.065,.04],C.red);return b.asset('turret','combat');},
  projectile:()=>{const b=new Builder();b.tube([0,0,-.22],[0,0,.22],.035,.006,C.gold,5);b.orb([0,0,.12],[.045,.045,.08],C.ivory,5,3);return b.asset('projectile','combat');},
  'impact-star':()=>{const b=new Builder();for(let i=0;i<6;i++){const a=i*TAU/6;b.tube([0,0,0],[Math.cos(a)*.3,Math.sin(a)*.3,(i%2?1:-1)*.1],.04,.001,i%2?C.gold:C.ivory,4);}return b.asset('impact-star','combat');},
  'ruin-wall-tall':()=>{const b=new Builder();for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(!(y===4&&x===2))b.beveled([(x-1)*.82+(y%2)*.11,.34+y*.67,0],[.77,.62,.64],[C.stone,C.lightstone,C.wood][(x+y)%3],.065);b.tube([-.8,1.9,.36],[-.35,3.3,.28],.08,.025,C.bark,6);return b.asset('ruin-wall-tall','fantasy');},
  'ruin-wall-window':()=>{const b=new Builder();for(const x of [-1.4,1.4])for(let y=0;y<4;y++)b.beveled([x,.34+y*.66,0],[.72,.62,.62],y%2?C.stone:C.lightstone,.055);for(let x=-1;x<=1;x++)b.beveled([x*.72,2.58,0],[.68,.45,.62],x?C.stone:C.wood,.05);b.ring([0,.85,.02],.45,.7,.16,C.gold,12);return b.asset('ruin-wall-window','fantasy');},
  'arch-pointed':()=>{const b=new Builder();for(const x of [-1.25,1.25])b.loft([[x,0,0,.42,.42],[x,2.2,0,.31,.31],[x*.72,3.15,0,.18,.3],[0,3.8,0,.06,.24]],[C.stone,C.lightstone,C.stone],7);b.ring([0,2.05,0],1.02,1.42,.48,C.wood,14);return b.asset('arch-pointed','fantasy');},
  'arch-broken':()=>{const b=new Builder();for(let y=0;y<4;y++)b.beveled([-1.2,.33+y*.63,0],[.7,.58,.64],y%2?C.lightstone:C.stone,.06);for(let y=0;y<2;y++)b.beveled([1.2,.33+y*.63,0],[.7,.58,.64],y?C.stone:C.lightstone,.06);for(let i=0;i<4;i++)b.beveled([-.78+i*.42,2.35+i*.2,0],[.5,.38,.62],i%2?C.wood:C.stone,.05);b.orb([1.2,.16,.55],[.65,.25,.48],[C.stone,C.lightstone],6,3,91);return b.asset('arch-broken','fantasy');},
  stairs:()=>{const b=new Builder();for(let i=0;i<7;i++)b.beveled([0,.1+i*.2,-1.5+i*.45],[2.5,.2,.55],i%3===0?C.lightstone:C.stone,.035);for(const x of [-1.28,1.28])b.box([x,.75,0],[.16,1.5,3.8],C.wood);return b.asset('stairs','fantasy');},
  'stone-walkway':()=>{const b=new Builder();for(let i=0;i<8;i++)b.beveled([0,.16,(i-3.5)*.55],[2.45,.22,.52],i%3===0?C.lightstone:C.stone,.045);for(const x of [-1.05,1.05]){for(const z of [-1.85,0,1.85])b.loft([[x,0,z,.13,.13],[x,1,z,.09,.09]],C.wood,6);b.tube([x,.82,-2.05],[x,.82,2.05],.055,.055,C.gold,6);}return b.asset('stone-walkway','fantasy');},
  'sanctuary-grand':()=>{const b=new Builder();for(let i=0;i<4;i++)b.beveled([0,.1+i*.19,0],[5-i*.65,.2,3.9-i*.5],i%2?C.stone:C.lightstone,.055);for(const x of [-1.75,1.75])for(const z of [-1.2,1.2])b.loft([[x,.76,z,.34,.34],[x,3.1,z,.22,.22],[x,3.45,z,.48,.48]],[C.stone,C.wood,C.lightstone],8);b.loft([[0,.85,0,.6,.55],[0,2.05,0,.45,.4],[0,2.65,0,.06,.06]],[C.gold,C.ivory,C.cyan],8);b.ring([0,2.1,0],.65,1.18,.18,C.gold,14);return b.asset('sanctuary-grand','fantasy');},
  'beacon-brazier':()=>{const b=new Builder();b.loft([[0,0,0,.8,.8],[0,.18,0,.8,.8],[0,.42,0,.5,.5],[0,1.25,0,.34,.34]],C.stone,10);b.ring([0,1.18,0],.3,.72,.25,C.gold,12);for(let i=0;i<6;i++){const a=i*TAU/6;b.tube([Math.cos(a)*.5,1.3,Math.sin(a)*.5],[Math.cos(a)*.22,2.2+Math.sin(a*2)*.18,Math.sin(a)*.22],.08,.008,i%2?C.gold:C.ivory,5);}return b.asset('beacon-brazier','fantasy');},
  'tree-dead':()=>{const b=new Builder();b.tube([0,0,0],[.12,3.8,0],.32,.09,[C.bark,C.wood],7);for(const [x,y,z] of [[-1,2.7,.2],[.9,3.1,-.1],[-.65,3.55,-.4]]){b.tube([0,y-.7,0],[x,y,z],.1,.025,C.bark,6);b.tube([x,y,z],[x*1.35,y+.45,z*1.4],.04,.008,C.wood,5);}return b.asset('tree-dead','fantasy');},
  stump:()=>{const b=new Builder();b.loft([[0,0,0,.52,.47],[0,.64,0,.43,.4],[0,.75,0,.36,.34]],[C.bark,C.wood],9);for(let i=0;i<6;i++){const a=i*TAU/6;b.tube([0,.08,0],[Math.cos(a)*.82,.02,Math.sin(a)*.82],.12,.025,C.bark,5);}return b.asset('stump','fantasy');},
  'cliff-spire':()=>{const b=new Builder();b.loft([[0,0,0,1.65,1.35],[.25,1.2,-.1,1.4,1.1],[-.2,3,.1,.92,.78],[.15,5.2,0,.28,.36]],[C.stone,C.steel,C.lightstone,C.stone],7,.1);b.orb([-.8,.55,.5],[.8,.35,.65],C.stone,6,3,93);return b.asset('cliff-spire','fantasy');},
  'rope-fence':()=>{const b=new Builder();for(const x of [-1.8,0,1.8])b.loft([[x,0,0,.13,.13],[x,1.35,0,.09,.09],[x,1.55,0,.02,.02]],C.wood,7);for(let i=0;i<12;i++){const x=-1.8+i*.327,y=.92-.18*Math.sin(i/11*Math.PI);b.tube([x,y,0],[x+.327,.92-.18*Math.sin((i+1)/11*Math.PI),0],.035,.035,C.bark,5);}return b.asset('rope-fence','fantasy');},
  'corner-wall':()=>{const b=new Builder();b.beveled([0,1.5,0],[3,3,.32],C.steel,.06);b.beveled([-1.34,1.5,1.35],[.32,3,3],C.dark,.06);for(const y of [.25,2.75]){b.box([0,y,.18],[2.6,.07,.06],C.cyan);b.box([-1.52,y,1.35],[.06,.07,2.6],C.cyan);}return b.asset('corner-wall','scifi');},
  'doorway-frame':()=>{const b=new Builder();for(const x of [-1.45,1.45])b.beveled([x,1.55,0],[.38,3.1,.55],C.steel,.07);b.beveled([0,3.02,0],[3.25,.38,.6],C.dark,.07);for(const x of [-1.16,1.16])b.box([x,1.55,.31],[.08,2.5,.04],C.cyan);b.box([0,2.98,.34],[1.1,.08,.04],C.gold);return b.asset('doorway-frame','scifi');},
  'ceiling-beam':()=>{const b=new Builder();b.beveled([0,0,0],[4.2,.42,.5],C.dark,.065);for(const x of [-1.65,-.55,.55,1.65])b.loft([[x,-.18,0,.18,.2],[x,-.65,0,.08,.11]],C.steel,6);b.box([0,-.23,.28],[3.5,.055,.035],C.cyan);return b.asset('ceiling-beam','scifi');},
  railing:()=>{const b=new Builder();for(const x of [-2,-1,0,1,2])b.tube([x,0,0],[x,1.1,0],.055,.045,C.steel,6);for(const y of [.42,1.05])b.tube([-2.15,y,0],[2.15,y,0],.06,.06,y>1?C.gold:C.stone,7);return b.asset('railing','scifi');},
  'support-column':()=>{const b=new Builder();b.beveled([0,.13,0],[1.15,.26,1.15],C.dark,.05);b.loft([[0,.26,0,.43,.43],[0,2.8,0,.3,.3],[0,3.15,0,.56,.56]],[C.steel,C.stone,C.steel],8);for(const y of [.55,2.4])b.ring([0,y,0],.31,.5,.14,C.cyan,8);return b.asset('support-column','scifi');},
  'machine-large':()=>{const b=new Builder();b.beveled([0,.2,0],[3.2,.4,2.2],C.dark,.08);for(const x of [-1.05,1.05])b.loft([[x,.4,0,.55,.75],[x,2.2,0,.45,.65],[x,2.55,0,.3,.48]],C.steel,8);b.tube([-1,1.25,0],[1,1.25,0],.55,.55,C.stone,12);for(let i=-3;i<=3;i++)b.ring([i*.28,1.25,0],.44,.58,.08,i===0?C.cyan:C.dark,12);b.beveled([0,2.45,.55],[1.25,.55,.32],C.dark,.05);return b.asset('machine-large','scifi');},
  vent:()=>{const b=new Builder();b.beveled([0,1,0],[2,2,.28],C.dark,.05);b.ring([0,1,.16],.5,.84,.12,C.steel,14);for(let i=0;i<8;i++){const a=i*TAU/8;b.tube([0,1,.25],[Math.cos(a)*.68,1+Math.sin(a)*.68,.25],.08,.035,C.stone,5);}return b.asset('vent','scifi');},
  conduit:()=>{const b=new Builder();for(const x of [-.28,0,.28]){b.tube([x,0,0],[x,2.6,0],.07,.07,x===0?C.cyan:C.stone,7);for(const y of [.45,1.35,2.25])b.ring([x,y,0],.05,.11,.08,C.gold,7);}b.beveled([0,2.78,0],[.9,.35,.3],C.dark,.04);return b.asset('conduit','scifi');},
  'computer-bank':()=>{const b=new Builder();b.beveled([0,1.05,0],[2.8,2.1,.55],C.dark,.07);for(let i=-2;i<=2;i++){b.beveled([i*.5,1.35,.31],[.43,.55,.06],C.blue,.02);b.box([i*.5,1.35,.35],[.28,.025,.01],i%2?C.cyan:C.gold);}for(let i=-3;i<=3;i++)b.box([i*.33,.48,.32],[.2,.2,.04],C.steel);return b.asset('computer-bank','scifi');},
  'storage-rack':()=>{const b=new Builder();for(const x of [-1.2,1.2])b.box([x,1.45,0],[.14,2.9,.72],C.dark);for(const y of [.18,.92,1.66,2.4])b.box([0,y,0],[2.55,.12,.75],C.steel);for(let y=0;y<3;y++)for(let x=-1;x<=1;x++)b.beveled([x*.72,.5+y*.74,0],[.58,.5,.58],(x+y)%2?C.wood:C.stone,.05);return b.asset('storage-rack','scifi');},
  'blast-door':()=>{const b=new Builder();b.beveled([0,1.75,0],[3.8,3.5,.48],C.dark,.08);for(const x of [-1.25,0,1.25])b.beveled([x,1.75,.26],[1.15,3.05,.15],x===0?C.steel:C.stone,.05);for(const y of [.5,3])b.box([0,y,.36],[3.25,.1,.04],C.gold);b.ring([0,1.75,.4],.18,.45,.1,C.cyan,12);return b.asset('blast-door','scifi');},
  'weapon-sidearm':()=>{const b=new Builder();b.beveled([0,.03,0],[.18,.25,.55],C.steel,.035);b.tube([0,.06,.2],[0,.06,.58],.055,.043,C.dark,8);b.beveled([0,-.19,-.11],[.14,.38,.2],C.dark,.025);b.box([0,.18,.02],[.08,.045,.26],C.gold);b.box([.1,.04,.1],[.018,.04,.12],C.cyan);return b.asset('weapon-sidearm','combat');},
  barricade:()=>{const b=new Builder();for(const x of [-1.35,1.35])b.beveled([x,.72,0],[.35,1.44,.72],C.dark,.06);for(const y of [.4,1.05])b.beveled([0,y,0],[3,.42,.5],y>.5?C.steel:C.stone,.05);for(let i=-4;i<=4;i++)b.box([i*.3,1.07,.28],[.16,.08,.025],i%2?C.gold:C.dark);return b.asset('barricade','combat');},
  'ammo-crate':()=>{const b=new Builder();b.beveled([0,.38,0],[1.2,.76,.72],C.dark,.06);b.beveled([0,.77,0],[1.08,.12,.68],C.steel,.035);for(const x of [-.42,.42])b.box([x,.4,.38],[.12,.62,.04],C.gold);for(let i=-2;i<=2;i++)b.tube([i*.17,.82,-.14],[i*.17,.82,.14],.045,.045,C.stone,7);return b.asset('ammo-crate','combat');},
  hovercraft:()=>{const b=new Builder();b.loft([[0,.18,0,1.15,1.65],[0,.48,.08,1.02,1.35],[0,.72,-.18,.65,.8]],[C.dark,C.steel,C.blue],10);for(const x of [-.78,.78]){b.tube([x,.38,-.35],[x,.38,.72],.18,.13,C.stone,9);b.ring([x,.38,-.5],.16,.31,.15,C.cyan,10);}b.beveled([0,.86,-.2],[.82,.46,.72],C.dark,.06);b.box([0,.89,.18],[.54,.18,.035],C.cyan);for(const x of [-.58,.58])b.loft([[x,.52,.75,.13,.18],[x,.7,1.15,.04,.05]],C.gold,6);return b.asset('hovercraft','vehicles');},
};
for(let i=1;i<=5;i++) MODEL_FACTORIES['rock-'+i]=()=>{const b=new Builder(),r=random(100+i),w=.55+r()*.65,h=.4+r()*.7,d=.5+r()*.5;b.orb([0,h*.68,0],[w,h,d],[C.stone,C.steel,C.lightstone],5+i%3,3+i%2,512+i);if(i%2)b.orb([w*.24,h*1.24,0],[w*.48,.1,d*.44],[C.evergreen,C.green],6,2,600+i);const a=b.asset('rock-'+i,'fantasy');const min=a.bounds.min[1];for(let j=1;j<a.positions.length;j+=3)a.positions[j]=round(a.positions[j]-min);a.bounds.max[1]=round(a.bounds.max[1]-min);a.bounds.min[1]=0;return a;};

// One authored landmark silhouette per shipped game. These are deliberately
// asymmetric, readable at gameplay distance, and generated from repository-owned
// geometry so every library title can carry a recognizable visual signature.
const HERO_GAMES=['foglight','signal-relay','arsenal-run','silent-sector','power-grid','relic-frontier','relic-island','forest-range','iron-arena','dungeon-descent','npc-puzzle-adventure','opus-arena','power-station','relic-runner-2','sentinel-maze','signal-zero','survival-arena-2','survival-arena-3','textured-adventure','valley-run','painted-wilds','assembly-line','blacksite','moving-temple','shifting-facility','skyway-trial','survival-arena','temple-switch-puzzle'];
function heroLandmark(id,index){
  const b=new Builder(),r=random(hash('hero:'+id)),fantasy=/fog|relic|forest|dungeon|temple|painted|valley|npc|textured/.test(id),arena=/arsenal|iron|opus|survival/.test(id);
  const accent=[C.gold,C.cyan,C.red,C.lime][index%4],body=fantasy?C.stone:(arena?C.dark:C.steel),secondary=fantasy?C.wood:C.dark;
  const sides=7+(index%4),height=2.8+(index%5)*.38,spread=1.05+(index%3)*.22;
  b.beveled([0,.16,0],[2.7+(index%2)*.45,.32,2.25+(index%3)*.22],secondary,.08);
  b.ring([0,.38,0],.65,1.18,.16,accent,12+(index%3)*2);
  if(fantasy){
    b.loft([[0,.32,0,.68,.62],[.12*(index%2?1:-1),height*.58,0,.38,.34],[-.18,height,0,.08,.12]],[body,C.lightstone,accent],sides);
    for(let i=0;i<3+(index%2);i++){const a=i*TAU/(3+(index%2))+.25;b.loft([[Math.cos(a)*spread,.28,Math.sin(a)*spread,.23,.23],[Math.cos(a)*spread,height*.68,Math.sin(a)*spread,.11,.11],[Math.cos(a)*spread*.75,height*.84,Math.sin(a)*spread*.75,.035,.035]],[C.wood,body,accent],6);}
    b.ring([0,height*.72,0],.42,.78,.12,accent,11);
  }else{
    b.loft([[0,.32,0,.74,.62],[0,height*.42,0,.54,.44],[.18*(index%2?1:-1),height*.78,0,.3,.26],[0,height,0,.08,.08]],[body,C.steel,accent],sides);
    for(const side of [-1,1]){const x=side*spread;b.beveled([x,height*.38,0],[.34,height*.62,.62],side<0?body:secondary,.06);b.tube([x,height*.68,0],[side*(spread+.55+r()*.35),height*.9,.15*(index%3-1)],.11,.035,accent,7);}
    b.ring([0,height*.58,.06],.46,.86,.14,accent,12);
    if(arena)for(let i=0;i<4;i++){const a=i*TAU/4+.3;b.tube([0,height*.28,0],[Math.cos(a)*1.42,height*.18,Math.sin(a)*1.42],.09,.045,i%2?accent:C.stone,6);}
    else for(const y of [.8,1.35])b.box([0,y,.58],[1.08,.1,.05],y<1?accent:C.gold);
  }
  b.orb([.2*(index%3-1),height+.16,0],[.22,.22,.22],[accent,C.ivory],7,4,800+index);
  return b.asset('hero-'+id,fantasy?'fantasy':(arena?'combat':'scifi'));
}
HERO_GAMES.forEach((id,index)=>{MODEL_FACTORIES['hero-'+id]=()=>heroLandmark(id,index);});

function crc32(buffer) { let c=0xffffffff;for(const b of buffer){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0; }
function png(width,height,fn) {
  const raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++){for(let x=0;x<width;x++){const c=fn(x,y);const i=y*(width*4+1)+1+x*4;for(let z=0;z<3;z++)raw[i+z]=Math.max(0,Math.min(255,Math.round(c[z])));raw[i+3]=255;}}
  function chunk(name,data){const n=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([n,data])));return Buffer.concat([len,n,data,crc]);}
  const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const TEXTURE_KEYS=['palette','ground-moss','ground-sand','stone','metal','hazard','grass','dirt-path','moss-stone','clean-stone','worn-stone','dark-ruin-stone','bark','foliage','relic-emissive','clean-metal','worn-metal','floor-panel','dark-wall','machinery','terminal-surface','grate','emissive-strip','arena-floor','arena-wall','arena-cover','arena-weapon'];
function textureBuffer(key) {
  if(key==='palette')return png(64,16,(x,y)=>rgb(PALETTE[Math.floor(x/8)+Math.floor(y/8)*8]));
  const rnd=random(hash(key)),noise=Array.from({length:128*128},()=>rnd()),clamp=n=>Math.max(0,Math.min(255,n));
  return png(128,128,(x,y)=>{const n=noise[y*128+x],s=Math.sin(x*.16)*Math.cos(y*.11),grain=(n-.5)*18;
    if(key==='ground-moss'){const v=12*s+grain;return[59+v,82+v*1.1,63+v*.6];}
    if(key==='ground-sand'){const v=9*s+grain;return[154+v,138+v,108+v*.7];}
    if(key==='stone'){const seam=y%32<2||(x+(Math.floor(y/32)%2)*32)%64<2,v=grain+6*s-(seam?24:0);return[110+v,122+v,122+v];}
    if(key==='metal'){const edge=x<3||y<3||x>124||y>124,bolt=([12,115].some(a=>Math.hypot(x-a,y-12)<3)||[12,115].some(a=>Math.hypot(x-a,y-115)<3)),v=(edge?-22:bolt?40:grain*.3)+(y%4===0?3:0);return[69+v,83+v,96+v];}
    if(key==='hazard'){const bright=(x+y)%48<24,border=y<12||y>115;return border?[40,48,58]:bright?[215+grain,166+grain,72+grain]:[44+grain,51+grain,56+grain];}
    const palettes={
      grass:[48,91,53], 'dirt-path':[118,91,62], 'moss-stone':[74,91,75], 'clean-stone':[151,155,148], 'worn-stone':[113,113,104], 'dark-ruin-stone':[55,62,64], bark:[92,61,39], foliage:[38,91,55], 'relic-emissive':[56,151,157],
      'clean-metal':[105,126,139], 'worn-metal':[75,86,91], 'floor-panel':[66,79,88], 'dark-wall':[36,46,57], machinery:[70,88,101], 'terminal-surface':[38,94,112], grate:[56,64,69], 'emissive-strip':[44,194,211],
      'arena-floor':[78,72,67], 'arena-wall':[89,82,74], 'arena-cover':[69,76,84], 'arena-weapon':[76,88,103]
    };
    if(palettes[key]){const base=palettes[key],seam=/stone|metal|panel|wall|floor|grate/.test(key)&&(x%32<2||y%32<2),stripe=/emissive|hazard/.test(key)&&((x+y)%32<12),rings=key==='bark'&&x%19<4,leaf=key==='foliage'&&Math.sin(x*.32+y*.21)>0.45;const v=grain+(seam?-22:0)+(rings?-14:0)+(leaf?18:0)+(stripe?45:0)+9*s;return base.map((c,i)=>clamp(c+v*(i===1&&/grass|moss|foliage/.test(key)?1.2:1)));}
    throw new Error('Unknown texture '+key);
  });
}
const AUDIO_KEYS=['ui-select','pickup','interaction','door','beacon','damage','fire','impact','alert','attack','win','lose','ambient-fantasy','ambient-facility','ambient-arena','footstep','guardian-call','relay-pulse','combat-rifle','stealth-bed','power-offline','power-online','temple-wind','forest-bed'];
function audioBuffer(key) {
  const sampleRate=22050,durations={'ui-select':.12,pickup:.55,interaction:.35,door:1.1,beacon:2,damage:.3,fire:.24,impact:.22,alert:.8,attack:.5,win:2.1,lose:1.5,'ambient-fantasy':8,'ambient-facility':8,'ambient-arena':8,footstep:.2,'guardian-call':1.6,'relay-pulse':1.15,'combat-rifle':.3,'stealth-bed':8,'power-offline':8,'power-online':8,'temple-wind':8,'forest-bed':8};
  const duration=durations[key];if(!duration)throw new Error('Unknown audio '+key);
  const count=Math.round(duration*sampleRate),data=Buffer.alloc(count*2),rnd=random(hash(key)),tone=(f,t)=>Math.sin(TAU*f*t),env=(t,decay=6)=>Math.min(1,t/.012)*Math.exp(-t*decay);let low=0;
  for(let i=0;i<count;i++){const t=i/sampleRate,p=t/duration,n=rnd()*2-1;low=low*.975+n*.025;let v=0;
    switch(key){
      case'ui-select':v=tone(880,t)*env(t,30)*.3;break;
      case'pickup':v=(tone(660,t)+.55*tone(990,t)+.25*tone(1320,t))*env(t,7)*.24;break;
      case'interaction':v=(tone(420,t)+.5*tone(630,t))*env(t,13)*.26;break;
      case'door':v=(low*3+tone(73+65*p,t)*.14+tone(146,t)*.1)*Math.sin(Math.PI*p)*.45+(t>.94?n*env(t-.94,60)*.2:0);break;
      case'beacon':v=(tone(220,t)*.35+tone(440,t)*.28+tone(659.25,t)*.25+tone(880,t)*.15)*Math.sin(Math.PI*Math.min(1,t/.45)/2)*Math.exp(-1.6*t)*.55;break;
      case'damage':v=(n*.35+tone(92-40*p,t)) *env(t,16)*.45;break;
      case'fire':v=(n*.72+tone(62,t)*.75+tone(130-70*p,t)*.3)*env(t,31)*.55;break;
      case'impact':v=(n*.6+tone(173,t)*.5+tone(811,t)*.1)*env(t,34)*.46;break;
      case'alert':v=(tone(p<.45?660:880,t)+.18*tone(1320,t))*Math.sin(Math.PI*p)*.23;break;
      case'attack':v=(low*2.5+tone(140-85*p,t)*.6+n*.15)*Math.sin(Math.PI*p)*.5;break;
      case'win':{const f=[261.626,329.628,391.995,523.251];for(let k=0;k<4;k++){const q=t-k*.19;if(q>0)v+=(tone(f[k],q)+.25*tone(f[k]*2,q))*env(q,2.8)*.2;}break;}
      case'lose':v=(tone(196-45*p,t)*.5+tone(233-55*p,t)*.3+tone(98-20*p,t)*.2)*Math.sin(Math.PI*Math.min(1,p*4)/2)*(1-p)*.45;break;
      case'footstep':v=(low*5+n*.13+tone(85,t)*.2)*env(t,29)*.55;break;
      case'ambient-fantasy':{const breeze=low*(.7+.3*tone(.125,t));v=breeze*.6+tone(110,t)*.032+tone(165,t)*.022+tone(220,t)*.016;const chirp=((t+1.2)%3.1);if(chirp<.18)v+=tone(1750+Math.sin(chirp*32)*360,t)*Math.sin(chirp/.18*Math.PI)*.055;break;}
      case'ambient-facility':v=tone(55,t)*.055+tone(110,t)*.018+tone(165,t)*.012+low*.15+tone(440,t)*(.006+.004*tone(.25,t));break;
      case'ambient-arena':v=tone(48,t)*.04+tone(96,t)*.027+low*.3+tone(192,t)*.007;break;
      case'guardian-call':v=(tone(74-18*p,t)*.48+tone(111-24*p,t)*.25+low*.8)*Math.sin(Math.PI*p)*.55;break;
      case'relay-pulse':v=(tone(330+220*p,t)*.3+tone(660+110*p,t)*.16+low*.1)*Math.sin(Math.PI*p)*.5;break;
      case'combat-rifle':v=(n*.85+tone(54,t)*.8+tone(170-90*p,t)*.25)*env(t,23)*.62;break;
      case'stealth-bed':v=tone(42,t)*.035+tone(84,t)*.018+low*.12+tone(540,t)*(.004+.004*tone(.13,t));break;
      case'power-offline':v=tone(36,t)*.045+low*.2+tone(71,t)*.015;break;
      case'power-online':v=tone(55,t)*.06+tone(110,t)*.027+tone(220,t)*.012+low*.12+tone(720,t)*(.006+.005*tone(.3,t));break;
      case'temple-wind':v=low*(.35+.15*tone(.09,t))+tone(92,t)*.015+tone(184,t)*.008;break;
      case'forest-bed':{v=low*.24+tone(130,t)*.012;const q=(t+.7)%2.7;if(q<.15)v+=tone(1450+420*Math.sin(q*35),t)*Math.sin(q/.15*Math.PI)*.045;break;}
    }
    // Every clip fades at both edges; ambience uses a short crossfade-safe tail.
    const fade=Math.min(1,t/.006,(duration-t)/.02);data.writeInt16LE(Math.round(Math.max(-.92,Math.min(.92,v*fade))*32767),i*2);
  }
  const header=Buffer.alloc(44);header.write('RIFF',0);header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(sampleRate,24);header.writeUInt32LE(sampleRate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);return Buffer.concat([header,data]);
}
const meshes=new Map(),textures=new Map(),audio=new Map();
const copy=o=>JSON.parse(JSON.stringify(o));
function getMesh(key) {if(!MODEL_FACTORIES[key])throw new Error('Unknown showcase mesh '+key);if(!meshes.has(key))meshes.set(key,MODEL_FACTORIES[key]());return copy(meshes.get(key));}
function getTexture(key) {if(!TEXTURE_KEYS.includes(key))throw new Error('Unknown showcase texture '+key);if(!textures.has(key))textures.set(key,{id:'showcase-'+key,name:key,dataURL:'data:image/png;base64,'+textureBuffer(key).toString('base64'),sourceFilename:key+'.png',folder:'Showcase / textures',tags:['original','showcase']});return copy(textures.get(key));}
function getAudio(key) {if(!AUDIO_KEYS.includes(key))throw new Error('Unknown showcase audio '+key);if(!audio.has(key))audio.set(key,{id:'showcase-'+key,name:key,dataURL:'data:audio/wav;base64,'+audioBuffer(key).toString('base64'),sourceFilename:key+'.wav',folder:'Showcase / audio',tags:['original','showcase']});return copy(audio.get(key));}
function install(project,selection={}) {
  project.assets ||= [];project.textures ||= [];project.audio ||= [];
  const put=(list,value)=>{const i=list.findIndex(a=>a.id===value.id);if(i<0)list.push(value);else list[i]=value;};
  for(const key of selection.meshes||[])put(project.assets,getMesh(key));
  for(const key of new Set([...(selection.textures||[]),...((selection.meshes||[]).length?['palette']:[])]))put(project.textures,getTexture(key));
  for(const key of selection.audio||[])put(project.audio,getAudio(key));
  return project;
}
function generate() {
  const manifest={version:1,source:'tools/showcase-assets.js',license:'MIT; see repository LICENSE',original:true,coordinateSystem:'Y up; +Z forward; metres. Most props have ground origin Y=0. Drone and rifle are centered.',meshes:[],textures:[],audio:[]};
  for(const key of Object.keys(MODEL_FACTORIES)){const a=getMesh(key),family=a.folder.split(' / ')[1],relative=family+'/'+key+'.mesh.json',target=path.join(ROOT,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(a));manifest.meshes.push({key,id:a.id,file:relative,vertices:a.positions.length/3,triangles:a.indices.length/3,type:a.type,bounds:a.bounds,textureAssetId:a.textureAssetId});}
  for(const key of TEXTURE_KEYS){const relative='textures/'+key+'.png',target=path.join(ROOT,relative),buffer=textureBuffer(key);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,buffer);manifest.textures.push({key,id:'showcase-'+key,file:relative,bytes:buffer.length});}
  for(const key of AUDIO_KEYS){const relative='audio/'+key+'.wav',target=path.join(ROOT,relative),buffer=audioBuffer(key);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,buffer);manifest.audio.push({key,id:'showcase-'+key,file:relative,bytes:buffer.length,seconds:(buffer.length-44)/44100});}
  fs.writeFileSync(path.join(ROOT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
module.exports={getMesh,getTexture,getAudio,install,generate,meshKeys:Object.keys(MODEL_FACTORIES),textureKeys:TEXTURE_KEYS,audioKeys:AUDIO_KEYS};
if(require.main===module){const m=generate();console.log(`Showcase kit: ${m.meshes.length} original meshes, ${m.textures.length} PNG textures, ${m.audio.length} WAV clips.`);console.log(`Mesh triangles: ${m.meshes.reduce((n,a)=>n+a.triangles,0)}. Audio bytes: ${m.audio.reduce((n,a)=>n+a.bytes,0)}.`);}
