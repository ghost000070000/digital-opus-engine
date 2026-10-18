// Authoring-only portable component settings. Runtime execution stays in the
// registered component; imports never evaluate code or silently bind foreign IDs.
(function(root,factory){
  const api=factory(typeof module!=='undefined'&&module.exports?require('./00-authoring-schema.js'):root.OpusAuthoring);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.OpusComponentPresets=api;
})(typeof window!=='undefined'?window:this,function(Authoring){
  'use strict';
  const FORMAT='opus-component-preset', VERSION=1;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
  const failure=reason=>({ok:false,reason});
  function portable(value,ancestors=new Set()){
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if(!Array.isArray(value)&&!plain(value))return false;
    if(ancestors.size>=32)return false;
    if(ancestors.has(value))return false;
    ancestors.add(value);
    const valid=Object.keys(value).every(key=>!['__proto__','prototype','constructor'].includes(key)&&portable(value[key],ancestors));
    ancestors.delete(value);return valid;
  }
  function inspect(input){
    if(!plain(input)||input.format!==FORMAT||input.version!==VERSION)return failure('Unsupported component preset format or version. Original data was not changed.');
    if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80)return failure('Preset name must contain 1–80 characters.');
    const schema=Authoring.registry.get(input.componentId);
    if(!schema||!schema.addable)return failure('This component is unavailable or is required Object state, not reusable settings.');
    if(!plain(input.record)||!Number.isInteger(input.record.version)||input.record.version<1||input.record.version>schema.version)return failure('Component settings require a compatible editor version.');
    if(!portable(input))return failure('Settings must be finite, plain portable JSON data without executable or prototype state.');
    for(const field of schema.fields){
      const value=input.record[field.key];if(value===undefined||value===null)continue;
      const invalid=(field.type==='boolean'&&typeof value!=='boolean')
        ||(['number','integer'].includes(field.type)&&(!Number.isFinite(value)||(field.type==='integer'&&!Number.isInteger(value))))
        ||(field.type==='enum'&&!(field.choices||[]).includes(value))
        ||(['vec2','vec3'].includes(field.type)&&(!Array.isArray(value)||value.length!==(field.type==='vec2'?2:3)||!value.every(Number.isFinite)))
        ||(['string','multiline','color'].includes(field.type)&&typeof value!=='string');
      if(invalid)return failure('Invalid settings for '+(field.label||field.key)+'. No changes were applied.');
    }
    let serialized;
    try{serialized=JSON.stringify(input);if(serialized.length>65536)return failure('Component preset is too large.');}
    catch{return failure('Component preset must contain portable JSON settings.');}
    const references=schema.fields.filter(field=>field.type.endsWith('Ref')||field.type==='collisionMaskRefs')
      .filter(field=> !(field.key==='collisionLayerRef'&&input.record[field.key]==='collision-layer-default') && !(field.key==='collisionMaskRefs'&&Array.isArray(input.record[field.key])&&input.record[field.key].every(id=>id==='collision-layer-default')))
      .filter(field=>{const value=input.record[field.key];return Array.isArray(value)?value.length>0:value!==null&&value!==undefined&&value!=='';});
    if(references.length)return failure('Presets with project-specific references are not yet supported: '+references.map(field=>field.label||field.key).join(', ')+'. Use unbound settings; the reserved Default Collision Layer is portable. Source settings were not changed.');
    return {ok:true,schema,preset:copy(input)};
  }
  function capture(target,componentId,name){
    const record=Authoring.serializeComponents(target)?.[componentId];
    if(!record)return failure('Choose an attached component to save.');
    return inspect({format:FORMAT,version:VERSION,name:String(name||'').trim(),componentId,record});
  }
  function parse(text){
    if(typeof text!=='string'||text.length>65536)return failure('Choose a component preset JSON file smaller than 64 KiB.');
    try{return inspect(JSON.parse(text));}catch{return failure('This file is not valid component preset JSON.');}
  }
  function apply(target,input,options={}){
    const state=inspect(input);if(!state.ok)return state;
    return Authoring.applyComponentSettings(target,state.preset.componentId,state.preset.record,options);
  }
  // Retain malformed/future definitions as inert authoring data. Inspect/Apply
  // decides availability; merely opening a project must not erase its library.
  function library(input){return Array.isArray(input)?copy(input):[];}
  return {FORMAT,VERSION,inspect,capture,parse,apply,library};
});
