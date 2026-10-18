// --- Editor shell: tab strips, collapsible sections, palette search ---
// (UI/UX rearchitecture pass -- see EDITOR-UI-REARCHITECTURE-REPORT.md.)
// Every element these functions touch already existed under the old single-
// column layout; this only changes which tab/section shows it, never how it
// works, so no other function in this file needed to change to support it.
function activateTab(groupAttr, name) {
  if (groupAttr === 'right-tab' && name === 'level') renderQuestFlowPanel();
  if (groupAttr === 'right-tab' && name === 'project') { renderCollisionLayerManager(); syncSignalInspector(true); }
  document.querySelectorAll(`[data-${groupAttr}]`).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset[groupAttr === 'left-tab' ? 'leftTab' : 'rightTab'] === name);
  });
  document.querySelectorAll(`[data-tab-panel]`).forEach((panel) => {
    if (panel.closest(groupAttr === 'left-tab' ? '#left-panel' : '#right-panel')) {
      panel.classList.toggle('active', panel.dataset.tabPanel === name);
    }
  });
}
document.querySelectorAll('#left-tabs [data-left-tab]').forEach((btn) => {
  btn.addEventListener('click', () => activateTab('left-tab', btn.dataset.leftTab));
});
document.querySelectorAll('#right-tabs [data-right-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activateTab('right-tab', btn.dataset.rightTab);
    if (btn.dataset.rightTab === 'ui' && !playMode) renderHudElementList();
  });
});

// Collapsible sections (Environment/Player/Ambient Audio/HUD/Start Screen/
// Win-Lose/Save/Import-Export) -- one level of collapse, state kept only in
// the DOM class (not project data, not even localStorage yet -- editor
// layout preferences are explicitly NOT project data, see section 70 of the
// rearchitecture spec; local persistence of the collapse state itself is a
// small enough follow-up to skip this pass without losing anything users
// can't just re-expand in one click).
document.querySelectorAll('.section-header[data-section]').forEach((header) => {
  header.addEventListener('click', () => {
    const body = document.querySelector(`[data-section-body="${header.dataset.section}"]`);
    header.classList.toggle('collapsed');
    if (body) body.classList.toggle('collapsed');
  });
});

// Palette search (Objects tab) -- filters the existing static palette items
// by their own visible text; category headers hide themselves too once
// every item under them is filtered out, so a search never leaves a bare
// "World" label over nothing.
document.getElementById('palette-search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const objectsTab = document.getElementById('left-tab-objects');
  const items = Array.from(objectsTab.querySelectorAll('.palette-item'));
  let anyVisible = false;
  for (const el of items) {
    const match = !q || el.textContent.toLowerCase().includes(q);
    el.classList.toggle('palette-hidden', !match);
    if (match) anyVisible = true;
  }
  objectsTab.querySelectorAll('.palette-category').forEach((cat) => {
    let node = cat.nextElementSibling;
    let hasVisible = false;
    while (node && node.classList.contains('palette-item')) {
      if (!node.classList.contains('palette-hidden')) hasVisible = true;
      node = node.nextElementSibling;
    }
    cat.style.display = hasVisible ? '' : 'none';
  });
  document.getElementById('palette-empty').style.display = anyVisible ? 'none' : '';
});

// Narrow-screen drawers (see the @media rule in index.html) -- at desktop
// widths these buttons/scrim are display:none and this code is simply never
// triggered by anything, so it costs nothing there. Opening one drawer
// closes the other (both are wide enough to fully cover the viewport at
// narrow widths, so showing both at once would just stack one over the
// other uselessly); the scrim closes whichever is open, same as tapping
// outside a normal mobile drawer.
function setNarrowPanel(panelId, visible) {
  document.getElementById(panelId).classList.toggle('narrow-visible', visible);
  const otherOpen = document.getElementById('left-panel').classList.contains('narrow-visible')
    || document.getElementById('right-panel').classList.contains('narrow-visible');
  document.getElementById('narrow-scrim').classList.toggle('visible', otherOpen);
}
document.getElementById('narrow-left-toggle').addEventListener('click', () => {
  const willShow = !document.getElementById('left-panel').classList.contains('narrow-visible');
  setNarrowPanel('right-panel', false);
  setNarrowPanel('left-panel', willShow);
});
document.getElementById('narrow-right-toggle').addEventListener('click', () => {
  const willShow = !document.getElementById('right-panel').classList.contains('narrow-visible');
  setNarrowPanel('left-panel', false);
  setNarrowPanel('right-panel', willShow);
});
document.getElementById('narrow-scrim').addEventListener('click', () => {
  setNarrowPanel('left-panel', false);
  setNarrowPanel('right-panel', false);
});

// The Project tab's Save/Export buttons are the SAME action as the top
// bar's -- not a second implementation, just a second entry point for
// anyone who's already in the Project tab and doesn't want to look up top.
document.getElementById('save-alt-btn').addEventListener('click', () => document.getElementById('save-btn').click());
document.getElementById('export-standalone-alt-btn').addEventListener('click', () => document.getElementById('export-standalone-btn').click());

