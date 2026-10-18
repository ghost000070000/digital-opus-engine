'use strict';
// Read-only summary. Observations are not promoted into final acceptance here.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'qualification/real-demo-collision');
const expected=require('./real-demo-program-state').fingerprint();
const requested=process.argv.slice(2);
for(const name of (requested.length?requested:fs.readdirSync(dir).filter(n=>n.startsWith('probe-')))){
  const file=path.join(dir,name,'results.json');if(!fs.existsSync(file))continue;
  const run=JSON.parse(fs.readFileSync(file));if(!requested.length&&run.fingerprint!==expected)continue;
  console.log(JSON.stringify({runId:run.runId,tier:run.tier,fingerprint:run.fingerprint,complete:!!run.endedAt,games:run.games.map(g=>{
    const m=g.final?.metrics||{},frames=m.frames||[],terrain=frames.filter(f=>f.terrainHeight!==null&&f.terrainHeight!==undefined);
    return {id:g.id,started:!!g.start?.player,driven:!!g.movementObserved,inputAttempts:g.inputAttempts,
      wall:g.wallRoute?.status,wallTarget:g.wallRoute?.target?.id,wallContacts:g.wallRoute?.contactCount,
      corner:g.corner?.status,platforms:g.platformRoutes?.map(p=>({target:p.target,status:p.status,carry:p.carryEvents?.length||0})),
      levelTransition:g.progression?.status,restart:g.restart?.status,
      independentChecks:m.independentWallChecks??null,independentPenetrations:m.independentWallPenetrations?.map(p=>({target:p.target,name:p.name,gap:p.gap,sim:p.sim}))??null,
      verticalGroundedContacts:(m.verticalContacts||[]).filter(c=>c.grounded).length,
      terrainFrames:terrain.length,terrainOriginGap:terrain.length?{min:Math.min(...terrain.map(f=>f.after.y-f.terrainHeight)),max:Math.max(...terrain.map(f=>f.after.y-f.terrainHeight))}:null,
      aiEntries:[...new Set((m.aiSolidEntries||[]).map(e=>e.name||e.wall))],
      browserErrors:g.errors,consoleErrors:g.consoleErrors,externalRequests:g.externalRequests,instrumentationErrors:m.instrumentationErrors,failure:g.failure||null};
  })}));
}
