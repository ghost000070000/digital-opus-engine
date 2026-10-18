'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { performance } = require('perf_hooks');
const F = require('../editor/src/00-collision-filter-2d.js'), C = require('../editor/src/00-collider-2d.js'), B = require('../editor/src/00-body-2d.js'), T = require('../editor/src/00-trigger-collider-2d.js'), P = require('../editor/src/00-authoring-plumbing.js'), Q = require('../editor/src/00-character-tile-query.js');
const out = path.resolve(__dirname, '../qualification/phase-049'); fs.mkdirSync(out, { recursive: true });
const report = { status: 'RUNNING', startedAtUtc: new Date().toISOString(), seeds: [], counts: { predicates: 0, registryMutations: 0, physicalDecisions: 0, triggerTicks: 0, sparseTileQueries: 0, carryDecisions: 0 }, memory: [] };
const smoke = process.argv.includes('--smoke'), divisor = smoke ? 100 : 1;
function rng(seed) { let state = seed >>> 0; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; }
const registry = () => [F.defaultLayer(), { id: 'world', name: 'World', order: 1 }, { id: 'character', name: 'Character', order: 2 }, { id: 'ghost', name: 'Ghost', order: 3 }];
const filter = (id, refs) => ({ collisionLayerRef: id, collisionMaskMode: refs === undefined ? 'all' : 'custom', collisionMaskRefs: refs || [] });
function reference(a, b, layers) {
  const ids = layers.map((layer) => layer.id), valid = (id) => ids.filter((value) => value === id).length === 1;
  const accepts = (a, id) => a.collisionMaskMode === 'all' || a.collisionMaskMode === 'custom' && Array.isArray(a.collisionMaskRefs) && a.collisionMaskRefs.indexOf(id) >= 0;
  return valid(a.collisionLayerRef) && valid(b.collisionLayerRef) && accepts(a, b.collisionLayerRef) && accepts(b, a.collisionLayerRef);
}
function actor(id, x, y, f, options = {}) {
  return { id, kind: 'cube', worldMatrix: C.composeMatrix({ position: [x, y, 0] }), entity: { position: { x, y, z: 0 } }, components: {
    'box-collider-2d': { version: 2, enabled: true, offset: [0, 0], size: options.size || [1, 1], ...f },
    'body-2d': { version: 1, enabled: true, type: options.static ? 'static' : 'kinematic', linearVelocity: options.velocity || [0, 0] },
    ...(options.character ? { 'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 } } : {}),
    ...(options.platform ? { 'moving-platform-2d': { version: 1, enabled: true } } : {}),
  } };
}
function randomFilter(random) {
  const ids = [F.DEFAULT_ID, 'world', 'character', 'ghost', 'missing'];
  const primary = ids[Math.floor(random() * ids.length)], mode = Math.floor(random() * 3);
  return { collisionLayerRef: primary, collisionMaskMode: mode === 0 ? 'all' : mode === 1 ? 'custom' : 'bad', collisionMaskRefs: ids.filter(() => random() > .5) };
}
let failureContext = null, started = performance.now();
try {
  for (let seed = 1; seed <= 20; seed++) {
    const random = rng(0x490000 + seed), layers = registry(), ids = F.validLayerIds(layers);
    for (let n = 0; n < 50000 / divisor; n++) {
      const a = randomFilter(random), b = randomFilter(random); failureContext = { seed, workload: 'predicate', a, b, layers };
      assert.strictEqual(F.allows(a, b, ids), reference(a, b, layers)); report.counts.predicates++;
    }
    const project = { collisionLayers: registry(), objects: [filter('world', ['world', 'character'])] };
    for (let n = 0; n < 12500 / divisor; n++) {
      const name = `Temporary ${n}`, id = `temporary-${n}`; failureContext = { seed, workload: 'registry', n };
      assert(F.addLayer(project, name, id).ok); report.counts.registryMutations++;
      assert(F.renameLayer(project, id, `Renamed ${n}`).ok); report.counts.registryMutations++;
      assert(F.reorderLayer(project, id, 1).ok); report.counts.registryMutations++;
      assert(F.deleteLayer(project, id, 'world', true).ok); report.counts.registryMutations++;
      assert.strictEqual(project.objects[0].collisionLayerRef, 'world'); assert.strictEqual(F.validateLayers(project.collisionLayers).length, 0);
    }
    const manager = B.createBody2DManager({ collisionLayers: () => layers });
    for (let n = 0; n < 25000 / divisor; n++) {
      const a = randomFilter(random), b = randomFilter(random), mover = actor('m', 0, 0, a), wall = actor('w', 2, 0, b, { static: true });
      failureContext = { seed, workload: 'physical', n, a, b };
      const result = manager.moveKinematicBody2D(mover, { x: 3, y: 0 }, [{ object: wall, shapes: C.enumerateCollider2DWorldShapes(wall) }]);
      assert.strictEqual(result.blockedX, reference(a, b, layers)); assert(reference(a, b, layers) ? result.actualDelta.x <= 1.00001 : result.actualDelta.x === 3); report.counts.physicalDecisions++;
    }
    const sensor = actor('sensor', 0, 0, filter('ghost', [])), target = actor('target', 0, 0, filter('character'));
    const lifecycle = T.createTriggerLifecycle({ collisionLayers: () => layers }); let prior = false;
    for (let n = 0; n < 12500 / divisor; n++) {
      const a = randomFilter(random), b = randomFilter(random); target.components['box-collider-2d'] = { ...target.components['box-collider-2d'], ...b };
      sensor.components['trigger-collider-2d'] = { version: 2, enabled: true, shape: 'box', offset: [0, 0], size: [2, 2], radius: 1, ...a };
      const accepted = reference(a, b, layers); failureContext = { seed, workload: 'trigger', n, a, b, prior };
      const events = lifecycle.tick([sensor, target]); assert.strictEqual(lifecycle.activePairCount(), accepted ? 1 : 0);
      assert.deepStrictEqual(events.map((event) => event.eventType), accepted ? [prior ? T.STAY : T.ENTER] : prior ? [T.EXIT] : []); prior = accepted; report.counts.triggerTicks++;
    }
    const tileset = P.createTileset({ id: 'ts', cellWidth: 1, cellHeight: 1, tiles: [{ id: 'tile', collision: { version: 1, mode: 'full-cell' } }] });
    const map = P.createTilemapRecord({ version: 6, id: 'map', tilesetRef: 'ts', layers: [{ id: 'layer', name: 'Layer', visible: false, locked: true, cells: Array.from({ length: 12 }, (_, x) => ({ x, y: 0, tileId: 'tile' })), ...filter('world') }] });
    map.entity = { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
    for (let n = 0; n < 5000 / divisor; n++) {
      const a = randomFilter(random), b = randomFilter(random), mover = actor('m', 0, 0, a); Object.assign(map.layers[0], b);
      const x = Math.floor(random() * 16) - 2, bounds = { minX: x + .1, minY: .1, maxX: x + .9, maxY: .9 };
      failureContext = { seed, workload: 'tile', n, a, b, bounds };
      const hits = Q.query([map], [tileset], mover, bounds, {}, layers);
      const expected = reference(a, b, layers) && x >= 0 && x < 12 ? [`tile:map:layer:${x}:0`] : [];
      assert.deepStrictEqual(hits.map((entry) => entry.object.id).sort(), expected); report.counts.sparseTileQueries++;
    }
    for (let n = 0; n < 5000 / divisor; n++) {
      const a = randomFilter(random), b = randomFilter(random), platform = actor('platform', 0, 0, b, { platform: true, size: [4, .5], velocity: [1, 0] }), rider = actor('rider', 0, .75, a, { character: true });
      const carry = B.createBody2DManager({ collisionLayers: () => layers }); failureContext = { seed, workload: 'carry', n, a, b };
      carry.tick([platform, rider], .1); assert(Math.abs(rider.entity.position.x - (reference(a, b, layers) ? .1 : 0)) < 1e-6);
      platform.components['box-collider-2d'].collisionMaskMode = 'custom'; platform.components['box-collider-2d'].collisionMaskRefs = [];
      const before = rider.entity.position.x; carry.tick([platform, rider], .1); assert(Math.abs(rider.entity.position.x - before) < 1e-6); report.counts.carryDecisions++;
    }
    report.seeds.push(0x490000 + seed); report.memory.push({ seed, heapUsed: process.memoryUsage().heapUsed });
    console.log(`Phase 049 seed ${seed}/20 passed`);
  }
  report.status = smoke ? 'SMOKE_PASS' : 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = { ...failureContext, error: error.stack }; process.exitCode = 1; }
report.elapsedSeconds = (performance.now() - started) / 1000; report.endedAtUtc = new Date().toISOString();
fs.writeFileSync(path.join(out, smoke ? 'filter-fuzz-smoke.json' : 'phase-049-filter-fuzz.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, counts: report.counts, elapsedSeconds: report.elapsedSeconds, failure: report.failure }));
