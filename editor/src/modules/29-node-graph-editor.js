// --- Node graph editor UI ---
// Ports connect by clicking one, then clicking a compatible second one
// (not drag-to-connect) -- more forgiving than precise drag-release
// hit-testing on small circular targets, and works the same from touch as
// from mouse with no separate code path, consistent with the touch-support
// pass earlier this session.
// Action-kind entries are generated directly FROM ACTION_TYPES (same
// label, same field list) -- the graph never invents its own copy of what
// an action does or takes; see the shared action-execution core above.
// 'script' is deliberately excluded: Node Graph's whole point is a
// non-code visual path, so the code escape hatch stays fixed-dropdown-only.
// Condition nodes (and/or/counterReaches) are graph-only -- there's no
// equivalent concept in the fixed dropdown.
const GRAPH_NODE_TYPES = {};
for (const [type, def] of Object.entries(ACTION_TYPES)) {
  if (type === 'script') continue;
  GRAPH_NODE_TYPES[type] = { label: def.label, kind: 'action', fields: def.fields };
}
// Canonical Graph-condition authoring registry. Evaluation remains the existing
// evaluateConditionNode path, also reused by the bounded Dialogue leaf adapter.
// AI transition conditions have actor/state semantics and are not migrated here.
const CONDITION_TYPES = {
  inputActionPressed:{label:'Input Action Pressed',kind:'condition',help:'True on the real input press frame. Use On Update and a gate. Missing/unbound Actions fail closed; player preferences override author defaults.',fields:[{key:'inputActionId',label:'Input Action',type:'inputActionRef',required:true}]},
  inputActionHeld:{label:'Input Action Held',kind:'condition',help:'True while the real input is held. Use On Update and a gate; actions may run every frame while held. Missing/unbound Actions fail closed.',fields:[{key:'inputActionId',label:'Input Action',type:'inputActionRef',required:true}]},
  compareValues:{label:'Compare Values',kind:'condition',help:'Strict typed comparison. Connect a received Signal Value or other matching Value to Left/Right. Numbers support ordered comparisons; other types support equality/inequality. Empty Object means Self. Missing Objects and mismatches fail closed, including under NOT.',fields:[{key:'valueType',label:'Value type',type:'select',options:['number','text','boolean','object','color']},{key:'operator',label:'Comparison',type:'select',options:['eq','ne','lt','lte','gt','gte'],optionLabels:{eq:'Equals',ne:'Does not equal',lt:'Less than',lte:'At most',gt:'Greater than',gte:'At least'}},{key:'left',label:'Left value',type:'comparisonValue',valueType:node=>node?.valueType||'number'},{key:'right',label:'Right value',type:'comparisonValue',valueType:node=>node?.valueType||'number'}]},
  and: { label: 'AND', kind: 'condition', help: 'True when every connected operand is true. No operands is false. Cyclic or over-budget dependencies fail closed.', fields: [] },
  or: { label: 'OR', kind: 'condition', help: 'True when any connected operand is true. No operands is false. Evaluated cyclic or over-budget dependencies fail closed.', fields: [] },
  counterReaches: { label: 'Counter Reaches (>=)', kind: 'condition', fields: [{ key: 'counter', type: 'text', placeholder: 'Counter name' }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  counterAtMost: { label: 'Counter At Most (<=)', kind: 'condition', fields: [{ key: 'counter', type: 'text', placeholder: 'Counter name' }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  healthAtLeast: { label: 'Health At Least (>=)', kind: 'condition', fields: [{ key: 'target', type: 'number', placeholder: 'Target' }] },
  healthAtMost: { label: 'Health At Most (<=)', kind: 'condition', fields: [{ key: 'target', type: 'number', placeholder: 'Target' }] },
  // Object Health (Wave 4) -- an explicit `targetId` field rather than an
  // implicit "the object this graph is attached to", since evaluateConditionNode
  // has no item-context parameter (only node+graph) -- consistent with how
  // every OTHER object reference in this engine (Change Camera, AI Follow
  // Target, Set Position) is already an explicit dropdown, not implicit.
  objectHealthAtLeast: { label: 'Object Health At Least (>=)', kind: 'condition', fields: [{ key: 'targetId', label: 'Object', type: 'target', implicitSelf: false }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  objectHealthAtMost: { label: 'Object Health At Most (<=)', kind: 'condition', fields: [{ key: 'targetId', label: 'Object', type: 'target', implicitSelf: false }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  // Graph-only, same reasoning as and/or/counterReaches above -- Delay is a
  // sequencing primitive (see runGraph/processPendingDelays), not a single
  // fire-and-forget action, so it has no fixed-dropdown equivalent.
  timerFinished: { label: 'Timer Finished', kind: 'condition', fields: [{ key: 'timer', type: 'text', placeholder: 'Timer name' }] },
  timerAtLeast: { label: 'Timer At Least (>=)', kind: 'condition', fields: [{ key: 'timer', type: 'text', placeholder: 'Timer name' }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  timerAtMost: { label: 'Timer At Most (<=)', kind: 'condition', fields: [{ key: 'timer', type: 'text', placeholder: 'Timer name' }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  not: { label: 'NOT', kind: 'condition', help: 'Inverts its connected operand. No operand is true for historical compatibility. Cyclic or over-budget dependencies fail closed.', fields: [] },
  counterEquals: { label: 'Counter Equals (=)', kind: 'condition', fields: [{ key: 'counter', type: 'text', placeholder: 'Counter name' }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  counterLessThan: { label: 'Counter Less Than (<)', kind: 'condition', fields: [{ key: 'counter', type: 'text', placeholder: 'Counter name' }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  counterGreaterThan: { label: 'Counter Greater Than (>)', kind: 'condition', fields: [{ key: 'counter', type: 'text', placeholder: 'Counter name' }, { key: 'target', type: 'number', placeholder: 'Target' }] },
  objectVisible: { label: 'Object Visible', kind: 'condition', fields: [{ key: 'targetId', label: 'Object', type: 'target', implicitSelf: false }] },
  isFlagTrue: { label: 'Is Flag True', kind: 'condition', fields: [{ key: 'name', type: 'text', placeholder: 'Flag name' }] },
  isFlagFalse: { label: 'Is Flag False', kind: 'condition', fields: [{ key: 'name', type: 'text', placeholder: 'Flag name' }] },
  hasItem: { label: 'Has Item', kind: 'condition', fields: [{ key: 'name', type: 'text', placeholder: 'Item name' }, { key: 'count', type: 'number', placeholder: 'Count (default 1)' }] },
  hasNamedItem: {label:'Has Named Item',kind:'condition',help:'Choose a Project Item by name. Requires a positive whole quantity; missing or ambiguous saved Items fail closed. Legacy Has Item still accepts free names.',fields:[{key:'itemId',label:'Item',type:'itemDefRef'},{key:'count',label:'Quantity',type:'number',default:1,placeholder:'1'}]},
  doorIsClosed: {label:'Door Is Closed',kind:'condition',help:'An enabled valid Door / Gate is closed. Uses the same canonical state as Open/Close Door; unavailable targets fail closed.',fields:[{key:'targetId',label:'Door / Gate',type:'target'}]},
  // Wave 7: only nodes forced by a new system, per this wave's own explicit
  // Node Graph scope -- Objective conditions (Priority F) and Slot Has Item
  // (Priority C), reusing the exact same `evaluateConditionNode` cases
  // already written for the fixed-list side, nothing new evaluated here.
  objectiveIsComplete: { label: 'Objective Is Complete', kind: 'condition', fields: [{ key: 'objectiveId', type: 'objectiveRef' }] },
  objectiveIsActive: { label: 'Objective Is Active', kind: 'condition', fields: [{ key: 'objectiveId', type: 'objectiveRef' }] },
  slotHasItem: { label: 'Equipment Slot Has Item', kind: 'condition', fields: [{ key: 'slot', type: 'text', placeholder: 'primaryHand' }, { key: 'name', type: 'text', placeholder: 'Item name (optional)' }] },
  objectIsHeld: { label: 'Object Is Held (Carry/Drop)', kind: 'condition', fields: [{ key: 'targetId', type: 'target', implicitSelf: false, nullable: true, emptyLabel: 'Any held object' }] },
  // Wave 8 (Priority B): `targetId` optional -- empty means Self, the exact
  // same default `evaluateConditionNode`'s own new cases resolve.
  objectVariableEquals: { label: 'Object Variable Equals', kind: 'condition', fields: [{ key: 'targetId', type: 'target' }, { key: 'name', type: 'text', placeholder: 'label' }, { key: 'value', type: 'text', placeholder: 'value' }] },
  numberAtLeast: { label: 'Object Variable Number At Least', kind: 'condition', fields: [{ key: 'targetId', type: 'target' }, { key: 'name', type: 'text', placeholder: 'healthPhase' }, { key: 'value', type: 'number', placeholder: '1' }] },
  numberAtMost: { label: 'Object Variable Number At Most', kind: 'condition', fields: [{ key: 'targetId', type: 'target' }, { key: 'name', type: 'text', placeholder: 'healthPhase' }, { key: 'value', type: 'number', placeholder: '1' }] },
  booleanIs: { label: 'Object Variable Boolean Is', kind: 'condition', fields: [{ key: 'targetId', type: 'target' }, { key: 'name', type: 'text', placeholder: 'activated' }, { key: 'value', type: 'select', options: ['true', 'false'] }] },
};
for (const [type, definition] of Object.entries(CONDITION_TYPES)) {
  for (const field of definition.fields) {
    const labels = {targetId:'Object',objectiveId:'Objective',counter:'Counter name',timer:'Timer name',target:'Threshold',value:'Value',count:'Quantity',slot:'Equipment slot'};
    if (field.key === 'name') labels.name = /Flag/.test(type) ? 'Flag name' : type === 'hasItem' || type === 'slotHasItem' ? 'Item name' : 'Variable name';
    field.label = field.label || labels[field.key] || field.placeholder || field.key;
  }
}
OpusAuthoringLanguage.enrichConditions(CONDITION_TYPES, 'graph');
for (const [type, definition] of Object.entries(CONDITION_TYPES)) {
  GRAPH_NODE_TYPES[type] = { ...definition, kind: 'condition', fields: definition.fields };
}
GRAPH_NODE_TYPES.delay = {label:'Delay / Wait',kind:'action',fields:[{key:'seconds',label:'Seconds',type:'number',placeholder:'1'}]};
Object.assign(GRAPH_NODE_TYPES, OpusGraphValues.VALUE_TYPES);
Object.assign(GRAPH_NODE_TYPES, OpusGraphVariables.NODE_TYPES);
Object.assign(GRAPH_NODE_TYPES, OpusGraphFunctions.NODE_TYPES);
GRAPH_NODE_TYPES.readSignalValue={label:'Read Signal Value',kind:'value',valueSource:'signal',outputType:node=>{const type=OpusSignals.payloadType(OpusSignals.find(signalDefinitions,node?.signalId));return type==='none'?null:type;},help:'The chosen Signal occurrence value in this receiver invocation, including after Wait/Function calls. Not a global last value.',fields:[{key:'signalId',label:'Signal',type:'signalRef'}]};
CONDITION_TYPES.booleanIs.fields.find(f => f.key === 'value').valueType = 'boolean';
// (from-port, to-port) -> edge kind. Checked in both click orders, since
// the user might click either port of a pair first.
const GRAPH_EDGE_RULES = [
  { from: 'next-out', to: 'next-in', kind: 'next' },
  { from: 'cond-out', to: 'gate-in', kind: 'gate' },
  { from: 'cond-out', to: 'cond-in', kind: 'cond' },
];

let graphFunctions = []; // project-local reusable definitions; no hidden browser-storage library
let signalDefinitions = []; // authored project-local names; pending occurrences are transient
const signalDiagnostics=OpusSignals.createDiagnostics();
let signalInspectorId='',signalInspectorLastDraw=-Infinity;
function observeSignalEvent(event){if(event.kind==='reset'){signalDiagnostics.clear();syncSignalInspector(true);return;}signalDiagnostics.record({...event,time:typeof simElapsed==='number'?simElapsed:0});}
function signalInspectorRoutes(id){const rows=[];let scanned=0;for(const owner of placed){for(const behavior of Array.isArray(owner.behaviors)?owner.behaviors:[]){if(++scanned>4096)return {rows,truncated:true};if(behavior?.trigger==='signal'&&behavior.eventRef?.signalId===id)rows.push({owner,role:'Receives On Signal'});if(behavior?.action==='sendSignal'&&behavior.params?.signalId===id)rows.push({owner,role:'Sends Signal · '+behavior.trigger});for(const node of Array.isArray(behavior?.graph?.nodes)?behavior.graph.nodes:[]){if(++scanned>4096)return {rows,truncated:true};if(node?.type==='sendSignal'&&node.signalId===id)rows.push({owner,role:'Graph sends Signal'});}}}return {rows,truncated:false};}
function syncSignalInspector(force=false){const panel=document.getElementById('signal-inspector');if(!panel||!panel.open)return;const now=performance.now();if(!force&&now-signalInspectorLastDraw<150)return;signalInspectorLastDraw=now;const target=document.getElementById('signal-inspector-target');const valid=signalDefinitions.slice(0,128).filter(d=>OpusSignals.find(signalDefinitions,d?.id));if(!signalInspectorId&&valid.length)signalInspectorId=valid[0].id;target.innerHTML='<option value="">Choose Signal</option>'+valid.map(d=>`<option value="${escapeHtml(d.id)}"${d.id===signalInspectorId?' selected':''}>${escapeHtml(d.name)}</option>`).join('')+(signalInspectorId&&!OpusSignals.find(signalDefinitions,signalInspectorId)?'<option selected value="'+escapeHtml(signalInspectorId)+'">Unavailable Signal · retained selection</option>':'');const definition=OpusSignals.find(signalDefinitions,signalInspectorId),routes=signalInspectorRoutes(signalInspectorId);document.getElementById('signal-inspector-routes').innerHTML=definition?`<p><strong>${escapeHtml(definition.name)}</strong> · ${escapeHtml(OpusSignals.payloadType(definition))} · ${escapeHtml(OpusSignals.channelScope(definition))} channel</p><p>${routes.rows.filter(r=>r.role.startsWith('Sends')||r.role.startsWith('Graph')).length} direct senders · ${routes.rows.filter(r=>r.role.startsWith('Receives')).length} authored receivers${routes.truncated?' · scan limit reached':''}</p>`+routes.rows.slice(0,16).map(r=>`<p>${escapeHtml(r.role)}: <button type="button" data-signal-inspector-object="${escapeHtml(r.owner.id)}"${playMode?' disabled':''}>${escapeHtml(itemDisplayName(r.owner))}</button> · ${escapeHtml(r.owner.signalPrefabInstanceId?'placed Prefab instance':r.owner.sourcePrefabName?'linked Prefab root':'scene Object')}</p>`).join('')+(routes.rows.length>16?'<p>More routes exist; first16 shown.</p>':''):'<p>Choose an available named Signal. Invalid/missing definitions are retained for repair, not dispatched.</p>';document.querySelectorAll('[data-signal-inspector-object]').forEach(button=>button.onclick=()=>{if(playMode)return;const item=findItemById(button.dataset.signalInspectorObject);if(item){selectItem(item);activateTab('right-tab','inspector');}});const state=signalDiagnostics.snapshot(),name=id=>OpusSignals.find(signalDefinitions,id)?.name||'Unavailable Signal',owner=id=>{const item=findItemById(id);return item?itemDisplayName(item):id?'Removed Object':'No sender';};document.getElementById('signal-inspector-readout').textContent=`${state.enabled?'Capturing':'Capture off'} · ${state.records.length}/${state.capacity} retained · ${state.dropped} older records discarded\n`+state.records.filter(r=>!signalInspectorId||r.signalId===signalInspectorId).slice(-12).map(r=>`${r.time.toFixed(2)}s · ${name(r.signalId)} · ${r.kind.toUpperCase()}\n${owner(r.sourceId)}${r.receiverId?' → '+owner(r.receiverId):''} · ${r.scope||'no eligible channel'} · ${r.value}\n${r.reason}`).join('\n\n');}
document.getElementById('signal-inspect-btn').addEventListener('click',()=>{document.getElementById('signal-inspector').open=true;syncSignalInspector(true);});
document.getElementById('signal-inspector').addEventListener('toggle',()=>syncSignalInspector(true));
document.getElementById('signal-inspector-target').addEventListener('change',event=>{signalInspectorId=event.target.value;syncSignalInspector(true);});
document.getElementById('signal-inspector-capture').addEventListener('change',event=>{signalDiagnostics.setEnabled(event.target.checked);syncSignalInspector(true);});
document.getElementById('signal-inspector-clear').addEventListener('click',()=>{signalDiagnostics.clear();syncSignalInspector(true);});
function signalChoiceHTML(value,attributes='data-signal-id'){
  return `<select ${attributes} aria-label="Signal"><option value="">Choose Signal · Project tab</option>${signalDefinitions.slice(0,128).filter(d=>OpusSignals.find(signalDefinitions,d?.id)).map(d=>`<option value="${escapeHtml(d.id)}"${value===d.id?' selected':''}>${escapeHtml(d.name)}</option>`).join('')}${value&&!OpusSignals.find(signalDefinitions,value)?`<option value="${escapeHtml(value)}" selected>Missing or ambiguous Signal · choose replacement</option>`:''}</select>`;
}
function renderSignalManager(){
  const list=document.getElementById('signal-definition-list');if(!list)return;
  list.innerHTML=signalDefinitions.slice(0,128).map((d,i)=>OpusSignals.find(signalDefinitions,d?.id)?`<div class="signal-definition-row"><input data-signal-name="${i}" aria-label="Signal name" maxlength="80" value="${escapeHtml(d.name)}"${playMode?' disabled':''}><select data-signal-type="${i}" aria-label="Signal value type"${playMode?' disabled':''}>${OpusSignals.PAYLOAD_TYPES.map(type=>`<option value="${type}"${OpusSignals.payloadType(d)===type?' selected':''}>${type==='none'?'No value':type}</option>`).join('')}</select><button type="button" class="toolbar-btn" data-signal-remove="${i}"${playMode?' disabled':''}>Remove</button></div>`:'<p>Unavailable Signal record retained. Correct its source or restore with Undo; references do not execute.</p>').join('');
  document.getElementById('signal-add-btn').disabled=playMode;
  list.querySelectorAll('.signal-definition-row').forEach(row=>{
    const index=Number(row.querySelector('[data-signal-name]').dataset.signalName),definition=signalDefinitions[index],scope=OpusSignals.channelScope(definition),select=document.createElement('select');select.dataset.signalScope=index;select.setAttribute('aria-label','Signal channel');select.disabled=playMode;
    for(const value of OpusSignals.CHANNEL_SCOPES){const option=document.createElement('option');option.value=value;option.textContent=({project:'Project channel',level:'Level channel',prefab:'Prefab instance channel'})[value];option.selected=value===scope;select.appendChild(option);}row.insertBefore(select,row.querySelector('button'));
    select.onchange=()=>{if(playMode)return;pushUndo();definition.scope=select.value;if(select.value==='level'&&definition.levelId===undefined)definition.levelId=levels[currentLevelIndex]?.id;renderSignalManager();showStatus('Channel changed; references retained. Check sender context or Undo.');};
    if(scope==='level'){const picker=document.createElement('select');picker.dataset.signalLevel=index;picker.setAttribute('aria-label','Signal level');picker.disabled=playMode;picker.innerHTML=`<option value="">Choose level</option>${levels.map(level=>`<option value="${escapeHtml(level.id)}"${level.id===definition.levelId?' selected':''}>${escapeHtml(level.name)}</option>`).join('')}`;row.insertBefore(picker,row.querySelector('button'));picker.onchange=()=>{if(playMode)return;pushUndo();definition.levelId=picker.value;renderSignalManager();};}
    if(scope==='prefab'){const help=document.createElement('small');help.textContent='Only within the sender’s placed Prefab instance. Other instances and unplaced sources do not receive.';row.insertBefore(help,row.querySelector('button'));}
  });
  list.querySelectorAll('[data-signal-name]').forEach(input=>input.onchange=()=>{const name=input.value.trim(),i=Number(input.dataset.signalName);if(!name||name.length>80||signalDefinitions.some((d,j)=>j!==i&&typeof d?.name==='string'&&d.name.toLowerCase()===name.toLowerCase())){showStatus('Choose a unique Signal name, at most 80 characters.');renderSignalManager();return;}pushUndo();signalDefinitions[i].name=name;renderSignalManager();showStatus('Signal renamed; stable references preserved.');});
  list.querySelectorAll('[data-signal-remove]').forEach(button=>button.onclick=()=>{pushUndo();signalDefinitions.splice(Number(button.dataset.signalRemove),1);renderSignalManager();showStatus('Signal removed; authored references retained as missing. Undo restores it.');});
  list.querySelectorAll('[data-signal-type]').forEach(input=>input.onchange=()=>{if(playMode)return;pushUndo();signalDefinitions[Number(input.dataset.signalType)].payloadType=input.value;renderSignalManager();showStatus('Signal type changed. Existing values are retained; check Send and Read connections. Undo restores the declaration.');});
  syncSignalInspector(true);
  renderSequenceStepList();renderObjectiveDefPanel();
}
document.getElementById('signal-add-btn').addEventListener('click',()=>{if(playMode)return;const input=document.getElementById('signal-name-input'),name=input.value.trim();if(!name||name.length>80||signalDefinitions.length>=128||signalDefinitions.some(d=>typeof d?.name==='string'&&d.name.toLowerCase()===name.toLowerCase())){showStatus('Choose a unique Signal name, at most128 definitions.');return;}let n=1;while(signalDefinitions.some(d=>d?.id==='signal'+n))n++;pushUndo();signalDefinitions.push({id:'signal'+n,name,payloadType:'none'});input.value='';renderSignalManager();showStatus('Signal added. Choose it in Send Signal and On Signal.');});
const signalRuntime=OpusSignals.create({definitions:()=>signalDefinitions,isActive:()=>playMode&&!gameEnded&&!app.paused,
  onObserve:typeof observeSignalEvent==='function'?observeSignalEvent:undefined,
  context:owner=>({levelId:levels[currentLevelIndex]?.id,prefabInstanceId:owner?.signalPrefabInstanceId||(owner?.sourcePrefabName?owner.id:undefined)}),
  receiverContext:r=>({levelId:levels[currentLevelIndex]?.id,prefabInstanceId:r.owner.signalPrefabInstanceId||(r.owner.sourcePrefabName?r.owner.id:undefined)}),
  receivers:id=>{const result=[];let scanned=0;for(const owner of placed){if(!Array.isArray(owner.behaviors))continue;for(const behavior of owner.behaviors){if(++scanned>4096){showToast('Signal receiver scan limit reached; remaining Behaviors not visited.');return result;}if(behavior?.trigger==='signal'&&behavior.eventRef?.signalId===id)result.push({owner,behavior});}}return result;},
  isAlive:(r,id)=>placed.includes(r.owner)&&r.owner.behaviors?.includes(r.behavior)&&r.behavior.trigger==='signal'&&r.behavior.eventRef?.signalId===id,
  deliver:(r,id,event)=>runAction(r.behavior,r.owner,event),onOverflow:message=>showToast(message),onError:error=>showToast('Signal receiver error: '+error.message)
});
function readBehaviorEventSource(trigger,host){return trigger==='controllerStateEvent'?readControllerStateEventSource(host):trigger==='signal'?{signalId:host?.querySelector('[data-signal-id]')?.value||''}:trigger==='spriteAnimationEvent'?readSpriteAnimationEventSource(host):undefined;}
let graphEditorState = null; // { item, existingBehavior, trigger, graph, dragNode, pendingConnection }
let graphNodeIdCounter = 1;
let graphBrowseAll = false;

// AUDIT.md finding #3: graphNodeIdCounter is monotonic within one page
// session (safe there -- always increasing, so a new node never collides
// with an earlier one in ANY graph created that session), but resets to 1
// on every fresh load while a saved project's graphs keep whatever ids
// they were created with. Opening a previously-saved graph after a reload
// and adding a node could silently reuse an id already in that graph
// (e.g. 'n1'), leaving two DOM nodes sharing data-node-id and corrupting
// every id-keyed lookup (ports, drag, delete). Reconciling the counter
// against whatever the graph being opened already contains, every time,
// fixes this regardless of how it got out of sync.
function reconcileGraphNodeIdCounter(graph) {
  for (const node of graph.nodes) {
    const match = /^n(\d+)$/.exec(node.id);
    if (match) graphNodeIdCounter = Math.max(graphNodeIdCounter, Number(match[1]) + 1);
  }
}

function openGraphEditor(item, existingBehavior, newTrigger, newEventRef) {
  const authored = existingBehavior && existingBehavior.graph ? existingBehavior.graph : { nodes: [], edges: [] };
  const schema = OpusGraphSchema.inspect(authored);
  if(!schema.supported){showStatus(schema.message);return;}
  const graph = OpusGraphSchema.migrate(authored);
  reconcileGraphNodeIdCounter(graph);
  graphEditorState = { item, existingBehavior, trigger: existingBehavior ? existingBehavior.trigger : newTrigger, eventRef: existingBehavior ? existingBehavior.eventRef : newEventRef, graph, dragNode: null, pendingConnection: null, view: { x: 40, y: 40, scale: 1 }, panning: null };
  document.getElementById('graph-modal').classList.add('visible');
  const searchEl = document.getElementById('graph-node-search');
  graphBrowseAll = false;
  document.getElementById('graph-browse-nodes').setAttribute('aria-expanded', 'false');
  searchEl.value = '';
  searchEl.dispatchEvent(new Event('input')); // reset discovery without letting the entire palette consume the canvas
  renderGraphNodes();
  applyGraphViewTransform();
}

function closeGraphEditor() {
  if (graphEditorState?.returnToEditor) {
    graphEditorState=graphEditorState.returnToEditor;renderGraphNodes();applyGraphViewTransform();return;
  }
  document.getElementById('graph-modal').classList.remove('visible');
  graphEditorState = null;
}

function graphNodePortId(nodeId, port) {
  return `${nodeId}::${port}`;
}

function renderGraphNodeHTML(node) {
  if (node.id === 'start') {
    if(graphEditorState.functionDefinition)return `<div class="graph-node graph-node-start" style="left:${node.x}px;top:${node.y}px;width:240px;text-align:left"><div class="graph-node-header">Function · ${escapeHtml(graphEditorState.functionDefinition.name)}</div><p>Called on Self. Independent Local values; returns after its connected flow.</p><div class="graph-port graph-port-next-out" data-port-id="${graphNodePortId('start','next-out')}" data-node="start" data-port="next-out" title="Function flow out"></div></div>`;
    const trigger = graphEditorState.trigger || 'start';
    const event = OpusAuthoringLanguage.EVENTS.find(e => e.id === trigger);
    const choices = [...OpusAuthoringLanguage.EVENTS];
    if (!event) choices.push({id:trigger,label:trigger}); // preserve unknown historical IDs
    return `<div class="graph-node graph-node-start" style="left:${node.x}px;top:${node.y}px;width:240px;text-align:left">
      <div class="graph-node-header"><span class="graph-node-title">Event · ${escapeHtml(event?.label || trigger)}</span></div>
      <label style="display:block;font-size:11px;color:#a7c9bd">Owning Behavior Event</label>
      <select id="graph-entry-event" aria-label="Graph entry Event" style="width:100%;margin:4px 0">${choices.map(e=>`<option value="${escapeHtml(e.id)}"${e.id===trigger?' selected':''}>${escapeHtml(e.label)}</option>`).join('')}</select>
      <p style="font-size:11px;font-weight:400;margin:4px 0">${escapeHtml(event?.help || 'Historical Event preserved; no automatic migration.')}</p>
      <div class="graph-port graph-port-next-out" data-port-id="${graphNodePortId('start', 'next-out')}" data-node="start" data-port="next-out" title="Event flow out"></div>
    </div>`;
  }
  const known = GRAPH_NODE_TYPES[node.type];
  const meta = known || {label:`Unavailable · ${node.type}`,kind:'action',fields:[]};
  const definition = ACTION_TYPES[node.type] || CONDITION_TYPES[node.type];
  const fieldsHTML = meta.fields.map((f, index) => {
    const fieldId = `graph-field-${encodeURIComponent(node.id)}-${index}`;
    const graph = graphEditorState?.graph;
    const variable = OpusGraphVariables.definition(graph,node.variableId);
    const effectiveField = f.type==='graphVariableValue' ? {...f,type:({number:'number',text:'text',boolean:'checkbox',object:'target',color:'color'})[variable?.type]||'text'} : f;
    const input = f.type==='graphFunction' ? `<select id="${fieldId}" data-field="${f.key}" aria-label="Function"><option value="">Choose Function</option>${graphFunctions.slice(0,128).filter(d=>OpusGraphFunctions.find(graphFunctions,d?.id)).map(d=>`<option value="${escapeHtml(d.id)}"${node[f.key]===d.id?' selected':''}>${escapeHtml(d.name)}</option>`).join('')}${node[f.key]&&!OpusGraphFunctions.find(graphFunctions,node[f.key])?`<option value="${escapeHtml(node[f.key])}" selected>Missing Function · choose replacement</option>`:''}</select>` : f.type==='graphVariable' ? `<select id="${fieldId}" data-field="${f.key}" aria-label="Variable"><option value="">Choose Variable</option>${(graph?.variables||[]).map(v=>`<option value="${escapeHtml(v.id)}"${node[f.key]===v.id?' selected':''}>${escapeHtml(v.name+' · '+v.scope+' · '+v.type)}</option>`).join('')}${node[f.key]&&!variable?`<option value="${escapeHtml(node[f.key])}" selected>Missing Variable · choose a replacement</option>`:''}</select>` : renderActionFieldInput(effectiveField, node[f.key], fieldId, node, graphEditorState && graphEditorState.item);
    const valueType = meta.kind !== 'value' && OpusGraphValues.fieldType(f,node,graph);
    const bound = valueType && graphEditorState?.graph?.edges?.some(e => e.kind === 'value' && e.to === node.id && e.toField === f.key);
    const pin = valueType ? `<button type="button" class="graph-port graph-port-value-in" data-port-id="${graphNodePortId(node.id,'value-in:'+f.key)}" data-node="${node.id}" data-port="value-in:${f.key}" title="${escapeHtml((f.label||f.key)+' · '+valueType+' input')}" aria-label="${escapeHtml((f.label||f.key)+' '+valueType+' input')}"></button>` : '';
    return `<div class="graph-action-field" style="position:relative"><label for="${fieldId}">${escapeHtml(f.label || f.placeholder || f.key)}${valueType ? ' · '+valueType : ''}</label>${pin}${input}${bound ? '<small class="graph-value-bound">Connected Value overrides this saved inline fallback.</small>' : ''}</div>`;
  }).join('');
  const guidance = !known
    ? '<p class="graph-action-help">Unavailable node preserved. Its parameters and connections are retained; no Action implementation is available.</p><details><summary>Preserved parameters</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">' + escapeHtml(JSON.stringify(node, null, 2)) + '</pre></details>'
    : `<p class="graph-action-help">${escapeHtml(definition?.category || (meta.kind==='value'?'Value':'Flow'))} · ${escapeHtml(definition?.help || meta.help || 'Wait before continuing the connected flow.')}</p>`;
  let ports;
  if (meta.kind === 'value') {
    ports = '';
  } else if (meta.kind === 'action') {
    ports = `
      <div class="graph-port graph-port-next-in" data-port-id="${graphNodePortId(node.id, 'next-in')}" data-node="${node.id}" data-port="next-in" title="Flow in"></div>
      <div class="graph-port graph-port-next-out" data-port-id="${graphNodePortId(node.id, 'next-out')}" data-node="${node.id}" data-port="next-out" title="Flow out"></div>
      <div class="graph-port graph-port-gate graph-port-gate-in" data-port-id="${graphNodePortId(node.id, 'gate-in')}" data-node="${node.id}" data-port="gate-in" title="Gate: only run when this condition is true"></div>
    `;
  } else if (node.type === 'and' || node.type === 'or' || node.type === 'not') {
    // Combinators: read one (NOT) or more (AND/OR) other condition nodes via
    // 'cond' edges, so they need an operand-in port too, unlike every leaf
    // condition below (which reads external game state directly, not
    // another node).
    ports = `
      <div class="graph-port graph-port-cond graph-port-cond-in" data-port-id="${graphNodePortId(node.id, 'cond-in')}" data-node="${node.id}" data-port="cond-in" title="Operand in"></div>
      <div class="graph-port graph-port-cond graph-port-cond-out" data-port-id="${graphNodePortId(node.id, 'cond-out')}" data-node="${node.id}" data-port="cond-out" title="Condition out"></div>
    `;
  } else {
    ports = `<div class="graph-port graph-port-cond graph-port-cond-out" data-port-id="${graphNodePortId(node.id, 'cond-out')}" data-node="${node.id}" data-port="cond-out" title="Condition out"></div>`;
  }
  if (meta.kind === 'condition' || meta.kind === 'value') ports += `<button type="button" class="graph-port graph-port-value-out" data-port-id="${graphNodePortId(node.id,'value-out')}" data-node="${node.id}" data-port="value-out" title="${escapeHtml((OpusGraphValues.outputType(node,GRAPH_NODE_TYPES,graphEditorState?.graph)||'Choose Variable for typed')+' output')}" aria-label="Value output"></button>`;
  return `<div class="graph-node${meta.kind === 'condition' ? ' graph-node-condition' : meta.kind === 'value' ? ' graph-node-value' : ' graph-node-action'}" data-node-id="${node.id}" style="left:${node.x}px;top:${node.y}px">
    <div class="graph-node-header" data-drag-handle="${node.id}">
      <span class="graph-node-title">${escapeHtml(meta.label)}</span>
      <button class="graph-node-duplicate" data-duplicate-node="${node.id}" title="Duplicate">⧉</button>
      <button class="graph-node-delete" data-delete-node="${node.id}">✕</button>
    </div>
    ${guidance}${fieldsHTML}
    ${ports}
  </div>`;
}

// --- Node Graph pan/zoom ---
// Nodes/edges are authored in a fixed, UNSCALED "graph space" (node.x/y, the
// same values saved to disk) -- pan/zoom is purely a CSS transform applied
// to the two rendering layers (#graph-canvas-nodes and #graph-canvas-svg)
// together, never a change to graph-space coordinates themselves. That's
// what keeps node dragging, edge drawing, and the saved graph data all
// working unmodified in graph-space; the only places that need to know
// about the CURRENT view are the few spots converting a raw mouse/screen
// position into graph space (node drag start/move) or vice versa (the grid
// background, which is cosmetic only).
const GRAPH_ZOOM_MIN = 0.35;
const GRAPH_ZOOM_MAX = 2.5;
function applyGraphViewTransform() {
  if (!graphEditorState) return;
  const { x, y, scale } = graphEditorState.view;
  const transform = `translate(${x}px, ${y}px) scale(${scale})`;
  document.getElementById('graph-canvas-nodes').style.transform = transform;
  document.getElementById('graph-canvas-svg').style.transform = transform;
  // The dotted grid is drawn on the WRAP (never transformed itself, so it
  // stays crisp at any zoom instead of blurring as an actual scaled image
  // would) -- moving/resizing its background-position/background-size in
  // lockstep with the same x/y/scale is what makes it read as "the graph
  // canvas has a grid" rather than "there's a grid painted on the window".
  const wrap = document.getElementById('graph-canvas-wrap');
  const baseSize = 22;
  wrap.style.backgroundSize = `${baseSize * scale}px ${baseSize * scale}px`;
  wrap.style.backgroundPosition = `${x}px ${y}px`;
  const zoomLabel = document.getElementById('graph-zoom-label');
  if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  renderGraphEdges();
}
// Screen (clientX/Y) -> graph-space, given the wrap's own rect (unaffected
// by the transform, since the transform lives on its CHILDREN) and the
// current view -- the one conversion node dragging and future
// screen-space-to-graph-space needs all share.
function graphScreenToSpace(clientX, clientY) {
  const wrapRect = document.getElementById('graph-canvas-wrap').getBoundingClientRect();
  const { x, y, scale } = graphEditorState.view;
  return {
    x: (clientX - wrapRect.left - x) / scale,
    y: (clientY - wrapRect.top - y) / scale,
  };
}
function resetGraphView() {
  if (!graphEditorState) return;
  graphEditorState.view = { x: 40, y: 40, scale: 1 };
  applyGraphViewTransform();
}
// Fits every node (plus the fixed Start node) into the visible wrap area,
// with padding -- the common "I've dragged nodes all over and lost track
// of the layout" recovery action.
function fitGraphViewToContent() {
  if (!graphEditorState) return;
  // Read rendered graph-space dimensions: Event and parameter-rich nodes are
  // larger than the old fixed estimate. CSS view scaling does not affect offsets.
  const nodes = Array.from(document.querySelectorAll('#graph-canvas-nodes .graph-node'), el => ({x:el.offsetLeft,y:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight}));
  if (nodes.length === 0) { resetGraphView(); return; }
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  const wrapRect = document.getElementById('graph-canvas-wrap').getBoundingClientRect();
  const PAD = 60;
  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const scale = Math.min(GRAPH_ZOOM_MAX, Math.max(GRAPH_ZOOM_MIN, Math.min((wrapRect.width - PAD * 2) / contentW, (wrapRect.height - PAD * 2) / contentH)));
  graphEditorState.view = {
    scale,
    x: (wrapRect.width - contentW * scale) / 2 - minX * scale,
    y: (wrapRect.height - contentH * scale) / 2 - minY * scale,
  };
  applyGraphViewTransform();
}
document.getElementById('graph-canvas-wrap').addEventListener('wheel', (e) => {
  if (!graphEditorState) return;
  e.preventDefault();
  const { view } = graphEditorState;
  const before = graphScreenToSpace(e.clientX, e.clientY);
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  view.scale = Math.min(GRAPH_ZOOM_MAX, Math.max(GRAPH_ZOOM_MIN, view.scale * factor));
  // Re-derive x/y so the graph-space point under the cursor BEFORE zooming
  // is still under the cursor after -- a zoom that isn't cursor-anchored
  // feels like the canvas sliding out from under you.
  const wrapRect = document.getElementById('graph-canvas-wrap').getBoundingClientRect();
  view.x = e.clientX - wrapRect.left - before.x * view.scale;
  view.y = e.clientY - wrapRect.top - before.y * view.scale;
  applyGraphViewTransform();
}, { passive: false });
// Panning: pointerdown directly on the wrap/nodes-container background
// (never on a node or port, which have their own pointerdown handlers that
// already run first via event target specificity) starts a view drag.
document.getElementById('graph-canvas-wrap').addEventListener('pointerdown', (e) => {
  if (!graphEditorState) return;
  if (e.target.id !== 'graph-canvas-wrap' && e.target.id !== 'graph-canvas-nodes') return;
  graphEditorState.panning = { startClientX: e.clientX, startClientY: e.clientY, startViewX: graphEditorState.view.x, startViewY: graphEditorState.view.y };
});
document.getElementById('graph-reset-view-btn').addEventListener('click', resetGraphView);
document.getElementById('graph-fit-btn').addEventListener('click', fitGraphViewToContent);

function renderGraphEdges() {
  const svg = document.getElementById('graph-canvas-svg');
  const wrapRect = document.getElementById('graph-canvas-nodes').getBoundingClientRect();
  const scale = graphEditorState.view.scale;
  svg.innerHTML = graphEditorState.graph.edges.map((edge, i) => {
    const fromPort = edge.kind === 'value' ? 'value-out' : edge.kind === 'next' ? 'next-out' : 'cond-out';
    const toPort = edge.kind === 'value' ? 'value-in:'+edge.toField : edge.kind === 'next' ? 'next-in' : edge.kind === 'gate' ? 'gate-in' : 'cond-in';
    const fromEl = document.querySelector(`[data-port-id="${graphNodePortId(edge.from, fromPort)}"]`);
    const toEl = document.querySelector(`[data-port-id="${graphNodePortId(edge.to, toPort)}"]`);
    if (!fromEl || !toEl) return '';
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    // getBoundingClientRect() reflects the ALREADY-TRANSFORMED (panned/
    // zoomed) rendered position -- but the <svg> itself carries that same
    // CSS transform too (see applyGraphViewTransform), so its internal
    // coordinate system is implicitly re-scaled already. Dividing back by
    // `scale` here converts the screen-space delta into the SVG's own
    // pre-transform coordinate space, which is what x1/y1/x2/y2 need to be
    // in -- without this, lines would drift away from their ports at any
    // zoom level other than 100%.
    const x1 = (fromRect.left + fromRect.width / 2 - wrapRect.left) / scale;
    const y1 = (fromRect.top + fromRect.height / 2 - wrapRect.top) / scale;
    const x2 = (toRect.left + toRect.width / 2 - wrapRect.left) / scale;
    const y2 = (toRect.top + toRect.height / 2 - wrapRect.top) / scale;
    // A wide, invisible line on top of the thin visible one -- a 2px stroke
    // is hard to click precisely, and SVG hit-testing follows the actual
    // stroke geometry, not just "near enough to the visible line".
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${edge.kind === 'value' ? '#7eafff' : edge.kind === 'next' ? '#6fd6bd' : '#e08a63'}" stroke-width="2" />`
      + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="12" data-edge-index="${i}" class="graph-edge-hit" style="cursor:pointer"><title>Click to delete this connection</title></line>`;
  }).join('');
}
document.getElementById('graph-canvas-svg').addEventListener('click', (e) => {
  const index = e.target.dataset && e.target.dataset.edgeIndex;
  if (index === undefined || !graphEditorState) return;
  e.stopPropagation();
  graphEditorState.graph.edges.splice(Number(index), 1);
  renderGraphNodes();
});

function highlightGraphPort(nodeId, port, on) {
  const el = document.querySelector(`[data-port-id="${graphNodePortId(nodeId, port)}"]`);
  if (el) el.classList.toggle('graph-port-armed', on);
}

function handleGraphPortClick(nodeId, port) {
  const pending = graphEditorState.pendingConnection;
  if (!pending) {
    graphEditorState.pendingConnection = { node: nodeId, port };
    highlightGraphPort(nodeId, port, true);
    return;
  }
  highlightGraphPort(pending.node, pending.port, false);
  graphEditorState.pendingConnection = null;
  if (pending.node === nodeId && pending.port === port) return; // clicked the same port again: cancel

  if (pending.port === 'value-out' || port === 'value-out') {
    const from = pending.port === 'value-out' ? pending : {node:nodeId,port};
    const to = pending.port === 'value-out' ? {node:nodeId,port} : pending;
    if (!to.port.startsWith('value-in:')) { showStatus('Connect a Value output to a typed parameter input.'); return; }
    const toField = to.port.slice('value-in:'.length);
    const check = OpusGraphValues.connection(graphEditorState.graph,from.node,to.node,toField,GRAPH_NODE_TYPES);
    if (!check.valid) { showStatus(check.message); return; }
    graphEditorState.graph.edges = graphEditorState.graph.edges.filter(e => !(e.kind === 'value' && e.to === to.node && e.toField === toField));
    graphEditorState.graph.edges.push({kind:'value',from:from.node,to:to.node,toField});
    renderGraphNodes(); return;
  }

  const rule = GRAPH_EDGE_RULES.find((r) => r.from === pending.port && r.to === port)
    || GRAPH_EDGE_RULES.find((r) => r.from === port && r.to === pending.port);
  if (!rule) { showStatus("Those ports can't connect"); return; }
  const fromNode = rule.from === pending.port ? pending.node : nodeId;
  const toNode = rule.from === pending.port ? nodeId : pending.node;

  // next-in/next-out/gate-in each accept at most one edge; replace any
  // existing one at either end. cond-in deliberately allows several (AND/OR
  // take 2+ operands).
  if (rule.kind === 'next') {
    graphEditorState.graph.edges = graphEditorState.graph.edges.filter((e) => !(e.kind === 'next' && (e.from === fromNode || e.to === toNode)));
  } else if (rule.kind === 'gate') {
    graphEditorState.graph.edges = graphEditorState.graph.edges.filter((e) => !(e.kind === 'gate' && e.to === toNode));
  } else if (graphEditorState.graph.edges.some((e) => e.kind === 'cond' && e.from === fromNode && e.to === toNode)) {
    return; // duplicate cond edge between the same pair
  }
  graphEditorState.graph.edges.push({ from: fromNode, to: toNode, kind: rule.kind });
  renderGraphNodes();
}

function wireGraphNodeEvents() {
  const container = document.getElementById('graph-canvas-nodes');
  const entry = container.querySelector('#graph-entry-event');
  if (entry) entry.onchange = () => {
    graphEditorState.trigger = entry.value;
    graphEditorState.eventRef = entry.value==='controllerStateEvent'?{source:'levelPlayer',state:'moving'}:undefined;
    renderGraphNodes();
  };
  const eventSource = document.getElementById('graph-entry-event-source');
  if (eventSource) eventSource.querySelectorAll('select').forEach(input => {
    input.onchange = () => {
      graphEditorState.eventRef = readBehaviorEventSource(graphEditorState.trigger,eventSource);
      renderGraphNodes();
    };
  });
  container.querySelectorAll('[data-field]').forEach((input) => {
    const handler = (e) => {
      const nodeEl = e.target.closest('[data-node-id]');
      const node = graphEditorState.graph.nodes.find((n) => n.id === nodeEl.dataset.nodeId);
      const fieldMeta = GRAPH_NODE_TYPES[node.type].fields.find((f) => f.key === e.target.dataset.field);
      if(node.type==='cameraShake'){
        const value=readActionFieldValue(fieldMeta,e.target);
        if(!resolveCameraShakePolicy({...node,[fieldMeta.key]:value})){showStatus('Camera effect values must be finite and nonnegative.');return;}
        if(Object.is(node[fieldMeta.key],value))return;
        node[fieldMeta.key]=value;
        if(fieldMeta.key==='preset')renderGraphNodes();else renderGraphValidation();
        return;
      }
      const type = fieldMeta.type==='signalPayload'?signalPayloadFieldType(node.signalId):fieldMeta.type==='graphVariableValue' ? ({number:'number',boolean:'checkbox'})[OpusGraphVariables.definition(graphEditorState.graph,node.variableId)?.type] || 'text' : fieldMeta.type;
      if(['signalPayload','comparisonValue'].includes(fieldMeta.type))node[fieldMeta.key]=readActionFieldValue(fieldMeta,e.target);
      else if (type === 'checkbox') node[fieldMeta.key] = e.target.checked;
      else node[fieldMeta.key] = type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value;
      if(fieldMeta.type==='signalRef'&&node.type==='sendSignal'&&node.payload===undefined)node.payload=signalPayloadDefault(node.signalId);
      if (fieldMeta.type==='graphVariable' || fieldMeta.type==='signalRef' || (node.type==='compareValues'&&fieldMeta.key==='valueType') || (fieldMeta.key === 'targetId' && GRAPH_NODE_TYPES[node.type].fields.some((field) => field.type === 'spriteAnimationState'))) renderGraphNodes();
      else renderGraphValidation();
    };
    input.addEventListener(input.tagName === 'SELECT' || input.type === 'checkbox' ? 'change' : 'input', handler);
  });
  container.querySelectorAll('[data-delete-node]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.deleteNode;
      graphEditorState.graph.nodes = graphEditorState.graph.nodes.filter((n) => n.id !== id);
      graphEditorState.graph.edges = graphEditorState.graph.edges.filter((e) => e.from !== id && e.to !== id);
      renderGraphNodes();
    };
  });
  container.querySelectorAll('[data-duplicate-node]').forEach((btn) => {
    btn.onclick = () => {
      const src = graphEditorState.graph.nodes.find((n) => n.id === btn.dataset.duplicateNode);
      if (!src) return;
      // Fields only, not connections -- a duplicated node is a fresh,
      // disconnected copy of the same TYPE with the same field values (the
      // common case: "one more Damage Player at 5 instead of 10"), not a
      // rewiring of the graph, which would be surprising to find already
      // half-connected to the source's own edges.
      const clone = { ...src, id: `n${graphNodeIdCounter++}`, x: src.x + 24, y: src.y + 24 };
      graphEditorState.graph.nodes.push(clone);
      renderGraphNodes();
    };
  });
  container.querySelectorAll('[data-drag-handle]').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      const id = handle.dataset.dragHandle;
      const node = graphEditorState.graph.nodes.find((n) => n.id === id);
      if (!node) return; // the fixed Start node has no backing node object
      const grabPoint = graphScreenToSpace(e.clientX, e.clientY);
      graphEditorState.dragNode = { id, offsetX: grabPoint.x - node.x, offsetY: grabPoint.y - node.y };
      e.preventDefault();
    });
  });
  container.querySelectorAll('[data-port]').forEach((portEl) => {
    portEl.addEventListener('click', (e) => {
      e.stopPropagation();
      handleGraphPortClick(portEl.dataset.node, portEl.dataset.port);
    });
  });
}

function renderGraphVariables() {
  const panel = document.getElementById('graph-variables');
  if (!panel || !graphEditorState) return;
  const graph = graphEditorState.graph, variables = graph.variables || [];
  const options = (choices,value) => choices.map(v=>`<option value="${v}"${v===value?' selected':''}>${v}</option>`).join('');
  panel.innerHTML = `<summary>Variables · ${variables.length} · Local / Object / Game</summary><p>Local: one invocation, including its Delays. Object: shared by this Object's graphs. Game: shared session state. Starting values apply when no stored value exists. Fresh Play resets session state.</p>${variables.map(v=>{
    const id = encodeURIComponent(v.id),f={key:'initial',type:({number:'number',text:'text',boolean:'checkbox',object:'target',color:'color'})[v.type]||'text'};
    return `<div data-variable-row="${escapeHtml(v.id)}" style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin:6px 0"><label>Name<input data-variable-name="${escapeHtml(v.id)}" value="${escapeHtml(v.name)}"></label><label>Scope<select data-variable-scope="${escapeHtml(v.id)}">${options(OpusGraphVariables.SCOPES,v.scope)}</select></label><label>Type<select data-variable-type="${escapeHtml(v.id)}">${options(OpusGraphVariables.TYPES,v.type)}</select></label><label>Starting value${renderActionFieldInput(f,v.initial,'graph-variable-default-'+id,{},graphEditorState.item)}</label><button type="button" data-variable-remove="${escapeHtml(v.id)}">Remove</button></div>`;
  }).join('')}<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap"><label>New variable name<input id="graph-variable-name" placeholder="amount"></label><label>Scope<select id="graph-variable-scope">${options(OpusGraphVariables.SCOPES,'local')}</select></label><label>Type<select id="graph-variable-type">${options(OpusGraphVariables.TYPES,'number')}</select></label><button type="button" id="graph-variable-add">Add Variable</button></div>`;
  panel.querySelector('#graph-variable-add').onclick=()=>{
    const name=panel.querySelector('#graph-variable-name').value.trim(),scope=panel.querySelector('#graph-variable-scope').value,type=panel.querySelector('#graph-variable-type').value;
    if(variables.length>=64){showStatus('Use at most64 variables in one graph.');return;}
    const variable={id:'gv1',name,scope,type,initial:OpusGraphVariables.DEFAULTS[type]};let n=1;while(variables.some(v=>v.id===variable.id))variable.id='gv'+(++n);
    if(!OpusGraphVariables.usable(variable)||variables.some(v=>v.name===name&&v.scope===scope)){showStatus('Choose a unique, non-reserved name in this scope.');return;}
    if(!graph.variables)graph.variables=[];graph.variables.push(variable);renderGraphNodes();
  };
  panel.querySelectorAll('[data-variable-row]').forEach(row=>{
    const variable=variables.find(v=>v.id===row.dataset.variableRow);
    const name=row.querySelector('[data-variable-name]');name.oninput=()=>{variable.name=name.value;renderGraphValidation();};name.onchange=renderGraphNodes;
    row.querySelector('[data-variable-scope]').onchange=e=>{variable.scope=e.target.value;renderGraphNodes();};
    row.querySelector('[data-variable-type]').onchange=e=>{variable.type=e.target.value;variable.initial=OpusGraphVariables.DEFAULTS[variable.type];renderGraphNodes();};
    const input=row.querySelector('[data-field="initial"]');const changed=()=>{variable.initial=variable.type==='boolean'?input.checked:variable.type==='number'?(parseFloat(input.value)||0):input.value;renderGraphValidation();};input.addEventListener(input.tagName==='SELECT'||input.type==='checkbox'?'change':'input',changed);
    row.querySelector('[data-variable-remove]').onclick=()=>{graph.variables=graph.variables.filter(v=>v!==variable);renderGraphNodes();showStatus('Variable removed from this draft. References are preserved and diagnosed; choose a replacement or Cancel to recover.');};
  });
}
function graphItemPatternContext(state,recipe) {
  if(playMode||graphEditorState!==state||!state.item||!placed.includes(state.item))return null;
  const input=state.itemPatternChoices?.[recipe.id],raw=input?.quantity;
  const quantity=typeof raw==='number'||typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;
  if(!input||!input.itemId||['__proto__','constructor','prototype'].includes(input.itemId)||currentItemDefs.filter(d=>d?.id===input.itemId).length!==1||!Number.isSafeInteger(quantity)||quantity<1||String(input.quantity).trim()==='')return null;
  if(recipe.patternTarget==='objective'){
    if(!input.objectiveId||currentObjectiveDefs.filter(d=>d?.id===input.objectiveId).length!==1)return null;
    return {itemId:input.itemId,quantity,objectiveId:input.objectiveId};
  }
  const target=input.targetId==='__self__'?state.item:placed.find(d=>d.id===input.targetId);
  if(!target||!validDoorGate(target)||placed.filter(d=>d.id===target.id).length!==1)return null;
  return {itemId:input.itemId,quantity,targetId:input.targetId==='__self__'?'':target.id};
}
function graphQuestFlowContext(state, startOnly = false) {
  if(playMode||graphEditorState!==state||!state.item||!placed.includes(state.item))return null;
  const input=state.questFlowChoices;
  if(!input||!Array.isArray(currentObjectiveDefs)||!Array.isArray(currentItemDefs))return null;
  const captured=state.questFlowContext;
  if(!captured||captured.levelIndex!==currentLevelIndex||captured.level!==levels[currentLevelIndex]||captured.definitions!==currentObjectiveDefs||captured.items!==currentItemDefs)return null;
  const validId=v=>typeof v==='string'&&!!v&&!['__proto__','constructor','prototype'].includes(v);
  if(startOnly){const rows=currentObjectiveDefs.filter(d=>d?.id===input.sourceId);return validId(input.sourceId)&&rows.length===1&&!Array.isArray(rows[0])&&(rows[0].version===undefined||rows[0].version===1)?{sourceId:input.sourceId}:null;}
  const ids=[input.sourceId,input.yesId,input.noId];
  if(!ids.every(validId)||new Set(ids).size!==3)return null;
  const definitions=ids.map(id=>currentObjectiveDefs.filter(d=>d?.id===id));
  if(definitions.some(rows=>rows.length!==1||!rows[0]||Array.isArray(rows[0])||rows[0].version!==undefined&&rows[0].version!==1))return null;
  if(definitions[0][0].nextObjective)return null;
  const raw=input.quantity,quantity=typeof raw==='number'||typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;
  if(!validId(input.itemId)||currentItemDefs.filter(d=>d?.id===input.itemId).length!==1||!Number.isSafeInteger(quantity)||quantity<1)return null;
  return {sourceId:input.sourceId,yesId:input.yesId,noId:input.noId,itemId:input.itemId,quantity};
}
function renderGraphTemplates() {
  const panel=document.getElementById('graph-templates');if(!panel||!graphEditorState)return;
  const state=graphEditorState,selected=state.templateChoice||OpusGraphTemplates.recipes[0].id,recipe=OpusGraphTemplates.recipes.find(r=>r.id===selected)||OpusGraphTemplates.recipes[0];
  panel.innerHTML=`<summary>Templates · editable starters</summary><p>Keep the owning Event and Self. Apply changes only this draft; Save Graph creates an Undo step. Cancel Graph discards draft changes.</p><label>Template<select id="graph-template-choice">${OpusGraphTemplates.recipes.map(r=>`<option value="${r.id}"${r.id===recipe.id?' selected':''}>${escapeHtml(r.name)}</option>`).join('')}</select></label><p id="graph-template-preview">${escapeHtml(recipe.purpose)}<br>Nodes: ${recipe.nodes.map(n=>escapeHtml(GRAPH_NODE_TYPES[n.type].label)).join(' → ')}</p>${OpusGraphTemplates.nonempty(state.graph)?'<label><input type="checkbox" id="graph-template-replace"> Replace all nodes, connections and Variables in this draft (including unknown data)</label>':''}<button type="button" id="graph-template-apply">Apply Template</button><button type="button" id="graph-template-revert"${state.beforeTemplate?'':' disabled'}>Revert last template application</button>`;
  panel.querySelector('#graph-template-choice').onchange=e=>{state.templateChoice=e.target.value;renderGraphTemplates();};
  if(recipe.requiresQuestFlow){
    if(!state.questFlowContext)state.questFlowContext={levelIndex:currentLevelIndex,level:levels[currentLevelIndex],definitions:currentObjectiveDefs,items:currentItemDefs};
    const input=state.questFlowChoices||(state.questFlowChoices={sourceId:'',yesId:'',noId:'',itemId:'',quantity:1});
    const valid=rows=>(Array.isArray(rows)?rows:[]).filter(d=>d&&typeof d.id==='string'&&d.id&&!['__proto__','constructor','prototype'].includes(d.id)&&(d.version===undefined||d.version===1)&&rows.filter(x=>x?.id===d.id).length===1);
    const objectives=valid(currentObjectiveDefs),items=valid(currentItemDefs);
    const name=(rows,id)=>{const d=rows.find(x=>x.id===id);return d?d.title||d.name||'Unnamed':'Choose an available reference';};
    const preview=panel.querySelector('#graph-template-preview');
    const startOnly=recipe.questFlowMode==='start';
    preview.textContent=startOnly?`Quest-lite start · Activate ${name(objectives,input.sourceId)} on the owning Event. Use On Start for initial activation. Existing chain links are unchanged.`:`Quest-lite flow · ${name(objectives,input.sourceId)} → with ${input.quantity} × ${name(items,input.itemId)}: ${name(objectives,input.yesId)}; otherwise: ${name(objectives,input.noId)}. Capture once before completion; Items retained. Owning Event stays unchanged.`;
    const select=(key,label,rows)=>`<label>${label}<select data-quest-flow="${key}"><option value="">Choose ${label}</option>${rows.map(d=>`<option value="${escapeHtml(d.id)}"${input[key]===d.id?' selected':''}>${escapeHtml(d.title||d.name||'Unnamed')}</option>`).join('')}${input[key]&&!rows.some(d=>d.id===input[key])?`<option selected disabled value="${escapeHtml(input[key])}">Unavailable saved choice — choose replacement</option>`:''}</select></label>`;
    panel.querySelector('#graph-template-apply').insertAdjacentHTML('beforebegin',select('sourceId',startOnly?'Start Objective':'Active source Objective',objectives)+(startOnly?'<p>Explicit activation on this Event. On Start runs once for fresh Play; other Events can deliberately reactivate. Apply edits only this draft, then inspect and Save Graph with Undo.</p>':select('itemId','Possessed Item',items)+`<label>Required quantity<input type="number" min="1" step="1" data-quest-flow="quantity" value="${escapeHtml(input.quantity)}"></label>`+select('yesId','If enough Items',objectives)+select('noId','Otherwise',objectives)+'<p>Quest-lite flow: the owning Event chooses once while the source is active. Complete source → activate one named route. No Item consumption. Source must have End of chain selected; existing Next links are never silently changed. Apply edits this draft only; Save Graph commits with Undo.</p>'));
    panel.querySelectorAll('[data-quest-flow]').forEach(field=>field.onchange=()=>{if(graphEditorState!==state||playMode)return;input[field.dataset.questFlow]=field.value;renderGraphTemplates();});
  }
  if(recipe.requiresItemPattern){
    if(!state.itemPatternChoices)state.itemPatternChoices={};
    const input=state.itemPatternChoices[recipe.id]||(state.itemPatternChoices[recipe.id]={itemId:'',quantity:1,targetId:'',objectiveId:''});
    const items=currentItemDefs.filter(d=>d&&typeof d.id==='string'&&d.id&&!['__proto__','constructor','prototype'].includes(d.id)&&currentItemDefs.filter(other=>other?.id===d.id).length===1);
    const doors=placed.filter(d=>validDoorGate(d)&&placed.filter(other=>other.id===d.id).length===1),objectives=currentObjectiveDefs.filter(d=>d&&typeof d.id==='string'&&d.id&&currentObjectiveDefs.filter(other=>other?.id===d.id).length===1);
    const select=(key,label,choices)=>`<label>${label}<select data-item-pattern="${key}"><option value="">Choose ${label}</option>${choices.map(d=>`<option value="${escapeHtml(d.id)}"${input[key]===d.id?' selected':''}>${escapeHtml(d.name)}</option>`).join('')}</select></label>`;
    const target=recipe.patternTarget==='objective'?select('objectiveId','Objective',objectives.map(d=>({id:d.id,name:d.title||d.name||'Unnamed Objective'}))):select('targetId','Door / Gate',[...(validDoorGate(state.item)?[{id:'__self__',name:'Self — '+(state.item.name||'this Door')}]:[]),...doors.map(d=>({id:d.id,name:d.name||'Unnamed Door'}))]);
    panel.querySelector('#graph-template-apply').insertAdjacentHTML('beforebegin',select('itemId','Item',items.map(d=>({id:d.id,name:d.name||'Unnamed Item'})))+`<label>Quantity<input data-item-pattern="quantity" type="number" min="1" step="1" value="${escapeHtml(input.quantity)}"></label>`+target+'<p>For an On Interact Event. Choose named references; no hidden IDs. Local eligibility is captured once per interaction. Effects happen before explicit consumption; no delay or rollback is added. Apply edits only this draft, then inspect and Save Graph.</p>');
    panel.querySelectorAll('[data-item-pattern]').forEach(field=>field.onchange=()=>{if(graphEditorState!==state||playMode)return;input[field.dataset.itemPattern]=field.value;});
  }
  panel.querySelector('#graph-template-apply').onclick=()=>{
    if(OpusGraphTemplates.nonempty(state.graph)&&!panel.querySelector('#graph-template-replace')?.checked){showStatus('Confirm replacement first. Existing draft data has not changed.');return;}
    const definition=state.trigger==='signal'?OpusSignals.find(signalDefinitions,state.eventRef?.signalId):null,context=recipe.requiresQuestFlow?graphQuestFlowContext(state,recipe.questFlowMode==='start'):recipe.requiresItemPattern?graphItemPatternContext(state,recipe):definition?{signalId:definition.id,payloadType:OpusSignals.payloadType(definition)}:undefined;
    const draft=OpusGraphTemplates.instantiate(recipe.id,()=>`n${graphNodeIdCounter++}`,context);
    if(!draft){showStatus(recipe.requiresQuestFlow?'Choose three distinct available Objectives, a named Item and positive whole quantity. Set source Next to End of chain explicitly first. Existing draft has not changed.':recipe.requiresItemPattern?'Choose an available named Item, positive whole quantity and current Door / Objective. Existing draft has not changed.':'Choose an available On Signal Event first. Filter and relay also needs a typed Signal. Existing draft has not changed.');return;}
    state.beforeTemplate=JSON.parse(JSON.stringify(state.graph));state.graph=OpusGraphSchema.migrate(draft);state.pendingConnection=null;renderGraphNodes();fitGraphViewToContent();showStatus(recipe.requiresQuestFlow?'Quest-lite flow applied to draft. Inspect the named source, Item and both routes. Event and Self are unchanged; Revert or Cancel recovers, Save Graph commits with Undo.':recipe.requiresItemPattern?'Named Item pattern applied to draft. Inspect the Item, quantity and Door / Objective. Revert or Cancel to recover; Save Graph commits with Undo.':'Editable template applied to draft. Choose the outgoing Signal and comparison values. Revert or Cancel to recover; Save Graph commits with Undo.');
  };
  panel.querySelector('#graph-template-revert').onclick=()=>{if(!state.beforeTemplate)return;state.graph=state.beforeTemplate;delete state.beforeTemplate;state.pendingConnection=null;renderGraphNodes();fitGraphViewToContent();};
}
function renderGraphFunctions() {
  const panel=document.getElementById('graph-functions');if(!panel||!graphEditorState)return;
  const retained=graphFunctions.slice(0,128).filter(d=>!OpusGraphFunctions.find(graphFunctions,d?.id));
  panel.innerHTML=`<summary>Reusable Functions · ${graphFunctions.length}</summary><p>Project-local, called on Self. Edit once for every caller. Local values belong to each call; Delay waits before returning. Depth limit8 / work budget2000. Library changes have their own Undo and are not discarded by Cancel Graph.</p>${graphFunctions.slice(0,128).filter(d=>OpusGraphFunctions.find(graphFunctions,d?.id)).map(d=>`<div style="display:flex;gap:8px;margin:6px 0"><span>${escapeHtml(d.name)}</span><button type="button" data-function-edit="${escapeHtml(d.id)}">Edit Function</button><button type="button" data-function-remove="${escapeHtml(d.id)}"${OpusGraphFunctions.isEditingDefinition(graphEditorState,d.id)?' disabled title="Finish or cancel editing this Function before removing it."':''}>Remove</button></div>`).join('')}<label>Function name<input id="graph-function-name" placeholder="Open the gate"></label><button type="button" id="graph-function-publish">Publish this Graph as Function</button>`;
  if(retained.length||graphFunctions.length>128)panel.insertAdjacentHTML('beforeend',`<p>Unavailable definitions are retained, not deleted. At most128 are shown.</p>${retained.map(d=>'<p>'+escapeHtml(d?.name||'Unrecognized Function record')+' · '+escapeHtml(OpusGraphSchema.inspect(d?.graph).message)+'</p>').join('')}`);
  panel.querySelector('#graph-function-publish').onclick=()=>{
    const name=panel.querySelector('#graph-function-name').value.trim();
    if(!name||graphFunctions.some(d=>d?.name===name)||graphFunctions.length>=OpusGraphFunctions.MAX_FUNCTIONS){showStatus('Choose a unique Function name; at most128 definitions.');return;}
    let n=1;while(graphFunctions.some(d=>d?.id==='gf'+n))n++;
    pushUndo();graphFunctions.push({id:'gf'+n,name,graph:JSON.parse(JSON.stringify(graphEditorState.graph))});renderGraphNodes();showStatus('Function published. Add Call Function to reuse it; library change can be undone.');
  };
  panel.querySelectorAll('[data-function-edit]').forEach(btn=>btn.onclick=()=>{
    const definition=OpusGraphFunctions.find(graphFunctions,btn.dataset.functionEdit);if(!definition)return;
    const previous=graphEditorState;openGraphEditor(previous.item,{trigger:'start',graph:definition.graph},'start');graphEditorState.functionDefinition=definition;graphEditorState.returnToEditor=previous;renderGraphNodes();
  });
  panel.querySelectorAll('[data-function-remove]').forEach(btn=>btn.onclick=()=>{if(OpusGraphFunctions.isEditingDefinition(graphEditorState,btn.dataset.functionRemove)){showStatus('Finish or cancel editing this Function before removing it.');return;}pushUndo();graphFunctions=graphFunctions.filter(d=>d?.id!==btn.dataset.functionRemove);renderGraphNodes();showStatus('Function removed; call references retained and diagnosed. Undo restores the definition.');});
}
function renderGraphValidation() {
  const output = document.getElementById('graph-validation');
  if (!output || !graphEditorState) return;
  const issues = [...OpusGraphValues.validate(graphEditorState.graph, GRAPH_NODE_TYPES),...OpusGraphVariables.validate(graphEditorState.graph),...OpusGraphFunctions.validate(graphEditorState.graph,graphFunctions)];
  if(graphEditorState.trigger==='signal'&&!OpusSignals.find(signalDefinitions,graphEditorState.eventRef?.signalId))issues.push({message:'On Signal needs an available named Signal. Create it in Project, then choose it here.'});
  if(graphEditorState.trigger==='controllerStateEvent'){const message=controllerStateEventAuthoringIssue(graphEditorState.eventRef);if(message)issues.push({message});}
  for(const node of graphEditorState.graph.nodes)if(node.type==='sendSignal'&&!OpusSignals.find(signalDefinitions,node.signalId))issues.push({message:'Send Signal needs an available named Signal; missing references do not execute.'});
  for(const node of graphEditorState.graph.nodes){
    if(node.type==='compareValues'){
      const type=node.valueType||'number',defaults={number:0,text:'',boolean:false,object:'',color:'#ffffff'},invalidLiteral=['left','right'].some(key=>{if(graphEditorState.graph.edges.some(e=>e.kind==='value'&&e.to===node.id&&e.toField===key))return false;let value=node[key]===undefined?defaults[type]:node[key];if(type==='object'&&value==='')value=graphEditorState.item?.id;return !OpusGraphValues.matches(type,value)||(type==='object'&&!findItemById(value));});
      if(invalidLiteral||(type!=='number'&&!['eq','ne'].includes(node.operator||'eq'))||!['eq','ne','lt','lte','gt','gte'].includes(node.operator||'eq'))issues.push({message:'Compare Values needs matching typed values. Only Numbers support ordered comparisons. Invalid comparisons fail closed; saved values are not converted.'});
    }
    const definition=OpusSignals.find(signalDefinitions,node.signalId),type=OpusSignals.payloadType(definition);
    if(node.type==='readSignalValue'&&(!definition||type==='none'))issues.push({message:'Read Signal Value needs a named Signal with a value type. Declare it in Project.'});
    if(node.type==='readSignalValue'&&!graphEditorState.functionDefinition&&(graphEditorState.trigger!=='signal'||graphEditorState.eventRef?.signalId!==node.signalId))issues.push({message:'Read Signal Value must match this On Signal Event. Reusable Functions inherit their caller occurrence.'});
    if(node.type==='sendSignal'&&definition&&!graphEditorState.graph.edges.some(e=>e.kind==='value'&&e.to===node.id&&e.toField==='payload')&&!OpusSignals.accepts(type,node.payload)&&!(type==='object'&&node.payload===''))issues.push({message:'Send Signal value must match its declared type; no automatic conversion. Choose a valid value or connect a matching typed Value.'});
  }
  output.dataset.graphVersion=String(OpusGraphSchema.version(graphEditorState.graph));
  output.innerHTML = issues.length ? `<summary>${issues.length} connection issue${issues.length===1?'':'s'} · Review</summary><p>Saved data is preserved. Invalid bound values and cyclic Conditions fail closed during Play.</p><ul>${issues.slice(0,20).map(i=>'<li>'+escapeHtml(i.message)+'</li>').join('')}</ul>${issues.length>20?'<p>More issues omitted; repair these first.</p>':''}` : '<summary>Connections checked · no structural issues</summary><p>Blue Value pins require matching types. Inline parameters remain the fallback when unconnected.</p>';
  output.insertAdjacentHTML('beforeend','<p>'+escapeHtml(OpusGraphSchema.inspect(graphEditorState.graph).message)+'</p>');
}
function renderGraphNodes() {
  const container = document.getElementById('graph-canvas-nodes');
  container.innerHTML = renderGraphNodeHTML({ id: 'start', x: 40, y: 20 }) + graphEditorState.graph.nodes.map(renderGraphNodeHTML).join('');
  const sourcePanel = document.getElementById('graph-entry-event-source');
  sourcePanel.hidden = !['spriteAnimationEvent','signal','controllerStateEvent'].includes(graphEditorState.trigger);
  sourcePanel.innerHTML = sourcePanel.hidden ? '' : graphEditorState.trigger==='controllerStateEvent'?'<strong>On Controller State · resolved Player transition</strong>'+controllerStateEventSourceOptions(graphEditorState.eventRef).html:graphEditorState.trigger==='signal'?'<strong>On Signal · named occurrence</strong>'+signalChoiceHTML(graphEditorState.eventRef?.signalId):'<strong>Event source · one Sprite and Clip</strong>' + spriteAnimationEventSourceOptions(graphEditorState.eventRef).html;
  wireGraphNodeEvents();
  renderGraphEdges();
  renderGraphVariables();
  renderGraphFunctions();
  renderGraphTemplates();
  renderGraphValidation();
}

document.getElementById('graph-canvas-wrap').addEventListener('pointermove', (e) => {
  if (!graphEditorState) return;
  if (graphEditorState.panning) {
    const { startClientX, startClientY, startViewX, startViewY } = graphEditorState.panning;
    // Pan is a raw screen-pixel delta added to the view offset (NOT divided
    // by scale) -- view.x/y ARE screen-space translate offsets, unlike
    // node.x/y which live in graph space. Confusing the two here would make
    // panning drift faster/slower than the cursor at any zoom other than 100%.
    graphEditorState.view.x = startViewX + (e.clientX - startClientX);
    graphEditorState.view.y = startViewY + (e.clientY - startClientY);
    applyGraphViewTransform();
    return;
  }
  if (!graphEditorState.dragNode) return;
  const container = document.getElementById('graph-canvas-nodes');
  const { id, offsetX, offsetY } = graphEditorState.dragNode;
  const node = graphEditorState.graph.nodes.find((n) => n.id === id);
  if (!node) return;
  const point = graphScreenToSpace(e.clientX, e.clientY);
  node.x = Math.max(0, point.x - offsetX);
  node.y = Math.max(0, point.y - offsetY);
  const nodeEl = container.querySelector(`[data-node-id="${id}"]`);
  nodeEl.style.left = `${node.x}px`;
  nodeEl.style.top = `${node.y}px`;
  renderGraphEdges();
});
window.addEventListener('pointerup', () => {
  if (graphEditorState) { graphEditorState.dragNode = null; graphEditorState.panning = null; }
});
document.getElementById('graph-canvas-wrap').addEventListener('click', (e) => {
  if (graphEditorState && graphEditorState.pendingConnection && (e.target.id === 'graph-canvas-wrap' || e.target.id === 'graph-canvas-nodes')) {
    highlightGraphPort(graphEditorState.pendingConnection.node, graphEditorState.pendingConnection.port, false);
    graphEditorState.pendingConnection = null;
  }
});

// Toolbar buttons are generated from GRAPH_NODE_TYPES rather than
// hand-listed in index.html, so a new action type in ACTION_TYPES gets a
// graph button automatically instead of needing a second place to update.
let graphLogicChoices;
function renderGraphActionPalette() {
graphLogicChoices = OpusAuthoringLanguage.logicEntries(ACTION_TYPES, {surface:'graph',graphTypes:GRAPH_NODE_TYPES});
document.getElementById('graph-toolbar-buttons').innerHTML = graphLogicChoices
  .map(meta => `<button data-node-type="${meta.id}" title="${escapeHtml(`${meta.kind === 'condition' ? 'Condition' : meta.kind === 'value' ? 'Value' : 'Action'} · ${meta.category} · ${meta.help}`)}"${meta.kind === 'condition' ? ' class="graph-cond-btn"' : ''}>${escapeHtml(meta.label)}</button>`)
  .join('');
document.getElementById('graph-node-search').dispatchEvent(new Event('input'));
}
renderGraphActionPalette();
document.getElementById('graph-node-search').addEventListener('input', (e) => {
  const q = e.target.value;
  document.getElementById('graph-toolbar-buttons').hidden = !q.trim() && !graphBrowseAll;
  document.querySelectorAll('#graph-toolbar-buttons [data-node-type]').forEach((btn) => {
    btn.classList.toggle('graph-node-hidden', !OpusAuthoringLanguage.matchesLogicEntry(graphLogicChoices.find(meta=>meta.id===btn.dataset.nodeType),q));
  });
});
document.getElementById('graph-browse-nodes').addEventListener('click', () => {
  graphBrowseAll = !graphBrowseAll;
  document.getElementById('graph-browse-nodes').setAttribute('aria-expanded', String(graphBrowseAll));
  document.getElementById('graph-node-search').dispatchEvent(new Event('input'));
});
document.getElementById('graph-toolbar').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-node-type]');
    if (!btn || !document.getElementById('graph-toolbar').contains(btn)) return;
    if (!graphEditorState) return;
    const type = btn.dataset.nodeType;
    if (!Object.prototype.hasOwnProperty.call(GRAPH_NODE_TYPES, type)) return;
    const id = `n${graphNodeIdCounter++}`;
    const count = graphEditorState.graph.nodes.length;
    // Only place the new node. Never migrate historical authored coordinates.
    const column = count % 4;
    const rendered = Array.from(document.querySelectorAll('#graph-canvas-nodes [data-node-id]'));
    const previous = graphEditorState.graph.nodes.at(-1);
    const y = column && previous ? previous.y : Math.max(220, ...rendered.map(el => el.offsetTop + el.offsetHeight + 60));
    graphEditorState.graph.nodes.push({ id, type, x: 60 + column * 280, y });
    renderGraphNodes();
});
document.getElementById('graph-cancel-btn').addEventListener('click', closeGraphEditor);
document.getElementById('graph-save-btn').addEventListener('click', () => {
  if(playMode||!graphEditorState)return;
  if(graphEditorState.functionDefinition){const definition=OpusGraphFunctions.find(graphFunctions,graphEditorState.functionDefinition.id);if(!definition||definition!==graphEditorState.functionDefinition){showStatus('This Function definition is no longer current. Cancel or restore it with Undo before saving.');return;}if(JSON.stringify(definition.graph)===JSON.stringify(graphEditorState.graph)){closeGraphEditor();return;}pushUndo();definition.graph=graphEditorState.graph;closeGraphEditor();return;}
  const { item, existingBehavior, trigger, graph } = graphEditorState;
  if(!item||!placed.includes(item)||existingBehavior&&!item.behaviors?.includes(existingBehavior)){showStatus('This Graph owner is no longer current. Cancel and reopen its Graph.');return;}
  const eventRef = readBehaviorEventSource(trigger,document.getElementById('graph-entry-event-source'));
  if(trigger==='controllerStateEvent'){const issue=controllerStateEventAuthoringIssue(eventRef);if(issue){showStatus(issue);return;}}
  if (existingBehavior && existingBehavior.trigger === trigger && JSON.stringify(existingBehavior.graph) === JSON.stringify(graph) && JSON.stringify(existingBehavior.eventRef) === JSON.stringify(eventRef)) { closeGraphEditor(); return; }
  pushUndo();
  if (existingBehavior) {
    existingBehavior.graph = graph;
    existingBehavior.trigger = trigger;
    if (['spriteAnimationEvent','signal','controllerStateEvent'].includes(trigger)) existingBehavior.eventRef = eventRef;
    else delete existingBehavior.eventRef;
  }
  else item.behaviors.push({ trigger, action: 'graph', graph, eventRef });
  closeGraphEditor();
  renderBehaviorList(item);
});

let playTriggers = []; // { item, volume } for active 'enter' behaviors while playing

