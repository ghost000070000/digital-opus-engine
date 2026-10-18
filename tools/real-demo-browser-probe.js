'use strict';
// Qualification-only: drive actual exported catalog games with real browser input.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qualification/real-demo-collision');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'games/catalog.json'))).games.filter(g => g.visibility === 'public');
const stamp = new Date().toISOString().replace(/[-:.]/g, ''), runId = `probe-${stamp}`;
const wallCampaign = process.argv.includes('--walls');
const extendedCampaign = process.argv.includes('--extended');
const tier = (process.argv.find(a=>a.startsWith('--tier='))||'--tier=playable').split('=')[1];
if(!['source','editable','playable'].includes(tier))throw new Error(`Unsupported tier ${tier}`);
const args = process.argv.slice(2).filter(a=>!a.startsWith('--'));
const selected = process.argv.includes('--all') ? catalog.map(game=>game.id) : args.length ? args : ['arsenal-run'];
const fingerprint = require('./real-demo-program-state').fingerprint();
fs.mkdirSync(path.join(out, runId), { recursive: true });
async function state(page) {
  return page.evaluate(() => ({
    sim: typeof simElapsed === 'undefined' ? null : simElapsed,
    started: typeof playMode !== 'undefined' && playMode,
    ended: typeof gameEnded !== 'undefined' && gameEnded,
    playerFrozen:typeof playerFrozen==='undefined'?null:playerFrozen,
    ending:document.querySelector('#end-overlay.visible')?{text:document.querySelector('#end-overlay').textContent}:null,
    coverObservations:window.__coverObservations||null,
    player: typeof player === 'undefined' || !player ? null : {
      id: player.id || player.entity.id || null, family: player.controllerType,
      fallbackVisible:player.entity.visible,
      authoredVisual:typeof playerVisualEntity==='undefined'||!playerVisualEntity?null:{visible:playerVisualEntity.visible,position:{x:playerVisualEntity.position.x,y:playerVisualEntity.position.y,z:playerVisualEntity.position.z}},
      position: {x:player.entity.position.x,y:player.entity.position.y,z:player.entity.position.z}, radius:player.radius,
      yaw:player.entity.rotationY, velocity:player.velocity,
      height:player.entity.scale.y,
      grounded:player.controllerType==='firstperson'?firstPersonGrounded:player.controllerType==='thirdperson'?thirdPersonGrounded:null,
      stepHeight:player.controllerType==='firstperson'?STEP_HEIGHT:0,
    },
    currentLevel: typeof currentLevelIndex === 'undefined' ? null : currentLevelIndex,
    gameplayFlags:window.__gameFlags||null,
    heldObject:typeof heldObjectItem==='undefined'||!heldObjectItem?null:{id:heldObjectItem.id,position:heldObjectItem.entity.position},
    doorVisuals:typeof placed==='undefined'?[]:placed.filter(i=>['showcase-door','showcase-blast-door'].includes(i.assetId)||i.assetId?.startsWith('collision-gate-visual-')).map(i=>({id:i.id,assetId:i.assetId,parentId:i.parentId||null,position:i.entity.position,scale:i.entity.scale,visible:i.entity.visible,solid:i.entity.solid})),
    interactableState:typeof placed==='undefined'?[]:placed.filter(i=>(i.behaviors||[]).some(b=>b.trigger==='interact')).map(i=>({id:i.id,position:i.entity.position,behaviorParams:i.behaviorParams||{},variables:i.variables||{}})),
    solids: typeof placed === 'undefined' ? [] : placed.filter(i => i.entity && i.entity.solid).map(i => ({
      id:i.id,name:i.name,kind:i.kind,visible:i.entity.visible,solid:i.entity.solid,
      position:i.entity.position,scale:i.entity.scale,rotation:i.entity.quaternion,
      assetId:i.assetId||null,collider:i.collider || null,components:i.components || {},ramp:!!i.isRamp,
      collisionGeometry:itemColliderConfig(i),collisionCenter:i.entity.position.add(itemColliderConfig(i).offset),
    })),
    terrain: typeof placed === 'undefined' ? [] : placed.filter(i => i.kind === 'terrain').map(i=>({id:i.id,options:i.options})),
    terrainUnderPlayer: typeof player==='undefined'||!player?null:(()=>{const t=currentTerrainItem(player.entity.position);return t?{id:t.id,height:t.handle.sampleHeight(player.entity.position.x,player.entity.position.z)}:null;})(),
    playerVisual:typeof playerVisualEntity==='undefined'||!playerVisualEntity?null:(()=>{
      const e=playerVisualEntity,a=findAssetById(currentPlayerSettings.visual?.assetId);if(!a?.positions||!e.skin)return {position:e.position,assetId:currentPlayerSettings.visual?.assetId,assetFound:!!a,skinAvailable:!!e.skin};
      // Engine-private fields are deliberately mangled in exports. Use the
      // canonical public sampler. This bounds the current unblended clip;
      // during a crossfade it is not an exact shader-pose measurement.
      let minY=Infinity,maxY=-Infinity;const matrices=Opus.Skin.computePalette(e.skin,e.animationClip,e.animationTime);
      for(let v=0;v<a.positions.length/3;v++){const x=a.positions[v*3],y=a.positions[v*3+1],z=a.positions[v*3+2];let sx=0,sy=0,sz=0;
        for(let k=0;k<4;k++){const joint=a.joints[v*4+k]*16,w=a.weights[v*4+k];sx+=w*(matrices[joint]*x+matrices[joint+4]*y+matrices[joint+8]*z+matrices[joint+12]);sy+=w*(matrices[joint+1]*x+matrices[joint+5]*y+matrices[joint+9]*z+matrices[joint+13]);sz+=w*(matrices[joint+2]*x+matrices[joint+6]*y+matrices[joint+10]*z+matrices[joint+14]);}
        const world=e.quaternion.rotateVec3(new Opus.Vec3(sx*e.scale.x,sy*e.scale.y,sz*e.scale.z)).add(e.position);minY=Math.min(minY,world.y);maxY=Math.max(maxY,world.y);
      }return {position:e.position,scale:e.scale,clip:e.animationClip,clipTime:e.animationTime,sampledClipMinY:minY,sampledClipMaxY:maxY,method:'Read-only public skin sampler and visual world transform; unblended clip bounds, not exact shader pose during crossfade'};
    })(),
    registry: typeof collisionLayers === 'undefined' ? null : collisionLayers,
    metrics: window.__realDemoProbe || null,
    fpYaw: typeof fpYaw === 'undefined' ? null : fpYaw,
    cameraBasis: typeof app === 'undefined' ? null : app.camera.getBasis(),
  }));
}
async function advance(page, seconds) {
  const start=await page.evaluate(()=>simElapsed);
  await page.waitForFunction(t=>simElapsed>=t||gameEnded,start+seconds,{timeout:30000});
}
async function steeringState(page) {
  return page.evaluate(()=>({sim:simElapsed,ended:gameEnded,fpYaw:typeof fpYaw==='undefined'?null:fpYaw,
    speedInput:player.controllerType==='hovercraft'?effectiveInputMap.jump:effectiveInputMap.sprint,crouchInput:effectiveInputMap.crouch,
    cameraBasis:app.camera.getBasis(),player:{family:player.controllerType,position:player.entity.position,velocity:{x:player.velocity.x,y:player.velocity.y,z:player.velocity.z},yaw:player.entity.rotationY,height:player.entity.scale.y,grounded:player.controllerType==='thirdperson'?thirdPersonGrounded:player.controllerType==='firstperson'?firstPersonGrounded:null},
    metrics:{contacts:window.__realDemoProbe.contacts,recent:window.__realDemoProbe.recent}}));
}
function withNativeSpeed(keys,state,step){
  if(process.argv.includes('--crouch')&&['firstperson','thirdperson'].includes(state.player.family)&&state.crouchInput){const code=state.crouchInput;return [...keys,/^Key/.test(code)?code.slice(3).toLowerCase():code];}
  if(!process.argv.includes('--fast')||state.player.family==='topdown'||!state.speedInput)return keys;
  const code=state.speedInput,key=code==='Space'?'Space':/^Shift/.test(code)?'Shift':/^Key/.test(code)?code.slice(3).toLowerCase():code;
  return state.player.family==='hovercraft'&&step%40!==0?keys:[...keys,key];
}
function directionKeys(s, target) {
  const p=s.player.position, dx=target.position.x-p.x,dz=target.position.z-p.z;
  if(s.player.family==='topdown'){
    const len=Math.hypot(dx,dz)||1;
    return [...(Math.abs(dz)/len>.38?[dz<0?'w':'s']:[]),...(Math.abs(dx)/len>.38?[dx>0?'d':'a']:[])];
  }
  if(s.player.family==='hovercraft'){
    let angle=Math.atan2(dx,dz)-s.player.yaw;while(angle>Math.PI)angle-=Math.PI*2;while(angle<-Math.PI)angle+=Math.PI*2;
    return ['w',...(Math.abs(angle)>.15?[angle>0?'a':'d']:[])];
  }
  let fx,fz;
  if(s.player.family==='firstperson'){fx=Math.sin(s.fpYaw);fz=Math.cos(s.fpYaw);}
  else if(s.player.family==='topdown'){fx=0;fz=-1;}
  else{fx=s.cameraBasis.forward.x;fz=s.cameraBasis.forward.z;const len=Math.hypot(fx,fz)||1;fx/=len;fz/=len;}
  const f=dx*fx+dz*fz, r=dx*fz-dz*fx, len=Math.hypot(dx,dz)||1;
  return [...(Math.abs(f)/len>.38?[f>0?'w':'s']:[]),...(Math.abs(r)/len>.38?[r>0?'d':'a']:[])];
}
async function wallRoute(page,record,directory) {
  await advance(page,.7); const initial=await state(page),p=initial.player.position;
  const solids=initial.solids.map(i=>({...i,entityPosition:i.position,entityScale:i.scale,position:i.collisionCenter,
    scale:i.collisionGeometry.shape==='box'?{x:i.collisionGeometry.half.x*2,y:i.collisionGeometry.half.y*2,z:i.collisionGeometry.half.z*2}:i.scale}));
  const candidates=solids.filter(i=>i.kind==='cube'&&i.visible&&!i.ramp&&i.scale.y>.4&&
    i.scale.y>=Math.min(i.scale.x,i.scale.z)*.3&&Math.abs(i.position.y-p.y)<4&&
    (initial.player.family==='hovercraft'||(
      i.position.y+i.scale.y/2>p.y-initial.player.height/2+.05&&
      i.position.y-i.scale.y/2<p.y+initial.player.height/2-.05)));
  const score=i=>Math.hypot(i.position.x-p.x,i.position.z-p.z)-(i.scale.y>=2&&Math.max(i.scale.x,i.scale.z)>=6?50:i.scale.y>=1.2?10:0);
  candidates.sort((a,b)=>score(a)-score(b));
  const explicitWall=process.argv.find(arg=>arg.startsWith('--wall='))?.slice(7);
  let target=explicitWall?solids.find(item=>item.id===explicitWall):candidates[0];
  record.wallRoute={status:target?'APPROACHING':explicitWall?'AUTHORED_WALL_ID_NOT_FOUND':'NO_ELIGIBLE_WALL_NEAR_SPAWN',target:target||null,initial:initial.player,steps:[]};
  if(!target)return;
  const aimForWall=wall=>{
    if(!process.argv.includes('--nearest-wall-point'))return wall;
    const point={...wall.position};
    if(wall.scale.x>wall.scale.z*3)point.x=Math.max(wall.position.x-wall.scale.x/2+1,Math.min(wall.position.x+wall.scale.x/2-1,p.x));
    else if(wall.scale.z>wall.scale.x*3)point.z=Math.max(wall.position.z-wall.scale.z/2+1,Math.min(wall.position.z+wall.scale.z/2-1,p.z));
    return {position:point};
  };
  if(initial.player.family==='firstperson'&&process.argv.includes('--face')){
    if(!await page.evaluate(()=>document.pointerLockElement===canvas))await page.locator('#game').click({position:{x:640,y:360}});
    const look=await page.evaluate(()=>({locked:document.pointerLockElement===canvas,yaw:fpYaw,sensitivity:effectiveMouseSensitivity()}));
    if(look.locked){
      let angle=Math.atan2(target.position.x-p.x,target.position.z-p.z)-look.yaw;while(angle>Math.PI)angle-=Math.PI*2;while(angle<-Math.PI)angle+=Math.PI*2;
      // Native mouse events through the actual pointer-lock listener, no yaw write.
      let mouseX=640+angle/look.sensitivity;
      await page.mouse.move(mouseX,360,{steps:30});await advance(page,.1);
      for(let correction=0;correction<3;correction++){
        const current=await page.evaluate(()=>({yaw:fpYaw,position:player.entity.position}));
        let error=Math.atan2(target.position.x-current.position.x,target.position.z-current.position.z)-current.yaw;while(error>Math.PI)error-=Math.PI*2;while(error<-Math.PI)error+=Math.PI*2;
        if(Math.abs(error)<.08)break;mouseX+=error/look.sensitivity;await page.mouse.move(mouseX,360,{steps:15});await advance(page,.1);
      }
    }
    record.wallRoute.nativeLook={...look,afterYaw:await page.evaluate(()=>fpYaw)};
  }
  let held=[],contact=null;
  try{
    for(let step=0;step<(process.argv.includes('--traverse')?180:80);step++) {
      const before=await steeringState(page); if(before.ended){record.wallRoute.status='GAME_ENDED_DURING_ROUTE';break;}
      const keys=withNativeSpeed(directionKeys(before,aimForWall(target)),before,step);
      if(process.argv.includes('--traverse')&&before.player.grounded&&step%10===0)keys.push('Space');
      for(const key of held.filter(k=>!keys.includes(k)))await page.keyboard.up(key);
      for(const key of keys.filter(k=>!held.includes(k))){await page.keyboard.down(key);record.inputAttempts++;}
      held=keys; await advance(page,.1);
      const after=await steeringState(page);
      record.wallRoute.steps.push({keys,before:before.player.position,after:after.player.position,sim:after.sim,contacts:after.metrics.contacts});
      contact=after.metrics.recent.find(c=>c.time>=initial.sim&&c.target===target.id);
      if(!contact&&!explicitWall){
        contact=after.metrics.recent.find(c=>c.time>=initial.sim&&candidates.some(i=>i.id===c.target));
        if(contact){record.wallRoute.originalTarget=target;target=candidates.find(i=>i.id===contact.target);record.wallRoute.target=target;}
      }
      if(contact)break;
    }
    if(contact) {
      const atContact=await state(page);await page.screenshot({path:path.join(directory,`${record.id}-wall-contact.png`)});
      for(let step=0;step<8;step++){
        const current=await steeringState(page), keys=withNativeSpeed(directionKeys(current,aimForWall(target)),current,step);
        for(const key of held.filter(k=>!keys.includes(k)))await page.keyboard.up(key);
        for(const key of keys.filter(k=>!held.includes(k))){await page.keyboard.down(key);record.inputAttempts++;}
        held=keys;await advance(page,.25);
      }
      const heldState=await state(page);
      const contactedWall=heldState.solids.find(i=>i.id===target.id);
      record.wallRoute.contact=contact;record.wallRoute.held=heldState.player;
      record.wallRoute.contactCount=(heldState.metrics.contactsByTarget[target.id]||0)-(atContact.metrics.contactsByTarget[target.id]||0);
      // Explicitly observational, not a full collision verdict: wall may be moved/disabled by gameplay.
      record.wallRoute.status=record.wallRoute.contactCount>=5&&contactedWall?.solid?'SUSTAINED_REAL_WALL_CONTACT':'CONTACT_NOT_SUSTAINED';
      await page.screenshot({path:path.join(directory,`${record.id}-wall-held.png`)});
    } else if(record.wallRoute.status==='APPROACHING')record.wallRoute.status='TARGET_NOT_REACHED_WITH_NATIVE_INPUT';
  }finally{for(const key of held)await page.keyboard.up(key);}
}
async function authoredObjectRoute(page,record,directory){
  let id=process.argv.find(a=>a.startsWith('--through='))?.slice(10);
  if(!id&&process.argv.includes('--pass-through')) {
    id=await page.evaluate(()=>placed.filter(i=>i.kind==='cube'&&i.entity?.visible&&!i.entity.solid&&!i.entity.ai&&!(i.tags||[]).includes('enemy')&&/showcase-(tree-|bush|fern|grass|flower)/.test(i.assetId||''))
      .sort((a,b)=>a.entity.position.sub(player.entity.position).length()-b.entity.position.sub(player.entity.position).length())[0]?.id);
    if(!id){record.authoredObjectRoute={status:'NO_AUTHORED_DECORATIVE_PASS_THROUGH_CANDIDATE'};return;}
  }
  if(!id)return;
  const partArg=process.argv.find(a=>a.startsWith('--through-part='))?.slice(15);let sourceVertices=null;
  if(partArg!==undefined){const n=Number(partArg),entry=catalog.find(g=>g.id===record.id),project=JSON.parse(fs.readFileSync(path.join(root,'games',entry.file))),object=project.levels.flatMap(l=>l.objects).find(o=>o.id===id),asset=project.assets.find(a=>a.id===object?.assetId),part=asset&&require('./real-demo-masonry-assembly').components(asset)[n];if(!Number.isInteger(n)||n<0||!part)throw new Error('Invalid observed mesh part');sourceVertices=part.sourceIndices;}
  const target=await page.evaluate(({id,sourceVertices})=>{
    const i=placed.find(i=>i.id===id);if(!i)return null;const a=findAssetById(i.assetId),e=i.entity;
    const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
    if(a?.positions)for(const v of sourceVertices||Array.from({length:a.positions.length/3},(_,i)=>i)){const n=v*3,w=e.quaternion.rotateVec3(new Opus.Vec3(a.positions[n]*e.scale.x,a.positions[n+1]*e.scale.y,a.positions[n+2]*e.scale.z)).add(e.position);for(const k of ['x','y','z']){min[k]=Math.min(min[k],w[k]);max[k]=Math.max(max[k],w[k]);}}
    else for(const k of ['x','y','z']){min[k]=e.position[k]-Math.abs(e.scale[k])/2;max[k]=e.position[k]+Math.abs(e.scale[k])/2;}
    return {id,name:i.name,assetId:i.assetId,visible:e.visible,solid:e.solid===true,collider:i.collider||null,position:{x:(min.x+max.x)/2,y:(min.y+max.y)/2,z:(min.z+max.z)/2},min,max};
  },{id,sourceVertices});
  if(target&&sourceVertices)target.observedMeshPart=Number(partArg);
  record.authoredObjectRoute={target,status:target?'APPROACHING_AUTHORED_VISUAL':'TARGET_NOT_PRESENT',steps:[]};if(!target)return;
  const initial=await steeringState(page),dx=target.position.x-initial.player.position.x,dz=target.position.z-initial.player.position.z,len=Math.hypot(dx,dz)||1;
  const extent=Math.hypot(target.max.x-target.min.x,target.max.z-target.min.z)/2+1;
  const destination={position:{x:target.position.x+dx/len*extent,z:target.position.z+dz/len*extent}};
  function intersects(a,b,verticalHalf=0){let lo=0,hi=1;for(const k of ['x','y','z']){const min=target.min[k]-(k==='y'?verticalHalf:0),max=target.max[k]+(k==='y'?verticalHalf:0),delta=b[k]-a[k];if(Math.abs(delta)<1e-8){if(a[k]<min||a[k]>max)return false;}else{let t0=(min-a[k])/delta,t1=(max-a[k])/delta;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;}}return true;}
  let held=[],crossing=false;
  record.authoredObjectRoute.method='Native two-leg route via authored visual bounds centre, then beyond; read-only swept centre/AABB observation, not triangle containment';
  try{for(let step=0;step<150;step++){
    const before=await steeringState(page);if(before.ended){record.authoredObjectRoute.status='GAME_ENDED_DURING_ROUTE';break;}
    if(!crossing&&Math.hypot(before.player.position.x-target.position.x,before.player.position.z-target.position.z)<.15)crossing=true;
    const keys=withNativeSpeed(directionKeys(before,crossing?destination:target),before,step);for(const k of held.filter(k=>!keys.includes(k)))await page.keyboard.up(k);for(const k of keys.filter(k=>!held.includes(k))){await page.keyboard.down(k);record.inputAttempts++;}held=keys;await advance(page,.1);
    const after=await steeringState(page),moved=Math.hypot(after.player.position.x-before.player.position.x,after.player.position.z-before.player.position.z)>.01,entered=moved&&intersects(before.player.position,after.player.position),bodyEntered=moved&&intersects(before.player.position,after.player.position,before.player.height/2);
    // Legacy hovercraft solids are explicitly XZ-only, regardless of altitude.
    // Observe the exact asset footprint separately; never call this mesh/body entry.
    const midY=(target.min.y+target.max.y)/2,xzEntered=moved&&intersects({...before.player.position,y:midY},{...after.player.position,y:midY});
    record.authoredObjectRoute.steps.push({keys,before:before.player.position,after:after.player.position,sim:after.sim,segmentIntersectsVisualBounds:entered,verticalBodyIntersectsVisualBounds:bodyEntered,bodyHeight:before.player.height,legacyHoverFootprintEntry:before.player.family==='hovercraft'&&xzEntered});
    if(before.player.family==='hovercraft'&&xzEntered&&!record.authoredObjectRoute.legacyFootprintEntry){record.authoredObjectRoute.legacyFootprintEntry={before:before.player.position,after:after.player.position,sim:after.sim,method:'Exact XZ asset AABB crossed by native movement; actual hovercraft collision policy ignores altitude; not visual/body intersection'};crossing=true;await page.screenshot({path:path.join(directory,record.id+'-'+id+'-legacy-footprint-entry.png')});}
    if(moved&&record.authoredObjectRoute.legacyFootprintEntry&&!record.authoredObjectRoute.legacyFootprintExit&&(after.player.position.x<target.min.x||after.player.position.x>target.max.x||after.player.position.z<target.min.z||after.player.position.z>target.max.z))record.authoredObjectRoute.legacyFootprintExit={before:before.player.position,after:after.player.position,sim:after.sim};
    if(entered&&!record.authoredObjectRoute.entry){record.authoredObjectRoute.entry={before:before.player.position,after:after.player.position,sim:after.sim};await page.screenshot({path:path.join(directory,record.id+'-'+id+'-visual-entry.png')});}
    // Once real movement entered the authored bounds, continue across them.
    // Do not require hitting an arbitrary 15cm point under camera smoothing.
    if(entered)crossing=true;
    if(bodyEntered&&!record.authoredObjectRoute.bodyEntry){record.authoredObjectRoute.bodyEntry={before:before.player.position,after:after.player.position,sim:after.sim,height:before.player.height,method:'Centre XZ segment crosses exact asset world AABB; actual vertical body extent overlaps Y bounds. No radial inflation or triangle-contact claim'};await page.screenshot({path:path.join(directory,record.id+'-'+id+'-body-entry.png')});crossing=true;}
    if(moved&&record.authoredObjectRoute.bodyEntry&&!record.authoredObjectRoute.bodyExit&&!intersects(after.player.position,after.player.position,before.player.height/2))record.authoredObjectRoute.bodyExit={before:before.player.position,after:after.player.position,sim:after.sim};
    if(crossing&&Math.hypot(after.player.position.x-destination.position.x,after.player.position.z-destination.position.z)<.5){record.authoredObjectRoute.status=record.authoredObjectRoute.entry?'NATIVE_MOVEMENT_THROUGH_VISUAL_BOUNDS':record.authoredObjectRoute.bodyEntry?'NATIVE_BODY_MOVEMENT_THROUGH_VISUAL_BOUNDS':'DESTINATION_REACHED_WITHOUT_VISUAL_ENTRY';break;}
  }if(record.authoredObjectRoute.status==='APPROACHING_AUTHORED_VISUAL')record.authoredObjectRoute.status=record.authoredObjectRoute.entry?'VISUAL_ENTRY_OBSERVED_DESTINATION_UNPROVEN':'VISUAL_NOT_ENTERED_WITH_NATIVE_INPUT';
  const final=await state(page);record.authoredObjectRoute.final=final.player;record.authoredObjectRoute.targetContacts=final.metrics.contactsByTarget[id]||0;
  if(target.solid===false&&record.authoredObjectRoute.bodyEntry&&record.authoredObjectRoute.bodyExit&&record.authoredObjectRoute.targetContacts===0&&!record.authoredObjectRoute.status.startsWith('NATIVE_'))record.authoredObjectRoute.passThroughObservation='NATIVE_BODY_ENTRY_AND_EXIT_OBSERVED_DESTINATION_SEPARATELY_UNPROVEN';
  if(target.solid&&!record.authoredObjectRoute.entry&&record.authoredObjectRoute.targetContacts>=5)record.authoredObjectRoute.blockedObservation='NATIVE_MOVEMENT_BLOCKED_BY_AUTHORED_VISUAL_SOLID';
  await page.screenshot({path:path.join(directory,record.id+'-'+id+'-through-result.png')});
  }finally{for(const k of held)await page.keyboard.up(k);}
}
async function nativeWaypoints(page,record){
  const raw=process.argv.find(a=>a.startsWith('--via='))?.slice(6);if(!raw)return;
  record.nativeIntroWait={startedAt:new Date().toISOString()};await page.waitForFunction(()=>!playerFrozen||gameEnded,{},{timeout:30000});record.nativeIntroWait.endedAt=new Date().toISOString();
  record.nativeWaypoints=[];
  for(const pair of raw.split(';')){
    const parts=pair.split(','),x=Number(parts[0]),z=Number(parts[1]),interactId=parts[2]||null;if(!Number.isFinite(x)||!Number.isFinite(z))throw new Error('Invalid qualification waypoint');
    const target={position:{x,z}},proof={target:target.position,status:'APPROACHING_NATIVE',steps:[]};record.nativeWaypoints.push(proof);let held=[];
    if((await steeringState(page)).ended){proof.status='GAME_ENDED';proof.observation=await state(page);break;}
    if(process.argv.includes('--precise-waypoints')&&(await steeringState(page)).player.family==='firstperson'){
      if(!await page.evaluate(()=>document.pointerLockElement===canvas))await page.locator('#game').click({position:{x:640,y:360}});
      await page.mouse.move(640,360);await advance(page,.05);
      const look=await page.evaluate(()=>({locked:document.pointerLockElement===canvas,yaw:fpYaw,sensitivity:effectiveMouseSensitivity(),position:player.entity.position}));
      if(look.locked){let error=Math.atan2(x-look.position.x,z-look.position.z)-look.yaw;while(error>Math.PI)error-=Math.PI*2;while(error<-Math.PI)error+=Math.PI*2;await page.mouse.move(640+error/look.sensitivity,360,{steps:15});await advance(page,.05);proof.nativeLook={before:look.yaw,after:await page.evaluate(()=>fpYaw),method:'Actual pointer-lock mouse movement, no yaw writes'};}
    }
    let planned=null,pathIndex=0,stalled=0,nativeMouse=null;
    if(process.argv.includes('--navigate-waypoints')&&(await steeringState(page)).player.family==='firstperson'){const observed=await state(page),options={radius:observed.player.radius,height:observed.player.height,grounded:observed.player.grounded,stepHeight:observed.player.stepHeight,reach:interactId?2.15:.45};planned=require('./real-demo-native-route').plan(observed.player.position,{x,z},observed.solids,options);if(planned.status==='NO_CLEAR_OBSERVED_ROUTE'){proof.wideClearancePlan=planned;planned=require('./real-demo-native-route').plan(observed.player.position,{x,z},observed.solids,{...options,step:.25,padding:.02});}proof.routePlan=planned;}
    if(planned&&process.argv.includes('--steer-waypoints')){
      if(!await page.evaluate(()=>document.pointerLockElement===canvas))await page.locator('#game').click({position:{x:640,y:360}});
      await page.mouse.move(640,360);await advance(page,.05);
      const look=await page.evaluate(()=>({locked:document.pointerLockElement===canvas,sensitivity:effectiveMouseSensitivity()}));
      if(look.locked)nativeMouse={x:640,sensitivity:look.sensitivity};
      proof.nativeSteering={method:'Real pointer-lock mouse aiming at observed route points; actual keyboard movement; no yaw/Transform writes',pointerLocked:look.locked,turns:0};
    }
    try{for(let n=0;n<(planned?300:120);n++){
      let before=await steeringState(page);if(before.ended){proof.status='GAME_ENDED';break;}
      if(interactId&&await page.evaluate(id=>nearestInteractable?.id===id,interactId)){
        for(const key of held)await page.keyboard.up(key);held=[];
        const code=await page.evaluate(()=>effectiveInputMap.interact);await page.keyboard.press(/^Key/.test(code)?code.slice(3).toLowerCase():code);record.inputAttempts++;
        await page.waitForTimeout(150);for(let choice=0;choice<5&&await page.locator('#dialogue-overlay.visible').count();choice++)await page.locator('#dialogue-choices button').first().click();
        await advance(page,.4);proof.status='REACHED_WITH_NATIVE_INPUT';proof.interaction={id:interactId,key:code,observedAt:new Date().toISOString(),after:await state(page)};break;
      }
      if(!interactId&&Math.hypot(before.player.position.x-x,before.player.position.z-z)<(process.argv.includes('--precise-waypoints')?.15:.6)){proof.status='REACHED_WITH_NATIVE_INPUT';break;}
      if(planned?.points.length){while(pathIndex<planned.points.length-1&&Math.hypot(before.player.position.x-planned.points[pathIndex].x,before.player.position.z-planned.points[pathIndex].z)<.45)pathIndex++;}
      const destination=planned?.points.length?{position:planned.points[pathIndex]}:target;
      if(nativeMouse){
        let angle=Math.atan2(destination.position.x-before.player.position.x,destination.position.z-before.player.position.z)-before.fpYaw;
        while(angle>Math.PI)angle-=Math.PI*2;while(angle<-Math.PI)angle+=Math.PI*2;
        if(Math.abs(angle)>.03){nativeMouse.x+=angle/nativeMouse.sensitivity;await page.mouse.move(nativeMouse.x,360,{steps:2});await advance(page,.03);before=await steeringState(page);proof.nativeSteering.turns++;}
      }
      if(n===0&&process.argv.includes('--approach-shot='+x+','+z)&&!before.ended){
        proof.approachScreenshot=record.id+'-native-approach-'+record.nativeWaypoints.length+'.png';
        await page.screenshot({path:path.join(out,runId,proof.approachScreenshot)});
        proof.approachScreenshotObservedAt=new Date().toISOString();
      }
      const nearPoint=planned&&Math.hypot(destination.position.x-before.player.position.x,destination.position.z-before.player.position.z)<2;
      const rawKeys=nativeMouse?['w']:directionKeys(before,destination);
      const keys=nearPoint?rawKeys:withNativeSpeed(rawKeys,before,n);if(process.argv.includes('--traverse')&&before.player.grounded&&n%10===0)keys.push('Space');for(const k of held.filter(k=>!keys.includes(k)))await page.keyboard.up(k);for(const k of keys.filter(k=>!held.includes(k))){await page.keyboard.down(k);record.inputAttempts++;}held=keys;await advance(page,planned?.points.length ? .05 : .1);
      const after=await steeringState(page);proof.steps.push({keys,before:before.player.position,after:after.player.position,sim:after.sim});
      // Keyboard quantization and acceleration can drift off a valid planned
      // segment. Replan from the actual blocked position, never move it.
      stalled=Math.hypot(after.player.position.x-before.player.position.x,after.player.position.z-before.player.position.z)<.04?stalled+1:0;
      if(planned&&stalled>=8&&(proof.nativeReplans?.length||0)<4){
        for(const key of held)await page.keyboard.up(key);held=[];await advance(page,.15);
        const observed=await state(page),replan=require('./real-demo-native-route').plan(observed.player.position,{x,z},observed.solids,{radius:observed.player.radius,height:observed.player.height,grounded:observed.player.grounded,stepHeight:observed.player.stepHeight,reach:interactId?2.15:.45,step:.25,padding:.02});
        (proof.nativeReplans||(proof.nativeReplans=[])).push({observedAt:new Date().toISOString(),from:observed.player.position,plan:replan,method:'Read-only actual geometry/position; subsequent movement is real keyboard input'});
        if(replan.points.length){planned=replan;pathIndex=0;}stalled=0;
      }
    }if(proof.status==='APPROACHING_NATIVE')proof.status='NATIVE_ROUTE_STEP_BUDGET_EXHAUSTED';}finally{for(const k of held)await page.keyboard.up(k);}await page.screenshot({path:path.join(out,runId,record.id+'-native-waypoint-'+record.nativeWaypoints.length+'.png')});if(proof.status!=='REACHED_WITH_NATIVE_INPUT')break;await advance(page,.3);
  }
}
async function progressionRoute(page,record,directory){
  const initial=await state(page),target=await page.evaluate(()=>{const i=placed.find(i=>(i.behaviors||[]).some(b=>b.action==='nextLevel'||b.action==='switchLevel'));return i?{id:i.id,name:i.name,position:{x:i.entity.position.x,y:i.entity.position.y,z:i.entity.position.z}}:null;});
  record.progression={status:target?'APPROACHING_AUTHORED_TRIGGER':'NO_AUTHORED_LEVEL_TRIGGER',target,initialLevel:initial.currentLevel,steps:[]};if(!target)return;
  if(record.id==='npc-puzzle-adventure'){
    record.progression.interactions=[];
    // Authored puzzle: ask the Sailor for the key, then use DoorSwitch.
    // No flags, inventory, door Transform or level state are injected.
    for(const id of ['obj52','obj55']){
      const actor=await page.evaluate(id=>{const i=placed.find(i=>i.id===id);return i?{id,name:i.name,position:{x:i.entity.position.x,y:i.entity.position.y,z:i.entity.position.z}}:null;},id);
      const evidence={target:actor,status:'APPROACHING',steps:[]};record.progression.interactions.push(evidence);let heldInteraction=[];
      try{for(let n=0;n<120;n++){
        const before=await steeringState(page);if(before.ended)break;
        const ready=await page.evaluate(id=>nearestInteractable?.id===id,id);
        if(ready){for(const k of heldInteraction)await page.keyboard.up(k);heldInteraction=[];const code=await page.evaluate(()=>effectiveInputMap.interact);await page.keyboard.press(/^Key/.test(code)?code.slice(3).toLowerCase():code);record.inputAttempts++;
          // Dialogue pauses simulation; progress only via visible buttons.
          await page.waitForTimeout(150);for(let choice=0;choice<5&&await page.locator('#dialogue-overlay.visible').count();choice++)await page.locator('#dialogue-choices button').first().click();
          await advance(page,1.5);evidence.status='NATIVE_INTERACTION_OBSERVED';evidence.observedAt=new Date().toISOString();evidence.after=await page.evaluate(()=>({flags:window.__gameFlags,door:placed.find(i=>i.id==='obj53')?.entity.position}));break;
        }
        const keys=directionKeys(before,actor);for(const k of heldInteraction.filter(k=>!keys.includes(k)))await page.keyboard.up(k);for(const k of keys.filter(k=>!heldInteraction.includes(k))){await page.keyboard.down(k);record.inputAttempts++;}heldInteraction=keys;await advance(page,.15);const after=await steeringState(page);evidence.steps.push({keys,before:before.player.position,after:after.player.position});
      }if(evidence.status==='APPROACHING')evidence.status='INTERACTION_TARGET_NOT_REACHED';}finally{for(const k of heldInteraction)await page.keyboard.up(k);}
    }
  }
  const pickups=await page.evaluate(()=>placed.filter(i=>(i.behaviors||[]).some(b=>b.trigger==='enter'&&b.action==='setVisibility'&&b.params?.visible===false&&placed.some(w=>w.id===b.params.targetId&&w.entity.solid&&w.entity.visible))).map(i=>({id:i.id,name:i.name,position:{x:i.entity.position.x,y:i.entity.position.y,z:i.entity.position.z}})));
  record.progression.prerequisites=[];
  for(const pickup of pickups){
    const evidence={target:pickup,status:'APPROACHING',steps:[]};record.progression.prerequisites.push(evidence);let heldPickup=[];
    try{for(let n=0;n<120;n++){
      const before=await steeringState(page);if(before.ended)break;const keys=directionKeys(before,pickup);
      for(const k of heldPickup.filter(k=>!keys.includes(k)))await page.keyboard.up(k);for(const k of keys.filter(k=>!heldPickup.includes(k))){await page.keyboard.down(k);record.inputAttempts++;}heldPickup=keys;await advance(page,.15);
      const after=await steeringState(page);evidence.steps.push({keys,before:before.player.position,after:after.player.position});
      // Trigger markers are hidden from the start; their invisibility cannot
      // prove a pickup. Observe removal or the actual target gate opening.
      const done=await page.evaluate(id=>{const i=placed.find(i=>i.id===id);return !i||(i.behaviors||[]).some(b=>b.action==='setVisibility'&&b.params?.visible===false&&placed.some(w=>w.id===b.params.targetId&&!w.entity.visible));},pickup.id);
      if(done){evidence.status='NATIVE_PICKUP_GATE_OPEN_OBSERVED';evidence.observedAt=new Date().toISOString();break;}
    }if(evidence.status==='APPROACHING')evidence.status='PICKUP_NOT_REACHED_WITH_NATIVE_INPUT';}finally{for(const k of heldPickup)await page.keyboard.up(k);}
  }
  let held=[],stuck=0;
  try{for(let n=0;n<180;n++){
    const before=await steeringState(page);if(before.ended){record.progression.status='GAME_ENDED_DURING_PROGRESSION';break;}
    const keys=directionKeys(before,target);if(stuck>=3&&before.player.grounded)keys.push('Space');
    for(const k of held.filter(k=>!keys.includes(k)))await page.keyboard.up(k);for(const k of keys.filter(k=>!held.includes(k))){await page.keyboard.down(k);record.inputAttempts++;}held=keys;
    await page.waitForFunction(({sim,level})=>currentLevelIndex!==level||simElapsed>=sim+.15||gameEnded,{sim:before.sim,level:initial.currentLevel},{timeout:30000});
    const after=await state(page);record.progression.steps.push({keys,before:before.player.position,after:after.player?.position,level:after.currentLevel,sim:after.sim});
    if(after.currentLevel!==initial.currentLevel){record.progression.status='NATIVE_TRIGGER_LEVEL_TRANSITION_OBSERVED';record.progression.finalLevel=after.currentLevel;record.progression.observedAt=new Date().toISOString();await page.screenshot({path:path.join(directory,record.id+'-level-transition.png')});break;}
    stuck=after.player&&Math.hypot(after.player.position.x-before.player.position.x,after.player.position.z-before.player.position.z)<.03?stuck+1:0;
  }if(record.progression.status==='APPROACHING_AUTHORED_TRIGGER')record.progression.status='TRIGGER_NOT_REACHED_WITH_NATIVE_INPUT';}finally{for(const k of held)await page.keyboard.up(k);}
}
async function platformRoute(page,record,directory){
  const aimArg=process.argv.find(a=>a.startsWith('--platform-aim='))?.slice(15);
  const authoredAims=aimArg?aimArg.split(';').map(a=>{const p=a.split(',');return {id:p[0],x:Number(p[1]),z:Number(p[2])};}):[];
  if(authoredAims.some(a=>!a.id||!Number.isFinite(a.x)||!Number.isFinite(a.z)))throw new Error('Invalid native platform aim');
  const targets=record.id==='moving-temple'?['obj57']:record.id==='skyway-trial'?(process.argv.includes('--all-platforms')?['obj53','obj54','obj55','obj56','obj57']:['obj53','obj54','obj55']):record.id==='valley-run'?['obj101','obj102','obj103','obj104']:[];record.platformRoutes=[];
  const valleyPlatforms=record.id==='valley-run'?await page.evaluate(ids=>Object.fromEntries(ids.map(id=>{const i=placed.find(i=>i.id===id);return [id,i?{id,position:{x:i.entity.position.x,y:i.entity.position.y,z:i.entity.position.z},half:itemColliderConfig(i).half}:null];})),targets):null;
  for(const id of targets){
    const authoredAim=authoredAims.find(a=>a.id===id);
    const proof={target:id,status:'APPROACHING_WITH_NATIVE_JUMP',steps:[]};record.platformRoutes.push(proof);let held=[];
    const readPlatform=()=>page.evaluate(id=>{const i=placed.find(i=>i.id===id);return i?{id,position:{x:i.entity.position.x,y:i.entity.position.y,z:i.entity.position.z},half:itemColliderConfig(i).half}:null;},id);
    const staticValleyPlatform=valleyPlatforms?.[id]||null;
    try{for(let n=0;n<150;n++){
      const before=await steeringState(page);if(before.ended){proof.status='GAME_ENDED_DURING_PLATFORM_ROUTE';break;}
      const platform=staticValleyPlatform||await readPlatform();if(!platform){proof.status='TARGET_NOT_PRESENT';break;}
      const distance=Math.hypot(platform.position.x-before.player.position.x,platform.position.z-before.player.position.z);
      let aim=record.id==='valley-run'&&distance<3?{position:{x:platform.position.x-before.player.velocity.x*.2,z:platform.position.z-before.player.velocity.z*.2}}:platform;
      if(authoredAim?.id===id){
        // Select a reachable point on the real platform, e.g. outside a win
        // trigger's volume. This changes only native steering, never gameplay.
        const radius=await page.evaluate(()=>player.radius);
        if(Math.abs(authoredAim.x-platform.position.x)>platform.half.x-radius||Math.abs(authoredAim.z-platform.position.z)>platform.half.z-radius)throw new Error('Native aim lies outside safe platform footprint');
        aim={position:{x:authoredAim.x,z:authoredAim.z}};proof.nativeAim={...aim.position,method:'Actual keyboard steering to an observed safe platform point; no position or trigger writes'};
      }
      const keys=record.id==='valley-run'&&distance<3?directionKeys(before,aim):withNativeSpeed(directionKeys(before,aim),before,n);
      // Valley's ridge is a narrow launch window. Use observed grounded state,
      // not an arbitrary iteration cadence that can miss the whole ridge.
      const jumpNow=record.id==='valley-run'
        ? before.player.grounded&&!held.includes('Space')&&distance<7.3&&before.player.position.y-before.player.height/2<platform.position.y+platform.half.y-.05
        : before.player.grounded&&n%12===0;
      if(jumpNow)keys.unshift('Space');
      for(const k of held.filter(k=>!keys.includes(k)))await page.keyboard.up(k);for(const k of keys.filter(k=>!held.includes(k))){await page.keyboard.down(k);record.inputAttempts++;}held=keys;await advance(page,.1);
      // Do not serialize the growing whole-game frame trace between jump
      // inputs: that round-trip can consume a narrow platform's entire window.
      const after=await page.evaluate(()=>({sim:simElapsed,player:{position:{x:player.entity.position.x,y:player.entity.position.y,z:player.entity.position.z}},metrics:{verticalContacts:window.__realDemoProbe.verticalContacts.slice(-10)}}));proof.steps.push({keys,before:before.player.position,after:after.player.position,platform:platform.position,sim:after.sim});
      const landing=after.metrics.verticalContacts.slice(-10).find(c=>c.target===id&&c.grounded&&c.sim>=before.sim);
      if(landing&&record.id==='valley-run'){
        // Keep native control responsive across static narrow stones. Full
        // trace serialization/screenshots happen after the route, not while
        // the character is coasting across a two-metre landing surface.
        proof.landing=landing;proof.status='NATIVE_PLATFORM_LANDING_OBSERVED';proof.observedAt=new Date().toISOString();break;
      }
      if(landing){for(const k of held)await page.keyboard.up(k);held=[];proof.landing=landing;proof.beforeIdle=await state(page);await advance(page,record.id==='valley-run'?.1:1.5);proof.afterIdle=await state(page);proof.carryEvents=proof.afterIdle.metrics.carryEvents.filter(c=>c.target===id&&c.sim>=proof.beforeIdle.sim);proof.status='NATIVE_PLATFORM_LANDING_OBSERVED';if(proof.carryEvents.length>5)proof.status='NATIVE_LANDING_AND_IDLE_CARRY_OBSERVED';proof.observedAt=new Date().toISOString();await page.screenshot({path:path.join(directory,record.id+'-'+id+'-landing.png')});break;}
    }if(proof.status==='APPROACHING_WITH_NATIVE_JUMP')proof.status='PLATFORM_NOT_REACHED_WITH_NATIVE_INPUT';}finally{for(const k of held)await page.keyboard.up(k);}
    if(!proof.status.startsWith('NATIVE_'))break;
  }
  if(valleyPlatforms)await page.screenshot({path:path.join(directory,record.id+'-platform-route.png')});
}
async function cornerRoute(page,record,directory){
  const first=record.wallRoute?.target;if(record.wallRoute?.status!=='SUSTAINED_REAL_WALL_CONTACT'||!first){record.corner={status:'NO_SUSTAINED_WALL_FOR_CORNER_ROUTE'};return;}
  const snapshot=await state(page),p=snapshot.player.position;
  const worldExtent=i=>{const half=i.collisionGeometry.half;if(!half)return {x:0,z:0};const q=i.rotation,c=1-2*(q.y*q.y+q.z*q.z),s=2*(q.x*q.z+q.w*q.y);return {x:Math.abs(c)*half.x+Math.abs(s)*half.z,z:Math.abs(s)*half.x+Math.abs(c)*half.z};};
  const axis=worldExtent(first),firstAxis=axis.x>axis.z?'x':'z';
  const others=snapshot.solids.filter(i=>i.id!==first.id&&i.visible&&i.kind==='cube'&&!i.ramp&&i.collisionGeometry.half?.y>=1)
    .map(i=>({...i,position:i.collisionCenter,extent:worldExtent(i)})).filter(i=>Math.max(i.extent.x,i.extent.z)>=3&&((i.extent.x>i.extent.z?'x':'z')!==firstAxis)&&
      Math.abs(i.position.x-first.position.x)<=i.extent.x+axis.x+.5&&Math.abs(i.position.z-first.position.z)<=i.extent.z+axis.z+.5);
  others.sort((a,b)=>Math.hypot(a.position.x-p.x,a.position.z-p.z)-Math.hypot(b.position.x-p.x,b.position.z-p.z));
  const second=others[0];record.corner={status:second?'APPROACHING_SECOND_SOLID':'NO_PERPENDICULAR_WALL_PAIR_SELECTED',first:first.id,second:second?.id||null,steps:[]};
  if(!second){
    const half=first.collisionGeometry.half,q=first.rotation;
    if(!half||Math.abs(q.x)>.00001||Math.abs(q.z)>.00001)return;
    // A rectangular prop has a real convex corner even without a second
    // perpendicular wall. Approach its nearest authored vertex with native
    // input and independently measure the body/vertex clearance.
    const c=1-2*q.y*q.y,s=2*q.w*q.y,dx=p.x-first.position.x,dz=p.z-first.position.z;
    const lx=Math.sign(c*dx-s*dz)||1,lz=Math.sign(s*dx+c*dz)||1;
    let vertex={x:first.position.x+c*lx*half.x+s*lz*half.z,z:first.position.z-s*lx*half.x+c*lz*half.z};
    if(snapshot.player.family!=='hovercraft'&&process.argv.includes('--terrain-corner')){
      const corners=[];
      for(const vx of [-1,1])for(const vz of [-1,1]){
        const x=first.position.x+c*vx*half.x+s*vz*half.z,z=first.position.z-s*vx*half.x+c*vz*half.z;
        const radius=snapshot.player.radius+.01,ex=x+(c*vx+s*vz)*radius/Math.SQRT2,ez=z+(-s*vx+c*vz)*radius/Math.SQRT2;
        const support=await page.evaluate(({x,z})=>{const pos=new Opus.Vec3(x,player.entity.position.y,z),terrain=currentTerrainItem(pos);return terrain?{height:terrain.handle.sampleHeight(x,z),clearance:playerTerrainClearance(player.entity,player.radius)}:null;},{x:ex,z:ez});
        const centerY=support?support.height+support.clearance:p.y;
        corners.push({x,z,verticalOverlap:Math.min(centerY+snapshot.player.height/2,first.position.y+half.y)-Math.max(centerY-snapshot.player.height/2,first.position.y-half.y),support});
      }
      record.corner.terrainCornerCandidates=corners;
      const eligible=require('./real-demo-native-steering').selectEligibleCorner(corners,p);
      if(!eligible){record.corner.status='NO_VERTICALLY_ELIGIBLE_BOX_CORNER';return;}
      vertex={x:eligible.x,z:eligible.z};
    }
    record.corner.status='APPROACHING_AUTHORED_BOX_CORNER';record.corner.vertex=vertex;let held=[];
    try{for(let n=0;n<120;n++){
      const before=await steeringState(page);if(before.ended){record.corner.status='GAME_ENDED_DURING_CORNER_ROUTE';break;}
      const keys=before.player.family==='hovercraft'?require('./real-demo-native-steering').hovercraftCornerKeys(before,vertex):directionKeys(before,{position:vertex});for(const k of held.filter(k=>!keys.includes(k)))await page.keyboard.up(k);for(const k of keys.filter(k=>!held.includes(k))){await page.keyboard.down(k);record.inputAttempts++;}held=keys;await advance(page,.1);
      const after=await steeringState(page),distance=Math.hypot(after.player.position.x-vertex.x,after.player.position.z-vertex.z),radius=await page.evaluate(()=>player.radius);
      record.corner.steps.push({keys,sim:after.sim,position:after.player.position,vertexDistance:distance,radius});
      const contacts=after.metrics.recent.filter(contact=>contact.target===first.id&&contact.time>=after.sim-.3);
      const compound=require('./real-demo-evidence').orthogonalCorner(after.metrics.recent.filter(contact=>contact.time>=after.sim-.3),first.id,snapshot.solids.filter(s=>s.visible&&s.solid).map(s=>s.id));
      if(compound){record.corner.status='TWO_SOLID_CORNER_CONTACT_OBSERVED';record.corner.compoundWitness=compound;record.corner.second=compound.second;record.corner.contacts=compound.contacts;break;}
      if(contacts.length>=3&&distance>=radius-.003&&distance<=radius+.06){record.corner.status='SINGLE_SOLID_CORNER_CONTACT_OBSERVED';record.corner.contacts=contacts;break;}
    }if(record.corner.status==='APPROACHING_AUTHORED_BOX_CORNER')record.corner.status='BOX_CORNER_NOT_REACHED_WITH_NATIVE_INPUT';
    record.corner.final=(await state(page)).player;await page.screenshot({path:path.join(directory,record.id+'-corner.png')});
    }finally{for(const key of held)await page.keyboard.up(key);}return;
  }
  const intersection={position:{x:firstAxis==='x'?second.position.x:first.position.x,z:firstAxis==='x'?first.position.z:second.position.z}};
  record.corner.requestedIntersection=intersection.position;
  let held=[];
  try{
    for(let n=0;n<120;n++){
      const before=await steeringState(page);if(before.ended){record.corner.status='GAME_ENDED_DURING_CORNER_ROUTE';break;}
      const keys=directionKeys(before,intersection);for(const k of held.filter(k=>!keys.includes(k)))await page.keyboard.up(k);for(const k of keys.filter(k=>!held.includes(k))){await page.keyboard.down(k);record.inputAttempts++;}held=keys;
      await advance(page,.1);const after=await steeringState(page);record.corner.steps.push({keys,sim:after.sim,position:after.player.position});
      const recent=after.metrics.recent.filter(c=>c.time>=after.sim-.3);if(recent.some(c=>c.target===first.id)&&recent.some(c=>c.target===second.id)){record.corner.status='TWO_SOLID_CORNER_CONTACT_OBSERVED';record.corner.contacts=recent;break;}
    }
    if(record.corner.status==='APPROACHING_SECOND_SOLID')record.corner.status='CORNER_NOT_REACHED_WITH_NATIVE_INPUT';
    record.corner.final=(await state(page)).player;await page.screenshot({path:path.join(directory,record.id+'-corner.png')});
  }finally{for(const k of held)await page.keyboard.up(k);}
}
async function instrument(page) {
  if(process.argv.includes('--observe-cover'))await page.evaluate(()=>{
    if(window.__coverObservations)return; // One observation wrapper per page.
    const originalVision=aiCanSeePlayer,originalLOS=hasLineOfSightToPlayer;
    let guard=null;const seen=new Set();window.__coverObservations=[];
    aiCanSeePlayer=function(item,pos){guard=item;try{return originalVision.apply(this,arguments);}finally{guard=null;}};
    hasLineOfSightToPlayer=function(from){
      const result=originalLOS.apply(this,arguments);
      if(result&&guard&&player)try{
        const delta=player.entity.position.sub(from),distance=delta.length(),dir=delta.scale(1/distance);
        for(const wall of placed){
          if(wall===guard||wall.kind!=='cube'||!wall.entity.visible||!wall.entity.solid||wall.isRamp)continue;
          const cfg=itemColliderConfig(wall),center=wall.entity.position.add(cfg.offset),inverse=wall.entity.quaternion.conjugate();
          const hit=cfg.shape==='sphere'?Opus.Physics.raySphere(from,dir,center,cfg.radius):Opus.Physics.rayAABB(inverse.rotateVec3(from.sub(center)),inverse.rotateVec3(dir),new Opus.Physics.AABB(cfg.half.scale(-1),cfg.half));
          const key=guard.id+':'+wall.id;
          if(hit!==null&&hit>1e-5&&hit<distance-1e-5&&!seen.has(key)&&window.__coverObservations.length<100){
            seen.add(key);window.__coverObservations.push({sim:simElapsed,guard:guard.id,wall:wall.id,name:wall.name,from:{x:from.x,y:from.y,z:from.z},player:player.entity.position.clone(),distance,hit,geometry:cfg,center,rotation:wall.entity.quaternion,observation:'LEGACY_LOS_ACCEPTED_THROUGH_ACTUAL_VISIBLE_SOLID_VOLUME'});
          }
        }
      }catch(error){window.__coverObservations.push({error:String(error)});}
      return result; // Never alter perception, movement, guard state or outcome.
    };
  });
  // Bounded observational wrappers; never change the solver response or player state.
  await page.evaluate(() => {
    window.__realDemoProbe = { calls:0,contacts:0,steps:0,dt:[],activeControllerSeconds:0,frames:[],contactsByTarget:{},recent:[],stepEvents:[],playerGenerations:1,verticalContacts:[],carryEvents:[],aiSolidEntries:[],independentWallPenetrations:[],independentWallChecks:0,instrumentationErrors:[] };
    function observedAiFootInsideBox(footY,centerY,halfY) {
      // A foot exactly on the top plane is supported, not inside the volume.
      // The lower plane stays inclusive: ground-level wall entry still counts.
      return footY>=centerY-halfY&&footY<centerY+halfY-1e-8;
    }
    // Independent endpoint geometry oracle, not a second invocation of the
    // collision solver. It observes real controller output against yaw-only
    // authored boxes/spheres. Supporting surfaces and ramps are not walls.
    function observeWallContainment(pos) {
      const m=window.__realDemoProbe,r=player.radius||.5,h=player.entity.scale.y/2;
      for(const item of placed){
        if(!item.entity||!item.entity.visible||!item.entity.solid||item.isRamp)continue;
        const cfg=itemColliderConfig(item),c=item.entity.position.add(cfg.offset),q=item.entity.quaternion;
        if(Math.abs(q.x)>.00001||Math.abs(q.z)>.00001)continue;
        const halfY=cfg.shape==='sphere'?cfg.radius:cfg.half.y;
        if(c.y+halfY<=pos.y-h+.05||c.y-halfY>=pos.y+h-.05)continue;
        const dx=pos.x-c.x,dz=pos.z-c.z;
        let gap;
        if(cfg.shape==='sphere')gap=Math.hypot(dx,dz)-cfg.radius-r;
        else{
          const cos=1-2*q.y*q.y,sin=2*q.w*q.y;
          const lx=cos*dx-sin*dz,lz=sin*dx+cos*dz;
          gap=Math.hypot(Math.max(0,Math.abs(lx)-cfg.half.x),Math.max(0,Math.abs(lz)-cfg.half.z))-r;
        }
        m.independentWallChecks++;
        if(gap<-.003&&m.independentWallPenetrations.length<100)m.independentWallPenetrations.push({sim:simElapsed,target:item.id,name:item.name,position:{x:pos.x,y:pos.y,z:pos.z},gap,radius:r,geometry:cfg,center:c,rotation:q});
      }
    }
    let lastObservedEntity=player.entity, observedAi=null;
    window.__realDemoProbe.aiContacts=[];
    const originalAi=applyAiMovementStep;
    applyAiMovementStep=function(item,ai,pos,dt,elapsed){
      const before=pos.clone();let result;
      observedAi={id:item.id,type:ai.type};
      try{result=originalAi.apply(this,arguments);}finally{observedAi=null;}
      try{if(pos.sub(before).length()>1e-6)for(const wall of placed){
        if(wall===item||wall.kind!=='cube'||!wall.entity.solid||!wall.entity.visible||wall.isRamp)continue;
        const cfg=itemColliderConfig(wall);if(cfg.shape!=='box')continue;const center=wall.entity.position.add(cfg.offset);
        // Actor origins are feet. A centre above the actual top is not an
        // entry into solid volume (Opus Arena cover decks: top .4, feet .5).
        // Preserve historical raw traces; new traces use measured Y extents,
        // not a .1m expansion that mislabels legitimate supporting passage.
        if(!observedAiFootInsideBox(pos.y,center.y,cfg.half.y))continue;
        // Read-only diagnostic: actual AI centre entered a visible solid's
        // footprint. No artificial AI/player movement or collision response.
        const hit=Opus.Physics.resolveSweptOrientedBoxCollision(before,pos,pos.sub(before).scale(1/Math.max(dt,1e-6)),1e-6,{center,half:cfg.half,quat:wall.entity.quaternion});
        if(hit.collided){const events=window.__realDemoProbe.aiSolidEntries;events.push({sim:simElapsed,ai:item.id,aiAsset:item.assetId,type:ai.type,wall:wall.id,name:wall.name,before,actualAfter:pos.clone(),entry:hit.correctedPosition});if(events.length>100)events.shift();}
      }}catch(e){const errors=window.__realDemoProbe.instrumentationErrors;if(errors.length<20)errors.push(e.message);}
      return result;
    };
    const originalVertical=resolveItemVerticalCollision;
    resolveItemVerticalCollision=function(position,velocity,radius,halfHeight,item,dt){const result=originalVertical.apply(this,arguments);if(result.collided){const events=window.__realDemoProbe.verticalContacts;events.push({sim:simElapsed,target:item.id,grounded:result.grounded,requested:position,corrected:result.correctedPosition,center:item.entity.position.add(itemColliderConfig(item).offset)});if(events.length>100)events.shift();}return result;};
    const originalCarry=applyPlatformCarry;
    applyPlatformCarry=function(entity,item,grounded){const before=entity.position.clone(),result=originalCarry.apply(this,arguments),delta=entity.position.sub(before);if(grounded&&delta.length()>1e-8){const events=window.__realDemoProbe.carryEvents;events.push({sim:simElapsed,target:item.id,delta,keys:['KeyW','KeyS','KeyA','KeyD','Space'].filter(k=>app.input.isDown(k))});if(events.length>100)events.shift();}return result;};
    const originalStep=tryStepUp;
    tryStepUp=function(entity,velocity,halfHeight,grounded,item){
      const previous={x:entity.position.x,y:entity.position.y,z:entity.position.z},result=originalStep.apply(this,arguments);
      if(result){const m=window.__realDemoProbe;m.steps++;m.stepEvents.push({time:simElapsed,target:item.id,name:item.name,grounded,
        previous,feetY:previous.y-halfHeight,topY:item.entity.position.y+itemColliderConfig(item).offset.y+itemColliderConfig(item).half.y,final:{x:entity.position.x,y:entity.position.y,z:entity.position.z}});if(m.stepEvents.length>30)m.stepEvents.shift();}
      return result;
    };
    const original = resolveItemColliderCollision;
    resolveItemColliderCollision = function(pos,vel,radius,item,prev) {
      const before = {x:pos.x,y:pos.y,z:pos.z}, result = original.apply(this,arguments), m = window.__realDemoProbe;
      if(observedAi){if(result.collided){m.aiContacts.push({sim:simElapsed,ai:observedAi.id,type:observedAi.type,target:item.id,name:item.name,requested:before,previous:prev&&{x:prev.x,y:prev.y,z:prev.z},corrected:{x:result.correctedPosition.x,y:result.correctedPosition.y,z:result.correctedPosition.z}});if(m.aiContacts.length>100)m.aiContacts.shift();}return result;}
      m.calls++;
      if(result.collided) {
        m.contacts++; m.contactsByTarget[item.id]=(m.contactsByTarget[item.id]||0)+1;
        m.recent.push({time:simElapsed,mover:player && player.controllerType,target:item.id,name:item.name,
          solid:item.entity.solid,filter:'FILTER_NOT_APPLICABLE_LEGACY_PATH',requested:before,
          previous:prev && {x:prev.x,y:prev.y,z:prev.z},result:{x:result.correctedPosition.x,y:result.correctedPosition.y,z:result.correctedPosition.z}});
        if(m.recent.length>30)m.recent.shift();
      }
      return result;
    };
    for(const controller of Object.values(PLAYER_CONTROLLERS)) {
      const update=controller.update;
      controller.update=function(dt){
        const m=window.__realDemoProbe;if(m.dt.length<300)m.dt.push(dt);
        if(Number.isFinite(dt)&&dt>0&&playMode&&!app.paused&&!playerFrozen&&!gameEnded)m.activeControllerSeconds+=dt;
        if(player&&lastObservedEntity!==player.entity){m.playerGenerations++;lastObservedEntity=player.entity;}
        const before=player&&{x:player.entity.position.x,y:player.entity.position.y,z:player.entity.position.z};
        const result=update.apply(this,arguments);
        if(player)observeWallContainment(player.entity.position);
        if(player&&m.frames.length<1500){
          const pos=player.entity.position,terrain=currentTerrainItem(pos);
          m.frames.push({sim:simElapsed,dt,before,after:{x:pos.x,y:pos.y,z:pos.z},height:player.entity.scale.y,
            terrainId:terrain?.id||null,terrainHeight:terrain?.handle.sampleHeight(pos.x,pos.z)??null,
            grounded:player.controllerType==='thirdperson'?thirdPersonGrounded:player.controllerType==='firstperson'?firstPersonGrounded:null,
            keys:[...new Set(['KeyW','KeyS','KeyA','KeyD','Space',effectiveInputMap.sprint,effectiveInputMap.jump].filter(Boolean))].filter(k=>app.input.isDown(k))});
        }
        return result;
      };
    }
  });
}
async function run() {
  const results = {runId,tier,requestedArguments:process.argv.slice(2),startedAt:new Date().toISOString(),fingerprint,method:'Canonical catalog project; source editor or exact export composer; native Play/start-menu click; real keyboard input; bounded observation-only collision wrappers.',games:[]};
  const server = http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(err?'Not found':data);});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    for(const id of selected) {
      const entry=catalog.find(g=>g.id===id); if(!entry)throw new Error(`Not public: ${id}`);
      const record={id,title:entry.title,tier,status:'UNKNOWN',errors:[],consoleErrors:[],externalRequests:[],inputAttempts:0}; results.games.push(record);
      const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
      page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.consoleErrors.push(m.text());});
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(`http://127.0.0.1:${port}/`))record.externalRequests.push(r.url());});
      try {
        let relative=`dist/games/${id}.html`;
        if(tier==='editable'){
          const buildSource=fs.readFileSync(path.join(root,'build/build-games.js'),'utf8');
          const modules=[...buildSource.matchAll(/path.join\(ROOT, 'editor', 'src', '([^']+)'\)/g)].map(m=>m[1]);
          if(modules.length!==17)throw new Error('Exact catalog module inventory changed; inspect build before qualifying');
          const html=require('../build/export-template').composeExportHTML({htmlTemplate:fs.readFileSync(path.join(root,'editor/index.html'),'utf8'),
            engineJS:fs.readFileSync(path.join(root,'dist/opus-engine.js'),'utf8'),editorJS:modules.map(n=>fs.readFileSync(path.join(root,'editor/src',n),'utf8')).join('\n'),
            templateJS:fs.readFileSync(path.join(root,'build/export-template.js'),'utf8'),embeddedProjectJSON:fs.readFileSync(path.join(root,'games',entry.file),'utf8'),playableOnly:false,title:entry.title});
          relative=`qualification/real-demo-collision/${runId}/${id}-editable.html`;fs.writeFileSync(path.join(root,relative),html);
        }
        if(tier==='source')relative=`editor/index.html?game=${id}`;
        await page.goto(`http://127.0.0.1:${port}/${relative}`,{waitUntil:'load',timeout:45000});
        if(tier==='source'){
          await page.waitForFunction(()=>document.querySelector('#games-status')?.textContent.startsWith('Loaded '),{},{timeout:20000});
          if(!await page.locator('#play-btn').isVisible())await page.locator('#chrome-toggle-btn').click();
          await page.locator('#play-btn').click();
        }
        record.beforeStart=await state(page);
        const button=page.locator('#start-overlay-btn');
        if(await button.isVisible()) await button.click({timeout:10000});
        await page.waitForFunction(()=>typeof player!=='undefined'&&!!player&&playMode&&!document.querySelector('#start-overlay')?.classList.contains('visible'),{},{timeout:15000});
        record.status='GAMEPLAY_STARTED'; await instrument(page);
        record.start=await state(page);
        record.segments=[];
        record.intro={startedAt:new Date().toISOString(),frozen:record.start.playerFrozen};
        await page.waitForFunction(()=>!playerFrozen||gameEnded,{},{timeout:30000});
        record.intro.endedAt=new Date().toISOString();
        await nativeWaypoints(page,record);
        await authoredObjectRoute(page,record,path.join(out,runId));
        if(process.argv.includes('--progress'))await progressionRoute(page,record,path.join(out,runId));
        if(process.argv.includes('--pass-through')&&record.progression?.status==='NATIVE_TRIGGER_LEVEL_TRANSITION_OBSERVED'){
          record.initialAuthoredObjectRoute=record.authoredObjectRoute;
          await authoredObjectRoute(page,record,path.join(out,runId));
          if(record.authoredObjectRoute)record.authoredObjectRoute.level=(await state(page)).currentLevel;
        }
        if(process.argv.includes('--platforms'))await platformRoute(page,record,path.join(out,runId));
        if(wallCampaign)await wallRoute(page,record,path.join(out,runId));
        if(process.argv.includes('--corners'))await cornerRoute(page,record,path.join(out,runId));
        if(!wallCampaign||extendedCampaign&&(!record.wallRoute?.steps.length||!record.wallRoute.steps.some(s=>Math.hypot(s.after.x-s.before.x,s.after.z-s.before.z)>.05)))
        for(const key of ['w','s','a','d']) {
          const before=await state(page); if(before.ended)break;
          await page.keyboard.down(key); record.inputAttempts++;
          try {await page.waitForFunction(t=>simElapsed>=t+2||gameEnded,before.sim,{timeout:30000});}
          finally{await page.keyboard.up(key);}
          const after=await state(page);
          record.segments.push({key,before:before.player,after:after.player,simSeconds:after.sim-before.sim,contacts:after.metrics.contacts});
        }
        record.final=await state(page);
        await page.screenshot({path:path.join(out,runId,`${id}-gameplay-final.png`)});
        if(extendedCampaign){
          record.supportObservations={start:{player:record.start.player,terrain:record.start.terrainUnderPlayer},final:{player:record.final.player,terrain:record.final.terrainUnderPlayer},frames:record.final.metrics.frames};
          record.restart={status:'NOT_ATTEMPTED',before:record.final.player};
          const restartFromEnd=async()=>{
            if(tier==='playable'){await Promise.all([page.waitForEvent('load'),page.locator('#end-overlay-btn').click()]);record.restart.mode='NATIVE_END_OVERLAY_PAGE_RELOAD';}
            else{await page.locator('#end-overlay-btn').click();if((await page.locator('#play-btn').textContent()).includes('Stop'))await page.locator('#play-btn').click();await page.locator('#play-btn').click();record.restart.mode='NATIVE_END_OVERLAY_EDITOR_PLAY';}
            if(await page.locator('#start-overlay-btn').isVisible())await page.locator('#start-overlay-btn').click();
            await page.waitForFunction(()=>typeof player!=='undefined'&&!!player&&playMode&&!app.paused&&!gameEnded,{},{timeout:15000});await instrument(page);
          };
          if(record.final.ended||await page.locator('#end-overlay.visible').count()){
            await restartFromEnd();
          }else{
            await page.keyboard.press('Escape');
            try{await page.locator('#pause-restart-btn').click({timeout:1500});record.restart.mode='NATIVE_PAUSE_LEVEL_RESTART';
              await page.waitForFunction(generation=>!!player&&playMode&&!app.paused&&!gameEnded&&window.__realDemoProbe.playerGenerations>generation,record.final.metrics.playerGenerations,{timeout:15000});
            }catch(e){if(await page.locator('#end-overlay.visible').count()){record.restart.race='Legitimate ending replaced pause overlay';await restartFromEnd();}else throw e;}
          }
          // Authored intro cinematics legitimately freeze controllers (Silent
          // Sector: six seconds). Observe release; never override the flag.
          record.restart.freezeWaitStartedAt=new Date().toISOString();
          await page.waitForFunction(()=>!playerFrozen||gameEnded,{},{timeout:30000});
          record.restart.freezeWaitEndedAt=new Date().toISOString();
          await advance(page,.7);record.restart.after=await state(page);record.restart.observedAt=new Date().toISOString();
          record.restart.nativeMovementAttempts=[];
          for(const key of ['s','w','a','d']){
            const beforeMove=(await steeringState(page)).player.position;await page.keyboard.down(key);record.inputAttempts++;await advance(page,.5);await page.keyboard.up(key);
            const afterMove=await steeringState(page),attempt={key,before:beforeMove,after:afterMove.player.position,moved:Math.hypot(afterMove.player.position.x-beforeMove.x,afterMove.player.position.z-beforeMove.z)>.05};record.restart.nativeMovementAttempts.push(attempt);if(attempt.moved)break;
          }
          record.restart.status=record.restart.nativeMovementAttempts.some(a=>a.moved)?'RESTARTED_NATIVE_MOVEMENT_OBSERVED':'RESTARTED_INPUT_ATTEMPTED_MOVEMENT_UNPROVEN';
          await page.screenshot({path:path.join(out,runId,`${id}-restart.png`)});
        }
        record.heapEstimate=await page.evaluate(()=>performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null);
        record.movementObserved=record.segments.some(s=>s.before&&s.after&&Math.hypot(s.after.position.x-s.before.position.x,s.after.position.z-s.before.position.z)>0.05)||!!record.wallRoute?.steps.some(s=>Math.hypot(s.after.x-s.before.x,s.after.z-s.before.z)>.05)||!!record.nativeWaypoints?.some(w=>w.steps.some(s=>s.keys.length&&Math.hypot(s.after.x-s.before.x,s.after.z-s.before.z)>.05))||record.final.metrics.frames.some(f=>f.keys.length&&Math.hypot(f.after.x-f.before.x,f.after.z-f.before.z)>.05);
        record.collisionAcceptance='NOT_QUALIFIED_INITIAL_CHARACTERIZATION';
        await page.screenshot({path:path.join(out,runId,`${id}.png`)});
        console.log(JSON.stringify({id,status:record.status,wallRoute:record.wallRoute?.status,moved:record.movementObserved,calls:record.final.metrics.calls,contacts:record.final.metrics.contacts,errors:record.errors.length,position:record.final.player.position}));
      }catch(e){record.failure=e.stack;record.status=/Download is starting/.test(e.message)?'AUTOMATION_SERVER_ROUTING_FAILURE':/Target.*closed|browser.*closed|ECONN/.test(e.message)?'AUTOMATION_CONNECTION_FAILURE':/locator|selector/i.test(e.message)?'AUTOMATION_SELECTOR_FAILURE':'UNKNOWN';
        try{record.failureObservation={observedAt:new Date().toISOString(),state:await state(page)};}catch(observationError){record.failureObservationError=String(observationError);}
        console.error(`${id}: ${e.message}`);}
      finally{await context.close();fs.writeFileSync(path.join(out,runId,'results.json'),JSON.stringify(results,null,2)+'\n');}
    }
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));results.endedAt=new Date().toISOString();fs.writeFileSync(path.join(out,runId,'results.json'),JSON.stringify(results,null,2)+'\n');}
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;});
