// --- Per-level Ambient Audio ---
// Deliberately simple: at most one looping audio-asset track per level,
// authored as {audioAssetId, volume}, no crossfade/layering/randomization.
// Distinct from AudioEngine's own startAmbientDrone() (a hardcoded
// procedural noise generator, unused by the editor) -- this is real
// author-provided content, picked per level the same way Environment or
// Player Settings are.
function defaultAmbientAudioConfig() { return { audioAssetId: null, volume: 0.4 }; }
let currentAmbientAudioConfig = defaultAmbientAudioConfig();
let activeAmbientHandle = null;
function stopAmbientAudio() {
  if (activeAmbientHandle) { activeAmbientHandle.stop(); activeAmbientHandle = null; }
  activeAudioZones.clear();
  audibleAudioZoneId = null;
}
// Wave 9B (Priority: Audio Zone overlap-stacking fix, Sections 37-40): a
// REAL active-zone membership tracker, replacing Wave 9's single "currently
// audible zone id" scalar. `activeAudioZones` holds every zone the Player
// is CURRENTLY (geometrically) inside, keyed by zone item id; the winner is
// recomputed from this whole set on every Enter/Exit, not just remembered
// as "the one that most recently became audible." This is what fixes the
// bounded gap Wave 9 documented and shipped anyway: leaving the top
// zone while a second, lower-priority zone is STILL entered now correctly
// reveals that second zone's ambience, instead of falling straight through
// to level ambient.
let activeAudioZones = new Map(); // zoneId -> {priority, audioAssetId, volume, fadeDuration}
let audibleAudioZoneId = null; // which entry in the map (if any) is the CURRENT winner -- null means level ambient
// Recomputes "highest-priority zone in `activeAudioZones`, or level
// ambient if none" and crossfades ONLY if the winner actually changed
// (Section 39's own "no unnecessary fade restart" -- entering/leaving a
// zone that was never going to win is silently a no-op here).
function recomputeAudioZoneWinner(fade) {
  let winnerId = null, winner = null;
  for (const [zoneId, cfg] of activeAudioZones) {
    if (!winner || cfg.priority > winner.priority) { winner = cfg; winnerId = zoneId; }
  }
  if (winnerId === audibleAudioZoneId) return; // Section 39: winner unchanged -- do nothing
  audibleAudioZoneId = winnerId;
  if (winner) {
    crossfadeAmbientTo(winner.audioAssetId, winner.volume, fade);
  } else {
    const base = levels[currentLevelIndex] ? levels[currentLevelIndex].ambientAudio : null;
    crossfadeAmbientTo(base ? base.audioAssetId : null, base && base.volume != null ? base.volume : 0.4, fade);
  }
}
// Wave 9 (Priority G/Section 69): the one real crossfade primitive both the
// Audio Zone action and level-ambient start/switch route through -- reuses
// the engine's new `playBuffer(...).setVolume(value, rampSeconds)` (real
// Web Audio gain automation) rather than a stop/start pop. `fade <= 0`
// keeps the exact Wave 8 hard-switch (old stops immediately, new starts at
// full target volume) so every pre-Wave-9 Audio Zone/level ambient with no
// Fade Duration authored is byte-identical to before.
function crossfadeAmbientTo(audioAssetId, volume, fade) {
  const old = activeAmbientHandle;
  if (!audioAssetId) {
    if (old) {
      if (fade > 0) { old.setVolume(0, fade); setTimeout(() => old.stop(), fade * 1000 + 60); }
      else old.stop();
    }
    activeAmbientHandle = null;
    return;
  }
  const asset = findAudioAssetById(audioAssetId);
  if (!asset || !asset.audioBuffer) return;
  const handle = app.audio.playBuffer(asset.audioBuffer, { loop: true, volume: fade > 0 ? 0 : volume, category: 'ambient' });
  if (fade > 0) handle.setVolume(volume, fade);
  activeAmbientHandle = handle;
  if (old) {
    if (fade > 0) { old.setVolume(0, fade); setTimeout(() => old.stop(), fade * 1000 + 60); }
    else old.stop();
  }
}
// Called at Play start and on every mid-play level switch -- always stops
// whatever was playing first (a level with no Ambient Audio configured
// correctly means silence, not the previous level's track continuing).
function startAmbientAudioForCurrentLevel() {
  stopAmbientAudio();
  const cfg = currentAmbientAudioConfig;
  if (!cfg.audioAssetId) return;
  const asset = findAudioAssetById(cfg.audioAssetId);
  if (!asset) return;
  if (asset.audioBuffer) {
    activeAmbientHandle = app.audio.playBuffer(asset.audioBuffer, { loop: true, volume: cfg.volume, category: 'ambient' });
  } else {
    // Still decoding (e.g. Play pressed immediately after a project just
    // loaded) -- retry once decode finishes, but only if this level's
    // config still points at the same asset by then (a fast level switch
    // in between must not start stale ambient audio for a level the
    // player has already left).
    (asset.pendingCallbacks = asset.pendingCallbacks || []).push(() => {
      if (currentAmbientAudioConfig.audioAssetId === asset.id) startAmbientAudioForCurrentLevel();
    });
  }
}
// Wave 9C (Priority C, Sections 31-37): Fog Zones -- deliberately reuses
// the EXACT same active-zone-membership shape the Audio Zone overlap fix
// (Wave 9B) already established (`Map`, recompute-on-Enter/Exit, "highest
// priority wins, exiting the top reveals the next-highest still-active
// zone"), not a second, independently-invented priority system (Section
// 34's own explicit warning not to reintroduce that bug in Fog). Scope is
// fog ONLY (`skyHorizon`/`fogDensity`, Section 36's own explicit
// exclusion of sun/shadows/panorama) -- `app.setEnvironment` is called
// with ONLY those two keys, every frame a blend is in flight, never a
// broader environment object that could stomp an author's other settings.
let activeFogZones = new Map(); // zoneId -> {priority, fogColor:[r,g,b], fogDensity, blendDuration}
let audibleFogZoneId = null;
let baseFogColor = null, baseFogDensity = null; // this level's AUTHORED fog, captured once at Play start -- never overwritten by a zone
let fogBlendState = null; // {fromColor, fromDensity, toColor, toDensity, duration, elapsed}
function initFogZonesForCurrentLevel() {
  activeFogZones.clear();
  audibleFogZoneId = null;
  fogBlendState = null;
  const env = (levels[currentLevelIndex] && levels[currentLevelIndex].environment) || {};
  baseFogColor = env.skyHorizon ? env.skyHorizon.slice() : [0.6, 0.65, 0.75];
  baseFogDensity = env.fogDensity != null ? env.fogDensity : 0.02;
}
function startFogBlend(toColor, toDensity, duration) {
  const cur = app.getEnvironment();
  const fromColor = cur.skyHorizon ? cur.skyHorizon.slice() : baseFogColor;
  const fromDensity = cur.fogDensity != null ? cur.fogDensity : baseFogDensity;
  if (!duration || duration <= 0) { app.setEnvironment({ skyHorizon: toColor, fogDensity: toDensity }); fogBlendState = null; return; }
  fogBlendState = { fromColor, fromDensity, toColor, toDensity, duration, elapsed: 0 };
}
function tickFogBlend(dt) {
  if (!fogBlendState) return;
  const b = fogBlendState;
  b.elapsed += dt;
  const t = Math.min(1, b.elapsed / b.duration);
  const color = [0, 1, 2].map((i) => b.fromColor[i] + (b.toColor[i] - b.fromColor[i]) * t);
  const density = b.fromDensity + (b.toDensity - b.fromDensity) * t;
  app.setEnvironment({ skyHorizon: color, fogDensity: Math.max(0, density) });
  if (t >= 1) fogBlendState = null;
}
// Same "recompute the whole membership set's winner, only act if it
// actually changed" shape `recomputeAudioZoneWinner` already established.
function recomputeFogZoneWinner(duration) {
  let winnerId = null, winner = null;
  for (const [zoneId, cfg] of activeFogZones) { if (!winner || cfg.priority > winner.priority) { winner = cfg; winnerId = zoneId; } }
  if (winnerId === audibleFogZoneId) return;
  audibleFogZoneId = winnerId;
  if (winner) startFogBlend(winner.fogColor, winner.fogDensity, duration != null ? duration : winner.blendDuration);
  else startFogBlend(baseFogColor, baseFogDensity, duration != null ? duration : 0.6);
}
function applyLevelAmbientAudio(index) {
  const saved = levels[index].ambientAudio;
  currentAmbientAudioConfig = saved ? { ...defaultAmbientAudioConfig(), ...saved } : defaultAmbientAudioConfig();
  renderAmbientAudioPanel();
}
function renderAmbientAudioPanel() {
  const sel = document.getElementById('ambient-audio-select');
  const volInput = document.getElementById('ambient-audio-volume');
  if (!sel || !volInput) return;
  sel.innerHTML = '<option value="">None</option>' + audioAssets.map((a) => `<option value="${a.id}"${currentAmbientAudioConfig.audioAssetId === a.id ? ' selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
  volInput.value = currentAmbientAudioConfig.volume;
}
document.getElementById('import-audio-btn').addEventListener('click', () => {
  document.getElementById('import-audio-input').click();
});
document.getElementById('asset-dependency-refresh')?.addEventListener('click',refreshAssetDependencyViewer);
let assetReplacementPreviewSelection=null;
document.getElementById('asset-replacement-preview')?.addEventListener('click',previewAssetReplacementSelection);
document.getElementById('asset-replacement-apply')?.addEventListener('click',applyAssetReplacementSelection);
document.getElementById('asset-replacement-cancel')?.addEventListener('click',cancelAssetReplacementPreview);
document.getElementById('import-audio-input').addEventListener('change', async (e) => {
  const files=Array.from(e.target.files||[]);e.target.value='';if(!files.length)return;await runAssetImportBatch(files,'audio');
});
document.getElementById('ambient-audio-select').addEventListener('change', (e) => {
  currentAmbientAudioConfig.audioAssetId = e.target.value || null;
});
document.getElementById('ambient-audio-volume').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  if (!Number.isNaN(v) && v >= 0 && v <= 1) currentAmbientAudioConfig.volume = v;
});
renderAmbientAudioPanel();

function meshTag(mesh) {
  if (mesh === cubeMesh) return 'cube';
  if (mesh === mineMesh) return 'mine';
  if (mesh === boostMesh) return 'boost';
  if (mesh === wedgeMesh) return 'wedge';
  if (mesh === billboardMesh) return 'billboard';
  return 'custom';
}

