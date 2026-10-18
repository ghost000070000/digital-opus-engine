(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusInputActionAssets=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k),reserved=new Set(['__proto__','prototype','constructor']);
  const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
  const validId=id=>typeof id==='string'&&/^input-action-[1-9]\d{0,14}$/.test(id);
  const fail=reason=>({ok:false,reason});
  const copy=value=>JSON.parse(JSON.stringify(value));
  function portable(value,seen=new Set(),depth=0){
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if(depth>32||(!Array.isArray(value)&&!plain(value))||seen.has(value))return false;
    seen.add(value);let valid=true;
    for(const key of Object.keys(value)){const field=Object.getOwnPropertyDescriptor(value,key);if(reserved.has(key)||!field||!own(field,'value')||!portable(field.value,seen,depth+1)){valid=false;break;}}
    if(Array.isArray(value))for(let i=0;i<value.length;i++)if(!own(value,i)){valid=false;break;}
    seen.delete(value);return valid;
  }
  function inspect(record){
    if(!plain(record)||!portable(record))return fail('Input Action must contain finite plain JSON without executable or prototype state.');
    if(!own(record,'kind')||record.kind!=='InputAction'||!own(record,'version')||record.version!==1)return fail('Unsupported Input Action kind or version; retained data is unchanged.');
    if(!own(record,'id')||!validId(record.id))return fail('Input Action requires a canonical stable asset ID.');
    if(!own(record,'name')||typeof record.name!=='string'||!record.name.trim()||record.name.length>80||/[\u0000-\u001f\u007f]/.test(record.name))return fail('Action name must contain 1–80 readable characters.');
    if(!own(record,'description')||typeof record.description!=='string'||record.description.length>512)return fail('Action description must contain at most 512 characters.');
    if(JSON.stringify(record).length>65536)return fail('Input Action record exceeds 64 KiB.');
    return {ok:true,record:copy(record)};
  }
  function library(raw){return Array.isArray(raw)?copy(raw):[];}
  function find(records,id){
    if(!Array.isArray(records)||!validId(id))return null;
    const matches=records.filter(record=>plain(record)&&own(record,'id')&&Object.getOwnPropertyDescriptor(record,'id')?.value===id);
    if(matches.length!==1)return null;
    const state=inspect(matches[0]);return state.ok?state.record:null;
  }
  function create(records,name,description,allocateId){
    if(!Array.isArray(records)||records.length>=128)return fail('At most 128 custom Input Action assets. Existing data was not changed.');
    if(typeof name!=='string'||typeof description!=='string'||typeof allocateId!=='function')return fail('Provide an Action name, description and canonical ID allocator.');
    const normalized=name.trim(),probe=inspect({kind:'InputAction',version:1,id:'input-action-1',name:normalized,description});if(!probe.ok)return probe;
    for(const record of records){const state=inspect(record);if(state.ok&&state.record.name.trim()===normalized)return fail('Choose a unique Action name; existing assets were not replaced.');}
    let allocated;try{allocated=allocateId();}catch(error){
      let reason;try{if(error instanceof Error&&typeof error.message==='string'&&error.message.trim())reason=error.message.slice(0,512);}catch(_unreadable){}
      return fail(reason||'Input Action ID allocation failed; no asset was created.');
    }
    if(!validId(allocated)||records.some(record=>plain(record)&&own(record,'id')&&Object.getOwnPropertyDescriptor(record,'id')?.value===allocated))return fail('Input Action allocator must return a fresh canonical ID.');
    return inspect({kind:'InputAction',version:1,id:allocated,name:normalized,description});
  }
  return Object.freeze({inspect,library,find,create});
});
