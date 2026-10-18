'use strict';

// Focused, player-facing cleanup verification. Inputs are delivered through
// Playwright's mouse/keyboard APIs; evaluate() is read-only telemetry.
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'gameplay-feel-evidence', 'human-cleanup');
fs.mkdirSync(OUT, { recursive: true });

const pos = value => value ? { x: value.x, y: value.y, z: value.z } : null;
const distXZ = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const speedXZ = v => Math.hypot(v.x, v.z);
async function hold(page, keys, milliseconds) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  for (const key of [...list].reverse()) await page.keyboard.up(key);
}
async function openGame(browser, id, { clear = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://localhost:8837/dist/games/${id}.html`, { waitUntil: 'load', timeout: 60000 });
  if (clear) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
  }
  return { context, page, errors };
}
async function start(page) {
  const button = page.locator('#start-overlay-btn');
  if (await button.isVisible()) await button.click();
  await page.waitForTimeout(1200);
}
async function state(page) {
  return page.evaluate(() => {
    const entity = player && player.entity;
    const velocity = player.controllerType === 'hovercraft' ? craftVelocity :
      player.controllerType === 'thirdperson' ? thirdPersonVelocity : firstPersonVelocity;
    const basis = app.camera.getBasis();
    return {
      controller: player.controllerType,
      position: entity && entity.position,
      velocity,
      rotationY: entity && entity.rotationY,
      yaw: typeof fpYaw === 'number' ? fpYaw : null,
      pitch: typeof fpPitch === 'number' ? fpPitch : null,
      grounded: player.controllerType === 'thirdperson' ? thirdPersonGrounded : player.controllerType === 'firstperson' ? firstPersonGrounded : true,
      basis: { forward: basis.forward, right: basis.right },
      paused: app.paused,
      pointerLocked: document.pointerLockElement === document.getElementById('game'),
      ended: gameEnded,
      endTitle: document.getElementById('game-end-title')?.textContent || '',
      counters: window.__gameState?.counters || {},
      settings: { sensitivity: app.settings.get('mouseSensitivity'), invertMouseY: app.settings.get('invertMouseY') },
    };
  });
}

async function fpsAndSettings(browser) {
  const { context, page, errors } = await openGame(browser, 'arsenal-run');
  const report = { id: 'arsenal-run', errors };
  report.mainDefaults = await page.evaluate(() => ({
    sensitivity: Number(document.getElementById('mainmenu-mouse-sensitivity').value),
    invertMouseY: document.getElementById('mainmenu-invert-mouse-y').checked,
  }));
  await start(page);
  await page.locator('#game').click({ position: { x: 640, y: 360 } });
  await page.waitForFunction(() => document.pointerLockElement === document.getElementById('game'));
  const initial = await state(page);
  await page.mouse.move(648, 360); const slowRight = await state(page);
  await page.mouse.move(728, 360); const right = await state(page);
  await page.mouse.move(568, 360); const left = await state(page);
  await page.mouse.move(568, 420); const down = await state(page);
  await page.mouse.move(568, 300); const up = await state(page);
  await page.mouse.move(2200, 300); const largeRight = await state(page);
  await page.mouse.move(2200, -2000); const upperExtreme = await state(page);
  await page.mouse.move(2200, 2400); const lowerExtreme = await state(page);
  report.lookDefault = {
    slowRight: slowRight.yaw - initial.yaw,
    right: right.yaw - slowRight.yaw,
    left: left.yaw - right.yaw,
    down: down.pitch - left.pitch,
    up: up.pitch - down.pitch,
    largeRight: largeRight.yaw - up.yaw,
    upperExtreme: upperExtreme.pitch,
    lowerExtreme: lowerExtreme.pitch,
  };
  const beforeMove = await state(page);
  await hold(page, 'w', 450); const afterW = await state(page);
  await hold(page, ['w', 'd'], 450); const afterDiagonal = await state(page);
  await hold(page, ['Shift', 'w'], 450); const afterSprint = await state(page);
  for (const key of ['f', 'r', 'e', 'Space']) await page.keyboard.press(key);
  report.inputs = {
    wDistance: distXZ(beforeMove.position, afterW.position),
    diagonalDistance: distXZ(afterW.position, afterDiagonal.position),
    sprintDistance: distXZ(afterDiagonal.position, afterSprint.position),
  };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const paused = await state(page);
  report.pause = { paused: paused.paused, pointerReleased: !paused.pointerLocked };
  report.pauseControls = await page.evaluate(() => ({
    sensitivity: Number(document.getElementById('pause-mouse-sensitivity').value),
    invertMouseY: document.getElementById('pause-invert-mouse-y').checked,
  }));
  await page.locator('#pause-invert-mouse-y').check();
  await page.locator('#pause-mouse-sensitivity').focus();
  await page.keyboard.press('ArrowRight');
  const chosen = await page.evaluate(() => ({
    sensitivity: app.settings.get('mouseSensitivity'), invertMouseY: app.settings.get('invertMouseY'),
  }));
  await page.getByRole('button', { name: /Resume/ }).click();
  await page.locator('#game').click({ position: { x: 640, y: 360 } });
  await page.waitForFunction(() => document.pointerLockElement === document.getElementById('game'));
  const invertedBefore = await state(page);
  await page.mouse.move(640, 420);
  const invertedDown = await state(page);
  report.inverted = { chosen, downDelta: invertedDown.pitch - invertedBefore.pitch };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: /Resume/ }).click();
  await page.locator('#game').click({ position: { x: 640, y: 360 } });
  await page.waitForFunction(() => document.pointerLockElement === document.getElementById('game'));
  report.resume = await state(page);
  await page.reload({ waitUntil: 'load' });
  report.persisted = await page.evaluate(() => ({
    sensitivity: Number(document.getElementById('mainmenu-mouse-sensitivity').value),
    invertMouseY: document.getElementById('mainmenu-invert-mouse-y').checked,
  }));
  report.pass = report.mainDefaults.invertMouseY === false && report.lookDefault.slowRight > 0 &&
    report.lookDefault.right > 0 && report.lookDefault.left < 0 && report.lookDefault.down > 0 &&
    report.lookDefault.up < 0 && Math.abs(report.lookDefault.upperExtreme) <= 1.5001 &&
    Math.abs(report.lookDefault.lowerExtreme) <= 1.5001 && report.inverted.downDelta < 0 &&
    report.pause.paused && report.pause.pointerReleased && report.resume.pointerLocked &&
    report.persisted.invertMouseY === true && report.persisted.sensitivity === chosen.sensitivity && !errors.length;
  await context.close();
  return report;
}

async function hovercraft(browser, id) {
  const { context, page, errors } = await openGame(browser, id);
  await start(page);
  const initial = await state(page);
  await hold(page, 'w', 250); const accelerated = await state(page);
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  const boostPeak = await state(page);
  await page.waitForTimeout(380);
  await page.keyboard.up('Space');
  await page.keyboard.up('w');
  const boosted = await state(page);
  await hold(page, ['w', 'a'], 850); const steered = await state(page);
  await page.waitForTimeout(900); const coasted = await state(page);
  await hold(page, 's', 1800); const reversed = await state(page);
  await hold(page, 'w', 3500); const boundary = await state(page);
  const authored = await page.evaluate(() => ({
    moveSpeed: currentPlayerSettings.moveSpeed || 11,
    acceleration: currentPlayerSettings.acceleration || 10,
    bounds: currentPlayerSettings.playBounds,
    visibleLandmarks: placed.filter(item => item.entity?.visible && /identity|marker|spire|dais|beacon/i.test(item.record?.name || item.name || '')).length,
  }));
  const forward = { x: Math.sin(reversed.rotationY), z: Math.cos(reversed.rotationY) };
  const reverseDot = reversed.velocity.x * forward.x + reversed.velocity.z * forward.z;
  const cameraDot = initial.basis.forward.x * Math.sin(initial.rotationY) + initial.basis.forward.z * Math.cos(initial.rotationY);
  const report = {
    id, errors, authored, initial, accelerated, boostPeak, steered, coasted, reversed, boosted, boundary,
    metrics: {
      acceleratedSpeed: speedXZ(accelerated.velocity),
      steeringDelta: steered.rotationY - accelerated.rotationY,
      coastedSpeed: speedXZ(coasted.velocity),
      reverseDot,
      boostPeakSpeed: speedXZ(boostPeak.velocity),
      boostedSpeed: speedXZ(boosted.velocity),
      cameraDot,
    },
  };
  const b = authored.bounds;
  report.pass = report.metrics.acceleratedSpeed > 0.5 && Math.abs(report.metrics.steeringDelta) > 0.05 &&
    report.metrics.coastedSpeed < speedXZ(steered.velocity) && reverseDot < 0 &&
    report.metrics.boostPeakSpeed > report.metrics.acceleratedSpeed && cameraDot > 0 && (!b || (boundary.position.x >= b.minX && boundary.position.x <= b.maxX && boundary.position.z >= b.minZ && boundary.position.z <= b.maxZ)) && !errors.length;
  await context.close();
  return report;
}

async function movingTemple(browser) {
  const { context, page, errors } = await openGame(browser, 'moving-temple');
  await start(page);
  const initial = await state(page);
  const platform0 = await page.evaluate(() => { const p = placed.find(item => item.record?.id === 'obj57' || item.id === 'obj57')?.entity?.position; return p && { x: p.x, y: p.y, z: p.z }; });
  await page.waitForTimeout(700);
  const platform1 = await page.evaluate(() => { const p = placed.find(item => item.record?.id === 'obj57' || item.id === 'obj57')?.entity?.position; return p && { x: p.x, y: p.y, z: p.z }; });
  const stages = [];
  async function stage(keys, ms, settle = 300) { await hold(page, keys, ms); await page.waitForTimeout(settle); stages.push(await state(page)); }
  await stage(['w', 'Space'], 720, 450);
  await stage(['w', 'Space'], 760, 450);
  await stage('w', 300, 100);
  await page.keyboard.press('e');
  await stage('w', 400, 200);
  const lift0 = await page.evaluate(() => { const p = placed.find(item => item.record?.id === 'obj59' || item.id === 'obj59')?.entity?.position; return p && { x: p.x, y: p.y, z: p.z }; });
  await page.waitForTimeout(8200);
  const lift1 = await page.evaluate(() => { const p = placed.find(item => item.record?.id === 'obj59' || item.id === 'obj59')?.entity?.position; return p && { x: p.x, y: p.y, z: p.z }; });
  await stage(['w', 'Space'], 700, 500);
  const final = await state(page);
  const cameraDot = initial.basis.forward.x * Math.sin(initial.rotationY) + initial.basis.forward.z * Math.cos(initial.rotationY);
  const report = { id: 'moving-temple', errors, initial, platform0, platform1, lift0, lift1, stages, final, cameraDot };
  report.pass = platform1.x !== platform0.x && cameraDot > 0 && stages.some(s => distXZ(initial.position, s.position) > 2) && lift1.y >= lift0.y && !errors.length;
  await context.close();
  return report;
}

async function skyway(browser) {
  const { context, page, errors } = await openGame(browser, 'skyway-trial');
  await start(page);
  const initial = await state(page);
  await hold(page, 'w', 100); const early = await state(page);
  await hold(page, 'w', 250); const accelerated = await state(page);
  await page.waitForTimeout(350); const stopped = await state(page);
  const stages = [];
  for (let i = 0; i < 6 && !(await state(page)).ended; i++) {
    await hold(page, ['w', 'Space'], 580);
    await page.waitForTimeout(320);
    stages.push(await state(page));
  }
  const final = await state(page);
  const report = { id: 'skyway-trial', errors, initial, early, accelerated, stopped, stages, final,
    metrics: { earlySpeed: speedXZ(early.velocity), acceleratedSpeed: speedXZ(accelerated.velocity), stoppedSpeed: speedXZ(stopped.velocity), maxZ: Math.max(initial.position.z, ...stages.map(s => s.position.z)) } };
  report.pass = report.metrics.earlySpeed > 0 && report.metrics.acceleratedSpeed >= report.metrics.earlySpeed &&
    report.metrics.stoppedSpeed < report.metrics.acceleratedSpeed && report.metrics.maxZ > 8 && !errors.length;
  await context.close();
  return report;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    results.push(await fpsAndSettings(browser));
    results.push(await hovercraft(browser, 'survival-arena'));
    results.push(await hovercraft(browser, 'survival-arena-2'));
    results.push(await movingTemple(browser));
    results.push(await skyway(browser));
  } finally {
    await browser.close();
  }
  const report = { generatedAt: new Date().toISOString(), method: 'Native player input with read-only telemetry', results, pass: results.every(result => result.pass) };
  fs.writeFileSync(path.join(OUT, 'focused-audit.json'), JSON.stringify(report, null, 2) + '\n');
  for (const result of results) console.log(`${result.id}: ${result.pass ? 'PASS' : 'FAIL'}`);
  if (!report.pass) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
