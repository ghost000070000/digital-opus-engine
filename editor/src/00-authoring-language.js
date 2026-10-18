/* Digital Opus canonical no-code authoring language. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OpusAuthoringLanguage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CATEGORIES = Object.freeze(['Object', 'Transform', 'Gameplay', 'State', 'Inventory', 'Combat', 'Audio', 'Visual', 'Camera', 'UI', 'Level', 'Save', 'Advanced']);
  const TAXONOMY = Object.freeze([
    { id: 'object', label: 'Object', help: 'An entity placed in a scene.' },
    { id: 'component', label: 'Component', help: 'Reusable capability and data attached to an eligible Object.' },
    { id: 'event', label: 'Event', help: 'Something that happened and can start logic.' },
    { id: 'condition', label: 'Condition', help: 'A question that returns true or false.' },
    { id: 'action', label: 'Action', help: 'An operation requested by logic.' },
    { id: 'behavior', label: 'Behavior', help: 'A local reaction made from an Event, optional Conditions, and Actions.' },
    { id: 'variable', label: 'Variable', help: 'Named state owned by a project, Object, or system.' },
    { id: 'signal', label: 'Signal', help: 'A named communication event for reusable, decoupled logic.' },
    { id: 'preset', label: 'Preset', help: 'A reusable composition that configures Components, Behaviors, and settings for a gameplay role.' },
    { id: 'template', label: 'Template', help: 'A larger starting structure for a project, level, or genre.' },
    { id: 'sequence', label: 'Sequence', help: 'Ordered or time-based presentation and gameplay steps.' },
    { id: 'visual-graph', label: 'Visual Graph', help: 'A graph for complex branching and state orchestration.' },
    { id: 'custom-script', label: 'Custom Script', help: 'The advanced code escape hatch for logic outside the curated vocabulary.' },
  ]);

  const COMPONENTS = Object.freeze([
    { id: 'health', label: 'Health', category: 'Combat', help: 'Adds maximum/current health and damage/death behavior.', aliases: ['Object Health'] },
    { id: 'trigger', label: 'Trigger Volume', category: 'Gameplay', help: 'Detects objects entering, staying in, or leaving a bounded area.', aliases: ['Trigger'] },
    { id: 'particle-emitter', label: 'Particle Emitter', category: 'Visual', help: 'Emits a configurable visual particle effect.', aliases: ['Emitter'] },
    { id: 'trigger-collider-2d', label: 'Trigger Collider 2D', category: 'Gameplay', help: 'Detects ordinary Collider 2D objects without blocking them.', aliases: ['2D Trigger'] },
    { id: 'body-2d', label: 'Body 2D', category: 'Gameplay', help: 'Makes Collider 2D geometry Static or moves it Kinematically against Static Bodies.', aliases: ['2D Body'] },
  ]);

  const EVENTS = Object.freeze([
    { id: 'click', label: 'On Click', category: 'Gameplay', help: 'Runs when the Object is clicked.', aliases: [] },
    { id: 'enter', label: 'On Trigger Enter', category: 'Gameplay', help: 'Runs when another Object enters this Object\'s trigger area.', aliases: ['On Enter'] },
    { id: 'exit', label: 'On Trigger Exit', category: 'Gameplay', help: 'Runs when another Object leaves this Object\'s trigger area.', aliases: ['On Exit'] },
    { id: 'start', label: 'On Start', category: 'Gameplay', help: 'Runs when the level starts.', aliases: [] },
    { id: 'update', label: 'On Update', category: 'Gameplay', help: 'Runs once per active simulation tick. Paused, stopped and ended games do not dispatch it.', aliases: ['On Tick'] },
    { id: 'stay', label: 'On Trigger Stay', category: 'Gameplay', help: 'Runs every frame while another Object remains in the trigger area.', aliases: ['On Stay'] },
    { id: 'interact', label: 'On Interact', category: 'Gameplay', help: 'Runs when the player uses Interact while in range.', aliases: ['Interact'] },
    { id: 'spriteAnimationEvent', label: 'On Sprite Animation Event', category: 'Visual', help: 'Runs when one named frame event is entered by one specific Sprite Object and Clip.', aliases: ['On Animation Event'] },
    { id: 'trigger2DEnter', label: 'On Trigger 2D Enter', category: 'Gameplay', help: 'Runs once when an eligible Collider 2D Object enters this Object\'s Trigger Collider 2D.', aliases: ['On 2D Enter'] },
    { id: 'trigger2DStay', label: 'On Trigger 2D Stay', category: 'Gameplay', help: 'Runs once per simulation tick while an eligible Collider 2D Object remains inside.', aliases: ['On 2D Stay'] },
    { id: 'trigger2DExit', label: 'On Trigger 2D Exit', category: 'Gameplay', help: 'Runs once when an eligible Collider 2D Object leaves this Object\'s Trigger Collider 2D.', aliases: ['On 2D Exit'] },
    { id: 'signal', label: 'On Signal', category: 'Gameplay', help: 'Runs once for each queued occurrence of the chosen named Signal on this active level. Repeated sends remain distinct.', aliases: [] },
    { id: 'controllerStateEvent', label: 'On Controller State', category: 'Gameplay', help: 'Runs once when this level\'s Player enters a chosen resolved movement or grounding state. Blocked input is not movement; Airborne also includes walking off an edge.', aliases: [] },
  ]);

  const PRESETS = Object.freeze([
    { id: 'collectible', label: 'Collectible', category: 'Gameplay', help: 'Creates a visible pickup that increments score.' },
    { id: 'healthPickup', label: 'Health Pickup', category: 'Combat', help: 'Creates a pickup that restores player health.' },
    { id: 'damageHazard', label: 'Damage Hazard', category: 'Combat', help: 'Creates a visible hazard that damages the player.' },
    { id: 'checkpointPreset', label: 'Checkpoint', category: 'Gameplay', help: 'Creates a checkpoint that updates the player respawn position.' },
    { id: 'door', label: 'Proximity Door', category: 'Gameplay', help: 'Creates a solid panel that hides once when approached. Hidden legacy solid panels are passable; this preset does not animate or automatically close.', aliases: ['Door', 'Sliding Door'] },
    { id: 'enemy', label: 'Enemy', category: 'Combat', help: 'Creates a basic damageable enemy with follow behavior.' },
    { id: 'movingPlatform', label: 'Moving Platform', category: 'Gameplay', help: 'Creates a solid platform with a looping movement animation.' },
    { id: 'projectilePreset', label: 'Projectile Starter', category: 'Combat', help: 'Creates an Object ready to save as a projectile Prefab.', aliases: ['Projectile'] },
  ]);

  const ACTION_LABELS = Object.freeze({
    boost: 'Apply Boost',
    cameraShake: 'Shake Camera',
    moveObject: 'Move Object',
    rotateObject: 'Rotate Object',
    setVisibility: 'Set Object Visibility',
    freezePlayer: 'Freeze Player',
    setAmbientAudio: 'Set Ambient Audio',
    spawnOnceFromSpawner: 'Spawn Once from Spawner',
    clearSaveGame: 'Clear Saved Game',
    countTagged: 'Count Tagged Objects',
    script: 'Run Custom Script',
  });
  const ACTION_ALIASES = Object.freeze({
    sound: ['Play Audio'],
    boost: ['Boost Pad'],
    cameraShake: ['Camera Shake'],
    moveObject: ['Move Object (relative)'],
    rotateObject: ['Rotate Object (relative Y)'],
    setVisibility: ['Show/Hide Object'],
    freezePlayer: ['Freeze Player (for a cutscene)'],
    setAmbientAudio: ['Set Ambient Audio (Zone)'],
    spawnOnceFromSpawner: ['Spawn Once'],
    clearSaveGame: ['Clear Save'],
    countTagged: ['Count Tagged Into Counter'],
    script: ['Advanced: Custom Script'],
    fireWeapon: ['Fire Weapon'],
    win: ['Win Game'],
  });

  const CONDITION_LABELS = Object.freeze({
    and: 'All Conditions Are True', or: 'Any Condition Is True', not: 'Condition Is False',
    counterReaches: 'Counter Is At Least', counterAtMost: 'Counter Is At Most', counterEquals: 'Counter Equals',
    counterLessThan: 'Counter Is Less Than', counterGreaterThan: 'Counter Is Greater Than',
    healthAtLeast: 'Player Health Is At Least', healthAtMost: 'Player Health Is At Most',
    objectHealthAtLeast: 'Object Health Is At Least', objectHealthAtMost: 'Object Health Is At Most',
    timerFinished: 'Timer Is Finished', timerAtLeast: 'Timer Is At Least', timerAtMost: 'Timer Is At Most',
    isFlagTrue: 'Flag Is Set', isFlagFalse: 'Flag Is Clear', objectVisible: 'Object Is Visible',
    numberAtLeast: 'Object Variable Is At Least', numberAtMost: 'Object Variable Is At Most',
    booleanIs: 'Object Variable Boolean Is',
    distanceToPlayerAtMost: 'Player Is Within Distance', distanceToPlayerAtLeast: 'Player Is Beyond Distance',
    lineOfSightToPlayer: 'Has Line of Sight to Player', noLineOfSightToPlayer: 'Has No Line of Sight to Player',
    timeInStateAtLeast: 'Time in State Is At Least', canSeePlayer: 'Can See Player', cannotSeePlayer: 'Cannot See Player',
    heardNoiseRecently: 'Heard Noise Recently',
  });
  const CONDITION_ALIASES = Object.freeze({
    and: ['AND'], or: ['OR'], not: ['NOT'], counterReaches: ['Counter Reaches (>=)', 'Counter at least'],
    counterAtMost: ['Counter At Most (<=)', 'Counter at most'], healthAtLeast: ['Health At Least (>=)', 'Health at least'],
    healthAtMost: ['Health At Most (<=)', 'Health at most'], objectHealthAtLeast: ['Object Health At Least (>=)'],
    objectHealthAtMost: ['Object Health At Most (<=)'], timerFinished: ['Timer Finished'], timerAtLeast: ['Timer At Least (>=)'],
    timerAtMost: ['Timer At Most (<=)'], isFlagTrue: ['Is Flag True', 'Flag is true'], isFlagFalse: ['Is Flag False', 'Flag is false'],
    objectVisible: ['Object Visible'], numberAtLeast: ['Object Variable Number At Least'], numberAtMost: ['Object Variable Number At Most'],
  });

  function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
  function normalize(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }

  function categoryForAction(id) {
    if (/sound|audio/i.test(id)) return 'Audio';
    if (/health|damage|heal|weapon|projectile/i.test(id)) return 'Combat';
    if (/item|equip|inventory|held|pickup|drop/i.test(id)) return 'Inventory';
    if (/camera/i.test(id)) return 'Camera';
    if (/hud|dialogue|message/i.test(id)) return 'UI';
    if (/level|checkpoint|respawn/i.test(id)) return 'Level';
    if (/save|load|autosave/i.test(id)) return 'Save';
    if (/counter|flag|timer|variable|objective/i.test(id)) return 'State';
    if (/color|visibility|animation|emitter|fog/i.test(id)) return 'Visual';
    if (/position|rotate|scale|moveTo|rotateTo|scaleTo|moveObject/i.test(id)) return 'Transform';
    if (id === 'script') return 'Advanced';
    return 'Gameplay';
  }

  function categoryForCondition(id) {
    if (/health/i.test(id)) return 'Combat';
    if (/item|slot|held/i.test(id)) return 'Inventory';
    if (/visible/i.test(id)) return 'Visual';
    if (/distance|lineOfSight|seePlayer|noise/i.test(id)) return 'Object';
    return 'State';
  }

  function enrichActions(actionTypes) {
    for (const [id, definition] of Object.entries(actionTypes || {})) {
      const priorLabel = definition.label || id;
      definition.id = id;
      definition.label = ACTION_LABELS[id] || priorLabel;
      definition.category = categoryForAction(id);
      definition.help = definition.help || `Requests the ${definition.label.toLowerCase()} operation.`;
      definition.aliases = unique([...(definition.aliases || []), ...(ACTION_ALIASES[id] || []), priorLabel !== definition.label ? priorLabel : null]);
    }
    return actionTypes;
  }

  function enrichConditions(conditionTypes, scope) {
    for (const [serializedId, definition] of Object.entries(conditionTypes || {})) {
      if (definition.kind && definition.kind !== 'condition') continue;
      const priorLabel = definition.label || serializedId;
      definition.metadataId = `condition.${scope}.${serializedId}`;
      definition.serializedId = serializedId;
      definition.label = CONDITION_LABELS[serializedId] || priorLabel;
      definition.category = categoryForCondition(serializedId);
      definition.help = definition.help || `Checks whether ${definition.label.toLowerCase()}.`;
      definition.aliases = unique([...(definition.aliases || []), ...(CONDITION_ALIASES[serializedId] || []), priorLabel !== definition.label ? priorLabel : null]);
    }
    return conditionTypes;
  }

  function resolveByIdOrAlias(value, records) {
    const exact = (records || []).find((record) => record.id === value);
    if (exact) return exact.id;
    const query = normalize(value);
    const match = (records || []).find((record) => [record.label, ...(record.aliases || [])].some((label) => normalize(label) === query));
    return match ? match.id : null;
  }

  function resolveActionId(value, actionTypes) {
    if (actionTypes && actionTypes[value]) return value;
    const records = Object.entries(actionTypes || {}).map(([id, definition]) => ({ id, label: definition.label, aliases: definition.aliases || [] }));
    return resolveByIdOrAlias(value, records);
  }

  function eventLabel(id) { const event = EVENTS.find((entry) => entry.id === id); return event ? event.label : id; }
  function conditionLabel(scope, id) { return CONDITION_LABELS[id] || id; }
  function conditionMetadata(scope, serializedId, definition) {
    const priorLabel = definition && definition.label ? definition.label : serializedId;
    return {
      id: `condition.${scope}.${serializedId}`,
      serializedId,
      scope,
      label: CONDITION_LABELS[serializedId] || priorLabel,
      category: categoryForCondition(serializedId),
      fields: definition && Array.isArray(definition.fields) ? definition.fields : [],
      help: definition && definition.help ? definition.help : `Checks whether ${(CONDITION_LABELS[serializedId] || priorLabel).toLowerCase()}.`,
      aliases: unique([...(definition && definition.aliases ? definition.aliases : []), ...(CONDITION_ALIASES[serializedId] || []), priorLabel !== (CONDITION_LABELS[serializedId] || priorLabel) ? priorLabel : null]),
    };
  }

  const LOGIC_SURFACES = Object.freeze({
    behavior: Object.freeze({label:'Behavior',help:'React to an Event with an Action. Choose Visual Graph for branching reactions.'}),
    graph: Object.freeze({label:'Visual Graph',help:'Connect Actions and Conditions into branching flow. The owning Behavior supplies its Event.'}),
    sequence: Object.freeze({label:'Sequence',help:'Run existing Actions in order, with optional Delays. Start one from a Behavior or Visual Graph.'}),
  });
  const SPECIAL_LOGIC = Object.freeze({
    graph: Object.freeze({label:'Visual Graph',help:LOGIC_SURFACES.graph.help,aliases:Object.freeze(['Node Graph']),category:'Gameplay'}),
    dialogueTree: Object.freeze({label:'Branching Dialogue',help:'Author a branching conversation in its dedicated editor.',aliases:Object.freeze(['Show Dialogue (Branching)']),category:'UI'}),
  });
  function logicActionLabel(id, actions) { return SPECIAL_LOGIC[id]?.label || actions?.[id]?.label || id; }
  function logicEntries(actions, options = {}) {
    const surface = options.surface || 'behavior'; if (!LOGIC_SURFACES[surface]) throw new Error('Unknown logic surface: '+surface);
    const definitions = surface === 'graph' ? options.graphTypes || {} : actions || {};
    const entries = Object.entries(definitions).filter(([id]) => surface === 'graph' ? id !== 'script' : surface !== 'sequence' || !['graph','dialogueTree'].includes(id)).map(([id,def]) => {
      const kind = ['condition','value'].includes(def.kind) ? def.kind : 'action', source = kind === 'action' ? actions?.[id] || def : def;
      return Object.freeze({id,kind,label:kind === 'action' ? (actions?.[id] ? logicActionLabel(id,actions) : source.label || id) : source.label || CONDITION_LABELS[id] || id,category:source.category || (kind === 'condition' ? categoryForCondition(id) : categoryForAction(id)),help:source.help || (kind === 'condition' ? 'Checks a true/false condition.' : 'Requests an Action.'),aliases:Object.freeze(unique([...(source.aliases || []),...(kind === 'action' ? ACTION_ALIASES[id] || [] : CONDITION_ALIASES[id] || [])]))});
    });
    if (surface === 'behavior') for (const [id,meta] of Object.entries(SPECIAL_LOGIC)) if (!entries.some(e=>e.id===id)) entries.push(Object.freeze({id,kind:'action',...meta}));
    if (surface === 'sequence') entries.unshift(Object.freeze({id:'__delay',kind:'delay',label:'Delay / Wait',category:'State',help:'Wait before continuing with the next Sequence step.',aliases:Object.freeze(['Wait','Delay'])}));
    return Object.freeze(entries);
  }
  function matchesLogicEntry(entry, query) {
    const words = normalize(query).split(' ').filter(Boolean), haystack = normalize([entry.id,entry.label,entry.category,entry.help,...(entry.aliases || [])].join(' '));
    return words.every(word=>haystack.includes(word));
  }

  return Object.freeze({
    CATEGORIES, TAXONOMY, COMPONENTS, EVENTS, PRESETS,
    ACTION_LABELS, ACTION_ALIASES, CONDITION_LABELS, CONDITION_ALIASES,
    enrichActions, enrichConditions, resolveByIdOrAlias, resolveActionId, eventLabel, conditionLabel, conditionMetadata,
    LOGIC_SURFACES, logicActionLabel, logicEntries, matchesLogicEntry,
  });
});
