// Applies one authored Camera object's settings to the real app.camera --
// shared by the Change Camera action and (for consistency) could be reused
// by future camera-preset UI. Mirrors the exact working call order the
// hovercraft's own chase setup already relies on: setTarget BEFORE
// setMode('chase')/setMode('followLookAt') -- Camera.setMode re-triggers
// setTarget's real positioning logic only once `this.mode` already matches,
// so calling them in the other order silently skips that positioning.
// Wave 9C: best-effort "what was the last REAL Camera object applied"
// tracker -- lets Play Camera Path's own "Return To Previous Camera"
// restore something sensible without a new, separate "current camera"
// concept. Deliberately NOT set by the camera-path/blend vehicles
// themselves (which borrow 'fixed' mode transiently), only by an actual
// authored Camera object being applied for real.
let lastAppliedCameraItemId = null;
let cameraOwnershipRevision = 0;
function hasExplicitGameplayCamera() {
  return !!activeCameraBlend || !!activeCameraPath ||
    (lastAppliedCameraItemId != null && placed.some(item => item.kind === 'camera' && item.id === lastAppliedCameraItemId));
}
function applyCameraPreset(cameraItem) {
  if (!cameraItem || cameraItem.kind !== 'camera') return false;
  const groupEnabled=cameraItem.options?.targetGroup?.enabled;
  if(groupEnabled){const preflight=cameraTargetGroupCorners(cameraItem);if(!preflight.ok){cameraTargetGroupWarning(cameraItem,preflight.reason);return false;}}
  const groupSnapshot=groupEnabled?snapshotSceneCamera():null,previousCameraId=lastAppliedCameraItemId;
  lastAppliedCameraItemId = cameraItem.id;
  const opts = cameraItem.options = normalizeCameraOptions(cameraItem.options);
  app.camera.setObstructionOptions(opts.obstruction);
  app.camera.setProjection(CAMERA_PROJECTIONS.includes(opts.projection) ? opts.projection : 'perspective');
  app.camera.setOrthographicHeight(Number.isFinite(opts.orthographicHeight) && opts.orthographicHeight > 0 ? opts.orthographicHeight : 10);
  app.camera.near = Number.isFinite(opts.near) && opts.near > 0 ? opts.near : 0.1;
  app.camera.far = Number.isFinite(opts.far) && opts.far > app.camera.near ? opts.far : 100;
  app.camera.fovY = (opts.fovDegrees || 45) * Math.PI / 180;
  const orientation = cameraOrientation(opts);
  const forward = orientation.rotateVec3(new Opus.Vec3(0, 0, -1));
  const up = orientation.rotateVec3(new Opus.Vec3(0, 1, 0));
  const lookAtItem = opts.lookAtTargetId ? findItemById(opts.lookAtTargetId) : null;
  const lookAtEntity = lookAtItem && lookAtItem.entity ? lookAtItem.entity : null;
  if (opts.mode === 'chase') {
    app.camera.setChaseOptions(opts.chase);
    app.camera.setTarget(player ? player.entity : null);
    app.camera.setMode('chase');
  } else if (opts.mode === 'orbit') {
    app.camera.setMode('orbit');
    app.camera.target = cameraItem.entity.position.clone();
  } else if (opts.mode === 'fixed') {
    const lookAtPos = lookAtEntity ? lookAtEntity.position : cameraItem.entity.position.add(forward);
    app.camera.setFixedOptions({ eye: cameraItem.entity.position.clone(), target: lookAtPos.clone(), up });
    app.camera.setMode('fixed');
  } else if (opts.mode === 'followLookAt') {
    app.camera.setTarget(lookAtEntity || (player ? player.entity : null));
    app.camera.setFixedOptions({ eye: cameraItem.entity.position.clone(), up });
    app.camera.setMode('followLookAt');
  }
  if(groupEnabled&&!applyCameraTargetGroup(cameraItem)){restoreSceneCamera(groupSnapshot);lastAppliedCameraItemId=previousCameraId;return false;}
  cameraOwnershipRevision++;
  return true;
}

// Wave 6B (Priority K): Camera Blend Duration -- a bounded interpolated
// transition, built entirely from EXISTING camera pieces rather than a new
// camera architecture (the spec's own explicit escape hatch: "defer if it
// becomes a new camera architecture"). The trick: `app.camera`'s `eye`/
// `currentTarget` getters already return a real world position/lookAt
// regardless of which mode (chase/orbit/fixed/followLookAt) is currently
// active, and the EXISTING 'fixed' mode already accepts an arbitrary literal
// eye+target via `setFixedOptions` -- so 'fixed' mode is repurposed here as
// the interpolation VEHICLE for the blend window only. Start state is read
// off the live getters (whatever mode was active); end state is read the
// SAME way immediately after actually applying the real target preset (so
// the "end" is always exactly correct, never a second hand-duplicated
// camera-math path); every frame in between overwrites 'fixed' mode's own
// eye/target with the lerp; once elapsed >= duration, `applyCameraPreset`
// is called for REAL, snapping to the target camera's own actual configured
// mode -- so a blend into a chase/orbit/followLookAt camera correctly hands
// off to that mode's own live-updating behavior once the blend completes,
// rather than getting stuck in 'fixed' forever.
// Wave 9C (Priority B, Sections 20-27): Camera Path -- the authoring/
// runtime BRIDGE between three systems that already exist (Path/Spline
// storage+`samplePathPosition`, and this exact "repurpose 'fixed' mode as
// an interpolation vehicle" trick the Camera Blend above already
// established) -- no second spline implementation, no second camera
// architecture. `activeCameraPath` is simulation-time driven (correctly
// freezes on pause, since this is ticked from the same dispatcher every
// other simulation-time system already funnels through).
let activeCameraPath = null; // { pathItem, duration, elapsed, loop, lookMode, lookAtTargetId, fixedTarget, returnCameraId }
function startCameraPath(pathItem, duration, loop, lookMode, lookAtTargetId, fixedTarget, returnCameraId) {
  if (!pathItem || pathItem.kind !== 'path' || !pathItem.pointIds || pathItem.pointIds.length < 2) return;
  if(typeof duration!=='number'||!Number.isFinite(duration))return;
  if(fixedTarget&&![fixedTarget.x,fixedTarget.y,fixedTarget.z].every(Number.isFinite))return;
  activeCameraBlend = null; // a Camera Path and a Camera Blend both borrow 'fixed' mode as their vehicle -- mutually exclusive, the newer one wins
  activeCameraPath = { pathItem, duration: duration > 0 ? duration : 5, elapsed: 0, loop: !!loop, lookMode: lookMode || 'alongPath', lookAtTargetId, fixedTarget, returnCameraId };
  app.camera.setMode('fixed');
}
function tickCameraPath(dt) {
  if (!activeCameraPath || app.paused || typeof dt!=='number' || !Number.isFinite(dt) || dt<0) return;
  const cp = activeCameraPath;
  cp.elapsed += dt;
  let t = cp.elapsed / cp.duration;
  let finished = false;
  if (t >= 1) { if (cp.loop) t %= 1; else { t = 1; finished = true; } }
  const pos = samplePathPosition(cp.pathItem, t);
  let target;
  if (cp.lookMode === 'lookAtObject' && cp.lookAtTargetId) {
    const obj = findItemById(cp.lookAtTargetId);
    target = obj && obj.entity ? obj.entity.position : pos.add(new Opus.Vec3(0, 0, -1));
  } else if (cp.lookMode === 'fixedTarget' && cp.fixedTarget) {
    target = cp.fixedTarget;
  } else {
    // Along Path (Section 23's own "sample current position, slightly-ahead
    // position, normalized direction, no authored roll") -- a hair past the
    // final sample when nearly at t=1 so the very last frame still looks
    // forward instead of snapping to look at itself.
    target = samplePathPosition(cp.pathItem, Math.min(1, t + 0.02));
    // At an open endpoint the ahead sample clamps to the eye. Continue the
    // incoming tangent instead of producing a degenerate lookAt matrix.
    if(target.sub(pos).length()<1e-8){
      const incoming=pos.sub(samplePathPosition(cp.pathItem,Math.max(0,t-0.02)));
      target=pos.add(incoming.length()>1e-8?incoming:new Opus.Vec3(0,0,-1));
    }
  }
  app.camera.setFixedOptions({ eye: pos, target });
  if (finished) {
    const returnItem = cp.returnCameraId ? findItemById(cp.returnCameraId) : null;
    activeCameraPath = null;
    if (returnItem) applyCameraPreset(returnItem);
  }
}
let activeCameraBlend = null;
function applyCameraPresetBlended(cameraItem, duration) {
  if (!cameraItem || cameraItem.kind !== 'camera') return;
  if(typeof duration!=='number'||!Number.isFinite(duration)||duration<0)return;
  if (duration === 0) { if(applyCameraPreset(cameraItem)){activeCameraBlend=null;activeCameraPath=null;}return; }
  const startEye = app.camera.eye.clone();
  const startTarget = app.camera.currentTarget.clone();
  const startFov = app.camera.fovY;
  const startUp=app.camera.currentUp.clone(), startProjection=app.camera.projection, startHeight=app.camera.orthographicHeight, startNear=app.camera.near, startFar=app.camera.far;
  if(!applyCameraPreset(cameraItem))return; // Refused target acquisition cannot take over a valid blend or path.
  const endEye = app.camera.eye.clone();
  const endTarget = app.camera.currentTarget.clone();
  const endFov = app.camera.fovY;
  const endUp=app.camera.currentUp.clone(), sameProjection=startProjection===app.camera.projection, endHeight=app.camera.orthographicHeight,endNear=app.camera.near,endFar=app.camera.far;
  activeCameraPath=null;
  app.camera.setFixedOptions({ eye: startEye.clone(), target: startTarget.clone(), up:startUp.clone() });
  app.camera.setMode('fixed');
  app.camera.fovY = startFov;
  if(sameProjection){app.camera.setOrthographicHeight(startHeight);app.camera.near=startNear;app.camera.far=startFar;}
  activeCameraBlend = { startEye, endEye, startTarget, endTarget, startFov, endFov,startUp,endUp,sameProjection,startHeight,endHeight,startNear,endNear,startFar,endFar, duration, elapsed: 0, targetCameraItem: cameraItem };
}
function cameraBlendUp(start,end,t) {
  const a=start.normalize(),b=end.normalize(),dot=Math.max(-1,Math.min(1,a.dot(b)));
  if(dot>0.999999)return a.add(b.sub(a).scale(t)).normalize();
  let axis=a.cross(b);
  if(axis.length()<0.000001)axis=a.cross(Math.abs(a.x)<0.8?new Opus.Vec3(1,0,0):new Opus.Vec3(0,1,0));
  return Opus.Quat.fromAxisAngle(axis.normalize(),Math.acos(dot)*t).rotateVec3(a).normalize();
}
function tickCameraBlend(dt) {
  if (!activeCameraBlend||typeof dt!=='number'||!Number.isFinite(dt)||dt<0||app.paused) return;
  const b = activeCameraBlend;
  b.elapsed += dt;
  const t = Math.min(1, b.elapsed / b.duration);
  // Sample the destination through the same public Camera path used at handoff.
  // A following shot must follow the live Player while this fixed view owns the blend.
  if(applyCameraPreset(b.targetCameraItem)){
    b.endEye=app.camera.eye.clone();b.endTarget=app.camera.currentTarget.clone();b.endUp=app.camera.currentUp.clone();
    b.endFov=app.camera.fovY;b.endHeight=app.camera.orthographicHeight;b.endNear=app.camera.near;b.endFar=app.camera.far;
  }
  const eye = b.startEye.add(b.endEye.sub(b.startEye).scale(t));
  const target = b.startTarget.add(b.endTarget.sub(b.startTarget).scale(t));
  app.camera.setFixedOptions({ eye, target, up:cameraBlendUp(b.startUp,b.endUp,t) });
  app.camera.setMode('fixed');
  app.camera.fovY = b.startFov + (b.endFov - b.startFov) * t;
  if(b.sameProjection){app.camera.setOrthographicHeight(b.startHeight+(b.endHeight-b.startHeight)*t);app.camera.near=b.startNear+(b.endNear-b.startNear)*t;app.camera.far=b.startFar+(b.endFar-b.startFar)*t;}
  if (t >= 1) {
    const finalItem = b.targetCameraItem;
    activeCameraBlend = null;
    applyCameraPreset(finalItem); // hand off to the target camera's REAL mode (chase/orbit/fixed/followLookAt), not stuck in the blend's borrowed 'fixed' mode
  }
}
app.onUpdate((dt) => { if (playMode) { tickCameraBlend(dt); tickCameraPath(dt); tickFogBlend(dt); } });

