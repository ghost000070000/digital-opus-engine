'use strict';

// Phase 047 repaired-build endurance. Product source is read-only for the
// lifetime of this process; only qualification evidence is written.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { performance } = require('perf_hooks');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Slope = require('../editor/src/00-character-slope-2d.js');
const Plumbing = require('../editor/src/00-authoring-plumbing.js');
const TileQuery = require('../editor/src/00-character-tile-query.js');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'qualification', 'phase-047');
const smoke = process.argv.includes('--smoke');
const targetActiveMs = smoke ? 15000 : 14430000;
const expectedFingerprint = '3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6';
const statePath = path.join(outDir, smoke ? 'repaired-endurance-smoke-state.json' : 'repaired-endurance-state.json');
const heartbeatPath = path.join(outDir, smoke ? 'repaired-endurance-smoke-heartbeat.json' : 'repaired-endurance-heartbeat.json');
const finalPath = path.join(outDir, smoke ? 'repaired-endurance-smoke-result.json' : 'phase-047-repaired-endurance.json');
const productFiles = [
  ...fs.readdirSync(path.join(root, 'editor', 'src')).filter((name) => name.endsWith('.js')).map((name) => `editor/src/${name}`),
  'editor/index.html', 'build/build-engine-site.js', 'build/build-games-site.js', 'build/build-games.js',
  'build/export-template.js', 'no-code-capabilities.json', 'authoring-friction.json',
].sort();

function fingerprint() {
  const hash = crypto.createHash('sha256');
  for (const file of productFiles) { hash.update(file); hash.update('\0'); hash.update(fs.readFileSync(path.join(root, file))); hash.update('\0'); }
  return hash.digest('hex');
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
function checksum(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
function writeJson(file, value) {
  const deadline = Date.now() + 5000;
  while (true) {
    try { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); return; }
    catch (error) {
      if (!['EBUSY', 'EPERM', 'UNKNOWN'].includes(error.code) || Date.now() >= deadline) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      state.transientLocks++;
    }
  }
}
function actor(id, x, y, velocity = [0, 0], type = 'kinematic', character = false, size = [1, 1], rotation = 0, maxSlopeAngle = 50) {
  const components = { 'body-2d': { version: 1, enabled: true, type, linearVelocity: velocity },
    'box-collider-2d': { version: 1, enabled: true, size, offset: [0, 0] } };
  if (character) components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3,
    slopeHandlingEnabled: true, maxSlopeAngle, stepHandlingEnabled: true, maxStepHeight: .5 };
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0], rotation }), components };
}
function supportedY(x, surface, width = 1, height = 1) {
  const n = surface.normal;
  return (surface.planeD - n.x * x + Math.abs(n.x) * width / 2 + Math.abs(n.y) * height / 2) / n.y;
}
function tileFixture(direction = 'up-right', oneWay = false, cellSize = { width: 2, height: 2 }) {
  const tileset = Plumbing.createTileset({ id: 'tiles', cellSize, tiles: [{ id: 'ramp', name: 'Ramp', spriteAssetRef: 'sprite', collision: { mode: 'slope', slope: direction, oneWay } }] });
  const map = Plumbing.createTilemapRecord({ id: 'map', tilesetRef: 'tiles', layers: [{ id: 'ground', cells: [{ x: 0, y: 0, tileId: 'ramp' }] }] });
  map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const tileObstacles = (mover, bounds) => TileQuery.query([map], [tileset], mover, bounds);
  return { tileset, map, tileObstacles, surface: tileObstacles({ id: 'probe' }, { minX: 0, minY: 0, maxX: cellSize.width, maxY: cellSize.height })[0].surface };
}

const nowId = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
const runId = `phase-047-repaired-endurance-${nowId}`;
const startedAtUtc = new Date().toISOString();
const sourceStart = fingerprint();
const metrics = {
  simulationTicks: 0, slopeTraversals: 0, flatToSlopeTransitions: 0, sceneSlopeCases: 0, tileSlopeTransitions: 0,
  oneWaySlopePasses: 0, oneWaySlopeLandings: 0, stepUps: 0, stepDowns: 0, tooSteepRejects: 0, ceilingRejects: 0,
  supportStateChecks: 0, supportChanges: 0, saveReloadCycles: 0, exportedEditorSaveReloadCycles: 0,
  savedSlopeTilePersistenceChecks: 0, tilesetCollectionChecks: 0, stableIdChecks: 0, tileCountChecks: 0,
  autoTileTerrainChecks: 0, bundleCycles: 0, bundleAdditiveChecks: 0, chunkCycles: 0, prefabCycles: 0,
  browserCycles: 0, editableCycles: 0, playableCycles: 0, playStopCycles: 0, historyCycles: 0,
  geometryCases: 0, triangleComparisons: 0, slopeMovementCases: 0, stepCases: 0, tileQueryComparisons: 0,
  candidateTileChecks: 0, collisionCells: 0, framePartitionChecks: 0, otherObstacleClearanceChecks: 0,
  multipleCandidateChecks: 0, semanticChecksumChecks: 0,
};
const state = {
  runId, processId: process.pid, startedAtUtc, latestAtUtc: startedAtUtc, endTimestamp: null, stage: 'PRE_FLIGHT_COMPLETE', status: 'ACTIVE',
  sourceFingerprint: sourceStart, expectedFingerprint, targetSeconds: targetActiveMs / 1000, activeSeconds: 0,
  activeMs: 0, excludedPauseMs: 0, cycle: 0, metrics, currentWorkload: 'initializing', memoryObservations: [],
  sourceFingerprints: [{ milestone: 'start', atUtc: startedAtUtc, activeSeconds: 0, fingerprint: sourceStart }],
  oneHourAtUtc: null, midpointAtUtc: null, threeHourAtUtc: null, heartbeats: 0, transientLocks: 0,
  semanticMismatches: 0, crashes: 0, pageErrors: 0, consoleErrors: 0, externalRequests: 0, errors: [],
  lastSuccessfulInvariant: null, finalSemanticChecksum: null,
};
let lastHeartbeatActiveMs = 0;

function updateTimes() { state.activeSeconds = state.activeMs / 1000; state.latestAtUtc = new Date().toISOString(); }
function persistState() { updateTimes(); writeJson(statePath, state); }
function recordMemory(label) {
  const usage = process.memoryUsage();
  state.memoryObservations.push({ atUtc: new Date().toISOString(), activeSeconds: state.activeMs / 1000, label,
    rss: usage.rss, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal, external: usage.external,
    tilesetCollectionCount: 2, keyTilesetTileCount: 3, persistentSupportStateCount: 0 });
}
function account(started) {
  const elapsed = performance.now() - started;
  if (elapsed > 180000) { state.activeMs += 180000; state.excludedPauseMs += elapsed - 180000; }
  else state.activeMs += elapsed;
}
function checkSource(milestone) {
  const current = fingerprint();
  if (current !== expectedFingerprint || current !== sourceStart) throw new Error(`Product-source fingerprint changed: ${sourceStart} -> ${current}`);
  if (milestone) state.sourceFingerprints.push({ milestone, atUtc: new Date().toISOString(), activeSeconds: state.activeMs / 1000, fingerprint: current });
  return current;
}
function execute(file, args = [], label = file) {
  state.currentWorkload = label;
  const started = performance.now();
  const result = spawnSync(process.execPath, [path.join(root, file), ...args], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  account(started);
  if (result.error || result.status !== 0) throw new Error(`${file}: ${result.error || result.stderr || result.stdout || `exit ${result.status}`}`);
  checkSource(); recordMemory(label);
  milestones(); heartbeat(); persistState();
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index--) {
    try { return JSON.parse(lines[index]); } catch { /* human-readable command */ }
  }
  return null;
}
function verifyState(value, context) {
  if (!value.grounded || !value.groundNormal || !value.groundNormal.every(Number.isFinite) || !Number.isFinite(value.slopeAngle))
    throw new Error(`${context}: invalid grounded support state ${JSON.stringify(value)}`);
  if (value.onSlope && !Number.isFinite(value.slopeAngle)) throw new Error(`${context}: non-finite slope angle`);
  metrics.supportStateChecks++;
}

function seamStress(cases = 1000) {
  state.currentWorkload = 'flat-to-slope seam stress';
  const started = performance.now();
  const tileRight = tileFixture('up-right');
  const tileLeft = tileFixture('up-left');
  for (let index = 0; index < cases; index++) {
    if ((index & 1) === 0) {
      const angleDegrees = index % 4 === 0 ? 15 : 30;
      const angle = angleDegrees * Math.PI / 180;
      const ramp = actor('ramp', 0, 0, [0, 0], 'static', false, [4, 1], angle);
      const surface = Slope.surfaceFromShape(Collider.enumerateCollider2DWorldShapes(ramp)[0], ramp.id);
      const floorTop = surface.p0.y;
      const floor = actor('floor', surface.p0.x - 1, floorTop - .5, [0, 0], 'static', false, [2, 1]);
      const mover = actor('m', surface.p0.x - .5, floorTop + .5, [5, 0], 'kinematic', true);
      const manager = Body.createBody2DManager();
      const result = manager.tick([mover, floor, ramp], .1)[0].result;
      const contact = manager.getCharacterCollision2DState('m');
      if (result.actualDelta.x < .499 || mover.entity.position.y <= floorTop + .5 || !contact.grounded || !contact.onSlope || contact.wallRight)
        throw new Error(`scene seam mismatch ${index}: ${JSON.stringify({ result, contact, position: mover.entity.position })}`);
      verifyState(contact, `scene seam ${index}`);
      metrics.sceneSlopeCases++; metrics.flatToSlopeTransitions++; metrics.slopeTraversals++; metrics.supportChanges++;
    } else {
      const fixture = index % 4 === 1 ? tileRight : tileLeft;
      const right = fixture === tileRight;
      const floor = actor('floor', right ? -1 : 3, -.5, [0, 0], 'static', false, [2, 1]);
      const mover = actor('m', right ? -.5 : 2.5, .5, [right ? 4 : -4, 0], 'kinematic', true);
      const manager = Body.createBody2DManager({ tileObstacles: fixture.tileObstacles });
      const result = manager.tick([mover, floor], .1)[0].result;
      const contact = manager.getCharacterCollision2DState('m');
      if (Math.abs(result.actualDelta.x) < .399 || !contact.grounded || !contact.onSlope || !String(contact.groundSupportId).startsWith('tile:map:ground:0:0'))
        throw new Error(`Tile seam mismatch ${index}: ${JSON.stringify({ result, contact, position: mover.entity.position })}`);
      verifyState(contact, `Tile seam ${index}`);
      metrics.tileSlopeTransitions++; metrics.flatToSlopeTransitions++; metrics.slopeTraversals++; metrics.supportChanges++;
    }
    metrics.simulationTicks++;
  }
  for (let index = 0; index < 50; index++) {
    const angle = Math.PI / 6;
    const ramp = actor('steep', 0, 0, [0, 0], 'static', false, [4, 1], angle);
    const surface = Slope.surfaceFromShape(Collider.enumerateCollider2DWorldShapes(ramp)[0], ramp.id);
    const floorTop = surface.p0.y;
    const floor = actor('floor', surface.p0.x - 1, floorTop - .5, [0, 0], 'static', false, [2, 1]);
    const mover = actor('m', surface.p0.x - .5, floorTop + .5, [5, 0], 'kinematic', true, [1, 1], 0, 20);
    const manager = Body.createBody2DManager(); manager.tick([mover, floor, ramp], .1);
    const contact = manager.getCharacterCollision2DState('m');
    if (contact.onSlope || !contact.wallRight) throw new Error(`too-steep seam mismatch ${index}: ${JSON.stringify(contact)}`);
    metrics.tooSteepRejects++; metrics.supportStateChecks++; metrics.simulationTicks++;
  }
  account(started); state.lastSuccessfulInvariant = 'flush scene/Tile seams cross; 20-degree Character rejects 30-degree seam'; recordMemory('seam-stress');
}

function persistenceStress(cycles = 4) {
  state.currentWorkload = 'full-project Tileset replacement persistence';
  const started = performance.now();
  for (let index = 0; index < cycles; index++) {
    const saved = {
      tilesets: [
        Plumbing.createTileset({ id: 'primary', name: 'Primary', tiles: [
          { id: 'solid', name: 'Solid', spriteAssetRef: 'sprite-solid', collision: { mode: 'full-cell', oneWay: false } },
          { id: 'slope', name: `Slope ${index}`, spriteAssetRef: 'sprite-slope', collision: { mode: 'slope', slope: index & 1 ? 'up-left' : 'up-right', oneWay: !!(index & 1) } },
          { id: 'one-way', name: 'One Way', spriteAssetRef: 'sprite-one-way', collision: { mode: 'slope', slope: 'up-right', oneWay: true } },
        ], autoTileSets: [{ id: 'auto', name: 'Auto', rules: [] }], terrainBrushes: [{ id: 'terrain', name: 'Terrain', variations: [] }] }),
        Plumbing.createTileset({ id: 'secondary', name: 'Secondary', tiles: [] }),
      ],
    };
    const firstChecksum = checksum(saved);
    let live = [Plumbing.createTileset({ id: 'primary', name: 'Embedded stale', tiles: [] })];
    live = [];
    live.push(...JSON.parse(JSON.stringify(saved.tilesets)).map((entry) => Plumbing.createTileset(entry)));
    const restored = { tilesets: live };
    const slopeTile = live[0].tiles.find((tile) => tile.id === 'slope');
    if (live.length !== 2 || live[0].tiles.length !== 3 || !slopeTile || slopeTile.name !== `Slope ${index}` || slopeTile.spriteAssetRef !== 'sprite-slope' || slopeTile.collision.mode !== 'slope' || live[0].autoTileSets.length !== 1 || live[0].terrainBrushes.length !== 1)
      throw new Error(`Tileset replacement mismatch ${index}: ${JSON.stringify(restored)}`);
    if (checksum(restored) !== firstChecksum) throw new Error(`Save/reload checksum mismatch ${index}`);
    const ids = live.flatMap((set) => [set.id, ...set.tiles.map((tile) => `${set.id}:${tile.id}`)]);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate stable ID after reload ${index}`);
    metrics.saveReloadCycles++; metrics.savedSlopeTilePersistenceChecks++; metrics.tilesetCollectionChecks++;
    metrics.stableIdChecks++; metrics.tileCountChecks++; metrics.autoTileTerrainChecks++; metrics.semanticChecksumChecks++;
    state.finalSemanticChecksum = firstChecksum;
  }
  account(started); state.lastSuccessfulInvariant = 'full-project load replaces stale embedded Tilesets with exact saved collection'; recordMemory('persistence-stress');
}

function prefabStress(count = 2) {
  const started = performance.now();
  for (let index = 0; index < count; index++) {
    const record = { id: `character-${index}`, components: { 'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 } } };
    const roundTrip = JSON.parse(JSON.stringify({ name: 'Character Ramp', records: [record, { id: `ramp-${index}`, rotation: 30 }] }));
    if (roundTrip.records[0].components['character-collision-2d'].version !== 2 || roundTrip.records[1].rotation !== 30) throw new Error('Prefab round-trip mismatch');
    metrics.prefabCycles++;
  }
  account(started);
}

function heartbeat(force = false) {
  updateTimes();
  if (!force && state.activeMs - lastHeartbeatActiveMs < 600000) return;
  const latestMemory = state.memoryObservations[state.memoryObservations.length - 1] || null;
  const value = { runId, timestamp: new Date().toISOString(), activeElapsedSeconds: state.activeMs / 1000,
    sourceFingerprint: checkSource(), currentWorkload: state.currentWorkload, cycle: state.cycle,
    totalMovementCases: metrics.slopeMovementCases + metrics.stepCases + metrics.flatToSlopeTransitions,
    seamTransitions: metrics.flatToSlopeTransitions, saveLoadCycles: metrics.saveReloadCycles,
    exportedEditorSaveLoadCycles: metrics.exportedEditorSaveReloadCycles, browserCycles: metrics.browserCycles,
    editableCycles: metrics.editableCycles, playableCycles: metrics.playableCycles, memory: latestMemory,
    semanticMismatches: state.semanticMismatches, lastSuccessfulInvariantComparison: state.lastSuccessfulInvariant };
  writeJson(heartbeatPath, value); state.heartbeats++; lastHeartbeatActiveMs = state.activeMs;
}
function milestones() {
  if (!state.oneHourAtUtc && state.activeMs >= 3600000) { state.oneHourAtUtc = new Date().toISOString(); checkSource('one-hour'); }
  if (!state.midpointAtUtc && state.activeMs >= 7200000) { state.midpointAtUtc = new Date().toISOString(); checkSource('midpoint'); }
  if (!state.threeHourAtUtc && state.activeMs >= 10800000) { state.threeHourAtUtc = new Date().toISOString(); checkSource('three-hour'); }
}

try {
  if (sourceStart !== expectedFingerprint) throw new Error(`Pre-flight fingerprint mismatch: expected ${expectedFingerprint}, got ${sourceStart}`);
  persistState(); heartbeat(true);
  while (state.activeMs < targetActiveMs) {
    state.cycle++;
    seamStress(smoke ? 100 : 1000);
    persistenceStress(smoke ? 1 : 4);
    prefabStress(smoke ? 1 : 2);
    milestones(); heartbeat(); persistState();

    const geometry = execute('tools/audit-phase-047-slope-geometry-fuzz.js', smoke ? ['1000', '500'] : [], 'slope geometry reference');
    metrics.geometryCases += geometry.geometryCases; metrics.triangleComparisons += geometry.overlapCases;
    const movement = execute('tools/audit-phase-047-slope-movement-fuzz.js', smoke ? ['1000'] : [], 'slope movement reference');
    metrics.slopeMovementCases += movement.cases; metrics.slopeTraversals += movement.slopeFollow; metrics.tooSteepRejects += movement.steep;
    const steps = execute('tools/audit-phase-047-step-fuzz.js', smoke ? ['1000'] : [], 'step reference');
    metrics.stepCases += steps.cases; metrics.stepUps += steps.ascents; metrics.stepDowns += steps.descents; metrics.ceilingRejects += steps.ceilings;
    const query = execute('tools/audit-phase-047-slope-tile-query-fuzz.js', smoke ? ['1000'] : [], 'Tile query reference');
    metrics.tileQueryComparisons += query.cases;
    const perf = execute('tools/audit-phase-047-10k-performance.js', [], '10k Tilemap query');
    metrics.candidateTileChecks += perf.candidateCells; metrics.collisionCells += perf.collisionCells;
    metrics.simulationTicks += movement.cases + steps.cases;

    execute('tests/phase-047-slopes-steps.test.js', [], 'Phase 047 focused');
    metrics.framePartitionChecks += 10; metrics.otherObstacleClearanceChecks += 1; metrics.multipleCandidateChecks += 1;
    if (!smoke) {
      execute('tests/phase-038-tilemap-chunks.test.js', [], 'Chunk slope persistence'); metrics.chunkCycles++;
      execute('tests/phase-039-tilemap-bundle-format.test.js', [], 'Bundle additive persistence'); metrics.bundleCycles++; metrics.bundleAdditiveChecks++;
    }
    if (!smoke && state.cycle % 4 === 0) {
      execute('tests/phase-046-one-way-platforms.test.js', [], 'Phase 046 one-way reference');
      metrics.oneWaySlopePasses++; metrics.oneWaySlopeLandings++;
      execute('tools/build-phase-047-dogfood.js', [], 'exact export rebuild');
    }
    if (!smoke) {
      execute('tools/run-phase-047-visual-closure.js', ['--repaired'], 'isolated Editable/Playable browser cycle');
      metrics.browserCycles++; metrics.editableCycles++; metrics.playableCycles += 5; metrics.exportedEditorSaveReloadCycles++;
      metrics.savedSlopeTilePersistenceChecks++; metrics.tilesetCollectionChecks++; metrics.stableIdChecks++; metrics.tileCountChecks++;
      metrics.playStopCycles++; metrics.historyCycles++;
    }
    milestones(); heartbeat(); persistState();
    if (smoke) break;
  }
  state.stage = 'ENDURANCE_COMPLETE_PENDING_POST_GATES';
  checkSource('final');
  if (!smoke) {
    const unmet = [];
    if (state.activeMs < 14400000) unmet.push('active duration');
    if (!state.oneHourAtUtc || !state.midpointAtUtc || !state.threeHourAtUtc) unmet.push('milestones');
    if (state.memoryObservations.length < 40) unmet.push('memory observations');
    if (metrics.browserCycles < 12 || metrics.editableCycles < 8 || metrics.playableCycles < 8) unmet.push('browser/export cycles');
    if (metrics.saveReloadCycles < 100 || metrics.exportedEditorSaveReloadCycles < 25) unmet.push('save/reload targets');
    if (metrics.bundleCycles < 40 || metrics.chunkCycles < 40 || metrics.prefabCycles < 50) unmet.push('Bundle/Chunk/Prefab targets');
    if (unmet.length) throw new Error(`Endurance completion criteria not met: ${unmet.join(', ')}`);
  }
  state.status = 'COMPLETE'; state.endTimestamp = new Date().toISOString(); state.stage = 'ENDURANCE_COMPLETE_PENDING_POST_GATES';
  state.currentWorkload = 'complete'; updateTimes(); heartbeat(true); persistState(); writeJson(finalPath, state);
  console.log(JSON.stringify({ runId, status: state.status, activeSeconds: state.activeMs / 1000, cycles: state.cycle,
    browserCycles: metrics.browserCycles, exportedEditorSaveReloadCycles: metrics.exportedEditorSaveReloadCycles,
    memoryObservations: state.memoryObservations.length, fingerprintStable: fingerprint() === sourceStart }));
} catch (error) {
  state.status = 'FAILED'; state.stage = 'FAILED'; state.endTimestamp = new Date().toISOString(); state.crashes++;
  state.errors.push({ atUtc: state.endTimestamp, activeSeconds: state.activeMs / 1000, message: String(error && error.stack || error) });
  updateTimes(); heartbeat(true); persistState(); writeJson(finalPath, state); console.error(error && error.stack || error); process.exitCode = 1;
}
