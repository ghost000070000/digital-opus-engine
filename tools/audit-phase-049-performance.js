'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), { performance } = require('perf_hooks');
const F = require('../editor/src/00-collision-filter-2d.js'), C = require('../editor/src/00-collider-2d.js'), B = require('../editor/src/00-body-2d.js'), T = require('../editor/src/00-trigger-collider-2d.js'), P = require('../editor/src/00-authoring-plumbing.js'), Q = require('../editor/src/00-character-tile-query.js');
const layers = [F.defaultLayer(), { id: 'world', name: 'World', order: 1 }, { id: 'character', name: 'Character', order: 2 }, { id: 'ghost', name: 'Ghost', order: 3 }];
const filter = (id, refs) => ({ collisionLayerRef: id, collisionMaskMode: 'custom', collisionMaskRefs: refs });
function actor(id, x, y, layer, refs, options = {}) {
  return { id, kind: 'cube', worldMatrix: C.composeMatrix({ position: [x, y, 0] }), entity: { position: { x, y, z: 0 } }, components: {
    'box-collider-2d': { version: 2, enabled: true, offset: [0, 0], size: options.size || [1, 1], ...filter(layer, refs) },
    'body-2d': { version: 1, enabled: true, type: options.static ? 'static' : 'kinematic', linearVelocity: options.velocity || [0, 0] },
    ...(options.character ? { 'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 } } : {}),
    ...(options.platform ? { 'moving-platform-2d': { version: 1, enabled: true } } : {}),
  } };
}
const report = { status: 'RUNNING', startedAtUtc: new Date().toISOString(), fixtures: [] };
function measured(name, work) { const start = performance.now(); const result = work(); report.fixtures.push({ name, elapsedMs: performance.now() - start, ...result }); }
try {
  const statics = Array.from({ length: 1000 }, (_, i) => actor(`static-${i}`, 100 + i, 0, i % 10 ? 'ghost' : 'world', ['character'], { static: true }));
  const entries = statics.map((object) => ({ object, shapes: C.enumerateCollider2DWorldShapes(object) }));
  measured('100 Kinematics × 1000 Statics, 90% mutual rejection', () => {
    const manager = B.createBody2DManager({ collisionLayers: layers });
    for (let i = 0; i < 100; i++) assert.strictEqual(manager.moveKinematicBody2D(actor(`m-${i}`, 0, i, 'character', ['world']), { x: 1, y: 0 }, entries).actualDelta.x, 1);
    assert(manager.metrics.filterRejects >= 90000); assert(manager.metrics.aabbTests <= 20000);
    return { metrics: manager.metrics, filterRejectionBeforeAABB: true };
  });
  measured('100 Triggers × 1000 targets, 90% rejection', () => {
    const targets = Array.from({ length: 1000 }, (_, i) => actor(`target-${i}`, i * 5, 0, i % 10 ? 'ghost' : 'character', ['world']));
    const sensors = Array.from({ length: 100 }, (_, i) => { const value = actor(`sensor-${i}`, i * 50, 0, 'ghost', []); value.components['trigger-collider-2d'] = { version: 2, enabled: true, shape: 'box', offset: [0, 0], size: [2, 2], radius: 1, ...filter('world', ['character']) }; return value; });
    const manager = T.createTriggerLifecycle({ collisionLayers: layers }); const events = manager.tick([...sensors, ...targets]);
    assert.strictEqual(events.length, 100); assert(manager.metrics.filterRejects >= 90000); assert(manager.metrics.aabbTests <= 10000);
    return { events: events.length, metrics: manager.metrics };
  });
  const ts = P.createTileset({ id: 'tiles', cellSize: { width: 1, height: 1 }, tiles: [{ id: 'tile', name: 'Solid', collision: { version: 1, mode: 'full-cell' } }] });
  const map = P.createTilemapRecord({ version: 6, id: 'map', tilesetRef: 'tiles', layers: ['world', 'ghost'].map((id, index) => ({ id, visible: false, locked: true, cells: Array.from({ length: 5000 }, (_, n) => ({ x: n % 100, y: Math.floor(n / 100) + index * 50, tileId: 'tile' })), ...filter(id, index ? [] : ['character']) })) });
  map.entity = { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
  measured('10,000 cells / two layers / 100 sparse queries', () => {
    const metrics = {}, mover = actor('mover', 0, 0, 'character', ['world']);
    for (let i = 0; i < 100; i++) Q.query([map], [ts], mover, { minX: i, minY: 0, maxX: i + 1, maxY: 1 }, metrics, layers);
    assert.strictEqual(metrics.filterRejectedLayers, 100); assert((metrics.candidateCells || 0) < 5000);
    return { cells: 10000, queries: 100, metrics };
  });
  measured('100 Characters against a 10,000-cell Tilemap', () => {
    const characters = Array.from({ length: 100 }, (_, i) => actor(`character-${i}`, i, 55, 'character', ['world'], { character: true, velocity: [.1, 0] }));
    const manager = B.createBody2DManager({ collisionLayers: layers, tileObstacles: (mover, bounds) => Q.query([map], [ts], mover, bounds, manager.metrics, layers) });
    manager.tick(characters, .1); assert(manager.metrics.filterRejectedLayers >= 100);
    return { characters: 100, cells: 10000, metrics: manager.metrics };
  });
  measured('100 Moving Platforms / 100 riders', () => {
    const platforms = Array.from({ length: 100 }, (_, i) => actor(`platform-${i}`, i * 10, 0, 'world', ['character'], { platform: true, size: [4, .5], velocity: [1, 0] }));
    const riders = Array.from({ length: 100 }, (_, i) => actor(`rider-${i}`, i * 10, .75, 'character', ['world'], { character: true }));
    const manager = B.createBody2DManager({ collisionLayers: layers }); manager.tick([...platforms, ...riders], .1);
    for (let i = 0; i < 100; i++) assert(Math.abs(riders[i].entity.position.x - (i * 10 + .1)) < 1e-6);
    return { platforms: 100, riders: 100, metrics: manager.metrics };
  });
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.error = error.stack; process.exitCode = 1; }
report.endedAtUtc = new Date().toISOString(); report.memory = process.memoryUsage();
fs.writeFileSync(path.resolve(__dirname, '../qualification/phase-049/phase-049-performance.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
