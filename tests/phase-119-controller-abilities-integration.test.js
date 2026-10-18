'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync('editor/src/01-editor.js', 'utf8');
function extract(name) { const start = source.indexOf('function ' + name + '('); assert(start >= 0, name); return source.slice(start, source.indexOf('\n}', start) + 2); }
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } }
function fixture(family = 'platformer2d') {
  const record = { moveSpeed: 5, gravity: 20, jumpSpeed: 8, jumpActionRef: 'jump', moveLeftActionRef: 'left', moveRightActionRef: 'right', moveUpActionRef: 'up', moveDownActionRef: 'down' };
  const actor = { id: 'actor', components: { [family === 'platformer2d' ? 'platformer-controller-2d' : 'topdown-controller-2d']: record }, entity: { position: { x: 0, y: 1, z: 7, clone() { return { x: this.x, y: this.y, z: this.z }; } } } };
  const down = new Set(), pressed = new Set(), available = new Set(['left', 'right', 'up', 'down', 'jump', 'sprint', 'customJump']);
  const c = { OpusControllerAbilities: require('../editor/src/00-controller-abilities'), currentPlayerSettings: { controllerType: family }, player: { entity: actor.entity }, playerFrozen: false, app: { paused: false },
    platformerPlayerObject: () => actor, topdownPlayerObject: () => actor, findInputAction: id => available.has(id), inputActionDown: id => down.has(id), inputActionWasPressed: id => pressed.has(id),
    platformer2DController: require('../editor/src/00-platformer-controller-2d').createPlatformerController2D(), topdown2DController: require('../editor/src/00-topdown-controller-2d').createTopDownController2D(),
    body2DManager: { getCharacterCollision2DState: () => ({ active: true, grounded: true, ceiling: false, wallLeft: false, wallRight: false }) } };
  vm.createContext(c); vm.runInContext(['resolvePlayerControllerAbilities', 'updatePlayerController', 'collectControllerAbilityPlayerIssues'].map(extract).join('\n'), c);
  return { c, actor, record, down, pressed, available };
}
test('Actual dispatcher composes Sprite abilities once before sole velocity intent without authored writes', () => {
  const f = fixture(); f.actor.components['sprint-ability'] = { version: 1, enabled: true, inputActionRef: 'sprint', speedMultiplier: 2 };
  const before = JSON.stringify(f.actor), prepare = f.c.platformer2DController.prepare; let calls = 0;
  f.c.platformer2DController = { ...f.c.platformer2DController, prepare(...args) { calls++; return prepare(...args); } }; f.down.add('right'); f.down.add('sprint');
  f.c.updatePlayerController(.01, 0); assert.equal(calls, 1); assert.equal(f.c.platformer2DIntent[0], 10); assert.equal(JSON.stringify(f.actor), before);
});
test('Actual typed Jump override accepts its Action not historical fallback', () => {
  const f = fixture(); f.actor.components['jump-ability'] = { version: 1, enabled: true, inputActionRef: 'customJump', jumpSpeed: 12 }; f.pressed.add('jump'); f.c.updatePlayerController(.01, 0); assert(f.c.platformer2DIntent[1] < 0);
  f.pressed.add('customJump'); f.c.updatePlayerController(.01, 0); assert(f.c.platformer2DIntent[1] > 11);
});
test('Actual unavailable or malformed Jump stays inert without disabling movement and gravity', () => {
  const f = fixture(); f.actor.components['jump-ability'] = { version: 1, enabled: true, inputActionRef: 'missing', jumpSpeed: 12 }; f.down.add('right'); f.pressed.add('jump'); f.c.updatePlayerController(.01, 0); assert.equal(f.c.platformer2DIntent[0], 5); assert(f.c.platformer2DIntent[1] < 0);
  f.actor.components['jump-ability'] = null; f.c.updatePlayerController(.01, 0); assert(f.c.platformer2DIntent[1] < 0);
});
test('Actual removal restores unchanged historical Jump and ordinary speed', () => {
  const f = fixture(); f.actor.components['jump-ability'] = { version: 1, enabled: false, inputActionRef: 'jump', jumpSpeed: 12 }; f.pressed.add('jump'); f.c.updatePlayerController(.01, 0); assert(f.c.platformer2DIntent[1] < 0); delete f.actor.components['jump-ability']; f.c.updatePlayerController(.01, 0); assert(f.c.platformer2DIntent[1] > 7); assert.equal(f.record.jumpSpeed, 8);
});
test('Actual Top-down Sprint keeps XY normalized diagonal and ignores Jump ability', () => {
  const f = fixture('topdown2d'); f.actor.components['sprint-ability'] = { version: 1, enabled: true, inputActionRef: 'sprint', speedMultiplier: 2 }; f.actor.components['jump-ability'] = { version: 1, enabled: true, inputActionRef: 'jump', jumpSpeed: 12 }; ['right', 'up', 'sprint'].forEach(id => f.down.add(id)); f.pressed.add('jump'); f.c.updatePlayerController(.01, 0); assert(Math.abs(Math.hypot(...f.c.topdown2DIntent) - 10) < 1e-10); assert.equal(f.actor.entity.position.z, 7);
});
test('Actual freeze/pause cannot leak Sprint motion', () => {
  const f = fixture(); f.down.add('right'); f.actor.components['sprint-ability'] = { version: 1, enabled: true, inputActionRef: 'sprint', speedMultiplier: 2 }; f.down.add('sprint'); f.c.playerFrozen = true; f.c.updatePlayerController(.01, 0); assert.equal(f.c.platformer2DIntent[0], 0); f.c.playerFrozen = false; f.c.app.paused = true; f.c.updatePlayerController(.01, 0); assert.equal(f.c.platformer2DIntent[0], 0);
});
test('Actual validation explains retained non-primary/legacy abilities and incompatible Top-down Jump', () => {
  const f = fixture(); const objects = [{ id: 'actor', components: { 'jump-ability': {} } }, { id: 'other', components: { 'sprint-ability': {} } }]; const project = { levels: [{ id: 'one', playerSettings: { controllerType: 'topdown2d', topdownObjectRef: 'actor' }, objects }] }; const before = JSON.stringify(project), issues = f.c.collectControllerAbilityPlayerIssues(project); assert.equal(issues.length, 2); assert.equal(issues[0].severity, 'error'); assert.equal(issues[1].severity, 'warning'); assert.equal(JSON.stringify(project), before); project.levels[0].playerSettings.controllerType = 'firstperson'; assert(f.c.collectControllerAbilityPlayerIssues(project).every(x => x.severity === 'warning'));
});
console.log(`Phase119 actual dispatcher integration: ${passed} PASS, ${failed} FAIL`); if (failed) process.exitCode = 1;
