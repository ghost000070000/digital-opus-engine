'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require.resolve('../editor/src/01-editor.js'), 'utf8');
function extract(name) {
  const start = source.indexOf('function ' + name + '('); assert(start >= 0);
  let i = source.indexOf('{', start) + 1, depth = 1;
  while (depth) { if (source[i] === '{') depth++; if (source[i] === '}') depth--; i++; }
  return source.slice(start, i);
}
function fixture() {
  const c = { placed: [], currentPlayerSettings: { controllerType: 'topdown2d', topdownObjectRef: 'sprite' },
    OpusAuthoring: require('../editor/src/00-authoring-schema.js'),
    OpusControllerAbilities: require('../editor/src/00-controller-abilities.js'),
    findInputAction: id => ['moveLeft', 'moveRight', 'moveForward', 'moveBack'].includes(id),
    topdown2DIntent: [4, 5], topdown2DController: { reset() { c.resets++; } }, resets: 0,
    player: null, teardownPlayerVisual() { c.visualTeardowns++; }, teardownPlayerEquipment() {},
    visualTeardowns: 0, PLAYER_CONTROLLERS: { hovercraft: { despawn() { c.legacyDespawns++; c.player = null; } } }, legacyDespawns: 0 };
  Object.assign(c,{controllerStateSession:0,controllerStateEvents:null});vm.createContext(c);vm.runInContext(extract('resetControllerStateEvents'),c);
  vm.runInContext(['topdownPlayerObject', 'collectTopdownPlayerIssues', 'resetTopdownPlayerIntent', 'despawnPlayer', 'resolvePlayerControllerAbilities', 'updatePlayerController'].map(extract).join('\n'), c);
  return c;
}
function validSprite(c) {
  const sprite = { id: 'sprite', kind: 'sprite', entity: { position: { x: 0, y: 1, z: 7,
    clone() { return { x: this.x, y: this.y, z: this.z }; } } } };
  for (const id of ['box-collider-2d', 'body-2d', 'character-collision-2d', 'topdown-controller-2d']) assert(c.OpusAuthoring.addComponent(sprite, id).ok, id + ' schema available');
  sprite.components['body-2d'].type = 'kinematic';
  Object.assign(sprite.components['character-collision-2d'], { wallSlideEnabled: false, slopeHandlingEnabled: false, stepHandlingEnabled: false });
  const record = sprite.components['topdown-controller-2d'];
  record.moveLeftActionRef = 'moveLeft'; record.moveRightActionRef = 'moveRight'; record.moveUpActionRef = 'moveForward'; record.moveDownActionRef = 'moveBack';
  return sprite;
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); } }
test('Actual despawn releases Top-down state but preserves authored Sprite', () => {
  const c = fixture(), sprite = { id: 'sprite', kind: 'sprite', entity: {} };
  c.placed = [sprite]; c.player = { controllerType: 'topdown2d', entity: sprite.entity };
  c.despawnPlayer(); assert.equal(c.player, null); assert.equal(c.topdown2DController, null);
  assert.equal(c.placed[0], sprite); assert.equal(c.resets, 1); assert.equal(c.visualTeardowns, 0);
});
test('Historical legacy entity teardown uses actual owned family despite new level settings', () => {
  const c = fixture(); c.player = { controllerType: 'hovercraft', entity: {} };
  c.despawnPlayer(); assert.equal(c.legacyDespawns, 1); assert.equal(c.player, null); assert.equal(c.visualTeardowns, 1);
});
test('Missing duplicate wrongkind malformed and future primarytargets stay inert', () => {
  const c = fixture(); assert.equal(c.topdownPlayerObject(), null);
  c.placed = [{ id: 'sprite', kind: 'cube', entity: {} }]; assert.equal(c.topdownPlayerObject(), null);
  const sprite = validSprite(c); c.placed = [sprite]; assert.equal(c.topdownPlayerObject(), sprite);
  c.placed.push({ ...sprite }); assert.equal(c.topdownPlayerObject(), null); c.placed = [sprite];
  c.currentPlayerSettings.topdownObjectRef = { id: 'sprite' }; assert.equal(c.topdownPlayerObject(), null);
  c.currentPlayerSettings.topdownObjectRef = 'sprite'; sprite.components['topdown-controller-2d'].version = 999;
  const before = JSON.stringify(sprite.components); assert.equal(c.topdownPlayerObject(), null); assert.equal(JSON.stringify(sprite.components), before);
});
test('Actual dispatcher maps canonical four actions without Transform or authored velocity writes', () => {
  const c = fixture(), sprite = validSprite(c), before = JSON.stringify(sprite.components);
  c.placed = [sprite]; c.player = { controllerType: 'topdown2d', entity: sprite.entity };
  c.topdown2DController = require('../editor/src/00-topdown-controller-2d.js').createTopDownController2D();
  c.playerFrozen = false; c.app = { paused: false };
  for (const [key, action, axis, sign] of [['left', 'moveLeft', 0, -1], ['right', 'moveRight', 0, 1], ['up', 'moveForward', 1, 1], ['down', 'moveBack', 1, -1]]) {
    c.inputActionDown = id => id === action; const previous = c.updatePlayerController(.01, 0);
    assert.equal(previous.y, 1); assert.equal(c.topdown2DIntent[axis], sign * sprite.components['topdown-controller-2d'].moveSpeed, key);
  }
  assert.equal(sprite.entity.position.x, 0); assert.equal(sprite.entity.position.y, 1); assert.equal(JSON.stringify(sprite.components), before);
  c.playerFrozen = true; c.updatePlayerController(.01, 0); assert.equal(c.topdown2DIntent[0], 0); assert.equal(c.topdown2DIntent[1], 0);
});
test('Missing canonical Action dependency and incompatible platformer flags fail closed unchanged', () => {
  for (const field of ['moveLeftActionRef', 'moveRightActionRef', 'moveUpActionRef', 'moveDownActionRef']) {
    const c = fixture(), sprite = validSprite(c); c.placed = [sprite]; sprite.components['topdown-controller-2d'][field] = 'missing';
    const before = JSON.stringify(sprite.components); assert.equal(c.topdownPlayerObject(), null); assert.equal(JSON.stringify(sprite.components), before);
  }
  for (const field of ['wallSlideEnabled', 'slopeHandlingEnabled', 'stepHandlingEnabled']) {
    const c = fixture(), sprite = validSprite(c); c.placed = [sprite]; sprite.components['character-collision-2d'][field] = true;
    const before = JSON.stringify(sprite.components); assert.equal(c.topdownPlayerObject(), null); assert.equal(JSON.stringify(sprite.components), before);
  }
});
test('Disabled primarytarget stops stale intent and never invokes legacy movement', () => {
  const c = fixture(), sprite = validSprite(c); c.placed = [sprite]; c.player = { controllerType: 'topdown2d', entity: sprite.entity };
  sprite.components['topdown-controller-2d'].enabled = false; const before = JSON.stringify(sprite.components);
  assert.equal(c.topdownPlayerObject(), null); assert.equal(c.updatePlayerController(.1, 0), null);
  assert.equal(c.topdown2DIntent[0], 0); assert.equal(c.topdown2DIntent[1], 0); assert.equal(c.resets, 1);
  assert.equal(JSON.stringify(sprite.components), before); assert.equal(sprite.entity.position.x, 0);
});
test('Ownership validation exposes named leveltarget error without disturbing ordinary historical projects', () => {
  const c = fixture(); const project = { levels: [{ id: 'level', playerSettings: c.currentPlayerSettings, objects: [] }] };
  const issues = c.collectTopdownPlayerIssues(project); assert.equal(issues[0].code, 'topdown-player-target'); assert.equal(issues[0].severity, 'error'); assert.equal(issues[0].levelId, 'level');
  const historical = { levels: [{ id: 'old', playerSettings: { controllerType: 'topdown' }, objects: [] }] }, before = JSON.stringify(historical);
  assert.equal(c.collectTopdownPlayerIssues(historical).length, 0); assert.equal(JSON.stringify(historical), before);
});
test('Actual copied-level remap changes primary Object ownership but not unrelated references', () => {
  const c = fixture(); c.generateItemId = () => 'new-sprite';
  c.clone = { objects: [{ id: 'sprite', kind: 'sprite' }], sequences: [{ targetId: 'sprite' }],
    playerSettings: { controllerType: 'topdown2d', topdownObjectRef: 'sprite', visual: { assetId: 'sprite' }, inputContextId: 'sprite', creatorExtension: 'sprite' } };
  vm.runInContext(extract('remapObjectIds'), c);
  const start = source.indexOf('  const remapped = remapObjectIds(clone.objects, { sequences:');
  const end = source.indexOf('  // Wave 9C (Section 5)', start); assert(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), c);
  assert.equal(c.clone.objects[0].id, 'new-sprite'); assert.equal(c.clone.sequences[0].targetId, 'new-sprite'); assert.equal(c.clone.playerSettings.topdownObjectRef, 'new-sprite');
  assert.equal(c.clone.playerSettings.visual.assetId, 'sprite'); assert.equal(c.clone.playerSettings.inputContextId, 'sprite'); assert.equal(c.clone.playerSettings.creatorExtension, 'sprite');
});
console.log(`Phase117 actual Player ownership: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
