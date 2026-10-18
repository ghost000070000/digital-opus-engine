'use strict';
// Explicit canonical actors only. Not a global change to historical AI defaults,
// animated platforms, path scenery, teleports or arbitrary creator projects.
const targets={
 'forest-range':['obj822','obj823','obj394'],
 'arsenal-run':['obj2009','obj2010','obj2011'],'foglight':['obj72'],
 'relic-runner-2':['enemy1'],'valley-run':['obj110'],
 'iron-arena':['obj415','obj416','obj417'],'sentinel-maze':['obj59'],
 'silent-sector':['obj3008','obj3009','obj3010'],'survival-arena':['obj49','obj50','obj51']
};
function apply(project,id){const changes=[];
 for(const level of project.levels||[])for(const record of level.objects||[]){
  if(!(targets[id]||[]).includes(record.id))continue;
  if(id==='forest-range'&&record.id==='obj394'){
   // The historical arrival overlaps the now physical waypoint floor/rail.
   // Move 1.5m back on canonical terrain; no global depenetration policy.
   if(!record.isSpawnPoint||!record.isDefaultSpawn||record.position[0]!==-7||![-5.5,-7].includes(record.position[2]))throw new Error('Preserve changed Forest arrival for review');
   const before=JSON.parse(JSON.stringify(record)),terrain=level.objects.find(o=>o.kind==='terrain');if(!terrain)throw new Error('Forest arrival requires its terrain');
   const fs=require('fs'),path=require('path'),vm=require('vm'),ctx={window:{},Float32Array,Uint16Array,Uint32Array,Uint8Array,DataView,ArrayBuffer,TextDecoder};
   vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/opus-engine.js'),'utf8'),ctx);
   const options={...terrain.options},origin=options.position||[0,0,0];delete options.position;
   record.position=[-7,ctx.window.Opus.Terrain.sampleHeight(-7-origin[0],-7-origin[2],options)+origin[1],-7];
   if(JSON.stringify(before)!==JSON.stringify(record))changes.push({level:level.id,id:record.id,before,after:JSON.parse(JSON.stringify(record))});
   continue;
  }
  const grassActor=id==='forest-range'&&record.id==='obj823',pineActor=id==='forest-range'&&record.id==='obj822';
  if(grassActor||pineActor ? record.assetId!==(grassActor?'showcase-grass':'showcase-tree-pine')||record.ai?.mode!=='stateMachine'||record.scale?.some(v=>v!==(grassActor ? .32 : .7))||!record.tags?.includes('enemy') : !record.ai||record.collider?.shape!=='sphere'||!(record.collider.radius>0))throw new Error(`Review changed actor contract: ${id}/${record.id}`);
  const before=JSON.parse(JSON.stringify(record));record.ai.collideWithSolids=true;record.ai.collisionRadius=grassActor ? 0.16 : pineActor ? .35 : record.collider.radius;
  if(id==='iron-arena'){
   // The original bodies overlap the raised North fighting deck. Keep all
   // three on the existing arena floor, clear of it by their authored radii.
   const positions={obj415:[-7,.03,7],obj416:[0,.03,13],obj417:[7,.03,7]};
   record.position=[...positions[record.id]];record.ai.base=[...record.position];
  }
  if(id==='sentinel-maze'){
   // Original guardian radius overlaps the newly physical exit-arch post.
   // Stay on the same existing maze floor, half a metre back from the post.
   record.position=[10,0,7.5];record.ai.base=[...record.position];
  }
  if(JSON.stringify(before)!==JSON.stringify(record))changes.push({level:level.id,id:record.id,before,after:JSON.parse(JSON.stringify(record))});
 }
 return changes;
}
module.exports={apply,targets};
