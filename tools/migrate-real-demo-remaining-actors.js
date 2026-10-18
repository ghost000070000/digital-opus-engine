'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),policy=require('./real-demo-actor-policy');
const root=path.resolve(__dirname,'..'),apply=process.argv.includes('--apply'),runId='actor-policy-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/real-demo-collision',runId),proof={runId,startedAt:new Date().toISOString(),mode:apply?'APPLY':'PLAN',changes:[]};
fs.mkdirSync(dir,{recursive:true});
for(const id of ['forest-range','arsenal-run','foglight','relic-runner-2','valley-run','iron-arena','sentinel-maze']){
 const file=path.join(root,'games',id+'.json'),bytes=fs.readFileSync(file),project=JSON.parse(bytes),changes=policy.apply(project,id),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(!changes.length)continue;
 proof.changes.push({game:id,beforeSha256:hash,records:changes});
 if(apply){if(!fs.readFileSync(file).equals(bytes))throw new Error('Concurrent canonical edit; preserve it');fs.writeFileSync(path.join(dir,id+'-before.json'),bytes,{flag:'wx'});fs.writeFileSync(file,JSON.stringify(project,null,2)+'\n');}
}
proof.endedAt=new Date().toISOString();proof.fingerprint=require('./real-demo-program-state').fingerprint();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({runId,mode:proof.mode,games:proof.changes.length,records:proof.changes.reduce((n,g)=>n+g.records.length,0),fingerprint:proof.fingerprint}));
