// --- Projectiles (Wave 4) ---
// A bounded projectile system built on primitives that already exist --
// prefab instantiation (the exact same instantiateCubeRecord/addPlaced/
// wireItemTrigger sequence Spawn Prefab and Spawner already use, so a
// fired projectile is indistinguishable from any other placed/spawned
// object -- has its own behaviors, can BE a Trigger Volume, etc.) and
// Object Health (above) for what it hits. No ballistic solver, no
// continuous-collision sweep -- a per-frame sphere-distance check against
// solids/Player/tagged targets, same bounded spirit as every other
// collision primitive already in this engine (see API-FRICTION.md's own
// "no sweep/CCD" notes on terrain/platform collision).
let activeProjectiles = [];
function fireProjectile(prefabName, origin, direction, speed, damage, ownerTag, lifetime, radius, gravity, targetTag, impactEffectConfig, damageType) {
  // All projectile consumers share the single-Cube instantiator contract,
  // including ordinary Actions and weapons, not just AI's pre-shot gate.
  if(aiProjectilePrefabIssue(prefabName))return;
  const prefab = prefabs.find((pf) => pf.name === prefabName);
  if (!prefab) return;
  const spawned = instantiateCubeRecord(prefab.record, origin.clone());
  spawned.runtimeSpawned = true;
  spawned.id = generateItemId();
  addPlaced(spawned);
  wireItemTrigger(spawned);
  activeProjectiles.push({
    item: spawned,
    velocity: direction.clone().normalize().scale(speed),
    damage, damageType, ownerTag: ownerTag || '', targetTag: targetTag || '',
    lifetime: lifetime > 0 ? lifetime : 3, radius: radius > 0 ? radius : 0.3, gravity: gravity || 0,
    // Wave 9D (Priority B/Section 17-19): optional weapon impact feedback,
    // remembered on the projectile itself (not just at fire time) since a
    // Projectile's hit happens later, asynchronously, inside tickProjectiles
    // -- `undefined` for every non-weapon/AI-fired projectile, a complete
    // no-op for all of them.
    impactEffectConfig: impactEffectConfig || null,
  });
}
function removeProjectile(proj) {
  const idx = activeProjectiles.indexOf(proj);
  if (idx !== -1) activeProjectiles.splice(idx, 1);
  if (!proj.item.entity.destroyed) removeItemFromScene(proj.item);
}
// Shared damage resolution (Wave 5, Priority F/section 33) -- both weapon
// modes (Projectile and the new Hitscan below) resolve a hit through this
// ONE function, per the explicit "do not duplicate damage logic" spec
// requirement. `hit` is the same `{type, item}` shape tickProjectiles
// already produces from its own candidate-collection/sort.
// Wave 7 (Priority K, Sections 65-67): bounded hit-reaction support --
// `knockback`/`sourcePos` are both optional (default 0/null), so every
// pre-Wave-7 call site (unchanged, only ever passing `(hit, damage)`)
// keeps its exact old behavior. No ragdolls, no full physics impulse
// system -- a kinematic velocity/position push only.
function applyHitReaction(item, knockback, sourcePos) {
  if (!knockback || !sourcePos) return;
  const dir = item.entity.position.sub(sourcePos);
  dir.y = 0;
  const len = dir.length();
  const pushDir = len > 1e-6 ? dir.scale(1 / len) : new Opus.Vec3(1, 0, 0);
  const previousPosition = item.entity.ai && item.entity.ai.collideWithSolids === true ? item.entity.position.clone() : null;
  item.entity.position.set(item.entity.position.x + pushDir.x * knockback, item.entity.position.y, item.entity.position.z + pushDir.z * knockback);
  if (previousPosition) resolveAiSolidMovement(item, previousPosition, 1);
}
// Hit clip -- temporary override like Attack, EXCEPT Death always wins:
// only called from the "still alive after this hit" branch below, never
// from the death branch, so a lethal hit's Death clip can never be
// pre-empted or interrupted by a Hit clip racing it.
function triggerCharacterHitAnim(item) {
  if (!item.characterAnimSync || !item.entity.skin) return;
  const clipIndex = resolveAiCharacterClip(item,'hit');
  if (clipIndex === null) return;
  item.entity.animationClip = clipIndex;
  item._animState = 'hit';
  const duration = item.entity.skin.clips[clipIndex].duration || 0.3;
  item._animOverrideUntil = simElapsed + duration;
}
// Flash/tint -- a brief bright tint reusing the entity's own existing
// `.color` field (no new renderer path), reverted via the SAME
// `deferredCalls` mechanism Death-animation delay already established,
// not a second scheduling system.
function triggerHitFlash(item) {
  if (!item.entity || !item.entity.color) return;
  if (item._hitFlashOriginalColor === undefined) item._hitFlashOriginalColor = item.entity.color.slice();
  item.entity.color = [1, 1, 1];
  const target = item;
  deferredCalls.push({ fireAt: simElapsed + 0.12, fn: () => { if (target.entity && target._hitFlashOriginalColor) target.entity.color = target._hitFlashOriginalColor; } });
}
function applyHitDamage(hit, damage, knockback, sourcePos, damageType) {
  const profile = hit.type === 'player' ? (typeof currentPlayerSettings !== 'undefined' ? currentPlayerSettings.damageResistance : undefined) : hit.item?.components?.['damage-resistance'];
  if (profile !== undefined && typeof OpusDamagePolicy !== 'undefined') damage = OpusDamagePolicy.resolve(damage, damageType, profile).amount;
  if (hit.type === 'player') {
    ensureHealthInit();
    // Wave 6B (Priority A/Section 9): same wasAlreadyDead transition guard
    // Priority M's own object-death fix already established -- combat
    // damage landing on an already-0-health player (its own Death-animation
    // grace period, or just repeated hits after Lose was already supposed
    // to fire) must not re-trigger the death sequence a second time.
    const playerWasAlreadyDead = window.__gameState.health <= 0;
    if (damage > 0 && !playerWasAlreadyDead) triggerPlayerDamageFeedback(); // Wave 9 (Priority C/Section 43)
    window.__gameState.health = Math.max(0, window.__gameState.health - damage);
    if (window.__gameState.health <= 0 && !playerWasAlreadyDead) {
      // No automatic Lose here otherwise -- exactly the pre-existing
      // behavior (an author wires their own "Health At Most(0) -> Lose"
      // Node Graph condition, the same established pattern object death
      // used before Priority M). A mapped Death clip on a skinned Player
      // Visual is a NEW, opt-in addition: play it, freeze the controller,
      // and show Lose after the clip's own duration -- never a silent
      // change to a project that has no skinned Player configured.
      if (triggerPlayerDeathAnim()) {
        const duration = playerVisualEntity.skin.clips[playerVisualEntity.animationClip].duration || 1;
        playerFrozen = true;
        deferredCalls.push({ fireAt: simElapsed + duration, fn: () => { if (!gameEnded) endGame('lose'); } });
      }
    } else if (knockback && sourcePos && player) {
      // Wave 7 (Priority K): "Player controller adds to current velocity" --
      // only on a non-lethal hit (Death above already ends/freezes movement
      // its own way), added directly to `player.velocity`, the exact state
      // field every Player Controller's own per-frame integration already
      // reads, so knockback participates in normal physics the very next tick.
      const dir = player.entity.position.sub(sourcePos);
      dir.y = 0;
      const len = dir.length();
      const pushDir = len > 1e-6 ? dir.scale(1 / len) : new Opus.Vec3(1, 0, 0);
      player.velocity = (player.velocity || new Opus.Vec3()).add(pushDir.scale(knockback));
    }
  } else if (hit.type === 'object') {
    ensureObjectHealthInit(hit.item);
    // Wave 6 (Priority M) found this while dogfooding Iron Arena, not
    // assumed from reading the code alone: before the Death-animation delay
    // existed, a dead object was removed from `placed` (and therefore un-
    // hittable) the SAME frame its health reached 0, so "health just hit 0"
    // and "health is already at 0" were never distinguishable in practice --
    // this branch could only ever run once per object. Once a dying
    // character can sit in `placed` for a real duration (its Death clip's
    // length) before actually being removed, it's hittable again during
    // that window -- re-entering this branch on every subsequent hit,
    // awarding a bonus kill and queueing a redundant deferred removal each
    // time. `wasAlreadyDead` gates the kill/animation/removal logic to the
    // one genuine alive-to-dead TRANSITION, not every hit that happens to
    // land while health is already at (or clamped to) 0.
    const wasAlreadyDead = hit.item.health.current <= 0;
    hit.item.health.current = Math.max(0, hit.item.health.current - damage);
    if (hit.item.health.current <= 0 && !wasAlreadyDead) {
      // Same fixed-name 'kills' counter and assembly-aware cleanup
      // tickProjectiles' own hit handling already established.
      window.__gameState = window.__gameState || {};
      window.__gameState.kills = (window.__gameState.kills || 0) + 1;
      // Wave 6 (Priority M): a character with a real Death clip authored
      // plays it and destroys itself a moment later, instead of vanishing
      // the instant health reaches 0 -- a character with no Death clip (the
      // exact behavior of every enemy in every project saved before this
      // priority existed) is destroyed immediately, unchanged.
      if (triggerCharacterDeathAnim(hit.item)) {
        const duration = hit.item.entity.skin.clips[hit.item.entity.animationClip].duration || 1;
        const deadItem = hit.item;
        deferredCalls.push({ fireAt: simElapsed + duration, fn: () => { if (placed.includes(deadItem)) removeAssembly(deadItem); } });
      } else {
        removeAssembly(hit.item);
      }
    } else if (!wasAlreadyDead) {
      // Wave 7 (Priority K): a non-lethal hit on a still-alive character --
      // Hit clip (only reachable from THIS branch, never the death one
      // above, so Death always wins over Hit on a simultaneously-lethal
      // hit), flash/tint, and a simple AI position knockback push.
      triggerCharacterHitAnim(hit.item);
      triggerHitFlash(hit.item);
      applyHitReaction(hit.item, knockback, sourcePos);
    }
  }
}
// Hitscan (Wave 5, Priority F/section 33) -- an INSTANT ray query (no
// travel time, no visible projectile object) using the exact same
// raySphere/rayAABB primitives and nearest-hit-wins ordering
// tickProjectiles' own swept check already uses, just over one full-length
// ray instead of one frame's movement segment. Returns the hit (or null),
// same shape tickProjectiles produces, so a caller (fireAttack, an Enemy
// Ranged Attack extension, a future Node Graph action) can inspect what
// was hit without re-deriving it.
// Wave 9D (Priority B, Sections 13-21): the last bounded "feel" layer for
// Weapons 2.0 -- muzzle/impact feedback. Reuses the existing Particle
// Emitter (`app.createEmitter`/`.emit(count)`, the SAME primitive the
// Hovercraft's own boost exhaust/spray already uses in burst mode via
// `rate: 0` + a manual `.emit()` call) and `app.audio.playBuffer` -- no new
// VFX graph, no new audio system. A transient burst emitter is created,
// fires its particles once, and is scheduled for removal once its own
// longest particle life has definitely elapsed (Section 21's own explicit
// "no new permanent scene objects" -- `app.removeEmitter` via the existing
// generic `deferredCalls` scheduler, the same one Priority M's death-
// animation delay and every Sequence Delay already use).
function spawnTransientBurst(position, color) {
  const emitter = app.createEmitter({ position: position.clone(), rate: 0, life: [0.15, 0.35], riseSpeed: [0.6, 1.6], spread: 0.18, size: [0.03, 0.09], color: color || [1, 0.8, 0.3], gravity: -0.5, maxParticles: 24 });
  emitter.emit(12);
  deferredCalls.push({ fireAt: simElapsed + 0.5, fn: () => { try { app.removeEmitter(emitter); } catch (e) {} } });
}
function playWeaponEffectAudio(assetId, position) {
  if (!assetId) return;
  const asset = findAudioAssetById(assetId);
  if (asset && asset.audioBuffer) app.audio.playBuffer(asset.audioBuffer, { volume: 0.7, position: position || undefined });
}
// Wave 9D (Priority B/Section 14): resolves the SAME actual firing origin
// the weapon already uses (Wave 7's own `resolveMuzzleOrigin` -- configured
// muzzle Socket, else Player root) -- effects never get a second,
// independently-guessed origin.
function triggerMuzzleEffect(weapon, origin) {
  playWeaponEffectAudio(weapon.fireAudioAssetId, origin);
  if (weapon.muzzleEffect) spawnTransientBurst(origin, weapon.muzzleEffectColor ? hexToRgb(weapon.muzzleEffectColor) : [1, 0.85, 0.3]);
}
// Wave 9D (Priority B/Section 17, 20): fires for EVERY hit type (Section
// 20's own explicit "works on wall/solid hit, not only damageable
// enemies") -- `impactPoint` is always the real geometric hit point the
// caller computed (Sections 18-19), never a target's center or a
// projectile's post-step position.
function triggerImpactEffect(weapon, impactPoint) {
  if (!weapon) return;
  playWeaponEffectAudio(weapon.impactAudioAssetId, impactPoint);
  if (weapon.impactEffect) spawnTransientBurst(impactPoint, weapon.impactEffectColor ? hexToRgb(weapon.impactEffectColor) : [0.9, 0.9, 0.85]);
}
// Wave 9D (Priority B/Section 22): the Tracer utility gate -- reassessed
// (Hitscan is an instant ray, genuinely invisible without one) and built:
// a tiny short-lived stretched-cube line, the exact same thin-cube-line
// technique Waypoint connection lines and Path visualization already
// established (no beam-weapon architecture, no new line-rendering
// primitive). Cleaned up via the same `deferredCalls` scheduler every
// other transient effect here uses.
function spawnHitscanTracer(origin, endPoint) {
  const delta = endPoint.sub(origin);
  const len = delta.length();
  if (len < 1e-4) return;
  const mid = origin.add(endPoint).scale(0.5);
  const angleY = Math.atan2(delta.x, delta.z);
  const horiz = Math.hypot(delta.x, delta.z);
  const angleX = Math.atan2(-delta.y, horiz);
  const tracer = app.addEntity({ mesh: cubeMesh, color: [1, 0.95, 0.7], position: mid, scale: new Opus.Vec3(0.02, 0.02, len) });
  tracer.rotationY = angleY;
  tracer.quaternion = Opus.Quat.fromEuler(angleX, angleY, 0);
  tracer.unlit = true;
  deferredCalls.push({ fireAt: simElapsed + 0.06, fn: () => { if (!tracer.destroyed) app.scene.remove(tracer); } });
}
// Existing sphere-collider authoring also defines the shootable silhouette.
// Its offset is in world units, matching movement-collider semantics.
function combatTargetSphere(item) {
  if(item.components&&Object.prototype.hasOwnProperty.call(item.components,'hurtbox')){
    const sphere=OpusCombatVolumes.worldSphere(item.components.hurtbox,item.entity.position);
    return sphere?{center:new Opus.Vec3(sphere.center.x,sphere.center.y,sphere.center.z),radius:sphere.radius}:null;
  }
  if(item.kind==='sprite')return null; // Sprites opt in; no historical new target eligibility.
  if(item.kind==='player')return {center:item.entity.position,radius:item.radius};
  const authored = item.collider && item.collider.enabled !== false && item.collider.shape === 'sphere';
  const config = authored ? itemColliderConfig(item) : null;
  return { center: config ? item.entity.position.add(config.offset) : item.entity.position,
    radius: config ? config.radius : Math.max(item.entity.scale.x, item.entity.scale.y, item.entity.scale.z) * 0.5 };
}
// One invocation is one authored attack; no automatic per-frame damage or cooldown.
function applyHitboxDamage(sourceId,damageSourceId,targetTag,self) {
  const source=resolveTarget({targetId:sourceId},self),damageSource=resolveTarget({targetId:damageSourceId||sourceId},self);
  if(!source?.entity||source.entity.destroyed||source.entity.visible===false)return 0;
  const attack=OpusCombatVolumes.worldSphere(source.components?.hitbox,source.entity.position),damage=damageSource?.components?.damage;
  if(!attack||!damage||!OpusAuthoring.registry.get('damage').inspectRecord(damage).ok)return 0;
  const candidates=placed.slice(),seen=new Set();let count=0;
  for(const other of candidates){
    if(other===source||seen.has(other)||!['cube','sprite'].includes(other.kind)||!other.entity||other.entity.destroyed||other.entity.visible===false)continue;
    seen.add(other);
    if(typeof targetTag==='string'&&targetTag&&!other.tags?.includes(targetTag))continue;
    if(!other.health&&typeof other.components?.health!=='object')continue;
    const target=combatTargetSphere(other);
    if(!target||!OpusCombatVolumes.overlaps(attack,target))continue;
    applyHitDamage({type:'object',item:other},damage.amount,0,source.entity.position,damage.version===2?damage.damageType:undefined);count++;
  }
  return count;
}
function fireHitscan(origin, dir, range, damage, ownerTag, targetTag, knockback, damageType) {
  const candidates = [];
  if (ownerTag !== 'player' && player) {
    const profile=typeof currentPlayerSettings!=='undefined'&&Object.prototype.hasOwnProperty.call(currentPlayerSettings,'hurtbox')?{hurtbox:currentPlayerSettings.hurtbox}:undefined;
    const target=combatTargetSphere({kind:'player',entity:player.entity,radius:player.radius,components:profile});
    if(target){const t = Opus.Physics.raySphere(origin, dir, target.center, target.radius);
      if (t !== null && t <= range) candidates.push({ t, type: 'player' });}
  }
  for (const other of placed) {
    if ((other.kind !== 'cube' && other.kind !== 'sprite') || other.entity.visible === false) continue;
    if(other.kind==='sprite'&&!Object.prototype.hasOwnProperty.call(other.components||{},'hurtbox'))continue;
    const isSolid = other.entity.solid;
    const isTaggedTarget = other.tags && other.tags.length && (!targetTag || other.tags.includes(targetTag)) && !(ownerTag && other.tags.includes(ownerTag));
    if (!isSolid && !isTaggedTarget) continue;
    if (isSolid) {
      const half = other.entity.scale.scale(0.5);
      const box = new Opus.Physics.AABB(other.entity.position.sub(half), other.entity.position.add(half));
      const t = Opus.Physics.rayAABB(origin, dir, box);
      if (t !== null && t <= range) candidates.push({ t, type: 'solid', item: other });
    } else {
      const target = combatTargetSphere(other);
      if(!target)continue;
      const t = Opus.Physics.raySphere(origin, dir, target.center, target.radius);
      if (t !== null && t <= range) candidates.push({ t, type: 'object', item: other });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.t - b.t);
  const hit = candidates[0];
  if (hit.type === 'player' || hit.type === 'object') applyHitDamage(hit, damage, knockback, origin, damageType);
  return hit;
}
// Melee (Wave 5, section 35 utility gate: cheap once Hitscan's damage
// resolution already exists, so implemented -- a radius/cone check reusing
// applyHitDamage, not a fourth damage implementation). No raycast at all:
// just "is this tagged target within `range` AND within a forward-facing
// cone of `coneHalfAngleRad`" -- deliberately simpler than Hitscan/
// Projectile since melee has no travel and no line-of-sight requirement in
// this engine (a real swing could plausibly connect slightly around a thin
// corner; accepted as the bounded simplification this primitive is worth).
function fireMelee(origin, dir, range, coneHalfAngleRad, damage, ownerTag, targetTag, knockback, damageType) {
  const candidates = [];
  if (ownerTag !== 'player' && player) {
    const profile=typeof currentPlayerSettings!=='undefined'&&Object.prototype.hasOwnProperty.call(currentPlayerSettings,'hurtbox')?{hurtbox:currentPlayerSettings.hurtbox}:undefined;
    const target=combatTargetSphere({kind:'player',entity:player.entity,radius:player.radius,components:profile});
    if(target){const toTarget=target.center.sub(origin),dist=toTarget.length();
      if(dist<=range+target.radius&&(dist<1e-6||toTarget.normalize().dot(dir)>=Math.cos(coneHalfAngleRad)))candidates.push({dist,type:'player'});}
  }
  for (const other of placed) {
    if ((other.kind !== 'cube' && other.kind !== 'sprite') || other.entity.visible === false) continue;
    if(other.kind==='sprite'&&!Object.prototype.hasOwnProperty.call(other.components||{},'hurtbox'))continue;
    const isTaggedTarget = other.tags && other.tags.length && (!targetTag || other.tags.includes(targetTag)) && !(ownerTag && other.tags.includes(ownerTag));
    if (!isTaggedTarget) continue;
    const target = combatTargetSphere(other);
    if(!target)continue;
    const r = target.radius;
    const toTarget = target.center.sub(origin);
    const dist = toTarget.length();
    if (dist > range + r) continue;
    if (dist >= 1e-6 && toTarget.normalize().dot(dir) < Math.cos(coneHalfAngleRad)) continue;
    candidates.push({ dist, type: 'object', item: other });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  const hit = candidates[0];
  applyHitDamage(hit, damage, knockback, origin, damageType);
  return hit;
}
// Projectile Collision 2.0 (Wave 5, Priority F) -- swept, not a per-frame
// end-point overlap check. Reuses the exact math TriggerVolume.update()
// already established for its own swept enter/exit detection (`raySphere`
// against the segment from where the mover WAS to where it IS now,
// checking the hit distance against the segment length) -- both are
// already public on Opus.Physics, so no new engine API was needed at all,
// closing what would otherwise have been section 34's own question before
// it became one. Solids get the more precise `rayAABB` (their real box
// shape, not a sphere approximation) since it was equally available and no
// harder to call; damageable/tagged targets keep the sphere approximation
// already used elsewhere for Object Health hit-testing.
//
// Hit order (section 31): every candidate the swept segment could plausibly
// hit this frame is collected first, then sorted by hit distance along the
// segment -- the NEAREST one wins, exactly once, never "damage everything
// crossed" (this engine has no penetration/piercing concept to opt into).
function tickProjectiles(dt) {
  if (activeProjectiles.length === 0) return;
  for (const proj of activeProjectiles.slice()) {
    if (proj.item.entity.destroyed) { removeProjectile(proj); continue; }
    proj.lifetime -= dt;
    if (proj.lifetime <= 0) { removeProjectile(proj); continue; }
    if (proj.gravity) proj.velocity.y -= proj.gravity * dt;
    const prevPos = proj.item.entity.position.clone();
    const moveVec = proj.velocity.scale(dt);
    const moveDist = moveVec.length();
    proj.item.entity.position = prevPos.add(moveVec);
    const pos = proj.item.entity.position;
    const dir = moveDist > 1e-6 ? moveVec.scale(1 / moveDist) : null;

    const candidates = []; // { t, type, item }
    if (proj.ownerTag !== 'player' && player) {
      const profile=typeof currentPlayerSettings!=='undefined'&&Object.prototype.hasOwnProperty.call(currentPlayerSettings,'hurtbox')?{hurtbox:currentPlayerSettings.hurtbox}:undefined;
      const target=combatTargetSphere({kind:'player',entity:player.entity,radius:player.radius,components:profile});
      if(target){const combinedR=proj.radius+target.radius;
        const t=dir?Opus.Physics.raySphere(prevPos,dir,target.center,combinedR):null,endDist=pos.sub(target.center).length();
        if((t!==null&&t<=moveDist)||endDist<combinedR)candidates.push({t:t!==null?t:moveDist,type:'player'});}
    }
    for (const other of placed) {
      if (other === proj.item || (other.kind !== 'cube' && other.kind !== 'sprite') || other.entity.visible === false) continue;
      if(other.kind==='sprite'&&!Object.prototype.hasOwnProperty.call(other.components||{},'hurtbox'))continue;
      const isSolid = other.entity.solid;
      const isTaggedTarget = other.tags && other.tags.length && (!proj.targetTag || other.tags.includes(proj.targetTag)) && !(proj.ownerTag && other.tags.includes(proj.ownerTag));
      if (!isSolid && !isTaggedTarget) continue;
      if (isSolid) {
        const half = other.entity.scale.scale(0.5);
        const box = new Opus.Physics.AABB(other.entity.position.sub(half), other.entity.position.add(half));
        const t = dir ? Opus.Physics.rayAABB(prevPos, dir, box) : null;
        if ((t !== null && t <= moveDist) || box.containsPoint(pos)) candidates.push({ t: t !== null ? t : moveDist, type: 'solid', item: other });
      } else {
        const target = combatTargetSphere(other);
        if(!target)continue;
        const combinedR = proj.radius + target.radius;
        const t = dir ? Opus.Physics.raySphere(prevPos, dir, target.center, combinedR) : null;
        const endDist = pos.sub(target.center).length();
        if ((t !== null && t <= moveDist) || endDist < combinedR) candidates.push({ t: t !== null ? t : moveDist, type: 'object', item: other });
      }
    }
    // Terrain (section 32, "if practical") -- a bounded check: did the
    // projectile's feet cross from above to at-or-below the sampled
    // terrain height at its current XZ this frame? Not a full ray-march
    // along the segment (terrain has no closed-form ray intersection the
    // way a sphere/AABB does), but correct for the common case of a
    // projectile arcing down into the ground, and cheap.
    const terrainItem = currentTerrainItem(pos);
    if (terrainItem) {
      const groundY = terrainItem.handle.sampleHeight(pos.x, pos.z);
      if (prevPos.y >= groundY && pos.y <= groundY + proj.radius) {
        const terrainT = moveDist > 0 ? Math.max(0, Math.min(moveDist, (prevPos.y - groundY) / Math.max(1e-6, prevPos.y - pos.y) * moveDist)) : 0;
        candidates.push({ t: terrainT, type: 'terrain' });
      }
    }

    let hit = null;
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.t - b.t);
      hit = candidates[0];
    }
    if (hit) {
      // applyHitDamage (Wave 5): the same shared resolution Hitscan now
      // also calls -- see its own comment for the 'kills' counter / assembly-
      // aware cleanup reasoning, unchanged from before this was factored out.
      if (hit.type === 'player' || hit.type === 'object') applyHitDamage(hit, proj.damage, undefined, undefined, proj.damageType);
      // Wave 9D (Priority B/Section 19): the REAL swept collision point
      // (`prevPos + dir * hit.t`), not the projectile's post-step `pos` --
      // for every hit type, including solid/terrain (Section 20).
      if (proj.impactEffectConfig && dir) triggerImpactEffect(proj.impactEffectConfig, prevPos.add(dir.scale(hit.t)));
      removeProjectile(proj);
    }
  }
}

function tickSpawners(dt) {
  for (const item of placed) {
    if (item.kind !== 'spawner' || !item.spawnerState) continue;
    const st = item.spawnerState;
    // Prune ids for instances that were destroyed by other means (Destroy
    // Object, Damage-related cleanup, etc.) since the last tick -- Max
    // Active must reflect what's REALLY still alive, not a stale count.
    st.activeIds = st.activeIds.filter((id) => placed.some((p) => p.id === id));
    if (!st.enabled) continue;
    const opts = item.options;
    if (opts.totalCount > 0 && st.spawnedTotal >= opts.totalCount) continue;
    if (st.activeIds.length >= opts.maxActive) continue;
    st.timer += dt;
    // First spawn waits Initial Delay; every spawn after that waits Interval.
    const threshold = st.firstSpawnDone ? opts.interval : (opts.initialDelay || 0);
    if (st.timer >= threshold) {
      st.timer = 0;
      st.firstSpawnDone = true;
      spawnOneFromSpawner(item);
    }
  }
}
function tickTimers(dt) {
  const timers = window.__gameTimers;
  if (!timers) return;
  for (const name in timers) {
    const t = timers[name];
    if (!t.running || t.finished) continue;
    if (t.countDown) {
      t.elapsed = Math.max(0, t.elapsed - dt);
      if (t.elapsed <= 0) { t.finished = true; t.running = false; }
    } else {
      t.elapsed += dt;
      if (t.duration > 0 && t.elapsed >= t.duration) { t.finished = true; t.running = false; }
    }
  }
}
function ensureHealthInit() {
  window.__gameState = window.__gameState || {};
  if (window.__gameState.maxHealth === undefined) {
    const fromSettings = currentPlayerSettings && currentPlayerSettings.maxHealth;
    window.__gameState.maxHealth = fromSettings > 0 ? fromSettings : 100;
  }
  if (window.__gameState.health === undefined) window.__gameState.health = window.__gameState.maxHealth;
}
// Object Health (Wave 4) -- lazily initialized on first damage/heal/query,
// same "exists with a valid max by the time anything touches it" reasoning
// as ensureHealthInit above, just per-object instead of one global player
// state. Defaults to 100/100 unless a behavior/graph author explicitly sets
// otherwise via Set Object Health (not built this pass -- Damage/Heal cover
// the dogfooded cases; a dedicated setter is a natural, low-risk follow-up).
function ensureObjectHealthInit(item) {
  if (!item.health) item.health = { current: 100, max: 100 };
}

