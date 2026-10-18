'use strict';
// Script component: record normalization, highlighting, lifecycle dispatch,
// error line reporting and the trust gate, using the actual module source.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/51-script-component.js'), 'utf8');
// The module's trailing IIFE mounts DOM controls; tests run only the declarations.
const declarations = source.slice(0, source.indexOf('// Script Console toggle lives in the viewport View menu.'));

function sandbox(overrides = {}) {
  const toasts = [], ended = [];
  const ctx = {
    console, Math, JSON, Number, String, Object, Array, RegExp, Error, Set, Map,
    escapeHtml: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    Opus: { Vec3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } clone() { return new ctx.Opus.Vec3(this.x, this.y, this.z); } } },
    placed: [], scriptsTrusted: true, simElapsed: 0, player: null, window: {},
    app: { input: { isDown: () => false, wasPressed: () => false } },
    inputActionDown: () => false, endGame: (r) => ended.push(r), setObjective() {}, showToast: (m) => toasts.push(m),
    executeAction() {}, removeItemFromScene(item) { ctx.placed.splice(ctx.placed.indexOf(item), 1); },
    itemDisplayName: (item) => item.name || item.id,
    document: { getElementById: () => null, createElement: () => ({ setAttribute() {}, querySelector: () => ({ onclick: null }), appendChild() {} }) },
    ...overrides,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(declarations, ctx);
  // Console rendering is DOM work; record entries only.
  ctx.renderScriptConsole = () => {}; ctx.setScriptConsoleVisible = () => {};
  return { ctx, toasts, ended };
}
function cube(id, code, extra = {}) {
  const { ctx } = extra;
  return { id, name: id, kind: 'cube', entity: { position: new ctx.Opus.Vec3(0, 0, 0), rotationY: 0, visible: true }, script: { version: 1, enabled: true, code }, behaviors: [] };
}

{
  const { ctx } = sandbox();
  assert.strictEqual(ctx.normalizeScriptRecord(null), null);
  assert.strictEqual(ctx.normalizeScriptRecord({ code: 5 }), null, 'non-string code is not a script');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.normalizeScriptRecord({ code: 'x', enabled: false }))), { version: 1, enabled: false, code: 'x' });
  assert.strictEqual(ctx.normalizeScriptRecord({ code: 'a'.repeat(70000) }).code.length, 64 * 1024, 'code is bounded');
  const html = ctx.highlightScript("// note\nconst s = 'x<y';\nfunction onStart(ctx) { return 42; }");
  assert(html.includes('<span class="tok-comment">// note</span>'));
  assert(html.includes('<span class="tok-string">&#39;x&lt;y&#39;</span>'), 'strings are escaped, not injected');
  assert(html.includes('<span class="tok-keyword">function</span>') && html.includes('<span class="tok-api">onStart</span>') && html.includes('<span class="tok-number">42</span>'));
  assert(ctx.scriptSyntaxCheck('function (') && ctx.scriptSyntaxCheck('const ok = 1;') === null);
}
{
  // Lifecycle: onStart once, onUpdate with dt, trigger hooks routed, onStop at stop.
  const { ctx, ended } = sandbox();
  const spinner = cube('spinner', "function onStart(c){ c.vars.n = 0; c.log('ready'); }\nfunction onUpdate(c, dt){ c.entity.rotationY += dt; c.vars.n++; }\nfunction onTriggerEnter(c){ c.game.win(); }\nfunction onStop(c){ c.log('bye', c.vars.n); }", { ctx });
  ctx.placed.push(spinner);
  ctx.startScripts();
  ctx.updateScripts(0.5); ctx.updateScripts(0.25);
  assert.strictEqual(spinner.entity.rotationY, 0.75, 'onUpdate receives dt');
  ctx.dispatchScriptHook(spinner, 'enter');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ended)), ['win'], 'onTriggerEnter runs on the enter trigger');
  ctx.dispatchScriptHook(spinner, 'stay');
  ctx.stopScripts();
  const logs = JSON.parse(JSON.stringify(ctx.scriptConsoleEntries.map(e => e.text)));
  assert.deepStrictEqual(logs, ['ready', 'bye 2'], 'onStart and onStop each ran once');
  ctx.updateScripts(1);
  assert.strictEqual(spinner.entity.rotationY, 0.75, 'no updates after Stop');
}
{
  // Runtime error: reported with the author's line number, and the script stops instead of flooding.
  const { ctx } = sandbox();
  const broken = cube('broken', "function onUpdate(c, dt) {\n  c.vars.t = (c.vars.t || 0) + 1;\n  missingThing.explode();\n}", { ctx });
  ctx.placed.push(broken);
  ctx.startScripts();
  for (let i = 0; i < 5; i++) ctx.updateScripts(0.1);
  const errors = ctx.scriptConsoleEntries.filter(e => e.level === 'error');
  assert.strictEqual(errors.length, 1, 'one error stops the script until the next Play');
  assert.strictEqual(errors[0].line, 3, `error reports the author's line: ${JSON.stringify(errors[0])}`);
  // Syntax errors are reported at compile time, not thrown into the game loop.
  const syntax = cube('syntax', 'function onStart( {', { ctx });
  ctx.placed.push(syntax); ctx.startScripts();
  assert(ctx.scriptConsoleEntries.some(e => e.owner === 'syntax' && e.level === 'error' && /SyntaxError/.test(e.text)));
}
{
  // Trust gate: untrusted projects never compile or run Script components.
  const { ctx } = sandbox({ scriptsTrusted: false });
  const item = cube('gated', "function onStart(c){ c.game.win(); }", { ctx });
  ctx.placed.push(item);
  let compiled = false; const realCompile = ctx.compileScript; ctx.compileScript = (i) => { compiled = true; return realCompile(i); };
  ctx.startScripts();
  assert(!compiled, 'untrusted scripts are not compiled');
  assert(ctx.scriptConsoleEntries.some(e => e.level === 'warn' && /disabled/.test(e.text)));
  // Disabled scripts never run even when trusted.
  const trusted = sandbox(); const off = cube('off', "function onStart(c){ c.log('ran'); }", { ctx: trusted.ctx }); off.script.enabled = false;
  trusted.ctx.placed.push(off); trusted.ctx.startScripts();
  assert.strictEqual(trusted.ctx.scriptConsoleEntries.length, 0);
}
{
  // Trust review and detection include Script components (actual 47 source).
  const trust = fs.readFileSync(path.join(root, 'editor/src/modules/47-script-trust.js'), 'utf8');
  const ctx = {}; vm.createContext(ctx);
  for (const name of ['projectHasScripts', 'readCustomScriptReview']) {
    const fn = trust.match(new RegExp(`function ${name}\\([^]*?\\n}`)); assert(fn, name); vm.runInContext(fn[0], ctx);
  }
  const project = { levels: [{ objects: [{ id: 'a', name: 'Door', script: { code: 'function onInteract(c){}' } }] }] };
  assert.strictEqual(ctx.projectHasScripts(project), true, 'Script components count as project code');
  assert.strictEqual(ctx.projectHasScripts({ levels: [{ objects: [{ id: 'b', script: { code: '   ' } }] }] }), false, 'empty scripts are not code');
  const review = ctx.readCustomScriptReview(project);
  assert(review.entries.some(e => e.includes('Script component on Door') && e.includes('onInteract')), 'review shows the script source');
}
{
  // Exported and hosted games boot straight into Play and dispatch script hooks
  // during boot, so the Script module must initialize before the boot module.
  const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
  const script = modules.findIndex(f => /script-component\.js$/.test(f)), boot = modules.findIndex(f => /onboarding\.js$/.test(f));
  assert(script >= 0 && boot >= 0 && script < boot, `Script module must be assembled before the boot module: ${modules[script]} vs ${modules[boot]}`);
  assert.strictEqual(boot, modules.length - 1, 'the boot module stays last');
}
console.log('Script component: normalization, highlighting, lifecycle, error lines, trust gate PASS');
