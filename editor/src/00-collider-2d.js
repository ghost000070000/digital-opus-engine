// Phase 041: deterministic, passive 2D collider geometry.
// This module owns shapes and overlap queries only. It deliberately has no
// physics world, response, velocity, trigger callbacks, or frame loop.
(function (root, factory) {
  'use strict';
  const filters = typeof module !== 'undefined' && module.exports ? require('./00-collision-filter-2d.js') : root.OpusCollisionFilter2D;
  const api = factory(filters);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusCollider2D = api;
})(typeof window !== 'undefined' ? window : this, function (Filters) {
  'use strict';

  const EPSILON = 1e-8;
  const MIN_SIZE = 0.001;
  const BOX_ID = 'box-collider-2d';
  const CIRCLE_ID = 'circle-collider-2d';

  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const finitePoint = (value) => value && finite(value.x) && finite(value.y);
  const copyPoint = (value) => Object.freeze({ x: value.x, y: value.y });
  const matrixValues = (value) => value && value.m ? value.m : value;

  function identityMatrix() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function multiplyMatrix(aValue, bValue) {
    const a = matrixValues(aValue), b = matrixValues(bValue);
    if (!a || !b || a.length < 16 || b.length < 16) return null;
    const out = new Array(16).fill(0);
    for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
    return out;
  }

  function composeMatrix(options = {}) {
    const position = options.position || [0, 0, 0];
    const scale = options.scale || [1, 1, 1];
    const rotation = Number(options.rotation || 0);
    if (![...position, ...scale, rotation].every(finite)) return null;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const local = [
      c * scale[0], s * scale[0], 0, 0,
      -s * scale[1], c * scale[1], 0, 0,
      0, 0, scale[2], 0,
      position[0], position[1], position[2], 1,
    ];
    return options.parentMatrix ? multiplyMatrix(options.parentMatrix, local) : local;
  }

  function quaternionMatrix(position, quaternion, scale) {
    const p = position || { x: 0, y: 0, z: 0 }, q = quaternion || { x: 0, y: 0, z: 0, w: 1 }, s = scale || { x: 1, y: 1, z: 1 };
    if (![p.x, p.y, p.z, q.x, q.y, q.z, q.w, s.x, s.y, s.z].every(finite)) return null;
    const x2 = q.x + q.x, y2 = q.y + q.y, z2 = q.z + q.z;
    const xx = q.x * x2, xy = q.x * y2, xz = q.x * z2, yy = q.y * y2, yz = q.y * z2, zz = q.z * z2;
    const wx = q.w * x2, wy = q.w * y2, wz = q.w * z2;
    return [
      (1 - yy - zz) * s.x, (xy + wz) * s.x, (xz - wy) * s.x, 0,
      (xy - wz) * s.y, (1 - xx - zz) * s.y, (yz + wx) * s.y, 0,
      (xz + wy) * s.z, (yz - wx) * s.z, (1 - xx - yy) * s.z, 0,
      p.x, p.y, p.z, 1,
    ];
  }

  function objectWorldMatrix(object) {
    if (!object) return null;
    const explicit = matrixValues(object.worldMatrix);
    if (explicit && explicit.length >= 16) return Array.from(explicit);
    const entity = object.entity || object;
    if (entity.position && entity.scale) return quaternionMatrix(entity.position, entity.quaternion, entity.scale);
    return null;
  }

  function transformPoint(matrixValue, point) {
    const m = matrixValues(matrixValue);
    if (!m || m.length < 16 || !finitePoint(point)) return null;
    const x = m[0] * point.x + m[4] * point.y + m[12];
    const y = m[1] * point.x + m[5] * point.y + m[13];
    return finite(x) && finite(y) ? { x, y } : null;
  }

  function worldToLocal(matrixValue, point) {
    const m = matrixValues(matrixValue);
    if (!m || m.length < 16 || !finitePoint(point)) return null;
    const determinant = m[0] * m[5] - m[4] * m[1];
    if (!finite(determinant) || Math.abs(determinant) <= EPSILON) return null;
    const x = point.x - m[12], y = point.y - m[13];
    return { x: (m[5] * x - m[4] * y) / determinant, y: (-m[1] * x + m[0] * y) / determinant };
  }

  function aabbFromPoints(points) {
    if (!Array.isArray(points) || points.length < 1 || points.some((point) => !finitePoint(point))) return null;
    return Object.freeze({
      minX: Math.min(...points.map((point) => point.x)), minY: Math.min(...points.map((point) => point.y)),
      maxX: Math.max(...points.map((point) => point.x)), maxY: Math.max(...points.map((point) => point.y)),
    });
  }

  function validComponent(component, kind) {
    if (!component || component.enabled === false || ![1, 2].includes(component.version) || !Array.isArray(component.offset) || component.offset.length < 2 || !component.offset.slice(0, 2).every(finite)) return false;
    if (kind === 'box') return Array.isArray(component.size) && component.size.length >= 2 && component.size.slice(0, 2).every((value) => finite(value) && value > 0);
    return kind === 'circle' && finite(component.radius) && component.radius > 0;
  }

  function resolveCollider2DWorldShape(object, component, requestedKind) {
    const kind = requestedKind || (component && component.size ? 'box' : component && finite(component.radius) ? 'circle' : null);
    if (!validComponent(component, kind)) return null;
    const matrix = objectWorldMatrix(object);
    if (!matrix) return null;
    const basisX = Math.hypot(matrix[0], matrix[1], matrix[2] || 0);
    const basisY = Math.hypot(matrix[4], matrix[5], matrix[6] || 0);
    if (!finite(basisX) || !finite(basisY) || basisX <= EPSILON || basisY <= EPSILON) return null;
    const center = transformPoint(matrix, { x: component.offset[0], y: component.offset[1] });
    if (!center) return null;
    if (kind === 'circle') {
      const radius = component.radius * Math.max(basisX, basisY);
      if (!finite(radius) || radius <= EPSILON) return null;
      return Object.freeze({ kind: 'circle', componentId: CIRCLE_ID, filter: Filters.filterOf(component), center: copyPoint(center), radius, aabb: Object.freeze({ minX: center.x - radius, minY: center.y - radius, maxX: center.x + radius, maxY: center.y + radius }) });
    }
    const halfWidth = component.size[0] / 2, halfHeight = component.size[1] / 2;
    // Stable local order: bottom-left, bottom-right, top-right, top-left.
    // Mirroring may reverse world winding but never changes point identity.
    const local = [
      { x: component.offset[0] - halfWidth, y: component.offset[1] - halfHeight },
      { x: component.offset[0] + halfWidth, y: component.offset[1] - halfHeight },
      { x: component.offset[0] + halfWidth, y: component.offset[1] + halfHeight },
      { x: component.offset[0] - halfWidth, y: component.offset[1] + halfHeight },
    ];
    const points = local.map((point) => transformPoint(matrix, point));
    const aabb = aabbFromPoints(points);
    if (!aabb) return null;
    return Object.freeze({ kind: 'box', componentId: BOX_ID, filter: Filters.filterOf(component), points: Object.freeze(points.map(copyPoint)), aabb });
  }

  function enumerateCollider2DWorldShapes(object) {
    const bag = object && object.components || {};
    return [
      resolveCollider2DWorldShape(object, bag[BOX_ID], 'box'),
      resolveCollider2DWorldShape(object, bag[CIRCLE_ID], 'circle'),
    ].filter(Boolean);
  }

  function aabbOverlaps(a, b, epsilon = EPSILON) {
    return !!a && !!b && a.maxX + epsilon >= b.minX && b.maxX + epsilon >= a.minX && a.maxY + epsilon >= b.minY && b.maxY + epsilon >= a.minY;
  }

  function project(points, axis) {
    let min = Infinity, max = -Infinity;
    for (const point of points) { const value = point.x * axis.x + point.y * axis.y; min = Math.min(min, value); max = Math.max(max, value); }
    return { min, max };
  }

  function boxBoxOverlaps(a, b, epsilon = EPSILON) {
    if (!a || !b || a.kind !== 'box' || b.kind !== 'box' || !aabbOverlaps(a.aabb, b.aabb, epsilon)) return false;
    for (const points of [a.points, b.points]) for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      const dx = q.x - p.x, dy = q.y - p.y, length = Math.hypot(dx, dy);
      if (length <= EPSILON) return false;
      const axis = { x: -dy / length, y: dx / length };
      const pa = project(a.points, axis), pb = project(b.points, axis);
      if (pa.max + epsilon < pb.min || pb.max + epsilon < pa.min) return false;
    }
    return true;
  }

  function circleCircleOverlaps(a, b, epsilon = EPSILON) {
    if (!a || !b || a.kind !== 'circle' || b.kind !== 'circle' || !aabbOverlaps(a.aabb, b.aabb, epsilon)) return false;
    const dx = a.center.x - b.center.x, dy = a.center.y - b.center.y, radius = a.radius + b.radius + epsilon;
    return dx * dx + dy * dy <= radius * radius;
  }

  function pointInConvexBox(point, box, epsilon = EPSILON) {
    if (!finitePoint(point) || !box || box.kind !== 'box') return false;
    let sign = 0;
    for (let i = 0; i < box.points.length; i++) {
      const a = box.points[i], b = box.points[(i + 1) % box.points.length];
      const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      if (Math.abs(cross) <= epsilon) continue;
      const current = Math.sign(cross);
      if (sign && current !== sign) return false;
      sign = current;
    }
    return true;
  }

  function segmentDistanceSquared(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= EPSILON * EPSILON) return (point.x - a.x) ** 2 + (point.y - a.y) ** 2;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    const x = a.x + t * dx, y = a.y + t * dy;
    return (point.x - x) ** 2 + (point.y - y) ** 2;
  }

  function boxCircleOverlaps(box, circle, epsilon = EPSILON) {
    if (!box || !circle || box.kind !== 'box' || circle.kind !== 'circle' || !aabbOverlaps(box.aabb, circle.aabb, epsilon)) return false;
    if (pointInConvexBox(circle.center, box, epsilon)) return true;
    const radiusSquared = (circle.radius + epsilon) ** 2;
    for (let i = 0; i < box.points.length; i++) if (segmentDistanceSquared(circle.center, box.points[i], box.points[(i + 1) % box.points.length]) <= radiusSquared) return true;
    return false;
  }

  function overlaps(a, b, epsilon = EPSILON) {
    if (!a || !b || !finite(epsilon) || epsilon < 0) return false;
    if (a.kind === 'box' && b.kind === 'box') return boxBoxOverlaps(a, b, epsilon);
    if (a.kind === 'circle' && b.kind === 'circle') return circleCircleOverlaps(a, b, epsilon);
    if (a.kind === 'box' && b.kind === 'circle') return boxCircleOverlaps(a, b, epsilon);
    if (a.kind === 'circle' && b.kind === 'box') return boxCircleOverlaps(b, a, epsilon);
    return false;
  }

  function visualLocalBounds(object) {
    const sprite = object && object.components && object.components['sprite-renderer'];
    if (sprite && finite(sprite.width) && sprite.width > 0 && finite(sprite.height) && sprite.height > 0) {
      const pivotX = finite(sprite.pivotX) ? sprite.pivotX : 0.5, pivotY = finite(sprite.pivotY) ? sprite.pivotY : 0.5;
      return { center: [(0.5 - pivotX) * sprite.width, (0.5 - pivotY) * sprite.height], width: sprite.width, height: sprite.height, source: 'sprite' };
    }
    if (object && object.kind === 'cube') return { center: [0, 0], width: 1, height: 1, source: 'mesh-unit-bounds' };
    return null;
  }

  function fitToVisual(object, kind) {
    const bounds = visualLocalBounds(object);
    if (!bounds) return null;
    return kind === 'circle'
      ? { offset: bounds.center.slice(), radius: Math.max(MIN_SIZE, Math.min(bounds.width, bounds.height) / 2), source: bounds.source, policy: 'inscribed' }
      : { offset: bounds.center.slice(), size: [bounds.width, bounds.height], source: bounds.source };
  }

  function editBoxFromLocalHandle(component, handle, localPoint) {
    if (!validComponent(component, 'box') || !finitePoint(localPoint)) return null;
    if (handle === 'center') return { offset: [localPoint.x, localPoint.y], size: component.size.slice() };
    let left = component.offset[0] - component.size[0] / 2, right = component.offset[0] + component.size[0] / 2;
    let bottom = component.offset[1] - component.size[1] / 2, top = component.offset[1] + component.size[1] / 2;
    if (handle.includes('w')) left = Math.min(localPoint.x, right - MIN_SIZE);
    if (handle.includes('e')) right = Math.max(localPoint.x, left + MIN_SIZE);
    if (handle.includes('s')) bottom = Math.min(localPoint.y, top - MIN_SIZE);
    if (handle.includes('n')) top = Math.max(localPoint.y, bottom + MIN_SIZE);
    return { offset: [(left + right) / 2, (bottom + top) / 2], size: [right - left, top - bottom] };
  }

  function editCircleFromLocalHandle(component, handle, localPoint) {
    if (!validComponent(component, 'circle') || !finitePoint(localPoint)) return null;
    if (handle === 'center') return { offset: [localPoint.x, localPoint.y], radius: component.radius };
    return { offset: component.offset.slice(), radius: Math.max(MIN_SIZE, Math.hypot(localPoint.x - component.offset[0], localPoint.y - component.offset[1])) };
  }

  return Object.freeze({
    EPSILON, MIN_SIZE, BOX_ID, CIRCLE_ID, identityMatrix, multiplyMatrix, composeMatrix, objectWorldMatrix, transformPoint, worldToLocal,
    aabbFromPoints, resolveCollider2DWorldShape, enumerateCollider2DWorldShapes, aabbOverlaps, boxBoxOverlaps, circleCircleOverlaps,
    boxCircleOverlaps, pointInConvexBox, overlaps, visualLocalBounds, fitToVisual, editBoxFromLocalHandle, editCircleFromLocalHandle,
  });
});
