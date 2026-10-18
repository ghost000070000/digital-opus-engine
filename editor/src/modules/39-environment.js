// --- Environment ---
// Sky/fog/sun color + fog density (App.setEnvironment, engine/src/22-api.js)
// -- kept PER LEVEL (a night level shouldn't inherit a day level's mood),
// synced lazily the same way `objects` already is: syncCurrentLevelObjects
// captures app.getEnvironment() right before a switch/save/export, so
// there's no separate "dirty" tracking to keep in sync by hand.
// Wave 6 (Priority H): which Texture Asset (if any) is the current level's
// Sky Panorama -- kept as a plain editor-side variable (not read off the
// live app.getEnvironment(), which only ever has the resolved GPU handle,
// never the asset id it came from) so syncCurrentLevelObjects always knows
// what to persist regardless of whether the texture has finished decoding
// yet.
let currentSkyTextureAssetId = null;
function applyLevelEnvironment(index) {
  // normalizeEnvironment reconstructs a real Opus.Vec3 for lightDir --
  // required here because Duplicate Level clones a level's environment via
  // JSON.parse(JSON.stringify(...)) (see duplicate-level-btn), which
  // silently downgrades lightDir from a Vec3 instance to a plain {x,y,z}
  // object; App.setEnvironment validates `instanceof Vec3` and throws on
  // that plain object. The project-load path already normalized on the way
  // in; this in-session path (switching to a level right after duplicating
  // it) never did, so it crashed the moment the duplicate became active --
  // found live dogfooding the Duplicate Level workflow during the UI pass.
  const env = levels[index].environment;
  app.setEnvironment(normalizeEnvironment(env) || DEFAULT_ENVIRONMENT);
  currentSkyTextureAssetId = (env && env.skyTextureAssetId) || null;
  const skyAsset = findTextureAssetById(currentSkyTextureAssetId);
  if (skyAsset) {
    const handle = getTextureHandle(skyAsset);
    if (handle) app.setEnvironment({ skyTexture: handle });
    else (skyAsset.pendingCallbacks = skyAsset.pendingCallbacks || []).push(() => app.setEnvironment({ skyTexture: getTextureHandle(skyAsset) }));
  } else {
    app.setEnvironment({ skyTexture: null });
  }
  renderEnvironmentPanel();
}
function captureEnvironmentAuthoringSnapshot() {
  const env={...app.getEnvironment()};delete env.skyTexture;
  env.skyTextureAssetId=currentSkyTextureAssetId||undefined;
  return {levelId:levels[currentLevelIndex]?.id,environment:JSON.parse(JSON.stringify(env))};
}
function restoreEnvironmentAuthoringSnapshot(saved) {
  const index=levels.findIndex(l=>l.id===saved.levelId);if(index<0)return;
  levels[index].environment=JSON.parse(JSON.stringify(saved.environment));
  if(index===currentLevelIndex)applyLevelEnvironment(index);
}
const ENVIRONMENT_ATMOSPHERE_PRESETS=Object.freeze({
  clear:{skyTop:[.15,.35,.65],skyHorizon:[.65,.8,.95],sunColor:[1,.95,.85],fogDensity:.008},
  dusk:{skyTop:[.12,.08,.25],skyHorizon:[.9,.42,.25],sunColor:[1,.55,.3],fogDensity:.018},
  mist:{skyTop:[.45,.55,.65],skyHorizon:[.75,.82,.85],sunColor:[.85,.9,1],fogDensity:.06},
  overcast:{skyTop:[.3,.35,.4],skyHorizon:[.6,.65,.7],sunColor:[.75,.8,.85],fogDensity:.025},
  storm:{skyTop:[.08,.1,.15],skyHorizon:[.3,.35,.42],sunColor:[.5,.58,.7],fogDensity:.045}
});
function applyEnvironmentAtmospherePreset(id) {
  const preset=Object.prototype.hasOwnProperty.call(ENVIRONMENT_ATMOSPHERE_PRESETS,id)?ENVIRONMENT_ATMOSPHERE_PRESETS[id]:null;
  if(!preset)return false;
  const changed=changeEnvironmentAuthoring(JSON.parse(JSON.stringify(preset)));
  renderEnvironmentPanel();return changed;
}
function changeEnvironmentAuthoring(patch) {
  if(playMode||!patch||typeof patch!=='object')return false;
  const current=app.getEnvironment();
  for(const [key,value] of Object.entries(patch)){
    if(['skyHorizon','sunColor','skyTop','groundColor'].includes(key)){if(!Array.isArray(value)||value.length!==3||!value.every(v=>Number.isFinite(v)&&v>=0&&v<=1))return false;}
    else if(key==='fogDensity'){if(!Number.isFinite(value)||value<0||value>.2)return false;}
    else if(key==='shadows'){for(const [name,v]of Object.entries(value||{})){if(name==='enabled'){if(typeof v!=='boolean')return false;}else if(name==='resolution'){if(![256,512,1024,2048,4096].includes(v))return false;}else if(name==='distance'){if(!Number.isFinite(v)||v<=0)return false;}else if(name==='bias'){if(!Number.isFinite(v)||v<0)return false;}else return false;}}
    else if(key==='postProcessing'){if(!value||typeof value!=='object'||Array.isArray(value))return false;for(const [name,v]of Object.entries(value)){if(name==='enabled'){if(typeof v!=='boolean')return false;}else if(name==='exposure'){if(!Number.isFinite(v)||v<-4||v>4)return false;}else if(name==='saturation'){if(!Number.isFinite(v)||v<0||v>2)return false;}else return false;}}
    else if(key==='lighting2D'){if(!value||typeof value!=='object'||Array.isArray(value))return false;for(const [name,v]of Object.entries(value)){if(name==='enabled'){if(typeof v!=='boolean')return false;}else if(name==='ambient'){if(!Number.isFinite(v)||v<0||v>1)return false;}else return false;}}
    else return false;
  }
  const differs=Object.entries(patch).some(([key,value])=>['shadows','postProcessing','lighting2D'].includes(key)?Object.entries(value).some(([name,v])=>(current[key]||(key==='lighting2D'?{enabled:false,ambient:.25}:{enabled:false,exposure:0,saturation:1}))[name]!==v):JSON.stringify(current[key])!==JSON.stringify(value));
  if(!differs)return false;
  pushUndo();app.setEnvironment(patch);return true;
}
function renderEnvironmentPanel() {
  const env = app.getEnvironment();
  setShadowAuthoringControlsEditable();
  const presetApply=document.getElementById('env-preset-apply');if(presetApply)presetApply.disabled=playMode;
  document.getElementById('env-sky-horizon').value = rgbToHex(env.skyHorizon);
  document.getElementById('env-sun-color').value = rgbToHex(env.sunColor);
  document.getElementById('env-fog-density').value = env.fogDensity.toFixed(3);
  document.getElementById('env-shadows-enabled').checked = env.shadows.enabled;
  document.getElementById('env-shadows-resolution').value = env.shadows.resolution;
  document.getElementById('env-shadows-distance').value = env.shadows.distance;
  document.getElementById('env-shadows-bias').value = env.shadows.bias;
  const post=env.postProcessing||{enabled:false,exposure:0,saturation:1};
  for(const key of ['enabled','exposure','saturation']){const control=document.getElementById('env-post-'+key);if(control){if(key==='enabled')control.checked=post[key];else control.value=post[key];}}
  const lighting2D=env.lighting2D||{enabled:false,ambient:.25};
  for(const key of ['enabled','ambient']){const control=document.getElementById('env-lighting2d-'+key);if(control){if(key==='enabled')control.checked=lighting2D[key];else control.value=lighting2D[key];}}
  const skySelect = document.getElementById('env-sky-texture');
  if (skySelect) {
    skySelect.innerHTML = `<option value="">None (procedural gradient)</option>${textureAssets.map((t) => `<option value="${t.id}" ${currentSkyTextureAssetId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}`;
  }
}
for (const [id, key] of [['env-sky-horizon', 'skyHorizon'], ['env-sun-color', 'sunColor']]) {
  document.getElementById(id).oninput = (e) => changeEnvironmentAuthoring({ [key]: hexToRgb(e.target.value) });
}
document.getElementById('env-preset-apply').onclick=()=>{
  const changed=applyEnvironmentAtmospherePreset(document.getElementById('env-preset').value);
  showStatus(changed?'Atmosphere applied — sky, sun color and fog remain editable':'Atmosphere unchanged');
};
document.getElementById('env-fog-density').oninput = (e) => {
  const v = parseFloat(e.target.value);
  changeEnvironmentAuthoring({ fogDensity: v });
};
// Wave 6 (Priority H): switching the Sky Panorama selector resolves the
// chosen Texture Asset to a live handle (or clears it entirely for "None"),
// the same lazy getTextureHandle any OTHER texture picker in this editor
// already uses -- no second texture-loading path for sky panoramas.
document.getElementById('env-sky-texture').onchange = (e) => {
  if(playMode||(e.target.value||null)===currentSkyTextureAssetId)return;
  if(e.target.value&&!findTextureAssetById(e.target.value))return;
  pushUndo();
  currentSkyTextureAssetId = e.target.value || null;
  const asset = findTextureAssetById(currentSkyTextureAssetId);
  if (asset) {
    const handle = getTextureHandle(asset);
    if (handle) app.setEnvironment({ skyTexture: handle });
    else (asset.pendingCallbacks = asset.pendingCallbacks || []).push(() => app.setEnvironment({ skyTexture: getTextureHandle(asset) }));
  } else {
    app.setEnvironment({ skyTexture: null });
  }
};
// Priority H's shadow feature had a real engine API (App.configureShadows)
// but no editor authoring surface at all until now -- meaning no shipped
// project could ever actually turn it on. Folded into the same
// setEnvironment/getEnvironment round-trip as every other environment
// field (see 22-api.js), so this is the ONE new place it needed wiring.
function setShadowAuthoringControlsEditable(){
  for(const key of ['enabled','resolution','distance','bias']){const control=document.getElementById('env-shadows-'+key);if(control)control.disabled=playMode;}
  for(const key of ['enabled','exposure','saturation']){const control=document.getElementById('env-post-'+key);if(control)control.disabled=playMode;}
  for(const key of ['enabled','ambient']){const control=document.getElementById('env-lighting2d-'+key);if(control)control.disabled=playMode;}
}
function bindShadowAuthoringField(control,key){
  const feedback=document.getElementById('env-shadows-feedback');
  control.setAttribute?.('aria-describedby','env-shadows-feedback');
  const read=()=>key==='enabled'?control.checked:control.value?.trim()?Number(control.value):NaN;
  const validate=()=>{
    const value=read();let error='';
    if(playMode)error='Stop Play before editing sun shadows.';
    else if(key!=='enabled'&&!Number.isFinite(value))error='Enter a finite number.';
    else if(key==='resolution'&&![256,512,1024,2048,4096].includes(value))error='Choose a supported shadow resolution.';
    else if(key==='distance'&&value<=0)error='Shadow half-size must be greater than zero world units.';
    else if(key==='bias'&&value<0)error='Shadow bias must be zero or greater.';
    control.setAttribute?.('aria-invalid',error?'true':'false');feedback.textContent=error;return {value,error};
  };
  control.oninput=validate;
  control.onchange=()=>{const result=validate();if(result.error)return false;return changeEnvironmentAuthoring({shadows:{[key]:result.value}});};
  control.onblur=()=>{const result=validate();if(result.error){const value=app.getEnvironment().shadows[key];if(key==='enabled')control.checked=value;else control.value=String(value);control.setAttribute?.('aria-invalid','false');feedback.textContent='Invalid shadow value was not saved; previous value restored.';}};
}
for(const key of ['enabled','resolution','distance','bias'])bindShadowAuthoringField(document.getElementById('env-shadows-'+key),key);
function bindPostAuthoringField(control,key){
  const feedback=document.getElementById('env-post-feedback');
  control.setAttribute?.('aria-describedby','env-post-feedback');
  const read=()=>key==='enabled'?control.checked:control.value?.trim()?Number(control.value):NaN;
  const validate=()=>{const value=read();let error='';if(playMode)error='Stop Play before editing Scene Look.';else if(key!=='enabled'&&!Number.isFinite(value))error='Enter a finite number.';else if(key==='exposure'&&(value<-4||value>4))error='Exposure must be -4 to 4 stops.';else if(key==='saturation'&&(value<0||value>2))error='Saturation must be 0 to 2.';control.setAttribute?.('aria-invalid',error?'true':'false');feedback.textContent=error;return {value,error};};
  control.oninput=validate;
  control.onchange=()=>{const result=validate();if(result.error)return false;return changeEnvironmentAuthoring({postProcessing:{[key]:result.value}});};
  control.onblur=()=>{if(validate().error){const value=(app.getEnvironment().postProcessing||{enabled:false,exposure:0,saturation:1})[key];if(key==='enabled')control.checked=value;else control.value=String(value);control.setAttribute?.('aria-invalid','false');feedback.textContent='Invalid Scene Look value was not saved; previous value restored.';}};
}
for(const key of ['enabled','exposure','saturation'])bindPostAuthoringField(document.getElementById('env-post-'+key),key);
function bindLighting2DAuthoringField(control,key){
  const feedback=document.getElementById('env-lighting2d-feedback');
  control.setAttribute?.('aria-describedby','env-lighting2d-feedback');
  const read=()=>key==='enabled'?control.checked:control.value?.trim()?Number(control.value):NaN;
  const validate=()=>{const value=read();let error='';if(playMode)error='Stop Play before editing 2D lighting.';else if(key==='ambient'&&(!Number.isFinite(value)||value<0||value>1))error='Ambient must be a finite number from 0 to 1.';control.setAttribute?.('aria-invalid',error?'true':'false');feedback.textContent=error;return {value,error};};
  control.oninput=validate;
  control.onchange=()=>{const result=validate();if(result.error)return false;return changeEnvironmentAuthoring({lighting2D:{[key]:result.value}});};
  control.onblur=()=>{if(validate().error){const value=(app.getEnvironment().lighting2D||{enabled:false,ambient:.25})[key];if(key==='enabled')control.checked=value;else control.value=String(value);control.setAttribute?.('aria-invalid','false');feedback.textContent='Invalid 2D lighting value was not saved; previous value restored.';}};
}
for(const key of ['enabled','ambient'])bindLighting2DAuthoringField(document.getElementById('env-lighting2d-'+key),key);

function applyLevelPlayerSettings(index) {
  const saved = levels[index].playerSettings;
  currentPlayerSettings = saved ? Object.assign(defaultPlayerSettings(saved.controllerType), saved) : defaultPlayerSettings('hovercraft');
  renderPlayerSettingsPanel();
  if(playMode && typeof OpusInputContexts!=='undefined')compileInputContextRuntime();
}
function playerAuthoringValue(key) {
  if(key==='rotateToMovement'&&Object.prototype.hasOwnProperty.call(currentPlayerSettings,key))return currentPlayerSettings[key];
  if(['steeringRate','boostImpulse','boostAcceleration','boostMaxSpeed','drag'].includes(key)&&Object.prototype.hasOwnProperty.call(currentPlayerSettings,key))return currentPlayerSettings[key];
  if(key.startsWith('visual.')){const parts=key.slice(7).split('.'),raw=currentPlayerSettings.visual||{},defaults=defaultPlayerVisual();return parts.length===2?(raw[parts[0]]?.[parts[1]]??defaults[parts[0]]?.[parts[1]]):(raw[parts[0]]??defaults[parts[0]]);}
  if(key==='collisionHeight')return currentPlayerSettings.collisionHeight??null;
  return currentPlayerSettings[key]??defaultPlayerSettings(currentPlayerSettings.controllerType)[key]??({gravity:20,jumpSpeed:8,jumpEnabled:false,collisionRadius:0.5}[key]);
}
function changePlayerAuthoringField(key,value,onBeforeChange) {
  if(playMode)return false;
  const next={...currentPlayerSettings};
  if(key.startsWith('visual.')){
    if(currentPlayerSettings.controllerType==='firstperson')return false;
    const raw=currentPlayerSettings.visual;if(raw!==undefined&&(!raw||typeof raw!=='object'||Array.isArray(raw)))return false;
    const visual={...defaultPlayerVisual(),...(raw||{})},part=key.slice(7);
    if(part==='mode'){if(!['primitive','skinned'].includes(value))return false;}
    else if(part==='assetId'){
      if(value!==null&&!assets.some(asset=>asset.id===value&&(asset.type==='skinnedMesh'||currentPlayerSettings.controllerType==='hovercraft'&&asset.type==='mesh')))return false;
      if(visual.clipMapIdentity!==undefined&&(!visual.clipMapIdentity||typeof visual.clipMapIdentity!=='object'||Array.isArray(visual.clipMapIdentity)))return false;
      const oldAsset=findAssetById(visual.assetId),identities={...visual.clipMapIdentity};
      for(const role of Object.keys(defaultPlayerVisual().clipMap))if(visual.clipMap?.[role]!=null&&!Object.prototype.hasOwnProperty.call(identities,role))identities[role]={assetId:visual.assetId,name:oldAsset?.skin?.clips?.[visual.clipMap[role]]?.name??null};
      if(Object.keys(identities).length)visual.clipMapIdentity=identities;
    }
    else if(part.startsWith('clipMap.')){
      const role=part.slice(8),asset=findAssetById(visual.assetId),clip=asset?.skin?.clips?.[value];
      if(!Object.prototype.hasOwnProperty.call(defaultPlayerVisual().clipMap,role)||value!==null&&(!Number.isInteger(value)||value<0||!clip||typeof clip.name!=='string'||!clip.name||asset.skin.clips.filter(c=>c.name===clip.name).length!==1))return false;
      if(visual.clipMap!==undefined&&(!visual.clipMap||typeof visual.clipMap!=='object'||Array.isArray(visual.clipMap)))return false;
      if(visual.clipMapIdentity!==undefined&&(!visual.clipMapIdentity||typeof visual.clipMapIdentity!=='object'||Array.isArray(visual.clipMapIdentity)))return false;
      const identities={...visual.clipMapIdentity},ref=value===null?undefined:{assetId:visual.assetId,name:clip.name};
      if(playerAuthoringValue(key)===value&&JSON.stringify(identities[role])===JSON.stringify(ref))return false;
      if(value===null)delete identities[role];else identities[role]=ref;
      visual.clipMapIdentity=identities;visual.clipMap={...visual.clipMap,[role]:value};
    }
    else {if(typeof value!=='number'||!Number.isFinite(value))return false;if(part==='scale'){if(value<=0)return false;}else if(part==='blendTime'){if(value<0)return false;}else if(part!=='rotationOffsetY'&&!['positionOffset.x','positionOffset.y','positionOffset.z'].includes(part))return false;}
    if(!part.startsWith('clipMap.')&&playerAuthoringValue(key)===value)return false;
    if(part.startsWith('positionOffset.')){if(visual.positionOffset!==undefined&&(!visual.positionOffset||typeof visual.positionOffset!=='object'||Array.isArray(visual.positionOffset)))return false;visual.positionOffset={...defaultPlayerVisual().positionOffset,...visual.positionOffset,[part.slice(15)]:value};}
    else if(!part.startsWith('clipMap.'))visual[part]=value;
    next.visual=visual;
  }else{
    if(key==='jumpEnabled'||key==='rotateToMovement'){if(typeof value!=='boolean'||key==='rotateToMovement'&&currentPlayerSettings.controllerType!=='topdown')return false;}
    else if(key==='collisionHeight'&&value===null){if(!Object.prototype.hasOwnProperty.call(next,'collisionHeight')&&!Object.prototype.hasOwnProperty.call(next.visual||{},'followBodyHeight'))return false;delete next.collisionHeight;if(next.visual&&typeof next.visual==='object'&&!Array.isArray(next.visual)){next.visual={...next.visual};delete next.visual.followBodyHeight;}}
    else{const hoverKeys=['steeringRate','boostImpulse','boostAcceleration','boostMaxSpeed','drag'];if(hoverKeys.includes(key)&&currentPlayerSettings.controllerType!=='hovercraft')return false;if(!['moveSpeed','acceleration','collisionRadius','gravity','jumpSpeed','collisionHeight',...hoverKeys].includes(key)||typeof value!=='number'||!Number.isFinite(value)||value<=0)return false;if(key==='collisionHeight'&&(value<0.1||value>100))return false;}
    if(!(key==='collisionHeight'&&value===null)){if(playerAuthoringValue(key)===value)return false;next[key]=value;}
  }
  if(typeof onBeforeChange==='function')onBeforeChange();else pushUndo();currentPlayerSettings=next;return true;
}
function playerAuthoringStatus(changed) {const status=document.getElementById('player-authoring-status');if(status)status.textContent=changed?'Movement/body or Player Visual setting updated. Undo restores the previous gesture.':'Movement/body and Player Visual settings unchanged. Use finite values; movement/body sizes must be positive. Stop Play to edit.';}
function setPlayerAuthoringControlsEditable() {
  for(const id of ['player-move-speed','player-acceleration','player-steering-rate','player-boost-impulse','player-boost-acceleration','player-boost-max-speed','player-drag','player-body-radius','player-gravity','player-jump-speed','player-body-height','player-jump-enabled','player-rotate-to-movement','player-visual-mode','player-visual-asset','player-visual-scale','player-visual-rot','player-visual-offx','player-visual-offy','player-visual-offz','player-visual-blend','player-visual-autodetect-btn']){const input=document.getElementById(id);if(input)input.disabled=playMode;}
  const fit=document.getElementById('player-body-fit');if(fit)fit.disabled=playMode||!fitPlayerCharacterBody();
  const body=document.getElementById('player-visual-body');if(body)body.querySelectorAll('[data-visual-clip-role]').forEach(input=>{input.disabled=playMode;});
const equipment=document.getElementById('equipment-def-list');if(equipment){equipment.querySelectorAll('[data-equipment-field], [data-eqdef-remove], [data-equipment-socket], [data-equipment-item], [data-eqdef-definition]').forEach(input=>{const bound=input.dataset.equipmentField?.startsWith('weapon.')&&currentPlayerSettings.equipmentDefs?.[Number(input.dataset.equipmentIndex)]?.weapon?.definitionRef;input.disabled=playMode||!!bound;});equipment.querySelectorAll('[data-equipment-item-slot]').forEach(button=>{button.disabled=playMode||!equipmentNamedItem(currentPlayerSettings.equipmentDefs?.[Number(button.dataset.equipmentItemSlot)]?.itemName)?.equipSlot;});}
  const addEquipment=document.getElementById('equipment-def-add-btn');if(addEquipment)addEquipment.disabled=playMode||currentPlayerSettings.equipmentDefs!==undefined&&!Array.isArray(currentPlayerSettings.equipmentDefs);
}
function bindPlayerAuthoringControls() {
  const fields={'player-move-speed':'moveSpeed','player-acceleration':'acceleration','player-steering-rate':'steeringRate','player-boost-impulse':'boostImpulse','player-boost-acceleration':'boostAcceleration','player-boost-max-speed':'boostMaxSpeed','player-drag':'drag','player-body-radius':'collisionRadius','player-gravity':'gravity','player-jump-speed':'jumpSpeed','player-body-height':'collisionHeight'};
  for(const [id,key]of Object.entries(fields)){const input=document.getElementById(id);if(!input)continue;input.disabled=playMode;let recorded=false;input.onfocus=()=>{recorded=false;};const handler=()=>{const value=input.value.trim()?Number(input.value):key==='collisionHeight'?null:NaN;playerAuthoringStatus(changePlayerAuthoringField(key,value,()=>{if(!recorded){pushUndo();recorded=true;}}));};if(key==='collisionHeight')input.onchange=handler;else input.oninput=handler;input.onblur=()=>{input.value=String(playerAuthoringValue(key)??'');};}
  const jump=document.getElementById('player-jump-enabled');if(jump){jump.disabled=playMode;jump.onchange=()=>{if(changePlayerAuthoringField('jumpEnabled',jump.checked))renderPlayerSettingsPanel();};}
  const turn=document.getElementById('player-rotate-to-movement');if(turn){turn.disabled=playMode;turn.checked=!!playerAuthoringValue('rotateToMovement');turn.onchange=()=>{playerAuthoringStatus(changePlayerAuthoringField('rotateToMovement',turn.checked));turn.checked=!!playerAuthoringValue('rotateToMovement');};}
  const fit=document.getElementById('player-body-fit');if(fit){fit.disabled=playMode||!fitPlayerCharacterBody();fit.onclick=applyPlayerBodyFit;}
}
function applyPlayerBodyFit() {
  if(playMode)return false;const fit=fitPlayerCharacterBody();if(!fit)return false;
  const next={...currentPlayerSettings,...fit};if(JSON.stringify(next)===JSON.stringify(currentPlayerSettings))return false;
  pushUndo();currentPlayerSettings=next;renderPlayerSettingsPanel();return true;
}
function autoDetectPlayerVisualClips() {
  if(playMode)return false;const raw=currentPlayerSettings.visual,asset=findAssetById(raw?.assetId);
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||(raw.clipMap!==undefined&&(!raw.clipMap||typeof raw.clipMap!=='object'||Array.isArray(raw.clipMap)))||asset?.type!=='skinnedMesh'||!Array.isArray(asset.skin?.clips))return false;
  if(raw.clipMapIdentity!==undefined&&(!raw.clipMapIdentity||typeof raw.clipMapIdentity!=='object'||Array.isArray(raw.clipMapIdentity)))return false;
  const visual=JSON.parse(JSON.stringify(raw));
  if(visual.clipMap===undefined)visual.clipMap={...defaultPlayerVisual().clipMap};
  const mapped=autoDetectPlayerClips(visual,asset);if(JSON.stringify(visual)===JSON.stringify(raw))return false;
  pushUndo();currentPlayerSettings={...currentPlayerSettings,visual};renderPlayerVisualPanel();showStatus(`Auto-detected clip mapping from clip names (${mapped}/7 mapped)`);return true;
}
function bindPlayerVisualAuthoringControls() {
  const fields={'player-visual-scale':'visual.scale','player-visual-rot':'visual.rotationOffsetY','player-visual-offx':'visual.positionOffset.x','player-visual-offy':'visual.positionOffset.y','player-visual-offz':'visual.positionOffset.z','player-visual-blend':'visual.blendTime'};
  for(const [id,key]of Object.entries(fields)){const input=document.getElementById(id);if(!input)continue;input.disabled=playMode;let recorded=false;input.onfocus=()=>{recorded=false;};input.oninput=()=>{const value=input.value.trim()?Number(input.value):NaN;playerAuthoringStatus(changePlayerAuthoringField(key,value,()=>{if(!recorded){pushUndo();recorded=true;}}));};input.onblur=()=>{input.value=String(playerAuthoringValue(key)??'');};}
  for(const [id,key]of [['player-visual-mode','visual.mode'],['player-visual-asset','visual.assetId']]){const input=document.getElementById(id);if(!input)continue;input.disabled=playMode;input.onchange=()=>{const changed=changePlayerAuthoringField(key,key==='visual.assetId'?(input.value||null):input.value);if(changed){renderPlayerVisualPanel();renderEquipmentDefList();}playerAuthoringStatus(changed);};}
  const body=document.getElementById('player-visual-body');if(body)body.querySelectorAll('[data-visual-clip-role]').forEach(input=>{input.disabled=playMode;input.onchange=()=>{const value=input.value===''?null:Number(input.value);playerAuthoringStatus(changePlayerAuthoringField('visual.clipMap.'+input.dataset.visualClipRole,value));};});
  const auto=document.getElementById('player-visual-autodetect-btn');if(auto){auto.disabled=playMode;auto.onclick=autoDetectPlayerVisualClips;}
}
// Wave 6B (Priority A/Sections 3-6): the dynamic body of the Player Visual
// section -- built in JS (not static HTML) because the clip-mapping
// dropdowns need options populated from whichever skinned asset is
// currently selected, and that set changes as the author picks a
// different asset.
function renderPlayerVisualPanel() {
  const modeControl=document.getElementById('player-visual-mode');
  if(['platformer2d','topdown2d'].includes(currentPlayerSettings.controllerType)){modeControl.disabled=true;document.getElementById('player-visual-body').innerHTML='<p class="field-help">The selected authored Sprite is the Player visual. Select it to edit Sprite assets, animation and its registered 2D Controller settings; legacy 3D visual settings are retained.</p>';return;}
  modeControl.disabled=playMode;
  const raw=currentPlayerSettings.visual,visual = {...defaultPlayerVisual(),...(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{})};
  document.getElementById('player-body-fit').disabled = playMode||!fitPlayerCharacterBody();
  document.getElementById('player-visual-mode').value = visual.mode;
  const bodyEl = document.getElementById('player-visual-body');
  if (visual.mode !== 'skinned') { bodyEl.innerHTML = ''; bindPlayerVisualAuthoringControls();return; }
  const skinnedAssets = assets.filter((a) => a.type === 'skinnedMesh' || (currentPlayerSettings.controllerType === 'hovercraft' && a.type === 'mesh'));
  const selectedAsset = findAssetById(visual.assetId);
  const clipNames = (selectedAsset && selectedAsset.skin) ? selectedAsset.skin.clips.map((c) => c.name) : [];
  const roleRow = (role, label) => {const mapped=playerClipMappingState(visual,selectedAsset,role);return `
    <div class="field-row"><label style="font-size:10px;color:#66759a">${label}</label>
      <select data-visual-clip-role="${role}">
        <option value="">Automatic name matching (legacy)</option>
        ${mapped.status==='unavailable'||visual.clipMap?.[role]!=null&&mapped.index==null?`<option value="__retained__" selected disabled>Unavailable saved clip ${escapeHtml(String(visual.clipMap[role]))} (retained; choose to review)</option>`:''}
        ${clipNames.map((n, i) => `<option value="${i}" ${mapped.index === i ? 'selected' : ''}${!n||clipNames.filter(name=>name===n).length!==1?' disabled':''}>${escapeHtml(n)}${clipNames.filter(name=>name===n).length!==1?' (ambiguous name)':''}</option>`).join('')}
      </select>
    </div>`;};
  bodyEl.innerHTML = `
    <div class="field-row"><label style="font-size:10px;color:#66759a">Mesh Asset</label>
      <select id="player-visual-asset">
        <option value="">Choose an authored visual...</option>
        ${visual.assetId&&!skinnedAssets.some(a=>a.id===visual.assetId)?`<option value="${escapeHtml(visual.assetId)}" selected disabled>Unavailable saved visual (retained)</option>`:''}
        ${skinnedAssets.map((a) => `<option value="${escapeHtml(a.id)}" ${visual.assetId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
      </select>
    </div>
    ${skinnedAssets.length === 0 ? '<p style="color:#66759a;font-size:11px;margin:2px 0">No compatible visual assets imported yet -- Hovercraft accepts static or skinned models; character controllers use skinned glTF/GLB.</p>' : ''}
    <div class="field-triple">
      <div><label style="font-size:10px;color:#66759a">Scale</label><input type="number" id="player-visual-scale" step="0.1" min="0.05" value="${escapeHtml(String(playerAuthoringValue('visual.scale')))}"></div>
      <div><label style="font-size:10px;color:#66759a">Rotation Offset (deg)</label><input type="number" id="player-visual-rot" step="5" value="${escapeHtml(String(playerAuthoringValue('visual.rotationOffsetY')))}"></div>
    </div>
    <div class="field-triple">
      <div><label style="font-size:10px;color:#66759a">Offset X</label><input type="number" id="player-visual-offx" step="0.05" value="${escapeHtml(String(playerAuthoringValue('visual.positionOffset.x')))}"></div>
      <div><label style="font-size:10px;color:#66759a">Offset Y</label><input type="number" id="player-visual-offy" step="0.05" value="${escapeHtml(String(playerAuthoringValue('visual.positionOffset.y')))}"></div>
      <div><label style="font-size:10px;color:#66759a">Offset Z</label><input type="number" id="player-visual-offz" step="0.05" value="${escapeHtml(String(playerAuthoringValue('visual.positionOffset.z')))}"></div>
    </div>
    ${selectedAsset && selectedAsset.type === 'skinnedMesh' ? `
    <div class="field-row"><label>Animation Clip Mapping</label>
      <button id="player-visual-autodetect-btn" class="toolbar-btn" style="margin-bottom:6px">Auto Detect Clips</button>
    </div>
    ${roleRow('idle', 'Idle Clip')}${roleRow('walk', 'Walk Clip')}${roleRow('run', 'Run / Sprint Clip')}
    ${roleRow('jump', 'Jump Clip')}${roleRow('fall', 'Fall Clip (optional)')}
    ${roleRow('attack', 'Attack Clip')}${roleRow('death', 'Death Clip (optional)')}
    <p class="field-help">Player mappings belong to this Level's visual, not NPC Auto-Animate or an instance's manual clip. New choices retain exact clip names and Asset identity. Changing Mesh Asset retains old mappings as unavailable until you choose clips or deliberately Auto Detect. Unique named clips follow reorder; missing/ambiguous names never guess. Historical numeric mappings remain compatible until reviewed. Automatic uses existing name matching, not bind pose.</p>
    <div class="field-row"><label style="font-size:10px;color:#66759a">Locomotion Blend Time (s)</label><input type="number" id="player-visual-blend" step="0.05" min="0" value="${escapeHtml(String(playerAuthoringValue('visual.blendTime')))}"></div>
    ` : ''}
  `;
  bindPlayerVisualAuthoringControls();
}
// Factored out of the "Auto Detect Clips" button above so the Priority H
// "Create Animated Player" preset helper (below) can run the exact same
// name-matching pass -- one shared implementation, not two copies that
// could drift apart. Returns how many of the 7 roles got mapped.
function autoDetectPlayerClips(visual, selectedAsset) {
  const fakeEntity = { skin: selectedAsset.skin };
  let mapped = 0;
  for (const role of Object.keys(visual.clipMap)) {
    const idx = findCharacterClip(fakeEntity, CHARACTER_ANIM_KEYWORDS[role] || [role]);
    if (idx !== null) { visual.clipMap[role] = idx; visual.clipMapIdentity={...visual.clipMapIdentity,[role]:{assetId:selectedAsset.id,name:selectedAsset.skin.clips[idx].name}}; mapped++; }
  }
  return mapped;
}
// Wave 6B (Priority H): "Create Animated Player" -- the one-click version of
// "choose skinned asset -> auto-detect clips -> choose controller ->
// configure speeds" the spec asks for. Uses the same independent controller
// candidate as the selector and Builder; one history transaction also owns
// the visual and clip mapping, with no synthetic selector event or nested Undo.
document.getElementById('create-animated-player-btn').addEventListener('click', () => {
  if(playMode)return;
  const skinnedAssets = assets.filter((a) => a.type === 'skinnedMesh');
  if (skinnedAssets.length === 0) { showStatus('Import a skinned model first (Assets tab -> Import Model)'); return; }
  const candidate=buildPlayerControllerSettings(currentPlayerSettings,'thirdperson');if(!candidate.ok)return;
  if(currentPlayerSettings.visual!==undefined&&(!currentPlayerSettings.visual||typeof currentPlayerSettings.visual!=='object'||Array.isArray(currentPlayerSettings.visual))){showStatus('Current Player visual is unavailable. Retain its settings for recovery.');return;}
  const next=candidate.settings,visual = next.visual || (next.visual = defaultPlayerVisual());
  if(!visual.clipMap||typeof visual.clipMap!=='object'||Array.isArray(visual.clipMap)){showStatus('Current animation clip settings are unavailable. Retain them for recovery.');return;}
  visual.mode = 'skinned';
  if (!skinnedAssets.some(asset=>asset.id===visual.assetId)) visual.assetId = skinnedAssets[0].id;
  const selectedAsset = findAssetById(visual.assetId);
  const mapped = autoDetectPlayerClips(visual, selectedAsset);
  if(JSON.stringify(next)===JSON.stringify(currentPlayerSettings))return;
  pushUndo();currentPlayerSettings=next;
  renderPlayerSettingsPanel();
  renderInputActionPanel();
  showStatus(`✨ Animated Player created -- ${selectedAsset.name}, ${mapped}/7 clips auto-mapped`);
});
function platformerPlayerOptions() {
  return placed.filter(item=>item.kind==='sprite'&&typeof item.id==='string'&&placed.filter(other=>other.id===item.id).length===1);
}
function platformerPlayerCandidate(target) {
  if(!target||target.kind!=='sprite'||!platformerPlayerOptions().includes(target))return {ok:false,reason:'Choose one uniquely identified Sprite in this level.'};
  if(Object.prototype.hasOwnProperty.call(target,'components')&&(!target.components||typeof target.components!=='object'||Array.isArray(target.components)||Object.getPrototypeOf(target.components)!==Object.prototype))return {ok:false,reason:'The saved component bag is malformed. Retain it for explicit repair; Player setup made no changes.'};
  if(!currentPlayerSettings||typeof currentPlayerSettings!=='object'||Array.isArray(currentPlayerSettings))return {ok:false,reason:'Retain unavailable Player settings for recovery.'};
  const candidate={...target,components:JSON.parse(JSON.stringify(target.components||{}))};
  const bag=candidate.components;
  if(!bag['box-collider-2d']&&!bag['circle-collider-2d'])OpusAuthoring.addComponent(candidate,'box-collider-2d');
  if(!bag['body-2d']){OpusAuthoring.addComponent(candidate,'body-2d');bag['body-2d'].type='kinematic';}
  if(!bag['character-collision-2d'])OpusAuthoring.addComponent(candidate,'character-collision-2d');
  if(!bag['platformer-controller-2d'])OpusAuthoring.addComponent(candidate,'platformer-controller-2d');
  const issues=OpusAuthoring.validateComponent(candidate,'platformer-controller-2d');
  if(issues.length)return {ok:false,reason:issues[0].message,issues};
  const control=bag['platformer-controller-2d'],labels=inputActionLabels();
  if(control.enabled!==true)return {ok:false,reason:'Enable this Sprite’s Platformer Controller explicitly before binding Player control.'};
  if(['moveLeftActionRef','moveRightActionRef','jumpActionRef'].some(key=>!Object.prototype.hasOwnProperty.call(labels,control[key])))return {ok:false,reason:'Choose available named Input Actions in the Platformer Controller before binding this Player.'};
  const settings={...currentPlayerSettings,controllerType:'platformer2d',platformerObjectRef:target.id};
  return {ok:true,target,components:bag,settings,clearActiveCameras:false,changed:JSON.stringify(bag)!==JSON.stringify(target.components||{})||JSON.stringify(settings)!==JSON.stringify(currentPlayerSettings)};
}
function applyPlatformerPlayerSetup(target) {
  if(playMode)return {ok:false,reason:'Stop Play before configuring the Platformer Player.'};
  const candidate=platformerPlayerCandidate(target);if(!candidate.ok)return candidate;
  if(!candidate.changed)return {ok:true,changed:false,code:'UNCHANGED'};
  pushUndo();target.components=candidate.components;currentPlayerSettings=candidate.settings;body2DObjects.add(target);
  renderPlayerSettingsPanel();renderInputActionPanel();renderInspector();validateCurrentProject();
  return {ok:true,changed:true,code:'APPLIED'};
}
function renderPlatformerPlayerSettings() {
  const host=document.getElementById('player-platformer-settings');if(!host)return;
  const active=currentPlayerSettings.controllerType==='platformer2d';host.hidden=!active;
  if(!active)return;
  const select=document.getElementById('player-platformer-target'),value=currentPlayerSettings.platformerObjectRef,options=platformerPlayerOptions();
  select.innerHTML='<option value="">Choose a Sprite</option>'+(value&&!options.some(item=>item.id===value)?`<option value="${escapeHtml(String(value))}" selected disabled>Unavailable saved Player Sprite</option>`:'')+options.map(item=>`<option value="${escapeHtml(item.id)}"${item.id===value?' selected':''}>${escapeHtml(item.name||item.id)}</option>`).join('');
  select.disabled=playMode;select.onchange=()=>{const result=applyPlatformerPlayerSetup(options.find(item=>item.id===select.value));if(!result.ok){document.getElementById('player-platformer-status').textContent=result.reason;select.value=String(currentPlayerSettings.platformerObjectRef||'');}};
  const use=document.getElementById('player-platformer-use-selected');use.disabled=playMode||selectedItem?.kind!=='sprite';use.onclick=()=>{const result=applyPlatformerPlayerSetup(selectedItem);if(!result.ok)document.getElementById('player-platformer-status').textContent=result.reason;};
  const target=options.find(item=>item.id===value),edit=document.getElementById('player-platformer-edit');edit.disabled=playMode||!target;edit.onclick=()=>selectItem(target);
  const state=platformerPlayerCandidate(target);document.getElementById('player-platformer-status').textContent=state.ok?(state.changed?'Setup incomplete: select this Sprite to compose missing components.':'Player Sprite ready. Select it to tune the registered component.'):(state.reason||'Choose a Player Sprite.');
}
function topdown2DPlayerCandidate(target) {
  if(!target||target.kind!=='sprite'||!platformerPlayerOptions().includes(target))return {ok:false,reason:'Choose one uniquely identified Sprite in this level.'};
  if(Object.prototype.hasOwnProperty.call(target,'components')&&(!target.components||typeof target.components!=='object'||Array.isArray(target.components)||Object.getPrototypeOf(target.components)!==Object.prototype))return {ok:false,reason:'The saved component bag is malformed. Retain it for explicit repair; setup made no changes.'};
  if(!currentPlayerSettings||typeof currentPlayerSettings!=='object'||Array.isArray(currentPlayerSettings))return {ok:false,reason:'Retain unavailable Player settings for recovery.'};
  const candidate={...target,components:JSON.parse(JSON.stringify(target.components||{}))},bag=candidate.components;
  if(!bag['box-collider-2d']&&!bag['circle-collider-2d'])OpusAuthoring.addComponent(candidate,'box-collider-2d');
  if(!bag['body-2d']){OpusAuthoring.addComponent(candidate,'body-2d');bag['body-2d'].type='kinematic';}
  if(!bag['character-collision-2d']){OpusAuthoring.addComponent(candidate,'character-collision-2d');for(const key of ['wallSlideEnabled','slopeHandlingEnabled','stepHandlingEnabled'])bag['character-collision-2d'][key]=false;}
  if(!bag['topdown-controller-2d'])OpusAuthoring.addComponent(candidate,'topdown-controller-2d');
  const issues=OpusAuthoring.validateComponent(candidate,'topdown-controller-2d');if(issues.length)return {ok:false,reason:issues[0].message,issues};
  const control=bag['topdown-controller-2d'],labels=inputActionLabels();
  if(control.enabled!==true)return {ok:false,reason:'Enable the Sprite’s Top-down Controller 2D explicitly before binding Player control.'};
  if(['moveLeftActionRef','moveRightActionRef','moveUpActionRef','moveDownActionRef'].some(key=>!Object.prototype.hasOwnProperty.call(labels,control[key])))return {ok:false,reason:'Choose available named Input Actions in Top-down Controller 2D before binding this Player.'};
  const settings={...currentPlayerSettings,controllerType:'topdown2d',topdownObjectRef:target.id};
  return {ok:true,target,components:bag,settings,clearActiveCameras:false,changed:JSON.stringify(bag)!==JSON.stringify(target.components||{})||JSON.stringify(settings)!==JSON.stringify(currentPlayerSettings)};
}
function applyTopdown2DPlayerSetup(target) {
  if(playMode)return {ok:false,reason:'Stop Play before configuring Top-down 2D Player.'};
  const candidate=topdown2DPlayerCandidate(target);if(!candidate.ok)return candidate;
  if(!candidate.changed)return {ok:true,changed:false,code:'UNCHANGED'};
  pushUndo();target.components=candidate.components;currentPlayerSettings=candidate.settings;body2DObjects.add(target);
  renderPlayerSettingsPanel();renderInputActionPanel();renderInspector();validateCurrentProject();return {ok:true,changed:true,code:'APPLIED'};
}
function renderTopdown2DPlayerSettings() {
  const host=document.getElementById('player-topdown2d-settings');if(!host)return;const active=currentPlayerSettings.controllerType==='topdown2d';host.hidden=!active;if(!active)return;
  const select=document.getElementById('player-topdown2d-target'),value=currentPlayerSettings.topdownObjectRef,options=platformerPlayerOptions();
  select.innerHTML='<option value="">Choose a Sprite</option>'+(value&&!options.some(item=>item.id===value)?`<option value="${escapeHtml(String(value))}" selected disabled>Unavailable saved Player Sprite</option>`:'')+options.map(item=>`<option value="${escapeHtml(item.id)}"${item.id===value?' selected':''}>${escapeHtml(item.name||item.id)}</option>`).join('');
  select.disabled=playMode;select.onchange=()=>{const result=applyTopdown2DPlayerSetup(options.find(item=>item.id===select.value));if(!result.ok){document.getElementById('player-topdown2d-status').textContent=result.reason;select.value=String(currentPlayerSettings.topdownObjectRef||'');}};
  const use=document.getElementById('player-topdown2d-use-selected');use.disabled=playMode||selectedItem?.kind!=='sprite';use.onclick=()=>{const result=applyTopdown2DPlayerSetup(selectedItem);if(!result.ok)document.getElementById('player-topdown2d-status').textContent=result.reason;};
  const target=options.find(item=>item.id===value),edit=document.getElementById('player-topdown2d-edit');edit.disabled=playMode||!target;edit.onclick=()=>selectItem(target);
  const state=topdown2DPlayerCandidate(target);document.getElementById('player-topdown2d-status').textContent=state.ok?(state.changed?'Setup incomplete: select this Sprite to compose missing components.':'Top-down 2D Player Sprite ready. Select it to tune the registered component.'):(state.reason||'Choose a Player Sprite.');
}
function playerBuilderCandidate(setup) {
  if(setup?.controllerType==='topdown2d')return topdown2DPlayerCandidate(platformerPlayerOptions().find(item=>item.id===setup.topdownObjectRef));
  if(setup?.controllerType==='platformer2d')return platformerPlayerCandidate(platformerPlayerOptions().find(item=>item.id===setup.platformerObjectRef));
  if(!setup||typeof setup!=='object'||Array.isArray(setup)||!['keep','player'].includes(setup.startView)||typeof setup.visual!=='string'||typeof setup.context!=='string'||typeof setup.resetDefaults!=='boolean'||typeof setup.resetView!=='boolean')return {ok:false,reason:'Choose valid Player setup options.'};
  const result=buildPlayerControllerSettings(currentPlayerSettings,setup.controllerType,setup);if(!result.ok)return result;
  const next=result.settings;
  if(setup.controllerType==='firstperson'&&setup.visual!=='keep')return {ok:false,reason:'First-person uses a hidden controller body. Keep saved visual settings for other play styles; this Builder does not add first-person arms or a visible body.'};
  if(setup.visual!=='keep'){
    if(next.visual!==undefined&&(!next.visual||typeof next.visual!=='object'||Array.isArray(next.visual)))return {ok:false,reason:'Current visual settings are unavailable. Keep them for recovery before selecting a replacement.'};
    if(setup.visual==='primitive'){next.visual={...defaultPlayerVisual(),...(next.visual||{}),mode:'primitive'};}
    else if(setup.visual.startsWith('asset:')){
      const id=setup.visual.slice(6),asset=assets.find(entry=>entry.id===id && (entry.type==='skinnedMesh'||setup.controllerType==='hovercraft'&&entry.type==='mesh'));
      if(!asset)return {ok:false,reason:'Choose an available compatible visual asset, or keep the current visual.'};
      next.visual={...defaultPlayerVisual(),...(next.visual||{}),mode:'skinned',assetId:id};
      if(!next.visual.clipMap||typeof next.visual.clipMap!=='object'||Array.isArray(next.visual.clipMap))return {ok:false,reason:'Current animation clip settings are unavailable. Keep the visual for recovery before replacing it.'};
      if(asset.type==='skinnedMesh')autoDetectPlayerClips(next.visual,asset);
    }else return {ok:false,reason:'Choose a supported Player visual.'};
  }
  if(setup.context!=='keep'){
    if(setup.context==='unrestricted'){if(!OpusInputContexts.inspect(inputContexts).ok)return {ok:false,reason:'Repair the input context library before choosing a new initial context.'};next.inputContextId=null;}
    else if(setup.context.startsWith('context:')){
      const id=setup.context.slice(8),compiled=OpusInputContexts.compile(inputContexts,Object.keys(inputActionLabels()));
      if(!OpusInputContexts.resolve(compiled,id).valid)return {ok:false,reason:'Choose an available initial input context; missing references stay retained.'};
      next.inputContextId=id;
    }else return {ok:false,reason:'Choose a supported initial input context.'};
  }
  return {ok:true,settings:next,clearActiveCameras:setup.startView==='player'&&placed.some(item=>item.kind==='camera'&&item.isActiveCamera)};
}
function applyPlayerBuilderSetup(setup) {
  if(playMode)return {ok:false,reason:'Stop Play before applying Player setup.'};
  if(setup?.controllerType==='topdown2d')return applyTopdown2DPlayerSetup(platformerPlayerOptions().find(item=>item.id===setup.topdownObjectRef));
  if(setup?.controllerType==='platformer2d')return applyPlatformerPlayerSetup(platformerPlayerOptions().find(item=>item.id===setup.platformerObjectRef));
  const candidate=playerBuilderCandidate(setup);if(!candidate.ok)return candidate;
  if(JSON.stringify(candidate.settings)===JSON.stringify(currentPlayerSettings)&&!candidate.clearActiveCameras)return {ok:true,changed:false};
  pushUndo();currentPlayerSettings=candidate.settings;
  if(candidate.clearActiveCameras)for(const item of placed)if(item.kind==='camera')item.isActiveCamera=false;
  renderPlayerSettingsPanel();renderInputActionPanel();renderInspector();return {ok:true,changed:true};
}
function closePlayerBuilder() {
  if(typeof playerBuilderDraft!=='undefined')playerBuilderDraft=null;
  const host=document.getElementById('player-builder');if(host){host.hidden=true;host.innerHTML='';}
}
function openPlayerBuilder() {
  if(playMode)return;
  playerBuilderDraft={step:1,levelId:levels[currentLevelIndex]?.id,controllerType:currentPlayerSettings.controllerType,platformerObjectRef:currentPlayerSettings.platformerObjectRef||'',topdownObjectRef:currentPlayerSettings.topdownObjectRef||'',resetDefaults:false,resetView:false,visual:'keep',context:'keep',startView:'keep'};
  renderPlayerBuilder();
}
function playerBuilderGroundHelp(type, settings=currentPlayerSettings) {
  if(type==='topdown2d')return 'World XY Top-down: use the authored Sprite position and existing active 2D Camera. Static Body 2D ordinary Colliders and solid Tiles block movement. Character Wall Slide, Slope Following and Step Handling must all be off. No gravity, Jump, terrain/XZ spawn fallback, visual replacement, Camera activation or input rebinding.';
  if(type==='platformer2d')return 'World XY platformer: use an authored Sprite position above Static Body 2D ground with an ordinary Collider and an active 2D Camera. No terrain/XZ spawn fallback, legacy visual replacement, Camera activation or input rebinding is performed.';
  if(type==='topdown'||type==='hovercraft')return 'Top-down and Hovercraft treat solid objects as horizontal blockers regardless of height: a solid mesh floor blocks like a wall. Keep decorative ground non-solid, with separate solid walls. Terrain (or Water for Hovercraft) and the existing fallback set altitude; place the Spawn Point clear of solid obstacles.';
  if(type==='thirdperson'&&!settings?.jumpEnabled)return 'Third-person Jump / vertical physics is currently off: solid mesh platforms behave as horizontal obstacles, not walkable floors. Enable Jump in Player settings to use solid floors and gravity, or keep decorative ground non-solid. Place the Spawn Point clear of obstacles.';
  return 'First-person and Third-person with Jump / vertical physics enabled can stand on solid floors using gravity. Place the existing Spawn Point above suitable ground with clearance; the Builder does not create floors or guarantee an overlap-free spawn.';
}
function renderPlatformerPlayerBuilder(host,draft) {
  const options=platformerPlayerOptions(),candidate=playerBuilderCandidate(draft);
  const picker=`<label for="player-builder-platformer-target">${draft.step===2?'2. Choose this level’s Player Sprite':'3. Review Platformer Player'}</label><select id="player-builder-platformer-target"><option value="">Choose a Sprite</option>${options.map(item=>`<option value="${escapeHtml(item.id)}"${item.id===draft.platformerObjectRef?' selected':''}>${escapeHtml(item.name||item.id)}</option>`).join('')}</select>`;
  host.hidden=false;host.innerHTML=`<h3>Player Builder <small>Step ${draft.step} of 3</small></h3>${picker}<p class="field-help">Uses the existing Sprite and composes only missing valid Collider, Kinematic Body, Character Collision and Platformer components. Compatible tuning is kept. Select the Sprite afterward to tune Run, Gravity, Jump and named Input Actions.</p><p class="field-help">${escapeHtml(playerBuilderGroundHelp('platformer2d'))} Existing input context, bindings, health and legacy visual settings remain unchanged. Cancel changes nothing; Apply is one changed-only Undo.</p><p id="player-builder-status" role="status">${escapeHtml(candidate.ok?'Ready to use this Sprite; no extra Player mesh is spawned.':candidate.reason)}</p><div class="player-builder-actions"><button id="player-builder-back" type="button">Back</button>${draft.step===2?'<button id="player-builder-next" type="button">Next</button>':'<button id="player-builder-apply" type="button">Apply setup</button>'}<button id="player-builder-cancel" type="button">Cancel</button></div>`;
  host.querySelector('#player-builder-platformer-target').onchange=event=>{draft.platformerObjectRef=event.target.value;renderPlayerBuilder();};
  host.querySelector('#player-builder-back').onclick=()=>{draft.step--;renderPlayerBuilder();};
  const next=host.querySelector('#player-builder-next');if(next)next.onclick=()=>{draft.step=3;renderPlayerBuilder();};
  const apply=host.querySelector('#player-builder-apply');if(apply)apply.onclick=()=>{if(draft.levelId!==levels[currentLevelIndex]?.id){host.querySelector('#player-builder-status').textContent='Level changed. Cancel and reopen setup.';return;}const result=applyPlayerBuilderSetup(draft);if(result.ok){closePlayerBuilder();showStatus(result.changed?'Platformer Player configured. Undo restores the previous setup.':'Platformer Player unchanged.');}else host.querySelector('#player-builder-status').textContent=result.reason;};
  host.querySelector('#player-builder-cancel').onclick=closePlayerBuilder;
  if(playMode)host.querySelectorAll('select,button:not(#player-builder-cancel)').forEach(control=>control.disabled=true);
}
function renderTopdown2DPlayerBuilder(host,draft) {
  const options=platformerPlayerOptions(),candidate=playerBuilderCandidate(draft);
  host.hidden=false;host.innerHTML=`<h3>Player Builder <small>Step ${draft.step} of 3</small></h3><label for="player-builder-topdown2d-target">${draft.step===2?'2. Choose this level’s Top-down 2D Sprite':'3. Review Top-down 2D Player'}</label><select id="player-builder-topdown2d-target"><option value="">Choose a Sprite</option>${options.map(item=>`<option value="${escapeHtml(item.id)}"${item.id===draft.topdownObjectRef?' selected':''}>${escapeHtml(item.name||item.id)}</option>`).join('')}</select><p class="field-help">Composes missing Collider, Kinematic Body, compatible Character Collision and Top-down Controller only. Existing incompatible Character settings require explicit repair; they are never overwritten. Select the Sprite afterward to tune speed and four named Input Actions.</p><p class="field-help">${escapeHtml(playerBuilderGroundHelp('topdown2d'))} Existing context, bindings, health and legacy visual settings remain unchanged. Cancel changes nothing; Apply is one changed-only Undo.</p><p id="player-builder-status" role="status">${escapeHtml(candidate.ok?'Ready to use this Sprite; no extra Player mesh is spawned.':candidate.reason)}</p><div class="player-builder-actions"><button id="player-builder-back" type="button">Back</button>${draft.step===2?'<button id="player-builder-next" type="button">Next</button>':'<button id="player-builder-apply" type="button">Apply setup</button>'}<button id="player-builder-cancel" type="button">Cancel</button></div>`;
  host.querySelector('#player-builder-topdown2d-target').onchange=event=>{draft.topdownObjectRef=event.target.value;renderPlayerBuilder();};host.querySelector('#player-builder-back').onclick=()=>{draft.step--;renderPlayerBuilder();};
  const next=host.querySelector('#player-builder-next');if(next)next.onclick=()=>{draft.step=3;renderPlayerBuilder();};
  const apply=host.querySelector('#player-builder-apply');if(apply)apply.onclick=()=>{if(draft.levelId!==levels[currentLevelIndex]?.id){host.querySelector('#player-builder-status').textContent='Level changed. Cancel and reopen setup.';return;}const result=applyPlayerBuilderSetup(draft);if(result.ok){closePlayerBuilder();showStatus(result.changed?'Top-down 2D Player configured. Undo restores the previous setup.':'Top-down 2D Player unchanged.');}else host.querySelector('#player-builder-status').textContent=result.reason;};
  host.querySelector('#player-builder-cancel').onclick=closePlayerBuilder;if(playMode)host.querySelectorAll('select,button:not(#player-builder-cancel)').forEach(control=>control.disabled=true);
}
function renderPlayerBuilder() {
  const host=document.getElementById('player-builder');if(!host||!playerBuilderDraft)return;
  if(playerBuilderDraft.controllerType==='topdown2d'&&playerBuilderDraft.step>1){renderTopdown2DPlayerBuilder(host,playerBuilderDraft);return;}
  if(playerBuilderDraft.controllerType==='platformer2d'&&playerBuilderDraft.step>1){renderPlatformerPlayerBuilder(host,playerBuilderDraft);return;}
  const draft=playerBuilderDraft,labels={hovercraft:'Hovercraft — steering and boost',topdown:'Top-down 3D — world XZ ground plane',thirdperson:'Third-person — visible character and follow view',firstperson:'First-person — mouse look and gravity',platformer2d:'2D Platformer — existing Sprite, Run and Jump',topdown2d:'Top-down 2D — world XY Sprite'};
  const field=(id,text)=>`<label for="player-builder-${id}">${text}</label>`,selected=(value,current)=>value===current?' selected':'';
  let body='';
  if(draft.step===1)body=`${field('controller','1. Choose play style')}<select id="player-builder-controller">${Object.entries(labels).map(([id,label])=>`<option value="${id}"${selected(id,draft.controllerType)}>${escapeHtml(label)}</option>`).join('')}</select><p class="field-help">Uses existing 3D controllers. Third-person jumping is off unless enabled in Player settings; First-person includes gravity. Customized movement/body values remain unchanged when switching styles.</p><label><input id="player-builder-reset-defaults" type="checkbox"${draft.resetDefaults?' checked':''}> Reset movement/body defaults for this style</label><label><input id="player-builder-reset-view" type="checkbox"${draft.resetView?' checked':''}> Reset opening view defaults (yaw/pitch; First-person FOV 70°, eye height 0.6)</label>`;
  if(draft.step===2){
    const firstPerson=draft.controllerType==='firstperson',compatible=firstPerson?[]:assets.filter(asset=>asset.type==='skinnedMesh'||draft.controllerType==='hovercraft'&&asset.type==='mesh'),contexts=OpusInputContexts.inspect(inputContexts);
    body=`${field('visual','2. Visual and input')}<select id="player-builder-visual"><option value="keep"${selected('keep',draft.visual)}>Keep current visual</option>${firstPerson?'':`<option value="primitive"${selected('primitive',draft.visual)}>Default primitive body</option>${compatible.map(asset=>`<option value="asset:${escapeHtml(asset.id)}"${selected('asset:'+asset.id,draft.visual)}>${escapeHtml(asset.name)}</option>`).join('')}`}</select><p class="field-help">${firstPerson?'First-person uses a hidden controller body. Saved visual settings are retained for other play styles; this Builder does not add first-person arms or a visible body.':'Character styles use imported skinned models; Hovercraft also accepts static models. Selecting a skinned visual auto-maps existing animation clips. The visual never becomes a new collision body.'}</p>${field('context','Initial input context')}<select id="player-builder-context"><option value="keep"${selected('keep',draft.context)}>Keep current context (including saved references)</option><option value="unrestricted"${selected('unrestricted',draft.context)}${!contexts.ok?' disabled':''}>Unrestricted input</option>${(contexts.ok?contexts.record.contexts:[]).map(context=>`<option value="context:${escapeHtml(context.id)}"${selected('context:'+context.id,draft.context)}>${escapeHtml(context.name)}</option>`).join('')}</select>${field('view','Opening view ownership')}<select id="player-builder-view"><option value="keep"${selected('keep',draft.startView)}>Keep existing active Cameras</option><option value="player"${selected('player',draft.startView)}>Use Player view at start</option></select><p class="field-help">Player view clears only current-level Active Camera flags. Camera records and references remain. Start / Change Camera Actions can still intentionally override the opening view.</p>`;
  }
  if(draft.step===3){const candidate=playerBuilderCandidate(draft),s=candidate.settings,settingsLabels={moveSpeed:'Movement speed',acceleration:'Acceleration',collisionRadius:'Body radius',gravity:'Gravity',jumpSpeed:'Jump speed',jumpEnabled:'Jump enabled',rotateToMovement:'Turn toward movement',steeringRate:'Steering rate',boostImpulse:'Boost impulse',boostAcceleration:'Boost acceleration',boostMaxSpeed:'Maximum boost speed',drag:'Drag',mouseSensitivity:'Mouse sensitivity',fovDegrees:'First-person field of view',eyeHeight:'Eye height',initialYaw:'Opening yaw (degrees)',initialPitch:'Opening pitch (degrees)'};const changes=candidate.ok?Object.entries(settingsLabels).filter(([key])=>s[key]!==currentPlayerSettings[key]).map(([key,label])=>`<li>${label}: ${escapeHtml(String(key==='initialYaw'||key==='initialPitch'?cameraPitchDegrees(s[key]):s[key]))}</li>`).join(''):'';body=`<h4>3. Review this level's Player</h4>${candidate.ok?`<dl><dt>Style</dt><dd>${escapeHtml(labels[draft.controllerType])}</dd><dt>Movement speed / acceleration</dt><dd>${escapeHtml(String(s.moveSpeed))} / ${escapeHtml(String(s.acceleration))}</dd><dt>Defaults</dt><dd>${draft.resetDefaults?'Reset this style’s movement/body defaults':'Preserve customized movement/body values'}; ${draft.resetView?'reset opening view':'preserve opening angles'}. Health and unrelated settings remain unchanged.</dd><dt>Visual / input</dt><dd>${escapeHtml(draft.visual==='keep'?'Keep current visual':draft.visual==='primitive'?'Primitive body':assets.find(a=>a.id===draft.visual.slice(6))?.name||'Unavailable visual')} / ${escapeHtml(draft.context==='keep'?'Keep current context':draft.context==='unrestricted'?'Unrestricted':inputContexts.contexts?.find(c=>c.id===draft.context.slice(8))?.name||'Unavailable context')}</dd><dt>Start view</dt><dd>${draft.startView==='player'?'Player view (clear current-level Active Camera flags)':'Preserve active Cameras'}</dd></dl>${changes?`<p class="field-help">Changed settings</p><ul>${changes}</ul>`:'<p class="field-help">No movement or opening-view values change.</p>'}`:`<p role="alert">${escapeHtml(candidate.reason)}</p>`}<p class="field-help">Spawn uses this level's existing default Spawn Point, Tilemap spawn marker, or ground/water fallback. Place a Spawn Point on suitable clear geometry if necessary. This setup does not create ground or guarantee an overlap-free spawn. No input bindings, world objects or other levels are replaced.</p>`;}
  if(draft.step===1)body=body.replace('Uses existing 3D controllers.','Choose an existing legacy 3D controller or a Sprite-based world XY 2D controller. 2D modes keep their authored Sprite, Camera and input context; the reset options below apply only to legacy 3D styles.');
  const groundSettings=buildPlayerControllerSettings(currentPlayerSettings,draft.controllerType,draft);
  host.hidden=false;host.innerHTML=`<h3>Player Builder <small>Step ${draft.step} of 3</small></h3>${body}<p id="player-builder-ground-help" class="field-help">${escapeHtml(playerBuilderGroundHelp(draft.controllerType,groundSettings.ok?groundSettings.settings:currentPlayerSettings))}</p><p id="player-builder-status" class="field-help" role="status">Draft only. Apply is one Undo step; Cancel changes nothing.</p><div class="player-builder-actions"><button id="player-builder-back" type="button"${draft.step===1?' disabled':''}>Back</button>${draft.step<3?'<button id="player-builder-next" type="button">Next</button>':'<button id="player-builder-apply" type="button">Apply setup</button>'}<button id="player-builder-cancel" type="button">Cancel</button></div>`;
  const q=id=>host.querySelector('#player-builder-'+id);
  for(const [id,key]of [['controller','controllerType'],['visual','visual'],['context','context'],['view','startView']])if(q(id))q(id).onchange=event=>{draft[key]=event.target.value;if(id==='controller'){draft.visual='keep';renderPlayerBuilder();} };
  for(const [id,key]of [['reset-defaults','resetDefaults'],['reset-view','resetView']])if(q(id))q(id).onchange=event=>{draft[key]=event.target.checked;renderPlayerBuilder();};
  q('back').onclick=()=>{draft.step=Math.max(1,draft.step-1);renderPlayerBuilder();};
  if(q('next'))q('next').onclick=()=>{draft.step++;renderPlayerBuilder();};
  if(q('apply'))q('apply').onclick=()=>{if(draft.levelId!==levels[currentLevelIndex]?.id){q('status').textContent='The level changed. Cancel and reopen setup for the current level.';return;}const result=applyPlayerBuilderSetup(draft);if(result.ok){closePlayerBuilder();showStatus(result.changed?'Player setup applied. Undo restores settings and Camera choices.':'Player setup unchanged.');}else q('status').textContent=result.reason;};
  q('cancel').onclick=closePlayerBuilder;
  if(playMode)host.querySelectorAll('input,select,button:not(#player-builder-cancel)').forEach(input=>{input.disabled=true;});
}
document.getElementById('player-builder-open').onclick=openPlayerBuilder;
function renderPlayerSettingsPanel() {
  // Imports, level replacement, Undo and controller edits invalidate a review
  // even when the new document happens to reuse the same level identity.
  if(typeof closePlayerBuilder==='function')closePlayerBuilder();
  if(typeof OpusControllerTemplates!=='undefined')renderControllerTemplateLibrary();
  bindPlayerCameraAuthoringControls();
  const builderButton=document.getElementById('player-builder-open');if(builderButton)builderButton.disabled=playMode;
  const animatedButton=document.getElementById('create-animated-player-btn');if(animatedButton)animatedButton.disabled=playMode;
  const s = currentPlayerSettings;
  renderTopdown2DPlayerSettings();
  renderPlatformerPlayerSettings();
  renderInitialInputContextPicker();
  renderGamepadTuningEditor();
  renderLookPreferences();
  document.getElementById('player-controller-type').value = s.controllerType;
  document.getElementById('player-controller-type').disabled=playMode;
  document.getElementById('player-opening-camera').style.display = ['thirdperson', 'firstperson'].includes(s.controllerType) ? '' : 'none';
  document.getElementById('player-initial-yaw').value = cameraPitchDegrees(s.initialYaw || 0);
  document.getElementById('player-initial-pitch').value = cameraPitchDegrees(s.initialPitch == null ? (s.controllerType === 'thirdperson' ? 0.28 : 0) : s.initialPitch);
  const tunablesEl = document.getElementById('player-tunables');
  document.getElementById('player-body-row').style.display = ['thirdperson', 'firstperson','topdown'].includes(s.controllerType) ? '' : 'none';
  const verticalBody=document.getElementById('player-vertical-body-controls');if(verticalBody)verticalBody.style.display=['thirdperson','firstperson'].includes(s.controllerType)?'':'none';
  const topdownControls=document.getElementById('player-topdown-settings');if(topdownControls)topdownControls.style.display=s.controllerType==='topdown'?'':'none';
  document.getElementById('player-body-height').value = Number.isFinite(s.collisionHeight) ? s.collisionHeight : '';
  document.getElementById('player-body-fit').disabled = playMode||!fitPlayerCharacterBody();
  const radiusInput=document.getElementById('player-body-radius');if(radiusInput)radiusInput.value=playerAuthoringValue('collisionRadius');
  tunablesEl.style.display = ['platformer2d','topdown2d'].includes(s.controllerType)?'none':'';
  document.getElementById('player-move-speed').value = s.moveSpeed;
  document.getElementById('player-acceleration').value = s.acceleration;
  const hoverControls=document.getElementById('player-hovercraft-settings');if(hoverControls)hoverControls.style.display=s.controllerType==='hovercraft'?'':'none';
  for(const [id,key]of Object.entries({'player-steering-rate':'steeringRate','player-boost-impulse':'boostImpulse','player-boost-acceleration':'boostAcceleration','player-boost-max-speed':'boostMaxSpeed','player-drag':'drag'})){const input=document.getElementById(id);if(input)input.value=String(playerAuthoringValue(key)??'');}
  // Jump/vertical physics is Third-Person's OPT-IN toggle (Hovercraft
  // already flies, Top-Down has no camera angle that would show vertical
  // motion) -- off by default, see the comment above updateThirdPersonController.
  // First-Person always has vertical physics (there's no "FPS without
  // gravity" default worth offering), so it shows the same Gravity/Jump
  // Speed tunables unconditionally, with no enable checkbox at all.
  const jumpRowEl = document.getElementById('player-jump-row');
  const jumpTunablesEl = document.getElementById('player-jump-tunables');
  const fpTunablesEl = document.getElementById('player-fp-tunables');
  if (s.controllerType === 'thirdperson') {
    jumpRowEl.style.display = '';
    document.getElementById('player-jump-enabled').checked = !!s.jumpEnabled;
    jumpTunablesEl.style.display = s.jumpEnabled ? '' : 'none';
    document.getElementById('player-gravity').value = s.gravity != null ? s.gravity : 20;
    document.getElementById('player-jump-speed').value = s.jumpSpeed != null ? s.jumpSpeed : 8;
    fpTunablesEl.style.display = 'none';
  } else if (s.controllerType === 'firstperson') {
    jumpRowEl.style.display = 'none';
    jumpTunablesEl.style.display = '';
    document.getElementById('player-gravity').value = s.gravity != null ? s.gravity : 20;
    document.getElementById('player-jump-speed').value = s.jumpSpeed != null ? s.jumpSpeed : 8;
    fpTunablesEl.style.display = '';
    document.getElementById('player-fp-fov').value = s.fovDegrees != null ? s.fovDegrees : 70;
    document.getElementById('player-fp-eye-height').value = s.eyeHeight != null ? s.eyeHeight : 0.6;
    document.getElementById('player-fp-sensitivity').value = s.mouseSensitivity != null ? s.mouseSensitivity : 0.0022;
  } else {
    jumpRowEl.style.display = 'none';
    jumpTunablesEl.style.display = 'none';
    fpTunablesEl.style.display = 'none';
  }
  // Wave 6B (Priority J): Footstep audio -- Third-Person/First-Person only,
  // same scoping Crouch/Sprint (Priority B) already established.
  const footstepRowEl = document.getElementById('player-footstep-row');
  if (s.controllerType === 'thirdperson' || s.controllerType === 'firstperson') {
    footstepRowEl.style.display = '';
    const assetSelect = document.getElementById('player-footstep-asset');
    assetSelect.innerHTML = `<option value="">None</option>${audioAssets.map((a) => `<option value="${escapeHtml(a.id)}"${s.footstepAudioAssetId === a.id ? ' selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}`;
    document.getElementById('player-footstep-interval').value = s.footstepInterval ?? 0.4;
    document.getElementById('player-footstep-walk-vol').value = s.footstepWalkVolume ?? 0.5;
    document.getElementById('player-footstep-run-vol').value = s.footstepRunVolume ?? 0.7;
  } else {
    footstepRowEl.style.display = 'none';
  }
  // Wave 6B (Priority A/Section 2): Player Visual only offered for
  // Third-Person/Top-Down -- First-Person keeps its invisible-body
  // convention, per this priority's own explicit scope.
  const visualSectionEl = document.getElementById('player-visual-section');
  if (s.controllerType === 'thirdperson' || s.controllerType === 'topdown' || s.controllerType === 'hovercraft') {
    visualSectionEl.style.display = '';
    renderPlayerVisualPanel();
  } else {
    visualSectionEl.style.display = 'none';
  }
  document.getElementById('player-max-health').value = s.maxHealth != null ? s.maxHealth : 100;
  renderPlayerDamageResistance();
  renderPlayerHurtbox();
  // Weapon (Wave 4) -- a single reusable primitive attached to Player
  // Settings rather than a separate placeable "Weapon" object, per the
  // explicit "do not build an inventory full of weapons, one reusable
  // primitive is enough" scope. Fires via Fire Projectile internally (see
  // fireProjectile()), so the runtime projectile system has exactly one
  // implementation regardless of whether it's the Player, an AI, or a
  // Node Graph that triggered it.
  const weapon = s.weapon || defaultWeaponConfig();
  document.getElementById('player-weapon-enabled').checked = !!weapon.enabled;
  document.getElementById('player-weapon-tunables').style.display = weapon.enabled ? '' : 'none';
  // Wave 7 (Priority C/Section 20): Weapon Source -- 'fixed' (default,
  // every pre-Wave-7 project) keeps the fields below as the real weapon.
  // 'equipment' means those fields describe nothing at runtime; the fields
  // below stay visible (not worth a second parallel form) but are
  // explicitly noted as ignored, and the ACTUAL stats come from whatever
  // Equipment Item's own `weapon` sub-config is currently in Primary Hand
  // (see resolveActivePlayerWeapon).
  document.getElementById('player-weapon-source').value = weapon.source === 'equipment' ? 'equipment' : 'fixed';
  document.getElementById('player-weapon-mode-row').style.opacity = weapon.source === 'equipment' ? '0.45' : '1';
  document.getElementById('player-weapon-prefab-row').style.opacity = weapon.source === 'equipment' ? '0.45' : '1';
  // Weapon Mode (Wave 5, Priority F/section 33) -- Projectile keeps a real
  // travel-time object (needs a Prefab, has a Speed); Hitscan is an
  // instant ray and Melee an instant radius/cone check (neither needs a
  // Prefab or Speed; both reuse the Range field -- ray length for Hitscan,
  // reach for Melee). All three ultimately resolve through the same
  // applyHitDamage -- see fireAttack/fireHitscan/fireMelee.
  const isHitscan = weapon.mode === 'hitscan';
  const isMelee = weapon.mode === 'melee';
  const isPrefabless = isHitscan || isMelee;
  document.getElementById('player-weapon-mode').value = isHitscan ? 'hitscan' : isMelee ? 'melee' : 'projectile';
  document.getElementById('player-weapon-prefab-row').style.display = isPrefabless ? 'none' : '';
  document.getElementById('player-weapon-speed-wrap').style.display = isPrefabless ? 'none' : '';
  document.getElementById('player-weapon-range-wrap').style.display = isPrefabless ? '' : 'none';
  document.getElementById('player-weapon-prefab-wrap').innerHTML = prefabs.length === 0
    ? '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No prefabs saved yet.</p>'
    : renderActionFieldInput({ key: 'prefabName', type: 'prefab' }, weapon.prefabName, 'player-weapon-prefab');
  const prefabSel = document.getElementById('player-weapon-prefab');
  if (prefabSel) prefabSel.onchange = (e) => { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.prefabName = e.target.value; };
  document.getElementById('player-weapon-cooldown').value = weapon.cooldown;
  document.getElementById('player-weapon-damage').value = weapon.damage;
  document.getElementById('player-weapon-damage-type').value = weapon.damageType === undefined ? 'ordinary' : weapon.damageType;
  document.getElementById('player-weapon-speed').value = weapon.speed;
  document.getElementById('player-weapon-range').value = weapon.range != null ? weapon.range : 50;
  document.getElementById('player-weapon-fire-on-event').checked = !!weapon.fireOnAnimationEvent;
  document.getElementById('player-weapon-knockback').value = weapon.knockback || 0;
  document.getElementById('player-weapon-muzzle-socket').value = weapon.muzzleSocket || '';
  // Wave 9 (Priority A): Ammo/Reload/Fire Mode/Spread/Recoil/Noise/
  // Crosshair -- same "always render, exec() reads whichever mode applies"
  // pattern the rest of this panel already uses.
  const ammoState=resolveWeaponDefinitionOwner(weapon),ammo=ammoState.ok?ammoState.config:weapon;
  document.getElementById('player-weapon-ammomode').value = ammo.ammoMode || 'infinite';
  document.getElementById('player-weapon-ammo-fields').style.display = (ammo.ammoMode === 'magazine') ? '' : 'none';
  document.getElementById('player-weapon-magsize').value = ammo.magazineSize != null ? ammo.magazineSize : 30;
  document.getElementById('player-weapon-startmag').value = ammo.startingMagazine != null ? ammo.startingMagazine : (ammo.magazineSize != null ? ammo.magazineSize : 30);
  document.getElementById('player-weapon-reserve').value = ammo.reserveAmmo != null ? ammo.reserveAmmo : 0;
  document.getElementById('player-weapon-reload-duration').value = ammo.reloadDuration != null ? ammo.reloadDuration : 1.5;
  for(const id of ['ammomode','magsize','startmag','reserve','reload-duration','ammo-apply'])document.getElementById('player-weapon-'+id).disabled=playMode||weapon.source==='equipment'||!ammoState.ok;
  document.getElementById('player-weapon-ammo-status').textContent=!ammoState.ok?ammoState.reason:weapon.source==='equipment'?'Equipment ammunition belongs to each item’s Weapon Definition.':weapon.definitionRef?'Apply edits the shared named Weapon Definition, affecting every owner that references it.':'Apply saves this level’s inline fixed weapon settings in one Undo step.';
  document.getElementById('player-weapon-firemode').value = weapon.fireMode === 'auto' ? 'auto' : 'semi';
  document.getElementById('player-weapon-spread').value = weapon.spreadDegrees || 0;
  document.getElementById('player-weapon-recoil-v').value = weapon.recoilVertical || 0;
  document.getElementById('player-weapon-recoil-h').value = weapon.recoilHorizontal || 0;
  document.getElementById('player-weapon-emit-noise').checked = !!weapon.emitNoiseOnFire;
  document.getElementById('player-weapon-noise-radius').value = weapon.noiseRadius != null ? weapon.noiseRadius : 18;
  document.getElementById('player-weapon-crosshair').checked = weapon.crosshair !== false;
  // Wave 9D (Priority B): muzzle/impact effect fields -- same "always
  // render, exec() reads whichever fields apply" pattern this whole panel
  // already established.
  document.getElementById('player-weapon-fire-audio-wrap').innerHTML = renderActionFieldInput({ key: 'fireAudioAssetId', type: 'audioAsset' }, weapon.fireAudioAssetId, 'player-weapon-fire-audio');
  const fireAudioSel = document.getElementById('player-weapon-fire-audio');
  if (fireAudioSel) fireAudioSel.onchange = (e) => { const r=changeInlineWeaponFeedback('fireAudioAssetId',e.target.value);if(!r.ok)showStatus(r.reason); };
  document.getElementById('player-weapon-muzzle-fx').checked = !!weapon.muzzleEffect;
  document.getElementById('player-weapon-muzzle-color').value = weapon.muzzleEffectColor || '#ffcc55';
  document.getElementById('player-weapon-impact-audio-wrap').innerHTML = renderActionFieldInput({ key: 'impactAudioAssetId', type: 'audioAsset' }, weapon.impactAudioAssetId, 'player-weapon-impact-audio');
  const impactAudioSel = document.getElementById('player-weapon-impact-audio');
  if (impactAudioSel) impactAudioSel.onchange = (e) => { const r=changeInlineWeaponFeedback('impactAudioAssetId',e.target.value);if(!r.ok)showStatus(r.reason); };
  document.getElementById('player-weapon-impact-fx').checked = !!weapon.impactEffect;
  document.getElementById('player-weapon-impact-color').value = weapon.impactEffectColor || '#e6e6dd';
  document.getElementById('player-weapon-tracer').checked = !!weapon.tracer;
  renderEquipmentDefList();
  bindPlayerAuthoringControls();
  renderWeaponDefinitionLibrary();
  renderProjectileWeaponBuilder();
  renderHitscanWeaponBuilder();
  renderMeleeWeaponBuilder();
  setWeaponDefinitionTuningEditable();
}
// Wave 7 (Priority C/Section 18): Equipment Items editor -- a real list-row
// UI over `currentPlayerSettings.equipmentDefs`, the same "build the DOM in
// JS, wire handlers after" pattern the Socket Editor/Animation Events list
// already established. Each row: Item Name (must match an Inventory item
// name to actually be equippable), Slot, visual Asset, Socket name (a plain
// text field -- the socket itself is authored on the PLAYER VISUAL's own
// asset, via that asset's ordinary Socket Editor, Priority A), and an
// optional Weapon sub-config (Mode/Damage/Range/Speed/Prefab) gated behind
// a checkbox so a purely-cosmetic equip (a flashlight, a badge) doesn't
// need to fill in irrelevant weapon fields.
function equipmentSlotOptions(current) {
  return (!['primaryHand','secondaryHand','body'].includes(current)&&current!=null?`<option selected disabled value="${escapeHtml(String(current))}">Custom slot: ${escapeHtml(String(current))}</option>`:'')+['primaryHand', 'secondaryHand', 'body'].map((s) => `<option value="${s}"${current === s ? ' selected' : ''}>${s==='primaryHand'?'Primary hand':s==='secondaryHand'?'Secondary hand':'Body'}</option>`).join('');
}
function equipmentNamedItem(id) {
  if (typeof id !== 'string' || !id || ['__proto__', 'constructor', 'prototype'].includes(id)) return null;
  const matches = currentItemDefs.filter(def => def?.id === id);
  return matches.length === 1 ? matches[0] : null;
}
function selectEquipmentNamedItem(index, id) {
  const definition = equipmentNamedItem(id);
  return !!definition && changeEquipmentDefField(index, 'itemName', definition.id);
}
function applyEquipmentSuggestedSlot(index) {
  const definition = equipmentNamedItem(currentPlayerSettings.equipmentDefs?.[index]?.itemName);
  return !!definition && changeEquipmentDefField(index, 'customSlot', definition.equipSlot);
}
function equipmentSocketChoices() {
  const matches = assets.filter(asset => asset.id === currentPlayerSettings.visual?.assetId);
  const asset = matches.length === 1 ? matches[0] : null;
  if (asset?.type !== 'skinnedMesh' || !Array.isArray(asset.sockets) || !Array.isArray(asset.skin?.jointNames)) return [];
  return asset.sockets.filter(socket => socket && typeof socket.name === 'string' && socket.name.trim() && asset.skin.jointNames.filter(name=>name===socket.jointName).length===1 && asset.sockets.filter(other => other?.name === socket.name).length === 1);
}
function selectEquipmentSocket(index, name) {
  if (typeof name !== 'string' || name !== '' && !equipmentSocketChoices().some(socket => socket.name === name)) return false;
  return changeEquipmentDefField(index, 'socketName', name);
}
function equipmentDefAuthoringValue(def,key) {
  if(key==='customSlot')return def.slot??'';
  if(key==='weapon')return !!def.weapon;
  if(key==='assetId')return def.assetId==null||def.assetId===''?null:def.assetId;
  const defaults={scale:1,'weapon.mode':'projectile','weapon.damage':10,'weapon.range':20};
  if(key.startsWith('firstPersonOffset.')){const axis=key.split('.')[1];return def.firstPersonOffset===undefined?({x:.25,y:-.22,z:.55}[axis]):(def.firstPersonOffset?.[axis]??(axis==='z'?.55:0));}
  if(key.startsWith('firstPersonRotation.'))return def.firstPersonRotation?.[key.split('.')[1]]??0;
  const parts=key.split('.');return (parts.length===2?def[parts[0]]?.[parts[1]]:def[key])??defaults[key]??'';
}
function changeEquipmentDefField(index,key,value,onBeforeChange) {
  if(playMode||!Array.isArray(currentPlayerSettings.equipmentDefs)||!Number.isInteger(index))return false;
  const def=currentPlayerSettings.equipmentDefs[index];if(!def||typeof def!=='object'||Array.isArray(def))return false;
  if(key==='customSlot'){if(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)||['__proto__','constructor','prototype'].includes(value))return false;key='slot';}
  else if(key==='itemName'||key==='socketName'){if(typeof value!=='string')return false;}
  else if(key==='slot'){if(!['primaryHand','secondaryHand','body'].includes(value))return false;}
  else if(key==='assetId'){if(value!==null&&!assets.some(a=>a.id===value&&(a.type==='mesh'||a.type==='skinnedMesh')))return false;}
  else if(key==='weapon'){if(typeof value!=='boolean'||def.weapon!==undefined&&def.weapon!==null&&(!def.weapon||typeof def.weapon!=='object'||Array.isArray(def.weapon)))return false;}
  else if(key==='weapon.mode'){if(!['projectile','hitscan','melee'].includes(value))return false;}
  else {if(!['scale','weapon.damage','weapon.range','firstPersonOffset.x','firstPersonOffset.y','firstPersonOffset.z','firstPersonRotation.x','firstPersonRotation.y','firstPersonRotation.z'].includes(key)||typeof value!=='number'||!Number.isFinite(value))return false;if((key==='scale'||key==='weapon.range')&&value<=0||key==='weapon.damage'&&value<0)return false;}
  const parts=key.split('.');if(parts.length===2){const container=def[parts[0]];if(container!==undefined&&(!container||typeof container!=='object'||Array.isArray(container)))return false;if(parts[0]==='weapon'&&!container)return false;}
  if(equipmentDefAuthoringValue(def,key)===value)return false;
  const next=JSON.parse(JSON.stringify(def));
  if(key==='weapon'){if(value)next.weapon={mode:'hitscan',damage:10,range:20};else delete next.weapon;}
  else if(parts.length===2){const base=parts[0]==='firstPersonOffset'?{x:equipmentDefAuthoringValue(def,'firstPersonOffset.x'),y:equipmentDefAuthoringValue(def,'firstPersonOffset.y'),z:equipmentDefAuthoringValue(def,'firstPersonOffset.z')}:parts[0]==='firstPersonRotation'?{x:0,y:0,z:0}:{};next[parts[0]]={...base,...next[parts[0]],[parts[1]]:value};}
  else next[key]=value;
  if(typeof onBeforeChange==='function')onBeforeChange();else pushUndo();
  const defs=currentPlayerSettings.equipmentDefs.slice();defs[index]=next;currentPlayerSettings={...currentPlayerSettings,equipmentDefs:defs};return true;
}
function equipmentAuthoringStatus(changed) {const status=document.getElementById('equipment-authoring-status');if(status)status.textContent=changed?'Equipment setting updated. Undo restores the previous gesture.':'Equipment unchanged. Stop Play to edit; use finite values, positive scale/range and nonnegative damage. Blank numbers do not replace saved values.';}
function addEquipmentDef() {if(playMode||currentPlayerSettings.equipmentDefs!==undefined&&!Array.isArray(currentPlayerSettings.equipmentDefs))return false;pushUndo();currentPlayerSettings={...currentPlayerSettings,equipmentDefs:[...(currentPlayerSettings.equipmentDefs||[]),{itemName:'',slot:'primaryHand',assetId:null,socketName:''}]};renderEquipmentDefList();return true;}
function removeEquipmentDef(index) {if(playMode||!Array.isArray(currentPlayerSettings.equipmentDefs)||!Number.isInteger(index)||index<0||index>=currentPlayerSettings.equipmentDefs.length)return false;pushUndo();currentPlayerSettings={...currentPlayerSettings,equipmentDefs:currentPlayerSettings.equipmentDefs.filter((_,i)=>i!==index)};renderEquipmentDefList();return true;}
function bindEquipmentDefAuthoringControls(listEl) {
  listEl.querySelectorAll('[data-equipment-socket]').forEach(input=>{const index=Number(input.dataset.equipmentSocket),owner=currentPlayerSettings.equipmentDefs?.[index];input.disabled=playMode;input.onchange=()=>{const changed=currentPlayerSettings.equipmentDefs?.[index]===owner&&selectEquipmentSocket(index,input.value);equipmentAuthoringStatus(changed);renderEquipmentDefList();};});
  listEl.querySelectorAll('[data-equipment-item]').forEach(input=>{const index=Number(input.dataset.equipmentItem),owner=currentPlayerSettings.equipmentDefs?.[index];input.disabled=playMode;input.onchange=()=>{const changed=currentPlayerSettings.equipmentDefs?.[index]===owner&&selectEquipmentNamedItem(index,input.value);equipmentAuthoringStatus(changed);renderEquipmentDefList();};});
  listEl.querySelectorAll('[data-equipment-item-slot]').forEach(button=>{const index=Number(button.dataset.equipmentItemSlot),owner=currentPlayerSettings.equipmentDefs?.[index];button.disabled=playMode||!equipmentNamedItem(owner?.itemName)?.equipSlot;button.onclick=()=>{const changed=currentPlayerSettings.equipmentDefs?.[index]===owner&&applyEquipmentSuggestedSlot(index);equipmentAuthoringStatus(changed);renderEquipmentDefList();};});
  listEl.querySelectorAll('[data-equipment-field]').forEach(input=>{
    const index=Number(input.dataset.equipmentIndex),key=input.dataset.equipmentField;input.disabled=playMode;let recorded=false;input.onfocus=()=>{recorded=false;};
    const handler=()=>{let value=input.type==='checkbox'?input.checked:input.value;if(input.type==='number'){value=input.value.trim()?Number(input.value):NaN;if(key.startsWith('firstPersonRotation.')&&Number.isFinite(value)){const current=equipmentDefAuthoringValue(currentPlayerSettings.equipmentDefs?.[index]||{},key);value=value===cameraPitchDegrees(current)||value===current*180/Math.PI?current:value*Math.PI/180;}}else if(key==='assetId')value=value||null;
const changed=changeEquipmentDefField(index,key,value,()=>{if(!recorded||input.type!=='number'&&input.type!=='text'){pushUndo();recorded=true;}});equipmentAuthoringStatus(changed);if(changed&&['weapon','slot','assetId'].includes(key))renderEquipmentDefList();};
    if(input.type==='number'||input.type==='text')input.oninput=handler;else input.onchange=handler;
    input.onblur=()=>{const def=currentPlayerSettings.equipmentDefs?.[index];if(!def)return;let value=equipmentDefAuthoringValue(def,key);if(key.startsWith('firstPersonRotation.'))value=cameraPitchDegrees(value);if(input.type!=='checkbox')input.value=String(value??'');renderEquipmentDefList();};
  });
  listEl.querySelectorAll('[data-eqdef-remove]').forEach(btn=>{btn.disabled=playMode;btn.onclick=()=>removeEquipmentDef(Number(btn.dataset.eqdefRemove));});
  const add=document.getElementById('equipment-def-add-btn');if(add){add.disabled=playMode||currentPlayerSettings.equipmentDefs!==undefined&&!Array.isArray(currentPlayerSettings.equipmentDefs);add.onclick=addEquipmentDef;}
}
function renderEquipmentDefList() {
  const listEl = document.getElementById('equipment-def-list');
  if (!listEl) return;
  const defs = Array.isArray(currentPlayerSettings.equipmentDefs)?currentPlayerSettings.equipmentDefs:[];
  if(currentPlayerSettings.equipmentDefs!==undefined&&!Array.isArray(currentPlayerSettings.equipmentDefs)){listEl.innerHTML='<p>Equipment data is unavailable; retained for recovery. Save or export the project before repairing it.</p>';bindEquipmentDefAuthoringControls(listEl);return;}
  const skinnedAssets = assets.filter((a) => a.type === 'skinnedMesh' || a.type === 'mesh');
  if (defs.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No equipment items yet -- add one below.</p>';
  } else {
    listEl.innerHTML = defs.map((d, i) => {if(!d||typeof d!=='object'||Array.isArray(d))return `<div class="hud-element-row">Unavailable equipment record ${i+1}; retained for recovery.</div>`;const field=(key)=>`data-equipment-field="${key}" data-equipment-index="${i}"`;return `
      <div class="hud-element-row" data-eqdef-index="${i}">
        <div class="hud-element-row-header">
          <span>${escapeHtml(d.itemName || '(unnamed)')} -> ${escapeHtml(d.slot)}</span>
          <button class="hud-remove-btn" data-eqdef-remove="${i}" title="Delete">✕</button>
        </div>
        <label style="display:block;margin:6px 0">Project Item<select class="field-input" data-equipment-item="${i}" aria-label="Equipment Project Item"><option value=""${!equipmentNamedItem(d.itemName)?' selected':''}>${d.itemName?'Retained legacy name or unavailable Item — choose replacement':'Choose named Item (or enter a legacy name below)'}</option>${currentItemDefs.filter(item=>equipmentNamedItem(item?.id)===item).map(item=>`<option value="${escapeHtml(item.id)}"${d.itemName===item.id?' selected':''}>${escapeHtml(item.name||'Unnamed Item')}</option>`).join('')}</select></label>
        <button type="button" class="field-input" data-equipment-item-slot="${i}">Use Item's suggested slot</button>
        <div class="field-triple">
          <input class="field-input" type="text" ${field('itemName')} data-eqdef-name="${i}" value="${escapeHtml(d.itemName || '')}" placeholder="Legacy inventory name / retained key" aria-label="Inventory item name">
          <select class="field-input" ${field('slot')} data-eqdef-slot="${i}" aria-label="Equipment slot">${equipmentSlotOptions(d.slot)}</select>
          <select class="field-input" ${field('assetId')} data-eqdef-asset="${i}" aria-label="Equipment visual asset"><option value="">(no visual)</option>${d.assetId&&!skinnedAssets.some(a=>a.id===d.assetId)?`<option selected disabled value="${escapeHtml(String(d.assetId))}">Unavailable asset: ${escapeHtml(String(d.assetId))}</option>`:''}${skinnedAssets.map((a) => `<option value="${escapeHtml(String(a.id))}"${d.assetId === a.id ? ' selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select>
        </div>
        <label style="display:block;margin-top:6px">Custom slot<input class="field-input" type="text" ${field('customSlot')} value="${escapeHtml(String(d.slot??''))}" placeholder="e.g. utility" aria-label="Custom equipment slot"></label>
        <p class="field-help">Named selection uses the Item's stable identity. Legacy names remain supported. Suggested slot applies only when you click; changing a slot does not consume inventory or rewrite weapon tuning.</p>
        ${d.itemName&&defs.filter(other=>other?.itemName===d.itemName).length>1?'<p class="field-help">Multiple equipment rows use this inventory key. Historical Equip chooses the first mapping; use distinct Items for independent mappings.</p>':''}
        <label style="display:block;margin-top:6px">Player Visual socket<select class="field-input" data-equipment-socket="${i}" aria-label="Equipment Player Visual socket"><option value=""${!d.socketName?' selected':''}>(no body socket)</option>${d.socketName&&!equipmentSocketChoices().some(socket=>socket.name===d.socketName)?`<option selected disabled value="${escapeHtml(String(d.socketName))}">Retained unavailable or ambiguous socket: ${escapeHtml(String(d.socketName))}</option>`:''}${equipmentSocketChoices().map(socket=>`<option value="${escapeHtml(socket.name)}"${d.socketName===socket.name?' selected':''}>${escapeHtml(socket.name)} — ${escapeHtml(socket.jointName)}</option>`).join('')}</select></label>
        <p class="field-help">${currentPlayerSettings.controllerType==='firstperson'?'First person uses camera-local placement below; body sockets are retained but not used.':'Sockets belong to the selected Player Visual character, not this equipment mesh. Choose a skinned Player Visual with authored sockets. Author sockets on a placed copy of that character in its Inspector; the shared asset updates all copies.'} Missing or ambiguous saved names are retained, never silently replaced.</p>
        <div class="field-triple" style="margin-top:4px">
          <input class="field-input" type="text" ${field('socketName')} data-eqdef-socket="${i}" value="${escapeHtml(d.socketName || '')}" placeholder="Body socket (not used in first person)" aria-label="Body socket name">
          <input class="field-input" type="number" ${field('scale')} data-eqdef-scale="${i}" value="${escapeHtml(String(equipmentDefAuthoringValue(d,'scale')))}" min="0.000001" step="0.05" title="Visual scale (positive)" aria-label="Visual scale">
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#c7d3ea"><input type="checkbox" ${field('weapon')} data-eqdef-hasweapon="${i}"${d.weapon ? ' checked' : ''}> Weapon</label>
        </div>
        ${d.weapon ? `
        <label style="display:block;margin-top:8px">Weapon Definition<select class="field-input" data-eqdef-definition="${i}" aria-label="Equipment Weapon Definition">${weaponDefinitionOptions(d.weapon.definitionRef)}</select></label>
        <div class="field-triple" style="margin-top:4px">
          <select class="field-input" ${field('weapon.mode')} data-eqdef-wmode="${i}" aria-label="Weapon mode">
            ${d.weapon.mode&&!['projectile','hitscan','melee'].includes(d.weapon.mode)?`<option selected disabled value="${escapeHtml(String(d.weapon.mode))}">Unavailable mode: ${escapeHtml(String(d.weapon.mode))}</option>`:''}
            <option value="projectile"${d.weapon.mode === 'projectile' || !d.weapon.mode ? ' selected' : ''}>Projectile</option>
            <option value="hitscan"${d.weapon.mode === 'hitscan' ? ' selected' : ''}>Hitscan</option>
            <option value="melee"${d.weapon.mode === 'melee' ? ' selected' : ''}>Melee</option>
          </select>
          <input class="field-input" type="number" ${field('weapon.damage')} data-eqdef-wdamage="${i}" value="${escapeHtml(String(d.weapon.damage != null ? d.weapon.damage : 10))}" min="0" placeholder="Damage" aria-label="Weapon damage">
          <input class="field-input" type="number" ${field('weapon.range')} data-eqdef-wrange="${i}" value="${escapeHtml(String(d.weapon.range != null ? d.weapon.range : 20))}" min="0.000001" placeholder="Range" aria-label="Weapon range">
        </div>` : ''}
        <details data-eqdef-placement="${i}" style="margin-top:6px"><summary>First-person visual placement</summary><p style="font-size:10.5px;color:#8d9ab7">Camera-local offset: X right, Y up, Z forward. Rotation is in degrees, relative to the Player facing. Socket is not used in first person.</p>
          <div class="field-triple">${['x','y','z'].map(axis=>`<label>Offset ${axis.toUpperCase()}<input class="field-input" type="number" ${field('firstPersonOffset.'+axis)} data-eqdef-offset-${axis}="${i}" step="0.01" value="${escapeHtml(String(equipmentDefAuthoringValue(d,'firstPersonOffset.'+axis)))}"></label>`).join('')}</div>
          <div class="field-triple">${['x','y','z'].map(axis=>`<label>Rotate ${axis.toUpperCase()} (°)<input class="field-input" type="number" ${field('firstPersonRotation.'+axis)} data-eqdef-rotation-${axis}="${i}" step="1" value="${escapeHtml(String(cameraPitchDegrees(equipmentDefAuthoringValue(d,'firstPersonRotation.'+axis))))}"></label>`).join('')}</div>
        </details>
      </div>`;}).join('');
  }
  bindEquipmentDefAuthoringControls(listEl);
  listEl.querySelectorAll('[data-eqdef-definition]').forEach(input=>{
    const i=Number(input.dataset.eqdefDefinition),owner=defs[i]?.weapon;input.disabled=playMode;
    input.onchange=()=>{const r=bindWeaponDefinition(currentPlayerSettings.equipmentDefs?.[i]?.weapon,input.value);renderPlayerSettingsPanel();const status=document.getElementById('weapon-definition-status');if(status)status.textContent=r.ok?'Equipment reference saved; inline tuning retained.':r.reason;};
    if(owner?.definitionRef)listEl.querySelectorAll('[data-equipment-index="'+i+'"][data-equipment-field^="weapon."]').forEach(field=>{field.disabled=true;field.title='Edit named definition tuning, or clear its reference.';});
  });
}
// `mode: 'projectile'` is the default -- every project saved before Wave 5
// has no `mode` field at all, and reads it as `undefined`, which every
// `weapon.mode === 'hitscan'` check below treats as "not hitscan," i.e.
// projectile, its only possible behavior before this field existed.
function changePlayerDamageResistance(key,value) {
  if(playMode)return {ok:false,reason:'Stop Play to edit Player resistance.'};
  const previous=currentPlayerSettings.damageResistance;
  if(key==='add'){
    if(previous!==undefined)return {ok:false,reason:'An existing profile is retained; remove it explicitly before replacing it.'};
    pushUndo();currentPlayerSettings.damageResistance=OpusDamagePolicy.create();return {ok:true};
  }
  if(key==='remove'){
    if(previous===undefined)return {ok:true,unchanged:true};
    pushUndo();delete currentPlayerSettings.damageResistance;return {ok:true};
  }
  const checked=OpusDamagePolicy.inspectProfile(previous);
  if(!checked.ok)return {ok:false,reason:'Unsupported Player resistance is retained. Remove explicitly or use a compatible editor.'};
  if(!['enabled','ordinary','fire','ice'].includes(key))return {ok:false,reason:'Unsupported resistance field.'};
  const next={...checked.profile,[key]:value},valid=OpusDamagePolicy.inspectProfile(next);
  if(!valid.ok)return {ok:false,reason:valid.issues.map(issue=>issue.message).join(' ')};
  if(previous[key]===value)return {ok:true,unchanged:true};
  pushUndo();currentPlayerSettings.damageResistance=next;return {ok:true};
}
function renderPlayerDamageResistance() {
  const host=document.getElementById('player-damage-resistance');if(!host)return;
  const raw=currentPlayerSettings.damageResistance,checked=OpusDamagePolicy.inspectProfile(raw);
  host.innerHTML='<summary>Damage Resistance — optional Player profile</summary><p>0 = immune · 0.5 = half damage · 1 = unchanged · 2 = double. Does not affect healing, Set Health or explicit destruction.</p>';
  const status=document.createElement('p');status.id='player-resistance-status';status.setAttribute('role','status');
  const edit=(key,value)=>{const result=changePlayerDamageResistance(key,value);if(result.ok){renderPlayerDamageResistance();document.getElementById('player-damage-resistance').open=true;}else status.textContent=result.reason;};
  if(raw===undefined){const add=document.createElement('button');add.id='player-resistance-add';add.textContent='Add Player resistance';add.disabled=playMode;add.onclick=()=>edit('add');host.appendChild(add);}
  else{
    if(checked.ok){for(const key of ['enabled','ordinary','fire','ice']){
      const label=document.createElement('label');label.textContent=key==='enabled'?'Resistance Enabled':key[0].toUpperCase()+key.slice(1)+' Damage Multiplier';
      const input=document.createElement('input');input.id='player-resistance-'+key;input.type=key==='enabled'?'checkbox':'number';input.disabled=playMode;
      if(key==='enabled')input.checked=checked.profile.enabled;else{input.value=checked.profile[key];input.min='0';input.step='any';}
      input.onchange=()=>edit(key,key==='enabled'?input.checked:input.value.trim()===''?NaN:Number(input.value));label.appendChild(input);host.appendChild(label);
    }}else status.textContent=checked.issues.map(issue=>issue.message).join(' ')+' Saved profile retained; no replacement defaults applied.';
    const remove=document.createElement('button');remove.id='player-resistance-remove';remove.textContent='Remove Player resistance';remove.disabled=playMode;remove.onclick=()=>edit('remove');host.appendChild(remove);
  }
  host.appendChild(status);
}
function changePlayerHurtbox(key,value) {
  if(playMode)return {ok:false,reason:'Stop Play to edit Player Hurtbox.'};
  const raw=currentPlayerSettings.hurtbox;
  if(key==='add'){
    if(raw!==undefined)return {ok:false,reason:'Existing Hurtbox retained. Remove explicitly before replacing.'};
    pushUndo();currentPlayerSettings.hurtbox=OpusCombatVolumes.create();return {ok:true};
  }
  if(key==='remove'){if(raw===undefined)return {ok:true,unchanged:true};pushUndo();delete currentPlayerSettings.hurtbox;return {ok:true};}
  const checked=OpusCombatVolumes.inspect(raw);
  if(!checked.ok)return {ok:false,reason:checked.reason};
  if(!['enabled','radius','offsetX','offsetY','offsetZ'].includes(key))return {ok:false,reason:'Unsupported Hurtbox field.'};
  const next={...checked.record,[key]:value},valid=OpusCombatVolumes.inspect(next);
  if(!valid.ok)return {ok:false,reason:valid.reason};
  if(raw[key]===value)return {ok:true,unchanged:true};
  pushUndo();currentPlayerSettings.hurtbox=next;return {ok:true};
}
function renderPlayerHurtbox() {
  const host=document.getElementById('player-hurtbox');if(!host)return;
  const raw=currentPlayerSettings.hurtbox,checked=OpusCombatVolumes.inspect(raw);
  host.innerHTML='<summary>Hurtbox — optional Player combat sphere</summary><p>Incoming combat only; never changes movement or wall collision. Missing uses the historical controller radius. Disabled means no incoming combat hit. Positive radius and world X/Y/Z offsets ignore mesh scale and rotation.</p>';
  const status=document.createElement('p');status.id='player-hurtbox-status';status.setAttribute('role','status');
  const edit=(key,value)=>{const result=changePlayerHurtbox(key,value);if(result.ok){renderPlayerHurtbox();host.open=true;}else status.textContent=result.reason;};
  if(raw===undefined){const button=document.createElement('button');button.id='player-hurtbox-add';button.textContent='Add Player Hurtbox';button.disabled=playMode;button.onclick=()=>edit('add');host.appendChild(button);}
  else {
    if(checked.ok)for(const key of ['enabled','radius','offsetX','offsetY','offsetZ']){
      const label=document.createElement('label');label.textContent=key==='enabled'?'Combat Hits Enabled':key==='radius'?'Combat Radius':'World Offset '+key.slice(-1);
      const input=document.createElement('input');input.id='player-hurtbox-'+key;input.type=key==='enabled'?'checkbox':'number';input.disabled=playMode;
      if(key==='enabled')input.checked=checked.record.enabled;else{input.value=checked.record[key];input.step='any';if(key==='radius')input.min='0.000001';}
      input.onchange=()=>edit(key,key==='enabled'?input.checked:input.value.trim()===''?NaN:Number(input.value));label.appendChild(input);host.appendChild(label);
    }else status.textContent=checked.reason+' Saved record retained; remove explicitly to repair.';
    const button=document.createElement('button');button.id='player-hurtbox-remove';button.textContent='Remove Player Hurtbox';button.disabled=playMode;button.onclick=()=>edit('remove');host.appendChild(button);
  }
  host.appendChild(status);
}
function defaultWeaponConfig() { return { enabled: false, prefabName: '', cooldown: 0.4, damage: 10, speed: 18, mode: 'projectile', range: 50 }; }
function playerCameraAuthoringValue(key) {
  if (currentPlayerSettings[key] != null) return currentPlayerSettings[key];
  return { fovDegrees:70, eyeHeight:0.6, initialYaw:0, initialPitch:currentPlayerSettings.controllerType==='thirdperson'?0.28:0 }[key];
}
function changePlayerCameraAuthoringField(key,value,onBeforeChange) {
  if(playMode||!['fovDegrees','eyeHeight','initialYaw','initialPitch'].includes(key)||typeof value!=='number'||!Number.isFinite(value))return false;
  if(key==='fovDegrees'&&(value<30||value>120)||key==='eyeHeight'&&value<0||key==='initialPitch'&&Math.abs(value)>85*Math.PI/180)return false;
  if(playerCameraAuthoringValue(key)===value)return false;
  if(typeof onBeforeChange==='function')onBeforeChange();else pushUndo();
  currentPlayerSettings[key]=value;return true;
}
function applyFirstPersonCameraDefaults() {
  if(playMode)return false;const settings={controllerType:'firstperson',fovDegrees:70,eyeHeight:0.6,initialYaw:0,initialPitch:0};
  if(Object.entries(settings).every(([key,value])=>key==='controllerType'?currentPlayerSettings[key]===value:playerCameraAuthoringValue(key)===value))return false;
  pushUndo();Object.assign(currentPlayerSettings,settings);renderPlayerSettingsPanel();renderInputActionPanel();return true;
}
function usePlayerViewAtStart() {
  if(playMode||!placed.some(item=>item.kind==='camera'&&item.isActiveCamera))return false;
  pushUndo();for(const item of placed)if(item.kind==='camera')item.isActiveCamera=false;
  renderInspector();showStatus('Player view selected at level start. Start and Change Camera Actions may still choose a shot.');return true;
}
function bindPlayerCameraAuthoringControls() {
  const fields={'player-fp-fov':'fovDegrees','player-fp-eye-height':'eyeHeight','player-initial-yaw':'initialYaw','player-initial-pitch':'initialPitch'};
  for(const [id,key]of Object.entries(fields)){const input=document.getElementById(id);if(!input)continue;input.disabled=playMode;let recorded=false;const angular=key==='initialYaw'||key==='initialPitch';input.onfocus=()=>{recorded=false;};input.oninput=()=>{const value=input.value.trim()?Number(input.value):NaN,current=playerCameraAuthoringValue(key);const canonical=angular?((value===cameraPitchDegrees(current)||value===current*180/Math.PI)?current:value*Math.PI/180):value;changePlayerCameraAuthoringField(key,canonical,()=>{if(!recorded){pushUndo();recorded=true;}});};input.onblur=()=>{const value=playerCameraAuthoringValue(key);input.value=String(angular?cameraPitchDegrees(value):value);};}
  const button=document.getElementById('player-first-person-camera-defaults');if(button){button.disabled=playMode;button.onclick=applyFirstPersonCameraDefaults;}
  const playerView=document.getElementById('player-view-at-start');if(playerView){playerView.disabled=playMode||['platformer2d','topdown2d'].includes(currentPlayerSettings.controllerType);playerView.onclick=usePlayerViewAtStart;}
}
bindPlayerCameraAuthoringControls();
document.getElementById('player-controller-type').onchange = (e) => {
  changePlayerControllerType(e.target.value);
  e.target.value=currentPlayerSettings.controllerType;
};
document.getElementById('player-visual-mode').onchange = (e) => {
  if(changePlayerAuthoringField('visual.mode',e.target.value))renderPlayerVisualPanel();
};
document.getElementById('player-move-speed').oninput = (e) => {
  changePlayerAuthoringField('moveSpeed',e.target.value.trim()?Number(e.target.value):NaN);
};
document.getElementById('player-body-height').onchange = (e) => {
  changePlayerAuthoringField('collisionHeight',e.target.value.trim()?Number(e.target.value):null);
};
document.getElementById('player-body-fit').onclick = applyPlayerBodyFit;
document.getElementById('player-acceleration').oninput = (e) => {
  changePlayerAuthoringField('acceleration',e.target.value.trim()?Number(e.target.value):NaN);
};
document.getElementById('player-max-health').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (!Number.isNaN(v) && v > 0) currentPlayerSettings.maxHealth = v;
};
document.getElementById('player-jump-enabled').onchange = (e) => {
  if(changePlayerAuthoringField('jumpEnabled',e.target.checked))renderPlayerSettingsPanel();
};
document.getElementById('player-gravity').oninput = (e) => {
  changePlayerAuthoringField('gravity',e.target.value.trim()?Number(e.target.value):NaN);
};
document.getElementById('player-jump-speed').oninput = (e) => {
  changePlayerAuthoringField('jumpSpeed',e.target.value.trim()?Number(e.target.value):NaN);
};
document.getElementById('player-fp-sensitivity').oninput = (e) => {
  if (playMode || !e.target.value.trim()) return;
  const v = Number(e.target.value);
  if (!Number.isFinite(v) || v <= 0 || v > 0.1 || currentPlayerSettings.mouseSensitivity === v) return;
  pushUndo(); currentPlayerSettings.mouseSensitivity = v;
};
function setAuthoredGamepadTuning(deadZone, lookRate) {
  if (playMode) return false;
  const previous = OpusInputTuning.inspect(currentPlayerSettings.gamepadTuning);
  if (!previous.ok) return false;
  const next = OpusInputTuning.inspect({...previous.record, deadZone, lookRate});
  if (!next.ok || JSON.stringify(previous.record) === JSON.stringify(next.record)) return false;
  pushUndo(); currentPlayerSettings.gamepadTuning = next.record;
  gamepadTuningRuntime = null; renderLookPreferences(); return true;
}
function renderGamepadTuningEditor() {
  const state = OpusInputTuning.inspect(currentPlayerSettings.gamepadTuning);
  document.getElementById('player-gamepad-deadzone').value = state.ok ? state.record.deadZone : '';
  document.getElementById('player-gamepad-look-rate').value = state.ok ? state.record.lookRate : '';
  for (const id of ['player-gamepad-deadzone','player-gamepad-look-rate','player-gamepad-save','player-gamepad-reset']) document.getElementById(id).disabled = !state.ok;
  document.getElementById('player-gamepad-status').textContent = state.ok ? 'Independent-axis threshold;0 allows small input,1 suppresses axes. Buttons are unaffected. Look rate is radians/second; mouse uses pixels.' : state.reason;
}
document.getElementById('player-gamepad-save').onclick = () => {
  const zone = document.getElementById('player-gamepad-deadzone').value;
  const rate = document.getElementById('player-gamepad-look-rate').value;
  if (zone.trim() && rate.trim()) setAuthoredGamepadTuning(Number(zone), Number(rate));
  renderGamepadTuningEditor();
};
document.getElementById('player-gamepad-reset').onclick = () => {
  if (playMode || !Object.prototype.hasOwnProperty.call(currentPlayerSettings,'gamepadTuning') || !OpusInputTuning.inspect(currentPlayerSettings.gamepadTuning).ok) return;
  pushUndo(); delete currentPlayerSettings.gamepadTuning; gamepadTuningRuntime = null;
  renderGamepadTuningEditor(); renderLookPreferences();
};
document.getElementById('player-footstep-asset').onchange = (e) => { currentPlayerSettings.footstepAudioAssetId = e.target.value || null; };
document.getElementById('player-footstep-interval').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (!Number.isNaN(v) && v > 0) currentPlayerSettings.footstepInterval = v;
};
document.getElementById('player-footstep-walk-vol').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (!Number.isNaN(v) && v >= 0 && v <= 1) currentPlayerSettings.footstepWalkVolume = v;
};
document.getElementById('player-footstep-run-vol').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (!Number.isNaN(v) && v >= 0 && v <= 1) currentPlayerSettings.footstepRunVolume = v;
};
document.getElementById('player-weapon-enabled').onchange = (e) => {
  currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig();
  currentPlayerSettings.weapon.enabled = e.target.checked;
  renderPlayerSettingsPanel();
};
document.getElementById('player-weapon-cooldown').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (v > 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.cooldown = v; }
};
document.getElementById('player-weapon-damage').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (v >= 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.damage = v; }
};
document.getElementById('player-weapon-damage-type').onchange = (e) => {
  if(playMode || !['ordinary','fire','ice'].includes(e.target.value))return;
  const weapon=currentPlayerSettings.weapon||defaultWeaponConfig();
  if((weapon.damageType===undefined?'ordinary':weapon.damageType)===e.target.value)return;
  pushUndo();currentPlayerSettings.weapon=weapon;weapon.damageType=e.target.value;renderPlayerSettingsPanel();
};
document.getElementById('player-weapon-speed').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (v > 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.speed = v; }
};
document.getElementById('player-weapon-mode').onchange = (e) => {
  currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig();
  currentPlayerSettings.weapon.mode = e.target.value;
  renderPlayerSettingsPanel();
};
document.getElementById('player-weapon-range').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (v > 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.range = v; }
};
document.getElementById('player-weapon-fire-on-event').onchange = (e) => {
  currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig();
  currentPlayerSettings.weapon.fireOnAnimationEvent = e.target.checked;
};
document.getElementById('player-weapon-knockback').oninput = (e) => {
  const v = parseFloat(e.target.value);
  if (v >= 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.knockback = v; }
};
document.getElementById('player-weapon-muzzle-socket').oninput = (e) => {
  currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig();
  currentPlayerSettings.weapon.muzzleSocket = e.target.value || undefined;
};
document.getElementById('player-weapon-source').onchange = (e) => {
  currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig();
  currentPlayerSettings.weapon.source = e.target.value;
  renderPlayerSettingsPanel();
};
// Wave 9 (Priority A) -- Ammo/Reload/Fire Mode/Spread/Recoil/Noise/Crosshair wiring.
document.getElementById('player-weapon-ammomode').onchange = (e) => {
  document.getElementById('player-weapon-ammo-fields').style.display=e.target.value==='magazine'?'':'none';
};
document.getElementById('player-weapon-ammo-apply').onclick = () => {
  const number=id=>{const text=document.getElementById('player-weapon-'+id).value.trim();return text?Number(text):NaN;};
  const result=applyPlayerAmmoSettings({ammoMode:document.getElementById('player-weapon-ammomode').value,magazineSize:number('magsize'),startingMagazine:number('startmag'),reserveAmmo:number('reserve'),reloadDuration:number('reload-duration')});
  if(result.ok){renderPlayerSettingsPanel();document.getElementById('player-weapon-ammo-status').textContent='Ammunition saved. Undo restores the previous tuning. Play and use Reload; counts start from the saved values.';}
  else document.getElementById('player-weapon-ammo-status').textContent=result.reason;
};
document.getElementById('player-weapon-firemode').onchange = (e) => { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.fireMode = e.target.value; };
document.getElementById('player-weapon-spread').oninput = (e) => { const v = parseFloat(e.target.value); if (v >= 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.spreadDegrees = v; } };
document.getElementById('player-weapon-recoil-v').oninput = (e) => { const v = parseFloat(e.target.value); if (v >= 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.recoilVertical = v; } };
document.getElementById('player-weapon-recoil-h').oninput = (e) => { const v = parseFloat(e.target.value); if (v >= 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.recoilHorizontal = v; } };
document.getElementById('player-weapon-emit-noise').onchange = (e) => { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.emitNoiseOnFire = e.target.checked; };
document.getElementById('player-weapon-noise-radius').oninput = (e) => { const v = parseFloat(e.target.value); if (v >= 0) { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.noiseRadius = v; } };
document.getElementById('player-weapon-crosshair').onchange = (e) => { currentPlayerSettings.weapon = currentPlayerSettings.weapon || defaultWeaponConfig(); currentPlayerSettings.weapon.crosshair = e.target.checked; };
document.getElementById('player-weapon-muzzle-fx').onchange = (e) => { const r=changeInlineWeaponFeedback('muzzleEffect',e.target.checked);if(!r.ok)showStatus(r.reason); };
document.getElementById('player-weapon-muzzle-color').onchange = (e) => { const r=changeInlineWeaponFeedback('muzzleEffectColor',e.target.value);if(!r.ok)showStatus(r.reason); };
document.getElementById('player-weapon-impact-fx').onchange = (e) => { const r=changeInlineWeaponFeedback('impactEffect',e.target.checked);if(!r.ok)showStatus(r.reason); };
document.getElementById('player-weapon-impact-color').onchange = (e) => { const r=changeInlineWeaponFeedback('impactEffectColor',e.target.value);if(!r.ok)showStatus(r.reason); };
document.getElementById('player-weapon-tracer').onchange = (e) => { const r=changeInlineWeaponFeedback('tracer',e.target.checked);if(!r.ok)showStatus(r.reason); };

