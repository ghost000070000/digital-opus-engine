'use strict';
// Physics Objects on real engine entities: gravity and landing, walls, push
// from intent (solid boxes stop the player), mass, rolling, settings
// normalization and save/load wiring.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = { window: { addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } };
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), c);
const O = c.window.Opus;
const surface = fs.readFileSync(path.join(root, 'editor/src/modules/55-surface-snap.js'), 'utf8');
const physics = fs.readFileSync(path.join(root, 'editor/src/modules/68-physics-objects.js'), 'utf8');
const ctx = { Opus: O, Math, Number, Set, WeakMap, Infinity, NaN, Object, localStorage: { getItem: () => null }, placed: [], player: null, playMode: true, currentPlayerSettings: { moveSpeed: 5 } };
vm.createContext(ctx);
vm.runInContext(surface.slice(0, surface.indexOf('(function mountSurfaceSnapToggle')), ctx);
vm.runInContext(physics.slice(0, physics.indexOf('let physicsPlayerPrev = null;')), ctx);
const box = (id, pos, scale, extra = {}) => { const entity = new O.Entity({ mesh: O.Mesh.cube(), position: new O.Vec3(...pos), scale: new O.Vec3(...scale) }); entity.solid = true; return { id, kind: 'cube', entity, ...extra }; };
const run = (item, seconds, push = null) => { for (let t = 0; t < seconds; t += 1 / 60) ctx.stepPhysicsBody(item, 1 / 60, ctx.physicsObstacles(item), push); };
const body = (id, pos, settings = {}) => { const item = box(id, pos, [1, 1, 1], { physics: ctx.normalizePhysicsSettings({ ...ctx.PHYSICS_DEFAULTS, ...settings }) }); item._phys = { vel: new O.Vec3(), start: item.entity.position.clone(), grounded: false }; return item; };

{
  // Falls and lands on the ground block; does not sink.
  const ground = box('ground', [0, -0.25, 0], [40, 0.5, 40]);
  const crate = body('crate', [0, 4, 0]);
  ctx.placed.splice(0, ctx.placed.length, ground, crate);
  run(crate, 1.5);
  assert(Math.abs(crate.entity.position.y - 0.5) < 0.02, 'rests on the ground: ' + crate.entity.position.y);
  assert(crate._phys.grounded, 'knows it is grounded');
  // Pushed into a wall: stops at the wall face instead of passing through.
  const wall = box('wall', [3, 1, 0], [1, 2, 4]);
  ctx.placed.push(wall);
  run(crate, 2, new O.Vec3(4, 0, 0));
  assert(crate.entity.position.x + 0.5 <= 2.5 + 1e-3 && crate.entity.position.x > 1.9, 'stops against the wall: ' + crate.entity.position.x);
  // Friction brings it to rest once the push ends.
  run(crate, 2);
  assert.strictEqual(crate._phys.vel.x, 0, 'slides to a stop');
}
{
  // Heavier objects are pushed more slowly.
  const ground = box('ground', [0, -0.25, 0], [80, 0.5, 80]);
  const light = body('light', [0, 0.5, 0], { mass: 1 }), heavy = body('heavy', [0, 0.5, 10], { mass: 4 });
  ctx.placed.splice(0, ctx.placed.length, ground, light, heavy);
  run(light, 1, new O.Vec3(4, 0, 0)); run(heavy, 1, new O.Vec3(4, 0, 0));
  assert(light.entity.position.x > heavy.entity.position.x * 2, `light ${light.entity.position.x} vs heavy ${heavy.entity.position.x}`);
}
{
  // Balls roll; bounce reflects a hard landing.
  const ground = box('ground', [0, -0.25, 0], [80, 0.5, 80]);
  const ball = body('ball', [0, 0.5, 0], { shape: 'ball', friction: 0.5 });
  ctx.placed.splice(0, ctx.placed.length, ground, ball);
  const q0 = ball.entity.quaternion.clone();
  ball._phys.vel = new O.Vec3(5, 0, 0);
  run(ball, 0.5);
  assert(ball.entity.position.x > 1.5 && Math.abs(ball.entity.quaternion.w - q0.w) > 0.05, 'rolls as it travels');
  const bouncy = body('bouncy', [5, 6, 5], { bounce: 0.8 });
  ctx.placed.push(bouncy);
  let bounced = false;
  for (let t = 0; t < 2; t += 1 / 60) { ctx.stepPhysicsBody(bouncy, 1 / 60, ctx.physicsObstacles(bouncy), null); if (bouncy._phys.vel.y > 1) bounced = true; }
  assert(bounced, 'bouncy objects bounce');
}
{
  // Push intent: touching + moving key + facing, even when the solid box stopped the player.
  const crate = body('crate', [0, 0.5, 2]);
  const intent = { moving: true, facing: new O.Vec3(0, 0, 1), speed: 4, velocity: new O.Vec3(0, 0, 0) };
  const push = ctx.physicsPushFor(crate, new O.Vec3(0, 0.9, 1.1), intent, 0.4);
  assert(push && Math.abs(push.z - 4) < 1e-9 && push.x === 0, 'pushes straight along the face it is pressed on');
  assert.strictEqual(ctx.physicsPushFor(crate, new O.Vec3(0, 0.9, 1.1), { ...intent, moving: false }, 0.4), null, 'no keys: no push');
  assert.strictEqual(ctx.physicsPushFor(crate, new O.Vec3(0, 0.9, 1.1), { ...intent, facing: new O.Vec3(0, 0, -1) }, 0.4), null, 'facing away: no push');
  assert.strictEqual(ctx.physicsPushFor(crate, new O.Vec3(0, 0.9, -1), intent, 0.4), null, 'not touching: no push');
  assert.strictEqual(ctx.physicsPushFor(crate, new O.Vec3(0, 2.2, 2), intent, 0.4), null, 'standing on top does not push');
  crate.physics.pushable = false;
  assert.strictEqual(ctx.physicsPushFor(crate, new O.Vec3(0, 0.9, 1.1), intent, 0.4), null, 'pushable can be turned off');
}
{
  const n = ctx.normalizePhysicsSettings({ shape: 'weird', mass: -3, bounce: 4, friction: 'x' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(n)), { enabled: true, shape: 'box', gravity: true, pushable: true, mass: 0.1, bounce: 0.95, friction: 6 }, 'settings are bounded');
  assert.strictEqual(ctx.normalizePhysicsSettings(null), null);
}
// Wiring: saved and loaded with the object; Inspector card mounted.
const serialization = fs.readFileSync(path.join(root, 'editor/src/modules/36-scene-serialization.js'), 'utf8');
assert.strictEqual((serialization.match(/physics: item\.physics \? \{ \.\.\.item\.physics \} : undefined/g) || []).length, 2, 'saved in both record writers');
assert.strictEqual((serialization.match(/physics: record\.physics && typeof record\.physics === 'object'/g) || []).length, 2, 'loaded in both record readers');
assert(fs.readFileSync(path.join(root, 'editor/src/modules/33-inspector.js'), 'utf8').includes("typeof mountPhysicsInspectorSection === 'function'"));
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('68-physics-objects.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)), 'ready before games boot into Play');
console.log('Physics Objects: falling, walls, friction, mass, rolling, bounce, push intent, saving PASS');
