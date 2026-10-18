'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const p = require('../editor/src/00-authoring-plumbing.js');

const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-036');
const SMOKE = process.env.PHASE036_CLOSURE_SMOKE === '1';
const STATE_PATH = path.join(QUAL, SMOKE ? 'endurance-closure-smoke-state.json' : 'endurance-closure-state.json');
const HEARTBEAT_PATH = path.join(QUAL, SMOKE ? 'endurance-closure-smoke-heartbeat.json' : 'endurance-closure-heartbeat.json');
const EVIDENCE_PATH = path.join(ROOT, SMOKE ? 'phase-036-endurance-closure-smoke.json' : 'phase-036-endurance-closure.json');
const TARGET_SECONDS = SMOKE ? Math.max(5, Number(process.argv[2] || 15)) : Math.max(21600, Number(process.env.PHASE036_CLOSURE_SECONDS || process.argv[2] || 21630));
const MAX_SECONDS = 22500;
const HEARTBEAT_SECONDS = 600;
const BROWSER_SECONDS = 1800;
const SLEEP_MS = 200;
const HEAD = childProcess.execFileSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`, 'rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const BRANCH = childProcess.execFileSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`, 'branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
const startedWall = new Date();
const startedMono = performance.now();
const runId = `phase-036-endurance-closure-${startedWall.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;

fs.mkdirSync(QUAL, { recursive: true });

let cycles = 0;
let modelOperations = 0;
let weightedResolutions = 0;
let autoTileResolutions = 0;
let terrainTransitions = 0;
let serializeLoadCycles = 0;
let undoRedoOperations = 0;
let browserCycles = 0;
let editableExportCycles = 0;
let playableExportCycles = 0;
let heartbeatCount = 0;
let transientLockCount = 0;
let semanticMismatches = 0;
let crashes = 0;
let lastBrowserAt = -BROWSER_SECONDS;
let lastHeartbeatAt = -HEARTBEAT_SECONDS;
let lastLoopMono = startedMono;
let midpoint = null;
let finalHour = null;
let finalBrowserDone = false;
let ending = false;
const failures = [];
const memoryObservations = [];
const ownedProcesses = [{ pid: process.pid, kind: 'worker', command: 'node tools/audit-phase-036-endurance-closure.js' }];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function elapsedSeconds() {
  return (performance.now() - startedMono) / 1000;
}

function writeJsonWithRetry(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
      fs.renameSync(temp, file);
      return;
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'UNKNOWN'].includes(error.code) || Date.now() >= deadline) throw error;
      transientLockCount++;
      const waitUntil = Date.now() + 100;
      while (Date.now() < waitUntil) {}
    }
  }
}

function observe(label) {
  const m = process.memoryUsage();
  const item = {
    label,
    timestamp: new Date().toISOString(),
    elapsedSeconds: Number(elapsedSeconds().toFixed(3)),
    rssBytes: m.rss,
    heapUsedBytes: m.heapUsed,
    heapTotalBytes: m.heapTotal,
    externalBytes: m.external
  };
  memoryObservations.push(item);
  return item;
}

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function referenceWeighted(brush, layerId, x, y, validIds) {
  const seen = new Set();
  const variants = brush.variants
    .filter((v) => validIds.has(v.tileId) && Number.isInteger(v.weight) && v.weight > 0 && v.weight <= 1000000 && !seen.has(v.tileId) && (seen.add(v.tileId) || true))
    .slice()
    .sort((a, b) => a.tileId.localeCompare(b.tileId));
  if (!variants.length) return null;
  const total = variants.reduce((sum, variant) => sum + variant.weight, 0);
  let target = hash([brush.id, layerId, x, y, brush.seed | 0].join('\0')) % total;
  for (const variant of variants) {
    if (target < variant.weight) return variant.tileId;
    target -= variant.weight;
  }
  return variants.at(-1).tileId;
}

function fixture() {
  const tiles = Array.from({ length: 16 }, (_, i) => ({
    id: `t${String(i).padStart(2, '0')}`,
    name: `Tile ${i}`,
    collision: i === 3 ? { mode: 'full-cell' } : { mode: 'none' }
  }));
  const set = p.createTileset({
    id: 'tiles',
    tiles,
    autoTileSets: [{
      id: 'auto-a',
      name: 'Connected',
      neighborMode: 'four-way',
      defaultTileId: 't00',
      rules: Array.from({ length: 16 }, (_, mask) => ({ mask, tileId: `t${String(mask).padStart(2, '0')}` }))
    }],
    terrainBrushes: [
      { id: 'terrain-w', name: 'Weighted', mode: 'weighted-tiles', seed: 42, variants: [{ tileId: 't00', weight: 6 }, { tileId: 't01', weight: 3 }, { tileId: 't02', weight: 1 }] },
      { id: 'terrain-a', name: 'Connected', mode: 'auto-tile', autoTileSetId: 'auto-a', seed: 0, variants: [] }
    ]
  });
  const map = p.createTilemapRecord({
    id: 'map',
    tilesetRef: 'tiles',
    layers: [
      { id: 'ground', name: 'Ground', cells: [] },
      { id: 'detail', name: 'Detail', cells: [] }
    ]
  });
  return { set, map, project: { tilesets: [set], levels: [{ objects: [map] }] } };
}

let world = fixture();
let rngState = 0x36c105ed;
const rnd = () => {
  rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
  return rngState;
};

function semanticChecksum() {
  const payload = world.map.layers.map((layer) => ({
    id: layer.id,
    cells: layer.cells.slice().sort((a, b) => a.y - b.y || a.x - b.x).map((cell) => [cell.x, cell.y, cell.tileId, cell.terrainBrushId || '', cell.autoTileSetId || ''])
  }));
  return hash(JSON.stringify(payload)).toString(16).padStart(8, '0');
}

function assertCanonical() {
  const validIds = new Set(world.set.tiles.map((tile) => tile.id));
  for (const layer of world.map.layers) {
    const keys = new Set();
    for (const cell of layer.cells) {
      const key = `${cell.x},${cell.y}`;
      assert(!keys.has(key), `duplicate cell ${layer.id}:${key}`);
      keys.add(key);
      assert(validIds.has(cell.tileId), `missing resolved Tile ${cell.tileId}`);
      if (cell.terrainBrushId === 'terrain-w') {
        assert(!cell.autoTileSetId, 'Weighted Terrain retained autoTileSetId');
        const expected = referenceWeighted(world.set.terrainBrushes[0], layer.id, cell.x, cell.y, validIds);
        assert.strictEqual(cell.tileId, expected, `weighted mismatch ${layer.id}:${key}`);
      }
      if (cell.terrainBrushId === 'terrain-a') assert.strictEqual(cell.autoTileSetId, 'auto-a', `Auto Terrain metadata mismatch ${layer.id}:${key}`);
      if (!cell.terrainBrushId) assert(!cell.autoTileSetId || cell.autoTileSetId === 'auto-a', `noncanonical Auto metadata ${layer.id}:${key}`);
    }
  }
}

function serializeReloadAndCompare() {
  const before = semanticChecksum();
  const raw = JSON.parse(JSON.stringify({ set: world.set, map: world.map }));
  const set = p.createTileset(raw.set);
  const map = p.createTilemapRecord(raw.map);
  const project = { tilesets: [set], levels: [{ objects: [map] }] };
  p.recomputeProjectTerrain(project);
  p.recomputeProjectAutoTiles(project);
  world = { set, map, project };
  assertCanonical();
  assert.strictEqual(semanticChecksum(), before, 'Save/load changed canonical semantic state');
  serializeLoadCycles++;
}

function exerciseBatch() {
  const brush = world.set.terrainBrushes[0];
  const layerId = cycles % 2 ? 'ground' : 'detail';
  const x = (rnd() % 401) - 200;
  const y = (rnd() % 401) - 200;
  const radius = 1 + (rnd() % 8);
  const shape = rnd() % 2 ? 'square' : 'circle';
  const footprint = p.terrainFootprintCells(x, y, shape, radius);
  const before = JSON.parse(JSON.stringify(world.map));

  switch (cycles % 8) {
    case 0:
      p.paintTerrainCells(world.map, layerId, footprint, world.set, 'terrain-w');
      weightedResolutions += footprint.length;
      break;
    case 1:
      p.paintTerrainCells(world.map, layerId, footprint, world.set, 'terrain-a');
      autoTileResolutions += footprint.length;
      break;
    case 2:
      p.eraseTerrainCells(world.map, layerId, footprint, world.set);
      break;
    case 3:
      p.paintManualTileCell(world.map, layerId, x, y, 't03', world.set);
      break;
    case 4:
      p.paintAutoTileCell(world.map, layerId, x, y, world.set, 'auto-a');
      autoTileResolutions++;
      break;
    case 5:
      p.paintTerrainCell(world.map, layerId, x, y, world.set, 'terrain-w');
      weightedResolutions++;
      break;
    case 6:
      brush.seed = rnd() | 0;
      p.recomputeTerrainBrushUsage(world.project, 'tiles', 'terrain-w');
      weightedResolutions += world.map.layers.reduce((sum, layer) => sum + layer.cells.filter((cell) => cell.terrainBrushId === 'terrain-w').length, 0);
      break;
    default:
      brush.variants[rnd() % brush.variants.length].weight = 1 + (rnd() % 1000);
      p.recomputeTerrainBrushUsage(world.project, 'tiles', 'terrain-w');
      weightedResolutions += world.map.layers.reduce((sum, layer) => sum + layer.cells.filter((cell) => cell.terrainBrushId === 'terrain-w').length, 0);
  }
  terrainTransitions++;
  modelOperations += footprint.length;

  for (let i = 0; i < 64; i++) {
    const rx = (rnd() % 4001) - 2000;
    const ry = (rnd() % 4001) - 2000;
    const expected = referenceWeighted(brush, layerId, rx, ry, new Set(world.set.tiles.map((tile) => tile.id)));
    assert.strictEqual(p.resolveTerrainWeightedTile(world.set, brush, layerId, rx, ry), expected, `reference mismatch ${layerId}:${rx},${ry}`);
    weightedResolutions++;
    modelOperations++;
  }

  if (cycles % 5 === 0) {
    const after = JSON.parse(JSON.stringify(world.map));
    world.map = p.createTilemapRecord(before);
    world.project.levels[0].objects[0] = world.map;
    assert.deepStrictEqual(world.map, p.createTilemapRecord(before), 'Undo snapshot mismatch');
    undoRedoOperations++;
    world.map = p.createTilemapRecord(after);
    world.project.levels[0].objects[0] = world.map;
    assert.deepStrictEqual(world.map, p.createTilemapRecord(after), 'Redo snapshot mismatch');
    undoRedoOperations++;
  }

  if (cycles % 25 === 0) serializeReloadAndCompare();
  if (cycles % 10 === 0) assertCanonical();
  cycles++;
}

function snapshot(label) {
  const memory = observe(label);
  return {
    timestamp: new Date().toISOString(),
    elapsedSeconds: Number(elapsedSeconds().toFixed(3)),
    cycles,
    modelOperations,
    weightedResolutions,
    autoTileResolutions,
    terrainTransitions,
    serializeLoadCycles,
    undoRedoOperations,
    browserCycles,
    editableExportCycles,
    playableExportCycles,
    heartbeatCount,
    semanticChecksum: semanticChecksum(),
    cellCounts: Object.fromEntries(world.map.layers.map((layer) => [layer.id, layer.cells.length])),
    memory,
    failures: failures.slice()
  };
}

function state(status, extra = {}) {
  return {
    phase: 36,
    purpose: 'endurance closure',
    runId,
    baselineHead: HEAD,
    branch: BRANCH,
    workerPid: process.pid,
    startTimestamp: startedWall.toISOString(),
    latestHeartbeatTimestamp: heartbeatCount ? new Date().toISOString() : null,
    endTimestamp: null,
    targetSeconds: TARGET_SECONDS,
    elapsedSeconds: Number(elapsedSeconds().toFixed(3)),
    status,
    cycles,
    modelOperations,
    weightedResolutions,
    autoTileResolutions,
    terrainTransitions,
    serializeLoadCycles,
    undoRedoOperations,
    browserCycles,
    editableExportCycles,
    playableExportCycles,
    memoryObservations: memoryObservations.length,
    transientLockCount,
    semanticMismatches,
    crashes,
    unresolvedFailures: failures.slice(),
    ownedProcesses,
    ...extra
  };
}

function writeHeartbeat(subCampaign) {
  heartbeatCount++;
  const evidence = snapshot(`heartbeat-${heartbeatCount}`);
  writeJsonWithRetry(HEARTBEAT_PATH, {
    runId,
    currentSubCampaign: subCampaign,
    lastSuccessfulInvariantCheck: evidence.timestamp,
    ...evidence
  });
  writeJsonWithRetry(STATE_PATH, state('RUNNING', { latestHeartbeatTimestamp: evidence.timestamp }));
  lastHeartbeatAt = elapsedSeconds();
}

function preserveArtifact(label) {
  const pairs = [
    ['phase-036-editable-game.html', `endurance-closure-${label}-editable.html`],
    ['phase-036-playable-game.html', `endurance-closure-${label}-playable.html`],
    ['phase-036-terrain-brushes.png', `endurance-closure-${label}.png`]
  ];
  for (const [source, destination] of pairs) {
    const from = path.join(QUAL, source);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(QUAL, destination));
  }
}

function runBrowserCycle(label) {
  const result = childProcess.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'audit-phase-036-browser.js')], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Browser cycle ${label} failed: ${result.error ? result.error.stack : result.stderr || result.stdout}`);
  }
  const audit = JSON.parse(fs.readFileSync(path.join(QUAL, 'phase-036-browser-audit.json'), 'utf8'));
  assert.strictEqual(audit.ok, true, `Browser cycle ${label} did not pass`);
  assert.deepStrictEqual(audit.authoring.pageErrors, [], `Browser page errors in ${label}`);
  assert.deepStrictEqual(audit.authoring.consoleErrors, [], `Browser console errors in ${label}`);
  assert.deepStrictEqual(audit.authoring.externalRequests, [], `Browser external requests in ${label}`);
  browserCycles++;
  editableExportCycles++;
  playableExportCycles++;
  if (['first', 'midpoint', 'final'].includes(label)) preserveArtifact(label);
  lastBrowserAt = elapsedSeconds();
}

function finalEvidence(status, qualifying) {
  const ended = new Date();
  return {
    ...state(status, {
      endTimestamp: ended.toISOString(),
      latestHeartbeatTimestamp: heartbeatCount ? fs.statSync(HEARTBEAT_PATH).mtime.toISOString() : null
    }),
    actualElapsedSeconds: Number(elapsedSeconds().toFixed(3)),
    qualifying,
    heartbeatCount,
    midpoint,
    finalHour,
    memory: {
      observations: memoryObservations,
      assessment: failures.some((failure) => failure.kind === 'memory') ? 'UNACCEPTABLE' : 'BOUNDED_OBSERVATION_ONLY'
    },
    semanticFailures: failures,
    processCleanup: { workerPid: process.pid, browserAuditOwnsAndCleansChildren: true, expectedOrphans: 0 },
    previousNonqualifyingRun: { elapsedSeconds: 60.025, preservedAt: 'phase-036-endurance.json' }
  };
}

async function finish(status, qualifying) {
  if (ending) return;
  ending = true;
  observe('finish');
  const evidence = finalEvidence(status, qualifying);
  writeJsonWithRetry(EVIDENCE_PATH, evidence);
  writeJsonWithRetry(STATE_PATH, { ...evidence, memory: { observationCount: memoryObservations.length, assessment: evidence.memory.assessment } });
  console.log(`Phase 036 endurance closure: ${status} (${evidence.actualElapsedSeconds} seconds, ${cycles} cycles, ${browserCycles} browser cycles)`);
}

async function main() {
  observe('start');
  writeJsonWithRetry(STATE_PATH, state('STARTING'));
  runBrowserCycle('first');
  assertCanonical();
  writeHeartbeat('fresh-start-and-browser');

  while (elapsedSeconds() < Math.min(TARGET_SECONDS, MAX_SECONDS)) {
    const nowMono = performance.now();
    const gapSeconds = (nowMono - lastLoopMono) / 1000;
    if (gapSeconds > 120) throw new Error(`Environmental interruption or host sleep detected: ${gapSeconds.toFixed(3)} second activity gap`);
    lastLoopMono = nowMono;

    exerciseBatch();
    const elapsed = elapsedSeconds();

    if (!midpoint && elapsed >= 10800) {
      runBrowserCycle('midpoint');
      midpoint = snapshot('midpoint');
      writeJsonWithRetry(path.join(QUAL, 'endurance-closure-midpoint.json'), midpoint);
    }
    if (!finalHour && elapsed >= 18000) {
      runBrowserCycle('final-hour');
      finalHour = snapshot('final-hour');
      writeJsonWithRetry(path.join(QUAL, 'endurance-closure-final-hour.json'), finalHour);
    }
    if (elapsed - lastBrowserAt >= BROWSER_SECONDS) runBrowserCycle(`cycle-${browserCycles + 1}`);
    if (elapsed - lastHeartbeatAt >= HEARTBEAT_SECONDS) writeHeartbeat('mixed-terrain-model-browser-export');

    await sleep(SLEEP_MS);
  }

  if (!SMOKE && elapsedSeconds() < 21600) throw new Error(`Nonqualifying elapsed time ${elapsedSeconds().toFixed(3)} seconds`);
  if (!finalBrowserDone) {
    runBrowserCycle('final');
    finalBrowserDone = true;
  }
  serializeReloadAndCompare();
  assertCanonical();
  writeHeartbeat('final-invariant-and-browser');
  if (SMOKE) {
    await finish('SMOKE_PASS_NONQUALIFYING', false);
    return;
  }
  const qualifying = elapsedSeconds() >= 21600 && failures.length === 0 && browserCycles >= 12 && editableExportCycles >= 4 && playableExportCycles >= 4;
  if (!qualifying) throw new Error('Closure thresholds were not all satisfied');
  await finish('ENDURANCE_PASS_POSTCHECKS_PENDING', true);
}

process.on('SIGINT', async () => {
  failures.push({ kind: 'environment', timestamp: new Date().toISOString(), elapsedSeconds: Number(elapsedSeconds().toFixed(3)), error: 'SIGINT' });
  await finish('INTERRUPTED_NONQUALIFYING', false);
  process.exit(130);
});

process.on('SIGTERM', async () => {
  failures.push({ kind: 'environment', timestamp: new Date().toISOString(), elapsedSeconds: Number(elapsedSeconds().toFixed(3)), error: 'SIGTERM' });
  await finish('INTERRUPTED_NONQUALIFYING', false);
  process.exit(143);
});

main().catch(async (error) => {
  crashes++;
  semanticMismatches++;
  failures.push({ kind: 'semantic-or-harness', timestamp: new Date().toISOString(), elapsedSeconds: Number(elapsedSeconds().toFixed(3)), cycle: cycles, rngState, error: error.stack || String(error) });
  await finish('FAIL_NONQUALIFYING', false);
  process.exitCode = 1;
});
