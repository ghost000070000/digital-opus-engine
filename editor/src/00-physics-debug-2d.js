// Phase050: bounded read-only diagnostics over canonical geometry and state.
(function(root,factory){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const api=factory(node?require('./00-collider-2d.js'):root.OpusCollider2D,node?require('./00-trigger-collider-2d.js'):root.OpusTrigger2D,node?require('./00-collision-filter-2d.js'):root.OpusCollisionFilter2D);
 if(node)module.exports=api;else root.OpusPhysicsDebug2D=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Collider,Trigger,Filters){
 'use strict';
 const MAX_SHAPES=128,MAX_SCAN=1024;
 function copy(value){if(Array.isArray(value))return Object.freeze(value.map(copy));if(value&&typeof value==='object')return Object.freeze(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v)])));return value;}
 const EMPTY=copy({enabled:false,plane:'XY',shapes:[],objects:[],scanned:0,truncated:false,metrics:null,activeTriggerPairs:0});
 const bound=(value,fallback,max)=>Number.isFinite(value)?Math.max(1,Math.min(max,Math.floor(value))):fallback;
 function filterPolicy(left,right,layers){
  const a=Filters.filterOf(left),b=Filters.filterOf(right),registry=layers===undefined?[Filters.defaultLayer()]:layers;
  if(Filters.validateFilter(a,registry).length||Filters.validateFilter(b,registry).length)return 'INVALID_FILTER';
  return Filters.allows({filter:a},{filter:b},registry)?'FILTER_ACCEPTED':'FILTER_REJECTED';
 }
 function snapshot(objects,options={}){
  if(options.enabled!==true)return EMPTY;
  const limit=bound(options.limit,MAX_SHAPES,MAX_SHAPES),scanLimit=bound(options.scanLimit,MAX_SCAN,MAX_SCAN),shapes=[],details=[];
  let scanned=0,truncated=false;
  for(const object of objects||[]){
   if(scanned>=scanLimit||shapes.length>=limit){truncated=true;break;}scanned++;
   if(!object)continue;
   const bag=object.components||{},resolved=Collider.enumerateCollider2DWorldShapes(object);
   const trigger=Trigger.resolveTriggerWorldShape(object,bag['trigger-collider-2d']);if(trigger)resolved.push(trigger);
   if(!resolved.length)continue;
   const matrix=Collider.objectWorldMatrix(object),z=Number.isFinite(matrix?.[14])?matrix[14]:0;
   for(const shape of resolved){if(shapes.length>=limit){truncated=true;break;}
    shapes.push(copy({objectId:object.id,componentId:shape.componentId,kind:shape.kind,trigger:shape.componentId==='trigger-collider-2d',points:shape.points,center:shape.center,radius:shape.radius,aabb:shape.aabb,filter:shape.filter,z}));
   }
   const manager=options.bodyManager;
   const character=bag['character-collision-2d'];
   details.push(copy({objectId:object.id,name:object.name||String(object.id),body:bag['body-2d']?{type:bag['body-2d'].type,enabled:bag['body-2d'].enabled}:null,oneWay:bag['one-way-platform-2d']?.enabled===true,characterSettings:character?{stepHandlingEnabled:character.stepHandlingEnabled,maxStepHeight:character.maxStepHeight,slopeHandlingEnabled:character.slopeHandlingEnabled,maxSlopeAngle:character.maxSlopeAngle}:null,character:manager?.getCharacterCollision2DState?.(object.id)||null,platform:manager?.getMovingPlatform2DState?.(object.id)||null}));
  }
  // Numeric aggregate counters only; no internal maps, object ownership or caches.
  const metrics=options.bodyManager?.metrics?Object.fromEntries(Object.entries(options.bodyManager.metrics).filter(([,v])=>Number.isFinite(v))):null;
  return copy({enabled:true,plane:'XY',shapes,objects:details,scanned,truncated,metrics,activeTriggerPairs:options.triggerManager?.activePairCount?.()||0});
 }
 return Object.freeze({MAX_SHAPES,MAX_SCAN,snapshot,filterPolicy});
});
