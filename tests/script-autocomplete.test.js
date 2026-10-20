'use strict';
// Script editor suggestions for the text before the caret.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/65-script-autocomplete.js'), 'utf8');
const ctx = { RegExp, Set, Math };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('// --- Popup ---')), ctx);
const at = (code, force) => { const r = ctx.scriptCompletionsAt(code, code.length, force); return r ? JSON.parse(JSON.stringify(r.items.map((i) => i.label))) : null; };

assert(at('ctx.').includes('entity') && at('ctx.').includes('toast(message)'), 'ctx members');
assert.deepStrictEqual(at('  ctx.pl'), ['player', 'playSound(frequency, duration)'], 'filtered by what was typed');
assert(at('ctx.entity.').includes('rotationY'));
assert(at('ctx.player.position.').includes('x'), 'nested types');
assert(at('ctx.input.').includes('isDown(code)'));
assert(at('ctx.game.').includes('win()'));
assert(at('ctx.find(\'Door\').').includes('visible'), 'call results have types too');
assert(at('const p = ctx.position;\np.').includes('add(other)'), 'variables assigned from ctx keep their type');
assert(at('const v = ctx.vec3(1, 2, 3);\nv.').includes('length()'));
assert.strictEqual(at('foo.'), null, 'unknown objects stay quiet');
assert.strictEqual(at('ctx.vars.'), null, 'free-form values stay quiet');

assert(at('ctx.ki').includes('kick(x, y, z)') && at('ctx.velocity.').includes('x'), 'physics members');
assert(at('function onObj').includes('onObjectEnter'), 'object hooks');
const hooks = at('function onU');
assert.deepStrictEqual(hooks, ['onUpdate'], 'hook names after function');
assert(!at('function onStart(ctx) {}\nfunction ').includes('onStart'), 'already-declared hooks are not offered again');
assert.deepStrictEqual(at('c', true), ['ctx'], 'Ctrl+Space offers ctx');

// Inserting: methods get parentheses with the caret inside when they take arguments; hooks get a body.
const r = ctx.scriptCompletionsAt('ctx.toa', 7);
assert.strictEqual(r.from, 4);
assert.strictEqual(r.items[0].insert, 'toast()');
assert.strictEqual(r.items[0].caretBack, 1);
const h = ctx.scriptCompletionsAt('function onSt', 13).items[0];
assert.strictEqual(h.insert, 'onStart(ctx) {\n  \n}');
assert.strictEqual(h.caretBack, 2, 'caret lands inside the body');

// Enter keeps indentation and goes one level deeper after an opening brace.
assert.strictEqual(ctx.scriptNewlineIndent('  ctx.log(1);', 13), '\n  ');
assert.strictEqual(ctx.scriptNewlineIndent('function onStart(ctx) {', 23), '\n  ');
assert.strictEqual(ctx.scriptNewlineIndent('a\n    if (x) {', 15), '\n      ');

const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('65-script-autocomplete.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Script autocomplete: ctx members, nested and variable types, hooks, insertion PASS');
