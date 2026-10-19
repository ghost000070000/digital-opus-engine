// --- Property Animation (Wave 4) ---
// Generalizes Tweens into reusable, editor-authored clips instead of a
// single fire-and-forget move -- deliberately property animation only, NOT
// skeletal (see the glTF skeletal-animation utility gate below). Reuses
// `easeValue` (the exact same easing curve Tweens already use) so a clip's
// per-segment easing looks and feels identical to a Move To (Tween), not a
// second animation "feel" to learn.
//
// A clip lives on the cube item itself (`item.animationClips`, plain
// serializable data -- keyframe values are arrays/numbers, never live Vec3
// references). Playback state (`item._anim`) is intentionally NOT part of
// that data and never serialized -- it's runtime-only, the same "clone
// deeply for data, never persist live playback" split `spawnerState` and
// the hierarchy tick token already established.
function sampleAnimationTrack(keyframes, t, isVec3) {
  if (!keyframes || keyframes.length === 0) return null;
  const sorted = keyframes; // already kept time-sorted by the editor UI
  if (sorted.length === 1 || t <= sorted[0].t) return sorted[0].value;
  if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (t >= a.t && t <= b.t) {
      const localT = (b.t - a.t) > 0 ? (t - a.t) / (b.t - a.t) : 1;
      const et = easeValue(localT, b.easing);
      if (isVec3) return [a.value[0] + (b.value[0] - a.value[0]) * et, a.value[1] + (b.value[1] - a.value[1]) * et, a.value[2] + (b.value[2] - a.value[2]) * et];
      return a.value + (b.value - a.value) * et;
    }
  }
  return sorted[sorted.length - 1].value;
}
function updateAnimations(dt) {
  for (const item of placed) {
    if (!['cube','sprite'].includes(item.kind) || !item._anim || !item._anim.playing) continue;
    // Preview (Animation Editor's own Play button) plays the WORKING,
    // not-yet-saved clip directly -- `clipIndex: -1` + `_previewClip` is
    // never a shape a real Play Animation action produces (its clipIndex
    // always comes from a real array lookup), so there's no ambiguity.
    const clip = item._anim._previewClip || item._anim.componentClip || (item.animationClips && item.animationClips[item._anim.clipIndex]);
    if (!clip) { item._anim.playing = false; continue; }
    item._anim.elapsed += dt;
    let t = item._anim.elapsed;
    let ended = false;
    if (clip.loop === 'loop') {
      t = clip.duration > 0 ? t % clip.duration : 0;
    } else if (clip.loop === 'pingpong') {
      const cycle = clip.duration * 2;
      const m = cycle > 0 ? t % cycle : 0;
      t = m <= clip.duration ? m : cycle - m;
    } else if (t >= clip.duration) { t = clip.duration; ended = true; }
    const tr = clip.tracks;
    if (tr.position && tr.position.length) {
      const v = sampleAnimationTrack(tr.position, t, true); item.entity.position.set(v[0], v[1], v[2]);
      // The explicit component route is world-axis motion. Commit through the
      // canonical parent/socket seam so hierarchy resolution cannot undo it.
      // Historical authored clips keep their existing semantics unchanged.
      if (item._anim.componentClip && item.parentId) commitEditedWorldTransform(item);
    }
    if (tr.rotationY && tr.rotationY.length) item.entity.rotationY = sampleAnimationTrack(tr.rotationY, t, false);
    if (tr.scale && tr.scale.length) { const v = sampleAnimationTrack(tr.scale, t, true); item.entity.scale.set(v[0], v[1], v[2]); }
    if (tr.visible && tr.visible.length) {
      let v = tr.visible[0].value;
      for (const kf of tr.visible) if (kf.t <= t) v = kf.value;
      item.entity.visible = v;
      // Frame animation owns the Sprite artwork, not this sampled property
      // pose. Retain the sample transiently so a later frame refresh cannot
      // reveal a hidden object (including paused/completed clip holds).
      item._anim.visibilityPose = v;
    }
    if (ended) item._anim.playing = false;
  }
}

// --- Animation Editor (Wave 4) ---
// A simple scrollable list of track cards, not a timeline ruler -- same
// reasoning the Dialogue Editor already used for its own "not a node
// canvas" call (a clip's data is small; a full Dope-Sheet-style UI would be
// far more surface than authoring 2-6 keyframes actually needs). Values are
// "Add Keyframe" captures the authored pose at a time; Phase181 also edits
// typed values directly and scrubs using the same gameplay sampler.
const ANIM_TRACK_DEFS = [
  { key: 'position', label: 'Position', kind: 'vec3', capture: (e) => [e.position.x, e.position.y, e.position.z], format: (v) => `(${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`, apply: (e, v) => e.position.set(v[0], v[1], v[2]) },
  { key: 'rotationY', label: 'Rotation Y', kind: 'number', capture: (e) => e.rotationY, format: (v) => `${(v * 180 / Math.PI).toFixed(1)}°`, apply: (e, v) => { e.rotationY = v; } },
  { key: 'scale', label: 'Scale', kind: 'vec3', capture: (e) => [e.scale.x, e.scale.y, e.scale.z], format: (v) => `(${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`, apply: (e, v) => e.scale.set(v[0], v[1], v[2]) },
  { key: 'visible', label: 'Visibility', kind: 'bool', capture: (e) => e.visible, format: (v) => (v ? 'Visible' : 'Hidden'), apply: (e, v) => { e.visible = v; } },
];
function defaultAnimationClip() { return { name: '', duration: 2, loop: 'once', tracks: { position: [], rotationY: [], scale: [], visible: [] } }; }
function propertyAnimationInspectorHTML(item) {
  return `<div class="field-row"><label>Property Animation Clips</label><p class="field-help">Transform/visibility clips, separate from Sprite frame or skeletal animations. Rotation Y is the world Y-axis, not flat XY spin.</p><div id="anim-clip-list">${(item.animationClips||[]).map((clip,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><span style="flex:1">${escapeHtml(clip.name)} (${escapeHtml(clip.duration)}s, ${escapeHtml(clip.loop)})</span><button data-edit-clip="${i}">Edit</button><button data-delete-clip="${i}" aria-label="Delete clip ${escapeHtml(clip.name)}">✕</button></div>`).join('')||'<p class="field-help">No property clips yet.</p>'}</div><button id="add-anim-clip-btn" class="toolbar-btn">+ Add Animation Clip</button></div>`;
}
function bindPropertyAnimationInspector(item) {
  document.getElementById('add-anim-clip-btn').onclick=()=>openAnimationEditor(item,null);
  document.querySelectorAll('[data-edit-clip]').forEach(btn=>{btn.onclick=()=>openAnimationEditor(item,Number(btn.dataset.editClip));});
  document.querySelectorAll('[data-delete-clip]').forEach(btn=>{btn.onclick=()=>{if(playMode)return;pushUndo();item.animationClips.splice(Number(btn.dataset.deleteClip),1);renderInspector();};});
}
let animEditorState = null; // { item, clipIndex (null = new clip), clip (working deep clone) }
function openAnimationEditor(item, clipIndex) {
  if(playMode){showStatus('Stop Play before editing a Property Animation clip.');return;}
  const clip = (clipIndex != null && item.animationClips && item.animationClips[clipIndex])
    ? JSON.parse(JSON.stringify(item.animationClips[clipIndex]))
    : defaultAnimationClip();
  for (const def of ANIM_TRACK_DEFS) if (!clip.tracks[def.key]) clip.tracks[def.key] = [];
  animEditorState = { item, clipIndex: clipIndex != null ? clipIndex : null, clip };
  animationEditorFeedback('Edit values, then Preview or scrub. Save Clip commits; Cancel discards working edits.');
  document.getElementById('animation-editor-modal').classList.add('visible');
  renderAnimationEditor();
}
function closeAnimationEditor() {
  stopAnimationEditorPreview();
  document.getElementById('animation-editor-modal').classList.remove('visible');
  animEditorState = null;
}
function stopAnimationEditorPreview() {
  if(!animEditorState)return;
  const {item,previewPose}=animEditorState;
  item._anim=null;
  if(previewPose){
    item.entity.position.set(...previewPose.position);
    item.entity.scale.set(...previewPose.scale);
    item.entity.quaternion=previewPose.quaternion.clone();
    item.entity.visible=previewPose.visible;
    animEditorState.previewPose=null;
  }
}
function animationEditorFeedback(message){document.getElementById('anim-feedback').textContent=message;}
function validatePropertyAnimationClip(clip) {
  if(!clip||typeof clip.name!=='string'||!clip.name.trim())return 'Enter a clip name.';
  if(!Number.isFinite(clip.duration)||clip.duration<=0)return 'Duration must be a finite positive number.';
  if(!['once','loop','pingpong'].includes(clip.loop))return 'Choose Once, Loop or Ping-Pong.';
  for(const def of ANIM_TRACK_DEFS){
    const track=clip.tracks?.[def.key];
    if(!Array.isArray(track))return `Invalid ${def.label} track.`;
    const times=new Set();let previous=-Infinity;
    for(const kf of track){
      if(!Number.isFinite(kf.t)||kf.t<0||kf.t>clip.duration||times.has(kf.t))return `${def.label} times must be unique and between 0 and Duration.`;
      times.add(kf.t);
      if(kf.t<previous)return `${def.label} keyframes must be in time order.`;
      previous=kf.t;
      const valid=def.kind==='vec3'?Array.isArray(kf.value)&&kf.value.length===3&&kf.value.every(Number.isFinite):def.kind==='bool'?typeof kf.value==='boolean':Number.isFinite(kf.value);
      if(!valid)return `${def.label} values must be ${def.kind==='bool'?'Visible or Hidden':'finite numbers'}.`;
      if(def.kind!=='bool'&&!['linear','easeIn','easeOut','easeInOut'].includes(kf.easing))return `Choose a supported ${def.label} easing.`;
    }
  }
  return null;
}
function startAnimationEditorPreview(time=0,playing=true) {
  if(!animEditorState||playMode)return false;
  const {item,clip}=animEditorState;
  const error=validatePropertyAnimationClip(clip);
  if(error||!Number.isFinite(time)||time<0||time>clip.duration){animationEditorFeedback(error||'Preview time must be between 0 and Duration.');return false;}
  stopAnimationEditorPreview();
  const e=item.entity;
  animEditorState.previewPose={position:[e.position.x,e.position.y,e.position.z],scale:[e.scale.x,e.scale.y,e.scale.z],quaternion:e.quaternion.clone(),visible:e.visible};
  item._anim={clipIndex:-1,elapsed:time,playing:true,_previewClip:JSON.parse(JSON.stringify(clip))};
  updateAnimations(0); // Canonical property sampler, not a separate scrub renderer.
  if(!playing)item._anim.playing=false;
  animationEditorFeedback(playing?'Preview playing. Stop or Cancel restores the authored pose.':`Preview at ${time}s; authored pose is unchanged.`);
  return true;
}
function saveAnimationEditorClip() {
  if(!animEditorState||playMode)return false;
  const {item,clip,clipIndex}=animEditorState;
  if(!placed.includes(item)){animationEditorFeedback('This object is no longer available. Cancel and reopen.');return false;}
  const error=validatePropertyAnimationClip(clip);
  if(error){animationEditorFeedback(error);return false;}
  if((item.animationClips||[]).some((other,i)=>i!==clipIndex&&other.name===clip.name)){animationEditorFeedback('A clip with this name already exists on this object. Choose another name.');return false;}
  stopAnimationEditorPreview();
  if(clipIndex!=null&&JSON.stringify(item.animationClips?.[clipIndex])===JSON.stringify(clip)){closeAnimationEditor();showStatus('Clip unchanged; no history entry added.');return false;}
  pushUndo();
  item.animationClips=item.animationClips||[];
  const saved=JSON.parse(JSON.stringify(clip));
  if(clipIndex!=null)item.animationClips[clipIndex]=saved;else item.animationClips.push(saved);
  closeAnimationEditor();renderInspector();showStatus(`Saved animation clip "${saved.name}"`);return true;
}
function renderAnimationEditor() {
  const { item, clip } = animEditorState;
  document.getElementById('anim-clip-name').value = clip.name;
  document.getElementById('anim-clip-duration').value = clip.duration;
  document.getElementById('anim-clip-loop').value = clip.loop;
  document.getElementById('anim-clip-name').oninput = (e) => { clip.name = e.target.value; };
  document.getElementById('anim-clip-duration').onchange = (e) => {const v=e.target.value.trim()===''?NaN:Number(e.target.value);if(!Number.isFinite(v)||v<=0||ANIM_TRACK_DEFS.some(d=>clip.tracks[d.key].some(k=>k.t>v))){e.target.value=clip.duration;animationEditorFeedback('Duration must be positive and include every keyframe.');return;}stopAnimationEditorPreview();clip.duration=v;renderAnimationEditor();};
  document.getElementById('anim-clip-loop').onchange = (e) => { clip.loop = e.target.value; };
  document.getElementById('anim-preview-btn').onclick = () => startAnimationEditorPreview();
  document.getElementById('anim-stop-preview-btn').onclick=()=>{stopAnimationEditorPreview();animationEditorFeedback('Preview stopped; authored pose restored.');};
  const scrub=document.getElementById('anim-scrub');scrub.max=clip.duration;scrub.value=0;scrub.oninput=()=>startAnimationEditorPreview(Number(scrub.value),false);

  document.getElementById('anim-track-list').innerHTML = ANIM_TRACK_DEFS.map((def) => {
    const kfs = clip.tracks[def.key];
    const rows = kfs.map((kf, i) => `
      <div class="anim-keyframe-row">
        <input type="number" step="0.1" min="0" data-kf-time="${def.key}:${i}" value="${escapeHtml(kf.t)}">s
        <span style="display:flex;flex:1;gap:4px">${def.kind==='bool'?`<select aria-label="${def.label} keyframe value" data-kf-value="${def.key}:${i}:0"><option value="true"${kf.value===true?' selected':''}>Visible</option><option value="false"${kf.value===false?' selected':''}>Hidden</option></select>`:(def.kind==='vec3'?kf.value:[kf.value*180/Math.PI]).map((v,axis)=>`<label style="display:flex;align-items:center;gap:3px">${def.kind==='vec3'?['X','Y','Z'][axis]:'°'}<input aria-label="${def.label} ${def.kind==='vec3'?['X','Y','Z'][axis]:'degrees'} keyframe value" type="number" step="0.1" data-kf-value="${def.key}:${i}:${axis}" value="${escapeHtml(v)}" style="width:90px"></label>`).join('')}</span>
        ${def.kind !== 'bool' ? `<select data-kf-easing="${def.key}:${i}">${['linear', 'easeIn', 'easeOut', 'easeInOut'].map((e) => `<option value="${e}"${kf.easing === e ? ' selected' : ''}>${e}</option>`).join('')}</select>` : ''}
        <button data-kf-delete="${def.key}:${i}">✕</button>
      </div>`).join('');
    return `<div class="anim-track-card">
      <strong>${def.label}</strong> <span style="color:#66759a;font-size:11px">(${kfs.length} keyframe${kfs.length === 1 ? '' : 's'})</span>
      <div>${rows || '<p style="color:#66759a;font-size:11px;margin:4px 0">No keyframes yet.</p>'}</div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:8px">
        <input type="number" id="add-time-${def.key}" step="0.1" min="0" value="0" style="width:56px">s
        <button data-add-kf="${def.key}" class="toolbar-btn" style="margin-bottom:0">+ Add Keyframe (captures live ${def.label})</button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('[data-kf-time]').forEach((el) => {
    el.onchange = (e) => {
      const [key, i] = el.dataset.kfTime.split(':');
      const v=e.target.value.trim()===''?NaN:Number(e.target.value),track=clip.tracks[key];
      if(!Number.isFinite(v)||v<0||v>clip.duration||track.some((k,j)=>j!==Number(i)&&Math.abs(k.t-v)<.001)){e.target.value=track[Number(i)].t;animationEditorFeedback('Time must be unique on this track and between 0 and Duration.');return;}
      stopAnimationEditorPreview();track[Number(i)].t=v;track.sort((a,b)=>a.t-b.t);renderAnimationEditor();
    };
  });
  document.querySelectorAll('[data-kf-value]').forEach(el=>{el.onchange=()=>{const [key,index,axis]=el.dataset.kfValue.split(':'),def=ANIM_TRACK_DEFS.find(d=>d.key===key),kf=clip.tracks[key][Number(index)];const v=def.kind==='bool'?el.value==='true':el.value.trim()===''?NaN:Number(el.value);if(def.kind!=='bool'&&!Number.isFinite(v)){animationEditorFeedback('Keyframe values must be finite numbers.');renderAnimationEditor();return;}stopAnimationEditorPreview();if(def.kind==='vec3')kf.value[Number(axis)]=v;else kf.value=def.kind==='number'?v*Math.PI/180:v;};});
  document.querySelectorAll('[data-kf-easing]').forEach((el) => {
    el.onchange = (e) => { const [key, i] = el.dataset.kfEasing.split(':'); clip.tracks[key][Number(i)].easing = e.target.value; };
  });
  document.querySelectorAll('[data-kf-delete]').forEach((el) => {
    el.onclick = () => { const [key, i] = el.dataset.kfDelete.split(':'); clip.tracks[key].splice(Number(i), 1); renderAnimationEditor(); };
  });
  document.querySelectorAll('[data-add-kf]').forEach((el) => {
    el.onclick = () => {
      const key = el.dataset.addKf;
      const def = ANIM_TRACK_DEFS.find((d) => d.key === key);
      const raw=document.getElementById(`add-time-${key}`).value,t=raw.trim()===''?NaN:Number(raw);
      if(!Number.isFinite(t)||t<0||t>clip.duration){animationEditorFeedback('Keyframe time must be between 0 and Duration.');return;}
      stopAnimationEditorPreview();
      const value = def.capture(item.entity);
      const track = clip.tracks[key];
      const existingIdx = track.findIndex((kf) => Math.abs(kf.t - t) < 0.001);
      const kf = { t, value, easing: 'linear' };
      if (existingIdx !== -1) track[existingIdx] = kf; else track.push(kf);
      track.sort((a, b) => a.t - b.t);
      renderAnimationEditor();
    };
  });
  if (typeof renderAnimationTimeline === 'function') renderAnimationTimeline(); // dopesheet + Key buttons (60-animation-timeline.js)
}
document.getElementById('animation-editor-cancel-btn').addEventListener('click', closeAnimationEditor);
document.getElementById('animation-editor-save-btn').addEventListener('click', saveAnimationEditorClip);

function tickTweens(dt) {
  tickHudTweens(dt);
  if (activeTweens.length === 0) return;
  const stillActive = [];
  for (const tw of activeTweens) {
    if (tw.entity.destroyed) continue; // dropped, not resumed -- the object is gone
    tw.elapsed += dt;
    const t = Math.min(1, tw.elapsed / tw.duration);
    const et = easeValue(t, tw.easing);
    if (tw.property === 'position') tw.entity.position = tw.from.add(tw.to.sub(tw.from).scale(et));
    else if (tw.property === 'scale') tw.entity.scale.set(tw.from.x + (tw.to.x - tw.from.x) * et, tw.from.y + (tw.to.y - tw.from.y) * et, tw.from.z + (tw.to.z - tw.from.z) * et);
    else if (tw.property === 'rotationY') tw.entity.rotationY = tw.from + (tw.to - tw.from) * et;
    if (t < 1) stillActive.push(tw);
  }
  activeTweens = stillActive;
}
