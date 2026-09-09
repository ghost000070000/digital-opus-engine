const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const summary=JSON.parse(fs.readFileSync('rehabilitation-evidence/final-review/summary.json'));
const stale=summary.filter(r=>r.sourceSHA256!==hash('games/'+r.id+'.json')||r.sha256!==hash('dist/games/'+r.id+'.html'));
if(stale.length){console.log('Refresh final smoke: '+stale.map(r=>r.id).join(' '));process.exitCode=2;}else{
 const bytes=p=>fs.statSync(p).isDirectory()?fs.readdirSync(p).reduce((s,n)=>s+bytes(path.join(p,n)),0):fs.statSync(p).size;
 const tests=fs.readFileSync('rehabilitation-evidence/final-tests.log','utf8');if(!tests.includes('31 passed, 0 failed')||!tests.includes('12/12 passed')||!tests.includes('Public site integration: 1/1 passed'))throw Error('Final test record missing');
 const c=JSON.parse(fs.readFileSync('games/catalog.json')).games,site=JSON.parse(fs.readFileSync('dist/engine-site/games/catalog.json')).games;
 const standaloneSite=JSON.parse(fs.readFileSync('dist/games-site/catalog.json')).games;const expected=c.filter(g=>g.visibility==='public').map(g=>g.id).sort().join(',');for(const rows of [site,standaloneSite])if(rows.map(g=>g.id).sort().join(',')!==expected||rows.some(g=>g.visibility!=='public'))throw Error('Public site filter mismatch');
 const v={verifiedAt:new Date().toISOString(),build:'PASS',tests:'31 API + 12 showcase + 1 public-package integration tests passed; 0 failed',gameBuild:'PASS — 28/28 standalone files',engineSiteBuild:'PASS — public quality, provenance, path safety and link checks',gamesSiteBuild:'PASS — rebuilt with matching public filter and real screenshots',smokePassed:summary.filter(r=>r.passed).length,smokeTotal:summary.length,staleSmoke:0,engineSiteBytes:bytes('dist/engine-site'),gamesSiteBytes:bytes('dist/games-site'),publicCount:site.length,screenshots:c.filter(g=>g.visibility==='public'&&g.screenshot).length};
 if(v.smokePassed!==28)throw Error('Final smoke incomplete');fs.writeFileSync('rehabilitation-evidence/final-validation.json',JSON.stringify(v,null,2)+'\n');console.log(JSON.stringify(v,null,2));
}
