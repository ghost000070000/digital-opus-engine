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
function physicsHalf(item) {
  const s = item.entity.scale;
  if (item.physics && item.physics.shape === 'ball') { const r = Math.max(s.x, s.y, s.z) / 2; return new Opus.Vec3(r, r, r); }
  return new Opus.Vec3(Math.abs(s.x) / 2, Math.abs(s.y) / 2, Math.abs(s.z) / 2);
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
    const bounds = item.physics && item.physics.enabled !== false
      ? (() => { const h = physicsHalf(item), p = item.entity.position; return { min: [p.x - h.x, p.y - h.y, p.z - h.z], max: [p.x + h.x, p.y + h.y, p.z + h.z] }; })()
      : (typeof surfaceWorldBounds === 'function' ? surfaceWorldBounds(item.entity) : null);
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
  const p = item.entity.position, half = physicsHalf(item);
  if (settings.gravity) s.vel.y -= PHYSICS_GRAVITY * dt;
  if (pushVelocity) {
    const share = Math.min(1, 1 / settings.mass); // heavier = slower to push
    s.vel.x += (pushVelocity.x * share - s.vel.x) * Math.min(1, 12 * dt);
    s.vel.z += (pushVelocity.z * share - s.vel.z) * Math.min(1, 12 * dt);
  }
  const box = (pos) => ({ min: [pos.x - half.x, pos.y - half.y, pos.z - half.z], max: [pos.x + half.x, pos.y + half.y, pos.z + half.z] });
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
  if (next.y - half.y < ground) {
    next.y = ground + half.y;
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
    if (dist > 1e-5) item.entity.quaternion = Opus.Quat.fromAxisAngle(new Opus.Vec3(dz / dist, 0, -dx / dist), dist / Math.max(0.05, half.x)).multiply(item.entity.quaternion);
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
  const p = item.entity.position, half = physicsHalf(item), margin = 0.15;
  const cx = Math.max(p.x - half.x, Math.min(p.x + half.x, playerPos.x)), cz = Math.max(p.z - half.z, Math.min(p.z + half.z, playerPos.z));
  if (Math.hypot(playerPos.x - cx, playerPos.z - cz) > playerRadius + margin) return null;
  if (playerPos.y + 0.2 < p.y - half.y || playerPos.y - 0.2 > p.y + half.y + 0.6) return null; // standing on top or far below
  let dx = p.x - playerPos.x, dz = p.z - playerPos.z;
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
}
app.onUpdate((dt) => { try { updatePhysicsObjects(dt); } catch (error) { console.warn('Physics Objects:', error); } });
// Play starts fresh: drop runtime motion whenever Play is not running.
app.onUpdate(() => { if (!playMode) for (const item of placed) if (item._phys) delete item._phys; });

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
