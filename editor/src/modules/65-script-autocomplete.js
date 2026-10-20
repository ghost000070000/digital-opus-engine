// ===== Script editor autocomplete =====
// Suggestions while typing in the Script editor: members after `ctx.`,
// `ctx.entity.`, `ctx.input.`, `ctx.game.`, `ctx.player.` and vectors
// (also through variables like `const p = ctx.position`), and lifecycle hooks
// after `function `. Arrow keys choose, Enter/Tab insert, Esc closes,
// Ctrl+Space opens the list on demand.

const SCRIPT_COMPLETIONS = {
  ctx: [
    ['entity', 'This object in the engine: position, rotationY, scale, visible, solid, color', 'entity'],
    ['object', 'This object\'s id and name', 'object'],
    ['position', 'A copy of this object\'s position; assign a vector to move it', 'vec'],
    ['vec3', 'Make a vector', null, '(x, y, z)'],
    ['velocity', 'Physics Object speed and direction; assign a vector to change it', 'vec'],
    ['kick', 'Push a Physics Object: adds to its velocity', null, '(x, y, z)'],
    ['time', 'Seconds since Play started'],
    ['dt', 'Seconds since the last frame'],
    ['vars', 'Your own values for this object, kept between frames'],
    ['input', 'Keyboard and Input Actions', 'input'],
    ['player', 'The player character', 'player'],
    ['find', 'Find another object\'s entity by name or id', 'entity', '(name)'],
    ['game', 'Win, lose, objective and shared game state', 'game'],
    ['toast', 'Show a short message on screen', null, '(message)'],
    ['playSound', 'Play a simple beep', null, '(frequency, duration)'],
    ['spawn', 'Place a copy of a Prefab next to this object', null, '(prefabName, dx, dz)'],
    ['destroy', 'Remove this object', null, '()'],
    ['log', 'Write to the Script Console', null, '(...values)'],
    ['warn', 'Write a warning to the Script Console', null, '(...values)'],
  ],
  entity: [
    ['position', 'Position vector (x, y, z)', 'vec'],
    ['rotationY', 'Turn around the vertical axis, in radians'],
    ['scale', 'Size vector (x, y, z)', 'vec'],
    ['visible', 'Shown or hidden (true / false)'],
    ['solid', 'Blocks the player (true / false)'],
    ['color', 'Colour as [r, g, b] from 0 to 1'],
    ['forward', 'Direction the object faces', 'vec'],
  ],
  object: [['id', 'Stable object id'], ['name', 'Name shown in the Hierarchy']],
  input: [
    ['isDown', 'Is a key held? e.g. isDown(\'KeyE\')', null, '(code)'],
    ['wasPressed', 'Was a key pressed this frame?', null, '(code)'],
    ['action', 'Is an Input Action held? e.g. action(\'jump\')', null, '(name)'],
  ],
  player: [['entity', 'The player\'s entity (null before spawn)', 'entity'], ['position', 'A copy of the player\'s position (null before spawn)', 'vec']],
  game: [
    ['win', 'Win the game', null, '()'],
    ['lose', 'Lose the game', null, '()'],
    ['setObjective', 'Show an objective line', null, '(text)'],
    ['state', 'Shared counters and values for the whole game'],
  ],
  vec: [
    ['x', 'Left / right'], ['y', 'Up / down'], ['z', 'Forward / back'],
    ['add', 'Sum of two vectors', 'vec', '(other)'], ['sub', 'Difference of two vectors', 'vec', '(other)'],
    ['scale', 'Multiply by a number', 'vec', '(amount)'], ['length', 'Length of the vector', null, '()'],
    ['normalize', 'Same direction, length 1', 'vec', '()'], ['clone', 'An independent copy', 'vec', '()'],
  ],
};
const SCRIPT_HOOK_SNIPPETS = [
  ['onStart', 'Once when Play starts', '(ctx) {\n  \n}'],
  ['onUpdate', 'Every frame; dt is seconds since the last one', '(ctx, dt) {\n  \n}'],
  ['onTriggerEnter', 'The player enters this Trigger Volume', '(ctx) {\n  \n}'],
  ['onTriggerExit', 'The player leaves this Trigger Volume', '(ctx) {\n  \n}'],
  ['onInteract', 'The player presses Interact nearby', '(ctx) {\n  \n}'],
  ['onClick', 'This object is clicked in Play', '(ctx) {\n  \n}'],
  ['onStop', 'Play stops', '(ctx) {\n  \n}'],
  ['onObjectEnter', 'A Physics Object arrives in or on this object', '(ctx) {\n  \n}'],
  ['onObjectExit', 'The last Physics Object leaves this object', '(ctx) {\n  \n}'],
];

// What type does an expression like `ctx.player.position` have? null = unknown.
function scriptExpressionType(expr, code, depth = 0) {
  const parts = expr.replace(/\([^()]*\)/g, '').split('.').filter(Boolean);
  if (!parts.length || depth > 4) return null;
  let type;
  if (parts[0] === 'ctx') type = 'ctx';
  else {
    const declared = new RegExp(`(?:const|let|var)\\s+${parts[0].replace(/[$]/g, '\\$')}\\s*=\\s*([\\w$.]+(?:\\([^()]*\\))?(?:\\.[\\w$]+(?:\\([^()]*\\))?)*)`).exec(code);
    if (!declared) return null;
    type = scriptExpressionType(declared[1], code, depth + 1);
    if (/^ctx\.vec3\(/.test(declared[1])) type = 'vec';
  }
  for (const member of parts.slice(1)) {
    const entry = (SCRIPT_COMPLETIONS[type] || []).find((m) => m[0] === member);
    if (!entry) return null;
    type = entry[2] || null;
    if (!type) return null;
  }
  return type;
}
// Suggestions for the text before the caret: { from, items: [{ label, detail, insert, caretBack }] } or null.
function scriptCompletionsAt(code, caret, force = false) {
  const before = code.slice(0, caret);
  const member = /([A-Za-z_$][\w$]*(?:\([^()]*\))?(?:\.[A-Za-z_$][\w$]*(?:\([^()]*\))?)*)\.([A-Za-z_$][\w$]*)?$/.exec(before);
  if (member) {
    const type = scriptExpressionType(member[1], code);
    const partial = member[2] || '';
    const list = type && SCRIPT_COMPLETIONS[type];
    if (!list) return null;
    const items = list.filter((m) => m[0].toLowerCase().startsWith(partial.toLowerCase()))
      .map(([name, detail, , params]) => ({ label: params ? `${name}${params}` : name, detail, insert: params ? `${name}()` : name, caretBack: params && params !== '()' ? 1 : 0 }));
    return items.length ? { from: caret - partial.length, items } : null;
  }
  const hook = /function\s+([A-Za-z]*)$/.exec(before);
  if (hook && (force || hook[1].length >= 1 || /function\s+$/.test(before))) {
    const declared = new Set([...code.matchAll(/function\s+(on[A-Za-z]+)\s*\(/g)].map((m) => m[1]));
    const items = SCRIPT_HOOK_SNIPPETS.filter(([name]) => name.toLowerCase().startsWith(hook[1].toLowerCase()) && !declared.has(name))
      .map(([name, detail, body]) => ({ label: name, detail, insert: name + body, caretBack: 2 }));
    return items.length ? { from: caret - hook[1].length, items } : null;
  }
  if (force) {
    const word = /([A-Za-z_$][\w$]*)$/.exec(before);
    const partial = word ? word[1] : '';
    if ('ctx'.startsWith(partial)) return { from: caret - partial.length, items: [{ label: 'ctx', detail: 'Everything about this object and the game', insert: 'ctx', caretBack: 0 }] };
  }
  return null;
}

// Enter keeps the current line's indentation, one level deeper after '{'.
function scriptNewlineIndent(code, caret) {
  const line = code.slice(code.lastIndexOf('\n', caret - 1) + 1, caret);
  const indent = /^[ \t]*/.exec(line)[0];
  return '\n' + indent + (/[{[(]\s*$/.test(line) ? '  ' : '');
}

// --- Popup ---
let scriptComplete = null; // { text, popup, from, items, index }
function closeScriptCompletions() { scriptComplete?.popup.remove(); scriptComplete = null; }
function scriptCaretPoint(text) {
  const style = getComputedStyle(text);
  const lines = text.value.slice(0, text.selectionStart).split('\n');
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${style.fontSize} ${style.fontFamily}`;
  const charWidth = probe.measureText('M').width || 8;
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
  const box = text.getBoundingClientRect();
  return {
    x: box.left + parseFloat(style.paddingLeft) + lines[lines.length - 1].length * charWidth - text.scrollLeft,
    y: box.top + parseFloat(style.paddingTop) + lines.length * lineHeight - text.scrollTop + 2,
  };
}
function showScriptCompletions(text, force = false) {
  const result = scriptCompletionsAt(text.value, text.selectionStart, force);
  if (!result) { closeScriptCompletions(); return; }
  if (!scriptComplete) {
    const popup = document.createElement('div');
    popup.className = 'script-complete';
    popup.setAttribute('role', 'listbox');
    popup.addEventListener('mousedown', (event) => {
      event.preventDefault(); // keep the textarea focused
      const row = event.target.closest('[data-complete-index]');
      if (row && scriptComplete) { scriptComplete.index = Number(row.dataset.completeIndex); acceptScriptCompletion(); }
    });
    document.body.appendChild(popup);
    scriptComplete = { text, popup, index: 0 };
  }
  scriptComplete.from = result.from;
  scriptComplete.items = result.items;
  scriptComplete.index = Math.min(scriptComplete.index, result.items.length - 1);
  renderScriptCompletions();
  const at = scriptCaretPoint(text);
  scriptComplete.popup.style.left = `${Math.min(at.x, window.innerWidth - 340)}px`;
  scriptComplete.popup.style.top = `${Math.min(at.y, window.innerHeight - 220)}px`;
}
function renderScriptCompletions() {
  const { popup, items, index } = scriptComplete;
  popup.innerHTML = items.map((item, i) => `<div class="script-complete-row${i === index ? ' active' : ''}" role="option" aria-selected="${i === index}" data-complete-index="${i}"><code>${escapeHtml(item.label)}</code><span>${escapeHtml(item.detail || '')}</span></div>`).join('');
  popup.querySelector('.active')?.scrollIntoView?.({ block: 'nearest' });
}
function acceptScriptCompletion() {
  const { text, from, items, index } = scriptComplete;
  const item = items[index];
  closeScriptCompletions();
  if (!item) return;
  text.setRangeText(item.insert, from, text.selectionStart, 'end');
  const caret = text.selectionStart - item.caretBack;
  text.setSelectionRange(caret, caret);
  text.dispatchEvent(new Event('input', { bubbles: true })); // refresh highlighting and checks
}

// Capture phase: runs before the editor's own Tab / Escape handling.
document.addEventListener('keydown', (event) => {
  const text = event.target;
  if (!text || text.id !== 'script-editor-text') return;
  if ((event.ctrlKey || event.metaKey) && event.code === 'Space') { event.preventDefault(); event.stopPropagation(); showScriptCompletions(text, true); return; }
  if (!scriptComplete) {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); event.stopPropagation();
      const insert = scriptNewlineIndent(text.value, text.selectionStart);
      text.setRangeText(insert, text.selectionStart, text.selectionEnd, 'end');
      text.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault(); event.stopPropagation();
    const n = scriptComplete.items.length;
    scriptComplete.index = (scriptComplete.index + (event.key === 'ArrowDown' ? 1 : n - 1)) % n;
    renderScriptCompletions();
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault(); event.stopPropagation();
    acceptScriptCompletion();
  } else if (event.key === 'Escape') {
    event.preventDefault(); event.stopPropagation(); // close the list, not the editor
    closeScriptCompletions();
  }
}, true);
document.addEventListener('input', (event) => {
  const text = event.target;
  if (!text || text.id !== 'script-editor-text' || event.inputType === undefined) return; // our own inserts carry no inputType
  const typed = event.data || '';
  if (scriptComplete || typed === '.' || /[A-Za-z_$ ]/.test(typed)) showScriptCompletions(text);
});
document.addEventListener('click', (event) => { if (scriptComplete && !scriptComplete.popup.contains(event.target)) closeScriptCompletions(); }, true);
document.addEventListener('focusout', (event) => { if (scriptComplete && event.target === scriptComplete.text) setTimeout(() => { if (scriptComplete && document.activeElement !== scriptComplete.text) closeScriptCompletions(); }, 0); });
