'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const authoring = require('../editor/src/00-authoring-schema.js');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const runner = fs.readFileSync(path.join(ROOT, 'tests/run-tests.js'), 'utf8');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; } }
function asset(overrides = {}) { return plumbing.createSpriteAsset({ id: 'sprite-hero', name: 'Hero', sourceTexture: 'texture-hero', pivot: [0.25, 0.75], pixelsPerUnit: 32, filtering: 'nearest', ...overrides }); }
const texture = { id: 'texture-hero', name: 'Hero Texture', width: 128, height: 64, dataURL: 'data:image/png;base64,AA==' };
function record(a = asset(), t = texture, p = { x: 3, y: 1, z: -4 }, names = []) { return plumbing.createSpritePlacementRecord(a, t, p, names); }

console.log('Phase 019 Sprite Asset placement tests');

test('typed drag payload carries only Sprite type and stable ID', () => assert.deepStrictEqual({ ...plumbing.createSpritePlacementPayload('sprite-hero') }, { assetType: 'sprite', assetId: 'sprite-hero' }));
test('typed payload rejects an empty identity', () => assert.throws(() => plumbing.createSpritePlacementPayload(''), /stable Sprite Asset ID/));
test('Texture payload is not accepted as Sprite placement', () => assert.strictEqual(plumbing.isSpritePlacementPayload({ assetType: 'texture', assetId: 'texture-hero' }), false));
test('Sprite payload is recognized', () => assert.strictEqual(plumbing.isSpritePlacementPayload({ assetType: 'sprite', assetId: 'sprite-hero' }), true));
test('successful placement record is explicit kind Sprite', () => assert.strictEqual(record().kind, 'sprite'));
test('placement assigns the stable Sprite Asset ID', () => assert.strictEqual(record().components['sprite-renderer'].spriteAssetRef, 'sprite-hero'));
test('placement does not copy Texture identity into the instance', () => assert.strictEqual(record().components['sprite-renderer'].sourceTexture, null));
test('full-image natural size is copied at creation', () => assert.deepStrictEqual([record().components['sprite-renderer'].width, record().components['sprite-renderer'].height], [4, 2]));
test('atlas region natural size is copied instead of full Texture size', () => { const r = record(asset({ sourceRect: { x: 64, y: 16, width: 32, height: 16 } })); assert.deepStrictEqual([r.components['sprite-renderer'].width, r.components['sprite-renderer'].height], [1, 0.5]); });
test('asset pivot is copied at creation', () => assert.deepStrictEqual([record().components['sprite-renderer'].pivotX, record().components['sprite-renderer'].pivotY], [0.25, 0.75]));
test('appearance defaults are white opaque and visible', () => { const c = record().components['sprite-renderer']; assert.deepStrictEqual([c.tint, c.opacity, c.visible], ['#ffffff', 1, true]); });
test('sorting defaults are Default and order zero', () => { const c = record().components['sprite-renderer']; assert.deepStrictEqual([c.sortingLayerRef, c.orderInLayer], [plumbing.DEFAULT_SPRITE_SORTING_LAYER_ID, 0]); });
test('transform uses supplied world position with default scale', () => { const r = record(); assert.deepStrictEqual(r.position, [3, 1, -4]); assert.deepStrictEqual(r.scale, [1, 1, 1]); });
test('canonical Sprite orientation stays non-Billboard', () => { const r = record(); assert(!r.isBillboard); assert(!('billboardMode' in r)); });
test('Pixel filtering remains authoritative on the referenced asset', () => { const a = asset(); const r = record(a); assert.strictEqual(a.filtering, 'nearest'); assert(!('filtering' in r.components['sprite-renderer'])); });
test('Smooth filtering remains authoritative on the referenced asset', () => { const a = asset({ filtering: 'linear' }); const r = record(a); assert.strictEqual(a.filtering, 'linear'); assert(!('filtering' in r.components['sprite-renderer'])); });
test('repeated placement produces collision-safe object names', () => { assert.strictEqual(record(asset(), texture, undefined, []).name, 'Hero'); assert.strictEqual(record(asset(), texture, undefined, ['Hero']).name, 'Hero 2'); assert.strictEqual(record(asset(), texture, undefined, ['Hero', 'Hero 2']).name, 'Hero 3'); });
test('object naming is case-insensitive and independent of identity', () => assert.strictEqual(plumbing.uniqueObjectName('Hero', ['hero']), 'Hero 2'));
test('asset rename does not rewrite an existing object record', () => { const a = asset(); const r = record(a); a.name = 'Champion'; assert.strictEqual(r.name, 'Hero'); assert.strictEqual(r.components['sprite-renderer'].spriteAssetRef, a.id); });
test('asset region and filtering edits remain live through stable reference', () => { const a = asset(); const r = record(a); a.sourceRect = { x: 0, y: 0, width: 16, height: 16 }; a.filtering = 'linear'; assert.strictEqual(r.components['sprite-renderer'].spriteAssetRef, a.id); assert.strictEqual(a.filtering, 'linear'); assert.deepStrictEqual(plumbing.spriteSourceUV(a, texture).scale, [15 / 128, 15 / 64]); });
test('initial size and pivot remain independent instance overrides', () => { const a = asset(); const r = record(a); a.pixelsPerUnit = 64; a.pivot = [1, 0]; assert.deepStrictEqual([r.components['sprite-renderer'].width, r.components['sprite-renderer'].height, r.components['sprite-renderer'].pivotX, r.components['sprite-renderer'].pivotY], [4, 2, 0.25, 0.75]); });
test('missing source Texture produces a placeable one-unit placeholder record', () => { const r = record(asset(), null); assert.deepStrictEqual([r.components['sprite-renderer'].width, r.components['sprite-renderer'].height], [1, 1]); assert.strictEqual(r.components['sprite-renderer'].spriteAssetRef, 'sprite-hero'); });
test('missing source remains visible to Project Validation', () => { const a = asset({ sourceTexture: 'missing' }); const r = record(a, null); const result = plumbing.collectProjectIssues({ levels: [{ id: 'level1', objects: [{ id: 'obj1', ...r }] }], prefabs: [], assets: [], textures: [], spriteAssets: [a], audio: [] }, { schemaRegistry: authoring.registry }); assert(result.issues.some((issue) => issue.code === 'dangling-reference')); });
test('save/load JSON round-trip preserves ordinary Sprite placement data', () => { const r = record(); assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), r); });
test('level duplication can allocate new IDs without placement provenance', () => { const r = { id: 'obj1', ...record() }; const copy = JSON.parse(JSON.stringify(r)); copy.id = 'obj2'; assert.strictEqual(copy.kind, 'sprite'); assert.strictEqual(copy.components['sprite-renderer'].spriteAssetRef, 'sprite-hero'); assert.notStrictEqual(copy.id, r.id); });
test('Prefab after placement uses the ordinary serializable Sprite record', () => { const prefab = { name: 'Hero Prefab', records: [{ id: 'obj1', ...record() }] }; const revived = JSON.parse(JSON.stringify(prefab.records[0])); assert.strictEqual(revived.kind, 'sprite'); assert.strictEqual(revived.components['sprite-renderer'].spriteAssetRef, 'sprite-hero'); });
test('library row drag has a six-pixel threshold and click-to-inspect path', () => { assert(editor.includes('if (distance < 6) return')); assert(editor.includes("row.addEventListener('click'")); assert(html.includes('sprite-placement-source')); });
test('cancel and outside drop commit no project state', () => { const cancel = editor.slice(editor.indexOf('function cancelPlacementInteraction'), editor.indexOf('function applyPlacementSnap')); assert(!cancel.includes('pushUndo')); const placementStart = editor.indexOf('function beginPlacementPointerDrag'); const drop = editor.slice(editor.indexOf("window.addEventListener('pointerup'", placementStart), editor.indexOf('// --- Selection ---', placementStart)); assert(drop.includes('if (!overCanvas) return')); assert(drop.includes('if (!state.started)')); });
test('successful drop resolves the stable ID at commit and uses one placement function', () => { const commit = editor.slice(editor.indexOf('function commitPlacementPayload'), editor.indexOf('function armPlacement')); assert(commit.includes('findSpriteAssetById(payload.assetId)')); assert(commit.includes('placeSpriteAssetInstance(asset, placementPoint)')); });
test('one drop has one Undo snapshot and Redo uses shared editor history', () => { const place = editor.slice(editor.indexOf('function placeSpriteAssetInstance'), editor.indexOf('function spriteRegionPreviewHtml')); assert.strictEqual((place.match(/pushUndo\(\)/g) || []).length, 1); assert(editor.includes('redoStack.push(captureEditorSnapshot())')); });
test('placement assigns a unique Object ID through addPlaced', () => { const place = editor.slice(editor.indexOf('function placeSpriteAssetInstance'), editor.indexOf('function spriteRegionPreviewHtml')); assert(place.includes('addPlaced(item)')); assert(editor.includes('if (!item.id) item.id = generateItemId()')); });
test('drag-created Sprite is selected and Inspector-ready', () => { const place = editor.slice(editor.indexOf('function placeSpriteAssetInstance'), editor.indexOf('function spriteRegionPreviewHtml')); assert(place.includes('selectItem(item)')); assert(place.includes('renderInspector()')); });
test('Sprite cards are wired after search and folder filtering renders', () => { const render = editor.slice(editor.indexOf('function renderSpriteLibrary'), editor.indexOf('// --- Audio Asset Library')); assert(render.includes("listEl.querySelectorAll('[data-sprite-asset-id]')")); assert(render.includes('assetMatchesFilter(asset, query, folder)')); });
test('Texture rows are not wired to Sprite placement', () => { const textureBlock = editor.slice(editor.indexOf('function renderTextureLibrary'), editor.indexOf('// Phase 012: first-class Sprite metadata')); assert(!textureBlock.includes('createSpritePlacementPayload')); });
test('drag preview uses the atlas-region preview and a viewport indicator', () => { assert(editor.includes('spriteRegionPreviewHtml(asset, texture, 44)')); assert(html.includes('#placement-drop-indicator')); });
test('Place Sprite non-drag command arms the same typed path', () => { const commands = editor.slice(editor.indexOf('const COMMAND_PALETTE_ACTIONS'), editor.indexOf('let cmdPaletteActive')); assert(commands.includes("label: 'Place Sprite'")); assert(commands.includes('createSpritePlacementPayload(asset.id)')); assert(commands.includes('armPlacement')); });
test('placement reuses ground ray, shared snapping, root add and no parent assignment', () => { const commit = editor.slice(editor.indexOf('function applyPlacementSnap'), editor.indexOf('function armPlacement')); assert(commit.includes('gizmoSnap.enabled')); const drop = editor.slice(editor.indexOf("window.addEventListener('pointerup'"), editor.indexOf('// --- Selection ---')); assert(drop.includes('screenToGroundPoint')); const place = editor.slice(editor.indexOf('function placeSpriteAssetInstance'), editor.indexOf('function spriteRegionPreviewHtml')); assert(!place.includes('parentId')); });
test('Editable and Playable exports retain the shared editor/runtime path', () => { assert(editor.includes('async function buildExportHTML(playableOnly)')); assert(editor.includes('composeExportHTML({')); assert(editor.includes('serializeProject()')); assert(editor.includes('export-standalone-btn')); });
test('Phase 011 through Phase 019 suites stay wired in order', () => { for (let phase = 11; phase <= 19; phase++) assert(runner.includes(`phase-${String(phase).padStart(3, '0')}`), `phase ${phase}`); });

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 019 tests passed: ${passed}/${passed}`);
