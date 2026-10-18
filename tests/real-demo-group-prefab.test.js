'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../editor/src/01-editor.js'),'utf8');
function definition(name){const start=source.indexOf('function '+name+'(');assert(start>=0);const end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
let counter=0;
const context=vm.createContext({placed:[],prefabs:[],collectDescendants:item=>item.children||[],serializeItemRecord:item=>({...item,children:undefined}),
  generateGroupId:()=>`fresh-group-${++counter}`,remapObjectIds:records=>{const batch=++counter;return records.map(r=>({...r,id:`fresh-${batch}-${r.id}`,position:[...r.position]}));},
  Opus:{Vec3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}}},instantiateCubeRecord:r=>({...r}),instantiateItemFromRecord:r=>({...r})});
vm.runInContext(['prefabAssemblyItems','buildPrefabPayload','instantiatePrefabAssembly','behaviorParams'].map(definition).join('\n'),context);
assert.deepStrictEqual(Object.keys(context.behaviorParams({action:'dialogueTree',param:''},undefined)),[],'special and unknown historical actions without flat definitions remain saveable');
assert.strictEqual(context.behaviorParams({param:'sound'}, {legacy:true,legacyParam:'audioAssetId'}).audioAssetId,'sound');
const authoredParams={custom:3};assert.strictEqual(context.behaviorParams({params:authoredParams}),authoredParams,'unknown authored params preserved');
const stones=Array.from({length:10},(_,i)=>({id:`stone-${i}`,kind:'cube',groupId:'original-group',position:[i,0,0],solid:true}));context.placed=stones;
const payload=context.buildPrefabPayload(stones[0],'Masonry').payload;
assert.strictEqual(payload.records.length,10,'saving one group member retains all stones');
const first=context.instantiatePrefabAssembly(payload,{x:20,y:2,z:5}),second=context.instantiatePrefabAssembly(payload,{x:40,y:3,z:6});
assert.strictEqual(new Set(first.map(r=>r.groupId)).size,1);assert.notStrictEqual(first[0].groupId,stones[0].groupId);assert.notStrictEqual(first[0].groupId,second[0].groupId);
assert(first.every(r=>r.signalPrefabInstanceId===first[0].id),'Whole placed assembly shares explicit root identity');assert.notStrictEqual(first[0].signalPrefabInstanceId,second[0].signalPrefabInstanceId,'Actual Prefab instantiation creates isolated channel ownership');assert(stones.every(r=>!r.signalPrefabInstanceId),'Ordinary original grouping is not silently a Prefab channel');
assert.deepStrictEqual(Array.from(first[9].position),[29,2,5]);assert(first.every(r=>r.solid));assert.deepStrictEqual(stones[0].position,[0,0,0]);
const child={id:'child',position:[1,2,3]},root={id:'root',children:[child]};context.placed=[root,child];
assert.strictEqual(context.buildPrefabPayload(root,'Hierarchy',[root,child]).memberCount,2,'selected descendants included once');
assert.strictEqual(context.buildPrefabPayload(child,'Single').memberCount,1,'historical single record shape preserved');
context.prefabs=[{name:'Masonry',parameters:[{id:'tint'}]}];assert.strictEqual(context.buildPrefabPayload(stones[0],'Masonry',stones).payload.parameters[0].id,'tint');
console.log('Grouped Prefabs: whole-group capture, unique placement groups, rigid offsets, descendant deduplication and historical parameters PASS');
