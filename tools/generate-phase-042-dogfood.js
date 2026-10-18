'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const box = (offset=[0,0],size=[1,1],enabled=true) => ({version:1,enabled,offset,size});
const circle = (offset=[0,0],radius=.5,enabled=true) => ({version:1,enabled,offset,radius});
const trigger = (shape='box',offset=[0,0],size=[2,2],radius=1,enabled=true) => ({version:1,enabled,shape,offset,size,radius});
const cube = (id,name,x,y,components={},behaviors=[],extra={}) => ({kind:'cube',id,name,position:[x,y,0],scale:[1,1,1],color:[.12,.74,.68],rotationY:0,behaviors,spin:0,patrol:null,ai:null,mesh:'cube',spritePassRelation:'behind-sprites',components,...extra});
const eventBehaviors = [
  {trigger:'trigger2DEnter',action:'message',params:{text:'Trigger Enter'}},
  {trigger:'trigger2DStay',action:'message',params:{text:'Trigger Stay'}},
  {trigger:'trigger2DExit',action:'message',params:{text:'Trigger Exit'}},
];
const objects = [
  {kind:'camera',id:'cam-2d',name:'Trigger Lab Camera',isActiveCamera:true,options:{version:2,position:[0,0,10],mode:'fixed',projection:'orthographic',fovDegrees:45,orthographicHeight:14,near:.1,far:100,rotationDegrees:{x:0,y:0,z:0},chase:{distance:8,height:3,pitch:.2,lerpSpeed:6,rotationLerpSpeed:8,lookAhead:.5},lookAtTargetId:null}},
  cube('trigger-box','Box Trigger — Lifecycle',-3,2,{'trigger-collider-2d':trigger('box',[0,0],[3,2],1)},eventBehaviors),
  cube('target-box','Box Target — Move Through',3,2,{'box-collider-2d':box([0,0],[1.4,1.4])}),
  cube('target-circle','Circle Target — Move Through',0,-4,{'circle-collider-2d':circle([0,0],.75)}),
  cube('trigger-circle','Circle Trigger — Parent/Scale',-3,-2,{'trigger-collider-2d':trigger('circle',[.2,0],[2,2],1.25)},eventBehaviors),
  cube('target-both','Dual Collider Target — One Pair',3,-2,{'box-collider-2d':box([0,0],[1.2,1.2]),'circle-collider-2d':circle([.2,0],.7)}),
  cube('self-proof','Trigger + Collider — Self Ignored',0,0,{'trigger-collider-2d':trigger(),'box-collider-2d':box()}),
  cube('trigger-only-target','Trigger Only — Never Target',0,4,{'trigger-collider-2d':trigger('circle')},eventBehaviors),
  cube('disabled-target','Disabled Ordinary Collider',4,4,{'circle-collider-2d':circle([0,0],.7,false)}),
  cube('parent','Moving Parent',-5,-4,{}),
  cube('parented-trigger','Parented Trigger',-5,-4,{'trigger-collider-2d':trigger('box',[.3,0],[2.5,1.2],.8)},eventBehaviors),
];
Object.assign(objects.find((object)=>object.id==='parented-trigger'),{parentId:'parent',localPosition:[1,.5,0],localQuat:[0,0,.2164396,.976296],localScale:[1,1,1]});
const project={format:'digital-opus-project',version:7,levels:[{id:'phase-042-level',name:'Phase 042 Trigger Lifecycle Lab',objects}],currentLevelId:'phase-042-level',world:{environment:{},playerSettings:{controllerType:'none',equipmentDefs:[]},ui:{hudElements:[],startScreen:{enabled:false,title:'',subtitle:'',buttonText:'Start',howToPlay:'',credits:'',controlsHint:''},winTitle:'',winMessage:'',loseTitle:'',loseMessage:''},description:'Internal Phase 042 Trigger Collider 2D lifecycle qualification.',ambientAudio:{audioAssetId:null,volume:1,loop:true}},prefabs:[{name:'Phase 042 Trigger Pair Prefab',record:cube('prefab-trigger-source','Prefab Trigger Source',0,0,{'trigger-collider-2d':trigger('circle',[.1,-.1],[2,2],.9),'box-collider-2d':box([0,0],[1,1])},eventBehaviors),parameters:[]}],assets:[],textures:[],spriteAssets:[],spriteSortingLayers:[{id:'world',name:'World',order:0}],parallaxLayers:[],spriteAnimations:[],tilesets:[],tilemapChunks:[],audio:[],meta:{title:'Phase 042 Trigger Lifecycle Lab',internalOnly:true},inputActionMap:{},itemDefs:[]};
const evidence={phase:42,status:'READY_FOR_BROWSER_QUALIFICATION',project:'qualification/phase-042/phase-042-project.json',lab:'Phase 042 Trigger Lifecycle Lab',objects:{triggerBox:'trigger-box',targetBox:'target-box',targetCircle:'target-circle',triggerCircle:'trigger-circle',dualColliderTarget:'target-both',selfIgnored:'self-proof',triggerOnlyNotTarget:'trigger-only-target',disabledTarget:'disabled-target',parentedTrigger:'parented-trigger'},prefab:'Phase 042 Trigger Pair Prefab',eventSequence:['trigger2DEnter','trigger2DStay','trigger2DExit','trigger2DEnter'],publicCatalog:false};
const out=path.join(ROOT,'qualification','phase-042');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'phase-042-project.json'),JSON.stringify(project,null,2)+'\n');fs.writeFileSync(path.join(ROOT,'phase-042-dogfood.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Phase 042 dogfood fixture generated');
