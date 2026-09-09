'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'..'),rel=p=>path.relative(ROOT,p).replace(/\\/g,'/');
const catalogPath=path.join(ROOT,'games','catalog.json'),catalog=JSON.parse(fs.readFileSync(catalogPath));
const order=['forest-range','arsenal-run','power-grid','moving-temple','foglight','relic-frontier','relic-island','npc-puzzle-adventure','relic-runner-2','valley-run','painted-wilds','textured-adventure','temple-switch-puzzle','signal-relay','silent-sector','iron-arena','opus-arena','power-station','assembly-line','blacksite','shifting-facility','signal-zero','dungeon-descent','sentinel-maze','survival-arena','survival-arena-2','survival-arena-3','skyway-trial'];
const C=id=>path.join(ROOT,'rehabilitation-evidence','public-v5-candidates',id),F=id=>path.join(ROOT,'rehabilitation-evidence','public-v5-fixed-2',id),S=id=>path.join(ROOT,'rehabilitation-evidence','public-v5-survival2-final',id),T=id=>path.join(ROOT,'rehabilitation-evidence','public-v5-targeted',id),P=id=>path.join(ROOT,'rehabilitation-evidence','playthroughs',id);
const picks={
 'forest-range':[C('forest-range')+'/opening.png',C('forest-range')+'/gameplay.png',C('forest-range')+'/highlight.png'],
 'arsenal-run':[C('arsenal-run')+'/opening.png',C('arsenal-run')+'/gameplay.png',C('arsenal-run')+'/highlight.png'],
 'power-grid':[P('power-grid')+'/opening.png',P('power-grid')+'/generator.png',P('power-grid')+'/gate.png'],
 'moving-temple':[C('moving-temple')+'/opening.png',C('moving-temple')+'/gameplay.png',C('moving-temple')+'/highlight.png'],
 'foglight':[C('foglight')+'/opening.png',C('foglight')+'/gameplay.png'],
 'signal-relay':[C('signal-relay')+'/opening.png',C('signal-relay')+'/gameplay.png'],
 'silent-sector':[C('silent-sector')+'/opening.png',C('silent-sector')+'/highlight.png'],
 'relic-frontier':[T('relic-frontier')+'/combat-court.png',T('relic-frontier')+'/weapon-approach.png'],
 'relic-island':[C('relic-island')+'/opening.png',C('relic-island')+'/highlight.png'],
 'iron-arena':[C('iron-arena')+'/opening.png',C('iron-arena')+'/gameplay.png'],
 'dungeon-descent':[C('dungeon-descent')+'/opening.png',C('dungeon-descent')+'/gameplay.png'],
 'npc-puzzle-adventure':[T('npc-puzzle-adventure')+'/opening.png',T('npc-puzzle-adventure')+'/approach.png'],
 'opus-arena':[C('opus-arena')+'/opening.png',C('opus-arena')+'/gameplay.png'],
 'power-station':[T('power-station')+'/detail.png',T('power-station')+'/opening.png'],
 'relic-runner-2':[C('relic-runner-2')+'/opening.png',C('relic-runner-2')+'/gameplay.png'],
 'sentinel-maze':[C('sentinel-maze')+'/opening.png',C('sentinel-maze')+'/highlight.png'],
 'signal-zero':[T('signal-zero')+'/level-1-relay.png',T('signal-zero')+'/level-2-opening.png'],
 'survival-arena-2':[S('survival-arena-2')+'/opening.png',T('survival-arena-2')+'/storm-circuit.png'],
 'survival-arena-3':[C('survival-arena-3')+'/opening.png',C('survival-arena-3')+'/gameplay.png'],
 'textured-adventure':[C('textured-adventure')+'/opening.png',C('textured-adventure')+'/highlight.png'],
 'valley-run':[F('valley-run')+'/opening.png',T('valley-run')+'/route-depth.png'],
 'painted-wilds':[C('painted-wilds')+'/opening.png',C('painted-wilds')+'/gameplay.png'],
 'assembly-line':[T('assembly-line')+'/opening.png',T('assembly-line')+'/detail.png'],
 'blacksite':[C('blacksite')+'/opening.png',C('blacksite')+'/gameplay.png'],
 'shifting-facility':[C('shifting-facility')+'/opening.png',C('shifting-facility')+'/highlight.png'],
 'skyway-trial':[T('skyway-trial')+'/opening.png',T('skyway-trial')+'/detail.png'],
 'survival-arena':[C('survival-arena')+'/opening.png',C('survival-arena')+'/highlight.png'],
 'temple-switch-puzzle':[C('temple-switch-puzzle')+'/opening.png',C('temple-switch-puzzle')+'/gameplay.png']
};
const byId=Object.fromEntries(catalog.games.map(g=>[g.id,g]));
if(order.length!==28||new Set(order).size!==28)throw Error('Invalid public order');
catalog.games=order.map(id=>{const g=byId[id];if(!g)throw Error('Missing '+id);g.tags=(g.tags||[]).filter(t=>!/regression|dogfood|fixture|torture/i.test(t));const featured=g.qualityTier==='featured';g.featured=featured;g.visibility='public';g.category=featured?'featured':'sample';g.screenshot=`public-showcase-review/${id}/gameplay.png`;g.screenshots={opening:`public-showcase-review/${id}/opening.png`,gameplay:g.screenshot,...(featured?{highlight:`public-showcase-review/${id}/highlight.png`}:{})};return g;});
fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');
const out=path.join(ROOT,'public-showcase-review-v5'),pub=path.join(ROOT,'public-showcase-review');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(pub,{recursive:true});
const records=[];
async function copy(id,role,src,dest,publicAsset){if(!fs.existsSync(src))throw Error(`Missing ${id} ${role}: ${src}`);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);const m=await sharp(src).metadata(),stat=fs.statSync(src);records.push({id,role,purpose:role==='opening'?'Public opening composition':role==='gameplay'?'Public gameplay evidence':'Featured public highlight',sourceStandalone:`dist/games/${id}.html`,sourceCapture:rel(src),capturedAt:stat.mtime.toISOString(),sha256:crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex'),dimensions:{width:m.width,height:m.height},destination:rel(publicAsset)});fs.mkdirSync(path.dirname(publicAsset),{recursive:true});fs.copyFileSync(src,publicAsset);}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
 for(const g of catalog.games){const id=g.id,dir=path.join(out,id),pd=path.join(pub,id);fs.mkdirSync(dir,{recursive:true});const v4=path.join(ROOT,'public-showcase-review-v4',id,'current.png');if(!fs.existsSync(v4))throw Error('Missing V4 '+id);fs.copyFileSync(v4,path.join(dir,'v4.png'));const roles=g.qualityTier==='featured'?['opening','gameplay','highlight']:['opening','gameplay'];if(picks[id].length!==roles.length)throw Error('Bad pick count '+id);for(let i=0;i<roles.length;i++)await copy(id,roles[i],picks[id][i],path.join(dir,roles[i]+'.png'),path.join(pd,roles[i]+'.png'));}
 fs.writeFileSync(path.join(pub,'screenshot-provenance.json'),JSON.stringify({version:'V5',generatedAt:new Date().toISOString(),count:records.length,records},null,2)+'\n');
 fs.writeFileSync(path.join(out,'screenshot-provenance.json'),JSON.stringify(records,null,2)+'\n');
 const keys=['visual','gameplayClarity','levelComposition','audio','presentation','uniqueness'];
 const cards=catalog.games.map(g=>{const role=g.qualityTier,s=keys.map(k=>`${k.replace('gameplayClarity','clarity').replace('levelComposition','layout')} ${g.qualityReview[k]}`).join(' · '),imgs=[['v4','V4 REFERENCE'],['opening','V5 OPENING'],['gameplay','V5 GAMEPLAY'],...(role==='featured'?[['highlight','V5 HIGHLIGHT']]:[])];return `<article class="card ${role}" data-role="${role}"><header><span>${role.toUpperCase()}</span><h2>${esc(g.title)}</h2><p>${esc(s)}</p></header><div class="shots">${imgs.map(([f,l])=>`<figure><img src="${g.id}/${f}.png" alt="${esc(g.title)} ${l}"><figcaption>${l}</figcaption></figure>`).join('')}</div><div class="copy"><p><strong>What it is:</strong> ${esc(g.description)}</p><p><strong>Engine capability:</strong> ${esc(g.purpose)}</p><p><strong>Remaining weakness:</strong> ${esc(g.qualityReview.remainingGaps||'None identified')}</p><a href="../dist/games/${g.id}.html">Play standalone</a></div></article>`;}).join('\n');
 const counts={featured:catalog.games.filter(g=>g.qualityTier==='featured').length,sample:catalog.games.filter(g=>g.qualityTier==='sample').length};
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Digital Opus Engine — Public Showcase Review V5</title><style>*{box-sizing:border-box}body{margin:0;background:#08101a;color:#edf5ff;font:15px/1.5 system-ui}main{max-width:1500px;margin:auto;padding:32px}h1{font-size:clamp(30px,5vw,64px);margin:.1em 0}nav{display:flex;gap:8px;position:sticky;top:0;background:#08101aee;padding:14px 0;z-index:3}button{background:#14263b;color:white;border:1px solid #37506c;padding:10px 14px;border-radius:999px}.card{border:1px solid #243952;background:#0d1826;margin:24px 0;border-radius:18px;overflow:hidden}.card header,.copy{padding:18px}.card header span{color:#62e6d1;font-weight:800}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:3px;background:#23364b}.shots figure{margin:0;background:#060b12}.shots img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.shots figcaption{padding:8px 12px;color:#aebed0;font-size:12px}a{color:#62e6d1}.hidden{display:none}</style></head><body><main><p>FINAL PUBLIC PRESENTATION QA</p><h1>28-Game Review V5</h1><p>${counts.featured} Featured · ${counts.sample} Samples · 60 new public frames · 28 V4 references</p><nav><button data-filter="all">All 28</button><button data-filter="featured">Featured ${counts.featured}</button><button data-filter="sample">Samples ${counts.sample}</button></nav>${cards}</main><script>document.querySelectorAll('button').forEach(b=>b.onclick=()=>document.querySelectorAll('.card').forEach(c=>c.classList.toggle('hidden',b.dataset.filter!=='all'&&!c.classList.contains(b.dataset.filter))))</script></body></html>`;
 fs.writeFileSync(path.join(out,'index.html'),html);console.log(`Finalized V5: ${catalog.games.length} games, ${records.length} new frames, ${counts.featured} Featured, ${counts.sample} Samples.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
