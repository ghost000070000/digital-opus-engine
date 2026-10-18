'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const api=require('../editor/src/00-input-tuning.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('historical defaults and independent repeated values',()=>{
  assert.deepStrictEqual(api.inspect(),{ok:true,record:{kind:'GamepadTuning',version:1,deadZone:.25,lookRate:2.6}});
  const value=api.defaults();value.deadZone=0;assert.strictEqual(api.defaults().deadZone,.25);
});
test('finite boundaries preserve zero and maximum without coercion',()=>{
  for(const deadZone of [0,.25,1])for(const lookRate of [0,2.6,10])assert.strictEqual(api.inspect({...api.defaults(),deadZone,lookRate}).ok,true);
  for(const deadZone of [-.1,1.01,Infinity,NaN,'0',null,false])assert.strictEqual(api.inspect({...api.defaults(),deadZone}).ok,false);
  for(const lookRate of [-1,10.01,Infinity,NaN,'2.6',null,true])assert.strictEqual(api.inspect({...api.defaults(),lookRate}).ok,false);
});
test('future malformed and unknown author records retained independently',()=>{
  const future={kind:'GamepadTuning',version:2,deadZone:.1,lookRate:4,extension:{new:true}};
  assert.strictEqual(api.inspect(future).ok,false);assert.deepStrictEqual(api.copy(future),future);
  for(const record of [null,[],{}, {...api.defaults(),kind:'Other'}])assert.strictEqual(api.inspect(record).ok,false);
  const current={...api.defaults(),extension:{array:[0,false,'']}};const result=api.inspect(current);assert(result.ok);result.record.extension.array.push(3);assert.deepStrictEqual(current.extension.array,[0,false,'']);
});
test('strict JSON rejects accessors symbols prototypes cycles and oversized records',()=>{
  let invoked=0;const getter={...api.defaults()};Object.defineProperty(getter,'deadZone',{get(){invoked++;return .2;}});
  const cycle={...api.defaults()};cycle.extension=cycle;
  const symbol={...api.defaults(),[Symbol('hidden')]:true};
  for(const record of [getter,cycle,symbol,Object.assign(Object.create({x:1}),api.defaults()),{...api.defaults(),extension:()=>{}},{...api.defaults(),extension:'x'.repeat(65536)},JSON.parse('{"kind":"GamepadTuning","version":1,"deadZone":0.25,"lookRate":2.6,"__proto__":{}}')])assert.strictEqual(api.inspect(record).ok,false);
  assert.strictEqual(invoked,0);assert.throws(()=>api.copy(getter));
});
test('valid local preferences override independently while invalid fields fall back authored',()=>{
  const authored={...api.defaults(),deadZone:.4,lookRate:3,extension:{keep:true}};
  assert.deepStrictEqual(api.effective(authored,{deadZone:0,lookRate:0}).record,{...authored,deadZone:0,lookRate:0});
  assert.strictEqual(api.effective(authored,{deadZone:'0',lookRate:4}).record.deadZone,.4);
  assert.strictEqual(api.effective(authored,{deadZone:'0',lookRate:4}).record.lookRate,4);
  for(const local of [undefined,null,[],{deadZone:NaN,lookRate:Infinity},{deadZone:false,lookRate:''}])assert.deepStrictEqual(api.effective(authored,local).record,authored);
  const result=api.effective(authored,{});result.record.extension.keep=false;assert.strictEqual(authored.extension.keep,true);
});
test('unsupported authored tuning cannot be repaired by local preferences',()=>{
  for(const authored of [null,{...api.defaults(),version:2},{...api.defaults(),deadZone:Infinity}])assert.strictEqual(api.effective(authored,{deadZone:0,lookRate:2}).ok,false);
  assert.strictEqual(api.effective(undefined,{deadZone:.5}).record.deadZone,.5);
});
test('local inherited and executable fields never affect canonical values',()=>{
  let invoked=0;const local={};Object.defineProperty(local,'deadZone',{enumerable:true,get(){invoked++;return 0;}});
  assert.strictEqual(api.effective(undefined,local).record.deadZone,.25);assert.strictEqual(invoked,0);
  assert.strictEqual(api.effective(undefined,Object.create({deadZone:0,lookRate:0})).record.lookRate,2.6);
});
test('signed finite axis strict thresholds and invalid input are inert',()=>{
  assert.strictEqual(api.axis(.25,.25),0);assert.strictEqual(api.axis(-.25,.25),0);
  assert.strictEqual(api.axis(.251,.25),.251);assert.strictEqual(api.axis(-.251,.25),-.251);
  assert.strictEqual(api.axis(.001,0),.001);assert.strictEqual(api.axis(0,0),0);assert.strictEqual(api.axis(1,1),0);
  for(const value of [undefined,null,NaN,Infinity,-Infinity,1.1,-1.1,'1',true])assert.strictEqual(api.axis(value,.25),0);
  for(const zone of [undefined,null,NaN,Infinity,-.1,1.1,'0'])assert.strictEqual(api.axis(.9,zone),0);
});
test('browser UMD matches canonical Node exports and has no runtime clock',()=>{
  const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-input-tuning.js'),'utf8'),context);
  assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify(OpusInputTuning.effective(undefined,{deadZone:0,lookRate:0}))',context)),api.effective(undefined,{deadZone:0,lookRate:0}));
  assert.strictEqual(vm.runInContext('OpusInputTuning.axis(-.8,.25)',context),-.8);
  assert.deepStrictEqual(Object.keys(api).sort(),['axis','copy','defaults','effective','inspect']);
});
console.log('Phase 095 input tuning: '+passed+' groups passed.');
