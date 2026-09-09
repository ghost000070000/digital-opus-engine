// Shared, dependency-free public showcase qualification. This checks evidence
// and authored data, never assigns a visual score or promotes a game itself.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { assetProvenanceIssues } = require('./asset-provenance');
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function projectLevels(project) {
  return Array.isArray(project && project.levels) ? project.levels : [project || {}];
}

function resolveTitle(project, catalogTitle) {
  const levels = projectLevels(project);
  const first = levels[project && project.startLevelIndex || 0] || levels[0];
  return (project && project.meta && project.meta.title) || (first.ui && first.ui.startScreen && first.ui.startScreen.title) || catalogTitle || 'Digital Opus Game';
}

function identityMismatches(entry, project, generatedTitle) {
  const values = [['project meta title', project && project.meta && project.meta.title], ['generated HTML title', generatedTitle]];
  projectLevels(project).forEach((level, i) => {
    const screen = level.ui && level.ui.startScreen;
    if (screen && screen.enabled) values.push([`level ${i + 1} Start Screen title`, screen.title]);
  });
  return values.filter(([, title]) => title !== entry.title).map(([label, title]) => `${label} (${JSON.stringify(title)}) must match catalog title (${JSON.stringify(entry.title)})`);
}

function suspectedTestFixtureAssets(project) {
  return ((project && project.assets) || []).filter((asset) => {
    const identifiers = [asset.id, asset.name, asset.sourceFilename, ...(asset.tags || [])].filter(Boolean).join(' ');
    return /skinned[-_ ]?bend|test[-_ ]?fixture|diagnostic[-_ ]?mesh|bend[-_ ]?ribbon|mist-guardian\.gltf/i.test(identifiers)
      || (asset.type === 'skinnedMesh' && Array.isArray(asset.positions) && asset.positions.length / 3 < 24);
  }).map((asset) => `${asset.name || asset.id}: known or suspected diagnostic mesh`);
}

function screenshotRecords(entry) {
  const shots = entry.screenshots || {};
  return Object.entries({ ...shots, gameplay: shots.gameplay || entry.screenshot }).filter(([, value]) => value).map(([role, file]) => ({ role, file }));
}

function validateScreenshot(root, entry, role, file) {
  const prefix = `public-showcase-review/${entry.id}/`;
  if (typeof file !== 'string' || file !== `${prefix}${role}.png` || !['opening', 'gameplay', 'highlight'].includes(role)) return `screenshot ${role} must be ${prefix}${role}.png`;
  const reviewRoot = path.resolve(root, 'public-showcase-review', entry.id);
  const full = path.resolve(root, file);
  if (!full.startsWith(reviewRoot + path.sep)) return `screenshot path escapes review directory: ${file}`;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return `screenshot missing: ${file}`;
  const realRoot = fs.realpathSync(reviewRoot);
  const permittedRoot = fs.realpathSync(root) + path.sep + 'public-showcase-review' + path.sep;
  if (!realRoot.startsWith(permittedRoot)) return `screenshot directory escapes repository: ${file}`;
  if (!fs.realpathSync(full).startsWith(realRoot + path.sep)) return `screenshot symlink escapes review directory: ${file}`;
  try {
    const png = fs.readFileSync(full);
    if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('not a PNG');
    if (png.toString('ascii', 12, 16) !== 'IHDR' || png.readUInt32BE(16) < 640 || png.readUInt32BE(20) < 360) throw new Error('must be at least 640 by 360');
    let offset = 8, ended = false;
    const compressed = [];
    while (offset + 12 <= png.length) {
      const size = png.readUInt32BE(offset);
      if (offset + size + 12 > png.length) throw new Error('truncated PNG chunk');
      const kind = png.toString('ascii', offset + 4, offset + 8);
      if (crc32(png.subarray(offset + 4, offset + size + 8)) !== png.readUInt32BE(offset + size + 8)) throw new Error('PNG checksum mismatch');
      if (kind === 'IDAT') compressed.push(png.subarray(offset + 8, offset + size + 8));
      if (kind === 'IEND') { ended = true; break; }
      offset += size + 12;
    }
    if (!ended || !compressed.length) throw new Error('missing image data');
    if (zlib.inflateSync(Buffer.concat(compressed), { maxOutputLength: 128 * 1024 * 1024 }).length === 0) throw new Error('empty image data');
  } catch (error) { return `invalid screenshot ${file}: ${error.message}`; }
  return null;
}

function validatePublicGame(entry, project, { root, generatedTitle = resolveTitle(project, entry.title) }) {
  if (entry.visibility !== 'public') return [];
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  check(['featured', 'sample'].includes(entry.qualityTier), 'public qualityTier must be featured or sample');
  check(entry.playable === true, 'public game must be playable');
  check(entry.featured === (entry.qualityTier === 'featured'), 'featured flag must agree with qualityTier');
  for (const field of ['title', 'purpose', 'description', 'genre', 'controller', 'playtime']) check(typeof entry[field] === 'string' && entry[field].trim().length > 0, `missing public ${field}`);
  check(entry.controller !== 'n/a', 'public controller must describe real controls');
  const review = entry.qualityReview || {};
  for (const field of ['visual', 'gameplayClarity', 'presentation', 'audio']) check(Number.isFinite(review[field]) && review[field] >= 1 && review[field] <= 5, `qualityReview.${field} must be 1–5`);
  check(review.standaloneVerified === true, 'standalone must be verified by actual play');
  check(review.licenseVerified === true, 'asset licensing must be verified against provenance records');
  errors.push(...assetProvenanceIssues(project, root));
  check(review.noPlaceholders === true, 'visual review must confirm no broken placeholders');
  check(typeof review.reviewedAt === 'string' && Number.isFinite(Date.parse(review.reviewedAt)), 'reviewedAt must record the actual review date');
  const floor = entry.qualityTier === 'featured' ? 4 : 3;
  for (const field of ['visual', 'gameplayClarity', 'presentation']) check(review[field] >= floor, `${field} must be at least ${floor}/5`);
  if (entry.qualityTier === 'featured') check(review.audio >= 3, 'Featured audio must be at least 3/5');
  errors.push(...identityMismatches(entry, project, generatedTitle), ...suspectedTestFixtureAssets(project));
  const levels = projectLevels(project);
  const start = levels[project.startLevelIndex || 0] || levels[0];
  check(!!(start.ui && start.ui.startScreen && start.ui.startScreen.enabled), 'public game must have an enabled Start Screen');
  levels.forEach((level, i) => {
    const ui = level.ui || {};
    const screen = ui.startScreen || {};
    if (screen.enabled) check(!!(screen.howToPlay && screen.howToPlay.trim()), `level ${i + 1} needs authored How To Play`);
    const copy = [entry.purpose, entry.description, project.meta && project.meta.description, screen.subtitle, screen.howToPlay, screen.controlsHint, ui.winMessage, ui.loseMessage].filter(Boolean).join(' ');
    check(!/regression|stress[- ]?(?:test|game|fixture)|Wave\s*\d|dogfood|QA fixture|test[- ]rig/i.test(copy), `level ${i + 1} contains engineering copy`);
    if (!/crate run/i.test(entry.title)) check(!/crate run/i.test(copy), `level ${i + 1} contains unrelated Crate Run copy`);
  });
  const shots = screenshotRecords(entry);
  const required = entry.qualityTier === 'featured' ? ['opening', 'gameplay', 'highlight'] : ['gameplay'];
  for (const role of required) check(shots.some((shot) => shot.role === role), `missing real ${role} screenshot`);
  check(entry.screenshot === `public-showcase-review/${entry.id}/gameplay.png`, 'screenshot must reference the representative gameplay capture');
  for (const shot of shots) {
    const error = validateScreenshot(root, entry, shot.role, shot.file);
    if (error) errors.push(error);
  }
  if (entry.qualityTier === 'featured') {
    const buffers = shots.filter((s) => required.includes(s.role)).map((s) => path.resolve(root, s.file)).filter((p) => fs.existsSync(p)).map((p) => fs.readFileSync(p).toString('base64'));
    if (buffers.length === 3) check(new Set(buffers).size === 3, 'Featured screenshot trio must contain three different actual frames');
  }
  return errors;
}

module.exports = { projectLevels, resolveTitle, identityMismatches, suspectedTestFixtureAssets, screenshotRecords, validateScreenshot, validatePublicGame };
