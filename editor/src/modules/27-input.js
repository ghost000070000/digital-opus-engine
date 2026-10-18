// --- Gamepad (optional) ---
// A small, generic mapping layer onto the SAME key codes every controller
// already reads (Input.simulateKeyDown/Up) -- no gamepad-specific code path
// in the Player Controllers, Boost action, or Interact, mirroring exactly
// how touch buttons already work. Deadzone on the left stick avoids drift
// on cheap/worn sticks constantly reporting a tiny nonzero axis value.
const GAMEPAD_STICK_DEADZONE = 0.25;
// Gamepad face buttons: A/Cross = Jump/Boost, B/Circle = Interact, X/Square
// = Attack -- all three (and Move on the left stick) read the CURRENT
// Input Action binding at poll time (see pollGamepad below), not a fixed
// map, so a rebind takes effect on gamepad with zero gamepad-specific code.
// --- Input Actions (Wave 4) ---
// A small, deliberately bounded rebind layer: named actions
// (`input.wasPressed(inputActionMap.NAME)` replacing a hardcoded key code
// directly) for Interact and Attack specifically -- the two inputs that
// were ALREADY dispatched from one central place (this file's own gameplay
// onUpdate) rather than embedded inside a specific Player Controller's own
// movement math. Movement (WASD) and Jump/Boost (Space) stayed hardcoded in
// Wave 4 for exactly that reason (threading a config lookup through three
// separate controllers' physics functions was real regression risk for a
// part of the input surface nobody had asked to rebind yet).
//
// Wave 5, Priority D: finishes the job. Move Forward/Back/Left/Right and
// Jump now go through this same map too, read by all four Player
// Controllers (`inputActionMap.moveForward` etc, see each controller's own
// movement block) instead of a hardcoded 'KeyW'. Every default value is the
// exact key it always was (KeyW/A/S/D, Space), so "existing controller
// behavior remains unchanged under default mappings" holds trivially -- and
// the Arrow keys stay a permanent, non-rebindable SECONDARY binding
// alongside whatever the primary is rebound to (every movement check below
// is `isDown(inputActionMap.moveForward) || isDown('ArrowUp')`, never just
// the mapped key alone), so a player who's used to arrows never loses them
// even after the primary WASD key is rebound to something else.
// Wave 6 (Priority B/Section 17-18): Crouch/Sprint join the map the exact
// same way Jump did in Wave 5 -- new named actions, real default keys
// (KeyC/ShiftLeft, chosen to avoid the browser/OS's own reserved Ctrl+key
// chords), read by name (`inputActionMap.crouch`/`.sprint`) by Third-Person
// and First-Person only (see CONTROLLER_RELEVANT_ACTIONS below), fully
// rebindable and warn-not-block conflict-checked like every other action.
let inputActionMap = { interact: 'KeyF', attack: 'KeyQ', moveForward: 'KeyW', moveBack: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD', jump: 'Space', crouch: 'KeyC', sprint: 'ShiftLeft' };
// Wave 8 (Priority E/Section 30): `inventory` -- one new logical Input
// Action, reaching touch/gamepad through the exact same
// simulateKeyDown/Up remapping layer every other logical action already
// uses (no device-specific code needed, the same reasoning this project's
// own Gamepad Utility Gate re-confirmed for Jump back in Wave 3).
// Wave 9 (Priority A/Section 9): `reload` and `switchWeapon` join the same
// author-default/player-override architecture every other Input Action
// already uses -- no separate device logic, works through keyboard/touch/
// gamepad exactly like Interact/Attack.
const INPUT_ACTION_LABELS = { moveForward: 'Move Forward', moveBack: 'Move Back', moveLeft: 'Move Left', moveRight: 'Move Right', jump: 'Jump', interact: 'Interact', attack: 'Attack', crouch: 'Crouch', sprint: 'Sprint', inventory: 'Inventory', reload: 'Reload', switchWeapon: 'Switch Weapon' };
const INPUT_ACTION_DEFAULTS = { interact: 'KeyF', attack: 'KeyQ', moveForward: 'KeyW', moveBack: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD', jump: 'Space', crouch: 'KeyC', sprint: 'ShiftLeft', inventory: 'KeyI', reload: 'KeyR', switchWeapon: 'KeyV' };
let playMode = false; // initialized before the first authoring-panel render
let rebindingAction = null; // action name currently waiting for its next keydown, or null
let inputActionAssets = []; // project-local metadata; inputActionMap remains the sole default-binding store
let inputActionSets = []; // project-wide per-controller display collections, never gameplay gating
let inputDeviceMappings = []; // versioned project defaults, separate from player preferences
let editingInputDeviceAction = 'interact';
let touchInputMappingPage = 0;
let inputDeviceRuntime = null; // validated transient session metadata; never serialized
let editingInputActionSetController = 'firstperson';
let nextInputActionAssetId = 1; // high-water mark; never rolled back by deletion or Undo
function reconcileInputActionAssetIds(project) {
  const reserve=id=>{if(typeof id!=='string' || !/^input-action-[1-9]\d{0,14}$/.test(id))return;const next=Number(id.slice(13))+1;if(Number.isSafeInteger(next))nextInputActionAssetId=Math.max(nextInputActionAssetId,next);};
  if(Number.isSafeInteger(project?.inputActionAssetNextId) && project.inputActionAssetNextId>0 && project.inputActionAssetNextId<=1000000000000000) nextInputActionAssetId=Math.max(nextInputActionAssetId,project.inputActionAssetNextId);
  for(const key of Object.keys(project?.inputActionMap||{}))reserve(key);
  for(const record of Array.isArray(project?.inputActionAssets)?project.inputActionAssets:[])reserve(record?.id);
  // Reserve only structured input references, never literal text resembling IDs.
  const seen=new Set();let budget=100000;
  let incomplete=false;
  const scan=(value,depth=0)=>{if(!value || typeof value!=='object' || seen.has(value))return;if(depth>32 || --budget<0){incomplete=true;return;}seen.add(value);
    if(Object.prototype.hasOwnProperty.call(value,'inputActionId'))reserve(value.inputActionId);
    if(value.kind==='actionPrompt')reserve(value.prompt?.action);
    if(value.kind==='ControllerInputActionSet' && Array.isArray(value.actions))for(const id of value.actions)reserve(id);
    if(value.kind==='InputDeviceMapping')reserve(value.action);
    if(value.kind==='TouchControlLayout' && Array.isArray(value.controls))for(const control of value.controls)if(control?.kind==='button')reserve(control.action);
    for(const child of Object.values(value))scan(child,depth+1);
  };scan(project);
  // Never reuse an unobserved legacy reference when bounded import inspection
  // cannot finish. Preserve all imported data/playback, but refuse new IDs.
  if(incomplete)nextInputActionAssetId=1000000000000000;
}
function generateInputActionAssetId() {
  reconcileInputActionAssetIds({inputActionAssets,inputActionMap});
  for(const id of Object.keys(playerInputOverrides))if(/^input-action-[1-9]\d{0,14}$/.test(id))nextInputActionAssetId=Math.max(nextInputActionAssetId,Number(id.slice(13))+1);
  if(nextInputActionAssetId>999999999999999)throw new Error('Cannot safely allocate another Input Action: identity capacity or bounded legacy import inspection was exceeded. Existing data and references were preserved.');
  return 'input-action-'+nextInputActionAssetId++;
}
function copyInputActionAssets(records) {
  return typeof OpusInputActionAssets === 'undefined' ? JSON.parse(JSON.stringify(Array.isArray(records)?records:[])) : OpusInputActionAssets.library(records);
}
function findInputAction(id) {
  if(playMode&&inputDeviceRuntime)return Object.prototype.hasOwnProperty.call(inputDeviceRuntime.labels,id)?{id,name:inputDeviceRuntime.labels[id],builtin:Object.prototype.hasOwnProperty.call(INPUT_ACTION_LABELS,id)}:null;
  if (Object.prototype.hasOwnProperty.call(INPUT_ACTION_LABELS,id)) return {id,name:INPUT_ACTION_LABELS[id],builtin:true};
  return typeof OpusInputActionAssets === 'undefined' ? null : OpusInputActionAssets.find(inputActionAssets,id);
}
function inputActionLabels() {
  if(playMode&&inputDeviceRuntime)return {...inputDeviceRuntime.labels};
  const labels={...INPUT_ACTION_LABELS};
  if (typeof inputActionAssets !== 'undefined' && typeof OpusInputActionAssets !== 'undefined') for (const record of inputActionAssets.slice(0,128)) {
    const action=OpusInputActionAssets.find(inputActionAssets,record?.id); if(action) labels[action.id]=action.name;
  }
  return labels;
}
function validInputActionCode(code) {
  return typeof code==='string' && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Mouse[0-2]|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal|Comma|ParenLeft|ParenRight|Backspace|Clear|ClearEntry|Hash|MemoryAdd|MemoryClear|MemoryRecall|MemoryStore|MemorySubtract|Star)|F([1-9]|1[0-9]|2[0-4])|(Shift|Control|Alt|Meta|OS)(Left|Right)|Space|Enter|Escape|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Insert|Backquote|Backslash|BracketLeft|BracketRight|Comma|Equal|Minus|Period|Quote|Semicolon|Slash|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|ContextMenu|IntlBackslash|IntlRo|IntlYen|Convert|NonConvert|KanaMode|Lang[1-5]|AudioVolume(Up|Down|Mute)|Media(PlayPause|Stop|TrackNext|TrackPrevious))$/.test(code);
}
function inputActionBinding(id,preview=false) {
  if (!findInputAction(id)) return null;
  const map=preview?inputActionMap:effectiveInputMap,code=map[id];
  return validInputActionCode(code) ? code : inputDeviceTargetCode(id,preview);
}
function compileInputContextRuntime() {
  const compiled=OpusInputContexts.compile(inputContexts,Object.keys(inputActionLabels()));
  inputContextRuntime={compiled,selection:currentPlayerSettings.inputContextId ?? null,blockedPressCodes:new Map()};
  return inputContextRuntime;
}
function inputActionContextState(id) {
  if(!playMode) return {valid:true,allowed:true,look:true};
  const runtime=inputContextRuntime || compileInputContextRuntime();
  return OpusInputContexts.resolve(runtime.compiled,runtime.selection,id);
}
function inputContextLookAllowed() { const state=inputActionContextState(); return state.valid && state.look; }
function selectRuntimeInputContext(id) {
  if(!playMode) return false;
  if(typeof id!=='string' && id!==null){showToast('Choose a valid named input context.');return false;}
  const runtime=inputContextRuntime || compileInputContextRuntime();
  const state=OpusInputContexts.resolve(runtime.compiled,id);
  if(!state.valid) { showToast(state.reason || 'Input context unavailable'); return false; }
  if(runtime.selection===id) return true;
  runtime.selection=id;
  if(typeof releaseAuthoredTouchControls==='function')releaseAuthoredTouchControls();
  // Pressed needs a fresh physical press after switching; Held is immediately
  // available. Do not clear keys/pressed or another Action's device leases.
  runtime.blockedPressCodes=captureInputContextPressVersions();
  touchLookPointerId=null;
  if(typeof refreshInputConflictDiagnostics==='function')refreshInputConflictDiagnostics();
  return true;
}
function captureInputContextPressVersions() {
  // A released edge can already have been consumed by the built-in owner but
  // still be observable by Graphs this frame. Stamp zero too in that case so a
  // newly activated context cannot replay a press predating its activation.
  return new Map([...Object.keys(inputActionLabels()).map(action=>inputActionBinding(action)), 'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].filter(code=>code && (app.input.pressVersion(code)>0 || typeof app.input.wasPressedThisFrame==='function'&&app.input.wasPressedThisFrame(code))).map(code=>[code,app.input.pressVersion(code)]));
}
function resetRuntimeInputContext() {
  if(!playMode) return false;
  const runtime=inputContextRuntime || compileInputContextRuntime();
  // Reset restores even an unavailable authored initial reference fail-closed;
  // it cannot accidentally leave a more permissive transient selection active.
  runtime.selection=currentPlayerSettings.inputContextId ?? null;
  if(typeof releaseAuthoredTouchControls==='function')releaseAuthoredTouchControls();
  runtime.blockedPressCodes=captureInputContextPressVersions();
  touchLookPointerId=null;
  if(typeof refreshInputConflictDiagnostics==='function')refreshInputConflictDiagnostics();
  return true;
}
function inputActionDown(id,secondary) {
  const state=inputActionContextState(id);
  return state.valid && state.allowed && (app.input.isDown(inputActionBinding(id)) || !!secondary && app.input.isDown(secondary));
}
function inputActionWasPressed(id,secondary,observe=false) {
  const state=inputActionContextState(id); if(!state.valid || !state.allowed) return false;
  const runtime=inputContextRuntime;
  return [inputActionBinding(id),secondary].some(code=>{
    if(!code)return false;
    // The press epoch changes only on a new aggregate physical press. This
    // also suppresses pre-transition unconsumed presses that already released.
    if(runtime?.blockedPressCodes.has(code)) {
      if(app.input.pressVersion(code)===runtime.blockedPressCodes.get(code))return false;
      runtime.blockedPressCodes.delete(code);
    }
    // A Graph condition observes the frame event; it must not steal the named
    // Action from the built-in controller/weapon consumer. Old hosts retain
    // their historical consuming behavior unless observation was requested.
    return observe&&typeof app.input.wasPressedThisFrame==='function'?app.input.wasPressedThisFrame(code):app.input.wasPressed(code);
  });
}
function blockPreResumeInputPresses(paused) {
  // Pause keeps physical transport alive. A released queued edge from its
  // menu must not become a fresh gameplay tap after Resume/Restart; Held
  // actions and independent device leases remain available and untouched.
  if(paused || !playMode || !inputContextRuntime)return false;
  inputContextRuntime.blockedPressCodes=captureInputContextPressVersions();
  return true;
}
function inputActionTouchAllowed(id) {
  const state=inputActionContextState(id);
  return playMode && !app.paused && !gameEnded && state.valid && state.allowed;
}
function toggleInventoryFromInput() {
  if(document.getElementById('inventory-overlay').classList.contains('visible') || inputActionTouchAllowed('inventory')) toggleInventory();
}
function copyInputDeviceMappings(records) { return typeof OpusInputDeviceMappings==='undefined'?JSON.parse(JSON.stringify(Array.isArray(records)?records:[])):OpusInputDeviceMappings.copy(records); }
function getInputDeviceMapping(action) {
  if(playMode&&inputDeviceRuntime)return inputDeviceRuntime.states.get(action)||{ok:false,reason:'Unavailable device mapping; retained author data is unchanged.'};
  if(typeof OpusInputDeviceMappings==='undefined')return {ok:true,record:null};
  return OpusInputDeviceMappings.find(inputDeviceMappings,action);
}
function inputDeviceTargetCode(action,preview=false) {
  if(!findInputAction(action))return null;
  const physical=!preview&&Object.prototype.hasOwnProperty.call(playerInputOverrides,action)?playerInputOverrides[action]:inputActionMap[action];
  if(validInputActionCode(physical))return physical;
  const state=getInputDeviceMapping(action);
  return state.ok&&state.record&&(state.record.touch||state.record.gamepad.length)?'OpusAction:'+action:null;
}
function compileInputDeviceRuntime() {
  inputDeviceRuntime=null;
  if(typeof OpusInputDeviceMappings==='undefined')return null;
  const labels=inputActionLabels(),compiled=OpusInputDeviceMappings.compile(inputDeviceMappings,Object.keys(labels)),states=new Map();
  for(const route of compiled.routes)states.set(route.action,{ok:true,record:route.configured?{gamepad:route.gamepad,touch:route.touch}:null});
  inputDeviceRuntime={labels,routes:compiled.routes,states};return inputDeviceRuntime;
}
function inputTouchActionCode(action) {
  const state=getInputDeviceMapping(action);if(!state.ok||!findInputAction(action))return null;
  const settings=state.record||(typeof OpusInputDeviceMappings==='undefined'?{touch:true}:OpusInputDeviceMappings.defaults(action));
  return settings.touch?inputDeviceTargetCode(action):null;
}
function setInputDeviceMapping(action,gamepad,touch,primaryCode) {
  if(playMode||!findInputAction(action)||typeof OpusInputDeviceMappings==='undefined')return {ok:false,reason:'Stop Play and choose an available named Action.'};
  if(primaryCode!==''&&!validInputActionCode(primaryCode))return {ok:false,reason:'Choose a supported keyboard or mouse input; saved defaults are unchanged.'};
  const current=getInputDeviceMapping(action);if(!current.ok)return current;
  if(Array.isArray(gamepad)&&gamepad.includes('button:9')&&!current.record?.gamepad.includes('button:9'))return {ok:false,reason:'Start / Menu is reserved for Pause. Choose another gamepad input.'};
  const state=OpusInputDeviceMappings.upsert(inputDeviceMappings,{...(current.record||{}),kind:'InputDeviceMapping',version:1,action,gamepad,touch});if(!state.ok)return state;
  if(inputActionMap[action]===primaryCode&&JSON.stringify(state.records)===JSON.stringify(inputDeviceMappings))return {ok:true};
  pushUndo();inputActionMap[action]=primaryCode;inputDeviceMappings=state.records;renderInputActionPanel();refreshInputActionConsumers();return {ok:true};
}
function resetInputDeviceMapping(action) {
  if(playMode||!findInputAction(action))return {ok:false,reason:'Stop Play and choose an available named Action.'};
  const state=getInputDeviceMapping(action);if(!state.ok)return state;if(!state.record)return {ok:true};
  pushUndo();inputDeviceMappings=inputDeviceMappings.filter(record=>record?.action!==action);renderInputActionPanel();refreshInputActionConsumers();return {ok:true};
}
function renderInputDeviceMappingEditor() {
  const host=document.getElementById('input-device-mappings');if(!host||typeof OpusInputDeviceMappings==='undefined')return;
  const labels=inputActionLabels();if(!Object.prototype.hasOwnProperty.call(labels,editingInputDeviceAction))editingInputDeviceAction=Object.keys(labels)[0];
  const id=editingInputDeviceAction,state=getInputDeviceMapping(id),settings=state.ok?(state.record||OpusInputDeviceMappings.defaults(id)):OpusInputDeviceMappings.defaults(id),disabled=playMode||!state.ok;
  const options=[['legacy','Historical default'],['none','No gamepad input'],...Array.from({length:17},(_,i)=>['button:'+i,['A / Cross','B / Circle','X / Square','Y / Triangle','Left shoulder','Right shoulder','Left trigger','Right trigger','Select / View','Start / Menu (also Pause)','Left stick press','Right stick press','D-pad up','D-pad down','D-pad left','D-pad right','Home'][i]]),...Array.from({length:4},(_,i)=>[['axis:'+i+':negative',`Axis ${i+1} negative`],['axis:'+i+':positive',`Axis ${i+1} positive`]]).flat()];
  const legacy=OpusInputDeviceMappings.defaults(id).gamepad,choice=JSON.stringify(settings.gamepad)===JSON.stringify(legacy)?'legacy':settings.gamepad.length===0?'none':settings.gamepad.length===1?settings.gamepad[0]:'retained';
  if(choice==='retained')options.push(['retained','Retain saved multi-source mapping']);
  host.innerHTML=`<p class="field-help">One named Action across devices. Keyboard or mouse is its primary input; gamepad and touch can also work without a primary key. Action sets do not disable gameplay. Shared inputs are allowed. Start / Menu is reserved for Pause.</p><label>Action<select id="input-device-action">${Object.entries(labels).map(([value,label])=>`<option value="${escapeHtml(value)}"${value===id?' selected':''}>${escapeHtml(label)}</option>`).join('')}</select></label><label>Keyboard / mouse default<button id="input-device-key" type="button"${disabled?' disabled':''}>${rebindingAction===id?'Press a key…':escapeHtml(keyCodeToLabel(inputActionMap[id]))}</button></label><label>Mouse / primary input<select id="input-device-mouse"${disabled?' disabled':''}><option value="keep">Keep current keyboard / mouse</option><option value="none">No primary input (device-only)</option><option value="Mouse0">Left click</option><option value="Mouse1">Middle click</option><option value="Mouse2">Right click</option></select></label><label>Gamepad source<select id="input-device-gamepad"${disabled?' disabled':''}>${options.map(([value,label])=>`<option value="${value}"${value===choice?' selected':''}${value==='button:9'&&choice!==value?' disabled':''}>${label}</option>`).join('')}</select></label><label><input id="input-device-touch" type="checkbox"${settings.touch?' checked':''}${disabled?' disabled':''}> Show named on-screen touch button</label><button id="input-device-save" type="button"${disabled?' disabled':''}>Save device mappings</button><button id="input-device-reset" type="button"${disabled?' disabled':''}>Reset device defaults</button><p id="input-device-status" class="field-help" role="status">${state.ok?'Project defaults; player keyboard/mouse preferences stay local. Standard gamepad buttons/axes; a connected pad is not required to author.':escapeHtml(state.reason)}</p>`;
  host.querySelector('#input-device-action').onchange=e=>{editingInputDeviceAction=e.target.value;renderInputDeviceMappingEditor();};
  host.querySelector('#input-device-key').onclick=()=>{if(disabled)return;rebindingAction=id;renderInputActionPanel();};
  const status=result=>{document.getElementById('input-device-status').textContent=result.ok?'Device mappings saved. Use this Action in the typed Pressed/Held Condition picker.':result.reason;};
  host.querySelector('#input-device-save').onclick=()=>{
    const mouse=host.querySelector('#input-device-mouse').value,selection=host.querySelector('#input-device-gamepad').value,code=mouse==='keep'?inputActionMap[id]||'':mouse==='none'?'':mouse;
    const sources=selection==='legacy'?legacy:selection==='none'?[]:selection==='retained'?settings.gamepad:[selection];
    const conflicts=Object.entries(labels).filter(([other])=>other!==id&&code&&inputActionMap[other]===code).map(([,label])=>label);
    const padConflicts=Object.entries(labels).filter(([other])=>{if(other===id)return false;const otherState=getInputDeviceMapping(other);return otherState.ok&&sources.some(source=>(otherState.record||OpusInputDeviceMappings.defaults(other)).gamepad.includes(source));}).map(([,label])=>label);
    const result=setInputDeviceMapping(id,sources,host.querySelector('#input-device-touch').checked,code);status(result);if(result.ok&&conflicts.length)document.getElementById('input-device-status').textContent+=' Shared primary input: '+conflicts.join(', ')+'.';if(result.ok&&padConflicts.length)document.getElementById('input-device-status').textContent+=' Shared gamepad input: '+padConflicts.join(', ')+'.';
  };
  host.querySelector('#input-device-reset').onclick=()=>status(resetInputDeviceMapping(id));
}
function releaseTouchInputControls() {
  if(typeof releaseAuthoredTouchControls==='function')releaseAuthoredTouchControls();
  for(const button of document.querySelectorAll('#touch-controls button'))button._releaseTouchInput?.();
}
let selectedTouchControlId=null,touchLayoutPreviewSize={width:1280,height:720},touchLayoutExpanded=false;
const authoredTouchReleases=new Set();
function releaseAuthoredTouchControls(){for(const release of authoredTouchReleases)release();}
function touchLayoutState(){return typeof OpusTouchControlLayout==='undefined'?{ok:false,reason:'Touch layout tools unavailable'}:OpusTouchControlLayout.inspect(currentUiConfig.touchLayout);}
function collectTouchLayoutIssues(project){
  const issues=[],levels=Array.isArray(project?.levels)?project.levels:[],builtin=typeof INPUT_ACTION_LABELS==='undefined'?{}:INPUT_ACTION_LABELS;
  if(levels.length>10000)return [{severity:'error',scope:'touch-layout',code:'touch-layout-audit-limit',message:'Touch layout validation exceeds the bounded level limit. Save remains available.'}];
  for(const level of levels){if(!level?.ui||!Object.prototype.hasOwnProperty.call(level.ui,'touchLayout'))continue;const base={scope:'touch-layout',levelId:level.id||null},state=typeof OpusTouchControlLayout==='undefined'?{ok:false,reason:'Touch layout validation unavailable'}:OpusTouchControlLayout.inspect(level.ui.touchLayout);if(!state.ok){issues.push({...base,severity:'error',code:'touch-layout-unavailable',message:state.reason});continue;}
    for(const control of state.record.controls)if(control.kind==='button'&&!Object.prototype.hasOwnProperty.call(builtin,control.action)&&!(typeof OpusInputActionAssets!=='undefined'&&OpusInputActionAssets.find(project.inputActionAssets,control.action))){issues.push({...base,severity:'error',code:'touch-layout-action-unavailable',field:'action',controlId:control.id,referenceValue:control.action,message:'Touch button references an unavailable Input Action: '+control.action+'. Choose a named replacement; saved data is retained.'});}
  }return issues;
}
function commitTouchLayout(next){if(playMode||JSON.stringify(currentUiConfig.touchLayout)===JSON.stringify(next))return false;const state=OpusTouchControlLayout.inspect(next);if(!state.ok)return false;pushUndo();currentUiConfig.touchLayout=OpusTouchControlLayout.copy(next);renderTouchLayoutEditor();return true;}
// New button presets clear the editor's lower corner controls. Existing authored
// coordinates are never migrated; the same portable geometry serves both tiers.
function addTouchLayoutControl(kind,action){const state=touchLayoutState();if(playMode||!state.ok)return false;const controls=state.record.controls;const control={id:OpusTouchControlLayout.freshId(),kind,anchor:kind==='joystick'?'bottom-left':'bottom-right',offsetX:0,offsetY:kind==='button'?-80:0,size:kind==='joystick'?144:64,...(kind==='joystick'?{deadZone:.2}:{action})};if(kind==='button'&&!Object.prototype.hasOwnProperty.call(inputActionLabels(),action))return false;const next=OpusTouchControlLayout.upsert(currentUiConfig.touchLayout,control);if(!next.ok)return false;selectedTouchControlId=control.id;return commitTouchLayout(next.record);}
function changeTouchLayoutControl(id,patch){const state=touchLayoutState();if(playMode||!state.ok)return false;const current=state.record.controls.find(control=>control.id===id);if(!current)return false;if(Object.prototype.hasOwnProperty.call(patch,'action')&&patch.action!==current.action&&!Object.prototype.hasOwnProperty.call(inputActionLabels(),patch.action))return false;const next=OpusTouchControlLayout.upsert(currentUiConfig.touchLayout,{...current,...patch});return next.ok&&commitTouchLayout(next.record);}
function removeTouchLayoutControl(id){if(playMode)return false;const next=OpusTouchControlLayout.remove(currentUiConfig.touchLayout,id);return next.ok&&commitTouchLayout(next.record);}
function resetTouchLayout(){if(playMode||!Object.prototype.hasOwnProperty.call(currentUiConfig,'touchLayout'))return false;pushUndo();delete currentUiConfig.touchLayout;selectedTouchControlId=null;renderTouchLayoutEditor();return true;}
function renderTouchLayoutEditor(){
  const host=document.getElementById('touch-layout-editor');if(!host)return;const state=touchLayoutState(),labels=inputActionLabels();host.classList.toggle('touch-layout-expanded',touchLayoutExpanded);
  host.innerHTML=`<p class="field-help">${state.ok?(state.historical?'Historical D-pad and buttons. Adding a control creates an explicit layout.':'Authored touch layout. An empty layout has no fixed controls; unplaced mapped Actions remain in the paged bank.'):escapeHtml(state.reason)+' — saved data is retained.'}</p><button type="button" class="toolbar-btn" id="touch-layout-expand">${touchLayoutExpanded?'Close expanded':'Expand layout'}</button><label>Preview size<select class="field-input" id="touch-layout-viewport"><option value="1280x720">Desktop · 1280 × 720</option><option value="768x1024">Tablet · 768 × 1024</option><option value="390x844">Phone · 390 × 844</option></select></label><button class="toolbar-btn" id="touch-layout-add-joystick">Add movement joystick</button><label>Button Action<select class="field-input" id="touch-layout-action">${Object.entries(labels).map(([id,label])=>`<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join('')}</select></label><button class="toolbar-btn" id="touch-layout-add-button">Add Action button</button><button class="toolbar-btn" id="touch-layout-reset">Reset to historical controls</button><div class="touch-layout-preview"><div class="touch-layout-preview-stage" data-touch-layout-stage></div></div><div id="touch-layout-selection"></div><p class="field-help" id="touch-layout-warnings"></p><p class="field-help">Drag a control to move it. Drag its gold corner to resize, or use the size field. Movement is digital, including diagonals; joystick dead zone is the fraction around its center. Offscreen positions are retained and diagnosed; gameplay clamps controls into reach.</p>`;
  const q=id=>host.querySelector('#touch-layout-'+id),viewport=q('viewport');viewport.value=touchLayoutPreviewSize.width+'x'+touchLayoutPreviewSize.height;viewport.onchange=()=>{const [width,height]=viewport.value.split('x').map(Number);touchLayoutPreviewSize={width,height};renderTouchLayoutEditor();};q('expand').onclick=()=>{touchLayoutExpanded=!touchLayoutExpanded;renderTouchLayoutEditor();};
  for(const key of ['add-joystick','add-button','action'])q(key).disabled=playMode||!state.ok;if(state.ok){q('add-joystick').disabled||=state.record.controls.some(control=>control.kind==='joystick');q('add-button').disabled||=state.record.controls.filter(control=>control.kind==='button').length>=24;const limitHelp=document.createElement('p');limitHelp.className='field-help';limitHelp.textContent='One movement joystick and up to 24 Action buttons per layout.';host.insertBefore(limitHelp,host.querySelector('.touch-layout-preview'));}q('reset').disabled=playMode||!Object.prototype.hasOwnProperty.call(currentUiConfig,'touchLayout');q('add-joystick').onclick=()=>addTouchLayoutControl('joystick');q('add-button').onclick=()=>addTouchLayoutControl('button',q('action').value);q('reset').onclick=resetTouchLayout;
  if(!state.ok)return;const controls=state.record.controls,selected=controls.find(control=>control.id===selectedTouchControlId);const selection=document.createElement('label');selection.textContent='Select control';const picker=document.createElement('select');picker.className='field-input';picker.id='touch-layout-control';picker.innerHTML='<option value="">Choose a control</option>'+controls.map((control,index)=>`<option value="${escapeHtml(control.id)}"${control.id===selectedTouchControlId?' selected':''}>${index+1} · ${escapeHtml(control.kind==='joystick'?'Movement joystick':labels[control.action]||'Unavailable Action')}</option>`).join('');picker.onchange=()=>{selectedTouchControlId=picker.value;renderTouchLayoutEditor();};selection.appendChild(picker);host.insertBefore(selection,host.querySelector('.touch-layout-preview'));const stage=host.querySelector('[data-touch-layout-stage]'),frame=stage.parentElement,view=touchLayoutPreviewSize,scale=Math.min((host.clientWidth||280)/view.width,touchLayoutExpanded?(window.innerHeight*.55)/view.height:280/view.height);Object.assign(stage.style,{width:view.width+'px',height:view.height+'px',transform:`scale(${scale})`});frame.style.height=view.height*scale+'px';
  // The painted device frame must bound the scaled viewport, not the entire
  // expanded editor width. Dragging retains exactly the existing stage scale.
  frame.style.width=view.width*scale+'px';
  for(const control of controls){const rect=OpusTouchControlLayout.geometry(control,view),node=document.createElement('button');node.type='button';node.className='touch-layout-control';node.dataset.touchControlId=control.id;node.dataset.touchSelected=String(control.id===selectedTouchControlId);node.textContent=control.kind==='joystick'?'Move':labels[control.action]||'Unavailable Action';Object.assign(node.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});const handle=document.createElement('span');handle.className='touch-layout-resize';handle.dataset.touchResize='true';node.appendChild(handle);stage.appendChild(node);
    node.onpointerdown=e=>{if(playMode)return;e.preventDefault();selectedTouchControlId=control.id;const resize=e.target===handle,startX=e.clientX,startY=e.clientY;node.setPointerCapture(e.pointerId);let patch={};node.onpointermove=move=>{if(move.pointerId!==e.pointerId)return;const dx=(move.clientX-startX)/scale,dy=(move.clientY-startY)/scale;patch=resize?{size:Math.max(44,Math.min(320,control.size+Math.max(dx,dy)))}:{offsetX:control.offsetX+dx,offsetY:control.offsetY+dy};const preview=OpusTouchControlLayout.geometry({...control,...patch},view);Object.assign(node.style,{left:preview.left+'px',top:preview.top+'px',width:preview.width+'px',height:preview.height+'px'});};const finish=(event,cancel)=>{if(event.pointerId!==e.pointerId)return;node.onpointermove=null;node.onpointerup=null;node.onpointercancel=null;node.onlostpointercapture=null;if(!cancel)changeTouchLayoutControl(control.id,patch);renderTouchLayoutEditor();};node.onpointerup=event=>finish(event,false);node.onpointercancel=event=>finish(event,true);node.onlostpointercapture=event=>finish(event,true);};
  }
  const warnings=OpusTouchControlLayout.diagnostics(currentUiConfig.touchLayout,view,Object.keys(labels));q('warnings').textContent=warnings.map(entry=>entry.message).join(' ');
  if(selected){const panel=q('selection');panel.innerHTML=`<label>Selected control · ${escapeHtml(selected.kind==='joystick'?'Movement joystick':labels[selected.action]||'Unavailable Action')}</label>${selected.kind==='button'?`<label>Button Action<select class="field-input" data-touch-field="action">${Object.prototype.hasOwnProperty.call(labels,selected.action)?'':`<option value="${escapeHtml(selected.action)}" selected>Unavailable Action · ${escapeHtml(selected.action)} (retained)</option>`}${Object.entries(labels).map(([id,label])=>`<option value="${escapeHtml(id)}"${id===selected.action?' selected':''}>${escapeHtml(label)}</option>`).join('')}</select></label>`:''}<label>Anchor<select class="field-input" data-touch-field="anchor">${HUD_ANCHORS.map(anchor=>`<option${anchor===selected.anchor?' selected':''}>${anchor}</option>`).join('')}</select></label>${['offsetX','offsetY','size',...(selected.kind==='joystick'?['deadZone']:[])].map(key=>`<label>${({offsetX:'Horizontal offset',offsetY:'Vertical offset',size:'Size (CSS pixels)',deadZone:'Joystick dead zone'})[key]}<input class="field-input" data-touch-field="${key}" type="number" step="${key==='deadZone'?'.05':'1'}" value="${selected[key]}"></label>`).join('')}<button class="toolbar-btn" id="touch-layout-remove">Remove selected control</button>`;for(const input of panel.querySelectorAll('[data-touch-field]')){input.disabled=playMode;input.onchange=()=>{const key=input.dataset.touchField,value=['anchor','action'].includes(key)?input.value:input.value.trim()?Number(input.value):NaN;changeTouchLayoutControl(selected.id,{[key]:value});};}q('remove').disabled=playMode;q('remove').onclick=()=>removeTouchLayoutControl(selected.id);}
}
function renderMappedTouchControls() {
  if(typeof renderAuthoredTouchControls==='function')renderAuthoredTouchControls();
  const host=document.getElementById('touch-action-mappings');if(!host||typeof OpusInputDeviceMappings==='undefined')return;
  for(const entry of host.querySelectorAll('[data-touch-input-action]'))entry._releaseTouchInput?.();
  host.replaceChildren();
  const fixed={moveForward:'touch-up',moveBack:'touch-down',moveLeft:'touch-left',moveRight:'touch-right',jump:'touch-boost'};
  for(const [action,id] of Object.entries(fixed)){const button=document.getElementById(id),state=getInputDeviceMapping(action);if(button)button.style.visibility=state.ok&&(!state.record||state.record.touch)?'':'hidden';}
  const layout=typeof touchLayoutState==='function'?touchLayoutState():{ok:true,historical:true},placedActions=layout.ok&&!layout.historical?new Set(layout.record.controls.flatMap(control=>control.kind==='button'?[control.action]:['moveForward','moveBack','moveLeft','moveRight'])):new Set();
  const actions=Object.entries(inputActionLabels()).filter(([action])=>{const state=getInputDeviceMapping(action),enabled=state.ok&&(state.record?state.record.touch:!layout.historical&&OpusInputDeviceMappings.defaults(action).touch);return enabled&&(!fixed[action]||!layout.historical)&&!placedActions.has(action);});
  const pages=Math.max(1,Math.ceil(actions.length/8));touchInputMappingPage=Math.max(0,Math.min(pages-1,touchInputMappingPage));
  for(const [action,label] of actions.slice(touchInputMappingPage*8,(touchInputMappingPage+1)*8)){
    const state=getInputDeviceMapping(action);if(!state.ok||!(state.record?state.record.touch:!layout.historical&&OpusInputDeviceMappings.defaults(action).touch)||(layout.historical&&fixed[action]))continue;
    const button=document.createElement('button');button.id='touch-mapped-'+action;button.className='touch-mapped-btn';button.dataset.touchInputAction=action;button.textContent=label;host.appendChild(button);
    wireTouchButton(button.id,()=>inputTouchActionCode(action),action==='inventory'?()=>toggleInventoryFromInput():null,layout.historical?undefined:{capture:true,guard:()=>playMode&&!app.paused&&!gameEnded});
  }
  if(pages>1){const navigation=document.createElement('div');navigation.className='touch-mapping-navigation';
    for(const [direction,label] of [[-1,'Previous Actions'],[1,'Next Actions']]){const button=document.createElement('button');button.type='button';button.className='touch-mapped-btn';button.textContent=label;button.disabled=direction<0?touchInputMappingPage===0:touchInputMappingPage===pages-1;button.onclick=()=>{touchInputMappingPage+=direction;renderMappedTouchControls();};navigation.appendChild(button);}
    const status=document.createElement('span');status.textContent=`Actions ${touchInputMappingPage+1} / ${pages}`;navigation.appendChild(status);host.appendChild(navigation);
  }
  for(const [action,id] of Object.entries({interact:'touch-interact',attack:'touch-attack',reload:'touch-reload',switchWeapon:'touch-switch',inventory:'touch-inventory'})){const button=document.getElementById(id),state=getInputDeviceMapping(action);if(button)button.style.visibility=!state.ok||state.record?'hidden':'';}
  if(!layout.ok||!layout.historical)for(const id of ['touch-up','touch-down','touch-left','touch-right','touch-boost','touch-interact','touch-attack','touch-reload','touch-switch','touch-inventory']){const button=document.getElementById(id);if(button)button.style.visibility='hidden';}
}
function wireAuthoredTouchJoystick(node,control){
  let pointer=null;const leases=new Map(),release=()=>{for(const [action,held] of leases)app.input.simulateKeyUp(held.code,held.source);leases.clear();pointer=null;};authoredTouchReleases.add(release);node._releaseTouchInput=release;
  const move=e=>{if(e.pointerId!==pointer)return;e.preventDefault();if(!playMode||app.paused||gameEnded){release();return;}const rect=node.getBoundingClientRect(),directions=OpusTouchControlLayout.directions(e.clientX-(rect.left+rect.width/2),e.clientY-(rect.top+rect.height/2),Math.min(rect.width,rect.height)/2,control.deadZone);
    for(const [action,down] of Object.entries(directions)){const code=down&&inputActionTouchAllowed(action)?inputTouchActionCode(action):null,prior=leases.get(action);if(prior&&prior.code!==code){app.input.simulateKeyUp(prior.code,prior.source);leases.delete(action);}if(code&&!leases.has(action)){const source=`touch-layout:${control.id}:${pointer}:${action}`;leases.set(action,{code,source});app.input.simulateKeyDown(code,source);markGameplayPointerDevice(e);}}
  };node.onpointerdown=e=>{if(pointer!==null||!playMode||app.paused||gameEnded)return;e.preventDefault();pointer=e.pointerId;node.setPointerCapture(pointer);move(e);};node.onpointermove=move;for(const type of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(type,e=>{if(e.pointerId===pointer)release();});
}
function renderAuthoredTouchControls(){
  const host=document.getElementById('touch-authored-controls');if(!host||typeof OpusTouchControlLayout==='undefined')return;releaseAuthoredTouchControls();authoredTouchReleases.clear();host.replaceChildren();const state=touchLayoutState();if(!state.ok||state.historical||!playMode)return;const viewport=host.parentElement.getBoundingClientRect(),view={width:viewport.width,height:viewport.height};if(!view.width||!view.height)return;
  for(const control of state.record.controls){const rect=OpusTouchControlLayout.runtimeGeometry(control,view);if(!rect)continue;const node=document.createElement('button');node.type='button';node.id='touch-layout-runtime-'+control.id;node.className='touch-layout-control';node.dataset.touchLayoutKind=control.kind;node.dataset.touchControlId=control.id;node.textContent=control.kind==='joystick'?'Move':inputActionLabels()[control.action]||'Unavailable Action';node.setAttribute('aria-label',node.textContent);Object.assign(node.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});host.appendChild(node);
    if(control.kind==='joystick')wireAuthoredTouchJoystick(node,control);else{wireTouchButton(node.id,()=>inputActionTouchAllowed(control.action)?inputTouchActionCode(control.action):null,control.action==='inventory'?()=>toggleInventoryFromInput():null,{capture:true,guard:()=>playMode&&!app.paused&&!gameEnded});authoredTouchReleases.add(node._releaseTouchInput);}
  }
}
window.addEventListener('resize',()=>{if(playMode)renderAuthoredTouchControls();else if(document.getElementById('touch-layout-editor'))renderTouchLayoutEditor();});
function createInputActionAsset(name,description='') {
  if(playMode || typeof OpusInputActionAssets==='undefined')return {ok:false,reason:'Stop Play before authoring Input Actions.'};
  if(typeof name==='string' && Object.values(INPUT_ACTION_LABELS).some(label=>label.toLowerCase()===name.trim().toLowerCase()))return {ok:false,reason:'Choose a name distinct from protected built-in Actions.'};
  const state=OpusInputActionAssets.create(inputActionAssets,name,description,generateInputActionAssetId);
  if(!state.ok)return state;
  pushUndo(); inputActionAssets.push(state.record); inputActionMap[state.record.id]=''; renderInputActionPanel(); refreshInputActionConsumers(); return state;
}
function editInputActionAsset(id,name,description) {
  if(playMode || !findInputAction(id) || findInputAction(id).builtin)return {ok:false,reason:'Choose an available creator Action while editing.'};
  if(typeof name==='string')name=name.trim();
  if(typeof name==='string' && Object.values(INPUT_ACTION_LABELS).some(label=>label.toLowerCase()===name.toLowerCase()))return {ok:false,reason:'Choose a name distinct from protected built-in Actions.'};
  const current=OpusInputActionAssets.find(inputActionAssets,id),state=OpusInputActionAssets.inspect({...current,name,description});
  if(!state.ok)return state;
  if(inputActionAssets.some(record=>record?.id!==id && OpusInputActionAssets.find(inputActionAssets,record?.id)?.name===state.record.name))return {ok:false,reason:'Choose a unique Action name.'};
  if(current.name===state.record.name && current.description===state.record.description)return {ok:true};
  pushUndo(); inputActionAssets[inputActionAssets.findIndex(record=>record.id===id)]=state.record; renderInputActionPanel(); refreshInputActionConsumers(); return {ok:true};
}
function deleteInputActionAsset(id) {
  if(playMode || !findInputAction(id) || findInputAction(id).builtin)return false;
  pushUndo(); inputActionAssets=inputActionAssets.filter(record=>record?.id!==id); delete inputActionMap[id];
  if(rebindingAction===id)rebindingAction=null; renderInputActionPanel(); refreshInputActionConsumers(); return true;
}
function refreshInputActionConsumers() {
  if(!playMode)inputDeviceRuntime=null;
  if(typeof renderHudElementList==='function')renderHudElementList();
  if(!playMode && typeof renderTouchLayoutEditor==='function')renderTouchLayoutEditor();
  if(typeof refreshInputConflictDiagnostics==='function')refreshInputConflictDiagnostics();
  if(typeof graphEditorState!=='undefined' && graphEditorState && typeof renderGraphNodes==='function')renderGraphNodes();
}

// Wave 6 (Priority D): the PLAYER's own rebind, kept entirely separate from
// `inputActionMap` (the AUTHOR's default, saved into the project and edited
// by the panel below). A shipped game's player can rebind Attack to their
// own preferred key/mouse button without that ever touching the author's
// saved default. A portable project identity scopes this preference subkey;
// the shared volume/quality namespace stays compatible. Ambiguous historical
// global inputOverrides remain stored, never automatically imported.
let playerInputOverrides = {};
function loadPlayerInputOverrides() {
  const key = OpusPlayerRebindScreen.scopeKey(playerPreferenceScope);
  const saved = key ? app.settings.get(key) : null;
  playerInputOverrides = {};
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const action of Object.keys(saved).slice(0, 140)) {
      if (findInputAction(action) && validInputActionCode(saved[action])) playerInputOverrides[action] = saved[action];
    }
  }
}
function savePlayerInputOverrides() {
  const key = OpusPlayerRebindScreen.scopeKey(playerPreferenceScope);
  if (key) app.settings.set(key, { ...playerInputOverrides });
}
// The ONE read path every controller/gamepad/touch/interact call site below
// uses -- a Proxy so no call site needs to change from `inputActionMap.x`
// to some new name; reading `effectiveInputMap.x` transparently prefers the
// player's own override, falling back to the author's default. Editor-side
// code that's actually SETTING an author default (the rebind panel further
// down) still reads/writes the real `inputActionMap` directly, on purpose --
// that panel configures what ships as the default, not what an already-
// playing player currently has bound.
// Wave 6B (Priority G): a real bug found while dogfooding a multi-game/
// multi-project-load session, not assumed correct from reading the code
// alone -- this Proxy was constructed with `inputActionMap` (the object,
// captured ONCE, at module load) as its OWN `target`. `loadProjectFull`
// REASSIGNS the `inputActionMap` *variable* to a brand-new object every time
// a project loads (`inputActionMap = {...INPUT_ACTION_DEFAULTS, ...}`) --
// but a Proxy's target is bound at construction and can never repoint to
// follow a later reassignment of the variable that was passed in. The result:
// `effectiveInputMap` silently kept reading the FIRST project's (or the
// hardcoded pre-any-load default's) input map forever after, for the rest
// of the page session -- every subsequently loaded project's own custom
// bindings (e.g. an attack rebound to Mouse0) never actually took effect in
// real gameplay, even though `inputActionMap` itself held the correct
// value. Fixed by closing over the outer `inputActionMap` BINDING (a `let`,
// always current) inside the `get` trap instead of relying on the Proxy's
// own frozen target -- the dummy `{}` target is never actually read, since
// this trap intercepts every property access.
const effectiveInputMap = new Proxy({}, {
  get(_target, prop) { return Object.prototype.hasOwnProperty.call(playerInputOverrides,prop) && validInputActionCode(playerInputOverrides[prop]) ? playerInputOverrides[prop] : Object.prototype.hasOwnProperty.call(inputActionMap,prop) ? (validInputActionCode(inputActionMap[prop])?inputActionMap[prop]:inputDeviceTargetCode(prop)) : undefined; },
});
// Wave 6B (Priority G): a few more common `KeyboardEvent.code` values get a
// readable label -- found while dogfooding a real HUD `{bind:sprint}` prompt
// showing the raw "ShiftLeft" (still technically readable, just clunkier
// than every other binding this function already formats nicely). Modifier
// keys collapse their Left/Right variant into one label (an author rebinding
// to either physical key sees the same clean "Shift"/"Ctrl"/"Alt"), matching
// how this function already treats every OTHER binding as "the key", not
// "which physical copy of it".
function keyCodeToLabel(code) {
  if (!code) return '(unset)';
  if(code.startsWith('OpusAction:')){const state=getInputDeviceMapping(code.slice(11));return state.ok&&state.record?.touch?'On-screen button':'Gamepad';}
  if (code === 'Mouse0') return 'Left Click';
  if (code === 'Mouse1') return 'Middle Click';
  if (code === 'Mouse2') return 'Right Click';
  if (code.startsWith('Key')) return code.slice(3);
  if (code === 'Space') return 'Space';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5);
  return code;
}
// Default Controller Maps (Wave 5, section 24): only the actions a given
// controller actually reads are worth showing in the rebind panel -- a
// Top-Down level has no Jump, so listing one would be a meaningless control
// nobody can ever trigger. 'jump' doubles as Hovercraft's own Boost input
// (both were always the same hardcoded Space key before this pass; still
// one shared slot, just rebindable now), labeled adaptively below.
const CONTROLLER_RELEVANT_ACTIONS = {
  hovercraft: ['moveForward', 'moveBack', 'moveLeft', 'moveRight', 'jump', 'interact', 'attack'],
  topdown: ['moveForward', 'moveBack', 'moveLeft', 'moveRight', 'interact', 'attack', 'reload', 'switchWeapon'],
  thirdperson: ['moveForward', 'moveBack', 'moveLeft', 'moveRight', 'jump', 'crouch', 'sprint', 'interact', 'attack', 'reload', 'switchWeapon'],
  firstperson: ['moveForward', 'moveBack', 'moveLeft', 'moveRight', 'jump', 'crouch', 'sprint', 'interact', 'attack', 'reload', 'switchWeapon'],
};
const CONTROLLER_REQUIRED_ACTIONS = {
  hovercraft:['moveForward','moveBack','moveLeft','moveRight','jump'],
  topdown:['moveForward','moveBack','moveLeft','moveRight'],
  thirdperson:['moveForward','moveBack','moveLeft','moveRight','jump','crouch','sprint'],
  firstperson:['moveForward','moveBack','moveLeft','moveRight','jump','crouch','sprint'],
};
function copyInputActionSets(records) {
  return typeof OpusInputActionSets==='undefined'?JSON.parse(JSON.stringify(Array.isArray(records)?records:[])):OpusInputActionSets.copy(records);
}
function controllerInputActionIds(controller) {
  const labels=inputActionLabels(),historical=Object.prototype.hasOwnProperty.call(CONTROLLER_RELEVANT_ACTIONS,controller)?CONTROLLER_RELEVANT_ACTIONS[controller]:Object.keys(INPUT_ACTION_LABELS),required=Object.prototype.hasOwnProperty.call(CONTROLLER_REQUIRED_ACTIONS,controller)?CONTROLLER_REQUIRED_ACTIONS[controller]:Object.keys(INPUT_ACTION_LABELS);
  const state=typeof OpusInputActionSets==='undefined'?{ok:true,record:null}:OpusInputActionSets.find(inputActionSets,controller);
  const optional=state.ok&&state.record?state.record.actions:[...historical,...Object.keys(labels).filter(id=>!Object.prototype.hasOwnProperty.call(INPUT_ACTION_LABELS,id))];
  return [...new Set([...required,...optional])].filter(id=>Object.prototype.hasOwnProperty.call(labels,id));
}
function setControllerInputActionSet(controller,actions) {
  if(playMode || typeof OpusInputActionSets==='undefined')return {ok:false,reason:'Stop Play before authoring controller Action sets.'};
  if(!Object.prototype.hasOwnProperty.call(CONTROLLER_RELEVANT_ACTIONS,controller)||!Array.isArray(actions)||new Set(actions).size!==actions.length)return {ok:false,reason:'Choose a supported controller and unique named Actions.'};
  const current=OpusInputActionSets.find(inputActionSets,controller);if(!current.ok)return current;
  const labels=inputActionLabels();if(actions.some(id=>!Object.prototype.hasOwnProperty.call(labels,id)&&!current.record?.actions.includes(id)))return {ok:false,reason:'Choose an available Action; retained missing references are not reassigned.'};
  const state=OpusInputActionSets.upsert(inputActionSets,{...(current.record||{}),kind:'ControllerInputActionSet',version:1,controller,actions:[...new Set([...CONTROLLER_REQUIRED_ACTIONS[controller],...actions])]});
  if(!state.ok)return state;if(JSON.stringify(state.records)===JSON.stringify(inputActionSets))return {ok:true};
  pushUndo();inputActionSets=state.records;renderInputActionPanel();return {ok:true};
}
function resetControllerInputActionSet(controller) {
  if(playMode || typeof OpusInputActionSets==='undefined')return {ok:false,reason:'Stop Play before resetting a controller Action set.'};
  if(!Object.prototype.hasOwnProperty.call(CONTROLLER_RELEVANT_ACTIONS,controller))return {ok:false,reason:'Choose a supported controller.'};
  const current=OpusInputActionSets.find(inputActionSets,controller);if(!current.ok)return current;if(!current.record)return {ok:true};
  pushUndo();inputActionSets=inputActionSets.filter(record=>record?.controller!==controller);renderInputActionPanel();return {ok:true};
}
function renderControllerInputActionSetEditor() {
  const host=document.getElementById('controller-input-action-sets');if(!host||typeof OpusInputActionSets==='undefined')return;
  const controller=editingInputActionSetController,required=CONTROLLER_REQUIRED_ACTIONS[controller]||[],state=OpusInputActionSets.find(inputActionSets,controller),labels=inputActionLabels();
  const selected=state.ok&&state.record?state.record.actions:controllerInputActionIds(controller),ids=[...new Set([...Object.keys(labels),...selected])];
  host.innerHTML=`<p class="field-help">Project-wide Controls discovery for each controller. Required controller Actions stay visible. Membership does not disable gameplay input or create an ability. Unset sets keep historical defaults.</p><label>Controller<select id="input-action-set-controller">${Object.keys(CONTROLLER_RELEVANT_ACTIONS).map(id=>`<option value="${id}"${id===controller?' selected':''}>${escapeHtml(id)}</option>`).join('')}</select></label><div id="input-action-set-members">${ids.map(id=>`<label><input type="checkbox" data-input-action-set-member="${escapeHtml(id)}"${selected.includes(id)||required.includes(id)?' checked':''}${playMode||!state.ok||required.includes(id)||!Object.prototype.hasOwnProperty.call(labels,id)?' disabled':''}> ${escapeHtml(labels[id]||'Unavailable saved Action')}${required.includes(id)?' (required)':!Object.prototype.hasOwnProperty.call(labels,id)?' (retained missing reference)':''}</label>`).join('')}</div><button type="button" id="input-action-set-save"${playMode||!state.ok?' disabled':''}>Save controller set</button><button type="button" id="input-action-set-reset"${playMode||!state.ok?' disabled':''}>Restore historical defaults</button><p id="input-action-set-status" role="status" class="field-help">${escapeHtml(state.ok?'Author defaults and player preferences remain separate.':state.reason)}</p>`;
  host.querySelector('#input-action-set-controller').onchange=e=>{editingInputActionSetController=e.target.value;renderControllerInputActionSetEditor();};
  const status=result=>{document.getElementById('input-action-set-status').textContent=result.ok?'Controller Action set saved. Gameplay bindings were not changed.':result.reason;};
  host.querySelector('#input-action-set-save').onclick=()=>status(setControllerInputActionSet(controller,[...host.querySelectorAll('[data-input-action-set-member]:checked')].map(input=>input.dataset.inputActionSetMember)));
  host.querySelector('#input-action-set-reset').onclick=()=>status(resetControllerInputActionSet(controller));
}
// Diagnostic view selection is transient, never project or history state.
var inputConflictReviewSelection='initial';
function inputConflictSnapshot(player=false,selection=null) {
  if(typeof OpusInputConflicts==='undefined'||typeof OpusInputContexts==='undefined'||typeof OpusInputDeviceMappings==='undefined')return {ok:false,reason:'Input diagnostics are unavailable.'};
  const labels=inputActionLabels(),ids=Object.keys(labels),contexts=OpusInputContexts.compile(inputContexts,ids),devices=OpusInputDeviceMappings.compile(inputDeviceMappings,ids);
  if(!contexts.ok)return {ok:false,reason:contexts.reason||'Saved input contexts are unavailable; retained data is unchanged.'};
  if(devices.reason||devices.unavailable.length)return {ok:false,reason:devices.reason||'Unavailable device mappings: '+devices.unavailable.map(id=>labels[id]||'Retained Action').join(', ')+'. Saved data is unchanged.'};
  const bindings={},secondary={};
  for(const id of ids){const code=player?effectiveInputMap[id]:inputActionMap[id],route=devices.routes.find(route=>route.action===id);bindings[id]=validInputActionCode(code)?code:code===''||code===undefined||code===null?(route?.configured&&(route.touch||route.gamepad.length)?'OpusAction:'+id:null):code;}
  if(['firstperson','thirdperson','topdown','hovercraft'].includes(currentPlayerSettings.controllerType))Object.assign(secondary,{moveForward:['ArrowUp'],moveBack:['ArrowDown'],moveLeft:['ArrowLeft'],moveRight:['ArrowRight']});
  const chosen=player?(inputContextRuntime?inputContextRuntime.selection:(currentPlayerSettings.inputContextId??null)):selection;
  return {ok:true,snapshot:{labels,bindings,routes:devices.routes.map(route=>({action:route.action,gamepad:[...route.gamepad],touch:route.touch})),cohorts:contexts.contexts.map(context=>({id:context.id,name:context.name,valid:context.valid,actions:[...context.actions],...(context.reason?{reason:context.reason}:{})})),selection:chosen,secondary,localOverrides:player}};
}
function inputConflictReview(player=false,selection=null) {
  const state=inputConflictSnapshot(player,selection);return state.ok?OpusInputConflicts.analyze(state.snapshot):state;
}
function openInputConflictRepair(action,player=false) {
  if(!Object.prototype.hasOwnProperty.call(inputActionLabels(),action))return false;
  if(player){playerRebindingAction=action;renderControlsPanel();return true;}
  if(playMode)return false;
  editingInputDeviceAction=action;activateTab('right-tab','project');
  const body=document.querySelector('[data-section-body="inputactions"]');if(body?.classList.contains('collapsed'))document.querySelector('[data-section="inputactions"]')?.click();
  const host=document.getElementById('input-device-mappings');if(host?.closest('details'))host.closest('details').open=true;
  renderInputDeviceMappingEditor();const picker=document.getElementById('input-device-action');picker?.scrollIntoView?.({block:'nearest'});picker?.focus?.();return true;
}
function inputConflictBindingLabel(binding) {
  if(typeof binding!=='string')return 'Unavailable input';
  if(binding.startsWith('button:'))return ['A / Cross','B / Circle','X / Square','Y / Triangle','Left shoulder','Right shoulder','Left trigger','Right trigger','Select / View','Start / Menu','Left stick press','Right stick press','D-pad up','D-pad down','D-pad left','D-pad right','Home'][Number(binding.slice(7))]||'Unavailable gamepad input';
  if(binding.startsWith('axis:')){const parts=binding.split(':');return 'Gamepad axis '+(Number(parts[1])+1)+' '+parts[2];}
  if(binding.startsWith('OpusAction:'))return 'Device-only named Action';
  return keyCodeToLabel(binding);
}
function inputConflictIssuesHTML(state,player=false) {
  if(!state.ok)return `<p class="field-help" role="status">${escapeHtml(state.reason||'Diagnostics unavailable. Saved data is retained.')}</p>`;
  if(!state.issues.length)return '<p class="field-help" role="status">No overlapping inputs found for this context. This is a mapping review, not connected-device or gameplay acceptance.</p>';
  const labels=inputActionLabels();return state.issues.slice(0,128).map(issue=>`<div class="input-conflict-issue"><strong>${escapeHtml(issue.device==='keyboard-mouse'?'Keyboard / mouse':issue.device||'Input')} · ${escapeHtml(issue.severity||'warning')}</strong>${issue.binding?`<p>${escapeHtml(inputConflictBindingLabel(issue.binding))}</p>`:''}<p>${escapeHtml(issue.message)}</p><p class="field-help">${escapeHtml((issue.contexts||[]).map(context=>typeof context==='string'?context:context.name||'Unavailable context').join(', '))}</p>${(issue.actions||[]).slice(0,140).filter(id=>Object.prototype.hasOwnProperty.call(labels,id)).map(id=>player&&issue.device!=='keyboard-mouse'?`<span class="field-help">${escapeHtml(labels[id])} · project device mapping</span>`:`<button class="toolbar-btn" type="button" data-input-conflict-repair="${escapeHtml(id)}">${player?'Rebind':'Review mapping'} · ${escapeHtml(labels[id])}</button>`).join('')}</div>`).join('')+(state.issues.length>128?'<p class="field-help">More overlaps exist. Review individual Action mappings to narrow this list.</p>':'');
}
function renderInputConflictDiagnostics(player=false) {
  const host=document.getElementById(player?'controls-input-conflicts':'input-conflict-diagnostics');if(!host)return;
  const compiled=typeof OpusInputContexts==='undefined'?{contexts:[]}:OpusInputContexts.compile(inputContexts,Object.keys(inputActionLabels()));
  const review=inputConflictReviewSelection||'initial',selection=review==='initial'?(currentPlayerSettings.inputContextId??null):review==='unrestricted'?null:review.slice(8);
  const state=inputConflictReview(player,selection);
  host.innerHTML=`<p class="field-help">${player?'Uses your effective local primary inputs and current gameplay context. Gamepad/touch defaults belong to the project.':'Shared inputs can be deliberate. Warnings do not change bindings, block export, or restrict controller gameplay.'}</p>${player?'':`<label>Review context<select class="field-input" id="input-conflict-context"><option value="initial"${review==='initial'?' selected':''}>Level initial context</option><option value="unrestricted"${review==='unrestricted'?' selected':''}>Unrestricted input</option>${review.startsWith('context:')&&!compiled.contexts.some(context=>'context:'+context.id===review)?`<option value="${escapeHtml(review)}" selected>Unavailable reviewed context</option>`:''}${compiled.contexts.map(context=>`<option value="context:${escapeHtml(context.id)}"${review==='context:'+context.id?' selected':''}>${escapeHtml(context.name)}${context.valid?'':' — unavailable'}</option>`).join('')}</select></label>`}${inputConflictIssuesHTML(state,player)}`;
  if(!player)host.querySelector('#input-conflict-context').onchange=e=>{inputConflictReviewSelection=e.target.value;renderInputConflictDiagnostics(false);};
  for(const button of host.querySelectorAll('[data-input-conflict-repair]')){button.disabled=!player&&playMode;button.onclick=()=>openInputConflictRepair(button.dataset.inputConflictRepair,player);}
}
function refreshInputConflictDiagnostics() {renderInputConflictDiagnostics(false);if(document.getElementById('controls-panel')?.classList.contains('visible'))renderInputConflictDiagnostics(true);}
function renderInputActionPanel() {
  const listEl = document.getElementById('input-action-list');
  if (!listEl) return;
  const relevant = controllerInputActionIds(currentPlayerSettings.controllerType).filter(id=>Object.prototype.hasOwnProperty.call(INPUT_ACTION_LABELS,id));
  listEl.innerHTML = relevant.map((name) => {
    const label = (name === 'jump' && currentPlayerSettings.controllerType === 'hovercraft') ? 'Boost' : INPUT_ACTION_LABELS[name];
    return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="flex:1;font-size:12px;color:#c7d3ea">${label}</span>
      <button data-rebind-action="${name}" style="min-width:90px">${rebindingAction === name ? 'Press a key…' : keyCodeToLabel(inputActionMap[name])}</button>
    </div>`;
  }).join('');
  listEl.querySelectorAll('[data-rebind-action]').forEach((btn) => {
    btn.onclick = () => { rebindingAction = btn.dataset.rebindAction; renderInputActionPanel(); };
  });
  if(typeof renderInputActionAssetEditor==='function')renderInputActionAssetEditor();
  if(typeof renderControllerInputActionSetEditor==='function')renderControllerInputActionSetEditor();
  if(typeof renderInputDeviceMappingEditor==='function')renderInputDeviceMappingEditor();
  if(typeof renderInputContextEditor==='function')renderInputContextEditor();
  renderInputConflictDiagnostics(false);
}
function copyInputContexts(record) {
  return record === undefined ? OpusInputContexts.defaults() : OpusInputContexts.copy(record);
}
function inputContextChoiceHTML(value, attrs = '', unrestricted = false) {
  const state = OpusInputContexts.inspect(inputContexts), records = state.ok ? state.record.contexts : [];
  const selected = value===null||value===undefined ? '' : typeof value==='string'&&value ? value : '__unavailable__';
  const compiled = OpusInputContexts.compile(inputContexts, Object.keys(inputActionLabels()));
  const available = new Set(compiled.contexts.filter(context => context.valid).map(context => context.id));
  const known = records.some(context => context.id === selected);
  return `<select ${attrs}><option value=""${!selected?' selected':''}>${unrestricted?'Unrestricted historical input':'Choose an input context'}</option>${selected&&!known?`<option value="${escapeHtml(selected)}" selected>Unavailable saved input context</option>`:''}${records.map(context=>`<option value="${escapeHtml(context.id)}"${context.id===selected?' selected':''}${available.has(context.id)?'':' disabled'}>${escapeHtml(context.name)}${available.has(context.id)?'':' — unavailable Action reference'}</option>`).join('')}</select>`;
}
function refreshInputContextConsumers() {
  renderInputContextEditor(); renderInitialInputContextPicker();
  if(typeof selectedItem!=='undefined' && selectedItem && typeof renderBehaviorList==='function')renderBehaviorList(selectedItem);
  if(typeof renderSequencePanel==='function')renderSequencePanel();
  if(typeof graphEditorState!=='undefined' && graphEditorState && typeof renderGraphNodes==='function')renderGraphNodes();
  if(typeof renderHudElementList==='function' && !playMode)renderHudElementList();
  refreshInputConflictDiagnostics();
}
function createInputContext() {
  if(playMode)return {ok:false,reason:'Stop Play before authoring input contexts.'};
  const state=OpusInputContexts.inspect(inputContexts);if(!state.ok)return state;
  let name='Input context',suffix=2;const names=new Set(state.record.contexts.map(context=>context.name.trim().toLowerCase()));
  while(names.has(name.toLowerCase()))name='Input context '+suffix++;
  let id;try{id=OpusInputContexts.freshId();}catch(error){return {ok:false,reason:error.message||'Secure context identity is unavailable.'};}
  const next=OpusInputContexts.upsert(inputContexts,{id,name,actions:[],look:true});if(!next.ok)return next;
  pushUndo();inputContexts=next.record;editingInputContextId=id;refreshInputContextConsumers();return {ok:true,contextId:id};
}
function saveInputContext(id,name,actions,look) {
  if(playMode)return {ok:false,reason:'Stop Play before authoring input contexts.'};
  const state=OpusInputContexts.inspect(inputContexts);if(!state.ok)return state;
  const previous=state.record.contexts.find(context=>context.id===id);if(!previous)return {ok:false,reason:'Choose an existing context.'};
  const labels=inputActionLabels();
  if(!Array.isArray(actions)||actions.some(action=>!Object.prototype.hasOwnProperty.call(labels,action)&&!previous.actions.includes(action)))return {ok:false,reason:'Choose named Actions; unavailable retained references are not reassigned.'};
  const next=OpusInputContexts.upsert(inputContexts,{...previous,name,actions,look});if(!next.ok)return next;
  if(JSON.stringify(next.record)===JSON.stringify(state.record))return {ok:true,changed:false};
  pushUndo();inputContexts=next.record;refreshInputContextConsumers();return {ok:true,changed:true};
}
function deleteInputContext(id) {
  if(playMode)return false;
  const state=OpusInputContexts.inspect(inputContexts);if(!state.ok||!state.record.contexts.some(context=>context.id===id))return false;
  const next=OpusInputContexts.remove(inputContexts,id);if(!next.ok)return false;
  // Typed initial/Action references are retained as unavailable, never redirected.
  pushUndo();inputContexts=next.record;editingInputContextId='';refreshInputContextConsumers();return true;
}
function renderInputContextEditor() {
  const host=document.getElementById('input-contexts');if(!host||typeof OpusInputContexts==='undefined')return;
  const state=OpusInputContexts.inspect(inputContexts),records=state.ok?state.record.contexts:[];
  if(!records.some(context=>context.id===editingInputContextId))editingInputContextId=records[0]?.id||'';
  const record=records.find(context=>context.id===editingInputContextId),disabled=playMode||!state.ok||!record,labels=inputActionLabels();
  const ids=[...new Set([...Object.keys(labels),...(record?.actions||[])])];
  const compiled=OpusInputContexts.compile(inputContexts,Object.keys(labels)),status=compiled.contexts.find(context=>context.id===record?.id);
  host.innerHTML=`<p class="field-help">Contexts enable named gameplay Actions and camera look. They do not alter key bindings or block Pause/Close. An empty selected context accepts no gameplay Actions.</p><label>Context<select id="input-context-select"${playMode||!state.ok?' disabled':''}>${records.length?records.map(context=>`<option value="${escapeHtml(context.id)}"${context.id===editingInputContextId?' selected':''}>${escapeHtml(context.name)}</option>`).join(''):'<option value="">Create a context</option>'}</select></label><label>Name<input id="input-context-name" maxlength="80" value="${escapeHtml(record?.name||'')}"${disabled?' disabled':''}></label><label><input id="input-context-look" type="checkbox"${record?.look?' checked':''}${disabled?' disabled':''}> Camera look</label><div id="input-context-actions">${ids.map(id=>`<label><input type="checkbox" data-input-context-action="${escapeHtml(id)}"${record?.actions.includes(id)?' checked':''}${disabled?' disabled':''}> ${escapeHtml(labels[id]||'Unavailable saved Action')} ${Object.prototype.hasOwnProperty.call(labels,id)?'':'(retained reference; uncheck to remove)'}</label>`).join('')}</div><button id="input-context-new" type="button"${playMode||!state.ok||records.length>=32?' disabled':''}>New context</button><button id="input-context-save" type="button"${disabled?' disabled':''}>Save context</button><button id="input-context-delete" type="button"${disabled?' disabled':''}>Delete context</button><p id="input-context-status" class="field-help" role="status">${escapeHtml(!state.ok?state.reason:status&&!status.valid?status.reason:'Project definitions. Initial selection is authored in Player Controller; Set / Reset Input Context changes only the current Play session.')}</p>`;
  host.querySelector('#input-context-select').onchange=event=>{editingInputContextId=event.target.value;renderInputContextEditor();};
  host.querySelector('#input-context-new').onclick=()=>{const result=createInputContext();if(!result.ok)host.querySelector('#input-context-status').textContent=result.reason;};
  host.querySelector('#input-context-save').onclick=()=>{
    const actions=Array.from(host.querySelectorAll('[data-input-context-action]:checked')).map(input=>input.dataset.inputContextAction);
    const result=saveInputContext(editingInputContextId,host.querySelector('#input-context-name').value,actions,host.querySelector('#input-context-look').checked);
    if(!result.ok)host.querySelector('#input-context-status').textContent=result.reason;
  };
  host.querySelector('#input-context-delete').onclick=()=>deleteInputContext(editingInputContextId);
}
function setInitialInputContext(id) {
  if(playMode)return false;
  if(!OpusInputContexts.inspect(inputContexts).ok)return false;
  if(id!==null){const compiled=OpusInputContexts.compile(inputContexts,Object.keys(inputActionLabels()));if(!OpusInputContexts.resolve(compiled,id).valid)return false;}
  if((currentPlayerSettings.inputContextId??null)===id)return false;
  pushUndo();currentPlayerSettings.inputContextId=id;renderInitialInputContextPicker();refreshInputConflictDiagnostics();return true;
}
function renderInitialInputContextPicker() {
  const host=document.getElementById('player-input-context-host');if(!host||typeof OpusInputContexts==='undefined')return;
  const state=OpusInputContexts.inspect(inputContexts);
  host.innerHTML=`<label for="player-input-context">Initial input context</label>${inputContextChoiceHTML(currentPlayerSettings.inputContextId,'id="player-input-context"'+(playMode||!state.ok?' disabled':''),true)}<p class="field-help">${escapeHtml(state.ok?'Missing saved contexts stay unavailable. Reset Input Context returns to this level’s initial selection.':state.reason)}</p>`;
  host.querySelector('#player-input-context').onchange=event=>{setInitialInputContext(event.target.value||null);renderInitialInputContextPicker();};
}
function renderInputActionAssetEditor() {
  const host=document.getElementById('input-action-assets'); if(!host || typeof OpusInputActionAssets==='undefined')return;
  host.innerHTML=`<p class="field-help">Create a named logical Action, bind its default key, then choose it in Input Action Pressed/Held graph Conditions or a HUD prompt. Naming an Action does not add a controller ability. References stay stable when renamed.</p><label>Action name<input id="input-action-name" maxlength="80" placeholder="e.g. Open map"${playMode?' disabled':''}></label><label>Description<input id="input-action-description" maxlength="512"${playMode?' disabled':''}></label><button id="input-action-create" type="button" class="toolbar-btn"${playMode?' disabled':''}>Create Input Action</button><div id="input-action-asset-rows"></div><p id="input-action-asset-status" class="field-help" role="status">Project-local Actions; author defaults are separate from player preferences.</p>`;
  const rows=host.querySelector('#input-action-asset-rows');
  rows.innerHTML=inputActionAssets.slice(0,128).map(record=>{
    const action=OpusInputActionAssets.find(inputActionAssets,record?.id);
    if(!action)return '<p class="field-help">Unavailable saved Input Action retained; it cannot execute. Repair the project record without replacing unrelated data.</p>';
    return `<div class="input-action-asset-row" data-input-action-id="${escapeHtml(action.id)}"><label>Name<input data-input-action-name maxlength="80" value="${escapeHtml(action.name)}"${playMode?' disabled':''}></label><label>Description<input data-input-action-description maxlength="512" value="${escapeHtml(action.description||'')}"${playMode?' disabled':''}></label><button type="button" data-rebind-action="${escapeHtml(action.id)}"${playMode?' disabled':''}>${rebindingAction===action.id?'Press a key…':escapeHtml(keyCodeToLabel(inputActionMap[action.id]))}</button><button type="button" data-input-action-save${playMode?' disabled':''}>Save name/details</button><button type="button" data-input-action-delete${playMode?' disabled':''}>Delete Action</button></div>`;
  }).join('');
  const status=result=>{document.getElementById('input-action-asset-status').textContent=result.ok?'Input Action saved. Choose its default key and use the typed Condition picker.':result.reason;};
  host.querySelector('#input-action-create').onclick=()=>status(createInputActionAsset(host.querySelector('#input-action-name').value,host.querySelector('#input-action-description').value));
  rows.querySelectorAll('[data-input-action-id]').forEach(row=>{
    const id=row.dataset.inputActionId;
    row.querySelector('[data-rebind-action]').onclick=()=>{if(playMode)return;rebindingAction=id;renderInputActionPanel();};
    row.querySelector('[data-input-action-save]').onclick=()=>status(editInputActionAsset(id,row.querySelector('[data-input-action-name]').value,row.querySelector('[data-input-action-description]').value));
    row.querySelector('[data-input-action-delete]').onclick=()=>{if(!deleteInputActionAsset(id))status({ok:false,reason:'Stop Play before deleting an available Action.'});else status({ok:true});};
  });
}
window.addEventListener('keydown', (e) => {
  if (!rebindingAction) return;
  if (playMode) { rebindingAction = null; return; }
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  e.preventDefault();
  // Input collision policy (Wave 5, section 23): a bounded "warn, don't
  // block" -- an author might genuinely want Attack and Interact on the
  // same key for a simple game (fewer buttons to explain), so refusing the
  // rebind outright would be presumptuous. The rebind still happens; the
  // OTHER action(s) already on that key just get flagged in the status
  // toast so it's never a silent surprise.
  const conflicting = Object.keys(inputActionMap).filter((k) => k !== rebindingAction && inputActionMap[k] === e.code);
  const reboundLabel = inputActionLabels()[rebindingAction] || 'Unavailable Action';
  if(!findInputAction(rebindingAction)) { rebindingAction=null; return; }
  if(!validInputActionCode(e.code)) { showStatus('This key has no supported stable input code. Choose another key; the saved default is unchanged.'); return; }
  if (inputActionMap[rebindingAction] !== e.code) pushUndo();
  inputActionMap[rebindingAction] = e.code;
  rebindingAction = null;
  renderInputActionPanel();
  refreshInputActionConsumers();
  if (conflicting.length > 0) {
    showStatus(`${reboundLabel} rebound to ${keyCodeToLabel(e.code)} -- also used by ${conflicting.map((k) => inputActionLabels()[k]||'Retained binding').join(', ')}`);
  } else {
    showStatus(`${reboundLabel} rebound to ${keyCodeToLabel(e.code)}`);
  }
});
renderInputActionPanel();

// Wave 6 (Priority D): the PLAYER-facing counterpart to renderInputActionPanel
// above -- shown from the Pause Menu during a real Play session, writes to
// `playerInputOverrides` (never touching the author's own `inputActionMap`),
// and accepts a MOUSE BUTTON as the next binding, not just a keyboard key
// (a rebind waiting on keydown alone would have no way to ever bind Attack
// to a mouse click). "(default)" vs a highlighted custom binding makes the
// override state visible at a glance, and a per-row Reset clears just that
// one action back to the author's own default.
let playerRebindingAction = null;
function controlsRowsHtml(preview = false) {
  const labels=inputActionLabels(),relevant=controllerInputActionIds(currentPlayerSettings.controllerType);
  return relevant.map((name) => {
    const label = (name === 'jump' && currentPlayerSettings.controllerType === 'hovercraft') ? 'Boost' : labels[name];
    const isCustom = !preview && Object.prototype.hasOwnProperty.call(playerInputOverrides,name);
    const current = preview ? (validInputActionCode(inputActionMap[name]) ? inputActionMap[name] : inputDeviceTargetCode(name, true)) : effectiveInputMap[name];
    const display = !preview && playerRebindingAction === name ? 'Press a key or click…' : `${keyCodeToLabel(current)}${isCustom ? '' : ' (default)'}`;
    return `
    <div class="controls-row">
      <span>${escapeHtml(label)}</span>
      <div style="display:flex;gap:4px">
        <button ${preview ? 'disabled' : ''} class="${isCustom ? 'controls-row-custom' : ''}" data-controls-rebind="${escapeHtml(name)}">${escapeHtml(display)}</button>
        ${isCustom ? `<button data-controls-reset-one="${name}" title="Reset to default">↺</button>` : ''}
      </div>
    </div>`;
  }).join('') + (currentPlayerSettings.controllerType === 'thirdperson' ? `
    <div class="controls-row">
      <span>Rotate Camera</span>
      <div style="display:flex;gap:4px"><button disabled>Hold right mouse + drag · right stick</button></div>
    </div>` : '');
}
function renderControlsPanel() {
  const listEl = document.getElementById('controls-panel-list');
  if (!listEl) return;
  listEl.innerHTML = controlsRowsHtml(false);
  listEl.querySelectorAll('[data-controls-rebind]').forEach((btn) => {
    btn.onclick = () => { playerRebindingAction = btn.dataset.controlsRebind; renderControlsPanel(); };
  });
  listEl.querySelectorAll('[data-controls-reset-one]').forEach((btn) => {
    btn.onclick = () => {
      delete playerInputOverrides[btn.dataset.controlsResetOne];
      savePlayerInputOverrides();
      renderControlsPanel();
    };
  });
  renderInputConflictDiagnostics(true);
}
// Shared by both the keydown and mouse-button capture paths below -- one
// place that commits a player rebind, so the two input sources can never
// apply the conflict-check/save/status-toast logic differently.
function commitPlayerRebind(code) {
  if (!playerRebindingAction) return;
  const action = playerRebindingAction;
  playerRebindingAction = null;
  if(!findInputAction(action) || !validInputActionCode(code)) { renderControlsPanel(); return; }
  if(typeof releaseTouchInputControls==='function')releaseTouchInputControls();
  const conflicting = Object.keys(inputActionMap).filter((k) => k !== action && effectiveInputMap[k] === code);
  playerInputOverrides[action] = code;
  savePlayerInputOverrides();
  renderControlsPanel();
  const label = inputActionLabels()[action];
  if (conflicting.length > 0) {
    showStatus(`${label} rebound to ${keyCodeToLabel(code)} -- also used by ${conflicting.map((k) => inputActionLabels()[k]||'Retained binding').join(', ')}`);
  } else {
    showStatus(`${label} rebound to ${keyCodeToLabel(code)}`);
  }
}
window.addEventListener('keydown', (e) => {
  if (!playerRebindingAction) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  e.preventDefault();
  commitPlayerRebind(e.code);
});
// Mouse-button capture: listens on the canvas itself (not window) so a
// click on the rebind BUTTON that started this capture doesn't immediately
// end up being captured as its own new binding -- pointerdown on the
// button element is a different target than the canvas, so this listener
// simply never fires for that click at all.
function capturePlayerRebindPointer(e) {
  if (!playerRebindingAction || e.pointerType !== 'mouse') return;
  // Controls covers the canvas. Capture its non-interactive background too,
  // never the button which starts/replaces capture or another UI control.
  if (e.target?.closest?.('button,input,select,textarea,a,[role="button"]')) return;
  e.preventDefault();
  commitPlayerRebind(`Mouse${e.button}`);
}
canvas.addEventListener('pointerdown', capturePlayerRebindPointer);
document.getElementById('controls-panel').addEventListener('pointerdown', capturePlayerRebindPointer);
// Wave 6 (Priority E): the Controls panel is now a top-level overlay
// reachable from BOTH the Pause Menu and the Main Menu (Start Screen) --
// one shared open/close pair wired to both trigger buttons, rather than
// two separate panel instances that could drift apart.
function openControlsPanel() {
  const state = OpusPlayerRebindScreen.inspect(currentUiConfig.rebindScreen);
  if (!playMode || !state.ok || !state.record.enabled) return;
  document.getElementById('controls-panel-title').textContent = state.record.title;
  document.getElementById('controls-panel-description').textContent = state.record.description;
  const legacy = app.settings.get('inputOverrides');
  document.getElementById('controls-preference-note').textContent = !OpusPlayerRebindScreen.scopeKey(playerPreferenceScope) ? 'Project preference identity is unavailable. Changes last for this session only.' : legacy && Object.keys(legacy).length ? 'Earlier unscoped bindings remain stored. Choose your preferred keys once for this project.' : 'Your choices stay on this device, separate from the creator’s defaults.';
  acquireGameplayScreenPause('controls');
  document.getElementById('controls-panel').classList.add('visible');
  renderControlsPanel();
}
function closeControlsPanel() {
  document.getElementById('controls-panel').classList.remove('visible');
  playerRebindingAction = null;
  releaseGameplayScreenPause('controls');
}
document.getElementById('pause-controls-btn').addEventListener('click', openControlsPanel);
document.getElementById('mainmenu-controls-btn').addEventListener('click', openControlsPanel);
document.getElementById('controls-close-btn').addEventListener('click', closeControlsPanel);
document.getElementById('controls-reset-btn').addEventListener('click', () => {
  playerInputOverrides = {};
  savePlayerInputOverrides();
  renderControlsPanel();
  showStatus('Controls reset to defaults');
});

// How To Play / Credits (Priority E) -- simple author-text overlays, same
// top-level-sibling pattern as Controls, only ever reachable from the Main
// Menu (there's no in-Play equivalent need for either, unlike Controls).
document.getElementById('mainmenu-howtoplay-btn').addEventListener('click', () => {
  document.getElementById('howtoplay-text').textContent = currentUiConfig.startScreen.howToPlay || '';
  document.getElementById('howtoplay-overlay').classList.add('visible');
});
document.getElementById('howtoplay-close-btn').addEventListener('click', () => {
  document.getElementById('howtoplay-overlay').classList.remove('visible');
});
document.getElementById('mainmenu-credits-btn').addEventListener('click', () => {
  document.getElementById('credits-text').textContent = currentUiConfig.startScreen.credits || '';
  document.getElementById('credits-overlay').classList.add('visible');
});
document.getElementById('credits-close-btn').addEventListener('click', () => {
  document.getElementById('credits-overlay').classList.remove('visible');
});
// Shows/hides the How To Play / Credits buttons based on whether the
// author actually wrote anything for them -- an untouched project (no text
// in either field) shows the Main Menu exactly as bare as it always was,
// matching the "omit at defaults" discipline every other optional feature
// in this editor already follows.
// Metadata alone does not prove a slot is readable. Keep legacy object
// payloads compatible, but never offer corrupt/null/primitive progress.
function findContinueSaveSlot() {
  const saves = projectRuntimeSaveSystem();
  for (const entry of saves.list()) {
    if (entry.slot !== 'default' && entry.slot !== 'auto') continue;
    const data = saves.load(entry.slot);
    if (data && typeof data === 'object' && !Array.isArray(data)) return entry.slot;
  }
  return null;
}

// Historical shared slots lack ownership proof. Explicit non-destructive copy
// only; no automatic fallback, overwrite, claiming or legacy deletion.
const legacySaveRecoveryButton=document.createElement('button');
legacySaveRecoveryButton.id='pause-legacy-save-btn';legacySaveRecoveryButton.textContent='Recover older progress…';
document.getElementById('pause-menu-buttons').append(legacySaveRecoveryButton);
legacySaveRecoveryButton.addEventListener('click',()=>{
  const dialog=document.createElement('dialog');dialog.id='legacy-player-save-recovery';dialog.style.cssText='max-width:540px;background:#152038;color:#e4eaff;padding:20px';
  dialog.innerHTML='<h2>Recover older shared progress</h2><p>Older games on this browser origin shared save names. We cannot prove which game owns an older slot. Only copy progress you recognize as belonging to this game. Existing game progress is never overwritten; old records stay unchanged. Copying does not load progress automatically. Use Continue or Load Game afterward.</p><label>Older slot <select data-legacy-slot></select></label><p data-legacy-status role="status"></p><button data-legacy-copy>Copy selected older progress</button> <button data-legacy-close>Cancel</button>';
  const select=dialog.querySelector('[data-legacy-slot]'),status=dialog.querySelector('[data-legacy-status]'),scope=playerPreferenceScope.id;
  try{
    const prefix='doengine:playersave:',storage=window.localStorage,slots=[];
    for(let i=0;i<Math.min(storage.length,1000)&&slots.length<100;i++){
      const key=storage.key(i);if(!key?.startsWith(prefix)||key.startsWith(prefix+'v1:'))continue;
      slots.push(key.slice(prefix.length));
    }
    slots.sort().forEach(slot=>{const option=document.createElement('option');option.value=slot;option.textContent=slot;select.append(option);});
    status.textContent=slots.length?'Review the selected name. Bounded to100 older names /1000 storage keys.':'No older shared slots found in this browser profile and origin.';
  }catch(error){status.textContent='Older storage is unavailable. No progress was copied.';}
  const dispose=()=>{dialog.close();dialog.remove();};dialog.querySelector('[data-legacy-close]').onclick=dispose;
  dialog.addEventListener('cancel',event=>{event.preventDefault();dispose();});
  dialog.querySelector('[data-legacy-copy]').onclick=()=>{
    try{
      if(!playMode||!app.paused||playerPreferenceScope.id!==scope)throw new Error('Session changed. Reopen recovery while paused.');
      const slot=select.value;if(!slot)throw new Error('Choose an older slot.');
      const raw=window.localStorage.getItem('doengine:playersave:'+slot);if(!raw||raw.length>4*1024*1024)throw new Error('Older slot missing or exceeds the bounded4Mi-character recovery limit.');
      const data=JSON.parse(raw).data;
      if(!data||typeof data!=='object'||Array.isArray(data)||!Number.isInteger(data.levelIndex)||!levels[data.levelIndex])throw new Error('Older progress does not identify an available level.');
      for(const key of ['gameState','flags','inventory','objectives','worldState','equipment','weaponRuntime'])if(data[key]!==undefined&&(!data[key]||typeof data[key]!=='object'||Array.isArray(data[key])))throw new Error('Malformed older progress: '+key);
      for(const key of ['checkpoint','playerPosition'])if(data[key]!=null&&(!Array.isArray(data[key])||data[key].length!==3||!data[key].every(Number.isFinite)))throw new Error('Malformed older position.');
      if(!window.confirm('Copy older shared slot "'+slot+'" into THIS game? Only proceed if you recognize this progress. No existing destination progress will be overwritten.'))return;
      if(playerPreferenceScope.id!==scope||window.localStorage.getItem('doengine:playersave:'+slot)!==raw)throw new Error('Project or older slot changed. Reopen recovery.');
      const result=projectRuntimeSaveSystem().saveChecked(slot,data,null);if(!result.ok)throw new Error(result.code==='conflict'?'This game already has that slot. Existing progress kept.':'Copy failed ('+result.code+'). Existing records kept.');
      status.textContent='Copied and verified for this game only. Original older record kept. Use Continue or Load Game to resume.';updateMainMenuExtras();
    }catch(error){status.textContent=error.message;}
  };
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-legacy-close]').focus();
});

function updateMainMenuExtras() {
  const controls = OpusPlayerRebindScreen.inspect(currentUiConfig.rebindScreen);
  for (const id of ['mainmenu-controls-btn', 'pause-controls-btn']) {
    const button = document.getElementById(id);
    button.style.display = controls.ok && controls.record.enabled ? '' : 'none';
    button.textContent = controls.ok ? controls.record.launcherLabel : 'Controls unavailable';
  }
  const cfg = currentUiConfig.startScreen;
  document.getElementById('mainmenu-howtoplay-btn').style.display = (cfg.howToPlay && cfg.howToPlay.trim()) ? '' : 'none';
  document.getElementById('mainmenu-credits-btn').style.display = (cfg.credits && cfg.credits.trim()) ? '' : 'none';
  // Continue considers both canonical slots in actual recency order, but
  // only offers readable object payloads rather than trusting metadata.
  document.getElementById('mainmenu-continue-btn').style.display = findContinueSaveSlot() ? '' : 'none';
}
document.getElementById('mainmenu-continue-btn').addEventListener('click', () => {
  // Recheck on click: another tab may have removed/corrupted the save since
  // this menu opened. Refusal must preserve the menu's pause ownership.
  const newestSlot = findContinueSaveSlot();
  if (!newestSlot) { showToast('No readable saved progress. Choose New Game to start fresh.'); return; }
  openingMenuFreshSession = false;
  document.getElementById('start-overlay').classList.remove('visible');
  if (app.paused) app.resume();
  executeAction('loadGame', { slot: newestSlot }, null);
});
// Shared Settings (Priority E) -- the SAME applyMasterVolume/renderQualityButton/
// fullscreen logic the Pause Menu already uses (Wave 4), just wired to a
// second set of elements living on the Main Menu -- no second
// volume/quality/fullscreen implementation, one behavior reachable from
// two screens.
document.getElementById('mainmenu-volume').addEventListener('input', (e) => applyMasterVolume(parseFloat(e.target.value)));
document.getElementById('mainmenu-mouse-sensitivity').addEventListener('input', (e) => updateMouseSensitivityPreference(e.target.value));
document.getElementById('mainmenu-invert-mouse-y').addEventListener('change', (e) => updateInvertMousePreference(e.target.checked));
document.getElementById('mainmenu-quality-btn').addEventListener('click', () => {
  const currentlyHigh = app.settings.get('quality') !== 'low';
  app.setQuality(currentlyHigh ? 'low' : 'high');
  renderQualityButton();
});
document.getElementById('mainmenu-fullscreen-btn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else canvas.requestFullscreen().catch(() => showStatus("Fullscreen isn't available"));
});
document.getElementById('mainmenu-volume').value = masterVolume;
for (const prefix of ['pause','mainmenu']) {
  document.getElementById(`${prefix}-gamepad-deadzone`).addEventListener('input', e => updateGamepadTuningPreference('deadZone', e.target.value));
  document.getElementById(`${prefix}-gamepad-look-rate`).addEventListener('input', e => updateGamepadTuningPreference('lookRate', e.target.value));
  document.getElementById(`${prefix}-gamepad-reset`).addEventListener('click', resetGamepadTuningPreferences);
}

// Tracks which keys WE (the gamepad poll) currently believe are held, so a
// key only gets simulateKeyUp'd on OUR OWN release edge -- never blindly
// every frame the pad isn't pressing it, which would fight a real physical
// keyboard held on the same code while a gamepad also happens to be
// connected (Input's key-state Set is shared between both input sources).
const gamepadHeldKeys = new Set();
let gamepadStartWasHeld = false; // Wave 9D (Priority I): edge-tracker for the gamepad Start->Pause wiring, reset alongside gamepadHeldKeys on Stop
// Right-stick look rate, in radians/second at full deflection -- a fixed
// constant rather than a per-project setting, since a stick already reports
// a continuous [-1,1] deflection (unlike a mouse's discrete pixel deltas),
// so "sensitivity" here just scales that continuous rate.
const GAMEPAD_LOOK_RATE = 2.6;
function pollGamepad(dt) {
  const pads = typeof navigator.getGamepads==='function'?navigator.getGamepads():[];
  const pad = pads && [...pads].find((p) => p && p.connected);
  if(!pad){app.input.observeGamepad?.(null,1);for(const code of gamepadHeldKeys)app.input.simulateKeyUp(code,'gamepad');gamepadHeldKeys.clear();gamepadStartWasHeld=false;return;}
  const tuning = effectiveGamepadTuning();
  const deadZone = tuning.ok ? tuning.record.deadZone : 1;
  app.input.observeGamepad?.(pad,deadZone);
  const axX = OpusInputTuning.axis(pad.axes?.[0], deadZone);
  const axY = OpusInputTuning.axis(pad.axes?.[1], deadZone);
  // Move Forward/Back/Left/Right (Wave 5, Priority D) read the CURRENT
  // Input Action binding at poll time, exactly like Interact/Attack/Jump
  // below -- a rebind takes effect on gamepad too with zero gamepad-
  // specific rebind code, since this is just "what key does the stick
  // simulate right now," re-read every poll.
  const want = Object.create(null);
  const desire=(code,held)=>{if(typeof code==='string'&&code)want[code]=!!want[code]||!!held;};
  desire(effectiveInputMap.moveForward, !!pad && ((pad.buttons[12] && pad.buttons[12].pressed) || axY < 0));
  desire(effectiveInputMap.moveBack, !!pad && ((pad.buttons[13] && pad.buttons[13].pressed) || axY > 0));
  desire(effectiveInputMap.moveLeft, !!pad && ((pad.buttons[14] && pad.buttons[14].pressed) || axX < 0));
  desire(effectiveInputMap.moveRight, !!pad && ((pad.buttons[15] && pad.buttons[15].pressed) || axX > 0));
  desire(effectiveInputMap.interact, !!pad && !!(pad.buttons[1] && pad.buttons[1].pressed));
  desire(effectiveInputMap.attack, !!pad && !!(pad.buttons[2] && pad.buttons[2].pressed));
  desire(effectiveInputMap.jump, !!pad && !!(pad.buttons[0] && pad.buttons[0].pressed));
  // Wave 9D (Priority I/Section 57): gamepad coverage for the Wave 9/9B
  // Input Actions that pollGamepad had never been extended to reach --
  // Reload/Switch Weapon (new this Wave 9 arc) and Crouch/Sprint/Inventory/
  // Pause (pre-existing actions with a keyboard/touch mapping but no
  // gamepad one at all). Standard-layout button indices (Y/L1/L2/L3/R3/
  // Select/Start); reads `effectiveInputMap` at poll time exactly like
  // every action above, so a rebind takes effect on gamepad too with zero
  // gamepad-specific rebind code, same reasoning already established here.
  if (effectiveInputMap.reload) desire(effectiveInputMap.reload, !!pad && !!(pad.buttons[3] && pad.buttons[3].pressed));
  if (effectiveInputMap.switchWeapon) desire(effectiveInputMap.switchWeapon, !!pad && !!(pad.buttons[4] && pad.buttons[4].pressed));
  if (effectiveInputMap.crouch) desire(effectiveInputMap.crouch, !!pad && !!(pad.buttons[6] && pad.buttons[6].pressed));
  if (effectiveInputMap.sprint) desire(effectiveInputMap.sprint, !!pad && !!(pad.buttons[10] && pad.buttons[10].pressed));
  if (effectiveInputMap.inventory) desire(effectiveInputMap.inventory, !!pad && !!(pad.buttons[8] && pad.buttons[8].pressed));
  // Valid authored sources replace only their Action's historical pad routes.
  // Rebuild the whole desired set so shared codes remain OR, not last writer.
  if(typeof OpusInputDeviceMappings!=='undefined') {
    for(const code of Object.keys(want))delete want[code];
    const runtime=inputDeviceRuntime||compileInputDeviceRuntime();
    for(const route of runtime.routes) {
      desire(inputDeviceTargetCode(route.action),OpusInputDeviceMappings.held(route.gamepad,pad,deadZone));
    }
  }
  // Pause has no logical Input Action at all (a UI button, `#pause-btn`,
  // not part of `inputActionMap`) -- gamepad Start is wired directly to
  // that same button, edge-triggered off the held-button tracker every
  // other gamepad action already uses, not a second polling mechanism.
  const startHeld = !!pad && !!(pad.buttons[9] && pad.buttons[9].pressed);
  if (startHeld && !gamepadStartWasHeld) document.getElementById('pause-btn').click();
  gamepadStartWasHeld = startHeld;
  for (const code of new Set([...gamepadHeldKeys,...Object.keys(want)])) {
    if (want[code]) { app.input.simulateKeyDown(code,'gamepad'); gamepadHeldKeys.add(code); }
    else if (gamepadHeldKeys.has(code)) { app.input.simulateKeyUp(code,'gamepad'); gamepadHeldKeys.delete(code); }
  }
  // First-Person right-stick look (Wave 5, section 19) -- feeds the exact
  // Same angular writer/pitch clamp, but stick radians/second are intentionally
  // independent of mouse pixel sensitivity. Strict independent-axis threshold.
  if (tuning.ok && playMode && !app.paused && !gameEnded && inputContextLookAllowed() && player && player.controllerType === 'firstperson' && Number.isFinite(dt) && dt >= 0) {
    const dx = OpusInputTuning.axis(pad.axes?.[2], deadZone);
    const dy = OpusInputTuning.axis(pad.axes?.[3], deadZone);
    if (dx !== 0 || dy !== 0) applyFirstPersonLook(dx * tuning.record.lookRate * dt, dy * tuning.record.lookRate * dt, 1);
  }
  if (tuning.ok && playMode && !app.paused && !gameEnded && inputContextLookAllowed() && player && player.controllerType === 'thirdperson' && Number.isFinite(dt) && dt >= 0) {
    const dx = OpusInputTuning.axis(pad.axes?.[2], deadZone);
    const dy = OpusInputTuning.axis(pad.axes?.[3], deadZone);
    if (dx !== 0 || dy !== 0) applyThirdPersonLook(dx * tuning.record.lookRate * dt, dy * tuning.record.lookRate * dt, 1);
  }
}
document.getElementById('touch-interact').addEventListener('pointerdown', (e) => { e.preventDefault(); if(inputActionTouchAllowed('interact')){markGameplayPointerDevice(e);fireInteract();} });
document.getElementById('touch-attack').addEventListener('pointerdown', (e) => { e.preventDefault(); if(inputActionTouchAllowed('attack')){markGameplayPointerDevice(e);fireAttack();} });
// Wave 9 (Priority A/Section 107): real touch coverage for Reload/Switch
// Weapon, Pointer Events, no touch-only parallel gameplay system -- both
// just call the exact same functions the keyboard path calls.
document.getElementById('touch-reload').addEventListener('pointerdown', (e) => { e.preventDefault(); if(!inputActionTouchAllowed('reload'))return; markGameplayPointerDevice(e);const w = resolveActivePlayerWeapon(); if (w) startWeaponReload(w); });
document.getElementById('touch-switch').addEventListener('pointerdown', (e) => { e.preventDefault(); if(inputActionTouchAllowed('switchWeapon')){markGameplayPointerDevice(e);switchActiveWeaponSlot();} });
// Wave 9D (Priority H/Section 54): a dedicated touch Inventory button --
// Inventory was previously only reachable via the raw `KeyI` keydown
// listener (Wave 8), with no touch equivalent at all. Calls the exact same
// `toggleInventory()` the keyboard path already calls, no touch-only
// parallel gameplay code.
document.getElementById('touch-inventory').addEventListener('pointerdown', (e) => { e.preventDefault(); if(document.getElementById('inventory-overlay').classList.contains('visible')||inputActionTouchAllowed('inventory'))markGameplayPointerDevice(e);toggleInventoryFromInput(); });

