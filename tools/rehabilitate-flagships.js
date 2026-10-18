// Deterministic rehabilitation of the existing seven Batch A projects.
// Baselines preserve the user's full pre-pass working copies; original IDs/graphs remain.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const kit = require('./showcase-assets');
const ROOT = path.resolve(__dirname, '..');
const ctx = { window: {}, Float32Array, Uint16Array, Uint32Array, Uint8Array, DataView, ArrayBuffer, TextDecoder };
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'dist/opus-engine.js'),'utf8'),ctx);
const Opus = ctx.window.Opus;
const profiles = {
  'foglight': { title:'Foglight', family:'fantasy', description:'Carry light through a mist-filled vale. Awaken three ancient beacons, evade the antlered guardian, and open the sanctuary.', how:'WASD move · Space jump · Shift sprint · F interact · Esc pause. Follow the stone path. Light all three beacons, collect the Vale Key beside the first beacon, then cross the sanctuary gate.', hint:'Follow the lanterns • F lights beacons • Find the Vale Key', spawn:[0,1.3,0], yaw:0 },
  'signal-relay': { title:'Signal Relay', family:'scifi', description:'Restore three relay consoles in a silent communications station. Slip past patrol drones or use your sidearm, then reach the green extraction bay.', how:'WASD move · Mouse look · F restore console · Q fire · R reload · C crouch · Shift sprint · Esc pause. Activate Alpha, Beta and Gamma. The security gate opens after all three are powered.', hint:'Three relays to restore • F interact • C move quietly', spawn:[-30,.7,0], yaw:Math.PI/2 },
  'arsenal-run': { title:'Arsenal Run', family:'combat', description:'A compact arena assault. Use cover, switch between sidearm and rifle, defeat three sentries and reach extraction.', how:'WASD move · Mouse look · Q fire · R reload · V switch weapon · C crouch · Shift sprint · Esc pause. Defeat the three sentries, then enter the green extraction bay at the far end.', hint:'Q fire • R reload • V switch • Clear the three sentries', spawn:[0,.7,13], yaw:Math.PI },
  'silent-sector': { title:'Silent Sector', family:'scifi', description:'A short stealth infiltration through a listening security station. Break sightlines, secure the Data Core and escape unseen.', how:'WASD move · Mouse look · C crouch · Shift sprint · F interact · Esc pause. Stay behind machinery and watch the sentries. Crouching makes less noise. Reach the security wing, take the cyan Data Core, then follow green lights to extraction.', hint:'C crouch • Use cover • Secure the Data Core', spawn:[-29,.7,-5.5], yaw:Math.PI/2 },
  'power-grid': { title:'Power Grid', family:'scifi', description:'Bring an abandoned generator hall back online. Carry the power cell to its socket, activate two coolant consoles and open the emergency exit.', how:'WASD move · Mouse look · F pick up / interact · G drop · Esc pause. Carry the amber Power Cell to the generator. Activate both cyan coolant consoles. The green exit opens when power and coolant are restored.', hint:'F carry / interact • Cell → generator → two coolant consoles', spawn:[-17,.7,0], yaw:Math.PI/2 },
  'relic-frontier': { title:'Relic Frontier', family:'fantasy', description:'Explore an overgrown frontier outpost. Recover a weapon, defeat the stone guardian, claim the ridge relic and cross the sealed border gate.', how:'WASD move · Space jump · Shift sprint · C crouch · Q attack · F interact · Esc pause. Find the weapon near the old road. Defeat the guardian, collect the ridge relic and reach the arch beyond the gate.', hint:'Find the weapon • Defeat the guardian • Claim the ridge relic', spawn:[-8,1.2,-8], yaw:.6 },
  'relic-island': { title:'Relic Island', family:'fantasy', description:'A small island treasure hunt. Recover three golden relics and the gate key, then awaken the hilltop shrine.', how:'WASD move · F interact · Esc pause. Collect three golden relics and the silver gate key. Use the lever beside the gate, then enter the shrine. Keep clear of the glowing lava pool.', hint:'Three relics • One key • F use the gate lever', spawn:[0,.8,0], yaw:Math.PI },
};
let serial=0;
function cube(level,name,pos,scale,color,extra={}) { const r={kind:'cube',id:`rehab-${++serial}`,name,position:pos,scale,color,rotationY:0,mesh:'cube',behaviors:[],solid:false,...extra}; level.objects.push(r);return r; }
function mesh(project,level,key,pos,scale=1,name=key,extra={}) {
  kit.install(project,{meshes:[key]}); const a=kit.getMesh(key);
  return cube(level,name,pos,Array.isArray(scale)?scale:[scale,scale,scale],[1,1,1],{mesh:'asset',assetId:a.id,textureAssetId:a.textureAssetId,...require('./showcase-wall-collision')(key,a,scale,extra.rotationY||0),...extra});
}
function swap(project,r,key,scale=1,groundY) {
  kit.install(project,{meshes:[key]});const a=kit.getMesh(key);
  r.mesh='asset';r.assetId=a.id;r.textureAssetId=a.textureAssetId;r.color=[1,1,1];r.scale=Array.isArray(scale)?scale:[scale,scale,scale];
  if(groundY!==undefined)r.position[1]=groundY;
  delete r.uvScale; delete r.emissiveColor;delete r.emissiveIntensity;
  return r;
}
function slab(level,name,pos,scale,color,texture) {return cube(level,name,pos,scale,color,{solid:true,textureAssetId:texture,uvScale:[Math.max(1,scale[0]/3),Math.max(1,scale[2]/3)]});}
function light(level,pos,color=[1,.7,.3],intensity=1.4,range=9) {level.objects.push({kind:'light',id:`rehab-light-${++serial}`,name:'Architectural light',position:pos,options:{lightType:'point',position:pos,color,intensity,range,enabled:true}});}
function sound(key,trigger='interact',volume=.55) {return {trigger,action:'sound',params:{mode:'asset',audioAssetId:'showcase-'+key,volume}};}
function graph(nodes,edges) {return {trigger:'enter',action:'graph',graph:{nodes,edges}};}
function by(level,id) {return level.objects.find(o=>o.id===id);}
function ground(level,x,z) {
  const t=level.objects.find(o=>o.kind==='terrain');if(!t)return 0;
  const pos=t.options.position||[0,0,0]; const opts={...t.options};delete opts.position;
  return Opus.Terrain.sampleHeight(x-pos[0],z-pos[2],opts)+pos[1];
}
function spawn(level,pos) {
  let s=level.objects.find(o=>o.isDefaultSpawn)||level.objects.find(o=>o.isSpawnPoint);
  if(!s)s=cube(level,'Arrival',pos,[.4,.9,.4],[0,1,1],{isSpawnPoint:true,isDefaultSpawn:true});
  s.position=pos;s.isDefaultSpawn=true;
}
function tidy(project,level,profile) {
  project.format='digital-opus-project';project.version=3;project.startLevelIndex=0;
  project.meta={...(project.meta||{}),title:profile.title,description:profile.description,version:'1.1.0',author:'Digital Opus'};
  project.title=profile.title;
  level.description=profile.description;
  const ui=level.ui=level.ui||{};
  ui.startScreen={...(ui.startScreen||{}),enabled:true,title:profile.title,subtitle:profile.description,buttonText:profile.family==='fantasy'?'Begin journey':'Begin mission',howToPlay:profile.how,controlsHint:profile.hint,credits:'Original models, textures and sound by Digital Opus. A pre-release engine example.'};
  ui.winTitle=ui.winTitle||'Mission complete';ui.winMessage=ui.winMessage||'The station is ready. Your route is complete.';
  ui.loseTitle=ui.loseTitle||'Try again';ui.loseMessage=ui.loseMessage||'Return to the arrival point and choose a new route.';
  ui.winAudioAssetId='showcase-win';ui.loseAudioAssetId='showcase-lose';
  const ps=level.playerSettings=level.playerSettings||{};ps.initialYaw=profile.yaw;ps.initialPitch=0;
  ps.footstepAudioAssetId='showcase-footstep';ps.footstepWalkVolume=.14;ps.footstepRunVolume=.24;ps.footstepInterval=.48;
  kit.install(project,{audio:['ambient-'+(profile.family==='fantasy'?'fantasy':profile.family==='combat'?'arena':'facility'),'footstep','interaction','pickup','door','beacon','win','lose','fire','impact','alert','damage']});
  level.ambientAudio={audioAssetId:'showcase-ambient-'+(profile.family==='fantasy'?'fantasy':profile.family==='combat'?'arena':'facility'),volume:.22};
  if(ps.controllerType==='thirdperson') {
    kit.install(project,{meshes:['ranger']});
    ps.visual={mode:'skinned',assetId:'showcase-ranger',scale:.8,rotationOffsetY:0,positionOffset:{x:0,y:-.55,z:0},clipMap:{idle:0,walk:1,run:2,jump:3,fall:4,attack:5,death:6},blendTime:.18};
  }
  const paths=new Set(level.objects.filter(o=>o.kind==='path').flatMap(o=>o.pointIds||[]));
  for(const o of level.objects) {
    if(paths.has(o.id))o.isWaypoint=true;
    if(/Init$|Manager$|Watcher$/.test(o.name||''))o.isTrigger=true;
    if(o.ai)for(const s of o.ai.states||[])if(/alert|caught|attack/.test(s.name)) {s.entryActions=s.entryActions||[];s.entryActions.push({action:'sound',params:{mode:'asset',audioAssetId:'showcase-alert',volume:.3}});}
  }
  spawn(level,profile.spawn);
}
function woodland(project,level,centers,theme=0) {
  for(let ci=0;ci<centers.length;ci++) {
    const [cx,cz]=centers[ci];
    for(let j=0;j<9;j++) {
      const angle=(j/9)*Math.PI*2+ci*.7; const rad=6.5+(j%3)*2;
      const x=cx+Math.cos(angle)*rad,z=cz+Math.sin(angle)*rad;
      if((Math.abs(x)<4 && z>0)||(z<8&&Math.abs(x)<8))continue;
      const y=ground(level,x,z);
      mesh(project,level,['tree-pine','tree-oak','tree-birch'][(j+theme)%3],[x,y,z],.65+(j%3)*.17,'Vale canopy',{rotationY:angle});
      mesh(project,level,'rock-'+(j%5+1),[x+1.8,ground(level,x+1.8,z-1),z-1],.8+(j%3)*.2,'Weathered stone',{rotationY:angle*2});
      if(j%2===0)mesh(project,level,'bush',[x-1,ground(level,x-1,z+1),z+1],.9,'Undergrowth');
    }
  }
}
function facility(project,level,family) {
  const textures=kit.textureKeys;
  const metal=textures.includes('metal')?'metal':textures.find(k=>/metal|panel|steel/.test(k));
  if(metal)kit.install(project,{textures:[metal]});
  for(const r of [...level.objects]) {
    const n=r.name||'';
    if(r.kind==='cube' && r.solid && /Floor|Wall|Divider|Cover/.test(n)) {
      r.color=/Floor/.test(n)?[.6,.65,.7]:[.68,.75,.8];
      if(metal){r.textureAssetId='showcase-'+metal;r.uvScale=[Math.max(1,(r.scale[0]>2?r.scale[0]:r.scale[2])/4),Math.max(1,r.scale[1]/3)];}
    }
    if(r.ai) { swap(project,r,'drone',.9,.75); r.characterAnimSync=true; r.health={current:54,max:54}; }
  }
  const floor=level.objects.find(o=>o.name==='Floor');
  if(!floor)return;
  const cx=floor.position[0],cz=floor.position[2],w=floor.scale[0],d=floor.scale[2];
  for(let x=cx-w/2+4;x<cx+w/2-2;x+=6) {
    for(const side of [-1,1]) {
      const z=cz+side*(d/2-.8);
      mesh(project,level,'wall-panel',[x,0,z],[1.3,1.25,.65],'Ribbed wall bay',{rotationY:side>0?Math.PI:0});
      mesh(project,level,'light',[x,2.6,z-side*.35],.7,'Recessed strip light',{rotationY:side>0?Math.PI:0});
      cube(level,'Route light',[x,.025,cz+side*(d/2-2.5)],[2.5,.03,.09],family==='combat'?[1,.4,.08]:[.07,.7,.85],{unlit:true});
    }
  }
  for(let x=cx-w/2+8;x<cx+w/2-2;x+=14) {
    mesh(project,level,'pipe',[x,.1,cz+d/2-2.1],[1,1,1.3],'Service conduit',{rotationY:Math.PI/2});
    light(level,[x,3,cz],family==='combat'?[1,.62,.3]:[.3,.68,1],1.1,12);
  }
  level.environment={...(level.environment||{}),skyTop:[.25,.32,.41],skyHorizon:family==='combat'?[.43,.32,.24]:[.4,.5,.56],groundColor:[.32,.38,.43],sunColor:family==='combat'?[1,.87,.69]:[.81,.94,1],fogDensity:.011,shadows:{enabled:true,resolution:512,distance:35,bias:.0025}};
}
const notes=[];
for(const [id,profile] of Object.entries(profiles)) {
  serial=0;
  const project=JSON.parse(fs.readFileSync(path.join(ROOT,'rehabilitation-evidence/baseline-games',id+'.json')));
  const level=project.levels[0];const before=level.objects.length;
  tidy(project,level,profile);
  if(profile.family!=='fantasy')facility(project,level,profile.family);
  if(id==='foglight') {
    level.objects=level.objects.filter(o=>!o.scatterLayerId && o.id!=='obj47');level.scatterLayers=[];
    const t=by(level,'obj45');t.options={...t.options,radius:53,amplitude:.8,position:[0,-2,42]};
    const v=by(level,'obj53');v.position=[0,-8,42];v.scale=[80,1,110];
    level.environment={...level.environment,skyTop:[.3,.48,.53],skyHorizon:[.6,.74,.71],groundColor:[.32,.4,.3],sunColor:[1,.89,.65],fogDensity:.017,shadows:{enabled:true,resolution:512,distance:40,bias:.0025}};
    const stone=kit.textureKeys.find(k=>/stone/.test(k));if(stone)kit.install(project,{textures:[stone]});
    for(const r of level.objects.filter(o=>o.solid)) {r.color=[.63,.68,.61];if(stone){r.textureAssetId='showcase-'+stone;r.uvScale=[2,2];}}
    // A continuous navigable causeway removes the accidental spawn damage and
    // gives exploration room around the key/guardian; raised stepping stones remain.
    slab(level,'Ancient causeway',[0,.08,40],[6,.32,86],[.43,.51,.44],stone&&'showcase-'+stone);
    slab(level,'Guardian court',[-6,.12,22],[16,.3,14],[.4,.48,.43],stone&&'showcase-'+stone);
    for(const n of ['obj68','obj69','obj70']) {
      const r=swap(project,by(level,n),'beacon',1,.75);
      for(const b of r.behaviors||[])for(const node of b.graph?.nodes||[]) {
        if(node.type==='sound')node.audioAssetId='showcase-beacon';
        if(node.type==='scaleTo'){node.x=1.1;node.y=1.1;node.z=1.1;}
      }
      light(level,[r.position[0],3,r.position[2]],[1,.69,.2],2,9);
      mesh(project,level,'arch',[0,.75,r.position[2]+3],1.2,'Beacon arch');
    }
    swap(project,by(level,'obj72'),'guardian',1.1,.28);
    swap(project,by(level,'obj126'),'relic',.48,.45);by(level,'obj126').behaviors.unshift(sound('pickup','enter'));
    swap(project,by(level,'obj64'),'gate',1,.5);by(level,'obj64').position[0]=0;
    swap(project,by(level,'obj66'),'gate',1.2,.5);
    by(level,'obj65').position[2]=27.8;by(level,'obj65').scale=[5,3,3];
    by(level,'obj67').position[2]=72.5;by(level,'obj67').scale=[5,3,3];
    by(level,'obj83').behaviors=[graph([{id:'c',type:'counterEquals',counter:'beaconsLit',target:3},{id:'w',type:'win'}],[{kind:'next',from:'start',to:'w'},{kind:'gate',from:'c',to:'w'}])];by(level,'obj83').triggerRepeat=true;
    swap(project,by(level,'obj85'),'bush',1,ground(level,9,42));by(level,'obj85').position[0]=9;
    woodland(project,level,[[0,5],[0,21],[0,41],[0,61],[0,80]]);
    for(const z of [8,16,33,48,58,68,76])for(const x of [-3.2,3.2])mesh(project,level,'pillar',[x,.1,z],.7,'Causeway pillar');
    mesh(project,level,'shrine',[0,.75,82],2,'Sanctuary');
    for(const r of level.objects.filter(o=>/Checkpoint/.test(o.name||''))){r.color=[.85,.66,.25];r.emissiveColor=[1,.55,.08];r.emissiveIntensity=.15;}
    for(const r of level.objects){
      if(r.solid&&r.mesh==='cube'&&r.scale&&r.scale[1]<=.5){r.position[1]=.08;r.scale[1]=.32;}
      if(/^Foglight[123]$/.test(r.name||''))r.position[1]=.24;
      if(r.name==='MistGuardian'){r.behaviors.find(b=>b.action==='damagePlayer').params={amount:6,cooldown:1.5};r.position=[-8,.24,21];r.ai.states.find(s=>s.name==='chase').movement.speed=2.8;}
    }
    // Keep the opening causeway in view, with low ruins framing the walkable edge.
    for(const x of [-3.4,3.4])for(const z of [1,9,17,32,58,67])mesh(project,level,'broken-wall',[x,.15,z],[.35,.4,.75],'Causeway edging',{rotationY:Math.PI/2});
    for(const x of [-5,5])mesh(project,level,'broken-wall',[x,.75,80],[1,1.5,1],'Sanctuary wall');
  }
  if(id==='signal-relay') {
    level.objects=level.objects.filter(o=>!o.scatterLayerId);level.scatterLayers=[];
    for(const r of level.objects.filter(o=>/Console/.test(o.name||''))) {swap(project,r,'relay-console',1.2,0);r.behaviors.unshift(sound('interaction'));light(level,[r.position[0],2,r.position[2]],[.15,.8,1],1.8,7);}
    for(const x of [-29,-13,8,24])mesh(project,level,'crate',[x,0,5],1.5,'Cargo cover',{solid:true});
    mesh(project,level,'generator',[35,0,-5],1.5,'Extraction power unit');
    const gate=by(level,'obj53');gate.color=[.23,.32,.4];
    // Gate itself is the interactive barrier; no permanent false door after it opens.
    mesh(project,level,'arch',[38,0,0],1.4,'Extraction beacon',{rotationY:Math.PI/2});
    const ps=level.playerSettings;
    kit.install(project,{meshes:['weapon-rifle']});ps.equipmentDefs=[{itemName:'Relay sidearm',slot:'primaryHand',assetId:'showcase-weapon-rifle',scale:.35,firstPersonOffset:{x:.27,y:-.27,z:.62}}];
    by(level,'obj62').behaviors.push({trigger:'start',action:'giveItem',params:{name:'Relay sidearm',count:1}},{trigger:'start',action:'equipItem',params:{name:'Relay sidearm',slot:'primaryHand'}});
    level.playerSettings.initialYaw=2.1;
  }
  if(id==='arsenal-run') {
    kit.install(project,{meshes:['weapon-rifle']});
    level.playerSettings.equipmentDefs.forEach((d,i)=>Object.assign(d,{assetId:'showcase-weapon-rifle',scale:i?.45:.32,firstPersonOffset:{x:.27,y:-.28,z:.62}}));
    for(const [x,z] of [[-12,5],[12,9],[-15,-8],[13,-12]])mesh(project,level,'crate',[x,0,z],1.4,'Armored cargo',{solid:true});
    for(const [x,z] of [[-6,-2],[6,3],[0,-8]])mesh(project,level,'hazard-panel',[x,1.65,z],1,'Cover warning');
    mesh(project,level,'door',[0,0,-16],1.6,'Extraction portal',{rotationY:Math.PI});light(level,[0,2,-15],[.2,1,.6],2,8);
    const ex=by(level,'obj2013');ex.triggerRepeat=true;
    const nodes=[{id:'clear',type:'counterEquals',counter:'kills',target:3},{id:'complete',type:'completeObjective',objectiveId:'obj_clear'},{id:'win',type:'win'}];
    ex.behaviors=[graph(nodes,[{kind:'next',from:'start',to:'complete'},{kind:'gate',from:'clear',to:'complete'},{kind:'next',from:'complete',to:'win'},{kind:'gate',from:'clear',to:'win'}])];
    const init=by(level,'obj2008');init.behaviors.push({trigger:'start',action:'setCounter',params:{counter:'kills',value:0}});
    level.ui.hudElements.push({id:'rehab-count',kind:'counter',counterName:'kills',text:'Sentries cleared: {value}/3',anchor:'top-center',visible:true});
  }
  if(id==='silent-sector') {
    for(const [x,z] of [[-26,-2],[-16,4],[-11,-5],[1,-4],[8,5],[21,-3]])mesh(project,level,'generator',[x,0,z],[1.3,1.1,1.3],'Shielded machinery',{solid:true});
    const core=swap(project,by(level,'obj3011'),'relic',.8,.6);core.isTrigger=false;core.behaviors.unshift(sound('pickup','enter'));core.emissiveColor=[.1,.7,1];core.emissiveIntensity=.35;
    by(level,'obj3008').position=[-22,.75,4];by(level,'obj3008').ai.base=[-22,.75,4];
    by(level,'obj3009').position=[-5,.75,5];by(level,'obj3009').ai.base=[-5,.75,5];
    for(const r of level.objects.filter(o=>o.ai)){r.ai.perception.visionDistance=12;r.ai.perception.fovDegrees=85;}
    for(const x of [-23,-8,6,19])mesh(project,level,'hazard-panel',[x,.03,0],[1.4,.1,1.4],'Security threshold');
    mesh(project,level,'terminal',[14,0,-3],1,'Data pedestal');mesh(project,level,'door',[29,0,0],1.4,'Extraction door',{rotationY:Math.PI/2});
    light(level,[14,2,-3],[.2,.8,1],2,7);light(level,[29,2,0],[.2,1,.55],2,7);
  }
  if(id==='power-grid') {
    // Baseline walls sealed the full divider while coolant switches were beyond it.
    // Make two halls with a walkable central opening; gate protects the exit only.
    by(level,'obj1005').position=[0,2,-7];by(level,'obj1005').scale=[1,4,6];
    by(level,'obj1006').position=[0,2,7];by(level,'obj1006').scale=[1,4,6];
    const gate=by(level,'obj1007');gate.position=[17,1.5,0];gate.scale=[1,3,4];
    swap(project,by(level,'obj1008'),'relic',.55,.3);by(level,'obj1008').carryOffset={x:.4,y:-.32,z:1.15};
    light(level,[-14,1.8,-6],[1,.7,.2],2.2,8);
    const gen=swap(project,by(level,'obj1009'),'generator',1.6,0);gen.isTrigger=false;gen.behaviors.unshift(sound('interaction'));
    for(const id2 of ['obj1010','obj1011']){const r=swap(project,by(level,id2),'terminal',1.2,0);r.isTrigger=false;r.behaviors.unshift(sound('interaction'));for(const n of r.behaviors.flatMap(b=>b.graph?.nodes||[]))if(n.id==='aOpen'){n.x=17;n.y=6;n.z=0;}}
    const ex=by(level,'obj1013');ex.position=[18.8,1,0];ex.triggerRepeat=true;
    ex.behaviors=[graph([{id:'a',type:'booleanIs',targetId:'obj1010',name:'activated',value:'true'},{id:'b',type:'booleanIs',targetId:'obj1011',name:'activated',value:'true'},{id:'g',type:'booleanIs',targetId:'obj1009',name:'powerRestored',value:'true'},{id:'ab',type:'and'},{id:'all',type:'and'},{id:'w',type:'win'}],[{kind:'cond',from:'a',to:'ab'},{kind:'cond',from:'b',to:'ab'},{kind:'cond',from:'ab',to:'all'},{kind:'cond',from:'g',to:'all'},{kind:'next',from:'start',to:'w'},{kind:'gate',from:'all',to:'w'}])];
    for(const r of level.objects)for(const b of r.behaviors||[]) {
      if(b.action==='setAmbientAudio' && b.trigger==='enter')b.params.audioAssetId='showcase-ambient-facility';
      if(b.action==='setFogZone'&&b.params.fogDensity)b.params.fogDensity=Math.min(b.params.fogDensity,.035);
    }
    for(const [x,z] of [[-16,8],[-8,8],[12,-8],[12,8]])mesh(project,level,'pipe',[x,0,z],1.5,'Coolant pipe');
    for(const z of [-6,6]) {mesh(project,level,'generator',[17,0,z],[1,1.4,1],'Coolant tower');light(level,[14,2,z],[.15,.85,1],1.7,8);}
    light(level,[-14,2,6],[1,.65,.12],2,9);
    level.ui.hudElements=[{id:'objective-hud',kind:'objective',anchor:'top-left',visible:true},{id:'task-hint',kind:'label',anchor:'bottom-right',text:'F interact / carry',visible:true}];
    level.ui.startScreen.howToPlay=level.ui.startScreen.howToPlay.replace(' · G drop','');
  }
  if(id==='relic-frontier' || id==='relic-island') {
    level.environment={...level.environment,skyTop:id==='relic-island'?[.12,.37,.51]:[.14,.23,.31],skyHorizon:[.67,.76,.67],groundColor:[.19,.28,.17],sunColor:[1,.94,.74],fogDensity:.012,shadows:{enabled:true,resolution:1024,distance:32,bias:.0025}};
    woodland(project,level,[[-5,-5],[7,5]],id==='relic-island'?1:0);
    for(const r of [...level.objects]) {
      const n=r.name||'';
      if(r.ai) {swap(project,r,'guardian',.8,ground(level,r.position[0],r.position[2]));r.characterAnimSync=true;r.health={max:60,current:60};}
      if(/Relic|Key Pickup|RiflePickup/.test(n)) {swap(project,r,/Rifle/.test(n)?'weapon-rifle':'relic',.6,ground(level,r.position[0],r.position[2])+.45);r.isTrigger=false;r.behaviors.unshift(sound('pickup','enter'));}
      if(n==='Boulder')swap(project,r,'rock-3',1.5,ground(level,r.position[0],r.position[2]));
      if(/Gate$/.test(n))swap(project,r,'gate',1.1,ground(level,r.position[0],r.position[2]));
      if(n==='Wall')swap(project,r,'broken-wall',1.4,ground(level,r.position[0],r.position[2]));
    }
    if(id==='relic-frontier') {
      kit.install(project,{meshes:['weapon-rifle']});level.playerSettings.equipmentDefs.forEach(d=>{d.assetId='showcase-weapon-rifle';d.scale=.5;});
      // Restore an actual objective chain; the baseline won at either endpoint
      // and marked the guard defeated when it started attacking.
      const relic=by(level,'relic1');relic.position=[10,2.55,0];
      relic.behaviors=[sound('beacon','enter'),{trigger:'enter',action:'giveItem',params:{name:'Ridge Relic',count:1}},{trigger:'enter',action:'setVisibility',params:{targetId:'relic1',visible:false}}];
      const guard=by(level,'obj1002');for(const st of guard.ai.states)st.entryActions=(st.entryActions||[]).filter(a=>a.action!=='completeObjective');
      const watcher=cube(level,'Guardian objective monitor',[0,1,0],[50,12,50],[0,0,0],{isTrigger:true,triggerRepeat:true});
      const check=graph([{id:'c',type:'counterGreaterThan',counter:'kills',target:0},{id:'a',type:'completeObjective',objectiveId:'obj_defeat'},{id:'g',type:'setVisibility',targetId:'obj1003',visible:false}],[{kind:'next',from:'start',to:'a'},{kind:'gate',from:'c',to:'a'},{kind:'next',from:'a',to:'g'},{kind:'gate',from:'c',to:'g'}]);check.trigger='stay';watcher.behaviors=[check];
      level.objectiveDefs.find(o=>o.id==='obj_defeat').nextObjective='obj_extract';
      const ex=by(level,'obj1004');ex.triggerRepeat=true;ex.behaviors=[graph([{id:'c',type:'hasItem',name:'Ridge Relic',count:1},{id:'k',type:'counterGreaterThan',counter:'kills',target:0},{id:'all',type:'and'},{id:'w',type:'win'}],[{kind:'cond',from:'c',to:'all'},{kind:'cond',from:'k',to:'all'},{kind:'next',from:'start',to:'w'},{kind:'gate',from:'all',to:'w'}])];
      // The exit occupies the walkable opening, following this terrain's low edge.
      ex.position=[0,ground(level,0,20)+1,20];ex.scale=[3,3,3];
      mesh(project,level,'shrine',[10,2.25,0],1.2,'Ridge sanctuary');mesh(project,level,'arch',[0,ground(level,0,20),20],1.5,'Frontier arch');
    } else {
      const shrine=swap(project,by(level,'obj50'),'shrine',1.2,ground(level,0,14));shrine.isTrigger=false;
      swap(project,by(level,'obj51'),'beacon',.45,ground(level,1.5,8));
      const lava=by(level,'obj52');cube(level,'Molten pool',[-5,ground(level,-5,-3)+.12,-3],[3,.12,3],[1,.2,.035],{unlit:true,emissiveColor:[1,.12,.01],emissiveIntensity:.8});
      mesh(project,level,'arch',[0,ground(level,0,10),10],1.35,'Sanctuary arch');
      for(const [x,z] of [[8,8],[-8,6],[0,-10]])mesh(project,level,'pillar',[x+1.2,ground(level,x+1.2,z),z],.75,'Relic marker');
    }
    // Place arrival on the terrain instead of burying the collision body.
    const s=level.objects.find(o=>o.isDefaultSpawn);s.position[1]=ground(level,s.position[0],s.position[2])+.7;
    level.playerSettings.jumpEnabled=true;
    level.playerSettings.gravity=20;level.playerSettings.jumpSpeed=8;
    if(id==='relic-island')level.ui.hudElements.find(h=>h.kind==='health').anchor='bottom-left';
    if(id==='relic-island')level.ui.startScreen.howToPlay=level.ui.startScreen.howToPlay.replace('WASD move','WASD move · Space jump');
  }
  if(id==='relic-frontier')require('./refine-relic-frontier')(project,Opus);
  // Remove unused tiny engineering mesh assets after every reference is replaced.
  const used=JSON.stringify({...project,assets:undefined});project.assets=(project.assets||[]).filter(a=>used.includes('"'+a.id+'"'));
  // Prefabs remain reusable and acquire the same authored appearance as instances.
  for(const pf of project.prefabs||[]) {
    const instance=level.objects.find(o=>o.sourcePrefabName===pf.name && o.assetId?.startsWith('showcase-'));
    if(instance) for(const k of ['mesh','assetId','textureAssetId','scale','color'])pf.record[k]=structuredClone(instance[k]);
  }
  if(['signal-relay','arsenal-run'].includes(id)){kit.install(project,{meshes:['projectile']});for(const pf of project.prefabs||[])if(/Bolt/.test(pf.name))Object.assign(pf.record,{mesh:'asset',assetId:'showcase-projectile',textureAssetId:'showcase-palette',scale:[.32,.32,.32],color:[1,1,1],unlit:true});}
  // Every referenced public texture/audio asset is traceable to the original kit.
  kit.install(project,{textures:['ground-moss','ground-sand','stone','metal'],audio:['beacon','interaction']});
  const remap={};for(const t of project.textures||[])if(!t.id.startsWith('showcase-'))remap[t.id]='showcase-'+(profile.family==='fantasy'?(/grass|moss/i.test(t.name||'')?'ground-moss':'stone'):'metal');
  for(const a of project.audio||[])if(!a.id.startsWith('showcase-'))remap[a.id]='showcase-'+(profile.family==='fantasy'?'beacon':'interaction');
  function refs(value){if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){if(typeof v==='string'&&remap[v])value[key]=remap[v];else refs(v);}}
  refs(project.levels);refs(project.prefabs);
  for(const w of [level.playerSettings.weapon,...(level.playerSettings.equipmentDefs||[]).map(d=>d.weapon)].filter(Boolean)){w.fireAudioAssetId='showcase-fire';w.impactAudioAssetId='showcase-impact';}
  const referenced=JSON.stringify({...project,assets:undefined,textures:undefined,audio:undefined});
  project.assets=(project.assets||[]).filter(a=>referenced.includes('"'+a.id+'"'));
  const assetRefs=JSON.stringify(project.assets);
  project.textures=(project.textures||[]).filter(a=>(referenced+assetRefs).includes('"'+a.id+'"'));
  project.audio=(project.audio||[]).filter(a=>referenced.includes('"'+a.id+'"'));
  // Final authored traversal bounds and combat targets follow their visible models.
  for(const level of project.levels){
    if(id==='foglight'){level.playerSettings.playBounds={minX:-18,maxX:18,minZ:-4,maxZ:88};const guard=level.objects.find(o=>o.name==='MistGuardian');if(guard)guard.scale=[.85,.85,.85];const voidZone=level.objects.find(o=>o.name==='MistVoid');voidZone.position[1]=-1.5;level.ui.startScreen.howToPlay+=' Stay on the stone path: falling into the mist returns you to the last checkpoint and costs health.';const key=level.objects.find(o=>o.name==='ValeKeyPickup');key.scale=[.65,.65,.65];const win=level.objects.find(o=>o.name==='SanctuaryWin').behaviors[0].graph;win.nodes.push({id:'key',type:'hasItem',name:'Vale Key',count:1});win.edges.push({kind:'gate',from:'key',to:'w'});}
    for(const o of level.objects){if(!(o.tags||[]).includes('enemy'))continue;if(o.assetId==='showcase-guardian'){const sy=Number(o.scale?.[1])||1;o.collider={shape:'sphere',offset:{x:0,y:1.05*sy,z:0},radius:1.1*sy};}else if(o.assetId==='showcase-drone')o.collider={shape:'sphere',offset:{x:0,y:0,z:0},radius:.75};if(id==='silent-sector'&&o.ai?.mode==='stateMachine'){o.ai.collideWithSolids=true;o.ai.collisionRadius=o.collider.radius;}}
  }
  if(id==='relic-island')require('./refine-relic-island')(project);
  require('./refine-controls-copy')(project);
  require('./real-demo-masonry-assembly').repair(project);
  require('./real-demo-architectural-assemblies').repair(project);
  require('./real-demo-stone-roles').repair(project);
  require('./real-demo-machinery-roles').repair(project);
  require('./real-demo-actor-policy').apply(project,id);
  require('./real-demo-gate-visuals').repair(project,id);
  require('./real-demo-extraction-frame').repair(project,id);
  require('./real-demo-platform-decoration').repair(project,id);
  require('./real-demo-character-body').repair(project);
  fs.writeFileSync(path.join(ROOT,'games',id+'.json'),JSON.stringify(project,null,2)+'\n');
  notes.push({id,beforeObjects:before,afterObjects:level.objects.length,meshes:project.assets.length,textures:(project.textures||[]).length,audio:(project.audio||[]).length,description:profile.description,review:'Awaiting rendered audit; no public promotion implied.'});
  console.log(id,level.objects.length,'objects',project.assets.length,'meshes');
}
fs.writeFileSync(path.join(ROOT,'rehabilitation-evidence/flagship-changes.json'),JSON.stringify(notes,null,2));


