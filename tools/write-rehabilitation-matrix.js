'use strict';
// Matrix assembly only: mechanical data never supplies visual scores or promotion.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const readJSON = (file, fallback) => fs.existsSync(path.join(ROOT, file)) ? JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\uFEFF/, '')) : fallback;
const inventory = readJSON('rehabilitation-evidence/inventory.json', null);
if (!inventory || !Array.isArray(inventory.games) || inventory.games.length !== 28) throw new Error('Refresh the complete inventory with node tools/inventory-rehabilitation.js first.');
const catalog = readJSON('games/catalog.json', { games: [] });
const sampleChanges = readJSON('rehabilitation-evidence/sample-changes.json', []);
const reviewSource = readJSON('rehabilitation-evidence/final-quality-reviews.json', {});
const rawReviews = reviewSource.games || reviewSource.reviews || reviewSource;
const reviews = Array.isArray(rawReviews) ? Object.fromEntries(rawReviews.map(review => [review.id, review])) : rawReviews;
const sampleById = Object.fromEntries(sampleChanges.map(change => [change.id, change]));
const catalogById = Object.fromEntries(catalog.games.map(entry => [entry.id, entry]));
const flagshipPurpose = {
  foglight: 'Third-person beacon progression, guardian avoidance, inventory gates and sanctuary exploration',
  'signal-relay': 'First-person relay restoration, stealth perception, combat and extraction',
  'arsenal-run': 'Equipment weapon switching, ammunition/reload, ranged enemies and gated extraction',
  'silent-sector': 'Stealth perception and hearing, cover, camera-path introduction and linked objectives',
  'power-grid': 'Carry-and-socket interaction, conditional coolant switches, persistent gate and audio/fog zones',
  'relic-frontier': 'Animated third-person equipment combat, guardian objectives and relic-gated extraction',
  'relic-island': 'Compact terrain exploration, three pickups, inventory key and a shrine finish',
};
const fields = [['visual','visualQuality'],['gameplayClarity','clarity','gameplay'],['levelComposition','composition'],['audio'],['presentation','uiPresentation','ui'],['uniqueness']];
const esc = value => String(value == null ? '—' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const pair = (before, after) => esc(before) + ' → ' + esc(after);
const list = values => values && values.length ? (Array.isArray(values) ? values : [values]).map(esc).join('; ') : 'None recorded';
function score(review, phase, aliases) {
  const data = phase === 'before' ? (review.before || review.beforeScores || review.baselineScores || {}) : (review.after || review.afterScores || review.scores || review.qualityReview || {});
  for (const key of aliases) if (typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 1 && data[key] <= 5) return data[key] + '/5';
  return 'Pending';
}
function roleOf(review) {
  const raw = String(review.finalRole || review.role || review.qualityTier || '').toUpperCase();
  if (['FEATURED','PUBLIC_FEATURED'].includes(raw)) return 'FEATURED';
  if (['SAMPLE','PUBLIC_SAMPLE'].includes(raw)) return 'SAMPLE';
  if (['INTERNAL','INTERNAL_ONLY','INTERNAL_REGRESSION'].includes(raw)) return 'INTERNAL';
  return null;
}
function recommendation(review) {
  const allowed = ['FEATURED_CANDIDATE','PUBLIC_SAMPLE_CANDIDATE','INTERNAL_ONLY_UNTIL_REBUILT'];
  if (allowed.includes(review.recommendedFinalRole)) return review.recommendedFinalRole;
  return { FEATURED:allowed[0], SAMPLE:allowed[1], INTERNAL:allowed[2] }[roleOf(review)] || 'PENDING_RENDERED_REVIEW';
}
function structuralDifficulty(game) {
  const b=game.baseline, signals=[];
  const paths=b.levels.reduce((sum,level)=>sum+level.camera.pathObjects,0);
  if(b.levelCount>1)signals.push(b.levelCount+' levels');
  if(b.objectCount>=60)signals.push(b.objectCount+' existing objects');
  if(b.knownFixtureAssets.length)signals.push('fixture replacement');
  if(paths)signals.push('path/camera dependencies');
  if(b.saveContinue.saveGameAuthored||b.saveContinue.loadGameAuthored)signals.push('save/load dependencies');
  if(b.prefabCount>=3)signals.push(b.prefabCount+' prefabs');
  return (signals.length>=3?'High':signals.length?'Medium':'Low')+' structural workload ('+(signals.length?signals.join(', '):'one compact level with few structural dependencies')+')';
}
function publicPotential(game,review) {
  if(review.publicPotential)return review.publicPotential;
  const role=roleOf(review);
  if(role)return {FEATURED:'Reviewed showcase candidate; use the recorded review and remaining gaps below.',SAMPLE:'Reviewed focused sample; use the recorded review and remaining gaps below.',INTERNAL:'Technical value retained internally; see remaining gaps.'}[role];
  return 'Pending visual review; the authored capability can support a '+(flagshipPurpose[game.id]?'coherent showcase or focused sample':'focused sample')+' if its rendered result passes the quality gate.';
}
function screenshots(review) {
  const value=review.screenshots||(review.evidence&&review.evidence.screenshots);
  if(Array.isArray(value))return value.map(item=>typeof item==='string'?item:item.path||item.file||'').filter(Boolean);
  if(value&&typeof value==='object')return Object.values(value).filter(item=>typeof item==='string');
  return [];
}
function auditEvidence(id) {
  const paths=['rehabilitation-evidence/baseline/'+id+'/audit.json','rehabilitation-evidence/after-a/'+id+'/audit.json','rehabilitation-evidence/after-bc-final/'+id+'/audit.json','rehabilitation-evidence/after-bc/'+id+'/audit.json','rehabilitation-evidence/playthroughs/'+id+'/playtest.json'].filter(file=>fs.existsSync(path.join(ROOT,file)));
  const dir=path.join(ROOT,'rehabilitation-evidence/combat-playtest');
  if(fs.existsSync(dir))for(const folder of fs.readdirSync(dir))if(folder.startsWith(id+'-')&&fs.existsSync(path.join(dir,folder,'playtest.json')))paths.push('rehabilitation-evidence/combat-playtest/'+folder+'/playtest.json');
  return paths;
}
const scoredCount=inventory.games.filter(game=>roleOf(reviews[game.id]||{})).length;
const rows=['# Game Rehabilitation Matrix','',
  'Generated from the preserved baseline and current mechanical inventory. Inventory timestamp: '+esc(inventory.generatedAt)+'.','',
  '**Review status:** '+scoredCount+'/28 final roles supplied by rendered-review evidence. '+(scoredCount<28?'Unprovided scores and recommended roles remain explicitly pending. No game is promoted by this generator.':'All final roles below come from supplied rendered-review records.'),'',
  'Original category records the historical catalog only. Public placement follows visibility and qualityTier after review. Counts are authored JSON counts; runtime spawns are excluded. Structural workload is a mechanical estimate, not a visual score.','',
  '## Mechanical inventory','',
  'Numeric pairs are baseline → current. Controller shows actual current per-level settings when available.','',
  '| ID | Title | Original category | Controller | Genre | Levels | Objects | Models | Textures | Audio | Prefabs |',
  '|---|---|---|---|---|---:|---:|---:|---:|---:|---:|'];
for(const game of inventory.games){
  const b=game.baseline,c=game.current,entry=catalogById[game.id]||{};
  rows.push('| '+[game.id,c.title,b.category,[...new Set(c.levels.map(level=>level.controller))].join(', ')||c.controller,entry.genre||c.genre,pair(b.levelCount,c.levelCount),pair(b.objectCount,c.objectCount),pair(b.modelCount,c.modelCount),pair(b.textureCount,c.textureCount),pair(b.audioCount,c.audioCount),pair(b.prefabCount,c.prefabCount)].map(esc).join(' | ')+' |');
}
rows.push('','## Rendered quality and recommended role','',
  'Scores use 1–5 and show baseline → current. Missing scores stay Pending. Counts, asset hashes, successful tests and screenshot existence do not substitute for visual judgment.','',
  '| ID | Visual | Gameplay clarity | Level composition | Audio | UI/presentation | Uniqueness | Recommended final role | Final tier |',
  '|---|---|---|---|---|---|---|---|---|');
for(const game of inventory.games){
  const review=reviews[game.id]||{};
  rows.push('| '+[game.id,...fields.map(aliases=>pair(score(review,'before',aliases),score(review,'after',aliases))),recommendation(review),roleOf(review)||'Pending'].map(esc).join(' | ')+' |');
}
rows.push('','## Capability, technical value and evidence','');
for(const game of inventory.games){
  const b=game.baseline,c=game.current,review=reviews[game.id]||{},sample=sampleById[game.id]||{},entry=catalogById[game.id]||{};
  const purpose=review.purpose||sample.purpose||flagshipPurpose[game.id]||entry.purpose||'Pending capability description';
  const hud=summary=>summary.levels.map((level,i)=>'L'+(i+1)+': '+(level.hud.filter(h=>h.visible).map(h=>h.kind).join(', ')||'none')).join('; ');
  const start=summary=>summary.levels.map((level,i)=>'L'+(i+1)+': '+(level.startScreen.enabled?level.startScreen.title+(level.startScreen.howToPlay?' + authored help':' (help absent)'):'disabled')).join('; ');
  const endings=summary=>summary.levels.map((level,i)=>'L'+(i+1)+': Win "'+(level.ending.winTitle||'default/absent')+'"; Lose "'+(level.ending.loseTitle||'default/absent')+'"').join('; ');
  const save=summary=>'save action '+(summary.saveContinue.saveGameAuthored?'yes':'no')+', load action '+(summary.saveContinue.loadGameAuthored?'yes':'no')+', Continue shell '+(summary.saveContinue.continueShellAvailable?'available when valid save exists':'absent');
  const camera=summary=>summary.levels.map((level,i)=>'L'+(i+1)+': '+level.camera.cameraObjects+' camera objects, '+level.camera.pathObjects+' paths, initial yaw '+(level.camera.initialYaw==null?'default':level.camera.initialYaw.toFixed(3))+', pitch '+(level.camera.initialPitch==null?'default':level.camera.initialPitch.toFixed(3))).join('; ');
  rows.push('### '+esc(c.title)+' ('+game.id+')','',
    '- Purpose / demonstrated capability: '+esc(purpose)+'.',
    '- Current technical value: '+esc(review.technicalValue||purpose)+'. The authored controller and progression records remain reproducible engine examples.',
    '- Public potential: '+esc(publicPotential(game,review)),
    '- Rehabilitation difficulty: '+esc(review.rehabDifficulty||structuralDifficulty(game))+'. This does not estimate visual polish without rendered review.',
    '- Current category: '+esc(entry.category||c.category)+'. Catalog status: '+esc(entry.visibility||c.visibility)+' / '+esc(entry.qualityTier||c.qualityTier||'tier pending')+'; historical controller label '+esc(b.controller)+'; current controller(s) '+esc([...new Set(c.levels.map(level=>level.controller))].join(', '))+'.',
    '- Camera baseline: '+esc(camera(b))+'. Current: '+esc(camera(c))+'.',
    '- HUD baseline: '+esc(hud(b))+'. Current: '+esc(hud(c))+'.',
    '- Start Screens baseline: '+esc(start(b))+'. Current: '+esc(start(c))+'.',
    '- Endings baseline: '+esc(endings(b))+'. Current: '+esc(endings(c))+'. Authored text alone does not establish completion.',
    '- Save/Continue baseline: '+esc(save(b))+'. Current: '+esc(save(c))+'.',
    '- Models baseline: '+list(b.assetProvenance.filter(asset=>asset.kind==='mesh').map(asset=>(asset.name||asset.id)+' ['+asset.id+'; '+(asset.sourceFilename||'embedded source')+']'))+'.',
    '- Models current: '+list(c.assetProvenance.filter(asset=>asset.kind==='mesh').map(asset=>(asset.name||asset.id)+' ['+asset.id+']'))+'.',
    '- Asset provenance: baseline '+b.unknownProvenanceCount+' records requiring license review; current '+c.exactOriginalKitAssetCount+' exact original-kit assets and '+c.unknownProvenanceCount+' unverified/mismatched records. Full per-asset source data is in inventory.json.',
    '- Known fixture assets: baseline '+list(b.knownFixtureAssets)+'; current '+list(c.knownFixtureAssets)+'.',
    '- Audit evidence: '+(auditEvidence(game.id).map(file=>'['+path.basename(path.dirname(file))+'/'+path.basename(file)+']('+file+')').join('; ')||'Pending recorded browser evidence')+'.',
    '- Public screenshots: '+(screenshots(review).map(file=>'['+path.basename(file)+']('+file+')').join('; ')||'Pending approved representative capture selection')+'.',
    '- Recommended final role: **'+recommendation(review)+'**. Final tier: **'+(roleOf(review)||'Pending')+'**.',
    '- Review notes: '+esc(review.notes||review.reviewNotes||'Pending root/sample rendered-quality scoring.'),
    '- Remaining gaps: '+list(review.remainingGaps||review.gaps||(roleOf(review)?[]:['Rendered scores and final role have not yet been supplied to this matrix.'])),'');
}
const ticks=String.fromCharCode(96).repeat(3);
rows.push('## Regeneration and review input','',
  'Refresh mechanical data with node tools/inventory-rehabilitation.js, then regenerate with node tools/write-rehabilitation-matrix.js.','',
  'Optional review source: rehabilitation-evidence/final-quality-reviews.json. Preferred shape:','',ticks+'json',
  '{"games":[{"id":"example-id","before":{"visual":2,"gameplayClarity":3,"levelComposition":2,"audio":1,"presentation":2,"uniqueness":3},"after":{"visual":3,"gameplayClarity":4,"levelComposition":3,"audio":3,"presentation":4,"uniqueness":3},"finalRole":"SAMPLE","notes":"Actual rendered-review findings.","remainingGaps":[],"screenshots":{"gameplay":"public-showcase-review/example-id/gameplay.png"}}]}',
  ticks,'',
  'The source may also be an ID-keyed object or contain reviews; beforeScores, afterScores, scores and qualityReview are accepted score aliases. Recommended role maps Featured → FEATURED_CANDIDATE, Sample → PUBLIC_SAMPLE_CANDIDATE, Internal → INTERNAL_ONLY_UNTIL_REBUILT unless explicitly supplied. This generator never edits games, catalog visibility, scores, evidence or engine code.','');
fs.writeFileSync(path.join(ROOT,'GAME-REHABILITATION-MATRIX.md'),rows.join('\n'));
console.log('Matrix: '+inventory.games.length+' games; '+scoredCount+' supplied final roles; '+(28-scoredCount)+' pending.');

