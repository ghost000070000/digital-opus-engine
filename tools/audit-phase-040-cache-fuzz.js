'use strict';
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ROOT = path.resolve(__dirname, '..');
const p = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const source = require(path.join(ROOT, 'phase-040-10k-project.json'));
const tileset = source.tilesets[0]; const map = p.createTilemapRecord(source.levels[0].objects[0]);
let seed = 0x040240; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const cached = new Map(); const rebuild = () => { cached.clear(); for (const layer of map.layers) for (const cell of layer.cells) cached.set(`${layer.id}:${cell.x},${cell.y}`, `${cell.tileId}|${cell.autoTileSetId || ''}|${cell.terrainBrushId || ''}`); };
const compare = () => { const reference = new Map(); for (const layer of map.layers) for (const cell of layer.cells) reference.set(`${layer.id}:${cell.x},${cell.y}`, `${cell.tileId}|${cell.autoTileSetId || ''}|${cell.terrainBrushId || ''}`); if (reference.size !== cached.size) return false; for (const [key, value] of reference) if (cached.get(key) !== value) return false; return true; };
const refreshLayer = (layer) => { for (const key of [...cached.keys()]) if (key.startsWith(`${layer.id}:`)) cached.delete(key); for (const cell of layer.cells) cached.set(`${layer.id}:${cell.x},${cell.y}`, `${cell.tileId}|${cell.autoTileSetId || ''}|${cell.terrainBrushId || ''}`); };
const refreshNeighborhood = (layer, x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const key = `${layer.id}:${x + dx},${y + dy}`; const cell = p.getTilemapCell(map, layer.id, x + dx, y + dy); if (cell) cached.set(key, `${cell.tileId}|${cell.autoTileSetId || ''}|${cell.terrainBrushId || ''}`); else cached.delete(key); } };
rebuild(); const started = performance.now(); let mismatches = 0; const latencies = []; const history = [];
for (let i = 0; i < 250000; i++) {
  const layer = map.layers[i % map.layers.length]; const x = Math.floor(random() * 160) - 80; const y = Math.floor(random() * 100) - 40; const action = i % 11; const before = performance.now(); let touched = null;
  if (action === 0) p.eraseTilemapCell(map, layer.id, x, y);
  else if (action === 1) p.paintAutoTileCell(map, layer.id, x, y, tileset, 'roads');
  else if (action === 2) p.paintTerrainCells(map, layer.id, [{ x, y }], tileset, 'meadow');
  else if (action === 3) p.paintTerrainCells(map, layer.id, [{ x, y }], tileset, 'connected-meadow');
  else if (action === 4) { history.push(JSON.stringify(layer.cells.slice(-32))); if (history.length > 100) history.shift(); p.setTilemapCell(map, layer.id, x, y, `tile-${i % 28}`); }
  else if (action === 5 && i % 5000 === 5) { tileset.terrainBrushes[0].seed = (tileset.terrainBrushes[0].seed + 1) | 0; p.recomputeProjectTerrain({ levels: [{ objects: [map] }], tilesets: [tileset] }, 'meadow'); for (const changed of map.layers) refreshLayer(changed); }
  else if (action === 5) p.setTilemapCell(map, layer.id, x, y, `tile-${i % 28}`);
  else if (action === 6) { layer.visible = !layer.visible; layer.visible = !layer.visible; }
  else if (action === 7) { const cell = layer.cells[i % layer.cells.length]; if (cell) { cell.tileId = `tile-${(i + 1) % 28}`; touched = cell; } }
  else if (action === 8) { const sprite = source.spriteAssets[i % source.spriteAssets.length]; sprite.sourceRect = sprite.sourceRect ? null : { x: 0, y: 0, width: 1, height: 1 }; }
  else if (action === 9) { tileset.cellSize.width = tileset.cellSize.width === 1 ? 1.001 : 1; }
  else p.setTilemapCell(map, layer.id, x, y, `tile-${i % 28}`);
  refreshNeighborhood(layer, x, y); if (touched) refreshNeighborhood(layer, touched.x, touched.y); latencies.push(performance.now() - before);
  if (i % 5000 === 0 && !compare()) { mismatches++; break; }
}
const sorted = latencies.slice().sort((a, b) => a - b); const q = (n) => sorted[Math.floor((sorted.length - 1) * n)]; const report = { phase: 40, mutations: latencies.length, seed: '0x040240', periodicFullRebuildComparisons: Math.ceil(latencies.length / 5000), mismatches, latency: { medianMs: q(.5), p95Ms: q(.95), p99Ms: q(.99), maxMs: sorted[sorted.length - 1] }, finalCells: map.layers.reduce((n, l) => n + l.cells.length, 0), historyLimitObserved: history.length, activeMs: performance.now() - started, status: mismatches ? 'FAIL' : 'PASS' };
fs.mkdirSync(path.join(ROOT, 'qualification', 'phase-040'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'qualification', 'phase-040', 'cache-fuzz.json'), JSON.stringify(report, null, 2) + '\n'); console.log(`Phase 040 cache fuzz: ${report.status}; ${report.mutations} mutations; ${report.mismatches} mismatches`); if (mismatches) process.exitCode = 1;
