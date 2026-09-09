'use strict';
// Bounded level authoring corrections discovered during normal-input proof.
// Uses the shipped terrain sculpt and state-machine actions, not runtime patches.
module.exports=function refineRelicFrontier(project,Opus){
 const level=project.levels[0],terrain=level.objects.find(o=>o.kind==='terrain');
 const opts=terrain.options,pos=opts.position||[0,0,0];
 const height=(x,z,options)=>Opus.Terrain.sampleHeight(x-pos[0],z-pos[2],{...options,position:undefined})+pos[1];
 const old=structuredClone(opts),base={...opts,heightEdits:undefined};
 const segs=opts.segments,size=opts.size,deltas=[];
 // A level court gives grounded guardians and a horizontal rifle a coherent
 // combat space; the surrounding island and raised ridge remain intact.
 for(let iz=0;iz<=segs;iz++)for(let ix=0;ix<=segs;ix++){
  const x=(ix/segs-.5)*size,z=(iz/segs-.5)*size;
  const outside=Math.max(-13-x,x-14,-13-z,z-17,0),weight=Math.max(0,1-outside/2);
  const h=height(x,z,base);deltas.push(Number((-h*weight).toFixed(6)));
 }
 opts.heightEdits={segments:segs,deltas};
 for(const o of level.objects){
  if(o.kind!=='cube'||!o.position||['platform1','ramp1','relic1'].includes(o.id)||['Ridge sanctuary','Guardian objective monitor'].includes(o.name))continue;
  o.position[1]+=height(o.position[0],o.position[2],opts)-height(o.position[0],o.position[2],old);
 }
 let groveIndex=0;
 for(const o of level.objects){
  if(!/^showcase-(tree-|bush$|grass$|rock-)/.test(o.assetId||'')||o.solid||!o.position)continue;
  const [x,,z]=o.position;if(x<6.3||x>13.7||Math.abs(z)>3.8)continue;
  const nextX=15.3+(groveIndex%2)*.8,nextZ=-4.8+groveIndex*1.8;groveIndex++;
  o.position=[nextX,height(nextX,nextZ,opts),nextZ];
 }
 for(const o of level.objects.filter(o=>o.ai)){
  const main=o.id==='obj1002',radius=main?11:7;
  o.position[1]=height(o.position[0],o.position[2],opts);
  o.ai={...o.ai,mode:'stateMachine',startState:'patrol',base:[...o.position],states:[
   {name:'patrol',movement:{type:'wander',speed:.8,radius:1},animRole:'walk',entryActions:[],transitions:[{condition:{type:'distanceToPlayerAtMost',value:radius},to:'chase'}]},
   {name:'chase',movement:{type:'follow',speed:main?2.8:2.2},animRole:'run',entryActions:[],transitions:[{condition:{type:'distanceToPlayerAtMost',value:1.35},to:'attack'}]},
   {name:'attack',movement:{type:'faceTarget'},animRole:'attack',entryActions:[{action:'sound',params:{mode:'asset',audioAssetId:'showcase-attack',volume:.32}}],transitions:[{condition:{type:'distanceToPlayerAtLeast',value:1.9},to:'chase'},{condition:{type:'timeInStateAtLeast',value:1.4},to:'chase'}]}
  ]};
  delete o.ai.attackEnabled;delete o.ai.attackRadius;delete o.ai.attackCooldown;delete o.ai.attackDamage;
  // The touch volume checks all three axes, so a guardian below the ridge
  // cannot damage a player standing safely on the elevated platform.
  o.behaviors=(o.behaviors||[]).filter(b=>b.action!=='damagePlayer');
  o.behaviors.push({trigger:'stay',action:'damagePlayer',params:{amount:main?8:6,cooldown:1.4}});
 }
 const relic=level.objects.find(o=>o.id==='relic1');
 relic.behaviors=relic.behaviors.filter(b=>!['setVisibility','destroySelf','destroyObject'].includes(b.action));
 relic.behaviors.push({trigger:'enter',action:'destroyObject',params:{targetId:''}});
 for(const id of ['platform1','ramp1']){const o=level.objects.find(o=>o.id===id);o.textureAssetId='showcase-stone';o.color=[.9,.93,.86];o.uvScale=[2,2];}
 // Reach platform height before the player's radius meets its front edge.
 const ramp=level.objects.find(o=>o.id==='ramp1');ramp.position=[4.5,1.3,0];ramp.scale=[5,2.6,3];
 const kit=require('./showcase-assets');kit.install(project,{meshes:['pillar'],audio:['attack']});
 for(const [i,x,z] of [[0,8,-2],[1,12,-2],[2,8,2],[3,12,2]]){
  const id='frontier-ridge-support-'+i;if(level.objects.some(o=>o.id===id))continue;
  level.objects.push({kind:'cube',id,name:'Ridge stone support',position:[x,0,z],scale:[.85,.915,.85],rotationY:0,mesh:'asset',assetId:'showcase-pillar',textureAssetId:'showcase-palette',color:[1,1,1],solid:false,behaviors:[]});
 }
 const ex=level.objects.find(o=>o.id==='obj1004');ex.position=[0,height(0,20,opts)+1,20];ex.scale=[3,3,3];
 const arch=level.objects.find(o=>o.name==='Frontier arch');if(arch)arch.position=[0,height(0,20,opts),20];
 const makeGraph=(nodes,edges)=>({trigger:'stay',action:'graph',graph:{nodes,edges}});
 const monitor=level.objects.find(o=>o.name==='Guardian objective monitor');
 monitor.behaviors=[
  makeGraph([{id:'dead',type:'healthAtMost',target:0},{id:'lose',type:'lose'}],[{kind:'next',from:'start',to:'lose'},{kind:'gate',from:'dead',to:'lose'}]),
  makeGraph([{id:'k',type:'counterGreaterThan',counter:'kills',target:0},{id:'o',type:'objectiveIsActive',objectiveId:'obj_defeat'},{id:'both',type:'and'},{id:'gate',type:'setVisibility',targetId:'obj1003',visible:false},{id:'done',type:'completeObjective',objectiveId:'obj_defeat'}],[{kind:'cond',from:'k',to:'both'},{kind:'cond',from:'o',to:'both'},{kind:'next',from:'start',to:'gate'},{kind:'gate',from:'both',to:'gate'},{kind:'next',from:'gate',to:'done'},{kind:'gate',from:'both',to:'done'}]),
  makeGraph([{id:'i',type:'hasItem',name:'Ridge Relic',count:1},{id:'o',type:'objectiveIsActive',objectiveId:'obj_relic'},{id:'both',type:'and'},{id:'done',type:'completeObjective',objectiveId:'obj_relic'}],[{kind:'cond',from:'i',to:'both'},{kind:'cond',from:'o',to:'both'},{kind:'next',from:'start',to:'done'},{kind:'gate',from:'both',to:'done'}])
 ];
 level.objectiveDefs.find(o=>o.id==='obj_defeat').nextObjective='obj_relic';
 if(!level.objectiveDefs.some(o=>o.id==='obj_relic'))level.objectiveDefs.push({id:'obj_relic',title:'Claim the ridge relic',description:'Climb the stone ramp to the shrine.',nextObjective:'obj_extract'});
 // Objective text follows the real weapon -> guardian -> extraction chain.
 const objective=level.ui.hudElements.find(o=>o.anchor==='top-center');if(objective){objective.kind='objective';delete objective.text;}
};
if(require.main===module){
 const fs=require('fs'),vm=require('vm');const ctx={window:{},Float32Array,Uint16Array,Uint32Array,Uint8Array,DataView,ArrayBuffer,TextDecoder};vm.runInNewContext(fs.readFileSync('dist/opus-engine.js','utf8'),ctx);
 const p='games/relic-frontier.json',g=JSON.parse(fs.readFileSync(p));module.exports(g,ctx.window.Opus);fs.writeFileSync(p,JSON.stringify(g,null,2)+'\n');
 const {composeExportHTML}=require('../build/export-template');fs.writeFileSync('dist/games/relic-frontier.html',composeExportHTML({htmlTemplate:fs.readFileSync('editor/index.html','utf8'),engineJS:fs.readFileSync('dist/opus-engine.js','utf8'),editorJS:fs.readFileSync('editor/src/01-editor.js','utf8'),templateJS:fs.readFileSync('build/export-template.js','utf8'),embeddedProjectJSON:fs.readFileSync(p,'utf8'),playableOnly:true,title:'Relic Frontier'}));
 console.log('Relic Frontier court, guardian attacks, relic and exit authored and built.');
}
