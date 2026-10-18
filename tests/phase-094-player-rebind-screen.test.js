'use strict';
const assert=require('assert'),crypto=require('crypto'),fs=require('fs'),vm=require('vm');
const api=require('../editor/src/00-player-rebind-screen.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name);throw error;}}
test('historical absent Controls defaults are available and independent',()=>{
  assert.deepStrictEqual(api.inspect(undefined),{ok:true,record:api.defaults()});
  const a=api.defaults();a.title='Other';assert.strictEqual(api.defaults().title,'Controls');
});
test('supported schema retains independent unknown records and false enabled',()=>{
  const input={...api.defaults(),enabled:false,extension:{future:[1,false,'']}};
  const result=api.inspect(input);assert(result.ok);assert.strictEqual(result.record.enabled,false);
  result.record.extension.future.push(2);assert.deepStrictEqual(input.extension.future,[1,false,'']);
  assert.deepStrictEqual(api.copy(input),input);
});
test('future and malformed configuration fail closed without mutation',()=>{
  for(const input of [null,[],{...api.defaults(),version:2},{...api.defaults(),enabled:'true'},{...api.defaults(),title:''},{...api.defaults(),title:'x'.repeat(81)},{...api.defaults(),description:'x'.repeat(513)},{...api.defaults(),launcherLabel:'x'.repeat(41)}]){
    const original=JSON.stringify(input);assert.strictEqual(api.inspect(input).ok,false);assert.strictEqual(JSON.stringify(input),original);
  }
});
test('unsafe portable data is refused without invoking getters',()=>{
  let invoked=0;const getter={...api.defaults()};Object.defineProperty(getter,'extra',{enumerable:true,get(){invoked++;return 1;}});
  const cycle={...api.defaults()};cycle.extra=cycle;
  for(const record of [getter,cycle,{...api.defaults(),extra:Infinity},{...api.defaults(),extra:()=>{}},Object.assign(Object.create({inherited:1}),api.defaults()),JSON.parse('{"__proto__":{},"kind":"PlayerRebindScreen"}')])assert.strictEqual(api.inspect(record).ok,false);
  const hidden={...api.defaults()};Object.defineProperty(hidden,'title',{get(){invoked++;return 'Hidden';}});assert.strictEqual(api.inspect(hidden).ok,false);
  const scopeGetter={};Object.defineProperty(scopeGetter,'playerPreferenceScope',{get(){invoked++;return {};}});assert.throws(()=>api.scope(scopeGetter));
  assert.strictEqual(invoked,0);assert.throws(()=>api.copy(getter));
  assert.strictEqual(api.inspect({...api.defaults(),extra:'x'.repeat(65536)}).ok,false);
});
test('local SHA-256 agrees with Node known vectors including Unicode and surrogate replacement',()=>{
  const vectors=['','abc','The quick brown fox jumps over the lazy dog','世界 🌎 café','\ud800','\udc00','x'.repeat(55),'x'.repeat(56),'x'.repeat(64),'x'.repeat(100000)];
  for(const text of vectors)assert.strictEqual(api.sha256(text),crypto.createHash('sha256').update(text,'utf8').digest('hex'));
  assert.strictEqual(api.sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');assert.throws(()=>api.sha256(3));
});
test('historical scope uses exact original payload once and roundtrips identity',()=>{
  const original={title:'A',levels:[{id:'level-1',unknown:{unicode:'🌎'}}]};
  const expected='legacy-'+crypto.createHash('sha256').update(JSON.stringify(original)).digest('hex');
  const scope=api.scope(original);assert.strictEqual(scope.id,expected);assert.strictEqual(api.scopeKey(scope),'inputOverrides:'+expected);
  assert.deepStrictEqual(api.scope({...original,title:'renamed',playerPreferenceScope:scope}),scope);
  assert.notStrictEqual(api.scope({...original,title:'B'}).id,scope.id);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(original,'playerPreferenceScope'),false);
  const historical=[{kind:'cube',position:[1,2,3]}];
  assert.strictEqual(api.scope(historical).id,'legacy-'+crypto.createHash('sha256').update(JSON.stringify(historical)).digest('hex'));
  assert.deepStrictEqual(historical,[{kind:'cube',position:[1,2,3]}]);
});
test('unsupported existing scope is retained and never falls back globally',()=>{
  for(const scope of [{kind:'PlayerPreferenceScope',version:2,id:'future',extra:[1]},null,{kind:'PlayerPreferenceScope',version:1,id:'bad'}]){
    assert.deepStrictEqual(api.scope({playerPreferenceScope:scope,title:'A'}),scope);assert.strictEqual(api.scopeKey(scope),null);
  }
  const scope={kind:'PlayerPreferenceScope',version:2,extra:{a:1}};const retained=api.scope({playerPreferenceScope:scope});retained.extra.a=2;assert.strictEqual(scope.extra.a,1);
});
test('scope keys validate owned identity and reject aliases or malformed JSON',()=>{
  const valid={kind:'PlayerPreferenceScope',version:1,id:'550e8400-e29b-41d4-a716-446655440000'};
  assert.strictEqual(api.scopeKey(valid),'inputOverrides:'+valid.id);
  for(const scope of [Object.create(valid),{...valid,id:'../../other'},{...valid,id:'legacy-'+('a'.repeat(63))},{...valid,extra:NaN},{...valid,id:3}])assert.strictEqual(api.scopeKey(scope),null);
});
function browserContext(cryptoObject){const context=vm.createContext({crypto:cryptoObject});vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-player-rebind-screen.js'),'utf8'),context);return context;}
test('fresh scopes use secure UUID or getRandomValues and never weak fallbacks',()=>{
  const direct=browserContext({randomUUID:()=> '550e8400-e29b-41d4-a716-446655440000'});assert.strictEqual(vm.runInContext('OpusPlayerRebindScreen.freshScope().id',direct),'550e8400-e29b-41d4-a716-446655440000');
  let calls=0;const fallback=browserContext({getRandomValues(bytes){calls++;bytes.fill(0);return bytes;}});
  assert.strictEqual(vm.runInContext('OpusPlayerRebindScreen.freshScope().id',fallback),'00000000-0000-4000-8000-000000000000');assert.strictEqual(calls,1);
  const absent=browserContext(undefined);assert.throws(()=>vm.runInContext('OpusPlayerRebindScreen.freshScope()',absent),/Secure local randomness/);
  const bad=browserContext({randomUUID:()=> 'bad'});assert.throws(()=>vm.runInContext('OpusPlayerRebindScreen.freshScope()',bad),/invalid UUID/);
});
test('browser and Node exports produce identical schema and UTF-8 identity',()=>{
  const context=browserContext(undefined);const value=vm.runInContext('JSON.stringify(OpusPlayerRebindScreen.scope({title:"世界 🌎",levels:[]}))',context);
  assert.deepStrictEqual(JSON.parse(value),api.scope({title:'世界 🌎',levels:[]}));assert.strictEqual(vm.runInContext('OpusPlayerRebindScreen.inspect().ok',context),true);
});
console.log('Phase 094 player rebind screen: '+passed+' groups passed.');
