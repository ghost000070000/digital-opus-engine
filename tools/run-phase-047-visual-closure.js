'use strict';

// Phase 047 closure-only browser campaign. This script creates internal
// qualification artifacts and retained screenshots; it does not edit product
// source or start another endurance run.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const { composeExportHTML } = require('../build/export-template.js');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'qualification', 'phase-047', 'visual-closure');
const PORT = '8897';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 1440, height: 900 };
const EXPECTED_FINGERPRINT = process.argv.includes('--repaired')
  ? '3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6'
  : 'f2ba97b8834629ecbed284b11690a25999fe7c0efb9b243e932329591d49b7ff';
fs.mkdirSync(OUT, { recursive: true });

function productFingerprint() {
  const files = [
    ...fs.readdirSync(path.join(ROOT, 'editor', 'src')).filter((name) => name.endsWith('.js')).map((name) => `editor/src/${name}`),
    'editor/index.html', 'build/build-engine-site.js', 'build/build-games-site.js', 'build/build-games.js',
    'build/export-template.js', 'no-code-capabilities.json', 'authoring-friction.json',
  ].sort();
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(file); hash.update('\0'); hash.update(fs.readFileSync(path.join(ROOT, file))); hash.update('\0');
  }
  return hash.digest('hex');
}

function qz(degrees) {
  const radians = degrees * Math.PI / 180;
  return [0, 0, Math.sin(radians / 2), Math.cos(radians / 2)];
}
function staticBox(id, name, position, size, rotation = 0, color = [.88, .48, .18], extras = {}) {
  return { kind: 'cube', id, name, position, scale: [size[0], size[1], 1], color, rotationY: 0,
    ...(rotation ? { quaternion: qz(rotation) } : {}), behaviors: [],
    components: { 'body-2d': { version: 1, enabled: true, type: 'static', linearVelocity: [0, 0] },
      'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [1, 1] }, ...extras } };
}
function character(id, name, position, maxSlopeAngle = 50, maxStepHeight = .5, color = [.05, .9, .72]) {
  return { kind: 'cube', id, name, position, scale: [1, 1, 1], color, rotationY: 0, behaviors: [],
    components: { 'body-2d': { version: 1, enabled: true, type: 'kinematic', linearVelocity: [0, 0] },
      'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [.8, .8] },
      'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3,
        slopeHandlingEnabled: true, maxSlopeAngle, stepHandlingEnabled: true, maxStepHeight } } };
}
function camera() {
  return { kind: 'camera', id: 'closure-camera', name: 'Phase 047 Closure Camera', isActiveCamera: true,
    options: { version: 2, position: [0, 0, 20], mode: 'fixed', projection: 'orthographic', fovDegrees: 45,
      orthographicHeight: 8, near: .1, far: 100, rotationDegrees: { x: 0, y: 0, z: 0 },
      chase: { distance: 8, height: 3, pitch: .2, lerpSpeed: 6, rotationLerpSpeed: 8, lookAhead: .5 }, lookAtTargetId: null } };
}

function buildProject() {
  const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'qualification', 'phase-047', 'phase-047-project.json'), 'utf8'));
  const level = project.levels[0];
  const tileset = project.tilesets.find((entry) => entry.id === 'char-tiles');
  tileset.version = 6;
  const ensureTile = (tile) => { const at = tileset.tiles.findIndex((entry) => entry.id === tile.id); if (at >= 0) tileset.tiles[at] = tile; else tileset.tiles.push(tile); };
  ensureTile({ id: 'closure-slope-right', name: 'Closure Slope Up Right', spriteAssetRef: 'char-sprite', collision: { mode: 'slope', slope: 'up-right', oneWay: false } });
  ensureTile({ id: 'closure-one-way-right', name: 'Closure One-Way Slope', spriteAssetRef: 'char-sprite', collision: { mode: 'slope', slope: 'up-right', oneWay: true } });

  const objects = [camera()];
  // A: flat approach (top -1.067) into a 30-degree walkable ramp.
  objects.push(staticBox('uphill-floor', 'Uphill Flat Floor', [-5.35, -1.567, 0], [5, 1]));
  objects.push(staticBox('uphill-ramp', 'Walkable 30 Degree Ramp', [0, 0, 0], [6, 1], 30, [.96, .57, .18]));
  objects.push(character('uphill-character', 'Uphill Character', [-4.8, -.667, 0], 50, .5));

  // B: actual Tilemap cells, with a flat approach at y=-1 and an up-right slope at (0,0).
  objects.push({ kind: 'tilemap', version: 5, id: 'closure-tile-map', name: 'Closure Tile Slope Map', position: [20, 0, 0],
    scale: [1, 1, 1], rotationY: 0, tilesetRef: tileset.id, sortingLayerRef: 'sprite-layer-default', orderInLayer: 0, spawnMarkers: [],
    layers: [{ id: 'closure-tile-layer', name: 'Visible Collision', visible: true, locked: false, collisionEnabled: true,
      cells: [{ x: 0, y: 0, tileId: 'closure-slope-right' }] }] });
  objects.push(staticBox('tile-approach-floor', 'Tile Slope Flat Approach', [18, -.5, 0], [4, 1], 0, [.18, .5, .82]));
  objects.push(character('tile-character', 'Tile Slope Character', [17.5, .4, 0], 50, .5, [.12, .72, 1]));

  // C: one-way up-right slope Tile; the Character starts below it.
  objects.push({ kind: 'tilemap', version: 5, id: 'closure-one-way-map', name: 'Closure One-Way Tile Map', position: [40, 0, 0],
    scale: [1, 1, 1], rotationY: 0, tilesetRef: tileset.id, sortingLayerRef: 'sprite-layer-default', orderInLayer: 0, spawnMarkers: [],
    layers: [{ id: 'closure-one-way-layer', name: 'One-Way Slope', visible: true, locked: false, collisionEnabled: true,
      cells: [{ x: 0, y: 0, tileId: 'closure-one-way-right' }] }] });
  objects.push(character('one-way-character', 'One-Way Slope Character', [40.5, -1.4, 0], 50, .5, [.82, .35, 1]));

  // D: four visible quarter-unit steps, a flat approach, and a top landing.
  objects.push(staticBox('stairs-floor', 'Stair Approach', [58, -.5, 0], [4, 1], 0, [.3, .58, .92]));
  for (let index = 0; index < 4; index++) {
    const height = (index + 1) * .25;
    objects.push(staticBox(`stair-${index + 1}`, `Step ${index + 1}`, [60.5 + index, height / 2, 0], [1, height], 0, [.3 + index * .08, .58, .92]));
  }
  objects.push(staticBox('stairs-top', 'Stair Top', [65, .5, 0], [2, 1], 0, [.62, .72, .95]));
  objects.push(character('stairs-character', 'Stair Character', [58.2, .4, 0], 50, .26, [1, .82, .15]));

  // E: the same 30-degree geometry, rejected by a 20-degree Character limit.
  objects.push(staticBox('steep-floor', 'Too-Steep Approach', [74.65, -1.567, 0], [5, 1], 0, [.86, .31, .25]));
  objects.push(staticBox('too-steep-ramp', 'Rejected 30 Degree Ramp', [80, 0, 0], [6, 1], 30, [.92, .22, .18]));
  objects.push(character('too-steep-character', 'Too-Steep Character', [75.2, -.667, 0], 20, .5, [1, .9, .2]));

  level.objects = objects;
  level.name = 'Phase 047 Visual Acceptance Closure';
  project.levels = [level]; project.currentLevelIndex = 0; project.startLevelIndex = 0;
  project.meta.title = level.name;
  project.meta.internalOnly = true;
  return project;
}

function buildArtifacts(project) {
  const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const sources = ['00-inspector-fields.js', '00-collision-filter-2d.js', '00-collider-2d.js', '00-trigger-collider-2d.js', '00-one-way-2d.js',
    '00-character-slope-2d.js', '00-body-2d.js', '00-authoring-schema.js', '00-authoring-plumbing.js',
    '00-character-tile-query.js', '00-tilemap-bundle.js', '00-sprite-authoring.js', '00-authoring-language.js',
    '00-gameplay-presets.js', '00-onboarding.js', '00-sprite-starters.js', '01-editor.js'];
  const options = { htmlTemplate: read('editor/index.html'), engineJS: read('dist/opus-engine.js'),
    templateJS: read('build/export-template.js'), embeddedProjectJSON: JSON.stringify(project), title: project.meta.title };
  const artifacts = {};
  for (const playableOnly of [false, true]) {
    const tier = playableOnly ? 'Playable' : 'Editable';
    const editorJS = sources.filter((source) => !playableOnly || source !== '00-tilemap-bundle.js').map((source) => read(`editor/src/${source}`)).join('\n');
    const html = composeExportHTML({ ...options, editorJS, playableOnly });
    const file = path.join(OUT, `phase-047-visual-${tier.toLowerCase()}.html`);
    fs.writeFileSync(file, html);
    artifacts[tier] = { path: path.relative(ROOT, file).replace(/\\/g, '/'), bytes: Buffer.byteLength(html),
      sha256: crypto.createHash('sha256').update(html).digest('hex') };
  }
  fs.writeFileSync(path.join(OUT, 'phase-047-visual-project.json'), JSON.stringify(project, null, 2) + '\n');
  return artifacts;
}

function waitForServer(server) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local server did not start')), 10000);
    server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
    server.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Local server exited ${code}`)); });
  });
}

function observer(page, name) {
  const errors = { page: [], console: [], externalRequests: [] };
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('request', (request) => { const url = request.url(); if (!url.startsWith(ORIGIN) && !url.startsWith('data:') && !url.startsWith('blob:')) errors.externalRequests.push(url); });
  return { name, errors };
}

async function bootPlayable(browser, centerX) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const observed = observer(page, `center-${centerX}`);
  await page.goto(`${ORIGIN}/qualification/phase-047/visual-closure/phase-047-visual-playable.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof getCharacterCollision2DState === 'function' && typeof placed !== 'undefined' && playMode === true);
  await page.evaluate((x) => {
    for (const item of placed) if (item.components && item.components['body-2d'] && item.components['body-2d'].type === 'kinematic') item.components['body-2d'].linearVelocity = [0, 0];
    if (player && player.entity) player.entity.visible = false;
    if (typeof playerVisualEntity !== 'undefined' && playerVisualEntity) playerVisualEntity.visible = false;
    app.camera.setProjection('orthographic'); app.camera.setOrthographicHeight(7);
    app.camera.setFixedOptions({ eye: new Opus.Vec3(x, 1, 20), target: new Opus.Vec3(x, 1, 0), up: new Opus.Vec3(0, 1, 0) }); app.camera.setMode('fixed');
  }, centerX);
  await page.waitForTimeout(150);
  return { context, page, observed };
}
async function snapshot(page, id) {
  return page.evaluate((objectId) => {
    const item = placed.find((entry) => entry.id === objectId);
    const state = getCharacterCollision2DState(objectId);
    return { position: [item.entity.position.x, item.entity.position.y, item.entity.position.z],
      velocity: [...item.components['body-2d'].linearVelocity], state: { ...state } };
  }, id);
}
async function velocity(page, id, value) {
  await page.evaluate(({ objectId, next }) => { placed.find((entry) => entry.id === objectId).components['body-2d'].linearVelocity = next; }, { objectId: id, next: value });
}
async function screenshot(page, filename) {
  const absolute = path.join(OUT, filename);
  await page.screenshot({ path: absolute, fullPage: false });
  return path.relative(ROOT, absolute).replace(/\\/g, '/');
}
async function runScenario(browser, spec) {
  const { context, page, observed } = await bootPlayable(browser, spec.centerX);
  try { return await spec.run(page, observed); } finally { await context.close(); }
}

async function authoringProof(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const observed = observer(page, 'exported-editor-authoring');
  await page.goto(`${ORIGIN}/qualification/phase-047/visual-closure/phase-047-visual-editable.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof placed !== 'undefined' && document.querySelector('[data-left-tab="assets"]'));
  if (!await page.locator('[data-left-tab="assets"]').isVisible()) await page.locator('#chrome-toggle-btn').click();
  await page.locator('[data-left-tab="assets"]').click();
  await page.locator('[data-open-tileset="char-tiles"]').click();
  await page.locator('[data-palette-tile="solid"]').click();
  await page.locator('[data-tile-duplicate]').click();
  await page.locator('[data-tile-detail-name]').fill('Closure Authored Slope');
  await page.locator('[data-tile-detail-name]').press('Tab');
  await page.locator('[data-tile-collision-mode]').selectOption('slope');
  await page.locator('[data-tile-collision-slope]').selectOption('up-left');
  await page.locator('[data-tile-collision-one-way]').check();
  const authored = await page.evaluate(() => {
    const set = tilesets.find((entry) => entry.id === 'char-tiles');
    const tile = set.tiles.find((entry) => entry.name === 'Closure Authored Slope');
    return tile && { id: tile.id, name: tile.name, collision: { ...tile.collision } };
  });
  const first = await screenshot(page, '03-exported-editor-tile-slope-authoring.png');
  await page.locator('#tile-palette-close').click();
  await page.locator('[data-right-tab="project"]').click();
  await page.locator('#project-name-input').fill('phase-047-visual-closure');
  await page.locator('#save-btn').click();
  const savedBeforeReload = await page.evaluate(() => {
    const saved = app.save.load('phase-047-visual-closure');
    return saved && (saved.tilesets || []).find((entry) => entry.id === 'char-tiles')?.tiles.map((tile) => ({ id: tile.id, name: tile.name, collision: tile.collision }));
  });
  await page.reload({ waitUntil: 'load' });
  if (!await page.locator('[data-right-tab="project"]').isVisible()) await page.locator('#chrome-toggle-btn').click();
  await page.locator('[data-right-tab="project"]').click();
  await page.locator('#project-list-select').selectOption('phase-047-visual-closure');
  await page.locator('#load-btn').click();
  const liveAfterReload = await page.evaluate(() => tilesets.find((entry) => entry.id === 'char-tiles')?.tiles.map((tile) => ({ id: tile.id, name: tile.name, collision: tile.collision })));
  console.log('authoring persistence diagnostic', JSON.stringify({ authored, savedBeforeReload, liveAfterReload }));
  if (!liveAfterReload || !liveAfterReload.some((tile) => tile.id === authored.id)) throw new Error(`Exported-editor saved slope Tile did not reload: ${JSON.stringify({ authored, savedBeforeReload, liveAfterReload })}`);
  await page.locator('[data-left-tab="assets"]').click();
  await page.locator('[data-open-tileset="char-tiles"]').click();
  await page.locator(`[data-palette-tile="${authored.id}"]`).click();
  const persisted = await page.evaluate(() => {
    const set = tilesets.find((entry) => entry.id === 'char-tiles');
    const tile = set.tiles.find((entry) => entry.name === 'Closure Authored Slope');
    return tile && { id: tile.id, name: tile.name, collision: { ...tile.collision } };
  });
  const final = await screenshot(page, '16-exported-editor-slope-authoring.png');
  await page.locator('#tile-palette-close').click();
  await page.locator('[data-right-tab="scene"]').click();
  await page.getByText('Too-Steep Character', { exact: true }).click();
  await page.locator('[data-right-tab="inspector"]').click();
  const slopeControl = page.getByText('Slope Handling Enabled', { exact: true }).first();
  await slopeControl.scrollIntoViewIfNeeded();
  const controls = await page.evaluate(() => ({
    slopeEnabled: document.querySelector('[aria-label="Slope Handling Enabled"],input[type="checkbox"]') ? true : true,
    inspectorText: document.getElementById('inspector-body').innerText,
  }));
  const characterShot = await screenshot(page, '15-too-steep-character-setting.png');
  await page.locator('#play-btn').click();
  await page.waitForFunction(() => playMode === true);
  const playBefore = await snapshot(page, 'uphill-character');
  await page.evaluate(() => {
    if (player && player.entity) player.entity.visible = false;
    if (typeof playerVisualEntity !== 'undefined' && playerVisualEntity) playerVisualEntity.visible = false;
    app.camera.setProjection('orthographic'); app.camera.setOrthographicHeight(7);
    app.camera.setFixedOptions({ eye: new Opus.Vec3(-1.5, 1, 20), target: new Opus.Vec3(-1.5, 1, 0), up: new Opus.Vec3(0, 1, 0) }); app.camera.setMode('fixed');
  });
  await velocity(page, 'uphill-character', [2.5, 0]);
  await page.waitForFunction(() => {
    const item = placed.find((entry) => entry.id === 'uphill-character');
    const state = getCharacterCollision2DState('uphill-character');
    return item.entity.position.x > -1 && item.entity.position.y > .6 && state.grounded && state.onSlope;
  }, null, { timeout: 10000 });
  await velocity(page, 'uphill-character', [0, 0]);
  await page.waitForTimeout(80);
  const playAfter = await snapshot(page, 'uphill-character');
  const playShot = await screenshot(page, '17-exported-editor-play.png');
  await context.close();
  const playTraversal = { startPosition: playBefore.position, endPosition: playAfter.position, runtimeStateAfter: playAfter.state,
    actualMovement: playAfter.position[0] > playBefore.position[0] + 1 && playAfter.position[1] > playBefore.position[1] + .3 && playAfter.state.grounded && playAfter.state.onSlope };
  return { result: authored && persisted && persisted.collision.mode === 'slope' && persisted.collision.slope === 'up-left' && persisted.collision.oneWay === true && playTraversal.actualMovement ? 'PASS' : 'FAIL',
    authored, persisted, controls: { slopeHandlingVisible: controls.inspectorText.includes('Slope Handling Enabled'), maxSlopeAngleVisible: controls.inspectorText.includes('Max Slope Angle'),
      stepHandlingVisible: controls.inspectorText.includes('Step Handling Enabled'), maxStepHeightVisible: controls.inspectorText.includes('Max Step Height') },
    playTraversal, screenshots: [first, final, characterShot, playShot], errors: observed.errors };
}

async function main() {
  const startedAtUtc = new Date().toISOString();
  const startFingerprint = productFingerprint();
  const project = buildProject();
  const artifacts = buildArtifacts(project);
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, PORT], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await waitForServer(server);
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const browserVersion = await browser.version();
  const scenarios = {};
  try {
    scenarios.uphill = await runScenario(browser, { centerX: -1.5, run: async (page, observed) => {
      const before = await snapshot(page, 'uphill-character');
      const shots = [await screenshot(page, '01-uphill-before.png')];
      await velocity(page, 'uphill-character', [2.5, 0]);
      await page.waitForFunction(() => {
        const item = placed.find((entry) => entry.id === 'uphill-character');
        const state = getCharacterCollision2DState('uphill-character');
        return item.entity.position.x > -1 && item.entity.position.y > .6 && state.grounded && state.onSlope;
      }, null, { timeout: 10000 });
      const uphillMotionCheck = await snapshot(page, 'uphill-character');
      if (uphillMotionCheck.position[0] <= before.position[0] + .2) throw new Error(`Uphill Character did not move: ${JSON.stringify({ before, uphillMotionCheck })}`);
      shots.push(await screenshot(page, '01b-uphill-mid.png'));
      await velocity(page, 'uphill-character', [0, 0]); await page.waitForTimeout(80);
      const after = await snapshot(page, 'uphill-character'); shots.push(await screenshot(page, '02-uphill-after.png'));
      console.log('uphill diagnostic', JSON.stringify({ before, after }));
      return { name: 'uphill traversal', artifactType: 'Playable', startPosition: before.position, endPosition: after.position,
        requestedMovement: { velocity: [2.5, 0], direction: 'right' }, characterConfiguration: { maxSlopeAngle: 50, maxStepHeight: .5 },
        obstacleSupportIdentity: 'uphill-ramp', runtimeStateBefore: before.state, runtimeStateAfter: after.state, screenshots: shots,
        result: after.position[1] > before.position[1] + .3 && after.state.grounded && after.state.onSlope ? 'PASS' : 'FAIL', notes: 'Actual Body 2D velocity drove the Character from flat ground onto a 30-degree scene ramp.', errors: observed.errors };
    } });

    scenarios.tileSlope = await runScenario(browser, { centerX: 19.3, run: async (page, observed) => {
      const before = await snapshot(page, 'tile-character'); const shots = [await screenshot(page, '04-tile-slope-before.png')];
      await velocity(page, 'tile-character', [2, 0]);
      await page.waitForFunction(() => {
        const item = placed.find((entry) => entry.id === 'tile-character');
        const state = getCharacterCollision2DState('tile-character');
        return item.entity.position.x > 20.5 && item.entity.position.y > 1.1 && state.grounded && state.onSlope;
      }, null, { timeout: 10000 });
      await velocity(page, 'tile-character', [0, 0]); await page.waitForTimeout(80);
      const after = await snapshot(page, 'tile-character'); shots.push(await screenshot(page, '05-tile-slope-after.png'));
      console.log('tile diagnostic', JSON.stringify({ before, after }));
      return { name: 'Tile slope traversal', artifactType: 'Playable', startPosition: before.position, endPosition: after.position,
        requestedMovement: { velocity: [2, 0], direction: 'right' }, characterConfiguration: { maxSlopeAngle: 50, maxStepHeight: .5 },
        tile: { coordinate: [0, 0], tileId: 'closure-slope-right', slopeDirection: 'up-right' }, obstacleSupportIdentity: after.state.groundSupportId,
        runtimeStateBefore: before.state, runtimeStateAfter: after.state, screenshots: shots,
        result: after.position[1] > before.position[1] + .2 && after.state.grounded && after.state.onSlope && String(after.state.groundSupportId).startsWith('tile:closure-tile-map:closure-tile-layer:0:0') ? 'PASS' : 'FAIL',
        notes: 'Actual Tilemap data supplied the walkable triangle; no scene Box substituted.', errors: observed.errors };
    } });

    scenarios.oneWaySlope = await runScenario(browser, { centerX: 40.5, run: async (page, observed) => {
      const before = await snapshot(page, 'one-way-character'); const shots = [await screenshot(page, '06-one-way-slope-below.png')];
      await velocity(page, 'one-way-character', [0, 4]);
      await page.waitForFunction(() => placed.find((entry) => entry.id === 'one-way-character').entity.position.y > 2, null, { timeout: 10000 });
      await velocity(page, 'one-way-character', [0, 0]); await page.waitForTimeout(80);
      const passed = await snapshot(page, 'one-way-character'); shots.push(await screenshot(page, '07-one-way-slope-passed-up.png'));
      await velocity(page, 'one-way-character', [0, -4]);
      await page.waitForFunction(() => getCharacterCollision2DState('one-way-character').grounded, null, { timeout: 10000 });
      await velocity(page, 'one-way-character', [0, 0]); await page.waitForTimeout(80);
      const landed = await snapshot(page, 'one-way-character'); shots.push(await screenshot(page, '08-one-way-slope-landed.png'));
      console.log('one-way diagnostic', JSON.stringify({ before, passed, landed }));
      const passedCleanly = passed.position[1] > .9 && !passed.state.ceiling && !passed.state.wallLeft && !passed.state.wallRight;
      const landedCleanly = landed.state.grounded && landed.state.onSlope && !landed.state.wallLeft && !landed.state.wallRight;
      return { name: 'one-way slope pass and land', artifactType: 'Playable', startPosition: before.position, endPosition: landed.position,
        requestedMovement: { upwardVelocity: [0, 4], downwardVelocity: [0, -4] }, characterConfiguration: { maxSlopeAngle: 50 },
        tile: { coordinate: [0, 0], tileId: 'closure-one-way-right', slopeDirection: 'up-right', oneWay: true }, obstacleSupportIdentity: landed.state.groundSupportId,
        runtimeStateBefore: before.state, runtimeStateAfterUpwardPass: passed.state, positionAfterUpwardPass: passed.position, runtimeStateAfter: landed.state,
        screenshots: shots, result: passedCleanly && landedCleanly ? 'PASS' : 'FAIL', notes: 'The same one-way slope Tile was crossed upward and then caught downward movement.', errors: observed.errors };
    } });

    scenarios.stairs = await runScenario(browser, { centerX: 61.5, run: async (page, observed) => {
      const before = await snapshot(page, 'stairs-character'); const shots = [await screenshot(page, '09-stairs-before.png')];
      await velocity(page, 'stairs-character', [2, 0]);
      await page.waitForFunction(() => {
        const entry = placed.find((candidate) => candidate.id === 'stairs-character');
        return entry && entry.entity.position.x > 61.4 && entry.entity.position.y > .6;
      });
      const midpoint = await snapshot(page, 'stairs-character'); shots.push(await screenshot(page, '10-stairs-mid.png'));
      await page.waitForFunction(() => placed.find((entry) => entry.id === 'stairs-character').entity.position.x > 64.4);
      await velocity(page, 'stairs-character', [0, 0]); await page.waitForTimeout(80);
      const after = await snapshot(page, 'stairs-character'); shots.push(await screenshot(page, '11-stairs-after.png'));
      await velocity(page, 'stairs-character', [-2, 0]);
      await page.waitForFunction(() => placed.find((entry) => entry.id === 'stairs-character').entity.position.x < 59.2);
      await velocity(page, 'stairs-character', [0, 0]); await page.waitForTimeout(80);
      const descended = await snapshot(page, 'stairs-character'); shots.push(await screenshot(page, '12-stairs-descended.png'));
      console.log('stairs diagnostic', JSON.stringify({ before, midpoint, after, descended }));
      return { name: 'bounded stair traversal', artifactType: 'Playable', startPosition: before.position, midpointPosition: midpoint.position,
        endPosition: after.position, descendedPosition: descended.position, requestedMovement: { ascentVelocity: [2, 0], descentVelocity: [-2, 0] },
        characterConfiguration: { maxStepHeight: .26, stepHandlingEnabled: true }, obstacleSupportIdentity: after.state.groundSupportId,
        runtimeStateBefore: before.state, runtimeStateMidpoint: midpoint.state, runtimeStateAfter: after.state, runtimeStateAfterDescent: descended.state,
        successfulStepUpEvents: null, blockedEvents: null, falseAirborneObserved: !midpoint.state.grounded || !after.state.grounded,
        screenshots: shots, result: midpoint.position[1] > before.position[1] + .2 && after.position[1] > before.position[1] + .8 && midpoint.state.grounded && after.state.grounded && descended.state.grounded ? 'PASS' : 'FAIL',
        notes: 'Four sequential 0.25-unit steps were crossed by ordinary requested horizontal Body velocity; event counts are not instrumented.', errors: observed.errors };
    } });

    scenarios.tooSteep = await runScenario(browser, { centerX: 78.5, run: async (page, observed) => {
      const before = await snapshot(page, 'too-steep-character'); const shots = [await screenshot(page, '13-too-steep-before.png')];
      await velocity(page, 'too-steep-character', [2.5, 0]); await page.waitForTimeout(1800);
      await velocity(page, 'too-steep-character', [0, 0]); await page.waitForTimeout(80);
      const after = await snapshot(page, 'too-steep-character'); shots.push(await screenshot(page, '14-too-steep-blocked.png'));
      console.log('too-steep diagnostic', JSON.stringify({ before, after }));
      const climbed = after.position[1] - before.position[1];
      return { name: 'too-steep wall rejection', artifactType: 'Playable', startPosition: before.position, endPosition: after.position,
        requestedMovement: { velocity: [2.5, 0], durationMs: 1800 }, characterConfiguration: { maxSlopeAngle: 20, maxStepHeight: .5 },
        obstacleSupportIdentity: 'too-steep-ramp', obstacleAngle: 30, runtimeStateBefore: before.state, runtimeStateAfter: after.state,
        screenshots: shots, result: climbed < .05 && !after.state.onSlope && (after.state.wallRight || after.state.wallLeft) ? 'PASS' : 'FAIL',
        notes: 'A 20-degree Character requested motion into a 30-degree ramp and did not climb.', errors: observed.errors };
    } });

    const exportedEditor = await authoringProof(browser);
    const finalFingerprint = productFingerprint();
    const allErrors = [...Object.values(scenarios).flatMap((entry) => entry.errors.page.map((message) => ({ type: 'page', message }))),
      ...Object.values(scenarios).flatMap((entry) => entry.errors.console.map((message) => ({ type: 'console', message }))),
      ...exportedEditor.errors.page.map((message) => ({ type: 'page', message })), ...exportedEditor.errors.console.map((message) => ({ type: 'console', message }))];
    const external = [...Object.values(scenarios).flatMap((entry) => entry.errors.externalRequests), ...exportedEditor.errors.externalRequests];
    const scenarioPass = Object.values(scenarios).every((entry) => entry.result === 'PASS');
    const visualResult = scenarioPass && exportedEditor.result === 'PASS' && !allErrors.length && !external.length && finalFingerprint === startFingerprint ? 'PASS' : 'FAIL';
    const result = visualResult === 'PASS' && startFingerprint === EXPECTED_FINGERPRINT ? 'PASS' : visualResult === 'PASS' ? 'BLOCKED_SOURCE_CHANGED' : 'FAIL';
    const report = { runId: `phase-047-visual-closure-${startedAtUtc.replace(/[-:.]/g, '')}`, phase: 47, startedAtUtc,
      finishedAtUtc: new Date().toISOString(), sourceFingerprint: { expected: EXPECTED_FINGERPRINT, start: startFingerprint, final: finalFingerprint, unchanged: startFingerprint === finalFingerprint },
      artifacts, browserVersion, viewport: VIEWPORT, start: startedAtUtc, end: new Date().toISOString(), pageErrors: allErrors.filter((entry) => entry.type === 'page'),
      consoleErrors: allErrors.filter((entry) => entry.type === 'console'), externalRequests: [...new Set(external)], scenarios, exportedEditor, visualResult, result };
    fs.writeFileSync(path.join(OUT, 'phase-047-visual-acceptance.json'), JSON.stringify(report, null, 2) + '\n');

    const contactInputs = ['02-uphill-after.png', '05-tile-slope-after.png', '08-one-way-slope-landed.png', '11-stairs-after.png', '14-too-steep-blocked.png'];
    const width = 720, height = 450;
    const tiles = await Promise.all(contactInputs.map(async (file) => ({ input: await sharp(path.join(OUT, file)).resize(width, height, { fit: 'cover' }).png().toBuffer() })));
    await sharp({ create: { width: width * 2, height: height * 3, channels: 4, background: '#09111f' } })
      .composite(tiles.map((tile, index) => ({ input: tile.input, left: (index % 2) * width, top: Math.floor(index / 2) * height })))
      .png().toFile(path.join(OUT, 'contact-sheet.png'));
    console.log(JSON.stringify({ result, runId: report.runId, artifacts, browserVersion, viewport: VIEWPORT,
      scenarios: Object.fromEntries(Object.entries(scenarios).map(([key, value]) => [key, value.result])), exportedEditor: exportedEditor.result, visualResult,
      sourceFingerprint: report.sourceFingerprint, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length, externalRequests: report.externalRequests.length }, null, 2));
    if (result !== 'PASS') process.exitCode = 1;
  } finally {
    await browser.close(); server.kill();
  }
}

main().catch((error) => { console.error(error.stack || error); process.exit(1); });
