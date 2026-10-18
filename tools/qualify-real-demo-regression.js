'use strict';
// Durable local command gates. This does not grant real-game acceptance.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),{fingerprint}=require('./real-demo-program-state');
const root=path.resolve(__dirname,'..'),runId='regression-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/real-demo-collision',runId);
fs.mkdirSync(dir);const proof={runId,startedAt:new Date().toISOString(),fingerprint:fingerprint(),status:'IN_PROGRESS',gates:[]};
function save(){fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2)+'\n');}save();
function run(label,command,args){if(fingerprint()!==proof.fingerprint)throw new Error('Source changed during command qualification');const startedAt=new Date().toISOString(),r=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});fs.writeFileSync(path.join(dir,label+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):''));const gate={label,command:path.basename(command),args,startedAt,endedAt:new Date().toISOString(),exitCode:r.status,error:r.error?.message||null};proof.gates.push(gate);save();console.log(JSON.stringify(gate));if(r.status!==0)throw new Error(label+' failed; inspect preserved log');}
try{
 // The normal suite begins by rebuilding the exact public bundle itself.
 // Run it first, then the separately requested build gate; avoid two immediate
 // writes of that same artifact before any tests on Windows.
 for(const file of ['tests/run-tests.js','build/build.js','build/build-games.js','build/build-engine-site.js','build/build-games-site.js'])run(file.replace(/[/.]/g,'-'),process.execPath,[file]);
 const folders=['engine/src','editor/src','tools','tests','build'];let count=0;
 for(const folder of folders)for(const file of fs.readdirSync(path.join(root,folder)).filter(n=>n.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',folder+'/'+file],{cwd:root,encoding:'utf8'});if(r.status!==0){fs.writeFileSync(path.join(dir,'syntax-failure.log'),(r.stdout||'')+(r.stderr||''));throw new Error('Syntax failed: '+folder+'/'+file);}count++;}
 proof.gates.push({label:'syntax',files:count,status:'PASS',observedAt:new Date().toISOString()});
 let json=0;for(const folder of ['games','qualification/autonomous-product-program'])for(const file of fs.readdirSync(path.join(root,folder)).filter(n=>n.endsWith('.json'))){JSON.parse(fs.readFileSync(path.join(root,folder,file)));json++;}for(const file of ['no-code-capabilities.json','authoring-friction.json']){JSON.parse(fs.readFileSync(path.join(root,file)));json++;}proof.gates.push({label:'canonical-and-program-json',files:json,status:'PASS',observedAt:new Date().toISOString()});
 run('git-diff-check','git',['diff','--check']);proof.finalFingerprint=fingerprint();if(proof.finalFingerprint!==proof.fingerprint)throw new Error('Final source fingerprint drift');proof.status='COMMAND_GATES_PASSED_NOT_GAMEPLAY_ACCEPTANCE';
}catch(e){proof.status='COMMAND_GATE_FAILURE_NOT_COLLISION_VERDICT';proof.failure=e.stack;process.exitCode=1;}finally{proof.endedAt=new Date().toISOString();save();console.log(JSON.stringify({runId,status:proof.status,failure:proof.failure,dir}));}
