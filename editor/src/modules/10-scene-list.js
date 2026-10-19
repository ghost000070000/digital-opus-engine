// --- Scene list ---

const sceneListEl = document.getElementById('scene-list');

let sceneListFilter = '';
let sceneCollectionFilter = '';
function sceneCollectionName(item) {
  const record = item?.components?.['scene-collection'];
  return record && record.version === 1 && typeof record.name === 'string' && record.name.length > 0 && record.name.length <= 80 && record.name.trim() === record.name ? record.name : '';
}
function sceneCollectionMatches(item) {
  const name = sceneCollectionName(item);
  return !sceneCollectionFilter || sceneCollectionFilter === '__none' ? !sceneCollectionFilter || !name : 'name:' + name === sceneCollectionFilter;
}
function renderSceneCollectionControls() {
  const select = document.getElementById('scene-collection-filter'); if (!select) return;
  const counts = new Map(); for (const item of placed) { const name = sceneCollectionName(item); if (name) counts.set(name, (counts.get(name) || 0) + 1); }
  if (sceneCollectionFilter.startsWith('name:') && !counts.has(sceneCollectionFilter.slice(5))) sceneCollectionFilter = '';
  select.innerHTML = '<option value="">All Objects</option><option value="__none">Uncollected</option>' + [...counts].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,count]) => `<option value="${escapeHtml('name:' + name)}">${escapeHtml(name)} (${count})</option>`).join('');
  select.value = sceneCollectionFilter;
  document.getElementById('scene-collection-status').textContent = `${selectedItems.size} selected · ${placed.length} Objects · ${counts.size} collections. Unavailable memberships remain in All/Uncollected.`;
  for (const id of ['assign','select','clear']) document.getElementById('scene-collection-' + id).disabled = playMode;
  document.getElementById('scene-collection-rename').disabled = playMode || !sceneCollectionFilter.startsWith('name:');
}
function changeSceneCollection(mode) {
  try {
    if (playMode) throw new Error('Stop Play before changing Scene collections.');
    const raw = document.getElementById('scene-collection-name').value, name = raw.trim();
    if (mode !== 'clear' && (!name || name.length > 80)) throw new Error('Choose a collection name of 1–80 characters.');
    if (!['assign','rename','clear'].includes(mode)) throw new Error('Unavailable collection operation.');
    if (mode === 'rename' && !sceneCollectionFilter.startsWith('name:')) throw new Error('Choose a named collection to rename.');
    const oldName = sceneCollectionFilter.slice(5), targets = mode === 'rename' ? placed.filter(item => sceneCollectionName(item) === oldName) : [...selectedItems];
    if (!targets.length || targets.some(item => !placed.includes(item))) throw new Error('Select current Objects first.');
    const names = new Set(placed.map(sceneCollectionName).filter(Boolean));
    if (mode === 'rename' && name !== oldName && names.has(name)) throw new Error('That collection already exists. Assign selected Objects to it explicitly.');
    if (mode !== 'clear' && !names.has(name) && names.size >= 128) throw new Error('At most128 new collections per Level. Existing imported data is retained.');
    for (const item of targets) {
      const record = item.components?.['scene-collection'];
      if (record !== undefined && !sceneCollectionName(item)) throw new Error('Unavailable membership retained; use a compatible editor before replacing it.');
      if (mode === 'clear' && record && Object.keys(record).some(key => !['name','version'].includes(key))) throw new Error('Membership has retained extension data; clearing refused without data loss.');
    }
    const changed = targets.filter(item => mode === 'clear' ? !!sceneCollectionName(item) : sceneCollectionName(item) !== name);
    if (!changed.length) { showStatus('Collection unchanged.'); return false; }
    pushUndo();
    for (const item of changed) {
      if (mode === 'clear') { delete item.components['scene-collection']; if (!Object.keys(item.components).length) delete item.components; }
      else { item.components = item.components || {}; item.components['scene-collection'] = { ...(item.components['scene-collection'] || {}), version: 1, name }; }
    }
    sceneCollectionFilter = mode === 'clear' ? '' : 'name:' + name; sceneListFilter = ''; document.getElementById('scene-search').value = '';
    renderSceneList(); renderInspector(); showStatus('Updated collection membership; one Undo step, Object poses and gameplay unchanged.'); return true;
  } catch (error) { showStatus(error.message); return false; }
}
// Collections use the component serializer/history already shared by every
// Object kind. No second scene owner, hierarchy, visibility or runtime layer.
// Depth-first parent-before-children ordering for the Scene tree. Dangling
// parentId (parent no longer in `placed`) is treated as a root rather than
// dropped -- shouldn't happen given removeItemFromScene's unparent-on-delete
// step, but a tree view fails safe by still showing the item, not hiding it.
function buildHierarchyOrder(items) {
  const childrenByParent = new Map();
  for (const item of items) {
    if (!item.parentId) continue;
    if (!childrenByParent.has(item.parentId)) childrenByParent.set(item.parentId, []);
    childrenByParent.get(item.parentId).push(item);
  }
  const result = [];
  const visited = new Set();
  function visit(item, depth) {
    if (visited.has(item)) return;
    visited.add(item);
    result.push({ item, depth });
    for (const kid of childrenByParent.get(item.id) || []) visit(kid, depth + 1);
  }
  for (const item of items) {
    const parent = item.parentId ? findItemById(item.parentId) : null;
    if (!parent || !items.includes(parent)) visit(item, 0);
  }
  return result;
}
const sceneTreeCollapsed = new Set(); // item ids currently collapsed (children hidden)
function renderSceneList() {
  renderSceneCollectionControls();
  if (placed.length === 0) {
    sceneListEl.innerHTML = '<p id="scene-list-empty">Nothing placed yet. Open Objects and drag a Cube or Terrain into the viewport.</p>';
    return;
  }
  const q = sceneListFilter.trim().toLowerCase();
  const childrenByParent = new Map();
  for (const item of placed) {
    if (item.parentId) { if (!childrenByParent.has(item.parentId)) childrenByParent.set(item.parentId, []); childrenByParent.get(item.parentId).push(item); }
  }
  let rows;
  const filteredView = !!q || !!sceneCollectionFilter;
  if (filteredView) {
    // Searching flattens to a plain matched list (still findable by name
    // regardless of nesting depth) rather than trying to show ancestor
    // chains above each match -- simpler and still sensible: a search hit
    // is never hidden just because it's nested.
    rows = placed.map((item, i) => ({ item, i, depth: 0, label: itemDisplayName(item, i) })).filter(({ item, label }) => sceneCollectionMatches(item) && label.toLowerCase().includes(q));
  } else {
    rows = buildHierarchyOrder(placed)
      .map(({ item, depth }) => ({ item, i: placed.indexOf(item), depth, label: itemDisplayName(item, placed.indexOf(item)) }));
  }
  if (rows.length === 0) {
    sceneListEl.innerHTML = '<p id="scene-list-empty">No objects match the filter.</p>';
    return;
  }
  // Visibility toggle only applies to real entities (cube/camera) -- terrain/
  // water/emitter don't have an on/off visual state the way an entity does.
  const visibleRows = filteredView ? rows : rows.filter(({ item }) => {
    // Hide a row if any ancestor (walking up parentId) is currently collapsed.
    let p = item.parentId ? findItemById(item.parentId) : null;
    while (p) { if (sceneTreeCollapsed.has(p.id)) return false; p = p.parentId ? findItemById(p.parentId) : null; }
    return true;
  });
  sceneListEl.innerHTML = visibleRows.map(({ item, i, depth, label }) => {
    const canToggle = !!item.entity;
    const visible = canToggle ? item.entity.visible : true;
    const eyeBtn = canToggle ? `<button class="scene-list-visibility-btn${visible ? '' : ' hidden-item'}" data-toggle-index="${i}" title="${visible ? 'Hide' : 'Show'}">${visible ? '👁' : '🚫'}</button>` : '';
    const hasChildren = (childrenByParent.get(item.id) || []).length > 0;
    const collapsed = sceneTreeCollapsed.has(item.id);
    const caret = hasChildren ? `<button class="scene-list-caret-btn" data-caret-index="${i}" title="${collapsed ? 'Expand' : 'Collapse'}">${collapsed ? '▸' : '▾'}</button>` : `<span class="scene-list-caret-spacer"></span>`;
    const indent = filteredView ? 0 : depth * 14;
    // Wave 6 (Priority J): only a hierarchy-capable item can be dragged OR
    // accept a drop (terrain/water were always excluded from hierarchy --
    // see hierarchyCapable's own comment -- dragging one here would silently
    // no-op reparentItem, confusing rather than useful, so it's simply not
    // draggable at all).
    const draggable = hierarchyCapable(item) ? ' draggable="true"' : '';
    return `<div class="scene-list-item${selectedItems.has(item) ? ' selected' : ''}" data-index="${i}"${draggable} style="padding-left:${indent}px">${caret}<span class="scene-list-item-name">${escapeHtml(label)}</span>${eyeBtn}</div>`;
  }).join('');
  sceneListEl.querySelectorAll('.scene-list-item').forEach((el) => {
    el.onclick = (e) => {
      if (playMode || e.target.closest('[data-toggle-index]') || e.target.closest('[data-caret-index]')) return;
      selectItem(placed[Number(el.dataset.index)], e.shiftKey);
    };
  });
  sceneListEl.querySelectorAll('[data-toggle-index]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (playMode) return;
      const item = placed[Number(btn.dataset.toggleIndex)];
      if (!item.entity) return;
      pushUndo();
      item.entity.visible = !item.entity.visible;
      renderSceneList();
    };
  });
  sceneListEl.querySelectorAll('[data-caret-index]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const item = placed[Number(btn.dataset.caretIndex)];
      if (sceneTreeCollapsed.has(item.id)) sceneTreeCollapsed.delete(item.id); else sceneTreeCollapsed.add(item.id);
      renderSceneList();
    };
  });
  wireSceneListDragReparenting();
  if (typeof enhanceSceneList === 'function') enhanceSceneList(); // icons, rename, menu (62-hierarchy-tools.js)
}
// Wave 6 (Priority J): drag-and-drop reparenting directly in the Scene
// tree -- the ONE existing way to reparent before this (an Inspector
// "Parent To" dropdown) is precise but slow for restructuring several
// objects at once; dragging one row onto another is the standard hierarchy-
// panel gesture every scene editor already trains users to expect. Reuses
// `reparentItem`/`unparentItem` wholesale (Wave 4/5) -- no new reparenting
// math, just a new gesture that calls the same functions the Inspector
// dropdown already does.
let sceneDragItemId = null;
function wireSceneListDragReparenting() {
  sceneListEl.querySelectorAll('.scene-list-item[draggable]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      if (playMode) { e.preventDefault(); return; }
      sceneDragItemId = placed[Number(el.dataset.index)].id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', sceneDragItemId); // Firefox requires real data to be set for a drag to start at all
    });
    el.addEventListener('dragover', (e) => {
      if (!sceneDragItemId) return;
      e.preventDefault(); // required for 'drop' to fire at all -- native HTML5 DnD default is "reject"
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('scene-list-drop-target');
    });
    el.addEventListener('dragleave', () => el.classList.remove('scene-list-drop-target'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('scene-list-drop-target');
      const draggedItem = findItemById(sceneDragItemId);
      const targetItem = placed[Number(el.dataset.index)];
      sceneDragItemId = null;
      if (!draggedItem || !targetItem || draggedItem === targetItem) return;
      pushUndo();
      if (reparentItem(draggedItem, targetItem)) {
        showStatus(`Parented "${itemDisplayName(draggedItem, placed.indexOf(draggedItem))}" to "${itemDisplayName(targetItem, placed.indexOf(targetItem))}"`);
        renderSceneList();
        renderInspector();
      }
    });
  });
  // Dropping onto the list's own empty background (not any row) unparents
  // back to root -- the drag-and-drop equivalent of the Inspector's own
  // "Parent To: (none)" option.
  sceneListEl.ondragover = (e) => { if (sceneDragItemId) e.preventDefault(); };
  sceneListEl.ondrop = (e) => {
    if (e.target !== sceneListEl || !sceneDragItemId) return; // a row's own drop handler already ran and stopped nothing, so guard on the exact target instead
    e.preventDefault();
    const draggedItem = findItemById(sceneDragItemId);
    sceneDragItemId = null;
    if (!draggedItem || !draggedItem.parentId) return;
    pushUndo();
    if (unparentItem(draggedItem)) {
      showStatus(`Unparented "${itemDisplayName(draggedItem, placed.indexOf(draggedItem))}"`);
      renderSceneList();
      renderInspector();
    }
  };
}
document.getElementById('scene-search').addEventListener('input', (e) => {
  sceneListFilter = e.target.value;
  renderSceneList();
});
document.getElementById('scene-collection-filter').addEventListener('change', e => { sceneCollectionFilter = e.target.value; renderSceneList(); });
for (const mode of ['assign','rename','clear']) document.getElementById('scene-collection-' + mode).addEventListener('click', () => changeSceneCollection(mode));
document.getElementById('scene-collection-select').addEventListener('click', () => {
  if (playMode) return;
  const items = [...sceneListEl.querySelectorAll('.scene-list-item')].map(row => placed[Number(row.dataset.index)]).filter(Boolean);
  selectedItems.clear(); for (const item of items) selectedItems.add(item); selectedItem = items[0] || null;
  syncSelectionMarkers(); renderSceneList(); renderInspector();
});

