'use strict';
// Install production namespace dependencies in extracted runtime VM fixtures.
// Payload/equipment/loot assertions remain unchanged; browser tests prove
// multi-game isolation using real localStorage and native controls.
const fs=require('fs'),vm=require('vm'),source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
module.exports=function install(context){
  const start=source.indexOf('function projectRuntimeSaveSystem('),end=source.indexOf('\n}',start)+2;
  if(start<0||end<2)throw Error('Production runtime namespace resolver missing');
  const scopes=fs.readFileSync(require.resolve('../editor/src/00-player-rebind-screen.js'),'utf8');
  vm.runInContext('(function(){const module=undefined;'+scopes+'})();var playerPreferenceScope={kind:"PlayerPreferenceScope",version:1,id:"11111111-1111-4111-8111-111111111111"};'+source.slice(start,end),context);
};
