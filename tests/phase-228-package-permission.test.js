'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require.resolve('../editor/src/01-editor.js'), 'utf8');
const c = { scriptsTrusted: true, scriptTrustRevoked: false, scriptTrustSeen: false, closed: 0, rendered: 0, undoStack: [], redoStack: [], MAX_HISTORY: 100,
  OpusTilemapBundle: { PACK_COLLECTIONS: ['prefabs'] }, assertTilemapBundleLease() {}, validateAssetPackMediaBoundary() {},
  closeScriptTrustReview() { c.closed++; }, renderScriptTrustControls() { c.rendered++; }, captureAssetReplacementState: () => ({ history: { prefabs: [], scriptsTrusted: c.scriptsTrusted } }), restoreAssetReplacementSnapshot: s => { c.scriptsTrusted = s.scriptsTrusted; },
  updateUndoRedoButtons() {}, renderTilesetLibrary() {}, renderTilemapChunkLibrary() {}, renderPrefabPalette() {}, validateCurrentProject() {}, showStatus() {} };
vm.createContext(c);
for (const [start, end] of [['function projectHasScripts(', 'function loadProjectData('], ['function assetPackPermissionWarnings(', 'function previewPrefabPackage('], ['function commitAssetPackImport(', 'async function previewAssetPackImportFile(']]) vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), c);
const script = { prefabs: [{ name: 'Advanced', record: { behaviors: [{ action: 'script', params: { code: 'not evaluated' } }] } }] }, custom = { prefabs: [{ record: { behaviors: [{ action: 'custom_missing' }] } }] }, ordinary = { prefabs: [{ record: { behaviors: [{ action: 'message', params: { text: 'Hello' } }] } }] };
assert.equal(c.assetPackPermissionWarnings(ordinary).length, 0);
for (const data of [script, custom]) { const before = JSON.stringify(data); assert(c.assetPackPermissionWarnings(data).join(' ').includes('Custom Script permission')); assert.equal(JSON.stringify(data), before); }
for (const data of [script, custom, ordinary]) {
  c.scriptsTrusted = true; c.scriptTrustRevoked = false; c.scriptTrustSeen = false; c.closed = c.rendered = 0; c.undoStack = [];
  const plan = { dependencies: data }; c.preflightAssetPackImport = () => plan;
  assert.throws(() => c.commitAssetPackImport({}, {}, 'stale'), /changed/); assert(c.scriptsTrusted && !c.scriptTrustRevoked && !c.scriptTrustSeen && c.closed === 0);
  c.commitAssetPackImport({}, {}, JSON.stringify(plan)); assert.equal(c.undoStack.length, 1); assert.equal(c.scriptsTrusted, false);
  const advanced = data !== ordinary; assert.equal(c.scriptTrustRevoked, advanced); assert.equal(c.scriptTrustSeen, advanced); assert.equal(c.closed, advanced ? 1 : 0); assert.equal(c.rendered, advanced ? 1 : 0);
}
console.log('Phase228 canonical package disclosure/read-only preview/stale refusal/one history/advanced revocation latch and no-code compatibility PASS');
