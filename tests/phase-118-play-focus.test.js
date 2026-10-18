'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync('editor/src/01-editor.js', 'utf8');
const start = source.indexOf("document.getElementById('play-btn').addEventListener('click', () => {");
assert(start >= 0);
const handler = source.slice(start, source.indexOf('\n});', start) + 4);
const helperStart = source.indexOf('function releasePlayButtonFocusForGameplay(');
const helper = helperStart < 0 ? '' : source.slice(helperStart, source.indexOf('\n}', helperStart) + 2);
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
function fixture({ paused = false, focus = 'play' } = {}) {
  let click;
  const button = { blurs: 0, addEventListener(event, fn) { assert.equal(event, 'click'); click = fn; }, blur() { this.blurs++; context.document.activeElement = null; } };
  const field = { tagName: 'INPUT' };
  const context = { playMode: false, gameEnded: false, app: { paused }, onboarding: 0,
    document: { activeElement: focus === 'play' ? button : field, getElementById: () => button },
    enterPlayMode() { context.playMode = true; }, exitPlayMode() { context.playMode = false; },
    markOnboardingProgress() { context.onboarding++; } };
  vm.createContext(context); vm.runInContext(helper + '\n' + handler, context);
  return { context, button, field, click: () => click(), spaceDefault: () => { if (context.document.activeElement === button) click(); } };
}
test('Actual native Play handler releases focused Stop before Space default activation', () => {
  const f = fixture(); f.click(); assert(f.context.playMode); f.spaceDefault(); assert(f.context.playMode); assert.equal(f.button.blurs, 1); assert.equal(f.context.onboarding, 1);
});
test('Actual native explicit Stop remains usable after gameplay focus release', () => {
  const f = fixture(); f.click(); f.context.document.activeElement = f.button; f.click(); assert(!f.context.playMode); assert.equal(f.button.blurs, 1);
});
test('Actual Play focus handoff does not blur an unrelated authoring field', () => {
  const f = fixture({ focus: 'field' }); f.click(); assert.strictEqual(f.context.document.activeElement, f.field); assert.equal(f.button.blurs, 0);
});
test('Actual paused Start/menu retains its UI focus instead of claiming active gameplay', () => {
  const f = fixture({ paused: true }); f.click(); assert.strictEqual(f.context.document.activeElement, f.button); assert.equal(f.button.blurs, 0);
});
console.log(`Phase118 actual Play focus: ${passed} PASS, ${failed} FAIL`); if (failed) process.exitCode = 1;
