'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),src=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function mounted(){
  const elements=new Map(),messages=[],downloads=[],state={assets:[]};let selections=[{collection:'tilemapChunks',id:'private'}];
  const c={playMode:false,prefabs:[{name:'Prefab <✓>'}],levels:[{id:'level'}],currentLevelIndex:0,undoStack:[],redoStack:[],
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{style:{display:'none'},textContent:''});return elements.get(id);}},
    captureAssetReplacementState:()=>({project:JSON.parse(JSON.stringify(state))}),showStatus:s=>messages.push(s),
    selectedAssetPackRoots:()=>selections,tilemapBundleProjectView:()=>({}),downloadTextFile:(...args)=>downloads.push(args),
    OpusTilemapBundle:{createAssetPack:async()=>({pack:{content:{dependencies:{}}},text:'canonical',extension:'.opus-assets.json',sha256:'hash',summary:{selected:1,blobs:0}})}};
  vm.createContext(c);
  vm.runInContext(src.slice(src.indexOf('let pendingTilemapBundleAction = null;'),src.indexOf('function tilemapBundleProjectView(')),c);
  vm.runInContext(src.slice(src.indexOf('function closeTilemapBundleModal('),src.indexOf('async function previewTilemapBundleExport(')),c);
  vm.runInContext(src.slice(src.indexOf('const assetPackFamilyLabels ='),src.indexOf('function selectedAssetPackRoots(')),c);
  vm.runInContext(src.slice(src.indexOf('async function previewAssetPackExport('),src.indexOf('function planTilemapBundleImport(')),c);
  vm.runInContext(src.slice(src.indexOf('function projectHasScripts('),src.indexOf('function loadProjectData(')),c);
  vm.runInContext(src.slice(src.indexOf('function assetPackPermissionWarnings('),src.indexOf('async function previewAssetPackExport(')),c);
  vm.runInContext(src.slice(src.indexOf("document.getElementById('tilemap-bundle-cancel').onclick"),src.indexOf("document.getElementById('import-tilemap-bundle-btn').onclick")),c);
  return {c,state,elements,messages,downloads,select:v=>selections=v,confirm:()=>elements.get('tilemap-bundle-confirm').onclick()};
}
(async()=>{
  for(const change of ['selection','assets','identity','undo','Play','cancel']){
    const m=mounted();await m.c.previewAssetPackExport();
    if(change==='selection')m.select([]);if(change==='assets')m.state.assets.push({id:'changed'});if(change==='identity')m.c.levels=[];if(change==='undo')m.c.undoStack.push({});if(change==='Play')m.c.playMode=true;if(change==='cancel')m.c.closeTilemapBundleModal();
    m.confirm();assert.equal(m.downloads.length,0,change);
  }
  for(const change of ['selection','cancel','Play']){
    const m=mounted();let finish;m.c.OpusTilemapBundle.createAssetPack=()=>new Promise(r=>finish=r);const pending=m.c.previewAssetPackExport();
    if(change==='selection')m.select([]);if(change==='cancel')m.c.closeTilemapBundleModal();if(change==='Play')m.c.playMode=true;
    finish({text:'bytes',extension:'.json',summary:{},sha256:'hash'});await pending;assert.equal(m.elements.get('tilemap-bundle-modal').style.display,'none',change);
  }
  const empty=mounted();empty.select([]);await empty.c.previewAssetPackExport();assert(empty.messages.some(s=>s.includes('Choose at least one')));
  const play=mounted();play.c.playMode=true;await play.c.previewAssetPackExport();assert(play.messages.some(s=>s.includes('Stop Play')));
  const good=mounted();const before=JSON.stringify(good.state);await good.c.previewAssetPackExport();good.confirm();good.confirm();assert.equal(good.downloads.length,1);assert.equal(good.downloads[0][1],'asset-pack.opus-assets.json');assert.equal(JSON.stringify(good.state),before);
  for(const change of ['none','retired','renamed','Play','cancel','history']){
    const m=mounted(),owner=m.c.prefabs[0];let received;
    m.c.OpusTilemapBundle.createAssetPack=async args=>{received=JSON.parse(JSON.stringify(args.selections));return {pack:{content:{dependencies:{}}},text:'canonical',extension:'.opus-assets.json',sha256:'hash',summary:{selected:1,blobs:0}};};
    await m.c.previewPrefabPackage(owner);assert.deepStrictEqual(received,[{collection:'prefabs',id:'Prefab <✓>'}]);
    if(change==='retired')m.c.prefabs=[{name:owner.name}];if(change==='renamed')owner.name='changed';if(change==='Play')m.c.playMode=true;if(change==='cancel')m.c.closeTilemapBundleModal();if(change==='history')m.c.undoStack.push({});
    m.confirm();assert.equal(m.downloads.length,change==='none'?1:0,'Prefab package '+change);
  }
  const retired=mounted(),old=retired.c.prefabs[0];retired.c.prefabs=[{name:old.name}];await retired.c.previewPrefabPackage(old);assert(retired.messages.some(s=>s.includes('Prefab changed')));assert.equal(retired.downloads.length,0);
  const asyncOwner=mounted();let finish;asyncOwner.c.OpusTilemapBundle.createAssetPack=()=>new Promise(resolve=>finish=resolve);const pending=asyncOwner.c.previewPrefabPackage(asyncOwner.c.prefabs[0]);asyncOwner.c.prefabs=[{name:'Prefab <✓>'}];finish({text:'canonical',extension:'.json',summary:{},sha256:'hash'});await pending;assert.equal(asyncOwner.elements.get('tilemap-bundle-modal').style.display,'none');
  assert(src.includes("e.target.closest('[data-delete-prefab], [data-export-prefab-package]')"),'Package pointer cannot begin Prefab placement');
  const advanced=mounted();advanced.c.OpusTilemapBundle.createAssetPack=async()=>({pack:{content:{dependencies:{prefabs:[{record:{behaviors:[{action:'script',params:{code:'never evaluated'}}]}}]}}},text:'canonical',extension:'.opus-assets.json',sha256:'hash',summary:{selected:1,blobs:0}});await advanced.c.previewAssetPackExport();assert(advanced.elements.get('tilemap-bundle-warnings').textContent.includes('Custom Script permission'));assert.equal(advanced.downloads.length,0);
  console.log('PASS200 actual pack export preview guards: empty/Play, async/stale selection/project/history/cancel, valid one-shot download');
})().catch(e=>{console.error(e);process.exitCode=1;});
