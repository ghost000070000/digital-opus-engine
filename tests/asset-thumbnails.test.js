'use strict';
// In-browser thumbnails: the rasterizer draws real pixels with a transparent
// background, honours colour and texture, and prefab records place their parts.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/64-asset-thumbnails.js'), 'utf8');
const ctx = { Math, Float32Array, Uint8ClampedArray, Array, Infinity, Number, Map, prefabs: [], assets: [] };
ctx.findAssetById = (id) => ctx.assets.find((a) => a.id === id) || null;
ctx.findTextureAssetById = () => null;
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function thumbnailDataURL')) + source.slice(source.indexOf('function assetThumbnailParts'), source.indexOf('function thumbnailKey')) + ';this.unitCubeArrays = unitCubeArrays; this.IDENTITY16 = IDENTITY16;', ctx);
const S = 56;
const px = (pixels, x, y) => Array.from(pixels.slice((y * S + x) * 4, (y * S + x) * 4 + 4));

{
  // A red unit cube: transparent corners, opaque red-ish middle.
  const pixels = ctx.rasterizeThumbnail([{ ...ctx.unitCubeArrays, texture: null, color: [1, 0, 0], matrix: ctx.IDENTITY16 }]);
  assert.strictEqual(pixels.length, S * S * 4);
  assert.strictEqual(px(pixels, 0, 0)[3], 0, 'transparent background');
  const mid = px(pixels, S / 2, S / 2);
  assert(mid[3] > 250 && mid[0] > 100 && mid[1] < 20 && mid[2] < 20, 'solid red object in the middle: ' + mid);
  let opaque = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 200) opaque++;
  assert(opaque > S * S * 0.3, 'the object fills the frame');
}
{
  // Texture sampling: a 1x1 green texture tints a white part green.
  const texture = { width: 1, height: 1, data: [0, 200, 0, 255] };
  const quad = { positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], indices: [0, 1, 2, 0, 2, 3], uvs: [0, 0, 1, 0, 1, 1, 0, 1] };
  const pixels = ctx.rasterizeThumbnail([{ ...quad, texture, color: [1, 1, 1], matrix: ctx.IDENTITY16 }]);
  const mid = px(pixels, S / 2, S / 2);
  assert(mid[1] > 60 && mid[0] < 10 && mid[2] < 10, 'texture colour is used: ' + mid);
}
{
  // Prefab records: unit cubes placed by position/scale/rotation, model parts by asset.
  const prefab = { records: [
    { kind: 'cube', position: [0, 0, 0], scale: [1, 1, 1], color: [1, 0, 0], rotationY: 0 },
    { kind: 'cube', position: [3, 0, 0], scale: [1, 2, 1], color: [0, 0, 1], rotationY: Math.PI / 2 },
    { kind: 'sprite', position: [0, 5, 0] },
  ] };
  const parts = ctx.prefabThumbnailParts(prefab);
  assert.strictEqual(parts.length, 2, 'only meshes are drawn');
  const m = parts[1].matrix;
  assert(Math.abs(m[12] - 3) < 1e-9 && Math.abs(m[5] - 2) < 1e-9, 'translation and scale');
  assert(Math.abs(m[0]) < 1e-9 && Math.abs(Math.abs(m[2]) - 1) < 1e-9, 'quarter turn about Y');
  assert.strictEqual(ctx.prefabThumbnailParts({ records: [{ kind: 'light' }] }), null, 'nothing drawable: no picture');
  ctx.assets.push({ id: 'asset1', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2], uvs: null });
  assert.strictEqual(ctx.prefabThumbnailParts({ record: { kind: 'cube', assetId: 'asset1' } })[0].positions.length, 9, 'single-record prefabs use their model');
}
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('64-asset-thumbnails.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Asset thumbnails: rasterizer, colour, texture, prefab parts PASS');
