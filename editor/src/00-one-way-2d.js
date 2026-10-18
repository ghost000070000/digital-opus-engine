// Phase 046: horizontal top-surface geometry for Character-only one-way collision.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusOneWay2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HORIZONTAL_SINE_TOLERANCE = 0.01;
  const SUPPORT_TOLERANCE = 0.000101;
  function horizontalTop(shape) {
    if (!shape || shape.kind !== 'box' || !Array.isArray(shape.points) || shape.points.length !== 4) return null;
    // Only edges originating from local horizontal Box edges are eligible.
    // Mirroring can swap which one is world-top; a 90-degree rotation cannot
    // silently turn a local side into a Phase 047 slope/support surface.
    const edges = [[shape.points[0], shape.points[1]], [shape.points[2], shape.points[3]]];
    const mid = (edge) => (edge[0].y + edge[1].y) / 2;
    const [top, bottom] = mid(edges[0]) >= mid(edges[1]) ? edges : [edges[1], edges[0]];
    const dx = Math.abs(top[0].x - top[1].x), dy = Math.abs(top[0].y - top[1].y);
    const topY = mid(top);
    if (!(dx > 1e-8) || dy > dx * HORIZONTAL_SINE_TOLERANCE || !(topY > (bottom[0].y + bottom[1].y) / 2 + 1e-8)) return null;
    return Object.freeze({ y: topY, minX: Math.min(top[0].x, top[1].x), maxX: Math.max(top[0].x, top[1].x) });
  }
  function horizontalOverlap(shape, top, dx = 0) {
    return shape.aabb.maxX + dx > top.minX + 1e-8 && shape.aabb.minX + dx < top.maxX - 1e-8;
  }
  function crossing(shapes, platforms, dx, dy) {
    if (!(dy < 0)) return null;
    let best = null;
    for (const platform of platforms || []) {
      if (!platform.top) continue;
      for (const shape of shapes || []) {
        if (platform.acceptsShape && !platform.acceptsShape(shape)) continue;
        const bottom = shape.aabb.minY;
        if (bottom < platform.top.y - SUPPORT_TOLERANCE) continue;
        const fraction = Math.max(0, (bottom - platform.top.y) / -dy);
        if (fraction > 1 + 1e-9 || !horizontalOverlap(shape, platform.top, dx * fraction)) continue;
        const id = String(platform.object.id);
        if (!best || fraction < best.fraction - 1e-9 || (Math.abs(fraction - best.fraction) <= 1e-9 && id < best.id)) best = { fraction: Math.min(1, fraction), id };
      }
    }
    return best && Object.freeze(best);
  }
  function supported(shapes, platforms, probeDistance) {
    for (const platform of platforms || []) if (platform.top) for (const shape of shapes || []) {
      if (platform.acceptsShape && !platform.acceptsShape(shape)) continue;
      const gap = shape.aabb.minY - platform.top.y;
      if (gap >= -SUPPORT_TOLERANCE && gap <= probeDistance + SUPPORT_TOLERANCE && horizontalOverlap(shape, platform.top)) return true;
    }
    return false;
  }
  return Object.freeze({ HORIZONTAL_SINE_TOLERANCE, SUPPORT_TOLERANCE, horizontalTop, crossing, supported });
});
