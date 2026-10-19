// ===== Scene navigation (edit mode only) =====
// Unity-style viewport controls layered over the engine's orbit camera:
//   right-drag        look around; hold it and use W A S D to fly, Q / E down / up,
//                     Shift to go faster, the wheel to change fly speed
//   middle-drag       pan              Alt + left-drag   orbit
//   Alt + right-drag  zoom             wheel             zoom (proportional to distance)
//   F                 frame the selection
// Plain left-drag on empty space keeps orbiting as before. Nothing here is
// saved; Play restores the engine's default orbit limits for games.
const SCENE_NAV_ORBIT = { minDistance: 0.5, maxDistance: 600 };
const SCENE_NAV_GAME_ORBIT = { minDistance: 2, maxDistance: 30, keyControls: true };
let sceneNav = null; // { mode: 'fly'|'pan'|'orbit'|'zoom', pointerId, x, y }
let sceneNavFlySpeed = 8;
let sceneNavEditorLimits = false;
let sceneNavFar = null;

function sceneNavigationActive() { return !!sceneNav; }
function sceneNavigationAvailable() {
  return !playMode && !cameraViewState && app.camera.mode === 'orbit';
}
function sceneNavDirection(yaw, pitch) {
  const p = Math.max(-1.5, Math.min(1.5, pitch));
  return new Opus.Vec3(Math.cos(p) * Math.sin(yaw), Math.sin(p), Math.cos(p) * Math.cos(yaw));
}
function sceneNavClampDistance(distance) {
  return Math.max(SCENE_NAV_ORBIT.minDistance, Math.min(SCENE_NAV_ORBIT.maxDistance, distance));
}
// Turn the view in place: the eye stays put and the orbit target swings around it.
function sceneNavLook(camera, dx, dy) {
  const eye = camera.target.add(sceneNavDirection(camera.yaw, camera.pitch).scale(camera.distance));
  camera.yaw -= dx * 0.004;
  camera.pitch = Math.max(-1.5, Math.min(1.5, camera.pitch + dy * 0.004));
  camera.target = eye.sub(sceneNavDirection(camera.yaw, camera.pitch).scale(camera.distance));
}
// Grab-style pan: the point under the cursor follows it at the target's depth.
function sceneNavPan(camera, dx, dy, viewportHeight) {
  const basis = camera.getBasis();
  const span = camera.projection === 'orthographic' ? camera.orthographicHeight : 2 * camera.distance * Math.tan(camera.fovY / 2);
  const perPixel = span / Math.max(1, viewportHeight);
  camera.target = camera.target.add(basis.right.scale(-dx * perPixel)).add(basis.up.scale(dy * perPixel));
}
function sceneNavOrbit(camera, dx, dy) {
  camera.yaw -= dx * 0.005;
  camera.pitch = Math.max(-1.5, Math.min(1.5, camera.pitch + dy * 0.005));
}
function sceneNavZoom(camera, factor) {
  camera.distance = sceneNavClampDistance(camera.distance * factor);
}
// keys: anything with has(code). Moves eye and target together along the view.
function sceneNavFly(camera, keys, dt, speed) {
  const basis = camera.getBasis();
  let move = new Opus.Vec3(0, 0, 0);
  if (keys.has('KeyW')) move = move.add(basis.forward);
  if (keys.has('KeyS')) move = move.sub(basis.forward);
  if (keys.has('KeyD')) move = move.add(basis.right);
  if (keys.has('KeyA')) move = move.sub(basis.right);
  if (keys.has('KeyE')) move = move.add(new Opus.Vec3(0, 1, 0));
  if (keys.has('KeyQ')) move = move.sub(new Opus.Vec3(0, 1, 0));
  if (move.length() < 1e-6) return false;
  const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : 1;
  camera.target = camera.target.add(move.normalize().scale(speed * boost * dt));
  return true;
}
function sceneNavEnd() {
  if (!sceneNav) return;
  try { canvas.releasePointerCapture?.(sceneNav.pointerId); } catch (error) { /* already released */ }
  sceneNav = null;
  canvas.classList.remove('scene-nav-fly', 'scene-nav-pan');
}

canvas.addEventListener('contextmenu', (event) => { if (!playMode) event.preventDefault(); });
// Capture phase on the canvas: navigation gestures never reach selection,
// gizmo or placement handlers (or the engine's own drag accumulator).
canvas.addEventListener('pointerdown', (event) => {
  if (sceneNav || !sceneNavigationAvailable()) return;
  let mode = null;
  if (event.button === 2) mode = event.altKey ? 'zoom' : 'fly';
  else if (event.button === 1) mode = 'pan';
  else if (event.button === 0 && event.altKey) mode = 'orbit';
  if (!mode) return;
  sceneNav = { mode, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
  canvas.classList.add(mode === 'pan' ? 'scene-nav-pan' : 'scene-nav-fly');
  app.input.consumeDrag();
  event.preventDefault();
  event.stopImmediatePropagation();
}, { capture: true });
window.addEventListener('pointermove', (event) => {
  if (!sceneNav || event.pointerId !== sceneNav.pointerId) return;
  const dx = event.clientX - sceneNav.x, dy = event.clientY - sceneNav.y;
  sceneNav.x = event.clientX; sceneNav.y = event.clientY;
  if (!sceneNavigationAvailable()) { sceneNavEnd(); return; }
  const camera = app.camera;
  if (sceneNav.mode === 'fly') sceneNavLook(camera, dx, dy);
  else if (sceneNav.mode === 'pan') sceneNavPan(camera, dx, dy, canvas.clientHeight);
  else if (sceneNav.mode === 'orbit') sceneNavOrbit(camera, dx, dy);
  else if (sceneNav.mode === 'zoom') sceneNavZoom(camera, Math.exp((dy - dx) * 0.006));
  app.input.consumeDrag();
}, true);
for (const type of ['pointerup', 'pointercancel']) {
  window.addEventListener(type, (event) => {
    if (!sceneNav || event.pointerId !== sceneNav.pointerId) return;
    sceneNavEnd();
    app.input.consumeDrag();
    event.stopImmediatePropagation();
  }, true);
}
window.addEventListener('blur', sceneNavEnd);
// Registered after the engine's wheel listener, so it takes the delta over.
canvas.addEventListener('wheel', (event) => {
  if (!sceneNavigationAvailable()) return;
  const delta = app.input.consumeWheel() || event.deltaY;
  if (sceneNav && sceneNav.mode === 'fly') {
    sceneNavFlySpeed = Math.max(1, Math.min(200, sceneNavFlySpeed * Math.exp(-delta * 0.0015)));
    showStatus(`Fly speed ${sceneNavFlySpeed.toFixed(1)} m/s`);
    return;
  }
  sceneNavZoom(app.camera, Math.exp(delta * 0.0012));
}, { passive: true });
window.addEventListener('keydown', (event) => {
  if (playMode || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  if (event.code === 'KeyF' && !sceneNav && selectedItems.size) focusViewportSelection();
});

app.onUpdate((dt) => {
  const camera = app.camera;
  if (playMode) {
    sceneNavEnd();
    if (sceneNavEditorLimits) {
      camera.setOrbitOptions(SCENE_NAV_GAME_ORBIT);
      if (sceneNavFar !== null && camera.far === sceneNavFar) camera.far = 100;
      sceneNavEditorLimits = false; sceneNavFar = null;
    }
    return;
  }
  // The engine's orbit keys (arrows/WASD/QE) behave as before except while
  // flying, when WASD/QE belong to the fly movement instead.
  camera.setOrbitOptions({ ...SCENE_NAV_ORBIT, keyControls: !(sceneNav && sceneNav.mode === 'fly') });
  sceneNavEditorLimits = true;
  if (sceneNav && sceneNav.mode === 'fly' && sceneNavigationAvailable()) sceneNavFly(camera, app.input.keys, dt, sceneNavFlySpeed);
  // Far views of big levels need a deeper far plane than the 100 m default.
  if (!cameraViewState && camera.mode === 'orbit' && (camera.far === 100 || camera.far === sceneNavFar)) {
    const far = Math.max(100, Math.round(camera.distance * 3 + 80));
    if (far !== camera.far) { camera.far = far; sceneNavFar = far === 100 ? null : far; }
  }
});
