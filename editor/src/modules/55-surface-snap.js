// ===== Surface snapping =====
// Objects dragged in the viewport, or dropped from the Objects palette and
// Content Library, rest on whatever is under the cursor -- other models,
// cubes, ramps or terrain -- instead of the flat Y = 0 plane. Toggle with the
// View menu's "Snap to surfaces" checkbox (a per-browser preference, never saved in the
// game). End drops the selection onto the surface below it.
const SURFACE_SNAP_PREF = 'doengine:pref:surface-snap';
let surfaceSnapEnabled = (() => { try { return localStorage.getItem(SURFACE_SNAP_PREF) !== 'off'; } catch (error) { return true; } })();
const surfaceMeshCache = new WeakMap();

// Things an object can sit on, and things that can sit: ordinary visible
// Cubes, Ramps and models. Markers, triggers, sprites and lights are neither.
function surfaceRestableItem(item) {
  return !!item && item.kind === 'cube' && !!item.entity && !item.isTrigger && !item.isSpawnPoint &&
    !item.isWaypoint && !item.isPathPoint && !item.isActiveCamera && !item.isBillboard;
}
function surfaceLocalData(mesh) {
  if (surfaceMeshCache.has(mesh)) return surfaceMeshCache.get(mesh);
  let data = { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5], positions: null, indices: null };
  try {
    const arrays = Opus.Mesh.toArrays(mesh), p = arrays.positions;
    if (p && p.length >= 9) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i++) { const a = i % 3; if (p[i] < min[a]) min[a] = p[i]; if (p[i] > max[a]) max[a] = p[i]; }
      data = { min, max, positions: p, indices: arrays.indices && arrays.indices.length ? arrays.indices : null };
    }
  } catch (error) { /* built-in primitive: unit box */ }
  surfaceMeshCache.set(mesh, data);
  return data;
}
function surfaceTransformPoint(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}
// World-space axis-aligned bounds of an entity's own mesh.
function surfaceWorldBounds(entity) {
  const m = entity.modelMatrix && entity.modelMatrix.m;
  if (!m) return null;
  const { min, max } = surfaceLocalData(entity.mesh);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    const w = surfaceTransformPoint(m, x, y, z);
    for (let a = 0; a < 3; a++) { if (w[a] < lo[a]) lo[a] = w[a]; if (w[a] > hi[a]) hi[a] = w[a]; }
  }
  return { min: lo, max: hi };
}
function surfaceRayBox(o, d, min, max) {
  let t0 = -Infinity, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < min[a] || o[a] > max[a]) return null; continue; }
    let ta = (min[a] - o[a]) / d[a], tb = (max[a] - o[a]) / d[a];
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  if (t1 < 0) return null;
  return t0 >= 0 ? t0 : 0;
}
// Inverse of an affine column-major 4x4 (rotation/scale + translation).
function surfaceInvertAffine(m) {
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const r = [A / det, (c * h - b * i) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, (c * d - a * f) / det, C / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const tx = m[12], ty = m[13], tz = m[14];
  return { r, t: [-(r[0] * tx + r[1] * ty + r[2] * tz), -(r[3] * tx + r[4] * ty + r[5] * tz), -(r[6] * tx + r[7] * ty + r[8] * tz)] };
}
// Ray parameter t (world units along `d`) of the first hit on this entity, or null.
function surfaceRayEntity(o, d, entity, maxT) {
  const bounds = surfaceWorldBounds(entity);
  if (!bounds) return null;
  const boxT = surfaceRayBox(o, d, bounds.min, bounds.max);
  if (boxT === null || boxT >= maxT) return null;
  const inv = surfaceInvertAffine(entity.modelMatrix.m);
  if (!inv) return null;
  const r = inv.r;
  const lo = [r[0] * o[0] + r[1] * o[1] + r[2] * o[2] + inv.t[0], r[3] * o[0] + r[4] * o[1] + r[5] * o[2] + inv.t[1], r[6] * o[0] + r[7] * o[1] + r[8] * o[2] + inv.t[2]];
  const ld = [r[0] * d[0] + r[1] * d[1] + r[2] * d[2], r[3] * d[0] + r[4] * d[1] + r[5] * d[2], r[6] * d[0] + r[7] * d[1] + r[8] * d[2]];
  const data = surfaceLocalData(entity.mesh), P = data.positions;
  const triCount = P ? (data.indices ? data.indices.length : P.length / 3) / 3 : 0;
  if (!P || triCount > 60000) return surfaceRayBox(lo, ld, data.min, data.max); // primitives (and huge meshes) by their box
  let best = null;
  for (let k = 0; k < triCount; k++) {
    const ia = (data.indices ? data.indices[k * 3] : k * 3) * 3, ib = (data.indices ? data.indices[k * 3 + 1] : k * 3 + 1) * 3, ic = (data.indices ? data.indices[k * 3 + 2] : k * 3 + 2) * 3;
    const e1x = P[ib] - P[ia], e1y = P[ib + 1] - P[ia + 1], e1z = P[ib + 2] - P[ia + 2];
    const e2x = P[ic] - P[ia], e2y = P[ic + 1] - P[ia + 1], e2z = P[ic + 2] - P[ia + 2];
    const px = ld[1] * e2z - ld[2] * e2y, py = ld[2] * e2x - ld[0] * e2z, pz = ld[0] * e2y - ld[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const sx = lo[0] - P[ia], sy = lo[1] - P[ia + 1], sz = lo[2] - P[ia + 2];
    const u = (sx * px + sy * py + sz * pz) / det;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (ld[0] * qx + ld[1] * qy + ld[2] * qz) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) / det;
    if (t >= 0 && (best === null || t < best)) best = t;
  }
  return best;
}
// Terrain heightfields: march the ray across the terrain square, then refine.
function surfaceRayTerrain(o, d, handle, maxT) {
  if (!handle || typeof handle.sampleHeight !== 'function') return null;
  const half = (handle.options?.size ?? 22) / 2, cx = handle.position.x, cz = handle.position.z;
  let t0 = 0, t1 = maxT;
  for (const [oa, da, c] of [[o[0], d[0], cx], [o[2], d[2], cz]]) {
    if (Math.abs(da) < 1e-12) { if (oa < c - half || oa > c + half) return null; continue; }
    let ta = (c - half - oa) / da, tb = (c + half - oa) / da;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  if (Math.abs(d[0]) < 1e-9 && Math.abs(d[2]) < 1e-9) { // straight down (End): exact
    if (d[1] >= 0) return null;
    const t = (o[1] - handle.sampleHeight(o[0], o[2])) / -d[1];
    return t >= 0 && t < maxT ? t : null;
  }
  t1 = Math.min(t1, 2000);
  if (!(t1 > t0)) return null;
  const above = (t) => o[1] + d[1] * t - handle.sampleHeight(o[0] + d[0] * t, o[2] + d[2] * t);
  const steps = 240, step = (t1 - t0) / steps;
  let prevT = t0, prev = above(t0);
  if (prev <= 0) return t0;
  for (let s = 1; s <= steps; s++) {
    const t = t0 + step * s, value = above(t);
    if (value <= 0) {
      let lo = prevT, hi = t;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (above(mid) > 0) lo = mid; else hi = mid; }
      return hi;
    }
    prevT = t; prev = value;
  }
  return null;
}
// First surface along a ray. `excluded` items (and nothing else) are ignored.
// Falls back to the Y = 0 ground plane so empty scenes behave as before.
function raycastSceneSurfaces(origin, direction, excluded) {
  const o = [origin.x, origin.y, origin.z], d = [direction.x, direction.y, direction.z];
  let bestT = Infinity, bestItem = null;
  for (const item of placed) {
    if (excluded && excluded.has(item)) continue;
    let t = null;
    if (item.kind === 'terrain') t = surfaceRayTerrain(o, d, item.handle, bestT);
    else if (surfaceRestableItem(item) && item.entity.visible !== false) t = surfaceRayEntity(o, d, item.entity, bestT);
    if (t !== null && t < bestT) { bestT = t; bestItem = item; }
  }
  if (!bestItem) {
    if (d[1] >= -1e-6) return null;
    const t = -o[1] / d[1];
    if (t < 0) return null;
    bestT = t;
  }
  return { point: new Opus.Vec3(o[0] + d[0] * bestT, o[1] + d[1] * bestT, o[2] + d[2] * bestT), item: bestItem, distance: bestT };
}
function screenSurfaceHit(clientX, clientY, excluded) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1, ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const ray = app.camera.screenPointToRay(ndcX, ndcY, canvas.width / Math.max(canvas.height, 1));
  return raycastSceneSurfaces(ray.origin, ray.direction, excluded);
}
// The dragged objects, plus everything parented under them, never count as surfaces.
function surfaceExclusionsFor(items) {
  const set = new Set(items);
  for (const item of items) for (const child of collectDescendants(item)) set.add(child);
  return set;
}
function surfaceBottomY(item) {
  const bounds = item && item.entity ? surfaceWorldBounds(item.entity) : null;
  return bounds ? bounds.min[1] : null;
}

// Viewport drag: the grabbed object's base follows the surface under the
// cursor; the rest of a multi-selection keeps its formation. Returns false
// to fall back to the classic flat drag.
function applySurfaceDragMovement(state, clientX, clientY) {
  if (!surfaceSnapEnabled || playMode || !state || !state.primary || !surfaceRestableItem(state.primary)) return false;
  const primary = (state.items || []).find((entry) => entry.item === state.primary);
  if (!primary || !Number.isFinite(primary.startY) || !Number.isFinite(state.primaryBottomOffset)) return false;
  if (!state.surfaceExcluded) state.surfaceExcluded = surfaceExclusionsFor(state.items.map((entry) => entry.item));
  const hit = screenSurfaceHit(clientX, clientY, state.surfaceExcluded);
  if (!hit) return true; // pointing at the sky: hold still rather than jump
  const offset = state.surfaceGrabOffset || { x: 0, z: 0 };
  applyGroundDragMovement(state, hit.point.x + offset.x - primary.startX, hit.point.z + offset.z - primary.startZ);
  const dy = hit.point.y + state.primaryBottomOffset - primary.startY;
  let changed = false;
  for (const entry of state.items) {
    if (!surfaceRestableItem(entry.item) || !Number.isFinite(entry.startY) || !placed.includes(entry.item)) continue;
    const y = entry.startY + dy, p = entry.item.entity.position;
    if (p.y !== y) { if (!state.moved) { pushUndo(); state.moved = true; } p.y = y; changed = true; }
  }
  if (changed && typeof syncSelectionMarkers === 'function') syncSelectionMarkers();
  return true;
}
// Called when a viewport drag begins (09-selection-and-gizmo.js).
function prepareSurfaceDrag(state, grabbed, clientX, clientY) {
  if (!state || !surfaceRestableItem(grabbed)) return;
  for (const entry of state.items) entry.startY = itemPosition(entry.item).y;
  const bottom = surfaceBottomY(grabbed);
  state.primary = grabbed;
  state.primaryBottomOffset = bottom === null ? NaN : grabbed.entity.position.y - bottom;
  // Keep where the object was grabbed (at its base height) so it does not
  // jump under the cursor; limited to its own footprint.
  state.surfaceGrabOffset = { x: 0, z: 0 };
  if (bottom !== null && Number.isFinite(clientX) && Number.isFinite(clientY) && typeof screenToPlanePoint === 'function') {
    const base = screenToPlanePoint(clientX, clientY, new Opus.Vec3(0, bottom, 0), new Opus.Vec3(0, 1, 0));
    const bounds = surfaceWorldBounds(grabbed.entity), p = grabbed.entity.position;
    if (base && bounds) {
      const ox = p.x - base.x, oz = p.z - base.z, limit = Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) / 2;
      if (Math.hypot(ox, oz) <= limit) state.surfaceGrabOffset = { x: ox, z: oz };
    }
  }
}

// Drops from the palette / Content Library land on the surface under the cursor.
function surfacePlacementPoint(payload, clientX, clientY) {
  if (!surfaceSnapEnabled || playMode) return null;
  if (OpusAuthoringPlumbing.isSpritePlacementPayload(payload) || payload?.paletteType === 'sprite') return null;
  const hit = screenSurfaceHit(clientX, clientY, null);
  return hit ? { point: hit.point, plane: 'ground', surfaceY: hit.point.y } : null;
}
// After a drop, lift or lower just-created objects so the lowest one rests at surfaceY.
function restNewItemsOnSurface(items, surfaceY) {
  const restable = items.filter(surfaceRestableItem).filter((item) => !item.parentId || !items.some((other) => other.id === item.parentId));
  if (!restable.length || !Number.isFinite(surfaceY)) return false;
  const bottoms = restable.map(surfaceBottomY).filter(Number.isFinite);
  if (!bottoms.length) return false;
  const dy = surfaceY - Math.min(...bottoms);
  if (Math.abs(dy) < 1e-6) return false;
  for (const item of restable) item.entity.position.y += dy;
  if (typeof syncSelectionMarkers === 'function') syncSelectionMarkers();
  if (selectedItem && restable.includes(selectedItem)) renderInspector();
  return true;
}

// End: drop each selected object straight down onto the first surface below it.
function dropSelectionToSurface() {
  if (playMode) { showStatus('Stop Play before moving objects.'); return 0; }
  const items = [...selectedItems].filter(surfaceRestableItem).filter((item) => !item.parentId || !selectedItems.has(findItemById(item.parentId)));
  if (!items.length) { showStatus('Select Cubes or models to drop onto the surface below.'); return 0; }
  const excluded = surfaceExclusionsFor([...selectedItems]);
  const moves = [];
  for (const item of items) {
    const bottom = surfaceBottomY(item);
    if (!Number.isFinite(bottom)) continue;
    const p = item.entity.position;
    const hit = raycastSceneSurfaces(new Opus.Vec3(p.x, bottom + 0.01, p.z), new Opus.Vec3(0, -1, 0), excluded);
    if (hit && Math.abs(hit.point.y - bottom) > 1e-4) moves.push({ item, dy: hit.point.y - bottom });
  }
  if (!moves.length) { showStatus('Already resting on the surface below.'); return 0; }
  pushUndo();
  for (const { item, dy } of moves) item.entity.position.y += dy;
  if (typeof syncSelectionMarkers === 'function') syncSelectionMarkers();
  renderInspector();
  showStatus(`Dropped ${moves.length} object${moves.length === 1 ? '' : 's'} onto the surface below · Undo restores`);
  return moves.length;
}

(function mountSurfaceSnapToggle() {
  const toggle = document.getElementById('surface-snap-toggle');
  if (!toggle) return;
  toggle.checked = surfaceSnapEnabled;
  toggle.addEventListener('change', () => {
    surfaceSnapEnabled = toggle.checked;
    try { localStorage.setItem(SURFACE_SNAP_PREF, surfaceSnapEnabled ? 'on' : 'off'); } catch (error) { /* preference only */ }
    showStatus(surfaceSnapEnabled ? 'Surface snap on: objects rest on what is under the cursor' : 'Surface snap off: drags slide on the ground plane');
  });
})();
window.addEventListener('keydown', (event) => {
  if (playMode || event.key !== 'End' || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  event.preventDefault();
  dropSelectionToSurface();
});
if (typeof COMMAND_PALETTE_ACTIONS !== 'undefined') {
  COMMAND_PALETTE_ACTIONS.push(
    { label: 'Drop Selection to Surface', hint: 'End', run: () => dropSelectionToSurface() },
    { label: 'Toggle Surface Snap', hint: 'View menu', run: () => document.getElementById('surface-snap-toggle')?.click() },
  );
}
