const fs=require('fs');const p='games/foglight.json';const j=JSON.parse(fs.readFileSync(p));const l=j.levels[0];
const k=l.objects.find(o=>o.name==='ValeKeyPickup');k.scale=[.65,.65,.65];
const graph=l.objects.find(o=>o.name==='SanctuaryWin').behaviors[0].graph;if(!graph.nodes.some(n=>n.id==='key')){graph.nodes.push({id:'key',type:'hasItem',name:'Vale Key',count:1});graph.edges.push({kind:'gate',from:'key',to:'w'});}
fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
const hp='tools/playtest-adventures.js';let h=fs.readFileSync(hp,'utf8').replace("[-8.6,21.9],'Vale key',40,.65","[-9,22],'Vale key',40,.18");fs.writeFileSync(hp,h);
