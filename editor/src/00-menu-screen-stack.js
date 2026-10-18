(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusMenuScreenStack=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
  const record=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  const text=(value,max)=>typeof value==='string'&&value.length<=max;
  const identity=value=>text(value,128)&&value.trim().length>0&&!['__proto__','prototype','constructor'].includes(value);
  function copy(value,seen=new Map()){
    if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);
    const result=Array.isArray(value)?[]:{};seen.set(value,result);
    for(const key of Object.keys(value))Object.defineProperty(result,key,{value:copy(value[key],seen),enumerable:true,writable:true,configurable:true});
    return result;
  }
  function pages(input){return Array.isArray(input)?copy(input):[];}
  function inspect(page){
    const fail=reason=>({available:false,reason});
    if(!record(page)||!own(page,'version')||page.version!==1)return fail('Invalid or unsupported Menu page');
    if(!own(page,'id')||!identity(page.id))return fail('Menu page needs a stable identity');
    if(!own(page,'title')||!text(page.title,160)||!own(page,'body')||!text(page.body,8192))return fail('Menu title/body must be bounded text');
    if(own(page,'pauseSimulation')&&typeof page.pauseSimulation!=='boolean')return fail('Menu pause policy must be true or false');
    if(own(page,'links')&&(!Array.isArray(page.links)||page.links.length>32||page.links.some(link=>!record(link)||!own(link,'pageId')||!identity(link.pageId)||!own(link,'label')||!text(link.label,160)||!link.label.trim())))return fail('Menu navigation needs named page references and labels');
    return {available:true,reason:''};
  }
  function create(input,initial={}){
    const definitions=pages(input),ids=[];
    let observedPaused=initial?.paused===true,baselinePaused=observedPaused,ownsPause=false;
    const find=id=>{if(definitions.length>64)return null;const matches=definitions.filter(page=>record(page)&&page.id===id);return matches.length===1&&inspect(matches[0]).available?matches[0]:null;};
    const needsPause=()=>ids.some(id=>{const page=find(id);return page&&page.pauseSimulation!==false;});
    function output(changed,available,reason,shouldPause=false,shouldResume=false){return {changed,available,reason,top:ids.length?copy(find(ids[ids.length-1])):null,ids:ids.slice(),depth:ids.length,pauseRequired:needsPause(),baselinePaused,ownsPause,shouldPause,shouldResume};}
    function observe(context){if(context&&own(context,'paused')&&typeof context.paused==='boolean')observedPaused=context.paused;}
    function reconcile(changed,context){
      observe(context);let shouldPause=false,shouldResume=false;
      if(needsPause()){
        if(!observedPaused){ownsPause=true;shouldPause=true;observedPaused=true;}
      }else if(ownsPause){shouldResume=observedPaused;ownsPause=false;observedPaused=false;}
      return output(changed,true,'',shouldPause,shouldResume);
    }
    return Object.freeze({
      push(id,context){
        if(!identity(id)||!find(id))return output(false,false,'Missing, ambiguous or unsupported Menu page');
        if(ids.includes(id))return output(false,true,'Menu page is already open');
        if(ids.length>=32)return output(false,false,'Menu stack limit reached');
        observe(context);if(!ids.length)baselinePaused=observedPaused;
        ids.push(id);return reconcile(true,context);
      },
      back(context){if(ids.length<2)return output(false,true,'Already at the root Menu page');ids.pop();return reconcile(true,context);},
      close(context){const changed=ids.length>0;ids.length=0;return reconcile(changed,context);},
      reset(context){const changed=ids.length>0;ids.length=0;return reconcile(changed,context);},
      snapshot(){return output(false,true,'');},
    });
  }
  return Object.freeze({inspect,pages,create});
});
