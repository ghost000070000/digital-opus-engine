(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusInputContexts=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k),plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
  const reserved=new Set(['__proto__','prototype','constructor']),builtins=new Set(['moveForward','moveBack','moveLeft','moveRight','jump','crouch','sprint','interact','attack','reload','switchWeapon','inventory']);
  const actionId=id=>typeof id==='string'&&(builtins.has(id)||/^input-action-[1-9]\d{0,14}$/.test(id));
  const contextId=id=>typeof id==='string'&&/^input-context-([1-9]\d{0,14}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(id);
  const fail=reason=>({ok:false,reason}),compiledCache=new WeakMap();
  function safe(value,seen=new Set(),depth=0,budget={n:0}){
    if(++budget.n>(budget.max||20000)||depth>32)return false;
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if((!Array.isArray(value)&&!plain(value))||seen.has(value))return false;
    seen.add(value);
    for(const key of Reflect.ownKeys(value)){
      if(Array.isArray(value)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(typeof key!=='string'||reserved.has(key)||!descriptor?.enumerable||!own(descriptor,'value')||!safe(descriptor.value,seen,depth+1,budget)){seen.delete(value);return false;}
    }
    if(Array.isArray(value))for(let i=0;i<value.length;i++)if(!own(value,i)){seen.delete(value);return false;}
    seen.delete(value);return true;
  }
  function copy(value){if(!safe(value))throw new Error('Input contexts require finite plain JSON without executable state.');return JSON.parse(JSON.stringify(value));}
  function defaults(){return {kind:'InputContexts',version:1,contexts:[]};}
  function validContext(record){
    if(!plain(record)||!safe(record)||!own(record,'id')||!contextId(record.id))return 'Context requires a canonical stable identity and plain JSON.';
    if(!own(record,'name')||typeof record.name!=='string'||!record.name.trim()||record.name.trim().length>80||/[\u0000-\u001f\u007f]/.test(record.name))return 'Context name requires 1–80 readable characters.';
    if(!own(record,'look')||typeof record.look!=='boolean')return 'Context Camera look must be a boolean.';
    if(!own(record,'actions')||!Array.isArray(record.actions)||record.actions.length>140||new Set(record.actions).size!==record.actions.length||record.actions.some(id=>!actionId(id)))return 'Context requires at most 140 distinct canonical Input Action references.';
    return null;
  }
  function inspect(raw){
    if(raw===undefined)return {ok:true,record:defaults()};
    if(!plain(raw)||!safe(raw))return fail('Input context library requires finite plain JSON; retained data is unchanged.');
    if(!own(raw,'kind')||raw.kind!=='InputContexts'||!own(raw,'version')||raw.version!==1)return fail('Unsupported InputContexts kind or version; retained data is unchanged.');
    if(!own(raw,'contexts')||!Array.isArray(raw.contexts)||raw.contexts.length>32)return fail('Input context library supports at most 32 contexts.');
    const ids=new Set(),names=new Set();
    for(const context of raw.contexts){const reason=validContext(context);if(reason)return fail(reason);const name=context.name.trim().toLowerCase();if(ids.has(context.id)||names.has(name))return fail('Context identities and readable names must be unique.');ids.add(context.id);names.add(name);}
    if(JSON.stringify(raw).length>65536)return fail('Input context library exceeds 64 KiB.');
    return {ok:true,record:copy(raw)};
  }
  function upsert(raw,context){
    const state=inspect(raw);if(!state.ok)return state;
    const reason=validContext(context);if(reason)return fail(reason);
    const index=state.record.contexts.findIndex(record=>record.id===context.id);
    const candidate=copy(context);candidate.name=candidate.name.trim();
    if(index>=0)state.record.contexts[index]={...state.record.contexts[index],...candidate};else state.record.contexts.push(candidate);
    return inspect(state.record);
  }
  function remove(raw,id){const state=inspect(raw);if(!state.ok)return state;if(!contextId(id))return fail('Choose a valid context identity.');state.record.contexts=state.record.contexts.filter(record=>record.id!==id);return inspect(state.record);}
  function compile(raw,available){
    const state=inspect(raw);
    if(!Array.isArray(available)||available.length>140||!safe(available)||new Set(available).size!==available.length||available.some(id=>!actionId(id)))return {ok:false,contexts:[],actionIds:[],reason:'Available Actions must be unique canonical references.'};
    if(!state.ok)return {ok:false,contexts:[],actionIds:[...available],reason:state.reason};
    const actionSet=new Set(available),contexts=state.record.contexts.map(record=>{
      const missing=record.actions.filter(id=>!actionSet.has(id));
      return {id:record.id,name:record.name,actions:[...record.actions],look:record.look,valid:!missing.length,...(missing.length?{reason:'Context contains unavailable Input Action references: '+missing.join(', ')}:{})};
    });
    const result={ok:true,contexts,actionIds:[...available]};
    compiledCache.set(result,{actionSet,contexts:new Map(contexts.map(context=>[context.id,{...context,actions:new Set(context.actions)}]))});return result;
  }
  function resolve(compiled,selection,action){
    const cached=compiledCache.get(compiled);
    if(!cached||!compiled.ok)return {valid:false,allowed:false,look:false,reason:'Input context library is unavailable.'};
    if(action!==undefined&&!cached.actionSet.has(action))return {valid:false,allowed:false,look:false,reason:'Input Action is unavailable.'};
    if(selection===null||selection===undefined)return {valid:true,allowed:true,look:true};
    const context=cached.contexts.get(selection);
    if(!context||!context.valid)return {valid:false,allowed:false,look:false,reason:context?.reason||'Selected input context is unavailable.'};
    return {valid:true,allowed:action===undefined||context.actions.has(action),look:context.look};
  }
  function freshId(){
    const crypto=root.crypto;let uuid;
    if(crypto&&typeof crypto.randomUUID==='function')uuid=crypto.randomUUID();
    else if(crypto&&typeof crypto.getRandomValues==='function'){
      const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');uuid=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
    }else throw new Error('Secure local randomness is unavailable; no input context was created.');
    const id='input-context-'+uuid;if(!contextId(id))throw new Error('Secure generator returned an invalid context UUID.');return id;
  }
  // Audit only canonical authored containers; never execute Actions or inspect script text.
  function collectIssues(project){
    const issues=[],list=value=>Array.isArray(value)?value:[];let work=0;
    const label=value=>typeof value==='string'?value:typeof value==='number'&&Number.isFinite(value)?String(value):'';
    const issue=(code,message,location,referenceValue)=>issues.push({scope:'input-context',severity:'error',code,message,location,referenceValue:typeof referenceValue==='string'||typeof referenceValue==='boolean'||typeof referenceValue==='number'&&Number.isFinite(referenceValue)?referenceValue:null});
    // Project assets can be huge. Read only known dependency containers, using
    // descriptors so even a malicious getter is never invoked during review.
    function read(value,key){if(!plain(value)&&!Array.isArray(value))return undefined;const d=Object.getOwnPropertyDescriptor(value,key);if(!d)return undefined;if(!own(d,'value'))throw new Error('unsafe');return d.value;}
    function rows(value,map){if(!Array.isArray(value))return [];const length=read(value,'length');if(length>65536)throw new Error('limit');const result=[];for(let i=0;i<length;i++){if(++work>65536)throw new Error('limit');result.push(map(read(value,String(i))));}return result;}
    function params(value){return {contextId:read(value,'contextId')};}
    function actionRecord(value){return {action:read(value,'action'),params:params(read(value,'params'))};}
    function graphRecord(value){return {nodes:rows(read(value,'nodes'),node=>({id:read(node,'id'),type:read(node,'type'),contextId:read(node,'contextId')}))};}
    function statesRecord(value){return rows(value,state=>({name:read(state,'name'),id:read(state,'id'),entryActions:rows(read(state,'entryActions'),actionRecord)}));}
    function objectRecord(value){return {id:read(value,'id'),name:read(value,'name'),behaviors:rows(read(value,'behaviors'),b=>({...actionRecord(b),id:read(b,'id'),name:read(b,'name'),graph:read(b,'action')==='graph'?graphRecord(read(b,'graph')):undefined})),states:statesRecord(read(value,'states')),ai:{states:statesRecord(read(read(value,'ai'),'states'))}};}
    function elementRecord(value){return {id:read(value,'id'),name:read(value,'name'),kind:read(value,'kind'),buttonAction:read(value,'buttonAction'),buttonParams:params(read(value,'buttonParams'))};}
    function uiRecord(value){return {hudElements:rows(read(value,'hudElements'),elementRecord)};}
    function itemRecord(value){return {id:read(value,'id'),name:read(value,'name'),useAction:actionRecord(read(value,'useAction'))};}
    function sequenceRecord(value){return {id:read(value,'id'),name:read(value,'name'),steps:rows(read(value,'steps'),step=>({actionType:read(step,'actionType'),params:params(read(step,'params'))}))};}
    try{
      if(!plain(project))throw new Error('unsafe');
      project={inputContexts:read(project,'inputContexts'),inputActionAssets:read(project,'inputActionAssets'),
        levels:rows(read(project,'levels'),level=>({id:read(level,'id'),name:read(level,'name'),playerSettings:{inputContextId:read(read(level,'playerSettings'),'inputContextId')},objects:rows(read(level,'objects'),objectRecord),ui:uiRecord(read(level,'ui')),itemDefs:rows(read(level,'itemDefs'),itemRecord),sequences:rows(read(level,'sequences'),sequenceRecord)})),
        objects:rows(read(project,'objects'),objectRecord),ui:uiRecord(read(project,'ui')),
        prefabs:rows(read(project,'prefabs'),prefab=>({id:read(prefab,'id'),name:read(prefab,'name'),records:rows(Array.isArray(read(prefab,'records'))?read(prefab,'records'):Array.isArray(read(prefab,'objects'))?read(prefab,'objects'):read(prefab,'record')?[read(prefab,'record')]:[prefab],objectRecord)})),
        graphFunctions:rows(read(project,'graphFunctions'),f=>({id:read(f,'id'),name:read(f,'name'),graph:graphRecord(read(f,'graph'))})),spriteAnimations:rows(read(project,'spriteAnimations'),clip=>({id:read(clip,'id'),name:read(clip,'name'),events:rows(read(clip,'events'),actionRecord)})),itemDefs:rows(read(project,'itemDefs'),itemRecord),uiTemplates:rows(read(project,'uiTemplates'),template=>({kind:read(template,'kind'),version:read(template,'version'),name:read(template,'name'),elements:rows(read(template,'elements'),elementRecord)}))};
      if(project.inputActionAssets!==undefined&&!safe(project.inputActionAssets,new Set(),0,{n:0,max:65536}))throw new Error('unsafe');
    }catch(error){issue(error.message==='limit'?'input-context-audit-limit':'input-context-project-invalid',error.message==='limit'?'Input context review exceeded 65536 structured records; simplify the project before export.':'Input context review encountered an unsafe authored dependency; accessors are not executed.','Project',null);return issues;}
    const assetsApi=root.OpusInputActionAssets||(typeof require==='function'?require('./00-input-action-assets.js'):null);
    const available=[...builtins];
    for(const asset of list(project.inputActionAssets))if(assetsApi?.find(project.inputActionAssets,asset?.id)&&!available.includes(asset.id))available.push(asset.id);
    const compiled=compile(project.inputContexts,available),raw=inspect(project.inputContexts);
    if(!raw.ok)issue('input-context-library-invalid',raw.reason,'Project Input Contexts',null);
    if(raw.ok)for(const context of raw.record.contexts)for(const id of context.actions)if(!available.includes(id))issue('input-context-action-unavailable','Context “'+context.name+'” contains an unavailable Input Action.','Project Input Contexts / '+context.name,id);
    function reference(id,location,optional=false){
      if(optional&&(id===null||id===undefined))return;
      if(typeof id!=='string'||!resolve(compiled,id).valid)issue('input-context-reference-unavailable','Choose an available Input Context; retained missing or malformed references fail closed.',location,id);
    }
    function action(type,params,location){if(type==='setInputContext')reference(plain(params)?params.contextId:undefined,location);}
    function graph(value,location){for(const node of list(value?.nodes))if(plain(node))action(node.type,node,location+' / node '+label(node.id||node.type));}
    function behaviors(values,location){for(const behavior of list(values))if(plain(behavior)){const at=location+' / Behavior '+label(behavior.name||behavior.id||behavior.action);if(behavior.action==='graph')graph(behavior.graph,at);else action(behavior.action,behavior.params,at);}}
    function states(values,location){for(const state of list(values))for(const entry of list(state?.entryActions))action(entry?.action,entry?.params,location+' / State '+label(state.name||state.id)+' entry');}
    function object(value,location){if(!plain(value))return;const at=location+' / Object '+label(value.name||value.id||'unnamed');behaviors(value.behaviors,at);states(value.states,at);states(value.ai?.states,at);}
    function elements(values,location){for(const element of list(values))if(plain(element)&&element.kind==='button')action(element.buttonAction,element.buttonParams,location+' / HUD '+label(element.name||element.id||'Button'));}
    function ui(value,location){elements(value?.hudElements,location);}
    for(const level of list(project.levels))if(plain(level)){
      const at='Level '+label(level.name||level.id||'unnamed');reference(level.playerSettings?.inputContextId,at+' / Initial Input Context',true);
      for(const value of list(level.objects))object(value,at);
      for(const sequence of list(level.sequences))for(const step of list(sequence?.steps))action(step?.actionType,step?.params,at+' / Sequence '+label(sequence.name||sequence.id));
      ui(level.ui,at);for(const definition of list(level.itemDefs))action(definition?.useAction?.action,definition?.useAction?.params,at+' / Item '+label(definition.name||definition.id));
    }
    for(const value of list(project.objects))object(value,'Project');ui(project.ui,'Project');
    for(const prefab of list(project.prefabs))if(plain(prefab)){const records=Array.isArray(prefab.records)?prefab.records:Array.isArray(prefab.objects)?prefab.objects:prefab.record?[prefab.record]:[prefab];for(const value of records)object(value,'Prefab '+label(prefab.name||prefab.id));}
    for(const definition of list(project.graphFunctions))graph(definition?.graph,'Function '+label(definition.name||definition.id));
    for(const clip of list(project.spriteAnimations))for(const event of list(clip?.events))action(event?.action,event?.params,'Sprite Animation '+label(clip.name||clip.id)+' / Event');
    for(const definition of list(project.itemDefs))action(definition?.useAction?.action,definition?.useAction?.params,'Item '+label(definition.name||definition.id));
    for(const template of list(project.uiTemplates))if(template.kind==='HUDtemplate'&&template.version===1)elements(template.elements,'UI Template '+label(template.name));
    return issues;
  }
  return Object.freeze({defaults,inspect,copy,upsert,remove,compile,resolve,freshId,collectIssues});
});
