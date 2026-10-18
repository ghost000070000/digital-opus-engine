'use strict';
const assert=require('assert'),api=require('../editor/src/00-tilemap-bundle'),plumbing=require('../editor/src/00-authoring-plumbing');
(async()=>{
 const sprites=[0,1].map(i=>plumbing.createSpriteAsset({id:'frame-'+i,sourceTexture:'atlas',sourceRect:{x:i,y:0,width:1,height:2}}));
 const clip=plumbing.createSpriteAnimationClip({id:'loop',playbackMode:'loop',frames:sprites.map((s,i)=>({spriteAsset:s.id,durationMs:100+i,events:[{id:'event-'+i,name:'Event '+i}]}))});
 const source={spriteAssets:sprites,spriteAnimations:[clip],textures:[{id:'atlas',dataURL:'data:image/png;base64,YQ=='}]},before=JSON.stringify(source),selections=[{collection:'spriteAnimations',id:'loop'}];
 const closure=api.collectAssetPackClosure(source,selections);assert.deepStrictEqual(closure.dependencies.spriteAssets.map(x=>x.id),['frame-0','frame-1'],'Canonical Clip frame.spriteAsset must enter selected closure');assert.equal(closure.dependencies.textures[0].id,'atlas');
 const pack=await api.createAssetPack({project:source,selections}),verified=await api.verifyAssetPackText(pack.text),plan=api.planAssetPackImport(verified,source);
 assert.deepStrictEqual(plan.dependencies.spriteAnimations[0].frames,clip.frames.map(f=>({...f,spriteAsset:f.spriteAsset+'-2'})),'Canonical frame refs remap alongside exact durations/events');assert(plan.dependencies.spriteAssets.every(s=>s.sourceTexture==='atlas-2'));assert.equal(JSON.stringify(source),before);
 const missing={...source,spriteAssets:[sprites[0]]};assert.throws(()=>api.collectAssetPackClosure(missing,selections),/Missing required spriteAssets/);
 console.log('PASS200 canonical plumbing Clip pack closure/remap/frame timing+events/missing frame refusal and source immutability');
})().catch(e=>{console.error(e);process.exitCode=1;});
