'use strict';

// Release-candidate staging only. Copies the already-built public Engine site,
// inventories it, and performs bounded path/secret scans. It does not deploy.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'dist', 'engine-site');
const RC = path.join(ROOT, 'release', 'rc1');
const STAGE = path.join(RC, 'digital-opus-engine-web');
if (!SOURCE.startsWith(ROOT) || !STAGE.startsWith(path.join(ROOT, 'release', 'rc1'))) throw new Error('Unsafe RC path');
if (!fs.existsSync(path.join(SOURCE, 'index.html'))) throw new Error('Build dist/engine-site first');

fs.mkdirSync(RC, { recursive: true });
fs.rmSync(STAGE, { recursive: true, force: true });
fs.cpSync(SOURCE, STAGE, { recursive: true, force: true });

function filesUnder(root) {
  const out = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(full);
    }
  }
  visit(root);
  return out.sort((a, b) => a.localeCompare(b));
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function rel(file) { return path.relative(STAGE, file).split(path.sep).join('/'); }

const files = filesUnder(STAGE);
const manifest = files.map(file => `${sha256(file)}  ${rel(file)}`).join('\n') + '\n';
fs.writeFileSync(path.join(RC, 'FILE-MANIFEST.sha256'), manifest);

const textExt = new Set(['.html', '.js', '.json', '.css', '.svg', '.txt', '.md', '.xml']);
const forbidden = [
  ['C:\\Users', /C:\\Users/gi], ['THINKPAD', /THINKPAD/gi], ['localhost', /localhost/gi],
  ['127.0.0.1', /127\.0\.0\.1/g], ['file://', /file:\/\//gi], ['node_modules', /node_modules/gi],
  ['rehabilitation-evidence', /rehabilitation-evidence/gi], ['public-showcase-review-v*', /public-showcase-review-v\d*/gi],
  ['.claude', /\.claude/gi], ['.git', /\.git(?:\/|\\|\b)/gi],
];
const secrets = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['openai-key', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['github-token', /\bgh[opusr]_[A-Za-z0-9_]{20,}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['generic-token', /\b(?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*["'][^"']{12,}["']/gi],
  ['credential-password', /\b(?:ftp[_-]?)?password\s*[:=]\s*["'][^"']{8,}["']/gi],
];
function scan(patterns) {
  const hits = [];
  for (const file of files) {
    if (!textExt.has(path.extname(file).toLowerCase())) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const [term, regex] of patterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text))) {
        hits.push({ term, file: rel(file), offset: match.index, excerpt: match[0].slice(0, 100) });
        if (!regex.global || hits.length > 500) break;
      }
    }
  }
  return hits;
}

const catalog = JSON.parse(fs.readFileSync(path.join(STAGE, 'games', 'catalog.json'), 'utf8'));
const entries = catalog.games || [];
const featured = entries.filter(game => game.featured || game.qualityTier === 'featured');
const samples = entries.filter(game => !featured.includes(game));
const primaryImages = entries.map(game => game.screenshot || game.screenshots?.gameplay || '').filter(Boolean);
const requiredRoots = ['index.html', 'editor', 'games', 'dist', 'build', 'DEPLOYMENT-README.txt'];
const report = {
  generatedAt: new Date().toISOString(),
  source: 'dist/engine-site',
  staging: 'release/rc1/digital-opus-engine-web',
  fileCount: files.length,
  uncompressedBytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0),
  requiredRoots: Object.fromEntries(requiredRoots.map(name => [name, fs.existsSync(path.join(STAGE, name))])),
  catalog: {
    total: entries.length,
    featured: featured.length,
    samples: samples.length,
    internal: entries.filter(game => game.visibility === 'internal').length,
    game29Present: entries.some(game => /(?:^|-)29(?:-|$)/.test(game.id || '')),
    stalePrimaryImages: primaryImages.filter(image => /public-showcase-review-v[34]/i.test(image)),
  },
  developmentPathHits: scan(forbidden),
  secretHits: scan(secrets),
};
fs.writeFileSync(path.join(RC, 'RC1-SCAN.json'), JSON.stringify(report, null, 2) + '\n');

const gitStatus = execFileSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' });
const gitIgnored = execFileSync('git', ['status', '--ignored', '--short', 'release', 'dist'], { cwd: ROOT, encoding: 'utf8' });
fs.writeFileSync(path.join(RC, 'SOURCE-GIT-STATUS.txt'), gitStatus);
fs.writeFileSync(path.join(RC, 'SOURCE-GIT-IGNORED.txt'), gitIgnored);

const zipPath = path.join(RC, 'digital-opus-engine-rc1.zip');
if (fs.existsSync(zipPath)) {
  fs.writeFileSync(path.join(RC, 'SHA256SUMS.txt'), `${sha256(zipPath)}  digital-opus-engine-rc1.zip\n`);
}

console.log(JSON.stringify(report, null, 2));
if (Object.values(report.requiredRoots).some(value => !value) || report.catalog.total !== 28 ||
    report.catalog.featured !== 4 || report.catalog.samples !== 24 || report.catalog.internal !== 0 ||
    report.catalog.game29Present || report.catalog.stalePrimaryImages.length || report.developmentPathHits.length || report.secretHits.length) {
  process.exitCode = 1;
}
