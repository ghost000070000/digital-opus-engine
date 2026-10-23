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
function ensureTimerHud(timer, template = '⏱ {value}') {
  if (playMode || !currentUiConfig || !Array.isArray(currentUiConfig.hudElements)) return null;
  if (currentUiConfig.hudElements.some((el) => el && el.binding && el.binding.source === 'timer' && el.binding.name === timer)) return null;
  const element = { id: generateHudElementId(), kind: 'label', anchor: 'top-center', offsetX: 0, offsetY: 60, keepInside: true, visible: true,
    text: 'Time', binding: { version: 1, source: 'timer', name: timer }, bindingTemplate: template };
  currentUiConfig.hudElements.push(element);
  if (typeof refreshHudBindingCatalog === 'function') { try { refreshHudBindingCatalog(); } catch (error) { /* refreshed on render */ } }
  if (typeof renderHudElementList === 'function') renderHudElementList();
  return element;
}
// Countdown Timer: a game-timer marker (hidden in Play) that counts down from
// 60 s, shows the time at the top of the screen and loses the game at zero.
function placeCountdownTimer(at, seconds = 60) {
  placeItem('trigger', new Opus.Vec3(at.x, at.y, at.z));
  const timer = selectedItem;
  timer.name = 'Countdown Timer';
  timer.behaviors = [
    { trigger: 'start', action: 'startTimer', params: { name: 'Countdown', duration: seconds, countDown: true } },
    { trigger: 'update', action: 'graph', graph: {
      nodes: [
        { id: 'done', type: 'timerFinished', timer: 'Countdown', x: 40, y: 40 },
        { id: 'lose', type: 'lose', x: 340, y: 40 },
      ],
      edges: [{ from: 'start', to: 'lose', kind: 'next' }, { from: 'done', to: 'lose', kind: 'gate' }],
      variables: [],
    } },
  ];
  ensureTimerHud('Countdown');
  selectItem(timer); renderSceneList(); renderInspector();
  showStatus('Countdown Timer: 60 seconds shown at the top; the game is lost at zero. Change Duration in its Start Timer behavior.');
  return timer;
}
function placeMoreReadyMade(kind, at, surfaceY) {
  if (kind === 'coinTrail') return placeCoinTrail(at, surfaceY);
  if (kind === 'countdown') return placeCountdownTimer(at);
  return null;
}
for (const [kind, label] of [['coinTrail', '🪙 Coin Trail'], ['countdown', '⏱ Countdown Timer']]) {
  const el = document.getElementById('palette-ready-' + kind);
  if (!el) continue;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (event) => { if (!playMode) beginPlacementPointerDrag(event, { readyMade: kind }, label, { immediate: true }); });
}
