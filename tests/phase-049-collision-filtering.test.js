'use strict';
const assert = require('assert');
const F = require('../editor/src/00-collision-filter-2d.js');
const A = require('../editor/src/00-authoring-schema.js');
const C = require('../editor/src/00-collider-2d.js');
const B = require('../editor/src/00-body-2d.js');
const T = require('../editor/src/00-trigger-collider-2d.js');
const P = require('../editor/src/00-authoring-plumbing.js');
const Q = require('../editor/src/00-character-tile-query.js');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { process.exitCode = 1; console.error(`FAIL ${name}\n${error.stack}`); } }
const registry = () => [F.defaultLayer(), { id: 'world', name: 'World', order: 1 }, { id: 'character', name: 'Character', order: 2 }, { id: 'ghost', name: 'Ghost', order: 3 }];
const filter = (id, refs) => ({ collisionLayerRef: id, collisionMaskMode: refs === undefined ? 'all' : 'custom', collisionMaskRefs: refs || [] });
function actor(id, x, y, layer = 'character', refs, options = {}) {
  return { id, kind: 'cube', worldMatrix: C.composeMatrix({ position: [x, y, 0], rotation: options.rotation || 0 }), entity: { position: { x, y, z: 0 } }, components: {
    'box-collider-2d': { version: 2, enabled: true, offset: [0, 0], size: options.size || [1, 1], ...filter(layer, refs) },
    'body-2d': { version: 1, enabled: true, type: options.static ? 'static' : 'kinematic', linearVelocity: options.velocity || [0, 0] },
    ...(options.character ? { 'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 } } : {}),
    ...(options.platform ? { 'moving-platform-2d': { version: 1, enabled: true } } : {}),
    ...(options.oneWay ? { 'one-way-platform-2d': { version: 1, enabled: true } } : {}),
  } };
}
test('Default reserved, unique names, 32-layer limit', () => {
  const project = { collisionLayers: [F.defaultLayer()] };
  assert(!F.renameLayer(project, F.DEFAULT_ID, 'Other').ok);
  assert(!F.deleteLayer(project, F.DEFAULT_ID, null, true).ok);
  assert(F.addLayer(project, ' World ', 'world').ok);
  assert(!F.addLayer(project, 'world').ok);
  for (let n = 2; n < 32; n++) assert(F.addLayer(project, `Layer ${n}`, `layer-${n}`).ok);
  assert(!F.addLayer(project, 'Overflow').ok);
  assert.deepStrictEqual(F.validateLayers(project.collisionLayers), []);
});
test('predicate is mutual, empty Custom rejects, missing IDs fail closed', () => {
  const layers = registry();
  assert(F.allows(filter('character', ['world']), filter('world', ['character']), layers));
  assert(!F.allows(filter('character', ['world']), filter('world', []), layers));
  assert(!F.allows(filter('missing'), filter('world'), layers));
  assert(F.allows(filter('character', ['missing', 'world']), filter('world'), layers));
  layers.push({ id: 'future', name: 'Future' });
  assert(F.allows(filter('character'), filter('future'), layers));
});
test('rename and reorder leave semantic IDs unchanged', () => {
  const project = { collisionLayers: registry(), objects: [{ ...filter('world', ['character']) }] };
  const before = JSON.stringify(project.objects);
  assert(F.renameLayer(project, 'world', 'Environment').ok);
  assert(F.reorderLayer(project, 'world', 3).ok);
  assert.strictEqual(JSON.stringify(project.objects), before);
});
test('delete requires explicit primary replacement and removes mask membership only', () => {
  const project = { collisionLayers: registry(), objects: [filter('world', ['world', 'ghost']), filter('character', ['world'])] };
  assert(!F.deleteLayer(project, 'world', null, true).ok);
  assert(F.deleteLayer(project, 'world', 'ghost', true).ok);
  assert.deepStrictEqual(project.objects, [filter('ghost', ['ghost']), filter('character', [])]);
});
test('v1 component migrations are explicit Default/All; v2 preserves missing ref', () => {
  for (const id of ['box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d']) {
    const item = { kind: 'cube', components: { [id]: { version: 1 } } }; A.ensureComponent(item, id);
    assert.strictEqual(item.components[id].version, 2);
    for (const [key, value] of Object.entries(F.defaultFilter())) assert.deepStrictEqual(item.components[id][key], value);
    item.components[id].collisionLayerRef = 'lost'; A.ensureComponent(item, id);
    assert.strictEqual(item.components[id].collisionLayerRef, 'lost');
  }
});
test('historical Tilemaps migrate all layers; current missing ref stays invalid', () => {
  const old = P.createTilemapRecord({ version: 5, layers: [{ id: 'one', cells: [] }, { id: 'two', cells: [] }] });
  assert.strictEqual(old.version, 6);
  assert(old.layers.every((layer) => layer.collisionLayerRef === F.DEFAULT_ID));
  const current = P.createTilemapRecord({ version: 6, layers: [{ id: 'one', cells: [] }] });
  assert.strictEqual(current.layers[0].collisionLayerRef, undefined);
});
test('physical sweep rejects before narrowphase; accepted pairs block', () => {
  const mover = actor('mover', 0, 0, 'character', ['world']), wall = actor('wall', 2, 0, 'world', [], { static: true });
  const manager = B.createBody2DManager({ collisionLayers: registry });
  manager.tick([mover, wall], .1);
  const rejected = manager.moveKinematicBody2D(mover, { x: 3, y: 0 }, [{ object: wall, shapes: C.enumerateCollider2DWorldShapes(wall) }]);
  assert.strictEqual(rejected.actualDelta.x, 3); assert.strictEqual(manager.metrics.narrowTests, 0); assert(manager.metrics.filterRejects > 0);
  mover.entity.position.x = 0; mover.worldMatrix[12] = 0; wall.components['box-collider-2d'].collisionMaskRefs = ['character'];
  const accepted = manager.moveKinematicBody2D(mover, { x: 3, y: 0 }, [{ object: wall, shapes: C.enumerateCollider2DWorldShapes(wall) }]);
  assert(accepted.blockedX && accepted.actualDelta.x < 1.01);
});
test('mixed shapes use an accepted real pair, not object-wide mask', () => {
  const mover = actor('mover', 0, 0, 'character', []), wall = actor('wall', 2, 0, 'world', undefined, { static: true });
  mover.components['circle-collider-2d'] = { version: 2, enabled: true, offset: [0, 0], radius: .5, ...filter('character', ['world']) };
  const result = B.createBody2DManager({ collisionLayers: registry }).moveKinematicBody2D(mover, { x: 3, y: 0 }, [{ object: wall, shapes: C.enumerateCollider2DWorldShapes(wall) }]);
  assert(result.blockedX); assert.deepStrictEqual(result.hitObjectIds, ['wall']);
});
test('trigger filters independently; change emits Exit then restore Enter', () => {
  const sensor = actor('sensor', 0, 0, 'ghost', []), target = actor('target', 0, 0);
  sensor.components['trigger-collider-2d'] = { version: 2, enabled: true, shape: 'box', offset: [0, 0], size: [2, 2], radius: 1, ...filter('world', ['character']) };
  const manager = T.createTriggerLifecycle({ collisionLayers: registry });
  assert.strictEqual(manager.tick([sensor, target])[0].eventType, T.ENTER);
  sensor.components['trigger-collider-2d'].collisionMaskRefs = [];
  assert.strictEqual(manager.tick([sensor, target])[0].eventType, T.EXIT);
  assert.strictEqual(manager.activePairCount(), 0);
  sensor.components['trigger-collider-2d'].collisionMaskRefs = ['character'];
  assert.strictEqual(manager.tick([sensor, target])[0].eventType, T.ENTER);
});
test('moving support rechecks masks before carrying previous rider', () => {
  const platform = actor('platform', 0, 0, 'world', ['character'], { platform: true, size: [4, .5], velocity: [2, 0] });
  const rider = actor('rider', 0, .75, 'character', ['world'], { character: true });
  const manager = B.createBody2DManager({ collisionLayers: registry });
  manager.tick([platform, rider], .5); assert(Math.abs(rider.entity.position.x - 1) < 1e-6);
  platform.components['box-collider-2d'].collisionMaskRefs = [];
  manager.tick([platform, rider], .5); assert(Math.abs(rider.entity.position.x - 1) < 1e-6);
  assert(!manager.getCharacterCollision2DState(rider.id).grounded);
});
test('tile layer rejection skips every candidate cell regardless of visibility/lock', () => {
  const mover = actor('mover', 0, 0), map = P.createTilemapRecord({ version: 6, id: 'map', tilesetRef: 'ts', layers: [{ id: 'layer', visible: false, locked: true, cells: [{ x: 0, y: 0, tileId: 'tile' }], ...filter('world', []) }] });
  map.entity = { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
  const ts = P.createTileset({ id: 'ts', cellWidth: 1, cellHeight: 1, tiles: [{ id: 'tile', collision: { mode: 'solid' } }] }), metrics = {};
  assert.deepStrictEqual(Q.query([map], [ts], mover, { minX: -1, minY: -1, maxX: 2, maxY: 2 }, metrics, registry()), []);
  assert.strictEqual(metrics.candidateCells || 0, 0); assert.strictEqual(metrics.filterRejectedLayers, 1);
});
test('raw malformed mask references stay visible to validation', () => {
  const issues = F.validateFilter({ version: 2, ...filter('world', ['lost', 'lost']) }, registry());
  assert(issues.some((entry) => entry.code === 'collision-filter-duplicate-ref'));
  assert(issues.some((entry) => entry.code === 'collision-filter-mask-missing'));
});
test('one-sided rejection applies to Character grounding and one-way platforms', () => {
  for (const oneWay of [false, true]) for (const accept of [false, true]) {
    const ground = actor('ground', 0, 0, 'world', accept ? ['character'] : [], { static: true, oneWay, size: [4, .5] });
    const mover = actor('character', 0, 2, 'character', ['world'], { character: true, velocity: [0, -4] });
    const manager = B.createBody2DManager({ collisionLayers: registry }); manager.tick([ground, mover], .5);
    assert.strictEqual(manager.getCharacterCollision2DState(mover.id).grounded, accept);
    assert(accept ? mover.entity.position.y >= .75 : Math.abs(mover.entity.position.y) < 1e-6);
  }
});
test('slope rejection removes support without inventing an axis-aligned collider', () => {
  for (const accept of [false, true]) {
    const ground = actor('slope', 0, 0, 'world', accept ? ['character'] : [], { static: true, rotation: Math.PI / 6, size: [4, .5] });
    const mover = actor('character', 0, 3, 'character', ['world'], { character: true, velocity: [0, -6] });
    const manager = B.createBody2DManager({ collisionLayers: registry }); manager.tick([ground, mover], .5);
    assert.strictEqual(manager.getCharacterCollision2DState(mover.id).grounded, accept);
    assert(accept ? mover.entity.position.y > .5 : Math.abs(mover.entity.position.y) < 1e-6);
  }
});
test('carry Static obstruction uses the rider filter, not the platform filter', () => {
  for (const accept of [false, true]) {
    const platform = actor('platform', 0, 0, 'world', ['character'], { platform: true, size: [4, .5], velocity: [4, 0] });
    const rider = actor('rider', 0, .75, 'character', ['world'], { character: true });
    const wall = actor('wall', 2, .75, accept ? 'world' : 'ghost', ['character'], { static: true });
    const manager = B.createBody2DManager({ collisionLayers: registry }); manager.tick([platform, rider, wall], .5);
    assert(accept ? rider.entity.position.x < 1.01 : Math.abs(rider.entity.position.x - 2) < 1e-6);
    assert.strictEqual(manager.metrics.carryClamps > 0, accept);
  }
});
test('registry options use canonical authoring order rather than label sorting', () => {
  const layers = registry(); layers[1].name = 'Zed'; layers[2].name = 'Alpha';
  assert.deepStrictEqual(P.getReferenceOptions('collisionLayer', { collisionLayers: layers }).map((option) => option.value), layers.map((layer) => layer.id));
});
test('step geometry is considered only when its own pair is accepted', () => {
  for (const accept of [false, true]) {
    const floor = actor('floor', 0, 0, 'world', ['character'], { static: true, size: [12, 1] });
    const step = actor('step', 2, .65, 'world', accept ? ['character'] : [], { static: true, size: [1, .3] });
    const mover = actor('mover', 0, 1, 'character', ['world'], { character: true, velocity: [4, 0] });
    const manager = B.createBody2DManager({ collisionLayers: registry }); manager.tick([floor, step, mover], .5);
    assert(accept ? mover.entity.position.y > 1.1 : Math.abs(mover.entity.position.y - 1) < 1e-6);
  }
});
test('Tile carry obstruction uses mutually accepted Tile Layer filters', () => {
  for (const accept of [false, true]) {
    const platform = actor('platform', 0, 0, 'world', ['character'], { platform: true, size: [4, .5], velocity: [4, 0] });
    const rider = actor('rider', 0, .75, 'character', ['world'], { character: true });
    const map = P.createTilemapRecord({ version: 6, id: 'map', tilesetRef: 'ts', layers: [{ id: 'wall', cells: [{ x: 2, y: 0, tileId: 'tile' }], ...filter('world', accept ? ['character'] : []) }] });
    map.entity = { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
    const ts = P.createTileset({ id: 'ts', cellSize: { width: 1, height: 1 }, tiles: [{ id: 'tile', collision: { version: 1, mode: 'full-cell' } }] });
    const manager = B.createBody2DManager({ collisionLayers: registry, tileObstacles: (mover, bounds) => Q.query([map], [ts], mover, bounds, null, registry()) });
    manager.tick([platform, rider], .5);
    assert(accept ? rider.entity.position.x < 1.51 : Math.abs(rider.entity.position.x - 2) < 1e-6, JSON.stringify({ accept, position: rider.entity.position, metrics: manager.metrics }));
    assert.strictEqual(manager.metrics.carryClamps > 0, accept);
  }
});
console.log(`Phase 049: ${passed} passed`);
module.exports = { actor, registry, filter };
