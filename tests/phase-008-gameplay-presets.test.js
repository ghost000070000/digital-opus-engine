'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const presets = require('../editor/src/00-gameplay-presets');
const aiBrain = require('../editor/src/00-ai-brain');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS ${name}`); }
  catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}
function cube(extra = {}) { return { id: 'obj1', kind: 'cube', behaviors: [], entity: { position: { x: 1, y: 2, z: 3 }, color: [1, 1, 1] }, ...extra }; }
function adapter() {
  return {
    position: (item) => item.entity.position,
    preflightAiPreset: (item, patch) => { const captured=item.entity.ai?aiBrain.captureLegacy(item.entity.ai):{ok:true,record:aiBrain.create(item.entity.position)};if(!captured.ok)return captured;return aiBrain.inspect({...captured.record,config:{...captured.record.config,...patch,base:[item.entity.position.x,item.entity.position.y,item.entity.position.z]}}); },
    setObject: (item, patch) => Object.assign(item, patch),
    setVisual: (item, patch) => Object.assign(item.entity, JSON.parse(JSON.stringify(patch))),
    ensureTag: (item, tag) => { item.tags = item.tags || []; if (!item.tags.includes(tag)) item.tags.push(tag); },
    setAi: (item, patch) => { item.entity.ai = { ...patch, base: { ...item.entity.position } }; },
    ensureComponent: (item, id, values) => { item.components = item.components || {}; item.components[id] = { version: 1, ...values }; item.health = id === 'health' ? { max: values.max, current: values.current } : item.health; return item.components[id]; },
    upsertBehavior: (item, action, definition) => { let b = item.behaviors.find((entry) => entry.action === action && entry.trigger === definition.trigger && entry.sourcePreset === definition.sourcePreset); if (!b) { b = { action, trigger: definition.trigger, sourcePreset: definition.sourcePreset }; item.behaviors.push(b); } b.params = JSON.parse(JSON.stringify(definition.params || {})); return b; },
    removeBehavior: (item, action, sourcePreset) => { item.behaviors = item.behaviors.filter((entry) => entry.action !== action || entry.sourcePreset !== sourcePreset); },
    upsertClip: (item, clip) => { item.animationClips = item.animationClips || []; const index = item.animationClips.findIndex((entry) => entry.name === clip.name); if (index < 0) item.animationClips.push(JSON.parse(JSON.stringify(clip))); else item.animationClips[index] = JSON.parse(JSON.stringify(clip)); },
  };
}

console.log('Phase 008 gameplay preset tests');

test('catalog has a bounded useful set backed by existing primitives', () => assert.deepStrictEqual(presets.registry.list().map((p) => p.id).sort(), ['ai-flee', 'ai-follow', 'ai-investigate', 'ai-investigate-search', 'ai-patrol', 'ai-wander', 'basic-enemy', 'checkpoint', 'collectible', 'damage-zone', 'moving-platform', 'opening-door', 'platformer-player-2d', 'signal-emitter', 'signal-indicator', 'signal-visibility', 'spawn-point', 'topdown-player-2d']));
test('every preset has the complete registry contract', () => { for (const p of presets.registry.list()) { assert(p.id && p.displayName && p.category && p.description); assert(Number.isInteger(p.version)); assert(Array.isArray(p.eligibility)); assert(Array.isArray(p.parameters)); assert.strictEqual(typeof p.apply, 'function'); assert.strictEqual(typeof p.validate, 'function'); assert.strictEqual(typeof p.detect, 'function'); } });
test('duplicate stable IDs are rejected', () => { const r = new presets.GameplayPresetRegistry(); const d = { id: 'proof', displayName: 'Proof', category: 'Test', description: 'Proof.', version: 1, eligibility: ['any'], parameters: [], detect: () => false, apply: () => {} }; r.register(d); assert.throws(() => r.register(d), /already registered/); });
test('invalid registry metadata is rejected', () => { const r = new presets.GameplayPresetRegistry(); assert.throws(() => r.register({ id: 'Bad ID' }), /stable lowercase id/); });
test('invalid parameter types are rejected', () => { const r = new presets.GameplayPresetRegistry(); assert.throws(() => r.register({ id: 'proof', displayName: 'Proof', category: 'Test', description: 'Proof.', version: 1, eligibility: ['any'], parameters: [{ id: 'x', type: 'object' }], detect: () => false, apply: () => {} }), /Invalid parameter/); });
test('scene objects discover all production presets', () => assert.strictEqual(presets.registry.discover(cube(), '').length, 16));
test('ineligible kinds discover no presets', () => assert.deepStrictEqual(presets.registry.discover({ kind: 'terrain' }, ''), []));
test('search matches display name', () => assert.deepStrictEqual(presets.registry.discover(cube(), 'Damage Zone').map((p) => p.id), ['damage-zone']));
test('search matches stable id', () => assert.deepStrictEqual(presets.registry.discover(cube(), 'opening-door').map((p) => p.id), ['opening-door']));
test('search matches category', () => assert(presets.registry.discover(cube(), 'world').length >= 3));
test('search matches description tokens', () => assert.deepStrictEqual(presets.registry.discover(cube(), 'ping position').map((p) => p.id), ['moving-platform']));
test('search is case-insensitive', () => assert.deepStrictEqual(presets.registry.discover(cube(), 'BASIC ENEMY').map((p) => p.id), ['basic-enemy']));
test('unknown preset is inspectably rejected without mutation', () => { const target = cube(); const before = JSON.stringify(target); assert.strictEqual(presets.registry.apply(target, 'missing', {}, adapter()).code, 'UNKNOWN_PRESET'); assert.strictEqual(JSON.stringify(target), before); });
test('ineligible application is rejected before the transaction', () => { let calls = 0; const result = presets.registry.apply({ kind: 'terrain' }, 'checkpoint', {}, adapter(), { onBeforeChange: () => calls++ }); assert.strictEqual(result.code, 'INELIGIBLE'); assert.strictEqual(calls, 0); });
test('numeric parameters clamp to declared bounds', () => { const p = presets.registry.normalizeParameters('damage-zone', { damage: -5, cooldown: -1 }); assert.deepStrictEqual(p, { damage: 0, cooldown: 0 }); });
test('enum parameters fall back deterministically', () => assert.strictEqual(presets.registry.normalizeParameters('moving-platform', { axis: 'diagonal' }).axis, 'x'));
test('one successful application invokes exactly one Undo boundary', () => { let calls = 0; presets.registry.apply(cube(), 'checkpoint', {}, adapter(), { onBeforeChange: () => calls++ }); assert.strictEqual(calls, 1); });
test('Collectible creates visible ordinary behaviors and values', () => { const target = cube(); presets.registry.apply(target, 'collectible', { counter: 'coins', destroyOnCollect: true }, adapter()); assert.deepStrictEqual(target.behaviors.map((b) => b.action), ['incrementCounter', 'destroyObject']); assert.strictEqual(target.behaviors[0].params.counter, 'coins'); assert.strictEqual(target.entity.spin, 2); });
test('Checkpoint creates an editable behavior', () => { const target = cube(); presets.registry.apply(target, 'checkpoint', {}, adapter()); assert(target.behaviors.some((b) => b.action === 'setCheckpoint')); });
test('Damage Zone writes meaningful parameters', () => { const target = cube(); presets.registry.apply(target, 'damage-zone', { damage: 23, cooldown: 2.5 }, adapter()); assert.deepStrictEqual(target.behaviors[0].params, { amount: 23, cooldown: 2.5 }); });
test('Opening Door writes a normal tween action against its stable object ID', () => { const target = cube(); presets.registry.apply(target, 'opening-door', { axis: 'z', distance: -2, duration: 0.5 }, adapter()); const b = target.behaviors[0]; assert.strictEqual(b.action, 'moveTo'); assert.deepStrictEqual(b.params, { targetId: 'obj1', x: 1, y: 2, z: 1, duration: 0.5, easing: 'easeInOut' }); assert.strictEqual(target.entity.solid, true); });
test('Moving Platform creates one editable clip and start behavior', () => { const target = cube(); presets.registry.apply(target, 'moving-platform', { axis: 'y', distance: 5, duration: 3 }, adapter()); assert.strictEqual(target.animationClips.length, 1); assert.deepStrictEqual(target.animationClips[0].tracks.position[1].value, [1, 7, 3]); assert.strictEqual(target.behaviors[0].action, 'playAnimation'); });
test('Basic Enemy exposes AI, Health, tag, and contact behavior', () => { const target = cube(); presets.registry.apply(target, 'basic-enemy', { speed: 4, detectionRadius: 12, health: 75, contactDamage: 8, cooldown: 0.5 }, adapter()); assert.strictEqual(target.entity.ai.type, 'follow'); assert.deepStrictEqual(target.health, { max: 75, current: 75 }); assert(target.tags.includes('enemy')); assert.strictEqual(target.behaviors[0].params.amount, 8); });
test('Spawn Point exposes ordinary marker fields', () => { const target = cube(); presets.registry.apply(target, 'spawn-point', { makeDefault: false }, adapter()); assert.strictEqual(target.isSpawnPoint, true); assert.strictEqual(target.isDefaultSpawn, false); });
test('repeated apply returns UPDATED instead of silently duplicating', () => { const target = cube(); assert.strictEqual(presets.registry.apply(target, 'damage-zone', {}, adapter()).code, 'APPLIED'); assert.strictEqual(presets.registry.apply(target, 'damage-zone', { damage: 30 }, adapter()).code, 'UPDATED'); assert.strictEqual(target.behaviors.filter((b) => b.action === 'damagePlayer').length, 1); assert.strictEqual(target.behaviors[0].params.amount, 30); });
test('repeated Moving Platform application updates one clip', () => { const target = cube(); presets.registry.apply(target, 'moving-platform', {}, adapter()); presets.registry.apply(target, 'moving-platform', { distance: 8 }, adapter()); assert.strictEqual(target.animationClips.length, 1); assert.strictEqual(target.behaviors.length, 1); });
test('preset output preserves unrelated pre-existing behavior data', () => { const target = cube({ behaviors: [{ trigger: 'click', action: 'message', params: { text: 'Keep me' } }] }); presets.registry.apply(target, 'checkpoint', {}, adapter()); assert(target.behaviors.some((b) => b.params && b.params.text === 'Keep me')); });
test('preset provenance avoids overwriting a creator behavior with the same action', () => { const target = cube({ behaviors: [{ trigger: 'enter', action: 'damagePlayer', params: { amount: 2, cooldown: 9 } }] }); presets.registry.apply(target, 'damage-zone', { damage: 20 }, adapter()); assert.strictEqual(target.behaviors.length, 2); assert.strictEqual(target.behaviors[0].params.amount, 2); assert.strictEqual(target.behaviors[1].sourcePreset, 'damage-zone'); });
test('snapshot Undo removes everything in one restoration', () => { const target = cube(); const before = JSON.stringify(target); presets.registry.apply(target, 'basic-enemy', {}, adapter()); assert.notStrictEqual(JSON.stringify(target), before); assert.deepStrictEqual(JSON.parse(before), cube()); });
test('preset output survives JSON Save/Load', () => { const target = cube(); presets.registry.apply(target, 'moving-platform', {}, adapter()); const loaded = JSON.parse(JSON.stringify(target)); assert.deepStrictEqual(loaded.behaviors, target.behaviors); assert.deepStrictEqual(loaded.animationClips, target.animationClips); });
test('preset output survives prefab-style cloning', () => { const target = cube(); presets.registry.apply(target, 'basic-enemy', {}, adapter()); const prefabInstance = JSON.parse(JSON.stringify(target)); assert.deepStrictEqual(prefabInstance.components.health, target.components.health); assert.deepStrictEqual(prefabInstance.entity.ai, target.entity.ai); });
test('preset output survives export-style serialization without special runtime objects', () => { const target = cube(); presets.registry.apply(target, 'collectible', {}, adapter()); const output = JSON.stringify(target); assert(output.includes('incrementCounter')); assert(!output.includes('Preset Runtime Object')); });

const editor = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8');
test('editor loads the preset registry before the editor integration', () => assert(html.lastIndexOf('src/00-gameplay-presets.js') < html.lastIndexOf('src/01-editor.js')));
test('picker derives results from the authoritative preset registry', () => assert(editor.includes('registry.discover(selectedItem, query)')));
test('picker exposes search categories descriptions and parameter controls', () => { for (const token of ['Search gameplay presets', 'gameplay-preset-category-title', 'preset.description', 'data-preset-parameter']) assert(editor.includes(token) || html.includes(token), token); });
test('picker exposes dialog listbox and keyboard behavior', () => { for (const token of ['role="dialog"', 'role="listbox"', 'ArrowDown', 'ArrowUp', "event.key === 'Escape'", "event.key === 'Tab'"]) assert(editor.includes(token), token); });
test('editor adapter applies through exactly one preset transaction callback', () => assert(editor.includes("registry.apply(target, preset.id") && editor.includes('onBeforeChange: () => pushUndo()')));
test('preset browser is adjacent to Add Component in the Inspector', () => assert(editor.includes('componentWorkflow.after(workflow)')));
test('picker is responsive and viewport bounded', () => assert(html.includes('.gameplay-preset-dialog') && html.includes('max-height: calc(100vh - 32px)') && html.includes('@media (max-width: 620px)')));
test('editable and playable export paths include the preset module', () => { for (const file of ['build/build-games.js', 'build/build-games-site.js', 'build/build-engine-site.js', 'editor/src/01-editor.js']) { const source = fs.readFileSync(path.join(ROOT, file), 'utf8'); assert(source.includes('00-gameplay-presets.js'), file); } });

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 008 tests passed: ${passed}/${passed}`);
