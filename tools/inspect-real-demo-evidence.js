'use strict';
// Read-only compact proof inspection, never a qualification verdict writer.
const fs=require('fs'),path=require('path'),base=path.resolve(__dirname,'../qualification/real-demo-collision');
const id=process.argv[2]||fs.readdirSync(base).filter(n=>n.startsWith('probe-')).sort().at(-1);
if(path.basename(id)!==id)throw new Error('Use a single evidence run identity');
const r=JSON.parse(fs.readFileSync(path.join(base,id,'results.json')));
console.log(JSON.stringify({run:r.runId,fingerprint:r.fingerprint,games:r.games.map(g=>({id:g.id,status:g.status,inputAttempts:g.inputAttempts,wall:g.wallRoute?.status,corner:g.corner?.status,restart:g.restart?.status,
 route:g.authoredObjectRoute&&{status:g.authoredObjectRoute.status,target:g.authoredObjectRoute.target.id,bodyEntry:g.authoredObjectRoute.bodyEntry,bodyExit:g.authoredObjectRoute.bodyExit,targetContacts:g.authoredObjectRoute.targetContacts},
 waypoints:g.nativeWaypoints?.map(w=>({target:w.target,status:w.status,last:w.steps.at(-1)?.after,interaction:w.interaction&&{id:w.interaction.id,held:w.interaction.after.heldObject,states:w.interaction.after.interactableState,gate:w.interaction.after.solids.find(s=>s.id==='obj1007')?.position}})),
 contacts:g.final?.metrics.contactsByTarget,groundedTargets:[...new Set((g.final?.metrics.verticalContacts||[]).filter(c=>c.grounded).map(c=>c.target))],
 independentEntries:g.final?.metrics.independentWallPenetrations,actorEntries:g.final?.metrics.aiSolidEntries,platforms:g.platformRoutes?.map(p=>({id:p.id,status:p.status})),errors:g.errors,consoleErrors:g.consoleErrors,externalRequests:g.externalRequests}))},null,2));
