'use strict';
const fs=require('fs');
const path=require('path');
const kit=require('./showcase-assets');
const ROOT=path.resolve(__dirname,'..');
let serial=0;
function open(id){const file=path.join(ROOT,'games',id+'.json'),project=JSON.parse(fs.readFileSync(file));for(const l of project.levels)l.objects=l.objects.filter(o=>!String(o.id||'').startsWith('deep7-'));project.meta={...(project.meta||{}),deepRedesignBatch:7};serial=0;return{file,project,level:project.levels[0]};}
function cube(l,name,position,scale,color=[.3,.34,.38],solid=false,extra={}){l.objects.push({kind:'cube',id:`deep7-${++serial}`,name,position,scale,color,rotationY:0,mesh:'cube',behaviors:[],solid,...extra});}
function mesh(p,l,key,position,scale=1,name=key,solid=false,rotationY=0){kit.install(p,{meshes:[key]});cube(l,name,position,[scale,scale,scale],[1,1,1],solid,{mesh:'asset',assetId:'showcase-'+key,textureAssetId:'showcase-palette',rotationY});}
function light(l,position,color){l.objects.push({kind:'light',id:`deep7-${++serial}`,name:'Destination light',position,options:{lightType:'point',position,color,intensity:2.6,range:12,enabled:true}});}
function done(x){fs.writeFileSync(x.file,JSON.stringify(x.project,null,2)+'\n');console.log(path.basename(x.file),'deep layout authored');}
{
 const x=open('shifting-facility');const p=x.project,l=x.level;
 cube(l,'Fixed architecture wing',[-8,.2,0],[12,.4,14],[.24,.3,.34],true,{textureAssetId:'showcase-floor-panel'});
 cube(l,'Shift architecture wing',[8,.45,0],[12,.9,14],[.18,.38,.4],true,{textureAssetId:'showcase-emissive-strip'});
 mesh(p,l,'storage-rack',[-8,0,5],1,'Fixed-state focal',true);
 mesh(p,l,'machine-large',[8,0,5],1,'Shift-state focal',true);
 mesh(p,l,'doorway-frame',[-4,0,0],.8,'Fixed threshold',false,Math.PI/2);
 mesh(p,l,'doorway-frame',[4,0,0],.8,'Shift threshold',false,Math.PI/2);
 light(l,[-8,3,5],[.2,.55,1]);light(l,[8,3,5],[.05,1,.75]);done(x);
}
{
 const x=open('skyway-trial');const p=x.project,l=x.level,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[0,7,30];h.scale=[.5,.5,.5];}
 const shapes=[[5.4,4.4],[4.5,5.2],[6,3.8],[4.4,5.6],[6.2,4.6]];
 for(let i=1;i<=5;i++){const o=l.objects.find(o=>o.name==='Platform'+i);if(o){o.scale[0]=shapes[i-1][0];o.scale[2]=shapes[i-1][1];}mesh(p,l,i%2?'railing':'stone-walkway',[i%2?2.1:-2.1,i-.5,i*5+3],.55,'Skyway silhouette');}
 mesh(p,l,'arch-pointed',[0,5,29],1,'Visible summit gate');light(l,[0,9,29],[.2,.8,1]);done(x);
}
{
 const x=open('survival-arena');const p=x.project,l=x.level,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[0,0,9];h.scale=[.4,.4,.4];}
 const manager=l.objects.find(o=>o.kind==='gameManager'||o.name==='GameManager');
 if(manager?.counters?.health)manager.counters.health=5;
 for(const hunter of l.objects.filter(o=>o.name==='Hunter')){
  if(hunter.ai)hunter.ai.speed=1.65;
  if(hunter.collider)hunter.collider.radius=.44;
  for(const behavior of hunter.behaviors||[]){
   const graph=behavior.graph;
   if(!graph)continue;
   graph.edges=(graph.edges||[]).filter(edge=>!(edge.from==='n2'&&edge.to==='n3'&&edge.kind==='next'));
   if(!graph.edges.some(edge=>edge.from==='n2'&&edge.to==='n4'))graph.edges.push({from:'n2',to:'n4',kind:'next'});
  }
 }
 const orbs=l.objects.filter(o=>o.name==='Orb'),sites=[[0,.5,-6],[6,.5,0],[0,.5,6],[-6,.5,0]],forms=['arch-broken','cliff-spire','beacon-brazier','ruin-wall-window'];
 for(let i=0;i<orbs.length;i++){orbs[i].position=sites[i];orbs[i].scale=[1,1,1];const [px,,pz]=sites[i];mesh(p,l,forms[i],[px,0,pz],.75,'Relic site '+(i+1));light(l,[px,3,pz],[[.2,.8,1],[1,.4,.1],[.2,1,.5],[.7,.2,1]][i]);}
 cube(l,'North-south route',[0,.08,0],[3,.12,15],[.4,.36,.24],false,{textureAssetId:'showcase-arena-floor'});cube(l,'East-west route',[0,.09,0],[15,.12,3],[.4,.36,.24],false,{textureAssetId:'showcase-arena-floor'});done(x);
}
{
 const x=open('temple-switch-puzzle');const p=x.project,l=x.level,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[0,0,12];h.scale=[.45,.45,.45];}
 cube(l,'West switch room',[-10,.15,-6],[9,.3,9],[.34,.31,.28],true,{textureAssetId:'showcase-worn-stone'});cube(l,'East switch room',[10,.15,-6],[9,.3,9],[.28,.33,.36],true,{textureAssetId:'showcase-clean-stone'});
 for(const [px,c] of [[-10,[1,.45,.08]],[10,[.1,.7,1]]]){mesh(p,l,'ruin-wall-window',[px,0,-6],.8,'Unique switch shrine');mesh(p,l,'arch-pointed',[px,0,-1],.72,'Switch room threshold');light(l,[px,3,-6],c);}
 mesh(p,l,'blast-door',[0,0,5],1.05,'Central sealed gate');mesh(p,l,'sanctuary-grand',[0,.2,12],1.25,'Shrine beyond');light(l,[0,6,12],[1,.65,.12]);if(l.ui?.objective)l.ui.objective.text='Awaken the west and east seals, then pass the central gate.';done(x);
}
