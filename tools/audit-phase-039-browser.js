'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-039');
const fixture = path.join(ROOT, 'phase-039-dogfood.opus-tilemap.json');
const chunkFixture = path.join(ROOT, 'phase-039-dogfood.opus-chunk.json');
const port = '8871';
const targetCycles = Number(process.env.PHASE039_BROWSER_CYCLES || 25);
fs.mkdirSync(QUAL, { recursive: true });
const canonicalSource = fs.readFileSync(fixture, 'utf8');

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, port], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server timeout')), 10000); server.stdout.on('data', (data) => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const report = { phase: 39, harness: 'isolated-real-browser-portable-bundle-campaign', started: new Date().toISOString(), browserCycles: 0, isolatedContexts: 0, importCycles: 0, cancelCycles: 0, undoRedoCycles: 0, cleanReexports: 0, chunkCycles: 0, editableExports: 0, playableExports: 0, exportedEditorCycles: 0, pageErrors: [], consoleErrors: [], externalRequests: [], memory: [], status: 'FAIL' };
  try {
    let editableHTML = null;
    for (let cycle = 0; cycle < targetCycles; cycle++) {
      const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } }); report.isolatedContexts++;
      const page = await context.newPage(); const requests = [];
      page.on('pageerror', (error) => report.pageErrors.push(`cycle ${cycle}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`cycle ${cycle}: ${message.text()}`); });
      page.on('request', (request) => requests.push(request.url())); page.on('dialog', (dialog) => dialog.accept());
      await page.goto(`http://127.0.0.1:${port}/editor/`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof OpusTilemapBundle !== 'undefined' && typeof placed !== 'undefined', { timeout: 60000 });
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
      await page.locator('#import-tilemap-bundle-input').setInputFiles(fixture); await page.locator('#tilemap-bundle-modal').waitFor({ state: 'visible' });
      assert((await page.locator('#tilemap-bundle-summary').textContent()).includes('cells: 576')); await page.locator('#tilemap-bundle-cancel').click();
      assert.strictEqual(await page.evaluate(() => placed.filter((item) => item.kind === 'tilemap').length), 0); report.cancelCycles++;
      await page.locator('#import-tilemap-bundle-input').setInputFiles(fixture); await page.locator('#tilemap-bundle-confirm').click();
      await page.waitForFunction(() => placed.some((item) => item.kind === 'tilemap' && item.name === 'Phase 039 Portable World')); report.importCycles++;
      const result = await page.evaluate(async (source) => {
        const item = placed.find((entry) => entry.kind === 'tilemap' && entry.name === 'Phase 039 Portable World');
        const exported = await OpusTilemapBundle.createBundle({ rootKind: 'tilemap', root: serializeTilemapRecord(item), project: tilemapBundleProjectView() });
        const validation = validateCurrentProject(); undo(); const absent = !placed.some((entry) => entry.name === 'Phase 039 Portable World'); redo(); const restored = placed.some((entry) => entry.name === 'Phase 039 Portable World');
        const errorIssues = validation.issues.filter((entry) => entry.severity === 'error');
        return { identical: exported.text === source, absent, restored, errors: errorIssues.length, errorIssues: errorIssues.slice(0, 50).map((entry) => ({ code: entry.code, message: entry.message })), heap: performance.memory && performance.memory.usedJSHeapSize || null };
      }, canonicalSource);
      assert(result.identical && result.absent && result.restored); if (result.errors) { report.validationErrors = result.errorIssues; throw new Error(`validation produced ${result.errors} errors`); } report.undoRedoCycles++; report.cleanReexports++; if (result.heap) report.memory.push(result.heap);
      if (cycle % 2 === 0) {
        await page.locator('#import-tilemap-bundle-input').setInputFiles(chunkFixture); await page.locator('#tilemap-bundle-confirm').click(); await page.waitForFunction(() => tilemapChunks.some((chunk) => chunk.id === 'dogfood-chunk'));
        const chunkParity = await page.evaluate(async () => { const source = tilemapChunks.find((entry) => entry.id === 'dogfood-chunk'); const a = await OpusTilemapBundle.createBundle({ rootKind: 'tilemap-chunk', root: source, project: tilemapBundleProjectView() }); return (await OpusTilemapBundle.verifyBundleText(a.text)).sha256 === a.sha256; }); assert(chunkParity); report.chunkCycles++;
      }
      if (cycle === 0) {
        const pair = await page.evaluate(async () => ({ editable: await buildExportHTML(false), playable: await buildExportHTML(true) }));
        assert(pair.editable.includes("const FORMAT = 'digital-opus-tilemap-bundle'")); assert(!pair.playable.includes("const FORMAT = 'digital-opus-tilemap-bundle'")); assert(!pair.playable.includes('function verifyBundleText'));
        editableHTML = pair.editable; fs.writeFileSync(path.join(QUAL, 'phase-039-editable-game.html'), pair.editable); fs.writeFileSync(path.join(QUAL, 'phase-039-playable-game.html'), pair.playable); report.editableExports++; report.playableExports++;
      }
      if (cycle === targetCycles - 1) await page.screenshot({ path: path.join(QUAL, 'phase-039-imported-tilemap.png'), fullPage: true });
      report.externalRequests.push(...requests.filter((url) => !url.startsWith(`http://127.0.0.1:${port}`) && !url.startsWith('data:') && !url.startsWith('blob:')));
      report.browserCycles++; await context.close();
    }
    assert(editableHTML);
    const exportedContext = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } }); const exportedPage = await exportedContext.newPage();
    exportedPage.on('response', (response) => { if (response.status() >= 400) report.exportedHttpErrors = (report.exportedHttpErrors || []).concat([{ status: response.status(), url: response.url() }]); });
    exportedPage.on('pageerror', (error) => report.pageErrors.push(`exported editor: ${error.message}`)); exportedPage.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`exported editor: ${message.text()} @ ${JSON.stringify(message.location())}`); });
    await exportedPage.goto(`http://127.0.0.1:${port}/qualification/phase-039/phase-039-editable-game.html`, { waitUntil: 'load' });
    await exportedPage.waitForFunction(() => typeof OpusTilemapBundle !== 'undefined' && placed.some((item) => item.kind === 'tilemap'), { timeout: 60000 });
    await exportedPage.locator('#import-tilemap-bundle-input').setInputFiles(chunkFixture); await exportedPage.locator('#tilemap-bundle-confirm').click(); await exportedPage.waitForFunction(() => tilemapChunks.length > 0);
    assert(await exportedPage.evaluate(async () => { const result = await OpusTilemapBundle.createBundle({ rootKind: 'tilemap-chunk', root: tilemapChunks[0], project: tilemapBundleProjectView() }); return (await OpusTilemapBundle.verifyBundleText(result.text)).sha256 === result.sha256; }));
    report.exportedEditorCycles++; await exportedContext.close();
    assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.externalRequests, []);
    report.memoryObservation = report.memory.length ? { minimumUsedJsHeap: Math.min(...report.memory), maximumUsedJsHeap: Math.max(...report.memory) } : null; report.status = 'PASS';
  } finally {
    report.ended = new Date().toISOString(); fs.writeFileSync(path.join(QUAL, 'browser-campaign.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.kill();
  }
  console.log(`Phase 039 browser: ${report.status} (${report.browserCycles} isolated cycles, ${report.cleanReexports} clean re-exports, ${report.chunkCycles} Chunk cycles)`); if (report.status !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
