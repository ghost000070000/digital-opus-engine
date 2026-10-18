'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../editor/src/01-editor.js'),'utf8');
function fn(name){const at=source.indexOf('function '+name+'(');assert(at>=0);return source.slice(at,source.indexOf('\n}',at)+2);}
function action(name){const at=source.indexOf('  '+name+': {');assert(at>=0);return source.slice(at,source.indexOf('\n  },',at)+4).trim().replace(name+':','this.'+name+'=');}
const c={window:{__gameInventory:{coin:5,potion:1}},currentItemDefs:[{id:'coin',name:'Copper Coin',maxStack:99},{id:'potion',name:'Health Potion',stackable:false}]};
vm.createContext(c);vm.runInContext(['namedInventoryItemSelection','grantInventoryItem','runGraphActionNode'].map(fn).join('\n')+'\n'+['giveItem','grantItem','removeNamedItem'].map(action).join(';\n')+';ACTION_TYPES={giveItem,grantItem,removeNamedItem};',c);
c.executeAction=(type,node,item)=>c.ACTION_TYPES[type].exec(node,item);
const before=JSON.parse(JSON.stringify(c.window.__gameInventory));
const eligible=!!c.namedInventoryItemSelection('coin',2);
if(eligible){c.runGraphActionNode({type:'grantItem',itemId:'potion',count:1},null,{edges:[]},{});c.runGraphActionNode({type:'removeNamedItem',itemId:'coin',count:2},null,{edges:[]},{});}
const after=JSON.parse(JSON.stringify(c.window.__gameInventory));
assert.equal(before.coin,5);assert.equal(after.potion,1);assert.equal(after.coin,3);
console.log(JSON.stringify({status:'REPRODUCED_UNSAFE_COMPOSED_PURCHASE',observedAt:new Date().toISOString(),sourceFingerprint:require('../tools/real-demo-program-state').fingerprint(),before,after,eligible,capacityRefusedButCharged:after.coin===3&&after.potion===1,scope:'Actual extracted host Actions and runGraphActionNode; not native gameplay; historical generic Graph sequencing preserved'}));

