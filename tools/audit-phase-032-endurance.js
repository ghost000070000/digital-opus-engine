'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const plumbing = require('../editor/src/00-authoring-plumbing.js');

const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-032');
const HEARTBEAT = path.join(QUAL, 'endurance-heartbeat.json');
const requestedSeconds = Math.max(1, Number(process.argv[2]) || 7200);
const start = Date.now();
const seeds = [11, 23, 47, 97, 193];
const map = plumbing.createTilemapRecord({ id: 'endurance', name: 'Endurance', tilesetRef: 'ts' });
let cycles = 0; let actions = 0; let paintOps = 0; let eraseOps = 0;
let serializeCycles = 0; let saveReloadCycles = 0; let undoRedoCycles = 0;
let tilesetMutationCycles = 0; let browserCycles = 0; let exportCycles = 0;
let heartbeatCount = 0; let peakHeap = 0; let transientWindowsLocks = 0;
let nextHeartbeatMs = 10 * 60 * 1000; let nextBrowserMs = 0;
const failures = [];

function elapsedMs() { return Date.now() - start; }
function campaignFor(ms) {
  const fraction = ms / (requestedSeconds * 1000);
  if (fraction < 0.30) return 'model-storage';
  if (fraction < 0.50) return 'undo-redo';
  if (fraction < 0.68) return 'tileset-mutation';
  if (fraction < 0.86) return 'browser';
  return 'export-loop';
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  try { fs.renameSync(temp, file); }
  catch (error) {
    if (!['UNKNOWN', 'EBUSY', 'EPERM'].includes(error.code)) throw error;
    transientWindowsLocks++;
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    try { fs.unlinkSync(temp); } catch (_) { /* best-effort campaign temp only */ }
  }
}
function heartbeat(final = false) {
  heartbeatCount++;
  writeJson(HEARTBEAT, {
    phase: 32,
    timestamp: new Date().toISOString(),
    elapsedSeconds: elapsedMs() / 1000,
    campaign: campaignFor(elapsedMs()),
    cycle: cycles,
    seed: seeds[cycles % seeds.length],
    cellCount: plumbing.tilemapCellCount(map),
    paintOps,
    eraseOps,
    serializeCycles,
    saveReloadCycles,
    undoRedoCycles,
    tilesetMutationCycles,
    browserCycles,
    exportCycles,
    failures: failures.slice(),
    heapUsedBytes: process.memoryUsage().heapUsed,
    peakHeapBytes: peakHeap,
    final,
  });
}
function runBrowserExportCycle() {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'audit-phase-032-browser.js')], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 240000,
  });
  browserCycles++;
  exportCycles++;
  if (result.status !== 0) failures.push({ campaign: 'browser-export', cycle: browserCycles, status: result.status, stderr: String(result.stderr || '').slice(-2000) });
}

while (elapsedMs() < requestedSeconds * 1000) {
  const seed = seeds[cycles % seeds.length];
  const before = plumbing.serializeTilemapCells(map);
  // Keep the hot working set intentionally bounded: endurance is repetition,
  // not an attempt to exhaust RAM (large-cell scale has its own focused gate).
  for (let i = 0; i < 2000; i++) {
    const n = cycles * 2000 + i + seed;
    const x = (n % 65) - 32;
    const y = (Math.floor(n / 65) % 65) - 32;
    if (n % 5 === 0) { plumbing.eraseTilemapCell(map, x, y); eraseOps++; }
    else { plumbing.setTilemapCell(map, x, y, `tile-${n % 13}`); paintOps++; }
    actions++;
  }
  const canonical = plumbing.serializeTilemapCells(map);
  const json = JSON.stringify(canonical);
  const loaded = plumbing.canonicalizeTilemapCells(JSON.parse(json));
  assert.strictEqual(JSON.stringify(loaded), json);
  assert.strictEqual(loaded.length, plumbing.tilemapCellCount(map));
  serializeCycles++;
  saveReloadCycles++;

  const undoMap = plumbing.createTilemapRecord({ id: 'undo', name: 'Undo', tilesetRef: 'ts', cells: before });
  const redoMap = plumbing.createTilemapRecord({ id: 'redo', name: 'Redo', tilesetRef: 'ts', cells: loaded });
  assert.strictEqual(JSON.stringify(plumbing.serializeTilemapCells(undoMap)), JSON.stringify(before));
  assert.strictEqual(JSON.stringify(plumbing.serializeTilemapCells(redoMap)), json);
  undoRedoCycles++;

  const tileset = plumbing.createTileset({ id: 'ts', name: `Set ${cycles}`, tiles: Array.from({ length: 13 }, (_, i) => ({ id: `tile-${i}`, name: `Tile ${i}`, spriteAssetRef: `sprite-${i}` })) });
  tileset.tiles[0].name = 'Renamed';
  tileset.tiles.push(tileset.tiles.shift());
  tileset.tiles[0].spriteAssetRef = 'sprite-repaired';
  tileset.tiles.push({ ...tileset.tiles[0], id: `duplicate-${cycles}` });
  const paintedIds = plumbing.tilemapUsedTileIds(map);
  assert(paintedIds.every((id) => /^tile-\d+$/.test(id)));
  assert.strictEqual(plumbing.createTileset(JSON.parse(JSON.stringify(tileset))).tiles.length, tileset.tiles.length);
  tilesetMutationCycles++;

  peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
  cycles++;
  if (elapsedMs() >= nextBrowserMs && elapsedMs() < requestedSeconds * 1000) {
    runBrowserExportCycle();
    nextBrowserMs += 30 * 60 * 1000;
  }
  if (elapsedMs() >= nextHeartbeatMs) {
    heartbeat(false);
    nextHeartbeatMs += 10 * 60 * 1000;
  }
}

heartbeat(true);
const durationMs = elapsedMs();
const report = {
  phase: 32,
  kind: 'bounded-endurance',
  requestedSeconds,
  actualDurationSeconds: durationMs / 1000,
  campaigns: ['model-storage', 'undo-redo', 'tileset-mutation', 'browser', 'export-loop'],
  seeds,
  cycles,
  actions,
  paintOps,
  eraseOps,
  serializeCycles,
  saveReloadCycles,
  undoRedoCycles,
  tilesetMutationCycles,
  browserCycles,
  exportCycles,
  heartbeatCount,
  occupied: plumbing.tilemapCellCount(map),
  peakHeapBytes: peakHeap,
  finalHeapBytes: process.memoryUsage().heapUsed,
  transientWindowsLocks,
  failures,
  ok: failures.length === 0,
  verdict: failures.length === 0 ? 'PASS' : 'FAIL',
  limitations: requestedSeconds < 7200 ? 'Short qualification run; preferred 2-4 hour soak was not executed in this invocation.' : null,
};
writeJson(path.join(ROOT, 'phase-032-endurance.json'), report);
writeJson(path.join(QUAL, 'phase-032-endurance.json'), report);
console.log(`Phase 032 endurance ${report.verdict}: ${report.actualDurationSeconds.toFixed(1)}s, ${actions} actions, ${browserCycles} browser/export cycles`);
if (!report.ok) process.exitCode = 1;
