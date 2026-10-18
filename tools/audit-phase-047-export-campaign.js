'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { composeExportHTML } = require('../build/export-template.js');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'qualification', 'phase-047', 'export-campaign');
fs.mkdirSync(out, { recursive: true });
const base = JSON.parse(fs.readFileSync(path.join(root, 'qualification', 'phase-047', 'phase-047-project.json'), 'utf8'));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sourceNames = ['00-inspector-fields.js', '00-collision-filter-2d.js', '00-collider-2d.js', '00-trigger-collider-2d.js', '00-one-way-2d.js',
  '00-character-slope-2d.js', '00-body-2d.js', '00-authoring-schema.js', '00-authoring-plumbing.js', '00-character-tile-query.js',
  '00-tilemap-bundle.js', '00-sprite-authoring.js', '00-authoring-language.js', '00-gameplay-presets.js', '00-onboarding.js',
  '00-sprite-starters.js', '01-editor.js'];
const common = { htmlTemplate: read('editor/index.html'), engineJS: read('dist/opus-engine.js'), templateJS: read('build/export-template.js') };
const source = Object.fromEntries(sourceNames.map((name) => [name, read('editor/src/' + name)]));
const variants = [
  ['baseline', () => {}],
  ['scene-slope', (p) => { p.levels[0].objects = p.levels[0].objects.filter((o) => o.kind !== 'tilemap'); }],
  ['tile-slope', (p) => { p.levels[0].objects = p.levels[0].objects.filter((o) => o.id !== 'phase-047-ramp'); }],
  ['one-way-scene', (p) => { p.levels[0].objects = p.levels[0].objects.filter((o) => o.id.startsWith('phase-047-one-way')); }],
  ['one-way-tile', (p) => { p.tilesets[0].tiles[3].collision.oneWay = true; }],
  ['step-course', (p) => { p.levels[0].objects = p.levels[0].objects.filter((o) => o.id.startsWith('phase-047-step')); }],
  ['legacy-opt-out', (p) => { for (const o of p.levels[0].objects) if (o.components?.['character-collision-2d']) { o.components['character-collision-2d'].slopeHandlingEnabled = false; o.components['character-collision-2d'].stepHandlingEnabled = false; } }],
  ['steep-limit', (p) => { for (const o of p.levels[0].objects) if (o.components?.['character-collision-2d']) o.components['character-collision-2d'].maxSlopeAngle = 30; }],
  ['non-square-cells', (p) => { p.tilesets[0].cellSize = { width: 2, height: 1 }; }],
  ['hidden-collision', (p) => { const map = p.levels[0].objects.find((o) => o.kind === 'tilemap'); map.layers[0].visible = false; map.layers[0].collisionEnabled = true; }],
];
const results = [];
for (let i = 0; i < variants.length; i++) {
  const [name, mutate] = variants[i];
  const project = structuredClone(base); mutate(project);
  project.meta.title = `Phase 047 ${name}`; project.levels[0].name = project.meta.title;
  for (const playableOnly of [false, true]) {
    const tier = playableOnly ? 'playable' : 'editable';
    const editorJS = sourceNames.filter((item) => !playableOnly || item !== '00-tilemap-bundle.js').map((item) => source[item]).join('\n');
    const html = composeExportHTML({ ...common, editorJS, embeddedProjectJSON: JSON.stringify(project), playableOnly, title: project.meta.title });
    if (!html.includes('OpusCharacterSlope2D') || !html.includes('slopeHandlingEnabled') || !html.includes(project.meta.title)) throw new Error(`Missing Phase 047 payload: ${name} ${tier}`);
    const file = `${String(i + 1).padStart(2, '0')}-${name}-${tier}.html`;
    fs.writeFileSync(path.join(out, file), html);
    results.push({ name, tier, file, bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex') });
  }
}
const proof = { phase: 47, generatedAtUtc: new Date().toISOString(), compositions: variants.length, artifacts: results.length, browserBoots: 0, results };
fs.writeFileSync(path.join(root, 'qualification', 'phase-047', 'export-campaign.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ compositions: variants.length, artifacts: results.length, totalBytes: results.reduce((n, item) => n + item.bytes, 0) }));
