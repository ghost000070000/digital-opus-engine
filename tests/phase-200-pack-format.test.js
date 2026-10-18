'use strict';
const assert=require('assert'),api=require('../editor/src/00-tilemap-bundle');
const fixture=()=>({textures:[{id:'texture',name:'Art',dataURL:'data:image/png;base64,YQ==',tags:['kept']}],audio:[{id:'audio',name:'Sound',dataURL:'data:audio/wav;base64,Yg=='}],meshAssets:[{id:'mesh',name:'Shape',mesh:{positions:[0,0,0]}}],spriteAssets:[{id:'sprite',sourceTexture:'texture'}],spriteAnimations:[{id:'clip',frames:[{spriteAssetRef:'sprite'}]}],tilesets:[{id:'tiles',tiles:[{id:'cell',spriteAssetRef:'sprite'}]}],tilemapChunks:[{id:'chunk',name:'Chunk',tilesetRef:'tiles',layers:[]}],prefabs:[{name:'Assembly',record:{assetId:'mesh',textureAssetId:'texture',audioAssetId:'audio',clipRef:'clip',tilemapChunkRef:'chunk'}}]});
const selections=[{collection:'prefabs',id:'Assembly'}];
async function resign(pack){pack.integrity.sha256=await api.sha256Hex(api.canonicalStringify({format:pack.format,version:pack.version,content:pack.content}));return api.canonicalStringify(pack);}
(async()=>{
 const project=fixture(),before=JSON.stringify(project),result=await api.createAssetPack({project,selections});assert.equal(result.pack.format,'digital-opus-asset-pack');assert.equal(result.pack.version,1);assert.equal(result.extension,'.opus-assets.json');assert.equal(result.summary.blobs,2);assert(!result.text.includes('data:image'));assert(!('root' in result.pack.content));assert.equal(JSON.stringify(project),before);assert.equal((await api.createAssetPack({project,selections})).text,result.text);
 const verified=await api.verifyAssetPackText(result.text),existing=fixture(),existingBefore=JSON.stringify(existing),plan=api.planAssetPackImport(verified,existing);
 assert.deepStrictEqual(plan.selections,[{collection:'prefabs',id:'Assembly-2'}]);const owner=plan.dependencies.prefabs[0].record;assert.equal(owner.assetId,'mesh-2');assert.equal(owner.textureAssetId,'texture-2');assert.equal(owner.audioAssetId,'audio-2');assert.equal(owner.clipRef,'clip-2');assert.equal(owner.tilemapChunkRef,'chunk-2');assert.equal(plan.dependencies.tilemapChunks[0].tilesetRef,'tiles-2');assert.equal(plan.dependencies.tilesets[0].tiles[0].spriteAssetRef,'sprite-2');assert.equal(plan.dependencies.spriteAssets[0].sourceTexture,'texture-2');assert.equal(plan.dependencies.textures[0].dataURL,project.textures[0].dataURL);assert.equal(plan.dependencies.audio[0].dataURL,project.audio[0].dataURL);assert.equal(JSON.stringify(existing),existingBefore);assert.equal(JSON.stringify(project),before);
 for(const kind of ['version','checksum','blob','missing','extra','unsafe-id']){
  const broken=JSON.parse(result.text);
  if(kind==='version')broken.version=99;
  if(kind==='checksum')broken.content.dependencies.meshAssets[0].name='tampered';
  if(kind==='blob')broken.content.blobs[0].base64='Yw==';
  if(kind==='missing')broken.content.dependencies.spriteAssets=[];
  if(kind==='extra')broken.content.dependencies.audio.push({id:'unselected'});
  if(kind==='unsafe-id'){broken.content.dependencies.prefabs[0].name='__proto__';broken.content.selections[0].id='__proto__';}
  const text=kind==='checksum'?api.canonicalStringify(broken):await resign(broken);await assert.rejects(()=>api.verifyAssetPackText(text),undefined,kind);
 }
 await assert.rejects(()=>api.verifyAssetPackText(JSON.stringify(result.pack)),/not canonical/);await assert.rejects(()=>api.verifyAssetPackText('{'),/Invalid JSON/);await assert.rejects(()=>api.verifyBundleText(result.text),/Unsupported format/);assert.throws(()=>api.planAssetPackImport({},{}),/Verified/);
 for(let i=0;i<100;i++){
  const source=fixture(),target=fixture();target.tilemapChunks.push({id:'chunk-2',name:'Chunk 2'});if(i%2)target.audio=[];if(i%3)target.textures=[];const oldSource=JSON.stringify(source),oldTarget=JSON.stringify(target),v=await api.verifyAssetPackText((await api.createAssetPack({project:source,selections})).text),p=api.planAssetPackImport(v,target);
  assert.equal(p.dependencies.tilemapChunks[0].id,'chunk-3');assert.equal(p.dependencies.prefabs[0].record.tilemapChunkRef,'chunk-3');assert.equal(p.dependencies.audio[0].id,i%2?'audio':'audio-2');assert.equal(p.dependencies.textures[0].id,i%3?'texture':'texture-2');assert.equal(JSON.stringify(source),oldSource);assert.equal(JSON.stringify(target),oldTarget);
 }
 console.log('PASS200 canonical general pack integrity/blob hydration/strict closure/typed keep-both remap and100 source-target collision oracles; no creator UI claim');
})().catch(e=>{console.error(e);process.exitCode=1;});
