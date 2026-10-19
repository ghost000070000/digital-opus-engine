'use strict';
// Animation timeline helpers: snapping, ruler steps, keyframe upsert/retime,
// and wiring into the Property Animation editor.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/60-animation-timeline.js'), 'utf8');
const ctx = { Math, Number };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function animTimelineSetTime')), ctx);
const plain = (v) => JSON.parse(JSON.stringify(v));

assert.strictEqual(ctx.animTimelineSnap(1.02, 2), 1, 'snaps to 0.05 s');
assert.strictEqual(ctx.animTimelineSnap(1.03, 2), 1.05);
assert.strictEqual(ctx.animTimelineSnap(-1, 2), 0, 'clamped to the clip');
assert.strictEqual(ctx.animTimelineSnap(9, 2), 2);
assert.deepStrictEqual([2, 5, 12, 60].map(ctx.animTimelineTickStep), [0.25, 0.5, 1, 5], 'ruler ticks scale with the clip');

const track = [];
ctx.upsertAnimationKeyframe(track, 1, [1, 0, 0]);
ctx.upsertAnimationKeyframe(track, 0, [0, 0, 0]);
assert.deepStrictEqual(plain(track.map((k) => k.t)), [0, 1], 'kept in time order');
track[1].easing = 'easeOut';
ctx.upsertAnimationKeyframe(track, 1, [2, 0, 0]);
assert.strictEqual(track.length, 2, 'same time replaces');
assert.deepStrictEqual(plain(track[1]), { t: 1, value: [2, 0, 0], easing: 'easeOut' }, 'replacing keeps the easing');

const moving = track[0];
assert.strictEqual(ctx.retimeAnimationKeyframe(track, moving, 1), false, 'cannot land on another key');
assert.strictEqual(ctx.retimeAnimationKeyframe(track, moving, 1.5), true);
assert.deepStrictEqual(plain(track.map((k) => k.t)), [1, 1.5], 'retimed key re-sorts');
assert.strictEqual(track[1], moving, 'the same keyframe object moves (selection follows it)');

// Wiring: the editor renders the timeline; the editor docks instead of covering the scene;
// Delete never removes the animated object while the editor is open.
assert(fs.readFileSync(path.join(root, 'editor/src/modules/20-property-animation.js'), 'utf8').includes("if (typeof renderAnimationTimeline === 'function') renderAnimationTimeline();"));
const html = fs.readFileSync(path.join(root, 'editor/index.html'), 'utf8');
assert(/#animation-editor-modal \{\s*position: fixed; left: 0; right: 0; bottom: 0; height: min\(50vh, 470px\)/.test(html), 'docked at the bottom');
assert(source.includes("event.stopImmediatePropagation();") && source.includes("}, true);"), 'Delete is captured before object deletion');
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('60-animation-timeline.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Animation timeline: snapping, ruler, keyframe upsert/retime, docking and wiring PASS');
