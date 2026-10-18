// --- Runtime multi-object Prefab Assemblies (Wave 5) -----------------
// Wave 4's own documented gap: Spawner/Spawn Prefab only ever instantiated
// a multi-object prefab's ROOT record, dropping every other piece. Closed
// by reusing instantiatePrefabAssembly -- the exact function design-time
// prefab placement already uses, itself built on remapObjectIds, the ONE
// shared id-remapping mechanism (fresh ids + every internal reference
// rewritten: parentId, AI targetId, Camera lookAtTargetId, Waypoint
// connections, animation Play-Animation targetId, any ACTION_TYPES field of
// type 'target'/'cameraPreset') -- no second remap implementation for the
// runtime path. A single-object prefab (the common case: one Bolt, one
// simple Hunter) still takes the exact one-record path it always did.
let nextAssemblyId = 1;
function generateAssemblyId() { return `assembly${nextAssemblyId++}`; }
// Wave 8 (Priority M, Sections 74-76): `paramOverrides` is optional --
// `{paramId: value | {min, max}}`. A plain value is a fixed override,
// exactly like an ordinary placed instance's own `prefabParams`. A
// `{min, max}` range is resolved through a deterministic seeded RNG
// (`mulberry32`, the same PRNG Wave 7's Scatter already established) so
// two spawns given the SAME `rngSeed` produce the SAME random value --
// "deterministically seeded randomness preferred," per the spec's own
// explicit requirement -- never `Math.random()`. Numeric ranges only
// (Section 75's own explicit bound).
function resolveSpawnParamOverrides(paramOverrides, rngSeed) {
  if (!paramOverrides) return undefined;
  const rng = mulberry32((rngSeed >>> 0) || 1);
  const resolved = {};
  for (const key in paramOverrides) {
    const v = paramOverrides[key];
    resolved[key] = (v && typeof v === 'object' && v.min != null && v.max != null) ? (v.min + rng() * (v.max - v.min)) : v;
  }
  return resolved;
}
function spawnPrefabAssembly(prefab, position, paramOverrides, rngSeed) {
  let newItems;
  if (prefab.records && prefab.records.length > 0) {
    newItems = instantiatePrefabAssembly(prefab, position);
  } else {
    const single = instantiateCubeRecord(prefab.record, position);
    single.id = generateItemId();
    newItems = [single];
    newItems._newRootId = single.id;
  }
  // Assembly bookkeeping (Wave 5, section 12) only exists for a GENUINE
  // multi-object spawn -- a single-object spawn never gets an assemblyId,
  // so every pre-Wave-5 single-prefab Spawn Prefab/Spawner behaves exactly
  // as before (nothing new to cascade-destroy, nothing new to track).
  const assemblyId = newItems.length > 1 ? generateAssemblyId() : null;
  const rootId = newItems._newRootId;
  for (const it of newItems) {
    it.runtimeSpawned = true;
    if (assemblyId) { it.assemblyId = assemblyId; it.assemblyRootId = rootId; }
    addPlaced(it);
    wireItemTrigger(it);
  }
  hierarchyTickToken++;
  updateHierarchyTransforms();
  const rootItem = newItems.find((it) => it.id === rootId) || newItems[0];
  if (paramOverrides) rootItem.prefabParams = { ...(rootItem.prefabParams || {}), ...resolveSpawnParamOverrides(paramOverrides, rngSeed) };
  applyPrefabParameters(prefab, rootItem);
  return { rootItem, members: newItems, assemblyId };
}
// Destroys every member of `item`'s assembly (or, for an item with no
// assembly, just `item` itself -- the exact old single-object behavior,
// unchanged). This is intentionally a SEPARATE function from
// removeItemFromScene rather than making that function itself cascade --
// removeItemFromScene is called from many existing places (Destroy Object
// action, general cleanup) whose current single-object semantics must not
// silently change; assembly-aware destruction is opt-in, used explicitly by
// the new Destroy Assembly action and by the combat-death path below (an
// assembly member's Object Health reaching 0 is the dogfood's own "no
// orphan children after a spawned enemy is destroyed" requirement).
// Wave 6 (Priority M): deeper character gameplay -- animated locomotion/
// attack/death, the exact character-clip-NAME-mapping follow-up Priority C's
// own CHANGELOG entry named as a deliberate, real, deferred piece rather
// than a silently-shipped gap. Bounded to AI-driven (entity.ai) skinned
// characters -- the Player is a separate authoring surface (Player Settings,
// not a placed Inspector object) with no skinned-mesh option today, so
// player-character locomotion animation is explicitly out of this pass's
// scope (see the CHANGELOG entry for this priority). Every piece here is a
// clip-NAME convention (case-insensitive substring match against the
// skin's own imported clip names) layered on top of the EXISTING
// entity.animationClip/skin machinery (Priority C) -- no new engine surface.
function changeSkeletalInstanceClip(item, clipIndex) {
  if (playMode || !item || selectedItem !== item || !placed.includes(item) || item.kind !== 'cube' || !Array.isArray(item.entity?.skin?.clips)) return false;
  if (clipIndex !== null && (!Number.isInteger(clipIndex) || clipIndex < 0 || !item.entity.skin.clips[clipIndex])) return false;
  if (item.entity.animationClip === clipIndex) return false;
  pushUndo();
  item.entity.animationClip = clipIndex;
  return true;
}
function changeSkeletalInstanceBlend(item, seconds) {
  if (playMode || !item || selectedItem !== item || !placed.includes(item) || item.kind !== 'cube' || !Array.isArray(item.entity?.skin?.clips)) return false;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > 10) return false;
  if (item.entity.animationBlendTime === seconds) return false;
  pushUndo();
  item.entity.animationBlendTime = seconds;
  return true;
}
function findCharacterClip(entity, keywords) {
  if (!Array.isArray(entity?.skin?.clips)||!Array.isArray(keywords)) return null;
  for (let i = 0; i < entity.skin.clips.length; i++) {
    const lower = typeof entity.skin.clips[i]?.name==='string'?entity.skin.clips[i].name.toLowerCase():'';
    if (keywords.some((k) => typeof k==='string'&&lower.includes(k))) return i;
  }
  return null;
}
// Wave 7 (Priority B): bounded per-clip Animation Events -- {id, clipIndex,
// time, action, params} records living on a skinned ASSET's own
// `animationEvents` array (the exact same asset-level-authoring-metadata
// pattern Priority A's sockets already established: shared by every placed
// instance, never mutating the imported clip data). Effects reuse
// ACTION_TYPES/executeAction, the SAME action language every ordinary
// Behavior already uses -- no arbitrary JS callback, no second action
// system. A missing/undefined assetId, asset, or empty animationEvents is
// always a silent no-op, so every project that never authors an event is
// completely unaffected.
//
// Crossing detection is entirely generic, driven off two snapshots of
// entity.animationTime (before/after THIS frame's engine-level
// Entity.update() already advanced it, per 11-entity.js), stored directly
// on the entity itself (`_aeClip`/`_aeTime`, so a fresh entity or one with
// no events costs nothing beyond one property compare):
//  - Ordinary playback: fires every event with prevTime < event.time <=
//    currentTime (half-open on the low end, so re-ticking at the exact same
//    time twice in a row -- paused/dt=0 -- never double-fires).
//  - Looping: Entity.update's own `animationTime %= clip.duration` makes
//    currentTime < prevTime exactly once per wrap. Modeled as the SAME
//    half-open interval unrolled across the wrap: (prevTime, duration] then
//    [0, currentTime] -- the second segment's 0 is INCLUDED (the wrap point
//    itself), so an event authored at time===0 fires exactly once per full
//    loop, never twice at the boundary (the spec's own explicit
//    "no duplicate at wrap boundary" requirement) and never from the
//    non-wrap branch (which can only ever match event.time > prevTime >= 0).
//  - A genuine clip SWITCH (this frame's animationClip differs from what was
//    tracked last tick, including the very first tick a character is ever
//    seen) is treated as a fresh start: no retroactive firing across the
//    switch, tracking simply resyncs to the new clip/time and returns.
//  - Crossfade needs no special-casing at all: Entity.update advances
//    `animationClip`/`animationTime` to the NEW clip's own timeline
//    immediately on a blended switch (the old clip only fades out
//    visually via the separate `_blendFromClip` pair) -- so this function,
//    which only ever reads the entity's own current clip/time, already
//    fires purely off the new clip's real timeline during a blend, exactly
//    matching ordinary (non-blended) playback.
//  - High-dt crossing (an event's time falls strictly between prevTime and
//    currentTime after a single large frame step) is covered by the same
//    half-open interval check with no per-substep loop -- bounded
//    correctly for anything up to one full clip duration per frame; a
//    single frame so large it laps a clip more than once could still only
//    fire an event once, an accepted bounded edge case matching this
//    project's own "bounded, not a general-purpose animation state
//    machine" discipline.
function tickAnimationEvents(entity, assetId, contextItem) {
  if (!entity || !entity.skin) return;
  const asset = assetId ? findAssetById(assetId) : null;
  const events = asset && asset.animationEvents;
  const clip = entity.animationClip;
  const time = entity.animationTime;
  if (entity._aeClip !== clip) {
    entity._aeClip = clip;
    entity._aeTime = time;
    return;
  }
  if (Array.isArray(events) && events.length > 0) {
    const prev = entity._aeTime;
    const clipEvents = events.filter((e) => e && typeof e === 'object' && !Array.isArray(e) && e.clipIndex === clip && typeof e.time === 'number' && Number.isFinite(e.time) && e.time >= 0 && Object.prototype.hasOwnProperty.call(ACTION_TYPES, e.action) && (e.params === undefined || e.params && typeof e.params === 'object' && !Array.isArray(e.params)));
    if (clipEvents.length > 0) {
      if (time >= prev) {
        for (const ev of clipEvents) if (ev.time > prev && ev.time <= time) executeAction(ev.action, ev.params, contextItem);
      } else {
        const clipDef = entity.skin.clips[clip];
        const duration = clipDef ? clipDef.duration : prev;
        for (const ev of clipEvents) {
          if ((ev.time > prev && ev.time <= duration) || (ev.time >= 0 && ev.time <= time)) executeAction(ev.action, ev.params, contextItem);
        }
      }
    }
  }
  entity._aeTime = time;
}
// Switches to the clip matching `state` ('idle'/'walk'/'run') ONLY if it's
// actually different from the character's current auto-driven state --
// re-assigning the SAME clip index every frame would otherwise restart its
// animationTime to 0 every tick (Entity.update's own "a clip switch
// restarts at t=0" contract, Priority C), which would freeze a looping
// Walk cycle on frame 1 forever instead of actually playing it.
const CHARACTER_ANIM_KEYWORDS = {
  idle: ['idle'], walk: ['walk'], run: ['run', 'sprint'],
  jump: ['jump'], fall: ['fall'], // Wave 6B (Priority A/Section 5): Player-only roles -- AI locomotion has no vertical-physics concept to map these to.
  attack: ['attack', 'punch', 'shoot', 'swing'], death: ['death', 'die'],
  hit: ['hit', 'hurt', 'flinch'], // Wave 7 (Priority K)
  reload: ['reload'], // Wave 9 (Priority A/Section 12) -- Player-only, optional; duration-based reload is correct with no clip mapped at all
};
const AI_CHARACTER_ANIMATION_ROLES=['idle','walk','run','attack','death','hit'];
function aiAnimationRolesEditable(item) {
  const map=item?.characterAnimRoles;
  return map===undefined||!!(map&&typeof map==='object'&&!Array.isArray(map)&&map.kind==='AIAnimationRoles'&&map.version===1&&map.clips&&typeof map.clips==='object'&&!Array.isArray(map.clips)&&AI_CHARACTER_ANIMATION_ROLES.every(role=>!Object.prototype.hasOwnProperty.call(map.clips,role)||map.clips[role]===null||typeof map.clips[role]==='string'&&map.clips[role].length>0));
}
function resolveAiCharacterClip(item,role) {
  if(!AI_CHARACTER_ANIMATION_ROLES.includes(role)||!Array.isArray(item?.entity?.skin?.clips)||!aiAnimationRolesEditable(item))return null;
  const map=item.characterAnimRoles?.clips;
  if(map&&Object.prototype.hasOwnProperty.call(map,role)){
    const name=map[role];if(typeof name!=='string')return null;
    const matches=item.entity.skin.clips.map((c,i)=>c?.name===name?i:-1).filter(i=>i>=0);
    return matches.length===1?matches[0]:null;
  }
  return findCharacterClip(item.entity,CHARACTER_ANIM_KEYWORDS[role]);
}
function changeAiAnimationSync(item,checked) {
  if(playMode||item?.kind!=='cube'||!item.entity?.skin||typeof checked!=='boolean'||!!item.characterAnimSync===checked)return false;
  pushUndo();item.characterAnimSync=checked;delete item._animState;return true;
}
function changeAiAnimationRole(item,role,value) {
  if(playMode||item?.kind!=='cube'||!Array.isArray(item.entity?.skin?.clips)||!AI_CHARACTER_ANIMATION_ROLES.includes(role)||!aiAnimationRolesEditable(item))return false;
  if(value!=='__auto__'&&value!=='__none__'&&item.entity.skin.clips.filter(c=>c?.name===value).length!==1)return false;
  const current=item.characterAnimRoles,clips=current?.clips;
  const has=clips&&Object.prototype.hasOwnProperty.call(clips,role);
  if(value==='__auto__'&&!has||value==='__none__'&&has&&clips[role]===null||has&&clips[role]===value)return false;
  const candidate=current?JSON.parse(JSON.stringify(current)):{kind:'AIAnimationRoles',version:1,clips:{}};
  if(value==='__auto__')delete candidate.clips[role];else candidate.clips[role]=value==='__none__'?null:value;
  pushUndo();item.characterAnimRoles=candidate;delete item._animState;return true;
}
function aiAnimationRoleOptions(item,role) {
  const map=item.characterAnimRoles?.clips,has=map&&Object.prototype.hasOwnProperty.call(map,role),value=has?map[role]:undefined;
  const clips=Array.isArray(item.entity?.skin?.clips)?item.entity.skin.clips:[];
  const names=clips.map(c=>c?.name).filter(n=>typeof n==='string'&&n&&clips.filter(c=>c?.name===n).length===1);
  const index=resolveAiCharacterClip(item,role),auto=index===null?'no matching clip':clips[index]?.name;
  return `<option value="__auto__"${!has?' selected':''}>Automatic by name${!has?` — ${escapeHtml(auto)}`:''}</option><option value="__none__"${has&&value===null?' selected':''}>None (no role clip)</option>`+
    (has&&value!==null&&!names.includes(value)?`<option value="${escapeHtml(String(value))}" selected disabled>Retained unavailable clip: ${escapeHtml(String(value))}</option>`:'')+
    names.map(name=>`<option value="${escapeHtml(name)}"${value===name?' selected':''}>${escapeHtml(name)}</option>`).join('');
}
function aiStateAnimationRoleOptions(value) {
  return `<option value=""${!value?' selected':''}>Leave current clip</option>`+
    (value&&!AI_CHARACTER_ANIMATION_ROLES.includes(value)?`<option value="${escapeHtml(String(value))}" selected disabled>Retained unavailable role: ${escapeHtml(String(value))}</option>`:'')+
    AI_CHARACTER_ANIMATION_ROLES.map(role=>`<option value="${role}"${value===role?' selected':''}>${role[0].toUpperCase()+role.slice(1)}</option>`).join('');
}
function aiAnimationRolePanel(item) {
  const editable=aiAnimationRolesEditable(item),blocked=playMode||!editable;
  return `<div class="ai-animation-role-panel"><h4>AI animation roles</h4><p class="field-help">Per character, not shared with the imported Asset or Player. Automatic preserves historical name matching. None disables that role; Idle/Walk/Run use bind pose. Missing or ambiguous named clips stay retained and do not fall back.</p>${!editable?'<p class="ai-combat-status">Retained unsupported role-map data; controls are read-only.</p>':''}`+
    AI_CHARACTER_ANIMATION_ROLES.map(role=>`<label>${role[0].toUpperCase()+role.slice(1)}<select data-ai-animation-role="${role}"${blocked?' disabled':''}>${aiAnimationRoleOptions(item,role)}</select></label>`).join('')+'</div>';
}
function createAnimatedEnemyFromInspector(item) {
  if(playMode||item?.kind!=='cube'||!item.entity?.skin)return false;
  const attached=Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain');
  const raw=attached?OpusAiBrain.inspect(item.components['ai-brain']):null;
  if(attached&&(!raw.ok||!raw.record.enabled)){showStatus('Repair or enable the retained AI Brain first.');return false;}
  const before=item.entity.ai?OpusAiBrain.captureLegacy(item.entity.ai,{enabled:raw?.record.enabled??true}):null;
  if(before&&!before.ok)return false;
  const candidate=before?JSON.parse(JSON.stringify(before.record)):OpusAiBrain.create(item.entity.position);
  const ai=candidate.config;
  if(ai.mode==='stateMachine'){showStatus('Use the active State ranged-attack controls; this shortcut configures Simple AI.');return false;}
  if(!before){ai.type='follow';ai.speed=3;ai.radius=10;ai.targetId=null;}
  ai.attackEnabled=true;ai.attackRadius=ai.attackRadius||8;ai.attackCooldown=ai.attackCooldown||1.5;ai.attackDamage=ai.attackDamage??10;
  const checked=OpusAiBrain.inspect(candidate);if(!checked.ok){showStatus(checked.reason);return false;}
  if(before&&JSON.stringify(before.record)===JSON.stringify(checked.record)&&item.characterAnimSync&&item.health)return false;
  pushUndo();const cfg=JSON.parse(JSON.stringify(checked.record.config));
  item.entity.ai={...cfg,base:new Opus.Vec3(...cfg.base)};item.components=item.components||{};item.components['ai-brain']=checked.record;
  ensureObjectHealthInit(item);item.characterAnimSync=true;delete item._animState;
  renderInspector();showStatus('Animated Enemy configured — choose a Projectile Prefab and animation roles.');return true;
}
function setCharacterLocomotionState(item, state) {
  if(item._animOverrideUntil>simElapsed)return;
  const clipIndex = resolveAiCharacterClip(item,state);
  const disabled=aiAnimationRolesEditable(item)&&AI_CHARACTER_ANIMATION_ROLES.includes(state)&&item.characterAnimRoles?.clips?.[state]===null;
  if (clipIndex === null&&!disabled) return; // missing/automatic unmatched remains inert
  if(item._animState===state&&item.entity.animationClip===clipIndex)return;
  item.entity.animationClip = clipIndex;
  item._animState = state;
}
// Attack is a brief OVERRIDE on top of locomotion, not a persistent state --
// `_animOverrideUntil` (a simElapsed timestamp) tells the locomotion driver
// below to leave the character alone until the attack clip's own duration
// has played out, then locomotion resumes picking Idle/Walk/Run normally.
function triggerCharacterAttackAnim(item) {
  if (!item.characterAnimSync || !item.entity.skin) return;
  const clipIndex = resolveAiCharacterClip(item,'attack');
  if (clipIndex === null) return;
  item.entity.animationClip = clipIndex;
  item._animState = 'attack';
  const duration = item.entity.skin.clips[clipIndex].duration || 0.5;
  item._animOverrideUntil = simElapsed + duration;
}
// Returns true if a Death clip was found and started -- the caller
// (applyHitDamage) uses this to decide whether to delay the actual
// destruction so the clip is visible at all, or destroy immediately as
// before (a character with no Death clip authored behaves EXACTLY like
// every character did before this priority existed -- instant removal).
function triggerCharacterDeathAnim(item) {
  if (!item.characterAnimSync || !item.entity.skin) return false;
  const clipIndex = resolveAiCharacterClip(item,'death');
  if (clipIndex === null) return false;
  item.entity.animationClip = clipIndex;
  item._animState = 'death';
  item._animOverrideUntil = Infinity; // death is terminal -- locomotion never resumes for a dying character
  return true;
}
function removeAssembly(item, includePlacedPrefab = false) {
  if (!item) return;
  // Pickup explicitly removes its whole authored Prefab instance as well as
  // runtime-spawned assemblies. Historical destroy/damage/despawn callers keep
  // their single-object behavior for authored instances; ordinary groups are
  // not assembly identities and must never be swept into this removal.
  const placedInstance = includePlacedPrefab === true && typeof item.signalPrefabInstanceId === 'string' && item.signalPrefabInstanceId.length > 0 ? item.signalPrefabInstanceId : null;
  if (!item.assemblyId && !placedInstance) { removeItemFromScene(item); return; }
  const members = placed.filter((p) => item.assemblyId ? p.assemblyId === item.assemblyId : p.signalPrefabInstanceId === placedInstance);
  for (const m of members) if (!m.entity || !m.entity.destroyed) removeItemFromScene(m);
}
// Spawner ticking -- reuses instantiateCubeRecord + wireItemTrigger, the
// exact same reconstruction Spawn Prefab/Save-Load/design-time prefab
// placement all already share, so a spawner-produced instance behaves
// identically to any other spawned/placed item (fully wired triggers/AI).
function spawnOneFromSpawner(item) {
  const opts = item.options;
  const prefab = prefabs.find((pf) => pf.name === opts.prefabName);
  if (!prefab) return;
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * (opts.radius || 0);
  // Root placement determines the assembly's transform; scatter radius
  // applies to the root only -- children keep their authored local offsets
  // (Wave 5, section 52), not independently randomized.
  const rootRecord = prefab.records ? (prefab.records.find((rr) => rr.id === prefab.rootId) || prefab.records[0]) : prefab.record;
  const rootY = (rootRecord.position || (rootRecord.options && rootRecord.options.position))[1];
  const position = new Opus.Vec3(item.entity.position.x + Math.cos(angle) * r, rootY, item.entity.position.z + Math.sin(angle) * r);
  // Wave 8 (Priority M): each spawn gets its OWN deterministic seed derived
  // from the Spawner's own base seed + how many it has already produced --
  // the SAME Spawner replayed from the SAME save produces the SAME sequence
  // of randomized parameter values, not a fresh random draw every session.
  const { rootItem, members } = spawnPrefabAssembly(prefab, position, opts.paramOverrides, (opts.paramSeed || 1) + item.spawnerState.spawnedTotal);
  // Assembly Tagging (Wave 5, section 53): the Spawner's Tag applies to
  // EVERY member, not just the root -- the one clear default, since Count/
  // Hide/Destroy Tagged must keep finding every piece of a tagged enemy,
  // not just its root, exactly as they already do for a single-object spawn.
  if (opts.tag) for (const m of members) m.tags = [...(m.tags || []), opts.tag];
  // ONE logical spawn = the root's id, whether it's a lone object or a
  // whole assembly -- Max Active/activeIds already only ever check whether
  // this one id is still present in `placed` (see tickSpawners below), and
  // removeAssembly guarantees the root disappears exactly when the whole
  // assembly does, so no separate per-assembly counting logic is needed.
  item.spawnerState.activeIds.push(rootItem.id);
  item.spawnerState.spawnedTotal += 1;
}
