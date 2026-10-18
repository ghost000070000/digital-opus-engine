(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusHudTweens=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
  const record=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  const identity=value=>typeof value==='string'&&value.trim().length>0&&value.length<=512&&!/[\u0000-\u001f\u007f]/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
  const channels={move:['offsetX','offsetY'],fade:['opacity'],scale:['scale']};
  const ranges={offsetX:[-1000000,1000000],offsetY:[-1000000,1000000],opacity:[0,1],scale:[0.01,100]};
  function create(easeValue){
    if(typeof easeValue!=='function')throw new TypeError('HUD tweens require the canonical easing function');
    const scopes=new Map();
    function baseState(base){
      if(!record(base))return null;const result={offsetX:0,offsetY:0,opacity:1,scale:1};
      for(const key of Object.keys(result))if(own(base,key)){if(!number(base[key],...ranges[key]))return null;result[key]=base[key];}
      return result;
    }
    function lookup(scope,id){return scopes.get(scope)?.get(id);}
    function presentation(scope,id){const item=lookup(scope,id);return item?{...item.values}:null;}
    function size(){let presentations=0,active=0;for(const scope of scopes.values())for(const item of scope.values()){presentations++;active+=item.active.size;}return {presentations,active};}
    function start(scope,id,channel,params,base){
      if(!identity(scope)||!identity(id)||!own(channels,channel)||!record(params)||!own(params,'duration')||!number(params.duration,0,3600))return false;
      const easing=own(params,'easing')?params.easing:'linear';
      if(!['linear','easeIn','easeOut','easeInOut'].includes(easing))return false;
      const initial=baseState(base);if(!initial)return false;
      const keys=channels[channel],destination={};
      for(const key of keys){const parameter=key==='offsetX'?'x':key==='offsetY'?'y':key;if(!own(params,parameter)||!number(params[parameter],...ranges[key]))return false;destination[key]=params[parameter];}
      let group=scopes.get(scope);if(!group){group=new Map();scopes.set(scope,group);}
      let item=group.get(id);if(!item){item={values:initial,active:new Map()};group.set(id,item);}
      const from={};for(const key of keys)from[key]=item.values[key];
      item.active.delete(channel);
      if(params.duration===0||keys.every(key=>from[key]===destination[key])){for(const key of keys)item.values[key]=destination[key];return true;}
      item.active.set(channel,{keys:keys.slice(),from,to:destination,duration:params.duration,easing,elapsed:0});return true;
    }
    function tick(dt){
      if(typeof dt!=='number'||!Number.isFinite(dt)||dt<=0)return size().active;
      for(const group of scopes.values())for(const item of group.values())for(const [channel,tween] of item.active){
        tween.elapsed=Math.min(tween.duration,tween.elapsed+dt);
        // Only absorb floating-point partition roundoff at the exact endpoint.
        if(tween.duration-tween.elapsed<=1e-12*Math.max(1,tween.duration))tween.elapsed=tween.duration;
        const fraction=tween.elapsed/tween.duration;let eased;
        try{eased=easeValue(fraction,tween.easing);}catch(_error){item.active.delete(channel);continue;}
        if(!number(eased,0,1)){item.active.delete(channel);continue;}
        for(const key of tween.keys)item.values[key]=fraction===1?tween.to[key]:tween.from[key]+(tween.to[key]-tween.from[key])*eased;
        if(fraction===1)item.active.delete(channel);
      }
      return size().active;
    }
    function remove(scope,id){const group=scopes.get(scope);if(!group||!group.delete(id))return false;if(!group.size)scopes.delete(scope);return true;}
    return Object.freeze({start,tick,presentation,clear(){scopes.clear();},remove,size});
  }
  return Object.freeze({create});
});
