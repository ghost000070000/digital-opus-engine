const fs=require('fs');
const file='games/foglight.json',p=JSON.parse(fs.readFileSync(file)),l=p.levels[0];
for(const r of l.objects){
 if(r.solid&&r.mesh==='cube'&&r.scale&&r.scale[1]<=.5){r.position[1]=.08;r.scale[1]=.32;}
 if(/^Foglight[123]$/.test(r.name||''))r.position[1]=.24;
 if(r.name==='MistGuardian'){r.behaviors.find(b=>b.action==='damagePlayer').params={amount:6,cooldown:1.5};r.position=[-8,.24,21];r.ai.states.find(s=>s.name==='chase').movement.speed=2.8;}
}
fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
// Retain refinements in the reproducible authoring script.
const s='tools/rehabilitate-flagships.js';let text=fs.readFileSync(s,'utf8');
const marker='    // Keep the opening causeway in view, with low ruins framing the walkable edge.';
text=text.replace(marker,`    for(const r of level.objects){
      if(r.solid&&r.mesh==='cube'&&r.scale&&r.scale[1]<=.5){r.position[1]=.08;r.scale[1]=.32;}
      if(/^Foglight[123]$/.test(r.name||''))r.position[1]=.24;
      if(r.name==='MistGuardian'){r.behaviors.find(b=>b.action==='damagePlayer').params={amount:6,cooldown:1.5};r.position=[-8,.24,21];r.ai.states.find(s=>s.name==='chase').movement.speed=2.8;}
    }
`+marker);
fs.writeFileSync(s,text);
console.log('Foglight floor heights and guardian pacing refined.');
