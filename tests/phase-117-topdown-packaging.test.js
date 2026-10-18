'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const moduleName = '00-topdown-controller-2d.js';
const moduleText = fs.readFileSync(path.join(ROOT, 'editor', 'src', moduleName), 'utf8');
const coreText = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
function assertAssembly(assembled) {
  const moduleAt = assembled.indexOf(moduleText), coreAt = assembled.indexOf(coreText);
  assert(moduleAt >= 0, 'Actual assembled editor payload must contain complete Top-down module');
  assert(coreAt > moduleAt, 'Top-down must execute before editor core consumes its public API');
  assert.equal(assembled.indexOf(moduleText, moduleAt + moduleText.length), -1, 'Module included exactly once');
}
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); } }
(async () => {
  for (const playableOnly of [false, true]) await test(`Actual native ${playableOnly ? 'Playable' : 'Editable'} fetch/compose includes Top-down before core`, async () => {
    const nativeFunction = coreText.match(/async function buildExportHTML\(playableOnly\) \{[\s\S]*?\n\}/);
    assert(nativeFunction, 'Extract actual native export entrypoint');
    const fetched = [], context = {
      serializeProject: () => ({ levels: [{ objects: [] }] }),
      collectTouchLayoutIssues: () => [], OpusInputContexts: { collectIssues: () => [] },
      OpusSignals: { collectDependencies: () => ({ issues: [] }) },
      projectMeta: { title: 'Internal topdown packaging regression' }, currentUiConfig: { startScreen: {} },
      fetch: async relative => { fetched.push(relative); const absolute = path.resolve(ROOT, 'editor', relative);
        return { text: async () => fs.readFileSync(absolute, 'utf8') }; },
      composeExportHTML: options => options
    };
    vm.createContext(context); vm.runInContext(nativeFunction[0], context);
    require('./loot-export-fixture')(context);
    const composed = await context.buildExportHTML(playableOnly);
    assert.equal(composed.playableOnly, playableOnly);
    assertAssembly(composed.editorJS);
    assert.equal(fetched.filter(url => url === 'src/' + moduleName).length, 1);
  });
  for (const builder of ['build-games.js', 'build-games-site.js']) await test(`Actual ${builder} inline assembly includes complete Top-down before core`, () => {
    const source = fs.readFileSync(path.join(ROOT, 'build', builder), 'utf8');
    const assignment = source.match(/const editorJS = \[[\s\S]*?\]\.join\('\\n'\);/);
    assert(assignment, 'Extract actual builder input assembly');
    const context = { fs, path, ROOT }; vm.createContext(context);
    vm.runInContext(assignment[0] + '\nthis.assembled = editorJS;', context);
    assertAssembly(context.assembled);
  });
  await test('Actual engine-site packaging copies Top-down bytes to native script path', () => {
    const source = fs.readFileSync(path.join(ROOT, 'build', 'build-engine-site.js'), 'utf8');
    const declarations = source.match(/^const \w+Path = path\.join\([^\n]+\);/gm) || [];
    const copies = source.match(/^fs\.copyFileSync\([^\n]+\);/gm) || [];
    const observed = [], context = { path, ROOT, DIST_DIR: path.join(ROOT, 'dist'), SITE_DIR: path.join(ROOT, 'dist', 'engine-site'),
      fs: { copyFileSync: (from, to) => observed.push({ from, to, bytes: fs.readFileSync(from) }) } };
    vm.createContext(context); vm.runInContext(declarations.join('\n') + '\n' + copies.join('\n'), context);
    const expected = path.join(context.SITE_DIR, 'editor', 'src', moduleName);
    const copied = observed.filter(entry => entry.to === expected);
    assert.equal(copied.length, 1, 'Top-down copied exactly once into engine-site script path');
    assert.equal(copied[0].bytes.toString(), moduleText, 'Site module matches source byte-for-byte');
  });
  console.log(`Phase117 actual packaging assemblies: ${passed} PASS, ${failed} FAIL`);
  if (failed) process.exitCode = 1;
})();


