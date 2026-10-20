// ===== Physics Objects =====
// A Cube or model can be made a Physics Object (Inspector): during Play it
// falls with gravity, lands on solid objects and terrain, can be pushed by
// walking into it, bounces and slides to a stop, and Ball shapes roll.
// Authored data (item.physics) saves and exports with the object; motion is
// runtime-only and Play's normal restore puts everything back on Stop.
//
//   item.physics = { enabled, shape: 'box'|'ball', gravity, pushable, mass, bounce, friction }

const PHYSICS_GRAVITY = 20;
const PHYSICS_DEFAULTS = { enabled: true, shape: 'box', gravity: true, pushable: true, mass: 1, bounce: 0.15, friction: 6 };

function normalizePhysicsSettings(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v, d, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  return {
    enabled: raw.enabled !== false,
    shape: raw.shape === 'ball' ? 'ball' : 'box',
    gravity: raw.gravity !== false,
    pushable: raw.pushable !== false,
    mass: num(raw.mass, PHYSICS_DEFAULTS.mass, 0.1, 100),
    bounce: num(raw.bounce, PHYSICS_DEFAULTS.bounce, 0, 0.95),
    friction: num(raw.friction, PHYSICS_DEFAULTS.friction, 0, 30),
  };
}
// World-space box of the body's real mesh (models may have their origin at
// their base, not their centre), falling back to a centred unit cube.
function physicsBounds(item) {
  // Balls roll, so their box must not grow with rotation: a sphere from the
  // mesh's unrotated size.
  if (item.physics && item.physics.shape === 'ball' && typeof surfaceLocalData === 'function') {
    const d = surfaceLocalData(item.entity.mesh), s = item.entity.scale, p = item.entity.position;
    const centre = [0, 1, 2].map((i) => ((d.min[i] + d.max[i]) / 2) * [s.x, s.y, s.z][i]);
    const r = Math.max(...[0, 1, 2].map((i) => ((d.max[i] - d.min[i]) / 2) * Math.abs([s.x, s.y, s.z][i])));
    return { min: [p.x + centre[0] - r, p.y + centre[1] - r, p.z + centre[2] - r], max: [p.x + centre[0] + r, p.y + centre[1] + r, p.z + centre[2] + r] };
  }
  const real = typeof surfaceWorldBounds === 'function' ? surfaceWorldBounds(item.entity) : null;
  if (real) return real;
  const s = item.entity.scale, p = item.entity.position;
  return { min: [p.x - Math.abs(s.x) / 2, p.y - Math.abs(s.y) / 2, p.z - Math.abs(s.z) / 2], max: [p.x + Math.abs(s.x) / 2, p.y + Math.abs(s.y) / 2, p.z + Math.abs(s.z) / 2] };
}
function aabbOverlap(aMin, aMax, bMin, bMax, eps = 1e-4) {
  return aMin[0] < bMax[0] - eps && aMax[0] > bMin[0] + eps && aMin[1] < bMax[1] - eps && aMax[1] > bMin[1] + eps && aMin[2] < bMax[2] - eps && aMax[2] > bMin[2] + eps;
}
// Solid obstacles for a body: other solid visible Cubes/models (including other bodies).
function physicsObstacles(self) {
  const out = [];
  for (const item of placed) {
    if (item === self || item.kind !== 'cube' || !item.entity || item.entity.solid !== true || item.entity.visible === false) continue;
    if (typeof heldObjectItem !== 'undefined' && item === heldObjectItem) continue;
    if (player && item.entity === player.entity) continue;
    const bounds = physicsBounds(item);
    if (bounds) out.push(bounds);
  }
  return out;
}
function terrainHeightUnder(x, z) {
  let best = -Infinity;
  for (const item of placed) {
    if (item.kind !== 'terrain' || !item.handle || typeof item.handle.sampleHeight !== 'function') continue;
    const half = (item.handle.options?.size ?? 22) / 2, p = item.handle.position;
    if (Math.abs(x - p.x) > half || Math.abs(z - p.z) > half) continue;
    best = Math.max(best, item.handle.sampleHeight(x, z));
  }
  return best;
}

// One physics step for one body. `pushVelocity` is the player's horizontal
// velocity when the player is pressing into the body (else null).
function stepPhysicsBody(item, dt, obstacles, pushVelocity) {
  const s = item._phys;
  const settings = item.physics;
  const p = item.entity.position, b0 = physicsBounds(item);
  if (settings.gravity) s.vel.y -= PHYSICS_GRAVITY * dt;
  if (pushVelocity) {
    const share = Math.min(1, 1 / settings.mass); // heavier = slower to push
    s.vel.x += (pushVelocity.x * share - s.vel.x) * Math.min(1, 12 * dt);
    s.vel.z += (pushVelocity.z * share - s.vel.z) * Math.min(1, 12 * dt);
  }
  const box = (pos) => { const d = [pos.x - p.x, pos.y - p.y, pos.z - p.z]; return { min: b0.min.map((v, i) => v + d[i]), max: b0.max.map((v, i) => v + d[i]) }; };
  const blocked = (pos) => { const b = box(pos); return obstacles.some((o) => aabbOverlap(b.min, b.max, o.min, o.max)); };
  let grounded = false;
  const next = p.clone();
  // Axis by axis so a body slides along walls instead of sticking.
  for (const axis of ['x', 'z', 'y']) {
    const move = s.vel[axis] * dt;
    if (move === 0) continue;
    const trial = next.clone(); trial[axis] += move;
    if (!blocked(trial)) { next[axis] = trial[axis]; continue; }
    // Close the gap in a few halving steps, then stop or bounce on this axis.
    let lo = 0, hi = move;
    for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2, t = next.clone(); t[axis] += mid; if (blocked(t)) hi = mid; else lo = mid; }
    next[axis] += lo;
    if (axis === 'y' && s.vel.y < 0) grounded = true;
    s.vel[axis] = Math.abs(s.vel[axis]) > 2 ? -s.vel[axis] * settings.bounce : 0;
  }
  const ground = terrainHeightUnder(next.x, next.z);
  const bottom = b0.min[1] + (next.y - p.y);
  if (bottom < ground) {
    next.y += ground - bottom;
    if (s.vel.y < 0) { grounded = true; s.vel.y = Math.abs(s.vel.y) > 2 ? -s.vel.y * settings.bounce : 0; }
  }
  if (grounded || !settings.gravity) {
    const keep = Math.exp(-settings.friction * dt);
    s.vel.x *= keep; s.vel.z *= keep;
    if (Math.hypot(s.vel.x, s.vel.z) < 0.02) { s.vel.x = 0; s.vel.z = 0; }
  }
  // Balls roll with their travel.
  if (settings.shape === 'ball') {
    const dx = next.x - p.x, dz = next.z - p.z, dist = Math.hypot(dx, dz);
    if (dist > 1e-5) item.entity.quaternion = Opus.Quat.fromAxisAngle(new Opus.Vec3(dz / dist, 0, -dx / dist), dist / Math.max(0.05, (b0.max[1] - b0.min[1]) / 2)).multiply(item.entity.quaternion);
  }
  item.entity.position = next;
  // Fell out of the world: back to where Play started.
  if (next.y < s.start.y - 60) { item.entity.position = s.start.clone(); s.vel = new Opus.Vec3(); }
  s.grounded = grounded;
  return s;
}

// Player push. A solid body stops the player, so measured speed drops to zero
// on contact; push from intent instead: touching the body, a movement key
// held and facing it (or still moving into it), at the player's move speed.
// intent: { moving, facing: Vec3 (flat), speed, velocity: Vec3|null }
function physicsPushFor(item, playerPos, intent, playerRadius) {
  if (!item.physics.pushable || !playerPos || !intent) return null;
  const b = physicsBounds(item), margin = 0.15;
  const mid = { x: (b.min[0] + b.max[0]) / 2, z: (b.min[2] + b.max[2]) / 2 }, half = { x: (b.max[0] - b.min[0]) / 2, z: (b.max[2] - b.min[2]) / 2 };
  const cx = Math.max(b.min[0], Math.min(b.max[0], playerPos.x)), cz = Math.max(b.min[2], Math.min(b.max[2], playerPos.z));
  if (Math.hypot(playerPos.x - cx, playerPos.z - cz) > playerRadius + margin) return null;
  if (playerPos.y + 0.2 < b.min[1] || playerPos.y - 0.2 > b.max[1] + 0.6) return null; // standing on top or far below
  let dx = mid.x - playerPos.x, dz = mid.z - playerPos.z;
  if (item.physics.shape === 'box') { if (Math.abs(dx) / Math.max(half.x, 1e-3) > Math.abs(dz) / Math.max(half.z, 1e-3)) dz = 0; else dx = 0; }
  const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
  let speed = 0;
  if (intent.moving && intent.facing && intent.facing.x * dx + intent.facing.z * dz >= 0.5) speed = intent.speed;
  if (intent.velocity) speed = Math.max(speed, intent.velocity.x * dx + intent.velocity.z * dz);
  if (speed <= 0.1) return null;
  return new Opus.Vec3(dx * speed, 0, dz * speed);
}
function playerPushIntent(dt) {
  if (!player || !player.entity) return null;
  const moving = typeof inputActionDown === 'function' && ['moveForward', 'moveBack', 'moveLeft', 'moveRight'].some((name) => { try { return !!inputActionDown(name); } catch (error) { return false; } });
  const f = player.entity.forward, flat = Math.hypot(f.x, f.z) > 1e-4 ? new Opus.Vec3(f.x / Math.hypot(f.x, f.z), 0, f.z / Math.hypot(f.x, f.z)) : null;
  const pos = player.entity.position;
  const velocity = physicsPlayerPrev ? pos.sub(physicsPlayerPrev).scale(1 / dt) : null;
  const speed = Number.isFinite(currentPlayerSettings?.moveSpeed) ? currentPlayerSettings.moveSpeed * 0.8 : 4;
  return { moving, facing: flat, speed, velocity };
}

let physicsPlayerPrev = null;
function updatePhysicsObjects(dt) {
  if (!playMode || !(dt > 0)) { physicsPlayerPrev = null; return; }
  dt = Math.min(dt, 1 / 30);
  const bodies = placed.filter((item) => item.kind === 'cube' && item.entity && item.physics && item.physics.enabled !== false && (typeof heldObjectItem === 'undefined' || item !== heldObjectItem));
  if (!bodies.length) return;
  const playerPos = player && player.entity ? player.entity.position : null;
  const intent = playerPushIntent(dt);
  physicsPlayerPrev = playerPos ? playerPos.clone() : null;
  const playerRadius = player && Number.isFinite(player.radius) && player.radius > 0 ? player.radius : 0.4;
  for (const item of bodies) {
    item.physics = normalizePhysicsSettings(item.physics);
    if (!item._phys) item._phys = { vel: new Opus.Vec3(), start: item.entity.position.clone(), grounded: false };
    stepPhysicsBody(item, dt, physicsObstacles(item), physicsPushFor(item, playerPos, intent, playerRadius));
  }
  updateObjectTriggers(bodies);
}
// --- Object triggers ---
// Objects with On Object Enter / On Object Exit behaviors notice Physics
// Objects: inside a Trigger Volume, or resting on top of a solid object such
// as a pressure plate. Enter runs for each object that arrives; Exit runs
// when the last one leaves, so a plate stays "pressed" while anything is on it.
function objectTriggerZone(item) {
  const bounds = typeof surfaceWorldBounds === 'function' ? surfaceWorldBounds(item.entity) : null;
  if (!bounds) return null;
  return { min: bounds.min.slice(), max: [bounds.max[0], bounds.max[1] + (item.isTrigger ? 0 : 0.3), bounds.max[2]] };
}
function physicsBodyBox(item) { return physicsBounds(item); }
// Returns { entered: [bodies], emptied: bool } and updates the zone's memory.
function updateObjectTrigger(zoneItem, bodies) {
  const zone = objectTriggerZone(zoneItem);
  const inside = new Set();
  if (zone) for (const body of bodies) {
    if (body === zoneItem) continue;
    const b = physicsBodyBox(body);
    if (aabbOverlap(b.min, b.max, zone.min, zone.max, 1e-3)) inside.add(body.id);
  }
  const before = zoneItem._objectsInside || new Set();
  const entered = bodies.filter((body) => inside.has(body.id) && !before.has(body.id));
  const emptied = before.size > 0 && inside.size === 0;
  zoneItem._objectsInside = inside;
  return { entered, emptied };
}
function updateObjectTriggers(bodies) {
  for (const item of placed.slice()) {
    const scripted = item.script && item.script.enabled !== false && /function\s+onObject(?:Enter|Exit)\s*\(/.test(item.script.code || '');
    if (item.kind !== 'cube' || !item.entity || !(scripted || (item.behaviors || []).some((b) => b.trigger === 'objectEnter' || b.trigger === 'objectExit'))) continue;
    const { entered, emptied } = updateObjectTrigger(item, bodies);
    for (let i = 0; i < entered.length; i++) runBehaviors(item, 'objectEnter');
    if (emptied) runBehaviors(item, 'objectExit');
  }
}
app.onUpdate((dt) => { try { updatePhysicsObjects(dt); } catch (error) { console.warn('Physics Objects:', error); } });
// Play starts fresh: drop runtime motion whenever Play is not running.
app.onUpdate(() => { if (!playMode) for (const item of placed) { if (item._phys) delete item._phys; if (item._objectsInside) delete item._objectsInside; } });

// --- Inspector card ---
function mountPhysicsInspectorSection() {
  const body = document.getElementById('inspector-body');
  if (!body || playMode || selectedItems.size !== 1 || !selectedItem || selectedItem.kind !== 'cube' || !selectedItem.entity || selectedItem.isSpawnPoint || selectedItem.isTrigger || selectedItem.isWaypoint || selectedItem.isPathPoint) return;
  if (body.querySelector('#physics-section')) return;
  const item = selectedItem, settings = normalizePhysicsSettings(item.physics);
  const section = document.createElement('div');
  section.className = 'field-row';
  section.id = 'physics-section';
  section.innerHTML = `<label>Physics Object</label>
    <label class="physics-toggle"><input type="checkbox" id="physics-enabled"${settings && settings.enabled ? ' checked' : ''}> Falls, can be pushed and bounces in Play</label>
    ${settings && settings.enabled ? `<div class="physics-grid">
      <label>Shape <select id="physics-shape"><option value="box"${settings.shape === 'box' ? ' selected' : ''}>Box (slides)</option><option value="ball"${settings.shape === 'ball' ? ' selected' : ''}>Ball (rolls)</option></select></label>
      <label><input type="checkbox" id="physics-gravity"${settings.gravity ? ' checked' : ''}> Gravity</label>
      <label><input type="checkbox" id="physics-pushable"${settings.pushable ? ' checked' : ''}> Player can push</label>
      <label>Weight <input type="number" id="physics-mass" step="0.1" min="0.1" max="100" value="${settings.mass}"></label>
      <label>Bounce <input type="number" id="physics-bounce" step="0.05" min="0" max="0.95" value="${settings.bounce}"></label>
      <label>Friction <input type="number" id="physics-friction" step="0.5" min="0" max="30" value="${settings.friction}"></label>
    </div><div class="field-help">Heavier objects are slower to push. The object stays Solid so the player stands on it and pushes it.</div>` : ''}`;
  body.appendChild(section);
  const commit = (mutate) => { if (playMode || !placed.includes(item)) return; pushUndo(); mutate(); renderInspector(); };
  section.querySelector('#physics-enabled').onchange = (e) => commit(() => {
    if (e.target.checked) { item.physics = { ...PHYSICS_DEFAULTS, ...(item.physics || {}), enabled: true }; item.entity.solid = true; }
    else if (item.physics) item.physics = { ...item.physics, enabled: false };
  });
  const field = (id, key, read) => { const el = section.querySelector(id); if (el) el.onchange = () => commit(() => { item.physics = normalizePhysicsSettings({ ...item.physics, [key]: read(el) }); }); };
  field('#physics-shape', 'shape', (el) => el.value);
  field('#physics-gravity', 'gravity', (el) => el.checked);
  field('#physics-pushable', 'pushable', (el) => el.checked);
  field('#physics-mass', 'mass', (el) => Number(el.value));
  field('#physics-bounce', 'bounce', (el) => Number(el.value));
  field('#physics-friction', 'friction', (el) => Number(el.value));
}

// --- Ready-made physics items (Objects palette) ---
// A built-in ball model: a small UV sphere stored as an ordinary model asset,
// so it saves, exports and copies like any imported model.
const PHYSICS_BALL_ASSET_ID = 'opus-ball';
function physicsBallArrays(rings = 12, segments = 18) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings, phi = v * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const u = s / segments, theta = u * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(theta);
      positions.push(x * 0.5, y * 0.5, z * 0.5); normals.push(x, y, z); uvs.push(u, 1 - v);
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < segments; s++) {
    const a = r * (segments + 1) + s, b = a + segments + 1;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  return { positions, normals, uvs, indices };
}
function ensurePhysicsBallAsset() {
  let asset = findAssetById(PHYSICS_BALL_ASSET_ID);
  if (!asset) {
    loadAssets([{ id: PHYSICS_BALL_ASSET_ID, name: 'Ball', type: 'mesh', ...physicsBallArrays(), sourceFilename: 'built-in ball', folder: 'Built-in' }]);
    asset = findAssetById(PHYSICS_BALL_ASSET_ID);
  }
  return asset;
}
function restReadyMade(items, surfaceY) {
  if (Number.isFinite(surfaceY) && typeof restNewItemsOnSurface === 'function') restNewItemsOnSurface(items, surfaceY);
}
// Returns the selected item (or null while a library model loads).
function placeReadyMade(kind, point, surfaceY) {
  if (playMode) return null;
  const at = new Opus.Vec3(point.x, point.y, point.z);
  if (kind === 'physicsCrate') {
    const finish = (item) => {
      if (!item) return;
      item.name = 'Crate';
      item.physics = { ...PHYSICS_DEFAULTS };
      item.entity.solid = true;
      restReadyMade([item], surfaceY);
      selectItem(item); renderSceneList(); renderInspector();
    };
    if (typeof addContentLibraryModel === 'function') {
      addContentLibraryModel('crate', at).then((item) => {
        if (item) finish(item);
        else { placeItem('cube', at); const cube = selectedItem; cube.entity.color = [0.62, 0.45, 0.26]; finish(cube); }
      });
      return null;
    }
    placeItem('cube', at); const cube = selectedItem; cube.entity.color = [0.62, 0.45, 0.26]; finish(cube);
    return cube;
  }
  if (kind === 'physicsBall') {
    const asset = ensurePhysicsBallAsset();
    if (!asset) return null;
    pushUndo(); // placeAssetInstance(..., false) leaves history to the caller
    const item = placeAssetInstance(asset, at, false);
    if (!item) return null;
    item.name = 'Ball';
    item.entity.scale.set(0.8, 0.8, 0.8);
    item.entity.color = [0.95, 0.55, 0.2];
    item.physics = { ...PHYSICS_DEFAULTS, shape: 'ball', mass: 0.5, bounce: 0.5, friction: 1.5 };
    item.entity.solid = true;
    restReadyMade([item], surfaceY);
    if (typeof refreshAssetDiscovery === 'function') refreshAssetDiscovery();
    selectItem(item); renderSceneList(); renderInspector();
    return item;
  }
  if (kind === 'pressurePlate') {
    placeItem('cube', at);
    const plate = selectedItem;
    plate.name = 'Pressure Plate';
    plate.entity.scale.set(1.6, 0.06, 1.6);
    plate.entity.color = [0.95, 0.78, 0.25];
    plate.entity.solid = false; // walk-over: crates slide onto it instead of bumping a step
    restReadyMade([plate], surfaceY);
    placeItem('cube', new Opus.Vec3(at.x, at.y, at.z + 4));
    const door = selectedItem;
    door.name = 'Plate Door';
    door.entity.scale.set(2.4, 2.6, 0.3);
    door.entity.color = [0.45, 0.32, 0.22];
    door.entity.solid = true;
    restReadyMade([door], surfaceY);
    plate.behaviors = [
      { trigger: 'objectEnter', action: 'setVisibility', params: { targetId: door.id, visible: false } },
      { trigger: 'objectExit', action: 'setVisibility', params: { targetId: door.id, visible: true } },
    ];
    selectedItems.clear(); selectedItems.add(plate); selectedItems.add(door); selectedItem = plate;
    syncSelectionMarkers(); renderSceneList(); renderInspector();
    showStatus('Pressure Plate + Door: push a Physics Object onto the plate to open the door');
    return plate;
  }
  // A flat walk-over pad that runs its behaviors when the player steps on it.
  const pad = (name, color, position, behaviors) => {
    placeItem('cube', position);
    const item = selectedItem;
    item.name = name;
    item.entity.scale.set(1.6, 0.08, 1.6);
    item.entity.color = color;
    item.entity.solid = false;
    item.padTrigger = true;
    item.behaviors = behaviors;
    restReadyMade([item], surfaceY);
    return item;
  };
  if (kind === 'jumpPad') {
    const item = pad('Jump Pad', [0.2, 0.75, 0.95], at, [{ trigger: 'enter', action: 'launchPlayer', params: { force: 14 } }]);
    selectItem(item); renderSceneList(); renderInspector();
    return item;
  }
  if (kind === 'teleporterPair') {
    const a = pad('Teleporter A', [0.65, 0.35, 0.95], at, []);
    const b = pad('Teleporter B', [0.65, 0.35, 0.95], new Opus.Vec3(at.x + 8, at.y, at.z), []);
    a.behaviors = [{ trigger: 'enter', action: 'teleportPlayer', params: { targetId: b.id } }];
    b.behaviors = [{ trigger: 'enter', action: 'teleportPlayer', params: { targetId: a.id } }];
    selectedItems.clear(); selectedItems.add(a); selectedItems.add(b); selectedItem = a;
    syncSelectionMarkers(); renderSceneList(); renderInspector();
    showStatus('Teleporter Pair: drag either pad anywhere; each sends the player beside the other');
    return a;
  }
  if (kind === 'finishLine') {
    const item = pad('Finish Line', [0.95, 0.95, 0.95], at, [{ trigger: 'enter', action: 'win', params: {} }]);
    item.entity.scale.set(4, 0.08, 1.2);
    selectItem(item); renderSceneList(); renderInspector();
    return item;
  }
  return null;
}
for (const [kind, label] of [['physicsCrate', '📦 Physics Crate'], ['physicsBall', '⚽ Physics Ball'], ['pressurePlate', '⏏ Pressure Plate + Door'], ['jumpPad', '🟦 Jump Pad'], ['teleporterPair', '🌀 Teleporter Pair'], ['finishLine', '🏁 Finish Line (Win)']]) {
  const el = document.getElementById(`palette-ready-${kind}`);
  if (!el) continue;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (event) => { if (!playMode) beginPlacementPointerDrag(event, { readyMade: kind }, label, { immediate: true }); });
}
