'use strict';
// Read-only actual-source characterization, deliberately not a qualification gate.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0);let i=source.indexOf('(',start)+1,n=1;while(n){if(source[i]==='(')n++;if(source[i]===')')n--;i++;}i=source.indexOf('{',i)+1;n=1;while(n){if(source[i]==='{')n++;if(source[i]==='}')n--;i++;}return source.slice(start,i);}
const assets=[{id:'first',type:'skinnedMesh',skin:{clips:[{name:'Idle'},{name:'Walk'}]}},{id:'second',type:'skinnedMesh',skin:{clips:[{name:'Idle'},{name:'Attack'}]}}];
let history=0;
const c={assets,playMode:false,currentPlayerSettings:{controllerType:'thirdperson',visual:{mode:'skinned',assetId:'first',clipMap:{walk:1}}},findAssetById:id=>assets.find(a=>a.id===id),pushUndo:()=>history++,CHARACTER_ANIM_KEYWORDS:{walk:['walk']},findCharacterClip:()=>null};
vm.createContext(c);const defaultsStart=source.indexOf('const DEFAULT_PLAYER_SETTINGS ='),defaultsEnd=source.indexOf('\nfunction defaultPlayerSettings(',defaultsStart);
vm.runInContext(source.slice(defaultsStart,defaultsEnd)+'\n'+['defaultPlayerSettings','defaultPlayerVisual','playerClipMappingState','playerAuthoringValue','changePlayerAuthoringField','resolvePlayerClip'].map(extract).join('\n'),c);
c.playerVisualEntity={skin:assets[0].skin};assert.equal(c.resolvePlayerClip('walk'),1);
assert(c.changePlayerAuthoringField('visual.assetId','second'));c.playerVisualEntity={skin:assets[1].skin};const index=c.resolvePlayerClip('walk');assert.equal(index,null);assert.equal(history,1);
console.log(JSON.stringify({status:'SOURCE_REPAIR_NOT_NATIVE_QUALIFICATION',provenance:'Actual changePlayerAuthoringField and resolvePlayerClip executed; synthetic asset-local lists, not real skeletal sampling.',historicalHazard:'Walk index1 silently selected Attack at index1 after asset change.',resolvedIndex:index,retainedMap:c.currentPlayerSettings.visual.clipMap,retainedIdentity:c.currentPlayerSettings.visual.clipMapIdentity,history}));
