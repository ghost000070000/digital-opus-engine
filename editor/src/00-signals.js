(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusSignals=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_DEFINITIONS=128,MAX_PENDING=256,MAX_OCCURRENCES=256,MAX_DELIVERIES=2048;
  const PAYLOAD_TYPES=Object.freeze(['none','number','text','boolean','object','color']);
  const CHANNEL_SCOPES=Object.freeze(['project','level','prefab']);
  function channelScope(definition){return definition?.scope===undefined?'project':definition.scope;}
  function payloadType(definition){return definition?.payloadType===undefined?'none':definition.payloadType;}
  function accepts(type,value){return type==='none'?value===undefined:type==='number'?typeof value==='number'&&Number.isFinite(value):type==='text'?typeof value==='string'&&value.length<=4096:type==='boolean'?typeof value==='boolean':type==='object'?typeof value==='string'&&value.length>0&&value.length<=160:type==='color'?typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value):false;}
  const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const text=v=>typeof v==='string'&&v.length>0&&v.length<=80&&v===v.trim();
  function find(definitions,id){if(!Array.isArray(definitions)||!text(id))return null;const list=definitions.slice(0,MAX_DEFINITIONS),matches=list.filter(d=>record(d)&&d.id===id);if(matches.length!==1)return null;const d=matches[0];if(!text(d.name)||!PAYLOAD_TYPES.includes(payloadType(d))||!CHANNEL_SCOPES.includes(channelScope(d))||list.filter(n=>record(n)&&typeof n.name==='string'&&n.name.toLowerCase()===d.name.toLowerCase()).length!==1)return null;return d;}
  function channel(definition,context={}){const scope=channelScope(definition);if(scope==='project')return Object.freeze({scope});if(scope==='level'&&text(definition.levelId)&&definition.levelId===context.levelId)return Object.freeze({scope,levelId:context.levelId});if(scope==='prefab'&&text(context.prefabInstanceId))return Object.freeze({scope,prefabInstanceId:context.prefabInstanceId});return null;}
  function matchesChannel(captured,context={}){return captured.scope==='project'||captured.scope==='level'&&captured.levelId===context.levelId||captured.scope==='prefab'&&captured.prefabInstanceId===context.prefabInstanceId;}
  function copy(definitions){return Array.isArray(definitions)?JSON.parse(JSON.stringify(definitions)):[];}
  // Shared, read-only authoring/export audit. Walk stored canonical logic,
  // including Function caller occurrence context; never execute or migrate it.
  function collectDependencies(project,options={}){
    const issues=[],references=[],defs=project?.signals,list=v=>Array.isArray(v)?v:[],functions=list(project?.graphFunctions),seenIssues=new Set();let work=0,truncated=false;
    const budget=()=>{if(++work<=65536)return true;truncated=true;return false;};
    const issue=(code,message,where,referenceValue,severity='error')=>{const key=JSON.stringify([code,where,referenceValue]);if(seenIssues.has(key))return;seenIssues.add(key);issues.push({scope:'signal',severity,code,message,...where,referenceType:'signal',referenceValue});};
    const location=where=>[where.levelName,where.prefabName,where.objectName,where.functionName,where.sequenceName,where.objectiveName,where.field].filter(Boolean).join(' → ')||'Project Signals';
    if(defs!==undefined&&!Array.isArray(defs))issue('signal-definitions-invalid','Project Signals must be a list. Saved data was retained; restore or repair the declaration collection.',{},null);
    for(const definition of list(defs))if(!find(defs,definition?.id)||(channelScope(definition)==='level'&&!list(project?.levels).some(level=>text(definition?.levelId)&&level?.id===definition.levelId)))issue('signal-definition-invalid','Project Signals contains a duplicate, malformed or unavailable declaration. Repair its name, type and channel; saved data was not changed.',{},definition?.id);
    if(list(defs).length>MAX_DEFINITIONS)issue('signal-definition-limit',`Project Signals exceeds the runtime limit of ${MAX_DEFINITIONS}.`,{},null);
    function reference(id,where,kind,context){
      references.push({signalId:id,...where,kind});const d=find(defs,id);
      if(!d){issue('signal-reference-unavailable',`${location(where)}: ${kind} needs an available named Signal. Choose it in the existing control or restore the declaration with Undo.`,where,id);return null;}
      if(context&&((channelScope(d)==='level'&&context.levelId!==undefined&&d.levelId!==context.levelId)||(channelScope(d)==='prefab'&&!context.prefabInstanceId)))issue('signal-channel-unavailable',`${location(where)}: “${d.name}” belongs to a different Level or needs a Prefab instance owner.${kind==='On Signal'?' This receiver is intentionally ineligible here; placed assemblies retain their independent channel.':' Repair the authored channel or place the intended assembly.'}`,where,id,kind==='On Signal'?'warning':'error');
      return d;
    }
    function action(type,params,where,context){if(type!=='sendSignal')return;const p=record(params)?params:{};const d=reference(p.signalId,where,'Send Signal',context);if(d&&!accepts(payloadType(d),p.payload)&&!(payloadType(d)==='object'&&p.payload===''))issue('signal-payload-invalid',`${location(where)}: “${d.name}” needs a ${payloadType(d)} value; no automatic conversion.`,where,p.signalId);}
    function graph(g,where,context,eventId,chain=[]){
      if(!record(g))return;const nodes=list(g.nodes),edges=list(g.edges);
      for(const n of nodes){if(!budget())break;if(!record(n))continue;const at={...where,field:`${where.field||'Graph'} / ${n.id||n.type}`};
        if(n.type==='sendSignal'||n.type==='readSignalValue'){
          const d=reference(n.signalId,at,n.type==='sendSignal'?'Send Signal':'Read Signal Value',context);if(!d)continue;
          if(n.type==='readSignalValue'){
            if(payloadType(d)==='none')issue('signal-payload-invalid',`${location(at)}: “${d.name}” has no value to read.`,at,n.signalId);
            // Uncalled library Functions may inherit any caller. Actual call
            // paths below audit the occurrence; no fictitious global last value.
            if(eventId!==undefined&&eventId!==n.signalId)issue('signal-occurrence-unavailable',`${location(at)}: Read Signal Value does not match this caller's On Signal occurrence.`,at,n.signalId);
          }else{
            const bindings=edges.filter(e=>e?.kind==='value'&&e.to===n.id&&e.toField==='payload'),bound=bindings.length>0;
            if(bound){const source=nodes.find(candidate=>candidate?.id===bindings[0].from),type=options.graphValueType?.(source,g);if(bindings.length!==1||!source||(options.graphValueType&&type!==payloadType(d)))issue('signal-bound-value-invalid',`${location(at)}: “${d.name}” needs one connected ${payloadType(d)} Value from an available node.`,at,n.signalId);}
            if(!bound&&!accepts(payloadType(d),n.payload)&&!(payloadType(d)==='object'&&n.payload===''))issue('signal-payload-invalid',`${location(at)}: “${d.name}” needs a ${payloadType(d)} literal or matching connected Value.`,at,n.signalId);
          }
        }
        if(n.type==='callGraphFunction'&&!chain.includes(n.functionId)&&chain.length<8){const found=functions.filter(f=>f?.id===n.functionId);if(found.length===1)graph(found[0].graph,{...at,functionId:found[0].id,functionName:found[0].name||found[0].id},context,eventId,[...chain,n.functionId]);}
      }
    }
    function behaviors(values,where,context){for(const b of list(values)){if(!budget())break;if(!record(b))continue;const at={...where,field:`Behavior ${b.name||b.id||b.action||'Event'}`};if(b.trigger==='signal')reference(b.eventRef?.signalId,at,'On Signal',context);if(b.action==='graph')graph(b.graph,at,context,b.trigger==='signal'?b.eventRef?.signalId:null);else action(b.action,b.params,at,context);}}
    function object(o,where,context){if(!record(o)||!budget())return;const at={...where,objectId:o.id,objectName:o.name||o.id},owner={...context,prefabInstanceId:context?.prefabInstanceId||o.signalPrefabInstanceId};behaviors(o.behaviors,at,owner);for(const state of list(o.states))for(const entry of list(state?.entryActions))action(entry?.action,entry?.params,{...at,field:`State ${state?.name||state?.id} entry`},owner);}
    for(const level of list(project?.levels)){if(!record(level))continue;const at={levelId:level.id,levelName:level.name||level.id},context={levelId:level.id};for(const o of list(level.objects))object(o,at,context);
      for(const seq of list(level.sequences)){if(!record(seq))continue;for(const step of list(seq.steps)){if(!budget())break;action(step?.actionType,step?.params,{...at,sequenceId:seq.id,sequenceName:seq.name||seq.id,field:'Sequence step'},null);}}
      for(const goal of list(level.objectiveDefs)){if(!record(goal))continue;for(const state of ['active','complete','failed']){const id=goal.signals?.[state];if(id===undefined||id==='')continue;const where={...at,objectiveId:goal.id,objectiveName:goal.title||goal.id,field:`Objective ${state} notification`},d=reference(id,where,'Objective notification',null);if(d&&payloadType(d)!=='none')issue('signal-notification-type',`${location(where)}: “${d.name}” must be a no-value Signal for an Objective notification.`,where,id);}}
    }
    for(const prefab of list(project?.prefabs)){if(!record(prefab))continue;const where={prefabName:prefab.name},context={prefabInstanceId:'portable-assembly'};const records=Array.isArray(prefab.records)?prefab.records:Array.isArray(prefab.objects)?prefab.objects:prefab.record?[prefab.record]:[prefab];for(const o of records)object(o,where,context);}
    for(const f of functions)if(record(f))graph(f.graph,{functionId:f.id,functionName:f.name||f.id,field:'Function Graph'},null,undefined,[f.id]);
    for(const clip of list(project?.spriteAnimations))for(const event of list(clip?.events))action(event?.action,event?.params,{assetId:clip.id,field:`Animation ${clip.name||clip.id} Event`},null);
    if(truncated)issue('signal-audit-limit','Signal dependency review exceeded its bounded work limit. Split or simplify the project before relying on export validation.',{},null);
    return {issues,references,work,truncated};
  }
  const DIAGNOSTIC_CAPACITY=128;
  function createDiagnostics(){let enabled=false,records=[],total=0,dropped=0;const short=v=>typeof v==='string'?v.slice(0,160):'';
    return Object.freeze({get enabled(){return enabled;},setEnabled(value){enabled=value===true;},clear(){records=[];total=0;dropped=0;},record(entry){if(!enabled)return false;const value=entry.value===undefined?'No value':typeof entry.value==='string'?entry.value.slice(0,160):typeof entry.value==='boolean'||typeof entry.value==='number'?String(entry.value):'Invalid value';const row=Object.freeze({sequence:++total,kind:short(entry.kind),reason:short(entry.reason),signalId:short(entry.signalId),type:short(entry.type),value,scope:short(entry.channel?.scope),levelId:short(entry.channel?.levelId),prefabInstanceId:short(entry.channel?.prefabInstanceId),sourceId:short(entry.sourceId),receiverId:short(entry.receiverId),time:Number.isFinite(entry.time)?entry.time:0});if(records.length===DIAGNOSTIC_CAPACITY){records.shift();dropped++;}records.push(row);return true;},snapshot(){return Object.freeze({enabled,capacity:DIAGNOSTIC_CAPACITY,total,dropped,records:Object.freeze(records.slice())});}});
  }
  function create(adapter){let queue=[],generation=0,draining=false;
    // Optional read-only diagnostics never own receivers, alter queue state or
    // propagate observer exceptions into gameplay. Only bounded scalar IDs are
    // exposed, not live sender/receiver references or arbitrary payload objects.
    function observe(kind,event={},reason='',receiver){if(typeof adapter.onObserve!=='function')return;const scalar=value=>value===undefined||typeof value==='string'||typeof value==='boolean'||typeof value==='number'?value:'Invalid value';try{adapter.onObserve(Object.freeze({kind,...event,signalId:scalar(event.signalId),value:scalar(event.value),reason,receiverId:typeof receiver?.owner?.id==='string'?receiver.owner.id.slice(0,160):typeof receiver?.id==='string'?receiver.id.slice(0,160):undefined}));}catch(_){/* diagnostic failure cannot change delivery */}}
    function clear(){queue=[];generation++;observe('reset');}
    function emit(id,value,source){const definition=find(adapter.definitions(),id),type=payloadType(definition),event={signalId:id,type,value,sourceId:typeof source?.id==='string'?source.id.slice(0,160):undefined};if(!adapter.isActive()){observe('rejected',event,'Play is stopped, paused or ended');return false;}if(!definition){observe('rejected',event,'Signal definition is missing, invalid or ambiguous');return false;}if(!accepts(type,value)){observe('rejected',event,'Value does not match the declared Signal type');return false;}const captured=channel(definition,channelScope(definition)==='project'?{}:adapter.context?.(source));if(!captured){observe('rejected',event,'Sender does not belong to this Level or placed Prefab channel');return false;}if(queue.length>=MAX_PENDING){adapter.onOverflow?.('Signal queue is full; this occurrence was not sent.');observe('overflow',event,'Pending occurrence limit reached');return false;}const queued=Object.freeze({...event,channel:captured});queue.push(queued);observe('accepted',queued,'Queued; receiver effects not yet proven');return true;}
    function drain(){if(draining||!queue.length)return null;if(!adapter.isActive()){clear();return null;}const session=generation;let processed=0,delivered=0,dropped=0;draining=true;
      try{while(queue.length&&generation===session&&adapter.isActive()){
        if(processed>=MAX_OCCURRENCES||delivered>=MAX_DELIVERIES){dropped+=queue.length;queue=[];adapter.onOverflow?.('Signal delivery limit reached; remaining occurrences discarded. Check repeating Send Signal logic.');observe('overflow',{},'Occurrence/delivery work limit reached');break;}
        const event=queue.shift(),id=event.signalId;processed++;const definition=find(adapter.definitions(),id);if(!definition||payloadType(definition)!==event.type||channelScope(definition)!==event.channel.scope||event.channel.scope==='level'&&(!channel(definition,adapter.context?.())||definition.levelId!==event.channel.levelId)){observe('skipped',event,'Definition type/channel changed before delivery');continue;}
        const all=adapter.receivers(id),receivers=all.slice(0,MAX_DELIVERIES);if(all.length>receivers.length){dropped+=all.length-receivers.length;adapter.onOverflow?.('Signal receiver limit reached; remaining deliveries discarded.');}
        if(!receivers.length)observe('unreceived',event,'No active-scene On Signal receivers');let invoked=0;
        for(let i=0;i<receivers.length;i++){const receiver=receivers[i];if(generation!==session||!adapter.isActive())break;if(delivered>=MAX_DELIVERIES){dropped+=receivers.length-i;adapter.onOverflow?.('Signal receiver work limit reached; remaining deliveries discarded.');observe('overflow',event,'Receiver work limit reached');break;}if(!adapter.isAlive(receiver,id)){observe('skipped',event,'Receiver no longer exists or listens',receiver);continue;}if(!matchesChannel(event.channel,event.channel.scope==='project'?{}:adapter.receiverContext?.(receiver))){observe('skipped',event,'Receiver belongs to a different channel',receiver);continue;}delivered++;invoked++;observe('invoked',event,'Receiver invoked; Action effect is not proven',receiver);try{adapter.deliver(receiver,id,event);}catch(error){adapter.onError?.(error);observe('error',event,'Receiver Action raised an error',receiver);}}
        if(receivers.length&&!invoked&&generation===session)observe('unreceived',event,'No eligible receiver in the captured channel');
      }}finally{draining=false;}
      return Object.freeze({processed,delivered,dropped});
    }
    return Object.freeze({emit,drain,clear,pending:()=>queue.length});
  }
  return Object.freeze({MAX_DEFINITIONS,MAX_PENDING,MAX_OCCURRENCES,MAX_DELIVERIES,PAYLOAD_TYPES,payloadType,CHANNEL_SCOPES,channelScope,channel,matchesChannel,accepts,find,copy,create,collectDependencies,DIAGNOSTIC_CAPACITY,createDiagnostics});
});
