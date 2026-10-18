// Wave 8 (Priority E, Sections 29-32): Inventory UI -- a bounded player-
// facing panel over the EXISTING runtime state (`window.__gameInventory`,
// `playerEquipment` from Wave 7 Priority C), not a new inventory model.
// Toggled via a RAW `keydown` listener (not the per-frame `wasPressed`
// polling loop every other gameplay input uses) -- deliberately, because
// that loop lives inside `app.onUpdate`'s own registered callbacks, which
// the engine's OWN `App.pause()` stops calling entirely while paused (see
// its own GameLoop implementation) -- a polled check could open Inventory
// but could never see the SECOND press that should close it again once
// paused. A raw listener keeps working in both states, the same reason
// the engine's own internal Escape-pause toggle already has to be wired
// this way. Reading `effectiveInputMap.inventory` at call time (not a
// captured key code) also means this transparently honors an author's
// custom rebinding, and (since Touch/Gamepad both dispatch through the
// SAME `simulateKeyDown`-driven synthetic keydown events every other
// logical action already uses) needs no separate device-specific code.
function toggleInventory() {
  if (!playMode) return;
  if (gameplayScreenPauseOwners.has('dialogue') || document.getElementById('menu-screen-overlay')?.classList.contains('visible') || document.getElementById('dialogue-overlay').classList.contains('visible')) return;
  const willOpen = !document.getElementById('inventory-overlay').classList.contains('visible');
  document.getElementById('inventory-overlay').classList.toggle('visible', willOpen);
  if (willOpen) { renderInventoryOverlay(); acquireGameplayScreenPause('inventory'); } else { releaseGameplayScreenPause('inventory'); }
}
window.addEventListener('keydown', (e) => {
  if (playMode && effectiveInputMap.inventory && e.code === effectiveInputMap.inventory && !e.repeat) toggleInventoryFromInput();
});
document.getElementById('inventory-close-btn').addEventListener('click', () => {
  if (document.getElementById('inventory-overlay').classList.contains('visible')) toggleInventory();
});
// Reused by both the button row (Equip/Unequip/Use) and re-render after
// any of those mutate state -- one function, always reflecting the real
// live `window.__gameInventory`/`playerEquipment`, never a stale snapshot.
// Wave 8 (Priority G, Sections 44-47): the player-facing Objective Log
// half of the shared Journal screen -- Active/Completed (Failed shown too
// if any exist, Section 44's own "optional"). Progress (Section 47)
// reuses EXISTING state (a named Counter in `window.__gameState`, or an
// Inventory item's own quantity) -- no second progress-storage system.
function objectiveProgressText(def) {
  if (!def.progress || !def.progress.key) return '';
  const current = def.progress.type === 'inventory'
    ? ((window.__gameInventory && window.__gameInventory[def.progress.key]) || 0)
    : ((window.__gameState && window.__gameState[def.progress.key]) || 0);
  return def.progress.target ? ` (${current}/${def.progress.target})` : ` (${current})`;
}
function renderObjectiveLog() {
  const listEl = document.getElementById('objective-log-list');
  if (!listEl) return;
  const state = window.__gameObjectives || {};
  const active = currentObjectiveDefs.filter((d) => d?.id && state[d.id] === 'active');
  const complete = currentObjectiveDefs.filter((d) => d?.id && state[d.id] === 'complete');
  const failed = currentObjectiveDefs.filter((d) => d?.id && state[d.id] === 'failed');
  const section = (label, defs, style) => defs.length === 0 ? '' : `<div style="margin-top:6px"><div style="font-size:10.5px;color:#66759a;text-align:left">${label}</div>${defs.map((d) => `<div class="inventory-row" style="${style}"><span class="inv-name">${escapeHtml(d.title)}${objectiveProgressText(d)}</span></div>`).join('')}</div>`;
  listEl.innerHTML = section('Active', active, '') + section('Completed', complete, 'opacity:0.6;text-decoration:line-through') + section('Failed', failed, 'opacity:0.6;color:#e07a7a')
    || '<p style="color:#8592a8;font-size:12px">No objectives yet.</p>';
}
function renderInventoryOverlay() {
  renderObjectiveLog();
  const listEl = document.getElementById('inventory-list');
  const inv = window.__gameInventory || {};
  const entries = Object.entries(inv).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    listEl.innerHTML = '<p style="color:#8592a8;font-size:12px">Nothing carried yet.</p>';
    return;
  }
  const equippedItemNames = new Set(Object.values(playerEquipment).map((eq) => eq.itemName));
  listEl.innerHTML = entries.map(([name, count]) => {
    const def = findItemDefById(name); // an Item Definition's own `id` is a valid, richer inventory key (Section 27); a free-typed legacy name just has no def
    const displayName = def ? def.name : name;
    const icon = def && def.iconTextureAssetId ? findTextureAssetById(def.iconTextureAssetId) : null;
    const isEquipped = equippedItemNames.has(name);
    const equipDef = (currentPlayerSettings.equipmentDefs || []).find((e) => e.itemName === name);
    return `
      <div class="inventory-row" data-inv-name="${escapeHtml(name)}">
        ${icon && icon.dataURL ? `<img src="${icon.dataURL}" alt="">` : '<div style="width:28px;height:28px;background:#182338;border-radius:3px"></div>'}
        <span class="inv-name">${escapeHtml(displayName)} x${count}${isEquipped ? ' <span class="inv-equipped">(equipped)</span>' : ''}</span>
        ${equipDef ? (isEquipped ? `<button data-inv-unequip="${escapeHtml(name)}">Unequip</button>` : `<button data-inv-equip="${escapeHtml(name)}">Equip</button>`) : ''}
        ${def && def.useAction ? `<button data-inv-use="${escapeHtml(name)}">Use</button>` : ''}
      </div>`;
  }).join('');
  listEl.querySelectorAll('[data-inv-equip]').forEach((btn) => {
    btn.onclick = () => { const name = btn.dataset.invEquip; const eqDef = (currentPlayerSettings.equipmentDefs || []).find((e) => e.itemName === name); if (eqDef) equipItemToSlot(name, eqDef.slot); renderInventoryOverlay(); };
  });
  listEl.querySelectorAll('[data-inv-unequip]').forEach((btn) => {
    btn.onclick = () => { const name = btn.dataset.invUnequip; const slot = Object.keys(playerEquipment).find((s) => playerEquipment[s].itemName === name); if (slot) unequipSlot(slot); renderInventoryOverlay(); };
  });
  listEl.querySelectorAll('[data-inv-use]').forEach((btn) => {
    btn.onclick = () => { const def = findItemDefById(btn.dataset.invUse); if (def) executeAction('useItem', { itemId: def.id }, null); renderInventoryOverlay(); };
  });
}

app.onUpdate((dt, elapsed) => {
  simElapsed = elapsed; // read by damagePlayer's cooldown gate and pendingDelays
  if (!playMode) return;
  runLifecycleBehaviors('update');
  // Wave 8 (Priority H): real accumulated playtime, for Save Slot metadata
  // (Section 51) -- only while actually unpaused (this whole callback
  // already doesn't run at all while app.paused, so no separate pause
  // check is needed here beyond that).
  window.__gamePlaytimeSeconds = (window.__gamePlaytimeSeconds || 0) + dt;
  pollGamepad(dt);
  tickSpawners(dt);
  tickTimers(dt);
  tickTweens(dt);
  tickProjectiles(dt);
  updateSpriteAnimations(dt);
  processPendingDelays();
  processDeferredCalls();
  signalRuntime.drain();
  renderHudLayer();
  // Patrol hazards: mutate position in place (.set, not reassignment) so the
  // TriggerVolume's stored `center` reference (a live pointer to this same
  // Vec3, not a snapshot) tracks the movement automatically.
  for (const item of placed) {
    if (item.kind === 'cube' && item.entity.patrol) {
      const p = item.entity.patrol;
      const offset = Math.sin(elapsed * p.speed + p.phase) * p.range;
      if (p.axis === 'x') item.entity.position.set(p.base.x + offset, item.entity.position.y, p.base.z);
      else item.entity.position.set(p.base.x, item.entity.position.y, p.base.z + offset);
    }
  }
  // Simple enemy/movement AI -- deliberately not pathfinding (no navmesh):
  // each type is a few lines of direct steering, same spirit as Patrol
  // above. 'Chase' isn't a separate type -- it's Follow at a higher
  // user-set Speed, so it doesn't need its own code path.
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.ai || !aiBrainCanRun(item)) continue;
    const ai = item.entity.ai;
    const pos = item.entity.position;
    let followTargetEntity;
    // Wave 7 (Priority D): a State Machine character's movement/attack for
    // THIS tick come from its CURRENT STATE's own `movement`/`attack`
    // sub-configs (see tickAiStateMachine below) instead of `ai` itself --
    // everything else (animation-locomotion sync excluded, handled
    // separately below) still funnels through the exact same
    // applyAiMovementStep/applyAiAttackStep every pre-Wave-7 AI type uses,
    // so a state's `movement` object is literally shaped like `ai` itself
    // (same `type`/`speed`/`radius`/`targetId`/... fields), not a second
    // movement language.
    if (ai.mode === 'stateMachine') {
      followTargetEntity = tickAiStateMachine(item, ai, pos, dt, elapsed);
    } else {
      followTargetEntity = applyAiMovementStep(item, ai, pos, dt, elapsed);
      applyAiAttackStep(item, ai, pos, followTargetEntity, elapsed);
    }
    // Wave 6 (Priority M): animated locomotion -- Idle/Walk/Run picked by
    // how far this AI-driven character actually moved THIS frame, not by
    // which AI type it's running (Follow/Patrol/Wander/Waypoint all already
    // converge on mutating `pos` in place above, so comparing `pos` against
    // its own value from the START of this frame covers every movement type
    // uniformly, with no per-AI-type animation code needed). Skipped
    // entirely while an Attack/Death override is active (`_animOverrideUntil`),
    // and skipped entirely for a State Machine character -- that character's
    // animation is explicitly authored per-state (`enterAiState`'s own
    // `animRole`), not inferred from movement delta.
    if (ai.mode !== 'stateMachine' && item.characterAnimSync && item.entity.skin && !(item._animOverrideUntil > elapsed)) {
      const lastPos = item._animLastPos;
      const movedDist = lastPos ? pos.sub(lastPos).length() : 0;
      const speedPerSec = movedDist / Math.max(dt, 1e-6);
      setCharacterLocomotionState(item, speedPerSec < 0.05 ? 'idle' : speedPerSec > (ai.speed || 3) * 0.7 ? 'run' : 'walk');
    }
    item._animLastPos = pos.clone();
  }
  // Wave 7 (Priority B): Animation Events for every skinned placed item, not
  // just AI-driven ones -- a genuinely separate, unconditional loop (any
  // object carrying an `entity.skin`, whether or not it also has `entity.ai`)
  // since event authoring is a property of the CLIP/asset, not of whichever
  // movement system happens to be driving the character.
  for (const item of placed) {
    if (item.kind === 'cube' && item.entity.skin) tickAnimationEvents(item.entity, item.assetId, item);
  }
  const previousPlayerPos = updatePlayerController(dt, elapsed);
  // Resolved AFTER every movement system above (patrol/AI/tweens) and BEFORE
  // trigger volumes read positions below -- a parented trigger/hazard riding
  // a moving parent must be checked against ITS current frame's world
  // position, not last frame's, or collision/trigger logic would read stale
  // coordinates one tick behind what just got rendered.
  updateHierarchyTransforms();
  if (body2DManager) body2DManager.tick(placed, dt, body2DObjects.size ? Array.from(body2DObjects) : EMPTY_TRIGGER_2D_INDEX);
  if (player && player.controllerType === 'platformer2d' && platformer2DController) {
    platformer2DController.resolve(body2DManager.getCharacterCollision2DState(player.objectId));
    const velocity = platformer2DController.getState().velocity;
    player.velocity = new Opus.Vec3(velocity[0], velocity[1], 0);
  }
  if (player && player.controllerType === 'topdown2d' && topdown2DController) {
    topdown2DController.resolve(body2DManager.getCharacterCollision2DState(player.objectId));
    const velocity = topdown2DController.getState().velocity;
    player.velocity = new Opus.Vec3(velocity[0], velocity[1], 0);
  }
  updateHierarchyTransforms();
  const stateEventOwner = player, stateEventSession = controllerStateSession;
  sampleControllerStateEvents(dt);
  // An ordinary reaction can pause, end Play, destroy its primary or change level.
  // Do not continue old-session Trigger/camera consumers after that callback.
  if (!controllerStateTickIsCurrent(stateEventOwner, stateEventSession)) return;
  if (trigger2DManager) trigger2DManager.tick(placed, trigger2DObjects.size ? Array.from(trigger2DObjects) : EMPTY_TRIGGER_2D_INDEX);
  refreshActiveCameraTargetGroup();
  syncPhysicsDebug2D();
  const trackPoint = player ? player.entity.position : app.camera.eye;
  syncGraphTrace();
  syncSignalInspector();
  for (const { volume } of playTriggers) volume.update(trackPoint, player ? previousPlayerPos : undefined);
  updateInteract();
  if (inputActionWasPressed('interact')) fireInteract();
  // Wave 9 (Priority A, Sections 14-17): Fire Mode dispatch -- Semi (the
  // unconditional pre-Wave-9 default, and every weapon with no `fireMode`
  // authored) stays exactly `wasPressed` (one press = one shot, holding
  // does not repeat). Automatic reads `isDown` every frame instead, and
  // fireAttack's own cooldown gate is what actually paces the real shots
  // fired -- simulation-time-driven (`simElapsed`), never frame-rate
  // dependent.
  const attackWeapon = resolveActivePlayerWeapon();
  const isAutoFire = attackWeapon && attackWeapon.fireMode === 'auto';
  if (isAutoFire ? inputActionDown('attack') : inputActionWasPressed('attack')) fireAttack();
  if (inputActionWasPressed('reload')) { const w = resolveActivePlayerWeapon(); if (w) startWeaponReload(w); }
  if (inputActionWasPressed('switchWeapon')) switchActiveWeaponSlot();
  tickWeaponReload();
  tickRecoilRecovery(dt);
  tickCameraShake(dt);
  // Keep the early attachment pose for firing/muzzle reads, then compose the
  // final first-person viewmodel after this frame's recoil and shake effects.
  if(player?.controllerType==='firstperson')syncPlayerEquipmentVisuals();
  syncCrosshair(attackWeapon);
});
// Wave 9 (Priority A/Section 26): a bounded CSS-only crosshair -- visible
// only for a First-Person controller with an enabled, resolvable weapon
// (author opt-out via `weapon.crosshair === false`); its optional
// spread-reactive gap width scales with the weapon's own Spread Degrees.
function syncCrosshair(weapon) {
  const el = document.getElementById('crosshair');
  if (!el) return;
  const show = !!(player && player.controllerType === 'firstperson' && weapon && weapon.enabled !== false && weapon.crosshair !== false);
  el.classList.toggle('visible', show);
  if (show) el.style.setProperty('--crosshair-spread', `${Math.min(20, (weapon.spreadDegrees || 0) * 1.5)}px`);
}

