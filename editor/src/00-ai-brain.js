// Authored AI data only. The host retains the existing legacy XZ runtime.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusAiBrain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1;
  const TYPES=Object.freeze(['','follow','flee','faceTarget','orbit','wander','patrolRoute','navigateToTarget','followPath','investigate']);
  // Each key below is written by the actual movement/state/attack runtime.
  const TRANSIENT=Object.freeze(['wanderTarget','wanderTimer','_entryBase','resolvedWaypointIds','currentWaypointIndex','direction','navPath','navPathIndex','navRecomputeTimer','angle','_pathT','_pathDir','_pathLength','_pathLengthFor','_attackCooldownUntil','_currentState']);
  const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
  const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
  const fail=message=>({ok:false,issues:[message],reason:message});
  function baseCoordinates(base) {
    if(Array.isArray(base)){if(base.length!==3||!base.every(Number.isFinite))throw Error('AI base must contain finite XYZ coordinates.');return base.slice();}
    if(!base||typeof base!=='object')throw Error('AI base must contain finite XYZ coordinates.');
    return ['x','y','z'].map(axis=>{const d=Object.getOwnPropertyDescriptor(base,axis);if(!d||!own(d,'value')||!Number.isFinite(d.value))throw Error('AI base must contain finite XYZ coordinates.');return d.value;});
  }
  function clone(value,ancestors=new Set()) {
    if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if((!plain(value)&&!Array.isArray(value))||ancestors.has(value)||ancestors.size>=32)throw Error('AI data must be finite portable JSON without cycles or prototypes.');
    ancestors.add(value);const result=Array.isArray(value)?[]:{};
    for(const key of Object.keys(value)) {
      const d=Object.getOwnPropertyDescriptor(value,key);
      if(['__proto__','constructor','prototype'].includes(key)||!d||!own(d,'value'))throw Error('AI data contains unsafe keys or accessors.');
      result[key]=clone(d.value,ancestors);
    }
    ancestors.delete(value);return result;
  }
  function authoredSlot(value) {
    if(!plain(value))throw Error('AI configuration must be an object.');
    const out={};
    for(const key of Object.keys(value)) {
      if(TRANSIENT.includes(key))continue;
      const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!own(d,'value'))throw Error('AI configuration contains an accessor.');
      // Existing UI creates optional undefined fields; historical JSON omits them.
      if(d.value===undefined)continue;
      if(key==='base') {
        out.base=baseCoordinates(d.value);
      } else if(key==='states'&&Array.isArray(d.value)) {
        out.states=d.value.map(state=>{if(!plain(state))throw Error('AI states must be objects.');const copy={};for(const k of Object.keys(state)){const p=Object.getOwnPropertyDescriptor(state,k);if(!p||!own(p,'value'))throw Error('AI state contains an accessor.');if(p.value===undefined)continue;copy[k]=['movement','attack'].includes(k)?authoredSlot(p.value):clone(p.value);}return copy;});
      } else out[key]=clone(d.value);
    }
    // Validate keys as well as values after legacy-only conversion.
    return clone(out);
  }
  function validateConfig(config) {
    if(!plain(config))return 'AI configuration must be an object.';
    if(!TYPES.includes(config.type))return 'Choose a supported existing AI movement type.';
    if(own(config,'mode')&&!['simple','stateMachine'].includes(config.mode))return 'Unsupported AI mode is retained but cannot run.';
    if(own(config,'targetSelection')&&!['fixed','nearestTag'].includes(config.targetSelection))return 'Unsupported AI target selection is retained but cannot run.';
    if(own(config,'targetTag')&&(typeof config.targetTag!=='string'||!config.targetTag||config.targetTag.trim()!==config.targetTag))return 'Target tag must be a nonempty exact tag without surrounding spaces.';
    if(own(config,'targetRange')&&(!Number.isFinite(config.targetRange)||config.targetRange<0))return 'Target acquisition range must be finite and nonnegative.';
    if(config.targetSelection==='nearestTag'&&(!own(config,'targetTag')||!own(config,'targetRange')))return 'Nearest tagged Cube targeting requires an exact tag and finite acquisition range.';
    // Historical Basic Enemy permits stationary Follow. Preserve that bounded
    // meaning; other movement modes and new recipes still require positive speed.
    for(const key of ['speed','radius','collisionRadius','attackRadius','attackCooldown','attackSpeed'])if(own(config,key)&&(!Number.isFinite(config[key])||(key==='speed'&&config.type==='follow'?config[key]<0:config[key]<=0)))return key+' must be finite and '+(key==='speed'&&config.type==='follow'?'nonnegative.':'greater than zero.');
    if(own(config,'attackDamage')&&(!Number.isFinite(config.attackDamage)||config.attackDamage<0))return 'Attack damage must be finite and nonnegative.';
    if(own(config,'attackDamageType')&&!['ordinary','fire','ice'].includes(config.attackDamageType))return 'Attack damage type must be Ordinary, Fire or Ice.';
    for(const key of ['loop','pingpong','attackEnabled','collideWithSolids','restartOnEnter'])if(own(config,key)&&typeof config[key]!=='boolean')return key+' must be boolean.';
    for(const key of ['targetId','pathId','attackPrefab','waypointNames','startState'])if(own(config,key)&&config[key]!==null&&typeof config[key]!=='string')return key+' must be a saved reference/name string.';
    if(own(config,'base')&&(!Array.isArray(config.base)||config.base.length!==3||!config.base.every(Number.isFinite)))return 'AI base must contain three finite coordinates.';
    if(own(config,'perception')) {
      const p=config.perception;if(!plain(p))return 'Perception must be an object.';
      for(const key of ['visionDistance','hearingRadius'])if(own(p,key)&&(!Number.isFinite(p[key])||p[key]<0))return key+' must be finite and nonnegative.';
      if(own(p,'fovDegrees')&&(!Number.isFinite(p.fovDegrees)||p.fovDegrees<=0||p.fovDegrees>360))return 'Vision FOV must be greater than zero and at most 360 degrees.';
      if(own(p,'requiresLOS')&&typeof p.requiresLOS!=='boolean')return 'Requires Line Of Sight must be boolean.';
    }
    if(own(config,'states')) {
      if(!Array.isArray(config.states))return 'AI states must be an ordered array.';
      const names=new Set();
      for(const state of config.states) {
        if(!plain(state)||typeof state.name!=='string'||!state.name.trim()||names.has(state.name))return 'AI states require unique nonempty names.';
        names.add(state.name);
        for(const slot of ['movement','attack'])if(own(state,slot)){const value=state[slot];const issue=validateConfig(slot==='attack'?{...value,type:''}:value);if(!plain(value)||issue)return issue||'AI state configuration is malformed.';}
        if(own(state,'transitions')&&(!Array.isArray(state.transitions)||state.transitions.some(t=>!plain(t)||typeof t.to!=='string'||!plain(t.condition)||typeof t.condition.type!=='string'||(own(t.condition,'value')&&!Number.isFinite(t.condition.value)))))return 'AI transitions require destination names and finite condition values.';
        if(own(state,'entryActions')&&(!Array.isArray(state.entryActions)||state.entryActions.some(a=>!plain(a)||typeof a.action!=='string'||!plain(a.params))))return 'AI entry Actions require ordinary Action names and parameter objects.';
      }
      if(config.mode==='stateMachine'&&config.states.length&&(!names.has(config.startState)||config.states.some(s=>(s.transitions||[]).some(t=>!names.has(t.to)))))return 'AI start/transition destinations must name an existing state.';
    }
    return null;
  }
  function inspect(record) {
    try {
      const saved=clone(record);
      if(!plain(saved)||saved.version!==VERSION||typeof saved.enabled!=='boolean'||Object.keys(saved).some(k=>!['version','enabled','config'].includes(k)))return fail('Unsupported or malformed AI Brain record remains inert.');
      const issue=validateConfig(saved.config);if(issue)return fail(issue);
      // Authored component records must never silently accept live caches.
      const clean=authoredSlot(saved.config);if(JSON.stringify(clean)!==JSON.stringify(saved.config))return fail('AI Brain contains transient runtime state.');
      return {ok:true,record:saved,issues:[]};
    }catch(error){return fail(error.message);}
  }
  function captureLegacy(ai,options={}) {
    try{return inspect({version:VERSION,enabled:own(options,'enabled')?options.enabled:true,config:authoredSlot(ai)});}catch(error){return fail(error.message);}
  }
  function toLegacy(record) {const result=inspect(record);return result.ok?{ok:true,enabled:result.record.enabled,config:clone(result.record.config),issues:[]}:result;}
  function create(base) {const record={version:VERSION,enabled:true,config:{type:'follow',speed:3,radius:5}};if(base!==undefined)record.config.base=baseCoordinates(base);return record;}
  return Object.freeze({VERSION,TYPES,TRANSIENT,inspect,captureLegacy,toLegacy,create});
});
