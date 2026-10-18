'use strict';
// Bounded mechanical JSON migration: preserve authored explicit shapes and all
// other fields. Opt imported public solid props into existing box fields only.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),gamesRoot=path.join(root,'games'),apply=process.argv.includes('--apply');
const structuralWalls=process.argv.includes('--structural-walls');
const structuralPillars=process.argv.includes('--structural-pillars');
const computerBanks=process.argv.includes('--computer-banks');
const physicalCover=process.argv.includes('--physical-cover');
const newSolidRoles=structuralWalls||structuralPillars||computerBanks||physicalCover;
if([structuralWalls,structuralPillars,computerBanks,physicalCover].filter(Boolean).length>1)throw new Error('Select one explicit role migration at a time');
const targetAssets=physicalCover?['showcase-support-column','showcase-crate','showcase-barricade']:[computerBanks?'showcase-computer-bank':structuralPillars?'showcase-pillar':'showcase-wall-panel'];
const catalog=JSON.parse(fs.readFileSync(path.join(gamesRoot,'catalog.json'))).games.filter(g=>g.visibility==='public');
const stamp=new Date().toISOString().replace(/[-:.]/g,''),out=path.join(root,'qualification/real-demo-collision','mesh-migration-'+stamp);
fs.mkdirSync(out,{recursive:true});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const report={observedAt:new Date().toISOString(),mode:apply?'APPLY':'PLAN',beforeFingerprint:require('./real-demo-program-state').fingerprint(),changes:[],skipped:[],files:[]};
for(const game of catalog){
  if(path.basename(game.file)!==game.file||!game.file.endsWith('.json'))throw new Error('Unsafe catalog source path');
  const file=path.resolve(gamesRoot,game.file);if(!file.startsWith(gamesRoot+path.sep))throw new Error('Outside named games directory');
  const original=fs.readFileSync(file,'utf8'),project=JSON.parse(original),assets=new Map((project.assets||[]).map(a=>[a.id,a])),start=report.changes.length;
  for(const level of project.levels)for(const item of level.objects){
    if(item.kind!=='cube'||!item.assetId)continue;
    if(newSolidRoles?!targetAssets.includes(item.assetId)||item.solid===true:!item.solid)continue;
    const asset=assets.get(item.assetId);if(!asset?.positions?.length)continue;
    const reason=item.collider?'AUTHORED_COLLIDER_PRESERVED':item.parentId?'PARENTED_REQUIRES_WORLD_REVIEW':item.isRamp?'RAMP_SURFACE_PRESERVED':item.spin?'SPIN_REQUIRES_DYNAMIC_REVIEW':item.quaternion?'FULL_QUATERNION_REQUIRES_REVIEW':null;
    if(reason){report.skipped.push({game:game.id,object:item.id,reason});continue;}
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<asset.positions.length;i++){const a=i%3;min[a]=Math.min(min[a],asset.positions[i]);max[a]=Math.max(max[a],asset.positions[i]);}
    if(!min.some((v,i)=>Math.abs(v+.5)>.05||Math.abs(max[i]-.5)>.05))continue;
    const scale=item.scale||[1,1,1];if(scale.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Review nonpositive scale before migration');
    const size=min.map((v,i)=>(max[i]-v)*scale[i]),center=min.map((v,i)=>(max[i]+v)*scale[i]/2);
    if(size.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Invalid measured mesh box');
    const yaw=item.rotationY||0,c=Math.cos(yaw),s=Math.sin(yaw);
    const offset={x:center[0]*c+center[2]*s,y:center[1],z:-center[0]*s+center[2]*c};
    const collider={shape:'box',size:{x:size[0],y:size[1],z:size[2]},offset};
    report.changes.push({game:game.id,level:level.id,object:item.id,name:item.name||null,asset:item.assetId,meshBounds:{min,max},collider,...(newSolidRoles?{beforeSolid:item.solid??false,afterSolid:true,reason:physicalCover?'Structural support/physical cover has decorative pass-through default; native entry reproduced in Relay, Iron Arena and Survival Arena 2':computerBanks?'Substantial rendered cabinet walkthrough reproduced with native input in Signal Relay; not intentional foliage or trigger':structuralPillars?'Rendered stone pillar lacks solid metadata; native centreline entry reproduced in NPC Puzzle Adventure':'Rendered architectural wall panel lacks solid metadata; native wall-entry reproduced in Signal Zero and Assembly Line'}:{})});item.collider=collider;if(newSolidRoles)item.solid=true;
  }
  if(report.changes.length>start){
    const updated=JSON.stringify(project,null,2)+'\n';
    report.files.push({game:game.id,file:game.file,beforeHash:hash(original),afterHash:hash(updated),objects:report.changes.length-start});
    // Preserve exact preexisting dirty content before the mechanical update.
    fs.writeFileSync(path.join(out,game.file+'.before'),original);
    if(apply){if(hash(fs.readFileSync(file,'utf8'))!==hash(original))throw new Error('Concurrent content change detected');fs.writeFileSync(file,updated);}
  }
}
report.afterFingerprint=require('./real-demo-program-state').fingerprint();
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mode:report.mode,changedGames:report.files.length,changedObjects:report.changes.length,skipped:report.skipped.length,evidence:path.relative(root,out)}));
