// ===== HUD helpers =====
// Gameplay pieces add the on-screen display they need, once:
// - placing a Collectible (or a Coin Trail) adds a "⭐ Score" label bound to
//   the score counter, unless the HUD already shows that counter;
// - placing a Key + Locked Door adds the inventory widget, unless one exists.
// The additions belong to the same Undo step as the placement.

function hudShowsCounter(counter) {
  return (currentUiConfig.hudElements || []).some((el) => el && el.binding && el.binding.source === 'counter' && el.binding.name === counter);
}
// Non-breaking spaces keep the label on one line at the right edge.
function ensureScoreHud(counter = 'score', template = '⭐ Score: {value}') {
  if (playMode || !currentUiConfig || !Array.isArray(currentUiConfig.hudElements) || hudShowsCounter(counter)) return null;
  const element = { id: generateHudElementId(), kind: 'label', anchor: 'top-right', offsetX: -8, offsetY: 60, keepInside: true, visible: true, // below the editor's viewport toolbar
    text: 'Score', binding: { version: 1, source: 'counter', name: counter }, bindingTemplate: template };
  currentUiConfig.hudElements.push(element);
  if (typeof refreshHudBindingCatalog === 'function') { try { refreshHudBindingCatalog(); } catch (error) { /* catalog refreshes on next render */ } }
  if (typeof renderHudElementList === 'function') renderHudElementList();
  return element;
}
function ensureInventoryHud() {
  if (playMode || !currentUiConfig || !Array.isArray(currentUiConfig.hudElements)) return null;
  if (currentUiConfig.hudElements.some((el) => el && el.kind === 'inventoryWidget')) return null;
  const element = { id: generateHudElementId(), kind: 'inventoryWidget', anchor: 'top-left', offsetX: 8, offsetY: 60, keepInside: true, visible: true, widget: { version: 1, maxEntries: 6 } };
  currentUiConfig.hudElements.push(element);
  if (typeof renderHudElementList === 'function') renderHudElementList();
  return element;
}

// Coin Trail: five collectibles in a line across the view, plus the score display.
function placeCoinTrail(at, surfaceY) {
  const right = app.camera.getBasis().right, len = Math.hypot(right.x, right.z) || 1;
  const dir = { x: right.x / len, z: right.z / len };
  const coins = [];
  for (let i = 0; i < 5; i++) {
    placeItem('collectible', new Opus.Vec3(at.x + dir.x * (i - 2) * 1.6, at.y, at.z + dir.z * (i - 2) * 1.6));
    const coin = selectedItem;
    coin.name = `Coin ${i + 1}`;
    if (Number.isFinite(surfaceY) && typeof restNewItemsOnSurface === 'function') { restNewItemsOnSurface([coin], surfaceY); coin.entity.position.y += 0.4; }
    coins.push(coin);
  }
  selectedItems.clear();
  for (const coin of coins) selectedItems.add(coin);
  selectedItem = coins[2];
  syncSelectionMarkers(); renderSceneList(); renderInspector();
  showStatus('Coin Trail: five coins that add to the Score shown on screen');
  return coins[2];
}
function placeMoreReadyMade(kind, at, surfaceY) {
  if (kind === 'coinTrail') return placeCoinTrail(at, surfaceY);
  return null;
}
(function wireCoinTrailPalette() {
  const el = document.getElementById('palette-ready-coinTrail');
  if (!el) return;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (event) => { if (!playMode) beginPlacementPointerDrag(event, { readyMade: 'coinTrail' }, '🪙 Coin Trail', { immediate: true }); });
})();
