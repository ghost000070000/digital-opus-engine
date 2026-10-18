// --- Transform hierarchy (Wave 4) ---
// A parent's transform affects its children. Deliberately NOT a second
// "position" concept living alongside entity.position -- every consumer in
// this codebase (renderer, physics/collision, triggers, AI, cameras
// targeting an object) already reads `item.entity.position/rotationY/scale`
// directly as WORLD space, and none of those call sites should need to
// learn about parenting. So a parented item's `entity.*` fields are kept
// as the single always-current WORLD transform, recomputed from its stored
// LOCAL transform (`localPosition`/`localRotationY`/`localScale`, meaningful
// only while `parentId` is set) every tick via updateHierarchyTransforms()
// and immediately after any edit. This is what keeps rendering and physics
// from ever disagreeing about where a child actually is -- there is only
// ever one position field, and it is always world space.
//
// Only 'cube'/'camera'/'spawner' kinds (all entity-backed with independent
// rotationY/scale) can be full parents or rotating/scaling children.
// 'emitter' (handle-backed, position only) can be a CHILD (its position
// follows a moving/rotating parent) but not meaningfully a parent of
// rotation/scale, and its own rotationY/scale don't exist to inherit.
// Terrain/water are deliberately excluded from hierarchy entirely -- large
// environment pieces, not the "machine built from parts" use case this
// feature targets, and repositioning either already has its own established
// (and more expensive) drag path.
function hierarchyCapable(item) {
  return item.kind === 'cube' || item.kind === 'sprite' || item.kind === 'tilemap' || item.kind === 'camera' || item.kind === 'spawner' || item.kind === 'emitter' || item.kind === 'light';
}
function itemLocalNode(item) {
  // Returns { position, quaternion, scale, hasOrientation } -- a uniform
  // view over the two different backing shapes (entity vs handle) so
  // hierarchy code never needs to branch on kind. `quaternion` is always a
  // real Opus.Quat (identity for a non-oriented handle-only kind like
  // 'emitter'), never a bare rotationY number -- see the Wave 5 full-XYZ
  // hierarchy comment below for why a Y-only composition was replaced.
  if (item.kind === 'emitter') return { position: item.handle.position, quaternion: Opus.Quat.identity(), scale: new Opus.Vec3(1, 1, 1), hasOrientation: false };
  return { position: item.entity.position, quaternion: item.entity.quaternion, scale: item.entity.scale, hasOrientation: true };
}
// A hierarchy child's LOCAL orientation, from whichever shape its record
// carries -- `localQuat` (Wave 5, full XYZ) if present, else derived from
// the legacy `localRotationY`-only shape (Wave 4 and every hierarchy saved
// before Wave 5) as a pure-Y quaternion. This one function is what lets
// resolveWorldTransform below stay a single quaternion-only composition
// path with no separate Y-only branch anywhere -- an old saved hierarchy
// loads and behaves identically without a distinct migration step, because
// "pure Y rotation" is just the specific quaternion Quat.fromEuler(0,y,0)
// produces, not a different code path.
function itemLocalQuat(item) {
  if (item.localQuat) return item.localQuat;
  return Opus.Quat.fromEuler(0, item.localRotationY || 0, 0);
}
// True only when an entity's orientation has genuine pitch/roll -- used to
// decide whether a serialized record needs the new `quaternion` field at
// all. A pure-yaw entity (every object saved before Wave 5, and any object
// nobody ever pitched/rolled since) keeps serializing as JUST `rotationY`,
// byte-for-byte identical to its pre-Wave-5 shape, matching the same
// "omitted entirely at defaults" discipline Materials 2.0 already
// established for its own new optional fields.
function hasPitchOrRoll(entity) {
  const e = entity.quaternion.toEuler();
  return Math.abs(e.x) > 1e-9 || Math.abs(e.z) > 1e-9;
}
function quatToArray(q) { return [q.x, q.y, q.z, q.w]; }
function quatFromArray(a) { return new Opus.Quat(a[0], a[1], a[2], a[3]); }
function isDescendantOf(candidateAncestorId, item) {
  // Cycle guard for reparenting: is `candidateAncestorId` reachable by
  // walking DOWN from `item` (i.e. would making item's descendant its new
  // parent create a loop)? Walks the item's own subtree rather than walking
  // up from the candidate, since at call time the candidate hasn't been
  // assigned as a parent yet -- there's nothing to walk up from.
  const stack = [item.id];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === candidateAncestorId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const child of placed) {
      if (child.parentId === id) stack.push(child.id);
    }
  }
  return false;
}
// Every item transitively parented under `rootItem`, in no particular
// order. Used by "Save as Prefab" (Prefabs 2.0) to capture a whole assembly
// from just the one object the author clicked.
function collectDescendants(rootItem) {
  const result = [];
  const stack = [rootItem.id];
  const seen = new Set([rootItem.id]);
  while (stack.length) {
    const id = stack.pop();
    for (const child of placed) {
      if (child.parentId === id && !seen.has(child.id)) {
        seen.add(child.id);
        result.push(child);
        stack.push(child.id);
      }
    }
  }
  return result;
}
// Wave 6B (Priority L): the multi-select Rotate/Scale hard edge -- when a
// selection contains BOTH a parent and its own child, only the parent may
// be transformed directly. Directly rotating/scaling the child too would
// double-transform it: `resolveWorldTransform` (below) already reapplies
// the child's fixed localPosition/localQuat/localScale against the
// PARENT'S newly-changed world transform on the very next tick (the same
// mechanism that already correctly carries a child along when only its
// parent moves), so a child whose parent is also selected is filtered out
// here and left for that existing mechanism to carry automatically -- never
// touched directly by the gizmo drag itself.
function selectionRoots(itemsSet) {
  return [...itemsSet].filter((item) => {
    if (!item.parentId) return true;
    const parent = findItemById(item.parentId);
    return !parent || !itemsSet.has(parent);
  });
}
let hierarchyTickToken = 0;
function updateHierarchyTransforms() {
  // Fresh memo token each call rather than clearing a Map -- resolving N
  // items with M average depth is O(N) total work (each item's world
  // transform computed once, parents resolved on first access by whichever
  // child reaches them first), not O(N*M).
  hierarchyTickToken++;
  for (const item of placed) {
    if (item.parentId) resolveWorldTransform(item);
  }
}
// Wave 7 (Priority A/Section 9): the socket-attachment "effective parent"
// transform -- character world x animated joint pose x socket offset, in
// EXACTLY that order, as one coherent composition (never a per-object
// special case). Returns the same `{position, quaternion, scale}` shape
// `itemLocalNode` already returns, so `resolveWorldTransform` below can use
// it as a drop-in substitute for the ordinary parent's own node -- the
// attached object's own local offset (localPosition/localQuat/localScale)
// then composes on TOP of this exactly the same way it already composes on
// top of an ordinary parent, one shared final step either way. Returns
// `null` (never throws) for anything that isn't actually a valid, resolvable
// socket right now -- a missing/renamed socket, a non-skinned character, or
// a joint name no longer present on the asset's rig -- so a dangling socket
// reference degrades to "attached to the character's own root" instead of
// crashing the whole hierarchy resolve pass.
function resolveSocketSourceTransform(characterItem, socketName) {
  const entity = characterItem.entity;
  if (!entity || !entity.skin) return null;
  const asset = findAssetById(characterItem.assetId);
  const socket = asset && asset.sockets && asset.sockets.find((s) => s.name === socketName);
  if (!socket) return null;
  const joints = Opus.Skin.computeJointTransforms(entity.skin, entity.animationClip, entity.animationTime);
  const joint = joints.find((j) => j.name === socket.jointName);
  if (!joint) return null;
  // Character world x joint (skin-local) pose.
  const scaledJointPos = new Opus.Vec3(joint.position.x * entity.scale.x, joint.position.y * entity.scale.y, joint.position.z * entity.scale.z);
  const jointWorldPos = entity.position.add(entity.quaternion.rotateVec3(scaledJointPos));
  const jointWorldQuat = entity.quaternion.multiply(joint.rotation);
  const jointWorldScale = new Opus.Vec3(entity.scale.x * joint.scale.x, entity.scale.y * joint.scale.y, entity.scale.z * joint.scale.z);
  // ...x the socket's own authored offset (in the joint's own local space).
  const off = socket.positionOffset || { x: 0, y: 0, z: 0 };
  const offQuat = socketOffsetQuat(socket);
  const offScale = socket.scaleOffset || { x: 1, y: 1, z: 1 };
  const scaledOff = new Opus.Vec3(off.x * jointWorldScale.x, off.y * jointWorldScale.y, off.z * jointWorldScale.z);
  return {
    position: jointWorldPos.add(jointWorldQuat.rotateVec3(scaledOff)),
    quaternion: jointWorldQuat.multiply(offQuat),
    scale: new Opus.Vec3(jointWorldScale.x * offScale.x, jointWorldScale.y * offScale.y, jointWorldScale.z * offScale.z),
  };
}
// A socket's own Rotation Offset is authored as XYZ degrees (matching every
// other author-facing rotation field in this editor, e.g. Player Visual's
// `rotationOffsetY`) -- generalized to all 3 axes here since a weapon socket
// genuinely needs full orientation control, not just yaw.
function socketOffsetQuat(socket) {
  const r = socket.rotationOffset || { x: 0, y: 0, z: 0 };
  return Opus.Quat.fromEuler(r.x * Math.PI / 180, r.y * Math.PI / 180, r.z * Math.PI / 180);
}
// Full XYZ hierarchy composition (Wave 5): worldQuat = parentWorldQuat *
// localQuat, worldPos = parentWorldPos + parentWorldQuat.rotateVec3(scaledLocal)
// -- the general quaternion form of what was previously a Y-only rotation-
// matrix composition. This is the ONE hierarchy transform path; there is no
// separate Y-only math running alongside it (per the explicit Wave 5
// requirement that a second parallel path would inevitably desync from
// this one) -- a legacy Y-only child is simply the special case where
// itemLocalQuat() derives a pure-Y quaternion from `localRotationY`.
// Wave 7 (Priority A): when `item.socketName` is also set, the "parent" used
// for composition is the LIVE socket transform above (character x joint x
// socket offset) instead of the parent's own plain root transform -- one
// extra substitution, the rest of this function's own composition (the
// attached object's local offset on top) is completely unchanged.
function resolveWorldTransform(item) {
  if (item._hierarchyTick === hierarchyTickToken) return; // already resolved this pass
  item._hierarchyTick = hierarchyTickToken;
  // A stopped editor scrub is a temporary world-space pose, not a local
  // authoring edit. Keep it visible between frames; Stop/Cancel/Save clear
  // this ownership and restore normal parent/socket resolution unchanged.
  if (typeof animEditorState !== 'undefined' && animEditorState &&
      animEditorState.item === item && animEditorState.previewPose) return;
  if (!item.parentId) return; // entity.* is already world space -- nothing to do
  const parent = findItemById(item.parentId);
  if (!parent || !hierarchyCapable(parent)) { item.parentId = undefined; return; } // dangling reference -- fail safe to unparented, not a crash
  resolveWorldTransform(parent); // parent must be fully world-resolved first (also self-guards cycles via the tick token)
  const parentNode = (item.socketName && resolveSocketSourceTransform(parent, item.socketName)) || itemLocalNode(parent);
  const node = itemLocalNode(item);
  const localQuat = itemLocalQuat(item);
  const worldQuat = parentNode.quaternion.multiply(localQuat);
  const worldScale = new Opus.Vec3(
    parentNode.scale.x * (item.localScale ? item.localScale.x : 1),
    parentNode.scale.y * (item.localScale ? item.localScale.y : 1),
    parentNode.scale.z * (item.localScale ? item.localScale.z : 1),
  );
  const local = item.localPosition || new Opus.Vec3(0, 0, 0);
  const scaledLocal = new Opus.Vec3(local.x * parentNode.scale.x, local.y * parentNode.scale.y, local.z * parentNode.scale.z);
  const rotatedLocal = parentNode.quaternion.rotateVec3(scaledLocal);
  const worldPos = parentNode.position.add(rotatedLocal);
  node.position.set ? node.position.set(worldPos.x, worldPos.y, worldPos.z) : Object.assign(node.position, worldPos);
  if (node.hasOrientation) {
    // Every entity-backed child kind (cube/camera/spawner/light) now
    // inherits full parent orientation, not just cubes -- Wave 4 only ever
    // wrote `rotationY` for `kind==='cube'` children, since Y-only rotation
    // had no meaningful effect on a Camera/Spawner/Light marker's own
    // concept of orientation; full XYZ orientation does (a spot light's
    // marker, a camera rig, a weapon-mount muzzle all need to visibly pitch
    // and roll with a rotated parent -- exactly this wave's own dogfood
    // requirement), so the restriction is lifted for all of them.
    item.entity.quaternion = worldQuat;
    item.entity.scale.set ? item.entity.scale.set(worldScale.x, worldScale.y, worldScale.z) : Object.assign(item.entity.scale, worldScale);
  }
}
// Parents `item` under `parentItem`, computing localPosition/localRotationY/
// localScale so the object's WORLD transform is bit-for-bit unchanged by
// becoming a child -- "an object should not visually jump simply because it
// became a child" is the explicit Wave 4 requirement this exists to satisfy.
function reparentItem(item, parentItem) {
  if (!item || !parentItem || item === parentItem) return false;
  if (!hierarchyCapable(item) || !hierarchyCapable(parentItem)) return false;
  if (isDescendantOf(parentItem.id, item)) { showStatus(`Can't parent -- "${itemDisplayName(parentItem, placed.indexOf(parentItem))}" is already a descendant of this object`); return false; }
  // Resolve current world transforms of both BEFORE reassigning parentId --
  // if item already had a different parent, its entity.* fields are already
  // its correct current world transform (kept live by updateHierarchyTransforms
  // every frame / every edit), so no special-case is needed for re-parenting
  // an already-parented object onto a new parent.
  resolveWorldTransform(item);
  resolveWorldTransform(parentItem);
  const parentNode = itemLocalNode(parentItem);
  const node = itemLocalNode(item);
  const worldPos = node.position.clone();
  const worldQuat = node.hasOrientation ? node.quaternion : Opus.Quat.identity();
  const worldScale = node.hasOrientation ? node.scale.clone() : new Opus.Vec3(1, 1, 1);
  const offset = worldPos.sub(parentNode.position);
  const parentInverse = parentNode.quaternion.conjugate();
  const unrotated = parentInverse.rotateVec3(offset);
  const localPosition = new Opus.Vec3(
    parentNode.scale.x !== 0 ? unrotated.x / parentNode.scale.x : 0,
    parentNode.scale.y !== 0 ? unrotated.y / parentNode.scale.y : 0,
    parentNode.scale.z !== 0 ? unrotated.z / parentNode.scale.z : 0,
  );
  item.parentId = parentItem.id;
  item.localPosition = localPosition;
  // localQuat = inverse(parentWorldQuat) * childWorldQuat -- the exact
  // quaternion generalization of the old `worldRotY - parentNode.rotationY`
  // subtraction, solving for whatever local orientation reproduces the
  // child's current world orientation unchanged under the new parent.
  item.localQuat = parentInverse.multiply(worldQuat);
  item.localRotationY = undefined; // superseded by localQuat -- see itemLocalQuat's own fallback for anything that still reads it
  item.localScale = new Opus.Vec3(
    parentNode.scale.x !== 0 ? worldScale.x / parentNode.scale.x : worldScale.x,
    parentNode.scale.y !== 0 ? worldScale.y / parentNode.scale.y : worldScale.y,
    parentNode.scale.z !== 0 ? worldScale.z / parentNode.scale.z : worldScale.z,
  );
  hierarchyTickToken++; // force a fresh resolve pass so entity.* reflects the new parenting immediately, not next frame
  resolveWorldTransform(item);
  return true;
}
// Unparenting is trivial by construction: entity.* already holds the
// item's correct current WORLD transform (kept live every frame), so
// clearing parentId alone is a complete, correct, non-jumping unparent.
function unparentItem(item) {
  if (!item || !item.parentId) return false;
  resolveWorldTransform(item);
  item.parentId = undefined;
  item.localPosition = undefined;
  item.localRotationY = undefined;
  item.localQuat = undefined;
  item.localScale = undefined;
  item.socketName = undefined;
  return true;
}
// Wave 7 (Priority A/Section 7): "Attach Object to Socket" -- deliberately a
// SEPARATE entry point from reparentItem above, not a variant of it: an
// ordinary reparent preserves the child's CURRENT world transform (no
// visual jump), but attaching a weapon to a hand should snap it to sit
// EXACTLY at the socket (identity local offset) -- the expected default for
// "put this in the character's hand," not "keep it wherever it happened to
// be in the world." Sets `parentId` (reusing the ordinary hierarchy field --
// a socket attachment IS a hierarchy child, just with an extra joint+socket
// transform spliced into the composition, see resolveSocketSourceTransform)
// plus the new `socketName`.
function attachmentSocketChoices(characterItem) {
  const asset = characterItem && findAssetById(characterItem.assetId);
  const names = asset?.skin?.jointNames;
  if (!characterItem?.entity?.skin || asset?.type !== 'skinnedMesh' || !Array.isArray(names) || !Array.isArray(asset.sockets)) return [];
  return asset.sockets.filter(socket => socket && typeof socket.name === 'string' && socket.name.trim() && asset.sockets.filter(other => other?.name === socket.name).length === 1 && names.filter(name => name === socket.jointName).length === 1);
}
function attachToSocket(item, characterItem, socketName, onBeforeChange) {
  if (!item || !characterItem || item === characterItem) return false;
  if (!hierarchyCapable(item) || !hierarchyCapable(characterItem)) return false;
  if (playMode || !attachmentSocketChoices(characterItem).some(socket => socket.name === socketName)) return false;
  if (isDescendantOf(characterItem.id, item)) { showStatus(`Can't attach -- "${itemDisplayName(characterItem, placed.indexOf(characterItem))}" is already a descendant of this object`); return false; }
  if (onBeforeChange) onBeforeChange();
  item.parentId = characterItem.id;
  item.socketName = socketName;
  item.localPosition = new Opus.Vec3(0, 0, 0);
  item.localQuat = Opus.Quat.identity();
  item.localRotationY = undefined;
  item.localScale = new Opus.Vec3(1, 1, 1);
  hierarchyTickToken++;
  resolveWorldTransform(item);
  return true;
}
// Detaching from a socket is unparenting -- unparentItem already clears
// `socketName` too, so this is just the one shared exit path with a name
// that reads correctly at its own call sites.
function detachFromSocket(item) { return unparentItem(item); }
let nextSocketId = 1;
function generateSocketId() { return `socket${nextSocketId++}`; }
let nextAnimEventId = 1;
function generateAnimEventId() { return `aevt${nextAnimEventId++}`; }
// Wave 7 (Priority B/Section 12): Animation Events editor -- same
// "build the DOM in JS, wire handlers after" pattern the Socket Editor
// (immediately above) and the HUD/Sequence step lists already established.
// A CURATED, deliberately bounded action list, not every ACTION_TYPES
// entry: most actions (Move Object, Set Position, etc.) only make sense
// with a specific `targetId`/self item, a context an Animation Event fired
// off a shared ASSET's clip timeline doesn't reliably have one of. The
// three offered here are exactly the ones this priority's own dogfood
// justified (fire the weapon at a specific frame, play a sound/footstep,
// show a message) -- matching the spec's own worked examples.
const ANIMATION_EVENT_ACTIONS = ['fireWeapon', 'sound', 'message'];
function animationEventOwner(item) {
  if (playMode || selectedItem !== item || !placed.includes(item) || !Array.isArray(item?.entity?.skin?.clips)) return null;
  const matches = assets.filter(asset => asset && asset.id === item.assetId && asset.type === 'skinnedMesh');
  if (matches.length !== 1 || matches[0].animationEvents !== undefined && !Array.isArray(matches[0].animationEvents)) return null;
  return matches[0];
}
function changeAnimationEvent(item, eventId, key, value, onBeforeChange) {
  const asset = animationEventOwner(item);
  if (!asset) return false;
  const events = asset.animationEvents || [], clips = item.entity.skin.clips;
  const matches = events.filter(event => event && typeof event === 'object' && !Array.isArray(event) && event.id === eventId);
  if (key !== 'add' && (typeof eventId !== 'string' || !eventId || matches.length !== 1)) return false;
  const event = matches[0];
  if (key === 'add') { if (!clips.length) return false; }
  else if (key === 'time') {
    const duration = clips[event.clipIndex]?.duration;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || Number.isFinite(duration) && duration > 0 && value > duration || event.time === value) return false;
  } else if (key === 'clipIndex') {
    if (!Number.isInteger(value) || value < 0 || !clips[value] || event.clipIndex === value || Number.isFinite(event.time) && Number.isFinite(clips[value].duration) && event.time > clips[value].duration) return false;
  } else if (key === 'action') {
    if (!ANIMATION_EVENT_ACTIONS.includes(value) || event.action === value) return false;
  } else if (key.startsWith('params.')) {
    const fieldKey = key.slice(7), field = ACTION_TYPES[event.action]?.fields?.find(field => field.key === fieldKey);
    if (!ANIMATION_EVENT_ACTIONS.includes(event.action) || !field || event.params !== undefined && (!event.params || typeof event.params !== 'object' || Array.isArray(event.params))) return false;
    if (field.type === 'number') { if (typeof value !== 'number' || !Number.isFinite(value)) return false; }
    else if (field.type === 'checkbox') { if (typeof value !== 'boolean') return false; }
    else if (typeof value !== 'string' || field.type === 'select' && !field.options.includes(value) || field.type === 'audioAsset' && value && !findAudioAssetById(value)) return false;
    if (event.params?.[fieldKey] === value) return false;
  } else if (key !== 'remove') return false;
  if (typeof onBeforeChange === 'function') onBeforeChange(); else pushUndo();
  if (key === 'add') {
    let id; do { id = generateAnimEventId(); } while (events.some(event => event?.id === id));
    asset.animationEvents = [...events, {id, clipIndex:0, time:0, action:'message', params:{text:'Animation event'}}];
  } else if (key === 'remove') asset.animationEvents = events.filter(candidate => candidate !== event);
  else if (key === 'action') { event.action = value; event.params = {}; }
  else if (key.startsWith('params.')) event.params = {...event.params, [key.slice(7)]:value};
  else event[key] = value;
  return true;
}
function renderAnimationEventList(item) {
  const listEl = document.getElementById('anim-event-list');
  if (!listEl) return;
  const asset = findAssetById(item.assetId);
  if (!asset) { listEl.innerHTML = ''; return; }
  if (asset.animationEvents !== undefined && !Array.isArray(asset.animationEvents)) { listEl.innerHTML = '<p role="alert">Unavailable event data retained. Save or export it before repairing the asset.</p>'; const add = document.getElementById('anim-event-add-btn'); if (add) add.disabled = true; return; }
  const events = asset.animationEvents || [];
  const clips = item.entity.skin.clips;
  const currentOwner = () => animationEventOwner(item) === asset && (asset.animationEvents === events || asset.animationEvents === undefined && !events.length);
  const findEvent = (id) => events.find((e) => e && typeof e === 'object' && e.id === id);
  if (events.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No animation events yet -- add one below.</p>';
  } else {
    listEl.innerHTML = events.map((ev) => {
      if (!ev || typeof ev !== 'object' || Array.isArray(ev) || typeof ev.id !== 'string' || !ev.id || events.filter(e => e?.id === ev.id).length !== 1) return '<p role="alert">Unavailable or ambiguous event record retained. Save or export before explicit asset repair.</p>';
      const def = ACTION_TYPES[ev.action];
      const clipLabel = clips[ev.clipIndex] ? clips[ev.clipIndex].name : 'Unavailable saved clip';
      const fieldsHtml = ANIMATION_EVENT_ACTIONS.includes(ev.action) && def && def.fields.length && (ev.params === undefined || ev.params && typeof ev.params === 'object' && !Array.isArray(ev.params))
        ? def.fields.map((f) => `<div style="margin-top:4px"><label style="font-size:10px;color:#66759a">${escapeHtml(f.label)}</label>${renderActionFieldInput(f, (ev.params || {})[f.key], null)}</div>`).join('')
        : '';
      return `
      <div class="hud-element-row" data-event-id="${escapeHtml(ev.id)}">
        <div class="hud-element-row-header">
          <span>${escapeHtml(clipLabel)} @ ${Number.isFinite(ev.time) ? ev.time.toFixed(2)+'s' : 'Unavailable saved time'} -- ${escapeHtml(def ? def.label : 'Unavailable saved action')}</span>
          <button class="hud-remove-btn" data-event-remove="${escapeHtml(ev.id)}" title="Delete event">✕</button>
        </div>
        <div class="field-triple">
          <label>Clip<select data-event-clip="${escapeHtml(ev.id)}">${!Number.isInteger(ev.clipIndex)||!clips[ev.clipIndex]?'<option selected disabled>Unavailable saved clip</option>':''}${clips.map((c, i) => `<option value="${i}"${ev.clipIndex === i ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></label>
          <label>Time (seconds)<input type="number" step="0.05" min="0" data-event-time="${escapeHtml(ev.id)}" value="${Number.isFinite(ev.time)?ev.time:''}"></label>
          <label>Effect<select data-event-action="${escapeHtml(ev.id)}">${!ANIMATION_EVENT_ACTIONS.includes(ev.action)?'<option selected disabled>Unavailable saved action</option>':''}${ANIMATION_EVENT_ACTIONS.map((a) => `<option value="${a}"${ev.action === a ? ' selected' : ''}>${escapeHtml(ACTION_TYPES[a].label)}</option>`).join('')}</select></label>
        </div>
        <div data-event-fields="${escapeHtml(ev.id)}">${fieldsHtml}${ev.params !== undefined && (!ev.params || typeof ev.params !== 'object' || Array.isArray(ev.params))?'<p role="alert">Unavailable parameters retained. Choose a different effect to replace them.</p>':''}</div>
      </div>`;
    }).join('');
  }
  listEl.querySelectorAll('[data-event-remove]').forEach((btn) => {
    btn.onclick = () => { if (currentOwner() && changeAnimationEvent(item, btn.dataset.eventRemove, 'remove')) renderAnimationEventList(item); };
  });
  listEl.querySelectorAll('[data-event-clip]').forEach((sel) => {
    sel.onchange = () => { if (currentOwner()) { changeAnimationEvent(item, sel.dataset.eventClip, 'clipIndex', Number(sel.value)); renderAnimationEventList(item); } };
  });
  listEl.querySelectorAll('[data-event-time]').forEach((input) => {
    let recorded = false;
    input.oninput = () => { if (currentOwner() && input.value.trim()) changeAnimationEvent(item, input.dataset.eventTime, 'time', Number(input.value), () => { if (!recorded) { pushUndo(); recorded = true; } }); };
    input.onchange = () => { if (currentOwner()) renderAnimationEventList(item); };
  });
  listEl.querySelectorAll('[data-event-action]').forEach((sel) => {
    sel.onchange = () => { if (currentOwner()) { changeAnimationEvent(item, sel.dataset.eventAction, 'action', sel.value); renderAnimationEventList(item); } };
  });
  // Per-event param fields, reusing the SAME renderActionFieldInput/
  // data-field convention the fixed-dropdown Add Behavior UI already uses --
  // scoped per-event via each row's own `data-event-fields` container so
  // multiple events' same-named fields (two Sound events, say) never
  // collide on a shared `data-field` id the way a page-wide selector would.
  listEl.querySelectorAll('[data-event-fields]').forEach((container) => {
    const ev = findEvent(container.dataset.eventFields);
    if (!ev) return;
    container.querySelectorAll('[data-field]').forEach((input) => {
      let recorded = false;
      const handler = () => {
        if (!currentOwner()) return;
        const field = ACTION_TYPES[ev.action]?.fields.find(f => f.key === input.dataset.field);
        if (!field || field.type === 'number' && !input.value.trim()) return;
        const value = field.type === 'number' ? Number(input.value) : input.type === 'checkbox' ? input.checked : input.value;
        changeAnimationEvent(item, ev.id, 'params.'+input.dataset.field, value, () => { if (!recorded) { pushUndo(); recorded = true; } });
      };
      input.oninput = handler;
      input.onchange = () => { handler(); if (currentOwner()) renderAnimationEventList(item); };
    });
  });
  const addBtn = document.getElementById('anim-event-add-btn');
  if (addBtn) {
    addBtn.disabled = !animationEventOwner(item) || !clips.length;
    addBtn.onclick = () => {
      if (currentOwner() && changeAnimationEvent(item, null, 'add')) renderAnimationEventList(item);
    };
  }
}
// Wave 7 (Priority A/Section 6): the Socket Editor -- a real list-row UI
// over `asset.sockets`, same "build the DOM in JS, wire handlers after"
// pattern the HUD Element list/Sequence step list already established, not
// a second authoring convention. Called with the currently-selected SKINNED
// ITEM (not the asset directly) so it can resolve `item.assetId` itself,
// same as every other per-instance-but-asset-scoped panel in this Inspector.
function changeSocketAuthoringField(assetId, socketId, key, value, onBeforeChange) {
  if (playMode) return false;
  const matches = assets.filter(a => a.id === assetId);
  const asset = matches.length === 1 ? matches[0] : null;
  if (!asset || !Array.isArray(asset.sockets)) return false;
  const sockets = asset.sockets.filter(s => s && typeof s === 'object' && !Array.isArray(s) && s.id === socketId);
  if (sockets.length !== 1) return false;
  const socket = sockets[0], parts = key.split('.');
  if (key === 'name') {
    if (typeof value !== 'string' || !value.trim() || asset.sockets.some(s => s !== socket && s?.name === value)) return false;
  } else if (key === 'jointName') {
    if (typeof value !== 'string' || !Array.isArray(asset.skin?.jointNames) || asset.skin.jointNames.filter(name => name === value).length !== 1) return false;
  } else {
    if (parts.length !== 2 || !['positionOffset','rotationOffset','scaleOffset'].includes(parts[0]) || !['x','y','z'].includes(parts[1]) || typeof value !== 'number' || !Number.isFinite(value) || parts[0] === 'scaleOffset' && value <= 0) return false;
    const raw = socket[parts[0]];
    if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw))) return false;
  }
  const before = parts.length === 1 ? socket[key] : socket[parts[0]]?.[parts[1]] ?? (parts[0] === 'scaleOffset' ? 1 : 0);
  if (before === value) return false;
  if (typeof onBeforeChange === 'function') onBeforeChange(); else pushUndo();
  if (parts.length === 1) socket[key] = value;
  else socket[parts[0]] = {...(parts[0] === 'scaleOffset' ? {x:1,y:1,z:1} : {x:0,y:0,z:0}), ...socket[parts[0]], [parts[1]]:value};
  return true;
}
function renderSocketList(item) {
  const listEl = document.getElementById('socket-list');
  if (!listEl) return;
  const asset = findAssetById(item.assetId);
  if (!asset) { listEl.innerHTML = ''; return; }
  if (asset.sockets !== undefined && (!Array.isArray(asset.sockets) || asset.sockets.some(s => !s || typeof s !== 'object' || Array.isArray(s)))) { listEl.innerHTML = '<p>Unavailable socket data retained. Save or export before repairing it.</p>'; return; }
  const sockets = asset.sockets || [];
  const jointNames = item.entity?.skin?.jointNames || [];
  if (sockets.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No sockets yet -- add one below.</p>';
  } else {
    listEl.innerHTML = sockets.map((s) => `
      <div class="hud-element-row" data-socket-id="${s.id}">
        <div class="hud-element-row-header">
          <span>${escapeHtml(s.name)} <span style="color:#66759a;font-size:10px">(${escapeHtml(s.jointName)})</span></span>
          <button class="hud-remove-btn" data-socket-remove="${s.id}" title="Delete socket">✕</button>
        </div>
        <div class="field-triple">
          <input type="text" data-socket-name="${s.id}" value="${escapeHtml(s.name)}" placeholder="Name">
          <select data-socket-bone="${s.id}">${jointNames.filter(name=>name===s.jointName).length!==1?`<option selected disabled value="${escapeHtml(String(s.jointName??''))}">Retained unavailable or ambiguous joint: ${escapeHtml(String(s.jointName??''))}</option>`:''}${jointNames.filter(name=>jointNames.filter(other=>other===name).length===1).map((n) => `<option value="${escapeHtml(n)}"${s.jointName === n ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>
        </div>
        <div class="field-triple" style="margin-top:4px">
          <div><label style="font-size:10px;color:#66759a">Pos X/Y/Z</label></div>
        </div>
        <div class="field-triple">
          <input type="number" step="0.05" data-socket-posx="${s.id}" value="${(s.positionOffset || { x: 0 }).x}">
          <input type="number" step="0.05" data-socket-posy="${s.id}" value="${(s.positionOffset || { y: 0 }).y}">
          <input type="number" step="0.05" data-socket-posz="${s.id}" value="${(s.positionOffset || { z: 0 }).z}">
        </div>
        <div class="field-triple" style="margin-top:4px">
          <div><label style="font-size:10px;color:#66759a">Rot X/Y/Z (deg)</label></div>
        </div>
        <div class="field-triple">
          <input type="number" step="5" data-socket-rotx="${s.id}" value="${(s.rotationOffset || { x: 0 }).x}">
          <input type="number" step="5" data-socket-roty="${s.id}" value="${(s.rotationOffset || { y: 0 }).y}">
          <input type="number" step="5" data-socket-rotz="${s.id}" value="${(s.rotationOffset || { z: 0 }).z}">
        </div>
        <div class="field-triple" style="margin-top:4px">
          <div><label style="font-size:10px;color:#66759a">Scale X/Y/Z</label></div>
        </div>
        <div class="field-triple">
          <input type="number" step="0.05" min="0.01" data-socket-scalex="${s.id}" value="${(s.scaleOffset || { x: 1 }).x}">
          <input type="number" step="0.05" min="0.01" data-socket-scaley="${s.id}" value="${(s.scaleOffset || { y: 1 }).y}">
          <input type="number" step="0.05" min="0.01" data-socket-scalez="${s.id}" value="${(s.scaleOffset || { z: 1 }).z}">
        </div>
      </div>`).join('');
  }
  const findSocket = (id) => sockets.find((s) => s.id === id);
  const currentOwner = () => !playMode && selectedItem === item && findAssetById(item.assetId) === asset && (asset.sockets === sockets || asset.sockets === undefined && sockets.length === 0);
  listEl.querySelectorAll('[data-socket-remove]').forEach((btn) => {
    btn.disabled = playMode;
    btn.onclick = () => { if (!currentOwner() || !findSocket(btn.dataset.socketRemove)) return; pushUndo(); asset.sockets = sockets.filter((s) => s.id !== btn.dataset.socketRemove); renderSocketList(item); renderEquipmentDefList(); };
  });
  listEl.querySelectorAll('[data-socket-name]').forEach((input) => {
    let recorded = false; input.disabled = playMode; input.onfocus = () => { recorded = false; };
    input.oninput = () => { if (currentOwner()) changeSocketAuthoringField(asset.id, input.dataset.socketName, 'name', input.value, () => { if (!recorded) { pushUndo(); recorded = true; } }); };
    input.onblur = () => { if (currentOwner()) { renderSocketList(item); renderEquipmentDefList(); } };
  });
  listEl.querySelectorAll('[data-socket-bone]').forEach((sel) => {
    sel.disabled = playMode;
    sel.onchange = () => { if (currentOwner()) { changeSocketAuthoringField(asset.id, sel.dataset.socketBone, 'jointName', sel.value); renderEquipmentDefList(); } };
  });
  // Nine offset fields (position/rotation/scale x/y/z) -- wired explicitly
  // rather than via a generic dataset-name-mangling loop, so the mapping
  // from DOM attribute to {field, axis} stays plainly readable and can't
  // silently mis-wire from a camelCase-conversion mistake.
  const offsetFieldWiring = [
    ['data-socket-posx', 'socketPosx', 'positionOffset', 'x'], ['data-socket-posy', 'socketPosy', 'positionOffset', 'y'], ['data-socket-posz', 'socketPosz', 'positionOffset', 'z'],
    ['data-socket-rotx', 'socketRotx', 'rotationOffset', 'x'], ['data-socket-roty', 'socketRoty', 'rotationOffset', 'y'], ['data-socket-rotz', 'socketRotz', 'rotationOffset', 'z'],
    ['data-socket-scalex', 'socketScalex', 'scaleOffset', 'x'], ['data-socket-scaley', 'socketScaley', 'scaleOffset', 'y'], ['data-socket-scalez', 'socketScalez', 'scaleOffset', 'z'],
  ];
  for (const [attr, datasetKey, field, axis] of offsetFieldWiring) {
    listEl.querySelectorAll(`[${attr}]`).forEach((input) => {
      let recorded = false; input.disabled = playMode; input.onfocus = () => { recorded = false; };
      input.oninput = () => {
        if (!currentOwner()) return;
        const value = input.value.trim() ? Number(input.value) : NaN;
        changeSocketAuthoringField(asset.id, input.dataset[datasetKey], field+'.'+axis, value, () => { if (!recorded) { pushUndo(); recorded = true; } });
      };
      input.onblur = () => { if (currentOwner()) renderSocketList(item); };
    });
  }
  const addBtn = document.getElementById('socket-add-btn');
  if (addBtn) {
    addBtn.disabled = playMode;
    addBtn.onclick = () => {
      if (!currentOwner()) return;
      const nameInput = document.getElementById('socket-new-name');
      const boneSelect = document.getElementById('socket-new-bone');
      const name = nameInput.value.trim();
      if (!name) { showStatus('Name the socket first'); return; }
      if (sockets.some((s) => s.name === name)) { showStatus(`A socket named "${name}" already exists`); return; }
      if (jointNames.filter(name=>name===boneSelect.value).length !== 1) { showStatus('Choose an available unambiguous joint first'); return; }
      pushUndo();
      asset.sockets = [...sockets, { id: generateSocketId(), name, jointName: boneSelect.value, positionOffset: { x: 0, y: 0, z: 0 }, rotationOffset: { x: 0, y: 0, z: 0 }, scaleOffset: { x: 1, y: 1, z: 1 } }];
      renderSocketList(item);
      renderEquipmentDefList();
    };
  }
}
// Wave 7 (Priority D/Section 27): the AI State Machine editor -- a
// list/card editor (per the spec's own explicit preference over a node
// canvas for a first version), same "build the DOM in JS, wire handlers
// after" pattern every other Wave 7 list editor (Sockets, Animation
// Events, Equipment) already established. Each state card: Name, Movement
// (Type/Speed/Radius/Waypoints -- the same fields `applyAiMovementStep`
// already reads off `ai` itself, just scoped to this one state), Anim
// Role, an optional Attack sub-block (reusing the exact same
// Prefab/Radius/Cooldown/Damage fields the Simple-AI attack section
// already has), and its own ordered Transitions list (condition type +
// value + destination state -- authored order is transition PRIORITY,
// matching `tickAiStateMachine`'s own first-valid-wins evaluation) plus an
// Entry Actions list reusing the same curated ANIMATION_EVENT_ACTIONS set
// Priority B's event editor already established, for consistency.
// Wave 9 (Priority B/Sections 28-40): 'investigate' moves toward the last
// heard noise position (Section 36); 'canSeePlayer'/'cannotSeePlayer'
// (Sections 29-30, real FOV+distance+optional LOS) and 'heardNoiseRecently'
// (Sections 32-35) join the existing bounded condition set. Suspicion
// (Section 37-38) is deliberately NOT built -- Patrol/Investigate/Chase via
// these three conditions already covers the required dogfood (Section 40)
// without a second numeric awareness axis; see the Wave 9 report.
const AI_MOVEMENT_TYPES = ['', 'follow', 'flee', 'wander', 'patrolRoute', 'navigateToTarget', 'orbit', 'faceTarget', 'investigate'];
const AI_CONDITION_TYPES = ['distanceToPlayerAtMost', 'distanceToPlayerAtLeast', 'lineOfSightToPlayer', 'noLineOfSightToPlayer', 'healthAtMost', 'timeInStateAtLeast', 'canSeePlayer', 'cannotSeePlayer', 'heardNoiseRecently'];
// Wave 9 (Priority B/Section 29): Perception is a property of the
// CHARACTER's senses, not of any one State -- authored once per AI
// (`ai.perception`), read by every state's own canSeePlayer/
// cannotSeePlayer/heardNoiseRecently transitions. Unset (every pre-Wave-9
// State Machine) defaults to Vision Distance 15 / FOV 100 / Requires LOS
// true / Hearing Radius 12 the FIRST time a perception condition is
// actually evaluated (see evaluateAiTransitionCondition) -- so an old
// project with no perception UI ever opened just gets sane defaults rather
// than "always blind."
function defaultAiPerception() { return { visionDistance: 15, fovDegrees: 100, requiresLOS: true, hearingRadius: 12 }; }
function aiBrainCanRun(item) {
  if(!Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain'))return true;
  const result=OpusAiBrain.inspect(item.components['ai-brain']);
  return result.ok&&result.record.enabled;
}
function changeAiBrain(item,update) {
  if(playMode||item?.kind!=='cube')return false;
  const attached=Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain');
  const raw=attached?OpusAiBrain.inspect(item.components['ai-brain']):null;
  if(attached&&!raw.ok){showStatus('Retained AI Brain data needs explicit repair or removal.');return false;}
  const before=item.entity.ai?OpusAiBrain.captureLegacy(item.entity.ai,{enabled:raw?.record.enabled??true}):null;
  if(before&&!before.ok){showStatus(before.reason);return false;}
  const candidate=before?JSON.parse(JSON.stringify(before.record)):OpusAiBrain.create(item.entity.position);
  const remove=update(candidate.config)===null;
  const checked=remove?null:OpusAiBrain.inspect(candidate);
  if(checked&&!checked.ok){showStatus(checked.reason);return false;}
  if(remove?!item.entity.ai:before&&JSON.stringify(before.record)===JSON.stringify(checked.record))return false;
  pushUndo();
  if(remove){item.entity.ai=null;if(item.components)delete item.components['ai-brain'];}
  else {
    const config=JSON.parse(JSON.stringify(checked.record.config));
    item.entity.ai={...config,base:new Opus.Vec3(...(config.base||[item.entity.position.x,item.entity.position.y,item.entity.position.z]))};
    item.components=item.components||{};item.components['ai-brain']=checked.record;
  }
  return true;
}
function aiMovementPresetCandidate(item,id,input={}) {
  const bad=reason=>({ok:false,reason});
  const types={'ai-patrol':'patrolRoute','ai-wander':'wander','ai-follow':'follow','ai-flee':'flee'};
  if(playMode||item?.kind!=='cube'||!item.entity?.position||!types[id])return bad('Choose an editable Cube and an AI movement recipe.');
  const attached=Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain');
  const raw=attached?OpusAiBrain.inspect(item.components['ai-brain']):null;
  if(attached&&(!raw.ok||!raw.record.enabled))return bad('Repair or explicitly enable the retained AI Brain before applying movement.');
  const captured=item.entity.ai?OpusAiBrain.captureLegacy(item.entity.ai):{ok:true,record:OpusAiBrain.create(item.entity.position)};
  if(!captured.ok)return bad(captured.reason);
  const number=value=>typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):NaN;
  const speed=number(input.speed);
  if(!Number.isFinite(speed)||speed<=0)return bad('Move speed must be a finite number above zero.');
  const config=JSON.parse(JSON.stringify(captured.record.config));
  config.mode='simple';config.type=types[id];config.speed=speed;
  if(id==='ai-wander'||id==='ai-flee'){
    const radius=number(input.radius);
    if(!Number.isFinite(radius)||radius<=0)return bad('Movement radius must be a finite number above zero.');
    config.radius=radius;
  }
  if(id==='ai-wander'){
    const p=item.entity.position;
    if(![p.x,p.y,p.z].every(Number.isFinite))return bad('The actor needs a finite position for its Wander anchor.');
    config.base=[p.x,p.y,p.z];
  }
  if(id==='ai-follow'){
    if(typeof input.targetId!=='string')return bad('Choose a named target or Player.');
    if(input.targetId&&!findItemById(input.targetId)?.entity)return bad('The chosen Follow target is unavailable in this level.');
    config.targetId=input.targetId;
  }
  if(id==='ai-patrol'){
    if(!Array.isArray(input.waypointIds)||!input.waypointIds.length||input.waypointIds.length>128)return bad('Choose an ordered route of existing named Waypoints (up to128).');
    if(typeof input.loop!=='boolean'||typeof input.pingpong!=='boolean')return bad('Choose explicit Loop and Ping-Pong settings.');
    if(input.pingpong&&input.waypointIds.length<2)return bad('Ping-Pong requires at least two route entries.');
    const names=[];
    for(const ref of input.waypointIds){
      const point=typeof ref==='string'?findItemById(ref):null;
      const name=point?.name;
      if(!point?.isWaypoint||!point.entity||typeof name!=='string'||!name.trim()||name!==name.trim()||name.includes(',')||placed.filter(p=>p.isWaypoint&&p.name===name).length!==1)return bad('Each route entry needs an available, uniquely named Waypoint without commas or surrounding spaces.');
      names.push(name);
    }
    config.waypointNames=names.join(',');config.loop=input.loop;config.pingpong=input.pingpong;
  }
  const checked=OpusAiBrain.inspect({...captured.record,config});
  return checked.ok?{ok:true,config:checked.record.config}:bad(checked.reason);
}
function applyAiMovementPreset(item,id,input) {
  const candidate=aiMovementPresetCandidate(item,id,input);
  if(!candidate.ok)return candidate;
  const changed=changeAiBrain(item,ai=>{for(const key of Object.keys(ai))delete ai[key];Object.assign(ai,JSON.parse(JSON.stringify(candidate.config)));});
  return {ok:true,changed,code:changed?'UPDATED':'UNCHANGED'};
}
function aiInvestigationPresetCandidate(item,id,input={}) {
  const bad=reason=>({ok:false,reason});
  if(playMode||item?.kind!=='cube'||!item.entity?.position||!['ai-investigate','ai-investigate-search'].includes(id))return bad('Choose an editable Cube and an investigation recipe.');
  const attached=Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain');
  const raw=attached?OpusAiBrain.inspect(item.components['ai-brain']):null;
  if(attached&&(!raw.ok||!raw.record.enabled))return bad('Repair or explicitly enable the retained AI Brain first.');
  const captured=item.entity.ai?OpusAiBrain.captureLegacy(item.entity.ai):{ok:true,record:OpusAiBrain.create(item.entity.position)};
  if(!captured.ok)return bad(captured.reason);
  const positive=key=>{const value=input[key];return typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):NaN;};
  const keys=id==='ai-investigate'?['speed','hearingRadius']:['speed','hearingRadius','searchRadius','investigateSeconds','searchSeconds','recentNoiseSeconds'];
  const values=Object.fromEntries(keys.map(key=>[key,positive(key)]));
  if(keys.some(key=>!Number.isFinite(values[key])||values[key]<=0))return bad('Speeds, radii and durations must be finite numbers above zero.');
  if(id==='ai-investigate-search'&&values.investigateSeconds+values.searchSeconds<=values.recentNoiseSeconds)return bad('Investigation plus Search must outlast the recent-noise window, so one old noise cannot repeatedly restart the loop.');
  const config=JSON.parse(JSON.stringify(captured.record.config));
  config.type='investigate';config.speed=values.speed;
  config.perception={...(config.perception||{}),hearingRadius:values.hearingRadius};
  if(id==='ai-investigate')config.mode='simple';
  else {
    const old=config.states||[],owned=old.filter(state=>state.presetOwner===id),kept=old.filter(state=>state.presetOwner!==id);
    const used=new Set(kept.map(state=>state.name)),names={};
    for(const [role,label]of [['listen','AI Listen'],['investigate','AI Investigate'],['search','AI Search']]){
      const retained=owned.find(state=>state.presetRole===role)?.name;
      let name=retained||label,index=2;
      while(used.has(name))name=label+' '+index++;
      used.add(name);names[role]=name;
    }
    const state=(role,movement,condition,to)=>({name:names[role],presetOwner:id,presetRole:role,movement,transitions:[{condition,to:names[to]}]});
    config.states=[...kept,
      state('listen',{type:''},{type:'heardNoiseRecently',value:values.recentNoiseSeconds},'investigate'),
      state('investigate',{type:'investigate',speed:values.speed},{type:'timeInStateAtLeast',value:values.investigateSeconds},'search'),
      state('search',{type:'wander',speed:values.speed,radius:values.searchRadius,restartOnEnter:true},{type:'timeInStateAtLeast',value:values.searchSeconds},'listen')];
    config.mode='stateMachine';config.startState=names.listen;
  }
  const checked=OpusAiBrain.inspect({...captured.record,config});
  return checked.ok?{ok:true,config:checked.record.config}:bad(checked.reason);
}
function applyAiInvestigationPreset(item,id,input) {
  const candidate=aiInvestigationPresetCandidate(item,id,input);
  if(!candidate.ok)return candidate;
  const changed=changeAiBrain(item,ai=>{for(const key of Object.keys(ai))delete ai[key];Object.assign(ai,JSON.parse(JSON.stringify(candidate.config)));});
  return {ok:true,changed,code:changed?'UPDATED':'UNCHANGED'};
}
function aiProjectilePrefabIssue(name) {
  if(typeof name!=='string'||!name.trim())return 'Choose a named single-Cube projectile Prefab.';
  const matches=prefabs.filter(p=>p.name===name);
  if(matches.length!==1)return matches.length?'Projectile Prefab name is ambiguous; use a unique name.':'Saved projectile Prefab is unavailable.';
  const prefab=matches[0],record=prefab.record;
  if(prefab.records||!record||typeof record!=='object'||Array.isArray(record)||(record.kind!==undefined&&record.kind!=='cube'))return 'Projectiles require a single Cube Prefab, not an assembly or Sprite.';
  if(![record.color,record.scale].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||record.scale.some(v=>v===0))return 'Projectile Prefab needs finite Cube color and nonzero scale data.';
  return null;
}
function aiAttackAuthoringStatus(attack) {
  if(attack?.mode==='stateMachine')return 'Inactive here — State Machine uses the active state\'s attack settings.';
  if(!attack?.attackEnabled)return 'Disabled — no projectiles fire.';
  for(const key of ['attackRadius','attackCooldown','attackSpeed'])if(attack[key]!==undefined&&(!Number.isFinite(attack[key])||attack[key]<=0))return 'Invalid tuning: range, cooldown and speed must be finite and above zero.';
  if(attack.attackDamage!==undefined&&(!Number.isFinite(attack.attackDamage)||attack.attackDamage<0))return 'Invalid tuning: damage must be finite and nonnegative.';
  if(attack.attackDamageType!==undefined&&!['ordinary','fire','ice'].includes(attack.attackDamageType))return 'Invalid damage type retained; choose Ordinary, Fire or Ice.';
  return aiProjectilePrefabIssue(attack.attackPrefab)||'Ready — fires when the resolved target is within XYZ range.';
}
function aiProjectileChoiceHtml(value,id) {
  const compatible=prefabs.filter(p=>!aiProjectilePrefabIssue(p.name));
  const retained=value&&aiProjectilePrefabIssue(value);
  return `<select id="${escapeHtml(id)}"><option value="">Choose single-Cube projectile</option>${retained?`<option value="${escapeHtml(value)}" selected disabled>Retained ${escapeHtml(value)} — unavailable/incompatible</option>`:''}${compatible.map(p=>`<option value="${escapeHtml(p.name)}"${value===p.name?' selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select>`;
}
function aiDamageTypeChoiceHtml(value,attribute) {
  const current=value===undefined?'ordinary':value;
  return `<select ${attribute}>${!['ordinary','fire','ice'].includes(current)?`<option value="${escapeHtml(String(current))}" selected disabled>Unsupported damage type retained</option>`:''}${['ordinary','fire','ice'].map(type=>`<option value="${type}"${current===type?' selected':''}>${type[0].toUpperCase()+type.slice(1)}</option>`).join('')}</select>`;
}
function refreshAiAttackFeedback(item) {
  const simple=document.getElementById('ai-attack-status');
  if(simple)simple.textContent=aiAttackAuthoringStatus(item.entity.ai);
  document.querySelectorAll('[data-state-attack-status]').forEach(el=>{el.textContent=aiAttackAuthoringStatus(item.entity.ai?.states?.[Number(el.getAttribute('data-state-attack-status'))]?.attack);});
}
function wireAiBrainAuthoring(item) {
  if(item?.kind!=='cube')return;
  const raw=item.components?.['ai-brain'];
  const blocked=playMode||(Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain')&&!OpusAiBrain.inspect(raw).ok);
  const bind=(id,update,redraw=false)=>{const el=document.getElementById(id);if(!el)return;
    el.disabled=blocked;
    const handler=()=>{if(changeAiBrain(item,ai=>update(ai,el))&&redraw)renderInspector();if(typeof refreshAiAttackFeedback==='function')refreshAiAttackFeedback(item);};
    if(el.type==='checkbox'||el.tagName==='SELECT'||el.tagName==='BUTTON')el.onchange=handler;else el.oninput=handler;
  };
  bind('f-ai-type',(ai,el)=>{if(!el.value)return null;ai.type=el.value;},true);
  // Selector fields use the same detached authored transaction as ordinary AI.
  // A handler from a retired Inspector must not edit its formerly selected owner.
  const bindSelector=(id,update,redraw=false)=>bind(id,(ai,el)=>{
    if(document.getElementById(id)!==el)return;
    update(ai,el);
  },redraw);
  bindSelector('f-ai-target-selection',(ai,el)=>{
    if(el.value==='fixed'){if(ai.targetSelection!==undefined)ai.targetSelection='fixed';}
    else if(el.value==='nearestTag'){
      ai.targetSelection='nearestTag';
      if(ai.targetTag===undefined)ai.targetTag='enemy';
      if(ai.targetRange===undefined)ai.targetRange=ai.attackRadius??8;
    }
  },true);
  bindSelector('f-ai-target-tag',(ai,el)=>{ai.targetTag=el.value;});
  bindSelector('f-ai-target-range',(ai,el)=>{ai.targetRange=el.value===''?NaN:Number(el.value);});
  bind('f-ai-attack-type',(ai,el)=>{if(['ordinary','fire','ice'].includes(el.value))ai.attackDamageType=el.value;});
  for(const [id,key]of [['f-ai-speed','speed'],['f-ai-radius','radius'],['f-ai-patrol-speed','speed'],['f-ai-path-speed','speed'],['f-ai-attack-radius','attackRadius'],['f-ai-attack-cooldown','attackCooldown'],['f-ai-attack-damage','attackDamage'],['f-ai-attack-speed','attackSpeed'],['f-ai-collision-radius','collisionRadius']])bind(id,(ai,el)=>{ai[key]=el.value===''?NaN:Number(el.value);});
  for(const [id,key]of [['f-ai-target','targetId'],['f-ai-waypoints','waypointNames'],['f-ai-path','pathId']])bind(id,(ai,el)=>{ai[key]=el.value;});
  bind('f-ai-attack-prefab',(ai,el)=>{const issue=el.value&&aiProjectilePrefabIssue(el.value);if(issue){showStatus(issue);return;}ai.attackPrefab=el.value;});
  for(const [id,key]of [['f-ai-loop','loop'],['f-ai-pingpong','pingpong'],['f-ai-path-pingpong','pingpong'],['f-ai-attack-enabled','attackEnabled'],['f-ai-solid-collision','collideWithSolids']])bind(id,(ai,el)=>{ai[key]=el.checked;},true);
  bind('f-ai-statemachine-mode',(ai,el)=>{ai.mode=el.checked?'stateMachine':'simple';if(el.checked&&!ai.states)ai.states=[];},true);
  for(const [id,key]of [['f-ai-vision-distance','visionDistance'],['f-ai-fov','fovDegrees'],['f-ai-hearing-radius','hearingRadius']])bind(id,(ai,el)=>{ai.perception={...(ai.perception||{}),[key]:el.value===''?NaN:Number(el.value)};});
  bind('f-ai-requires-los',(ai,el)=>{ai.perception={...(ai.perception||{}),requiresLOS:el.checked};});
  const stateBind=(attribute,update,event='onchange',redraw=false)=>{
    document.querySelectorAll?.(`[data-${attribute}]`).forEach(el=>{
      el.disabled=blocked;el.oninput=null;
      el[event]=()=>{if(changeAiBrain(item,ai=>update(ai,el,el.getAttribute(`data-${attribute}`)))&&redraw)renderInspector();if(typeof refreshAiAttackFeedback==='function')refreshAiAttackFeedback(item);};
    });
  };
  stateBind('state-start',(ai,el,i)=>{ai.startState=ai.states[Number(i)].name;},'onclick',true);
  stateBind('state-remove',(ai,el,i)=>{const name=ai.states[Number(i)].name;ai.states.splice(Number(i),1);for(const s of ai.states)s.transitions=(s.transitions||[]).filter(t=>t.to!==name);if(ai.startState===name){if(ai.states.length)ai.startState=ai.states[0].name;else delete ai.startState;}},'onclick',true);
  stateBind('state-name',(ai,el,i)=>{const s=ai.states[Number(i)],old=s.name;s.name=el.value;if(ai.startState===old)ai.startState=el.value;for(const state of ai.states)for(const t of state.transitions||[])if(t.to===old)t.to=el.value;},'onchange',true);
  for(const [attr,key,number]of [['state-movetype','type',false],['state-speed','speed',true],['state-radius','radius',true],['state-waypoints','waypointNames',false]])stateBind(attr,(ai,el,i)=>{const state=ai.states[Number(i)];state.movement={...(state.movement||{type:''}),[key]:number?(el.value===''?NaN:Number(el.value)):el.value};});
  stateBind('state-restart-wander',(ai,el,i)=>{ai.states[Number(i)].movement.restartOnEnter=el.checked;});
  stateBind('state-animrole',(ai,el,i)=>{if(el.value&&!AI_CHARACTER_ANIMATION_ROLES.includes(el.value))return;ai.states[Number(i)].animRole=el.value;});
  stateBind('state-hasattack',(ai,el,i)=>{if(el.checked){if(!ai.states[Number(i)].attack)ai.states[Number(i)].attack={attackEnabled:true,attackPrefab:'',attackRadius:5,attackCooldown:1,attackDamage:10};}else delete ai.states[Number(i)].attack;},'onchange',true);
  stateBind('state-attack-enabled',(ai,el,i)=>{ai.states[Number(i)].attack.attackEnabled=el.checked;});
  stateBind('state-attack-type',(ai,el,i)=>{if(['ordinary','fire','ice'].includes(el.value))ai.states[Number(i)].attack.attackDamageType=el.value;});
  stateBind('state-attack-target',(ai,el,i)=>{if(el.value&&!findItemById(el.value)?.entity){showStatus('Choose an available named target or Player.');return;}const state=ai.states[Number(i)];state.movement={...(state.movement||{type:''}),targetId:el.value};});
  const stateSelectorBind=(attribute,update,event='oninput',redraw=false)=>stateBind(attribute,(ai,el,i)=>{
    if(!Array.from(document.querySelectorAll(`[data-${attribute}]`)).includes(el))return;
    const state=ai.states[Number(i)];if(!state)return;
    state.movement={...(state.movement||{type:''})};update(state.movement,el,state);
  },event,redraw);
  stateSelectorBind('state-target-selection',(movement,el,state)=>{
    if(el.value==='fixed'){if(movement.targetSelection!==undefined)movement.targetSelection='fixed';}
    else if(el.value==='nearestTag'){
      movement.targetSelection='nearestTag';
      if(movement.targetTag===undefined)movement.targetTag='enemy';
      if(movement.targetRange===undefined)movement.targetRange=state.attack?.attackRadius??8;
    }
  },'onchange',true);
  stateSelectorBind('state-target-tag',(movement,el)=>{movement.targetTag=el.value;});
  stateSelectorBind('state-target-range',(movement,el)=>{movement.targetRange=el.value===''?NaN:Number(el.value);});
  for(const [attr,key]of [['state-attack-radius','attackRadius'],['state-attack-cooldown','attackCooldown'],['state-attack-damage','attackDamage'],['state-attack-speed','attackSpeed']])stateBind(attr,(ai,el,i)=>{ai.states[Number(i)].attack[key]=el.value===''?NaN:Number(el.value);});
  document.querySelectorAll?.('[id^="state-attack-prefab-"]').forEach(el=>{el.disabled=blocked;el.onchange=()=>{const issue=el.value&&aiProjectilePrefabIssue(el.value);if(issue){showStatus(issue);return;}changeAiBrain(item,ai=>{ai.states[Number(el.id.slice('state-attack-prefab-'.length))].attack.attackPrefab=el.value;});if(typeof refreshAiAttackFeedback==='function')refreshAiAttackFeedback(item);};});
  stateBind('tr-add',(ai,el,i)=>{const s=ai.states[Number(i)];s.transitions=s.transitions||[];s.transitions.push({condition:{type:'distanceToPlayerAtMost',value:10},to:ai.states[0].name});},'onclick',true);
  for(const attr of ['tr-cond','tr-value','tr-to'])stateBind(attr,(ai,el,indices)=>{
    const [si,ti]=indices.split(':').map(Number),t=ai.states[si].transitions[ti];
    if(attr==='tr-to')t.to=el.value;
    else if(attr==='tr-cond'){
      if(!AI_CONDITION_TYPES.includes(el.value)||t.condition?.type===el.value)return;
      t.condition={...(t.condition||{}),type:el.value};
      if(['distanceToPlayerAtMost','distanceToPlayerAtLeast','healthAtMost','timeInStateAtLeast','heardNoiseRecently'].includes(el.value)){
        if(!Number.isFinite(t.condition.value))t.condition.value=el.value==='heardNoiseRecently'?3:0;
      }else delete t.condition.value;
    }else if(['distanceToPlayerAtMost','distanceToPlayerAtLeast','healthAtMost','timeInStateAtLeast','heardNoiseRecently'].includes(t.condition?.type))t.condition.value=el.value===''?NaN:Number(el.value);
  },'onchange',true);
  for(const attr of ['tr-remove','tr-up','tr-down'])stateBind(attr,(ai,el,indices)=>{
    const [si,ti]=indices.split(':').map(Number),edges=ai.states[si].transitions;
    if(attr==='tr-remove'){edges.splice(ti,1);return;}
    const next=ti+(attr==='tr-up'?-1:1);
    if(next<0||next>=edges.length)return;
    [edges[ti],edges[next]]=[edges[next],edges[ti]];
  },'onclick',true);
  for(const attr of ['tr-up','tr-down'])document.querySelectorAll?.(`[data-${attr}]`).forEach(el=>{
    const [si,ti]=el.getAttribute(`data-${attr}`).split(':').map(Number),edges=item.entity.ai?.states?.[si]?.transitions;
    el.disabled=blocked||!edges||(attr==='tr-up'?ti===0:ti===edges.length-1);
  });
  stateBind('entry-add',(ai,el,i)=>{const s=ai.states[Number(i)];s.entryActions=s.entryActions||[];s.entryActions.push({action:'message',params:{}});},'onclick',true);
  stateBind('entry-action',(ai,el,indices)=>{const [si,ei]=indices.split(':').map(Number),entry=ai.states[si].entryActions[ei];if(entry.action===el.value||!ANIMATION_EVENT_ACTIONS.includes(el.value))return;ai.states[si].entryActions[ei]={action:el.value,params:{}};},'onchange',true);
  stateBind('entry-remove',(ai,el,indices)=>{const [si,ei]=indices.split(':').map(Number);ai.states[si].entryActions.splice(ei,1);},'onclick',true);
  document.querySelectorAll?.('[data-ai-entry-fields]').forEach(container=>{
    const [si,ei]=container.getAttribute('data-ai-entry-fields').split(':').map(Number);
    container.querySelectorAll('[data-field]').forEach(input=>{
      input.disabled=blocked;
      const handler=()=>changeAiBrain(item,ai=>{
        const entry=ai.states[si].entryActions[ei],field=ACTION_TYPES[entry.action]?.fields?.find(f=>f.key===input.dataset.field);
        if(!field)return;
        const value=field.type==='number'?(input.value.trim()===''?NaN:Number(input.value)):readActionFieldValue(field,input);
        entry.params={...(entry.params||{}),[field.key]:value};
      });
      input.oninput=handler;input.onchange=handler;
    });
  });
  // Selection only changes focus, never authored state or history. The same
  // cards remain the detailed editor for these canonical nodes and edges.
  for(const attr of ['ai-state-node','ai-state-edge'])document.querySelectorAll?.(`[data-${attr}]`).forEach(el=>{
    const reveal=()=>{
      const key=el.getAttribute(`data-${attr}`),index=key.split(':')[0];
      const card=document.querySelector?.(`[data-state-index="${index}"]`);
      card?.scrollIntoView?.({block:'nearest'});
      const field=attr==='ai-state-edge'?document.querySelector?.(`[data-tr-cond="${key}"]`):document.querySelector?.(`[data-state-name="${index}"]`);
      field?.focus?.();
    };
    el.onclick=reveal;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal();}};
  });
  const add=document.getElementById('ai-state-add-btn');if(add){add.disabled=blocked;add.onclick=()=>{if(changeAiBrain(item,ai=>{ai.states=ai.states||[];let i=1;while(ai.states.some(s=>s.name===`state${i}`))i++;ai.states.push({name:`state${i}`,movement:{type:'',speed:3,radius:5},transitions:[]});if(!ai.startState)ai.startState=ai.states[0].name;}))renderInspector();};}
}
function renderAiPerceptionFields(item) {
  const el = document.getElementById('ai-perception-fields');
  if (!el) return;
  const ai = item.entity.ai;
  const captured=OpusAiBrain.captureLegacy(ai);
  const attached=Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain');
  if(!captured.ok||(attached&&!OpusAiBrain.inspect(item.components['ai-brain']).ok)){
    el.innerHTML='<p>Retained AI data needs explicit repair or removal; no perception preview is inferred.</p>';
    wireAiBrainAuthoring(item);return;
  }
  const raw = ai.perception || {};
  const p = {visionDistance:raw.visionDistance??15,fovDegrees:raw.fovDegrees??100,requiresLOS:raw.requiresLOS!==false,hearingRadius:raw.hearingRadius??0};
  el.innerHTML = `
    <h4 style="margin:8px 0 4px">Perception</h4>
    <div style="font-size:11px;color:#a9b7cc">Vision uses the actor's heading on the ground plane. Hearing uses 3D distance; set a radius above zero to listen. State conditions use these senses; Simple movement does not automatically react to them.</div>
    <div class="field-triple">
      <div><label style="font-size:10px;color:#66759a">Vision Distance</label><input type="number" id="f-ai-vision-distance" step="0.5" min="0" value="${p.visionDistance}"></div>
      <div><label style="font-size:10px;color:#66759a">FOV (degrees)</label><input type="number" id="f-ai-fov" step="1" min="1" max="360" value="${p.fovDegrees}"></div>
      <div><label style="font-size:10px;color:#66759a">Hearing Radius</label><input type="number" id="f-ai-hearing-radius" step="0.5" min="0" value="${p.hearingRadius}"></div>
    </div>
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#c7d3ea;margin-top:3px"><input type="checkbox" id="f-ai-requires-los"${p.requiresLOS ? ' checked' : ''}> Requires Line Of Sight</label>
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#c7d3ea;margin-top:6px"><input type="checkbox" id="f-ai-show-perception"${showAiPerception ? ' checked' : ''}> Show perception in scene</label>
    <div style="font-size:10.5px;color:#a9b7cc">Selected actor only, hidden in Play. Cyan: vision/FOV. Amber: hearing sphere's horizontal section. Dashed line: legacy Player spawn LOS preview through visible solid Cubes, not a live detection trace.</div>`;
  wireAiBrainAuthoring(item);
  const toggle=document.getElementById('f-ai-show-perception');
  if(toggle){toggle.disabled=playMode;toggle.onchange=()=>{showAiPerception=toggle.checked;syncAiPerceptionOverlay();};}
}
function renderAiStateList(item) {
  const listEl = document.getElementById('ai-state-list');
  if (!listEl) return;
  const attached = Object.prototype.hasOwnProperty.call(item.components || {}, 'ai-brain');
  const captured = OpusAiBrain.captureLegacy(item.entity.ai);
  if (!captured.ok || (attached && !OpusAiBrain.inspect(item.components['ai-brain']).ok)) {
    listEl.innerHTML = '<p>Retained AI data needs explicit repair or removal; viewing it does not change it.</p>';
    const addBtn = document.getElementById('ai-state-add-btn');
    if (addBtn) addBtn.disabled = true;
    return;
  }
  // Defaults here belong to the view, never to the live authored/runtime data.
  const ai = captured.record.config;
  ai.states = ai.states || [];
  const stateNames = ai.states.map((s) => s.name);
  const point=i=>({x:8+(i%2)*146,y:24+Math.floor(i/2)*88});
  const height=Math.max(100,Math.ceil(ai.states.length/2)*88+20);
  const graphEdges=ai.states.flatMap((s,i)=>(s.transitions||[]).map((tr,ti)=>{
    const target=stateNames.indexOf(tr.to),a=point(i),b=point(target<0?i:target);
    const path=i===target?`M${a.x+110},${a.y+15} C${a.x+145},${a.y-22} ${a.x+145},${a.y+60} ${a.x+110},${a.y+37}`:`M${a.x+60},${a.y+48} C${a.x+60},${a.y+70} ${b.x+60},${b.y-22} ${b.x+60},${b.y}`;
    return `<path d="${path}" fill="none" stroke="#90a8d8" stroke-width="2" marker-end="url(#ai-state-arrow)"><title>${escapeHtml(s.name)} → ${escapeHtml(tr.to)} · priority ${ti+1}</title></path>`;
  })).join('');
  const graphNodes=ai.states.map((s,i)=>{const p=point(i),start=ai.startState?ai.startState===s.name:i===0;return `<g data-ai-state-node="${i}"${start?` data-ai-state-start="${i}"`:''} role="button" tabindex="0" aria-label="Edit state ${escapeHtml(s.name)}${start?', start state':''}" style="cursor:pointer"><title>${escapeHtml(s.name)}${start?' · Start':''}</title><rect x="${p.x}" y="${p.y}" width="120" height="48" rx="8" fill="#182840" stroke="${start?'#5ad4b7':'#7596d5'}" stroke-width="2"/><text x="${p.x+8}" y="${p.y+28}" fill="#e2eafa" font-size="12">${start?'▶ ':''}${escapeHtml(s.name.length>14?s.name.slice(0,13)+'…':s.name)}</text></g>`;}).join('');
  const edgeChoices=ai.states.flatMap((s,i)=>(s.transitions||[]).map((tr,ti)=>`<button type="button" class="toolbar-btn" data-ai-state-edge="${i}:${ti}" style="display:block;width:100%;text-align:left;margin:4px 0;white-space:normal" title="Edit this transition">${escapeHtml(s.name)} → ${escapeHtml(tr.to)} · ${ti+1}. ${escapeHtml(OpusAuthoringLanguage.conditionLabel('ai',tr.condition?.type))}</button>`)).join('');
  const overview=`<section aria-label="State Machine visual editor" style="padding:8px;border:1px solid #42577b;border-radius:8px;margin-bottom:12px;background:#0c1728"><strong>State Machine</strong><p style="font-size:11px;color:#a9bad7">Choose a node or arrow below to edit it. Start is green. The first matching transition wins; use ↑ ↓ to set priority.</p><div style="max-height:350px;overflow:auto"><svg viewBox="0 0 300 ${height}" width="100%" role="group" aria-label="Authored state and transition map"><defs><marker id="ai-state-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#90a8d8"/></marker></defs>${graphEdges}${graphNodes}</svg></div>${edgeChoices||'<p style="font-size:11px">No transitions yet. Add one in a state below.</p>'}</section>`;
  listEl.innerHTML = overview + ai.states.map((s, i) => {
    s.movement = s.movement || { type: '' };
    const isStart = ai.startState ? ai.startState === s.name : i === 0;
    const transitionsHtml = (s.transitions || []).map((tr, ti) => `
      <div data-tr-index="${ti}" style="margin-top:6px;padding:6px;border:1px solid #42577b;border-radius:4px">
        <div style="display:flex;gap:4px;align-items:center"><small>Priority ${ti+1}</small><button class="toolbar-btn" type="button" data-tr-up="${i}:${ti}" title="Move earlier" aria-label="Move transition earlier"${ti===0?' disabled':''}>↑</button><button class="toolbar-btn" type="button" data-tr-down="${i}:${ti}" title="Move later" aria-label="Move transition later"${ti===(s.transitions||[]).length-1?' disabled':''}>↓</button><button class="toolbar-btn" type="button" data-tr-remove="${i}:${ti}" title="Remove transition">Remove</button></div>
        <label>When</label>
        <select data-tr-cond="${i}:${ti}">${tr.condition?.type&&!AI_CONDITION_TYPES.includes(tr.condition.type)?`<option value="${escapeHtml(tr.condition.type)}" selected disabled>Retained ${escapeHtml(tr.condition.type)} · choose a replacement</option>`:''}${AI_CONDITION_TYPES.map((c) => `<option value="${c}"${tr.condition && tr.condition.type === c ? ' selected' : ''}>${escapeHtml(OpusAuthoringLanguage.conditionLabel('ai', c))}</option>`).join('')}</select>
        ${['distanceToPlayerAtMost','distanceToPlayerAtLeast','healthAtMost','timeInStateAtLeast','heardNoiseRecently'].includes(tr.condition?.type)?`<label>${['timeInStateAtLeast','heardNoiseRecently'].includes(tr.condition.type)?'Seconds':tr.condition.type==='healthAtMost'?'Health':'Distance'}<input type="number" step="0.5" min="0" data-tr-value="${i}:${ti}" value="${tr.condition.value??(tr.condition.type==='heardNoiseRecently'?3:0)}"></label>`:'<small>True / false condition; no numeric threshold.</small>'}
        <label>Go to</label>
        <select data-tr-to="${i}:${ti}">${stateNames.map((n) => `<option value="${escapeHtml(n)}"${tr.to === n ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>
      </div>`).join('');
    const entryHtml = (s.entryActions || []).map((ea, ei) => `
      <div class="field-triple" style="margin-top:3px">
        <select data-entry-action="${i}:${ei}">${!ANIMATION_EVENT_ACTIONS.includes(ea.action)?`<option value="${escapeHtml(ea.action)}" selected disabled>Retained ${escapeHtml(ea.action)}</option>`:''}${ANIMATION_EVENT_ACTIONS.map((a) => `<option value="${a}"${ea.action === a ? ' selected' : ''}>${escapeHtml(ACTION_TYPES[a].label)}</option>`).join('')}</select>
        <button data-entry-remove="${i}:${ei}" class="hud-remove-btn">✕</button>
      </div><div data-ai-entry-fields="${i}:${ei}">${(ACTION_TYPES[ea.action]?.fields||[]).map(f=>`<label style="display:block;margin-top:4px">${escapeHtml(f.label)}${renderActionFieldInput(f,(ea.params||{})[f.key],null,ea.params,item)}</label>`).join('')}</div>`).join('');
    return `
    <div class="hud-element-row" data-state-index="${i}" style="border-color:${isStart ? '#4a8a5a' : ''}">
      <div class="hud-element-row-header">
        <span>${isStart ? '▶ ' : ''}${escapeHtml(s.name || '(unnamed)')}</span>
        <div style="display:flex;gap:4px">
          <button data-state-start="${i}" class="toolbar-btn" style="margin-bottom:0;padding:2px 8px" title="Set as start state">Start</button>
          <button data-state-remove="${i}" class="hud-remove-btn" title="Delete state">✕</button>
        </div>
      </div>
      <input type="text" data-state-name="${i}" value="${escapeHtml(s.name || '')}" placeholder="State name (e.g. patrol)">
      <div class="field-triple" style="margin-top:4px">
        <select data-state-movetype="${i}">${AI_MOVEMENT_TYPES.map((t) => `<option value="${t}"${s.movement.type === t ? ' selected' : ''}>${t || '(idle/none)'}</option>`).join('')}</select>
        <input type="number" step="0.1" data-state-speed="${i}" value="${s.movement.speed != null ? s.movement.speed : 3}" placeholder="Speed">
        <input type="number" step="0.5" data-state-radius="${i}" value="${s.movement.radius != null ? s.movement.radius : 5}" placeholder="Radius">
      </div>
      ${s.movement.type==='wander'?`<label style="display:flex;gap:6px;align-items:center;margin-top:4px;font-size:11px"><input type="checkbox" data-state-restart-wander="${i}"${s.movement.restartOnEnter===true?' checked':''}> Restart Wander around current position on each entry</label>`:''}
      <input type="text" data-state-waypoints="${i}" value="${escapeHtml(s.movement.waypointNames || '')}" placeholder="Waypoint names (Patrol Route only)" style="margin-top:4px">
      <label>Movement / attack target selection<select data-state-target-selection="${i}">
        <option value="fixed"${s.movement.targetSelection!=='nearestTag'?' selected':''}>Player / named target (existing)</option>
        <option value="nearestTag"${s.movement.targetSelection==='nearestTag'?' selected':''}>Nearest tagged Cube (3D)</option>
      </select></label>
      ${s.movement.targetSelection==='nearestTag'?`
      <label>Exact target tag<input type="text" data-state-target-tag="${i}" value="${escapeHtml(s.movement.targetTag||'')}"></label>
      <label>Acquisition range (XYZ)<input type="number" min="0" step="0.5" data-state-target-range="${i}" value="${s.movement.targetRange??8}"></label>
      <small>Live visible tagged Cubes only; ignores self. Zero requires the same position. No line-of-sight filter. Attack range remains separate.</small>
      `:''}
      <label class="ai-animation-role-label">State animation role<select data-state-animrole="${i}">${aiStateAnimationRoleOptions(s.animRole)}</select></label>
      <small class="field-help">Uses this character's role mapping while this state is active. Blank leaves the current clip unchanged; temporary Attack/Hit resumes this role afterward.</small>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#c7d3ea;margin-top:4px"><input type="checkbox" data-state-hasattack="${i}"${s.attack ? ' checked' : ''}> Attach ranged attack to this state</label>
      ${s.attack ? `
      <div class="ai-combat-authoring">
        <label><input type="checkbox" data-state-attack-enabled="${i}"${s.attack.attackEnabled?' checked':''}> Enable ranged attack</label>
        <label>Projectile Prefab${aiProjectileChoiceHtml(s.attack.attackPrefab,`state-attack-prefab-${i}`)}</label>
        ${s.movement.targetSelection!=='nearestTag'?`<label>Movement / attack Target${renderActionFieldInput({key:'targetId',type:'target',emptyLabel:'Player'},s.movement.targetId,`state-attack-target-${i}`,null,item).replace('<select ',`<select data-state-attack-target="${i}" `)}</label>`:''}
        <div class="ai-combat-grid">
          <label>Range (XYZ units)<input type="number" min="0.1" step="0.1" data-state-attack-radius="${i}" value="${s.attack.attackRadius || 8}"></label>
          <label>Cooldown (seconds)<input type="number" min="0.1" step="0.1" data-state-attack-cooldown="${i}" value="${s.attack.attackCooldown || 1.5}"></label>
          <label>Damage (0 allowed)<input type="number" min="0" step="1" data-state-attack-damage="${i}" value="${s.attack.attackDamage ?? 10}"></label>
          <label>Damage Type${aiDamageTypeChoiceHtml(s.attack.attackDamageType,`data-state-attack-type="${i}"`)}</label>
          <label>Projectile speed (units/sec)<input type="number" min="0.1" step="0.1" data-state-attack-speed="${i}" value="${s.attack.attackSpeed || 12}"></label>
        </div>
        <small data-state-attack-status="${i}" role="status">${escapeHtml(aiAttackAuthoringStatus(s.attack))}</small>
        <small>Uses this state's movement target selection. Nearest tagged Cube has no Player fallback; existing Player / named mode uses Player only when no name is chosen. Cooldown belongs to this state and survives re-entry; Save/reopen starts a fresh runtime. No automatic line-of-sight test.</small>
      </div>` : ''}
      <div style="margin-top:6px;font-size:10px;color:#66759a">Transitions (priority = order):</div>
      ${transitionsHtml}
      <button data-tr-add="${i}" class="toolbar-btn" style="margin-top:3px;padding:2px 8px">+ Transition</button>
      <div style="margin-top:6px;font-size:10px;color:#66759a">Entry actions:</div>
      ${entryHtml}
      <button data-entry-add="${i}" class="toolbar-btn" style="margin-top:3px;padding:2px 8px">+ Entry Action</button>
    </div>`;
  }).join('') || '<p style="color:#66759a;font-size:11px;margin:2px 0">No states yet -- add one below.</p>';

  wireAiBrainAuthoring(item);
}
function itemDisplayName(item, index) {
  return item.name || itemLabel(item, index != null ? index : placed.indexOf(item));
}
// selectedItem: the "primary" selection -- the last item clicked or
// shift-toggled. Stays meaningful even with multiple selected: when
// selectedItems.size === 1, selectedItem is that one item, used for the
// full single-item inspector (property editing across a heterogeneous
// multi-selection isn't attempted -- see renderInspector's multi-select
// branch, which only offers Duplicate All / Delete All).
let selectedItem = null;
let selectedItems = new Set();
// Waypoint Graph connection lines (Wave 4) -- a thin stretched cube between
// each connected pair, reusing the existing cube mesh/entity pipeline
// rather than a new GL_LINES draw path (no line-rendering primitive existed
// in this renderer before this feature, and building one for exactly one
// consumer wasn't worth it). Keyed by a canonical "loId|hiId" string so
// each bidirectional pair gets exactly one line entity, not two overlapping
// ones. Editor-only furniture -- hidden during Play the same way every
// other marker (gizmo handles, selection markers, Camera/Spawner/Light
// placeholders) already is.
const waypointConnectionLines = new Map(); // "loId|hiId" -> line entity
function waypointConnectionSummary(item) {
  const outgoing=[],incoming=[],issues=[];
  const raw=item?.connections;
  if(raw!==undefined&&!Array.isArray(raw))issues.push('Connections are malformed; retained unchanged. Repair the source record before editing links.');
  const seen=new Set();
  for(const id of Array.isArray(raw)?raw:[]){
    const other=typeof id==='string'?findItemById(id):null;
    const status=typeof id!=='string'?'Invalid reference':id===item.id?'Self link':!other?'Missing Waypoint':!other.isWaypoint?'Not a Waypoint':seen.has(id)?'Duplicate link':Array.isArray(other.connections)&&other.connections.includes(item.id)?'Two-way':'Outgoing only';
    outgoing.push({id,item:other,status});seen.add(id);
    if(!['Two-way','Outgoing only'].includes(status))issues.push(status);
  }
  for(const other of placed){if(other!==item&&other.isWaypoint&&Array.isArray(other.connections)&&other.connections.includes(item.id))incoming.push(other);}
  return {outgoing,incoming,issues};
}
function editWaypointConnection(item,otherId,{remove=false}={}) {
  const bad=reason=>({ok:false,changed:false,reason});
  if(playMode)return bad('Stop Play before editing navigation links.');
  if(!item?.isWaypoint||!placed.includes(item))return bad('Select a Waypoint in this level.');
  if(typeof otherId!=='string')return bad('Choose a named Waypoint reference.');
  if(item.connections!==undefined&&!Array.isArray(item.connections))return bad('Malformed connections retained unchanged; repair the source record first.');
  const other=findItemById(otherId);
  if(!remove&&(!other?.isWaypoint||other===item))return bad('Choose another Waypoint in this level.');
  if(other?.isWaypoint&&other!==item&&other.connections!==undefined&&!Array.isArray(other.connections))return bad('The other Waypoint has malformed connections; no links changed.');
  const before=item.connections||[],otherBefore=other?.isWaypoint&&other!==item?(other.connections||[]):null;
  const next=remove?before.filter(id=>id!==otherId):before.includes(otherId)?before.slice():[...before,otherId];
  const otherNext=otherBefore&&(remove?otherBefore.filter(id=>id!==item.id):otherBefore.includes(item.id)?otherBefore.slice():[...otherBefore,item.id]);
  const changed=JSON.stringify(before)!==JSON.stringify(next)||(otherBefore&&JSON.stringify(otherBefore)!==JSON.stringify(otherNext));
  if(!changed)return {ok:true,changed:false};
  pushUndo();item.connections=next;if(otherNext)other.connections=otherNext;
  renderInspector();showStatus(remove?'Navigation link removed.':'Waypoints connected in both directions.');
  return {ok:true,changed:true};
}
function syncWaypointConnectionLines() {
  const seen = new Set();
  for (const item of placed) {
    if (!item.isWaypoint || !Array.isArray(item.connections)) continue;
    for (const otherId of item.connections) {
      const other = findItemById(otherId);
      if (!other?.isWaypoint || !other.entity || other===item) continue;
      const key = item.id < otherId ? `${item.id}|${otherId}` : `${otherId}|${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const a = item.entity.position, b = other.entity.position;
      const mid = a.add(b).scale(0.5);
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      let line = waypointConnectionLines.get(key);
      if (!line) {
        line = app.addEntity({ mesh: cubeMesh, color: [0.3, 0.85, 0.5], position: mid, scale: new Opus.Vec3(0.08, 0.08, Math.max(0.01, len)) });
        waypointConnectionLines.set(key, line);
      }
      line.position.set(mid.x, mid.y, mid.z);
      line.rotationY = angle;
      line.scale.set(0.08, 0.08, Math.max(0.01, len));
      line.visible = !playMode;
    }
  }
  // Prune lines whose pair no longer exists (deleted waypoint or removed connection).
  for (const [key, line] of waypointConnectionLines) {
    if (!seen.has(key)) { app.scene.remove(line); waypointConnectionLines.delete(key); }
  }
}
app.onUpdate(() => { syncWaypointConnectionLines(); });

