'use strict';
// Read-only witness: reconstruct only the AFR-0023 ledger delta in memory.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert');
const raw=fs.readFileSync('authoring-friction.json','utf8'),nl=raw.includes('\r\n')?'\r\n':'\n';
let old=raw.replace('"updatedAt": "2026-10-16"','"updatedAt": "2026-09-23"').replace(/("id": "AFR-0023",\s*"title": "Imported textures cannot be applied from the asset library",\s*"status": )"RESOLVED"/,'$1"CONFIRMED"').replace(/"resolvedInPhase": 240,(\s*"observation": "A successful texture import)/,'"resolvedInPhase": null,$1');
old=old.split(nl).filter(l=>!l.includes('"phase240Impact"')&&!l.includes('"phase240Evidence"')).map(l=>l.includes('"currentWorkaround": "None for assigning an existing Texture')?'      "currentWorkaround": "Switch back to Scene/Inspector, reselect the object if necessary, and choose the texture in Material.",':l).join(nl);
const files=['engine/src','editor/src','build','games'].flatMap(folder=>fs.readdirSync(folder).filter(n=>/\.(js|json|html)$/.test(n)).map(n=>folder+'/'+n)).concat(['editor/index.html','no-code-capabilities.json','authoring-friction.json']).sort(),hash=crypto.createHash('sha256');
for(const file of files){hash.update(file+'\0');hash.update(file==='authoring-friction.json'?old:fs.readFileSync(file));hash.update('\0');}
const inverse=hash.digest('hex');assert.equal(inverse,'472f006ba71f2d17ed679c6110004337defe5294702e027d9fea7d0a29cde24d','Any additional product delta invalidates ledger-only evidence reuse');
console.log(JSON.stringify({current:require('./real-demo-program-state').fingerprint(),inMemoryInverseFrictionHash:inverse,onlyProductDeltaSinceFrozen:'AFR-0023 resolution metadata and ledger updatedAt; no engine/editor/build/game change',filesystemWrites:0}));
