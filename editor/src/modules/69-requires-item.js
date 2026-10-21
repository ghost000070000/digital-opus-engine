// ===== Requires item =====
// Any Behavior can require the player to carry a named item: it runs only
// when they have enough, can use the item up, and otherwise shows a short
// message ("Locked: find the Key"). Set it with the 🔑 button on a Behavior
// row in the Inspector. Uses the same named inventory as Give / Remove Item.
//
//   behavior.requires = { item: 'Key', count: 1, consume: true, message: '' }

const requirementMessageTimes = new WeakMap();

function normalizeRequirement(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.item !== 'string' || !raw.item.trim()) return null;
  const count = Number.isFinite(Number(raw.count)) ? Math.max(1, Math.min(999, Math.floor(Number(raw.count)))) : 1;
  return { item: raw.item.trim().slice(0, 64), count, consume: raw.consume === true, message: typeof raw.message === 'string' ? raw.message.slice(0, 120) : '' };
}
function inventoryCount(name) {
  const inventory = (typeof window !== 'undefined' && window.__gameInventory) || {};
  return Number(inventory[name]) || 0;
}
function requirementText(req) {
  return `${req.count > 1 ? req.count + ' × ' : ''}${req.item}${req.consume ? ' (used up)' : ''}`;
}
// true = run the behavior. Uses up the item when asked; tells the player what is missing otherwise.
function behaviorRequirementGate(behavior, item, now = Date.now()) {
  const req = normalizeRequirement(behavior.requires);
  if (!req) return true;
  if (inventoryCount(req.item) >= req.count) {
    if (req.consume) window.__gameInventory[req.item] = inventoryCount(req.item) - req.count;
    if (typeof renderInventoryHud === 'function') { try { renderInventoryHud(); } catch (error) { /* display only */ } }
    return true;
  }
  const last = requirementMessageTimes.get(behavior) || 0;
  if (now - last > 1500) {
    requirementMessageTimes.set(behavior, now);
    if (typeof showToast === 'function') showToast(req.message || `Needs ${req.count > 1 ? req.count + ' × ' : 'the '}${req.item}`);
  }
  return false;
}

// --- Inspector: 🔑 on each Behavior row ---
function decorateBehaviorRequirements() {
  const list = document.getElementById('behavior-list');
  if (!list || !selectedItem || !Array.isArray(selectedItem.behaviors)) return;
  const item = selectedItem;
  list.querySelectorAll('.behavior-item').forEach((row, index) => {
    const behavior = item.behaviors[index];
    if (!behavior || row.querySelector('.requires-btn')) return;
    const req = normalizeRequirement(behavior.requires);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'requires-btn' + (req ? ' set' : '');
    button.textContent = req ? `🔑 ${requirementText(req)}` : '🔑';
    button.title = req ? 'Change or clear the item this Behavior needs' : 'Only run this Behavior when the player has an item (e.g. a Key)';
    button.onclick = (event) => { event.stopPropagation(); openRequirementEditor(item, index, row); };
    const actions = row.lastElementChild;
    if (actions) actions.prepend(button); else row.appendChild(button);
  });
}
function openRequirementEditor(item, index, row) {
  document.querySelector('.requires-editor')?.remove();
  const behavior = item.behaviors[index];
  const req = normalizeRequirement(behavior.requires) || { item: 'Key', count: 1, consume: true, message: '' };
  const editor = document.createElement('div');
  editor.className = 'requires-editor';
  editor.innerHTML = `
    <label>Needs item <input type="text" data-req="item" maxlength="64" value="${escapeHtml(req.item)}" placeholder="Key"></label>
    <label>How many <input type="number" data-req="count" min="1" max="999" step="1" value="${req.count}"></label>
    <label class="requires-check"><input type="checkbox" data-req="consume"${req.consume ? ' checked' : ''}> Use it up</label>
    <label>Message when missing <input type="text" data-req="message" maxlength="120" value="${escapeHtml(req.message)}" placeholder="Needs the ${escapeHtml(req.item)}"></label>
    <div class="requires-actions"><button type="button" data-req-save class="toolbar-btn">Save</button><button type="button" data-req-clear class="toolbar-btn">No requirement</button></div>
    <div class="field-help">Give the item with a Give Item behavior (e.g. on a Key pickup's On Trigger Enter).</div>`;
  row.after(editor);
  editor.querySelector('[data-req="item"]').focus();
  const close = () => { editor.remove(); renderBehaviorList(item); };
  editor.querySelector('[data-req-save]').onclick = () => {
    const next = normalizeRequirement({
      item: editor.querySelector('[data-req="item"]').value,
      count: editor.querySelector('[data-req="count"]').value,
      consume: editor.querySelector('[data-req="consume"]').checked,
      message: editor.querySelector('[data-req="message"]').value,
    });
    if (!next) { showStatus('Type the item name, e.g. Key.'); return; }
    pushUndo();
    behavior.requires = next;
    showStatus(`This Behavior now needs ${requirementText(next)}`);
    close();
  };
  editor.querySelector('[data-req-clear]').onclick = () => {
    if (behavior.requires) { pushUndo(); delete behavior.requires; showStatus('Requirement removed'); }
    close();
  };
  editor.addEventListener('keydown', (event) => { event.stopPropagation(); if (event.key === 'Escape') close(); if (event.key === 'Enter') editor.querySelector('[data-req-save]').click(); });
}
(function watchBehaviorList() {
  if (typeof MutationObserver === 'undefined') return;
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; decorateBehaviorRequirements(); });
  }).observe(document.body, { childList: true, subtree: true });
})();

// --- Ready-made Key + Locked Door ---
function placeExtraReadyMade(kind, at, surfaceY) {
  if (kind !== 'keyAndDoor') return null;
  const rest = (items) => { if (Number.isFinite(surfaceY) && typeof restNewItemsOnSurface === 'function') restNewItemsOnSurface(items, surfaceY); };
  placeItem('cube', new Opus.Vec3(at.x, at.y, at.z));
  const key = selectedItem;
  key.name = 'Key';
  key.entity.scale.set(0.45, 0.45, 0.45);
  key.entity.color = [0.98, 0.8, 0.2];
  key.entity.solid = false;
  key.behaviors = [
    { trigger: 'enter', action: 'giveItem', params: { name: 'Key', count: 1 } },
    { trigger: 'enter', action: 'message', params: { text: 'Got the Key!' } },
    { trigger: 'enter', action: 'destroyObject', params: {} },
  ];
  rest([key]);
  key.entity.position.y += 0.6; // float a little so it reads as a pickup
  placeItem('cube', new Opus.Vec3(at.x + 6, at.y, at.z));
  const door = selectedItem;
  door.name = 'Locked Door';
  door.entity.scale.set(2.4, 2.8, 0.35);
  door.entity.color = [0.5, 0.34, 0.2];
  door.entity.solid = true;
  rest([door]);
  door.behaviors = [
    { trigger: 'enter', action: 'setVisibility', params: { visible: false }, requires: { item: 'Key', count: 1, consume: true, message: 'Locked: find the Key' } },
  ];
  selectedItems.clear(); selectedItems.add(key); selectedItems.add(door); selectedItem = door;
  syncSelectionMarkers(); renderSceneList(); renderInspector();
  showStatus('Key + Locked Door: touching the Key collects it; the door opens when the player arrives with it');
  return door;
}
(function wireKeyPalette() {
  const el = document.getElementById('palette-ready-keyAndDoor');
  if (!el) return;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (event) => { if (!playMode) beginPlacementPointerDrag(event, { readyMade: 'keyAndDoor' }, '🔑 Key + Locked Door', { immediate: true }); });
})();
