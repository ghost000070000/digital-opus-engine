'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const F = require('../editor/src/00-collision-filter-2d.js'), A = require('../editor/src/00-authoring-schema.js'), P = require('../editor/src/00-authoring-plumbing.js'), Bundle = require('../editor/src/00-tilemap-bundle.js');
const out = path.resolve(__dirname, '../qualification/phase-049');
const clone = (value) => JSON.parse(JSON.stringify(value));
const layers = () => [F.defaultLayer(), { id: 'world', name: 'World', order: 1 }, { id: 'character', name: 'Character', order: 2 }];
const filter = (layer, refs) => ({ collisionLayerRef: layer, collisionMaskMode: 'custom', collisionMaskRefs: refs });
const report = { status: 'RUNNING', startedAtUtc: new Date().toISOString(), counts: { projectRoundtrips: 0, prefabRoundtrips: 0, bundleRoundtrips: 0, collisionRemaps: 0, defaultOnlyImports: 0, registryHistoryModelCycles: 0 }, checks: [] };
async function main() {
  const object = { id: 'actor', kind: 'cube', components: { 'box-collider-2d': { version: 2, enabled: true, offset: [0, 0], size: [1, 1], ...filter('character', ['world']) }, 'trigger-collider-2d': { version: 2, enabled: true, shape: 'circle', offset: [0, 0], radius: 1, ...filter('world', ['character']) } } };
  object.components = A.serializeComponents(object);
  const project = { collisionLayers: layers(), levels: [{ id: 'level', objects: [object] }], prefabs: [{ name: 'Filtered', record: clone(object) }] };
  for (let i = 0; i < 1000; i++) {
    const next = clone(project); next.collisionLayers = F.normalizeLayers(next.collisionLayers);
    next.levels[0].objects[0].components = A.serializeComponents(next.levels[0].objects[0]);
    assert.deepStrictEqual(next, project); assert.strictEqual(F.validateLayers(next.collisionLayers).length, 0); report.counts.projectRoundtrips++;
  }
  for (let i = 0; i < 100; i++) {
    const prefab = clone(project.prefabs[0]); prefab.record.components = A.serializeComponents(prefab.record);
    assert.deepStrictEqual(prefab, project.prefabs[0]); report.counts.prefabRoundtrips++;
    const snapshot = clone(project); assert(F.deleteLayer(project, 'world', F.DEFAULT_ID, true).ok);
    assert.strictEqual(project.prefabs[0].record.components['trigger-collider-2d'].collisionLayerRef, F.DEFAULT_ID);
    assert.deepStrictEqual(project.levels[0].objects[0].components['box-collider-2d'].collisionMaskRefs, []);
    Object.assign(project, snapshot); assert.deepStrictEqual(project, snapshot); report.counts.registryHistoryModelCycles++;
  }
  const ts = P.createTileset({ id: 'tiles', name: 'Tiles', tiles: [{ id: 'solid', name: 'Solid', collision: { version: 1, mode: 'full-cell' } }] });
  const root = P.createTilemapRecord({ version: 6, id: 'map', tilesetRef: 'tiles', layers: [{ id: 'ground', cells: [{ x: 0, y: 0, tileId: 'solid' }], ...filter('world', ['character']) }], spawnMarkers: [{ id: 'spawn', x: 0, y: 0, prefabRef: 'Filtered' }] });
  const sortingLayers = [{ id: 'sprite-layer-default', name: 'Default', order: 0 }];
  const portable = { ...project, tilesets: [ts], sortingLayers };
  for (let i = 0; i < 100; i++) {
    const exported = await Bundle.createBundle({ rootKind: 'tilemap', root, project: portable });
    const verified = await Bundle.verifyBundleText(exported.text);
    const plan = Bundle.planImport(verified, {}), imported = Bundle.materializeImport(plan, {});
    const rebuilt = await Bundle.createBundle({ rootKind: 'tilemap', root: imported.tilemaps[0], project: imported });
    assert.strictEqual(rebuilt.text, exported.text); report.counts.bundleRoundtrips++;
    const collisionPlan = Bundle.planImport(verified, { collisionLayers: layers() });
    const collisionImport = Bundle.materializeImport(collisionPlan, { collisionLayers: layers() });
    assert.notStrictEqual(collisionPlan.maps.collisionLayers.world, 'world');
    assert.strictEqual(collisionImport.tilemaps[0].layers[0].collisionLayerRef, collisionPlan.maps.collisionLayers.world);
    assert.deepStrictEqual(collisionImport.tilemaps[0].layers[0].collisionMaskRefs, [collisionPlan.maps.collisionLayers.character]);
    assert.strictEqual(F.validateLayers(collisionImport.collisionLayers).length, 0); report.counts.collisionRemaps++;
  }
  const defaultRoot = P.createTilemapRecord({ version: 5, tilesetRef: 'tiles', layers: [{ id: 'default', cells: [] }] });
  const defaultExport = await Bundle.createBundle({ rootKind: 'tilemap', root: defaultRoot, project: { tilesets: [ts], sortingLayers } });
  const defaultImport = Bundle.materializeImport(Bundle.planImport(await Bundle.verifyBundleText(defaultExport.text), {}), {});
  assert(defaultImport.collisionLayers.some((layer) => layer.id === F.DEFAULT_ID)); report.counts.defaultOnlyImports++;
  report.checks.push('Stable component filter serialization', 'Prefab records preserve independent filters', 'Delete scans off-scene and Prefab records; model snapshot restoration is exact', 'Bundle dependency closure includes marker Prefab filters', 'Same IDs are remapped without name merging', 'Default-only import creates reserved registry');
  report.status = 'PASS';
}
main().catch((error) => { report.status = 'FAIL'; report.error = error.stack; process.exitCode = 1; }).finally(() => { report.endedAtUtc = new Date().toISOString(); fs.writeFileSync(path.join(out, 'phase-049-portability.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); });
