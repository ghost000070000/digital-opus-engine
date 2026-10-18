(function (root, factory) {
  const api = factory(typeof require === 'function' ? require : null, root && root.OpusAuthoringPlumbing);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OpusTilemapBundle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (nodeRequire, browserPlumbing) {
  'use strict';

  const FORMAT = 'digital-opus-tilemap-bundle';
  const VERSION = 1;
  const ROOT_KINDS = Object.freeze(['tilemap', 'tilemap-chunk']);
  const EXTENSIONS = Object.freeze({ tilemap: '.opus-tilemap.json', 'tilemap-chunk': '.opus-chunk.json' });
  const LIMITS = Object.freeze({ textBytes: 64 * 1024 * 1024, blobs: 128, blobBytes: 32 * 1024 * 1024, totalBlobBytes: 96 * 1024 * 1024, layers: 256, cells: 100000, markers: 10000, dependencies: 10000, prefabDepth: 32 });
  const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const ALLOWED_MIME = /^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|ogg|wav|webm|mp4)|application\/(octet-stream|json))$/i;
  const ID_COLLECTIONS = Object.freeze(['tilesets', 'spriteAssets', 'textures', 'prefabs', 'meshAssets', 'audio', 'spriteAnimations', 'sortingLayers', 'collisionLayers']);
  const authoringPlumbing = browserPlumbing || (nodeRequire ? nodeRequire('./00-authoring-plumbing.js') : null);
  const Filters = nodeRequire ? nodeRequire('./00-collision-filter-2d.js') : globalThis.OpusCollisionFilter2D;

  function ownPlain(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function canonicalize(value, path) {
    const at = path || '$';
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`Non-finite number at ${at}`);
      return Object.is(value, -0) ? 0 : value;
    }
    if (Array.isArray(value)) return value.map((entry, index) => canonicalize(entry, `${at}[${index}]`));
    if (!ownPlain(value)) throw new Error(`Unsupported value at ${at}`);
    const out = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      if (BLOCKED_KEYS.has(key)) throw new Error(`Unsafe key at ${at}.${key}`);
      if (value[key] === undefined) continue;
      out[key] = canonicalize(value[key], `${at}.${key}`);
    }
    return out;
  }

  function canonicalStringify(value) { return JSON.stringify(canonicalize(value), null, 2) + '\n'; }
  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    return Uint8Array.from(Buffer.from(text, 'utf8'));
  }
  function bytesToHex(bytes) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); }
  async function sha256Hex(value) {
    const bytes = typeof value === 'string' ? utf8Bytes(value) : value;
    const cryptoObject = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (cryptoObject && cryptoObject.subtle) return bytesToHex(new Uint8Array(await cryptoObject.subtle.digest('SHA-256', bytes)));
    if (nodeRequire) return nodeRequire('crypto').createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    throw new Error('SHA-256 is unavailable in this environment');
  }

  function strictBase64ToBytes(base64) {
    if (typeof base64 !== 'string' || base64.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('Invalid base64 payload');
    if (typeof atob === 'function') {
      const binary = atob(base64); const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
  function bytesToBase64(bytes) {
    if (typeof btoa === 'function') {
      let binary = ''; const block = 0x8000;
      for (let i = 0; i < bytes.length; i += block) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + block));
      return btoa(binary);
    }
    return Buffer.from(bytes).toString('base64');
  }
  function parseDataURL(dataURL) {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(String(dataURL || ''));
    if (!match) throw new Error('Asset bytes must be a base64 data URL');
    if (!ALLOWED_MIME.test(match[1])) throw new Error(`Unsupported embedded MIME type: ${match[1]}`);
    return { mimeType: match[1].toLowerCase(), bytes: strictBase64ToBytes(match[2]) };
  }
  function blobDataURL(blob) { return `data:${blob.mimeType};base64,${blob.base64}`; }
  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
  function list(value) { return Array.isArray(value) ? value : []; }
  function mapBy(records, field) { return new Map(list(records).map((record) => [String(record && record[field] || ''), record])); }

  function scanReferences(value, refs, depth) {
    if (depth > LIMITS.prefabDepth || value == null) return;
    if (Array.isArray(value)) { for (const entry of value) scanReferences(entry, refs, depth + 1); return; }
    if (!ownPlain(value)) return;
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'string' && entry) {
        if (key === 'prefabRef' || key === 'prefabName' || key === 'sourcePrefabName') refs.prefabs.add(entry);
        else if (key === 'spriteAssetRef' || key === 'spriteAsset') refs.spriteAssets.add(entry);
        else if (key === 'sourceTexture' || key === 'textureAssetId') refs.textures.add(entry);
        else if (key === 'assetId' || key === 'meshAssetId') refs.meshAssets.add(entry);
        else if (key === 'audioAssetId') refs.audio.add(entry);
        else if (key === 'clipRef' || key === 'clipId') refs.spriteAnimations.add(entry);
        else if (key === 'sortingLayerRef') refs.sortingLayers.add(entry);
        else if (key === 'collisionLayerRef') refs.collisionLayers.add(entry);
      }
      if (key === 'collisionMaskRefs' && value.collisionMaskMode === 'custom' && Array.isArray(entry)) for (const id of entry) refs.collisionLayers.add(id);
      scanReferences(entry, refs, depth + 1);
    }
  }

  function emptyRefs() { return { prefabs: new Set(), spriteAssets: new Set(), textures: new Set(), meshAssets: new Set(), audio: new Set(), spriteAnimations: new Set(), sortingLayers: new Set(), collisionLayers: new Set() }; }
  function collectClosure(project, rootKind, rootRecord) {
    if (!ROOT_KINDS.includes(rootKind)) throw new Error(`Unsupported root kind: ${rootKind}`);
    const refs = emptyRefs(); const root = deepClone(rootRecord);
    const tilesetMap = mapBy(project.tilesets, 'id');
    const prefabMap = mapBy(project.prefabs, 'name');
    const spriteMap = mapBy(project.spriteAssets, 'id');
    const animationMap = mapBy(project.spriteAnimations, 'id');
    const tilesetId = root.tilesetRef;
    if (!tilesetId || !tilesetMap.has(String(tilesetId))) throw new Error(`Missing required Tileset: ${tilesetId || '(none)'}`);
    const tileset = deepClone(tilesetMap.get(String(tilesetId)));
    scanReferences(root, refs, 0); scanReferences(tileset, refs, 0);
    const prefabs = []; const seenPrefabs = new Set(); const queue = [...refs.prefabs];
    while (queue.length) {
      const name = queue.shift(); if (seenPrefabs.has(name)) continue;
      const prefab = prefabMap.get(name); if (!prefab) throw new Error(`Missing required Prefab: ${name}`);
      seenPrefabs.add(name); const copy = deepClone(prefab); prefabs.push(copy);
      const before = new Set(refs.prefabs); scanReferences(copy, refs, 0);
      for (const next of refs.prefabs) if (!before.has(next)) queue.push(next);
      if (seenPrefabs.size > LIMITS.dependencies) throw new Error('Prefab dependency limit exceeded');
    }
    const sprites = [...refs.spriteAssets].map((id) => {
      const record = spriteMap.get(id); if (!record) throw new Error(`Missing required Sprite Asset: ${id}`);
      if (record.sourceTexture) refs.textures.add(record.sourceTexture);
      return deepClone(record);
    });
    const animations = [...refs.spriteAnimations].map((id) => {
      const record = animationMap.get(id); if (!record) throw new Error(`Missing required Sprite Animation: ${id}`);
      const copy = deepClone(record); scanReferences(copy, refs, 0); return copy;
    });
    for (const id of refs.spriteAssets) if (!sprites.some((entry) => entry.id === id)) {
      const record = spriteMap.get(id); if (!record) throw new Error(`Missing required Sprite Asset: ${id}`);
      if (record.sourceTexture) refs.textures.add(record.sourceTexture); sprites.push(deepClone(record));
    }
    const select = (name, field, ids) => {
      const source = mapBy(project[name], field);
      return [...ids].sort().map((id) => { const record = source.get(id); if (!record) throw new Error(`Missing required ${name} dependency: ${id}`); return deepClone(record); });
    };
    const sortingLayers = refs.sortingLayers.size ? select('sortingLayers', 'id', refs.sortingLayers) : [];
    return {
      root,
      dependencies: {
        tilesets: [tileset], spriteAssets: sprites.sort(byId),
        textures: select('textures', 'id', refs.textures), prefabs: prefabs.sort((a, b) => String(a.name).localeCompare(String(b.name))),
        meshAssets: select('meshAssets', 'id', refs.meshAssets), audio: select('audio', 'id', refs.audio),
        spriteAnimations: animations.sort(byId), sortingLayers: sortingLayers.sort(byId),
        ...(refs.collisionLayers.size ? { collisionLayers: [...refs.collisionLayers].sort().map((id) => {
          const layer = Filters.normalizeLayers(project.collisionLayers).find((record) => record.id === id);
          if (!layer) throw new Error(`Missing required collisionLayers dependency: ${id}`);
          return deepClone(layer);
        }) } : {}),
      },
    };
  }
  function byId(a, b) { return String(a.id || '').localeCompare(String(b.id || '')); }

  // Phase200 bounded prerequisite: selected library roots, not a fabricated
  // Tilemap carrying unrelated assets. No project mutation or file IO here.
  const PACK_COLLECTIONS = Object.freeze([...ID_COLLECTIONS, 'tilemapChunks']);
  const PACK_FORMAT = 'digital-opus-asset-pack';
  const PACK_VERSION = 1;
  const PACK_EXTENSION = '.opus-assets.json';
  function collectAssetPackClosure(project, selections) {
    assertArray(selections, 'Asset pack selections', LIMITS.dependencies);
    if (!selections.length) throw new Error('Select at least one library asset for the pack');
    const sources = {}, dependencies = {}, seen = {}, queue = [], roots = [];
    for (const collection of PACK_COLLECTIONS) {
      const identity = collection === 'prefabs' ? 'name' : 'id';
      const records = collection === 'collisionLayers' ? Filters.normalizeLayers(project && project[collection]) : list(project && project[collection]);
      sources[collection] = new Map(); dependencies[collection] = []; seen[collection] = new Set();
      for (const record of records) {
        if (!ownPlain(record) || !String(record[identity] || '')) throw new Error(`Invalid ${collection} library identity`);
        const id = String(record[identity]);
        if (sources[collection].has(id)) throw new Error(`Duplicate ${collection} identity: ${id}`);
        sources[collection].set(id, record);
      }
    }
    const enqueue = (collection, id) => {
      if (!PACK_COLLECTIONS.includes(collection)) throw new Error(`Unsupported asset pack collection: ${collection}`);
      if (!id || typeof id !== 'string') throw new Error('Asset pack identity must be a nonempty string');
      if (BLOCKED_KEYS.has(id)) throw new Error('Reserved asset pack identity; use full project transfer');
      if (seen[collection].has(id)) return;
      const record = sources[collection].get(id);
      if (!record) throw new Error(`Missing required ${collection} dependency: ${id}`);
      if (queue.length >= LIMITS.dependencies) throw new Error('Asset pack dependency limit exceeded');
      seen[collection].add(id); queue.push({ collection, id, record });
    };
    for (const selection of selections) {
      if (!ownPlain(selection) || Object.keys(selection).some(key => key !== 'collection' && key !== 'id')) throw new Error('Invalid asset pack selection');
      enqueue(selection.collection, selection.id);
      if (!roots.some(root => root.collection === selection.collection && root.id === selection.id)) roots.push({ collection: selection.collection, id: selection.id });
    }
    const scan = (value, depth) => {
      if (depth > LIMITS.prefabDepth) throw new Error('Asset pack reference inspection depth exceeded');
      if (Array.isArray(value)) { for (const entry of value) scan(entry, depth + 1); return; }
      if (!ownPlain(value)) return;
      if (value.action === 'customScript' || value.type === 'custom-script' || typeof value.customScript === 'string') throw new Error('Custom Script requires full project transfer, not a bounded asset pack');
      for (const [key, entry] of Object.entries(value)) {
        if (['nodeGraph', 'graphFunctions', 'functionRef'].includes(key) && entry != null) throw new Error('Shared visual logic requires full project transfer until its pack dependencies are supported');
        const collection = key === 'collisionLayerRef' ? 'collisionLayers' : key === 'tilemapChunkRef' ? 'tilemapChunks' : REFERENCE_FIELDS[key];
        if (collection && typeof entry === 'string' && entry) enqueue(collection, entry);
        if (key === 'collisionMaskRefs' && value.collisionMaskMode === 'custom' && Array.isArray(entry)) for (const id of entry) enqueue('collisionLayers', id);
        scan(entry, depth + 1);
      }
    };
    for (let index = 0; index < queue.length; index++) {
      const { collection, record } = queue[index];
      // Canonicalization rejects unsafe keys/nonfinite/prototypes and makes
      // detached records without dropping unknown JSON authoring fields.
      // Bound reference depth before canonical cloning (including cycles).
      scan(record, 0); const copy = canonicalize(record); dependencies[collection].push(copy);
    }
    for (const collection of PACK_COLLECTIONS) dependencies[collection].sort((a, b) => String(collection === 'prefabs' ? a.name : a.id).localeCompare(String(collection === 'prefabs' ? b.name : b.id)));
    roots.sort((a, b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id));
    return { selections: roots, dependencies };
  }
  function validateAssetPackContent(content) {
    if (!ownPlain(content) || Object.keys(content).some(key => !['selections', 'dependencies', 'blobs'].includes(key)) || !ownPlain(content.dependencies)) throw new Error('Asset pack content is incomplete or unsupported');
    assertArray(content.selections, 'Asset pack selections', LIMITS.dependencies);
    assertArray(content.blobs, 'Asset pack blobs', LIMITS.blobs);
    if (Object.keys(content.dependencies).some(key => !PACK_COLLECTIONS.includes(key))) throw new Error('Unsupported asset pack dependency collection');
    for (const collection of PACK_COLLECTIONS) assertArray(content.dependencies[collection], `dependencies.${collection}`, LIMITS.dependencies);
    // Reuse byte/MIME/collision validation, not a fake exported Tilemap root.
    validateContent('asset-pack', { root: { layers: [] }, dependencies: content.dependencies, blobs: content.blobs });
    const hydrated = hydrateBlobs(content), closure = collectAssetPackClosure(hydrated, content.selections);
    if (canonicalStringify(closure.selections) !== canonicalStringify(content.selections) || canonicalStringify(closure.dependencies) !== canonicalStringify(hydrated)) throw new Error('Asset pack dependencies must exactly match its selected typed closure');
    for (const blob of content.blobs) if (!['textures', 'audio'].some(collection => content.dependencies[collection].some(record => record.blobRef === blob.id))) throw new Error('Unreferenced asset pack blob');
  }
  async function createAssetPack(input) {
    const closure = collectAssetPackClosure(input && input.project, input && input.selections);
    const externalized = await externalizeBlobs(closure.dependencies);
    const content = canonicalize({ selections: closure.selections, dependencies: externalized.dependencies, blobs: externalized.blobs });
    validateAssetPackContent(content);
    const unsigned = { format: PACK_FORMAT, version: PACK_VERSION, content }, sha256 = await sha256Hex(canonicalStringify(unsigned));
    const pack = canonicalize({ ...unsigned, integrity: { algorithm: 'SHA-256', sha256 } }), text = canonicalStringify(pack);
    if (utf8Bytes(text).byteLength > LIMITS.textBytes) throw new Error('Asset pack exceeds maximum JSON size');
    return { pack, text, sha256, extension: PACK_EXTENSION, summary: { selected: closure.selections.length, ...Object.fromEntries(PACK_COLLECTIONS.map(collection => [collection, content.dependencies[collection].length])), blobs: content.blobs.length } };
  }
  async function verifyAssetPackText(text) {
    const parsed = parseText(text);
    if (!ownPlain(parsed) || Object.keys(parsed).some(key => !['format', 'version', 'content', 'integrity'].includes(key)) || parsed.format !== PACK_FORMAT || parsed.version !== PACK_VERSION) throw new Error('Unsupported asset pack format or version');
    if (!ownPlain(parsed.integrity) || Object.keys(parsed.integrity).some(key => !['algorithm', 'sha256'].includes(key)) || parsed.integrity.algorithm !== 'SHA-256' || !/^[0-9a-f]{64}$/.test(parsed.integrity.sha256 || '')) throw new Error('Missing asset pack SHA-256 integrity');
    validateAssetPackContent(parsed.content);
    const hash = await sha256Hex(canonicalStringify({ format: parsed.format, version: parsed.version, content: parsed.content }));
    if (hash !== parsed.integrity.sha256) throw new Error('Asset pack integrity check failed');
    for (const blob of parsed.content.blobs) if (await sha256Hex(strictBase64ToBytes(blob.base64)) !== blob.sha256) throw new Error('Asset pack blob integrity check failed');
    if (text !== canonicalStringify(parsed)) throw new Error('Asset pack JSON is not canonical');
    return { pack: canonicalize(parsed), sha256: hash };
  }
  function planAssetPackImport(verified, existing) {
    const pack = verified && verified.pack;
    if (!pack || pack.format !== PACK_FORMAT || pack.version !== PACK_VERSION) throw new Error('Verified asset pack required');
    validateAssetPackContent(pack.content);
    const current = existing || {}, plan = planImport({ rootKind: 'asset-pack', content: { root: { layers: [] }, ...pack.content } }, current);
    const incoming = hydrateBlobs(pack.content), usedIds = new Set(list(current.tilemapChunks).map(record => String(record.id))), usedNames = new Set(list(current.tilemapChunks).map(record => String(record.name || '').toLowerCase()));
    plan.maps.tilemapChunks = Object.create(null);
    for (const record of incoming.tilemapChunks) {
      const old = record.id, next = uniqueId(old, usedIds); plan.maps.tilemapChunks[old] = next; record.id = next;
      if (old !== next) plan.warnings.push(`tilemapChunks identity ${old} → ${next}`);
      const name = uniqueName(record.name, usedNames); if (name !== record.name) plan.warnings.push(`tilemapChunks name ${record.name} → ${name}`); record.name = name;
    }
    // Rewrite only after all typed maps, including Chunk identities, exist.
    for (const collection of ID_COLLECTIONS) plan.dependencies[collection] = plan.dependencies[collection].map(record => rewriteReferences(record, { tilemapChunks: plan.maps.tilemapChunks }, 0));
    plan.dependencies.tilemapChunks = incoming.tilemapChunks.map(record => rewriteReferences(record, plan.maps, 0));
    plan.selections = pack.content.selections.map(selection => ({ collection: selection.collection, id: plan.maps[selection.collection][selection.id] }));
    delete plan.root; plan.summary = { selected: plan.selections.length, ...Object.fromEntries(PACK_COLLECTIONS.map(collection => [collection, plan.dependencies[collection].length])) };
    return plan;
  }

  async function externalizeBlobs(dependencies) {
    const output = deepClone(dependencies); const blobsByHash = new Map();
    async function externalize(collection, dataKey) {
      for (const record of list(output[collection])) {
        if (!record[dataKey]) continue;
        const parsed = parseDataURL(record[dataKey]);
        if (parsed.bytes.byteLength > LIMITS.blobBytes) throw new Error(`Embedded blob exceeds ${LIMITS.blobBytes} bytes`);
        const hash = await sha256Hex(parsed.bytes); const id = `sha256-${hash}`;
        if (!blobsByHash.has(hash)) blobsByHash.set(hash, { id, mimeType: parsed.mimeType, sha256: hash, base64: bytesToBase64(parsed.bytes) });
        delete record[dataKey];
        // Dimensions are decoded properties of the embedded bytes, not a
        // second source of truth. Omitting them prevents decoder-populated
        // width/height from changing a clean import/re-export.
        if (collection === 'textures') { delete record.width; delete record.height; }
        record.blobRef = id;
      }
    }
    await externalize('textures', 'dataURL'); await externalize('audio', 'dataURL');
    const blobs = [...blobsByHash.values()].sort((a, b) => a.sha256.localeCompare(b.sha256));
    if (blobs.length > LIMITS.blobs) throw new Error('Embedded blob count limit exceeded');
    if (blobs.reduce((sum, blob) => sum + strictBase64ToBytes(blob.base64).byteLength, 0) > LIMITS.totalBlobBytes) throw new Error('Total embedded blob size limit exceeded');
    return { dependencies: output, blobs };
  }

  function stripRootIdentity(rootKind, record) {
    const root = deepClone(record); delete root.parentId; delete root.groupId; delete root.localPosition; delete root.localRotationY; delete root.localQuat; delete root.localScale;
    if (rootKind === 'tilemap') { delete root.id; root.kind = 'tilemap'; } else { root.type = 'tilemap-chunk'; root.version = 1; }
    return root;
  }
  function counts(content) {
    const root = content.root || {}; const layers = list(root.layers); const deps = content.dependencies || {};
    return { layers: layers.length, cells: layers.reduce((sum, layer) => sum + list(layer.cells).length, 0), markers: list(root.spawnMarkers).length, tilesets: list(deps.tilesets).length, tiles: list(deps.tilesets).reduce((sum, set) => sum + list(set.tiles).length, 0), prefabs: list(deps.prefabs).length, scripts: countCustomScripts(deps.prefabs), textures: list(deps.textures).length, blobs: list(content.blobs).length };
  }
  function countCustomScripts(value) {
    let count = 0;
    (function visit(entry, depth) {
      if (entry == null || depth > LIMITS.prefabDepth) return;
      if (Array.isArray(entry)) { for (const child of entry) visit(child, depth + 1); return; }
      if (!ownPlain(entry)) return;
      if (entry.action === 'customScript' || entry.type === 'custom-script' || typeof entry.customScript === 'string') count++;
      for (const child of Object.values(entry)) visit(child, depth + 1);
    })(value, 0);
    return count;
  }
  async function createBundle(input) {
    const rootKind = input && input.rootKind;
    if (!ROOT_KINDS.includes(rootKind)) throw new Error(`Unsupported root kind: ${rootKind}`);
    if (rootKind === 'tilemap' && input.root && input.root.parentId) throw new Error('Parented Tilemaps must be detached before portable export so their world transform is unambiguous');
    let normalizedRoot = stripRootIdentity(rootKind, input.root);
    if (authoringPlumbing) {
      const tileset = list(input.project && input.project.tilesets).find((entry) => entry && entry.id === normalizedRoot.tilesetRef);
      if (tileset && rootKind === 'tilemap') {
        const project = { levels: [{ objects: [normalizedRoot] }], tilesets: [tileset] };
        authoringPlumbing.recomputeProjectTerrain(project);
        authoringPlumbing.recomputeProjectAutoTiles(project);
      } else if (tileset && rootKind === 'tilemap-chunk') normalizedRoot = authoringPlumbing.normalizeTilemapChunkSemantics(normalizedRoot, tileset);
    }
    const closure = collectClosure(input.project || {}, rootKind, normalizedRoot);
    const externalized = await externalizeBlobs(closure.dependencies);
    const content = canonicalize({ root: closure.root, dependencies: externalized.dependencies, blobs: externalized.blobs });
    validateContent(rootKind, content);
    const unsigned = { format: FORMAT, version: VERSION, rootKind, content };
    const sha256 = await sha256Hex(canonicalStringify(unsigned));
    const bundle = canonicalize({ ...unsigned, integrity: { algorithm: 'SHA-256', sha256 } });
    const text = canonicalStringify(bundle);
    if (utf8Bytes(text).byteLength > LIMITS.textBytes) throw new Error('Bundle exceeds maximum JSON size');
    return { bundle, text, sha256, summary: counts(content), extension: EXTENSIONS[rootKind] };
  }

  function parseText(text) {
    if (typeof text !== 'string') throw new Error('Bundle must be UTF-8 JSON text');
    if (text.charCodeAt(0) === 0xFEFF) throw new Error('UTF-8 BOM is not permitted');
    if (utf8Bytes(text).byteLength > LIMITS.textBytes) throw new Error('Bundle exceeds maximum JSON size');
    let value; try { value = JSON.parse(text); } catch (error) { throw new Error(`Invalid JSON: ${error.message}`); }
    canonicalize(value); return value;
  }
  function assertArray(value, name, maximum) { if (!Array.isArray(value)) throw new Error(`${name} must be an array`); if (value.length > maximum) throw new Error(`${name} exceeds limit ${maximum}`); }
  function validateContent(rootKind, content) {
    if (!ownPlain(content) || !ownPlain(content.root) || !ownPlain(content.dependencies)) throw new Error('Bundle content is incomplete');
    const root = content.root; const deps = content.dependencies;
    if (rootKind === 'tilemap' && root.kind !== 'tilemap') throw new Error('Tilemap root kind mismatch');
    if (rootKind === 'tilemap-chunk' && root.type !== 'tilemap-chunk') throw new Error('Chunk root kind mismatch');
    assertArray(root.layers, 'root.layers', LIMITS.layers); assertArray(root.spawnMarkers || [], 'root.spawnMarkers', LIMITS.markers);
    let cells = 0; for (const layer of root.layers) { assertArray(layer.cells, 'layer.cells', LIMITS.cells); cells += layer.cells.length; }
    if (cells > LIMITS.cells) throw new Error(`Cell count exceeds limit ${LIMITS.cells}`);
    for (const name of ID_COLLECTIONS) assertArray(deps[name] || [], `dependencies.${name}`, LIMITS.dependencies);
    if (list(deps.collisionLayers).length) {
      const layers = deepClone(deps.collisionLayers);
      if (!layers.some((layer) => layer.id === Filters.DEFAULT_ID)) layers.unshift(Filters.defaultLayer());
      const issues = Filters.validateLayers(layers);
      Filters.visitFilters({ root, prefabs: deps.prefabs }, (filter) => issues.push(...Filters.validateFilter(filter, layers)));
      if (issues.length) throw new Error(`Invalid Collision Layer dependencies: ${issues.map((issue) => issue.code).join(', ')}`);
    }
    assertArray(content.blobs || [], 'content.blobs', LIMITS.blobs);
    const blobIds = new Set(); let bytes = 0;
    for (const blob of content.blobs || []) {
      if (!ownPlain(blob) || !/^sha256-[0-9a-f]{64}$/.test(blob.id || '') || !/^[0-9a-f]{64}$/.test(blob.sha256 || '') || blob.id !== `sha256-${blob.sha256}`) throw new Error('Invalid blob descriptor');
      if (!ALLOWED_MIME.test(blob.mimeType || '')) throw new Error(`Unsupported embedded MIME type: ${blob.mimeType}`);
      const decoded = strictBase64ToBytes(blob.base64); if (decoded.byteLength > LIMITS.blobBytes) throw new Error('Embedded blob size limit exceeded');
      bytes += decoded.byteLength; if (blobIds.has(blob.id)) throw new Error(`Duplicate blob id: ${blob.id}`); blobIds.add(blob.id);
    }
    if (bytes > LIMITS.totalBlobBytes) throw new Error('Total embedded blob size limit exceeded');
    for (const collection of ['textures', 'audio']) for (const record of deps[collection] || []) {
      if (record.dataURL || /^https?:/i.test(String(record.url || ''))) throw new Error('Remote or inline asset URL is not allowed in dependency records');
      if (record.blobRef && !blobIds.has(record.blobRef)) throw new Error(`Missing blob: ${record.blobRef}`);
    }
    canonicalize(content);
  }
  async function verifyBundleText(text, options) {
    const parsed = parseText(text);
    if (parsed.format !== FORMAT) throw new Error(`Unsupported format: ${parsed.format || '(missing)'}`);
    if (parsed.version !== VERSION) throw new Error(`Unsupported bundle version: ${parsed.version}`);
    if (!ROOT_KINDS.includes(parsed.rootKind)) throw new Error(`Unsupported root kind: ${parsed.rootKind}`);
    if (!ownPlain(parsed.integrity) || parsed.integrity.algorithm !== 'SHA-256' || !/^[0-9a-f]{64}$/.test(parsed.integrity.sha256 || '')) throw new Error('Missing or invalid SHA-256 integrity record');
    validateContent(parsed.rootKind, parsed.content);
    const unsigned = { format: parsed.format, version: parsed.version, rootKind: parsed.rootKind, content: parsed.content };
    const expected = await sha256Hex(canonicalStringify(unsigned));
    if (expected !== parsed.integrity.sha256) throw new Error('Bundle integrity check failed');
    for (const blob of parsed.content.blobs || []) if (await sha256Hex(strictBase64ToBytes(blob.base64)) !== blob.sha256) throw new Error(`Blob integrity check failed: ${blob.id}`);
    if (!(options && options.allowNonCanonical) && text !== canonicalStringify(parsed)) throw new Error('Bundle JSON is not canonical');
    return { bundle: canonicalize(parsed), summary: counts(parsed.content), sha256: expected };
  }

  function uniqueId(preferred, used) { const root = String(preferred || 'imported'); if (!used.has(root)) { used.add(root); return root; } let index = 2; while (used.has(`${root}-${index}`)) index++; const id = `${root}-${index}`; used.add(id); return id; }
  function uniqueName(preferred, used) { const root = String(preferred || 'Imported').trim() || 'Imported'; if (!used.has(root.toLowerCase())) { used.add(root.toLowerCase()); return root; } let index = 2; while (used.has(`${root} ${index}`.toLowerCase())) index++; const name = `${root} ${index}`; used.add(name.toLowerCase()); return name; }
  const REFERENCE_FIELDS = Object.freeze({ tilesetRef: 'tilesets', tilemapChunkRef: 'tilemapChunks', spriteAssetRef: 'spriteAssets', spriteAsset: 'spriteAssets', sourceTexture: 'textures', textureAssetId: 'textures', assetId: 'meshAssets', meshAssetId: 'meshAssets', audioAssetId: 'audio', clipRef: 'spriteAnimations', clipId: 'spriteAnimations', sortingLayerRef: 'sortingLayers', prefabRef: 'prefabs', prefabName: 'prefabs', sourcePrefabName: 'prefabs' });
  function rewriteReferences(value, maps, depth) {
    if (depth > LIMITS.prefabDepth || value == null) return value;
    if (Array.isArray(value)) return value.map((entry) => rewriteReferences(entry, maps, depth + 1));
    if (!ownPlain(value)) return value;
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'collisionMaskRefs' && Array.isArray(entry) && maps.collisionLayers) {
        out[key] = entry.map((id) => maps.collisionLayers[id] || id).sort(); continue;
      }
      const collection = REFERENCE_FIELDS[key];
      const targetCollection = key === 'collisionLayerRef' ? 'collisionLayers' : collection;
      out[key] = targetCollection && typeof entry === 'string' && maps[targetCollection] && maps[targetCollection][entry] ? maps[targetCollection][entry] : rewriteReferences(entry, maps, depth + 1);
    }
    return out;
  }
  function hydrateBlobs(content) {
    const blobs = new Map(list(content.blobs).map((blob) => [blob.id, blob])); const deps = deepClone(content.dependencies);
    for (const collection of ['textures', 'audio']) for (const record of list(deps[collection])) if (record.blobRef) { const blob = blobs.get(record.blobRef); record.dataURL = blobDataURL(blob); delete record.blobRef; }
    return deps;
  }
  function planImport(verified, existing) {
    const bundle = verified.bundle || verified; const current = existing || {}; const incoming = hydrateBlobs(bundle.content); const maps = {}; const warnings = [];
    for (const collection of ID_COLLECTIONS) {
      const identity = collection === 'prefabs' ? 'name' : 'id';
      const usedIds = new Set(list(current[collection]).map((record) => String(record && record[identity] || '')));
      const usedNames = new Set(list(current[collection]).map((record) => String(record && record.name || '').toLowerCase()));
      maps[collection] = {};
      for (const record of list(incoming[collection])) {
        if (collection === 'collisionLayers' && record.id === Filters.DEFAULT_ID) { maps[collection][record.id] = record.id; continue; }
        const old = String(record[identity] || ''); const next = uniqueId(old, usedIds); maps[collection][old] = next;
        if (next !== old) warnings.push(`${collection} identity ${old} → ${next}`);
        record[identity] = next;
        if (identity !== 'name' && record.name) { const nextName = uniqueName(record.name, usedNames); if (nextName !== record.name) warnings.push(`${collection} name ${record.name} → ${nextName}`); record.name = nextName; }
      }
    }
    const rewrittenDependencies = {};
    for (const collection of ID_COLLECTIONS) rewrittenDependencies[collection] = list(incoming[collection]).filter((record) => collection !== 'collisionLayers' || record.id !== Filters.DEFAULT_ID || !Filters.normalizeLayers(current.collisionLayers).some((layer) => layer.id === Filters.DEFAULT_ID)).map((record) => rewriteReferences(record, maps, 0));
    if (Filters.normalizeLayers(current.collisionLayers).length + rewrittenDependencies.collisionLayers.length > Filters.MAX_LAYERS) throw new Error('Import would exceed the 32 Collision Layer limit.');
    const root = rewriteReferences(deepClone(bundle.content.root), maps, 0);
    if (bundle.rootKind === 'tilemap-chunk') {
      const usedIds = new Set(list(current.tilemapChunks).map((record) => String(record.id || '')));
      const usedNames = new Set(list(current.tilemapChunks).map((record) => String(record.name || '').toLowerCase()));
      const oldId = String(root.id || 'tilemap-chunk'); root.id = uniqueId(oldId, usedIds); root.name = uniqueName(root.name || 'Tilemap Chunk', usedNames);
      if (root.id !== oldId) warnings.push(`tilemap-chunk identity ${oldId} → ${root.id}`);
    }
    const summary = counts({ root, dependencies: rewrittenDependencies, blobs: bundle.content.blobs });
    if (summary.scripts) warnings.push(`${summary.scripts} imported Custom Script${summary.scripts === 1 ? '' : 's'} will remain untrusted`);
    return { rootKind: bundle.rootKind, root, dependencies: rewrittenDependencies, maps, warnings, summary };
  }
  function materializeImport(plan, existing, options) {
    const next = deepClone(existing || {}); const failAt = options && options.failAt; let step = 0;
    if (list(plan.dependencies.collisionLayers).length || list(existing && existing.collisionLayers).length || Object.keys(plan.maps && plan.maps.collisionLayers || {}).length) next.collisionLayers = Filters.normalizeLayers(next.collisionLayers);
    for (const collection of ID_COLLECTIONS) {
      next[collection] = list(next[collection]);
      for (const record of list(plan.dependencies[collection])) { if (failAt === step++) throw new Error('Injected import failure'); next[collection].push(deepClone(record)); }
    }
    if (failAt === step++) throw new Error('Injected import failure');
    if (plan.rootKind === 'tilemap') { next.tilemaps = list(next.tilemaps); next.tilemaps.push(deepClone(plan.root)); }
    else { next.tilemapChunks = list(next.tilemapChunks); next.tilemapChunks.push(deepClone(plan.root)); }
    return next;
  }

  return Object.freeze({ FORMAT, VERSION, ROOT_KINDS, EXTENSIONS, LIMITS, PACK_COLLECTIONS, PACK_FORMAT, PACK_VERSION, PACK_EXTENSION, collectAssetPackClosure, createAssetPack, verifyAssetPackText, planAssetPackImport, canonicalize, canonicalStringify, sha256Hex, strictBase64ToBytes, parseDataURL, collectClosure, createBundle, verifyBundleText, planImport, materializeImport, rewriteReferences, counts });
});
