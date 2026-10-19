// ===== Corner snapping (hold V) =====
// While dragging objects, hold V: the dragged object's nearest bounding-box
// corner locks onto a corner of a nearby object when they come within a few
// pixels on screen, so walls, floors and crates line up edge to edge. A
// marker shows the corner being snapped to. Works with the plain drag, the
// surface drag and the Move gizmo's plane handle.

const CORNER_SNAP_PIXELS = 16;
let cornerSnapHeld = false;
let cornerSnapMarker = null;

function boxCorners(bounds) {
  const out = [];
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) out.push(new Opus.Vec3(x, y, z));
  return out;
}
// The best (dragged corner -> other corner) pair within `pixels` on screen, or null.
// `project` maps a world point to {x, y} screen coordinates (or null).
function findCornerSnap(draggedCorners, otherCorners, project, pixels = CORNER_SNAP_PIXELS) {
  const screenA = draggedCorners.map((c) => ({ c, s: project(c) })).filter((e) => e.s);
  let best = null;
  for (const b of otherCorners) {
    const sb = project(b);
    if (!sb) continue;
    for (const a of screenA) {
      const d = Math.hypot(a.s.x - sb.x, a.s.y - sb.y);
      if (d <= pixels && (!best || d < best.distance)) best = { from: a.c, to: b, distance: d, screen: sb };
    }
  }
  return best;
}
function hideCornerSnapMarker() { if (cornerSnapMarker) cornerSnapMarker.hidden = true; }
function showCornerSnapMarker(screen) {
  if (!cornerSnapMarker) {
    cornerSnapMarker = document.createElement('div');
    cornerSnapMarker.id = 'corner-snap-marker';
    document.body.appendChild(cornerSnapMarker);
  }
  cornerSnapMarker.hidden = false;
  cornerSnapMarker.style.left = `${screen.x}px`;
  cornerSnapMarker.style.top = `${screen.y}px`;
}

function applyCornerSnap(state) {
  if (!state || !state.items || playMode) return false;
  const entries = state.items.filter((entry) => entry.item && entry.item.entity && placed.includes(entry.item) && typeof surfaceRestableItem === 'function' && surfaceRestableItem(entry.item));
  // The plain drag only sets X/Z, so remember each object's height before any snap changed it.
  for (const entry of entries) if (entry.cornerBaseY === undefined) entry.cornerBaseY = entry.item.entity.position.y;
  if (!Number.isFinite(state.primaryBottomOffset)) for (const entry of entries) entry.item.entity.position.y = entry.cornerBaseY;
  if (!cornerSnapHeld || !entries.length) { hideCornerSnapMarker(); return false; }
  const primary = entries.find((entry) => entry.item === state.primary) || entries[0];
  const bounds = surfaceWorldBounds(primary.item.entity);
  if (!bounds) { hideCornerSnapMarker(); return false; }
  const excluded = surfaceExclusionsFor(entries.map((entry) => entry.item));
  const centre = primary.item.entity.position, reach = 30 + Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
  const others = [];
  for (const item of placed) {
    if (excluded.has(item) || !surfaceRestableItem(item) || item.entity.visible === false) continue;
    const b = surfaceWorldBounds(item.entity);
    if (!b) continue;
    const mid = new Opus.Vec3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    if (mid.sub(centre).length() > reach) continue;
    others.push(...boxCorners(b));
  }
  const snap = findCornerSnap(boxCorners(bounds), others, worldToScreen);
  if (!snap) { hideCornerSnapMarker(); return false; }
  const delta = snap.to.sub(snap.from);
  if (!state.moved) { pushUndo(); state.moved = true; }
  for (const entry of entries) entry.item.entity.position = entry.item.entity.position.add(delta);
  if (typeof syncSelectionMarkers === 'function') syncSelectionMarkers();
  showCornerSnapMarker(snap.screen);
  return true;
}

window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyV' || event.repeat || playMode || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  cornerSnapHeld = true;
});
window.addEventListener('keyup', (event) => { if (event.code === 'KeyV') { cornerSnapHeld = false; hideCornerSnapMarker(); } });
window.addEventListener('blur', () => { cornerSnapHeld = false; hideCornerSnapMarker(); });
window.addEventListener('pointerup', hideCornerSnapMarker);
