// ===== Scene links: pick targets in the viewport, see what points where =====
// - Every object dropdown in Behaviors, Graph nodes and Sequences gets a 🎯
//   button: click it, then click the object in the scene (Esc cancels).
// - With one object selected, the viewport draws its links: solid arrows to
//   the objects its logic targets (labelled with the action), dashed arrows
//   from objects whose logic targets it. Editor-only; never saved.

let scenePick = null; // { select } while waiting for a click in the scene
let scenePickSwallowUntil = 0;

function sceneLinkLabel(item) { return item.name || (typeof itemDisplayName === 'function' ? itemDisplayName(item, placed.indexOf(item)) : item.id); }
function cancelScenePick(message) {
  if (!scenePick) return;
  scenePick.button?.classList.remove('active');
  scenePick = null;
  canvas.classList.remove('scene-picking');
  if (message) showStatus(message);
}
function startScenePick(select, button) {
  if (playMode) { showStatus('Stop Play before choosing targets.'); return; }
  if (scenePick) cancelScenePick();
  scenePick = { select, button };
  button.classList.add('active');
  canvas.classList.add('scene-picking');
  showStatus('Click the target object in the scene · Esc cancels');
}
// Choose `item` in the dropdown the way a person would, so existing change handlers save it.
function applyScenePick(select, item) {
  if (!item) return { ok: false, reason: 'Click an object in the scene.' };
  const option = [...select.options].find((o) => o.value === item.id && !o.disabled);
  if (!option) return { ok: false, reason: `${sceneLinkLabel(item)} can't be chosen here.` };
  select.value = item.id;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
}
function decorateObjectSelects(root) {
  for (const select of root.querySelectorAll('select[data-object-ref]')) {
    if (select.nextElementSibling && select.nextElementSibling.classList.contains('scene-pick-btn')) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scene-pick-btn';
    button.textContent = '🎯';
    button.title = 'Pick this object in the scene';
    button.setAttribute('aria-label', 'Pick the target object in the scene');
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); startScenePick(select, button); });
    select.after(button);
  }
}
if (typeof MutationObserver !== 'undefined') {
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; decorateObjectSelects(document); });
  }).observe(document.body, { childList: true, subtree: true });
}
canvas.addEventListener('pointerdown', (event) => {
  if (!scenePick || event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation(); // picking never changes the selection or starts a drag
  const pick = scenePick;
  scenePickSwallowUntil = performance.now() + 1500; // and the pointerup/click that follow
  if (!document.body.contains(pick.select)) { cancelScenePick('That field closed; nothing changed.'); return; }
  const result = applyScenePick(pick.select, pickEntity(event.clientX, event.clientY));
  if (!result.ok) { showStatus(result.reason + ' · Esc cancels'); return; }
  const chosen = findItemById(pick.select.value);
  cancelScenePick(`Target set to ${chosen ? sceneLinkLabel(chosen) : 'the object'}`);
}, { capture: true });
for (const type of ['pointerup', 'click', 'dblclick']) {
  canvas.addEventListener(type, (event) => {
    if (performance.now() > scenePickSwallowUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (type !== 'pointerup') scenePickSwallowUntil = 0;
  }, { capture: true });
}
window.addEventListener('keydown', (event) => { if (scenePick && event.key === 'Escape') { event.stopImmediatePropagation(); cancelScenePick('Picking cancelled.'); } }, true);

// --- Link lines ---
// Every object id a piece of logic mentions, with a short label for the action.
function itemLogicLinks(item) {
  const ids = new Map(placed.map((p) => [p.id, p]));
  const links = [];
  const seen = new Set();
  const add = (targetId, label) => {
    const target = ids.get(targetId);
    if (!target || target === item) return;
    const key = targetId + '|' + label;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ target, label });
  };
  const visited = new WeakSet();
  const scan = (value, label, depth = 0) => {
    if (typeof value === 'string') { add(value, label); return; }
    if (!value || typeof value !== 'object' || depth > 8 || visited.has(value) || ArrayBuffer.isView(value)) return;
    visited.add(value); // runtime state can be cyclic; authored data is shallow
    if (Array.isArray(value)) { for (const entry of value) scan(entry, label, depth + 1); return; }
    for (const key of Object.keys(value)) if (key[0] !== '_') scan(value[key], label, depth + 1);
  };
  for (const behavior of item.behaviors || []) {
    const label = (typeof ACTION_TYPES !== 'undefined' && ACTION_TYPES[behavior.action]?.label) || behavior.action || 'Logic';
    if (behavior.action === 'graph' && behavior.graph) {
      for (const node of behavior.graph.nodes || []) scan(node, (typeof GRAPH_NODE_TYPES !== 'undefined' && GRAPH_NODE_TYPES[node.type]?.label) || label);
    } else scan(behavior.params, label);
  }
  if (item.parentId) add(item.parentId, 'Parent');
  return links;
}
function sceneLinksFor(item) {
  if (!item) return { outgoing: [], incoming: [] };
  const outgoing = itemLogicLinks(item).filter((link) => link.label !== 'Parent');
  const incoming = [];
  for (const other of placed) {
    if (other === item) continue;
    for (const link of itemLogicLinks(other)) if (link.target === item && link.label !== 'Parent') incoming.push({ source: other, label: link.label });
  }
  // One arrow per object pair, listing every action that links them.
  const merge = (links, key) => {
    const byItem = new Map();
    for (const link of links) {
      const entry = byItem.get(link[key]) || { ...link, labels: [] };
      if (!entry.labels.includes(link.label)) entry.labels.push(link.label);
      byItem.set(link[key], entry);
    }
    return [...byItem.values()].map((entry) => ({ ...entry, label: entry.labels.join(' · ') }));
  };
  return { outgoing: merge(outgoing, 'target'), incoming: merge(incoming, 'source') };
}
function linkAnchor(item) {
  const p = itemPosition(item);
  const bounds = typeof surfaceWorldBounds === 'function' && item.entity ? surfaceWorldBounds(item.entity) : null;
  return bounds ? new Opus.Vec3((bounds.min[0] + bounds.max[0]) / 2, bounds.max[1], (bounds.min[2] + bounds.max[2]) / 2) : p;
}
let sceneLinksSvg = null, sceneLinksSignature = '', sceneLinksCache = null;
let sceneLinksEnabled = (() => { try { return localStorage.getItem('doengine:pref:scene-links') !== 'off'; } catch (error) { return true; } })();
function renderSceneLinks() {
  const host = canvas.parentElement;
  if (!host) return;
  if (!sceneLinksSvg) {
    sceneLinksSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sceneLinksSvg.id = 'scene-links';
    sceneLinksSvg.setAttribute('aria-hidden', 'true');
    host.appendChild(sceneLinksSvg);
  }
  const show = sceneLinksEnabled && !playMode && selectedItems.size === 1 && selectedItem && placed.includes(selectedItem);
  if (!show) { if (sceneLinksSignature) { sceneLinksSvg.innerHTML = ''; sceneLinksSignature = ''; } return; }
  // Which objects link is re-read twice a second; positions update every frame.
  const now = performance.now();
  if (!sceneLinksCache || sceneLinksCache.item !== selectedItem || now - sceneLinksCache.at > 500) sceneLinksCache = { item: selectedItem, at: now, links: sceneLinksFor(selectedItem) };
  const { outgoing, incoming } = sceneLinksCache.links;
  if (!outgoing.length && !incoming.length) { if (sceneLinksSignature) { sceneLinksSvg.innerHTML = ''; sceneLinksSignature = ''; } return; }
  const rect = host.getBoundingClientRect();
  const screen = (item) => { const s = worldToScreen(linkAnchor(item)); return s ? { x: s.x - rect.left, y: s.y - rect.top } : null; };
  const from = screen(selectedItem);
  const parts = [];
  // Off-screen or behind the camera: a short arrow pointing toward it.
  const toward = (anchorItem, otherItem) => {
    const base = screen(anchorItem);
    if (!base) return null;
    const basis = app.camera.getBasis(), d = linkAnchor(otherItem).sub(linkAnchor(anchorItem));
    let dx = d.dot(basis.right), dy = -d.dot(basis.up);
    const len = Math.hypot(dx, dy) || 1;
    return { x: base.x + dx / len * 90, y: base.y + dy / len * 90, offscreen: true };
  };
  const line = (a, b, label, cls) => {
    if (!a || !b) return;
    if (b.offscreen || a.offscreen) label += ' (off-screen)';
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 6;
    parts.push(`<line class="${cls}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" marker-end="url(#scene-link-arrow-${cls})"/>`);
    parts.push(`<text class="${cls}" x="${mx.toFixed(1)}" y="${my.toFixed(1)}">${escapeHtml(label)}</text>`);
  };
  for (const link of outgoing) line(from, screen(link.target) || toward(selectedItem, link.target), link.label, 'out');
  for (const link of incoming) line(screen(link.source) || toward(selectedItem, link.source), from, `${sceneLinkLabel(link.source)}: ${link.label}`, 'in');
  const svg = `<defs><marker id="scene-link-arrow-out" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker><marker id="scene-link-arrow-in" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>${parts.join('')}`;
  if (svg !== sceneLinksSignature) { sceneLinksSvg.innerHTML = svg; sceneLinksSignature = svg; }
}
app.onUpdate(() => { try { renderSceneLinks(); } catch (error) { /* drawing aid only */ } });
(function mountSceneLinksToggle() {
  const toggle = document.getElementById('scene-links-toggle');
  if (!toggle) return;
  toggle.checked = sceneLinksEnabled;
  toggle.addEventListener('change', () => {
    sceneLinksEnabled = toggle.checked;
    try { localStorage.setItem('doengine:pref:scene-links', sceneLinksEnabled ? 'on' : 'off'); } catch (error) { /* preference only */ }
  });
})();
