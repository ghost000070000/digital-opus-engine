// Project-local, inert controller settings. Hosts own history, Player identity,
// input availability and physical geometry; templates never own runtime state.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusControllerTemplates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KIND='ControllerSettingsTemplate',VERSION=1;
  const FIELDS=Object.freeze({hovercraft:['moveSpeed','acceleration','steeringRate','boostImpulse','boostAcceleration','boostMaxSpeed','drag'],topdown:['moveSpeed','acceleration','rotateToMovement'],thirdperson:['moveSpeed','acceleration','jumpEnabled','gravity','jumpSpeed'],firstperson:['moveSpeed','acceleration','gravity','jumpSpeed'],platformer2d:['moveSpeed','gravity','jumpSpeed'],topdown2d:['moveSpeed']});
  const COMPONENTS={platformer2d:'platformer-controller-2d',topdown2d:'topdown-controller-2d'};
  const ABILITIES={jump:{id:'jump-ability',field:'jumpSpeed'},sprint:{id:'sprint-ability',field:'speedMultiplier'}};
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const failure=reason=>({ok:false,reason});
  const knownFamily=value=>typeof value==='string'&&Object.prototype.hasOwnProperty.call(FIELDS,value);
  const knownAbility=value=>typeof value==='string'&&Object.prototype.hasOwnProperty.call(ABILITIES,value);
  function portable(value,ancestors=new Set()) {
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if(!plain(value)&&!Array.isArray(value)||ancestors.size>=32||ancestors.has(value))return false;
    ancestors.add(value);const ok=Object.keys(value).every(key=>{const descriptor=Object.getOwnPropertyDescriptor(value,key);return !['__proto__','constructor','prototype'].includes(key)&&descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')&&portable(descriptor.value,ancestors);});ancestors.delete(value);return ok;
  }
  function tuningValid(family,tuning) {
    if(!plain(tuning)||Object.keys(tuning).some(key=>!FIELDS[family].includes(key)))return false;
    return FIELDS[family].every(key=>['jumpEnabled','rotateToMovement'].includes(key)?typeof tuning[key]==='boolean':Number.isFinite(tuning[key])&&tuning[key]>0);
  }
  function abilityValid(kind,record,full) {
    if(!plain(record)||typeof record.enabled!=='boolean')return false;
    const field=ABILITIES[kind].field,value=record[field];
    if(!Number.isFinite(value)||(kind==='jump'?value<=0:value<1))return false;
    return full?record.version===1&&typeof record.inputActionRef==='string'&&!!record.inputActionRef.trim():Object.keys(record).every(key=>['enabled',field].includes(key));
  }
  function inspect(record) {
    if(!portable(record)||!plain(record)||record.kind!==KIND||record.version!==VERSION||!knownFamily(record.family)||typeof record.name!=='string'||!record.name.trim()||record.name.length>80)return failure('Unsupported Controller template. Saved data is retained, not converted.');
    if(Object.keys(record).some(key=>!['kind','version','name','family','tuning','abilities'].includes(key))||!tuningValid(record.family,record.tuning))return failure('Controller tuning must contain only this family’s supported finite settings.');
    if(!plain(record.abilities)||Object.keys(record.abilities).some(kind=>!knownAbility(kind)))return failure('Unsupported ability settings are retained but cannot be applied.');
    for(const kind of Object.keys(record.abilities))if(!COMPONENTS[record.family]||kind==='jump'&&record.family!=='platformer2d'||!abilityValid(kind,record.abilities[kind],false))return failure('Ability settings do not match this controller family.');
    if(JSON.stringify(record).length>65536)return failure('Controller template exceeds 64 KiB.');
    return {ok:true,record:copy(record)};
  }
  function source(target) {
    if(!plain(target)||!portable(target)||!knownFamily(target.family)||!plain(target.settings)||!portable(target.settings))return failure('Choose valid current Player settings.');
    if(target.components!==undefined&&(!plain(target.components)||!portable(target.components)))return failure('Existing component data is malformed; no settings were replaced.');
    const componentId=COMPONENTS[target.family],components=target.components||{},settings=target.settings;
    if(settings.controllerType!==undefined&&settings.controllerType!==target.family)return failure('Controller family and current Player settings disagree.');
    const owner=componentId?components[componentId]:settings;
    if(!plain(owner)||componentId&&(owner.version!==1||typeof owner.enabled!=='boolean'))return failure('A compatible current controller component is required. Future or malformed records remain untouched.');
    const tuning={};for(const key of FIELDS[target.family])tuning[key]=owner[key];
    if(!tuningValid(target.family,tuning))return failure('Repair current controller tuning before applying templates.');
    if(componentId) {
      const refs=target.family==='platformer2d'?['moveLeftActionRef','moveRightActionRef','jumpActionRef']:['moveLeftActionRef','moveRightActionRef','moveUpActionRef','moveDownActionRef'];
      if(refs.some(key=>typeof owner[key]!=='string'||!owner[key].trim()))return failure('Current controller Input Action references are malformed. Templates do not replace them.');
    }
    return {ok:true,componentId,components,settings,tuning};
  }
  function capture(target,name) {
    const state=source(target);if(!state.ok)return state;
    const abilities={};
    if(COMPONENTS[target.family])for(const [kind,definition]of Object.entries(ABILITIES)) {
      const record=state.components[definition.id];if(record===undefined)continue;
      if(kind==='jump'&&target.family!=='platformer2d'||!abilityValid(kind,record,true))return failure('Repair attached ability settings before capturing a template.');
      abilities[kind]={enabled:record.enabled,[definition.field]:record[definition.field]};
    }
    return inspect({kind:KIND,version:VERSION,name:typeof name==='string'?name.trim():name,family:target.family,tuning:state.tuning,abilities});
  }
  function candidate(target,record) {
    const inspected=inspect(record);if(!inspected.ok)return inspected;
    const state=source(target);if(!state.ok)return state;
    if(target.family!==inspected.record.family)return failure('Choose a template for the current controller family. Templates never switch Player mode or ownership.');
    const settings=copy(state.settings),components=copy(state.components),template=inspected.record;
    for(const [kind,patch]of Object.entries(template.abilities)) {
      const definition=ABILITIES[kind],existing=components[definition.id];
      if(!abilityValid(kind,existing,true))return failure('Add or repair the existing '+kind+' ability before applying these settings. No components were created or replaced.');
      components[definition.id]={...existing,...patch};
    }
    if(state.componentId)components[state.componentId]={...components[state.componentId],...template.tuning};else Object.assign(settings,template.tuning);
    return {ok:true,settings,components,changed:JSON.stringify(settings)!==JSON.stringify(state.settings)||JSON.stringify(components)!==JSON.stringify(state.components),record:template};
  }
  function library(raw){return Array.isArray(raw)?copy(raw):[];}
  return Object.freeze({KIND,VERSION,FIELDS,inspect,capture,candidate,library});
});
