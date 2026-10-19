// ===== Multi-object editing =====
// When several objects are selected the Inspector also offers:
// - Position / Rotation / Scale fields shared by the selection (blank when
//   the values differ; typing a value sets it on every object),
// - Color and Solid for every selected Cube or model,
// - Align (min / center / max on X, Y, Z) and Distribute (even spacing on X, Z),
// - Randomize rotation and scale, and Drop to Surface, for natural-looking dressing.
// Every change is one Undo step. Children follow their parents.

const MULTI_AXES = ['x', 'y', 'z'];
function multiEditTransformItems(selection) {
  // Parented children keep their offsets; only top-level objects are moved.
  return [...selection].filter((item) => item.entity && ['cube', 'sprite', 'light', 'tilemap'].includes(item.kind) && !item.parentId);
}
function multiEditShapeItems(selection) {
  return multiEditTransformItems(selection).filter((item) => item.kind === 'cube' || item.kind === 'sprite');
}
function multiEditLookItems(selection) {
  return [...selection].filter((item) => item.kind === 'cube' && item.entity && !item.isSpawnPoint && !item.isWaypoint && !item.isPathPoint);
}
function multiEditRead(item, field, axis) {
  const entity = item.entity;
  if (field === 'position') return entity.position[axis];
  if (field === 'scale') return entity.scale[axis];
  return entity.quaternion.toEuler()[axis] * 180 / Math.PI;
}
// The shared value, or null when the selection disagrees.
function multiEditShared(items, read) {
  if (!items.length) return null;
  const first = read(items[0]);
  return items.every((item) => Math.abs(read(item) - first) < 1e-4) ? first : null;
}
function multiEditWrite(item, field, axis, value) {
  const entity = item.entity;
  if (field === 'position') entity.position[axis] = value;
  else if (field === 'scale') entity.scale[axis] = value;
  else {
    const euler = entity.quaternion.toEuler();
    euler[axis] = value * Math.PI / 180;
    entity.quaternion = Opus.Quat.fromEuler(euler.x, euler.y, euler.z);
  }
}
function multiEditBounds(item) {
  const bounds = typeof surfaceWorldBounds === 'function' && item.kind === 'cube' ? surfaceWorldBounds(item.entity) : null;
  if (bounds) return bounds;
  const p = item.entity.position;
  return { min: [p.x, p.y, p.z], max: [p.x, p.y, p.z] };
}
// mode: 'min' | 'center' | 'max'. Moves each object so its bounds line up.
function alignItems(items, axis, mode) {
  const a = MULTI_AXES.indexOf(axis);
  if (items.length < 2 || a < 0) return false;
  const boxes = items.map(multiEditBounds);
  const lo = Math.min(...boxes.map((b) => b.min[a])), hi = Math.max(...boxes.map((b) => b.max[a]));
  const target = mode === 'min' ? lo : mode === 'max' ? hi : (lo + hi) / 2;
  items.forEach((item, i) => {
    const b = boxes[i], current = mode === 'min' ? b.min[a] : mode === 'max' ? b.max[a] : (b.min[a] + b.max[a]) / 2;
    item.entity.position[axis] += target - current;
  });
  return true;
}
// Even centre spacing between the two outermost objects along the axis.
function distributeItems(items, axis) {
  const a = MULTI_AXES.indexOf(axis);
  if (items.length < 3 || a < 0) return false;
  const centre = (item) => { const b = multiEditBounds(item); return (b.min[a] + b.max[a]) / 2; };
  const sorted = [...items].sort((p, q) => centre(p) - centre(q));
  const first = centre(sorted[0]), last = centre(sorted[sorted.length - 1]), step = (last - first) / (sorted.length - 1);
  sorted.forEach((item, i) => { item.entity.position[axis] += first + step * i - centre(item); });
  return true;
}
function randomizeItems(items, kind, rng = Math.random) {
  for (const item of items) {
    if (kind === 'rotation') {
      const euler = item.entity.quaternion.toEuler();
      item.entity.quaternion = Opus.Quat.fromEuler(euler.x, rng() * Math.PI * 2, euler.z);
    } else if (kind === 'scale') {
      const factor = 0.8 + rng() * 0.4;
      const s = item.entity.scale;
      s.set(s.x * factor, s.y * factor, s.z * factor);
    }
  }
  return items.length > 0;
}
function multiEditCommit(label, apply) {
  if (playMode) { showStatus('Stop Play before editing objects.'); return; }
  pushUndo();
  if (apply() === false) { showStatus(label + ': nothing to change'); return; }
  if (typeof updateHierarchyTransforms === 'function') { hierarchyTickToken++; updateHierarchyTransforms(); }
  syncSelectionMarkers();
  renderInspector();
  showStatus(label + ' · Undo restores');
}
const multiEditHex = (rgb) => '#' + rgb.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

function mountMultiEditSection(host) {
  if (!host || selectedItems.size < 2) return;
  const moving = multiEditTransformItems(selectedItems), shaping = multiEditShapeItems(selectedItems), looks = multiEditLookItems(selectedItems);
  const followers = [...selectedItems].filter((item) => item.parentId).length;
  const section = document.createElement('div');
  section.className = 'field-row multi-edit';
  section.id = 'multi-edit';
  const row = (field, label, items) => `<div class="multi-edit-row"><span>${label}</span>${MULTI_AXES.map((axis) => {
    const shared = multiEditShared(items, (item) => multiEditRead(item, field, axis));
    return `<input type="number" step="${field === 'rotation' ? 1 : 0.1}" data-multi-field="${field}" data-multi-axis="${axis}" aria-label="${label} ${axis.toUpperCase()} for all" ${items.length ? '' : 'disabled'} value="${shared === null ? '' : +shared.toFixed(3)}" placeholder="${shared === null ? '—' : ''}">`;
  }).join('')}</div>`;
  const sharedColor = multiEditShared(looks, (item) => item.entity.color.slice(0, 3).reduce((sum, v, i) => sum + Math.round(v * 255) * 1000 ** i, 0));
  const solidStates = new Set(looks.map((item) => !!item.entity.solid));
  section.innerHTML = `
    <label>Edit all ${selectedItems.size} objects</label>
    ${row('position', 'Position', moving)}${row('rotation', 'Rotation°', shaping)}${row('scale', 'Scale', shaping)}
    ${followers ? `<div class="field-help">${followers} parented object${followers === 1 ? ' follows its' : 's follow their'} parent.</div>` : ''}
    <div class="multi-edit-look">
      <label>Color <input type="color" id="multi-color" ${looks.length ? '' : 'disabled'} value="${looks.length ? multiEditHex(looks[0].entity.color) : '#888888'}"></label>${looks.length && sharedColor === null ? '<span class="field-help">mixed</span>' : ''}
      <label><input type="checkbox" id="multi-solid" ${looks.length ? '' : 'disabled'} ${solidStates.size === 1 && solidStates.has(true) ? 'checked' : ''}> Solid</label>
    </div>
    <div class="multi-edit-tools"><span>Align</span>${MULTI_AXES.map((axis) => ['min', 'center', 'max'].map((mode) => `<button type="button" class="toolbar-btn" data-align="${axis}:${mode}" title="Line up the ${mode === 'center' ? 'centres' : mode === 'min' ? (axis === 'y' ? 'bottoms' : 'low sides') : (axis === 'y' ? 'tops' : 'high sides')} on ${axis.toUpperCase()}">${axis.toUpperCase()} ${mode === 'min' ? '⇤' : mode === 'max' ? '⇥' : '↔'}</button>`).join('')).join('')}</div>
    <div class="multi-edit-tools"><span>Spread</span>
      <button type="button" class="toolbar-btn" data-distribute="x" ${moving.length < 3 ? 'disabled' : ''}>Even X</button>
      <button type="button" class="toolbar-btn" data-distribute="z" ${moving.length < 3 ? 'disabled' : ''}>Even Z</button>
      <button type="button" class="toolbar-btn" id="multi-random-rotation" ${shaping.length ? '' : 'disabled'} title="Random turn around Y for each object">Random turn</button>
      <button type="button" class="toolbar-btn" id="multi-random-scale" ${shaping.length ? '' : 'disabled'} title="Scale each object by a random 80–120%">Random size</button>
      <button type="button" class="toolbar-btn" id="multi-drop" title="Drop each object onto the surface below (End)">Drop to surface</button>
    </div>`;
  // First, right under the 'N objects selected' line: it is what a multi-selection is usually for.
  const count = host.querySelector(':scope > p');
  if (count) count.after(section); else host.prepend(section);
  const solid = section.querySelector('#multi-solid');
  if (solid && solidStates.size > 1) solid.indeterminate = true;
  section.querySelectorAll('[data-multi-field]').forEach((input) => {
    input.addEventListener('change', () => {
      const value = Number(input.value);
      if (input.value === '' || !Number.isFinite(value)) { renderInspector(); return; }
      const field = input.dataset.multiField, axis = input.dataset.multiAxis;
      if (field === 'scale' && value <= 0) { showStatus('Scale must be above zero.'); renderInspector(); return; }
      const items = field === 'position' ? moving : shaping;
      multiEditCommit(`Set ${field} ${axis.toUpperCase()} on ${items.length} objects`, () => { for (const item of items) multiEditWrite(item, field, axis, value); });
    });
  });
  section.querySelector('#multi-color')?.addEventListener('change', (event) => {
    const hex = event.target.value, rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    multiEditCommit(`Colored ${looks.length} objects`, () => {
      for (const item of looks) { if (typeof unlinkMaterialFor === 'function') unlinkMaterialFor(item.entity); item.entity.color = rgb.slice(); }
    });
  });
  solid?.addEventListener('change', () => {
    const on = solid.checked;
    multiEditCommit(`${on ? 'Solid' : 'Walk-through'}: ${looks.length} objects`, () => { for (const item of looks) item.entity.solid = on; });
  });
  section.querySelectorAll('[data-align]').forEach((button) => button.addEventListener('click', () => {
    const [axis, mode] = button.dataset.align.split(':');
    multiEditCommit(`Aligned ${moving.length} objects (${axis.toUpperCase()} ${mode})`, () => alignItems(moving, axis, mode));
  }));
  section.querySelectorAll('[data-distribute]').forEach((button) => button.addEventListener('click', () => {
    multiEditCommit(`Spread ${moving.length} objects evenly on ${button.dataset.distribute.toUpperCase()}`, () => distributeItems(moving, button.dataset.distribute));
  }));
  section.querySelector('#multi-random-rotation')?.addEventListener('click', () => multiEditCommit(`Randomly turned ${shaping.length} objects`, () => randomizeItems(shaping, 'rotation')));
  section.querySelector('#multi-random-scale')?.addEventListener('click', () => multiEditCommit(`Randomly sized ${shaping.length} objects`, () => randomizeItems(shaping, 'scale')));
  section.querySelector('#multi-drop')?.addEventListener('click', () => { if (typeof dropSelectionToSurface === 'function') dropSelectionToSurface(); });
}
