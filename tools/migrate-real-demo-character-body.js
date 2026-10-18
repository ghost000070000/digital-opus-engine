'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{repair}=require('./real-demo-character-body'),{fingerprint}=require('./real-demo-program-state');
const root=path.resolve(__dirname,'..'),game=process.argv.find(a=>a.startsWith('--game='))?.slice(7),apply=process.argv.includes('--apply');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'games/catalog.json'))).games.filter(g=>g.visibility==='public').map(g=>g.id);
if(!game||!catalog.includes(game))throw new Error('An exact public --game= ID is required');
const runId='character-body-migration-'+new Date().toISOString().replace(/[-:.]/g,''),dir=path.join(root,'qualification/real-demo-collision',runId),file=path.join(root,'games',game+'.json');
fs.mkdirSync(dir);const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),before=fs.readFileSync(file,'utf8'),p=JSON.parse(before),startFingerprint=fingerprint(),result=repair(p),after=JSON.stringify(p,null,2)+'\n';
if(result.changes.length){fs.writeFileSync(path.join(dir,game+'.json.before'),before,{flag:'wx'});if(apply){if(hash(fs.readFileSync(file,'utf8'))!==hash(before))throw new Error('Concurrent canonical content changed');fs.writeFileSync(file,after);}}
const proof={runId,game,mode:apply?'APPLY':'PLAN',observedAt:new Date().toISOString(),startFingerprint,finalFingerprint:fingerprint(),beforeHash:hash(before),afterHash:hash(after),...result};
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({runId,game,mode:proof.mode,changes:result.changes.length,skipped:result.skipped,finalFingerprint:proof.finalFingerprint}));
