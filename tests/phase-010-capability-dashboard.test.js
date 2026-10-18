'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const catalog = require('../no-code-capabilities.json');
const friction = require('../authoring-friction.json');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; } }

console.log('Phase 010 capability dashboard tests');
const support = ['yes', 'partial', 'no', 'not_applicable'];
const grades = ['A', 'B', 'C', 'D', 'N/A'];
const frictionIds = new Set(friction.issues.map((issue) => issue.id));
const required = ['id', 'displayName', 'category', 'grade', 'runtimeSupport', 'creatorUI', 'saveLoad', 'export', 'validation', 'discoverability', 'evidence', 'knownFrictionIds', 'owningPhase', 'lastImprovedPhase', 'explanation', 'limitations'];

test('catalog uses a versioned schema', () => assert.strictEqual(catalog.schemaVersion, 1));
test('catalog covers the full reassessed inventory', () => assert.strictEqual(catalog.capabilities.length, 57));
test('every capability carries the complete contract', () => catalog.capabilities.forEach((capability) => required.forEach((key) => assert.notStrictEqual(capability[key], undefined, `${capability.id}.${key}`))));
test('stable capability IDs are valid', () => catalog.capabilities.forEach((capability) => assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(capability.id), capability.id)));
test('capability IDs are unique', () => assert.strictEqual(new Set(catalog.capabilities.map((capability) => capability.id)).size, catalog.capabilities.length));
test('grades use only the canonical rubric', () => catalog.capabilities.forEach((capability) => assert(grades.includes(capability.grade), capability.id)));
test('support fields use the bounded vocabulary', () => catalog.capabilities.forEach((capability) => ['runtimeSupport', 'creatorUI', 'saveLoad', 'export', 'validation', 'discoverability'].forEach((key) => assert(support.includes(capability[key]), `${capability.id}.${key}`))));
test('every evidence reference resolves locally', () => catalog.capabilities.flatMap((capability) => capability.evidence).forEach((reference) => assert(fs.existsSync(path.join(ROOT, reference)), reference)));
test('every friction reference resolves to the registry', () => catalog.capabilities.flatMap((capability) => capability.knownFrictionIds).forEach((id) => assert(frictionIds.has(id), id)));
test('ownership phases are positive and improvement follows ownership', () => catalog.capabilities.forEach((capability) => assert(Number.isInteger(capability.owningPhase) && capability.owningPhase > 0 && capability.lastImprovedPhase >= capability.owningPhase, capability.id)));
test('catalog preserves exact canonical grade definitions', () => assert.deepStrictEqual(catalog.gradeDefinitions, { A: 'Fully no-code authorable', B: 'No-code common path', C: 'Partial/awkward', D: 'Runtime-only/missing common path', 'N/A': 'intentionally code/advanced' }));
test('current totals are evidence-derived', () => { const counts = Object.fromEntries(grades.map((g) => [g, catalog.capabilities.filter((c) => c.grade === g).length])); assert.deepStrictEqual(counts, { A: 6, B: 33, C: 17, D: 0, 'N/A': 1 }); });
test('scoped typed Signal and reusable pattern common path is B with explicit future limits', () => { const c=catalog.capabilities.find(c=>c.id==='signals-events');assert.equal(c.grade,'B');assert.equal(c.lastImprovedPhase,69);assert(c.explanation.includes('stable references'));assert(c.explanation.includes('immutable occurrence'));assert(c.explanation.includes('Compare Values'));assert(c.explanation.includes('Signal Sender'));assert(c.explanation.includes('ordinary editable Behaviors'));assert(c.explanation.includes('actual-dispatch'));assert(c.explanation.includes('never saved or exported'));assert(c.explanation.includes('Objective activation/completion/failure'));assert(c.explanation.includes('dependency review'));assert(c.explanation.includes('Save retained for recovery'));assert(c.limitations.includes('not inactive-level mailboxes'));assert(c.limitations.includes('Cube-oriented'));assert(c.limitations.includes('transitive Function'));assert(c.limitations.includes('Ignore reentrancy'));assert(c.evidence.includes('PHASE-065-CONTRACT.md'));assert(c.evidence.includes('PHASE-066-CONTRACT.md'));assert(c.evidence.includes('PHASE-067-CONTRACT.md'));assert(c.evidence.includes('PHASE-068-CONTRACT.md'));assert(c.evidence.includes('PHASE-069-CONTRACT.md')); });
test('original and normalized Phase 001 baselines are explicit', () => { assert.strictEqual(catalog.baselinePhase001.total, 55); assert.strictEqual(catalog.normalizedPhase001.total, 57); });
test('Sprites remain B while the qualified portable Tilemap journey is A', () => { assert.strictEqual(catalog.capabilities.find((c) => c.id === 'sprites-2d').grade, 'B'); assert.strictEqual(catalog.capabilities.find((c) => c.id === 'tilemaps').grade, 'A'); });
test('Custom Script remains N/A and cannot raise no-code coverage', () => assert.strictEqual(catalog.capabilities.find((c) => c.id === 'custom-script').grade, 'N/A'));
test('Components qualification is B with registered creator UI and explicit bounded scope', () => { const c = catalog.capabilities.find((entry) => entry.id === 'components'); assert.strictEqual(c.grade, 'B'); assert.strictEqual(c.creatorUI, 'yes'); assert.strictEqual(c.lastImprovedPhase,78); assert(c.explanation.includes('immutable metadata')); assert(c.explanation.includes('portable descriptors')); assert(c.explanation.includes('Remove and Up/Down')); assert(c.explanation.includes('never changes runtime execution order')); assert(c.explanation.includes('one existing native control set')); assert(c.explanation.includes('newer component records')); assert(c.explanation.includes('Door')); assert(c.limitations.includes('bounded component set')); assert(c.limitations.includes('Intrinsic Sprite/emitter')); assert(c.limitations.includes('unknown/future')); assert(c.evidence.includes('PHASE-071-CONTRACT.md')); assert(c.evidence.includes('PHASE-072-CONTRACT.md')); assert(c.evidence.includes('PHASE-073-CONTRACT.md')); });
test('Gameplay Presets qualification is B with Save/Load and Export', () => { const c = catalog.capabilities.find((entry) => entry.id === 'gameplay-presets'); assert.strictEqual(c.grade, 'B'); assert.strictEqual(c.saveLoad, 'yes'); assert.strictEqual(c.export, 'yes'); });
test('Onboarding qualification is A', () => assert.strictEqual(catalog.capabilities.find((c) => c.id === 'onboarding').grade, 'A'));
test('Validation retains conservative C and historical friction linkage after bounded disposition', () => { const c = catalog.capabilities.find((entry) => entry.id === 'validation'); assert.strictEqual(c.grade, 'C'); assert(c.knownFrictionIds.includes('AFR-0014')); });
test('B grades retain visible friction instead of flattening status', () => assert(catalog.capabilities.some((c) => c.grade === 'B' && c.knownFrictionIds.some((id) => friction.issues.find((i) => i.id === id)?.severity === 'HIGH'))));
test('generator validates and generated Markdown is current', () => { const result = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-capability-dashboard.js'), '--check'], { cwd: ROOT, encoding: 'utf8' }); assert.strictEqual(result.status, 0, result.stderr || result.stdout); });

const html = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8');
const editor = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
const engineSources = fs.readdirSync(path.join(ROOT, 'engine', 'src')).filter((name) => name.endsWith('.js')).map((name) => fs.readFileSync(path.join(ROOT, 'engine', 'src', name), 'utf8')).join('\n');
test('Dashboard is available from Help', () => assert(html.includes('id="capability-dashboard-btn"') && html.includes('No-Code Capabilities')));
test('Dashboard displays canonical rubric', () => Object.values(catalog.gradeDefinitions).forEach((definition) => assert(html.includes(definition), definition)));
test('Dashboard exposes grade category and search filters', () => ['capability-search', 'capability-category', 'data-capability-grade="A"', 'data-capability-grade="B"', 'data-capability-grade="C"', 'data-capability-grade="D"', 'data-capability-grade="N/A"'].forEach((token) => assert(html.includes(token), token)));
test('Dashboard renders explanation limitations evidence and friction status', () => ['capability.explanation', 'capability.limitations', 'capability.evidence', 'capability.knownFrictionIds', 'issue.severity', 'issue.status'].forEach((token) => assert(editor.includes(token), token)));
test('Dashboard loads the authoritative JSON on demand', () => assert(editor.includes("fetch('../no-code-capabilities.json'") && editor.indexOf("fetch('../no-code-capabilities.json'") > editor.indexOf('async function openCapabilityDashboard')));
test('runtime source has no dashboard metadata dependency', () => assert(!engineSources.includes('no-code-capabilities') && !engineSources.includes('capabilityCatalog')));
test('playable builder does not embed the catalog JSON file', () => ['build/build-games.js', 'build/build-games-site.js'].forEach((file) => assert(!fs.readFileSync(path.join(ROOT, file), 'utf8').includes("readFileSync(path.join(ROOT, 'no-code-capabilities.json'"), file)));
test('engine-site package explicitly carries authoring catalog and friction registry', () => { const source = fs.readFileSync(path.join(ROOT, 'build', 'build-engine-site.js'), 'utf8'); assert(source.includes("path.join(ROOT, 'no-code-capabilities.json')") && source.includes("path.join(ROOT, 'authoring-friction.json')")); });
test('remaining gap view can be derived without a second matrix', () => assert.deepStrictEqual(catalog.capabilities.filter((c) => ['C', 'D'].includes(c.grade)).length, 17));
test('friction trend distinguishes historical impacts, accepted limits and actual closures', () => { const open = friction.issues.filter((i) => !['RESOLVED', 'DUPLICATE', 'INVALID', 'ACCEPTED_LIMITATION'].includes(i.status)),accepted=friction.issues.filter(i=>i.status==='ACCEPTED_LIMITATION');assert.strictEqual(open.length,0);assert.strictEqual(accepted.filter(i=>i.severity==='CRITICAL').length,1);assert.strictEqual(accepted.filter(i=>i.severity==='HIGH').length,12);assert.strictEqual(accepted.length,19);assert.strictEqual(friction.issues.find((i) => i.id === 'AFR-0015').resolvedInPhase, 9); assert.strictEqual(friction.issues.find((i) => i.id === 'AFR-0002').resolvedInPhase, 32); });

test('current diagnostic and rebinding descriptions retain explicit non-feature limits', () => {
  const get=id=>catalog.capabilities.find(c=>c.id===id);
  for(const id of ['node-graph','debugging','rebinding','validation','audio-zones','fog-zones'])assert.equal(get(id).grade,'C');
  assert(get('node-graph').explanation.includes('Graph Trace'));assert(!get('node-graph').limitations.includes('no live runtime tracing'));assert(get('node-graph').limitations.includes('typed-pin validation'));assert(get('node-graph').limitations.includes('Action requested is not effect success'));
  assert(get('rebinding').explanation.includes('movement and Jump'));assert(!get('rebinding').explanation.includes('Interact/Attack only'));assert(get('rebinding').limitations.includes('not gamepad/touch profile editing'));assert(get('rebinding').limitations.includes('Physical device compatibility remains unclaimed'));
  assert(get('debugging').explanation.includes('Profiler'));assert(get('debugging').limitations.includes('not GPU time'));assert(get('validation').explanation.includes('manual repair'));assert(get('validation').limitations.includes('not exhaustive gameplay validation'));
  for(const id of ['audio-zones','fog-zones']){assert(get(id).explanation.includes('Visible Environment zone setup'));assert(get(id).limitations.includes('One managed effect per legacy Trigger'));}
});
test('current persistence and mapping evidence does not imply identity migration or general animation graphs', () => {
  const get=id=>catalog.capabilities.find(c=>c.id===id);
  assert.equal(get('input-actions').lastImprovedPhase,100);assert(get('input-actions').evidence.includes('PHASE-100-REPORT.md'));
  assert(get('prefabs').limitations.includes('not GUID-based live sync'));assert(get('variables').limitations.includes('not covered'));assert(get('save-game').limitations.includes('copies are not isolated'));
  assert(get('animation').limitations.includes('no general skeletal blend tree'));assert(get('animation-events').explanation.includes('separate skeletal Asset event editor'));assert(get('sequences').limitations.includes('not a multitrack timeline'));
});
test('current A/B facts distinguish modern controller/filtering paths from unsupported general physics', () => {
  const get=id=>catalog.capabilities.find(c=>c.id===id);
  assert.equal(get('onboarding').grade,'A');for(const id of ['templates','colliders','player-controllers','trigger-volumes','sprites-2d'])assert.equal(get(id).grade,'B');
  assert(get('templates').explanation.includes('15 independently created'));assert(get('templates').limitations.includes('not complete genre games'));
  assert(get('onboarding').explanation.includes('generated Creator Guide'));assert(get('onboarding').limitations.includes('not an empirical novice learning study'));
  assert(get('player-controllers').explanation.includes('Modern XY Sprite Platformer and Topdown'));assert(!get('player-controllers').limitations.includes('No 2D controller yet'));
  assert(get('trigger-volumes').explanation.includes('geometry-owned mutual Masks'));assert(!get('trigger-volumes').limitations.includes('no Layers/Masks'));
  assert(get('sprites-2d').explanation.includes('Ordered Tile Layers'));assert(get('sprites-2d').limitations.includes('pixel-perfect Camera'));assert(get('colliders').limitations.includes('not general rigid-body physics'));
});
test('generated current inventory does not repeat obsolete absence claims', () => {const text=fs.readFileSync(path.join(ROOT,'CURRENT-AUTHORING-SURFACE-INVENTORY.md'),'utf8');for(const stale of ['Sprites/2D and Tilemaps remain D','Dedicated 2D input/jump controllers, general gravity-driven'])assert(!text.includes(stale));});
if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 010 tests passed: ${passed}/${passed}`);
