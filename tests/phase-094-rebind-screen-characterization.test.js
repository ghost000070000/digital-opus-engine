'use strict';
// Actual settings/editor functions, controlled local storage. Not browser proof.
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);let cursor=source.indexOf('(',start)+1,p=1;while(p){if(source[cursor]==='(')p++;if(source[cursor]===')')p--;cursor++;}const brace=source.indexOf('{',cursor);let depth=1,end=brace+1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(start,end);}
const storage=new Map(),context={localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},playerInputOverrides:{},projectMeta:{id:'project-A'}};
vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../engine/src/15-settings'),'utf8')+'\nglobalThis.ActualSettings=SettingsManager;',context);
// Retained exact pre-repair functions observed in command6790b2. Never replace
// current product backwards; permanent current-source gates live in authoring test.
vm.runInContext("function loadPlayerInputOverrides(){playerInputOverrides=app.settings.get('inputOverrides')||{};} function savePlayerInputOverrides(){app.settings.set('inputOverrides',playerInputOverrides);}",context);
// Exact app namespace selected by the editor/API today, not two invented keys.
assert(source.match(/Opus\.create\(canvas, \{[^\n]+/)[0].includes('defaultSettings'));
const api=fs.readFileSync(require.resolve('../engine/src/22-api'),'utf8');assert(api.includes("config.settingsNamespace ?? 'doengine:settings'"));
context.app={settings:new context.ActualSettings()};context.playerInputOverrides={interact:'KeyZ','input-action-1':'KeyP'};context.savePlayerInputOverrides();
context.projectMeta={id:'project-B'};context.app={settings:new context.ActualSettings()};context.playerInputOverrides={};context.loadPlayerInputOverrides();
const crossProjectInherited=context.playerInputOverrides.interact==='KeyZ'&&context.playerInputOverrides['input-action-1']==='KeyP';
const observed={provenance:'Retained pre-repair editor load/save function variant plus actual SettingsManager; original actual-source RED6790b2 preserved',crossProjectInherited,storedKeys:[...storage.keys()]};
console.log(JSON.stringify(observed,null,2));
if(process.argv.includes('--observe-red'))process.exit(0);
assert(crossProjectInherited,'Retained historical variant must reproduce the proven original leakage');
