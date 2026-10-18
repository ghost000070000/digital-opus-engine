'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const language = require('../editor/src/00-authoring-language');

const ROOT = path.resolve(__dirname, '..');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('taxonomy defines thirteen non-overlapping authoring concepts', () => assert.strictEqual(new Set(language.TAXONOMY.map((entry) => entry.id)).size, 13));
test('every taxonomy concept has concise help', () => language.TAXONOMY.forEach((entry) => assert(entry.label && entry.help.length > 10 && entry.help.length < 180)));
test('category vocabulary is bounded and unique', () => assert.strictEqual(new Set(language.CATEGORIES).size, 13));
test('component metadata uses stable schema ids', () => assert.deepStrictEqual(language.COMPONENTS.map((entry) => entry.id), ['health', 'trigger', 'particle-emitter', 'trigger-collider-2d', 'body-2d']));
test('components use noun labels and valid categories', () => language.COMPONENTS.forEach((entry) => assert(entry.label && language.CATEGORIES.includes(entry.category))));
test('component help is picker-sized', () => language.COMPONENTS.forEach((entry) => assert(entry.help.length > 10 && entry.help.length < 160)));
test('event metadata preserves legacy order/default and appends dedicated Signal and Controller sources', () => assert.deepStrictEqual(language.EVENTS.map((entry) => entry.id), ['click', 'enter', 'exit', 'start', 'update', 'stay', 'interact', 'spriteAnimationEvent', 'trigger2DEnter', 'trigger2DStay', 'trigger2DExit', 'signal', 'controllerStateEvent']));
test('event labels consistently start with On', () => language.EVENTS.forEach((entry) => assert(/^On /.test(entry.label))));
test('historical event wording remains an alias', () => assert.strictEqual(language.resolveByIdOrAlias('On Enter', language.EVENTS), 'enter'));
test('preset metadata preserves palette ids', () => assert(language.PRESETS.some((entry) => entry.id === 'checkpointPreset') && language.PRESETS.some((entry) => entry.id === 'projectilePreset')));
test('preset labels describe creator roles', () => assert(language.PRESETS.every((entry) => entry.label && entry.help)));
test('proximity door wording does not promise animation; historical label still resolves', () => {
  const door = language.PRESETS.find(entry => entry.id === 'door');
  assert.strictEqual(door.label, 'Proximity Door');
  assert(door.help.includes('hides once') && door.help.includes('does not animate'));
  assert.strictEqual(language.resolveByIdOrAlias('Sliding Door', language.PRESETS), 'door');
});

test('action enrichment keeps serialized object keys unchanged', () => {
  const actions = { sound: { label: 'Play Sound', fields: [] }, moveObject: { label: 'Move Object (relative)', fields: [] }, script: { label: 'Advanced: Custom Script', fields: [] } };
  const before = Object.keys(actions);
  language.enrichActions(actions);
  assert.deepStrictEqual(Object.keys(actions), before);
});
test('actions gain stable id, label, category, help and aliases', () => {
  const actions = { moveObject: { label: 'Move Object (relative)', fields: [] } };
  language.enrichActions(actions);
  assert.deepStrictEqual({ id: actions.moveObject.id, label: actions.moveObject.label, category: actions.moveObject.category }, { id: 'moveObject', label: 'Move Object', category: 'Transform' });
  assert(actions.moveObject.help && actions.moveObject.aliases.includes('Move Object (relative)'));
});
test('old serialized action identity resolves directly', () => {
  const actions = { sound: { label: 'Play Sound', fields: [] } };
  language.enrichActions(actions);
  assert.strictEqual(language.resolveActionId('sound', actions), 'sound');
});
test('historical Play Audio alias resolves to sound', () => {
  const actions = { sound: { label: 'Play Sound', fields: [] } };
  language.enrichActions(actions);
  assert.strictEqual(language.resolveActionId('Play Audio', actions), 'sound');
});
test('historical action labels resolve without becoming serialized ids', () => {
  const actions = { setVisibility: { label: 'Show/Hide Object', fields: [] } };
  language.enrichActions(actions);
  assert.strictEqual(language.resolveActionId('Show/Hide Object', actions), 'setVisibility');
  assert.strictEqual(actions['Show/Hide Object'], undefined);
});
test('action creator labels are verb-led', () => Object.values(language.ACTION_LABELS).forEach((label) => assert(/^[A-Z][a-z]+/.test(label))));
test('action categories use only the shared category set', () => {
  const actions = { sound: { label: 'Play Sound' }, damageObject: { label: 'Damage Object' }, saveGame: { label: 'Save Game' }, script: { label: 'Custom Script' } };
  language.enrichActions(actions);
  Object.values(actions).forEach((definition) => assert(language.CATEGORIES.includes(definition.category)));
});

test('condition metadata has a scoped unique id and stable serialized id', () => {
  const graph = language.conditionMetadata('graph', 'healthAtMost', { fields: [] });
  const ai = language.conditionMetadata('ai', 'healthAtMost', { fields: [] });
  assert.notStrictEqual(graph.id, ai.id);
  assert.strictEqual(graph.serializedId, 'healthAtMost');
  assert.strictEqual(ai.serializedId, 'healthAtMost');
});
test('condition labels read as states or questions', () => assert.strictEqual(language.conditionLabel('graph', 'isFlagTrue'), 'Flag Is Set'));
test('condition aliases retain historical labels', () => assert(language.conditionMetadata('graph', 'isFlagTrue', { label: 'Is Flag True', fields: [] }).aliases.includes('Is Flag True')));
test('condition enrichment preserves serialized keys', () => {
  const conditions = { isFlagTrue: { label: 'Is Flag True', kind: 'condition', fields: [] } };
  language.enrichConditions(conditions, 'graph');
  assert.deepStrictEqual(Object.keys(conditions), ['isFlagTrue']);
  assert.strictEqual(conditions.isFlagTrue.serializedId, 'isFlagTrue');
});
test('condition metadata carries fields and concise help', () => {
  const metadata = language.conditionMetadata('graph', 'hasItem', { label: 'Has Item', fields: [{ key: 'name' }] });
  assert.strictEqual(metadata.fields.length, 1);
  assert(metadata.help.length > 10 && metadata.help.length < 160);
});

const core = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8');
test('ACTION_TYPES remains the action semantic authority', () => assert(core.includes('const ACTION_TYPES = {') && core.includes('OpusAuthoringLanguage.enrichActions(ACTION_TYPES)')));
test('Behavior picker reads canonical descriptors from ACTION_TYPES', () => { assert(core.includes('const behaviorLogicChoices = OpusAuthoringLanguage.logicEntries(ACTION_TYPES)')); const def={message:{label:'Custom authoritative label'}}; assert.strictEqual(language.logicEntries(def).find(e=>e.id==='message').label,def.message.label); });
test('Graph action nodes are generated from ACTION_TYPES labels', () => assert(core.includes("GRAPH_NODE_TYPES[type] = { label: def.label, kind: 'action', fields: def.fields }")));
test('Sequence action picker reads canonical descriptors from ACTION_TYPES', () => { assert(core.includes("OpusAuthoringLanguage.logicEntries(ACTION_TYPES,{surface:'sequence'})")); const def={message:{label:'Custom authoritative label'}}; assert.strictEqual(language.logicEntries(def,{surface:'sequence'}).find(e=>e.id==='message').label,def.message.label); });
test('Animation Events read ACTION_TYPES labels', () => assert(core.includes('escapeHtml(ACTION_TYPES[a].label)')));
test('Behavior event labels come from canonical event metadata', () => assert(core.includes('OpusAuthoringLanguage.EVENTS.map')));
test('AI Conditions render canonical labels without changing ids', () => assert(core.includes("conditionLabel('ai', c)")));
test('world-space Billboard label removes Sprite ambiguity', () => assert(html.includes('World-Space Billboard')));
test('language module loads before the editor core', () => assert(html.indexOf('src/00-authoring-language.js?') < html.indexOf('src/01-editor.js?')));
test('creator-facing labels contain no Wave or Priority implementation jargon', () => {
  const visibleMarkup = `${html}\n${core}`;
  assert(!/<(?:label|div|span)[^>]*>[^<]*(?:Wave|Priority)/.test(visibleMarkup));
});

let failures = 0;
for (const [index, entry] of tests.entries()) {
  try { entry.fn(); console.log(`ok ${index + 1} - ${entry.name}`); }
  catch (error) { failures++; console.error(`not ok ${index + 1} - ${entry.name}\n  ${error.stack}`); }
}
console.log(`\nPhase 005 authoring language: ${tests.length - failures} passed, ${failures} failed`);
if (failures) process.exitCode = 1;
