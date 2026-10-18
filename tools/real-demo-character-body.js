'use strict';
// Opt in exact stock third-person ranger projects only. Preserve custom bodies,
// placement, assets and visual offsets. No geometry or controller-family rewrite.
function repair(project) {
  const changes=[],skipped=[],canonical=require('./showcase-assets').getMesh('ranger');
  const asset=project.assets?.find(a=>a.id==='showcase-ranger');
  for(const level of project.levels||[]) {
    const s=level.playerSettings,v=s?.visual;
    if(s?.controllerType!=='thirdperson'||v?.mode!=='skinned'||v.assetId!=='showcase-ranger')continue;
    const scale=v.scale,height=1.855*scale,offset=-height/2;
    if(s.collisionHeight===height&&v.followBodyHeight===true&&v.positionOffset?.y===offset)continue;
    if(!asset||['type','positions','normals','indices','uvs','joints','weights','skin'].some(k=>JSON.stringify(asset[k])!==JSON.stringify(canonical[k]))) {
      skipped.push({level:level.id,reason:'MODIFIED_CHARACTER_ASSET_PRESERVED'});continue;
    }
    if(![.8,1].includes(scale)||s.collisionHeight!=null||v.followBodyHeight!=null||v.rotationOffsetY!==0||JSON.stringify(v.positionOffset)!=='{"x":0,"y":-0.55,"z":0}') {
      skipped.push({level:level.id,reason:'MODIFIED_CHARACTER_BODY_OR_OFFSET_PRESERVED'});continue;
    }
    const before=JSON.parse(JSON.stringify(s));
    s.collisionHeight=height;v.positionOffset.y=offset;v.followBodyHeight=true;
    changes.push({level:level.id,before,after:JSON.parse(JSON.stringify(s)),onlyExplicitBodyHeightAndFootAlignment:true});
  }
  return {changes,skipped};
}
module.exports={repair};
