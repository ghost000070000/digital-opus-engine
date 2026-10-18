// Phase 042: Trigger Collider 2D geometry and deterministic object-pair lifecycle.
// Detection only: no bodies, motion, response, filtering, or Tilemap scanning.
(function (root, factory) {
  'use strict';
  const collider = typeof module !== 'undefined' && module.exports ? require('./00-collider-2d.js') : root.OpusCollider2D;
  const filters = typeof module !== 'undefined' && module.exports ? require('./00-collision-filter-2d.js') : root.OpusCollisionFilter2D;
  const api = factory(collider, filters);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusTrigger2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Collider2D, Filters) {
  'use strict';
  const COMPONENT_ID = 'trigger-collider-2d';
  const ENTER = 'trigger2DEnter', STAY = 'trigger2DStay', EXIT = 'trigger2DExit';
  const EVENT_ORDER = Object.freeze({ [ENTER]: 0, [STAY]: 1, [EXIT]: 2 });
  const finite = Number.isFinite;
  const validOffset = (value) => Array.isArray(value) && value.length >= 2 && value.slice(0, 2).every(finite);

  function validTrigger(component) {
    if (!component || ![1, 2].includes(component.version) || component.enabled === false || typeof component.enabled !== 'boolean' || !['box', 'circle'].includes(component.shape) || !validOffset(component.offset)) return false;
    if (component.shape === 'box') return Array.isArray(component.size) && component.size.length >= 2 && component.size.slice(0, 2).every((value) => finite(value) && value > 0);
    return finite(component.radius) && component.radius > 0;
  }

  function resolveTriggerWorldShape(object, component) {
    if (!Collider2D || !validTrigger(component)) return null;
    const shapeComponent = component.shape === 'box'
      ? { version: 1, enabled: true, offset: component.offset, size: component.size }
      : { version: 1, enabled: true, offset: component.offset, radius: component.radius };
    const shape = Collider2D.resolveCollider2DWorldShape(object, shapeComponent, component.shape);
    if (!shape) return null;
    return Object.freeze({ ...shape, filter: Filters.filterOf(component), componentId: COMPONENT_ID, triggerShape: component.shape });
  }

  function pairKey(triggerId, targetId) { return `${triggerId.length}:${triggerId}${targetId}`; }
  function eventPayload(eventType, trigger, target, matchedColliderTypes) {
    const types = Object.freeze(Array.from(new Set(matchedColliderTypes || [])).sort());
    return Object.freeze({ eventType, lifecycle: eventType === ENTER ? 'enter' : eventType === STAY ? 'stay' : 'exit', triggerObjectId: trigger.id, targetObjectId: target.id, componentId: COMPONENT_ID, triggerObject: trigger, targetObject: target, matchedColliderTypes: types });
  }
  function compareId(a, b) { const left=String(a),right=String(b); return left<right?-1:left>right?1:0; }
  function compareEvents(a, b) { return compareId(a.triggerObjectId,b.triggerObjectId) || compareId(a.targetObjectId,b.targetObjectId) || EVENT_ORDER[a.eventType] - EVENT_ORDER[b.eventType]; }

  function createTriggerLifecycle(options = {}) {
    let previous = new Map();
    const subscribers = new Map([[ENTER, new Set()], [STAY, new Set()], [EXIT, new Set()]]);
    let emit = typeof options.emit === 'function' ? options.emit : null;
    let onError = typeof options.onError === 'function' ? options.onError : null;
    const metrics = { ticks: 0, candidates: 0, filterRejects: 0, aabbTests: 0, aabbRejects: 0, narrowTests: 0, shapeResolutions: 0, enter: 0, stay: 0, exit: 0, peakPairs: 0 };
    const safeDispatch = (payload) => {
      const handlers = Array.from(subscribers.get(payload.eventType) || []);
      if (emit) handlers.unshift(emit);
      for (const handler of handlers) { try { handler(payload); } catch (error) { if (onError) onError(error, payload); else if (typeof console !== 'undefined' && console.error) console.error(error); } }
    };
    function subscribe(eventType, handler) {
      if (!subscribers.has(eventType) || typeof handler !== 'function') throw new TypeError('Trigger 2D subscription requires a canonical event type and function.');
      const set = subscribers.get(eventType); set.add(handler); return () => set.delete(handler);
    }
    function reset() { previous = new Map(); }
    function tick(objects, knownTriggerObjects) {
      metrics.ticks++;
      const layerIds = Filters.validLayerIds(typeof options.collisionLayers === 'function' ? options.collisionLayers() : options.collisionLayers);
      const indexedTriggers = Array.isArray(knownTriggerObjects) ? knownTriggerObjects : null;
      // Runtime supplies its maintained Trigger-object index. An empty index
      // returns before enumerating ordinary scene objects at all.
      if (indexedTriggers && !previous.size && indexedTriggers.length === 0) return Object.freeze([]);
      const list = Array.isArray(objects) ? objects.filter((object) => object && typeof object.id === 'string') : [];
      if (!indexedTriggers && !previous.size && !list.some((object) => object.components && object.components[COMPONENT_ID] && object.components[COMPONENT_ID].enabled !== false)) return Object.freeze([]);
      const byId = new Map(list.map((object) => [object.id, object]));
      const targets = [], triggers = [];
      for (const object of list) {
        const bag = object.components || {};
        if (!indexedTriggers && bag[COMPONENT_ID]) triggers.push(object);
        if (bag[Collider2D.BOX_ID] || bag[Collider2D.CIRCLE_ID]) targets.push(object);
      }
      if (indexedTriggers) for (const object of indexedTriggers) if (object && byId.get(object.id) === object && object.components && object.components[COMPONENT_ID]) triggers.push(object);
      triggers.sort((a,b)=>compareId(a.id,b.id)); targets.sort((a,b)=>compareId(a.id,b.id));
      const targetCache = new Map();
      const getTargetShapes = (target) => { if (!targetCache.has(target.id)) { const shapes = Collider2D.enumerateCollider2DWorldShapes(target); metrics.shapeResolutions += shapes.length; targetCache.set(target.id, shapes); } return targetCache.get(target.id); };
      const current = new Map();
      for (const trigger of triggers) {
        const triggerShape = resolveTriggerWorldShape(trigger, trigger.components[COMPONENT_ID]);
        if (!triggerShape) continue;
        metrics.shapeResolutions++;
        for (const target of targets) {
          if (target === trigger || target.id === trigger.id) continue;
          const shapes = getTargetShapes(target); if (!shapes.length) continue;
          metrics.candidates++;
          const matched = [];
          for (const shape of shapes) {
            if (!Filters.allows(triggerShape, shape, layerIds)) { metrics.filterRejects++; continue; }
            metrics.aabbTests++;
            if (!Collider2D.aabbOverlaps(triggerShape.aabb, shape.aabb)) { metrics.aabbRejects++; continue; }
            metrics.narrowTests++;
            if (Collider2D.overlaps(triggerShape, shape)) matched.push(shape.componentId);
          }
          if (matched.length) current.set(pairKey(trigger.id, target.id), { triggerId: trigger.id, targetId: target.id, matched });
        }
      }
      const events = [];
      for (const [key, pair] of current) {
        const trigger = byId.get(pair.triggerId), target = byId.get(pair.targetId); if (!trigger || !target) continue;
        const type = previous.has(key) ? STAY : ENTER; events.push(eventPayload(type, trigger, target, pair.matched)); metrics[type === ENTER ? 'enter' : 'stay']++;
      }
      for (const [key, pair] of previous) if (!current.has(key)) {
        const trigger = byId.get(pair.triggerId), target = byId.get(pair.targetId);
        // Object/Level deletion is silent: never expose dead object handles.
        if (trigger && target) { events.push(eventPayload(EXIT, trigger, target, pair.matched)); metrics.exit++; }
      }
      previous = current; metrics.peakPairs = Math.max(metrics.peakPairs, current.size);
      events.sort(compareEvents); const snapshot = Object.freeze(events.slice());
      for (const event of snapshot) safeDispatch(event);
      return snapshot;
    }
    return Object.freeze({ tick, reset, subscribe, activePairCount: () => previous.size, snapshotPairKeys: () => Object.freeze(Array.from(previous.keys()).sort()), metrics, setEmitter: (handler) => { emit = typeof handler === 'function' ? handler : null; }, setErrorHandler: (handler) => { onError = typeof handler === 'function' ? handler : null; } });
  }
  return Object.freeze({ COMPONENT_ID, ENTER, STAY, EXIT, EVENT_ORDER, validTrigger, resolveTriggerWorldShape, pairKey, compareEvents, createTriggerLifecycle });
});
