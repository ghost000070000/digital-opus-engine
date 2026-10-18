'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.OPUS_ONBOARDING_PORT || '8898';
const BASE = process.env.OPUS_EDITOR_URL || `http://127.0.0.1:${PORT}/editor/`;
(async () => {
  const server = process.env.OPUS_EDITOR_URL ? null : spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, PORT], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  if (server) await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('onboarding audit server timeout')), 10000); server.stdout.on('data', data => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); server.once('exit', code => { if (code) reject(new Error(`onboarding audit server exited ${code}`)); }); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const cycles = [];
  let missingTargetRecovery = false;
  try {
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => localStorage.clear());
    for (let i = 0; i < 100; i++) {
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('[data-first-run-choice="guided"]').click();
      if (!(await page.locator('#onboarding-coach').isVisible())) {
        await page.locator('#help-btn').click();
        const resume = page.locator('#resume-tutorial-btn');
        if (await resume.isVisible()) await resume.click();
        else { await page.locator('#editor-help-close').click(); throw new Error(`coach unavailable at cycle ${i}`); }
      }
      await page.setViewportSize(i % 2 ? { width: 760, height: 540 } : { width: 1280, height: 720 });
      if (i === 0) {
        await page.evaluate(() => document.getElementById('palette-cube')?.remove());
        await page.locator('#onboarding-show-me').click();
        await page.waitForTimeout(1800);
        missingTargetRecovery = await page.locator('#onboarding-recovery').isVisible() && await page.locator('#onboarding-retry').isVisible();
      }
      await page.locator('#onboarding-show-me').click();
      await page.waitForTimeout(30);
      if (i % 11 === 0) await page.locator('#onboarding-skip-step').click();
      if (i % 4 === 0 && await page.locator('#onboarding-back').isEnabled()) await page.locator('#onboarding-back').click();
      if (i % 7 === 0) { await page.locator('#onboarding-exit').click(); await page.locator('#help-btn').click(); await page.locator('#resume-tutorial-btn').click(); }
      cycles.push({ cycle: i + 1, coachVisible: await page.locator('#onboarding-coach').isVisible(), recoveryVisible: await page.locator('#onboarding-recovery').isVisible() });
    }
    await page.evaluate(() => localStorage.setItem('digital-opus:onboarding:v1', '{bad json'));
    await page.reload({ waitUntil: 'load' });
    const malformedRecovered = await page.locator('#first-run-overlay').isVisible();
    const evidence = { generatedAt: new Date().toISOString(), url: BASE, cycles, errors, missingTargetRecovery, malformedRecovered, pass: cycles.length === 100 && cycles.every(cycle => cycle.coachVisible) && missingTargetRecovery && malformedRecovered && !errors.length };
    fs.writeFileSync(path.join(ROOT, 'editor-onboarding-stability-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(`Editor onboarding browser cycles: ${cycles.filter(cycle => cycle.coachVisible).length}/100; missing target ${missingTargetRecovery ? 'PASS' : 'FAIL'}; malformed recovery ${malformedRecovered ? 'PASS' : 'FAIL'}; errors ${errors.length}`);
    if (!evidence.pass) process.exitCode = 1;
  } finally { await context.close(); await browser.close(); if (server) server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
