const fs=require('fs');
for(const id of ['signal-relay','arsenal-run']){
const file='games/'+id+'.json',p=JSON.parse(fs.readFileSync(file)),kit=require('../tools/showcase-assets');
kit.install(p,{meshes:['projectile']});
for(const pf of p.prefabs||[])if(/Bolt/.test(pf.name)){Object.assign(pf.record,{mesh:'asset',assetId:'showcase-projectile',textureAssetId:'showcase-palette',scale:[.32,.32,.32],color:[1,1,1],unlit:true});}
fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
}
const file='tools/rehabilitate-flagships.js';let s=fs.readFileSync(file,'utf8');
const needle='  // Every referenced public texture/audio asset is traceable to the original kit.';
s=s.replace(needle,`  if(['signal-relay','arsenal-run'].includes(id)){kit.install(project,{meshes:['projectile']});for(const pf of project.prefabs||[])if(/Bolt/.test(pf.name))Object.assign(pf.record,{mesh:'asset',assetId:'showcase-projectile',textureAssetId:'showcase-palette',scale:[.32,.32,.32],color:[1,1,1],unlit:true});}
`+needle);fs.writeFileSync(file,s);
for(const id of ['power-grid','foglight']){const src='rehabilitation-evidence/playthroughs/'+id,dst=src+'-attempt1';if(fs.existsSync(src)&&!fs.existsSync(dst))fs.cpSync(src,dst,{recursive:true});}
