// Phase 003: adapt the editor's already-structured action/direct reference
// fields into the shared index. No free-form text, script, or dialogue is
// searched, and each usage retains only enough location data for repair.
function collectEditorReferenceUses(project) {
  const uses = [];
  const indexed = new WeakMap();
  // Runtime resolves connected Value inputs before executing a node. Keep
  // authored fallback bytes, but diagnose the Value source, not unused data.
  const boundFields = new WeakMap();
  const bindGraph = graph => {
    if (!Array.isArray(graph?.nodes) || !Array.isArray(graph?.edges)) return;
    const nodes = new Map(graph.nodes.filter(node => node && typeof node === 'object').map(node => [node.id,node]));
    for (const edge of graph.edges) if (edge?.kind === 'value' && typeof edge.toField === 'string') {
      const node = nodes.get(edge.to); if (!node) continue;
      const fields = boundFields.get(node) || new Set(); fields.add(edge.toField); boundFields.set(node,fields);
    }
  };
  const bindRecord = record => { for (const behavior of record?.behaviors || []) if (behavior?.action === 'graph') bindGraph(behavior.graph); };
  for (const level of project.levels || []) for (const record of level.objects || []) bindRecord(record);
  for (const definition of project.graphFunctions || []) bindGraph(definition?.graph);
  for (const prefab of project.prefabs || []) for (const record of prefab.records || (prefab.record ? [prefab.record] : [])) bindRecord(record);
  const add = (owner, key, referenceType, descriptor, location) => {
    if (!owner || typeof owner !== 'object') return;
    // Object Value binding is the supported typed-reference input here.
    // Leave historical asset/Prefab dependency and replacement policy intact.
    if (referenceType === 'object' && boundFields.get(owner)?.has(key)) return;
    const identity = `${referenceType}:${key}`;
    const fields = indexed.get(owner) || new Set();
    if (fields.has(identity)) return;
    fields.add(identity); indexed.set(owner, fields);
    uses.push({ owner, key, referenceType, referenceValue: owner[key], descriptor: descriptor || {}, field: key, scope: 'structured-reference', ...location });
  };
  const actionReference = (field) => {
    if (field.type === 'cameraPreset') return ['object', { nullable: true, scope: 'current-level', allowedObjectKinds: ['camera'] }];
    if (field.type === 'target') return ['object', { nullable: true, scope: 'current-level' }];
    if (field.type === 'prefab') return ['prefab', { required: true }];
    if (field.type === 'audioAsset') return ['asset', { nullable: true, allowedAssetTypes: ['audio'] }];
    if (field.type === 'meshAsset') return ['asset', { nullable: true, allowedAssetTypes: ['mesh'] }];
    if (field.type === 'textureAsset') return ['asset', { nullable: true, allowedAssetTypes: ['texture'] }];
    if (field.type === 'objectiveRef') return ['objective', { required: true, scope: 'current-level' }];
    if (field.type === 'itemDefRef') return ['item', { required: true }];
    if (field.type === 'level') return ['level', { required: true }];
    return null;
  };
  const scanAction = (action, params, location, assetOnly = false) => {
    const definition = Object.prototype.hasOwnProperty.call(ACTION_TYPES, action) ? ACTION_TYPES[action] : (typeof CONDITION_TYPES !== 'undefined' && Object.prototype.hasOwnProperty.call(CONDITION_TYPES, action) ? CONDITION_TYPES[action] : (typeof GRAPH_NODE_TYPES !== 'undefined' && Object.prototype.hasOwnProperty.call(GRAPH_NODE_TYPES, action) ? GRAPH_NODE_TYPES[action] : null));
    if (!definition || !params) return;
    for (const field of definition.fields || []) {
      const reference = actionReference(field);
      if (reference && (!assetOnly || reference[0] === 'asset' || reference[0] === 'prefab')) add(params, field.key, reference[0], reference[1], location);
    }
  };
  for (const level of project.levels || []) {
    const levelLocation = { levelId: level.id };
    if (level.ambientAudio) add(level.ambientAudio, 'audioAssetId', 'asset', { nullable: true, allowedAssetTypes: ['audio'] }, levelLocation);
    if (level.ui) {
      add(level.ui, 'winAudioAssetId', 'asset', { nullable: true, allowedAssetTypes: ['audio'] }, levelLocation);
      add(level.ui, 'loseAudioAssetId', 'asset', { nullable: true, allowedAssetTypes: ['audio'] }, levelLocation);
    }
    for (const sequence of Array.isArray(level.sequences)?level.sequences:[]) for (const step of Array.isArray(sequence?.steps)?sequence.steps:[]) if (step && typeof step === 'object' && !Array.isArray(step)) scanAction(step.actionType || step.action, step.params, levelLocation);
    for (const record of level.objects || []) {
      const location = { levelId: level.id, objectId: record.id };
      if (record.parentId) add(record, 'parentId', 'object', { required: true, scope: 'current-level' }, location);
      if (record.assetId) add(record, 'assetId', 'asset', { required: true, allowedAssetTypes: ['mesh'] }, location);
      if (record.textureAssetId) add(record, 'textureAssetId', 'asset', { required: true, allowedAssetTypes: ['texture'] }, location);
      if (record.sourcePrefabName) add(record, 'sourcePrefabName', 'prefab', { required: true }, location);
      if (record.kind === 'tilemap') for (const marker of record.spawnMarkers || []) if (marker.prefabRef) add(marker, 'prefabRef', 'prefab', { nullable: true }, { ...location, markerId: marker.id });
      const brain = Object.prototype.hasOwnProperty.call(record.components || {}, 'ai-brain')
        ? OpusAiBrain.inspect(record.components['ai-brain']) : null;
      // Use the canonical authored owner when present, not an optional legacy
      // mirror; reference repair must retain the actual saved object identity.
      const ai = brain?.ok ? record.components['ai-brain'].config : record.ai;
      if (ai) {
        if (ai.targetId) add(ai, 'targetId', 'object', { nullable: true, scope: 'current-level' }, location);
        if (ai.pathId) add(ai, 'pathId', 'object', { required: true, scope: 'current-level' }, location);
        if (ai.attackPrefab) add(ai, 'attackPrefab', 'prefab', { required: true }, location);
        for (const state of Array.isArray(ai.states) ? ai.states : []) {
          if (!state || typeof state !== 'object') continue;
          const movement = state.movement;
          const stateLocation = { ...location, aiState: state.name };
          if (movement?.targetId) add(movement, 'targetId', 'object', { nullable: true, scope: 'current-level' }, stateLocation);
          if (movement?.pathId) add(movement, 'pathId', 'object', { required: true, scope: 'current-level' }, stateLocation);
          if (state.attack?.attackPrefab) add(state.attack, 'attackPrefab', 'prefab', { required: true }, stateLocation);
          for (const entry of Array.isArray(state.entryActions) ? state.entryActions : []) {
            if (entry && typeof entry === 'object') scanAction(entry.action, entry.params, stateLocation);
          }
        }
      }
      if (record.kind === 'spawner' && record.options && record.options.prefabName) add(record.options, 'prefabName', 'prefab', { required: true }, location);
      for (const behavior of record.behaviors || []) scanAction(behavior.action, behavior.params, location);
    }
  }
  // Typed Item and Objective actions also live in Graph nodes, reusable Prefabs and saved
  // Item Use Actions. Retain actual authored owners for reference repair;
  // Extend these named gameplay references without changing unrelated policies.
  const scanItem = (type, params, location) => {
    const definition=Object.prototype.hasOwnProperty.call(ACTION_TYPES,type)?ACTION_TYPES[type]:typeof CONDITION_TYPES!=='undefined'&&Object.prototype.hasOwnProperty.call(CONDITION_TYPES,type)?CONDITION_TYPES[type]:null;
    for (const field of definition?.fields || []) {
      if (field.type === 'itemDefRef') add(params, field.key, 'item', { required: true }, location);
      if (field.type === 'objectiveRef') add(params, field.key, 'objective', { required: true, scope: 'current-level' }, location);
    }
  };
  // Phase197: declared asset/Prefab fields retain their actual authored owner
  // in every Action container. No arbitrary text search or reference mutation.
  // Scene Graphs own current-level typed targets just like ordinary Actions.
  // Portable library callers without a level keep their existing asset-only
  // scan until their invocation/member scope can be resolved explicitly.
  visitAuthoredActions(project, (type,params,location)=>{scanItem(type,params,location);scanAction(type,params,location,!location.levelId);if(location.dialogueCamera)scanAction(type,params,location);});
  for (const definition of project.graphFunctions || []) {
    for (const node of definition?.graph?.nodes || []) {
        if (node && typeof node === 'object') { const where={functionId:definition.id,graphNodeId:node.id};scanItem(node.type,node,where);scanAction(node.type,node,where); }
    }
  }
  for (const asset of project.assets || []) {
    for (const event of Array.isArray(asset?.animationEvents) ? asset.animationEvents : []) {
      if (event && typeof event === 'object') { const where={assetId:asset.id};scanItem(event.action,event.params,where);scanAction(event.action,event.params,where,true); }
    }
  }
  for (const prefab of project.prefabs || []) {
    if (!prefab || typeof prefab !== 'object') continue;
    const records = prefab.records || (prefab.record ? [prefab.record] : []);
    visitAuthoredActions({ levels: [{ objects: records }] }, (type, params, location) => {const where={...location,prefabName:prefab.name};scanItem(type,params,where);scanAction(type,params,where);if(location.dialogueCamera)scanAction(type,params,where);});
  }
  for (const definition of project.itemDefs || []) {
    if (definition?.useAction) { const where={itemId:definition.id};scanItem(definition.useAction.action,definition.useAction.params,where);scanAction(definition.useAction.action,definition.useAction.params,where,true); }
  }
  for (const record of Array.isArray(project.inventoryTemplates)?project.inventoryTemplates:[]) {
    if(record?.settings?.useAction){const where={inventoryTemplateName:record.name};scanItem(record.settings.useAction.action,record.settings.useAction.params,where);scanAction(record.settings.useAction.action,record.settings.useAction.params,where,true);}
  }
  return uses;
}

function collectWritableAssetReferenceUses(project) {
  // Shared validation indexes normalized clip states for diagnostics. Writes
  // need the actual retained state/variant owner instead, without normalizing
  // away future metadata. This helper only returns known declared fields.
  const inspectGraph=graph=>{
    if(typeof OpusGraphSchema==='undefined'||!OpusGraphSchema.canExecute(graph))throw new Error('Unsupported or malformed retained Graph; replacement preview refused without changes.');
    if(typeof GRAPH_NODE_TYPES!=='undefined'&&graph.nodes.some(node=>!Object.prototype.hasOwnProperty.call(GRAPH_NODE_TYPES,node.type)))throw new Error('Unknown retained Graph node; replacement preview refused without changes.');
  };
  const inspectRecord=record=>{for(const behavior of record?.behaviors||[])if(behavior?.action==='graph')inspectGraph(behavior.graph);};
  for(const definition of project.graphFunctions||[])if(definition&&Object.prototype.hasOwnProperty.call(definition,'graph'))inspectGraph(definition.graph);
  for(const level of project.levels||[])for(const record of level.objects||[])inspectRecord(record);
  for(const prefab of project.prefabs||[])for(const record of prefab.records||(prefab.record?[prefab.record]:[]))inspectRecord(record);
  const index=OpusAuthoringPlumbing.buildReferenceIndex(project,{schemaRegistry:OpusAuthoring.registry,referenceUses:collectEditorReferenceUses(project)});
  const uses=[],seen=new WeakMap();
  const add=use=>{if(!use.owner||typeof use.owner!=='object'||!['asset','prefab'].includes(use.referenceType))return;const key=use.referenceType+':'+use.key,keys=seen.get(use.owner)||new Set();if(keys.has(key))return;keys.add(key);seen.set(use.owner,keys);uses.push(use);};
  for(const use of index.uses)if(!(use.componentId==='sprite-renderer'&&String(use.field).startsWith('animationStates')))add(use);
  const scan=(record,location)=>{
    const states=record?.components?.['sprite-renderer']?.animationStates;if(states===undefined)return;
    if(!Array.isArray(states))throw new Error('Retained Sprite animation states are not an array; unchanged.');
    for(const state of states){
      if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('Retained Sprite animation state is malformed; unchanged.');
      const descriptor={allowedAssetTypes:['sprite-animation']};
      add({owner:state,key:'clipRef',referenceType:'asset',referenceValue:state.clipRef,descriptor,field:'animationStates.clipRef',...location});
      if(state.directionalVariants!==undefined&&!Array.isArray(state.directionalVariants))throw new Error('Retained directional variants are malformed; unchanged.');
      for(const variant of state.directionalVariants||[]){
        if(!variant||typeof variant!=='object'||Array.isArray(variant))throw new Error('Retained directional variant is malformed; unchanged.');
        add({owner:variant,key:'clipRef',referenceType:'asset',referenceValue:variant.clipRef,descriptor,field:'animationStates.directionalVariants.clipRef',...location});
      }
    }
  };
  for(const level of project.levels||[])for(const record of level.objects||[])scan(record,{levelId:level.id,objectId:record.id});
  for(const prefab of project.prefabs||[])for(const record of prefab.records||(prefab.record?[prefab.record]:[]))scan(record,{prefabName:prefab.name,objectId:record.id});
  const field=(owner,key,type,location)=>{if(!owner||typeof owner!=='object'||!Object.prototype.hasOwnProperty.call(owner,key))return;add({owner,key,field:key,referenceValue:owner[key],referenceType:type==='prefab'?'prefab':'asset',descriptor:type==='prefab'?{}:{allowedAssetTypes:[type]},...location});};
  const action=(type,params,location)=>{const def=Object.prototype.hasOwnProperty.call(ACTION_TYPES,type)?ACTION_TYPES[type]:null;for(const entry of def?.fields||[]){const assetType={audioAsset:'audio',meshAsset:'mesh',textureAsset:'texture',prefab:'prefab'}[entry.type];if(assetType)field(params,entry.key,assetType,location);}};
  const weapon=(config,location)=>{for(const key of ['fireAudioAssetId','emptySoundAssetId','impactAudioAssetId'])field(config,key,'audio',location);field(config,'prefabName','prefab',location);};
  const ui=(elements,location)=>{for(const element of elements||[]){if(element?.kind==='image')field(element,'textureAssetId','texture',location);if(element?.kind==='button')action(element.buttonAction,element.buttonParams,location);}};
  const parameterTypes={prefabReference:'prefab',meshAsset:'mesh',textureAsset:'texture',audioAsset:'audio'};
  const overrides=(name,values,location)=>{if(!values||typeof values!=='object')return;const matches=(project.prefabs||[]).filter(prefab=>prefab?.name===name);if(matches.length!==1)throw new Error('Prefab parameter owner is missing or ambiguous; preview unchanged.');for(const param of matches[0].parameters||[]){const type=parameterTypes[param.type];if(type)field(values,param.id,type,location);}};
  const object=(record,location)=>{
    field(record,'assetId','mesh',location);field(record,'textureAssetId','texture',location);field(record,'sourcePrefabName','prefab',location);
    if(record.sourcePrefabName&&record.prefabParams)overrides(record.sourcePrefabName,record.prefabParams,location);
    for(const behavior of record.behaviors||[])if(behavior?.trigger==='spriteAnimationEvent')field(behavior.eventRef,'clipId','sprite-animation',location);
    if(record.kind==='sprite')field(record.components?.['sprite-renderer'],'sourceTexture','texture',location);
    if(record.kind==='terrain')for(const layer of record.options?.paintEdits?.layers||[])field(layer,'textureAssetId','texture',location);
    if(record.kind==='spawner'){field(record.options,'prefabName','prefab',location);if(record.options?.paramOverrides)overrides(record.options.prefabName,record.options.paramOverrides,location);}
  };
  for(const level of project.levels||[]){
    const location={levelId:level.id},settings=level.playerSettings;
    field(settings,'footstepAudioAssetId','audio',location);field(settings?.visual,'assetId','mesh',location);weapon(settings?.weapon,location);
    for(const equipment of settings?.equipmentDefs||[]){field(equipment,'assetId','mesh',location);weapon(equipment?.weapon,location);}
    ui(level.ui?.hudElements,location);
    for(const record of level.objects||[])object(record,{...location,objectId:record.id});
    for(const layer of level.scatterLayers||[])for(const source of layer.sources||[])field(source,'prefabName','prefab',location);
  }
  for(const prefab of project.prefabs||[]){const location={prefabName:prefab.name};for(const param of prefab.parameters||[]){const type=parameterTypes[param.type];if(type)field(param,'default',type,location);}for(const record of prefab.records||(prefab.record?[prefab.record]:[]))object(record,{...location,objectId:record.id});}
  for(const asset of project.assets||[])field(asset,'textureAssetId','texture',{assetId:asset.id});
  for(const material of project.materialAssets||[])field(material?.descriptor,'textureAssetRef','texture',{assetId:material?.id});
  for(const item of project.itemDefs||[])field(item,'iconTextureAssetId','texture',{itemId:item?.id});
  for(const template of project.inventoryTemplates||[])field(template?.settings,'iconTextureAssetId','texture',{inventoryTemplateName:template?.name});
  for(const template of project.uiTemplates||[])ui(template?.elements,{uiTemplateName:template?.name});
  for(const definition of project.weaponDefinitions||[]){if(typeof OpusWeaponDefinitions==='undefined'||!OpusWeaponDefinitions.inspect(definition).ok)throw new Error('Unsupported Weapon Definition retained; replacement preview unchanged.');weapon(definition.config,{weaponDefinitionId:definition.id});}
  return uses;
}
function createKnownAssetReplacementPreview(project,assetType,sourceId,targetId) {
  // Detached engineering prerequisite. No mounted Apply or exhaustive-remap
  // claim until remaining typed fields and compatibility gates are covered.
  try {
    const collection={mesh:'assets',texture:'textures',sprite:'spriteAssets','sprite-animation':'spriteAnimations',audio:'audio'}[assetType];
    if(!collection||!project||typeof project!=='object'||Array.isArray(project)||typeof sourceId!=='string'||!sourceId||typeof targetId!=='string'||!targetId)throw new Error('Choose a supported same-type source and replacement.');
    const encoded=JSON.stringify(project);if(encoded.length>16*1024*1024)throw new Error('Preview exceeds16Mi serialized characters; unchanged.');
    const draft=JSON.parse(encoded),targets=(draft[collection]||[]).filter(asset=>asset?.id===targetId),sources=(draft[collection]||[]).filter(asset=>asset?.id===sourceId);
    if(targets.length!==1||sources.length>1)throw new Error('Replacement must be available and unambiguous in the selected asset type.');
    if(sourceId!==targetId&&assetType==='mesh'&&(targets[0].type==='skinnedMesh'||sources[0]?.type==='skinnedMesh'))
      throw new Error('Rig replacement requires explicit skin, animation and Socket compatibility; preview unchanged.');
    if(sourceId!==targetId&&assetType==='texture')for(const sprite of draft.spriteAssets||[]){
      if(sprite?.sourceTexture!==sourceId)continue;
      const issues=OpusAuthoringPlumbing.validateSpriteSourceRect(sprite,targets[0]);
      if(issues.length)throw new Error('Replacement Texture is incompatible with Sprite '+(sprite.name||sprite.id)+': '+issues[0].message);
    }
    const changes=[];
    if(sourceId!==targetId)for(const use of collectWritableAssetReferenceUses(draft)){
      if(use.referenceType!=='asset'||use.owner[use.key]!==sourceId||!use.descriptor?.allowedAssetTypes?.includes(assetType))continue;
      changes.push({field:use.field,levelId:use.levelId||null,objectId:use.objectId||null,prefabName:use.prefabName||null,assetId:use.assetId||null,functionId:use.functionId||null,before:sourceId,after:targetId});
      use.owner[use.key]=targetId;
    }
    return {ok:true,complete:false,scope:'Known declared references only; additional typed fields and compatibility validation remain. No Apply is available.',draft,changes};
  }catch(error){return {ok:false,complete:false,reason:error.message||'Replacement preview unavailable; project unchanged.'};}
}
function collectSpriteAnimationStateActionIssues(project) {
  const issues = [];
  const levelsById = new Map((project.levels || []).map((level) => [level.id, level]));
  visitAuthoredActions(project, (type, params, location) => {
    if (!['setSpriteAnimationState', 'setSpriteDirection', 'setSpriteFlip'].includes(type)) return;
    const level = levelsById.get(location.levelId);
    const targetId = params.targetId || location.ownerObjectId;
    const target = level && (level.objects || []).find((record) => record.id === targetId);
    const base = { scope: 'action', levelId: location.levelId || null, objectId: location.objectId || targetId || null, componentId: 'sprite-renderer', field: type === 'setSpriteAnimationState' ? 'stateId' : type === 'setSpriteDirection' ? 'direction' : 'flipX' };
    const label = type === 'setSpriteAnimationState' ? 'Set Sprite Animation State' : type === 'setSpriteDirection' ? 'Set Sprite Direction' : 'Set Sprite Flip';
    const targetRequiredCode = type === 'setSpriteAnimationState' ? 'sprite-animation-state-action-target-required' : `${type}-target-required`;
    const targetIneligibleCode = type === 'setSpriteAnimationState' ? 'sprite-animation-state-action-target-ineligible' : `${type}-target-ineligible`;
    if (!targetId) { issues.push({ ...base, severity: 'error', code: targetRequiredCode, message: `${label} requires a target Sprite Object.` }); return; }
    if (!target || target.kind !== 'sprite' || !target.components || !target.components['sprite-renderer']) { issues.push({ ...base, severity: 'error', code: targetIneligibleCode, message: `${label} target "${targetId}" is missing or is not a Sprite Object.` }); return; }
    if (type === 'setSpriteDirection') {
      if (!OpusAuthoringPlumbing.SPRITE_DIRECTION_VALUES.includes(params.direction)) issues.push({ ...base, severity: 'error', code: 'sprite-direction-action-invalid', referenceValue: params.direction || null, message: `${label} requires one canonical Direction value.` });
      return;
    }
    if (type === 'setSpriteFlip') return;
    if (!params.stateId) { issues.push({ ...base, severity: 'error', code: 'sprite-animation-state-action-state-required', message: 'Set Sprite Animation State requires a named state.' }); return; }
    const renderer = target.components['sprite-renderer'];
    if (!OpusAuthoringPlumbing.normalizeSpriteAnimationStates(renderer.animationStates).some((state) => state.id === params.stateId)) issues.push({ ...base, severity: 'error', code: 'sprite-animation-state-action-state-missing', referenceValue: params.stateId, message: `Set Sprite Animation State points to missing local state ID "${params.stateId}" on Sprite "${targetId}".` });
  });
  return issues;
}

function collectSpriteAnimationEventListenerIssues(project) {
  const issues = []; const clips = new Map((project.spriteAnimations || []).map((clip) => [clip.id, clip]));
  for (const level of project.levels || []) for (const owner of level.objects || []) for (const behavior of owner.behaviors || []) {
    if (behavior.trigger !== 'spriteAnimationEvent') continue;
    const ref = behavior.eventRef || {}; const base = { scope: 'behavior', levelId: level.id || null, objectId: owner.id || null, field: 'eventRef' };
    const target = (level.objects || []).find((record) => record.id === ref.targetId);
    if (!ref.targetId) { issues.push({ ...base, severity: 'error', code: 'sprite-animation-event-target-required', message: 'On Sprite Animation Event requires a target Sprite Object.' }); continue; }
    if (!target || target.kind !== 'sprite' || !target.components || !target.components['sprite-renderer']) { issues.push({ ...base, severity: 'error', code: 'sprite-animation-event-target-ineligible', message: `Animation Event target "${ref.targetId}" is missing or is not a Sprite Object.` }); continue; }
    if (!ref.clipId) { issues.push({ ...base, severity: 'error', code: 'sprite-animation-event-clip-required', message: 'On Sprite Animation Event requires a Clip.' }); continue; }
    const states = OpusAuthoringPlumbing.normalizeSpriteAnimationStates(target.components['sprite-renderer'].animationStates);
    if (!states.some((state) => state.clipRef === ref.clipId || state.directionalVariants.some((variant) => variant.clipRef === ref.clipId))) issues.push({ ...base, severity: 'error', code: 'sprite-animation-event-clip-not-on-target', referenceValue: ref.clipId, message: `Clip "${ref.clipId}" is not assigned to the target Sprite's named states or directional variants.` });
    const clip = clips.get(ref.clipId);
    if (!clip) { issues.push({ ...base, severity: 'error', code: 'sprite-animation-event-clip-missing', referenceValue: ref.clipId, message: `Animation Event listener points to missing Clip "${ref.clipId}".` }); continue; }
    if (!ref.eventId) issues.push({ ...base, severity: 'error', code: 'sprite-animation-event-required', message: 'On Sprite Animation Event requires a named event.' });
    else if (!OpusAuthoringPlumbing.spriteAnimationEvents(clip).some((event) => event.id === ref.eventId)) issues.push({ ...base, severity: 'error', code: 'sprite-animation-event-missing', referenceValue: ref.eventId, message: `Animation Event ID "${ref.eventId}" is missing from Clip "${clip.name}".` });
  }
  return issues;
}

function collectControllerAbilityPlayerIssues(project) {
  const issues = [];
  for (const level of project.levels || []) {
    const settings = level.playerSettings || {};
    const family = settings.controllerType;
    const primary = family === 'platformer2d' ? settings.platformerObjectRef : family === 'topdown2d' ? settings.topdownObjectRef : null;
    for (const record of level.objects || []) for (const id of ['jump-ability', 'sprint-ability']) {
      if (!record.components || !Object.prototype.hasOwnProperty.call(record.components, id)) continue;
      const base = { scope: 'object', levelId: level.id || null, objectId: record.id || null, componentId: id };
      if (!primary || record.id !== primary) issues.push({ ...base, severity: 'warning', code: 'controller-ability-inactive-owner',
        message: 'This ability is retained but inactive: choose this Sprite as this level’s primary 2D Player to use it. Legacy 3D Player settings are unchanged.' });
      else if (id === 'jump-ability' && family !== 'platformer2d') issues.push({ ...base, severity: 'error', code: 'controller-ability-family',
        message: 'Jump Ability requires the Platformer 2D Player. Top-down 2D has no vertical Jump; this record is retained without launching.' });
    }
  }
  return issues;
}
function collectControllerStateEventIssues(project) {
  const issues = [];
  const states = ['moving', 'idle', 'airborne', 'landed'];
  const scan = (record, settings, scope) => {
    for (const behavior of Array.isArray(record?.behaviors) ? record.behaviors : []) {
      if (behavior?.trigger !== 'controllerStateEvent') continue;
      const ref = behavior.eventRef;
      const base = { ...scope, scope: 'behavior', objectId: record.id || null, field: 'eventRef', severity: 'error' };
      if (!ref || ref.source !== 'levelPlayer' || !states.includes(ref.state)) {
        issues.push({ ...base, code: 'controller-state-event-invalid', message: 'Controller State Event needs This level’s Player and a named supported transition. Repair the saved reference; it is not retargeted.' });
        continue;
      }
      if (!settings) continue; // Prefab source resolves in its destination level.
      const family = settings.controllerType || 'hovercraft';
      if (!['platformer2d', 'topdown2d', 'firstperson', 'thirdperson', 'topdown', 'hovercraft'].includes(family)) {
        issues.push({ ...base, code: 'controller-state-player-unavailable', message: 'Controller State Event needs a supported Player controller in this level.' });
      } else if (['airborne', 'landed'].includes(ref.state) && !['platformer2d', 'firstperson'].includes(family) && !(family === 'thirdperson' && settings.jumpEnabled === true)) {
        issues.push({ ...base, code: 'controller-state-grounding-unavailable', message: 'Airborne/Landed require a vertically simulated Player: 2D Platformer, First-person, or jump-enabled Third-person. This controller has no such grounding state.' });
      }
    }
  };
  for (const level of project.levels || []) for (const record of level.objects || []) scan(record, level.playerSettings || { controllerType: 'hovercraft' }, { levelId: level.id || null });
  for (const prefab of project.prefabs || []) {
    const records = Array.isArray(prefab.records) ? prefab.records : prefab.record ? [prefab.record] : [prefab];
    for (const record of records) scan(record, null, { prefabName: prefab.name || null });
  }
  return issues;
}
let lastProjectValidation = null;
let lastProjectValidationLevels = null;
let lastProjectHealthReview = null;
function collectLootTableIssues(project) {
  const issues=[],tables=project.lootTables===undefined?[]:project.lootTables;
  const issue=(code,message,location={})=>issues.push({severity:'error',scope:'loot-table',code,message,...location});
  if(!Array.isArray(tables)){issue('loot-library-invalid','Saved Loot Table library is unavailable. Keep Save for recovery; load a repaired library before exporting.');return issues;}
  if(tables.length>OpusLootTables.MAX_TABLES)issue('loot-library-capacity','Loot Tables support at most256 definitions.');
  for(const table of tables){
    const state=inspectLootTable(table,{prefabs:project.prefabs,itemDefs:project.itemDefs});
    if(!state.ok||tables.filter(other=>other?.id===table?.id).length!==1)issue('loot-table-invalid','Loot Table '+(table?.name||'Unavailable')+': '+(state.reason||'Ambiguous identity')+'. Repair Project → Loot Tables.');
  }
  const action=(type,params,location)=>{if(type==='dropLoot'&&(!params||tables.filter(table=>table?.id===params.tableId&&OpusLootTables.validate(table).valid).length!==1))issue('loot-table-reference-unavailable','Drop Loot needs one available named table. Choose Project → Loot Tables, then repair the caller selection.',location);};
  const graph=(value,location)=>{for(const node of Array.isArray(value?.nodes)?value.nodes:[])action(node?.type,node,location);};
  const object=(record,location)=>{
    for(const behavior of Array.isArray(record?.behaviors)?record.behaviors:[])if(behavior?.action==='graph')graph(behavior.graph,location);else action(behavior?.action,behavior?.params||behavior,location);
    for(const event of Array.isArray(record?.animationEvents)?record.animationEvents:[])action(event?.action,event?.params,location);
  };
  for(const level of project.levels||[])for(const record of level.objects||[])object(record,{levelId:level.id,objectId:record?.id});
  for(const prefab of project.prefabs||[])for(const record of Array.isArray(prefab?.records)?prefab.records:prefab?.record?[prefab.record]:[])object(record,{prefabName:prefab?.name,objectId:record?.id});
  for(const fn of project.graphFunctions||[])graph(fn?.graph,{functionId:fn?.id});
  for(const item of project.itemDefs||[])action(item?.useAction?.action,item?.useAction?.params,{itemId:item?.id});
  return issues;
}
// One canonical schema/reference collector for both full authoring review and
// the exact detached tier snapshot used by export. Never silently fix data.
function collectCanonicalProjectIssues(project) {
  // Resolve against the reviewed portable library, never the current live
  // asset list or a Play session's compiled Action vocabulary.
  const labels = { ...INPUT_ACTION_LABELS };
  const actionAssets = Array.isArray(project.inputActionAssets) ? project.inputActionAssets : [];
  if (typeof OpusInputActionAssets !== 'undefined') for (const record of actionAssets.slice(0, 128)) {
    const action = OpusInputActionAssets.find(actionAssets, record?.id);
    if (action) labels[action.id] = action.name;
  }
  return OpusAuthoringPlumbing.collectProjectIssues(project, {
    schemaRegistry: OpusAuthoring.registry,
    inputActions: Object.entries(labels).map(([id, name]) => ({ id, name })),
    assetRegistry: OpusAuthoringPlumbing.assetTypes,
    referenceUses: collectEditorReferenceUses(project),
  });
}
// Full-authoring Problems and dependency-pruned export tiers share the same
// supplied-project checks and existing family policies; never silently fix data.
function collectStructuredProjectIssues(project) {
  const review = collectCanonicalProjectIssues(project);
  review.issues.push(...collectSpriteAnimationStateActionIssues(project));
  review.issues.push(...collectPlatformerPlayerIssues(project));
  review.issues.push(...collectTopdownPlayerIssues(project));
  review.issues.push(...collectControllerStateEventIssues(project));
  review.issues.push(...collectControllerAbilityPlayerIssues(project));
  review.issues.push(...collectSpriteAnimationEventListenerIssues(project));
  review.issues.push(...OpusSignals.collectDependencies(project,{graphValueType:(node,graph)=>OpusGraphValues.outputType(node,GRAPH_NODE_TYPES,graph)}).issues);
  review.issues.push(...OpusInputContexts.collectIssues(project));
  review.issues.push(...collectTouchLayoutIssues(project));
  review.issues.push(...collectLootTableIssues(project));
  for (const level of project.levels || []) for (const object of level.objects || []) {
    if (object.kind === 'camera') {
      review.issues.push(...validateCameraOptions(object.options, { levelId: level.id || null, objectId: object.id || null }));
      if(object.options?.targetGroup?.enabled&&Array.isArray(object.options.targetGroup.targetIds))for(const id of object.options.targetGroup.targetIds){const member=(level.objects||[]).find(entry=>entry.id===id);if(!member||!['cube','sprite'].includes(member.kind)||member.isBillboard||member.isRamp)review.issues.push({severity:'error',scope:'camera',levelId:level.id||null,objectId:object.id||null,field:'targetGroup.targetIds',code:'camera-target-group-reference-unavailable',message:'A Camera target is missing or unsupported. Choose a named ordinary Cube, static mesh or true Sprite; saved references are retained.'});}
    }
    if (object.kind === 'cube' && object.spritePassRelation != null && !Opus.SPRITE_PASS_RELATIONS.includes(object.spritePassRelation)) review.issues.push({ scope: 'object', levelId: level.id || null, objectId: object.id || null, field: 'spritePassRelation', severity: 'error', code: 'hybrid-sprite-pass-relation-invalid', referenceValue: object.spritePassRelation, message: `Relative to Sprites must be "behind-sprites" or "in-front-of-sprites"; runtime safely falls back behind.` });
  }
  review.issues.sort((a, b) => OpusAuthoringPlumbing.SEVERITIES.indexOf(a.severity) - OpusAuthoringPlumbing.SEVERITIES.indexOf(b.severity) || a.code.localeCompare(b.code) || String(a.objectId || a.assetId || '').localeCompare(String(b.objectId || b.assetId || '')));
  return review;
}
function validateCurrentProject() {
  const project = serializeProject();
  // Validation audits the complete authoring library, including unused
  // repairable assets that export pruning intentionally omits.
  project.spriteAssets = spriteAssets.map((asset) => OpusAuthoringPlumbing.createSpriteAsset(asset));
  project.spriteAnimations = spriteAnimationClips.map((clip) => OpusAuthoringPlumbing.createSpriteAnimationClip(clip));
  project.tilesets = serializeTilesets();
  project.textures = serializeTextureAssets(new Set(textureAssets.map((asset) => asset.id)));
  project.prefabs = prefabs;
  lastProjectValidation = collectStructuredProjectIssues(project);
  lastProjectValidationLevels = levels;
  lastProjectHealthReview = prepareProjectHealthReview(lastProjectValidation.issues);
  renderProjectValidation(lastProjectValidation.issues);
  return lastProjectValidation;
}

function focusProjectGraphIssue(entry) {
  const state = graphEditorState;
  const node = state?.graph?.nodes?.find(value => value.id === entry.graphNodeId);
  if (!node) { showStatus('This Graph node is unavailable. Refresh Problems before repairing it.'); return; }
  const wrap = document.getElementById('graph-canvas-wrap');
  state.view = { x: Math.max(40, wrap.clientWidth / 2 - 140) - (Number(node.x) || 0), y: 80 - (Number(node.y) || 0), scale: 1 };
  applyGraphViewTransform();
  const meta = GRAPH_NODE_TYPES[node.type];
  const fieldIndex = meta?.fields?.findIndex(field => field.key === entry.field);
  if (fieldIndex >= 0) document.getElementById(`graph-field-${encodeURIComponent(node.id)}-${fieldIndex}`)?.focus({ preventScroll: true });
}

function focusProjectIssue(entry) {
  if (entry.functionId && entry.scope !== 'signal') {
    const definition = OpusGraphFunctions.find(graphFunctions,entry.functionId);
    if (!definition) { showStatus('This Function is unavailable. Refresh Problems before repairing it.'); return; }
    openGraphEditor(null,{trigger:'start',graph:definition.graph},'start');
    if (graphEditorState) { graphEditorState.functionDefinition=definition; renderGraphNodes(); }
    if (entry.graphNodeId) focusProjectGraphIssue(entry);
    showStatus(`Function ${definition.name}: ${entry.message}`); return;
  }
  if(entry.scope==='input-context') {
    activateTab('right-tab','project');
    document.getElementById('input-contexts')?.scrollIntoView({block:'nearest'});
    showStatus(entry.message); return;
  }
  if(entry.scope==='signal'){
    if(entry.levelId){const index=levels.findIndex(level=>level.id===entry.levelId);if(index>=0&&index!==currentLevelIndex)switchToLevel(index);}
    if(entry.sequenceId||entry.objectiveId){activateTab('right-tab','level');const section=entry.sequenceId?'sequences':'objectives';if(entry.sequenceId)selectedSequenceId=entry.sequenceId;renderSequenceStepList();renderObjectiveDefPanel();const body=document.querySelector(`[data-section-body="${section}"]`);if(body?.classList.contains('collapsed'))document.querySelector(`[data-section="${section}"]`)?.click();body?.scrollIntoView({block:'nearest'});showStatus(entry.message);return;}
    if(entry.functionId){const definition=OpusGraphFunctions.find(graphFunctions,entry.functionId);if(definition){openGraphEditor(entry.objectId?findItemById(entry.objectId):null,{trigger:'start',graph:definition.graph},'start');graphEditorState.functionDefinition=definition;renderGraphNodes();}showStatus(entry.message);return;}
    if(!entry.objectId&&!entry.prefabName){activateTab('right-tab','project');document.getElementById('signal-manager')?.scrollIntoView({block:'nearest'});showStatus(entry.message);return;}
  }
  if (entry.prefabName) {
    activateTab('left-tab', 'prefabs');
    const prefabIndex = prefabs.findIndex((prefab) => prefab.name === entry.prefabName);
    const row = prefabIndex >= 0 ? document.getElementById(`palette-prefab-${prefabIndex}`) : null;
    if (row) row.scrollIntoView({ block: 'nearest' });
    showStatus(`Prefab ${entry.prefabName}${entry.objectId ? ` / Object ${entry.objectId}` : ''}: ${entry.message}`);
    return;
  }
  if (entry.objectId) {
    const levelIndex = levels.findIndex((level) => level.id === entry.levelId);
    if (levelIndex >= 0 && levelIndex !== currentLevelIndex) switchToLevel(levelIndex);
    const item = findItemById(entry.objectId);
    if (item && entry.graphNodeId && Number.isSafeInteger(entry.behaviorIndex)) {
      const behavior = item.behaviors?.[entry.behaviorIndex];
      if (behavior?.action !== 'graph' || !behavior.graph?.nodes?.some(node => node.id === entry.graphNodeId)) { showStatus('This Graph location changed. Refresh Problems before repairing it.'); return; }
      selectItem(item); openGraphEditor(item,behavior,behavior.trigger); focusProjectGraphIssue(entry); showStatus(entry.message); return;
    }
    if (item) { selectItem(item); if (item.kind === 'tilemap') { if (entry.markerId && OpusAuthoringPlumbing.getSpawnMarkerById(item, entry.markerId)) selectedSpawnMarkerId = entry.markerId; if (entry.layerId && OpusAuthoringPlumbing.getTilemapLayer(item, entry.layerId)) { tilemapActiveLayerIds.set(item, entry.layerId); if (Number.isSafeInteger(entry.cellX) && Number.isSafeInteger(entry.cellY)) tilemapHoverCell = { x: entry.cellX, y: entry.cellY }; } renderInspector(); syncTilemapOverlay(); } activateTab('right-tab', 'inspector'); showStatus(`Focused ${entry.objectId}${entry.layerId ? ` / Layer ${entry.layerId}` : ''}${Number.isSafeInteger(entry.cellX) ? ` / Cell ${entry.cellX},${entry.cellY}` : ''}: ${entry.message}`); return; }
  }
  if (entry.assetId || entry.referenceType === 'asset') {
    activateTab('left-tab', 'assets');
    if (findTilesetById(entry.assetId)) {
      selectedTilesetId = entry.assetId; openTilePalette(entry.assetId);
      const tileset = findTilesetById(entry.assetId);
      if (entry.terrainBrushId) { tilePaletteMode = 'terrain'; activeTerrainBrushId = entry.terrainBrushId; renderTilePalette(); document.querySelector(`[data-terrain-brush="${CSS.escape(entry.terrainBrushId)}"]`)?.scrollIntoView({ block: 'nearest' }); showStatus(`Focused Tileset "${tileset.name}" → Terrain Brush "${(OpusAuthoringPlumbing.getTerrainBrushById(tileset, entry.terrainBrushId) || {}).name || entry.terrainBrushId}": ${entry.message}`); return; }
      if (entry.autoTileSetId) { tilePaletteMode = 'auto-tiles'; activeAutoTileSetId = entry.autoTileSetId; activeAutoTileRuleMask = Number.isInteger(entry.mask) ? entry.mask : 0; renderTilePalette(); document.querySelector(`[data-auto-tile-set="${CSS.escape(entry.autoTileSetId)}"]`)?.scrollIntoView({ block: 'nearest' }); showStatus(`Focused Tileset "${tileset.name}" → Auto-Tile Set "${(OpusAuthoringPlumbing.getAutoTileSetById(tileset, entry.autoTileSetId) || {}).name || entry.autoTileSetId}": ${entry.message}`); return; }
      const indexMatch = /^tiles\[(\d+)\]/.exec(entry.field || '');
      const tile = entry.tileId ? OpusAuthoringPlumbing.getTileById(tileset, entry.tileId) : (indexMatch && tileset.tiles[Number(indexMatch[1])]);
      if (tile) { activeTileId = tile.id; renderTilePalette(); if (/collision/i.test(entry.field || entry.code || '')) document.querySelector('[data-tile-collision-section]')?.scrollIntoView({ block: 'nearest' }); }
      showStatus(`Focused Tileset "${tileset.name}"${tile ? ` → Tile "${tile.name}"` : ''}: ${entry.message}`);
      return;
    }
    if (findSpriteAnimationById(entry.assetId || entry.referenceValue)) { selectedSpriteAnimationId = entry.assetId || entry.referenceValue; renderSpriteAnimationLibrary(); }
    const row = document.querySelector(`[data-asset-id="${entry.assetId || entry.referenceValue}"], [data-texture-id="${entry.assetId || entry.referenceValue}"], [data-sprite-asset-id="${entry.assetId || entry.referenceValue}"], [data-sprite-animation-id="${entry.assetId || entry.referenceValue}"], [data-tileset-id="${entry.assetId || entry.referenceValue}"], [data-audio-id="${entry.assetId || entry.referenceValue}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }
  showStatus(entry.message);
}

function projectProblemLocation(entry) {
  const level = levels.find(value => value.id === entry.levelId);
  const object = level?.objects?.find(value => value.id === entry.objectId);
  const definition = entry.functionId && typeof graphFunctions !== 'undefined' ? graphFunctions.find(value => value.id === entry.functionId) : null;
  return [entry.prefabName ? `Prefab ${entry.prefabName}` : definition ? `Function ${definition.name || definition.id}` : level ? `Level ${level.name || level.id}` : 'Project library', object ? object.name || entry.objectId : entry.objectId, entry.assetId, !definition && entry.functionId, entry.graphNodeId ? `Graph node ${entry.graphNodeId}` : entry.componentId || entry.scope, entry.field].filter(Boolean).join(' → ');
}

function summarizeProjectDiagnosticHealth(issues) {
  const counts={error:0,warning:0,info:0,unknown:0},priority=[];
  if(!Array.isArray(issues)||issues.length>10000)return {available:false,score:null,counts,priority,reason:'Complete issue report unavailable or exceeds the 10,000-issue scoring bound. No partial score.'};
  for(let index=0;index<issues.length;index++){
    const severity=issues[index]?.severity;
    if(!['error','warning','info'].includes(severity)){counts.unknown++;continue;}
    counts[severity]++;priority.push({index,severity});
  }
  priority.sort((a,b)=>({error:0,warning:1,info:2}[a.severity]-{error:0,warning:1,info:2}[b.severity])||a.index-b.index);
  return {available:!counts.unknown,score:counts.unknown?null:Math.max(0,100-counts.error*20-counts.warning*5),counts,priority,reason:counts.unknown?'Unknown severity prevents a complete score; review the retained report.':''};
}
function prepareProjectHealthReview(issues) {
  if(!Array.isArray(issues))return null;
  try{
    const signature=JSON.stringify(captureAssetReplacementState().project);
    if(signature.length>8*1024*1024)return null;
    return {issues,signature,levels,levelIndex:currentLevelIndex,undo:undoStack,redo:redoStack,undoLength:undoStack.length,redoLength:redoStack.length,undoTail:undoStack.at(-1),redoTail:redoStack.at(-1)};
  }catch(error){return null;}
}
function projectHealthReviewCurrent(review,issues) {
  if(!review||review.issues!==issues||playMode||levels!==review.levels||currentLevelIndex!==review.levelIndex||undoStack!==review.undo||redoStack!==review.redo||undoStack.length!==review.undoLength||redoStack.length!==review.redoLength||undoStack.at(-1)!==review.undoTail||redoStack.at(-1)!==review.redoTail)return false;
  try{return JSON.stringify(captureAssetReplacementState().project)===review.signature;}catch(error){return false;}
}
function renderProjectDiagnosticHealth(issues) {
  const host=document.getElementById('project-health-report');if(!host)return;
  host.replaceChildren();
  const line=text=>{const p=document.createElement('p');p.className='field-help';p.style.overflowWrap='anywhere';p.textContent=text;host.append(p);return p;};
  const review=lastProjectHealthReview;
  if(!projectHealthReviewCurrent(review,issues)){line('Diagnostic health unavailable or stale. Stop Play and Validate Project for a fresh complete authoring review (snapshot limit: 8,388,608 serialized UTF-16 units). No partial export report is scored.');return;}
  const health=summarizeProjectDiagnosticHealth(issues);
  line(health.available?`Structured diagnostic score: ${health.score}/100 — ${health.counts.error} error, ${health.counts.warning} warning, ${health.counts.info} info.`:health.reason);
  line('Diagnostic policy v1: start at 100, deduct 20 per reported error and 5 per warning, clamp at 0; info deducts 0. Repeated reports count individually. Uses the complete report, independent of filters. This is not gameplay, accessibility, export readiness or product-completion certification. HUD/Menu preview readability, runtime outcomes and unmeasured checks are not included. Nothing is fixed automatically. Refresh after edits.');
  for(const item of health.priority.slice(0,5)){
    const issue=issues[item.index],button=document.createElement('button');button.type='button';button.className='project-validation-item';button.dataset.healthIssue=String(item.index);button.style.overflowWrap='anywhere';
    button.textContent=`Review ${item.severity}: ${issue.message} — ${projectProblemLocation(issue)}`;
    button.onclick=()=>{if(!projectHealthReviewCurrent(review,issues)){line('This diagnostic review is stale or Play is active. Validate Project again; no project changes made.');return;}focusProjectIssue(issue);};host.append(button);
  }
  if(health.priority.length>5)line(`${health.priority.length-5} more reported issues are in Problems below. Priorities are errors, warnings, then information; no issue is removed by scoring.`);
  if(Array.isArray(issues)&&!issues.length)line('No structured issues reported by these checks. Test the real game and inspect scoped HUD/Menu previews; 100 is not a readiness guarantee.');
}

function renderProjectValidation(issues) {
  renderProjectDiagnosticHealth(issues);
  const summary = document.getElementById('project-validation-summary');
  const list = document.getElementById('project-validation-list');
  if (!summary || !list) return;
  const counts = { error: 0, warning: 0, info: 0 };
  for (const entry of issues) counts[entry.severity]++;
  const severity = document.getElementById('project-problems-severity');
  const scope = document.getElementById('project-problems-scope');
  const query = (document.getElementById('project-problems-search')?.value || '').trim().toLowerCase();
  const scopes = [...new Set(issues.map(entry => entry.scope || 'project'))].sort();
  if (scope) { const previous = scope.value; scope.innerHTML = '<option value="all">All scopes</option>' + scopes.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(''); scope.value = scopes.includes(previous) ? previous : 'all'; }
  const visible = issues.map((entry,index) => ({entry,index,location:projectProblemLocation(entry)})).filter(({entry,location}) => (!severity || severity.value === 'all' || entry.severity === severity.value) && (!scope || scope.value === 'all' || (entry.scope || 'project') === scope.value) && (!query || [location,entry.code,entry.message].join(' ').toLowerCase().includes(query)));
  summary.textContent = issues.length ? `${visible.length} shown / ${issues.length} total — ${counts.error} error, ${counts.warning} warning, ${counts.info} info. Refresh after edits.` : 'No structured authoring issues found. Refresh after edits.';
  list.innerHTML = visible.length ? visible.map(({entry,index,location}) => `<button class="project-validation-item ${entry.severity}" data-validation-issue="${index}"><strong>${escapeHtml(entry.severity.toUpperCase())}: ${escapeHtml(entry.code)}</strong><br>${escapeHtml(entry.message)}<br><span>${escapeHtml(location)}</span></button>`).join('') : `<p class="field-help">${issues.length ? 'No issues match these filters. Change severity, scope or search.' : 'No issues reported by the structured checks. This is not a gameplay acceptance guarantee.'}</p>`;
  const reportLevels = lastProjectValidationLevels;
  list.querySelectorAll('[data-validation-issue]').forEach((button) => { button.onclick = () => { if(playMode){showStatus('Stop Play before navigating Problems.');return;}if(levels !== reportLevels){showStatus('This Problems report belongs to a replaced project. Refresh Problems before navigating.');return;}focusProjectIssue(issues[Number(button.dataset.validationIssue)]); }; });
}

// Explicit, read-only evidence capture. Operations remain ordinary editor controls;
// this is deliberately not a general command recorder or a second history engine.
let authoringFixtureCapture = null;
let authoringFixtureCheck = null;
function authoringFixtureJson(value) {
  const json=JSON.stringify(value,(key,item)=>{
    if(['__proto__','constructor','prototype'].includes(key)||typeof item==='function'||typeof item==='bigint'||typeof item==='symbol'||(typeof item==='number'&&!Number.isFinite(item)))throw new Error('Unsupported fixture data; capture refused.');
    return item;
  });
  if(typeof json!=='string'||json.length>8388608)throw new Error('Fixture exceeds 8,388,608 serialized UTF-16 units; no partial capture.');
  return json;
}
function prepareAuthoringFixtureCapture() {
  if(playMode||pendingAssetImport||redoStack.length)throw new Error('Stop Play, finish asset imports and resolve Redo history before capture.');
  if(undoStack.length>MAX_HISTORY)throw new Error('Unsupported history capacity; capture refused.');
  const state=JSON.parse(authoringFixtureJson(captureAssetReplacementState()));
  return {state,levels,levelIndex:currentLevelIndex,undo:undoStack.slice(),redo:redoStack.slice()};
}
function finishAuthoringFixtureCapture(capture) {
  const same=(a,b)=>a.length===b.length&&a.every((entry,index)=>entry===b[index]);
  const previous=capture?.undo||[],advanced=previous.length<MAX_HISTORY
    ?undoStack.length===previous.length+1&&same(undoStack.slice(0,-1),previous)
    :previous.length===MAX_HISTORY&&undoStack.length===MAX_HISTORY&&same(undoStack.slice(0,-1),previous.slice(1));
  if(!capture||playMode||pendingAssetImport||levels!==capture.levels||currentLevelIndex!==capture.levelIndex||redoStack.length||!same(redoStack,capture.redo)||!advanced)throw new Error('Capture requires one new edit in the same project and level, with no Undo/Redo or Play. Start again.');
  const after=JSON.parse(authoringFixtureJson(captureAssetReplacementState())),before=capture.state;
  const ui=before.project.levels?.[capture.levelIndex]?.ui,nextUi=after.project.levels?.[capture.levelIndex]?.ui;
  const owners=ui?.hudElements||[],nextOwners=nextUi?.hudElements||[];
  if(!Array.isArray(owners)||!Array.isArray(nextOwners)||owners.length!==nextOwners.length)throw new Error('Only one existing HUD offset or Menu link label edit is supported.');
  let operation=null;
  for(let index=0;index<owners.length;index++)for(const field of ['offsetX','offsetY']){
    const from=owners[index]?.[field],to=nextOwners[index]?.[field];
    if(from===to)continue;
    if(operation||!Number.isFinite(from)||!Number.isFinite(to)||typeof owners[index]?.id!=='string'||owners.filter(owner=>owner.id===owners[index].id).length!==1)throw new Error('Only one finite offset on a uniquely identified HUD element is supported.');
    operation={kind:'hud-offset',levelId:before.project.levels[capture.levelIndex].id,hudId:owners[index].id,field,from,to,index};
  }
  const pages=ui?.menuPages||[],nextPages=nextUi?.menuPages||[];
  if(!Array.isArray(pages)||!Array.isArray(nextPages)||pages.length!==nextPages.length)throw new Error('Menu page structure changed; no partial fixture.');
  for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
    const page=pages[pageIndex],links=page?.links||[],nextLinks=nextPages[pageIndex]?.links||[];
    if(!Array.isArray(links)||!Array.isArray(nextLinks)||links.length!==nextLinks.length)throw new Error('Menu link structure changed; no partial fixture.');
    for(let linkIndex=0;linkIndex<links.length;linkIndex++){
      const from=links[linkIndex]?.label,to=nextLinks[linkIndex]?.label;if(from===to)continue;
      if(operation||page.version!==1||typeof page.id!=='string'||pages.filter(record=>record?.id===page.id).length!==1||typeof from!=='string'||typeof to!=='string'||from.length>160||to.length>160||typeof links[linkIndex]?.pageId!=='string')throw new Error('Only one supported label on a uniquely identified Menu page is captured.');
      operation={kind:'menu-link-label',levelId:before.project.levels[capture.levelIndex].id,pageId:page.id,pageIndex,linkIndex,targetPageId:links[linkIndex].pageId,field:'label',from,to};
    }
  }
  if(!operation)throw new Error('No supported HUD offset or Menu link label change was captured.');
  const expected=JSON.parse(authoringFixtureJson(before.project));
  for(const config of [expected.levels[capture.levelIndex].ui,expected.levelUi?.ui]){
    if(operation.kind==='hud-offset'){
      if(config?.hudElements?.[operation.index]?.id!==operation.hudId)throw new Error('HUD snapshot ownership is unavailable.');
      config.hudElements[operation.index][operation.field]=operation.to;
    }else{
      if(config?.menuPages?.[operation.pageIndex]?.id!==operation.pageId||config.menuPages[operation.pageIndex].links?.[operation.linkIndex]?.pageId!==operation.targetPageId)throw new Error('Menu snapshot ownership is unavailable.');
      config.menuPages[operation.pageIndex].links[operation.linkIndex].label=operation.to;
    }
  }
  if(authoringFixtureJson(expected)!==authoringFixtureJson(after.project))throw new Error('Additional or unsupported authored changes detected; no partial fixture.');
  const fixture={kind:'OpusAuthoringRegressionFixture',version:1,operation,baseline:before,expected:after.project,
    provenance:{levelId:operation.levelId,undoBefore:capture.undo.length,undoAfter:undoStack.length},
    assertions:['Independent canonical snapshot restore matches baseline','Declared ordinary field edit matches complete expected snapshot','Ordinary Undo matches complete baseline','Ordinary Redo matches complete expected snapshot'],
    unrecorded:['Other operations','Pointer gestures and timing','Gameplay','Save/Load and export acceptance'],status:'CAPTURED_NOT_CHECKED'};
  authoringFixtureJson(fixture);return fixture;
}
for(const action of ['start','finish','cancel'])document.getElementById('authoring-fixture-'+action)?.addEventListener('click',()=>{
  const status=document.getElementById('authoring-fixture-status');
  try{
    if(action==='cancel'){authoringFixtureCapture=null;status.textContent='Capture cancelled; project and history unchanged.';return;}
    if(action==='start'){authoringFixtureCapture=null;authoringFixtureCapture=prepareAuthoringFixtureCapture();status.textContent='Capturing one HUD offset or Menu link label edit. Use ordinary UI controls, then finish. Full private snapshots will be included.';return;}
    const fixture=finishAuthoringFixtureCapture(authoringFixtureCapture);
    downloadTextFile(authoringFixtureJson(fixture),'opus-authoring-regression-fixture.json');authoringFixtureCapture=null;
    status.textContent='Fixture downloaded — CAPTURED, NOT CHECKED. Run the independent editor checker before claiming a regression pass. Contains private project data.';
  }catch(error){authoringFixtureCapture=null;status.textContent=error.message||'Capture refused; project unchanged.';}
});

function authoringFixtureEqual(a,b) {
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&authoringFixtureEqual(a[key],b[key]));
}
function validateAuthoringFixture(fixture) {
  authoringFixtureJson(fixture);
  if(fixture?.kind!=='OpusAuthoringRegressionFixture'||fixture.version!==1||fixture.status!=='CAPTURED_NOT_CHECKED')throw new Error('Unsupported fixture kind, version or capture status.');
  const op=fixture.operation,project=fixture.baseline?.project,history=fixture.baseline?.history;
  if(!op||!['hud-offset','menu-link-label'].includes(op.kind)||op.from===op.to||!history?._phase039FullProject||!history._phase197AssetReplacement)throw new Error('A complete supported authoring fixture is required.');
  const owner=project?.levels?.[project.currentLevelIndex];
  if(!owner||owner.id!==op.levelId||!fixture.expected)throw new Error('Fixture owner or baseline provenance is invalid.');
  if(op.kind==='hud-offset'){
    if(!['offsetX','offsetY'].includes(op.field)||!Number.isFinite(op.from)||!Number.isFinite(op.to)||typeof op.hudId!=='string'||!Number.isInteger(op.index)||op.index<0||owner.ui?.hudElements?.[op.index]?.id!==op.hudId||owner.ui.hudElements[op.index][op.field]!==op.from||owner.ui.hudElements.filter(record=>record?.id===op.hudId).length!==1)throw new Error('Invalid HUD offset fixture provenance.');
  }else{
    const pages=owner.ui?.menuPages,page=pages?.[op.pageIndex],link=page?.links?.[op.linkIndex];
    if(op.field!=='label'||typeof op.from!=='string'||typeof op.to!=='string'||op.from.length>160||op.to.length>160||typeof op.pageId!=='string'||!Number.isInteger(op.pageIndex)||op.pageIndex<0||!Number.isInteger(op.linkIndex)||op.linkIndex<0||page?.version!==1||page.id!==op.pageId||pages.filter(record=>record?.id===op.pageId).length!==1||typeof op.targetPageId!=='string'||link?.pageId!==op.targetPageId||link.label!==op.from)throw new Error('Invalid Menu link label fixture provenance.');
  }
  return fixture;
}
function runAuthoringFixtureReplay(fixture) {
  // Never restore into a creator tab: only the opaque-origin, storage-isolated
  // disposable editor prepared below may invoke this destructive test setup.
  if(window.__OPUS_FIXTURE_SANDBOX__!==true||window.parent===window||location.origin!=='null')throw new Error('Fixture replay requires the isolated disposable editor.');
  validateAuthoringFixture(fixture);const assertions=[],op=fixture.operation;
  const equal=(expected,label)=>{if(!authoringFixtureEqual(captureAssetReplacementState().project,expected))throw new Error(label+' failed: complete authored snapshot differs.');assertions.push(label);};
  const saved=JSON.parse(JSON.stringify(fixture.baseline.history));saved._phase197AssetReplacement=false;
  loadEditorSnapshot(saved);restoreAssetReplacementLibraryMetadata(saved._phase197LibraryMetadata);undoStack.length=0;redoStack.length=0;updateUndoRedoButtons();
  equal(fixture.baseline.project,'Independent canonical baseline restore');
  setEditorVisible(true);activateTab('right-tab','ui');let input;
  if(op.kind==='hud-offset'){
    renderHudElementList();const rows=Array.from(document.querySelectorAll('#hud-element-list [data-hud-id]')).filter(row=>row.dataset.hudId===op.hudId);
    if(rows.length!==1)throw new Error('HUD owner is missing or ambiguous.');input=rows[0].querySelector('[data-hud-field="'+op.field+'"]');
  }else{
    renderMenuPageEditor();const pageIndex=menuPageRecords().findIndex(page=>page.id===op.pageId);
    input=document.querySelector('#menu-page-list [data-menu-index="'+pageIndex+'"] [data-menu-link-label="'+op.linkIndex+'"]');
  }
  if(!input||input.disabled)throw new Error('Declared ordinary authoring control is unavailable.');
  input.focus();input.value=String(op.to);input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();
  if(undoStack.length!==1||redoStack.length)throw new Error('Ordinary field edit must create exactly one Undo.');
  equal(fixture.expected,'Declared ordinary control edit');undo();equal(fixture.baseline.project,'Ordinary Undo');redo();equal(fixture.expected,'Ordinary Redo');
  return {status:'PASS',assertions,unrecorded:['Other authoring operations','Pointer gestures and timing','Gameplay','Save/Load and exports']};
}
function authoringFixtureSandboxBootstrap(token) {
  // Trusted static bootstrap only. Fixture JSON arrives through structured clone,
  // never interpolated into executable HTML. The sandbox has no same-origin grant.
  try{
    for(const key of ['localStorage','sessionStorage']){const values=new Map();Object.defineProperty(window,key,{value:{getItem:name=>values.has(String(name))?values.get(String(name)):null,setItem:(name,value)=>values.set(String(name),String(value)),removeItem:name=>values.delete(String(name)),clear:()=>values.clear(),key:index=>Array.from(values.keys())[index]||null,get length(){return values.size;}},configurable:false});}
    window.__OPUS_FIXTURE_SANDBOX__=true;
    window.addEventListener('message',function receive(event){if(event.source!==parent||event.data?.token!==token||event.data?.type!=='run-fixture')return;window.removeEventListener('message',receive);let result;try{result=runAuthoringFixtureReplay(event.data.fixture);}catch(error){result={status:'FAIL',message:error.message||'Independent check failed.'};}parent.postMessage({token,type:'fixture-result',result},'*');});
    window.addEventListener('load',()=>parent.postMessage({token,type:'fixture-ready'},'*'),{once:true});
  }catch(error){parent.postMessage({token,type:'fixture-result',result:{status:'FAIL',message:'Isolated storage is unavailable; no check performed.'}},'*');}
}
function cancelAuthoringFixtureCheck(message) {
  const job=authoringFixtureCheck;if(!job)return;
  const restoreFocus=job.frame&&document.activeElement===job.frame;
  authoringFixtureCheck=null;clearTimeout(job.timer);if(job.receive)window.removeEventListener('message',job.receive);job.frame?.remove();
  if(restoreFocus&&job.focus?.isConnected&&!job.focus.disabled)job.focus.focus({preventScroll:true});
  if(message)document.getElementById('authoring-fixture-status').textContent=message;
}
async function checkSavedAuthoringFixture(file) {
  cancelAuthoringFixtureCheck();const status=document.getElementById('authoring-fixture-status');let job;
  try{
    if(playMode||pendingAssetImport)throw new Error('Stop Play and finish imports before checking a fixture.');
    if(!file||file.size>33554432)throw new Error('Missing or oversized fixture file.');
    job={levels,project:authoringFixtureJson(captureAssetReplacementState().project),undo:undoStack.slice(),redo:redoStack.slice(),focus:document.activeElement};authoringFixtureCheck=job;
    job.timer=setTimeout(()=>{if(authoringFixtureCheck===job)cancelAuthoringFixtureCheck('Check timed out; disposable editor closed. No passing result.');},30000);
    status.textContent='Reading saved fixture. No check result yet.';
    const current=()=>authoringFixtureCheck===job&&!playMode&&levels===job.levels&&authoringFixtureJson(captureAssetReplacementState().project)===job.project&&undoStack.length===job.undo.length&&redoStack.length===job.redo.length&&undoStack.every((entry,index)=>entry===job.undo[index])&&redoStack.every((entry,index)=>entry===job.redo[index]);
    const fixture=validateAuthoringFixture(JSON.parse(await file.text()));if(!current())throw new Error('Project changed or check cancelled; no check performed.');
    status.textContent='Preparing isolated editor check. Your project is not replayed or changed. Cancel closes the copy.';
    // Existing canonical one-file composer, with a neutral built-in project, not
    // serialization/mutation of the live creator document or untrusted fixture.
    const html=await buildExportHTML(false,JSON.stringify(OpusSpriteStarters.instantiate('platformer-sky-steps').project));
    if(!current())throw new Error('Project changed or check cancelled; no check performed.');
    const token=Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'),frame=document.createElement('iframe');job.frame=frame;
    frame.setAttribute('sandbox','allow-scripts');frame.title='Disposable authoring regression check';frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-100000px;width:1280px;height:960px;border:0;';
    job.receive=event=>{if(authoringFixtureCheck!==job||event.source!==frame.contentWindow||event.data?.token!==token)return;
      try{if(!current()){cancelAuthoringFixtureCheck('Project changed during check; result discarded.');return;}
        if(event.data.type==='fixture-ready'){frame.contentWindow.postMessage({type:'run-fixture',token,fixture},'*');return;}
        if(event.data.type==='fixture-result'){const result=event.data.result;cancelAuthoringFixtureCheck(result?.status==='PASS'?'PASS — independent canonical restore, declared ordinary field edit, complete Undo and Redo snapshots. HUD offset or Menu link label only; not gameplay, Save/Load or export acceptance.':'FAIL — '+(result?.message||'Independent check unavailable.'));}
      }catch(error){cancelAuthoringFixtureCheck('FAIL — '+error.message);}
    };
    window.addEventListener('message',job.receive);
    const bootstrap='('+authoringFixtureSandboxBootstrap.toString()+')('+JSON.stringify(token)+');';
    // Nonce only the trusted composed editor scripts, before any fixture data
    // arrives. No unsafe-inline scripts, event attributes or eval are granted.
    const nonce=token.replace(/-/g,''),parsed=new DOMParser().parseFromString(html,'text/html');
    for(const script of parsed.querySelectorAll('script'))script.setAttribute('nonce',nonce);
    const policy=parsed.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none';";
    const setup=parsed.createElement('script');setup.setAttribute('nonce',nonce);setup.textContent=bootstrap;parsed.head.prepend(policy,setup);
    frame.srcdoc='<!doctype html>'+parsed.documentElement.outerHTML;
    document.body.appendChild(frame);
  }catch(error){if(job&&authoringFixtureCheck!==job)return;cancelAuthoringFixtureCheck();status.textContent='FAIL — '+(error.message||'Fixture check refused.');}
}
document.getElementById('authoring-fixture-check')?.addEventListener('click',()=>{if(playMode){showStatus('Stop Play before checking a fixture.');return;}document.getElementById('authoring-fixture-check-file').click();});
document.getElementById('authoring-fixture-check-file')?.addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';if(file)checkSavedAuthoringFixture(file);});
document.getElementById('authoring-fixture-check-cancel')?.addEventListener('click',()=>cancelAuthoringFixtureCheck('Isolated check cancelled; disposable editor closed. Project and history unchanged.'));

document.getElementById('validate-project-btn').addEventListener('click', () => {
  if(playMode){showStatus('Stop Play before reviewing Problems.');return;}
  const result = validateCurrentProject();
  showStatus(result.issues.length ? `Validation found ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}` : 'Validation passed');
});
for(const id of ['project-problems-severity','project-problems-scope','project-problems-search']) document.getElementById(id).addEventListener(id.endsWith('search') ? 'input' : 'change', () => renderProjectValidation(lastProjectValidation?.issues || []));
document.getElementById('problems-btn').addEventListener('click', () => {
  if(playMode){showStatus('Stop Play before reviewing Problems.');return;}
  activateTab('right-tab','project');
  const body=document.querySelector('[data-section-body="validation"]');
  if(body?.classList.contains('collapsed'))document.querySelector('[data-section="validation"]').click();
  validateCurrentProject();
  document.getElementById('validate-project-btn').scrollIntoView({block:'start'});
});

// A round-tripped environment's `lightDir` comes back from JSON as a plain
// {x,y,z} object, not a real Opus.Vec3 instance -- App.setEnvironment
// validates `instanceof Vec3`, so passing it through unreconstructed would
// throw the moment a saved project with a customized environment reloads.
function normalizeEnvironment(env) {
  if (!env) return null;
  const out = { ...env };
  const post=env.postProcessing;
  if(post!==undefined&&(!post||typeof post!=='object'||Array.isArray(post)))throw new Error('Scene Look: expected enabled, exposure and saturation settings.');
  for(const [key,value]of Object.entries(post||{})){if(key==='enabled'){if(typeof value!=='boolean')throw new Error('Scene Look: enabled must be true or false.');}else if(key==='exposure'){if(!Number.isFinite(value)||value<-4||value>4)throw new Error('Scene Look: exposure must be -4 to 4 stops.');}else if(key==='saturation'){if(!Number.isFinite(value)||value<0||value>2)throw new Error('Scene Look: saturation must be 0 to 2.');}else throw new Error('Scene Look: unavailable setting '+key);}
  out.postProcessing={enabled:false,exposure:0,saturation:1,...(post||{})};
  const lighting2D=env.lighting2D;
  if(lighting2D!==undefined&&(!lighting2D||typeof lighting2D!=='object'||Array.isArray(lighting2D)))throw new Error('2D lighting: expected enabled and ambient settings.');
  for(const [key,value]of Object.entries(lighting2D||{})){if(key==='enabled'){if(typeof value!=='boolean')throw new Error('2D lighting: enabled must be true or false.');}else if(key==='ambient'){if(!Number.isFinite(value)||value<0||value>1)throw new Error('2D lighting: ambient must be 0 to 1.');}else throw new Error('2D lighting: unavailable setting '+key);}
  out.lighting2D={enabled:false,ambient:.25,...(lighting2D||{})};
  if (out.lightDir && !(out.lightDir instanceof Opus.Vec3)) out.lightDir = new Opus.Vec3(out.lightDir.x, out.lightDir.y, out.lightDir.z);
  return out;
}

// The ONE normalization path every generation of project data this editor
// has ever produced funnels through -- a raw array (oldest), `{objects,
// prefabs}` (pre-levels), unversioned `{levels, currentLevelIndex,
// prefabs}` (Wave 2), and the current versioned/asset-bearing shape (Wave
// 3) -- so loading never needs a second migration path scattered elsewhere,
// and NEVER mutates the caller's `parsed` object (the original imported
// file stays exactly as the user provided it; only the in-memory result of
// this function reflects the current shape). An unrecognized future
// `version` fails loudly rather than guessing at a shape it doesn't know.
// Validate constructor prerequisites before clearing creator-owned state.
// Unknown components and missing asset references remain recoverable.
function validateImportedSceneRecords(records, label, prefabRoot = false) {
  if (!Array.isArray(records)) throw new Error(`${label}: expected an object list`);
  const vector = (value, length, field) => {
    if (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite)) throw new Error(`${field}: expected ${length} finite numbers`);
  };
  records.forEach((record, index) => {
    const at = `${label}, object ${index + 1}`;
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`${at}: expected an object record`);
    const kind = prefabRoot && record.kind === undefined ? 'cube' : record.kind;
    // Single Prefab placement supplies its own world position; historical
    // roots need not store one. Scene/assembly records still require it.
    if ((kind === 'cube' || kind === 'sprite') && (!prefabRoot || record.position !== undefined)) vector(record.position, 3, `${at} position`);
    if (kind === 'cube') {
      vector(record.scale, 3, `${at} scale`);
      vector(record.color, 3, `${at} color`);
      for (const field of ['patrol', 'ai']) if (record[field]) vector(record[field].base, 3, `${at} ${field}.base`);
      if (record.mesh === 'custom' && record.customMesh) {
        for (const field of ['positions', 'normals', 'indices']) if (!Array.isArray(record.customMesh[field]) || !record.customMesh[field].every(Number.isFinite)) throw new Error(`${at} customMesh.${field}: expected a numeric array`);
      }
    }
    for (const field of ['scale', 'localPosition', 'localScale', 'emissiveColor']) if (record[field]) vector(record[field], 3, `${at} ${field}`);
    for (const field of ['quaternion', 'localQuat']) if (record[field]) vector(record[field], 4, `${at} ${field}`);
    for (const field of ['uvScale', 'uvOffset']) if (record[field]) vector(record[field], 2, `${at} ${field}`);
    for (const field of ['tags', 'pointIds']) if (record[field] && !Array.isArray(record[field])) throw new Error(`${at} ${field}: expected an array`);
    if (record.options) {
      for (const field of ['position', 'direction']) if (record.options[field]) vector(record.options[field], 3, `${at} options.${field}`);
    }
    if ((kind === 'spawner' || kind === 'light') && !record.options?.position) throw new Error(`${at} options.position: required`);
  });
}

function validateImportedPrefabs(bundled) {
  if (!Array.isArray(bundled)) return;
  for (const entry of bundled) {
    if (!entry || !entry.name || !entry.record) continue;
    validateImportedSceneRecords([entry.record], `Prefab ${entry.name}`, true);
    if (entry.records !== undefined) validateImportedSceneRecords(entry.records, `Prefab ${entry.name}`);
  }
}

function normalizeProjectData(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('not a valid project file');
  let newLevels;
  let newIndex = 0;
  let newStartIndex = 0;
  let newLevelTransition = { mode: 'instant', duration: 0.4 };
  let bundledPrefabs;
  let assets;
  let textures;
  let sprites;
  let spriteAnimations;
  let loadedTilesets;
  let loadedTilemapChunks;
  let audio;
  let meta;
  let newInputActionMap;
  let itemDefs = [];
  let newSpriteSortingLayers;
  let newParallaxLayers;
  if (Array.isArray(parsed)) {
    newLevels = [{ name: 'Level 1', objects: parsed, environment: null, playerSettings: null, ui: null, description: '', ambientAudio: null }];
  } else if (Number.isInteger(parsed.version) && parsed.version > PROJECT_FORMAT_VERSION) {
    throw new Error(`This project was saved by a newer version of the editor (format version ${parsed.version}, this editor supports up to ${PROJECT_FORMAT_VERSION}). Open it in a newer editor build.`);
  } else if (Array.isArray(parsed.levels)) {
    newLevels = parsed.levels.map((l) => ({ id: l.id, name: l.name || 'Level', objects: Array.isArray(l.objects) ? l.objects : [], environment: normalizeEnvironment(l.environment), playerSettings: l.playerSettings || null, ui: l.ui || null, description: l.description || '', ambientAudio: l.ambientAudio || null, sequences: Array.isArray(l.sequences) ? l.sequences : [], objectiveDefs: Array.isArray(l.objectiveDefs) ? l.objectiveDefs : [], scatterLayers: Array.isArray(l.scatterLayers) ? l.scatterLayers : [] }));
    if (Number.isInteger(parsed.currentLevelIndex) && parsed.currentLevelIndex >= 0 && parsed.currentLevelIndex < newLevels.length) newIndex = parsed.currentLevelIndex;
    newStartIndex = (Number.isInteger(parsed.startLevelIndex) && parsed.startLevelIndex >= 0 && parsed.startLevelIndex < newLevels.length) ? parsed.startLevelIndex : 0;
    bundledPrefabs = parsed.prefabs;
    assets = parsed.assets;
    textures = parsed.textures;
    sprites = parsed.spriteAssets;
    spriteAnimations = parsed.spriteAnimations;
    loadedTilesets = parsed.tilesets;
    loadedTilemapChunks = parsed.tilemapChunks;
    audio = parsed.audio;
    meta = parsed.meta;
    newInputActionMap = parsed.inputActionMap;
    itemDefs = Array.isArray(parsed.itemDefs) ? JSON.parse(JSON.stringify(parsed.itemDefs)) : [];
    newSpriteSortingLayers = parsed.spriteSortingLayers;
    newParallaxLayers = parsed.parallaxLayers;
    if (parsed.levelTransition && (parsed.levelTransition.mode === 'instant' || parsed.levelTransition.mode === 'fade')) newLevelTransition = { mode: parsed.levelTransition.mode, duration: parsed.levelTransition.duration > 0 ? parsed.levelTransition.duration : 0.4 };
  } else if (Array.isArray(parsed.objects)) {
    newLevels = [{ name: 'Level 1', objects: parsed.objects, environment: null, playerSettings: null, ui: null, description: '', ambientAudio: null }];
    bundledPrefabs = parsed.prefabs;
  } else {
    throw new Error('not a valid project file');
  }
  return { levels: newLevels, currentLevelIndex: newIndex, startLevelIndex: newStartIndex, levelTransition: newLevelTransition, prefabs: bundledPrefabs, assets, textures, sprites, spriteAnimations, tilesets: loadedTilesets, tilemapChunks: loadedTilemapChunks, audio, meta, inputActionMap: newInputActionMap, itemDefs, collisionLayers: OpusCollisionFilter2D.normalizeLayers(parsed && parsed.collisionLayers), spriteSortingLayers: OpusAuthoringPlumbing.normalizeSpriteSortingLayers(newSpriteSortingLayers), parallaxLayers: OpusAuthoringPlumbing.normalizeParallaxLayers(newParallaxLayers) };
}

function releaseRetiredProjectTextures(records) {
  if(!records)return;
  const live=new Set(textureAssets.map(record=>record.textureHandle).filter(Boolean)),released=new Set();
  for(const record of records){const handle=record.textureHandle;if(handle&&!live.has(handle)&&!released.has(handle)){app.destroyTexture(handle);released.add(handle);}if(handle&&!live.has(handle))record.textureHandle=null;}
}
function resetFullProjectSpriteLibraries(sprites,clips) {
  // These CPU-only libraries belong to the same declared document as Textures.
  // Keeping old Sprite owners after replacing Textures creates dangling refs.
  if(Array.isArray(sprites))spriteAssets=[];
  if(Array.isArray(clips))spriteAnimationClips=[];
}
function restoreFullProjectPrefabLibrary(bundled) {
  // Called only after full-project validation. A declared library belongs to
  // that saved document, like its Tilesets. Do not overwrite the legacy
  // browser-local cache, or import its conflicting definitions into this one.
  // Old projects that omit a library retain the historical local fallback.
  if(!Array.isArray(bundled))return false;
  prefabs=JSON.parse(JSON.stringify(bundled));renderPrefabPalette();return true;
}
function loadProjectFull(parsed, sourceLabel) {
  const normalized = normalizeProjectData(parsed);
  if (!normalized.levels.length) throw new Error('Project must contain at least one level');
  normalized.levels.forEach((level, index) => validateImportedSceneRecords(level.objects, `Level ${index + 1}`));
  validateImportedPrefabs(normalized.prefabs);
  validatePortableProjectAssetExtras(parsed);
  restoreFullProjectPrefabLibrary(normalized.prefabs);
  // Tile migrations below must not mutate the caller's saved project.
  normalized.levels = JSON.parse(JSON.stringify(normalized.levels));
  ensureLevelIds(normalized.levels);
  const loadedPreferenceScope = OpusPlayerRebindScreen.scope(parsed);
  materialAssets=copyMaterialAssets(parsed.materialAssets);
  nextMaterialAssetId=Number.isSafeInteger(parsed.nextMaterialAssetId)&&parsed.nextMaterialAssetId>0?parsed.nextMaterialAssetId:1;
  for(const material of materialAssets){const match=/^material-(\d+)$/.exec(material?.id||'');if(match&&Number.isSafeInteger(Number(match[1])))nextMaterialAssetId=Math.max(nextMaterialAssetId,Number(match[1])+1);}
  componentPresets = copyComponentPresetLibrary(parsed.componentPresets);
  uiTemplates = copyUiTemplateLibrary(parsed.uiTemplates);
  cameraTemplates = copyCameraTemplateLibrary(parsed.cameraTemplates);
  cinematicTemplates = JSON.parse(JSON.stringify(Array.isArray(parsed.cinematicTemplates)?parsed.cinematicTemplates:[]));
  controllerTemplates = copyControllerTemplateLibrary(parsed.controllerTemplates);
  aiArchetypes = copyAiArchetypeLibrary(parsed.aiArchetypes);
  combatEncounterTemplates = copyCombatEncounterLibrary(parsed.combatEncounterTemplates);
  weaponDefinitions = copyWeaponDefinitionLibrary(parsed.weaponDefinitions);
  nextWeaponDefinitionId = Number.isSafeInteger(parsed.nextWeaponDefinitionId)&&parsed.nextWeaponDefinitionId>0?parsed.nextWeaponDefinitionId:1;
  // Do not reuse removed IDs that still exist on imported owners.
  for(const level of parsed.levels||[])for(const owner of [level.playerSettings?.weapon,...(level.playerSettings?.equipmentDefs||[]).map(eq=>eq?.weapon)]){const match=/^weapon-(\d+)$/.exec(owner?.definitionRef||'');if(match&&Number.isSafeInteger(Number(match[1])))nextWeaponDefinitionId=Math.max(nextWeaponDefinitionId,Number(match[1])+1);}
  playerPreferenceScope = loadedPreferenceScope;
  playerInputOverrides = {}; playerRebindingAction = null;
  graphFunctions = Array.isArray(parsed.graphFunctions) ? OpusGraphSchema.library(parsed.graphFunctions) : [];
  signalRuntime.clear();signalDefinitions=OpusSignals.copy(parsed.signals);renderSignalManager();
  collisionLayers = OpusCollisionFilter2D.normalizeLayers(parsed && parsed.collisionLayers);
  renderCollisionLayerManager();
  loadingProjectGuard = true;
  levels = normalized.levels;
  resetPerformanceProfilerForProject();
  currentLevelIndex = normalized.currentLevelIndex;
  startLevelIndex = normalized.startLevelIndex;
  levelTransitionConfig = normalized.levelTransition;
  spriteSortingLayers = normalized.spriteSortingLayers;
  for (const layer of spriteSortingLayers) reconcileSpriteSortingLayerIdCounter(layer.id);
  renderSpriteSortingLayerManager();
  parallaxLayers = normalized.parallaxLayers;
  for (const layer of parallaxLayers) reconcileParallaxLayerIdCounter(layer.id);
  renderParallaxLayerManager();
  document.getElementById('level-transition-mode').value = levelTransitionConfig.mode;
  document.getElementById('level-transition-duration').value = levelTransitionConfig.duration;
  projectMeta = normalized.meta ? { ...defaultProjectMeta(), ...normalized.meta } : defaultProjectMeta();
  renderProjectMetaPanel();
  // A project saved before Wave 5 has an inputActionMap with only
  // interact/attack (or none at all) -- merged over INPUT_ACTION_DEFAULTS
  // so every new action (moveForward/Back/Left/Right/jump) still gets its
  // exact pre-Wave-5 hardcoded key, never `undefined`.
  inputActionMap = { ...INPUT_ACTION_DEFAULTS, ...(normalized.inputActionMap || {}) };
  inputActionAssets = copyInputActionAssets(parsed.inputActionAssets);
  inputContexts = copyInputContexts(parsed.inputContexts);
  inputContextRuntime = null; editingInputContextId = '';
  inputDeviceMappings = copyInputDeviceMappings(parsed.inputDeviceMappings);
  inputDeviceRuntime=null;
  inputActionSets = copyInputActionSets(parsed.inputActionSets);
  reconcileInputActionAssetIds(parsed);
  rebindingAction = null;
  renderInputActionPanel();
  // Wave 8 (Priority D): project-level, not per-level -- loaded once here,
  // like prefabs/assets, not inside applyLevel*() the way Objectives (a
  // deliberately per-level registry) are.
  currentItemDefs = Array.isArray(normalized.itemDefs) ? JSON.parse(JSON.stringify(normalized.itemDefs)) : [];
  restoreItemDefinitionAllocator(parsed);
  lootTables = copyLootLibrary(parsed.lootTables);
  inventoryTemplates = copyInventoryTemplateLibrary(parsed.inventoryTemplates);
  lootDrawCounters = Object.create(null);
  renderLootTableList();
  renderItemDefList();
  const retiredProjectModels=Array.isArray(normalized.assets)?assets:null;
  if(retiredProjectModels)assets=[];
  loadAssets(normalized.assets,retiredProjectModels||[]);
  const retiredProjectTextures=Array.isArray(normalized.textures)?textureAssets:null;
  if(retiredProjectTextures)textureAssets=[];
  loadTextureAssets(normalized.textures,retiredProjectTextures||[]);
  resetFullProjectSpriteLibraries(normalized.sprites,normalized.spriteAnimations);
  loadSpriteAssets(normalized.sprites);
  loadSpriteAnimationClips(normalized.spriteAnimations);
  // A full-project load is a replacement boundary, not the additive import
  // path used by Tilemap bundles.  Keeping the currently embedded Tileset
  // with the same stable id caused saved Tile edits to be skipped by
  // loadTilesets(), so an Editable export could save a newly-authored slope
  // Tile and then silently restore the older embedded Tileset on reload.
  tilesets = [];
  selectedTilesetId = null;
  activeTilesetId = null;
  loadTilesets(normalized.tilesets);
  loadTilemapChunks(normalized.tilemapChunks);
  // Tilemap v1-v3 records migrate to v4 without inventing membership or
  // Spawn Markers. Valid auto-managed cells rebuild derived Tile cache before the
  // scene is instantiated; broken Set/default records retain stored art.
  for (const level of levels) level.objects = (level.objects || []).map((object) => object && object.kind === 'tilemap' ? { ...object, ...OpusAuthoringPlumbing.createTilemapRecord(object) } : object);
  OpusAuthoringPlumbing.recomputeProjectTerrain({ levels, tilesets });
  OpusAuthoringPlumbing.recomputeProjectAutoTiles({ levels, tilesets });
  for (const tileset of tilesets) OpusAuthoringPlumbing.recomputeProjectTilemapChunks({ tilemapChunks, tilesets }, tileset.id);
  const retiredProjectAudio=Array.isArray(normalized.audio)?audioAssets:null;
  if(retiredProjectAudio)audioAssets=[];
  loadAudioAssets(normalized.audio,retiredProjectAudio||[]);
  loadProjectData(levels[currentLevelIndex].objects, sourceLabel, normalized.prefabs, parsed);
  loadingProjectGuard = false;
  applyLevelEnvironment(currentLevelIndex);
  applyLevelPlayerSettings(currentLevelIndex);
  applyLevelUiConfig(currentLevelIndex);
  applyLevelSequences(currentLevelIndex);
  applyLevelObjectiveDefs(currentLevelIndex);
  applyLevelScatterLayers(currentLevelIndex);
  applyLevelAmbientAudio(currentLevelIndex);
  renderLevelList();
  renderCollisionLayerManager();
  releaseRetiredProjectTextures(retiredProjectTextures);
  // Scene reconstruction has retired old instances. The canonical renderer
  // still refuses releasing any mesh referenced by a live instance.
  if(retiredProjectModels){const liveHandles=new Set(assets.map(record=>record.meshHandle).filter(Boolean));releaseRetiredModelAssets(retiredProjectModels.filter(record=>!liveHandles.has(record.meshHandle)));}
  resetProjectDurability();
}

