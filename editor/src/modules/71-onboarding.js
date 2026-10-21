// --- Phase 009: first-run choice, contextual help, and guided first game ---
// All preference/progress state is kept behind OpusOnboarding's dedicated
// localStorage key. None of it enters serializeProject or __gameState.
const onboardingStore = OpusOnboarding.createStore(window.localStorage);
const firstRunOverlay = document.getElementById('first-run-overlay');
const onboardingCoach = document.getElementById('onboarding-coach');
const helpOverlay = document.getElementById('editor-help-overlay');
let onboardingHighlight = null;
let onboardingHighlightTimer = null;
let onboardingTargetTimer = null;
let onboardingTargetToken = 0;
let onboardingPollTimer = null;
let onboardingRecoveryStepId = null;

// "Start Blank" should be playable at once: solid ground, a player start and a
// third-person player. The guided tutorial keeps its empty level.
function blankStarterLevelContent() {
  const record = (id, name, position, scale, color, extra) => ({ id, kind: 'cube', name, position, scale, color, rotationY: 0, behaviors: [], ...extra });
  return {
    objects: [
      record('ground', 'Ground', [0, -0.25, 0], [40, 0.5, 40], [0.32, 0.38, 0.3], { solid: true }),
      record('player-start', 'Player Start', [0, 0.5, 0], [0.3, 0.3, 0.3], [0.3, 0.9, 0.9], { isSpawnPoint: true, isDefaultSpawn: true }),
    ],
    environment: { lightDir: { x: -0.5, y: -1, z: -0.3 }, skyTop: [0.18, 0.38, 0.68], skyHorizon: [0.68, 0.82, 0.95], groundColor: [0.16, 0.17, 0.15], sunColor: [1, 0.96, 0.88], fogDensity: 0.006, shadows: { enabled: true, resolution: 1024, distance: 30, bias: 0.0025 } },
    playerSettings: { controllerType: 'thirdperson', moveSpeed: 6, acceleration: 30, collisionRadius: 0.4, maxHealth: 100, jumpEnabled: true, gravity: 20, jumpSpeed: 8, initialYaw: 0, initialPitch: 0.28 },
  };
}
function createBlankProject(name, options = {}) {
  if(playMode){showStatus('Stop Play before creating a project.');return false;}
  // The untouched starter/sample is not creator work: no prompt for it.
  const untouched=typeof projectIsUntouchedBaseline==='function'&&projectIsUntouchedBaseline();
  if(projectDurability?.signature!==undefined&&!untouched&&projectHasUnsavedChanges()&&!window.confirm('Replace the current unsaved document? Back Up Project JSON or save first. Named saved projects are kept.'))return false;
  // Explicit choice boundary: replace only the current in-memory document;
  // named saved projects and the user's separate Prefab library stay intact.
  assets = []; textureAssets = []; spriteAssets = []; spriteAnimationClips = []; tilesets = []; tilemapChunks = []; audioAssets = [];
  nextAssetId = 1; nextTextureId = 1; nextSpriteAssetId = 1; nextSpriteAnimationId = 1; nextAudioId = 1; selectedSpriteAssetId = null; selectedSpriteAnimationId = null;
  const levelId = generateLevelId();
  const starter = options.playable ? blankStarterLevelContent() : { objects: [], environment: null, playerSettings: null };
  loadProjectFull({
    format: PROJECT_FORMAT, version: PROJECT_FORMAT_VERSION,
    playerPreferenceScope: OpusPlayerRebindScreen.freshScope(),
    levels: [{ id: levelId, name: 'Level 1', objects: starter.objects, environment: starter.environment, playerSettings: starter.playerSettings, ui: null, description: '', ambientAudio: null, sequences: [], objectiveDefs: [], scatterLayers: [] }],
    currentLevelIndex: 0, startLevelIndex: 0, levelTransition: { mode: 'instant', duration: 0.4 },
    prefabs: [], assets: [], textures: [], spriteAssets: [], spriteAnimations: [], tilesets: [], tilemapChunks: [], audio: [], meta: { ...defaultProjectMeta(), title: name === 'guided-first-game' ? 'My First Game' : '' },
    inputActionMap: { ...INPUT_ACTION_DEFAULTS }, itemDefs: [],
  }, name === 'guided-first-game' ? 'Guided First Game' : 'Blank project');
  document.getElementById('project-name-input').value = name || 'blank-project';
  undoStack.length = 0; redoStack.length = 0; updateUndoRedoButtons();
  deselectAll(); renderSceneList(); renderAssetLibrary(); renderTextureLibrary(); renderSpriteLibrary(); renderSpriteAnimationLibrary(); renderAudioLibrary();
  if (options.playable) { frameBlankStarterView(); attachDefaultPlayerCharacter(); }
  markProjectPristine();
}
// Frame the starter from a comfortable distance so a dropped object reads at
// a sensible size, instead of the camera sitting on top of the origin.
function frameBlankStarterView() {
  if (app.camera.mode !== 'orbit') return;
  app.camera.target = new Opus.Vec3(0, 0, 0);
  app.camera.distance = 14;
  app.camera.pitch = 0.62;
  app.camera.yaw = 0.75;
}

function createSpriteStarterProject(starterId) {
  if (playMode) { showStatus('Stop Play before creating a starter project.'); return false; }
  if (!['platformer-sky-steps', 'topdown-relic-courtyard', 'topdown-counter-balance'].includes(starterId) && !OpusSpriteStarters.list().some(entry => entry.id === starterId)) return false;
  if (!window.confirm('Create a new starter project? This replaces the open document. Save unsaved work first; named saved projects are kept.')) return false;
  if (playMode) { showStatus('Stop Play before creating a starter project.'); return false; }
  const created = OpusSpriteStarters.instantiate(starterId);
  created.project.playerPreferenceScope = OpusPlayerRebindScreen.freshScope();
  loadProjectFull(created.project, `Sprite starter: ${starterId}`);
  document.getElementById('project-name-input').value = created.projectName;
  undoStack.length = 0; redoStack.length = 0; updateUndoRedoButtons();
  deselectAll(); renderSceneList(); renderAssetLibrary(); renderTextureLibrary(); renderSpriteLibrary(); renderSpriteAnimationLibrary(); renderAudioLibrary();
  showStatus(`Created independent project from ${starterId}`);
  return true;
}
function createWorldStarterProject(id) {
  if(playMode)return false;
if(!['firstperson-wayfinder','firstperson-target-range','thirdperson-relic-trail','thirdperson-sparring-court','hovercraft-switchback','defense-lane','escape-lock-room'].includes(id)&&!OpusWorldStarters.list().some(entry=>entry.id===id))return false;
  if(!window.confirm('Create a new world project? This replaces the open document. Save unsaved work first; named saved projects are kept.'))return false;
  if(playMode)return false;
  const created=OpusWorldStarters.instantiate(id);
  for(const bundled of created.project.prefabs){const base=bundled.name;let n=2;while(prefabs.some(existing=>existing.name===bundled.name))bundled.name=base+' ('+(n++)+')';}
  created.project.playerPreferenceScope=OpusPlayerRebindScreen.freshScope();
  loadProjectFull(created.project,'World kit: '+id);
  document.getElementById('project-name-input').value=created.projectName;
  undoStack.length=0;redoStack.length=0;updateUndoRedoButtons();
  deselectAll();renderSceneList();renderPrefabPalette();renderOnboardingCoach();
showStatus(id==='escape-lock-room'?'New escape room — read amber/blue clue, edit console Graphs, physical Door and guarded exit':id==='defense-lane'?'New core defense — move/tune towers, finite raiders, core Health and goal Graphs before Play':id==='hovercraft-switchback'?'New hovercraft race — edit handling, ordered gates, barrier and finish Graph':id==='thirdperson-sparring-court'?'New third-person combat — edit the Court Blade, guard AI/Health, projectile Prefab and goal Graph':id==='thirdperson-relic-trail'?'New third-person adventure — edit the Player, relics and goal Graph':id.startsWith('firstperson-')?'New first-person starter — edit the Player, named objects and goal Graph':'New world project — edit the named hillside, fence route and mist region');return true;
}
document.getElementById('world-starter-create').onclick=()=>createWorldStarterProject(document.getElementById('world-starter-choice').value);

function onboardingSnapshot() {
  return {
    objectCount: placed.length,
    componentCount: placed.reduce((count, item) => count + Object.keys(item.components || {}).length, 0),
    presetIds: [...new Set(placed.flatMap((item) => (item.behaviors || []).map((behavior) => behavior.sourcePreset).filter(Boolean)))],
    hudCount: (currentUiConfig.hudElements || []).length,
  };
}

function markOnboardingProgress(id) {
  const state = onboardingStore.read();
  if (!state.tutorial.started || !state.tutorial.active || state.tutorial.completed || state.tutorial.projectScopeId !== playerPreferenceScope.id) return;
  onboardingStore.mark(id);
  renderOnboardingCoach();
}

function activateTutorialSurface(surface) {
  if (surface === 'objects') activateTab('left-tab', 'objects');
  else if (surface === 'inspector') activateTab('right-tab', 'inspector');
  else if (surface === 'level') activateTab('right-tab', 'level');
  else if (surface === 'ui') activateTab('right-tab', 'ui');
  else if (surface === 'project') activateTab('right-tab', 'project');
}

function clearOnboardingHighlight() {
  if (onboardingHighlightTimer) clearTimeout(onboardingHighlightTimer);
  onboardingHighlightTimer = null;
  if (onboardingHighlight) onboardingHighlight.classList.remove('tutorial-highlight');
  onboardingHighlight = null;
}

function cancelOnboardingTargetResolution() {
  onboardingTargetToken++;
  if (onboardingTargetTimer) clearTimeout(onboardingTargetTimer);
  onboardingTargetTimer = null;
}

function setOnboardingRecovery(visible, stepId = null) {
  onboardingRecoveryStepId = visible ? stepId : null;
  document.getElementById('onboarding-recovery').hidden = !visible;
  document.getElementById('onboarding-retry').hidden = !visible;
}

function resolveCurrentTutorialControl(token, attempt) {
  if (token !== onboardingTargetToken || onboardingCoach.hidden) return;
  const progress = OpusOnboarding.evaluate(onboardingSnapshot(), onboardingStore.read());
  const step = progress.steps[progress.currentIndex];
  if (!step) return;
  activateTutorialSurface(step.surface);
  if (step.surface === 'level' || step.surface === 'ui' || step.surface === 'project') {
    const target = document.querySelector(step.target);
    const body = target && target.closest('.section-body');
    if (body && body.classList.contains('collapsed')) {
      body.classList.remove('collapsed');
      const header = document.querySelector(`[data-section="${body.dataset.sectionBody}"]`);
      if (header) header.classList.remove('collapsed');
    }
  }
  const target = OpusOnboarding.resolveTarget(step.targetKey, (selector) => document.querySelector(selector));
  if (!target || !target.getClientRects().length || getComputedStyle(target).visibility === 'hidden' || target.matches(':disabled')) {
    if (attempt < 4) {
      onboardingTargetTimer = setTimeout(() => resolveCurrentTutorialControl(token, attempt + 1), 250);
      return;
    }
    onboardingTargetTimer = null;
    setOnboardingRecovery(true, step.id);
    showStatus('Tutorial target unavailable — retry, skip this step, or exit safely.');
    return;
  }
  setOnboardingRecovery(false);
  clearOnboardingHighlight();
  onboardingHighlight = target;
  target.classList.add('tutorial-highlight');
  target.scrollIntoView({ block: 'center', inline: 'nearest' });
  target.focus({ preventScroll: true });
  onboardingHighlightTimer = setTimeout(clearOnboardingHighlight, 5000);
}

function showCurrentTutorialControl() {
  cancelOnboardingTargetResolution();
  setOnboardingRecovery(false);
  const token = onboardingTargetToken;
  resolveCurrentTutorialControl(token, 0);
}

function scheduleOnboardingPoll() {
  if (onboardingPollTimer) clearTimeout(onboardingPollTimer);
  onboardingPollTimer = null;
  if (!onboardingStore.read().tutorial.active || playableOnlyMode) return;
  onboardingPollTimer = setTimeout(() => { onboardingPollTimer = null; renderOnboardingCoach(); }, 750);
}

function renderOnboardingCoach() {
  const state = onboardingStore.read();
  if (state.tutorial.active && state.tutorial.projectScopeId !== playerPreferenceScope.id) {
    onboardingStore.pause(); onboardingCoach.hidden = true; clearOnboardingHighlight(); cancelOnboardingTargetResolution(); scheduleOnboardingPoll();
    showStatus('Tutorial paused because a different project is open. Open its project from Home, then Resume from Help.'); return;
  }
  if (!state.tutorial.active || state.tutorial.completed || playableOnlyMode) { onboardingCoach.hidden = true; clearOnboardingHighlight(); cancelOnboardingTargetResolution(); scheduleOnboardingPoll(); return; }
  const progress = OpusOnboarding.evaluate(onboardingSnapshot(), state);
  if (progress.complete) {
    onboardingStore.complete(); onboardingCoach.hidden = true; scheduleOnboardingPoll();
    showStatus(progress.skippedCount ? `Tutorial ended with ${progress.skippedCount} skipped steps; those actions were not verified. Restart from Help to try them.` : 'Tutorial complete — you made something and exported it!');
    return;
  }
  onboardingCoach.hidden = false;
  document.getElementById('onboarding-progress').textContent = `${progress.performedCount} of ${progress.total} done${progress.skippedCount ? ` · ${progress.skippedCount} skipped` : ''} · progress saves locally`;
  document.getElementById('onboarding-checklist').innerHTML = progress.steps.map((step, index) => `<li class="onboarding-step${step.complete ? ' complete' : ''}${index === progress.currentIndex ? ' current' : ''}">${step.skipped ? '→' : step.complete ? '✓' : '○'} ${escapeHtml(step.title)}</li>`).join('');
  document.getElementById('onboarding-coaching').innerHTML = `<strong>${escapeHtml(progress.steps[progress.currentIndex].title)}</strong><br>${escapeHtml(progress.steps[progress.currentIndex].instruction)}`;
  setOnboardingRecovery(onboardingRecoveryStepId === progress.steps[progress.currentIndex].id, onboardingRecoveryStepId);
  document.getElementById('onboarding-back').disabled = progress.currentIndex === 0;
  scheduleOnboardingPoll();
}

const HELP_TOPICS = {
  create: ['Create', 'Drag objects into the viewport. Sprite is an authored flat visual with Sprite Assets and Sorting Layers. Billboard is a camera-facing world-space image with ordinary 3D Texture, Material, lighting, and depth.'],
  spriteBillboard: ['Sprite or Billboard?', 'Use Sprite when its plane orientation and named 2D draw order are authored. Use Billboard for 3D imagery or impostors that must face the camera and participate in ordinary 3D depth.'],
  viewport: ['Viewport', 'Click to select. Use Move, Rotate, and Scale handles; W/E/R switch tools. Play tests the actual current level.'],
  inspector: ['Inspector', 'Edit the selection, attach Components, add Behaviors, or apply a gameplay-role Preset. Output remains visible and editable.'],
  level: ['Level and Player', 'Configure environment, Player Controller, objectives, sequences, and other level-scoped systems here. The Player appears when Play begins.'],
  ui: ['UI', 'Add HUD elements and configure start, win, and lose screens. Counter Display can show a named gameplay counter.'],
  project: ['Project', 'Name and Save locally, validate references, import/export project data, or export a single-file Editable or Playable game.'],
};
// Read-only recipes use the existing authoring controls; opening Help never
// loads an example over the creator's current document.
const HELP_EXAMPLES = {
  create: 'Example: drag a Cube from Objects into the viewport, then edit Position in Inspector. Undo removes the placement; Redo restores it. For a flat image, choose Sprite and its Sprite Asset instead.',
  spriteBillboard: 'Example: use a Sprite for a side-view character with authored plane orientation and Sorting Layer. Use a Billboard for a tree image that should turn toward the 3D camera. These have different asset and depth controls.',
  viewport: 'Example: select a Cube, press W for Move and drag one axis handle. Use Inspector Position for an exact value. Undo reverses the edit. Press Play to test, then Stop to return to authoring.',
  inspector: 'Example: select a Cube, use Add Component to attach Health, then inspect its editable values. Apply the Collectible gameplay preset for a visible Behavior recipe. Undo reverses the authored change.',
  level: 'Example: open Player Controller and choose Top-down 3D for a Cube scene, then press Play. For a Sprite game use the 2D controller appropriate to its plane. Stop returns to the authored scene.',
  ui: 'Example: add a Counter Display and set its counter name to score. A Collectible preset can increase score during Play. Test collection and the visible counter together, then Stop.',
  project: 'Example: give the project a distinct name and Save, then reopen it from Home. Export Editable to keep authoring controls, or Playable to share the game. Save before opening another project; examples do not replace this document automatically.',
};
let editorHelpReturnFocus = null;
function openEditorHelp(topic) {
  if (helpOverlay.hidden) editorHelpReturnFocus = document.activeElement;
  const entries = topic && HELP_TOPICS[topic] ? [[topic, HELP_TOPICS[topic]]] : Object.entries(HELP_TOPICS);
  document.getElementById('editor-help-topics').innerHTML = entries.map(([key, value]) => {
    const multipleSelection = key === 'inspector' && selectedItems.size > 1;
    const spriteSelection = key === 'inspector' && selectedItems.size === 1 && selectedItem && selectedItem.kind === 'sprite';
    const title = multipleSelection ? 'Inspector · Multiple selection' : spriteSelection ? 'Inspector · Sprite selection' : value[0];
    const example = multipleSelection ? 'Example: use Move to shift the selected assembly together, then Undo to restore it. Individual property controls require one Object: press Escape to deselect, then Shift-click its Scene row to select only that member without selecting its whole group.' : spriteSelection ? 'Example: keep this Sprite selected and edit its Position X by one unit, then Undo and Redo to compare. Its Sprite Asset, plane orientation and Sorting Layer control its flat visual; Billboard is a separate camera-facing 3D object. Save before trying a different project.' : HELP_EXAMPLES[key];
    return `<div class="editor-help-topic"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(value[1])}</span><p class="editor-help-example"><strong>Try it manually</strong>${escapeHtml(example)}</p></div>`;
  }).join('');
  const state = onboardingStore.read();
  document.getElementById('resume-tutorial-btn').style.display = state.tutorial.started && !state.tutorial.completed ? '' : 'none';
  const tutorialNotice = state.tutorial.started && !state.tutorial.completed ? (state.tutorial.projectScopeId ? (state.tutorial.projectScopeId === playerPreferenceScope.id ? 'Resume continues this project without replacing it.' : 'This tutorial belongs to another project. Open that project from Home, then Resume. Restart creates a reviewed blank project instead.') : 'Older tutorial progress has no project identity. Resume explicitly attaches that progress to the current project; Restart begins a reviewed blank project.') : '';
  document.getElementById('editor-help-topics').insertAdjacentHTML('beforeend', `<p class="field-help" role="status">${escapeHtml(tutorialNotice)}</p>`);
  const standaloneHelp = typeof window !== 'undefined' && !!window.__OPUS_EMBEDDED_PROJECT__;
  const guideLink = document.getElementById('creator-guide-link'), guideNote = document.getElementById('creator-guide-offline-note');
  if (guideLink) guideLink.hidden = standaloneHelp;
  if (guideNote) guideNote.hidden = !standaloneHelp;
  helpOverlay.hidden = false; document.getElementById('editor-help-close').focus();
}
function closeEditorHelp() {
  helpOverlay.hidden = true;
  const target = editorHelpReturnFocus;
  editorHelpReturnFocus = null;
  if (target && target.isConnected && target.getClientRects().length && !target.matches(':disabled')) target.focus();
  else document.getElementById('help-btn').focus();
}

// Phase 010 capability dashboard: the JSON file is the sole scoring source.
// It is fetched only when an author opens Help -> No-Code Capabilities, so
// gameplay/runtime never depends on product metadata and exports do not embed it.
const capabilityDashboardOverlay = document.getElementById('capability-dashboard-overlay');
let capabilityCatalog = null;
let capabilityFrictionRegistry = null;
let capabilityGradeFilter = '';
function renderCapabilityDashboard() {
  if (!capabilityCatalog) return;
  const query = document.getElementById('capability-search').value.trim().toLowerCase();
  const category = document.getElementById('capability-category').value;
  const rows = capabilityCatalog.capabilities.filter((capability) => (!capabilityGradeFilter || capability.grade === capabilityGradeFilter) && (!category || capability.category === category) && (!query || `${capability.displayName} ${capability.category} ${capability.explanation} ${capability.limitations} ${capability.knownFrictionIds.join(' ')}`.toLowerCase().includes(query)));
  document.getElementById('capability-results').innerHTML = rows.length ? rows.map((capability) => {
    const frictionDetails = capability.knownFrictionIds.map((id) => capabilityFrictionRegistry.issues.find((issue) => issue.id === id)).filter(Boolean);
    const frictionText = frictionDetails.length ? frictionDetails.map((issue) => `${issue.id} · ${issue.severity} · ${issue.status}`).join('<br>') : 'No linked friction record';
    return `<article class="capability-card" data-capability-id="${escapeHtml(capability.id)}" data-grade="${escapeHtml(capability.grade)}"><div class="capability-grade">${escapeHtml(capability.grade)}</div><div class="capability-name"><strong>${escapeHtml(capability.displayName)}</strong><span class="capability-meta">${escapeHtml(capability.category)} · ${escapeHtml(capability.status.replace(/_/g, ' '))}</span></div><div class="capability-detail"><strong>What works</strong>${escapeHtml(capability.explanation)}<div class="capability-limit"><strong>Limits</strong>${escapeHtml(capability.limitations)}</div></div><div class="capability-detail"><strong>Evidence / friction</strong><span>${capability.evidence.map(escapeHtml).join('<br>')}</span><div class="capability-friction">${frictionText}</div><span class="capability-meta">Last improved: Phase ${capability.lastImprovedPhase}</span></div></article>`;
  }).join('') : '<div class="onboarding-empty">No capabilities match these filters.</div>';
  document.getElementById('capability-count').textContent = `${rows.length} of ${capabilityCatalog.capabilities.length} capabilities · authoritative local catalog`;
}
async function openCapabilityDashboard() {
  closeEditorHelp(); capabilityDashboardOverlay.hidden = false;
  document.getElementById('capability-search').focus();
  if (!capabilityCatalog) {
    try {
      const [catalogResponse, frictionResponse] = await Promise.all([fetch('../no-code-capabilities.json', { cache: 'reload' }), fetch('../authoring-friction.json', { cache: 'reload' })]);
      if (!catalogResponse.ok) throw new Error(`catalog request returned ${catalogResponse.status}`);
      if (!frictionResponse.ok) throw new Error(`friction request returned ${frictionResponse.status}`);
      capabilityCatalog = await catalogResponse.json(); capabilityFrictionRegistry = await frictionResponse.json();
      const categories = [...new Set(capabilityCatalog.capabilities.map((capability) => capability.category))].sort();
      document.getElementById('capability-category').innerHTML = '<option value="">All categories</option>' + categories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      renderCapabilityDashboard();
    } catch (error) { document.getElementById('capability-results').innerHTML = `<div class="onboarding-empty">Capability catalog could not be loaded: ${escapeHtml(error.message)}</div>`; }
  } else renderCapabilityDashboard();
}
function closeCapabilityDashboard() { capabilityDashboardOverlay.hidden = true; document.getElementById('help-btn').focus(); }
document.getElementById('capability-dashboard-btn').addEventListener('click', openCapabilityDashboard);
document.getElementById('capability-dashboard-close').addEventListener('click', closeCapabilityDashboard);
document.getElementById('capability-search').addEventListener('input', renderCapabilityDashboard);
document.getElementById('capability-category').addEventListener('change', renderCapabilityDashboard);
document.querySelectorAll('[data-capability-grade]').forEach((button) => button.addEventListener('click', () => { capabilityGradeFilter = button.dataset.capabilityGrade; document.querySelectorAll('[data-capability-grade]').forEach((entry) => entry.classList.toggle('active', entry === button)); renderCapabilityDashboard(); }));
capabilityDashboardOverlay.addEventListener('click', (event) => { if (event.target === capabilityDashboardOverlay) closeCapabilityDashboard(); });
capabilityDashboardOverlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeCapabilityDashboard(); } });

document.getElementById('help-btn').addEventListener('click', () => openEditorHelp());
document.querySelectorAll('[data-help-topic]').forEach((button) => button.addEventListener('click', () => openEditorHelp(button.dataset.helpTopic)));
document.getElementById('editor-help-close').addEventListener('click', closeEditorHelp);
helpOverlay.addEventListener('click', (event) => { if (event.target === helpOverlay) closeEditorHelp(); });
function handleEditorHelpKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeEditorHelp(); return; }
  if (event.key !== 'Tab') return;
  const controls = [...helpOverlay.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  if (!controls.length) { event.preventDefault(); return; }
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && (document.activeElement === first || !helpOverlay.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !helpOverlay.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
}
helpOverlay.addEventListener('keydown', handleEditorHelpKeydown);
function restartGuidedTutorial() {
  if (playMode) { showStatus('Stop Play before restarting the tutorial in a blank project.'); return false; }
  if (!window.confirm('Restart the tutorial in a new blank project? This replaces the open document and clears its Undo/Redo history. Save unsaved work first; named saved projects are kept.')) return false;
  if (playMode) { showStatus('Stop Play before restarting the tutorial in a blank project.'); return false; }
  closeEditorHelp(); createBlankProject('guided-first-game'); onboardingStore.restart('guided-first-game'); onboardingStore.bindProject(playerPreferenceScope.id); setEditorVisible(true); renderOnboardingCoach(); return true;
}
document.getElementById('restart-tutorial-btn').addEventListener('click', restartGuidedTutorial);
function resumeGuidedTutorial() {
  const state = onboardingStore.read();
  if (state.tutorial.projectScopeId && state.tutorial.projectScopeId !== playerPreferenceScope.id) { showStatus('Open the tutorial project from Home before resuming. This project is unchanged.'); return false; }
  if (!state.tutorial.projectScopeId) onboardingStore.bindProject(playerPreferenceScope.id);
  closeEditorHelp(); onboardingStore.resume(); setEditorVisible(true); renderOnboardingCoach(); return true;
}
document.getElementById('resume-tutorial-btn').addEventListener('click', resumeGuidedTutorial);
document.getElementById('onboarding-pause').addEventListener('click', () => { onboardingStore.pause(); renderOnboardingCoach(); showStatus('Tutorial paused — resume it from Help'); });
document.getElementById('onboarding-show-me').addEventListener('click', showCurrentTutorialControl);
document.getElementById('onboarding-refresh').addEventListener('click', renderOnboardingCoach);
document.getElementById('onboarding-retry').addEventListener('click', showCurrentTutorialControl);
document.getElementById('onboarding-back').addEventListener('click', () => { const progress = OpusOnboarding.evaluate(onboardingSnapshot(), onboardingStore.read()); onboardingStore.focus(progress.steps[Math.max(0, progress.currentIndex - 1)].id); renderOnboardingCoach(); });
document.getElementById('onboarding-skip-step').addEventListener('click', () => { const progress = OpusOnboarding.evaluate(onboardingSnapshot(), onboardingStore.read()); onboardingStore.skip(progress.steps[progress.currentIndex].id); renderOnboardingCoach(); });
document.getElementById('onboarding-exit').addEventListener('click', () => { onboardingStore.pause(); renderOnboardingCoach(); showStatus('Tutorial exited safely — resume or restart it from Help.'); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !onboardingCoach.hidden && helpOverlay.hidden && !playMode) { event.preventDefault(); document.getElementById('onboarding-exit').click(); } });

document.querySelectorAll('[data-first-run-choice]').forEach((button) => button.addEventListener('click', () => {
  const choice = button.dataset.firstRunChoice;
  onboardingStore.choose(choice, document.getElementById('first-run-never').checked);
  firstRunOverlay.hidden = true; setEditorVisible(true);
  if (choice === 'blank') createBlankProject('blank-project', { playable: true });
  else if (choice === 'guided') { createBlankProject('guided-first-game'); onboardingStore.restart('guided-first-game'); onboardingStore.bindProject(playerPreferenceScope.id); renderOnboardingCoach(); }
  else activateTab('left-tab', 'games');
}));
document.querySelectorAll('[data-sprite-starter-id]').forEach((button) => button.addEventListener('click', () => {
  const starterId = button.dataset.spriteStarterId;
  if (!createSpriteStarterProject(starterId)) return;
  onboardingStore.choose(`starter:${starterId}`, document.getElementById('first-run-never').checked);
  firstRunOverlay.hidden = true; setEditorVisible(true);
}));
document.querySelectorAll('[data-world-starter-id]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.worldStarterId;if(!createWorldStarterProject(id))return;onboardingStore.choose(`starter:${id}`,document.getElementById('first-run-never').checked);firstRunOverlay.hidden=true;setEditorVisible(true);}));
document.getElementById('first-run-skip').addEventListener('click', () => { onboardingStore.choose('skip', document.getElementById('first-run-never').checked); firstRunOverlay.hidden = true; setEditorVisible(true); });
firstRunOverlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.getElementById('first-run-skip').click(); });

document.addEventListener('input', (event) => { if (event.target.matches('#f-x, #f-y, #f-z')) markOnboardingProgress('move'); });
document.getElementById('player-controller-type').addEventListener('change', () => markOnboardingProgress('player'));
canvas.addEventListener('pointerup', () => { if (selectedItem && activePointerId !== null) markOnboardingProgress('move'); });

// A standalone export (see the Export Standalone Game handler, below) sets
// this before the engine/editor scripts run, so the exact same boot path
// Crate Run itself uses -- open straight into a playable game, "Edit This
// Game" reveals the full live editor on the exact same scene -- works for
// any embedded project, not just the hardcoded starter game.
if (window.__OPUS_EMBEDDED_PROJECT__) {
  loadProjectFull(window.__OPUS_EMBEDDED_PROJECT__, 'Embedded Game');
} else {
  buildStarterGame();
  const initialProject = serializeProject();
  delete initialProject.playerPreferenceScope;
  playerPreferenceScope = OpusPlayerRebindScreen.scope(JSON.parse(JSON.stringify(initialProject)));
  renderEnvironmentPanel(); // loadProjectFull syncs this itself; the starter-game path doesn't go through it
  renderPlayerSettingsPanel(); // same reasoning -- currentPlayerSettings already defaults to hovercraft
  renderUiConfigPanel(); // same reasoning -- currentUiConfig already defaults to defaultUiConfig()
  markProjectPristine();
}
if (window.__OPUS_PLAYABLE_ONLY__) {
  playableOnlyMode = true;
  chromeToggleBtn.style.display = 'none';
}
const onboardingEligible = !window.__OPUS_EMBEDDED_PROJECT__ && !new URLSearchParams(location.search).get('game');
const onboardingStateAtBoot = onboardingStore.read();
if (onboardingEligible && onboardingStore.shouldShowFirstRun()) {
  setEditorVisible(true); firstRunOverlay.hidden = false;
  requestAnimationFrame(() => firstRunOverlay.querySelector('[data-first-run-choice]')?.focus());
} else if (onboardingEligible && onboardingStateAtBoot.tutorial.active && !onboardingStateAtBoot.tutorial.completed) {
  // Resume into the dedicated tutorial document, never whichever demo the
  // editor normally boots. A creator who saved gets that exact snapshot;
  // an unsaved browser refresh gets a clean tutorial document without
  // touching any named project or prefab library.
  const tutorialName = onboardingStateAtBoot.tutorial.projectName || 'guided-first-game';
  const savedTutorial = app.save.load(tutorialName);
  if (savedTutorial) {
    document.getElementById('project-name-input').value = tutorialName;
    loadProjectFull(savedTutorial, 'Resumed Guided First Game');
  } else createBlankProject(tutorialName);
  setEditorVisible(true); renderOnboardingCoach();
} else setEditorVisible(window.__OPUS_FIXTURE_SANDBOX__===true);

// Recipes expand to the same light records as the ordinary palette. No rig
// runtime, hidden owner, or special serialization is needed after placement.
function addLightingRigPreset(id,size) {
  if(playMode)return false;
  let recipe;
  try{
    if(selectedItem?.entity)resolveWorldTransform(selectedItem);
    const center=selectedItem?.entity?['x','y','z'].map(a=>selectedItem.entity.position[a]):[0,1,0];
    recipe=Opus.LightingRig.preset(id,{center,size});
  }catch(error){showStatus('Lighting rig: '+error.message);return false;}
  if(placed.filter(item=>item.kind==='light').length+recipe.lights.length>Opus.App.MAX_LIGHTS){
    showStatus(`Lighting rig needs three free light slots (maximum ${Opus.App.MAX_LIGHTS}). Remove existing lights first.`);return false;
  }
  const created=[];
  try{
    for(const light of recipe.lights){
      const options={lightType:light.type,position:new Opus.Vec3(...light.position),color:light.color.slice(),intensity:light.intensity,range:light.range,angle:light.angle,direction:new Opus.Vec3(...light.direction),enabled:true};
      const lightHandle=app.createLight({...options,type:options.lightType});
      const item={kind:'light',options,lightHandle,name:`${Opus.LightingRig.PRESETS.find(p=>p.id===id).label} — ${light.name}`};
      created.push(item);
      item.entity=app.addEntity({mesh:cubeMesh,color:light.type==='spot'?[1,.85,.3]:[1,.95,.6],position:options.position.clone(),scale:new Opus.Vec3(.35,.35,.35)});
    }
  }catch(error){
    for(const item of created){if(item.entity)app.scene.remove(item.entity);app.removeLight(item.lightHandle);}
    showStatus('Lighting rig could not be placed: '+error.message);return false;
  }
  // History captures the authored project before any records are added.
  pushUndo();const groupId=generateGroupId();
  selectedItems.clear();
  for(const item of created){item.groupId=groupId;addPlaced(item);selectedItems.add(item);}
  selectedItem=created[0];syncSelectionMarkers();renderSceneList();renderInspector();
  showStatus('Added three grouped lights. Select an individual light to tune it, or save the group as a Prefab.');return true;
}
const lightingRigPicker=document.getElementById('lighting-rig-preset');
for(const preset of Opus.LightingRig.PRESETS){const option=document.createElement('option');option.value=preset.id;option.textContent=preset.label;option.title=preset.description;lightingRigPicker.appendChild(option);}

// Phase 227: host-installed advanced Actions reuse the canonical registry and
// Graph dispatch. No callback is read/evaluated from project/package JSON.
const customActionIds = new Set();
function registerCustomAction(id, definition) {
  if (playMode) throw new Error('Stop Play before installing a custom Action.');
  if (typeof id !== 'string' || !/^custom_[a-z][a-z0-9_]{0,63}$/.test(id)) throw new Error('Custom Action IDs must use custom_ followed by lowercase letters, digits or underscores.');
  if (customActionIds.size >= 32 || Object.prototype.hasOwnProperty.call(ACTION_TYPES,id) || Object.prototype.hasOwnProperty.call(GRAPH_NODE_TYPES,id)) throw new Error('Action ID already exists or the 32 custom Action limit was reached.');
  if (!definition || typeof definition !== 'object' || typeof definition.exec !== 'function' || typeof definition.label !== 'string' || !definition.label.trim() || definition.label.length > 80 || typeof definition.help !== 'string' || definition.help.length > 500 || !Array.isArray(definition.fields) || definition.fields.length > 16) throw new Error('Provide label, help, up to 16 fields and an exec callback.');
  const keys = new Set(), reserved = new Set(['id','type','x','y','__proto__','constructor','prototype']);
  const fields = definition.fields.map(field => {
    if (!field || typeof field !== 'object' || typeof field.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(field.key) || reserved.has(field.key) || keys.has(field.key) || !['text','number','checkbox','select','target'].includes(field.type) || typeof field.label !== 'string' || field.label.length > 80) throw new Error('Invalid, duplicate or reserved custom Action field.');
    keys.add(field.key);
    const copy = { key: field.key, label: field.label, type: field.type };
    if (field.type === 'select') {
      if (!Array.isArray(field.options) || !field.options.length || field.options.length > 32 || field.options.some(value => typeof value !== 'string' || value.length > 80) || new Set(field.options).size !== field.options.length) throw new Error('Select fields need 1–32 distinct text options.');
      copy.options = Object.freeze(field.options.slice());
    }
    return Object.freeze(copy);
  });
  const callback = definition.exec, source = Function.prototype.toString.call(callback);
  if (source.length > 65536) throw new Error('Custom Action callback exceeds the 64 KiB review limit.');
  const action = Object.freeze({ id, label: definition.label, help: definition.help, category: 'Custom', fields: Object.freeze(fields), customSource: source,
    exec(params, item) {
      if (!scriptsTrusted) { showToast('Custom Action disabled. Review and enable Custom Script permission in Project first.'); return; }
      try { return callback(params, item, window.Opus); }
      catch (error) { showToast('Custom Action ' + id + ' error: ' + (error?.message || error)); }
    } });
  // Validation completes before either registry changes. Registrations are
  // immutable for this page lifetime: no silent replacement/removal of code.
  ACTION_TYPES[id] = action;
  GRAPH_NODE_TYPES[id] = Object.freeze({ label: action.label, kind: 'action', fields: action.fields });
  customActionIds.add(id);
  scriptsTrusted = false; scriptTrustRevoked = true; scriptTrustSeen = true;
  closeScriptTrustReview(); renderScriptTrustControls(); renderGraphActionPalette(); renderInspector();
  return id;
}
function customActionReviewSources() {
  return [...customActionIds].map(id => 'Host-installed Action: ' + id + '\nFull-page JavaScript callback; closures and host installation code are not shown. Not a sandbox.\n' + ACTION_TYPES[id].customSource);
}
window.Opus = Object.freeze({ ...window.Opus, ActionExtensions: Object.freeze({
  register: registerCustomAction,
  list: () => [...customActionIds].map(id => ({ id, label: ACTION_TYPES[id].label, help: ACTION_TYPES[id].help, fields: JSON.parse(JSON.stringify(ACTION_TYPES[id].fields)) })),
}) });
// End Phase 227 host API
document.getElementById('lighting-rig-add').onclick=()=>addLightingRigPreset(lightingRigPicker.value,Number(document.getElementById('lighting-rig-size').value));
