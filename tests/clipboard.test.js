'use strict';
// Copy/paste asset planning: assets travel with objects, identical assets are
// reused, and clashing ids are renamed (with references rewritten) instead of
// silently pointing at a different project's asset.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/56-clipboard.js'), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));

function fixture() {
  let nextAsset = 1, nextTexture = 1;
  const ctx = {
    JSON, Object, Array, Map, Set, String, Number, ArrayBuffer, Date,
    assets: [], textureAssets: [], spriteAssets: [], audioAssets: [],
    findAssetById: (id) => ctx.assets.find((a) => a.id === id) || null,
    findTextureAssetById: (id) => ctx.textureAssets.find((a) => a.id === id) || null,
    findAudioAssetById: (id) => ctx.audioAssets.find((a) => a.id === id) || null,
    findSpriteAssetById: (id) => ctx.spriteAssets.find((a) => a.id === id) || null,
    generateAssetId: () => `asset${nextAsset++}`, generateTextureId: () => `texture${nextTexture++}`,
    generateAudioId: () => 'audio9', generateSpriteAssetId: () => 'spriteAsset9',
    OpusAuthoringPlumbing: { createSpriteAsset: (a) => a },
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(0, source.indexOf('function clipboardPastePoint')), ctx);
  return ctx;
}

{
  // Referenced assets (and a model's own texture) are found by id anywhere in the records.
  const ctx = fixture();
  ctx.assets.push({ id: 'asset1', name: 'Pillar', textureAssetId: 'texture1', positions: [1, 2, 3] }, { id: 'asset2', name: 'Unused' });
  ctx.textureAssets.push({ id: 'texture1', dataURL: 'data:a' });
  ctx.audioAssets.push({ id: 'audio1', dataURL: 'data:s' });
  const records = [{ id: 'obj1', kind: 'cube', assetId: 'asset1', behaviors: [{ action: 'playSound', params: { audioAssetId: 'audio1' } }] }];
  const used = ctx.clipboardAssetIds(records);
  assert.deepStrictEqual([...used.meshAssets], ['asset1']);
  assert.deepStrictEqual([...used.textureAssets], ['texture1'], "the model's texture travels too");
  assert.deepStrictEqual([...used.audioAssets], ['audio1']);
}
{
  // Pasting into a project where asset1/texture1 are different things renames both
  // and rewrites the model's texture reference; identical audio is reused.
  const ctx = fixture();
  ctx.assets.push({ id: 'asset1', name: 'Crate', sourceFilename: 'crate.glb', positions: [0, 0, 0], indices: [0] });
  ctx.textureAssets.push({ id: 'texture1', dataURL: 'data:other' });
  ctx.audioAssets.push({ id: 'audio1', dataURL: 'data:s' });
  const plan = ctx.planClipboardAssets({
    textureAssets: [{ id: 'texture1', dataURL: 'data:a' }],
    audioAssets: [{ id: 'audio1', dataURL: 'data:s' }],
    meshAssets: [{ id: 'asset1', name: 'Pillar', sourceFilename: 'pillar.glb', textureAssetId: 'texture1', positions: [1, 2, 3, 4, 5, 6], indices: [0, 1, 2] }],
  });
  const map = Object.fromEntries(plan.map);
  assert.strictEqual(map.asset1.startsWith('asset') && map.asset1 !== 'asset1', true);
  assert.strictEqual(map.texture1.startsWith('texture') && map.texture1 !== 'texture1', true);
  assert.strictEqual(plan.load.audioAssets.length, 0, 'identical audio is reused, not duplicated');
  assert.strictEqual(plan.load.meshAssets[0].id, map.asset1);
  assert.strictEqual(plan.load.meshAssets[0].textureAssetId, map.texture1, "renamed model points at its renamed texture");
  const records = plain(ctx.clipboardRewriteIds([{ id: 'obj1', assetId: 'asset1', note: 'asset1 stays in prose' }], plan.map));
  assert.strictEqual(records[0].assetId, map.asset1, 'object references follow the rename');
  assert.strictEqual(records[0].note, 'asset1 stays in prose', 'only whole-string ids are rewritten');
}
{
  // Same project: everything already present and identical -> nothing loaded, nothing renamed.
  const ctx = fixture();
  const mesh = { id: 'asset1', name: 'Pillar', sourceFilename: 'pillar.glb', positions: [1, 2, 3], indices: [0, 1, 2] };
  ctx.assets.push(mesh);
  const plan = ctx.planClipboardAssets({ meshAssets: [{ ...mesh }] });
  assert.strictEqual(plan.map.size, 0);
  assert.strictEqual(plan.load.meshAssets.length, 0);
  // New project without the asset: loaded with its own id.
  const empty = fixture();
  assert.strictEqual(empty.planClipboardAssets({ meshAssets: [{ ...mesh }] }).load.meshAssets[0].id, 'asset1');
}
{
  // Wiring: shortcuts, the boot order, and Cut taking children with it.
  assert(source.includes("if (key === 'v') pasteClipboard(); else copySelection(key === 'x');"));
  assert(source.includes('collectDescendants(item)) selectedItems.add(child)'), 'Cut removes what it copied');
  const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
  assert(modules.indexOf('56-clipboard.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
}
console.log('Clipboard: asset collection, clash renaming, reuse and wiring PASS');
