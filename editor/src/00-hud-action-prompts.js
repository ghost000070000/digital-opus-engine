(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusHudActionPrompts=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(value,key)=>!!value&&Object.prototype.hasOwnProperty.call(value,key);
  const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const readable=(value,limit)=>typeof value==='string'&&value.trim().length>0&&value.length<=limit&&!/[\u0000-\u001f\u007f]/.test(value);
  const data=(value,key)=>record(value)&&Object.getOwnPropertyDescriptor(value,key);
  const read=(value,key)=>{const field=data(value,key);return field&&own(field,'value')?field.value:undefined;};
  const unsafe=(value,keys)=>keys.some(key=>{const field=data(value,key);return field&&!own(field,'value');});
  function resolve(prompt,context){
    const unavailable=reason=>({available:false,reason});
    if(!record(prompt)||unsafe(prompt,['version','presentation','action','deviceMode'])||read(prompt,'version')!==1)return unavailable('Invalid or unsupported Action Prompt');
    const presentation=read(prompt,'presentation'),action=read(prompt,'action');
    if(!['keycap','text'].includes(presentation))return unavailable('Choose Keycap or Text presentation');
    if(!readable(action,128)||['__proto__','prototype','constructor'].includes(action))return unavailable('Choose a named Input Action');
    const mode=own(prompt,'deviceMode')?read(prompt,'deviceMode'):'keyboard-mouse';
    if(!['auto','keyboard-mouse'].includes(mode))return unavailable('Invalid or unsupported Binding display');
    if(!record(context)||unsafe(context,['labels','bindings','keyLabel','controllerType','device','deviceMapping']))return unavailable('Invalid Action Prompt context');
    const labels=read(context,'labels'),actionName=read(labels,action);
    if(!readable(actionName,128))return unavailable('Missing Input Action; choose a replacement');
    const actionLabel=action==='jump'&&read(context,'controllerType')==='hovercraft'?'Boost':actionName;
    const device=mode==='auto'?(own(context,'device')?read(context,'device'):'keyboard-mouse'):'keyboard-mouse';
    if(!['keyboard-mouse','gamepad','touch'].includes(device))return unavailable('Current input device is unavailable');
    if(device!=='keyboard-mouse'){
      const mapping=read(context,'deviceMapping');
      if(!record(mapping)||unsafe(mapping,['gamepad','touch']))return unavailable('Current device mapping is unavailable');
      if(device==='touch')return read(mapping,'touch')===true?{available:true,reason:'',actionLabel,keyLabel:'On-screen '+actionLabel,code:'touch',presentation}:unavailable('This Action has no on-screen touch button');
      const sources=read(mapping,'gamepad');
      if(!Array.isArray(sources)||sources.length<1||sources.length>4)return unavailable('This Action has no gamepad binding');
      const tokens=[];
      for(let i=0;i<sources.length;i++){const field=Object.getOwnPropertyDescriptor(sources,String(i)),token=field&&own(field,'value')?field.value:null;if(typeof token!=='string'||!/^(button:([0-9]|1[0-6])|axis:[0-3]:(positive|negative))$/.test(token)||tokens.includes(token))return unavailable('Current gamepad mapping is invalid');tokens.push(token);}
      return {available:true,reason:'',actionLabel,keyLabel:tokens.map(token=>{const parts=token.split(':');return parts[0]==='button'?'Button '+parts[1]:'Axis '+parts[1]+' '+parts[2];}).join(' / '),code:tokens.join(' / '),presentation};
    }
    const code=read(read(context,'bindings'),action);
    if(!readable(code,128)||(mode==='auto'&&code.startsWith('OpusAction:')))return unavailable('Input Action has no valid keyboard/mouse binding');
    let label=code;
    const formatter=read(context,'keyLabel');
    if(typeof formatter==='function'){
      try{const formatted=formatter(code);if(readable(formatted,256))label=formatted;}catch(_error){/* Retain a readable local code fallback. */}
    }
    return {available:true,reason:'',actionLabel,keyLabel:label,code,presentation};
  }
  return Object.freeze({resolve});
});
