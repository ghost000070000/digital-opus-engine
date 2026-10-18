'use strict';
const assert = require('assert');
const authoring = require('../editor/src/00-authoring-schema.js');
const fields = require('../editor/src/00-inspector-fields.js');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const ID = 'platformer-controller-2d';
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  PASS ' + name); } catch (error) { process.exitCode = 1; console.error('  FAIL ' + name + '\n' + error.stack); } }
function sprite() {
  const target = { id: 'player-sprite', kind: 'sprite' };
  for (const id of ['box-collider-2d', 'body-2d', 'character-collision-2d', ID]) assert(authoring.addComponent(target, id).ok);
  target.components['body-2d'].type = 'kinematic';
  return target;
}
test('explicit Sprite applicability and exact versioned defaults', () => {
  const target = sprite();
  assert.deepStrictEqual(target.components[ID], { version: 1, enabled: true, moveSpeed: 5, gravity: 20, jumpSpeed: 8, moveLeftActionRef: 'moveLeft', moveRightActionRef: 'moveRight', jumpActionRef: 'jump' });
  assert.strictEqual(authoring.addComponent({ kind: 'cube' }, ID).ok, false);
  assert.strictEqual(authoring.addComponent(target, ID).code, 'already-added');
  assert.deepStrictEqual(authoring.validateComponent(target, ID), []);
});
test('typed Action descriptor renders supplied canonical names, not free text', () => {
  const actions = new Map([['moveLeft', 'Move Left'], ['moveRight', 'Move Right'], ['jump', 'Jump'], ['custom-action-1', 'Leap']]);
  const descriptor = fields.descriptor(authoring.registry.get(ID).fields.find(field => field.key === 'jumpActionRef'));
  assert.strictEqual(descriptor.referenceType, 'inputAction');
  assert(fields.FIELD_TYPES.includes('inputActionRef'));
  const html = fields.controlHtml(descriptor, 'custom-action-1', [...actions].map(([value, label]) => ({ value, label })));
  assert(html.includes('<select'));
  assert(html.includes('value="custom-action-1" selected'));
  assert(html.includes('Leap'));
  assert(!html.includes('type="text"'));
});
test('Action options and identity resolution use only the supplied canonical registry', () => {
  const actions = [{ id: 'moveLeft', name: 'Move Left' }, { id: 'moveRight', name: 'Move Right' }, { id: 'jump', name: 'Jump' }, { id: 'custom-action-1', name: 'Leap' }];
  assert.deepStrictEqual(plumbing.getReferenceOptions('inputAction', { inputActions: actions }).map(({ value, label }) => ({ value, label })), [
    { value: 'jump', label: 'Jump' }, { value: 'custom-action-1', label: 'Leap' }, { value: 'moveLeft', label: 'Move Left' }, { value: 'moveRight', label: 'Move Right' },
  ]);
  assert.deepStrictEqual(plumbing.getReferenceOptions('inputAction', {}), []);
  const target = sprite(); target.components[ID].jumpActionRef = 'custom-action-1';
  const project = { levels: [{ id: 'level-1', objects: [target] }] };
  const index = plumbing.buildReferenceIndex(project, { schemaRegistry: authoring.registry, inputActions: actions });
  assert.strictEqual(index.maps.inputAction.get('custom-action-1').name, 'Leap');
  assert.strictEqual(index.uses.filter(use => use.referenceType === 'inputAction').length, 3);
  assert.deepStrictEqual(index.dangling.filter(use => use.referenceType === 'inputAction'), []);
  target.components[ID].jumpActionRef = 'missing-action';
  const missing = plumbing.buildReferenceIndex(project, { schemaRegistry: authoring.registry, inputActions: actions });
  assert(missing.dangling.some(use => use.referenceType === 'inputAction' && use.field === 'jumpActionRef' && use.referenceValue === 'missing-action'));
  assert.strictEqual(target.components[ID].jumpActionRef, 'missing-action');
  const duplicates = plumbing.buildReferenceIndex(project, { schemaRegistry: authoring.registry, inputActions: [...actions, { id: 'jump', name: 'Duplicate Jump' }] });
  assert(duplicates.duplicates.some(entry => entry.type === 'inputAction' && entry.value === 'jump'));
});
test('malformed records remain raw across display, export and Prefab-style copy', () => {
  const malformed = { version: 1, enabled: 'yes', moveSpeed: '5', gravity: 0, jumpSpeed: null, moveLeftActionRef: { id: 'moveLeft' }, moveRightActionRef: '', jumpActionRef: 42, creatorExtension: { retain: true } };
  const source = { kind: 'sprite', components: { [ID]: malformed } };
  const expected = JSON.parse(JSON.stringify(malformed));
  authoring.ensureComponent(source, ID);
  assert.deepStrictEqual(source.components[ID], expected);
  const saved = authoring.serializeComponents(source);
  assert.deepStrictEqual(saved[ID], expected);
  const instance = { kind: 'sprite' };
  authoring.applyRecord({ components: saved }, instance);
  assert.deepStrictEqual(instance.components[ID], expected);
  assert(authoring.validateComponent(instance, ID).some(issue => issue.code === 'platformer-enabled'));
  assert(authoring.validateComponent(instance, ID).some(issue => issue.code === 'platformer-input-action'));
});
test('future versions and unknown extensions survive without editing', () => {
  const record = { version: 9, enabled: true, futureVelocity: [10, 20], creatorExtension: 'retained' };
  const target = { kind: 'sprite', components: { [ID]: record } };
  assert.deepStrictEqual(authoring.serializeComponents(target)[ID], record);
  assert(authoring.validateComponent(target, ID).some(issue => issue.code === 'newer-version'));
  assert.strictEqual(authoring.applyComponentSettings(target, ID, { ...record, moveSpeed: 2 }).ok, false);
});
test('missing, disabled, malformed and future dependencies block controller authoring validity', () => {
  for (const [id, key, value, code] of [
    ['body-2d', 'type', 'static', 'platformer-needs-kinematic'],
    ['body-2d', 'enabled', false, 'platformer-needs-kinematic'],
    ['body-2d', 'version', 99, 'platformer-needs-kinematic'],
    ['box-collider-2d', 'size', [0, 1], 'platformer-needs-collider'],
    ['box-collider-2d', 'enabled', false, 'platformer-needs-collider'],
    ['character-collision-2d', 'enabled', false, 'platformer-needs-character'],
    ['character-collision-2d', 'maxSlopeAngle', 999, 'platformer-needs-character'],
  ]) {
    const target = sprite(); target.components[id][key] = value;
    assert(authoring.validateComponent(target, ID).some(issue => issue.code === code), id + '.' + key);
  }
  const target = sprite(); delete target.components['box-collider-2d']; authoring.addComponent(target, 'trigger-collider-2d');
  assert(authoring.validateComponent(target, ID).some(issue => issue.code === 'platformer-needs-collider'));
});
test('zero, negative, blank and nonfinite tuning do not get a playable default or Undo', () => {
  for (const value of [0, -1, '', null, NaN, Infinity, '5']) {
    const target = sprite(), before = JSON.stringify(target), candidate = { ...target.components[ID], moveSpeed: value };
    let undo = 0;
    assert.strictEqual(authoring.applyComponentSettings(target, ID, candidate, { onBeforeChange: () => undo++ }).ok, false);
    assert.strictEqual(undo, 0); assert.strictEqual(JSON.stringify(target), before);
  }
  const numeric = fields.descriptor(authoring.registry.get(ID).fields.find(field => field.key === 'moveSpeed'));
  assert.strictEqual(fields.validateValue(numeric, '0').valid, false);
  assert.strictEqual(fields.validateValue(numeric, '7.5').value, 7.5);
});
test('component copying is detached and never creates a level Player binding', () => {
  const source = sprite(), target = { kind: 'sprite', id: 'copy' };
  authoring.copyComponents(source, target);
  target.components[ID].moveSpeed = 9;
  assert.strictEqual(source.components[ID].moveSpeed, 5);
  assert.strictEqual(target.playerSettings, undefined);
  assert.strictEqual(target.platformerObjectRef, undefined);
});
console.log(`Phase 116 platformer schema: ${passed} passed.`);
