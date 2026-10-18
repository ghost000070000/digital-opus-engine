'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),api=require('../editor/src/00-tilemap-bundle'),plumbing=require('../editor/src/00-authoring-plumbing'),filters=require('../editor/src/00-collision-filter-2d');
const src=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const c={playMode:false,OpusTilemapBundle:api,OpusAuthoringPlumbing:plumbing,OpusCollisionFilter2D:filters,
  captureAssetReplacementState:()=>({project:{}}),validateAssetReplacementRetainedData:()=>{},tilemapBundleProjectView:()=>({})};
vm.createContext(c);
for(const [start,end] of [['function assertAssetReplacementRetention(', 'function validateAssetReplacementRetainedData('],['function copyPortableAssetExtras(', 'function serializeAssets('],['function validateImportedSceneRecords(', 'function normalizeProjectData('],['function preflightAssetPackImport(', 'function planTilemapBundleImport(']])vm.runInContext(src.slice(src.indexOf(start),src.indexOf(end)),c);
async function prepare(project,selections){return api.verifyAssetPackText((await api.createAssetPack({project,selections})).text);}
(async()=>{
 const project={tilesets:[plumbing.createTileset({id:'tiles',name:'Tiles'})],tilemapChunks:[plumbing.normalizeTilemapChunk({id:'chunk',name:'Chunk',tilesetRef:'tiles',width:1,height:1,layers:[]})]};
 const verified=await prepare(project,[{collection:'tilemapChunks',id:'chunk'}]),before=JSON.stringify(verified);
 assert.equal(c.preflightAssetPackImport(verified).dependencies.tilemapChunks[0].id,'chunk');assert.equal(JSON.stringify(verified),before);
 for(const [family,record] of [['tilesets',project.tilesets[0]],['tilemapChunks',project.tilemapChunks[0]],['spriteAssets',plumbing.createSpriteAsset({id:'sprite'})],['spriteAnimations',plumbing.createSpriteAnimationClip({id:'clip'})],['sortingLayers',plumbing.createSpriteSortingLayer('sorting','Sorting',1)]]){
   const incoming={...project,[family]:[{...record,opaqueFutureField:{preserve:true}}]};
   const bad=await prepare(incoming,[{collection:family,id:record.id}]),beforeBad=JSON.stringify(bad);
   assert.throws(()=>c.preflightAssetPackImport(bad),/Unsupported retained fields or version/,family+' must not silently normalize away unknown metadata');assert.equal(JSON.stringify(bad),beforeBad);
 }
 const invalidPrefab=await prepare({prefabs:[{name:'Invalid Cube',record:{kind:'cube',scale:[1,1,1]}}]},[{collection:'prefabs',id:'Invalid Cube'}]);assert.throws(()=>c.preflightAssetPackImport(invalidPrefab),/color/);
 const unknown=await prepare({prefabs:[{name:'Future',record:{kind:'future'}}]},[{collection:'prefabs',id:'Future'}]);assert.throws(()=>c.preflightAssetPackImport(unknown),/unsupported object kind/);
 const valid=await prepare({prefabs:[{name:'Cube',record:{kind:'cube',scale:[1,1,1],color:[1,0,0]}}]},[{collection:'prefabs',id:'Cube'}]);assert.equal(c.preflightAssetPackImport(valid).dependencies.prefabs[0].name,'Cube');
 c.playMode=true;assert.throws(()=>c.preflightAssetPackImport(verified),/Stop Play/);c.playMode=false;
 c.validateAssetReplacementRetainedData=()=>{throw new Error('retained target loss');};assert.throws(()=>c.preflightAssetPackImport(verified),/retained target loss/);
 console.log('PASS200 actual pack preflight: canonical Chunk/Prefab, five incoming normalization-loss refusals, constructor/unknown kind/Play/target retention refusal, verified input unchanged; no loader/resource allocation');
})().catch(e=>{console.error(e);process.exitCode=1;});
