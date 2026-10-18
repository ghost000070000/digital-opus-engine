// Digital Opus gameplay preset contract.
//
// Presets are deterministic recipes over ordinary editor data. This module
// deliberately knows nothing about the DOM, rendering, physics, or history;
// the editor supplies a small adapter and owns the single Undo transaction.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusGameplayPresets = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const tokens = (value) => String(value || '').toLowerCase().trim().split(/[^a-z0-9]+/).filter(Boolean);
  const eligible = (preset, target) => !!target && (preset.eligibility.includes('any') || (preset.eligibility.includes('scene-object') && target.kind === 'cube') || (preset.eligibility.includes('sprite') && target.kind === 'sprite'));

  function normalizeParameter(field, value) {
    if (value === undefined || value === null || value === '') value = clone(field.default);
    if (field.type === 'boolean') return !!value;
    if (field.type === 'number' || field.type === 'integer') {
      let number = Number(value);
      if (!Number.isFinite(number)) number = Number(field.default) || 0;
      if (field.type === 'integer') number = Math.round(number);
      if (Number.isFinite(field.min)) number = Math.max(field.min, number);
      if (Number.isFinite(field.max)) number = Math.min(field.max, number);
      return number;
    }
    if (field.type === 'enum') return field.options.includes(value) ? value : field.default;
    return String(value === undefined ? '' : value);
  }

  class GameplayPresetRegistry {
    constructor() { this._presets = new Map(); }
    register(definition) {
      if (!definition || !/^[a-z][a-z0-9-]*$/.test(definition.id || '')) throw new Error('Preset needs a stable lowercase id');
      if (this._presets.has(definition.id)) throw new Error(`Preset "${definition.id}" is already registered`);
      if (!definition.displayName || !definition.category || !definition.description) throw new Error(`Preset "${definition.id}" needs creator-facing metadata`);
      if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error(`Preset "${definition.id}" needs a positive integer version`);
      if (!Array.isArray(definition.eligibility) || !definition.eligibility.length) throw new Error(`Preset "${definition.id}" needs eligibility`);
      if (!Array.isArray(definition.parameters) || typeof definition.apply !== 'function' || typeof definition.detect !== 'function') throw new Error(`Preset "${definition.id}" needs parameters, detect, and apply`);
      const ids = new Set();
      const parameters = definition.parameters.map((field) => {
        if (!field.id || ids.has(field.id) || !['boolean', 'number', 'integer', 'string', 'enum', 'signal', 'color', 'target', 'waypoints'].includes(field.type)) throw new Error(`Invalid parameter in preset "${definition.id}"`);
        if (field.type === 'enum' && (!Array.isArray(field.options) || !field.options.length)) throw new Error(`Enum parameter "${field.id}" needs options`);
        ids.add(field.id);
        return Object.freeze({ ...field });
      });
      const preset = Object.freeze({ preview: null, validate: () => [], ...definition, parameters: Object.freeze(parameters) });
      this._presets.set(preset.id, preset);
      return preset;
    }
    get(id) { return this._presets.get(id) || null; }
    list() { return [...this._presets.values()].sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName)); }
    discover(target, query) {
      const wanted = tokens(query);
      return this.list().filter((preset) => eligible(preset, target) && wanted.every((token) => tokens(`${preset.displayName} ${preset.id} ${preset.category} ${preset.description}`).some((part) => part.includes(token))));
    }
    normalizeParameters(presetOrId, input) {
      const preset = typeof presetOrId === 'string' ? this.get(presetOrId) : presetOrId;
      if (!preset) return null;
      const source = input && typeof input === 'object' ? input : {};
      return Object.fromEntries(preset.parameters.map((field) => [field.id, normalizeParameter(field, source[field.id])]));
    }
    inspect(target, presetOrId, input, adapter) {
      const preset = typeof presetOrId === 'string' ? this.get(presetOrId) : presetOrId;
      if (!preset) return { ok: false, code: 'UNKNOWN_PRESET', message: 'Unknown gameplay preset.' };
      if (!eligible(preset, target)) return { ok: false, code: 'INELIGIBLE', message: `${preset.displayName} cannot be applied to this selection.` };
      // AI recipes preserve invalid input for strict canonical preflight instead
      // of silently clamping it into a different authored movement request.
      const parameters = preset.aiMovementRecipe||preset.aiInvestigationRecipe ? Object.fromEntries(preset.parameters.map(field=>[field.id,input?.[field.id]===undefined?clone(field.default):clone(input[field.id])])) : this.normalizeParameters(preset, input);
      const issues = preset.validate(target, parameters, adapter) || [];
      if (issues.some((issue) => issue.severity === 'error')) return { ok: false, code: 'INVALID_PARAMETERS', message: issues[0].message, issues, preset, parameters };
      return { ok: true, code: preset.detect(target) ? 'UPDATE' : 'APPLY', message: preset.detect(target) ? 'Existing setup will be updated without duplicates.' : 'Ready to apply.', issues, preset, parameters };
    }
    apply(target, presetId, input, adapter, options) {
      const state = this.inspect(target, presetId, input, adapter);
      if (!state.ok) return state;
      if (state.preset.aiMovementRecipe) return adapter.applyAiMovementPreset(target,presetId,state.parameters);
      if (state.preset.aiInvestigationRecipe) return adapter.applyAiInvestigationPreset(target,presetId,state.parameters);
      // This explicit Sprite recipe composes components and level ownership
      // atomically in the host; it owns changed-only history itself.
      if (state.preset.id === 'platformer-player-2d') return adapter.applyPlatformer(target);
      if (state.preset.id === 'topdown-player-2d') return adapter.applyTopdown2D(target);
      if (!adapter || typeof adapter.upsertBehavior !== 'function') return { ok: false, code: 'MISSING_ADAPTER', message: 'Preset adapter is unavailable.' };
      const wasUpdate = state.code === 'UPDATE';
      if (options && typeof options.onBeforeChange === 'function') options.onBeforeChange();
      const output = state.preset.apply(target, state.parameters, adapter) || {};
      const issues = state.preset.validate(target, state.parameters, adapter) || [];
      if (options && typeof options.onComplete === 'function') options.onComplete(state.preset, output);
      return { ok: true, code: wasUpdate ? 'UPDATED' : 'APPLIED', message: wasUpdate ? 'Preset updated without duplicates.' : 'Preset applied.', preset: state.preset, parameters: state.parameters, output, issues };
    }
  }

  const hasPresetOutput = (target, presetId) => (target.behaviors || []).some((behavior) => behavior.sourcePreset === presetId);
  const registry = new GameplayPresetRegistry();
  const behaviorPreset = (definition) => registry.register(definition);
  for(const [id,name,extra,description]of [
    ['ai-investigate','AI Investigate Noise',[], 'Direct XZ movement toward the last heard Noise Action. Stays idle before hearing; stops near the remembered point. Simple mode; other states and attacks are retained.'],
    ['ai-investigate-search','AI Investigate and Search',[
      {id:'searchRadius',label:'Search destination radius',type:'number',default:2,min:.1},
      {id:'investigateSeconds',label:'Investigate for (seconds)',type:'number',default:2,min:.1},
      {id:'searchSeconds',label:'Search for (seconds)',type:'number',default:3,min:.1},
      {id:'recentNoiseSeconds',label:'Accept recent noise within (seconds)',type:'number',default:.25,min:.01}
    ],'Create Listen → Investigate → Search → Listen states. Investigation is timed, not arrival detection; Search restarts around the current position each entry. Selects State Machine mode/start; updates only recipe-owned states, retaining others. New states add no attacks.']
  ])behaviorPreset({id,aiInvestigationRecipe:true,displayName:name,category:'AI investigation',version:1,eligibility:['scene-object'],preview:{icon:'◈'},description:description+' Hearing uses Emit Noise Actions within both emitter and listener radius, not audio analysis. Existing vision and solid-collision policy remain.',parameters:[{id:'speed',label:'Move speed (units / second)',type:'number',default:3,min:.1},{id:'hearingRadius',label:'Hearing radius',type:'number',default:8,min:.1},...extra],detect:target=>id==='ai-investigate'?target.entity?.ai?.mode==='simple'&&target.entity.ai.type==='investigate':target.entity?.ai?.mode==='stateMachine'&&target.entity.ai.states?.some(state=>state.name===target.entity.ai.startState&&state.presetOwner===id),validate:(target,p,a)=>{const state=a?.aiInvestigationPresetCandidate?.(target,id,p);return state?.ok&&typeof a?.applyAiInvestigationPreset==='function'?[]:[{severity:'error',message:state?.reason||'Canonical AI investigation adapter is unavailable.'}];},apply:(target,p,a)=>a.applyAiInvestigationPreset(target,id,p)});
  behaviorPreset({
    id: 'topdown-player-2d', displayName: 'Top-down Player 2D', category: 'Characters', version: 1, eligibility: ['sprite'], preview: { icon: '↔' }, parameters: [],
    description: 'Use this Sprite as this level’s XY Player with four-way movement, no gravity or Jump. Adds missing Collider, Kinematic Body, Character Collision (Wall Slide, Slopes and Steps off) and Top-down Controller in one Undo. Existing incompatible records require explicit repair; Cameras/input bindings are kept.',
    detect: target => !!target.components?.['topdown-controller-2d'],
    validate: (target, p, adapter) => { const state = adapter?.topdown2DCandidate?.(target); return state?.ok ? [] : [{ severity: 'error', message: state?.reason || 'Top-down 2D setup is unavailable.' }]; },
    apply: (target, p, adapter) => adapter.applyTopdown2D(target),
  });
  behaviorPreset({
    id: 'platformer-player-2d', displayName: 'Platformer Player 2D', category: 'Characters', version: 1, eligibility: ['sprite'], preview: { icon: '↗' }, parameters: [],
    description: 'Use this Sprite as this level’s Player. Adds missing ordinary Collider, Kinematic Body, Character Collision and Platformer components in one Undo. Keeps compatible authored settings, input bindings and Cameras; invalid existing components require explicit repair.',
    detect: target => !!target.components?.['platformer-controller-2d'],
    validate: (target, p, adapter) => { const state = adapter?.platformerCandidate?.(target); return state?.ok ? [] : [{ severity: 'error', message: state?.reason || 'Platformer setup is unavailable.' }]; },
    apply: (target, p, adapter) => adapter.applyPlatformer(target),
  });

  behaviorPreset({
    id: 'collectible', displayName: 'Collectible', category: 'Pickups', version: 1,
    description: 'Adds a score/item counter pickup that can remove itself when collected.', eligibility: ['scene-object'],
    preview: { icon: '⭐' }, parameters: [
      { id: 'counter', label: 'Counter / item name', type: 'string', default: 'score' },
      { id: 'destroyOnCollect', label: 'Destroy on collect', type: 'boolean', default: true },
    ],
    detect: (target) => hasPresetOutput(target, 'collectible'),
    validate: (target, p) => p.counter.trim() ? [] : [{ severity: 'error', code: 'PRESET_COUNTER_REQUIRED', message: 'Counter / item name is required.' }],
    apply: (target, p, a) => { a.upsertBehavior(target, 'incrementCounter', { trigger: 'enter', sourcePreset: 'collectible', params: { counter: p.counter.trim() } }); a.removeBehavior(target, 'destroyObject', 'collectible'); if (p.destroyOnCollect) a.upsertBehavior(target, 'destroyObject', { trigger: 'enter', sourcePreset: 'collectible', params: {} }); a.setVisual(target, { color: [1, 0.85, 0.2], unlit: true, spin: 2 }); },
  });
  behaviorPreset({
    id: 'checkpoint', displayName: 'Checkpoint', category: 'World', version: 1,
    description: 'Makes this object set the player respawn checkpoint when entered.', eligibility: ['scene-object'], preview: { icon: '🏁' },
    parameters: [{ id: 'visiblePad', label: 'Use checkpoint pad appearance', type: 'boolean', default: true }],
    detect: (target) => hasPresetOutput(target, 'checkpoint'),
    apply: (target, p, a) => { a.upsertBehavior(target, 'setCheckpoint', { trigger: 'enter', sourcePreset: 'checkpoint', params: {} }); if (p.visiblePad) a.setVisual(target, { color: [0.3, 0.9, 0.95], unlit: true }); },
  });
  behaviorPreset({
    id: 'damage-zone', displayName: 'Damage Zone', category: 'Hazards', version: 1,
    description: 'Damages the player on contact with a configurable cooldown.', eligibility: ['scene-object'], preview: { icon: '☠' },
    parameters: [
      { id: 'damage', label: 'Damage', type: 'number', default: 15, min: 0 },
      { id: 'cooldown', label: 'Cooldown (seconds)', type: 'number', default: 1, min: 0 },
    ],
    detect: (target) => hasPresetOutput(target, 'damage-zone'),
    apply: (target, p, a) => { a.upsertBehavior(target, 'damagePlayer', { trigger: 'enter', sourcePreset: 'damage-zone', params: { amount: p.damage, cooldown: p.cooldown } }); a.setVisual(target, { color: [0.9, 0.35, 0.1] }); },
  });
  behaviorPreset({
    id: 'opening-door', displayName: 'Opening Door', category: 'World', version: 1,
    description: 'Slides this solid object when the player approaches it.', eligibility: ['scene-object'], preview: { icon: '🚪' },
    parameters: [
      { id: 'axis', label: 'Open direction', type: 'enum', options: ['x', 'y', 'z'], default: 'y' },
      { id: 'distance', label: 'Distance', type: 'number', default: 3 },
      { id: 'duration', label: 'Duration (seconds)', type: 'number', default: 1, min: 0.05 },
    ],
    detect: (target) => hasPresetOutput(target, 'opening-door'),
    apply: (target, p, a) => { const position = a.position(target); const destination = { x: position.x, y: position.y, z: position.z }; destination[p.axis] += p.distance; a.setVisual(target, { solid: true }); a.upsertBehavior(target, 'moveTo', { trigger: 'enter', sourcePreset: 'opening-door', params: { targetId: target.id, ...destination, duration: p.duration, easing: 'easeInOut' } }); },
  });
  behaviorPreset({
    id: 'moving-platform', displayName: 'Moving Platform', category: 'Movement', version: 1,
    description: 'Adds an editable ping-pong position clip and starts it automatically.', eligibility: ['scene-object'], preview: { icon: '↔' },
    parameters: [
      { id: 'axis', label: 'Movement axis', type: 'enum', options: ['x', 'y', 'z'], default: 'x' },
      { id: 'distance', label: 'Distance', type: 'number', default: 4 },
      { id: 'duration', label: 'One-way duration', type: 'number', default: 2, min: 0.05 },
    ],
    detect: (target) => hasPresetOutput(target, 'moving-platform') && (target.animationClips || []).some((clip) => clip.name === 'Preset Platform Patrol'),
    apply: (target, p, a) => { const start = a.position(target); const end = [start.x, start.y, start.z]; end[{ x: 0, y: 1, z: 2 }[p.axis]] += p.distance; a.upsertClip(target, { name: 'Preset Platform Patrol', duration: p.duration, loop: 'pingpong', tracks: { position: [{ t: 0, value: [start.x, start.y, start.z], easing: 'linear' }, { t: p.duration, value: end, easing: 'linear' }], rotationY: [], scale: [], visible: [] } }); a.setVisual(target, { solid: true }); a.upsertBehavior(target, 'playAnimation', { trigger: 'start', sourcePreset: 'moving-platform', params: { clipName: 'Preset Platform Patrol' } }); },
  });
  behaviorPreset({
    id: 'basic-enemy', displayName: 'Basic Enemy', category: 'Characters', version: 1,
    description: 'Follows Player at any distance in Simple AI mode, with object health, an enemy tag and contact damage. Authored State Machine definitions are retained.', eligibility: ['scene-object'], preview: { icon: '👾' },
    parameters: [
      { id: 'speed', label: 'Move speed', type: 'number', default: 3, min: 0 },
      { id: 'detectionRadius', label: 'Stored legacy radius (not a Follow detection gate)', type: 'number', default: 10, min: 0 },
      { id: 'health', label: 'Health', type: 'number', default: 100, min: 1 },
      { id: 'contactDamage', label: 'Contact damage', type: 'number', default: 10, min: 0 },
      { id: 'cooldown', label: 'Damage cooldown', type: 'number', default: 1, min: 0 },
    ],
    detect: (target) => hasPresetOutput(target, 'basic-enemy') && !!(target.entity && target.entity.ai) && (target.tags || []).includes('enemy'),
    validate:(target,p,a)=>{const state=a?.preflightAiPreset?.(target,{type:'follow',mode:'simple',speed:p.speed,radius:p.detectionRadius,targetId:null});return state?.ok?[]:[{severity:'error',message:state?.reason||'Canonical AI preset adapter is unavailable.'}];},
    apply: (target, p, a) => { a.setAi(target, { type: 'follow', mode:'simple', speed: p.speed, radius: p.detectionRadius, targetId: null }); a.ensureTag(target, 'enemy'); a.ensureComponent(target, 'health', { max: p.health, current: p.health }); a.upsertBehavior(target, 'damagePlayer', { trigger: 'enter', sourcePreset: 'basic-enemy', params: { amount: p.contactDamage, cooldown: p.cooldown } }); },
  });
  behaviorPreset({
    id: 'spawn-point', displayName: 'Spawn Point', category: 'World', version: 1,
    description: 'Marks this object as a player spawn point.', eligibility: ['scene-object'], preview: { icon: '🚩' },
    parameters: [{ id: 'makeDefault', label: 'Make default spawn', type: 'boolean', default: true }],
    detect: (target) => !!target.isSpawnPoint,
    apply: (target, p, a) => { a.setObject(target, { isSpawnPoint: true, isDefaultSpawn: p.makeDefault }); a.setVisual(target, { color: [0.3, 0.9, 0.95] }); },
  });

  for(const [id,name,description,extra] of [
    ['ai-follow','AI Follow','Move toward a named Object, or Player when empty. Follow has no detection-radius gate.',[{id:'targetId',label:'Follow target',type:'target',default:''}]],
    ['ai-flee','AI Flee','Move away from Player while inside Radius. This legacy movement does not use an arbitrary target.',[{id:'radius',label:'Flee radius',type:'number',default:8,min:.1}]],
    ['ai-wander','AI Wander','Random movement around the actor current position. Radius bounds destinations, not navigation or detection.',[{id:'radius',label:'Wander radius',type:'number',default:5,min:.1}]],
    ['ai-patrol','AI Patrol','Visit an ordered route of named Waypoints. This is direct movement, not pathfinding.',[{id:'waypointIds',label:'Patrol route',type:'waypoints',default:[]},{id:'loop',label:'Loop',type:'boolean',default:true},{id:'pingpong',label:'Ping-Pong (two or more entries)',type:'boolean',default:false}]],
  ])behaviorPreset({id,aiMovementRecipe:true,displayName:name,category:'AI movement',version:1,eligibility:['scene-object'],preview:{icon:'◈'},description:description+' Applying explicitly selects Simple AI mode; existing states, attacks, senses and collision settings remain. No health, damage or enemy tags are added.',parameters:[{id:'speed',label:'Move speed (units / second)',type:'number',default:3,min:.1},...extra],detect:target=>target.entity?.ai?.mode==='simple'&&target.entity.ai.type===({'ai-follow':'follow','ai-flee':'flee','ai-wander':'wander','ai-patrol':'patrolRoute'})[id],validate:(target,p,a)=>{const state=a?.aiMovementPresetCandidate?.(target,id,p);return state?.ok&&typeof a?.applyAiMovementPreset==='function'?[]:[{severity:'error',message:state?.reason||'Canonical AI movement adapter is unavailable.'}];},apply:(target,p,a)=>a.applyAiMovementPreset(target,id,p)});

  const signalField={id:'signalId',label:'Named Signal · Project tab',type:'signal',default:''};
  function signalIssues(target,p,adapter){if(!p.signalId)return [{severity:'error',message:'Choose a named Signal. Create one in Project; use Prefab scope for independent placed assemblies.'}];if(adapter?.signalDefinition&&!adapter.signalDefinition(p.signalId))return [{severity:'error',message:'This Signal is unavailable. Choose a replacement; no changes were applied.'}];return [];}
  behaviorPreset({id:'signal-emitter',displayName:'Signal Sender',category:'Event-driven Prefabs',version:1,eligibility:['scene-object'],preview:{icon:'◉'},description:'Send a no-value Signal on Click, Enter or Start. Pair with a Signal Indicator or Show/Hide receiver, then Save Selection as Prefab. Use a Prefab-scoped Signal for independent instances; Project scope intentionally broadcasts.',parameters:[{...signalField,payloadType:'none'},{id:'event',label:'Send when',type:'enum',options:['click','enter','start'],optionLabels:{click:'On Click',enter:'On Enter',start:'On Start'},default:'click'}],detect:target=>hasPresetOutput(target,'signal-emitter'),validate:(target,p,a)=>{const issues=signalIssues(target,p,a),d=a?.signalDefinition?.(p.signalId);if(d&&d.payloadType!==undefined&&d.payloadType!=='none')issues.push({severity:'error',message:'Signal Sender sends no value. Choose a no-value Signal; use Send Signal or a relay graph for typed values.'});return issues;},apply:(target,p,a)=>{a.removeBehavior(target,'sendSignal','signal-emitter');a.upsertBehavior(target,'sendSignal',{trigger:p.event,sourcePreset:'signal-emitter',params:{signalId:p.signalId}});}});
  behaviorPreset({id:'signal-indicator',displayName:'Signal Indicator',category:'Event-driven Prefabs',version:1,eligibility:['scene-object'],preview:{icon:'✦'},description:'Change Self to the chosen color when a named Signal arrives. Ordinary On Signal/Change Color Behaviors stay editable. Pair with a sender and capture both as a reusable Prefab; no Script.',parameters:[signalField,{id:'color',label:'Received color',type:'color',default:'#33ccff'}],detect:target=>hasPresetOutput(target,'signal-indicator'),validate:(target,p,a)=>{const issues=signalIssues(target,p,a);if(!/^#[0-9a-f]{6}$/i.test(p.color))issues.push({severity:'error',message:'Choose a valid RGB hex color.'});return issues;},apply:(target,p,a)=>{a.upsertBehavior(target,'changeColor',{trigger:'signal',eventRef:{signalId:p.signalId},sourcePreset:'signal-indicator',params:{targetId:'',color:p.color}});a.setVisual(target,{unlit:true});}});
  behaviorPreset({id:'signal-visibility',displayName:'Signal Show/Hide',category:'Event-driven Prefabs',version:1,eligibility:['scene-object'],preview:{icon:'◇'},description:'Show or hide Self when a named Signal arrives. Uses the existing visibility Action, not a separate controller/physics policy. Pair with a sender and Save Selection as Prefab.',parameters:[signalField,{id:'visible',label:'Visible after receiving',type:'boolean',default:false}],detect:target=>hasPresetOutput(target,'signal-visibility'),validate:signalIssues,apply:(target,p,a)=>a.upsertBehavior(target,'setVisibility',{trigger:'signal',eventRef:{signalId:p.signalId},sourcePreset:'signal-visibility',params:{targetId:'',visible:p.visible}})});
  return { GameplayPresetRegistry, registry, eligible, normalizeParameter };
});
