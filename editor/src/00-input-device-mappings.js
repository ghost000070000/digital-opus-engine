(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusInputDeviceMappings=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k),reserved=new Set(['__proto__','prototype','constructor']);
  const historical={moveForward:['button:12','axis:1:negative'],moveBack:['button:13','axis:1:positive'],moveLeft:['button:14','axis:0:negative'],moveRight:['button:15','axis:0:positive'],jump:['button:0'],interact:['button:1'],attack:['button:2'],reload:['button:3'],switchWeapon:['button:4'],crouch:['button:6'],sprint:['button:10'],inventory:['button:8']};
  const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
  const action=id=>typeof id==='string'&&(own(historical,id)||/^input-action-[1-9]\d{0,14}$/.test(id));
  const token=value=>typeof value==='string'&&/^(button:([0-9]|1[0-6])|axis:[0-3]:(positive|negative))$/.test(value);
  const sources=value=>Array.isArray(value)&&value.length<=4&&value.every(token)&&new Set(value).size===value.length;
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
    if(!plain(record)||!portable(record))return fail('Device mapping must contain finite plain JSON without executable or prototype state.');
    if(!own(record,'kind')||record.kind!=='InputDeviceMapping'||!own(record,'version')||record.version!==1)return fail('Unsupported device mapping kind or version; retained data is unchanged.');
    if(!own(record,'action')||!action(record.action))return fail('Choose a canonical Input Action reference.');
    if(!own(record,'gamepad')||!sources(record.gamepad))return fail('Choose at most four unique supported gamepad sources.');
    if(!own(record,'touch')||typeof record.touch!=='boolean')return fail('Touch visibility must be an explicit boolean.');
    if(JSON.stringify(record).length>65536)return fail('Device mapping record exceeds 64 KiB.');
    return {ok:true,record:clone(record)};
  }
  function copy(raw){return Array.isArray(raw)?clone(raw):[];}
  function find(raw,id){
    if(!action(id))return fail('Choose a canonical Input Action reference.');
    if(!Array.isArray(raw)||!portable(raw))return fail('Unavailable device mapping collection; original data retained.');
    const matches=raw.filter(record=>plain(record)&&own(record,'action')&&Object.getOwnPropertyDescriptor(record,'action')?.value===id);
    if(matches.length>1)return fail('Duplicate mappings for this Action; original data retained.');
    return matches.length?inspect(matches[0]):{ok:true,record:null};
  }
  function upsert(raw,record){
    const state=inspect(record);if(!state.ok)return state;const current=find(raw,state.record.action);if(!current.ok)return current;
    if(raw.length>=128&&!current.record)return fail('Device mapping library is full; no records were removed.');
    const records=copy(raw),index=records.findIndex(entry=>plain(entry)&&own(entry,'action')&&entry.action===state.record.action);
    if(index<0)records.push(state.record);else records[index]=state.record;return {ok:true,records};
  }
  function defaults(id){return {gamepad:own(historical,id)?historical[id].slice():[],touch:own(historical,id)&&!['crouch','sprint'].includes(id)};}
  function held(input,pad,deadzone=.25){
    if(!sources(input)||!pad||pad.connected===false||typeof deadzone!=='number'||!Number.isFinite(deadzone)||deadzone<0||deadzone>1)return false;
    return input.some(source=>{const parts=source.split(':');if(parts[0]==='button')return pad.buttons?.[Number(parts[1])]?.pressed===true;
      const value=pad.axes?.[Number(parts[1])];return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1&&(parts[2]==='positive'?value>deadzone:value < -deadzone);});
  }
  // Validate authoring once, then retain only device routing scalars per session.
  // Unknown settings remain in the project library, never in the runtime cache.
  function compile(raw,actions){
    const safeActions=Array.isArray(actions)?actions.filter(action):[];
    if(!Array.isArray(actions)||actions.length>140||!actions.every(action)||new Set(actions).size!==actions.length
      ||!Array.isArray(raw)||raw.length>128||!portable(raw))return {routes:[],unavailable:[...new Set(safeActions)],reason:'Unavailable or oversized device mapping collection; no runtime routes compiled.'};
    const groups=new Map();for(const record of raw){if(!plain(record)||!own(record,'action')||!action(record.action))continue;const group=groups.get(record.action)||[];group.push(record);groups.set(record.action,group);}
    const routes=[],unavailable=[];
    for(const id of actions){const records=groups.get(id);if(!records){const settings=defaults(id);routes.push({action:id,gamepad:settings.gamepad,touch:settings.touch,configured:false});continue;}
      if(records.length!==1){unavailable.push(id);continue;}const state=inspect(records[0]);if(!state.ok){unavailable.push(id);continue;}
      routes.push({action:id,gamepad:state.record.gamepad.slice(),touch:state.record.touch,configured:true});
    }
    return {routes,unavailable};
  }
  return Object.freeze({inspect,find,copy,upsert,defaults,held,compile});
});
