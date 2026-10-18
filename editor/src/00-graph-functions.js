(function(root,factory){const variables=typeof module==='object'&&module.exports?require('./00-graph-variables'):root.OpusGraphVariables,schema=typeof module==='object'&&module.exports?require('./00-graph-schema'):root.OpusGraphSchema;const api=factory(variables,schema);if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusGraphFunctions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(variables,schema){
  'use strict';
  const MAX_FUNCTIONS=128,MAX_DEPTH=8,MAX_CALL_WORK=2000;
  function find(definitions,id){if(!Array.isArray(definitions)||definitions.length>MAX_FUNCTIONS)return null;const found=definitions.filter(d=>d?.id===id);return found.length===1&&typeof found[0]?.name==='string'&&schema.canExecute(found[0].graph)?found[0]:null;}
  function invocation(definition,callerScope,callerGraph,item,fromId){
    const chain=callerScope?.callChain||[],budget=callerScope?.callBudget||{remaining:MAX_CALL_WORK};
    if(chain.length>=MAX_DEPTH||chain.includes(definition.id)||budget.remaining<=0)return null;
    if(callerScope)callerScope.callBudget=budget;
    const scope=variables.createScope(definition.graph);if(callerScope?.signalEvent)scope.signalEvent=callerScope.signalEvent;scope.callChain=[...chain,definition.id];scope.callBudget=budget;scope.returnTo={graph:callerGraph,item,fromId,scope:callerScope};return scope;
  }
  function isEditingDefinition(editor,id){const visited=new Set();for(let state=editor;state&&!visited.has(state);state=state.returnToEditor){visited.add(state);if(state.functionDefinition?.id===id)return true;}return false;}
  function validate(graph,definitions){
    const issues=[],stack=(graph?.nodes||[]).filter(n=>n.type==='callGraphFunction').map(n=>({id:n.functionId,path:[]}));let work=0;
    while(stack.length&&work++<MAX_CALL_WORK){const entry=stack.pop(),definition=find(definitions,entry.id);
      if(!definition){issues.push({code:'FUNCTION_MISSING',message:'Call Function needs an existing named definition. Choose a replacement; saved call data is retained.'});continue;}
      if(entry.path.includes(entry.id)){issues.push({code:'FUNCTION_CYCLE',message:`Recursive Function call to ${definition.name}. Remove the recursive call; runtime skips it safely.`});break;}
      if(entry.path.length>=MAX_DEPTH){issues.push({code:'FUNCTION_DEPTH',message:'Function nesting exceeds8 calls. Simplify the reusable flow.'});break;}
      for(const node of definition.graph.nodes)if(node.type==='callGraphFunction')stack.push({id:node.functionId,path:[...entry.path,entry.id]});
    }
    if(stack.length&&work>=MAX_CALL_WORK)issues.push({code:'FUNCTION_LIMIT',message:'Function dependency validation reached its bounded work budget. Simplify the reuse chain.'});return issues;
  }
  const NODE_TYPES=Object.freeze({callGraphFunction:{label:'Call Function',kind:'action',help:'Run a reusable named graph on Self. Wait for its Delay before continuing. Each call has independent Local values.',fields:[{key:'functionId',label:'Function',type:'graphFunction'}]}});
  return Object.freeze({MAX_FUNCTIONS,MAX_DEPTH,MAX_CALL_WORK,find,invocation,isEditingDefinition,validate,NODE_TYPES});
});
