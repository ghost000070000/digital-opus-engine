// --- Visual logic: Variables panel and live graph debugging ---
// One place to see every named piece of game state across the project:
// Counters, Flags and Timers (named in Actions/Conditions), Graph variables
// (Local/Object/Game scope) and Object Variables. Find shows every use; Rename
// rewrites every use in one Undo step; Play shows live values. Graph editors
// can also "Play & watch": the graph docks beside the running game, nodes
// flash as they run and a Watch box shows the values that graph uses.

var VARIABLE_FIELD_LABELS = { 'Counter name': 'counter', 'Flag name': 'flag', 'Timer name': 'timer' };
var VARIABLE_KINDS = {
  counter: { label: 'Counter', badge: '#' },
  flag: { label: 'Flag', badge: '⚑' },
  timer: { label: 'Timer', badge: '⏱' },
  'graph-game': { label: 'Game variable', badge: 'G' },
  'graph-object': { label: 'Object variable (Graph)', badge: 'O' },
  'graph-local': { label: 'Local variable', badge: 'L' },
  object: { label: 'Object Variable', badge: 'O' },
};

function variableFieldKind(field) {
  if (!field || field.type !== 'text') return null;
  return VARIABLE_FIELD_LABELS[field.label] || VARIABLE_FIELD_LABELS[field.placeholder] || null;
}
function variableDefinitionFor(id) {
  if (typeof id !== 'string') return null;
  for (const registry of [ACTION_TYPES, CONDITION_TYPES, GRAPH_NODE_TYPES]) if (registry && Object.prototype.hasOwnProperty.call(registry, id)) return registry[id];
  return null;
}
// Every place named state can be authored, per level. The current level reads
// live objects; other levels read their stored records.
function variableOwnerRoots() {
  const roots = [];
  levels.forEach((level, index) => {
    const current = index === currentLevelIndex;
    const levelName = (level && level.name) || `Level ${index + 1}`;
    const objects = current ? placed.filter((p) => p && ['cube', 'sprite'].includes(p.kind)) : (level && Array.isArray(level.objects) ? level.objects : []);
    objects.forEach((owner, i) => roots.push({ levelIndex: index, levelName, current, owner, ownerLabel: current ? itemDisplayName(owner, placed.indexOf(owner)) : (owner.name || owner.id || `Object ${i + 1}`), records: owner.behaviors || [] }));
    const sequences = current ? currentSequences : level && level.sequences;
    if (Array.isArray(sequences) && sequences.length) roots.push({ levelIndex: index, levelName, current, owner: null, ownerLabel: 'Sequences', records: sequences });
    const hud = current ? currentUiConfig && currentUiConfig.hudElements : level && level.ui && level.ui.hudElements;
    if (Array.isArray(hud) && hud.length) roots.push({ levelIndex: index, levelName, current, owner: null, ownerLabel: 'HUD', hud });
  });
  return roots;
}
// Calls visit(entry) for every named-state reference. entry.set(newName) rewrites it.
function walkProjectVariables(visit) {
  for (const root of variableOwnerRoots()) {
    const base = { levelIndex: root.levelIndex, levelName: root.levelName, current: root.current, owner: root.owner, ownerLabel: root.ownerLabel };
    if (root.hud) {
      for (const element of root.hud) {
        const binding = element && element.binding;
        if (!binding || typeof binding.name !== 'string' || !binding.name) continue;
        const kind = binding.source === 'counter' ? 'counter' : binding.source === 'timer' ? 'timer' : binding.source === 'gameVariable' ? 'graph-game' : null;
        if (kind) visit({ ...base, kind, name: binding.name, where: 'HUD binding', set: (next) => { binding.name = next; } });
      }
      continue;
    }
    if (root.owner && root.owner.variables && typeof root.owner.variables === 'object' && !Array.isArray(root.owner.variables)) {
      for (const key of Object.keys(root.owner.variables)) visit({ ...base, kind: 'object', name: key, where: 'Object Variable', declaration: true, set: null });
    }
    const seen = new Set(), stack = [root.records];
    let scanned = 0;
    while (stack.length && scanned++ < 20000) {
      const record = stack.pop();
      if (!record || typeof record !== 'object' || seen.has(record)) continue;
      seen.add(record);
      if (Array.isArray(record.nodes) && Array.isArray(record.variables)) {
        const graph = record;
        for (const v of graph.variables) {
          if (!v || typeof v.name !== 'string' || !v.name) continue;
          const kind = v.scope === 'game' ? 'graph-game' : v.scope === 'object' ? 'graph-object' : 'graph-local';
          visit({ ...base, kind, name: v.name, where: 'Graph variable', declaration: true, graph, definition: v, set: (next) => { v.name = next; } });
        }
      }
      const definition = variableDefinitionFor(record.action || record.actionType || record.type);
      if (definition) {
        const values = record.params && typeof record.params === 'object' && !Array.isArray(record.params) ? record.params : record;
        for (const field of definition.fields || []) {
          const kind = variableFieldKind(field);
          if (!kind) continue;
          const name = values[field.key];
          if (typeof name === 'string' && name) visit({ ...base, kind, name, where: definition.label || record.type || record.action, set: (next) => { values[field.key] = next; } });
        }
      }
      for (const key of Object.keys(record)) { const child = record[key]; if (child && typeof child === 'object') stack.push(child); }
    }
  }
}
// Object-scope Graph variables and Object Variables share item.variables keys,
// so they are one name space for listing and renaming.
function variableGroupKey(kind, name) { return (kind === 'graph-object' ? 'object' : kind) + '\|' + name; }
function collectProjectVariables() {
  const groups = new Map();
  walkProjectVariables((entry) => {
    const key = entry.kind === 'graph-local' ? 'graph-local\|' + entry.name + '\|' + entry.levelIndex + '\|' + entry.ownerLabel : variableGroupKey(entry.kind, entry.name);
    if (!groups.has(key)) groups.set(key, { key, kind: entry.kind === 'graph-object' ? 'object' : entry.kind, name: entry.name, uses: [] });
    groups.get(key).uses.push(entry);
  });
  return [...groups.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}
function liveVariableValue(group) {
  if (!playMode) return null;
  if (group.kind === 'counter' || group.kind === 'graph-game') { const v = window.__gameState && window.__gameState[group.name]; return v === undefined ? '—' : JSON.stringify(v); }
  if (group.kind === 'flag') return window.__gameFlags && window.__gameFlags[group.name] ? 'true' : 'false';
  if (group.kind === 'timer') { const t = window.__gameTimers && window.__gameTimers[group.name]; return t ? t.elapsed.toFixed(1) + 's' + (t.finished ? ' ✓' : t.running ? ' ▶' : '') : '—'; }
  if (group.kind === 'object') { const owners = group.uses.filter((u) => u.current && u.owner && u.owner.variables && Object.prototype.hasOwnProperty.call(u.owner.variables, group.name)); return owners.length === 1 ? JSON.stringify(owners[0].owner.variables[group.name]) : owners.length ? owners.length + ' objects' : '—'; }
  return null;
}
// Rename every use of one named variable. Returns the number of rewritten references.
function renameProjectVariable(group, nextName) {
  const name = typeof nextName === 'string' ? nextName.trim() : '';
  if (!name || name.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(name)) return { ok: false, reason: 'Use a name of 1–128 characters.' };
  if (name === group.name) return { ok: false, reason: 'That is already its name.' };
  if (playMode) return { ok: false, reason: 'Stop Play before renaming.' };
  const targetKey = group.kind === 'graph-local' ? null : variableGroupKey(group.kind, name);
  const collision = targetKey && collectProjectVariables().some((g) => g.key === targetKey);
  pushUndo();
  let count = 0;
  if (group.kind === 'graph-local') {
    for (const use of group.uses) if (use.set) { use.set(name); count++; }
  } else {
    walkProjectVariables((entry) => {
      if (variableGroupKey(entry.kind, entry.name) !== group.key) return;
      if (entry.set) { entry.set(name); count++; }
    });
    if (group.kind === 'object') {
      // Object Variables are keyed maps on live objects and stored records.
      const renameKey = (map) => { if (map && Object.prototype.hasOwnProperty.call(map, group.name)) { if (!Object.prototype.hasOwnProperty.call(map, name)) map[name] = map[group.name]; delete map[group.name]; count++; } };
      for (const item of placed) { renameKey(item.variables); renameKey(item._authoredVariables); }
      levels.forEach((level, index) => { if (index !== currentLevelIndex) for (const record of (level && level.objects) || []) renameKey(record && record.variables); });
    }
  }
  const scriptMentions = placed.some((item) => (item.script && item.script.code.includes(group.name)) || (item.behaviors || []).some((b) => typeof (b.params && b.params.code) === 'string' && b.params.code.includes(group.name)));
  return { ok: true, count, merged: !!collision, scriptMentions };
}

// --- Variables section (Project tab) ---
var variablesPanelExpanded = new Set();
var variablesPanelRenaming = null;
function ensureVariablesPanel() {
  let section = document.getElementById('variables-panel');
  if (section) return section;
  const tab = document.getElementById('right-tab-project');
  if (!tab) return null;
  section = document.createElement('section');
  section.id = 'variables-panel';
  section.setAttribute('aria-label', 'Variables');
  section.innerHTML = `<div class="variables-head"><strong>Variables</strong><button type="button" id="variables-refresh" title="Rescan the project">↻</button></div>
    <input type="search" id="variables-search" placeholder="Filter variables…" aria-label="Filter variables">
    <div id="variables-list" role="list"></div>
    <p class="field-help" id="variables-status">Every Counter, Flag, Timer, Graph variable and Object Variable in this project. Rename updates every use on every level in one Undo step. Live values appear during Play.</p>`;
  tab.prepend(section);
  section.querySelector('#variables-refresh').onclick = renderVariablesPanel;
  section.querySelector('#variables-search').addEventListener('input', renderVariablesPanel);
  section.querySelector('#variables-list').addEventListener('click', onVariablesPanelClick);
  section.querySelector('#variables-list').addEventListener('keydown', (event) => {
    if (!event.target.matches('[data-variable-rename-input]')) return;
    if (event.key === 'Enter') { event.preventDefault(); commitVariableRename(event.target); }
    else if (event.key === 'Escape') { variablesPanelRenaming = null; renderVariablesPanel(); }
    event.stopPropagation();
  });
  return section;
}
function renderVariablesPanel() {
  const section = ensureVariablesPanel();
  if (!section) return;
  const query = section.querySelector('#variables-search').value.trim().toLowerCase();
  const groups = collectProjectVariables().filter((g) => !query || g.name.toLowerCase().includes(query) || VARIABLE_KINDS[g.kind].label.toLowerCase().includes(query));
  const list = section.querySelector('#variables-list');
  if (!groups.length) { list.innerHTML = `<p class="field-help">${query ? 'No variables match.' : 'No named variables yet. Counters, Flags, Timers and Graph variables appear here as soon as an Action, Condition or Graph uses them.'}</p>`; return; }
  list.innerHTML = groups.map((g) => {
    const kind = VARIABLE_KINDS[g.kind], live = liveVariableValue(g), open = variablesPanelExpanded.has(g.key), renaming = variablesPanelRenaming === g.key;
    const usesCount = g.uses.filter((u) => !u.declaration).length;
    const where = g.uses.map((u, i) => `<li>${u.current && u.owner ? `<button type="button" class="variables-owner" data-variable-select="${escapeHtml(g.key)}" data-use-index="${i}">${escapeHtml(u.ownerLabel)}</button>` : escapeHtml(u.ownerLabel)} · ${escapeHtml(u.where)}${levels.length > 1 ? ' · ' + escapeHtml(u.levelName) : ''}</li>`).join('');
    return `<div class="variables-row" role="listitem" data-variable-key="${escapeHtml(g.key)}">
      <div class="variables-line"><span class="variables-badge" title="${escapeHtml(kind.label)}">${kind.badge}</span>
      ${renaming ? `<input data-variable-rename-input data-variable-key="${escapeHtml(g.key)}" value="${escapeHtml(g.name)}" aria-label="New name for ${escapeHtml(g.name)}" maxlength="128">` : `<span class="variables-name">${escapeHtml(g.name)}</span>`}
      ${live !== null ? `<span class="variables-live" title="Live value">${escapeHtml(live)}</span>` : `<span class="variables-uses">${usesCount} use${usesCount === 1 ? '' : 's'}</span>`}
      ${renaming ? `<button type="button" data-variable-rename-save="${escapeHtml(g.key)}">Save</button>` : `<button type="button" data-variable-find="${escapeHtml(g.key)}" aria-expanded="${open}">Find</button><button type="button" data-variable-rename="${escapeHtml(g.key)}">Rename</button>`}</div>
      ${open ? `<ul class="variables-uses-list">${where}</ul>` : ''}</div>`;
  }).join('');
  const input = list.querySelector('[data-variable-rename-input]');
  if (input) { input.focus(); input.select(); }
}
function onVariablesPanelClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.variableFind) { const key = button.dataset.variableFind; if (variablesPanelExpanded.has(key)) variablesPanelExpanded.delete(key); else variablesPanelExpanded.add(key); renderVariablesPanel(); }
  else if (button.dataset.variableRename) { if (playMode) { showStatus('Stop Play before renaming'); return; } variablesPanelRenaming = button.dataset.variableRename; renderVariablesPanel(); }
  else if (button.dataset.variableRenameSave) commitVariableRename(button.closest('.variables-row').querySelector('[data-variable-rename-input]'));
  else if (button.dataset.variableSelect) {
    const group = collectProjectVariables().find((g) => g.key === button.dataset.variableSelect);
    const use = group && group.uses[Number(button.dataset.useIndex)];
    if (use && use.owner && placed.includes(use.owner)) { selectItem(use.owner); activateTab('right-tab', 'inspector'); }
  }
}
function commitVariableRename(input) {
  if (!input) return;
  const group = collectProjectVariables().find((g) => g.key === input.dataset.variableKey);
  if (!group) { variablesPanelRenaming = null; renderVariablesPanel(); return; }
  const result = renameProjectVariable(group, input.value);
  if (!result.ok) { showStatus(result.reason); return; }
  variablesPanelRenaming = null;
  renderVariablesPanel();
  if (selectedItem) renderInspector();
  showStatus(`Renamed ${group.name} → ${input.value.trim()} · ${result.count} reference${result.count === 1 ? '' : 's'} updated${result.merged ? ' (merged with an existing variable)' : ''}${result.scriptMentions ? ' · scripts that mention the old name were not changed' : ''} · Undo restores`);
}
(function mountVariablesPanel() {
  if (window.__OPUS_EMBEDDED_PROJECT__) return;
  const tabButton = document.querySelector('[data-right-tab="project"]');
  if (tabButton) tabButton.addEventListener('click', () => renderVariablesPanel());
  ensureVariablesPanel();
  // Live values while playing, only when the panel is on screen.
  setInterval(() => { const section = document.getElementById('variables-panel'); if (playMode && section && section.offsetParent && !variablesPanelRenaming) renderVariablesPanel(); }, 500);
})();

// --- Live graph debugging ---
var graphWatchTimer = null;
// Called by runGraph for each node it reaches. Flashes the node when the open
// graph editor is watching this exact authored graph on this object.
function graphDebugPulse(graph, item, nodeId, outcome) {
  const state = graphEditorState;
  if (!state || !state.watching || state.item !== item || !state.existingBehavior || state.existingBehavior.graph !== graph) return;
  const el = nodeId === 'start' ? document.querySelector('#graph-modal .graph-node-start') : document.querySelector(`#graph-modal [data-node-id="${CSS.escape(String(nodeId))}"]`);
  if (!el) return;
  const cls = outcome === 'false' ? 'graph-node-pulse-false' : 'graph-node-pulse';
  el.classList.remove('graph-node-pulse', 'graph-node-pulse-false');
  void el.offsetWidth; // restart the animation for repeated runs
  el.classList.add(cls);
  state.lastActivity = state.lastActivity || {};
  state.lastActivity[nodeId] = { outcome, time: typeof simElapsed === 'number' ? simElapsed : 0 };
}
function graphWatchEntries(state) {
  const entries = [];
  for (const v of state.graph.variables || []) if (v && v.name) entries.push({ kind: v.scope === 'game' ? 'graph-game' : v.scope === 'object' ? 'object' : 'graph-local', name: v.name, scope: v.scope, id: v.id });
  const names = new Set(entries.map((e) => e.kind + ':' + e.name));
  for (const node of state.graph.nodes || []) {
    const definition = variableDefinitionFor(node.type);
    const values = node.params && typeof node.params === 'object' ? node.params : node;
    for (const field of (definition && definition.fields) || []) {
      const kind = variableFieldKind(field), name = kind && values[field.key];
      if (typeof name === 'string' && name && !names.has(kind + ':' + name)) { names.add(kind + ':' + name); entries.push({ kind, name }); }
    }
  }
  return entries;
}
function renderGraphWatch() {
  const state = graphEditorState, box = document.getElementById('graph-watch');
  if (!box) return;
  if (!state || !state.watching) { box.hidden = true; return; }
  const entries = graphWatchEntries(state);
  const value = (e) => {
    if (!playMode) return '—';
    if (e.kind === 'graph-local') return 'per run';
    if (e.kind === 'object') { const v = state.item && state.item.variables && state.item.variables[e.name]; return v === undefined ? '—' : JSON.stringify(v); }
    return liveVariableValue({ kind: e.kind, name: e.name, uses: [] }) || '—';
  };
  box.hidden = false;
  box.innerHTML = `<strong>Watch</strong>${playMode ? '' : ' <small>(press Play)</small>'}${entries.length ? `<table>${entries.map((e) => `<tr><td>${VARIABLE_KINDS[e.kind].badge}</td><td>${escapeHtml(e.name)}</td><td class="graph-watch-value">${escapeHtml(value(e))}</td></tr>`).join('')}</table>` : '<p>This graph uses no named variables.</p>'}`;
}
function startGraphWatch() {
  const state = graphEditorState;
  if (!state || state.functionDefinition) { showStatus('Open an object Graph to watch it'); return; }
  if (playMode) { showStatus('Already playing'); return; }
  const item = state.item, existing = state.existingBehavior;
  const before = item.behaviors ? item.behaviors.length : 0;
  document.getElementById('graph-save-btn').click(); // saves (or closes when unchanged)
  if (!placed.includes(item)) return;
  const behavior = existing && item.behaviors.includes(existing) ? existing : (item.behaviors.length > before ? item.behaviors[item.behaviors.length - 1] : null);
  if (!behavior || !behavior.graph) { showStatus('Save the Graph before watching it'); return; }
  openGraphEditor(item, behavior);
  graphEditorState.watching = true;
  document.getElementById('graph-modal').classList.add('graph-modal-docked');
  document.getElementById('graph-watch-btn').textContent = '■ Stop watching';
  document.getElementById('play-btn').click();
  clearInterval(graphWatchTimer);
  graphWatchTimer = setInterval(() => {
    if (!graphEditorState || !graphEditorState.watching) { stopGraphWatch(); return; }
    renderGraphWatch();
    if (!playMode && graphEditorState.watchStarted) stopGraphWatch();
    if (playMode) graphEditorState.watchStarted = true;
  }, 250);
  renderGraphWatch();
  showStatus('Watching this Graph: nodes flash as they run. Stop Play to edit again.');
}
function stopGraphWatch() {
  clearInterval(graphWatchTimer); graphWatchTimer = null;
  document.getElementById('graph-modal').classList.remove('graph-modal-docked');
  const watchButton = document.getElementById('graph-watch-btn'); if (watchButton) watchButton.textContent = '▶ Play & watch';
  if (graphEditorState) { graphEditorState.watching = false; graphEditorState.watchStarted = false; }
  const box = document.getElementById('graph-watch'); if (box) box.hidden = true;
}
(function mountGraphWatch() {
  if (window.__OPUS_EMBEDDED_PROJECT__) return;
  const toolbar = document.getElementById('graph-toolbar'), modal = document.getElementById('graph-modal');
  if (!toolbar || !modal || document.getElementById('graph-watch-btn')) return;
  const button = document.createElement('button');
  button.id = 'graph-watch-btn'; button.type = 'button';
  button.title = 'Save this Graph, start Play and watch it run beside the game';
  button.textContent = '▶ Play & watch';
  toolbar.insertBefore(button, document.getElementById('graph-cancel-btn'));
  button.onclick = () => (graphEditorState && graphEditorState.watching ? (playMode && document.getElementById('play-btn').click(), stopGraphWatch()) : startGraphWatch());
  const box = document.createElement('aside');
  box.id = 'graph-watch'; box.hidden = true; box.setAttribute('aria-live', 'polite');
  modal.appendChild(box);
  document.getElementById('graph-cancel-btn').addEventListener('click', stopGraphWatch, true);
})();
