// Phase 116: input/gravity intent only. Body2D remains the sole movement solver.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusPlatformerController2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function validConfig(config) {
    return !!config && ['speed', 'gravity', 'jumpSpeed'].every(key =>
      Number.isFinite(config[key]) && config[key] > 0) &&
      (config.jumpEnabled === undefined || typeof config.jumpEnabled === 'boolean');
  }
  function knownContact(contact) {
    return !!contact && contact.active === true &&
      ['grounded', 'ceiling', 'wallLeft', 'wallRight'].every(key => typeof contact[key] === 'boolean');
  }
  /**
   * prepare(config, {left,right,jumpPressed}, dtSeconds, priorCanonicalContact,
   *         {paused,frozen}) returns a fresh [vx,vy] for the sole Body2D tick.
   * resolve(postTickCanonicalContact) consumes that tick's actual contact state.
   * reset() clears all transient intent/contact/jump state for lifecycle changes.
   * Optional config.jumpEnabled=false prevents launches and clears a pending first
   * contact Jump without resetting airborne velocity/gravity. Absence preserves Jump.
   * Neither method owns position, collision geometry, nor serialized components.
   */
  function createPlatformerController2D() {
    let vx = 0, vy = 0, contact = null, pendingInitialJump = false;
    function reset() { vx = 0; vy = 0; contact = null; pendingInitialJump = false; }
    function prepare(config, input, dt, priorContact, lifecycle) {
      if (!validConfig(config) || !Number.isFinite(dt) || dt <= 0 || !input ||
          ['left', 'right', 'jumpPressed'].some(key => typeof input[key] !== 'boolean') ||
          (lifecycle && (lifecycle.paused || lifecycle.frozen))) {
        reset(); return [0, 0];
      }
      if (knownContact(priorContact)) contact = { ...priorContact };
      const grounded = !!contact && contact.grounded;
      const jumpEnabled = config.jumpEnabled !== false;
      if (!jumpEnabled) pendingInitialJump = false;
      if (jumpEnabled && input.jumpPressed && !contact) pendingInitialJump = true;
      const jump = jumpEnabled && grounded && (input.jumpPressed || pendingInitialJump);
      if (contact) pendingInitialJump = false;
      if (grounded && vy < 0) vy = 0;
      if (jump) vy = config.jumpSpeed;
      vx = (Number(input.right) - Number(input.left)) * config.speed;
      // Return average velocity for this interval; retain end-of-interval velocity.
      // This makes free fall independent of monitor/frame partition, without substeps.
      const nextVy = vy - config.gravity * dt;
      const requestedVy = (vy + nextVy) / 2;
      if (!Number.isFinite(nextVy) || !Number.isFinite(requestedVy) || !Number.isFinite(vx)) {
        reset(); return [0, 0];
      }
      vy = nextVy;
      return [vx, requestedVy];
    }
    function resolve(actualContact) {
      if (!knownContact(actualContact)) { reset(); return; }
      contact = { ...actualContact };
      if ((contact.grounded && vy < 0) || (contact.ceiling && vy > 0)) vy = 0;
      if ((contact.wallLeft && vx < 0) || (contact.wallRight && vx > 0)) vx = 0;
    }
    function getState() {
      return { velocity: [vx, vy], contactKnown: !!contact,
        grounded: !!contact && contact.grounded, pendingInitialJump };
    }
    return Object.freeze({ prepare, resolve, reset, getState });
  }
  return Object.freeze({ createPlatformerController2D, validConfig });
});
