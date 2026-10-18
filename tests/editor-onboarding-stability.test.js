'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const onboarding = require(path.join(ROOT, 'editor/src/00-onboarding.js'));
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
function storage(initial) { let value = initial; return { getItem() { return value; }, setItem(_key, next) { value = next; } }; }
console.log('Editor onboarding stability tests');
assert.strictEqual(Object.keys(onboarding.TARGETS).length, onboarding.STEPS.length);
onboarding.STEPS.forEach(step => assert(onboarding.resolveTarget(step.targetKey, selector => (html + editor).includes(selector.slice(1)) ? selector : null), step.id));
for (const malformed of [null, '', '{', '[]', '{"tutorial":7}', '{"tutorial":{"cursorStepId":"missing","flags":null}}']) {
  const store = onboarding.createStore(storage(malformed));
  assert.doesNotThrow(() => store.read());
  assert.strictEqual(store.read().tutorial.cursorStepId, null);
}
const memory = storage(null); const store = onboarding.createStore(memory); store.restart();
for (let i = 0; i < 10000; i++) {
  const step = onboarding.STEPS[i % onboarding.STEPS.length];
  if (i % 5 === 0) store.skip(step.id); else if (i % 3 === 0) store.focus(step.id); else store.mark(step.id, i % 2 === 0);
  if (i % 97 === 0) { store.pause(); store.resume(); }
  const state = store.read();
  const progress = onboarding.evaluate({}, state);
  assert(progress.currentIndex >= 0 && progress.currentIndex < onboarding.STEPS.length);
}
store.restart(); assert.deepStrictEqual(store.read().tutorial.skipped, {}); assert.deepStrictEqual(store.read().tutorial.flags, {});
for (const id of ['onboarding-back', 'onboarding-retry', 'onboarding-skip-step', 'onboarding-exit']) assert(html.includes(`id="${id}"`), id);
assert(editor.includes('attempt < 4') && editor.includes('cancelOnboardingTargetResolution'));
assert(!editor.includes("setInterval(() => { if (onboardingStore.read().tutorial.active)"));
assert(editor.includes("event.key === 'Escape' && !onboardingCoach.hidden"));
console.log('Editor onboarding stability: registry PASS; malformed state PASS; 10000 transitions PASS; recovery controls PASS; idle polling PASS');
