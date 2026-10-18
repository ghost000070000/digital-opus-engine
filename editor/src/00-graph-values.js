(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusGraphValues=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VALUE_TYPES=Object.freeze({
    valueNumber:{label:'Number Value',kind:'value',outputType:'number',help:'A number for connected Number parameters.',fields:[{key:'value',label:'Number',type:'number'}]},
    valueText:{label:'Text Value',kind:'value',outputType:'text',help:'Text for connected Text parameters. Never converted to a number or reference.',fields:[{key:'value',label:'Text',type:'text'}]},
    valueBoolean:{label:'Boolean Value',kind:'value',outputType:'boolean',help:'True or false for connected Boolean parameters.',fields:[{key:'value',label:'True',type:'checkbox'}]},
    valueObject:{label:'Object Value',kind:'value',outputType:'object',help:'A named Object reference. Empty means the owning Object (Self).',fields:[{key:'targetId',label:'Object',type:'target'}]},
    valueColor:{label:'Color Value',kind:'value',outputType:'color',help:'An RGB hex color for connected Color parameters.',fields:[{key:'value',label:'Color',type:'color'}]},
  });
  function fieldType(f,node,graph){if(!f)return null;if(f.valueType)return typeof f.valueType==='function'?f.valueType(node,graph):f.valueType;return ({number:'number',text:'text',checkbox:'boolean',target:'object',color:'color'})[f.type]||null;}
  function outputType(node,types,graph){const d=types?.[node?.type];return d?.kind==='condition'?'boolean':d?.kind==='value'?(typeof d.outputType==='function'?d.outputType(node,graph):d.outputType):null;}
  function inputType(node,key,types,graph){if(types?.[node?.type]?.kind==='value')return null;return fieldType(types?.[node?.type]?.fields?.find(f=>f.key===key),node,graph);}
  function matches(type,value){return type==='number'?typeof value==='number'&&Number.isFinite(value):type==='boolean'?typeof value==='boolean':type==='text'?typeof value==='string':type==='object'?typeof value==='string'&&value.length>0:type==='color'?typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value):false;}
  function literal(node,item){const type=VALUE_TYPES[node.type]?.outputType;const defaults={number:0,text:'',boolean:false,color:'#ffffff'};const value=type==='object'?(node.targetId||item?.id):node.value===undefined?defaults[type]:node.value;return {valid:matches(type,value),value};}
  function connection(graph,from,to,toField,types){
    const a=graph.nodes.find(n=>n.id===from),b=graph.nodes.find(n=>n.id===to),out=outputType(a,types,graph),input=inputType(b,toField,types,graph);
    if(!a||!b)return {valid:false,message:'A connected node is missing.'};
    if(!out||!input)return {valid:false,message:'Choose a Value output and a supported parameter input.'};
    if(out!==input)return {valid:false,message:`${types[a.type].label} outputs ${out}; ${types[b.type].label} · ${types[b.type].fields.find(f=>f.key===toField).label||toField} needs ${input}. No automatic conversion.`};
    return {valid:true};
  }
  // No bindings: return the original object for exact historical delegation.
  // Bindings: copy parameters, never mutate the authored inline fallback.
  function resolve(node,graph,item,types,evaluate,findObject,readVariable,readSignal){
    const bindings=(graph?.edges||[]).filter(e=>e.kind==='value'&&e.to===node.id);
    if(!bindings.length)return {valid:true,node};
    const params={...node},seen=new Set();
    for(const edge of bindings){
      if(seen.has(edge.toField)||!connection(graph,edge.from,edge.to,edge.toField,types).valid)return {valid:false};seen.add(edge.toField);
      const source=graph.nodes.find(n=>n.id===edge.from),d=types[source.type];
      const result=d.kind==='condition'?evaluate(source):d.valueSource==='variable'?readVariable?.(source):d.valueSource==='signal'?readSignal?.(source):literal(source,item);
      if(!result?.valid||!matches(inputType(node,edge.toField,types,graph),result.value))return {valid:false};
      if(inputType(node,edge.toField,types,graph)==='object'&&findObject&&!findObject(result.value))return {valid:false};
      params[edge.toField]=Array.isArray(result.value)?result.value.slice():result.value;
    }
    return {valid:true,node:params};
  }
  function validate(graph,types){
    const issues=[];if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))return [{code:'FORMAT',message:'Graph nodes and connections must be lists.'}];
    if(graph.nodes.length>2000||graph.edges.length>4000)return [{code:'LIMIT',message:'Graph validation limit:2,000 nodes /4,000 connections. Split this graph.'}];
    const nodes=new Map([['start',{id:'start',type:'__event'}]]),bindings=new Set(),dependencies=new Map();
    const add=(code,message,edge)=>issues.push({code,message,...(edge?{from:edge.from,to:edge.to,toField:edge.toField}: {})});
    for(const n of graph.nodes){if(!n||typeof n.id!=='string'){add('NODE','A node has no valid identity.');continue;}if(nodes.has(n.id))add('DUPLICATE_ID',`Two nodes share identity ${n.id}.`);nodes.set(n.id,n);if(n.id!=='start'&&!types[n.type])add('UNKNOWN',`Unavailable node ${n.type} is preserved.`);}
    for(const e of graph.edges){
      if(!e||!nodes.has(e.from)||!nodes.has(e.to)){add('MISSING','A connection points to a missing node.',e);continue;}
      if(e.kind==='value'){
        const c=connection(graph,e.from,e.to,e.toField,types);if(!c.valid)add('TYPE',c.message,e);
        const key=e.to+'::'+e.toField;if(bindings.has(key))add('MULTIPLE','A parameter has multiple Value inputs; keep one.',e);bindings.add(key);
      }else if(!['next','gate','cond'].includes(e.kind))add('EDGE','Unknown connection kind is preserved.',e);
      // Condition operand/value dependencies point from consumer to producer.
      // Iterative traversal avoids a validation stack overflow on long graphs.
      if(['cond','value'].includes(e.kind)){if(!dependencies.has(e.to))dependencies.set(e.to,[]);dependencies.get(e.to).push(e.from);}
    }
    const done=new Set();for(const id of nodes.keys()){
      if(done.has(id))continue;const active=new Set(),stack=[{id,exit:false}];
      while(stack.length){const step=stack.pop();if(step.exit){active.delete(step.id);done.add(step.id);continue;}if(active.has(step.id)){add('CYCLE',`Cyclic dependency at ${types[nodes.get(step.id)?.type]?.label||step.id}. Remove a value/operand connection; invalid dependencies do not execute.`);continue;}if(done.has(step.id))continue;active.add(step.id);stack.push({id:step.id,exit:true});for(const dep of dependencies.get(step.id)||[])stack.push({id:dep,exit:false});}
    }
    return issues;
  }
  function compare(type,operator,left,right,findObject){
    if(!matches(type,left)||!matches(type,right)||!['eq','ne','lt','lte','gt','gte'].includes(operator))return {valid:false,value:false};
    if(type!=='number'&&!['eq','ne'].includes(operator))return {valid:false,value:false};
    if(type==='object'&&(!findObject||!findObject(left)||!findObject(right)))return {valid:false,value:false};
    if(type==='color'){left=left.toLowerCase();right=right.toLowerCase();}
    return {valid:true,value:operator==='eq'?left===right:operator==='ne'?left!==right:operator==='lt'?left<right:operator==='lte'?left<=right:operator==='gt'?left>right:left>=right};
  }
  return Object.freeze({VALUE_TYPES,fieldType,outputType,inputType,matches,compare,connection,resolve,validate});
});
