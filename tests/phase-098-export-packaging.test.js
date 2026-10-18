'use strict';
// Packaging regression, not gameplay acceptance. Public site Playables must not
// silently omit reusable modules present in canonical catalog Playables.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const catalog = fs.readFileSync(path.join(root, 'build/build-games.js'), 'utf8');
const site = fs.readFileSync(path.join(root, 'build/build-games-site.js'), 'utf8');
const modules = [...new Set(catalog.match(/'00-[^']+\.js'/g))];
const siteModules = [...new Set(site.match(/'00-[^']+\.js'/g))];
assert.deepStrictEqual(siteModules, modules, 'Public site must retain canonical reusable module load order, not just membership');
for (const moduleName of modules) {
  assert(site.includes(moduleName), 'Games site omits canonical catalog module ' + moduleName);
  assert(fs.existsSync(path.join(root, 'editor/src', moduleName.slice(1, -1))), 'Missing canonical module ' + moduleName);
}
assert(modules.includes("'00-touch-control-layout.js'"), 'Touch layout must be bundled in public catalog exports');
assert(modules.includes("'00-input-conflicts.js'"), 'Input diagnostics must be bundled in public catalog exports');
const engineSite = fs.readFileSync(path.join(root, 'build/build-engine-site.js'), 'utf8');
assert(engineSite.includes('fs.copyFileSync(touchControlLayoutPath,'), 'Engine site must carry the creator/runtime module');
assert(engineSite.includes('fs.copyFileSync(inputConflictsPath,'), 'Engine site must carry canonical input diagnostics');
console.log('Phase098 canonical catalog/site module parity PASS (' + modules.length + ' modules)');
