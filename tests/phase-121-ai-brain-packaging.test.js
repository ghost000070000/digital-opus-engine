'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),name='00-ai-brain.js';
const moduleText=fs.readFileSync(path.join(ROOT,'editor/src',name),'utf8');
const schemaText=fs.readFileSync(path.join(ROOT,'editor/src/00-authoring-schema.js'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'editor/src/01-editor.js'),'utf8');
function check(text){
  const at=text.indexOf(moduleText);assert(at>=0,'Complete actual AI Brain module packaged');
  assert(text.indexOf(schemaText)>at,'Brain executes before schema consumes its browser UMD');
  assert(text.indexOf(core)>at,'Brain executes before actual editor core');
  assert.equal(text.indexOf(moduleText,at+moduleText.length),-1,'Module included exactly once');
}
let passed=0,failed=0;async function test(label,fn){try{await fn();passed++;console.log('PASS '+label);}catch(error){failed++;console.error('FAIL '+label+'\n'+error.stack);}}
(async()=>{
  for(const playableOnly of [false,true])await test('Actual native '+(playableOnly?'Playable':'Editable')+' assembly includes AI Brain before schema',async()=>{
    const fn=core.match(/async function buildExportHTML\(playableOnly\) \{[\s\S]*?\n\}/);assert(fn);
    const fetched=[],context={serializeProject:()=>({levels:[{objects:[]}]}),collectTouchLayoutIssues:()=>[],
      OpusInputContexts:{collectIssues:()=>[]},OpusSignals:{collectDependencies:()=>({issues:[]})},
      projectMeta:{title:'Internal AI Brain packaging'},currentUiConfig:{startScreen:{}},
      fetch:async file=>{fetched.push(file);return {text:async()=>fs.readFileSync(path.resolve(ROOT,'editor',file),'utf8')};},composeExportHTML:options=>options};
    vm.createContext(context);vm.runInContext(fn[0],context);require('./loot-export-fixture')(context);const result=await context.buildExportHTML(playableOnly);
    check(result.editorJS);assert.equal(fetched.filter(file=>file==='src/'+name).length,1);
  });
  for(const builder of ['build-games.js','build-games-site.js'])await test('Actual '+builder+' assembly includes AI Brain before schema',()=>{
    const source=fs.readFileSync(path.join(ROOT,'build',builder),'utf8'),assignment=source.match(/const editorJS = \[[\s\S]*?\]\.join\('\\n'\);/);assert(assignment);
    const context={fs,path,ROOT};vm.createContext(context);vm.runInContext(assignment[0]+'\nthis.result=editorJS;',context);check(context.result);
  });
  await test('Actual engine-site copy and editor script order load AI Brain before schema',()=>{
    const source=fs.readFileSync(path.join(ROOT,'build/build-engine-site.js'),'utf8'),copies=[];
    const context={path,ROOT,DIST_DIR:path.join(ROOT,'dist'),SITE_DIR:path.join(ROOT,'dist/engine-site'),fs:{copyFileSync:(from,to)=>copies.push({from,to})}};
    vm.createContext(context);vm.runInContext((source.match(/^const \w+Path = path\.join\([^\n]+\);/gm)||[]).join('\n')+'\n'+(source.match(/^fs\.copyFileSync\([^\n]+\);/gm)||[]).join('\n'),context);
    const matched=copies.filter(copy=>copy.to===path.join(context.SITE_DIR,'editor/src',name));assert.equal(matched.length,1);assert.equal(fs.readFileSync(matched[0].from,'utf8'),moduleText);
    const index=fs.readFileSync(path.join(ROOT,'editor/index.html'),'utf8');
    const scripts=[...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(match=>match[1].split('?')[0]);
    assert.equal(scripts.filter(src=>src==='src/'+name).length,1);assert(scripts.indexOf('src/'+name)<scripts.indexOf('src/00-authoring-schema.js'));assert(scripts.indexOf('src/00-authoring-schema.js')<scripts.indexOf('src/01-editor.js'));
    const browser={};vm.createContext(browser);vm.runInContext(['00-collision-filter-2d.js','00-ai-brain.js','00-damage-policy.js','00-combat-volumes.js','00-authoring-schema.js'].map(file=>fs.readFileSync(path.join(ROOT,'editor/src',file),'utf8')).join('\n'),browser);
    assert(browser.OpusAuthoring.registry.get('ai-brain'),'Actual browser UMD schema registers AI Brain with its dependency loaded');
  });
  console.log(`Phase121 actual AI Brain packaging: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
})();
