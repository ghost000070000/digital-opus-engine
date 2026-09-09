const fs=require('fs');
const files=['rehabilitation-evidence/root-quality-reviews.json','rehabilitation-evidence/frontier-quality-review.json','rehabilitation-evidence/sample-quality-reviews.json','rehabilitation-evidence/arena-quality-overrides.json','rehabilitation-evidence/health-quality-overrides.json','rehabilitation-evidence/current-screenshot-selections.json'];
const map=new Map();for(const p of files)if(fs.existsSync(p))for(const r of JSON.parse(fs.readFileSync(p)).games)map.set(r.id,{...map.get(r.id),...r});
const games=[...map.values()];if(games.length!==28)throw Error('Expected 28 unique rendered reviews');
const clean=t=>t.replace(/\b(win|won)(?=\d)/gi,'$1 ').replace(/ {2,}/g,' ').replace(/\bat(?=\d)/g,'at ').replace(/\bwith(?=\d)/g,'with ').replace(/\brestored(?=\d)/g,'restored ').replace(/\bread(?=\d)/g,'read ').replace(/(\d)(HP|sim)\b/g,'$1 $2').replace(/requested5–10 minute fantasy flagship/g,'a developed fantasy flagship');
for(const r of games)for(const k of ['notes','remainingGaps']){if(typeof r[k]==='string')r[k]=clean(r[k]);else if(Array.isArray(r[k]))r[k]=r[k].map(clean);}
const c=JSON.parse(fs.readFileSync('games/catalog.json'));games.sort((a,b)=>c.games.findIndex(g=>g.id===a.id)-c.games.findIndex(g=>g.id===b.id));
fs.writeFileSync('rehabilitation-evidence/final-quality-reviews.json',JSON.stringify({generatedAt:new Date().toISOString(),method:'Editorial review of actual standalone frames and recorded normal-input routes. No score is inferred from tests.',games},null,2)+'\n');
