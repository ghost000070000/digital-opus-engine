'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{repair}=require('./real-demo-masonry-assembly');
const root=path.resolve(__dirname,'..'),gameRoot=path.join(root,'games'),apply=process.argv.includes('--apply');
const out=path.join(root,'qualification/real-demo-collision','masonry-migration-'+new Date().toISOString().replace(/[-:.]/g,''));fs.mkdirSync(out,{recursive:true});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),report={mode:apply?'APPLY':'PLAN',observedAt:new Date().toISOString(),beforeFingerprint:require('./real-demo-program-state').fingerprint(),games:[],skipped:[]};
for(const game of JSON.parse(fs.readFileSync(path.join(gameRoot,'catalog.json'))).games.filter(g=>g.visibility==='public')){
  if(path.basename(game.file)!==game.file||!game.file.endsWith('.json'))throw new Error('Unsafe catalog path');
  const file=path.join(gameRoot,game.file),original=fs.readFileSync(file,'utf8'),project=JSON.parse(original),result=repair(project);
  report.skipped.push(...result.skipped.map(s=>({game:game.id,...s})));if(!result.changes.length&&!result.provenanceUpdates.length)continue;
  const updated=JSON.stringify(project,null,2)+'\n';fs.writeFileSync(path.join(out,game.file+'.before'),original);
  report.games.push({id:game.id,beforeHash:hash(original),afterHash:hash(updated),changes:result.changes,provenanceUpdates:result.provenanceUpdates});
  if(apply){if(hash(fs.readFileSync(file,'utf8'))!==hash(original))throw new Error('Concurrent content changed');fs.writeFileSync(file,updated);}
}
report.afterFingerprint=require('./real-demo-program-state').fingerprint();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mode:report.mode,games:report.games.length,assemblies:report.games.reduce((n,g)=>n+g.changes.length,0),parts:report.games.flatMap(g=>g.changes).reduce((n,c)=>n+c.parts,0),skipped:report.skipped.length,evidence:path.relative(root,out)}));
