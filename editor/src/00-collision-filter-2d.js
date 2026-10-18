// Project-scoped collision identities and shape-owned mutual masks.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusCollisionFilter2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULT_ID = 'collision-layer-default', MAX_LAYERS = 32;
  const defaultFilter = () => ({ collisionLayerRef: DEFAULT_ID, collisionMaskMode: 'all', collisionMaskRefs: [] });
  const defaultLayer = () => ({ id: DEFAULT_ID, name: 'Default', order: 0 });
  function normalizeLayers(layers) {
    if (!Array.isArray(layers)) return [defaultLayer()];
    // Authored invalid IDs/names are retained for validation and explicit repair.
    return layers.map((layer, index) => ({ ...layer, order: Number.isFinite(layer && layer.order) ? layer.order : index }));
  }
  function normalizeFilter(source, historical = false) {
    if (historical) return defaultFilter();
    const value = source || {};
    return { collisionLayerRef: value.collisionLayerRef,
      collisionMaskMode: value.collisionMaskMode,
      collisionMaskRefs: value.collisionMaskMode === 'all' ? [] : Array.isArray(value.collisionMaskRefs)
        ? [...new Set(value.collisionMaskRefs.filter((id) => typeof id === 'string'))].sort() : value.collisionMaskRefs };
  }
  function filterOf(source) {
    if (source && source.filter) return source.filter;
    return normalizeFilter(source, !source || source.version === 1 || source.collisionLayerRef === undefined && source.version === undefined);
  }
  function validLayerIds(layers) {
    const counts = new Map();
    for (const layer of normalizeLayers(layers)) if (layer && typeof layer.id === 'string' && layer.id) counts.set(layer.id, (counts.get(layer.id) || 0) + 1);
    return new Set([...counts].filter(([, count]) => count === 1).map(([id]) => id));
  }
  function allows(a, b, layers) {
    const left = filterOf(a), right = filterOf(b), ids = layers instanceof Set ? layers : validLayerIds(layers);
    if (!ids.has(left.collisionLayerRef) || !ids.has(right.collisionLayerRef)) return false;
    const accepts = (filter, id) => filter.collisionMaskMode === 'all' || filter.collisionMaskMode === 'custom' && Array.isArray(filter.collisionMaskRefs) && filter.collisionMaskRefs.includes(id);
    return accepts(left, right.collisionLayerRef) && accepts(right, left.collisionLayerRef);
  }
  function validateLayers(layers) {
    const issues = [], records = Array.isArray(layers) ? layers : [];
    const add = (code, message, field = 'collisionLayers') => issues.push({ code, message, field, severity: 'error' });
    if (!Array.isArray(layers)) add('collision-layers-missing', 'Collision Layer registry is missing.');
    if (!records.some((layer) => layer && layer.id === DEFAULT_ID)) add('collision-layer-default-missing', 'Reserved Default Collision Layer is missing.');
    if (records.length > MAX_LAYERS) add('collision-layer-limit', 'A project supports at most 32 Collision Layers.');
    const ids = new Set(), names = new Set();
    records.forEach((layer, index) => {
      const field = `collisionLayers.${index}`;
      if (!layer || typeof layer.id !== 'string' || !layer.id.trim()) { add('collision-layer-id', 'Layer needs a stable ID.', field); return; }
      if (ids.has(layer.id)) add('collision-layer-duplicate-id', 'Duplicate Collision Layer ID.', field); ids.add(layer.id);
      const name = typeof layer.name === 'string' ? layer.name.trim() : '';
      if (!name) add('collision-layer-name', 'Layer name must not be empty.', field);
      if (names.has(name.toLowerCase())) add('collision-layer-duplicate-name', 'Layer names must be unique ignoring case.', field); names.add(name.toLowerCase());
      if (layer.id === DEFAULT_ID && name !== 'Default') add('collision-layer-default-name', 'Reserved layer must be named Default.', field);
    });
    return issues;
  }
  function validateFilter(source, layers) {
    const ids = validLayerIds(layers), issues = [], filter = filterOf(source);
    const add = (field, code, message) => issues.push({ field, code, message, severity: 'error' });
    if (!ids.has(filter.collisionLayerRef)) add('collisionLayerRef', 'collision-filter-layer-missing', 'Choose an existing Collision Layer; missing references do not interact.');
    if (!['all', 'custom'].includes(filter.collisionMaskMode)) add('collisionMaskMode', 'collision-filter-mode', 'Mask Mode must be All Layers or Custom.');
    if (!Array.isArray(source && source.collisionMaskRefs)) add('collisionMaskRefs', 'collision-filter-refs', 'Mask references must be an array.');
    else {
      if (new Set(source.collisionMaskRefs).size !== source.collisionMaskRefs.length) add('collisionMaskRefs', 'collision-filter-duplicate-ref', 'Mask contains duplicate Collision Layer references.');
      for (const id of source.collisionMaskRefs) if (!ids.has(id)) add('collisionMaskRefs', 'collision-filter-mask-missing', `Missing Collision Layer in mask: ${String(id)}.`);
    }
    return issues;
  }
  function visitFilters(project, visitor) {
    const seen = new WeakSet();
    function walk(value, location) {
      if (!value || typeof value !== 'object' || seen.has(value)) return; seen.add(value);
      if (Object.prototype.hasOwnProperty.call(value, 'collisionLayerRef')) visitor(value, location);
      if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${location}.${index}`));
      else for (const [key, item] of Object.entries(value)) if (key !== 'collisionLayers' && key !== 'entity' && key !== 'worldMatrix') walk(item, `${location}.${key}`);
    }
    walk(project, 'project');
  }
  function usage(project, id) {
    const primary = [], masks = [];
    visitFilters(project, (filter, location) => { if (filter.collisionLayerRef === id) primary.push(location); if (filter.collisionMaskMode === 'custom' && Array.isArray(filter.collisionMaskRefs) && filter.collisionMaskRefs.includes(id)) masks.push(location); });
    return { primary, masks };
  }
  function addLayer(project, name, requestedId) {
    const layers = project.collisionLayers = normalizeLayers(project.collisionLayers);
    if (layers.length >= MAX_LAYERS) return { ok: false, reason: 'Maximum of 32 Collision Layers reached.' };
    const label = String(name || '').trim();
    if (!label || layers.some((layer) => String(layer.name).toLowerCase() === label.toLowerCase())) return { ok: false, reason: 'Choose a nonempty unique layer name.' };
    let id = requestedId || `collision-layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    if (layers.some((layer) => layer.id === id)) return { ok: false, reason: 'Collision Layer ID already exists.' };
    const layer = { id, name: label, order: layers.length }; layers.push(layer); return { ok: true, layer };
  }
  function renameLayer(project, id, name) {
    const layer = (project.collisionLayers || []).find((item) => item.id === id), label = String(name || '').trim();
    if (!layer || id === DEFAULT_ID || !label || project.collisionLayers.some((item) => item.id !== id && String(item.name).toLowerCase() === label.toLowerCase())) return { ok: false, reason: 'Choose a unique nonempty name for a nonreserved layer.' };
    layer.name = label; return { ok: true };
  }
  function reorderLayer(project, id, index) {
    const layers = project.collisionLayers || [], from = layers.findIndex((layer) => layer.id === id);
    if (from < 0 || !Number.isInteger(index) || index < 0 || index >= layers.length) return { ok: false };
    layers.splice(index, 0, layers.splice(from, 1)[0]); layers.forEach((layer, i) => { layer.order = i; }); return { ok: true };
  }
  function deleteLayer(project, id, replacementId, confirmed = false) {
    const layers = project.collisionLayers || [], found = layers.some((layer) => layer.id === id), use = usage(project, id);
    if (!found || id === DEFAULT_ID || !confirmed) return { ok: false, reason: 'Deletion requires confirmation and cannot remove Default.', usage: use };
    if (use.primary.length && (!replacementId || replacementId === id || !layers.some((layer) => layer.id === replacementId))) return { ok: false, reason: 'Choose an explicit replacement for primary layer assignments.', usage: use };
    visitFilters(project, (filter) => { if (filter.collisionLayerRef === id) filter.collisionLayerRef = replacementId; if (filter.collisionMaskMode === 'custom' && Array.isArray(filter.collisionMaskRefs)) filter.collisionMaskRefs = filter.collisionMaskRefs.filter((ref) => ref !== id); });
    project.collisionLayers = layers.filter((layer) => layer.id !== id).map((layer, order) => ({ ...layer, order })); return { ok: true, usage: use };
  }
  return Object.freeze({ DEFAULT_ID, MAX_LAYERS, defaultFilter, defaultLayer, normalizeLayers, normalizeFilter, filterOf, validLayerIds, allows, validateLayers, validateFilter, visitFilters, usage, addLayer, renameLayer, reorderLayer, deleteLayer });
});
