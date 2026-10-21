// Phase 005: creator labels and metadata are layered onto the stable action
// keys. Saved projects continue to serialize the original ACTION_TYPES key.
OpusAuthoringLanguage.enrichActions(ACTION_TYPES);

function changeObjectiveState(id,state,owner) {
  if(!id)return null;
  window.__gameObjectives=window.__gameObjectives||{};
  const changed=window.__gameObjectives[id]!==state;window.__gameObjectives[id]=state;
  const definition=findObjectiveDefById(id),signalId=definition?.signals?.[state];
  if(changed&&typeof signalId==='string'&&signalId&&!signalRuntime.emit(signalId,undefined,owner))showToast('Objective updated, but its notification was not sent. Choose an available no-value Signal with matching channel context.');
  return definition;
}
function executeAction(actionType, params, item) {
  const def = Object.prototype.hasOwnProperty.call(ACTION_TYPES, actionType) ? ACTION_TYPES[actionType] : null;
  if (!def) { if (typeof actionType === 'string' && actionType.startsWith('custom_')) showToast('Unavailable custom Action: ' + actionType + '. Install its trusted host extension; saved parameters are retained.'); return; }
  def.exec(params || {}, item);
}

// Reads a behavior record back into the flat params object executeAction
// expects, regardless of which of the two persisted shapes (legacy `.param`
// string vs. newer `.params` object) it was saved in.
function behaviorParams(behavior, def = {}) {
  if (behavior.params) return behavior.params;
  if (def.legacy && def.legacyParam) return { [def.legacyParam]: behavior.param };
  return {};
}

function visitAuthoredActions(project, visitor) {
  const scan = (type, params, location) => { if (type) visitor(type, params || {}, location || {}); };
  for (const level of project.levels || []) {
    for (const sequence of Array.isArray(level.sequences)?level.sequences:[]) for (const step of Array.isArray(sequence?.steps)?sequence.steps:[]) if (step && typeof step === 'object' && !Array.isArray(step) && step.kind !== 'delay') scan(step.actionType || step.action, step.params, { levelId: level.id, sequenceId: sequence.id });
    for (const record of level.objects || []) {
      for (const [behaviorIndex, behavior] of (record.behaviors || []).entries()) {
        if (behavior.action === 'graph' && behavior.graph) for (const node of behavior.graph.nodes || []) scan(node.type, node, { levelId: level.id, objectId: record.id, ownerObjectId: record.id, behaviorIndex, graphNodeId: node.id });
        else if (behavior.action === 'dialogueTree') {
          if(behavior.dialogueTree?.cameraId)scan('changeCamera',behavior.dialogueTree,{levelId:level.id,objectId:record.id,ownerObjectId:record.id,dialogueCamera:true});
          for (const entry of behavior.dialogueTree?.entries || []) for (const choice of entry?.choices || []) {
            const location={levelId:level.id,objectId:record.id,ownerObjectId:record.id,dialogueEntryId:entry.id};
            if (choice?.condition) scan(choice.condition.type,choice.condition,location);
            if (choice?.effect && dialogueChoiceEffectAllowed(choice.effect.action)) scan(choice.effect.action,choice.effect.params,location);
          }
        }
        else scan(behavior.action, behaviorParams(behavior, ACTION_TYPES[behavior.action] || {}), { levelId: level.id, objectId: record.id, ownerObjectId: record.id });
      }
    }
  }
}
function countSpriteAnimationStateActionUses(targetId, stateId) {
  let count = 0;
  visitAuthoredActions(serializeProject(), (type, params, location) => {
    if (type === 'setSpriteAnimationState' && (params.targetId || location.ownerObjectId) === targetId && params.stateId === stateId) count++;
  });
  return count;
}

// Renders one form field for an action param -- shared by the Node Graph
// node UI and the fixed dropdown's Add Behavior UI so a new field TYPE only
// needs handling written once.
function signalPayloadFieldType(id){return ({number:'number',text:'text',boolean:'checkbox',object:'target',color:'color'})[OpusSignals.payloadType(OpusSignals.find(signalDefinitions,id))];}
function signalPayloadDefault(id){return ({number:0,text:'',boolean:false,object:'',color:'#ffffff'})[OpusSignals.payloadType(OpusSignals.find(signalDefinitions,id))];}
function readActionFieldValue(field,input){if(field.cameraShakeScalar)return input.value.trim()?Number(input.value):undefined;if(['signalPayload','comparisonValue'].includes(field.type))return input.type==='checkbox'?input.checked:input.type==='number'?input.valueAsNumber:input.value;return field.type==='checkbox'?input.checked:field.type==='number'?(parseFloat(input.value)||0):input.value;}
function bindLevelLogicHistory(input,readCurrent,readNext,write,eventName='input',validNext=()=>true) {
  let captured=false;
  input.addEventListener('focus',()=>{captured=false;});input.addEventListener('blur',()=>{captured=false;});
  input.addEventListener(eventName,()=>{const value=readNext();if(!validNext(value)||Object.is(readCurrent(),value))return;if(eventName==='change'||!captured){pushUndo();captured=true;}write(value);});
}
// Suggestions only: legacy named state remains exact, case-sensitive text.
// Never rewrite names or infer a declaration/rename relationship.
let stateKeyHintSerial = 0;
function stateKeyFieldKind(field) {
  if(field?.type!=='text')return null;
  const kinds={'Flag name':'flag','Counter name':'counter','Timer name':'timer'};
  return Object.prototype.hasOwnProperty.call(kinds,field.label)?kinds[field.label]:null;
}
function collectStateKeyHints(roots, kind) {
  const names=new Set(),seen=new Set(),stack=[roots];let scanned=0,truncated=false;
  const own=(object,key)=>{const d=object&&typeof object==='object'?Object.getOwnPropertyDescriptor(object,key):null;return d&&Object.prototype.hasOwnProperty.call(d,'value')?d.value:undefined;};
  while(stack.length){
    if(scanned++>=4096){truncated=true;break;}
    const record=stack.pop();if(!record||typeof record!=='object'||seen.has(record))continue;seen.add(record);
    const id=own(record,'action')||own(record,'actionType')||own(record,'type');
    const definition=typeof id==='string'&&(Object.prototype.hasOwnProperty.call(ACTION_TYPES,id)?ACTION_TYPES[id]:Object.prototype.hasOwnProperty.call(CONDITION_TYPES,id)?CONDITION_TYPES[id]:null);
    const params=own(record,'params'),values=params&&typeof params==='object'&&!Array.isArray(params)?params:record;
    for(const field of definition?.fields||[]){if(stateKeyFieldKind(field)!==kind)continue;const name=own(values,field.key);if(typeof name==='string'&&name.length&&name.length<=128){if(names.size<64||names.has(name))names.add(name);else truncated=true;}}
    const keys=Object.keys(record);if(keys.length>4096)truncated=true;
    for(const key of keys.slice(0,4096)){const child=own(record,key);if(child&&typeof child==='object'){if(stack.length<4096)stack.push(child);else truncated=true;}}
  }
  return {names:[...names].sort(),truncated};
}
function stateKeyFieldHTML(field,value,idAttr) {
  const kind=stateKeyFieldKind(field);if(!kind)return null;
  const roots=[placed.map(item=>item.behaviors),currentSequences,typeof graphEditorState==='object'?graphEditorState?.graph:null];
  const hints=collectStateKeyHints(roots,kind),id='state-key-hints-'+(++stateKeyHintSerial),note=id+'-note';
  return `<input type="text" data-field="${escapeHtml(field.key)}"${idAttr?' id="'+escapeHtml(idAttr)+'"':''} value="${escapeHtml(value??'')}" placeholder="${escapeHtml(field.placeholder||'')}" list="${id}" aria-describedby="${note}" autocomplete="off"><datalist id="${id}">${hints.names.map(name=>`<option value="${escapeHtml(name)}"></option>`).join('')}</datalist><small id="${note}" class="field-help">${hints.names.length?'Reuse a name, or type a new one.':'Type a new name.'} Suggestions cover current-level Behaviors, Sequences and the open Graph only${hints.truncated?' (list limited)':''}. Names are case-sensitive text; changing one does not rename other uses.</small>`;
}
function renderActionFieldInput(f, value, idAttr, values, contextItem) {
  const stateKeyHTML=typeof stateKeyFieldHTML==='function'?stateKeyFieldHTML(f,value,idAttr):null;
  if(stateKeyHTML!==null)return stateKeyHTML;
  if(f.type==='inputContextRef') return inputContextChoiceHTML(value,'data-field="'+escapeHtml(f.key)+'"'+(idAttr?' id="'+escapeHtml(idAttr)+'"':''));
  if(f.type==='inputActionRef') {
    const labels=inputActionLabels(),available=Object.prototype.hasOwnProperty.call(labels,value);
    return `<select data-field="${escapeHtml(f.key)}"${idAttr?' id="'+escapeHtml(idAttr)+'"':''}><option value="">Choose Input Action</option>${value&&!available?`<option value="${escapeHtml(value)}" selected disabled>Unavailable saved Input Action</option>`:''}${Object.entries(labels).map(([id,label])=>`<option value="${escapeHtml(id)}"${id===value?' selected':''}>${escapeHtml(label)}</option>`).join('')}</select>`;
  }
  if(f.type==='menuPageRef'){
    const pages=availableMenuPages(),present=pages.some(page=>page.id===value);
    return `<select data-field="${escapeHtml(f.key)}"${idAttr?' id="'+escapeHtml(idAttr)+'"':''}><option value="">Choose Menu Page</option>${value&&!present?`<option value="${escapeHtml(value)}" selected disabled>Unavailable saved Menu Page</option>`:''}${pages.map(page=>`<option value="${escapeHtml(page.id)}"${page.id===value?' selected':''}>${escapeHtml(page.title||'Untitled Menu')}</option>`).join('')}</select>`;
  }
  if(f.type==='signalRef')return signalChoiceHTML(value,'data-field="'+f.key+'"'+(idAttr?' id="'+idAttr+'"':''));
  if(f.type==='signalPayload'){const type=signalPayloadFieldType(values?.signalId);if(!type)return '<small>No value for this Signal. Declare a value type in Project to send one.</small>';const declared=OpusSignals.payloadType(OpusSignals.find(signalDefinitions,values?.signalId)),defaults={number:0,text:'',boolean:false,object:'',color:'#ffffff'};const valid=value===undefined||OpusSignals.accepts(declared,value)||(declared==='object'&&value==='');return renderActionFieldInput({...f,type},valid?(value===undefined?defaults[declared]:value):value,idAttr,values,contextItem)+(valid?'':'<small>Saved value does not match the declared Signal type. Choose a replacement.</small>');}
  if(f.type==='comparisonValue'){const declared=values?.valueType||'number',type=({number:'number',text:'text',boolean:'checkbox',object:'target',color:'color'})[declared];if(!type)return '<small>Choose a supported comparison type.</small>';const valid=value===undefined||OpusGraphValues.matches(declared,value)||(declared==='object'&&value==='');return renderActionFieldInput({...f,type},value===undefined?({number:0,text:'',boolean:false,object:'',color:'#ffffff'})[declared]:value,idAttr,values,contextItem)+(valid?'':'<small>Saved value has a different type. Replace it; no automatic conversion.</small>');}
  const idPart = idAttr ? ` id="${idAttr}"` : '';
  const referenceContext = () => ({
    objects: placed, levels, objectives: currentObjectiveDefs, prefabs,
    assets, textures: textureAssets, sprites: spriteAssets, spriteAnimations: spriteAnimationClips, audio: audioAssets,
    currentObjectId: selectedItem && selectedItem.id,
    currentLevelId: levels[currentLevelIndex] && levels[currentLevelIndex].id,
  });
  const referenceSelect = (type, descriptor, emptyLabel) => {
    const choices = OpusAuthoringPlumbing.getReferenceOptions(type, referenceContext(), descriptor);
    const retained = type === 'object' && value !== undefined && value !== null && value !== '' && !choices.some(option => option.value === value);
    const unavailable = retained ? `<option value="${escapeHtml(typeof value === 'string' ? value : '__unavailable__')}" selected disabled>Unavailable saved Object — choose replacement</option>` : '';
    const options = choices
      .map((option) => `<option value="${escapeHtml(option.value)}"${value === option.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}${type === 'object' ? ' data-object-ref="1"' : ''}>${emptyLabel != null ? `<option value="">${emptyLabel}</option>` : ''}${unavailable}${options}</select>`;
  };
  if (f.type === 'target' && f.cameraPath) {
    // Same object ID/schema/reference collector, but only Paths can drive this Action.
    // Retained invalid references stay explicit instead of silently selecting a rail.
    const paths=placed.filter(item=>item.kind==='path');
    const retained=value!==undefined&&value!==null&&value!==''&&!paths.some(item=>item.id===value);
    const unavailable=retained?`<option value="${escapeHtml(typeof value==='string'?value:'__unavailable__')}" selected disabled>Unavailable saved Path — choose replacement</option>`:'';
    const options=paths.map(item=>`<option value="${escapeHtml(item.id)}"${value===item.id?' selected':''}>${escapeHtml(itemDisplayName(item,placed.indexOf(item)))}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}><option value=""${!retained&&!paths.some(item=>item.id===value)?' selected':''}>${paths.length?'Choose Path':'Add Path from the palette, then add points'}</option>${unavailable}${options}</select>`;
  }
  if (f.type === 'target') {
    const allowSelf = f.implicitSelf !== false;
    const nullable = f.nullable === undefined ? allowSelf : f.nullable;
    // Empty implicit Self and choosing the owner's explicit ID are distinct.
    // Even an explicit-target condition must allow its named owner in the list.
    return referenceSelect('object', { nullable, required: !nullable, allowSelf: true, scope: 'current-level' }, f.emptyLabel || (allowSelf ? '(self)' : 'Choose Object'));
  }
  if (f.type === 'spriteAnimationState') {
    const targetId = values && values.targetId;
    const target = targetId ? findItemById(targetId) : (contextItem || selectedItem);
    const renderer = target && target.kind === 'sprite' && target.components && target.components['sprite-renderer'];
    const states = OpusAuthoringPlumbing.normalizeSpriteAnimationStates(renderer && renderer.animationStates);
    const options = states.map((state) => `<option value="${escapeHtml(state.id)}"${value === state.id ? ' selected' : ''}>${escapeHtml(state.name)} · ${escapeHtml(state.id)}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}><option value="">${states.length ? 'Choose state' : 'No states on target Sprite'}</option>${options}</select>`;
  }
  if (f.type === 'spriteDirection') {
    const labels = { none: 'None / Default', up: 'Up', down: 'Down', left: 'Left', right: 'Right', 'up-left': 'Up Left', 'up-right': 'Up Right', 'down-left': 'Down Left', 'down-right': 'Down Right' };
    return `<select data-field="${f.key}"${idPart}>${OpusAuthoringPlumbing.SPRITE_DIRECTION_VALUES.map((direction) => `<option value="${direction}"${value === direction ? ' selected' : ''}>${labels[direction]}</option>`).join('')}</select>`;
  }
  if (f.type === 'prefab') {
    if (prefabs.length === 0) return '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No prefabs saved yet.</p>';
    return referenceSelect('prefab', { required: true }, null);
  }
  if (f.type === 'audioAsset') {
    if (audioAssets.length === 0) return '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No audio imported yet (Assets tab).</p>';
    return referenceSelect('asset', { nullable: true, allowedAssetTypes: ['audio'] }, '(none)');
  }
  // Wave 9D (Priority A): Prefab Parameter Mesh/Texture Asset types reuse
  // this exact same shared field-rendering function (not a parallel picker)
  // -- the SAME Asset Library dropdowns every other mesh/texture reference
  // in this editor already uses.
  if (f.type === 'meshAsset') {
    if (assets.length === 0) return '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No mesh assets imported yet (Assets tab).</p>';
    return referenceSelect('asset', { nullable: true, allowedAssetTypes: ['mesh'] }, '(none)');
  }
  if (f.type === 'textureAsset') {
    if (textureAssets.length === 0) return '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No textures imported yet (Assets tab).</p>';
    return referenceSelect('asset', { nullable: true, allowedAssetTypes: ['texture'] }, '(none)');
  }
  if (f.type === 'hudElementRef') {
    if (currentUiConfig.hudElements.length === 0) return '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No HUD elements on this level yet.</p>';
    const options = currentUiConfig.hudElements.map((el) => `<option value="${escapeHtml(el.id)}"${value === el.id ? ' selected' : ''}>${HUD_KIND_LABELS[el.kind]}${el.text ? ` "${escapeHtml(el.text)}"` : ''}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}>${options}</select>`;
  }
  if (f.type === 'cameraPreset') {
    const cams = placed.filter((p) => p.kind === 'camera');
    const retained=value!==undefined&&value!==null&&value!==''&&!cams.some(camera=>camera.id===value);
    const unavailable=retained?`<option value="${escapeHtml(typeof value==='string'?value:'__unavailable__')}" selected disabled>Unavailable saved Camera — choose replacement</option>`:'';
    const options = cams.map((p) => `<option value="${escapeHtml(p.id)}"${value === p.id ? ' selected' : ''}>${escapeHtml(itemDisplayName(p, placed.indexOf(p)))}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}><option value=""${!retained&&!cams.some(camera=>camera.id===value)?' selected':''}>${cams.length?'Choose Camera preset':'Add Camera or 2D Camera from the palette'}</option>${unavailable}${options}</select>`;
  }
  if (f.type === 'sequence') {
    if (currentSequences.length === 0) return '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No Sequences on this level yet (Level tab).</p>';
    const options = currentSequences.map((s) => `<option value="${escapeHtml(s.id)}"${value === s.id ? ' selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}>${options}</select>`;
  }
  if (f.type === 'objectiveRef') {
    const all = Array.isArray(currentObjectiveDefs) ? currentObjectiveDefs : [];
    const definitions = all.filter(d => d && typeof d.id === 'string' && d.id && !['__proto__', 'constructor', 'prototype'].includes(d.id) && all.filter(other => other?.id === d.id).length === 1);
    const retained = value !== undefined && value !== null && value !== '' && !definitions.some(d => d.id === value);
    const unavailable = retained ? `<option selected disabled value="${escapeHtml(typeof value === 'string' ? value : '__unavailable__')}">Unavailable saved Objective — choose replacement</option>` : '';
    const options = definitions.map(d => `<option value="${escapeHtml(d.id)}"${value === d.id ? ' selected' : ''}>${escapeHtml(d.title || d.name || 'Unnamed Objective')}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}><option value=""${!retained && !definitions.some(d => d.id === value) ? ' selected' : ''}>Choose Objective from Level → Objectives</option>${unavailable}${options}</select>`;
  }
  if (f.type === 'lootTableRef') {
    const tables=(Array.isArray(lootTables)?lootTables:[]).filter(table=>lootTableById(table?.id)===table);
    const retained=value&&!tables.some(table=>table.id===value);
    return `<select data-field="${f.key}"${idPart}><option value="">Choose Project → Loot Tables</option>${retained?`<option selected disabled value="${escapeHtml(value)}">Unavailable saved table — choose replacement</option>`:''}${tables.map(table=>`<option value="${escapeHtml(table.id)}"${value===table.id?' selected':''}>${escapeHtml(table.name||'Unnamed Loot Table')}</option>`).join('')}</select>`;
  }
  if (f.type === 'itemDefRef') {
    // Keep retained references visible even when the last Item was deleted.
    // An empty catalog must not hide the unavailable saved value from creators.
    const definitions = currentItemDefs.filter(d => d && typeof d.id === 'string' && d.id && !['__proto__', 'constructor', 'prototype'].includes(d.id) && currentItemDefs.filter(other => other?.id === d.id).length === 1);
    const retained = value !== undefined && value !== null && value !== '' && !definitions.some(d => d.id === value);
    const unavailable = retained ? `<option selected disabled value="${escapeHtml(typeof value === 'string' ? value : '__unavailable__')}">Unavailable saved Item — choose replacement</option>` : '';
    const options = definitions.map((d) => `<option value="${escapeHtml(d.id)}"${value === d.id ? ' selected' : ''}>${escapeHtml(d.name || 'Unnamed Item')}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}><option value=""${!retained && !definitions.some(d => d.id === value) ? ' selected' : ''}>Choose Item from Project → Items</option>${unavailable}${options}</select>`;
  }
  if (f.type === 'level') {
    // Value is the level's stable id (survives rename/reorder), not its
    // name -- a raw name-based reference would silently point at the wrong
    // level (or nothing) the moment someone renamed it.
    return referenceSelect('level', { required: true }, null);
  }
  if (f.type === 'select') {
    const options = (f.options || []).map((opt) => `<option value="${escapeHtml(opt)}"${value === opt ? ' selected' : ''}>${escapeHtml(f.optionLabels?.[opt]||opt)}</option>`).join('');
    return `<select data-field="${f.key}"${idPart}>${options}</select>${f.cameraShakePreset?'<p class="field-help">Named presets use fixed intensity and duration. Custom uses the two Custom fields (blank means 0.3; zero clears). Impulse uses the selected world axis. New effects replace old ones; view movement is not a collision or frustum guarantee.</p>':''}`;
  }
  if (f.type === 'color') return `<input type="color" data-field="${f.key}"${idPart} value="${value || '#ffffff'}">`;
  if (f.type === 'checkbox') return `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea"><input type="checkbox" data-field="${f.key}"${idPart}${value ? ' checked' : ''}> ${escapeHtml(f.placeholder || '')}</label>`;
  return `<input type="${f.type === 'number' ? 'number' : 'text'}" data-field="${f.key}"${idPart}${f.cameraShakeScalar&&values?.preset&&values.preset!=='Custom'?' disabled':''} placeholder="${escapeHtml(f.placeholder || '')}" value="${value != null ? escapeHtml(String(value)) : ''}">`;
}

function runAction(behavior, item, signalEvent, controllerEvent) {
  if (behavior && behavior.requires && typeof behaviorRequirementGate === 'function' && !behaviorRequirementGate(behavior, item)) return; // Requires item (69-requires-item.js)
  if (behavior.action === 'graph') {
    const scope=(signalEvent&&signalEvent.type!=='none'||controllerEvent)?OpusGraphVariables.createScope(behavior.graph):undefined;
    if(scope)scope.signalEvent=signalEvent;
    if(scope&&controllerEvent)scope.controllerEvent=controllerEvent;
    runGraph(behavior.graph, item, undefined, scope);
    return;
  }
  if (behavior.action === 'dialogueTree') {
    runDialogueTree(behavior.dialogueTree, item);
    return;
  }
  const def = ACTION_TYPES[behavior.action];
  if (!def) { if (typeof behavior.action === 'string' && behavior.action.startsWith('custom_')) executeAction(behavior.action, behavior.params, item); return; }
  executeAction(behavior.action, behaviorParams(behavior, def), item);
}

