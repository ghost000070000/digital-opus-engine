'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),src=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const start=src.indexOf('function captureLightPrefab('),end=src.indexOf('// Object References',start);assert(start>=0&&end>start);
const item={kind:'light',id:'torch'},history=[],c={playMode:false,placed:[item],prefabs:[],buildPrefabPayload:(item,name)=>({payload:{name,record:{kind:item.kind,id:item.id}},memberCount:1}),pushUndo:()=>history.push(JSON.stringify({prefabs:c.prefabs,source:item.sourcePrefabName})),savePrefabs(){},renderPrefabPalette(){},showStatus(){}};vm.createContext(c);vm.runInContext(src.slice(start,end),c);
for(const [owner,name]of [[null,'torch'],[{kind:'light'},'torch'],[item,''],[item,' '.repeat(3)],[item,'x'.repeat(81)]])assert(!c.captureLightPrefab(owner,name));assert.equal(history.length,0);
assert(c.captureLightPrefab(item,'  Torch  '));assert.equal(c.prefabs[0].name,'Torch');assert.equal(item.sourcePrefabName,'Torch');assert.equal(history.length,1);assert(!c.captureLightPrefab(item,'Torch'));assert.equal(history.length,1);
c.playMode=true;assert(!c.captureLightPrefab(item,'Other'));assert.equal(history.length,1);
assert(src.includes('buildPrefabPayload(item,name)'),'Use shared canonical serialization, never a parallel light format');
console.log('PASS179 actual single-Light Prefab capture canonical/no-op/history/stale/Play/name guards; native history/Save/export still mandatory.');
