'use strict';
// Mechanical inventory only. Visual scores belong to rendered reviews.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { suspectedTestFixtureAssets } = require('../build/public-game-quality');
const { inventoryAssetProvenance } = require('../build/asset-provenance');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'games/catalog.json'), 'utf8'));
const baselineCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'rehabilitation-evidence/baseline-catalog.json'), 'utf8'));
function visit(value, callback) {
  if (!value || typeof value !== 'object') return;
  callback(value);
  for (const [key, child] of Object.entries(value)) {
    if (['assets', 'textures', 'audio', 'positions', 'normals', 'indices', 'uvs', 'joints', 'weights', 'skin'].includes(key)) continue;
    if (Array.isArray(child)) child.forEach(item => visit(item, callback));
    else if (child && typeof child === 'object') visit(child, callback);
  }
}
function summarize(project, entry) {
  const levels = Array.isArray(project.levels) ? project.levels : [{ id: 'legacy', name: project.title || entry.title, objects: Array.isArray(project) ? project : project.objects || [], playerSettings: project.playerSettings, ui: project.ui }];
  const provenance = inventoryAssetProvenance(project, ROOT);
  const actions = new Set();
  visit(project, item => { if (item.action) actions.add(item.action); if (item.type === 'saveGame' || item.type === 'loadGame') actions.add(item.type); });
  return {
    title: entry.title, projectMetaTitle: project.meta && project.meta.title || null, category: entry.category,
    visibility: entry.visibility || 'internal', qualityTier: entry.qualityTier || null,
    genre: entry.genre, controller: entry.controller,
    levelCount: levels.length, objectCount: levels.reduce((sum, level) => sum + (level.objects || []).length, 0),
    modelCount: (project.assets || []).length, skinnedModelCount: (project.assets || []).filter(asset => asset.type === 'skinnedMesh').length,
    textureCount: (project.textures || []).length, audioCount: (project.audio || []).length, prefabCount: (project.prefabs || []).length,
    knownFixtureAssets: suspectedTestFixtureAssets(project),
    assetProvenance: provenance,
    unknownProvenanceCount: provenance.filter(asset => !['verified-original-kit', 'documented-source-for-review'].includes(asset.status)).length,
    exactOriginalKitAssetCount: provenance.filter(asset => asset.status === 'verified-original-kit').length,
    saveContinue: { saveGameAuthored: actions.has('saveGame'), loadGameAuthored: actions.has('loadGame'), continueShellAvailable: levels.some(level => level.ui && level.ui.startScreen && level.ui.startScreen.enabled), note: 'Continue appears only when a valid saved slot exists; shell presence is not a completed save/load test.' },
    authoredActions: [...actions].sort(),
    levels: levels.map((level, index) => {
      const objects = level.objects || [], ps = level.playerSettings || {}, ui = level.ui || {}, paths = new Set(objects.filter(o => o.kind === 'path').flatMap(o => o.pointIds || []));
      return {
        id: level.id || String(index), name: level.name || null, objectCount: objects.length,
        controller: ps.controllerType || 'legacy/default', camera: { initialYaw: ps.initialYaw == null ? null : ps.initialYaw, initialPitch: ps.initialPitch == null ? null : ps.initialPitch, cameraObjects: objects.filter(o => o.kind === 'camera').length, pathObjects: objects.filter(o => o.kind === 'path').length },
        hud: (ui.hudElements || []).map(h => ({ kind: h.kind, anchor: h.anchor, text: h.text || '', visible: h.visible !== false })),
        startScreen: { enabled: !!(ui.startScreen && ui.startScreen.enabled), title: ui.startScreen && ui.startScreen.title || '', howToPlay: ui.startScreen && ui.startScreen.howToPlay || '', controlsHint: ui.startScreen && ui.startScreen.controlsHint || '' },
        ending: { winTitle: ui.winTitle || '', winMessage: ui.winMessage || '', loseTitle: ui.loseTitle || '', loseMessage: ui.loseMessage || '', winAudioAssetId: ui.winAudioAssetId || null, loseAudioAssetId: ui.loseAudioAssetId || null },
        ambientAudio: level.ambientAudio || null, playerVisual: ps.visual || null,
        modelInstances: objects.filter(o => o.assetId).length, texturedInstances: objects.filter(o => o.textureAssetId).length,
        helpers: { spawnPoints: objects.filter(o => o.isSpawnPoint).length, triggers: objects.filter(o => o.isTrigger).length, waypoints: objects.filter(o => o.isWaypoint).length, pathPoints: paths.size, spawners: objects.filter(o => o.kind === 'spawner').length, lights: objects.filter(o => o.kind === 'light').length },
      };
    }),
  };
}
const games = catalog.games.map(entry => {
  const baselineEntry = baselineCatalog.games.find(old => old.id === entry.id) || entry;
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'rehabilitation-evidence/baseline-games', entry.file), 'utf8'));
  const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', entry.file), 'utf8'));
  return { id: entry.id, file: entry.file, baseline: summarize(baseline, baselineEntry), current: summarize(current, entry) };
});
const report = { generatedAt: new Date().toISOString(), method: 'Mechanical JSON inventory; no inferred visual scores or unperformed play verification.', games, totals: {
  games: games.length,
  baselineObjects: games.reduce((n, game) => n + game.baseline.objectCount, 0), currentObjects: games.reduce((n, game) => n + game.current.objectCount, 0),
  gamesWithUnknownCurrentAssets: games.filter(game => game.current.unknownProvenanceCount).map(game => ({ id: game.id, count: game.current.unknownProvenanceCount })),
  gamesWithCurrentFixtures: games.filter(game => game.current.knownFixtureAssets.length).map(game => game.id),
}};
fs.writeFileSync(path.join(ROOT, 'rehabilitation-evidence/inventory.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.totals, null, 2));

