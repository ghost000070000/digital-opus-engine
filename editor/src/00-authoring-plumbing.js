// Digital Opus bounded authoring plumbing: typed references, project
// validation, and asset-type declarations. This module is authoring-only;
// import decoding, runtime behavior, and export execution remain elsewhere.
(function (root, factory) {
   'use strict';
   const api = factory(typeof module !== 'undefined' && module.exports ? require('./00-authoring-schema.js') : root.OpusAuthoring, typeof module !== 'undefined' && module.exports ? require('./00-collision-filter-2d.js') : root.OpusCollisionFilter2D);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
   else root.OpusAuthoringPlumbing = api;
})(typeof window !== 'undefined' ? window : this, function (authoring, Filters) {
  'use strict';

  const REFERENCE_TYPES = Object.freeze(['asset', 'object', 'level', 'objective', 'prefab', 'sortingLayer', 'item', 'inputAction']);
  const DEFAULT_SPRITE_SORTING_LAYER_ID = 'sprite-layer-default';
  const DEFAULT_SPRITE_FRAME_DURATION_MS = 100;
  const MAX_SPRITE_FRAME_DURATION_MS = 60000;
  const MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE = 1024;
  const SPRITE_ANIMATION_PLAYBACK_MODES = Object.freeze(['once', 'loop']);
  const SPRITE_DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right']);
  const SPRITE_DIRECTION_VALUES = Object.freeze(['none', ...SPRITE_DIRECTIONS]);
  const TILE_COLLISION_MODES = Object.freeze(['none', 'full-cell', 'custom-rect', 'slope']);
  const SEVERITIES = Object.freeze(['error', 'warning', 'info']);
  const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const normalizeMime = (value) => String(value || '').split(';')[0].trim().toLowerCase();
  const normalizeExtension = (value) => {
    const text = String(value || '').trim().toLowerCase();
    return text && (text.startsWith('.') ? text : `.${text}`);
  };
  const issue = (input) => ({
    severity: 'error', code: 'authoring-issue', message: 'Authoring issue', scope: 'project',
    objectId: null, componentId: null, field: null, referenceType: null, referenceValue: null,
    levelId: null, prefabName: null, assetId: null, ...input,
  });

  class AssetTypeRegistry {
    constructor() { this._types = new Map(); }
    register(definition) {
      if (!definition || !/^[a-z][a-z0-9-]*$/.test(definition.id || '')) throw new Error('Asset type needs a stable lowercase id');
      if (this._types.has(definition.id)) throw new Error(`Asset type "${definition.id}" is already registered`);
      if (!definition.displayName || !definition.category) throw new Error(`Asset type "${definition.id}" needs displayName and category`);
      const type = Object.freeze({
        mimeTypes: [], extensions: [], metadataDefaults: {}, serializerOwner: definition.id,
        library: { icon: '◇', order: 0 }, validateMetadata: () => [], dependencies: () => [],
        ...definition,
        mimeTypes: Object.freeze((definition.mimeTypes || []).map(normalizeMime).filter(Boolean)),
        extensions: Object.freeze((definition.extensions || []).map(normalizeExtension).filter(Boolean)),
      });
      this._types.set(type.id, type);
      return type;
    }
    get(id) { return this._types.get(id) || null; }
    listTypes(filter) {
      return [...this._types.values()].filter((type) => !filter || !filter.category || type.category === filter.category)
        .sort((a, b) => a.library.order - b.library.order || a.id.localeCompare(b.id));
    }
    findForFile(filename, mimeType) {
      const mime = normalizeMime(mimeType);
      const match = /(?:^|\/)([^/]+)$/.exec(String(filename || ''));
      const dot = match && match[1].lastIndexOf('.');
      const ext = dot >= 0 ? normalizeExtension(match[1].slice(dot)) : '';
      return this.listTypes().find((type) => (mime && type.mimeTypes.includes(mime)) || (ext && type.extensions.includes(ext))) || null;
    }
    resolveType(asset, collectionType) {
      const raw = collectionType || (asset && (asset.assetType || asset.type));
      if (raw === 'skinnedMesh') return this.get('mesh');
      return this.get(raw) || null;
    }
    validate(asset, collectionType) {
      const type = this.resolveType(asset, collectionType);
      if (!type) return [issue({ severity: 'warning', code: 'unknown-asset-type', message: `Unknown asset type "${collectionType || (asset && asset.type) || ''}" is preserved.`, scope: 'asset', assetId: asset && asset.id })];
      return (type.validateMetadata(asset || {}) || []).map((entry) => issue({ scope: 'asset', assetId: asset && asset.id, ...entry }));
    }
    getDependencies(asset, collectionType) {
      const type = this.resolveType(asset, collectionType);
      return type ? (type.dependencies(asset || {}) || []).map((entry) => ({ assetType: entry.assetType, id: entry.id })) : [];
    }
  }

  const assetTypes = new AssetTypeRegistry();
  assetTypes.register({
    id: 'mesh', displayName: 'Mesh', category: 'Geometry', mimeTypes: ['model/gltf+json', 'model/gltf-binary', 'application/json'], extensions: ['.gltf', '.glb', '.json'],
    library: { icon: '◆', order: 100 }, compatibilityAdapter: (asset) => ({ ...asset, assetType: 'mesh' }),
    validateMetadata: (asset) => !asset.id || !asset.name ? [{ code: 'invalid-asset-metadata', message: 'Mesh assets require a stable id and display name.' }] : [],
  });
  assetTypes.register({
    id: 'texture', displayName: 'Texture', category: 'Images', mimeTypes: ['image/png', 'image/jpeg', 'image/webp'], extensions: ['.png', '.jpg', '.jpeg', '.webp'],
    library: { icon: '▧', order: 200 }, metadataDefaults: { colorSpace: 'srgb' }, compatibilityAdapter: (asset) => ({ ...asset, assetType: 'texture' }),
    validateMetadata: (asset) => !asset.id || !asset.name || !asset.dataURL ? [{ code: 'invalid-asset-metadata', message: 'Texture assets require id, name, and source image data.' }] : [],
  });
  assetTypes.register({
    id: 'sprite', displayName: 'Sprite', category: 'Images', version: 4, sourceType: 'texture',
    library: { icon: '▣', order: 250 }, metadataDefaults: { version: 4, pivot: [0.5, 0.5], pixelsPerUnit: 100, filtering: 'linear', sourceRect: null, nineSlice: null },
    serializerOwner: 'sprite', dependencies: (asset) => asset.sourceTexture ? [{ assetType: 'texture', id: asset.sourceTexture }] : [],
    validateMetadata: (asset) => {
      const problems = [];
      if (!asset.id || !asset.name) problems.push({ code: 'invalid-asset-metadata', message: 'Sprite assets require a stable id and display name.' });
      if (!asset.sourceTexture) problems.push({ code: 'sprite-source-required', message: 'Sprite Asset requires a source Texture.' });
      if (asset.version !== 4) problems.push({ code: 'sprite-version-unsupported', message: 'Sprite Asset metadata version must be 4.' });
      if (!['linear', 'nearest'].includes(asset.filtering)) problems.push({ code: 'sprite-filtering-mode', message: 'Sprite Asset Sampling must be Smooth or Pixel / Nearest.' });
      if (!Number.isFinite(asset.pixelsPerUnit) || asset.pixelsPerUnit <= 0) problems.push({ code: 'sprite-ppu-positive', message: 'Pixels Per Unit must be finite and greater than 0.' });
      if (!Array.isArray(asset.pivot) || asset.pivot.length !== 2 || asset.pivot.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) problems.push({ code: 'sprite-pivot-range', message: 'Sprite Asset pivot values must be between 0 and 1.' });
      if (asset.sourceRect != null) {
        const rect = asset.sourceRect;
        if (!isObject(rect) || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)
          || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0) problems.push({ code: 'sprite-source-rect-invalid', message: 'Source Region requires non-negative X/Y and positive Width/Height in pixels.' });
      }
      if (asset.nineSlice != null) {
        const guides = asset.nineSlice;
        if (!isObject(guides) || ['left', 'right', 'top', 'bottom'].some((key) => !Number.isFinite(guides[key]) || guides[key] < 0)) problems.push({ code: 'sprite-nine-slice-invalid', message: 'Nine-Slice Guides require finite, non-negative Left, Right, Top, and Bottom pixel values.' });
      }
      return problems;
    },
  });
  assetTypes.register({
    id: 'sprite-animation', displayName: 'Sprite Animation Clip', category: 'Animation', version: 3, sourceType: 'sprite',
    library: { icon: '▶', order: 275 }, metadataDefaults: { version: 3, frames: [], playbackMode: 'once' }, serializerOwner: 'sprite-animation',
    dependencies: (asset) => (asset.frames || []).filter((frame) => frame && frame.spriteAsset).map((frame) => ({ assetType: 'sprite', id: frame.spriteAsset })),
    validateMetadata: (asset) => {
      const problems = [];
      if (!asset.id || !asset.name) problems.push({ code: 'invalid-asset-metadata', message: 'Sprite Animation Clips require a stable id and display name.' });
      if (asset.version !== 3) problems.push({ code: 'sprite-animation-version-unsupported', message: 'Sprite Animation Clip metadata version must be 3.' });
      if (!SPRITE_ANIMATION_PLAYBACK_MODES.includes(asset.playbackMode)) problems.push({ code: 'sprite-animation-playback-mode', message: 'Sprite Animation Playback must be Once or Loop.' });
      if (!Array.isArray(asset.frames) || asset.frames.length === 0) problems.push({ code: 'sprite-animation-empty', message: 'Sprite Animation Clip needs at least one frame before it can play.' });
      for (let index = 0; index < (Array.isArray(asset.frames) ? asset.frames.length : 0); index++) {
        const frame = asset.frames[index] || {};
        if (!frame.spriteAsset) problems.push({ code: 'sprite-animation-frame-source-required', message: `Frame ${index + 1} requires a Sprite Asset.` });
        if (!Number.isFinite(frame.durationMs) || frame.durationMs <= 0 || frame.durationMs > MAX_SPRITE_FRAME_DURATION_MS) problems.push({ code: 'sprite-animation-frame-duration', message: `Frame ${index + 1} duration must be finite and between 1 and ${MAX_SPRITE_FRAME_DURATION_MS} ms.` });
        const ids = new Set(); const names = new Set();
        for (const event of frame.events || []) {
          const eventId = String(event && event.id || ''); const eventName = String(event && event.name || '').trim();
          if (!eventId) problems.push({ code: 'sprite-animation-event-id-required', message: `Frame ${index + 1} has an Animation Event without a stable ID.` });
          else if (ids.has(eventId)) problems.push({ code: 'duplicate-sprite-animation-event-id', message: `Frame ${index + 1} repeats Animation Event ID "${eventId}".` });
          if (!eventName) problems.push({ code: 'sprite-animation-event-name-required', message: `Frame ${index + 1} has an Animation Event without a name.` });
          ids.add(eventId); names.add(eventName.toLowerCase());
        }
      }
      const allEvents = (asset.frames || []).flatMap((frame) => frame.events || []); const clipIds = new Set(); const clipNames = new Set();
      for (const event of allEvents) { const id = String(event && event.id || ''); const name = String(event && event.name || '').trim().toLowerCase(); if (id && clipIds.has(id)) problems.push({ code: 'duplicate-sprite-animation-event-id', message: `Sprite Animation Clip repeats Animation Event ID "${id}".` }); if (name && clipNames.has(name)) problems.push({ severity: 'warning', code: 'duplicate-sprite-animation-event-name', message: `Sprite Animation Clip repeats Animation Event name "${event.name}".` }); clipIds.add(id); clipNames.add(name); }
      return problems;
    },
  });
  assetTypes.register({
    id: 'tileset', displayName: 'Tileset', category: 'World Building', version: 6, sourceType: 'sprite',
    library: { icon: '▦', order: 290 }, metadataDefaults: { version: 6, cellSize: { width: 1, height: 1 }, tiles: [], autoTileSets: [], terrainBrushes: [] }, serializerOwner: 'tileset',
    dependencies: (asset) => (Array.isArray(asset.tiles) ? asset.tiles : []).filter((tile) => tile && tile.spriteAssetRef).map((tile) => ({ assetType: 'sprite', id: tile.spriteAssetRef })),
    validateMetadata: (asset) => {
      const problems = [];
      if (!asset || !asset.id || !String(asset.name || '').trim()) problems.push({ code: 'invalid-asset-metadata', message: 'Tilesets require a stable Asset ID and display name.' });
      if (!asset || asset.version !== 6) problems.push({ code: 'tileset-version-unsupported', message: 'Tileset metadata version must be 6.' });
      const cell = asset && asset.cellSize || {};
      if (!Number.isFinite(cell.width) || cell.width <= 0) problems.push({ code: 'tileset-cell-width-positive', field: 'cellSize.width', message: 'Tileset Cell Width must be finite and greater than 0 world units.' });
      if (!Number.isFinite(cell.height) || cell.height <= 0) problems.push({ code: 'tileset-cell-height-positive', field: 'cellSize.height', message: 'Tileset Cell Height must be finite and greater than 0 world units.' });
      if (!Array.isArray(asset && asset.tiles)) { problems.push({ code: 'tileset-tiles-invalid', field: 'tiles', message: 'Tileset Tiles must be an ordered list.' }); return problems; }
      const ids = new Set(); const names = new Set();
      asset.tiles.forEach((tile, index) => {
        const id = String(tile && tile.id || ''); const name = String(tile && tile.name || '').trim(); const folded = name.toLowerCase();
        if (!id) problems.push({ code: 'tileset-tile-id-required', tileId: null, field: `tiles[${index}].id`, message: `Tile ${index + 1} requires a stable local ID.` });
        else if (ids.has(id)) problems.push({ code: 'duplicate-tileset-tile-id', tileId: id, field: `tiles[${index}].id`, message: `Tileset repeats local Tile ID "${id}".` });
        if (!name) problems.push({ code: 'tileset-tile-name-required', tileId: id || null, field: `tiles[${index}].name`, message: `Tile ${index + 1} requires a display name.` });
        else if (names.has(folded)) problems.push({ code: 'duplicate-tileset-tile-name', tileId: id || null, field: `tiles[${index}].name`, message: `Tileset repeats Tile name "${name}".` });
        for (const collisionIssue of validateTileCollision(tile && tile.collision)) problems.push({ tileId: id || null, field: `tiles[${index}].collision`, ...collisionIssue });
        ids.add(id); if (name) names.add(folded);
      });
      problems.push(...validateAutoTileSets(asset));
      problems.push(...validateTerrainBrushes(asset));
      return problems;
    },
  });
  assetTypes.register({
    id: 'tilemap-chunk', displayName: 'Tilemap Chunk', category: 'World Building', version: 1, sourceType: 'tileset',
    library: { icon: '▦', order: 295 }, metadataDefaults: { version: 1, width: 1, height: 1, layers: [], spawnMarkers: [] }, serializerOwner: 'tilemap-chunk',
    dependencies: (asset) => tilemapChunkDependencies(asset),
    validateMetadata: (asset) => validateTilemapChunk(asset),
  });
  assetTypes.register({
    id: 'audio', displayName: 'Audio', category: 'Audio', mimeTypes: ['audio/wav', 'audio/mpeg', 'audio/ogg'], extensions: ['.wav', '.mp3', '.ogg'],
    library: { icon: '♪', order: 300 }, compatibilityAdapter: (asset) => ({ ...asset, assetType: 'audio' }),
    validateMetadata: (asset) => !asset.id || !asset.name || !asset.dataURL ? [{ code: 'invalid-asset-metadata', message: 'Audio assets require id, name, and encoded source data.' }] : [],
  });

  function normalizedAssets(context) {
    const out = [];
    for (const [items, type] of [[context.assets || [], 'mesh'], [context.textures || [], 'texture'], [context.sprites || context.spriteAssets || [], 'sprite'], [context.spriteAnimations || [], 'sprite-animation'], [context.tilesets || [], 'tileset'], [context.tilemapChunks || [], 'tilemap-chunk'], [context.audio || [], 'audio']]) {
      for (const asset of items) out.push({ value: asset.id, label: asset.name || asset.id, assetType: type, source: asset });
    }
    return out;
  }
  function allObjects(context) {
    if (Array.isArray(context.objects)) return context.objects;
    return (context.levels || []).flatMap((level) => (level.objects || []).map((object) => ({ ...object, _levelId: level.id })));
  }
  function allObjectives(context) {
    if (Array.isArray(context.objectives)) return context.objectives;
    return (context.levels || []).flatMap((level) => (level.objectiveDefs || []).map((objective) => ({ ...objective, _levelId: level.id })));
  }
  function getReferenceOptions(type, context, descriptor) {
    const meta = descriptor || {};
    let rows = [];
    if (type === 'asset') {
      rows = normalizedAssets(context);
      if (meta.allowedAssetTypes && meta.allowedAssetTypes.length) rows = rows.filter((row) => meta.allowedAssetTypes.includes(row.assetType));
    } else if (type === 'object') {
      rows = allObjects(context).filter((object) => meta.allowSelf !== false || object.id !== context.currentObjectId)
        .filter((object) => meta.scope !== 'current-level' || !object._levelId || object._levelId === context.currentLevelId)
        .map((object, index) => ({ value: object.id, label: object.name || `${object.kind || 'Object'} ${index + 1}`, source: object }));
    } else if (type === 'level') rows = (context.levels || []).map((level) => ({ value: level.id, label: level.name || level.id, source: level }));
    else if (type === 'objective') rows = allObjectives(context).filter((objective) => meta.scope !== 'current-level' || !objective._levelId || objective._levelId === context.currentLevelId).map((objective) => ({ value: objective.id, label: objective.title || objective.name || objective.id, source: objective }));
    else if (type === 'prefab') rows = (context.prefabs || []).map((prefab) => ({ value: prefab.name, label: prefab.name, source: prefab }));
    else if (type === 'item') rows = (context.itemDefs || []).filter(def => def && def.id).map(def => ({ value: def.id, label: def.name || def.id, source: def }));
    else if (type === 'inputAction') rows = (context.inputActions || []).filter(action => action && typeof action.id === 'string' && action.id).map(action => ({ value: action.id, label: action.name || action.id, source: action }));
    else if (type === 'sortingLayer') rows = (context.sortingLayers || context.spriteSortingLayers || []).slice().sort((a, b) => Number(a.order) - Number(b.order) || String(a.id).localeCompare(String(b.id))).map((layer) => ({ value: layer.id, label: layer.name || layer.id, source: layer }));
    else if (type === 'parallaxLayer') rows = (context.parallaxLayers || []).map((layer) => ({ value: layer.id, label: layer.name || layer.id, source: layer }));
    else if (type === 'collisionLayer') rows = Filters.normalizeLayers(context.collisionLayers).slice().sort((a, b) => a.order - b.order).map((layer) => ({ value: layer.id, label: layer.name, source: layer }));
    const present = rows.filter((row) => row.value != null);
    return type === 'sortingLayer' || type === 'collisionLayer' ? present : present.sort((a, b) => String(a.label).localeCompare(String(b.label)) || String(a.value).localeCompare(String(b.value)));
  }

  function addIdentity(map, duplicates, type, value, source) {
    if (!value) return;
    if (map.has(value)) duplicates.push({ type, value, first: map.get(value), duplicate: source });
    else map.set(value, source);
  }
  function buildReferenceIndex(project, options) {
    const opts = options || {};
    const levels = Array.isArray(project) ? [{ id: 'legacy-level', name: 'Level 1', objects: project }] : (project.levels || []);
    const maps = { asset: new Map(), object: new Map(), level: new Map(), objective: new Map(), prefab: new Map(), item: new Map(), sortingLayer: new Map(), parallaxLayer: new Map(), collisionLayer: new Map(Filters.normalizeLayers(project.collisionLayers).map((layer) => [layer.id, layer])) };
    const duplicates = [];
    const uses = [];
    // The host supplies its canonical built-in/custom Action registry. This
    // authoring module must not invent a second set of gameplay bindings.
    maps.inputAction = new Map();
    for (const action of opts.inputActions || []) if (action && typeof action.id === 'string') addIdentity(maps.inputAction, duplicates, 'inputAction', action.id, action);
    function collectComponentUses(object, location) {
      for (const [componentId, record] of Object.entries(object.components || {})) {
        const schema = opts.schemaRegistry && opts.schemaRegistry.get(componentId);
        if (!schema) continue;
        for (const field of schema.fields.filter((entry) => entry.referenceType)) uses.push({
          referenceType: field.referenceType, referenceValue: record[field.key], descriptor: field,
          scope: location.prefabName ? 'prefab-component' : 'component', componentId, field: field.key,
          owner: record, key: field.key, ...location,
        });
        if (componentId === 'sprite-renderer') for (const state of normalizeSpriteAnimationStates(record.animationStates)) {
          uses.push({
            referenceType: 'asset', referenceValue: state.clipRef,
            descriptor: { required: true, nullable: false, allowedAssetTypes: ['sprite-animation'] },
            scope: location.prefabName ? 'prefab-component' : 'component', componentId, field: 'animationStates.clipRef',
            owner: state, key: 'clipRef', ...location,
          });
          for (const variant of state.directionalVariants) if (variant.clipRef) uses.push({
            referenceType: 'asset', referenceValue: variant.clipRef,
            descriptor: { required: false, nullable: true, allowedAssetTypes: ['sprite-animation'] },
            scope: location.prefabName ? 'prefab-component' : 'component', componentId, field: `animationStates.directionalVariants.${variant.direction}.clipRef`,
            owner: variant, key: 'clipRef', ...location,
          });
        }
      }
    }
    for (const level of levels) {
      addIdentity(maps.level, duplicates, 'level', level.id, level);
      for (const objective of level.objectiveDefs || []) addIdentity(maps.objective, duplicates, 'objective', objective.id, { ...objective, levelId: level.id });
      for (const object of level.objects || []) {
        addIdentity(maps.object, duplicates, 'object', object.id, { ...object, levelId: level.id });
        collectComponentUses(object, { objectId: object.id, levelId: level.id });
        if (object.kind === 'tilemap') {
          uses.push({
            referenceType: 'asset', referenceValue: object.tilesetRef,
            descriptor: { required: true, nullable: false, allowedAssetTypes: ['tileset'] },
            scope: 'tilemap', objectId: object.id, levelId: level.id, field: 'tilesetRef', owner: object, key: 'tilesetRef',
          });
          uses.push({
            referenceType: 'sortingLayer', referenceValue: object.sortingLayerRef,
            descriptor: { required: true, nullable: false }, scope: 'tilemap', objectId: object.id, levelId: level.id,
            field: 'sortingLayerRef', owner: object, key: 'sortingLayerRef',
          });
        }
      }
    }
    for (const def of project.itemDefs || []) if (def) addIdentity(maps.item, duplicates, 'item', def.id, def);
    const prefabMemberMaps = new Map();
    const prefabAmbiguousMembers = new Map();
    for (const prefab of project.prefabs || []) {
      addIdentity(maps.prefab, duplicates, 'prefab', prefab.name, prefab);
      // Prefab member ids intentionally originate from scene records and
      // therefore do not enter the global object identity map. Their
      // component dependencies still need validation before instantiation.
      const records = prefab.records || (prefab.record ? [prefab.record] : []);
      const members = new Map();
      const ambiguous = new Set();
      for (const object of records) if (object && object.id) {
        if (members.has(object.id)) ambiguous.add(object.id);
        else members.set(object.id,object);
      }
      if (!prefabMemberMaps.has(prefab.name)) { prefabMemberMaps.set(prefab.name,members); prefabAmbiguousMembers.set(prefab.name,ambiguous); }
      for (const object of records) collectComponentUses(object, { objectId: object.id || null, prefabName: prefab.name || null });
    }
    for (const layer of project.spriteSortingLayers || []) addIdentity(maps.sortingLayer, duplicates, 'sortingLayer', layer.id, layer);
    for (const layer of project.parallaxLayers || []) addIdentity(maps.parallaxLayer, duplicates, 'parallaxLayer', layer.id, layer);
    for (const [items, type] of [[project.assets || [], 'mesh'], [project.textures || [], 'texture'], [project.spriteAssets || [], 'sprite'], [project.spriteAnimations || [], 'sprite-animation'], [project.tilesets || [], 'tileset'], [project.tilemapChunks || [], 'tilemap-chunk'], [project.audio || [], 'audio']]) {
      for (const asset of items) addIdentity(maps.asset, duplicates, 'asset', asset.id, { ...asset, assetType: type });
    }
    for (const chunk of project.tilemapChunks || []) {
      uses.push({ referenceType: 'asset', referenceValue: chunk.tilesetRef, descriptor: { required: true, nullable: false, allowedAssetTypes: ['tileset'] }, scope: 'tilemap-chunk', assetId: chunk.id, field: 'tilesetRef', owner: chunk, key: 'tilesetRef' });
      for (const marker of chunk.spawnMarkers || []) if (marker && marker.prefabRef) uses.push({ referenceType: 'prefab', referenceValue: marker.prefabRef, descriptor: { required: true }, scope: 'tilemap-chunk-marker', assetId: chunk.id, field: 'spawnMarkers.prefabRef', owner: marker, key: 'prefabRef', markerId: marker.id || null });
    }
    for (const asset of project.spriteAssets || []) uses.push({
      referenceType: 'asset', referenceValue: asset.sourceTexture,
      descriptor: { nullable: true, allowedAssetTypes: ['texture'] }, scope: 'asset', assetId: asset.id,
      field: 'sourceTexture', owner: asset, key: 'sourceTexture',
    });
    for (const clip of project.spriteAnimations || []) for (let frameIndex = 0; frameIndex < (clip.frames || []).length; frameIndex++) uses.push({
      referenceType: 'asset', referenceValue: clip.frames[frameIndex] && clip.frames[frameIndex].spriteAsset,
      descriptor: { required: true, nullable: false, allowedAssetTypes: ['sprite'] }, scope: 'asset', assetId: clip.id,
      field: `frames[${frameIndex}].spriteAsset`, owner: clip.frames[frameIndex], key: 'spriteAsset',
    });
    for (const tileset of project.tilesets || []) for (let tileIndex = 0; tileIndex < (Array.isArray(tileset.tiles) ? tileset.tiles.length : 0); tileIndex++) uses.push({
      referenceType: 'asset', referenceValue: tileset.tiles[tileIndex] && tileset.tiles[tileIndex].spriteAssetRef,
      descriptor: { required: true, nullable: false, allowedAssetTypes: ['sprite'] }, scope: 'tileset-tile', assetId: tileset.id,
      field: `tiles[${tileIndex}].spriteAssetRef`, owner: tileset.tiles[tileIndex], key: 'spriteAssetRef', tileId: tileset.tiles[tileIndex] && tileset.tiles[tileIndex].id,
    });
    uses.push(...(opts.referenceUses || []));
    const dangling = [];
    for (const use of uses) {
      const value = use.referenceValue;
      const useContext = { scope: use.scope || 'reference', objectId: use.objectId || null, componentId: use.componentId || null, field: use.field || null, referenceType: use.referenceType, referenceValue: value == null ? null : value, levelId: use.levelId || null, prefabName: use.prefabName || null, assetId: use.assetId || null, tileId: use.tileId || null };
      if (use.functionId) useContext.functionId = use.functionId;
      if (use.graphNodeId) useContext.graphNodeId = use.graphNodeId;
      if (Number.isSafeInteger(use.behaviorIndex)) useContext.behaviorIndex = use.behaviorIndex;
      if (value === '' || value === null || value === undefined) {
        if (use.descriptor && use.descriptor.required && !use.descriptor.nullable) dangling.push(issue({ ...useContext, severity: 'error', code: 'required-reference-missing', message: `${use.field || 'Reference'} requires a ${use.referenceType} selection.` }));
        continue;
      }
      // A portable member's saved identity is local to its definition and
      // intentionally absent from the scene-global object map. External
      // scene bindings retain historical lookup; invocation scope is unknown.
      if (use.referenceType === 'object' && use.prefabName && prefabAmbiguousMembers.get(use.prefabName)?.has(value)) {
        dangling.push(issue({ ...useContext, severity: 'error', code: 'ambiguous-reference', message: `${use.field || 'Reference'} points to duplicate member identity "${value}" in this Prefab. Repair the definition before reuse; the saved reference is retained.` }));
        continue;
      }
      const member = use.referenceType === 'object' && use.prefabName ? prefabMemberMaps.get(use.prefabName)?.get(value) : null;
      const target = member || (maps[use.referenceType] && maps[use.referenceType].get(value));
      if (!target) dangling.push(issue({ ...useContext, severity: 'error', code: 'dangling-reference', message: `${use.field || 'Reference'} points to missing ${use.referenceType} "${value}".` }));
      else if (use.descriptor && use.descriptor.scope === 'current-level' && use.levelId && target.levelId && target.levelId !== use.levelId && ['object', 'objective'].includes(use.referenceType)) dangling.push(issue({ ...useContext, severity: 'error', code: 'invalid-reference-scope', message: `${use.field || 'Reference'} points outside this level. Choose an available ${use.referenceType} in the owning level; the saved reference is retained.` }));
      else if (use.referenceType === 'object' && use.descriptor && Array.isArray(use.descriptor.allowedObjectKinds) && !use.descriptor.allowedObjectKinds.includes(target.kind)) dangling.push(issue({ ...useContext, severity: 'error', code: 'invalid-reference-type', message: `${use.field || 'Reference'} requires ${use.descriptor.allowedObjectKinds.join(' or ')}, not ${target.kind || 'this object kind'}. The saved reference is retained.` }));
      else if (use.referenceType === 'asset' && use.descriptor && use.descriptor.allowedAssetTypes && !use.descriptor.allowedAssetTypes.includes(target.assetType)) dangling.push(issue({ ...useContext, severity: 'error', code: 'invalid-reference-type', message: `${use.field || 'Asset'} requires ${use.descriptor.allowedAssetTypes.join(' or ')}, not ${target.assetType}.` }));
    }
    return { maps, uses, dangling, duplicates, levels };
  }

  function collectProjectIssues(project, options) {
    const opts = { schemaRegistry: authoring && authoring.registry, assetRegistry: assetTypes, ...(options || {}) };
    const index = buildReferenceIndex(project, opts);
    const issues = index.dangling.slice();
    const collisionLayers = Filters.normalizeLayers(project.collisionLayers);
    issues.push(...Filters.validateLayers(collisionLayers).map((entry) => issue({ scope: 'project', ...entry })));
    for (const level of index.levels) for (const object of level.objects || []) {
      for (const componentId of ['box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d']) {
        const component = object.components && object.components[componentId];
        if (component && component.version === 2) for (const entry of Filters.validateFilter(component, collisionLayers)) issues.push(issue({ scope: 'component', objectId: object.id, levelId: level.id, componentId, ...entry }));
      }
      if (object.kind === 'tilemap' && object.version >= 6) for (const layer of object.layers || []) for (const entry of Filters.validateFilter(layer, collisionLayers)) issues.push(issue({ scope: 'tilemap', objectId: object.id, levelId: level.id, layerId: layer.id, ...entry }));
    }
    issues.push(...validateSpriteSortingLayers(project.spriteSortingLayers));
    issues.push(...validateParallaxLayers(project.parallaxLayers));
    const componentApi = authoring && opts.schemaRegistry ? authoring.createAuthoringApi(opts.schemaRegistry) : null;
    for (const duplicate of index.duplicates) issues.push(issue({ severity: 'error', code: 'duplicate-identity', message: `Duplicate ${duplicate.type} identity "${duplicate.value}".`, scope: duplicate.type, referenceType: duplicate.type, referenceValue: duplicate.value, objectId: duplicate.type === 'object' ? duplicate.value : null, assetId: duplicate.type === 'asset' ? duplicate.value : null }));
    for (const level of index.levels) for (const object of level.objects || []) for (const componentId of Object.keys(object.components || {})) {
      if (!opts.schemaRegistry.get(componentId)) continue;
      for (const entry of componentApi.validateComponent(object, componentId)) issues.push(issue({ scope: 'component', objectId: object.id, levelId: level.id, ...entry }));
    }
    for (const prefab of project.prefabs || []) {
      const records = prefab.records || (prefab.record ? [prefab.record] : []);
      for (const object of records) for (const componentId of Object.keys(object.components || {})) {
        if (!opts.schemaRegistry.get(componentId)) continue;
        if (['box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d'].includes(componentId) && object.components[componentId].version === 2) for (const entry of Filters.validateFilter(object.components[componentId], collisionLayers)) issues.push(issue({ scope: 'prefab-component', objectId: object.id || null, prefabName: prefab.name || null, componentId, ...entry }));
        for (const entry of componentApi.validateComponent(object, componentId)) issues.push(issue({ scope: 'prefab-component', objectId: object.id || null, prefabName: prefab.name || null, ...entry }));
      }
    }
    for (const [items, type] of [[project.assets || [], 'mesh'], [project.textures || [], 'texture'], [project.spriteAssets || [], 'sprite'], [project.spriteAnimations || [], 'sprite-animation'], [project.tilesets || [], 'tileset'], [project.tilemapChunks || [], 'tilemap-chunk'], [project.audio || [], 'audio']]) for (const asset of items) issues.push(...opts.assetRegistry.validate(asset, type));
    for (const chunk of project.tilemapChunks || []) {
      const tileset = (project.tilesets || []).find((entry) => entry.id === chunk.tilesetRef);
      for (const entry of validateTilemapChunk(chunk, tileset, project.prefabs)) issues.push(issue({ scope: 'asset', assetId: chunk.id, ...entry }));
    }
    for (const asset of project.spriteAssets || []) {
      const texture = (project.textures || []).find((entry) => entry.id === asset.sourceTexture);
      for (const entry of validateSpriteSourceRect(asset, texture)) issues.push(issue({ scope: 'asset', assetId: asset.id, field: 'sourceRect', severity: entry.code === 'sprite-source-unavailable' ? 'warning' : 'error', ...entry }));
      for (const entry of validateSpriteNineSlice(asset, texture)) issues.push(issue({ scope: 'asset', assetId: asset.id, field: 'nineSlice', severity: entry.severity || 'error', ...entry }));
    }
    const spriteAssetsById = new Map((project.spriteAssets || []).map((asset) => [asset.id, asset]));
    const texturesById = new Map((project.textures || []).map((texture) => [texture.id, texture]));
    const clipsById = new Map((project.spriteAnimations || []).map((clip) => [clip.id, clip]));
    const validateNineSliceRenderer = (object, location) => {
      const renderer = object && object.components && object.components['sprite-renderer'];
      if (!renderer || renderer.renderMode !== 'nine-slice') return;
      const assetIds = new Set(renderer.spriteAssetRef ? [renderer.spriteAssetRef] : []);
      for (const state of normalizeSpriteAnimationStates(renderer.animationStates)) for (const clipId of [state.clipRef, ...state.directionalVariants.map((variant) => variant.clipRef).filter(Boolean)]) {
        const clip = clipsById.get(clipId);
        for (const frame of clip && clip.frames || []) if (frame.spriteAsset) assetIds.add(frame.spriteAsset);
      }
      if (!assetIds.size) issues.push(issue({ ...location, scope: location.prefabName ? 'prefab-component' : 'component', componentId: 'sprite-renderer', field: 'renderMode', code: 'sprite-nine-slice-source-required', message: 'Nine-Slice Render Mode requires a Sprite Asset with valid guides; runtime will use Simple fallback.' }));
      for (const assetId of assetIds) {
        const asset = spriteAssetsById.get(assetId);
        if (!asset) continue;
        if (!asset.nineSlice) { issues.push(issue({ ...location, scope: location.prefabName ? 'prefab-component' : 'component', componentId: 'sprite-renderer', field: 'renderMode', referenceType: 'asset', referenceValue: assetId, code: 'sprite-nine-slice-guides-required', message: `Nine-Slice Render Mode resolves Sprite Asset "${asset.name || assetId}" without guides; runtime will use Simple fallback.` })); continue; }
        const guideErrors = validateSpriteNineSlice(asset, texturesById.get(asset.sourceTexture)).filter((entry) => entry.severity !== 'warning');
        if (guideErrors.length) issues.push(issue({ ...location, scope: location.prefabName ? 'prefab-component' : 'component', componentId: 'sprite-renderer', field: 'renderMode', referenceType: 'asset', referenceValue: assetId, code: 'sprite-nine-slice-guides-invalid', message: `Nine-Slice Render Mode resolves Sprite Asset "${asset.name || assetId}" with invalid guides; runtime will use Simple fallback.` }));
      }
    };
    for (const level of index.levels) for (const object of level.objects || []) validateNineSliceRenderer(object, { objectId: object.id || null, levelId: level.id || null });
    for (const prefab of project.prefabs || []) for (const object of prefab.records || (prefab.record ? [prefab.record] : [])) validateNineSliceRenderer(object, { objectId: object.id || null, prefabName: prefab.name || null });
    const tilesetsById = new Map((project.tilesets || []).map((tileset) => [tileset.id, tileset]));
    for (const level of index.levels) for (const object of level.objects || []) if (object && object.kind === 'tilemap') {
      issues.push(...validateTilemapRecord(object, tilesetsById.get(object.tilesetRef)).map((entry) => issue({ scope: 'tilemap', objectId: object.id || null, levelId: level.id || null, ...entry })));
    }
    return { issues: issues.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || a.code.localeCompare(b.code) || String(a.objectId || a.assetId || '').localeCompare(String(b.objectId || b.assetId || ''))), index };
  }

  function propagateStructuredRename(uses, referenceType, oldValue, newValue) {
    let changed = 0;
    for (const use of uses || []) {
      if (use.referenceType !== referenceType || use.referenceValue !== oldValue || !use.owner || !use.key) continue;
      use.owner[use.key] = newValue;
      use.referenceValue = newValue;
      changed++;
    }
    return changed;
  }

  function createSpriteAsset(input) {
    const source = input || {};
    const rect = isObject(source.sourceRect) ? {
      x: Number(source.sourceRect.x), y: Number(source.sourceRect.y),
      width: Number(source.sourceRect.width), height: Number(source.sourceRect.height),
    } : null;
    const nineSlice = isObject(source.nineSlice) ? {
      left: Number(source.nineSlice.left), right: Number(source.nineSlice.right),
      top: Number(source.nineSlice.top), bottom: Number(source.nineSlice.bottom),
    } : null;
    return {
      id: source.id, type: 'sprite', name: source.name || 'Sprite', version: 4,
      sourceTexture: source.sourceTexture || null,
      // Pixel coordinates use a top-left origin. A null rectangle means the
      // full source image and keeps every pre-Phase-018 asset bit-compatible.
      sourceRect: rect,
      // Phase 026: source-region pixel guides. Historical v1-v3 records
      // normalize to null and therefore retain their exact Simple rendering.
      nineSlice,
      pivot: Array.isArray(source.pivot) ? [Number(source.pivot[0]), Number(source.pivot[1])] : [0.5, 0.5],
      pixelsPerUnit: Number.isFinite(Number(source.pixelsPerUnit)) && Number(source.pixelsPerUnit) > 0 ? Number(source.pixelsPerUnit) : 100,
      // Phase 012/v1 records had no filtering field; Smooth is exactly the
      // historical LINEAR_MIPMAP_LINEAR + LINEAR appearance.
      filtering: source.filtering === 'nearest' ? 'nearest' : 'linear',
      folder: source.folder || undefined, tags: Array.isArray(source.tags) && source.tags.length ? source.tags.slice() : undefined,
    };
  }
  function duplicateSpriteAsset(asset, id, name) { return createSpriteAsset({ ...asset, id, name: name || `${asset.name} Copy`, sourceRect: asset.sourceRect ? { ...asset.sourceRect } : null, nineSlice: asset.nineSlice ? { ...asset.nineSlice } : null, pivot: asset.pivot && asset.pivot.slice(), tags: asset.tags && asset.tags.slice() }); }
  function authoredTileCollision(input) {
    if (input === undefined) return { mode: 'none', oneWay: false };
    if (!isObject(input)) return clone(input);
    const record = { mode: input.mode, oneWay: input.mode === 'none' ? false : input.oneWay === undefined ? false : input.oneWay };
    if (Object.prototype.hasOwnProperty.call(input, 'rect')) record.rect = isObject(input.rect) ? { ...input.rect } : clone(input.rect);
    if (Object.prototype.hasOwnProperty.call(input, 'slope')) record.slope = input.slope;
    return record;
  }
  function validateTileCollision(input) {
    const problems = [];
    if (!isObject(input)) return [{ code: 'tile-collision-record-invalid', message: 'Tile Collision must be a typed record.' }];
    if (!TILE_COLLISION_MODES.includes(input.mode)) return [{ code: 'tile-collision-mode-unsupported', message: `Tile Collision mode "${String(input.mode || '')}" is unsupported; safe resolution is None.` }];
    if (input.oneWay !== undefined && typeof input.oneWay !== 'boolean') problems.push({ code: 'tile-collision-one-way-boolean', message: 'One-Way Platform must be true or false.' });
    if (input.mode === 'none' && input.oneWay === true) problems.push({ code: 'tile-collision-none-one-way', message: 'Collision None cannot be One-Way; turn on Full Cell or Custom Rectangle first.' });
    if (input.mode === 'slope') {
      if (input.slope !== 'up-right' && input.slope !== 'up-left') problems.push({ code: 'tile-collision-slope-direction', message: 'Slope requires Up Right or Up Left direction.' });
      if (Object.prototype.hasOwnProperty.call(input, 'rect')) problems.push({ code: 'tile-collision-inactive-rect', message: 'Slope Collision must not retain a Custom Rectangle.' });
      return problems;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'slope')) problems.push({ code: 'tile-collision-inactive-slope', message: 'Only Slope Collision may retain a slope direction.' });
    if (input.mode !== 'custom-rect') {
      if (Object.prototype.hasOwnProperty.call(input, 'rect')) problems.push({ code: 'tile-collision-inactive-rect', message: `${input.mode === 'full-cell' ? 'Full Cell' : 'None'} Collision must not retain an inactive Custom Rectangle.` });
      return problems;
    }
    if (!isObject(input.rect)) return [{ code: 'tile-collision-rect-required', message: 'Custom Rectangle Collision requires Left, Bottom, Right, and Top values.' }];
    const fields = [['minX', 'Left'], ['minY', 'Bottom'], ['maxX', 'Right'], ['maxY', 'Top']];
    for (const [key, label] of fields) if (!Number.isFinite(input.rect[key])) problems.push({ code: 'tile-collision-rect-finite', collisionField: key, message: `${label} must be a finite normalized number.` });
    if (problems.length) return problems;
    if (input.rect.minX < 0 || input.rect.minY < 0 || input.rect.maxX > 1 || input.rect.maxY > 1) problems.push({ code: 'tile-collision-rect-bounds', message: 'Custom Rectangle edges must stay between 0 and 1 inside the Tile cell.' });
    if (input.rect.minX >= input.rect.maxX) problems.push({ code: 'tile-collision-rect-horizontal-area', message: 'Custom Rectangle Left must be less than Right.' });
    if (input.rect.minY >= input.rect.maxY) problems.push({ code: 'tile-collision-rect-vertical-area', message: 'Custom Rectangle Bottom must be less than Top.' });
    return problems;
  }
  function resolveTileCollision(tileOrCollision) {
    const input = tileOrCollision && tileOrCollision.collision !== undefined ? tileOrCollision.collision : tileOrCollision;
    if (!isObject(input) || validateTileCollision(input).some((issue) => !['tile-collision-one-way-boolean', 'tile-collision-none-one-way'].includes(issue.code))) return { mode: 'none', oneWay: false };
    if (input.mode === 'slope') return { mode: 'slope', slope: input.slope, oneWay: input.oneWay === true };
    if (input.mode === 'custom-rect') return { mode: 'custom-rect', oneWay: input.oneWay === true, rect: { minX: input.rect.minX, minY: input.rect.minY, maxX: input.rect.maxX, maxY: input.rect.maxY } };
    return { mode: input.mode, oneWay: input.mode !== 'none' && input.oneWay === true };
  }
  function setTileCollision(tile, input) {
    if (!tile) return false; const mode = input && input.mode;
    const oneWay = mode !== 'none' && input && input.oneWay === true;
    tile.collision = mode === 'custom-rect'
      ? { mode, oneWay, rect: { minX: Number(input.rect && input.rect.minX), minY: Number(input.rect && input.rect.minY), maxX: Number(input.rect && input.rect.maxX), maxY: Number(input.rect && input.rect.maxY) } }
      : mode === 'slope' ? { mode, slope: input.slope === 'up-left' ? 'up-left' : 'up-right', oneWay }
      : { mode: mode === 'full-cell' ? 'full-cell' : 'none', oneWay: mode === 'full-cell' && oneWay };
    return true;
  }
  function tileCollisionLocalRect(tile, tileset, cellX, cellY) {
    const collision = resolveTileCollision(tile); if (collision.mode === 'none') return null;
    const rect = collision.mode === 'full-cell' || collision.mode === 'slope' ? { minX: 0, minY: 0, maxX: 1, maxY: 1 } : collision.rect;
    const size = safeTilesetCellSize(tileset); const x = Number(cellX) || 0; const y = Number(cellY) || 0;
    return { minX: (x + rect.minX) * size.width, minY: (y + rect.minY) * size.height, maxX: (x + rect.maxX) * size.width, maxY: (y + rect.maxY) * size.height };
  }
  function transformTileCollisionPoint(point, transform) {
    const source = transform || {}; const position = source.position || [0, 0, 0]; const scale = source.scale || [1, 1, 1];
    const angle = Number(source.rotationZ) || 0; const sx = Number(scale[0]); const sy = Number(scale[1]);
    const x = Number(point.x) * (Number.isFinite(sx) ? sx : 1); const y = Number(point.y) * (Number.isFinite(sy) ? sy : 1); const cosine = Math.cos(angle); const sine = Math.sin(angle);
    const transformed = { x: x * cosine - y * sine + (Number(position[0]) || 0), y: x * sine + y * cosine + (Number(position[1]) || 0), z: (Number(point.z) || 0) * (Number(scale[2]) || 1) + (Number(position[2]) || 0) };
    return source.parent ? transformTileCollisionPoint(transformed, source.parent) : transformed;
  }
  function tileCollisionWorldQuad(tile, tileset, cellX, cellY, transform) {
    const rect = tileCollisionLocalRect(tile, tileset, cellX, cellY); if (!rect) return null;
    return [{ x: rect.minX, y: rect.minY, z: 0 }, { x: rect.maxX, y: rect.minY, z: 0 }, { x: rect.maxX, y: rect.maxY, z: 0 }, { x: rect.minX, y: rect.maxY, z: 0 }].map((point) => transformTileCollisionPoint(point, transform));
  }
  function resolveTilemapLayerCollisions(tilemap, tileset, layerId) {
    const layer = getTilemapLayer(tilemap, layerId); if (!layer) return [];
    return (layer.cells || []).map((cell) => { const tile = getTileById(tileset, cell.tileId); const rect = tileCollisionLocalRect(tile, tileset, cell.x, cell.y); const collision = resolveTileCollision(tile); return rect ? { layerId: layer.id, cellX: cell.x, cellY: cell.y, tileId: cell.tileId, mode: collision.mode, slope: collision.slope || null, oneWay: collision.oneWay, rect } : null; }).filter(Boolean);
  }
  // Phase 035: Auto-Tile Sets are Tileset-local authoring records. Runtime
  // cells retain the already-resolved Tile ID; connectivity is never inferred
  // from artwork, names, collision metadata, or output Tile identity.
  const AUTO_TILE_NEIGHBOR_MODES = ['four-way', 'eight-way'];
  const AUTO_TILE_BITS = Object.freeze({ N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 });
  const AUTO_TILE_NEIGHBORS = Object.freeze([
    { name: 'N', dx: 0, dy: 1, bit: 1 }, { name: 'E', dx: 1, dy: 0, bit: 2 },
    { name: 'S', dx: 0, dy: -1, bit: 4 }, { name: 'W', dx: -1, dy: 0, bit: 8 },
    { name: 'NE', dx: 1, dy: 1, bit: 16 }, { name: 'SE', dx: 1, dy: -1, bit: 32 },
    { name: 'SW', dx: -1, dy: -1, bit: 64 }, { name: 'NW', dx: -1, dy: 1, bit: 128 },
  ]);
  function canonicalizeAutoTileMask(mode, rawMask) {
    let mask = Number.isInteger(Number(rawMask)) ? Number(rawMask) & 255 : 0;
    if (mode !== 'eight-way') return mask & 15;
    if (!(mask & AUTO_TILE_BITS.N) || !(mask & AUTO_TILE_BITS.E)) mask &= ~AUTO_TILE_BITS.NE;
    if (!(mask & AUTO_TILE_BITS.S) || !(mask & AUTO_TILE_BITS.E)) mask &= ~AUTO_TILE_BITS.SE;
    if (!(mask & AUTO_TILE_BITS.S) || !(mask & AUTO_TILE_BITS.W)) mask &= ~AUTO_TILE_BITS.SW;
    if (!(mask & AUTO_TILE_BITS.N) || !(mask & AUTO_TILE_BITS.W)) mask &= ~AUTO_TILE_BITS.NW;
    return mask;
  }
  function canonicalAutoTileMasks(mode) {
    const limit = mode === 'eight-way' ? 256 : 16; const masks = new Set();
    for (let mask = 0; mask < limit; mask++) masks.add(canonicalizeAutoTileMask(mode, mask));
    return [...masks].sort((a, b) => a - b);
  }
  function normalizeAutoTileSet(input) {
    const source = input || {};
    return {
      id: String(source.id || ''), name: String(source.name || ''),
      neighborMode: AUTO_TILE_NEIGHBOR_MODES.includes(source.neighborMode) ? source.neighborMode : String(source.neighborMode || 'four-way'),
      defaultTileId: source.defaultTileId == null ? null : String(source.defaultTileId),
      rules: (Array.isArray(source.rules) ? source.rules : []).map((rule) => ({ mask: Number(rule && rule.mask), tileId: String(rule && rule.tileId || '') })).sort((a, b) => a.mask - b.mask || a.tileId.localeCompare(b.tileId)),
    };
  }
  function getAutoTileSetById(tileset, setId) { return tileset && Array.isArray(tileset.autoTileSets) ? tileset.autoTileSets.find((set) => set && set.id === setId) : undefined; }
  function uniqueAutoTileSetName(tileset, baseName, excludeId) {
    const base = String(baseName || 'Auto-Tile Set').trim() || 'Auto-Tile Set';
    const used = new Set((tileset && tileset.autoTileSets || []).filter((set) => set.id !== excludeId).map((set) => String(set.name || '').trim().toLowerCase()));
    if (!used.has(base.toLowerCase())) return base; let suffix = 2; while (used.has(`${base} ${suffix}`.toLowerCase())) suffix++; return `${base} ${suffix}`;
  }
  function uniqueAutoTileSetId(tileset, baseName) {
    const base = String(baseName || 'auto-tile').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'auto-tile';
    const root = base.startsWith('auto-tile-') ? base : `auto-tile-${base}`; const used = new Set((tileset && tileset.autoTileSets || []).map((set) => set.id));
    if (!used.has(root)) return root; let suffix = 2; while (used.has(`${root}-${suffix}`)) suffix++; return `${root}-${suffix}`;
  }
  function createAutoTileSet(tileset, input) {
    if (!tileset) return null; if (!Array.isArray(tileset.autoTileSets)) tileset.autoTileSets = [];
    const source = input || {}; const name = uniqueAutoTileSetName(tileset, source.name || 'Auto-Tile Set');
    const set = normalizeAutoTileSet({ ...source, id: source.id || uniqueAutoTileSetId(tileset, name), name }); tileset.autoTileSets.push(set); return set;
  }
  function duplicateAutoTileSet(tileset, setId) {
    const source = getAutoTileSetById(tileset, setId); if (!source) return null;
    return createAutoTileSet(tileset, { ...source, id: undefined, name: `${source.name} Copy`, rules: source.rules.map((rule) => ({ ...rule })) });
  }
  function removeAutoTileSet(tileset, setId) { const index = tileset && tileset.autoTileSets ? tileset.autoTileSets.findIndex((set) => set.id === setId) : -1; return index < 0 ? null : tileset.autoTileSets.splice(index, 1)[0]; }
  function setAutoTileRule(autoTileSet, mask, tileId) {
    if (!autoTileSet || !Number.isInteger(mask) || canonicalizeAutoTileMask(autoTileSet.neighborMode, mask) !== mask || !String(tileId || '')) return false;
    const rule = (autoTileSet.rules || []).find((entry) => entry.mask === mask); if (rule) rule.tileId = String(tileId); else autoTileSet.rules.push({ mask, tileId: String(tileId) });
    autoTileSet.rules.sort((a, b) => a.mask - b.mask); return true;
  }
  function removeAutoTileRule(autoTileSet, mask) { const index = autoTileSet && autoTileSet.rules ? autoTileSet.rules.findIndex((rule) => rule.mask === mask) : -1; if (index < 0) return null; return autoTileSet.rules.splice(index, 1)[0]; }
  function validateAutoTileSets(tileset) {
    const problems = []; if (!Array.isArray(tileset && tileset.autoTileSets)) return [{ code: 'auto-tile-sets-invalid', field: 'autoTileSets', message: 'Tileset Auto-Tile Sets must be an ordered list.' }];
    const tileIds = new Set((tileset.tiles || []).map((tile) => tile.id)); const ids = new Set(); const names = new Set();
    tileset.autoTileSets.forEach((set, setIndex) => {
      const prefix = `autoTileSets[${setIndex}]`; const id = String(set && set.id || ''); const name = String(set && set.name || '').trim(); const mode = set && set.neighborMode;
      if (!id) problems.push({ code: 'auto-tile-set-id-required', field: `${prefix}.id`, autoTileSetId: null, message: `Auto-Tile Set ${setIndex + 1} requires a stable local ID.` }); else if (ids.has(id)) problems.push({ code: 'duplicate-auto-tile-set-id', field: `${prefix}.id`, autoTileSetId: id, message: `Tileset repeats Auto-Tile Set ID "${id}".` }); ids.add(id);
      if (!name) problems.push({ code: 'auto-tile-set-name-required', field: `${prefix}.name`, autoTileSetId: id || null, message: `Auto-Tile Set ${setIndex + 1} requires a name.` }); else if (names.has(name.toLowerCase())) problems.push({ code: 'duplicate-auto-tile-set-name', field: `${prefix}.name`, autoTileSetId: id || null, message: `Tileset repeats Auto-Tile Set name "${name}".` }); names.add(name.toLowerCase());
      if (!AUTO_TILE_NEIGHBOR_MODES.includes(mode)) problems.push({ code: 'auto-tile-neighbor-mode-unsupported', field: `${prefix}.neighborMode`, autoTileSetId: id || null, message: `Auto-Tile Set "${name || id}" has unsupported neighbor mode "${String(mode || '')}".` });
      if (!set || !set.defaultTileId) problems.push({ code: 'auto-tile-default-required', field: `${prefix}.defaultTileId`, autoTileSetId: id || null, message: `Auto-Tile Set "${name || id}" requires a Default Tile before painting.` }); else if (!tileIds.has(set.defaultTileId)) problems.push({ code: 'auto-tile-default-missing', field: `${prefix}.defaultTileId`, autoTileSetId: id || null, tileId: set.defaultTileId, message: `Auto-Tile Set "${name || id}" Default Tile "${set.defaultTileId}" is missing from this Tileset.` });
      if (!Array.isArray(set && set.rules)) { problems.push({ code: 'auto-tile-rules-invalid', field: `${prefix}.rules`, autoTileSetId: id || null, message: `Auto-Tile Set "${name || id}" Rules must be a list.` }); return; }
      const masks = new Set(); set.rules.forEach((rule, ruleIndex) => { const mask = rule && rule.mask; const rulePrefix = `${prefix}.rules[${ruleIndex}]`;
        if (!Number.isInteger(mask) || mask < 0 || mask > (mode === 'eight-way' ? 255 : 15) || canonicalizeAutoTileMask(mode, mask) !== mask) problems.push({ code: 'auto-tile-rule-mask-invalid', field: `${rulePrefix}.mask`, autoTileSetId: id || null, mask, message: `Rule ${ruleIndex + 1} in "${name || id}" has a noncanonical ${mode || 'unknown'} mask.` });
        if (masks.has(mask)) problems.push({ code: 'duplicate-auto-tile-rule-mask', field: `${rulePrefix}.mask`, autoTileSetId: id || null, mask, message: `Auto-Tile Set "${name || id}" repeats Rule mask ${mask}.` }); masks.add(mask);
        const tileId = String(rule && rule.tileId || ''); if (!tileId || !tileIds.has(tileId)) problems.push({ code: 'auto-tile-rule-tile-missing', field: `${rulePrefix}.tileId`, autoTileSetId: id || null, mask, tileId: tileId || null, message: `Rule mask ${mask} in "${name || id}" references a missing Tile.` });
      });
    }); return problems;
  }
  // Phase 036: Terrain Brushes are Tileset-local authoring semantics. They
  // resolve into ordinary Tile IDs and never participate in the game loop.
  const TERRAIN_BRUSH_MODES = ['weighted-tiles', 'auto-tile'];
  const TERRAIN_FOOTPRINT_SHAPES = ['single', 'square', 'circle'];
  const TERRAIN_WEIGHT_MAX = 1000000;
  const TERRAIN_RADIUS_MAX = 8;
  function normalizeTerrainBrush(input) {
    const source = input || {}; const mode = String(source.mode || 'weighted-tiles');
    const record = {
      id: String(source.id || ''), name: String(source.name || ''), mode,
      seed: Number.isInteger(Number(source.seed)) ? Number(source.seed) | 0 : Number(source.seed === undefined ? 0 : source.seed),
      variants: (Array.isArray(source.variants) ? source.variants : []).map((variant) => ({ tileId: String(variant && variant.tileId || ''), weight: Number(variant && variant.weight) })),
    };
    if (source.autoTileSetId != null) record.autoTileSetId = String(source.autoTileSetId);
    return record;
  }
  function getTerrainBrushById(tileset, brushId) { return tileset && Array.isArray(tileset.terrainBrushes) ? tileset.terrainBrushes.find((brush) => brush && brush.id === brushId) : undefined; }
  function uniqueTerrainBrushName(tileset, baseName, excludeId) {
    const base = String(baseName || 'Terrain Brush').trim() || 'Terrain Brush';
    const used = new Set((tileset && tileset.terrainBrushes || []).filter((brush) => brush.id !== excludeId).map((brush) => String(brush.name || '').trim().toLowerCase()));
    if (!used.has(base.toLowerCase())) return base; let suffix = 2; while (used.has(`${base} ${suffix}`.toLowerCase())) suffix++; return `${base} ${suffix}`;
  }
  function uniqueTerrainBrushId(tileset, baseName) {
    const base = String(baseName || 'terrain').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'terrain';
    const root = base.startsWith('terrain-') ? base : `terrain-${base}`; const used = new Set((tileset && tileset.terrainBrushes || []).map((brush) => brush.id));
    if (!used.has(root)) return root; let suffix = 2; while (used.has(`${root}-${suffix}`)) suffix++; return `${root}-${suffix}`;
  }
  function createTerrainBrush(tileset, input) {
    if (!tileset) return null; if (!Array.isArray(tileset.terrainBrushes)) tileset.terrainBrushes = [];
    const source = input || {}; const name = uniqueTerrainBrushName(tileset, source.name || 'Terrain Brush');
    const brush = normalizeTerrainBrush({ ...source, id: source.id || uniqueTerrainBrushId(tileset, name), name }); tileset.terrainBrushes.push(brush); return brush;
  }
  function duplicateTerrainBrush(tileset, brushId) {
    const source = getTerrainBrushById(tileset, brushId); if (!source) return null;
    return createTerrainBrush(tileset, { ...source, id: undefined, name: `${source.name} Copy`, variants: (source.variants || []).map((variant) => ({ ...variant })) });
  }
  function removeTerrainBrush(tileset, brushId) { const index = tileset && tileset.terrainBrushes ? tileset.terrainBrushes.findIndex((brush) => brush.id === brushId) : -1; return index < 0 ? null : tileset.terrainBrushes.splice(index, 1)[0]; }
  function validTerrainVariants(tileset, brush) {
    const seen = new Set(); return (brush && Array.isArray(brush.variants) ? brush.variants : [])
      .filter((variant) => variant && variant.tileId && !seen.has(variant.tileId) && getTileById(tileset, variant.tileId) && Number.isInteger(variant.weight) && variant.weight >= 1 && variant.weight <= TERRAIN_WEIGHT_MAX && (seen.add(variant.tileId) || true))
      .map((variant) => ({ tileId: variant.tileId, weight: variant.weight })).sort((a, b) => a.tileId.localeCompare(b.tileId));
  }
  function terrainHash32(value) {
    const text = String(value); let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
    return hash >>> 0;
  }
  function terrainCoordinateKey(brush, layerId, x, y) { return `${String(brush && brush.id || '')}\u0000${String(layerId || '')}\u0000${Number(x)}\u0000${Number(y)}\u0000${Number(brush && brush.seed) | 0}`; }
  function resolveTerrainWeightedTile(tileset, brush, layerId, x, y) {
    if (!brush || brush.mode !== 'weighted-tiles' || !isSafeCellCoordinate(x) || !isSafeCellCoordinate(y)) return null;
    const variants = validTerrainVariants(tileset, brush); if (!variants.length) return null;
    const total = variants.reduce((sum, variant) => sum + variant.weight, 0); let target = terrainHash32(terrainCoordinateKey(brush, layerId, x, y)) % total;
    for (const variant of variants) { if (target < variant.weight) return variant.tileId; target -= variant.weight; }
    return variants[variants.length - 1].tileId;
  }
  function terrainBrushCanPaint(tileset, brush) { return !!(brush && (brush.mode === 'weighted-tiles' ? validTerrainVariants(tileset, brush).length : brush.mode === 'auto-tile' && autoTileSetCanResolve(tileset, getAutoTileSetById(tileset, brush.autoTileSetId)))); }
  function validateTerrainBrushes(tileset) {
    const problems = []; if (!Array.isArray(tileset && tileset.terrainBrushes)) return [{ code: 'terrain-brushes-invalid', field: 'terrainBrushes', message: 'Tileset Terrain Brushes must be an ordered list.' }];
    const tileIds = new Set((tileset.tiles || []).map((tile) => tile.id)); const ids = new Set(); const names = new Set();
    tileset.terrainBrushes.forEach((brush, brushIndex) => {
      const prefix = `terrainBrushes[${brushIndex}]`; const id = String(brush && brush.id || ''); const name = String(brush && brush.name || '').trim(); const mode = brush && brush.mode;
      if (!id) problems.push({ code: 'terrain-brush-id-required', field: `${prefix}.id`, terrainBrushId: null, message: `Terrain Brush ${brushIndex + 1} requires a stable local ID.` }); else if (ids.has(id)) problems.push({ code: 'duplicate-terrain-brush-id', field: `${prefix}.id`, terrainBrushId: id, message: `Tileset repeats Terrain Brush ID "${id}".` }); ids.add(id);
      if (!name) problems.push({ code: 'terrain-brush-name-required', field: `${prefix}.name`, terrainBrushId: id || null, message: `Terrain Brush ${brushIndex + 1} requires a name.` }); else if (names.has(name.toLowerCase())) problems.push({ code: 'duplicate-terrain-brush-name', field: `${prefix}.name`, terrainBrushId: id || null, message: `Tileset repeats Terrain Brush name "${name}".` }); names.add(name.toLowerCase());
      if (!TERRAIN_BRUSH_MODES.includes(mode)) problems.push({ code: 'terrain-brush-mode-unsupported', field: `${prefix}.mode`, terrainBrushId: id || null, message: `Terrain Brush "${name || id}" has unsupported mode "${String(mode || '')}".` });
      if (mode === 'weighted-tiles') {
        if (!Number.isInteger(brush.seed) || brush.seed < -2147483648 || brush.seed > 2147483647) problems.push({ code: 'terrain-brush-seed-invalid', field: `${prefix}.seed`, terrainBrushId: id || null, message: `Weighted Terrain Brush "${name || id}" requires a signed 32-bit integer Seed.` });
        if (!Array.isArray(brush.variants)) problems.push({ code: 'terrain-brush-variants-invalid', field: `${prefix}.variants`, terrainBrushId: id || null, message: `Weighted Terrain Brush "${name || id}" requires a Variant list.` });
        else { if (!brush.variants.length) problems.push({ code: 'terrain-brush-empty', field: `${prefix}.variants`, terrainBrushId: id || null, message: `Weighted Terrain Brush "${name || id}" needs at least one valid Tile Variant before painting.` }); const used = new Set(); brush.variants.forEach((variant, variantIndex) => { const tileId = String(variant && variant.tileId || ''); const field = `${prefix}.variants[${variantIndex}]`; if (!tileId || !tileIds.has(tileId)) problems.push({ code: 'terrain-variant-tile-missing', field: `${field}.tileId`, terrainBrushId: id || null, tileId: tileId || null, message: `Variant ${variantIndex + 1} in "${name || id}" references a missing Tile.` }); if (tileId && used.has(tileId)) problems.push({ code: 'duplicate-terrain-variant-tile', field: `${field}.tileId`, terrainBrushId: id || null, tileId, message: `Terrain Brush "${name || id}" repeats Tile "${tileId}".` }); used.add(tileId); if (!Number.isInteger(variant && variant.weight) || variant.weight < 1 || variant.weight > TERRAIN_WEIGHT_MAX) problems.push({ code: 'terrain-variant-weight-invalid', field: `${field}.weight`, terrainBrushId: id || null, tileId: tileId || null, message: `Variant ${variantIndex + 1} weight must be an integer from 1 to ${TERRAIN_WEIGHT_MAX}.` }); }); }
      } else if (mode === 'auto-tile' && (!brush.autoTileSetId || !getAutoTileSetById(tileset, brush.autoTileSetId))) problems.push({ code: 'terrain-brush-auto-set-missing', field: `${prefix}.autoTileSetId`, terrainBrushId: id || null, autoTileSetId: brush.autoTileSetId || null, message: `Connected Terrain Brush "${name || id}" requires an existing Auto-Tile Set.` });
    }); return problems;
  }
  function createTileset(input) {
    const source = input || {}; const sourceCell = isObject(source.cellSize) ? source.cellSize : {};
    return {
      id: source.id, type: 'tileset', name: String(source.name || 'Tileset'), version: 6,
      cellSize: {
        width: sourceCell.width === undefined ? 1 : Number(sourceCell.width),
        height: sourceCell.height === undefined ? 1 : Number(sourceCell.height),
      },
      tiles: Array.isArray(source.tiles) ? source.tiles.map((tile) => ({
        id: String(tile && tile.id || ''), name: String(tile && tile.name || ''), spriteAssetRef: tile && tile.spriteAssetRef || null, collision: authoredTileCollision(tile && tile.collision),
      })) : [],
      autoTileSets: Array.isArray(source.autoTileSets) ? source.autoTileSets.map(normalizeAutoTileSet) : [],
      terrainBrushes: Array.isArray(source.terrainBrushes) ? source.terrainBrushes.map(normalizeTerrainBrush) : [],
      folder: source.folder || undefined, tags: Array.isArray(source.tags) && source.tags.length ? source.tags.slice() : undefined,
    };
  }
  function duplicateTileset(asset, id, name) {
    return createTileset({ ...asset, id, name: name || `${asset.name} Copy`, cellSize: { ...asset.cellSize }, tiles: (asset.tiles || []).map((tile) => ({ ...tile })), autoTileSets: (asset.autoTileSets || []).map((set) => ({ ...set, rules: (set.rules || []).map((rule) => ({ ...rule })) })), terrainBrushes: (asset.terrainBrushes || []).map((brush) => ({ ...brush, variants: (brush.variants || []).map((variant) => ({ ...variant })) })), tags: asset.tags && asset.tags.slice() });
  }
  function uniqueTileName(tileset, baseName, excludeId) {
    const base = String(baseName || 'Tile').trim() || 'Tile';
    const used = new Set((tileset && tileset.tiles || []).filter((tile) => tile.id !== excludeId).map((tile) => String(tile.name || '').trim().toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    let suffix = 2; while (used.has(`${base} ${suffix}`.toLowerCase())) suffix++;
    return `${base} ${suffix}`;
  }
  function uniqueTileId(tileset, baseName) {
    const base = String(baseName || 'tile').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tile';
    const root = base.startsWith('tile-') ? base : `tile-${base}`; const used = new Set((tileset && tileset.tiles || []).map((tile) => tile.id));
    if (!used.has(root)) return root; let suffix = 2; while (used.has(`${root}-${suffix}`)) suffix++;
    return `${root}-${suffix}`;
  }
  function addTileToTileset(tileset, spriteAsset, input) {
    if (!tileset || !Array.isArray(tileset.tiles)) throw new Error('Add Tile requires a Tileset.');
    const source = input || {}; const preferredName = source.name || (spriteAsset && spriteAsset.name) || 'Tile';
    const tile = {
      id: source.id || uniqueTileId(tileset, preferredName),
      name: uniqueTileName(tileset, preferredName),
      spriteAssetRef: source.spriteAssetRef !== undefined ? source.spriteAssetRef : (spriteAsset && spriteAsset.id) || null,
      collision: authoredTileCollision(source.collision),
    };
    tileset.tiles.push(tile); return tile;
  }
  function addSpriteAssetsToTileset(tileset, sprites) { return (sprites || []).map((sprite) => addTileToTileset(tileset, sprite)); }
  function duplicateTileInTileset(tileset, tileId) {
    const source = getTileById(tileset, tileId); if (!source) return null;
    return addTileToTileset(tileset, null, { name: `${source.name} Copy`, spriteAssetRef: source.spriteAssetRef, collision: authoredTileCollision(source.collision) });
  }
  function removeTileFromTileset(tileset, tileId) {
    if (!tileset || !Array.isArray(tileset.tiles)) return null; const index = tileset.tiles.findIndex((tile) => tile.id === tileId);
    return index < 0 ? null : tileset.tiles.splice(index, 1)[0];
  }
  function reorderTilesetTile(tileset, tileId, delta) {
    if (!tileset || !Array.isArray(tileset.tiles)) return false; const index = tileset.tiles.findIndex((tile) => tile.id === tileId); const target = index + Math.sign(Number(delta) || 0);
    if (index < 0 || target < 0 || target >= tileset.tiles.length) return false;
    [tileset.tiles[index], tileset.tiles[target]] = [tileset.tiles[target], tileset.tiles[index]]; return true;
  }
  function getTilesetById(tilesets, tilesetId) { return (tilesets || []).find((tileset) => tileset && tileset.id === tilesetId); }
  function getTileById(tileset, tileId) { return tileset && Array.isArray(tileset.tiles) ? tileset.tiles.find((tile) => tile && tile.id === tileId) : undefined; }
  function safeTilesetCellSize(tileset) {
    const cell = tileset && tileset.cellSize || {}; return {
      width: Number.isFinite(cell.width) && cell.width > 0 ? cell.width : 1,
      height: Number.isFinite(cell.height) && cell.height > 0 ? cell.height : 1,
    };
  }

  // Phase 037 Tilemap v4 model. Manual cells remain {x,y,tileId}; an
  // auto-managed cell additionally owns a stable Tileset-local autoTileSetId.
  // each Layer owns a sparse canonical cell array and a transient O(1) index.
  // Historical v1 top-level cells migrate into one deterministic local Layer;
  // v1-v3 Tilemaps migrate with an empty top-level Spawn Marker list.
  const DEFAULT_TILEMAP_LAYER_ID = 'tilemap-layer-default';
  const tilemapCellIndexes = new WeakMap();
  function tilemapCellKey(x, y) { return `${Number(x)},${Number(y)}`; }
  function parseTilemapCellKey(key) { const parts = String(key).split(','); return { x: Number(parts[0]), y: Number(parts[1]) }; }
  function isSafeCellCoordinate(value) { return Number.isSafeInteger(value); }
  function canonicalizeTilemapCells(cells) {
    const byKey = new Map();
    for (const cell of Array.isArray(cells) ? cells : []) {
      const x = Number(cell && cell.x); const y = Number(cell && cell.y); const tileId = String(cell && cell.tileId || '');
      if (!isSafeCellCoordinate(x) || !isSafeCellCoordinate(y) || !tileId) continue;
      // Corrupt duplicate coordinates normalize deterministically: last
      // canonical input wins. Validation still reports the raw duplicates.
      const normalized = { x, y, tileId }; const autoTileSetId = String(cell && cell.autoTileSetId || ''); const terrainBrushId = String(cell && cell.terrainBrushId || '');
      if (autoTileSetId) normalized.autoTileSetId = autoTileSetId;
      if (terrainBrushId) normalized.terrainBrushId = terrainBrushId;
      byKey.set(tilemapCellKey(x, y), normalized);
    }
    return [...byKey.values()].sort((a, b) => a.y - b.y || a.x - b.x || a.tileId.localeCompare(b.tileId));
  }
  function uniqueTilemapLayerName(tilemap, baseName, excludeId) {
    const base = String(baseName || 'Layer').trim() || 'Layer';
    const used = new Set((tilemap && tilemap.layers || []).filter((layer) => layer.id !== excludeId).map((layer) => String(layer.name || '').trim().toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    let suffix = 2; while (used.has(`${base} ${suffix}`.toLowerCase())) suffix++;
    return `${base} ${suffix}`;
  }
  function uniqueTilemapLayerId(tilemap, preferred) {
    const used = new Set((tilemap && tilemap.layers || []).map((layer) => layer.id));
    const base = String(preferred || 'tilemap-layer').trim() || 'tilemap-layer';
    if (!used.has(base)) return base;
    let suffix = 1; while (used.has(`tilemap-layer-${suffix}`)) suffix++;
    return `tilemap-layer-${suffix}`;
  }
  function normalizeTilemapLayer(layer, fallbackId, fallbackName) {
    const source = layer || {};
    return {
      id: String(source.id || fallbackId || DEFAULT_TILEMAP_LAYER_ID),
      name: String(source.name || fallbackName || 'Layer 1').trim() || String(fallbackName || 'Layer 1'),
      visible: source.visible === undefined ? true : source.visible === true,
      locked: source.locked === true,
      collisionEnabled: source.collisionEnabled !== false,
      ...Filters.normalizeFilter(source, !Object.prototype.hasOwnProperty.call(source, 'collisionLayerRef')),
      cells: canonicalizeTilemapCells(source.cells),
    };
  }
  // Phase 037: spawn markers are Tilemap-local authoring/runtime metadata,
  // deliberately separate from sparse tile Layers and ordinary scene objects.
  function normalizeSpawnMarker(marker) {
    const source = marker || {};
    return {
      id: String(source.id || ''),
      name: String(source.name || '').trim(),
      x: Number.isSafeInteger(source.x) ? source.x : Math.trunc(Number(source.x) || 0),
      y: Number.isSafeInteger(source.y) ? source.y : Math.trunc(Number(source.y) || 0),
      prefabRef: source.prefabRef == null || String(source.prefabRef).trim() === '' ? null : String(source.prefabRef),
    };
  }
  function canonicalizeSpawnMarkers(markers) { return (Array.isArray(markers) ? markers : []).map(normalizeSpawnMarker); }
  function uniqueSpawnMarkerId(tilemap, preferred) {
    const used = new Set((tilemap && tilemap.spawnMarkers || []).map((marker) => marker.id));
    const root = String(preferred || 'spawn-marker').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spawn-marker';
    if (!used.has(root)) return root; let suffix = 2; while (used.has(`${root}-${suffix}`)) suffix++; return `${root}-${suffix}`;
  }
  function uniqueSpawnMarkerName(tilemap, preferred, excludeId) {
    const used = new Set((tilemap && tilemap.spawnMarkers || []).filter((marker) => marker.id !== excludeId).map((marker) => String(marker.name || '').trim().toLowerCase()));
    const root = String(preferred || 'Spawn').trim() || 'Spawn'; if (!used.has(root.toLowerCase())) return root;
    let suffix = 2; while (used.has(`${root} ${suffix}`.toLowerCase())) suffix++; return `${root} ${suffix}`;
  }
  function createSpawnMarker(tilemap, input) {
    if (!tilemap) return null; if (!Array.isArray(tilemap.spawnMarkers)) tilemap.spawnMarkers = [];
    const source = input || {}; const marker = normalizeSpawnMarker({ ...source, id: source.id || uniqueSpawnMarkerId(tilemap, source.name), name: uniqueSpawnMarkerName(tilemap, source.name || 'Spawn') });
    if (!isSafeCellCoordinate(marker.x) || !isSafeCellCoordinate(marker.y)) return null; marker.id = uniqueSpawnMarkerId(tilemap, marker.id); tilemap.spawnMarkers.push(marker); return marker;
  }
  function getSpawnMarkerById(tilemap, markerId) { return tilemap && Array.isArray(tilemap.spawnMarkers) ? tilemap.spawnMarkers.find((marker) => marker && marker.id === markerId) : undefined; }
  function updateSpawnMarker(tilemap, markerId, patch) {
    const marker = getSpawnMarkerById(tilemap, markerId); if (!marker) return null; const source = patch || {};
    if (source.name !== undefined) { const name = String(source.name).trim(); if (!name) return null; marker.name = uniqueSpawnMarkerName(tilemap, name, marker.id); }
    if (source.x !== undefined) { if (!isSafeCellCoordinate(source.x)) return null; marker.x = source.x; }
    if (source.y !== undefined) { if (!isSafeCellCoordinate(source.y)) return null; marker.y = source.y; }
    if (source.prefabRef !== undefined) marker.prefabRef = source.prefabRef == null || String(source.prefabRef).trim() === '' ? null : String(source.prefabRef);
    return marker;
  }
  function duplicateSpawnMarker(tilemap, markerId) { const source = getSpawnMarkerById(tilemap, markerId); return source ? createSpawnMarker(tilemap, { ...source, id: undefined, name: `${source.name} Copy`, x: source.x + 1 }) : null; }
  function deleteSpawnMarker(tilemap, markerId) { if (!tilemap || !Array.isArray(tilemap.spawnMarkers)) return false; const index = tilemap.spawnMarkers.findIndex((marker) => marker && marker.id === markerId); if (index < 0) return false; tilemap.spawnMarkers.splice(index, 1); return true; }
  function spawnMarkerPrefabUsage(project, prefabRef) {
    const uses = []; for (const tilemap of projectTilemaps(project)) for (const marker of tilemap.spawnMarkers || []) if (marker.prefabRef === prefabRef) uses.push({ tilemapId: tilemap.id, tilemapName: tilemap.name, markerId: marker.id, markerName: marker.name, x: marker.x, y: marker.y }); return uses;
  }
  function validateSpawnMarkers(tilemap, prefabs) {
    const problems = []; const ids = new Set(); const names = new Set(); const available = prefabs ? new Set((prefabs || []).map((prefab) => typeof prefab === 'string' ? prefab : prefab && (prefab.name || prefab.id)).filter(Boolean)) : null;
    if (!Array.isArray(tilemap && tilemap.spawnMarkers)) return [{ code: 'spawn-markers-invalid', field: 'spawnMarkers', message: 'Tilemap Spawn Markers must be a list.' }];
    tilemap.spawnMarkers.forEach((marker, index) => { const prefix = `spawnMarkers[${index}]`; const id = String(marker && marker.id || ''); const name = String(marker && marker.name || '').trim();
      if (!id) problems.push({ code: 'spawn-marker-id-required', field: `${prefix}.id`, message: `Spawn Marker ${index + 1} requires a stable ID.` }); else if (ids.has(id)) problems.push({ code: 'duplicate-spawn-marker-id', field: `${prefix}.id`, markerId: id, message: `Tilemap repeats Spawn Marker ID "${id}".` }); ids.add(id);
      if (!name) problems.push({ code: 'spawn-marker-name-required', field: `${prefix}.name`, markerId: id, message: `Spawn Marker ${index + 1} requires a name.` }); else if (names.has(name.toLowerCase())) problems.push({ code: 'duplicate-spawn-marker-name', severity: 'warning', field: `${prefix}.name`, markerId: id, message: `Tilemap repeats Spawn Marker name "${name}".` }); names.add(name.toLowerCase());
      if (!isSafeCellCoordinate(marker && marker.x) || !isSafeCellCoordinate(marker && marker.y)) problems.push({ code: 'spawn-marker-coordinate-integer', field: prefix, markerId: id, message: `Spawn Marker "${name || id || index + 1}" requires safe integer X and Y coordinates.` });
      if (marker && marker.prefabRef != null && typeof marker.prefabRef !== 'string') problems.push({ code: 'spawn-marker-prefab-reference-invalid', field: `${prefix}.prefabRef`, markerId: id, message: 'Spawn Marker Prefab must be null or a Prefab reference string.' });
      else if (available && marker && marker.prefabRef && !available.has(marker.prefabRef)) problems.push({ code: 'spawn-marker-missing-prefab', field: `${prefix}.prefabRef`, markerId: id, prefabRef: marker.prefabRef, message: `Spawn Marker "${name || id}" references missing Prefab "${marker.prefabRef}".` });
    }); return problems;
  }
  function tilemapCellCenterLocal(tileset, x, y) { const size = safeTilesetCellSize(tileset); return { x: (x + 0.5) * size.width, y: (y + 0.5) * size.height, z: 0 }; }
  function tilemapCellToWorld(tilemap, tileset, x, y, transform) {
    const local = tilemapCellCenterLocal(tileset, x, y); const source = transform || tilemap && tilemap.transform || {}; const position = source.position || { x: 0, y: 0, z: 0 }; const right = source.right || { x: 1, y: 0, z: 0 }; const up = source.up || { x: 0, y: 1, z: 0 }; const scale = source.scale || { x: 1, y: 1, z: 1 };
    return { x: Number(position.x || 0) + Number(right.x || 0) * local.x * Number(scale.x == null ? 1 : scale.x) + Number(up.x || 0) * local.y * Number(scale.y == null ? 1 : scale.y), y: Number(position.y || 0) + Number(right.y || 0) * local.x * Number(scale.x == null ? 1 : scale.x) + Number(up.y || 0) * local.y * Number(scale.y == null ? 1 : scale.y), z: Number(position.z || 0) + Number(right.z || 0) * local.x * Number(scale.x == null ? 1 : scale.x) + Number(up.z || 0) * local.y * Number(scale.y == null ? 1 : scale.y) };
  }
  function tilemapWorldToCell(tilemap, tileset, point, transform) {
    const source = transform || tilemap && tilemap.transform || {}; const position = source.position || { x: 0, y: 0, z: 0 }; const right = source.right || { x: 1, y: 0, z: 0 }; const up = source.up || { x: 0, y: 1, z: 0 }; const scale = source.scale || { x: 1, y: 1, z: 1 }; const size = safeTilesetCellSize(tileset); const dx = Number(point && point.x || 0) - Number(position.x || 0); const dy = Number(point && point.y || 0) - Number(position.y || 0); const dz = Number(point && point.z || 0) - Number(position.z || 0); const sx = Number(scale.x); const sy = Number(scale.y);
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx === 0 || sy === 0) return null; const rightLength2 = right.x * right.x + right.y * right.y + right.z * right.z; const upLength2 = up.x * up.x + up.y * up.y + up.z * up.z; if (!rightLength2 || !upLength2) return null;
    const localX = (dx * right.x + dy * right.y + dz * right.z) / rightLength2 / sx; const localY = (dx * up.x + dy * up.y + dz * up.z) / upLength2 / sy; return { x: Math.floor(localX / size.width), y: Math.floor(localY / size.height) };
  }
  function getTilemapSpawnMarkers(tilemap, tileset, transform, prefabs) {
    const byName = new Map((prefabs || []).map((prefab) => [prefab && (prefab.name || prefab.id), prefab]));
    return Object.freeze((tilemap && tilemap.spawnMarkers || []).map((marker) => Object.freeze({ id: marker.id, name: marker.name, x: marker.x, y: marker.y, prefabRef: marker.prefabRef || null, prefab: marker.prefabRef ? byName.get(marker.prefabRef) || null : null, worldPosition: Object.freeze(tilemapCellToWorld(tilemap, tileset, marker.x, marker.y, transform)) })));
  }
  function attachLegacyTilemapCellsAlias(tilemap) {
    if (!tilemap || Object.prototype.hasOwnProperty.call(tilemap, 'cells')) return tilemap;
    Object.defineProperty(tilemap, 'cells', {
      configurable: true, enumerable: false,
      get() { return tilemap.layers && tilemap.layers[0] ? tilemap.layers[0].cells : []; },
      set(value) { if (tilemap.layers && tilemap.layers[0]) tilemap.layers[0].cells = Array.isArray(value) ? value : []; invalidateTilemapCellIndex(tilemap); },
    });
    return tilemap;
  }
  function createTilemapRecord(input) {
    const source = input || {}; const rawLayers = Array.isArray(source.layers) && source.layers.length
      ? source.layers : [{ id: DEFAULT_TILEMAP_LAYER_ID, name: 'Layer 1', visible: true, locked: false, cells: source.cells }];
    const record = {
      kind: 'tilemap', version: 6,
      id: source.id, name: String(source.name || 'Tilemap'), tilesetRef: source.tilesetRef || null,
      layers: rawLayers.map((layer, index) => ({ ...normalizeTilemapLayer(layer, index ? `tilemap-layer-${index + 1}` : DEFAULT_TILEMAP_LAYER_ID, `Layer ${index + 1}`), ...Filters.normalizeFilter(layer, !source.version || source.version < 6) })),
      sortingLayerRef: source.sortingLayerRef || DEFAULT_SPRITE_SORTING_LAYER_ID,
      orderInLayer: Number.isFinite(Number(source.orderInLayer)) ? Math.round(Number(source.orderInLayer)) : 0,
      spawnMarkers: canonicalizeSpawnMarkers(source.spawnMarkers),
    };
    return attachLegacyTilemapCellsAlias(record);
  }
  function getTilemapLayer(tilemap, layerId) { return tilemap && Array.isArray(tilemap.layers) ? tilemap.layers.find((layer) => layer && layer.id === layerId) : undefined; }
  function defaultTilemapLayer(tilemap) { return tilemap && Array.isArray(tilemap.layers) ? tilemap.layers[0] : undefined; }
  function ensureTilemapCellIndex(tilemap, layerId) {
    if (!tilemap || typeof tilemap !== 'object') return { byKey: new Map(), positions: new Map() };
    const layer = getTilemapLayer(tilemap, layerId) || defaultTilemapLayer(tilemap);
    if (!layer) return { byKey: new Map(), positions: new Map() };
    let indexes = tilemapCellIndexes.get(tilemap); if (!indexes) { indexes = new Map(); tilemapCellIndexes.set(tilemap, indexes); }
    let index = indexes.get(layer.id);
    if (!index) {
      layer.cells = canonicalizeTilemapCells(layer.cells).map((cell) => ({ ...cell }));
      const byKey = new Map(); const positions = new Map();
      layer.cells.forEach((cell, position) => { const key = tilemapCellKey(cell.x, cell.y); byKey.set(key, cell); positions.set(key, position); });
      index = { byKey, positions }; indexes.set(layer.id, index);
    }
    return index;
  }
  function invalidateTilemapCellIndex(tilemap) { if (tilemap && typeof tilemap === 'object') tilemapCellIndexes.delete(tilemap); }
  function serializeTilemapCells(tilemap, layerId) { const layer = getTilemapLayer(tilemap, layerId) || defaultTilemapLayer(tilemap); return canonicalizeTilemapCells(layer && layer.cells); }
  function serializeTilemapLayers(tilemap) { return (tilemap && tilemap.layers || []).map((layer) => ({ id: layer.id, name: layer.name, visible: layer.visible !== false, locked: layer.locked === true, collisionEnabled: layer.collisionEnabled !== false, ...Filters.normalizeFilter(layer, !tilemap.version || tilemap.version < 6), cells: canonicalizeTilemapCells(layer.cells) })); }
  function getTilemapCell(tilemap, layerId, x, y) {
    if (arguments.length === 3) { y = x; x = layerId; layerId = defaultTilemapLayer(tilemap) && defaultTilemapLayer(tilemap).id; }
    if (!isSafeCellCoordinate(x) || !isSafeCellCoordinate(y)) return undefined;
    return ensureTilemapCellIndex(tilemap, layerId).byKey.get(tilemapCellKey(x, y));
  }
  function setTilemapCell(tilemap, layerId, x, y, tileId, options) {
    if (arguments.length === 4) { tileId = y; y = x; x = layerId; layerId = defaultTilemapLayer(tilemap) && defaultTilemapLayer(tilemap).id; }
    if (!tilemap || !isSafeCellCoordinate(x) || !isSafeCellCoordinate(y) || !String(tileId || '')) return { changed: false, previous: undefined };
    const layer = getTilemapLayer(tilemap, layerId); if (!layer || layer.locked || layer.visible === false) return { changed: false, previous: undefined, reason: !layer ? 'missing-layer' : (layer.locked ? 'locked-layer' : 'hidden-layer') };
    const index = ensureTilemapCellIndex(tilemap, layerId); const key = tilemapCellKey(x, y); const previous = index.byKey.get(key);
    const requestedAutoTileSetId = options && options.autoTileSetId ? String(options.autoTileSetId) : null; const requestedTerrainBrushId = options && options.terrainBrushId ? String(options.terrainBrushId) : null;
    if (previous && previous.tileId === tileId && (previous.autoTileSetId || null) === requestedAutoTileSetId && (previous.terrainBrushId || null) === requestedTerrainBrushId) return { changed: false, previous: { ...previous } };
    const previousCopy = previous && { ...previous };
    if (previous) { previous.tileId = String(tileId); if (requestedAutoTileSetId) previous.autoTileSetId = requestedAutoTileSetId; else delete previous.autoTileSetId; if (requestedTerrainBrushId) previous.terrainBrushId = requestedTerrainBrushId; else delete previous.terrainBrushId; }
    else { const cell = { x, y, tileId: String(tileId) }; if (requestedAutoTileSetId) cell.autoTileSetId = requestedAutoTileSetId; if (requestedTerrainBrushId) cell.terrainBrushId = requestedTerrainBrushId; index.positions.set(key, layer.cells.length); layer.cells.push(cell); index.byKey.set(key, cell); }
    return { changed: true, previous: previousCopy };
  }
  function eraseTilemapCell(tilemap, layerId, x, y) {
    if (arguments.length === 3) { y = x; x = layerId; layerId = defaultTilemapLayer(tilemap) && defaultTilemapLayer(tilemap).id; }
    if (!tilemap || !isSafeCellCoordinate(x) || !isSafeCellCoordinate(y)) return { changed: false, previous: undefined };
    const layer = getTilemapLayer(tilemap, layerId); if (!layer || layer.locked || layer.visible === false) return { changed: false, previous: undefined, reason: !layer ? 'missing-layer' : (layer.locked ? 'locked-layer' : 'hidden-layer') };
    const index = ensureTilemapCellIndex(tilemap, layerId); const key = tilemapCellKey(x, y); const previous = index.byKey.get(key);
    if (!previous) return { changed: false, previous: undefined };
    const position = index.positions.get(key); const tail = layer.cells.pop(); index.byKey.delete(key); index.positions.delete(key);
    if (position < layer.cells.length) { layer.cells[position] = tail; const tailKey = tilemapCellKey(tail.x, tail.y); index.positions.set(tailKey, position); }
    return { changed: true, previous: { ...previous } };
  }
  function autoTileSetCanResolve(tileset, autoTileSet) { return !!(autoTileSet && AUTO_TILE_NEIGHBOR_MODES.includes(autoTileSet.neighborMode) && getTileById(tileset, autoTileSet.defaultTileId)); }
  function resolveAutoTileMask(tilemap, layerId, x, y, autoTileSetId, mode, hypothetical) {
    const layer = getTilemapLayer(tilemap, layerId); if (!layer) return 0; const index = ensureTilemapCellIndex(tilemap, layerId); let raw = 0;
    const members = (cx, cy) => {
      if (hypothetical && hypothetical.x === cx && hypothetical.y === cy) return hypothetical.autoTileSetId === autoTileSetId;
      const cell = index.byKey.get(tilemapCellKey(cx, cy)); return !!(cell && cell.autoTileSetId === autoTileSetId);
    };
    for (const neighbor of AUTO_TILE_NEIGHBORS.slice(0, mode === 'eight-way' ? 8 : 4)) if (members(x + neighbor.dx, y + neighbor.dy)) raw |= neighbor.bit;
    return canonicalizeAutoTileMask(mode, raw);
  }
  function resolveAutoTileOutput(tileset, autoTileSet, mask, currentTileId) {
    if (!autoTileSetCanResolve(tileset, autoTileSet)) return currentTileId || null;
    const canonicalMask = canonicalizeAutoTileMask(autoTileSet.neighborMode, mask); const rule = (autoTileSet.rules || []).find((entry) => entry.mask === canonicalMask);
    return rule && getTileById(tileset, rule.tileId) ? rule.tileId : autoTileSet.defaultTileId;
  }
  function recomputeAutoTileCell(tilemap, tileset, layerId, x, y, expectedSetId) {
    const cell = getTilemapCell(tilemap, layerId, x, y); if (!cell || !cell.autoTileSetId || (expectedSetId && cell.autoTileSetId !== expectedSetId)) return false;
    const set = getAutoTileSetById(tileset, cell.autoTileSetId); if (!autoTileSetCanResolve(tileset, set)) return false;
    const mask = resolveAutoTileMask(tilemap, layerId, x, y, set.id, set.neighborMode); const tileId = resolveAutoTileOutput(tileset, set, mask, cell.tileId);
    if (!tileId || tileId === cell.tileId) return false; cell.tileId = tileId; return true;
  }
  function recomputeAutoTileNeighborhood(tilemap, tileset, layerId, x, y, setIds) {
    const ids = [...new Set((Array.isArray(setIds) ? setIds : [setIds]).filter(Boolean))]; const changed = []; const coordinates = new Map();
    coordinates.set(tilemapCellKey(x, y), { x, y });
    for (const neighbor of AUTO_TILE_NEIGHBORS) coordinates.set(tilemapCellKey(x + neighbor.dx, y + neighbor.dy), { x: x + neighbor.dx, y: y + neighbor.dy });
    for (const coordinate of coordinates.values()) for (const setId of ids) if (recomputeAutoTileCell(tilemap, tileset, layerId, coordinate.x, coordinate.y, setId)) changed.push({ ...coordinate, autoTileSetId: setId });
    return changed;
  }
  function paintAutoTileCell(tilemap, layerId, x, y, tileset, autoTileSetId) {
    const set = getAutoTileSetById(tileset, autoTileSetId); if (!autoTileSetCanResolve(tileset, set)) return { changed: false, previous: getTilemapCell(tilemap, layerId, x, y), reason: 'invalid-auto-tile-set', derivedChanges: [] };
    const previous = getTilemapCell(tilemap, layerId, x, y); const oldSetId = previous && previous.autoTileSetId; const initial = resolveAutoTileOutput(tileset, set, resolveAutoTileMask(tilemap, layerId, x, y, set.id, set.neighborMode, { x, y, autoTileSetId: set.id }), set.defaultTileId);
    const result = setTilemapCell(tilemap, layerId, x, y, initial, { autoTileSetId: set.id }); if (!result.changed && result.reason) return { ...result, derivedChanges: [] };
    const derivedChanges = recomputeAutoTileNeighborhood(tilemap, tileset, layerId, x, y, [oldSetId, set.id]);
    return { ...result, changed: result.changed || derivedChanges.length > 0, derivedChanges };
  }
  function paintManualTileCell(tilemap, layerId, x, y, tileId, tileset) {
    const previous = getTilemapCell(tilemap, layerId, x, y); const oldSetId = previous && previous.autoTileSetId; const result = setTilemapCell(tilemap, layerId, x, y, tileId);
    const derivedChanges = oldSetId ? recomputeAutoTileNeighborhood(tilemap, tileset, layerId, x, y, oldSetId) : [];
    return { ...result, changed: result.changed || derivedChanges.length > 0, derivedChanges };
  }
  function eraseAutoTileCell(tilemap, layerId, x, y, tileset) {
    const previous = getTilemapCell(tilemap, layerId, x, y); const oldSetId = previous && previous.autoTileSetId; const result = eraseTilemapCell(tilemap, layerId, x, y);
    const derivedChanges = result.changed && oldSetId ? recomputeAutoTileNeighborhood(tilemap, tileset, layerId, x, y, oldSetId) : [];
    return { ...result, derivedChanges };
  }
  function recomputeAutoTilemap(tilemap, tileset, onlySetId) {
    const changed = []; if (!tilemap || !tileset) return changed;
    for (const layer of tilemap.layers || []) for (const cell of layer.cells || []) if (cell.autoTileSetId && (!onlySetId || cell.autoTileSetId === onlySetId) && recomputeAutoTileCell(tilemap, tileset, layer.id, cell.x, cell.y, onlySetId)) changed.push({ layerId: layer.id, x: cell.x, y: cell.y, autoTileSetId: cell.autoTileSetId });
    return changed;
  }
  function projectTilemaps(project) { return (project && project.levels || []).flatMap((level) => (level.objects || []).filter((object) => object && object.kind === 'tilemap')); }
  function recomputeAutoTileSetUsage(project, tilesetId, autoTileSetId) {
    const tileset = getTilesetById(project && project.tilesets, tilesetId); if (!tileset) return [];
    return projectTilemaps(project).filter((tilemap) => tilemap.tilesetRef === tilesetId).flatMap((tilemap) => recomputeAutoTilemap(tilemap, tileset, autoTileSetId).map((change) => ({ tilemapId: tilemap.id, ...change })));
  }
  function recomputeProjectAutoTiles(project) { const changed = []; for (const tilemap of projectTilemaps(project)) { const tileset = getTilesetById(project.tilesets, tilemap.tilesetRef); if (tileset) changed.push(...recomputeAutoTilemap(tilemap, tileset).map((change) => ({ tilemapId: tilemap.id, ...change }))); } return changed; }
  function autoTileSetUsage(project, tilesetId, autoTileSetId) {
    const uses = []; for (const tilemap of projectTilemaps(project)) if (tilemap.tilesetRef === tilesetId) for (const layer of tilemap.layers || []) { const cells = (layer.cells || []).filter((cell) => cell.autoTileSetId === autoTileSetId); if (cells.length) uses.push({ tilemapId: tilemap.id, tilemapName: tilemap.name, layerId: layer.id, layerName: layer.name, cellCount: cells.length }); } return uses;
  }
  function convertAutoTileCellsToManual(project, tilesetId, autoTileSetId) { let count = 0; for (const tilemap of projectTilemaps(project)) if (tilemap.tilesetRef === tilesetId) for (const layer of tilemap.layers || []) for (const cell of layer.cells || []) if (cell.autoTileSetId === autoTileSetId) { delete cell.autoTileSetId; count++; } return count; }
  function reassignAutoTileCells(project, tilesetId, fromSetId, toSetId) { let count = 0; for (const tilemap of projectTilemaps(project)) if (tilemap.tilesetRef === tilesetId) for (const layer of tilemap.layers || []) for (const cell of layer.cells || []) if (cell.autoTileSetId === fromSetId) { cell.autoTileSetId = toSetId; count++; } recomputeAutoTileSetUsage(project, tilesetId, toSetId); return count; }
  function terrainFootprintCells(centerX, centerY, shape, radius) {
    if (!isSafeCellCoordinate(centerX) || !isSafeCellCoordinate(centerY)) return [];
    const kind = TERRAIN_FOOTPRINT_SHAPES.includes(shape) ? shape : 'single'; const r = kind === 'single' ? 0 : Math.max(1, Math.min(TERRAIN_RADIUS_MAX, Math.round(Number(radius) || 1))); const cells = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (kind !== 'circle' || dx * dx + dy * dy <= r * r) cells.push({ x: centerX + dx, y: centerY + dy });
    return cells;
  }
  function terrainStrokeFootprintCells(fromX, fromY, toX, toY, shape, radius) {
    const cells = new Map(); for (const center of tilemapStrokeCells(fromX, fromY, toX, toY)) for (const cell of terrainFootprintCells(center.x, center.y, shape, radius)) cells.set(tilemapCellKey(cell.x, cell.y), cell); return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  }
  function recomputeAutoTileCoordinates(tilemap, tileset, layerId, coordinates, setIds) {
    const targets = new Map(); for (const coordinate of coordinates || []) { targets.set(tilemapCellKey(coordinate.x, coordinate.y), coordinate); for (const neighbor of AUTO_TILE_NEIGHBORS) targets.set(tilemapCellKey(coordinate.x + neighbor.dx, coordinate.y + neighbor.dy), { x: coordinate.x + neighbor.dx, y: coordinate.y + neighbor.dy }); }
    const changed = []; for (const target of targets.values()) for (const setId of [...new Set((setIds || []).filter(Boolean))]) if (recomputeAutoTileCell(tilemap, tileset, layerId, target.x, target.y, setId)) changed.push({ ...target, autoTileSetId: setId }); return changed;
  }
  function paintTerrainCells(tilemap, layerId, coordinates, tileset, terrainBrushId) {
    const brush = getTerrainBrushById(tileset, terrainBrushId); const layer = getTilemapLayer(tilemap, layerId);
    if (!layer || layer.locked || layer.visible === false) return { changed: false, count: 0, reason: !layer ? 'missing-layer' : (layer.locked ? 'locked-layer' : 'hidden-layer'), derivedChanges: [] };
    if (!terrainBrushCanPaint(tileset, brush)) return { changed: false, count: 0, reason: 'invalid-terrain-brush', derivedChanges: [] };
    const unique = new Map(); for (const coordinate of coordinates || []) if (isSafeCellCoordinate(coordinate.x) && isSafeCellCoordinate(coordinate.y)) unique.set(tilemapCellKey(coordinate.x, coordinate.y), coordinate);
    const oldSetIds = new Set(); let count = 0;
    for (const coordinate of unique.values()) {
      const previous = getTilemapCell(tilemap, layerId, coordinate.x, coordinate.y); if (previous && previous.autoTileSetId) oldSetIds.add(previous.autoTileSetId);
      const tileId = brush.mode === 'weighted-tiles' ? resolveTerrainWeightedTile(tileset, brush, layerId, coordinate.x, coordinate.y) : resolveAutoTileOutput(tileset, getAutoTileSetById(tileset, brush.autoTileSetId), 0, previous && previous.tileId);
      const result = setTilemapCell(tilemap, layerId, coordinate.x, coordinate.y, tileId, { terrainBrushId: brush.id, autoTileSetId: brush.mode === 'auto-tile' ? brush.autoTileSetId : null }); if (result.changed) count++;
    }
    if (brush.mode === 'auto-tile') oldSetIds.add(brush.autoTileSetId); const derivedChanges = recomputeAutoTileCoordinates(tilemap, tileset, layerId, [...unique.values()], [...oldSetIds]);
    return { changed: count > 0 || derivedChanges.length > 0, count, derivedChanges };
  }
  function paintTerrainCell(tilemap, layerId, x, y, tileset, terrainBrushId) { return paintTerrainCells(tilemap, layerId, [{ x, y }], tileset, terrainBrushId); }
  function eraseTerrainCells(tilemap, layerId, coordinates, tileset) {
    const layer = getTilemapLayer(tilemap, layerId); if (!layer || layer.locked || layer.visible === false) return { changed: false, count: 0, reason: !layer ? 'missing-layer' : (layer.locked ? 'locked-layer' : 'hidden-layer'), derivedChanges: [] };
    const unique = new Map(); for (const coordinate of coordinates || []) unique.set(tilemapCellKey(coordinate.x, coordinate.y), coordinate); const oldSetIds = new Set(); let count = 0;
    for (const coordinate of unique.values()) { const previous = getTilemapCell(tilemap, layerId, coordinate.x, coordinate.y); if (previous && previous.autoTileSetId) oldSetIds.add(previous.autoTileSetId); if (eraseTilemapCell(tilemap, layerId, coordinate.x, coordinate.y).changed) count++; }
    const derivedChanges = recomputeAutoTileCoordinates(tilemap, tileset, layerId, [...unique.values()], [...oldSetIds]); return { changed: count > 0 || derivedChanges.length > 0, count, derivedChanges };
  }
  function recomputeTerrainBrushUsage(project, tilesetId, terrainBrushId) {
    const tileset = getTilesetById(project && project.tilesets, tilesetId); const brush = getTerrainBrushById(tileset, terrainBrushId); const changes = []; if (!tileset || !brush || !terrainBrushCanPaint(tileset, brush)) return changes;
    for (const tilemap of projectTilemaps(project)) if (tilemap.tilesetRef === tilesetId) for (const layer of tilemap.layers || []) { const cells = (layer.cells || []).filter((cell) => cell.terrainBrushId === terrainBrushId); const oldSets = new Set(cells.map((cell) => cell.autoTileSetId).filter(Boolean)); for (const cell of cells) { const tileId = brush.mode === 'weighted-tiles' ? resolveTerrainWeightedTile(tileset, brush, layer.id, cell.x, cell.y) : cell.tileId; const desiredSet = brush.mode === 'auto-tile' ? brush.autoTileSetId : null; if (cell.tileId !== tileId || (cell.autoTileSetId || null) !== desiredSet) { cell.tileId = tileId; if (desiredSet) cell.autoTileSetId = desiredSet; else delete cell.autoTileSetId; changes.push({ tilemapId: tilemap.id, layerId: layer.id, x: cell.x, y: cell.y, terrainBrushId }); } } if (brush.mode === 'auto-tile') oldSets.add(brush.autoTileSetId); for (const derived of recomputeAutoTileCoordinates(tilemap, tileset, layer.id, cells, [...oldSets])) changes.push({ tilemapId: tilemap.id, layerId: layer.id, ...derived, terrainBrushId }); }
    return changes;
  }
  function recomputeProjectTerrain(project) { const changes = []; for (const tileset of project && project.tilesets || []) for (const brush of tileset.terrainBrushes || []) changes.push(...recomputeTerrainBrushUsage(project, tileset.id, brush.id)); return changes; }
  function terrainBrushUsage(project, tilesetId, terrainBrushId) { const uses = []; for (const tilemap of projectTilemaps(project)) if (tilemap.tilesetRef === tilesetId) for (const layer of tilemap.layers || []) { const cells = (layer.cells || []).filter((cell) => cell.terrainBrushId === terrainBrushId); if (cells.length) uses.push({ tilemapId: tilemap.id, tilemapName: tilemap.name, layerId: layer.id, layerName: layer.name, cellCount: cells.length }); } return uses; }
  function convertTerrainCellsToManual(project, tilesetId, terrainBrushId) { let count = 0; for (const tilemap of projectTilemaps(project)) if (tilemap.tilesetRef === tilesetId) for (const layer of tilemap.layers || []) for (const cell of layer.cells || []) if (cell.terrainBrushId === terrainBrushId) { delete cell.terrainBrushId; delete cell.autoTileSetId; count++; } return count; }
  function reassignTerrainCells(project, tilesetId, fromBrushId, toBrushId) { let count = 0; for (const tilemap of projectTilemaps(project)) if (tilemap.tilesetRef === tilesetId) for (const layer of tilemap.layers || []) for (const cell of layer.cells || []) if (cell.terrainBrushId === fromBrushId) { cell.terrainBrushId = toBrushId; count++; } recomputeTerrainBrushUsage(project, tilesetId, toBrushId); return count; }
  function clearTilemapLayer(tilemap, layerId) { const layer = getTilemapLayer(tilemap, layerId); if (!layer || layer.locked || !layer.cells.length) return false; layer.cells = []; invalidateTilemapCellIndex(tilemap); return true; }
  function clearTilemapCells(tilemap) {
    const count = tilemapCellCount(tilemap); if (!count) return false;
    for (const layer of tilemap.layers || []) layer.cells = []; invalidateTilemapCellIndex(tilemap); return true;
  }
  function tilemapCellCount(tilemap, layerId) { if (layerId) return ensureTilemapCellIndex(tilemap, layerId).byKey.size; return (tilemap && tilemap.layers || []).reduce((sum, layer) => sum + ensureTilemapCellIndex(tilemap, layer.id).byKey.size, 0); }
  function tilemapOccupiedBounds(tilemap, layerId) {
    const layers = layerId ? [getTilemapLayer(tilemap, layerId)].filter(Boolean) : (tilemap && tilemap.layers || []);
    const cells = layers.flatMap((layer) => [...ensureTilemapCellIndex(tilemap, layer.id).byKey.values()]); if (!cells.length) return null;
    return cells.reduce((bounds, cell) => ({ minX: Math.min(bounds.minX, cell.x), maxX: Math.max(bounds.maxX, cell.x), minY: Math.min(bounds.minY, cell.y), maxY: Math.max(bounds.maxY, cell.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  }
  function tilemapStrokeCells(fromX, fromY, toX, toY) {
    if (![fromX, fromY, toX, toY].every(isSafeCellCoordinate)) return [];
    const cells = []; let x = fromX; let y = fromY; const dx = Math.abs(toX - fromX); const dy = Math.abs(toY - fromY);
    const sx = fromX < toX ? 1 : -1; const sy = fromY < toY ? 1 : -1; let error = dx - dy;
    while (true) {
      cells.push({ x, y }); if (x === toX && y === toY) break;
      const doubled = error * 2; if (doubled > -dy) { error -= dy; x += sx; } if (doubled < dx) { error += dx; y += sy; }
    }
    return cells;
  }
  function tilemapUsedTileIds(tilemap) { return [...new Set((tilemap && tilemap.layers || []).flatMap((layer) => serializeTilemapCells(tilemap, layer.id).map((cell) => cell.tileId)))].sort(); }
  function addTilemapLayer(tilemap, input, aboveLayerId) {
    if (!tilemap || !Array.isArray(tilemap.layers)) return null; const source = input || {};
    const layer = normalizeTilemapLayer({ ...source, id: uniqueTilemapLayerId(tilemap, source.id), name: uniqueTilemapLayerName(tilemap, source.name || 'Layer') }, null, 'Layer');
    const at = aboveLayerId ? tilemap.layers.findIndex((entry) => entry.id === aboveLayerId) + 1 : tilemap.layers.length;
    tilemap.layers.splice(Math.max(0, at), 0, layer); invalidateTilemapCellIndex(tilemap); return layer;
  }
  function renameTilemapLayer(tilemap, layerId, name) { const layer = getTilemapLayer(tilemap, layerId); const trimmed = String(name || '').trim(); if (!layer || !trimmed || (tilemap.layers || []).some((entry) => entry.id !== layerId && String(entry.name).trim().toLowerCase() === trimmed.toLowerCase())) return false; layer.name = trimmed; return true; }
  function reorderTilemapLayer(tilemap, layerId, delta) { const index = tilemap && tilemap.layers ? tilemap.layers.findIndex((layer) => layer.id === layerId) : -1; const target = index + Math.sign(Number(delta) || 0); if (index < 0 || target < 0 || target >= tilemap.layers.length) return false; [tilemap.layers[index], tilemap.layers[target]] = [tilemap.layers[target], tilemap.layers[index]]; return true; }
  function setTilemapLayerVisibility(tilemap, layerId, visible) { const layer = getTilemapLayer(tilemap, layerId); if (!layer || typeof visible !== 'boolean' || layer.visible === visible) return false; layer.visible = visible; return true; }
  function setTilemapLayerLocked(tilemap, layerId, locked) { const layer = getTilemapLayer(tilemap, layerId); if (!layer || typeof locked !== 'boolean' || layer.locked === locked) return false; layer.locked = locked; return true; }
  function duplicateTilemapLayer(tilemap, layerId) { const source = getTilemapLayer(tilemap, layerId); if (!source) return null; return addTilemapLayer(tilemap, { ...source, ...Filters.normalizeFilter(source), id: undefined, name: `${source.name} Copy`, cells: source.cells.map((cell) => ({ ...cell })) }, source.id); }
  function deleteTilemapLayer(tilemap, layerId) { if (!tilemap || !Array.isArray(tilemap.layers) || tilemap.layers.length <= 1) return null; const index = tilemap.layers.findIndex((layer) => layer.id === layerId); if (index < 0) return null; const removed = tilemap.layers.splice(index, 1)[0]; invalidateTilemapCellIndex(tilemap); return removed; }
  function validateTilemapRecord(tilemap, tileset) {
    const problems = [];
    if (!tilemap || tilemap.kind !== 'tilemap') return problems;
    if (![1, 2, 3, 4, 5, 6].includes(tilemap.version)) problems.push({ code: 'tilemap-version-unsupported', field: 'version', message: 'Tilemap record version must be 1 through 6.' });
    if (!tilemap.id || !String(tilemap.name || '').trim()) problems.push({ code: 'tilemap-identity-required', message: 'Tilemap requires a stable Object ID and display name.' });
    const layers = tilemap.version === 1 ? [{ id: DEFAULT_TILEMAP_LAYER_ID, name: 'Layer 1', visible: true, locked: false, cells: tilemap.cells }] : tilemap.layers;
    if (!Array.isArray(layers) || !layers.length) { problems.push({ code: 'tilemap-layers-required', field: 'layers', message: 'Tilemap requires at least one Tile Layer.' }); return problems; }
    const layerIds = new Set(); const layerNames = new Set(); const missingCounts = new Map(); const missingSetCounts = new Map(); const missingTerrainCounts = new Map();
    const tileIds = new Set((tileset && Array.isArray(tileset.tiles) ? tileset.tiles : []).map((tile) => tile.id));
    layers.forEach((layer, layerIndex) => {
      const prefix = `layers[${layerIndex}]`; if (!layer || typeof layer !== 'object') { problems.push({ code: 'tilemap-layer-invalid', field: prefix, message: `Tilemap Layer ${layerIndex + 1} is malformed.` }); return; }
      const layerId = String(layer.id || ''); const layerName = String(layer.name || '').trim();
      if (!layerId) problems.push({ code: 'tilemap-layer-id-required', field: `${prefix}.id`, layerIndex, message: `Tilemap Layer ${layerIndex + 1} requires a stable ID.` });
      else if (layerIds.has(layerId)) problems.push({ code: 'duplicate-tilemap-layer-id', field: `${prefix}.id`, layerId, message: `Tilemap repeats Layer ID "${layerId}".` });
      layerIds.add(layerId);
      if (!layerName) problems.push({ code: 'tilemap-layer-name-required', field: `${prefix}.name`, layerId, message: `Tilemap Layer ${layerIndex + 1} requires a name.` });
      else if (layerNames.has(layerName.toLowerCase())) problems.push({ code: 'duplicate-tilemap-layer-name', field: `${prefix}.name`, layerId, message: `Tilemap repeats Layer name "${layerName}".` });
      layerNames.add(layerName.toLowerCase());
      if (typeof layer.visible !== 'boolean') problems.push({ code: 'tilemap-layer-visible-boolean', field: `${prefix}.visible`, layerId, message: `Tilemap Layer "${layerName || layerId}" visibility must be true or false.` });
      if (typeof layer.locked !== 'boolean') problems.push({ code: 'tilemap-layer-locked-boolean', field: `${prefix}.locked`, layerId, message: `Tilemap Layer "${layerName || layerId}" lock must be true or false.` });
      if (tilemap.version >= 5 && typeof layer.collisionEnabled !== 'boolean') problems.push({ code: 'tilemap-layer-collision-enabled-boolean', field: `${prefix}.collisionEnabled`, layerId, message: `Tilemap Layer "${layerName || layerId}" Collision Enabled must be true or false.` });
      if (!Array.isArray(layer.cells)) { problems.push({ code: 'tilemap-layer-cells-invalid', field: `${prefix}.cells`, layerId, message: `Tilemap Layer "${layerName || layerId}" Cells must be a sparse list.` }); return; }
      const coordinates = new Set(); layer.cells.forEach((cell, index) => {
      const x = cell && cell.x; const y = cell && cell.y; const tileId = String(cell && cell.tileId || '');
      if (!isSafeCellCoordinate(x) || !isSafeCellCoordinate(y)) { problems.push({ code: 'tilemap-cell-coordinate-integer', field: `${prefix}.cells[${index}]`, layerId, cellX: x, cellY: y, message: `Tilemap Cell ${index + 1} in Layer "${layerName || layerId}" requires safe integer X and Y coordinates.` }); return; }
      const key = tilemapCellKey(x, y);
      if (coordinates.has(key)) problems.push({ code: 'duplicate-tilemap-cell', field: `${prefix}.cells[${index}]`, layerId, cellX: x, cellY: y, message: `Layer "${layerName || layerId}" repeats Cell (${x}, ${y}); runtime uses the last record deterministically.` });
      coordinates.add(key);
      if (!tileId) problems.push({ code: 'tilemap-cell-tile-required', field: `${prefix}.cells[${index}].tileId`, layerId, cellX: x, cellY: y, message: `Tilemap Cell (${x}, ${y}) in Layer "${layerName || layerId}" requires a Tile.` });
      else if (tileset && !tileIds.has(tileId)) { const key = `${layerId}\u0000${tileId}`; const previous = missingCounts.get(key); missingCounts.set(key, { layerId, layerName, tileId, count: previous ? previous.count + 1 : 1 }); }
      const autoTileSetId = String(cell && cell.autoTileSetId || ''); if (autoTileSetId && tileset && !getAutoTileSetById(tileset, autoTileSetId)) { const aggregateKey = `${layerId}\u0000${autoTileSetId}`; const previous = missingSetCounts.get(aggregateKey); missingSetCounts.set(aggregateKey, { layerId, layerName, autoTileSetId, count: previous ? previous.count + 1 : 1, cellX: previous ? previous.cellX : x, cellY: previous ? previous.cellY : y }); }
      const terrainBrushId = String(cell && cell.terrainBrushId || ''); const terrainBrush = terrainBrushId && tileset ? getTerrainBrushById(tileset, terrainBrushId) : null;
      if (terrainBrushId && tileset && !terrainBrush) { const aggregateKey = `${layerId}\u0000${terrainBrushId}`; const previous = missingTerrainCounts.get(aggregateKey); missingTerrainCounts.set(aggregateKey, { layerId, layerName, terrainBrushId, count: previous ? previous.count + 1 : 1, cellX: previous ? previous.cellX : x, cellY: previous ? previous.cellY : y }); }
      else if (terrainBrush && terrainBrush.mode === 'weighted-tiles' && autoTileSetId) problems.push({ code: 'terrain-cell-weighted-has-auto-set', field: `${prefix}.cells[${index}]`, layerId, cellX: x, cellY: y, terrainBrushId, autoTileSetId, message: `Weighted Terrain cell (${x}, ${y}) must not carry Auto-Tile Set identity.` });
      else if (terrainBrush && terrainBrush.mode === 'auto-tile' && autoTileSetId !== terrainBrush.autoTileSetId) problems.push({ code: 'terrain-cell-auto-set-mismatch', field: `${prefix}.cells[${index}]`, layerId, cellX: x, cellY: y, terrainBrushId, autoTileSetId: autoTileSetId || null, message: `Connected Terrain cell (${x}, ${y}) must use its Brush's Auto-Tile Set.` });
      });
    });
    for (const entry of missingCounts.values()) problems.push({ code: 'tilemap-missing-tile', field: 'layers', layerId: entry.layerId, tileId: entry.tileId, count: entry.count, message: `${entry.count} cell${entry.count === 1 ? '' : 's'} in Layer "${entry.layerName || entry.layerId}" reference missing Tile "${entry.tileId}".` });
    for (const entry of missingSetCounts.values()) problems.push({ code: 'tilemap-missing-auto-tile-set', field: 'layers', layerId: entry.layerId, autoTileSetId: entry.autoTileSetId, count: entry.count, cellX: entry.cellX, cellY: entry.cellY, message: `${entry.count} cell${entry.count === 1 ? '' : 's'} in Layer "${entry.layerName || entry.layerId}" reference missing Auto-Tile Set "${entry.autoTileSetId}"; stored Tiles remain visible.` });
    for (const entry of missingTerrainCounts.values()) problems.push({ code: 'tilemap-missing-terrain-brush', field: 'layers', layerId: entry.layerId, terrainBrushId: entry.terrainBrushId, count: entry.count, cellX: entry.cellX, cellY: entry.cellY, message: `${entry.count} cell${entry.count === 1 ? '' : 's'} in Layer "${entry.layerName || entry.layerId}" reference missing Terrain Brush "${entry.terrainBrushId}"; stored Tiles remain visible.` });
    if (!Number.isInteger(tilemap.orderInLayer)) problems.push({ code: 'tilemap-order-in-layer-integer', field: 'orderInLayer', message: 'Tilemap Order in Layer must be an integer.' });
    const right = tilemap.entity && tilemap.entity.right;
    if (right && Number.isFinite(right.x) && Number.isFinite(right.y) && Math.abs(right.y) > 0.01 * Math.hypot(right.x, right.y)) {
      const oneWayTiles = new Set((tileset && tileset.tiles || []).filter((tile) => resolveTileCollision(tile).oneWay).map((tile) => tile.id));
      if (oneWayTiles.size && layers.some((layer) => layer && layer.collisionEnabled !== false && (layer.cells || []).some((cell) => oneWayTiles.has(cell.tileId)))) problems.push({ code: 'tilemap-one-way-rotated-solid-fallback', severity: 'warning', field: 'rotation', message: 'One-Way Tile tops require a world-horizontal Tilemap; this rotation falls back to solid Character collision. Slopes arrive in Phase 047.' });
    }
    if (tilemap.version >= 4 || tilemap.spawnMarkers !== undefined) problems.push(...validateSpawnMarkers(tilemap));
    return problems;
  }

  // Phase 038: reusable Tilemap regions are authoring Assets. A stamp is
  // planned against a clone and then materialized; no Chunk identity enters
  // the Tilemap or runtime record.
  const TILEMAP_CHUNK_VERSION = 1;
  function chunkSlug(value, fallback) { return String(value || fallback || 'chunk').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(fallback || 'chunk'); }
  function normalizeChunkMarker(marker) { const source = marker || {}; return { id: String(source.id || ''), name: String(source.name || '').trim(), x: Number(source.x), y: Number(source.y), prefabRef: source.prefabRef == null || String(source.prefabRef).trim() === '' ? null : String(source.prefabRef) }; }
  function normalizeTilemapChunk(input) {
    const source = input || {}; const width = Number(source.width); const height = Number(source.height);
    return {
      id: String(source.id || ''), type: 'tilemap-chunk', version: source.version == null ? TILEMAP_CHUNK_VERSION : Number(source.version), name: String(source.name || 'Tilemap Chunk').trim() || 'Tilemap Chunk', tilesetRef: source.tilesetRef == null ? null : String(source.tilesetRef),
      width, height,
      layers: (Array.isArray(source.layers) ? source.layers : []).map((layer, index) => ({ id: String(layer && layer.id || `chunk-layer-${index + 1}`), name: String(layer && layer.name || `Layer ${index + 1}`).trim(), cells: canonicalizeTilemapCells(layer && layer.cells) })),
      spawnMarkers: (Array.isArray(source.spawnMarkers) ? source.spawnMarkers : []).map(normalizeChunkMarker).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)),
      folder: source.folder || undefined, tags: Array.isArray(source.tags) && source.tags.length ? source.tags.slice() : undefined,
    };
  }
  function tilemapChunkCellCount(chunk) { return (chunk && chunk.layers || []).reduce((sum, layer) => sum + (layer.cells || []).length, 0); }
  function uniqueTilemapChunkId(chunks, preferred) { const used = new Set((chunks || []).map((chunk) => chunk.id)); const root = chunkSlug(preferred, 'tilemap-chunk'); if (!used.has(root)) return root; let suffix = 2; while (used.has(`${root}-${suffix}`)) suffix++; return `${root}-${suffix}`; }
  function uniqueTilemapChunkName(chunks, preferred, excludeId) { const root = String(preferred || 'Tilemap Chunk').trim() || 'Tilemap Chunk'; const used = new Set((chunks || []).filter((chunk) => chunk.id !== excludeId).map((chunk) => String(chunk.name || '').trim().toLowerCase())); if (!used.has(root.toLowerCase())) return root; let suffix = 2; while (used.has(`${root} ${suffix}`.toLowerCase())) suffix++; return `${root} ${suffix}`; }
  function captureTilemapChunk(tilemap, options) {
    const opts = options || {}; const from = opts.from || opts.start || {}; const to = opts.to || opts.end || from;
    if (!tilemap || ![from.x, from.y, to.x, to.y].every(isSafeCellCoordinate)) return null;
    const minX = Math.min(from.x, to.x); const maxX = Math.max(from.x, to.x); const minY = Math.min(from.y, to.y); const maxY = Math.max(from.y, to.y);
    const selected = new Set(Array.isArray(opts.layerIds) ? opts.layerIds : [opts.activeLayerId || (defaultTilemapLayer(tilemap) || {}).id]); const layers = [];
    for (const source of tilemap.layers || []) if (selected.has(source.id)) layers.push({ id: uniqueTilemapLayerId({ layers }, `chunk-${chunkSlug(source.name, 'layer')}`), name: source.name, cells: canonicalizeTilemapCells((source.cells || []).filter((cell) => cell.x >= minX && cell.x <= maxX && cell.y >= minY && cell.y <= maxY).map((cell) => ({ ...cell, x: cell.x - minX, y: cell.y - minY }))) });
    const markerHost = { spawnMarkers: [] }; const markers = [];
    if (opts.includeSpawnMarkers === true) for (const source of tilemap.spawnMarkers || []) if (source.x >= minX && source.x <= maxX && source.y >= minY && source.y <= maxY) { const marker = normalizeChunkMarker({ ...source, id: uniqueSpawnMarkerId(markerHost, source.id), x: source.x - minX, y: source.y - minY }); marker.name = uniqueSpawnMarkerName(markerHost, marker.name || 'Spawn'); markerHost.spawnMarkers.push(marker); markers.push(marker); }
    const draft = normalizeTilemapChunk({ id: opts.id || chunkSlug(opts.name, 'tilemap-chunk'), name: opts.name || 'Tilemap Chunk', tilesetRef: tilemap.tilesetRef, width: maxX - minX + 1, height: maxY - minY + 1, layers, spawnMarkers: markers, folder: opts.folder, tags: opts.tags });
    if (!tilemapChunkCellCount(draft) && !draft.spawnMarkers.length) return null;
    return opts.tileset ? normalizeTilemapChunkSemantics(draft, opts.tileset) : draft;
  }
  function normalizeTilemapChunkSemantics(chunk, tileset) {
    const normalized = normalizeTilemapChunk(chunk); if (!tileset) return normalized;
    const virtual = createTilemapRecord({ id: normalized.id, name: normalized.name, tilesetRef: normalized.tilesetRef, layers: normalized.layers.map((layer) => ({ id: layer.id, name: layer.name, visible: true, locked: false, cells: layer.cells })) });
    for (const layer of virtual.layers) for (const cell of layer.cells) if (cell.terrainBrushId) { const brush = getTerrainBrushById(tileset, cell.terrainBrushId); if (brush && brush.mode === 'weighted-tiles') { cell.tileId = resolveTerrainWeightedTile(tileset, brush, layer.id, cell.x, cell.y); delete cell.autoTileSetId; } else if (brush && brush.mode === 'auto-tile') cell.autoTileSetId = brush.autoTileSetId; }
    recomputeAutoTilemap(virtual, tileset);
    normalized.layers = virtual.layers.map((layer) => ({ id: layer.id, name: layer.name, cells: canonicalizeTilemapCells(layer.cells) })); return normalized;
  }
  function duplicateTilemapChunk(chunk, id, name) { return normalizeTilemapChunk({ ...clone(chunk), id, name: name || `${chunk.name} Copy` }); }
  function tilemapChunkDependencies(chunk) {
    const refs = []; if (chunk && chunk.tilesetRef) refs.push({ assetType: 'tileset', id: chunk.tilesetRef });
    for (const marker of chunk && chunk.spawnMarkers || []) if (marker.prefabRef) refs.push({ assetType: 'prefab', id: marker.prefabRef }); return refs;
  }
  function validateTilemapChunk(chunk, tileset, prefabs) {
    const problems = []; if (!chunk || typeof chunk !== 'object') return [{ code: 'tilemap-chunk-malformed', message: 'Tilemap Chunk record is malformed.' }];
    if (!chunk.id || !String(chunk.name || '').trim()) problems.push({ code: 'tilemap-chunk-identity-required', message: 'Tilemap Chunk requires a stable Asset ID and display name.' });
    if (chunk.type !== 'tilemap-chunk') problems.push({ code: 'tilemap-chunk-type-invalid', field: 'type', message: 'Tilemap Chunk Asset type must be tilemap-chunk.' });
    if (chunk.version !== TILEMAP_CHUNK_VERSION) problems.push({ code: 'tilemap-chunk-version-unsupported', field: 'version', message: 'Tilemap Chunk version must be 1.' });
    if (!Number.isSafeInteger(chunk.width) || chunk.width <= 0 || !Number.isSafeInteger(chunk.height) || chunk.height <= 0) problems.push({ code: 'tilemap-chunk-bounds-invalid', field: 'width', message: 'Tilemap Chunk Width and Height must be positive integers.' });
    if (!chunk.tilesetRef) problems.push({ code: 'tilemap-chunk-tileset-required', field: 'tilesetRef', message: 'Tilemap Chunk requires one Tileset.' });
    const tileIds = new Set((tileset && tileset.tiles || []).map((tile) => tile.id)); const prefabIds = prefabs ? new Set((prefabs || []).map((prefab) => typeof prefab === 'string' ? prefab : prefab && (prefab.name || prefab.id)).filter(Boolean)) : null;
    const ids = new Set(); const names = new Set();
    if (!Array.isArray(chunk.layers)) problems.push({ code: 'tilemap-chunk-layers-invalid', field: 'layers', message: 'Tilemap Chunk Layers must be a list.' });
    else chunk.layers.forEach((layer, layerIndex) => { const prefix = `layers[${layerIndex}]`; const id = String(layer && layer.id || ''); const name = String(layer && layer.name || '').trim();
      if (!id) problems.push({ code: 'tilemap-chunk-layer-id-required', field: `${prefix}.id`, message: 'Chunk Layer requires a stable local ID.' }); else if (ids.has(id)) problems.push({ code: 'duplicate-tilemap-chunk-layer-id', field: `${prefix}.id`, layerId: id, message: `Chunk repeats Layer ID "${id}".` }); ids.add(id);
      if (!name) problems.push({ code: 'tilemap-chunk-layer-name-required', field: `${prefix}.name`, message: 'Chunk Layer requires a name.' }); else if (names.has(name.toLowerCase())) problems.push({ code: 'duplicate-tilemap-chunk-layer-name', field: `${prefix}.name`, message: `Chunk repeats Layer name "${name}".` }); names.add(name.toLowerCase());
      if (!Array.isArray(layer && layer.cells)) { problems.push({ code: 'tilemap-chunk-layer-cells-invalid', field: `${prefix}.cells`, message: 'Chunk Layer Cells must be sparse records.' }); return; }
      const coordinates = new Set(); layer.cells.forEach((cell, index) => { const field = `${prefix}.cells[${index}]`; const x = cell && cell.x; const y = cell && cell.y; const key = tilemapCellKey(x, y);
        if (!isSafeCellCoordinate(x) || !isSafeCellCoordinate(y) || x < 0 || y < 0 || x >= chunk.width || y >= chunk.height) problems.push({ code: 'tilemap-chunk-cell-out-of-bounds', field, layerId: id, cellX: x, cellY: y, message: 'Chunk Cell must use an in-bounds integer relative coordinate.' });
        if (coordinates.has(key)) problems.push({ code: 'duplicate-tilemap-chunk-cell', field, layerId: id, cellX: x, cellY: y, message: `Chunk Layer repeats Cell (${x}, ${y}).` }); coordinates.add(key);
        if (!cell || !cell.tileId || (tileset && !tileIds.has(cell.tileId))) problems.push({ code: 'tilemap-chunk-missing-tile', field: `${field}.tileId`, tileId: cell && cell.tileId || null, message: 'Chunk Cell references a missing Tile.' });
        const set = cell && cell.autoTileSetId ? getAutoTileSetById(tileset, cell.autoTileSetId) : null; const brush = cell && cell.terrainBrushId ? getTerrainBrushById(tileset, cell.terrainBrushId) : null;
        if (cell && cell.autoTileSetId && tileset && !set) problems.push({ code: 'tilemap-chunk-missing-auto-tile-set', field: `${field}.autoTileSetId`, autoTileSetId: cell.autoTileSetId, message: 'Chunk Cell references a missing Auto-Tile Set.' });
        if (cell && cell.terrainBrushId && tileset && !brush) problems.push({ code: 'tilemap-chunk-missing-terrain-brush', field: `${field}.terrainBrushId`, terrainBrushId: cell.terrainBrushId, message: 'Chunk Cell references a missing Terrain Brush.' });
        if (brush && brush.mode === 'weighted-tiles' && cell.autoTileSetId) problems.push({ code: 'tilemap-chunk-semantic-contradiction', field, message: 'Weighted Terrain Chunk Cell cannot carry Auto-Tile identity.' });
        if (brush && brush.mode === 'auto-tile' && cell.autoTileSetId !== brush.autoTileSetId) problems.push({ code: 'tilemap-chunk-semantic-contradiction', field, message: 'Connected Terrain Chunk Cell must use its Brush Auto-Tile Set.' });
      });
    });
    const markerIds = new Set(); if (!Array.isArray(chunk.spawnMarkers)) problems.push({ code: 'tilemap-chunk-markers-invalid', field: 'spawnMarkers', message: 'Chunk Spawn Marker templates must be a list.' }); else chunk.spawnMarkers.forEach((marker, index) => { const field = `spawnMarkers[${index}]`; const id = String(marker && marker.id || '');
      if (!id || markerIds.has(id)) problems.push({ code: id ? 'duplicate-tilemap-chunk-marker-id' : 'tilemap-chunk-marker-id-required', field: `${field}.id`, message: 'Chunk Marker template requires a unique stable local ID.' }); markerIds.add(id);
      if (!marker || !String(marker.name || '').trim()) problems.push({ code: 'tilemap-chunk-marker-name-required', field: `${field}.name`, message: 'Chunk Marker template requires a name.' });
      if (!marker || !isSafeCellCoordinate(marker.x) || !isSafeCellCoordinate(marker.y) || marker.x < 0 || marker.y < 0 || marker.x >= chunk.width || marker.y >= chunk.height) problems.push({ code: 'tilemap-chunk-marker-out-of-bounds', field, markerId: id || null, message: 'Chunk Marker template must use an in-bounds integer relative coordinate.' });
      if (marker && marker.prefabRef && prefabIds && !prefabIds.has(marker.prefabRef)) problems.push({ code: 'tilemap-chunk-missing-prefab', field: `${field}.prefabRef`, markerId: id || null, prefabRef: marker.prefabRef, message: `Chunk Marker references missing Prefab "${marker.prefabRef}".` });
    });
    if (!tilemapChunkCellCount(chunk) && !(chunk.spawnMarkers || []).length) problems.push({ code: 'tilemap-chunk-empty', message: 'Tilemap Chunk must contain at least one Cell or Spawn Marker template.' }); return problems;
  }
  function suggestTilemapChunkLayerMapping(chunk, target, activeLayerId) {
    const mapping = {}; const claimed = new Set(); for (const layer of chunk && chunk.layers || []) { let targetId = null; if ((chunk.layers || []).length === 1 && getTilemapLayer(target, activeLayerId)) targetId = activeLayerId; else { const matches = (target && target.layers || []).filter((candidate) => String(candidate.name).toLowerCase() === String(layer.name).toLowerCase()); if (matches.length === 1) targetId = matches[0].id; } if (targetId && !claimed.has(targetId)) { mapping[layer.id] = targetId; claimed.add(targetId); } else mapping[layer.id] = null; } return mapping;
  }
  function resolveChunkMappingEntry(entry) { if (typeof entry === 'string') return { targetLayerId: entry, create: false }; if (entry && entry.create) return { create: true, name: String(entry.name || '').trim() }; return { targetLayerId: entry && entry.targetLayerId || null, create: false }; }
  function validateTilemapChunkLayerMapping(chunk, target, mapping) { const problems = []; const used = new Set(); for (const layer of chunk && chunk.layers || []) { const entry = resolveChunkMappingEntry(mapping && mapping[layer.id]); if (entry.create) { if (!entry.name) entry.name = layer.name; continue; } const targetLayer = getTilemapLayer(target, entry.targetLayerId); if (!targetLayer) problems.push({ code: 'tilemap-chunk-layer-mapping-required', layerId: layer.id, message: `Chunk Layer "${layer.name}" needs a target Layer.` }); else if (used.has(targetLayer.id)) problems.push({ code: 'tilemap-chunk-layer-mapping-duplicate', layerId: layer.id, targetLayerId: targetLayer.id, message: 'Two Chunk Layers cannot map to the same target Layer.' }); else if (targetLayer.locked) problems.push({ code: 'tilemap-chunk-target-layer-locked', layerId: layer.id, targetLayerId: targetLayer.id, message: `Target Layer "${targetLayer.name}" is locked.` }); else if (targetLayer.visible === false) problems.push({ code: 'tilemap-chunk-target-layer-hidden', layerId: layer.id, targetLayerId: targetLayer.id, message: `Target Layer "${targetLayer.name}" is hidden.` }); used.add(targetLayer.id); } return problems; }
  function planTilemapChunkStamp(chunk, target, tileset, anchor, mapping, prefabs) {
    const normalized = normalizeTilemapChunk(chunk); const problems = validateTilemapChunk(normalized, tileset, prefabs).filter((entry) => entry.severity !== 'warning');
    if (!target || target.kind !== 'tilemap') problems.push({ code: 'tilemap-chunk-target-required', message: 'Stamp Chunk requires a target Tilemap.' });
    if (target && normalized.tilesetRef !== target.tilesetRef) problems.push({ code: 'tilemap-chunk-tileset-mismatch', message: 'Chunk and target Tilemap must use the same Tileset Asset.' });
    if (!anchor || !isSafeCellCoordinate(anchor.x) || !isSafeCellCoordinate(anchor.y)) problems.push({ code: 'tilemap-chunk-anchor-invalid', message: 'Stamp anchor must be an integer target cell.' });
    problems.push(...validateTilemapChunkLayerMapping(normalized, target, mapping)); if (problems.length) return { valid: false, problems, previewOnly: true };
    const before = createTilemapRecord(clone(target)); const after = createTilemapRecord(clone(target)); const resolvedMapping = {}; const newLayers = [];
    for (const chunkLayer of normalized.layers) { const entry = resolveChunkMappingEntry(mapping[chunkLayer.id]); if (entry.create) { const newLayer = addTilemapLayer(after, { id: `tilemap-${chunkSlug(entry.name || chunkLayer.name, 'layer')}`, name: entry.name || chunkLayer.name, visible: true, locked: false, cells: [] }); resolvedMapping[chunkLayer.id] = newLayer.id; newLayers.push({ chunkLayerId: chunkLayer.id, targetLayerId: newLayer.id, name: newLayer.name }); } else resolvedMapping[chunkLayer.id] = entry.targetLayerId; }
    let added = 0; let overwritten = 0; const written = [];
    for (const chunkLayer of normalized.layers) { const targetLayerId = resolvedMapping[chunkLayer.id]; for (const cell of chunkLayer.cells) { const x = anchor.x + cell.x; const y = anchor.y + cell.y; const previous = getTilemapCell(after, targetLayerId, x, y); if (previous) overwritten++; else added++; const next = { ...cell }; const brush = next.terrainBrushId && getTerrainBrushById(tileset, next.terrainBrushId); if (brush && brush.mode === 'weighted-tiles') { next.tileId = resolveTerrainWeightedTile(tileset, brush, targetLayerId, x, y); delete next.autoTileSetId; } else if (brush && brush.mode === 'auto-tile') next.autoTileSetId = brush.autoTileSetId; setTilemapCell(after, targetLayerId, x, y, next.tileId, { autoTileSetId: next.autoTileSetId || null, terrainBrushId: next.terrainBrushId || null }); written.push({ chunkLayerId: chunkLayer.id, targetLayerId, x, y }); } }
    recomputeAutoTilemap(after, tileset);
    const createdMarkers = []; const markerIdentityScope = { spawnMarkers: [...(after.spawnMarkers || []), ...normalized.spawnMarkers] };
    for (const template of normalized.spawnMarkers) { const freshId = uniqueSpawnMarkerId(markerIdentityScope, `${template.id || template.name || 'spawn'}-stamp`); const marker = createSpawnMarker(after, { id: freshId, name: template.name, x: anchor.x + template.x, y: anchor.y + template.y, prefabRef: template.prefabRef }); if (marker) { markerIdentityScope.spawnMarkers.push({ id: marker.id }); createdMarkers.push({ ...marker, templateId: template.id }); } }
    const beforeCells = new Map((before.layers || []).flatMap((layer) => layer.cells.map((cell) => [`${layer.id}:${cell.x},${cell.y}`, JSON.stringify(cell)]))); const changedCells = [];
    for (const layer of after.layers) for (const cell of layer.cells) { const key = `${layer.id}:${cell.x},${cell.y}`; if (beforeCells.get(key) !== JSON.stringify(cell)) changedCells.push({ layerId: layer.id, ...cell, direct: written.some((entry) => entry.targetLayerId === layer.id && entry.x === cell.x && entry.y === cell.y) }); beforeCells.delete(key); }
    for (const key of beforeCells.keys()) { const match = /^([^:]+):(-?\d+),(-?\d+)$/.exec(key); if (match) changedCells.push({ layerId: match[1], x: Number(match[2]), y: Number(match[3]), removed: true, direct: false }); }
    return { valid: true, problems: [], previewOnly: true, chunkId: normalized.id, anchor: { x: anchor.x, y: anchor.y }, bounds: { minX: anchor.x, minY: anchor.y, maxX: anchor.x + normalized.width - 1, maxY: anchor.y + normalized.height - 1, width: normalized.width, height: normalized.height }, mapping: resolvedMapping, cellsAdded: added, cellsOverwritten: overwritten, semanticCellWrites: written.length, neighborChanges: changedCells.filter((cell) => !cell.direct).length, changedCells, newLayers, markersCreated: createdMarkers, result: { layers: serializeTilemapLayers(after), spawnMarkers: canonicalizeSpawnMarkers(after.spawnMarkers) } };
  }
  function commitTilemapChunkStamp(target, plan) { if (!target || !plan || !plan.valid || !plan.result) return false; target.layers = plan.result.layers.map((layer, index) => normalizeTilemapLayer(layer, `tilemap-layer-${index + 1}`, `Layer ${index + 1}`)); target.spawnMarkers = canonicalizeSpawnMarkers(plan.result.spawnMarkers); invalidateTilemapCellIndex(target); return true; }
  function tilemapChunkUsage(chunks, predicate) { const uses = []; for (const chunk of chunks || []) { let count = 0; for (const layer of chunk.layers || []) for (const cell of layer.cells || []) if (predicate(cell, chunk)) count++; for (const marker of chunk.spawnMarkers || []) if (predicate(marker, chunk, true)) count++; if (count) uses.push({ chunkId: chunk.id, chunkName: chunk.name, count }); } return uses; }
  function tilemapChunkTileUsage(chunks, tilesetRef, tileId) { return tilemapChunkUsage(chunks, (cell, chunk, marker) => !marker && chunk.tilesetRef === tilesetRef && cell.tileId === tileId); }
  function tilemapChunkAutoTileUsage(chunks, tilesetRef, setId) { return tilemapChunkUsage(chunks, (cell, chunk, marker) => !marker && chunk.tilesetRef === tilesetRef && cell.autoTileSetId === setId); }
  function tilemapChunkTerrainUsage(chunks, tilesetRef, brushId) { return tilemapChunkUsage(chunks, (cell, chunk, marker) => !marker && chunk.tilesetRef === tilesetRef && cell.terrainBrushId === brushId); }
  function tilemapChunkPrefabUsage(chunks, prefabRef) { return tilemapChunkUsage(chunks, (entry, chunk, marker) => marker && entry.prefabRef === prefabRef); }
  function repairTilemapChunkDependency(chunk, kind, fromId, toId, tileset) { let count = 0; for (const layer of chunk && chunk.layers || []) for (const cell of layer.cells || []) { const field = kind === 'tile' ? 'tileId' : kind === 'auto-tile-set' ? 'autoTileSetId' : kind === 'terrain-brush' ? 'terrainBrushId' : null; if (field && cell[field] === fromId) { cell[field] = toId; count++; } } if (kind === 'prefab') for (const marker of chunk && chunk.spawnMarkers || []) if (marker.prefabRef === fromId) { marker.prefabRef = toId; count++; } if (count && tileset) { const normalized = normalizeTilemapChunkSemantics(chunk, tileset); Object.assign(chunk, normalized); } return count; }
  function recomputeProjectTilemapChunks(project, tilesetId) { const changes = []; const tileset = getTilesetById(project && project.tilesets, tilesetId); if (!tileset) return changes; for (const chunk of project && project.tilemapChunks || []) if (chunk.tilesetRef === tilesetId) { const normalized = normalizeTilemapChunkSemantics(chunk, tileset); if (JSON.stringify(normalized.layers) !== JSON.stringify(chunk.layers)) { chunk.layers = normalized.layers; changes.push({ chunkId: chunk.id }); } } return changes; }
  function createSpriteAnimationClip(input) {
    const source = input || {};
    return {
      id: source.id, type: 'sprite-animation', name: source.name || 'Sprite Animation', version: 3,
      // Version 1 clips had no mode and were always play-once. Normalizing
      // an absent/unknown value to once is the complete v1 -> v2 migration.
      playbackMode: source.playbackMode === 'loop' ? 'loop' : 'once',
      frames: Array.isArray(source.frames) ? source.frames.map((frame) => ({
        spriteAsset: frame && frame.spriteAsset || null,
        durationMs: frame && frame.durationMs !== undefined ? Number(frame.durationMs) : DEFAULT_SPRITE_FRAME_DURATION_MS,
        // v1/v2 migration: absent events normalize to the canonical empty
        // array. Event identity is clip-local and survives ordinary edits.
        events: Array.isArray(frame && frame.events) ? frame.events.map((event) => ({ id: String(event && event.id || ''), name: String(event && event.name || '') })) : [],
      })) : [],
      folder: source.folder || undefined, tags: Array.isArray(source.tags) && source.tags.length ? source.tags.slice() : undefined,
    };
  }
  function duplicateSpriteAnimationClip(asset, id, name) {
    return createSpriteAnimationClip({ ...asset, id, name: name || `${asset.name} Copy`, frames: (asset.frames || []).map((frame) => ({ ...frame, events: (frame.events || []).map((event) => ({ ...event })) })), tags: asset.tags && asset.tags.slice() });
  }
  function spriteAnimationEvents(clip) { return (clip && clip.frames || []).flatMap((frame, frameIndex) => (frame.events || []).map((event) => ({ ...event, frameIndex }))); }
  function uniqueSpriteAnimationEventId(clip, base) {
    const root = String(base || 'animation-event').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'animation-event';
    const used = new Set(spriteAnimationEvents(clip).map((event) => event.id)); if (!used.has(root)) return root;
    let suffix = 2; while (used.has(`${root}-${suffix}`)) suffix++; return `${root}-${suffix}`;
  }
  function uniqueSpriteAnimationEventName(clip, base) {
    const root = String(base || 'Animation Event').trim() || 'Animation Event'; const used = new Set(spriteAnimationEvents(clip).map((event) => event.name.toLowerCase()));
    if (!used.has(root.toLowerCase())) return root; let suffix = 2; while (used.has(`${root} ${suffix}`.toLowerCase())) suffix++; return `${root} ${suffix}`;
  }
  function createSpriteAnimationEvent(clip, input) { const source = input || {}; const name = uniqueSpriteAnimationEventName(clip, source.name || 'Animation Event'); return { id: source.id || uniqueSpriteAnimationEventId(clip, name), name }; }
  function duplicateSpriteAnimationFrame(clip, frame) {
    const draft = { spriteAsset: frame && frame.spriteAsset || null, durationMs: Number(frame && frame.durationMs) || DEFAULT_SPRITE_FRAME_DURATION_MS, events: [] };
    for (const event of frame && frame.events || []) draft.events.push(createSpriteAnimationEvent({ frames: [...(clip && clip.frames || []), draft] }, { name: event.name }));
    return draft;
  }
  function emitSpriteAnimationFrameEvents(clip, frameIndex, options, budget) {
    const events = clip && clip.frames && clip.frames[frameIndex] && clip.frames[frameIndex].events || []; let emitted = 0;
    if (!options || typeof options.onEvent !== 'function') return emitted;
    for (const event of events) {
      if (budget != null && emitted >= budget) break;
      const context = Object.freeze({ targetSpriteId: options.targetSpriteId || null, clipId: clip.id, eventId: event.id, eventName: event.name, frameIndex, stateId: options.stateId || null, loop: Number(options.loop) || 0 });
      options.onEvent(context); emitted++;
    }
    return emitted;
  }
  function createSpriteAnimationPlayback(clipId, playing) {
    return { currentStateId: null, currentDirection: 'none', directionMirrorX: false, directionMirrorY: false, clipId: clipId || null, currentFrameIndex: 0, elapsedMs: 0, playing: !!playing, started: !!playing, completed: false, loopCount: 0, eventDispatchOverflow: 0 };
  }
  function playSpriteAnimation(playback, clip, restart, options) {
    const state = playback || createSpriteAnimationPlayback(clip && clip.id, false);
    if (!clip || !Array.isArray(clip.frames) || clip.frames.length === 0) { state.playing = false; state.completed = false; return state; }
    state.clipId = clip.id;
    const starts = restart !== false || !state.started || state.completed;
    if (starts) { state.currentFrameIndex = 0; state.elapsedMs = 0; state.completed = false; state.loopCount = 0; state.eventDispatchOverflow = 0; }
    state.started = true; state.playing = true;
    if (starts) emitSpriteAnimationFrameEvents(clip, 0, options, MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE);
    return state;
  }
  function stopSpriteAnimation(playback) {
    if (!playback) return playback;
    playback.currentStateId = null; playback.clipId = null; playback.directionMirrorX = false; playback.directionMirrorY = false; playback.currentFrameIndex = 0; playback.elapsedMs = 0; playback.playing = false; playback.started = false; playback.completed = false; playback.loopCount = 0; playback.eventDispatchOverflow = 0;
    return playback;
  }
  function normalizeSpriteDirectionalVariants(input) {
    const list = Array.isArray(input) ? input : (isObject(input) ? Object.entries(input).map(([direction, value]) => ({ direction, ...(isObject(value) ? value : {}) })) : []);
    return list.map((variant) => ({
      direction: String(variant && variant.direction || ''),
      clipRef: variant && variant.clipRef || null,
      mirrorX: !!(variant && variant.mirrorX),
      mirrorY: !!(variant && variant.mirrorY),
    }));
  }
  function normalizeSpriteAnimationStates(input) {
    return Array.isArray(input) ? input.map((state) => ({ id: String(state && state.id || ''), name: String(state && state.name || ''), clipRef: state && state.clipRef || null, directionalVariants: normalizeSpriteDirectionalVariants(state && state.directionalVariants) })) : [];
  }
  function uniqueSpriteAnimationStateId(states, base) {
    const root = String(base || 'animation-state').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'animation-state';
    const used = new Set(normalizeSpriteAnimationStates(states).map((state) => state.id));
    if (!used.has(root)) return root;
    let suffix = 2; while (used.has(`${root}-${suffix}`)) suffix++;
    return `${root}-${suffix}`;
  }
  function uniqueSpriteAnimationStateName(states, base) {
    const root = String(base || 'Animation State').trim() || 'Animation State';
    const used = new Set(normalizeSpriteAnimationStates(states).map((state) => state.name.toLowerCase()));
    if (!used.has(root.toLowerCase())) return root;
    let suffix = 2; while (used.has(`${root} ${suffix}`.toLowerCase())) suffix++;
    return `${root} ${suffix}`;
  }
  function createSpriteAnimationState(states, input) {
    const list = normalizeSpriteAnimationStates(states); const source = input || {};
    const name = uniqueSpriteAnimationStateName(list, source.name || 'Animation State');
    return { id: source.id || uniqueSpriteAnimationStateId(list, name), name, clipRef: source.clipRef || null, directionalVariants: normalizeSpriteDirectionalVariants(source.directionalVariants) };
  }
  function resolveSpriteAnimationVariant(renderer, stateId, direction, findClip) {
    const state = normalizeSpriteAnimationStates(renderer && renderer.animationStates).find((entry) => entry.id === stateId) || null;
    const currentDirection = SPRITE_DIRECTION_VALUES.includes(direction) ? direction : 'none';
    const variant = state && currentDirection !== 'none' ? state.directionalVariants.find((entry) => entry.direction === currentDirection) || null : null;
    const baseClip = state && typeof findClip === 'function' ? findClip(state.clipRef) : null;
    const variantClip = variant && variant.clipRef && typeof findClip === 'function' ? findClip(variant.clipRef) : null;
    return Object.freeze({ state, direction: currentDirection, variant, clip: variantClip || baseClip || null, mirrorX: !!(variant && variant.mirrorX), mirrorY: !!(variant && variant.mirrorY), usedBaseFallback: !!(variant && variant.clipRef && !variantClip) });
  }
  function spriteEffectiveFlip(renderer, playback) {
    return Object.freeze({
      flipX: !!(renderer && renderer.flipX) !== !!(playback && playback.directionMirrorX),
      flipY: !!(renderer && renderer.flipY) !== !!(playback && playback.directionMirrorY),
    });
  }
  function setSpriteAnimationState(playback, renderer, stateId, findClip, options) {
    const state = normalizeSpriteAnimationStates(renderer && renderer.animationStates).find((entry) => entry.id === stateId);
    const runtime = playback || createSpriteAnimationPlayback(null, false);
    const resolved = resolveSpriteAnimationVariant(renderer, stateId, runtime.currentDirection, findClip);
    const clip = resolved.clip;
    if (!state || !clip || !Array.isArray(clip.frames) || clip.frames.length === 0) return false;
    const restartIfActive = !!(options && options.restartIfActive);
    if (runtime.currentStateId === state.id && !restartIfActive) return true;
    runtime.currentStateId = state.id;
    runtime.clipId = clip.id;
    runtime.directionMirrorX = resolved.mirrorX;
    runtime.directionMirrorY = resolved.mirrorY;
    playSpriteAnimation(runtime, clip, true, { onEvent: options && options.onEvent, targetSpriteId: options && options.targetSpriteId, stateId: state.id, loop: 0 });
    return true;
  }
  function getSpriteAnimationState(playback) { return playback && playback.currentStateId || null; }
  function setSpriteDirection(playback, renderer, direction, findClip, options) {
    if (!playback || !SPRITE_DIRECTION_VALUES.includes(direction)) return false;
    if (playback.currentDirection === direction) return true;
    const stateId = playback.currentStateId;
    const resolved = stateId ? resolveSpriteAnimationVariant(renderer, stateId, direction, findClip) : null;
    if (stateId && (!resolved || !resolved.clip || !Array.isArray(resolved.clip.frames) || resolved.clip.frames.length === 0)) return false;
    const clipChanged = !!(resolved && resolved.clip.id !== playback.clipId);
    playback.currentDirection = direction;
    playback.directionMirrorX = !!(resolved && resolved.mirrorX);
    playback.directionMirrorY = !!(resolved && resolved.mirrorY);
    if (clipChanged) {
      playback.clipId = resolved.clip.id;
      playSpriteAnimation(playback, resolved.clip, true, { onEvent: options && options.onEvent, targetSpriteId: options && options.targetSpriteId, stateId, loop: 0 });
    }
    return true;
  }
  function getSpriteDirection(playback) { return playback && SPRITE_DIRECTION_VALUES.includes(playback.currentDirection) ? playback.currentDirection : 'none'; }
  function validateSpriteAnimationStateReferences(renderer, findClip) {
    const issues = [];
    for (const state of normalizeSpriteAnimationStates(renderer && renderer.animationStates)) {
      if (!state.clipRef) issues.push({ severity: 'error', code: 'sprite-animation-state-clip-required', stateId: state.id, message: `Animation State "${state.name || state.id || '?'}" requires a Sprite Animation Clip.` });
      else if (typeof findClip === 'function' && !findClip(state.clipRef)) issues.push({ severity: 'error', code: 'sprite-animation-state-clip-missing', stateId: state.id, referenceValue: state.clipRef, message: `Animation State "${state.name || state.id || '?'}" points to missing Sprite Animation Clip "${state.clipRef}".` });
      const directions = new Set();
      for (const variant of state.directionalVariants) {
        if (!SPRITE_DIRECTIONS.includes(variant.direction)) issues.push({ severity: 'error', code: 'sprite-animation-direction-invalid', stateId: state.id, direction: variant.direction, message: `Animation State "${state.name || state.id || '?'}" has unsupported direction "${variant.direction || '?'}".` });
        else if (directions.has(variant.direction)) issues.push({ severity: 'error', code: 'duplicate-sprite-animation-direction', stateId: state.id, direction: variant.direction, message: `Animation State "${state.name || state.id || '?'}" has more than one ${variant.direction} variant.` });
        directions.add(variant.direction);
        if (variant.clipRef && typeof findClip === 'function' && !findClip(variant.clipRef)) issues.push({ severity: 'error', code: 'sprite-animation-direction-clip-missing', stateId: state.id, direction: variant.direction, referenceValue: variant.clipRef, message: `${variant.direction} variant points to missing Sprite Animation Clip "${variant.clipRef}"; runtime uses the State base Clip.` });
      }
    }
    return issues;
  }
  function spriteAnimationTotalDuration(clip) {
    return (clip && Array.isArray(clip.frames) ? clip.frames : []).reduce((total, frame) => {
      const duration = Number(frame && frame.durationMs);
      return total + (Number.isFinite(duration) && duration > 0 && duration <= MAX_SPRITE_FRAME_DURATION_MS ? duration : 0);
    }, 0);
  }
  function spriteAnimationFrameRanges(clip) {
    let cursor = 0;
    return (clip && Array.isArray(clip.frames) ? clip.frames : []).map((frame, index) => {
      const duration = Number(frame && frame.durationMs);
      const safeDuration = Number.isFinite(duration) && duration > 0 && duration <= MAX_SPRITE_FRAME_DURATION_MS ? duration : 0;
      const range = { index, startMs: cursor, endMs: cursor + safeDuration, durationMs: safeDuration };
      cursor = range.endMs;
      return range;
    });
  }
  function spriteAnimationFrameAtTime(clip, timeMs, wrap) {
    const ranges = spriteAnimationFrameRanges(clip);
    const totalMs = ranges.length ? ranges[ranges.length - 1].endMs : 0;
    if (!ranges.length || totalMs <= 0) return { frameIndex: 0, elapsedMs: 0, timeMs: 0, totalMs };
    let time = Number(timeMs);
    if (!Number.isFinite(time)) time = 0;
    if (wrap) time = ((time % totalMs) + totalMs) % totalMs;
    else time = Math.max(0, Math.min(time, totalMs));
    if (!wrap && time >= totalMs) return { frameIndex: ranges.length - 1, elapsedMs: 0, timeMs: totalMs, totalMs };
    const range = ranges.find((entry) => time < entry.endMs) || ranges[ranges.length - 1];
    return { frameIndex: range.index, elapsedMs: Math.max(0, time - range.startMs), timeMs: time, totalMs };
  }
  function spriteAnimationPlaybackTime(playback, clip) {
    const ranges = spriteAnimationFrameRanges(clip);
    const range = ranges[playback && playback.currentFrameIndex] || ranges[0];
    return range ? Math.min(range.endMs, range.startMs + Math.max(0, Number(playback && playback.elapsedMs) || 0)) : 0;
  }
  function seekSpriteAnimation(playback, clip, timeMs) {
    const state = playback || createSpriteAnimationPlayback(clip && clip.id, false);
    const position = spriteAnimationFrameAtTime(clip, timeMs, false);
    state.clipId = clip && clip.id || state.clipId;
    state.currentFrameIndex = position.frameIndex;
    state.elapsedMs = position.elapsedMs;
    state.started = !!(clip && clip.frames && clip.frames.length);
    state.completed = false;
    return state;
  }
  function advanceSpriteAnimation(playback, clip, deltaSeconds, options) {
    if (!playback || !playback.playing || !clip || !Array.isArray(clip.frames) || clip.frames.length === 0) return playback;
    const delta = Number(deltaSeconds);
    if (!Number.isFinite(delta) || delta <= 0) return playback;
    if (playback.currentFrameIndex < 0 || playback.currentFrameIndex >= clip.frames.length) playback.currentFrameIndex = 0;
    if (clip.playbackMode === 'loop') {
      const totalMs = spriteAnimationTotalDuration(clip);
      if (totalMs <= 0) { playback.playing = false; return playback; }
      const startMs = spriteAnimationPlaybackTime(playback, clip); const travelMs = delta * 1000; const endAbsolute = startMs + travelMs;
      const ranges = spriteAnimationFrameRanges(clip); let emitted = 0; let entries = 0; let cycle = Number(playback.loopCount) || 0;
      let cursor = ranges[playback.currentFrameIndex] ? ranges[playback.currentFrameIndex].endMs : totalMs;
      while (cursor <= endAbsolute && entries <= MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE) {
        const local = ((cursor % totalMs) + totalMs) % totalMs; const entering = local === 0 ? 0 : ((ranges.find((range) => range.startMs === local) || {}).index);
        if (local === 0) cycle++;
        if (entering !== undefined) emitted += emitSpriteAnimationFrameEvents(clip, entering, { ...options, stateId: playback.currentStateId, loop: cycle }, MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE - emitted);
        entries++; if (emitted >= MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE) break;
        const range = ranges[entering === undefined ? 0 : entering]; cursor += range ? range.durationMs : totalMs;
      }
      playback.eventDispatchOverflow = cursor <= endAbsolute ? 1 : 0;
      playback.loopCount = (Number(playback.loopCount) || 0) + Math.floor(endAbsolute / totalMs);
      // Convert the local-frame clock to clip time, add delta, and modulo
      // once. This handles many complete loops without transition-by-
      // transition iteration and keeps one-frame loops bounded.
      const position = spriteAnimationFrameAtTime(clip, spriteAnimationPlaybackTime(playback, clip) + delta * 1000, true);
      playback.currentFrameIndex = position.frameIndex;
      playback.elapsedMs = position.elapsedMs;
      playback.completed = false;
      return playback;
    }
    playback.elapsedMs += delta * 1000;
    let emitted = 0;
    // Play-once catch-up: at most one pass through the frame array. Large
    // deltas cross every required boundary deterministically without one
    // timer per instance or an at-most-one-frame-per-render bug.
    while (playback.playing) {
      const frame = clip.frames[playback.currentFrameIndex] || {};
      const duration = Number(frame.durationMs);
      if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SPRITE_FRAME_DURATION_MS) { playback.playing = false; break; }
      if (playback.elapsedMs < duration) break;
      if (playback.currentFrameIndex >= clip.frames.length - 1) {
        playback.currentFrameIndex = clip.frames.length - 1;
        playback.elapsedMs = 0;
        playback.playing = false;
        playback.completed = true;
        break;
      }
      playback.elapsedMs -= duration;
      playback.currentFrameIndex++;
      const remaining = MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE - emitted;
      const enteringEvents = clip.frames[playback.currentFrameIndex].events || [];
      if (remaining > 0) { emitted += emitSpriteAnimationFrameEvents(clip, playback.currentFrameIndex, { ...options, stateId: playback.currentStateId, loop: Number(playback.loopCount) || 0 }, remaining); if (enteringEvents.length > remaining) playback.eventDispatchOverflow = 1; }
      else playback.eventDispatchOverflow = 1;
    }
    return playback;
  }
  function textureDimensions(texture) {
    const width = texture && Number(texture.width || (texture.image && (texture.image.naturalWidth || texture.image.width)));
    const height = texture && Number(texture.height || (texture.image && (texture.image.naturalHeight || texture.image.height)));
    return width > 0 && height > 0 ? { width, height } : null;
  }
  function spriteRegionPixels(asset, texture) {
    if (asset && asset.sourceRect) return { ...asset.sourceRect };
    const size = textureDimensions(texture);
    return size ? { x: 0, y: 0, width: size.width, height: size.height } : null;
  }
  function validateSpriteSourceRect(asset, texture) {
    if (!asset || asset.sourceRect == null) return [];
    const rect = asset.sourceRect;
    const basic = !isObject(rect) || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)
      || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0;
    if (basic) return [{ code: 'sprite-source-rect-invalid', message: 'Source Region requires non-negative X/Y and positive Width/Height in pixels.' }];
    const size = textureDimensions(texture);
    if (!size) return [{ code: 'sprite-source-unavailable', message: 'Source Region is preserved, but its Texture dimensions are unavailable.' }];
    return rect.x + rect.width > size.width || rect.y + rect.height > size.height
      ? [{ code: 'sprite-source-rect-bounds', message: `Source Region exceeds the ${size.width} × ${size.height} source Texture.` }]
      : [];
  }
  // The sole pixel-rect -> WebGL UV conversion. Images are uploaded with
  // UNPACK_FLIP_Y_WEBGL, hence top-origin Y becomes 1-(y+h)/H. Explicit
  // Smooth regions sample between edge pixel centres to avoid base-level
  // neighbor bleed; full-image compatibility retains exact historical UVs.
  function spriteSourceUV(asset, texture) {
    const size = textureDimensions(texture);
    if (!size || !asset || !asset.sourceRect || validateSpriteSourceRect(asset, texture).length) return { scale: [1, 1], offset: [0, 0], fullImage: true };
    const r = asset.sourceRect;
    const inset = asset.filtering === 'nearest' ? 0 : 0.5;
    const spanX = Math.max(0, r.width - inset * 2);
    const spanY = Math.max(0, r.height - inset * 2);
    return {
      scale: [spanX / size.width, spanY / size.height],
      offset: [(r.x + inset) / size.width, 1 - (r.y + r.height - inset) / size.height],
      fullImage: false,
    };
  }
  function applySpriteUVFlip(sourceUV, flipX, flipY) {
    const source = sourceUV || { scale: [1, 1], offset: [0, 0], fullImage: true };
    const scale = [Number(source.scale && source.scale[0]) || 0, Number(source.scale && source.scale[1]) || 0];
    const offset = [Number(source.offset && source.offset[0]) || 0, Number(source.offset && source.offset[1]) || 0];
    if (flipX) { offset[0] += scale[0]; scale[0] *= -1; }
    if (flipY) { offset[1] += scale[1]; scale[1] *= -1; }
    return Object.freeze({ scale: Object.freeze(scale), offset: Object.freeze(offset), fullImage: !!source.fullImage });
  }
  function validateSpriteNineSlice(asset, texture) {
    if (!asset || asset.nineSlice == null) return [];
    const guides = asset.nineSlice;
    if (!isObject(guides)) return [{ code: 'sprite-nine-slice-invalid', message: 'Nine-Slice Guides must be a Left, Right, Top, and Bottom pixel record.' }];
    const values = ['left', 'right', 'top', 'bottom'].map((key) => guides[key]);
    if (values.some((value) => !Number.isFinite(value))) return [{ code: 'sprite-nine-slice-nonfinite', message: 'Nine-Slice Guide values must be finite source-region pixels.' }];
    if (values.some((value) => value < 0)) return [{ code: 'sprite-nine-slice-negative', message: 'Nine-Slice Guide values cannot be negative.' }];
    const issues = [];
    if (values.some((value) => !Number.isInteger(value))) issues.push({ severity: 'warning', code: 'sprite-nine-slice-noninteger', message: 'Nine-Slice Guides are source pixels; whole-pixel values are recommended.' });
    const region = spriteRegionPixels(asset, texture);
    if (!region) return [...issues, { severity: 'warning', code: 'sprite-nine-slice-source-unavailable', message: 'Nine-Slice Guides are preserved, but source-region dimensions are unavailable.' }];
    if (guides.left + guides.right > region.width) issues.push({ code: 'sprite-nine-slice-horizontal-bounds', message: `Left + Right guides exceed the ${region.width} px source-region width.` });
    if (guides.top + guides.bottom > region.height) issues.push({ code: 'sprite-nine-slice-vertical-bounds', message: `Top + Bottom guides exceed the ${region.height} px source-region height.` });
    return issues;
  }
  function resolveNineSliceAxis(total, leadingNatural, trailingNatural) {
    const size = Math.max(0, Number(total) || 0);
    const leading = Math.max(0, Number(leadingNatural) || 0);
    const trailing = Math.max(0, Number(trailingNatural) || 0);
    const borderTotal = leading + trailing;
    const compression = borderTotal > size && borderTotal > 0 ? size / borderTotal : 1;
    const resolvedLeading = leading * compression;
    const resolvedTrailing = trailing * compression;
    return Object.freeze([resolvedLeading, Math.max(0, size - resolvedLeading - resolvedTrailing), resolvedTrailing]);
  }
  // One authoritative source-region-pixel -> 3x3 cell calculation for the
  // editor, Play, and both export tiers. Geometry is expressed relative to
  // the outer Sprite pivot; UV boundaries are shared between neighboring
  // cells so internal seams cannot accumulate independent rounding error.
  function spriteNineSliceCells(asset, texture, options) {
    const opts = options || {};
    const issues = validateSpriteNineSlice(asset, texture);
    if (!asset || !asset.nineSlice || issues.some((entry) => entry.severity !== 'warning')) return null;
    const region = spriteRegionPixels(asset, texture);
    const dimensions = textureDimensions(texture);
    const ppu = Number(asset.pixelsPerUnit);
    if (!region || !dimensions || !(ppu > 0)) return null;
    const guides = asset.nineSlice;
    const width = Math.max(0, Number(opts.width) || 0);
    const height = Math.max(0, Number(opts.height) || 0);
    const pivotX = Number.isFinite(Number(opts.pivotX)) ? Number(opts.pivotX) : 0.5;
    const pivotY = Number.isFinite(Number(opts.pivotY)) ? Number(opts.pivotY) : 0.5;
    const flipX = !!opts.flipX; const flipY = !!opts.flipY;
    const xNatural = flipX ? [guides.right / ppu, guides.left / ppu] : [guides.left / ppu, guides.right / ppu];
    const yNatural = flipY ? [guides.top / ppu, guides.bottom / ppu] : [guides.bottom / ppu, guides.top / ppu];
    const widths = resolveNineSliceAxis(width, xNatural[0], xNatural[1]);
    const heights = resolveNineSliceAxis(height, yNatural[0], yNatural[1]);
    const x = [-pivotX * width]; const y = [-pivotY * height];
    for (const value of widths) x.push(x[x.length - 1] + value);
    for (const value of heights) y.push(y[y.length - 1] + value);
    const outer = spriteSourceUV(asset, texture);
    const u = [outer.offset[0], (region.x + guides.left) / dimensions.width, (region.x + region.width - guides.right) / dimensions.width, outer.offset[0] + outer.scale[0]];
    const v = [outer.offset[1], 1 - (region.y + region.height - guides.bottom) / dimensions.height, 1 - (region.y + guides.top) / dimensions.height, outer.offset[1] + outer.scale[1]];
    const cells = [];
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      const cellWidth = widths[column]; const cellHeight = heights[row];
      const sourceColumn = flipX ? 2 - column : column; const sourceRow = flipY ? 2 - row : row;
      const u0 = u[sourceColumn]; const u1 = u[sourceColumn + 1]; const v0 = v[sourceRow]; const v1 = v[sourceRow + 1];
      if (!(cellWidth > 0) || !(cellHeight > 0) || u0 === u1 || v0 === v1) continue;
      cells.push(Object.freeze({
        column, row,
        x: (x[column] + x[column + 1]) * 0.5,
        y: (y[row] + y[row + 1]) * 0.5,
        width: cellWidth, height: cellHeight,
        uvScale: Object.freeze([flipX ? u0 - u1 : u1 - u0, flipY ? v0 - v1 : v1 - v0]),
        uvOffset: Object.freeze([flipX ? u1 : u0, flipY ? v1 : v0]),
      }));
    }
    return Object.freeze(cells);
  }
  function spriteNaturalSize(asset, texture) {
    const region = spriteRegionPixels(asset, texture);
    const width = region && Number(region.width);
    const height = region && Number(region.height);
    const ppu = asset && Number(asset.pixelsPerUnit);
    return width > 0 && height > 0 && Number.isFinite(ppu) && ppu > 0 ? { width: width / ppu, height: height / ppu } : null;
  }
  // Phase 019: the Asset Library transports only typed identity through a
  // placement gesture. Image bytes, mutable metadata, and display names stay
  // in their authoritative library records and are resolved at commit time.
  function createSpritePlacementPayload(assetId) {
    const id = String(assetId || '').trim();
    if (!id) throw new Error('Sprite placement requires a stable Sprite Asset ID.');
    return Object.freeze({ assetType: 'sprite', assetId: id });
  }
  function isSpritePlacementPayload(payload) {
    return !!payload && payload.assetType === 'sprite' && typeof payload.assetId === 'string' && payload.assetId.length > 0;
  }
  function uniqueObjectName(baseName, existingNames) {
    const base = String(baseName || 'Sprite').trim() || 'Sprite';
    const used = new Set((existingNames || []).filter(Boolean).map((name) => String(name).toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    let suffix = 2;
    while (used.has(`${base} ${suffix}`.toLowerCase())) suffix++;
    return `${base} ${suffix}`;
  }
  function createSpritePlacementRecord(asset, texture, position, existingNames) {
    if (!asset || !asset.id) throw new Error('Sprite Asset is unavailable.');
    const natural = spriteNaturalSize(asset, texture) || { width: 1, height: 1 };
    const pivot = Array.isArray(asset.pivot) ? asset.pivot : [0.5, 0.5];
    const point = position || { x: 0, y: 1, z: 0 };
    return {
      kind: 'sprite', name: uniqueObjectName(asset.name || 'Sprite', existingNames),
      position: [Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0], scale: [1, 1, 1],
      components: { 'sprite-renderer': {
        version: 9, spriteAssetRef: asset.id, renderMode: 'simple', flipX: false, flipY: false, animationStates: [], initialAnimationStateRef: null, initialDirection: 'none', playOnStart: false, sourceTexture: null,
        width: natural.width, height: natural.height,
        pivotX: Number(pivot[0]), pivotY: Number(pivot[1]),
        tint: '#ffffff', opacity: 1, visible: true,
        sortingLayerRef: DEFAULT_SPRITE_SORTING_LAYER_ID, orderInLayer: 0, parallaxLayerRef: null,
      } },
    };
  }
  function sliceSpriteGrid(textureWidth, textureHeight, options) {
    const opts = options || {};
    const width = Number(textureWidth); const height = Number(textureHeight);
    const cellWidth = Number(opts.cellWidth); const cellHeight = Number(opts.cellHeight);
    const marginX = Math.max(0, Number(opts.marginX) || 0); const marginY = Math.max(0, Number(opts.marginY) || 0);
    const spacingX = Math.max(0, Number(opts.spacingX) || 0); const spacingY = Math.max(0, Number(opts.spacingY) || 0);
    if (!(width > 0 && height > 0 && cellWidth > 0 && cellHeight > 0)) return [];
    const rects = [];
    for (let y = marginY; y + cellHeight <= height; y += cellHeight + spacingY) {
      for (let x = marginX; x + cellWidth <= width; x += cellWidth + spacingX) rects.push({ x, y, width: cellWidth, height: cellHeight });
    }
    return rects;
  }
  function uniqueAssetName(baseName, existingNames) {
    const base = String(baseName || 'Sprite').trim() || 'Sprite';
    const used = new Set((existingNames || []).map((name) => String(name).toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    let suffix = 2;
    while (used.has(`${base} (${suffix})`.toLowerCase())) suffix++;
    return `${base} (${suffix})`;
  }
  function spriteGridNames(baseName, count, existingNames) {
    const used = (existingNames || []).slice();
    const names = [];
    for (let i = 0; i < count; i++) { const name = uniqueAssetName(`${String(baseName || 'sprite').trim() || 'sprite'}_${String(i + 1).padStart(3, '0')}`, used); used.push(name); names.push(name); }
    return names;
  }

  function defaultSpriteSortingLayers() {
    return [{ id: DEFAULT_SPRITE_SORTING_LAYER_ID, name: 'Default', order: 0 }];
  }
  function createSpriteSortingLayer(id, name, order) {
    return { id: String(id), name: String(name || 'Sorting Layer'), order: Number.isInteger(order) ? order : 0 };
  }
  function normalizeSpriteSortingLayers(input) {
    const layers = Array.isArray(input) ? input.filter(isObject).map((layer) => ({ id: String(layer.id || ''), name: String(layer.name || ''), order: Number(layer.order) })) : [];
    if (!layers.some((layer) => layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID)) layers.unshift(defaultSpriteSortingLayers()[0]);
    for (const layer of layers) if (layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID) layer.name = 'Default';
    return layers;
  }
  function validateSpriteSortingLayers(input) {
    const layers = Array.isArray(input) ? input : [];
    const issues = [];
    const ids = new Set(); const names = new Set(); const orders = new Set();
    if (!layers.some((layer) => layer && layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID)) issues.push(issue({ code: 'sprite-default-sorting-layer-missing', message: 'Project requires the built-in Default Sprite Sorting Layer.' }));
    for (const layer of layers) {
      const id = layer && String(layer.id || ''); const name = layer && String(layer.name || '').trim(); const folded = name.toLowerCase();
      if (!id) issues.push(issue({ code: 'sprite-sorting-layer-id-required', message: 'Sprite Sorting Layers require a stable ID.' }));
      else if (ids.has(id)) issues.push(issue({ code: 'duplicate-sorting-layer-id', referenceType: 'sortingLayer', referenceValue: id, message: `Duplicate Sprite Sorting Layer ID "${id}".` }));
      ids.add(id);
      if (!name) issues.push(issue({ code: 'sprite-sorting-layer-name-required', message: `Sprite Sorting Layer "${id || '?'}" requires a display name.` }));
      else if (names.has(folded)) issues.push(issue({ code: 'duplicate-sorting-layer-name', referenceType: 'sortingLayer', referenceValue: id, message: `Duplicate Sprite Sorting Layer name "${name}".` }));
      names.add(folded);
      if (!Number.isInteger(layer && layer.order)) issues.push(issue({ severity: 'warning', code: 'invalid-sorting-layer-order', referenceType: 'sortingLayer', referenceValue: id, message: `Sprite Sorting Layer "${name || id || '?'}" requires an integer project order.` }));
      else if (orders.has(layer.order)) issues.push(issue({ severity: 'warning', code: 'duplicate-sorting-layer-order', referenceType: 'sortingLayer', referenceValue: id, message: `Sprite Sorting Layer order ${layer.order} is duplicated.` }));
      orders.add(layer && layer.order);
    }
    return issues;
  }
  function spriteSortingLayerOrderMap(layers) {
    const normalized = normalizeSpriteSortingLayers(layers);
    const fallback = normalized.find((layer) => layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID);
    const map = new Map(normalized.map((layer) => [layer.id, Number.isInteger(layer.order) ? layer.order : 0]));
    return { map, fallbackOrder: Number.isInteger(fallback.order) ? fallback.order : 0 };
  }
  function reorderSpriteSortingLayers(layers, id, delta) {
    const ordered = normalizeSpriteSortingLayers(layers).slice().sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const index = ordered.findIndex((layer) => layer.id === id); const target = index + Math.sign(delta);
    if (index < 0 || target < 0 || target >= ordered.length) return ordered.map((layer, order) => ({ ...layer, order }));
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return ordered.map((layer, order) => ({ ...layer, order }));
  }
  function spriteSortTuple(record, layers) {
    const component = record && record.components && record.components['sprite-renderer'] || record || {};
    const lookup = spriteSortingLayerOrderMap(layers);
    return [lookup.map.has(component.sortingLayerRef) ? lookup.map.get(component.sortingLayerRef) : lookup.fallbackOrder, Math.round(Number(component.orderInLayer) || 0), String(record && record.id || component.objectId || '')];
  }
  function compareSpriteSortRecords(left, right, layers) {
    const a = spriteSortTuple(left, layers); const b = spriteSortTuple(right, layers);
    return a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);
  }

  function createParallaxLayer(id, name, factorX, factorY) {
    return { id: String(id || ''), name: String(name || 'Parallax Layer'), factorX: Number(factorX), factorY: Number(factorY) };
  }
  function normalizeParallaxLayers(input) {
    return Array.isArray(input) ? input.filter(isObject).map((layer) => createParallaxLayer(layer.id, layer.name, layer.factorX, layer.factorY)) : [];
  }
  function validateParallaxLayers(input) {
    const issues = []; const ids = new Set(); const names = new Set();
    for (const layer of Array.isArray(input) ? input : []) {
      const id = String(layer && layer.id || ''); const name = String(layer && layer.name || '').trim(); const folded = name.toLowerCase();
      if (!id) issues.push(issue({ code: 'parallax-layer-id-required', message: 'Parallax Layers require a stable ID.' }));
      else if (ids.has(id)) issues.push(issue({ code: 'duplicate-parallax-layer-id', referenceType: 'parallaxLayer', referenceValue: id, message: `Duplicate Parallax Layer ID "${id}".` }));
      if (!name) issues.push(issue({ code: 'parallax-layer-name-required', referenceType: 'parallaxLayer', referenceValue: id, message: `Parallax Layer "${id || '?'}" requires a display name.` }));
      else if (names.has(folded)) issues.push(issue({ code: 'duplicate-parallax-layer-name', referenceType: 'parallaxLayer', referenceValue: id, message: `Duplicate Parallax Layer name "${name}".` }));
      if (!Number.isFinite(Number(layer && layer.factorX)) || !Number.isFinite(Number(layer && layer.factorY))) issues.push(issue({ code: 'parallax-layer-factor-finite', referenceType: 'parallaxLayer', referenceValue: id, message: `Parallax Layer "${name || id || '?'}" requires finite X and Y factors.` }));
      ids.add(id); names.add(folded);
    }
    return issues;
  }
  function resolveParallaxFactors(layerRef, layers) {
    if (!layerRef) return { factorX: 1, factorY: 1, missing: false };
    const layer = (layers || []).find((entry) => entry && entry.id === layerRef);
    if (!layer) return { factorX: 1, factorY: 1, missing: true };
    const factorX = Number(layer.factorX); const factorY = Number(layer.factorY);
    return Number.isFinite(factorX) && Number.isFinite(factorY) ? { factorX, factorY, missing: false } : { factorX: 1, factorY: 1, missing: true };
  }
  function spriteParallaxOffset(camera, reference, factors) {
    const current = camera || {}; const start = reference || {}; const resolved = factors || { factorX: 1, factorY: 1 };
    const currentX = Number(current.x); const currentY = Number(current.y); const startX = Number(start.x); const startY = Number(start.y);
    const factorX = Number(resolved.factorX); const factorY = Number(resolved.factorY);
    return {
      x: ((Number.isFinite(currentX) ? currentX : 0) - (Number.isFinite(startX) ? startX : 0)) * (1 - (Number.isFinite(factorX) ? factorX : 1)),
      y: ((Number.isFinite(currentY) ? currentY : 0) - (Number.isFinite(startY) ? startY : 0)) * (1 - (Number.isFinite(factorY) ? factorY : 1)),
      z: 0,
    };
  }

return { TILEMAP_CHUNK_VERSION, normalizeTilemapChunk, tilemapChunkCellCount, uniqueTilemapChunkId, uniqueTilemapChunkName, captureTilemapChunk, normalizeTilemapChunkSemantics, duplicateTilemapChunk, tilemapChunkDependencies, validateTilemapChunk, suggestTilemapChunkLayerMapping, validateTilemapChunkLayerMapping, planTilemapChunkStamp, commitTilemapChunkStamp, tilemapChunkTileUsage, tilemapChunkAutoTileUsage, tilemapChunkTerrainUsage, tilemapChunkPrefabUsage, repairTilemapChunkDependency, recomputeProjectTilemapChunks, normalizeSpawnMarker, canonicalizeSpawnMarkers, uniqueSpawnMarkerId, uniqueSpawnMarkerName, createSpawnMarker, getSpawnMarkerById, updateSpawnMarker, duplicateSpawnMarker, deleteSpawnMarker, spawnMarkerPrefabUsage, validateSpawnMarkers, tilemapCellCenterLocal, tilemapCellToWorld, tilemapWorldToCell, getTilemapSpawnMarkers, REFERENCE_TYPES, SEVERITIES, DEFAULT_SPRITE_SORTING_LAYER_ID, DEFAULT_TILEMAP_LAYER_ID, DEFAULT_SPRITE_FRAME_DURATION_MS, MAX_SPRITE_FRAME_DURATION_MS, MAX_SPRITE_ANIMATION_EVENTS_PER_ADVANCE, SPRITE_ANIMATION_PLAYBACK_MODES, SPRITE_DIRECTIONS, SPRITE_DIRECTION_VALUES, TILE_COLLISION_MODES, AUTO_TILE_NEIGHBOR_MODES, AUTO_TILE_BITS, AUTO_TILE_NEIGHBORS, TERRAIN_BRUSH_MODES, TERRAIN_FOOTPRINT_SHAPES, TERRAIN_WEIGHT_MAX, TERRAIN_RADIUS_MAX, AssetTypeRegistry, assetTypes, normalizeMime, normalizeExtension, getReferenceOptions, buildReferenceIndex, collectProjectIssues, propagateStructuredRename, createSpriteAsset, duplicateSpriteAsset, authoredTileCollision, validateTileCollision, resolveTileCollision, setTileCollision, tileCollisionLocalRect, transformTileCollisionPoint, tileCollisionWorldQuad, resolveTilemapLayerCollisions, canonicalizeAutoTileMask, canonicalAutoTileMasks, normalizeAutoTileSet, validateAutoTileSets, getAutoTileSetById, uniqueAutoTileSetName, uniqueAutoTileSetId, createAutoTileSet, duplicateAutoTileSet, removeAutoTileSet, setAutoTileRule, removeAutoTileRule, autoTileSetCanResolve, resolveAutoTileMask, resolveAutoTileOutput, recomputeAutoTileCell, recomputeAutoTileNeighborhood, paintAutoTileCell, paintManualTileCell, eraseAutoTileCell, recomputeAutoTilemap, recomputeAutoTileSetUsage, recomputeProjectAutoTiles, autoTileSetUsage, convertAutoTileCellsToManual, reassignAutoTileCells, normalizeTerrainBrush, validateTerrainBrushes, getTerrainBrushById, uniqueTerrainBrushName, uniqueTerrainBrushId, createTerrainBrush, duplicateTerrainBrush, removeTerrainBrush, validTerrainVariants, terrainHash32, terrainCoordinateKey, resolveTerrainWeightedTile, terrainBrushCanPaint, terrainFootprintCells, terrainStrokeFootprintCells, paintTerrainCells, paintTerrainCell, eraseTerrainCells, recomputeTerrainBrushUsage, recomputeProjectTerrain, terrainBrushUsage, convertTerrainCellsToManual, reassignTerrainCells, createTileset, duplicateTileset, uniqueTileName, uniqueTileId, addTileToTileset, addSpriteAssetsToTileset, duplicateTileInTileset, removeTileFromTileset, reorderTilesetTile, getTilesetById, getTileById, safeTilesetCellSize, tilemapCellKey, parseTilemapCellKey, isSafeCellCoordinate, canonicalizeTilemapCells, normalizeTilemapLayer, createTilemapRecord, getTilemapLayer, defaultTilemapLayer, uniqueTilemapLayerName, uniqueTilemapLayerId, ensureTilemapCellIndex, invalidateTilemapCellIndex, serializeTilemapCells, serializeTilemapLayers, getTilemapCell, setTilemapCell, eraseTilemapCell, clearTilemapLayer, clearTilemapCells, tilemapCellCount, tilemapOccupiedBounds, tilemapStrokeCells, tilemapUsedTileIds, addTilemapLayer, renameTilemapLayer, reorderTilemapLayer, setTilemapLayerVisibility, setTilemapLayerLocked, duplicateTilemapLayer, deleteTilemapLayer, validateTilemapRecord, createSpriteAnimationClip, duplicateSpriteAnimationClip, spriteAnimationEvents, uniqueSpriteAnimationEventId, uniqueSpriteAnimationEventName, createSpriteAnimationEvent, duplicateSpriteAnimationFrame, emitSpriteAnimationFrameEvents, createSpriteAnimationPlayback, playSpriteAnimation, stopSpriteAnimation, advanceSpriteAnimation, normalizeSpriteDirectionalVariants, normalizeSpriteAnimationStates, uniqueSpriteAnimationStateId, uniqueSpriteAnimationStateName, createSpriteAnimationState, resolveSpriteAnimationVariant, spriteEffectiveFlip, setSpriteAnimationState, getSpriteAnimationState, setSpriteDirection, getSpriteDirection, validateSpriteAnimationStateReferences, spriteAnimationTotalDuration, spriteAnimationFrameRanges, spriteAnimationFrameAtTime, spriteAnimationPlaybackTime, seekSpriteAnimation, textureDimensions, spriteRegionPixels, validateSpriteSourceRect, spriteSourceUV, applySpriteUVFlip, validateSpriteNineSlice, resolveNineSliceAxis, spriteNineSliceCells, spriteNaturalSize, createSpritePlacementPayload, isSpritePlacementPayload, uniqueObjectName, createSpritePlacementRecord, sliceSpriteGrid, uniqueAssetName, spriteGridNames, defaultSpriteSortingLayers, createSpriteSortingLayer, normalizeSpriteSortingLayers, validateSpriteSortingLayers, spriteSortingLayerOrderMap, reorderSpriteSortingLayers, spriteSortTuple, compareSpriteSortRecords, createParallaxLayer, normalizeParallaxLayers, validateParallaxLayers, resolveParallaxFactors, spriteParallaxOffset };
});
