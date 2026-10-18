// Phase 048: the deliberately small Moving Platform 2D role contract.
// Motion remains owned by Body 2D; this module only answers whether a
// Kinematic Box explicitly participates in Character support/carry.
(function (root, factory) {
  'use strict';
  const collider = typeof module !== 'undefined' && module.exports ? require('./00-collider-2d.js') : root.OpusCollider2D;
  const api = factory(collider);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusMovingPlatform2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Collider2D) {
  'use strict';
  const COMPONENT_ID = 'moving-platform-2d';
  function validComponent(component) {
    return !!component && component.version === 1 && typeof component.enabled === 'boolean';
  }
  function boxShape(object) {
    const box = object && object.components && object.components['box-collider-2d'];
    return box && box.enabled === true ? Collider2D.resolveCollider2DWorldShape(object, box, 'box') : null;
  }
  function eligible(object) {
    const bag = object && object.components || {};
    const component = bag[COMPONENT_ID], body = bag['body-2d'];
    return validComponent(component) && component.enabled === true && !!body && body.version === 1 && body.enabled === true &&
      body.type === 'kinematic' && Array.isArray(body.linearVelocity) && body.linearVelocity.length === 2 &&
      body.linearVelocity.every(Number.isFinite) && !!boxShape(object);
  }
  function oneWay(object) {
    const component = object && object.components && object.components['one-way-platform-2d'];
    return !!component && component.version === 1 && component.enabled === true;
  }
  return Object.freeze({ COMPONENT_ID, validComponent, boxShape, eligible, oneWay });
});
