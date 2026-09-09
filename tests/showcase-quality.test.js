const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const quality = require('../build/public-game-quality');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  PASS ${name}`); }
function functionsInContext(names, globals) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = editor.indexOf(`function ${name}(`);
    assert(start >= 0, `missing function ${name}`);
    let end = editor.indexOf('\n}', start) + 2;
    // One-line helpers end before the first subsequent newline.
    const newline = editor.indexOf('\n', start);
    if (editor.slice(start, newline).endsWith('}')) end = newline;
    vm.runInContext(editor.slice(start, end), context);
  }
  return context;
}

test('first-person collision body stays hidden across 120 visual-sync frames; equipment survives', () => {
  const body = { visible: true, solid: true, position: { x: 2, y: 1, z: 3 } };
  const weapon = { visible: true };
  const removed = [];
  const c = functionsInContext(['playerVisualSupportsSkinnedBody', 'setPlayerFallbackVisible', 'teardownPlayerEquipmentVisualsOnly', 'teardownPlayerVisual', 'syncPlayerVisual'], {
    player: { controllerType: 'firstperson', entity: body }, playerVisualEntity: null, craftParts: [],
    playerEquipment: { primaryHand: { entity: weapon, itemName: 'Rifle' } }, app: { scene: { remove: (entity) => removed.push(entity) } },
  });
  for (let i = 0; i < 120; i++) c.syncPlayerVisual();
  assert.strictEqual(body.visible, false);
  assert.strictEqual(body.solid, true);
  assert.deepStrictEqual(body.position, { x: 2, y: 1, z: 3 });
  assert.strictEqual(c.playerEquipment.primaryHand.entity, weapon);
  assert.strictEqual(removed.length, 0);
  c.player.controllerType = 'thirdperson';
  c.teardownPlayerVisual();
  assert.strictEqual(body.visible, true);
  assert.strictEqual(removed[0], weapon);
});

test('authoring markers, old path members and spawn nodes hide; functional visible props remain', () => {
  const item = (id, extra = {}) => ({ id, kind: 'cube', entity: { visible: true }, ...extra });
  const placed = [item('trigger', { isTrigger: true }), item('waypoint', { isWaypoint: true }), item('spawn', { isSpawnPoint: true }), item('newpoint', { isPathPoint: true }), item('oldpoint'), item('prop'), item('camera', { kind: 'camera' }), item('light', { kind: 'light' }), item('spawner', { kind: 'spawner', options: { startEnabled: false } }), { kind: 'path', pointIds: ['oldpoint'] }];
  const c = functionsInContext(['preparePlacedForPlay'], { placed });
  c.preparePlacedForPlay();
  for (const record of placed.filter((p) => p.entity && p.id !== 'prop')) assert.strictEqual(record.entity.visible, false, record.id);
  assert.strictEqual(placed.find((p) => p.id === 'prop').entity.visible, true);
  assert.strictEqual(placed.find((p) => p.id === 'spawner').spawnerState.enabled, false);
});

test('first-person hitscan intersects the crosshair target while its muzzle stays below the sightline', () => {
  class Vec { constructor(x, y, z) { Object.assign(this, { x, y, z }); } clone() { return new Vec(this.x, this.y, this.z); } add(v) { return new Vec(this.x + v.x, this.y + v.y, this.z + v.z); } scale(n) { return new Vec(this.x * n, this.y * n, this.z * n); } }
  const eye = new Vec(0, 1.2, 0), forward = new Vec(0, 0, 1), muzzle = new Vec(.25, .9, .7);
  let ray, flash;
  const weapon = { mode: 'hitscan', range: 20, damage: 10 };
  const c = functionsInContext(['performPlayerWeaponFire'], {
    player: { controllerType: 'firstperson', entity: { position: new Vec(0, .6, 0), forward } },
    app: { camera: { eye, getBasis: () => ({ forward }) } },
    resolveActivePlayerWeapon: () => weapon, resolveMuzzleOrigin: () => muzzle, applySpread: (dir) => dir,
    fireHitscan: (origin, direction) => { ray = { origin, direction }; return { t: 10 }; },
    triggerImpactEffect() {}, triggerMuzzleEffect: (config, origin) => { flash = origin; }, applyWeaponRecoilKick() {},
  });
  c.performPlayerWeaponFire();
  const intersection = ray.origin.add(ray.direction.scale(10));
  assert.strictEqual(intersection.y, 1.2, 'centered target is hit at camera height, not 0.6 units below it');
  assert.strictEqual(intersection.z, 10);
  assert.strictEqual(flash, muzzle, 'muzzle effect remains attached to the held weapon');
});

test('authored torso colliders can be hit and invisible helpers cannot intercept the shot', () => {
  const context = { window: {}, document: {}, Float32Array, Uint16Array, Uint8Array, Uint32Array, ArrayBuffer, DataView };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'dist/opus-engine.js'), 'utf8'), context);
  const Opus = context.window.Opus;
  const origin = new Opus.Vec3(0, 1.2, 0), dir = new Opus.Vec3(0, 0, 1);
  const enemy = { kind: 'cube', tags: ['enemy'], collider: { shape: 'sphere', offset: { x: 0, y: 1.2, z: 0 }, radius: .5 }, entity: { visible: true, solid: false, position: new Opus.Vec3(0, 0, 10), scale: new Opus.Vec3(1, 1, 1) } };
  const helper = { kind: 'cube', entity: { visible: false, solid: true, position: new Opus.Vec3(0, 1.2, 3), scale: new Opus.Vec3(3, 3, 3) } };
  let damaged;
  const c = functionsInContext(['itemColliderConfig', 'combatTargetSphere', 'fireHitscan'], { Opus, player: null, placed: [helper, enemy], applyHitDamage: hit => { damaged = hit.item; } });
  assert.strictEqual(Opus.Physics.raySphere(origin, dir, enemy.entity.position, .5), null, 'old feet-centered proxy misses the visible torso');
  const hit = c.fireHitscan(origin, dir, 20, 10, 'player', '', 0);
  assert.strictEqual(hit.item, enemy);
  assert.strictEqual(damaged, enemy);
});

test('authored world bounds constrain XZ without losing vertical motion or legacy fallback', () => {
  class Vec { constructor(x,y,z) { Object.assign(this,{x,y,z}); } clone() { return new Vec(this.x,this.y,this.z); } }
  const fallback = {};
  const c = functionsInContext(['applyPlayerPlayBounds'], { currentPlayerSettings: { playBounds: { minX: -4, maxX: 4, minZ: -2, maxZ: 20 } }, MAP_BOUNDARY: 40, Opus: { Physics: { applyMapBoundary: () => fallback } } });
  const bounded = c.applyPlayerPlayBounds(new Vec(7,12,23), new Vec(4,-3,2), .5);
  assert.strictEqual(bounded.correctedPosition.x, 3.5);
  assert.strictEqual(bounded.correctedPosition.z, 19.5);
  assert.strictEqual(bounded.correctedPosition.y, 12);
  assert.strictEqual(bounded.correctedVelocity.x, 0);
  assert.strictEqual(bounded.correctedVelocity.y, -3);
  c.currentPlayerSettings = {};
  assert.strictEqual(c.applyPlayerPlayBounds(new Vec(0,1,0), new Vec(0,0,0), .5), fallback);
});

test('carried objects do not steal interact focus from the target console', () => {
  const item = (id, distance) => ({ id, kind: 'cube', entity: { visible: true, position: distance }, behaviors: [{ trigger: 'interact' }] });
  const cell = item('cell', .6), generator = item('generator', 1.4);
  const c = functionsInContext(['updateInteract'], {
    placed: [cell, generator], heldObjectItem: cell, INTERACT_RANGE: 3,
    player: { entity: { position: { sub: (distance) => ({ length: () => distance }) } } },
    document: { getElementById: () => ({ classList: { toggle() {}, remove() {} } }) },
  });
  c.updateInteract();
  assert.strictEqual(c.nearestInteractable, generator);
  c.heldObjectItem = null;
  c.updateInteract();
  assert.strictEqual(c.nearestInteractable, cell, 'a dropped object can be picked up again');
});

test('static mesh UVs and mesh-owned palette metadata survive save/load', () => {
  const asset = { id: 'mesh1', name: 'Original prop', type: 'mesh', positions: [0, 0, 0], normals: [0, 1, 0], indices: [0], uvs: [0.4, 0.6], textureAssetId: 'palette' };
  let args;
  const c = functionsInContext(['getAssetMeshHandle', 'serializeAssets', 'loadAssets'], {
    assets: [asset], Float32Array, Uint16Array,
    Opus: { Mesh: { fromArrays: (...values) => { args = values; return { uploaded: true }; } } },
    findAssetById: () => null, reconcileAssetIdCounter() {}, renderAssetLibrary() {},
  });
  c.getAssetMeshHandle(asset);
  assert.deepStrictEqual(Array.from(args[3]).map((n) => +n.toFixed(2)), asset.uvs);
  const serialized = c.serializeAssets(new Set(['mesh1']));
  assert.deepStrictEqual(Array.from(serialized[0].uvs), asset.uvs);
  assert.strictEqual(serialized[0].textureAssetId, 'palette');
  c.assets = [];
  c.loadAssets(serialized);
  assert.strictEqual(c.assets[0].textureAssetId, 'palette');
});

test('project controls default to blank and every authored end sound survives dependency collection', () => {
  const c = functionsInContext(['defaultUiConfig'], {});
  assert.strictEqual(c.defaultUiConfig().startScreen.controlsHint, '');
  assert.strictEqual(c.defaultUiConfig().startScreen.howToPlay, '');
  assert(editor.includes('if (level.ui && level.ui.winAudioAssetId) dep.audioAssets.add(level.ui.winAudioAssetId)'));
  assert(editor.includes('if (ps.footstepAudioAssetId) dep.audioAssets.add(ps.footstepAudioAssetId)'));
});

test('standalone ending offers restart and authored sound, without editor navigation', () => {
  const nodes = new Map();
  const node = (id) => { if (!nodes.has(id)) nodes.set(id, { textContent: '', classList: { add() {} } }); return nodes.get(id); };
  const sounds = [];
  let pointerReleased = false;
  const c = functionsInContext(['endGame'], {
    releaseFirstPersonPointerLock: () => { pointerReleased = true; },
    gameEnded: false, playableOnlyMode: true, endOverlayEl: node('overlay'), endOverlayTitleEl: node('title'),
    currentUiConfig: { winTitle: 'Beacon restored', winMessage: 'Home awaits', winAudioAssetId: 'fanfare' },
    findAudioAssetById: () => ({ audioBuffer: 'audio' }), app: { audio: { playBuffer: (buffer) => sounds.push(buffer) } }, document: { getElementById: node },
  });
  c.endGame('win');
  assert.strictEqual(node('end-overlay-btn').textContent, 'Restart');
  assert.deepStrictEqual(sounds, ['audio']);
  assert.strictEqual(pointerReleased, true, 'end modal releases locked pointer before Restart interaction');
});

// Test-only PNGs exercise evidence validation; they are never catalog assets.
function png(seed) {
  function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
  function chunk(type, bytes) { const head = Buffer.alloc(8); head.writeUInt32BE(bytes.length); head.write(type, 4); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), bytes]))); return Buffer.concat([head, bytes, crc]); }
  const header = Buffer.alloc(13); header.writeUInt32BE(640); header.writeUInt32BE(360, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((640 * 3 + 1) * 360, seed);
  for (let y = 0; y < 360; y++) pixels[y * (640 * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-quality-'));
try {
  const directory = path.join(temp, 'public-showcase-review', 'sample');
  fs.mkdirSync(directory, { recursive: true });
  for (const [index, role] of ['gameplay', 'opening', 'highlight'].entries()) fs.writeFileSync(path.join(directory, role + '.png'), png(index));
  const project = { meta: { title: 'Sample', description: 'Reach the amber arch.' }, levels: [{ ui: { startScreen: { enabled: true, title: 'Sample', howToPlay: 'WASD move. Reach the arch.' } } }], assets: [] };
  const entry = { id: 'sample', title: 'Sample', visibility: 'public', qualityTier: 'sample', featured: false, playable: true, purpose: 'A moving-platform sample', description: 'Reach the amber arch.', genre: 'Platforming', controller: 'Third-Person', playtime: '3–5 minutes', screenshot: 'public-showcase-review/sample/gameplay.png', qualityReview: { visual: 3, gameplayClarity: 4, presentation: 3, audio: 2, standaloneVerified: true, licenseVerified: true, noPlaceholders: true, reviewedAt: '2026-09-07' } };
  test('a reviewed Sample passes with a real file path; internal fixtures never become public implicitly', () => {
    assert.deepStrictEqual(quality.validatePublicGame(entry, project, { root: temp }), []);
    assert.deepStrictEqual(quality.validatePublicGame({ ...entry, visibility: 'internal', qualityReview: {} }, {}, { root: temp }), []);
  });
  test('public gate rejects title mismatch, low scores, missing captures, and diagnostic meshes', () => {
    const invalid = { ...entry, screenshot: '../outside.png', qualityReview: { ...entry.qualityReview, visual: 2 } };
    const broken = { ...project, meta: { title: 'Wrong title' }, assets: [{ name: 'Bent ribbon', type: 'skinnedMesh', positions: Array(30).fill(0) }] };
    const errors = quality.validatePublicGame(invalid, broken, { root: temp });
    for (const text of ['visual must be at least', 'must match catalog title', 'diagnostic mesh', 'screenshot']) assert(errors.some((error) => error.includes(text)), text);
  });
  test('Featured requires thresholds and three different standalone captures', () => {
    const featured = { ...entry, qualityTier: 'featured', featured: true, qualityReview: { ...entry.qualityReview, visual: 4, gameplayClarity: 4, presentation: 4, audio: 3 }, screenshots: { opening: 'public-showcase-review/sample/opening.png', gameplay: entry.screenshot, highlight: 'public-showcase-review/sample/highlight.png' } };
    assert.deepStrictEqual(quality.validatePublicGame(featured, project, { root: temp }), []);
    fs.copyFileSync(path.join(directory, 'gameplay.png'), path.join(directory, 'highlight.png'));
    assert(quality.validatePublicGame(featured, project, { root: temp }).some((error) => error.includes('three different')));
  });
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log(`Showcase quality: ${passed}/${passed} passed`);
