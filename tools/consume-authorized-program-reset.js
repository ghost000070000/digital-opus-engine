'use strict';
// Explicit one-shot human authorization; no automatic quota loop or second reset.
// https://learn.chatgpt.com/docs/app-server
const fs = require('fs'), path = require('path'), {spawn} = require('child_process');
const guard = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../qualification/autonomous-product-program/USAGE-GUARD.json'), 'utf8'));
const authorization = guard.additionalResetAuthorization;
if (!authorization || authorization.authorizedUses !== 1 || authorization.consumedUses !== 0 || !authorization.idempotencyKey) throw new Error('Unused persisted single reset authorization required');
const child = spawn(process.env.DOE_CODEX_EXECUTABLE || 'C:/Users/THINKPAD/AppData/Local/OpenAI/Codex/bin/2e5e00daee91c61d/codex.exe', ['app-server'], {stdio:['pipe','pipe','pipe'],windowsHide:true});
let buffer = '', finished = false;
const send = value => child.stdin.write(JSON.stringify(value)+'\n');
function finish(value, failed=false) { if(finished)return; finished=true; clearTimeout(timeout); console.log(JSON.stringify({observedAt:new Date().toISOString(),idempotencyKey:authorization.idempotencyKey,...value})); if(failed)process.exitCode=1; child.kill(); }
child.stderr.on('data',()=>{});
child.on('error',e=>finish({status:'RESET_OUTCOME_UNCERTAIN',error:e.message},true));
child.on('exit',code=>{if(!finished)finish({status:'RESET_OUTCOME_UNCERTAIN',exitCode:code},true);});
child.stdout.on('data',data=>{ buffer+=data; let i; while((i=buffer.indexOf('\n'))>=0) {const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let m;try{m=JSON.parse(line);}catch{continue;} if(m.id===1){if(m.error){finish({status:'RESET_OUTCOME_UNCERTAIN',error:m.error.message},true);continue;}send({method:'initialized',params:{}});send({method:'account/rateLimitResetCredit/consume',id:2,params:{idempotencyKey:authorization.idempotencyKey}});}if(m.id===2){if(m.error)finish({status:'RESET_OUTCOME_UNCERTAIN',error:m.error.message},true);else finish({status:'RESET_RESPONSE',outcome:m.result?.outcome});}}});
const timeout=setTimeout(()=>finish({status:'RESET_OUTCOME_UNCERTAIN',error:'Timed out; reuse saved key only'},true),20000);
send({method:'initialize',id:1,params:{clientInfo:{name:'digital_opus_authorized_reset',title:'Digital Opus authorized single reset',version:'1.0.0'}}});
