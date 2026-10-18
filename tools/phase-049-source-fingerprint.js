'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const files = [
  ...['engine/src', 'editor/src'].flatMap((folder) => fs.readdirSync(path.join(root, folder)).filter((name) => name.endsWith('.js')).map((name) => `${folder}/${name}`)),
  'editor/index.html', 'build/build.js', 'build/build-games.js', 'build/build-engine-site.js', 'build/build-games-site.js', 'build/export-template.js', 'no-code-capabilities.json', 'authoring-friction.json',
  'tools/build-phase-049-dogfood.js', 'qualification/phase-049/phase-049-project.json', 'qualification/phase-049/browser-campaign.html',
].sort();
function fingerprint() { const hash = crypto.createHash('sha256'); for (const file of files) { hash.update(file); hash.update('\0'); hash.update(fs.readFileSync(path.join(root, file))); hash.update('\0'); } return hash.digest('hex'); }
if (require.main === module) console.log(fingerprint());
module.exports = { fingerprint, files };
