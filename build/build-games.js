// Turns the games/*.json backlog into a distributable product surface:
//
//   node build/build-games.js
//
// Reads games/catalog.json (the ONE metadata source also driving the
// editor's own Games panel), and for every catalog entry:
//   1. validates it (parses, supported project format, has a level/objects
//      array, source file exists, no duplicate catalog id);
//   2. if playable, builds a self-contained Playable HTML via the SAME
//      composeExportHTML the editor's own Playable Export button uses
//      (build/export-template.js) -- no forked export logic;
//   3. writes it to dist/games/<id>.html.
// Then generates dist/games/catalog.json (public runtime metadata) and
// dist/games/index.html (a static, backend-free launcher gallery).
//
// No dependencies -- pure Node stdlib, matching build/build.js's own
// convention. Cleans and reconciles ONLY dist/games/ (never touches the
// rest of dist/).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_GAMES_DIR = path.join(DIST_DIR, 'games');
const startedAt = process.hrtime.bigint();

const { composeExportHTML } = require(path.join(ROOT, 'build', 'export-template.js'));
const { validatePublicGame } = require('./public-game-quality');

function fail(msg) {
  console.error(`Catalog build error: ${msg}`);
  process.exit(1);
}

// --- Load + validate the catalog itself ---
const catalogPath = path.join(GAMES_DIR, 'catalog.json');
if (!fs.existsSync(catalogPath)) fail(`games/catalog.json not found`);
let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
} catch (err) {
  fail(`games/catalog.json does not parse: ${err.message}`);
}
if (!Array.isArray(catalog.games) || catalog.games.length === 0) fail('games/catalog.json has no games[] entries');

const seenIds = new Set();
const validationErrors = [];
for (const entry of catalog.games) {
  if (!entry.id) { validationErrors.push(`entry missing id: ${JSON.stringify(entry).slice(0, 80)}`); continue; }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) { validationErrors.push(`invalid catalog id: ${entry.id}`); continue; }
  if (seenIds.has(entry.id)) { validationErrors.push(`duplicate catalog id "${entry.id}"`); continue; }
  seenIds.add(entry.id);
  if (!entry.title) validationErrors.push(`${entry.id}: missing title`);
  if (!['public', 'internal'].includes(entry.visibility)) validationErrors.push(`${entry.id}: visibility must be public or internal`);
  if (!entry.file) { validationErrors.push(`${entry.id}: missing file`); continue; }
  const srcPath = path.join(GAMES_DIR, entry.file);
  if (!fs.existsSync(srcPath)) { validationErrors.push(`${entry.id}: source file games/${entry.file} does not exist`); continue; }
  let projectJSON, parsed;
  try {
    projectJSON = fs.readFileSync(srcPath, 'utf8');
    parsed = JSON.parse(projectJSON);
  } catch (err) {
    validationErrors.push(`${entry.id}: games/${entry.file} does not parse: ${err.message}`);
    continue;
  }
  // Same two "supported project format" shapes normalizeProjectData
  // accepts in the editor (plus the bare top-level-array shape, unused by
  // anything in this catalog today but still valid) -- checked here only
  // well enough to catch a genuinely malformed file before it reaches
  // composeExportHTML, not a full reimplementation of normalization.
  const hasLevels = Array.isArray(parsed.levels) && parsed.levels.length >= 1;
  const hasBareObjects = Array.isArray(parsed.objects);
  const isBareArray = Array.isArray(parsed);
  if (!hasLevels && !hasBareObjects && !isBareArray) {
    validationErrors.push(`${entry.id}: games/${entry.file} is not a recognized project format (no levels[], objects[], or bare array)`);
    continue;
  }
  entry._projectJSON = projectJSON;
  entry._parsed = parsed;
  for (const error of validatePublicGame(entry, parsed, { root: ROOT })) validationErrors.push(`${entry.id}: ${error}`);
}
if (validationErrors.length > 0) {
  console.error('Catalog validation failed:');
  for (const e of validationErrors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Catalog validated -> ${catalog.games.length} entries, 0 errors`);

// --- Load the three build-time inputs shared with the editor's own export ---
const engineJSPath = path.join(DIST_DIR, 'opus-engine.js');
if (!fs.existsSync(engineJSPath)) fail('dist/opus-engine.js not found -- run node build/build.js first');
const engineJS = fs.readFileSync(engineJSPath, 'utf8');
const editorJS = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
const htmlTemplate = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8');
const templateJS = fs.readFileSync(path.join(ROOT, 'build', 'export-template.js'), 'utf8');

// --- Reconcile dist/games/ (only this directory -- never touches the rest of dist/) ---
fs.rmSync(DIST_GAMES_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_GAMES_DIR, { recursive: true });

// Resolves the exact same title-fallback chain buildExportHTML uses in the
// browser (Project Meta title -> Start Screen title -> ...), with one
// build-time-only addition: the catalog's own curated title as a further
// fallback before the generic default, since several legacy/technical
// sample projects have no Start Screen configured at all.
function resolveTitle(parsed, catalogTitle) {
  const metaTitle = parsed && parsed.meta && parsed.meta.title;
  const level0 = parsed && Array.isArray(parsed.levels) ? parsed.levels[0] : null;
  const startScreenTitle = level0 && level0.ui && level0.ui.startScreen && level0.ui.startScreen.title;
  return metaTitle || startScreenTitle || catalogTitle || 'Digital Opus Game';
}

const built = [];
const buildFailures = [];
for (const entry of catalog.games) {
  if (entry.playable === false) continue;
  try {
    const title = resolveTitle(entry._parsed, entry.title);
    const html = composeExportHTML({
      htmlTemplate, engineJS, editorJS, templateJS,
      embeddedProjectJSON: entry._projectJSON,
      playableOnly: true,
      title,
    });
    const outPath = path.join(DIST_GAMES_DIR, `${entry.id}.html`);
    fs.writeFileSync(outPath, html, 'utf8');
    // Validate every generated build at minimum, per the pass's own
    // required floor: exists (writeFileSync already throws if not),
    // nonzero size, the embedded project payload is actually present, and
    // the resolved title made it into the file.
    const stat = fs.statSync(outPath);
    if (stat.size === 0) throw new Error('generated file is empty');
    if (!html.includes('__OPUS_EMBEDDED_PROJECT__')) throw new Error('embedded project payload missing from output');
    if (!html.includes(`<title>`)) throw new Error('no <title> tag in output');
    built.push({ id: entry.id, title, bytes: stat.size, featured: entry.qualityTier === 'featured' });
    console.log(`  built dist/games/${entry.id}.html (${(stat.size / 1024).toFixed(0)} KB) [${entry.visibility.toUpperCase()}${entry.visibility === 'public' ? ' ' + entry.qualityTier.toUpperCase() : ''}]`);
  } catch (err) {
    buildFailures.push({ id: entry.id, featured: !!entry.featured, error: err.message });
    console.error(`Game ${entry.id} failed build: ${err.message}`);
  }
}

// --- dist/games/catalog.json: complete INTERNAL development catalog ---
const publicCatalog = {
  version: catalog.version || 1,
  generatedAt: new Date().toISOString(),
  games: catalog.games
    .filter((e) => built.some((b) => b.id === e.id))
    .map((e) => ({
      id: e.id, title: e.title, category: e.category, featured: e.qualityTier === 'featured',
      genre: e.genre, controller: e.controller, estimatedMinutes: e.estimatedMinutes,
      description: e.description, tags: e.tags || [], file: `${e.id}.html`,
      purpose: e.purpose, visibility: e.visibility || 'internal', qualityTier: e.qualityTier || 'internal',
      playtime: e.playtime, screenshot: e.screenshot || null, screenshots: e.screenshots || {},
    })),
};
fs.writeFileSync(path.join(DIST_GAMES_DIR, 'catalog.json'), JSON.stringify(publicCatalog, null, 2), 'utf8');

// --- dist/games/index.html: static launcher, no backend, no framework ---
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const CATEGORY_LABELS = { featured: 'Featured', sample: 'Sample', technical: 'Technical Samples' };
function launcherCard(g) {
  return `<a class="card" href="${escapeHtml(g.id)}.html">
  <div class="card-title-row"><span class="card-title">${escapeHtml(g.title)}</span>${g.featured ? '<span class="card-badge">Featured</span>' : ''}</div>
  <div class="card-genre">${escapeHtml(g.genre)}${(g.controller && g.controller !== 'n/a') ? ` · ${escapeHtml(g.controller)}` : ''}</div>
  <div class="card-desc">${escapeHtml(g.description)}</div>
  <div class="card-meta">${g.estimatedMinutes ? `~${g.estimatedMinutes} min` : ''}</div>
  <span class="card-play">Play ▶</span>
</a>`;
}
const categories = ['featured', 'sample', 'technical'];
const sections = categories.map((cat) => {
  const games = publicCatalog.games.filter((g) => g.category === cat);
  if (games.length === 0) return '';
  return `<section data-category="${cat}">
  <h2>${CATEGORY_LABELS[cat]}</h2>
  <div class="grid">
${games.map(launcherCard).join('\n')}
  </div>
</section>`;
}).join('\n');

const launcherHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Digital Opus Engine — Internal Build Review</title>
<!-- Generated by build/build-games.js from games/catalog.json. Do not edit
     this file directly -- edit the catalog or a game's own project JSON,
     then re-run: node build/build.js && node build/build-games.js -->
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0c1420; color: #e6ecf7; font: 15px/1.5 system-ui, -apple-system, sans-serif; }
  header { padding: 32px 24px 8px; text-align: center; }
  header h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: 0.02em; }
  header p { margin: 0; color: #8fa3c9; font-size: 13px; }
  .filters { display: flex; gap: 8px; justify-content: center; margin: 20px 0; flex-wrap: wrap; }
  .filters button { background: #182338; color: #c7d3ea; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer; }
  .filters button.active { background: #6fd6bd; color: #0c1420; border-color: #6fd6bd; font-weight: 600; }
  main { max-width: 1000px; margin: 0 auto; padding: 0 24px 48px; }
  section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #8fa3c9; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; margin: 28px 0 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
  .card { display: block; background: #182338; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 14px 16px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
  .card:hover, .card:focus-visible { border-color: #6fd6bd; outline: none; }
  .card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .card-title { font-size: 15px; font-weight: 600; color: #e6ecf7; }
  .card-badge { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #0c1420; background: #6fd6bd; padding: 2px 6px; border-radius: 3px; flex-shrink: 0; }
  .card-genre { font-size: 11.5px; color: #8fa3c9; margin-top: 3px; }
  .card-desc { font-size: 12.5px; color: #aab6cc; margin-top: 8px; line-height: 1.45; min-height: 36px; }
  .card-meta { font-size: 11px; color: #66759a; margin-top: 8px; }
  .card-play { display: inline-block; margin-top: 10px; font-size: 12.5px; font-weight: 600; color: #6fd6bd; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>Internal Build Review</h1>
  <p>${publicCatalog.games.length} playable builds · includes internal regression projects · not a public catalog</p>
</header>
<div class="filters">
  <button type="button" class="active" data-filter="all">All</button>
  <button type="button" data-filter="featured">Featured</button>
  <button type="button" data-filter="sample">Sample</button>
  <button type="button" data-filter="technical">Technical</button>
</div>
<main>
${sections}
</main>
<script>
document.querySelectorAll('.filters button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.filters button').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var filter = btn.dataset.filter;
    document.querySelectorAll('main section').forEach(function (sec) {
      sec.hidden = filter !== 'all' && sec.dataset.category !== filter;
    });
  });
});
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(DIST_GAMES_DIR, 'index.html'), launcherHtml, 'utf8');

// --- Summary / exit code ---
const totalBytes = built.reduce((sum, b) => sum + b.bytes, 0);
console.log('');
console.log(`Built ${built.length}/${catalog.games.filter((e) => e.playable !== false).length} playable HTML files -> ${path.relative(ROOT, DIST_GAMES_DIR)}`);
console.log(`Launcher       -> ${path.relative(ROOT, path.join(DIST_GAMES_DIR, 'index.html'))}`);
console.log(`Catalog        -> ${path.relative(ROOT, path.join(DIST_GAMES_DIR, 'catalog.json'))}`);
console.log(`Total output   -> ${(totalBytes / (1024 * 1024)).toFixed(1)} MB (avg ${(totalBytes / Math.max(1, built.length) / 1024).toFixed(0)} KB/game)`);
console.log(`Build duration -> ${(Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(1)} ms`);

const failedFeatured = buildFailures.filter((f) => f.featured);
if (failedFeatured.length > 0) {
  console.error(`\n${failedFeatured.length} FEATURED game(s) failed to build -- exiting nonzero.`);
  process.exit(1);
}
if (buildFailures.length > 0) {
  console.error(`\n${buildFailures.length} game(s) failed to build -- every retained catalog entry must export.`);
  process.exit(1);
}
