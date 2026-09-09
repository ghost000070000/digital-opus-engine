// Turns the game catalog into a deployment-ready static site.
//
// As a CLI (unchanged from before this file became reusable):
//   node build/build-games-site.js
// builds the standalone "Digital Opus Games" public hub into dist/games-site/.
//
// As a module, `buildGamesSite(options)` is also reused by
// build/build-engine-site.js to generate the Engine's own "examples"
// subpage (dist/engine-site/games/) with different branding copy but the
// exact same generator -- one implementation, two callers, per that
// script's own "do not duplicate standalone-game generation" requirement.
//
// Output is a fully self-contained static folder (no repository-relative
// paths, no ../games/, ../editor/, ../dist/) suitable for copying as-is to
// a static host. Does NOT deploy anywhere -- only produces the folder
// locally.
//
// Reuses, never forks:
//   - games/catalog.json                the one metadata source of truth
//   - build/export-template.js          the one export implementation
//     (composeExportHTML), same as build/build-games.js and the editor's
//     own Playable/Editable Export buttons
//   - build/templates/games-site.html   the one maintainable page template
//     (placeholder tokens filled in below, no 500-line string buried in
//     this file)
//
// No dependencies -- pure Node stdlib, matching build/build.js's own
// convention. Cleans and reconciles ONLY the caller's own `outputDir`.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');
const DIST_DIR = path.join(ROOT, 'dist');
const { composeExportHTML } = require(path.join(ROOT, 'build', 'export-template.js'));
const { resolveTitle, validatePublicGame, screenshotRecords } = require('./public-game-quality');

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// Optional internal-only fallback art. Public cards always use reviewed gameplay captures.
const FEATURED_PALETTE = {
  foglight: ['#16261f', '#2f6e57'],
  'signal-relay': ['#111a2c', '#2d5580'],
  'arsenal-run': ['#2a1512', '#a8402a'],
  'silent-sector': ['#171425', '#3f3164'],
  'power-grid': ['#2a2110', '#a87a20'],
  'relic-frontier': ['#241a10', '#8a6230'],
  'relic-island': ['#0f2422', '#218a78'],
};
// Deterministic fallback palette for every non-Featured game (Featured
// games keep their hand-picked FEATURED_PALETTE entry above, unchanged).
// A single flat default color for all 21 non-Featured cards would look
// like a rendering bug once every card gets a thumbnail (see below) --
// this hashes the game's own stable id to a hue instead, so every card
// gets a distinct, consistent-on-rebuild gradient with zero hand-picked
// colors to maintain as the catalog grows. Same "generate, don't
// hand-author" preference already used for noise-based textures/skyboxes
// elsewhere in this workspace.
function idHue(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % 360;
}
function fallbackPalette(id) {
  const hue = idHue(id);
  return [`hsl(${hue}, 38%, 14%)`, `hsl(${(hue + 40) % 360}, 45%, 30%)`];
}
function titleCardSVG(entry) {
  const [c1, c2] = FEATURED_PALETTE[entry.id] || fallbackPalette(entry.id);
  const gid = `g-${entry.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" role="img" aria-labelledby="${gid}-title">
<title id="${gid}-title">${escapeHtml(entry.title)} -- ${escapeHtml(entry.genre || '')}</title>
<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
</linearGradient></defs>
<rect width="640" height="400" fill="url(#${gid})"/>
<text x="50%" y="47%" text-anchor="middle" font-family="system-ui,sans-serif" font-size="40" font-weight="700" fill="#f2f5fa">${escapeHtml(entry.title)}</text>
<text x="50%" y="58%" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" letter-spacing="2" fill="#c7d3ea" opacity="0.85">${escapeHtml((entry.genre || '').toUpperCase())}</text>
</svg>`;
}

function playerCard(b, compact) {
  const g = b.entry;
  const thumbHtml = b.thumb ? `<img class="card-thumb" src="${escapeHtml(b.thumb)}" alt="${escapeHtml(b.title)} gameplay screenshot" loading="lazy">` : '';
  const badge = g.qualityTier === 'featured' ? '<span class="card-badge">Featured</span>' : '';
  return `<a class="card${compact ? ' card-compact' : ''}" data-category="${escapeHtml(g.qualityTier || g.category)}" href="${escapeHtml(b.id)}.html" aria-label="Play ${escapeHtml(b.title)}">
  ${thumbHtml}
  <div class="card-body">
    <div class="card-title-row"><span class="card-title">${escapeHtml(b.title)}</span>${badge}</div>
    <div class="card-genre">${escapeHtml(g.genre || '')}${(g.controller && g.controller !== 'n/a') ? ` · ${escapeHtml(g.controller)}` : ''}</div>
    <div class="card-desc">${escapeHtml(g.description || '')}</div>
    <div class="card-meta-row">
      <span class="card-meta">${escapeHtml(g.playtime || (g.estimatedMinutes ? `~${g.estimatedMinutes} min` : ''))}</span>
      <span class="card-play">Play &#9654;</span>
    </div>
  </div>
</a>`;
}

const DEFAULT_SITE_CONFIG = {
  pageTitle: 'Digital Opus Games',
  pageDescription: 'Small games, experiments and interactive worlds built with Digital Opus Engine. Browse and play instantly -- no install, no account.',
  brandHtml: 'Digital Opus <span>Games</span>',
  homeHref: '#top',
  navHomeLink: '',
  navMoreLabel: 'More Games',
  heroTitle: 'Digital Opus Games',
  heroSubtitle: 'Small games, experiments and interactive worlds built with Digital Opus Engine.',
  primaryCta: 'Browse Games',
  aboutText: 'Digital Opus Engine is our local-first, browser-based game creation environment. These games are built with the same tools available inside the editor -- every one started as a real project, playable start to finish.',
};

// Builds a complete games site into `outputDir`. Returns a summary object
// (never calls process.exit -- CLI callers do that themselves based on the
// return value, so this function is safe to call from another build script
// without killing its process on a validation failure).
function buildGamesSite(options) {
  const outputDir = options.outputDir;
  const siteConfig = { ...DEFAULT_SITE_CONFIG, ...(options.siteConfig || {}) };
  const includeRawSource = !!options.includeRawSource;
  const log = options.log || (() => {});
  const assetsDir = path.join(outputDir, 'assets');

  const catalogPath = path.join(GAMES_DIR, 'catalog.json');
  if (!fs.existsSync(catalogPath)) return { ok: false, errors: ['games/catalog.json not found'] };
  let catalog;
  try { catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')); } catch (err) { return { ok: false, errors: [`games/catalog.json does not parse: ${err.message}`] }; }
  if (!Array.isArray(catalog.games) || catalog.games.length === 0) return { ok: false, errors: ['games/catalog.json has no games[] entries'] };

  const seenIds = new Set();
  const validationErrors = [];
  for (const entry of catalog.games) {
    if (!entry.id) { validationErrors.push('entry missing id'); continue; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) { validationErrors.push(`invalid catalog id: ${entry.id}`); continue; }
    if (seenIds.has(entry.id)) { validationErrors.push(`duplicate catalog id "${entry.id}"`); continue; }
    seenIds.add(entry.id);
    if (!entry.title) validationErrors.push(`${entry.id}: missing title`);
    if (!['public', 'internal'].includes(entry.visibility)) validationErrors.push(`${entry.id}: visibility must be public or internal`);
    const srcPath = path.join(GAMES_DIR, entry.file || '');
    if (!entry.file || !fs.existsSync(srcPath)) { validationErrors.push(`${entry.id}: source file games/${entry.file} does not exist`); continue; }
    let projectJSON, parsed;
    try { projectJSON = fs.readFileSync(srcPath, 'utf8'); parsed = JSON.parse(projectJSON); }
    catch (err) { validationErrors.push(`${entry.id}: games/${entry.file} does not parse: ${err.message}`); continue; }
    const hasLevels = Array.isArray(parsed.levels) && parsed.levels.length >= 1;
    const hasBareObjects = Array.isArray(parsed.objects);
    const isBareArray = Array.isArray(parsed);
    if (!hasLevels && !hasBareObjects && !isBareArray) { validationErrors.push(`${entry.id}: not a recognized project format`); continue; }
    if (entry.visibility === 'public') {
      for (const error of validatePublicGame(entry, parsed, { root: ROOT })) validationErrors.push(`${entry.id}: ${error}`);
    }
    entry._projectJSON = projectJSON;
    entry._parsed = parsed;
  }
  if (validationErrors.length > 0) return { ok: false, errors: validationErrors };
  log(`Catalog validated -> ${catalog.games.length} entries, 0 errors`);

  // Public Showcase Recovery pass: every catalog entry now carries its own
  // `visibility` ('internal' | 'public'). A caller building a PUBLIC surface
  // (the Engine's own examples hub, or this generator's standalone CLI use)
  // passes `onlyVisibility: 'public'` so internal regression/mechanics-
  // sample fixtures never reach a public page, regardless of their old
  // `featured` flag. Internal developer/regression tooling (build-games.js's
  // own dist/games/ output, the dev editor's Games tab) does NOT pass this
  // option and keeps seeing the full catalog, exactly as before.
  const gamesToBuild = options.onlyVisibility
    ? catalog.games.filter((g) => g.visibility === options.onlyVisibility)
    : catalog.games;

  const engineJSPath = path.join(DIST_DIR, 'opus-engine.js');
  if (!fs.existsSync(engineJSPath)) return { ok: false, errors: ['dist/opus-engine.js not found -- run node build/build.js first'] };
  const engineJS = fs.readFileSync(engineJSPath, 'utf8');
  const editorJS = fs.readFileSync(path.join(ROOT, 'editor', 'src', '01-editor.js'), 'utf8');
  const htmlTemplate = fs.readFileSync(path.join(ROOT, 'editor', 'index.html'), 'utf8');
  const templateJS = fs.readFileSync(path.join(ROOT, 'build', 'export-template.js'), 'utf8');
  const sitePageTemplate = fs.readFileSync(path.join(ROOT, 'build', 'templates', 'games-site.html'), 'utf8');

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  const appIconSource = path.join(ROOT, 'assets', 'branding', 'digital-opus-icon.png');
  const appIconTarget = path.join(assetsDir, 'branding', 'digital-opus-icon.png');
  if (!fs.existsSync(appIconSource)) return { ok: false, errors: ['assets/branding/digital-opus-icon.png not found'] };
  fs.mkdirSync(path.dirname(appIconTarget), { recursive: true });
  fs.copyFileSync(appIconSource, appIconTarget);

  const built = [];
  const buildFailures = [];
  for (const entry of gamesToBuild) {
    if (entry.playable === false) continue;
    try {
      const title = resolveTitle(entry._parsed, entry.title);
      const html = composeExportHTML({
        htmlTemplate, engineJS, editorJS, templateJS,
        embeddedProjectJSON: entry._projectJSON,
        playableOnly: true,
        title,
      });
      const outPath = path.join(outputDir, `${entry.id}.html`);
      fs.writeFileSync(outPath, html, 'utf8');
      const stat = fs.statSync(outPath);
      if (stat.size === 0) throw new Error('generated file is empty');
      if (!html.includes('__OPUS_EMBEDDED_PROJECT__')) throw new Error('embedded project payload missing');
      if (!html.includes(`<title>${escapeHtml(title)}</title>`)) throw new Error('resolved title missing from output');
      if (/<script[^>]+src=/.test(html)) throw new Error('output references an external <script src=, not standalone');
      // The public gate has already checked real files and their review metadata.
      const screenshots = {};
      for (const shot of screenshotRecords(entry)) {
        const target = 'assets/screenshots/' + entry.id + '/' + shot.role + '.png';
        const source = path.join(ROOT, shot.file);
        if (!fs.existsSync(source)) continue;
        fs.mkdirSync(path.dirname(path.join(outputDir, target)), { recursive: true });
        fs.copyFileSync(source, path.join(outputDir, target));
        screenshots[shot.role] = target;
      }
      let thumb = screenshots.gameplay || null;
      if (!thumb && entry.visibility !== 'public') {
        thumb = 'assets/thumb-' + entry.id + '.svg';
        fs.writeFileSync(path.join(outputDir, thumb), titleCardSVG(entry), 'utf8');
      }
      // Optional: the raw project JSON alongside the generated HTML. This
      // is NOT a "download my source" feature -- it exists only so that a
      // packaged editor sharing this same games/ folder (see
      // build-engine-site.js) can fetch it through its own already-working
      // Games tab (`fetch('../games/<file>')`), exactly as the dev editor
      // already does. No new exposure: composeExportHTML already embeds
      // this identical JSON, in full, inside every generated .html's own
      // `__OPUS_EMBEDDED_PROJECT__` (viewable via ordinary "View Source"),
      // so a raw copy of it here is not additional public information.
      if (includeRawSource) {
        fs.writeFileSync(path.join(outputDir, entry.file), entry._projectJSON, 'utf8');
      }
      built.push({ id: entry.id, title, bytes: stat.size, entry, thumb, screenshots });
      log(`  built ${path.relative(ROOT, outputDir)}/${entry.id}.html (${(stat.size / 1024).toFixed(0)} KB)${entry.featured ? ' [FEATURED]' : ''}`);
    } catch (err) {
      buildFailures.push({ id: entry.id, featured: !!entry.featured, error: err.message });
      log(`Game ${entry.id} failed build: ${err.message}`);
    }
  }

  const publicCatalog = {
    version: catalog.version || 1,
    generatedAt: new Date().toISOString(),
    games: built.map((b) => ({
      id: b.id, title: b.title, category: b.entry.qualityTier || b.entry.category, featured: b.entry.qualityTier === 'featured',
      purpose: b.entry.purpose, visibility: b.entry.visibility || 'internal', qualityTier: b.entry.qualityTier || 'internal', playtime: b.entry.playtime,
      sourceFile: includeRawSource ? b.entry.file : undefined,
      genre: b.entry.genre, controller: b.entry.controller, estimatedMinutes: b.entry.estimatedMinutes,
      description: b.entry.description, screenshot: b.thumb || null, screenshots: b.screenshots, file: `${b.id}.html`,
    })),
  };
  fs.writeFileSync(path.join(outputDir, 'catalog.json'), JSON.stringify(publicCatalog, null, 2), 'utf8');

  const featuredBuilt = built.filter((b) => b.entry.qualityTier === 'featured');
  const sampleBuilt = built.filter((b) => b.entry.qualityTier === 'sample');
  const technicalBuilt = built.filter((b) => b.entry.visibility !== 'public' && !['featured', 'sample'].includes(b.entry.qualityTier));

  // Public Showcase Recovery pass: a `public` build can legitimately have
  // zero games right now (all 28 catalog entries are `visibility: internal`
  // -- see the recovery report). Per that pass's own explicit instruction:
  // no empty grid, no redirect toward the internal regression catalog --
  // just restrained, honest wording that a real showcase is in progress.
  const noPublicGamesNotice = `<section class="games-section" id="featured">
  <p class="games-empty-notice">Playable showcase in development.</p>
</section>`;
  const featuredSection = featuredBuilt.length ? `<section class="games-section" id="featured">
  <h2>Featured</h2>
  <div class="grid">
${featuredBuilt.map((b) => playerCard(b, false)).join('\n')}
  </div>
</section>` : (options.onlyVisibility && built.length === 0 ? noPublicGamesNotice : '');

  // Public terminology cleanup: internal "sample"/"technical" catalog
  // categories never appear as visible labels -- "More Games" (or the
  // caller's own navMoreLabel) groups both, Experimental de-emphasized
  // via a smaller compact card style rather than its own loud heading.
  const moreSection = (sampleBuilt.length || technicalBuilt.length) ? `<section class="games-section" id="more">
  <h2>${escapeHtml(siteConfig.navMoreLabel)}</h2>
  <div class="grid grid-compact">
${sampleBuilt.map((b) => playerCard(b, true)).join('\n')}
  </div>
  ${technicalBuilt.length ? `<h2 style="margin-top:28px">Experimental</h2>
  <div class="grid grid-compact">
${technicalBuilt.map((b) => playerCard(b, true)).join('\n')}
  </div>` : ''}
</section>` : '';

  const siteHtml = sitePageTemplate
    .replace('{{PAGE_TITLE}}', escapeHtml(siteConfig.pageTitle))
    .replace('{{PAGE_DESCRIPTION}}', escapeHtml(siteConfig.pageDescription))
    .replace('{{BRAND_HTML}}', siteConfig.brandHtml)
    .replace('{{HOME_HREF}}', escapeHtml(siteConfig.homeHref))
    .replace('{{NAV_HOME_LINK}}', siteConfig.navHomeLink)
    .replace('{{NAV_MORE_LABEL}}', escapeHtml(siteConfig.navMoreLabel))
    .replace('{{HERO_TITLE}}', escapeHtml(siteConfig.heroTitle))
    .replace('{{HERO_SUBTITLE}}', escapeHtml(siteConfig.heroSubtitle))
    .replace('{{PRIMARY_CTA}}', escapeHtml(siteConfig.primaryCta))
    .replace('{{BROWSE_TARGET}}', featuredBuilt.length || !built.length ? 'featured' : 'more')
    .replace('{{FEATURED_NAV}}', featuredBuilt.length ? '<a href="#featured">Featured</a>' : '')
    .replace('{{FEATURED_CTA}}', featuredBuilt.length ? '<a class="btn btn-secondary" href="#featured">Featured Games</a>' : '')
    .replace('{{FEATURED_FILTER}}', featuredBuilt.length ? '<button type="button" data-filter="featured">Featured</button>' : '')
    .replace('{{SAMPLE_FILTER}}', sampleBuilt.length ? '<button type="button" data-filter="sample">Samples</button>' : '')
    .replace('{{ABOUT_TEXT}}', escapeHtml(siteConfig.aboutText))
    .replace('{{FEATURED_SECTION}}', featuredSection)
    .replace('{{MORE_SECTION}}', moreSection)
    .replace('{{GAME_COUNT}}', String(built.length));

  fs.writeFileSync(path.join(outputDir, 'index.html'), siteHtml, 'utf8');

  const forbiddenPatterns = [/\.\.\/games\//, /\.\.\/editor\//, /\.\.\/dist\//];
  const pathSafetyIssues = [];
  for (const f of ['index.html', 'catalog.json']) {
    const content = fs.readFileSync(path.join(outputDir, f), 'utf8');
    for (const pat of forbiddenPatterns) {
      if (pat.test(content)) pathSafetyIssues.push(`${f} contains a forbidden repo-relative reference (${pat})`);
    }
  }
  if (pathSafetyIssues.length > 0) return { ok: false, errors: pathSafetyIssues };
  log('Path safety check passed -- no ../games/, ../editor/, or ../dist/ references in the site.');

  // "../"-prefixed hrefs (e.g. an Engine-examples-hub page's own link back
  // to its parent site's home page) intentionally point OUTSIDE this
  // function's own `outputDir` -- they're the calling script's
  // responsibility to validate once ITS OWN output exists (build-engine-
  // site.js does exactly that for its home page, after this function
  // returns), not this generic games-hub's job.
  const hrefs = [...siteHtml.matchAll(/href="([^"#]+\.html)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('../'));
  const brokenLinks = hrefs.filter((h) => !fs.existsSync(path.join(outputDir, h)));
  if (brokenLinks.length > 0) return { ok: false, errors: [`Broken links found: ${brokenLinks.join(', ')}`] };
  log(`Broken-link check passed -- ${hrefs.length} game links, all resolve.`);

  function dirBytes(dir) { return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, item) => sum + (item.isDirectory() ? dirBytes(path.join(dir, item.name)) : fs.statSync(path.join(dir, item.name)).size), 0); }
  const totalBytes = dirBytes(outputDir);

  return {
    ok: buildFailures.length === 0,
    built, buildFailures, featuredBuilt, sampleBuilt, technicalBuilt,
    totalGames: gamesToBuild.filter((e) => e.playable !== false).length,
    totalBytes,
  };
}

if (require.main === module) {
  const startedAt = process.hrtime.bigint();
  const SITE_DIR = path.join(DIST_DIR, 'games-site');
  const result = buildGamesSite({ outputDir: SITE_DIR, onlyVisibility: 'public', log: (m) => console.log(m) });
  if (!result.ok && result.errors) {
    console.error('Site build validation failed:');
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const readme = `Digital Opus Games -- local pre-release review package
====================================================

This self-contained static package includes only games explicitly marked
public in games/catalog.json and validated against the showcase quality gate.
Internal projects remain in the repository and dist/games development catalog.

No upload or deployment is approved by this rehabilitation pass. Review the
real gameplay screenshots and playable examples before any release decision.
The prior release ZIP is superseded; Wave 10 has not started.

Regenerate locally with:
  node build/build.js
  node build/build-games-site.js

Source metadata lives in games/catalog.json; game content in games/<id>.json;
the page template in build/templates/games-site.html. Do not hand-edit outputs.

Contents:
  index.html      filtered public candidate gallery
  <id>.html       self-contained reviewed playable samples
  catalog.json    public metadata, purpose, tier and screenshot paths
  assets/         real standalone gameplay screenshots
`;
  fs.writeFileSync(path.join(SITE_DIR, 'README.txt'), readme, 'utf8');

  console.log('');
  console.log(`Built ${result.built.length}/${result.totalGames} playable games -> ${path.relative(ROOT, SITE_DIR)}`);
  console.log(`Site index     -> ${path.relative(ROOT, path.join(SITE_DIR, 'index.html'))}`);
  console.log(`Public catalog -> ${path.relative(ROOT, path.join(SITE_DIR, 'catalog.json'))}`);
  console.log(`Gameplay images -> ${result.built.filter(b => b.entry.visibility === 'public').length} reviewed games with real screenshot coverage`);
  console.log(`Total size     -> ${(result.totalBytes / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`Build duration -> ${(Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(1)} ms`);

  if (!result.ok) {
    console.error(`\n${result.buildFailures.filter((f) => f.featured).length} FEATURED game(s) failed to build -- exiting nonzero.`);
    process.exit(1);
  }
  if (result.buildFailures.length > 0) {
    console.error(`\n${result.buildFailures.length} non-featured game(s) failed to build (see above). Not treated as fatal.`);
  }
}

module.exports = { buildGamesSite, DEFAULT_SITE_CONFIG, playerCard, titleCardSVG, escapeHtml };
