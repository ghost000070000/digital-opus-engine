// --- Dialogue ---
// Pauses the engine (App.pause) so nothing moves/damages/spawns behind the
// box while it's up, same reasoning as the Start Screen -- a player reading
// dialogue text isn't dodging lava at the same time by accident.
let conversationCameraSession = null;
function endConversationCamera(restore = true) {
  const session=conversationCameraSession;
  conversationCameraSession=null;
  if (!session || !restore || !playMode || session.levelIndex!==currentLevelIndex || session.placedOwner!==placed || session.revision!==cameraOwnershipRevision) return;
  restoreSceneCamera(session.snapshot);
  activeCameraBlend=session.blend;activeCameraPath=session.path;lastAppliedCameraItemId=session.previousId;
  cameraOwnershipRevision++;
}
function beginConversationCamera(tree) {
  endConversationCamera();
  if (!playMode || typeof tree?.cameraId!=='string' || !tree.cameraId) return;
  const matches=placed.filter(item=>item.id===tree.cameraId);
  if(matches.length!==1 || matches[0].kind!=='camera')return;
  const session={snapshot:snapshotSceneCamera(),blend:activeCameraBlend,path:activeCameraPath,previousId:lastAppliedCameraItemId,levelIndex:currentLevelIndex,placedOwner:placed,revision:cameraOwnershipRevision};
  applyCameraPresetBlended(matches[0],0); // Explicit instant cut: simulation stays paused while reading.
  if(cameraOwnershipRevision===session.revision)return; // Failed acquisition retains the prior view.
  session.revision=cameraOwnershipRevision;conversationCameraSession=session;
}
function closeDialogue() {
  endConversationCamera();
  clearDialoguePresentation();
  document.getElementById('dialogue-overlay').classList.remove('visible');
  releaseGameplayScreenPause('dialogue');
  if (typeof OpusHudWidgets !== 'undefined') renderHudLayer();
}
function clearDialoguePresentation(discardCamera = false) {
  if(discardCamera)endConversationCamera(false); // Stop/Level reset owns its own restoration.
  dialoguePresentation = null;
  dialoguePresentationGeneration++;
  dialogueChoiceCallbacks.clear();
}
function chooseDialoguePresentation(generation, id) {
  if (!playMode || gameEnded) return false;
  if (!dialoguePresentation || dialoguePresentation.generation !== generation) return false;
  const callback = dialogueChoiceCallbacks.get(id);
  if (typeof callback !== 'function') return false;
  // Consume the entire displayed entry before effects or branch transitions.
  // Retained DOM handlers cannot replay a choice, including a choice that opens
  // a new entry. Presentation is transient and never part of authored data.
  dialogueChoiceCallbacks.clear();
  callback();
  return true;
}
function presentDialogue(speaker, text, choices) {
  clearDialoguePresentation();
  const generation = dialoguePresentationGeneration;
  dialoguePresentation = { active: true, generation, speaker: String(speaker || ''), text: String(text || ''), choices: [] };
  document.getElementById('dialogue-speaker').textContent = dialoguePresentation.speaker;
  document.getElementById('dialogue-text').textContent = dialoguePresentation.text;
  const choicesEl = document.getElementById('dialogue-choices');
  choicesEl.innerHTML = '';
  choices.forEach((choice, index) => {
    const id = `choice${index}`;
    const label = String(choice.label || 'Continue');
    dialoguePresentation.choices.push({ id, label });
    dialogueChoiceCallbacks.set(id, choice.choose);
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => chooseDialoguePresentation(generation, id);
    choicesEl.appendChild(btn);
  });
  document.getElementById('dialogue-overlay').classList.add('visible');
  acquireGameplayScreenPause('dialogue');
  if (typeof OpusHudWidgets !== 'undefined' && currentUiConfig.hudElements.some(element => element.kind === 'dialogueWidget' && element.visible !== false && OpusHudWidgets.dialogue(element.widget, {dialogue:dialoguePresentation}).available)) {
    document.getElementById('dialogue-overlay').classList.remove('visible');
    renderHudLayer();
  }
}
function showDialogue(p) {
  const choices = [];
  const addChoice = (label, flagName) => {
    choices.push({ label, choose: () => {
      if (flagName) { window.__gameFlags = window.__gameFlags || {}; window.__gameFlags[flagName] = true; }
      closeDialogue();
    } });
  };
  if (p.choice1Label) addChoice(p.choice1Label, p.choice1Flag);
  if (p.choice2Label) addChoice(p.choice2Label, p.choice2Flag);
  if (!p.choice1Label && !p.choice2Label) addChoice('Continue', null);
  presentDialogue(p.speaker, p.text, choices);
}

// --- Branching Dialogue (Wave 3 Dialogue upgrade) ---
// The Wave 2 `showDialogue` above retains its bounded semantics -- a real,
// working, still-useful bounded dialogue action for the common one-shot
// "speaker says a line, maybe two closing choices that set a flag" case.
// This is a SECOND, additive action (`dialogueTree`, not in ACTION_TYPES --
// same "outside the table" pattern 'graph' already uses) for when a scene
// wants an actual multi-line branching conversation: named entries, each
// with up to 3 choices, each choice optionally gated by a condition
// (reusing evaluateConditionNode -- the exact same leaf conditions the Node
// Graph already evaluates, not a second condition-evaluation system) and
// optionally jumping to another entry instead of always closing.
const DIALOGUE_CHOICE_CONDITIONS = {
  '': 'Always show',
  isFlagTrue: OpusAuthoringLanguage.conditionLabel('graph', 'isFlagTrue'),
  isFlagFalse: OpusAuthoringLanguage.conditionLabel('graph', 'isFlagFalse'),
  hasItem: OpusAuthoringLanguage.conditionLabel('graph', 'hasItem'),
  healthAtLeast: OpusAuthoringLanguage.conditionLabel('graph', 'healthAtLeast'),
  healthAtMost: OpusAuthoringLanguage.conditionLabel('graph', 'healthAtMost'),
  counterReaches: OpusAuthoringLanguage.conditionLabel('graph', 'counterReaches'),
  counterAtMost: OpusAuthoringLanguage.conditionLabel('graph', 'counterAtMost'),
  hasNamedItem: 'Has named Item',
  objectiveIsActive: 'Objective is active',
  objectiveIsComplete: 'Objective is complete',
};
let nextDialogueEntryId = 1;
function generateDialogueEntryId() { return `d${nextDialogueEntryId++}`; }
function reconcileDialogueEntryIdCounter(tree) {
  for (const entry of tree.entries || []) {
    const match = /^d(\d+)$/.exec(entry.id);
    if (match) nextDialogueEntryId = Math.max(nextDialogueEntryId, Number(match[1]) + 1);
  }
}
function defaultDialogueChoice() { return { label: '', next: '', setFlag: '', condition: null }; }
function defaultDialogueEntry() { return { id: generateDialogueEntryId(), speaker: '', text: '', choices: [defaultDialogueChoice()] }; }

let dialogueEditorState = null;
function openDialogueEditor(item, existingBehavior, newTrigger, newEventRef) {
  if (playMode || !item || !placed.includes(item) || placed.filter(o => o.id === item.id).length !== 1 || !Array.isArray(item.behaviors) || (existingBehavior && !item.behaviors.includes(existingBehavior))) { showStatus('Choose a current placed dialogue owner outside Play.'); return; }
  const tree = existingBehavior && existingBehavior.dialogueTree
    ? JSON.parse(JSON.stringify(existingBehavior.dialogueTree))
    : { entries: [defaultDialogueEntry()], startEntry: null };
  reconcileDialogueEntryIdCounter(tree);
  if (!existingBehavior && !tree.startEntry && tree.entries.length) tree.startEntry = tree.entries[0].id;
  dialogueEditorState = { item, existingBehavior, trigger: existingBehavior ? existingBehavior.trigger : newTrigger, eventRef: existingBehavior ? existingBehavior.eventRef : newEventRef, tree, levelIndex: currentLevelIndex, level: levels[currentLevelIndex], placedOwner: placed, behaviorsOwner: item.behaviors };
  document.getElementById('dialogue-editor-modal').classList.add('visible');
  renderDialogueEditor();
}
function closeDialogueEditor() {
  document.getElementById('dialogue-editor-modal').classList.remove('visible');
  dialogueEditorState = null;
}
function dialogueEditorOwnerCurrent(state) {
  return !!state && !playMode && state.levelIndex === currentLevelIndex && state.level === levels[currentLevelIndex] && state.placedOwner === placed && placed.includes(state.item) && placed.filter(o => o.id === state.item.id).length === 1 && state.behaviorsOwner === state.item.behaviors && (!state.existingBehavior || state.item.behaviors.includes(state.existingBehavior));
}
function dialogueEntryLabel(entry) {
  const text = String(entry.text || '').replace(/\s+/g, ' ').trim();
  return `${entry.speaker || '(no speaker)'}${text ? ' · ' + text.slice(0, 60) + (text.length > 60 ? '…' : '') : ''} — ${entry.id}`;
}
function dialogueEntryOptions(tree, currentValue, choice) {
  const current = currentValue || '';
  const entries = tree.entries;
  const known = entries.some(e => e.id === current);
  return `<option value=""${!current ? ' selected' : ''}>${choice ? '(close dialogue)' : 'Automatic — first entry'}</option>`
    + (current && !known ? `<option value="${escapeHtml(current)}" selected disabled>Unavailable saved entry — choose replacement</option>` : '')
    + entries.map(e => `<option value="${escapeHtml(e.id)}"${e.id === current ? ' selected' : ''}${entries.filter(x => x.id === e.id).length !== 1 ? ' disabled' : ''}>${escapeHtml(dialogueEntryLabel(e))}${entries.filter(x => x.id === e.id).length !== 1 ? ' · ambiguous entry' : ''}</option>`).join('');
}
function refreshDialogueEntryLabels(tree) {
  const list = document.getElementById('dialogue-entry-list');
  for (const select of [document.getElementById('dialogue-start-entry'), ...list.querySelectorAll('[data-choice-field="next"]')]) {
    for (const option of select.options) {
      const entry = tree.entries.find(e => e.id === option.value);
      if (entry) option.textContent = dialogueEntryLabel(entry) + (tree.entries.filter(e => e.id === entry.id).length !== 1 ? ' · ambiguous entry' : '');
    }
  }
}
function renderDialogueEditor() {
  const { tree } = dialogueEditorState;
  const startSel = document.getElementById('dialogue-start-entry');
  startSel.innerHTML = dialogueEntryOptions(tree, tree.startEntry, false);
  startSel.onchange = () => { tree.startEntry = startSel.value; };

  const nextOptions = (currentValue) => dialogueEntryOptions(tree, currentValue, true);

  const listEl = document.getElementById('dialogue-entry-list');
  listEl.innerHTML = tree.entries.map((entry, entryIndex) => `
    <div class="dialogue-entry-card" data-entry-id="${entry.id}">
      <div class="dialogue-entry-card-header">
        <span class="dialogue-entry-id">${entry.id}${tree.startEntry === entry.id ? ' · START' : ''}</span>
        <button class="dialogue-remove-btn" data-remove-entry="${entry.id}" title="Delete entry">✕ Delete Entry</button>
      </div>
      <label style="font-size:11px;color:#8592a8">Speaker</label>
      <input type="text" data-entry-field="speaker" placeholder="e.g. Old Sailor" value="${escapeHtml(entry.speaker || '')}">
      <label style="font-size:11px;color:#8592a8;display:block;margin-top:6px">Text</label>
      <textarea data-entry-field="text" placeholder="What they say" rows="2">${escapeHtml(entry.text || '')}</textarea>
      <label style="font-size:11px;color:#8592a8;display:block;margin-top:8px">Choices (shown as buttons; a choice with no condition always shows)</label>
      ${entry.choices.map((choice, choiceIndex) => `
        <div class="dialogue-choice-row" data-choice-index="${choiceIndex}">
          <div class="dialogue-choice-row-header">
            <span>Choice ${choiceIndex + 1}</span>
            <button class="dialogue-remove-btn" data-remove-choice="${choiceIndex}" title="Remove choice">✕</button>
          </div>
          <div class="dialogue-choice-grid">
            <input type="text" data-choice-field="label" placeholder="Button label (default: Continue)" value="${escapeHtml(choice.label || '')}">
            <select data-choice-field="next">${nextOptions(choice.next)}</select>
            <input type="text" data-choice-field="setFlag" placeholder="Sets flag (optional)" value="${escapeHtml(choice.setFlag || '')}">
            <select data-choice-field="conditionType">${choice.condition && !Object.prototype.hasOwnProperty.call(DIALOGUE_CHOICE_CONDITIONS,choice.condition.type) ? `<option value="${escapeHtml(choice.condition.type || '')}" selected disabled>Unavailable saved condition — choose replacement</option>` : ''}${Object.entries(DIALOGUE_CHOICE_CONDITIONS).map(([type, label]) => `<option value="${type}"${(choice.condition ? choice.condition.type : '') === type ? ' selected' : ''}>${label}</option>`).join('')}</select>
          </div>
          ${choice.condition && ['hasNamedItem','objectiveIsActive','objectiveIsComplete'].includes(choice.condition.type) ? dialogueChoiceCompositionFields(choice.condition.type, choice.condition, 'condition') : choice.condition ? `
          <div class="dialogue-choice-grid" style="margin-top:6px">
            <input type="text" data-choice-field="conditionName" placeholder="${choice.condition.type === 'hasItem' ? 'Item name' : choice.condition.type.startsWith('health') ? '(health, no name needed)' : 'Counter/Flag name'}" value="${escapeHtml(choice.condition.name || '')}"${choice.condition.type.startsWith('health') ? ' disabled' : ''}>
            ${choice.condition.type !== 'isFlagTrue' && choice.condition.type !== 'isFlagFalse' ? `<input type="number" data-choice-field="conditionValue" placeholder="Value" value="${choice.condition.value ?? (choice.condition.type === 'hasItem' ? 1 : 0)}">` : '<span></span>'}
          </div>` : ''}
          <div class="field-row"><label>Choice effect</label><select data-choice-field="effectType"><option value="">No effect</option>${choice.effect && !dialogueChoiceEffectAllowed(choice.effect.action) ? '<option selected disabled>Unavailable saved effect — choose replacement</option>' : ''}${['grantItem','activateObjective','completeObjective','failObjective'].map(type=>`<option value="${type}"${choice.effect?.action===type?' selected':''}>${escapeHtml(ACTION_TYPES[type].label)}</option>`).join('')}</select></div>
          ${choice.effect && dialogueChoiceEffectAllowed(choice.effect.action) ? dialogueChoiceCompositionFields(choice.effect.action, choice.effect.params || {}, 'effect') : ''}
          <p class="field-help">The optional legacy flag is set first, then the effect, then Next. Item capacity refusal still follows Next; this is not a transaction. Reopening the conversation can repeat its effect.</p>
        </div>
      `).join('')}
      <button class="dialogue-add-choice-btn" data-add-choice="${entry.id}">+ Add Choice</button>
    </div>
  `).join('');
  listEl.insertAdjacentHTML?.('afterbegin',`<div class="field-row"><label>Conversation camera</label>${dialogueConversationCameraField(tree.cameraId)}<p class="field-help">Optional named shot: instant cut while gameplay is paused. Closing restores the prior view unless a newer camera took ownership. No automatic framing or moving cinematic.</p></div>`);
  listEl.querySelectorAll('[data-dialogue-camera]').forEach(el=>el.addEventListener('change',()=>{if(el.value)tree.cameraId=el.value;else delete tree.cameraId;}));

  listEl.querySelectorAll('[data-entry-field]').forEach((el) => {
    const entryId = el.closest('.dialogue-entry-card').dataset.entryId;
    el.addEventListener('input', () => {
      const entry = tree.entries.find((e) => e.id === entryId);
      entry[el.dataset.entryField] = el.value;
      refreshDialogueEntryLabels(tree); // Keep the active typing field/caret; refresh only navigation labels.
    });
  });
  listEl.querySelectorAll('[data-choice-field]').forEach((el) => {
    const card = el.closest('.dialogue-entry-card');
    const entryId = card.dataset.entryId;
    const choiceIndex = Number(el.closest('.dialogue-choice-row').dataset.choiceIndex);
    el.addEventListener('input', () => applyDialogueChoiceField(tree, entryId, choiceIndex, el));
    el.addEventListener('change', () => applyDialogueChoiceField(tree, entryId, choiceIndex, el));
  });
  listEl.querySelectorAll('[data-dialogue-composition] [data-field]').forEach(el => {
    el.addEventListener('change', () => {
      const row=el.closest('.dialogue-choice-row'),entry=tree.entries.find(e=>e.id===el.closest('.dialogue-entry-card').dataset.entryId),choice=entry.choices[Number(row.dataset.choiceIndex)],kind=el.closest('[data-dialogue-composition]').dataset.dialogueComposition;
      const type=kind==='condition'?choice.condition.type:choice.effect.action,record=kind==='condition'?choice.condition:choice.effect.params;
      const field=(kind==='condition'?GRAPH_NODE_TYPES[type]:ACTION_TYPES[type]).fields.find(f=>f.key===el.dataset.field);
      record[field.key]=field.type==='number'?Number(el.value):el.value;
    });
  });
  listEl.querySelectorAll('[data-add-choice]').forEach((btn) => {
    btn.onclick = () => {
      const entry = tree.entries.find((e) => e.id === btn.dataset.addChoice);
      if (entry.choices.length >= 3) return; // bounded, same spirit as the Wave 2 action's fixed 2-choice cap, just one wider
      entry.choices.push(defaultDialogueChoice());
      renderDialogueEditor();
    };
  });
  listEl.querySelectorAll('[data-remove-choice]').forEach((btn) => {
    btn.onclick = () => {
      const entryId = btn.closest('.dialogue-entry-card').dataset.entryId;
      const entry = tree.entries.find((e) => e.id === entryId);
      entry.choices.splice(Number(btn.dataset.removeChoice), 1);
      renderDialogueEditor();
    };
  });
  listEl.querySelectorAll('[data-remove-entry]').forEach((btn) => {
    btn.onclick = () => {
      if (tree.entries.length <= 1) { showStatus('A dialogue needs at least one entry.'); return; }
      const removedId = btn.dataset.removeEntry;
      tree.entries = tree.entries.filter((e) => e.id !== removedId);
      // Any choice that pointed at the removed entry now closes the dialogue
      // instead of jumping to a dangling id -- simpler and safer than
      // forcing the author to fix every referencing choice before deleting.
      for (const entry of tree.entries) for (const choice of entry.choices) if (choice.next === removedId) choice.next = '';
      if (tree.startEntry === removedId) tree.startEntry = tree.entries[0].id;
      renderDialogueEditor();
    };
  });
}
function applyDialogueChoiceField(tree, entryId, choiceIndex, el) {
  const entry = tree.entries.find((e) => e.id === entryId);
  const choice = entry.choices[choiceIndex];
  const field = el.dataset.choiceField;
  if (field === 'conditionType') {
    choice.condition = el.value ? ['hasNamedItem','objectiveIsActive','objectiveIsComplete'].includes(el.value) ? {type:el.value,...dialogueCompositionDefaults(GRAPH_NODE_TYPES[el.value])} : { type: el.value, name: '', value: el.value === 'hasItem' ? 1 : 0 } : null;
    renderDialogueEditor();
    return;
  }
  if (field === 'effectType') {
    if (el.value && !dialogueChoiceEffectAllowed(el.value)) return;
    choice.effect=el.value?{action:el.value,params:dialogueCompositionDefaults(ACTION_TYPES[el.value])}:null;
    renderDialogueEditor();return;
  }
  if (field === 'conditionName') { choice.condition.name = el.value; return; }
  if (field === 'conditionValue') { choice.condition.value = parseFloat(el.value) || 0; return; }
  choice[field] = el.value;
}
function dialogueCompositionDefaults(definition) {
  return Object.fromEntries((definition?.fields || []).map(field=>[field.key,field.default ?? (field.type==='number'?1:'')]));
}
function dialogueChoiceCompositionFields(type, values, kind) {
  const definition=kind==='condition'?GRAPH_NODE_TYPES[type]:ACTION_TYPES[type];
  return `<div data-dialogue-composition="${kind}">${definition.fields.map(field=>`<div class="field-row"><label>${escapeHtml(field.label || field.key)}</label>${renderActionFieldInput(field,values[field.key],undefined,values,dialogueEditorState.item)}</div>`).join('')}</div>`;
}
function dialogueCompositionIssue(tree) {
  if (tree.cameraId && (placed.filter(item=>item.id===tree.cameraId).length!==1 || placed.find(item=>item.id===tree.cameraId)?.kind!=='camera')) return 'Choose an available Conversation Camera or Keep gameplay camera.';
  for (const entry of tree.entries || []) for (const choice of entry.choices || []) {
    const condition=choice.condition,effect=choice.effect;
    if (condition?.type==='hasNamedItem' && (!dialogueDefinitionAvailable('item',condition.itemId) || !Number.isSafeInteger(condition.count) || condition.count<1)) return 'Choose an available named Item and positive whole quantity for the dialogue condition.';
    if (['objectiveIsActive','objectiveIsComplete'].includes(condition?.type) && !dialogueDefinitionAvailable('objective',condition.objectiveId)) return 'Choose an available Objective for the dialogue condition.';
    if (effect && dialogueChoiceEffectAllowed(effect.action)) {
      if (effect.action==='grantItem' && (!dialogueDefinitionAvailable('item',effect.params?.itemId) || !Number.isSafeInteger(effect.params?.count) || effect.params.count<1 || effect.params.count>1000)) return 'Choose an available reward Item and whole quantity from 1 to 1000.';
      if (effect.action!=='grantItem' && !dialogueDefinitionAvailable('objective',effect.params?.objectiveId)) return 'Choose an available Objective for the dialogue effect.';
    }
  }
  return '';
}
document.getElementById('dialogue-add-entry-btn').addEventListener('click', () => {
  dialogueEditorState.tree.entries.push(defaultDialogueEntry());
  renderDialogueEditor();
});
document.getElementById('dialogue-editor-cancel-btn').addEventListener('click', closeDialogueEditor);
document.getElementById('dialogue-editor-save-btn').addEventListener('click', () => {
  if (!dialogueEditorOwnerCurrent(dialogueEditorState)) { showStatus('Dialogue owner or Level changed. Cancel and reopen outside Play.'); return; }
  const { item, existingBehavior, trigger, eventRef, tree } = dialogueEditorState;
  const compositionIssue=dialogueCompositionIssue(tree);if(compositionIssue){showStatus(compositionIssue);return;}
  if(trigger==='controllerStateEvent'){const issue=controllerStateEventAuthoringIssue(eventRef);if(issue){showStatus(issue);return;}}
  if (existingBehavior && JSON.stringify(existingBehavior.dialogueTree) === JSON.stringify(tree) && JSON.stringify(existingBehavior.eventRef) === JSON.stringify(eventRef)) { closeDialogueEditor(); return; }
  const committedTree = JSON.parse(JSON.stringify(tree));
  pushUndo();
  if (existingBehavior) existingBehavior.dialogueTree = committedTree;
  else item.behaviors.push({ trigger, action: 'dialogueTree', dialogueTree: committedTree, eventRef: ['spriteAnimationEvent','signal','controllerStateEvent'].includes(trigger) ? eventRef : undefined });
  closeDialogueEditor();
  renderBehaviorList(item);
});

// Translates a dialogue-choice condition (a plain {type, name, value}
// object authored in the editor above) into the shape evaluateConditionNode
// already expects from a Node Graph condition node, and evaluates it with
// no `graph` context -- safe because dialogue conditions are deliberately
// restricted to LEAF condition types (no and/or/not nesting, which are the
// only branches that ever read the second argument).
function evaluateDialogueCondition(condition) {
  if (!condition) return true;
  if (condition.type==='hasNamedItem' && !dialogueDefinitionAvailable('item',condition.itemId)) return false;
  if (['objectiveIsActive','objectiveIsComplete'].includes(condition.type) && !dialogueDefinitionAvailable('objective',condition.objectiveId)) return false;
  const node = { type: condition.type, name: condition.name, counter: condition.name, target: condition.value, count: condition.type === 'hasNamedItem' ? condition.count : condition.value, itemId: condition.itemId, objectiveId: condition.objectiveId };
  return evaluateConditionNode(node, null);
}
function dialogueDefinitionAvailable(kind,id) {
  if (typeof id!=='string' || !id || ['__proto__','constructor','prototype'].includes(id)) return false;
  const definitions=kind==='item'?currentItemDefs:currentObjectiveDefs;
  return Array.isArray(definitions) && definitions.filter(def=>def?.id===id).length===1;
}
function dialogueChoiceEffectAllowed(action) {
  return ['grantItem', 'activateObjective', 'completeObjective', 'failObjective'].includes(action);
}
function runDialogueEntry(tree, entryId, owner) {
  const entry = tree.entries.find((e) => e.id === entryId);
  if (!entry) { closeDialogue(); return; }
  const choices = [];
  const visibleChoices = (entry.choices || []).filter((c) => evaluateDialogueCondition(c.condition));
  const addChoice = (label, choice) => {
    choices.push({ label, choose: () => {
      if (choice.setFlag) { window.__gameFlags = window.__gameFlags || {}; window.__gameFlags[choice.setFlag] = true; }
      // Presentation consumes its callback before reaching here. Preserve the
      // legacy flag first, then one canonical effect, then navigation. Refusal
      // (for example full inventory) does not imply a transaction or rewind.
      if (choice.effect && dialogueChoiceEffectAllowed(choice.effect.action) && dialogueDefinitionAvailable(choice.effect.action==='grantItem'?'item':'objective',choice.effect.params?.[choice.effect.action==='grantItem'?'itemId':'objectiveId'])) executeAction(choice.effect.action, choice.effect.params || {}, owner);
      if (choice.next) runDialogueEntry(tree, choice.next, owner);
      else closeDialogue();
    } });
  };
  if (visibleChoices.length === 0) addChoice('Continue', {});
  else visibleChoices.forEach((c) => addChoice(c.label || 'Continue', c));
  presentDialogue(entry.speaker, entry.text, choices);
}
function runDialogueTree(tree, owner) {
  if (!tree || !tree.entries || tree.entries.length === 0) return;
  beginConversationCamera(tree);
  runDialogueEntry(tree, tree.startEntry || tree.entries[0].id, owner);
}
function dialogueConversationCameraField(value) {
  if(!value&&!placed.some(item=>item.kind==='camera'))return '<select data-dialogue-camera><option value="">Keep gameplay camera — add a Camera to choose a shot</option></select>';
  return renderActionFieldInput({key:'cameraId',type:'cameraPreset'},value).replace('data-field="cameraId"','data-dialogue-camera').replace(/Choose Camera preset|Add Camera or 2D Camera from the palette/g,'Keep gameplay camera (no shot)');
}

const TRIGGER_LABELS = Object.fromEntries(OpusAuthoringLanguage.EVENTS.map((event) => [event.id, event.label]));
// Action labels come from ACTION_TYPES (the shared action-execution core,
// above) rather than a second hand-maintained label map; 'graph' is the one
// action outside that table, since it opens its own editor instead of
// executing through executeAction directly.
function actionLabel(action) {
  return OpusAuthoringLanguage.logicActionLabel(action, ACTION_TYPES);
}

function behaviorPreview(b) {
  if (typeof b.action === 'string' && b.action.startsWith('custom_') && !Object.prototype.hasOwnProperty.call(ACTION_TYPES,b.action)) return ': Unavailable host Action; install its trusted implementation separately. Saved parameters retained.';
  if ((b.action === 'message' || b.action === 'objective') && b.param) return `: "${escapeHtml(b.param)}"`;
  if (b.action === 'boost' && b.param) return `: force ${escapeHtml(b.param)}`;
  if (b.action === 'script' && b.param) {
    const oneLine = b.param.replace(/\s+/g, ' ').trim();
    return `: <code>${escapeHtml(oneLine.slice(0, 40))}${oneLine.length > 40 ? '…' : ''}</code>`;
  }
  if (b.action === 'graph' && b.graph) return `: ${b.graph.nodes.length} node${b.graph.nodes.length === 1 ? '' : 's'}`;
  if (b.action === 'dialogueTree' && b.dialogueTree) return `: ${b.dialogueTree.entries.length} entr${b.dialogueTree.entries.length === 1 ? 'y' : 'ies'}`;
  if (b.params) {
    const def = ACTION_TYPES[b.action];
    const parts = [];
    if (b.params.targetId) {
      const targetItem = findItemById(b.params.targetId);
      parts.push(`target: ${targetItem ? itemDisplayName(targetItem, placed.indexOf(targetItem)) : '(deleted)'}`);
    }
    for (const f of (def ? def.fields : [])) {
      if (f.key === 'targetId') continue;
      if (b.params[f.key] !== undefined && b.params[f.key] !== '') parts.push(`${f.key}: ${b.params[f.key]}`);
    }
    return parts.length ? `: ${escapeHtml(parts.join(', '))}` : '';
  }
  return '';
}
function spriteAnimationEventSourceOptions(value) {
  const current = value || {}; const sprites = placed.filter((item) => item.kind === 'sprite' && item.components && item.components['sprite-renderer']);
  const target = sprites.find((item) => item.id === current.targetId) || sprites[0];
  const states = target ? OpusAuthoringPlumbing.normalizeSpriteAnimationStates(target.components['sprite-renderer'].animationStates) : [];
  const clipIds = [...new Set(states.flatMap((state) => [state.clipRef, ...state.directionalVariants.map((variant) => variant.clipRef)]).filter(Boolean))]; const clips = clipIds.map(findSpriteAnimationById).filter(Boolean);
  const clip = clips.find((entry) => entry.id === current.clipId) || clips[0]; const events = OpusAuthoringPlumbing.spriteAnimationEvents(clip);
  return { target, clip, events, html: `<div class="field-row"><label>Sprite Object</label><select data-sprite-event-target><option value="">Select Sprite Object…</option>${sprites.map((item) => `<option value="${escapeHtml(item.id)}"${target && item.id === target.id ? ' selected' : ''}>${escapeHtml(itemDisplayName(item, placed.indexOf(item)))}</option>`).join('')}</select></div><div class="field-row"><label>Animation Clip</label><select data-sprite-event-clip><option value="">Select Clip…</option>${clips.map((entry) => `<option value="${escapeHtml(entry.id)}"${clip && entry.id === clip.id ? ' selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></div><div class="field-row"><label>Animation Event</label><select data-sprite-event-id><option value="">Select Event…</option>${events.map((event) => `<option value="${escapeHtml(event.id)}"${event.id === current.eventId ? ' selected' : ''}>${escapeHtml(event.name)} (Frame ${event.frameIndex + 1})</option>`).join('')}</select><div class="field-help">Stable IDs are stored; names are shown. This source matches one Sprite instance only.</div></div>` };
}
function readSpriteAnimationEventSource(host) { if (!host) return null; return { targetId: host.querySelector('[data-sprite-event-target]')?.value || '', clipId: host.querySelector('[data-sprite-event-clip]')?.value || '', eventId: host.querySelector('[data-sprite-event-id]')?.value || '' }; }

function controllerStateEventPlayerInfo() {
  const settings=currentPlayerSettings||{},mode=settings.controllerType;
  const labels={firstperson:'First-person',thirdperson:'Third-person',topdown:'Top-down 3D (XZ)',hovercraft:'Hovercraft',platformer2d:'Platformer 2D (XY)',topdown2d:'Top-down 2D (XY)'};
  if(!labels[mode])return {available:false,vertical:false,label:'Unavailable Player',reason:'Choose an available controller in Player settings.'};
  let label=labels[mode];
  if(mode==='platformer2d'||mode==='topdown2d') {
    const id=settings[mode==='platformer2d'?'platformerObjectRef':'topdownObjectRef'];
    const matches=placed.filter(item=>item.id===id&&item.kind==='sprite');
    if(matches.length!==1)return {available:false,vertical:false,label:label+' — unavailable Sprite',reason:'Choose one named Player Sprite in Player settings.'};
    label+=' — '+itemDisplayName(matches[0],placed.indexOf(matches[0]));
    const owned=mode==='platformer2d'?platformerPlayerObject():topdownPlayerObject();
    if(owned!==matches[0])return {available:false,vertical:false,label,reason:'Repair the named Player Sprite’s enabled controller, collision dependencies and Input Actions in Player settings before adding a transition.'};
  }
  return {available:true,vertical:mode==='platformer2d'||mode==='firstperson'||(mode==='thirdperson'&&settings.jumpEnabled===true),label};
}
function controllerStateEventAuthoringIssue(ref) {
  if(!ref||typeof ref!=='object'||Array.isArray(ref)||ref.source!=='levelPlayer'||!['moving','idle','airborne','landed'].includes(ref.state))return 'On Controller State needs This level’s Player and a supported state; saved unknown sources and states remain inert.';
  const info=controllerStateEventPlayerInfo();
  if(!info.available)return info.reason;
  if((ref.state==='airborne'||ref.state==='landed')&&!info.vertical)return 'This Player has no vertical grounding. Choose Moving or Idle, or configure a vertically grounded Player.';
  return '';
}
function controllerStateEventSourceOptions(value) {
  const current=value===undefined?{source:'levelPlayer',state:'moving'}:value||{},info=controllerStateEventPlayerInfo();
  const states=[['moving','Moving'],['idle','Idle'],['airborne','Airborne'],['landed','Landed']];
  const sourceKnown=current.source==='levelPlayer',stateKnown=states.some(([id])=>id===current.state);
  return {info,html:`<div class="field-row"><label>Controller source</label><select data-controller-event-source><option value="levelPlayer"${sourceKnown?' selected':''}>${escapeHtml('This level’s Player — '+info.label)}</option>${!sourceKnown?`<option value="${escapeHtml(current.source||'')}" selected>Unavailable saved source</option>`:''}</select></div><div class="field-row"><label>Enter state</label><select data-controller-event-state>${states.map(([id,label])=>`<option value="${id}"${current.state===id?' selected':''}${(id==='airborne'||id==='landed')&&!info.vertical?' disabled':''}>${label}${(id==='airborne'||id==='landed')&&!info.vertical?' — no vertical grounding':''}</option>`).join('')}${!stateKnown?`<option value="${escapeHtml(current.state||'')}" selected>Unavailable saved state</option>`:''}</select><div class="field-help">One reaction per transition, after collision. Moving uses actual planar motion, including carry; gravity alone is not movement. Airborne includes walking off an edge, not only jumping.</div><div data-controller-event-status>${escapeHtml(controllerStateEventAuthoringIssue(current))}</div></div>`};
}
function readControllerStateEventSource(host) { return {source:host?.querySelector('[data-controller-event-source]')?.value||'',state:host?.querySelector('[data-controller-event-state]')?.value||''}; }

function renderBehaviorList(item) {
  const el = document.getElementById('behavior-list');
  if (!el) return;
  if (item.behaviors.length === 0) {
    el.innerHTML = '<div class="onboarding-empty">No Behaviors yet. Use Add Behavior below for one event/action, or Apply Gameplay Preset for a ready gameplay role.</div>';
    return;
  }
  el.innerHTML = item.behaviors.map((b, i) => {
    const eventSource = b.trigger==='signal'?` [${escapeHtml(OpusSignals.find(signalDefinitions,b.eventRef?.signalId)?.name||'Missing or ambiguous Signal')}]`:b.trigger === 'spriteAnimationEvent' && b.eventRef ? ` [${escapeHtml((findSpriteAnimationById(b.eventRef.clipId) || {}).name || 'Missing Clip')} / ${escapeHtml(((OpusAuthoringPlumbing.spriteAnimationEvents(findSpriteAnimationById(b.eventRef.clipId))).find((event) => event.id === b.eventRef.eventId) || {}).name || 'Missing Event')}]` : '';
    const controllerSource=b.trigger==='controllerStateEvent'?` [${escapeHtml('This level’s Player — '+controllerStateEventPlayerInfo().label)} / ${escapeHtml(b.eventRef?.state||'Unavailable saved state')}${controllerStateEventAuthoringIssue(b.eventRef)?' · needs repair':''}]`:'';
    const summary = `${TRIGGER_LABELS[b.trigger]}${eventSource}${controllerSource} → ${actionLabel(b.action)}${behaviorPreview(b)}`;
    return `
    <div class="behavior-item${b.action === 'script' ? ' script-behavior' : ''}">
      <span title="${escapeHtml(summary)}">${summary}</span>
      <span>${b.action === 'graph' ? `<button data-edit-index="${i}" title="Edit graph">✎</button>` : ''}${b.action === 'dialogueTree' ? `<button data-edit-dialogue-index="${i}" title="Edit dialogue">✎</button>` : ''}<button data-index="${i}">✕</button></span>
    </div>
  `;
  }).join('');
  el.querySelectorAll('button[data-index]').forEach((btn) => {
    btn.onclick = () => {
      pushUndo();
      item.behaviors.splice(Number(btn.dataset.index), 1);
      renderBehaviorList(item);
    };
  });
  el.querySelectorAll('button[data-edit-index]').forEach((btn) => {
    btn.onclick = () => {
      const behavior = item.behaviors[Number(btn.dataset.editIndex)];
      openGraphEditor(item, behavior);
    };
  });
  el.querySelectorAll('button[data-edit-dialogue-index]').forEach((btn) => {
    btn.onclick = () => {
      const behavior = item.behaviors[Number(btn.dataset.editDialogueIndex)];
      openDialogueEditor(item, behavior);
    };
  });
}

