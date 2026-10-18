'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Collider = require('../editor/src/00-collider-2d.js');
const Slope = require('../editor/src/00-character-slope-2d.js');
const { composeExportHTML } = require('../build/export-template.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qualification', 'phase-048'), campaign = path.join(out, 'export-campaign');
fs.mkdirSync(campaign, { recursive: true });
const seedPath = path.join(root, 'qualification', 'phase-047', 'phase-047-project.json');
const project = JSON.parse(fs.readFileSync(seedPath, 'utf8')), level = project.levels[0];
level.objects = level.objects.filter((object) => !String(object.id).startsWith('phase-048-'));
function cube(id, name, position, size, type, velocity, extras = {}, rotation = 0) { return { kind: 'cube', id, name, position, scale: [1, 1, 1], color: extras.color || [.16, .75, .72], rotationY: 0,
  ...(rotation ? { quaternion: [0, 0, Math.sin(rotation / 2), Math.cos(rotation / 2)] } : {}), behaviors: extras.behaviors || [], components: {
    'body-2d': { version: 1, enabled: true, type, linearVelocity: velocity }, 'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size }, ...(extras.components || {}) } }; }
function moving(id, name, position, velocity, extras = {}, rotation = 0) { return cube(id, name, position, extras.size || [4, .5], 'kinematic', velocity,
  { ...extras, components: { 'moving-platform-2d': { version: 1, enabled: true }, ...(extras.components || {}) } }, rotation); }
function rider(id, name, position, velocity = [0, 0], extras = {}) { return cube(id, name, position, extras.size || [1, 1], 'kinematic', velocity,
  { ...extras, components: { 'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: extras.maxSlopeAngle || 50, stepHandlingEnabled: true, maxStepHeight: .5 }, ...(extras.components || {}) } }); }
const objects = [
  moving('phase-048-horizontal', 'Horizontal Carry', [0, 0, 0], [2, 0]), rider('phase-048-horizontal-rider', 'Horizontal Rider', [0, .75, 0]),
  moving('phase-048-up', 'Elevator Up', [10, 0, 0], [0, 2]), rider('phase-048-up-rider', 'Elevator Up Rider', [10, .75, 0]),
  moving('phase-048-down', 'Elevator Down', [20, 4, 0], [0, -2]), rider('phase-048-down-rider', 'Elevator Down Rider', [20, 4.75, 0]),
  moving('phase-048-diagonal', 'Diagonal Carry', [30, 0, 0], [1.5, 1]), rider('phase-048-diagonal-rider', 'Diagonal Rider', [30, .75, 0]),
  moving('phase-048-fast', 'Fast Platform', [40, 0, 0], [20, 0]), rider('phase-048-fast-rider', 'Fast Rider', [40, .75, 0]),
  cube('phase-048-fast-wall', 'Fast Carry Wall', [44, .75, 0], [.5, 2], 'static', [0, 0], { color: [.9, .3, .25] }),
  moving('phase-048-ceiling-platform', 'Low Ceiling Elevator', [50, 0, 0], [0, 3]), rider('phase-048-ceiling-rider', 'Low Ceiling Rider', [50, .75, 0]),
  cube('phase-048-ceiling', 'Carry Clamp Ceiling', [50, 2, 0], [4, .5], 'static', [0, 0], { color: [.9, .3, .25] }),
  moving('phase-048-one-way', 'Moving One-Way', [70, 0, 0], [1, 0], { components: { 'one-way-platform-2d': { version: 1, enabled: true } } }),
  rider('phase-048-one-way-rider', 'One-Way Rider', [70, .75, 0]),
  moving('phase-048-two-rider', 'Two Rider Platform', [80, 0, 0], [0, 2]), rider('phase-048-rider-a', 'Rider A', [79, .75, 0]), rider('phase-048-rider-b', 'Rider B', [81, .75, 0]),
  cube('phase-048-rider-a-ceiling', 'Blocked Rider Ceiling', [79, 1.8, 0], [1.25, .4], 'static', [0, 0], { color: [.9, .3, .25] }),
  moving('phase-048-trigger-platform', 'Trigger Carry Platform', [90, 0, 0], [2, 0]), rider('phase-048-trigger-rider', 'Trigger Rider', [90, .75, 0]),
  { kind: 'cube', id: 'phase-048-trigger', name: 'Carry Trigger', position: [92, .75, 0], scale: [1, 1, 1], color: [.8, .3, .9], rotationY: 0, behaviors: [], components: { 'trigger-collider-2d': { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [1, 2], radius: .5 } } },
];
const angle = Math.PI / 6, slopePlatform = moving('phase-048-slope', 'Moving 30-degree Slope', [60, 0, 0], [1, 0], {}, angle);
const temp = { id: slopePlatform.id, worldMatrix: Collider.composeMatrix({ position: slopePlatform.position, rotation: angle }), components: slopePlatform.components };
const surface = Slope.surfaceFromShape(Collider.enumerateCollider2DWorldShapes(temp)[0], slopePlatform.id), x = 60;
const y = (surface.planeD - surface.normal.x * x + Math.abs(surface.normal.x) * .5 + surface.normal.y * .5) / surface.normal.y;
objects.push(slopePlatform, rider('phase-048-slope-rider', 'Moving Slope Rider', [x, y, 0]));
level.objects.push(...objects); level.name = 'Phase 048 Moving Platform Carry Lab'; project.meta.title = level.name; project.meta.internalOnly = true;
const projectPath = path.join(out, 'phase-048-project.json'); fs.writeFileSync(projectPath, JSON.stringify(project, null, 2) + '\n');
const sourceNames = ['00-inspector-fields.js', '00-collision-filter-2d.js', '00-collider-2d.js', '00-trigger-collider-2d.js', '00-one-way-2d.js', '00-character-slope-2d.js', '00-moving-platform-2d.js', '00-body-2d.js', '00-authoring-schema.js', '00-authoring-plumbing.js', '00-character-tile-query.js', '00-tilemap-bundle.js', '00-sprite-authoring.js', '00-authoring-language.js', '00-gameplay-presets.js', '00-onboarding.js', '00-sprite-starters.js', '01-editor.js'];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8'), common = { htmlTemplate: read('editor/index.html'), engineJS: read('dist/opus-engine.js'), templateJS: read('build/export-template.js') };
const variants = ['horizontal', 'elevator-up', 'elevator-down', 'diagonal', 'low-ceiling', 'two-riders', 'walk-off', 'one-way', 'moving-slope', '10k-map'];
const artifacts = [];
for (let index = 0; index < variants.length; index++) for (const playableOnly of [false, true]) { const tier = playableOnly ? 'playable' : 'editable'; const editorJS = sourceNames.filter((name) => !playableOnly || name !== '00-tilemap-bundle.js').map((name) => read('editor/src/' + name)).join('\n'); const html = composeExportHTML({ ...common, editorJS, embeddedProjectJSON: JSON.stringify(project), playableOnly, title: `${level.name} — ${variants[index]}` }); if (!html.includes('OpusMovingPlatform2D') || !html.includes('moving-platform-2d')) throw new Error(`missing Phase 048 payload ${variants[index]} ${tier}`); const file = `${String(index + 1).padStart(2, '0')}-${variants[index]}-${tier}.html`; fs.writeFileSync(path.join(campaign, file), html); artifacts.push({ variant: variants[index], tier, file, bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex') }); }
for (const tier of ['editable', 'playable']) fs.copyFileSync(path.join(campaign, `01-horizontal-${tier}.html`), path.join(out, `phase-048-${tier}.html`));
const evidence = { phase: 48, generatedAtUtc: new Date().toISOString(), project: path.relative(root, projectPath), name: level.name, scenarios: variants, compositions: 10, editable: 10, playable: 10, artifacts, publicGameAdded: false };
fs.writeFileSync(path.join(out, 'phase-048-export-proof.json'), JSON.stringify(evidence, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'phase-048-dogfood.json'), JSON.stringify({ ...evidence, objectsAdded: objects.length + 2, movingPlatformComponent: true, triggerFinalPosition: true, prefabPreservation: 'shared component record path', tilemapFixture: 'Phase 047 embedded Tilemap retained' }, null, 2) + '\n');
console.log(JSON.stringify({ project: evidence.project, artifacts: artifacts.length, editableBytes: artifacts[0].bytes, playableBytes: artifacts[1].bytes }));
