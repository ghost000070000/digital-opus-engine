'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const onboarding = require('../editor/src/00-onboarding');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS ${name}`); }
  catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}
function memoryStorage(seed = {}) {
  const values = { ...seed };
  return { getItem: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null, setItem: (key, value) => { values[key] = String(value); }, values };
}
function snapshot(extra = {}) { return { objectCount: 0, componentCount: 0, presetIds: [], hudCount: 0, ...extra }; }

console.log('Phase 009 onboarding tests');

test('uses one versioned local preference key', () => assert.strictEqual(onboarding.STORAGE_KEY, 'digital-opus:onboarding:v1'));
test('fresh state is a true first run', () => assert.strictEqual(onboarding.createStore(memoryStorage()).shouldShowFirstRun(), true));
test('fresh state has no active tutorial', () => assert.deepStrictEqual(onboarding.fresh().tutorial.flags, {}));
test('choice prevents the welcome from trapping returning creators', () => { const s = onboarding.createStore(memoryStorage()); s.choose('blank', false); assert.strictEqual(s.shouldShowFirstRun(), false); });
test('do not show again persists locally', () => { const m = memoryStorage(); const s = onboarding.createStore(m); s.choose('examples', true); assert.strictEqual(onboarding.createStore(m).read().doNotShowAgain, true); });
test('Skip is a stored first-run choice', () => { const s = onboarding.createStore(memoryStorage()); assert.strictEqual(s.choose('skip', false).lastChoice, 'skip'); });
test('guided start records its dedicated project', () => { const s = onboarding.createStore(memoryStorage()); assert.strictEqual(s.start('guided-first-game').tutorial.projectName, 'guided-first-game'); });
test('pause and resume retain progress', () => { const s = onboarding.createStore(memoryStorage()); s.start(); s.mark('move'); s.pause(); assert.strictEqual(s.read().tutorial.active, false); s.resume(); assert.strictEqual(s.read().tutorial.flags.move, true); });
test('restart clears old progress', () => { const s = onboarding.createStore(memoryStorage()); s.start(); s.mark('save'); assert.deepStrictEqual(s.restart().tutorial.flags, {}); });
test('corrupt local data safely returns fresh state', () => assert.strictEqual(onboarding.createStore(memoryStorage({ [onboarding.STORAGE_KEY]: '{bad' })).read().firstRunSeen, false));
test('older or partial data normalizes to the current schema', () => assert.deepStrictEqual(onboarding.normalize({ firstRunSeen: true }).tutorial.flags, {}));
test('the concise journey contains nine steps', () => assert.strictEqual(onboarding.STEPS.length, 9));
test('journey covers required creator outcomes in order', () => assert.deepStrictEqual(onboarding.STEPS.map((s) => s.id), ['place', 'move', 'component', 'preset', 'player', 'hud', 'play', 'save', 'export']));
test('every step targets a real UI selector', () => onboarding.STEPS.forEach((step) => assert(step.target.startsWith('#'), step.id)));
test('placed scene state completes Place', () => assert(onboarding.evaluate(snapshot({ objectCount: 1 }), onboarding.fresh()).steps[0].complete));
test('transform interaction completes Move', () => { const state = onboarding.fresh(); state.tutorial.flags.move = true; assert(onboarding.evaluate(snapshot(), state).steps[1].complete); });
test('actual component state completes Add Component', () => assert(onboarding.evaluate(snapshot({ componentCount: 1 }), onboarding.fresh()).steps[2].complete));
test('actual collectible provenance completes gameplay', () => assert(onboarding.evaluate(snapshot({ presetIds: ['collectible'] }), onboarding.fresh()).steps[3].complete));
test('unrelated presets do not complete Collectible', () => assert.strictEqual(onboarding.evaluate(snapshot({ presetIds: ['checkpoint'] }), onboarding.fresh()).steps[3].complete, false));
test('Player is completed by a real setting interaction', () => { const state = onboarding.fresh(); state.tutorial.flags.player = true; assert(onboarding.evaluate(snapshot(), state).steps[4].complete); });
test('actual HUD state completes HUD', () => assert(onboarding.evaluate(snapshot({ hudCount: 1 }), onboarding.fresh()).steps[5].complete));
test('Play Save and Export require actual action signals', () => { const state = onboarding.fresh(); Object.assign(state.tutorial.flags, { play: true, save: true, export: true }); const p = onboarding.evaluate(snapshot(), state); assert(p.steps.slice(6).every((s) => s.complete)); });
test('progress reports first incomplete step without Next buttons', () => { const p = onboarding.evaluate(snapshot({ objectCount: 1 }), onboarding.fresh()); assert.strictEqual(p.completedCount, 1); assert.strictEqual(p.steps[p.currentIndex].id, 'move'); });
test('complete closes the active journey without fabricating an export', () => { const s = onboarding.createStore(memoryStorage()); s.start(); const result = s.complete(); assert(result.tutorial.completedAt && !result.tutorial.active); assert.strictEqual(result.tutorial.flags.export, undefined); s.mark('export'); assert.strictEqual(s.complete().tutorial.flags.export, true); });

const editor = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8');
test('welcome offers Blank Guided and Example plus Skip', () => ['Start Blank', 'Guided First Game', 'Open Example', 'Skip for now'].forEach((token) => assert(html.includes(token), token)));
test('major editor surfaces have concise Help entry points', () => ['create', 'viewport', 'inspector', 'level', 'ui', 'project'].forEach((topic) => assert(html.includes(`data-help-topic="${topic}"`), topic)));
test('coach highlights actual editor controls', () => assert(editor.includes("target.classList.add('tutorial-highlight')") && editor.includes('target.scrollIntoView')));
test('welcome and Help remain keyboard-dismissible', () => assert(editor.includes("firstRunOverlay.addEventListener('keydown'") && editor.includes("helpOverlay.addEventListener('keydown'")));
test('guided and blank choices replace only the current explicit document', () => assert(editor.includes('saved projects and the user\'s separate Prefab library stay intact')));
test('tutorial preference never enters project serialization', () => { assert(!editor.slice(editor.indexOf('function serializeProject'), editor.indexOf('function loadProjectFull')).includes('onboarding')); assert(!JSON.stringify(onboarding.fresh()).includes('__gameState')); });
test('no analytics cloud account or network telemetry was introduced', () => { const source = fs.readFileSync(path.join(ROOT, 'editor', 'src', '00-onboarding.js'), 'utf8'); ['analytics', 'telemetry', 'fetch(', 'account', 'cloud'].forEach((token) => assert(!source.toLowerCase().includes(token.toLowerCase()), token)); });
test('onboarding does not fake Sprite or a 2D authoring path', () => { const copy = onboarding.STEPS.map((s) => `${s.title} ${s.instruction}`).join(' '); assert(!/sprite|billboard|2d/i.test(copy)); });
test('onboarding never requires script JSON console or raw IDs', () => { const copy = onboarding.STEPS.map((s) => `${s.title} ${s.instruction}`).join(' '); assert(!/custom script|json|console|raw id/i.test(copy)); });
test('useful empty states cover selection components assets behaviors and HUD', () => ['No Object selected', 'No Components yet', 'No Model Assets yet', 'No Behaviors yet', 'No HUD Elements yet'].forEach((token) => assert(editor.includes(token) || html.includes(token), token)));
test('Playable Export is the real final action and only marks after build', () => assert(editor.indexOf("const html = await buildExportHTML(true)") < editor.indexOf("markOnboardingProgress('export')")));
test('all editable and packaged build paths include onboarding', () => { for (const file of ['build/build-games.js', 'build/build-games-site.js', 'build/build-engine-site.js', 'editor/src/01-editor.js']) assert(fs.readFileSync(path.join(ROOT, file), 'utf8').includes('00-onboarding.js'), file); });
test('editor loads onboarding before editor integration', () => assert(html.lastIndexOf('src/00-onboarding.js') < html.lastIndexOf('src/01-editor.js')));

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 009 tests passed: ${passed}/${passed}`);
