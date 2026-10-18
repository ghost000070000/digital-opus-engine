(function(root,factory){const values=typeof module==='object'&&module.exports?require('./00-graph-values'):root.OpusGraphValues;const api=factory(values);if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusGraphVariables=api;})(typeof globalThis!=='undefined'?globalThis:this,function(values){
  'use strict';
  const TYPES=Object.freeze(['number','text','boolean','object','color']),SCOPES=Object.freeze(['local','object','game']),DEFAULTS=Object.freeze({number:0,text:'',boolean:false,object:'',color:'#ffffff'});
  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
  const isSelfDefault=v=>v.type==='object'&&(v.initial===''||v.initial===undefined);
  function definition(graph,id){const vars=graph?.variables||[];if(!Array.isArray(vars)||vars.length>64)return null;const matches=vars.filter(v=>v?.id===id);if(matches.length!==1)return null;const v=matches[0];if(!usable(v)||vars.filter(other=>other?.scope===v.scope&&other?.name===v.name).length!==1)return null;if(!isSelfDefault(v)&&!values.matches(v.type,v.initial===undefined?DEFAULTS[v.type]:v.initial))return null;return v;}
  function usable(v){return !!v&&typeof v.id==='string'&&v.id.length>0&&typeof v.name==='string'&&v.name.trim().length>0&&!['__proto__','prototype','constructor'].includes(v.name)&&TYPES.includes(v.type)&&SCOPES.includes(v.scope);}
  function initial(v,item){return isSelfDefault(v)?item?.id:v.initial===undefined?DEFAULTS[v.type]:v.initial;}
  function createScope(graph){const local=Object.create(null);return {local,graph};}
  function store(v,scope,item,game){return v.scope==='local'?scope?.local:v.scope==='object'?item?.variables:game;}
  function read(graph,id,scope,item,game){const v=definition(graph,id);if(!usable(v))return {valid:false};const data=store(v,scope,item,game),key=v.scope==='local'?v.id:v.name,value=own(data,key)?data[key]:initial(v,item);return {valid:values.matches(v.type,value),value};}
  function write(graph,id,value,scope,item,game,writeObject){
    const v=definition(graph,id);if(!usable(v)||!values.matches(v.type,value))return false;
    if(v.scope==='local'){if(!scope?.local)return false;scope.local[v.id]=value;return true;}
    if(v.scope==='object'){
      if(!item)return false;
      if(!item._authoredVariables)item._authoredVariables={...(item.variables||{})};
      if(writeObject)writeObject(v,value,item);else{if(!item.variables)item.variables={};item.variables[v.name]=value;}
      return true;
    }
    if(!game)return false;game[v.name]=value;return true;
  }
  function validate(graph){
    const vars=graph?.variables||[],issues=[];if(!Array.isArray(vars)||vars.length>64)return [{code:'VARIABLE_LIMIT',message:'Use at most64 Graph variables in one graph.'}];
    const ids=new Set(),keys=new Set();for(const v of vars){
      if(!usable(v)){issues.push({code:'VARIABLE',message:'A variable needs a valid name, type and scope. Reserved names are not allowed.'});continue;}
      if(ids.has(v.id))issues.push({code:'VARIABLE_ID',message:`Variable ${v.name} shares an identity. Recreate one definition.`});ids.add(v.id);
      const key=v.scope+':'+v.name;if(keys.has(key))issues.push({code:'VARIABLE_NAME',message:`${v.name} is repeated in ${v.scope} scope. Use distinct names.`});keys.add(key);
      if(!isSelfDefault(v)&&!values.matches(v.type,v.initial===undefined?DEFAULTS[v.type]:v.initial))issues.push({code:'VARIABLE_DEFAULT',message:`Starting value for ${v.name} must be ${v.type}.`});
    }
    for(const n of graph?.nodes||[])if(['readGraphVariable','writeGraphVariable'].includes(n.type)&&!usable(definition(graph,n.variableId)))issues.push({code:'VARIABLE_MISSING',message:'A Read/Set Variable node needs a named variable. Reconnect its missing definition.'});
    return issues;
  }
  const NODE_TYPES=Object.freeze({
    readGraphVariable:{label:'Read Variable',kind:'value',valueSource:'variable',outputType:(node,graph)=>definition(graph,node.variableId)?.type,help:'Read a named variable in its declared scope.',fields:[{key:'variableId',label:'Variable',type:'graphVariable'}]},
    writeGraphVariable:{label:'Set Variable',kind:'action',help:'Write a matching typed value in the declared Local, Object or Game scope.',fields:[{key:'variableId',label:'Variable',type:'graphVariable'},{key:'value',label:'Value',type:'graphVariableValue',valueType:(node,graph)=>definition(graph,node.variableId)?.type}]},
  });
  return Object.freeze({TYPES,SCOPES,DEFAULTS,NODE_TYPES,definition,initial,usable,createScope,read,write,validate});
});
