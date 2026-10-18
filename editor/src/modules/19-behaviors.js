// --- Behaviors ---
// A small, fixed trigger/action set (not a general visual scripting system):
// On Click / On Enter (proximity to the camera) -> Show Message / Play Sound.
// This is the actual "is no-code feasible" test, not just scene composition.

const toastEl = document.getElementById('game-toast');
let toastTimer = null;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 1800);
}

function escapeHtml(s) {
  // Shared authoring markup uses this in both text and quoted attributes.
  // Entities retain the same displayed text while preventing attribute escape.
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Win/Lose: the primitive that turns "a scene with behaviors" into "a game
// with an end state." Freezes further trigger processing once fired.
const endOverlayEl = document.getElementById('end-overlay');
const endOverlayTitleEl = document.getElementById('end-overlay-title');
const pauseOverlayEl = document.getElementById('pause-overlay');
let gameEnded = false;
let openingMenuFreshSession = false;

// Pause Menu (Wave 4) -- reuses the existing pause overlay/App.pause-resume
// plumbing entirely (no second "is input blocked" concept, same reasoning
// the Start Screen and Dialogue already followed); this just adds real
// buttons to the overlay that was previously a static "Paused" message with
// nothing to click. Restart Level and Main Menu both reuse
// switchLevelWithTransition -- the exact function the Restart Level/Switch
// Level ACTIONS already call -- so a Pause Menu click and a Node-Graph-
// triggered Restart Level behave identically, not two implementations.
document.getElementById('pause-resume-btn').addEventListener('click', () => { if (app.paused) app.resume(); });
document.getElementById('pause-restart-btn').addEventListener('click', () => {
  if (app.paused) app.resume();
  switchLevelWithTransition(currentLevelIndex, true);
});
document.getElementById('pause-mainmenu-btn').addEventListener('click', () => {
  openingMenuFreshSession = false;
  if (app.paused) app.resume();
  switchLevelWithTransition(startLevelIndex, true);
  showStartScreenIfConfigured();
});

// Project Settings / Game Quality Options (Wave 4) -- real engine-backed
// options, not sliders that change nothing: Volume drives the actual
// AudioEngine category gains (Opus.AudioEngine.setVolume, already public,
// previously unreachable from the no-code editor path since it was only
// ever wired to the opt-in Opus.HUD chrome this editor doesn't use),
// Quality toggles the actual device-pixel-ratio cap App already uses
// internally for exactly this purpose, and Fullscreen calls the standard
// browser Fullscreen API directly. Lives on the Pause Menu rather than a
// separate Settings screen -- one bounded surface, not a second app-routing
// concept, per the explicit "do not build full app routing" constraint.
let masterVolume = 1;
function applyMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
  for (const category of ['music', 'sfx', 'ambient']) app.audio.setVolume(category, masterVolume);
  app.audio.setMuted(masterVolume <= 0);
}
function renderQualityButton() {
  const label = `Quality: ${app.settings.get('quality') === 'low' ? 'Low' : 'High'}`;
  for (const id of ['pause-quality-btn', 'mainmenu-quality-btn']) {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = label;
  }
  renderViewportQuality();
}
function renderViewportQuality() {
  const profile = document.getElementById('viewport-quality-profile');
  const readout = document.getElementById('viewport-quality-readout');
  if (!profile || !readout) return;
  const quality = app.getQuality();
  profile.value = quality.profile;
  readout.textContent = `${quality.width} × ${quality.height} pixels (${quality.pixelCount.toLocaleString()}) · applied density ${quality.effectivePixelRatio}× · display ${quality.devicePixelRatio}×`;
}
document.getElementById('viewport-quality-btn').addEventListener('click', () => {
  const panel = document.getElementById('viewport-quality-panel');
  panel.hidden = !panel.hidden;
  document.getElementById('viewport-quality-btn').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) { renderViewportQuality(); document.getElementById('viewport-quality-profile').focus(); }
});
document.getElementById('viewport-quality-close').addEventListener('click', () => {
  document.getElementById('viewport-quality-panel').hidden = true;
  document.getElementById('viewport-quality-btn').setAttribute('aria-expanded', 'false');
  document.getElementById('viewport-quality-btn').focus();
});
document.getElementById('viewport-focus-btn').addEventListener('click', focusViewportSelection);
document.getElementById('viewport-quality-profile').addEventListener('change', (event) => {
  if (event.target.value !== 'high' && event.target.value !== 'low') { renderViewportQuality(); return; }
  app.setQuality(event.target.value);
  renderQualityButton();
});
window.addEventListener('resize', () => requestAnimationFrame(renderViewportQuality));
function renderLookPreferences() {
  const preference = app.settings.get('mouseSensitivity');
  const sensitivity = typeof preference === 'number' && Number.isFinite(preference) && preference > 0 ? preference : 0.0018;
  const inverted = app.settings.get('invertMouseY') === true;
  const tuning = effectiveGamepadTuning();
  for (const prefix of ['pause', 'mainmenu']) {
    const range = document.getElementById(`${prefix}-mouse-sensitivity`);
    const checkbox = document.getElementById(`${prefix}-invert-mouse-y`);
    if (range) range.value = sensitivity;
    if (checkbox) checkbox.checked = inverted;
    for (const [suffix, field] of [['gamepad-deadzone','deadZone'], ['gamepad-look-rate','lookRate']]) {
      const input = document.getElementById(`${prefix}-${suffix}`);
      if (input) { input.disabled = !tuning.ok; input.value = tuning.ok ? tuning.record[field] : ''; }
    }
    const note = document.getElementById(`${prefix}-tuning-note`);
    if (note) note.textContent = tuning.ok ? 'Local device preferences; Reset gamepad uses this game’s authored defaults.' : tuning.reason;
  }
}
function updateMouseSensitivityPreference(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return false;
  const sensitivity = Number(value);
  if (!Number.isFinite(sensitivity) || sensitivity < 0.0006 || sensitivity > 0.004) return false;
  app.settings.set('mouseSensitivity', sensitivity);
  renderLookPreferences();
  return true;
}
function updateInvertMousePreference(value) {
  if (typeof value !== 'boolean') return false;
  app.settings.set('invertMouseY', value);
  renderLookPreferences();
  return true;
}
function effectiveGamepadTuning() {
  const authored = currentPlayerSettings.gamepadTuning;
  if (!gamepadTuningRuntime || gamepadTuningRuntime.source !== authored) {
    const state = OpusInputTuning.inspect(authored);
    gamepadTuningRuntime = {source: authored, state: state.ok ? {ok:true, record:{kind:'GamepadTuning',version:1,deadZone:state.record.deadZone,lookRate:state.record.lookRate}} : state};
  }
  if (!gamepadTuningRuntime.state.ok) return gamepadTuningRuntime.state;
  return OpusInputTuning.effective(gamepadTuningRuntime.state.record, {deadZone:app.settings.get('gamepadDeadZone'),lookRate:app.settings.get('gamepadLookRate')});
}
function updateGamepadTuningPreference(field, value) {
  if (!['deadZone','lookRate'].includes(field) || !effectiveGamepadTuning().ok ||
      (typeof value !== 'number' && (typeof value !== 'string' || !value.trim()))) return false;
  const number = Number(value), maximum = field === 'deadZone' ? 1 : 10;
  if (!Number.isFinite(number) || number < 0 || number > maximum) return false;
  app.settings.set(field === 'deadZone' ? 'gamepadDeadZone' : 'gamepadLookRate', number);
  renderLookPreferences(); return true;
}
function resetGamepadTuningPreferences() {
  app.settings.set('gamepadDeadZone', null); app.settings.set('gamepadLookRate', null);
  renderLookPreferences();
}
document.getElementById('pause-volume').addEventListener('input', (e) => applyMasterVolume(parseFloat(e.target.value)));
document.getElementById('pause-mouse-sensitivity').addEventListener('input', (e) => updateMouseSensitivityPreference(e.target.value));
document.getElementById('pause-invert-mouse-y').addEventListener('change', (e) => updateInvertMousePreference(e.target.checked));
document.getElementById('pause-quality-btn').addEventListener('click', () => {
  const currentlyHigh = app.settings.get('quality') !== 'low';
  app.setQuality(currentlyHigh ? 'low' : 'high');
  renderQualityButton();
});
document.getElementById('pause-fullscreen-btn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else canvas.requestFullscreen().catch(() => showStatus("Fullscreen isn't available"));
});
document.getElementById('pause-volume').value = masterVolume;
renderQualityButton();
renderLookPreferences();

function endGame(result) {
  if (gameEnded) return;
  gameEnded = true;
  releaseFirstPersonPointerLock();
  endOverlayEl.className = result;
  endOverlayEl.classList.add('visible');
  // Per-level Win/Lose title/message (Win/Lose Screen panel) override the
  // defaults below when set, so a project that never touches those fields
  // behaves exactly as before this existed.
  const configuredTitle = result === 'win' ? currentUiConfig.winTitle : currentUiConfig.loseTitle;
  const configuredMessage = result === 'win' ? currentUiConfig.winMessage : currentUiConfig.loseMessage;
  endOverlayTitleEl.textContent = configuredTitle || (result === 'win' ? '🏆 You Win!' : '💀 Game Over');
  document.getElementById('end-overlay-message').textContent = configuredMessage || '';
  document.getElementById('end-overlay-btn').textContent = playableOnlyMode ? 'Restart' : 'Back to Editor';
  const endAudioId = result === 'win' ? currentUiConfig.winAudioAssetId : currentUiConfig.loseAudioAssetId;
  const endAudio = findAudioAssetById(endAudioId);
  if (endAudio && endAudio.audioBuffer) {
    app.audio.playBuffer(endAudio.audioBuffer, { volume: 0.8 });
  } else if (result === 'win') {
    app.audio.playBlip({ frequency: 523, duration: 0.14, type: 'triangle' });
    setTimeout(() => { if (!app.destroyed) app.audio.playBlip({ frequency: 784, duration: 0.3, type: 'triangle' }); }, 120);
  } else {
    app.audio.playBlip({ frequency: 160, duration: 0.4, type: 'sawtooth' });
  }
}

document.getElementById('end-overlay-btn').addEventListener('click', () => {
  // Reload the embedded standalone payload for a completely fresh attempt,
  // including destroyed pickups, objectives, health and weapon state.
  if (playableOnlyMode) window.location.reload();
  else setEditorVisible(true);
});

// Objective/progress display: a persistent counter companion to Win/Lose
// (a toast fades, a live "Crates: 2/3" shouldn't). Reset on each play
// session, updatable from the fixed action or from a script via game.setObjective.
const objectiveEl = document.getElementById('game-objective');
function setObjective(text) {
  if (!text) {
    objectiveEl.classList.remove('visible');
    return;
  }
  objectiveEl.textContent = text;
  objectiveEl.classList.add('visible');
}

// --- Shared action-execution core ---
// Single source of truth for what each action TYPE does. Both the fixed
// trigger/action dropdown (runAction, below) and the Node Graph
// (runGraphActionNode, below) dispatch into this same table via
// executeAction -- so a new or fixed behavior happens in exactly one place
// instead of two parallel implementations drifting apart. GRAPH_NODE_TYPES
// (further down) is itself generated FROM this table's action entries.
//
// field.type: 'text' | 'number' | 'color' | 'checkbox' | 'target'.
// 'target' renders as a dropdown of placed items and is resolved through
// findItemById, so it survives rename/duplicate/Save-Load/Undo-Redo and
// no-ops gracefully if the target was since deleted -- see the Object
// References section near the top of this file. An action with no
// 'targetId' field, or one left as '(self)', acts on the item whose
// behavior fired it.
//
// `legacy: true` marks the original fixed-list actions, which persist as a
// flat `behavior.param` string (existing saved Crate Run projects already
// use this shape -- must keep loading unchanged). Newer actions persist as
// `behavior.params`, an object, since they take more than one field.
function resolveTarget(params, item) {
  if (!params || !params.targetId) return item;
  return findItemById(params.targetId) || null;
}
function targetEntity(target) {
  return target && target.kind === 'cube' ? target.entity : null;
}

// Player Health: a first-class pair of __gameState keys (still plain named
// counters underneath, see the comment above decrementCounter) that every
// health action reads/writes through this one init path, so health always
// exists with a valid maxHealth by the time anything touches it, regardless
// of whether an On Start behavior set it up first. maxHealthDefault comes
// from the active level's player settings (Player panel), defaulting to 100
// for projects/levels that never set one.
let simElapsed = 0;
// Tween animation -- see the moveTo/rotateTo/scaleTo actions above.
let activeTweens = [];
let hudTweenRuntime = null;
const hudTweenPreview = new Map();
const hudTweenTargetIds = new Set();
let hudTweenLevelScope = null;
function clearHudTweens() {
  hudTweenRuntime?.clear();
  hudTweenPreview.clear();
  hudTweenTargetIds.clear();
  hudTweenLevelScope = null;
}
function hudTweenScope() { return String(levels[currentLevelIndex]?.id || `level${currentLevelIndex}`); }
function startHudTween(channel, params) {
  if (!playMode || gameEnded || app.paused || typeof OpusHudTweens === 'undefined' || !params) return false;
  const element = currentUiConfig.hudElements.find(record => record.id === params.hudId);
  if (!element) return false;
  const scope = hudTweenScope();
  if (hudTweenLevelScope !== scope) clearHudTweens();
  if (!hudTweenRuntime) hudTweenRuntime = OpusHudTweens.create(easeValue);
  const started = hudTweenRuntime.start(scope,element.id,channel,params,{offsetX:element.offsetX ?? 0,offsetY:element.offsetY ?? 0,opacity:1,scale:1});
  if (started) { hudTweenLevelScope = scope; hudTweenTargetIds.add(element.id); }
  return started;
}
function tickHudTweens(dt) {
  if (!playMode || gameEnded || app.paused || !hudTweenRuntime) return;
  if (hudTweenLevelScope !== hudTweenScope()) { clearHudTweens(); return; }
  for (const id of hudTweenTargetIds) if (!currentUiConfig.hudElements.some(element => element.id === id)) {
    hudTweenRuntime.remove(hudTweenLevelScope,id); hudTweenTargetIds.delete(id);
  }
  hudTweenRuntime.tick(dt);
}
function hudTweenPresentation(id, preview = false) {
  return preview ? hudTweenPreview.get(id) || null : hudTweenRuntime?.presentation(hudTweenScope(),id) || null;
}
function easeValue(t, easing) {
  if (easing === 'easeIn') return t * t;
  if (easing === 'easeOut') return 1 - (1 - t) * (1 - t);
  if (easing === 'easeInOut') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return t; // linear
}
function startTween(entity, property, from, to, duration, easing) {
  activeTweens = activeTweens.filter((tw) => !(tw.entity === entity && tw.property === property));
  activeTweens.push({ entity, property, from, to, duration: Math.max(0.01, parseFloat(duration) || 1), elapsed: 0, easing: easing || 'linear' });
}
