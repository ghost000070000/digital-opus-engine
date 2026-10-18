(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusHudButtonActions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(value,key)=>!!value&&Object.prototype.hasOwnProperty.call(value,key);
  const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const references=['target','prefab','audioAsset','meshAsset','textureAsset','hudElementRef','cameraPreset','sequence','objectiveRef','itemDefRef','level','signalRef','spriteAnimationState','menuPageRef','inputContextRef'];
  const types=['number','checkbox','text','color','select','spriteDirection','signalPayload','comparisonValue',...references];
  function copy(value,seen=new Map()){if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);const result=Array.isArray(value)?[]:{};seen.set(value,result);for(const key of Object.keys(value))Object.defineProperty(result,key,{value:copy(value[key],seen),writable:true,enumerable:true,configurable:true});return result;}
  function fields(action,registry){
    if(typeof action!=='string'||action==='script'||['__proto__','prototype','constructor'].includes(action)||!record(registry)||!own(registry,action))return null;
    const definition=registry[action];
    if(!record(definition)||!own(definition,'fields')||!Array.isArray(definition.fields)||definition.fields.length>64)return null;
    const keys=new Set();
    if(definition.fields.some(field=>{if(!record(field)||!own(field,'key')||!own(field,'type')||typeof field.key!=='string'||!field.key||['__proto__','prototype','constructor'].includes(field.key)||keys.has(field.key)||!types.includes(field.type))return true;keys.add(field.key);return false;}))return null;
    return definition.fields.map(field=>{const result=copy(field);if(result.type==='target'){result.implicitSelf=false;result.nullable=field.nullable===true;result.emptyLabel='Choose Object';}return result;});
  }
  function parse(field,input){
    const invalid=reason=>({valid:false,value:undefined,reason});
    if(!record(field)||!own(field,'type')||!types.includes(field.type))return invalid('Unsupported Action field');
    if(['signalPayload','comparisonValue'].includes(field.type))return invalid('Choose the declared value type before editing');
    const observed=input!==null&&typeof input==='object'?input:null;
    const value=observed?observed.value:input;
    if(field.type==='checkbox'){
      const checked=observed?observed.checked:input;
      return typeof checked==='boolean'?{valid:true,value:checked,reason:''}:invalid('Choose true or false');
    }
    if(field.type==='number'){
      if(typeof value!=='number'&&typeof value!=='string')return invalid('Enter a finite Number');
      if(typeof value==='string'&&(!value.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim())))return invalid('Enter a finite Number');
      const numeric=Number(value);
      if(!Number.isFinite(numeric))return invalid('Enter a finite Number');
      if(Number.isFinite(field.min)&&numeric<field.min||Number.isFinite(field.max)&&numeric>field.max)return invalid('Number is outside the allowed range');
      return {valid:true,value:numeric,reason:''};
    }
    if(typeof value!=='string'||value.length>(field.type==='text'?4096:512))return invalid('Enter bounded text or choose a named reference');
    if(field.type==='color'&&!/^#[0-9a-f]{6}$/i.test(value))return invalid('Choose a six-digit RGB color');
    if(field.type==='select'&&(!Array.isArray(field.options)||!field.options.includes(value)))return invalid('Choose an available option');
    if(field.type==='spriteDirection'&&!['none','up','down','left','right','up-left','up-right','down-left','down-right'].includes(value))return invalid('Choose a canonical Sprite Direction');
    if(references.includes(field.type)){
      if(/[\u0000-\u001f\u007f]/.test(value)||['__proto__','prototype','constructor'].includes(value))return invalid('Choose a valid named reference');
      if(!value.trim()&&(field.nullable===false||field.required===true||['prefab','objectiveRef','level','menuPageRef'].includes(field.type)))return invalid('Choose an explicit named reference');
    }
    return {valid:true,value,reason:''};
  }
  return Object.freeze({fields,parse});
});
