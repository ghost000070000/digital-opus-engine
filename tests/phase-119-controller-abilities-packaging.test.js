'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), name = '00-controller-abilities.js';
const moduleText = fs.readFileSync(path.join(ROOT, 'editor/src', name), 'utf8'), core = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
function check(text) { const at = text.indexOf(moduleText); assert(at >= 0, 'Complete public abilities module packaged'); assert(text.indexOf(core) > at, 'Abilities execute before actual core'); assert.equal(text.indexOf(moduleText, at + moduleText.length), -1, 'Included exactly once'); }
let passed = 0, failed = 0;
async function test(label, fn) { try { await fn(); passed++; console.log('PASS ' + label); } catch (e) { failed++; console.error('FAIL ' + label + ': ' + e.message); } }
(async () => {
  for (const playableOnly of [false, true]) await test('Actual native ' + (playableOnly ? 'Playable' : 'Editable') + ' fetch/compose packages abilities before core', async () => {
    const fn = core.match(/async function buildExportHTML\(playableOnly\) \{[\s\S]*?\n\}/); assert(fn);
    const fetched = [], c = { serializeProject: () => ({ levels: [{ objects: [] }] }), collectTouchLayoutIssues: () => [], OpusInputContexts: { collectIssues: () => [] }, OpusSignals: { collectDependencies: () => ({ issues: [] }) }, projectMeta: { title: 'Internal abilities packaging' }, currentUiConfig: { startScreen: {} }, fetch: async file => { fetched.push(file); return { text: async () => fs.readFileSync(path.resolve(ROOT, 'editor', file), 'utf8') }; }, composeExportHTML: x => x };
    vm.createContext(c); vm.runInContext(fn[0], c); require('./loot-export-fixture')(c); const result = await c.buildExportHTML(playableOnly); check(result.editorJS); assert.equal(fetched.filter(x => x === 'src/' + name).length, 1);
  });
  for (const builder of ['build-games.js', 'build-games-site.js']) await test('Actual ' + builder + ' assembly includes abilities', () => {
    const text = fs.readFileSync(path.join(ROOT, 'build', builder), 'utf8'), assignment = text.match(/const editorJS = \[[\s\S]*?\]\.join\('\\n'\);/); assert(assignment); const c = { fs, path, ROOT }; vm.createContext(c); vm.runInContext(assignment[0] + '\nthis.result = editorJS;', c); check(c.result);
  });
  await test('Actual engine-site copy packages identical abilities bytes', () => {
    const text = fs.readFileSync(path.join(ROOT, 'build/build-engine-site.js'), 'utf8'), copies = [], c = { path, ROOT, DIST_DIR: path.join(ROOT, 'dist'), SITE_DIR: path.join(ROOT, 'dist/engine-site'), fs: { copyFileSync: (from, to) => copies.push({ from, to }) } };
    vm.createContext(c); vm.runInContext((text.match(/^const \w+Path = path\.join\([^\n]+\);/gm) || []).join('\n') + '\n' + (text.match(/^fs\.copyFileSync\([^\n]+\);/gm) || []).join('\n'), c);
    const matched = copies.filter(x => x.to === path.join(c.SITE_DIR, 'editor/src', name)); assert.equal(matched.length, 1); assert.equal(fs.readFileSync(matched[0].from, 'utf8'), moduleText);
  });
  console.log(`Phase119 actual packaging: ${passed} PASS, ${failed} FAIL`); if (failed) process.exitCode = 1;
})();
