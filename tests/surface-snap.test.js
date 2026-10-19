'use strict';
// Surface snapping and precise authoring picks, against the real engine
// Entity/Mesh/Terrain math and the actual module source.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = { window: { addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } };
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), c);
const O = c.window.Opus;
const source = fs.readFileSync(path.join(root, 'editor/src/modules/55-surface-snap.js'), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function fixture() {
  let undo = 0;
  const box = (name, pos, scale, extra = {}) => {
    const entity = new O.Entity({ mesh: O.Mesh.cube(), position: new O.Vec3(...pos), scale: new O.Vec3(...scale) });
    return { id: name, name, kind: 'cube', entity, ...extra };
  };
  const ctx = {
    Opus: O, Math, Number, Set, WeakMap, Infinity, NaN,
    localStorage: { getItem: () => null, setItem() {} },
    placed: [], selectedItems: new Set(), selectedItem: null, playMode: false,
    pushUndo: () => { undo++; }, showStatus() {}, renderInspector() {},
    collectDescendants: (item) => ctx.placed.filter((other) => other.parentId === item.id),
    findItemById: (id) => ctx.placed.find((item) => item.id === id),
    itemPosition: (item) => item.entity.position,
    OpusAuthoringPlumbing: { isSpritePlacementPayload: () => false },
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(0, source.indexOf('(function mountSurfaceSnapToggle')), ctx);
  return { ctx, box, undo: () => undo };
}

{
  // A crate on a table: rays hit the crate first, then the table top, then the ground.
  const { ctx, box } = fixture();
  const ground = box('ground', [0, -0.25, 0], [40, 0.5, 40]);
  const table = box('table', [0, 1, 0], [4, 2, 4]);
  const crate = box('crate', [0.5, 2.5, 0.5], [1, 1, 1]);
  const marker = box('start', [3, 0.5, 3], [1, 1, 1], { isSpawnPoint: true });
  ctx.placed.push(ground, table, crate, marker);
  const down = new O.Vec3(0, -1, 0);
  let hit = ctx.raycastSceneSurfaces(new O.Vec3(0.5, 10, 0.5), down, null);
  assert.strictEqual(hit.item, crate); assert(near(hit.point.y, 3));
  hit = ctx.raycastSceneSurfaces(new O.Vec3(0.5, 10, 0.5), down, new Set([crate]));
  assert.strictEqual(hit.item, table, 'excluded items are skipped'); assert(near(hit.point.y, 2));
  hit = ctx.raycastSceneSurfaces(new O.Vec3(3, 10, 3), down, null);
  assert.strictEqual(hit.item, ground, 'player-start markers are not surfaces'); assert(near(hit.point.y, 0));
  // Rotated objects use their real oriented box, not a sphere or axis box.
  table.entity.quaternion = O.Quat.fromEuler(0, Math.PI / 4, 0);
  hit = ctx.raycastSceneSurfaces(new O.Vec3(2.5, 10, 0), down, new Set([crate]));
  assert.strictEqual(hit.item, table, 'a 45° table reaches 2.83 m along X');
  hit = ctx.raycastSceneSurfaces(new O.Vec3(1.9, 10, 1.9), down, new Set([crate]));
  assert.strictEqual(hit.item, ground, 'and no longer covers its old corner');
  // Nothing at all: the Y = 0 plane, as before; looking up: nothing.
  const empty = fixture().ctx;
  assert(near(empty.raycastSceneSurfaces(new O.Vec3(1, 5, 1), down, null).point.y, 0));
  assert.strictEqual(empty.raycastSceneSurfaces(new O.Vec3(1, 5, 1), new O.Vec3(0, 1, 0), null), null);
}
{
  // Triangle meshes are hit on their faces, not their bounds: a ramp-shaped wedge.
  const { ctx } = fixture();
  // Rises from y=0 at x=-1 to y=2 at x=1 (the engine validates typed arrays from its own realm).
  const F32 = vm.runInContext('Float32Array', c), U16 = vm.runInContext('Uint16Array', c);
  const positions = F32.from([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 2, -1, 1, 2, 1]);
  const wedge = O.Mesh.fromArrays(positions, new F32(positions.length), U16.from([0, 2, 1, 0, 3, 2, 3, 5, 2, 0, 1, 4, 0, 4, 3, 3, 4, 5, 1, 2, 5, 1, 5, 4]));
  const item = { id: 'ramp', kind: 'cube', entity: new O.Entity({ mesh: wedge, position: new O.Vec3(0, 0, 0) }) };
  ctx.placed.push(item);
  const hit = ctx.raycastSceneSurfaces(new O.Vec3(0, 10, 0), new O.Vec3(0, -1, 0), null);
  assert.strictEqual(hit.item, item);
  assert(near(hit.point.y, 1, 1e-4), 'slope height at the middle, not the 2 m bounds top: ' + hit.point.y);
}
{
  // Terrain heightfields: the hit matches the engine's own sampleHeight.
  const { ctx } = fixture();
  const options = { size: 30, seed: 7, amplitude: 3, position: new O.Vec3(2, 0.5, -1) };
  const handle = { options, position: options.position, sampleHeight: (x, z) => O.Terrain.sampleHeight(x - 2, z + 1, options) + 0.5 };
  ctx.placed.push({ id: 't', kind: 'terrain', handle, options });
  for (const [x, z] of [[2, -1], [6, 3], [-5, 4]]) {
    const hit = ctx.raycastSceneSurfaces(new O.Vec3(x, 40, z), new O.Vec3(0, -1, 0), null);
    assert(hit && near(hit.point.y, handle.sampleHeight(x, z), 1e-3), `terrain height at ${x},${z}`);
  }
  // A slanted camera ray lands on the surface too.
  const dir = new O.Vec3(0.3, -1, 0.2).normalize();
  const hit = ctx.raycastSceneSurfaces(new O.Vec3(0, 30, 0), dir, null);
  assert(near(hit.point.y, handle.sampleHeight(hit.point.x, hit.point.z), 1e-3), 'slanted ray meets the heightfield');
}
{
  // Drops rest the lowest new object on the surface; End drops selections, one Undo step.
  const { ctx, box, undo } = fixture();
  const ground = box('ground', [0, -0.25, 0], [40, 0.5, 40]);
  const table = box('table', [0, 1, 0], [4, 2, 4]);
  const crate = box('crate', [0.5, 0.5, 0.5], [1, 1, 1]);
  ctx.placed.push(ground, table, crate);
  assert(ctx.restNewItemsOnSurface([crate], 2));
  assert(near(crate.entity.position.y, 2.5), 'crate base on the table top');
  const sprite = { id: 's', kind: 'sprite', entity: new O.Entity({ mesh: O.Mesh.cube() }) };
  assert(!ctx.restNewItemsOnSurface([sprite], 2), 'sprites keep their own height');
  crate.entity.position.set(-1, 9, -1);
  ctx.selectedItems.add(crate);
  assert.strictEqual(ctx.dropSelectionToSurface(), 1);
  assert(near(crate.entity.position.y, 2.5), 'End lands on the table, not through it');
  assert.strictEqual(undo(), 1);
  crate.entity.position.set(5, 9, 5);
  ctx.dropSelectionToSurface();
  assert(near(crate.entity.position.y, 0.5), 'off the table it lands on the ground');
  assert.strictEqual(ctx.dropSelectionToSurface(), 0, 'already resting: nothing to do');
  ctx.playMode = true; crate.entity.position.y = 4;
  assert.strictEqual(ctx.dropSelectionToSurface(), 0, 'never during Play');
}
{
  // Wiring: picks use the precise ray only while authoring, drags and drops call in guarded.
  const pick = fs.readFileSync(path.join(root, 'editor/src/modules/04-collider-visualization.js'), 'utf8');
  assert(pick.includes("if (!playMode && typeof surfaceRayEntity === 'function')"), 'Play keeps the sphere pick');
  const gizmo = fs.readFileSync(path.join(root, 'editor/src/modules/09-selection-and-gizmo.js'), 'utf8');
  assert(gizmo.includes("typeof applySurfaceDragMovement === 'function'") && gizmo.includes("typeof prepareSurfaceDrag === 'function'"));
  const prefabs = fs.readFileSync(path.join(root, 'editor/src/modules/07-prefabs.js'), 'utf8');
  assert(prefabs.includes("typeof surfacePlacementPoint==='function'") && prefabs.includes('restNewItemsOnSurface('));
  const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
  assert(modules.indexOf('55-surface-snap.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
}
console.log('Surface snap: mesh/box/terrain raycasts, resting drops, End drop, precise picks PASS');
