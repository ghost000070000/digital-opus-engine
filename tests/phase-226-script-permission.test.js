'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require.resolve('../editor/src/01-editor.js'), 'utf8');
function mounted() {
  const elements = new Map(), messages = [], authored = { levels: [{ objects: [] }] };
  const el = id => { if (!elements.has(id)) elements.set(id, { textContent: '', checked: false, disabled: false, close() {}, showModal() {} }); return elements.get(id); };
  const c = { document: { getElementById: el }, scriptsTrusted: false, scriptTrustRevoked: true, scriptTrustSeen: true, pendingScriptTrustReview: null, scriptTrustBanner: { classList: { toggle() {} } },
    projectMeta: { title: 'Current' }, playerPreferenceScope: { id: 'current' }, playMode: false, levels: [{}], currentLevelIndex: 0, undoStack: [], redoStack: [],
    serializeProject: () => JSON.parse(JSON.stringify(authored)), captureAssetReplacementState: () => ({ project: JSON.parse(JSON.stringify(authored)) }), showStatus: message => messages.push(message), confirm: () => true };
  vm.createContext(c); vm.runInContext(source.slice(source.indexOf('function captureTilemapBundleLease('), source.indexOf('function tilemapBundleProjectView(')), c);
  c.tilemapBundlePreviewGeneration = 0;
  vm.runInContext(source.slice(source.indexOf('function renderScriptTrustControls('), source.indexOf("document.getElementById('script-trust-enable-btn').addEventListener")), c);
  return { c, el, messages, authored };
}
for (const mode of ['ok', 'unchecked', 'cancel', 'Play', 'root', 'meta', 'scope', 'content', 'history', 'confirm-race']) {
  const { c, el, authored } = mounted(); c.openScriptTrustReview(); el('script-trust-agree').checked = mode !== 'unchecked';
  if (mode === 'cancel') c.confirm = () => false;
  if (mode === 'Play') c.playMode = true;
  if (mode === 'root') c.levels = [{}];
  if (mode === 'meta') c.projectMeta.title = 'Other';
  if (mode === 'scope') c.playerPreferenceScope.id = 'other';
  if (mode === 'content') authored.extra = false;
  if (mode === 'history') c.undoStack.push({});
  if (mode === 'confirm-race') c.confirm = () => { c.levels = [{}]; return true; };
  assert.equal(c.grantReviewedScriptTrust(), mode === 'ok', mode); assert.equal(c.scriptsTrusted, mode === 'ok'); assert.equal(c.scriptTrustRevoked, mode !== 'ok');
}
const m = mounted(); m.c.scriptsTrusted = true; assert(m.c.revokeScriptTrust()); assert.equal(m.c.scriptsTrusted, false); assert.equal(m.c.scriptTrustRevoked, true);
m.c.playMode = true; m.c.scriptsTrusted = true; assert.equal(m.c.revokeScriptTrust(), false); assert.equal(m.c.scriptsTrusted, true);
assert(source.includes("(typeof scriptTrustRevoked === 'undefined' || !scriptTrustRevoked) && snapshot.scriptsTrusted !== false"));
const review = mounted().c.readCustomScriptReview({ behaviors: [{ action: 'script', params: { code: '<img onerror=bad>window.privateCounter++;' } }] }); assert.equal(review.entries.length, 1); assert(review.entries[0].includes('<img')); assert.equal(review.limited, false);
const limited = mounted().c.readCustomScriptReview({ nodes: Array.from({ length: 65 }, () => ({ type: 'script', code: '' })) }); assert.equal(limited.limited, true);
const standalone = mounted(); standalone.c.window = {}; let starts = 0; standalone.c.enterPlayMode = () => starts++; standalone.c.startStandaloneWithScriptChoice(); assert.equal(starts, 1); assert.equal(standalone.c.scriptsTrusted, false); assert.equal(standalone.c.scriptTrustRevoked, true, 'Choosing disabled Play is never approval');
standalone.c.window.__OPUS_EMBEDDED_PROJECT__ = {}; standalone.el('app').classList = { contains: () => false }; standalone.c.renderScriptTrustControls(); assert.equal(standalone.el('script-trust-runtime-access').hidden, true, 'Runtime permission launcher must not cover editor controls');
standalone.el('app').classList.contains = () => true; standalone.c.renderScriptTrustControls(); assert.equal(standalone.el('script-trust-runtime-access').hidden, false);
standalone.c.window.__OPUS_PLAYABLE_ONLY__ = true; standalone.c.renderScriptTrustControls(); assert.equal(standalone.el('script-trust-launch-edit').hidden, true, 'Playable has no editor entry');
console.log('Phase226 actual-source permission lease/acknowledgement/Cancel/Play/root/meta/scope/content/history/confirm-race/revoke/read-only literal code/limits PASS');
