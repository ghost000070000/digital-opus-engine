const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const catalogPath = path.join(root, 'games/catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const now = new Date().toISOString();
const scores = ['visual', 'gameplayClarity', 'levelComposition', 'audio', 'presentation', 'uniqueness'];

const decisions = {
  'foglight': { role: 'sample', after: [3, 4, 4, 4, 4, 4], shot: 'rehabilitation-evidence/playthroughs/foglight/grove.png', notes: 'A longer causeway, layered woods, beacon courts, a grand sanctuary, twilight lighting and expanded original audio materially strengthen the fantasy route. Native input still wins and restarts.', gaps: 'The opening arch dominates the first read and the underlying objective route remains compact; keep as a strong Sample.' },
  'signal-relay': { role: 'sample', after: [3, 4, 4, 4, 4, 3], shot: 'rehabilitation-evidence/combat-playtest/signal-relay-normal/encounter-obj58.png', notes: 'Facility thresholds, structural bays, computer banks, large machinery, storage, a modeled sidearm and relay audio create a coherent communications station. Native input restores all relays, defeats both drones, wins and restarts.', gaps: 'Dark repeated wall bays and limited room-to-room contrast keep the visual score below Featured.' },
  'arsenal-run': { role: 'featured', after: [4, 4, 4, 4, 4, 3], shots: ['rehabilitation-evidence/combat-playtest/arsenal-run-normal/opening.png', 'rehabilitation-evidence/combat-playtest/arsenal-run-normal/encounter-obj2010.png', 'rehabilitation-evidence/combat-playtest/arsenal-run-normal/extraction-attempt.png'], notes: 'A central reactor, distinct cover lanes, barricades, utility caches, railings, modeled sidearm/rifle silhouettes and focused arena lighting turn the compact combat loop into a showcase-ready action slice. Native win, intentional loss, Pause and Restart are verified.', gaps: 'The arena remains deliberately compact and could support deeper enemy animation and encounter variety in a later wave.' },
  'silent-sector': { role: 'sample', after: [3, 4, 4, 4, 4, 3], shot: 'rehabilitation-evidence/playthroughs/silent-sector/core-approach.png', notes: 'Blue, red and green navigation zones, machinery, storage, computer banks and a restrained stealth sound bed give the infiltration route a distinct identity. Native input reaches the core, wins and restarts.', gaps: 'The intentionally low-key stealth lighting and sparse traversal spaces do not consistently meet the Featured visual bar.' },
  'power-grid': { role: 'featured', after: [4, 4, 4, 4, 4, 4], shots: ['rehabilitation-evidence/playthroughs/power-grid/opening.png', 'rehabilitation-evidence/playthroughs/power-grid/coolant.png', 'rehabilitation-evidence/playthroughs/power-grid/generator.png'], notes: 'Dense machine zones, conduits, coolant towers, ceiling rhythm, colored power-flow guidance and offline/online audio give the carry-and-switch puzzle strong spatial legibility. Native input restores power, wins and restarts.', gaps: 'A future polish pass could add animated machinery states, but the current standalone slice clears the Featured gate.' },
  'moving-temple': { role: 'featured', after: [4, 4, 4, 3, 4, 4], shots: ['rehabilitation-evidence/traversal-play/moving-temple/opening.png', 'rehabilitation-evidence/traversal-play/moving-temple/lift-raised.png', 'rehabilitation-evidence/traversal-play/moving-temple/outcome.png'], notes: 'Vertical ruin silhouettes, depth piers, stairs, a summit sanctuary and night-wind atmosphere frame the moving slab and lift mechanics as a coherent ascent. Native input boards, rides, wins and restarts.', gaps: 'The authored route remains short, but its composition, mechanic clarity and finish meet the Featured slice standard.' },
  'forest-range': { role: 'featured', after: [4, 4, 4, 3, 4, 4], shots: ['rehabilitation-evidence/final-review/forest-range/opening.png', 'rehabilitation-evidence/sample-play/forest-range/step-2.png', 'rehabilitation-evidence/sample-play/forest-range/outcome.png'], notes: 'A layered woodland corridor, dead-tree silhouettes, stone waypoints, authored camera framing and a warm lookout goal turn the grove route into a readable, distinctive exploration showcase. Normal native movement reaches the lookout.', gaps: 'Dense foliage still produces occasional close chase-camera views; the representative route and outcome remain reliable.' },
  'survival-arena-2': { role: 'sample', after: [3, 4, 3, 3, 4, 4], shot: 'rehabilitation-evidence/featured-promotion/internal-play/survival-arena-2/survival-outcome.png', notes: 'The new authored hovercraft visual cleanly replaces the seven primitive render parts while preserving controller physics. A tidal relic dais and two-wave identity are distinct; native steering survives 32 seconds and Restart passes.', gaps: 'Compact timed-survival study; environmental density and combat depth remain at Sample scale.' },
  'survival-arena-3': { role: 'sample', after: [3, 4, 3, 3, 4, 4], shot: 'rehabilitation-evidence/featured-promotion/internal-play/survival-arena-3/survival-outcome.png', notes: 'The shared hovercraft visual adapter preserves physics while hiding the primitive fallback. A storm-shard/transmitter composition and copper-purple lighting distinguish this arena; native steering survives 20 seconds and Restart passes.', gaps: 'Compact timed-survival study with a small arena and limited enemy variety.' },
  'valley-run': { role: 'sample', after: [3, 4, 3, 3, 4, 3], shot: 'rehabilitation-evidence/featured-promotion/internal-play/valley-run/route-14.png', notes: 'Landmark arches, cliff spires and a grand ridge goal make the route readable at distance. Native movement reaches the checkpoint and far ridge, wins and restarts.', gaps: 'The fast traversal route is visually clearer but remains a compact terrain/platforming sample.' },
  'opus-arena': { role: 'internal', after: [3, 3, 3, 3, 3, 3], notes: 'Cover, lighting and enemy health were tuned, and native loss plus Restart remain valid.', gaps: 'Three bounded normal-input attempts still reached only 3/8 kills. A complete ordinary-input victory is required before public promotion.' },
  'survival-arena': { role: 'internal', after: [3, 3, 3, 3, 3, 3], notes: 'The authored hovercraft visual replaces the primitive render body without changing vehicle physics, and the relic-court identity is materially improved.', gaps: 'The bounded native route collected 3/4 orbs with one life remaining; a complete normal-input win remains unproven.' }
};

const provenancePath = path.join(root, 'public-showcase-review/screenshot-provenance.json');
let provenance = fs.existsSync(provenancePath) ? JSON.parse(fs.readFileSync(provenancePath, 'utf8')) : [];
if (!Array.isArray(provenance)) provenance = provenance.screenshots || [];
provenance = provenance.filter((record) => !decisions[record.id]);

function copyShot(id, role, source) {
  const sourcePath = path.join(root, source);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing screenshot source: ${source}`);
  const destination = `public-showcase-review/${id}/${role}.png`;
  const destinationPath = path.join(root, destination);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  provenance.push({ id, role, source, destination, sha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'), method: 'Unedited real standalone browser frame', copiedAt: now });
  return destination;
}

for (const game of catalog.games) {
  const decision = decisions[game.id];
  if (!decision) continue;
  const publicReady = decision.role !== 'internal';
  game.visibility = publicReady ? 'public' : 'internal';
  game.qualityTier = decision.role;
  game.category = decision.role;
  game.featured = decision.role === 'featured';
  game.playable = true;
  game.qualityReview = Object.assign({}, game.qualityReview, Object.fromEntries(scores.map((key, i) => [key, decision.after[i]])), {
    standaloneVerified: true,
    noPlaceholders: publicReady,
    licenseVerified: true,
    reviewedAt: now,
    notes: decision.notes,
    remainingGaps: decision.gaps
  });
  if (publicReady) {
    const roles = decision.role === 'featured' ? ['opening', 'gameplay', 'highlight'] : ['gameplay'];
    const sources = decision.shots || [decision.shot];
    game.screenshots = {};
    roles.forEach((role, index) => { game.screenshots[role] = copyShot(game.id, role, sources[index]); });
    game.screenshot = game.screenshots.gameplay;
    if (['survival-arena-2', 'survival-arena-3', 'valley-run'].includes(game.id)) game.playtime = '1–3 minutes';
  } else {
    delete game.screenshots;
    delete game.screenshot;
    game.playtime = 'Duration unverified';
  }
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
fs.mkdirSync(path.dirname(provenancePath), { recursive: true });
fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');

const candidates = ['foglight', 'signal-relay', 'arsenal-run', 'silent-sector', 'power-grid', 'moving-temple', 'forest-range'];
const esc = (value) => String(value).replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character]));
const cards = candidates.map((id) => {
  const game = catalog.games.find((entry) => entry.id === id);
  const decision = decisions[id];
  const before = `../rehabilitation-evidence/baseline/${id}/gameplay.png`;
  const current = `../${game.screenshot}`;
  return `<article><header><span>${esc(game.qualityTier.toUpperCase())}</span><h2>${esc(game.title)}</h2></header><div class="compare"><figure><img src="${before}" alt="${esc(game.title)} before pass"><figcaption>Before</figcaption></figure><figure><img src="${current}" alt="${esc(game.title)} current standalone"><figcaption>Current</figcaption></figure></div><div class="body"><div class="scores">${scores.map((key, i) => `<div>${esc(key.replace(/([A-Z])/g, ' $1'))}<strong>${decision.after[i]}/5</strong></div>`).join('')}</div><p>${esc(decision.notes)}</p><p class="gap"><b>Decision:</b> ${esc(decision.gaps)}</p><nav><a href="../dist/games/${id}.html">Play standalone</a><a href="../${game.screenshot}">Open current frame</a></nav></div></article>`;
}).join('\n');
const counts = { featured: catalog.games.filter((game) => game.qualityTier === 'featured').length, sample: catalog.games.filter((game) => game.visibility === 'public' && game.qualityTier === 'sample').length, internal: catalog.games.filter((game) => game.visibility === 'internal').length };
const pageDir = path.join(root, 'public-showcase-review-v2');
fs.mkdirSync(pageDir, { recursive: true });
fs.writeFileSync(path.join(pageDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Featured promotion review</title><style>*{box-sizing:border-box}body{margin:0;background:#0c1118;color:#ecf2f1;font:15px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:36px 24px}h1{font-size:clamp(30px,5vw,58px);line-height:1;margin:.2em 0}h2{margin:0}a{color:#7ee2d0}.intro{max-width:1000px;color:#b8c9ce;margin-bottom:28px}.grid{display:grid;gap:24px}article{background:#17212b;border:1px solid #324552;border-radius:12px;overflow:hidden}header,.body{padding:18px 20px}header{display:flex;justify-content:space-between;align-items:center}header span{color:#74dfc7;font-size:12px;font-weight:800;letter-spacing:2px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#0c1118}.compare figure{margin:0;position:relative}.compare img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}.compare figcaption{position:absolute;left:10px;bottom:10px;background:#0c1118dd;padding:4px 9px;border-radius:4px;font-weight:700}.scores{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;text-transform:capitalize;font-size:11px}.scores div{background:#101922;padding:8px;border-radius:5px}.scores strong{display:block;font-size:17px}.gap{color:#d4bd96}nav{display:flex;gap:18px}@media(max-width:750px){main{padding:20px 10px}.compare{grid-template-columns:1fr}.scores{grid-template-columns:repeat(3,1fr)}}</style><main><div class="intro"><p>LOCAL HUMAN REVIEW · ${esc(now)}</p><h1>Featured promotion + final rehabilitation</h1><p>${counts.featured} Featured · ${counts.sample} Samples · ${counts.internal} Internal · exactly ${catalog.games.length} games retained. Side-by-side frames are unedited standalone captures. Scores are editorial judgments; tests verify mechanics and packaging, not visual quality. No deployment occurred.</p><p><a href="../FEATURED-PROMOTION-AND-FINAL-REHAB-REPORT.md">Read report</a> · <a href="screenshot-provenance.json">Screenshot provenance</a> · <a href="../dist/games-site/index.html">Local games hub</a></p></div><div class="grid">${cards}</div></main></html>`);
fs.writeFileSync(path.join(pageDir, 'screenshot-provenance.json'), JSON.stringify(provenance.filter((record) => decisions[record.id]), null, 2) + '\n');
console.log(JSON.stringify({ games: catalog.games.length, ...counts, reviewCards: candidates.length, newScreenshotRecords: provenance.filter((record) => decisions[record.id]).length }));
