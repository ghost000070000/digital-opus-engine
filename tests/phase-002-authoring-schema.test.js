'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const authoring = require(path.join(ROOT, 'editor', 'src', '00-authoring-schema.js'));
const { composeExportHTML } = require(path.join(ROOT, 'build', 'export-template.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`ok ${passed} - ${name}`); }
  catch (error) { failed++; console.error(`not ok - ${name}\n${error.stack}`); }
}
function cube(extra = {}) { return { kind: 'cube', ...extra }; }
function emitter(extra = {}) {
  const options = { rate: 20, spread: 0.6, gravity: -0.15, maxParticles: 200, ...extra };
  return { kind: 'emitter', options, handle: { ...options } };
}
function stable(value) { return JSON.stringify(value); }

test('registry exposes the bounded proof schemas and the true Sprite renderer', () => {
assert.deepStrictEqual(authoring.registry.list().map((schema) => schema.id), ['transform', 'visual', 'sprite-renderer', 'ai-brain', 'health', 'damage', 'damage-resistance', 'hurtbox', 'hitbox', 'interactable', 'pickup', 'checkpoint', 'door-gate', 'moving-platform-3d', 'particle-emitter', 'trigger', 'box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d', 'body-2d', 'character-collision-2d', 'moving-platform-2d', 'platformer-controller-2d', 'topdown-controller-2d', 'jump-ability', 'sprint-ability', 'one-way-platform-2d', 'scene-collection']);
});
test('every schema declares identity, display, category, eligibility, ownership, version and migration hook', () => {
  for (const schema of authoring.registry.list()) {
    assert(schema.id && schema.displayName && schema.category);
    assert(Array.isArray(schema.eligibility) && schema.eligibility.length);
    assert.deepStrictEqual(schema.ownedFields, schema.fields.map((field) => field.key));
    assert.strictEqual(schema.serialization.owner, schema.id);
    assert.strictEqual(schema.serialization.duplicate, 'deep-copy');
    assert.strictEqual(schema.serialization.prefab, 'shared-record-path');
    assert(Number.isInteger(schema.version) && schema.version >= 1);
    assert.strictEqual(typeof schema.migrate, 'function');
  }
});
test('bounded field vocabulary includes Sprite and typed-reference needs', () => {
  for (const type of ['boolean', 'number', 'integer', 'string', 'color', 'enum', 'vec2', 'vec3', 'assetRef', 'objectRef', 'levelRef', 'objectiveRef', 'prefabRef', 'sortingLayerRef', 'parallaxLayerRef']) assert(authoring.FIELD_TYPES.includes(type));
  assert.deepStrictEqual(authoring.REFERENCE_TYPES, ['asset', 'object', 'level', 'objective', 'prefab', 'sortingLayer', 'parallaxLayer', 'collisionLayer', 'item', 'inputAction']);
  assert(authoring.FIELD_TYPES.includes('inputActionRef'));
});
test('legacy Health loads through the component seam and keeps its runtime owner', () => {
  const target = cube();
  authoring.applyRecord({ health: { max: 54, current: 41 } }, target);
  assert.deepStrictEqual(target.components.health, { version: 1, max: 54, current: 41 });
  assert.deepStrictEqual(target.health, { max: 54, current: 41 });
});
test('legacy Trigger loads through the component seam and keeps legacy flags', () => {
  const target = cube({ isTrigger: true });
  authoring.applyRecord({ isTrigger: true, triggerRepeat: false, triggerShape: 'sphere' }, target);
  assert.deepStrictEqual(target.components.trigger, { version: 1, repeat: false, shape: 'sphere' });
  assert.strictEqual(target.triggerRepeat, false);
  assert.strictEqual(target.triggerShape, 'sphere');
});
test('legacy Particle options load through the component seam and keep handle/options behavior', () => {
  const target = emitter();
  authoring.applyRecord({ kind: 'emitter', options: { rate: 7, spread: 2, gravity: -1, maxParticles: 77 } }, target);
  assert.deepStrictEqual(target.components['particle-emitter'], { version: 1, rate: 7, spread: 2, gravity: -1, maxParticles: 77 });
  assert.strictEqual(target.handle.rate, 7);
  assert.strictEqual(target.options.maxParticles, 77);
});
test('Health create-serialize-deserialize-serialize is deterministic', () => {
  const source = cube({ health: { max: 125, current: 80 } });
  const first = authoring.serializeComponents(source);
  const restored = cube(); authoring.applyRecord({ components: first }, restored);
  assert.strictEqual(stable(authoring.serializeComponents(restored)), stable(first));
});
test('Trigger create-serialize-deserialize-serialize is deterministic', () => {
  const source = cube({ isTrigger: true, triggerRepeat: true, triggerShape: 'sphere' });
  const first = authoring.serializeComponents(source);
  const restored = cube({ isTrigger: true }); authoring.applyRecord({ components: first }, restored);
  assert.strictEqual(stable(authoring.serializeComponents(restored)), stable(first));
});
test('Particle create-serialize-deserialize-serialize is deterministic', () => {
  const source = emitter({ rate: 12, spread: 0.3, gravity: -0.7, maxParticles: 88 });
  const first = authoring.serializeComponents(source);
  const restored = emitter(); authoring.applyRecord({ components: first }, restored);
  assert.strictEqual(stable(authoring.serializeComponents(restored)), stable(first));
});
test('default component values serialize explicitly with a version', () => {
  const target = cube({ health: { max: 100, current: 100 } });
  assert.deepStrictEqual(authoring.serializeComponents(target).health, { current: 100, max: 100, version: 1 });
});
test('missing known fields normalize to schema defaults', () => {
  const target = cube(); authoring.applyRecord({ components: { health: { version: 1, max: 30 } } }, target);
  assert.deepStrictEqual(target.components.health, { version: 1, max: 30, current: 100 });
});
test('known-component future authoring fields survive while runtime fields are stripped', () => {
  const target = cube();
  authoring.applyRecord({ components: { health: { version: 1, max: 20, current: 10, designerNote: 'boss', lastDamageAt: 44, _cache: true } } }, target);
  const saved = authoring.serializeComponents(target).health;
  assert.strictEqual(saved.designerNote, 'boss');
  assert(!('lastDamageAt' in saved));
  assert(!('_cache' in saved));
});
test('unknown component ids are inert, preserved, deterministic and runtime-cache-free', () => {
  const target = cube();
  authoring.applyRecord({ components: { 'future-system': { version: 4, z: 2, a: 1, _runtime: 9 } } }, target);
  assert.deepStrictEqual(authoring.serializeComponents(target)['future-system'], { a: 1, version: 4, z: 2 });
});
test('unknown newer known-component versions are preserved and reported, not applied', () => {
  const target = cube();
  authoring.applyRecord({ components: { health: { version: 9, max: 900, current: 800, futureRule: 'x' } } }, target);
  assert.strictEqual(target.health, undefined);
  assert.strictEqual(authoring.serializeComponents(target).health.futureRule, 'x');
  assert.strictEqual(authoring.validateComponent(target, 'health')[0].code, 'newer-version');
});
test('duplicate deep-copies Health data and preserves independent runtime state', () => {
  const source = cube({ health: { max: 90, current: 70 } });
  const duplicate = cube(); authoring.copyComponents(source, duplicate);
  duplicate.components.health.current = 3;
  assert.strictEqual(authoring.serializeComponents(source).health.current, 70);
  assert.strictEqual(duplicate.health.current, 70);
});
test('duplicate deep-copies Particle data without shared mutable records', () => {
  const source = emitter({ rate: 9 });
  const duplicate = emitter(); authoring.copyComponents(source, duplicate);
  duplicate.components['particle-emitter'].designer = { nested: true };
  assert.strictEqual(authoring.serializeComponents(source)['particle-emitter'].designer, undefined);
});
test('serialized snapshot can drive Undo and Redo without component data loss', () => {
  const target = cube({ health: { max: 100, current: 100 } });
  const before = authoring.serializeComponents(target);
  target.health.current = 25;
  const after = authoring.serializeComponents(target);
  authoring.applyRecord({ components: before }, target); assert.strictEqual(target.health.current, 100);
  authoring.applyRecord({ components: after }, target); assert.strictEqual(target.health.current, 25);
});
test('shared record path preserves component data through a prefab-style round trip', () => {
  const source = cube({ isTrigger: true, triggerRepeat: false, triggerShape: 'sphere', health: { max: 40, current: 40 } });
  const prefabRecord = { kind: 'cube', isTrigger: true, components: authoring.serializeComponents(source) };
  const instance = cube({ isTrigger: true }); authoring.applyRecord(prefabRecord, instance);
  const projectRecord = { kind: 'cube', isTrigger: true, components: authoring.serializeComponents(instance) };
  const loaded = cube({ isTrigger: true }); authoring.applyRecord(projectRecord, loaded);
  assert.strictEqual(stable(authoring.serializeComponents(loaded)), stable(prefabRecord.components));
});
test('Health validation returns structured creator-facing issues', () => {
  const target = cube({ components: { health: { version: 1, max: 0, current: 20 } } });
  const issues = authoring.validateComponent(target, 'health');
  assert(issues.some((entry) => entry.code === 'below-minimum'));
  assert(issues.every((entry) => entry.componentId === 'health' && entry.severity === 'error' && entry.message));
});
test('Particle validation reports negative rate and cap through structured issues', () => {
  const target = emitter(); target.components = { 'particle-emitter': { version: 1, rate: -1, spread: 1, gravity: 0, maxParticles: -2 } };
  const codes = authoring.validateComponent(target, 'particle-emitter').map((entry) => entry.code);
  assert(codes.includes('below-minimum'));
  assert(codes.includes('particle-rate-negative'));
  assert(codes.includes('particle-cap-negative'));
});
test('Trigger validation rejects unsupported enum values', () => {
  const target = cube({ isTrigger: true, components: { trigger: { version: 1, repeat: true, shape: 'capsule' } } });
  assert(authoring.validateComponent(target, 'trigger').some((entry) => entry.code === 'invalid-choice'));
});
test('registry invokes a bounded migration hook by schema version', () => {
  const registry = new authoring.AuthoringSchemaRegistry();
  registry.register({ id: 'migration-proof', displayName: 'Migration Proof', category: 'Test', version: 2, eligibility: ['any'], fields: [{ key: 'value', type: 'number' }], defaults: { value: 0 }, migrate: (record, from) => from === 1 ? { ...record, value: record.oldValue, version: 2 } : record });
  const api = authoring.createAuthoringApi(registry); const target = { kind: 'anything' };
  api.applyRecord({ components: { 'migration-proof': { version: 1, oldValue: 7 } } }, target);
  assert.deepStrictEqual(target.components['migration-proof'], { version: 2, value: 7, oldValue: 7 });
});
test('future Sprite eligibility is expressible without Sprite behavior', () => {
  const registry = new authoring.AuthoringSchemaRegistry();
  registry.register({ id: 'sprite-proof', displayName: 'Sprite Proof', category: 'Rendering', version: 1, eligibility: ['sprite'], fields: [{ key: 'pivot', type: 'vec2' }], defaults: { pivot: [0.5, 0.5] } });
  const api = authoring.createAuthoringApi(registry); const target = { kind: 'sprite' };
  assert.deepStrictEqual(api.ensureComponent(target, 'sprite-proof'), { version: 1, pivot: [0.5, 0.5] });
});
test('vec2, vec3, color, enum and typed references normalize through the shared field contract', () => {
  const registry = new authoring.AuthoringSchemaRegistry();
  registry.register({ id: 'field-proof', displayName: 'Fields', category: 'Test', version: 1, eligibility: ['any'], fields: [
    { key: 'v2', type: 'vec2' }, { key: 'v3', type: 'vec3' }, { key: 'color', type: 'color' }, { key: 'mode', type: 'enum', choices: ['a', 'b'] }, { key: 'asset', type: 'assetRef', nullable: true },
  ], defaults: { v2: [0, 0], v3: [0, 0, 0], color: '#ffffff', mode: 'a', asset: null } });
  const api = authoring.createAuthoringApi(registry); const target = { kind: 'anything', components: { 'field-proof': { version: 1, v2: { x: 1, y: 2 }, v3: [3, 4, 5], color: '#AABBCC', mode: 'b', asset: 'texture-1' } } };
  const saved = api.serializeComponents(target)['field-proof'];
  assert.deepStrictEqual(saved.v2, [1, 2]); assert.deepStrictEqual(saved.v3, [3, 4, 5]); assert.strictEqual(saved.color, '#aabbcc'); assert.strictEqual(saved.asset, 'texture-1');
});
test('irrelevant legacy objects serialize with no component bag', () => {
  assert.strictEqual(authoring.serializeComponents(cube()), undefined);
});

const htmlTemplate = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8');
const engineJS = fs.readFileSync(path.join(ROOT, 'dist', 'opus-engine.js'), 'utf8');
const inspectorFieldsJS = fs.readFileSync(path.join(ROOT, 'editor', 'src', '00-inspector-fields.js'), 'utf8');
const schemaJS = fs.readFileSync(path.join(ROOT, 'editor', 'src', '00-authoring-schema.js'), 'utf8');
const plumbingJS = fs.readFileSync(path.join(ROOT, 'editor', 'src', '00-authoring-plumbing.js'), 'utf8');
const languageJS = fs.readFileSync(path.join(ROOT, 'editor', 'src', '00-authoring-language.js'), 'utf8');
const editorCoreJS = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
const templateJS = fs.readFileSync(path.join(ROOT, 'build', 'export-template.js'), 'utf8');
const editorJS = `${inspectorFieldsJS}\n${schemaJS}\n${plumbingJS}\n${languageJS}\n${editorCoreJS}`;
const embeddedProjectJSON = JSON.stringify({ levels: [{ id: 'level1', objects: [{ kind: 'cube', components: { health: { version: 1, max: 10, current: 8 } } }] }] });
const exportOptions = { htmlTemplate, engineJS, editorJS, templateJS, embeddedProjectJSON, title: 'Phase 002 Proof' };

test('Editable Export contains the exact schema module and component record', () => {
  const html = composeExportHTML({ ...exportOptions, playableOnly: false });
  assert(html.includes('Digital Opus authoring schema/component seam.'));
  assert(html.includes('"components":{"health":{"version":1,"max":10,"current":8}}'));
  const bootFlags = html.match(/<script>(window\.__OPUS_EMBEDDED_PROJECT__[\s\S]*?)<\/script>/)[1];
  assert(!bootFlags.includes('__OPUS_PLAYABLE_ONLY__ = true'));
});
test('Playable Export contains the same schema module and component record', () => {
  const html = composeExportHTML({ ...exportOptions, playableOnly: true });
  assert(html.includes('Digital Opus authoring schema/component seam.'));
  assert(html.includes('"components":{"health":{"version":1,"max":10,"current":8}}'));
  assert(html.includes('__OPUS_PLAYABLE_ONLY__ = true'));
});
test('Editable and Playable exports embed one identical editor/runtime implementation', () => {
  const editable = composeExportHTML({ ...exportOptions, playableOnly: false });
  const playable = composeExportHTML({ ...exportOptions, playableOnly: true });
  assert.strictEqual(editable.split(schemaJS).length, 2);
  assert.strictEqual(playable.split(schemaJS).length, 2);
  assert(editable.includes(editorCoreJS)); assert(playable.includes(editorCoreJS));
});

console.log(`\nPhase 002 authoring schema: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
