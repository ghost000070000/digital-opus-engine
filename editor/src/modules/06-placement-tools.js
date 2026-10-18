// --- Wave 8 (Priority C, Sections 15-24): Prefab Parameters ---
// The biggest reusable-authoring feature of this Wave: a prefab author
// exposes selected configuration as named `parameters` (Section 16 bound
// to Number/Boolean/String/Color/Prefab-Reference; Object/Mesh/Texture/
// Audio Asset references use the same `renderActionFieldInput` field
// types every other reference-picker in this editor already reuses),
// each with a stable `id` (separate from its display `label`, so renaming
// the label never breaks an instance's own override keyed by `id`) and a
// declarative BOUNDED binding (Section 19's own explicit "avoid a
// JavaScript expression system") to one of a small curated set of
// well-known prefab fields -- not an arbitrary JSON path a user could
// mistype into something silently inert.
const PREFAB_PARAM_BINDINGS = {
  color: { label: 'Color', valueType: 'color' },
  scale: { label: 'Scale (uniform)', valueType: 'number' },
  aiSpeed: { label: 'AI -> Speed', valueType: 'number' },
  healthMax: { label: 'Health -> Max', valueType: 'number' },
  attackDamage: { label: 'AI -> Attack Damage', valueType: 'number' },
  attackCooldown: { label: 'AI -> Attack Cooldown', valueType: 'number' },
  attackPrefab: { label: 'AI -> Attack Prefab', valueType: 'prefab' },
  animationSpeed: { label: 'Animation -> Speed', valueType: 'number' },
  soundAsset: { label: 'Play Sound -> Asset (first matching behavior)', valueType: 'audioAsset' },
  variable: { label: 'Object Variable starting value', valueType: 'dynamic' }, // valueType comes from the parameter's own declared `type` instead
  // Wave 9D (Priority A, Sections 3-6): the two new live-swap bindings --
  // reuse the exact SAME asset-resolution/application machinery every
  // other mesh/texture consumer in this editor already uses
  // (`getAssetMeshHandle`/`applyTextureToEntity`), just centralized here
  // (`applyMeshAssetToItem`/`applyTextureAssetToItem`, below) so both the
  // initial prefab-instantiate path AND a later Update-From-Prefab/
  // override-edit path apply a swap identically, never two.
  meshAssetSwap: { label: 'Visual -> Mesh Asset', valueType: 'meshAsset' },
  textureAssetSwap: { label: 'Material -> Texture Asset', valueType: 'textureAsset' },
};
// Wave 9D (Priority A, Section 4): the ONE centralized "assign this Mesh
// Asset to this placed object's live visual" helper. Refuses cleanly
// (Section 4's own explicit requirement) rather than corrupting state when
// the swap isn't safe: a skinned asset onto a skinned entity has its own
// separate clip-mapping/joint machinery this bounded parameter system was
// never meant to reconfigure, so both directions are refused, not
// partially applied. `getAssetMeshHandle` is asset-level cached (Wave 6),
// so repeated swaps between the same few variants never duplicate GPU
// mesh resources -- only ever creates one buffer per DISTINCT asset,
// however many instances/swaps reference it.
function applyMeshAssetToItem(item, assetId) {
  if (!item || item.kind !== 'cube' || !item.entity) return false;
  const asset = findAssetById(assetId);
  if (!asset) return false;
  if (asset.type === 'skinnedMesh' || item.entity.skin) return false; // refuse rather than corrupt a skinned rig's own animation state
  item.entity.mesh = getAssetMeshHandle(asset);
  item.assetId = assetId; // persisted id -- serializeCubeRecord's own `tag = item.assetId ? 'asset' : ...` picks this up on the next save with no further change needed
  return true;
}
// The Texture Asset counterpart -- reuses `applyTextureToEntity` (Wave 6's
// own existing texture-resolution path) directly, so "immediate live
// update, no duplicate texture loading" (Section 5) is inherited for free
// rather than reimplemented.
function applyTextureAssetToItem(item, assetId) {
  if (!item || item.kind !== 'cube' || !item.entity) return false;
  const asset = findTextureAssetById(assetId);
  if (!asset) return false;
  applyTextureToEntity(item.entity, asset);
  item.textureAssetId = assetId;
  item.textureDisabled = false;
  return true;
}
function generatePrefabParamId() { return `param${nextItemId++}`; }
// Applies ONE parameter's effective value (instance override, else the
// prefab's own default) onto the actual live field it's bound to, on the
// prefab's ROOT item only (Section 15's own worked examples -- Health/
// Speed/Weapon/Color/Aggressive -- are all root-level character/object
// properties; per-child-record binding was not something any real dogfood
// asked for, a genuine bounded scope choice, not an oversight).
function resolveEffectivePrefabParamValue(rootItem, param) {
  const override = rootItem.prefabParams && rootItem.prefabParams[param.id];
  return override !== undefined ? override : param.default;
}
function applyPrefabParamBinding(item, param, value) {
  if (!param.bindingField || value == null) return;
  switch (param.bindingField) {
    case 'color': { const [r, g, b] = hexToRgb(value); item.entity.color[0] = r; item.entity.color[1] = g; item.entity.color[2] = b; break; }
    case 'scale': item.entity.scale = new Opus.Vec3(value, value, value); break;
    case 'aiSpeed': if (item.entity.ai) item.entity.ai.speed = value; break;
    case 'healthMax': ensureObjectHealthInit(item); item.health.max = value; item.health.current = value; break;
    case 'attackDamage': if (item.entity.ai) item.entity.ai.attackDamage = value; break;
    case 'attackCooldown': if (item.entity.ai) item.entity.ai.attackCooldown = value; break;
    case 'attackPrefab': if (item.entity.ai) item.entity.ai.attackPrefab = value; break;
    case 'animationSpeed': if (item.entity.animationSpeed !== undefined || item.entity.skin) item.entity.animationSpeed = value; break;
    case 'soundAsset': { const b = (item.behaviors || []).find((bh) => bh.action === 'sound'); if (b) { b.params = b.params || {}; b.params.mode = 'asset'; b.params.audioAssetId = value; } break; }
    case 'variable': item.variables = item.variables || {}; item.variables[param.variableName] = value; break;
    case 'meshAssetSwap': applyMeshAssetToItem(item, value); break;
    case 'textureAssetSwap': applyTextureAssetToItem(item, value); break;
    default: break;
  }
}
// The ONE place a prefab's parameters (defaults, or an instance's own
// overrides layered on top) get applied to a live instance's real fields
// -- called right after instantiation (palette placement, Spawner,
// runtime Spawn Prefab) AND after "Update From Prefab" (Section 21: an
// instance with NO override for a given parameter picks up the prefab's
// new default; an instance WITH an explicit override keeps it -- parameter-
// only override tracking, deliberately not full Unity-style per-field
// tracking).
function applyPrefabParameters(prefab, rootItem) {
  if (!prefab.parameters || prefab.parameters.length === 0 || !rootItem) return;
  for (const param of prefab.parameters) {
    applyPrefabParamBinding(rootItem, param, resolveEffectivePrefabParamValue(rootItem, param));
  }
}

// Prefabs 2.0: instantiates a whole saved multi-object assembly at `point`
// (the root object's new position; every other record in the assembly is
// rigidly translated by the same delta, so relative offsets/hierarchy are
// preserved exactly). Returns the new items, NOT yet added to `placed`.
//
// ID remapping reuses `remapObjectIds()` -- the exact same whole-JSON
// quoted-string-substitution mechanism Duplicate Level already built for
// its own "every object gets a fresh id, every internal reference
// (targetId/aiTargetId/lookAtTargetId/groupId/parentId/...) follows it"
// requirement. One mechanism for both call sites, per the Wave 4 spec's own
// "do not write independent ad-hoc remapping logic for every subsystem" --
// this covers parentId, AI targetId, and every ACTION_TYPES/GRAPH_NODE_TYPES
// field type:'target'/'cameraPreset' automatically, with no per-field-type
// code here at all, since none of those references care HOW an id string
// got into that JSON, only that it matches something in the id map.
function instantiatePrefabAssembly(prefab, point) {
  const rootRecord = prefab.records.find((r) => r.id === prefab.rootId) || prefab.records[0];
  const rootPos = rootRecord.position || (rootRecord.options && rootRecord.options.position);
  const delta = new Opus.Vec3(point.x - rootPos[0], point.y - rootPos[1], point.z - rootPos[2]);
  const remapped = remapObjectIds(prefab.records); // fresh ids + every internal reference rewritten to match
  // A group is an assembly identity, not an object id. Each placement must
  // get its own groups, or selecting a new instance also selects its source.
  const groupMap = new Map();
  for (const record of remapped) {
    if (!record.groupId) continue;
    if (!groupMap.has(record.groupId)) groupMap.set(record.groupId, generateGroupId());
    record.groupId = groupMap.get(record.groupId);
  }
  const idBefore = prefab.records.map((r) => r.id);
  const idAfter = remapped.map((r) => r.id);
  const newRootId = idAfter[idBefore.indexOf(prefab.rootId)];
  const newItems = [];
  for (const record of remapped) {
    const pos = record.position || (record.options && record.options.position);
    if (pos) { pos[0] += delta.x; pos[1] += delta.y; pos[2] += delta.z; }
    let item;
    if (record.kind === 'cube') item = instantiateCubeRecord(record, new Opus.Vec3(...record.position), delta);
    else item = instantiateItemFromRecord(record);
    item.id = record.id;
    item.name = record.name;
    item.groupId = record.groupId;
    item.signalPrefabInstanceId = newRootId || idAfter[0];
    newItems.push(item);
  }
  newItems._newRootId = newRootId;
  return newItems;
}

// --- Wave 7 (Priority G, Sections 47-54): Scatter Placement ---
// Deterministic seeded RNG (mulberry32) -- the SAME seed always produces
// the SAME scatter, matching the spec's own "deterministic seeded
// placement" requirement, and reused by Array/Duplicate below for nothing
// (Array is fully deterministic already, no RNG needed there).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Places ONE instance (Prefab or single Asset -- Prefab takes priority when
// both happen to be configured, matching the spec's own stated priority)
// at `point`, returning the new item(s) so the caller can fold them into
// the scatter's own single Undo step. Reuses `instantiatePrefabAssembly`
// (already generic over single- or multi-member prefabs) and ordinary
// `app.addEntity`/`getAssetMeshHandle` for a plain Asset -- no second
// placement code path.
function scatterPlaceOne(config, point, rotationY, scale) {
  if (config.prefabName) {
    const prefab = prefabs.find((pf) => pf.name === config.prefabName);
    if (!prefab) return [];
    // Two prefab shapes (Wave 6 Priority K): a multi-member assembly has
    // `prefab.records`/`rootId`; a single-object prefab has only
    // `prefab.record` -- the same branch `swapItemForPrefabInstance`
    // already uses to tell them apart, reused here rather than assuming
    // every prefab is multi-member.
    let items, root;
    if (prefab.records && prefab.records.length > 0) {
      items = instantiatePrefabAssembly(prefab, point);
      for (const it of items) addPlaced(it);
      root = items.find((it) => it.id === items._newRootId) || items[0];
    } else {
      root = instantiateCubeRecord(prefab.record, point);
      addPlaced(root);
      items = [root];
    }
    if (root && root.entity) {
      root.entity.rotationY = rotationY;
      const authored = root.entity.scale;
      root.entity.scale = config.preservePrefabScale
        ? new Opus.Vec3(authored.x * scale, authored.y * scale, authored.z * scale)
        : new Opus.Vec3(scale, scale, scale);
      // Fit after scaling so the collider matches the scattered size.
      if (root.assetId) applyAssetDefaultCollider(root, findAssetById(root.assetId));
    }
    return items;
  }
  if (config.assetId) {
    const asset = findAssetById(config.assetId);
    if (!asset) return [];
    const entity = app.addEntity({ mesh: getAssetMeshHandle(asset), color: [1, 1, 1], position: point, rotationY, scale: new Opus.Vec3(scale, scale, scale) });
    const item = { kind: 'cube', entity, behaviors: [], assetId: config.assetId };
    applyAssetDefaultCollider(item, asset); // scattered trees/props are solid like dropped ones
    addPlaced(item);
    return [item];
  }
  return [];
}
// The one Scatter entry point -- config: `{prefabName|assetId, region:
// 'circle'|'box', centerX, centerZ, radius, width, depth, count,
// minSpacing, randomYRotation, scaleMin, scaleMax, seed, terrainConform,
// terrainItemId, maxSlopeDegrees}`. Naive rejection-sampling for min-
// spacing (bounded attempts per point, not a true Poisson-disc solver --
// accepted per the spec's own "at minimum a Scatter button" bar). Output
// is ordinary placed objects with zero second scene representation --
// movable/deletable/editable/prefab-able/groupable for free, exactly the
// spec's own explicit requirement. Wrapped in exactly ONE pushUndo() for
// the whole operation, never one per placement.
// Wave 8 (Priority J/Section 65): weighted deterministic source pick --
// the SAME `rng` instance `performScatter` already draws position/
// rotation/scale from (never a second RNG stream), so a "Forest" layer's
// 50/30/20 Oak/Pine/Rock split is fully reproducible from one seed, not
// just each individual placement's own position.
function pickWeightedScatterSource(sources, rng) {
  const total = sources.reduce((s, e) => s + (e.weight > 0 ? e.weight : 1), 0);
  let r = rng() * total;
  for (const e of sources) { r -= (e.weight > 0 ? e.weight : 1); if (r <= 0) return e; }
  return sources[sources.length - 1];
}
// Wave 9C: the pushUndo-free core, split out of performScatter (below) so
// the Scatter Brush (Section 10-11) can call it once per pointer-move
// sample WITHOUT pushing a separate Undo step each time -- "one drag
// gesture = one Undo step" needs the brush's own caller to wrap ONE
// pushUndo() around potentially many of these calls, which performScatter
// itself (still pushing its own undo, unchanged for the existing one-shot
// Scatter tool) can't do on the brush's behalf.
function scatterFillRegion(config) {
  const rng = mulberry32(config.seed >>> 0 || 1);
  const placedPoints = [];
  const terrainItem = config.terrainConform ? (config.terrainItemId ? findItemById(config.terrainItemId) : placed.find((p) => p.kind === 'terrain')) : null;
  const maxAttempts = Math.max(20, config.count * 20);
  let placedCount = 0;
  let attempts = 0;
  const allNewItems = [];
  while (placedCount < config.count && attempts < maxAttempts) {
    attempts++;
    let x, z;
    if (config.region === 'box') {
      x = config.centerX + (rng() - 0.5) * config.width;
      z = config.centerZ + (rng() - 0.5) * config.depth;
    } else {
      const angle = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * config.radius; // sqrt for uniform AREA density, not center-biased
      x = config.centerX + Math.cos(angle) * r;
      z = config.centerZ + Math.sin(angle) * r;
    }
    if (config.minSpacing > 0 && placedPoints.some((p) => Math.hypot(p[0] - x, p[1] - z) < config.minSpacing)) continue;
    let y = 0;
    if (terrainItem && terrainItem.handle) {
      y = terrainItem.handle.sampleHeight(x, z);
      if (config.maxSlopeDegrees != null) {
        const normal = terrainItem.handle.sampleNormal(x, z);
        const slopeDeg = Math.acos(Math.min(1, Math.max(-1, normal.y))) * 180 / Math.PI;
        if (slopeDeg > config.maxSlopeDegrees) continue; // too steep -- skip this candidate point entirely, don't place a mislabeled "flat" instance on it
      }
    }
    const rotationY = config.randomYRotation ? rng() * Math.PI * 2 : 0;
    const scale = config.scaleMin != null ? config.scaleMin + rng() * (config.scaleMax - config.scaleMin) : 1;
    // Wave 8 (Priority J): a Scatter Layer's own weighted multi-prefab list
    // (`config.sources = [{type:'prefab'|'asset', ref, weight}]`) picks ONE
    // source per candidate point deterministically -- everything else
    // (single prefabName/assetId, the pre-Wave-8 shape) is unaffected.
    let pointConfig = config;
    if (config.sources && config.sources.length > 0) {
      const picked = pickWeightedScatterSource(config.sources, rng); // exactly ONE rng draw per point -- calling this twice would both break determinism and pick two DIFFERENT sources for type vs ref
      pointConfig = { ...config, prefabName: picked.type === 'asset' ? undefined : picked.ref, assetId: picked.type === 'asset' ? picked.ref : undefined };
    }
    // Optional brush-owned transaction hook; original one-shot caller already
    // owns its history and is unchanged. Invoke only for a placeable source.
    const sourceExists = pointConfig.prefabName ? prefabs.some(p => p.name === pointConfig.prefabName) : pointConfig.assetId && !!findAssetById(pointConfig.assetId);
    if (!sourceExists) break;
    if (typeof config.beforePlace === 'function') config.beforePlace();
    const newItems = scatterPlaceOne(pointConfig, new Opus.Vec3(x, y, z), rotationY, scale);
    if (newItems.length === 0) break; // nothing placeable configured -- stop immediately rather than looping to maxAttempts uselessly
    // Wave 8 (Priority J/Section 67): Scatter ownership -- every object a
    // Layer creates records which layer made it, so Erase Scatter can
    // target only that layer's own generated instances. Otherwise ordinary
    // placed objects (movable/deletable/prefab-able) in every other respect.
    if (config.layerId) for (const it of newItems) it.scatterLayerId = config.layerId;
    allNewItems.push(...newItems);
    placedPoints.push([x, z]);
    placedCount++;
  }
  return { placedCount, attempts, items: allNewItems };
}
// The original one-shot entry point (the existing "Scatter" tool button
// above still calls this, unchanged) -- ONE pushUndo() per whole
// region-fill operation, then the exact same core loop.
function performScatter(config) {
  pushUndo();
  return scatterFillRegion(config);
}
// Wave 8 (Priority J/Section 67): removes only the objects a given Scatter
// Layer actually created (`item.scatterLayerId`), never hand-placed/other-
// layer objects that merely happen to sit nearby -- the whole point of
// tagging ownership at creation time above.
function eraseScatterLayer(layerId) {
  const toRemove = placed.filter((p) => p.scatterLayerId === layerId);
  if (toRemove.length === 0) return 0;
  pushUndo();
  for (const it of toRemove) removeItemFromScene(it);
  return toRemove.length;
}

// --- Wave 7 (Priority H, Sections 55-56): Array/Duplicate Pattern Tool ---
// `Duplicate Array` -- Linear (count/spacing along one axis) or Grid
// (countX/countZ/spacingX/spacingZ) -- reuses the SAME per-source-item
// duplication primitive Duplicate Selected already has for a single copy,
// just looped, wrapped in exactly ONE pushUndo() for the whole operation.
// Circular deliberately NOT built -- Linear/Grid alone already covered the
// two dogfood cases (a fence line, a wall of platforms/columns) with zero
// friction; adding a third mode with no concrete use case yet would be
// complexity ahead of a real need, the same bounded discipline this
// project applies everywhere else.
// Builds one independent copy of `sourceItem` at `point`, via the exact
// same serialize/instantiate round-trip Save/Load already trusts to
// faithfully carry every field (materials, behaviors, tags, collider,
// sockets, ...) -- reused here instead of hand-copying fields the way
// `duplicateSelected` does inline, so Array/Scatter output can never
// silently diverge from what a real save/load already proves correct.
// Scoped to ordinary cube-kind objects (fences/platforms/walls/columns,
// the spec's own worked examples for Array; Scatter's own foliage/props
// dogfood is cube-kind too) -- not every placeable kind.
function duplicateOneItemAt(sourceItem, point) {
  if (sourceItem.kind !== 'cube') return null;
  const record = serializeCubeRecord(sourceItem);
  record.parentId = undefined; // an array/scatter copy is independent, never chained under the source
  record.socketName = undefined;
  const item = instantiateCubeRecord(record, point);
  item.id = generateItemId(); // fresh, not the source's own id
  addPlaced(item);
  return item;
}
function planArrayDuplicate(sourceItem, config) {
  const refuse=reason=>({ok:false,reason,points:[]});
  if(playMode||!sourceItem||!placed.includes(sourceItem)||sourceItem.kind!=='cube')return refuse('Select a current single Cube outside Play.');
  if(sourceItem.groupId||placed.some(item=>item.parentId===sourceItem.id))return refuse('Array currently copies a single Cube, not a group or hierarchy. Use Duplicate Selected for assemblies.');
  if(!config||!['linear','grid'].includes(config.mode))return refuse('Choose Linear or Grid.');
  const count=n=>Number.isInteger(n)&&n>=1&&n<=2048,spacing=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000;
  if(config.mode==='linear'&&(!['x','z'].includes(config.axis)||!count(config.count)||!spacing(config.spacing)))return refuse('Use X/Z, an integer count1–2048 and finite spacing within ±100000.');
  if(config.mode==='grid'&&(!count(config.countX)||!count(config.countZ)||config.countX*config.countZ>2048||!spacing(config.spacingX)||!spacing(config.spacingZ)))return refuse('Grid counts must be positive integers with at most2048 total positions; spacing must be finite within ±100000.');
  const base=itemPosition(sourceItem);if(!base||![base.x,base.y,base.z].every(Number.isFinite))return refuse('Source position is invalid; retain it for recovery.');
  const points=[];
  if(config.mode==='grid'){for(let x=0;x<config.countX;x++)for(let z=0;z<config.countZ;z++)if(x||z)points.push(new Opus.Vec3(base.x+x*config.spacingX,base.y,base.z+z*config.spacingZ));}
  else for(let i=1;i<config.count;i++)points.push(new Opus.Vec3(base.x+(config.axis==='x'?i*config.spacing:0),base.y,base.z+(config.axis==='z'?i*config.spacing:0)));
  if(points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))return refuse('Array positions overflow; reduce spacing.');
  return {ok:true,reason:'',points};
}
function performArrayDuplicate(sourceItem, config) {
  const plan=planArrayDuplicate(sourceItem,config);if(!plan.ok||!plan.points.length)return [];
  pushUndo();
  return plan.points.map(point=>duplicateOneItemAt(sourceItem,point)).filter(Boolean);
}

// Wave 6 (Priority K): Prefab Workflow 3.0 -- three small functions built
// entirely on primitives that already existed (collectDescendants,
// serializeCubeRecord/serializeItemRecord, instantiateCubeRecord/
// instantiatePrefabAssembly, removeItemFromScene), not new prefab math.

// The ONE place that turns a live root item (+ its descendants, if any)
// into a prefab payload -- shared by Save-as-Prefab and "Update Prefab
// From This" so the two can never build a differently-shaped prefab
// record for the same kind of selection.
function prefabAssemblyItems(rootItem, selection) {
  const seeds = selection ? [...selection] : rootItem.groupId
    ? placed.filter((item) => item.groupId === rootItem.groupId) : [rootItem];
  const members = new Set([rootItem]);
  for (const item of seeds) {
    members.add(item);
    for (const descendant of collectDescendants(item)) members.add(descendant);
  }
  return [...members];
}
function buildPrefabPayload(rootItem, name, selection) {
  // Wave 8 (Priority C): carries an EXISTING prefab's own `parameters`
  // definition forward across a re-Save/Update -- otherwise `prefabs[i] =
  // payload` (both call sites) would silently WIPE a prefab's authored
  // Parameter list the moment an author re-saved or "Update Prefab From
  // This"'d it, since `buildPrefabPayload` itself has no other way to know
  // parameters exist at all (they're prefab-level authoring data, not
  // derived from any one live instance's own fields).
  const existing = prefabs.find((p) => p.name === name);
  const parameters = existing ? existing.parameters : undefined;
  const allItems = prefabAssemblyItems(rootItem, selection);
  if (allItems.length === 1) {
    return { payload: { name, record: serializeItemRecord(rootItem), parameters }, memberCount: 1 };
  }
  const records = allItems.map(serializeItemRecord);
  return { payload: { name, records, record: records.find((r) => r.id === rootItem.id), rootId: rootItem.id, parameters }, memberCount: allItems.length };
}
// Destroys a root item AND every object transitively parented under it --
// removeItemFromScene alone only ever removes the one item it's given
// (orphaning, not deleting, its children), which is correct for Delete
// Object but wrong here: swapping an instance for a fresh prefab copy must
// not leave the OLD assembly's other pieces behind as orphaned leftovers.
function removeItemAndDescendants(item) {
  for (const it of prefabAssemblyItems(item)) removeItemFromScene(it);
}
// Shared by "Update From Prefab" (re-sync to the CURRENT prefab definition)
// and "Replace With Prefab" (swap for a DIFFERENT prefab entirely) -- both
// are, mechanically, the exact same operation: destroy the old instance,
// instantiate a fresh one from the given prefab at the same position, link
// the new instance back to that prefab. Deliberately NOT a field-by-field
// diff/merge -- a full destroy-and-reinstantiate is the honest, bounded
// implementation of "no override tracking" (this priority's own explicit
// constraint): whatever the author had customized on the old instance
// beyond the prefab's own definition is not preserved, because tracking
// which fields were "overridden" vs "from the prefab" is exactly the
// Unity-style bookkeeping this priority was told not to build.
function swapItemForPrefabInstance(item, prefab, statusVerb) {
  const position = itemPosition(item).clone();
  // Wave 8 (Priority C/Section 21): "Update From Prefab" (same source
  // prefab) carries the OLD instance's own parameter overrides forward --
  // an instance with an explicit override keeps it; a parameter with NO
  // override picks up the prefab's new default automatically, because
  // `applyPrefabParameters` below always resolves through
  // `resolveEffectivePrefabParamValue` (override-else-default), never a
  // frozen snapshot. "Replace With Prefab" (a DIFFERENT prefab) does NOT
  // carry params forward -- a different prefab's own parameter schema may
  // not even share the same ids, so starting from ITS OWN defaults is the
  // only value that would ever make sense.
  const carryForwardParams = item.sourcePrefabName === prefab.name ? item.prefabParams : undefined;
  pushUndo();
  removeItemAndDescendants(item);
  let newRoot;
  if (prefab.records && prefab.records.length > 0) {
    const newItems = instantiatePrefabAssembly(prefab, position);
    for (const it of newItems) addPlaced(it);
    hierarchyTickToken++;
    updateHierarchyTransforms();
    newRoot = newItems.find((it) => it.id === newItems._newRootId) || newItems[0];
  } else {
    newRoot = prefab.record.kind === 'sprite' ? instantiateSpriteRecord(prefab.record, position) : instantiateCubeRecord(prefab.record, position);
    addPlaced(newRoot);
  }
  if (newRoot) {
    newRoot.sourcePrefabName = prefab.name;
    // Post-Wave-9 dogfood -- REAL BUG found live building Signal Relay:
    // "Update From Prefab" silently discarded the instance's own custom
    // Name (and tags/variables), since `instantiateCubeRecord` builds a
    // fresh item from the PREFAB's own template record, which has no idea
    // "ConsoleAlpha" was this particular instance's own identifying label
    // -- a game creator naming their three consoles Alpha/Beta/Gamma, then
    // syncing one to pick up a Color Parameter default change, lost that
    // name back to blank the instant they clicked the button. Name/tags/
    // variables are per-INSTANCE authored data, not defined by the prefab
    // template, so they carry forward here exactly like `prefabParams`
    // already does just above -- everything else (mesh/behaviors/color-if-
    // unoverridden) still comes from the current prefab definition, which
    // is the whole point of this action.
    if (item.name) newRoot.name = item.name;
    if (item.tags && item.tags.length) newRoot.tags = item.tags.slice();
    if (item.variables && Object.keys(item.variables).length) newRoot.variables = { ...item.variables };
    if (carryForwardParams) newRoot.prefabParams = { ...carryForwardParams };
    applyPrefabParameters(prefab, newRoot);
    selectItem(newRoot);
  }
  renderSceneList();
  showStatus(`${statusVerb} "${prefab.name}"`);
}
// Live prefab linking: after "Update Prefab From This", every other root
// instance of the prefab in this level is rebuilt from the new definition.
// Per-instance data survives: name, tags, variables, parameter overrides,
// position and rotation. Scale counts as an override only when the instance
// differed from the previous prefab. Caller owns the single Undo step.
function propagatePrefabToInstances(prefab, previousPrefab, sourceItem) {
  const sameVec = (a, b) => Array.isArray(b) && a && Math.abs(a.x - b[0]) < 1e-6 && Math.abs(a.y - b[1]) < 1e-6 && Math.abs(a.z - b[2]) < 1e-6;
  const previousScale = previousPrefab && previousPrefab.record && previousPrefab.record.scale;
  const instances = placed.filter(item => item !== sourceItem && item.sourcePrefabName === prefab.name && !item.parentId && item.entity);
  let updated = 0;
  for (const item of instances) {
    if (!placed.includes(item)) continue;
    const position = itemPosition(item).clone();
    const quaternion = item.entity.quaternion;
    const scale = item.entity.scale.clone();
    const scaleOverridden = !sameVec(scale, previousScale);
    const keep = { name: item.name, tags: item.tags && item.tags.slice(), variables: item.variables && { ...item.variables }, params: item.prefabParams && { ...item.prefabParams } };
    removeItemAndDescendants(item);
    let root;
    if (prefab.records && prefab.records.length > 0) {
      const created = instantiatePrefabAssembly(prefab, position);
      for (const it of created) addPlaced(it);
      root = created.find(it => it.id === created._newRootId) || created[0];
    } else {
      root = prefab.record.kind === 'sprite' ? instantiateSpriteRecord(prefab.record, position) : instantiateCubeRecord(prefab.record, position);
      addPlaced(root);
    }
    if (!root) continue;
    root.sourcePrefabName = prefab.name;
    if (keep.name) root.name = keep.name;
    if (keep.tags && keep.tags.length) root.tags = keep.tags;
    if (keep.variables && Object.keys(keep.variables).length) root.variables = keep.variables;
    if (keep.params) root.prefabParams = keep.params;
    if (root.entity && quaternion) root.entity.quaternion = quaternion;
    if (root.entity && scaleOverridden) root.entity.scale = scale;
    applyPrefabParameters(prefab, root);
    updated++;
  }
  if (updated) { hierarchyTickToken++; updateHierarchyTransforms(); renderSceneList(); }
  return updated;
}
function updateInstanceFromPrefab(item) {
  const prefab = prefabs.find((p) => p.name === item.sourcePrefabName);
  if (!prefab) { showStatus('Source prefab no longer exists'); return; }
  swapItemForPrefabInstance(item, prefab, 'Updated instance from prefab');
}
function replaceItemWithPrefab(item, prefab) {
  if (!item || !prefab) return;
  swapItemForPrefabInstance(item, prefab, 'Replaced with prefab');
}

const PALETTE_LABELS = { cube: '▢ Cube', sprite: '▧ Sprite', tilemap: '▦ Tilemap', ramp: '◺ Ramp', billboard: '🌿 World-Space Billboard', terrain: '⛰ Terrain', water: '〜 Water', mine: '✹ Mine', boost: '▲ Boost Pad', trigger: '◈ Trigger Volume', emitter: '✨ Particle Emitter', camera: '🎥 Camera', camera2d: '▣ 2D Camera', cameraThirdPerson: '🎥 Third-person Camera', cameraTopDown:'🎥 Top-down Camera', cameraIsometric:'🎥 Isometric Camera', spawner: '💠 Spawner', waypoint: '📍 Waypoint', path: '🛤 Path', spawnPoint: '🚩 Spawn Point', pointLight: '💡 Point Light', spotLight: '🔦 Spot Light', collectible: '⭐ Collectible', healthPickup: '➕ Health Pickup', damageHazard: '☠ Damage Hazard', checkpointPreset: '🏁 Checkpoint', door: '🚪 Proximity Door', enemy: '👾 Enemy', movingPlatform: '🟫 Moving Platform', projectilePreset: '● Projectile Starter' };
// The base placeable kinds plus the Wave 5 (Priority K) component presets --
// one shared list so the palette drag-sources and the Command Palette
// (Ctrl+K) can never drift apart on which types exist.
const PLACEABLE_TYPES = ['cube', 'sprite', 'tilemap', 'ramp', 'billboard', 'terrain', 'water', 'mine', 'boost', 'trigger', 'emitter', 'camera', 'camera2d', 'cameraThirdPerson', 'cameraTopDown', 'cameraIsometric', 'spawner', 'waypoint', 'path', 'spawnPoint', 'pointLight', 'spotLight', 'collectible', 'healthPickup', 'damageHazard', 'checkpointPreset', 'door', 'enemy', 'movingPlatform', 'projectilePreset'];

