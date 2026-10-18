(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusInventoryTemplates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const keys=['description','stackable','maxStack','equipSlot','iconTextureAssetId','useAction'];
  const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
  const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
  function portable(v,seen=new Set(),depth=0,budget={nodes:0}){
    if(++budget.nodes>65536||depth>32)return false;
    if(v===null||typeof v==='string'||typeof v==='boolean')return true;
    if(typeof v==='number')return Number.isFinite(v);
    if(typeof v!=='object'||seen.has(v)||(!Array.isArray(v)&&!record(v)))return false;
    const ds=Object.getOwnPropertyDescriptors(v);
    if(Reflect.ownKeys(ds).some(k=>typeof k!=='string'||k!=='length'&&(!ds[k].enumerable||!own(ds[k],'value'))))return false;
    if(Array.isArray(v)&&(!Number.isSafeInteger(v.length)||v.length>65536||Object.keys(ds).some(k=>k!=='length'&&!/^(0|[1-9][0-9]*)$/.test(k))))return false;
    seen.add(v);
    for(const [k,d]of Object.entries(ds)){if(Array.isArray(v)&&k==='length')continue;if(!own(d,'value')||d.value===undefined&&Array.isArray(v)||d.value!==undefined&&!portable(d.value,seen,depth+1,budget)){seen.delete(v);return false;}}
    if(Array.isArray(v)&&Object.keys(ds).length!==v.length+1){seen.delete(v);return false;}
    seen.delete(v);return true;
  }
  function copy(v){if(!portable(v))throw new TypeError('Item templates need portable data without executable or cyclic records.');return JSON.parse(JSON.stringify(v));}
  const fail=reason=>({ok:false,reason});
  function inspect(value){
    if(!portable(value)||!record(value)||value.kind!=='ItemSettingsTemplate'||value.version!==1||typeof value.name!=='string'||!value.name.trim()||value.name.length>80||!record(value.settings))return fail('Choose an available version1 Item settings template.');
    const s=value.settings;
    if(Object.keys(s).some(k=>!keys.includes(k))||keys.some(k=>!own(s,k))||typeof s.stackable!=='boolean'||!Number.isSafeInteger(s.maxStack)||s.maxStack<1||typeof s.description!=='string'||s.description.length>4096||typeof s.equipSlot!=='string'||s.equipSlot.length>128||typeof s.iconTextureAssetId!=='string'||s.iconTextureAssetId.length>512)return fail('Item template settings are unavailable or invalid.');
    if(s.useAction!==null&&(!record(s.useAction)||typeof s.useAction.action!=='string'||!s.useAction.action||!record(s.useAction.params)))return fail('Item template Use Action is unavailable.');
    if(JSON.stringify(value).length>1048576)return fail('Item template exceeds1MiB.');
    return {ok:true,template:copy(value)};
  }
  function capture(name,item){
    if(!portable(item)||!record(item)||own(item,'version')&&item.version!==1)return fail('Choose an available authored Item.');
    if(item.stackable!==undefined&&typeof item.stackable!=='boolean')return fail('Item stackability is unavailable.');
    const settings={description:item.description??'',stackable:item.stackable!==false,maxStack:item.maxStack??99,equipSlot:item.equipSlot??'',iconTextureAssetId:item.iconTextureAssetId??'',useAction:item.useAction??null};
    return inspect({kind:'ItemSettingsTemplate',version:1,name,settings});
  }
  function candidate(value,target){
    const checked=inspect(value);if(!checked.ok)return checked;
    if(!portable(target)||!record(target)||typeof target.id!=='string'||!target.id||own(target,'version')&&target.version!==1)return fail('Choose an available target Item.');
    const item=copy(target),s=checked.template.settings;
    for(const key of keys)if((key==='useAction'&&s[key]===null)||(['equipSlot','iconTextureAssetId'].includes(key)&&s[key]===''))delete item[key];else item[key]=s[key];
    return {ok:true,item,template:checked.template};
  }
  const starter=(name,settings)=>({kind:'ItemSettingsTemplate',version:1,name,settings:{description:'',stackable:true,maxStack:99,equipSlot:'',iconTextureAssetId:'',useAction:null,...settings}});
  const starters=[starter('Stackable Item',{}),starter('Currency',{description:'An ordinary named Item used by Purchase Item.',maxStack:999}),starter('Single key',{description:'Choose this Item in a named key Graph pattern.',stackable:false,maxStack:1}),starter('Healing consumable',{description:'Use Item heals25 health and consumes one held Item.',maxStack:10,useAction:{action:'healPlayer',params:{amount:25}}})];
  function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}freeze(starters);
  return Object.freeze({inspect,capture,candidate,copy,starters,MAX_TEMPLATES:128});
});

