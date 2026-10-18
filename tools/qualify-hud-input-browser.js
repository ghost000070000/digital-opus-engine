'use strict';
// Real-browser regression of the actual production HUD renderer. This isolated
// DOM fixture is not a substitute for native editor/export gameplay acceptance.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/01-editor.js'), 'utf8');
const start = source.indexOf('function renderHudLayer()');
const end = source.indexOf('\nfunction switchToLevel(', start);
assert(start >= 0 && end > start, 'Actual production renderer must be extractable');
let renderer = source.slice(start, end);
const legacyRenderer = process.argv.includes('--legacy-renderer');
if (legacyRenderer) {
  // Qualification-only reconstruction of the captured pre-repair algorithm.
  // Never overwrite product source to reproduce a historical input defect.
  const reconciliation = renderer.indexOf("  const template = document.createElement('template');");
  const bind = renderer.indexOf("  layer.querySelectorAll('[data-hud-button]')", reconciliation);
  assert(reconciliation >= 0 && bind > reconciliation && renderer.includes('const markup = currentUiConfig.hudElements.map'), 'Expected stable renderer reconciliation shape');
  renderer = renderer.slice(0, reconciliation) + renderer.slice(bind);
  renderer = renderer.replace('const markup = currentUiConfig.hudElements.map', 'layer.innerHTML = currentUiConfig.hudElements.map');
}
const runId = 'hud-input-browser-' + new Date().toISOString().replace(/[-:.]/g, '');
const dir = path.join(root, 'qualification/phase-077', runId);
fs.mkdirSync(dir, { recursive: true });
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), rendererSource: 'editor/src/01-editor.js', rendererVariant: legacyRenderer ? 'QUALIFICATION_ONLY_PRE_REPAIR_RECONSTRUCTION' : 'CURRENT_PRODUCT_SOURCE', cases: [], pageErrors: [], consoleErrors: [], externalRequests: [], status: 'IN_PROGRESS' };
fs.writeFileSync(path.join(dir, 'renderer-source.js'), renderer);
const html = `<!doctype html><meta charset="utf-8"><title>Actual HUD renderer input regression</title>
<style>body{font:18px sans-serif}#hud-elements-layer{height:180px}.hud-element{display:inline-block;padding:12px}button{font:18px sans-serif;padding:12px}#controls{margin-top:24px}</style>
<div id="hud-elements-layer"></div><div id="controls"><button id="change-action">Change action</button><button id="change-kind">Change kind</button><button id="remove-button">Remove HUD button</button><button id="stop">Stop</button></div><pre id="proof"></pre>
<script>
let playMode=true;
const currentUiConfig={hudElements:[{id:'action',kind:'button',anchor:'top-left',text:'HUD action',buttonAction:'first',buttonParams:{count:1}},{id:'clock',kind:'timer',anchor:'top-left',timerName:'clock',text:'Time: {value}'}]};
window.__gameTimers={clock:{elapsed:0}};window.__gameState={};
let frames=0;const calls=[];
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function resolveHudBindText(v){return String(v);}
function resolveHudBindingText(v,value){return String(v).replace('{value}',value);}
function ensureHealthInit(){window.__gameState.health=10;window.__gameState.maxHealth=10;}
function executeAction(action,params){calls.push({action,params:JSON.parse(JSON.stringify(params))});}
${renderer}
document.getElementById('change-action').onclick=()=>{currentUiConfig.hudElements[0].buttonAction='second';currentUiConfig.hudElements[0].buttonParams={count:2};};
document.getElementById('change-kind').onclick=()=>{currentUiConfig.hudElements[0].kind='label';currentUiConfig.hudElements[0].text='Replaced by label';};
document.getElementById('remove-button').onclick=()=>{currentUiConfig.hudElements=currentUiConfig.hudElements.filter(e=>e.id!=='action');};
document.getElementById('stop').onclick=()=>{playMode=false;};
function tick(t){window.__gameTimers.clock.elapsed=t/1000;renderHudLayer();frames++;document.getElementById('proof').textContent=JSON.stringify({frames,calls});requestAnimationFrame(tick);}requestAnimationFrame(tick);
</script>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); });
async function frames(page, count = 8) { const before = await page.evaluate(() => frames); await page.waitForFunction(n => frames >= n, before + count); }
async function runCase(label, fn) { try { const data = await fn(); proof.cases.push({ label, status: 'PASS', observedAt: new Date().toISOString(), ...data }); } catch (e) { proof.cases.push({ label, status: 'FAIL', observedAt: new Date().toISOString(), failure: e.message }); } }
(async () => {
  let browser, page;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
    page.on('pageerror', e => proof.pageErrors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') proof.consoleErrors.push(m.text()); });
    page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith(origin)) proof.externalRequests.push(r.url()); });
    const fresh = async () => { await page.goto(origin); await page.waitForSelector('[data-hud-button="action"]'); };
    await runCase('Timer updates preserve button identity and native keyboard focus', async () => {
      await fresh(); await page.keyboard.press('Tab');
      const button = await page.locator('[data-hud-button="action"]').elementHandle();
      const before = await page.locator('[data-hud-id="clock"]').textContent();
      await frames(page, 12);
      const after = await page.locator('[data-hud-id="clock"]').textContent();
      assert.notEqual(after, before, 'A changing timer must really render');
      assert(await button.evaluate(el => el.isConnected), 'Original button detached during ordinary timer updates');
      assert(await button.evaluate(el => document.activeElement === el), 'Native button focus lost during ordinary timer updates');
      await page.keyboard.press('Enter'); await frames(page);
      await page.keyboard.press('Space'); await frames(page);
      assert.deepStrictEqual(await page.evaluate(() => calls.map(c => c.action)), ['first', 'first']);
      return { before, after, keyboardActivations: 2 };
    });
    await runCase('Native pointer down across animation frames then up executes once', async () => {
      await fresh(); const box = await page.evaluate(() => { const rect = document.querySelector('[data-hud-button="action"]').getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await frames(page, 12); await page.mouse.up(); await frames(page);
      assert.deepStrictEqual(await page.evaluate(() => calls.map(c => c.action)), ['first']);
      return { pointerActivations: 1 };
    });
    await runCase('Retained button resolves current action and parameters', async () => {
      await fresh(); const original = await page.locator('[data-hud-button="action"]').elementHandle();
      await page.locator('#change-action').click(); await frames(page);
      assert(await original.evaluate(el => el.isConnected), 'Changing Action configuration must not detach the button');
      await page.locator('[data-hud-button="action"]').click();
      assert.deepStrictEqual(await page.evaluate(() => calls), [{ action: 'second', params: { count: 2 } }]);
      return { action: 'second', count: 2 };
    });
    await runCase('Kind change, removal and Stop clean obsolete elements', async () => {
      await fresh(); const original = await page.locator('[data-hud-button="action"]').elementHandle();
      await page.locator('#change-kind').click(); await frames(page);
      assert.equal(await original.evaluate(el => el.isConnected), false);
      assert.equal(await page.locator('[data-hud-button="action"]').count(), 0);
      assert.equal(await page.locator('[data-hud-id="action"]').textContent(), 'Replaced by label');
      await page.locator('#remove-button').click(); await frames(page); assert.equal(await page.locator('[data-hud-id="action"]').count(), 0);
      await page.locator('#stop').click(); await frames(page); assert.equal(await page.locator('#hud-elements-layer').textContent(), '');
      return { cleanup: 'kind/removal/Stop' };
    });
    assert.deepStrictEqual(proof.pageErrors, []); assert.deepStrictEqual(proof.consoleErrors, []); assert.deepStrictEqual(proof.externalRequests, []);
    proof.status = proof.cases.every(c => c.status === 'PASS') ? 'ACTUAL_HUD_NATIVE_INPUT_PASS' : 'ACTUAL_HUD_NATIVE_INPUT_FAILURE';
    if (proof.status !== 'ACTUAL_HUD_NATIVE_INPUT_PASS') process.exitCode = 1;
    await page.screenshot({ path: path.join(dir, 'result.png') });
  } catch (e) { proof.status = 'HARNESS_OR_BROWSER_FAILURE'; proof.failure = e.stack; process.exitCode = 1; }
  finally { proof.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof)); await browser?.close(); server.close(); }
})();
