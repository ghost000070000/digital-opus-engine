(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusGraphTemplates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function itemPattern(id,name,purpose,consume,quest){
    const nodes=[
      {id:'has',type:'hasNamedItem',itemId:'',count:1,x:40,y:40},
      quest?{id:'ready',type:'objectiveIsActive',objectiveId:'',x:340,y:40}:{id:'ready',type:'doorIsClosed',targetId:'',x:340,y:40},
      {id:'capture',type:'writeGraphVariable',variableId:'eligible',value:true,x:40,y:240},
      {id:'read',type:'readGraphVariable',variableId:'eligible',x:340,y:420},
      {id:'allowed',type:'compareValues',valueType:'boolean',operator:'eq',left:false,right:true,x:640,y:420},
      quest?{id:'effect',type:'completeObjective',objectiveId:'',x:340,y:240}:{id:'effect',type:'openDoor',targetId:'',x:340,y:240}
    ];
    const edges=[{from:'start',to:'capture',kind:'next'},{from:'has',to:'capture',kind:'gate'},{from:'ready',to:'capture',kind:'gate'},{from:'capture',to:'effect',kind:'next'},{from:'read',to:'allowed',kind:'value',toField:'left'},{from:'allowed',to:'effect',kind:'gate'}];
    if(consume){nodes.push({id:'consume',type:'removeNamedItem',itemId:'',count:1,x:640,y:240});edges.push({from:'effect',to:'consume',kind:'next'},{from:'allowed',to:'consume',kind:'gate'});}
    return {id,name,purpose,requiresItemPattern:true,patternTarget:quest?'objective':'door',nodes,edges,variables:[{id:'eligible',name:'Eligible this interaction',type:'boolean',scope:'local',initial:false}]};
  }
  function questBranch(){
    const nodes=[
      {id:'active',type:'objectiveIsActive',objectiveId:'',x:40,y:40},
      {id:'decision',type:'hasNamedItem',itemId:'',count:1,x:340,y:40},
      {id:'captureReady',type:'writeGraphVariable',variableId:'questReady',value:true,x:40,y:230},
      {id:'captureRoute',type:'writeGraphVariable',variableId:'questRoute',value:true,x:340,y:230},
      {id:'readReady',type:'readGraphVariable',variableId:'questReady',x:40,y:430},
      {id:'readRoute',type:'readGraphVariable',variableId:'questRoute',x:340,y:430},
      {id:'allowed',type:'compareValues',valueType:'boolean',operator:'eq',left:false,right:true,x:40,y:620},
      {id:'yes',type:'compareValues',valueType:'boolean',operator:'eq',left:false,right:true,x:340,y:620},
      {id:'no',type:'compareValues',valueType:'boolean',operator:'eq',left:false,right:false,x:640,y:620},
      {id:'complete',type:'completeObjective',objectiveId:'',x:640,y:230},
      {id:'activateYes',type:'activateObjective',objectiveId:'',x:940,y:230},
      {id:'activateNo',type:'activateObjective',objectiveId:'',x:1240,y:230}
    ];
    const edges=[{from:'start',to:'captureReady',kind:'next'},{from:'active',to:'captureReady',kind:'gate'},{from:'captureReady',to:'captureRoute',kind:'next'},{from:'decision',to:'captureRoute',kind:'gate'},{from:'captureRoute',to:'complete',kind:'next'},{from:'complete',to:'activateYes',kind:'next'},{from:'activateYes',to:'activateNo',kind:'next'},{from:'readReady',to:'allowed',kind:'value',toField:'left'},{from:'readRoute',to:'yes',kind:'value',toField:'left'},{from:'readRoute',to:'no',kind:'value',toField:'left'},...['complete','activateYes','activateNo'].map(to=>({from:'allowed',to,kind:'gate'})),{from:'yes',to:'activateYes',kind:'gate'},{from:'no',to:'activateNo',kind:'gate'}];
    return {id:'quest-item-branch',name:'Quest-lite: choose a named route',purpose:'While the source Objective is active, capture Item possession once, complete the source, then activate exactly one named outcome. Items are not consumed. Repeated completed-source events do nothing.',requiresQuestFlow:true,nodes,edges,variables:[{id:'questReady',name:'Source active this event',type:'boolean',scope:'local',initial:false},{id:'questRoute',name:'Chosen route this event',type:'boolean',scope:'local',initial:false}]};
  }
  const recipes=[
    {id:'count-self',name:'Count this Object’s events',purpose:'Increment Self’s visits by1 whenever the owning Event fires. Other Objects have independent counts.',nodes:[{id:'count',type:'incrementObjectVariable',targetId:'',name:'visits',amount:1,x:60,y:220}],edges:[{from:'start',to:'count',kind:'next'}]},
    {id:'delayed-count',name:'Wait, then count',purpose:'Wait1 second, then increment Self’s visits. Each Event starts its own wait; use a non-repeating Event unless overlap is intended.',nodes:[{id:'wait',type:'delay',seconds:1,x:60,y:220},{id:'count',type:'incrementObjectVariable',targetId:'',name:'visits',amount:1,x:340,y:220}],edges:[{from:'start',to:'wait',kind:'next'},{from:'wait',to:'count',kind:'next'}]},
    {id:'local-amount',name:'Use a typed starting amount',purpose:'Read Local amount (default5) and add it to Self’s visits. Change the starting value in Variables; Local belongs to this invocation.',variables:[{id:'amount',name:'amount',type:'number',scope:'local',initial:5}],nodes:[{id:'read',type:'readGraphVariable',variableId:'amount',x:60,y:220},{id:'count',type:'incrementObjectVariable',targetId:'',name:'visits',amount:1,x:340,y:220}],edges:[{from:'start',to:'count',kind:'next'},{from:'read',to:'count',kind:'value',toField:'amount'}]}
    ,{id:'signal-relay',name:'Relay this Signal',purpose:'For an On Signal Event. Choose an outgoing Signal. Matching typed values pass through a Value pin; no-value Signals forward only the occurrence. Channel ownership belongs to this Object.',requiresSignal:true,nodes:[{id:'send',type:'sendSignal',signalId:'',x:340,y:220}],edges:[{from:'start',to:'send',kind:'next'}]},
    {id:'filtered-signal-relay',name:'Filter and relay this Signal',purpose:'For a typed On Signal Event. Compare its value to an editable matching value; only accepted occurrences are sent. Choose an outgoing Signal of the same type. Numbers start at >=0; other types use equality. Invalid values fail closed.',requiresSignal:true,requiresPayload:true,nodes:[{id:'read',type:'readSignalValue',signalId:'',x:40,y:220},{id:'compare',type:'compareValues',valueType:'number',operator:'gte',left:0,right:0,x:340,y:220},{id:'send',type:'sendSignal',signalId:'',x:650,y:220}],edges:[{from:'start',to:'send',kind:'next'},{from:'read',to:'compare',kind:'value',toField:'left'},{from:'compare',to:'send',kind:'gate'},{from:'read',to:'send',kind:'value',toField:'payload'}]}
    ,itemPattern('named-key-door','Unlock with a reusable key','For On Interact: choose a named Item and Door. A closed Door opens only with enough Items; the key is retained. Eligibility is captured locally for this invocation.',false,false)
    ,itemPattern('consumed-key-door','Unlock and consume a key','For On Interact: choose a named Item and Door. A closed Door opens, then consumes the exact chosen quantity. Already open or missing key does nothing. No delayed nodes or effect rollback.',true,false)
    ,itemPattern('quest-item-turn-in','Turn in an Item for an Objective','For On Interact: choose a named Item and active Objective. Captures eligibility once, completes the Objective, then consumes the exact quantity. Inactive/completed or missing Items do nothing. No effect rollback.',true,true)
    ,questBranch()
    ,{id:'quest-start',name:'Quest-lite: start a named Objective',purpose:'Explicitly activate one named Objective on the owning Event. Choose On Start for initial activation; ordinary Activate semantics and linear Next links are preserved.',requiresQuestFlow:true,questFlowMode:'start',nodes:[{id:'activate',type:'activateObjective',objectiveId:'',x:80,y:230}],edges:[{from:'start',to:'activate',kind:'next'}]}
  ];
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  freeze(recipes);
  function instantiate(id,nextId,context){const recipe=recipes.find(r=>r.id===id);if(!recipe)return null;
    if(recipe.requiresQuestFlow){
      const validId=v=>typeof v==='string'&&!!v&&!['__proto__','constructor','prototype'].includes(v);
      if(!context||!validId(context.sourceId))return null;
      if(recipe.questFlowMode!=='start'&&(!['yesId','noId','itemId'].every(k=>validId(context[k]))||new Set([context.sourceId,context.yesId,context.noId]).size!==3||!Number.isSafeInteger(context.quantity)||context.quantity<1||context.nextObjective))return null;
    }
    if(recipe.requiresItemPattern&&(!context||typeof context.itemId!=='string'||!context.itemId||['__proto__','constructor','prototype'].includes(context.itemId)||!Number.isSafeInteger(context.quantity)||context.quantity<1||recipe.patternTarget==='objective'&&(typeof context.objectiveId!=='string'||!context.objectiveId)||recipe.patternTarget==='door'&&typeof context.targetId!=='string'))return null;
    const type=context?.payloadType||'none';if(recipe.requiresSignal&&(!context?.signalId||!['none','number','text','boolean','object','color'].includes(type)))return null;if(recipe.requiresPayload&&type==='none')return null;
    const graph=JSON.parse(JSON.stringify({nodes:recipe.nodes,edges:recipe.edges,variables:recipe.variables||[]})),ids=new Map([['start','start']]);let n=0;const allocate=nextId||(()=>`template${++n}`);
    if(recipe.requiresQuestFlow)for(const node of graph.nodes){if(node.type==='hasNamedItem'){node.itemId=context.itemId;node.count=context.quantity;}if(recipe.questFlowMode==='start'||node.type==='objectiveIsActive'||node.type==='completeObjective')node.objectiveId=context.sourceId;if(node.id==='activateYes')node.objectiveId=context.yesId;if(node.id==='activateNo')node.objectiveId=context.noId;}
    if(recipe.requiresItemPattern)for(const node of graph.nodes){if('itemId'in node){node.itemId=context.itemId;node.count=context.quantity;}if('targetId'in node)node.targetId=context.targetId;if('objectiveId'in node)node.objectiveId=context.objectiveId;}
    if(recipe.requiresSignal&&type!=='none'){
      if(id==='signal-relay'){graph.nodes.unshift({id:'read',type:'readSignalValue',signalId:context.signalId,x:40,y:220});graph.edges.push({from:'read',to:'send',kind:'value',toField:'payload'});}
      graph.nodes.find(n=>n.type==='readSignalValue').signalId=context.signalId;
      const compare=graph.nodes.find(n=>n.type==='compareValues');if(compare){compare.valueType=type;compare.operator=type==='number'?'gte':'eq';compare.left=compare.right=({number:0,text:'',boolean:false,object:'',color:'#ffffff'})[type];}
    }
    for(const node of graph.nodes){const fresh=allocate();if(typeof fresh!=='string'||!fresh||[...ids.values()].includes(fresh))throw new Error('Template node IDs must be unique and nonempty');ids.set(node.id,fresh);node.id=fresh;}
    for(const edge of graph.edges){edge.from=ids.get(edge.from);edge.to=ids.get(edge.to);}return graph;
  }
  function nonempty(graph){return !!(graph?.nodes?.length||graph?.edges?.length||graph?.variables?.length);}
  return Object.freeze({recipes,instantiate,nonempty});
});
