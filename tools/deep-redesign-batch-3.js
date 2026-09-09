'use strict';
const fs=require('fs'),path=require('path'),kit=require('./showcase-assets');
const ROOT=path.resolve(__dirname,'..');
const designs={
  'iron-arena':[
    ['mesh','barricade',[-8,0,-2],.8,true,0],['mesh','barricade',[8,0,-2],.8,true,Math.PI],
    ['mesh','barricade',[-8,0,7],.8,true,0],['mesh','barricade',[8,0,7],.8,true,Math.PI],
    ['cube','North fighting deck',[0,.2,7],[11,.4,7],true],['mesh','support-column',[0,0,0],.8,false,0]
  ],
  'dungeon-descent':[
    ['cube','West chamber wall',[-7,1.2,-2],[.5,2.4,15],true],['cube','East chamber wall',[7,1.2,2],[.5,2.4,15],true],
    ['cube','North cross wall',[0,1.2,7],[9,2.4,.5],true],['cube','South cross wall',[0,1.2,-7],[9,2.4,.5],true],
    ['mesh','beacon-brazier',[-10,0,7],.65,false,0],['mesh','beacon-brazier',[10,0,-7],.65,false,0],['mesh','arch-pointed',[13,0,0],.75,false,Math.PI/2]
  ],
  'npc-puzzle-adventure':[
    ['cube','Village lane',[-1,.12,-4],[6,.24,18],true],['mesh','corner-wall',[-7,0,-5],1,true,0],
    ['mesh','corner-wall',[7,0,1],1,true,Math.PI],['mesh','storage-rack',[-6,0,5],.8,true,0],
    ['mesh','arch-pointed',[0,0,9],1,false,0]
  ],
  'opus-arena':[
    ['cube','West cover deck',[-7,.2,0],[5,.4,9],true],['cube','East cover deck',[7,.2,0],[5,.4,9],true],
    ['mesh','barricade',[-3,0,-6],.7,true,0],['mesh','barricade',[3,0,6],.7,true,Math.PI],
    ['mesh','ammo-crate',[-8,0,8],.8,true,0],['mesh','ammo-crate',[8,0,-8],.8,true,0]
  ]
};
let serial=0;
function add(p,l,d){const [type,key,pos,scale,solid,rotationY]=d;if(type==='mesh'){kit.install(p,{meshes:[key]});l.objects.push({kind:'cube',id:`deep3-${++serial}`,name:'Deep '+key,position:pos,scale:[scale,scale,scale],color:[1,1,1],rotationY,mesh:'asset',assetId:'showcase-'+key,textureAssetId:'showcase-palette',behaviors:[],solid});}else l.objects.push({kind:'cube',id:`deep3-${++serial}`,name:key,position:pos,scale,color:[.3,.32,.35],rotationY:0,mesh:'cube',textureAssetId:'showcase-floor-panel',behaviors:[],solid});}
for(const [id,items] of Object.entries(designs)){serial=0;const file=path.join(ROOT,'games',id+'.json'),p=JSON.parse(fs.readFileSync(file)),l=p.levels[0];l.objects=l.objects.filter(o=>!String(o.id||'').startsWith('deep3-'));p.meta={...(p.meta||{}),deepRedesignBatch:3};const hero=l.objects.find(o=>o.id==='elev-1');if(hero){hero.scale=[.45,.45,.45];hero.position=id==='iron-arena'?[0,0,0]:id==='opus-arena'?[0,0,-9]:[11,0,0];}for(const d of items)add(p,l,d);
  if(id==='dungeon-descent')l.environment={...(l.environment||{}),fogDensity:.006,skyTop:[.07,.03,.1],skyHorizon:[.22,.1,.28]};
  if(id==='npc-puzzle-adventure'){const npc=l.objects.find(o=>/sailor|npc/i.test(o.name||''));if(npc)npc.position=[-2,npc.position[1],-1];}
  if(id==='opus-arena'){l.playerSettings.maxHealth=180;l.playerSettings.weapon.damage=25;const sp=l.objects.find(o=>o.kind==='spawner');if(sp){sp.options.interval=3.8;sp.options.maxActive=2;sp.options.radius=7;}const grunt=p.prefabs.find(x=>x.name==='Grunt')?.record;if(grunt){grunt.health={max:50,current:50};grunt.ai.speed=2.15;grunt.ai.attackCooldown=1.8;grunt.ai.attackDamage=4;for(const b of grunt.behaviors||[])if(b.action==='damagePlayer'){b.params.amount=3;b.params.cooldown=1.8;}}}
  fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');console.log(id,'deep layout authored');}
