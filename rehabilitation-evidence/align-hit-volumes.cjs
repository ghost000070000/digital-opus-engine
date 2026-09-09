const fs=require('fs');
for(const id of ['foglight','signal-relay','arsenal-run','silent-sector','relic-frontier']){
 const f='games/'+id+'.json',p=JSON.parse(fs.readFileSync(f));
 for(const l of p.levels)for(const o of l.objects){if(!o.ai)continue;const guardian=o.assetId==='showcase-guardian';o.collider={shape:'sphere',offset:{x:0,y:guardian?1.05*(o.scale?.[1]||1):0,z:0},radius:guardian?1.1*(o.scale?.[1]||1):.75};}
 fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n');
}
console.log('Authored enemy hit volumes aligned with the original silhouettes.');
