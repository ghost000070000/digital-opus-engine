(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusHudWidgets=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
  const record=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  const text=(value,max)=>typeof value==='string'&&value.length<=max;
  const id=value=>text(value,512)&&value.trim().length>0&&!['__proto__','prototype','constructor'].includes(value);
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  function inspect(config){
    const fail=reason=>({available:false,reason});
    if(!record(config)||!own(config,'version')||config.version!==1)return fail('Invalid or unsupported HUD widget settings');
    if(own(config,'title')&&!text(config.title,160)||own(config,'emptyText')&&!text(config.emptyText,320))return fail('Widget title/empty text must be bounded text');
    if(own(config,'maxEntries')&&(!Number.isInteger(config.maxEntries)||config.maxEntries<1||config.maxEntries>20))return fail('Widget list limit must be 1 to 20');
    if(own(config,'statusFilter')&&!['active','all'].includes(config.statusFilter))return fail('Choose Active or All Objective states');
    return {available:true,reason:''};
  }
  function base(config,title,emptyText){const valid=inspect(config);return valid.available?{available:true,reason:'',title:own(config,'title')?config.title:title,emptyText:own(config,'emptyText')?config.emptyText:emptyText,rows:[],truncated:false}:{...valid,rows:[],truncated:false};}
  const limit=config=>own(config,'maxEntries')?config.maxEntries:6;
  function inventory(config,state={}){
    const result=base(config,'Inventory','Nothing carried yet.');if(!result.available)return result;
    if(!record(state))state={};const store=record(state.inventory)?state.inventory:{};
    const definitions=Array.isArray(state.itemDefs)?state.itemDefs:[];
    const equipment=record(state.equipment)?state.equipment:{};
    const equipped=new Set(Object.keys(equipment).map(slot=>equipment[slot]?.itemName).filter(id));
    for(const identity of Object.keys(store)){
      const quantity=store[identity];if(!id(identity)||!finite(quantity)||quantity<=0)continue;
      const matches=definitions.filter(def=>record(def)&&def.id===identity);
      const definition=matches.length===1&&text(matches[0].name,160)&&matches[0].name.trim()?matches[0]:null;
      result.rows.push({id:identity,name:definition?definition.name:identity,quantity,iconTextureAssetId:definition&&id(definition.iconTextureAssetId)?definition.iconTextureAssetId:null,equipped:equipped.has(identity),missingDefinition:!definition});
      if(result.rows.length>limit(config)){result.rows.pop();result.truncated=true;break;}
    }
    return result;
  }
  function progress(definition,state){
    if(definition?.progress===undefined)return {progress:null,progressUnavailable:false};
    const model=definition.progress;
    if(!record(model)||!id(model.key)||!['counter','inventory'].includes(model.type))return {progress:null,progressUnavailable:true};
    const store=model.type==='inventory'?state.inventory:state.game;
    const current=own(store,model.key)?store[model.key]:0;
    const target=model.target;
    if(!finite(current)||target!==undefined&&(!finite(target)||target<0))return {progress:null,progressUnavailable:true};
    return {progress:{current,target:target===undefined?null:target},progressUnavailable:false};
  }
  function objectives(config,state={}){
    const result=base(config,'Objectives','No objectives yet.');if(!result.available)return result;
    if(!record(state))state={};const definitions=Array.isArray(state.objectiveDefs)?state.objectiveDefs:[];
    const states=record(state.objectiveStates)?state.objectiveStates:{};
    const identities=[...new Set([...definitions.map(def=>def?.id).filter(id),...Object.keys(states).filter(id)])];
    const selected=own(config,'statusFilter')?config.statusFilter:'active';
    for(const status of selected==='all'?['active','complete','failed']:['active']){
      for(const identity of identities){
        if(!own(states,identity)||states[identity]!==status)continue;
        const matches=definitions.filter(def=>record(def)&&def.id===identity);
        const definition=matches.length===1&&text(matches[0].title,160)?matches[0]:null;
        result.rows.push({id:identity,name:definition?definition.title:identity,status,missingDefinition:!definition,...progress(definition,state)});
        if(result.rows.length>limit(config)){result.rows.pop();result.truncated=true;return result;}
      }
    }
    return result;
  }
  function dialogue(config,state={}){
    const result={...base(config,'Dialogue','No conversation.'),active:false,speaker:'',text:'',choices:[],generation:null};if(!result.available)return result;
    const presentation=record(state)?state.dialogue:null;
    if(!presentation||presentation.active===false)return result;
    if(!record(presentation)||presentation.active!==true||!text(presentation.speaker,160)||!text(presentation.text,8192)||!Number.isSafeInteger(presentation.generation)||presentation.generation<0||!Array.isArray(presentation.choices)||presentation.choices.length>32)return {...result,available:false,reason:'Invalid Dialogue presentation'};
    const ids=new Set();
    if(presentation.choices.some(choice=>!record(choice)||!id(choice.id)||!text(choice.label,320)||ids.has(choice.id)||!ids.add(choice.id)))return {...result,available:false,reason:'Invalid or ambiguous Dialogue choices'};
    result.active=true;result.speaker=presentation.speaker;result.text=presentation.text;result.generation=presentation.generation;
    // Inventory/Objective list bounds must not remove authored dialogue branches.
    // All validated choices remain reachable; the separate 32-choice bound above
    // makes malformed oversized presentations inert instead of silently pruning.
    result.choices=presentation.choices.map(choice=>({id:choice.id,label:choice.label}));
    return result;
  }
  return Object.freeze({inspect,inventory,objectives,dialogue});
});
