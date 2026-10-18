// Phase 043: Static/Kinematic roles over Phase 041 ordinary collider geometry.
// The service owns translation and transient move results only.
(function (root, factory) {
  'use strict';
  const collider = typeof module !== 'undefined' && module.exports ? require('./00-collider-2d.js') : root.OpusCollider2D;
  const oneWay = typeof module !== 'undefined' && module.exports ? require('./00-one-way-2d.js') : root.OpusOneWay2D;
  const slope = typeof module !== 'undefined' && module.exports ? require('./00-character-slope-2d.js') : root.OpusCharacterSlope2D;
  const movingPlatform = typeof module !== 'undefined' && module.exports ? require('./00-moving-platform-2d.js') : root.OpusMovingPlatform2D;
  const filters = typeof module !== 'undefined' && module.exports ? require('./00-collision-filter-2d.js') : root.OpusCollisionFilter2D;
  const api = factory(collider, oneWay, slope, movingPlatform, filters);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusBody2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Collider2D, OneWay2D, Slope2D, MovingPlatform2D, Filters) {
  'use strict';
  const COMPONENT_ID = 'body-2d';
  const CONTACT_EPSILON = 1e-6;
  const MAX_ADVANCES = 48;
  const finite = Number.isFinite;
  const compareId = (a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;

  function validBody(body) {
    return !!body && body.version === 1 && typeof body.enabled === 'boolean' &&
      (body.type === 'static' || body.type === 'kinematic') &&
      Array.isArray(body.linearVelocity) && body.linearVelocity.length === 2 && body.linearVelocity.every(finite);
  }
  function role(object, type) {
    const body = object && object.components && object.components[COMPONENT_ID];
    return validBody(body) && body.enabled && body.type === type;
  }
  function shifted(shape, x, y) {
    const a = shape.aabb;
    const aabb = { minX: a.minX + x, maxX: a.maxX + x, minY: a.minY + y, maxY: a.maxY + y };
    return shape.kind === 'circle'
      ? { ...shape, kind: 'circle', center: { x: shape.center.x + x, y: shape.center.y + y }, radius: shape.radius, aabb }
      : { ...shape, kind: shape.kind, points: shape.points.map((p) => ({ x: p.x + x, y: p.y + y })), aabb };
  }
  function sweptAabb(a, delta) {
    return { minX: Math.min(a.minX, a.minX + delta.x), maxX: Math.max(a.maxX, a.maxX + delta.x),
      minY: Math.min(a.minY, a.minY + delta.y), maxY: Math.max(a.maxY, a.maxY + delta.y) };
  }
  function dot(p, axis) { return p.x * axis.x + p.y * axis.y; }
  function convexGap(a, b) {
    let largest = -Infinity;
    for (const box of [a, b]) for (let i = 0; i < box.points.length; i++) {
      const p = box.points[i], q = box.points[(i + 1) % box.points.length];
      const length = Math.hypot(q.x - p.x, q.y - p.y);
      if (length <= Collider2D.EPSILON) return Infinity;
      const axis = { x: -(q.y - p.y) / length, y: (q.x - p.x) / length };
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const v of a.points) { const n = dot(v, axis); amin = Math.min(amin, n); amax = Math.max(amax, n); }
      for (const v of b.points) { const n = dot(v, axis); bmin = Math.min(bmin, n); bmax = Math.max(bmax, n); }
      largest = Math.max(largest, bmin - amax, amin - bmax);
    }
    return largest;
  }
  function segmentDistance(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    const t = length2 > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2)) : 0;
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
  }
  function pointInConvex(point, shape) {
    let sign = 0;
    for (let index = 0; index < shape.points.length; index++) {
      const a = shape.points[index], b = shape.points[(index + 1) % shape.points.length];
      const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      if (Math.abs(cross) <= CONTACT_EPSILON) continue;
      const next = Math.sign(cross);
      if (sign && next !== sign) return false;
      sign = next;
    }
    return true;
  }
  function separation(a, b) {
    if (a.kind !== 'circle' && b.kind !== 'circle') return convexGap(a, b);
    if (a.kind === 'circle' && b.kind === 'circle') return Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) - a.radius - b.radius;
    const box = a.kind === 'circle' ? b : a, circle = a.kind === 'circle' ? a : b;
    let nearest = Infinity;
    for (let i = 0; i < box.points.length; i++) nearest = Math.min(nearest, segmentDistance(circle.center, box.points[i], box.points[(i + 1) % box.points.length]));
    return (pointInConvex(circle.center, box) ? -nearest : nearest) - circle.radius;
  }
  // Separation is a conservative, translation-Lipschitz bound. Advancing by
  // gap / speed cannot step past first contact, including a thin wall whose
  // final position would be clear. The cap fails closed by retaining the
  // last safe fraction. A start already penetrating is left for an author to
  // repair; there is no arbitrary depenetration direction.
  function safeFraction(moving, obstacle, delta, stats) {
    const distance = Math.hypot(delta.x, delta.y);
    if (distance <= 0) return 1;
    const initial = separation(moving, obstacle);
    if (initial < -CONTACT_EPSILON) { stats.initialOverlaps++; return 0; }
    if (initial <= CONTACT_EPSILON) {
      const probe = Math.min(1, Math.max(1e-4 / distance, 1e-6));
      const next = separation(shifted(moving, delta.x * probe, delta.y * probe), obstacle);
      if (next < initial - 1e-9) return 0;
      // For convex shapes, an outward or tangent axis ray from contact
      // cannot re-enter that same obstacle later along this axis.
      return 1;
    }
    let t = 0;
    for (let i = 0; i < MAX_ADVANCES; i++) {
      stats.sweeps++;
      const gap = separation(shifted(moving, delta.x * t, delta.y * t), obstacle);
      if (gap <= CONTACT_EPSILON) return t;
      const step = Math.max((gap - CONTACT_EPSILON) / distance, 1e-12);
      if (t + step >= 1) return 1;
      t += step;
    }
    stats.cappedSweeps++;
    return t;
  }
  function newMetrics() { return { ticks: 0, moves: 0, blockedX: 0, blockedY: 0, candidates: 0, broadRejects: 0, narrowTests: 0, staticShapeResolutions: 0, sweeps: 0, cappedSweeps: 0, initialOverlaps: 0,
    filterRejects: 0, aabbTests: 0, platformMoves: 0, carryMoves: 0, carryClamps: 0, carryFailClosed: 0, riderCount: 0, supportChanges: 0 }; }
  function createBody2DManager(options = {}) {
    const metrics = newMetrics();
    const layerIds = () => Filters.validLayerIds(typeof options.collisionLayers === 'function' ? options.collisionLayers() : options.collisionLayers);
    let activeLayerIds = layerIds();
    const accepts = (a, b) => Filters.allows(a, b, activeLayerIds);
    const surfaceFor = (shape, id, oneWay) => Slope2D.surfaceFromShape(shape, id, oneWay, (mover) => accepts(mover, shape));
    const characterStates = new Map();
    const platformStates = new Map();
    let movingPlatformEntries = new Map(), movingPlatformDeltas = new Map();
    const tileObstacles = typeof options.tileObstacles === 'function' ? options.tileObstacles : () => [];
    // Optional gameplay intent stays transient: null preserves historical authored
    // velocity, while a malformed explicit request admits no movement.
    const characterVelocity = typeof options.characterVelocity === 'function' ? options.characterVelocity : null;
    const EMPTY_STATE = Object.freeze({ active: false, grounded: false, ceiling: false, wallLeft: false, wallRight: false, wallSliding: false, onSlope: false, groundNormal: null, slopeAngle: null, groundSupportId: null, onMovingPlatform: false, groundSupportVelocity: Object.freeze([0, 0]) });
    function characterEligible(object) {
      const component = object && object.components && object.components['character-collision-2d'];
      const version = component && component.version;
      const newFieldsValid = version === 1 || version === 2 &&
        typeof component.slopeHandlingEnabled === 'boolean' && finite(component.maxSlopeAngle) && component.maxSlopeAngle > 0 && component.maxSlopeAngle <= 60 &&
        typeof component.stepHandlingEnabled === 'boolean' && finite(component.maxStepHeight) && component.maxStepHeight > 0 && component.maxStepHeight <= 10;
      return role(object, 'kinematic') && !!component && newFieldsValid && component.enabled === true &&
        typeof component.wallSlideEnabled === 'boolean' && finite(component.wallSlideMaxSpeed) && component.wallSlideMaxSpeed > 0 &&
        Collider2D.enumerateCollider2DWorldShapes(object).length > 0;
    }
    function shapeBounds(shapes, delta = { x: 0, y: 0 }) {
      return shapes.reduce((a, shape) => { const b = sweptAabb(shape.aabb, delta); return {
        minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
      }; }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    }
    const translateWorld = typeof options.translateWorld === 'function' ? options.translateWorld : (object, delta) => {
      const pos = object && object.entity && object.entity.position;
      if (!pos) return false;
      pos.x += delta.x; pos.y += delta.y;
      if (object.worldMatrix && object.worldMatrix.length >= 16) { object.worldMatrix[12] += delta.x; object.worldMatrix[13] += delta.y; }
      return true;
    };
    const canTranslateWorld = typeof options.canTranslateWorld === 'function' ? options.canTranslateWorld : (object) => !!(object && object.entity && object.entity.position);
    function moveKinematicBody2D(mover, requestedDelta, statics, extraObstacles, commit = true) {
      activeLayerIds = layerIds();
      const zero = { x: 0, y: 0 };
      const requested = requestedDelta && finite(requestedDelta.x) && finite(requestedDelta.y) ? { x: requestedDelta.x, y: requestedDelta.y } : zero;
      const result = { requestedDelta: requested, actualDelta: { x: 0, y: 0 }, blockedX: false, blockedY: false, hitObjectIds: [], initialOverlap: false };
      if (!role(mover, 'kinematic') || requested === zero || (!requested.x && !requested.y)) return Object.freeze(result);
      const moverShapes = Collider2D.enumerateCollider2DWorldShapes(mover);
      if (!moverShapes.length) {
        if (!commit || translateWorld(mover, requested)) result.actualDelta = { ...requested };
        metrics.moves++;
        return Object.freeze(result);
      }
      const obstacles = [...(statics || []), ...(extraObstacles || [])].filter((entry) => entry.object !== mover && entry.object.id !== mover.id);
      const hits = new Set();
      let movedX = 0, movedY = 0;
      for (const axis of ['x', 'y']) {
        const amount = requested[axis];
        if (!amount) continue;
        const delta = axis === 'x' ? { x: amount, y: 0 } : { x: 0, y: amount };
        let allowed = 1;
        for (const entry of obstacles) {
          let broad = false;
          for (const original of moverShapes) {
            const start = shifted(original, movedX, movedY);
            if (entry.shapes.some((shape) => {
              if (!accepts(start, shape)) { metrics.filterRejects++; return false; }
              metrics.aabbTests++;
              return Collider2D.aabbOverlaps(sweptAabb(start.aabb, delta), shape.aabb);
            })) { broad = true; break; }
          }
          metrics.candidates++;
          if (!broad) { metrics.broadRejects++; continue; }
          for (const original of moverShapes) for (const shape of entry.shapes) {
            const start = shifted(original, movedX, movedY);
            if (!accepts(start, shape)) { metrics.filterRejects++; continue; }
            metrics.aabbTests++;
            if (!Collider2D.aabbOverlaps(sweptAabb(start.aabb, delta), shape.aabb)) continue;
            metrics.narrowTests++;
            const fraction = safeFraction(start, shape, delta, metrics);
            if (fraction < allowed) allowed = fraction;
            if (fraction < 1) hits.add(entry.object.id);
            if (separation(start, shape) < -CONTACT_EPSILON) result.initialOverlap = true;
          }
        }
        const accepted = amount * allowed;
        if (axis === 'x') { movedX = accepted; result.blockedX = allowed < 1 - 1e-9; if (result.blockedX) metrics.blockedX++; }
        else { movedY = accepted; result.blockedY = allowed < 1 - 1e-9; if (result.blockedY) metrics.blockedY++; }
      }
      if (!(movedX || movedY) || !commit || translateWorld(mover, { x: movedX, y: movedY })) result.actualDelta = { x: movedX, y: movedY };
      result.hitObjectIds = Array.from(hits).sort();
      metrics.moves++;
      return Object.freeze(result);
    }
    function classifyCharacterStatics(statics) {
      const solids = [], oneWays = [];
      for (const entry of statics || []) {
        const component = entry.object.components && entry.object.components['one-way-platform-2d'];
        const box = entry.shapes.find((shape) => shape.kind === 'box');
        const top = component && component.version === 1 && component.enabled === true && box && OneWay2D.horizontalTop(box);
        if (top) oneWays.push({ object: entry.object, shapes: [box], top, oneWay: true, acceptsShape: (shape) => accepts(shape, box) });
        else solids.push(entry);
      }
      return { solids, oneWays };
    }
    // Probes are read-only: one contact epsilon plus a 1e-4 world-unit margin,
    // capped by one tenth of the smallest mover extent. They never move Transform.
    function contactState(mover, statics, cachedTiles, oneWays) {
      const shapes = Collider2D.enumerateCollider2DWorldShapes(mover);
      if (!shapes.length) return EMPTY_STATE;
      const minExtent = Math.min(...shapes.map((shape) => Math.min(shape.aabb.maxX - shape.aabb.minX, shape.aabb.maxY - shape.aabb.minY)));
      const distance = Math.min(CONTACT_EPSILON + 1e-4, Math.max(CONTACT_EPSILON * 2, minExtent * 0.1));
      const state = { active: true, grounded: false, ceiling: false, wallLeft: false, wallRight: false, wallSliding: false, onSlope: false, groundNormal: null, slopeAngle: null, groundSupportId: null, onMovingPlatform: false, groundSupportVelocity: [0, 0] };
      for (const [key, dx, dy] of [['grounded', 0, -1], ['ceiling', 0, 1], ['wallLeft', -1, 0], ['wallRight', 1, 0]]) {
        const delta = { x: dx * distance, y: dy * distance };
        const obstacles = [...(statics || []), ...(cachedTiles || tileObstacles(mover, shapeBounds(shapes, delta)))];
        const contact = obstacles.find((entry) => {
          if (entry.object.id === mover.id) return false;
          if (key === 'grounded' && entry.movingPlatform) {
            const character = mover.components && mover.components['character-collision-2d'];
            const maxAngle = character?.version === 2 && character.slopeHandlingEnabled ? character.maxSlopeAngle : 0.01;
            const surface = surfaceFor(entry.shapes[0], entry.object.id, MovingPlatform2D.oneWay(entry.object));
            if (!Slope2D.walkable(surface, maxAngle)) return false;
          }
          return entry.shapes.some((obstacle) => shapes.some((shape) => accepts(shape, obstacle) && Collider2D.aabbOverlaps(sweptAabb(shape.aabb, delta), obstacle.aabb) &&
            separation(shifted(shape, delta.x, delta.y), obstacle) < -CONTACT_EPSILON));
        });
        state[key] = !!contact;
        if (key === 'grounded' && contact) state.groundSupportId = String(contact.object.id);
      }
      if (!state.grounded) {
        const support = (oneWays || []).find((entry) => OneWay2D.supported(shapes, [entry], distance));
        if (support) { state.grounded = true; state.groundSupportId = String(support.object.id); }
      }
      if (state.grounded) { state.groundNormal = [0, 1]; state.slopeAngle = 0; }
      return state;
    }
    function finalizeCharacterState(mover, state, dt) {
      const prior = characterStates.get(mover.id)?.state;
      const supportId = state.grounded && state.groundSupportId !== null ? String(state.groundSupportId) : null;
      const delta = supportId && movingPlatformDeltas.get(supportId);
      state.onMovingPlatform = !!(supportId && movingPlatformEntries.has(supportId));
      state.groundSupportVelocity = Object.freeze(state.onMovingPlatform && delta && dt > 0
        ? [delta.x / dt, delta.y / dt] : [0, 0]);
      if ((prior?.groundSupportId || null) !== supportId) metrics.supportChanges++;
      return Object.freeze(state);
    }
    function vectorFraction(shapes, obstacles, delta) {
      let allowed = 1;
      for (const entry of obstacles) for (const obstacle of entry.shapes) for (const shape of shapes) {
        metrics.candidates++;
        if (!accepts(shape, obstacle)) { metrics.filterRejects++; continue; }
        metrics.aabbTests++;
        if (!Collider2D.aabbOverlaps(sweptAabb(shape.aabb, delta), obstacle.aabb)) { metrics.broadRejects++; continue; }
        metrics.narrowTests++;
        allowed = Math.min(allowed, safeFraction(shape, obstacle, delta, metrics));
      }
      return allowed;
    }
    function moveCharacterSlope2D(mover, requestedDelta, dt, classified) {
      const character = mover.components['character-collision-2d'];
      const requested = requestedDelta && finite(requestedDelta.x) && finite(requestedDelta.y) ? requestedDelta : { x: 0, y: 0 };
      const firstShapes = Collider2D.enumerateCollider2DWorldShapes(mover);
      const margin = CONTACT_EPSILON + 1e-4;
      const sweep = shapeBounds(firstShapes, requested);
      const candidates = tileObstacles(mover, { minX: sweep.minX - character.maxStepHeight - margin, minY: sweep.minY - character.maxStepHeight - margin,
        maxX: sweep.maxX + character.maxStepHeight + margin, maxY: sweep.maxY + character.maxStepHeight + margin });
      const maxAngle = character.slopeHandlingEnabled ? character.maxSlopeAngle : 0.01;
      const solidScene = [], solidTiles = [], oneWays = [], surfaces = [];
      function classify(entry, destination) {
        const shape = entry.shapes.find((item) => item.kind === 'box' || item.kind === 'polygon');
        const authoredOneWay = entry.slopeOneWay || !!(entry.object.components && entry.object.components['one-way-platform-2d']?.enabled);
        const surface = entry.surface ? { ...entry.surface, acceptsShape: (moverShape) => accepts(moverShape, shape) } : (shape && surfaceFor(shape, entry.object.id, !!(entry.oneWay || authoredOneWay)));
        if (entry.oneWay || authoredOneWay && Slope2D.walkable(surface, maxAngle)) {
          if (surface) oneWays.push(surface);
          return;
        }
        destination.push(entry);
        if (surface && Slope2D.walkable(surface, maxAngle)) surfaces.push(surface);
      }
      for (const entry of classified.solids) classify(entry, solidScene);
      for (const entry of classified.oneWays) classify(entry, solidScene);
      for (const entry of candidates) classify(entry, solidTiles);
      surfaces.push(...oneWays);
      const solids = [...solidScene, ...solidTiles];
      const start = contactState(mover, solidScene, solidTiles, []);
      const startSupport = Slope2D.support(firstShapes, surfaces, maxAngle, margin);
      const groundedAtStart = start.grounded || !!startSupport;
      let xResult = null, slopeMoved = false, slopeY = 0;
      if (character.slopeHandlingEnabled && groundedAtStart && requested.x && requested.y <= margin) {
        const horizontallyShifted = firstShapes.map((shape) => shifted(shape, requested.x, 0));
        const viable = surfaces.filter((surface) => Slope2D.walkable(surface, maxAngle) && Slope2D.finiteOverlap(firstShapes, surface, requested.x))
          .map((surface) => {
            // Evaluate the support plane at the requested destination X.
            // At a flush flat-to-ramp seam the current shape can sit one
            // contact epsilon before the finite segment, so its current-X
            // support projection is intentionally empty. Destination-X
            // projection both covers that handoff and yields the exact Y
            // correction for Characters already on the surface.
            const gap = Slope2D.supportGap(horizontallyShifted, surface);
            const rise = -gap / surface.normal.y;
            return { surface, gap, rise };
          }).filter((candidate) => Number.isFinite(candidate.gap) && (candidate.surface.angle > 0.01 || Math.abs(candidate.rise) <= margin) &&
            Math.abs(candidate.rise) <= Math.abs(requested.x) * Math.tan(maxAngle * Math.PI / 180) + margin)
          .sort((a, b) => Math.abs(a.rise) - Math.abs(b.rise) || a.surface.sourceId.localeCompare(b.surface.sourceId));
        for (const candidate of viable) {
          const delta = { x: requested.x, y: candidate.rise };
          // The candidate surface itself is the destination support. Sweeping
          // the rising Character against that same solid rejects a valid
          // flat-to-ramp handoff at the exact seam before the projected move
          // can be committed. Keep every other obstacle in the clearance
          // check, but let the analytically projected finite support own its
          // own contact boundary.
          const clearanceSolids = solids.filter((entry) => entry.object.id !== candidate.surface.sourceId);
          if (vectorFraction(firstShapes, clearanceSolids, delta) < 1 - 1e-7) continue;
          if (!translateWorld(mover, delta)) break;
          slopeMoved = true; slopeY = candidate.rise;
          xResult = { actualDelta: delta, blockedX: false, hitObjectIds: [], initialOverlap: false };
          metrics.moves++;
          break;
        }
      }
      // A step is an atomic raised-X traversal from the original pose. A blocked
      // attempt never changes Transform, including when a ceiling or another
      // collider invalidates the raised path.
      if (!slopeMoved && character.stepHandlingEnabled && groundedAtStart && requested.x && requested.y <= margin &&
          vectorFraction(firstShapes, solids, { x: requested.x, y: 0 }) < 1 - 1e-7) {
        const bottom = Math.min(...firstShapes.map((shape) => shape.aabb.minY));
        const sign = Math.sign(requested.x);
        const targets = surfaces.filter((surface) => !surface.oneWay && surface.angle <= 0.01 &&
            Slope2D.finiteOverlap(firstShapes, surface, requested.x))
          .map((surface) => ({ surface, height: surface.p0.y - Math.min(...firstShapes.filter((shape) => !surface.acceptsShape || surface.acceptsShape(shape)).map((shape) => shape.aabb.minY)) }))
          .filter((target) => target.height > margin && target.height <= character.maxStepHeight + 1e-8)
          .sort((a, b) => a.height - b.height || a.surface.sourceId.localeCompare(b.surface.sourceId));
        for (const target of targets) {
          const lift = target.height + margin;
          const raised = firstShapes.map((shape) => shifted(shape, 0, lift));
          if (vectorFraction(firstShapes, solids, { x: 0, y: lift }) < 1 - 1e-7) continue;
          if (vectorFraction(raised, solids, { x: requested.x, y: 0 }) < 1 - 1e-7) continue;
          const destination = raised.map((shape) => shifted(shape, requested.x, 0));
          if (!Slope2D.finiteOverlap(destination, target.surface)) continue;
          // The raised destination must have a support within the authored
          // step height, not merely clear space past a narrow wall.
          const landingGap = Slope2D.supportGap(destination, target.surface);
          if (landingGap < -margin || landingGap > margin * target.surface.normal.y + Slope2D.SUPPORT_TOLERANCE) continue;
          if (!translateWorld(mover, { x: requested.x, y: lift })) break;
          slopeMoved = true; slopeY = lift;
          xResult = { actualDelta: { x: requested.x, y: lift }, blockedX: false, hitObjectIds: [target.surface.sourceId], initialOverlap: false };
          metrics.moves++;
          break;
        }
      }
      if (!slopeMoved) xResult = moveKinematicBody2D(mover, { x: requested.x, y: 0 }, solidScene, solidTiles);
      const afterX = contactState(mover, solidScene, solidTiles, []);
      const slide = character.wallSlideEnabled && requested.y < -character.wallSlideMaxSpeed * dt && !groundedAtStart && !afterX.grounded &&
        (start.wallLeft || start.wallRight || afterX.wallLeft || afterX.wallRight || xResult.blockedX);
      let y = slide ? -character.wallSlideMaxSpeed * dt : requested.y;
      if (character.stepHandlingEnabled && groundedAtStart && requested.y <= margin && !xResult.blockedX && requested.x && !slopeMoved) {
        const shapes = Collider2D.enumerateCollider2DWorldShapes(mover);
        const drop = surfaces.filter((surface) => !surface.oneWay && Slope2D.walkable(surface, maxAngle) &&
            Slope2D.finiteOverlap(shapes, surface))
          .map((surface) => ({ surface, gap: Slope2D.supportGap(shapes, surface) }))
          .filter((target) => target.gap > margin && target.gap / target.surface.normal.y <= character.maxStepHeight + margin)
          .sort((a, b) => a.gap / a.surface.normal.y - b.gap / b.surface.normal.y || a.surface.sourceId.localeCompare(b.surface.sourceId))[0];
        if (drop && !Slope2D.support(shapes, surfaces, maxAngle, margin)) {
          const distance = drop.gap / drop.surface.normal.y;
          const fraction = vectorFraction(shapes, solids, { x: 0, y: -distance });
          if (fraction * distance >= distance - margin) y -= distance * fraction;
        }
      }
      const landing = Slope2D.crossing(firstShapes, oneWays, { x: xResult.actualDelta.x, y }, maxAngle, true);
      const oneWayY = landing ? y * landing.fraction : y;
      const yResult = moveKinematicBody2D(mover, { x: 0, y: oneWayY }, solidScene, solidTiles);
      const landed = !!landing && Math.abs(yResult.actualDelta.y - oneWayY) <= 1e-7;
      const finalShapes = Collider2D.enumerateCollider2DWorldShapes(mover);
      const support = Slope2D.support(finalShapes, surfaces, maxAngle, margin);
      const final = contactState(mover, solidScene, solidTiles, []);
      if (support) {
        final.grounded = true; final.onSlope = support.surface.angle > 0.01;
        final.groundNormal = Object.freeze([support.surface.normal.x, support.surface.normal.y]);
        final.slopeAngle = support.surface.angle; final.groundSupportId = support.surface.sourceId;
        if (final.onSlope) { final.wallLeft = false; final.wallRight = false; }
      } else if (final.grounded) { final.groundNormal = Object.freeze([0, 1]); final.slopeAngle = 0; }
      final.wallSliding = !!(slide && !final.grounded && (final.wallLeft || final.wallRight));
      characterStates.set(mover.id, { object: mover, state: finalizeCharacterState(mover, final, dt) });
      return Object.freeze({ requestedDelta: { ...requested }, actualDelta: { x: xResult.actualDelta.x, y: slopeY + yResult.actualDelta.y },
        blockedX: xResult.blockedX, blockedY: yResult.blockedY || landed, hitObjectIds: Object.freeze([...new Set([...xResult.hitObjectIds, ...yResult.hitObjectIds, ...(landed ? [landing.surface.sourceId] : [])])].sort()),
        initialOverlap: xResult.initialOverlap || yResult.initialOverlap, wallSliding: final.wallSliding });
    }
    function moveCharacter2D(mover, requestedDelta, dt, statics) {
      activeLayerIds = layerIds();
      if (!characterEligible(mover)) { characterStates.delete(mover && mover.id); return moveKinematicBody2D(mover, requestedDelta, statics); }
      const scene = Array.isArray(statics) ? classifyCharacterStatics(statics) : statics;
      const character = mover.components['character-collision-2d'];
      if (character.version === 2 && (character.slopeHandlingEnabled || character.stepHandlingEnabled)) return moveCharacterSlope2D(mover, requestedDelta, dt, scene);
      const requested = requestedDelta && finite(requestedDelta.x) && finite(requestedDelta.y) ? requestedDelta : { x: 0, y: 0 };
      const firstShapes = Collider2D.enumerateCollider2DWorldShapes(mover);
      const sweep = shapeBounds(firstShapes, requested);
      const margin = CONTACT_EPSILON + 1e-4;
      const candidates = tileObstacles(mover, { minX: sweep.minX - margin, minY: sweep.minY - margin, maxX: sweep.maxX + margin, maxY: sweep.maxY + margin });
      const solidTiles = candidates.filter((entry) => !entry.oneWay);
      const oneWays = [...scene.oneWays, ...candidates.filter((entry) => entry.oneWay)];
      const start = contactState(mover, scene.solids, solidTiles, oneWays);
      const xResult = moveKinematicBody2D(mover, { x: requested.x, y: 0 }, scene.solids, solidTiles);
      const afterX = contactState(mover, scene.solids, solidTiles, oneWays);
      const slide = character.wallSlideEnabled && requested.y < -character.wallSlideMaxSpeed * dt &&
        !start.grounded && !afterX.grounded && (start.wallLeft || start.wallRight || afterX.wallLeft || afterX.wallRight || xResult.blockedX);
      const y = slide ? -character.wallSlideMaxSpeed * dt : requested.y;
      const landing = OneWay2D.crossing(firstShapes, oneWays, xResult.actualDelta.x, y);
      const oneWayY = landing ? y * landing.fraction : y;
      const yResult = moveKinematicBody2D(mover, { x: 0, y: oneWayY }, scene.solids, solidTiles);
      const landed = !!landing && Math.abs(yResult.actualDelta.y - oneWayY) <= 1e-7;
      const final = contactState(mover, scene.solids, solidTiles, oneWays);
      final.wallSliding = !!(slide && !final.grounded && (final.wallLeft || final.wallRight));
      characterStates.set(mover.id, { object: mover, state: finalizeCharacterState(mover, final, dt) });
      return Object.freeze({ requestedDelta: { ...requested }, actualDelta: { x: xResult.actualDelta.x, y: yResult.actualDelta.y },
        blockedX: xResult.blockedX, blockedY: yResult.blockedY || landed, hitObjectIds: Object.freeze([...new Set([...xResult.hitObjectIds, ...yResult.hitObjectIds, ...(landed ? [landing.id] : [])])].sort()),
        initialOverlap: xResult.initialOverlap || yResult.initialOverlap, wallSliding: final.wallSliding });
    }
    function movingEntry(object) {
      const box = MovingPlatform2D && MovingPlatform2D.boxShape(object);
      return box ? { object, shapes: [box], movingPlatform: true } : null;
    }
    function probeMovingSupport(character, entries) {
      const shapes = Collider2D.enumerateCollider2DWorldShapes(character);
      if (!shapes.length) return null;
      const component = character.components['character-collision-2d'];
      const maxAngle = component.version === 2 && component.slopeHandlingEnabled ? component.maxSlopeAngle : 0.01;
      const margin = CONTACT_EPSILON + 1e-4;
      const supports = entries.map((entry) => {
        const surface = surfaceFor(entry.shapes[0], entry.object.id, MovingPlatform2D.oneWay(entry.object));
        const support = Slope2D.walkable(surface, maxAngle) && Slope2D.support(shapes, [surface], maxAngle, margin);
        return support && { entry, surface, gap: support.gap };
      }).filter(Boolean).sort((a, b) => a.gap - b.gap || compareId(a.entry.object, b.entry.object));
      return supports[0] || null;
    }
    function carryFraction(character, platform, delta, statics) {
      if (!canTranslateWorld(character, delta)) { metrics.carryFailClosed++; return 0; }
      const shapes = Collider2D.enumerateCollider2DWorldShapes(character);
      if (!shapes.length) { metrics.carryFailClosed++; return 0; }
      const bounds = shapeBounds(shapes, delta);
      const tiles = tileObstacles(character, bounds).filter((entry) => entry.object.id !== platform.id);
      return vectorFraction(shapes, [...statics.filter((entry) => entry.object.id !== platform.id), ...tiles], delta);
    }
    function tick(objects, dt, knownBodyObjects) {
      activeLayerIds = layerIds();
      metrics.ticks++;
      if (!finite(dt) || dt <= 0) return [];
      const list = Array.isArray(knownBodyObjects) ? knownBodyObjects : objects;
      if (!Array.isArray(list) || !list.length) { characterStates.clear(); platformStates.clear(); movingPlatformEntries.clear(); movingPlatformDeltas.clear(); return []; }
      const kinematics = list.filter((object) => role(object, 'kinematic')).sort(compareId);
      const characters = kinematics.filter(characterEligible);
      const active = new Set(characters.map((object) => object.id));
      for (const id of characterStates.keys()) if (!active.has(id)) characterStates.delete(id);
      if (!kinematics.length) { platformStates.clear(); movingPlatformEntries.clear(); movingPlatformDeltas.clear(); return []; }
      const statics = list.filter((object) => role(object, 'static')).sort(compareId).map((object) => {
        const shapes = Collider2D.enumerateCollider2DWorldShapes(object);
        metrics.staticShapeResolutions += shapes.length;
        return { object, shapes };
      }).filter((entry) => entry.shapes.length);

      // Snapshot current support geometry before any platform movement. A
      // bounded geometry probe fills only the first-play/stale-state gap;
      // established riders are linked directly by stable groundSupportId.
      const platforms = kinematics.filter((object) => MovingPlatform2D && MovingPlatform2D.eligible(object));
      const previousEntries = platforms.map(movingEntry).filter(Boolean);
      const previousById = new Map(previousEntries.map((entry) => [String(entry.object.id), entry]));
      const ridersByPlatform = new Map(platforms.map((object) => [String(object.id), []]));
      for (const character of characters) {
        const prior = characterStates.get(character.id)?.state;
        let supportId = prior?.grounded && previousById.has(String(prior.groundSupportId)) ? String(prior.groundSupportId) : null;
        if (supportId && !Collider2D.enumerateCollider2DWorldShapes(character).some((shape) => previousById.get(supportId).shapes.some((platformShape) => accepts(shape, platformShape)))) supportId = null;
        if (!supportId) supportId = probeMovingSupport(character, previousEntries)?.entry.object.id || null;
        if (supportId && ridersByPlatform.has(String(supportId))) ridersByPlatform.get(String(supportId)).push(character);
      }
      for (const riders of ridersByPlatform.values()) riders.sort(compareId);

      const results = new Map();
      platformStates.clear(); movingPlatformDeltas = new Map();
      // Compute (without committing) the Phase 043 Static-limited base
      // displacement, reduce it by one scalar shared across every rider,
      // then commit the platform and exact rider translations once.
      for (const platform of platforms) {
        const body = platform.components[COMPONENT_ID];
        const requested = { x: body.linearVelocity[0] * dt, y: body.linearVelocity[1] * dt };
        const base = moveKinematicBody2D(platform, requested, statics, undefined, false);
        const riders = ridersByPlatform.get(String(platform.id)) || [];
        metrics.riderCount += riders.length;
        let fraction = 1;
        for (const rider of riders) fraction = Math.min(fraction, carryFraction(rider, platform, base.actualDelta, statics));
        if (fraction < 1 - 1e-9) metrics.carryClamps++;
        const delta = { x: base.actualDelta.x * fraction, y: base.actualDelta.y * fraction };
        const committed = (!delta.x && !delta.y) || translateWorld(platform, delta);
        const actual = committed ? delta : { x: 0, y: 0 };
        if (!committed) metrics.carryFailClosed++;
        movingPlatformDeltas.set(String(platform.id), Object.freeze({ ...actual }));
        platformStates.set(String(platform.id), Object.freeze({ previousOrigin: Object.freeze({ x: platform.worldMatrix?.[12] - actual.x || 0, y: platform.worldMatrix?.[13] - actual.y || 0 }),
          baseDelta: Object.freeze({ ...base.actualDelta }), actualDelta: Object.freeze({ ...actual }), riderCount: riders.length, carryFraction: committed ? fraction : 0 }));
        for (const rider of riders) if ((actual.x || actual.y) && translateWorld(rider, actual)) metrics.carryMoves++;
        metrics.platformMoves++;
        results.set(platform.id, Object.freeze({ requestedDelta: Object.freeze({ ...requested }), actualDelta: Object.freeze({ ...actual }),
          blockedX: base.blockedX || (!!requested.x && Math.abs(actual.x - base.actualDelta.x) > 1e-9),
          blockedY: base.blockedY || (!!requested.y && Math.abs(actual.y - base.actualDelta.y) > 1e-9),
          hitObjectIds: base.hitObjectIds, initialOverlap: base.initialOverlap, carryFraction: committed ? fraction : 0, riderCount: riders.length }));
      }

      // Character obstacle geometry is resolved after platform commits. Only
      // explicit Moving Platform Boxes join the provider; arbitrary
      // Kinematic Bodies remain absent from Character and Body response.
      const currentEntries = platforms.map(movingEntry).filter(Boolean);
      movingPlatformEntries = new Map(currentEntries.map((entry) => [String(entry.object.id), entry]));
      for (const character of characters) {
        const body = character.components[COMPONENT_ID];
        const intent = characterVelocity ? characterVelocity(character, dt) : null;
        const velocity = intent === null ? body.linearVelocity :
          Array.isArray(intent) && intent.length === 2 && intent.every(finite) ? intent : [0, 0];
        const requested = { x: velocity[0] * dt, y: velocity[1] * dt };
        const characterShapes = Collider2D.enumerateCollider2DWorldShapes(character);
        const bounds = shapeBounds(characterShapes, requested), margin = CONTACT_EPSILON + 1e-4 + (character.components['character-collision-2d'].maxStepHeight || 0);
        const nearbyPlatforms = currentEntries.filter((entry) => entry.shapes.some((shape) => characterShapes.some((characterShape) => accepts(characterShape, shape)) && Collider2D.aabbOverlaps({ minX: bounds.minX - margin, minY: bounds.minY - margin, maxX: bounds.maxX + margin, maxY: bounds.maxY + margin }, shape.aabb)));
        results.set(character.id, moveCharacter2D(character, requested, dt, classifyCharacterStatics([...statics, ...nearbyPlatforms])));
      }
      for (const object of kinematics) {
        if (results.has(object.id)) continue;
        const body = object.components[COMPONENT_ID];
        results.set(object.id, moveKinematicBody2D(object, { x: body.linearVelocity[0] * dt, y: body.linearVelocity[1] * dt }, statics));
      }
      return kinematics.map((object) => ({ objectId: object.id, result: results.get(object.id) }));
    }
    function getCharacterCollision2DState(id) { const entry = characterStates.get(id); return Object.freeze({ ...(entry && characterEligible(entry.object) ? entry.state : EMPTY_STATE) }); }
    function clearCharacterCollision2DState(id) {
      if (id === undefined) { characterStates.clear(); platformStates.clear(); movingPlatformEntries.clear(); movingPlatformDeltas.clear(); }
      else characterStates.delete(id);
    }
    function getMovingPlatform2DState(id) { const state = platformStates.get(String(id)); return state ? Object.freeze({ ...state }) : null; }
    return Object.freeze({ tick, moveKinematicBody2D, moveCharacter2D, getCharacterCollision2DState, getMovingPlatform2DState, clearCharacterCollision2DState, metrics });
  }
  return Object.freeze({ COMPONENT_ID, CONTACT_EPSILON, MAX_ADVANCES, validBody, role, shifted, sweptAabb, separation, createBody2DManager });
});
