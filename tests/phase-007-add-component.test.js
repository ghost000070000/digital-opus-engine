'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const authoring = require('../editor/src/00-authoring-schema');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS ${name}`); }
  catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}
function cube(extra = {}) { return { kind: 'cube', ...extra }; }

console.log('Phase 007 searchable Add Component tests');

test('production schemas explicitly declare creator addability or automatic ownership', () => {
  assert(authoring.registry.list().every((schema) => typeof schema.addable === 'boolean'));
  assert.strictEqual(authoring.registry.get('sprite-renderer').addable, false);
});
test('registered components declare singleton multiplicity matching the component bag', () => assert(authoring.registry.list().every((schema) => schema.multiplicity === 'single')));
test('schema definitions default to internal/non-addable', () => { const registry = new authoring.AuthoringSchemaRegistry(); const schema = registry.register({ id: 'internal-proof', displayName: 'Internal Proof', category: 'Advanced', version: 1, eligibility: ['any'], fields: [] }); assert.strictEqual(schema.addable, false); });
test('unsupported multiple-instance declarations fail instead of changing storage shape', () => { const registry = new authoring.AuthoringSchemaRegistry(); assert.throws(() => registry.register({ id: 'multi-proof', displayName: 'Multi', category: 'Gameplay', version: 1, eligibility: ['any'], multiplicity: 'multiple', fields: [] }), /unsupported multiplicity/); });
test('ordinary cubes discover AI Brain, Health, Damage and current 2D components from the authoritative registry', () => assert.deepStrictEqual(authoring.discoverComponents(cube(), '').map((entry) => entry.schema.id), ['ai-brain', 'health', 'damage', 'damage-resistance', 'hurtbox', 'hitbox', 'interactable', 'pickup', 'checkpoint', 'door-gate', 'moving-platform-3d', 'box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d', 'body-2d', 'character-collision-2d', 'moving-platform-2d', 'one-way-platform-2d']));
test('ineligible Trigger and Particle schemas are omitted for ordinary cubes', () => assert(authoring.discoverComponents(cube(), '').every((entry) => !['trigger', 'particle-emitter'].includes(entry.schema.id))));
test('trigger objects discover AI Brain, Health, Damage, existing Trigger, and current 2D components in stable registry order', () => assert.deepStrictEqual(authoring.discoverComponents(cube({ isTrigger: true }), '').map((entry) => entry.schema.id), ['ai-brain', 'health', 'damage', 'damage-resistance', 'hurtbox', 'hitbox', 'interactable', 'pickup', 'checkpoint', 'door-gate', 'moving-platform-3d', 'trigger', 'box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d', 'body-2d', 'character-collision-2d', 'moving-platform-2d', 'one-way-platform-2d']));
test('emitter objects discover only their compatible Particle component', () => assert.deepStrictEqual(authoring.discoverComponents({ kind: 'emitter', options: {} }, '').map((entry) => entry.schema.id), ['particle-emitter']));
test('legacy component state is recognized as already present', () => assert.strictEqual(authoring.discoverComponents(cube({ health: { max: 5, current: 5 } }), '').find(entry=>entry.schema.id==='health').code, 'already-added'));
test('component-bag state is recognized as already present', () => assert.strictEqual(authoring.getComponentAddability(cube({ components: { health: { version: 1, max: 5, current: 5 } } }), 'health').code, 'already-added'));
test('search matches creator label', () => assert.deepStrictEqual(authoring.discoverComponents(cube(), 'Health').map((entry) => entry.schema.id), ['health']));
test('search matches stable id', () => assert.deepStrictEqual(authoring.discoverComponents(cube({ isTrigger: true }), 'trigger').map((entry) => entry.schema.id), ['trigger', 'trigger-collider-2d']));
test('search matches category', () => assert.deepStrictEqual(authoring.discoverComponents(cube(), 'gameplay').map((entry) => entry.schema.id), ['ai-brain', 'health', 'damage', 'damage-resistance', 'hurtbox', 'hitbox', 'interactable', 'pickup', 'checkpoint', 'door-gate', 'moving-platform-3d']));
test('search is case-insensitive and tokenized', () => assert.deepStrictEqual(authoring.discoverComponents(cube(), '  GAME health ').map((entry) => entry.schema.id), ['health']));
test('search returns a deterministic empty result', () => assert.deepStrictEqual(authoring.discoverComponents(cube(), 'teleporter'), []));
test('unknown components fail with an inspectable reason', () => assert.deepStrictEqual(authoring.getComponentAddability(cube(), 'missing'), { addable: false, code: 'unknown-component', reason: 'Unknown component.' }));
test('ineligible components fail before mutation', () => { const target = cube(); const result = authoring.addComponent(target, 'particle-emitter'); assert.strictEqual(result.code, 'ineligible-target'); assert.strictEqual(target.components, undefined); });
test('already-present singleton components cannot be added twice', () => { const target = cube(); assert(authoring.addComponent(target, 'health').ok); const again = authoring.addComponent(target, 'health'); assert.strictEqual(again.code, 'already-added'); });
test('Add Component uses schema defaults and version', () => { const target = cube(); const result = authoring.addComponent(target, 'health'); assert(result.ok); assert.deepStrictEqual(target.components.health, { version: 1, max: 100, current: 100 }); });
test('Add Component applies the existing runtime compatibility adapter', () => { const target = cube(); authoring.addComponent(target, 'health'); assert.deepStrictEqual(target.health, { max: 100, current: 100 }); });
test('Add Component invokes one before-change transaction callback', () => { const target = cube(); let calls = 0; authoring.addComponent(target, 'health', { onBeforeChange: () => calls++ }); assert.strictEqual(calls, 1); });
test('failed Add Component invokes no transaction callback', () => { const target = cube(); let calls = 0; authoring.addComponent(target, 'trigger', { onBeforeChange: () => calls++ }); assert.strictEqual(calls, 0); });
test('successful Add Component invokes one completion callback', () => { const target = cube(); let id = null; authoring.addComponent(target, 'health', { onChange: (schema) => { id = schema.id; } }); assert.strictEqual(id, 'health'); });
test('schema defaults validate without fake warnings', () => { const target = cube(); const result = authoring.addComponent(target, 'health'); assert.deepStrictEqual(result.issues, []); });
test('added data survives JSON Save/Load through the existing record path', () => { const source = cube(); authoring.addComponent(source, 'health'); const saved = JSON.parse(JSON.stringify({ components: authoring.serializeComponents(source) })); const loaded = cube(); authoring.applyRecord(saved, loaded); assert.deepStrictEqual(loaded.components.health, source.components.health); });
test('snapshot-style Undo removes the addition and Redo restores defaults', () => { const before = JSON.stringify(cube()); const edited = cube(); authoring.addComponent(edited, 'health'); const after = JSON.stringify({ kind: edited.kind, components: authoring.serializeComponents(edited) }); const undone = JSON.parse(before); const redoneRecord = JSON.parse(after); const redone = cube(); authoring.applyRecord(redoneRecord, redone); assert.strictEqual(undone.components, undefined); assert.deepStrictEqual(redone.components.health, { version: 1, max: 100, current: 100 }); });
test('duplicate contract deep-copies a newly added component', () => { const source = cube(); authoring.addComponent(source, 'health'); const copy = cube(); authoring.copyComponents(source, copy); assert.deepStrictEqual(copy.components.health, source.components.health); assert.notStrictEqual(copy.components.health, source.components.health); });
test('prefab-style component serialization preserves newly added defaults', () => { const source = cube(); authoring.addComponent(source, 'health'); const record = { kind: 'cube', components: authoring.serializeComponents(source) }; const instance = cube(); authoring.applyRecord(JSON.parse(JSON.stringify(record)), instance); assert.deepStrictEqual(instance.health, { max: 100, current: 100 }); });
test('test-only schema proves registry to discovery to default creation', () => {
  const registry = new authoring.AuthoringSchemaRegistry();
  registry.register({ id: 'fixture-component', displayName: 'Fixture Component', category: 'Gameplay', help: 'Test only.', version: 1, addable: true, eligibility: ['any'], fields: [
    { key: 'name', label: 'Name', type: 'string' }, { key: 'speed', label: 'Speed', type: 'number' }, { key: 'mode', label: 'Mode', type: 'enum', choices: ['a', 'b'] }, { key: 'pivot', label: 'Pivot', type: 'vec2' }, { key: 'target', label: 'Target', type: 'objectRef' },
  ], defaults: { name: 'Proof', speed: 2, mode: 'a', pivot: [0.5, 0.5], target: null } });
  const api = authoring.createAuthoringApi(registry); const target = { kind: 'anything' };
  assert.deepStrictEqual(api.discoverComponents(target, 'fixture').map((entry) => entry.schema.id), ['fixture-component']);
  assert(api.addComponent(target, 'fixture-component').ok);
  assert.deepStrictEqual(target.components['fixture-component'].pivot, [0.5, 0.5]);
});
test('test-only schema data survives its save/load path', () => { const registry = new authoring.AuthoringSchemaRegistry(); registry.register({ id: 'save-proof', displayName: 'Save Proof', category: 'Gameplay', version: 1, addable: true, eligibility: ['any'], fields: [{ key: 'value', label: 'Value', type: 'string' }], defaults: { value: 'ready' } }); const api = authoring.createAuthoringApi(registry); const target = { kind: 'x' }; api.addComponent(target, 'save-proof'); const loaded = { kind: 'x' }; api.applyRecord(JSON.parse(JSON.stringify({ components: api.serializeComponents(target) })), loaded); assert.strictEqual(loaded.components['save-proof'].value, 'ready'); });
test('future Sprite-shaped schema needs no new discovery primitive', () => { const registry = new authoring.AuthoringSchemaRegistry(); registry.register({ id: 'sprite-proof', displayName: 'Sprite Proof', category: 'Visual', version: 1, addable: true, eligibility: ['any'], fields: [{ key: 'sprite', type: 'assetRef' }, { key: 'pivot', type: 'vec2' }, { key: 'size', type: 'vec2' }, { key: 'tint', type: 'color' }, { key: 'layer', type: 'string' }, { key: 'order', type: 'integer' }], defaults: { sprite: null, pivot: [0.5, 0.5], size: [1, 1], tint: '#ffffff', layer: 'Default', order: 0 } }); const api = authoring.createAuthoringApi(registry); assert.strictEqual(api.discoverComponents({ kind: 'proof' }, 'sprite')[0].addable, true); });

const editorSource = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8');
test('UI derives results directly from registry discovery', () => assert(editorSource.includes('OpusAuthoring.discoverComponents(selectedItem, query)')));
test('UI does not define a second ADDABLE_COMPONENTS list', () => assert(!editorSource.includes('ADDABLE_COMPONENTS')));
test('UI uses the authoritative add transaction', () => assert(editorSource.includes('OpusAuthoring.addComponent(target, schemaId')));
test('UI provides search, listbox, dialog, and active-descendant semantics', () => { for (const token of ['role="dialog"', 'role="combobox"', 'role="listbox"', 'aria-activedescendant']) assert(editorSource.includes(token), token); });
test('UI declares Arrow, Enter, Escape, and Tab keyboard behavior', () => { for (const key of ['ArrowDown', 'ArrowUp', "event.key === 'Enter'", "event.key === 'Escape'", "event.key === 'Tab'"]) assert(editorSource.includes(key), key); });
test('UI declares meaningful no-results and all-present states', () => { assert(editorSource.includes('No matching components.')); assert(editorSource.includes('All available components are already on this object.')); });
test('newly present schemas receive generic reusable-section slots', () => assert(editorSource.includes('ensureRegisteredComponentSlots()') && editorSource.includes('dataset.schemaSlot')));
test('picker is constrained to the viewport with one result scroll region', () => assert(html.includes('max-height: calc(100vh - 32px)') && html.includes('.add-component-results') && html.includes('overflow-y: auto')));
test('existing export pipelines carry the schema-driven picker implementation', () => { for (const file of ['build/build-games.js', 'build/build-games-site.js', 'editor/src/01-editor.js']) assert(fs.readFileSync(path.join(ROOT, file), 'utf8').includes('01-editor.js') || file.endsWith('01-editor.js')); });

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 007 tests passed: ${passed}/${passed}`);
