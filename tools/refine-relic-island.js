// One-shot island pickups must stop their enter behavior after collection.
module.exports=function refineRelicIsland(project){
 const l=project.levels[0];
 for(const o of l.objects){if(!/Relic|Key/i.test(o.name||''))continue;for(const b of o.behaviors||[]){if(b.trigger==='enter'&&b.action==='setVisibility'&&b.params?.visible===false&&!b.params?.targetId){b.action='destroyObject';b.params={};}}}
 return project;
};
