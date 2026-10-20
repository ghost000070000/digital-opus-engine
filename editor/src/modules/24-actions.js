// Wave 8 (Priority H, Sections 49-51): the ONE place a Save Game payload is
// actually built and written -- shared by the manual `saveGame` action and
// the new `autosave` action (Section 50), so a slot written by either one
// carries the exact same shape/metadata, never two slightly-different save
// formats. Metadata (Section 51 -- timestamp handled by SaveSystem.save
// itself; level name/objective title/playtime added here) lets a Continue
// screen show real context instead of a bare slot name.
function projectRuntimeSaveSystem() {
  if(!OpusPlayerRebindScreen.scopeKey(playerPreferenceScope))throw new Error('Project player-save identity is unavailable.');
  return new Opus.SaveSystem('doengine:playersave:v1:'+playerPreferenceScope.id);
}
function writeSaveGameSlot(slot) {
  captureCurrentLevelWorldState(); // capture THIS level's live persistent state before writing
  const saveSystem = projectRuntimeSaveSystem();
  const level = levels[currentLevelIndex];
  // Wave 8 (Priority F/Section 97 -- built ahead of full Weapons 2.0 since
  // it's cheap and Power Grid's own dogfood benefits from it): the
  // currently-equipped item per slot, NOT any transient animation/visual
  // state -- restored by re-running the real `equipItemToSlot` on load,
  // not by trying to serialize a live entity.
  const equipment = {};
  for (const slotName in playerEquipment) equipment[slotName] = playerEquipment[slotName].itemName;
  // Wave 9 (Priority D, Sections 47-49): weapon runtime -- ONLY magazine/
  // reserve per slot are persisted (Section 47's explicit exclusions: no
  // mid-reload fractional progress, no recoil, no animation time -- a
  // reload in progress at save time is simply not represented at all, so
  // Load correctly finds it not-reloading, per Section 47's own "Reload
  // state can cancel on Load"). `saveFormatVersion: 3` (Section 48 -- the
  // RUNTIME save schema, never the project schema) so a Wave-8-or-earlier
  // save (no `weaponRuntime`/`activeWeaponSlot` keys at all) still loads
  // correctly: `data.weaponRuntime || {}` below is a harmless empty object,
  // every weapon just starts fresh exactly as it already did before this
  // priority existed.
  const weaponRuntime = {};
  for (const key in weaponRuntimeState) {
    const rt = weaponRuntimeState[key];
    weaponRuntime[key] = { magazine: rt.magazine, reserve: rt.reserve };
  }
  return saveSystem.save(slot, {
    saveFormatVersion: 3,
    levelIndex: currentLevelIndex,
    levelName: level ? level.name : '',
    objectiveTitle: currentActiveObjectiveTitle(),
    playtimeSeconds: window.__gamePlaytimeSeconds || 0,
    checkpoint: window.__checkpoint ? [window.__checkpoint.x, window.__checkpoint.y, window.__checkpoint.z] : null,
    gameState: window.__gameState || {},
    flags: window.__gameFlags || {},
    inventory: window.__gameInventory || {},
    lootDrawCounters: { ...lootDrawCounters },
    objectives: window.__gameObjectives || {},
    worldState: window.__worldState || {},
    equipment,
    weaponRuntime,
    activeWeaponSlot,
    playerPosition: player ? [player.entity.position.x, player.entity.position.y, player.entity.position.z] : null,
  });
}
const ACTION_TYPES = {
  setInputContext: {
    label: 'Set Input Context', fields: [{key:'contextId',label:'Input context',type:'inputContextRef',required:true}],
    exec: p => { if(playMode && !gameEnded){if(typeof p?.contextId!=='string'){showToast('Choose a valid named input context.');return;}selectRuntimeInputContext(p.contextId);} },
  },
  resetInputContext: {
    label: 'Reset Input Context', fields: [],
    exec: () => { if(playMode && !gameEnded) resetRuntimeInputContext(); },
  },
  openControls: {
    label: 'Open Controls', fields: [],
    exec: () => { if (playMode && !gameEnded) openControlsPanel(); },
  },
  openMenuPage: {
    label: 'Open Menu Page',
    fields: [{ key: 'menuPageId', label: 'Menu page', type: 'menuPageRef' }],
    exec: (params) => { if (playMode && !gameEnded) openMenuScreen(params.menuPageId, false); },
  },
  message: {
    label: 'Show Message', legacy: true, legacyParam: 'text',
    fields: [{ key: 'text', label: 'Message', type: 'text', placeholder: 'Message text' }],
    exec: (p) => showToast(p.text || '...'),
  },
  // NOT `legacy` (unlike the other original six) -- it USED to claim
  // legacyParam: null, meaning the fixed dropdown's Add Behavior flow never
  // wrote a `.param` OR a `.params` for it at all. That silently made the
  // Frequency field a no-op: behaviorParams() had nothing to read back, so
  // every fixed-dropdown Play Sound behavior always played the hardcoded
  // 660Hz default regardless of what was typed in, for as long as this
  // action has existed. Found while extending Duration/Waveform authoring
  // -- fixed by making it a normal `.params`-backed action like every other
  // non-legacy one, which a saved project with no `.params` at all
  // (any prior Play Sound behavior) still falls back through correctly.
  // Play Sound 2.0 -- Mode picks Synth (the original procedural blip, still
  // the default) or Asset (a real imported sound from the Audio Library).
  // Both field groups are always rendered rather than dynamically shown/
  // hidden by Mode, since the fixed-dropdown Behaviors UI has no per-field
  // conditional-visibility mechanism (unlike the AI Behavior inspector,
  // which hand-wires that); exec() only reads whichever group Mode selects.
  // A saved behavior with no `.mode` at all (every pre-2.0 Play Sound) falls
  // through to 'synth' by default, so old projects are unaffected.
  sound: {
    label: 'Play Sound',
    fields: [
      { key: 'mode', label: 'Mode', type: 'select', options: ['synth', 'asset'] },
      { key: 'frequency', label: 'Synth: Frequency (Hz)', type: 'number', placeholder: '660' },
      { key: 'duration', label: 'Synth: Duration (sec)', type: 'number', placeholder: '0.15' },
      { key: 'waveform', label: 'Synth: Waveform', type: 'select', options: ['sine', 'square', 'sawtooth', 'triangle'] },
      { key: 'audioAssetId', label: 'Asset: Sound', type: 'audioAsset' },
      { key: 'volume', label: 'Asset: Volume (0-1)', type: 'number', placeholder: '1' },
    ],
    exec: (p) => {
      if (p.mode === 'asset' && p.audioAssetId) {
        const asset = findAudioAssetById(p.audioAssetId);
        if (asset && asset.audioBuffer) app.audio.playBuffer(asset.audioBuffer, { volume: p.volume ? parseFloat(p.volume) || 1 : 1 });
        return;
      }
      app.audio.playBlip({ frequency: p.frequency || 660, duration: p.duration || 0.15, type: p.waveform || 'sine' });
    },
  },
  // Wave 7 (Priority B/Section 15): the one new action this priority's own
  // dogfood justified -- reachable both as an ordinary Behavior action (for
  // completeness/consistency, matching "reuse ACTION_TYPES, don't invent a
  // parallel language") and as an Animation Event action (its actual
  // motivating use case: firing the Player's weapon at a specific animated
  // frame instead of the instant Attack was pressed). Deliberately a no-op
  // when there's no Player/weapon to fire (an Animation Event authored on a
  // non-Player character's clip, or fired with nobody spawned, is silently
  // inert rather than throwing).
  fireWeapon: { label: 'Fire Player Weapon (Animation Event)', fields: [], exec: () => performPlayerWeaponFire() },
  // Wave 9 (Priority B/Section 34): shared `Emit Noise` action -- reachable
  // as an ordinary Behavior/Node Graph/Sequence action like every other
  // action, for authored noise sources beyond weapon fire itself (a loud
  // machine, a thrown object, a scripted alarm). Target-optional, defaults
  // to self (the item this behavior is authored on), same convention every
  // other target-optional action already uses.
  emitNoise: {
    label: 'Emit Noise',
    fields: [
      { key: 'targetId', label: 'Source (empty = self)', type: 'target' },
      { key: 'radius', label: 'Radius', type: 'number', placeholder: '15' },
    ],
    exec: (p, item) => {
      const source = resolveTarget(p, item);
      const pos = source && source.entity ? source.entity.position : (player ? player.entity.position : null);
      if (pos) emitNoiseEvent(pos, p.radius ? parseFloat(p.radius) || 15 : 15);
    },
  },
  // Wave 9 (Priority C, Sections 44-45): Camera Shake -- a reusable
  // primitive layered TEMPORARILY over whatever Camera/controller is
  // currently active, never mutating any authored Camera setting
  // permanently (Section 44's own explicit requirement). Reachable from
  // Behaviors, Node Graph, Animation Events, and Sequences alike through
  // this same ACTION_TYPES entry -- no parallel "shake" mechanism per
  // caller.
  cameraShake: {
    label: 'Camera Shake',
    fields: [
      { key: 'preset', label: 'Effect preset', type: 'select', options: ['Custom','SoftHit','HeavyImpact','Rumble','DirectionalImpulse'], optionLabels:{Custom:'Custom (historical shake)',SoftHit:'Soft hit',HeavyImpact:'Heavy impact',Rumble:'Rumble',DirectionalImpulse:'Directional impulse'}, cameraShakePreset:true },
      { key: 'intensity', label: 'Custom intensity (world units)', type: 'number', placeholder: '0.3', min:0, cameraShakeScalar:true },
      { key: 'duration', label: 'Custom duration (sec)', type: 'number', placeholder: '0.3', min:0, cameraShakeScalar:true },
      { key: 'direction', label: 'Impulse direction (world axis)', type: 'select', options: ['right','left','up','down','forward','back'],optionLabels:{right:'+X',left:'−X',up:'+Y',down:'−Y',forward:'+Z',back:'−Z'} },
    ],
    exec: (p) => {const policy=resolveCameraShakePolicy(p);if(policy)triggerCameraShake(policy.intensity,policy.duration,policy.preset==='Custom'?null:policy);},
  },
  // Wave 9C (Priority B, Sections 24-26): Play Camera Path -- the shared
  // action every caller (Behaviors, Node Graph, Sequence) reaches through
  // the SAME `executeAction` every other action already funnels through;
  // no Sequence-only camera-path code (Section 25/33's own explicit
  // requirement). `pathId`/`lookAtTargetId` are ordinary `target`-type
  // fields (reused, not a new "path reference" field type) -- any placed
  // item can technically be picked, but only a real `kind:'path'` item
  // does anything (`startCameraPath`'s own guard). `returnToPrevious`
  // resolves the currently-authored ACTIVE camera by name at the moment
  // this fires (best-effort -- there's no single global "the current
  // camera" concept beyond whatever `app.camera` is doing live) via a
  // simple heuristic: the last Camera object `applyCameraPreset` touched.
  playCameraPath: {
    label: 'Play Camera Path',
    fields: [
      { key: 'pathId', label: 'Path', type: 'target', cameraPath: true },
      { key: 'duration', label: 'Duration (sec)', type: 'number', placeholder: '5' },
      { key: 'loop', label: 'Loop', type: 'checkbox', placeholder: 'Loop' },
      { key: 'lookMode', label: 'Look Mode', type: 'select', options: ['alongPath', 'lookAtObject', 'fixedTarget'] },
      { key: 'lookAtTargetId', label: 'Look At Object (if Look Mode = lookAtObject)', type: 'target' },
      { key: 'fixedTargetX', label: 'Fixed Target X (fixedTarget mode)', type: 'number', placeholder: 'Blank = legacy forward aim' },
      { key: 'fixedTargetY', label: 'Fixed Target Y (fixedTarget mode)', type: 'number', placeholder: '0 when another axis is set' },
      { key: 'fixedTargetZ', label: 'Fixed Target Z (fixedTarget mode)', type: 'number', placeholder: '0 when another axis is set' },
      { key: 'returnToPrevious', label: 'Return To Previous Camera When Done', type: 'checkbox', placeholder: 'Return To Previous Camera' },
    ],
    exec: (p) => {
      const pathItem = p.pathId ? findItemById(p.pathId) : null;
      if (!pathItem || pathItem.kind !== 'path') return;
      const pointIds=pathItem.pointIds;
      const points=Array.isArray(pointIds)?pointIds.map(id=>findItemById(id)?.entity?.position):[];
      if(points.length<2||points.some(point=>!point||![point.x,point.y,point.z].every(Number.isFinite))){
        showToast('Camera Path not started: add at least two available finite points in the Path Inspector.');return;
      }
      const duration = p.duration ? parseFloat(p.duration) || 5 : 5;
      const lookAtTargetId = p.lookMode === 'lookAtObject' ? p.lookAtTargetId : null;
      const returnCameraId = p.returnToPrevious ? (lastAppliedCameraItemId || null) : null;
      const axes=['fixedTargetX','fixedTargetY','fixedTargetZ'];
      const explicitFixed=p.lookMode==='fixedTarget'&&axes.some(key=>p[key]!==undefined&&p[key]!==null&&p[key]!=='');
      const xyz=explicitFixed?axes.map(key=>p[key]===undefined||p[key]===null||p[key]===''?0:Number(p[key])):null;
      if(xyz&&!xyz.every(Number.isFinite))return;
      startCameraPath(pathItem, duration, !!p.loop, p.lookMode, lookAtTargetId, xyz?new Opus.Vec3(...xyz):null, returnCameraId);
    },
  },
  win: { label: 'Win Game', legacy: true, legacyParam: null, fields: [], exec: () => endGame('win') },
  lose: { label: 'Lose Game', legacy: true, legacyParam: null, fields: [], exec: () => endGame('lose') },
  objective: {
    label: 'Update Objective', legacy: true, legacyParam: 'text',
    fields: [{ key: 'text', label: 'Objective', type: 'text', placeholder: 'Objective text' }],
    exec: (p) => setObjective(p.text || ''),
  },
  boost: {
    label: 'Boost Pad', legacy: true, legacyParam: 'force',
    fields: [{ key: 'force', label: 'Force', type: 'number', placeholder: '10' }],
    exec: (p) => {
      if (!player) return;
      const forward = new Opus.Vec3(Math.sin(player.entity.rotationY), 0, Math.cos(player.entity.rotationY));
      player.velocity = player.velocity.add(forward.scale(parseFloat(p.force) || 10));
      if (player.controllerType === 'hovercraft') craftBoostActive = Math.max(craftBoostActive, 0.4);
      app.audio.playBlip({ frequency: 340, duration: 0.15, type: 'square' });
      showToast('⚡ Boost!');
    },
  },
  launchPlayer: {
    label: 'Launch Player', help: 'Throws the player upward (a jump pad). Upward speed in metres per second; 14 clears about 5 m.',
    fields: [{ key: 'force', label: 'Upward speed', type: 'number', placeholder: '14' }],
    exec: (p) => {
      if (!player || !player.entity || !player.velocity) return;
      const force = Number.isFinite(parseFloat(p.force)) ? Math.max(0, Math.min(60, parseFloat(p.force))) : 14;
      const v = player.velocity;
      player.velocity = new Opus.Vec3(v.x, force, v.z);
      player.entity.position = player.entity.position.add(new Opus.Vec3(0, 0.05, 0)); // leave the ground this frame
      app.audio.playBlip({ frequency: 520, duration: 0.12, type: 'sine' });
    },
  },
  teleportPlayer: {
    label: 'Teleport Player', help: 'Moves the player to stand on or beside another object (a teleporter or portal) and stops their movement.',
    fields: [{ key: 'targetId', label: 'Destination object', type: 'target', implicitSelf: false, emptyLabel: 'Choose destination' }],
    exec: (p, item) => {
      const target = p.targetId ? findItemById(p.targetId) : null;
      if (!player || !player.entity || !target || !placed.includes(target)) return;
      const bounds = typeof surfaceWorldBounds === 'function' && target.entity ? surfaceWorldBounds(target.entity) : null;
      const at = itemPosition(target);
      // Land just beside the destination so arriving does not immediately re-trigger it.
      // Clear of the destination's own trigger: its box for pads/volumes, its generous touch sphere otherwise.
      const footprint = bounds ? Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) / 2 : 0.5;
      const sphere = target.padTrigger || target.isTrigger || !target.entity ? 0 : 1.5 * Math.max(target.entity.scale.x, target.entity.scale.z);
      const side = Math.max(footprint + 0.9, sphere + 0.5);
      const top = bounds ? bounds.max[1] : at.y;
      const heading = target.entity ? target.entity.forward : new Opus.Vec3(0, 0, 1);
      const flat = Math.hypot(heading.x, heading.z) > 1e-4 ? new Opus.Vec3(heading.x / Math.hypot(heading.x, heading.z), 0, heading.z / Math.hypot(heading.x, heading.z)) : new Opus.Vec3(0, 0, 1);
      player.entity.position = new Opus.Vec3(at.x + flat.x * side, top + 1.2, at.z + flat.z * side);
      if (player.velocity) player.velocity = new Opus.Vec3(0, 0, 0);
      app.audio.playBlip({ frequency: 880, duration: 0.18, type: 'triangle' });
    },
  },
  moveObject: {
    label: 'Move Object (relative)',
    fields: [
      { key: 'targetId', label: 'Target', type: 'target' },
      { key: 'dx', label: 'dX', type: 'number', placeholder: '0' },
      { key: 'dy', label: 'dY', type: 'number', placeholder: '0' },
      { key: 'dz', label: 'dZ', type: 'number', placeholder: '0' },
    ],
    exec: (p, item) => {
      const entity = targetEntity(resolveTarget(p, item));
      if (!entity) return;
      entity.position.set(entity.position.x + (p.dx || 0), entity.position.y + (p.dy || 0), entity.position.z + (p.dz || 0));
    },
  },
  setPosition: {
    label: 'Set Position',
    fields: [
      { key: 'targetId', label: 'Target', type: 'target' },
      { key: 'x', label: 'X', type: 'number', placeholder: '0' },
      { key: 'y', label: 'Y', type: 'number', placeholder: '0' },
      { key: 'z', label: 'Z', type: 'number', placeholder: '0' },
    ],
    exec: (p, item) => {
      const entity = targetEntity(resolveTarget(p, item));
      if (!entity) return;
      entity.position.set(p.x || 0, p.y || 0, p.z || 0);
    },
  },
  rotateObject: {
    label: 'Rotate Object (relative Y)',
    fields: [
      { key: 'targetId', label: 'Target', type: 'target' },
      { key: 'degrees', label: 'Degrees', type: 'number', placeholder: '90' },
    ],
    exec: (p, item) => {
      const entity = targetEntity(resolveTarget(p, item));
      if (!entity) return;
      entity.rotationY += (p.degrees || 0) * Math.PI / 180;
    },
  },
  openDoor: {
    label: 'Open Door', help: 'Open this Cube/Sprite Door / Gate component. Hides its panel and disables its existing Box/Circle 2D colliders; does not animate.',
    fields: [{ key: 'targetId', label: 'Door / Gate (Self by default)', type: 'target' }],
    exec: (p, item) => setDoorGateOpen(resolveTarget(p, item), true),
  },
  closeDoor: {
    label: 'Close Door', help: 'Close a Door / Gate. An occupied doorway stays open; move clear and try again. Preserves originally disabled colliders.',
    fields: [{ key: 'targetId', label: 'Door / Gate (Self by default)', type: 'target' }],
    exec: (p, item) => setDoorGateOpen(resolveTarget(p, item), false),
  },
  toggleDoor: {
    label: 'Toggle Door', help: 'Open a closed Door / Gate, or safely close an open one. Requires an enabled Door / Gate component on the target.',
    fields: [{ key: 'targetId', label: 'Door / Gate (Self by default)', type: 'target' }],
    exec: (p, item) => { const target = resolveTarget(p, item); return setDoorGateOpen(target, !doorGateState.get(target)?.open); },
  },
  setVisibility: {
    label: 'Show/Hide Object',
    fields: [
      { key: 'targetId', label: 'Target', type: 'target' },
      { key: 'visible', label: 'Visible', type: 'checkbox' },
    ],
    exec: (p, item) => {
      const entity = targetEntity(resolveTarget(p, item));
      if (entity) entity.visible = !!p.visible;
    },
  },
  enableObject: {
    label: 'Enable Object',
    fields: [{ key: 'targetId', label: 'Target', type: 'target' }],
    exec: (p, item) => { const e = targetEntity(resolveTarget(p, item)); if (e) e.visible = true; },
  },
  disableObject: {
    label: 'Disable Object',
    fields: [{ key: 'targetId', label: 'Target', type: 'target' }],
    exec: (p, item) => { const e = targetEntity(resolveTarget(p, item)); if (e) e.visible = false; },
  },
  destroyObject: {
    label: 'Destroy Object',
    fields: [{ key: 'targetId', label: 'Target', type: 'target' }],
    // Deliberately non-cascading even when the target happens to be part of
    // a runtime-spawned assembly -- "just this piece" (shoot off a robot's
    // Weapon Mount without destroying the whole robot) is a real, distinct
    // use case from Destroy Assembly below, and every pre-Wave-5 saved
    // game's Destroy Object behavior must not silently start cascading.
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (target) removeItemFromScene(target);
    },
  },
  // Runtime assembly destruction (Wave 5, section 13) -- the explicit
  // counterpart to Destroy Object's single-piece removal. Resolves the
  // target to its assembly (via assemblyId) and removes every member; for
  // a target with no assemblyId (anything not a multi-object runtime spawn)
  // this is identical to Destroy Object, so using it on an ordinary object
  // is always safe, never a surprise.
  destroyAssembly: {
    label: 'Destroy Assembly',
    fields: [{ key: 'targetId', label: 'Target', type: 'target' }],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (target) removeAssembly(target);
    },
  },
  dropLoot: {
    label: 'Drop Loot',
    help: 'Draw once from a Project Loot Table. Spawns its collectible Prefab at this Object plus offset, or an explicit No drop. All outcomes must be available. Fresh Play resets the sequence; Game Save/Load retains progress. No automatic death hook.',
    fields: [{key:'tableId',label:'Loot Table',type:'lootTableRef'},{key:'dx',label:'Offset X',type:'number',default:0},{key:'dy',label:'Offset Y',type:'number',default:0},{key:'dz',label:'Offset Z',type:'number',default:0}],
    exec: (p,item) => dropLoot(p,item),
  },
  spawnPrefab: {
    label: 'Spawn Prefab',
    fields: [
      { key: 'prefabName', label: 'Prefab', type: 'prefab' },
      { key: 'dx', label: 'Offset X', type: 'number', placeholder: '0' },
      { key: 'dz', label: 'Offset Z', type: 'number', placeholder: '0' },
    ],
    // Runtime spawning -- the "another wave of enemies appears" case a
    // design-time-only palette/prefab system can't cover on its own.
    // Reuses spawnPrefabAssembly (Wave 5) -- the exact same instantiation +
    // trigger-wiring + assembly-bookkeeping path Spawner uses -- so a
    // graph/behavior-triggered spawn of a MULTI-object prefab creates the
    // complete assembly (all parts, hierarchy, lights, emitters), not just
    // its root the way this action shipped in Wave 4.
    exec: (p, item) => {
      const prefab = prefabs.find((pf) => pf.name === p.prefabName);
      if (!prefab) return;
      const base = item.entity ? item.entity.position : new Opus.Vec3();
      const rootRecord = prefab.records ? (prefab.records.find((rr) => rr.id === prefab.rootId) || prefab.records[0]) : prefab.record;
      const rootY = (rootRecord.position || (rootRecord.options && rootRecord.options.position))[1];
      const position = new Opus.Vec3(base.x + (p.dx || 0), rootY, base.z + (p.dz || 0));
      spawnPrefabAssembly(prefab, position);
    },
  },
  changeColor: {
    label: 'Change Color',
    fields: [
      { key: 'targetId', label: 'Target', type: 'target' },
      { key: 'color', label: 'Color', type: 'color', placeholder: '#ffffff' },
    ],
    exec: (p, item) => {
      const entity = targetEntity(resolveTarget(p, item));
      if (!entity || !p.color) return;
      const [r, g, b] = hexToRgb(p.color);
      entity.color[0] = r; entity.color[1] = g; entity.color[2] = b;
    },
  },
  setCounter: {
    label: 'Set Counter',
    fields: [
      { key: 'counter', label: 'Counter name', type: 'text', placeholder: 'score' },
      { key: 'value', label: 'Value', type: 'number', placeholder: '0' },
    ],
    exec: (p) => { window.__gameState = window.__gameState || {}; window.__gameState[p.counter] = p.value || 0; },
  },
  activateCheckpoint: {
    label: 'Activate Checkpoint',
    fields: [{ key: 'targetId', label: 'Checkpoint Object', type: 'target' }],
    exec: (p, item) => activateCheckpointComponent(resolveTarget(p, item)),
  },
  setCheckpoint: {
    label: 'Set Checkpoint',
    fields: [],
    // Records the firing item's OWN position -- a checkpoint is meant to be
    // touched (an On Enter behavior on a Trigger Volume or any object), so
    // "self" is the only position that makes sense; no target field needed.
    // Keeps the automatic void-fall floor (see VOID_FALL_MARGIN) tracking
    // the most recently touched checkpoint, not the level's original spawn
    // -- a checkpoint reached high above the starting area shouldn't leave
    // the void floor 30 units below a spawn point far below it.
    exec: (p, item) => { if (item.entity) { window.__checkpoint = item.entity.position.clone(); voidFallY = item.entity.position.y - VOID_FALL_MARGIN; } },
  },
  respawnAtCheckpoint: {
    label: 'Respawn At Checkpoint',
    fields: [],
    // Falls back to the level's normal spawn point if no checkpoint has
    // been set yet -- e.g. dying to the very first hazard, before reaching
    // any checkpoint, should still respawn somewhere sane, not do nothing.
    exec: () => {
      if (!player) return;
      const target = window.__checkpoint ? window.__checkpoint.clone() : computeSpawnPoint();
      player.entity.position = target;
      player.velocity = new Opus.Vec3();
      voidFallY = target.y - VOID_FALL_MARGIN;
    },
  },
  switchLevel: {
    label: 'Switch Level',
    fields: [{ key: 'levelId', label: 'Level', type: 'level' }],
    // Mid-play transition, not a fresh session: __gameState (score/lives)
    // deliberately carries over -- a multi-level game where beating level 1
    // reset your score entering level 2 would be a bug, not a feature. The
    // current level's live edits ARE saved first (syncCurrentLevelObjects),
    // so returning to it later (e.g. Switch Level back) isn't a silent
    // rollback to however it looked when the project was last saved.
    // Resolves by id first (current/Wave-3-saved behaviors); falls back to
    // a name lookup for any behavior saved before stable level ids existed.
    exec: (p) => {
      const index = p.levelId ? levels.findIndex((l) => l.id === p.levelId) : levels.findIndex((l) => l.name === p.levelName);
      if (index === -1 || index === currentLevelIndex) return;
      switchLevelWithTransition(index, true);
    },
  },
  nextLevel: {
    label: 'Next Level',
    fields: [],
    exec: () => {
      if (currentLevelIndex + 1 >= levels.length) return; // already the last level -- no-op, not a wraparound
      switchLevelWithTransition(currentLevelIndex + 1, true);
    },
  },
  previousLevel: {
    label: 'Previous Level',
    fields: [],
    exec: () => {
      if (currentLevelIndex - 1 < 0) return;
      switchLevelWithTransition(currentLevelIndex - 1, true);
    },
  },
  restartLevel: {
    label: 'Restart Level',
    fields: [],
    // Reloads the CURRENT level's own saved objects (undoing runtime
    // changes like collected pickups) without the session-wide resets a
    // fresh Play does -- score/lives/inventory/flags deliberately carry
    // over, same reasoning as Switch Level above.
    exec: () => switchLevelWithTransition(currentLevelIndex, true),
  },
  changeCamera: {
    label: 'Change Camera',
    // Wave 6B (Priority K): optional Blend Duration -- 0 (the default, and
    // what every project saved before this priority has) is an INSTANT cut,
    // bit-identical to the old behavior; a positive value interpolates
    // through applyCameraPresetBlended instead. Pairs naturally with a
    // Sequence's own Change Camera / Delay / Change Camera steps (Priority E).
    fields: [{ key: 'cameraId', label: 'Camera', type: 'cameraPreset' }, { key: 'blendSeconds', label: 'Blend Duration (sec, 0 = instant cut)', type: 'number', min:0, placeholder: '0' }],
    exec: (p) => {
      const camItem = p.cameraId ? findItemById(p.cameraId) : null;
      const duration=p.blendSeconds==null||p.blendSeconds===''?0:Number(p.blendSeconds);
      if (camItem) applyCameraPresetBlended(camItem, duration);
    },
  },
  // Wave 6 (Priority L): the cutscene gate's own missing piece -- pairs
  // with Change Camera + Delay/Wait (Node Graph) to build "On Start: Freeze
  // Player -> Change Camera A -> Delay -> Change Camera B -> Delay ->
  // Change Camera (back to the player's own chase/follow preset) -> Unfreeze
  // Player" entirely from existing action/graph primitives, no dedicated
  // Cutscene track editor needed. See updatePlayerController's own comment
  // for exactly what freezing does and doesn't stop.
  freezePlayer: {
    label: 'Freeze Player (for a cutscene)',
    fields: [],
    exec: () => { playerFrozen = true; },
  },
  unfreezePlayer: {
    label: 'Unfreeze Player',
    fields: [],
    exec: () => { playerFrozen = false; },
  },
  // Wave 6B (Priority E): the one new shared action Sequence authoring
  // needs -- usable from a Behavior OR the Node Graph exactly like any other
  // action, since it goes through this same ACTION_TYPES/executeAction path.
  // Deliberately just triggers a run; no "wait for it to finish" here (a
  // Sequence step that itself needs to wait uses its own Delay step).
  playSequence: {
    label: 'Play Sequence',
    fields: [{ key: 'sequenceId', label: 'Sequence', type: 'sequence' }],
    exec: (p, item) => { const seq = findSequenceById(p.sequenceId); if (seq) playSequence(seq, item); },
  },
  incrementCounter: {
    label: 'Increment Counter',
    fields: [{ key: 'counter', label: 'Counter name', type: 'text', placeholder: 'Counter name' }],
    exec: (p) => { window.__gameState = window.__gameState || {}; window.__gameState[p.counter] = (window.__gameState[p.counter] || 0) + 1; },
  },
  // Named counters (setCounter/incrementCounter/decrementCounter, read back
  // via the Node Graph's Counter Reaches condition) are still the generic
  // primitive lives/score/inventory-count/anything-else build on. Health
  // specifically graduated to its own actions below (Wave 2) -- still just
  // window.__gameState.health/.maxHealth under the hood (so the generic
  // Counter Reaches/At Most conditions keep working on it unmodified,
  // exactly as they did when 'health' was only a convention), but with
  // clamping to [0, maxHealth], auto-init, and damage/heal semantics that a
  // bare counter name typed by hand couldn't express (an "Increment Counter"
  // on 'health' has no idea what the max should clamp to).
  decrementCounter: {
    label: 'Decrement Counter',
    fields: [
      { key: 'counter', label: 'Counter name', type: 'text', placeholder: 'Counter name' },
      { key: 'floorAtZero', label: 'Stop at 0 (no negatives)', type: 'checkbox' },
    ],
    exec: (p) => {
      window.__gameState = window.__gameState || {};
      const next = (window.__gameState[p.counter] || 0) - 1;
      window.__gameState[p.counter] = p.floorAtZero ? Math.max(0, next) : next;
    },
  },
  // ensureHealthInit: called by every health action below before it reads or
  // writes health/maxHealth, so firing Damage Player before any On Start
  // behavior has run (e.g. a Damage Zone touched a split-second into Play)
  // still lands on a sane starting value instead of NaN/undefined math.
  damagePlayer: {
    label: 'Damage Player',
    fields: [
      { key: 'amount', label: 'Amount', type: 'number', placeholder: '10' },
      { key: 'instantKill', label: 'Instant Kill', type: 'checkbox' },
      { key: 'damageType', label: 'Damage Type', type: 'select', options: ['ordinary','fire','ice'], optionLabels: {ordinary:'Ordinary',fire:'Fire',ice:'Ice'} },
      { key: 'cooldown', label: 'Cooldown, sec (0 = every trigger)', type: 'number', placeholder: '0' },
    ],
    exec: (p, item) => {
      ensureHealthInit();
      const cooldown = parseFloat(p.cooldown) || 0;
      if (cooldown > 0) {
        const key = item ? item.id : '__global__';
        window.__damageCooldowns = window.__damageCooldowns || {};
        const last = window.__damageCooldowns[key];
        if (last !== undefined && simElapsed - last < cooldown) return;
        window.__damageCooldowns[key] = simElapsed;
      }
      let amount = p.instantKill ? window.__gameState.maxHealth : (parseFloat(p.amount) || 0);
      if (!p.instantKill && typeof currentPlayerSettings !== 'undefined' && currentPlayerSettings.damageResistance !== undefined) amount = OpusDamagePolicy.resolve(amount, p.damageType, currentPlayerSettings.damageResistance).amount;
      window.__gameState.health = Math.max(0, window.__gameState.health - amount);
    },
  },
  refillPlayerAmmo: {
    label: 'Refill Active Player Ammunition',
    fields: [],
    exec: () => refillActivePlayerAmmo(),
  },
  healPlayer: {
    label: 'Heal Player',
    fields: [{ key: 'amount', label: 'Amount', type: 'number', placeholder: '10' }],
    exec: (p) => {
      ensureHealthInit();
      window.__gameState.health = Math.min(window.__gameState.maxHealth, window.__gameState.health + (parseFloat(p.amount) || 0));
    },
  },
  setPlayerHealth: {
    label: 'Set Player Health',
    fields: [
      { key: 'value', label: 'Health', type: 'number', placeholder: '100' },
      { key: 'maxHealth', label: 'Also set Max Health to (optional)', type: 'number', placeholder: '' },
    ],
    exec: (p) => {
      ensureHealthInit();
      if (p.maxHealth !== undefined && p.maxHealth !== '') window.__gameState.maxHealth = Math.max(1, parseFloat(p.maxHealth) || 1);
      window.__gameState.health = Math.max(0, Math.min(window.__gameState.maxHealth, parseFloat(p.value) || 0));
    },
  },
  // Object Health (Wave 4) -- generalizes Player Health to ANY placed
  // object, the same `{current, max}` shape, so an enemy no longer needs a
  // generic Counter + a hand-wired Node Graph "Health At Most(0) -> Lose"
  // to simulate dying (the exact pattern Survival Arena's Hunter prefab
  // used before this existed) -- Damage Object destroys the object outright
  // once health reaches 0, no separate "Destroy on Zero" action needed.
  damageObject: {
    label: 'Damage Object',
    fields: [
      { key: 'targetId', label: 'Object', type: 'target' },
      { key: 'amount', label: 'Amount', type: 'number', placeholder: '10' },
      { key: 'damageType', label: 'Damage Type', type: 'select', options: ['ordinary','fire','ice'], optionLabels: {ordinary:'Ordinary',fire:'Fire',ice:'Ice'} },
    ],
    exec: (p, item) => {
      const t = resolveTarget(p, item);
      if (!t || (t.kind !== 'cube' && t.kind !== 'sprite')) return;
      ensureObjectHealthInit(t);
      let amount = parseFloat(p.amount) || 0;
      if (t.components?.['damage-resistance'] !== undefined) amount = OpusDamagePolicy.resolve(amount, p.damageType, t.components['damage-resistance']).amount;
      t.health.current = Math.max(0, t.health.current - amount);
      if (t.health.current <= 0) removeAssembly(t); // Wave 5: cascades for a runtime-spawned assembly, identical to before for anything else
    },
  },
  applyHitboxDamage: {
    label:'Apply Hitbox Damage',
    fields:[{key:'sourceId',label:'Hitbox Object (Self by default)',type:'target'},
      {key:'damageSourceId',label:'Damage Component Source (Hitbox Object by default)',type:'target'},
      {key:'targetTag',label:'Target Tag (empty means all Health targets)',type:'text'}],
    exec:(p,item)=>applyHitboxDamage(p.sourceId,p.damageSourceId,p.targetTag,item),
  },
  applyDamageComponent: {
    label: 'Apply Damage Component',
    fields: [
      { key: 'targetId', label: 'Health Target', type: 'target' },
      { key: 'sourceId', label: 'Damage Source', type: 'target' },
    ],
    exec: (p, item) => {
      const source = resolveTarget({ targetId: p.sourceId }, item);
      const component = source && source.components && source.components.damage;
      if (!component || !OpusAuthoring.registry.get('damage').inspectRecord(component).ok) return;
      const amount = Number(component.amount);
      if (!Number.isFinite(amount) || amount < 0) return;
      ACTION_TYPES.damageObject.exec({ targetId: p.targetId, amount, damageType: component.version===2?component.damageType:undefined }, item);
    },
  },
  healObject: {
    label: 'Heal Object',
    fields: [
      { key: 'targetId', label: 'Object', type: 'target' },
      { key: 'amount', label: 'Amount', type: 'number', placeholder: '10' },
    ],
    exec: (p, item) => {
      const t = resolveTarget(p, item);
      if (!t || (t.kind !== 'cube' && t.kind !== 'sprite')) return;
      ensureObjectHealthInit(t);
      t.health.current = Math.min(t.health.max, t.health.current + (parseFloat(p.amount) || 0));
    },
  },
  showHudElement: {
    label: 'Show HUD Element',
    fields: [{ key: 'hudId', label: 'Element', type: 'hudElementRef' }],
    exec: (p) => { const el = currentUiConfig.hudElements.find((e) => e.id === p.hudId); if (el) el.visible = true; },
  },
  hideHudElement: {
    label: 'Hide HUD Element',
    fields: [{ key: 'hudId', label: 'Element', type: 'hudElementRef' }],
    exec: (p) => { const el = currentUiConfig.hudElements.find((e) => e.id === p.hudId); if (el) el.visible = false; },
  },
  setHudText: {
    label: 'Set HUD Text',
    fields: [
      { key: 'hudId', label: 'Element', type: 'hudElementRef' },
      { key: 'text', label: 'New text', type: 'text', placeholder: 'New text' },
    ],
    exec: (p) => { const el = currentUiConfig.hudElements.find((e) => e.id === p.hudId); if (el) el.text = p.text || ''; },
  },
  moveHudTo: {
    label: 'Move HUD To (Tween)',
    fields: [{key:'hudId',label:'HUD Element',type:'hudElementRef',required:true},{key:'x',label:'Offset X (px)',type:'number',min:-1000000,max:1000000},{key:'y',label:'Offset Y (px)',type:'number',min:-1000000,max:1000000},{key:'duration',label:'Duration (sec; 0 = immediate)',type:'number',min:0,max:3600},{key:'easing',label:'Easing',type:'select',options:['linear','easeIn','easeOut','easeInOut']}],
    exec: p => startHudTween('move',p),
  },
  fadeHudTo: {
    label: 'Fade HUD To (Tween)',
    fields: [{key:'hudId',label:'HUD Element',type:'hudElementRef',required:true},{key:'opacity',label:'Opacity (0–1)',type:'number',min:0,max:1},{key:'duration',label:'Duration (sec; 0 = immediate)',type:'number',min:0,max:3600},{key:'easing',label:'Easing',type:'select',options:['linear','easeIn','easeOut','easeInOut']}],
    exec: p => startHudTween('fade',p),
  },
  scaleHudTo: {
    label: 'Scale HUD To (Tween)',
    fields: [{key:'hudId',label:'HUD Element',type:'hudElementRef',required:true},{key:'scale',label:'Scale (0.01–100)',type:'number',min:0.01,max:100},{key:'duration',label:'Duration (sec; 0 = immediate)',type:'number',min:0,max:3600},{key:'easing',label:'Easing',type:'select',options:['linear','easeIn','easeOut','easeInOut']}],
    exec: p => startHudTween('scale',p),
  },
  // Tween actions -- Move/Rotate/Scale To, animated over `duration` seconds
  // rather than snapping. Each pushes an entry onto `activeTweens`, ticked
  // once per frame by tickTweens() in the main update loop (same
  // simulation-time, pause-safe reasoning as Timers/Delay above). A second
  // tween on the same entity+property replaces the first outright (not
  // blended) -- simplest predictable behavior for "the door was already
  // closing, now open it instead".
  moveTo: {
    label: 'Move To (Tween)',
    fields: [
      { key: 'targetId', label: 'Object', type: 'target' },
      { key: 'x', label: 'X', type: 'number', placeholder: '0' },
      { key: 'y', label: 'Y', type: 'number', placeholder: '0' },
      { key: 'z', label: 'Z', type: 'number', placeholder: '0' },
      { key: 'duration', label: 'Duration (sec)', type: 'number', placeholder: '1' },
      { key: 'easing', label: 'Easing', type: 'select', options: ['linear', 'easeIn', 'easeOut', 'easeInOut'] },
    ],
    exec: (p, item) => {
      const entity = targetEntity(resolveTarget(p, item));
      if (!entity) return;
      startTween(entity, 'position', entity.position.clone(), new Opus.Vec3(parseFloat(p.x) || 0, parseFloat(p.y) || 0, parseFloat(p.z) || 0), p.duration, p.easing);
    },
  },
  rotateTo: {
    label: 'Rotate To (Tween)',
    fields: [
      { key: 'targetId', label: 'Object', type: 'target' },
      { key: 'degrees', label: 'Rotation Y (degrees)', type: 'number', placeholder: '0' },
      { key: 'duration', label: 'Duration (sec)', type: 'number', placeholder: '1' },
      { key: 'easing', label: 'Easing', type: 'select', options: ['linear', 'easeIn', 'easeOut', 'easeInOut'] },
    ],
    exec: (p, item) => {
      const entity = targetEntity(resolveTarget(p, item));
      if (!entity) return;
      startTween(entity, 'rotationY', entity.rotationY, (parseFloat(p.degrees) || 0) * Math.PI / 180, p.duration, p.easing);
    },
  },
  scaleTo: {
    label: 'Scale To (Tween)',
    fields: [
      { key: 'targetId', label: 'Object', type: 'target' },
      { key: 'x', label: 'Scale X', type: 'number', placeholder: '1' },
      { key: 'y', label: 'Scale Y', type: 'number', placeholder: '1' },
      { key: 'z', label: 'Scale Z', type: 'number', placeholder: '1' },
      { key: 'duration', label: 'Duration (sec)', type: 'number', placeholder: '1' },
      { key: 'easing', label: 'Easing', type: 'select', options: ['linear', 'easeIn', 'easeOut', 'easeInOut'] },
    ],
    exec: (p, item) => {
      const entity = targetEntity(resolveTarget(p, item));
      if (!entity) return;
      startTween(entity, 'scale', entity.scale.clone(), new Opus.Vec3(parseFloat(p.x) || 1, parseFloat(p.y) || 1, parseFloat(p.z) || 1), p.duration, p.easing);
    },
  },
  // Property Animation Clips -- distinct from the Tween actions above (a
  // clip is multi-keyframe, authored once via the Animation Editor and
  // replayed by name; a Tween is a single one-shot move). Shares nothing at
  // the action layer with Tweens beyond both existing in the same vocabulary
  // and both ultimately calling entity.position/rotationY/scale.set.
  playAnimation: {
    label: 'Play Animation',
    fields: [
      { key: 'targetId', label: 'Object', type: 'target' },
      { key: 'clipName', label: 'Clip Name', type: 'text', placeholder: 'e.g. DoorOpen' },
    ],
    exec: (p, item) => {
      const t = resolveTarget(p, item);
      if (!t || !['cube','sprite'].includes(t.kind) || !t.animationClips) return;
      const idx = t.animationClips.findIndex((c) => c.name === p.clipName);
      if (idx === -1) return;
      t._anim = { clipIndex: idx, elapsed: 0, playing: true };
    },
  },
  startPlatformMotion: {
    label: 'Start Platform Motion',
    fields: [{ key: 'targetId', label: 'Platform', type: 'target' }],
    exec: (p, item) => startPlatformMotion(resolveTarget(p, item)),
  },
  setSpriteAnimationState: {
    label: 'Set Sprite Animation State',
    fields: [
      { key: 'targetId', label: 'Sprite Object', type: 'target' },
      { key: 'stateId', label: 'Animation State', type: 'spriteAnimationState' },
      { key: 'restartIfActive', label: 'Restart If Already Active', type: 'checkbox', placeholder: 'Restart the active state from frame 0' },
    ],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (target && target.kind === 'sprite') setSpriteAnimationState(target, p.stateId, { restartIfActive: !!p.restartIfActive });
    },
  },
  setSpriteDirection: {
    label: 'Set Sprite Direction',
    fields: [
      { key: 'targetId', label: 'Sprite Object', type: 'target' },
      { key: 'direction', label: 'Direction', type: 'spriteDirection' },
    ],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (target && target.kind === 'sprite') setSpriteDirection(target, p.direction);
    },
  },
  setSpriteFlip: {
    label: 'Set Sprite Flip',
    fields: [
      { key: 'targetId', label: 'Sprite Object', type: 'target' },
      { key: 'flipX', label: 'Flip X', type: 'checkbox', placeholder: 'Mirror artwork horizontally' },
      { key: 'flipY', label: 'Flip Y', type: 'checkbox', placeholder: 'Mirror artwork vertically' },
    ],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (target && target.kind === 'sprite') setSpriteFlip(target, !!p.flipX, !!p.flipY);
    },
  },
  stopAnimation: {
    label: 'Stop Animation',
    fields: [{ key: 'targetId', label: 'Object', type: 'target' }],
    exec: (p, item) => { const t = resolveTarget(p, item); if (t && t._anim) { t._anim.playing = false; t._anim.elapsed = 0; } },
  },
  restartAnimation: {
    label: 'Restart Animation',
    fields: [{ key: 'targetId', label: 'Object', type: 'target' }],
    exec: (p, item) => { const t = resolveTarget(p, item); if (t && t._anim) { t._anim.elapsed = 0; t._anim.playing = true; } },
  },
  pauseAnimation: {
    label: 'Pause Animation',
    fields: [{ key: 'targetId', label: 'Object', type: 'target' }],
    exec: (p, item) => { const t = resolveTarget(p, item); if (t && t._anim) t._anim.playing = false; },
  },
  // Fire Projectile (Wave 4) -- ONE implementation for every case (Player
  // attack input, an AI's ranged attack, a Node Graph-scripted trap), per
  // the explicit "do not create three separate projectile implementations"
  // requirement. Direction is resolved here (object forward / toward Player
  // / toward an explicit Object Reference) and handed to the shared
  // fireProjectile() as a plain normalized Vec3, so the projectile-tracking
  // system itself never needs to know which mode fired it.
  fireProjectile: {
    label: 'Fire Projectile',
    fields: [
      { key: 'prefabName', label: 'Projectile Prefab', type: 'prefab' },
      { key: 'directionMode', label: 'Direction', type: 'select', options: ['forward', 'towardPlayer', 'towardTarget'] },
      { key: 'targetId', label: 'Target (if Toward Target)', type: 'target' },
      { key: 'speed', label: 'Speed', type: 'number', placeholder: '15' },
      { key: 'damage', label: 'Damage', type: 'number', placeholder: '10' },
      { key: 'damageType', label: 'Damage Type', type: 'select', options: ['ordinary','fire','ice'], optionLabels: {ordinary:'Ordinary',fire:'Fire',ice:'Ice'} },
      { key: 'lifetime', label: 'Lifetime (sec)', type: 'number', placeholder: '3' },
      { key: 'radius', label: 'Collision Radius', type: 'number', placeholder: '0.3' },
      { key: 'ownerTag', label: "Owner Tag (won't hit its own tag)", type: 'text', placeholder: 'enemy' },
      { key: 'targetTag', label: 'Target Tag (blank = any tagged object)', type: 'text', placeholder: 'player' },
    ],
    exec: (p, item) => {
      if (!item || !item.entity) return;
      const origin = item.entity.position.clone();
      let dir;
      if (p.directionMode === 'towardPlayer' && player) dir = player.entity.position.sub(origin);
      else if (p.directionMode === 'towardTarget') {
        const t = findItemById(p.targetId);
        dir = (t && t.entity) ? t.entity.position.sub(origin) : null;
      }
      if (!dir || dir.length() < 0.001) dir = new Opus.Vec3(Math.sin(item.entity.rotationY), 0, Math.cos(item.entity.rotationY));
      fireProjectile(p.prefabName, origin, dir, parseFloat(p.speed) || 15, parseFloat(p.damage) || 10, p.ownerTag, parseFloat(p.lifetime) || 3, parseFloat(p.radius) || 0.3, 0, p.targetTag, undefined, p.damageType);
    },
  },
  // Particle actions -- `emit()`/`.rate` were already public on
  // ParticleEmitter (used internally for the hovercraft's own trail
  // effects); Start/Stop toggle continuous emission by zeroing/restoring
  // `.rate` (saved on the item itself, not a module global, so multiple
  // stopped emitters don't clobber each other's remembered rate), Burst is
  // a direct pass-through to the existing `emit(count)`.
  startEmitter: {
    label: 'Start Emitter',
    fields: [{ key: 'targetId', label: 'Emitter', type: 'target' }],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (target && target.kind === 'emitter') target.handle.rate = target._savedRate != null ? target._savedRate : target.options.rate;
    },
  },
  stopEmitter: {
    label: 'Stop Emitter',
    fields: [{ key: 'targetId', label: 'Emitter', type: 'target' }],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (target && target.kind === 'emitter') { target._savedRate = target.handle.rate; target.handle.rate = 0; }
    },
  },
  burstEmitter: {
    label: 'Burst Emitter',
    fields: [
      { key: 'targetId', label: 'Emitter', type: 'target' },
      { key: 'count', label: 'Particle Count', type: 'number', placeholder: '20' },
    ],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (target && target.kind === 'emitter') target.handle.emit(Math.max(1, parseInt(p.count, 10) || 20));
    },
  },
  startSpawner: {
    label: 'Start Spawner',
    fields: [{ key: 'targetId', label: 'Spawner', type: 'target' }],
    exec: (p, item) => { const t = resolveTarget(p, item); if (t && t.kind === 'spawner' && t.spawnerState) t.spawnerState.enabled = true; },
  },
  stopSpawner: {
    label: 'Stop Spawner',
    fields: [{ key: 'targetId', label: 'Spawner', type: 'target' }],
    exec: (p, item) => { const t = resolveTarget(p, item); if (t && t.kind === 'spawner' && t.spawnerState) t.spawnerState.enabled = false; },
  },
  spawnOnceFromSpawner: {
    label: 'Spawn Once',
    fields: [{ key: 'targetId', label: 'Spawner', type: 'target' }],
    exec: (p, item) => { const t = resolveTarget(p, item); if (t && t.kind === 'spawner' && t.spawnerState) spawnOneFromSpawner(t); },
  },
  resetSpawner: {
    label: 'Reset Spawner',
    fields: [{ key: 'targetId', label: 'Spawner', type: 'target' }],
    // Destroys every instance the spawner currently has alive and rewinds
    // its counters to zero -- "start this wave over from scratch", not just
    // "resume counting" (Start/Stop already cover pause/resume).
    exec: (p, item) => {
      const t = resolveTarget(p, item);
      if (!t || t.kind !== 'spawner' || !t.spawnerState) return;
      for (const id of t.spawnerState.activeIds.slice()) {
        const spawned = findItemById(id);
        if (spawned) removeAssembly(spawned); // Wave 5: activeIds now tracks one id per logical spawn (assembly root or lone object) -- cascade so a reset never orphans a spawned assembly's other parts
      }
      t.spawnerState.activeIds = [];
      t.spawnerState.spawnedTotal = 0;
      t.spawnerState.timer = 0;
      t.spawnerState.firstSpawnDone = false;
    },
  },
  // Bounded, deterministic Dialogue -- a speaker/text modal, pausing the
  // game (reusing the same proven App.pause plumbing the Start Screen
  // already relies on) until dismissed. Branching is via Flags, not a
  // second action-execution path: each choice button just sets its own
  // named flag before closing, and ordinary Node Graph conditions
  // (Is Flag True/False) downstream decide what that choice actually DOES
  // -- no separate "choice action" vocabulary to duplicate the existing one.
  showDialogue: {
    label: 'Show Dialogue',
    fields: [
      { key: 'speaker', label: 'Speaker', type: 'text', placeholder: 'Speaker name' },
      { key: 'text', label: 'Text', type: 'text', placeholder: 'What they say' },
      { key: 'choice1Label', label: 'Choice 1 label (optional)', type: 'text', placeholder: 'e.g. Yes' },
      { key: 'choice1Flag', label: 'Choice 1 sets flag', type: 'text', placeholder: 'Flag name' },
      { key: 'choice2Label', label: 'Choice 2 label (optional)', type: 'text', placeholder: 'e.g. No' },
      { key: 'choice2Flag', label: 'Choice 2 sets flag', type: 'text', placeholder: 'Flag name' },
    ],
    exec: (p) => showDialogue(p),
  },
  // Inventory-lite -- window.__gameInventory[itemName] = count, the same
  // "plain named state" shape as counters/flags rather than a whole new
  // item-object/database concept. Give/Remove are the same primitive with
  // opposite sign; Has Item (below, a condition) is the read side, e.g.
  // gating a door's Open action on holding a key.
  collectPickup: {
    label: 'Collect Pickup',
    fields: [{ key: 'targetId', label: 'Pickup Object', type: 'target' }],
    exec: (params, item) => collectPickup(resolveTarget(params, item)),
  },
  giveItem: {
    label: 'Give Item',
    fields: [
      { key: 'name', label: 'Item name', type: 'text', placeholder: 'Key' },
      { key: 'count', label: 'Count', type: 'number', placeholder: '1' },
    ],
    exec: (p) => {
      window.__gameInventory = window.__gameInventory || {};
      window.__gameInventory[p.name] = (window.__gameInventory[p.name] || 0) + (parseInt(p.count, 10) || 1);
    },
  },
  grantItem: {
    label: 'Grant Item (capacity rules)',
    fields: [
      { key: 'itemId', label: 'Item', type: 'itemDefRef' },
      { key: 'count', label: 'Quantity (whole grant or refusal)', type: 'number', placeholder: '1', default: 1 },
    ],
    exec: (p, item) => grantInventoryItem(p.itemId, p.count === undefined ? 1 : typeof p.count === 'number' || typeof p.count === 'string' && p.count.trim() !== '' ? Number(p.count) : NaN, item),
  },
  purchaseItem: {
    label: 'Purchase Item',
    help: 'Spend a named currency Item only when the whole reward fits its Item capacity. Insufficient funds, full capacity or unavailable references change neither balance. Positive whole price/quantity, maximum 1000; currency and reward must differ. Repeated Events repeat purchases. No vendor stock or separate wallet.',
    fields: [
      { key: 'currencyItemId', label: 'Currency Item', type: 'itemDefRef' },
      { key: 'price', label: 'Price (currency quantity)', type: 'number', default: 1, placeholder: '1' },
      { key: 'itemId', label: 'Receive Item', type: 'itemDefRef' },
      { key: 'count', label: 'Receive quantity', type: 'number', default: 1, placeholder: '1' },
    ],
    exec: (params, item) => purchaseInventoryItem(params, item),
  },
  // Wave 8 (Priority K, Sections 69-71): Audio Zone -- the highest-value
  // piece of "Environment/Gameplay Zones" (Section 69's own "highest-value
  // first"), reusing an ordinary Trigger Volume's existing Enter/Exit
  // behaviors (Box/Sphere geometry ALREADY exists, per Section 70's own
  // explicit "do not build complex spatial volumes" instruction) rather
  // than a new zone-geometry primitive. Reuses the exact same
  // `app.audio.playBuffer` the level's own persistent Ambient Audio
  // already uses.
  // Wave 9 (Priority G/Sections 70-72): Audio Zone crossfade. `Fade Duration`
  // (default 0 -- old projects/behaviors with no field at all keep the exact
  // Wave 8 hard-switch) ramps the old loop out and the new one in using the
  // engine's new `setVolume(value, rampSeconds)` handle method (Section 68)
  // instead of a stop/start pop. `Priority` (Section 71) is a bounded,
  // deterministic "highest active zone wins" rule: entering a lower-priority
  // zone while a higher one is still active is a no-op (the zone is
  // recorded as entered, but audio doesn't change); leaving the currently-
  // AUDIBLE zone falls back to the level's own persistent Ambient Audio
  // (Section 72's "No silence unless that's what level ambient specifies").
  // Wave 9B: real active-zone MEMBERSHIP (Sections 37-40), not a single
  // remembered "current winner" scalar -- an Enter adds this zone to
  // `activeAudioZones`, an Exit removes it, and `recomputeAudioZoneWinner`
  // re-derives "highest-priority zone still entered, or level ambient" from
  // the WHOLE set every time. This is what correctly reveals a still-active
  // lower-priority zone when the top one is exited, instead of falling
  // straight through to level ambient (Wave 9's own documented gap).
  setAmbientAudio: {
    label: 'Set Ambient Audio (Zone)',
    fields: [
      { key: 'audioAssetId', label: 'Track', type: 'audioAsset' },
      { key: 'volume', label: 'Volume (0-1)', type: 'number', placeholder: '0.4' },
      { key: 'fadeDuration', label: 'Fade Duration (sec)', type: 'number', placeholder: '0' },
      { key: 'priority', label: 'Priority', type: 'number', placeholder: '0' },
    ],
    exec: (p, item) => {
      const fade = p.fadeDuration ? Math.max(0, parseFloat(p.fadeDuration) || 0) : 0;
      const priority = p.priority ? parseFloat(p.priority) || 0 : 0;
      const zoneId = item ? item.id : '__unowned__';
      if (p.audioAssetId) {
        activeAudioZones.set(zoneId, { priority, audioAssetId: p.audioAssetId, volume: p.volume === 0 ? 0 : p.volume ? parseFloat(p.volume) || 0.4 : 0.4, fadeDuration: fade });
      } else {
        activeAudioZones.delete(zoneId); // leaving this zone -- it no longer competes for "audible winner"
      }
      recomputeAudioZoneWinner(fade);
    },
  },
  // Wave 9C (Priority C, Sections 31-40): Fog Zone -- an ordinary Trigger
  // Volume's Enter/Exit behaviors again (same Box/Sphere geometry, same
  // "no new zone-geometry primitive" reasoning Audio Zone already
  // established), routed through the SAME active-zone-membership shape.
  // Enter with a Fog Color/Density = joining the membership set; Exit
  // (leave Fog Color blank) = leaving it. Never touches sun direction,
  // shadow config, or panorama -- scope is fog only.
  setFogZone: {
    label: 'Set Fog Zone',
    fields: [
      { key: 'fogColor', label: 'Fog Color', type: 'color' },
      { key: 'fogDensity', label: 'Fog Density', type: 'number', placeholder: '0.05' },
      { key: 'blendDuration', label: 'Blend Duration (sec)', type: 'number', placeholder: '0' },
      { key: 'priority', label: 'Priority', type: 'number', placeholder: '0' },
    ],
    exec: (p, item) => {
      const duration = p.blendDuration ? Math.max(0, parseFloat(p.blendDuration) || 0) : 0;
      const priority = p.priority ? parseFloat(p.priority) || 0 : 0;
      const zoneId = item ? item.id : '__unowned__';
      if (p.fogColor) {
        activeFogZones.set(zoneId, { priority, fogColor: hexToRgb(p.fogColor), fogDensity: p.fogDensity != null && p.fogDensity !== '' ? Math.max(0, parseFloat(p.fogDensity) || 0) : 0.05, blendDuration: duration });
      } else {
        activeFogZones.delete(zoneId);
      }
      recomputeFogZoneWinner(duration);
    },
  },
  removeItem: {
    label: 'Remove Item',
    fields: [
      { key: 'name', label: 'Item name', type: 'text', placeholder: 'Key' },
      { key: 'count', label: 'Count', type: 'number', placeholder: '1' },
    ],
    exec: (p) => {
      window.__gameInventory = window.__gameInventory || {};
      window.__gameInventory[p.name] = Math.max(0, (window.__gameInventory[p.name] || 0) - (parseInt(p.count, 10) || 1));
    },
  },
  removeNamedItem: {
    label: 'Remove Named Item', help: 'Consume an exact positive whole quantity from a Project Item. Missing or insufficient inventory is unchanged. Legacy Remove Item still accepts free names.',
    fields: [{key:'itemId',label:'Item',type:'itemDefRef'},{key:'count',label:'Quantity',type:'number',default:1,placeholder:'1'}],
    exec: (p) => {
      const quantity=p.count===undefined?1:typeof p.count==='number'||typeof p.count==='string'&&p.count.trim()!==''?Number(p.count):NaN;
      const selection=namedInventoryItemSelection(p.itemId,quantity);
      if(selection)window.__gameInventory[selection.itemId]=selection.current-selection.quantity;
    },
  },
  // Wave 8 (Priority D/Section 33, utility gate -- built, not deferred):
  // consumables. `def.useAction` reuses ACTION_TYPES/executeAction the same
  // way an Animation Event or AI entry-action already does (no second
  // action language), so a Health Kit's own "use" effect is just an
  // ordinary action (e.g. Increment Object Variable / Set Counter) an
  // author already knows how to wire. Silently a no-op with nothing to
  // use, no error -- consistent with every other "nothing to act on" case
  // in this action set.
  useItem: {
    label: 'Use Item',
    fields: [{ key: 'itemId', label: 'Item', type: 'itemDefRef' }],
    exec: (p, item) => {
      const def = findItemDefById(p.itemId);
      if (!def || !def.useAction || !def.useAction.action) return;
      // Retained unavailable Actions are recoverable authoring data, not a
      // successful use. Do not consume an Item for the dispatcher's no-op.
      if (typeof def.useAction.action !== 'string' || !Object.prototype.hasOwnProperty.call(ACTION_TYPES, def.useAction.action)) return;
      if (itemUseActionHasCycle(def.id)) return;
      window.__gameInventory = window.__gameInventory || {};
      if ((window.__gameInventory[def.id] || 0) < 1) return;
      executeAction(def.useAction.action, def.useAction.params, item);
      window.__gameInventory[def.id] -= 1;
    },
  },
  // Wave 7 (Priority C): Equip/Unequip -- the two shared actions the
  // bounded Equipment layer needs, reusing Inventory as the source of truth
  // for "does the player actually have this" (no separate item-count
  // database). `slot` matches whichever slot name the equipment def itself
  // specifies (typically 'primaryHand', but authored, not hardcoded here).
  equipItem: {
    label: 'Equip Item',
    fields: [
      { key: 'name', label: 'Item name', type: 'text', placeholder: 'Rifle' },
      { key: 'slot', label: 'Slot', type: 'text', placeholder: 'primaryHand' },
    ],
    exec: (p) => equipItemToSlot(p.name, p.slot || 'primaryHand'),
  },
  unequipItem: {
    label: 'Unequip Slot',
    fields: [{ key: 'slot', label: 'Slot', type: 'text', placeholder: 'primaryHand' }],
    exec: (p) => unequipSlot(p.slot || 'primaryHand'),
  },
  // Wave 7 (Priority F/Sections 42-46): a small structured Objective system
  // -- state lives in window.__gameObjectives[id], the same "plain named
  // state" shape as Inventory/flags/counters. `completeObjective` honors an
  // authored `nextObjective` chain ONLY when it's simple (auto-activate the
  // next id, no branching) -- matching the spec's own explicit bound;
  // anything more complex stays an explicit author-authored Activate call.
  // Wave 8 (Priority B, Sections 9-13): Object Variables -- a bounded,
  // per-instance alternative to global counters/flags, purpose-built for
  // reusable prefab logic (five placed Terminals no longer need five
  // globally-unique counter names). `target.variables = {name: value}`,
  // Number/Boolean/String only (Section 10's own explicit bound -- no
  // nested objects). `targetId` empty/unset defaults to Self (Section 12),
  // the same `resolveTarget` convention every other target-optional action
  // already uses -- a reusable enemy prefab never has to reference its own
  // generated Object ID.
  setObjectVariable: {
    label: 'Set Object Variable',
    fields: [
      { key: 'targetId', label: 'Target', type: 'target' },
      { key: 'name', label: 'Variable name', type: 'text', placeholder: 'activated' },
      { key: 'valueType', label: 'Type', type: 'select', options: ['number', 'boolean', 'string'] },
      { key: 'value', label: 'Value', type: 'text', placeholder: 'true / 0 / label' },
    ],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (!target || !p.name) return;
      target.variables = target.variables || {};
      let v = p.value;
      if (p.valueType === 'number') v = parseFloat(v) || 0;
      else if (p.valueType === 'boolean') v = (v === true || v === 'true');
      target.variables[p.name] = v;
    },
  },
  incrementObjectVariable: {
    label: 'Increment Object Variable',
    fields: [
      { key: 'targetId', label: 'Target', type: 'target' },
      { key: 'name', label: 'Variable name', type: 'text', placeholder: 'healthPhase' },
      { key: 'amount', label: 'Amount', type: 'number', placeholder: '1' },
    ],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (!target || !p.name) return;
      target.variables = target.variables || {};
      const amount = parseFloat(p.amount);
      target.variables[p.name] = (Number(target.variables[p.name]) || 0) + (Number.isFinite(amount) ? amount : 1);
    },
  },
  toggleObjectVariable: {
    label: 'Toggle Object Variable',
    fields: [
      { key: 'targetId', label: 'Target', type: 'target' },
      { key: 'name', label: 'Variable name', type: 'text', placeholder: 'activated' },
    ],
    exec: (p, item) => {
      const target = resolveTarget(p, item);
      if (!target || !p.name) return;
      target.variables = target.variables || {};
      target.variables[p.name] = !target.variables[p.name];
    },
  },
  activateObjective: {
    label: 'Activate Objective',
    fields: [{ key: 'objectiveId', label: 'Objective', type: 'objectiveRef' }],
    exec: (p,item) => { changeObjectiveState(p.objectiveId,'active',item); },
  },
  completeObjective: {
    label: 'Complete Objective',
    fields: [{ key: 'objectiveId', label: 'Objective', type: 'objectiveRef' }],
    exec: (p,item) => {
      if (!p.objectiveId || window.__gameObjectives?.[p.objectiveId] === 'complete') return;
      const def = changeObjectiveState(p.objectiveId,'complete',item);
      if (def && def.nextObjective) changeObjectiveState(def.nextObjective,'active',item);
    },
  },
  failObjective: {
    label: 'Fail Objective',
    fields: [{ key: 'objectiveId', label: 'Objective', type: 'objectiveRef' }],
    exec: (p,item) => { changeObjectiveState(p.objectiveId,'failed',item); },
  },
  // Wave 7 (Priority J): Pickup/Carry/Drop -- `resolveTarget` defaults to
  // self, matching every other target-optional action's own convention
  // (e.g. Destroy Object), so an On Interact behavior authored directly on
  // the carryable object itself needs no explicit target.
  pickUpObject: {
    label: 'Pick Up Object',
    fields: [{ key: 'targetId', label: 'Target', type: 'target' }],
    exec: (p, item) => pickUpObject(resolveTarget(p, item)),
  },
  dropHeldObject: {
    label: 'Drop Held Object',
    fields: [],
    exec: () => dropHeldObject(),
  },
  // Runtime Save Game/Player Progress -- distinct from the EDITOR's own
  // project save (SaveSystem under a different namespace, 'editor-project'
  // et al.) -- this is the PLAYER's progress within a shipped game: level,
  // checkpoint, counters/flags, health, and last known position. Reuses the
  // existing public Opus.SaveSystem (already used for editor project saves)
  // under its own namespace rather than a second storage mechanism.
  //
  // Wave 7 (Priority E, Sections 33-41): World-State Save Game 2.0 --
  // `worldState` persists ONLY deliberately-marked runtime state
  // (`item.persistRuntimeState`, OFF by default), never a blind snapshot of
  // the whole live scene. Format version 2 (`saveFormatVersion: 2`) so a
  // save written by a pre-Wave-7 game (no `worldState` key at all) still
  // loads correctly -- `applyWorldStateToCurrentLevel` is a no-op with
  // nothing to apply, and every other field reads exactly as before.
  saveGame: {
    label: 'Save Game',
    fields: [{ key: 'slot', label: 'Slot name', type: 'text', placeholder: 'default' }],
    exec: (p) => { const saved = writeSaveGameSlot(p.slot || 'default'); showToast(saved ? 'Game saved' : 'Game could not be saved. Check local storage availability.'); return saved; },
  },
  // Wave 8 (Priority H/Section 50): Autosave -- an author-triggered write
  // to a fixed 'auto' slot (checkpoint/level-transition/objective-complete
  // -- the AUTHOR decides when, via an ordinary Behavior/Sequence step
  // calling this action; Section 50's own explicit "no surprise background
  // saves"). Reuses the exact same `writeSaveGameSlot` a manual Save Game
  // does -- one save-payload implementation, two slots.
  autosave: {
    label: 'Autosave',
    fields: [],
    exec: () => { const saved = writeSaveGameSlot('auto'); if (!saved) showToast('Autosave failed. Check local storage availability.'); return saved; },
  },
  loadGame: {
    label: 'Load Game',
    fields: [{ key: 'slot', label: 'Slot name', type: 'text', placeholder: 'default' }],
    exec: (p) => {
      const saveSystem = projectRuntimeSaveSystem();
      const data = saveSystem.load(p.slot || 'default');
      if (!data) { showToast('No save found'); return; }
      window.__gameState = data.gameState || {};
      window.__gameFlags = data.flags || {};
      window.__gameInventory = data.inventory || {};
      lootDrawCounters = OpusLootTables.restoreCounters(data.lootDrawCounters, Array.isArray(lootTables)?lootTables:[]);
      window.__gameObjectives = data.objectives || {};
      window.__worldState = data.worldState || {}; // whole multi-level accumulator, not just the target level's slice
      window.__checkpoint = data.checkpoint ? new Opus.Vec3(...data.checkpoint) : null;
      window.__gamePlaytimeSeconds = data.playtimeSeconds || 0; // Wave 8 (Priority H): continues accumulating from where this save left off, not from 0
      // Snapshot saved names, not old entity instances. A level transition
      // recreates them after the new Player exists and before Start Actions;
      // same-level loads use the same inventory-checked equip path below.
      const savedEquipment = data.equipment ? capturePlayerEquipment(data.equipment) : null;
      // Restore weapon runtime independently of visual recreation (equip
      // never touches weaponRuntimeState) -- a save with no `weaponRuntime`
      // key at all (every pre-Wave-9 save) leaves it `{}`, so every weapon
      // just starts fresh exactly as it already did before this priority
      // existed.
      weaponRuntimeState = {};
      if (data.weaponRuntime) {
        for (const key in data.weaponRuntime) weaponRuntimeState[key] = { magazine: data.weaponRuntime[key].magazine, reserve: data.weaponRuntime[key].reserve, reloading: false, reloadEnd: 0 };
      }
      activeWeaponSlot = data.activeWeaponSlot || 'primaryHand';
      syncActiveWeaponVisualVisibility();
      // Restore order (Section 37): (1) switch level [already happened by
      // the time we get here, or is about to], (2) the authored scene
      // rebuilds itself as a normal side effect of that switch, (3) THEN
      // apply worldState overrides -- never before the objects it targets
      // actually exist -- (4)/(5) spawn Player + restore its own position,
      // (6) resume. `switchToLevelDuringPlay` already handles (1)+(2)+spawn;
      // this action's own job is ordering (3) after it and before/alongside
      // the player-position restore.
      const applyPlayerPosition = () => { if (player && data.playerPosition) player.entity.position.set(...data.playerPosition); };
      if (Number.isInteger(data.levelIndex) && data.levelIndex !== currentLevelIndex && levels[data.levelIndex]) {
        switchToLevelDuringPlay(data.levelIndex, savedEquipment || undefined);
        applyWorldStateToCurrentLevel();
        applyPlayerPosition();
      } else {
        if(savedEquipment)restorePlayerEquipment(savedEquipment);
        applyWorldStateToCurrentLevel();
        applyPlayerPosition();
      }
      // Level creation may set a spawn-based threshold. Restore the saved
      // checkpoint's recovery floor only after level/world/player restoration.
      voidFallY = (window.__checkpoint || computeSpawnPoint()).y - VOID_FALL_MARGIN;
      showToast('Game loaded');
    },
  },
  clearSaveGame: {
    label: 'Clear Save',
    fields: [{ key: 'slot', label: 'Slot name', type: 'text', placeholder: 'default' }],
    exec: (p) => projectRuntimeSaveSystem().delete(p.slot || 'default'),
  },
  sendSignal: {
    label: 'Send Signal',
    fields: [{key:'signalId',label:'Signal',type:'signalRef'},{key:'payload',label:'Signal value',type:'signalPayload',valueType:node=>{const type=OpusSignals.payloadType(OpusSignals.find(signalDefinitions,node?.signalId));return type==='none'?null:type;}}],
    exec: (p,item) => { const type=OpusSignals.payloadType(OpusSignals.find(signalDefinitions,p.signalId)),value=type==='object'&&p.payload===''?item?.id:p.payload;const missingObject=type==='object'&&!findItemById(value);if(missingObject&&typeof observeSignalEvent==='function')observeSignalEvent({kind:'rejected',signalId:p.signalId,type,value,sourceId:item?.id,reason:'Referenced Object is unavailable in the active scene'});if(missingObject||!signalRuntime.emit(p.signalId,value,item)) showToast('Signal not sent: choose an available Signal with a matching value and channel context while Play is active.'); },
  },
  // Named boolean Flags -- window.__gameFlags[name], a simpler primitive
  // than a counter for pure on/off state (a door unlocked, a switch
  // thrown) where "0 or 1" would be a slightly odd way to say it.
  setFlagTrue: {
    label: 'Set Flag True',
    fields: [{ key: 'name', label: 'Flag name', type: 'text', placeholder: 'Flag name' }],
    exec: (p) => { window.__gameFlags = window.__gameFlags || {}; window.__gameFlags[p.name] = true; },
  },
  setFlagFalse: {
    label: 'Set Flag False',
    fields: [{ key: 'name', label: 'Flag name', type: 'text', placeholder: 'Flag name' }],
    exec: (p) => { window.__gameFlags = window.__gameFlags || {}; window.__gameFlags[p.name] = false; },
  },
  toggleFlag: {
    label: 'Toggle Flag',
    fields: [{ key: 'name', label: 'Flag name', type: 'text', placeholder: 'Flag name' }],
    exec: (p) => { window.__gameFlags = window.__gameFlags || {}; window.__gameFlags[p.name] = !window.__gameFlags[p.name]; },
  },
  // Object Tags -- category-style membership (any number of objects can
  // share a tag), distinct from the stable per-object `id` Object
  // References already use for "this one specific object". Tag-wide
  // operations read `item.tags` (see the inspector's Tags field) against
  // `placed` directly, no separate registry to keep in sync.
  hideTagged: {
    label: 'Hide Tagged',
    fields: [{ key: 'tag', label: 'Tag', type: 'text', placeholder: 'Tag' }],
    exec: (p) => { for (const it of placed) if (it.kind === 'cube' && (it.tags || []).includes(p.tag)) it.entity.visible = false; },
  },
  destroyTagged: {
    label: 'Destroy Tagged',
    fields: [{ key: 'tag', label: 'Tag', type: 'text', placeholder: 'Tag' }],
    exec: (p) => { for (const it of placed.slice()) if (it.kind === 'cube' && (it.tags || []).includes(p.tag)) removeItemFromScene(it); },
  },
  countTagged: {
    label: 'Count Tagged Into Counter',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text', placeholder: 'Tag' },
      { key: 'counter', label: 'Counter name', type: 'text', placeholder: 'Counter name' },
    ],
    exec: (p) => {
      window.__gameState = window.__gameState || {};
      window.__gameState[p.counter] = placed.filter((it) => it.kind === 'cube' && it.entity.visible && (it.tags || []).includes(p.tag)).length;
    },
  },
  // Named Timers -- window.__gameTimers[name] = {elapsed, duration,
  // countDown, running, finished}, ticked once per frame by tickTimers()
  // inside the main play-mode update loop (see app.onUpdate below), so
  // advancing is simulation-time and automatically pause-safe the same way
  // Player physics and AI already are (that whole callback is skipped while
  // app.paused). Count-up finishes at `duration` (0 = runs forever, only
  // useful with Timer At Least); count-down finishes at 0.
  startTimer: {
    label: 'Start Timer',
    fields: [
      { key: 'name', label: 'Timer name', type: 'text', placeholder: 'Timer name' },
      { key: 'duration', label: 'Duration (sec, 0 = no limit)', type: 'number', placeholder: '10' },
      { key: 'countDown', label: 'Count down (from Duration to 0)', type: 'checkbox' },
    ],
    exec: (p) => {
      window.__gameTimers = window.__gameTimers || {};
      const duration = Math.max(0, parseFloat(p.duration) || 0);
      window.__gameTimers[p.name] = { elapsed: p.countDown ? duration : 0, duration, countDown: !!p.countDown, running: true, finished: false };
    },
  },
  stopTimer: {
    label: 'Stop Timer',
    fields: [{ key: 'name', label: 'Timer name', type: 'text', placeholder: 'Timer name' }],
    exec: (p) => { const t = window.__gameTimers && window.__gameTimers[p.name]; if (t) t.running = false; },
  },
  resetTimer: {
    label: 'Reset Timer',
    fields: [{ key: 'name', label: 'Timer name', type: 'text', placeholder: 'Timer name' }],
    exec: (p) => {
      const t = window.__gameTimers && window.__gameTimers[p.name];
      if (t) { t.elapsed = t.countDown ? t.duration : 0; t.finished = false; }
    },
  },
  setTimer: {
    label: 'Set Timer',
    fields: [
      { key: 'name', label: 'Timer name', type: 'text', placeholder: 'Timer name' },
      { key: 'value', label: 'Value (sec)', type: 'number', placeholder: '0' },
    ],
    exec: (p) => {
      window.__gameTimers = window.__gameTimers || {};
      const t = window.__gameTimers[p.name] || (window.__gameTimers[p.name] = { elapsed: 0, duration: 0, countDown: false, running: false, finished: false });
      t.elapsed = Math.max(0, parseFloat(p.value) || 0);
      t.finished = false;
    },
  },
  script: {
    label: 'Advanced: Custom Script', legacy: true, legacyParam: 'code',
    fields: [{ key: 'code', label: 'Script', type: 'text', placeholder: 'JS using entity/app/Opus/game' }],
    exec: (p, item) => {
      // Custom Script runs arbitrary JS with full page access (window,
      // document, fetch, ...), not just the named params -- fine for a
      // project you're authoring yourself, not fine for one you just loaded
      // from someone else's file, where an 'On Enter' script would otherwise
      // fire the moment the player walks near it, with zero warning. See
      // API-FRICTION.md and AUDIT.md finding #1.
      if (!scriptsTrusted) {
        showToast('⚠ Custom Script is disabled for this loaded project — enable it in Project first');
        return;
      }
      try {
        const game = { win: () => endGame('win'), lose: () => endGame('lose'), setObjective };
        // Trigger Collider 2D reuses this existing trusted Action path. The
        // fifth argument is additive/backward-compatible and is null for
        // every non-trigger invocation.
        new Function('entity', 'app', 'Opus', 'game', 'event', p.code || '')(item.entity, app, Opus, game, window.__currentTrigger2DEvent || null);
      } catch (err) {
        showToast(`Script error: ${err.message}`);
      }
    },
  },
};

