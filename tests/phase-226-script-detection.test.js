'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require.resolve('../editor/src/01-editor.js'), 'utf8');
const start = source.indexOf('function projectHasScripts('), end = source.indexOf('\n// Additive only:', start);
assert(start >= 0 && end > start); const c = {}; vm.createContext(c); vm.runInContext(source.slice(start, end), c);
const code = 'window.__privateCounter = 1;';
for (const input of [
  [{ kind: 'cube', behaviors: [{ action: 'script', param: code }] }],
  [{ kind: 'sprite', behaviors: [{ action: 'script', params: { code } }] }],
  [{ kind: 'cube', behaviors: [{ action: 'script', params: { code } }] }],
  { levels: [{ objects: [] }, { objects: [{ kind: 'sprite', behaviors: [{ action: 'graph', graph: { nodes: [{ id: 'n', type: 'script', code }] } }] }] }] },
  { prefabs: [{ name: 'Later spawn', record: { kind: 'cube', behaviors: [{ action: 'script', param: code }] } }] },
  { graphFunctions: [{ graph: { nodes: [{ type: 'script', code }] } }] },
  { levels: [{ sequences: [{ steps: [{ actionType: 'script', action: 'script', params: { code } }] }] }] },
]) {
  const before = JSON.stringify(input); assert.equal(c.projectHasScripts(input), true, JSON.stringify(input)); assert.equal(JSON.stringify(input), before);
}
for (const input of [null, undefined, [], { levels: [{ objects: [{ kind: 'sprite', behaviors: [{ action: 'message', params: { text: 'script' } }] }] }] }, { meta: { title: 'script' }, assets: [{ positions: [1, 2, 3] }] }]) assert.equal(c.projectHasScripts(input), false);
const cycle = {}; cycle.self = cycle; assert.equal(c.projectHasScripts(cycle), false);
const tooMany = Array.from({ length: 100002 }, () => ({})); assert.equal(c.projectHasScripts(tooMany), true, 'Unreviewable input fails closed');
assert(source.includes('loadProjectData(levels[currentLevelIndex].objects, sourceLabel, normalized.prefabs, parsed)'), 'Full canonical document includes other levels/Prefab/library actions at trust boundary');
Object.assign(c, { validateImportedSceneRecords() {}, validateImportedPrefabs() {}, loadScene() {}, mergeBundledPrefabs: () => 0, showStatus() {} });
vm.runInContext(source.slice(source.indexOf('function loadProjectData('), source.indexOf('function renderScriptTrustControls(')), c);
for (const retainedScript of [false, true]) {
  c.scriptsTrusted = true; c.scriptTrustRevoked = false; c.scriptTrustSeen = true;
  c.prefabs = retainedScript ? [{ name: 'Retained code', record: { behaviors: [{ action: 'script', params: { code } }] } }] : [];
  const before = JSON.stringify(c.prefabs); c.loadProjectData([], 'Foreign no-script document', [], { levels: [{ objects: [] }] });
  assert.equal(c.scriptsTrusted, false); assert.equal(c.scriptTrustRevoked, true); assert.equal(c.scriptTrustSeen, retainedScript); assert.equal(JSON.stringify(c.prefabs), before, 'Retained library is never removed to solve permission leakage');
}
console.log('Phase226 actual-source trust detection: legacy/modern Cube/Sprite/other levels/Graph/Prefab/library/Sequence, no-script/read-only/cycle/bounded fail-closed PASS');
