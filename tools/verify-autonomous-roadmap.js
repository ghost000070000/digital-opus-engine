'use strict';
// Read-only: exact master titles and tracker identities must not drift.
const fs=require('fs'),path=require('path'),assert=require('assert');
const base=path.resolve(__dirname,'../qualification/autonomous-product-program');
const roadmap=JSON.parse(fs.readFileSync(path.join(base,'authoritative-roadmap.json')));
const text=fs.readFileSync(path.join(base,'EXACT-240-PHASE-ROADMAP.md'),'utf8');
const lines=text.split(/\r?\n/).filter(l=>/^Phase \d{3} — /.test(l));
const tracker=JSON.parse(fs.readFileSync(path.join(base,'authoritative-tracker-verified.json'))).values;
assert.equal(lines.length,240);assert.equal(roadmap.phases.length,240);assert.equal(tracker.length,241);
const differences=[];
for(let i=0;i<240;i++){
 const n=i+1,p=roadmap.phases[i],row=tracker[n];
 assert.equal(p.phase,n);assert.equal(Number(row[0]),n);
 assert.equal(lines[i],`Phase ${String(n).padStart(3,'0')} — ${p.title}`);
 assert.equal(row[1],`Epoch ${String(Math.ceil(n/10)).padStart(2,'0')}`);
 assert(['PLANNED','IN PROGRESS','COMPLETED','BLOCKED','DEFERRED'].includes(row[4]));
 if(p.title!==row[3])differences.push({phase:n,original:p.title,implementation:row[3]});
}
assert.deepEqual(differences.map(d=>d.phase),[2,3],'Unexpected master/tracker title difference: reconcile explicitly, never silently normalize');
console.log(JSON.stringify({status:'EXACT_ROADMAP_MIRROR_PASS',phases:240,epochs:24,implementationTitleDifferences:differences,trackerCounts:tracker.slice(1).reduce((a,r)=>(a[r[4]]=(a[r[4]]||0)+1,a),{})},null,2));
