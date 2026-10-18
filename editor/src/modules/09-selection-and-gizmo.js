// --- Selection ---

let justDragged = false;

canvas.addEventListener('click', (e) => {
  if (justDragged) { justDragged = false; return; }
  const hit = pickEntity(e.clientX, e.clientY);
  if (playMode) {
    if (hit) runBehaviors(hit, 'click');
    return;
  }
  if (hit) selectItem(hit, e.shiftKey);
  else if (!e.shiftKey) deselectAll();
});
// 'click' itself is left as-is: it already fires for a tap the same way it
// fires for a mouse click (browsers synthesize it from either), so nothing
// here needed to change for touch.

// --- Drag to move (viewport reposition) ---
// The inspector's number fields cover precise editing, but nudging a crate
// (or an island) a few units over meant typing three values instead of just
// dragging it -- the actual reason editing "still felt number-field-based".
// Cubes and terrain both support it; water stays number-field-only since
// it's excluded from raycast picking entirely (see pickEntity above).
//
// Terrain is cheaper to drag than it looks: the renderer applies a
// terrain's `position` as a draw-time translation (Mat4.translation) over
// mesh geometry that's already in local coordinates -- see
// engine/src/09-renderer.js's renderTerrain -- so moving it needs no mesh
// regeneration, just like a cube's position.x/z. The one thing that isn't
// free: `item.handle.position` (what rendering/sampleHeight/sampleNormal
// read) and `item.options.position` (what Physics.resolveTerrainCollision
// and the inspector's Seed/Size/Radius regenerate-on-edit read) are two
// separate Vec3 objects, not one -- both must be kept in sync or dragging
// would silently desync collision from what's rendered (the exact class of
// bug friction #15 was about), or a later Size/Radius edit would snap the
// terrain back to its pre-drag spot.
let dragState = null;
let gizmoDragState = null;

// Gizmos 2.0: which transform the on-screen gizmo currently manipulates,
// Optional bounded snapping, off by default. Increments are local authoring
// preferences, not gameplay/project data; old enabled-only preferences migrate.
let gizmoMode = 'move'; // 'move' | 'rotate' | 'scale'
// Wave 6 (Priority J): Local/World gizmo mode -- scoped to the MOVE gizmo
// only, per its own named case. Scale is deliberately left untouched:
// `entity.scale` is inherently a LOCAL-space field in this engine's
// TRS composition (Mat4.compose applies scale before rotation), so
// "world-space non-uniform scale" has no clean, safe meaning to add a
// second mode for without risking a real behavior change to the Scale
// gizmo's existing (pre-Wave-6) drag math -- out of this priority's own
// bounded scope. Rotate is also left untouched (always rotates around
// world X/Y/Z) for the same "don't touch what isn't the named case"
// reasoning.
let gizmoSpace = 'world'; // 'world' | 'local'
function normalizeGizmoSnapSettings(value) {
  const v=value&&typeof value==='object'?value:{},bounded=(n,min,max,fallback)=>
    typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
  return {enabled:v.enabled===true,position:bounded(v.position,.01,1000,1),
    rotationDegrees:bounded(v.rotationDegrees,.1,180,15),scale:bounded(v.scale,.01,10,.25)};
}
const gizmoSnap = normalizeGizmoSnapSettings(null);
try {
  const savedSnap = JSON.parse(localStorage.getItem('opus-gizmo-snap') || 'null');
  Object.assign(gizmoSnap,normalizeGizmoSnapSettings(savedSnap));
} catch (err) { /* ignore corrupt value, keep default */ }
function saveGizmoSnapSetting() { try { localStorage.setItem('opus-gizmo-snap', JSON.stringify(gizmoSnap)); } catch(err) { /* blocked storage: session preference still works */ } }
function changeGizmoSnapSetting(field,value) {
  if(playMode||!['enabled','position','rotationDegrees','scale'].includes(field))return false;
  if(field==='enabled') { if(typeof value!=='boolean')return false; }
  else {
    const bounds={position:[.01,1000],rotationDegrees:[.1,180],scale:[.01,10]}[field];
    if(typeof value!=='number'||!Number.isFinite(value)||value<bounds[0]||value>bounds[1])return false;
  }
  if(gizmoSnap[field]===value)return false;
  gizmoSnap[field]=value;saveGizmoSnapSetting();return true;
}
function snapValue(v, increment) { return increment > 0 ? Math.round(v / increment) * increment : v; }

// Quantize one shared displacement, not each object's absolute position:
// modular assemblies retain their authored offsets, like the Move gizmo.
function applyGroundDragMovement(state, dx, dz) {
  if (playMode || !state || !Number.isFinite(dx) || !Number.isFinite(dz)) return false;
  if (gizmoSnap.enabled) { dx = snapValue(dx, gizmoSnap.position); dz = snapValue(dz, gizmoSnap.position); }
  const changes = [];
  for (const { item, startX, startZ } of state.items || []) {
    if (!placed.includes(item) || !Number.isFinite(startX) || !Number.isFinite(startZ)) continue;
    const p = item.kind === 'terrain' ? item.handle?.position :
      ['cube','sprite','tilemap'].includes(item.kind) ? item.entity?.position : null;
    if (!p) continue;
    const x = startX + dx, z = startZ + dz;
    if (p.x !== x || p.z !== z) changes.push({item,p,x,z});
  }
  if (!changes.length) return false;
  if (!state.moved) { pushUndo(); state.moved = true; }
  for (const {item,p,x,z} of changes) {
    p.x = x; p.z = z;
    if (item.kind === 'terrain') item.options.position.set(x,p.y,z);
  }
  return true;
}

function applyGizmoMoveMovement(state, delta) {
  if(playMode||!state||!Number.isFinite(delta)||!state.axisVec||
    !['x','y','z'].every(k=>Number.isFinite(state.axisVec[k])))return false;
  const changes=[];
  for(const {item,startPos}of state.items||[]) {
    if(!placed.includes(item)||!startPos||!['x','y','z'].every(k=>Number.isFinite(startPos[k])))continue;
    const p=item.kind==='terrain'?item.handle?.position:['cube','sprite','tilemap','light'].includes(item.kind)?item.entity?.position:null;
    if(!p)continue;
    const xyz=['x','y','z'].map(k=>startPos[k]+state.axisVec[k]*delta);
    if(xyz.some((v,i)=>v!==p[['x','y','z'][i]]))changes.push({item,p,xyz});
  }
  if(!changes.length)return false;
  if(!state.moved){pushUndo();state.moved=true;}
  for(const {item,p,xyz}of changes){p.set(...xyz);if(item.kind==='terrain')item.options.position.set(...xyz);}
  return true;
}

function commitGizmoTransformChanges(state, proposals) {
  if(playMode||!state||!Array.isArray(proposals)||!proposals.length)return false;
  const changes=[];
  for(const change of proposals){
    const {item}=change;
    if(!placed.includes(item)||!item.entity)return false;
    let changed=false;
    for(const field of ['position','scale','quaternion'])if(change[field]){
      const keys=field==='quaternion'?['x','y','z','w']:['x','y','z'];
      if(!keys.every(k=>Number.isFinite(change[field][k]))||
        field==='scale'&&keys.some(k=>change[field][k]<.05))return false;
      if(keys.some(k=>Math.abs(item.entity[field][k]-change[field][k])>1e-10))changed=true;
    }
    if(changed)changes.push(change);
  }
  if(!changes.length)return false;
  if(!state.moved){pushUndo();state.moved=true;}
  for(const {item,position,scale,quaternion}of changes){
    if(position)item.entity.position.set(position.x,position.y,position.z);
    if(scale)item.entity.scale.set(scale.x,scale.y,scale.z);
    if(quaternion)item.entity.quaternion=quaternion;
  }
  return true;
}

// --- Marquee (rectangle) select ---
// A mousedown that starts on empty space -- nothing for the object-drag
// above to grab -- becomes a marquee instead of doing nothing. Needs
// worldToScreen (defined above) to test which items' positions fall inside
// the screen-space rectangle once the drag ends; terrain/cubes only, same
// set pickEntity itself considers (water excluded for the same reason).
let marqueeState = null;
const marqueeBox = document.getElementById('marquee-box');

function marqueeableItems() {
  return placed.filter((item) => item.kind === 'cube' || item.kind === 'sprite' || item.kind === 'tilemap' || item.kind === 'terrain');
}

// Built on Pointer Events (not mouse events) so the exact same code drives
// object-drag and marquee-select from touch, not just a mouse -- and
// `activePointerId` makes sure a second finger touching down mid-gesture
// (or a second simultaneous pointer of any kind) can't hijack or corrupt an
// already-running drag/marquee.
let activePointerId = null;

// The engine's own camera-orbit-drag listens on the same canvas via
// Pointer Events too (Input, engine/src/04-input.js), and a real pointer
// click/touch fires those events regardless of what else is also
// listening. Left alone, every drag/marquee gesture here also accumulates
// into Input's pending orbit-drag delta, which would jump the camera the
// next time it's consumed -- draining it every tick an editor-owned
// gesture is in progress keeps that delta at zero for the whole gesture.
function suppressCameraDrag() { app.input.consumeDrag(); }

canvas.addEventListener('pointerdown', (e) => {
  // Secondary/middle gestures belong to viewport navigation, never object,
  // gizmo, placement or brush authoring. Touch and primary pen remain button0.
  if (playMode || activePointerId !== null || e.button !== 0) return;
  if (armedPlacementPayload) {
    const placement = screenToPlacementPoint(armedPlacementPayload,e.clientX,e.clientY);
    if (!placement) { showStatus('No valid placement point under the cursor'); return; }
    const payload = armedPlacementPayload;
    cancelPlacementInteraction();
    commitPlacementPayload(payload,placement.point,placement);
    justDragged = true; // consume the synthetic click following this placement
    suppressCameraDrag();
    e.preventDefault();
    return;
  }
  // Wave 9C: Scatter Brush takes over the canvas entirely while a mode is
  // selected (checked first, same "one brush mode at a time" precedent
  // Sculpt/Terrain-Paint below already established).
  if (scatterBrushMode) {
    const layer = findScatterLayerById(selectedScatterLayerId);
    if (!layer) { showStatus('Select or create a Scatter Layer first'); return; }
    const point = screenToGroundPoint(e.clientX, e.clientY);
    if (!point) return;
    activePointerId = e.pointerId;
    scatterBrushDragState = { layer, dabIndex: 0, lastPoint: point, placedCount: 0, removedCount: 0, strokeStarted: false };
    suppressCameraDrag();
    if (scatterBrushMode === 'paint') scatterBrushDragState.placedCount += applyScatterBrushPaint(layer, point);
    else scatterBrushDragState.removedCount += applyScatterBrushErase(layer, point);
    renderSceneList();
    e.preventDefault();
    return;
  }
  // Sculpt mode takes over the canvas entirely while active (checked before
  // gizmo/pick/drag/marquee) -- Pointer Events, so mouse/pen/touch all drive
  // the identical code path, same architecture as every other viewport
  // gesture in this editor.
  if (sculptMode && selectedItem && selectedItem.kind === 'terrain') {
    const point = screenToGroundPoint(e.clientX, e.clientY);
    if (!point) return;
    activePointerId = e.pointerId;
    sculptDragState = { item: selectedItem, strokeStarted: false };
    suppressCameraDrag();
    // The first changing dab owns history; outside/no-op strokes must not
    // allocate a height grid or consume Undo.
    applySculptBrush(selectedItem, point, true);
    e.preventDefault();
    return;
  }
  // Terrain Painting (Priority G) -- the exact same gesture shape as
  // sculpt mode above, mutually exclusive with it (only one brush mode is
  // ever active at a time).
  if (paintMode && selectedItem && selectedItem.kind === 'terrain') {
    const point = screenToGroundPoint(e.clientX, e.clientY);
    if (!point) return;
    activePointerId = e.pointerId;
    paintDragState = { item: selectedItem, strokeStarted: false };
    suppressCameraDrag();
    applyPaintBrush(selectedItem, point);
    e.preventDefault();
    return;
  }
  // Checked before pickEntity/marquee -- a gizmo handle sits in front of
  // (or extends past) whatever's selected, so it must win the hit-test
  // first or clicking it would just re-select/drag the object underneath.
  const gizmoAxis = pickGizmoHandle(e.clientX, e.clientY);
  if (gizmoAxis === 'rx' || gizmoAxis === 'ry' || gizmoAxis === 'rz') {
    const axisInfo = GIZMO_ROTATE_AXES.find((a) => a.axis === gizmoAxis);
    // Wave 6B (Priority L): multi-select Rotate -- `items` covers every
    // selection ROOT (selectionRoots filters out a child whose parent is
    // also selected, see that function's own comment). Pivot defaults to
    // the roots' own position average ("Selection Center"). For a single
    // selected object this reduces to exactly the old single-object
    // behavior: pivot === that object's own position, so "orbit around the
    // pivot" is a no-op and only its own orientation rotates in place --
    // one shared code path serves both cases, not two.
    const rootItems = selectionRoots(selectedItems).filter((item) => item.kind === 'cube' || item.kind === 'sprite' || item.kind === 'tilemap');
    const items = rootItems.map((item) => ({ item, startPos: itemPosition(item).clone(), startQuat: item.entity.quaternion.clone() }));
    const pivot = items.reduce((sum, r) => sum.add(r.startPos), new Opus.Vec3()).scale(1 / Math.max(1, items.length));
    // The grab-time angle is established HERE, from the actual pointerdown
    // position, not lazily on the first pointermove -- doing it lazily
    // silently dropped the very first move's angular delta (its "before"
    // sample would have been null), found by dragging a ring end-to-end and
    // measuring a smaller total rotation than the mouse actually swept.
    const grabPoint = screenToPlanePoint(e.clientX, e.clientY, pivot, axisInfo.dir);
    activePointerId = e.pointerId;
    gizmoDragState = {
      type: 'rotate',
      items,
      axisInfo,
      pivot,
      lastAngle: grabPoint ? Math.atan2(grabPoint.sub(pivot).dot(axisInfo.v), grabPoint.sub(pivot).dot(axisInfo.u)) : null,
      totalAngle: 0,
      moved: false,
    };
    suppressCameraDrag();
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (gizmoAxis === 'uniform') {
    // Wave 6B (Priority L): multi-select Uniform Scale -- same
    // selectionRoots parent/child correctness filter Rotate above uses.
    // Each root's own scale multiplies by the drag ratio (identical to the
    // pre-Priority-L single-object math) AND its position is pulled toward/
    // pushed away from the group pivot by that SAME ratio, so the group
    // visibly scales as one coherent whole rather than every object just
    // growing in place independently. A single-object selection has
    // pivot === that object's own position, so the position term is
    // mathematically zero -- bit-exact with the old single-object behavior.
    const rootItems = selectionRoots(selectedItems).filter((item) => item.kind === 'cube' || item.kind === 'sprite' || item.kind === 'tilemap');
    const items = rootItems.map((item) => ({ item, startPos: itemPosition(item).clone(), startScale: item.entity.scale.clone() }));
    const pivot = items.reduce((sum, r) => sum.add(r.startPos), new Opus.Vec3()).scale(1 / Math.max(1, items.length));
    activePointerId = e.pointerId;
    gizmoDragState = {
      type: 'scaleUniform',
      items,
      pivot,
      grabClientX: e.clientX,
      grabClientY: e.clientY,
      moved: false,
    };
    suppressCameraDrag();
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (gizmoAxis === 'sx' || gizmoAxis === 'sy' || gizmoAxis === 'sz') {
    const axisInfo = GIZMO_SCALE_AXES.find((a) => a.axis === gizmoAxis);
    // Wave 6B (Priority L): multi-select per-axis Scale -- same
    // selectionRoots filter, but deliberately bounded to just each root's
    // OWN scale component (an additive delta, matching the pre-Priority-L
    // single-object math exactly): positions are left unchanged. Scaling
    // group POSITIONS apart along a single world axis (as opposed to
    // uniformly, which the pivot-relative math above already covers) is a
    // real but genuinely separate feature with its own ambiguous "what
    // should this look like" design questions -- not built this pass to
    // avoid scope creep past what the spec actually asked for.
    const rootItems = selectionRoots(selectedItems).filter((item) => item.kind === 'cube' || item.kind === 'sprite' || item.kind === 'tilemap');
    activePointerId = e.pointerId;
    gizmoDragState = {
      type: 'scaleAxis',
      axisVec: axisInfo.dir,
      axisComponent: gizmoAxis.slice(1), // 'x' | 'y' | 'z'
      items: rootItems.map((item) => ({ item, startScale: item.entity.scale.clone() })),
      itemPos: itemPosition(selectedItem).clone(),
      grabClientX: e.clientX,
      grabClientY: e.clientY,
      moved: false,
    };
    suppressCameraDrag();
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (gizmoAxis) {
    activePointerId = e.pointerId;
    gizmoDragState = {
      type: 'move',
      axisVec: moveAxisWorldDir(gizmoAxis),
      items: [...selectedItems].filter((item) => item.kind === 'cube' || item.kind === 'sprite' || item.kind === 'tilemap' || item.kind === 'terrain' || item.kind === 'light').map((item) => ({ item, startPos: itemPosition(item).clone() })),
      grabClientX: e.clientX,
      grabClientY: e.clientY,
      moved: false,
    };
    suppressCameraDrag();
    canvas.style.cursor = 'grabbing';
    return;
  }
  const hit = pickEntity(e.clientX, e.clientY);
  if (!hit) {
    activePointerId = e.pointerId;
    marqueeState = { startX: e.clientX, startY: e.clientY, additive: e.shiftKey, moved: false };
    suppressCameraDrag();
    return;
  }
  const point = screenToGroundPoint(e.clientX, e.clientY);
  if (!point) return;

  if (e.shiftKey) {
    selectItem(hit, true); // shift-click only toggles selection, it doesn't start a drag
    return;
  }
  // Dragging an item that's already part of the current multi-selection
  // moves the whole group, keeping the rest of the selection intact.
  // Dragging anything else collapses the selection down to just that item
  // first, matching plain-click's replace behavior.
  if (!selectedItems.has(hit)) selectItem(hit);

  activePointerId = e.pointerId;
  dragState = {
    items: [...selectedItems].map((item) => {
      const pos = itemPosition(item);
      return { item, startX: pos.x, startZ: pos.z };
    }),
    grabStartX: point.x,
    grabStartZ: point.z,
    moved: false,
  };
  suppressCameraDrag();
  canvas.style.cursor = 'grabbing';
});

// Cursor feedback doubles as the only hint that an object *can* be dragged
// at all -- nothing else in the viewport signals it. 'grab' over a
// draggable item, 'grabbing' while actually dragging, default otherwise.
// (Touch has no hover state to show it in, but the cost of computing it is
// the same either way, so this doesn't need a touch-specific branch.)
canvas.addEventListener('pointermove', (e) => {
  if (scatterBrushDragState) {
    if (e.pointerId !== activePointerId) return;
    suppressCameraDrag();
    const point = screenToGroundPoint(e.clientX, e.clientY);
    if (point) {
      const { layer, lastPoint } = scatterBrushDragState;
      // Bounded step cadence (Section 11's "one drag = one Undo," and this
      // project's standing "no once-per-frame flood" rule) -- a new dab
      // only fires once the pointer has moved a meaningful fraction of the
      // brush's own radius since the last one, not on every single
      // pointermove event a fast mouse can fire dozens of per second.
      if (Math.hypot(point.x - lastPoint.x, point.z - lastPoint.z) >= layer.brushRadius * 0.4) {
        scatterBrushDragState.lastPoint = point;
        if (scatterBrushMode === 'paint') scatterBrushDragState.placedCount += applyScatterBrushPaint(layer, point);
        else scatterBrushDragState.removedCount += applyScatterBrushErase(layer, point);
        renderSceneList();
      }
      syncScatterBrushMarker(point, layer.brushRadius, true);
    }
    e.preventDefault();
    return;
  }
  if (sculptDragState) {
    if (e.pointerId !== activePointerId) return;
    suppressCameraDrag();
    const point = screenToGroundPoint(e.clientX, e.clientY);
    if (point) applySculptBrush(sculptDragState.item, point, false);
    e.preventDefault();
    return;
  }
  if (paintDragState) {
    if (e.pointerId !== activePointerId) return;
    suppressCameraDrag();
    const point = screenToGroundPoint(e.clientX, e.clientY);
    if (point) applyPaintBrush(paintDragState.item, point);
    e.preventDefault();
    return;
  }
  if (gizmoDragState) {
    if (e.pointerId !== activePointerId) return;
    suppressCameraDrag();
    if (gizmoDragState.type === 'rotate') {
      // Angle within the ring's OWN plane (perpendicular to its axis, not
      // always the ground plane the way the old Y-only gizmo assumed) --
      // screenToPlanePoint generalizes screenToGroundPoint to an arbitrary
      // plane. u/v are the same right-handed basis pickGizmoHandle/syncGizmo
      // already use to draw and pick the ring, so the drag direction always
      // agrees with what's on screen for all three axes, not just Y.
      const { dir, u, v } = gizmoDragState.axisInfo;
      const point = screenToPlanePoint(e.clientX, e.clientY, gizmoDragState.pivot, dir);
      if (point) {
        const delta = point.sub(gizmoDragState.pivot);
        if (delta.length() > 0.05) {
          const angle = Math.atan2(delta.dot(v), delta.dot(u));
          if (gizmoDragState.lastAngle !== null) {
            // Shortest-path delta between successive angles (handles the
            // -PI/+PI wraparound as the cursor sweeps past the seam) --
            // accumulated into totalAngle rather than re-deriving a single
            // absolute angle each move, since "absolute angle around this
            // ring" isn't well-defined once you've gone around more than once.
            let step = angle - gizmoDragState.lastAngle;
            if (step > Math.PI) step -= Math.PI * 2;
            if (step < -Math.PI) step += Math.PI * 2;
            gizmoDragState.totalAngle += step;
          }
          gizmoDragState.lastAngle = angle;
          let applied = gizmoDragState.totalAngle;
          if (gizmoSnap.enabled) {
            const stepRad = gizmoSnap.rotationDegrees * Math.PI / 180;
            applied = snapValue(applied, stepRad);
          }
          // World-space rotation: the new orientation is "rotate by `applied`
          // around this axis in WORLD space, THEN apply whatever the object's
          // orientation already was at grab time" -- composed on the LEFT of
          // the starting quaternion, matching how worldMatrix = parent*local
          // already composes (the axis ring itself is drawn in world axes,
          // not the object's own local axes, so this is the reading that
          // matches what the user sees on screen).
          // Wave 6B (Priority L): each selection root's OWN orientation
          // rotates (same math as before) AND its position orbits the
          // group's pivot by the same angle -- for a single-object selection
          // (pivot === that object's own startPos) the orbit term is
          // mathematically zero, so this is bit-exact with the pre-Priority-L
          // single-object behavior in that case.
          const rot = Opus.Quat.fromAxisAngle(dir, applied);
          commitGizmoTransformChanges(gizmoDragState,gizmoDragState.items.map(({item,startPos,startQuat})=>({
            item,quaternion:rot.multiply(startQuat),
            position:gizmoDragState.pivot.add(rot.rotateVec3(startPos.sub(gizmoDragState.pivot)))
          })));
        }
      }
      syncGizmo();
      return;
    }
    // Same screen-space axis projection as Move below, applied to one scale
    // component instead of one position component -- floored so an object
    // can't be dragged to zero/negative scale (which would collapse it and
    // make it unpickable to drag back out).
    if (gizmoDragState.type === 'scaleAxis' || gizmoDragState.type === 'scaleUniform') {
      const projectDir = gizmoDragState.type === 'scaleUniform' ? GIZMO_UNIFORM_OFFSET.normalize() : gizmoDragState.axisVec;
      const projectOrigin = gizmoDragState.type === 'scaleUniform' ? gizmoDragState.pivot : gizmoDragState.itemPos;
      const originScreen = worldToScreen(projectOrigin);
      const axisScreen = worldToScreen(projectOrigin.add(projectDir));
      if (originScreen && axisScreen) {
        const sdx = axisScreen.x - originScreen.x;
        const sdy = axisScreen.y - originScreen.y;
        const denom = sdx * sdx + sdy * sdy;
        if (denom > 1e-6) {
          const mdx = e.clientX - gizmoDragState.grabClientX;
          const mdy = e.clientY - gizmoDragState.grabClientY;
          const worldDelta = (mdx * sdx + mdy * sdy) / denom;
          const MIN_SCALE = 0.05;
          if (gizmoDragState.type === 'scaleUniform') {
            // Wave 6B (Priority L): ratio is computed once off the FIRST
            // root (matching the pre-Priority-L single-object read of
            // `startScale.x`) then applied identically to every root's own
            // scale AND to its position offset from the pivot -- see this
            // drag state's own mousedown comment for why that's bit-exact
            // with the old single-object behavior when there's only one root.
            const first = gizmoDragState.items[0];
            if (!first) { syncGizmo(); return; }
            const s = gizmoSnap.enabled
              ? Math.max(MIN_SCALE, snapValue(Math.max(MIN_SCALE, first.startScale.x + worldDelta), gizmoSnap.scale))
              : Math.max(MIN_SCALE, first.startScale.x + worldDelta);
            const ratio = s / Math.max(MIN_SCALE, first.startScale.x);
            commitGizmoTransformChanges(gizmoDragState,gizmoDragState.items.map(({item,startPos,startScale})=>({
              item,scale:new Opus.Vec3(
                Math.max(MIN_SCALE, startScale.x * ratio),
                Math.max(MIN_SCALE, startScale.y * ratio),
                Math.max(MIN_SCALE, startScale.z * ratio),
              ),position:gizmoDragState.pivot.add(startPos.sub(gizmoDragState.pivot).scale(ratio))
            })));
          } else {
            const key = gizmoDragState.axisComponent;
            const proposals=[];
            for (const { item, startScale } of gizmoDragState.items) {
              let v = Math.max(MIN_SCALE, startScale[key] + worldDelta);
              if (gizmoSnap.enabled) v = Math.max(MIN_SCALE, snapValue(v, gizmoSnap.scale));
              const next = item.entity.scale.clone();
              next[key] = v;
              proposals.push({item,scale:next});
            }
            commitGizmoTransformChanges(gizmoDragState,proposals);
          }
        }
      }
      syncGizmo();
      return;
    }
    // Classic screen-space axis projection: two world points one axis-unit
    // apart, projected to screen, give both the 2D drag direction AND (via
    // that projected segment's own pixel length) how many screen pixels
    // correspond to one world unit at the primary item's depth -- from
    // there, projecting the mouse's own screen delta onto that same
    // direction and dividing out the pixels-per-unit converts back to a
    // world-space distance along the axis. Computed fresh from the FIXED
    // grab-start position (not live current position) so a used camera
    // orbit mid-drag couldn't ever feed back into itself.
    const primary = gizmoDragState.items.find((i) => i.item === selectedItem) || gizmoDragState.items[0];
    if (primary) {
      const originScreen = worldToScreen(primary.startPos);
      const axisScreen = worldToScreen(primary.startPos.add(gizmoDragState.axisVec));
      if (originScreen && axisScreen) {
        const sdx = axisScreen.x - originScreen.x;
        const sdy = axisScreen.y - originScreen.y;
        const denom = sdx * sdx + sdy * sdy;
        if (denom > 1e-6) {
          const mdx = e.clientX - gizmoDragState.grabClientX;
          const mdy = e.clientY - gizmoDragState.grabClientY;
          let worldDelta = (mdx * sdx + mdy * sdy) / denom;
          if (gizmoSnap.enabled) worldDelta = snapValue(worldDelta, gizmoSnap.position);
          applyGizmoMoveMovement(gizmoDragState, worldDelta);
        }
      }
    }
    syncGizmo();
    return;
  }
  if (marqueeState) {
    if (e.pointerId !== activePointerId) return;
    suppressCameraDrag();
    const dx = e.clientX - marqueeState.startX;
    const dy = e.clientY - marqueeState.startY;
    if (!marqueeState.moved && Math.hypot(dx, dy) > 4) marqueeState.moved = true;
    if (marqueeState.moved) {
      const wrapRect = marqueeBox.parentElement.getBoundingClientRect();
      const left = Math.min(marqueeState.startX, e.clientX) - wrapRect.left;
      const top = Math.min(marqueeState.startY, e.clientY) - wrapRect.top;
      marqueeBox.style.left = `${left}px`;
      marqueeBox.style.top = `${top}px`;
      marqueeBox.style.width = `${Math.abs(dx)}px`;
      marqueeBox.style.height = `${Math.abs(dy)}px`;
      marqueeBox.classList.add('active');
    }
    return;
  }
  if (!dragState) {
    if (playMode) return;
    canvas.style.cursor = pickEntity(e.clientX, e.clientY) ? 'grab' : '';
    return;
  }
  if (e.pointerId !== activePointerId) return;
  const point = screenToGroundPoint(e.clientX, e.clientY);
  if (!point) return;
  // A single shared delta (from the grab point) applied to each item's own
  // start position -- not a per-item grab offset -- so a group of several
  // objects moves as one rigid formation instead of all snapping to the
  // same spot. For a single selected item this reduces to exactly the same
  // math the original single-item drag used.
  const dx = point.x - dragState.grabStartX;
  const dz = point.z - dragState.grabStartZ;
  suppressCameraDrag(); // Own the gesture even while a sub-grid displacement is unchanged.
  applyGroundDragMovement(dragState, dx, dz);
});

window.addEventListener('pointerup', (e) => {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  suppressCameraDrag();
  if (sculptDragState) finishTerrainSculptGesture();
  if (paintDragState) finishTerrainPaintGesture();
  if (scatterBrushDragState) finishScatterBrushGesture();
  if (marqueeState) {
    if (marqueeState.moved) {
      const x0 = Math.min(marqueeState.startX, e.clientX);
      const x1 = Math.max(marqueeState.startX, e.clientX);
      const y0 = Math.min(marqueeState.startY, e.clientY);
      const y1 = Math.max(marqueeState.startY, e.clientY);
      const hits = marqueeableItems().filter((item) => {
        const screen = worldToScreen(itemPosition(item));
        return screen && screen.x >= x0 && screen.x <= x1 && screen.y >= y0 && screen.y <= y1;
      });
      if (!marqueeState.additive) { selectedItems.clear(); }
      for (const item of hits) selectedItems.add(item);
      selectedItem = hits.length ? hits[hits.length - 1] : (selectedItems.size ? [...selectedItems].pop() : null);
      syncSelectionMarkers();
      renderInspector();
      renderSceneList();
      justDragged = true;
    }
    marqueeBox.classList.remove('active');
    marqueeState = null;
  }
  if (dragState && dragState.moved) {
    justDragged = true;
    renderInspector();
    renderSceneList();
  }
  dragState = null;
  if (gizmoDragState) {
    // A snapped no-op still belongs to the handle, not the empty canvas;
    // otherwise the synthesized click clears selection after release.
    justDragged = true;
    if (gizmoDragState.moved) { renderInspector(); renderSceneList(); }
  }
  gizmoDragState = null;
  if (!playMode) canvas.style.cursor = pickEntity(e.clientX, e.clientY) ? 'grab' : '';
});

// additive=true (shift-click) toggles `item` in/out of the selection
// instead of replacing it. selectedItem always tracks the last item
// clicked/toggled -- null only once selectedItems is empty.
function selectItem(item, additive = false) {
  if (tilemapTool && (!item || item.kind !== 'tilemap')) setTilemapTool(null);
  if (additive) {
    if (selectedItems.has(item)) {
      selectedItems.delete(item);
      selectedItem = selectedItems.size ? [...selectedItems].pop() : null;
    } else {
      selectedItems.add(item);
      selectedItem = item;
    }
  } else {
    selectedItems.clear();
    // Clicking (or drag-grabbing) any one grouped member selects the whole
    // group -- this, not anything about how dragging itself works, is what
    // makes Group meaningfully different from just multi-selecting the same
    // items again by hand every time.
    if (item.groupId) {
      for (const p of placed) if (p.groupId === item.groupId) selectedItems.add(p);
    } else {
      selectedItems.add(item);
    }
    selectedItem = item;
  }
  syncSelectionMarkers();
  renderInspector();
  renderSceneList();
  // Selecting something should surface its controls immediately, not leave
  // the user on whatever right-side tab they happened to be looking at --
  // but only jump TO Inspector, never fight a deliberate switch away from it
  // while nothing is selected (deselectAll doesn't call this).
  if (typeof activateTab === 'function') activateTab('right-tab', 'inspector');
  // On a narrow/tablet screen the right panel is an off-canvas drawer (see
  // the @media rule) -- tapping an object in the viewport should reveal the
  // Inspector automatically, the same as it does inline at desktop widths,
  // instead of silently updating a drawer the user can't currently see.
  if (typeof setNarrowPanel === 'function') setNarrowPanel('right-panel', true);
}

function deselectAll() {
  if (tilemapTool) setTilemapTool(null);
  selectedItem = null;
  selectedItems.clear();
  syncSelectionMarkers();
  renderInspector();
  renderSceneList();
}

// One marker entity per selected item, reused across renders rather than
// destroyed/recreated -- pooled the same way the original single marker was.
function syncSelectionMarkers() {
  for (const [item, marker] of selectionMarkers) {
    if (!selectedItems.has(item)) {
      app.scene.remove(marker);
      selectionMarkers.delete(item);
    }
  }
  for (const item of selectedItems) {
    if (selectionMarkers.has(item)) continue;
    const pos = itemPosition(item);
    const marker = app.addEntity({ mesh: cubeMesh, color: [0.3, 1, 0.5], position: pos.clone(), scale: new Opus.Vec3(1, 0.05, 1) });
    selectionMarkers.set(item, marker);
  }
  syncGizmo();
  syncLightConeViz();
  syncSpriteDirectManipulation();
  syncTilemapOverlay();
}

// --- Transform gizmo (Move / Rotate / Scale) ---
// Three colored handles (X red, Y green, Z blue) at the primary selection's
// position, built from cubeMesh scaled thin+long along one axis -- no
// custom geometry needed, the same "reuse what already exists" approach as
// the earlier hazard/boost meshes. Only ONE mode's handles exist in the
// scene at a time (gizmoMode selects which) -- Move and Scale reuse the
// exact same axis geometry/pick math, just interpreted as a different
// transform and drawn in a dimmer shade for Scale so they're visually
// distinct even though they occupy the same screen position.
const GIZMO_LENGTH = 2.2;
const GIZMO_THICKNESS = 0.16;
const GIZMO_GAP = 0.5;
const GIZMO_MOVE_AXES = [
  { axis: 'x', dir: new Opus.Vec3(1, 0, 0), color: [0.95, 0.25, 0.25] },
  { axis: 'y', dir: new Opus.Vec3(0, 1, 0), color: [0.3, 0.9, 0.35] },
  { axis: 'z', dir: new Opus.Vec3(0, 0, 1), color: [0.3, 0.55, 0.95] },
];
// Wave 6 (Priority J): the ONE place that resolves a Move axis entry's
// WORLD-space direction, reading `gizmoSpace` -- every render/pick/drag-init
// call site below calls this instead of reading `.dir` directly, so all
// three stay trivially in sync with the toggle. In 'world' mode (the
// default, and the only mode any project saved before this priority ever
// used) this returns the exact same fixed unit vector `.dir` already was --
// bit-identical behavior. In 'local' mode it returns the SELECTED item's
// own current rotated axis (`entity.right`/`.up`/`.forward`, all public
// since Wave 5's full-XYZ orientation work) -- an object with no
// orientation change (identity quaternion) still gets the exact same
// world-aligned handles either way, so a never-rotated object's Move gizmo
// is unaffected by which mode is active.
function moveAxisWorldDir(axisLetter) {
  if (gizmoSpace === 'local' && selectedItem && selectedItem.entity) {
    const e = selectedItem.entity;
    return axisLetter === 'x' ? e.right : axisLetter === 'y' ? e.up : e.forward;
  }
  const entry = GIZMO_MOVE_AXES.find((a) => a.axis === axisLetter);
  return entry.dir;
}
// Full XYZ Rotate gizmo (Wave 5) -- one ring per axis, conventional colors
// (X=red, Y=green, Z=blue, matching the Move/Scale axis colors already
// established). Each ring lives in the plane perpendicular to its axis;
// `u`/`v` are two basis vectors of that plane chosen so `u × v = dir`
// (right-handed) -- dragging sweeps `u` toward `v` as the angle increases,
// which is what makes `Quat.fromAxisAngle(dir, angle)` and the drag's own
// atan2(delta·v, delta·u) agree on which way is "positive" for every axis,
// not just Y. The Y entry's own (u,v) = (Z,X) is deliberately the exact
// pair that reproduces the pre-Wave-5 single Y-ring's atan2(dx,dz) angle
// convention bit-for-bit, so an old project's authored Y rotation feels
// identical to drag, not just identical to load.
const GIZMO_ROTATE_AXES = [
  { axis: 'rx', dir: new Opus.Vec3(1, 0, 0), color: [0.95, 0.25, 0.25], u: new Opus.Vec3(0, 1, 0), v: new Opus.Vec3(0, 0, 1) },
  { axis: 'ry', dir: new Opus.Vec3(0, 1, 0), color: [0.3, 0.9, 0.35], u: new Opus.Vec3(0, 0, 1), v: new Opus.Vec3(1, 0, 0) },
  { axis: 'rz', dir: new Opus.Vec3(0, 0, 1), color: [0.3, 0.55, 0.95], u: new Opus.Vec3(1, 0, 0), v: new Opus.Vec3(0, 1, 0) },
];
const GIZMO_RING_SEGMENTS = 16;
const GIZMO_SCALE_AXES = [
  { axis: 'sx', dir: new Opus.Vec3(1, 0, 0), color: [0.75, 0.4, 0.4] },
  { axis: 'sy', dir: new Opus.Vec3(0, 1, 0), color: [0.4, 0.7, 0.45] },
  { axis: 'sz', dir: new Opus.Vec3(0, 0, 1), color: [0.4, 0.5, 0.75] },
];
// One extra point handle (not an axis) near the origin for uniform scale --
// deliberately off all three axes so it never overlaps their pick regions.
const GIZMO_UNIFORM_OFFSET = new Opus.Vec3(0.5, 0.5, 0.5);
// Deliberately clear of the three move/scale handles' own reach
// ([GAP, GAP+LENGTH] along their axis) so the rotate handle doesn't
// visually or pick-wise collide with them regardless of rotation angle.
const GIZMO_ROTATE_RADIUS = GIZMO_GAP + GIZMO_LENGTH + 0.5;
const gizmoHandles = new Map(); // handle id -> entity ('x'/'y'/'z'/'rotate'/'sx'/'sy'/'sz'/'uniform')

// Wave 5 (Priority I): a spot light's cone has no visual representation at
// all otherwise -- angle/range are just numbers in the Inspector, with no
// way to see what they actually illuminate without entering Play mode. A
// bounded, editor-only marker set (never saved, never lit, unpickable --
// same non-interactive convention as the selection marker), rebuilt
// whenever the selected light's own relevant fields change.
const LIGHT_CONE_RING_SEGMENTS = 12;
const lightConeHandles = new Map(); // id -> marker entity, id is 'apex', 'axis-N', or 'ring-N'

function syncLightConeViz() {
  const isSelectedSpot = selectedItem && selectedItem.kind === 'light' && selectedItem.options.lightType === 'spot';
  if (!isSelectedSpot) {
    for (const entity of lightConeHandles.values()) app.scene.remove(entity);
    lightConeHandles.clear();
    return;
  }
  const apex = selectedItem.entity.position;
  // The light handle's own `.direction` is kept in sync with the entity's
  // WORLD orientation every frame (see the light per-frame sync near
  // instantiateCubeRecord) -- using it here, rather than the raw local
  // `options.direction`, means the cone preview correctly follows a
  // parented light's inherited rotation, not just its own local aim.
  const dir = selectedItem.lightHandle.direction.length() > 0.0001 ? selectedItem.lightHandle.direction.clone().normalize() : new Opus.Vec3(0, -1, 0);
  const range = selectedItem.options.range;
  const radius = range * Math.tan(selectedItem.options.angle);
  const baseCenter = apex.add(dir.scale(range));
  const ref = Math.abs(dir.dot(new Opus.Vec3(0, 1, 0))) > 0.99 ? new Opus.Vec3(1, 0, 0) : new Opus.Vec3(0, 1, 0);
  const u = dir.cross(ref).normalize();
  const v = dir.cross(u).normalize();

  const wanted = new Set(['apex']);
  const place = (id, pos, color, size) => {
    wanted.add(id);
    let entity = lightConeHandles.get(id);
    // The apex may be the authored light's own position. Overlay reuse must
    // never borrow that object: selecting another spot must not move it.
    if (!entity) { entity = app.addEntity({ mesh: cubeMesh, color, position: pos.clone(), scale: new Opus.Vec3(size, size, size), unlit: true }); lightConeHandles.set(id, entity); }
    else entity.position.set(pos.x, pos.y, pos.z);
  };
  place('apex', apex, [1, 1, 0.6], 0.12);
  for (let i = 0; i < LIGHT_CONE_RING_SEGMENTS; i++) {
    const theta = (i / LIGHT_CONE_RING_SEGMENTS) * Math.PI * 2;
    const pos = baseCenter.add(u.scale(Math.cos(theta) * radius)).add(v.scale(Math.sin(theta) * radius));
    place(`ring-${i}`, pos, [1, 1, 0.4], 0.1);
  }
  const AXIS_DOTS = 4;
  for (let i = 1; i <= AXIS_DOTS; i++) {
    place(`axis-${i}`, apex.add(dir.scale(range * (i / (AXIS_DOTS + 1)))), [1, 1, 0.4], 0.07);
  }
  for (const [id, entity] of lightConeHandles) {
    if (!wanted.has(id)) { app.scene.remove(entity); lightConeHandles.delete(id); }
  }
}

function gizmoEligible() {
  if (playMode || !selectedItem) return false;
  // Move-gizmo-able kinds match exactly what free-drag already supports
  // (cube, terrain) -- water was never draggable either, no reason for the
  // gizmo to support it first. Rotate/Scale are cube-only: terrain has no
  // rotationY or per-axis scale in this engine (Seed/Size/Radius instead).
  if (gizmoMode === 'move') return selectedItem.kind === 'cube' || selectedItem.kind === 'sprite' || selectedItem.kind === 'tilemap' || selectedItem.kind === 'terrain' || selectedItem.kind === 'light';
  return selectedItem.kind === 'cube' || selectedItem.kind === 'sprite' || selectedItem.kind === 'tilemap';
}

function syncGizmo() {
  if (!gizmoEligible()) {
    for (const entity of gizmoHandles.values()) app.scene.remove(entity);
    gizmoHandles.clear();
    return;
  }
  // Mode switches reuse nothing across modes -- a leftover Rotate handle
  // while in Scale mode (or vice versa) would still be pickable even though
  // it's the wrong tool, so every handle not valid for the CURRENT mode is
  // torn down first. Rotate ring segments use composite ids ('rx-0', 'ry-3',
  // ...), matched by prefix rather than listed individually.
  const keep = (id) => (gizmoMode === 'move' ? ['x', 'y', 'z'].includes(id)
    : gizmoMode === 'rotate' ? /^r[xyz]-/.test(id)
    : ['sx', 'sy', 'sz', 'uniform'].includes(id));
  for (const [id, entity] of gizmoHandles) {
    if (!keep(id)) { app.scene.remove(entity); gizmoHandles.delete(id); }
  }
  const origin = itemPosition(selectedItem);
  if (gizmoMode === 'move') {
    // Wave 6 (Priority J): in 'local' mode every handle gets the SELECTED
    // item's own current quaternion -- a box scaled long along its local X
    // (the 'x' handle), given the object's own orientation, points its long
    // axis exactly along entity.right, matching moveAxisWorldDir('x')
    // exactly -- one shared rotation, not three separately-computed
    // per-axis alignments. Identity in 'world' mode (the default), so an
    // unrotated object's handles are visually unaffected by which mode is
    // active, and every project saved before this priority renders
    // bit-identical Move handles.
    const handleQuat = (gizmoSpace === 'local' && selectedItem.entity) ? selectedItem.entity.quaternion : Opus.Quat.identity();
    for (const { axis, color } of GIZMO_MOVE_AXES) {
      const dir = moveAxisWorldDir(axis);
      const center = origin.add(dir.scale(GIZMO_GAP + GIZMO_LENGTH / 2));
      const scale = axis === 'x' ? new Opus.Vec3(GIZMO_LENGTH, GIZMO_THICKNESS, GIZMO_THICKNESS)
        : axis === 'y' ? new Opus.Vec3(GIZMO_THICKNESS, GIZMO_LENGTH, GIZMO_THICKNESS)
        : new Opus.Vec3(GIZMO_THICKNESS, GIZMO_THICKNESS, GIZMO_LENGTH);
      let entity = gizmoHandles.get(axis);
      if (!entity) { entity = app.addEntity({ mesh: cubeMesh, color, position: center, scale }); gizmoHandles.set(axis, entity); }
      else entity.position.set(center.x, center.y, center.z);
      entity.quaternion = handleQuat;
    }
  } else if (gizmoMode === 'rotate') {
    // Each ring is drawn as GIZMO_RING_SEGMENTS small markers around a
    // fixed circle in that axis's own plane (no continuous-curve mesh
    // exists in this engine -- the same "approximate with arranged cubes"
    // precedent the Waypoint Graph's connection LINES already established
    // for a missing primitive). Positions are fixed relative to the
    // object's origin (not re-oriented by the object's current rotation),
    // matching how Move/Scale handles are also fixed local offsets, not a
    // reflection of some current value -- simpler and just as grabbable.
    for (const { axis, dir, color, u, v } of GIZMO_ROTATE_AXES) {
      for (let i = 0; i < GIZMO_RING_SEGMENTS; i++) {
        const theta = (i / GIZMO_RING_SEGMENTS) * Math.PI * 2;
        const offset = u.scale(Math.cos(theta)).add(v.scale(Math.sin(theta))).scale(GIZMO_ROTATE_RADIUS);
        const center = origin.add(offset);
        const id = `${axis}-${i}`;
        let entity = gizmoHandles.get(id);
        if (!entity) { entity = app.addEntity({ mesh: cubeMesh, color, position: center, scale: new Opus.Vec3(0.14, 0.14, 0.14) }); gizmoHandles.set(id, entity); }
        else entity.position.set(center.x, center.y, center.z);
      }
    }
  } else if (gizmoMode === 'scale') {
    for (const { axis, dir, color } of GIZMO_SCALE_AXES) {
      const center = origin.add(dir.scale(GIZMO_GAP + GIZMO_LENGTH / 2));
      const scale = axis === 'sx' ? new Opus.Vec3(GIZMO_LENGTH, GIZMO_THICKNESS, GIZMO_THICKNESS)
        : axis === 'sy' ? new Opus.Vec3(GIZMO_THICKNESS, GIZMO_LENGTH, GIZMO_THICKNESS)
        : new Opus.Vec3(GIZMO_THICKNESS, GIZMO_THICKNESS, GIZMO_LENGTH);
      let entity = gizmoHandles.get(axis);
      if (!entity) { entity = app.addEntity({ mesh: cubeMesh, color, position: center, scale }); gizmoHandles.set(axis, entity); }
      else entity.position.set(center.x, center.y, center.z);
    }
    const uCenter = origin.add(GIZMO_UNIFORM_OFFSET);
    let uEntity = gizmoHandles.get('uniform');
    if (!uEntity) { uEntity = app.addEntity({ mesh: cubeMesh, color: [0.9, 0.85, 0.9], position: uCenter, scale: new Opus.Vec3(0.28, 0.28, 0.28) }); gizmoHandles.set('uniform', uEntity); }
    else uEntity.position.set(uCenter.x, uCenter.y, uCenter.z);
  }
}

// Closest approach between the pick ray and each handle's own line segment
// (origin+dir*GIZMO_GAP to origin+dir*(GIZMO_GAP+GIZMO_LENGTH)) -- NOT a
// sphere around each handle's center. First attempt used a generous sphere
// per handle (the same approximation pickEntity already uses for
// free-standing cube selection), but all three handles share one origin
// close enough together that their spheres overlap heavily: clicking
// exactly on the X handle's screen position picked Y instead, because Y's
// sphere happened to be closer along the ray at that pixel. Caught by
// dispatching a real PointerEvent at the X handle's own projected screen
// position and finding the object moved along Y, not X.
function closestPointsRayLine(rayOrigin, rayDir, lineOrigin, lineDir) {
  const w0 = rayOrigin.sub(lineOrigin);
  const b = rayDir.dot(lineDir);
  const d = rayDir.dot(w0);
  const e = lineDir.dot(w0);
  const denom = 1 - b * b;
  if (Math.abs(denom) < 1e-6) return { rayT: Math.max(0, -d), lineU: 0 };
  return { rayT: Math.max(0, (b * e - d) / denom), lineU: (e - b * d) / denom };
}

function pickGizmoHandle(clientX, clientY) {
  if (gizmoHandles.size === 0 || !selectedItem) return null;
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const ray = app.camera.screenPointToRay(ndcX, ndcY, canvas.width / Math.max(canvas.height, 1));
  const origin = itemPosition(selectedItem);
  const pickThreshold = GIZMO_THICKNESS * 4;
  let closestId = null;
  let closestDist = pickThreshold;
  const axisSet = gizmoMode === 'move' ? GIZMO_MOVE_AXES : gizmoMode === 'scale' ? GIZMO_SCALE_AXES : [];
  for (const { axis } of axisSet) {
    const dir = gizmoMode === 'move' ? moveAxisWorldDir(axis) : GIZMO_SCALE_AXES.find((a) => a.axis === axis).dir;
    const { lineU } = closestPointsRayLine(ray.origin, ray.direction, origin, dir);
    const clampedU = Math.max(GIZMO_GAP, Math.min(GIZMO_GAP + GIZMO_LENGTH, lineU));
    const handlePoint = origin.add(dir.scale(clampedU));
    const rayT = Math.max(0, handlePoint.sub(ray.origin).dot(ray.direction));
    const rayPoint = ray.origin.add(ray.direction.scale(rayT));
    const dist = rayPoint.sub(handlePoint).length();
    if (dist < closestDist) { closestDist = dist; closestId = axis; }
  }
  // The uniform-scale handle is a single point -- plain closest-point-on-
  // ray-to-a-point, the degenerate case of the same math.
  const uniformHandle = gizmoHandles.get('uniform');
  if (uniformHandle) {
    const rayT = Math.max(0, uniformHandle.position.sub(ray.origin).dot(ray.direction));
    const rayPoint = ray.origin.add(ray.direction.scale(rayT));
    const dist = rayPoint.sub(uniformHandle.position).length();
    if (dist < closestDist) { closestDist = dist; closestId = 'uniform'; }
  }
  // Rotate rings (Wave 5): picked against each ring's actual rendered
  // segment markers (closest-point-on-ray-to-a-point, same math as the
  // uniform handle above), NOT a generic "ray hits my plane near my
  // radius" test. The plane/radius test was tried first and found broken
  // by dogfooding: at theta=0/90/180/270 a ring's own reference point sits
  // exactly on the shared seam where TWO rings' planes intersect (e.g.
  // (R,0,0) lies in both the rz ring's z=0 plane AND the ry ring's y=0
  // plane, at exactly radius R from origin in both), so the generic test
  // picked the wrong ring there -- reproduced by dragging the Z ring and
  // measuring the resulting rotation land on Y instead of Z. Testing
  // against real marker positions has no such seam ambiguity: two
  // different rings' segments are never at the same point in space.
  if (gizmoMode === 'rotate') {
    const ringPickThreshold = GIZMO_THICKNESS * 5;
    for (const { axis } of GIZMO_ROTATE_AXES) {
      for (let i = 0; i < GIZMO_RING_SEGMENTS; i++) {
        const seg = gizmoHandles.get(`${axis}-${i}`);
        if (!seg) continue;
        const rayT = Math.max(0, seg.position.sub(ray.origin).dot(ray.direction));
        const rayPoint = ray.origin.add(ray.direction.scale(rayT));
        const dist = rayPoint.sub(seg.position).length();
        if (dist < ringPickThreshold && dist < closestDist) { closestDist = dist; closestId = axis; }
      }
    }
  }
  return closestId;
}

// Unconditional (runs in edit mode too, unlike the gameplay-only onUpdate
// below gated behind `playMode`) -- so dragging/gizmo-editing a parent in
// the editor itself moves its children live, WYSIWYG, not just once Play
// starts. Registered before the selection-marker sync below so a selected
// CHILD's marker reads its already-resolved (not stale) world position.
// Billboards face only after hierarchy composition. This preserves parent
// position/scale while making camera-facing orientation authoritative in
// world space instead of letting a parent overwrite it later in the frame.
app.onUpdate(() => {
  updateHierarchyTransforms(); syncBillboards();
  syncSpriteParallax();
  // Project only after hierarchy and Billboard resolution so a parented,
  // rotated, scaled, or camera-facing Sprite gets the exact current frame.
  syncSpriteDirectManipulation();
  syncCollider2DOverlay();
  syncAiPerceptionOverlay();
  if (!playMode) syncPhysicsDebug2D();
});

// Unconditional too, same reasoning as hierarchy above -- this is what makes
// Preview work in the editor itself, not just once Play starts. The
// engine's own update loop already gates EVERY registered onUpdate callback
// (this one included) behind `!app.paused` (see API-FRICTION.md #54), so
// "respect pause" and "use simulation time" both come for free here with no
// animation-specific pause-checking code -- the same property Tweens/Timers
// already got by living inside the gameplay-gated callback, just reached a
// different way since this one also needs to run in edit mode for Preview.
app.onUpdate((dt) => { updateAnimations(dt); });

// A light's marker `entity` is what hierarchy/gizmo/drag/Undo all already
// know how to move; the actual `app.createLight` handle the renderer reads
// is a SEPARATE object (createLight's own return value, not an Entity --
// lights have no mesh). This is the one sync point between them: copy the
// marker's now-hierarchy-resolved world position into the light handle
// every frame, so a parented or Tween-animated light stays correctly lit
// with zero light-specific code anywhere else. Direction is NOT re-derived
// from the marker's rotationY -- true when this was written (a cube had no
// pitch/tilt to drive a cone direction from), no longer true now that Wave
// 5 gives every entity a real quaternion. `options.direction` is now
// interpreted as the LOCAL aim direction (relative to the light's own
// orientation), and the light handle's actual world-space direction is
// `entity.quaternion.rotateVec3(localDirection)` every frame -- for an
// unparented light `entity.quaternion` is always identity (nothing else
// ever sets it), so `identity.rotateVec3(d) === d` and behavior for every
// pre-Wave-5 standalone light is completely unchanged; a PARENTED spot
// light's cone now correctly follows its parent's full rotation, closing
// the bound this comment used to document.
app.onUpdate(() => {
  for (const item of placed) {
    if (item.kind !== 'light') continue;
    item.lightHandle.position.set(item.entity.position.x, item.entity.position.y, item.entity.position.z);
    item.options.position.set(item.entity.position.x, item.entity.position.y, item.entity.position.z);
    if (item.options.lightType === 'spot' && item.options.direction) {
      const worldDir = item.entity.quaternion.rotateVec3(item.options.direction);
      item.lightHandle.direction.set(worldDir.x, worldDir.y, worldDir.z);
    }
  }
});

app.onUpdate(() => {
  for (const [item, marker] of selectionMarkers) {
    const pos = itemPosition(item);
    if (item.kind === 'sprite') {
      // The projected Sprite frame is the authoritative selected visual.
      // Do not also show the old cube-shaped ground marker.
      marker.visible = false;
    } else if (item.kind === 'cube') {
      marker.visible = true;
      marker.position.set(pos.x, pos.y - item.entity.scale.y * 0.4, pos.z);
      marker.scale.set(item.entity.scale.x * 1.15, 0.05, item.entity.scale.z * 1.15);
    } else {
      marker.visible = true;
      marker.position.set(pos.x, pos.y + 0.02, pos.z);
      marker.scale.set(1.5, 0.05, 1.5);
    }
  }
  // Keeps the gizmo glued to its item across every OTHER way position can
  // change -- inspector field edits, AI/patrol movement, Undo/Redo -- not
  // just its own drag gesture.
  if (gizmoHandles.size > 0 && selectedItem) {
    const origin = itemPosition(selectedItem);
    const axisSet = gizmoMode === 'move' ? GIZMO_MOVE_AXES : gizmoMode === 'scale' ? GIZMO_SCALE_AXES : [];
    const moveHandleQuat = (gizmoMode === 'move' && gizmoSpace === 'local' && selectedItem.entity) ? selectedItem.entity.quaternion : Opus.Quat.identity();
    for (const { axis } of axisSet) {
      const entity = gizmoHandles.get(axis);
      if (!entity) continue;
      const dir = gizmoMode === 'move' ? moveAxisWorldDir(axis) : GIZMO_SCALE_AXES.find((a) => a.axis === axis).dir;
      const center = origin.add(dir.scale(GIZMO_GAP + GIZMO_LENGTH / 2));
      entity.position.set(center.x, center.y, center.z);
      if (gizmoMode === 'move') entity.quaternion = moveHandleQuat;
    }
    if (gizmoMode === 'rotate' && (selectedItem.kind === 'cube' || selectedItem.kind === 'sprite' || selectedItem.kind === 'tilemap')) {
      for (const { axis, u, v } of GIZMO_ROTATE_AXES) {
        for (let i = 0; i < GIZMO_RING_SEGMENTS; i++) {
          const entity = gizmoHandles.get(`${axis}-${i}`);
          if (!entity) continue;
          const theta = (i / GIZMO_RING_SEGMENTS) * Math.PI * 2;
          const offset = u.scale(Math.cos(theta)).add(v.scale(Math.sin(theta))).scale(GIZMO_ROTATE_RADIUS);
          const center = origin.add(offset);
          entity.position.set(center.x, center.y, center.z);
        }
      }
    }
    const uniformHandle = gizmoHandles.get('uniform');
    if (uniformHandle) {
      const center = origin.add(GIZMO_UNIFORM_OFFSET);
      uniformHandle.position.set(center.x, center.y, center.z);
    }
  }
});

function setGizmoMode(mode) {
  if (gizmoMode === mode) return;
  gizmoMode = mode;
  for (const m of ['move', 'rotate', 'scale']) {
    document.getElementById(`gizmo-mode-${m}`).classList.toggle('active', m === mode);
  }
  syncGizmo();
}
document.getElementById('gizmo-mode-move').addEventListener('click', () => setGizmoMode('move'));
document.getElementById('gizmo-mode-rotate').addEventListener('click', () => setGizmoMode('rotate'));
document.getElementById('gizmo-mode-scale').addEventListener('click', () => setGizmoMode('scale'));
document.getElementById('gizmo-mode-move').classList.add('active'); // matches the default gizmoMode = 'move'

const gizmoSnapToggleEl = document.getElementById('gizmo-snap-toggle');
gizmoSnapToggleEl.checked = gizmoSnap.enabled;
gizmoSnapToggleEl.addEventListener('change', (e) => {
  changeGizmoSnapSetting('enabled',e.target.checked);
  gizmoSnapToggleEl.checked=gizmoSnap.enabled;
});
const gridSettingsEl=document.getElementById('gizmo-grid-settings');
function syncGridSettings(){for(const field of ['position','rotationDegrees','scale'])document.getElementById('gizmo-grid-'+field).value=gizmoSnap[field];}
syncGridSettings();
document.getElementById('gizmo-grid-btn').addEventListener('click',()=>{if(playMode)return;gridSettingsEl.hidden=!gridSettingsEl.hidden;syncGridSettings();});
document.getElementById('gizmo-grid-close').addEventListener('click',()=>{gridSettingsEl.hidden=true;});
for(const field of ['position','rotationDegrees','scale'])document.getElementById('gizmo-grid-'+field).addEventListener('change',e=>{
  const text=e.target.value.trim(),value=text?Number(text):NaN;
  if(!changeGizmoSnapSetting(field,value)&&value!==gizmoSnap[field])showStatus('Grid preference unchanged: use a finite value within the shown limits, outside Play.');
  syncGridSettings();
});
document.getElementById('gizmo-grid-reset').addEventListener('click',()=>{if(playMode)return;for(const [field,value]of Object.entries(normalizeGizmoSnapSettings({enabled:gizmoSnap.enabled})))changeGizmoSnapSetting(field,value);syncGridSettings();});

document.getElementById('show-colliders-toggle').addEventListener('change', (e) => {
  showColliders = e.target.checked;
  syncColliderViz();
});

// Creator profiler reads only the canonical loop's bounded CPU capture.
const performanceProfilerToggle=document.getElementById('performance-profiler-toggle');
let performanceCaptureRequested=false,performanceProfilerContext='EDIT',performanceProfilerLastDraw=-Infinity;
function summarizePerformanceFrames(snapshot){
  const rows=Array.isArray(snapshot?.records)?snapshot.records.slice(-120):[];
  const stats=key=>{const values=rows.map(r=>r[key]).filter(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);return values.length?{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:values[Math.ceil(values.length*.95)-1]}:null;};
  return {count:rows.length,interval:stats('intervalMs'),update:stats('updateMs'),render:stats('renderMs'),cpu:stats('cpuMs')};
}
function syncPerformanceProfiler(force=false){
  const panel=document.getElementById('performance-profiler-panel');panel.hidden=!performanceProfilerToggle.checked;
  if(!performanceProfilerToggle.checked)return;
  const now=performance.now();if(!force&&now-performanceProfilerLastDraw<250)return;performanceProfilerLastDraw=now;
  if(playMode&&gameEnded){performanceCaptureRequested=false;performanceProfilerContext='ENDED';}
  app.setPerformanceCapture(performanceCaptureRequested&&!app.paused);
  const snapshot=app.getPerformanceSnapshot(),stats=summarizePerformanceFrames(snapshot),rect=canvas.getBoundingClientRect();
  const top=Math.max(58,document.getElementById('gizmo-toolbar').getBoundingClientRect().bottom-rect.top+8);panel.style.top=top+'px';panel.style.maxHeight=Math.max(100,rect.height-top-16)+'px';
  const format=x=>x?x.mean.toFixed(2)+' ms avg / '+x.p95.toFixed(2)+' ms p95':'Awaiting completed frames';
  const state=app.paused?'PAUSED · samples retained':snapshot.enabled?'CAPTURING':'HELD · samples retained';
  document.getElementById('performance-profiler-readout').textContent=performanceProfilerContext+' · '+state+'\n'+stats.count+'/'+snapshot.capacity+' frames retained · '+snapshot.dropped+' older discarded\n\nWall frame interval: '+format(stats.interval)+'\nObserved cadence: '+(stats.interval?.mean>0?(1000/stats.interval.mean).toFixed(1)+' frames/s':'Awaiting intervals')+'\nUpdate CPU: '+format(stats.update)+'\nRender submission CPU: '+format(stats.render)+'\nCombined loop CPU: '+format(stats.cpu);
  const button=document.getElementById('performance-profiler-capture');button.textContent=performanceCaptureRequested?'Hold capture':'Resume capture';button.disabled=app.paused||(playMode&&gameEnded);
}
function startPerformanceProfilerSession(){
  app.clearPerformanceCapture();performanceProfilerContext='PLAY';performanceCaptureRequested=performanceProfilerToggle.checked;app.setPerformanceCapture(performanceCaptureRequested&&!app.paused);
}
function stopPerformanceProfilerSession(){
  performanceCaptureRequested=false;performanceProfilerContext='STOPPED';app.setPerformanceCapture(false);syncPerformanceProfiler(true);
}
function resetPerformanceProfilerForProject(){
  performanceCaptureRequested=false;performanceProfilerContext='NEW PROJECT';app.setPerformanceCapture(false);app.clearPerformanceCapture();syncPerformanceProfiler(true);
}
performanceProfilerToggle.addEventListener('change',()=>{performanceCaptureRequested=performanceProfilerToggle.checked;if(performanceCaptureRequested){app.clearPerformanceCapture();performanceProfilerContext=playMode?'PLAY':'EDIT';}app.setPerformanceCapture(performanceCaptureRequested&&!app.paused);syncPerformanceProfiler(true);});
document.getElementById('performance-profiler-capture').addEventListener('click',()=>{if(app.paused||(playMode&&gameEnded))return;performanceCaptureRequested=!performanceCaptureRequested;if(performanceCaptureRequested){app.clearPerformanceCapture();performanceProfilerContext=playMode?'PLAY':'EDIT';}syncPerformanceProfiler(true);});
document.getElementById('performance-profiler-clear').addEventListener('click',()=>{app.clearPerformanceCapture();syncPerformanceProfiler(true);});
document.getElementById('performance-profiler-hide').addEventListener('click',()=>{performanceProfilerToggle.checked=false;performanceCaptureRequested=false;app.setPerformanceCapture(false);syncPerformanceProfiler(true);});
for(const id of ['performance-profiler-capture','performance-profiler-clear','performance-profiler-hide'])document.getElementById(id).style.cssText='width:auto;margin:5px 4px 5px 0;padding:5px 8px;background:#182338;color:#dce6f5;border:1px solid #526177;border-radius:4px';
app.onPauseChange(()=>{if(performanceProfilerToggle.checked){app.setPerformanceCapture(performanceCaptureRequested&&!app.paused);syncPerformanceProfiler(true);}});
setInterval(()=>syncPerformanceProfiler(),250);

// Transient, read-only modern XY diagnostics. No history/project mutation and
// no collision queries/ticks; draw only canonical geometry and published state.
const graphTrace = OpusGraphTrace.create();
const graphTraceToggle = document.getElementById('graph-trace-toggle');
let graphTraceLastDraw = -Infinity;
let graphTraceFilterSignature='',graphTraceLocationSignature='';
function graphTraceFilterKey(row){return row.ownerId?'object:'+row.ownerId:'session';}
function graphTraceVisibleRows(state,owner,outcome){return state.records.filter(row=>(!owner||graphTraceFilterKey(row)===owner)&&(!outcome||row.outcome===outcome));}
function syncGraphTrace(force=false){
  const panel=document.getElementById('graph-trace-panel');panel.hidden=!graphTrace.enabled;
  if(!graphTrace.enabled)return;
  const now=performance.now();if(!force&&now-graphTraceLastDraw<100)return;graphTraceLastDraw=now;
  const toolbar=document.getElementById('gizmo-toolbar'),rect=canvas.getBoundingClientRect();
  const top=Math.max(58,toolbar.getBoundingClientRect().bottom-rect.top+8);
  panel.style.top=top+'px';panel.style.maxHeight=Math.max(100,rect.height-top-16)+'px';
  panel.style.maxWidth='calc(100% - 24px)';panel.style.boxSizing='border-box';
  const words={NODE_ENTER:'Reached node',ACTION_REQUESTED:'Action requested',GATE_REJECTED:'Condition blocked this Action',CONDITION_TRUE:'Condition passed',CONDITION_FALSE:'Condition did not pass',CALL_ENTER:'Function started',CALL_REJECTED:'Function unavailable or recursion limit',CALL_RETURN:'Returned to caller',DELAY_SCHEDULED:'Wait scheduled',DELAY_RESUMED:'Wait resumed',SESSION_START:'Play started',SESSION_STOP:'Play stopped'};
  const state=graphTrace.snapshot(),ownerSelect=document.getElementById('graph-trace-owner'),outcomeSelect=document.getElementById('graph-trace-outcome');
  const owners=new Map(state.records.map(row=>[graphTraceFilterKey(row),row.owner||'Session'])),outcomes=[...new Set(state.records.map(row=>row.outcome))];
  const signature=JSON.stringify([[...owners],outcomes,ownerSelect.value,outcomeSelect.value]);
  if(signature!==graphTraceFilterSignature){graphTraceFilterSignature=signature;
    const owner=ownerSelect.value,outcome=outcomeSelect.value;
    ownerSelect.replaceChildren(new Option('All owners',''),...[...owners].map(([id,name])=>new Option(name,id)));
    if(owner&&!owners.has(owner))ownerSelect.add(new Option('Unavailable captured owner — no matching records',owner));ownerSelect.value=owner;
    outcomeSelect.replaceChildren(new Option('All outcomes',''),...outcomes.map(id=>new Option(words[id]||id,id)));
    if(outcome&&!outcomes.includes(outcome))outcomeSelect.add(new Option('Unavailable outcome — no matching records',outcome));outcomeSelect.value=outcome;
  }
  const visible=graphTraceVisibleRows(state,ownerSelect.value,outcomeSelect.value);
  const locationSelect=document.getElementById('graph-trace-location'),selected=locationSelect.value;
  const locationSignature=JSON.stringify(visible.slice(-30).map(row=>[row.sequence,row.label,row.outcome]));
  if(locationSignature!==graphTraceLocationSignature){graphTraceLocationSignature=locationSignature;locationSelect.replaceChildren(new Option('Choose a retained step',''),...visible.slice(-30).map(row=>new Option('#'+row.sequence+' · '+(words[row.outcome]||row.outcome)+' · '+(row.label||row.nodeId||'Session'),String(row.sequence))));locationSelect.value=selected;}
  const chosen=visible.find(row=>String(row.sequence)===locationSelect.value),openButton=document.getElementById('graph-trace-open');
  openButton.disabled=playMode||!chosen?.locationId;openButton.textContent=playMode?'Stop Play to open Graph':'Open captured Graph node';
  document.getElementById('graph-trace-readout').textContent=`${visible.length} matching / ${state.records.length}/${state.capacity} retained · ${state.dropped} older steps discarded\n`+(visible.length?visible.slice(-30).map(r=>`${r.time.toFixed(2)}s · ${r.owner||'Session'} · ${r.graphKind==='behavior'?'Behavior '+(r.behaviorIndex+1)+' · ':r.graphKind==='function'?'Function '+(OpusGraphFunctions.find(graphFunctions,r.graphFunctionId)?.name||r.graphFunctionId)+' · ':''}${r.label||r.nodeId||'Graph'} · ${words[r.outcome]||r.outcome}`).join('\n'):'No matching captured steps. Clear filters or capture another run.');
  const readout=document.getElementById('graph-trace-readout');if(document.getElementById('graph-trace-follow').checked)readout.scrollTop=readout.scrollHeight;
}
graphTraceToggle.addEventListener('change',()=>{graphTrace.setEnabled(graphTraceToggle.checked);syncGraphTrace(true);});
const graphTraceFilters=document.getElementById('graph-trace-filters');
graphTraceFilters.hidden=false;document.getElementById('graph-trace-panel').insertBefore(graphTraceFilters,document.getElementById('graph-trace-readout'));
for(const id of ['graph-trace-owner','graph-trace-outcome','graph-trace-location']){const select=document.getElementById(id);select.style.cssText='display:block;width:100%;box-sizing:border-box;margin:4px 0 8px;padding:6px;background:#182338;color:#dce6f5;border:1px solid #526177;border-radius:4px';select.addEventListener('change',()=>syncGraphTrace(true));}
for(const id of ['graph-trace-hide','graph-trace-clear','graph-trace-open'])document.getElementById(id).style.cssText='width:auto;margin:4px;padding:4px 8px;background:#182338;color:#dce6f5;border:1px solid #526177;border-radius:4px';
document.getElementById('graph-trace-open').addEventListener('click',()=>focusCapturedGraphStep(document.getElementById('graph-trace-location').value));
document.getElementById('graph-trace-hide').addEventListener('click',()=>{graphTraceToggle.checked=false;graphTrace.setEnabled(false);syncGraphTrace(true);});
document.getElementById('graph-trace-clear').addEventListener('click',()=>{graphTrace.clear();graphTraceGraphLocation.locations=[];syncGraphTrace(true);});
// Pause halts simulation callbacks, not read-only inspection of captured steps.
setInterval(()=>syncGraphTrace(),100);
// Phase214: read the actual stores; never initialize values or acquire a local
// scope by owner name/ID. Only retained waiting invocations remain inspectable.
function liveVariableStateSnapshot(item, context = {}) {
  let truncated=false;
  const text=value=>typeof value==='string'?value.slice(0,256):value;
  const scalar=value=>typeof value==='number'&&!Number.isFinite(value)?'Unavailable non-finite value':
    value===null||['string','number','boolean'].includes(typeof value)?text(value):'Unavailable non-scalar value';
  function rows(store,graph) {
    const result=[];if(!store||typeof store!=='object')return Object.freeze(result);
    let scanned=0;
    for(const key in store){if(++scanned>64){truncated=true;break;}
      const descriptor=Object.getOwnPropertyDescriptor(store,key);if(!descriptor)continue;
      const definition=graph?OpusGraphVariables.definition(graph,key):null;
      result.push(Object.freeze({name:text(definition?.name||key),id:text(key),type:definition?.type||typeof descriptor.value,
        value:'value' in descriptor?scalar(descriptor.value):'Unavailable accessor value'}));
    }
    return Object.freeze(result);
  }
  const status=!context.playing?'AUTHORED':context.paused?'PAUSED':context.ended?'ENDED':'LIVE';
  const object=rows(item?.variables),game=rows(context.playing?context.game:null),locals=[];
  if(context.playing&&item&&Array.isArray(context.pendingDelays)){
    let scanned=0;
    for(const delay of context.pendingDelays){if(++scanned>128){truncated=true;break;}
      if(delay?.item!==item||!delay.scope?.local)continue;
      if(locals.length===16){truncated=true;break;}
      locals.push(Object.freeze({invocation:scanned,fromId:text(delay.fromId),resumeAt:Number.isFinite(delay.resumeAt)?delay.resumeAt:null,
        rows:rows(delay.scope.local,delay.graph)}));
    }
  }
  return Object.freeze({status,objectId:item?.id??null,name:text(item?.name||item?.id||'No Object'),
    time:Number.isFinite(context.time)?context.time:null,object,game,locals:Object.freeze(locals),truncated,
    localNote:'Only materialized values from retained waiting invocations are shown. Other Local values are unavailable; authored defaults are not live values.'});
}
// Actual runtime reads only: never tick AI, evaluate transitions or initialize health.
const liveStateToggle=document.getElementById('live-state-toggle');
const liveStateTarget=document.getElementById('live-state-target');
let liveStateTargetId='',liveStateSignature='',liveStateLastDraw=-Infinity;
function syncLiveVariableState(force=false) {
  const panel=document.getElementById('live-state-panel'),readout=document.getElementById('live-state-readout');
  panel.hidden=!liveStateToggle.checked||!!window.__OPUS_PLAYABLE_ONLY__;
  if(panel.hidden){readout.textContent='';return;}
  const now=performance.now();if(!force&&now-liveStateLastDraw<150)return;liveStateLastDraw=now;
  const candidates=[];let scanned=0,limited=false;
  for(const item of placed){if(++scanned>512||candidates.length===128){limited=true;break;}if(item?.id!==undefined&&item?.id!==null)candidates.push(item);}
  const item=candidates.find(x=>String(x.id)===liveStateTargetId);
  const signature=JSON.stringify([candidates.map(x=>[x.id,x.name]),liveStateTargetId,!!item]);
  if(signature!==liveStateSignature){liveStateSignature=signature;
    liveStateTarget.replaceChildren(new Option('Game only — no Object',''),...candidates.map(x=>new Option(itemDisplayName(x)+' · '+String(x.id),String(x.id))));
    if(liveStateTargetId&&!item)liveStateTarget.add(new Option('Unavailable Object — retained selection',liveStateTargetId));
    liveStateTarget.value=liveStateTargetId;
  }
  const state=liveVariableStateSnapshot(item,{playing:playMode,paused:app.paused,ended:gameEnded,time:simElapsed,game:window.__gameState,pendingDelays});
  const value=v=>typeof v==='string'?JSON.stringify(v):String(v);
  const rows=entries=>entries.length?entries.map(r=>r.name+' = '+value(r.value)).join('\n'):'No materialized values';
  readout.textContent=state.status+' · read-only'+(state.time!==null&&playMode?' · '+state.time.toFixed(2)+'s':'')+
    '\n\nGAME'+(!playMode?' — unavailable outside Play':'')+'\n'+(playMode?rows(state.game):'Start Play to inspect current Game state')+
    '\n\nOBJECT — '+(item?itemDisplayName(item):liveStateTargetId?'Unavailable owner':'Choose an Object')+(state.status==='AUTHORED'?' · authored':' · current')+'\n'+rows(state.object)+
    '\n\nWAITING LOCAL INVOCATIONS\n'+(state.locals.length?state.locals.map(inv=>'Wait '+inv.invocation+' · '+inv.fromId+(inv.resumeAt!==null?' · resumes at '+inv.resumeAt.toFixed(2)+'s':'')+'\n'+rows(inv.rows)).join('\n\n'):'No retained waiting invocations; other Local values unavailable')+
    (state.truncated||limited?'\n\nBounded view limit reached: 512 Object scans/128 choices,64 fields per store,128 waiting scans/16 matching invocations.':'');
  const toolbar=document.getElementById('gizmo-toolbar'),rect=canvas.getBoundingClientRect();
  const top=Math.max(58,toolbar.getBoundingClientRect().bottom-rect.top+8);panel.style.top=top+'px';panel.style.maxHeight=Math.max(100,rect.height-top-16)+'px';
}
liveStateToggle.addEventListener('change',()=>{if(liveStateToggle.checked&&selectedItem)liveStateTargetId=String(selectedItem.id);syncLiveVariableState(true);});
liveStateTarget.addEventListener('change',()=>{liveStateTargetId=liveStateTarget.value;syncLiveVariableState(true);});
document.getElementById('live-state-hide').addEventListener('click',()=>{liveStateToggle.checked=false;syncLiveVariableState(true);});
setInterval(()=>syncLiveVariableState(),150);
// Unobserved motion/perception remain explicitly unavailable, not inferred from intent.
function aiDebugSnapshot(item, context) {
  const status=!context.playing?'STOPPED':context.paused?'PAUSED':context.ended?'ENDED':'LIVE';
  const base={status,objectId:item?.id??null,name:item?.name||item?.id||'No character',time:context.time};
  if(!item||item.kind!=='cube'||!item.entity?.ai)return {...base,reason:'Choose an AI character'};
  if(!aiBrainCanRun(item))return {...base,reason:'AI Brain disabled or retained unsupported data'};
  if(status==='STOPPED')return {...base,reason:'Play to observe fresh runtime state'};
  const ai=item.entity.ai, machine=ai.mode==='stateMachine';
  const state=machine&&Array.isArray(ai.states)?ai.states.find(s=>s&&s.name===ai._currentState):null;
  const movement=machine?state?.movement:ai, attack=machine?state?.attack:ai;
  const finite=n=>Number.isFinite(n)?n:null;
  const xyz=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]))?[p.x,p.y,p.z]:null;
  const now=Number.isFinite(context.time)?context.time:0, entity=item.entity;
  const clip=Number.isInteger(entity.animationClip)?entity.skin?.clips?.[entity.animationClip]:null;
  return {...base,mode:machine?'State Machine':'Simple',state:machine?(state?.name||'Not entered / unavailable'):'Not applicable',
    stateAge:state&&Number.isFinite(item._aiStateEnteredAt)?Math.max(0,now-item._aiStateEnteredAt):null,
    position:xyz(entity.position),movementIntent:movement?.type||'None',targetIntent:movement?.targetId||'Player/default',
    heard: Number.isFinite(item._lastHeardNoiseAt)?{age:Math.max(0,now-item._lastHeardNoiseAt),position:xyz(item._lastHeardNoisePos)}:null,
    attackEnabled:attack?.attackEnabled===true,
    cooldownRemaining:Number.isFinite(attack?._attackCooldownUntil)?Math.max(0,attack._attackCooldownUntil-now):null,
    animationRole:typeof item._animState==='string'?item._animState:null,
    clipName:clip?.name||null,clipTime:finite(entity.animationTime),
    overrideRemaining:item._animOverrideUntil===Infinity?'Terminal':Number.isFinite(item._animOverrideUntil)?Math.max(0,item._animOverrideUntil-now):null};
}
function aiDebugText(s) {
  const n=v=>Number.isFinite(v)?v.toFixed(2):'Not observed', p=v=>v?v.map(n).join(', '):'Not observed';
  const lines=[`${s.status} · ${s.name}`,`Simulation time: ${n(s.time)}s`];
  if(s.reason)return lines.concat(s.reason).join('\n');
  lines.push(`Mode: ${s.mode}`,`Actual state: ${s.state}${s.stateAge!==null?' · '+n(s.stateAge)+'s':''}`,
    `Observed position XYZ: ${p(s.position)}`,
    `Movement intent: ${s.movementIntent} · target ${s.targetIntent}`,
    'Resolved movement delta: not sampled', 'Current vision/LOS result: not sampled',
    s.heard?`Last heard memory: ${n(s.heard.age)}s ago · XYZ ${p(s.heard.position)}`:'Last heard memory: none observed',
    `Attack slot: ${s.attackEnabled?'enabled':'disabled / absent'}`,
    `Cooldown remaining: ${s.cooldownRemaining===null?'No shot deadline observed':n(s.cooldownRemaining)+'s'}`,
    `Last auto-animation role: ${s.animationRole||'Not observed'}`,
    `Actual clip: ${s.clipName||'None / unavailable'} · time ${n(s.clipTime)}s`,
    `Animation override: ${s.overrideRemaining==='Terminal'?'Terminal':s.overrideRemaining===null?'None observed':n(s.overrideRemaining)+'s'}`);
  return lines.join('\n');
}
const aiDebugToggle=document.getElementById('ai-debug-toggle');
const aiDebugTarget=document.getElementById('ai-debug-target');
let aiDebugSignature='',aiDebugTargetId='',aiDebugLastDraw=-Infinity;
function syncAiDebug(force=false) {
  const panel=document.getElementById('ai-debug-panel'),readout=document.getElementById('ai-debug-readout');
  panel.hidden=!aiDebugToggle.checked||!!window.__OPUS_PLAYABLE_ONLY__;
  if(panel.hidden){readout.textContent='';return;}
  const now=performance.now();if(!force&&now-aiDebugLastDraw<100)return;aiDebugLastDraw=now;
  const candidates=[];let scanned=0;
  for(const item of placed){if(++scanned>512)break;if(item.kind==='cube'&&item.entity?.ai)candidates.push(item);if(candidates.length===128)break;}
  const signature=JSON.stringify(candidates.map(i=>[i.id,i.name]));
  if(signature!==aiDebugSignature){aiDebugSignature=signature;aiDebugTarget.replaceChildren(new Option('Choose AI character…',''),...candidates.map(i=>new Option(i.name||i.id,String(i.id))));}
  const item=candidates.find(i=>String(i.id)===aiDebugTargetId);
  if(!item)aiDebugTargetId='';aiDebugTarget.value=aiDebugTargetId;
  readout.textContent=aiDebugText(aiDebugSnapshot(item,{playing:playMode,paused:app.paused,ended:gameEnded,time:simElapsed}))+
    (scanned>512||candidates.length===128?'\nBounded view: first512 objects /128 AI characters.':'');
}
aiDebugToggle.addEventListener('change',()=>{if(aiDebugToggle.checked&&selectedItem?.entity?.ai)aiDebugTargetId=String(selectedItem.id);syncAiDebug(true);});
aiDebugTarget.addEventListener('change',()=>{aiDebugTargetId=aiDebugTarget.value;syncAiDebug(true);});
document.getElementById('ai-debug-hide').addEventListener('click',()=>{aiDebugToggle.checked=false;syncAiDebug(true);});
// DOM-only bounded refresh continues during Pause/Stop; no transient state is saved.
setInterval(()=>syncAiDebug(),100);
const physicsDebug2DToggle = document.getElementById('physics-debug-2d-toggle');
const physicsDebug2DOverlay = document.getElementById('physics-debug-2d-overlay');
const physicsDebug2DFrame = document.getElementById('physics-debug-2d-frame');
const physicsDebug2DReadout = document.getElementById('physics-debug-2d-readout');
const physicsDebug2DTarget = document.getElementById('physics-debug-2d-target');
const physicsDebug2DPeer = document.getElementById('physics-debug-2d-peer');
let physicsDebug2DTargetSignature = '', physicsDebug2DTargetId = '';
let physicsDebug2DLastDraw = -Infinity;
physicsDebug2DToggle.addEventListener('change', () => { physicsDebug2DLastDraw = -Infinity; syncPhysicsDebug2D(); });
document.getElementById('physics-debug-2d-hide').addEventListener('click', () => { physicsDebug2DToggle.checked = false; syncPhysicsDebug2D(); });
physicsDebug2DTarget.addEventListener('change', () => { physicsDebug2DTargetId = physicsDebug2DTarget.value; physicsDebug2DLastDraw = -Infinity; syncPhysicsDebug2D(); });
physicsDebug2DPeer.addEventListener('change', () => { physicsDebug2DLastDraw = -Infinity; syncPhysicsDebug2D(); });
function syncPhysicsDebug2D() {
  if (!physicsDebug2DToggle.checked || !globalThis.OpusPhysicsDebug2D || window.__OPUS_PLAYABLE_ONLY__) {
    if (physicsDebug2DOverlay.classList.contains('active')) {
      physicsDebug2DOverlay.classList.remove('active'); physicsDebug2DFrame.replaceChildren(); physicsDebug2DReadout.textContent = '';
    }
    return;
  }
  const now = performance.now(); if (now - physicsDebug2DLastDraw < 100) return; physicsDebug2DLastDraw = now;
  function* candidates() { if (selectedItem) yield selectedItem; for (const item of placed) if (item !== selectedItem) yield item; }
  const proof = OpusPhysicsDebug2D.snapshot(candidates(), { enabled:true, bodyManager:body2DManager, triggerManager:trigger2DManager });
  const signature = JSON.stringify(proof.objects.map(o => [o.objectId,o.name]));
  if (signature !== physicsDebug2DTargetSignature) {
    physicsDebug2DTargetSignature = signature;
    physicsDebug2DTarget.replaceChildren(new Option('Scene overview',''), ...proof.objects.map(o => new Option(o.name,String(o.objectId))));
    const peerId = physicsDebug2DPeer.value;
    physicsDebug2DPeer.replaceChildren(new Option('No comparison',''), ...proof.objects.map(o => new Option(o.name,String(o.objectId)))); physicsDebug2DPeer.value = peerId;
  }
  if (!proof.objects.some(o => String(o.objectId) === physicsDebug2DTargetId)) physicsDebug2DTargetId = '';
  physicsDebug2DTarget.value = physicsDebug2DTargetId;
  const rect = canvas.getBoundingClientRect(), fragment = document.createDocumentFragment();
  const panel = document.getElementById('physics-debug-2d-panel');
  const toolbar = document.getElementById('gizmo-toolbar');
  if (panel && toolbar) {
    const top = Math.max(58, toolbar.getBoundingClientRect().bottom - physicsDebug2DOverlay.getBoundingClientRect().top + 8);
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max(100, rect.height - top - 20)}px`;
    panel.style.overflowY = 'auto';
  }
  for (const shape of proof.shapes) {
    const points = shape.kind === 'circle' ? Array.from({length:32}, (_,i) => ({x:shape.center.x+Math.cos(i/32*Math.PI*2)*shape.radius,y:shape.center.y+Math.sin(i/32*Math.PI*2)*shape.radius})) : shape.points;
    const screen = points.map(p => worldToScreen(new Opus.Vec3(p.x,p.y,shape.z)));
    if (screen.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) continue;
    const polygon = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    polygon.setAttribute('points',screen.map(p => `${p.x-rect.left},${p.y-rect.top}`).join(' '));
    if (shape.trigger) polygon.classList.add('trigger');
    polygon.dataset.objectId = String(shape.objectId); fragment.appendChild(polygon);
  }
  physicsDebug2DFrame.replaceChildren(fragment); physicsDebug2DOverlay.classList.add('active');
  const lines = ['2D Physics · XY · read-only', 'Orange: Colliders · green dashed: Triggers', `${proof.shapes.length} shapes / ${proof.scanned} objects scanned${proof.truncated ? ' · LIMIT reached (selected first)' : ''}`, `Active trigger pairs: ${proof.activeTriggerPairs}`];
  const selected = proof.objects.find(o => physicsDebug2DTargetId ? String(o.objectId) === physicsDebug2DTargetId : o.objectId === selectedItem?.id);
  if (selected) {
    lines.push(`Selected: ${selected.name}`, `Body: ${selected.body ? `${selected.body.type} · ${selected.body.enabled === false ? 'disabled' : 'enabled'}` : 'none'}${selected.oneWay ? ' · one-way' : ''}`);
    const state = selected.character;
    if (selected.characterSettings) lines.push(`Steps: ${selected.characterSettings.stepHandlingEnabled ? 'on · max '+selected.characterSettings.maxStepHeight+'m' : 'off'} · slopes: ${selected.characterSettings.slopeHandlingEnabled ? 'max '+selected.characterSettings.maxSlopeAngle+'°' : 'off'}`);
    if (state?.active) lines.push(`Grounded: ${state.grounded} · ceiling: ${state.ceiling}`, `Wall: L ${state.wallLeft} / R ${state.wallRight} · slide ${state.wallSliding}`, `Slope: ${state.onSlope} · angle ${state.slopeAngle ?? '—'}`, `Support: ${proof.objects.find(o => o.objectId === state.groundSupportId)?.name || state.groundSupportId || 'none'} · carry ${state.onMovingPlatform}`, `Support velocity: ${(state.groundSupportVelocity || []).join(', ')}`, `Ground normal: ${(state.groundNormal || []).join(', ') || 'none'}`);
    else lines.push('Character: no active runtime state (Play to inspect)');
    for (const shape of proof.shapes.filter(s => s.objectId === selected.objectId)) {
      const filter = shape.filter;
      const layerName = collisionLayers.find(layer => layer.id === filter?.collisionLayerRef)?.name || filter?.collisionLayerRef || 'Default';
      lines.push(`${shape.componentId}: layer ${layerName} · mask ${filter?.collisionMaskMode ?? 'all'}${filter?.collisionMaskMode === 'custom' ? ' ('+(filter.collisionMaskRefs || []).map(id => collisionLayers.find(layer => layer.id === id)?.name || id).join(', ')+')' : ''}`);
    }
    const ownShape = proof.shapes.find(s => s.objectId === selected.objectId), peerShape = proof.shapes.find(s => String(s.objectId) === physicsDebug2DPeer.value);
    if (ownShape && peerShape) {
      const policy = OpusPhysicsDebug2D.filterPolicy(ownShape,peerShape,collisionLayers);
      lines.push(`Mask comparison (${ownShape.componentId} ↔ ${peerShape.componentId}): ${policy === 'FILTER_ACCEPTED' ? 'accepts · contact still requires geometry/Body' : policy === 'FILTER_REJECTED' ? 'rejects · these shapes do not interact' : 'invalid · repair layer references'}`);
    }
    if (selected.platform) lines.push(`Platform delta: ${selected.platform.actualDelta?.x ?? 0}, ${selected.platform.actualDelta?.y ?? 0} · riders: ${selected.platform.riderCount ?? 0}`);
  } else lines.push('Choose a physics object above, or select one in the scene. Legacy XZ uses Show Colliders.');
  if (proof.metrics) {
    const m = proof.metrics;
    lines.push('Totals since editor opened (not contact reasons):');
    lines.push(`Queries: ${m.candidates || 0} candidates · ${m.narrowTests || 0} precise tests`, `Filter rejects: ${m.filterRejects || 0} · Tile cells queried: ${m.candidateCells || 0}`, `Carry moves: ${m.carryMoves || 0} · blocked: ${m.carryClamps || 0}`);
  }
  physicsDebug2DReadout.textContent = lines.join('\n');
}

// Wave 6 (Priority J): Local/World gizmo mode toggle -- a plain session
// preference (like gizmoMode itself), not persisted per-project, since
// which frame an author wants to move objects in is a moment-to-moment
// authoring choice, not something a saved game needs to remember.
document.getElementById('gizmo-space-toggle').addEventListener('click', () => {
  gizmoSpace = gizmoSpace === 'world' ? 'local' : 'world';
  const btn = document.getElementById('gizmo-space-toggle');
  btn.textContent = gizmoSpace === 'world' ? '🌐 World' : '📐 Local';
  syncGizmo(); // the same "keep matching-mode handles, just update position/quaternion" refresh setGizmoMode already uses
});

// W/E/R gizmo-mode shortcuts -- only in edit mode (never during Play, where
// WASD/Space already drive the player), and only when focus isn't inside a
// text input/textarea/select (otherwise typing a level name starting with
// "r" would yank the gizmo into Rotate mode out from under the user).
window.addEventListener('keydown', (e) => {
  if (playMode) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === 'w' || e.key === 'W') setGizmoMode('move');
  else if (e.key === 'e' || e.key === 'E') setGizmoMode('rotate');
  else if (e.key === 'r' || e.key === 'R') setGizmoMode('scale');
});

