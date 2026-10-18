'use strict';
// Execute canonical production Save/Load and checkpoint activation, not a
// replacement persistence algorithm. Browser acceptance covers real input.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require.resolve('../editor/src/01-editor.js'), 'utf8');
function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert(start >= 0, 'Production function is present: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 1, end = brace + 1;
  while (depth) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; end++; }
  return source.slice(start, end);
}
class Vec3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
  clone() { return new Vec3(this.x, this.y, this.z); }
  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
}
function fixture() {
  const slots = new Map();
  class SaveSystem {
    save(slot, value) { slots.set(slot, JSON.parse(JSON.stringify(value))); }
    load(slot) { const value = slots.get(slot); return value && JSON.parse(JSON.stringify(value)); }
  }
  const owner = { id: 'checkpoint', kind: 'sprite', entity: { visible: true, position: new Vec3(2, 80, 4) }, components: { checkpoint: { version: 1, enabled: true, respawnPointRef: 'marker', offset: [0, 1, 0], activatorRef: null } } };
  const marker = { id: 'marker', kind: 'spawnPoint', entity: { position: new Vec3(6, 80, 2) } };
  const actor = { id: 'actor', kind: 'sprite', entity: { position: new Vec3() } };
  const context = {
    Opus: { Vec3, SaveSystem }, window: {}, player: { entity: { position: new Vec3(0, 81, 0) }, velocity: new Vec3() },
    placed: [owner, marker, actor], playMode: true, gameEnded: false, app: { paused: false },
    VOID_FALL_MARGIN: 30, voidFallY: -29, levels: [{ name: 'First' }, { name: 'Second' }], currentLevelIndex: 0,
    playerEquipment: {}, currentPlayerSettings: { equipmentDefs: [] }, weaponRuntimeState: {}, activeWeaponSlot: 'primaryHand',
    lootTables: [], lootDrawCounters: Object.create(null),
    captureCurrentLevelWorldState() {}, currentActiveObjectiveTitle: () => '',
    syncActiveWeaponVisualVisibility() {}, applyWorldStateToCurrentLevel() {}, showToast() {},
    computeSpawnPoint: () => new Vec3(0, 1, 0),
  };
  context.findItemById = id => context.placed.find(item => item.id === id);
  // This seam models the existing level-switch spawn threshold. Production
  // Load must reconcile it AFTER switching and restoring checkpoint/position.
  context.switchToLevelDuringPlay = index => { context.currentLevelIndex = index; context.voidFallY = 1 - context.VOID_FALL_MARGIN; };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-player-rebind-screen.js'),'utf8')+';var playerPreferenceScope={kind:"PlayerPreferenceScope",version:1,id:"11111111-1111-4111-8111-111111111111"};'+functionSource('projectRuntimeSaveSystem'),context);
  vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-loot-tables.js'), 'utf8'), context);
  const checkpointActions = source.slice(source.indexOf('  setCheckpoint: {'), source.indexOf('  switchLevel: {'));
  const loadAction = source.slice(source.indexOf('  loadGame: {'), source.indexOf('  clearSaveGame: {'));
  vm.runInContext('globalThis.ACTION_TYPES = {' + checkpointActions + loadAction + '};' + functionSource('activateCheckpointComponent') + functionSource('writeSaveGameSlot') + ['equipmentDefFor', 'capturePlayerEquipment', 'restorePlayerEquipment', 'equipItemToSlot'].map(functionSource).join('\n'), context);
  return { context, owner, marker, actor };
}
const failures = [];
function test(name, body) { try { body(); console.log('PASS ' + name); } catch (error) { failures.push(name + ': ' + error.message); console.error('FAIL ' + name + ': ' + error.message); } }
test('Sprite named Trigger2D activation snapshots marker independently', () => {
  const { context: c, owner, marker } = fixture();
  owner.components.checkpoint.activatorRef = 'actor';
  c.window.__currentTrigger2DEvent = { targetObjectId: 'wrong' };
  assert.equal(c.activateCheckpointComponent(owner).activated, false);
  c.window.__currentTrigger2DEvent = { targetObjectId: 'actor' };
  assert.equal(c.activateCheckpointComponent(owner).activated, true);
  marker.entity.position.set(100, 500, 200);
  c.placed = c.placed.filter(item => item !== marker);
  c.ACTION_TYPES.respawnAtCheckpoint.exec();
  assert.deepStrictEqual([c.player.entity.position.x, c.player.entity.position.y, c.player.entity.position.z], [6, 81, 2]);
  assert.equal(c.voidFallY, 51);
});
for (const switchLevel of [false, true]) test('Changed-height Game Save/Load restores void threshold ' + (switchLevel ? 'after level switch' : 'in same level'), () => {
  const { context: c, owner, marker } = fixture();
  assert.equal(c.activateCheckpointComponent(owner).activated, true);
  c.writeSaveGameSlot('high');
  marker.entity.position.y = 2;
  assert.equal(c.activateCheckpointComponent(owner).activated, true);
  assert.equal(c.voidFallY, -27);
  if (switchLevel) c.currentLevelIndex = 1;
  c.ACTION_TYPES.loadGame.exec({ slot: 'high' });
  assert.equal(c.currentLevelIndex, 0);
  assert.equal(c.window.__checkpoint.y, 81);
  assert.equal(c.player.entity.position.y, 81);
  assert.equal(c.voidFallY, 51, 'Loaded checkpoint height must own automatic void recovery threshold');
});
test('Loading save without checkpoint restores normal spawn threshold', () => {
  const { context: c, owner } = fixture();
  c.writeSaveGameSlot('before-checkpoint');
  c.activateCheckpointComponent(owner);
  assert.equal(c.voidFallY, 51);
  c.ACTION_TYPES.loadGame.exec({ slot: 'before-checkpoint' });
  assert.equal(c.window.__checkpoint, null);
  assert.equal(c.voidFallY, -29, 'Absent checkpoint uses normal level spawn, not an old reached checkpoint');
});
assert.equal(failures.length, 0, failures.join('\n'));
console.log('Phase077 canonical checkpoint persistence and marker snapshot PASS');
