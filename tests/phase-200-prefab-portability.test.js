'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('editor/src/01-editor.js','utf8');
const prefabs=[{name:'Used',record:{kind:'cube',opaque:{values:[1]}}},{name:'Unplaced imported',record:{kind:'cube',opaque:{values:[2]}}}];
const context={prefabs,deps:{prefabs:new Set(['Used'])},includeTilesetAuthoring:true};vm.createContext(context);
const start=source.indexOf('function serializeProjectPrefabLibrary(');if(start>=0){const end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),context);}
const assignment=source.match(/const bundledPrefabs = ([^;]+);/);assert(assignment,'Actual serializer Prefab selection must remain observable');
const before=JSON.stringify(prefabs),read=()=>JSON.parse(vm.runInContext('JSON.stringify('+assignment[1]+')',context));
assert.deepStrictEqual(read(),prefabs,'Save and Editable must retain unplaced imported Prefab definitions');
context.includeTilesetAuthoring=false;assert.deepStrictEqual(read(),[prefabs[0]],'Playable retains used-only Prefab contract');
context.deps.prefabs.add('Unplaced imported');assert.deepStrictEqual(read(),prefabs,'Playable includes referenced imported Prefab');
context.includeTilesetAuthoring=true;vm.runInContext('var detached='+assignment[1]+'; detached[1].record.opaque.values.push(9)',context);assert.equal(JSON.stringify(prefabs),before,'Portable Prefab output must not alias live definitions');
console.log('PASS200 actual serializer Prefab selection: Save/Editable unplaced import retained, Playable used-only, complete opaque metadata and detached output');
