'use strict';
const fs=require('fs');
const path=require('path');
const kit=require('./showcase-assets');
const ROOT=path.resolve(__dirname,'..');
let serial=0;
function cube(level,name,position,scale,color,solid=false,extra={}){
  level.objects.push({kind:'cube',id:`deep5-${++serial}`,name,position,scale,color,rotationY:0,mesh:'cube',behaviors:[],solid,...extra});
}
function mesh(project,level,key,position,scale=1,name=key,solid=false,rotationY=0){
  kit.install(project,{meshes:[key]});
  cube(level,name,position,[scale,scale,scale],[1,1,1],solid,{mesh:'asset',assetId:'showcase-'+key,textureAssetId:'showcase-palette',rotationY});
}
function light(level,position,color){
  level.objects.push({kind:'light',id:`deep5-${++serial}`,name:'Route light',position,options:{lightType:'point',position,color,intensity:2.4,range:11,enabled:true}});
}
function open(id){const file=path.join(ROOT,'games',id+'.json'),project=JSON.parse(fs.readFileSync(file));for(const level of project.levels)level.objects=level.objects.filter(o=>!String(o.id||'').startsWith('deep5-'));project.meta={...(project.meta||{}),deepRedesignBatch:5};serial=0;return{file,project,level:project.levels[0]};}
function done(x){fs.writeFileSync(x.file,JSON.stringify(x.project,null,2)+'\n');console.log(path.basename(x.file),'deep layout authored');}

{
  const x=open('survival-arena-2'),l=x.level,p=x.project,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[0,0,-7];h.scale=[.42,.42,.42];}
  const legacyShard=l.objects.find(o=>o.id==='promo-1');if(legacyShard){legacyShard.position=[8,-.45,8];legacyShard.scale=[.62,.62,.62];legacyShard.solid=false;}
  for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?7:10,px=Math.cos(a)*r,pz=Math.sin(a)*r;mesh(p,l,i%2?'barricade':'cliff-spire',[px,0,pz],i%2?.7:1.1,'Storm circuit marker',i%2===1,a+Math.PI/2);light(l,[px,2.5,pz],i%2?[.5,.2,1]:[1,.25,.55]);}
  cube(l,'Storm circuit inner field',[0,.08,0],[8,.14,8],[.35,.18,.5],false,{textureAssetId:'showcase-arena-floor'});done(x);
}
{
  const x=open('survival-arena-3'),l=x.level,p=x.project,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[0,0,0];h.scale=[.42,.42,.42];}
  mesh(p,l,'machine-large',[0,0,0],1.35,'Defense transmitter',true);for(const [px,pz,r] of [[0,-8,0],[8,0,Math.PI/2],[0,8,Math.PI],[-8,0,-Math.PI/2]]){mesh(p,l,'barricade',[px,0,pz],.85,'Defense perimeter',true,r);mesh(p,l,'conduit',[px*.72,0,pz*.72],.8,'Transmitter relay');light(l,[px,2.8,pz],[.05,1,.85]);}done(x);
}
{
  const x=open('textured-adventure'),l=x.level,p=x.project,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[8,0,8];h.scale=[.42,.42,.42];}
  const biomes=[[-6,-5,'grass','tree-oak'],[5,-3,'dirt-path','arch-broken'],[-4,6,'moss-stone','ruin-wall-window'],[7,7,'clean-stone','beacon-brazier']];
  for(const [px,pz,tex,key] of biomes){cube(l,'Material biome',[px,.12,pz],[8,.24,7],[.46,.48,.42],true,{textureAssetId:'showcase-'+tex,uvScale:[2,2]});mesh(p,l,key,[px,.25,pz],.75,'Biome landmark');}done(x);
}
{
  const x=open('valley-run'),l=x.level,p=x.project,h=l.objects.find(o=>o.id==='elev-1');if(h){h.position=[8,0,20];h.scale=[.42,.42,.42];}
  const route=[[-3,-2.38,-18],[3,-2.38,-9],[-2,.76,1],[4,-3.88,11],[0,-2.35,21]];for(let i=0;i<route.length;i++){const [px,py,pz]=route[i];cube(l,'Valley route segment',[px,py,pz],[6,.08,9],[.48,.43,.26],false,{textureAssetId:'showcase-dirt-path',rotationY:i%2?.28:-.28});if(i<4)mesh(p,l,'arch-pointed',[px,py,pz],.72,'Checkpoint gate');}
  for(const [px,pz,s] of [[-10,-12,1.5],[10,-2,1.8],[-11,9,1.7],[11,18,2]])mesh(p,l,'cliff-spire',[px,0,pz],s,'Valley wall');mesh(p,l,'sanctuary-grand',[0,0,25],1.3,'Ridge destination');done(x);
}
