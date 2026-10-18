'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const context={window:{addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){},hidden:false},localStorage:{getItem(){return null;},setItem(){}},Float32Array,Uint16Array,Uint32Array,Uint8Array,DataView,ArrayBuffer,TextDecoder,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')};
vm.runInNewContext(fs.readFileSync(path.join(root,'dist/opus-engine.js'),'utf8'),context);
context.Opus=context.window.Opus;
const source=fs.readFileSync(path.join(root,'editor/src/01-editor.js'),'utf8');
// These historical collision labs have no authored context. Link the actual
// logical input helpers and canonical absent-library policy; retain the lab's
// existing requested inputs and all collision oracles unchanged.
Object.assign(context,{playMode:true,inputContexts:undefined,inputContextRuntime:null,lastAppliedCameraItemId:null,activeCameraBlend:null,activeCameraPath:null});
context.inputActionLabels=()=>Object.fromEntries(Object.keys(context.effectiveInputMap||{}).map(id=>[id,id]));
context.inputActionBinding=id=>context.effectiveInputMap?.[id]||null;
vm.runInNewContext(fs.readFileSync(path.join(root,'editor/src/00-input-contexts.js'),'utf8'),context);
for(const name of ['compileInputContextRuntime','inputActionContextState','inputActionDown','inputActionWasPressed']){
  const fn=source.match(new RegExp(`function ${name}\\([^]*?\\n}`));assert(fn,`${name} actual helper must exist`);vm.runInNewContext(fn[0],context);
}
for(const name of ['playerTerrainClearance','applyAiMovementStep','resolveAiSolidMovement','meshFittedItemCollider','itemColliderConfig','resolveItemColliderCollision','hasLineOfSightToPosition','hasLineOfSightToPlayer','constrainTerrainCeilingRise','reconcilePlayerWallContacts','resolveItemVerticalCollision','resolveFinalItemSupport','tryStepUp','hasExplicitGameplayCamera','turnAngleToward','thirdPersonOwnsCameraBearing','updateFirstPersonController','updateThirdPersonController']){
  const fn=source.match(new RegExp(`function ${name}\\([^]*?\\n}`));assert(fn,`${name} real source must exist`);vm.runInNewContext(fn[0],context);
}
// Third-person camera-yaw state and tuning constants, linked from the actual source.
{
  const state=source.match(/^let tpCameraYaw[^\n]*\n^let tpCameraWrittenYaw[^\n]*\n^const TP_TURN_RATE[^\n]*\n^const TP_AUTO_STEER_RATE[^\n]*/m);
  assert(state,'third-person camera-yaw state must exist');vm.runInNewContext(state[0].replace(/^(let|const) /gm,'var '),context);
}
const O=context.Opus;
{
  // Actual Silent Sector native vision event 055036484Z: the guard ray
  // crosses promo-27 at 7.2002m, but its old scale-only box is elsewhere.
  const project=JSON.parse(fs.readFileSync(path.join(root,'games/silent-sector.json'),'utf8'));
  const o=project.levels[0].objects.find(o=>o.id==='promo-27');
  const cover={...o,entity:{position:new O.Vec3(...o.position),scale:new O.Vec3(...o.scale),quaternion:O.Quat.identity(),solid:true,visible:true}};
  const from=new O.Vec3(-22.834475943420163,.75,1.4344654805176182);
  context.player={entity:{position:new O.Vec3(-24.83837681461676,.55,-8.5999)}};context.placed=[cover];
  assert.strictEqual(context.hasLineOfSightToPlayer(from),false,'real guard LOS must use the same measured solid cover that blocks gameplay movement');
  for(const field of ['visible','solid']){
    cover.entity[field]=false;assert.strictEqual(context.hasLineOfSightToPlayer(from),true,`${field}=false cover must not create a ghost occluder`);cover.entity[field]=true;
  }
  assert.strictEqual(context.hasLineOfSightToPlayer(from,cover),true,'an observer is not its own occluder');
  context.player.entity.position=new O.Vec3(0,1,10);
  for(const shape of ['box','sphere']){
    const obstacle={kind:'cube',collider:shape==='box'?{shape,size:{x:8,y:2,z:.2},offset:{x:3,y:1,z:0}}:{shape,radius:.6,offset:{x:0,y:1,z:0}},entity:{position:new O.Vec3(0,0,5),scale:new O.Vec3(.1,.1,.1),quaternion:O.Quat.fromEuler(0,Math.PI/2,0),solid:true,visible:true}};
    context.placed=[obstacle];
    if(shape==='box')context.player.entity.position=new O.Vec3(3,1,10);else context.player.entity.position=new O.Vec3(0,1,10);
    const origin=shape==='box'?new O.Vec3(3,1,0):new O.Vec3(0,1,0);
    assert.strictEqual(context.hasLineOfSightToPlayer(origin),false,`authored ${shape} offset/orientation blocks the real ray`);
    context.player.entity.position=shape==='box'?new O.Vec3(4,1,10):new O.Vec3(2,1,10);
    const clearOrigin=shape==='box'?new O.Vec3(4,1,0):new O.Vec3(2,1,0);
    assert.strictEqual(context.hasLineOfSightToPlayer(clearOrigin),true,`ray outside actual ${shape} remains clear`);
  }
}
{
  const ceiling={kind:'cube',entity:{position:new O.Vec3(0,.2,0),scale:new O.Vec3(9,.4,12),quaternion:O.Quat.identity(),solid:true,visible:true}};
  const previous=new O.Vec3(0,-.56,0),rise={collided:true,grounded:true,correctedPosition:new O.Vec3(.1,-.51,0),correctedVelocity:new O.Vec3(6,0,0)};
  context.placed=[ceiling];
  assert(context.constrainTerrainCeilingRise(rise,previous,.5,.55).correctedPosition.sub(previous).length()<1e-8,'zero upward velocity does not erase actual terrain-driven ceiling crossing');
  for(const candidate of [{...ceiling,entity:{...ceiling.entity,solid:false}},{...ceiling,entity:{...ceiling.entity,visible:false}},{...ceiling,entity:{...ceiling.entity,position:new O.Vec3(20,.2,0)}}]){
    context.placed=[candidate];assert.strictEqual(context.constrainTerrainCeilingRise(rise,previous,.5,.55),rise,'non-solid, hidden and horizontally clear geometry retains terrain movement');
  }
  context.placed=[ceiling];
  assert.strictEqual(context.constrainTerrainCeilingRise({...rise,correctedPosition:new O.Vec3(.1,-.6,0)},previous,.5,.55).correctedPosition.y,-.6,'descent beneath a ceiling remains passable');
  assert.strictEqual(context.constrainTerrainCeilingRise(rise,new O.Vec3(0,-.3,0),.5,.55),rise,'no global spawn/teleport depenetration is introduced');
}
// Real AI dispatch, not a surrogate solver: explicit character collision must
// block Follow movement while historical unconfigured/path actors retain it.
const aiWall={kind:'cube',entity:{position:new O.Vec3(0,1,2),scale:new O.Vec3(10,2,.2),quaternion:O.Quat.identity(),solid:true,visible:true}};
for(const enabled of [false,true]){
  const ai={type:'follow',speed:100,collideWithSolids:enabled,collisionRadius:.3};
  const actor={entity:{position:new O.Vec3(0,0,0),ai,scale:new O.Vec3(1,2,1)}};
  Object.assign(context,{placed:[actor,aiWall],player:{entity:{position:new O.Vec3(0,0,10)}},findItemById:()=>null});
  context.applyAiMovementStep(actor,ai,actor.entity.position,.1,0);
  if(enabled)assert(actor.entity.position.z<1.601,'opt-in real Follow AI must stop at the entry side of an intended solid');
  else assert.strictEqual(actor.entity.position.z,10,'historical AI translation remains unchanged without opt-in');
}
for(const obstacle of [
  {...aiWall,entity:{...aiWall.entity,solid:false}},
  {...aiWall,entity:{...aiWall.entity,visible:false}},
  {...aiWall,entity:{...aiWall.entity,position:new O.Vec3(0,-.1,2),scale:new O.Vec3(10,.2,10)}},
  {...aiWall,entity:{...aiWall.entity,position:new O.Vec3(0,5,2)}}
]){
  const policy={collideWithSolids:true,collisionRadius:.3};
  const actor={entity:{position:new O.Vec3(0,0,0),ai:policy,scale:new O.Vec3(1,2,1)}};
  Object.assign(context,{placed:[actor,obstacle],player:{entity:{position:new O.Vec3(0,0,10)}}});
  context.applyAiMovementStep(actor,{type:'follow',speed:100},actor.entity.position,.1,0);
  assert.strictEqual(actor.entity.position.z,10,'State Machine owner policy preserves non-solid, hidden, supporting floor and overhead passage');
}
{
  const actor={entity:{position:new O.Vec3(0,0,0),ai:{collideWithSolids:true,collisionRadius:.3},scale:new O.Vec3(1,2,1)}};
  Object.assign(context,{placed:[actor,aiWall],player:{entity:{position:new O.Vec3(0,0,10)}}});
  context.applyAiMovementStep(actor,{type:'follow',speed:100},actor.entity.position,.1,0);
  assert(actor.entity.position.z<1.601,'State Machine movement respects its owning actor collision policy');
}
const meshItem={entity:{scale:new O.Vec3(2,3,4),quaternion:O.Quat.fromEuler(0,Math.PI/2,0)}};
const fitted=context.meshFittedItemCollider(meshItem,{positions:[-1,0,-.25,1,2,.75]});
assert(fitted && fitted.size.x===4 && fitted.size.y===6 && fitted.size.z===4,'fit must measure actual mesh vertices at object scale');
assert(Math.abs(fitted.offset.x-1)<1e-6 && fitted.offset.y===3 && Math.abs(fitted.offset.z)<1e-6,'bottom-anchored off-centre mesh fit rotates its world offset');
assert.strictEqual(context.meshFittedItemCollider({...meshItem,parentId:'parent'},{positions:[-1,0,-1,1,2,1]}),null,'parented fitting must not imply unproved world bounds');
assert.strictEqual(context.meshFittedItemCollider(meshItem,{positions:[NaN,0,0,1,2,1]}),null,'invalid mesh bounds rejected');
assert.strictEqual(context.meshFittedItemCollider(meshItem,{positions:[0,0,0,1,0,1]}),null,'zero-volume mesh does not silently receive inflated geometry');
const wall={entity:{position:new O.Vec3(0,2,4.98),scale:new O.Vec3(20,4,.1),quaternion:O.Quat.identity()}};
// Captured actual-controller crossing: requested end is inside the wall's far
// contact envelope. Endpoint depenetration must not override continuous entry.
for(const endZ of [4.97,5,5.41,6.5]){
  const r=context.resolveItemColliderCollision(new O.Vec3(0,1,endZ),new O.Vec3(0,0,100),.5,wall,new O.Vec3(0,1,3.56));
  assert(r.collided&&r.correctedPosition.z<4.48,`near-face wall stop required for end ${endZ}, got ${r.correctedPosition.z}`);
}
const reverse=context.resolveItemColliderCollision(new O.Vec3(0,1,4.9),new O.Vec3(0,0,-100),.5,wall,new O.Vec3(0,1,6.5));
assert(reverse.collided&&reverse.correctedPosition.z>5.53,'reverse sweep must stay on its entry side');
const sphere={collider:{shape:'sphere',radius:1},entity:{position:new O.Vec3(0,1,5),scale:new O.Vec3(2,2,2),quaternion:O.Quat.identity()}};
const sphereCross=context.resolveItemColliderCollision(new O.Vec3(0,1,5.7),new O.Vec3(0,0,100),.5,sphere,new O.Vec3(0,1,2));
assert(sphereCross.collided&&sphereCross.correctedPosition.z<=3.501,'sphere entry must precede far-side endpoint overlap');
const ordinary=context.resolveItemColliderCollision(new O.Vec3(0,1,4.6),new O.Vec3(0,0,1),.5,wall);
assert(ordinary.collided&&ordinary.correctedPosition.z<4.48,'no-previous-position overlap behavior retained');
const slide=context.resolveItemColliderCollision(new O.Vec3(1,1,4.8),new O.Vec3(6,0,6),.5,wall,new O.Vec3(0,1,4.4299));
assert(slide.collided&&Math.abs(slide.correctedPosition.x-1)<1e-6&&slide.correctedPosition.z<4.48,'wall contact must preserve the remaining tangential movement');
const sphereSlide=context.resolveItemColliderCollision(new O.Vec3(1,1,4),new O.Vec3(6,0,6),.5,sphere,new O.Vec3(0,1,3.4999));
assert(sphereSlide.collided&&sphereSlide.correctedPosition.x>.9&&sphereSlide.correctedPosition.z<3.501,'sphere contact must preserve tangential movement outside its convex boundary');
// Actual controller code must use authored collision extents for vertical
// eligibility too, not only inside the horizontal resolver. The visible proxy
// deliberately sits below the player; the authored box is above it.
for(const family of ['firstPerson','thirdPerson']){
  const entity={position:new O.Vec3(0,1,3.56),scale:new O.Vec3(1,1.1,1),forward:new O.Vec3(0,0,1)};
  const authoredWall={kind:'cube',collider:{shape:'box',size:{x:20,y:4,z:.1},offset:{x:0,y:3,z:0}},
    entity:{position:new O.Vec3(0,-1,4.98),scale:new O.Vec3(20,.1,.1),quaternion:O.Quat.identity(),solid:true,visible:true}};
  Object.assign(context,{player:{entity,radius:.5},currentPlayerSettings:{moveSpeed:100,acceleration:10000,jumpEnabled:true},
    effectiveInputMap:{moveForward:'KeyW',moveBack:'KeyS',moveLeft:'KeyA',moveRight:'KeyD',jump:'Space',crouch:'KeyC',sprint:'ShiftLeft'},
    app:{input:{isDown:k=>k==='KeyW'},camera:{getBasis:()=>({forward:new O.Vec3(0,0,1)}),setFixedOptions(){}}},
    placed:[authoredWall],STEP_HEIGHT:.5,fpYaw:0,fpJumpKeyWasDown:false,jumpKeyWasDown:false,
    applyCrouchState:()=>false,currentTerrainItem:()=>null,applyPlatformCarry(){},
    applyPlayerPlayBounds:(position,velocity)=>({correctedPosition:position.clone(),correctedVelocity:velocity.clone()})});
  context[family+'Entity']=entity;context[family+'Velocity']=new O.Vec3();context[family+'Grounded']=true;
  context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.1);
  assert(entity.position.z<4.48,`${family} must not reject an authored collider because its render proxy is below the mover`);
  // Actual first-/third-person controllers consume the exact authored mesh
  // sections, not a replacement low-level collision model. Fast input must
  // cross the opening yet stop against the stone post at the same elevation.
  for(const key of ['doorway-frame','ruin-wall-window','arch','arch-broken','arch-pointed']){
    const architecture={assets:[require('../tools/showcase-assets').getMesh(key)],prefabs:[],levels:[{id:'lab',objects:[{id:'opening',kind:'cube',assetId:'showcase-'+key,position:[0,0,5],scale:[1.3,1.3,1.3],rotationY:0,solid:false,behaviors:[]}]}]};
    require('../tools/real-demo-architectural-assemblies').repair(architecture);
    context.placed=architecture.levels[0].objects.map(o=>({...o,entity:{position:new O.Vec3(...o.position),scale:new O.Vec3(...o.scale),quaternion:O.Quat.identity(),solid:o.solid,visible:true}}));
    for(const [x,blocked] of [[0,false],[-1.45*1.3,true]]){
      entity.position=new O.Vec3(x,1,3);context[family+'Velocity']=new O.Vec3();context[family+'Grounded']=true;
      context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.1);
      assert(blocked?entity.position.z<5:entity.position.z>8,`${family} ${key}: actual input must ${blocked?'block at post':'pass through opening'}, got ${entity.position.z}`);
    }
  }
  for(const key of ['railing','rope-fence']){
    const fence={assets:[require('../tools/showcase-assets').getMesh(key)],prefabs:[],levels:[{id:'lab',objects:[{id:'fence',kind:'cube',assetId:'showcase-'+key,position:[0,0,5],scale:[1,1,1],rotationY:0,solid:false,behaviors:[]}]}]};
    require('../tools/real-demo-architectural-assemblies').repair(fence);
    context.placed=fence.levels[0].objects.map(o=>({...o,entity:{position:new O.Vec3(...o.position),scale:new O.Vec3(...o.scale),quaternion:O.Quat.identity(),solid:o.solid,visible:true}}));
    for(const [y,blocked] of [[.55,true],[3,false]]){
      entity.position=new O.Vec3(.5,y,3);context[family+'Velocity']=new O.Vec3();context[family+'Grounded']=blocked;
      context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.1);
      assert(blocked?entity.position.z<5:entity.position.z>8,`${family} ${key}: fast actual input must ${blocked?'block at physical horizontal member':'remain clear above the fence'}, got ${entity.position.z}`);
    }
  }
  // The same real controller must land on the rendered yaw-rotated footprint,
  // not its unrotated proxy; the reciprocal point must not gain ghost support.
  const platform={kind:'cube',entity:{position:new O.Vec3(0,0,0),scale:new O.Vec3(1,1,10),quaternion:O.Quat.fromEuler(0,Math.PI/2,0),solid:true,visible:true}};
  context.placed=[platform];context.app.input.isDown=()=>false;
  for(const [x,z,shouldLand] of [[3,0,true],[0,3,false]]){
    entity.position=new O.Vec3(x,1.06,z);context[family+'Velocity']=new O.Vec3();context[family+'Grounded']=false;
    context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.05);
    assert.strictEqual(context[family+'Grounded'],shouldLand,`${family} rotated platform support at ${x},${z}`);
    if(shouldLand)assert(Math.abs(entity.position.y-1.05)<1e-6,'feet land on the real rotated top surface');
  }
  // First-person always owns gravity/jump, including historical projects
  // without the third-person jumpEnabled flag. The final reconciliation must
  // not mistake its supporting floor for an XZ wall.
  if(family==='firstPerson')for(const flag of [undefined,false,true]){
    const floor={kind:'cube',entity:{position:new O.Vec3(0,-.5,0),scale:new O.Vec3(40,1,40),quaternion:O.Quat.identity(),solid:true,visible:true}};
    context.placed=[floor];context.app.input.isDown=()=>false;context.currentPlayerSettings={moveSpeed:6,acceleration:40,jumpEnabled:flag};
    entity.position=new O.Vec3(0,.55,0);context.firstPersonVelocity=new O.Vec3();context.firstPersonGrounded=true;
    context.updateFirstPersonController(.0167);
    assert(Math.abs(entity.position.x)<1e-8&&Math.abs(entity.position.z)<1e-8,'historical first-person supporting floor must not push an idle player sideways');
    assert(Math.abs(entity.position.y-.55)<1e-8,'historical first-person floor support is retained');
  }
  // Real Skyway geometry: a later higher platform's horizontal response can
  // push a falling player back over an earlier support already checked this
  // frame. The final body must land, not end embedded below that support.
  context.placed=[
    {kind:'cube',entity:{position:new O.Vec3(0,-.5,0),scale:new O.Vec3(10,1,10),quaternion:O.Quat.identity(),solid:true,visible:true}},
    {kind:'cube',entity:{position:new O.Vec3(0,.5,8),scale:new O.Vec3(5.4,1,4.4),quaternion:O.Quat.identity(),solid:true,visible:true}}
  ];
  entity.position=new O.Vec3(0,.55,5.2999);context[family+'Velocity']=new O.Vec3();context[family+'Grounded']=true;
  context.app.input.isDown=k=>k==='KeyW';context.currentPlayerSettings={moveSpeed:6.5,acceleration:60,jumpEnabled:true};
  const finalSupport=context.resolveFinalItemSupport;context.resolveFinalItemSupport=()=>null;
  context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.0712);
  assert(entity.position.y<.55-1e-6,`${family}: captured frame reproduces the original ordering defect without the final support repair`);
  context.resolveFinalItemSupport=finalSupport;
  entity.position=new O.Vec3(0,.55,5.2999);context[family+'Velocity']=new O.Vec3();context[family+'Grounded']=true;
  context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.0712);
  assert(entity.position.y>=.55-1e-6,`${family}: later horizontal correction must not invalidate earlier platform support; position=${JSON.stringify(entity.position)}, velocity=${JSON.stringify(context[family+'Velocity'])}`);
  // Captured native Moving Temple route: terrain lifts the head through the
  // underside of the lower court. Treating that floor as an XZ wall ejects
  // the body over three metres into the adjacent pillar.
  {
    const project=JSON.parse(fs.readFileSync(path.join(root,'games/moving-temple.json'),'utf8'));
    const objects=project.levels[0].objects;
    context.placed=objects.filter(o=>['deep6-1','promo-7'].includes(o.id)).map(o=>({...o,entity:{position:new O.Vec3(...o.position),scale:new O.Vec3(...o.scale),quaternion:O.Quat.fromEuler(0,o.rotationY||0,0),solid:o.solid,visible:true}}));
    const options={...objects.find(o=>o.kind==='terrain').options};options.position=new O.Vec3(...options.position);
    context.currentTerrainItem=()=>({options});
    // Explicit fitted bodies use half-height at terrain and ceiling, rather
    // than radius. The actual rendered ranger must clear the same underside.
    entity.scale.y=1.855;
    entity.position=new O.Vec3(.23821205,-.9325,-3.8530763);
    context[family+'Velocity']=new O.Vec3(1,0,0);context[family+'Grounded']=true;
    context.currentPlayerSettings={collisionHeight:1.855,moveSpeed:1,acceleration:100,jumpEnabled:true};
    context.app.input.isDown=()=>false;
    context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.0167);
    assert(entity.position.y+.9275<=1e-6,`${family}: fitted ranger head cannot rise through the solid court`);
    // Terrain support uses the same actual feet, not the horizontal radius.
    context.placed=[];entity.position=new O.Vec3(10,-10,0);context[family+'Velocity']=new O.Vec3();
    const ground=O.Terrain.sampleHeight(10-options.position.x,0-options.position.z,options)+options.position.y;
    context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.0167);
    assert(Math.abs(entity.position.y-.9275-ground)<1e-6,`${family}: fitted terrain feet stay on rendered ground`);
    context.placed=objects.filter(o=>['deep6-1','promo-7'].includes(o.id)).map(o=>({...o,entity:{position:new O.Vec3(...o.position),scale:new O.Vec3(...o.scale),quaternion:O.Quat.fromEuler(0,o.rotationY||0,0),solid:o.solid,visible:true}}));
    entity.scale.y=1.1;
    entity.position=new O.Vec3(-.0522878,-.55594535,-3.34487784);
    const previous=entity.position.clone();
    context[family+'Velocity']=new O.Vec3(7.55,0,0);context[family+'Grounded']=true;
    context.currentPlayerSettings={moveSpeed:7.55,acceleration:10000,jumpEnabled:true};
    context.app.camera.getBasis=()=>({forward:new O.Vec3(1,0,0)});context.fpYaw=Math.PI/2;
    context.app.input.isDown=k=>k==='KeyW';
    context['update'+family[0].toUpperCase()+family.slice(1)+'Controller'](.0167);
    assert(entity.position.sub(previous).length()<.3,`${family}: terrain/ceiling contact must not eject across the court: ${JSON.stringify(entity.position)}`);
    assert(entity.position.y+.55<=1e-6,`${family}: terrain rise must not put the head through the court underside`);
    context.currentTerrainItem=()=>null;context.app.camera.getBasis=()=>({forward:new O.Vec3(0,0,1)});context.fpYaw=0;
  }
}
// Native Relic Runner 2: a later pillar response moves the final body into
// the earlier rotated wall. Native Survival Arena: bounds do the same to a
// perimeter pillar. Reconcile only this movement frame, not authoring/spawn.
{
  const fn=source.match(/function reconcilePlayerWallContacts\([^]*?\n}/);
  if(fn)vm.runInNewContext(fn[0],context);
  if(fn){
    let boundaryCalls=0;context.placed=[];context.applyPlayerPlayBounds=(p,v)=>{boundaryCalls++;return {correctedPosition:p,correctedVelocity:v};};
    const p=new O.Vec3(3,4,5),v=new O.Vec3(6,7,8),safe=context.reconcilePlayerWallContacts(p,v,.5,p,null);
    assert.deepStrictEqual([safe.correctedPosition.x,safe.correctedPosition.y,safe.correctedPosition.z],[3,4,5]);
    assert.deepStrictEqual([safe.correctedVelocity.x,safe.correctedVelocity.y,safe.correctedVelocity.z],[6,7,8]);
    assert.strictEqual(boundaryCalls,0,'a clear endpoint must not double-apply historical map-edge forces');
  }
  const entity=(position,scale,yaw,collider)=>({kind:'cube',collider,entity:{position:new O.Vec3(...position),scale:new O.Vec3(...scale),quaternion:O.Quat.fromEuler(0,yaw,0),solid:true,visible:true}});
  const gap=(pos,item,r)=>{const cfg=context.itemColliderConfig(item),local=item.entity.quaternion.conjugate().rotateVec3(pos.sub(item.entity.position.add(cfg.offset)));return Math.hypot(Math.max(0,Math.abs(local.x)-cfg.half.x),Math.max(0,Math.abs(local.z)-cfg.half.z))-r;};
  for(const fixture of [
    {r:.5,previous:[-2.9435525638455533,.36889962047840763,-3.6935626280392237],end:[-2.905147214655954,.36615537631926065,-3.7249790389555946],items:[entity([-4,1,-6],[1.5,1.5,4],.6),entity([-2,-.17256378668086153,-4],[.9,.9,.9],.4,{shape:'box',size:{x:.881388,y:2.214,z:.881388},offset:{x:0,y:1.107,z:0}})],bound:p=>p.clone()},
    {r:.55,previous:[7.332789242875076,-1.8878190535120898,8.45],end:[7.350463215147111,-1.8875907857619179,8.45],items:[entity([7.424621202458749,-2.4917626318223176,7.4246212024587495],[.7,.7,.7],Math.PI/4,{shape:'box',size:{x:.685524,y:1.722,z:.685524},offset:{x:0,y:.861,z:0}})],bound:p=>new O.Vec3(Math.max(-8.45,Math.min(8.45,p.x)),p.y,Math.max(-8.45,Math.min(8.45,p.z)))}
  ]){
    context.placed=fixture.items;context.applyPlayerPlayBounds=(p,v)=>({correctedPosition:fixture.bound(p),correctedVelocity:v.clone()});
    const end=new O.Vec3(...fixture.end),previous=new O.Vec3(...fixture.previous),v=new O.Vec3(2,0,-2);
    const result=fn?context.reconcilePlayerWallContacts(end,v,fixture.r,previous,null):{correctedPosition:end};
    assert(fixture.items.every(item=>gap(result.correctedPosition,item,fixture.r)>=-1e-5),`later candidate/bounds must not invalidate earlier real wall clearance: ${JSON.stringify({position:result.correctedPosition,gaps:fixture.items.map(item=>gap(result.correctedPosition,item,fixture.r)),previousGaps:fixture.items.map(item=>gap(previous,item,fixture.r))})}`);
    assert(Math.abs(result.correctedPosition.y-end.y)<1e-10,'horizontal reconciliation preserves terrain/vertical result');
  }
}
console.log('Actual shared controller source: crossing endpoint / reverse / sphere / legacy overlap PASS');
// 2026-10-18 controls/collision repairs, against the actual controller source.
{
  // Low ledges: the solid push keeps the mover's centre one radius outside, so
  // step-up must test the footprint, not the centre. Tall walls stay walls.
  const slab=h=>({kind:'cube',entity:{position:new O.Vec3(0,h/2,0),scale:new O.Vec3(4,h,4),quaternion:O.Quat.identity(),solid:true,visible:true}});
  Object.assign(context,{STEP_HEIGHT:.5});
  const touching=()=>({position:new O.Vec3(0,.55,-2.5001),scale:new O.Vec3(.6,1.1,.6)});
  let mover=touching();assert(context.tryStepUp(mover,new O.Vec3(0,0,3),.55,true,slab(.28),.5),'a 28cm ledge touched by the footprint is climbed');
  assert(Math.abs(mover.position.y-(.28+.55))<1e-9,'stepping lands the feet on the ledge top');
  assert(!context.tryStepUp(touching(),new O.Vec3(0,0,3),.55,true,slab(1.5),.5),'a wall above STEP_HEIGHT still blocks');
  assert(!context.tryStepUp({position:new O.Vec3(0,.55,-2.9),scale:new O.Vec3(.6,1.1,.6)},new O.Vec3(0,0,3),.55,true,slab(.28),.5),'a ledge out of reach is not climbed');
  assert(!context.tryStepUp(touching(),new O.Vec3(0,0,3),.55,false,slab(.28),.5),'airborne movers do not step');
  // Trunk collider: blocks at the trunk, not across the whole canopy.
  const tree=require('../tools/showcase-assets').getMesh('tree-birch');
  const item={kind:'cube',assetId:'showcase-tree-birch',entity:{position:new O.Vec3(0,0,0),scale:new O.Vec3(.8,.8,.8),quaternion:O.Quat.identity()}};
  for(const name of ['meshTrunkItemCollider']){const fn=source.match(new RegExp(`function ${name}\\([^]*?\\n}`));assert(fn,`${name} real source must exist`);vm.runInNewContext(fn[0],context);}
  const full=context.meshFittedItemCollider(item,tree),trunk=context.meshTrunkItemCollider(item,tree);
  assert(full&&trunk,'tree mesh fits both boxes');
  assert(trunk.size.x<full.size.x*.6&&trunk.size.z<full.size.z*.6,'trunk footprint is much narrower than the canopy box');
  assert(Math.abs(trunk.size.y-full.size.y)<1e-9,'trunk collider keeps the full height');
}
{
  // Third-person strafe must not feed back through the chase camera: holding A
  // used to spin the player in circles because movement was camera-relative
  // and the camera followed the character's facing.
  const entity={position:new O.Vec3(0,1,0),scale:new O.Vec3(.6,1.1,.6),rotationY:0};
  const camera={mode:'chase',targetEntity:entity,chaseOptions:{bearingMode:'followTarget',bearingYaw:0,pitch:.28},getBasis:()=>({forward:new O.Vec3(Math.sin(entity.rotationY),0,Math.cos(entity.rotationY))}),setChaseOptions(o){Object.assign(this.chaseOptions,o);}};
  Object.assign(context,{player:{entity,radius:.5},currentPlayerSettings:{moveSpeed:6.5,acceleration:30,jumpEnabled:false},
    effectiveInputMap:{moveForward:'KeyW',moveBack:'KeyS',moveLeft:'KeyA',moveRight:'KeyD',jump:'Space',crouch:'KeyC',sprint:'ShiftLeft'},
    app:{input:{isDown:k=>k==='KeyA'},camera,settings:{get:()=>false}},placed:[],tpCameraWrittenYaw:null,tpCameraYaw:0,
    applyCrouchState:()=>false,currentTerrainItem:()=>null,applyPlatformCarry(){},
    applyPlayerPlayBounds:(position,velocity)=>({correctedPosition:position.clone(),correctedVelocity:velocity.clone()})});
  context.thirdPersonEntity=entity;context.thirdPersonVelocity=new O.Vec3();context.thirdPersonGrounded=true;
  const yaws=[];for(let i=0;i<180;i++){context.updateThirdPersonController(1/60);yaws.push(context.tpCameraYaw);}
  assert(yaws.every(y=>Math.abs(y)<1e-9),'pure strafe never rotates the camera');
  assert(Math.abs(entity.position.z)<.05&&entity.position.x<-5,`holding A strafes in a straight line: ${JSON.stringify(entity.position)}`);
  assert.strictEqual(camera.chaseOptions.bearingMode,'fixed','the controller owns the chase bearing');
  // Facing turns at a bounded rate, never an instant snap.
  entity.rotationY=0;context.tpCameraYaw=0;context.app.input.isDown=k=>k==='KeyS';context.updateThirdPersonController(1/60);
  assert(Math.abs(entity.rotationY)<=context.TP_TURN_RATE/60+1e-9,'reversing turns gradually');
  // An authored camera bearing is respected (ownership released).
  camera.chaseOptions.bearingYaw=1.234;context.tpCameraYaw=0;context.updateThirdPersonController(1/60);
  assert.strictEqual(camera.chaseOptions.bearingYaw,1.234,'authored fixed bearing is not overwritten');
}
console.log('Controls/collision repairs: low-ledge step-up, trunk colliders, third-person strafe loop PASS');
