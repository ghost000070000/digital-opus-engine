'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kit = require('../tools/showcase-assets');
const meshFields = ['type', 'positions', 'normals', 'indices', 'uvs', 'joints', 'weights', 'skin', 'textureAssetId', 'sockets', 'animationEvents'];
const cache = new Map();
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function payload(asset, kind) {
  const fields = kind === 'mesh' ? meshFields : ['dataURL'];
  return Object.fromEntries(fields.filter(key => asset[key] !== undefined).map(key => [key, asset[key]]));
}
function digest(asset, kind) { return crypto.createHash('sha256').update(JSON.stringify(canonical(payload(asset, kind)))).digest('hex'); }
function classifyAsset(asset, kind, root) {
  const key = String(asset.id || '').replace(/^showcase-/, '');
  const known = { mesh: kit.meshKeys, texture: kit.textureKeys, audio: kit.audioKeys }[kind] || [];
  if (asset.id === 'showcase-' + key && known.includes(key)) {
    const cacheKey = kind + ':' + key;
    if (!cache.has(cacheKey)) cache.set(cacheKey, digest(kind === 'mesh' ? kit.getMesh(key) : kind === 'texture' ? kit.getTexture(key) : kit.getAudio(key), kind));
    if (digest(asset, kind) === cache.get(cacheKey)) return { status: 'verified-original-kit', source: 'tools/showcase-assets.js', license: 'MIT', documentation: 'SHOWCASE-ASSET-LICENSES.md' };
    return { status: 'modified-kit-data-needs-review', reason: 'Native data differs from the original kit asset with this ID' };
  }
  const p = asset.provenance;
  if (p && typeof p.source === 'string' && p.source.trim() && typeof p.license === 'string' && p.license.trim() && !/unknown|unverified|pending/i.test(p.license) && typeof p.documentation === 'string') {
    const document = path.resolve(root, p.documentation);
    if (document.startsWith(path.resolve(root) + path.sep) && fs.existsSync(document) && fs.statSync(document).isFile()) return { status: 'documented-source-for-review', source: p.source, license: p.license, documentation: p.documentation };
  }
  return { status: 'unverified-provenance', reason: 'No exact original-kit match or explicit source/license documentation' };
}
function inventoryAssetProvenance(project, root) {
  return [['mesh', project.assets || []], ['texture', project.textures || []], ['audio', project.audio || []]].flatMap(([kind, assets]) => assets.map(asset => ({
    kind, id: asset.id, name: asset.name || null, sourceFilename: asset.sourceFilename || null,
    ...classifyAsset(asset, kind, root),
  })));
}
function assetProvenanceIssues(project, root) {
  const records = inventoryAssetProvenance(project, root);
  const issues = records.filter(record => !['verified-original-kit', 'documented-source-for-review'].includes(record.status)).map(record => record.kind + ' ' + record.id + ': ' + record.reason);
  if (records.some(record => record.status === 'verified-original-kit') && !fs.existsSync(path.join(root, 'SHOWCASE-ASSET-LICENSES.md'))) issues.push('Original kit licensing document is missing');
  return issues;
}
module.exports = { inventoryAssetProvenance, assetProvenanceIssues };

