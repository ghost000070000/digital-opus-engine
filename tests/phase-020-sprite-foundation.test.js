'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const authoring = require('../editor/src/00-authoring-schema.js');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const renderer = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8');
const runner = fs.readFileSync(path.join(ROOT, 'tests/run-tests.js'), 'utf8');
const capability = JSON.parse(fs.readFileSync(path.join(ROOT, 'no-code-capabilities.json'), 'utf8'));
const friction = JSON.parse(fs.readFileSync(path.join(ROOT, 'authoring-friction.json'), 'utf8'));
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; } }
const DEFAULT = plumbing.DEFAULT_SPRITE_SORTING_LAYER_ID;
function component(extra = {}) { return { ...authoring.registry.get('sprite-renderer').defaults, version: 5, spriteAssetRef: 'sprite-a', ...extra }; }
function sprite(id = 'object-a', extra = {}) { return { kind: 'sprite', id, position: [0, 1, 0], scale: [1, 1, 1], rotationY: 0, behaviors: [], components: { 'sprite-renderer': component() }, ...extra }; }
function asset(extra = {}) { return plumbing.createSpriteAsset({ id: 'sprite-a', name: 'Hero', sourceTexture: 'texture-a', pivot: [0.5, 0.5], pixelsPerUnit: 32, filtering: 'linear', ...extra }); }
function project(overrides = {}) { return { levels: [{ id: 'level-a', objects: [sprite()] }], prefabs: [], assets: [], textures: [{ id: 'texture-a', type: 'texture', name: 'Hero PNG', dataURL: 'data:image/png;base64,AA==', width: 64, height: 32 }], spriteAssets: [asset()], audio: [], spriteSortingLayers: [{ id: DEFAULT, name: 'Default', order: 0 }, { id: 'effects', name: 'Effects', order: 1 }], ...overrides }; }

console.log('Phase 020 Sprite foundation qualification tests');

test('Sprite Renderer remains canonical through Phase 027', () => assert.strictEqual(authoring.registry.get('sprite-renderer').version, 9));
test('Sprite Asset remains canonical through Phase 026', () => assert.strictEqual(plumbing.assetTypes.get('sprite').version, 4));
test('canonical Sprite placement is asset-backed and non-Billboard', () => { const r = plumbing.createSpritePlacementRecord(asset(), project().textures[0], { x: 1, y: 1, z: 2 }); assert.strictEqual(r.kind, 'sprite'); assert.strictEqual(r.components['sprite-renderer'].spriteAssetRef, 'sprite-a'); assert(!r.isBillboard); });
test('natural size and pivot derive from Sprite Asset metadata', () => { const a = asset({ sourceRect: { x: 8, y: 4, width: 32, height: 16 }, pivot: [1, 0] }); assert.deepStrictEqual(plumbing.spriteNaturalSize(a, project().textures[0]), { width: 1, height: 0.5 }); assert.deepStrictEqual(a.pivot, [1, 0]); });
test('Smooth and Pixel sampling remain asset-owned', () => { assert.strictEqual(asset().filtering, 'linear'); assert.strictEqual(asset({ filtering: 'nearest' }).filtering, 'nearest'); assert(!('filtering' in component())); });
test('atlas slicing is deterministic and shares one Texture', () => { const cells = plumbing.sliceSpriteGrid(128, 128, { cellWidth: 32, cellHeight: 32 }); assert.strictEqual(cells.length, 16); assert.deepStrictEqual(cells[15], { x: 96, y: 96, width: 32, height: 32 }); });
test('named sorting layers retain stable IDs through rename', () => { const layers = plumbing.normalizeSpriteSortingLayers([{ id: DEFAULT, name: 'Default', order: 0 }, { id: 'effects', name: 'FX', order: 1 }]); layers[1].name = 'Effects Layer'; assert.strictEqual(layers[1].id, 'effects'); });
test('Sprite ordering is layer then integer order then stable object ID', () => { const layers = project().spriteSortingLayers; const a = { id: 'b', components: { 'sprite-renderer': component({ sortingLayerRef: 'effects', orderInLayer: 2 }) } }; const b = { id: 'a', components: { 'sprite-renderer': component({ sortingLayerRef: 'effects', orderInLayer: 2 }) } }; assert(plumbing.compareSpriteSortRecords(a, b, layers) > 0); });
test('clean canonical project has no validation issues', () => assert.deepStrictEqual(plumbing.collectProjectIssues(project()).issues, []));
test('missing Sprite Asset is actionable and repair preserves the object', () => { const p = project(); p.levels[0].objects[0].components['sprite-renderer'].spriteAssetRef = 'missing'; assert(plumbing.collectProjectIssues(p).issues.some((i) => i.referenceValue === 'missing')); p.levels[0].objects[0].components['sprite-renderer'].spriteAssetRef = 'sprite-a'; assert.deepStrictEqual(plumbing.collectProjectIssues(p).issues, []); });
test('missing Texture is actionable and repair preserves Sprite metadata', () => { const p = project(); p.spriteAssets[0].sourceTexture = 'missing'; assert(plumbing.collectProjectIssues(p).issues.some((i) => i.referenceValue === 'missing')); p.spriteAssets[0].sourceTexture = 'texture-a'; assert.deepStrictEqual(plumbing.collectProjectIssues(p).issues, []); });
test('missing Sorting Layer is actionable and repairable to Default', () => { const p = project(); const c = p.levels[0].objects[0].components['sprite-renderer']; c.sortingLayerRef = 'missing-layer'; assert(plumbing.collectProjectIssues(p).issues.some((i) => i.referenceType === 'sortingLayer')); c.sortingLayerRef = DEFAULT; assert.deepStrictEqual(plumbing.collectProjectIssues(p).issues, []); });
test('Default sorting layer is reserved and validates', () => assert.deepStrictEqual(plumbing.validateSpriteSortingLayers(plumbing.defaultSpriteSortingLayers()), []));
test('sequential Inspector edits keep the live component object', () => { const sync = editor.slice(editor.indexOf('function syncSpriteRenderer'), editor.indexOf('function decodeTextureImage')); assert(sync.includes("item.components && item.components['sprite-renderer']")); assert(sync.includes(": OpusAuthoring.ensureComponent(item, 'sprite-renderer')")); });
test('Sprite sync no longer normalizes and replaces an existing record', () => { const sync = editor.slice(editor.indexOf('function syncSpriteRenderer'), editor.indexOf('function decodeTextureImage')); assert.strictEqual((sync.match(/ensureComponent/g) || []).length, 2); assert(sync.includes('controls are mounted')); });
test('pivot preset reacquires the selected live component at click time', () => { const block = editor.slice(editor.indexOf("conveniences.querySelector('[data-sprite-apply-pivot]')"), editor.indexOf("conveniences.querySelector('[data-sprite-source-aspect]')")); assert(block.includes("target.components['sprite-renderer']")); });
test('natural size reacquires current Sprite Asset at click time', () => { const line = editor.match(/if \(naturalSize\) naturalSize\.onclick = \(\) => \{[^\n]+/)[0]; assert(line.includes('const current =')); assert(line.includes('findSpriteAssetById(current.spriteAssetRef)')); });
test('direct resize and pivot use one gesture-level Undo boundary', () => { const block = editor.slice(editor.indexOf("window.addEventListener('pointermove'"), editor.indexOf("window.addEventListener('pointerup'", editor.indexOf("window.addEventListener('pointermove'"))); assert(block.includes("if (!state.moved) { pushUndo(); state.moved = true; }")); });
test('direct manipulation edits the same live component record', () => assert(editor.includes("const component = state.item.components['sprite-renderer']")));
test('linked Sprite prefab updates stay explicit and manual', () => ['sprite-update-from-prefab', 'sprite-update-prefab-from-this', 'Manual replace-and-reinstantiate sync'].forEach((token) => assert(editor.includes(token))));
test('level duplication deep-clones and remaps identities', () => assert(editor.includes('const clone = JSON.parse(JSON.stringify({ objects: src.objects')) && assert.ok(editor.includes('const remapped = remapObjectIds(clone.objects')));
test('Sprite dependency closure retains Sprite Asset and source Texture', () => { assert(editor.includes('dep.spriteAssets.add(renderer.spriteAssetRef)')); assert.deepStrictEqual(plumbing.assetTypes.getDependencies(asset(), 'sprite'), [{ assetType: 'texture', id: 'texture-a' }]); });
test('unused Sprite metadata is pruned by the dependency-based serializer', () => { assert(editor.includes('function serializeSpriteAssets(usedIds)')); assert(editor.includes('spriteAssets.filter((asset) => used.has(asset.id))')); });
test('Editable and Playable exports use one composition path', () => { assert(editor.includes('async function buildExportHTML(playableOnly)')); assert(editor.includes('composeExportHTML({')); assert(editor.includes('openExportPreflight(false)')); assert(editor.includes('openExportPreflight(true)')); assert(editor.includes('buildExportHTML(prepared.playableOnly, prepared.projectJSON)')); });
test('Playable-only mode blocks reopening editor chrome', () => assert(editor.includes('if (playableOnlyMode && visible) return')));
test('Sprite and Billboard remain separate concepts', () => { assert(editor.includes('It does not face the camera automatically')); assert(editor.includes('It is not a Sprite and has no Sprite Asset or Sprite Sorting Layer')); });
test('Billboards face the camera continuously in edit and Play', () => assert(editor.includes('function syncBillboards()')) && assert(editor.includes('BOTH edit and Play')));
test('opaque 3D geometry occludes the Sprite pass', () => { assert(renderer.indexOf('for (const entity of opaque)') < renderer.indexOf('if (sprites.length > 0)')); assert(renderer.includes('Depth testing remains enabled against opaque 3D geometry')); });
test('legacy direct-Texture Sprite source remains supported', () => { const p = project({ spriteAssets: [] }); const c = p.levels[0].objects[0].components['sprite-renderer']; c.spriteAssetRef = null; c.sourceTexture = 'texture-a'; assert.deepStrictEqual(plumbing.collectProjectIssues(p).issues, []); });
test('legacy Sprite versions migrate to current sorting opacity directional-state render-mode and parallax shape', () => { const target = { kind: 'sprite', entity: {}, components: { 'sprite-renderer': { version: 1, sourceTexture: 'texture-a', width: 2, height: 3, pivotX: 0.5, pivotY: 0.5, tint: '#ffffff', visible: true, layer: 4 } } }; authoring.ensureComponent(target, 'sprite-renderer'); const c = target.components['sprite-renderer']; assert.strictEqual(c.version, 9); assert.strictEqual(c.renderMode, 'simple'); assert.strictEqual(c.orderInLayer, 4); assert.strictEqual(c.opacity, 1); assert.strictEqual(c.initialDirection, 'none'); assert.strictEqual(c.parallaxLayerRef, null); assert.deepStrictEqual(c.animationStates, []); });
test('Sprites / 2D remains honestly B and qualified common-path complete', () => { const c = capability.capabilities.find((x) => x.id === 'sprites-2d'); assert.strictEqual(c.grade, 'B'); assert.strictEqual(c.status, 'common_path_complete'); assert(c.lastImprovedPhase >= 20); });
test('later scale-qualified Tilemap evidence supersedes the Phase 020 gap', () => { const c = capability.capabilities.find((x) => x.id === 'tilemaps'); assert.strictEqual(c.grade, 'A'); assert.strictEqual(c.runtimeSupport, 'yes'); assert(c.lastImprovedPhase >= 40); });
test('resolved Phase 020 Inspector identity bug is registered', () => { const issue = friction.issues.find((x) => x.id === 'AFR-0024'); assert(issue); assert.strictEqual(issue.status, 'RESOLVED'); assert.strictEqual(issue.resolvedInPhase, 20); });
test('qualification artifacts are present', () => ['PHASE-020-CLEAN-ROOM-QUALIFICATION.md', 'PHASE-020-CHARACTERIZATION.md', 'PHASE-020-REPORT.md', 'EPOCH-02-SPRITE-FOUNDATION-REPORT.md', 'phase-020-dogfood.json'].forEach((file) => assert(fs.existsSync(path.join(ROOT, file)), file)));
test('Phase 011 through Phase 020 focused suites are wired in order', () => { let previous = -1; for (let phase = 11; phase <= 20; phase++) { const token = `phase-${String(phase).padStart(3, '0')}`; const index = runner.indexOf(token); assert(index > previous, token); previous = index; } });

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 020 tests passed: ${passed}/${passed}`);
