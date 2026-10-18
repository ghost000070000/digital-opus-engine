// Phase 047: bounded world-XY walkable surface geometry. Internal only.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusCharacterSlope2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EPSILON = 1e-7;
  const SUPPORT_TOLERANCE = 0.000101;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  function surfaceFromShape(shape, sourceId, oneWay = false, acceptsShape = null) {
    if (!shape || !Array.isArray(shape.points) || shape.points.length < 3) return null;
    const points = shape.points;
    const centroid = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
    let best = null;
    for (let index = 0; index < points.length; index++) {
      // Collider2D Boxes retain local corner identity even when mirrored.
      // Only the two authored horizontal edges can become ground; accepting
      // a rotated side would turn a too-steep ramp into a walkable wall.
      if (shape.kind === 'box' && index !== 0 && index !== 2) continue;
      const a = points[index], b = points[(index + 1) % points.length];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (!(length > EPSILON) || Math.abs(dx) <= EPSILON) continue;
      let normal = { x: dy / length, y: -dx / length };
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (dot({ x: centroid.x - midpoint.x, y: centroid.y - midpoint.y }, normal) > 0) normal = { x: -normal.x, y: -normal.y };
      if (normal.y <= EPSILON) continue;
      const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
      const p0 = a.x <= b.x ? a : b, p1 = a.x <= b.x ? b : a;
      const candidate = { kind: 'walkable-surface', p0: { x: p0.x, y: p0.y }, p1: { x: p1.x, y: p1.y },
        tangent: { x: (p1.x - p0.x) / length, y: (p1.y - p0.y) / length },
        normal, angle, oneWay: !!oneWay, sourceId: String(sourceId), planeD: dot(normal, p0), acceptsShape };
      if (!best || normal.y > best.normal.y + EPSILON || (Math.abs(normal.y - best.normal.y) <= EPSILON && midpoint.y > (best.p0.y + best.p1.y) / 2 + EPSILON)) best = candidate;
    }
    if (!best) return null;
    Object.freeze(best.p0); Object.freeze(best.p1); Object.freeze(best.tangent); Object.freeze(best.normal);
    return Object.freeze(best);
  }
  function trianglePoints(direction, minX, minY, maxX, maxY) {
    if (![minX, minY, maxX, maxY].every(Number.isFinite) || !(maxX > minX && maxY > minY)) return null;
    const points = direction === 'up-right'
      ? [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }]
      : direction === 'up-left'
        ? [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: minX, y: maxY }]
        : null;
    return points && Object.freeze(points.map((point) => Object.freeze(point)));
  }
  function finiteOverlap(shapes, surface, dx = 0) {
    return (shapes || []).some((shape) => (!surface.acceptsShape || surface.acceptsShape(shape)) && shape.aabb.maxX + dx >= surface.p0.x - EPSILON && shape.aabb.minX + dx <= surface.p1.x + EPSILON);
  }
  function clipAtX(points, boundary, keepRight) {
    const result = [];
    for (let index = 0; index < points.length; index++) {
      const a = points[index], b = points[(index + 1) % points.length];
      const aInside = keepRight ? a.x >= boundary - EPSILON : a.x <= boundary + EPSILON;
      const bInside = keepRight ? b.x >= boundary - EPSILON : b.x <= boundary + EPSILON;
      if (aInside) result.push(a);
      if (aInside !== bInside && Math.abs(b.x - a.x) > EPSILON) {
        const t = (boundary - a.x) / (b.x - a.x);
        result.push({ x: boundary, y: a.y + (b.y - a.y) * t });
      }
    }
    return result;
  }
  function supportProjection(shape, normal, surface) {
    if (shape.kind === 'circle') {
      const preferred = { x: shape.center.x - normal.x * shape.radius, y: shape.center.y - normal.y * shape.radius };
      const candidates = [];
      if (!surface || preferred.x >= surface.p0.x - EPSILON && preferred.x <= surface.p1.x + EPSILON) candidates.push(preferred);
      if (surface) for (const x of [surface.p0.x, surface.p1.x]) {
        const dx = x - shape.center.x;
        if (Math.abs(dx) <= shape.radius + EPSILON) candidates.push({ x, y: shape.center.y - Math.sqrt(Math.max(0, shape.radius * shape.radius - dx * dx)) });
      }
      return candidates.length ? Math.min(...candidates.map((point) => dot(point, normal))) : Infinity;
    }
    const points = surface ? clipAtX(clipAtX(shape.points, surface.p0.x, true), surface.p1.x, false) : shape.points;
    return points.length ? Math.min(...points.map((point) => dot(point, normal))) : Infinity;
  }
  function supportGap(shapes, surface) {
    return Math.min(...(shapes || []).filter((shape) => !surface.acceptsShape || surface.acceptsShape(shape)).map((shape) => supportProjection(shape, surface.normal, surface))) - surface.planeD;
  }
  function surfaceY(surface, x) {
    const t = (x - surface.p0.x) / (surface.p1.x - surface.p0.x);
    return surface.p0.y + (surface.p1.y - surface.p0.y) * t;
  }
  function walkable(surface, maximumAngle) {
    return !!surface && Number.isFinite(maximumAngle) && surface.normal.y > EPSILON && surface.angle <= maximumAngle + 1e-7;
  }
  function crossing(shapes, surfaces, delta, maximumAngle, oneWayOnly = false) {
    let best = null;
    for (const surface of surfaces || []) {
      if (!walkable(surface, maximumAngle) || (oneWayOnly && !surface.oneWay)) continue;
      if (surface.oneWay && !(delta.y < 0)) continue;
      const gap = supportGap(shapes, surface);
      if (gap < -SUPPORT_TOLERANCE) continue;
      const change = dot(surface.normal, delta);
      if (!(change < -EPSILON)) continue;
      const fraction = Math.max(0, gap / -change);
      if (fraction > 1 + EPSILON || !finiteOverlap(shapes, surface, delta.x * fraction)) continue;
      if (!best || fraction < best.fraction - EPSILON || (Math.abs(fraction - best.fraction) <= EPSILON && surface.sourceId < best.surface.sourceId)) best = { fraction: Math.min(1, fraction), surface };
    }
    return best && Object.freeze(best);
  }
  function support(shapes, surfaces, maximumAngle, distance = SUPPORT_TOLERANCE) {
    let best = null;
    for (const surface of surfaces || []) {
      if (!walkable(surface, maximumAngle) || !finiteOverlap(shapes, surface)) continue;
      const gap = supportGap(shapes, surface);
      if (gap < -SUPPORT_TOLERANCE || gap > distance * surface.normal.y + SUPPORT_TOLERANCE) continue;
      if (!best || gap < best.gap - EPSILON || (Math.abs(gap - best.gap) <= EPSILON && surface.sourceId < best.surface.sourceId)) best = { surface, gap };
    }
    return best && Object.freeze(best);
  }
  return Object.freeze({ EPSILON, SUPPORT_TOLERANCE, surfaceFromShape, trianglePoints, finiteOverlap, supportProjection, supportGap, surfaceY, walkable, crossing, support });
});
