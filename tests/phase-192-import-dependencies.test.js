'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('editor/src/01-editor.js','utf8');const start=source.indexOf('function validateEmbeddedAssetImport(');assert(start>=0,'Actual dependency guard missing');const code=source.slice(start,source.indexOf('\nasync function stageAssetImport(',start));const c={ArrayBuffer,DataView,Uint8Array,TextDecoder};vm.createContext(c);vm.runInContext(code,c);
const check=c.validateEmbeddedAssetImport;
check(JSON.stringify({buffers:[{uri:'data:application/octet-stream;base64,AA=='}],images:[{uri:'data:image/png;base64,AA=='}]}));
for(const uri of ['art.png','../art.png','https://example.invalid/art.png','//example.invalid/art.png']){assert.throws(()=>check(JSON.stringify({images:[{uri}]})),/Embed dependencies/);assert.throws(()=>check(JSON.stringify({buffers:[{uri}]})),/Embed dependencies/);}
const bytes=Buffer.from(JSON.stringify({images:[{uri:'external.png'}]}));const glb=new ArrayBuffer(20+bytes.length);const v=new DataView(glb);v.setUint32(0,0x46546c67,true);v.setUint32(12,bytes.length,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(glb,20).set(bytes);assert.throws(()=>check(glb),/Embed dependencies/);
check(JSON.stringify({images:[null],buffers:[]}));assert.throws(()=>check('{broken'),e=>e.name==='SyntaxError');
assert(source.includes('analyzeModelImportDocument(validateEmbeddedAssetImport(data))'));
console.log('Phase192 actual embedded glTF/GLB dependency refusal prevents silent texture loss/no network guesses PASS');
