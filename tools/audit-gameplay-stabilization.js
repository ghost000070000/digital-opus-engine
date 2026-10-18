'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'games/catalog.json'), 'utf8'));
const defaults = { firstperson: [6, 40], thirdperson: [6.5, 30], topdown: [6, 24], hovercraft: [11, 10] };
function objects(project) { return (project.levels || []).flatMap(level => level.objects || []); }
function profile(entry) {
  const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', entry.file), 'utf8'));
  const levels = project.levels || [];
  const start = levels[project.startLevelIndex || 0] || levels[0] || project;
  const settings = start.playerSettings || {};
  const controller = settings.controllerType || 'hovercraft';
  const fallback = defaults[controller] || [6, 24];
  const all = objects(project);
  const solids = all.filter(item => item.solid === true || item.physics?.solid === true);
  const sphereColliders = solids.filter(item => item.collider?.type === 'sphere').length;
  const boxColliders = solids.length - sphereColliders;
  const enemySpeeds = all.flatMap(item => [item.ai?.speed, ...(item.ai?.states || []).map(state => state.movement?.speed)]).filter(Number.isFinite);
  const moveSpeed = Number.isFinite(settings.moveSpeed) ? settings.moveSpeed : fallback[0];
  const acceleration = Number.isFinite(settings.acceleration) ? settings.acceleration : fallback[1];
  const reasons = [];
  if (!settings.playBounds) reasons.push('no authored play bounds');
  if (solids.length >= 14) reasons.push(`${solids.length} solid obstacles`);
  if (controller === 'firstperson') reasons.push('pointer-lock camera');
  if (controller === 'hovercraft') reasons.push('inertial controller');
  return { id: entry.id, title: entry.title, controller, moveSpeed, acceleration, playBounds: !!settings.playBounds, solids: solids.length, boxColliders, sphereColliders, enemySpeedRange: enemySpeeds.length ? [Math.min(...enemySpeeds), Math.max(...enemySpeeds)] : null, riskReasons: reasons };
}
const games = catalog.games.map(profile);
const deepAuditIds = ['arsenal-run', 'power-grid', 'signal-relay', 'silent-sector', 'relic-frontier'];
const collisionDogfoodIds = ['arsenal-run', 'signal-relay', 'relic-frontier'];
const browserPath = path.join(ROOT, 'gameplay-feel-evidence/results.json');
const browserResults = fs.existsSync(browserPath) ? JSON.parse(fs.readFileSync(browserPath, 'utf8')).results : [];
for (const game of games) { const browser = browserResults.find(result => result.id === game.id); game.deepAudit = deepAuditIds.includes(game.id); game.collisionDogfood = collisionDogfoodIds.includes(game.id); game.sourcePass = game.moveSpeed > 0 && game.moveSpeed <= 12 && game.acceleration > 0 && game.acceleration <= 80; game.browserPass = browser ? !!browser.pass : null; game.browserCollision = browser?.collision || null; }
const evidence = { generatedAt: new Date().toISOString(), scope: 'Cross-cutting stabilization; no Phase 039 or Phase 041 expansion', refreshRatesHz: [30, 60, 120, 144, 240], deltaClampSeconds: 0.1, deepAuditIds, collisionDogfoodIds, summary: { games: games.length, sourcePass: games.filter(game => game.sourcePass).length, browserPass: games.filter(game => game.browserPass).length, bounded: games.filter(game => game.playBounds).length, solids: games.reduce((sum, game) => sum + game.solids, 0) }, games, pass: games.length === 28 && games.every(game => game.sourcePass && game.browserPass === true) };
fs.writeFileSync(path.join(ROOT, 'gameplay-stabilization-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
const rows = games.map(game => `| ${game.title} | ${game.controller} | ${game.moveSpeed} | ${game.acceleration} | ${game.playBounds ? 'yes' : 'no'} | ${game.solids} | ${game.deepAudit ? 'deep' : 'standard'} | ${game.sourcePass ? 'PASS' : 'FAIL'} | ${game.browserPass ? 'PASS' : 'FAIL'} |`).join('\n');
fs.writeFileSync(path.join(ROOT, 'GAMEPLAY-CONTROL-COLLISION-AUDIT.md'), `# Gameplay Control and Collision Audit\n\nGenerated ${evidence.generatedAt}. This is a reusable source and real-browser audit for all 28 shipped games. It intentionally qualifies existing movement and collision systems; it does not introduce Phase 041 physics authoring.\n\n| Game | Controller | Speed | Accel | Bounds | Solids | Depth | Source gate | Browser gate |\n|---|---|---:|---:|---|---:|---|---|---|\n${rows}\n\n## Deep audit selection\n\nThe five higher-risk games are Arsenal Run, Power Grid, Signal Relay, Silent Sector, and Relic Frontier. They combine pointer-lock look, dense solids, or absent authored bounds. Collision dogfood uses Arsenal Run, Signal Relay, and Relic Frontier.\n`);
console.log(`Gameplay stabilization audit: source ${evidence.summary.sourcePass}/${games.length}; browser ${evidence.summary.browserPass}/${games.length}; ${evidence.summary.solids} authored solids`);
if (!evidence.pass) process.exitCode = 1;
