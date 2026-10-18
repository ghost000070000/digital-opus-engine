'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),src=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function mounted(){
  const elements=new Map(),messages=[],state={assets:[],levels:[{id:'level-original',objects:[]}]},root={id:'chunk-private',name:'Private'},downloads=[];
  const c={playMode:false,levels:state.levels,currentLevelIndex:0,undoStack:[],redoStack:[],tilemapChunks:[root],placed:[],
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{style:{display:'none'},textContent:''});return elements.get(id);}},
    captureAssetReplacementState:()=>({project:JSON.parse(JSON.stringify(state))}),
    OpusAuthoringPlumbing:{normalizeTilemapChunk:r=>JSON.parse(JSON.stringify(r))},
    OpusTilemapBundle:{verifyBundleText:async()=>({bundle:{rootKind:'tilemap-chunk'}}),createBundle:async()=>({text:'bytes',extension:'.json',summary:{},sha256:'private'})},
    showStatus:s=>messages.push(s),bundleSafeName:()=> 'private',tilemapBundleProjectView:()=>({}),downloadTextFile:(...v)=>downloads.push(v)};
  vm.createContext(c);
  vm.runInContext(src.slice(src.indexOf('let pendingTilemapBundleAction = null;'),src.indexOf('function tilemapBundleProjectView(')),c);
  vm.runInContext(src.slice(src.indexOf('function closeTilemapBundleModal('),src.indexOf('function planTilemapBundleImport(')),c);
  vm.runInContext(src.slice(src.indexOf('async function previewTilemapBundleImportFile('),src.indexOf("document.getElementById('import-tilemap-bundle-btn').onclick")),c);
  let commits=0;c.planTilemapBundleImport=()=>({summary:{},warnings:[]});c.commitTilemapBundleImport=()=>commits++;
  return {c,state,root,elements,messages,downloads,commits:()=>commits,confirm:()=>elements.get('tilemap-bundle-confirm').onclick()};
}
const file={name:'private.json',text:async()=> '{}'};
(async()=>{
  for(const change of ['assets','project-identity','level','undo','redo','cancel']){
    const m=mounted();await m.c.previewTilemapBundleImportFile(file);
    if(change==='assets')m.state.assets.push({id:'different'});
    if(change==='project-identity')m.c.levels=JSON.parse(JSON.stringify(m.c.levels));
    if(change==='level')m.c.currentLevelIndex=1;
    if(change==='undo')m.c.undoStack.push({changed:true});
    if(change==='redo')m.c.redoStack.push({changed:true});
    if(change==='cancel')m.c.closeTilemapBundleModal();
    const before=JSON.stringify(m.state);m.confirm();assert.equal(m.commits(),0,change);assert.equal(JSON.stringify(m.state),before);
  }
  for(const change of ['cancel','supersede','project','assets']){
    const m=mounted();let resolve;const pending=m.c.previewTilemapBundleImportFile({name:'slow.json',text:()=>new Promise(r=>resolve=r)});
    if(change==='cancel')m.c.closeTilemapBundleModal();
    if(change==='supersede')await m.c.previewTilemapBundleImportFile(file);
    if(change==='project')m.c.levels=[];
    if(change==='assets')m.state.assets.push({id:'async-changed'});
    resolve('{}');await pending;
    if(change==='supersede'){m.confirm();assert.equal(m.commits(),1,'Only newer preview commits');}
    else assert.equal(m.elements.get('tilemap-bundle-modal').style.display,'none',change);
  }
  for(const change of ['root-edit','root-retire','assets','Play']){
    const m=mounted();await m.c.previewTilemapBundleExport('tilemap-chunk',m.root);
    if(change==='root-edit')m.root.name='Changed';if(change==='root-retire')m.c.tilemapChunks=[];if(change==='assets')m.state.assets.push({id:'changed'});if(change==='Play')m.c.playMode=true;
    m.confirm();assert.equal(m.downloads.length,0,change);
  }
  const good=mounted();await good.c.previewTilemapBundleImportFile(file);good.confirm();assert.equal(good.commits(),1);good.confirm();assert.equal(good.commits(),1,'Consumed once');
  await good.c.previewTilemapBundleExport('tilemap-chunk',good.root);good.confirm();assert.equal(good.downloads.length,1);
  console.log('PASS200 mounted actual lease/modal/import/export: stale assets/project/level/history/root/Play, async cancel/supersede and one-shot valid operations');
})().catch(e=>{console.error(e);process.exitCode=1;});
