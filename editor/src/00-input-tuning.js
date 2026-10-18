(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusInputTuning=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(value,key)=>!!value&&Object.prototype.hasOwnProperty.call(value,key);
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
  const reserved=new Set(['__proto__','prototype','constructor']);
  const number=(value,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max;
  function safe(value,seen=new Set(),depth=0,budget={count:0}){
    if(++budget.count>10000||depth>32)return false;
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if((!plain(value)&&!Array.isArray(value))||seen.has(value))return false;
    seen.add(value);
    for(const key of Reflect.ownKeys(value)){
      if(Array.isArray(value)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(typeof key!=='string'||reserved.has(key)||!descriptor?.enumerable||!own(descriptor,'value')||!safe(descriptor.value,seen,depth+1,budget)){seen.delete(value);return false;}
    }
    if(Array.isArray(value))for(let i=0;i<value.length;i++)if(!own(value,i)){seen.delete(value);return false;}
    seen.delete(value);return true;
  }
  function copy(value){if(!safe(value))throw new Error('Gamepad tuning requires finite plain JSON without executable state.');return JSON.parse(JSON.stringify(value));}
  function defaults(){return {kind:'GamepadTuning',version:1,deadZone:0.25,lookRate:2.6};}
  const fail=reason=>({ok:false,reason});
  function inspect(record){
    if(record===undefined)return {ok:true,record:defaults()};
    if(!plain(record)||!safe(record))return fail('Gamepad tuning must contain finite plain JSON. Retained data is unchanged.');
    if(!own(record,'kind')||record.kind!=='GamepadTuning'||!own(record,'version')||record.version!==1)return fail('Unsupported gamepad tuning kind or version. Retained data is unchanged.');
    if(!own(record,'deadZone')||!number(record.deadZone,1))return fail('Gamepad dead zone must be a finite number from 0 to 1.');
    if(!own(record,'lookRate')||!number(record.lookRate,10))return fail('Gamepad look rate must be a finite number from 0 to 10 radians per second.');
    if(JSON.stringify(record).length>65536)return fail('Gamepad tuning record exceeds 64 KiB.');
    return {ok:true,record:copy(record)};
  }
  function effective(authored,local){
    const state=inspect(authored);if(!state.ok)return state;
    const record=state.record;
    if(plain(local))for(const [key,max] of [['deadZone',1],['lookRate',10]]){
      const descriptor=Object.getOwnPropertyDescriptor(local,key);
      if(descriptor&&own(descriptor,'value')&&number(descriptor.value,max))record[key]=descriptor.value;
    }
    return {ok:true,record};
  }
  function axis(value,deadZone){return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1&&number(deadZone,1)&&Math.abs(value)>deadZone?value:0;}
  return Object.freeze({defaults,inspect,copy,effective,axis});
});
