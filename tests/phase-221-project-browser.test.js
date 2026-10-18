'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const at=source.indexOf('function readProjectBrowserPage('),fn=source.slice(at,source.indexOf('\n}',at)+2);
const c={normalizeProjectData:data=>{if(data.version>6)throw Error('Future version');return{levels:data.levels||[{objects:data}],prefabs:[]};},validateImportedSceneRecords:records=>{if(!Array.isArray(records))throw Error('Invalid objects');},validateImportedPrefabs:()=>{},validatePortableProjectAssetExtras:()=>{}};vm.createContext(c);vm.runInContext(fn,c);
function store(entries){const values=Object.fromEntries(entries),keys=Object.keys(values);return{length:keys.length,key:i=>keys[i],getItem:key=>values[key]??null};}
const project=JSON.stringify({savedAt:1234,data:{levels:[{objects:[]}],version:6}});
const entries=[['other:private','do not read'],['save:Zulu',project],['save:<img onerror=bad>',project],['save:corrupt','{'],['save:game',JSON.stringify({data:{health:20}})],['save:future',JSON.stringify({data:{version:7,levels:[{objects:[]}]}})]];
{const storage=store(entries),before=JSON.stringify(storage),p=c.readProjectBrowserPage(storage,'save','',0);assert.equal(p.total,5);assert.equal(p.rows.filter(r=>r.status==='project').length,2);assert.equal(p.rows.find(r=>r.name==='game').status,'other');assert.match(p.rows.find(r=>r.name==='future').detail,/Future version/);assert.equal(p.rows.find(r=>r.name==='corrupt').status,'unreadable');assert.equal(JSON.stringify(storage),before);assert.equal(p.unavailable,false);}
{const p=c.readProjectBrowserPage(store(entries),'save','ZULU',999);assert.equal(p.total,1);assert.equal(p.start,0);assert.equal(p.rows[0].name,'Zulu');}
assert.equal(c.readProjectBrowserPage({get length(){throw Error('Denied');}},'save','',0).unavailable,true);
assert.equal(c.readProjectBrowserPage(store([]),'save','',0).unavailable,false);
{let reads=0;const s=store(Array.from({length:250},(_,i)=>['save:'+String(i).padStart(3,'0'),project]));const read=s.getItem;s.getItem=key=>{reads++;return read(key);};const p=c.readProjectBrowserPage(s,'save','',10);assert.equal(p.total,200);assert.equal(p.bounded,true);assert.equal(p.rows.length,10);assert.equal(reads,10,'Only the visible page may parse saved projects');assert.equal(p.rows[0].name,'010');}
{let keys=0;const p=c.readProjectBrowserPage({length:100000,key(){keys++;return'foreign';}},'save','',0);assert.equal(keys,1000);assert.equal(p.bounded,true);}
{const huge=' '.repeat(8*1024*1024+1);const p=c.readProjectBrowserPage(store([['save:huge',huge]]),'save','',0);assert.equal(p.rows[0].status,'unreadable');assert.match(p.rows[0].detail,/Too large/);}
const ui=source.slice(source.indexOf('const projectHome='),source.indexOf("document.getElementById('load-btn').addEventListener",at));
assert(!ui.includes('innerHTML'),'Names and parse errors must be rendered as text');assert(ui.includes('event.stopPropagation()'));assert(ui.includes('openSavedProject(row.name)'));assert(ui.includes('if(playMode)'));assert(!ui.includes('localStorage.setItem'));assert(!ui.includes('.delete('));
console.log('Phase221 bounded existing-storage browser: canonical project classification, corrupt/future/other/denied/empty/search/paging, page-only reads and size/key limits, text-only UI and shared-open wiring PASS');
