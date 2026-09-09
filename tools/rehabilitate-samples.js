/* Original presentation pass for the 21 bounded samples. No catalog promotion.
 * Uses the read-only baseline captured before rehabilitation, preserving ids,
 * mechanical graphs, terrain edits and prefab relationships by construction.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const kit = require('./showcase-assets');
const clone = x => JSON.parse(JSON.stringify(x));
const groundMath = vm.createContext({Math});
vm.runInContext(fs.readFileSync(path.join(root,'engine/src/18-noise.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'engine/src/19-terrain.js'),'utf8')+'\nthis.height=islandHeight;',groundMath);
const SPECS = {
  'forest-range': ['Forest Range','fantasy','A woodland trail through three groves. Follow the amber waystones to the old lookout.','Explore the three groves and reach the lookout.','Woodland exploration and reusable vegetation','The range is yours','You reached the lookout above the three groves.'],
  'painted-wilds': ['Painted Wilds','fantasy','A short landscape walk through moss, ochre and slate. Follow the three survey stones.','Visit all three survey stones.','Terrain painting and blended ground materials','Survey complete','The three landscape studies are recorded.'],
  'iron-arena': ['Iron Arena','arena','Three armored sentries hold the forge courtyard. Keep moving and use the pillars for cover.','Defeat all three sentries.','Skeletal combat animation and hitscan combat','Forge secured','All three sentries have been disabled.'],
  'dungeon-descent': ['Dungeon Descent','fantasy','Two distant seals hold the stone gate shut. Light both seals and pass through the eastern arch.','Activate the two seals, then reach the eastern exit.','Flags, switches and a gated objective','Dungeon escaped','Both seals are lit and the passage is open.'],
  'npc-puzzle-adventure': ['The Sanctum Key','fantasy','An old sailor carries the key to a forgotten sanctuary. Speak with him, then unlock the northern door.','Speak to the sailor, use the door console, and enter the sanctum.','Branching dialogue, inventory and level transitions','The sanctum opens','The sailor\'s key has revealed the inner shrine.'],
  'opus-arena': ['Opus Arena','arena','Hold the blue courtyard against eight approaching guardians. Face each target before firing.','Defeat eight guardians.','Projectile weapons and bounded enemy spawning','Courtyard cleared','All eight guardians have fallen.'],
  'power-station': ['Power Station','scifi','The turbine is silent. Collect three fuel cells, speak to the engineer, and restart the machine.','Find three cells, unlock the shed, then activate the turbine.','Inventory, dialogue and animated machinery','Power restored','The turbine is turning again.'],
  'relic-runner-2': ['Relic Runner 2','fantasy','Reach the amber ridge relic. Use the low ramp, keep clear of the guardian, and claim the high ground.','Climb the ramp and claim the ridge relic.','Animated traversal, ramps and checkpoint recovery','Relic claimed','You reached the ridge and claimed its relic.'],
  'sentinel-maze': ['Sentinel Maze','abstract','A watchful guardian patrols a slate labyrinth. Follow the amber route around the walls to the exit.','Reach the amber arch beyond the maze.','Waypoint navigation around solid obstacles','Maze escaped','You passed the sentinel and reached the exit.'],
  'signal-zero': ['Signal Zero','scifi','Trace a silent outpost to its deep relay. Reach the cyan console to save your progress and descend.','Reach the outpost console, then restore the deep relay.','Menus, saving and a two-level sequence','Signal restored','Both relays are online.'],
  'survival-arena-2': ['Survival Arena 2','arena','A hovercraft endurance run on a tidal ring. Two waves arrive; keep moving for thirty-two seconds.','Survive both waves for 32 seconds.','Timed wave sequencing and hovercraft survival','Waves survived','The hunters have lost your trail.'],
  'survival-arena-3': ['Survival Arena 3','arena','Twenty seconds on the copper island. Hunter drones enter from the central transmitter.','Evade the hunter drones for 20 seconds.','Capped runtime spawning and timed survival','Transmission complete','You held out until the transmitter completed its call.'],
  'textured-adventure': ['Textured Adventure','fantasy','Three amber relics rest among violet ruins. Collect them, avoid the red fissure, and restore the shrine.','Collect three relics and enter the shrine.','Textured objects, pickups and an objective gate','Shrine restored','The three relics are home.'],
  'valley-run': ['Valley Run','fantasy','Cross a narrow valley and climb the stepping stones to the far ridge. The amber camp marks your checkpoint.','Reach the far ridge using the raised stepping stones.','Terrain traversal, jumping and checkpoint recovery','Valley crossed','You reached the far ridge.'],
  'assembly-line': ['Assembly Line','scifi','Three fabrication bays assemble drones in real time. Clear space with your blaster, then inspect the control desk.','Observe the three active bays, then use the inspection console.','Runtime prefab assemblies and reusable spawners','Inspection complete','All three fabrication bays are operational.'],
  'blacksite': ['Blacksite','scifi','Take the access card, open the security door, and cross the checkpoint into the core.','Recover the card, enter the core, and reach extraction.','Access gates, checkpoints and two-level facility play','Core secured','You crossed the blacksite and reached extraction.'],
  'moving-temple': ['Moving Temple','abstract','Ride the crossing slab, activate the amber lift, and jump to the high shrine.','Cross the moving slab, use the lift switch, and reach the high shrine.','Moving platforms, elevators and player carry','Temple ascended','You reached the shrine above the moving stonework.'],
  'shifting-facility': ['Shifting Facility','scifi','Walk the three machinery bays. Test the swing door and follow the amber lane to the far inspection station.','Pass the entry scanner, try the swing door, and reach the far console.','Hierarchy transforms and shaped collision','Inspection complete','You crossed the machinery floor.'],
  'skyway-trial': ['Skyway Trial','abstract','Five suspended platforms rise above a quiet blue void. Commit to each jump and reach the amber summit.','Jump across five platforms to the summit.','Platform jumps and a fall condition','Skyway complete','You reached the highest platform.'],
  'survival-arena': ['Survival Arena','arena','Four amber orbs, three lives, and three hunters. Sweep the courtyard before they surround you.','Collect all four orbs before losing three lives.','Counter-driven pickups and contact hazards','Orbs recovered','All four orbs are secure.'],
  'temple-switch-puzzle': ['Temple Switch Puzzle','fantasy','Two amber seals power an ancient gateway. Step onto each seal and cross the open gate.','Activate both seals, then enter the northern shrine.','Two-switch logic and a gated goal','Gateway opened','The two seals have opened the shrine.'],
};
const PALETTES = {
 fantasy:{skyTop:[.12,.21,.31],skyHorizon:[.52,.66,.66],groundColor:[.16,.20,.14],sunColor:[1,.9,.70],fogDensity:.015},
 scifi:{skyTop:[.025,.05,.09],skyHorizon:[.18,.27,.32],groundColor:[.11,.16,.19],sunColor:[.68,.83,1],fogDensity:.014},
 arena:{skyTop:[.075,.095,.15],skyHorizon:[.38,.32,.28],groundColor:[.18,.16,.15],sunColor:[1,.78,.53],fogDensity:.012},
 abstract:{skyTop:[.19,.34,.45],skyHorizon:[.67,.78,.80],groundColor:[.24,.27,.28],sunColor:[1,.93,.73],fogDensity:.011},
};
function terrainY(level,x,z) {
 const t=level.objects.find(o=>o.kind==='terrain');
 if(!t)return 0;
 const p=t.options.position||[0,0,0];
 return groundMath.height(x-p[0],z-p[2],t.options)+p[1];
}
function distanceToRoute(x,z,points){let best=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));}return best;}
let serial=0, meshes, textures, audios, project;
function use(key){meshes.add(key);return kit.getMesh(key);}
function cube(level,name,pos,scale,color,extra={}) {
 const o={id:'rehab-'+(++serial),name,kind:'cube',mesh:'cube',position:pos,scale,color,rotationY:0,behaviors:[],solid:false,...extra};
 level.objects.push(o);return o;
}
function prop(level,key,pos,scale=1,name=key,extra={}){
 const a=use(key);return cube(level,name,pos,Array.isArray(scale)?scale:[scale,scale,scale],[1,1,1],{mesh:'asset',assetId:a.id,textureAssetId:a.textureAssetId,...extra});
}
function place(level,key,x,z,scale=1,name=key,extra={}) {return prop(level,key,[x,terrainY(level,x,z)-.06,z],scale,name,extra);}
function model(o,key,scale=1){const a=use(key);o.mesh='asset';o.assetId=a.id;o.textureAssetId=a.textureAssetId;o.color=[1,1,1];o.scale=Array.isArray(scale)?scale:[scale,scale,scale];return o;}
function tex(o,key){textures.add(key);o.textureAssetId=kit.getTexture(key).id;o.color=key==='metal'?[.80,.86,.90]:key==='stone'?[.80,.84,.76]:o.color;o.uvScale=[Math.max(1,(o.scale?.[0]||1)/2),Math.max(1,(o.scale?.[2]||1)/2)];}
function light(level,pos,color=[1,.65,.24],range=9,intensity=1.1){level.objects.push({kind:'light',id:'rehab-'+(++serial),name:'Practical light',options:{lightType:'point',position:pos,color,range,intensity}});}
function sound(key,trigger='interact',volume=.5){audios.add(key);return{trigger,action:'sound',params:{mode:'asset',audioAssetId:kit.getAudio(key).id,volume}};}
function act(action,params={},trigger='interact'){return{trigger,action,params};}
function hidden(o){o.visible=false;o.hiddenInPlay=true;if(o.kind==='cube')o.isTrigger=true;}
function by(level,id){return level.objects.find(o=>o.id===id);}
function ground(o,level,offset=0){o.position[1]=terrainY(level,o.position[0],o.position[2])+offset;}
function floor(level,cx,cz,w,d,color=[.20,.26,.28]) {const o=cube(level,'Inset floor',[cx,-.18,cz],[w,.36,d],color,{solid:true});tex(o,'metal');return o;}
function marker(level,x,z,name,scale=.6){const o=place(level,'beacon',x,z,scale,name);light(level,[x,o.position[1]+1.7,z],[1,.62,.18],6,.9);return o;}
function trail(level,points,key='rock-2') {for(let i=0;i<points.length;i++){const [x,z]=points[i];place(level,key,x,z,.35,'Trail edging');}}
function woodland(level,coords,key='tree-pine'){coords.forEach(([x,z,s],i)=>place(level,i%3===0?'tree-birch':key,x,z,s||.8,'Woodland canopy'));}
function ruins(level,coords){coords.forEach(([x,z,r=0],i)=>place(level,i%3===0?'broken-wall':'pillar',x,z,.9,'Ruined masonry',{rotationY:r}));}
function rim(level,cx,cz,r,count=10,key='pillar'){for(let i=0;i<count;i++){let a=i*Math.PI*2/count;place(level,key,cx+Math.sin(a)*r,cz+Math.cos(a)*r,key==='pillar'?.7:1,'Perimeter landmark',{rotationY:a});}}
function bay(level,x,z,key='generator',color=[.15,.75,.85]){
 prop(level,key,[x,0,z],.9,'Fabrication machinery');
 light(level,[x,2.8,z],color,8,1.3);
 for(const dx of [-2,2])prop(level,'wall-panel',[x+dx,0,z+1.8],.75,'Bay bulkhead');
}
function end(level,pos,label='Inspection console',condition){const o=prop(level,'terminal',pos,.8,label);o.behaviors=[sound('interaction')];
 if(condition)o.behaviors.push({trigger:'interact',action:'graph',graph:{nodes:[{id:'cond',...condition},{id:'win',type:'win'}],edges:[{from:'start',to:'win',kind:'next'},{from:'cond',to:'win',kind:'gate'}]}});
 else o.behaviors.push(act('win'));
 return o;
}
function graphWin(level,counter,target){const o=cube(level,'Progress monitor',[0,1,0],[120,50,120],[0,0,0],{isTrigger:true,triggerRepeat:true});hidden(o);o.behaviors=[{trigger:'stay',action:'graph',graph:{nodes:[{id:'condition',type:'counterReaches',counter,target},{id:'win',type:'win'}],edges:[{from:'start',to:'win',kind:'next'},{from:'condition',to:'win',kind:'gate'}]}}];}
function identity(p,id,s){
 p.format='digital-opus-project';p.version=3;p.startLevelIndex=p.startLevelIndex||0;p.currentLevelIndex=0;
 p.meta={...(p.meta||{}),title:s[0],description:s[2],version:'1.1.0',purpose:s[4]};
 p.levels.forEach((l,idx)=>{
  if(!l.id)l.id='rehab-level-'+idx;
  if(p.levels.length===1)l.name=s[0];
  l.description=s[2];l.environment={...(l.environment||{}),...PALETTES[s[1]],lightDir:{x:-.5,y:-1,z:-.35},shadows:{enabled:true,resolution:1024,distance:34,bias:.003}};
  l.playerSettings=l.playerSettings||{controllerType:id==='survival-arena'?'hovercraft':'thirdperson',moveSpeed:6,acceleration:28,collisionRadius:.5,maxHealth:100,jumpEnabled:false,gravity:20,jumpSpeed:8};
  const ps=l.playerSettings;
  if(ps.controllerType==='thirdperson')ps.jumpEnabled=true;
  ps.initialYaw=id==='moving-temple'?Math.PI/2:id==='forest-range'?Math.PI/3:0;
  if(ps.controllerType==='thirdperson'||ps.controllerType==='topdown') {use('ranger');ps.visual={...(ps.visual||{}),mode:'skinned',assetId:kit.getMesh('ranger').id,textureAssetId:kit.getMesh('ranger').textureAssetId,scale:1,positionOffset:{x:0,y:-.55,z:0},rotationOffsetY:0,clipMap:{idle:0,walk:1,run:2,jump:3,fall:4,attack:5,death:6},blendTime:.15};}
  const interact=(p.inputActionMap?.interact||'KeyF').replace('Key','');
  const attack=p.inputActionMap?.attack==='Mouse0'?'Left Click':(p.inputActionMap?.attack||'KeyQ').replace('Key','');
  let controls=ps.controllerType==='hovercraft'?'WASD / arrows steer and accelerate; Space boosts; Escape pauses.':ps.controllerType==='topdown'?'WASD / arrows move; '+interact+' interacts; Escape pauses.':'WASD / arrows move; '+(ps.controllerType==='firstperson'?'mouse looks; ':'')+(ps.jumpEnabled||ps.controllerType==='firstperson'?'Space jumps; ':'')+(ps.weapon?.enabled?attack+' attacks; ':'')+interact+' interacts; Escape pauses.';
  if(id==='skyway-trial')controls=controls.replace('Space jumps;','Space jumps; C careful steps;');
  l.ui=l.ui||{};l.ui.startScreen={...(l.ui.startScreen||{}),enabled:idx===0,title:s[0],subtitle:s[2],buttonText:ps.controllerType==='hovercraft'?'Launch':'Begin',howToPlay:s[3]+'\n\n'+controls,controlsHint:controls,credits:'Original models, textures and sound by Digital Opus Engine. '+s[4]+'.'};
  l.ui.winTitle=s[5];l.ui.winMessage=s[6];l.ui.loseTitle='Try again';l.ui.loseMessage='Restart from the menu and try a different route.';
  l.ui.hudElements=(l.ui.hudElements||[]).filter(h=>h.kind!=='label');
  l.ui.hudElements.forEach((h,i)=>{if(h.counter&&!h.counterName)h.counterName=h.counter;h.offsetY=h.offsetY||i*36;h.visible=true;});
  if(!l.ui.hudElements.some(h=>h.kind==='objective'))l.ui.hudElements.push({id:'rehab-objective',kind:'label',anchor:'top-left',offsetX:0,offsetY:80,text:s[3],visible:true});
  const ambient=s[1]==='scifi'?'ambient-facility':s[1]==='arena'?'ambient-arena':'ambient-fantasy';audios.add(ambient);l.ambientAudio={audioAssetId:kit.getAudio(ambient).id,volume:.23};
 });
}
function polishRecords(p,s){
 const recs=p.levels.flatMap(l=>l.objects).concat((p.prefabs||[]).flatMap(f=>[...(f.records||[]),...(f.record?[f.record]:[])]));
 for(const o of recs){
  if(o.isSpawnPoint||o.isWaypoint||/^(WP\d+|GameInit|GameManager|SurvivalTimer)$/i.test(o.name||'')||(o.scale?.[0]>=25&&o.isTrigger))hidden(o);
  if(o.kind==='cube'&&o.mesh==='cube'&&o.solid&&!o.isSpawnPoint)tex(o,s[1]==='fantasy'||s[1]==='abstract'?'stone':'metal');
  if(o.ai||o.tags?.includes('enemy')){
   const sy=o.scale?.[1]||1,scale=Math.max(...(o.scale||[1,1,1]));
   if(o.assetId==='showcase-ranger')o.collider={shape:'sphere',offset:{x:0,y:.9*sy,z:0},radius:.85*scale};
   else if(o.assetId==='showcase-guardian')o.collider={shape:'sphere',offset:{x:0,y:1.1*sy,z:0},radius:.9*scale};
   else if(o.assetId==='showcase-drone')o.collider={shape:'sphere',offset:{x:0,y:0,z:0},radius:.8*scale};
  }
  const bs=o.behaviors||[];
  const oldSounds=bs.filter(b=>b.action==='sound');for(const b of oldSounds){const bkey=bs.some(c=>c.action==='win')?'win':bs.some(c=>c.action==='giveItem'||c.action==='incrementCounter')?'pickup':'interaction';Object.assign(b,sound(bkey,b.trigger));}
  const feedback=bs.find(b=>['giveItem','incrementCounter','setFlagTrue','setCheckpoint','playAnimation','win'].includes(b.action));
  if(feedback&&!oldSounds.length)bs.push(sound(feedback.action==='win'?'win':feedback.action==='giveItem'||feedback.action==='incrementCounter'?'pickup':feedback.action==='setCheckpoint'?'beacon':'interaction',feedback.trigger));
 }
 // An editor Trigger is always invisible in Play. Preserve its one-shot box
 // volume, but give gameplay objects a separate mesh that the player can read.
 // Interact actors must themselves stay visible for closest-interactable lookup.
 for(const l of p.levels){
  const visualIds=new Map();
  for(const o of l.objects.slice()){
   if(o.behaviors?.some(b=>b.trigger==='interact')){delete o.isTrigger;delete o.visible;delete o.hiddenInPlay;continue;}
   if(!o.isTrigger||o.hiddenInPlay||o.mesh!=='asset')continue;
   const visual=clone(o);visual.id='rehab-'+(++serial);visual.name=(o.name||'Objective')+' visual';visual.behaviors=[];visual.solid=false;delete visual.isTrigger;delete visual.triggerRepeat;delete visual.visible;delete visual.hiddenInPlay;
   l.objects.push(visual);
   visualIds.set(o.id,visual.id);
   // Display scale must not shrink a trigger below the player-center height.
   // Use the actual terrain/platform surface under the prop for its volume.
   let floorY=terrainY(l,o.position[0],o.position[2]);
   for(const platform of l.objects){if(!platform.solid||platform.kind!=='cube'||platform===o)continue;const pos=platform.position,sz=platform.scale;if(Math.abs(pos[0]-o.position[0])<=sz[0]/2&&Math.abs(pos[2]-o.position[2])<=sz[2]/2){const top=pos[1]+sz[1]/2;if(top<=visual.position[1]+1)floorY=Math.max(floorY,top);}}
   o.position=[o.position[0],floorY+.65,o.position[2]];o.scale=[Math.max(1.8,o.scale[0]),2.2,Math.max(1.8,o.scale[2])];
   for(const b of (o.behaviors||[]).slice()){if(b.action==='setVisibility'&&b.params?.visible===false)o.behaviors.push(act('setVisibility',{targetId:visual.id,visible:false},b.trigger));else if(b.action==='destroyObject')o.behaviors.push(act('destroyObject',{targetId:visual.id},b.trigger));}
  }
  for(const o of l.objects)for(const b of o.behaviors||[]){
   if(b.action!=='graph'||!b.graph)continue;
   const g=b.graph;
   for(const node of g.nodes.slice()){
    if(!['setVisibility','destroyObject','changeColor'].includes(node.type))continue;
    const target=visualIds.get(node.targetId||o.id);if(!target)continue;
    const extra={...node,id:node.id+'-visual',targetId:target};g.nodes.push(extra);
    const following=g.edges.filter(e=>e.from===node.id&&e.kind==='next');for(const e of following)e.from=extra.id;
    for(const e of g.edges.filter(e=>e.to===node.id&&e.kind==='gate'))g.edges.push({...e,to:extra.id});
    g.edges.push({from:node.id,to:extra.id,kind:'next'});
   }
  }
 }
}
function rehab(id,p){const s=SPECS[id];const l=p.levels[0];
 if(id==='forest-range'){
  l.name='Forest Range';for(const o of l.objects){if(o.kind!=='cube'||o.isSpawnPoint)continue;if(o.id==='obj395'){model(o,'rock-4',1.2);ground(o,l);continue;}const n=parseInt(o.id.replace(/\D/g,''))||0;
   const [x,,z]=o.position,route=distanceToRoute(x,z,[[-11,-5],[-8,-3],[0,1],[8,4],[10,7]])<1.7;
   const key=route?'grass':n%10<4?(x<-4?'tree-pine':x<4?'tree-oak':'tree-birch'):n%10<7?'bush':n%10<9?'grass':'rock-'+(Math.floor(n/10)%5+1);
   model(o,key,(o.scale?.[0]||1)*(route?.32:.7));ground(o,l);}
  for(const f of p.prefabs||[])model(f.record,f.name==='PineTree'?'tree-pine':f.name==='OakTree'?'tree-oak':'rock-3',1);
  const spawn=by(l,'obj394');spawn.position=[-8,terrainY(l,-8,-6)+.65,-6];
  marker(l,-8,-3,'Pine grove');marker(l,0,1,'Oak grove');marker(l,8,4,'Birch grove');const goal=place(l,'shrine',10,7,.8,'Woodland lookout');goal.isTrigger=true;goal.triggerRepeat=false;goal.behaviors=[act('win',{},'enter'),sound('win','enter')];
  trail(l,[[-10,-3],[-6,-2],[-4,-1],[0,0],[3,2],[6,3],[9,5]]);
 }else if(id==='painted-wilds'){
  model(by(l,'obj395'),'rock-5',1.5);ground(by(l,'obj395'),l);
  woodland(l,[[-10,5,.7],[-8,7,.8],[6,-7,.8],[10,3,.6],[11,7,.8]],'tree-birch');
  const points=[[-5,-4],[5,-2],[7,6]];points.forEach(([x,z],i)=>{const o=marker(l,x,z,'Survey stone '+(i+1),.55);o.isTrigger=true;o.triggerRepeat=false;o.behaviors=[act('incrementCounter',{counter:'survey',amount:1},'enter'),act('message',{text:'Landscape study '+(i+1)+' recorded.'},'enter'),sound('beacon','enter')];});
  graphWin(l,'survey',3);l.ui.hudElements.push({kind:'counter',counterName:'survey',text:'Studies: {value} / 3',anchor:'top-right',visible:true});
  trail(l,[[-11,-1],[-8,-3],[-2,-4],[1,-3],[4,-1],[6,2],[7,4]]);
 }else if(id==='iron-arena'){
  by(l,'obj418').position=[0,.6,-10];for(const [i,o] of l.objects.filter(o=>o.tags?.includes('enemy')).entries()){model(o,'ranger',1.2);o.position=[(i-1)*6,.03,7];o.ai.base=[...o.position];o.ai.attackEnabled=false;o.ai.attackRadius=2;o.ai.attackDamage=8;o.ai.attackCooldown=1.4;o.behaviors.push(act('damagePlayer',{amount:8,cooldown:1.4},'stay'));o.triggerRepeat=true;}
  for(const x of [-9,-4,4,9])for(const z of [-3,3])prop(l,'pillar',[x,0,z],.8,'Forge buttress');
  for(const x of [-11,11]){bay(l,x,9,'generator',[1,.37,.12]);prop(l,'crate',[x,0,-7],1.2,'Ammunition cover');}
  graphWin(l,'kills',3);l.ui.hudElements.push({kind:'health',anchor:'bottom-left',visible:true});
  l.objects.find(o=>o.name==='Progress monitor').behaviors.push({trigger:'stay',action:'graph',graph:{nodes:[{id:'dead',type:'healthAtMost',target:0},{id:'lose',type:'lose'}],edges:[{from:'start',to:'lose',kind:'next'},{from:'dead',to:'lose',kind:'gate'}]}});
  light(l,[0,3,-6],[.65,.8,1],17,1.5);light(l,[0,4,8],[1,.68,.36],17,1.6);
 }else if(id==='blacksite'){
  for(const f of p.prefabs||[]){model(f.record,'drone',1);for(const o of f.records||[])if(o.id===f.rootId)model(o,'drone',1);else model(o,'light',.25);}
  for(const level of p.levels){for(const o of level.objects){if(o.isSpawnPoint)continue;if(o.behaviors?.some(b=>b.action==='giveItem')){model(o,'relic',.4);o.name='Access card';}else if(o.behaviors?.some(b=>b.action==='showDialogue')){model(o,'terminal',.7);o.name='Security terminal';ground(o,level);}else if(o.behaviors?.some(b=>b.action==='nextLevel'||b.action==='win')){model(o,'beacon',.65);o.name='Extraction signal';} }
   const core=level!==l;for(const z of core?[-3,0,3]:[-1,3,7,11])for(const x of core?[-4,4]:[-6,6]){prop(level,'wall-panel',[x,0,z],[.6,1,1], 'Security bulkhead',{rotationY:Math.PI/2});light(level,[x,2.8,z],[.16,.65,.9],5,.7);}if(!core){prop(level,'generator',[-5,0,12],.9,'Power unit');prop(level,'crate',[4.8,0,6],.8,'Security crate');} }
 }else if(id==='signal-zero'){
  for(const [i,level] of p.levels.entries()){
   const spawn=level.objects.find(o=>o.isSpawnPoint);spawn.position[2]=-spawn.position[2];
   for(const o of level.objects){if(o.isSpawnPoint)continue;if(o.name==='Relay Console'||o.name==='Signal Core'){o.position[2]=-o.position[2];model(o,i===0?'relay-console':'beacon',.85);o.position[1]=0;o.spin=0;}
    if(o.ai){model(o,'ranger',1);o.position[1]=0;o.position[2]=2;o.ai.base=[...o.position];}
    if(o.kind==='camera'&&o.options.mode==='fixed'){o.options.position=[0,6,-12];o.options.lookAtTargetId=spawn.id;}
   }
   for(const x of [-10,10])for(const z of [-8,-2,4,10])prop(level,'wall-panel',[x,0,z],[1,1.1,1],'Outpost wall',{rotationY:Math.PI/2});
   for(const x of [-7,7]){bay(level,x,8,i===0?'terminal':'generator');prop(level,'crate',[x,0,-3],1,'Relay cover');}
   for(let z=-5;z<=6;z+=3)prop(level,'hazard-panel',[0,.015,z],[.6,.5,.6],'Signal route');
   light(level,[0,4,5],i===0?[.1,.7,.95]:[1,.63,.18],15,1.4);
  }
 }else if(id==='assembly-line'){
  const t=l.objects.find(o=>o.kind==='terrain');t.options.radius=70;t.options.amplitude=.001;t.options.islandBase=-.12;
  floor(l,0,0,34,34);by(l,'obj45').position=[0,.7,-5];
  for(const f of p.prefabs||[]){model(f.record,'drone',.8);for(const o of f.records||[])if(o.id===f.rootId)model(o,'drone',.8);else model(o,'light',.22);}
  for(const [x,z]of[[8,8],[-8,8],[0,-10]]){bay(l,x,z,'generator');prop(l,'hazard-panel',[x,.02,z],[1.3,1,1.3],'Fabrication pad');}
  for(const x of[-15,15])for(const z of[-12,-6,0,6,12])prop(l,'wall-panel',[x,0,z],1,'Assembly wall',{rotationY:Math.PI/2});
  end(l,[0,0,12]);
 }else if(id==='shifting-facility'){
  const root=by(l,'obj383');model(root,'pillar',.7);root.name='Swing door pivot';root.animationClips=[{name:'swing',duration:2,loop:'pingpong',tracks:{rotationY:[{t:0,value:0,easing:'easeInOut'},{t:2,value:1.57,easing:'easeInOut'}],position:[],scale:[],visible:[]}}];
  by(l,'obj384').behaviors=[act('playAnimation',{targetId:'obj383',clipName:'swing'}),sound('door')];
  const checkpoint=by(l,'obj388');checkpoint.behaviors=[act('setFlagTrue',{name:'checkpointReached'},'enter'),act('setCheckpoint',{},'enter'),sound('beacon','enter')];hidden(checkpoint);
  marker(l,-3,-12,'Entry scanner');model(by(l,'obj385'),'generator',.8);model(by(l,'obj386'),'floor-panel',1.1);
  for(const x of[-15,15])for(const z of[-12,-6,0,6,12])prop(l,'wall-panel',[x,0,z],1,'Inspection hall',{rotationY:Math.PI/2});
  for(const x of[-9,9])for(const z of[-8,2,11]){prop(l,'terminal',[x,0,z],.65,'Bay monitor');light(l,[x,2.5,z],[.2,.68,.9],6,.7);}
  end(l,[0,0,15],'Final inspection console',{type:'isFlagTrue',name:'checkpointReached'});
 }else if(id==='moving-temple'){
  const rise=by(l,'obj59').animationClips.find(c=>c.name==='Rise');rise.duration=8;rise.tracks.position[1].t=8;
  by(l,'obj56').position=[0,1.8,-.4];model(by(l,'obj60'),'beacon',.35);by(l,'obj60').position=[14,1.25,0];
  const goal=by(l,'obj62');model(goal,'relic',.8);goal.position[1]=6.9;
  for(const x of[-1.7,1.7,10.3,13.7]){prop(l,'pillar',[x,-.5,2.4],[.75,1.1,.75],'Temple pier');prop(l,'pillar',[x,-.5,-2.4],[.75,1.1,.75],'Temple pier');}
  prop(l,'arch',[20,6.7,1.3],.7,'High shrine arch');light(l,[20,9,0],[1,.66,.2],14,1.5);
  woodland(l,[[-6,-6,.8],[-4,8,.9],[5,-9,.7],[11,8,.8],[23,-7,.9]]);
  for(const x of[0,12,20])prop(l,'ruin-wall',[x,terrainY(l,x,5),5],[1.1,1,1],'Temple retaining wall');
 }else if(id==='skyway-trial'){
  l.playerSettings.acceleration=60;l.playerSettings.jumpSpeed=10;
  const fall=by(l,'obj59');fall.position=[0,-12,14];fall.scale=[80,3,80];
  l.environment={...l.environment,skyTop:[.19,.40,.62],skyHorizon:[.72,.83,.88],fogDensity:.016};
  for(const o of l.objects){if(o.solid){o.color=[.70,.78,.80];tex(o,'stone');const pos=[...o.position];prop(l,'floor-panel',[pos[0],pos[1]+o.scale[1]/2+.01,pos[2]],[.85,.6,.85],'Platform inset');}if(o.name==='WinZone'){model(o,'relic',.75);o.position[1]=5.1;}}
  const start=l.objects.find(o=>o.name==='Start');if(!l.objects.some(o=>o.isSpawnPoint))cube(l,'Player Spawn',[0,1.2,1],[.5,.9,.5],[0,0,0],{isSpawnPoint:true,isDefaultSpawn:true,visible:false});
  prop(l,'arch',[0,5,29.5],.7,'Summit gate');for(const z of[8,13,18,23,28])light(l,[0,3+(z-8)/5,z],[.2,.85,1],6,1);
 }else if(id==='sentinel-maze'){
  const t=l.objects.find(o=>o.kind==='terrain');t.options.amplitude=0;t.options.islandBase=0;t.options.radius=80;
  by(l,'obj53').solid=true;by(l,'obj53').color=[.23,.30,.34];model(by(l,'obj59'),'guardian',.68);by(l,'obj59').position[1]=0;
  for(const [x,z,w,d]of[[-12,1,1,26],[12,1,1,26],[0,-12,25,1],[0,12,25,1],[1,-6,1,11],[-4,7,1,10],[4,6,9,1]]){const wall=cube(l,'Maze wall',[x,1,z],[w,2,d],[.29,.37,.40],{solid:true});tex(wall,'stone');}
  for(const x of[-12,12])for(const z of[-12,0,12])prop(l,'pillar',[x,0,z],.7,'Maze corner');
  const goal=by(l,'obj55');model(goal,'beacon',.7);goal.position[1]=0;prop(l,'arch',[9,0,10.7],.55,'Exit arch');
  marker(l,-7,-9,'Starting waystone',.4);trail(l,[[-6,-7],[-3,-7],[5,-8],[8,-5],[8,0],[9,3],[9,7]]);
 }else if(id==='relic-runner-2'){
  // Reach deck height before the player's radius meets its vertical face.
  // The legacy ramp peaked a full metre inside the solid deck.
  by(l,'ramp1').position=[4.25,1.125,0];by(l,'ramp1').scale=[4.5,2.25,3];tex(by(l,'ramp1'),'stone');
  const e=by(l,'enemy1');model(e,'ranger',1);e.position[1]=2.25;
  model(by(l,'obstacle1'),'rock-4',1.4);ground(by(l,'obstacle1'),l);by(l,'obstacle2').color=[.39,.42,.37];
  model(by(l,'checkpoint1'),'beacon',.65);ground(by(l,'checkpoint1'),l);model(by(l,'relic1'),'relic',.8);by(l,'relic1').spin=.5;
  woodland(l,[[-13,-3,.8],[-11,5,.9],[-7,9,1],[-1,11,.7],[4,-9,.8],[12,-8,.75],[14,6,.7]]);
  ruins(l,[[7,5,0],[12,5,0],[-2,-4,.4],[-9,4,.7]]);prop(l,'arch',[11,2.25,-1.8],.65,'Ridge shrine');
  by(l,'cam-intro').options.position=[14,6,-6];by(l,'cam-intro').options.lookAtTargetId='relic1';
  for(const seq of l.sequences||[])for(const step of seq.steps||[])if(step.kind==='delay'&&step.seconds===1.5)step.seconds=.65;
 }else if(id==='valley-run'){
  for(const o of l.objects){if(o.ai){model(o,'guardian',.6);ground(o,l);}if(o.behaviors?.some(b=>b.action==='setCheckpoint')){model(o,'beacon',.6);ground(o,l);}if(o.behaviors?.some(b=>b.action==='win')){model(o,'relic',.8);ground(o,l,.8);}}
  woodland(l,[[-6,-14,.9],[6,-11,.8],[-6,-7,.75],[6,-3,.9],[-7,4,.8],[7,7,.9],[-7,13,.9],[7,18,.8],[-5,22,.8]]);
  prop(l,'arch',[0,terrainY(l,0,22),23],.9,'Far ridge arch');trail(l,[[-2,-14],[2,-11],[-2,-7],[2,-3],[-2,2]]);
 }else if(id==='dungeon-descent'){
  const t=l.objects.find(o=>o.kind==='terrain');t.options.radius=60;t.options.amplitude=0;t.options.islandBase=0;
  for(const o of l.objects){if(o.name==='Wall'){o.solid=true;o.position[1]=1;o.color=[.37,.33,.28];}if(/^Switch/.test(o.name)){model(o,'beacon',.55);o.position[1]=0;}if(o.name==='Gate'){o.solid=true;o.position[1]=1.5;}if(o.name==='Exit'){model(o,'relic',.8);o.position[1]=.6;}}
  for(const [x,z]of[[-4,8],[4,-8],[-3,-3],[7,-3],[-3,3],[7,3]]){prop(l,'pillar',[x-1.6,0,z],.75,'Seal chamber pillar');light(l,[x,2.4,z],[1,.58,.16],8,1.1);}
  prop(l,'arch',[12,0,0],.75,'Eastern arch',{rotationY:Math.PI/2});
  const paving=cube(l,'Dungeon paving',[.5,.04,0],[31,.04,23],[.8,.8,.75]);tex(paving,'stone');
  cube(l,'Player Spawn',[-10,.6,0],[.5,.9,.5],[0,0,0],{isSpawnPoint:true,isDefaultSpawn:true,visible:false});
 }else if(id==='npc-puzzle-adventure'){
  for(const level of p.levels){const t=level.objects.find(o=>o.kind==='terrain');t.options.radius=70;t.options.amplitude=.2;t.options.islandBase=0;
   for(const o of level.objects){if(o.name==='Sailor'){model(o,'ranger',1);ground(o,level);o.rotationY=Math.PI;const g=o.behaviors.find(b=>b.action==='graph')?.graph;if(g){const condition=g.nodes.find(n=>n.type==='isFlagTrue');if(condition){condition.type='isFlagFalse';condition.name='hasKey';}}}if(o.name==='DoorSwitch'){model(o,'beacon',.5);ground(o,level);}if(o.name==='ToSanctum'||o.name==='SanctumWin'){model(o,'shrine',.8);ground(o,level);}if(o.name==='Door'){o.position[1]=1.5;o.solid=true;} }
   woodland(level,[[-6,-4,.8],[6,-4,.8],[-6,5,.7],[6,6,.7]],'tree-oak');prop(level,'arch',[0,0,8],1,'Sanctum doorway');ruins(level,[[-3.5,8,0],[3.5,8,0],[-5,10,.4],[5,10,-.4]]);
   cube(level,'Player Spawn',[0,.65,-5],[.5,.9,.5],[0,0,0],{isSpawnPoint:true,isDefaultSpawn:true,visible:false});}
 }else if(id==='power-station'){
  const t=l.objects.find(o=>o.kind==='terrain');t.options.radius=70;t.options.amplitude=.001;t.options.islandBase=-.12;
  model(by(l,'obj63'),'generator',1.1);by(l,'obj63').position[1]=0;model(by(l,'obj64'),'relic',.55);by(l,'obj64').localPosition=[0,2.8,0];by(l,'obj64').localScale=[.5,.5,.5];
  for(const id of['obj66','obj67','obj71']){model(by(l,id),'relic',.45);by(l,id).position[1]=.65;by(l,id).behaviors.push(act('incrementCounter',{counter:'fuelCell'}));}
  model(by(l,'obj68'),'ranger',1);by(l,'obj68').position[1]=0;model(by(l,'obj70'),'terminal',.55);by(l,'obj70').position[1]=0;
  for(const [x,z]of[[-7,-7],[-7,-3],[7,-7],[7,-3]])prop(l,'pipe',[x,0,z],.9,'Coolant piping');
  for(const x of[-8,8])for(const z of[-11,-5,1,7])prop(l,'wall-panel',[x,0,z],1,'Station enclosure',{rotationY:Math.PI/2});floor(l,0,-2,18,24);
 }else if(id==='textured-adventure'){
  for(const o of l.objects){if(/^Relic/.test(o.name||'')){model(o,'relic',.7);ground(o,l,.3);}if(o.name==='Shrine'){model(o,'shrine',.9);ground(o,l);}if(o.name==='Hazard'){tex(o,'hazard');o.color=[.8,.20,.13];}}
  l.environment.skyTop=[.15,.12,.24];l.environment.skyHorizon=[.50,.45,.62];
  ruins(l,[[-8,2,.2],[-6,5,0],[-2,7,0],[3,7,.3],[7,4,-.3],[4,-6,0],[-3,-6,.5]]);woodland(l,[[-9,-4,.7],[7,-6,.8],[8,7,.7]],'tree-birch');
 }else if(id==='temple-switch-puzzle'){
  const t=l.objects.find(o=>o.kind==='terrain');t.options.size=34;t.options.radius=60;t.options.amplitude=0;t.options.islandBase=0;
  for(const o of l.objects){if(o.name==='Switch'){model(o,'beacon',.65);o.position[1]=0;}if(o.name==='Goal'){model(o,'shrine',.8);o.position[1]=0;}if(o.name==='Door'){o.solid=true;o.position[1]=1.25;}}
  prop(l,'arch',[0,0,8],1.6,'Twin-seal gateway');for(const x of[-11,-6,6,11])for(const z of[-3,4])prop(l,'pillar',[x,0,z],.9,'Temple colonnade');
  woodland(l,[[-15,-9,.9],[15,-9,.9],[-15,8,.8],[15,8,.8]]);cube(l,'Player Spawn',[0,.65,-10],[.5,.9,.5],[0,0,0],{isSpawnPoint:true,isDefaultSpawn:true,visible:false});
 }else if(id==='opus-arena'){
  const t=l.objects.find(o=>o.kind==='terrain');t.options.size=26;t.options.radius=70;t.options.amplitude=.001;t.options.islandBase=-.12;floor(l,0,0,24,24);
  by(l,'obj47').options.position[1]=.03;
  for(const f of p.prefabs||[]){model(f.record,f.name==='Grunt'?'guardian':'relic',f.name==='Grunt'?.65:.22);}
  rim(l,0,0,11,12,'pillar');for(const [x,z]of[[-6,-4],[6,-4],[-6,5],[6,5]]){place(l,'rock-4',x,z,.8,'Courtyard cover');}
  prop(l,'arch',[0,terrainY(l,0,9),9],1,'Guardian gate');
 }else if(/^survival-arena/.test(id)){
  for(const w of l.objects.filter(o=>o.kind==='water')){w.options.deepColor=[.025,.13,.18];w.options.waves=[{dir:[1,.2],freq:.3,speed:.55,amp:.012},{dir:[-.3,1],freq:.6,speed:.4,amp:.007},{dir:[.6,-.8],freq:1.1,speed:.7,amp:.003}];}
  for(const o of l.objects){if(o.ai)model(o,'drone',.7);if(o.name==='Orb')model(o,'relic',.55);}
  for(const f of p.prefabs||[])model(f.record,'drone',.75);
  const n=id==='survival-arena'?1:id==='survival-arena-2'?2:3;
  l.environment.skyTop=n===2?[.09,.20,.25]:n===3?[.23,.11,.085]:[.08,.12,.22];l.environment.skyHorizon=n===2?[.36,.56,.60]:n===3?[.66,.40,.25]:[.40,.46,.57];
  rim(l,0,0,10.5,8,n===2?'rock-3':'pillar');for(const [x,z]of[[-5,-4],[5,-4],[-5,4],[5,4]])place(l,n===2?'beacon':'generator',x,z,.4,n===2?'Tidal marker':'Arena transmitter');
  if(n===1)l.ui.hudElements=[{kind:'counter',counterName:'health',text:'Lives: {value}',anchor:'top-left',visible:true},{kind:'counter',counterName:'collected',text:'Orbs: {value} / 4',anchor:'top-right',visible:true}];
  if(n===3){l.ui.hudElements.push({kind:'health',anchor:'top-left',visible:true});const mgr=by(l,'obj48');mgr.behaviors.push(act('startTimer',{name:'survived',duration:0,countDown:false},'start'));l.ui.hudElements.push({kind:'timer',timerName:'survived',text:'Survived: {value}s / 20',anchor:'top-right',visible:true});}
  for(const h of l.ui.hudElements)if(h.kind==='health'||h.counterName==='health')h.anchor='bottom-left';
  for(const o of l.objects)for(const b of o.behaviors||[])if(b.params?.text)b.params.text=b.params.text.replace(/red Hunters/g,'hunter drones');
 }
}
function boundSample(p,id,s){
 if(id==='skyway-trial')return;
 for(const l of p.levels){
  const terrain=l.objects.find(o=>o.kind==='terrain');
  if(terrain&&terrain.options.amplitude===0)terrain.options.amplitude=.001;
  const rooms={'blacksite':[-7.3,7.3,-4.5,l===p.levels[0]?19:5.5],'signal-zero':[-13.5,13.5,-16,13.5],'iron-arena':[-15,15,-15,15],'shifting-facility':[-19,19,-19,19],'assembly-line':[-16.5,16.5,-16.5,16.5],'moving-temple':[-10,30,-13,13],'valley-run':[-12,12,-25,27],'npc-puzzle-adventure':[-10,10,-14,14],'dungeon-descent':[-15,16,-12,12],'power-station':[-9,9,-14,9],'temple-switch-puzzle':[-16,16,-18,15]};
  let box=rooms[id];
  if(!box){const pos=terrain?.options.position||[0,0,0],half=terrain?terrain.options.size/2-1:14;box=[pos[0]-half,pos[0]+half,pos[2]-half,pos[2]+half];}
  if(terrain&&['npc-puzzle-adventure','dungeon-descent','power-station','temple-switch-puzzle'].includes(id)){terrain.options.size=Math.max(terrain.options.size,36);terrain.options.radius=70;}
  // Low edging makes the authored controller boundary visible without
  // enclosing a compact sample behind a camera-obscuring wall.
  const [x1,x2,z1,z2]=box,cx=(x1+x2)/2,cz=(z1+z2)/2;
  l.playerSettings.playBounds={minX:x1,maxX:x2,minZ:z1,maxZ:z2};
  for(const [x,z,w,d]of[[x1,cz,.65,z2-z1],[x2,cz,.65,z2-z1],[cx,z1,x2-x1,.65],[cx,z2,x2-x1,.65]]){
   const base=terrain?terrainY(l,x,z):0;
   const wall=cube(l,'Boundary edging',[x,base+.12,z],[w,.24,d],s[1]==='scifi'?[.17,.24,.28]:s[1]==='arena'?[.27,.23,.21]:[.26,.33,.29],{solid:false});tex(wall,s[1]==='scifi'||s[1]==='arena'?'metal':'stone');
  }
 }
}
function curateAssets(p,id){
 const mappings={
  'forest-range':{texture3:'ground-moss',texture4:'stone',texture5:'ground-sand'},
  'painted-wilds':{texture3:'ground-moss',texture4:'stone',texture5:'ground-sand'},
  'relic-runner-2':{texture1:'ground-moss',texture2:'stone'},
  'textured-adventure':{texture1:'stone',texture2:'ground-sand',texture3:'ground-moss'},
 };
 function visit(v){if(!v||typeof v!=='object')return;for(const [k,value]of Object.entries(v)){if(k==='textureAssetId'&&mappings[id]?.[value]){const key=mappings[id][value];textures.add(key);v[k]=kit.getTexture(key).id;}else if(typeof value==='object')visit(value);}}
 visit(p.levels);visit(p.prefabs);
}
const reports=[];
for(const [id,s] of Object.entries(SPECS)){
 serial=0;meshes=new Set();textures=new Set();audios=new Set();
 const input=path.join(root,'rehabilitation-evidence/baseline-games',id+'.json');
 if(!fs.existsSync(input))throw new Error('Missing pre-rehabilitation snapshot: '+input);
 const p=JSON.parse(fs.readFileSync(input,'utf8'));project=p;
 const before=(p.levels||[p]).reduce((a,l)=>a+(l.objects||[]).length,0);
 if(!p.levels){const objects=p.objects;delete p.objects;p.levels=[{id:'rehab-level-0',name:s[0],objects}];}
 p.prefabs=p.prefabs||[];
 identity(p,id,s);rehab(id,p);boundSample(p,id,s);polishRecords(p,s);curateAssets(p,id);
 kit.install(p,{meshes:[...meshes],textures:[...textures],audio:[...audios]});
 // Removed imports are preserved in baseline-games, outside the public export.
 const retained={assets:[],textures:[],audio:[]};
 for(const key of Object.keys(retained))p[key]=(p[key]||[]).filter(a=>a.id.startsWith('showcase-'));
 const visibleFixtureRefs=p.levels.flatMap(l=>l.objects).filter(o=>o.assetId&&!o.assetId.startsWith('showcase-')).map(o=>o.assetId);
 require('./refine-health-outcomes')(p,id);
 require('./refine-controls-copy')(p);
 fs.writeFileSync(path.join(root,'games',id+'.json'),JSON.stringify(p,null,2)+'\n');
 reports.push({id,title:s[0],purpose:s[4],artFamily:s[1],description:s[2],objective:s[3],beforeObjects:before,afterObjects:p.levels.reduce((n,l)=>n+l.objects.length,0),levels:p.levels.length,models:[...meshes],textures:[...textures],audio:[...audios],unreplacedModelReferences:visibleFixtureRefs,changes:['Authored title, start screen, controls, objective and outcome text','Original kit models and environment composition specific to sample purpose','Coherent lighting, ambient loop and interaction feedback','Original gameplay ids and technical systems retained','Authored play bounds and low edging contain compact samples; third-person gravity enabled','Historical fixture imports preserved only in the internal baseline snapshots'],caveats:['Requires standalone visual and representative-play audit before public classification','Enemy collision remains a simple gameplay proxy; sample scope stays deliberately compact']});
 console.log(id+': '+before+' -> '+reports[reports.length-1].afterObjects+' objects; '+meshes.size+' meshes');
}
fs.writeFileSync(path.join(root,'rehabilitation-evidence/sample-changes.json'),JSON.stringify(reports,null,2)+'\n');
fs.writeFileSync(path.join(root,'rehabilitation-evidence/sample-changes.md'),'# Sample rehabilitation changes\n\nSource-authored changes for all 21 non-Batch-A games. Public classification is deferred to actual standalone audit. Original gameplay IDs, graphs, prefabs, terrain edits and controller families are retained unless a concrete broken authoring record required repair.\n\n'+reports.map(r=>'## '+r.title+'\n\n'+r.purpose+'. '+r.description+'\n\nObjects: '+r.beforeObjects+' → '+r.afterObjects+'; original models: '+r.models.join(', ')+'.\n\n'+r.caveats.join(' ')+'\n').join('\n'));
