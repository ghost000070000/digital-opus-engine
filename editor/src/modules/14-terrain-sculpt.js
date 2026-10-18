// --- Terrain Sculpting (Wave 4) ---
// A gesture-level brush editor over the engine's new opts.heightEdits layer
// (see engine/src/19-terrain.js). Deliberately NOT a separate rendering/
// physics path -- every sculpt stroke just mutates the delta grid and
// remove+recreates the terrain through the exact same app.removeTerrain /
// app.createTerrain pair the inspector's own Seed/Size/Radius regenerate-on-
// edit already used and proved (see the terrain inspector below), so
// rendering, `sampleHeight`/`sampleNormal` (physics/AI/spawn), and picking
// all read the identical edited heightfield with no separate code path to
// drift out of sync.
let sculptMode = false;
const sculptSettings = { brush: 'raise', radius: 2.5, strength: 0.5 };
let sculptDragState = null; // { item, strokeStarted (pushUndo gate), flattenHeight }

function changeTerrainSculptSetting(key, raw) {
  const limits = key === 'radius' ? [0.5, 256] : key === 'strength' ? [0.05, 2] : null;
  if (!limits || String(raw).trim() === '') return false;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < limits[0] || value > limits[1]) return false;
  sculptSettings[key] = value;
  return true;
}

// Cancellation ends input ownership, retaining already authored changes and
// their one Undo point. It never adds a second history record.
function finishTerrainSculptGesture() {
  if (!sculptDragState) return false;
  sculptDragState = null;
  activePointerId = null;
  suppressCameraDrag();
  showTerrainSculptPreview(null);
  renderInspector();
  return true;
}
window.addEventListener('blur', () => { if (sculptDragState) finishTerrainSculptGesture(); });

let terrainSculptPreview = null;
function showTerrainSculptPreview(point) {
  if (!terrainSculptPreview && (!point || playMode || !(sculptMode || paintMode) || selectedItem?.kind !== 'terrain')) return;
  if (!terrainSculptPreview) {
    terrainSculptPreview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    terrainSculptPreview.id = 'terrain-sculpt-preview';
    terrainSculptPreview.setAttribute('aria-hidden', 'true');
    terrainSculptPreview.style.cssText = 'position:fixed;pointer-events:none;z-index:20;overflow:hidden;display:none';
    document.body.appendChild(terrainSculptPreview);
  }
  terrainSculptPreview.style.display = 'none';
  if (!point || playMode || !(sculptMode || paintMode) || selectedItem?.kind !== 'terrain') return;
  const item = selectedItem, opts = item.options, radius = paintMode ? paintSettings.radius : sculptSettings.radius;
  if (Math.abs(point.x - opts.position.x) > opts.size / 2 + radius || Math.abs(point.z - opts.position.z) > opts.size / 2 + radius) return;
  const rect = canvas.getBoundingClientRect(), points = [];
  for (let i = 0; i <= 48; i++) {
    const angle = i * Math.PI * 2 / 48, x = point.x + Math.cos(angle) * radius, z = point.z + Math.sin(angle) * radius;
    const p = worldToScreen(new Opus.Vec3(x, item.handle.sampleHeight(x, z) + 0.03, z));
    if (!p) return;
    points.push(`${p.x - rect.left},${p.y - rect.top}`);
  }
  terrainSculptPreview.style.left = rect.left + 'px'; terrainSculptPreview.style.top = rect.top + 'px';
  terrainSculptPreview.setAttribute('width', rect.width); terrainSculptPreview.setAttribute('height', rect.height);
  terrainSculptPreview.innerHTML = `<polyline points="${points.join(' ')}" fill="none" stroke="#70e0cc" stroke-width="2"/>`;
  terrainSculptPreview.style.display = 'block';
}
canvas.addEventListener('pointermove', e => showTerrainSculptPreview(!playMode && (sculptMode || paintMode) && selectedItem?.kind === 'terrain' ? screenToGroundPoint(e.clientX, e.clientY) : null));
canvas.addEventListener('pointerleave', () => showTerrainSculptPreview(null));

// Shared by the sculpt brush and the terrain inspector's own Seed/Size/
// Radius fields -- one place that knows how to swap a terrain's live handle
// for a freshly-regenerated one from patched options.
function regenerateTerrain(item, patch) {
  app.removeTerrain(item.handle);
  if (patch) Object.assign(item.options, patch);
  item.handle = app.createTerrain(item.options);
  syncTerrainLayerTextures(item);
  const marker = selectionMarkers.get(item);
  if (marker) marker.position.set(item.options.position.x, 0.02, item.options.position.z);
}

function ensureHeightEdits(item) {
  const opts = item.options;
  const segs = opts.segments;
  const verts = segs + 1;
  if (!opts.heightEdits || opts.heightEdits.segments !== segs) {
    opts.heightEdits = { segments: segs, deltas: new Array(verts * verts).fill(0) };
  }
  return opts.heightEdits;
}

function smoothFalloff(distRatio) {
  // 1 at the brush center, 0 at the edge, smoothstep in between -- a hard
  // cutoff would leave a visible ring at the brush radius.
  const t = Math.max(0, Math.min(1, 1 - distRatio));
  return t * t * (3 - 2 * t);
}

// Applies one brush "dab" (called on pointerdown and every pointermove of
// an active stroke) at `worldPoint`, then regenerates the terrain so the
// stroke is visible live. `first` marks the very first dab of a stroke --
// used by Flatten to capture its one reference height for the whole stroke.
function applySculptBrush(item, worldPoint, first) {
  if (playMode || !placed.includes(item) || item.kind !== 'terrain' ||
      !sculptDragState || sculptDragState.item !== item ||
      !Number.isFinite(worldPoint.x) || !Number.isFinite(worldPoint.z)) return false;
  const opts = item.options;
  const segs = opts.segments;
  const current = opts.heightEdits;
  // Compute against a detached candidate before touching authored state.
  const edits = { segments: segs, deltas: current && current.segments === segs
    ? current.deltas.slice() : new Array((segs + 1) ** 2).fill(0) };
  const { deltas } = edits;
  const verts = segs + 1;
  const size = opts.size;
  const lx = worldPoint.x - opts.position.x;
  const lz = worldPoint.z - opts.position.z;
  const { brush, radius, strength } = sculptSettings;
  if (!Number.isFinite(radius) || radius < 0.5 || radius > 256 ||
      !Number.isFinite(strength) || strength < 0.05 || strength > 2 ||
      !['raise', 'lower', 'flatten', 'smooth'].includes(brush)) return false;
  if (Math.abs(lx) > size / 2 + radius || Math.abs(lz) > size / 2 + radius) return false;
  if (brush === 'flatten' && (first || !Number.isFinite(sculptDragState.flattenHeight))) sculptDragState.flattenHeight = item.handle.sampleHeight(worldPoint.x, worldPoint.z);
  let changed = false;
  for (let iz = 0; iz <= segs; iz++) {
    for (let ix = 0; ix <= segs; ix++) {
      const vx = (ix / segs - 0.5) * size;
      const vz = (iz / segs - 0.5) * size;
      const dist = Math.hypot(vx - lx, vz - lz);
      if (dist > radius) continue;
      const falloff = smoothFalloff(dist / radius);
      const idx = iz * verts + ix;
      const before = deltas[idx];
      if (brush === 'raise') deltas[idx] += strength * falloff * 0.12;
      else if (brush === 'lower') deltas[idx] -= strength * falloff * 0.12;
      else if (brush === 'flatten') {
        const cur = item.handle.sampleHeight(vx + opts.position.x, vz + opts.position.z);
        deltas[idx] += (sculptDragState.flattenHeight - cur) * falloff * strength * 0.5;
      } else if (brush === 'smooth') {
        const neighbors = [[ix - 1, iz], [ix + 1, iz], [ix, iz - 1], [ix, iz + 1]].filter(([nx, nz]) => nx >= 0 && nx <= segs && nz >= 0 && nz <= segs);
        let sum = 0;
        for (const [nx, nz] of neighbors) {
          const nwx = (nx / segs - 0.5) * size + opts.position.x;
          const nwz = (nz / segs - 0.5) * size + opts.position.z;
          sum += item.handle.sampleHeight(nwx, nwz);
        }
        const avg = sum / neighbors.length;
        const cur = item.handle.sampleHeight(vx + opts.position.x, vz + opts.position.z);
        deltas[idx] += (avg - cur) * falloff * strength * 0.5;
      }
      if (deltas[idx] !== before) changed = true;
    }
  }
  if (!changed) return false;
  if (!sculptDragState.strokeStarted) { pushUndo(); sculptDragState.strokeStarted = true; }
  opts.heightEdits = edits;
  regenerateTerrain(item);
  return true;
}

// Wave 6 (Priority G): Terrain Painting -- a brush editor over
// opts.paintEdits (see engine/src/19-terrain.js's own comment on the color
// blend), built as a direct sibling of the sculpt brush above -- same
// pointerdown/pointermove wiring, same falloff, same regenerateTerrain
// call to make a stroke visible live, so an author who already knows how
// to sculpt already knows how to paint.
let paintMode = false;
const PAINT_MAX_LAYERS = 3;
const paintSettings = { radius: 3, strength: 0.6, activeLayer: 0, automask: 'off' }; // automask: 'off' | 'flat' | 'steep'
let paintDragState = null; // { item }

