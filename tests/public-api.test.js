const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(path.join(ROOT, 'dist', 'opus-engine.js'), 'utf8');

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      if (listeners.has(type)) listeners.get(type).delete(handler);
    },
    dispatch(type, event = {}) {
      for (const handler of [...(listeners.get(type) || [])]) handler(event);
    },
    listenerCount(type) {
      return (listeners.get(type) || new Set()).size;
    },
  };
}

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); },
};
const windowTarget = eventTarget();
const documentTarget = Object.assign(eventTarget(), { hidden: false });
// Share typed-array constructors with the host so public `instanceof` validation
// sees the test data exactly as it would in one browser realm.
const context = {
  window: windowTarget,
  document: documentTarget,
  localStorage,
  Float32Array,
  Uint16Array,
};
vm.runInNewContext(bundle, context, { filename: 'dist/opus-engine.js' });

const Opus = context.window.Opus;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    failed++;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error);
  }
}

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function vecClose(actual, expected, epsilon = 1e-6) {
  close(actual.x, expected[0], epsilon);
  close(actual.y, expected[1], epsilon);
  close(actual.z, expected[2], epsilon);
}

test('exports the documented version and public systems', () => {
  assert.strictEqual(Opus.VERSION, '0.1.0');
  for (const name of ['Vec3', 'Mat4', 'Mesh', 'Terrain', 'Water', 'Physics']) {
    assert.ok(Opus[name], `missing Opus.${name}`);
  }
});

test('Vec3 arithmetic is immutable and numerically correct', () => {
  const a = new Opus.Vec3(1, 2, 3);
  const b = new Opus.Vec3(4, -1, 2);
  vecClose(a.add(b), [5, 1, 5]);
  vecClose(a.sub(b), [-3, 3, 1]);
  vecClose(a.scale(2), [2, 4, 6]);
  assert.strictEqual(a.dot(b), 8);
  vecClose(a.cross(b), [7, 10, -9]);
  vecClose(a, [1, 2, 3]);
});

test('Vec3 normalization and interpolation handle edge cases', () => {
  vecClose(new Opus.Vec3().normalize(), [0, 0, 0]);
  close(new Opus.Vec3(3, 4, 0).normalize().length(), 1);
  vecClose(Opus.Vec3.lerp(new Opus.Vec3(0, 2, 4), new Opus.Vec3(10, 4, 0), 0.25), [2.5, 2.5, 3]);
  assert.throws(() => new Opus.Vec3(NaN, 0, 0), /must be a number/);
});

test('Mat4 identity and composition preserve expected transforms', () => {
  const identity = Opus.Mat4.identity();
  const translation = Opus.Mat4.compose(
    new Opus.Vec3(2, 3, 4),
    0,
    new Opus.Vec3(1, 1, 1)
  );
  const product = Opus.Mat4.multiply(identity, translation).m;
  close(product[0], 1);
  close(product[5], 1);
  close(product[10], 1);
  close(product[12], 2);
  close(product[13], 3);
  close(product[14], 4);
  close(product[15], 1);
  assert.throws(() => Opus.Mat4.perspective(1, 1, 10, 1), /less than far/);
});

test('mesh factories return frozen CPU descriptions and validate arrays', () => {
  const cube = Opus.Mesh.cube();
  assert.strictEqual(cube.kind, 'cube');
  assert.ok(Object.isFrozen(cube));
  const custom = Opus.Mesh.fromArrays(
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    new Uint16Array([0, 1, 2])
  );
  assert.strictEqual(custom.kind, 'arrays');
  assert.throws(() => Opus.Mesh.grid(10, 255), /1 through 254/);
});

test('terrain sampling is deterministic and respects map bounds', () => {
  const opts = { seed: 42, size: 20, radius: 8, amplitude: 1.2, oceanFloor: -3 };
  const first = Opus.Terrain.sampleHeight(1.25, -2.5, opts);
  const second = Opus.Terrain.sampleHeight(1.25, -2.5, { ...opts });
  assert.strictEqual(first, second);
  assert.notStrictEqual(first, Opus.Terrain.sampleHeight(1.25, -2.5, { ...opts, seed: 43 }));
  assert.strictEqual(Opus.Terrain.sampleHeight(11, 0, opts), -3);
  const normal = Opus.Terrain.sampleNormal(1.25, -2.5, opts);
  close(normal.length(), 1);
  assert.ok(normal.y > 0);
});

test('water height and surface sampling agree in world space', () => {
  const water = {
    position: new Opus.Vec3(5, -1.5, -3),
    waves: [
      { dir: [1, 0], freq: 1, speed: 1, amp: 0.2 },
      { dir: [0, 1], freq: 2, speed: -0.5, amp: 0.1 },
      { dir: [1, 1], freq: 0.5, speed: 0.25, amp: 0.05 },
    ],
  };
  close(Opus.Water.sampleHeight(water, 5, -3, 0), -1.5);
  const height = Opus.Water.sampleHeight(water, 6, -2, 1.25);
  const surface = Opus.Water.sampleSurface(water, 6, -2, 1.25);
  close(surface.height, height);
  close(surface.normal.length(), 1);
  assert.ok(surface.intensity >= 0 && surface.intensity <= 1);
  assert.ok(surface.foamFactor >= 0);
});

test('sphere and AABB intersection helpers cover hits and misses', () => {
  const origin = new Opus.Vec3(0, 0, 0);
  const forward = new Opus.Vec3(0, 0, 1);
  assert.strictEqual(Opus.Physics.raySphere(origin, forward, new Opus.Vec3(0, 0, 5), 1), 4);
  assert.strictEqual(Opus.Physics.raySphere(origin, forward, new Opus.Vec3(3, 0, 5), 1), null);
  assert.ok(Opus.Physics.sphereSphereIntersect(origin, 1, new Opus.Vec3(2, 0, 0), 1));
  assert.ok(!Opus.Physics.sphereSphereIntersect(origin, 1, new Opus.Vec3(2.01, 0, 0), 1));

  const box = Opus.Physics.AABB.fromCenterSize(
    new Opus.Vec3(0, 0, 5),
    new Opus.Vec3(2, 2, 2)
  );
  assert.strictEqual(Opus.Physics.rayAABB(origin, forward, box), 4);
  assert.strictEqual(Opus.Physics.rayAABB(origin, new Opus.Vec3(1, 0, 0), box), null);
  assert.ok(box.containsPoint(new Opus.Vec3(1, 1, 4)));
});

test('trigger volumes emit one enter and exit for a swept crossing', () => {
  let enters = 0;
  let exits = 0;
  const trigger = new Opus.Physics.TriggerVolume({
    center: new Opus.Vec3(0, 0, 0),
    radius: 0.5,
    onEnter: () => enters++,
    onExit: () => exits++,
  });
  trigger.update(new Opus.Vec3(2, 0, 0), new Opus.Vec3(-2, 0, 0));
  assert.strictEqual(enters, 1);
  assert.strictEqual(exits, 1);
  assert.strictEqual(trigger.inside, false);
});

test('trigger volumes do not duplicate events while state is unchanged', () => {
  let enters = 0;
  let exits = 0;
  const trigger = new Opus.Physics.TriggerVolume({
    center: new Opus.Vec3(),
    radius: 1,
    onEnter: () => enters++,
    onExit: () => exits++,
  });
  trigger.update(new Opus.Vec3(0.5, 0, 0));
  trigger.update(new Opus.Vec3(0.25, 0, 0));
  trigger.update(new Opus.Vec3(2, 0, 0));
  trigger.update(new Opus.Vec3(3, 0, 0));
  assert.strictEqual(enters, 1);
  assert.strictEqual(exits, 1);
});

test('terrain collision corrects penetration on gentle ground', () => {
  const opts = { seed: 7, size: 20, radius: 8, amplitude: 0.01 };
  const height = Opus.Terrain.sampleHeight(0, 0, opts);
  const result = Opus.Physics.resolveTerrainCollision(
    new Opus.Vec3(0, height + 0.25, 0),
    new Opus.Vec3(1, -2, 0),
    0.5,
    opts
  );
  assert.ok(result.collided);
  assert.ok(result.grounded);
  assert.ok(!result.steep);
  close(result.correctedPosition.y, height + 0.5);
  assert.strictEqual(result.correctedVelocity.y, 0);

  const clear = Opus.Physics.resolveTerrainCollision(
    new Opus.Vec3(0, height + 5, 0),
    new Opus.Vec3(0, -1, 0),
    0.5,
    opts
  );
  assert.ok(!clear.collided);
});

test('map boundary warns, corrects overflow, and avoids runaway inward speed', () => {
  const center = Opus.Physics.applyMapBoundary(new Opus.Vec3(), new Opus.Vec3(1, 0, 0), 1, 10);
  assert.ok(!center.warning);
  vecClose(center.correctedPosition, [0, 0, 0]);

  const outside = Opus.Physics.applyMapBoundary(
    new Opus.Vec3(10, 0, 0),
    new Opus.Vec3(2, 0, 0),
    1,
    10
  );
  assert.ok(outside.warning);
  assert.strictEqual(outside.intensity, 1);
  assert.ok(outside.correctedPosition.x < 10);
  assert.ok(outside.correctedVelocity.x < 0);

  const alreadyInward = Opus.Physics.applyMapBoundary(
    new Opus.Vec3(9, 0, 0),
    new Opus.Vec3(-1, 0, 0),
    1,
    10
  );
  assert.strictEqual(alreadyInward.correctedVelocity.x, -1);
});

test('entity updates stop permanently after idempotent destruction', () => {
  const entity = new Opus.Entity({
    mesh: Opus.Mesh.cube(),
    position: new Opus.Vec3(2, 3, 4),
  });
  entity.spin = 2;
  entity.update(0.5);
  assert.strictEqual(entity.rotationY, 1);
  close(entity.modelMatrix.m[12], 2);
  close(entity.modelMatrix.m[13], 3);
  close(entity.modelMatrix.m[14], 4);

  entity.destroy();
  entity.destroy();
  entity.update(1);
  assert.strictEqual(entity.rotationY, 1);
  assert.ok(entity.destroyed);
  assert.strictEqual(entity.visible, false);
});

test('scene removal and clearing destroy their owned entities', () => {
  const scene = new Opus.Scene();
  const first = new Opus.Entity({ mesh: Opus.Mesh.cube() });
  const second = new Opus.Entity({ mesh: Opus.Mesh.plane() });
  assert.strictEqual(scene.add(first), first);
  scene.add(second);
  assert.strictEqual(scene.entities.length, 2);
  assert.strictEqual(scene.remove(first), true);
  assert.ok(first.destroyed);
  assert.strictEqual(scene.remove(first), false);
  assert.throws(() => scene.add(first), /live Opus.Entity/);

  scene.clear();
  assert.strictEqual(scene.entities.length, 0);
  assert.ok(second.destroyed);
  scene.clear();
});

test('particle emitters enforce caps and release all particles', () => {
  const emitter = new Opus.ParticleEmitter({ rate: 0, maxParticles: 2 });
  emitter.emit(5);
  assert.strictEqual(emitter.particles.length, 2);
  emitter.update(0);
  emitter.destroy();
  emitter.destroy();
  assert.strictEqual(emitter.particles.length, 0);
});

test('input consumes transient state and removes every owned listener', () => {
  const target = eventTarget();
  const input = new Opus.Input(target);
  assert.strictEqual(windowTarget.listenerCount('keydown'), 1);
  assert.strictEqual(target.listenerCount('pointermove'), 1);

  windowTarget.dispatch('keydown', { code: 'Space' });
  assert.ok(input.isDown('Space'));
  assert.ok(input.wasPressed('Space'));
  assert.ok(!input.wasPressed('Space'));
  windowTarget.dispatch('keyup', { code: 'Space' });
  assert.ok(!input.isDown('Space'));

  target.dispatch('pointerdown', { clientX: 10, clientY: 20 });
  target.dispatch('pointermove', { clientX: 14, clientY: 17 });
  const drag = input.consumeDrag();
  assert.strictEqual(drag.dx, 4);
  assert.strictEqual(drag.dy, -3);
  const consumedDrag = input.consumeDrag();
  assert.strictEqual(consumedDrag.dx, 0);
  assert.strictEqual(consumedDrag.dy, 0);
  target.dispatch('wheel', { deltaY: 12, preventDefault() {} });
  assert.strictEqual(input.consumeWheel(), 12);
  assert.strictEqual(input.consumeWheel(), 0);

  input.destroy();
  assert.strictEqual(windowTarget.listenerCount('keydown'), 0);
  assert.strictEqual(windowTarget.listenerCount('keyup'), 0);
  assert.strictEqual(windowTarget.listenerCount('blur'), 0);
  assert.strictEqual(target.listenerCount('pointerdown'), 0);
  assert.strictEqual(target.listenerCount('pointermove'), 0);
  assert.strictEqual(target.listenerCount('wheel'), 0);
  assert.strictEqual(documentTarget.listenerCount('visibilitychange'), 0);
});

test('settings persist values and recover from corrupt storage', () => {
  localStorage.clear();
  const settings = new Opus.SettingsManager('test:settings', { quality: 'high', muted: false });
  assert.strictEqual(settings.get('quality'), 'high');
  settings.set('quality', 'low');
  const reloaded = new Opus.SettingsManager('test:settings', { quality: 'high', muted: false });
  assert.strictEqual(reloaded.get('quality'), 'low');
  assert.strictEqual(reloaded.get('muted'), false);

  localStorage.setItem('test:corrupt', '{not json');
  const recovered = new Opus.SettingsManager('test:corrupt', { quality: 'medium' });
  assert.strictEqual(recovered.get('quality'), 'medium');
});

test('save slots round-trip data and handle deletion', () => {
  localStorage.clear();
  const save = new Opus.SaveSystem('test:save');
  assert.strictEqual(save.has('slot-1'), false);
  assert.strictEqual(save.load('slot-1'), null);
  assert.strictEqual(save.save('slot-1', { score: 42, items: ['a', 'b'] }), true);
  assert.strictEqual(save.has('slot-1'), true);
  assert.strictEqual(JSON.stringify(save.load('slot-1')), JSON.stringify({ score: 42, items: ['a', 'b'] }));
  save.delete('slot-1');
  assert.strictEqual(save.has('slot-1'), false);
  assert.throws(() => save.save('', {}), /non-empty string/);
  assert.throws(() => new Opus.SaveSystem('  '), /non-empty string/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
