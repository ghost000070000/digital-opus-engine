'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('editor/src/01-editor.js','utf8');
const extract=name=>{const start=source.indexOf('function '+name+'(');assert(start>=0,name);return source.slice(start,source.indexOf('\nfunction ',start+10));};
const c={ACTION_TYPES:{sound:{fields:[{key:'audioAssetId',type:'audioAsset'}]},grantItem:{fields:[{key:'itemId',type:'itemDefRef'}]}},CONDITION_TYPES:{}};vm.createContext(c);
vm.runInContext(['behaviorParams','visitAuthoredActions','collectEditorReferenceUses'].map(extract).join('\n'),c);
const action=()=>({action:'sound',params:{audioAssetId:'old-audio',text:'old-audio'}});
const behavior=action(),graphNode={id:'node',type:'sound',audioAssetId:'old-audio',text:'old-audio'},prefabAction=action(),itemAction=action(),eventAction=action(),inventoryAction=action(),functionNode={id:'fn-node',type:'sound',audioAssetId:'old-audio'};
const project={levels:[{id:'level',objects:[{id:'object',kind:'sprite',behaviors:[behavior,{action:'graph',graph:{nodes:[graphNode],edges:[]}}]}]}],prefabs:[{name:'Voice',record:{id:'prefab-object',kind:'sprite',behaviors:[prefabAction]}}],itemDefs:[{id:'item',useAction:itemAction}],inventoryTemplates:[{name:'Consumable',settings:{useAction:inventoryAction}}],assets:[{id:'animated',animationEvents:[eventAction]}],graphFunctions:[{id:'function',graph:{nodes:[functionNode],edges:[]}}]};
const before=JSON.stringify(project),uses=c.collectEditorReferenceUses(project);
for(const [label,owner]of [['Behavior',behavior.params],['Graph',graphNode],['Prefab',prefabAction.params],['Item Use',itemAction.params],['Animation Event',eventAction.params],['Inventory Template',inventoryAction.params],['Graph Function',functionNode]]){
  const matches=uses.filter(use=>use.owner===owner&&use.key==='audioAssetId');assert.equal(matches.length,1,label+' typed Audio owner must be indexed exactly once');assert.equal(matches[0].referenceType,'asset');assert.deepStrictEqual(Array.from(matches[0].descriptor.allowedAssetTypes),['audio']);
}
assert.equal(JSON.stringify(project),before,'Indexing must be read-only');assert(!uses.some(use=>use.key==='text'),'Free text must never become a remap target');
assert.equal(uses.find(use=>use.owner===prefabAction.params).prefabName,'Voice');assert.equal(uses.find(use=>use.owner===functionNode).functionId,'function');assert.equal(uses.find(use=>use.owner===eventAction.params).assetId,'animated');
console.log('Phase197 actual typed Audio Action owners across Behavior/Graph/Prefab/Item/Inventory/animation/Function, dedup and no mutation/free-text scan PASS');
