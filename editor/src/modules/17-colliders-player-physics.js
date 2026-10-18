// --- Explicit Collider data (Wave 6, Priority A/Sections 3-4) ----------
// A visible mesh and its collision shape no longer have to be the same
// thing. `item.collider` is OPTIONAL component data -- `{ shape: 'box'|
// 'sphere', enabled, offset: {x,y,z}, size: {x,y,z} (box) | radius
// (sphere) }` -- authored independently of `entity.scale`/`entity.mesh`.
// Absent (every solid placed before this existed, and the overwhelming
// majority of new ones too) means "derive a box exactly from entity.scale,
// centered on the entity" -- bit-identical to every pre-Wave-6 solid's own
// collision, computed the SAME way it always was, just now funneled
// through this one function so every controller reads collider shape
// consistently instead of four separate copies of "half = scale/2".
// `enabled:false` on an existing collider record falls back to the same
// default-box derivation, rather than meaning "no collision at all" --
// `entity.solid` remains the one true master on/off switch for whether an
// object collides at all, matching its own pre-existing meaning.
// Explicit legacy boxes use scaled local extents and a world-space centre
// offset. Fitting is an authoring command, not a changed historical default.
// Static, unparented mesh instances only: animated/parented bounds require a
// different contract and must not silently become a misleading fitted box.
function meshFittedItemCollider(item, asset) {
  if (!item || item.parentId || item.isRamp || item.entity.skin || !asset || !asset.positions || asset.skin) return null;
  const vertices = asset.positions;
  if (!vertices.length || vertices.length % 3) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i++) {
    if (!Number.isFinite(vertices[i])) return null;
    min[i % 3] = Math.min(min[i % 3], vertices[i]);
    max[i % 3] = Math.max(max[i % 3], vertices[i]);
  }
  const scale = item.entity.scale;
  const size = new Opus.Vec3((max[0] - min[0]) * Math.abs(scale.x), (max[1] - min[1]) * Math.abs(scale.y), (max[2] - min[2]) * Math.abs(scale.z));
  if (![size.x, size.y, size.z].every(v => Number.isFinite(v) && v > 0)) return null;
  const localCenter = new Opus.Vec3((max[0] + min[0]) * scale.x / 2, (max[1] + min[1]) * scale.y / 2, (max[2] + min[2]) * scale.z / 2);
  const center = item.entity.quaternion ? item.entity.quaternion.rotateVec3(localCenter) : localCenter;
  return { shape: 'box', size: { x: size.x, y: size.y, z: size.z }, offset: { x: center.x, y: center.y, z: center.z } };
}
// Trees, lamp posts and statues: a full bounding box would block the whole
// canopy, so fit the footprint of the mesh's lowest quarter (trunk/base) and
// extend it to the full height.
function meshTrunkItemCollider(item, asset) {
  const full = meshFittedItemCollider(item, asset);
  if (!full) return null;
  const vertices = asset.positions;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < vertices.length; i += 3) { minY = Math.min(minY, vertices[i]); maxY = Math.max(maxY, vertices[i]); }
  const cutoff = minY + (maxY - minY) * 0.25;
  const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 1] > cutoff) continue;
    min[0] = Math.min(min[0], vertices[i]); max[0] = Math.max(max[0], vertices[i]);
    min[1] = Math.min(min[1], vertices[i + 2]); max[1] = Math.max(max[1], vertices[i + 2]);
  }
  if (!(max[0] > min[0] && max[1] > min[1])) return null;
  const scale = item.entity.scale;
  const size = { x: (max[0] - min[0]) * Math.abs(scale.x), y: full.size.y, z: (max[1] - min[1]) * Math.abs(scale.z) };
  const localCenter = new Opus.Vec3((max[0] + min[0]) * scale.x / 2, (maxY + minY) * scale.y / 2, (max[1] + min[1]) * scale.z / 2);
  const center = item.entity.quaternion ? item.entity.quaternion.rotateVec3(localCenter) : localCenter;
  return { shape: 'box', size, offset: { x: center.x, y: center.y, z: center.z } };
}

// Default collision for a placed asset: an explicit asset.colliderPreset, or a
// sensible guess for showcase models (trees block at the trunk, ground cover
// stays walk-through, other props get a fitted box). User-imported models stay
// non-solid unless their asset declares a preset. Never overrides an object
// that already has its own collider or solidity.
function assetDefaultColliderPreset(asset) {
  if (!asset) return null;
  if (['none', 'mesh', 'trunk'].includes(asset.colliderPreset)) return asset.colliderPreset;
  const id = String(asset.id || '');
  if (!id.startsWith('showcase-')) return null;
  if (/tree/.test(id)) return 'trunk';
  if (/bush|grass|flower|fern|moss|undergrowth|weed|decal|banner|light-?beam/.test(id)) return 'none';
  return 'mesh';
}
function applyAssetDefaultCollider(item, asset) {
  if (!item || !item.entity || item.collider || item.entity.solid || item.isTrigger) return false;
  const preset = assetDefaultColliderPreset(asset);
  if (!preset || preset === 'none') return false;
  const fitted = preset === 'trunk' ? meshTrunkItemCollider(item, asset) : meshFittedItemCollider(item, asset);
  if (!fitted) return false;
  item.collider = fitted;
  item.entity.solid = true;
  return true;
}

function itemColliderConfig(item) {
  const c = item.collider;
  const offset = (c && c.offset) ? new Opus.Vec3(c.offset.x || 0, c.offset.y || 0, c.offset.z || 0) : new Opus.Vec3(0, 0, 0);
  if (!c || c.enabled === false || !c.shape || c.shape === 'box') {
    const size = (c && c.shape === 'box' && c.size) ? new Opus.Vec3(c.size.x, c.size.y, c.size.z) : item.entity.scale;
    return { shape: 'box', half: size.scale(0.5), offset };
  }
  // Sphere: radius defaults from the entity's own largest horizontal
  // scale/2 if not explicitly authored, so dropping a Sphere Collider onto
  // an unmodified cube still gives a sensible bounding sphere immediately.
  const radius = c.radius != null ? c.radius : Math.max(item.entity.scale.x, item.entity.scale.z) / 2;
  return { shape: 'sphere', radius, offset };
}

function cameraObstructionCandidates() {
  const result=[];
  for(const item of placed){
    if(!item||item.kind!=='cube'||item.isRamp||!item.entity||item.entity===player?.entity||item.entity.destroyed||item.entity.visible===false||item.entity.solid!==true)continue;
    try{const config=itemColliderConfig(item),center=item.entity.position.add(config.offset),finiteVector=value=>value&&[value.x,value.y,value.z].every(Number.isFinite);
      if(!finiteVector(center))continue;
      if(config.shape==='sphere'){if(Number.isFinite(config.radius)&&config.radius>0)result.push({shape:'sphere',center,radius:config.radius});}
      else if(finiteVector(config.half)&&[config.half.x,config.half.y,config.half.z].every(value=>value>0))result.push({shape:'box',center,half:config.half,quat:item.entity.quaternion});
    }catch(error){/* Malformed authored geometry is not an obstruction candidate. */}
  }
  return result;
}
app.camera.setObstructionQuery((origin,desiredEye,radius)=>Opus.Physics.cameraObstructionDistance(origin,desiredEye,radius,cameraObstructionCandidates()));
// Resolves a mover against ONE item's collider (box or sphere), already
// offset-adjusted -- the shared horizontal solid-push path for Player Controllers.
function resolveItemColliderCollision(moverPosition, moverVelocity, moverRadius, item, previousPosition = null) {
  const slideSwept = (hit) => {
    // The public sweep returns the first contact, not a complete controller
    // step. Preserve the remainder along the surface while removing only
    // inward motion. Subsequent solid candidates still resolve corners.
    if (hit.contactNormal) {
      const remaining = moverPosition.sub(hit.correctedPosition);
      const inward = remaining.dot(hit.contactNormal);
      hit.correctedPosition = hit.correctedPosition.add(remaining.sub(hit.contactNormal.scale(Math.min(0, inward))));
    }
    return hit;
  };
  const cfg = itemColliderConfig(item);
  const center = item.entity.position.add(cfg.offset);
  if (cfg.shape === 'sphere') {
    // Entry-side time of impact must win over endpoint depenetration: a fast
    // mover may end inside the far half and otherwise be pushed THROUGH it.
    if (previousPosition) {
      const swept = Opus.Physics.resolveSweptSphereCollision(previousPosition, moverPosition, moverVelocity, moverRadius, center, cfg.radius);
      if (swept.collided) return slideSwept(swept);
    }
    return Opus.Physics.resolveSphereCollision(moverPosition, moverVelocity, moverRadius, center, cfg.radius);
  }
  const obb = { center, half: cfg.half, quat: item.entity.quaternion };
  if (previousPosition) {
    const swept = Opus.Physics.resolveSweptOrientedBoxCollision(previousPosition, moverPosition, moverVelocity, moverRadius, obb);
    if (swept.collided) return slideSwept(swept);
  }
  return Opus.Physics.resolveOrientedBoxCollision(moverPosition, moverVelocity, moverRadius, obb);
}

function constrainTerrainCeilingRise(collision, previousPosition, radius, halfHeight) {
  // Terrain may raise a grounded body after gravity has been cancelled.
  // That displacement, not velocity.y, can cross a ceiling underside. Do
  // not send an already-underneath player to the far XZ edge of that floor.
  // Reject only this movement frame; teleports/spawns and ordinary landings
  // retain their existing policy. The player can still retreat or crouch.
  if (!collision.collided || collision.correctedPosition.y <= previousPosition.y + 1e-6) return collision;
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.solid || !item.entity.visible || item.isRamp) continue;
    const cfg = itemColliderConfig(item), center = item.entity.position.add(cfg.offset);
    const bottom = center.y - (cfg.shape === 'box' ? cfg.half.y : cfg.radius);
    if (previousPosition.y + halfHeight > bottom + 1e-6 || collision.correctedPosition.y + halfHeight <= bottom + 1e-6) continue;
    const hit = resolveItemColliderCollision(collision.correctedPosition, collision.correctedVelocity, radius, item);
    if (!hit.collided) continue;
    return { ...collision, correctedPosition: previousPosition.clone(), correctedVelocity: new Opus.Vec3() };
  }
  return collision;
}

function reconcilePlayerWallContacts(position, velocity, radius, previousPosition, halfHeight) {
  // Later obstacle responses and the map clamp can invalidate an earlier
  // contact. Reconcile this movement endpoint with the same wall policy;
  // no extra gravity, carry, step, teleport or spawn operation.
  const walls = placed.filter(item => {
    if (item.kind !== 'cube' || !item.entity.solid || !item.entity.visible || (halfHeight !== null && item.isRamp)) return false;
    if (halfHeight === null) return true;
    const cfg = itemColliderConfig(item), center = item.entity.position.add(cfg.offset);
    const h = cfg.shape === 'box' ? cfg.half.y : cfg.radius;
    return position.y + halfHeight > center.y - h + 1e-6 && position.y - halfHeight < center.y + h - 1e-6;
  });
  let pos = position.clone(), vel = velocity.clone();
  const clear = point => walls.every(item => {
    const hit = resolveItemColliderCollision(point, vel, radius, item);
    return !hit.collided || hit.correctedPosition.sub(point).length() < 1e-7;
  });
  // Do not reapply soft map-boundary forces or floating-point contact noise
  // when the controller's final endpoint is already safe.
  if (clear(pos)) return { correctedPosition: pos, correctedVelocity: vel };
  for (let pass = 0; pass < 12; pass++) {
    const before = pos.clone();
    for (const item of walls) {
      const hit = resolveItemColliderCollision(pos, vel, radius, item);
      if (hit.collided) {
        const delta = hit.correctedPosition.sub(pos);
        const boundedHit = applyPlayerPlayBounds(hit.correctedPosition, hit.correctedVelocity, radius);
        const free = new Opus.Vec3(
          Math.abs(boundedHit.correctedPosition.x - hit.correctedPosition.x) < 1e-9 ? delta.x : 0,
          0,
          Math.abs(boundedHit.correctedPosition.z - hit.correctedPosition.z) < 1e-9 ? delta.z : 0);
        // At a map edge the clamped axis cannot satisfy the wall normal.
        // Project its required clearance onto the remaining free axis,
        // rather than repeatedly cancelling almost the whole correction.
        const freeSq = free.dot(free), fullSq = delta.x * delta.x + delta.z * delta.z;
        pos = freeSq > 1e-16 && freeSq < fullSq - 1e-16
          ? applyPlayerPlayBounds(pos.add(free.scale(Math.min(128, fullSq / freeSq))), hit.correctedVelocity, radius).correctedPosition
          : boundedHit.correctedPosition;
        vel = boundedHit.correctedVelocity;
      }
    }
    const boundary = applyPlayerPlayBounds(pos, vel, radius);
    pos = boundary.correctedPosition; vel = boundary.correctedVelocity;
    if (clear(pos)) return { correctedPosition: pos, correctedVelocity: vel };
    if (pos.sub(before).length() < 1e-9) break;
  }
  // Opposed constraints must not advance through a wall. Only reuse a safe
  // pre-move XZ; this is not a global spawn depenetration policy.
  const previous = new Opus.Vec3(previousPosition.x, position.y, previousPosition.z);
  const bounded = applyPlayerPlayBounds(previous, vel, radius).correctedPosition;
  if (bounded.sub(previous).length() < 1e-8 && clear(previous)) {
    return { correctedPosition: previous, correctedVelocity: new Opus.Vec3(0, velocity.y, 0) };
  }
  return { correctedPosition: pos, correctedVelocity: vel };
}

// Vertical box resolution has an axis-aligned public contract. Gate it with
// the actual yaw-oriented footprint, then supply the containing world AABB.
// This avoids both missing the long rotated end and landing on ghost corners.
// Full pitch/roll and historical sphere vertical approximations stay unchanged.
function resolveItemVerticalCollision(position, velocity, radius, halfHeight, item, dt) {
  const cfg = itemColliderConfig(item), center = item.entity.position.add(cfg.offset);
  const half = cfg.shape === 'box' ? cfg.half : new Opus.Vec3(cfg.radius, cfg.radius, cfg.radius);
  let worldHalf = half;
  const quat = item.entity.quaternion;
  if (cfg.shape === 'box' && quat) {
    const axisX = quat.rotateVec3(new Opus.Vec3(1, 0, 0)), axisZ = quat.rotateVec3(new Opus.Vec3(0, 0, 1));
    if (Math.abs(axisX.y) < 1e-6 && Math.abs(axisZ.y) < 1e-6) {
      const local = quat.conjugate().rotateVec3(new Opus.Vec3(position.x - center.x, 0, position.z - center.z));
      const dx = Math.max(0, Math.abs(local.x) - half.x), dz = Math.max(0, Math.abs(local.z) - half.z);
      if (dx * dx + dz * dz >= radius * radius) return { collided: false, grounded: false, correctedPosition: position.clone(), correctedVelocity: velocity.clone() };
      worldHalf = new Opus.Vec3(Math.abs(axisX.x) * half.x + Math.abs(axisZ.x) * half.z, half.y, Math.abs(axisX.z) * half.x + Math.abs(axisZ.z) * half.z);
    }
  }
  const box = new Opus.Physics.AABB(center.sub(worldHalf), center.add(worldHalf));
  return Opus.Physics.resolveVerticalBoxCollision(position, velocity, radius, halfHeight, box, dt);
}

// A later solid can change XZ after an earlier platform's vertical test. Check
// the final footprint with the existing bounded vertical landing contract,
// without a second gravity step or new global depenetration policy. Choose the
// highest valid support.
function resolveFinalItemSupport(position, velocity, radius, halfHeight, dt) {
  let support = null;
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.solid || !item.entity.visible || item.isRamp) continue;
    const hit = resolveItemVerticalCollision(position, velocity, radius, halfHeight, item, dt);
    if (hit.grounded && (!support || hit.correctedPosition.y > support.hit.correctedPosition.y)) support = { item, hit };
  }
  return support;
}

// Wave 6 (Priority B/Section 16): Step Height -- a small stair-step obstacle
// (real stairs are authored as a stack of thin solid boxes, not a special
// primitive) gets auto-climbed instead of blocking the mover sideways, the
// same way a real person's foot doesn't need to "jump" over a curb. Only
// engages for a Box-shaped collider (a Sphere Collider or a Ramp -- which
// already has its own resolveRampCollision -- has no flat "step surface" to
// snap onto) and only while the mover is already grounded (an airborne
// mover mid-jump shouldn't get magnetically snapped onto a ledge it's
// merely passing beside). Deliberately ignores the box's own rotation for
// its top-face height, the exact same simplification resolveVerticalBoxCollision
// already makes for landing -- a yaw-rotated stair step's Y-extent is
// unaffected by that rotation either way. Returns true (and mutates the
// mover's own position/velocity in place) only when it actually stepped up;
// the caller skips the ordinary horizontal push for this item this frame
// when it does, the same "landing and being shoved are mutually exclusive"
// rule the vertical box check already established.
const STEP_HEIGHT = 0.5;
function tryStepUp(moverEntity, moverVelocity, halfHeight, isGrounded, item, moverRadius = 0) {
  if (!isGrounded) return false;
  const cfg = itemColliderConfig(item);
  if (cfg.shape !== 'box') return false;
  const center = item.entity.position.add(cfg.offset);
  const topY = center.y + cfg.half.y;
  const feetY = moverEntity.position.y - halfHeight;
  const stepUpAmount = topY - feetY;
  if (stepUpAmount <= 0 || stepUpAmount > STEP_HEIGHT) return false;
  // Only step up when the mover's XZ footprint (its radius, not just its
  // centre) actually reaches this box's top face. Tall walls are already
  // rejected by the height check above. Requiring the centre itself to be over
  // the face made every low ledge a wall: the solid push keeps the centre one
  // radius outside, so a 28cm landing could never be climbed.
  const local = item.entity.quaternion ? item.entity.quaternion.conjugate().rotateVec3(moverEntity.position.sub(center)) : moverEntity.position.sub(center);
  const reach = Math.max(0, moverRadius) + 0.02;
  if (Math.abs(local.x) > cfg.half.x + reach || Math.abs(local.z) > cfg.half.z + reach) return false;
  moverEntity.position.y = topY + halfHeight;
  if (moverVelocity.y < 0) moverVelocity.y = 0;
  return true;
}

// Wave 6 (Priority B/Section 17): Crouch -- shrinks the mover's own
// collision height, not just a visual pose, so a crouched player genuinely
// fits under a low obstacle a standing one couldn't. Reuses the SAME
// `entity.scale.y` every other height check already reads (`halfHeight =
// entity.scale.y * 0.5`, computed fresh every frame in each controller) --
// no separate "crouch collision shape" needed, crouching IS shrinking the
// mover's real shape. Adjusts `position.y` by half the height delta in the
// SAME call so the mover's FEET stay planted at their current ground height
// instead of sinking through the floor (shrinking around the center) or
// floating (shrinking around the old top). The entity's original standing
// height is cached on the entity itself (`_standingScaleY`) the first time
// this runs, so it can always be restored exactly, even after multiple
// crouch/stand cycles.
const CROUCH_HEIGHT_MULTIPLIER = 0.55;
// Wave 6B (Priority C): bounded ceiling-clearance check -- "is there a
// solid whose underside would overlap the region between the mover's feet
// and its WOULD-BE standing head height, at its current XZ position." An
// axis-aligned-box approximation of each solid's real (possibly oriented/
// sphere) collider is a deliberate, documented simplification for this one
// check -- a true oriented-overlap test would need a real box-vs-box SAT
// routine this engine doesn't have (every existing collision function here
// resolves a CIRCULAR mover against a box, never box-vs-box), and an AABB
// approximation is the same "bounded, not a general solver" scope every
// other collider function in this engine already commits to.
function canStandAt(position, radius, feetY, standingHeadY) {
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.solid || !item.entity.visible || item.isRamp) continue;
    const cfg = itemColliderConfig(item);
    const center = item.entity.position.add(cfg.offset);
    let halfX, halfY, halfZ;
    if (cfg.shape === 'sphere') { halfX = halfY = halfZ = cfg.radius; } else { halfX = cfg.half.x; halfY = cfg.half.y; halfZ = cfg.half.z; }
    const minY = center.y - halfY, maxY = center.y + halfY;
    if (maxY <= feetY || minY >= standingHeadY) continue; // no Y-overlap with the region the head would sweep through while standing
    const dx = Math.abs(position.x - center.x), dz = Math.abs(position.z - center.z);
    if (dx < halfX + radius && dz < halfZ + radius) return false;
  }
  return true;
}
// Returns the ACTUALLY-APPLIED crouch state (which may differ from
// `wantsCrouch` -- releasing Crouch under a low duct must NOT let the
// mover's collision shape instantly expand up through the ceiling above
// it; this is what keeps it crouched until there's real clearance).
function applyCrouchState(entity, wantsCrouch, radius) {
  if (entity._standingScaleY == null) entity._standingScaleY = entity.scale.y;
  const currentlyCrouched = entity.scale.y < entity._standingScaleY - 1e-6;
  let shouldCrouch = wantsCrouch;
  if (!wantsCrouch && currentlyCrouched) {
    const feetY = entity.position.y - entity.scale.y / 2;
    const standingHeadY = feetY + entity._standingScaleY;
    if (!canStandAt(entity.position, radius, feetY, standingHeadY)) shouldCrouch = true;
  }
  const targetScaleY = shouldCrouch ? entity._standingScaleY * CROUCH_HEIGHT_MULTIPLIER : entity._standingScaleY;
  const delta = targetScaleY - entity.scale.y;
  if (Math.abs(delta) > 1e-9) {
    entity.position.y += delta / 2;
    entity.scale.y = targetScaleY;
  }
  return shouldCrouch;
}

function applyPlatformCarry(moverEntity, item, isGroundedOnThis) {
  if (isGroundedOnThis && item._carryPrevPos) {
    const delta = item.entity.position.sub(item._carryPrevPos);
    if (delta.x !== 0 || delta.z !== 0) moverEntity.position = new Opus.Vec3(moverEntity.position.x + delta.x, moverEntity.position.y, moverEntity.position.z + delta.z);
  }
  item._carryPrevPos = item.entity.position.clone();
}

// Wave 6B (Priority A): Skinned Player Character -- a SEPARATE visual
// entity that follows the controller body (position/facing/jump/platform
// carry/respawn/level switches all already move `player.entity`, which
// this just mirrors every frame; the body stays the one authoritative
// physics/collision shape, exactly the "do not make the visual itself the
// collision representation" requirement). Third-Person, Top-Down and the
// Hovercraft controller may use it; First-Person keeps its invisible-body
// convention. Hovercraft accepts a static or skinned authored mesh and is
// only a visual adapter over the existing authoritative craft physics.
let playerVisualEntity = null;
function playerVisualSupportsSkinnedBody() {
  return player && (player.controllerType === 'thirdperson' || player.controllerType === 'topdown' || player.controllerType === 'hovercraft');
}
function setPlayerFallbackVisible(visible) {
  if (player && player.entity) player.entity.visible = visible;
  if (player && player.controllerType === 'hovercraft') for (const part of craftParts) part.entity.visible = visible;
}
function teardownPlayerVisual() {
  if (playerVisualEntity) { app.scene.remove(playerVisualEntity); playerVisualEntity = null; }
  // Public Showcase Recovery pass (Section 6A) -- REAL BUG found live: this
  // runs every single frame for any controller without a skinned visual
  // (see syncPlayerVisual's own early-return into this function), and used
  // to unconditionally restore `player.entity.visible = true`. For First-
  // Person that silently overwrote spawnFirstPersonController's own
  // deliberate `firstPersonEntity.visible = false` ("FPS convention: never
  // render your own body") on the very first frame of Play, re-showing the
  // player's entire primitive collision body -- a large flat-colored box
  // sitting almost inside the camera's own near plane, filling a large
  // fraction of the lower viewport in every First-Person game (confirmed
  // live in Signal Relay, Arsenal Run, and Power Grid). The body must stay
  // physically active (still driving collision) but visually absent for
  // First-Person specifically; Third-Person/Top-Down (whose skinned visual
  // is what this restore line exists for) and Hovercraft are unaffected by
  // this guard since their own primitive body is meant to be visible.
  if (player && player.entity) setPlayerFallbackVisible(player.controllerType !== 'firstperson');
  // Wave 9 (Priority A) fix -- visuals only, NOT the full teardown; see
  // teardownPlayerEquipmentVisualsOnly's own comment. A real Play session
  // start/despawn still calls the FULL teardownPlayerEquipment directly
  // (enterPlayMode, despawnPlayer's own callers) -- this per-frame path
  // must never delete which item is equipped, only its visual.
  // First-person equipment is positioned from the camera independently of
  // the hidden collision body; preserve its entities between frames.
  if (!player || player.controllerType !== 'firstperson') teardownPlayerEquipmentVisualsOnly();
}
// Wave 7 (Priority C): Player Equipment -- a bounded slot layer on top of
// the existing Inventory-lite (window.__gameInventory), NOT a second item
// database. `currentPlayerSettings.equipmentDefs = [{itemName, slot,
// assetId, socketName, scale, weapon}]` is authored data (which inventory
// item name maps to which visual + socket + optional weapon config);
// runtime equip state lives in `playerEquipment`, entirely transient
// (rebuilt by Equip actions, not itself the thing Priority E's Save Game
// persists -- what's SAVED is which item is equipped, not a live entity).
let playerEquipment = {}; // { [slot]: { itemName, def, entity } }
function equipmentDefFor(itemName) {
  return (currentPlayerSettings.equipmentDefs || []).find((d) => d.itemName === itemName);
}
function unequipSlot(slot) {
  const cur = playerEquipment[slot];
  if (cur && cur.entity) app.scene.remove(cur.entity);
  delete playerEquipment[slot];
}
function capturePlayerEquipment(names) {
  const snapshot=Object.create(null);
  for(const slot of Object.keys(names||playerEquipment)){
    const itemName=names?names[slot]:playerEquipment[slot]?.itemName;
    if(typeof itemName!=='string'||!itemName)continue;
    const old=playerEquipment[slot],def=equipmentDefFor(itemName)||(old?.itemName===itemName?old.def:null);
    snapshot[slot]={itemName,def:def?JSON.parse(JSON.stringify(def)):null};
  }
  return snapshot;
}
function restorePlayerEquipment(snapshot) {
  if(!snapshot||typeof snapshot!=='object')return;
  for(const slot of Object.keys(snapshot)){const entry=snapshot[slot];if(entry&&typeof entry.itemName==='string')equipItemToSlot(entry.itemName,slot,entry.def);}
}
function equipItemToSlot(itemName, slot, fallbackDef) {
  if (!player || !slot) return;
  window.__gameInventory = window.__gameInventory || {};
  if ((window.__gameInventory[itemName] || 0) < 1) return; // must actually hold it -- reuses Inventory, no separate item-count database
  // Destination definitions win; a generation transition may retain the
  // previously equipped item's definition without changing authored settings.
  const def = equipmentDefFor(itemName) || (fallbackDef?.itemName===itemName?fallbackDef:null);
  if (!def) return;
  unequipSlot(slot); // always clear whatever was there first -- no orphaned visuals
  let entity = null;
  if (def.assetId) {
    const asset = findAssetById(def.assetId);
    if (asset) {
      entity = app.addEntity({ mesh: getAssetMeshHandle(asset), color: [1, 1, 1], position: new Opus.Vec3(), scale: new Opus.Vec3(def.scale || 1, def.scale || 1, def.scale || 1) });
      const texture = findTextureAssetById(asset.textureAssetId);
      if (texture) applyTextureToEntity(entity, texture);
    }
  }
  playerEquipment[slot] = { itemName, def, entity };
  syncActiveWeaponVisualVisibility(); // Wave 9 (Priority A/Section 23): only the active slot's visual is ever visible
}
// Called every real frame alongside syncPlayerVisual/drivePlayerVisualLocomotion
// so an equipped visual's socket-follow has zero one-frame lag, the same
// reasoning that dispatcher already established for the visual body itself.
// `resolveSocketSourceTransform` (Priority A) only ever reads `.entity`/
// `.assetId` off its first argument -- the Player Visual is not a `placed`
// item and never becomes one, so this minimal duck-typed wrapper is a real
// use of the EXACT SAME composition path every ordinary placed-object
// socket attachment already uses, not a parallel special-cased one.
function syncPlayerEquipmentVisuals() {
  if (player && player.controllerType === 'firstperson') {
    const basis = app.camera.getBasis();
    for (const slot in playerEquipment) {
      const eq = playerEquipment[slot];
      if (!eq.entity) continue;
      const offset = eq.def.firstPersonOffset || { x: 0.25, y: -0.22, z: 0.55 };
      eq.entity.position = app.camera.eye.add(basis.right.scale(offset.x || 0)).add(basis.up.scale(offset.y || 0)).add(basis.forward.scale(offset.z == null ? 0.55 : offset.z));
      const rotation = eq.def.firstPersonRotation || {};
      eq.entity.quaternion = player.entity.quaternion.multiply(Opus.Quat.fromEuler(rotation.x || 0, rotation.y || 0, rotation.z || 0));
    }
    syncActiveWeaponVisualVisibility();
    return;
  }
  if (!playerVisualEntity) return;
  const characterProxy = { entity: playerVisualEntity, assetId: currentPlayerSettings.visual && currentPlayerSettings.visual.assetId };
  for (const slot in playerEquipment) {
    const eq = playerEquipment[slot];
    if (!eq.entity || !eq.def.socketName) continue;
    const t = resolveSocketSourceTransform(characterProxy, eq.def.socketName);
    if (!t) continue;
    eq.entity.position = t.position;
    eq.entity.quaternion = t.quaternion;
  }
}
function teardownPlayerEquipment() {
  for (const slot in playerEquipment) unequipSlot(slot);
  playerEquipment = {};
}
// Wave 9 (Priority A) -- REAL BUG found live dogfooding Equipment Weapon
// mode in First-Person: `syncPlayerVisual` calls `teardownPlayerVisual`
// EVERY FRAME whenever the current controller doesn't support a skinned
// body (First-Person, Hovercraft -- see `playerVisualSupportsSkinnedBody`),
// and `teardownPlayerVisual` called the FULL `teardownPlayerEquipment`
// unconditionally -- wiping `playerEquipment` (which item is in which
// slot) completely, every single frame, for the entire duration of any
// First-Person session. Equipment Weapon mode (Section 22's Primary/
// Secondary switching) was therefore silently impossible in First-Person
// from the moment Wave 7 introduced it, pre-dating this Wave -- exposed
// now because Weapons 2.0's ammo/switching is the first thing that
// actually reads `playerEquipment` back a frame later instead of only
// reading it once, synchronously, right after Equip. Fix: only the
// VISUAL entities need tearing down when there's no skinned body to
// attach them to -- the itemName/def bookkeeping (which drives
// resolveActivePlayerWeapon/switching regardless of whether anything is
// visibly rendered) must survive.
function teardownPlayerEquipmentVisualsOnly() {
  for (const slot in playerEquipment) {
    const eq = playerEquipment[slot];
    if (eq.entity) { app.scene.remove(eq.entity); eq.entity = null; }
  }
}
// Wave 7 (Priority J, Sections 61-64): Pickup/Carry/Drop -- kinematic
// carrying, deliberately independent of the Dynamic Physics gate above
// (which was deferred). `item.carryable` (author flag) opts an ordinary
// placed object into being held; `heldObjectItem` tracks the ONE currently
// held object (this engine's own established "one at a time" bound, same
// spirit as Player Equipment's one-item-per-slot). Held-object POSITION
// sync happens every real frame from the same dispatcher Priority A/C's
// visual/equipment syncs already use.
let heldObjectItem = null;
function pickUpObject(item) {
  if (!item || item.kind !== 'cube' || !item.carryable || heldObjectItem) return;
  heldObjectItem = item;
  item._preCarrySolid = item.entity.solid;
  item.entity.solid = false; // a carried object must not block the very player carrying it
}
function dropHeldObject() {
  if (!heldObjectItem) return;
  heldObjectItem.entity.solid = !!heldObjectItem._preCarrySolid;
  heldObjectItem = null;
}
// Third-Person with a skinned Player Visual: prefer an authored hand
// socket (name containing "hand", case-insensitive -- a real, non-
// hardcoded test of Priority A's socket infrastructure, per the spec's
// own framing of this as "a great test of socket infrastructure"), via
// the exact same `resolveSocketSourceTransform` duck-typed-wrapper reuse
// Priority C's Equipment visuals already established. First-Person (no
// visible body/hand) and any Third-Person character with no hand socket
// authored both fall back to a simple forward-offset hold position.
function syncHeldObjectPosition() {
  if (!heldObjectItem || !player) return;
  const fallback = () => {
    if (player.controllerType === 'firstperson') {
      const basis = app.camera.getBasis();
      heldObjectItem.entity.position = app.camera.eye.add(basis.forward.scale(1.4)).add(basis.right.scale(0.55)).add(basis.up.scale(-0.45));
      return;
    }
    heldObjectItem.entity.position = player.entity.position.add(player.entity.forward.scale(1.6)).add(new Opus.Vec3(0, 0.5, 0));
  };
  if (player.controllerType !== 'firstperson' && playerVisualEntity && playerVisualEntity.skin && currentPlayerSettings.visual) {
    const asset = findAssetById(currentPlayerSettings.visual.assetId);
    const handSocket = asset && asset.sockets && asset.sockets.find((s) => /hand/i.test(s.name));
    if (handSocket) {
      const t = resolveSocketSourceTransform({ entity: playerVisualEntity, assetId: currentPlayerSettings.visual.assetId }, handSocket.name);
      if (t) { heldObjectItem.entity.position = t.position; heldObjectItem.entity.quaternion = t.quaternion; return; }
    }
    fallback();
    return;
  }
  fallback();
}
// The ONE place that creates/tears down/repositions the Player's skinned
// visual -- called every frame (unconditional, like Billboard facing),
// so it stays correct through spawn, movement, platform carry, respawn,
// and a level switch with no special-casing needed at any of those sites.
function syncPlayerVisual() {
  if (!player || !playerVisualSupportsSkinnedBody()) { teardownPlayerVisual(); return; }
  const visual = currentPlayerSettings.visual || defaultPlayerVisual();
  const wantsAuthored = visual.mode === 'skinned' && visual.assetId;
  const asset = wantsAuthored ? findAssetById(visual.assetId) : null;
  const validType = asset && (asset.type === 'skinnedMesh' || (player.controllerType === 'hovercraft' && asset.type === 'mesh'));
  if (!validType) { teardownPlayerVisual(); return; }
  if (!playerVisualEntity) {
    playerVisualEntity = app.addEntity({ mesh: getAssetMeshHandle(asset), color: [1, 1, 1], position: player.entity.position.clone(), scale: new Opus.Vec3(visual.scale || 1, visual.scale || 1, visual.scale || 1) });
    const texture = findTextureAssetById(asset.textureAssetId);
    if (texture) applyTextureToEntity(playerVisualEntity, texture);
  }
  setPlayerFallbackVisible(false); // authored visual owns rendering; primitives remain physics-only
  // Explicit fitted visuals follow the same crouch height as their physical
  // body, keeping authored feet/head alignment instead of burying the model.
  const stance = visual.followBodyHeight === true && player.controllerType === 'thirdperson' ? player.entity.scale.y / playerBodyHeight() : 1;
  playerVisualEntity.scale.set(visual.scale || 1, (visual.scale || 1) * stance, visual.scale || 1);
  const off = visual.positionOffset || { x: 0, y: 0, z: 0 };
  const worldOffset = player.entity.quaternion.rotateVec3(new Opus.Vec3(off.x, off.y * stance, off.z));
  playerVisualEntity.position = player.entity.position.add(worldOffset);
  playerVisualEntity.quaternion = player.entity.quaternion.multiply(Opus.Quat.fromEuler(0, (visual.rotationOffsetY || 0) * Math.PI / 180, 0));
}
// Explicit clip-mapping (Section 5) takes priority; falls back to the same
// name-matching Auto-Animate already uses for AI (Section 6) -- one shared
// keyword table either way, never a second matching convention.
function resolvePlayerClip(role) {
  if (!playerVisualEntity || !playerVisualEntity.skin) return null;
  const visual = currentPlayerSettings.visual || defaultPlayerVisual();
  const mapped = playerClipMappingState(visual,{id:visual.assetId,skin:playerVisualEntity.skin},role);
  if (mapped.status === 'unavailable') return null;
  if (mapped.index != null) return mapped.index;
  return findCharacterClip(playerVisualEntity, CHARACTER_ANIM_KEYWORDS[role] || [role]);
}
// Additive reviewed identities; absent metadata keeps historical numeric behavior.
// An explicit asset switch captures old identities rather than reusing its indices.
function playerClipMappingState(visual,asset,role) {
  const saved=visual.clipMap?.[role],identities=visual.clipMapIdentity;
  if(saved==null)return {status:'automatic',index:null};
  const clips=Array.isArray(asset?.skin?.clips)?asset.skin.clips:[];
  if(identities!==undefined){
    if(!identities||typeof identities!=='object'||Array.isArray(identities))return {status:'unavailable',index:null};
    if(Object.prototype.hasOwnProperty.call(identities,role)){
      const ref=identities[role];
      if(!ref||ref.assetId!==asset?.id||typeof ref.name!=='string'||!ref.name)return {status:'unavailable',index:null};
      const matches=clips.map((clip,index)=>clip?.name===ref.name?index:-1).filter(index=>index>=0);
      return matches.length===1?{status:'ready',index:matches[0]}:{status:'unavailable',index:null};
    }
  }
  return {status:'legacy',index:Number.isInteger(saved)&&clips[saved]?saved:null};
}
// Player locomotion (Section 7) -- driven by the REAL controller state
// (grounded/velocity), not an AI position-delta the way Auto-Animate infers
// it for NPCs (the Player has no `entity.ai` to read a delta from in the
// first place). Reuses `entity.animationClip`/`_animOverrideUntil`, the
// exact same override mechanism Priority M's character state machine
// already established -- no second state system.
function drivePlayerVisualLocomotion() {
  if (!playerVisualEntity || !playerVisualEntity.skin || !player) return;
  const visual = currentPlayerSettings.visual || defaultPlayerVisual();
  playerVisualEntity.animationBlendTime = visual.blendTime != null ? visual.blendTime : 0.15;
  if (playerVisualEntity._animOverrideUntil > simElapsed) return; // Attack/Death override active -- locomotion defers to it
  const vel = player.velocity || new Opus.Vec3();
  const horizSpeed = Math.hypot(vel.x, vel.z);
  const grounded = player.controllerType === 'thirdperson' ? thirdPersonGrounded : true; // Top-Down has no vertical-physics concept
  const settings = currentPlayerSettings;
  const sprintSpeed = (settings.moveSpeed || 6.5) * (settings.sprintSpeedMultiplier ?? 1.6);
  let role;
  if (!grounded && vel.y > 0.5) role = 'jump';
  else if (!grounded && vel.y < -0.5) role = 'fall';
  else if (horizSpeed < 0.3) role = 'idle';
  else if (horizSpeed > sprintSpeed * 0.7) role = 'run';
  else role = 'walk';
  // Graceful fallback chain for an unmapped role (e.g. no Jump clip
  // authored) -- fall back toward Walk, then Idle, rather than leaving the
  // Player frozen on whatever clip happened to be playing before.
  let clipIndex = resolvePlayerClip(role);
  if (clipIndex === null && (role === 'jump' || role === 'fall' || role === 'run')) clipIndex = resolvePlayerClip('walk');
  if (clipIndex === null) clipIndex = resolvePlayerClip('idle');
  if (clipIndex !== null && playerVisualEntity.animationClip !== clipIndex) playerVisualEntity.animationClip = clipIndex;
}
function triggerPlayerAttackAnim() {
  const idx = resolvePlayerClip('attack');
  if (idx === null) return;
  playerVisualEntity.animationClip = idx;
  const duration = playerVisualEntity.skin.clips[idx].duration || 0.5;
  playerVisualEntity._animOverrideUntil = simElapsed + duration;
}
// Wave 9 (Priority A/Section 12): optional Reload clip -- correctness of
// the reload never depends on this playing (Section 13's own "Duration is
// sufficient"); a project with no Reload clip mapped just keeps whatever
// locomotion animation was already showing while the real timer runs.
function triggerPlayerReloadAnim(duration) {
  if (!playerVisualEntity || !playerVisualEntity.skin) return;
  const idx = resolvePlayerClip('reload');
  if (idx === null) return;
  playerVisualEntity.animationClip = idx;
  playerVisualEntity._animOverrideUntil = simElapsed + (duration || playerVisualEntity.skin.clips[idx].duration || 1);
}
function triggerPlayerDeathAnim() {
  const idx = resolvePlayerClip('death');
  if (idx === null) return false;
  playerVisualEntity.animationClip = idx;
  playerVisualEntity._animOverrideUntil = Infinity;
  return true;
}

// Wave 6B (Priority J): Footstep audio -- plays only when grounded AND
// actually moving, at an author-set interval, reading the exact same
// grounded/velocity state the locomotion driver above already computes (no
// second physics read). Scoped to Third-Person/First-Person only, matching
// Crouch/Sprint's own scoping (Priority B) -- Hovercraft/Top-Down have no
// "footsteps on the ground" concept. Fields are read lazily straight off
// `currentPlayerSettings` with sensible code-level defaults (the same
// `?? ` pattern `crouchSpeedMultiplier`/`sprintSpeedMultiplier` already use),
// so a project saved before this priority has none of these fields and is
// completely unaffected (footstepAudioAssetId is null -> the whole function
// is a no-op).
let footstepTimer = 0;
function driveFootstepAudio(dt) {
  const settings = currentPlayerSettings;
  if (!settings.footstepAudioAssetId) return;
  if (player.controllerType !== 'thirdperson' && player.controllerType !== 'firstperson') return;
  const grounded = player.controllerType === 'thirdperson' ? thirdPersonGrounded : firstPersonGrounded;
  const vel = player.velocity || new Opus.Vec3();
  const horizSpeed = Math.hypot(vel.x, vel.z);
  if (!grounded || horizSpeed < 0.3) { footstepTimer = 0; return; }
  footstepTimer += dt;
  const interval = Math.max(0.05, settings.footstepInterval ?? 0.4);
  if (footstepTimer < interval) return;
  footstepTimer -= interval;
  const asset = findAudioAssetById(settings.footstepAudioAssetId);
  if (!asset || !asset.audioBuffer) return;
  const sprintSpeed = (settings.moveSpeed || 6.5) * (settings.sprintSpeedMultiplier ?? 1.6);
  const running = horizSpeed > sprintSpeed * 0.7;
  const volume = running ? (settings.footstepRunVolume ?? 0.7) : (settings.footstepWalkVolume ?? 0.5);
  app.audio.playBuffer(asset.audioBuffer, { volume });
}
// Wave 9B (Silent Sector, Section 17): movement-generated noise -- crouch <
// walk < sprint radii, so a crouch-walking Player is meaningfully quieter
// to nearby AI than a sprinting one. Deliberately reuses the SAME bounded
// step/interval cadence footstep audio above already established (one
// noise event per footstep, not one per frame -- the spec's own explicit
// "do not flood event handling"), and is entirely independent of whether
// footstep AUDIO is configured (`footstepAudioAssetId` unset is a common,
// valid case that should still emit noise for AI hearing to react to).
// Opt-in: `movementNoiseEnabled` unset (every pre-Wave-9B project) means
// this is a complete no-op, so no existing game's AI hearing behavior
// changes just because this function now runs every frame.
let movementNoiseTimer = 0;
function driveMovementNoise(dt) {
  const settings = currentPlayerSettings;
  if (!settings.movementNoiseEnabled || !player) return;
  if (player.controllerType !== 'thirdperson' && player.controllerType !== 'firstperson') return;
  const grounded = player.controllerType === 'thirdperson' ? thirdPersonGrounded : firstPersonGrounded;
  const vel = player.velocity || new Opus.Vec3();
  const horizSpeed = Math.hypot(vel.x, vel.z);
  if (!grounded || horizSpeed < 0.3) { movementNoiseTimer = 0; return; }
  movementNoiseTimer += dt;
  const interval = Math.max(0.05, settings.footstepInterval ?? 0.4);
  if (movementNoiseTimer < interval) return;
  movementNoiseTimer -= interval;
  const sprintSpeed = (settings.moveSpeed || 6.5) * (settings.sprintSpeedMultiplier ?? 1.6);
  const running = horizSpeed > sprintSpeed * 0.7;
  const radius = player.crouching ? (settings.crouchNoiseRadius ?? 2)
    : running ? (settings.sprintNoiseRadius ?? 16)
    : (settings.walkNoiseRadius ?? 6);
  if (radius > 0) emitNoiseEvent(player.entity.position, radius);
}

function updateThirdPersonController(dt) {
  if (!thirdPersonEntity) return null;
  const settings = currentPlayerSettings;
  const input = app.input;
  // Wave 6 (Priority B/Section 17-18): Crouch takes priority over Sprint --
  // can't sprint while crouched, the standard convention every shooter/
  // platformer shares, and a simpler rule than trying to define what
  // "crouch-sprinting" would even mean physically.
const crouchWanted = inputActionDown('crouch');
  const sprintDown = !crouchWanted && inputActionDown('sprint');
  // Wave 6B (Priority C): the ACTUALLY-applied crouch state (may stay true
  // even after the key is released, if there's no ceiling clearance to
  // stand into) drives speed too -- a mover still physically crouched under
  // a duct must not suddenly move at standing speed just because the key
  // was released.
  const crouchDown = applyCrouchState(thirdPersonEntity, crouchWanted, player.radius);
  player.crouching = crouchDown; // Wave 9B (Silent Sector): exposed so driveMovementNoise can read crouch state without a second physics pass
  const baseSpeed = settings.moveSpeed || 6.5;
  const speed = baseSpeed * (crouchDown ? (settings.crouchSpeedMultiplier ?? 0.5) : sprintDown ? (settings.sprintSpeedMultiplier ?? 1.6) : 1);
  const accel = settings.acceleration || 30;
  const jumpEnabled = !!settings.jumpEnabled;
  const gravity = settings.gravity || 20;
  const jumpSpeed = settings.jumpSpeed || 8;
  let forwardIn = 0, strafeIn = 0;
  if (inputActionDown('moveForward','ArrowUp')) forwardIn += 1;
  if (inputActionDown('moveBack','ArrowDown')) forwardIn -= 1;
  if (inputActionDown('moveRight','ArrowRight')) strafeIn += 1;
  if (inputActionDown('moveLeft','ArrowLeft')) strafeIn -= 1;

  const basis = app.camera.getBasis();
  const ownsCamera = thirdPersonOwnsCameraBearing();
  let camForwardFlat;
  if (ownsCamera) camForwardFlat = new Opus.Vec3(Math.sin(tpCameraYaw), 0, Math.cos(tpCameraYaw));
  else {
    // Authored cameras (fixed shots, map bearings) keep screen-relative movement.
    const camForward = new Opus.Vec3(basis.forward.x, 0, basis.forward.z);
    const flatLen = camForward.length();
    camForwardFlat = flatLen > 0.0001 ? camForward.scale(1 / flatLen) : new Opus.Vec3(0, 0, -1);
  }
  const camRight = new Opus.Vec3(camForwardFlat.z, 0, -camForwardFlat.x);

  const moveDir = camForwardFlat.scale(forwardIn).add(camRight.scale(strafeIn));
  const previousPosition = thirdPersonEntity.position.clone();

  // Horizontal (XZ) velocity is blended toward the desired move direction
  // as before. Vertical (Y) velocity is now handled entirely separately
  // below (gravity/jump) -- blending it toward a flat XZ target would bleed
  // it back toward zero every frame, killing gravity and jump arcs outright.
  const currentHorizontal = new Opus.Vec3(thirdPersonVelocity.x, 0, thirdPersonVelocity.z);
  let horizontal;
  if (moveDir.length() > 0.001) {
    const dir = moveDir.normalize();
    const target = dir.scale(speed);
    horizontal = currentHorizontal.add(target.sub(currentHorizontal).scale(Math.min(1, (accel * dt) / speed)));
    const travelYaw = Math.atan2(dir.x, dir.z);
    thirdPersonEntity.rotationY = turnAngleToward(thirdPersonEntity.rotationY || 0, travelYaw, TP_TURN_RATE * dt);
    // Keyboard steering: forward-diagonal input gently swings the camera toward
    // travel. Pure strafing or backing up never rotates it.
    if (ownsCamera && forwardIn > 0 && strafeIn !== 0) tpCameraYaw = turnAngleToward(tpCameraYaw, travelYaw, TP_AUTO_STEER_RATE * dt);
  } else {
    horizontal = currentHorizontal.scale(Math.exp(-0.6 * (accel / 10) * dt));
  }

  let verticalY = jumpEnabled ? thirdPersonVelocity.y : 0;
  if (jumpEnabled) {
    verticalY -= gravity * dt;
    const jumpDown = inputActionDown('jump');
    if (jumpDown && !jumpKeyWasDown && thirdPersonGrounded) verticalY = jumpSpeed;
    jumpKeyWasDown = jumpDown;
  }
  thirdPersonVelocity = new Opus.Vec3(horizontal.x, verticalY, horizontal.z);
  thirdPersonEntity.position = thirdPersonEntity.position.add(thirdPersonVelocity.scale(dt));

  thirdPersonGrounded = false;
  const halfHeight = thirdPersonEntity.scale.y * 0.5;
  const terrainItem = currentTerrainItem(thirdPersonEntity.position);
  if (terrainItem) {
    const terrainCollision = Opus.Physics.resolveTerrainCollision(thirdPersonEntity.position, thirdPersonVelocity, playerTerrainClearance(thirdPersonEntity, player.radius), terrainItem.options);
    const collision = jumpEnabled ? constrainTerrainCeilingRise(terrainCollision, previousPosition, player.radius, halfHeight) : terrainCollision;
    if (collision.collided) { thirdPersonEntity.position = collision.correctedPosition; thirdPersonVelocity = collision.correctedVelocity; }
    if (collision.grounded) thirdPersonGrounded = true;
  }
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.solid || !item.entity.visible) continue;
    // Wave 6 (Priority B/Section 14): a Ramp gets its own sloped-surface
    // resolution instead of the flat-top box check below -- only when jump
    // (and therefore real per-frame vertical physics) is enabled; a
    // non-jump controller has no Y-axis movement to climb a slope with
    // anyway, so it falls through to the plain box branch further down and
    // treats the ramp as an ordinary wall, exactly like a jump-disabled
    // controller already treats every other solid.
    if (item.isRamp && jumpEnabled) {
      const rampCfg = { center: item.entity.position, half: item.entity.scale.scale(0.5), quat: item.entity.quaternion };
      const rCollision = Opus.Physics.resolveRampCollision(thirdPersonEntity.position, thirdPersonVelocity, player.radius, halfHeight, rampCfg, dt);
      if (rCollision.collided) {
        thirdPersonEntity.position = rCollision.correctedPosition;
        thirdPersonVelocity = rCollision.correctedVelocity;
      }
      if (rCollision.grounded) thirdPersonGrounded = true;
      applyPlatformCarry(thirdPersonEntity, item, rCollision.grounded);
      continue;
    }
    const collider = itemColliderConfig(item);
    const half = collider.shape === 'box' ? collider.half : new Opus.Vec3(collider.radius, collider.radius, collider.radius);
    const center = item.entity.position.add(collider.offset);
    // With jump enabled, a solid object can be a PLATFORM the player lands
    // on top of or clears underneath, not just a wall. Vertical (top/bottom
    // face) resolution runs FIRST and, when it fires, SKIPS the horizontal
    // wall push for this object this frame -- landing/bonking and being
    // shoved sideways are mutually exclusive outcomes for the same contact.
    // Tried gating the horizontal push on simple vertical-range overlap
    // instead (checked before this): it still fired on the exact landing
    // frame (feet freshly inside the top-face tolerance band, which also
    // reads as "overlapping"), shoving the player to the box's edge via
    // resolveBoxCollision's degenerate dead-center fallback and dropping
    // them off the platform on the very frame they landed on it -- caught
    // live dogfooding a player spawned dead-center above a platform.
    // Non-jump controllers keep the original always-a-wall behavior unchanged.
    let verticalHandled = false;
    if (jumpEnabled) {
      const vCollision = resolveItemVerticalCollision(thirdPersonEntity.position, thirdPersonVelocity, player.radius, halfHeight, item, dt);
      if (vCollision.collided) {
        thirdPersonEntity.position = vCollision.correctedPosition;
        thirdPersonVelocity = vCollision.correctedVelocity;
        verticalHandled = true;
      }
      if (vCollision.grounded) thirdPersonGrounded = true;
      applyPlatformCarry(thirdPersonEntity, item, vCollision.grounded);
    }
    const feetY = thirdPersonEntity.position.y - halfHeight;
    const headY = thirdPersonEntity.position.y + halfHeight;
    const verticallyOverlapping = !jumpEnabled || (headY > center.y - half.y && feetY < center.y + half.y);
    if (verticallyOverlapping && !verticalHandled) {
      if (jumpEnabled && tryStepUp(thirdPersonEntity, thirdPersonVelocity, halfHeight, thirdPersonGrounded, item, player.radius)) {
        thirdPersonGrounded = true;
        continue;
      }
      const solidCollision = resolveItemColliderCollision(thirdPersonEntity.position, thirdPersonVelocity, player.radius, item, previousPosition);
      if (solidCollision.collided) { thirdPersonEntity.position = solidCollision.correctedPosition; thirdPersonVelocity = solidCollision.correctedVelocity; }
    }
  }
  const boundary = applyPlayerPlayBounds(thirdPersonEntity.position, thirdPersonVelocity, player.radius);
  thirdPersonEntity.position = boundary.correctedPosition;
  thirdPersonVelocity = new Opus.Vec3(boundary.correctedVelocity.x, thirdPersonVelocity.y, boundary.correctedVelocity.z);

  const reconciled = reconcilePlayerWallContacts(thirdPersonEntity.position, thirdPersonVelocity, player.radius, previousPosition, jumpEnabled ? halfHeight : null);
  thirdPersonEntity.position = reconciled.correctedPosition;
  thirdPersonVelocity = reconciled.correctedVelocity;
  if (jumpEnabled && !thirdPersonGrounded) {
    const support = resolveFinalItemSupport(thirdPersonEntity.position, thirdPersonVelocity, player.radius, halfHeight, dt);
    if (support) {
      thirdPersonEntity.position = support.hit.correctedPosition;
      thirdPersonVelocity = support.hit.correctedVelocity;
      thirdPersonGrounded = true;
      applyPlatformCarry(thirdPersonEntity, support.item, true);
    }
  }
  if (ownsCamera) {
    tpCameraWrittenYaw = tpCameraYaw;
    app.camera.setChaseOptions({ bearingMode: 'fixed', bearingYaw: tpCameraYaw });
  }

  return previousPosition;
}

