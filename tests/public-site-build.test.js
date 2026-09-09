// Integration regression: the public CLI must not package internal games or stale files.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'games/catalog.json'))).games;
const built=spawnSync(process.execPath,[path.join(root,'build/build-games-site.js')],{cwd:root,encoding:'utf8'});
assert.equal(built.status,0,built.stderr||built.stdout);
const directory=path.join(root,'dist/games-site'),actual=JSON.parse(fs.readFileSync(path.join(directory,'catalog.json'))).games;
const expected=catalog.filter(g=>g.visibility==='public'&&g.playable!==false);
assert.deepEqual(actual.map(g=>g.id).sort(),expected.map(g=>g.id).sort(),'Public CLI catalog must exactly match public playable source entries');
for(const g of actual){assert.equal(g.visibility,'public');assert.ok(['sample','featured'].includes(g.qualityTier));assert.ok(g.screenshot?.endsWith('.png'),'Public cards require real PNG screenshots');assert.ok(fs.existsSync(path.join(directory,g.screenshot)));assert.ok(fs.existsSync(path.join(directory,g.file)));}
for(const g of catalog.filter(g=>g.visibility==='internal')){assert.equal(fs.existsSync(path.join(directory,g.id+'.html')),false,'Stale internal HTML must not remain in public package');assert.equal(fs.existsSync(path.join(directory,g.file)),false,'Internal source JSON must not be packaged');}
console.log('Public site integration: 1/1 passed ('+actual.length+' public, '+(catalog.length-expected.length)+' internal excluded)');
