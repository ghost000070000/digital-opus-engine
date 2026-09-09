'use strict';
// Read-only source audit. Does not change games, catalog, gates or runtime.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8').replace(/^\uFEFF/,''));
const editor=fs.readFileSync(path.join(ROOT,'editor/src/01-editor.js'),'utf8');
const section=(start,end)=>editor.slice(editor.indexOf(start),editor.indexOf(end,editor.indexOf(start)));
const keys=text=>[...text.matchAll(/^  ([A-Za-z][A-Za-z0-9]*):\s*\{/gm)].map(m=>m[1]);
const actions=new Set([...keys(section('const ACTION_TYPES = {','function executeAction(')),'graph','dialogueTree']);
const graphTypes=new Set([...actions,...keys(section('Object.assign(GRAPH_NODE_TYPES, {','// (from-port, to-port)'))]);
const aiConditions=new Set((editor.match(/const AI_CONDITION_TYPES = \[([^\]]+)\]/)||[])[1].match(/'[^']+'/g).map(v=>v.slice(1,-1)));
const skip=new Set(['dataURL','positions','normals','indices','uvs','joints','weights','inverseBindMatrices','heightEdits','weightsEdits']);
const report={generatedAt:new Date().toISOString(),method:'Static source references checked in their separate mesh/texture/audio/prefab namespaces; runtime behavior/graph types read from current editor registries. Text findings are reviewed, not automatically failures.',games:[]};
for(const entry of read('games/catalog.json').games){
 const bytes=fs.readFileSync(path.join(ROOT,'games',entry.file)),project=JSON.parse(bytes),sets={mesh:new Set((project.assets||[]).map(v=>v.id)),texture:new Set((project.textures||[]).map(v=>v.id)),audio:new Set((project.audio||[]).map(v=>v.id)),prefab:new Set((project.prefabs||[]).map(v=>v.name))};
 const result={id:entry.id,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),referenceCount:{mesh:0,texture:0,audio:0,prefab:0},missingReferences:[],unsupportedActions:[],unsupportedGraphTypes:[],unsupportedAiConditions:[],copyFindings:[],identity:[]};
 if(project.meta?.title!==entry.title)result.identity.push('Project meta title '+JSON.stringify(project.meta?.title)+' differs from '+entry.title);
 (project.levels||[project]).forEach((level,i)=>{if(level.ui?.startScreen?.enabled&&level.ui.startScreen.title!==entry.title)result.identity.push('Level '+i+' Start Screen title '+JSON.stringify(level.ui.startScreen.title)+' differs from '+entry.title);});
 function ref(kind,value,p){if(typeof value!=='string'||!value)return;result.referenceCount[kind]++;if(!sets[kind].has(value))result.missingReferences.push({kind,path:p,value});}
 function walk(v,p){
  if(!v||typeof v!=='object')return;
  if(typeof v.action==='string'&&!actions.has(v.action))result.unsupportedActions.push({path:p+'.action',value:v.action});
  if(typeof v.actionType==='string'&&!actions.has(v.actionType))result.unsupportedActions.push({path:p+'.actionType',value:v.actionType});
  if(v.graph&&Array.isArray(v.graph.nodes))for(const [i,node]of v.graph.nodes.entries())if(!graphTypes.has(node.type))result.unsupportedGraphTypes.push({path:p+'.graph.nodes.'+i+'.type',value:node.type});
  if(/\.transitions\.\d+$/.test(p)&&v.condition?.type&&!aiConditions.has(v.condition.type))result.unsupportedAiConditions.push({path:p+'.condition.type',value:v.condition.type});
  for(const [k,x]of Object.entries(v)){
   const loc=p+'.'+k;
   if(k==='assetId')ref('mesh',x,loc);
   else if(/textureAssetId|iconAssetId/.test(k))ref('texture',x,loc);
   else if(/(?:audio|sound)AssetId$/i.test(k))ref('audio',x,loc);
   else if(['prefabName','sourcePrefabName','attackPrefab'].includes(k))ref('prefab',x,loc);
   if(typeof x==='string'&&!skip.has(k)&&!/^(data:|showcase-)/.test(x)&&/crate\s*run|dogfood|\bWave\s*\d|regression|stress[- ]?test|test[-_ ]?fixture|skinned[-_ ]?bend|back to editor/i.test(x))result.copyFindings.push({path:loc,text:x.slice(0,700),authoringOnly:/\.name$|\.tags\.|\.sourceFilename$|\.id$/.test(loc)});
   if(!skip.has(k))walk(x,loc);
  }
 }
 walk(project,'project');walk({description:entry.description,purpose:entry.purpose},'catalog');
 report.games.push(result);
}
report.summary={games:report.games.length,references:Object.fromEntries(['mesh','texture','audio','prefab'].map(kind=>[kind,report.games.reduce((n,g)=>n+g.referenceCount[kind],0)])),missingReferences:report.games.reduce((n,g)=>n+g.missingReferences.length,0),unsupportedActions:report.games.reduce((n,g)=>n+g.unsupportedActions.length,0),unsupportedGraphTypes:report.games.reduce((n,g)=>n+g.unsupportedGraphTypes.length,0),unsupportedAiConditions:report.games.reduce((n,g)=>n+g.unsupportedAiConditions.length,0),copyFindings:report.games.reduce((n,g)=>n+g.copyFindings.length,0),identity:report.games.reduce((n,g)=>n+g.identity.length,0)};
fs.writeFileSync(path.join(ROOT,'rehabilitation-evidence/final-static-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
for(const g of report.games)if(g.missingReferences.length||g.unsupportedActions.length||g.unsupportedGraphTypes.length||g.unsupportedAiConditions.length||g.copyFindings.length||g.identity.length)console.log(JSON.stringify(g));
