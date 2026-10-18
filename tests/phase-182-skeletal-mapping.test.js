'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const match=source.match(/document\.getElementById\('f-animation-clip'\)\.onchange = \(e\) => \{([\s\S]*?)\n\s*\};/);assert(match,'actual Inspector clip handler');
const entity={skin:{clips:[{name:'Idle'},{name:'Walk'}]},animationClip:0},item={kind:'cube',entity};
let undos=0;const c={entity,clipOwner:item,selectedItem:item,placed:[item],playMode:false,pushUndo:()=>undos++,showStatus(){}};vm.createContext(c);
if(source.includes('function changeSkeletalInstanceClip(')){const start=source.indexOf('function changeSkeletalInstanceClip(');let i=source.indexOf('{',start)+1,n=1;while(n){if(source[i]==='{')n++;if(source[i]==='}')n--;i++;}vm.runInContext(source.slice(start,i),c);}
vm.runInContext('function actualHandler(e){'+match[1]+'}',c);const choose=value=>c.actualHandler({target:{value}});
choose('0');assert.equal(undos,0,'same skeletal clip must not create history');c.playMode=true;choose('1');assert.equal(entity.animationClip,0,'Play clip picker must not author');assert.equal(undos,0);c.playMode=false;choose('999');assert.equal(entity.animationClip,0,'missing clip must not replace saved mapping');assert.equal(undos,0);choose('1');assert.equal(entity.animationClip,1);assert.equal(undos,1);choose('');assert.equal(entity.animationClip,null);assert.equal(undos,2);c.placed=[];choose('0');assert.equal(entity.animationClip,null,'stale owner refused');assert.equal(undos,2);
console.log('PASS182 actual skeletal Inspector clip handler refuses no-op/Play/invalid/stale and records changed valid/bind-pose selections once');
const other={kind:'cube',entity:{skin:entity.skin,animationClip:1}};c.placed=[item,other];c.selectedItem=other;choose('0');assert.equal(entity.animationClip,null);assert.equal(other.entity.animationClip,1);assert.equal(undos,2,'retained old handler cannot author a newly selected owner');
// Execute the actual duplication transaction; thin host stubs do not copy clips.
{
 const start=source.indexOf('function duplicateSelected(');let i=source.indexOf('{',start)+1,n=1;while(n){if(source[i]==='{')n++;if(source[i]==='}')n--;i++;}
 class V{constructor(x,y,z){Object.assign(this,{x,y,z});}clone(){return new V(this.x,this.y,this.z);}}
 for(const clip of [1,null,999]){
  const skin={clips:[{name:'Idle'},{name:'Walk'}]},src={kind:'cube',id:'source',assetId:'ranger',entity:{mesh:{skin},skin,animationClip:clip,animationBlendTime:.75,color:[1,1,1],position:new V(0,0,0),scale:new V(1,1,1),rotationY:0}};
  let added;const d={selectedItems:new Set([src]),selectedItem:src,Opus:{Vec3:V,normalizeSpritePassRelation:()=> 'behind-sprites'},app:{addEntity:opts=>({...opts,skin:opts.mesh.skin,animationClip:0})},cloneBehaviors:()=>[],pushUndo(){},generateGroupId:()=> 'group',generateItemId:()=> 'id',OpusAuthoring:{copyComponents(){}},OpusAiBrain:{inspect:()=>({ok:false})},hierarchyTickToken:0,addPlaced:x=>{added=x;},updateHierarchyTransforms(){},syncSelectionMarkers(){},renderInspector(){},renderSceneList(){}};
  vm.createContext(d);vm.runInContext(source.slice(start,i),d);d.duplicateSelected();assert.equal(added.entity.animationClip,clip,'actual duplicate preserves manual valid/null/missing clip');assert.equal(added.entity.animationBlendTime,.75);added.entity.animationBlendTime=0;assert.equal(src.entity.animationBlendTime,.75,'duplicate blend config is independent');added.entity.animationClip=0;assert.equal(src.entity.animationClip,clip,'duplicate clip state is independent');
 }
 console.log('PASS182 actual duplicateSelected preserves valid/bind-pose/unavailable manual selection with independent instance state');
}
