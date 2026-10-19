// ===== Animation timeline =====
// The Property Animation editor docks at the bottom of the window so the
// scene stays usable above it, and gains a dopesheet: one row per track,
// a diamond per keyframe and a playhead. Workflow: drag the playhead to a
// time, pose the object in the scene (move / rotate / scale it), press Key.
// Diamonds can be clicked (jump there), dragged (retime) or deleted (Delete).
// Keys record the pose shown in the scene; the authored pose is restored
// whenever the preview stops, exactly as before.
let animTimeline = { owner: null, time: 0, selected: null, drag: null };
const ANIM_TIMELINE_SNAP = 0.05;

function animTimelineSnap(t, duration) {
  return Math.max(0, Math.min(duration, Math.round(t / ANIM_TIMELINE_SNAP) * ANIM_TIMELINE_SNAP));
}
function animTimelineTickStep(duration) {
  return duration <= 2 ? 0.25 : duration <= 6 ? 0.5 : duration <= 20 ? 1 : 5;
}
// Insert or replace the keyframe at time t (same time = replace, keeping its easing).
function upsertAnimationKeyframe(track, t, value) {
  const existing = track.find((kf) => Math.abs(kf.t - t) < 0.001);
  if (existing) { existing.value = value; return existing; }
  const kf = { t, value, easing: 'linear' };
  track.push(kf);
  track.sort((a, b) => a.t - b.t);
  return kf;
}
// Move a keyframe in time; refused when another key on the track sits there.
function retimeAnimationKeyframe(track, kf, t) {
  if (track.some((other) => other !== kf && Math.abs(other.t - t) < 0.001)) return false;
  kf.t = t;
  track.sort((a, b) => a.t - b.t);
  return true;
}

function animTimelineSetTime(t) {
  if (!animEditorState) return;
  const { clip, item } = animEditorState;
  animTimeline.time = animTimelineSnap(t, clip.duration);
  // Scrubbing needs a valid clip; give an unnamed new clip a sensible name.
  if (!clip.name || !clip.name.trim()) {
    clip.name = `${item.name || 'Object'} animation`;
    const nameInput = document.getElementById('anim-clip-name');
    if (nameInput) nameInput.value = clip.name;
  }
  const scrub = document.getElementById('anim-scrub');
  if (scrub) scrub.value = animTimeline.time;
  startAnimationEditorPreview(animTimeline.time, false);
  renderAnimationTimelineLanes();
}
// Record the pose currently shown in the scene for the given tracks at the playhead.
function keyAnimationTracks(keys) {
  if (!animEditorState || playMode) return false;
  const { item, clip } = animEditorState;
  const t = animTimeline.time;
  const captured = keys.map((key) => [key, ANIM_TRACK_DEFS.find((def) => def.key === key)]).filter(([, def]) => def).map(([key, def]) => [key, def.capture(item.entity)]);
  stopAnimationEditorPreview(); // restore the authored pose; the keys keep what was shown
  for (const [key, value] of captured) upsertAnimationKeyframe(clip.tracks[key], t, Array.isArray(value) ? value.slice() : value);
  renderAnimationEditor();
  animTimelineSetTime(t);
  animationEditorFeedback(`Keyed ${captured.map(([key]) => ANIM_TRACK_DEFS.find((d) => d.key === key).label).join(', ')} at ${t.toFixed(2)}s. Save Clip to keep it.`);
  return true;
}

function renderAnimationTimeline() {
  if (!animEditorState) return;
  if (animTimeline.owner !== animEditorState) animTimeline = { owner: animEditorState, time: 0, selected: null, drag: null };
  const body = document.getElementById('animation-editor-body'), list = document.getElementById('anim-track-list');
  if (!body || !list) return;
  let host = document.getElementById('anim-timeline');
  if (!host) {
    host = document.createElement('div');
    host.id = 'anim-timeline';
    body.insertBefore(host, list);
  }
  host.innerHTML = `
    <div class="anim-tl-head">
      <button type="button" id="anim-key-pose" class="toolbar-btn" title="Record the object's current Position, Rotation Y and Scale at the playhead">◆ Key pose at <span id="anim-tl-time">${animTimeline.time.toFixed(2)}</span>s</button>
      <span class="field-help">Drag the playhead, pose the object in the scene above, press Key. Drag diamonds to retime · Delete removes the selected key.</span>
    </div>
    <div class="anim-tl-grid">
      <div class="anim-tl-labels"><div class="anim-tl-ruler-label"></div>${ANIM_TRACK_DEFS.map((def) => `<div class="anim-tl-label"><span>${escapeHtml(def.label)}</span><button type="button" data-tl-key="${def.key}" title="Key ${escapeHtml(def.label)} at the playhead">◆</button></div>`).join('')}</div>
      <div class="anim-tl-lanes" id="anim-tl-lanes"></div>
    </div>`;
  host.querySelector('#anim-key-pose').onclick = () => keyAnimationTracks(['position', 'rotationY', 'scale']);
  host.querySelectorAll('[data-tl-key]').forEach((button) => { button.onclick = () => keyAnimationTracks([button.dataset.tlKey]); });
  renderAnimationTimelineLanes();
  const scrub = document.getElementById('anim-scrub');
  if (scrub) scrub.value = animTimeline.time;
}
function renderAnimationTimelineLanes() {
  const lanes = document.getElementById('anim-tl-lanes');
  if (!lanes || !animEditorState) return;
  const { clip } = animEditorState, duration = clip.duration, pct = (t) => `${(t / duration) * 100}%`;
  const step = animTimelineTickStep(duration), ticks = [];
  for (let t = 0; t <= duration + 1e-9; t += step) ticks.push(t);
  lanes.innerHTML = `<div class="anim-tl-ruler">${ticks.map((t) => `<span style="left:${pct(t)}">${+t.toFixed(2)}</span>`).join('')}</div>
    ${ANIM_TRACK_DEFS.map((def) => `<div class="anim-tl-lane" data-tl-lane="${def.key}">${(clip.tracks[def.key] || []).map((kf, index) => {
      const selected = animTimeline.selected && animTimeline.selected.key === def.key && animTimeline.selected.kf === kf;
      return `<div class="anim-tl-diamond${selected ? ' selected' : ''}" data-tl-diamond="${def.key}:${index}" style="left:${pct(kf.t)}" title="${escapeHtml(def.label)} ${kf.t}s · ${escapeHtml(def.format(kf.value))}"></div>`;
    }).join('')}</div>`).join('')}
    <div class="anim-tl-playhead" style="left:${pct(animTimeline.time)}"></div>`;
  const label = document.getElementById('anim-tl-time');
  if (label) label.textContent = animTimeline.time.toFixed(2);
}
function animTimelineTimeAt(event) {
  const lanes = document.getElementById('anim-tl-lanes');
  const rect = lanes.getBoundingClientRect();
  return animTimelineSnap(((event.clientX - rect.left) / Math.max(1, rect.width)) * animEditorState.clip.duration, animEditorState.clip.duration);
}

document.addEventListener('pointerdown', (event) => {
  const lanes = event.target.closest && event.target.closest('#anim-tl-lanes');
  if (!lanes || !animEditorState || playMode || event.button !== 0) return;
  event.preventDefault();
  const diamond = event.target.closest('[data-tl-diamond]');
  if (diamond) {
    const [key, index] = diamond.dataset.tlDiamond.split(':');
    const kf = animEditorState.clip.tracks[key][Number(index)];
    animTimeline.selected = { key, kf };
    animTimeline.drag = { mode: 'key', key, kf, startX: event.clientX, moved: false };
    animTimelineSetTime(kf.t);
  } else {
    animTimeline.selected = null;
    animTimeline.drag = { mode: 'scrub' };
    animTimelineSetTime(animTimelineTimeAt(event));
  }
});
window.addEventListener('pointermove', (event) => {
  const drag = animTimeline.drag;
  if (!drag || !animEditorState) return;
  if (drag.mode === 'scrub') { animTimelineSetTime(animTimelineTimeAt(event)); return; }
  if (!drag.moved && Math.abs(event.clientX - drag.startX) < 4) return;
  drag.moved = true;
  const t = animTimelineTimeAt(event);
  if (Math.abs(t - drag.kf.t) < 1e-9) return;
  stopAnimationEditorPreview();
  if (retimeAnimationKeyframe(animEditorState.clip.tracks[drag.key], drag.kf, t)) { animTimeline.time = t; renderAnimationTimelineLanes(); }
});
window.addEventListener('pointerup', () => {
  const drag = animTimeline.drag;
  animTimeline.drag = null;
  if (drag && drag.mode === 'key' && drag.moved && animEditorState) {
    renderAnimationEditor(); // refresh the numeric rows below
    animTimelineSetTime(drag.kf.t);
    animationEditorFeedback(`Moved the key to ${drag.kf.t.toFixed(2)}s. Save Clip to keep it.`);
  }
});
document.getElementById('anim-scrub')?.addEventListener('input', (event) => {
  if (!animEditorState) return;
  animTimeline.time = Number(event.target.value) || 0;
  renderAnimationTimelineLanes();
});
// Delete removes the selected key; while the editor is open Delete never
// deletes the object being animated.
window.addEventListener('keydown', (event) => {
  if (!animEditorState || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const selected = animTimeline.selected;
  if (!selected) return;
  const track = animEditorState.clip.tracks[selected.key], index = track.indexOf(selected.kf);
  if (index < 0) return;
  stopAnimationEditorPreview();
  track.splice(index, 1);
  animTimeline.selected = null;
  renderAnimationEditor();
  animTimelineSetTime(animTimeline.time);
  animationEditorFeedback('Removed the key. Save Clip to keep the change.');
}, true);
