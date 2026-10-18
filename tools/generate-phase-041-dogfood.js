'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const box = (offset=[0,0],size=[1,1],enabled=true) => ({ version:1, enabled, offset, size });
const circle = (offset=[0,0],radius=.5,enabled=true) => ({ version:1, enabled, offset, radius });
const spriteRenderer = (width,height,pivotX=.5,pivotY=.5) => ({ version:9,visible:true,spriteAssetRef:'phase-041-sprite',sourceTexture:null,width,height,pivotX,pivotY,tint:'#ffffff',opacity:1,sortingLayerRef:'world',orderInLayer:0,renderMode:'simple',flipX:false,flipY:false,animationStates:[],initialAnimationStateRef:null,initialDirection:'none',playOnStart:false,parallaxLayerRef:null });
const sprite = (id,name,x,y,width,height,components={}) => ({ kind:'sprite',id,name,position:[x,y,0],scale:[1,1,1],rotationY:0,behaviors:[],components:{'sprite-renderer':spriteRenderer(width,height),...components} });
const cube = (id,name,x,y,components={},extra={}) => ({ kind:'cube',id,name,position:[x,y,0],scale:[1,1,1],color:[.15,.75,.7],rotationY:0,behaviors:[],spin:0,patrol:null,ai:null,mesh:'cube',spritePassRelation:'behind-sprites',components,...extra });
const qz = (degrees) => { const a=degrees*Math.PI/360; return [0,0,Math.sin(a),Math.cos(a)]; };
const objects = [
  { kind:'camera',id:'cam-2d',name:'Collider 2D Camera',isActiveCamera:true,options:{version:2,position:[0,0,10],mode:'fixed',projection:'orthographic',fovDegrees:45,orthographicHeight:14,near:.1,far:100,rotationDegrees:{x:0,y:0,z:0},chase:{distance:8,height:3,pitch:.2,lerpSpeed:6,rotationLerpSpeed:8,lookAhead:.5},lookAtTargetId:null} },
  sprite('box-sprite','Box Sprite — fit then resize',-4,3,2.4,1.5,{'box-collider-2d':box([0,0],[2.4,1.5])}),
  sprite('circle-sprite','Circle Sprite — inscribed fit',0,3,2,2,{'circle-collider-2d':circle([0,0],1)}),
  cube('invisible-box','Invisible Collider',4,3,{'box-collider-2d':box([0,0],[2,1])},{alpha:0}),
  cube('both-colliders','Both Collider Types',-4,0,{'box-collider-2d':box([-.15,0],[2.2,1.2]),'circle-collider-2d':circle([.55,0],.7)}),
  cube('rotated-box','Rotated Box',0,0,{'box-collider-2d':box([.2,0],[2.6,.8])},{quaternion:qz(32)}),
  cube('parent','Parent Transform',3,-.2,{}, {quaternion:qz(-18),scale:[1.5,.8,1]}),
  sprite('parented-sprite','Parented Circle Sprite',4.1,.3,1.6,1.2,{'circle-collider-2d':circle([0,0],.6)}),
  sprite('nonuniform-circle','Nonuniform Circle Warning',-3,-3,1.4,1.4,{'circle-collider-2d':circle([0,0],.7)}),
  cube('mirrored-box','Mirrored Box',0,-3,{'box-collider-2d':box([.25,0],[1.8,1])},{scale:[-1.5,1,1]}),
  cube('touching-a','Box/Circle Touching A',3,-3,{'box-collider-2d':box([0,0],[1,1])}),
  cube('touching-b','Box/Circle Touching B',4,-3,{'circle-collider-2d':circle([0,0],.5)}),
  cube('box-separated-a','Box/Box Separated A',7,3,{'box-collider-2d':box()}),
  cube('box-separated-b','Box/Box Separated B',9,3,{'box-collider-2d':box()}),
  cube('box-touch-a','Box/Box Touching A',7,1,{'box-collider-2d':box()}),
  cube('box-touch-b','Box/Box Touching B',8,1,{'box-collider-2d':box()}),
  cube('box-overlap-a','Box/Box Overlap A',7,-1,{'box-collider-2d':box()}),
  cube('box-overlap-b','Box/Box Overlap B',7.7,-1,{'box-collider-2d':box()}),
  cube('rotated-overlap-a','Rotated Box/Box A',7,-3,{'box-collider-2d':box([0,0],[1.5,.8])},{quaternion:qz(30)}),
  cube('rotated-overlap-b','Rotated Box/Box B',7.6,-3,{'box-collider-2d':box()}),
  cube('circle-overlap-a','Circle/Circle A',10,1,{'circle-collider-2d':circle()}),
  cube('circle-overlap-b','Circle/Circle B',10.7,1,{'circle-collider-2d':circle()}),
  cube('circle-box-a','Circle/Rotated Box Circle',10,-2,{'circle-collider-2d':circle([0,0],.7)}),
  cube('circle-box-b','Circle/Rotated Box Box',10.7,-2,{'box-collider-2d':box([0,0],[1.4,.6])},{quaternion:qz(40)})
];
const child=objects.find(o=>o.id==='parented-sprite'); Object.assign(child,{parentId:'parent',localPosition:[.75,.4,0],localQuat:qz(12),localScale:[1,1,1]});
objects.find(o=>o.id==='nonuniform-circle').scale=[2,.65,1];
const textureSvg='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="#0b2531"/><circle cx="32" cy="32" r="22" fill="#19c5bd"/><path d="M18 34h28M32 18v28" stroke="#ffe0aa" stroke-width="5"/></svg>';
const project={format:'digital-opus-project',version:7,levels:[{id:'phase-041-level',name:'Collider Shape Lab',objects}],currentLevelId:'phase-041-level',world:{environment:{},playerSettings:{controllerType:'none',equipmentDefs:[]},ui:{hudElements:[],startScreen:{enabled:false,title:'',subtitle:'',buttonText:'Start',howToPlay:'',credits:'',controlsHint:''},winTitle:'',winMessage:'',loseTitle:'',loseMessage:''},description:'Internal Phase 041 passive 2D collider qualification.',ambientAudio:{audioAssetId:null,volume:1,loop:true}},prefabs:[{name:'Phase 041 Collider Prefab',record:cube('prefab-source','Collider Prefab Source',0,0,{'box-collider-2d':box([.2,-.1],[1.7,.9]),'circle-collider-2d':circle([-.35,.15],.4)}),parameters:[]}],assets:[],textures:[{id:'phase-041-texture',name:'Collider Dogfood Sprite',dataURL:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(textureSvg)}`,sourceFilename:'phase-041-collider.svg',width:64,height:64}],spriteAssets:[{id:'phase-041-sprite',type:'sprite',name:'Collider Dogfood Sprite',version:4,sourceTexture:'phase-041-texture',sourceRect:{x:0,y:0,width:64,height:64},nineSlice:{left:0,right:0,top:0,bottom:0},pivot:[.5,.5],pixelsPerUnit:32,filtering:'nearest'}],spriteSortingLayers:[{id:'world',name:'World',order:0}],parallaxLayers:[],spriteAnimations:[],tilesets:[],tilemapChunks:[],audio:[],meta:{title:'Phase 041 Collider Shape Lab',internalOnly:true},inputActionMap:{},itemDefs:[]};
const evidence={phase:41,status:'READY_FOR_BROWSER_QUALIFICATION',project:'qualification/phase-041/phase-041-project.json',objects:{total:objects.length-1,boxSprite:'box-sprite',circleSprite:'circle-sprite',invisible:'invisible-box',both:'both-colliders',rotated:'rotated-box',parented:'parented-sprite',nonuniform:'nonuniform-circle',mirrored:'mirrored-box',overlapCases:{boxSeparated:['box-separated-a','box-separated-b'],boxTouching:['box-touch-a','box-touch-b'],boxOverlapping:['box-overlap-a','box-overlap-b'],rotatedBox:['rotated-overlap-a','rotated-overlap-b'],circleCircle:['circle-overlap-a','circle-overlap-b'],circleRotatedBox:['circle-box-a','circle-box-b'],boxCircleTouching:['touching-a','touching-b']}},prefab:'Phase 041 Collider Prefab',publicCatalog:false};
fs.mkdirSync(path.join(ROOT,'qualification','phase-041'),{recursive:true});fs.writeFileSync(path.join(ROOT,'qualification','phase-041','phase-041-project.json'),JSON.stringify(project,null,2)+'\n');fs.writeFileSync(path.join(ROOT,'phase-041-dogfood.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Phase 041 dogfood fixture generated');
