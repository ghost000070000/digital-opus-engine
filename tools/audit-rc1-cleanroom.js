'use strict';

// Clean-room acceptance sanity for the exact extracted RC archive. Gameplay
// state is observed only; the one authorized creator edit is made through UI.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'release', 'rc1');
const BASE = process.argv[2] || 'http://127.0.0.1:8851';
const EXPORT_DIR = path.join(OUT, 'creator-journey');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const pos = value => value && ({ x: value.x, y: value.y, z: value.z });
const distXZ = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
async function hold(page, keys, milliseconds) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  for (const key of [...list].reverse()) await page.keyboard.up(key);
}
function observe(page) {
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (/^https?:/i.test(url) && !url.startsWith(BASE)) externalRequests.push(url);
  });
  return { errors, externalRequests };
}
async function openStarted(browser, id) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const observation = observe(page);
  await page.goto(`${BASE}/games/${id}.html`, { waitUntil: 'load', timeout: 60000 });
  const button = page.locator('#start-overlay-btn');
  if (await button.isVisible()) await button.click();
  await page.waitForTimeout(1200);
  return { context, page, ...observation };
}
async function runtime(page) {
  return page.evaluate(() => {
    const entity = player?.entity;
    const velocity = player?.controllerType === 'hovercraft' ? craftVelocity :
      player?.controllerType === 'thirdperson' ? thirdPersonVelocity : firstPersonVelocity;
    const basis = app.camera.getBasis();
    return {
      position: posValue(entity?.position), velocity: posValue(velocity), rotationY: entity?.rotationY,
      yaw: typeof fpYaw === 'number' ? fpYaw : null, pitch: typeof fpPitch === 'number' ? fpPitch : null,
      grounded: player?.controllerType === 'thirdperson' ? thirdPersonGrounded : player?.controllerType === 'firstperson' ? firstPersonGrounded : true,
      paused: app.paused, pointerLocked: document.pointerLockElement === document.getElementById('game'),
      basis: { forward: posValue(basis.forward), right: posValue(basis.right) },
      settings: { sensitivity: app.settings.get('mouseSensitivity'), invertMouseY: app.settings.get('invertMouseY') },
    };
    function posValue(v) { return v && { x: v.x, y: v.y, z: v.z }; }
  });
}

async function coreRoutes(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const observed = observe(page);
  const routes = [];
  for (const route of ['/', '/editor/', '/games/', '/editor/?game=forest-range']) {
    const response = await page.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(route.includes('?game=') ? 1500 : 300);
    routes.push({ route, status: response?.status(), title: await page.title(), body: (await page.locator('body').innerText()).slice(0, 500) });
  }
  const catalog = await (await context.request.get(`${BASE}/games/catalog.json`)).json();
  const result = {
    routes, catalogCount: catalog.games.length,
    forestDeepLinkLoaded: await page.evaluate(() => projectMeta?.title === 'Forest Range' || currentUiConfig?.startScreen?.title === 'Forest Range'),
    ...observed,
  };
  result.pass = routes.every(route => route.status === 200) && result.catalogCount === 28 && result.forestDeepLinkLoaded && !result.errors.length && !result.externalRequests.length;
  await context.close();
  return result;
}

async function featured(browser) {
  const games = [
    ['forest-range', 'Forest Range'], ['arsenal-run', 'Arsenal Run'],
    ['power-grid', 'Power Grid'], ['moving-temple', 'Moving Temple'],
  ];
  const results = [];
  for (const [id, title] of games) {
    const { context, page, errors, externalRequests } = await openStarted(browser, id);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    const actual = await page.evaluate(() => ({ paused: app.paused, startTitle: currentUiConfig.startScreen.title, browserTitle: document.title }));
    results.push({ id, expectedTitle: title, ...actual, errors, externalRequests,
      pass: actual.paused && actual.startTitle === title && actual.browserTitle.includes(title) && !errors.length && !externalRequests.length });
    await context.close();
  }
  return { results, pass: results.every(result => result.pass) };
}

async function arsenal(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(`${BASE}/games/arsenal-run.html`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  const defaults = await page.evaluate(() => ({ sensitivity: Number(document.getElementById('mainmenu-mouse-sensitivity').value), invert: document.getElementById('mainmenu-invert-mouse-y').checked }));
  await page.locator('#start-overlay-btn').click();
  await page.waitForTimeout(1000);
  const wallBefore = await runtime(page);
  await hold(page, 'w', 1200);
  const wall = await runtime(page);
  await hold(page, 's', 600);
  const away = await runtime(page);
  await page.locator('#game').click({ position: { x: 640, y: 360 } });
  await page.waitForFunction(() => document.pointerLockElement === document.getElementById('game'));
  const initial = await runtime(page);
  await page.mouse.move(700, 360); const right = await runtime(page);
  await page.mouse.move(580, 360); const left = await runtime(page);
  await page.mouse.move(580, 300); const up = await runtime(page);
  await page.mouse.move(580, 420); const down = await runtime(page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const paused = await runtime(page);
  await page.locator('#pause-mouse-sensitivity').fill('0.0019');
  await page.locator('#pause-invert-mouse-y').check();
  await page.getByRole('button', { name: /Resume/ }).click();
  await page.locator('#game').click({ position: { x: 640, y: 360 } });
  await page.waitForFunction(() => document.pointerLockElement === document.getElementById('game'));
  const inverted0 = await runtime(page);
  await page.mouse.move(640, 420);
  const inverted1 = await runtime(page);
  await page.reload({ waitUntil: 'load' });
  const persisted = await page.evaluate(() => ({ sensitivity: Number(document.getElementById('mainmenu-mouse-sensitivity').value), invert: document.getElementById('mainmenu-invert-mouse-y').checked }));
  // Restore defaults through the same player-facing controls for a clean handoff.
  await page.locator('#mainmenu-mouse-sensitivity').fill('0.0018');
  await page.locator('#mainmenu-invert-mouse-y').uncheck();
  const restored = await page.evaluate(() => ({ sensitivity: app.settings.get('mouseSensitivity'), invert: app.settings.get('invertMouseY') }));
  const result = {
    defaults, wallBefore, wall, away,
    look: { right: right.yaw - initial.yaw, left: left.yaw - right.yaw, up: up.pitch - left.pitch, down: down.pitch - up.pitch, invertedDown: inverted1.pitch - inverted0.pitch },
    pause: { paused: paused.paused, pointerReleased: !paused.pointerLocked }, persisted, restored, ...observed,
  };
  result.pass = defaults.sensitivity === 0.0018 && defaults.invert === false && wall.position.z <= 16.11 && away.position.z > wall.position.z + 0.3 &&
    result.look.right > 0 && result.look.left < 0 && result.look.up < 0 && result.look.down > 0 && result.look.invertedDown < 0 &&
    result.pause.paused && result.pause.pointerReleased && persisted.sensitivity === 0.0019 && persisted.invert === true &&
    restored.sensitivity === 0.0018 && restored.invert === false && !result.errors.length && !result.externalRequests.length;
  await context.close();
  return result;
}

async function forest(browser) {
  const { context, page, errors, externalRequests } = await openStarted(browser, 'forest-range');
  const before = await runtime(page);
  await hold(page, 'w', 1000);
  const after = await runtime(page);
  const delta = { x: after.position.x - before.position.x, z: after.position.z - before.position.z };
  const dot = delta.x * before.basis.forward.x + delta.z * before.basis.forward.z;
  const result = { before, after, distance: distXZ(before.position, after.position), forwardDot: dot, errors, externalRequests };
  result.pass = result.distance > 3 && dot > 1 && !errors.length && !externalRequests.length;
  await context.close();
  return result;
}

async function movingTemple(browser) {
  const { context, page, errors, externalRequests } = await openStarted(browser, 'moving-temple');
  await hold(page, ['w', 'Space'], 720);
  // The authored jump arc lands on the platform at roughly 1.1 seconds.
  // Sample only after landing so this measures passive carry, not the jump.
  await page.waitForTimeout(1200);
  const first = await page.evaluate(snapshot);
  await page.waitForTimeout(700);
  const second = await page.evaluate(snapshot);
  function delta(a, b) { return b - a; }
  const playerDelta = delta(first.player.x, second.player.x);
  const platformDelta = delta(first.platform.x, second.platform.x);
  const result = { first, second, playerDelta, platformDelta, errors, externalRequests };
  result.pass = platformDelta !== 0 && Math.abs(playerDelta - platformDelta) < 0.35 && first.grounded && second.grounded && !errors.length && !externalRequests.length;
  await context.close();
  return result;

  function snapshot() {
    const platform = placed.find(item => item.id === 'obj57');
    return { player: pos(player.entity.position), platform: pos(platform.entity.position), grounded: thirdPersonGrounded };
    function pos(v) { return { x: v.x, y: v.y, z: v.z }; }
  }
}

async function hovercraft(browser) {
  const { context, page, errors, externalRequests } = await openStarted(browser, 'survival-arena-2');
  const authored = await page.evaluate(() => ({ moveSpeed: currentPlayerSettings.moveSpeed || 11, acceleration: currentPlayerSettings.acceleration || 10 }));
  const before = await runtime(page);
  await hold(page, 'w', 250); const accelerated = await runtime(page);
  await page.keyboard.down('w'); await page.keyboard.down('Space'); await page.waitForTimeout(140); const boosted = await runtime(page); await page.keyboard.up('Space'); await page.keyboard.up('w');
  await hold(page, ['w', 'a'], 700); const steered = await runtime(page);
  await page.waitForTimeout(800); const braked = await runtime(page);
  const speed = value => Math.hypot(value.velocity.x, value.velocity.z);
  const result = { authored, before, accelerated, boosted, steered, braked,
    metrics: { accelerated: speed(accelerated), boosted: speed(boosted), steering: steered.rotationY - accelerated.rotationY, braked: speed(braked) }, errors, externalRequests };
  result.pass = authored.moveSpeed === 11 && authored.acceleration === 10 && result.metrics.accelerated > 1 && result.metrics.boosted > result.metrics.accelerated &&
    Math.abs(result.metrics.steering) > 0.05 && result.metrics.braked < speed(steered) && !errors.length && !externalRequests.length;
  await context.close();
  return result;
}

async function creatorJourney(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(`${BASE}/editor/?game=survival-arena-2`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => currentUiConfig?.startScreen?.title === 'Survival Arena 2', null, { timeout: 30000 });
  if (await page.locator('#app').evaluate(element => element.classList.contains('editor-hidden'))) await page.locator('#chrome-toggle-btn').click();
  await page.locator('[data-right-tab="scene"]').click();
  await page.locator('#scene-search').fill('Arena identity');
  await page.locator('.scene-list-item').first().click();
  const editedId = await page.evaluate(() => selectedItem.id);
  const oldX = Number(await page.locator('#f-x').inputValue());
  const newX = Number((oldX + 0.1).toFixed(2));
  await page.locator('#f-x').fill(String(newX));
  const uiEditedX = await page.evaluate(() => selectedItem.entity.position.x);
  await page.locator('#play-btn').click();
  await page.waitForFunction(() => playMode === true);
  const startButton = page.locator('#start-overlay-btn');
  if (await startButton.isVisible()) await startButton.click();
  await page.waitForTimeout(300);
  const playSawEdit = await page.evaluate(id => placed.find(item => item.id === id)?.entity.position.x, editedId);
  await page.locator('#play-btn').click();
  await page.waitForFunction(() => playMode === false);
  await page.locator('[data-right-tab="project"]').click();

  // Headless Edge closes its renderer on the Blob download gesture in this
  // environment. Preserve the real button handlers/build path and replace
  // only the final download sink so the exact generated HTML can be opened
  // independently below.
  await page.evaluate(() => {
    window.__rcCapturedExports = {};
    downloadHTML = (html, filename) => { window.__rcCapturedExports[filename] = html; };
  });
  await page.locator('#export-playable-btn').click();
  await page.waitForFunction(() => !!window.__rcCapturedExports['playable-game.html'], null, { timeout: 120000 });
  const playablePath = path.join(EXPORT_DIR, 'playable-game.html');
  fs.writeFileSync(playablePath, await page.evaluate(() => window.__rcCapturedExports['playable-game.html']));
  await page.locator('#export-standalone-alt-btn').click();
  await page.waitForFunction(() => !!window.__rcCapturedExports['editable-game.html'], null, { timeout: 120000 });
  const editablePath = path.join(EXPORT_DIR, 'editable-game.html');
  fs.writeFileSync(editablePath, await page.evaluate(() => window.__rcCapturedExports['editable-game.html']));
  await context.close();

  async function inspectExport(file, playableOnly) {
    const isolated = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await isolated.newPage();
    const errors = [];
    const network = [];
    p.on('pageerror', error => errors.push(error.message));
    p.on('request', request => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
    await p.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 60000 });
    await p.waitForFunction(() => typeof placed !== 'undefined' && placed.length > 0);
    const embeddedX = await p.evaluate(id => placed.find(item => item.id === id)?.entity.position.x, editedId);
    const chrome = p.locator('#chrome-toggle-btn');
    const chromeVisible = await chrome.isVisible();
    let editorOpened = false;
    if (!playableOnly && chromeVisible) {
      const startOverlay = p.locator('#start-overlay-btn');
      if (await startOverlay.isVisible()) {
        await startOverlay.click();
        await p.waitForTimeout(150);
      }
      await chrome.click();
      editorOpened = await p.locator('#app').evaluate(element => !element.classList.contains('editor-hidden'));
    }
    const info = { file, bytes: fs.statSync(file).size, embeddedX, chromeVisible, editorOpened, errors, network };
    info.pass = embeddedX === newX && !errors.length && !network.length && (playableOnly ? !chromeVisible : editorOpened);
    await isolated.close();
    return info;
  }
  const playable = await inspectExport(playablePath, true);
  const editable = await inspectExport(editablePath, false);
  const result = { editedId, oldX, newX, uiEditedX, playSawEdit, playable, editable, ...observed };
  result.pass = uiEditedX === newX && playSawEdit === newX && playable.pass && editable.pass && !result.errors.length && !result.externalRequests.length;
  return result;
}

(async () => {
  const creatorOnly = process.argv.includes('--creator-only');
  let browser;
  const report = { generatedAt: new Date().toISOString(), base: BASE, method: 'Exact extracted ZIP served from unrelated temporary directory; native browser input; read-only gameplay telemetry; one UI editor edit' };
  if (!creatorOnly) {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    try {
      report.coreRoutes = await coreRoutes(browser);
      report.featured = await featured(browser);
      report.arsenal = await arsenal(browser);
      report.forest = await forest(browser);
      report.movingTemple = await movingTemple(browser);
      report.hovercraft = await hovercraft(browser);
    } finally {
      await browser.close();
    }
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    report.creatorJourney = await creatorJourney(browser);
  } finally {
    await browser.close();
  }
  const sections = creatorOnly ? ['creatorJourney'] : ['coreRoutes', 'featured', 'arsenal', 'forest', 'movingTemple', 'hovercraft', 'creatorJourney'];
  report.pass = sections.every(key => report[key]?.pass);
  fs.writeFileSync(path.join(OUT, 'RC1-CLEANROOM-RESULT.json'), JSON.stringify(report, null, 2) + '\n');
  for (const key of sections) console.log(`${key}: ${report[key].pass ? 'PASS' : 'FAIL'}`);
  if (!report.pass) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
