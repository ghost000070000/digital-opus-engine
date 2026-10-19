'use strict';
// Scene navigation: the engine's opt-in orbit options keep game defaults, and
// the editor's look / pan / orbit / zoom / fly math moves the real Camera as intended.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = { window: { addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } };
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), c);
const O = c.window.Opus;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const keys = (...codes) => ({ isDown: (k) => codes.includes(k), consumeDrag: () => ({ dx: 0, dy: 0 }), consumeWheel: () => 0 });

{
  // Defaults are the historical game behaviour: 2-30 m range, keys rotate.
  const camera = new O.Camera();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(camera.orbitOptions)), { minDistance: 2, maxDistance: 30, keyControls: true });
  camera.distance = 80; camera.update(keys(), 0.016);
  assert.strictEqual(camera.distance, 30, 'default range clamps as before');
  const yaw = camera.yaw; camera.update(keys('KeyD'), 0.5);
  assert(camera.yaw > yaw, 'keys still rotate by default');
  // Hosts can widen the range and take over the keys.
  camera.setOrbitOptions({ minDistance: 0.5, maxDistance: 600, keyControls: false });
  camera.distance = 250; const before = camera.yaw; camera.update(keys('KeyD', 'KeyQ'), 0.5);
  assert.strictEqual(camera.distance, 250, 'wide range is kept');
  assert.strictEqual(camera.yaw, before, 'keyControls false leaves the keys to the host');
  assert.throws(() => camera.setOrbitOptions({ maxDistance: 0.1 }), /maxDistance/);
  assert.throws(() => camera.setOrbitOptions({ keyControls: 'yes' }), /keyControls/);
  assert.strictEqual(camera.orbitOptions.maxDistance, 600, 'refused options change nothing');
}

// Editor math against the real Camera.
const source = fs.readFileSync(path.join(root, 'editor/src/modules/54-scene-navigation.js'), 'utf8');
const ctx = { Opus: O, Math };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function sceneNavEnd')), ctx);
const eyeOf = (cam) => cam.eye;
{
  // Look turns in place: the eye does not move.
  const cam = new O.Camera(); cam.target = new O.Vec3(3, 1, -2); cam.distance = 12;
  const eye = eyeOf(cam);
  ctx.sceneNavLook(cam, 120, -40);
  const after = eyeOf(cam);
  assert(near(eye.x, after.x) && near(eye.y, after.y) && near(eye.z, after.z), 'fly-look keeps the eye still');
  assert(!near(cam.target.x, 3), 'the view direction changed');
  // Dragging right turns the view right.
  const cam2 = new O.Camera(); cam2.yaw = 0; cam2.pitch = 0; const right = cam2.getBasis().right;
  ctx.sceneNavLook(cam2, 50, 0);
  assert(cam2.getBasis().forward.dot(right) > 0, 'drag right looks right');
}
{
  // Pan moves eye and target together, perpendicular to the view, opposite the drag.
  const cam = new O.Camera(); cam.target = new O.Vec3(0, 0, 0); cam.distance = 10;
  const basis = cam.getBasis(), eye = eyeOf(cam);
  ctx.sceneNavPan(cam, 100, 0, 500);
  const moved = cam.target;
  assert(moved.dot(basis.right) < 0 && near(moved.dot(basis.forward), 0), 'pan follows the cursor sideways');
  const span = 2 * 10 * Math.tan(cam.fovY / 2);
  assert(near(moved.length(), span * 100 / 500, 1e-9), 'grab-style pan rate');
  const shift = eyeOf(cam).sub(eye);
  assert(near(shift.x, moved.x) && near(shift.z, moved.z), 'eye moves with the target');
}
{
  // Zoom is proportional and clamped to the editor range.
  const cam = new O.Camera(); cam.distance = 10;
  ctx.sceneNavZoom(cam, 2); assert.strictEqual(cam.distance, 20);
  ctx.sceneNavZoom(cam, 1e6); assert.strictEqual(cam.distance, 600);
  ctx.sceneNavZoom(cam, 1e-9); assert.strictEqual(cam.distance, 0.5);
}
{
  // Fly: W moves along the view, Shift is faster, nothing held does nothing.
  const cam = new O.Camera(); cam.target = new O.Vec3(0, 0, 0); cam.distance = 6;
  const fwd = cam.getBasis().forward;
  assert.strictEqual(ctx.sceneNavFly(cam, new Set(), 1, 8), false);
  ctx.sceneNavFly(cam, new Set(['KeyW']), 0.5, 8);
  assert(near(cam.target.dot(fwd), 4, 1e-9), 'W flies forward at speed');
  cam.target = new O.Vec3(0, 0, 0);
  ctx.sceneNavFly(cam, new Set(['KeyE', 'ShiftLeft']), 0.5, 8);
  assert(near(cam.target.y, 12, 1e-9), 'E rises, Shift triples speed');
}
{
  // Wiring: module assembles before the boot module, gizmo keys yield while flying,
  // F frames the selection, Play restores the game orbit defaults.
  const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
  assert(modules.indexOf('54-scene-navigation.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
  assert(fs.readFileSync(path.join(root, 'editor/src/modules/09-selection-and-gizmo.js'), 'utf8').includes("typeof sceneNavigationActive === 'function' && sceneNavigationActive()"));
  assert(source.includes("event.code === 'KeyF'") && source.includes('focusViewportSelection()'));
  assert(source.includes('camera.setOrbitOptions(SCENE_NAV_GAME_ORBIT)'));
}
console.log('Scene navigation: orbit options, look, pan, zoom, fly and wiring PASS');
