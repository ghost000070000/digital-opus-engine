// Builds Digital Opus Engine's two distributable artifacts. No dependencies.
//
//   node build/build.js            build both artifacts
//   node build/build.js --verbose  also print a per-file size breakdown
//
// Artifact 1: dist/opus-engine.js
//   engine/src/*.js concatenated in filename order, wrapped in an IIFE that
//   exposes nothing but `window.Opus`. This is the file other developers
//   drop into their own page with one <script> tag.
//
// Artifact 2: dist/delivery-run.html
//   The same engine bundle (still IIFE-wrapped — the demo can only reach
//   engine internals through window.Opus, same as an outside developer
//   would) plus demo/src/*.js appended as a second, ordinary <script>,
//   inlined into one playable HTML page.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const startedAt = process.hrtime.bigint();

// Windows can briefly lock a just-served artifact while browser/antivirus
// inspection releases its read handle. Keep the build deterministic while
// tolerating only that narrow transient class; all other failures surface
// immediately, and a persistent lock still fails after five seconds.
function writeArtifact(file, contents) {
  // An unchanged build should not truncate a byte-identical public artifact.
  // Besides avoiding needless filesystem churn, this permits a second build
  // while Windows inspection still holds a handle on the first output.
  try { if (fs.readFileSync(file, 'utf8') === contents) return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (let attempt = 0; ; attempt++) {
    try { fs.writeFileSync(file, contents, 'utf8'); return; }
    catch (error) {
      if (!['UNKNOWN', 'EBUSY', 'EPERM'].includes(error.code) || attempt >= 20) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
}

const ROOT = path.resolve(__dirname, '..');
const ENGINE_SRC_DIR = path.join(ROOT, 'engine', 'src');
const DEMO_SRC_DIR = path.join(ROOT, 'demo', 'src');
// Explicit isolated output supports release/recovery qualification without
// replacing a browser-held development bundle. Default output is unchanged.
const outputIndex = process.argv.indexOf('--out-dir');
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error('--out-dir requires a directory');
const DIST_DIR = outputIndex < 0 ? path.join(ROOT, 'dist') : path.resolve(ROOT, process.argv[outputIndex + 1]);
if (!DIST_DIR.startsWith(ROOT + path.sep)) throw new Error('Build output must be inside the checkout');

const verbose = process.argv.includes('--verbose');

// The editor script is assembled from editor/src/modules before anything reads it.
require('./build-editor').buildEditor();

function readSourceDir(dir, label) {
  if (!fs.existsSync(dir)) {
    console.error(`No source directory found at ${path.relative(ROOT, dir)}`);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  if (files.length === 0) {
    console.error(`No ${label} source files found in ${path.relative(ROOT, dir)}`);
    process.exit(1);
  }
  if (label === 'engine' && files.some((file, index) => !file.startsWith(`${String(index + 1).padStart(2, '0')}-`))) {
    console.error('Engine source sequence must be contiguous from 01 in deterministic filename order.');
    process.exit(1);
  }
  const contents = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
  return { files, contents };
}

function concat(files, contents) {
  return files.map((f, i) => `// --- ${f} ---\n${contents[i]}`).join('\n');
}

// Strips /** JSDoc */ blocks from the shipped bundle — they're pure
// documentation weight at runtime. Source files keep them; docs/api-reference.md
// is maintained against readable source, not this stripped output.
function stripJSDoc(code) {
  return code
    .replace(/\/\*\*[\s\S]*?\*\//g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

// Dependency-free lexical compaction. Quoted strings and template literals
// are copied byte-for-byte; outside them, comments and unnecessary whitespace
// are removed while separators between identifier and ++/-- tokens remain.
function compact(code) {
  let out = '';
  let i = 0;
  const word = (c) => /[A-Za-z0-9_$]/.test(c || '');
  while (i < code.length) {
    const c = code[i];
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < code.length) {
        const q = code[i++];
        if (quote === '`' && /\s/.test(q)) {
          let lineBreak = q === '\n' || q === '\r';
          while (i < code.length && /\s/.test(code[i])) {
            if (code[i] === '\n' || code[i] === '\r') lineBreak = true;
            i++;
          }
          if (code[i] !== '`') out += lineBreak ? '\n' : ' ';
          continue;
        }
        out += q;
        if (q === '\\' && i < code.length) out += code[i++];
        else if (q === quote) break;
      }
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    if (/\s/.test(c)) {
      while (i < code.length && /\s/.test(code[i])) i++;
      const previous = out[out.length - 1];
      const next = code[i];
      if ((word(previous) && word(next)) || (previous === '+' && next === '+') || (previous === '-' && next === '-')) out += ' ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Private/internal identifiers are shortened only in generated artifacts.
// The readable source and every documented public name remain unchanged.
function mangleInternals(code) {
  const privateNames = [...new Set(code.match(/\b_[A-Za-z0-9_$]{2,}\b/g) || [])].sort();
  const internalNames = [
    'GameLoop', 'Renderer', 'initGL', 'captureScreenshot',
    'createColoredMesh', 'createCubeMesh',
    'createFullscreenQuad', 'createGridMesh', 'createMeshFromArrays',
    'createParticleGeometry', 'createPlaneMesh', 'createTerrainMesh',
    'LIT_FRAG_SRC', 'LIT_VERT_SRC', 'PARTICLE_FRAG_SRC', 'PARTICLE_VERT_SRC',
    'SKY_FRAG_SRC', 'SKY_VERT_SRC', 'TERRAIN_FRAG_SRC', 'TERRAIN_VERT_SRC',
    'WATER_FRAG_SRC', 'WATER_VERT_SRC', 'MAX_PARTICLES', 'DEFAULT_WAVES',
    'MESH_DATA', 'ENTITY_MESHES', 'getEntityRenderMesh', 'meshDescriptor',
    'randRange', 'fbm2D', 'hash2', 'smoothstepJS', 'valueNoise2D',
    'islandHeight', 'lerp3', 'terrainColor', 'canvasElement',
    'optionsObject', 'validateTerrainOptions', 'validateWaterOptions', 'validateWaves',
    'hudButtonStyle', 'fail', 'finite', 'positive', 'integer', 'vector', 'callback',
  ];
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  [...privateNames, ...internalNames].forEach((name, index) => {
    const alias = index < chars.length ? chars[index] : chars[index % chars.length] + Math.floor(index / chars.length);
    code = code.replace(new RegExp(`\\b${name}\\b`, 'g'), `_${alias}`);
  });
  return code;
}

function printBreakdown(label, files, contents) {
  if (!verbose) return;
  const rows = files.map((f, i) => ({ file: f, kb: contents[i].length / 1024 }));
  const widest = Math.max(...rows.map((r) => r.file.length));
  console.log(`${label} source breakdown:`);
  for (const row of rows) {
    console.log(`  ${row.file.padEnd(widest)}  ${row.kb.toFixed(1).padStart(6)} KB`);
  }
  console.log('');
}

const engine = readSourceDir(ENGINE_SRC_DIR, 'engine');
printBreakdown('Engine', engine.files, engine.contents);
const engineBody = mangleInternals(compact(stripJSDoc(concat(engine.files, engine.contents))));

fs.mkdirSync(DIST_DIR, { recursive: true });

// --- Artifact 1: opus-engine.js ---
const engineBundle = `/*! Digital Opus Engine v0.1.0 | MIT */
(function () {
'use strict';
${engineBody}
window.Opus = Opus;
})();
`;
const engineOutFile = path.join(DIST_DIR, 'opus-engine.js');
writeArtifact(engineOutFile, engineBundle);
const engineBytes = Buffer.byteLength(engineBundle);
const engineGzipBytes = zlib.gzipSync(engineBundle).length;
console.log(`Engine bundle  -> ${path.relative(ROOT, engineOutFile)} (${engineBytes} bytes, ${engineGzipBytes} gzip bytes, ${engine.files.length} files)`);
// No hard size ceiling: an editor UI layer (panels, palettes, visual
// scripting chrome) needs room to grow. Minification (compact + mangle,
// above) stays on regardless, so size grows from real features, not waste.

// --- Artifact 2: delivery-run.html ---
const demo = readSourceDir(DEMO_SRC_DIR, 'demo');
printBreakdown('Demo', demo.files, demo.contents);
const demoBody = concat(demo.files, demo.contents);

const demoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Delivery Run — made with Digital Opus Engine</title>
<style>
  html, body { margin: 0; height: 100%; background: #0a0e1a; overflow: hidden; }
  #game { width: 100%; height: 100%; display: block; touch-action: none; }
</style>
</head>
<body>
<canvas id="game"></canvas>
<script>
(function () {
'use strict';
${engineBody}
window.Opus = Opus;
})();
</script>
<script>
${demoBody}
</script>
</body>
</html>
`;
const demoOutFile = path.join(DIST_DIR, 'delivery-run.html');
writeArtifact(demoOutFile, demoHtml);
const demoBytes = Buffer.byteLength(demoHtml);
console.log(`Demo bundle    -> ${path.relative(ROOT, demoOutFile)} (${demoBytes} bytes, ${engine.files.length} engine + ${demo.files.length} demo files)`);

console.log(`Build duration -> ${(Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(1)} ms`);
