// --- Wave 9C (Priority A, Sections 10-13): Scatter Brush -- Paint/Erase,
// the exact same Pointer Events gesture shape Sculpt/Terrain-Paint above
// already established (mutually exclusive with them and with each other;
// checked first in pointerdown, same reasoning). Configures the EXISTING
// `scatterFillRegion`/`removeItemFromScene` machinery -- no second
// placement or removal path.
let scatterBrushMode = null; // null | 'paint' | 'erase'
let scatterBrushDragState = null; // { layer, dabIndex, lastPoint, placedCount, removedCount }
function scatterLayerSourcesConfig(layer) {
  return (layer.sources || []).filter((s) => s.prefabName && prefabs.some(p => p.name === s.prefabName)).map((s) => ({ type: 'prefab', ref: s.prefabName, weight: s.weight > 0 ? s.weight : 1 }));
}
function changeScatterLayerField(layer, key, value, beforeChange) {
  if (playMode || !currentScatterLayers.includes(layer)) return false;
  const bounds = {seed:[0,4294967295],brushRadius:[0.5,64],density:[0.05,1],minSpacing:[0,256],scaleMin:[0.05,100],scaleMax:[0.05,100],maxSlope:[0,90]};
  if (key === 'name') { if (typeof value !== 'string' || value.length > 256) return false; }
  else if (key === 'randomYaw') { if (typeof value !== 'boolean') return false; }
  else { const b=bounds[key]; if (!b || !Number.isFinite(value) || value<b[0] || value>b[1] || key==='seed'&&!Number.isInteger(value)) return false; }
  if (key==='scaleMin'&&value>layer.scaleMax || key==='scaleMax'&&value<layer.scaleMin || Object.is(layer[key],value)) return false;
  if (beforeChange) beforeChange(); else pushUndo();
  layer[key]=value;
  return true;
}
function scatterBrushOwner(layer, point) {
  return !playMode && currentScatterLayers.includes(layer) && scatterBrushDragState?.layer===layer && point && Number.isFinite(point.x) && Number.isFinite(point.z) && Number.isFinite(layer.brushRadius) && layer.brushRadius>=0.5 && layer.brushRadius<=64;
}
function beginScatterBrushChange() {
  if (!scatterBrushDragState.strokeStarted) { pushUndo(); scatterBrushDragState.strokeStarted=true; }
}
function changeScatterLayerSource(layer, index, key, value, beforeChange) {
  if(playMode || !currentScatterLayers.includes(layer) || !Number.isInteger(index) || !layer.sources[index]) return false;
  if(key==='prefabName') { if(typeof value!=='string'||value&&!prefabs.some(p=>p.name===value))return false; }
  else if(key==='weight') { if(!Number.isFinite(value)||value<0||value>100000)return false; }
  else return false;
  if(Object.is(layer.sources[index][key],value))return false;
  if(beforeChange)beforeChange();else pushUndo();
  layer.sources=layer.sources.map((s,i)=>i===index?{...s,[key]:value}:{...s});return true;
}
// One "dab" = one bounded circular scatterFillRegion call centered on the
// pointer's current world position. `dabIndex` (incremented once per dab,
// never reset mid-gesture) folds into the seed so a repeated identical
// gesture (same layer settings, same starting seed, same dab sequence)
// picks the same sources/positions -- Section 8's own "reproducible where
// the algorithm permits."  Count-per-dab is deliberately small and
// area-proportional (not the layer's whole target density at once) so a
// slow drag doesn't way overshoot Density relative to a fast one covering
// the same ground in fewer dabs -- a bounded, honest approximation, not a
// true continuous-density brush.
function applyScatterBrushPaint(layer, worldPoint) {
  if (!scatterBrushOwner(layer, worldPoint) || !Number.isFinite(layer.density) || layer.density<0.05 || layer.density>1) return 0;
  const sources = scatterLayerSourcesConfig(layer);
  if (sources.length === 0) { showStatus('Add at least one Source to this Scatter Layer first'); return 0; }
  const terrainItem = placed.find((p) => p.kind === 'terrain');
  const area = Math.PI * layer.brushRadius * layer.brushRadius;
  const count = Math.min(128, Math.max(1, Math.round(area * layer.density * 0.12)));
  const config = {
    sources, region: 'circle', centerX: worldPoint.x, centerZ: worldPoint.z, radius: layer.brushRadius,
    count, minSpacing: layer.minSpacing, seed: (layer.seed + scatterBrushDragState.dabIndex) >>> 0,
    scaleMin: layer.scaleMin, scaleMax: layer.scaleMax, maxSlopeDegrees: layer.maxSlope,
    randomYRotation: layer.randomYaw, terrainConform: !!terrainItem, terrainItemId: terrainItem ? terrainItem.id : undefined,
    layerId: layer.id,
    beforePlace: beginScatterBrushChange,
  };
  scatterBrushDragState.dabIndex++;
  const result = scatterFillRegion(config);
  return result.placedCount;
}
// Erase only ever removes THIS layer's own owned objects (Section 12's own
// explicit "do not erase manual objects/another Layer/terrain/triggers/
// gameplay objects/Paths") -- filtering strictly on `scatterLayerId ===
// layer.id` makes every one of those exclusions automatic, not a list of
// special cases to maintain.
function applyScatterBrushErase(layer, worldPoint) {
  if (!scatterBrushOwner(layer, worldPoint)) return 0;
  const toRemove = placed.filter((p) => p.scatterLayerId === layer.id && p.entity && Math.hypot(p.entity.position.x - worldPoint.x, p.entity.position.z - worldPoint.z) <= layer.brushRadius);
  if (toRemove.length) beginScatterBrushChange();
  for (const it of toRemove) removeItemFromScene(it);
  return toRemove.length;
}
// Editor-only brush-radius ring (Section 13/26) -- a thin flattened
// cylinder-ish marker reusing the existing cube mesh scaled flat, the same
// "no new renderer, a simple marker is enough" approach Waypoint
// connection lines already established. Hidden during Play (never even
// created there, since the brush itself is edit-only).
let scatterBrushMarker = null;
function finishScatterBrushGesture() {
  if (!scatterBrushDragState) return false;
  const {placedCount,removedCount}=scatterBrushDragState;
  scatterBrushDragState=null;activePointerId=null;
  if(scatterBrushMarker)scatterBrushMarker.visible=false;
  suppressCameraDrag();renderScatterLayerPanel();
  showStatus(placedCount ? `Painted ${placedCount} objects` : removedCount ? `Erased ${removedCount} objects` : 'Scatter Brush: nothing changed');
  return true;
}
window.addEventListener('blur',()=>{if(scatterBrushDragState)finishScatterBrushGesture();});
function syncScatterBrushMarker(worldPoint, radius, active) {
  if (!active || !worldPoint) { if (scatterBrushMarker) scatterBrushMarker.visible = false; return; }
  if (!scatterBrushMarker) scatterBrushMarker = app.addEntity({ mesh: cubeMesh, color: scatterBrushMode === 'erase' ? [0.85, 0.35, 0.3] : [0.4, 0.85, 0.55], position: worldPoint, scale: new Opus.Vec3(radius * 2, 0.02, radius * 2) });
  scatterBrushMarker.position.set(worldPoint.x, worldPoint.y + 0.05, worldPoint.z);
  scatterBrushMarker.scale.set(radius * 2, 0.02, radius * 2);
  scatterBrushMarker.visible = true;
}

function ensurePaintEdits(item) {
  const opts = item.options;
  const segs = opts.segments;
  const verts = segs + 1;
  if (!opts.paintEdits || opts.paintEdits.segments !== segs) {
    opts.paintEdits = {
      segments: segs,
      layers: [{ name: 'Dirt', color: [0.42, 0.32, 0.2] }, { name: 'Rock', color: [0.45, 0.45, 0.47] }],
      weights: new Array(2 * verts * verts).fill(0),
    };
  }
  return opts.paintEdits;
}

function terrainPaintDraft(item) {
  const opts = item.options;
  return opts.paintEdits && opts.paintEdits.segments === opts.segments ? JSON.parse(JSON.stringify(opts.paintEdits)) : {
    segments: opts.segments,
    layers: [{name:'Dirt',color:[0.42,0.32,0.2]}, {name:'Rock',color:[0.45,0.45,0.47]}],
    weights: new Array(2 * (opts.segments + 1) ** 2).fill(0)
  };
}

function finishTerrainPaintGesture() {
  if (!paintDragState) return false;
  paintDragState = null; activePointerId = null;
  suppressCameraDrag(); showTerrainSculptPreview(null); renderInspector();
  return true;
}
window.addEventListener('blur', () => { if (paintDragState) finishTerrainPaintGesture(); });

function changeTerrainPaintLayer(item, index, key, value, beforeChange) {
  if (playMode || !placed.includes(item) || item.kind !== 'terrain' || !Number.isInteger(index)) return false;
  const next = terrainPaintDraft(item), layer = next.layers[index];
  if (!layer) return false;
  if (key === 'color') {
    if (!Array.isArray(value) || value.length !== 3 || value.some(v => !Number.isFinite(v) || v < 0 || v > 1)) return false;
  } else if (key === 'textureAssetId') {
    if (value && !findTextureAssetById(value)) return false;
  } else if (key === 'uvScale') {
    if (!Number.isFinite(value) || value < 0.5 || value > 1024) return false;
  } else return false;
  if (JSON.stringify(layer[key]) === JSON.stringify(value)) return false;
  layer[key] = Array.isArray(value) ? value.slice() : value;
  if (key === 'textureAssetId' && value && !layer.uvScale) layer.uvScale = 4;
  if (beforeChange) beforeChange(); else pushUndo();
  item.options.paintEdits = next;
  regenerateTerrain(item);
  return true;
}
// Wave 6B (Priority D): resolves each of this terrain's up to 3 paint
// layers' own optional `textureAssetId` into a real GPU texture handle (via
// the SAME lazy `getTextureHandle` every other texture picker in this editor
// already uses) and assigns the resulting array straight onto the live
// terrain handle's `layerTextures` accessor. Called after every `handle =
// app.createTerrain(...)` (initial placement, regenerateTerrain, duplicate,
// load) since a fresh handle always starts with `layerTextures` reset to
// `[null, null, null]` engine-side. A layer whose image hasn't finished
// decoding yet registers a pending callback (the same `pendingCallbacks`
// convention `applyTextureToEntity` already established) that re-syncs once
// the image is ready, rather than silently leaving that layer untextured
// forever.
function syncTerrainLayerTextures(item) {
  const paintEdits = item.options.paintEdits;
  const layers = paintEdits ? paintEdits.layers : [];
  const textures = [null, null, null];
  for (let li = 0; li < Math.min(layers.length, 3); li++) {
    const assetId = layers[li].textureAssetId;
    if (!assetId) continue;
    const asset = findTextureAssetById(assetId);
    if (!asset) continue;
    const handle = getTextureHandle(asset);
    if (handle) {
      textures[li] = handle;
    } else {
      (asset.pendingCallbacks = asset.pendingCallbacks || []).push(() => { if (placed.includes(item)) syncTerrainLayerTextures(item); });
    }
  }
  item.handle.layerTextures = textures;
}
function addPaintLayer(item) {
  if (playMode || !placed.includes(item) || item.kind !== 'terrain') return false;
  const edits = terrainPaintDraft(item);
  if (edits.layers.length >= PAINT_MAX_LAYERS) return false;
  const verts = edits.segments + 1;
  const cellCount = verts * verts;
  const palette = [[0.42, 0.32, 0.2], [0.45, 0.45, 0.47], [0.85, 0.8, 0.55]];
  edits.layers.push({ name: `Layer ${edits.layers.length + 1}`, color: palette[edits.layers.length % palette.length] });
  // Grow `weights` to fit the new layer -- new layer starts at 0 everywhere,
  // existing layers' weights are untouched (a straight array-length
  // extension, not a reshuffle, since layers are already laid out
  // layer-major with each layer's own contiguous cellCount-sized block).
  for (let i = 0; i < cellCount; i++) edits.weights.push(0);
  pushUndo(); item.options.paintEdits = edits;
  regenerateTerrain(item);
  return true;
}
// Applies one paint "dab" at `worldPoint` for the currently active layer.
// Weight is added to the target layer and the OTHER layers at that same
// vertex are proportionally scaled down to keep the total at or below 1 --
// real "painting over" behavior, not each layer independently able to
// exceed full opacity.
function changeTerrainPaintSetting(key, raw) {
  if (playMode || !['radius', 'strength'].includes(key)) return false;
  const value = typeof raw === 'string' && !raw.trim() ? NaN : Number(raw);
  const [min, max] = key === 'radius' ? [0.5, 256] : [0.05, 2];
  if (!Number.isFinite(value) || value < min || value > max) return false;
  paintSettings[key] = value;
  return true;
}

function applyPaintBrush(item, worldPoint) {
  if (playMode || !item || item.kind !== 'terrain' || !placed.includes(item) ||
      !paintDragState || paintDragState.item !== item || !worldPoint ||
      !Number.isFinite(worldPoint.x) || !Number.isFinite(worldPoint.z)) return false;
  const { radius, strength, activeLayer, automask } = paintSettings;
  if (!Number.isFinite(radius) || radius < 0.5 || radius > 256 ||
      !Number.isFinite(strength) || strength < 0.05 || strength > 2 ||
      !Number.isInteger(activeLayer) || activeLayer < 0 || !['off', 'flat', 'steep'].includes(automask)) return false;
  const opts = item.options;
  // Prepare independently: missed/masked/saturated dabs must not author a
  // grid, consume history, or recreate terrain. Historical duplicates may
  // share their original grid; painting detaches without changing that copy.
  const edits = terrainPaintDraft(item);
  const { weights, segments: segs, layers } = edits;
  const verts = segs + 1;
  const cellCount = verts * verts;
  const size = opts.size;
  const lx = worldPoint.x - opts.position.x;
  const lz = worldPoint.z - opts.position.z;
  const targetLayer = activeLayer;
  if (targetLayer >= layers.length) return false;
  let changed = false;
  for (let iz = 0; iz <= segs; iz++) {
    for (let ix = 0; ix <= segs; ix++) {
      const vx = (ix / segs - 0.5) * size;
      const vz = (iz / segs - 0.5) * size;
      const dist = Math.hypot(vx - lx, vz - lz);
      if (dist > radius) continue;
      const falloff = smoothFalloff(dist / radius);
      const idx = iz * verts + ix;
      let maskFactor = 1;
      if (automask !== 'off') {
        // Reads the terrain's OWN already-live handle for slope, the same
        // way the sculpt Flatten/Smooth brushes above already sample
        // `item.handle.sampleHeight` -- one source of truth for "what does
        // this terrain's surface currently look like", not a second normal
        // computation duplicated here.
        const wx = vx + opts.position.x, wz = vz + opts.position.z;
        const normal = item.handle.sampleNormal(wx, wz);
        const slope = 1 - normal.y;
        maskFactor = automask === 'flat' ? Math.max(0, 1 - slope * 2) : Math.min(1, slope * 2);
      }
      const add = strength * falloff * maskFactor * 0.15;
      if (add <= 0) continue;
      const targetIdx = targetLayer * cellCount + idx;
      const newTarget = Math.min(1, (weights[targetIdx] || 0) + add);
      if (newTarget !== (weights[targetIdx] || 0)) changed = true;
      weights[targetIdx] = newTarget;
      const remaining = Math.max(0, 1 - newTarget);
      let othersSum = 0;
      for (let li = 0; li < layers.length; li++) { if (li !== targetLayer) othersSum += weights[li * cellCount + idx] || 0; }
      if (othersSum > remaining && othersSum > 0) {
        const scale = remaining / othersSum;
        for (let li = 0; li < layers.length; li++) { if (li !== targetLayer) {
          const otherIdx = li * cellCount + idx, old = weights[otherIdx] || 0;
          weights[otherIdx] = old * scale;
          if (weights[otherIdx] !== old) changed = true;
        } }
      }
    }
  }
  if (!changed) return false;
  if (!paintDragState.strokeStarted) { pushUndo(); paintDragState.strokeStarted = true; }
  opts.paintEdits = edits;
  regenerateTerrain(item);
  return true;
}

// With more than one island, physics must use whichever terrain the craft
// is actually near, not always the first one placed — otherwise collision/
// hover on the second island would be checked against the first island's
// (far away) heightfield. No position -> first terrain (used for spawn).
function currentTerrainItem(nearPosition) {
  const terrains = placed.filter((item) => item.kind === 'terrain');
  if (terrains.length === 0) return null;
  if (!nearPosition || terrains.length === 1) return terrains[0];
  let closest = terrains[0];
  let closestDist = Infinity;
  for (const item of terrains) {
    const d = Math.hypot(nearPosition.x - item.handle.position.x, nearPosition.z - item.handle.position.z);
    if (d < closestDist) { closestDist = d; closest = item; }
  }
  return closest;
}
function currentWaterItem() {
  return placed.find((item) => item.kind === 'water');
}

const SPAWN_CLEARANCE = 0.55;

// Explicit legacy controller body sizing. Unauthored projects retain the
// historical 1.1m body and radius-based terrain semantics; no automatic migration.
function playerBodyHeight(settings = currentPlayerSettings) {
  const height = settings && settings.collisionHeight;
  return Number.isFinite(height) && height >= 0.1 && height <= 100 ? height : 1.1;
}
function playerTerrainClearance(entity, radius) {
  return Number.isFinite(currentPlayerSettings.collisionHeight) && currentPlayerSettings.collisionHeight >= 0.1 && currentPlayerSettings.collisionHeight <= 100 ? entity.scale.y * 0.5 : radius;
}
function fitPlayerCharacterBody() {
  const s = currentPlayerSettings, visual = s.visual;
  if (s.controllerType !== 'thirdperson' || visual?.mode !== 'skinned' || !visual.assetId) return null;
  const asset = findAssetById(visual.assetId), scale = visual.scale == null ? 1 : visual.scale;
  if (asset?.type !== 'skinnedMesh' || !asset.positions?.length || !Number.isFinite(scale) || scale <= 0) return null;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < asset.positions.length; i += 3) {
    const y = asset.positions[i];
    if (!Number.isFinite(y)) return null;
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const height = (maxY - minY) * scale;
  if (height < 0.1 || height > 100) return null;
  return { collisionHeight: height, visual: { ...visual, followBodyHeight: true,
    positionOffset: { ...(visual.positionOffset || { x: 0, z: 0 }), y: -height * 0.5 - minY * scale } } };
}

function findDefaultSpawnPointItem() {
  return placed.find((p) => p.isSpawnPoint && p.isDefaultSpawn) || placed.find((p) => p.isSpawnPoint) || null;
}

// Highest solid cube's top surface whose XZ footprint (axis-aligned --
// consistent with how every other footprint-based query in this editor,
// e.g. Trigger Volume radius, already treats rotation as out of scope)
// contains (x, z). Returns null if nothing solid covers that point at all.
// This is what API-FRICTION #51 flagged as missing: a Start Platform used
// as a level's actual ground previously had to be hand-positioned so its
// top happened to sit at the terrain-less default of world Y=0.
function findSolidGroundTopAt(x, z) {
  let best = null;
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.solid) continue;
    const pos = item.entity.position, scale = item.entity.scale;
    const halfX = scale.x / 2, halfZ = scale.z / 2;
    if (x < pos.x - halfX || x > pos.x + halfX || z < pos.z - halfZ || z > pos.z + halfZ) continue;
    const top = pos.y + scale.y / 2;
    if (best === null || top > best) best = top;
  }
  return best;
}

// Wave 4: generalized in priority order rather than layering more special
// cases onto a function that used to assume every game starts on an island
// (see API-FRICTION.md for the full before/after). The generalized Player
// system owns spawn behavior end to end now:
//   1. an explicit, author-placed default Spawn Point -- always wins outright
//   2. a solid authored platform/ground under the fallback XZ
//   3. terrain-derived height at that XZ (the original sole behavior)
//   4. a safe fixed default, for a level with no Spawn Point/solid/terrain at all
function computeSpawnPoint() {
  const clearance = ['thirdperson', 'firstperson'].includes(currentPlayerSettings.controllerType) ? playerBodyHeight() * 0.5 : SPAWN_CLEARANCE;
  const spawnPointItem = findDefaultSpawnPointItem();
  if (spawnPointItem) return spawnPointItem.entity.position.clone().add(new Opus.Vec3(0, clearance, 0));

  const terrainItem = currentTerrainItem();
  const waterItem = currentWaterItem();
  // Sample at the terrain's own center, not world (0,0) — with more than one
  // island, (0,0) may not be on any terrain at all (e.g. open water between them).
  const spawnX = terrainItem ? terrainItem.handle.position.x : 0;
  const spawnZ = terrainItem ? terrainItem.handle.position.z : 0;

  const solidTop = findSolidGroundTopAt(spawnX, spawnZ);
  if (solidTop !== null) {
    const waterY = waterItem ? waterItem.handle.position.y : -Infinity;
    return new Opus.Vec3(spawnX, Math.max(solidTop, waterY) + clearance, spawnZ);
  }

  if (terrainItem) {
    const groundY = terrainItem.handle.sampleHeight(spawnX, spawnZ);
    const waterY = waterItem ? waterItem.handle.position.y : -Infinity;
    return new Opus.Vec3(spawnX, Math.max(groundY, waterY) + clearance, spawnZ);
  }

  if (waterItem) return new Opus.Vec3(spawnX, waterItem.handle.position.y + clearance, spawnZ);

  return new Opus.Vec3(0, 1, 0);
}

function spawnHovercraftController(position) {
  craft = app.addEntity({ mesh: cubeMesh, color: [0.08, 0.42, 0.85], position: position.clone(), scale: new Opus.Vec3(1.25, 0.28, 1.9) });
  craftParts = [];
  const addPart = (color, scale, offset) => {
    const entity = app.addEntity({ mesh: cubeMesh, color, position: position.clone(), scale });
    craftParts.push({ entity, offset });
  };
  addPart([0.35, 0.75, 1], new Opus.Vec3(0.72, 0.28, 0.78), new Opus.Vec3(0, 0.32, -0.22)); // cockpit
  addPart([0.08, 0.12, 0.18], new Opus.Vec3(0.28, 0.2, 1.65), new Opus.Vec3(-0.78, -0.12, 0)); // pad
  addPart([0.08, 0.12, 0.18], new Opus.Vec3(0.28, 0.2, 1.65), new Opus.Vec3(0.78, -0.12, 0)); // pad
  addPart([1, 0.3, 0.08], new Opus.Vec3(0.24, 0.24, 0.38), new Opus.Vec3(-0.42, 0.12, -1.02)); // thruster
  addPart([1, 0.3, 0.08], new Opus.Vec3(0.24, 0.24, 0.38), new Opus.Vec3(0.42, 0.12, -1.02)); // thruster
  addPart([0.8, 0.9, 1], new Opus.Vec3(0.75, 0.08, 0.22), new Opus.Vec3(0, 0.02, 1.08)); // stabilizer
  addPart([0.38, 0.24, 0.12], new Opus.Vec3(0.72, 0.08, 0.55), new Opus.Vec3(0, 0.34, 0.62)); // cargo deck

  craftVelocity = new Opus.Vec3();
  craftSteering = 0;
  craftBoostActive = 0;
  craftBoostCooldown = 0;

  craftExhaust = app.createEmitter({ position: position.clone(), rate: 10, life: [0.25, 0.65], riseSpeed: [0.1, 0.4], spread: 0.32, size: [0.06, 0.16], color: [0.3, 0.65, 1], gravity: -0.1, maxParticles: 90 });
  craftSpray = app.createEmitter({ position: position.clone(), rate: 0, life: [0.35, 0.75], riseSpeed: [0.6, 1.3], spread: 0.8, size: [0.08, 0.2], color: [0.8, 0.95, 1], gravity: -0.7, maxParticles: 90 });
  craftFoam = app.createEmitter({ position: position.clone(), rate: 0, life: [0.25, 0.5], riseSpeed: [0.03, 0.12], spread: 1.15, size: [0.12, 0.24], color: [0.94, 1, 1], gravity: 0, maxParticles: 70 });

  app.camera.setTarget(craft);
  app.camera.setChaseOptions({ distance: 7.6, height: 3.2, pitch: 0.2, lerpSpeed: 6.5, rotationLerpSpeed: 8.5, lookAhead: 1.2 });
  app.camera.setMode('chase');

  app.audio.startEngineHum();

  if (isTouchDevice) {
    document.getElementById('touch-controls').classList.add('visible');
  }

  player = {
    controllerType: 'hovercraft',
    entity: craft,
    radius: 0.55,
    get velocity() { return craftVelocity; },
    set velocity(v) { craftVelocity = v; },
  };
}

function despawnHovercraftController() {
  if (!craft) return;
  app.scene.remove(craft);
  for (const part of craftParts) app.scene.remove(part.entity);
  craftParts = [];
  app.removeEmitter(craftExhaust);
  app.removeEmitter(craftSpray);
  app.removeEmitter(craftFoam);
  craft = null;
  craftExhaust = craftSpray = craftFoam = null;
  app.camera.setTarget(null);
  app.camera.setMode('orbit');
  app.audio.stopEngineHum();
  document.getElementById('touch-controls').classList.remove('visible');
  player = null;
}

function updateCraftParts() {
  const c = Math.cos(craft.rotationY);
  const s = Math.sin(craft.rotationY);
  for (const item of craftParts) {
    const offset = item.offset;
    item.entity.position.set(
      craft.position.x + offset.x * c + offset.z * s,
      craft.position.y + offset.y,
      craft.position.z - offset.x * s + offset.z * c
    );
    item.entity.rotationY = craft.rotationY;
  }
}

// Returns the craft's position before this frame's movement, for swept
// trigger and solid-collider checks. The handling profile is authored via
// player settings, like every other controller, rather than hiding a much
// faster fixed 16/24-unit cap behind an ignored `moveSpeed` field.
function updateHovercraftController(dt, elapsed) {
  if (!craft) return null;
  const input = app.input;
  const settings = currentPlayerSettings;
  const moveSpeed = settings.moveSpeed || 11;
  const accelerationRate = settings.acceleration || 10;
  const steeringRate = settings.steeringRate || 1.6;
  const boostImpulse = settings.boostImpulse || 4.5;
  const boostAcceleration = settings.boostAcceleration || 6;
  const boostMaxSpeed = settings.boostMaxSpeed || Math.max(moveSpeed + 5, moveSpeed * 1.45);
  const drag = settings.drag || 0.72;

  // Input Actions (Wave 5, Priority D): Move Forward/Back/Left/Right and
  // Jump (here, Boost) now go through the rebindable map, defaulting to
  // the exact keys this controller always hardcoded -- Arrow keys stay a
  // permanent secondary binding alongside whatever the primary is rebound
  // to, so a player who's used to arrows never loses them.
  if (inputActionDown('moveForward','ArrowUp') || inputActionDown('moveBack','ArrowDown') || inputActionDown('moveLeft','ArrowLeft') || inputActionDown('moveRight','ArrowRight') || inputActionDown('jump')) {
    document.getElementById('controls-hint').classList.remove('visible');
  }

  const throttle = (inputActionDown('moveForward','ArrowUp') ? 1 : 0) - (inputActionDown('moveBack','ArrowDown') ? 0.55 : 0);
  const steerInput = (inputActionDown('moveLeft','ArrowLeft') ? 1 : 0) - (inputActionDown('moveRight','ArrowRight') ? 1 : 0);
  const tapForward = inputActionWasPressed('moveForward','ArrowUp');
  const tapReverse = inputActionWasPressed('moveBack','ArrowDown');
  const tapLeft = inputActionWasPressed('moveLeft','ArrowLeft');
  const tapRight = inputActionWasPressed('moveRight','ArrowRight');

  craftSteering += (steerInput * steeringRate - craftSteering) * Math.min(1, dt * 5);
  if (tapLeft) craftSteering += steeringRate * 0.28;
  if (tapRight) craftSteering -= steeringRate * 0.28;
  const speedRatio = Math.min(1, craftVelocity.length() / moveSpeed);
  craft.rotationY += craftSteering * (0.35 + speedRatio * 0.85) * dt;

  if (inputActionWasPressed('jump') && craftBoostCooldown <= 0) {
    craftBoostActive = 0.8;
    craftBoostCooldown = 4;
    craftVelocity = craftVelocity.add(new Opus.Vec3(Math.sin(craft.rotationY), 0, Math.cos(craft.rotationY)).scale(boostImpulse));
    app.audio.playBlip({ frequency: 220, duration: 0.2, type: 'sawtooth' });
  }
  craftBoostActive = Math.max(0, craftBoostActive - dt);
  craftBoostCooldown = Math.max(0, craftBoostCooldown - dt);

  const forward = new Opus.Vec3(Math.sin(craft.rotationY), 0, Math.cos(craft.rotationY));
  const right = new Opus.Vec3(Math.cos(craft.rotationY), 0, -Math.sin(craft.rotationY));
  const acceleration = throttle * accelerationRate + (craftBoostActive > 0 ? boostAcceleration : 0);
  craftVelocity = craftVelocity.add(forward.scale(acceleration * dt));
  if (tapForward) craftVelocity = craftVelocity.add(forward.scale(accelerationRate * 0.08));
  if (tapReverse) craftVelocity = craftVelocity.sub(forward.scale(accelerationRate * 0.05));
  const lateral = craftVelocity.dot(right);
  craftVelocity = craftVelocity.sub(right.scale(lateral * Math.min(1, dt * 2.8)));
  craftVelocity = craftVelocity.scale(Math.exp(-drag * dt));
  const cap = craftBoostActive > 0 ? boostMaxSpeed : moveSpeed;
  if (craftVelocity.length() > cap) craftVelocity = craftVelocity.scale(cap / craftVelocity.length());

  const previousPosition = craft.position.clone();
  craft.position = craft.position.add(craftVelocity.scale(dt));

  const terrainItem = currentTerrainItem(craft.position);
  const waterItem = currentWaterItem();

  if (terrainItem) {
    const collision = Opus.Physics.resolveTerrainCollision(craft.position, craftVelocity, 0.55, terrainItem.options);
    if (collision.collided) {
      craft.position = collision.correctedPosition;
      craftVelocity = collision.correctedVelocity;
    }
  }
  // Solid objects (opt-in per item, most cubes stay pass-through -- crates/
  // hazards/triggers are meant to be driven into) physically block the
  // craft, horizontally only, same XZ-only reasoning as
  // Physics.resolveBoxCollision itself. An invisible solid object doesn't
  // block -- this is deliberate, not an oversight: it means Show/Hide
  // Object doubles as a real door mechanic (hide it to open it) with no
  // separate "unlock" action needed.
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.solid || !item.entity.visible) continue;
    const solidCollision = resolveItemColliderCollision(craft.position, craftVelocity, 0.55, item, previousPosition);
    if (solidCollision.collided) {
      craft.position = solidCollision.correctedPosition;
      craftVelocity = solidCollision.correctedVelocity;
    }
  }
  const boundary = applyPlayerPlayBounds(craft.position, craftVelocity, 0.55);
  craft.position = boundary.correctedPosition;
  craftVelocity = boundary.correctedVelocity;
  if (boundary.warning) showToast('MAP EDGE — TURN INWARD');
  const reconciled = reconcilePlayerWallContacts(craft.position, craftVelocity, .55, previousPosition, null);
  craft.position = reconciled.correctedPosition;
  craftVelocity = reconciled.correctedVelocity;

  const terrainHeight = terrainItem ? terrainItem.handle.sampleHeight(craft.position.x, craft.position.z) : 0;
  const waterHeight = waterItem ? waterItem.handle.sampleHeight(craft.position.x, craft.position.z, elapsed) : -Infinity;
  let hoverTarget;
  if (waterItem) {
    const shore = Math.max(0, Math.min(1, terrainHeight - waterHeight + 0.5));
    const blend = shore * shore * (3 - 2 * shore);
    const surface = waterHeight + (terrainHeight - waterHeight) * blend;
    hoverTarget = surface + 0.55 + Math.sin(elapsed * 4.2) * 0.035;
  } else {
    hoverTarget = terrainHeight + 0.55;
  }
  craft.position.y += (hoverTarget - craft.position.y) * Math.min(1, dt * 8);
  updateCraftParts();

  const speed = craftVelocity.length();
  app.audio.updateEngineHum(speed / cap, 0.08 + Math.abs(throttle) * 0.3);
  const rear = craft.position.sub(forward.scale(1.1));
  craftExhaust.position = new Opus.Vec3(rear.x, rear.y + 0.05, rear.z);
  craftExhaust.rate = 8 + Math.abs(throttle) * 42 + (craftBoostActive > 0 ? 55 : 0);
  const overWater = !!waterItem && terrainHeight < waterHeight + 0.15;
  craftSpray.position = craft.position.clone();
  craftFoam.position = craft.position.clone();
  craftSpray.rate = overWater ? speed * 2.5 : 0;
  craftFoam.rate = overWater && speed > 2 ? 18 : 0;

  return previousPosition;
}

