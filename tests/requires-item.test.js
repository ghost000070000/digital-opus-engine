'use strict';
// Requires item: the gate runs, consumes and messages correctly, and is wired before every action.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/69-requires-item.js'), 'utf8');
const toasts = [];
const ctx = { Math, Number, String, WeakMap, Date, window: { __gameInventory: {} }, showToast: (t) => toasts.push(t) };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('// --- Inspector:')), ctx);

assert.strictEqual(ctx.normalizeRequirement({ item: '  ' }), null, 'needs an item name');
assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.normalizeRequirement({ item: ' Key ', count: '2.7', consume: 'yes' }))), { item: 'Key', count: 2, consume: false, message: '' });

const behavior = { requires: { item: 'Key', count: 1, consume: true, message: 'Locked: find the Key' } };
assert.strictEqual(ctx.behaviorRequirementGate(behavior, null, 100000), false, 'no key: does not run');
assert.deepStrictEqual(toasts, ['Locked: find the Key'], 'tells the player why');
ctx.behaviorRequirementGate(behavior, null, 100500);
assert.strictEqual(toasts.length, 1, 'message is not spammed every frame');
ctx.window.__gameInventory.Key = 1;
assert.strictEqual(ctx.behaviorRequirementGate(behavior, null, 105000), true, 'with the key: runs');
assert.strictEqual(ctx.window.__gameInventory.Key, 0, 'and uses it up');
const keep = { requires: { item: 'Badge', count: 2 } };
ctx.window.__gameInventory.Badge = 2;
assert.strictEqual(ctx.behaviorRequirementGate(keep, null, 109000), true);
assert.strictEqual(ctx.window.__gameInventory.Badge, 2, 'kept when not used up');
ctx.window.__gameInventory.Badge = 1;
assert.strictEqual(ctx.behaviorRequirementGate(keep, null, 120000), false, 'counts must be met');
assert.strictEqual(toasts[toasts.length - 1], 'Needs 2 × Badge', 'default message names what is missing');
assert.strictEqual(ctx.behaviorRequirementGate({}, null), true, 'no requirement: always runs');

const forms = fs.readFileSync(path.join(root, 'editor/src/modules/25-action-forms.js'), 'utf8');
assert(forms.includes("behavior.requires && typeof behaviorRequirementGate === 'function' && !behaviorRequirementGate(behavior, item)) return;"), 'checked before every action, graphs included');
assert(fs.readFileSync(path.join(root, 'editor/index.html'), 'utf8').includes('id="palette-ready-keyAndDoor"'));
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('69-requires-item.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Requires item: gate, consume, messages, wiring PASS');
