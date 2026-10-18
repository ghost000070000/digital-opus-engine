// --- Prefabs ---
// A prefab is one cube's serialized record (serializeCubeRecord), persisted
// independently of any one project -- a template built once (a decorated
// hazard, a specific enemy setup) can be reused across scenes, not just
// duplicated within the scene it was built in. Placing one goes through
// instantiateCubeRecord, the exact same reconstruction loadScene uses, so a
// prefab and a Save/Load round trip can never reconstruct an item
// differently from each other.
let prefabs = [];
let componentPresets = []; // Project-local settings library; never hidden global storage.
let uiTemplates = []; // Project-local authoring records; instances remain ordinary level UI.
let cameraTemplates = []; // Authoring-only reusable settings; instances remain ordinary Cameras.
let cinematicTemplates = []; // Packages ordinary records plus a canonical level Sequence.
let controllerTemplates = []; // Project-local tuning, never Player identity or scene geometry.
let aiArchetypes = []; // Authored Brain settings only; applied actors remain ordinary Cubes.
let combatEncounterTemplates = []; // Finite Spawner settings; no parallel gameplay runtime.
let weaponDefinitions = []; // Project-local authored assets; ammunition stays per runtime slot.
let nextWeaponDefinitionId = 1;
function copyWeaponDefinitionLibrary(raw) { return JSON.parse(JSON.stringify(Array.isArray(raw)?raw:[])); }
function captureWeaponDefinition(owner,name) {
  if(playMode)return {ok:false,reason:'Stop Play before editing weapon assets.'};
  if(weaponDefinitions.length>=128)return {ok:false,reason:'The project supports up to 128 Weapon Definitions.'};
  let n=typeof nextWeaponDefinitionId==='undefined'?1:nextWeaponDefinitionId;while(weaponDefinitions.some(r=>r?.id==='weapon-'+n))n++;
  if(!Number.isSafeInteger(n)||n<1||n>=Number.MAX_SAFE_INTEGER)return {ok:false,reason:'Definition identity allocator is unavailable; retained assets were not changed.'};
  const state=OpusWeaponDefinitions.capture(owner,name,'weapon-'+n);
  if(!state.ok)return state;
  if(weaponDefinitions.some(r=>r?.name===state.record.name))return {ok:false,reason:'Choose a distinct definition name.'};
  const issue=weaponDefinitionReferenceIssue(state.record.config);if(issue)return {ok:false,reason:issue};
  pushUndo();weaponDefinitions.push(state.record);nextWeaponDefinitionId=n+1;return state;
}
function updateWeaponDefinition(id,name,config) {
  if(playMode)return {ok:false,reason:'Stop Play before editing weapon assets.'};
  const matches=weaponDefinitions.filter(r=>r?.id===id);
  if(matches.length!==1)return {ok:false,reason:'Choose one available definition.'};
  if(!OpusWeaponDefinitions.inspect(matches[0]).ok)return {ok:false,reason:'Unsupported definition is retained and read-only.'};
  const state=OpusWeaponDefinitions.migrate({kind:'WeaponDefinition',version:config&&Object.prototype.hasOwnProperty.call(config,'damageType')?OpusWeaponDefinitions.VERSION:1,id,name:typeof name==='string'?name.trim():name,config});
  if(!state.ok)return state;
  if(weaponDefinitions.some(r=>r!==matches[0]&&r?.name===state.record.name))return {ok:false,reason:'Choose a distinct definition name.'};
  const issue=weaponDefinitionReferenceIssue(state.record.config);if(issue)return {ok:false,reason:issue};
  if(JSON.stringify(matches[0])===JSON.stringify(state.record))return {ok:false,reason:'No settings changed.'};
  pushUndo();weaponDefinitions[weaponDefinitions.indexOf(matches[0])]=state.record;return state;
}
function bindWeaponDefinition(owner,id) {
  if(playMode||!owner||typeof id!=='string')return {ok:false,reason:'Stop Play and choose a weapon owner.'};
  const candidate={};for(const key of Object.keys(owner)){const d=Object.getOwnPropertyDescriptor(owner,key);if(!d||!Object.prototype.hasOwnProperty.call(d,'value'))return {ok:false,reason:'Weapon owner must contain authored data, not accessors.'};candidate[key]=d.value;}candidate.definitionRef=id;
  const state=id?OpusWeaponDefinitions.resolve(candidate,weaponDefinitions):{ok:true,legacy:true};
  if(!state.ok)return state;
  if(!state.legacy){const issue=weaponDefinitionReferenceIssue(state.config);if(issue)return {ok:false,reason:issue};}
  if((owner.definitionRef||'')===id)return {ok:false,reason:'No reference changed.'};
  pushUndo();if(id)owner.definitionRef=id;else delete owner.definitionRef;return {ok:true};
}
function importWeaponDefinition(text) {
  if(playMode||typeof text!=='string'||text.length>65536||weaponDefinitions.length>=128)return {ok:false,reason:'Stop Play; import one definition smaller than 64 KiB (128 maximum).'};
  let record;try{record=JSON.parse(text);}catch{return {ok:false,reason:'Choose a Weapon Definition JSON file.'};}
  if(!record||typeof record!=='object'||Array.isArray(record))return {ok:false,reason:'Choose an object record.'};
  if(weaponDefinitions.some(r=>JSON.stringify(r)===JSON.stringify(record)||record.id&&r?.id===record.id||record.name&&r?.name===record.name))return {ok:false,reason:'Duplicate definition; existing asset was not overwritten.'};
  // Unsupported versions stay portable, visible and inert, never silently converted.
  pushUndo();weaponDefinitions.push(copyWeaponDefinitionLibrary([record])[0]);return {ok:true,record,retained:!OpusWeaponDefinitions.inspect(record).ok};
}
function removeWeaponDefinition(id) {
  if(playMode)return false;const matches=weaponDefinitions.filter(r=>r?.id===id);
  if(matches.length!==1)return false;
  pushUndo();weaponDefinitions.splice(weaponDefinitions.indexOf(matches[0]),1);return true;
}
function weaponDefinitionOptions(current) {
  const options=['<option value="">Inline settings (no definition)</option>'];
  if(current&&!weaponDefinitions.some(r=>r?.id===current))options.push('<option selected disabled value="'+escapeHtml(String(current))+'">Unavailable definition</option>');
  for(const r of weaponDefinitions){if(typeof r?.id!=='string')continue;const state=OpusWeaponDefinitions.inspect(r);options.push('<option value="'+escapeHtml(r.id)+'"'+(current===r.id?' selected':'')+(!state.ok?' disabled':'')+'>'+escapeHtml(r.name||r.id)+(state.ok?'':' — unsupported')+'</option>');}
  return options.join('');
}
function applyProjectileWeaponBuilder(input) {
  const bad=reason=>({ok:false,reason});
  if(playMode)return bad('Stop Play before constructing a weapon.');
  if(!['firstperson','thirdperson','topdown','hovercraft'].includes(currentPlayerSettings.controllerType))return bad('This builder uses the existing 3D Player projectile path. Choose a 3D controller; 2D aiming is not qualified here.');
  if(!input||typeof input!=='object'||Array.isArray(input))return bad('Choose projectile settings.');
  for(const key of ['name','prefabName','damage','speed','cooldown']){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!Object.prototype.hasOwnProperty.call(d,'value'))return bad('Use authored projectile settings, not accessors.');}
  if(typeof input.name!=='string'||typeof input.prefabName!=='string')return bad('Choose a name and a projectile Prefab.');
  const name=input.name.trim();
  if(!name||name.length>80||weaponDefinitions.some(r=>r?.name===name))return bad('Choose a distinct weapon name of 1–80 characters.');
  if(weaponDefinitions.length>=128)return bad('The project supports up to128 Weapon Definitions.');
  if(!Number.isFinite(input.speed)||input.speed<=0||input.speed>10000)return bad('Projectile speed must be above0 and at most10000 units/second.');
  if(!Number.isFinite(input.damage)||input.damage<0||input.damage>1e9||!Number.isFinite(input.cooldown)||input.cooldown<0||input.cooldown>3600)return bad('Choose finite nonnegative damage and cooldown.');
  let n=nextWeaponDefinitionId;while(weaponDefinitions.some(r=>r?.id==='weapon-'+n))n++;
  if(!Number.isSafeInteger(n)||n<1||n>=Number.MAX_SAFE_INTEGER)return bad('Definition identity allocator is unavailable.');
  const prefabName=input.prefabName||name+' Projectile';
  let starter=null;
  if(input.prefabName){const issue=aiProjectilePrefabIssue(prefabName);if(issue)return bad(issue);}
  else {
    if(prefabs.some(p=>p?.name===prefabName))return bad('Starter Prefab name already exists; choose it explicitly or use another weapon name.');
    // Ordinary portable Cube data, matching the existing Projectile Starter.
    // No hidden scene object or runtime state is needed to instantiate it.
    starter={name:prefabName,record:{kind:'cube',mesh:'cube',position:[0,0,0],scale:[.25,.25,.25],color:[1,.9,.3],rotationY:0,behaviors:[],unlit:true,emissiveColor:[1,.9,.3],emissiveIntensity:1.5}};
  }
  const asset=OpusWeaponDefinitions.capture({mode:'projectile',prefabName,speed:input.speed,damage:input.damage,cooldown:input.cooldown},name,'weapon-'+n);
  if(!asset.ok)return asset;
  const owner=currentPlayerSettings.weapon||defaultWeaponConfig();
  if(!owner||typeof owner!=='object'||Array.isArray(owner))return bad('Repair the current fixed weapon owner before setup.');
  // Validate owner portability before making any library/history mutation.
  const ownerCheck=OpusWeaponDefinitions.capture(owner,'Owner validation','builder-owner');
  if(!ownerCheck.ok)return bad(ownerCheck.reason);
  const nextOwner=JSON.parse(JSON.stringify(owner));
  Object.assign(nextOwner,{enabled:true,source:'fixed',fireOnAnimationEvent:false,definitionRef:asset.record.id});
  pushUndo();
  if(starter)prefabs.push(starter);
  weaponDefinitions.push(asset.record);nextWeaponDefinitionId=n+1;
  currentPlayerSettings.weapon=nextOwner;
  return {ok:true,record:asset.record,prefabName,createdPrefab:!!starter};
}
function renderProjectileWeaponBuilder() {
  const host=document.getElementById('projectile-weapon-builder');if(!host)return;
  host.innerHTML='<summary>Build a projectile weapon</summary><p>Create a named weapon and bind it to this level’s fixed Player weapon. Existing inline tuning, equipment and input mappings are retained. Apply enables direct Attack firing (not animation-event firing); Undo restores the previous setup.</p>'+
    '<label>Weapon name<input id="projectile-builder-name" class="field-input" maxlength="80" placeholder="e.g. Scout launcher"></label>'+
    '<label>Projectile visual<select id="projectile-builder-prefab" class="field-input"><option value="">Create a small yellow Cube Prefab</option>'+prefabs.filter(p=>!aiProjectilePrefabIssue(p.name)).map(p=>'<option value="'+escapeHtml(p.name)+'">'+escapeHtml(p.name)+'</option>').join('')+'</select></label>'+
    '<label>Damage<input id="projectile-builder-damage" class="field-input" type="number" min="0" max="1000000000" step="1" value="10"></label>'+
    '<label>Speed (units/second)<input id="projectile-builder-speed" class="field-input" type="number" min="0.01" max="10000" step="1" value="18"></label>'+
    '<label>Cooldown (seconds)<input id="projectile-builder-cooldown" class="field-input" type="number" min="0" max="3600" step="0.05" value="0.4"></label>'+
    '<p>Use Controls → Attack to choose the firing input. Tagged non-solid targets receive damage; solid scenery blocks shots. Travel uses the existing 3D projectile path, three-second lifetime and 0.3 hit radius; 2D aiming is not qualified here.</p>'+
    '<button id="projectile-builder-apply">Create and use fixed weapon</button><p id="projectile-builder-status" role="status"></p>';
  const q=id=>document.getElementById('projectile-builder-'+id);
  q('apply').onclick=()=>{
    const result=applyProjectileWeaponBuilder({name:q('name').value,prefabName:q('prefab').value,damage:q('damage').value.trim()?Number(q('damage').value):NaN,speed:q('speed').value.trim()?Number(q('speed').value):NaN,cooldown:q('cooldown').value.trim()?Number(q('cooldown').value):NaN});
    if(result.ok){renderPrefabPalette();renderPlayerSettingsPanel();document.getElementById('projectile-weapon-builder').open=true;document.getElementById('projectile-builder-status').textContent='Created '+result.record.name+' using '+result.prefabName+'. Play and use Attack; edit the saved Weapon Definition to tune it.';}
    else q('status').textContent=result.reason;
  };
  host.querySelectorAll('input,select,button').forEach(el=>el.disabled=playMode);
}
function applyHitscanWeaponBuilder(input, mode='hitscan') {
  const bad=reason=>({ok:false,reason});
  if(playMode)return bad('Stop Play before constructing a weapon.');
  if(!['firstperson','thirdperson','topdown','hovercraft'].includes(currentPlayerSettings.controllerType))return bad('This builder uses the existing 3D Player weapon path. Choose a 3D controller; 2D aiming is not qualified here.');
  if(!input||typeof input!=='object'||Array.isArray(input))return bad('Choose weapon settings.');
  for(const key of ['name','damage','cooldown','range']){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!Object.prototype.hasOwnProperty.call(d,'value'))return bad('Use authored weapon settings, not accessors.');}
  if(typeof input.name!=='string')return bad('Choose a weapon name.');
  const name=input.name.trim();
  if(!name||name.length>80||weaponDefinitions.some(r=>r?.name===name))return bad('Choose a distinct weapon name of 1–80 characters.');
  if(weaponDefinitions.length>=128)return bad('The project supports up to128 Weapon Definitions.');
  if(!Number.isFinite(input.damage)||input.damage<0||input.damage>1e9||!Number.isFinite(input.cooldown)||input.cooldown<0||input.cooldown>3600)return bad('Choose finite nonnegative damage and cooldown.');
  if(!Number.isFinite(input.range)||input.range<0||input.range>10000)return bad('Range must be between0 and10000 world units. Zero cannot hit a distant target.');
  let n=nextWeaponDefinitionId;while(weaponDefinitions.some(r=>r?.id==='weapon-'+n))n++;
  if(!Number.isSafeInteger(n)||n<1||n>=Number.MAX_SAFE_INTEGER)return bad('Definition identity allocator is unavailable.');
  if(!['hitscan','melee'].includes(mode))return bad('Choose a supported weapon builder.');
  const tuning={mode,damage:input.damage,cooldown:input.cooldown,range:input.range};
  if(mode==='hitscan')tuning.tracer=true;
  const asset=OpusWeaponDefinitions.capture(tuning,name,'weapon-'+n);
  if(!asset.ok)return asset;
  const owner=currentPlayerSettings.weapon||defaultWeaponConfig();
  if(!owner||typeof owner!=='object'||Array.isArray(owner))return bad('Repair the current fixed weapon owner before setup.');
  const ownerCheck=OpusWeaponDefinitions.capture(owner,'Owner validation','builder-owner');
  if(!ownerCheck.ok)return bad(ownerCheck.reason);
  const nextOwner=JSON.parse(JSON.stringify(owner));
  Object.assign(nextOwner,{enabled:true,source:'fixed',fireOnAnimationEvent:false,definitionRef:asset.record.id});
  pushUndo();weaponDefinitions.push(asset.record);nextWeaponDefinitionId=n+1;
  currentPlayerSettings.weapon=nextOwner;
  return {ok:true,record:asset.record};
}
function renderHitscanWeaponBuilder() {
  const host=document.getElementById('hitscan-weapon-builder');if(!host)return;
  host.innerHTML='<summary>Build an instant-hit weapon</summary><p>Create a named hitscan weapon and bind it to this level’s fixed Player weapon. Apply enables direct Attack firing and a shot tracer. Existing inline tuning, equipment and input mappings are retained; Undo restores the previous setup.</p>'+
    '<label>Weapon name<input id="hitscan-builder-name" class="field-input" maxlength="80" placeholder="e.g. Scout ray"></label>'+
    '<label>Damage<input id="hitscan-builder-damage" class="field-input" type="number" min="0" max="1000000000" step="1" value="10"></label>'+
    '<label>Range (world units)<input id="hitscan-builder-range" class="field-input" type="number" min="0" max="10000" step="1" value="50"></label>'+
    '<label>Cooldown (seconds)<input id="hitscan-builder-cooldown" class="field-input" type="number" min="0" max="3600" step="0.05" value="0.4"></label>'+
    '<p>Use Controls → Attack to choose the input. The nearest tagged non-solid target takes damage; solid scenery blocks the ray. First-person uses the camera aim; other 3D controllers use the Player’s forward direction. Range0 cannot reach distant targets. Terrain rays and 2D aiming are not provided by this builder.</p>'+
    '<button id="hitscan-builder-apply">Create and use fixed weapon</button><p id="hitscan-builder-status" role="status"></p>';
  const q=id=>document.getElementById('hitscan-builder-'+id);
  q('apply').onclick=()=>{
    const number=id=>q(id).value.trim()?Number(q(id).value):NaN;
    const result=applyHitscanWeaponBuilder({name:q('name').value,damage:number('damage'),cooldown:number('cooldown'),range:number('range')});
    if(result.ok){renderPlayerSettingsPanel();document.getElementById('hitscan-weapon-builder').open=true;document.getElementById('hitscan-builder-status').textContent='Created '+result.record.name+'. Play and use Attack; edit the saved Weapon Definition to tune it.';}
    else q('status').textContent=result.reason;
  };
  host.querySelectorAll('input,button').forEach(el=>el.disabled=playMode);
}
function applyMeleeWeaponBuilder(input) {
  return applyHitscanWeaponBuilder(input,'melee');
}
function renderMeleeWeaponBuilder() {
  const host=document.getElementById('melee-weapon-builder');if(!host)return;
  host.innerHTML='<summary>Build a close-range weapon</summary><p>Create a named melee weapon for this level’s fixed Player weapon. Apply enables direct Attack firing. Existing inline tuning, equipment and input mappings are retained; Undo restores the previous setup. No projectile Prefab is needed.</p>'+
    '<label>Weapon name<input id="melee-builder-name" class="field-input" maxlength="80" placeholder="e.g. Training blade"></label>'+
    '<label>Damage<input id="melee-builder-damage" class="field-input" type="number" min="0" max="1000000000" step="1" value="10"></label>'+
    '<label>Reach (world units)<input id="melee-builder-range" class="field-input" type="number" min="0" max="10000" step="0.1" value="2.5"></label>'+
    '<label>Cooldown (seconds)<input id="melee-builder-cooldown" class="field-input" type="number" min="0" max="3600" step="0.05" value="0.4"></label>'+
    '<p>Use Controls → Attack to choose input. The nearest visible tagged target within reach plus its radius and a fixed 60° half-cone takes damage. All supported 3D controllers use the Player’s forward direction and muzzle origin, not the camera ray. Melee does not consume magazine ammo. Historical melee does not check wall line of sight: walls do not shield targets. Reach0 permits overlapping contact only. 2D aiming is not provided here.</p>'+
    '<button id="melee-builder-apply">Create and use fixed weapon</button><p id="melee-builder-status" role="status"></p>';
  const q=id=>document.getElementById('melee-builder-'+id);
  q('apply').onclick=()=>{
    const number=id=>q(id).value.trim()?Number(q(id).value):NaN;
    const result=applyMeleeWeaponBuilder({name:q('name').value,damage:number('damage'),cooldown:number('cooldown'),range:number('range')});
    if(result.ok){renderPlayerSettingsPanel();document.getElementById('melee-weapon-builder').open=true;document.getElementById('melee-builder-status').textContent='Created '+result.record.name+'. Play and use Attack; edit the saved Weapon Definition to tune it.';}
    else q('status').textContent=result.reason;
  };
  host.querySelectorAll('input,button').forEach(el=>el.disabled=playMode);
}
function changeInlineWeaponFeedback(key, value) {
  const bad=reason=>({ok:false,reason});
  if(playMode)return bad('Stop Play before editing combat feedback.');
  const bools=['muzzleEffect','impactEffect','tracer'],colors=['muzzleEffectColor','impactEffectColor'],sounds=['fireAudioAssetId','impactAudioAssetId'];
  if(![...bools,...colors,...sounds].includes(key))return bad('Choose a supported feedback field.');
  if(bools.includes(key)&&typeof value!=='boolean'||colors.includes(key)&&!(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)))return bad('Choose a valid feedback option or six-digit color.');
  if(sounds.includes(key)&&(typeof value!=='string'||value&&audioAssets.filter(a=>a.id===value).length!==1))return bad('Choose an available feedback sound.');
  const owner=currentPlayerSettings.weapon||defaultWeaponConfig();
  if(!owner||typeof owner!=='object'||Array.isArray(owner)||Object.getPrototypeOf(owner)!==Object.prototype)return bad('Repair retained weapon settings before editing feedback.');
  const descriptors=Object.getOwnPropertyDescriptors(owner);
  if(Object.values(descriptors).some(d=>!Object.prototype.hasOwnProperty.call(d,'value')))return bad('Use authored weapon settings, not accessors.');
  if(owner.definitionRef||owner.source==='equipment')return bad('Edit the named Weapon Definition; fixed feedback does not override equipped or named tuning.');
  const next=sounds.includes(key)&&value===''?undefined:value;
  if(owner[key]===next)return {ok:true,unchanged:true};
  // Snapshot the real Player settings owner before the first actual mutation.
  // Keep unrelated tuning and historical empty-sound semantics unchanged.
  pushUndo();currentPlayerSettings.weapon=owner;owner[key]=next;
  return {ok:true};
}
function applyPlayerAmmoSettings(input) {
  const bad=reason=>({ok:false,reason});
  if(playMode)return bad('Stop Play before editing ammunition.');
  if(!input||typeof input!=='object'||Array.isArray(input))return bad('Choose ammunition settings.');
  const keys=['ammoMode','magazineSize','startingMagazine','reserveAmmo','reloadDuration'],patch={};
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!Object.prototype.hasOwnProperty.call(d,'value'))return bad('Use authored ammunition settings, not accessors.');patch[key]=d.value;}
  const rawOwner=currentPlayerSettings.weapon||defaultWeaponConfig();
  if(typeof rawOwner!=='object'||Array.isArray(rawOwner)||Object.getPrototypeOf(rawOwner)!==Object.prototype)return bad('Choose portable authored weapon settings.');
  const owner={};
  for(const key of Object.keys(rawOwner)){const d=Object.getOwnPropertyDescriptor(rawOwner,key);if(!d||!Object.prototype.hasOwnProperty.call(d,'value'))return bad('Use authored weapon settings, not accessors.');owner[key]=d.value;}
  if(owner.source==='equipment')return bad('Equipment uses each item’s weapon. Edit its Weapon Definition in the library; fixed ammunition does not control equipped slots.');
  const state=resolveWeaponDefinitionOwner(owner);if(!state.ok)return bad(state.reason);
  const candidate={...state.config,...patch};
  const checked=OpusWeaponDefinitions.capture(candidate,'Ammunition validation','ammo-validation');if(!checked.ok)return bad(checked.reason);
  if(!state.legacy){
    const asset=weaponDefinitions.find(r=>r?.id===owner.definitionRef);
    return updateWeaponDefinition(asset.id,asset.name,checked.record.config);
  }
  if(keys.every(key=>owner[key]===patch[key]))return bad('No settings changed.');
  const nextOwner=JSON.parse(JSON.stringify(candidate));
  pushUndo();currentPlayerSettings.weapon=nextOwner;return {ok:true};
}
function renderWeaponDefinitionLibrary() {
  const host=document.getElementById('weapon-definition-library');if(!host)return;
  const fixed=currentPlayerSettings.weapon||defaultWeaponConfig();
  host.innerHTML='<summary>Weapon Definitions — reusable project assets</summary><p>Save named tuning, then reuse it on fixed or equipment weapons. Enable, firing source and animation events stay on the owner; ammunition stays in each runtime slot.</p>'+
    '<label>Fixed weapon definition<select id="weapon-definition-fixed" class="field-input">'+weaponDefinitionOptions(fixed.definitionRef)+'</select></label>'+
    '<label>Saved definition<select id="weapon-definition-select" class="field-input"><option value="">Choose a saved asset</option>'+weaponDefinitions.map((r,i)=>'<option value="'+i+'">'+escapeHtml(r?.name||r?.id||'Unsupported asset')+'</option>').join('')+'</select></label>'+
    '<label>Definition name<input id="weapon-definition-name" class="field-input" maxlength="80" placeholder="e.g. Scout carbine"></label>'+
    '<div class="field-row"><button id="weapon-definition-capture">Capture fixed weapon</button><button id="weapon-definition-save" disabled>Save tuning</button></div><div id="weapon-definition-fields"></div>'+
    '<p id="weapon-definition-preview"></p><div class="field-row"><button id="weapon-definition-export" disabled>Export asset</button><button id="weapon-definition-import">Import asset</button><button id="weapon-definition-remove" disabled>Remove asset</button></div><input id="weapon-definition-file" type="file" accept=".json,application/json" hidden><p id="weapon-definition-status" role="status"></p>';
  const el=id=>document.getElementById('weapon-definition-'+id),status=message=>{el('status').textContent=message;};
  el('fixed').disabled=playMode;
  el('fixed').onchange=()=>{const owner=currentPlayerSettings.weapon||defaultWeaponConfig(),r=bindWeaponDefinition(owner,el('fixed').value);if(r.ok)currentPlayerSettings.weapon=owner;renderPlayerSettingsPanel();document.getElementById('weapon-definition-status').textContent=r.ok?'Reference saved. Inline tuning retained for later.':r.reason;};
  let selected=null,draft=null;
  const select=()=>{
    const i=el('select').value;selected=i===''?null:weaponDefinitions[Number(i)];
    const state=selected?OpusWeaponDefinitions.inspect(selected):{ok:false};draft=state.ok?JSON.parse(JSON.stringify(state.record.config)):null;
    el('name').value=selected?.name||'';el('fields').innerHTML='';el('save').disabled=playMode||!draft;el('remove').disabled=playMode||!selected||typeof selected.id!=='string';el('export').disabled=!selected;
    el('preview').textContent=selected?(state.ok?'Saved tuning overrides inline weapon tuning. '+JSON.stringify(state.record.config):state.reason):'Choose a definition or capture the current fixed weapon.';
    if(!draft)return;
    const feedback=document.createElement('details');feedback.id='weapon-definition-feedback';feedback.open=true;
    const feedbackSummary=document.createElement('summary');feedbackSummary.textContent='Combat feedback — sounds, bursts & camera';feedback.appendChild(feedbackSummary);
    const feedbackHelp=document.createElement('p');feedbackHelp.textContent='Tune this reusable bundle, then Save tuning once. Damage, ammunition and owner bindings are unchanged. Blank numbers retain runtime defaults; recoil applies to first-person weapons. Camera duration 0 uses the historical 0.15-second fallback.';feedback.appendChild(feedbackHelp);
    const labels={mode:'Weapon mode',prefabName:'Projectile Prefab',damage:'Damage',damageType:'Damage Type',cooldown:'Cooldown (seconds)',speed:'Projectile speed',range:'Range',fireAudioAssetId:'Fire sound',emptySoundAssetId:'Empty sound',impactAudioAssetId:'Impact sound',muzzleEffect:'Muzzle burst',muzzleEffectColor:'Muzzle color',impactEffect:'Impact burst',impactEffectColor:'Impact color',tracer:'Hitscan tracer',recoilHorizontal:'Horizontal recoil',recoilVertical:'Vertical recoil','fireCameraShake.intensity':'Fire camera shake intensity','fireCameraShake.duration':'Fire camera shake duration (seconds)'};
    const feedbackKeys=new Set(['fireAudioAssetId','emptySoundAssetId','impactAudioAssetId','muzzleEffect','muzzleEffectColor','impactEffect','impactEffectColor','tracer','recoilHorizontal','recoilVertical','fireCameraShake.intensity','fireCameraShake.duration']);
    for(const key of Object.keys(labels)){
      const label=document.createElement('label');label.textContent=labels[key];let input;
      const shakeKey=key.startsWith('fireCameraShake.')?key.split('.')[1]:null;
      const value=shakeKey?draft.fireCameraShake?.[shakeKey]:draft[key];
      if(key==='mode'||key==='damageType'||key==='prefabName'||key.endsWith('AssetId')){
        input=document.createElement('select');const values=key==='damageType'?['ordinary','fire','ice']:key==='mode'?['projectile','hitscan','melee']:['',...(key==='prefabName'?prefabs.filter(p=>!aiProjectilePrefabIssue(p.name)).map(p=>p.name):audioAssets.map(a=>a.id))];
        for(const v of values){const option=document.createElement('option');option.value=v;option.textContent=key==='mode'?v:key==='prefabName'?(v||'Choose projectile Prefab'):(audioAssets.find(a=>a.id===v)?.name||v||'No sound');input.appendChild(option);}
        if(draft[key]&&!values.includes(draft[key])){const option=document.createElement('option');option.value=draft[key];option.textContent='Unavailable: '+draft[key];option.disabled=true;input.appendChild(option);}
      }else{input=document.createElement('input');input.type=['muzzleEffect','impactEffect','tracer'].includes(key)?'checkbox':key.endsWith('Color')?'color':'number';if(input.type==='number'){input.min='0';input.step='any';}}
      input.id='weapon-definition-tuning-'+key.replace('.','-');input.className='field-input';
      if(input.type==='checkbox')input.checked=!!value;
      else input.value=value===undefined?(key==='damageType'?'ordinary':key==='muzzleEffectColor'?'#ffd94d':key==='impactEffectColor'?'#e6e6d9':''):String(value);
      input.disabled=playMode;
      input.onchange=()=>{
        if(shakeKey){const shake={...(draft.fireCameraShake||{})};if(!input.value.trim())delete shake[shakeKey];else shake[shakeKey]=Number(input.value);if(Object.keys(shake).length)draft.fireCameraShake=shake;else delete draft.fireCameraShake;}
        else if(input.type==='number'){if(!input.value.trim())delete draft[key];else draft[key]=Number(input.value);}
        else draft[key]=input.type==='checkbox'?input.checked:input.value;
      };label.appendChild(input);
      if(input.type==='checkbox')label.className='weapon-feedback-toggle';
      if(input.type==='color'){
        const palette=document.createElement('select');palette.id=input.id+'-palette';palette.className='field-input';palette.setAttribute('aria-label',labels[key]+' preset');
        for(const [v,name]of [['','Custom color'],['#ffd94d','Warm flash'],['#e6e6d9','Neutral impact'],['#ff6633','Orange'],['#66ccff','Blue'],['#ffffff','White']]){const option=document.createElement('option');option.value=v;option.textContent=name;palette.appendChild(option);}
        palette.value='';palette.disabled=playMode;palette.onchange=()=>{if(palette.value){input.value=palette.value;draft[key]=palette.value;}};label.appendChild(palette);
      }
      (feedbackKeys.has(key)?feedback:el('fields')).appendChild(label);
    }
    el('fields').appendChild(feedback);
  };
  el('select').onchange=select;
  el('capture').disabled=playMode;el('capture').onclick=()=>{const current=resolveWeaponDefinitionOwner(fixed),r=current.ok?captureWeaponDefinition(current.config,el('name').value):current;if(r.ok){renderPlayerSettingsPanel();document.getElementById('weapon-definition-select').value=String(weaponDefinitions.length-1);document.getElementById('weapon-definition-select').onchange();}document.getElementById('weapon-definition-status').textContent=r.ok?'Named asset captured. Bind it to reuse its tuning.':r.reason;};
  el('save').onclick=()=>{const r=updateWeaponDefinition(selected?.id,el('name').value,draft);status(r.ok?'Tuning saved for every referenced owner.':r.reason);if(r.ok){selected=r.record;el('select').selectedOptions[0].textContent=r.record.name;el('preview').textContent='Saved tuning overrides inline weapon tuning. '+JSON.stringify(r.record.config);}};
  el('remove').onclick=()=>{if(selected&&removeWeaponDefinition(selected.id)){renderPlayerSettingsPanel();document.getElementById('weapon-definition-status').textContent='Asset removed. References are retained and inert until repaired.';}};
  el('export').onclick=()=>{if(!selected)return;const url=URL.createObjectURL(new Blob([JSON.stringify(selected,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='weapon-definition.json';a.click();URL.revokeObjectURL(url);};
  el('import').disabled=playMode;el('import').onclick=()=>el('file').click();el('file').onchange=async()=>{const file=el('file').files?.[0];if(!file)return;const r=file.size>65536?{ok:false,reason:'Asset exceeds 64 KiB.'}:importWeaponDefinition(await file.text());if(r.ok)renderPlayerSettingsPanel();document.getElementById('weapon-definition-status').textContent=r.ok?(r.retained?'Unsupported asset retained, unavailable for use.':'Asset imported.'):r.reason;};
  select();
}
function setWeaponDefinitionTuningEditable() {
  const fixed=currentPlayerSettings.weapon;
  const panel=document.getElementById('player-weapon-tunables');
  if(panel)for(const input of panel.querySelectorAll('input,select')){
    // The ammunition form owns its draft/atomic Apply guard and routes named
    // tuning to the shared asset. Other inline tuning remains read-only.
    if(['player-weapon-ammomode','player-weapon-magsize','player-weapon-startmag','player-weapon-reserve','player-weapon-reload-duration'].includes(input.id))continue;
    const ownerField=input.id==='player-weapon-source'||input.id==='player-weapon-fire-on-event';
    input.disabled=playMode||!ownerField&&!!fixed?.definitionRef&&fixed.source!=='equipment';
    input.title=input.disabled&&!playMode?'Edit the named Weapon Definition or clear its reference to use retained inline tuning.':'';
  }
  const equipment=document.getElementById('equipment-def-list');if(equipment)for(const input of equipment.querySelectorAll('[data-equipment-field^="weapon."]')){
    const owner=currentPlayerSettings.equipmentDefs?.[Number(input.dataset.equipmentIndex)]?.weapon;
    input.disabled=playMode||!!owner?.definitionRef;input.title=owner?.definitionRef?'Edit the named definition or clear its reference.':'';
  }
}
function weaponDefinitionReferenceIssue(config) {
  if ((config.mode || 'projectile') === 'projectile') {
    const issue = aiProjectilePrefabIssue(config.prefabName);
    if (issue) return issue;
  }
  for (const key of ['fireAudioAssetId','emptySoundAssetId','impactAudioAssetId']) {
    if (config[key] && audioAssets.filter(a=>a.id===config[key]).length !== 1) return 'Choose an available '+key+' sound.';
  }
  return null;
}
function resolveWeaponDefinitionOwner(owner) {
  if (!owner) return {ok:false,reason:'Weapon owner unavailable.'};
  const ref=Object.getOwnPropertyDescriptor(owner,'definitionRef');
  if (!ref || (Object.prototype.hasOwnProperty.call(ref,'value') && (ref.value===undefined || ref.value===''))) return {ok:true,config:owner,legacy:true};
  if (typeof OpusWeaponDefinitions === 'undefined') return {ok:false,reason:'Weapon Definition runtime unavailable.'};
  const state=OpusWeaponDefinitions.resolve(owner,typeof weaponDefinitions==='undefined'?[]:weaponDefinitions);
  if (!state.ok || state.legacy) return state;
  const issue=weaponDefinitionReferenceIssue(state.config);
  return issue?{ok:false,reason:issue}:state;
}
function copyAiArchetypeLibrary(raw) { return JSON.parse(JSON.stringify(Array.isArray(raw)?raw:[])); }
function inspectAiArchetype(record) {
  const bad=reason=>({ok:false,reason});
  if(!record||typeof record!=='object'||Array.isArray(record)||record.kind!=='AiArchetype'||record.version!==1||Object.keys(record).some(k=>!['kind','version','name','brain','origin','anchorMode'].includes(k)))return bad('Unsupported archetype format is retained but cannot be applied.');
  if(typeof record.name!=='string'||!record.name.trim()||record.name!==record.name.trim()||record.name.length>80)return bad('Choose an archetype name from 1 to 80 characters.');
  try{if(JSON.stringify(record).length>65536)return bad('Choose an archetype smaller than 64 KiB.');}catch{return bad('Archetypes require finite portable JSON.');}
  if(!['relative','world'].includes(record.anchorMode)||!Array.isArray(record.origin)||record.origin.length!==3||!record.origin.every(Number.isFinite))return bad('Archetype anchors need an explicit placement policy and finite XYZ origin.');
  const state=OpusAiBrain.inspect(record.brain);
  if(!state.ok||!state.record.enabled)return bad(state.reason||'Disabled Brain archetypes cannot be applied.');
  return {ok:true,record:{kind:'AiArchetype',version:1,name:record.name,brain:state.record,origin:record.origin.slice(),anchorMode:record.anchorMode}};
}
function aiArchetypeReferenceIssue(config) {
  const slots=[config,...(config.states||[]).flatMap(s=>[s.movement,s.attack].filter(Boolean))];
  for(const slot of slots){
    if(slot.targetId){const targets=placed.filter(i=>i.id===slot.targetId);if(targets.length!==1||!targets[0].entity)return 'A captured Target is unavailable or ambiguous in this level. Repair it in the AI Inspector before saving/applying.';}
    if(slot.pathId){const paths=placed.filter(i=>i.id===slot.pathId&&i.kind==='path');if(paths.length!==1)return 'A captured Path is unavailable or ambiguous in this level.';}
    if(slot.waypointNames){for(const name of slot.waypointNames.split(',')){if(!name.trim()||name!==name.trim()||placed.filter(i=>i.isWaypoint&&i.entity&&i.name===name).length!==1)return 'A captured route needs uniquely named existing Waypoints in this level.';}}
    if(slot.attackPrefab){const issue=aiProjectilePrefabIssue(slot.attackPrefab);if(issue)return issue;}
  }
  if((config.states||[]).some(s=>(s.entryActions||[]).length))return 'Archetypes with state entry Actions are not portable settings yet. Use a whole-character Prefab; entry Actions were not stripped.';
  return null;
}
function aiArchetypeTarget(item,requireBrain=false) {
  if(playMode||item?.kind!=='cube'||!item.entity?.position)return {ok:false,reason:'Stop Play and choose an editable Cube character.'};
  const p=item.entity.position;if(![p.x,p.y,p.z].every(Number.isFinite))return {ok:false,reason:'Choose a character with a finite XYZ position.'};
  const attached=Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain');
  const checked=attached?OpusAiBrain.inspect(item.components['ai-brain']):null;
  if(attached&&(!checked.ok||!checked.record.enabled))return {ok:false,reason:checked.reason||'Explicitly enable the retained AI Brain first.'};
  if(requireBrain&&!item.entity.ai)return {ok:false,reason:'Configure an AI Brain or gameplay recipe before saving an archetype.'};
  return {ok:true,position:[p.x,p.y,p.z]};
}
function captureAiArchetype(item,name,anchorMode='relative') {
  const target=aiArchetypeTarget(item,true);if(!target.ok)return target;
  const brain=OpusAiBrain.captureLegacy(item.entity.ai);if(!brain.ok)return brain;
  const checked=inspectAiArchetype({kind:'AiArchetype',version:1,name:typeof name==='string'?name.trim():name,brain:brain.record,origin:target.position,anchorMode});if(!checked.ok)return checked;
  const issue=aiArchetypeReferenceIssue(checked.record.brain.config);if(issue)return {ok:false,reason:issue};
  if(aiArchetypes.length>=128)return {ok:false,reason:'At most 128 saved AI archetypes.'};
  if(aiArchetypes.some(r=>r?.name===checked.record.name))return {ok:false,reason:'Choose a unique name; existing archetypes were not replaced.'};
  pushUndo();aiArchetypes.push(checked.record);return {ok:true,record:checked.record};
}
function aiArchetypeCandidate(item,record) {
  const target=aiArchetypeTarget(item);if(!target.ok)return target;
  const checked=inspectAiArchetype(record);if(!checked.ok)return checked;
  const config=checked.record.brain.config,issue=aiArchetypeReferenceIssue(config);if(issue)return {ok:false,reason:issue};
  if(checked.record.anchorMode==='relative'){
    const delta=target.position.map((v,i)=>v-checked.record.origin[i]);
    for(const slot of [config,...(config.states||[]).map(s=>s.movement).filter(Boolean)])if(slot.base)slot.base=slot.base.map((v,i)=>v+delta[i]);
  }
  const validated=OpusAiBrain.inspect({...checked.record.brain,config});if(!validated.ok)return validated;
  const current=item.entity.ai?OpusAiBrain.captureLegacy(item.entity.ai):null;
  return {ok:true,config:validated.record.config,changed:!current?.ok||JSON.stringify(current.record.config)!==JSON.stringify(validated.record.config)};
}
function applyAiArchetype(item,record) {
  const candidate=aiArchetypeCandidate(item,record);if(!candidate.ok||!candidate.changed)return candidate;
  const changed=changeAiBrain(item,ai=>{for(const key of Object.keys(ai))delete ai[key];Object.assign(ai,JSON.parse(JSON.stringify(candidate.config)));});
  return {ok:true,changed};
}
function importAiArchetype(raw) {
  if(playMode)return {ok:false,reason:'Stop Play before importing archetypes.'};
  if(aiArchetypes.length>=128)return {ok:false,reason:'At most 128 saved AI archetypes.'};
  let record;try{record=JSON.parse(typeof raw==='string'?raw:JSON.stringify(raw));}catch{return {ok:false,reason:'Choose a valid JSON file.'};}
  if(JSON.stringify(record).length>65536)return {ok:false,reason:'Choose an archetype smaller than 64 KiB.'};
  if(aiArchetypes.some(r=>JSON.stringify(r)===JSON.stringify(record)))return {ok:false,reason:'This archetype record is already saved.'};
  const state=inspectAiArchetype(record);
  if(state.ok&&aiArchetypes.some(r=>inspectAiArchetype(r).ok&&r.name===record.name))return {ok:false,reason:'Choose a distinct archetype name.'};
  pushUndo();aiArchetypes.push(record);return {ok:true,...(!state.ok?{warning:state.reason}:{})};
}
function removeAiArchetype(index) {
  if(playMode||!Number.isInteger(index)||index<0||index>=aiArchetypes.length)return false;
  pushUndo();aiArchetypes.splice(index,1);return true;
}
function aiArchetypeSummary(config) {
  const named=id=>placed.find(i=>i.id===id)?.name||'Unnamed object';
  const movement=slot=>`${({follow:'Follow',flee:'Flee',faceTarget:'Face Target',orbit:'Orbit',wander:'Wander',patrolRoute:'Patrol Route',navigateToTarget:'Navigate',followPath:'Follow Path',investigate:'Investigate'})[slot.type]||'Stationary'}${slot.speed!=null?' · speed '+slot.speed:''}${slot.radius!=null?' · radius '+slot.radius:''}${['follow','faceTarget','navigateToTarget'].includes(slot.type)?' · target '+(slot.targetId?named(slot.targetId):'Player'):''}${slot.waypointNames?' · route '+slot.waypointNames:''}${slot.pathId?' · path '+named(slot.pathId):''}${slot.base?' · anchor XYZ '+slot.base.map(v=>Number(v.toFixed(2))).join(', '):''}`;
  const attack=slot=>slot?.attackEnabled?`Attack · ${slot.attackPrefab||'missing projectile'} · damage ${slot.attackDamage??'default'} · cooldown ${slot.attackCooldown??'default'} · radius ${slot.attackRadius??'default'}`:'Attack disabled';
  const lines=[];
  if(config.mode==='stateMachine'){
    lines.push('State Machine · start '+(config.startState||'none')+' · '+(config.states||[]).length+' states');
    for(const state of (config.states||[]).slice(0,8))lines.push(state.name+': '+movement(state.movement||{type:''})+'; '+attack(state.attack));
    if((config.states||[]).length>8)lines.push('Additional states retained; inspect the applied Brain for their details.');
  }else lines.push('Simple · '+movement(config)+'; '+attack(config));
  if(config.perception)lines.push('Perception · vision '+(config.perception.visionDistance??'default')+' · hearing '+(config.perception.hearingRadius??'default')+' · FOV '+(config.perception.fovDegrees??'default')+' · LOS '+(config.perception.requiresLOS===undefined?'default':config.perception.requiresLOS?'required':'not required'));
  return lines.join('\n');
}
function renderAiArchetypeLibrary(item) {
  const host=document.getElementById('ai-archetype-library');if(!host)return;
  const choices=aiArchetypes.slice(0,128),target=aiArchetypeTarget(item,true);
  host.innerHTML=`<summary>AI archetype library</summary><p class="field-help">Save and reuse this character’s authored Brain. Geometry, health, controller, animation mappings and identity stay unchanged. Use gameplay recipes to build a starting archetype; use Prefabs for complete characters.</p><label>Name<input id="ai-archetype-name" class="field-input" maxlength="80" placeholder="e.g. Listening guard"></label><label>Movement anchors<select id="ai-archetype-anchors" class="field-input"><option value="relative">Place relative to receiving character</option><option value="world">Keep authored world anchors</option></select></label><button id="ai-archetype-capture" class="toolbar-btn">Save AI archetype</button><label>Saved archetypes<select id="ai-archetype-select" class="field-input"><option value="">Choose archetype…</option>${choices.map((r,i)=>`<option value="${i}">${escapeHtml(typeof r?.name==='string'&&r.name.length<=80?r.name:'Unavailable retained record')}</option>`).join('')}</select></label><p id="ai-archetype-preview" class="field-help">Choose an archetype to review.</p><div class="camera-template-actions"><button id="ai-archetype-apply" class="toolbar-btn" disabled>Apply Brain</button><button id="ai-archetype-remove" class="toolbar-btn" disabled>Remove</button><button id="ai-archetype-export" class="toolbar-btn" disabled>Export JSON</button><button id="ai-archetype-import" class="toolbar-btn">Import JSON</button></div><input hidden id="ai-archetype-file" type="file" accept=".json,application/json"><p id="ai-archetype-status" class="field-help" role="status">Project-local references must still exist in this level. No automatic rebinding; Action-bound states require whole-character Prefabs. Apply is one Undo step.</p>`;
  const q=id=>host.querySelector('#ai-archetype-'+id),chosen=()=>q('select').value===''?null:choices[Number(q('select').value)],status=t=>q('status').textContent=t;
  q('capture').disabled=!target.ok;q('name').disabled=playMode;q('anchors').disabled=playMode;q('import').disabled=playMode;
  q('preview').style.whiteSpace='pre-wrap';
  q('select').onchange=()=>{const record=chosen(),state=aiArchetypeCandidate(item,record);q('apply').disabled=!state.ok||!state.changed;q('remove').disabled=playMode||q('select').value==='';q('export').disabled=q('select').value==='';q('preview').textContent=state.ok?`${record.name} · ${record.anchorMode==='relative'?'relative placement':'world anchors'}\n${aiArchetypeSummary(state.config)}\n${state.changed?'Ready to apply authored Brain only.':'Already identical; no history change.'}`:record?state.reason:'Choose an archetype to review.';};
  q('capture').onclick=()=>{const result=captureAiArchetype(item,q('name').value,q('anchors').value);if(result.ok)renderAiArchetypeLibrary(item);else status(result.reason);};
  q('apply').onclick=()=>{const result=applyAiArchetype(item,chosen());if(!result.ok)status(result.reason);else if(result.changed){renderInspector();validateCurrentProject();showStatus('AI archetype applied; one Undo step.');}else status('Brain unchanged; no Undo entry.');};
  q('remove').onclick=()=>{if(removeAiArchetype(Number(q('select').value)))renderAiArchetypeLibrary(item);};
  q('export').onclick=()=>{if(q('select').value==='')return;const url=URL.createObjectURL(new Blob([JSON.stringify(chosen(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ai-archetype.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
  q('import').onclick=()=>{if(!playMode)q('file').click();};
  q('file').onchange=async()=>{const file=q('file').files[0];if(!file)return;if(file.size>65536){status('Choose an archetype smaller than 64 KiB.');return;}const result=importAiArchetype(await file.text());if(result.ok){renderAiArchetypeLibrary(item);showStatus(result.warning||'AI archetype imported.');}else status(result.reason);};
}
function copyControllerTemplateLibrary(raw) { return JSON.parse(JSON.stringify(Array.isArray(raw)?raw:[])); }
function controllerTemplateTarget() {
  const family=currentPlayerSettings?.controllerType;
  if(!Object.prototype.hasOwnProperty.call(DEFAULT_PLAYER_SETTINGS,family))return {ok:false,reason:'Choose a supported Player controller first.'};
  if(['platformer2d','topdown2d'].includes(family)){
    const ref=currentPlayerSettings[family==='platformer2d'?'platformerObjectRef':'topdownObjectRef'];
    const matches=placed.filter(item=>item.id===ref);
    if(matches.length!==1||matches[0].kind!=='sprite')return {ok:false,reason:'Bind one uniquely identified Player Sprite through Player Builder first.'};
    const item=matches[0],id=family==='platformer2d'?'platformer-controller-2d':'topdown-controller-2d';
    if(item.components?.[id]?.enabled!==true)return {ok:false,reason:'Enable the bound Player controller explicitly first.'};
    const issues=OpusAuthoring.validateComponent(item,id);if(issues.length)return {ok:false,reason:issues[0].message};
    const fields=family==='platformer2d'?['moveLeftActionRef','moveRightActionRef','jumpActionRef']:['moveLeftActionRef','moveRightActionRef','moveUpActionRef','moveDownActionRef'];
    for(const key of fields)if(!findInputAction(item.components[id][key]))return {ok:false,reason:'Resolve the controller’s named Input Actions before using templates.'};
    for(const ability of ['jump-ability','sprint-ability'])if(Object.prototype.hasOwnProperty.call(item.components,ability)){
      const record=item.components[ability];
      if(!record||typeof record!=='object'||Array.isArray(record)||Object.getPrototypeOf(record)!==Object.prototype)return {ok:false,reason:'Retain malformed attached ability data for explicit repair before using templates.'};
      const problems=OpusAuthoring.validateComponent(item,ability);
      if(problems.length||!findInputAction(item.components[ability].inputActionRef))return {ok:false,reason:problems[0]?.message||'Resolve the ability’s named Input Action first.'};
    }
    return {ok:true,family,settings:currentPlayerSettings,components:item.components,item};
  }
  return {ok:true,family,settings:currentPlayerSettings,components:{},item:null};
}
function captureControllerTemplate(name) {
  if(playMode)return {ok:false,reason:'Stop Play before saving settings.'};
  const target=controllerTemplateTarget();if(!target.ok)return target;
  const state=OpusControllerTemplates.capture({family:target.family,settings:target.settings,components:target.components},name);if(!state.ok)return state;
  if(controllerTemplates.length>=128)return {ok:false,reason:'At most 128 saved controller templates.'};
  if(controllerTemplates.some(record=>record?.name===state.record.name))return {ok:false,reason:'Choose a unique name; existing settings were not replaced.'};
  pushUndo();controllerTemplates.push(state.record);return {ok:true};
}
function importControllerTemplate(raw) {
  if(playMode)return {ok:false,reason:'Stop Play before importing settings.'};
  if(controllerTemplates.length>=128)return {ok:false,reason:'At most 128 saved controller templates.'};
  let record;try{record=JSON.parse(typeof raw==='string'?raw:JSON.stringify(raw));}catch{return {ok:false,reason:'Choose a valid JSON file.'};}
  if(JSON.stringify(record).length>65536)return {ok:false,reason:'Choose a template smaller than 64 KiB.'};
  if(controllerTemplates.some(entry=>JSON.stringify(entry)===JSON.stringify(record)))return {ok:false,reason:'This record is already saved.'};
  const state=OpusControllerTemplates.inspect(record);
  if(state.ok&&controllerTemplates.some(entry=>OpusControllerTemplates.inspect(entry).ok&&entry.name===record.name))return {ok:false,reason:'Choose a distinct template name.'};
  pushUndo();controllerTemplates.push(record);return {ok:true,...(!state.ok?{warning:state.reason}:{})};
}
function controllerTemplateCandidate(record) {
  const target=controllerTemplateTarget();if(!target.ok)return target;
  return {...OpusControllerTemplates.candidate({family:target.family,settings:target.settings,components:target.components},record),item:target.item};
}
function applyControllerTemplate(record) {
  if(playMode)return {ok:false,reason:'Stop Play before applying settings.'};
  const result=controllerTemplateCandidate(record);if(!result.ok||!result.changed)return result;
  pushUndo();currentPlayerSettings=result.settings;if(result.item)result.item.components=result.components;
  renderPlayerSettingsPanel();renderInspector();validateCurrentProject();return {ok:true,changed:true};
}
function removeControllerTemplate(index) {
  if(playMode||!Number.isInteger(index)||index<0||index>=controllerTemplates.length)return false;
  pushUndo();controllerTemplates.splice(index,1);return true;
}
function renderControllerTemplateLibrary() {
  const host=document.getElementById('controller-template-library');if(!host)return;
  const target=controllerTemplateTarget(),choices=controllerTemplates.slice(0,128);
  host.innerHTML=`<summary>Controller settings library</summary><p class="field-help">Reuse movement tuning on this level’s current Player of the same style. Input Actions, Player identity, art, body/collision, Camera, context and health stay unchanged. Use Player Builder for setup and Prefabs for whole characters.</p><label>Save current settings<input id="controller-template-name" class="field-input" maxlength="80" placeholder="e.g. Nimble platformer"></label><button id="controller-template-capture" class="toolbar-btn">Save controller settings</button><label>Choose saved settings<select id="controller-template-select" class="field-input"><option value="">Choose template…</option>${choices.map((record,index)=>`<option value="${index}">${escapeHtml(typeof record?.name==='string'&&record.name.trim()&&record.name.length<=80?record.name:'Unavailable retained record')} · ${escapeHtml(['hovercraft','topdown','thirdperson','firstperson','platformer2d','topdown2d'].includes(record?.family)?({hovercraft:'Hovercraft',topdown:'Top-down 3D',thirdperson:'Third-person',firstperson:'First-person',platformer2d:'2D Platformer',topdown2d:'Top-down 2D'}[record.family]):'unknown style')}</option>`).join('')}</select></label><p id="controller-template-preview" class="field-help">${escapeHtml(target.ok?'Choose settings to review.':target.reason)}</p><div class="camera-template-actions"><button id="controller-template-apply" class="toolbar-btn" disabled>Apply settings</button><button id="controller-template-remove" class="toolbar-btn" disabled>Remove saved template</button><button id="controller-template-export" class="toolbar-btn" disabled>Export JSON</button><button id="controller-template-import" class="toolbar-btn">Import JSON</button></div><input hidden type="file" id="controller-template-file" accept=".json,application/json"><p id="controller-template-status" class="field-help" role="status">Captured abilities must already be attached. Abilities absent from the template stay unchanged. Apply is one Undo step.</p>`;
  const q=id=>host.querySelector('#controller-template-'+id),chosen=()=>q('select').value===''?null:choices[Number(q('select').value)],status=text=>q('status').textContent=text;
q('select').onchange=()=>{const record=chosen(),state=controllerTemplateCandidate(record);q('apply').disabled=playMode||!state.ok||!state.changed;q('remove').disabled=playMode||q('select').value==='';q('export').disabled=q('select').value==='';q('preview').textContent=state.ok?`${record.name}: ${Object.entries(record.tuning).map(([key,value])=>({moveSpeed:'Movement speed',acceleration:'Acceleration',gravity:'Gravity',jumpSpeed:'Jump speed',jumpEnabled:'Jump enabled',rotateToMovement:'Turn toward movement',steeringRate:'Steering rate',boostImpulse:'Boost impulse',boostAcceleration:'Boost acceleration',boostMaxSpeed:'Maximum boost speed',drag:'Drag'}[key]||key)+' '+value).join(', ')}. Captured abilities: ${Object.keys(record.abilities||{}).join(', ')||'none (keep existing)'}. ${state.changed?'Ready to apply tuning only.':'Already identical; no history entry needed.'}`:record?state.reason:target.ok?'Choose settings to review.':target.reason;};
  q('capture').disabled=playMode||!target.ok;q('name').disabled=playMode;q('import').disabled=playMode;
  q('capture').onclick=()=>{const result=captureControllerTemplate(q('name').value);if(result.ok)renderControllerTemplateLibrary();else status(result.reason);};
  q('apply').onclick=()=>{const result=applyControllerTemplate(chosen());if(!result.ok)status(result.reason);else if(!result.changed)status('Settings unchanged; no Undo entry.');};
  q('remove').onclick=()=>{if(removeControllerTemplate(Number(q('select').value)))renderControllerTemplateLibrary();};
  q('export').onclick=()=>{if(q('select').value==='')return;const url=URL.createObjectURL(new Blob([JSON.stringify(chosen(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='controller-template.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
  q('import').onclick=()=>{if(!playMode)q('file').click();};
  q('file').onchange=async()=>{const file=q('file').files[0];if(!file)return;if(file.size>65536){status('Choose a template smaller than 64 KiB.');return;}const result=importControllerTemplate(await file.text());if(result.ok){renderControllerTemplateLibrary();showStatus(result.warning||'Controller settings imported.');}else status(result.reason);};
}
// Authoring package only; playback remains the canonical level Sequence runtime.
function createCinematicTemplateRecord(name, records, sequence) {
  const bad=reason=>({ok:false,reason});
  if(typeof name!=='string'||!name.trim()||name.trim().length>80)return bad('Choose a cinematic name of 1–80 characters.');
  if(!Array.isArray(records)||records.length<3||records.length>128||!sequence||!Array.isArray(sequence.steps)||!sequence.steps.length||sequence.steps.length>128)return bad('Choose a Camera, Path and its points with a nonempty Sequence; at most 128 records and steps.');
  const visiting=new Set();let nodes=0;
  const finite=(value,depth=0)=>{
    if(++nodes>100000||depth>40)return false;
    if(typeof value==='number')return Number.isFinite(value);
    if(value&&typeof value==='object'){
      if(visiting.has(value))return false;visiting.add(value);
      const ok=Object.values(value).every(child=>finite(child,depth+1));visiting.delete(value);return ok;
    }
    return value===null||['string','boolean','undefined'].includes(typeof value);
  };
  if(!finite(records)||!finite(sequence))return bad('Retain unavailable nonfinite data for explicit repair before capture.');
  let serialized;try{serialized=JSON.stringify({records,sequence});}catch(_){return bad('Unavailable cyclic authoring data.');}
  if(serialized.length>1048576)return bad('Cinematic templates must fit within 1 MiB.');
  const ids=new Set(),kinds=new Map();
  for(const r of records){
    if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||!['camera','path','cube'].includes(r.kind))return bad('Choose uniquely identified Cameras, Paths and Cube points/targets only.');
    if(r.behaviors?.length||r.graph||r.components&&Object.keys(r.components).some(k=>!['transform','visual'].includes(k))||r.parentId||r.socketName||r.ai||r.patrol||r.spin||r.assetId||r.textureAssetId||r.components?.visual?.textureAssetRef||r.materialAssetId)return bad('This bounded library supports plain transform/visual records, not gameplay, asset, parent or socket ownership. Keep the original assembly.');
    ids.add(r.id);kinds.set(r.id,r.kind);
  }
  if(!records.some(r=>r.kind==='camera')||!records.some(r=>r.kind==='path'))return bad('Include a Camera and a Path.');
  for(const r of records){
    if(r.kind==='path'&&(!Array.isArray(r.pointIds)||r.pointIds.length<2||r.pointIds.some(id=>kinds.get(id)!=='cube')))return bad('Include every Path point in the cinematic assembly.');
    if(r.kind==='camera'&&(r.options?.lookAtTargetId&&!ids.has(r.options.lookAtTargetId)||r.options?.targetGroup?.targetIds?.some(id=>!ids.has(id))))return bad('Include all Camera targets; external references are not rebound.');
  }
  for(const s of sequence.steps){
    if(s?.kind==='delay'){if(typeof s.seconds!=='number'||!Number.isFinite(s.seconds)||s.seconds<0||s.seconds>3600)return bad('Choose finite waits from 0 to 3600 seconds.');continue;}
    if(s?.kind!=='action'||!['changeCamera','playCameraPath'].includes(s.actionType)||!s.params||typeof s.params!=='object'||Array.isArray(s.params))return bad('This bounded library supports Camera changes, Camera Path playback and waits only.');
    const p=s.params;
    if(s.actionType==='changeCamera'){
      if(kinds.get(p.cameraId)!=='camera'||Object.keys(p).some(k=>!['cameraId','blendSeconds'].includes(k))||p.blendSeconds!==undefined&&(typeof p.blendSeconds!=='number'||p.blendSeconds<0||p.blendSeconds>10))return bad('Choose an included Camera and a blend from 0 to 10 seconds.');
    }else{
      if(kinds.get(p.pathId)!=='path'||Object.keys(p).some(k=>!['pathId','duration','loop','lookMode','lookAtTargetId','fixedTargetX','fixedTargetY','fixedTargetZ','returnToPrevious'].includes(k))||typeof p.duration!=='number'||p.duration<=0||p.duration>3600||p.loop!==undefined&&p.loop!==false||p.returnToPrevious!==undefined&&typeof p.returnToPrevious!=='boolean')return bad('Choose an included Path and a finite non-looping duration up to 3600 seconds.');
      if(!['alongPath','fixedTarget','lookAtObject'].includes(p.lookMode))return bad('Choose an explicit supported Camera Path look mode.');
      if(p.lookAtTargetId&&!ids.has(p.lookAtTargetId)||p.lookMode==='lookAtObject'&&!ids.has(p.lookAtTargetId))return bad('Include the Camera Path look target; external references are not rebound.');
      if(p.lookMode==='fixedTarget'&&['fixedTargetX','fixedTargetY','fixedTargetZ'].some(k=>typeof p[k]!=='number'||!Number.isFinite(p[k])))return bad('Choose finite fixed-target X, Y and Z.');
    }
  }
  const detached=JSON.parse(serialized);
  return {ok:true,record:{kind:'CinematicTemplate',version:1,name:name.trim(),records:detached.records,sequence:detached.sequence}};
}
function prepareCinematicTemplatePlacement(record, position) {
  if(record?.kind!=='CinematicTemplate'||record.version!==1)return {ok:false,reason:'Unavailable retained cinematic template.'};
  const state=createCinematicTemplateRecord(record.name,record.records,record.sequence);if(!state.ok)return state;
  if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return {ok:false,reason:'Choose finite placement X, Y and Z.'};
  const camera=state.record.records.find(r=>r.kind==='camera'),origin=camera.position||camera.options?.position;
  if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isFinite))return {ok:false,reason:'Choose an available Camera placement.'};
  const delta=position.map((v,i)=>v-origin[i]);
  for(const r of state.record.records){const p=r.position||r.options?.position;if(r.kind!=='path'&&(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))return {ok:false,reason:'Retain unavailable object placement for repair.'};}
  const remapped=remapObjectIds(state.record.records,{sequence:state.record.sequence});
  const groups=new Map();for(const r of remapped.objects)if(r.groupId){if(!groups.has(r.groupId))groups.set(r.groupId,generateGroupId());r.groupId=groups.get(r.groupId);}
  for(const r of remapped.objects){const p=r.position||r.options?.position;if(p)for(let i=0;i<3;i++)p[i]+=delta[i];if(r.components?.transform?.position&&p)r.components.transform.position=p.slice();if(r.kind==='camera')r.isActiveCamera=false;}
  const sequence=remapped.extra.sequence;sequence.id=generateSequenceId();
  const base=state.record.name;let suffix=1;sequence.name=base;while(currentSequences.some(s=>s?.name===sequence.name))sequence.name=base+' '+(++suffix);
  for(const step of sequence.steps)if(step.actionType==='playCameraPath'&&step.params.lookMode==='fixedTarget')for(const [i,k] of ['fixedTargetX','fixedTargetY','fixedTargetZ'].entries())step.params[k]+=delta[i];
  return {ok:true,records:remapped.objects,sequence};
}
function captureCinematicTemplate(name) {
  if(playMode)return {ok:false,reason:'Stop Play before capturing a cinematic.'};
  const items=[...selectedItems].filter(item=>placed.includes(item));
  const state=createCinematicTemplateRecord(name,items.map(serializeItemRecord),findSequenceById(selectedSequenceId));if(!state.ok)return state;
  if(cinematicTemplates.length>=128||cinematicTemplates.some(r=>r?.name===state.record.name))return {ok:false,reason:'Choose a unique name; at most 128 cinematic templates.'};
  pushUndo();cinematicTemplates.push(state.record);return {ok:true};
}
function insertCinematicTemplate(record,position) {
  if(playMode)return {ok:false,reason:'Stop Play before inserting a cinematic.'};
  const state=prepareCinematicTemplatePlacement(record,position);if(!state.ok)return state;
  try{validateImportedSceneRecords(state.records,'Cinematic template');}catch(error){return {ok:false,reason:error.message};}
  pushUndo();const items=state.records.map(r=>{const item=r.kind==='cube'?instantiateCubeRecord(r,new Opus.Vec3(...r.position)):instantiateItemFromRecord(r);item.id=r.id;item.name=r.name;item.groupId=r.groupId;return item;});items.forEach(addPlaced);
  currentSequences.push(state.sequence);selectedSequenceId=state.sequence.id;selectedItems=new Set(items);selectedItem=items.find(i=>i.kind==='camera')||items[0];
  renderSceneList();renderInspector();renderSequencePanel();return {ok:true,sequenceId:state.sequence.id};
}
function renderCinematicTemplateLibrary() {
  const host=document.getElementById('cinematic-template-library');if(!host)return;
  host.innerHTML=`<summary>Cinematic template library</summary><p class="field-help">Select the Camera, Path, every point and look target in Scene, then choose the Sequence above. Captures Camera changes, non-looping Path playback and waits only. Gameplay, parent/socket bindings and outside targets are refused without rewriting originals.</p><label>Name<input id="cinematic-name" class="field-input" maxlength="80"></label><button id="cinematic-capture" class="toolbar-btn">Capture selected cinematic</button><label>Saved cinematic<select id="cinematic-select"><option value="">Choose template…</option>${cinematicTemplates.slice(0,128).map((r,i)=>`<option value="${i}">${escapeHtml(typeof r?.name==='string'?r.name.slice(0,80):'Unavailable retained record')}</option>`).join('')}</select></label><p class="field-help">Insert at Camera X, Y, Z. Objects and fixed XYZ look targets move together. Each insertion creates independent objects and a new editable Sequence.</p><div class="field-triple"><input id="cinematic-x" type="number" value="0" aria-label="Cinematic X"><input id="cinematic-y" type="number" value="4" aria-label="Cinematic Y"><input id="cinematic-z" type="number" value="10" aria-label="Cinematic Z"></div><button id="cinematic-insert" class="toolbar-btn">Insert cinematic</button><p id="cinematic-status" class="field-help" role="status">No automatic playback. Use an Object’s On Signal → Play Sequence to start the inserted named Sequence without Script. Pause/Restart use the existing Sequence lifecycle.</p>`;
  const q=id=>host.querySelector('#cinematic-'+id);
  q('capture').onclick=()=>{const result=captureCinematicTemplate(q('name').value);if(result.ok)renderCinematicTemplateLibrary();else q('status').textContent=result.reason;};
  q('insert').onclick=()=>{const record=q('select').value===''?null:cinematicTemplates[Number(q('select').value)];const result=insertCinematicTemplate(record,['x','y','z'].map(k=>q(k).value.trim()===''?NaN:Number(q(k).value)));if(!result.ok)q('status').textContent=result.reason;else document.getElementById('cinematic-status').textContent='Inserted independent objects and Sequence. Choose the new named Sequence in an On Signal → Play Sequence owner.';};
  q('capture').disabled=playMode;q('insert').disabled=playMode;
}
function copyCameraTemplateLibrary(raw) { return JSON.parse(JSON.stringify(Array.isArray(raw)?raw:[])); }
function inspectCameraTemplate(record) {
  const bad=reason=>({ok:false,reason});
  if(!record||typeof record!=='object'||Array.isArray(record)||record.kind!=='CameraSettingsTemplate'||record.version!==1||typeof record.name!=='string'||!record.name.trim()||record.name.length>80||!record.options||typeof record.options!=='object'||Array.isArray(record.options))return bad('Unavailable Camera template format. Retained data can still be exported.');
  if(Object.keys(record).some(key=>!['kind','version','name','options'].includes(key)))return bad('Unknown template fields are retained but cannot be applied.');
  const options=record.options,known=['version','position','rotationDegrees','mode','projection','fovDegrees','orthographicHeight','near','far','chase','lookAtTargetId','obstruction','targetGroup'];
  if(Object.keys(options).some(key=>!known.includes(key)))return bad('Unknown Camera settings are retained but cannot be applied.');
  for(const key of ['position','rotationDegrees'])if(!options[key]||typeof options[key]!=='object'||Array.isArray(options[key])||Object.keys(options[key]).some(axis=>!['x','y','z'].includes(axis))||['x','y','z'].some(axis=>typeof options[key][axis]!=='number'||!Number.isFinite(options[key][axis])))return bad('Camera placement data must contain finite X, Y and Z values.');
  for(const key of ['near','far','orthographicHeight'])if(typeof options[key]!=='number'||!Number.isFinite(options[key]))return bad('Camera framing and clip values must be finite numbers.');
  for(const [key,allowed]of [['chase',['distance','height','pitch','lerpSpeed','rotationLerpSpeed','lookAhead','bearingMode','bearingYaw']],['obstruction',['enabled','radius','padding']],['targetGroup',['enabled','targetIds','padding']]])if(options[key]&&Object.keys(options[key]).some(field=>!allowed.includes(field)))return bad('Unknown Camera settings are retained but cannot be applied.');
  if(options.lookAtTargetId!=null&&options.lookAtTargetId!==''||options.targetGroup?.targetIds?.length)return bad('Bound Camera references cannot be shared as settings. Use a whole-assembly Prefab for bound Cameras and targets.');
  if(!['orbit','chase','fixed','followLookAt'].includes(options.mode)||typeof options.fovDegrees!=='number'||!Number.isFinite(options.fovDegrees)||options.fovDegrees<=0||options.fovDegrees>=180)return bad('Choose a supported Camera mode and finite field of view between 0 and 180 degrees.');
  if(validateCameraOptions(options).length)return bad(validateCameraOptions(options)[0].message);
  for(const key of ['distance','height','lerpSpeed','rotationLerpSpeed'])if(typeof options.chase?.[key]!=='number'||!Number.isFinite(options.chase[key])||options.chase[key]<=0)return bad('Chase distance, height and smoothing must be finite and positive.');
  for(const key of ['pitch','lookAhead','bearingYaw'])if(typeof options.chase?.[key]!=='number'||!Number.isFinite(options.chase[key]))return bad('Chase angles and velocity lead must be finite.');
  if(options.version!==CAMERA_RECORD_VERSION)return bad('Unavailable Camera settings version retained.');
  return {ok:true,record:JSON.parse(JSON.stringify(record))};
}
function builtInCameraTemplates() {
  return [['camera2d','2D orthographic'],['cameraThirdPerson','Third-person follow'],['cameraTopDown','Top-down map'],['cameraIsometric','Isometric follow']].map(([type,name])=>({kind:'CameraSettingsTemplate',version:1,name,options:JSON.parse(JSON.stringify(cameraBuiltPresetOptions(type)))}));
}
function captureCameraTemplate(item,name) {
  if(playMode||item?.kind!=='camera')return {ok:false,reason:'Select a Camera while editing.'};
  if(typeof name!=='string'||!name.trim()||name.trim().length>80)return {ok:false,reason:'Enter a template name up to 80 characters.'};
  if(item.options?.version!==undefined&&item.options.version!==CAMERA_RECORD_VERSION||validateCameraOptions(item.options).length)return {ok:false,reason:'Saved Camera settings are unavailable or invalid; keep the original data for recovery.'};
  const normalized=normalizeCameraOptions(item.options),options={};
  for(const key of ['version','position','rotationDegrees','mode','projection','fovDegrees','orthographicHeight','near','far','chase','lookAtTargetId','obstruction','targetGroup'])options[key]=normalized[key];
  const record={kind:'CameraSettingsTemplate',version:1,name:name.trim(),options:JSON.parse(JSON.stringify(options))};
  const state=inspectCameraTemplate(record);if(!state.ok)return state;
  if(cameraTemplates.length>=128)return {ok:false,reason:'At most 128 saved Camera templates.'};
  if(cameraTemplates.some(entry=>entry?.name===record.name))return {ok:false,reason:'Choose a unique name. Existing templates were not replaced.'};
  pushUndo();cameraTemplates.push(state.record);return {ok:true};
}
function importCameraTemplate(raw) {
  if(playMode)return {ok:false,reason:'Stop Play before importing settings.'};
  if(cameraTemplates.length>=128)return {ok:false,reason:'At most 128 saved Camera templates.'};
  let record;try{record=JSON.parse(typeof raw==='string'?raw:JSON.stringify(raw));}catch(error){return {ok:false,reason:'Choose a valid JSON file.'};}
  if(JSON.stringify(record).length>1048576)return {ok:false,reason:'A Camera template must fit within 1 MiB.'};
  if(cameraTemplates.some(entry=>JSON.stringify(entry)===JSON.stringify(record)))return {ok:false,reason:'This record is already in the library.'};
  const state=inspectCameraTemplate(record);
  if(state.ok&&cameraTemplates.some(entry=>inspectCameraTemplate(entry).ok&&entry.name===record.name))return {ok:false,reason:'A Camera template already uses this name. Existing settings were not replaced; choose a distinct name before importing.'};
  pushUndo();cameraTemplates.push(record);return {ok:true,...(!state.ok?{warning:state.reason}:{})};
}
function applyCameraTemplate(item,record) {
  if(playMode||item?.kind!=='camera')return false;
  if(item.options?.version!==undefined&&item.options.version!==CAMERA_RECORD_VERSION)return false;
  const state=inspectCameraTemplate(record);if(!state.ok)return false;
  if(validateCameraOptions(item.options).length)return false;
  const prior=normalizeCameraOptions(item.options),source=state.record.options,next={...prior};
  for(const key of ['mode','projection','fovDegrees','orthographicHeight','near','far'])next[key]=source[key];
  next.chase={...prior.chase,...source.chase};next.obstruction={...prior.obstruction,...source.obstruction};
  next.targetGroup=JSON.parse(JSON.stringify(prior.targetGroup));
  if(validateCameraOptions(next).length||JSON.stringify(next)===JSON.stringify(prior))return false;
  pushUndo();item.options=next;refreshCameraView(item);return true;
}
function removeCameraTemplate(index) {
  if(playMode||!Number.isInteger(index)||index<0||index>=cameraTemplates.length)return false;
  pushUndo();cameraTemplates.splice(index,1);return true;
}
function renderCameraTemplateLibrary(item) {
  const host=document.getElementById('camera-template-library');if(!host)return;
  const built=builtInCameraTemplates(),choices=[...built,...cameraTemplates.slice(0,128)];
  host.innerHTML=`<summary>Camera settings library</summary><p class="field-help">Apply reusable settings to this Camera. Position, rotation, name, activation and local target references stay unchanged. Bound Camera rigs belong in whole-assembly Prefabs. Named templates contain settings, not new cameras.</p><label>Save current settings<input class="field-input" id="camera-template-name" maxlength="80" placeholder="e.g. Exploration follow"></label><button class="toolbar-btn" id="camera-template-capture">Save Camera settings</button><label>Choose settings<select class="field-input" id="camera-template-select"><option value="">Choose template…</option>${choices.map((entry,index)=>`<option value="${index}">${index<built.length?'Built-in · ':''}${escapeHtml(entry?.name||'Unavailable retained record')}</option>`).join('')}</select></label><p class="field-help" id="camera-template-preview">Choose a named template.</p><div class="camera-template-actions"><button class="toolbar-btn" id="camera-template-apply" disabled>Apply settings</button><button class="toolbar-btn" id="camera-template-remove" disabled>Remove saved template</button><button class="toolbar-btn" id="camera-template-export" disabled>Export JSON</button><button class="toolbar-btn" id="camera-template-import">Import JSON</button></div><input hidden type="file" id="camera-template-file" accept=".json,application/json"><p class="field-help" id="camera-template-status" role="status">No automatic activation. Make Active Camera remains an explicit choice.</p>`;
  const q=id=>host.querySelector('#camera-template-'+id),chosen=()=>q('select').value===''?null:choices[Number(q('select').value)],status=text=>{q('status').textContent=text;};
  q('select').onchange=()=>{const record=chosen(),state=inspectCameraTemplate(record);q('apply').disabled=playMode||!state.ok;q('remove').disabled=playMode||q('select').value===''||Number(q('select').value)<built.length;q('export').disabled=q('select').value==='';q('preview').textContent=state.ok?`${record.name}: ${record.options.mode}, ${record.options.projection}; ${record.options.projection==='orthographic'?'vertical span '+record.options.orthographicHeight:'field of view '+record.options.fovDegrees+'°'}. Placement and activation stay unchanged.`:record?state.reason:'Choose a named template.';};
  q('capture').onclick=()=>{const result=captureCameraTemplate(item,q('name').value);if(result.ok){renderInspector();}else status(result.reason);};
  q('apply').onclick=()=>{if(applyCameraTemplate(item,chosen())){renderInspector();showStatus('Camera settings applied. Placement and activation preserved.');}else status('Settings unchanged. Stop Play and choose available settings compatible with this Camera; saved references are retained.');};
  q('remove').onclick=()=>{if(removeCameraTemplate(Number(q('select').value)-built.length))renderInspector();};
  q('export').onclick=()=>{const record=chosen();if(q('select').value==='')return;const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='camera-template.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
  q('import').onclick=()=>{if(!playMode)q('file').click();};
  q('file').onchange=async()=>{const file=q('file').files[0];if(!file)return;if(file.size>1048576){status('Choose a Camera template file no larger than 1 MiB.');return;}const result=importCameraTemplate(await file.text());if(result.ok){renderInspector();showStatus(result.warning||'Camera template imported.');}else status(result.reason);};
  for(const id of ['name','capture','import'])q(id).disabled=playMode;
}
function copyUiTemplateLibrary(input) {
  return typeof OpusUiTemplates === 'undefined' ? JSON.parse(JSON.stringify(Array.isArray(input) ? input : [])) : OpusUiTemplates.library(input);
}
function importHudTemplateRecord(raw) {
  if (playMode || typeof OpusUiTemplates === 'undefined') return {ok:false,reason:'Stop Play before editing the UI library.'};
  const state = OpusUiTemplates.inspect(raw);
  if (!state.ok) return state;
  if (uiTemplates.length >= 128) return {ok:false,reason:'At most 128 saved UI templates.'};
  if (uiTemplates.some(entry => entry?.name === state.template.name)) return {ok:false,reason:'Choose a unique template name; existing templates were not replaced.'};
  pushUndo(); uiTemplates.push(state.template);
  if (typeof renderHudTemplateLibrary === 'function') renderHudTemplateLibrary();
  return {ok:true,template:state.template};
}
function captureHudTemplate(name) {
  if (playMode || typeof OpusUiTemplates === 'undefined') return {ok:false,reason:'Stop Play before capturing authored UI.'};
  const state = OpusUiTemplates.capture(name,currentUiConfig.hudElements);
  return state.ok ? importHudTemplateRecord(state.template) : state;
}
function unavailableHudTemplateKinds(template) {
  return [...new Set(template.elements.filter(element => !Object.prototype.hasOwnProperty.call(HUD_KIND_LABELS,element.kind)).map(element => element.kind))];
}
function insertHudTemplate(index, offsetX = 0, offsetY = 0) {
  if (playMode || typeof OpusUiTemplates === 'undefined') return {ok:false,reason:'Stop Play before inserting UI.'};
  if (!Number.isInteger(index) || index < 0 || index >= uiTemplates.length) return {ok:false,reason:'Choose a saved template.'};
  if (![offsetX,offsetY].every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000000)) return {ok:false,reason:'Offsets must be finite numbers within ±1000000.'};
  const checked = OpusUiTemplates.inspect(uiTemplates[index]);
  if (!checked.ok) return checked;
  const unavailable = unavailableHudTemplateKinds(checked.template);
  if (unavailable.length) return {ok:false,reason:'This group contains unavailable HUD types: '+unavailable.join(', ')+'. Retained data is unchanged; nothing was inserted.'};
  const oldIds = new Set(checked.template.elements.map(element => element.id));
  const state = OpusUiTemplates.instantiate(checked.template,{allocateId:() => {
    let id; do { id = generateHudElementId(); } while (oldIds.has(id)); return id;
  },actionFields:name => ACTION_TYPES[name]?.fields});
  if (!state.ok) return state;
  if (state.warnings.some(warning => warning.field && warning.reason.startsWith('External HUD reference'))) return {ok:false,reason:'This group references HUD outside the template. Include that target in the captured group or repair the source Action before capture; no unrelated HUD was rebound.'};
  for (const element of state.elements) for (const [key,delta] of [['offsetX',offsetX],['offsetY',offsetY]]) {
    if (delta === 0) continue;
    const base = element[key] === undefined ? 0 : element[key];
    if (typeof base !== 'number' || !Number.isFinite(base) || Math.abs(base + delta) > 1000000) return {ok:false,reason:'Template has an unavailable placement offset; no elements were inserted.'};
    element[key] = base + delta;
  }
  // Move HUD endpoints share anchor-offset coordinates with their internal target.
  for (const element of state.elements) if (element.kind === 'button' && element.buttonAction === 'moveHudTo') {
    for (const [key,delta] of [['x',offsetX],['y',offsetY]]) {
      if (delta === 0) continue;
      const value = element.buttonParams?.[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value + delta) > 1000000) return {ok:false,reason:'Repair the template Move HUD endpoint before offset placement; nothing was inserted.'};
      element.buttonParams[key] = value + delta;
    }
  }
  pushUndo(); currentUiConfig.hudElements.push(...state.elements); renderHudElementList();
  return state;
}
function removeHudTemplate(index) {
  if (playMode || !Number.isInteger(index) || index < 0 || index >= uiTemplates.length) return false;
  pushUndo(); uiTemplates.splice(index,1);
  if (typeof renderHudTemplateLibrary === 'function') renderHudTemplateLibrary();
  return true;
}
function renderHudTemplateLibrary(preferredIndex) {
  const host = document.getElementById('ui-template-library');
  if (!host || typeof OpusUiTemplates === 'undefined') return;
  const previousName = host.querySelector('#ui-template-name')?.value || '';
  const previousChoice = host.querySelector('#ui-template-select')?.value || '';
  const choice = Number.isInteger(preferredIndex) ? String(preferredIndex) : previousChoice;
  host.innerHTML = `<p class="field-help">Capture the current HUD as an independent reusable group. Inserting adds elements; it does not replace screens or menus. References and local assets belong to this project.</p><label>Group name<input id="ui-template-name" class="field-input" maxlength="80" placeholder="e.g. Adventure HUD"></label><button id="ui-template-capture" class="toolbar-btn" type="button">Capture current HUD</button><label>Saved group<select id="ui-template-select" class="field-input"><option value="">Choose saved group</option>${uiTemplates.slice(0,128).map((entry,index)=>`<option value="${index}">${escapeHtml(String(entry?.name || 'Unavailable group'))}</option>`).join('')}</select></label><div id="ui-template-preview" style="margin:8px 0"></div><div style="display:flex;gap:8px"><label>Offset X<input id="ui-template-offset-x" class="field-input" type="number" min="-1000000" max="1000000" value="0"></label><label>Offset Y<input id="ui-template-offset-y" class="field-input" type="number" min="-1000000" max="1000000" value="0"></label></div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><button id="ui-template-insert" class="toolbar-btn" type="button">Insert independent group</button><button id="ui-template-export" class="toolbar-btn" type="button">Export group JSON</button><button id="ui-template-import" class="toolbar-btn" type="button">Import group JSON</button><button id="ui-template-delete" class="toolbar-btn" type="button">Delete saved group</button></div><input id="ui-template-file" type="file" accept=".json,application/json" hidden><p class="field-help" id="ui-template-status" role="status">Inserted groups are independent. JSON carries settings and project-local references, not foreign assets.</p>`;
  const q = id => host.querySelector('#ui-template-'+id), select = q('select');
  q('name').value = previousName; select.value = choice;
  const selectedIndex = () => select.value === '' ? -1 : Number(select.value);
  const selected = () => uiTemplates[selectedIndex()];
  const status = result => { q('status').textContent = result.ok ? 'Saved or inserted successfully. Instances are independent.' : result.reason; };
  q('capture').disabled = playMode || !currentUiConfig.hudElements.length;
  q('name').disabled = playMode; q('import').disabled = playMode;
  q('offset-x').disabled = playMode; q('offset-y').disabled = playMode;
  select.onchange = () => {
    const entry = selected(), state = entry ? OpusUiTemplates.inspect(entry) : null;
    q('insert').disabled = playMode || !state?.ok;
    q('delete').disabled = playMode || selectedIndex() < 0;
    q('export').disabled = selectedIndex() < 0;
    const preview = q('preview'); preview.innerHTML = '';
    if (!state?.ok) { preview.textContent = state ? state.reason+' Retained data is unchanged.' : 'Choose a group to preview its authored layout.'; return; }
    const unavailable = unavailableHudTemplateKinds(state.template);
    if (unavailable.length) { q('insert').disabled = true; preview.textContent = 'Unavailable HUD types: '+unavailable.join(', ')+'. Group retained for JSON export; insertion is disabled.'; return; }
    const summary = document.createElement('p'); summary.className = 'field-help'; summary.textContent = `${state.template.elements.length} elements · authored preview · no Actions run`;
    const frame = document.createElement('div'); Object.assign(frame.style,{position:'relative',width:'256px',maxWidth:'100%',height:'144px',overflow:'hidden',background:'#111d30',border:'1px solid #8195b4'});
    const stage = document.createElement('div'); stage.className = 'ui-template-preview-stage'; stage.setAttribute('inert','');
    Object.assign(stage.style,{position:'absolute',width:'1280px',height:'720px',transform:'scale(.2)',transformOrigin:'top left',pointerEvents:'none'});
    stage.innerHTML = renderHudLayer(true,state.template.elements,false);
    frame.appendChild(stage); preview.append(summary,frame);
    applyHudLayout(stage,{width:1280,height:720},{...currentUiConfig,hudElements:state.template.elements},false);
  };
  q('capture').onclick = () => { const result = captureHudTemplate(q('name').value); if (result.ok) renderHudTemplateLibrary(uiTemplates.length-1); status(result); };
  q('insert').onclick = () => {
    const x=q('offset-x').value,y=q('offset-y').value;
    const result=insertHudTemplate(selectedIndex(),x.trim()===''?NaN:Number(x),y.trim()===''?NaN:Number(y)); status(result);
  };
  q('delete').onclick = () => { if (!removeHudTemplate(selectedIndex())) status({ok:false,reason:'Choose a saved group while editing.'}); };
  q('export').onclick = () => { const entry=selected(); if (entry) downloadTextFile(JSON.stringify(entry,null,2),'hud-group.json'); };
  q('import').onclick = () => { if (!playMode) q('file').click(); };
  q('file').onchange = async () => {
    const file=q('file').files?.[0]; if (!file || playMode) return;
    if (file.size>1048576) { status({ok:false,reason:'Choose a group JSON file no larger than 1 MiB.'}); return; }
    try { const parsed=OpusUiTemplates.parse(await file.text()); const result=parsed.ok?importHudTemplateRecord(parsed.template):parsed; if (result.ok) renderHudTemplateLibrary(uiTemplates.length-1); status(result); }
    catch (_) { status({ok:false,reason:'Could not read the local group file; existing groups were unchanged.'}); }
  };
  select.onchange();
}
function copyComponentPresetLibrary(input) {
  return typeof OpusComponentPresets === 'undefined' ? JSON.parse(JSON.stringify(Array.isArray(input) ? input : [])) : OpusComponentPresets.library(input);
}
try { prefabs = JSON.parse(localStorage.getItem('opus-prefabs') || '[]'); } catch (err) { prefabs = []; }
function savePrefabs() { localStorage.setItem('opus-prefabs', JSON.stringify(prefabs)); }

function renderPrefabPalette() {
  const section = document.getElementById('palette-prefabs');
  const packageTools = '<button type="button" class="toolbar-btn" data-import-prefab-package title="Preview a reusable Asset Pack; keep both copies on conflicts. No scene objects are added.">Import Prefab package…</button><p class="field-help">Packages carry Prefabs and supported dependencies, not scenes or shared logic. Media: static Models, embedded PNG Textures and Audio; SVG/other images and skinned Models need full Project transfer. Preview first; Stop Play first.</p>';
  if (prefabs.length === 0) {
    section.innerHTML = packageTools + '<p style="color:#66759a;font-size:11px;margin:4px 0">Select an object and use Save as Prefab in the Inspector.</p>';
  } else section.innerHTML = packageTools + prefabs.map((p, i) => `
    <div class="palette-item" id="palette-prefab-${i}" style="display:flex;justify-content:space-between;align-items:center;gap:6px">
      <span>◆ ${escapeHtml(p.name)}${p.records && p.records.length > 1 ? ` <span style="color:#66759a;font-size:10px">(${p.records.length})</span>` : ''}</span>
      <button type="button" data-export-prefab-package="${i}" style="padding:1px 6px" title="Preview a package containing this Prefab and supported dependencies">Package…</button>
      <button data-delete-prefab="${i}" style="padding:1px 6px" title="Delete prefab">✕</button>
    </div>
  `).join('');
  section.querySelector('[data-import-prefab-package]').onclick = () => {
    if (playMode) { showStatus('Stop Play before importing a Prefab package.'); return; }
    document.getElementById('import-asset-pack-input').click();
  };
  section.querySelectorAll('[data-export-prefab-package]').forEach(button => {
    const prefab = prefabs[Number(button.dataset.exportPrefabPackage)];
    button.onclick = event => { event.stopPropagation(); previewPrefabPackage(prefab); };
  });
  prefabs.forEach((p, i) => wirePaletteDragSource(`palette-prefab-${i}`, `prefab:${i}`, `◆ ${p.name}`));
  section.querySelectorAll('[data-delete-prefab]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = Number(btn.dataset.deletePrefab); const prefab = prefabs[index]; syncCurrentLevelObjects(); const markerUses = OpusAuthoringPlumbing.spawnMarkerPrefabUsage({ levels }, prefab && prefab.name); const chunkUses = OpusAuthoringPlumbing.tilemapChunkPrefabUsage(tilemapChunks, prefab && prefab.name);
      if ((markerUses.length || chunkUses.length) && !confirm(`Delete Prefab "${prefab.name}"? ${markerUses.length} Tilemap Spawn Marker and ${chunkUses.length} Tilemap Chunk reference${markerUses.length + chunkUses.length === 1 ? '' : 's'} will remain repairable and will not auto-spawn.`)) return;
      prefabs.splice(index, 1);
      savePrefabs();
      renderPrefabPalette();
    });
  });
}

let paletteDragState = null;
let armedPlacementPayload = null;
const paletteGhost = (() => {
  const g = document.createElement('div');
  g.id = 'palette-ghost';
  Object.assign(g.style, {
    position: 'fixed', zIndex: '1000', padding: '8px 14px', borderRadius: '4px',
    background: '#182338', border: '1px solid rgba(255,255,255,0.25)', color: '#dce6f5',
    font: '13px system-ui, sans-serif', pointerEvents: 'none', display: 'none', transform: 'translate(-50%, -50%)',
  });
  document.body.appendChild(g);
  return g;
})();
const placementDropIndicator = (() => {
  const marker = document.createElement('div');
  marker.id = 'placement-drop-indicator';
  marker.setAttribute('aria-hidden', 'true');
  document.body.appendChild(marker);
  return marker;
})();

function setPlacementIndicator(event, visible) {
  placementDropIndicator.classList.toggle('visible', !!visible);
  if (!visible) return;
  placementDropIndicator.style.left = `${event.clientX}px`;
  placementDropIndicator.style.top = `${event.clientY}px`;
}

function beginPlacementPointerDrag(event, payload, label, options) {
  const opts = options || {};
  paletteDragState = {
    payload, label, pointerId: event.pointerId,
    startX: event.clientX, startY: event.clientY,
    started: !!opts.immediate, previewHtml: opts.previewHtml || '',
  };
  if (paletteDragState.started) {
    paletteGhost.textContent = label;
    paletteGhost.style.display = 'block';
    paletteGhost.style.left = `${event.clientX}px`;
    paletteGhost.style.top = `${event.clientY}px`;
  }
  // Claim the pointer immediately so the browser's native image/text drag
  // cannot steal repeated Asset placements. A sub-threshold release below
  // explicitly performs the normal inspect action, preserving click UX.
  event.preventDefault();
}

function cancelPlacementInteraction(message) {
  const hadPlacement = !!paletteDragState || !!armedPlacementPayload;
  paletteDragState = null;
  armedPlacementPayload = null;
  paletteGhost.style.display = 'none';
  paletteGhost.classList.remove('sprite-placement-ghost');
  paletteGhost.innerHTML = '';
  setPlacementIndicator({ clientX: 0, clientY: 0 }, false);
  canvas.classList.remove('placement-armed');
  if (hadPlacement && message) showStatus(message);
}

function applyPlacementSnap(point) {
  const placedPoint = point.clone ? point.clone() : new Opus.Vec3(point.x, point.y, point.z);
  if (gizmoSnap.enabled) {
    placedPoint.x = snapValue(placedPoint.x, gizmoSnap.position);
    placedPoint.y = snapValue(placedPoint.y, gizmoSnap.position);
    placedPoint.z = snapValue(placedPoint.z, gizmoSnap.position);
  }
  return placedPoint;
}

function screenToPlacementPoint(payload,clientX,clientY) {
  const ground=screenToGroundPoint(clientX,clientY);
  if(ground)return {point:ground,plane:'ground'};
  let depth=0;
  if(!OpusAuthoringPlumbing.isSpritePlacementPayload(payload)&&payload?.paletteType!=='sprite') {
    if(typeof payload?.paletteType!=='string'||!/^prefab:\d+$/.test(payload.paletteType))return null;
    const prefab=prefabs[Number(payload.paletteType.slice(7))];
    if(!prefab)return null;
    const records=Array.isArray(prefab.records)&&prefab.records.length?prefab.records:prefab.record?[prefab.record]:[];
    if(!records.length||records.some(record=>{const position=record?.position||record?.options?.position;return !record||record.kind!=='sprite'||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite);}))return null;
    const root=records.find(record=>record.id===prefab.rootId)||records[0],position=root.position||root.options?.position;
    if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return null;
    depth=position[2];
  }
  const point=screenToPlanePoint(clientX,clientY,new Opus.Vec3(0,0,depth),new Opus.Vec3(0,0,1));
  return point?{point,plane:'xy'}:null;
}
function commitPlacementPayload(payload, point, placementOptions) {
  const placementPoint = applyPlacementSnap(point);
  if(placementOptions?.plane==='xy')placementPoint.z=point.z; // snap XY authoring coordinates, not the chosen layer depth
  if (OpusAuthoringPlumbing.isSpritePlacementPayload(payload)) {
    const asset = findSpriteAssetById(payload.assetId); // stable ID resolved only at commit
    if (!asset) { showStatus(`Sprite Asset ${payload.assetId} is unavailable; nothing was placed`); return null; }
    if(placementOptions?.plane!=='xy')placementPoint.y = 1; // historical ground placement height
    return placeSpriteAssetInstance(asset, placementPoint);
  }
  if (payload && typeof payload.libraryModel === 'string') { addContentLibraryModel(payload.libraryModel, placementPoint); return null; } // Content Library drag (loads asynchronously)
  if (payload && payload.paletteType) { placeItem(payload.paletteType, placementPoint,placementOptions); return selectedItem; }
  return null;
}

function armPlacement(payload, label) {
  cancelPlacementInteraction();
  armedPlacementPayload = payload;
  canvas.classList.add('placement-armed');
  showStatus(`${label || 'Object'} ready — click the viewport to place; Escape cancels`);
}

// Shared by the fixed palette entries and the dynamically-rendered prefab
// list -- one pointer-based drag-start wiring for both, so a prefab drags
// exactly like a built-in palette item instead of needing its own path.
function wirePaletteDragSource(elId, type, label) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (playMode || e.target.closest('[data-delete-prefab], [data-export-prefab-package]')) return;
    beginPlacementPointerDrag(e, { paletteType: type }, label, { immediate: true });
  });
}

for (const type of PLACEABLE_TYPES) {
  wirePaletteDragSource(`palette-${type}`, type, PALETTE_LABELS[type]);
}
renderPrefabPalette();

