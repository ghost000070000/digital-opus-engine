const fs=require('fs');
const p='games/foglight.json',j=JSON.parse(fs.readFileSync(p));
j.levels[0].playerSettings.playBounds={minX:-18,maxX:18,minZ:-4,maxZ:88};
const guard=j.levels[0].objects.find(o=>o.name==='MistGuardian');guard.scale=[.85,.85,.85];guard.collider={shape:'sphere',offset:{x:0,y:.8925,z:0},radius:.935};
fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
const gp='tools/rehabilitate-flagships.js';let g=fs.readFileSync(gp,'utf8');const marker='  fs.writeFileSync(path.join(ROOT,\'games\',id+\'.json\')';const pos=g.indexOf(marker);if(pos<0)throw Error('marker');if(!g.includes('Final authored traversal bounds'))g=g.slice(0,pos)+`  // Final authored traversal bounds and combat targets follow their visible models.\n  for(const level of project.levels){\n    if(id==='foglight'){level.playerSettings.playBounds={minX:-18,maxX:18,minZ:-4,maxZ:88};const guard=level.objects.find(o=>o.name==='MistGuardian');if(guard)guard.scale=[.85,.85,.85];}\n    for(const o of level.objects){if(!(o.tags||[]).includes('enemy'))continue;if(o.assetId==='showcase-guardian'){const sy=Number(o.scale?.[1])||1;o.collider={shape:'sphere',offset:{x:0,y:1.05*sy,z:0},radius:1.1*sy};}else if(o.assetId==='showcase-drone')o.collider={shape:'sphere',offset:{x:0,y:0,z:0},radius:.75};}\n  }\n`+g.slice(pos);fs.writeFileSync(gp,g);
const hp='tools/playtest-adventures.js';let h=fs.readFileSync(hp,'utf8').replace('Math.min(420,Math.max(80,dist/6*650))','Math.min(240,Math.max(65,dist/6*650))');
h=h.replace("await walk([0,18.9],'First beacon',65)","await walk([0,20],'First beacon',65,.3)").replace("await walk([0,39.9],'Second beacon',60)","await walk([0,41],'Second beacon',60,.3)").replace("await walk([0,65.9],'Third beacon',70)","await walk([0,67],'Third beacon',70,.3)");
h=h.replace("[[-22,-6],[-12,-6],[-6,-6],[1,-6],[4,-6],[12,-5]]","[[-22,-8],[-12,-8],[-6,-8],[1,-8],[4,-8],[12,-8]]");
h=h.replace("await walk([14,-3],'Data Core',30,.4)","await page.keyboard.up('c');await walk([14,-3],'Data Core',30,.4)");
fs.writeFileSync(hp,h);
for(const id of ['foglight','silent-sector']){const d='rehabilitation-evidence/playthroughs/'+id;if(fs.existsSync(d))fs.cpSync(d,d+'-attempt2',{recursive:true});}
