'use strict';
// HUD helpers: score label and inventory widget are added once, inside the screen.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/71-hud-helpers.js'), 'utf8');
let n = 0;
const ctx = { playMode: false, currentUiConfig: { hudElements: [] }, generateHudElementId: () => `hud${++n}`, renderHudElementList() {} };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('// Coin Trail')), ctx);

const label = ctx.ensureScoreHud('score');
assert(label && label.binding.source === 'counter' && label.binding.name === 'score', 'bound to the score counter');
assert(label.keepInside === true && label.anchor === 'top-right' && label.offsetX <= 0, 'kept inside the right edge');
assert(!/ \{value\}|Score: /.test(label.bindingTemplate.replace(/ /g, '~')), 'non-breaking spaces keep it on one line');
assert.strictEqual(label.bindingTemplate.replace(/ /g, ' '), '⭐ Score: {value}');
assert.strictEqual(ctx.ensureScoreHud('score'), null, 'never added twice');
assert(ctx.ensureScoreHud('coins'), 'a different counter gets its own label');
assert(ctx.ensureInventoryHud() && ctx.ensureInventoryHud() === null, 'one inventory widget');
ctx.playMode = true;
assert.strictEqual(ctx.ensureScoreHud('time'), null, 'never during Play');

const placement = fs.readFileSync(path.join(root, 'editor/src/modules/05-placement.js'), 'utf8');
assert(placement.includes("if (typeof ensureScoreHud === 'function') ensureScoreHud('score');"), 'Collectibles bring their score display');
assert(fs.readFileSync(path.join(root, 'editor/src/modules/69-requires-item.js'), 'utf8').includes("if (typeof ensureInventoryHud === 'function') ensureInventoryHud();"), 'the Key brings the inventory widget');
assert(fs.readFileSync(path.join(root, 'editor/index.html'), 'utf8').includes('id="palette-ready-coinTrail"'));
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('71-hud-helpers.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('HUD helpers: score label, inventory widget, once and inside PASS');
