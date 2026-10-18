'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fields = require('../editor/src/00-inspector-fields');
const authoring = require('../editor/src/00-authoring-schema');
let passed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS ${name}`); }
  catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}
function field(type, extra = {}) { return fields.descriptor({ key: 'proof', label: 'Proof', type, ...extra }); }

console.log('Phase 006 reusable Inspector field tests');

test('the bounded field taxonomy contains every promised editor', () => assert.deepStrictEqual(fields.FIELD_TYPES, [
  'boolean', 'integer', 'number', 'string', 'multiline', 'enum', 'color', 'vec2', 'vec3',
  'assetRef', 'objectRef', 'levelRef', 'objectiveRef', 'prefabRef', 'sortingLayerRef', 'parallaxLayerRef', 'collisionLayerRef', 'collisionMaskRefs', 'itemRef', 'inputActionRef',
]));
test('reference taxonomy stays explicit', () => assert.deepStrictEqual(fields.REFERENCE_TYPES, ['asset', 'object', 'level', 'objective', 'prefab', 'sortingLayer', 'parallaxLayer', 'collisionLayer', 'item', 'inputAction']));
test('descriptors require a stable key', () => assert.throws(() => fields.descriptor({ type: 'number' })));
test('descriptors reject unsupported types', () => assert.throws(() => fields.descriptor({ key: 'x', type: 'matrix' })));
test('descriptors reject inverted numeric bounds', () => assert.throws(() => field('number', { min: 2, max: 1 })));
test('descriptors expose predictable defaults', () => assert.strictEqual(field('number', { defaultValue: 7 }).defaultValue, 7));
test('number rejects NaN text', () => assert.strictEqual(fields.coerceValue(field('number'), 'nope').issues[0].code, 'finite-number'));
test('number rejects Infinity', () => assert.strictEqual(fields.coerceValue(field('number'), Infinity).valid, false));
test('number clamps below minimum', () => assert.strictEqual(fields.coerceValue(field('number', { min: 1 }), -4).value, 1));
test('number clamps above maximum', () => assert.strictEqual(fields.coerceValue(field('number', { max: 9 }), 20).value, 9));
test('number applies explicit precision', () => assert.strictEqual(fields.coerceValue(field('number', { precision: 2 }), 1.236).value, 1.24));
test('integer rounds to a whole number', () => assert.strictEqual(fields.coerceValue(field('integer'), 4.7).value, 5));
test('optional nullable number accepts empty input', () => assert.deepStrictEqual(fields.coerceValue(field('number'), ''), { valid: true, empty: true, value: null, issues: [] }));
test('required number reports empty input', () => assert.strictEqual(fields.coerceValue(field('number', { required: true }), '').issues[0].code, 'required'));
test('boolean coercion is deterministic', () => assert.strictEqual(fields.coerceValue(field('boolean'), 1).value, true));
test('string coercion preserves author text', () => assert.strictEqual(fields.coerceValue(field('string'), 42).value, '42'));
test('multiline coercion preserves author text', () => assert.strictEqual(fields.coerceValue(field('multiline'), 'a\nb').value, 'a\nb'));
test('enum accepts a declared choice', () => assert.strictEqual(fields.coerceValue(field('enum', { choices: ['a', 'b'] }), 'b').valid, true));
test('enum rejects an undeclared choice', () => assert.strictEqual(fields.coerceValue(field('enum', { choices: ['a'] }), 'b').issues[0].code, 'invalid-choice'));
test('color normalizes case', () => assert.strictEqual(fields.coerceValue(field('color'), '#AABBCC').value, '#aabbcc'));
test('color rejects incomplete hex', () => assert.strictEqual(fields.coerceValue(field('color'), '#abc').issues[0].code, 'invalid-color'));
test('color HTML pairs a visual picker with editable normalized text', () => { const html = fields.controlHtml(field('color'), '#aabbcc'); assert(html.includes('data-field-editor-color-role="picker"') && html.includes('data-field-editor-color-role="text"')); });
test('vec2 requires both axes', () => assert.strictEqual(fields.coerceValue(field('vec2'), [1]).issues[0].code, 'vector-size'));
test('vec2 parses finite axes', () => assert.deepStrictEqual(fields.coerceValue(field('vec2'), ['1.5', '2']).value, [1.5, 2]));
test('vec3 clamps each axis', () => assert.deepStrictEqual(fields.coerceValue(field('vec3', { min: 0, max: 2 }), [-1, 1, 8]).value, [0, 1, 2]));
test('references accept stable ids', () => assert.strictEqual(fields.coerceValue(field('assetRef'), 'asset-1').value, 'asset-1'));
test('required references reject empty ids', () => assert.strictEqual(fields.coerceValue(field('objectRef', { required: true }), '').issues[0].code, 'required'));
test('custom validators join the shared issue shape', () => assert.strictEqual(fields.validateValue(field('string', { validate: () => [{ code: 'custom', message: 'No.' }] }), 'x').issues[0].field, 'proof'));
test('modified state compares vectors by value', () => assert.strictEqual(fields.isModified(field('vec2', { defaultValue: [1, 2] }), [1, 2]), false));
test('modified state detects scalar edits', () => assert.strictEqual(fields.isModified(field('number', { defaultValue: 1 }), 2), true));
test('reset returns a defensive clone', () => { const schema = field('vec2', { defaultValue: [1, 2] }); const reset = fields.resetValue(schema); reset[0] = 9; assert.deepStrictEqual(schema.defaultValue, [1, 2]); });
test('numeric HTML carries min max step and generic hooks', () => { const html = fields.controlHtml(field('number', { min: 0, max: 5, step: 0.25 }), 2); assert(html.includes('min="0"') && html.includes('max="5"') && html.includes('step="0.25"') && html.includes('data-field-editor-key="proof"')); });
test('read-only and disabled states reach native controls', () => { const html = fields.controlHtml(field('string', { disabled: true, readOnly: true }), 'x'); assert(html.includes(' disabled') && html.includes(' readonly') && html.includes('aria-readonly="true"')); });
test('multiline uses a native textarea', () => assert(fields.controlHtml(field('multiline'), 'notes').startsWith('<textarea')));
test('missing references remain visible instead of being discarded', () => { const html = fields.controlHtml(field('levelRef'), 'gone-level', []); assert(html.includes('(Missing) gone-level') && html.includes('data-unavailable="true"')); });
test('vectors expose accessible axis-specific native number controls', () => { const html = fields.controlHtml(field('vec3'), [1, 2, 3]); assert.strictEqual((html.match(/type="number"/g) || []).length, 3); assert(html.includes('data-field-editor-axis="z"') && html.includes('aria-label="Proof Z"')); });
test('schema taxonomy and reusable taxonomy stay aligned', () => assert.deepStrictEqual([...authoring.FIELD_TYPES].sort(), [...fields.FIELD_TYPES].sort()));
test('representative component fields provide label help and defaults', () => { for (const schema of authoring.registry.list()) for (const descriptor of schema.fields) { assert(descriptor.label); assert(descriptor.help); assert(Object.prototype.hasOwnProperty.call(schema.defaults, descriptor.key)); } });
test('central schema validation enforces required values', () => { const target = { kind: 'cube', components: { health: { version: 1, max: null, current: 1 } } }; assert(authoring.validateComponent(target, 'health').some((entry) => entry.code === 'required')); });
test('schema renderer delegates to the reusable section contract', () => { const source = fs.readFileSync(path.join(ROOT, 'editor', 'src', '00-authoring-schema.js'), 'utf8'); assert(source.includes('OpusInspectorFields') && source.includes('mountSection(container')); });
test('live editor loads field editors before authoring schemas', () => { const html = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8'); assert(html.indexOf('00-inspector-fields.js') < html.indexOf('00-authoring-schema.js')); assert(html.includes('.field-editor-row.is-modified')); });
test('every export pipeline embeds the reusable editor module', () => { for (const file of ['build/build-games.js', 'build/build-games-site.js', 'editor/src/01-editor.js']) assert(fs.readFileSync(path.join(ROOT, file), 'utf8').includes('00-inspector-fields.js'), file); });

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 006 tests passed: ${passed}/${passed}`);
