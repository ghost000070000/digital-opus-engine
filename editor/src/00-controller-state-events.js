// Resolved controller edges only. Host dispatches through ordinary Behaviors.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusControllerStateEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FAMILIES = Object.freeze(['platformer2d', 'topdown2d', 'firstperson', 'thirdperson', 'topdown', 'hovercraft']);
  const EVENTS = Object.freeze(['moving', 'idle', 'airborne', 'landed']);
  const MOTION_SPEED_EPSILON = 0.001;
  function createControllerStateEvents(options = {}) {
    const emit = typeof options.emit === 'function' ? options.emit : () => {};
    const isCurrent = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
    let previous = null, revision = 0, resumeSeed = false;
    function reset() { previous = null; resumeSeed = false; revision++; }
    function valid(sample, dt) {
      return !!sample && !!sample.owner && Number.isSafeInteger(sample.session) && sample.session >= 0 &&
        FAMILIES.includes(sample.family) && Array.isArray(sample.position) && sample.position.length === 3 &&
        sample.position.every(Number.isFinite) && Number.isFinite(dt) && dt > 0 &&
        (sample.grounded === null || typeof sample.grounded === 'boolean');
    }
    function grounding(sample) {
      return ['topdown2d', 'topdown', 'hovercraft'].includes(sample.family) ? null : sample.grounded;
    }
    function getState() {
      return previous ? { owner: previous.owner, session: previous.session, family: previous.family,
        position: previous.position.slice(), moving: previous.moving, grounded: previous.grounded } : null;
    }
    /** sample({owner,session,family,position:[x,y,z],grounded:boolean|null},
     * dtSeconds, {paused}) observes one post-collision pose. New ownership and
     * initial/pause samples seed silently. Carry counts as actual movement;
     * Platformer vertical gravity does not. No input, solver or pose mutation.
     */
    function sample(value, dt, lifecycle) {
      const token = ++revision;
      if (!valid(value, dt) || !isCurrent(value)) { reset(); return null; }
      const old = previous;
      const same = old && old.owner === value.owner && old.session === value.session && old.family === value.family;
      let moving = false;
      if (same) {
        const dx = value.position[0] - old.position[0], dy = value.position[1] - old.position[1], dz = value.position[2] - old.position[2];
        const distance = value.family === 'platformer2d' ? Math.abs(dx) : value.family === 'topdown2d' ? Math.hypot(dx, dy) : Math.hypot(dx, dz);
        const speed = distance / dt;
        if (!Number.isFinite(speed)) { reset(); return null; }
        moving = speed > MOTION_SPEED_EPSILON;
      }
      previous = { owner: value.owner, session: value.session, family: value.family,
        position: value.position.slice(), moving, grounded: grounding(value) };
      if (lifecycle && lifecycle.paused) { resumeSeed = true; previous.moving = false; return getState(); }
      if (resumeSeed) { resumeSeed = false; previous.moving = false; return getState(); }
      if (!same) return getState();
      const edges = [];
      if (moving !== old.moving) edges.push(moving ? 'moving' : 'idle');
      if (old.grounded !== null && previous.grounded !== null && previous.grounded !== old.grounded)
        edges.push(previous.grounded ? 'landed' : 'airborne');
      for (const event of edges) {
        if (revision !== token || !isCurrent(value)) break;
        const payload = Object.freeze({ event, owner: value.owner, session: value.session, family: value.family,
          position: Object.freeze(value.position.slice()), moving, grounded: previous.grounded });
        emit(payload);
        if (revision !== token || !isCurrent(value)) break;
      }
      return getState();
    }
    return Object.freeze({ sample, reset, getState });
  }
  return Object.freeze({ createControllerStateEvents, FAMILIES, EVENTS, MOTION_SPEED_EPSILON });
});
