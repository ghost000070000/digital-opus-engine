// --- Levels ---
// A project can hold more than one level (`levels`, declared near
// `placed`); this is the editor-side UI + persistence for it. Kept as
// data alongside `placed`, not a rewrite of `placed` itself, so every
// existing single-level project/game (all of them, as of this batch)
// keeps working unchanged -- a one-entry `levels` array behaves exactly
// like there was never a levels concept at all.
function renderLevelList() {
  const select = document.getElementById('level-select');
  select.innerHTML = levels.map((l, i) => `<option value="${i}"${i === currentLevelIndex ? ' selected' : ''}>${i === startLevelIndex ? '★ ' : ''}${escapeHtml(l.name)}${i === currentLevelIndex ? ' (active)' : ''}</option>`).join('');
  syncLevelDescriptionField();
}
function syncLevelDescriptionField() {
  const index = Number(document.getElementById('level-select').value);
  document.getElementById('level-description-input').value = (!Number.isNaN(index) && levels[index]) ? (levels[index].description || '') : '';
}
document.getElementById('level-select').addEventListener('change', syncLevelDescriptionField);
document.getElementById('level-description-input').addEventListener('input', (e) => {
  const index = Number(document.getElementById('level-select').value);
  if (!Number.isNaN(index) && levels[index]) levels[index].description = e.target.value;
});
function renderLevelTransitionSettings() {
  const mode=document.getElementById('level-transition-mode'),duration=document.getElementById('level-transition-duration');
  if(mode)mode.value=levelTransitionConfig.mode;
  if(duration)duration.value=levelTransitionConfig.duration;
}
function addLevelFlow(draft) {
  if(playMode||draft?.levelId!==levels[currentLevelIndex]?.id)return {ok:false,reason:'Level changed or Play active. Close and reopen flow setup.'};
  if(!['start','click','interact'].includes(draft.trigger)||!['switchLevel','nextLevel','previousLevel','restartLevel'].includes(draft.action))return {ok:false,reason:'Choose an available Event and Level Action.'};
  const owners=placed.filter(item=>item.id===draft.ownerId);
  if(owners.length!==1||!['cube','sprite'].includes(owners[0].kind)||owners[0].behaviors!==undefined&&!Array.isArray(owners[0].behaviors))return {ok:false,reason:'Choose one available Cube or Sprite with editable Behaviors.'};
  if(draft.action==='switchLevel'){
    const destinations=levels.filter(level=>level.id===draft.destinationId);
    if(destinations.length!==1||destinations[0]===levels[currentLevelIndex])return {ok:false,reason:'Choose a different available Level. Use Restart Level for this Level.'};
  }
  const owner=owners[0],params=draft.action==='switchLevel'?{levelId:draft.destinationId}:{};
  if((owner.behaviors||[]).some(b=>b.trigger===draft.trigger&&b.action===draft.action&&(draft.action!=='switchLevel'||behaviorParams(b,ACTION_TYPES.switchLevel).levelId===draft.destinationId)))return {ok:true,changed:false};
  pushUndo();owner.behaviors=owner.behaviors||[];owner.behaviors.push({trigger:draft.trigger,action:draft.action,params});
  if(selectedItem===owner)renderBehaviorList(owner);
  return {ok:true,changed:true};
}
function closeLevelFlowEditor(){document.getElementById('level-flow-modal')?.remove();}
function openLevelFlowEditor() {
  if(playMode){showStatus('Stop Play before authoring Level flow.');return;}
  closeLevelFlowEditor();
  const levelId=levels[currentLevelIndex]?.id,owners=placed.filter(item=>['cube','sprite'].includes(item.kind)),destinations=levels.filter(level=>level.id!==levelId),host=document.createElement('div');
  host.id='level-flow-modal';host.className='modal-overlay visible';
  host.innerHTML=`<div class="modal" role="dialog" aria-label="Level flow editor"><h2>Level flow</h2><p>Compose an ordinary Behavior. Start runs on Level entry; Click requires object input; Interact uses the existing nearby interaction path. Next/Previous follow Level order; boundary Actions do nothing. Restart keeps session progress.</p><label>Object<select id="level-flow-owner">${owners.map(item=>`<option value="${escapeHtml(item.id)}"${item===selectedItem?' selected':''}>${escapeHtml(item.name||item.kind)}</option>`).join('')}</select></label><label>Event<select id="level-flow-event"><option value="interact">On Interact</option><option value="click">On Click</option><option value="start">On Start</option></select></label><label>Action<select id="level-flow-action"><option value="switchLevel">Switch Level</option><option value="nextLevel">Next Level</option><option value="previousLevel">Previous Level</option><option value="restartLevel">Restart Level</option></select></label><label>Destination<select id="level-flow-destination"><option value="">Choose Level</option>${destinations.map(level=>`<option value="${escapeHtml(level.id)}">${escapeHtml(level.name)}</option>`).join('')}</select></label><p>Use Inspector Behaviors to remove or replace a route; Graphs and Sequences share the same Actions. Missing destinations are retained for repair, never rebound.</p><p id="level-flow-status" role="status"></p><button id="level-flow-add">Add flow</button><button id="level-flow-close">Close</button></div>`;
  document.body.appendChild(host);
  const action=host.querySelector('#level-flow-action'),destination=host.querySelector('#level-flow-destination');action.onchange=()=>{destination.disabled=action.value!=='switchLevel';};
  host.querySelector('#level-flow-close').onclick=closeLevelFlowEditor;
  host.querySelector('#level-flow-add').onclick=()=>{const result=addLevelFlow({levelId,ownerId:host.querySelector('#level-flow-owner').value,trigger:host.querySelector('#level-flow-event').value,action:action.value,destinationId:destination.value});host.querySelector('#level-flow-status').textContent=result.ok?(result.changed?'Flow added. Undo restores the previous Behaviors.':'Identical flow already exists; unchanged.'):result.reason;};
}
document.getElementById('level-flow-open-btn').addEventListener('click',openLevelFlowEditor);
function restoreLevelTransitionSnapshot(record) {
  levelTransitionConfig=JSON.parse(JSON.stringify(record));
  renderLevelTransitionSettings();
}
function changeLevelTransitionField(key,value) {
  if(playMode)return false;
  if(key==='mode'){if(!['instant','fade'].includes(value))return false;}
  else if(key==='duration'){if(typeof value==='string'&&!value.trim())return false;value=Number(value);if(!Number.isFinite(value)||value<=0)return false;}
  else return false;
  if(Object.is(levelTransitionConfig[key],value))return true;
  pushUndo();levelTransitionConfig={...levelTransitionConfig,[key]:value};return true;
}
document.getElementById('level-transition-mode').addEventListener('change',e=>{changeLevelTransitionField('mode',e.target.value);renderLevelTransitionSettings();});
document.getElementById('level-transition-duration').addEventListener('change',e=>{changeLevelTransitionField('duration',e.target.value);renderLevelTransitionSettings();});
// Sequence required for a fade transition: fade out -> switch level
// (establishes Player/camera/On-Start state exactly like an instant switch
// already does, since it's the SAME underlying function) -> fade in. Uses
// real wall-clock time (setTimeout), not the simulation clock, so it fires
// identically whether or not the game happens to be paused, and needs zero
// special-casing for Delay nodes/timers/Save Game -- none of those are
// touched by this wrapper, only WHEN the existing switch function is called.
let levelTransitionRevision = 0;
let pendingLevelTransition = null;
function cancelLevelTransition() {
  levelTransitionRevision++;
  if(pendingLevelTransition !== null)clearTimeout(pendingLevelTransition);
  pendingLevelTransition = null;
  document.getElementById('level-fade-overlay')?.classList.remove('visible');
}
function switchLevelWithTransition(index, duringPlay) {
  if(!Number.isInteger(index)||index<0||index>=levels.length)return;
  cancelLevelTransition();
  const switchFn = duringPlay ? switchToLevelDuringPlay : switchToLevel;
  if (levelTransitionConfig.mode !== 'fade') { switchFn(index); return; }
  const overlay = document.getElementById('level-fade-overlay');
  if(!overlay){switchFn(index);return;}
  const revision=levelTransitionRevision,levelOwner=levels,sourceIndex=currentLevelIndex;
  overlay.style.transitionDuration = `${levelTransitionConfig.duration}s`;
  overlay.classList.add('visible');
  pendingLevelTransition=setTimeout(() => {
    if(revision!==levelTransitionRevision)return;
    pendingLevelTransition=null;
    if(levelOwner!==levels||sourceIndex!==currentLevelIndex||(duringPlay&&!playMode)){cancelLevelTransition();return;}
    switchFn(index);
    // Destination Start may have acquired a new fade. Never hide its overlay.
    const completedRevision=levelTransitionRevision;
    requestAnimationFrame(() => {if(completedRevision===levelTransitionRevision&&pendingLevelTransition===null)overlay.classList.remove('visible');});
  }, levelTransitionConfig.duration * 1000);
}
renderLevelList();

