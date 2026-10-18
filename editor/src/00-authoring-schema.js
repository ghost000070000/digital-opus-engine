// Digital Opus authoring schema/component seam.
//
// This module describes editor-facing data only. It does not own runtime
// behavior, physics, rendering, Actions, AI, or export execution. It is a
// plain browser global and a CommonJS module so the exact same contract is
// exercised by editor integrations and dependency-free Node tests.
(function (root, factory) {
  'use strict';
  const filters = typeof module !== 'undefined' && module.exports ? require('./00-collision-filter-2d.js') : root.OpusCollisionFilter2D;
  const aiBrain = typeof module !== 'undefined' && module.exports ? require('./00-ai-brain.js') : root.OpusAiBrain;
  const damagePolicy = typeof module !== 'undefined' && module.exports ? require('./00-damage-policy.js') : root.OpusDamagePolicy;
  const combatVolumes = typeof module !== 'undefined' && module.exports ? require('./00-combat-volumes.js') : root.OpusCombatVolumes;
  const api = factory(filters, aiBrain, damagePolicy, combatVolumes);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusAuthoring = api;
})(typeof window !== 'undefined' ? window : this, function (Filters, AiBrain, DamagePolicy, CombatVolumes) {
  'use strict';

  const COMPONENT_RECORD_VERSION = 1;
  const FIELD_TYPES = Object.freeze([
    'boolean', 'number', 'integer', 'string', 'multiline', 'color', 'enum',
    'vec2', 'vec3', 'assetRef', 'objectRef', 'levelRef', 'inputActionRef',
    'objectiveRef', 'prefabRef', 'sortingLayerRef', 'parallaxLayerRef', 'collisionLayerRef', 'collisionMaskRefs', 'itemRef',
  ]);
  const REFERENCE_TYPES = Object.freeze(['asset', 'object', 'level', 'objective', 'prefab', 'sortingLayer', 'parallaxLayer', 'collisionLayer', 'item', 'inputAction']);

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  }
  function stableClone(value) {
    if (Array.isArray(value)) return value.map(stableClone);
    if (!isPlainObject(value)) return value;
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stableClone(value[key]);
    return out;
  }
  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }
  function finite(value) {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function vector(value, dimensions, fallback) {
    const source = Array.isArray(value)
      ? value
      : value && typeof value === 'object'
        ? dimensions === 2 ? [value.x, value.y] : [value.x, value.y, value.z]
        : null;
    if (!source || source.length < dimensions) return clone(fallback);
    const parsed = source.slice(0, dimensions).map(finite);
    return parsed.some((part) => part === null) ? clone(fallback) : parsed;
  }
  function fieldDefault(schema, field) {
    if (Object.prototype.hasOwnProperty.call(schema.defaults, field.key)) return clone(schema.defaults[field.key]);
    return field.nullable ? null : undefined;
  }
  function normalizeFieldValue(schema, field, value) {
    // Opt-in controllers must not turn corrupt saved intent into playable
    // defaults merely by displaying, copying, or exporting the Inspector.
    if (schema.preserveAuthoredValues) return clone(value);
    // Invalid authored filters remain inspectable and fail closed at runtime.
    if (['collisionLayerRef', 'collisionMaskMode', 'collisionMaskRefs'].includes(field.key)) return clone(value);
    const fallback = fieldDefault(schema, field);
    if (value === '' || value === null || value === undefined) return fallback;
    if (field.type === 'boolean') return !!value;
    if (field.type === 'number' || field.type === 'integer') {
      let parsed = finite(value);
      if (parsed === null) return fallback;
      if (field.type === 'integer') parsed = Math.round(parsed);
      return parsed;
    }
    if (field.type === 'string' || field.type === 'multiline') return String(value);
    if (field.type === 'color') return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : fallback;
    if (field.type === 'enum') return (field.choices || []).includes(value) ? value : fallback;
    if (field.type === 'vec2') return vector(value, 2, fallback);
    if (field.type === 'vec3') return vector(value, 3, fallback);
    if (field.type.endsWith('Ref')) return value === '' ? fallback : String(value);
    return clone(value);
  }
  function issue(componentId, field, severity, code, message) {
    return { componentId, field: field || null, severity, code, message };
  }
  function stripRuntimeFields(value, runtimeFields) {
    if (!isPlainObject(value)) return stableClone(value);
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (key.startsWith('_') || runtimeFields.has(key)) continue;
      out[key] = stableClone(value[key]);
    }
    return out;
  }

  // Registration owns metadata rather than freezing the caller's maps. Hooks
  // remain the same functions; this is not a new component execution system.
  function ownSchemaMetadata(value, ancestors = new Set()) {
    if (!Array.isArray(value) && !isPlainObject(value)) return value;
    if (ancestors.has(value)) throw new Error('Component metadata must not contain a cycle');
    ancestors.add(value);
    const copy = Array.isArray(value) ? value.map(v => ownSchemaMetadata(v, ancestors))
      : Object.fromEntries(Object.keys(value).map(key => [key, ownSchemaMetadata(value[key], ancestors)]));
    ancestors.delete(value);
    return Object.freeze(copy);
  }

  class AuthoringSchemaRegistry {
    constructor() { this._schemas = new Map(); }
    register(definition) {
      if (['box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d'].includes(definition && definition.id)) {
        definition = { ...definition, version: 2,
          defaults: { ...definition.defaults, ...Filters.defaultFilter() },
          ownedFields: [...definition.ownedFields, 'collisionLayerRef', 'collisionMaskMode', 'collisionMaskRefs'],
          migrate: (record) => ({ ...record, ...Filters.defaultFilter() }),
          fields: [...definition.fields,
            { key: 'collisionLayerRef', label: 'Collision Layer', help: 'Stable project layer identity owned by this geometry.', type: 'collisionLayerRef', group: 'Collision Filtering', required: true },
            { key: 'collisionMaskMode', label: 'Collision Mask', help: 'All Layers includes future layers. Custom accepts only the checked layers, and an empty list accepts nothing.', type: 'enum', choices: ['all', 'custom'], choiceLabels: { all: 'All Layers', custom: 'Custom' }, group: 'Collision Filtering' },
            { key: 'collisionMaskRefs', label: 'Accepted Layers', help: 'Both geometries must accept each other. Missing identities never interact.', type: 'collisionMaskRefs', group: 'Collision Filtering' }],
        };
      }
      if (!definition || !/^[a-z][a-z0-9-]*$/.test(definition.id || '')) throw new Error('Component schema needs a stable lowercase id');
      if (this._schemas.has(definition.id)) throw new Error(`Component schema "${definition.id}" is already registered`);
      if (!definition.displayName || !definition.category) throw new Error(`Component schema "${definition.id}" needs displayName and category`);
      if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error(`Component schema "${definition.id}" needs a positive integer version`);
      if (!Array.isArray(definition.eligibility) || definition.eligibility.length === 0) throw new Error(`Component schema "${definition.id}" needs eligibility metadata`);
      if (!Array.isArray(definition.fields)) throw new Error(`Component schema "${definition.id}" needs fields[]`);
      if (definition.addable !== undefined && typeof definition.addable !== 'boolean') throw new Error(`Component schema "${definition.id}" addable must be boolean`);
      if (definition.multiplicity !== undefined && definition.multiplicity !== 'single') throw new Error(`Component schema "${definition.id}" uses unsupported multiplicity`);
      const fieldKeys = new Set();
      const fields = definition.fields.map((field, index) => {
        if (!isPlainObject(field) || !field.key || !FIELD_TYPES.includes(field.type)) throw new Error(`Invalid field in component schema "${definition.id}"`);
        if (fieldKeys.has(field.key)) throw new Error(`Duplicate component field "${definition.id}.${field.key}"`);
        fieldKeys.add(field.key);
        const referenceType = field.type.endsWith('Ref') ? field.type.slice(0, -3) : null;
        if (referenceType && !REFERENCE_TYPES.includes(referenceType)) throw new Error(`Invalid reference type for "${definition.id}.${field.key}"`);
        return Object.freeze({ order: index, group: 'General', ...field, referenceType });
      });
      const ownedFields = definition.ownedFields || fields.map((field) => field.key);
      for (const key of ownedFields) if (!fields.some((field) => field.key === key)) throw new Error(`Owned field "${key}" has no descriptor in "${definition.id}"`);
      const schema = ownSchemaMetadata({
        defaults: {}, help: '', inspector: { group: definition.category, order: 0 },
        serialization: { owner: definition.id, duplicate: 'deep-copy', prefab: 'shared-record-path' },
        addable: false, multiplicity: 'single', runtimeFields: [], migrate: (record) => record, validate: () => [],
        ...definition, fields: Object.freeze(fields), ownedFields: Object.freeze(ownedFields.slice()),
      });
      this._schemas.set(schema.id, schema);
      return schema;
    }
    get(id) { return this._schemas.get(id) || null; }
    list() { return [...this._schemas.values()].sort((a, b) => a.inspector.order - b.inspector.order || a.id.localeCompare(b.id)); }
    describe(id) {
      const schema = this.get(id); if (!schema) return null;
      const hooks = ['readTarget','applyTarget','readLegacyRecord','migrate','validate','initialize','isEligible','isPresent','removeTarget'];
      return ownSchemaMetadata(JSON.parse(JSON.stringify({
        id: schema.id, version: schema.version, displayName: schema.displayName,
        category: schema.category, help: schema.help, addable: schema.addable, removable: schema.addable===true && schema.removable!==false,
        multiplicity: schema.multiplicity, eligibility: schema.eligibility,
        defaults: schema.defaults, fields: schema.fields, ownedFields: schema.ownedFields,
        runtimeFields: schema.runtimeFields, inspector: schema.inspector,
        serialization: schema.serialization,
        hooks: Object.fromEntries(hooks.map(name => [name, typeof schema[name] === 'function'])),
      })));
    }
    catalog() { return ownSchemaMetadata({ version: 1, components: this.list().map(schema => this.describe(schema.id)) }); }
  }

  function eligibilityMatches(schema, target) {
    if (!target) return false;
    if (typeof schema.isEligible === 'function') return !!schema.isEligible(target);
    return schema.eligibility.includes('any')
      || (schema.eligibility.includes('scene-object') && target.kind === 'cube')
      || (schema.eligibility.includes('player') && target.kind === 'player')
      || (schema.eligibility.includes('camera') && target.kind === 'camera')
      || (schema.eligibility.includes('terrain') && target.kind === 'terrain')
      || (schema.eligibility.includes('trigger') && !!target.isTrigger)
      || (schema.eligibility.includes('path') && target.kind === 'path')
      || (schema.eligibility.includes('emitter') && target.kind === 'emitter')
      || (schema.eligibility.includes('sprite') && target.kind === 'sprite');
  }

  function componentExists(schema, target) {
    if (!schema || !target) return false;
    if (isPlainObject(target.components) && Object.prototype.hasOwnProperty.call(target.components, schema.id)) return true;
    if (typeof schema.isPresent === 'function') return !!schema.isPresent(target);
    return typeof schema.readTarget === 'function' && schema.readTarget(target) != null;
  }

  function normalizedSearchTokens(query) {
    return String(query || '').toLowerCase().trim().split(/[^a-z0-9]+/).filter(Boolean);
  }

  function normalizeKnownRecord(schema, input) {
    if (schema.preserveAuthoredValues && isPlainObject(input)) {
      let preserved=stripRuntimeFields(input,new Set(schema.runtimeFields));
      if(schema.migratePreservedRecords && schema.inspectRecord(input).ok){
        let version=Number.isInteger(preserved.version)?preserved.version:1;
        while(version<schema.version){preserved=schema.migrate(preserved,version)||preserved;preserved.version=++version;}
      }
      return preserved;
    }
    let source = isPlainObject(input) ? clone(input) : {};
    let fromVersion = Number.isInteger(source.version) ? source.version : 1;
    if (fromVersion > schema.version) return stripRuntimeFields(source, new Set(schema.runtimeFields));
    while (fromVersion < schema.version) {
      source = schema.migrate(clone(source), fromVersion) || source;
      fromVersion++;
      source.version = fromVersion;
    }
    const runtimeFields = new Set(schema.runtimeFields);
    const out = { version: schema.version };
    for (const field of schema.fields) {
      const normalized = normalizeFieldValue(schema, field, source[field.key]);
      if (normalized !== undefined) out[field.key] = normalized;
    }
    if (out.collisionMaskMode === 'all') out.collisionMaskRefs = [];
    else if (Array.isArray(out.collisionMaskRefs)) out.collisionMaskRefs.sort();
    // Preserve future authoring extensions on known versions. Only declared
    // runtime/transient keys and underscore-prefixed caches are stripped.
    for (const key of Object.keys(source).sort()) {
      if (key === 'version' || schema.ownedFields.includes(key) || key.startsWith('_') || runtimeFields.has(key)) continue;
      out[key] = stableClone(source[key]);
    }
    return out;
  }

  function createAuthoringApi(registry) {
    function ensureComponent(target, schemaId) {
      const schema = registry.get(schemaId);
      if (!schema || !eligibilityMatches(schema, target)) return null;
      target.components = isPlainObject(target.components) ? target.components : {};
      if (schema.preserveInvalidRecords && Object.prototype.hasOwnProperty.call(target.components,schemaId) && !(schema.inspectRecord || AiBrain.inspect)(target.components[schemaId]).ok) return target.components[schemaId];
      if (schema.preserveInvalidRecords && !Object.prototype.hasOwnProperty.call(target.components,schemaId) && target.entity?.ai && !AiBrain.captureLegacy(target.entity.ai).ok) return null;
      if (!isPlainObject(target.components[schemaId])) {
        const legacy = schema.readTarget ? schema.readTarget(target) : null;
        target.components[schemaId] = normalizeKnownRecord(schema, legacy || schema.defaults);
      } else if ((target.components[schemaId].version || 1) <= schema.version) {
        const live = schema.readTarget ? schema.readTarget(target) : null;
        target.components[schemaId] = normalizeKnownRecord(schema, { ...target.components[schemaId], ...(live || {}) });
      }
      const component = target.components[schemaId];
      if ((component.version || 1) <= schema.version && schema.applyTarget) schema.applyTarget(target, component);
      return component;
    }

    function applyRecord(record, target) {
      const input = isPlainObject(record && record.components) ? record.components : {};
      target.components = {};
      // Unknown component ids are safe inert authoring data and survive.
      for (const id of Object.keys(input).sort()) {
        if (!registry.get(id)) target.components[id] = stripRuntimeFields(input[id], new Set());
      }
      for (const schema of registry.list()) {
        if (!eligibilityMatches(schema, target)) continue;
        if (schema.preserveInvalidRecords && Object.prototype.hasOwnProperty.call(input,schema.id)) {
          target.components[schema.id]=clone(input[schema.id]);
          if(schema.migratePreservedRecords && schema.inspectRecord(target.components[schema.id]).ok) target.components[schema.id]=normalizeKnownRecord(schema,target.components[schema.id]);
          if ((schema.inspectRecord || AiBrain.inspect)(target.components[schema.id]).ok) schema.applyTarget?.(target,target.components[schema.id]);
          continue;
        }
        const source = input[schema.id] || (schema.readLegacyRecord ? schema.readLegacyRecord(record, target) : null);
        if (!source) continue;
        const component = normalizeKnownRecord(schema, source);
        target.components[schema.id] = component;
        if ((component.version || 1) <= schema.version && schema.applyTarget) schema.applyTarget(target, component);
      }
      if (Object.keys(target.components).length === 0) delete target.components;
      return target;
    }

    function serializeComponents(target) {
      const sourceBag = isPlainObject(target && target.components) ? target.components : {};
      const out = {};
      for (const id of Object.keys(sourceBag).sort()) {
        if (!registry.get(id)) out[id] = stripRuntimeFields(sourceBag[id], new Set());
      }
      for (const schema of registry.list()) {
        if (!eligibilityMatches(schema, target)) continue;
        if (schema.preserveInvalidRecords && Object.prototype.hasOwnProperty.call(sourceBag,schema.id) && !(schema.inspectRecord || AiBrain.inspect)(sourceBag[schema.id]).ok) {
          out[schema.id]=clone(sourceBag[schema.id]);
          continue;
        }
        if ((sourceBag[schema.id]?.version || 1)>schema.version) {
          out[schema.id]=stripRuntimeFields(sourceBag[schema.id],new Set(schema.runtimeFields));
          continue;
        }
        const source = schema.readTarget ? schema.readTarget(target) : sourceBag[schema.id];
        if (!source && !sourceBag[schema.id]) continue;
        const merged = { ...(sourceBag[schema.id] || {}), ...(source || {}) };
        out[schema.id] = normalizeKnownRecord(schema, merged);
      }
      return Object.keys(out).length ? stableClone(out) : undefined;
    }

    function copyComponents(source, target) {
      const serialized = serializeComponents(source);
      return applyRecord({ components: serialized || {} }, target);
    }

    function getComponentAddability(target, schemaId) {
      const schema = typeof schemaId === 'string' ? registry.get(schemaId) : schemaId;
      if (!schema) return { addable: false, code: 'unknown-component', reason: 'Unknown component.' };
      if (schema.addable !== true) return { schema, addable: false, code: 'internal-component', reason: 'Not available for creator attachment.' };
      if (!eligibilityMatches(schema, target)) return { schema, addable: false, code: 'ineligible-target', reason: 'Not valid for this object type.' };
      if (schema.multiplicity === 'single' && componentExists(schema, target)) return { schema, addable: false, code: 'already-added', reason: 'Already added.' };
      return { schema, addable: true, code: 'addable', reason: '' };
    }

    function discoverComponents(target, query) {
      const tokens = normalizedSearchTokens(query);
      return registry.list()
        .filter((schema) => schema.addable === true && eligibilityMatches(schema, target))
        .filter((schema) => {
          const searchable = `${schema.displayName} ${schema.id} ${schema.category}`.toLowerCase();
          return tokens.every((token) => searchable.includes(token));
        })
        .map((schema) => Object.freeze({ schema, contract: registry.describe(schema.id), ...getComponentAddability(target, schema) }));
    }

    function addComponent(target, schemaId, options = {}) {
      const state = getComponentAddability(target, schemaId);
      if (!state.addable) return { ok: false, ...state };
      if (typeof options.onBeforeChange === 'function') options.onBeforeChange(state.schema);
      const component = ensureComponent(target, state.schema.id);
      if (!component) return { ok: false, schema: state.schema, code: 'creation-failed', reason: 'Component could not be created for this object.' };
      // Optional one-time initialization belongs to the schema and runs only
      // on an explicit Add Component action. It is intentionally not part of
      // ensureComponent/load, so visual-fit defaults never become a live bind.
      if (typeof state.schema.initialize === 'function') state.schema.initialize(component, target);
      const issues = validateComponent(target, state.schema.id);
      if (typeof options.onChange === 'function') options.onChange(state.schema, component, issues);
      return { ok: true, schema: state.schema, component, issues };
    }

    // Apply one authored settings record without replacing the object's bag.
    // Validate a detached candidate first; hooks execute only after one history
    // snapshot. Unlike applyRecord, unrelated and future records stay untouched.
    function applyComponentSettings(target,schemaId,record,options={}) {
      const schema=registry.get(schemaId);
      if(!schema||schema.addable!==true||!eligibilityMatches(schema,target))return {ok:false,reason:'These settings are not compatible with the selected Object.'};
      if(schema.preserveInvalidRecords&&target?.components&&Object.prototype.hasOwnProperty.call(target.components,schemaId)&&!(schema.inspectRecord || AiBrain.inspect)(target.components[schemaId]).ok)return {ok:false,reason:'Unsupported or malformed component data is preserved; remove it explicitly before adding replacement settings.'};
      if(!isPlainObject(record)||(record.version||1)>schema.version||(target.components?.[schemaId]?.version||1)>schema.version)return {ok:false,reason:'Newer component settings require a compatible editor.'};
      const component=normalizeKnownRecord(schema,record);
      const candidate={...target,components:{...(target.components||{}),[schemaId]:component}};
      const issues=validateComponent(candidate,schemaId);
      if(issues.some(entry=>entry.severity==='error'))return {ok:false,reason:issues.find(entry=>entry.severity==='error').message,issues};
      if(typeof options.onBeforeChange==='function')options.onBeforeChange(schema);
      target.components=isPlainObject(target.components)?target.components:{};
      target.components[schemaId]=component;
      if(schema.applyTarget)schema.applyTarget(target,component);
      if(typeof options.onChange==='function')options.onChange(schema,component,issues);
      return {ok:true,schema,component,issues};
    }

    // Portable Inspector presentation metadata, never runtime execution order.
    function orderedComponents(target) {
      return registry.list().filter(schema => eligibilityMatches(schema,target) && componentExists(schema,target))
        .map((schema,index) => ({schema,index,order:target.components?.[schema.id]?.inspectorOrder}))
        .sort((a,b) => (Number.isSafeInteger(a.order) && a.order>=0 ? a.order : 100000+a.index)
          - (Number.isSafeInteger(b.order) && b.order>=0 ? b.order : 100000+b.index) || a.index-b.index)
        .map(entry => entry.schema);
    }
    function componentMutationState(target,schemaId) {
      const schema=registry.get(schemaId);
      if (!schema || !eligibilityMatches(schema,target) || !componentExists(schema,target)) return {ok:false,reason:'Component is not attached.'};
      if ((target.components?.[schemaId]?.version || 1)>schema.version) return {ok:false,schema,reason:'Newer component data is preserved; use a compatible editor to change it.'};
      return {ok:true,schema};
    }
    function getComponentRemovability(target,schemaId) {
      const state=componentMutationState(target,schemaId);
      if (!state.ok) return state;
      if (state.schema.addable!==true || state.schema.removable===false) return {ok:false,schema:state.schema,reason:'This is a required Object component. Its settings stay editable; it cannot be removed independently.'};
      return state;
    }
    function removeComponent(target,schemaId,options={}) {
      const state=getComponentRemovability(target,schemaId); if (!state.ok) return state;
      options.onBeforeChange?.(state.schema);
      if (state.schema.removeTarget) state.schema.removeTarget(target);
      if (target.components) { delete target.components[schemaId]; if (!Object.keys(target.components).length) delete target.components; }
      options.onChange?.(state.schema);
      return state;
    }
    function moveComponent(target,schemaId,direction,options={}) {
      const state=componentMutationState(target,schemaId); if (!state.ok) return state;
      const schemas=orderedComponents(target),index=schemas.findIndex(s=>s.id===schemaId),next=index+direction;
      if (![1,-1].includes(direction) || next<0 || next>=schemas.length) return {ok:false,reason:'Already at the edge of the Inspector component list.'};
      if (schemas.some(s=>(target.components?.[s.id]?.version||1)>s.version)) return {ok:false,reason:'Newer component data is preserved; ordering requires a compatible editor.'};
      options.onBeforeChange?.(state.schema);
      [schemas[index],schemas[next]]=[schemas[next],schemas[index]];
      schemas.forEach((schema,order)=>{ensureComponent(target,schema.id).inspectorOrder=order;});
      options.onChange?.(state.schema);
      return {ok:true,schema:state.schema};
    }

    function validateComponent(target, schemaId) {
      const schema = registry.get(schemaId);
      if (!schema) return [issue(schemaId, null, 'error', 'unknown-component', `Unknown component "${schemaId}"`)];
      const component = target && target.components && target.components[schemaId];
      if (schema.preserveInvalidRecords && target?.components && Object.prototype.hasOwnProperty.call(target.components,schemaId) && !(schema.inspectRecord || AiBrain.inspect)(component).ok) return [issue(schemaId,null,'error','invalid-record',(schema.inspectRecord || AiBrain.inspect)(component).reason)];
      if (!component) return [];
      if ((component.version || 1) > schema.version) {
        return [issue(schemaId, null, 'warning', 'newer-version', `${schema.displayName} version ${component.version} is newer than supported version ${schema.version}; data is preserved but not edited` )];
      }
      const issues = [];
      for (const field of schema.fields) {
        const value = component[field.key];
        if (field.required && (value === null || value === undefined || value === '')) {
          issues.push(issue(schema.id, field.key, 'error', 'required', `${field.label || field.key} is required.`));
          continue;
        }
        if (value === null || value === undefined) continue;
        if ((field.type === 'number' || field.type === 'integer') && !Number.isFinite(value)) issues.push(issue(schema.id, field.key, 'error', 'number-required', `${field.label || field.key} must be a number.`));
        if (field.type === 'integer' && Number.isFinite(value) && !Number.isInteger(value)) issues.push(issue(schema.id, field.key, 'error', 'integer-required', `${field.label || field.key} must be a whole number.`));
        if ((field.type === 'number' || field.type === 'integer') && field.min !== undefined && value < field.min) issues.push(issue(schema.id, field.key, 'error', 'below-minimum', `${field.label || field.key} must be at least ${field.min}.`));
        if ((field.type === 'number' || field.type === 'integer') && field.max !== undefined && value > field.max) issues.push(issue(schema.id, field.key, 'error', 'above-maximum', `${field.label || field.key} must be at most ${field.max}.`));
        if (field.type === 'enum' && !(field.choices || []).includes(value)) issues.push(issue(schema.id, field.key, 'error', 'invalid-choice', `${field.label || field.key} has an unsupported choice.`));
      }
      issues.push(...(schema.validate(component, target) || []).map((entry) => ({ componentId: schema.id, field: null, severity: 'error', ...entry })));
      return issues;
    }

    function validateTarget(target) {
      if (!target || !target.components) return [];
      return Object.keys(target.components).sort().flatMap((id) => validateComponent(target, id));
    }

    function escapeHtml(value) {
      return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function controlHtml(schema, field, value, optionsFor) {
      const attrs = `data-component-field="${escapeHtml(field.key)}"`;
      if (field.type === 'boolean') return `<input type="checkbox" ${attrs}${value ? ' checked' : ''}>`;
      if (field.type === 'color') return `<input type="color" ${attrs} value="${escapeHtml(value || '#ffffff')}">`;
      if (field.type === 'enum') return `<select ${attrs}>${(field.choices || []).map((choice) => `<option value="${escapeHtml(choice)}"${choice === value ? ' selected' : ''}>${escapeHtml((field.choiceLabels && field.choiceLabels[choice]) || choice)}</option>`).join('')}</select>`;
      if (field.type === 'vec2' || field.type === 'vec3') {
        const axes = field.type === 'vec2' ? ['x', 'y'] : ['x', 'y', 'z'];
        const current = vector(value, axes.length, fieldDefault(schema, field)) || axes.map(() => 0);
        return `<div class="field-triple">${axes.map((axis, index) => `<input type="number" ${attrs} data-component-axis="${axis}" step="${field.step || 0.1}" value="${current[index]}">`).join('')}</div>`;
      }
      if (field.type.endsWith('Ref')) {
        const options = typeof optionsFor === 'function' ? optionsFor(field.referenceType, field) || [] : [];
        return `<select ${attrs}><option value="">None</option>${options.map((option) => `<option value="${escapeHtml(option.value)}"${option.value === value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select>`;
      }
      if (field.type === 'multiline') return `<textarea ${attrs}>${escapeHtml(value === null || value === undefined ? '' : value)}</textarea>`;
      const inputType = field.type === 'string' ? 'text' : 'number';
      const constraints = `${field.min !== undefined ? ` min="${field.min}"` : ''}${field.max !== undefined ? ` max="${field.max}"` : ''}${field.step !== undefined ? ` step="${field.step}"` : ''}`;
      return `<input type="${inputType}" ${attrs}${constraints} value="${escapeHtml(value === null || value === undefined ? '' : value)}">`;
    }

    function renderComponentSection(container, options) {
      const schema = registry.get(options.schemaId);
      const target = options.target;
      if (!schema || !eligibilityMatches(schema, target)) { container.innerHTML = ''; return []; }
      const component = ensureComponent(target, schema.id);
      if (!component || (component.version || 1) > schema.version || (schema.preserveInvalidRecords && !(schema.inspectRecord || AiBrain.inspect)(component).ok)) {
        const issues = validateComponent(target, schema.id);
        container.innerHTML = issues.map((entry) => `<div class="authoring-issue authoring-issue-${entry.severity}">${escapeHtml(entry.message)}</div>`).join('');
        return issues;
      }
      container.classList.add('schema-component-section');
      container.dataset.componentId = schema.id;
      const reusableEditors = typeof globalThis !== 'undefined' ? globalThis.OpusInspectorFields : null;
      if (reusableEditors) {
        const fields = schema.fields.slice().sort((a, b) => a.order - b.order).map((field) => ({
          ...field,
          defaultValue: fieldDefault(schema, field),
        }));
        const section = reusableEditors.mountSection(container, {
          id: schema.id,
          label: schema.displayName,
          category: schema.category,
          icon: schema.icon,
          help: schema.help,
          fields,
          values: component,
          optionsFor: (field) => typeof options.optionsFor === 'function' ? options.optionsFor(field.type === 'collisionMaskRefs' ? 'collisionLayer' : field.referenceType, field) || [] : [],
          onBeforeChange: (field) => { if (options.onBeforeChange) options.onBeforeChange(schema, field.key); },
          onChange: (field, value) => {
            component[field.key] = normalizeFieldValue(schema, field, value);
            if (field.key === 'collisionMaskMode' && value === 'all') component.collisionMaskRefs = [];
            if (schema.applyTarget) schema.applyTarget(target, component);
            const issues = validateComponent(target, schema.id);
            if (options.onChange) options.onChange(schema, field, component, issues);
            return issues;
          },
          validate: () => validateComponent(target, schema.id),
        });
        return section.validate();
      }
      container.innerHTML = `<div class="field-row"><label>${escapeHtml(schema.displayName)}</label>${schema.help ? `<div class="schema-component-help">${escapeHtml(schema.help)}</div>` : ''}<div data-component-fields>${schema.fields.slice().sort((a, b) => a.order - b.order).map((field) => `<div class="schema-component-field" data-component-field-row="${escapeHtml(field.key)}"><label>${escapeHtml(field.label || field.key)}</label>${controlHtml(schema, field, component[field.key], options.optionsFor)}</div>`).join('')}</div><div data-component-issues></div></div>`;
      const before = new WeakSet();
      container.addEventListener('focusin', (event) => {
        if (!event.target.matches('[data-component-field]') || before.has(event.target)) return;
        before.add(event.target);
        if (options.onBeforeChange) options.onBeforeChange(schema, event.target.dataset.componentField);
      });
      const update = (event) => {
        const control = event.target.closest('[data-component-field]');
        if (!control) return;
        const field = schema.fields.find((entry) => entry.key === control.dataset.componentField);
        if (!field) return;
        let value;
        if (field.type === 'boolean') value = control.checked;
        else if (field.type === 'vec2' || field.type === 'vec3') {
          const axes = field.type === 'vec2' ? ['x', 'y'] : ['x', 'y', 'z'];
          value = axes.map((axis) => container.querySelector(`[data-component-field="${field.key}"][data-component-axis="${axis}"]`).value);
        } else value = control.value;
        component[field.key] = normalizeFieldValue(schema, field, value);
        if (schema.applyTarget) schema.applyTarget(target, component);
        const issues = validateComponent(target, schema.id);
        const issuesElement = container.querySelector('[data-component-issues]');
        issuesElement.innerHTML = issues.map((entry) => `<div class="authoring-issue authoring-issue-${entry.severity}">${escapeHtml(entry.message)}</div>`).join('');
        if (options.onChange) options.onChange(schema, field, component, issues);
      };
      container.addEventListener('input', update);
      container.addEventListener('change', update);
      const initialIssues = validateComponent(target, schema.id);
      container.querySelector('[data-component-issues]').innerHTML = initialIssues.map((entry) => `<div class="authoring-issue authoring-issue-${entry.severity}">${escapeHtml(entry.message)}</div>`).join('');
      return initialIssues;
    }

    return { registry, ensureComponent, applyRecord, serializeComponents, copyComponents, getComponentAddability, discoverComponents, addComponent, applyComponentSettings, orderedComponents, getComponentRemovability, removeComponent, moveComponent, validateComponent, validateTarget, renderComponentSection, normalizeFieldValue };
  }

  const registry = new AuthoringSchemaRegistry();
  function validateControllerAbility(component,target,id,speedField,speedValid,controllers) {
    const issues=[];
    if(component.version!==1)issues.push({field:'enabled',code:id+'-version',message:'A supported '+id+' version is required; saved future records are retained.'});
    if(typeof component.enabled!=='boolean')issues.push({field:'enabled',code:id+'-enabled',message:'Enabled must be true or false.'});
    if(typeof component.inputActionRef!=='string'||!component.inputActionRef.trim())issues.push({field:'inputActionRef',code:id+'-input-action',message:'Choose a named Input Action.'});
    if(!speedValid(component[speedField]))issues.push({field:speedField,code:id+'-speed',message:speedField==='jumpSpeed'?'Jump Speed must be finite and greater than zero.':'Speed Multiplier must be finite and at least one.'});
    const bag=target&&target.components||{};
    const compatible=controllers.some(controllerId=>{const record=bag[controllerId],schema=registry.get(controllerId);return isPlainObject(record)&&record.version===1&&record.enabled===true&&schema&&!(schema.validate(record,target)||[]).some(issue=>(issue.severity||'error')==='error');});
    if(!compatible)issues.push({field:'enabled',code:id+'-controller',message:id==='jump-ability'?'Needs a valid enabled Platformer Controller 2D on this Sprite. Top-down and legacy 3D Players do not consume this Jump Ability.':'Needs a valid enabled Platformer or Top-down Controller 2D on this Sprite. Attaching an ability does not select the level Player.'});
    return issues;
  }
  registry.register({
    id: 'sprite-renderer', displayName: 'Sprite Renderer', category: 'Rendering', version: 9, addable: false,
    help: 'Renders a flat, unlit image in world space. Sorting Layer, then Order in Layer, controls Sprite stacking; Transform Z remains spatial.',
    eligibility: ['sprite'], inspector: { group: 'Rendering', order: 50 },
    fields: [
      { key: 'spriteAssetRef', label: 'Sprite Asset', help: 'Preferred reusable Sprite definition. When valid, it supplies the source Texture.', type: 'assetRef', allowedAssetTypes: ['sprite'], nullable: true },
      { key: 'renderMode', label: 'Render Mode', help: 'Simple draws one quad. Nine-Slice uses the current Sprite Asset guides to preserve corners while Width and Height change.', type: 'enum', choices: ['simple', 'nine-slice'], choiceLabels: { simple: 'Simple', 'nine-slice': 'Nine-Slice' }, required: true },
      { key: 'flipX', label: 'Flip X', help: 'Mirror artwork horizontally inside the same Sprite geometry; Transform Scale and pivot are unchanged.', type: 'boolean' },
      { key: 'flipY', label: 'Flip Y', help: 'Mirror artwork vertically inside the same Sprite geometry; Transform Scale and pivot are unchanged.', type: 'boolean' },
      { key: 'initialAnimationStateRef', label: 'Initial Animation State', help: 'Stable local state ID entered when Play begins.', type: 'string', nullable: true },
      { key: 'initialDirection', label: 'Initial Direction', help: 'Explicit semantic direction used when Play begins. None preserves the State base Clip exactly.', type: 'enum', choices: ['none', 'up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'], choiceLabels: { none: 'None / Default', up: 'Up', down: 'Down', left: 'Left', right: 'Right', 'up-left': 'Up Left', 'up-right': 'Up Right', 'down-left': 'Down Left', 'down-right': 'Down Right' }, required: true },
      { key: 'playOnStart', label: 'Play On Start', help: 'Enter the valid Initial Animation State when Play begins. The referenced clip independently chooses Once or Loop.', type: 'boolean' },
      { key: 'sourceTexture', label: 'Legacy Texture (compatibility)', help: 'Phase 011 direct Texture source. Used only when no valid Sprite Asset is assigned.', type: 'assetRef', allowedAssetTypes: ['texture'], nullable: true },
      { key: 'width', label: 'Width', help: 'Sprite width in world units.', type: 'number', min: 0.01, step: 0.1, precision: 3, required: true },
      { key: 'height', label: 'Height', help: 'Sprite height in world units.', type: 'number', min: 0.01, step: 0.1, precision: 3, required: true },
      { key: 'pivotX', label: 'Pivot X', help: 'Horizontal origin from left (0) to right (1).', type: 'number', min: 0, max: 1, step: 0.05, precision: 3, required: true },
      { key: 'pivotY', label: 'Pivot Y', help: 'Vertical origin from bottom (0) to top (1).', type: 'number', min: 0, max: 1, step: 0.05, precision: 3, required: true },
      { key: 'tint', label: 'Tint', help: 'Color multiplied with the source texture.', type: 'color', required: true },
      { key: 'opacity', label: 'Opacity', help: 'Overall Sprite transparency from invisible (0) to fully visible (1). Source image alpha remains intact.', type: 'number', min: 0, max: 1, step: 0.05, precision: 3, required: true },
      { key: 'visible', label: 'Visible', help: 'Whether this Sprite is rendered.', type: 'boolean' },
      { key: 'sortingLayerRef', label: 'Sorting Layer', help: 'Project layer name shown here; the Sprite stores its stable layer ID.', type: 'sortingLayerRef', required: true, nullable: false },
      { key: 'orderInLayer', label: 'Order in Layer', help: 'Lower values draw earlier/behind; higher values draw later/in front.', type: 'integer', step: 1, required: true },
      { key: 'parallaxLayerRef', label: 'Parallax Layer', help: 'None / Normal World uses factor 1,1. Named project layers offset this Sprite from camera movement at render time only.', type: 'parallaxLayerRef', nullable: true },
    ],
    defaults: { spriteAssetRef: null, renderMode: 'simple', flipX: false, flipY: false, animationStates: [], initialAnimationStateRef: null, initialDirection: 'none', playOnStart: false, sourceTexture: null, width: 1, height: 1, pivotX: 0.5, pivotY: 0.5, tint: '#ffffff', opacity: 1, visible: true, sortingLayerRef: 'sprite-layer-default', orderInLayer: 0, parallaxLayerRef: null },
    ownedFields: ['spriteAssetRef', 'renderMode', 'flipX', 'flipY', 'initialAnimationStateRef', 'initialDirection', 'playOnStart', 'sourceTexture', 'width', 'height', 'pivotX', 'pivotY', 'tint', 'opacity', 'visible', 'sortingLayerRef', 'orderInLayer', 'parallaxLayerRef'],
    runtimeFields: ['layer'],
    serialization: { owner: 'sprite-renderer', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    migrate: (record, fromVersion) => {
      if (fromVersion <= 2) {
        const legacyLayer = Number(record.layer);
        record.sortingLayerRef = record.sortingLayerRef || 'sprite-layer-default';
        record.orderInLayer = Number.isFinite(legacyLayer) ? Math.round(legacyLayer) : (Number.isFinite(Number(record.orderInLayer)) ? Math.round(Number(record.orderInLayer)) : 0);
        delete record.layer;
      }
      if (fromVersion === 5) {
        const legacyClipRef = record.animationClipRef || null;
        record.animationStates = legacyClipRef ? [{ id: 'animation-state-default', name: 'Default', clipRef: legacyClipRef }] : [];
        record.initialAnimationStateRef = legacyClipRef ? 'animation-state-default' : null;
        delete record.animationClipRef;
      }
      if (fromVersion <= 6) {
        if (record.flipX === undefined) record.flipX = false;
        if (record.flipY === undefined) record.flipY = false;
        if (record.initialDirection === undefined) record.initialDirection = 'none';
      }
      if (fromVersion <= 7 && record.renderMode === undefined) record.renderMode = 'simple';
      if (fromVersion <= 8 && record.parallaxLayerRef === undefined) record.parallaxLayerRef = null;
      return record;
    },
    readTarget: (target) => isPlainObject(target.components) && isPlainObject(target.components['sprite-renderer']) ? target.components['sprite-renderer'] : null,
    applyTarget: (target, component) => {
      const width = Math.max(0.01, Number(component.width) || 1);
      const height = Math.max(0.01, Number(component.height) || 1);
      const pivotX = Math.max(0, Math.min(1, Number(component.pivotX)));
      const pivotY = Math.max(0, Math.min(1, Number(component.pivotY)));
      const sortingLayerRef = component.sortingLayerRef || 'sprite-layer-default';
      const orderInLayer = Math.round(Number(component.orderInLayer) || 0);
      const opacity = Math.max(0, Math.min(1, Number.isFinite(Number(component.opacity)) ? Number(component.opacity) : 1));
      const renderMode = component.renderMode === 'nine-slice' ? 'nine-slice' : 'simple';
      Object.assign(component, { width, height, pivotX, pivotY, opacity, sortingLayerRef, orderInLayer, renderMode, flipX: !!component.flipX, flipY: !!component.flipY });
      if (target.entity) {
        target.entity.spriteRenderer = { width, height, pivotX, pivotY, renderMode, flipX: !!component.flipX, flipY: !!component.flipY };
        target.entity.spriteSortingLayerRef = sortingLayerRef;
        target.entity.spriteOrderInLayer = orderInLayer;
        target.entity.visible = component.visible !== false;
        target.entity.alpha = opacity;
        target.entity.unlit = true;
        target.entity.castShadow = false;
      }
    },
    validate: (component) => {
      const issues = [];
      if (!(component.width > 0)) issues.push({ field: 'width', code: 'sprite-width-positive', message: 'Width must be greater than 0.' });
      if (!(component.height > 0)) issues.push({ field: 'height', code: 'sprite-height-positive', message: 'Height must be greater than 0.' });
      if (!['simple', 'nine-slice'].includes(component.renderMode)) issues.push({ field: 'renderMode', code: 'sprite-render-mode', message: 'Render Mode must be Simple or Nine-Slice.' });
      if (component.pivotX < 0 || component.pivotX > 1) issues.push({ field: 'pivotX', code: 'sprite-pivot-x-range', message: 'Pivot X must be between 0 and 1.' });
      if (component.pivotY < 0 || component.pivotY > 1) issues.push({ field: 'pivotY', code: 'sprite-pivot-y-range', message: 'Pivot Y must be between 0 and 1.' });
      if (!component.sortingLayerRef) issues.push({ field: 'sortingLayerRef', code: 'sprite-sorting-layer-required', message: 'Sorting Layer is required.' });
      if (!Number.isInteger(component.orderInLayer)) issues.push({ field: 'orderInLayer', code: 'sprite-order-in-layer-integer', message: 'Order in Layer must be an integer.' });
      const states = Array.isArray(component.animationStates) ? component.animationStates : [];
      const ids = new Set(); const names = new Set();
      for (const state of states) {
        const id = String(state && state.id || ''); const name = String(state && state.name || '').trim(); const folded = name.toLowerCase();
        if (!id) issues.push({ field: 'animationStates', code: 'sprite-animation-state-id-required', message: 'Animation States require a stable local ID.' });
        else if (ids.has(id)) issues.push({ field: 'animationStates', code: 'duplicate-sprite-animation-state-id', message: `Duplicate Animation State ID "${id}".` });
        if (!name) issues.push({ field: 'animationStates', code: 'sprite-animation-state-name-required', message: 'Animation States require a display name.' });
        else if (names.has(folded)) issues.push({ field: 'animationStates', code: 'duplicate-sprite-animation-state-name', message: `Duplicate Animation State name "${name}".` });
        ids.add(id); names.add(folded);
        const directions = new Set();
        for (const variant of Array.isArray(state && state.directionalVariants) ? state.directionalVariants : []) {
          const direction = String(variant && variant.direction || '');
          if (!['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'].includes(direction)) issues.push({ field: 'animationStates', code: 'sprite-animation-direction-invalid', message: `Animation State "${name || id || '?'}" has unsupported direction "${direction || '?'}".` });
          else if (directions.has(direction)) issues.push({ field: 'animationStates', code: 'duplicate-sprite-animation-direction', message: `Animation State "${name || id || '?'}" has more than one ${direction} variant.` });
          directions.add(direction);
        }
      }
      if (component.initialAnimationStateRef && !states.some((state) => state && state.id === component.initialAnimationStateRef)) issues.push({ field: 'initialAnimationStateRef', code: 'invalid-initial-sprite-animation-state', message: `Initial Animation State points to missing local ID "${component.initialAnimationStateRef}".` });
      if (component.playOnStart && !component.initialAnimationStateRef) issues.push({ field: 'initialAnimationStateRef', code: 'autoplay-requires-initial-sprite-animation-state', message: 'Play On Start requires a valid Initial Animation State.' });
      return issues;
    },
  });
  registry.register({
    id: 'box-collider-2d', displayName: 'Box Collider 2D', category: 'Physics / 2D', version: 1, addable: true,
    help: 'Defines a passive local 2D rectangle. It does not block, move, or trigger objects; later Body/physics components add physical behavior.',
    eligibility: ['scene-object', 'sprite'], isEligible: (target) => !!target && (target.kind === 'cube' || target.kind === 'sprite'), inspector: { group: 'Physics / 2D', order: 310 },
    fields: [
      { key: 'enabled', label: 'Enabled', help: 'Disabled shapes remain authored and inspectable but are ignored by overlap queries.', type: 'boolean' },
      { key: 'offset', label: 'Offset', help: 'Shape center in object-local X/Y coordinates.', type: 'vec2', step: 0.05, required: true },
      { key: 'size', label: 'Size', help: 'Positive local Width and Height.', type: 'vec2', step: 0.05, required: true },
    ],
    defaults: { enabled: true, offset: [0, 0], size: [1, 1] }, ownedFields: ['enabled', 'offset', 'size'],
    serialization: { owner: 'box-collider-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    initialize: (component, target) => {
      const sprite = target && target.components && target.components['sprite-renderer'];
      if (!sprite || !(sprite.width > 0) || !(sprite.height > 0)) return;
      component.offset = [(0.5 - (Number.isFinite(sprite.pivotX) ? sprite.pivotX : 0.5)) * sprite.width, (0.5 - (Number.isFinite(sprite.pivotY) ? sprite.pivotY : 0.5)) * sprite.height];
      component.size = [sprite.width, sprite.height];
    },
    validate: (component, target) => {
      const issues = [];
      if (typeof component.enabled !== 'boolean') issues.push({ field: 'enabled', code: 'box-collider-2d-enabled', message: 'Enabled must be true or false.' });
      if (!Array.isArray(component.offset) || component.offset.length < 2 || component.offset.slice(0, 2).some((value) => !Number.isFinite(value))) issues.push({ field: 'offset', code: 'box-collider-2d-offset', message: 'Offset requires two finite numbers.' });
      if (!Array.isArray(component.size) || component.size.length < 2 || component.size.slice(0, 2).some((value) => !Number.isFinite(value) || value <= 0)) issues.push({ field: 'size', code: 'box-collider-2d-size', message: 'Width and Height must be finite and greater than 0.' });
      const scale = target && target.entity && target.entity.scale;
      if (scale && (![scale.x, scale.y].every(Number.isFinite) || Math.abs(scale.x) <= 1e-8 || Math.abs(scale.y) <= 1e-8)) issues.push({ field: 'size', severity: 'warning', code: 'collider-2d-degenerate-transform', message: 'World XY scale is degenerate; this Collider is ignored until the Transform has non-zero finite XY scale.' });
      return issues;
    },
  });
  registry.register({
    id: 'circle-collider-2d', displayName: 'Circle Collider 2D', category: 'Physics / 2D', version: 1, addable: true,
    help: 'Defines a passive local 2D circle. World radius uses the larger XY scale; it does not block, move, or trigger objects.',
    eligibility: ['scene-object', 'sprite'], isEligible: (target) => !!target && (target.kind === 'cube' || target.kind === 'sprite'), inspector: { group: 'Physics / 2D', order: 320 },
    fields: [
      { key: 'enabled', label: 'Enabled', help: 'Disabled shapes remain authored and inspectable but are ignored by overlap queries.', type: 'boolean' },
      { key: 'offset', label: 'Offset', help: 'Circle center in object-local X/Y coordinates.', type: 'vec2', step: 0.05, required: true },
      { key: 'radius', label: 'Radius', help: 'Positive local radius. World radius uses the larger transformed XY basis length.', type: 'number', min: 0.001, step: 0.05, precision: 3, required: true },
    ],
    defaults: { enabled: true, offset: [0, 0], radius: 0.5 }, ownedFields: ['enabled', 'offset', 'radius'],
    serialization: { owner: 'circle-collider-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    initialize: (component, target) => {
      const sprite = target && target.components && target.components['sprite-renderer'];
      if (!sprite || !(sprite.width > 0) || !(sprite.height > 0)) return;
      component.offset = [(0.5 - (Number.isFinite(sprite.pivotX) ? sprite.pivotX : 0.5)) * sprite.width, (0.5 - (Number.isFinite(sprite.pivotY) ? sprite.pivotY : 0.5)) * sprite.height];
      component.radius = Math.min(sprite.width, sprite.height) / 2;
    },
    validate: (component, target) => {
      const issues = [];
      if (typeof component.enabled !== 'boolean') issues.push({ field: 'enabled', code: 'circle-collider-2d-enabled', message: 'Enabled must be true or false.' });
      if (!Array.isArray(component.offset) || component.offset.length < 2 || component.offset.slice(0, 2).some((value) => !Number.isFinite(value))) issues.push({ field: 'offset', code: 'circle-collider-2d-offset', message: 'Offset requires two finite numbers.' });
      if (!Number.isFinite(component.radius) || component.radius <= 0) issues.push({ field: 'radius', code: 'circle-collider-2d-radius', message: 'Radius must be finite and greater than 0.' });
      const scale = target && target.entity && target.entity.scale;
      if (scale && (![scale.x, scale.y].every(Number.isFinite) || Math.abs(scale.x) <= 1e-8 || Math.abs(scale.y) <= 1e-8)) issues.push({ field: 'radius', severity: 'warning', code: 'collider-2d-degenerate-transform', message: 'World XY scale is degenerate; this Collider is ignored until the Transform has non-zero finite XY scale.' });
      else if (scale && Math.abs(Math.abs(scale.x) - Math.abs(scale.y)) > 1e-6 * Math.max(1, Math.abs(scale.x), Math.abs(scale.y))) issues.push({ field: 'radius', severity: 'warning', code: 'circle-collider-2d-nonuniform-scale', message: 'Circle Collider 2D remains circular in world space and uses the larger XY scale. Use Box Collider 2D for a stretched shape.' });
      return issues;
    },
  });
  registry.register({
    id: 'trigger-collider-2d', displayName: 'Trigger Collider 2D', category: 'Physics / 2D', version: 1, addable: true,
    help: 'Detects Box/Circle Collider 2D overlaps and emits Enter, Stay, and Exit. It never blocks movement.',
    eligibility: ['scene-object', 'sprite'], isEligible: (target) => !!target && (target.kind === 'cube' || target.kind === 'sprite'), inspector: { group: 'Physics / 2D', order: 330 },
    fields: [
      { key: 'enabled', label: 'Enabled', help: 'Disabled triggers remain authored but close active pairs and detect nothing.', type: 'boolean' },
      { key: 'shape', label: 'Shape', help: 'Independent trigger geometry; ordinary Collider 2D components remain trigger-free.', type: 'enum', choices: ['box', 'circle'], choiceLabels: { box: 'Box', circle: 'Circle' }, required: true },
      { key: 'offset', label: 'Offset', help: 'Trigger center in object-local X/Y coordinates.', type: 'vec2', step: 0.05, required: true },
      { key: 'size', label: 'Box Size', help: 'Positive local Width and Height, retained when Circle is active.', type: 'vec2', step: 0.05, required: true },
      { key: 'radius', label: 'Circle Radius', help: 'Positive local radius, retained when Box is active. World radius uses the larger transformed XY basis.', type: 'number', step: 0.05, precision: 3, required: true },
    ],
    defaults: { enabled: true, shape: 'box', offset: [0, 0], size: [1, 1], radius: 0.5 }, ownedFields: ['enabled', 'shape', 'offset', 'size', 'radius'],
    serialization: { owner: 'trigger-collider-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    initialize: (component, target) => {
      const sprite = target && target.components && target.components['sprite-renderer'];
      if (!sprite || !(sprite.width > 0) || !(sprite.height > 0)) return;
      component.offset = [(0.5 - (Number.isFinite(sprite.pivotX) ? sprite.pivotX : 0.5)) * sprite.width, (0.5 - (Number.isFinite(sprite.pivotY) ? sprite.pivotY : 0.5)) * sprite.height];
      component.size = [sprite.width, sprite.height]; component.radius = Math.min(sprite.width, sprite.height) / 2;
    },
    validate: (component, target) => {
      const issues = [];
      if (typeof component.enabled !== 'boolean') issues.push({ field: 'enabled', code: 'trigger-collider-2d-enabled', message: 'Enabled must be true or false.' });
      if (!['box', 'circle'].includes(component.shape)) issues.push({ field: 'shape', code: 'trigger-collider-2d-shape', message: 'Shape must be Box or Circle.' });
      if (!Array.isArray(component.offset) || component.offset.length < 2 || component.offset.slice(0, 2).some((value) => !Number.isFinite(value))) issues.push({ field: 'offset', code: 'trigger-collider-2d-offset', message: 'Offset requires two finite numbers.' });
      if (component.shape === 'box' && (!Array.isArray(component.size) || component.size.length < 2 || component.size.slice(0, 2).some((value) => !Number.isFinite(value) || value <= 0))) issues.push({ field: 'size', code: 'trigger-collider-2d-size', message: 'Box Width and Height must be finite and greater than 0.' });
      if (component.shape === 'circle' && (!Number.isFinite(component.radius) || component.radius <= 0)) issues.push({ field: 'radius', code: 'trigger-collider-2d-radius', message: 'Circle Radius must be finite and greater than 0.' });
      const scale = target && target.entity && target.entity.scale;
      if (scale && (![scale.x, scale.y].every(Number.isFinite) || Math.abs(scale.x) <= 1e-8 || Math.abs(scale.y) <= 1e-8)) issues.push({ field: component.shape === 'circle' ? 'radius' : 'size', severity: 'warning', code: 'trigger-collider-2d-degenerate-transform', message: 'World XY scale is degenerate; this Trigger is ignored until the Transform has non-zero finite XY scale.' });
      else if (component.shape === 'circle' && scale && Math.abs(Math.abs(scale.x) - Math.abs(scale.y)) > 1e-6 * Math.max(1, Math.abs(scale.x), Math.abs(scale.y))) issues.push({ field: 'radius', severity: 'warning', code: 'trigger-collider-2d-nonuniform-scale', message: 'Circle Trigger remains circular in world space and uses the larger XY scale. Use Box shape for a stretched region.' });
      return issues;
    },
  });
  registry.register({
    id: 'body-2d', displayName: 'Body 2D', category: 'Physics / 2D', version: 1, addable: true,
    help: 'Gives ordinary Collider 2D shapes a Static or Kinematic physical role. Kinematic velocity is world XY units per second.',
    eligibility: ['scene-object', 'sprite'], isEligible: (target) => !!target && (target.kind === 'cube' || target.kind === 'sprite'), inspector: { group: 'Physics / 2D', order: 340 },
    fields: [
      { key: 'enabled', label: 'Enabled', help: 'A disabled Body remains authored but does not move or obstruct. Its Colliders still participate in Trigger detection.', type: 'boolean' },
      { key: 'type', label: 'Type', help: 'Static is an obstacle; Kinematic moves from world-space velocity and stops/slides against Static Bodies.', type: 'enum', choices: ['static', 'kinematic'], choiceLabels: { static: 'Static', kinematic: 'Kinematic' }, required: true },
      { key: 'linearVelocity', label: 'Linear Velocity', help: 'World X/Y units per second. Retained but ignored when Type is Static.', type: 'vec2', step: 0.1, required: true },
    ],
    defaults: { enabled: true, type: 'static', linearVelocity: [0, 0] }, ownedFields: ['enabled', 'type', 'linearVelocity'],
    serialization: { owner: 'body-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    validate: (component, target) => {
      const issues = [];
      if (typeof component.enabled !== 'boolean') issues.push({ field: 'enabled', code: 'body-2d-enabled', message: 'Enabled must be true or false.' });
      if (!['static', 'kinematic'].includes(component.type)) issues.push({ field: 'type', code: 'body-2d-type', message: 'Body Type must be Static or Kinematic.' });
      if (!Array.isArray(component.linearVelocity) || component.linearVelocity.length !== 2 || component.linearVelocity.some((value) => !Number.isFinite(value))) issues.push({ field: 'linearVelocity', code: 'body-2d-velocity', message: 'Velocity X and Y must be finite numbers.' });
      const bag = target && target.components || {};
      if (!bag['box-collider-2d']?.enabled && !bag['circle-collider-2d']?.enabled) issues.push({ field: 'type', severity: 'warning', code: 'body-2d-no-collider', message: 'Body 2D has no enabled Box/Circle Collider 2D, so it has no physical collision shape.' });
      const scale = target && target.entity && target.entity.scale;
      if (scale && (![scale.x, scale.y, scale.z].every(Number.isFinite) || [scale.x, scale.y, scale.z].some((value) => Math.abs(value) <= 1e-8))) issues.push({ field: 'type', severity: 'warning', code: 'body-2d-singular-transform', message: 'World Transform is singular; Body 2D cannot resolve physical motion until it is repaired.' });
      return issues;
    },
  });
  registry.register({
    id: 'platformer-controller-2d', displayName: 'Platformer Controller 2D', category: 'Gameplay / 2D', version: 1, addable: true,
    eligibility: ['sprite'], inspector: { group: 'Gameplay / 2D', order: 355 }, preserveAuthoredValues: true,
    help: 'Run and grounded Jump in world XY using named Input Actions. Choose this Sprite as the level’s Platformer Player; attaching or duplicating this component alone does not take Player control. Needs Kinematic Body 2D, ordinary Collider 2D, Character Collision 2D, Static ground and an existing 2D Camera. Input bindings and Cameras are not replaced.',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', help: 'Allow platformer movement only when this Sprite is explicitly selected as the level’s Platformer Player; disabled control remains authored and inert.' },
      ...[['moveSpeed', 'Run Speed', 'World X units per second.'], ['gravity', 'Gravity', 'World negative Y acceleration in units per second squared.'], ['jumpSpeed', 'Jump Speed', 'Fallback upward speed only when Jump Ability is absent. An attached Jump Ability owns Jump speed; disabling it suppresses Jump without disabling gravity.']].map(([key, label, help]) => ({ key, label, help, type: 'number', step: 0.1, required: true, validate: value => Number.isFinite(value) && value > 0 ? [] : [{ code: 'platformer-positive-number', message: label + ' must be finite and greater than zero.' }] })),
      ...[['moveLeftActionRef', 'Move Left Action'], ['moveRightActionRef', 'Move Right Action'], ['jumpActionRef', 'Jump Action']].map(([key, label]) => ({ key, label, type: 'inputActionRef', required: true, nullable: false, help: key==='jumpActionRef'?'Fallback named Jump Action only when Jump Ability is absent. An attached Jump Ability owns its Action; disabled or invalid ability does not restore this fallback.':'Choose a named canonical Input Action. Missing or unavailable Actions fail closed; mappings and active input contexts are respected.' })),
    ],
    defaults: { version: 1, enabled: true, moveSpeed: 5, gravity: 20, jumpSpeed: 8, moveLeftActionRef: 'moveLeft', moveRightActionRef: 'moveRight', jumpActionRef: 'jump' },
    ownedFields: ['enabled', 'moveSpeed', 'gravity', 'jumpSpeed', 'moveLeftActionRef', 'moveRightActionRef', 'jumpActionRef'],
    serialization: { owner: 'platformer-controller-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    validate: (component, target) => {
      const issues = [];
      if (component.version !== 1) issues.push({ field: 'enabled', code: 'platformer-version', message: 'A supported Platformer Controller version is required.' });
      if (typeof component.enabled !== 'boolean') issues.push({ field: 'enabled', code: 'platformer-enabled', message: 'Enabled must be true or false.' });
      for (const key of ['moveSpeed', 'gravity', 'jumpSpeed']) if (!Number.isFinite(component[key]) || component[key] <= 0) issues.push({ field: key, code: 'platformer-positive-number', message: key + ' must be finite and greater than zero.' });
      for (const key of ['moveLeftActionRef', 'moveRightActionRef', 'jumpActionRef']) if (typeof component[key] !== 'string' || !component[key].trim()) issues.push({ field: key, code: 'platformer-input-action', message: 'Choose a named Input Action.' });
      const bag = target && target.components || {};
      const compatible = id => { const record = bag[id], schema = registry.get(id); return !!record && record.enabled === true && Number.isInteger(record.version) && record.version >= 1 && record.version <= schema.version && !(schema.validate(record, target) || []).some(entry => (entry.severity || 'error') === 'error'); };
      if (!compatible('body-2d') || bag['body-2d'].type !== 'kinematic') issues.push({ field: 'enabled', code: 'platformer-needs-kinematic', message: 'Needs a valid enabled Kinematic Body 2D.' });
      if (!compatible('box-collider-2d') && !compatible('circle-collider-2d')) issues.push({ field: 'enabled', code: 'platformer-needs-collider', message: 'Needs a valid enabled ordinary Box or Circle Collider 2D; Trigger alone does not count.' });
      if (!compatible('character-collision-2d')) issues.push({ field: 'enabled', code: 'platformer-needs-character', message: 'Needs valid enabled Character Collision 2D.' });
      return issues;
    },
  });
  registry.register({
    id: 'topdown-controller-2d', displayName: 'Top-down Controller 2D', category: 'Gameplay / 2D', version: 1, addable: true,
    eligibility: ['sprite'], inspector: { group: 'Gameplay / 2D', order: 356 }, preserveAuthoredValues: true,
    help: 'Move an explicitly selected Player Sprite in world XY using four named Input Actions and normalized diagonal speed. No gravity or Jump. Needs Kinematic Body, ordinary Collider, and Character Collision with Wall Slide, Slope Following and Step Handling explicitly off. Existing Cameras, input bindings and legacy XZ Top-down are not replaced.',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', help: 'Only the Sprite explicitly selected as this level’s 2D Top-down Player receives control. A duplicate or Prefab does not steal ownership.' },
      { key: 'moveSpeed', label: 'Move Speed', type: 'number', step: 0.1, required: true, help: 'World XY units per second; diagonal movement is normalized to the same speed.', validate: value => Number.isFinite(value) && value > 0 ? [] : [{ code: 'topdown-2d-speed', message: 'Move Speed must be finite and greater than zero.' }] },
      ...[['moveLeftActionRef', 'Move Left Action'], ['moveRightActionRef', 'Move Right Action'], ['moveUpActionRef', 'Move Up Action'], ['moveDownActionRef', 'Move Down Action']].map(([key, label]) => ({ key, label, type: 'inputActionRef', required: true, nullable: false, help: 'Choose a canonical named Input Action. Missing references fail closed; input bindings, device mappings and active contexts remain authoritative.' })),
    ],
    defaults: { version: 1, enabled: true, moveSpeed: 5, moveLeftActionRef: 'moveLeft', moveRightActionRef: 'moveRight', moveUpActionRef: 'moveForward', moveDownActionRef: 'moveBack' },
    ownedFields: ['enabled', 'moveSpeed', 'moveLeftActionRef', 'moveRightActionRef', 'moveUpActionRef', 'moveDownActionRef'],
    serialization: { owner: 'topdown-controller-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    validate: (component, target) => {
      const issues=[];
      if(component.version!==1)issues.push({field:'enabled',code:'topdown-2d-version',message:'A supported Top-down Controller 2D version is required.'});
      if(typeof component.enabled!=='boolean')issues.push({field:'enabled',code:'topdown-2d-enabled',message:'Enabled must be true or false.'});
      if(!Number.isFinite(component.moveSpeed)||component.moveSpeed<=0)issues.push({field:'moveSpeed',code:'topdown-2d-speed',message:'Move Speed must be finite and greater than zero.'});
      for(const key of ['moveLeftActionRef','moveRightActionRef','moveUpActionRef','moveDownActionRef'])if(typeof component[key]!=='string'||!component[key].trim())issues.push({field:key,code:'topdown-2d-input-action',message:'Choose a named Input Action.'});
      const bag=target&&target.components||{};
      const compatible=id=>{const record=bag[id],schema=registry.get(id);return !!record&&record.enabled===true&&Number.isInteger(record.version)&&record.version>=1&&record.version<=schema.version&&!(schema.validate(record,target)||[]).some(entry=>(entry.severity||'error')==='error');};
      if(!compatible('body-2d')||bag['body-2d'].type!=='kinematic')issues.push({field:'enabled',code:'topdown-2d-needs-kinematic',message:'Needs a valid enabled Kinematic Body 2D.'});
      if(!compatible('box-collider-2d')&&!compatible('circle-collider-2d'))issues.push({field:'enabled',code:'topdown-2d-needs-collider',message:'Needs a valid enabled ordinary Box or Circle Collider 2D; Trigger alone does not count.'});
      if(!compatible('character-collision-2d'))issues.push({field:'enabled',code:'topdown-2d-needs-character',message:'Needs valid enabled Character Collision 2D.'});
      const character=bag['character-collision-2d'];
      if(character&&['wallSlideEnabled','slopeHandlingEnabled','stepHandlingEnabled'].some(key=>character[key]!==false))issues.push({field:'enabled',code:'topdown-2d-character-policy',message:'For world XY Top-down, explicitly turn off Character Wall Slide, Slope Following and Step Handling. Existing platformer settings were not changed.'});
      return issues;
    },
  });
  registry.register({
    id: 'jump-ability', displayName: 'Jump Ability', category: 'Gameplay / 2D', version: 1, addable: true,
    eligibility: ['sprite'], inspector: { group: 'Gameplay / 2D', order: 357 }, preserveAuthoredValues: true,
    help: 'Adds grounded Jump to the explicitly owned Platformer Player Sprite using a named Input Action. Disabled or invalid Jump Ability suppresses Jump but keeps gravity and movement. Removing it restores historical Platformer Jump settings. Does not bind this Sprite as Player or replace legacy 3D controls.',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', help: 'Allow accepted grounded launches. Disabling Jump does not disable gravity, movement or collision.' },
      { key: 'inputActionRef', label: 'Jump Action', type: 'inputActionRef', required: true, nullable: false, help: 'Choose a canonical named Input Action; existing mappings and active contexts remain authoritative.' },
      { key: 'jumpSpeed', label: 'Jump Speed', type: 'number', required: true, step: 0.1, help: 'Initial world +Y speed in units per second; replaces the Platformer fallback while this ability is attached.', validate: value => Number.isFinite(value)&&value>0?[]:[{code:'jump-ability-speed',message:'Jump Speed must be finite and greater than zero.'}] },
    ],
    defaults: { version: 1, enabled: true, inputActionRef: 'jump', jumpSpeed: 8 },
    ownedFields: ['enabled','inputActionRef','jumpSpeed'], serialization: { owner:'jump-ability',duplicate:'deep-copy',prefab:'shared-record-path' },
    validate: (component,target) => validateControllerAbility(component,target,'jump-ability','jumpSpeed',value=>Number.isFinite(value)&&value>0,['platformer-controller-2d']),
  });
  registry.register({
    id: 'sprint-ability', displayName: 'Sprint Ability', category: 'Gameplay / 2D', version: 1, addable: true,
    eligibility: ['sprite'], inspector: { group: 'Gameplay / 2D', order: 358 }, preserveAuthoredValues: true,
    help: 'Hold a named Input Action to multiply the owned Platformer or Top-down 2D Player’s planar speed before normal collision. Disabled, invalid or absent Sprint keeps base speed. No gravity change, second movement solver or automatic Player binding; legacy 3D controls remain unchanged.',
    fields: [
      { key:'enabled',label:'Enabled',type:'boolean',help:'Enable held Sprint for the explicitly selected 2D Player; duplicates and Prefabs do not take ownership.' },
      { key:'inputActionRef',label:'Sprint Action',type:'inputActionRef',required:true,nullable:false,help:'Choose a canonical named Input Action; existing mappings and active contexts remain authoritative.' },
      { key:'speedMultiplier',label:'Speed Multiplier',type:'number',required:true,step:0.1,help:'Multiply planar base speed while Sprint is held. One means unchanged speed; must be finite and at least one.',validate:value=>Number.isFinite(value)&&value>=1?[]:[{code:'sprint-ability-speed',message:'Speed Multiplier must be finite and at least one.'}] },
    ],
    defaults:{version:1,enabled:true,inputActionRef:'sprint',speedMultiplier:1.6},
    ownedFields:['enabled','inputActionRef','speedMultiplier'],serialization:{owner:'sprint-ability',duplicate:'deep-copy',prefab:'shared-record-path'},
    validate:(component,target)=>validateControllerAbility(component,target,'sprint-ability','speedMultiplier',value=>Number.isFinite(value)&&value>=1,['platformer-controller-2d','topdown-controller-2d']),
  });
  registry.register({
    id: 'character-collision-2d', displayName: 'Character Collision 2D', category: 'Physics / 2D', version: 2, addable: true,
    help: 'Extends a Kinematic Body with Tilemap collision, one-way support, optional slopes and bounded steps, and ground/wall contact. Does not provide input, jumping, or gravity.',
    eligibility: ['scene-object', 'sprite'], isEligible: (target) => !!target && (target.kind === 'cube' || target.kind === 'sprite'), inspector: { group: 'Physics / 2D', order: 350 },
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', help: 'Enable Character collision behavior for an eligible Kinematic Body.' },
      { key: 'wallSlideEnabled', label: 'Wall Slide Enabled', type: 'boolean', help: 'Limit downward motion while touching a wall and not grounded.' },
      { key: 'wallSlideMaxSpeed', label: 'Wall Slide Max Speed', type: 'number', min: 0.001, step: 0.1, required: true, help: 'Maximum world-down speed, in units per second, while wall sliding.' },
      { key: 'slopeHandlingEnabled', label: 'Slope Handling Enabled', type: 'boolean', help: 'Follow walkable Static Box and Tile slope tops using world +Y as up. Migrated v1 Characters keep this off until enabled.' },
      { key: 'maxSlopeAngle', label: 'Max Slope Angle', type: 'number', min: 0.001, max: 60, step: 1, required: true, help: 'Largest ground angle in degrees this Character may climb; steeper surfaces remain solid walls.' },
      { key: 'stepHandlingEnabled', label: 'Step Handling Enabled', type: 'boolean', help: 'Step over small grounded ledges and follow bounded step-downs. Migrated v1 Characters keep this off until enabled.' },
      { key: 'maxStepHeight', label: 'Max Step Height', type: 'number', min: 0.001, max: 10, step: 0.05, required: true, help: 'Maximum step up/down height in world units; a ceiling can still prevent a step.' },
    ],
    defaults: { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: 0.5 }, ownedFields: ['enabled', 'wallSlideEnabled', 'wallSlideMaxSpeed', 'slopeHandlingEnabled', 'maxSlopeAngle', 'stepHandlingEnabled', 'maxStepHeight'],
    serialization: { owner: 'character-collision-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    migrate: (record, fromVersion) => fromVersion === 1 ? { ...record, slopeHandlingEnabled: false, maxSlopeAngle: 50, stepHandlingEnabled: false, maxStepHeight: 0.5 } : record,
    validate: (component, target) => {
      const issues = [];
      if (typeof component.enabled !== 'boolean') issues.push({ field: 'enabled', code: 'character-collision-2d-enabled', message: 'Enabled must be true or false.' });
      if (typeof component.wallSlideEnabled !== 'boolean') issues.push({ field: 'wallSlideEnabled', code: 'character-collision-2d-wall-slide-enabled', message: 'Wall Slide Enabled must be true or false.' });
      if (!Number.isFinite(component.wallSlideMaxSpeed) || component.wallSlideMaxSpeed <= 0) issues.push({ field: 'wallSlideMaxSpeed', code: 'character-collision-2d-max-speed', message: 'Wall Slide Max Speed must be finite and greater than zero.' });
      if ((component.version || 1) >= 2) {
        if (typeof component.slopeHandlingEnabled !== 'boolean') issues.push({ field: 'slopeHandlingEnabled', code: 'character-collision-2d-slope-enabled', message: 'Slope Handling Enabled must be true or false.' });
        if (!Number.isFinite(component.maxSlopeAngle) || component.maxSlopeAngle <= 0 || component.maxSlopeAngle > 60) issues.push({ field: 'maxSlopeAngle', code: 'character-collision-2d-max-slope-angle', message: 'Max Slope Angle must be greater than 0 and at most 60 degrees.' });
        if (typeof component.stepHandlingEnabled !== 'boolean') issues.push({ field: 'stepHandlingEnabled', code: 'character-collision-2d-step-enabled', message: 'Step Handling Enabled must be true or false.' });
        if (!Number.isFinite(component.maxStepHeight) || component.maxStepHeight <= 0 || component.maxStepHeight > 10) issues.push({ field: 'maxStepHeight', code: 'character-collision-2d-max-step-height', message: 'Max Step Height must be greater than 0 and at most 10 world units.' });
      }
      const bag = target && target.components || {};
      if (!bag['body-2d']?.enabled || bag['body-2d']?.type !== 'kinematic') issues.push({ field: 'enabled', severity: 'warning', code: 'character-collision-2d-needs-kinematic', message: 'Character Collision 2D needs an enabled Kinematic Body 2D.' });
      if (!bag['box-collider-2d']?.enabled && !bag['circle-collider-2d']?.enabled) issues.push({ field: 'enabled', severity: 'warning', code: 'character-collision-2d-needs-collider', message: 'Character Collision 2D needs an enabled Box or Circle Collider 2D; a Trigger does not count.' });
      return issues;
    },
  });
  registry.register({
    id: 'moving-platform-2d', displayName: 'Moving Platform 2D', category: 'Physics / 2D', version: 1, addable: true,
    help: 'Opts a Kinematic Box into Character support and translation carry. Grounded Characters inherit actual platform motion; ordinary Kinematic Bodies still ignore it.',
    eligibility: ['scene-object', 'sprite'], isEligible: (target) => !!target && (target.kind === 'cube' || target.kind === 'sprite'), inspector: { group: 'Physics / 2D', order: 355 },
    fields: [{ key: 'enabled', label: 'Enabled', type: 'boolean', help: 'Enable moving support/carry when this Object also has an enabled Kinematic Body 2D and enabled Box Collider 2D.' }],
    defaults: { enabled: true }, ownedFields: ['enabled'],
    serialization: { owner: 'moving-platform-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    validate: (component, target) => {
      const issues = [];
      if (typeof component.enabled !== 'boolean') issues.push({ field: 'enabled', code: 'moving-platform-2d-enabled', message: 'Enabled must be true or false.' });
      const bag = target && target.components || {}, body = bag['body-2d'], box = bag['box-collider-2d'];
      if (!body) issues.push({ field: 'enabled', severity: 'warning', code: 'moving-platform-2d-needs-body', message: 'Moving Platform 2D needs Body 2D.' });
      else if (!body.enabled) issues.push({ field: 'enabled', severity: 'warning', code: 'moving-platform-2d-body-disabled', message: 'Moving Platform 2D needs Body 2D enabled.' });
      else if (body.type !== 'kinematic') issues.push({ field: 'enabled', severity: 'warning', code: 'moving-platform-2d-needs-kinematic', message: 'Moving Platform 2D needs Body 2D Type set to Kinematic.' });
      if (!box) issues.push({ field: 'enabled', severity: 'warning', code: 'moving-platform-2d-needs-box', message: 'Moving Platform 2D needs Box Collider 2D; Circle alone is unsupported.' });
      else if (!box.enabled) issues.push({ field: 'enabled', severity: 'warning', code: 'moving-platform-2d-box-disabled', message: 'Moving Platform 2D needs Box Collider 2D enabled.' });
      return issues;
    },
  });
  registry.register({
    id: 'one-way-platform-2d', displayName: 'One-Way Platform 2D', category: 'Physics / 2D', version: 1, addable: true,
    help: 'Character Collision 2D passes upward and through the sides, then lands on the Box top. Supports Static Bodies and eligible Moving Platform 2D Kinematic Bodies.',
    eligibility: ['scene-object', 'sprite'], isEligible: (target) => !!target && (target.kind === 'cube' || target.kind === 'sprite'), inspector: { group: 'Physics / 2D', order: 360 },
    fields: [{ key: 'enabled', label: 'Enabled', type: 'boolean', help: 'Disable one-way Character semantics without changing the Static Body or Box Collider.' }],
    defaults: { enabled: true }, ownedFields: ['enabled'],
    serialization: { owner: 'one-way-platform-2d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    validate: (component, target) => {
      const issues = [];
      if (typeof component.enabled !== 'boolean') issues.push({ field: 'enabled', code: 'one-way-platform-2d-enabled', message: 'Enabled must be true or false.' });
      const bag = target && target.components || {};
      const moving = bag['moving-platform-2d']?.enabled && bag['body-2d']?.enabled && bag['body-2d']?.type === 'kinematic' && bag['box-collider-2d']?.enabled;
      if (!moving && (!bag['body-2d']?.enabled || bag['body-2d']?.type !== 'static')) issues.push({ field: 'enabled', severity: 'warning', code: 'one-way-platform-2d-needs-static', message: 'One-Way Platform 2D needs an enabled Static Body 2D or an eligible Moving Platform 2D.' });
      if (!bag['box-collider-2d']?.enabled) issues.push({ field: 'enabled', severity: 'warning', code: 'one-way-platform-2d-needs-box', message: 'One-Way Platform 2D needs an enabled Box Collider 2D; Circle alone is unsupported.' });
      const matrix = target && target.worldMatrix;
      const m = matrix && (matrix.m || matrix);
      if (!moving && m && m.length >= 16 && Math.abs(m[1]) > 0.01 * Math.hypot(m[0], m[1])) issues.push({ field: 'enabled', severity: 'warning', code: 'one-way-platform-2d-rotated-solid-fallback', message: 'Rotated one-way tops require Character Slope Following and must be within the Character Maximum Slope Angle.' });
      return issues;
    },
  });
  // Intrinsic roles reflect the existing public engine data and native controls.
  registry.register({
    id: 'moving-platform-3d', displayName: 'Moving Platform 3D', category: 'Gameplay', version: 1, addable: true,
    help: 'Ping-pong translation for a Solid 3D Cube through existing Property Animation. Enable Solid in the Collider controls. Choose an axis, signed travel distance and one-way duration; opt into Start Automatically or connect an Event to Start Platform Motion (Self). For Sprite/Body 2D carry use Moving Platform 2D and Body velocity instead. Do not combine competing movement on the same Object.',
    eligibility: ['scene-object'], isEligible: target => !!target && target.kind === 'cube', inspector: { group: 'Gameplay', order: 160 },
    fields: [
      { key: 'enabled', label: 'Platform Motion Enabled', type: 'boolean', help: 'Allow this component to start translation; disabling leaves other authored systems unchanged.' },
      { key: 'autoplay', label: 'Start Automatically', type: 'boolean', help: 'Start the route when Play or this level begins. Otherwise use Start Platform Motion from an Event.' },
      { key: 'axis', label: 'Travel Axis', type: 'enum', choices: ['x', 'y', 'z'], choiceLabels: { x: 'X — Left / Right', y: 'Y — Up / Down', z: 'Z — Forward / Back' }, help: 'World axis for translation; Y is up in 3D.' },
      { key: 'distance', label: 'Travel Distance', type: 'number', step: .5, precision: 2, help: 'Signed world distance from the position when motion starts.' },
      { key: 'duration', label: 'One-Way Duration (seconds)', type: 'number', min: .05, step: .1, precision: 2, help: 'Time to reach the destination. Returning takes the same time.' },
    ],
    defaults: { enabled: true, autoplay: false, axis: 'x', distance: 4, duration: 2 },
    ownedFields: ['enabled', 'autoplay', 'axis', 'distance', 'duration'],
    serialization: { owner: 'moving-platform-3d', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    validate: (component, target) => {
      const issues = [];
      if (!Number.isFinite(component.duration) || component.duration < .05) issues.push({ field: 'duration', code: 'platform-duration', message: 'One-way duration must be at least 0.05 seconds.' });
      if (!Number.isFinite(component.distance)) issues.push({ field: 'distance', code: 'platform-distance', message: 'Travel distance must be finite.' });
      if (target?.components?.['body-2d']?.enabled) issues.push({ field: 'enabled', code: 'platform-motion-owner', message: 'Body 2D owns movement. Use Moving Platform 2D and Body velocity instead of 3D Property Animation.' });
      if (component.enabled && target?.entity && !target.entity.solid) issues.push({ field: 'enabled', severity: 'warning', code: 'platform-needs-solid', message: 'Enable Solid in Collider controls so the 3D Player can stand on this platform.' });
      return issues;
    },
  });
  // No applyTarget/load override: legacy record/hierarchy/Prefab placement fields
  // remain authoritative, rather than an obsolete component snapshot teleporting
  // a placed/duplicated Object or changing its renderer identity.
  registry.register({
    id:'transform',displayName:'Transform',category:'Object',version:1,addable:false,removable:false,
    eligibility:['scene-object','sprite'],inspector:{group:'Object',order:0,nativeControls:true},
    help:'Position, full X/Y/Z rotation and independent scale. Uses the same scene Transform as direct manipulation and Prefab placement.',
    fields:[{key:'position',label:'Position',help:'World position in scene units. Parented Objects use local offsets in Hierarchy.',type:'vec3',required:true},{key:'rotationDegrees',label:'Rotation X/Y/Z (degrees)',help:'Full orientation in degrees; parent-local orientation remains in Hierarchy.',type:'vec3',required:true},{key:'scale',label:'Scale X/Y/Z',help:'Independent visual scale for each scene axis; parent-local scale remains in Hierarchy.',type:'vec3',required:true}],
    defaults:{position:[0,0,0],rotationDegrees:[0,0,0],scale:[1,1,1]},
    serialization:{owner:'transform',authority:'legacy-transform-and-hierarchy-fields',duplicate:'deep-copy',prefab:'shared-record-path',placementAuthority:'legacy-placement-fields'},
    readTarget:target=>{const e=target?.entity;if(!e?.position||!e?.scale||!e?.quaternion?.toEuler)return null;const r=e.quaternion.toEuler();return {position:[e.position.x,e.position.y,e.position.z],rotationDegrees:[r.x,r.y,r.z].map(v=>v*180/Math.PI),scale:[e.scale.x,e.scale.y,e.scale.z]};},
  });
  registry.register({
    id:'visual',displayName:'Visual',category:'Object',version:1,addable:false,removable:false,
    eligibility:['scene-object'],inspector:{group:'Object',order:10,nativeControls:true},
    help:'Color and Texture use the Object’s existing rendered visual. Materials remain editable below; this role does not replace the mesh or collision system.',
    fields:[{key:'tint',label:'Color',help:'Rendered color, or tint when a Texture is assigned.',type:'color',required:true},{key:'textureAssetRef',label:'Texture',help:'Choose an imported local Texture; empty uses the existing untextured visual.',type:'assetRef',allowedAssetTypes:['texture'],nullable:true}],
    defaults:{tint:'#ffffff',textureAssetRef:null},
    serialization:{owner:'visual',authority:'legacy-color-texture-material-fields',duplicate:'deep-copy',prefab:'shared-record-path'},
    readTarget:target=>{const color=target?.entity?.color;if(!Array.isArray(color))return null;return {tint:'#'+color.slice(0,3).map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join(''),textureAssetRef:target.textureAssetId||null};},
  });
  registry.register({
    id:'ai-brain',displayName:'AI Brain',category:'Gameplay',version:1,addable:true,
    eligibility:['scene-object'],inspector:{group:'Gameplay',order:95},preserveAuthoredValues:true,preserveInvalidRecords:true,
    help:'Configure the existing AI movement, states, attacks and perception. Disabled AI keeps its authored settings without running.',
    fields:[{key:'enabled',label:'AI Brain Enabled',type:'boolean',required:true,help:'Disabled keeps the authored movement, states and senses but does not execute AI.'}],ownedFields:['enabled'],
    defaults:{version:1,enabled:true,config:{type:'follow',speed:3,radius:5}},
    readLegacyRecord:record=>{if(!record?.ai)return null;const captured=AiBrain.captureLegacy(record.ai);return captured.ok?captured.record:null;},
    readTarget:target=>{
      const bag=target?.components;
      const present=isPlainObject(bag)&&Object.prototype.hasOwnProperty.call(bag,'ai-brain');
      const current=present?AiBrain.inspect(bag['ai-brain']):null;
      if(present&&!current.ok)return clone(bag['ai-brain']);
      const captured=AiBrain.captureLegacy(target?.entity?.ai,{enabled:current?current.record.enabled:true});
      return captured.ok?captured.record:(present?clone(bag['ai-brain']):null);
    },
    applyTarget:(target,component)=>{
      const result=AiBrain.toLegacy(component);if(!result.ok||!target?.entity)return;
      const live=AiBrain.captureLegacy(target.entity.ai,{enabled:component.enabled});
      if(live.ok&&JSON.stringify(stableClone(live.record.config))===JSON.stringify(stableClone(result.config)))return;
      const config=result.config;
      if(Array.isArray(config.base)&&target.entity.position?.clone)config.base=target.entity.position.clone().set(...config.base);
      target.entity.ai=config;
    },
    initialize:(component,target)=>{
      const position=target?.entity?.position;
      if(!position)return;
      component.version=1;component.config.base=[position.x,position.y,position.z];
      const result=AiBrain.toLegacy(component);
      if(result.ok){const config=result.config;config.base=position.clone().set(...config.base);target.entity.ai=config;}
    },
    isPresent:target=>!!target?.entity?.ai,
    removeTarget:target=>{if(target?.entity)target.entity.ai=null;},
    validate:component=>AiBrain.inspect(component).ok?[]:[{code:'invalid-ai-brain',message:AiBrain.inspect(component).reason}],
  });
  registry.register({
    id: 'health', displayName: 'Health', category: 'Gameplay', version: 1, addable: true,
    removeTarget: (target) => { delete target.health; delete target._authoredHealth; },
    help: 'Adds maximum/current health and damage/death behavior.',
      eligibility: ['scene-object', 'sprite'], inspector: { group: 'Gameplay', order: 100 },
    fields: [
      { key: 'max', label: 'Maximum Health', help: 'The greatest health this Object can have.', type: 'number', min: 0.01, step: 1, precision: 2, required: true },
      { key: 'current', label: 'Starting Health', help: 'Health available when the level starts.', type: 'number', min: 0, step: 1, precision: 2, required: true },
    ],
    defaults: { max: 100, current: 100 }, ownedFields: ['max', 'current'], runtimeFields: ['lastDamageAt'],
    serialization: { owner: 'health', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    readLegacyRecord: (record) => isPlainObject(record.health) ? record.health : null,
    readTarget: (target) => isPlainObject(target.health) ? target.health : null,
    applyTarget: (target, component) => {
      const safeMax = Math.max(0.01, component.max);
      target.health = { max: safeMax, current: Math.max(0, Math.min(component.current, safeMax)) };
    },
    validate: (component) => {
      const issues = [];
      if (!(component.max > 0)) issues.push({ field: 'max', code: 'health-max-positive', message: 'Maximum Health must be greater than 0.' });
      if (component.current < 0 || component.current > component.max) issues.push({ field: 'current', code: 'health-current-range', message: 'Starting Health must be between 0 and Maximum Health.' });
      return issues;
    },
  });
    registry.register({
      id: 'damage', displayName: 'Damage', category: 'Gameplay', version: 2, addable: true,
      help: 'Reusable damage amount. Connect an Event to Apply Damage Component and choose its Health target; adding this alone does not damage anything.',
      eligibility: ['scene-object', 'sprite'], inspector: { group: 'Gameplay', order: 110 },
      fields: [{ key: 'amount', label: 'Damage Amount', help: 'Health removed each time Apply Damage Component runs.', type: 'number', min: 0, step: 1, precision: 2, required: true },
        {key:'damageType',label:'Damage Type',type:'enum',choices:['ordinary','fire','ice'],choiceLabels:{ordinary:'Ordinary',fire:'Fire',ice:'Ice'},help:'Target resistance for this type scales incoming damage. Historical Damage records use Ordinary.'}],
      defaults: { version:2,amount: 10,damageType:'ordinary' }, ownedFields: ['amount','damageType'], runtimeFields: [],
      preserveAuthoredValues:true,preserveInvalidRecords:true,migratePreservedRecords:true,
      inspectRecord: component => {
        if(!isPlainObject(component))return {ok:false,reason:'Damage must be a supported record; saved data is retained.'};
        for(const key of ['version','amount','damageType']){const d=Object.getOwnPropertyDescriptor(component,key);if(d&&!Object.prototype.hasOwnProperty.call(d,'value'))return {ok:false,reason:'Damage fields must be authored values.'};}
        const version=component.version===undefined?1:component.version;
        if(![1,2].includes(version)||!Number.isFinite(component.amount)||component.amount<0)return {ok:false,reason:'Damage needs a supported version and finite nonnegative amount.'};
        if(version===1&&Object.prototype.hasOwnProperty.call(component,'damageType')||version===2&&!['ordinary','fire','ice'].includes(component.damageType))return {ok:false,reason:'Damage type requires a valid version2 Ordinary, Fire or Ice choice.'};
        return {ok:true};
      },
      migrate:(record,version)=>version===1?{...record,damageType:'ordinary'}:record,
      serialization: { owner: 'damage', duplicate: 'deep-copy', prefab: 'shared-record-path' },
      validate: component => {
        const checked=registry.get('damage').inspectRecord(component);
        return checked.ok?[]:[{field:'amount',code:'damage-invalid-record',message:checked.reason}];
      },
    });
    registry.register({
      id: 'damage-resistance', displayName: 'Damage Resistance', category: 'Gameplay', version: 1, addable: true,
      help: 'Optional incoming damage profile. 0 = immune, 0.5 = half damage, 1 = unchanged, 2 = double damage. Applies to Health damage, not healing or Set Health. Missing profile leaves historical damage unchanged.',
      eligibility: ['scene-object', 'sprite'], inspector: { group: 'Gameplay', order: 115 }, preserveAuthoredValues: true, preserveInvalidRecords: true,
      inspectRecord: component => { const checked = DamagePolicy.inspectProfile(component); return { ok: checked.ok, reason: checked.issues.map(issue => issue.message).join(' ') }; },
      fields: [
        { key: 'enabled', label: 'Resistance Enabled', type: 'boolean', help: 'Disable to receive unchanged incoming damage without removing this authored profile.' },
        ...['ordinary', 'fire', 'ice'].map(key => ({ key, label: key[0].toUpperCase()+key.slice(1)+' Damage Multiplier', help: '0 immune · 0.5 half · 1 unchanged · 2 double. Finite, zero or greater.', type: 'number', min: 0, step: 0.1, precision: 2, required: true })),
      ],
      defaults: { version: 1, enabled: true, ordinary: 1, fire: 1, ice: 1 }, ownedFields: ['enabled', 'ordinary', 'fire', 'ice'], runtimeFields: [],
      serialization: { owner: 'damage-resistance', duplicate: 'deep-copy', prefab: 'shared-record-path' },
      validate: component => DamagePolicy.inspectProfile(component).issues.map(issue => ({ ...issue, field: 'ordinary' })),
    });
    for(const [id,displayName,order] of [['hurtbox','Hurtbox',116],['hitbox','Hitbox',117]])registry.register({
      id,displayName,category:'Gameplay',version:1,addable:true,eligibility:['scene-object','sprite'],inspector:{group:'Gameplay',order},
      help:id==='hurtbox'?'Incoming combat sphere, independent of movement Collider. Disabled means not hittable, not pass-through walls. Missing keeps historical Cube combat bounds. Select Object and enable Show Colliders for blue sphere rings.':'Attack overlap sphere. Add Damage and connect an Event to Apply Hitbox Damage; adding alone never attacks. No automatic cooldown or wall line-of-sight. Select Object and enable Show Colliders for orange sphere rings.',
      preserveAuthoredValues:true,preserveInvalidRecords:true,inspectRecord:component=>CombatVolumes.inspect(component),
      fields:[{key:'enabled',label:'Combat Sphere Enabled',type:'boolean',help:id==='hurtbox'?'Disable incoming combat hits without changing physical wall collision.':'Disable overlap attacks; adding alone never deals damage.'},
        {key:'radius',label:'Combat Radius',type:'number',min:.000001,step:.1,required:true,help:'Positive world-unit sphere radius. Independent of mesh scale and movement Collider.'},
        ...['X','Y','Z'].map(axis=>({key:'offset'+axis,label:'World Offset '+axis,type:'number',step:.1,required:true,help:'World-axis units from Object position; not rotated or scaled. For XY games leave Z at0; Y is up in3D.'}))],
      defaults:CombatVolumes.create(),ownedFields:['enabled','radius','offsetX','offsetY','offsetZ'],runtimeFields:[],
      serialization:{owner:id,duplicate:'deep-copy',prefab:'shared-record-path'},validate:component=>CombatVolumes.inspect(component).issues,
    });
    registry.register({
      id: 'interactable', displayName: 'Interactable', category: 'Gameplay', version: 1, addable: true,
      help: 'Choose interaction reach and prompt, then connect On Interact to an Action in Behaviors. Uses the existing player Interact input, including touch and remapping; adding this alone performs no Action.',
      eligibility: ['scene-object', 'sprite'], inspector: { group: 'Gameplay', order: 120 },
      fields: [
        { key: 'enabled', label: 'Interaction Enabled', help: 'Disabled targets do not show a prompt or receive Interact input.', type: 'boolean' },
        { key: 'range', label: 'Interaction Reach', help: 'World-space distance from the player center to this Object center. Nearest eligible Object wins; not a Collider or line-of-sight test.', type: 'number', min: 0.01, max: 100, step: 0.1, required: true },
        { key: 'prompt', label: 'Interaction Prompt', help: 'Short action hint shown beside the current Interact key. Plain text, not HTML.', type: 'string', maxLength: 120 },
      ],
      defaults: { enabled: true, range: 2.5, prompt: 'interact' }, ownedFields: ['enabled', 'range', 'prompt'], runtimeFields: [],
      serialization: { owner: 'interactable', duplicate: 'deep-copy', prefab: 'shared-record-path' },
      validate: component => !(component.range > 0 && component.range <= 100) ? [{ field: 'range', code: 'interaction-range', message: 'Interaction Reach must be greater than 0 and at most 100.' }] : [],
    });
    registry.register({
      id: 'pickup', displayName: 'Pickup', category: 'Gameplay', version: 1, addable: true,
      help: 'Choose a named Item, then connect On Interact, Click or an eligible Trigger event to Collect Pickup. Uses existing inventory. Successful collection is once per level entry; Stop restores authored objects.',
      eligibility: ['scene-object', 'sprite'], inspector: { group: 'Gameplay', order: 130 },
      fields: [
        { key: 'enabled', label: 'Pickup Enabled', help: 'Disabled Pickup does not grant items.', type: 'boolean' },
        { key: 'itemRef', label: 'Item', help: 'Choose an existing Project → Items definition. Rename keeps this stable reference; missing or duplicate IDs cannot grant.', type: 'itemRef', required: true, nullable: true },
        { key: 'quantity', label: 'Quantity', help: 'Whole amount to grant, or no collection if it does not fit the Item capacity. Legacy Give Item behavior is unchanged.', type: 'integer', min: 1, max: 1000, required: true },
        { key: 'collectorRef', label: 'Collector Object (optional)', help: 'Leave empty for the existing Player. For Trigger2D, choose the controlled Object whose exact overlap may collect. Inventory remains the existing shared player inventory, not per-actor storage.', type: 'objectRef', nullable: true, allowSelf: false, scope: 'current-level' },
        { key: 'removeOnCollect', label: 'Remove After Collection', help: 'Remove this live Object on success; otherwise leave its visual but grant only once per level entry. Authored data survives project Save and Stop. Existing opt-in World State persistence remains separate.', type: 'boolean' },
      ],
      defaults: { enabled: true, itemRef: null, quantity: 1, collectorRef: null, removeOnCollect: true }, ownedFields: ['enabled', 'itemRef', 'quantity', 'collectorRef', 'removeOnCollect'], runtimeFields: [],
      serialization: { owner: 'pickup', duplicate: 'deep-copy', prefab: 'shared-record-path' },
      validate: component => !Number.isInteger(component.quantity) || component.quantity < 1 || component.quantity > 1000 ? [{ field: 'quantity', code: 'pickup-quantity', message: 'Quantity must be a whole number from 1 to 1000.' }] : [],
    });
    registry.register({
      id: 'checkpoint', displayName: 'Checkpoint', category: 'Gameplay', version: 1, addable: true,
      help: 'Connect On Interact, Click or a Player Trigger to Activate Checkpoint. Respawn At Checkpoint then uses the existing Player system. Adding this component alone does not activate it.',
      eligibility: ['scene-object', 'sprite'], inspector: { group: 'Gameplay', order: 140 },
      fields: [
        { key: 'enabled', label: 'Checkpoint Enabled', help: 'Disabled checkpoints cannot replace the current Player respawn position.', type: 'boolean' },
        { key: 'autosave', label: 'Autosave on Activation', help: 'Opt in to save Player progress to the existing auto slot only after this checkpoint successfully activates. No background timer. Failed storage keeps the in-session checkpoint and reports failure; use Load Game with slot auto to restore saved progress.', type: 'boolean' },
        { key: 'respawnPointRef', label: 'Respawn Marker (optional)', help: 'Choose a placed Object or Spawn Point, or leave empty to use this Object. Activation snapshots its world position; later movement does not drag the checkpoint.', type: 'objectRef', nullable: true, scope: 'current-level' },
        { key: 'offset', label: 'Respawn Offset', help: 'World-space XYZ offset from the marker center. Place the result on safe ground, outside solid geometry. This is an intentional teleport, not collision-aware movement.', type: 'vec3', required: true },
        { key: 'activatorRef', label: 'Trigger2D Activator (optional)', help: 'For modern Trigger2D, choose the exact overlapping Object allowed to activate this Player checkpoint. This does not create a per-object respawn controller. Leave empty for ordinary Player Interact/Click/legacy Trigger.', type: 'objectRef', nullable: true, allowSelf: false, scope: 'current-level' },
      ],
      defaults: { enabled: true, autosave: false, respawnPointRef: null, offset: [0,0,0], activatorRef: null }, ownedFields: ['enabled','autosave','respawnPointRef','offset','activatorRef'], runtimeFields: [],
      serialization: { owner: 'checkpoint', duplicate: 'deep-copy', prefab: 'shared-record-path' },
      validate: c => [...(!Array.isArray(c.offset) || c.offset.length !== 3 || !c.offset.every(Number.isFinite) ? [{field:'offset',code:'checkpoint-offset',message:'Respawn Offset must contain three finite world-space numbers.'}] : []), ...(c.autosave !== undefined && typeof c.autosave !== 'boolean' ? [{field:'autosave',code:'checkpoint-autosave',message:'Autosave on Activation must be on or off.'}] : [])],
    });
    registry.register({
      id: 'door-gate', displayName: 'Door / Gate', category: 'Gameplay', version: 1, addable: true,
      help: 'Connect an Event to Open Door, Close Door or Toggle Door (Self). Configure Solid for a 3D panel, or Static Body plus Collider for 2D. Opening hides the panel and disables its existing 2D colliders. No animation, Collider or Event is added automatically.',
      eligibility: ['scene-object', 'sprite'], inspector: { group: 'Gameplay', order: 150 },
      fields: [
        { key: 'enabled', label: 'Door Enabled', type: 'boolean', help: 'Disabled Door components leave historical visibility and collision Actions unchanged.' },
        { key: 'startsOpen', label: 'Starts Open', type: 'boolean', help: 'Open at Play start. Closing restores the original Collider enabled settings, not every Collider indiscriminately.' },
        { key: 'persistState', label: 'Remember State in Game Save', type: 'boolean', help: 'Opt in to existing Save Game / Load Game for this door, including Sprite doors. Project Save and Stop always preserve authored settings.' },
      ],
      defaults: { enabled: true, startsOpen: false, persistState: false }, ownedFields: ['enabled','startsOpen','persistState'], runtimeFields: [],
      serialization: { owner: 'door-gate', duplicate: 'deep-copy', prefab: 'shared-record-path' },
      validate: (c, target) => {
        const body = target && target.components && target.components['body-2d'];
        return c.enabled && body && body.type !== 'static' ? [{ field: 'enabled', code: 'door-gate-static-body', message: 'Door / Gate uses a Static 2D Body. A moving Kinematic panel needs a movement workflow, not hide/show Door Actions.' }] : [];
      },
    });
    registry.register({
      id: 'particle-emitter', displayName: 'Particle Emitter', category: 'Effects', version: 1, addable: true,
    removable: false,
    help: 'Emits a configurable visual particle effect.',
    eligibility: ['emitter'], inspector: { group: 'Effects', order: 200 },
    fields: [
      { key: 'rate', label: 'Emission Rate', help: 'Particles emitted per second.', type: 'number', min: 0, step: 1, precision: 2, required: true },
      { key: 'spread', label: 'Spread', help: 'Random position and velocity variation.', type: 'number', min: 0, step: 0.1, precision: 2, required: true },
      { key: 'gravity', label: 'Gravity', help: 'Vertical acceleration applied to particles.', type: 'number', step: 0.05, precision: 2, required: true },
      { key: 'maxParticles', label: 'Particle Cap', help: 'Maximum live particles for this emitter.', type: 'integer', min: 0, max: 500, step: 1, required: true },
    ],
    defaults: { rate: 20, spread: 0.6, gravity: -0.15, maxParticles: 200 },
    ownedFields: ['rate', 'spread', 'gravity', 'maxParticles'], runtimeFields: ['particles', 'accumulator'],
    serialization: { owner: 'particle-emitter', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    readLegacyRecord: (record) => record && record.kind === 'emitter' && isPlainObject(record.options) ? {
      rate: record.options.rate, spread: record.options.spread, gravity: record.options.gravity, maxParticles: record.options.maxParticles,
    } : null,
    readTarget: (target) => {
      const source = target && target.kind === 'emitter' ? (target.options || target.handle) : null;
      return source ? { rate: source.rate, spread: source.spread, gravity: source.gravity, maxParticles: source.maxParticles } : null;
    },
    applyTarget: (target, component) => {
      if (!target.options) target.options = {};
      const safe = {
        rate: Math.max(0, component.rate), spread: Math.max(0, component.spread), gravity: component.gravity,
        maxParticles: Math.max(0, Math.min(500, component.maxParticles)),
      };
      for (const key of ['rate', 'spread', 'gravity', 'maxParticles']) target.options[key] = safe[key];
      if (target.handle) for (const key of ['rate', 'spread', 'gravity', 'maxParticles']) target.handle[key] = safe[key];
    },
    validate: (component) => {
      const issues = [];
      if (component.rate < 0) issues.push({ field: 'rate', code: 'particle-rate-negative', message: 'Particle Rate cannot be negative.' });
      if (component.maxParticles < 0) issues.push({ field: 'maxParticles', code: 'particle-cap-negative', message: 'Particle Cap cannot be negative.' });
      return issues;
    },
  });
  registry.register({
    id: 'trigger', displayName: 'Trigger Volume', category: 'Physics', version: 1, addable: true,
    help: 'Detects Objects entering, staying in, or leaving a bounded area.',
    eligibility: ['trigger'], inspector: { group: 'Physics', order: 300 },
    fields: [
      { key: 'repeat', label: 'Repeat', help: 'Run trigger Events again after an Object leaves and re-enters.', type: 'boolean' },
      { key: 'shape', label: 'Shape', help: 'Volume shape used for enter, stay, and exit detection.', type: 'enum', choices: ['box', 'sphere'], choiceLabels: { box: 'Box', sphere: 'Sphere' }, required: true },
    ],
    defaults: { repeat: true, shape: 'box' }, ownedFields: ['repeat', 'shape'], runtimeFields: ['inside'],
    serialization: { owner: 'trigger', duplicate: 'deep-copy', prefab: 'shared-record-path' },
    readLegacyRecord: (record) => record && record.isTrigger ? { repeat: record.triggerRepeat !== false, shape: record.triggerShape === 'sphere' ? 'sphere' : 'box' } : null,
    readTarget: (target) => target && target.isTrigger ? { repeat: target.triggerRepeat !== false, shape: target.triggerShape === 'sphere' ? 'sphere' : 'box' } : null,
    applyTarget: (target, component) => { target.isTrigger = true; target.triggerRepeat = component.repeat; target.triggerShape = component.shape === 'sphere' ? 'sphere' : undefined; },
    removeTarget: (target) => { delete target.isTrigger; delete target.triggerRepeat; delete target.triggerShape; },
    validate: (component) => ['box', 'sphere'].includes(component.shape) ? [] : [{ field: 'shape', code: 'trigger-shape', message: 'Trigger Shape must be Box or Sphere.' }],
  });

  registry.register({
    id: 'scene-collection', displayName: 'Scene Collection (editor only)', category: 'Scene', version: 1, addable: false,
    help: 'A named Scene-list collection, independent of parenting and transform groups. Filtering never hides or disables gameplay.',
    eligibility: ['any'], inspector: { group: 'Scene', order: 999 },
    fields: [{ key: 'name', label: 'Collection', type: 'string', required: true, help: 'One collection per Object; change several together from the Scene tab.' }],
    defaults: { name: 'Collection' }, ownedFields: ['name'], runtimeFields: [], preserveAuthoredValues: true, preserveInvalidRecords: true,
    inspectRecord: value => ({ ok: !!value && typeof value === 'object' && !Array.isArray(value) && value.version === 1 && typeof value.name === 'string' && value.name.length > 0 && value.name.length <= 80 && value.name.trim() === value.name }),
    validate: value => typeof value?.name === 'string' && value.name.length > 0 && value.name.length <= 80 && value.name.trim() === value.name ? [] : [{ field: 'name', code: 'scene-collection-name', message: 'Collection needs a trimmed name of 1–80 characters. Retained unavailable membership does not filter the Object out of All/Uncollected.' }],
  });

  return {
    COMPONENT_RECORD_VERSION, FIELD_TYPES, REFERENCE_TYPES,
    AuthoringSchemaRegistry, registry, stableClone, createAuthoringApi, eligibilityMatches, componentExists,
    ...createAuthoringApi(registry),
  };
});
