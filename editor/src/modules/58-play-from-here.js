// ===== Play From Here =====
// Starts Play on the level being edited with the player placed where the
// creator is looking (or under the mouse, if it is over the viewport) and
// facing the same way, so testing a spot deep inside a big level needs no
// walk from the start. Deaths and void falls respawn here too; Stop returns
// to editing with nothing changed. 2D controllers keep their authored start.
let playFromHere = null; // { point, yaw, levelIndex } for the current session
let playFromHerePointer = null;

function playFromHereActive() { return !!playFromHere && playFromHere.levelIndex === currentLevelIndex; }
function playFromHereSpawn() { return playMode && playFromHereActive() ? playFromHere.point : null; }

// Where the player should start: the surface under the mouse, else under the
// middle of the view. Returns { point, yaw } or null.
function playFromHereTarget() {
  const rect = canvas.getBoundingClientRect();
  const at = playFromHerePointer || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const hit = typeof screenSurfaceHit === 'function' ? screenSurfaceHit(at.x, at.y, null) : null;
  const point = hit ? hit.point : screenToGroundPoint(at.x, at.y);
  if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return null;
  const forward = app.camera.getBasis().forward;
  const yaw = Math.hypot(forward.x, forward.z) > 1e-6 ? Math.atan2(forward.x, forward.z) : 0;
  return { point, yaw };
}
// Controllers read their facing at spawn; turn the fresh player to the view.
function applyPlayFromHereFacing(yaw) {
  if (!player || !player.entity || !Number.isFinite(yaw)) return;
  if (typeof firstPersonEntity !== 'undefined' && firstPersonEntity && player.entity === firstPersonEntity) {
    fpYaw = yaw;
    firstPersonEntity.quaternion = Opus.Quat.fromEuler(fpPitch, fpYaw, 0);
    return;
  }
  player.entity.rotationY = yaw;
  if (typeof thirdPersonEntity !== 'undefined' && player.entity === thirdPersonEntity) { tpCameraYaw = yaw; tpCameraWrittenYaw = null; }
  if (app.camera.mode === 'chase' && app.camera.targetEntity === player.entity) app.camera.setTarget(player.entity);
}
function startPlayFromHere() {
  if (playMode) return false;
  const type = currentPlayerSettings && currentPlayerSettings.controllerType;
  if (type === 'topdown2d' || type === 'platformer2d') {
    showStatus('2D games start from their authored player; playing normally.');
    document.getElementById('play-btn').click();
    return false;
  }
  const target = playFromHereTarget();
  if (!target) { showStatus('Point the view at the ground or an object to play from there.'); return false; }
  playFromHere = { point: target.point, yaw: target.yaw, levelIndex: currentLevelIndex };
  document.getElementById('play-btn').click();
  if (!playMode) { playFromHere = null; return false; }
  applyPlayFromHereFacing(target.yaw);
  showStatus('Playing from here · respawns return here · Stop to keep editing');
  return true;
}

canvas.addEventListener('pointermove', (event) => { if (!playMode) playFromHerePointer = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerleave', () => { if (!playMode) playFromHerePointer = null; });
document.getElementById('play-here-btn')?.addEventListener('click', () => {
  playFromHerePointer = null; // the button is outside the viewport: use the middle of the view
  startPlayFromHere();
  if (playMode && typeof releasePlayButtonFocusForGameplay === 'function') releasePlayButtonFocusForGameplay();
});
// P plays, Shift+P plays from here (edit mode only; games keep their own keys).
window.addEventListener('keydown', (event) => {
  if (playMode || event.code !== 'KeyP' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  if ([...document.querySelectorAll('[role="dialog"]')].some((d) => !d.hidden && d.offsetParent !== null)) return;
  event.preventDefault();
  if (event.shiftKey) startPlayFromHere(); else document.getElementById('play-btn').click();
});
// Follow the Play button itself: updates pause behind Start Screens.
(function syncPlayFromHereButton() {
  const play = document.getElementById('play-btn'), button = document.getElementById('play-here-btn');
  if (!play || !button || typeof MutationObserver === 'undefined') return;
  const sync = () => {
    const playing = play.classList.contains('playing');
    button.hidden = playing;
    if (!playing) playFromHere = null; // one session only
  };
  new MutationObserver(sync).observe(play, { attributes: true, attributeFilter: ['class'] });
  sync();
})();
if (typeof COMMAND_PALETTE_ACTIONS !== 'undefined') {
  COMMAND_PALETTE_ACTIONS.push({ label: 'Play From Here', hint: 'Shift+P', run: () => startPlayFromHere() });
}
