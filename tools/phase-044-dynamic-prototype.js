// Qualification-only Phase 044 model. The mover carries a temporary valid
// Phase 043 Kinematic Body solely to access the canonical Static response
// service; this module does not add Dynamic to the product schema/runtime.
(function (root, factory) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const body = node ? require('../editor/src/00-body-2d.js') : root.OpusBody2D;
  const collider = node ? require('../editor/src/00-collider-2d.js') : root.OpusCollider2D;
  const api = factory(body, collider);
  if (node) module.exports = api;
  else root.OpusPhase044Prototype = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Body2D, Collider2D) {
'use strict';

const finitePair = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

function createPrototype(mover, options = {}) {
  if (!mover || !mover.components || !mover.components['body-2d'] || mover.components['body-2d'].type !== 'kinematic') throw new Error('Qualification mover must use a Phase 043 Kinematic service adapter');
  const initialVelocity = options.initialVelocity || mover.components['body-2d'].linearVelocity;
  const gravity = options.gravity || [0, -9.81];
  if (!finitePair(initialVelocity) || !finitePair(gravity)) throw new Error('Velocity and gravity must be finite world-XY pairs');
  const manager = Body2D.createBody2DManager(options.translateWorld ? { translateWorld: options.translateWorld } : {});
  const velocity = initialVelocity.slice();
  let gravityIntegrations = 0;
  let rejectedTranslations = 0;
  function step(dt, staticObjects = [], triggerTick, cachedStaticEntries) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('dt must be finite and nonnegative');
    dt = Math.min(dt, .1); // canonical Phase 043 clock ceiling
    const next = [velocity[0] + gravity[0] * dt, velocity[1] + gravity[1] * dt];
    const requested = { x: velocity[0] * dt + .5 * gravity[0] * dt * dt, y: velocity[1] * dt + .5 * gravity[1] * dt * dt };
    const statics = cachedStaticEntries || staticObjects.filter((object) => Body2D.role(object, 'static')).map((object) => ({ object, shapes: Collider2D.enumerateCollider2DWorldShapes(object) })).filter((entry) => entry.shapes.length);
    if (!cachedStaticEntries) manager.metrics.staticShapeResolutions += statics.reduce((count, entry) => count + entry.shapes.length, 0);
    const move = manager.moveKinematicBody2D(mover, requested, statics);
    velocity[0] = move.blockedX ? 0 : next[0];
    velocity[1] = move.blockedY ? 0 : next[1];
    if ((requested.x || requested.y) && !move.blockedX && !move.blockedY && !move.actualDelta.x && !move.actualDelta.y) {
      // Parent inverse failed; do not silently accumulate unbounded speed.
      velocity[0] = 0; velocity[1] = 0; rejectedTranslations++;
    }
    gravityIntegrations++;
    if (typeof triggerTick === 'function') triggerTick();
    return { move, velocity: velocity.slice(), requestedDelta: requested, dt };
  }
  return { step, velocity, gravity: gravity.slice(), manager, get gravityIntegrations() { return gravityIntegrations; }, get rejectedTranslations() { return rejectedTranslations; } };
}

return Object.freeze({ createPrototype });
});
