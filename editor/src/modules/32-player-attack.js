// Player Attack Input (Wave 4) -- generalized enough for every controller
// via the same generic `player` accessor Camera/AI/checkpoints/Boost
// already use, not hard-coded into one specific controller. Keyboard
// default is KeyQ (Space is Boost/Jump, F is Interact already); touch gets
// its own on-screen button; gamepad reaches it through the SAME
// simulateKeyDown/Up remapping layer every other gamepad action already
// uses (pollGamepad), so this needed zero gamepad-specific code, the exact
// reasoning the Wave 3 Gamepad Utility Gate re-confirmation already
// established for Jump.
let lastAttackTime = -Infinity;
// Wave 7 (Priority B): the actual hit-dispatch half of fireAttack, pulled
// out into its own function so it can be called from TWO places -- normal
// immediate fire (the unconditional default, byte-identical to every
// project before this priority existed) and a queued Animation Event fire
// (`weapon.fireOnAnimationEvent`, opt-in only). Neither caller re-checks
// cooldown/cost here -- that gate already ran once in fireAttack() itself;
// this function's only job is "actually deal the hit right now."
// Wave 7 (Priority C/Section 20): resolves the ACTUAL weapon stats to fire
// with -- either `currentPlayerSettings.weapon` itself (the pre-existing
// "Fixed Weapon" mode, still the unconditional default) or, when
// `weapon.source === 'equipment'`, whatever the item currently equipped in
// the Primary Hand slot defines as ITS OWN weapon config. Returns null (a
// silent no-op for the caller) when Equipment Weapon mode is selected but
// nothing with a weapon config is actually equipped -- "Attack does
// nothing until you pick something up" is the correct, expected behavior,
// not an error.
// Wave 9 (Priority A/Section 22): `activeWeaponSlot` is which Equipment
// slot ('primaryHand'/'secondaryHand') is currently the ACTIVE weapon when
// `weapon.source === 'equipment'` -- switching is just changing which
// already-equipped slot resolveActivePlayerWeapon reads, not a re-equip.
// Both slots' visual entities stay attached at all times (no orphaned
// attachments, Section 23); only the active one is shown (Section 23's
// "detach old visual, attach new" in spirit -- toggling `.visible` reuses
// the already-created entity instead of destroying/recreating GPU
// resources on every switch).
let activeWeaponSlot = 'primaryHand';
function resolveActivePlayerWeapon() {
  const weapon = currentPlayerSettings.weapon;
  if (!weapon) return null;
  if (weapon.source !== 'equipment') {
    // Historical inline configurations remain the exact original owner object.
    if (!Object.prototype.hasOwnProperty.call(weapon,'definitionRef') || weapon.definitionRef === undefined || weapon.definitionRef === '') return weapon;
    const state=resolveWeaponDefinitionOwner(weapon);
    return state.ok?state.config:null;
  }
  const eq = playerEquipment[activeWeaponSlot];
  if (!eq || !eq.def || !eq.def.weapon) return null;
  // cooldown/enabled/fireOnAnimationEvent stay author-level Player Settings
  // (not re-authored per equipment item, keeping this bounded); mode/damage/
  // range/speed/prefabName/ammo/reload/fireMode/spread come from the
  // equipped item's own weapon config.
  const owner=Object.assign({}, weapon, eq.def.weapon);
  // A fixed-weapon asset must never leak into an unreferenced equipment owner.
  if (!Object.prototype.hasOwnProperty.call(eq.def.weapon,'definitionRef')) delete owner.definitionRef;
  if (owner.definitionRef === undefined || owner.definitionRef === '') return owner;
  // Player enable/source/animation ownership stays separate from asset tuning.
  for(const key of ['enabled','source','fireOnAnimationEvent']) {
    if(Object.prototype.hasOwnProperty.call(weapon,key)) owner[key]=weapon[key]; else delete owner[key];
  }
  const state=resolveWeaponDefinitionOwner(owner);
  return state.ok?state.config:null;
}
function syncActiveWeaponVisualVisibility() {
  for (const slot in playerEquipment) {
    const eq = playerEquipment[slot];
    if (eq.entity) eq.entity.visible = (slot === activeWeaponSlot);
  }
}
// Wave 9 (Priority A, Sections 4-24): Weapon RUNTIME state -- deliberately
// separate from the Weapon DEFINITION (currentPlayerSettings.weapon or an
// Equipment Def's own `.weapon`), never mutating the shared authored data.
// Keyed by weapon SLOT identity ('fixed', or 'eq:primaryHand'/
// 'eq:secondaryHand' in Equipment mode) rather than by item name --
// matches Section 22's Primary/Secondary slot model directly: switching
// slots (Section 24) keeps each slot's own magazine/reserve, exactly as
// specified ("switching away and back should NOT magically refill").
let weaponRuntimeState = {};
function weaponRuntimeKeyForActiveSlot() {
  const settingsWeapon = currentPlayerSettings.weapon;
  return (settingsWeapon && settingsWeapon.source === 'equipment') ? ('eq:' + activeWeaponSlot) : 'fixed';
}
function ensureWeaponRuntime(weapon) {
  const key = weaponRuntimeKeyForActiveSlot();
  let rt = weaponRuntimeState[key];
  if (!rt) {
    rt = weaponRuntimeState[key] = { magazine: 0, reserve: 0, reloading: false, reloadEnd: 0 };
    if ((weapon.ammoMode || 'infinite') === 'magazine') {
      const size = weapon.magazineSize != null ? Math.max(1, weapon.magazineSize) : 30;
      rt.magazine = weapon.startingMagazine != null ? Math.max(0, Math.min(weapon.startingMagazine, size)) : size;
      rt.reserve = weapon.reserveAmmo != null ? Math.max(0, weapon.reserveAmmo) : 0;
    }
  }
  return rt;
}
// Section 11 -- reload only ever tops the magazine up from reserve, never
// discards the remainder; Section 10 -- simulation-time driven, so pause
// (which stops simElapsed advancing) correctly freezes it mid-reload.
// Explicit authored action, not a level/slot lifecycle reset. Only the active
// owner's transient magazine/reserve returns to its authored starting values.
function refillActivePlayerAmmo() {
  if (!playMode || !player || currentPlayerSettings.weapon?.enabled !== true) return false;
  const weapon = resolveActivePlayerWeapon();
  if (!weapon || weapon.ammoMode !== 'magazine') return false;
  const key = weaponRuntimeKeyForActiveSlot();
  delete weaponRuntimeState[key];
  ensureWeaponRuntime(weapon);
  return true;
}
function startWeaponReload(weapon) {
  if ((weapon.ammoMode || 'infinite') !== 'magazine') return;
  const rt = ensureWeaponRuntime(weapon);
  const size = weapon.magazineSize != null ? Math.max(1, weapon.magazineSize) : 30;
  if (rt.reloading || rt.magazine >= size || rt.reserve <= 0) return;
  rt.reloading = true;
  // Valid named assets preserve explicit instant reload; historical inline defaults remain1.5.
  const duration = weapon.definitionRef && weapon.reloadDuration === 0 ? 0 : (weapon.reloadDuration != null && weapon.reloadDuration > 0 ? weapon.reloadDuration : 1.5);
  rt.reloadEnd = simElapsed + duration;
  triggerPlayerReloadAnim(weapon.reloadDuration);
}
function tickWeaponReload() {
  if (!player) return;
  const weapon = resolveActivePlayerWeapon();
  if (!weapon || (weapon.ammoMode || 'infinite') !== 'magazine') return;
  const rt = ensureWeaponRuntime(weapon);
  if (!rt.reloading || simElapsed < rt.reloadEnd) return;
  const size = weapon.magazineSize != null ? Math.max(1, weapon.magazineSize) : 30;
  const move = Math.min(size - rt.magazine, rt.reserve);
  rt.magazine += move;
  rt.reserve -= move;
  rt.reloading = false;
}
// Wave 9 (Priority A/Section 22-23): weapon switching -- toggles which
// Equipment slot is active (Fixed Weapon mode has nothing to switch, since
// there's only ever one weapon; the action silently no-ops there). Cancels
// any in-progress reload on the OUTGOING slot (Section 23's "stop old
// reload") WITHOUT crediting the reserve back -- rounds already committed
// to a reload-in-progress are lost on switch, the simplest bounded rule.
function switchActiveWeaponSlot(toSlot) {
  const settingsWeapon = currentPlayerSettings.weapon;
  if (!settingsWeapon || settingsWeapon.source !== 'equipment') return;
  const target = toSlot || (activeWeaponSlot === 'primaryHand' ? 'secondaryHand' : 'primaryHand');
  if (target === activeWeaponSlot) return;
  const outgoingKey = weaponRuntimeKeyForActiveSlot();
  const rt = weaponRuntimeState[outgoingKey];
  if (rt) rt.reloading = false; // stop old reload -- no partial credit
  activeWeaponSlot = target;
  syncActiveWeaponVisualVisibility();
  showToast(`Switched to ${playerEquipment[target] ? playerEquipment[target].itemName : '(empty)'}`);
}
// Wave 9 (Priority A/Section 8): empty-magazine fire attempt -- no shot, no
// cooldown consumed, an authored Empty Sound (Synth beep by default so
// every project gets audible feedback with zero authoring) plays instead.
function handleEmptyFire(weapon) {
  if (weapon.emptySoundAssetId) {
    const asset = findAudioAssetById(weapon.emptySoundAssetId);
    if (asset && asset.audioBuffer) app.audio.playBuffer(asset.audioBuffer, { volume: 0.5 });
  } else {
    app.audio.playBlip({ frequency: 180, duration: 0.08, type: 'square' });
  }
  showToast('Out of ammo -- Reload');
}
// Wave 7 (Priority L, Sections 68-69): the flagship Bone Socket combat
// proof -- a weapon can name a socket (e.g. "Muzzle" on the Player
// Visual's own rig) so projectiles/hits originate from the REAL animated
// muzzle position, not the character's flat root. Reuses
// `resolveSocketSourceTransform` (Priority A) via the same duck-typed
// wrapper Equipment/Carry already established -- zero new socket-
// resolution code. `weapon.muzzleSocket` unset (every pre-Wave-7 project)
// falls straight back to the player's own root position, unchanged.
function resolveMuzzleOrigin(weapon) {
  if (player.controllerType === 'firstperson') {
    const equipped = playerEquipment[activeWeaponSlot];
    if (equipped && equipped.entity) return equipped.entity.position.add(player.entity.forward.scale(0.35));
    const basis = app.camera.getBasis();
    return app.camera.eye.add(basis.forward.scale(0.45)).add(basis.right.scale(0.2)).add(basis.up.scale(-0.18));
  }
  if (weapon.muzzleSocket && playerVisualEntity && playerVisualEntity.skin && currentPlayerSettings.visual) {
    const t = resolveSocketSourceTransform({ entity: playerVisualEntity, assetId: currentPlayerSettings.visual.assetId }, weapon.muzzleSocket);
    if (t) return t.position;
  }
  return player.entity.position.clone();
}
// Wave 9 (Priority A/Section 18): Spread -- rotates the fire direction by a
// random angle bounded inside a cone of half-angle `spreadDegrees`, applied
// identically to Hitscan and Projectile (Section 18's own requirement).
// Melee ignores it (a swing has no "aim direction" to randomize). `0`
// (every pre-Wave-9 weapon) returns the exact input direction unchanged.
function applySpread(dir, spreadDegrees) {
  if (!spreadDegrees) return dir;
  const maxRad = spreadDegrees * Math.PI / 180;
  const theta = Math.random() * maxRad; // angle off-axis, uniform inside the cone (bounded, not a full Gaussian shooter-accuracy model)
  const phi = Math.random() * Math.PI * 2; // direction around the axis
  // Build an orthonormal basis around `dir`, then tilt by theta toward a
  // random point on the circle at that tilt -- a standard bounded-cone
  // perturbation, no new engine math needed beyond Vec3 already provides.
  const up = Math.abs(dir.y) < 0.99 ? new Opus.Vec3(0, 1, 0) : new Opus.Vec3(1, 0, 0);
  const right = up.cross ? up.cross(dir).normalize() : dir; // Vec3.cross is available on every build this project ships
  const trueUp = dir.cross ? dir.cross(right).normalize() : dir;
  const sinT = Math.sin(theta), cosT = Math.cos(theta);
  return dir.scale(cosT).add(right.scale(sinT * Math.cos(phi))).add(trueUp.scale(sinT * Math.sin(phi))).normalize();
}
function performPlayerWeaponFire() {
  if (!player) return;
  const weapon = resolveActivePlayerWeapon();
  if (!weapon) return;
  const isHitscan = weapon.mode === 'hitscan';
  const isMelee = weapon.mode === 'melee';
  // Invalid projectile assets are not shots. Check before consuming ammunition
  // or producing feedback, including delayed animation-event fire attempts.
  if (!isHitscan && !isMelee && aiProjectilePrefabIssue(weapon.prefabName)) return;
  // Wave 9 (Priority A, Sections 7-8): ammo is consumed HERE -- the moment
  // the shot actually leaves the muzzle -- not when Attack was pressed, so
  // `weapon.fireOnAnimationEvent` firing later (mid-swing/reload-race edge
  // cases) still consumes exactly one round per REAL shot, never per press.
  if ((weapon.ammoMode || 'infinite') === 'magazine' && !isMelee) {
    const rt = ensureWeaponRuntime(weapon);
    if (rt.reloading || rt.magazine <= 0) { handleEmptyFire(weapon); return; }
    rt.magazine -= 1;
  }
  // A first-person crosshair represents the camera ray. Starting a shot at
  // the collision-body center instead aimed every shot one eye-height low.
  // The weapon mesh/muzzle remains a cosmetic offset below that sightline.
  const firstPersonAim = player.controllerType === 'firstperson' && !isMelee;
  const dir = applySpread(firstPersonAim ? app.camera.getBasis().forward : player.entity.forward, weapon.spreadDegrees || 0);
  const muzzleOrigin = resolveMuzzleOrigin(weapon);
  const origin = firstPersonAim ? app.camera.eye.clone() : muzzleOrigin;
  if (isHitscan) {
    // Validated named assets preserve an explicit zero range. Historical
    // unreferenced inline weapons retain their established falsy→50 fallback.
    const range = weapon.definitionRef ? (weapon.range ?? 50) : (weapon.range || 50);
    const hit = fireHitscan(origin, dir, range, weapon.damage, 'player', '', weapon.knockback || 0, weapon.damageType);
    // Wave 9D (Priority B, Sections 17-18, 20): exact geometric hit point
    // (`origin + direction * distance`), and fires for EVERY hit type
    // including a solid wall, not only damageable targets.
    const tracerEnd = hit ? origin.add(dir.scale(hit.t)) : origin.add(dir.scale(range));
    if (hit) triggerImpactEffect(weapon, tracerEnd);
    if (weapon.tracer) spawnHitscanTracer(muzzleOrigin, tracerEnd);
  } else if (isMelee) {
    // Valid named assets retain authored zero reach; legacy inline defaults stay unchanged.
    const range = weapon.definitionRef ? (weapon.range ?? 2.5) : (weapon.range || 2.5);
    const hit = fireMelee(origin, dir, range, Math.PI / 3, weapon.damage, 'player', '', weapon.knockback || 0, weapon.damageType);
    if (hit) triggerImpactEffect(weapon, origin.add(dir.scale(hit.dist)));
  } else if (weapon.prefabName) {
    // Wave 9D (Priority B/Section 19): the impact config travels WITH the
    // projectile itself (remembered on `activeProjectiles`' own entry) so
    // its later, asynchronous swept-collision hit (tickProjectiles) can
    // trigger the exact same effect at the exact real collision point,
    // never the projectile's post-step position.
    const impactConfig = (weapon.impactEffect || weapon.impactAudioAssetId) ? weapon : null;
    fireProjectile(weapon.prefabName, origin, dir, weapon.speed, weapon.damage, 'player', 3, 0.3, 0, '', impactConfig, weapon.damageType);
  } else {
    return; // nothing actually fired (e.g. Projectile mode with no prefab) -- no recoil/noise/shake for a no-op
  }
  triggerMuzzleEffect(weapon, muzzleOrigin);
  // Wave 9 (Priority B/Section 34): weapon fire optionally emits a Noise
  // Event AI can hear through walls -- opt-in (`weapon.emitNoiseOnFire`),
  // every pre-Wave-9 weapon stays silent to AI hearing exactly as before.
  if (weapon.emitNoiseOnFire) emitNoiseEvent(origin, weapon.noiseRadius != null ? weapon.noiseRadius : 18);
  if (player.controllerType === 'firstperson') applyWeaponRecoilKick(weapon);
  if (weapon.fireCameraShake && weapon.fireCameraShake.intensity) triggerCameraShake(weapon.fireCameraShake.intensity, weapon.fireCameraShake.duration || 0.15);
}
function fireAttack() {
  if (app.paused || !player) return;
  const settingsWeapon = currentPlayerSettings.weapon;
  if (!settingsWeapon || !settingsWeapon.enabled) return;
  // Wave 7 (Priority C/Section 20): gate against the RESOLVED weapon (Fixed
  // or, when `source === 'equipment'`, whatever's actually active right
  // now) -- so Equipment Weapon mode with nothing equipped correctly
  // no-ops here (isHitscan/isMelee both false, prefabName empty), the same
  // "Attack does nothing yet" behavior an unarmed Fixed-Weapon-disabled
  // game already has, not a special case.
  const weapon = resolveActivePlayerWeapon();
  if (!weapon) return;
  // Hitscan/Melee (Wave 5) need no prefab at all -- Hitscan is an instant
  // ray, Melee has no travel-time object either. Projectile mode still
  // requires one, exactly as before.
  const isHitscan = weapon.mode === 'hitscan';
  const isMelee = weapon.mode === 'melee';
  if (!isHitscan && !isMelee && aiProjectilePrefabIssue(weapon.prefabName)) return;
  if (simElapsed - lastAttackTime < weapon.cooldown) return;
  // Wave 9 (Priority A, Sections 7-9): a reload in progress blocks firing
  // entirely (no anim, no attempt, no cooldown consumed) -- Reload's own
  // Input Action is the only thing that can interrupt this state.
  if ((weapon.ammoMode || 'infinite') === 'magazine' && !isMelee) {
    const rt = ensureWeaponRuntime(weapon);
    if (rt.reloading) return;
  }
  lastAttackTime = simElapsed;
  // Wave 6B (Priority A/Section 8): a real skinned Player Character plays
  // its mapped Attack clip here, unconditionally -- needed either way,
  // since Wave 7's Animation Event fire (below) depends on this clip
  // actually being the one playing for its own crossing detection to find.
  triggerPlayerAttackAnim();
  // Wave 7 (Priority B/Section 15): `weapon.fireOnAnimationEvent` (opt-in,
  // default falsy) defers the actual hit to a `fireWeapon` Animation Event
  // authored on the Player's own Attack clip instead of firing here
  // immediately -- e.g. "the shot leaves the muzzle at the exact frame the
  // gun's own Attack animation reaches its firing pose," not the instant
  // the button was pressed. Every project that never sets this flag (every
  // project saved before this priority existed, and every new one that
  // doesn't opt in) keeps the exact old immediate-fire behavior.
  if (!weapon.fireOnAnimationEvent) performPlayerWeaponFire();
}

