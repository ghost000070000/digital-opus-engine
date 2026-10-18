// --- Wave 8 (Priority I, Sections 54-60): Spline/Path Authoring ---
// A Path is its OWN lightweight container item (`kind: 'path'`) holding an
// ORDERED list of point-marker item ids (`pointIds`) -- deliberately NOT a
// second point-storage shape: each point is an ordinary small placed
// marker (`isPathPoint: true`, matching the exact same
// authoring-primitive-reuse pattern Waypoint/Trigger/Ramp already
// established), so "move a point in the viewport" is just moving an
// ordinary object -- the EXISTING Move gizmo/drag mechanics, free, no new
// interaction code. `pathId` on each point marker is how a deleted marker
// finds its own way out of the owning path's `pointIds` (see
// removeItemFromScene's own extension below).
function samplePathPositionLinear(pts, t, loop = false) {
  if (pts.length === 0) return new Opus.Vec3();
  if (pts.length === 1) return pts[0].clone();
  const segCount = loop ? pts.length : pts.length - 1;
  const scaled = Math.min(t, 1) * segCount;
  const i = Math.min(segCount - 1, Math.floor(scaled));
  const localT = scaled - i;
  return pts[i].add(pts[(i + 1) % pts.length].sub(pts[i]).scale(localT));
}
// Catmull-Rom (Section 55's own "then Catmull-Rom... if straightforward")
// -- the standard uniform 4-point formula, clamping the two virtual
// "before-first"/"after-last" control points to the endpoints themselves
// (no wrap) rather than requiring a real loop; a looped path instead
// samples with real wrap-around neighbors, giving a genuinely closed curve.
function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const c = (a0, a1, a2, a3) => 0.5 * ((2 * a1) + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
  return new Opus.Vec3(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y), c(p0.z, p1.z, p2.z, p3.z));
}
function samplePathPositionSmooth(pts, t, loop) {
  const n = pts.length;
  if (n < 2) return samplePathPositionLinear(pts, t);
  const segCount = loop ? n : n - 1;
  const scaled = Math.min(t, 1) * segCount;
  const i = Math.min(segCount - 1, Math.floor(scaled));
  const localT = scaled - i;
  const at = (idx) => loop ? pts[((idx % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, idx))];
  return catmullRomPoint(at(i - 1), at(i), at(i + 1), at(i + 2), localT);
}
// The ONE entry point every consumer (Follow Path movement, Populate Along
// Path, Camera Path) samples through -- `t` normalized [0,1] across the
// WHOLE path regardless of point count/spacing.
function samplePathPosition(pathItem, t) {
  const pts = (pathItem.pointIds || []).map((id) => { const p = findItemById(id); return p ? p.entity.position : null; }).filter(Boolean);
  return pathItem.smooth ? samplePathPositionSmooth(pts, t, pathItem.loop) : samplePathPositionLinear(pts, t, pathItem.loop);
}
// Path visualization -- segment-by-segment thin stretched cubes between
// CONSECUTIVE points (not all-pairs the way Waypoint connections are),
// exactly the same reusable line-drawing technique `syncWaypointConnectionLines`
// above already established. Editor-only, hidden during Play.
const pathVisualizationLines = new Map(); // "pathId:segmentIndex" -> line entity
function syncPathVisualizationLines() {
  const seen = new Set();
  for (const item of placed) {
    if (item.kind !== 'path') continue;
    const pts = (item.pointIds || []).map((id) => findItemById(id)).filter(Boolean);
    const segCount = item.loop ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i].entity.position, b = pts[(i + 1) % pts.length].entity.position;
      const key = `${item.id}:${i}`;
      seen.add(key);
      const mid = a.add(b).scale(0.5);
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
      const len = Math.hypot(dx, dy, dz);
      const angle = Math.atan2(dx, dz);
      let line = pathVisualizationLines.get(key);
      if (!line) { line = app.addEntity({ mesh: cubeMesh, color: [0.85, 0.6, 0.2], position: mid, scale: new Opus.Vec3(0.06, 0.06, Math.max(0.01, len)) }); pathVisualizationLines.set(key, line); }
      line.position.set(mid.x, mid.y, mid.z);
      line.rotationY = angle;
      line.scale.set(0.06, 0.06, Math.max(0.01, len));
      line.visible = !playMode;
    }
  }
  for (const [key, line] of pathVisualizationLines) {
    if (!seen.has(key)) { app.scene.remove(line); pathVisualizationLines.delete(key); }
  }
}
app.onUpdate(() => { syncPathVisualizationLines(); });
// Wave 8 (Priority I/Section 61, Road/Fence Tool utility gate -- built,
// clean enough not to defer): instantiates copies of a Prefab or Asset at
// even intervals along a Path -- fences, lamps, road markers, pipes.
// Reuses `scatterPlaceOne` (Wave 7 Scatter) wholesale for the actual
// placement primitive (same two-prefab-shape handling, same Asset
// fallback) -- Populate Along Path is really just Scatter with its
// candidate points sampled off a curve instead of a region, so it shares
// Scatter's own already-proven instantiation code rather than a second
// implementation. Output is ordinary placed objects (Section 61's own
// explicit requirement), wrapped in exactly ONE `pushUndo()`.
function changePathAuthoringField(pathItem, key, value, beforeChange) {
  if (playMode || !placed.includes(pathItem) || pathItem.kind !== 'path') return false;
  if (key === 'name') { if (typeof value !== 'string' || value.length > 256) return false; }
  else if ((key !== 'loop' && key !== 'smooth') || typeof value !== 'boolean') return false;
  if (pathItem[key] === value) return false;
  (beforeChange || pushUndo)(); pathItem[key] = value; return true;
}
function populateAlongPath(pathItem, config) {
  const empty = () => ({ placedCount: 0, items: [] });
  if (playMode || !placed.includes(pathItem) || pathItem.kind !== 'path' || !config) return empty();
  const spacing = config.spacing === undefined ? 2 : config.spacing;
  if (!Number.isFinite(spacing) || spacing < 0.1 || spacing > 10000) return empty();
  if (config.count !== undefined && (!Number.isInteger(config.count) || config.count < 1 || config.count > 2048)) return empty();
  if (config.scale !== undefined && (!Number.isFinite(config.scale) || config.scale < 0.05 || config.scale > 100)) return empty();
  if (!prefabs.some(p => p.name === config.prefabName) && !assets.some(a => a.id === config.assetId)) return empty();
  const pts = (pathItem.pointIds || []).map((id) => { const p = findItemById(id); return p ? p.entity.position : null; }).filter(Boolean);
  if (pts.length < 2 || pts.some(p => ![p.x,p.y,p.z].every(Number.isFinite))) return empty();
  // Total sampled length, same 40-sample approximation `followPath` already uses.
  let totalLen = 0;
  const arc = [{ t: 0, length: 0 }];
  let prev = samplePathPosition(pathItem, 0);
  for (let s = 1; s <= 40; s++) { const cur = samplePathPosition(pathItem, s / 40); totalLen += cur.sub(prev).length(); arc.push({t:s/40,length:totalLen}); prev = cur; }
  if (!Number.isFinite(totalLen) || totalLen < 1e-6) return empty();
  const count = config.count || Math.max(1, Math.floor((totalLen + 1e-8) / spacing) + (pathItem.loop ? 0 : 1));
  if (count > 2048) return empty();
  pushUndo();
  let placedCount = 0;
  let arcIndex = 1;
  const allItems = [];
  for (let i = 0; i < count; i++) {
    const fraction = pathItem.loop ? (i / count) : (count === 1 ? 0 : i / (count - 1));
    const distance = fraction * totalLen;
    while (arcIndex < arc.length - 1 && arc[arcIndex].length < distance) arcIndex++;
    const low = arc[arcIndex - 1], high = arc[arcIndex];
    const alpha = high.length > low.length ? (distance - low.length) / (high.length - low.length) : 0;
    const t = low.t + (high.t - low.t) * Math.max(0, Math.min(1, alpha));
    const pos = samplePathPosition(pathItem, t);
    // Align-to-path-direction (Section 61): a forward-difference tangent,
    // clamped at the very end of a non-looping path.
    let rotationY = 0;
    if (config.alignToPath) {
      const atEnd = !pathItem.loop && t >= 1;
      const neighbor = samplePathPosition(pathItem, atEnd ? Math.max(0, t - 0.01) : Math.min(1, t + 0.01));
      const dir = atEnd ? pos.sub(neighbor) : neighbor.sub(pos);
      if (Math.hypot(dir.x, dir.z) > 1e-5) rotationY = Math.atan2(dir.x, dir.z);
    }
    const scale = config.scale || 1;
    const newItems = scatterPlaceOne(config, pos, rotationY, scale);
    if (newItems.length) placedCount++;
    allItems.push(...newItems);
  }
  return { placedCount, items: allItems };
}
function addPathPoint(pathItem, position) {
  if (playMode || !placed.includes(pathItem) || pathItem.kind !== 'path' || !position || ![position.x,position.y,position.z].every(Number.isFinite)) return null;
  const entity = app.addEntity({ mesh: cubeMesh, color: [0.85, 0.6, 0.2], position, scale: new Opus.Vec3(0.3, 0.3, 0.3) });
  const marker = { kind: 'cube', entity, behaviors: [], isPathPoint: true, pathId: pathItem.id };
  addPlaced(marker);
  pathItem.pointIds = pathItem.pointIds || [];
  pathItem.pointIds.push(marker.id);
  return marker;
}

