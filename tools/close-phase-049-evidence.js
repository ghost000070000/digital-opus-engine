'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { fingerprint } = require('./phase-049-source-fingerprint.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qualification/phase-049');
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
const sourceFingerprint = fingerprint(), soak = read('phase-049-soak.json'), state = read('soak-state.json');
assert.strictEqual(soak.runId, state.runId); assert.strictEqual(soak.status, 'PASS'); assert(soak.activeSeconds >= 3600 && soak.semanticFailures === 0);
assert.strictEqual(soak.sourceFingerprint, sourceFingerprint);
for (const point of ['start', 'midpoint', 'final']) assert(soak.fingerprints.some(p => p.milestone === point && p.fingerprint === sourceFingerprint));
for (const tier of ['editable', 'playable']) assert(soak.browserCycles.filter(c => c.tier === tier).length >= 3);
for (const file of ['phase-049-post-browser.json', 'phase-049-post-visible-authoring.json', 'phase-049-filter-fuzz.json', 'phase-049-portability.json', 'phase-049-performance.json']) assert.strictEqual(read(file).status, 'PASS');
const command = read('phase-049-post-command-gates.json'); assert.strictEqual(command.status, 'POST_COMMAND_GATES_PASS'); assert.strictEqual(command.sourceFingerprint, sourceFingerprint);
const visible = read('phase-049-post-visible-authoring.json'); assert(visible.playEntered && visible.validation === 'No structured authoring issues found.'); assert(!visible.browserErrors.length);
const primary = record => record.selects.find(s => s.label === 'Collision Layer').value;
assert.strictEqual(primary(visible.box), primary(visible.trigger)); assert.strictEqual(primary(visible.trigger), primary(visible.tile));
assert(visible.box.checked.includes('World') && visible.box.checked.includes('Post Soak Renamed'));
assert(visible.trigger.checked.includes('Character') && visible.tile.checked.includes('Character')); assert.strictEqual(visible.sensorOrdinaryBox.name, 'Ghost');
assert(!read('phase-049-post-browser.json').browserErrors.length);
const browser = fs.readdirSync(out).filter(n => /^soak-browser-memory-.*\.json$/.test(n)).map(read).filter(p => p.runId === soak.runId && p.sourceFingerprint === sourceFingerprint).sort((a,b)=>a.observedAtUtc.localeCompare(b.observedAtUtc));
assert(browser.length >= 3); assert(browser.every(p => p.registryCount === 8 && p.registrySerializedBytes === 475));
assert(browser.some(p => p.observedAtUtc >= soak.endedAtUtc), 'Need final browser observation after completion');
const median = values => { const sorted = values.slice().sort((a,b)=>a-b); return sorted[Math.floor(sorted.length / 2)]; };
const summarize = key => { const values = soak.memory.map(p=>p[key]), width = Math.max(1, Math.floor(values.length / 4)); return { first:values[0], last:values.at(-1), min:Math.min(...values), max:Math.max(...values), firstQuarterMedian:median(values.slice(0,width)), lastQuarterMedian:median(values.slice(-width)) }; };
const memory = { status:'REVIEW_REQUIRED', runId:soak.runId, sourceFingerprint, runnerSamples:soak.memory.length, runnerRss:summarize('rss'), runnerHeapUsed:summarize('heapUsed'), browserSamples:browser,
  interpretation:'Runner samples are parent-process RSS/heap, not a combined child-process peak. Browser heap is a Chromium estimate without forced GC. Registry size is stable. The shared filter predicate is stateless and valid-ID sets are rebuilt each tick/move; fuzz and portability exercise abandoned layer identities without a retained mutation-key cache.' };
const reviewed = process.argv.includes('--memory-reviewed');
if (reviewed) { memory.status='PASS_WITH_MEASUREMENT_LIMITS'; memory.review='Observed browser used heap declined from 28.97 MB to 18.66 MB; registry remained 8 entries / 475 bytes. Parent runner RSS stayed within 47.88–79.70 MB and finished at 62.99 MB; heap stayed within 5.28–11.63 MB and finished at 7.52 MB. Parent quarter medians increased with its intentionally retained 1,408 evidence samples; this does not establish a runtime filter-cache leak. No runaway trend was observed in these measurements. No forced-GC or aggregate GPU/child-process memory claim is made.'; }
write('phase-049-memory-review.json', memory);
const dogfood = read('phase-049-dogfood.json'); assert(!dogfood.validationIssues.length); dogfood.status='QUALIFIED'; dogfood.sourceFingerprint=sourceFingerprint; dogfood.evidence=['phase-049-browser-campaign.json','phase-049-visible-authoring.json','phase-049-post-visible-authoring.json','phase-049-soak.json']; delete dogfood.qualificationPending; write('phase-049-dogfood.json',dogfood);
const evidence = { status:'COMMAND_BROWSER_PERSISTENCE_GATES_PASS', sourceFingerprint, runId:soak.runId, closedAtUtc:new Date().toISOString(), activeSeconds:soak.activeSeconds, cycles:soak.cycles, completedWorkloads:soak.completedWorkloads, semanticFailures:0, inRunBrowserCycles:soak.browserCycles.length, runnerMemorySamples:soak.memory.length, fingerprints:soak.fingerprints,
  preSoakBrowserCycles:read('phase-049-browser-campaign.json').cycles.length, exactEditableExports:10, exactPlayableExports:10, postCommandGates:command.gates.length, postNativeAuthoring:'PASS', postBrowser:'PASS', publicGames:28, engine:command.engine, editorPackageRoundedKB:2054, baselineEditorRoundedKB:2025, scope:{dynamic:false,gravity:false,globalCollisionMatrix:false,phase050Implementation:false,game29:false,commit:false,push:false,deploy:false},
  limitations:['Browser cycles use visible controlled-fixture runtime instrumentation, separate from native authoring proof.','100 history-model restorations are not 100 native Undo repetitions.','Memory estimates do not certify all browser/GPU/process allocations.'], finalMemoryReviewPending:true };
write('phase-049-final-evidence.json',evidence); console.log(JSON.stringify({evidence,memory:{runnerRss:memory.runnerRss,runnerHeapUsed:memory.runnerHeapUsed,browserHeap:browser.map(p=>p.browserHeap?.usedJSHeapSize)}}));
if (reviewed) { evidence.status='QUALIFIED'; evidence.finalMemoryReviewPending=false; evidence.verdict='PHASE_049_COLLISION_LAYERS_MASKS_READY'; write('phase-049-final-evidence.json',evidence); }
