(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpusGraphTrace=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CAPACITY=200;
  function create(){let enabled=false,records=[],dropped=0,serial=0;const text=v=>typeof v==='string'?v.slice(0,160):'';
    return Object.freeze({get enabled(){return enabled;},setEnabled(value){enabled=value===true;},clear(){records=[];dropped=0;serial=0;},record(entry){if(!enabled)return false;const row=Object.freeze({sequence:++serial,time:Number.isFinite(entry.time)?entry.time:0,owner:text(entry.owner),ownerId:text(entry.ownerId),nodeId:text(entry.nodeId),label:text(entry.label),outcome:text(entry.outcome),functionId:text(entry.functionId),levelId:text(entry.levelId),graphKind:text(entry.graphKind),behaviorIndex:Number.isInteger(entry.behaviorIndex)&&entry.behaviorIndex>=0?entry.behaviorIndex:-1,graphFunctionId:text(entry.graphFunctionId),locationId:text(entry.locationId)});if(records.length===CAPACITY){records.shift();dropped++;}records.push(row);return true;},snapshot(){return Object.freeze({enabled,capacity:CAPACITY,dropped,total:serial,records:Object.freeze(records.slice())});}});
  }
  return Object.freeze({CAPACITY,create});
});
