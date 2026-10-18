'use strict';
// Reuses the qualified Phase 046 project as a non-destructive seed and creates
// isolated Phase 047 Editable/Playable browser artifacts.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Collider = require('../editor/src/00-collider-2d.js');
const Slope = require('../editor/src/00-character-slope-2d.js');
const { composeExportHTML } = require('../build/export-template.js');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'qualification', 'phase-047');
const project = JSON.parse(fs.readFileSync(path.join(root, 'qualification', 'phase-046', 'phase-046-project.json'), 'utf8'));
const level = project.levels[0];
const angle = Math.PI / 6;
function staticBox(id, name, position, size, rotation = 0, extras = {}) {
  return { kind: 'cube', id, name, position, scale: [1, 1, 1], color: [.86, .51, .24], rotationY: 0,
    ...(rotation ? { quaternion: [0, 0, Math.sin(rotation / 2), Math.cos(rotation / 2)] } : {}), behaviors: [],
    components: { 'body-2d': { version: 1, enabled: true, type: 'static', linearVelocity: [0, 0] },
      'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size }, ...extras } };
}
function character(id, name, position, velocity) {
  return { kind: 'cube', id, name, position, scale: [1, 1, 1], color: [.14, .8, .76], rotationY: 0, behaviors: [],
    components: { 'body-2d': { version: 1, enabled: true, type: 'kinematic', linearVelocity: velocity },
      'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [1, 1] },
      'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3,
        slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 } } };
}
const ramp = staticBox('phase-047-ramp', 'Walkable 30-degree Static Ramp', [0, 0, 0], [4, 1], angle);
const rampShape = Collider.enumerateCollider2DWorldShapes({ worldMatrix: Collider.composeMatrix({ position: [0, 0, 0], rotation: angle }), components: ramp.components })[0];
const surface = Slope.surfaceFromShape(rampShape, ramp.id);
const x = -1;
const y = (surface.planeD - surface.normal.x * x + Math.abs(surface.normal.x) * .5 + surface.normal.y * .5) / surface.normal.y;
const mover = level.objects.find((object) => object.id === 'mover');
mover.name = 'Slope Character'; mover.position = [x, y, 0]; mover.components['body-2d'].linearVelocity = [1, 0];
mover.components['character-collision-2d'] = character('template', '', [], []).components['character-collision-2d'];
level.objects.push(ramp);
level.objects.push(staticBox('phase-047-flat', 'Flat to Ramp Transition', [-3, -1.655, 0], [2, 1]));
level.objects.push(staticBox('phase-047-step-floor', 'Step Course Floor', [20, -.5, 0], [8, 1]));
level.objects.push(staticBox('phase-047-step-ledge', 'Quarter-Unit Step', [21, .125, 0], [1, .25]));
level.objects.push(character('phase-047-step-character', 'Step Character', [20, .5, 0], [1, 0]));
const oneWay = staticBox('phase-047-one-way-ramp', 'Rotated One-Way Ramp', [-20, 0, 0], [4, 1], angle,
  { 'one-way-platform-2d': { version: 1, enabled: true } });
level.objects.push(oneWay);
level.objects.push(character('phase-047-one-way-character', 'One-Way Falling Character', [-20, 5, 0], [0, -8]));
const tileset = project.tilesets.find((asset) => asset.id === 'char-tiles');
tileset.version = 6;
tileset.tiles.push({ id: 'slope-up-right', name: 'Slope Up Right', spriteAssetRef: 'char-sprite', collision: { mode: 'slope', slope: 'up-right', oneWay: false } });
tileset.tiles.push({ id: 'slope-up-left-one-way', name: 'Slope Up Left One-Way', spriteAssetRef: 'char-sprite', collision: { mode: 'slope', slope: 'up-left', oneWay: true } });
const map = level.objects.find((object) => object.id === 'char-map');
map.layers[0].cells.push({ x: 5, y: 0, tileId: 'slope-up-right' }, { x: 6, y: 0, tileId: 'slope-up-left-one-way' });
// Support uses the Character's uphill corner. At x=5.25, that corner is
// x=5.75 and y=.75 on the finite up-right Tile top; center y=1.25.
level.objects.push(character('phase-047-tile-character', 'Tile Slope Character', [5.25, 1.25, 0], [.5, 0]));
level.name = 'Phase 047 Slopes and Steps Lab';
project.meta.title = level.name; project.meta.internalOnly = true;
const fixturePath = path.join(output, 'phase-047-project.json');
fs.writeFileSync(fixturePath, JSON.stringify(project, null, 2) + '\n');
const sources = ['00-inspector-fields.js', '00-collision-filter-2d.js', '00-collider-2d.js', '00-trigger-collider-2d.js', '00-one-way-2d.js',
  '00-character-slope-2d.js', '00-body-2d.js', '00-authoring-schema.js', '00-authoring-plumbing.js',
  '00-character-tile-query.js', '00-tilemap-bundle.js', '00-sprite-authoring.js', '00-authoring-language.js',
  '00-gameplay-presets.js', '00-onboarding.js', '00-sprite-starters.js', '01-editor.js'];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const options = { htmlTemplate: read('editor/index.html'), engineJS: read('dist/opus-engine.js'),
  templateJS: read('build/export-template.js'), embeddedProjectJSON: JSON.stringify(project), title: level.name };
const artifacts = [];
for (const playableOnly of [false, true]) {
  const tier = playableOnly ? 'playable' : 'editable';
  const editorJS = sources.filter((source) => !playableOnly || source !== '00-tilemap-bundle.js')
    .map((source) => read('editor/src/' + source)).join('\n');
  const html = composeExportHTML({ ...options, editorJS, playableOnly });
  const file = path.join(output, `phase-047-${tier}.html`);
  fs.writeFileSync(file, html);
  artifacts.push({ tier, path: path.relative(root, file), bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex'),
    slopeModule: html.includes('OpusCharacterSlope2D'), characterV2: html.includes('slopeHandlingEnabled'), tileSlope: html.includes('slope-up-right') });
}
console.log(JSON.stringify({ fixture: path.relative(root, fixturePath), tilesetVersion: tileset.version, artifacts }, null, 2));
