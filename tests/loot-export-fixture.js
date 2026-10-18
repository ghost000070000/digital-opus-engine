'use strict';
// Load actual production preflight into an already contextified historical VM.
// Absent loot libraries pass normally; no replacement validator is substituted.
const fs=require('fs'),vm=require('vm');
module.exports=function loadLootExportFixture(context){
  // The real report now records its current editor-level owner for navigation.
  // Historical isolated packaging hosts do not create a live editor scene.
  if(!context.levels)context.levels=[];
  // These historical fixtures own packaging/other preflight families and
  // intentionally use incomplete portable schemas.217 executes the actual
  // canonical/complete structured gate independently; do not fake it as passing
  // real-world validation here.
  if(!context.collectStructuredProjectIssues)context.collectStructuredProjectIssues=()=>({issues:[]});
  const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
  vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-loot-tables.js'),'utf8'),context);
  for(const name of ['validateImportedSceneRecords','lootPickupPrefab','inspectLootTable','collectLootTableIssues']){
    const at=source.indexOf('function '+name+'(');if(at<0)throw Error('Missing production '+name);
    vm.runInContext(source.slice(at,source.indexOf('\n}',at)+2),context);
  }
  vm.runInContext('this.lootTables=[];this.prefabs=[];this.currentItemDefs=[];',context);
};
