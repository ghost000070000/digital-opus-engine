'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),src=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8'),api=require('../editor/src/00-tilemap-bundle');
const extract=n=>{const at=src.indexOf('function '+n+'(');assert(at>=0);return src.slice(at,src.indexOf('\nfunction ',at+10));};
const messages=[],c={atob:s=>Buffer.from(s,'base64').toString('binary'),playMode:false,OpusTilemapBundle:api,showStatus:s=>messages.push(s)};vm.createContext(c);vm.runInContext(['validateTexturePNGIntegrity','dataURLToArrayBuffer','validateAssetPackMediaBoundary'].map(extract).join('\n'),c);
function chunk(type,data){const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);result.write(type,4);data.copy(result,8);let crc=0xffffffff;for(const byte of result.subarray(4,8+data.length)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}result.writeUInt32BE((crc^0xffffffff)>>>0,data.length+8);return result;}
function png(width,height){const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
const plan=(...urls)=>({dependencies:{meshAssets:[],textures:urls.map(dataURL=>({dataURL}))}});
for(const [w,h]of [[1,1],[4096,4096]]){const p=plan(png(w,h)),before=JSON.stringify(p);c.validateAssetPackMediaBoundary(p);assert.equal(JSON.stringify(p),before);}
c.validateAssetPackMediaBoundary(plan(png(4096,4096),png(4096,4096)));
for(const [w,h]of [[0,1],[1,0],[4097,4096],[0xffffffff,0xffffffff]])assert.throws(()=>c.validateAssetPackMediaBoundary(plan(png(w,h))),/dimensions exceed64MiB/);
assert.throws(()=>c.validateAssetPackMediaBoundary(plan(png(4096,4096),png(4096,4096),png(1,1))),/128MiB/);
assert.throws(()=>c.validateAssetPackMediaBoundary(plan('data:image/jpeg;base64,YQ==')),/requires PNG/);
assert.throws(()=>c.validateAssetPackMediaBoundary({dependencies:{meshAssets:[{type:'skinnedMesh'}],textures:[]}}),/Skinned Models/);
assert.throws(()=>c.validateAssetPackMediaBoundary(plan('data:image/png;base64,YQ==')),/signature/);
const corrupt=Buffer.from(png(1,1).split(',')[1],'base64');corrupt[20]^=1;assert.throws(()=>c.validateAssetPackMediaBoundary(plan('data:image/png;base64,'+corrupt.toString('base64'))),/integrity/);
vm.runInContext(src.slice(src.indexOf('async function previewAssetPackImportFile('),src.indexOf('function planTilemapBundleImport(')),c);
(async()=>{for(const size of [undefined,-1,NaN,api.LIMITS.textBytes+1]){let reads=0;await c.previewAssetPackImportFile({size,text:async()=>{reads++;return '{}';}});assert.equal(reads,0);assert.match(messages.at(-1),/invalid size/);}console.log('PASS200 actual pre-read file size and pre-decode PNG CRC/dimensions64MiB128MiB/zero/overflow/format/rig refusal; input unchanged, no decoder or authoring mutation');})().catch(e=>{console.error(e);process.exitCode=1;});
