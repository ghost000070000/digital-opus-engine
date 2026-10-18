'use strict';
// Content Library: every shipped showcase model is reachable and categorized,
// game-specific landmarks are excluded, and the module boots before Start Blank.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/52-content-library.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/showcase/manifest.json'), 'utf8'));
const ctx = { Map, Promise, JSON, Error, fetch: async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(manifest)) }) };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('// --- Assets tab section ---')), ctx);

(async () => {
  const loaded = await ctx.loadContentLibraryManifest();
  assert(loaded.meshes.length > 50, 'library offers the showcase models');
  assert(loaded.meshes.every((m) => !m.key.startsWith('hero-')), 'game-specific landmarks are excluded');
  for (const m of loaded.meshes) assert(fs.existsSync(path.join(root, 'assets/showcase', m.file)), `model file exists: ${m.file}`);
  for (const m of loaded.meshes) assert(fs.existsSync(path.join(root, 'assets/showcase/thumbs', m.key + '.png')), `thumbnail exists: ${m.key} (node tools/generate-library-thumbnails.js)`);
  { const { decodePNG } = require('../tools/generate-library-thumbnails.js'); const thumb = decodePNG(fs.readFileSync(path.join(root, 'assets/showcase/thumbs/tree-oak.png'))); assert(thumb.width === 112 && thumb.height === 112, 'thumbnails are 112px'); assert(thumb.data[3] === 0, 'thumbnail corners are transparent'); let opaque = 0; for (let i = 3; i < thumb.data.length; i += 4) if (thumb.data[i] > 200) opaque++; assert(opaque > 1000, 'the model is actually drawn'); }
  for (const t of manifest.textures) assert(fs.existsSync(path.join(root, 'assets/showcase', t.file)), `texture exists: ${t.file}`);
  const group = (key) => ctx.contentLibraryGroup(loaded.meshes.find((m) => m.key === key)).id;
  assert.strictEqual(group('tree-oak'), 'nature');
  assert.strictEqual(group('rock-2'), 'nature');
  assert.strictEqual(group('arch'), 'fantasy');
  assert.strictEqual(group('terminal'), 'scifi');
  assert.strictEqual(group('ranger'), 'characters');
  assert.strictEqual(ctx.contentLibraryLabel('tree-oak'), 'Tree Oak');
  // Library tiles drag through the shared placement system.
  assert(source.includes('beginPlacementPointerDrag(event, { libraryModel: key }'), 'tiles start a placement drag');
  assert(fs.readFileSync(path.join(root, 'editor/src/modules/07-prefabs.js'), 'utf8').includes("typeof payload.libraryModel === 'string'"), 'drops commit library models');
  // Start Blank calls attachDefaultPlayerCharacter during boot.
  const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
  assert(modules.indexOf('52-content-library.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)), 'library initializes before the boot module');
  // The site ships the library without hero models.
  const site = fs.readFileSync(path.join(root, 'build/build-engine-site.js'), 'utf8');
  assert(site.includes("path.join(ROOT, 'assets', 'showcase')") && site.includes('hero-'), 'site build ships assets/showcase and filters hero models');
  console.log('Content Library: manifest, categories, files, boot order and site packaging PASS');
})().catch((error) => { console.error(error); process.exit(1); });
