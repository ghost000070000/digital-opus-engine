'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),api=require('../editor/src/00-input-contexts.js');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
const context=(id='input-context-1',name='Explore',actions=['interact'],look=true)=>({id,name,actions,look});
const library=(contexts=[context()])=>({...api.defaults(),contexts});
test('absent library historical defaults and copy independence',()=>{
  assert.deepStrictEqual(api.inspect(),{ok:true,record:{kind:'InputContexts',version:1,contexts:[]}});
  const original=library();const result=api.inspect(original);result.record.contexts[0].actions.push('jump');assert.deepStrictEqual(original.contexts[0].actions,['interact']);
});
test('strict shape identities names booleans and limits',()=>{
  for(const record of [null,[],{...library(),version:2},library([context('bad')]),library([context(undefined,'')]),library([context(undefined,'a'.repeat(81))]),library([context(undefined,'Name',['constructor'])]),library([context(undefined,'Name',['interact','interact'])]),library([context(undefined,'Name',[],0)]),library([context(),context('input-context-2',' eXPLORE ')]),library([context(),context()])])assert.strictEqual(api.inspect(record).ok,false);
  assert.strictEqual(api.inspect(library([context('input-context-550e8400-e29b-41d4-a716-446655440000','Menu',[],false)])).ok,true);
  assert.strictEqual(api.inspect(library(Array.from({length:33},(_,i)=>context('input-context-'+(i+1),'Name'+i)))).ok,false);
  assert.strictEqual(api.inspect({...library(),extension:'x'.repeat(65536)}).ok,false);
});
test('unsafe own JSON never executes accessor or retains prototype state',()=>{
  let invoked=0;const getter=library();Object.defineProperty(getter,'contexts',{get(){invoked++;return [];}});assert.strictEqual(api.inspect(getter).ok,false);assert.strictEqual(invoked,0);
  const cycle=library();cycle.extension=cycle;
  for(const record of [cycle,{...library(),extension:Infinity},{...library(),extension:()=>{}},Object.assign(Object.create({x:1}),library()),JSON.parse('{"kind":"InputContexts","version":1,"contexts":[],"__proto__":{}}')])assert.strictEqual(api.inspect(record).ok,false);
  assert.throws(()=>api.copy(getter));
  const actions=[];Object.defineProperty(actions,'0',{enumerable:true,get(){invoked++;return 'interact';}});assert.strictEqual(api.compile(undefined,actions).ok,false);
  const fake={};Object.defineProperty(fake,'ok',{get(){invoked++;return true;}});assert.strictEqual(api.resolve(fake,null,'interact').valid,false);assert.strictEqual(invoked,0);
});
test('upsert and removal preserve supported unknown fields atomically',()=>{
  const original={...library([{...context(),extension:{keep:1}}]),libraryExtension:[1]};
  const result=api.upsert(original,context(undefined,'Renamed',['jump'],false));assert(result.ok);assert.deepStrictEqual(result.record.contexts[0].extension,{keep:1});assert.deepStrictEqual(result.record.libraryExtension,[1]);assert.strictEqual(original.contexts[0].name,'Explore');
  const inserted=api.upsert(result.record,context('input-context-2',' Second ',[],true));assert(inserted.ok);assert.strictEqual(inserted.record.contexts[1].name,'Second');
  assert.strictEqual(api.upsert(inserted.record,context('input-context-3','second')).ok,false);
  const removed=api.remove(inserted.record,'input-context-1');assert(removed.ok);assert.strictEqual(removed.record.contexts.length,1);assert.deepStrictEqual(removed.record.libraryExtension,[1]);
  const future={...original,version:2};assert.strictEqual(api.upsert(future,context()).ok,false);assert.strictEqual(api.remove(future,'input-context-1').ok,false);assert.deepStrictEqual(api.copy(future),future);
});
test('valid inactive Action differs from missing invalid through canonical resolve',()=>{
  const compiled=api.compile(library(),['interact','attack']);assert(compiled.ok);
  assert.deepStrictEqual(api.resolve(compiled,'input-context-1','interact'),{valid:true,allowed:true,look:true});
  assert.deepStrictEqual(api.resolve(compiled,'input-context-1','attack'),{valid:true,allowed:false,look:true});
  assert.strictEqual(api.resolve(compiled,'input-context-1','input-action-1').valid,false);
  assert.deepStrictEqual(api.resolve(compiled,null,'attack'),{valid:true,allowed:true,look:true});
  assert.strictEqual(api.resolve(compiled,'input-context-99','attack').valid,false);
});
test('empty context denies logical Actions and look while unrestricted valid defaults remain',()=>{
  const compiled=api.compile(library([context(undefined,'Empty',[],false)]),['interact']);
  assert.deepStrictEqual(api.resolve(compiled,'input-context-1','interact'),{valid:true,allowed:false,look:false});
  assert.deepStrictEqual(api.resolve(compiled,'input-context-1'),{valid:true,allowed:true,look:false});
  assert.deepStrictEqual(api.resolve(api.compile(undefined,['interact']),null,'interact'),{valid:true,allowed:true,look:true});
});
test('dangling selected context fails closed without disabling valid peers',()=>{
  const compiled=api.compile(library([context(),context('input-context-2','Missing',['input-action-8'])]),['interact']);assert(compiled.ok);
  assert.strictEqual(compiled.contexts[1].valid,false);assert.strictEqual(api.resolve(compiled,'input-context-2','interact').valid,false);assert.strictEqual(api.resolve(compiled,'input-context-1','interact').allowed,true);
  for(const raw of [null,{...library(),version:2}])assert.strictEqual(api.resolve(api.compile(raw,['interact']),null,'interact').valid,false);
});
test('bounded compile strips extensions and creates detached session semantics',()=>{
  const ids=Array.from({length:128},(_,i)=>'input-action-'+(i+1)),raw=library([{...context(undefined,'All',ids),extension:'large'}]);
  const compiled=api.compile(raw,ids);assert(compiled.ok);assert.strictEqual(compiled.contexts[0].extension,undefined);
  raw.contexts[0].actions.length=0;compiled.contexts[0].actions.length=0;assert.strictEqual(api.resolve(compiled,'input-context-1',ids[127]).allowed,true,'Session decisions are detached from mutable author/public views');
  for(const available of [['interact','interact'],['invalid'],Array.from({length:141},(_,i)=>'input-action-'+(i+1))])assert.strictEqual(api.compile(undefined,available).ok,false);
});
test('secure UUID identity and browser UMD no weak fallback',()=>{
  function browser(crypto){const c=vm.createContext({crypto});vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-input-contexts.js'),'utf8'),c);return c;}
  const direct=browser({randomUUID:()=> '550e8400-e29b-41d4-a716-446655440000'});assert.strictEqual(vm.runInContext('OpusInputContexts.freshId()',direct),'input-context-550e8400-e29b-41d4-a716-446655440000');
  const fallback=browser({getRandomValues(bytes){bytes.fill(0);}});assert.strictEqual(vm.runInContext('OpusInputContexts.freshId()',fallback),'input-context-00000000-0000-4000-8000-000000000000');
  assert.throws(()=>vm.runInContext('OpusInputContexts.freshId()',browser(undefined)),/Secure local randomness/);
  assert.strictEqual(vm.runInContext('OpusInputContexts.resolve(OpusInputContexts.compile(undefined,["interact"]),null,"interact").allowed',direct),true);
});
test('portable context audit covers canonical containers without scanning arbitrary text',()=>{
  const params={contextId:'input-context-99'},behavior={action:'setInputContext',params},node={id:'missing',type:'setInputContext',contextId:params.contextId};
  const object={id:'actor',behaviors:[behavior,{action:'graph',graph:{nodes:[node]}}],states:[{id:'idle',entryActions:[behavior]}],ai:{states:[{id:'ai',entryActions:[behavior]}]}};
  const button={kind:'button',id:'open',buttonAction:'setInputContext',buttonParams:params};
  const project={inputContexts:library(),levels:[{id:'level',playerSettings:{inputContextId:'input-context-99'},objects:[object],sequences:[{id:'sequence',steps:[{actionType:'setInputContext',params}]}],ui:{hudElements:[button],menuPages:[{id:'page',elements:[button]}]},itemDefs:[{id:'localItem',useAction:behavior}]}],uiTemplates:[{kind:'HUDtemplate',version:1,name:'Buttons',elements:[button]}],prefabs:[{name:'records',records:[object]},{name:'objects',objects:[object]},{name:'record',record:object},{name:'fallback',...object}],graphFunctions:[{id:'function',graph:{nodes:[node]}}],spriteAnimations:[{id:'clip',events:[behavior]}],itemDefs:[{id:'item',useAction:behavior}],unknown:{action:'setInputContext',params},script:'setInputContext(input-context-99)'};
  const before=JSON.stringify(project),issues=api.collectIssues(project);assert.strictEqual(issues.length,28);assert(issues.every(issue=>issue.scope==='input-context'&&issue.severity==='error'&&issue.referenceValue==='input-context-99'&&typeof issue.location==='string'));assert.strictEqual(JSON.stringify(project),before);
  const valid=JSON.parse(before.replaceAll('input-context-99','input-context-1'));assert.deepStrictEqual(api.collectIssues(valid),[]);valid.levels[0].playerSettings.inputContextId=null;assert.deepStrictEqual(api.collectIssues(valid),[]);
  assert.deepStrictEqual(api.collectIssues({levels:[{objects:[],playerSettings:{}}]}),[]);
});
test('audit identifies every dangling membership and rejects future library and malformed selected references',()=>{
  const project={inputContexts:library([context(undefined,'Missing',['input-action-1','input-action-2'])]),levels:[{id:'level',playerSettings:{inputContextId:'input-context-1'}}]};
  assert.deepStrictEqual(api.collectIssues(project).map(issue=>issue.code),['input-context-action-unavailable','input-context-action-unavailable','input-context-reference-unavailable']);
  project.inputActionAssets=[{kind:'InputAction',version:1,id:'input-action-1',name:'One',description:''},{kind:'InputAction',version:1,id:'input-action-2',name:'Two',description:''}];assert.deepStrictEqual(api.collectIssues(project),[]);
  project.inputActionAssets[1].version=2;assert(api.collectIssues(project).some(issue=>issue.referenceValue==='input-action-2'));
  project.inputContexts.version=2;assert(api.collectIssues(project).some(issue=>issue.code==='input-context-library-invalid'));
  project.inputContexts=library();project.levels[0].playerSettings.inputContextId=123;assert.strictEqual(api.collectIssues(project)[0].referenceValue,123);
  project.levels[0].playerSettings.inputContextId=null;project.levels[0].objects=[{behaviors:[{action:'setInputContext',params:{}}]}];assert.strictEqual(api.collectIssues(project)[0].code,'input-context-reference-unavailable');
});
test('audit refuses accessors without invoking them and fails closed at bounded project work limit',()=>{
  let reads=0;const bad={};Object.defineProperty(bad,'levels',{enumerable:true,get(){reads++;return [];}});assert.strictEqual(api.collectIssues(bad)[0].code,'input-context-project-invalid');assert.strictEqual(reads,0);
  assert.strictEqual(api.collectIssues({levels:[{objects:Array.from({length:65536},()=>({}))}]} )[0].code,'input-context-audit-limit');
  assert.deepStrictEqual(api.collectIssues({meshAssets:[{vertices:Array.from({length:100000},()=>0)}],unknown:{contextId:'input-context-99'}}),[],'Unrelated asset content and unknown records are not dependency containers');
});
console.log('Phase 096 input contexts: '+passed+' groups passed.');
