'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const out = path.join(ROOT, 'qualification', 'phase-043');
const body = (type = 'static', linearVelocity = [0, 0]) => ({ version: 1, enabled: true, type, linearVelocity });
const box = (size = [1, 1]) => ({ version: 1, enabled: true, offset: [0, 0], size });
const circle = (radius = .5) => ({ version: 1, enabled: true, offset: [0, 0], radius });
const sensor = (size = [2, 2]) => ({ version: 1, enabled: true, shape: 'box', offset: [0, 0], size, radius: 1 });
const cube = (id, name, x, y, components = {}, extras = {}) => ({ kind: 'cube', id, name, position: [x, y, 0], scale: [1, 1, 1], color: [.18, .7, .68], rotationY: 0, behaviors: [], spin: 0, patrol: null, ai: null, mesh: 'cube', spritePassRelation: 'behind-sprites', components, ...extras });
const objects = [
  cube('wall', 'Static thin wall', 3, 0, { 'body-2d': body(), 'box-collider-2d': box([.2, 8]) }),
  cube('mover', 'Kinematic Box: straight, slide and Trigger', 0, 0, { 'body-2d': body('kinematic', [50, 10]), 'box-collider-2d': box() }),
  cube('sensor', 'Trigger before wall', 2, 1, { 'trigger-collider-2d': sensor() }, { behaviors: [{ trigger: 'trigger2DEnter', action: 'message', params: { text: 'Kinematic Enter' } }, { trigger: 'trigger2DStay', action: 'message', params: { text: 'Kinematic Stay' } }, { trigger: 'trigger2DExit', action: 'message', params: { text: 'Kinematic Exit' } }] }),
  cube('blocked-sensor', 'Trigger behind Static wall', 6, 0, { 'trigger-collider-2d': sensor() }),
  cube('rotated-wall', 'Rotated Static Box', 10, 6, { 'body-2d': body(), 'box-collider-2d': box([.4, 4]) }, { quaternion: [0, 0, Math.sin(.45 / 2), Math.cos(.45 / 2)] }),
  cube('static-circle', 'Static Circle', 14, 6, { 'body-2d': body(), 'circle-collider-2d': circle(1) }),
  cube('circle-mover', 'Kinematic Circle', 10, 3, { 'body-2d': body('kinematic', [0, 2]), 'circle-collider-2d': circle(.6) }),
  cube('dual-mover', 'Kinematic Box and Circle', 14, 3, { 'body-2d': body('kinematic', [0, 2]), 'box-collider-2d': box(), 'circle-collider-2d': circle(.8) }),
  cube('free-mover', 'Kinematic without Collider', -8, 4, { 'body-2d': body('kinematic', [1, 0]) }),
  cube('empty-static', 'Static without Collider', -6, 4, { 'body-2d': body() }),
  cube('passive-collider', 'Collider without Body', -4, 4, { 'box-collider-2d': box() }),
  cube('authoring-probe', 'Add Body through Inspector', -8, -4, {}),
  cube('parent', 'Rotated and scaled parent', 12, -5, {}, { scale: [2, 1.5, 1], quaternion: [0, 0, Math.sin(.5 / 2), Math.cos(.5 / 2)] }),
  cube('parented-mover', 'Parented Kinematic', 12, -5, { 'body-2d': body('kinematic', [1, 0]), 'box-collider-2d': box() }, { parentId: 'parent', localPosition: [1, 0, 0], localQuat: [0, 0, 0, 1], localScale: [1, 1, 1] }),
  cube('corner-x', 'Static corner X', -2, -7, { 'body-2d': body(), 'box-collider-2d': box([.2, 4]) }),
  cube('corner-y', 'Static corner Y', 0, -5, { 'body-2d': body(), 'box-collider-2d': box([4, .2]) }),
];
const project = { format: 'digital-opus-project', version: 7,
  levels: [{ id: 'phase-043-level', name: 'Phase 043 Static Kinematic Body Lab', objects }], currentLevelId: 'phase-043-level',
  world: { environment: {}, playerSettings: { controllerType: 'none', equipmentDefs: [] }, ui: { hudElements: [], startScreen: { enabled: false, title: '', subtitle: '', buttonText: 'Start', howToPlay: '', credits: '', controlsHint: '' }, winTitle: '', winMessage: '', loseTitle: '', loseMessage: '' }, description: 'Internal Body 2D qualification.', ambientAudio: { audioAssetId: null, volume: 1, loop: true } },
  prefabs: [{ name: 'Phase 043 Kinematic Prefab', record: cube('prefab-body-source', 'Prefab Body', 0, 0, { 'body-2d': body('kinematic', [1, 2]), 'box-collider-2d': box() }), parameters: [] }],
  assets: [], textures: [], spriteAssets: [], spriteSortingLayers: [{ id: 'world', name: 'World', order: 0 }], parallaxLayers: [], spriteAnimations: [], tilesets: [], tilemapChunks: [], audio: [], meta: { title: 'Phase 043 Static Kinematic Body Lab', internalOnly: true }, inputActionMap: {}, itemDefs: [] };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'phase-043-project.json'), JSON.stringify(project, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'phase-043-dogfood.json'), JSON.stringify({ phase: 43, status: 'READY_FOR_BROWSER_QUALIFICATION', project: 'qualification/phase-043/phase-043-project.json', lab: 'Phase 043 Static Kinematic Body Lab', objects: objects.map((entry) => entry.id), prefab: 'Phase 043 Kinematic Prefab', publicCatalog: false }, null, 2) + '\n');
console.log('Phase 043 dogfood fixture generated');
