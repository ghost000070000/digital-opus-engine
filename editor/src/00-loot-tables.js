(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusLootTables=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  const MAX_TABLES=256,MAX_ENTRIES=128,MAX_DRAW=0xffffffff;
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
  const id=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!['__proto__','constructor','prototype'].includes(value);
  // Inspect descriptors, never read an accessor or invoke toJSON. Imported
  // JSON is ordinary data; the public API also refuses nonportable JS records.
  function portable(value,ancestors=new Set(),depth=0,budget={nodes:0},allowAbsentObjectFields=false){
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if(typeof value!=='object'||depth>64||++budget.nodes>65536||ancestors.has(value)||!Array.isArray(value)&&!record(value))return false;
    const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
    if(keys.length>65537||keys.some(key=>typeof key!=='string'))return false;
    if(Array.isArray(value)&&(descriptors.length.value>65536||keys.length!==descriptors.length.value+1||keys.some(key=>key!=='length'&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=descriptors.length.value))))return false;
    ancestors.add(value);
    for(const key of keys){
      if(Array.isArray(value)&&key==='length')continue;
      const descriptor=descriptors[key];
      if(!descriptor.enumerable||!own(descriptor,'value')){ancestors.delete(value);return false;}
      // Native captured Prefabs retain optional undefined object fields;
      // their canonical JSON transport omits them. Never permit array holes,
      // accessors, executable values or missing required table data this way.
      if(allowAbsentObjectFields&&!Array.isArray(value)&&descriptor.value===undefined)continue;
      if(!portable(descriptor.value,ancestors,depth+1,budget,allowAbsentObjectFields)){ancestors.delete(value);return false;}
    }
    ancestors.delete(value);return true;
  }
  function validate(table){
    if(!record(table)||!portable(table)||!['version','id','seed','entries'].every(key=>own(table,key))||table.version!==1||!id(table.id))return {valid:false,reason:'table'};
    if(!Number.isInteger(table.seed)||table.seed<0||table.seed>MAX_DRAW)return {valid:false,reason:'seed'};
    if(!Array.isArray(table.entries)||table.entries.length<1||table.entries.length>MAX_ENTRIES)return {valid:false,reason:'entries'};
    let total=0;
    for(let index=0;index<table.entries.length;index++){
      const entry=table.entries[index];
      if(!record(entry)||!own(entry,'weight')||!Number.isInteger(entry.weight)||entry.weight<1||entry.weight>1000000)return {valid:false,reason:'weight',entryIndex:index};
      if(!own(entry,'kind')||entry.kind!=='none'&&(entry.kind!=='prefab'||!own(entry,'prefabName')||typeof entry.prefabName!=='string'||!entry.prefabName.trim()||entry.prefabName.length>256))return {valid:false,reason:'outcome',entryIndex:index};
      total+=entry.weight;
    }
    return {valid:true,total};
  }
  // Stateless indexed Mulberry32 draw. Seed0 is intentional, never replaced1.
  // Table identity owns progress externally; this function never consumes it.
  function unit(seed,index){let t=((seed+Math.imul(index,0x9e3779b9))>>>0)+0x6d2b79f5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  function sample(table,drawIndex){
    const policy=validate(table);if(!policy.valid)return {selected:false,reason:policy.reason,entryIndex:policy.entryIndex};
    if(!Number.isInteger(drawIndex)||drawIndex<0||drawIndex>MAX_DRAW)return {selected:false,reason:'draw-index'};
    const value=unit(table.seed,drawIndex)*policy.total;let cumulative=0;
    for(let index=0;index<table.entries.length;index++){const entry=table.entries[index];cumulative+=entry.weight;if(value<cumulative)return {selected:true,kind:entry.kind,...(entry.kind==='prefab'?{prefabName:entry.prefabName}:{}),entryIndex:index,drawIndex};}
    return {selected:false,reason:'selection'};
  }
  function copyData(value){if(!portable(value))throw new TypeError('Loot Tables require portable data; executable or cyclic records are unavailable.');return JSON.parse(JSON.stringify(value));}
  function copyPrefabData(value){if(!portable(value,new Set(),0,{nodes:0},true))throw new TypeError('Pickup Prefabs require safe canonical JSON data.');return JSON.parse(JSON.stringify(value));}
  function copy(library){if(library===undefined)return [];if(!Array.isArray(library))throw new TypeError('Loot Tables copy requires a portable data array; unavailable data must be retained explicitly by the host.');return copyData(library);}
  function restoreCounters(saved,library){
    const counters=Object.create(null);if(!record(saved)||!portable(saved)||!Array.isArray(library)||!portable(library))return counters;
    for(const table of library){if(!validate(table).valid||library.filter(other=>other?.id===table.id).length!==1||!own(saved,table.id))continue;const count=saved[table.id];if(Number.isInteger(count)&&count>=0&&count<=MAX_DRAW+1)counters[table.id]=count;}
    return counters;
  }
  return Object.freeze({validate,sample,copy,copyData,copyPrefabData,restoreCounters,MAX_TABLES,MAX_ENTRIES,MAX_DRAW});
});
