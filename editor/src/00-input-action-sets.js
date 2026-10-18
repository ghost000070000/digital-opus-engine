(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusInputActionSets=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k),reserved=new Set(['__proto__','prototype','constructor']);
  const families=['firstperson','thirdperson','topdown','hovercraft'];
  const builtin=new Set(['moveForward','moveBack','moveLeft','moveRight','jump','interact','attack','crouch','sprint','inventory','reload','switchWeapon']);
  const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
  const action=id=>typeof id==='string'&&(builtin.has(id)||/^input-action-[1-9]\d{0,14}$/.test(id));
  const fail=reason=>({ok:false,reason}),clone=value=>JSON.parse(JSON.stringify(value));
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
    if(!plain(record)||!portable(record))return fail('Action set must be finite plain JSON without executable or prototype state.');
    if(!own(record,'kind')||record.kind!=='ControllerInputActionSet'||!own(record,'version')||record.version!==1)return fail('Unsupported Action set kind or version; retained data was not changed.');
    if(!own(record,'controller')||!families.includes(record.controller))return fail('Choose a supported controller family.');
    if(!own(record,'actions')||!Array.isArray(record.actions)||record.actions.length>128)return fail('Action set requires at most 128 canonical Action references.');
    const used=new Set();for(const id of record.actions){if(!action(id)||used.has(id))return fail('Action references must be unique canonical IDs; missing assets remain retained references.');used.add(id);}
    if(JSON.stringify(record).length>65536)return fail('Action set record exceeds 64 KiB.');
    return {ok:true,record:clone(record)};
  }
  function copy(raw){return Array.isArray(raw)?clone(raw):[];}
  function find(raw,controller){
    if(!families.includes(controller))return fail('Choose a supported controller family.');
    if(!Array.isArray(raw)||!portable(raw))return fail('Unavailable Action set collection; original data retained.');
    const matches=raw.filter(record=>plain(record)&&own(record,'controller')&&Object.getOwnPropertyDescriptor(record,'controller')?.value===controller);
    if(matches.length>1)return fail('Duplicate Action sets for this controller; original data retained.');
    if(!matches.length)return {ok:true,record:null};
    return inspect(matches[0]);
  }
  function upsert(raw,record){
    const state=inspect(record);if(!state.ok)return state;
    const current=find(raw,state.record.controller);if(!current.ok)return current;
    if(raw.length>=128&&!current.record)return fail('Action set library is full; no records were removed.');
    const records=copy(raw),index=records.findIndex(entry=>plain(entry)&&own(entry,'controller')&&entry.controller===state.record.controller);
    if(index<0)records.push(state.record);else records[index]=state.record;
    return {ok:true,records};
  }
  return Object.freeze({inspect,find,copy,library:copy,upsert});
});
