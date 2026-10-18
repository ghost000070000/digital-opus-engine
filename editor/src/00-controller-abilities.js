// Phase 119: transient tuning/input composition, never a movement solver.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusControllerAbilities = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const positive = value => Number.isFinite(value) && value > 0;
  const present = (bag, key) => Object.prototype.hasOwnProperty.call(bag, key);
  function validRecord(record) {
    return !!record && record.version === 1 && typeof record.enabled === 'boolean' &&
      typeof record.inputActionRef === 'string' && record.inputActionRef.trim().length > 0;
  }
  function readAction(callback, id) {
    if (typeof callback !== 'function') return undefined;
    try { const value = callback(id); return typeof value === 'boolean' ? value : undefined; }
    catch (_) { return undefined; }
  }
  /**
   * resolveControllerAbilities({family,components,controller}, {actionDown,actionPressed})
   * returns fresh transient {speed,gravity,jumpSpeed,jumpEnabled,jumpPressed} tuning.
   * controller is the authored 2D controller record (moveSpeed, gravity, jumpSpeed,
   * jumpActionRef). Callbacks return booleans for available canonical Actions and
   * undefined for unavailable Actions. No bindings, records, Body or Transform mutate.
   * Absent Jump preserves historical platformer input; a present invalid/disabled
   * Jump explicitly suppresses launches. Invalid Sprint retains ordinary base speed.
   * Unsupported legacy families are inert; their existing settings remain authoritative.
   */
  function resolveControllerAbilities(source, input) {
    source = source || {}; input = input || {};
    const controller = source.controller || {}, bag = source.components || {};
    const platformer = source.family === 'platformer2d';
    const supported = platformer || source.family === 'topdown2d';
    const result = { speed: supported && positive(controller.moveSpeed) ? controller.moveSpeed : 0,
      gravity: platformer && positive(controller.gravity) ? controller.gravity : 0,
      jumpSpeed: platformer && positive(controller.jumpSpeed) ? controller.jumpSpeed : 0,
      jumpEnabled: false, jumpPressed: false };
    if (!supported) return result;
    if (platformer) {
      if (!present(bag, 'jump-ability')) {
        result.jumpEnabled = true;
        result.jumpPressed = readAction(input.actionPressed, controller.jumpActionRef) === true;
      } else {
        const jump = bag['jump-ability'];
        if (validRecord(jump) && jump.enabled && positive(jump.jumpSpeed)) {
          const pressed = readAction(input.actionPressed, jump.inputActionRef);
          if (pressed !== undefined) {
            result.jumpEnabled = true; result.jumpPressed = pressed;
            result.jumpSpeed = jump.jumpSpeed;
          }
        }
      }
    }
    const sprint = bag['sprint-ability'];
    if (validRecord(sprint) && sprint.enabled && Number.isFinite(sprint.speedMultiplier) && sprint.speedMultiplier >= 1 &&
        readAction(input.actionDown, sprint.inputActionRef) === true) {
      const speed = result.speed * sprint.speedMultiplier;
      if (positive(speed)) result.speed = speed;
    }
    return result;
  }
  return Object.freeze({ resolveControllerAbilities });
});
