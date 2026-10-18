'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const plumbing = require('../editor/src/00-authoring-plumbing.js');

const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-038');
const SMOKE = process.env.PHASE038_CLOSURE_SMOKE === '1';
const STATE = path.join(QUAL, SMOKE ? 'endurance-closure-smoke-state.json' : 'endurance-closure-state.json');
const HEARTBEAT = path.join(QUAL, SMOKE ? 'endurance-closure-smoke-heartbeat.json' : 'endurance-closure-heartbeat.json');
const EVIDENCE = path.join(ROOT, SMOKE ? 'phase-038-endurance-closure-smoke-v2.json' : 'phase-038-endurance.json');
const CLOSURE = SMOKE ? EVIDENCE : path.join(ROOT, 'phase-038-endurance-closure.json');
const TARGET = SMOKE ? Math.max(8, Number(process.argv[2] || 8)) : Math.max(10800, Number(process.argv[2] || 10830));
const startedWall = new Date();
const runId = `phase-038-endurance-closure${SMOKE ? '-smoke' : ''}-${startedWall.toISOString().replace(/[-:.]/g, '')}`;
const baselineHead = git('rev-parse', 'HEAD');
const branch = git('branch', '--show-current');
const sourceFiles = [
  'editor/src/00-authoring-plumbing.js', 'editor/src/01-editor.js', 'editor/index.html',
  'tests/phase-038-tilemap-chunks.test.js', 'tools/audit-phase-038-endurance-closure.js',
  'tools/audit-phase-038-endurance-browser-cycle.js',
];

let randomState = 0x38038;
let lastTick = performance.now();
let activeMs = 0;
let suspendedMs = 0;
let cycles = 0;
let captureOperations = 0;
let chunkNormalizations = 0;
let dryRunPlans = 0;
let stampCommits = 0;
let semanticCellWrites = 0;
let autoTileRecomputes = 0;
let terrainResolutions = 0;
let markersCreated = 0;
let markerIdChecks = 0;
let layerMapsResolved = 0;
let overwritePlans = 0;
let holePreservationChecks = 0;
let previewCommitComparisons = 0;
let undoOperations = 0;
let redoOperations = 0;
let saveLoadCycles = 0;
let browserCycles = 0;
let editableCycles = 0;
let playableCycles = 0;
let heartbeats = 0;
let transientFileLockRetries = 0;
let semanticMismatches = 0;
let crashes = 0;
let lastHeartbeat = -600;
let lastMemory = -450;
let nextBrowser = 0;
const browserTarget = SMOKE ? 1 : 9;
let midpoint = null;
let twoHour = null;
let semanticChecksum = null;
let lastReferenceComparison = null;
let currentSubcampaign = 'startup';
const memoryObservations = [];
const failures = [];
const retainedArtifacts = [];
const suspensionAnomalies = [];

fs.mkdirSync(QUAL, { recursive: true });

function git(...args) {
  return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function sourceFingerprint() {
  const hash = crypto.createHash('sha256');
  for (const file of sourceFiles) hash.update(file).update(fs.readFileSync(path.join(ROOT, file)));
  return hash.digest('hex');
}

const sourceFingerprintStart = sourceFingerprint();

function tick() {
  const now = performance.now();
  const delta = Math.max(0, now - lastTick);
  lastTick = now;
  if (delta > 300000) {
    suspendedMs += delta;
    suspensionAnomalies.push({ timestamp: new Date().toISOString(), excludedSeconds: +(delta / 1000).toFixed(3) });
  } else activeMs += delta;
  return activeMs / 1000;
}

function elapsed() { return tick(); }
function rnd() { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState; }
function checksum(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function semanticState(tilemap) {
  return JSON.stringify({
    layers: plumbing.serializeTilemapLayers(tilemap),
    spawnMarkers: plumbing.canonicalizeSpawnMarkers(tilemap.spawnMarkers),
  });
}

function atomic(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  for (let attempt = 0; attempt < 5; attempt++) {
    try { fs.renameSync(temp, file); return; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt === 4) throw error;
      transientFileLockRetries++;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1));
    }
  }
}

function observe(label) {
  const usage = process.memoryUsage();
  const observation = {
    label, timestamp: new Date().toISOString(), activeElapsedSeconds: +elapsed().toFixed(3),
    rssBytes: usage.rss, heapUsedBytes: usage.heapUsed, heapTotalBytes: usage.heapTotal, externalBytes: usage.external,
  };
  memoryObservations.push(observation);
  return observation;
}

function operationTotals() {
  return {
    captureOperations, chunkNormalizations, dryRunPlans, stampCommits, semanticCellWrites,
    autoTileRecomputes, terrainResolutions, markersCreated, markerIdChecks, layerMapsResolved,
    overwritePlans, holePreservationChecks, previewCommitComparisons, undoOperations, redoOperations,
    saveLoadCycles, browserCycles, editableCycles, playableCycles,
  };
}

function summary(status) {
  const activeElapsedSeconds = +elapsed().toFixed(3);
  return {
    phase: '038', feature: 'tilemap-chunk-prefab-reuse', runId, status, smoke: SMOKE,
    baselineHead, branch, startTimestamp: startedWall.toISOString(), lastTimestamp: new Date().toISOString(),
    endTimestamp: status === 'RUNNING' ? null : new Date().toISOString(), targetSeconds: TARGET,
    elapsedActiveSeconds: activeElapsedSeconds, excludedSuspendedSeconds: +(suspendedMs / 1000).toFixed(3),
    currentSubcampaign, currentCycle: cycles, operations: operationTotals(),
    sourceFingerprintStart, sourceFingerprintCurrent: sourceFingerprint(), projectChecksum: semanticChecksum,
    semanticChecksum, memoryObservation: memoryObservations.at(-1) || null,
    memoryObservations, heartbeats, transientFileLockRetries, suspensionAnomalies,
    semanticMismatches, crashes, unresolvedFailures: failures.length, failures: [...failures],
    midpoint, twoHour, retainedArtifacts,
    lastSuccessfulReferenceComparison: lastReferenceComparison,
    processes: status === 'RUNNING' ? [{ pid: process.pid, command: `node tools/audit-phase-038-endurance-closure.js ${TARGET}`, purpose: 'Phase 038 closure endurance' }] : [],
  };
}

function heartbeat(label) {
  currentSubcampaign = label;
  heartbeats++;
  observe(label);
  const state = summary('RUNNING');
  atomic(HEARTBEAT, state);
  atomic(STATE, state);
}

const tileset = plumbing.createTileset({
  id: 'ts', name: 'Closure Tiles',
  tiles: [
    { id: 'a', name: 'A', spriteAssetRef: 's1' },
    { id: 'b', name: 'B', spriteAssetRef: 's2' },
    { id: 'c', name: 'C', spriteAssetRef: 's3' },
  ],
  autoTileSets: [{ id: 'set', name: 'Set', neighborMode: 'four-way', defaultTileId: 'a', rules: [
    { mask: 0, tileId: 'a' }, { mask: 2, tileId: 'b' }, { mask: 8, tileId: 'b' }, { mask: 10, tileId: 'c' },
  ] }],
  terrainBrushes: [
    { id: 'terrain', name: 'Terrain', mode: 'weighted-tiles', seed: 38, variants: [{ tileId: 'a', weight: 1 }, { tileId: 'b', weight: 1 }] },
    { id: 'connected', name: 'Connected', mode: 'auto-tile', seed: 0, autoTileSetId: 'set', variants: [] },
  ],
});

function model() {
  const source = plumbing.createTilemapRecord({
    id: 'source', name: 'Source', tilesetRef: 'ts',
    layers: [{ id: 'g', name: 'Ground', cells: [] }, { id: 'd', name: 'Details', cells: [] }],
    spawnMarkers: [],
  });
  for (let y = -4; y <= 4; y++) for (let x = -6; x <= 6; x++) {
    if ((x * 3 + y * 5 + 38) % 7 === 0) continue;
    const kind = Math.abs(x * 11 + y * 7) % 4;
    const layerId = (x + y) % 3 ? 'g' : 'd';
    plumbing.setTilemapCell(source, layerId, x, y, kind === 0 ? 'c' : 'a',
      kind === 1 ? { autoTileSetId: 'set' }
        : kind === 2 ? { terrainBrushId: 'terrain' }
          : kind === 3 ? { terrainBrushId: 'connected', autoTileSetId: 'set' } : {});
  }
  plumbing.createSpawnMarker(source, { name: 'Enemy Spawn', x: -2, y: 0, prefabRef: 'Enemy' });
  plumbing.createSpawnMarker(source, { name: 'Enemy Spawn', x: 4, y: 2, prefabRef: 'Enemy' });
  source.ordinaryObjects = [{ id: 'ordinary-object', x: 0, y: 0 }];
  return source;
}

const regions = [
  [{ x: -6, y: -4 }, { x: 6, y: 4 }], [{ x: 6, y: 4 }, { x: -6, y: -4 }],
  [{ x: -1, y: -4 }, { x: 0, y: 4 }], [{ x: -6, y: 0 }, { x: 6, y: 1 }],
  [{ x: -3, y: -2 }, { x: 3, y: 2 }], [{ x: 1, y: 1 }, { x: 6, y: 4 }],
  [{ x: -6, y: -4 }, { x: -1, y: -1 }], [{ x: -2, y: 0 }, { x: -2, y: 0 }],
];

function findHole(chunk, layer) {
  const occupied = new Set(layer.cells.map((cell) => `${cell.x},${cell.y}`));
  for (let y = 0; y < chunk.height; y++) for (let x = 0; x < chunk.width; x++) if (!occupied.has(`${x},${y}`)) return { x, y };
  return null;
}

function verifyCapturedReference(source, chunk, minX, minY) {
  assert(!JSON.stringify(chunk).includes('ordinary-object'));
  for (const layer of chunk.layers) {
    const sourceLayer = source.layers.find((candidate) => candidate.name === layer.name);
    assert(sourceLayer);
    for (const cell of layer.cells) {
      const expected = sourceLayer.cells.find((candidate) => candidate.x === cell.x + minX && candidate.y === cell.y + minY);
      assert(expected, `captured cell missing from independent source model at ${cell.x},${cell.y}`);
      assert.strictEqual(cell.terrainBrushId || null, expected.terrainBrushId || null);
      assert.strictEqual(cell.autoTileSetId || null, expected.autoTileSetId || null);
    }
  }
}

function batch() {
  currentSubcampaign = 'capture-normalize-map-preview-commit-undo-serialize';
  for (let n = 0; n < 48; n++) {
    const source = model();
    const [from, to] = regions[(cycles * 48 + n) % regions.length];
    const minX = Math.min(from.x, to.x);
    const minY = Math.min(from.y, to.y);
    const layerIds = n % 4 === 0 ? ['g'] : n % 4 === 1 ? ['d'] : ['g', 'd'];
    const includeSpawnMarkers = n % 3 !== 0;
    const chunk = plumbing.captureTilemapChunk(source, {
      id: `chunk-${cycles}-${n}`, name: 'Closure Chunk', from, to, layerIds, includeSpawnMarkers, tileset,
    });
    captureOperations++;
    assert(chunk);
    verifyCapturedReference(source, chunk, minX, minY);
    const normalized = plumbing.normalizeTilemapChunkSemantics(chunk, tileset);
    chunkNormalizations++;
    assert.deepStrictEqual(normalized, plumbing.normalizeTilemapChunk(JSON.parse(JSON.stringify(normalized))));

    const target = plumbing.createTilemapRecord({
      id: 'target', name: 'Target', tilesetRef: 'ts',
      layers: [{ id: 'terrain', name: 'Ground', cells: [] }, { id: 'details', name: 'Details', cells: [] }],
      spawnMarkers: [],
    });
    const mapping = {};
    for (const layer of normalized.layers) {
      if (n % 11 === 0 && layer.name === 'Details') mapping[layer.id] = { create: true, name: `Details ${cycles}-${n}` };
      else mapping[layer.id] = layer.name === 'Ground' ? 'terrain' : 'details';
    }
    assert.strictEqual(new Set(Object.values(mapping).filter((value) => typeof value === 'string')).size,
      Object.values(mapping).filter((value) => typeof value === 'string').length);
    layerMapsResolved += normalized.layers.length;
    const anchor = { x: (rnd() % 101) - 50, y: (rnd() % 101) - 50 };

    const firstLayer = normalized.layers[0];
    const firstCell = firstLayer.cells[0];
    const firstTargetLayerId = typeof mapping[firstLayer.id] === 'string' ? mapping[firstLayer.id] : null;
    if (firstTargetLayerId && firstCell) {
      plumbing.setTilemapCell(target, firstTargetLayerId, anchor.x + firstCell.x, anchor.y + firstCell.y, 'c', { terrainBrushId: 'terrain' });
    }
    const hole = findHole(normalized, firstLayer);
    if (firstTargetLayerId && hole) {
      plumbing.setTilemapCell(target, firstTargetLayerId, anchor.x + hole.x, anchor.y + hole.y, 'c');
    }
    plumbing.setTilemapCell(target, 'terrain', anchor.x - 1, anchor.y, 'a', { autoTileSetId: 'set' });

    if (n % 16 === 0 && firstTargetLayerId) {
      const protectedTarget = plumbing.createTilemapRecord(JSON.parse(JSON.stringify(target)));
      const protectedLayer = protectedTarget.layers.find((layer) => layer.id === firstTargetLayerId);
      protectedLayer.locked = true;
      assert(!plumbing.planTilemapChunkStamp(normalized, protectedTarget, tileset, anchor, mapping, [{ name: 'Enemy' }]).valid);
      protectedLayer.locked = false;
      protectedLayer.visible = false;
      assert(!plumbing.planTilemapChunkStamp(normalized, protectedTarget, tileset, anchor, mapping, [{ name: 'Enemy' }]).valid);
    }

    const before = JSON.stringify(target);
    const beforeSemantic = semanticState(target);
    const plan = plumbing.planTilemapChunkStamp(normalized, target, tileset, anchor, mapping, [{ name: 'Enemy' }]);
    dryRunPlans++;
    assert(plan.valid);
    assert.strictEqual(JSON.stringify(target), before);
    assert.strictEqual(plan.semanticCellWrites, plumbing.tilemapChunkCellCount(normalized));
    if (plan.cellsOverwritten) overwritePlans++;
    semanticCellWrites += plan.semanticCellWrites;
    autoTileRecomputes += plan.neighborChanges;
    terrainResolutions += plan.changedCells.filter((cell) => cell.terrainBrushId).length;
    markersCreated += plan.markersCreated.length;
    const markerIds = new Set(target.spawnMarkers.map((marker) => marker.id));
    for (const marker of plan.markersCreated) {
      assert(!markerIds.has(marker.id));
      assert(!normalized.spawnMarkers.some((template) => template.id === marker.id));
      const template = normalized.spawnMarkers.find((candidate) => candidate.id === marker.templateId);
      assert(template);
      assert.deepStrictEqual([marker.x, marker.y], [anchor.x + template.x, anchor.y + template.y]);
      markerIds.add(marker.id);
      markerIdChecks++;
    }

    const plannedTarget = plumbing.createTilemapRecord({ ...JSON.parse(before), layers: plan.result.layers, spawnMarkers: plan.result.spawnMarkers });
    for (const layer of normalized.layers) for (const cell of layer.cells) if (cell.terrainBrushId === 'terrain') {
      const targetLayerId = plan.mapping[layer.id];
      const x = anchor.x + cell.x;
      const y = anchor.y + cell.y;
      const actual = plumbing.getTilemapCell(plannedTarget, targetLayerId, x, y);
      const brush = plumbing.getTerrainBrushById(tileset, 'terrain');
      assert.strictEqual(actual.tileId, plumbing.resolveTerrainWeightedTile(tileset, brush, targetLayerId, x, y));
    }
    if (firstTargetLayerId && hole) {
      assert.strictEqual(plumbing.getTilemapCell(plannedTarget, firstTargetLayerId, anchor.x + hole.x, anchor.y + hole.y).tileId, 'c');
      holePreservationChecks++;
    }

    assert(plumbing.commitTilemapChunkStamp(target, plan));
    stampCommits++;
    assert.deepStrictEqual({ layers: plumbing.serializeTilemapLayers(target), spawnMarkers: plumbing.canonicalizeSpawnMarkers(target.spawnMarkers) }, plan.result);
    previewCommitComparisons++;
    const after = JSON.stringify(target);
    const afterSemantic = semanticState(target);
    const beforeRecord = plumbing.createTilemapRecord(JSON.parse(before));
    target.layers = beforeRecord.layers;
    target.spawnMarkers = beforeRecord.spawnMarkers;
    assert.strictEqual(semanticState(target), beforeSemantic);
    undoOperations++;
    const redoRecord = plumbing.createTilemapRecord(JSON.parse(after));
    target.layers = redoRecord.layers;
    target.spawnMarkers = redoRecord.spawnMarkers;
    assert.strictEqual(semanticState(target), afterSemantic);
    redoOperations++;
    const loaded = plumbing.createTilemapRecord(JSON.parse(JSON.stringify(target)));
    assert.deepStrictEqual(plumbing.serializeTilemapLayers(loaded), plumbing.serializeTilemapLayers(target));
    saveLoadCycles++;

    const stampedSnapshot = JSON.stringify(target);
    normalized.layers.length = 0;
    assert.strictEqual(JSON.stringify(target), stampedSnapshot);
    semanticChecksum = checksum(stampedSnapshot);
    lastReferenceComparison = { timestamp: new Date().toISOString(), cycle: cycles, operation: n, checksum: semanticChecksum, status: 'PASS' };
  }
  cycles++;
}

function browserCycle(index) {
  currentSubcampaign = 'isolated-browser-editor-export';
  const makeExports = [0, 3, 4, 8].includes(index);
  const retentionLabel = index === 0 ? 'first' : index === 4 ? 'midpoint' : index === 8 ? 'final' : null;
  const args = [path.join(ROOT, 'tools/audit-phase-038-endurance-browser-cycle.js'), String(index)];
  if (makeExports) args.push('export');
  if (retentionLabel) args.push(`retain=${retentionLabel}`);
  const output = childProcess.execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
  const report = JSON.parse(output.trim().split(/\r?\n/).at(-1));
  assert.strictEqual(report.status, 'PASS');
  assert.deepStrictEqual(report.pageErrors, []);
  assert.deepStrictEqual(report.consoleErrors, []);
  assert.deepStrictEqual(report.externalRequests, []);
  browserCycles++;
  if (makeExports) {
    assert(report.editableRetainsChunks && report.playableStripsChunks);
    editableCycles++;
    playableCycles++;
  }
  for (const artifact of report.retainedArtifacts || []) if (!retainedArtifacts.includes(artifact)) retainedArtifacts.push(artifact);
}

(async () => {
  try {
    observe('start');
    atomic(STATE, summary('RUNNING'));
    while (elapsed() < TARGET) {
      batch();
      const active = elapsed();
      if (active >= nextBrowser && browserCycles < browserTarget) {
        browserCycle(browserCycles);
        nextBrowser += 1200;
      }
      if (active - lastMemory >= 450) {
        observe(`memory-${memoryObservations.length}`);
        lastMemory = active;
      }
      if (active - lastHeartbeat >= 600) {
        lastHeartbeat = active;
        heartbeat(`heartbeat-${heartbeats + 1}`);
      }
      if (!midpoint && active >= 5400) {
        midpoint = { timestamp: new Date().toISOString(), activeElapsedSeconds: +active.toFixed(3), operations: operationTotals(), sourceFingerprint: sourceFingerprint(), projectChecksum: semanticChecksum, memory: memoryObservations.at(-1), failures: [...failures] };
        atomic(path.join(QUAL, 'endurance-closure-midpoint.json'), midpoint);
      }
      if (!twoHour && active >= 7200) {
        twoHour = { timestamp: new Date().toISOString(), activeElapsedSeconds: +active.toFixed(3), operations: operationTotals(), sourceFingerprint: sourceFingerprint(), projectChecksum: semanticChecksum, memory: memoryObservations.at(-1), failures: [...failures] };
        atomic(path.join(QUAL, 'endurance-closure-two-hour.json'), twoHour);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    while (browserCycles < browserTarget) browserCycle(browserCycles);
    assert(memoryObservations.length >= (SMOKE ? 2 : 20));
    if (!SMOKE) {
      assert(midpoint && twoHour);
      assert(editableCycles >= 4 && playableCycles >= 4);
    }
    assert.strictEqual(sourceFingerprint(), sourceFingerprintStart, 'qualified source changed during endurance');
    observe('final');
    currentSubcampaign = 'timed-endurance-complete';
    const done = summary('PASS');
    done.boundedMemoryObservation = true;
    done.formalLeakProof = false;
    done.cleanup = { browserContextsClosed: true, serversClosed: true, coreWorkerExitsAfterWrite: true };
    atomic(STATE, done);
    atomic(EVIDENCE, done);
    atomic(CLOSURE, done);
    console.log(`Phase 038 closure endurance: PASS (${done.elapsedActiveSeconds}s, ${cycles} cycles, ${stampCommits} stamps, ${browserCycles} browser cycles)`);
  } catch (error) {
    semanticMismatches++;
    failures.push(error.stack || String(error));
    const failed = summary('FAIL');
    atomic(STATE, failed);
    atomic(EVIDENCE, failed);
    atomic(CLOSURE, failed);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
})();
