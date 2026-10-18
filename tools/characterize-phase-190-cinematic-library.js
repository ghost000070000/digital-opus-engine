'use strict';
// Read-only persisted native187 assembly baseline, not a new native acceptance gate.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),source='qualification/phase-187/camera-path-20261012T092536022Z/native-authored.json';
const p=JSON.parse(fs.readFileSync(path.join(root,source))),level=p.levels[0],rail=p.prefabs.find(f=>f.name==='Reusable camera rail');
assert(rail?.records?.some(r=>r.kind==='camera')&&rail.records.some(r=>r.kind==='path'));
const sequence=level.sequences.find(s=>s.steps.some(x=>x.actionType==='playCameraPath'));
assert(sequence,'native authoring retained level-owned cinematic sequence');
const members=new Set(rail.records.map(r=>r.id));
const references=sequence.steps.flatMap((s,i)=>Object.entries(s.params||{}).filter(([k])=>['cameraId','pathId','lookAtTargetId'].includes(k)).map(([key,id])=>({step:i,key,id,inAssembly:members.has(id)})));
const external=references.filter(r=>!r.inAssembly);
assert(external.some(r=>r.key==='lookAtTargetId'&&r.id==='133-target'));
assert(!Object.hasOwn(rail,'sequences'),'this qualified rail Prefab is geometry/Camera/Path only, not an executable cinematic template');
assert(level.objects.some(o=>o.id!==rail.records.find(r=>r.kind==='path').id&&o.kind==='path'),'independent native reused path exists');
const proof={observedAt:new Date().toISOString(),fingerprint:require('./real-demo-program-state').fingerprint(),source,phase:190,title:'Cinematic template library',status:'PERSISTED_NATIVE_ASSEMBLY_BOUNDARY_CHARACTERIZED_NOT_ACCEPTANCE',assemblyMembers:rail.records.map(r=>({id:r.id,kind:r.kind})),levelSequence:{id:sequence.id,steps:sequence.steps.length,references},external,conclusion:'Existing camera settings library and geometry rail Prefab do not package level-owned execution. A complete template must preserve/remap its local Camera/Path/owner trigger references, explicitly refuse or include external look targets, and reuse canonical Sequence runtime. Do not silently call the old rail Prefab an executable template.'};
const dir=path.join(root,'qualification/phase-190','cinematic-baseline-'+new Date().toISOString().replace(/[-:.]/g,''));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:proof.status,dir,external,steps:sequence.steps.length}));
