'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),file=path.join(root,'qualification/autonomous-product-program/CURRENT-STATE.json');
const before=fs.readFileSync(file),state=JSON.parse(before);
const result=cp.spawnSync(process.execPath,['tools/real-demo-program-state.js'],{cwd:root,encoding:'utf8',timeout:30000});
assert.equal(result.status,0,result.stderr);assert(/^[a-f0-9]{64}\s*$/.test(result.stdout));
assert(fs.readFileSync(file).equals(before),'Default CLI fingerprint must be read-only');
console.log('PASS default program-state CLI reads fingerprint without rewriting mission');
if(state.currentPhase>50){
  const refused=cp.spawnSync(process.execPath,['tools/real-demo-program-state.js','--initialize-legacy'],{cwd:root,encoding:'utf8',timeout:30000});
  assert.notEqual(refused.status,0);assert(refused.stderr.includes('Refusing legacy initialization'));
  assert(fs.readFileSync(file).equals(before),'Refused legacy bootstrap must preserve advanced state');
  console.log('PASS legacy initialization refuses advanced mission without writes');
}
