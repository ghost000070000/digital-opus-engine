'use strict';

// Focused Featured-promotion content pass. It extends the existing original
// showcase kit and edits only the seven nominated candidates plus five
// internal blockers. Re-running is idempotent: promo-* objects are replaced.
const fs=require('fs'),path=require('path'),vm=require('vm');
const kit=require('./showcase-assets');
const ROOT=path.resolve(__dirname,'..');
const ctx={window:{},Float32Array,Uint16Array,Uint32Array,Uint8Array,DataView,ArrayBuffer,TextDecoder};
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'dist/opus-engine.js'),'utf8'),ctx);
const Opus=ctx.window.Opus;
let serial=0;
const ids=['foglight','signal-relay','arsenal-run','silent-sector','power-grid','moving-temple','forest-range','opus-arena','survival-arena','survival-arena-2','survival-arena-3','valley-run'];
const allTextures=kit.textureKeys.filter(k=>k!=='palette');
const allAudio=['guardian-call','relay-pulse','combat-rifle','stealth-bed','power-offline','power-online','temple-wind','forest-bed'];
const selections={
  foglight:{textures:['worn-stone','dark-ruin-stone','dirt-path','moss-stone','grass','bark','foliage','relic-emissive'],audio:['guardian-call','beacon','ambient-fantasy']},
  'signal-relay':{textures:['floor-panel','dark-wall','clean-metal','terminal-surface','emissive-strip'],audio:['relay-pulse','combat-rifle','ambient-facility']},
  'arsenal-run':{textures:['arena-floor','arena-wall','arena-cover','arena-weapon','hazard'],audio:['combat-rifle','ambient-arena']},
  'silent-sector':{textures:['floor-panel','dark-wall','worn-metal','terminal-surface','emissive-strip'],audio:['stealth-bed','alert']},
  'power-grid':{textures:['floor-panel','dark-wall','machinery','terminal-surface','emissive-strip'],audio:['power-offline','power-online']},
  'moving-temple':{textures:['worn-stone','dark-ruin-stone','relic-emissive'],audio:['temple-wind']},
  'forest-range':{textures:['grass','dirt-path','moss-stone','bark','foliage'],audio:['forest-bed']},
  'opus-arena':{textures:['arena-floor','arena-wall','arena-cover'],audio:['ambient-arena']},
  'survival-arena':{textures:['arena-floor','relic-emissive'],audio:['ambient-arena']},
  'survival-arena-2':{textures:['arena-floor','dark-ruin-stone'],audio:['temple-wind']},
  'survival-arena-3':{textures:['floor-panel','emissive-strip'],audio:['power-online']},
  'valley-run':{textures:['grass','dirt-path','moss-stone'],audio:['forest-bed']}
};

function cube(l,name,p,s,color,extra={}){const o={kind:'cube',id:`promo-${++serial}`,name,position:p,scale:s,color,rotationY:0,mesh:'cube',behaviors:[],solid:false,...extra};l.objects.push(o);return o;}
function mesh(p,l,key,pos,scale=1,name=key,extra={}){kit.install(p,{meshes:[key]});const a=kit.getMesh(key);return cube(l,name,pos,Array.isArray(scale)?scale:[scale,scale,scale],[1,1,1],{mesh:'asset',assetId:a.id,textureAssetId:a.textureAssetId,...extra});}
function light(l,pos,color,intensity=1.5,range=10,name='Promo light'){l.objects.push({kind:'light',id:`promo-light-${++serial}`,name,position:pos,options:{lightType:'point',position:pos,color,intensity,range,enabled:true}});}
function sampleGround(l,x,z){const t=l.objects.find(o=>o.kind==='terrain');if(!t)return 0;const pos=t.options.position||[0,0,0],o={...t.options};delete o.position;return Opus.Terrain.sampleHeight(x-pos[0],z-pos[2],o)+pos[1];}
function surface(o,texture,color,uv=[2,2]){o.textureAssetId='showcase-'+texture;o.color=color;o.uvScale=uv;}
function environment(l,opts){l.environment={...(l.environment||{}),...opts,shadows:{enabled:true,resolution:1024,distance:45,bias:.0025,...(l.environment?.shadows||{}),...(opts.shadows||{})}};}
function prep(p,l){l.objects=l.objects.filter(o=>!String(o.id||'').startsWith('promo-'));p.meta.version='1.2.0';const screen=l.ui&&l.ui.startScreen;if(screen&&screen.howToPlay){for(const sentence of ['The sanctuary now lies beyond the woodland ridge; each beacon reveals the next landmark.','The tall amber arches mark every checkpoint and the sanctuary crowns the final ridge.']){while(screen.howToPlay.split(sentence).length>2)screen.howToPlay=screen.howToPlay.replace(' '+sentence,'');}}}
function floorAndWalls(l,floorTex,wallTex){for(const o of l.objects){if(o.kind!=='cube')continue;const n=o.name||'';if(/Floor|Platform|Plaza|Walkway|Causeway|Court/.test(n))surface(o,floorTex,[.72,.75,.72],[Math.max(1,(o.scale?.[0]||2)/4),Math.max(1,(o.scale?.[2]||2)/4)]);else if(/Wall|Divider|Cover|Gate/.test(n)&&o.mesh==='cube')surface(o,wallTex,[.72,.75,.78],[2,2]);}}

function foglight(p,l){
  floorAndWalls(l,'worn-stone','dark-ruin-stone');environment(l,{skyTop:[.08,.18,.24],skyHorizon:[.44,.6,.55],groundColor:[.18,.26,.2],sunColor:[1,.76,.48],fogDensity:.019});
  l.ambientAudio={audioAssetId:'showcase-ambient-fantasy',volume:.13};l.playerSettings.playBounds={minX:-24,maxX:24,minZ:-5,maxZ:142};
  const cause=l.objects.find(o=>o.name==='Ancient causeway');if(cause){cause.position[2]=69;cause.scale[2]=144;surface(cause,'dirt-path',[.61,.63,.56],[3,18]);}
  // Extend the existing compact route into three differently composed acts.
  for(const [z,key,rot] of [[3,'arch-pointed',0],[28,'arch-broken',0],[52,'ruin-wall-window',Math.PI/2],[78,'stone-walkway',0],[104,'ruin-wall-tall',Math.PI/2],[128,'arch-pointed',0]])mesh(p,l,key,[0,.2,z],key==='stone-walkway'?[1.6,1,1.5]:1.15,'Route landmark',{rotationY:rot});
  for(const [x,z,key,s] of [[-9,18,'cliff-spire',1.6],[10,42,'tree-dead',1.2],[-11,62,'cliff-spire',1.8],[9,88,'tree-oak',1.3],[-10,112,'tree-dead',1.5],[0,134,'sanctuary-grand',2.2]])mesh(p,l,key,[x,sampleGround(l,x,z),z],s,'Vale silhouette');
  for(const z of [12,36,60,84,108,124])for(const x of [-5.5,5.5])mesh(p,l,(z/12)%2?'rope-fence':'broken-wall',[x,.1,z],[.75,.75,.75],'Causeway boundary',{rotationY:Math.PI/2});
  for(const [x,z] of [[-8,10],[8,24],[-9,38],[10,56],[-10,73],[9,92],[-8,109],[8,123]]){mesh(p,l,['tree-pine','tree-oak','tree-birch'][(z/10|0)%3],[x,sampleGround(l,x,z),z],.9,'Layered canopy');mesh(p,l,'stump',[x*.72,sampleGround(l,x*.72,z+2),z+2],.8,'Ground detail');}
  for(const z of [21,68,112]){mesh(p,l,'beacon-brazier',[0,.25,z],1.15,'Beacon focal');light(l,[0,3,z],[1,.48,.12],2.8,13,'Beacon glow');}
  light(l,[0,4,136],[.35,.9,1],3.2,22,'Sanctuary glow');
  l.ui.startScreen.subtitle='Carry light through a layered twilight vale, awaken three beacons, face the guardian and reach the high sanctuary.';
  const routeHint='The sanctuary now lies beyond the woodland ridge; each beacon reveals the next landmark.';
  if(!l.ui.startScreen.howToPlay.includes(routeHint))l.ui.startScreen.howToPlay+=' '+routeHint;
}

function facilityShell(p,l,theme){
  floorAndWalls(l,theme==='arena'?'arena-floor':'floor-panel',theme==='arena'?'arena-wall':'dark-wall');
  const f=l.objects.find(o=>o.name==='Floor');if(!f)return;
  const [cx,,cz]=f.position,[w,,d]=f.scale;
  for(let x=cx-w/2+5;x<cx+w/2-3;x+=8){mesh(p,l,'ceiling-beam',[x,4.45,cz],[1.55,1,1], 'Ceiling rhythm',{rotationY:Math.PI/2});for(const side of [-1,1])light(l,[x,3.5,cz+side*(d/2-1.4)],theme==='arena'?[1,.38,.1]:[.12,.72,1],1.25,8);}
  for(const x of [cx-w/2+3,cx+w/2-3])for(const z of [cz-d/2+2,cz+d/2-2])mesh(p,l,'support-column',[x,0,z],1,'Structural support');
}
function signal(p,l){facilityShell(p,l,'facility');environment(l,{skyTop:[.05,.1,.16],skyHorizon:[.18,.29,.39],groundColor:[.15,.18,.22],sunColor:[.58,.78,1],fogDensity:.008});l.ambientAudio={audioAssetId:'showcase-ambient-facility',volume:.16};
  for(const [x,z,key,r] of [[-31,0,'doorway-frame',Math.PI/2],[-25,-6,'storage-rack',0],[-17,5,'computer-bank',Math.PI],[-9,-6,'machine-large',0],[-1,6,'vent',Math.PI],[8,-5,'computer-bank',0],[17,5,'machine-large',Math.PI],[26,-6,'storage-rack',0],[37,0,'blast-door',Math.PI/2]])mesh(p,l,key,[x,0,z],key==='machine-large'?1.2:1,'Facility zone',{rotationY:r,solid:/storage|machine/.test(key)});
  for(const x of [-22,-6,13,29]){mesh(p,l,'doorway-frame',[x,0,0],.9,'Zone threshold',{rotationY:Math.PI/2});mesh(p,l,'conduit',[x,0,-8.8],1,'Relay conduit');}
  l.playerSettings.equipmentDefs?.forEach(d=>{d.assetId='showcase-weapon-sidearm';d.scale=.55;d.weapon={...(d.weapon||{}),fireAudioAssetId:'showcase-combat-rifle'};});kit.install(p,{meshes:['weapon-sidearm']});
  for(const o of l.objects.filter(o=>/Console/.test(o.name||'')))o.behaviors.unshift({trigger:'interact',action:'sound',params:{mode:'asset',audioAssetId:'showcase-relay-pulse',volume:.65}});
}
function arsenal(p,l){facilityShell(p,l,'arena');environment(l,{skyTop:[.16,.08,.045],skyHorizon:[.48,.23,.11],groundColor:[.26,.18,.13],sunColor:[1,.65,.32],fogDensity:.006});l.ambientAudio={audioAssetId:'showcase-ambient-arena',volume:.22};
  mesh(p,l,'machine-large',[0,0,0],1.7,'Central reactor',{solid:true});for(const [x,z,r] of [[-14,8,0],[14,8,Math.PI],[-14,-5,0],[14,-5,Math.PI],[0,-11,Math.PI/2]])mesh(p,l,'barricade',[x,0,z],1.3,'Combat barricade',{rotationY:r,solid:true});
  for(const [x,z] of [[-19,12],[19,12],[-19,-12],[19,-12]])mesh(p,l,'ammo-crate',[x,0,z],1,'Utility cache',{solid:true});for(const z of [8,0,-8]){mesh(p,l,'railing',[-8,0,z],1,'Lane railing',{rotationY:Math.PI/2});mesh(p,l,'railing',[8,0,z],1,'Lane railing',{rotationY:Math.PI/2});}
  kit.install(p,{meshes:['weapon-sidearm','weapon-rifle']});l.playerSettings.equipmentDefs?.forEach((d,i)=>{d.assetId=i?'showcase-weapon-rifle':'showcase-weapon-sidearm';d.scale=i?.46:.62;d.weapon={...(d.weapon||{}),fireAudioAssetId:'showcase-combat-rifle'};});
  light(l,[0,3,0],[1,.32,.08],2.8,16,'Reactor key light');light(l,[0,2.5,-15],[.1,1,.55],2.4,10,'Extraction key light');
}
function silent(p,l){facilityShell(p,l,'facility');environment(l,{skyTop:[.035,.055,.09],skyHorizon:[.1,.18,.25],groundColor:[.09,.12,.15],sunColor:[.35,.5,.68],fogDensity:.014});l.ambientAudio={audioAssetId:'showcase-stealth-bed',volume:.2};
  for(const [x,z,key,r] of [[-29,5,'doorway-frame',Math.PI/2],[-23,-6,'storage-rack',0],[-15,6,'vent',Math.PI],[-8,-6,'computer-bank',0],[2,6,'machine-large',Math.PI],[12,-6,'storage-rack',0],[21,6,'computer-bank',Math.PI],[29,0,'blast-door',Math.PI/2]])mesh(p,l,key,[x,0,z],key==='machine-large'?1.1:1,'Stealth landmark',{rotationY:r,solid:/storage|machine/.test(key)});
  for(const [x,z,c] of [[-23,0,[.08,.35,.8]],[-10,0,[.08,.35,.8]],[4,0,[.7,.12,.08]],[17,0,[.7,.12,.08]],[28,0,[.08,.8,.35]]]){cube(l,'Security light zone',[x,.025,z],[5,.035,3],c,{unlit:true,emissiveColor:c,emissiveIntensity:.28});light(l,[x,2.6,z],c,1.5,6);}
  // Existing patrol state remains authoritative; color-coded route thresholds make it legible.
  l.ui.startScreen.subtitle='Infiltrate a layered security station through lit patrol zones and shadowed service lanes.';
}
function power(p,l){facilityShell(p,l,'facility');environment(l,{skyTop:[.045,.07,.1],skyHorizon:[.17,.25,.3],groundColor:[.11,.14,.17],sunColor:[.52,.65,.75],fogDensity:.01});l.ambientAudio={audioAssetId:'showcase-power-offline',volume:.22};
  for(const [x,z,key,r] of [[-17,6,'storage-rack',0],[-12,-6,'computer-bank',Math.PI],[-5,6,'machine-large',0],[5,-6,'machine-large',Math.PI],[12,6,'computer-bank',0],[18,0,'blast-door',Math.PI/2]])mesh(p,l,key,[x,0,z],key==='machine-large'?1.25:1,'Power zone',{rotationY:r,solid:/storage|machine/.test(key)});
  for(const z of [-7,7])for(const x of [-15,-8,7,14])mesh(p,l,'conduit',[x,0,z],.9,'Power conduit',{rotationY:z>0?Math.PI:0});
  for(const x of [-12,-4,4,12])cube(l,'Power flow strip',[x,.03,0],[6,.035,.09],[.05,.4,.45],{unlit:true,emissiveColor:[.05,.75,.9],emissiveIntensity:.35});
  const gen=l.objects.find(o=>o.name&&/Generator/i.test(o.name));if(gen)gen.behaviors.unshift({trigger:'interact',action:'sound',params:{mode:'asset',audioAssetId:'showcase-power-online',volume:.7}});
  light(l,[-14,2,0],[1,.45,.08],2.2,9,'Offline storage light');light(l,[8,3,0],[.08,.72,1],2.5,15,'Machine hall light');light(l,[18,2,0],[.1,1,.45],2.4,9,'Online exit light');
}
function moving(p,l){floorAndWalls(l,'worn-stone','dark-ruin-stone');environment(l,{skyTop:[.08,.1,.2],skyHorizon:[.36,.31,.45],groundColor:[.14,.14,.2],sunColor:[1,.63,.33],fogDensity:.022});l.ambientAudio={audioAssetId:'showcase-temple-wind',volume:.24};
  for(const [x,y,z,key,s] of [[-3,0,-6,'arch-broken',1.3],[4,0,5,'ruin-wall-window',1.2],[10,0,-6,'cliff-spire',1.6],[16,0,5,'ruin-wall-tall',1.4],[20,6,0,'sanctuary-grand',1.7],[25,0,-7,'cliff-spire',2]])mesh(p,l,key,[x,y,z],s,'Temple silhouette');
  for(const x of [0,6,12,18,24]){mesh(p,l,'pillar',[x,-2,-8],2.2,'Depth pillar');mesh(p,l,'pillar',[x,-2,8],2.2,'Depth pillar');}
  mesh(p,l,'stairs',[17,.35,0],1.1,'Summit stair',{rotationY:Math.PI/2,solid:true});light(l,[20,9,0],[1,.42,.12],3.2,18,'Summit shrine light');
}
function forest(p,l){environment(l,{skyTop:[.14,.31,.32],skyHorizon:[.54,.68,.52],groundColor:[.12,.28,.17],sunColor:[1,.82,.51],fogDensity:.012});l.ambientAudio={audioAssetId:'showcase-forest-bed',volume:.2};
  const route=[[-10,-10],[-5,-4],[0,1],[6,6],[10,11]];for(let i=0;i<route.length;i++){const [x,z]=route[i],y=sampleGround(l,x,z);mesh(p,l,i===2?'arch-broken':i===4?'ruin-wall-window':'stone-walkway',[x,y,z],i===4?1.35:.9,'Forest waypoint',{rotationY:i*.5});light(l,[x,y+2.4,z],[1,.55,.16],1.5,7,'Waystone glow');}
  for(const [x,z,key,s] of [[-13,8,'cliff-spire',1.4],[13,-7,'cliff-spire',1.5],[-11,-2,'tree-dead',1.3],[11,2,'tree-oak',1.45],[-6,13,'stump',1.2],[6,-13,'tree-dead',1.15]])mesh(p,l,key,[x,sampleGround(l,x,z),z],s,'Forest landmark');
  // Clear a chase-camera corridor through the authored route without changing camera code.
  for(const o of l.objects)if(o.assetId&&/tree|bush|grass/.test(o.assetId)){const near=route.some(([x,z])=>Math.hypot(o.position[0]-x,o.position[2]-z)<2.7);if(near)o.position[0]+=o.position[0]>=0?3.2:-3.2;}
}

function opus(p,l){facilityShell(p,l,'arena');environment(l,{skyTop:[.12,.07,.14],skyHorizon:[.4,.16,.24],groundColor:[.2,.12,.18],sunColor:[1,.5,.4],fogDensity:.008});for(const [x,z] of [[-7,-7],[7,-7],[-7,7],[7,7]])mesh(p,l,'barricade',[x,0,z],1,'Arena cover',{rotationY:(x+z)%2?0:Math.PI/2,solid:true});for(const o of l.objects.filter(o=>o.ai)){o.health={max:42,current:42};if(o.spawner)o.spawner.interval=Math.max(2.4,o.spawner.interval||0);}}
function survival(p,l,n){kit.install(p,{meshes:['hovercraft',n===1?'beacon-brazier':n===2?'cliff-spire':'machine-large']});l.playerSettings.visual={mode:'skinned',assetId:'showcase-hovercraft',scale:.72,rotationOffsetY:0,positionOffset:{x:0,y:-.36,z:0},clipMap:{},blendTime:.15};environment(l,n===1?{skyTop:[.16,.26,.4],skyHorizon:[.65,.52,.28],groundColor:[.24,.28,.34],sunColor:[1,.78,.4],fogDensity:.008}:n===2?{skyTop:[.12,.08,.2],skyHorizon:[.42,.2,.42],groundColor:[.18,.12,.22],sunColor:[.72,.4,1],fogDensity:.018}:{skyTop:[.04,.13,.17],skyHorizon:[.12,.4,.45],groundColor:[.08,.2,.22],sunColor:[.25,1,.9],fogDensity:.013});
  const focal=n===1?'beacon-brazier':n===2?'cliff-spire':'machine-large';mesh(p,l,focal,[0,0,0],n===1?1.3:n===2?1.6:1.1,n===1?'Relic dais':n===2?'Storm shard':'Defense transmitter');for(let i=0;i<8;i++){const a=i*TAU/8,r=7+(i%2);mesh(p,l,n===1?'ruin-wall-window':n===2?'barricade':'conduit',[Math.cos(a)*r,0,Math.sin(a)*r],.65,'Arena identity',{rotationY:-a,solid:i%2===0});}light(l,[0,3,0],n===1?[1,.55,.12]:n===2?[.6,.2,1]:[.1,1,.85],2.8,14);}
const TAU=Math.PI*2;
function valley(p,l){environment(l,{skyTop:[.18,.36,.45],skyHorizon:[.68,.71,.55],groundColor:[.28,.34,.2],sunColor:[1,.84,.55],fogDensity:.01});l.ambientAudio={audioAssetId:'showcase-forest-bed',volume:.17};for(const [x,z,s] of [[-11,-18,1.8],[10,-8,2],[-10,4,1.7],[11,15,2.1]])mesh(p,l,'cliff-spire',[x,sampleGround(l,x,z),z],s,'Valley wall');for(const z of [-15,-3,10,22]){mesh(p,l,'arch-pointed',[0,sampleGround(l,0,z),z],.9,'Ridge landmark');light(l,[0,sampleGround(l,0,z)+3,z],[1,.58,.12],1.6,9);}mesh(p,l,'sanctuary-grand',[0,sampleGround(l,0,25),25],1.5,'Far ridge goal');const hint='The tall amber arches mark every checkpoint and the sanctuary crowns the final ridge.';if(!l.ui.startScreen.howToPlay.includes(hint))l.ui.startScreen.howToPlay+=' '+hint;}

for(const id of ids){serial=0;const file=path.join(ROOT,'games',id+'.json'),p=JSON.parse(fs.readFileSync(file)),l=p.levels[0];prep(p,l);kit.install(p,selections[id]);if(id==='foglight')foglight(p,l);else if(id==='signal-relay')signal(p,l);else if(id==='arsenal-run')arsenal(p,l);else if(id==='silent-sector')silent(p,l);else if(id==='power-grid')power(p,l);else if(id==='moving-temple')moving(p,l);else if(id==='forest-range')forest(p,l);else if(id==='opus-arena')opus(p,l);else if(id==='survival-arena')survival(p,l,1);else if(id==='survival-arena-2')survival(p,l,2);else if(id==='survival-arena-3')survival(p,l,3);else if(id==='valley-run')valley(p,l);
  // Preserve qualified physical roles when reconstructing presentation props;
  // this local constructor must not restore accidental pass-through defaults.
  require('./real-demo-masonry-assembly').repair(p);
  require('./real-demo-architectural-assemblies').repair(p);
  require('./real-demo-stone-roles').repair(p);
  require('./real-demo-machinery-roles').repair(p);
  require('./real-demo-actor-policy').apply(p,id);
  require('./real-demo-gate-visuals').repair(p,id);
  require('./real-demo-extraction-frame').repair(p,id);
  require('./real-demo-platform-decoration').repair(p,id);
  require('./real-demo-character-body').repair(p);
  // Standalone files embed assets, so retain only referenced material. This
  // prevents the differentiated ambience bank from being copied into every
  // game while preserving exact portability.
  const body=JSON.stringify({...p,assets:undefined,textures:undefined,audio:undefined});
  p.assets=(p.assets||[]).filter(a=>body.includes('"'+a.id+'"'));
  const assetBody=JSON.stringify(p.assets);
  p.textures=(p.textures||[]).filter(a=>(body+assetBody).includes('"'+a.id+'"'));
  p.audio=(p.audio||[]).filter(a=>body.includes('"'+a.id+'"'));
  fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');console.log(id,l.objects.length,'objects',p.assets.length,'meshes',p.textures.length,'textures',p.audio.length,'audio');}
