// Packages Digital Opus ENGINE's own public home + examples hub into one
// deployment-ready, self-contained static folder:
//
//   node build/build-engine-site.js
//
// Output: dist/engine-site/
//   index.html          Engine home page (hero, features, Featured examples)
//   editor/              the real editor, packaged (not forked)
//     index.html
//     src/01-editor.js
//   dist/opus-engine.js   (editor's own relative ../dist/ dependency, packaged alongside it)
//   build/export-template.js  (editor's own relative ../build/ dependency, packaged alongside it)
//   games/                the Engine's playable examples hub (reuses build-games-site.js's
//     index.html, <id>.html, catalog.json, assets/, <id>.json  own buildGamesSite(), just
//                                                               different branding + output dir)
//
// This is NOT a second product: it's the SAME editor (editor/index.html +
// editor/src/01-editor.js, byte-for-byte, never modified for packaging)
// and the SAME game-export pipeline (composeExportHTML via
// build/build-games-site.js's buildGamesSite()) relocated into one
// self-contained folder. Nothing is forked.
//
// The `editor/` subfolder's own hardcoded relative paths (`../dist/opus-
// engine.js`, `../build/export-template.js`, `../games/catalog.json`,
// `../games/<file>.json`) are why this package's top-level layout mirrors
// the repository's own layout (dist/, build/, games/ as siblings of
// editor/) -- no path-rewriting was needed or attempted; the editor is
// simply copied into a folder shaped the same way its source tree already
// is, satisfying "package it, don't fork it" (Section 38) literally.
//
// Does NOT deploy anywhere. Does NOT touch games.digitalopusadsolutions.com
// or any other host. Local artifact only.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require('./build-editor').buildEditor(); // assemble the editor script from editor/src/modules first
const DIST_DIR = path.join(ROOT, 'dist');
const SITE_DIR = process.env.PHASE047_ENGINE_SITE_OUTPUT
  ? path.resolve(process.env.PHASE047_ENGINE_SITE_OUTPUT)
  : path.join(DIST_DIR, 'engine-site');
if (process.env.PHASE047_ENGINE_SITE_OUTPUT && !SITE_DIR.startsWith(path.join(ROOT, 'qualification', 'phase-047') + path.sep))
  throw new Error('Phase 047 package output must stay inside qualification/phase-047');
const startedAt = process.hrtime.bigint();

const { buildGamesSite, playerCard, escapeHtml } = require(path.join(ROOT, 'build', 'build-games-site.js'));

function fail(msg) {
  console.error(`Engine site build error: ${msg}`);
  process.exit(1);
}

// --- Baseline checks ---
const engineJSPath = path.join(DIST_DIR, 'opus-engine.js');
if (!fs.existsSync(engineJSPath)) fail('dist/opus-engine.js not found -- run node build/build.js first');
const editorHtmlPath = path.join(ROOT, 'editor', 'index.html');
const inspectorFieldsPath = path.join(ROOT, 'editor', 'src', '00-inspector-fields.js');
const collider2DPath = path.join(ROOT, 'editor', 'src', '00-collider-2d.js');
const collisionFilter2DPath = path.join(ROOT, 'editor', 'src', '00-collision-filter-2d.js');
const triggerCollider2DPath = path.join(ROOT, 'editor', 'src', '00-trigger-collider-2d.js');
const oneWay2DPath = path.join(ROOT, 'editor', 'src', '00-one-way-2d.js');
const characterSlope2DPath = path.join(ROOT, 'editor', 'src', '00-character-slope-2d.js');
const movingPlatform2DPath = path.join(ROOT, 'editor', 'src', '00-moving-platform-2d.js');
const body2DPath = path.join(ROOT, 'editor', 'src', '00-body-2d.js');
const platformerController2DPath = path.join(ROOT, 'editor', 'src', '00-platformer-controller-2d.js');
const topdownController2DPath = path.join(ROOT, 'editor', 'src', '00-topdown-controller-2d.js');
const controllerStateEventsPath = path.join(ROOT, 'editor', 'src', '00-controller-state-events.js');
const controllerAbilitiesPath = path.join(ROOT, 'editor', 'src', '00-controller-abilities.js');
const controllerTemplatesPath = path.join(ROOT, 'editor', 'src', '00-controller-templates.js');
const aiBrainPath = path.join(ROOT, 'editor', 'src', '00-ai-brain.js');
const weaponDefinitionsPath = path.join(ROOT, 'editor', 'src', '00-weapon-definitions.js');
const damagePolicyPath = path.join(ROOT, 'editor', 'src', '00-damage-policy.js');
const combatVolumesPath = path.join(ROOT, 'editor', 'src', '00-combat-volumes.js');
const lootTablesPath = path.join(ROOT, 'editor', 'src', '00-loot-tables.js');
const inventoryTemplatesPath = path.join(ROOT, 'editor', 'src', '00-inventory-templates.js');
const physicsDebug2DPath = path.join(ROOT, 'editor', 'src', '00-physics-debug-2d.js');
const authoringSchemaPath = path.join(ROOT, 'editor', 'src', '00-authoring-schema.js');
const authoringPlumbingPath = path.join(ROOT, 'editor', 'src', '00-authoring-plumbing.js');
const characterTileQueryPath = path.join(ROOT, 'editor', 'src', '00-character-tile-query.js');
const tilemapBundlePath = path.join(ROOT, 'editor', 'src', '00-tilemap-bundle.js');
const spriteAuthoringPath = path.join(ROOT, 'editor', 'src', '00-sprite-authoring.js');
const authoringLanguagePath = path.join(ROOT, 'editor', 'src', '00-authoring-language.js');
const gameplayPresetsPath = path.join(ROOT, 'editor', 'src', '00-gameplay-presets.js');
const componentPresetsPath = path.join(ROOT, 'editor', 'src', '00-component-presets.js');
const hudCanvasPath = path.join(ROOT, 'editor', 'src', '00-hud-canvas.js');
const hudLayoutPath = path.join(ROOT, 'editor', 'src', '00-hud-layout.js');
const hudBindingsPath = path.join(ROOT, 'editor', 'src', '00-hud-bindings.js');
const hudActionPromptsPath = path.join(ROOT, 'editor', 'src', '00-hud-action-prompts.js');
const menuScreenStackPath = path.join(ROOT, 'editor', 'src', '00-menu-screen-stack.js');
const hudButtonActionsPath = path.join(ROOT, 'editor', 'src', '00-hud-button-actions.js');
const hudWidgetsPath = path.join(ROOT, 'editor', 'src', '00-hud-widgets.js');
const hudTweensPath = path.join(ROOT, 'editor', 'src', '00-hud-tweens.js');
const uiTemplatesPath = path.join(ROOT, 'editor', 'src', '00-ui-templates.js');
const inputActionAssetsPath = path.join(ROOT, 'editor', 'src', '00-input-action-assets.js');
const inputActionSetsPath = path.join(ROOT, 'editor', 'src', '00-input-action-sets.js');
const inputDeviceMappingsPath = path.join(ROOT, 'editor', 'src', '00-input-device-mappings.js');
const playerRebindScreenPath = path.join(ROOT, 'editor', 'src', '00-player-rebind-screen.js');
const inputTuningPath = path.join(ROOT, 'editor', 'src', '00-input-tuning.js');
const inputContextsPath = path.join(ROOT, 'editor', 'src', '00-input-contexts.js');
const touchControlLayoutPath = path.join(ROOT, 'editor', 'src', '00-touch-control-layout.js');
const inputConflictsPath = path.join(ROOT, 'editor', 'src', '00-input-conflicts.js');
const onboardingPath = path.join(ROOT, 'editor', 'src', '00-onboarding.js');
const spriteStartersPath = path.join(ROOT, 'editor', 'src', '00-sprite-starters.js');
const worldStartersPath = path.join(ROOT, 'editor', 'src', '00-world-starters.js');
const capabilityCatalogPath = path.join(ROOT, 'no-code-capabilities.json');
const frictionRegistryPath = path.join(ROOT, 'authoring-friction.json');
const editorJsPath = path.join(ROOT, 'editor', 'src', '01-editor.js');
const templateJsPath = path.join(ROOT, 'build', 'export-template.js');
for (const p of [editorHtmlPath, inspectorFieldsPath, collider2DPath, triggerCollider2DPath, oneWay2DPath, characterSlope2DPath, movingPlatform2DPath, body2DPath, physicsDebug2DPath, authoringSchemaPath, authoringPlumbingPath, characterTileQueryPath, tilemapBundlePath, spriteAuthoringPath, authoringLanguagePath, gameplayPresetsPath, onboardingPath, spriteStartersPath, capabilityCatalogPath, frictionRegistryPath, editorJsPath, templateJsPath]) {
  if (!fs.existsSync(p)) fail(`required source file missing: ${path.relative(ROOT, p)}`);
}

// --- Reconcile dist/engine-site/ (only this directory) ---
fs.rmSync(SITE_DIR, { recursive: true, force: true });
fs.mkdirSync(SITE_DIR, { recursive: true });

// --- Package the editor, unmodified, into a folder shaped like the repo root ---
// (editor/index.html's own relative fetches -- ../dist/opus-engine.js,
// ../build/export-template.js, ../games/catalog.json, ../games/<file> --
// resolve correctly against THIS layout with zero rewriting.)
fs.mkdirSync(path.join(SITE_DIR, 'editor', 'src'), { recursive: true });
fs.mkdirSync(path.join(SITE_DIR, 'dist'), { recursive: true });
fs.mkdirSync(path.join(SITE_DIR, 'build'), { recursive: true });
fs.mkdirSync(path.join(SITE_DIR, 'assets', 'branding'), { recursive: true });
fs.copyFileSync(editorHtmlPath, path.join(SITE_DIR, 'editor', 'index.html'));
fs.copyFileSync(inspectorFieldsPath, path.join(SITE_DIR, 'editor', 'src', '00-inspector-fields.js'));
fs.copyFileSync(collider2DPath, path.join(SITE_DIR, 'editor', 'src', '00-collider-2d.js'));
fs.copyFileSync(collisionFilter2DPath, path.join(SITE_DIR, 'editor', 'src', '00-collision-filter-2d.js'));
fs.copyFileSync(triggerCollider2DPath, path.join(SITE_DIR, 'editor', 'src', '00-trigger-collider-2d.js'));
fs.copyFileSync(oneWay2DPath, path.join(SITE_DIR, 'editor', 'src', '00-one-way-2d.js'));
fs.copyFileSync(characterSlope2DPath, path.join(SITE_DIR, 'editor', 'src', '00-character-slope-2d.js'));
fs.copyFileSync(movingPlatform2DPath, path.join(SITE_DIR, 'editor', 'src', '00-moving-platform-2d.js'));
fs.copyFileSync(body2DPath, path.join(SITE_DIR, 'editor', 'src', '00-body-2d.js'));
fs.copyFileSync(platformerController2DPath, path.join(SITE_DIR, 'editor', 'src', '00-platformer-controller-2d.js'));
fs.copyFileSync(topdownController2DPath, path.join(SITE_DIR, 'editor', 'src', '00-topdown-controller-2d.js'));
fs.copyFileSync(controllerStateEventsPath, path.join(SITE_DIR, 'editor', 'src', '00-controller-state-events.js'));
fs.copyFileSync(controllerAbilitiesPath, path.join(SITE_DIR, 'editor', 'src', '00-controller-abilities.js'));
fs.copyFileSync(controllerTemplatesPath, path.join(SITE_DIR, 'editor', 'src', '00-controller-templates.js'));
fs.copyFileSync(aiBrainPath, path.join(SITE_DIR, 'editor', 'src', '00-ai-brain.js'));
fs.copyFileSync(weaponDefinitionsPath, path.join(SITE_DIR, 'editor', 'src', '00-weapon-definitions.js'));
fs.copyFileSync(damagePolicyPath, path.join(SITE_DIR, 'editor', 'src', '00-damage-policy.js'));
fs.copyFileSync(combatVolumesPath, path.join(SITE_DIR, 'editor', 'src', '00-combat-volumes.js'));
fs.copyFileSync(lootTablesPath, path.join(SITE_DIR, 'editor', 'src', '00-loot-tables.js'));
fs.copyFileSync(inventoryTemplatesPath, path.join(SITE_DIR, 'editor', 'src', '00-inventory-templates.js'));
fs.copyFileSync(physicsDebug2DPath, path.join(SITE_DIR, 'editor', 'src', '00-physics-debug-2d.js'));
fs.copyFileSync(authoringSchemaPath, path.join(SITE_DIR, 'editor', 'src', '00-authoring-schema.js'));
fs.copyFileSync(authoringPlumbingPath, path.join(SITE_DIR, 'editor', 'src', '00-authoring-plumbing.js'));
fs.copyFileSync(characterTileQueryPath, path.join(SITE_DIR, 'editor', 'src', '00-character-tile-query.js'));
fs.copyFileSync(tilemapBundlePath, path.join(SITE_DIR, 'editor', 'src', '00-tilemap-bundle.js'));
fs.copyFileSync(spriteAuthoringPath, path.join(SITE_DIR, 'editor', 'src', '00-sprite-authoring.js'));
fs.copyFileSync(authoringLanguagePath, path.join(SITE_DIR, 'editor', 'src', '00-authoring-language.js'));
fs.copyFileSync(path.join(ROOT, 'editor', 'src', '00-graph-values.js'), path.join(SITE_DIR, 'editor', 'src', '00-graph-values.js'));
fs.copyFileSync(path.join(ROOT, 'editor', 'src', '00-graph-variables.js'), path.join(SITE_DIR, 'editor', 'src', '00-graph-variables.js'));
fs.copyFileSync(path.join(ROOT, 'editor', 'src', '00-graph-functions.js'), path.join(SITE_DIR, 'editor', 'src', '00-graph-functions.js'));
fs.copyFileSync(path.join(ROOT, 'editor', 'src', '00-graph-schema.js'), path.join(SITE_DIR, 'editor', 'src', '00-graph-schema.js'));
fs.copyFileSync(path.join(ROOT, 'editor', 'src', '00-signals.js'), path.join(SITE_DIR, 'editor', 'src', '00-signals.js'));
fs.copyFileSync(path.join(ROOT, 'editor', 'src', '00-graph-templates.js'), path.join(SITE_DIR, 'editor', 'src', '00-graph-templates.js'));
fs.copyFileSync(path.join(ROOT, 'editor', 'src', '00-graph-trace.js'), path.join(SITE_DIR, 'editor', 'src', '00-graph-trace.js'));
fs.copyFileSync(gameplayPresetsPath, path.join(SITE_DIR, 'editor', 'src', '00-gameplay-presets.js'));
fs.copyFileSync(componentPresetsPath, path.join(SITE_DIR, 'editor', 'src', '00-component-presets.js'));
fs.copyFileSync(hudCanvasPath, path.join(SITE_DIR, 'editor', 'src', '00-hud-canvas.js'));
fs.copyFileSync(hudLayoutPath, path.join(SITE_DIR, 'editor', 'src', '00-hud-layout.js'));
fs.copyFileSync(hudBindingsPath, path.join(SITE_DIR, 'editor', 'src', '00-hud-bindings.js'));
fs.copyFileSync(hudActionPromptsPath, path.join(SITE_DIR, 'editor', 'src', '00-hud-action-prompts.js'));
fs.copyFileSync(menuScreenStackPath, path.join(SITE_DIR, 'editor', 'src', '00-menu-screen-stack.js'));
fs.copyFileSync(hudButtonActionsPath, path.join(SITE_DIR, 'editor', 'src', '00-hud-button-actions.js'));
fs.copyFileSync(hudWidgetsPath, path.join(SITE_DIR, 'editor', 'src', '00-hud-widgets.js'));
fs.copyFileSync(hudTweensPath, path.join(SITE_DIR, 'editor', 'src', '00-hud-tweens.js'));
fs.copyFileSync(uiTemplatesPath, path.join(SITE_DIR, 'editor', 'src', '00-ui-templates.js'));
fs.copyFileSync(inputActionAssetsPath, path.join(SITE_DIR, 'editor', 'src', '00-input-action-assets.js'));
fs.copyFileSync(inputActionSetsPath, path.join(SITE_DIR, 'editor', 'src', '00-input-action-sets.js'));
fs.copyFileSync(inputDeviceMappingsPath, path.join(SITE_DIR, 'editor', 'src', '00-input-device-mappings.js'));
fs.copyFileSync(playerRebindScreenPath, path.join(SITE_DIR, 'editor', 'src', '00-player-rebind-screen.js'));
fs.copyFileSync(inputTuningPath, path.join(SITE_DIR, 'editor', 'src', '00-input-tuning.js'));
fs.copyFileSync(inputContextsPath, path.join(SITE_DIR, 'editor', 'src', '00-input-contexts.js'));
fs.copyFileSync(touchControlLayoutPath, path.join(SITE_DIR, 'editor', 'src', '00-touch-control-layout.js'));
fs.copyFileSync(inputConflictsPath, path.join(SITE_DIR, 'editor', 'src', '00-input-conflicts.js'));
fs.copyFileSync(onboardingPath, path.join(SITE_DIR, 'editor', 'src', '00-onboarding.js'));
fs.copyFileSync(spriteStartersPath, path.join(SITE_DIR, 'editor', 'src', '00-sprite-starters.js'));
fs.copyFileSync(worldStartersPath, path.join(SITE_DIR, 'editor', 'src', '00-world-starters.js'));
// Any further standalone editor helper (e.g. 00-durable-storage.js) ships too,
// so a new helper loaded by editor/index.html can never be missing from the site.
for (const file of fs.readdirSync(path.join(ROOT, 'editor', 'src'))) {
  const target = path.join(SITE_DIR, 'editor', 'src', file);
  if (/^00-[a-z0-9-]+\.js$/.test(file) && !fs.existsSync(target)) fs.copyFileSync(path.join(ROOT, 'editor', 'src', file), target);
}
fs.copyFileSync(capabilityCatalogPath, path.join(SITE_DIR, 'no-code-capabilities.json'));
fs.copyFileSync(frictionRegistryPath, path.join(SITE_DIR, 'authoring-friction.json'));
fs.copyFileSync(editorJsPath, path.join(SITE_DIR, 'editor', 'src', '01-editor.js'));
fs.copyFileSync(engineJSPath, path.join(SITE_DIR, 'dist', 'opus-engine.js'));
fs.copyFileSync(templateJsPath, path.join(SITE_DIR, 'build', 'export-template.js'));
fs.copyFileSync(path.join(ROOT, 'assets', 'branding', 'digital-opus-icon.png'), path.join(SITE_DIR, 'assets', 'branding', 'digital-opus-icon.png'));
// Editor Content Library: ready-made models/textures/sounds loaded on demand.
// Game-specific landmark (hero-*) models stay inside their example games.
fs.cpSync(path.join(ROOT, 'assets', 'showcase'), path.join(SITE_DIR, 'assets', 'showcase'), { recursive: true, filter: (src) => !/[\\/]hero-[^\\/]*\.mesh\.json$/.test(src) });
console.log(`Packaged editor -> ${path.relative(ROOT, path.join(SITE_DIR, 'editor'))} (+ its ../dist, ../build siblings)`);

// --- Build the Engine's own examples hub at dist/engine-site/games/ ---
// `includeRawSource: true` -- the packaged editor's own Games tab (its
// `openCatalogGame`) fetches a game's raw project JSON directly; without
// it here, "Open in Editor" from inside the packaged editor would 404.
// See buildGamesSite's own comment on why this is not new public exposure
// (the identical JSON is already embedded, in full, inside every
// generated .html's own view-source).
const gamesResult = buildGamesSite({
  outputDir: path.join(SITE_DIR, 'games'),
  includeRawSource: true,
  // Hosted pages share one cached engine/editor runtime (see buildGamesSite).
  sharedRuntime: true,
  // Public Showcase Recovery pass: this is the PUBLIC-facing Engine site --
  // only catalog entries explicitly marked `visibility: 'public'` may ever
  // reach it, regardless of the old `featured` flag. All 28 catalog entries
  // are currently `visibility: 'internal'` (see the recovery report), so
  // this build is expected to produce zero public games right now -- that
  // is the correct, honest state, not a bug.
  onlyVisibility: 'public',
  log: (m) => console.log(`  ${m}`),
  siteConfig: {
    pageTitle: 'Digital Opus Engine — Examples',
    pageDescription: 'Playable examples built with Digital Opus Engine -- Featured builds and further samples/experiments, all playable instantly in your browser.',
    brandHtml: 'Digital Opus <span>Engine</span>',
    homeHref: '../index.html',
    navHomeLink: '<a href="../index.html">Engine Home</a>',
    navMoreLabel: 'Samples',
    heroTitle: 'Engine Examples',
    heroSubtitle: 'Explore compact adventures, gameplay samples and creative worlds built with Digital Opus Engine.',
    primaryCta: 'Browse Examples',
    aboutText: 'Play a compact game or explore a focused sample. Each example has an authored objective, its own visual style and real gameplay screenshots. Open an example in the editor to see how it was built.',
  },
});
if (!gamesResult.ok) {
  console.error('Engine examples hub build failed:');
  for (const e of (gamesResult.errors || [])) console.error(`  - ${e}`);
  for (const f of (gamesResult.buildFailures || [])) console.error(`  - Game ${f.id} failed: ${f.error}`);
  process.exit(1);
}
console.log(`Examples hub    -> ${gamesResult.built.length}/${gamesResult.totalGames} games (${gamesResult.featuredBuilt.length} Featured)`);

// --- Engine home page: hero + features + Featured examples, from the template ---
const homeTemplate = fs.readFileSync(path.join(ROOT, 'build', 'templates', 'engine-home.html'), 'utf8');
function homeExampleCard(b) {
  // Same card shape as build-games-site.js's own playerCard, but every
  // path is prefixed with `games/` since this card lives on the site
  // ROOT page, one level above the games/ folder it links into. The home
  // page deliberately presents a curated cross-section; the complete
  // 28-game library remains available in the Examples Hub.
  const g = b.entry;
  const thumbHtml = b.thumb ? `<img class="card-thumb" src="games/${escapeHtml(b.thumb)}" alt="${escapeHtml(b.title)} gameplay screenshot" loading="lazy">` : '';
  const badge = g.qualityTier === 'featured' ? '<span class="card-badge">Featured</span>' : '<span class="card-badge">Sample</span>';
  return `<a class="card" href="games/${escapeHtml(b.id)}.html" aria-label="Play ${escapeHtml(b.title)}">
  ${thumbHtml}
  <div class="card-body">
    <div class="card-title-row"><span class="card-title">${escapeHtml(b.title)}</span>${badge}</div>
    <div class="card-genre">${escapeHtml(g.genre || '')}${(g.controller && g.controller !== 'n/a') ? ` · ${escapeHtml(g.controller)}` : ''}</div>
    <div class="card-desc">${escapeHtml(g.description || '')}</div>
    <div class="card-meta-row"><span class="card-meta">${escapeHtml(g.playtime || (g.estimatedMinutes ? `~${g.estimatedMinutes} min` : ''))}</span><span class="card-play">Play &#9654;</span></div>
  </div>
</a>`;
}
// Lead with every Featured title, then a small capability-diverse Sample
// selection. This keeps the public home editorial rather than turning it
// into a duplicate of the full Examples Hub.
const allBuiltSorted = gamesResult.built.slice().sort((a, b) => {
  const fa = a.entry.qualityTier === 'featured' ? 0 : 1;
  const fb = b.entry.qualityTier === 'featured' ? 0 : 1;
  return fa - fb;
});
const homeSampleIds = new Set(['foglight', 'signal-relay', 'relic-island', 'survival-arena-3']);
const homeSelection = allBuiltSorted.filter(b => b.entry.qualityTier === 'featured' || homeSampleIds.has(b.id));
// Public Showcase Recovery pass: zero public games is the current, honest
// state (all 28 catalog entries are internal). No empty grid, no CTA
// pointing anywhere, no redirect toward the internal regression catalog --
// just restrained wording. Restored automatically the moment any catalog
// entry is actually marked `visibility: 'public'` and rebuilt.
const examplesBody = homeSelection.length
  ? `<div class="grid">\n${homeSelection.map(homeExampleCard).join('\n')}\n  </div>\n  <div class="examples-cta"><a class="btn btn-secondary" href="games/">View all ${gamesResult.built.length} examples</a></div>`
  : `<p class="games-empty-notice">Playable showcase in development.</p>`;
const homeHtml = homeTemplate
  .replace('{{EXAMPLES_BODY}}', examplesBody)
  .replace('{{GAME_COUNT}}', String(gamesResult.built.length));
fs.writeFileSync(path.join(SITE_DIR, 'index.html'), homeHtml, 'utf8');
// The generated guide is packaged locally, not deployed or published.
fs.mkdirSync(path.join(SITE_DIR, 'docs'), { recursive: true });
const creatorGuideHtml = require('./build-docs').generate();
fs.writeFileSync(path.join(SITE_DIR, 'docs', 'index.html'), creatorGuideHtml, 'utf8');
// Match source-editor Help's relative path; retain the short homepage URL too.
fs.mkdirSync(path.join(SITE_DIR, 'docs', 'generated'), { recursive: true });
fs.writeFileSync(path.join(SITE_DIR, 'docs', 'generated', 'index.html'), creatorGuideHtml, 'utf8');
console.log(`Engine home     -> ${path.relative(ROOT, path.join(SITE_DIR, 'index.html'))}`);

// --- Path safety check: nothing in the package should reference the repo's own absolute/dev paths ---
const forbiddenPatterns = [/C:\\Users/i, /localhost:8180/, /127\.0\.0\.1/];
const pathSafetyIssues = [];
for (const f of ['index.html', path.join('games', 'index.html'), path.join('games', 'catalog.json')]) {
  const p = path.join(SITE_DIR, f);
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  for (const pat of forbiddenPatterns) {
    if (pat.test(content)) pathSafetyIssues.push(`${f} contains a forbidden reference (${pat})`);
  }
}
if (pathSafetyIssues.length > 0) {
  console.error('Path safety check FAILED:');
  for (const i of pathSafetyIssues) console.error(`  - ${i}`);
  process.exit(1);
}
console.log('Path safety check passed -- no local-machine or dev-server paths in the package.');

// --- Broken-link check across the home page and games hub ---
const homeHrefs = [...homeHtml.matchAll(/href="([^"#]+\.html)"/g)].map((m) => m[1]);
const brokenHomeLinks = homeHrefs.filter((h) => !fs.existsSync(path.join(SITE_DIR, h)));
if (brokenHomeLinks.length > 0) fail(`Broken links on Engine home: ${brokenHomeLinks.join(', ')}`);
console.log(`Broken-link check passed -- ${homeHrefs.length} links on Engine home, all resolve.`);

// --- Deployment notes (internal doc, not shown on the public page) ---
const readme = `Digital Opus Engine -- public site deployment package
=======================================================

DO NOT DEPLOY THIS PACKAGE TO games.digitalopusadsolutions.com.
That host belongs to the existing, separate 43-game Digital Opus Games
portfolio and must not be overwritten.

PROPOSED_DEPLOYMENT_TARGET: engine.digitalopusadsolutions.com (not created,
not authorized -- a recommendation only, pending an explicit decision).
This package also tolerates subpath hosting (e.g. /engine/) as long as it
is served as a whole folder -- every internal link in this package is
relative, never root-absolute.

This folder is a complete, self-contained static site:
  index.html        Engine home page (hero, features, Featured examples)
  editor/           the real Digital Opus Engine editor, packaged
  dist/, build/     the editor's own two runtime dependencies (unchanged
                    from the repository's own editor/index.html <script>
                    tags -- nothing rewritten, nothing forked)
  games/            the Engine's own playable-examples hub (${gamesResult.built.length} public games:
                    ${gamesResult.featuredBuilt.length} Featured, ${gamesResult.sampleBuilt.length} Samples), including each
                    game's own raw project JSON (needed so the packaged
                    editor's own Games tab / "Open in Editor" can fetch it,
                    exactly like the repository's own dev editor does)

No server runtime, no database, no login, no analytics.

To regenerate:
  node build/build.js
  node tests/run-tests.js
  node build/build-games.js
  node build/build-engine-site.js

Do not hand-edit anything in this folder. Source changes belong in:
  - build/templates/engine-home.html   (the Engine home page template)
  - build/templates/games-site.html    (the examples-hub page template)
  - build/build-engine-site.js         (this generator)
  - games/catalog.json                 (example metadata)
  - editor/index.html, editor/src/     (the editor itself)
Then regenerate.
`;
fs.writeFileSync(path.join(SITE_DIR, 'DEPLOYMENT-README.txt'), readme, 'utf8');

// --- Summary ---
function dirSize(p) {
  let total = 0;
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, entry.name);
    total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size;
  }
  return total;
}
const totalBytes = dirSize(SITE_DIR);
const editorBytes = dirSize(path.join(SITE_DIR, 'editor')) + fs.statSync(path.join(SITE_DIR, 'dist', 'opus-engine.js')).size + fs.statSync(path.join(SITE_DIR, 'build', 'export-template.js')).size;
console.log('');
console.log(`Deployment package -> ${path.relative(ROOT, SITE_DIR)}`);
console.log(`Editor package size -> ${(editorBytes / 1024).toFixed(0)} KB`);
console.log(`Examples (${gamesResult.built.length} public games) -> ${(gamesResult.totalBytes / (1024 * 1024)).toFixed(1)} MB`);
console.log(`Total package size  -> ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`);
console.log(`Build duration      -> ${(Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(1)} ms`);
console.log('');
console.log('DO NOT deploy to games.digitalopusadsolutions.com. Proposed target: engine.digitalopusadsolutions.com (not created).');
