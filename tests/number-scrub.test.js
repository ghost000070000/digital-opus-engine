'use strict';
// Drag-to-scrub: value per pixel, Shift/Alt speed, rounding to the field's step, limits.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/63-number-scrub.js'), 'utf8');
const ctx = { Math, Number, String, Infinity };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf("document.addEventListener('pointerdown'")), ctx);

assert.strictEqual(ctx.numberScrubValue(0, 40, 0.1), 4, 'one step per pixel');
assert.strictEqual(ctx.numberScrubValue(1, -15, 0.1), -0.5);
assert.strictEqual(ctx.numberScrubValue(0, 7, 0.1, { fast: true }), 7, 'Shift is 10x');
assert.strictEqual(ctx.numberScrubValue(0, 7, 0.1, { fine: true }), 0.07, 'Alt is 10x finer');
assert.strictEqual(ctx.numberScrubValue(0.3, 1, 0.1), 0.4, 'no floating-point noise');
assert.strictEqual(ctx.numberScrubValue(10, 3, 1), 13, 'integer steps stay integers');
assert.strictEqual(ctx.numberScrubValue(1, -50, 0.1, { min: 0.01 }), 0.01, 'respects the field minimum');
assert.strictEqual(ctx.numberScrubValue(170, 50, 1, { max: 180 }), 180, 'and maximum');
assert.strictEqual(ctx.numberScrubStep({ step: 'any' }), 0.1, 'fields without a numeric step scrub by 0.1');
assert(source.includes("scrub.input.focus(); // the field's own Undo checkpoint"), 'one Undo step per scrub');
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('63-number-scrub.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Number scrub: per-pixel steps, modifiers, rounding, limits PASS');
