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
  globals.controllerStateSession = 0;
  globals.controllerStateEvents = null;
  names = ['resetControllerStateEvents', ...names];
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

test('actual third-person spawn honours an authored ranger-height body instead of fixed 1.1m', () => {
  class Vec { constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); } clone() { return new Vec(this.x,this.y,this.z); } }
  const c=functionsInContext(['playerBodyHeight','spawnThirdPersonController'], {
    currentPlayerSettings:{collisionHeight:1.855,collisionRadius:.5}, cubeMesh:{}, isTouchDevice:false,
    Opus:{Vec3:Vec}, document:{getElementById:()=>({style:{}})},
    app:{addEntity:o=>o,camera:{setChaseOptions(){},setTarget(){},setMode(){}}},
  });
  c.spawnThirdPersonController(new Vec(0,.9275,0));
  assert.strictEqual(c.player.entity.scale.y,1.855,'native ranger height must not extend .755m above the physical body');
});

test('explicit character body height covers the rendered ranger and preserves historical defaults', () => {
  // Native 060958036Z: ranger head reaches .755 above the court while its
  // fixed 1.1m body reports clear. A body fit must not silently resize old projects.
  const c = functionsInContext(['playerBodyHeight', 'playerTerrainClearance', 'fitPlayerCharacterBody'], {
    currentPlayerSettings: { controllerType: 'thirdperson', collisionRadius: .5 },
    findAssetById: () => ({ type: 'skinnedMesh', positions: [-.48309,0,-.2395,.48309,1.855,.23] }),
  });
  assert.strictEqual(c.playerBodyHeight(), 1.1);
  assert.strictEqual(c.playerTerrainClearance({ scale: { y: 1.1 } }, .5), .5);
  c.currentPlayerSettings.visual = { mode: 'skinned', assetId: 'ranger', scale: 1, positionOffset: { x: 0, y: -.55, z: 0 } };
  const fit = c.fitPlayerCharacterBody();
  assert.strictEqual(fit.collisionHeight, 1.855);
  assert.strictEqual(fit.visual.positionOffset.y, -.9275);
  assert.strictEqual(fit.visual.followBodyHeight, true);
  Object.assign(c.currentPlayerSettings, fit);
  assert.strictEqual(c.playerBodyHeight(), 1.855);
  assert.strictEqual(c.playerTerrainClearance({ scale: { y: 1.855 } }, .5), .9275);
  assert.strictEqual(c.playerTerrainClearance({ scale: { y: 1.02025 } }, .5), .510125);
  c.currentPlayerSettings.collisionHeight = NaN;
  assert.strictEqual(c.playerBodyHeight(), 1.1, 'invalid authored heights do not poison movement');
  c.currentPlayerSettings.visual.scale = -1;
  assert.strictEqual(c.fitPlayerCharacterBody(), null, 'invalid visuals cannot be fitted');
});

test('fitted visual feet/head follow standing and crouched body while legacy offset stays unchanged', () => {
  const publicContext={window:{addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}},localStorage:{getItem(){return null;},setItem(){}},Float32Array,Uint16Array,Uint32Array,Uint8Array,DataView,ArrayBuffer,TextDecoder};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'dist/opus-engine.js'),'utf8'),publicContext);
  const O=publicContext.window.Opus,body={position:new O.Vec3(0,-.9275,0),scale:new O.Vec3(.6,1.855,.6),quaternion:O.Quat.identity()};
  const visualEntity={position:new O.Vec3(),scale:new O.Vec3(1,1,1),quaternion:O.Quat.identity()};
  const c=functionsInContext(['playerBodyHeight','syncPlayerVisual'],{
    Opus:O,player:{controllerType:'thirdperson',entity:body},playerVisualEntity:visualEntity,
    currentPlayerSettings:{collisionHeight:1.855,visual:{mode:'skinned',assetId:'ranger',scale:1,positionOffset:{x:0,y:-.9275,z:0},followBodyHeight:true}},
    playerVisualSupportsSkinnedBody:()=>true,findAssetById:()=>({type:'skinnedMesh'}),setPlayerFallbackVisible(){},
  });
  for(const stance of [1,.55,1]) {
    body.scale.y=1.855*stance;body.position.y=-body.scale.y/2;c.syncPlayerVisual();
    const feet=visualEntity.position.y,head=feet+1.855*visualEntity.scale.y;
    assert(Math.abs(head)<1e-9,'ranger head remains below the solid court underside');
    assert(Math.abs(feet-(body.position.y-body.scale.y/2))<1e-9,'crouch never buries the visible feet');
    assert.strictEqual(visualEntity.scale.x,1,'standing width/visual identity is preserved');
  }
  delete c.currentPlayerSettings.visual.followBodyHeight;
  body.scale.y=1.855*.55;c.syncPlayerVisual();
  assert.strictEqual(visualEntity.scale.y,1,'historical unfitted visual scaling is not silently changed');
});

test('stock character-body migration is exact, idempotent and preserves custom character assets/settings', () => {
  const repair=require('../tools/real-demo-character-body').repair;
  const project=()=>({assets:[require('../tools/showcase-assets').getMesh('ranger')],levels:[{id:'lab',playerSettings:{controllerType:'thirdperson',visual:{mode:'skinned',assetId:'showcase-ranger',scale:1,rotationOffsetY:0,positionOffset:{x:0,y:-.55,z:0}}}}]});
  const p=project();assert.strictEqual(repair(p).changes.length,1);assert.strictEqual(repair(p).changes.length,0);
  for(const mutate of [p=>p.assets[0].positions[0]+=.1,p=>p.levels[0].playerSettings.collisionHeight=2,p=>p.levels[0].playerSettings.visual.positionOffset.x=.1,p=>p.levels[0].playerSettings.controllerType='topdown']) {
    const custom=project();mutate(custom);const before=JSON.stringify(custom);assert.strictEqual(repair(custom).changes.length,0);assert.strictEqual(JSON.stringify(custom),before,'custom authored content stays byte-equivalent');
  }
});

test('shared editor history captures independent player settings, not just scene objects', () => {
  const c=functionsInContext(['copyComponentPresetLibrary','captureLevelLogicSnapshot','captureEditorSnapshot'],{
    serializeScene:()=>[],serializeTilesets:()=>[],serializeTilemapChunks:()=>[],collisionLayers:[],levels:[],prefabs:[],graphFunctions:[],
    currentPlayerSettings:{controllerType:'thirdperson',visual:{positionOffset:{x:0,y:-.55,z:0}}},
    OpusComponentPresets:require('../editor/src/00-component-presets'),componentPresets:[{format:'future-preserved',version:99,record:{value:0}}],
  });
  const snapshot=c.captureEditorSnapshot();
  c.currentPlayerSettings.collisionHeight=1.855;c.currentPlayerSettings.visual.positionOffset.y=-.9275;
  assert(snapshot.playerSettings,'native Fit/Undo proved settings were absent from shared history');
  assert.strictEqual(snapshot.playerSettings.collisionHeight,undefined);
  assert.strictEqual(snapshot.playerSettings.visual.positionOffset.y,-.55,'snapshot must not alias live visual settings');
  c.componentPresets[0].record.value=9;
  assert.strictEqual(snapshot.componentPresets[0].record.value,0,'actual snapshot uses the independent real preset library copy');
});

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

test('despawn tears down the authored player visual before recreating the controller', () => {
  // Native Moving Temple060235690Z / Valley060314890Z pause-restarts show
  // both the green primitive and ranger: the old visual survives despawn.
  const body={visible:false,solid:true},visual={visible:true},weapon={visible:true};
  const removed=[];let controllerDespawned=false;
  const inventory={Rifle:1},equipmentDefs=[{itemName:'Rifle',slot:'primaryHand',assetId:'rifle',extension:{keep:true}}];
  const c=functionsInContext(['playerVisualSupportsSkinnedBody','setPlayerFallbackVisible','teardownPlayerEquipmentVisualsOnly','unequipSlot','teardownPlayerEquipment','teardownPlayerVisual','despawnPlayer'],{
    player:{controllerType:'thirdperson',entity:body},playerVisualEntity:visual,craftParts:[],
    playerEquipment:{primaryHand:{entity:weapon,itemName:'Rifle'}},app:{scene:{remove:e=>removed.push(e)}},
    window:{__gameInventory:inventory},currentPlayerSettings:{equipmentDefs},
    PLAYER_CONTROLLERS:{thirdperson:{despawn(){controllerDespawned=true;}}},
  });
  c.despawnPlayer();
  assert.strictEqual(c.playerVisualEntity,null,'a new controller must receive a newly owned authored visual');
  assert.strictEqual(controllerDespawned,true);
  assert.deepStrictEqual(removed,[visual,weapon]);
  assert.strictEqual(Object.keys(c.playerEquipment).length,0,'controller generation cleanup clears transient equipped slots');
  assert.strictEqual(c.window.__gameInventory,inventory,'generation cleanup does not replace logical inventory');
  assert.strictEqual(c.window.__gameInventory.Rifle,1,'owned item remains in canonical inventory');
  assert.strictEqual(c.currentPlayerSettings.equipmentDefs,equipmentDefs,'generation cleanup preserves authored equipment definitions');
  assert.strictEqual(c.currentPlayerSettings.equipmentDefs[0].extension.keep,true);
  assert.strictEqual(body.solid,true,'render cleanup does not mutate collision policy');
});

test('first-person look uses standard signs, honors invert Y, sensitivity, and clamps extreme input', () => {
  let inverted = false;
  const rotations = [];
  const c = functionsInContext(['applyFirstPersonLook', 'effectiveMouseSensitivity'], {
    fpYaw: 0, fpPitch: 0, FP_PITCH_LIMIT: 1.5,
    firstPersonEntity: { quaternion: null },
    currentPlayerSettings: { mouseSensitivity: 0.0022 },
    app: { settings: { get: (key) => key === 'invertMouseY' ? inverted : 0.0018 } },
    Opus: { Quat: { fromEuler: (...args) => { rotations.push(args); return args; } } },
    Number,
  });
  assert.strictEqual(c.effectiveMouseSensitivity(), 0.0018);
  c.applyFirstPersonLook(100, -50, c.effectiveMouseSensitivity());
  assert.ok(c.fpYaw > 0, 'mouse right looks right');
  assert.ok(c.fpPitch < 0, 'mouse up looks up in the engine quaternion convention');
  const ordinaryPitch = c.fpPitch;
  inverted = true;
  c.fpPitch = 0;
  c.applyFirstPersonLook(0, -50, c.effectiveMouseSensitivity());
  assert.ok(c.fpPitch > 0 && Math.abs(c.fpPitch + ordinaryPitch) < 1e-9, 'invert Y reverses only the vertical response');
  c.applyFirstPersonLook(0, 1e9, 1);
  assert.strictEqual(c.fpPitch, -1.5, 'repeated extreme inverted input remains pitch-clamped');
  assert.ok(rotations.length >= 3);
});

test('player input overrides persist independently of author defaults', () => {
  const persisted = new Map();
  const c = functionsInContext(['validInputActionCode', 'loadPlayerInputOverrides', 'savePlayerInputOverrides'], {
    playerInputOverrides: {},
    findInputAction: (id) => ['moveForward', 'attack'].includes(id) ? { id } : null,
    app: { settings: { get: (key) => persisted.get(key), set: (key, value) => persisted.set(key, JSON.parse(JSON.stringify(value))) } },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-player-rebind-screen'),'utf8')+'\nplayerPreferenceScope=OpusPlayerRebindScreen.scope({projectMeta:{id:"showcase"}});',c);
  c.playerInputOverrides = { moveForward: 'KeyI', attack: 'Mouse0' };
  c.savePlayerInputOverrides();
  c.playerInputOverrides = {};
  c.loadPlayerInputOverrides();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.playerInputOverrides)), { moveForward: 'KeyI', attack: 'Mouse0' });
});

test('step, crouch clearance, and moving-platform carry keep physical bodies coherent', () => {
  class Vec {
    constructor(x, y, z) { Object.assign(this, { x, y, z }); }
    add(v) { return new Vec(this.x + v.x, this.y + v.y, this.z + v.z); }
    sub(v) { return new Vec(this.x - v.x, this.y - v.y, this.z - v.z); }
    scale(n) { return new Vec(this.x * n, this.y * n, this.z * n); }
    clone() { return new Vec(this.x, this.y, this.z); }
  }
  const mover = { position: new Vec(0, 0.5, 0), scale: new Vec(1, 1, 1) };
  const velocity = new Vec(2, -1, 0);
  const step = { kind: 'cube', entity: { position: new Vec(0, 0.2, 0), scale: new Vec(2, 0.4, 2), solid: true, visible: true, quaternion: null } };
  const c = functionsInContext(['itemColliderConfig', 'tryStepUp', 'canStandAt', 'applyCrouchState', 'applyPlatformCarry'], {
    Opus: { Vec3: Vec }, STEP_HEIGHT: 0.5, CROUCH_HEIGHT_MULTIPLIER: 0.55, placed: [step],
  });
  assert.ok(c.tryStepUp(mover, velocity, 0.5, true, step));
  assert.strictEqual(mover.position.y, 0.9);
  assert.strictEqual(velocity.y, 0);

  assert.ok(c.applyCrouchState(mover, true, 0.5));
  assert.strictEqual(mover.scale.y, 0.55);
  assert.ok(Math.abs((mover.position.y - mover.scale.y / 2) - 0.4) < 1e-9, 'crouch keeps feet planted');
  const lowCeiling = { kind: 'cube', entity: { position: new Vec(0, 1.2, 0), scale: new Vec(3, 0.3, 3), solid: true, visible: true, quaternion: null } };
  c.placed = [lowCeiling];
  assert.ok(c.applyCrouchState(mover, false, 0.5), 'release cannot expand the body through a low ceiling');

  const platform = { entity: { position: new Vec(3, 2, 4) }, _carryPrevPos: new Vec(1, 1, 1) };
  const beforeY = mover.position.y;
  c.applyPlatformCarry(mover, platform, true);
  assert.strictEqual(mover.position.x, 2);
  assert.strictEqual(mover.position.z, 3);
  assert.strictEqual(mover.position.y, beforeY, 'vertical snap remains authoritative; carry only applies XZ delta');
});

test('authoring markers, old path members and spawn nodes hide; functional visible props remain', () => {
  const item = (id, extra = {}) => ({ id, kind: 'cube', entity: { visible: true }, ...extra });
  const placed = [item('trigger', { isTrigger: true }), item('waypoint', { isWaypoint: true }), item('spawn', { isSpawnPoint: true }), item('newpoint', { isPathPoint: true }), item('oldpoint'), item('prop'), item('camera', { kind: 'camera' }), item('light', { kind: 'light' }), item('spawner', { kind: 'spawner', options: { startEnabled: false } }), { kind: 'path', pointIds: ['oldpoint'] }];
  const c = functionsInContext(['captureAuthoredSessionLevels','captureAuthoredDeathBaseline','captureAuthoredObjectHealth','preparePlacedForPlay'], { placed, levels:[{id:'markers',objects:[]}], currentLevelIndex:0, restoreDoorGatesForAuthoring: () => {}, prepareDoorGatesForPlay: () => {}, OpusAuthoring: require('../editor/src/00-authoring-schema'), serializeItemRecord: item => ({ id:item.id, kind:item.kind, pointIds:item.pointIds }) }); // No Door components in this marker-only fixture.
  vm.runInContext('let authoredDeathBaseline = new Map(); let authoredDeathJournal = new Set(); let authoredSessionLevels = new Map();', c);
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
  const c = functionsInContext(['interactionPolicy', 'updateInteract'], {
    placed: [cell, generator], heldObjectItem: cell, INTERACT_RANGE: 3,
    playMode: true, gameEnded: false, app: { paused: false }, effectiveInputMap: { interact: 'KeyF' }, keyCodeToLabel: () => 'F',
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
  const c = functionsInContext(['copyPortableAssetExtras', 'getAssetMeshHandle', 'serializeAssets', 'loadAssets'], {
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
