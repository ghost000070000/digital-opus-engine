// ===== Drag assets into the scene =====
// - Model files (.glb/.gltf) dropped from the desktop onto the viewport are
//   imported through the normal import review and placed where they were
//   dropped, resting on the surface there.
// - Image files dropped onto an object are imported as Textures and applied
//   to that object; dropped on empty space they are simply imported.
// - Audio files are imported.
// - Texture library rows can be dragged onto an object to apply them.
// Everything goes through the existing import batch, so one Undo step
// removes an import together with its placement.

function sceneDropTarget(clientX, clientY) {
  const item = pickEntity(clientX, clientY);
  return item && typeof surfaceRestableItem === 'function' && surfaceRestableItem(item) && placed.includes(item) ? item : null;
}
function applyDroppedTexture(item, textureId) {
  if (!item || !findTextureAssetById(textureId)) return false;
  if (typeof unlinkMaterialFor === 'function') unlinkMaterialFor(item.entity); // a hand-picked texture makes the look unique
  if (!applyTextureAssetToItem(item, textureId)) return false;
  selectItem(item);
  renderInspector();
  renderTextureLibrary();
  return true;
}
// Lay newly imported objects out in a row from the drop point, across the
// view, each resting on whatever is below it.
function arrangeDroppedItems(items, point) {
  if (!items.length || !point) return;
  const right = app.camera.getBasis().right;
  const flat = Math.hypot(right.x, right.z) > 1e-6 ? { x: right.x / Math.hypot(right.x, right.z), z: right.z / Math.hypot(right.x, right.z) } : { x: 1, z: 0 };
  const excluded = typeof surfaceExclusionsFor === 'function' ? surfaceExclusionsFor(items) : new Set(items);
  let offset = 0;
  items.forEach((item, index) => {
    const bounds = typeof surfaceWorldBounds === 'function' ? surfaceWorldBounds(item.entity) : null;
    const width = bounds ? Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) : 2;
    if (index) offset += width / 2 + 0.5;
    const p = item.entity.position;
    p.x = point.x + flat.x * offset; p.z = point.z + flat.z * offset;
    offset += width / 2;
    if (typeof raycastSceneSurfaces === 'function') {
      const hit = raycastSceneSurfaces(new Opus.Vec3(p.x, Math.max(point.y, bounds ? bounds.max[1] : point.y) + 50, p.z), new Opus.Vec3(0, -1, 0), excluded);
      const bottom = surfaceBottomY(item);
      if (hit && Number.isFinite(bottom)) p.y += hit.point.y - bottom;
    }
  });
  selectedItems.clear();
  for (const item of items) selectedItems.add(item);
  selectedItem = items[items.length - 1];
  syncSelectionMarkers();
  renderSceneList();
  renderInspector();
}
async function importFilesIntoScene(files, clientX, clientY) {
  if (playMode) { showStatus('Stop Play before importing assets.'); return false; }
  const images = files.every((file) => /\.(png|jpe?g|webp)$/i.test(file.name || ''));
  const target = images ? sceneDropTarget(clientX, clientY) : null;
  const hit = typeof screenSurfaceHit === 'function' ? screenSurfaceHit(clientX, clientY, null) : null;
  const point = hit ? hit.point : screenToGroundPoint(clientX, clientY);
  const placedBefore = new Set(placed), texturesBefore = new Set(textureAssets.map((t) => t.id));
  // The import review lives in the Assets tab; show it so the creator can confirm.
  activateTab('left-tab', 'assets');
  setTimeout(() => document.getElementById('model-import-accept')?.scrollIntoView?.({ block: 'nearest' }), 0);
  showStatus(`Preparing ${files.length} file${files.length === 1 ? '' : 's'}… review and confirm in Assets`);
  const ok = await runAssetImportBatch(files, images && target ? 'texture' : 'auto');
  if (!ok || playMode) return false;
  const newTextures = textureAssets.filter((t) => !texturesBefore.has(t.id));
  if (target && newTextures.length && placed.includes(target)) {
    applyDroppedTexture(target, newTextures[newTextures.length - 1].id);
    showStatus(`Applied ${newTextures[newTextures.length - 1].name} to ${itemDisplayName(target)} · Undo removes the import`);
    return true;
  }
  const newItems = placed.filter((item) => !placedBefore.has(item) && item.kind === 'cube' && item.entity);
  arrangeDroppedItems(newItems, point);
  if (newItems.length) showStatus(`Placed ${newItems.length} imported model${newItems.length === 1 ? '' : 's'} · Undo removes the import`);
  return true;
}

canvas.addEventListener('dragover', (event) => {
  if (playMode || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
canvas.addEventListener('drop', (event) => {
  const files = Array.from(event.dataTransfer?.files || []);
  if (playMode || !files.length) return;
  if (files.some((file) => /\.opus-(tilemap|chunk)\./i.test(file.name || ''))) return; // portable bundles keep their own importer
  event.preventDefault();
  event.stopPropagation();
  importFilesIntoScene(files, event.clientX, event.clientY);
});

// Texture library rows drag onto objects.
let textureDrag = null; // { id, ghost, startX, startY, moved }
document.getElementById('texture-library-list')?.addEventListener('pointerdown', (event) => {
  const row = event.target.closest?.('.asset-row[data-texture-id]');
  if (!row || playMode || event.button !== 0 || event.target.closest('button, input, select, textarea, a, label')) return;
  const texture = findTextureAssetById(row.dataset.textureId);
  if (!texture || texture.decodeError) return;
  textureDrag = { id: texture.id, name: texture.name, startX: event.clientX, startY: event.clientY, moved: false, ghost: null };
});
window.addEventListener('pointermove', (event) => {
  if (!textureDrag) return;
  if (!textureDrag.moved && Math.hypot(event.clientX - textureDrag.startX, event.clientY - textureDrag.startY) < 6) return;
  if (!textureDrag.moved) {
    textureDrag.moved = true;
    const ghost = document.createElement('div');
    ghost.className = 'texture-drag-ghost';
    const texture = findTextureAssetById(textureDrag.id);
    if (texture?.dataURL) { const img = document.createElement('img'); img.src = texture.dataURL; img.alt = ''; ghost.appendChild(img); }
    const label = document.createElement('span'); ghost.appendChild(label);
    document.body.appendChild(ghost);
    textureDrag.ghost = ghost;
  }
  const over = document.elementFromPoint(event.clientX, event.clientY) === canvas ? sceneDropTarget(event.clientX, event.clientY) : null;
  textureDrag.ghost.style.left = `${event.clientX + 12}px`;
  textureDrag.ghost.style.top = `${event.clientY + 12}px`;
  textureDrag.ghost.querySelector('span').textContent = over ? `Apply to ${itemDisplayName(over)}` : textureDrag.name;
  textureDrag.ghost.classList.toggle('has-target', !!over);
});
window.addEventListener('pointerup', (event) => {
  if (!textureDrag) return;
  const drag = textureDrag;
  textureDrag = null;
  drag.ghost?.remove();
  if (!drag.moved || playMode || document.elementFromPoint(event.clientX, event.clientY) !== canvas) return;
  const target = sceneDropTarget(event.clientX, event.clientY);
  if (!target) { showStatus('Drop the texture onto an object to apply it.'); return; }
  if (typeof materialTextureRef === 'function' && materialTextureRef(target) === drag.id) { showStatus('That object already uses this texture.'); return; }
  pushUndo();
  if (applyDroppedTexture(target, drag.id)) showStatus(`Applied ${drag.name} to ${itemDisplayName(target)} · Undo restores`);
});
window.addEventListener('blur', () => { textureDrag?.ghost?.remove(); textureDrag = null; });
