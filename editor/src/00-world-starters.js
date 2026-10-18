(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusWorldStarters=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  let sequence=0;
  const catalog=[{id:'woodland-courtyard',name:'Woodland Courtyard',description:'A walkable courtyard, editable hillside, reusable fence and mist region.'},{id:'coastal-workshop',name:'Coastal Workshop',description:'A shoreline workspace, water, editable hillside and reusable fence.'}];
  function cube(id,name,position,scale,color,extra){return {id,kind:'cube',name,position,scale,color,rotationY:0,behaviors:[],...(extra||{})};}
  function instantiate(id){
    if(id==='firstperson-wayfinder')return explorationStarter();
    if(id==='firstperson-target-range')return shooterStarter();
    if(id==='thirdperson-relic-trail')return adventureStarter();
    if(id==='thirdperson-sparring-court')return combatStarter();
    if(id==='hovercraft-switchback')return racingStarter();
    if(id==='defense-lane')return defenseStarter();
    if(id==='escape-lock-room')return escapeStarter();
    const stress=id==='world-stress',entry=catalog.find(e=>e.id===id);
    if(!entry&&!stress)throw new Error('Unknown world starter: '+id);
    const coastal=id==='coastal-workshop',title=stress?'World-building stress scene':entry.name;
    const objects=[
      {id:'terrain-hillside',kind:'terrain',name:'Hillside — sculpt and paint',options:{seed:coastal?27:12,size:36,segments:32,radius:16,position:[-24,-2,0]}},
      cube('courtyard-floor','Courtyard ground',stress?[0,-.5,35]:[0,-.5,0],stress?[70,1,110]:[12,1,28],coastal?[.45,.4,.3]:[.25,.35,.25],{solid:true}),
      cube('player-spawn','Player start',[0,0,-5],[.3,.3,.3],[.3,.9,.9],{isSpawnPoint:true,isDefaultSpawn:true}),
      cube('courtyard-wall','Solid courtyard wall',[0,1.5,10],[12,3,.5],[.45,.5,.55],{solid:true}),
      cube('fence-source','Fence module — capture or reuse',[5,1,0],[.2,2,2],[.45,.3,.18],{solid:true}),
      cube('mist-region','Mist region — edit Environment effect',[0,1,3],[8,4,6],[.6,.8,.9],{isTrigger:true,triggerRepeat:true,behaviors:[{trigger:'enter',action:'setFogZone',params:{fogColor:'#abc5c7',fogDensity:.06,priority:0,blendDuration:.3},sourcePreset:'environment-zone-setup'},{trigger:'exit',action:'setFogZone',params:{fogColor:'',blendDuration:.3},sourcePreset:'environment-zone-setup'}]}),
      {id:'fence-path',kind:'path',name:'Fence route — populate from Prefab',pointIds:['fence-point-a','fence-point-b'],loop:false,smooth:false},
      cube('fence-point-a','Fence route start',[5,1,-6],[.2,.2,.2],[1,.6,.2],{isPathPoint:true,pathId:'fence-path'}),
      cube('fence-point-b','Fence route end',[5,1,8],[.2,.2,.2],[1,.6,.2],{isPathPoint:true,pathId:'fence-path'})
    ];
    for(let n=0;n<6;n++)objects.push(cube('fence-'+n,'Fence panel '+(n+1),[-5,1,-6+n*2.4],[.2,2,2],[.45,.3,.18],{solid:true}));
    if(coastal)objects.push({id:'shore-water',kind:'water',name:'Shore water — visual, not solid',options:{size:32,segments:24,position:[20,-1.6,0]}});
    if(stress)for(let z=0;z<16;z++)for(let x=0;x<16;x++){const px=(x-7.5)*4;if(Math.abs(px)<4)continue;objects.push(cube('stress-prop-'+x+'-'+z,'Editable yard prop '+x+'/'+z,[px,.5,18+z*4],[.8,1,.8],[.3+x*.02,.35,.25+z*.015],{solid:true}));}
    const environment={lightDir:{x:-.5,y:-1,z:-.3},skyTop:[.15,.35,.65],skyHorizon:[.65,.8,.95],groundColor:[.16,.16,.14],sunColor:[1,.95,.85],fogDensity:.008,shadows:{enabled:false,resolution:1024,distance:30,bias:.0025}};
    const description='Walk with WASD; the wall and fences are solid, the mist region is pass-through. Sculpt/paint the named hillside, populate the fence route, paint a Scatter Layer using the fence Prefab, and change Level atmosphere. All content is ordinary editable records.';
const project={format:'digital-opus-project',version:7,levels:[{id:'level1',name:title,objects,environment,playerSettings:{controllerType:'thirdperson',moveSpeed:6,jumpEnabled:true,gravity:20,jumpSpeed:8,collisionRadius:.4},ui:{startScreen:{enabled:false},hudElements:[]},description,ambientAudio:null,sequences:[],objectiveDefs:[],scatterLayers:[]}],currentLevelIndex:0,startLevelIndex:0,levelTransition:{mode:'instant',duration:.4},prefabs:[{name:'World kit — Fence module',record:cube('fence-prefab','Reusable world fence',[0,0,0],[.2,2,2],[.45,.3,.18],{solid:true})}],assets:[],textures:[],spriteAssets:[],spriteAnimations:[],tilesets:[],tilemapChunks:[],audio:[],inputActionMap:{},itemDefs:[],meta:{title,description,instructions:'WASD to explore; Space to jump. Edit named objects and Level Environment.',author:'',version:'1.0.0'}};
    return {projectName:'world-project-'+(++sequence),project};
  }
  function explorationStarter(){
    const created=instantiate('woodland-courtyard'),project=created.project,level=project.levels[0];
    const spawn=cube('player-spawn','Explorer start — default spawn',[0,0,-6],[.3,.3,.3],[.3,.9,.9],{isSpawnPoint:true,isDefaultSpawn:true,behaviors:[{trigger:'start',action:'setCounter',params:{counter:'archives',value:0}}]});
    const archive=cube('archive','Gold archive — Interact to recover',[-4,.8,1],[1,1.6,1],[1,.75,.25],{components:{interactable:{version:1,enabled:true,range:2.5,prompt:'recover the gold archive'}},behaviors:[{trigger:'interact',action:'incrementCounter',params:{counter:'archives'}},{trigger:'interact',action:'destroyObject',params:{}}]});
    const beacon=cube('beacon','Green beacon — requires archive',[0,.8,6],[1.2,1.6,1.2],[.25,.85,.65],{components:{interactable:{version:1,enabled:true,range:2.5,prompt:'activate the beacon after recovering the archive'}},behaviors:[{trigger:'interact',action:'graph',graph:{graphVersion:1,nodes:[{id:'has-archive',type:'counterReaches',counter:'archives',target:1,x:340,y:20},{id:'finish',type:'win',x:340,y:260}],edges:[{from:'start',to:'finish',kind:'next'},{from:'has-archive',to:'finish',kind:'gate'}],variables:[]}}]});
    archive.unlit=true;beacon.unlit=true; // Editable flat marker colors stay recognizable on shaded faces.
    level.objects=[cube('floor','Courtyard floor',[0,-.5,0],[20,1,20],[.22,.32,.3],{solid:true}),spawn,cube('west','West wall',[-10,1.5,0],[.5,3,20],[.45,.55,.6],{solid:true}),cube('east','East wall',[10,1.5,0],[.5,3,20],[.45,.55,.6],{solid:true}),cube('north','North wall',[0,1.5,10],[20,3,.5],[.45,.55,.6],{solid:true}),cube('south','South wall',[0,1.5,-10],[20,3,.5],[.45,.55,.6],{solid:true}),cube('ruin','Central ruin — solid, explore around',[0,1.5,-1],[3,3,2],[.42,.48,.55],{solid:true}),archive,beacon];
    level.name='Wayfinder Courtyard';level.playerSettings={controllerType:'firstperson',moveSpeed:5,acceleration:40,collisionRadius:.4,maxHealth:100,gravity:20,jumpSpeed:8,mouseSensitivity:.0022,fovDegrees:70,eyeHeight:.6};
    level.ui={startScreen:{enabled:false},winTitle:'Archive recovered!',winMessage:'You explored the courtyard and activated the beacon. Edit the solid ruin, Interactable prompts and ordinary goal Graph to build your own exploration.',hudElements:[{id:'exploration-guide',kind:'label',visible:true,anchor:'bottom-center',offsetX:0,offsetY:-8,text:'WASD: explore · Mouse: look · F: interact · Archives: {archives}'}]};
    project.prefabs=[];project.meta.title='First-person Exploration — Wayfinder';project.meta.description='Explore around a solid ruin, recover the gold archive and activate the green beacon. Ordinary no-code objects and Graph, no combat or Script.';project.meta.instructions=level.ui.hudElements[0].text;level.description=project.meta.description;return created;
  }
  function shooterStarter(){
    const created=explorationStarter(),project=created.project,level=project.levels[0];
    level.objects=level.objects.filter(x=>!['ruin','archive'].includes(x.id));
    const spawn=level.objects.find(x=>x.id==='player-spawn');spawn.behaviors=[{trigger:'start',action:'setCounter',params:{counter:'kills',value:0}},{trigger:'start',action:'refillPlayerAmmo',params:{}}];
    for(let i=0;i<3;i++)level.objects.push(cube('target-'+(i+1),'Training target '+(i+1)+' — editable Health',[0,1.2,i*3],[1,1.8,1],[1,.4+i*.15,.25],{unlit:true,tags:['enemy'],health:{max:30,current:30},components:{health:{version:1,max:30,current:30}}}));
    level.objects.push(cube('range-cover','Range cover — solid and blocks shots',[-4,1.5,2],[2,3,1],[.4,.5,.6],{solid:true,unlit:true}));
    const beacon=level.objects.find(x=>x.id==='beacon');beacon.position=[4,.8,6];beacon.name='Range beacon — requires three targets';beacon.components.interactable.prompt='finish after clearing three targets';const condition=beacon.behaviors[0].graph.nodes.find(x=>x.id==='has-archive');condition.counter='kills';condition.target=3;
    project.weaponDefinitions=[{kind:'WeaponDefinition',version:2,id:'range-rifle',name:'Training Rifle',config:{mode:'hitscan',damageType:'ordinary',damage:15,cooldown:.2,range:25,ammoMode:'magazine',magazineSize:2,startingMagazine:2,reserveAmmo:4,reloadDuration:.6,fireMode:'semi',spreadDegrees:0,recoilHorizontal:0,recoilVertical:0,crosshair:true,tracer:true,muzzleEffect:true,impactEffect:true}}];
    level.playerSettings.weapon={enabled:true,source:'fixed',definitionRef:'range-rifle'};
    project.inputActionMap={attack:'Mouse0',reload:'KeyR'};
    level.name='Training Range';level.ui.winTitle='Range cleared!';level.ui.winMessage='You cleared three targets and activated the range beacon. Edit the named Training Rifle, target Health, cover and goal Graph. Try again with Restart in the standalone game, or Back to Editor and Play. A fresh attempt restores targets and ammunition.';level.ui.hudElements[0].text='WASD: move · Mouse: aim/fire · R: reload · F: finish · Targets: {kills}/3 · Ammo: {ammo}/{reserveAmmo}';
    project.meta.title='First-person Shooter — Training Range';project.meta.description='A two-round named Hitscan rifle, three editable Health targets, solid cover and a guarded finish beacon. Native attack/reload and ordinary no-code Graphs.';project.meta.instructions=level.ui.hudElements[0].text;level.description=project.meta.description;return created;
  }
  function adventureStarter(){
    const created=explorationStarter(),project=created.project,level=project.levels[0];
    level.playerSettings={controllerType:'thirdperson',moveSpeed:5,acceleration:30,collisionRadius:.4,maxHealth:100,jumpEnabled:true,gravity:20,jumpSpeed:8,initialYaw:0,initialPitch:.28};
    level.objects.push({id:'trail-camera',kind:'camera',name:'Trail camera — fixed-bearing chase, edit framing',isActiveCamera:true,options:{mode:'chase',projection:'perspective',fovDegrees:70,near:.1,far:100,position:[0,3,-10],obstruction:{enabled:true,radius:.25,padding:.05},chase:{distance:3.2,height:2.3,pitch:.35,lerpSpeed:6.5,rotationLerpSpeed:8.5,lookAhead:0,bearingMode:'fixed',bearingYaw:0}}});
    level.objects.find(x=>x.id==='ruin').unlit=true;
    const first=level.objects.find(x=>x.id==='archive');first.name='Gold relic — west trail';first.components.interactable.prompt='recover the gold relic';
    const second=JSON.parse(JSON.stringify(first));second.id='archive-2';second.name='Amber relic — east trail';second.position=[4,.8,1];second.color=[1,.45,.2];second.components.interactable.prompt='recover the amber relic';level.objects.push(second);
    level.objects.push(cube('trail-step','East trail step — solid, jump or explore around',[4,.3,3],[2,.6,2],[.55,.65,.7],{solid:true,unlit:true}));
    const beacon=level.objects.find(x=>x.id==='beacon');beacon.name='Adventure beacon — requires both relics';beacon.components.interactable.prompt='activate after recovering both relics';beacon.behaviors[0].graph.nodes.find(x=>x.id==='has-archive').target=2;
    level.name='Relic Trail';level.ui.winTitle='Trail restored!';level.ui.winMessage='You recovered both relics and restored the trail beacon. Edit the Third-person Player, solid ruin and step, Interactable relics and goal Graph. Restart in the standalone game, or return to the editor and Play again.';
    level.ui.hudElements[0].text='WASD: explore · Space: jump · F: recover relic / activate · Relics: {archives}/2';
    project.meta.title='Third-person Adventure — Relic Trail';project.meta.description='Explore around the solid courtyard ruin, recover two ordinary editable relics and restore the guarded beacon. Existing Third-person chase camera and jump, no combat or Script.';project.meta.instructions=level.ui.hudElements[0].text;level.description=project.meta.description;return created;
  }
  function combatStarter(){
    const created=adventureStarter(),project=created.project,level=project.levels[0];
    level.objects=level.objects.filter(x=>!['ruin','archive','archive-2','trail-step'].includes(x.id));
    level.objects.find(x=>x.id==='player-spawn').behaviors=[{trigger:'start',action:'setCounter',params:{counter:'kills',value:0}},{trigger:'start',action:'setPlayerHealth',params:{value:100,maxHealth:100}}];
    project.weaponDefinitions=[{kind:'WeaponDefinition',version:2,id:'court-blade',name:'Court Blade',config:{mode:'melee',damageType:'ordinary',damage:20,cooldown:.3,range:2.5,knockback:0,ammoMode:'infinite',fireMode:'semi',crosshair:false,impactEffect:true}}];
    level.playerSettings.weapon={enabled:true,source:'fixed',definitionRef:'court-blade'};project.inputActionMap={attack:'KeyQ'};
    project.prefabs=[{name:'Court enemy bolt',record:cube('court-bolt','Enemy bolt',[0,0,0],[.18,.18,.18],[1,.3,.15],{unlit:true})}];
    const positions=[[0,1,-1],[-4,1,3],[4,1,3]];positions.forEach((position,i)=>level.objects.push(cube('guard-'+(i+1),'Court guard '+(i+1)+' — editable AI and Health',position,[.8,1.8,.8],[1,.35+i*.12,.2],{unlit:true,tags:['enemy'],behaviors:[{trigger:'start',action:'setPosition',params:{x:position[0],y:position[1],z:position[2]}}],health:{max:40,current:40},components:{health:{version:1,max:40,current:40}},ai:{base:position.slice(),type:'follow',speed:.7,radius:20,targetId:null,collideWithSolids:true,collisionRadius:.4,attackEnabled:true,attackPrefab:'Court enemy bolt',attackRadius:8,attackCooldown:2,attackDamage:5,attackSpeed:5}})));
    level.objects.push(cube('court-cover','Court cover — solid',[-3,1.2,-1],[1.5,2.4,1],[.5,.6,.7],{solid:true,unlit:true}));
    const beacon=level.objects.find(x=>x.id==='beacon');beacon.name='Court beacon — requires three guards';beacon.components.interactable.prompt='finish after defeating three guards';const gate=beacon.behaviors[0].graph.nodes.find(x=>x.id==='has-archive');gate.counter='kills';gate.target=3;
    level.name='Sparring Court';level.ui.winTitle='Court secured!';level.ui.winMessage='You defeated three guards and activated the court beacon. Edit the named Court Blade, guard AI/Health, projectile Prefab and goal Graph. Restart for a fresh attempt.';level.ui.hudElements[0].text='WASD: move · Q: melee · Space: jump · F: finish · Guards: {kills}/3 · Health: {health}';
    project.meta.title='Third-person Combat — Sparring Court';project.meta.description='Face and strike three slow pursuing guards with the named melee blade. Guards fire ordinary Prefab projectiles; solid cover and guarded beacon are editable no-code content.';project.meta.instructions=level.ui.hudElements[0].text;level.description=project.meta.description;return created;
  }
  function racingStarter(){
    const created=adventureStarter(),project=created.project,level=project.levels[0];
    level.objects=level.objects.filter(x=>['floor','player-spawn','west','east','north','south','trail-camera','beacon'].includes(x.id));
    // Hovercraft solids use canonical XZ collision: the flat visual floor is
    // not a wall; its altitude uses the controller's existing ground default.
    const floor=level.objects.find(x=>x.id==='floor');floor.scale=[30,1,30];floor.solid=false;
    for(const id of ['west','east','north','south']){const wall=level.objects.find(x=>x.id===id);wall.position[id==='west'||id==='east'?0:2]=(id==='west'||id==='south'?-15:15);wall.scale=id==='west'||id==='east'?[.5,3,30]:[30,3,.5];}
    const spawn=level.objects.find(x=>x.id==='player-spawn');spawn.position=[0,.55,-9];spawn.behaviors=[{trigger:'start',action:'setCounter',params:{counter:'raceGates',value:0}}];
    level.playerSettings={controllerType:'hovercraft',moveSpeed:5,acceleration:7,steeringRate:1.6,boostImpulse:2,boostAcceleration:4,boostMaxSpeed:8,drag:1.5,maxHealth:100,initialYaw:0};
    const camera=level.objects.find(x=>x.id==='trail-camera');camera.name='Race camera — chase the craft';camera.options.chase={distance:5,height:3.2,pitch:.3,lerpSpeed:6.5,rotationLerpSpeed:8.5,lookAhead:.6};
    const positions=[[0,1,-5],[4,1,1],[0,1,7]];positions.forEach((p,i)=>level.objects.push(cube('race-gate-'+(i+1),'Gate '+(i+1)+' — cross in order',p,[3,2,.6],[[1,.65,.2],[.4,.75,1],[.4,1,.65]][i],{unlit:true,isTrigger:true,triggerRepeat:true,behaviors:[{trigger:'enter',action:'graph',graph:{graphVersion:1,nodes:[{id:'previous',type:'counterEquals',counter:'raceGates',target:i,x:340,y:20},{id:'advance',type:'incrementCounter',counter:'raceGates',x:340,y:260}],edges:[{from:'start',to:'advance',kind:'next'},{from:'previous',to:'advance',kind:'gate'}],variables:[]}}]})));
    level.objects.push(cube('race-barrier','Central barrier — steer right around it',[0,1,-1],[3,2,1],[.55,.65,.75],{solid:true,unlit:true}));
    // Trigger volumes are intentionally hidden during Play. Ordinary colored
    // posts/header give each editable checkpoint a visible driving aperture.
    positions.forEach((p,i)=>{const color=[[1,.65,.2],[.4,.75,1],[.4,1,.65]][i];for(const side of [-1,1])level.objects.push(cube('race-post-'+(i+1)+'-'+(side<0?'left':'right'),'Gate '+(i+1)+' visible post',[p[0]+side*1.8,1.3,p[2]],[.3,2.6,.3],color.slice(),{unlit:true}));level.objects.push(cube('race-header-'+(i+1),'Gate '+(i+1)+' visible header',[p[0],2.6,p[2]],[3.9,.25,.3],color.slice(),{unlit:true}));});
    const beacon=level.objects.find(x=>x.id==='beacon');beacon.position=[0,.8,10];beacon.name='Finish beacon — all three ordered gates';beacon.components.interactable.prompt='finish after crossing gates 1, 2 and 3';const gate=beacon.behaviors[0].graph.nodes.find(x=>x.id==='has-archive');gate.counter='raceGates';gate.target=3;
    level.name='Switchback Circuit';level.ui.winTitle='Circuit complete!';level.ui.winMessage='You crossed all three gates in order and reached the finish. Edit the Hovercraft handling, Camera, solid barrier and ordinary gate Graphs. Restart for a fresh race.';level.ui.hudElements[0].text='W/S: throttle/reverse · A/D: steer · Space: Boost · Cross gates 1→2→3 · F: finish · Gates: {raceGates}/3';
    project.meta.title='Hovercraft Racing — Switchback Circuit';project.meta.description='Drive through three ordered colored gates, steer around the solid barrier, then activate the finish beacon. Existing Hovercraft handling and editable no-code Graphs.';project.meta.instructions=level.ui.hudElements[0].text;level.description=project.meta.description;return created;
  }
  function defenseStarter(){
    const created=adventureStarter(),project=created.project,level=project.levels[0];
    level.objects=level.objects.filter(x=>['floor','player-spawn','west','east','north','south','trail-camera','beacon'].includes(x.id));
    const spawn=level.objects.find(x=>x.id==='player-spawn');spawn.position=[-7,0,-6];spawn.behaviors=[{trigger:'start',action:'setCounter',params:{counter:'kills',value:0}},{trigger:'start',action:'setPlayerHealth',params:{value:100,maxHealth:100}}];
    const bolt=cube('defense-bolt','Defense bolt',[0,0,0],[.16,.16,.16],[.3,.8,1],{unlit:true});
    const hostileBolt=cube('breach-bolt','Raider bolt',[0,0,0],[.16,.16,.16],[1,.3,.15],{unlit:true});
    const raider=cube('lane-raider','Lane raider — targets defended core',[0,1,0],[.8,1.8,.8],[1,.35,.2],{unlit:true,tags:['raider'],health:{max:30,current:30},components:{health:{version:1,max:30,current:30}},ai:{base:[0,1,0],type:'follow',speed:1.5,radius:20,targetId:'defended-core',collideWithSolids:true,collisionRadius:.4,attackEnabled:true,attackPrefab:'Raider bolt',attackRadius:2.5,attackCooldown:1,attackDamage:10,attackSpeed:10}});
    project.prefabs=[{name:'Defense bolt',record:bolt},{name:'Raider bolt',record:hostileBolt},{name:'Lane raider',record:raider}];
    level.objects.push(cube('defended-core','Defended core — ordinary Health50',[0,1,7],[1.8,2,1.8],[.25,.9,.6],{unlit:true,tags:['core'],health:{max:50,current:50},components:{health:{version:1,max:50,current:50}}}));
    for(const[x,n]of [[-3,1],[3,2]])level.objects.push(cube('defense-tower-'+n,'Tower '+n+' — move/tune before Play',[x,1,0],[1,2,1],[.3,.65,1],{unlit:true,tags:['defense'],ai:{base:[x,1,0],type:'faceTarget',speed:1,radius:5,targetSelection:'nearestTag',targetTag:'raider',targetRange:5,attackEnabled:true,attackPrefab:'Defense bolt',attackRadius:5,attackCooldown:.6,attackDamage:15,attackSpeed:12}}));
    level.objects.push({id:'raider-spawner',kind:'spawner',name:'Finite raiders — four total, edit pacing',options:{position:[0,1,-7],prefabName:'Lane raider',interval:2,initialDelay:1,maxActive:4,totalCount:4,radius:0,startEnabled:true,tag:'raider'}});
    // An ordinary Update Graph detects both a depleted and a removed core.
    // Health-driven removal increments legacy kills; alive-core gating prevents
    // that event from masquerading as the fourth enemy kill and awarding Win.
    const alive={id:'core-alive',type:'objectHealthAtLeast',targetId:'defended-core',target:1,x:300,y:20};
    level.objects.push(cube('defense-rules','Core-loss rule — editable Update Graph',[-9,.2,8],[.2,.2,.2],[.3,.4,.5],{unlit:true,behaviors:[{trigger:'update',action:'graph',graph:{graphVersion:1,nodes:[alive,{id:'core-lost',type:'not',x:300,y:180},{id:'lose-defense',type:'lose',x:300,y:360}],edges:[{from:'start',to:'lose-defense',kind:'next'},{from:'core-alive',to:'core-lost',kind:'cond'},{from:'core-lost',to:'lose-defense',kind:'gate'}],variables:[]}}]}));
    const beacon=level.objects.find(x=>x.id==='beacon');beacon.position=[-7,.8,-3];beacon.name='Defense finish — four raiders and surviving core';beacon.components.interactable.prompt='finish after defeating four raiders with the core alive';beacon.behaviors=[{trigger:'interact',action:'graph',graph:{graphVersion:1,nodes:[{id:'four-raiders',type:'counterEquals',counter:'kills',target:4,x:300,y:20},{...alive,x:600,y:20},{id:'finish-defense',type:'win',x:450,y:260}],edges:[{from:'start',to:'finish-defense',kind:'next'},{from:'four-raiders',to:'finish-defense',kind:'gate'},{from:'core-alive',to:'finish-defense',kind:'gate'}],variables:[]}}];
    level.objects.push(cube('raider-lane','Raider lane — visible, non-solid',[0,.02,0],[2,.05,15],[.48,.34,.24],{unlit:true}));
    const camera=level.objects.find(x=>x.id==='trail-camera');camera.name='Defense camera — fixed lane overview, edit framing';camera.options={...camera.options,mode:'fixed',position:[0,18,-18],lookAtTargetId:'raider-lane'};
    level.name='Core Defense Lane';level.ui.winTitle='Core defended!';level.ui.winMessage='Four finite raiders defeated and the core survived. Tune/move the ordinary towers, enemy Prefab, finite Spawner, Health and goal Graphs. No build economy or wave manager is included.';level.ui.loseTitle='Core lost';level.ui.loseMessage='The raiders destroyed the defended core. Move/tune the two towers before Play, or restart for a fresh defense.';level.ui.hudElements[0].text='Before Play: move/tune blue towers · Defeat four raiders · Keep green core alive · F: finish · Raiders: {kills}/4';
    project.meta.title='Tower Defense — Core Defense Lane';project.meta.description='A bounded editable defensive lane: two automatic tagged-target towers, four finite spawned raiders and a Health-driven defended core. Ordinary Brain/Prefab/Spawner/Graph; no Script, economy or second wave runtime.';project.meta.instructions=level.ui.hudElements[0].text;level.description=project.meta.description;return created;
  }
  function escapeStarter(){
    const created=explorationStarter(),project=created.project,level=project.levels[0];
    level.objects=level.objects.filter(o=>['floor','player-spawn','west','east','north','south','beacon'].includes(o.id));
    level.playerSettings.jumpEnabled=false;
    level.objects.find(o=>o.id==='player-spawn').behaviors=[{trigger:'start',action:'setCounter',params:{counter:'escapeStep',value:0}}];
    const graph=(nodes,edges)=>({graphVersion:1,nodes,edges,variables:[]});
    const interact=(prompt)=>({interactable:{version:1,enabled:true,range:2.5,prompt}});
    const amber=cube('amber-lock','Amber console — first in the clue',[-4,.8,-3],[1,1.6,1],[1,.65,.2],{unlit:true,components:interact('set the amber lock first'),behaviors:[{trigger:'interact',action:'graph',graph:graph([{id:'fresh',type:'counterEquals',counter:'escapeStep',target:0,x:340,y:20},{id:'amber-set',type:'setCounter',counter:'escapeStep',value:1,x:340,y:260}],[{from:'start',to:'amber-set',kind:'next'},{from:'fresh',to:'amber-set',kind:'gate'}])}]});
    const blue=cube('blue-lock','Blue console — amber must be set first',[4,.8,-3],[1,1.6,1],[.3,.65,1],{unlit:true,components:interact('set blue after amber to open the partition door'),behaviors:[{trigger:'interact',action:'graph',graph:graph([{id:'amber-ready',type:'counterEquals',counter:'escapeStep',target:1,x:340,y:20},{id:'blue-set',type:'setCounter',counter:'escapeStep',value:2,x:340,y:260},{id:'both-ready',type:'counterEquals',counter:'escapeStep',target:2,x:660,y:20},{id:'unlock-door',type:'openDoor',targetId:'escape-door',x:340,y:480}],[{from:'start',to:'blue-set',kind:'next'},{from:'amber-ready',to:'blue-set',kind:'gate'},{from:'blue-set',to:'unlock-door',kind:'next'},{from:'both-ready',to:'unlock-door',kind:'gate'}])}]});
    level.objects.push(amber,blue,cube('escape-door','Partition door — real solid Door / Gate',[0,1.5,2],[3,3,.5],[.6,.45,.7],{solid:true,unlit:true,components:{'door-gate':{version:1,enabled:true,startsOpen:false,persistState:false}}}),cube('partition-west','Solid partition — west of doorway',[-5.75,1.5,2],[8.5,3,.5],[.4,.5,.6],{solid:true}),cube('partition-east','Solid partition — east of doorway',[5.75,1.5,2],[8.5,3,.5],[.4,.5,.6],{solid:true}));
    const beacon=level.objects.find(o=>o.id==='beacon');beacon.name='Escape beacon — both locks and open door';beacon.components=interact('escape after setting amber then blue and crossing the open door');beacon.behaviors=[{trigger:'interact',action:'graph',graph:graph([{id:'both-locks',type:'counterEquals',counter:'escapeStep',target:2,x:340,y:20},{id:'door-closed',type:'doorIsClosed',targetId:'escape-door',x:660,y:20},{id:'door-open',type:'not',x:660,y:220},{id:'escape',type:'win',x:420,y:440}],[{from:'start',to:'escape',kind:'next'},{from:'both-locks',to:'escape',kind:'gate'},{from:'door-closed',to:'door-open',kind:'cond'},{from:'door-open',to:'escape',kind:'gate'}])}];
    level.name='Amber / Blue Lock Room';level.ui.winTitle='Room escaped!';level.ui.winMessage='You set amber before blue, opened the physical partition door and reached the exit. Edit the clue, console Graphs, Door / Gate and guarded exit; no Script or separate puzzle runtime.';level.ui.hudElements[0].text='WASD: move · Mouse: look · F: use · Clue: AMBER then BLUE · Cross the unlocked partition · Locks: {escapeStep}/2';
    project.prefabs=[];project.meta.title='Puzzle / Escape Room — Amber / Blue Locks';project.meta.description='Read the clue, set the amber and blue consoles in order, cross the real Door / Gate and activate the guarded exit. Wrong-order and repeated interactions are inert; partial Restart resets the locks and door.';project.meta.instructions=level.ui.hudElements[0].text;level.description=project.meta.description;return created;
  }
  return Object.freeze({list:()=>catalog.map(e=>({...e})),instantiate});
}));
