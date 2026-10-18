// Phase 117: transient four-way XY intent; Body2D owns all admitted movement.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusTopDownController2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function validConfig(config) { return !!config && Number.isFinite(config.speed) && config.speed > 0; }
  function createTopDownController2D() {
    let velocity = [0, 0];
    function reset() { velocity = [0, 0]; }
    // Named actions are resolved by the host, not by this pure intent service.
    // dt is seconds and is validated only: Body2D applies time exactly once.
    function prepare(config, input, dt, lifecycle) {
      if (!validConfig(config) || !Number.isFinite(dt) || dt <= 0 || !input ||
          ['left', 'right', 'up', 'down'].some(key => typeof input[key] !== 'boolean') ||
          (lifecycle && (lifecycle.paused || lifecycle.frozen))) {
        reset(); return velocity.slice();
      }
      const x = Number(input.right) - Number(input.left);
      const y = Number(input.up) - Number(input.down);
      const length = Math.hypot(x, y);
      velocity = length ? [x / length * config.speed, y / length * config.speed] : [0, 0];
      return velocity.slice();
    }
    function getState() { return { velocity: velocity.slice() }; }
    // Diagnostics reflect actual admitted contacts. Next prepare samples fresh
    // input; this response never feeds a second movement pass or stores position.
    function resolve(contact) {
      if (!contact || contact.active !== true ||
          ['grounded', 'ceiling', 'wallLeft', 'wallRight'].some(key => typeof contact[key] !== 'boolean')) {
        reset(); return;
      }
      if ((contact.wallLeft && velocity[0] < 0) || (contact.wallRight && velocity[0] > 0)) velocity[0] = 0;
      if ((contact.grounded && velocity[1] < 0) || (contact.ceiling && velocity[1] > 0)) velocity[1] = 0;
    }
    return Object.freeze({ prepare, resolve, reset, getState });
  }
  return Object.freeze({ createTopDownController2D, validConfig });
});
