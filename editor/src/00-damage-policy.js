(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusDamagePolicy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1,TYPES=Object.freeze(['ordinary','fire','ice']);
  const LABELS=Object.freeze({ordinary:'Ordinary',fire:'Fire',ice:'Ice'});
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const issue=(code,message)=>({code,message});
  function create(){return {version:VERSION,enabled:true,ordinary:1,fire:1,ice:1};}
  function inspectProfile(raw){
    const bad=(code,message)=>({ok:false,profile:null,issues:[issue(code,message)]});
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))return bad('invalid-profile','Damage profile must be a plain record.');
    const fields=['version','enabled',...TYPES];
    if(Reflect.ownKeys(raw).some(key=>!fields.includes(key)&&key!=='inspectorOrder'))return bad('unknown-profile-field','Damage profile has unsupported fields; retained data is not applied.');
    if(fields.some(key=>{const d=Object.getOwnPropertyDescriptor(raw,key);return !d||!own(d,'value');}))return bad('missing-profile-field','Damage profile requires explicit version, enabled and all three multipliers.');
    if(raw.version!==VERSION)return bad('unsupported-profile-version','Damage profile version is unsupported; retained data is not applied.');
    if(typeof raw.enabled!=='boolean')return bad('invalid-profile-enabled','Damage profile Enabled must be a boolean.');
    if(own(raw,'inspectorOrder')){const d=Object.getOwnPropertyDescriptor(raw,'inspectorOrder');if(!own(d,'value')||!Number.isInteger(d.value)||d.value<0)return bad('invalid-inspector-order','Damage profile Inspector order must be a finite nonnegative integer.');}
    if(TYPES.some(type=>typeof raw[type]!=='number'||!Number.isFinite(raw[type])||raw[type]<0))return bad('invalid-multiplier','Damage multipliers must be finite nonnegative numbers.');
    const profile={version:VERSION,enabled:raw.enabled,ordinary:raw.ordinary,fire:raw.fire,ice:raw.ice};
    if(own(raw,'inspectorOrder'))profile.inspectorOrder=raw.inspectorOrder;
    return {ok:true,profile,issues:[]};
  }
  // Pure numeric policy only: never writes Health, source or target records.
  // Invalid/unsupported policy returns the original amount with a diagnostic,
  // not immunity. Existing zero/negative (healing-like) semantics are preserved.
  function resolve(amount,type,profile){
    const bad=(code,message)=>({ok:false,amount,issues:[issue(code,message)]});
    if(typeof amount!=='number'||!Number.isFinite(amount))return bad('invalid-amount','Damage amount must be finite.');
    const kind=type===undefined?'ordinary':type;
    if(!TYPES.includes(kind))return bad('invalid-damage-type','Damage type is unavailable; original amount is retained.');
    if(profile===undefined)return {ok:true,amount,issues:[]};
    const checked=inspectProfile(profile);
    if(!checked.ok)return {ok:false,amount,issues:checked.issues};
    if(!checked.profile.enabled||amount<=0)return {ok:true,amount,issues:[]};
    const effective=amount*checked.profile[kind];
    if(!Number.isFinite(effective))return bad('damage-overflow','Effective damage is not finite; original amount is retained.');
    return {ok:true,amount:effective,issues:[]};
  }
  return Object.freeze({VERSION,TYPES,LABELS,create,inspectProfile,resolve});
});
