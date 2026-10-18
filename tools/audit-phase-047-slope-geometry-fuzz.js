'use strict';
// Deterministic independent geometry audit; no project or user data is mutated.
const assert = require('assert');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Slope = require('../editor/src/00-character-slope-2d.js');
let seed = 0x4700cafe;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function between(a, b) { return a + (b - a) * random(); }
function box(x, y, width, height, rotation, scaleX, scaleY) {
  return Collider.enumerateCollider2DWorldShapes({ worldMatrix: Collider.composeMatrix({ position: [x, y, 0], rotation, scale: [scaleX, scaleY, 1] }),
    components: { 'box-collider-2d': { version: 1, enabled: true, size: [width, height], offset: [0, 0] } } })[0];
}
function projections(points, axis) { const values = points.map((p) => p.x * axis.x + p.y * axis.y); return [Math.min(...values), Math.max(...values)]; }
function referencePolygonOverlap(a, b) {
  for (const points of [a, b]) for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const axis = { x: q.y - p.y, y: p.x - q.x };
    const u = projections(a, axis), v = projections(b, axis);
    if (u[1] < v[0] - 1e-8 || v[1] < u[0] - 1e-8) return false;
  }
  return true;
}
const geometryCases = Number(process.argv[2]) || 500000;
const overlapCases = Number(process.argv[3]) || 250000;
for (let i = 0; i < geometryCases; i++) {
  const width = between(.05, 8), height = between(.05, 5), rotation = between(-1.55, 1.55);
  const shape = box(between(-10, 10), between(-10, 10), width, height, rotation, random() < .5 ? -1 : 1, random() < .5 ? -1 : 1);
  const surface = Slope.surfaceFromShape(shape, `box-${i}`);
  assert(surface && Number.isFinite(surface.angle) && Number.isFinite(surface.normal.x) && Number.isFinite(surface.normal.y));
  assert(surface.normal.y > 0 && surface.p0.x < surface.p1.x);
  assert.strictEqual(Slope.walkable(surface, 50), surface.angle <= 50 + 1e-7);
  assert(Number.isFinite(Slope.supportProjection(shape, surface.normal, surface)));
  const direction = random() < .5 ? 'up-right' : 'up-left';
  const triangle = Slope.trianglePoints(direction, 0, 0, width, height);
  const tileSurface = Slope.surfaceFromShape({ points: triangle }, `tile-${i}`);
  assert(tileSurface && Number.isFinite(tileSurface.angle) && tileSurface.normal.y > 0);
  assert(Math.abs(tileSurface.angle - Math.atan2(height, width) * 180 / Math.PI) < 1e-8);
}
for (let i = 0; i < overlapCases; i++) {
  const triangle = Slope.trianglePoints(random() < .5 ? 'up-right' : 'up-left', 0, 0, between(.1, 4), between(.1, 4));
  const mover = box(between(-3, 6), between(-3, 6), between(.1, 2), between(.1, 2), between(-1.4, 1.4), 1, 1);
  const polygon = { kind: 'polygon', points: triangle, aabb: { minX: 0, minY: 0, maxX: Math.max(...triangle.map((p) => p.x)), maxY: Math.max(...triangle.map((p) => p.y)) } };
  const separation = Body.separation(mover, polygon);
  assert(Number.isFinite(separation));
  const expected = referencePolygonOverlap(mover.points, triangle);
  if (Math.abs(separation) > 1e-7) assert.strictEqual(separation < 0, expected, `case ${i}: ${separation}`);
}
console.log(JSON.stringify({ audit: 'phase-047-slope-geometry', seed: '0x4700cafe', geometryCases, overlapCases, passed: true }));
