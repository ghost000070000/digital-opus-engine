// --- Drag and drop placement ---
// Built on Pointer Events end to end, not HTML5 Drag-and-Drop -- the
// `draggable` attribute's native drag simply doesn't fire on touch in most
// mobile browsers (it's a desktop-only affordance in practice), so a
// palette a touch user can't drag from isn't really no-code on a tablet at
// all. One pointer-based implementation replaces it for every input type,
// mouse and touch alike, rather than running two separate systems.

// Particle presets -- one-click starting points for the Emitter inspector's
// Preset dropdown (below), tuned by eye against the existing hovercraft
// exhaust/spray/foam emitters' own values rather than invented from
// scratch. Applying one overwrites rate/life/riseSpeed/spread/size/color/
// gravity on the live emitter directly -- position and maxParticles are
// deliberately left alone, since those are placement/perf choices the
// preset shouldn't override.
const PARTICLE_PRESETS = {
  Smoke: { rate: 12, life: [1.5, 3], riseSpeed: [0.3, 0.7], spread: 0.5, size: [0.15, 0.35], color: [0.5, 0.5, 0.5], gravity: 0.05 },
  Sparks: { rate: 30, life: [0.3, 0.7], riseSpeed: [1.5, 3], spread: 0.3, size: [0.03, 0.07], color: [1, 0.8, 0.3], gravity: -1.2 },
  Fire: { rate: 25, life: [0.4, 0.9], riseSpeed: [0.8, 1.6], spread: 0.25, size: [0.1, 0.22], color: [1, 0.45, 0.1], gravity: 0.3 },
  Magic: { rate: 18, life: [1, 2], riseSpeed: [0.2, 0.6], spread: 0.7, size: [0.06, 0.14], color: [0.6, 0.3, 1], gravity: -0.05 },
  Dust: { rate: 6, life: [2, 4], riseSpeed: [0.05, 0.2], spread: 1.2, size: [0.08, 0.16], color: [0.7, 0.65, 0.5], gravity: 0.02 },
  'Water Spray': { rate: 40, life: [0.35, 0.75], riseSpeed: [0.6, 1.3], spread: 0.8, size: [0.08, 0.2], color: [0.8, 0.95, 1], gravity: -0.7 },
  Burst: { rate: 0, life: [0.4, 1], riseSpeed: [1, 2.5], spread: 0.6, size: [0.08, 0.18], color: [1, 0.9, 0.6], gravity: -0.5 },
};

// Phase161: explicit creation is additive; historical drag/drop stays unchanged.
function terrainCreationDraft(values) {
  const name=String(values.name||'').trim(),options={};
  if(!name||name.length>80)return {ok:false,reason:'Give this terrain a name (1–80 characters).'};
  const limits={seed:[-2147483648,2147483647],size:[4,512],radius:[1,256],segments:[8,128],amplitude:[.01,32],x:[-10000,10000],y:[-10000,10000],z:[-10000,10000]};
  for(const [key,[min,max]] of Object.entries(limits)){const text=String(values[key]??'').trim(),n=text?Number(text):NaN;if(!Number.isFinite(n)||n<min||n>max||(['seed','segments'].includes(key)&&!Number.isInteger(n)))return {ok:false,reason:`${key} must be ${['seed','segments'].includes(key)?'a whole number':'finite'} from ${min} to ${max}.`};options[key]=n;}
  if(options.radius>options.size*.5)return {ok:false,reason:'Island radius must fit inside half the terrain size.'};
  options.position=new Opus.Vec3(options.x,options.y,options.z);delete options.x;delete options.y;delete options.z;
  try{Opus.Terrain.generate(options);}catch(error){return {ok:false,reason:error.message};}
  return {ok:true,name,options};
}
function applyTerrainCreation(values,context) {
  if(playMode||levels[currentLevelIndex]!==context.level||placed!==context.objects)return {ok:false,reason:'Scene changed. Close this dialog and try again after stopping Play.'};
  const draft=terrainCreationDraft(values);if(!draft.ok)return draft;
  let handle;try{handle=app.createTerrain(draft.options);}catch(error){return {ok:false,reason:'Terrain could not be created: '+error.message};}
  pushUndo();const item={kind:'terrain',name:draft.name,handle,options:draft.options};syncTerrainLayerTextures(item);addPlaced(item);selectItem(item);return {ok:true};
}
function openTerrainCreation() {
  if(playMode){showStatus('Stop Play before creating terrain.');return;}
  document.getElementById('terrain-create-modal')?.remove();const context={level:levels[currentLevelIndex],objects:placed},host=document.createElement('div');host.id='terrain-create-modal';host.className='modal-overlay visible';
  const field=(key,label,value)=>`<div class="field-row"><label for="terrain-create-${key}">${label}</label><input id="terrain-create-${key}" ${key==='name'?'maxlength="80"':'type="number" step="any"'} value="${value}"></div>`;
  host.innerHTML=`<div class="modal" role="dialog" aria-label="Create Terrain"><h2>Create Terrain</h2><p>A procedural 3D island using the same terrain rendering and grounding as Play. Drag Terrain directly for historical quick placement; use this setup for a repeatable world.</p>${field('name','Name','Island')}${field('seed','Seed (same seed gives the same island)',1)}${field('size','Terrain width / depth (world units)',20)}${field('radius','Island radius',8)}${field('amplitude','Hill height variation',1.6)}${field('segments','Mesh divisions (8–128; higher costs more)',48)}${field('x','Center X',0)}${field('y','Base elevation Y',0)}${field('z','Center Z',0)}<p>Radius fits inside half the width. Terrain includes lower ground outside the island, not water. Add Water separately; sculpt and paint after creation in Inspector. Creation limits bound this wizard only; existing projects are not migrated.</p><button id="terrain-create-preview-btn">Preview height map</button><div id="terrain-create-preview" aria-label="Read-only sampled terrain preview"></div><p id="terrain-create-status" role="status"></p><button id="terrain-create-apply">Create Terrain</button><button id="terrain-create-cancel">Cancel</button></div>`;
  document.body.appendChild(host);const values=()=>Object.fromEntries(['name','seed','size','radius','amplitude','segments','x','y','z'].map(key=>[key,host.querySelector('#terrain-create-'+key).value]));
  host.querySelector('#terrain-create-cancel').onclick=()=>host.remove();
  host.querySelector('#terrain-create-preview-btn').onclick=()=>{const draft=terrainCreationDraft(values()),status=host.querySelector('#terrain-create-status');if(!draft.ok){status.textContent=draft.reason;host.querySelector('#terrain-create-preview').innerHTML='';return;}const heights=Array.from({length:256},(_,i)=>Opus.Terrain.sampleHeight(((i%16)/15-.5)*draft.options.size,(Math.floor(i/16)/15-.5)*draft.options.size,draft.options)),min=Math.min(...heights),max=Math.max(...heights);host.querySelector('#terrain-create-preview').innerHTML=`<svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Approximate top-down height map">${heights.map((h,i)=>`<rect x="${(i%16)*10}" y="${Math.floor(i/16)*10}" width="10" height="10" fill="hsl(145 30% ${20+50*(h-min)/(max-min||1)}%)"/>`).join('')}</svg>`;status.textContent=`Read-only 16×16 height samples: ${min.toFixed(2)} to ${max.toFixed(2)} local units. Approximate preview; no terrain or history added.`;};
  host.querySelector('#terrain-create-apply').onclick=()=>{const result=applyTerrainCreation(values(),context);if(result.ok){host.remove();showStatus('Terrain created. Undo removes it; use Inspector to sculpt or paint.');}else host.querySelector('#terrain-create-status').textContent=result.reason;};
}
document.getElementById('terrain-create-open').addEventListener('click',openTerrainCreation);

function placeItem(type, point, placementOptions) {
  pushUndo();
  if (type === 'cube') {
    point.y = 0.5;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.55, 0.65, 0.95], position: point, scale: new Opus.Vec3(1, 1, 1) });
    const item = { kind: 'cube', entity, behaviors: [] };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'ramp') {
    // Wave 6 (Priority B/Section 14): the same isWaypoint-style pattern --
    // a plain kind:'cube' item with an `isRamp` marker flag, gaining every
    // existing cube capability (solid, hierarchy, behaviors, Duplicate,
    // Save/Load) for free, distinguished only by its render mesh and by
    // which collision function the four Player Controllers call for it.
    point.y = 0.5;
    const entity = app.addEntity({ mesh: wedgeMesh, color: [0.6, 0.55, 0.45], position: point, scale: new Opus.Vec3(2, 1, 2) });
    entity.solid = true;
    const item = { kind: 'cube', entity, behaviors: [], isRamp: true };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'sprite') {
    if(placementOptions?.plane!=='xy')point.y = 1;
    const entity = app.addEntity({ mesh: spriteMesh, color: [1, 1, 1], position: point, scale: new Opus.Vec3(1, 1, 1) });
    const item = { kind: 'sprite', entity, behaviors: [] };
    OpusAuthoring.ensureComponent(item, 'sprite-renderer');
    syncSpriteRenderer(item);
    addPlaced(item);
    selectItem(item);
  } else if (type === 'tilemap') {
    point.y = 1;
    const entity = app.addEntity({ mesh: spriteMesh, color: [1, 1, 1], position: point, scale: new Opus.Vec3(1, 1, 1) });
    const item = OpusAuthoringPlumbing.createTilemapRecord({ id: undefined, name: 'Tilemap', tilesetRef: null, sortingLayerRef: DEFAULT_SPRITE_SORTING_LAYER_ID, orderInLayer: 0 }); item.entity = entity;
    syncTilemapRenderer(item); addPlaced(item); selectItem(item);
  } else if (type === 'billboard') {
    // Wave 6 (Priority I): same plain kind:'cube' + marker-flag pattern as
    // Ramp/Waypoint/Trigger above -- a Billboard gets every existing cube
    // capability (Materials 2.0 texture/alpha/unlit, hierarchy, behaviors,
    // Duplicate, Save/Load) for free, distinguished only by its render mesh
    // (billboardMesh, a vertical quad) and by syncBillboards continuously
    // reorienting it to face the camera every frame.
    point.y = 1;
    const entity = app.addEntity({ mesh: billboardMesh, color: [1, 1, 1], position: point, scale: new Opus.Vec3(1.5, 1.5, 1.5) });
    const item = { kind: 'cube', entity, behaviors: [], isBillboard: true, billboardMode: 'full' };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'terrain') {
    const options = { seed: Math.floor(Math.random() * 10000), size: 20, segments: 48, radius: 8, position: new Opus.Vec3(point.x, 0, point.z) };
    const handle = app.createTerrain(options);
    const item = { kind: 'terrain', handle, options };
    syncTerrainLayerTextures(item);
    addPlaced(item);
    selectItem(item);
  } else if (type === 'water') {
    const options = { size: 24, segments: 48, position: new Opus.Vec3(point.x, -1.6, point.z) };
    const handle = app.createWater(options);
    const item = { kind: 'water', handle, options };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'emitter') {
    // A live, continuously-animating particle effect (torch flame,
    // waterfall mist, sparkle) -- Opus.App.createEmitter already existed
    // and is already used internally for the craft's own exhaust/spray/
    // foam trails, just never reachable as a placeable, no-code-authored
    // object in its own right. Runs (and is visible) in both edit and Play
    // -- the engine's own update loop drives it unconditionally, the same
    // way the craft's own trail emitters already animate continuously, so
    // it's true WYSIWYG with no special-casing needed for preview.
    point.y = 0.5;
    const options = { position: point, rate: 20, life: [1, 2], riseSpeed: [0.4, 1.0], spread: 0.6, size: [0.05, 0.12], color: [1, 0.85, 0.5], gravity: -0.15, maxParticles: 200 };
    const handle = app.createEmitter(options);
    const item = { kind: 'emitter', handle, options };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'waypoint') {
    // Deliberately a plain kind:'cube' item with an `isWaypoint` marker
    // flag, the exact same pattern isTrigger already established -- gets
    // free-drag AND Move-gizmo draggability, Duplicate, stable id, and
    // Save/Load for free from the existing cube machinery, instead of
    // becoming a whole new item kind with its own copy of all of that.
    point.y = 0.5;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.3, 0.85, 0.5], position: point, scale: new Opus.Vec3(0.4, 0.4, 0.4) });
    const item = { kind: 'cube', entity, behaviors: [], isWaypoint: true };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'pointLight' || type === 'spotLight') {
    // A small marker entity (this editor's established pattern for anything
    // that isn't itself a visible gameplay mesh -- Camera/Spawner use the
    // exact same shape) PLUS a real `app.createLight` handle that actually
    // illuminates the scene. Kept as two separate objects deliberately: the
    // marker is what hierarchy/gizmo/drag/Undo already know how to move: a
    // per-frame sync (see the always-on hierarchy onUpdate hook) copies the
    // marker's resolved WORLD position into the light handle every frame, so
    // a parented/animated light stays correctly lit with zero light-specific
    // hierarchy code.
    point.y = 2;
    const isSpot = type === 'spotLight';
    const entity = app.addEntity({ mesh: cubeMesh, color: isSpot ? [1, 0.85, 0.3] : [1, 0.95, 0.6], position: point, scale: new Opus.Vec3(0.35, 0.35, 0.35) });
    const options = { lightType: isSpot ? 'spot' : 'point', position: point.clone(), color: [1, 0.92, 0.75], intensity: 1.5, range: 8, angle: isSpot ? 0.4 : undefined, direction: isSpot ? new Opus.Vec3(0, -1, 0) : undefined };
    const lightHandle = app.createLight({ type: options.lightType, position: point.clone(), color: options.color, intensity: options.intensity, range: options.range, angle: options.angle, direction: options.direction });
    const item = { kind: 'light', entity, options, lightHandle };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'spawnPoint') {
    // Same plain kind:'cube'+marker-flag pattern as Waypoint/Trigger above --
    // free drag, Move gizmo, Duplicate, stable id, Save/Load, prefab-capable,
    // for zero extra machinery. `isDefaultSpawn` designates the one spawn a
    // fresh Play session actually boots from; computeSpawnPoint() (see Wave 4
    // spawn-resolution fix) reads it first, ahead of every other fallback.
    // The first Spawn Point placed in a level is auto-designated default so a
    // level is never left with zero default spawn just because nobody
    // explicitly clicked "Set as Default".
    point.y = 0.5;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.3, 0.9, 0.95], position: point, scale: new Opus.Vec3(0.5, 0.9, 0.5) });
    const hasDefaultAlready = placed.some((p) => p.isSpawnPoint && p.isDefaultSpawn);
    const item = { kind: 'cube', entity, behaviors: [], isSpawnPoint: true, isDefaultSpawn: !hasDefaultAlready };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'path') {
    // Wave 8 (Priority I): a Path's own container item carries no visible
    // mesh itself (it's pure authoring metadata -- `pointIds` -- plus the
    // line visualization above); the FIRST point marker is created here so
    // a freshly-placed Path is never empty.
    const item = { kind: 'path', name: '', pointIds: [], loop: false, smooth: false };
    addPlaced(item);
    addPathPoint(item, point.clone());
    selectItem(item);
  } else if (type === 'mine') {
    point.y = 0.5;
    const entity = app.addEntity({ mesh: mineMesh, color: [0.85, 0.2, 0.2], position: point, scale: new Opus.Vec3(1.1, 1.1, 1.1) });
    const item = { kind: 'cube', entity, behaviors: [{ trigger: 'enter', action: 'lose', param: '' }] };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'boost') {
    point.y = 0.5;
    const entity = app.addEntity({ mesh: boostMesh, color: [0.3, 0.85, 1], position: point, scale: new Opus.Vec3(1.3, 0.7, 1.3) });
    entity.spin = 1.5;
    const item = { kind: 'cube', entity, behaviors: [{ trigger: 'enter', action: 'boost', param: '11' }] };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'trigger') {
    // A trigger volume is a placed cube like any other (reuses picking,
    // dragging, duplicate/delete, Save/Load, Undo/Redo unchanged) with one
    // difference: `isTrigger` hides its marker once Play starts (see
    // enterPlayMode) -- in-game it's an invisible volume, not an object.
    // Its radius reuses the exact same scale-derived formula every 'enter'
    // cube already gets (1.5x horizontal scale), so resizing it with the
    // existing Scale field just works, no new field needed for that part.
    point.y = 0.5;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.85, 0.35, 0.95], position: point, scale: new Opus.Vec3(1.5, 1.5, 1.5) });
    const item = { kind: 'cube', entity, behaviors: [], isTrigger: true, triggerRepeat: true };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'camera' || type === 'camera2d' || ['cameraThirdPerson','cameraTopDown','cameraIsometric'].includes(type)) {
    // An authored camera preset -- an editor-only marker (hidden in Play,
    // same as a Trigger Volume) whose position/settings the Change Camera
    // action reads and applies to the real app.camera. Placing one doesn't
    // change what's currently rendering; only firing Change Camera does.
    const is2D = type === 'camera2d';
    const isThirdPerson = type === 'cameraThirdPerson';
    const isTopDown = type === 'cameraTopDown', isIsometric = type === 'cameraIsometric';
    const isBuiltPreset = is2D || isThirdPerson || isTopDown || isIsometric;
    if (is2D) point.set(point.x, point.y, 10); else point.y = 1.6;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.95, 0.75, 0.15], position: point, scale: new Opus.Vec3(0.45, 0.45, 0.7) });
    const options = cameraBuiltPresetOptions(type,point);
    const presetName=is2D?'2D Camera':isThirdPerson?'Third-person Camera':isTopDown?'Top-down Camera':'Isometric Camera';
    const item = { kind: 'camera', entity, options, name: isBuiltPreset ? OpusAuthoringPlumbing.uniqueObjectName(presetName, placed.map((entry) => entry.name).filter(Boolean)) : undefined, isActiveCamera: isBuiltPreset };
    if (isBuiltPreset) for (const cameraItem of placed) if (cameraItem.kind === 'camera') cameraItem.isActiveCamera = false;
    addPlaced(item);
    selectItem(item);
  } else if (type === 'spawner') {
    // An editor-only marker (hidden in Play, same as Trigger Volume/Camera)
    // that spawns real Spawn-Prefab-style instances of a chosen prefab on
    // its own interval at runtime -- generalizes the "wave" pattern (Survival
    // Arena 2.0's Node Graph Delay chain) into a reusable placed object
    // instead of hand-wiring a graph every time.
    point.y = 1;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.95, 0.5, 0.2], position: point, scale: new Opus.Vec3(0.5, 1.2, 0.5) });
    const options = { position: point.clone(), prefabName: '', interval: 3, initialDelay: 0, maxActive: 5, totalCount: 0, radius: 3, startEnabled: true, tag: '' };
    const item = { kind: 'spawner', entity, options };
    addPlaced(item);
    selectItem(item);
  // --- Reusable Gameplay Component Presets (Wave 5, Priority K) -------
  // Every preset below is a curated combination of primitives that already
  // existed and were already independently dogfooded (Trigger Volume,
  // Behaviors/Action Types, Object Health's auto-init-on-first-hit via
  // tags, AI Follow, Property Animation, the Solid flag's own documented
  // "hidden = passable" rule) -- no new engine or editor mechanism was
  // added to build this list, matching the spec's own "package, don't
  // invent" framing for this priority. Every field written below is one a
  // user could set by hand through the existing Inspector; a preset just
  // saves them the trip.
  } else if (type === 'collectible') {
    point.y = 0.6;
    const entity = app.addEntity({ mesh: cubeMesh, color: [1, 0.85, 0.2], position: point, scale: new Opus.Vec3(0.4, 0.4, 0.4), unlit: true });
    entity.spin = 2;
    const item = {
      kind: 'cube', entity, behaviors: [
        { trigger: 'enter', action: 'incrementCounter', params: { counter: 'score' } },
        { trigger: 'enter', action: 'destroyObject' }, // no params -- resolveTarget defaults to self
      ],
      // Dogfood-02 fix: this preset used to also set `isTrigger: true,
      // triggerRepeat: false` -- but `isTrigger` is an opt-in for an
      // authored INVISIBLE proximity marker (preparePlacedForPlay
      // unconditionally hides any isTrigger cube), which a spinning gold
      // collectible star obviously isn't meant to be. The enter/exit/stay
      // overlap system itself never required isTrigger at all (see
      // wireItemTrigger's own comment: an ordinary pickup keeps its normal
      // 1.5x-scale sphere touch radius with isTrigger simply absent) --
      // `destroyObject` already makes this fire exactly once regardless,
      // so dropping isTrigger changes nothing about the pickup's behavior,
      // only whether it was ever visible to walk into in the first place.
    };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'healthPickup') {
    point.y = 0.6;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.3, 0.9, 0.4], position: point, scale: new Opus.Vec3(0.4, 0.4, 0.4), unlit: true });
    entity.spin = 2;
    const item = {
      kind: 'cube', entity, behaviors: [
        { trigger: 'enter', action: 'healPlayer', params: { amount: 25 } },
        { trigger: 'enter', action: 'destroyObject' },
      ],
      // Dogfood-02 fix: same invisible-pickup bug as Collectible above --
      // isTrigger dropped, no behavior change (destroyObject already makes
      // this one-shot).
    };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'damageHazard') {
    // Deliberately reuses the Mine mesh (a familiar hazard silhouette) but,
    // unlike the plain Mine palette item (an instant Lose Game), fires the
    // configurable Damage Player action with a cooldown -- a repeatable
    // "stand in the lava" hazard rather than a one-shot game-over trap.
    point.y = 0.5;
    const entity = app.addEntity({ mesh: mineMesh, color: [0.9, 0.35, 0.1], position: point, scale: new Opus.Vec3(1.1, 1.1, 1.1) });
    // Dogfood-02 fix: same invisible-hazard bug -- isTrigger dropped
    // (Damage Player's own `cooldown` param already makes this correctly
    // repeatable without triggerRepeat/isTrigger doing anything for it).
    const item = { kind: 'cube', entity, behaviors: [{ trigger: 'enter', action: 'damagePlayer', params: { amount: 15, cooldown: 1 } }] };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'checkpointPreset') {
    point.y = 0.5;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.3, 0.9, 0.95], position: point, scale: new Opus.Vec3(1.2, 0.15, 1.2), unlit: true });
    // Dogfood-02 fix: same invisible-marker bug -- isTrigger dropped (a
    // Checkpoint is meant to be a visible pad you can see and return to,
    // not an invisible volume).
    const item = { kind: 'cube', entity, behaviors: [{ trigger: 'enter', action: 'setCheckpoint' }] };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'door') {
    // Two objects, not one: the door panel itself (Solid, so it blocks
    // movement until opened -- reuses the existing Solid flag's own
    // documented "hidden = passable" rule from the Player Controller
    // collision loops, no new collision concept) and a small proximity
    // Trigger Volume in front of it wired to Show/Hide Object on the
    // panel. A one-shot open (triggerRepeat:false) -- the common "walk up,
    // door opens and stays open" case; a closing door is a second,
    // separate authored trigger, not assumed here.
    point.y = 1.25;
    const panelEntity = app.addEntity({ mesh: cubeMesh, color: [0.5, 0.4, 0.3], position: point.clone(), scale: new Opus.Vec3(1.2, 2.5, 0.3) });
    panelEntity.solid = true;
    const panelItem = { kind: 'cube', entity: panelEntity, behaviors: [] };
    addPlaced(panelItem);
    const triggerPoint = new Opus.Vec3(point.x, 0.5, point.z + 1.5);
    const triggerEntity = app.addEntity({ mesh: cubeMesh, color: [0.85, 0.35, 0.95], position: triggerPoint, scale: new Opus.Vec3(1.5, 1.5, 1.5) });
    const triggerItem = {
      kind: 'cube', entity: triggerEntity,
      behaviors: [{ trigger: 'enter', action: 'setVisibility', params: { targetId: panelItem.id, visible: false } }],
      isTrigger: true, triggerRepeat: false,
    };
    addPlaced(triggerItem);
    selectItem(panelItem);
  } else if (type === 'enemy') {
    // Object Health needs no explicit "damageable" flag -- ensureObjectHealthInit
    // auto-inits {current:100,max:100} on first hit for ANY tagged object
    // (see applyHitDamage), so the one thing this preset must set is the
    // tag. AI Follow + a Trigger Volume/Damage Player pair on the SAME cube
    // gives it contact damage, the exact combination Priority B's own
    // dogfood Robot already proved works (there as one piece of a bigger
    // assembly; here as a single self-contained preset).
    point.y = 0.5;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.75, 0.15, 0.15], position: point, scale: new Opus.Vec3(0.9, 0.9, 0.9) });
    entity.ai = { type: 'follow', speed: 3, radius: 10, targetId: null, base: entity.position.clone() };
    // Dogfood-02 fix: same invisible-object bug as the pickup presets above
    // -- isTrigger dropped, so the enemy this preset places is actually
    // visible in Play (found live: a placed Enemy preset was confirmed
    // genuinely invisible -- `entity.visible === false` -- the instant Play
    // started, with no error). Damage Player's own `cooldown` param already
    // makes contact damage correctly repeatable without triggerRepeat.
    const item = {
      kind: 'cube', entity, tags: ['enemy'],
      behaviors: [{ trigger: 'enter', action: 'damagePlayer', params: { amount: 10, cooldown: 1 } }],
    };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'movingPlatform') {
    // A ready-to-go 2-second ping-pong Property Animation clip (4 units
    // along local X) plus an On Start -> Play Animation behavior so it's
    // moving the instant Play begins, with zero extra authoring -- the
    // clip and its keyframes are ordinary `item.animationClips` data, the
    // same shape the Animation Editor itself produces, so it's fully
    // editable afterward (retime it, change the axis/distance, add a
    // rotation) rather than being special hardcoded platform logic.
    point.y = 0.5;
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.55, 0.6, 0.7], position: point, scale: new Opus.Vec3(3, 0.4, 3) });
    entity.solid = true;
    const clip = {
      name: 'Patrol', duration: 2, loop: 'pingpong',
      tracks: {
        position: [
          { t: 0, value: [point.x, point.y, point.z], easing: 'linear' },
          { t: 2, value: [point.x + 4, point.y, point.z], easing: 'linear' },
        ],
        rotationY: [], scale: [], visible: [],
      },
    };
    const item = { kind: 'cube', entity, behaviors: [{ trigger: 'start', action: 'playAnimation', params: { clipName: 'Patrol' } }], animationClips: [clip] };
    addPlaced(item);
    selectItem(item);
  } else if (type === 'projectilePreset') {
    // Not placed as a level hazard itself -- a ready-sized, ready-colored
    // starting point meant to be Saved As Prefab and assigned to a Weapon's
    // Prefab field or an AI's Ranged Attack Projectile Prefab, both of
    // which already expect exactly this: a small free-standing object.
    point.y = 1;
    const entity = app.addEntity({ mesh: cubeMesh, color: [1, 0.9, 0.3], position: point, scale: new Opus.Vec3(0.25, 0.25, 0.25), unlit: true, emissiveColor: [1, 0.9, 0.3], emissiveIntensity: 1.5 });
    const item = { kind: 'cube', entity, behaviors: [] };
    addPlaced(item);
    selectItem(item);
  } else if (type.startsWith('prefab:')) {
    const prefab = prefabs[Number(type.slice('prefab:'.length))];
    if (!prefab) return;
    if (prefab.records && prefab.records.length > 0) {
      const newItems = instantiatePrefabAssembly(prefab, point);
      for (const it of newItems) addPlaced(it);
      hierarchyTickToken++;
      updateHierarchyTransforms();
      selectedItems.clear();
      for (const it of newItems) selectedItems.add(it);
      selectedItem = newItems.find((it) => it.id === newItems._newRootId) || newItems[0];
      // Wave 6 (Priority K): linked-prefab tracking, root-only -- the same
      // "one id per logical spawn" scoping Spawner 2.0 already established
      // for its own activeIds. `sourcePrefabName` is what "Update From
      // Prefab"/"Update Prefab From This" (Inspector) read to find their way
      // back to this prefab -- a manual, on-demand link only (no automatic
      // propagation, no per-field override tracking), per this priority's
      // own explicit bounded scope.
      if (selectedItem) selectedItem.sourcePrefabName = prefab.name;
      applyPrefabParameters(prefab, selectedItem);
      syncSelectionMarkers();
    } else {
      // Preserve the prefab's original height-above-ground (its saved Y) at
      // the new X/Z the user dropped it at, rather than hardcoding a height
      // -- a prefab built from a tall model shouldn't sink into the ground.
      if(placementOptions?.plane!=='xy')point.y = prefab.record.position[1];
      const item = prefab.record.kind === 'sprite' ? instantiateSpriteRecord(prefab.record, point) : instantiateCubeRecord(prefab.record, point);
      item.sourcePrefabName = prefab.name;
      addPlaced(item);
      applyPrefabParameters(prefab, item);
      selectItem(item);
    }
  }
  renderSceneList();
}

