'use strict';
const fs=require('fs'),path=require('path'),kit=require('./showcase-assets');
const ROOT=path.resolve(__dirname,'..');let serial=0;
function open(id){const file=path.join(ROOT,'games',id+'.json'),project=JSON.parse(fs.readFileSync(file));for(const l of project.levels)l.objects=l.objects.filter(o=>!String(o.id||'').startsWith('deep6-'));project.meta={...(project.meta||{}),deepRedesignBatch:6};serial=0;return{file,project,level:project.levels[0]};}
function cube(l,name,position,scale,color,solid=false,extra={}){l.objects.push({kind:'cube',id:`deep6-${++serial}`,name,position,scale,color,rotationY:0,mesh:'cube',behaviors:[],solid,...extra});}
function mesh(p,l,key,position,scale=1,name=key,solid=false,rotationY=0){kit.install(p,{meshes:[key]});cube(l,name,position,[scale,scale,scale],[1,1,1],solid,{mesh:'asset',assetId:'showcase-'+key,textureAssetId:'showcase-palette',rotationY});}
function light(l,position,color,intensity=2.4){l.objects.push({kind:'light',id:`deep6-${++serial}`,name:'Deep light',position,options:{lightType:'point',position,color,intensity,range:12,enabled:true}});}
function done(x){fs.writeFileSync(x.file,JSON.stringify(x.project,null,2)+'\n');console.log(path.basename(x.file),'deep layout authored');}
{
 const x=open('painted-wilds'),p=x.project,l=x.level,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[8,0,6];h.scale=[.4,.4,.4];}
 const zones=[[-6,-5,'grass',[.2,.48,.25],['tree-oak','tree-birch']],[5,0,'dirt-path',[.55,.31,.2],['cliff-spire','rock-3']],[-4,8,'foliage',[.35,.18,.45],['tree-dead','rock-5']]];
 for(const [px,pz,tex,color,forms] of zones){cube(l,'Painted biome',[px,.1,pz],[9,.2,8],color,true,{textureAssetId:'showcase-'+tex});for(let i=0;i<forms.length;i++)mesh(p,l,forms[i],[px+(i?2:-2),.2,pz+(i?1:-1)],.9,'Biome silhouette');}
 done(x);
}
{
 const x=open('blacksite'),p=x.project,l=x.level,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[0,0,11];h.scale=[.4,.4,.4];}
 for(const [i,level] of p.levels.entries()){const z=i?2:8;mesh(p,level,'doorway-frame',[0,0,z],1,i?'Core threshold':'Site entry',false,0);cube(level,i?'Core chamber floor':'Entry court',[0,.12,z],[14,.24,10],i?[.18,.1,.22]:[.18,.24,.28],true,{textureAssetId:i?'showcase-terminal-surface':'showcase-floor-panel'});for(const side of [-1,1])mesh(p,level,i?'computer-bank':'corner-wall',[side*6,0,z],.9,i?'Core bank':'Entry wing',true,side<0?0:Math.PI);light(level,[0,3,z],i?[.7,.1,1]:[.1,.7,1]);}
 done(x);
}
{
 const x=open('moving-temple'),p=x.project,l=x.level,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[20,6,0];h.scale=[.38,.38,.38];}
 for(const o of l.objects.filter(o=>/sanctuary|shrine|silhouette/i.test(o.name||''))){if(o.scale)o.scale=o.scale.map(v=>Math.min(v,.95));}
 cube(l,'Lower temple court',[0,.2,0],[9,.4,12],[.38,.34,.31],true,{textureAssetId:'showcase-worn-stone'});cube(l,'Upper temple terrace',[20,6.2,0],[12,.4,12],[.42,.36,.32],true,{textureAssetId:'showcase-clean-stone'});
 for(const [px,pz] of [[-5,-6],[-5,6],[5,-6],[5,6],[15,-6],[15,6],[25,-6],[25,6]])mesh(p,l,'pillar',[px,0,pz],px<10?1.1:1.5,'Temple massing pier');mesh(p,l,'sanctuary-grand',[22,6.4,0],1.1,'Earned summit shrine');light(l,[22,11,0],[1,.45,.12],2.8);done(x);
}
{
 const x=open('assembly-line'),p=x.project,l=x.level,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[0,0,11];h.scale=[.4,.4,.4];}
 const stages=[[-10,'Fabrication','machine-large',[1,.4,.08]],[0,'Transfer','storage-rack',[.1,.65,1]],[10,'Inspection','computer-bank',[.1,1,.5]]];
 for(const [px,name,key,color] of stages){cube(l,name+' bay',[px,.15,0],[8,.3,12],[.28,.3,.31],true,{textureAssetId:'showcase-floor-panel'});mesh(p,l,key,[px,.3,0],1.05,name+' focal',true);mesh(p,l,'doorway-frame',[px-4,0,0],.8,name+' threshold',false,Math.PI/2);light(l,[px,3,0],color);}
 done(x);
}
