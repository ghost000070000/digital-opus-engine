// --- Node graph (visual scripting) ---
// Additive, not a replacement: the fixed trigger/action list above stays
// exactly as-is (simple, tested, the common case). This is another Action
// choice for logic that's more than one fixed action but doesn't need the
// Custom Script escape hatch -- wiring together the SAME primitives
// (Message/Sound/Win/Lose/Boost/Objective) plus basic flow (AND/OR,
// a named counter) visually. Deliberately not general-purpose: no loops,
// no arbitrary math -- Custom Script remains the ceiling for that, same
// as it already is for the fixed list.
//
// Execution model: a graph has one implicit 'start' node. 'next' edges
// chain action nodes in sequence (start -> first action -> second -> ...).
// An action node may have at most one incoming 'gate' edge from a
// condition node; if present, the action only *executes* when the
// condition is true, but the chain always continues past it either way
// (a guard clause, not a branch) -- so "skip this one action if the
// condition's false, keep going" is expressible without needing an
// explicit else path. AND/OR read their operands via 'cond' edges from
// other condition nodes, recursively.
function evaluateConditionNode(node, graph, item, state) {
  if (!node) return false;
  const evaluation = state || { active: new Set(), remaining: 200, invalid: false };
  if (evaluation.remaining-- <= 0 || evaluation.active.has(node)) {
    evaluation.invalid = true;
    return false;
  }
  evaluation.active.add(node);
  try {
    const resolved = resolveGraphNodeValues(node, graph, item, evaluation);
    if (!resolved.valid) { evaluation.invalid = true; return false; }
    const result = evaluateConditionNodeValue(resolved.node, graph, item, evaluation);
    // NOT/OR must not turn an invalid dependency into a true gate.
    return !evaluation.invalid && result;
  } finally { evaluation.active.delete(node); }
}
function evaluateConditionNodeValue(node, graph, item, evaluation) {
  if (!node) return false;
  if(node.type==='inputActionPressed' || node.type==='inputActionHeld') {
    const code=inputActionBinding(node.inputActionId);
    if(!code || !playMode || !app.input) { evaluation.invalid=true; return false; }
    const context=inputActionContextState(node.inputActionId);
    if(!context.valid) { evaluation.invalid=true; return false; }
    return context.allowed && (node.type==='inputActionPressed' ? inputActionWasPressed(node.inputActionId,undefined,true) : inputActionDown(node.inputActionId));
  }
  if(node.type==='compareValues'){
    const type=node.valueType||'number',fallback=({number:0,text:'',boolean:false,object:'',color:'#ffffff'})[type];
    const literal=key=>{const value=node[key]===undefined?fallback:node[key];return type==='object'&&value===''?item?.id:value;};
    const result=OpusGraphValues.compare(type,node.operator||'eq',literal('left'),literal('right'),findItemById);if(!result.valid)evaluation.invalid=true;return result.valid&&result.value;
  }
  if (node.type === 'and' || node.type === 'or') {
    const inputs = (graph?.edges || [])
      .filter((e) => e.kind === 'cond' && e.to === node.id)
      .map((e) => graph.nodes.find((n) => n.id === e.from))
      .filter(Boolean);
    if (inputs.length === 0) return false;
    return node.type === 'and'
      ? inputs.every((n) => evaluateConditionNode(n, graph, item, evaluation))
      : inputs.some((n) => evaluateConditionNode(n, graph, item, evaluation));
  }
  if (node.type === 'counterReaches') {
    const value = (window.__gameState && window.__gameState[node.counter]) || 0;
    return value >= (node.target || 0);
  }
  // The >= direction above fits a counter that only ever climbs (score,
  // damage taken, crates collected) toward a threshold. A counter that
  // only ever falls (health, lives, ammo) needs the opposite direction --
  // found by dogfooding a health-based stress-test game, where wiring
  // Lose to Counter Reaches(health, 0) fired the instant health dropped
  // BELOW its starting value, since e.g. 2 >= 0 is already true.
  if (node.type === 'counterAtMost') {
    const value = (window.__gameState && window.__gameState[node.counter]) || 0;
    return value <= (node.target || 0);
  }
  // Health-specific wrapping of the same two comparisons above, reading the
  // fixed 'health' key instead of a free-typed counter name -- one less
  // place a typo ("Health" vs "health") could silently make a condition
  // never fire.
  if (node.type === 'healthAtLeast') {
    ensureHealthInit();
    return window.__gameState.health >= (node.target || 0);
  }
  if (node.type === 'healthAtMost') {
    ensureHealthInit();
    return window.__gameState.health <= (node.target || 0);
  }
  if (node.type === 'objectHealthAtLeast' || node.type === 'objectHealthAtMost') {
    const t = findItemById(node.targetId);
    if (!t || t.kind !== 'cube') return false;
    ensureObjectHealthInit(t);
    return node.type === 'objectHealthAtLeast' ? t.health.current >= (node.target || 0) : t.health.current <= (node.target || 0);
  }
  if (node.type === 'timerFinished') {
    const t = window.__gameTimers && window.__gameTimers[node.timer];
    return !!(t && t.finished);
  }
  if (node.type === 'timerAtLeast') {
    const t = window.__gameTimers && window.__gameTimers[node.timer];
    return !!t && t.elapsed >= (node.target || 0);
  }
  if (node.type === 'timerAtMost') {
    const t = window.__gameTimers && window.__gameTimers[node.timer];
    return !!t && t.elapsed <= (node.target || 0);
  }
  // NOT reads its single operand the same way AND/OR read theirs (a 'cond'
  // edge from another condition node) -- absent input is treated as false,
  // so NOT(nothing wired) is true, matching "nothing said this was true".
  if (node.type === 'not') {
    const inputEdge = (graph?.edges || []).find((e) => e.kind === 'cond' && e.to === node.id);
    const inputNode = inputEdge ? graph.nodes.find((n) => n.id === inputEdge.from) : null;
    return !evaluateConditionNode(inputNode, graph, item, evaluation);
  }
  // Wave 8 (Priority B/Section 11): Object Variable conditions -- `targetId`
  // empty/unset resolves to `item` (Section 12's own "Target = Self must be
  // easy/default" requirement, the same `resolveTarget` convention every
  // target-optional ACTION already uses), so a reusable prefab's own logic
  // never has to reference its own generated Object ID.
  // Wave 8 (Priority K dogfood/Power Grid): Carry/Drop (Wave 7 Priority J)
  // never gained its own condition to gate logic on "is a specific object
  // currently held" -- its own dogfood used direct function calls, not a
  // real Node Graph. A generator/altar/socket-style "insert what you're
  // carrying" interaction genuinely needs this, so it's added here now,
  // matching every other bounded condition's own pattern.
  if (node.type === 'objectIsHeld') {
    if (!heldObjectItem) return false;
    return node.targetId ? heldObjectItem.id === node.targetId : true; // no targetId = "is ANYTHING currently held"
  }
  if (node.type === 'objectVariableEquals' || node.type === 'numberAtLeast' || node.type === 'numberAtMost' || node.type === 'booleanIs') {
    const t = node.targetId ? findItemById(node.targetId) : item;
    if (!t || !t.variables) return false;
    const v = t.variables[node.name];
    if (node.type === 'objectVariableEquals') return String(v) === String(node.value);
    if (node.type === 'numberAtLeast') return (Number(v) || 0) >= (parseFloat(node.value) || 0);
    if (node.type === 'numberAtMost') return (Number(v) || 0) <= (parseFloat(node.value) || 0);
    if (node.type === 'booleanIs') return !!v === (node.value === true || node.value === 'true');
  }
  if (node.type === 'counterEquals') {
    const value = (window.__gameState && window.__gameState[node.counter]) || 0;
    return value === (node.target || 0);
  }
  if (node.type === 'counterLessThan') {
    const value = (window.__gameState && window.__gameState[node.counter]) || 0;
    return value < (node.target || 0);
  }
  if (node.type === 'counterGreaterThan') {
    const value = (window.__gameState && window.__gameState[node.counter]) || 0;
    return value > (node.target || 0);
  }
  if (node.type === 'objectVisible') {
    const target = node.targetId ? findItemById(node.targetId) : null;
    const entity = target && target.kind === 'cube' ? target.entity : null;
    return !!(entity && entity.visible);
  }
  if (node.type === 'isFlagTrue') return !!(window.__gameFlags && window.__gameFlags[node.name]);
  if (node.type === 'isFlagFalse') return !(window.__gameFlags && window.__gameFlags[node.name]);
  if (node.type === 'hasItem') return ((window.__gameInventory && window.__gameInventory[node.name]) || 0) >= (node.count || 1);
  if (node.type === 'hasNamedItem') return !!namedInventoryItemSelection(node.itemId,node.count===undefined?1:node.count);
  if (node.type === 'doorIsClosed') {
    const target=resolveTarget(node,item);
    return validDoorGate(target)&&!(doorGateState.get(target)?.open??target.components['door-gate'].startsOpen);
  }
  // Wave 7 (Priority F): objectiveIsComplete/objectiveIsActive read the
  // exact same window.__gameObjectives[id] state the three Objective
  // actions write, reusing this same evaluateConditionNode pattern rather
  // than a parallel objective-condition mechanism.
  if (node.type === 'objectiveIsComplete') return !!(window.__gameObjectives && window.__gameObjectives[node.objectiveId] === 'complete');
  if (node.type === 'objectiveIsActive') return !!(window.__gameObjectives && window.__gameObjectives[node.objectiveId] === 'active');
  // Wave 7 (Priority C/Section 21): "Slot Has Item" -- the one new condition
  // this priority's own dogfood justified, reusing the same evaluateConditionNode
  // pattern every other condition already follows rather than inventing a
  // parallel check mechanism.
  if (node.type === 'slotHasItem') return !!(playerEquipment[node.slot] && (!node.name || playerEquipment[node.slot].itemName === node.name));
  return false;
}

// A graph action node's own fields (node.text, node.force, node.targetId,
// ...) are already flat, in exactly the shape executeAction expects as
// `params` -- so the node object doubles as its own params object, no
// conversion needed (unlike runAction's legacy `.param` string, which does).
function resolveGraphNodeValues(node, graph, item, evaluation, scope) {
  if (!(graph?.edges || []).some(e => e.kind === 'value' && e.to === node.id)) return {valid:true,node};
  const state = evaluation || {active:new Set(),remaining:200,invalid:false};
  if (!state.scope) state.scope = scope || OpusGraphVariables.createScope(graph);
  return OpusGraphValues.resolve(node, graph, item, GRAPH_NODE_TYPES, source => {
    const value = evaluateConditionNode(source, graph, item, state);
    return {valid:!state.invalid,value};
  }, findItemById, source => OpusGraphVariables.read(graph,source.variableId,state.scope,item,window.__gameState), source => {
    const event=state.scope?.signalEvent,definition=OpusSignals.find(signalDefinitions,source.signalId);
    return {valid:!!event&&event.signalId===source.signalId&&event.type===OpusSignals.payloadType(definition)&&OpusSignals.accepts(event.type,event.value)&&(event.type!=='object'||!!findItemById(event.value)),value:event?.value};
  });
}
function runGraphActionNode(node, item, graph, scope) {
  if (node.type === 'writeGraphVariable') {
    const resolved = resolveGraphNodeValues(node,graph,item,null,scope);
    const variable = OpusGraphVariables.definition(graph,node.variableId);
    if (!resolved.valid || !variable) return;
    const value = resolved.node.value === undefined || (variable.type==='object'&&resolved.node.value==='') ? OpusGraphVariables.initial(variable,item) : resolved.node.value;
    window.__gameState = window.__gameState || {};
    OpusGraphVariables.write(graph,node.variableId,value,scope,item,window.__gameState,(definition,authoredValue,owner) => executeAction('setObjectVariable',{name:definition.name,valueType:definition.type==='text'?'string':definition.type,value:authoredValue},owner));
    return;
  }
  if (!(graph?.edges || []).some(e => e.kind === 'value' && e.to === node.id)) {
    executeAction(node.type, node, item);
    return;
  }
  const resolved = resolveGraphNodeValues(node, graph, item, null, scope);
  if (resolved.valid) executeAction(node.type, resolved.node, item);
}

// Delay/Wait nodes pause a graph run mid-sequence without blocking anything
// else -- Node Graph execution is normally fully synchronous (a bounded for
// loop), so a Delay literally can't "wait" inline; instead it registers
// itself here and the main per-frame loop resumes runGraph from right after
// it once enough simulation time (not real/wall time -- pause-safe for
// free, since this whole scheduler is only ever ticked from inside the
// engine's own onUpdate, which the engine itself stops calling while
// paused) has passed. Cleared on every Play start/Stop (enterPlayMode/
// exitPlayMode) so a delay from a previous session can never fire into a
// fresh one, and each entry is dropped if its item was removed from
// `placed` in the meantime (destroyed mid-delay) rather than resumed into
// a graph run against a no-longer-live object.
let pendingDelays = []; // { resumeAt, graph, item, fromId, scope } — invocation-local scope survives Delay
// Wave 6 (Priority M): a small, GENERIC "call this later" scheduler --
// deliberately separate from pendingDelays above, which is shaped
// specifically for resuming a Node Graph at a particular node, not for an
// arbitrary callback. Used by the Death animation delay (applyHitDamage)
// so a character isn't destroyed until its Death clip has actually had
// time to play.
let deferredCalls = []; // { fireAt, fn }
function processDeferredCalls() {
  if (deferredCalls.length === 0) return;
  const ready = deferredCalls.filter((d) => d.fireAt <= simElapsed);
  if (ready.length === 0) return;
  deferredCalls = deferredCalls.filter((d) => d.fireAt > simElapsed);
  for (const d of ready) d.fn();
}

// Wave 6B (Priority E): Sequence RUNTIME -- executes a Sequence's ordered
// steps through the exact same executeAction every Behavior/Node Graph
// action already funnels through (no second per-action implementation). A
// Delay step pauses the walk by scheduling its continuation through the
// SAME generic `deferredCalls` scheduler Priority M's death-animation delay
// already built (simulation time, not a setTimeout -- Freeze Player doesn't
// pause simulation, so a Sequence's own Delay keeps advancing correctly
// during a cutscene). `runningSequenceIds` is the reentrancy guard: while a
// sequence is mid-run, a second `playSequence` call for the SAME sequence is
// a no-op (Ignore policy) -- a predictable, documented default rather than
// silently starting a second overlapping run of the same steps.
let runningSequenceIds = [];
function runSequenceSteps(seq, item, stepIndex) {
  const stopInvalid = () => { runningSequenceIds = runningSequenceIds.filter(id=>id!==seq?.id); if(typeof showToast==='function')showToast('Sequence stopped: unavailable saved step. Repair it in Level > Sequences.'); };
  if (!seq || !Array.isArray(seq.steps)) { stopInvalid(); return; }
  for (let i = stepIndex; i < seq.steps.length; i++) {
    const step = seq.steps[i];
    if (!step || typeof step !== 'object' || Array.isArray(step)) { stopInvalid(); return; }
    if (step.kind === 'delay') {
      const seconds = Math.max(0, parseFloat(step.seconds) || 0);
      if (!Number.isFinite(seconds)) { stopInvalid(); return; }
      // `sequenceRun: true` tags this deferred call as Sequence continuation
      // state specifically (not e.g. a Priority M death-animation removal,
      // which also uses this same generic scheduler) -- switchToLevelDuringPlay
      // filters on exactly this tag to cancel an in-flight cutscene cleanly on
      // Restart Level/Switch Level, without disturbing unrelated deferred work.
      deferredCalls.push({ fireAt: simElapsed + seconds, fn: () => runSequenceSteps(seq, item, i + 1), sequenceRun: true });
      return; // pause here -- resumes via the deferred call above
    }
    if (step.kind !== undefined && step.kind !== 'action' || step.params !== undefined && (!step.params || typeof step.params !== 'object' || Array.isArray(step.params)) || typeof ACTION_TYPES !== 'undefined' && !Object.prototype.hasOwnProperty.call(ACTION_TYPES,step.actionType)) { stopInvalid(); return; }
    executeAction(step.actionType, step.params, item);
  }
  runningSequenceIds = runningSequenceIds.filter((id) => id !== seq.id);
}
function playSequence(seq, item) {
  if (!seq || !Array.isArray(seq.steps) || seq.steps.length === 0) return;
  if (runningSequenceIds.includes(seq.id)) return; // reentrancy: Ignore (see comment above)
  // A retained unavailable cutscene step must not strand the Player after
  // an earlier Freeze. Refuse the whole known-invalid composition before
  // effects, without undoing a Freeze owned by some other explicit Action.
  const unavailable = seq.steps.some(step => !step || typeof step !== 'object' || Array.isArray(step)
    || (step.kind === 'delay' ? !Number.isFinite(Math.max(0, parseFloat(step.seconds) || 0))
      : step.kind !== undefined && step.kind !== 'action'
        || step.params !== undefined && (!step.params || typeof step.params !== 'object' || Array.isArray(step.params))
        || typeof ACTION_TYPES !== 'undefined' && !Object.prototype.hasOwnProperty.call(ACTION_TYPES, step.actionType)));
  if (unavailable) { if(typeof showToast==='function')showToast('Sequence not started: unavailable saved step. Repair it in Level > Sequences.'); return; }
  runningSequenceIds.push(seq.id);
  runSequenceSteps(seq, item, 0);
}

function runGraph(graph, item, startId, scope) {
  if (!graph || !graph.nodes || !graph.edges) return;
  if(typeof OpusGraphSchema!=='undefined'&&!OpusGraphSchema.canExecute(graph))return;
  if (!scope && (graph.variables?.length || graph.nodes.some(n=>n.type==='callGraphFunction'))) scope = OpusGraphVariables.createScope(graph);
  let currentId = startId || 'start';
  // Trampoline call/return: repeated reusable calls never grow the JS stack.
  graphInvocation: while (graph) {
  const visited = new Set(); // guards against an accidental cycle hanging the game
  for (let guard = 0; guard < 200; guard++) {
    if (scope?.callBudget && --scope.callBudget.remaining < 0) return;
    const nextEdge = graph.edges.find((e) => e.kind === 'next' && e.from === currentId);
    if (!nextEdge || visited.has(nextEdge.to)) break;
    visited.add(nextEdge.to);
    const node = graph.nodes.find((n) => n.id === nextEdge.to);
    if (!node) break;
    if(typeof graphTrace!=='undefined'&&graphTrace.enabled)graphTrace.record({...graphTraceGraphLocation(graph,item),time:simElapsed,owner:item?.name||item?.id||'Self',ownerId:item?.id,nodeId:node.id,label:GRAPH_NODE_TYPES[node.type]?.label||node.type,outcome:'NODE_ENTER',functionId:scope?.callChain?.at(-1)});
    // Dogfood (Signal Relay) fix: a node can have MORE THAN ONE gate edge
    // (e.g. a completion action gated on both "not already done" AND "all N
    // sub-conditions met"). This used to look up only the FIRST matching
    // gate edge via .find() and silently ignore any others -- so a node
    // with two gates would fire as soon as EITHER was true, not both,
    // since the second gate edge was dead code. Collect every gate edge
    // targeting this node and require ALL of their conditions to hold
    // (AND), matching what visual graph authoring actually implies by
    // drawing multiple gate arrows into the same node.
    const gateEdges = graph.edges.filter((e) => e.kind === 'gate' && e.to === node.id);
    const gatesPass = gateEdges.every((ge) => {
      const condition=graph.nodes.find((n)=>n.id===ge.from),passed=evaluateConditionNode(condition,graph,item,{active:new Set(),remaining:200,invalid:false,scope});
      if(typeof graphTrace!=='undefined'&&graphTrace.enabled)graphTrace.record({...graphTraceGraphLocation(graph,item),time:simElapsed,owner:item?.name||item?.id,nodeId:condition?.id,label:GRAPH_NODE_TYPES[condition?.type]?.label||'Missing Condition',outcome:passed?'CONDITION_TRUE':'CONDITION_FALSE',functionId:scope?.callChain?.at(-1)});
      return passed;
    });
    if (gateEdges.length === 0 || gatesPass) {
      if (node.type === 'callGraphFunction') {
        const definition = OpusGraphFunctions.find(graphFunctions,node.functionId);
        const called = definition && OpusGraphFunctions.invocation(definition,scope,graph,item,node.id);
        if(typeof graphTrace!=='undefined'&&graphTrace.enabled)graphTrace.record({...graphTraceGraphLocation(graph,item),time:simElapsed,owner:item?.name||item?.id,nodeId:node.id,label:definition?.name||'Call Function',outcome:called?'CALL_ENTER':'CALL_REJECTED',functionId:node.functionId});
        if (called) { graph=definition.graph;scope=called;currentId='start';continue graphInvocation; }
        currentId=node.id;continue; // missing/recursive calls fail closed without losing authored data
      }
      if (node.type === 'delay') {
        const resolved = resolveGraphNodeValues(node, graph, item, null, scope);
        if (!resolved.valid) { currentId = node.id; continue; }
        const seconds = Math.max(0, parseFloat(resolved.node.seconds) || 0);
        pendingDelays.push({ resumeAt: simElapsed + seconds, graph, item, fromId: node.id, scope });
        if(typeof graphTrace!=='undefined'&&graphTrace.enabled)graphTrace.record({...graphTraceGraphLocation(graph,item),time:simElapsed,owner:item?.name||item?.id,nodeId:node.id,label:`Wait ${seconds}s`,outcome:'DELAY_SCHEDULED',functionId:scope?.callChain?.at(-1)});
        return; // sequence pauses here; the per-frame scheduler resumes it
      }
      runGraphActionNode(node, item, graph, scope);
      if(typeof graphTrace!=='undefined'&&graphTrace.enabled)graphTrace.record({...graphTraceGraphLocation(graph,item),time:simElapsed,owner:item?.name||item?.id,nodeId:node.id,label:GRAPH_NODE_TYPES[node.type]?.label||node.type,outcome:'ACTION_REQUESTED',functionId:scope?.callChain?.at(-1)});
      if (gameEnded) break;
    }else if(typeof graphTrace!=='undefined'&&graphTrace.enabled)graphTrace.record({...graphTraceGraphLocation(graph,item),time:simElapsed,owner:item?.name||item?.id,nodeId:node.id,label:GRAPH_NODE_TYPES[node.type]?.label||node.type,outcome:'GATE_REJECTED',functionId:scope?.callChain?.at(-1)});
    currentId = node.id;
  }
  const returnTo = scope?.returnTo;
  if (!returnTo || gameEnded) break;
  if(typeof graphTrace!=='undefined'&&graphTrace.enabled)graphTrace.record({...graphTraceGraphLocation(returnTo.graph,returnTo.item),time:simElapsed,owner:item?.name||item?.id,nodeId:returnTo.fromId,label:'Return to caller',outcome:'CALL_RETURN',functionId:scope?.callChain?.at(-1)});
  graph=returnTo.graph;item=returnTo.item;currentId=returnTo.fromId;scope=returnTo.scope;
  }
}

// Captured provenance names the graph that owns the recorded node. A called
// Function ID is not the location of its caller's Call node or return point.
function graphTraceGraphLocation(graph,item) {
  const behaviorMatches=[];
  if(Array.isArray(item?.behaviors)&&item.behaviors.length<=128)for(let i=0;i<item.behaviors.length;i++)if(item.behaviors[i]?.graph===graph)behaviorMatches.push(i);
  const functions=typeof graphFunctions==='undefined'||!Array.isArray(graphFunctions)||graphFunctions.length>128?[]:graphFunctions.filter(x=>x?.graph===graph);
  const uniqueBehavior=behaviorMatches.length===1&&functions.length===0;
  const uniqueFunction=functions.length===1&&behaviorMatches.length===0;
  const location={ownerId:typeof item?.id==='string'?item.id:'',levelId:typeof levels!=='undefined'&&typeof currentLevelIndex!=='undefined'?levels[currentLevelIndex]?.id||'':'',
    graphKind:uniqueBehavior?'behavior':uniqueFunction?'function':'unavailable',behaviorIndex:uniqueBehavior?behaviorMatches[0]:-1,graphFunctionId:uniqueFunction?functions[0].id:''};
  location.locationId=captureGraphTraceLocation(graph,location);return location;
}
function captureGraphTraceLocation(graph,location){
  if(location.graphKind==='unavailable'||typeof levels==='undefined')return '';
  const entries=graphTraceGraphLocation.locations||(graphTraceGraphLocation.locations=[]);
  const existing=entries.find(x=>x.graph===graph&&x.ownerId===location.ownerId&&x.levelsRoot===levels);if(existing)return existing.id;
  if(entries.length>=200)return '';
  let signature;try{signature=JSON.stringify(graph);}catch{return '';}
  if(typeof signature!=='string'||signature.length>32768)return '';
  const id=String(entries.length+1);entries.push({...location,id,graph,signature,levelsRoot:levels});return id;
}
function resolveCapturedGraphStep(row,context){
  const fail=reason=>({ok:false,reason});
  if(context.playing)return fail('Stop Play before opening a captured Graph.');
  const captured=(graphTraceGraphLocation.locations||[]).find(x=>x.id===row?.locationId);
  if(!captured||captured.levelsRoot!==context.levels)return fail('Captured project/location is unavailable. Capture a fresh run.');
  if(context.levels[context.levelIndex]?.id!==captured.levelId)return fail('Return to the captured Level and capture a fresh run.');
  const owners=context.placed.filter(x=>x.id===captured.ownerId);if(owners.length!==1)return fail('Captured Object is unavailable or ambiguous. Capture a fresh run.');
  const item=owners[0];let graph,behavior,definition;
  if(captured.graphKind==='behavior'){behavior=item.behaviors?.[captured.behaviorIndex];if(behavior?.action==='graph')graph=behavior.graph;}
  else if(captured.graphKind==='function'){const matches=context.functions.filter(x=>x.id===captured.graphFunctionId);if(matches.length===1){definition=matches[0];graph=definition.graph;}}
  let signature;try{signature=JSON.stringify(graph);}catch{return fail('Captured Graph changed. Capture a fresh run.');}
  if(!graph||signature!==captured.signature||graph.nodes?.filter(x=>x.id===row.nodeId).length!==1)return fail('Captured Graph/node changed or is ambiguous. Capture a fresh run.');
  return {ok:true,item,behavior,definition,nodeId:row.nodeId};
}
function focusCapturedGraphStep(sequence){
  const row=graphTrace.snapshot().records.find(x=>x.sequence===Number(sequence));
  const target=resolveCapturedGraphStep(row,{playing:playMode,levels,levelIndex:currentLevelIndex,placed,functions:graphFunctions});
  if(!target.ok){showStatus(target.reason);return false;}
  if(target.definition){openGraphEditor(target.item,{trigger:'start',graph:target.definition.graph},'start');graphEditorState.functionDefinition=target.definition;renderGraphNodes();}
  else{selectItem(target.item);openGraphEditor(target.item,target.behavior,target.behavior.trigger);}
  focusProjectGraphIssue({graphNodeId:target.nodeId});showStatus('Opened captured Graph node. This is authored data, not a replay.');return true;
}
function processPendingDelays() {
  if (pendingDelays.length === 0) return;
  const ready = pendingDelays.filter((pd) => pd.resumeAt <= simElapsed);
  if (ready.length === 0) return;
  pendingDelays = pendingDelays.filter((pd) => pd.resumeAt > simElapsed);
  for (const pd of ready) {
    if (gameEnded) break;
    if (pd.item && placed.indexOf(pd.item) === -1) continue; // item destroyed mid-delay
    if(typeof graphTrace!=='undefined'&&graphTrace.enabled)graphTrace.record({...graphTraceGraphLocation(pd.graph,pd.item),time:simElapsed,owner:pd.item?.name||pd.item?.id,nodeId:pd.fromId,label:'Resume after wait',outcome:'DELAY_RESUMED',functionId:pd.scope?.callChain?.at(-1)});
    runGraph(pd.graph, pd.item, pd.fromId, pd.scope);
  }
}

function runBehaviors(item, triggerType) {
  if (!item.behaviors || gameEnded) return;
  for (const behavior of item.behaviors) {
    if (behavior.trigger === triggerType) runAction(behavior, item);
  }
}

// Phase052: opt-in lifecycle subscribers share ordinary Behavior execution.
// Snapshot prevents actions spawning new subscribers from expanding this tick.
function runLifecycleBehaviors(triggerType) {
  for (const item of placed.slice()) {
    if (['cube', 'sprite'].includes(item.kind) && item.behaviors?.some(b => b.trigger === triggerType) && placed.includes(item)) runBehaviors(item, triggerType);
  }
}

// Phase 024: Sprite frame events are authored on Clips, but gameplay stays
// in ordinary Behaviors. The immutable event context is matched against an
// explicit target/Clip/event triple; there is intentionally no wildcard.
function dispatchSpriteAnimationEvent(context) {
  if (!playMode || gameEnded || !context) return;
  window.__lastSpriteAnimationEvent = context;
  for (const owner of placed.slice()) for (const behavior of owner.behaviors || []) {
    const ref = behavior.eventRef;
    if (behavior.trigger === 'spriteAnimationEvent' && ref && ref.targetId === context.targetSpriteId && ref.clipId === context.clipId && ref.eventId === context.eventId) runAction(behavior, owner);
  }
}

// Generic Interact: unlike Enter/Exit/Stay (proximity-driven, fire on their
// own), Interact needs an explicit press while in range -- closest
// interactable wins if more than one overlaps, matching how a player would
// expect "the thing I'm facing/nearest to" to respond, not all of them at
// once. INTERACT_RANGE is deliberately more generous than a Trigger
// Volume's own radius (1.5x scale) since Interact is meant to work from a
// natural "standing in front of it" distance, not requiring literal overlap.
const INTERACT_RANGE = 2.5;
let nearestInteractable = null;
function interactionPolicy(item) {
  if (!item || item === heldObjectItem || !item.entity?.visible || item.entity.spriteRenderer?.visible === false || !item.behaviors?.some(b => b.trigger === 'interact')) return null;
  const component = item.components?.interactable;
  if (component) {
    if (!['cube', 'sprite'].includes(item.kind) || component.version !== 1 || component.enabled !== true || !Number.isFinite(component.range) || component.range <= 0 || component.range > 100) return null;
    return { range: component.range, prompt: typeof component.prompt === 'string' ? component.prompt.slice(0, 120) : 'interact' };
  }
  return item.kind === 'cube' ? { range: INTERACT_RANGE, prompt: 'interact' } : null;
}
function updateInteract() {
  const promptEl = document.getElementById('interact-prompt');
  const touchBtn = document.getElementById('touch-interact');
  if (!player || !playMode || gameEnded || app.paused) { nearestInteractable = null; promptEl.classList.remove('visible'); touchBtn.classList.remove('interactable-visible'); return; }
  let closest = null;
  let closestDist = Infinity;
  for (const item of placed) {
    const policy = interactionPolicy(item);
    if (!policy) continue;
    const dist = player.entity.position.sub(item.entity.position).length();
    if (dist < policy.range && dist < closestDist) { closestDist = dist; closest = item; }
  }
  nearestInteractable = closest;
  promptEl.classList.toggle('visible', !!closest);
  touchBtn.classList.toggle('interactable-visible', !!closest);
  if (closest) promptEl.textContent = `Press ${keyCodeToLabel(effectiveInputMap.interact)} to ${interactionPolicy(closest).prompt}`;
}
function fireInteract() {
  // The keyboard path (app.input.wasPressed('KeyF'), read from inside
  // app.onUpdate) never reaches this function while app.paused -- the
  // engine itself gates ALL onUpdate callbacks behind `!this.paused` (see
  // 22-api.js). The touch Interact button's pointerdown listener is a raw
  // DOM listener with no such gate, so without this check, tapping it while
  // a Dialogue (or the Start Screen, or Pause itself) has the game paused
  // would re-fire the SAME interact behavior a second time on top of the
  // first -- e.g. opening a second Dialogue while the first is still
  // showing. Found while confirming Show Dialogue can't double-trigger.
  if (app.paused || !playMode || gameEnded) return;
  // Raw touch input can arrive after movement, deletion or a policy change.
  // Recompute using the same policy rather than trusting yesterday's prompt.
  updateInteract();
  if (nearestInteractable) runBehaviors(nearestInteractable, 'interact');
}

