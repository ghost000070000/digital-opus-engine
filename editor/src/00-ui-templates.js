(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusUiTemplates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k),reserved=new Set(['__proto__','prototype','constructor']);
  const record=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
  const id=value=>typeof value==='string'&&value.trim().length>0&&value.length<=512&&!/[\u0000-\u001f\u007f]/.test(value)&&!reserved.has(value);
  const fail=reason=>({ok:false,reason});
  function portable(value,seen=new Set(),depth=0){
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if(depth>32||(!Array.isArray(value)&&!record(value))||seen.has(value))return false;
    seen.add(value);let valid=true;
    for(const key of Object.keys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(reserved.has(key)||!descriptor||!own(descriptor,'value')||!portable(descriptor.value,seen,depth+1)){valid=false;break;}}
    if(Array.isArray(value))for(let i=0;i<value.length;i++)if(!own(value,i)){valid=false;break;}
    seen.delete(value);return valid;
  }
  const copy=value=>JSON.parse(JSON.stringify(value));
  function inspect(input){
    if(!portable(input))return fail('Template must contain finite, plain JSON without executable or prototype state.');
    if(!record(input)||!own(input,'kind')||input.kind!=='HUDtemplate'||!own(input,'version')||input.version!==1)return fail('Unsupported UI template kind or version; original data retained.');
    if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80)return fail('Template name must contain 1–80 characters.');
    if(!Array.isArray(input.elements)||input.elements.length<1||input.elements.length>128)return fail('Choose 1–128 HUD elements.');
    const ids=new Set();for(const element of input.elements){if(!record(element)||!own(element,'id')||!id(element.id)||!own(element,'kind')||!id(element.kind)||ids.has(element.id))return fail('HUD elements need unique valid IDs and kinds.');ids.add(element.id);}
    if(JSON.stringify(input).length>1048576)return fail('UI template exceeds 1 MiB.');
    return {ok:true,template:copy(input)};
  }
  function capture(name,elements){return inspect({kind:'HUDtemplate',version:1,name,elements});}
  function parse(text){if(typeof text!=='string'||text.length>1048576)return fail('Choose a UI template JSON file no larger than 1 MiB.');try{return inspect(JSON.parse(text));}catch(_error){return fail('Invalid UI template JSON.');}}
  function instantiate(input,options={}){
    const state=inspect(input);if(!state.ok)return state;
    if(typeof options.allocateId!=='function'||typeof options.actionFields!=='function')return fail('Canonical HUD allocator and Action field metadata are required.');
    const elements=state.template.elements,oldIds=new Set(elements.map(element=>element.id)),newIds=new Set(),idMap=Object.create(null),warnings=[];
    try{for(const element of elements){const next=options.allocateId(element.id);if(!id(next)||oldIds.has(next)||newIds.has(next))return fail('HUD allocator must return fresh unique IDs.');newIds.add(next);idMap[element.id]=next;}}
    catch(_error){return fail('HUD ID allocation failed; no template elements were returned.');}
    for(const element of elements){const original=element.id;element.id=idMap[original];if(element.kind!=='button'||!element.buttonAction)continue;
      let fields;try{fields=options.actionFields(element.buttonAction);}catch(_error){return fail('Action metadata lookup failed; no template elements were returned.');}
      if(!Array.isArray(fields)){warnings.push({elementId:element.id,reason:'Action unavailable; settings retained.',action:element.buttonAction});continue;}
      if(!record(element.buttonParams))continue;
      for(const field of fields){if(!field||typeof field.key!=='string'||field.type!=='hudElementRef'||!own(element.buttonParams,field.key))continue;
        const value=element.buttonParams[field.key];if(own(idMap,value))element.buttonParams[field.key]=idMap[value];else if(value!==''&&value!==null)warnings.push({elementId:element.id,field:field.key,reference:value,reason:'External HUD reference retained; unavailable until explicitly resolved.'});}
    }
    return {ok:true,elements,idMap,warnings};
  }
  function library(input){return Array.isArray(input)?copy(input):[];}
  return Object.freeze({capture,inspect,parse,instantiate,library});
});
