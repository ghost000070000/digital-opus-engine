(function(root,factory){const variables=typeof module==='object'&&module.exports?require('./00-graph-variables'):root.OpusGraphVariables;const api=factory(variables);if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusHudBindings=api;})(typeof globalThis!=='undefined'?globalThis:this,function(variables){
  'use strict';
  const own=(record,key)=>!!record&&Object.prototype.hasOwnProperty.call(record,key);
  const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const primitive=['number','text','boolean'];
  const named=value=>typeof value==='string'&&value.trim().length>0&&!['__proto__','prototype','constructor'].includes(value);
  const matches=(type,value)=>type==='number'?typeof value==='number'&&Number.isFinite(value):type==='text'?typeof value==='string':type==='boolean'?typeof value==='boolean':false;
  const key=(source,name,type)=>source+':'+encodeURIComponent(JSON.stringify([name||'',type||'']));
  function descriptor(source,name,type,label,available=true,reason=''){return {key:key(source,name,type),source,name,type,label,available,reason};}
  function catalog(input={}){
    if(!record(input))input={};
    const result=[descriptor('health','','number','Player Health'),descriptor('maxHealth','','number','Maximum Player Health'),descriptor('activeObjective','','text','Active Objective Title')];
    const seen=new Set();
    for(const action of Array.isArray(input.actions)?input.actions:[]){
      if(!record(action)||!record(action.params))continue;
      let source,name;
      if(['setCounter','incrementCounter','decrementCounter'].includes(action.type)){source='counter';name=action.params.counter;}
      if(['startTimer','stopTimer','resetTimer','setTimer'].includes(action.type)){source='timer';name=action.params.name;}
      if(!source||!named(name))continue;
      const identity=key(source,name,'number');if(seen.has(identity))continue;seen.add(identity);
      result.push(descriptor(source,name,'number',name+' · '+(source==='counter'?'Counter':'Timer (seconds)')));
    }
    const groups=new Map();
    for(const graph of Array.isArray(input.graphs)?input.graphs:[]){
      for(const value of Array.isArray(graph?.variables)?graph.variables:[]){
        if(!record(value)||value.scope!=='game'||!named(value.name))continue;
        let group=groups.get(value.name);if(!group){group=[];groups.set(value.name,group);}
        const valid=variables.definition(graph,value.id);
        group.push({graph,definition:valid,value,initial:valid?variables.initial(valid):undefined});
      }
    }
    for(const [name,group] of groups){
      const first=group[0],type=first.value.type;
      if(!group.some(entry=>primitive.includes(entry.value.type)))continue;
      const available=group.every(entry=>entry.definition&&primitive.includes(entry.definition.type)&&entry.definition.type===type&&Object.is(entry.initial,first.initial));
      const entry=descriptor('gameVariable',name,type,name+' · Game Variable · '+String(type),available,available?'':'Conflicting or invalid shared Game Variable declarations');
      if(available){entry.graph=first.graph;entry.variableId=first.definition.id;Object.defineProperty(entry,'declarations',{value:group.map(item=>({graph:item.graph,variableId:item.definition.id})),enumerable:false});}
      result.push(entry);
    }
    return result;
  }
  function resolve(binding,options,state={},settings={}){
    if(!record(state))state={};if(!record(settings))settings={};
    const unavailable=reason=>({available:false,value:undefined,reason});
    if(!record(binding)||!own(binding,'version')||binding.version!==1||!own(binding,'source'))return unavailable('Invalid or unsupported HUD binding');
    const source=binding.source;
    if(!['counter','timer','gameVariable','health','maxHealth','activeObjective'].includes(source))return unavailable('Unsupported HUD binding source');
    if(['counter','timer','gameVariable'].includes(source)&&(!own(binding,'name')||!named(binding.name)))return unavailable('Choose a named HUD binding source');
    if(source==='gameVariable'&&(!own(binding,'type')||!primitive.includes(binding.type)))return unavailable('Choose a typed Game Variable');
    const entries=(Array.isArray(options)?options:[]).filter(entry=>record(entry)&&entry.source===source&&(!['counter','timer','gameVariable'].includes(source)||entry.name===binding.name));
    if(entries.length!==1)return unavailable('Missing or ambiguous HUD binding source');
    const entry=entries[0];
    if(!entry.available)return unavailable(entry.reason||'Unavailable HUD binding source');
    if(own(binding,'type')&&entry.type!==binding.type)return unavailable('HUD binding type does not match its source');
    if(source==='gameVariable'&&entry.type!==binding.type)return unavailable('Game Variable type changed; choose a replacement');
    const preview=settings.preview===true;
    if(source==='counter'){
      const value=!preview&&own(state.game,binding.name)?state.game[binding.name]:0;
      return matches('number',value)?{available:true,value,reason:''}:unavailable('Counter value is not a finite number');
    }
    if(source==='timer'){
      const value=!preview&&own(state.timers,binding.name)?state.timers[binding.name]?.elapsed:0;
      return matches('number',value)?{available:true,value,reason:''}:unavailable('Timer value is not finite seconds');
    }
    if(source==='gameVariable'){
      const definition=variables.definition(entry.graph,entry.variableId);
      if(!definition||definition.scope!=='game'||definition.name!==binding.name||definition.type!==binding.type)return unavailable('Missing or changed Game Variable declaration');
      const initial=variables.initial(definition);
      if(!Array.isArray(entry.declarations)||!entry.declarations.every(item=>{const current=variables.definition(item.graph,item.variableId);return current&&current.scope==='game'&&current.name===binding.name&&current.type===binding.type&&Object.is(variables.initial(current),initial);}))return unavailable('Conflicting or changed shared Game Variable declarations');
      const read=variables.read(entry.graph,entry.variableId,undefined,undefined,preview?undefined:state.game);
      return read.valid?{available:true,value:read.value,reason:''}:unavailable('Game Variable runtime value has the wrong type');
    }
    const value=source==='activeObjective'?(preview?'':state.activeObjectiveTitle??''):(preview?100:state[source]);
    return matches(entry.type,value)?{available:true,value,reason:''}:unavailable('HUD source has no valid runtime value');
  }
  return Object.freeze({catalog,resolve});
});
