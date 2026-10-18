// --- Games / Samples catalog ---
// Turns the games/*.json backlog into a one-click surface: Games -> card ->
// Play (loads the bundled sample and enters Play) or Open in Editor (loads
// it and stays in Edit mode) -- zero file-picker interaction, per the
// game-catalog pass's own explicit success criterion. Renders from the
// SAME games/catalog.json the build-time playable-HTML generator
// (build/build-games.js) and the static launcher (dist/games/index.html)
// also read -- one metadata source, not three hand-maintained lists.
let gamesCatalogData = null;
let gamesCatalogFilter = 'all';
async function loadGamesCatalog() {
  const statusEl = document.getElementById('games-status');
  try {
    const res = await fetch('../games/catalog.json', { cache: 'reload' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    gamesCatalogData = await res.json();
    renderGamesCatalog();
    openGameFromURLParam();
  } catch (err) {
    // Editor catalog gracefully degrades if the metadata file itself can't
    // be fetched (e.g. a packaged/offline layout missing games/) -- never
    // crashes the rest of the editor over one missing file.
    if (statusEl) statusEl.textContent = `Games catalog unavailable: ${err.message}`;
  }
}
// Undo history is the one existing "has this project been touched since it
// was last a clean document" signal already in the editor (pushUndo() is
// already called before essentially every meaningful edit) -- reused here
// rather than building a second, parallel dirty-tracking mechanism. Reset
// alongside every catalog load below, the same way a level switch already
// treats itself as a fresh document boundary (see switchToLevel's own
// undoStack.length = 0).
function hasUnsavedEditorWork() { return projectHasUnsavedChanges(); }
function filterCatalogGames(games, category, query) {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return games.filter(game => (category === 'all' || game.category === category) && words.every(word => [game.id, game.title, game.genre, game.controller, game.description, game.purpose, ...(game.tags || [])].join(' ').toLowerCase().includes(word)));
}
function readStarterCatalogEntries() {
  // First-run choice metadata remains the playable starter discovery owner.
  // Preserve those exact routes/copy instead of maintaining another manual list.
  const entries = [...document.querySelectorAll('#first-run-overlay button[data-sprite-starter-id], #first-run-overlay button[data-world-starter-id]')].map(button => {
    const sprite = !!button.dataset.spriteStarterId, id = sprite ? button.dataset.spriteStarterId : button.dataset.worldStarterId;
    return { id, route: sprite ? 'sprite' : 'world', title: button.querySelector('strong').textContent, description: button.querySelector('small').textContent, scope: sprite ? (id.startsWith('sprite-') ? 'Sprite foundation' : '2D playable starter') : '3D playable starter' };
  });
  for (const entry of OpusWorldStarters.list()) if (!entries.some(existing => existing.id === entry.id)) entries.push({ id: entry.id, route: 'world', title: entry.name, description: entry.description, scope: '3D world-building kit' });
  return entries;
}
function renderStarterCatalog() {
  const host = document.getElementById('games-starter-list');
  if (!host) return;
  const entries = readStarterCatalogEntries(), query = document.getElementById('games-starter-search').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const rows = entries.filter(entry => query.every(word => [entry.title, entry.description, entry.scope].join(' ').toLowerCase().includes(word)));
  document.getElementById('games-starter-status').textContent = `${rows.length} of ${entries.length} starter projects`;
  host.innerHTML = rows.map(entry => `<div class="game-card"><strong>${escapeHtml(entry.title)}</strong><p class="field-help">${escapeHtml(entry.scope)} · ${escapeHtml(entry.description)}</p><button type="button" class="toolbar-btn" data-catalog-starter="${escapeHtml(entry.id)}" data-catalog-route="${entry.route}">Create ${escapeHtml(entry.title)}…</button></div>`).join('');
  host.querySelectorAll('[data-catalog-starter]').forEach(button => button.addEventListener('click', () => {
    if (playMode) { showStatus('Stop Play before creating a starter project.'); return; }
    if (button.dataset.catalogRoute === 'sprite') createSpriteStarterProject(button.dataset.catalogStarter);
    else createWorldStarterProject(button.dataset.catalogStarter);
  }));
}
function renderGamesCatalog() {
  const listEl = document.getElementById('games-card-list');
  const statusEl = document.getElementById('games-status');
  if (!gamesCatalogData) return;
  const games = filterCatalogGames(gamesCatalogData.games, gamesCatalogFilter, document.getElementById('games-search')?.value);
  statusEl.textContent = `${games.length} game${games.length === 1 ? '' : 's'}`;
  if (games.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:4px 0">No games in this category.</p>';
    return;
  }
  listEl.innerHTML = games.map((g) => `
    <div class="game-card" data-game-id="${escapeHtml(g.id)}">
      <div class="game-card-title-row">
        <span class="game-card-title">${escapeHtml(g.title)}</span>
        ${g.featured ? '<span class="game-card-badge">Featured</span>' : ''}
      </div>
      <div class="game-card-genre">${escapeHtml(g.genre)}${(g.controller && g.controller !== 'n/a') ? ` · ${escapeHtml(g.controller)}` : ''}</div>
      <div class="game-card-desc">${escapeHtml(g.description)}</div>
      <div class="game-card-meta">${g.estimatedMinutes ? `~${g.estimatedMinutes} min` : ''}</div>
      <div class="game-card-actions">
        <button type="button" data-game-play="${escapeHtml(g.id)}" aria-label="Play ${escapeHtml(g.title)}">▶ Play</button>
        <button type="button" class="toolbar-btn" data-game-open="${escapeHtml(g.id)}" aria-label="Open ${escapeHtml(g.title)} in editor">Open in Editor</button>
      </div>
    </div>
  `).join('');
  listEl.querySelectorAll('[data-game-play]').forEach((btn) => {
    btn.addEventListener('click', () => openCatalogGame(btn.dataset.gamePlay, true));
  });
  listEl.querySelectorAll('[data-game-open]').forEach((btn) => {
    btn.addEventListener('click', () => openCatalogGame(btn.dataset.gameOpen, false));
  });
}
// The one loader both Play and Open in Editor share -- always a FRESH
// fetch + fresh loadProjectFull, never a cached/reused parsed object, so
// opening the same bundled sample twice (or switching away and back) can
// never hand back a previous session's own in-memory mutations. See this
// pass's own report for the exact live repro this guards against (move an
// object in Foglight, open Signal Relay, reopen Foglight -- the gate must
// NOT still be moved).
async function openCatalogGame(id, enterPlay) {
  const entry = gamesCatalogData && gamesCatalogData.games.find((g) => g.id === id);
  if (!entry) return;
  // An untouched starter/sample is not work worth a confirm (a deep link's
  // confirm can also be auto-dismissed, silently ignoring the link).
  if (!projectIsUntouchedBaseline() && hasUnsavedEditorWork() && !window.confirm(`Open ${entry.title}?\n\nUnsaved changes in the current project may be lost.`)) return;
  if (playMode) exitPlayMode();
  const pendingRoot=levels,pendingSignature=projectAuthoredSignature();
  const statusEl = document.getElementById('games-status');
  if (statusEl) statusEl.textContent = `Loading ${entry.title}…`;
  try {
    // Engine Public Home pass: fetches `<id>.json` -- built from the
    // catalog's own stable id, NOT `entry.file` -- because `../games/
    // catalog.json` can resolve to two differently-shaped files depending
    // on context: the dev-source `games/catalog.json` (`file` points to
    // the raw `<id>.json` project, which is what this function actually
    // needs), or the PUBLIC catalog.json a packaged games hub generates
    // alongside the editor (`file` points to the compiled `<id>.html`
    // standalone build, for that hub's own card links -- useless here,
    // since this function needs to LOAD project data via loadProjectFull,
    // not navigate to a compiled export). Found live: packaging the editor
    // into dist/engine-site/ put the PUBLIC-shaped catalog.json at the
    // exact path the editor's own Games tab fetches, and "Open in Editor"
    // failed with "Unexpected token '<'" -- the fetch had silently
    // received the 404 HTML page for a nonexistent `foglight.html.json`-
    // shaped guess, because `entry.file` was `"foglight.html"` in that
    // catalog variant. The id-based filename is stable in both shapes
    // (every source project is deliberately named `<id>.json`), so this
    // works correctly regardless of which catalog.json variant answered.
    const res = await fetch(`../games/${id}.json`, { cache: 'reload' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = await res.json();
    if(playMode||levels!==pendingRoot||projectAuthoredSignature()!==pendingSignature)throw new Error('Current document changed while loading. Nothing replaced; choose the example again.');
    loadProjectFull(parsed, `Games catalog: ${entry.title}`);
    // Fresh document boundary, same reasoning as switchToLevel's own reset --
    // undo history from whatever was open before must not follow a
    // catalog sample in (and must not make THIS load itself look dirty).
    undoStack.length = 0;
    redoStack.length = 0;
    updateUndoRedoButtons();
    markProjectPristine();
    document.title = `Digital Opus — ${entry.title}`;
    if (statusEl) statusEl.textContent = `Loaded ${entry.title}`;
    if (enterPlay) enterPlayMode();
  } catch (err) {
    if (statusEl) statusEl.textContent = `Could not open ${entry.title}: ${err.message}`;
  }
}
// Public-site deep-link (Engine Public Home pass): "Open in Editor" from
// the Engine's own Featured Examples cards can link straight to
// `editor/?game=<id>` instead of dumping a visitor into a blank editor
// they'd then have to find the Games tab in themselves. Deliberately NOT
// a router or a new project-loading path -- it's a single `URLSearchParams`
// read, reusing the exact same `openCatalogGame` every Games-tab card
// already calls. Runs once, right after the catalog is available; a
// missing/unknown `game` id is a silent no-op (the editor still opens
// normally, just without the deep-linked sample).
function openGameFromURLParam() {
  const gameId = new URLSearchParams(location.search).get('game');
  if (!gameId || !gamesCatalogData) return;
  const entry = gamesCatalogData.games.find((g) => g.id === gameId);
  if (!entry) return;
  // Land in the editor, not the hidden-chrome hybrid view with Play stopped.
  openCatalogGame(gameId, false).then(() => { if (document.getElementById('games-status').textContent === `Loaded ${entry.title}`) setEditorVisible(true); });
}
document.getElementById('games-category-filter').addEventListener('change', (e) => {
  gamesCatalogFilter = e.target.value;
  renderGamesCatalog();
});
document.getElementById('games-search').addEventListener('input', renderGamesCatalog);
document.getElementById('games-starter-search').addEventListener('input', renderStarterCatalog);
// The Games panel is a genuine DEV-EDITOR-ONLY feature -- games/catalog.json
// lives next to the editable source projects, not inside a build artifact,
// so a relative fetch for it only ever makes sense from editor/index.html
// itself. `window.__OPUS_EMBEDDED_PROJECT__` is the exact flag every
// Playable/Editable Export already sets before this script even runs (see
// this file's own tail), so it's the correct, already-established signal
// for "this is a played/opened export, not the real dev editor" -- reused
// here rather than inventing a second one. Found live: without this guard,
// every exported/played game's embedded copy of this entire script (the
// export inlines editor/src/01-editor.js wholesale, same as it always has)
// still ran this init call, making an unexpected `../games/catalog.json`
// network request the instant ANY exported game loaded -- harmless only by
// coincidence in this dev layout (it happened to resolve to the real
// dist/games/catalog.json this same build produces), but a genuine "no
// unexpected network dependency" violation for the single-file-portability
// case the catalog build's own clean-room test specifically checks for.
if (!window.__OPUS_EMBEDDED_PROJECT__) {
  renderStarterCatalog();
  loadGamesCatalog();
} else {
  const gamesTabBtn = document.querySelector('[data-left-tab="games"]');
  if (gamesTabBtn) gamesTabBtn.style.display = 'none';
}

window.addEventListener('pointermove', (e) => {
  if (!paletteDragState || e.pointerId !== paletteDragState.pointerId) return;
  if (!paletteDragState.started) {
    const distance = Math.hypot(e.clientX - paletteDragState.startX, e.clientY - paletteDragState.startY);
    if (distance < 6) return;
    paletteDragState.started = true;
    paletteGhost.classList.toggle('sprite-placement-ghost', OpusAuthoringPlumbing.isSpritePlacementPayload(paletteDragState.payload));
    paletteGhost.innerHTML = paletteDragState.previewHtml || `<span>${escapeHtml(paletteDragState.label)}</span>`;
    paletteGhost.style.display = 'flex';
  }
  paletteGhost.style.left = `${e.clientX}px`;
  paletteGhost.style.top = `${e.clientY}px`;
  const rect = canvas.getBoundingClientRect();
  const overCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  setPlacementIndicator(e, paletteDragState.started && overCanvas);
  if (paletteDragState.started) e.preventDefault();
});

window.addEventListener('pointerup', (e) => {
  if (!paletteDragState || e.pointerId !== paletteDragState.pointerId) return;
  const state = paletteDragState;
  paletteDragState = null;
  paletteGhost.style.display = 'none';
  paletteGhost.classList.remove('sprite-placement-ghost');
  paletteGhost.innerHTML = '';
  setPlacementIndicator(e, false);
  if (!state.started) {
    if (OpusAuthoringPlumbing.isSpritePlacementPayload(state.payload)) {
      selectedSpriteAssetId = state.payload.assetId;
      renderSpriteAssetInspector();
    }
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const overCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!overCanvas) return;
  const placement = screenToPlacementPoint(state.payload,e.clientX,e.clientY);
  if (!placement) return;
  commitPlacementPayload(state.payload,placement.point,placement);
});
window.addEventListener('pointercancel', (e) => {
  if (paletteDragState && e.pointerId === paletteDragState.pointerId) cancelPlacementInteraction();
  if (sculptDragState && e.pointerId === activePointerId) finishTerrainSculptGesture();
  if (paintDragState && e.pointerId === activePointerId) finishTerrainPaintGesture();
  if (scatterBrushDragState && e.pointerId === activePointerId) finishScatterBrushGesture();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sculptDragState) { finishTerrainSculptGesture(); e.preventDefault(); }
  if (e.key === 'Escape' && paintDragState) { finishTerrainPaintGesture(); e.preventDefault(); }
  if (e.key === 'Escape' && scatterBrushDragState) { finishScatterBrushGesture(); e.preventDefault(); }
  if (e.key === 'Escape' && (paletteDragState || armedPlacementPayload)) {
    e.preventDefault();
    cancelPlacementInteraction('Placement cancelled');
  }
});

