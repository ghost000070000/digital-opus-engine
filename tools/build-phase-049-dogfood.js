'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { composeExportHTML } = require('../build/export-template.js');
const F = require('../editor/src/00-collision-filter-2d.js');
const A = require('../editor/src/00-authoring-schema.js');
const P = require('../editor/src/00-authoring-plumbing.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qualification/phase-049');
const campaign = path.join(out, 'export-campaign'); fs.mkdirSync(campaign, { recursive: true });
const names = ['Default', 'World', 'Character', 'Enemy', 'Projectile', 'Pickup', 'Sensor', 'Ghost'];
const id = (name) => name === 'Default' ? F.DEFAULT_ID : `collision-layer-${name.toLowerCase()}`;
const filter = (name, accepts) => ({ collisionLayerRef: id(name), collisionMaskMode: accepts ? 'custom' : 'all', collisionMaskRefs: (accepts || []).map(id).sort() });
function cube(name, x, y, layer, accepts, extras = {}) {
  return { kind: 'cube', id: `phase-049-${name}`, name, position: [x, y, 0], scale: [...(extras.size || [1, 1]), .3], color: layer === 'Ghost' ? [.6, .3, .9] : extras.static ? [.9, .35, .25] : [.15, .8, .72], unlit: true, rotationY: 0, behaviors: [], components: {
    'box-collider-2d': { version: 2, enabled: true, offset: [0, 0], size: [1, 1], ...filter(layer, accepts) },
    'body-2d': { version: 1, enabled: true, type: extras.static ? 'static' : 'kinematic', linearVelocity: extras.velocity || [0, 0] },
    ...(extras.character ? { 'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 } } : {}),
    ...(extras.platform ? { 'moving-platform-2d': { version: 1, enabled: true } } : {}),
    ...(extras.components || {}),
  } };
}
const project = JSON.parse(fs.readFileSync(path.join(root, 'qualification/phase-048/phase-048-project.json'), 'utf8'));
project.collisionLayers = names.map((name, order) => ({ id: id(name), name, order }));
project.meta = { ...project.meta, title: 'Phase 049 Collision Filtering Lab', visibility: 'internal' };
project.levels = [project.levels[0]]; project.currentLevelIndex = 0; project.startLevelIndex = 0;
const level = project.levels[0]; level.id = 'phase-049-level'; level.name = 'Phase 049 Collision Filtering Lab';
const inherited = level.objects.filter((object) => ['camera', 'player'].includes(object.kind));
const accepted = cube('accepted-character', 0, 0, 'Character', ['World'], { velocity: [2, 0] });
const rejected = cube('ghost-character', 0, 3, 'Ghost', [], { velocity: [2, 0] });
const sensor = cube('sensor', 2, 6, 'Ghost', [], { static: true, components: {
  'trigger-collider-2d': { version: 2, enabled: true, shape: 'box', offset: [0, 0], size: [4, 2], radius: 1, ...filter('Sensor', ['Character']) },
} });
const objects = [accepted, rejected,
  { kind: 'camera', id: 'phase-049-camera', name: 'Filtering Lab 2D Camera', isActiveCamera: true, options: { position: [10, 5, 30], mode: 'fixed', projection: 'orthographic', orthographicHeight: 18, near: .1, far: 100, rotationDegrees: { x: 0, y: 0, z: 0 } } },
  cube('accepted-wall', 3, 0, 'World', ['Character'], { static: true }),
  cube('ghost-wall', 3, 3, 'World', ['Character'], { static: true }), sensor,
  cube('trigger-character', 0, 6, 'Character', ['Sensor'], { velocity: [1, 0] }),
  cube('platform', 0, 10, 'World', ['Character'], { platform: true, size: [4, .5], velocity: [.5, 0] }),
  cube('rider', 0, 10.75, 'Character', ['World'], { character: true }),
  cube('one-way', 8, 0, 'World', ['Character'], { static: true, size: [4, .5], components: { 'one-way-platform-2d': { version: 1, enabled: true } } }),
  cube('one-way-fall', 8, 2, 'Character', ['World'], { character: true, velocity: [0, -1] }),
  cube('slope', 14, 0, 'World', ['Character'], { static: true, size: [4, .5] }),
  cube('missing-filter', 20, 0, 'Ghost', [], { velocity: [1, 0] }),
  cube('enemy', 25, 3, 'Enemy', ['Projectile'], { static: true }),
  cube('projectile', 21, 3, 'Projectile', ['Enemy'], { velocity: [2, 0], size: [.3, .3] }),
  cube('pickup', 23, 6, 'Ghost', [], { static: true, components: { 'trigger-collider-2d': { version: 2, enabled: true, shape: 'circle', offset: [0, 0], radius: 1, ...filter('Pickup', ['Character']) } } }),
  cube('pickup-character', 21, 6, 'Character', ['Pickup'], { velocity: [1, 0] }),
];
objects.find((object) => object.name === 'slope').quaternion = [0, 0, Math.sin(Math.PI / 12), Math.cos(Math.PI / 12)];
level.objects = [...inherited, ...objects];
level.description = 'Internal collision-mask dogfood only. Teal Characters accept World; Ghost ignores everything; Sensor owns an independent trigger mask.';
level.ui = { ...level.ui, startScreen: { ...(level.ui && level.ui.startScreen), enabled: false } };
// Preserve the existing sparse Tilemap assets while authoring explicit v6 filters.
const seedMap = JSON.parse(fs.readFileSync(path.join(root, 'phase-040-10k-project.json'), 'utf8'));
const sourceMap = seedMap.levels.flatMap((entry) => entry.objects || []).find((object) => object.kind === 'tilemap');
if (sourceMap) {
  const map = { ...sourceMap, ...P.createTilemapRecord(sourceMap), id: 'phase-049-tilemap', name: 'Filtered multi-layer Tilemap', position: [200, 0, 0] };
  map.layers.forEach((layer, index) => Object.assign(layer, filter(index % 2 ? 'Ghost' : 'World', index % 2 ? [] : ['Character'])));
  level.objects.push(map); project.tilesets = seedMap.tilesets.map((tileset) => P.createTileset(tileset)); project.textures = seedMap.textures; project.spriteAssets = seedMap.spriteAssets; project.prefabs = seedMap.prefabs;
  project.spriteSortingLayers = P.normalizeSpriteSortingLayers(seedMap.spriteSortingLayers).map((layer, order) => ({ ...layer, order }));
}
for (const object of level.objects) if (object.components) object.components = A.serializeComponents(object);
const validation = P.collectProjectIssues(project).issues;
if (validation.length) throw new Error(`Lab has unexpected validation issues: ${JSON.stringify(validation)}`);
fs.writeFileSync(path.join(out, 'phase-049-project.json'), JSON.stringify(project, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'phase-049-dogfood.json'), JSON.stringify({ status: 'AUTHORING_FIXTURE_READY', layers: project.collisionLayers, objects: level.objects.map((object) => ({ id: object.id, name: object.name, kind: object.kind })), validationIssues: validation, internalOnly: true, publicGameCount: 28, qualificationPending: 'Final browser and active soak' }, null, 2) + '\n');
const variants = ['physical-accept', 'physical-reject', 'trigger-enter-exit', 'mixed-shapes', 'tile-layers', 'one-way', 'slope-step', 'moving-carry', 'rename-reorder', 'missing-reference'];
const sourceNames = ['00-inspector-fields.js', '00-collision-filter-2d.js', '00-collider-2d.js', '00-trigger-collider-2d.js', '00-one-way-2d.js', '00-character-slope-2d.js', '00-moving-platform-2d.js', '00-body-2d.js', '00-authoring-schema.js', '00-authoring-plumbing.js', '00-character-tile-query.js', '00-tilemap-bundle.js', '00-sprite-authoring.js', '00-authoring-language.js', '00-gameplay-presets.js', '00-onboarding.js', '00-sprite-starters.js', '01-editor.js'];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const common = { htmlTemplate: read('editor/index.html'), engineJS: read('dist/opus-engine.js'), templateJS: read('build/export-template.js') };
const artifacts = [];
for (let index = 0; index < variants.length; index++) for (const playableOnly of [false, true]) {
  const variant = variants[index], tier = playableOnly ? 'playable' : 'editable';
  const doc = JSON.parse(JSON.stringify(project));
  if (variant === 'missing-reference') doc.levels[0].objects.find((object) => object.id === 'phase-049-missing-filter').components['box-collider-2d'].collisionLayerRef = 'collision-layer-missing';
  if (variant === 'mixed-shapes') doc.levels[0].objects.find((object) => object.id === 'phase-049-ghost-character').components['circle-collider-2d'] = { version: 2, enabled: true, offset: [0, 0], radius: .5, ...filter('Character', ['World']) };
  const camera = doc.levels[0].objects.find((object) => object.id === 'phase-049-camera');
  if (variant === 'tile-layers') { camera.options.position = [204, 0, 30]; camera.options.orthographicHeight = 45; }
  if (variant === 'rename-reorder') { F.renameLayer(doc, id('World'), 'Environment'); F.reorderLayer(doc, id('World'), 7); }
  const editorJS = sourceNames.filter((name) => !playableOnly || name !== '00-tilemap-bundle.js').map((name) => read('editor/src/' + name)).join('\n');
  const html = composeExportHTML({ ...common, editorJS, embeddedProjectJSON: JSON.stringify(doc), playableOnly, title: `${level.name} — ${variant}` });
  const file = `${String(index + 1).padStart(2, '0')}-${variant}-${tier}.html`; fs.writeFileSync(path.join(campaign, file), html);
  artifacts.push({ variant, tier, file, bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex') });
}
fs.writeFileSync(path.join(out, 'phase-049-export-proof.json'), JSON.stringify({ status: 'COMPOSED_NOT_BROWSER_QUALIFIED', editable: 10, playable: 10, artifacts }, null, 2) + '\n');
console.log(`Phase 049 internal Lab and ${artifacts.length} exact exports composed; browser qualification still required.`);
module.exports = { sourceNames, variants };
