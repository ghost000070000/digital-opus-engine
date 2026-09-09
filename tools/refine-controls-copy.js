'use strict';
// Authored help only. Does not alter bindings, controllers or behavior records.
module.exports=function refineControlsCopy(project){
 const changes=[];
 const hasInteract=records=>(records||[]).some(o=>(o.behaviors||[]).some(b=>b.trigger==='interact'));
 const prefabInteract=(project.prefabs||[]).some(p=>hasInteract(p.records||(p.record?[p.record]:[])));
 (project.levels||[project]).forEach((level,index)=>{
  if(prefabInteract||hasInteract(level.objects))return;
  const screen=level.ui&&level.ui.startScreen;if(!screen)return;
  for(const field of ['howToPlay','controlsHint']){
   if(typeof screen[field]!=='string')continue;
   const before=screen[field];
   screen[field]=before.replace(/F interacts;\s*/g,'').replace(/ · F interact(?= ·)/g,'');
   if(screen[field]!==before)changes.push({level:index,field,before,after:screen[field],reason:'No authored interact behavior exists in this level or any project prefab.'});
  }
 });
 return changes;
};
