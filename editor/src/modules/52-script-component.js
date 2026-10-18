// --- Script component ---
// The "write code if you want" path: an optional per-object script with
// lifecycle hooks, edited in a highlighted code editor and reported in a
// Script Console. Scripts are ordinary project data (item.script), so they
// save, undo, prefab and export with the object. They run only in Play and
// only when the project's scripts are trusted (same gate as Custom Script).
//
//   function onStart(ctx) {}            once when Play starts
//   function onUpdate(ctx, dt) {}       every frame (dt in seconds)
//   function onTriggerEnter(ctx) {}     player enters this Trigger Volume
//   function onTriggerExit(ctx) {}      player leaves this Trigger Volume
//   function onInteract(ctx) {}         player presses Interact nearby
//   function onClick(ctx) {}            this object is clicked in Play
//   function onStop(ctx) {}             Play stops
//
// Everything here uses `var`/function declarations: this module is appended
// after the boot code, and the Inspector may call into it during boot.

var SCRIPT_HOOKS = ['onStart', 'onUpdate', 'onTriggerEnter', 'onTriggerExit', 'onInteract', 'onClick', 'onStop'];
var SCRIPT_TRIGGER_HOOKS = { enter: 'onTriggerEnter', exit: 'onTriggerExit', interact: 'onInteract', click: 'onClick' };
var SCRIPT_MAX_CODE = 64 * 1024;
var scriptInstances = [];
var scriptConsoleEntries = [];
var scriptLineOffset = null;

var SCRIPT_TEMPLATES = {
  blank: { label: 'Empty script', code: "function onStart(ctx) {\n  ctx.log('Hello from', ctx.object.name);\n}\n\nfunction onUpdate(ctx, dt) {\n}\n" },
  spin: { label: 'Spin', code: "// Rotates this object around Y.\nconst SPEED = 1.5; // radians per second\n\nfunction onUpdate(ctx, dt) {\n  ctx.entity.rotationY += SPEED * dt;\n}\n" },
  bob: { label: 'Bob up and down', code: "// Floats gently up and down from where it started.\nconst HEIGHT = 0.4, SPEED = 2;\n\nfunction onStart(ctx) {\n  ctx.vars.baseY = ctx.position.y;\n}\n\nfunction onUpdate(ctx, dt) {\n  const p = ctx.position;\n  ctx.position = ctx.vec3(p.x, ctx.vars.baseY + Math.sin(ctx.time * SPEED) * HEIGHT, p.z);\n}\n" },
  follow: { label: 'Follow the player', code: "// Moves toward the player while they are within range.\nconst SPEED = 2.5, RANGE = 10;\n\nfunction onUpdate(ctx, dt) {\n  const target = ctx.player.position;\n  if (!target) return;\n  const p = ctx.position;\n  const dx = target.x - p.x, dz = target.z - p.z, dist = Math.hypot(dx, dz);\n  if (dist > RANGE || dist < 1.2) return;\n  ctx.position = ctx.vec3(p.x + dx / dist * SPEED * dt, p.y, p.z + dz / dist * SPEED * dt);\n  ctx.entity.rotationY = Math.atan2(dx, dz);\n}\n" },
  pickup: { label: 'Collect on touch (Trigger Volume)', code: "// Put this on a Trigger Volume. Counts pickups and wins at 3.\nfunction onTriggerEnter(ctx) {\n  const count = (ctx.game.state.pickups || 0) + 1;\n  ctx.game.state.pickups = count;\n  ctx.game.setObjective('Pickups: ' + count + ' / 3');\n  ctx.playSound(880, 0.12);\n  if (count >= 3) ctx.game.win();\n  ctx.destroy();\n}\n" },
  door: { label: 'Interact toggles visibility', code: "// Press Interact near this object to hide/show it (e.g. a simple door).\nfunction onInteract(ctx) {\n  ctx.entity.visible = !ctx.entity.visible;\n  ctx.entity.solid = ctx.entity.visible;\n  ctx.toast(ctx.entity.visible ? 'Closed' : 'Opened');\n}\n" },
};

function normalizeScriptRecord(script) {
  if (!script || typeof script !== 'object' || typeof script.code !== 'string') return null;
  return { version: 1, enabled: script.enabled !== false, code: script.code.slice(0, SCRIPT_MAX_CODE) };
}

// --- Runtime ---
// The frame of code created by `new Function`: "(eval at ..., <anonymous>:L:C)"
// in Chromium/Node. Other engines yield no line rather than a wrong one.
var SCRIPT_FRAME = /, <anonymous>:(\d+):\d+\)/;
function scriptUserLine(error) {
  if (scriptLineOffset === null) {
    try { new Function('ctx', '"use strict";\nthrow new Error("probe")')(); }
    catch (probe) { const m = SCRIPT_FRAME.exec(String(probe.stack || '')); scriptLineOffset = m ? Number(m[1]) - 2 : 2; }
  }
  const m = SCRIPT_FRAME.exec(String(error && error.stack || ''));
  if (!m) return null;
  const line = Number(m[1]) - scriptLineOffset - 1;
  return line >= 1 ? line : null;
}
function scriptLog(item, level, parts, line) {
  const text = parts.map(part => typeof part === 'string' ? part : (() => { try { return JSON.stringify(part); } catch (e) { return String(part); } })()).join(' ');
  scriptConsoleEntries.push({ time: typeof simElapsed === 'number' ? simElapsed : 0, owner: item ? itemDisplayName(item, placed.indexOf(item)) : 'Script', ownerId: item && item.id, level, text: text.slice(0, 500), line: line || null });
  if (scriptConsoleEntries.length > 200) scriptConsoleEntries.splice(0, scriptConsoleEntries.length - 200);
  if (level === 'error') setScriptConsoleVisible(true);
  renderScriptConsole();
}
function makeScriptContext(item) {
  const vars = {};
  const ctx = {
    get entity() { return item.entity; },
    object: { id: item.id, name: itemDisplayName(item, placed.indexOf(item)) },
    get position() { return item.entity.position.clone(); },
    set position(value) { if (value && [value.x, value.y, value.z].every(Number.isFinite)) item.entity.position = new Opus.Vec3(value.x, value.y, value.z); },
    vec3: (x = 0, y = 0, z = 0) => new Opus.Vec3(x, y, z),
    time: 0,
    dt: 0,
    vars,
    input: {
      isDown: (code) => !!app.input.isDown(code),
      wasPressed: (code) => !!app.input.wasPressed(code),
      action: (name) => !!inputActionDown(name),
    },
    player: {
      get entity() { return player && player.entity || null; },
      get position() { return player && player.entity ? player.entity.position.clone() : null; },
    },
    find: (nameOrId) => { const found = placed.find(p => p.name === nameOrId || p.id === nameOrId); return found ? found.entity : null; },
    game: {
      win: () => endGame('win'),
      lose: () => endGame('lose'),
      setObjective: (text) => setObjective(String(text)),
      get state() { window.__gameState = window.__gameState || {}; return window.__gameState; },
    },
    toast: (message) => showToast(String(message)),
    playSound: (frequency = 660, duration = 0.15) => executeAction('sound', { mode: 'synth', frequency, duration, waveform: 'sine' }, item),
    spawn: (prefabName, dx = 0, dz = 0) => executeAction('spawnPrefab', { prefabName, dx, dz }, item),
    destroy: () => { if (placed.includes(item)) removeItemFromScene(item); },
    log: (...parts) => scriptLog(item, 'log', parts),
    warn: (...parts) => scriptLog(item, 'warn', parts),
  };
  return ctx;
}
function compileScript(item) {
  const code = item.script.code;
  const exportsCode = '\n;return {' + SCRIPT_HOOKS.map(h => `${h}:typeof ${h}==="function"?${h}:null`).join(',') + '};';
  try { return new Function('ctx', '"use strict";\n' + code + exportsCode); }
  catch (error) { scriptLog(item, 'error', [`${error.name}: ${error.message}`], null); return null; }
}
function callScriptHook(instance, hook, ...args) {
  const fn = instance.hooks && instance.hooks[hook];
  if (!fn || instance.failed) return;
  try { fn(instance.ctx, ...args); }
  catch (error) {
    instance.failed = true; // one error stops this script until the next Play, instead of flooding every frame
    scriptLog(instance.item, 'error', [`${hook}: ${error && error.message || error}`], scriptUserLine(error));
  }
}
function startScripts() {
  stopScripts(false);
  const owners = placed.filter(item => item.script && item.script.enabled !== false && item.script.code && item.script.code.trim());
  if (!owners.length) return;
  if (!scriptsTrusted) { scriptLog(null, 'warn', ['Scripts are disabled for this loaded project. Review and enable scripts in the Project tab to run them.']); setScriptConsoleVisible(true); return; }
  for (const item of owners) {
    const factory = compileScript(item);
    if (!factory) continue;
    const ctx = makeScriptContext(item);
    let hooks = null;
    try { hooks = factory(ctx); }
    catch (error) { scriptLog(item, 'error', [`${error && error.message || error}`], scriptUserLine(error)); continue; }
    scriptInstances.push({ item, ctx, hooks, failed: false });
  }
  for (const instance of scriptInstances.slice()) callScriptHook(instance, 'onStart');
}
function updateScripts(dt) {
  if (!scriptInstances.length) return;
  for (const instance of scriptInstances.slice()) {
    if (!placed.includes(instance.item)) continue;
    instance.ctx.time += dt; instance.ctx.dt = dt;
    callScriptHook(instance, 'onUpdate', dt);
  }
}
function dispatchScriptHook(item, triggerType) {
  const hook = SCRIPT_TRIGGER_HOOKS[triggerType];
  if (!hook || !scriptInstances.length) return;
  for (const instance of scriptInstances) if (instance.item === item) callScriptHook(instance, hook);
}
function stopScripts(runOnStop = true) {
  if (runOnStop) for (const instance of scriptInstances.slice()) callScriptHook(instance, 'onStop');
  scriptInstances = [];
}

// --- Script Console (viewport overlay) ---
function ensureScriptConsole() {
  let panel = document.getElementById('script-console');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.id = 'script-console'; panel.hidden = true; panel.setAttribute('aria-label', 'Script console');
  panel.innerHTML = '<div class="script-console-head"><strong>Script Console</strong><span><button type="button" id="script-console-clear">Clear</button><button type="button" id="script-console-hide">Hide</button></span></div><div id="script-console-list" role="log" aria-live="polite"></div>';
  document.getElementById('viewport-wrap').appendChild(panel);
  panel.querySelector('#script-console-clear').onclick = () => { scriptConsoleEntries = []; renderScriptConsole(); };
  panel.querySelector('#script-console-hide').onclick = () => setScriptConsoleVisible(false);
  return panel;
}
function setScriptConsoleVisible(visible) {
  const panel = ensureScriptConsole();
  panel.hidden = !visible;
  const toggle = document.getElementById('script-console-toggle');
  if (toggle) toggle.checked = visible;
}
function renderScriptConsole() {
  const panel = ensureScriptConsole();
  const list = panel.querySelector('#script-console-list');
  list.innerHTML = scriptConsoleEntries.length ? scriptConsoleEntries.slice(-80).map(entry =>
    `<div class="script-console-entry script-console-${entry.level}"><span class="script-console-meta">${entry.time.toFixed(1)}s · ${escapeHtml(entry.owner)}${entry.line ? ' · line ' + entry.line : ''}</span> ${escapeHtml(entry.text)}</div>`).join('')
    : '<div class="script-console-entry script-console-empty">No script output yet. Use ctx.log(...) in a Script and press Play.</div>';
  list.scrollTop = list.scrollHeight;
}

// --- Code editor ---
var SCRIPT_KEYWORDS = new Set('const let var function return if else for while do break continue switch case default new typeof instanceof in of true false null undefined this class extends try catch finally throw async await'.split(' '));
var SCRIPT_API = new Set(['ctx', 'onStart', 'onUpdate', 'onTriggerEnter', 'onTriggerExit', 'onInteract', 'onClick', 'onStop', 'Math']);
function highlightScript(code) {
  const token = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let out = '', last = 0, m;
  while ((m = token.exec(code))) {
    out += escapeHtml(code.slice(last, m.index));
    const text = escapeHtml(m[0]);
    if (m[1]) out += `<span class="tok-comment">${text}</span>`;
    else if (m[2]) out += `<span class="tok-string">${text}</span>`;
    else if (m[3]) out += `<span class="tok-number">${text}</span>`;
    else if (SCRIPT_KEYWORDS.has(m[4])) out += `<span class="tok-keyword">${text}</span>`;
    else if (SCRIPT_API.has(m[4])) out += `<span class="tok-api">${text}</span>`;
    else out += text;
    last = token.lastIndex;
  }
  return out + escapeHtml(code.slice(last)) + '\n';
}
function scriptSyntaxCheck(code) {
  try { new Function('ctx', '"use strict";\n' + code); return null; }
  catch (error) { return `${error.name}: ${error.message}`; }
}
function ensureScriptEditor() {
  let modal = document.getElementById('script-editor-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'script-editor-modal'; modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', 'Script editor');
  const templates = Object.entries(SCRIPT_TEMPLATES).map(([id, t]) => `<option value="${id}">${escapeHtml(t.label)}</option>`).join('');
  modal.innerHTML = `<div class="script-editor-window">
    <div class="script-editor-head"><strong id="script-editor-title">Script</strong>
      <label>Template <select id="script-editor-template"><option value="">Insert template…</option>${templates}</select></label>
      <button type="button" id="script-editor-api-btn">API reference</button>
      <span class="script-editor-spacer"></span>
      <button type="button" id="script-editor-cancel">Cancel</button><button type="button" id="script-editor-apply" class="script-editor-primary">Apply</button></div>
    <div class="script-editor-body"><div class="script-editor-gutter" id="script-editor-gutter"></div>
      <div class="script-editor-code"><pre id="script-editor-highlight" aria-hidden="true"></pre><textarea id="script-editor-text" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Script code"></textarea></div>
      <aside id="script-editor-api" hidden>${SCRIPT_API_REFERENCE_HTML}</aside></div>
    <div class="script-editor-status" id="script-editor-status" role="status"></div></div>`;
  document.body.appendChild(modal);
  const text = modal.querySelector('#script-editor-text');
  const refresh = () => {
    modal.querySelector('#script-editor-highlight').innerHTML = highlightScript(text.value);
    const lines = text.value.split('\n').length;
    modal.querySelector('#script-editor-gutter').innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
    const issue = scriptSyntaxCheck(text.value);
    const status = modal.querySelector('#script-editor-status');
    status.textContent = issue ? issue : `${lines} lines · no syntax errors`;
    status.classList.toggle('script-editor-error', !!issue);
  };
  const syncScroll = () => {
    modal.querySelector('#script-editor-highlight').scrollTop = text.scrollTop; modal.querySelector('#script-editor-highlight').scrollLeft = text.scrollLeft;
    modal.querySelector('#script-editor-gutter').scrollTop = text.scrollTop;
  };
  text.addEventListener('input', refresh);
  text.addEventListener('scroll', syncScroll);
  text.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') { event.preventDefault(); const s = text.selectionStart, e = text.selectionEnd; text.setRangeText('  ', s, e, 'end'); refresh(); }
    else if (event.key === 'Escape') { event.preventDefault(); closeScriptEditor(false); }
    else if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); closeScriptEditor(true); }
    event.stopPropagation(); // editor shortcuts (W/E/R, Delete, Ctrl+Z) must not fire while typing
  });
  modal.querySelector('#script-editor-template').onchange = (event) => {
    const t = SCRIPT_TEMPLATES[event.target.value]; event.target.value = '';
    if (!t) return;
    if (text.value.trim() && !window.confirm('Replace the current script with this template?')) return;
    text.value = t.code; refresh(); text.focus();
  };
  modal.querySelector('#script-editor-api-btn').onclick = () => { const aside = modal.querySelector('#script-editor-api'); aside.hidden = !aside.hidden; };
  modal.querySelector('#script-editor-cancel').onclick = () => closeScriptEditor(false);
  modal.querySelector('#script-editor-apply').onclick = () => closeScriptEditor(true);
  modal._refresh = refresh;
  return modal;
}
var scriptEditorTarget = null;
function openScriptEditor(item) {
  if (!item) return;
  if (playMode) { showStatus('Stop Play before editing a Script'); return; }
  const modal = ensureScriptEditor();
  scriptEditorTarget = item;
  modal.querySelector('#script-editor-title').textContent = `Script · ${itemDisplayName(item, placed.indexOf(item))}`;
  const text = modal.querySelector('#script-editor-text');
  text.value = item.script ? item.script.code : SCRIPT_TEMPLATES.blank.code;
  modal.hidden = false; modal._refresh(); text.focus();
}
function closeScriptEditor(apply) {
  const modal = ensureScriptEditor();
  const item = scriptEditorTarget;
  if (apply && item && placed.includes(item)) {
    const code = modal.querySelector('#script-editor-text').value.slice(0, SCRIPT_MAX_CODE);
    const before = item.script ? item.script.code : null;
    if (code !== before) {
      // Code you write yourself in a document that held no other code is
      // yours to run. If the document already contained code (for example an
      // imported project), permission still needs the Project review.
      const authoredFromScratch = !scriptsTrusted && !projectHasScripts(serializeProject());
      pushUndo();
      item.script = { version: 1, enabled: item.script ? item.script.enabled !== false : true, code };
      if (authoredFromScratch) { scriptsTrusted = true; scriptTrustRevoked = false; scriptTrustSeen = true; renderScriptTrustControls(); }
      showStatus(`Script saved on ${item.name || item.id}${scriptsTrusted ? '' : ' · enable scripts in the Project tab to run it'} · Undo restores the previous version`);
    }
  }
  modal.hidden = true; scriptEditorTarget = null;
  if (selectedItem === item) renderInspector();
}

// --- Inspector section ---
function mountScriptInspectorSection() {
  if (!selectedItem || selectedItems.size > 1 || !['cube', 'sprite'].includes(selectedItem.kind)) return;
  if (inspectorBody.querySelector('[data-script-section]')) return;
  const item = selectedItem, script = item.script;
  const row = document.createElement('div');
  row.className = 'field-row'; row.dataset.scriptSection = 'true';
  const hooks = script ? SCRIPT_HOOKS.filter(h => new RegExp('function\\s+' + h + '\\s*\\(').test(script.code)) : [];
  const issue = script ? scriptSyntaxCheck(script.code) : null;
  row.innerHTML = `<label>Script</label>
    ${script ? `<label class="script-enable"><input type="checkbox" data-script-enabled${script.enabled !== false ? ' checked' : ''}> Enabled</label>
    <p class="script-summary">${issue ? `<span class="script-summary-error">${escapeHtml(issue)}</span>` : hooks.length ? 'Hooks: ' + hooks.map(escapeHtml).join(', ') : 'No hooks defined yet'}</p>` : '<p class="script-summary">Optional code for this object: onStart, onUpdate, onTriggerEnter, onInteract and more.</p>'}
    <div class="field-triple"><button type="button" class="toolbar-btn" data-script-open>${script ? 'Edit Script' : '＋ Add Script'}</button>${script ? '<button type="button" class="toolbar-btn" data-script-remove>Remove</button>' : ''}</div>`;
  const behaviors = [...inspectorBody.children].find(el => el.classList.contains('field-row') && el.firstElementChild && el.firstElementChild.textContent.trim() === 'Behaviors');
  if (behaviors) behaviors.after(row); else inspectorBody.appendChild(row);
  row.querySelector('[data-script-open]').onclick = () => openScriptEditor(item);
  const remove = row.querySelector('[data-script-remove]');
  if (remove) remove.onclick = () => { if (playMode) { showStatus('Stop Play before changing a Script'); return; } pushUndo(); delete item.script; renderInspector(); showStatus('Script removed · Undo restores it'); };
  const enabled = row.querySelector('[data-script-enabled]');
  if (enabled) enabled.onchange = () => { pushUndo(); item.script = { ...item.script, enabled: enabled.checked }; renderInspector(); };
}

var SCRIPT_API_REFERENCE_HTML = `<h3>Script API</h3>
<p>Define any of these functions; each receives <code>ctx</code>.</p>
<ul><li><code>onStart(ctx)</code> once at Play</li><li><code>onUpdate(ctx, dt)</code> every frame</li><li><code>onTriggerEnter(ctx)</code> / <code>onTriggerExit(ctx)</code> on Trigger Volumes</li><li><code>onInteract(ctx)</code> player presses Interact nearby</li><li><code>onClick(ctx)</code> object clicked in Play</li><li><code>onStop(ctx)</code> Play stops</li></ul>
<h4>ctx</h4><ul>
<li><code>ctx.entity</code>: rotationY, scale, visible, solid, color</li>
<li><code>ctx.position</code> get/set · <code>ctx.vec3(x, y, z)</code></li>
<li><code>ctx.time</code>, <code>ctx.dt</code>, <code>ctx.vars</code> (per-object storage)</li>
<li><code>ctx.input.action('jump')</code>, <code>.isDown('KeyE')</code>, <code>.wasPressed('Space')</code></li>
<li><code>ctx.player.position</code>, <code>ctx.player.entity</code></li>
<li><code>ctx.find('Name')</code> another object's entity</li>
<li><code>ctx.game.win()</code>, <code>.lose()</code>, <code>.setObjective(text)</code>, <code>.state</code></li>
<li><code>ctx.toast(text)</code>, <code>ctx.playSound(hz, seconds)</code></li>
<li><code>ctx.spawn('Prefab', dx, dz)</code>, <code>ctx.destroy()</code></li>
<li><code>ctx.log(...)</code>, <code>ctx.warn(...)</code> to the Script Console</li></ul>
<p>Scripts run only in Play and only after you trust the project's scripts (Project tab).</p>`;

// Script Console toggle lives in the viewport View menu.
(function mountScriptConsoleToggle() {
  const menu = document.getElementById('viewport-debug-menu-items');
  if (!menu || document.getElementById('script-console-toggle')) return;
  const label = document.createElement('label');
  label.title = 'Script logs and errors with object and line. Session only.';
  label.innerHTML = '<input type="checkbox" id="script-console-toggle"> Script console';
  menu.appendChild(label);
  label.querySelector('input').onchange = (event) => { setScriptConsoleVisible(event.target.checked); renderScriptConsole(); };
})();
