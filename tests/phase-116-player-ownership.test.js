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
  const c = { placed: [], currentPlayerSettings: { controllerType: 'platformer2d', platformerObjectRef: 'sprite' },
    OpusAuthoring: require('../editor/src/00-authoring-schema.js'),
    OpusControllerAbilities: require('../editor/src/00-controller-abilities.js'),
    findInputAction: id => ['moveLeft', 'moveRight', 'jump'].includes(id),
    platformer2DIntent: [4, 5], platformer2DController: { reset() { c.resets++; } }, resets: 0,
    player: null, teardownPlayerVisual() { c.visualTeardowns++; }, teardownPlayerEquipment() {},
    visualTeardowns: 0, PLAYER_CONTROLLERS: { hovercraft: { despawn() { c.legacyDespawns++; c.player = null; } } }, legacyDespawns: 0 };
  Object.assign(c,{controllerStateSession:0,controllerStateEvents:null});vm.createContext(c);vm.runInContext(extract('resetControllerStateEvents'),c);
  vm.runInContext(['platformerPlayerObject', 'collectPlatformerPlayerIssues', 'resetPlatformerPlayerIntent', 'despawnPlayer', 'resolvePlayerControllerAbilities', 'updatePlayerController'].map(extract).join('\n'), c);
  return c;
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (error) { console.error('FAIL ' + name, error.stack); process.exitCode = 1; } }
test('Actual despawn releases Platformer state but never removes its authored Sprite', () => {
  const c = fixture(), entity = { position: { x: 2, y: 3 } }, sprite = { id: 'sprite', kind: 'sprite', entity };
  c.placed = [sprite]; c.player = { controllerType: 'platformer2d', entity };
  c.despawnPlayer(); assert.equal(c.player, null); assert.equal(c.platformer2DController, null);
  assert.equal(c.placed[0], sprite); assert.equal(c.resets, 1); assert.equal(c.visualTeardowns, 0);
});
test('Changing level settings before despawn does not leak a historical legacy entity', () => {
  const c = fixture(); c.player = { controllerType: 'hovercraft', entity: {} };
  c.despawnPlayer(); assert.equal(c.legacyDespawns, 1); assert.equal(c.player, null); assert.equal(c.visualTeardowns, 1);
});
test('Missing ambiguous wrong-kind and malformed target identities fail closed', () => {
  const c = fixture(); assert.equal(c.platformerPlayerObject(), null);
  c.placed = [{ id: 'sprite', kind: 'cube', entity: {} }]; assert.equal(c.platformerPlayerObject(), null);
  c.placed = [{ id: 'sprite', kind: 'sprite', entity: {} }]; assert.equal(c.platformerPlayerObject(), null);
  c.placed.push({ id: 'sprite', kind: 'sprite', entity: {} }); assert.equal(c.platformerPlayerObject(), null);
  c.currentPlayerSettings.platformerObjectRef = { id: 'sprite' }; assert.equal(c.platformerPlayerObject(), null);
});
function validSprite(c) {
  const sprite = { id: 'sprite', kind: 'sprite', entity: { position: { x: 0, y: 1, z: 7, clone() { return { x: this.x, y: this.y, z: this.z }; } } } };
  for (const id of ['box-collider-2d', 'body-2d', 'character-collision-2d', 'platformer-controller-2d']) assert(c.OpusAuthoring.addComponent(sprite, id).ok);
  sprite.components['body-2d'].type = 'kinematic'; return sprite;
}
test('Actual dispatcher admits named input without a Transform or authored velocity write', () => {
  const c = fixture(), sprite = validSprite(c), before = JSON.stringify(sprite.components);
  c.placed = [sprite]; c.player = { controllerType: 'platformer2d', entity: sprite.entity };
  c.platformer2DController = require('../editor/src/00-platformer-controller-2d.js').createPlatformerController2D();
  c.body2DManager = { getCharacterCollision2DState: () => ({ active: true, grounded: true, ceiling: false, wallLeft: false, wallRight: false }) };
  c.inputActionDown = id => id === 'moveRight'; c.inputActionWasPressed = id => id === 'jump'; c.playerFrozen = false; c.app = { paused: false };
  const previous = c.updatePlayerController(.01, 0); assert.equal(previous.y, 1);
  assert.equal(c.platformer2DIntent[0], 5); assert(c.platformer2DIntent[1] > 7);
  assert.equal(sprite.entity.position.x, 0); assert.equal(sprite.entity.position.y, 1);
  assert.equal(JSON.stringify(sprite.components), before);
  c.playerFrozen = true; c.updatePlayerController(.01, 0); assert.equal(c.platformer2DIntent[0], 0); assert.equal(c.platformer2DIntent[1], 0);
});
test('Invalid bound Action stays inert and project ownership validation is visible', () => {
  const c = fixture(), sprite = validSprite(c); c.placed = [sprite]; assert.equal(c.platformerPlayerObject(), sprite);
  sprite.components['platformer-controller-2d'].jumpActionRef = 'missing-action'; assert.equal(c.platformerPlayerObject(), null);
  c.placed.push({ ...sprite }); assert.equal(c.platformerPlayerObject(), null);
  const issues = c.collectPlatformerPlayerIssues({ levels: [{ id: 'level', playerSettings: c.currentPlayerSettings, objects: [] }] });
  assert.equal(issues[0].code, 'platformer-player-target'); assert.equal(issues[0].severity, 'error');
  assert.equal(issues[0].levelId, 'level');
});
test('Actual level-copy remap changes primary Object reference without rewriting unrelated Player IDs', () => {
  const c = fixture(); c.generateItemId = () => 'new-sprite';
  c.clone = { objects: [{ id: 'sprite', kind: 'sprite' }], sequences: [{ targetId: 'sprite' }],
    playerSettings: { controllerType: 'platformer2d', platformerObjectRef: 'sprite', visual: { assetId: 'sprite' }, inputContextId: 'sprite', creatorExtension: 'sprite' } };
  vm.runInContext(extract('remapObjectIds'), c);
  const start = source.indexOf('  const remapped = remapObjectIds(clone.objects, { sequences:');
  const end = source.indexOf('  // Wave 9C (Section 5)', start);
  assert(start >= 0 && end > start); vm.runInContext(source.slice(start, end), c);
  assert.equal(c.clone.objects[0].id, 'new-sprite'); assert.equal(c.clone.sequences[0].targetId, 'new-sprite');
  assert.equal(c.clone.playerSettings.platformerObjectRef, 'new-sprite');
  assert.equal(c.clone.playerSettings.visual.assetId, 'sprite'); assert.equal(c.clone.playerSettings.inputContextId, 'sprite');
  assert.equal(c.clone.playerSettings.creatorExtension, 'sprite');
});
console.log(`Phase116 actual Player ownership: ${passed} PASS`);
