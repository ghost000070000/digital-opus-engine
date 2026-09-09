'use strict';
// These two samples already author ordinary health damage and a health HUD.
// Close their failure loop using the existing public Node Graph condition.
module.exports=function refineHealthOutcomes(project,id){
 if(!['sentinel-maze','valley-run'].includes(id))return;
 for(const level of project.levels||[]){
  if(id==='sentinel-maze'){
   // Preserve a walkable route through the maze's lower passage.
   const wall=level.objects.find(o=>o.id==='rehab-5');if(wall){wall.position=[1,1,-5.5];wall.scale=[1,2,8];}
   const guardian=level.objects.find(o=>o.id==='obj59');
   if(guardian){guardian.position=[10,0,8];guardian.ai.base=[10,0,8];}
   // Nav movement is horizontal and arrival distance is three-dimensional.
   // Grounded roots and invisible waypoint centers must share the same Y.
   // The route follows the open right corridor and lower passage, avoiding
   // the additional walls introduced during the visual rehabilitation.
   const route=[['obj56',[10,0,8],['obj57']],['obj57',[10,0,0],['obj56','obj58']],['obj58',[10,0,-10.7],['obj57','rehab-maze-nav-lower']],['rehab-maze-nav-lower',[-2,0,-10.7],['obj58']]];
   for(const [waypointId,position,connections]of route){
    let waypoint=level.objects.find(o=>o.id===waypointId);
    if(!waypoint){waypoint={kind:'cube',id:waypointId,name:'Lower passage waypoint',scale:[.4,.4,.4],color:[0,0,0],rotationY:0,mesh:'cube',behaviors:[],isWaypoint:true,isTrigger:true,visible:false,hiddenInPlay:true};level.objects.push(waypoint);}
    waypoint.position=position;waypoint.connections=connections;
   }
  }
  const bounds=level.playerSettings?.playBounds||{minX:-30,maxX:30,minZ:-30,maxZ:30};
  const monitorId='rehab-health-outcome-'+id+'-'+level.id;
  const monitor={kind:'cube',id:monitorId,name:'Health outcome monitor',position:[(bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2],scale:[bounds.maxX-bounds.minX+4,80,bounds.maxZ-bounds.minZ+4],rotationY:0,mesh:'cube',color:[0,0,0],solid:false,isTrigger:true,triggerRepeat:true,visible:false,hiddenInPlay:true,behaviors:[{trigger:'stay',action:'graph',graph:{nodes:[{id:'empty',type:'healthAtMost',target:0},{id:'lost',type:'lose'}],edges:[{kind:'next',from:'start',to:'lost'},{kind:'gate',from:'empty',to:'lost'}]}}]};
  const index=level.objects.findIndex(o=>o.id===monitorId);if(index>=0)level.objects[index]=monitor;else level.objects.push(monitor);
  level.ui=level.ui||{};
  level.ui.loseTitle=id==='sentinel-maze'?'Caught by the sentinel':'Lost in the valley';
  level.ui.loseMessage='You ran out of health. Restart and keep clear of the patrolling guardian.';
 }
};
if(require.main===module){
 const fs=require('fs');const {composeExportHTML}=require('../build/export-template');
 for(const id of process.argv.slice(2).length?process.argv.slice(2):['sentinel-maze','valley-run']){
  if(!['sentinel-maze','valley-run'].includes(id))throw Error('Unsupported health-outcome target: '+id);
  const file='games/'+id+'.json',p=JSON.parse(fs.readFileSync(file));module.exports(p,id);fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
  fs.writeFileSync('dist/games/'+id+'.html',composeExportHTML({htmlTemplate:fs.readFileSync('editor/index.html','utf8'),engineJS:fs.readFileSync('dist/opus-engine.js','utf8'),editorJS:fs.readFileSync('editor/src/01-editor.js','utf8'),templateJS:fs.readFileSync('build/export-template.js','utf8'),embeddedProjectJSON:fs.readFileSync(file,'utf8'),playableOnly:true,title:p.meta.title}));console.log(id+': authored health loss and rebuilt standalone');
 }
}
