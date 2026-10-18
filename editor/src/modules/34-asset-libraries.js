// --- Export / Save / Load ---

const statusEl = document.getElementById('status-msg');
let statusTimer = null;
function showStatus(text) {
  statusEl.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 2000);
}

// Save/Load, Export, and Undo/Redo all reuse serializeScene/loadScene, so a
// cube's mesh identity has to round-trip through all of them, not just stay
// correct in the live session. The three built-ins are cheap to tag by
// name; anything else (an imported glTF model, or any future custom mesh)
// round-trips its actual geometry via Opus.Mesh.toArrays/fromArrays -- the
// same pair fromGLTF itself is built on -- since there's no source file
// kept around to re-import from.
// --- Project Asset Library (Wave 3) ---
// One immutable geometry payload per imported model, many lightweight
// references -- the fix for the exact duplication problem Import Model had
// before this: every placed instance embedded its OWN full copy of
// positions/normals/indices (via customMesh), so 20 instances of the same
// 5000-vertex model meant 20 copies in every save/export. An asset's
// `meshHandle` (the real GPU-uploadable Opus.Mesh, built once via
// Mesh.fromArrays) is built lazily and cached -- every instance placed from
// the SAME asset shares the exact same mesh object, the same way cubeMesh/
// mineMesh/boostMesh already do for the built-in shapes.
let assets = [];
let nextAssetId = 1;
function generateAssetId() { return `asset${nextAssetId++}`; }
function reconcileAssetIdCounter(id) {
  const match = /^asset(\d+)$/.exec(id);
  if (match) nextAssetId = Math.max(nextAssetId, Number(match[1]) + 1);
}
function findAssetById(id) { return id ? assets.find((a) => a.id === id) : undefined; }
// Wave 6 (Priority C): a skin's animation clips carry Float32Array times/
// values (what parseSkinnedGLTFToArrays/computeSkinPalette both expect --
// `.subarray()` calls throughout the sampler need a real typed array, not
// a plain object). JSON.stringify/parse does NOT round-trip a typed array
// as one (it serializes as a plain `{"0":1,"1":2,...}` object, silently
// losing every typed-array method) -- these two functions are the ONE
// place that converts between the "plain JSON-safe numbers" shape a saved
// project can actually carry and the "real Float32Array" shape the runtime
// sampler needs, in each direction, so no other code has to know this
// distinction exists.
function flattenSkinForStorage(skin) {
  return {
    jointCount: skin.jointCount,
    inverseBindMatrices: skin.inverseBindMatrices.map((m) => Array.from(m)),
    jointParents: skin.jointParents.slice(),
    jointLocalBind: skin.jointLocalBind.map((b) => ({ translation: b.translation.slice(), rotation: b.rotation.slice(), scale: b.scale.slice() })),
    // Wave 7 (Priority A): joint names, for Bone Sockets -- `|| []` so a
    // hand-built/legacy skin object with no `jointNames` at all (shouldn't
    // happen post-Wave-7 import, but defensive) still serializes without
    // throwing; reviveSkinFromStorage's own fallback covers the READ side
    // for a project saved before this priority existed.
    jointNames: skin.jointNames ? skin.jointNames.slice() : [],
    clips: skin.clips.map((c) => ({
      name: c.name, duration: c.duration,
      tracks: c.tracks.map((t) => ({ jointLocalIndex: t.jointLocalIndex, path: t.path, interpolation: t.interpolation, times: Array.from(t.times), values: Array.from(t.values) })),
    })),
  };
}
function reviveSkinFromStorage(stored) {
  return {
    jointCount: stored.jointCount,
    inverseBindMatrices: stored.inverseBindMatrices,
    jointParents: stored.jointParents,
    jointLocalBind: stored.jointLocalBind,
    // Wave 7 (Priority A): a project saved BEFORE this priority existed has
    // no `jointNames` in its stored skin data at all -- fall back to the
    // same synthetic "joint<i>" naming the importer itself uses for an
    // unnamed rig, so Socket authoring against an old project's already-
    // imported asset still works (just with less legible names), never a
    // crash or a silently empty Bone dropdown.
    jointNames: (stored.jointNames && stored.jointNames.length === stored.jointCount) ? stored.jointNames : stored.jointLocalBind.map((_, i) => `joint${i}`),
    clips: stored.clips.map((c) => ({
      name: c.name, duration: c.duration,
      tracks: c.tracks.map((t) => ({ jointLocalIndex: t.jointLocalIndex, path: t.path, interpolation: t.interpolation, times: new Float32Array(t.times), values: new Float32Array(t.values) })),
    })),
  };
}
function getAssetMeshHandle(asset) {
  if (!asset.meshHandle) {
    asset.meshHandle = asset.type === 'skinnedMesh'
      ? Opus.Mesh.fromSkinnedArrays(
        new Float32Array(asset.positions),
        new Float32Array(asset.normals),
        new Uint16Array(asset.indices),
        asset.uvs ? new Float32Array(asset.uvs) : undefined,
        new Float32Array(asset.joints),
        new Float32Array(asset.weights),
        reviveSkinFromStorage(asset.skin),
      )
      : Opus.Mesh.fromArrays(
        new Float32Array(asset.positions),
        new Float32Array(asset.normals),
        new Uint16Array(asset.indices),
        asset.uvs ? new Float32Array(asset.uvs) : undefined,
      );
  }
  return asset.meshHandle;
}
// Scans every level's OWN serialized objects (not just the currently live
// `placed`) for `mesh: 'asset', assetId` references -- syncs the active
// level first so an in-progress placement not yet saved still counts.
function computeAssetUsageCount(assetId) {
  syncCurrentLevelObjects();
  let count = 0;
  for (const level of levels) {
    for (const record of level.objects) {
      if (record.kind === 'cube' && record.mesh === 'asset' && record.assetId === assetId) count++;
    }
  }
  return count;
}
// Bundles only assets actually referenced somewhere in the project into
// project.assets on Export/Save, same "additive, only what's used" policy
// portable prefabs already established -- an unused import doesn't bloat
// every future export of a project just because it once got imported.
// --- Asset Library search/tags/folders (Wave 4) -- shared across all
// three asset libraries (mesh/texture/audio) rather than three separate
// implementations, since all three already follow the identical id/name/
// usage-count/rename/delete shape. `folder` is a single free-text string
// (a one-level grouping, not a nested tree -- the actual libraries here
// hold tens of assets, not thousands, so a flat folder-as-filter is enough
// without the much larger UI a real folder TREE would need); `tags` is a
// free-text array. Both are optional and default to absent/empty for every
// asset imported before this feature existed -- read defensively via these
// two accessors everywhere, never assumed present.
function assetTagsOf(asset) { return asset.tags || []; }
function assetFolderOf(asset) { return asset.folder || ''; }
let unifiedAssetLibraryReady=false,unifiedAssetLibraryRefreshing=false;
function assetDiscoveryEntries(providers){
  const kinds=['mesh','texture','sprite','sprite-animation','tileset','tilemap-chunk','audio','material'],out=[];
  for(const provider of Array.isArray(providers)?providers:[]){
    const records=Array.isArray(provider?.records)?provider.records:[],counts=new Map();for(const r of records)if(typeof r?.id==='string')counts.set(r.id,(counts.get(r.id)||0)+1);
    records.forEach((r,index)=>{const id=typeof r?.id==='string'?r.id:'',name=typeof r?.name==='string'?r.name:'Unavailable retained record';out.push({kind:provider.kind,label:provider.label||provider.kind,id,name,index,folder:typeof r?.folder==='string'?r.folder:'',tags:Array.isArray(r?.tags)?r.tags.filter(t=>typeof t==='string').slice():[],available:kinds.includes(provider.kind)&&!!id&&counts.get(id)===1&&typeof r?.name==='string'&&!!r.name.trim()});});
  }return out;
}
function assetDiscoveryMatches(record,query,folder){
  if(folder&&record?.folder!==folder)return false;const q=typeof query==='string'?query.trim().toLowerCase():'';if(!q)return true;
  return (typeof record?.name==='string'&&record.name.toLowerCase().includes(q))||(Array.isArray(record?.tags)&&record.tags.some(t=>typeof t==='string'&&t.toLowerCase().includes(q)));
}
function assetDiscoveryProviders(){
  if(!unifiedAssetLibraryReady)return [];
  return [{kind:'mesh',label:'Model',records:assets},{kind:'texture',label:'Texture',records:textureAssets},{kind:'sprite',label:'Sprite',records:spriteAssets},{kind:'sprite-animation',label:'Sprite Animation',records:spriteAnimationClips},{kind:'tileset',label:'Tileset',records:tilesets},{kind:'tilemap-chunk',label:'Tilemap Chunk',records:tilemapChunks},{kind:'audio',label:'Audio',records:audioAssets},{kind:'material',label:'Material',records:materialAssets}];
}
function getAssetDiscoveryFilters(){return {query:document.getElementById('asset-discovery-search')?.value||'',folder:document.getElementById('asset-discovery-folder')?.value||'',kind:document.getElementById('asset-type-filter')?.value||''};}
function renderUnifiedAssetLibrary(){
  if(!unifiedAssetLibraryReady||unifiedAssetLibraryRefreshing)return;const host=document.getElementById('asset-discovery-results');if(!host)return;
  const providers=assetDiscoveryProviders(),rows=assetDiscoveryEntries(providers),filter=getAssetDiscoveryFilters(),folder=document.getElementById('asset-discovery-folder'),folders=[...new Set(rows.map(r=>r.folder).filter(Boolean))].sort();
  folder.innerHTML='<option value="">All folders</option>'+folders.map(f=>`<option value="${escapeHtml(f)}"${f===filter.folder?' selected':''}>${escapeHtml(f)}</option>`).join('')+(filter.folder&&!folders.includes(filter.folder)?`<option selected value="${escapeHtml(filter.folder)}">Unavailable folder — retained filter</option>`:'');
  const matches=rows.filter(r=>(!filter.kind||filter.kind===r.kind)&&assetDiscoveryMatches(r,filter.query,filter.folder));
  document.getElementById('asset-discovery-summary').textContent=matches.length?`${matches.length} matching project asset${matches.length===1?'':'s'} · ${rows.length} total${matches.length>128?' · first128 shown; narrow search':''}`:(rows.length?'No matching assets. Clear filters or import with the type tools below.':'No project assets yet. Choose a type and import or create below.');
  host.innerHTML=matches.slice(0,128).map((r,i)=>`<div class="asset-discovery-row"><span>${escapeHtml(r.name)}</span><small>${escapeHtml(r.label)}${r.folder?' · '+escapeHtml(r.folder):''}${r.tags.length?' · '+escapeHtml(r.tags.join(', ')):''}</small><button class="toolbar-btn" data-discovery-open="${i}"${!r.available||playMode?' disabled':''}>${r.kind==='material'?'Edit & Preview':'Open type tools'}</button>${!r.available?'<small>Unavailable or ambiguous identity — retained</small>':''}</div>`).join('');
  host.querySelectorAll('[data-discovery-open]').forEach(button=>{const row=matches[Number(button.dataset.discoveryOpen)],source=providers.find(p=>p.kind===row.kind)?.records[row.index];button.onclick=()=>{
    const provider=assetDiscoveryProviders().find(p=>p.kind===row.kind),current=provider?.records[row.index];
    if(playMode||current!==source||current?.id!==row.id||provider.records.filter(r=>r?.id===row.id).length!==1){showStatus('Asset changed or is unavailable; refresh discovery.');renderUnifiedAssetLibrary();return;}
    if(row.kind==='material'){openMaterialEditor(row.id);return;}
    const type=document.getElementById('asset-type-filter');type.value=row.kind;type.onchange();
    const section=document.querySelector('#left-tab-assets [data-asset-kind="'+row.kind+'"]');
    section?.querySelectorAll('.asset-filter-row input,.asset-filter-row select').forEach(control=>control.value='');refreshAssetDiscovery();
    const identityAttribute={'mesh':'data-asset-id','texture':'data-texture-id','sprite':'data-sprite-asset-id','sprite-animation':'data-sprite-animation-id','tileset':'data-tileset-id','tilemap-chunk':'data-tilemap-chunk-id','audio':'data-audio-id'}[row.kind];
    const target=Array.from(section?.querySelectorAll('.asset-row')||[]).find(element=>element.getAttribute(identityAttribute)===row.id);
    if(target){target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}else section?.scrollIntoView({block:'nearest'});
    showStatus('Opened '+row.label+' tools for '+row.name+'. Existing typed actions stay unchanged.');
  };});
}
function refreshAssetDiscovery(){
  if(!unifiedAssetLibraryReady)return;unifiedAssetLibraryRefreshing=true;try{renderAssetLibrary();renderTextureLibrary();renderSpriteLibrary();renderSpriteAnimationLibrary();renderTilesetLibrary();renderTilemapChunkLibrary();renderAudioLibrary();}finally{unifiedAssetLibraryRefreshing=false;}renderUnifiedAssetLibrary();
}
function assetMatchesFilter(asset, query, folder) {
  if(typeof unifiedAssetLibraryReady!=='undefined'&&unifiedAssetLibraryReady){const global=getAssetDiscoveryFilters();if(!assetDiscoveryMatches(asset,global.query,global.folder))return false;}
  if (folder && assetFolderOf(asset) !== folder) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  if (asset.name.toLowerCase().includes(q)) return true;
  return assetTagsOf(asset).some((t) => t.toLowerCase().includes(q));
}
// Populated from the FULL list (not the filtered one) so choosing a folder
// never makes other folders disappear from the dropdown; preserves the
// current selection across a re-render.
function populateAssetFolderFilter(selectEl, list, current) {
  if(typeof renderUnifiedAssetLibrary==='function')renderUnifiedAssetLibrary();
  const folders = Array.from(new Set(list.map(assetFolderOf).filter(Boolean))).sort();
  selectEl.innerHTML = '<option value="">All folders</option>' + folders.map((f) => `<option value="${escapeHtml(f)}"${f === current ? ' selected' : ''}>${escapeHtml(f)}</option>`).join('');
}
// Folder + tags are edited together through one compact field per row
// ("Folder: tag1, tag2") rather than two separate inputs -- an asset row is
// already dense (name/meta/actions all in a small card), and a second full
// input per row would cost more space than the feature is worth.
function formatAssetTagInput(asset) {
  const folder = assetFolderOf(asset), tags = assetTagsOf(asset);
  return (folder ? folder + ': ' : '') + tags.join(', ');
}
function parseAssetTagInput(text) {
  const trimmed = text.trim();
  if (!trimmed) return { folder: '', tags: [] };
  const colonIdx = trimmed.indexOf(':');
  let folder = '', rest = trimmed;
  if (colonIdx !== -1) { folder = trimmed.slice(0, colonIdx).trim(); rest = trimmed.slice(colonIdx + 1); }
  const tags = rest.split(',').map((s) => s.trim()).filter(Boolean);
  return { folder, tags };
}
function bindAssetMetadataInput(input,asset,getLibrary,render) {
  if(!input||!asset)return;
  const baseline=formatAssetTagInput(asset);
  input.onchange=()=>{
    try{
      if(playMode)throw new Error('Stop Play before editing asset folder/tags.');
      const matches=getLibrary().filter(record=>record?.id===asset.id);
      if(matches.length!==1||matches[0]!==asset||formatAssetTagInput(asset)!==baseline)throw new Error('Asset changed since this field was opened; refresh and edit again.');
      if(input.value.length>2048)throw new Error('Folder/tags input exceeds2048 characters; unchanged.');
      const parsed=parseAssetTagInput(input.value),tags=Array.from(new Set(parsed.tags));
      if(parsed.folder.length>128||tags.length>32||tags.some(tag=>tag.length>64))throw new Error('Use a folder up to128 characters and at most32 tags of64 characters; unchanged.');
      if(assetFolderOf(asset)===parsed.folder&&JSON.stringify(assetTagsOf(asset))===JSON.stringify(tags)){showStatus('Asset folder/tags unchanged.');return;}
      const state=captureAssetReplacementState();validateAssetReplacementRetainedData(state.project);
      asset.folder=parsed.folder;asset.tags=tags;
      undoStack.push(state.history);if(undoStack.length>MAX_HISTORY)undoStack.shift();redoStack.length=0;updateUndoRedoButtons();
      render();showStatus('Asset folder/tags updated. One Undo step.');
    }catch(error){input.value=formatAssetTagInput(asset);showStatus(error.message||'Asset folder/tags unchanged.');}
  };
}
function bindIndependentAssetCopy(button,asset,getLibrary,copyFactory,allocateId,render,select,suffix='Copy') {
  if(!button||!asset)return;
  let baseline;try{baseline=JSON.stringify(asset);}catch(error){baseline=null;}
  button.onclick=()=>{
    let state,copy,library;
    try{
      if(playMode)throw new Error('Stop Play before duplicating an asset.');
      library=getLibrary();const matches=library.filter(record=>record?.id===asset.id);
      if(matches.length!==1||matches[0]!==asset||baseline===null||JSON.stringify(asset)!==baseline)throw new Error('Asset changed since this button was opened; refresh and try again.');
      state=captureAssetReplacementState();validateAssetReplacementRetainedData(state.project);
      copy=copyFactory(asset,asset.id,OpusAuthoringPlumbing.uniqueAssetName(`${asset.name} ${suffix}`,library.map(record=>record.name)));
      if(!copy||copy===asset)throw new Error('Independent asset copy could not be prepared; unchanged.');
    }catch(error){showStatus(error.message||'Asset copy refused; unchanged.');return;}
    // Prepare canonical independent data before allocating identity or committing.
    const ids=new Set(library.map(record=>record.id));let id;
    try{for(let attempt=0;attempt<=library.length;attempt++){id=allocateId();if(typeof id==='string'&&id&&!ids.has(id))break;id=null;}if(!id)throw new Error('Unique asset identity unavailable; library unchanged.');}
    catch(error){showStatus(error.message||'Asset identity allocation failed; library unchanged.');return;}copy.id=id;
    library.push(copy);undoStack.push(state.history);if(undoStack.length>MAX_HISTORY)undoStack.shift();redoStack.length=0;
    select(copy.id);updateUndoRedoButtons();render();showStatus(`Duplicated "${asset.name}" independently. One Undo step; source retained.`);
  };
}
let pendingResourceAssetVariant=null;
function bindAudioAssetVariant(button,asset) {
  if(!button||!asset)return;
  const portable=()=>serializeAudioAssets(new Set([asset.id]))[0];
  let baseline;try{baseline=JSON.stringify(portable());}catch(error){baseline=null;}
  button.onclick=async()=>{
    let job,timer;
    try{
      if(playMode)throw new Error('Stop Play before creating an audio variant.');
      if(pendingResourceAssetVariant||pendingAssetImport)throw new Error('An asset preparation is pending; wait or cancel the import.');
      const matches=audioAssets.filter(record=>record?.id===asset.id);
      if(matches.length!==1||matches[0]!==asset||baseline===null||JSON.stringify(portable())!==baseline)throw new Error('Audio changed since this button was opened; refresh and try again.');
      const state=captureAssetReplacementState();validateAssetReplacementRetainedData(state.project);
      const source=JSON.parse(baseline);
      if(typeof source.dataURL!=='string'||source.dataURL.length>96*1024*1024)throw new Error('Audio variant requires retained source bytes up to96MiB encoded; unchanged.');
      job={app,library:audioAssets,project:JSON.stringify(state.project),undo:undoStack.slice(),redo:redoStack.slice()};pendingResourceAssetVariant=job;
      showStatus('Preparing independent audio variant; source and references unchanged.');
      const buffer=await Promise.race([app.audio.decodeAudio(dataURLToArrayBuffer(source.dataURL)),new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Audio variant preparation timed out; library unchanged.')),30000);})]);
      const diagnostics=analyzeAudioImport({audioBuffer:buffer});if(!diagnostics.ok)throw new Error(diagnostics.issues.join(' '));
      const sameStack=(current,before)=>current.length===before.length&&current.every((entry,index)=>entry===before[index]);
      if(playMode||app!==job.app||audioAssets!==job.library||pendingAssetImport||findAudioAssetById(asset.id)!==asset||JSON.stringify(portable())!==baseline||!sameStack(undoStack,job.undo)||!sameStack(redoStack,job.redo)||JSON.stringify(captureAssetReplacementState().project)!==job.project)throw new Error('Authoring state changed during audio preparation; no variant added.');
      const ids=new Set(audioAssets.map(record=>record.id));let id;
      for(let attempt=0;attempt<=audioAssets.length;attempt++){id=generateAudioId();if(typeof id==='string'&&id&&!ids.has(id))break;id=null;}
      if(!id)throw new Error('Unique audio identity unavailable; library unchanged.');
      const copy={...source,id,name:OpusAuthoringPlumbing.uniqueAssetName(`${source.name} Variant`,audioAssets.map(record=>record.name)),audioBuffer:buffer,pendingCallbacks:[]};
      state.history._phase198AudioVariant=true;
      audioAssets.push(copy);undoStack.push(state.history);if(undoStack.length>MAX_HISTORY)undoStack.shift();redoStack.length=0;updateUndoRedoButtons();renderAudioLibrary();
      showStatus(`Created "${copy.name}" independently. One Undo step; source bytes and references retained.`);
    }catch(error){showStatus(error.message||'Audio variant refused; unchanged.');}
    finally{clearTimeout(timer);if(job&&pendingResourceAssetVariant===job)pendingResourceAssetVariant=null;}
  };
}
function bindTextureAssetVariant(button,asset) {
  if(!button||!asset)return;
  const portable=()=>serializeTextureAssets(new Set([asset.id]))[0];
  let baseline;try{baseline=JSON.stringify(portable());}catch(error){baseline=null;}
  button.onclick=async()=>{
    let job,timer;
    try{
      if(playMode)throw new Error('Stop Play before creating a texture variant.');
      if(pendingResourceAssetVariant||pendingAssetImport)throw new Error('An asset preparation is pending; wait or cancel the import.');
      const matches=textureAssets.filter(record=>record?.id===asset.id);
      if(matches.length!==1||matches[0]!==asset||baseline===null||JSON.stringify(portable())!==baseline)throw new Error('Texture changed since this button was opened; refresh and try again.');
      const state=captureAssetReplacementState();validateAssetReplacementRetainedData(state.project);
      const source=JSON.parse(baseline);
      if(typeof source.dataURL!=='string'||source.dataURL.length>96*1024*1024)throw new Error('Texture variant requires retained source bytes up to96MiB encoded; unchanged.');
      job={app,library:textureAssets,project:JSON.stringify(state.project),undo:undoStack.slice(),redo:redoStack.slice()};pendingResourceAssetVariant=job;
      showStatus('Preparing independent texture variant; source and references unchanged.');
      const buffer=await Promise.race([decodeTextureImage(source.dataURL),new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Texture variant preparation timed out; library unchanged.')),30000);})]);
      const diagnostics=analyzeImageImport({...source,image:buffer,width:buffer.naturalWidth||buffer.width,height:buffer.naturalHeight||buffer.height});if(!diagnostics.ok)throw new Error(diagnostics.issues.join(' '));
      const sameStack=(current,before)=>current.length===before.length&&current.every((entry,index)=>entry===before[index]);
      if(playMode||app!==job.app||textureAssets!==job.library||pendingAssetImport||findTextureAssetById(asset.id)!==asset||JSON.stringify(portable())!==baseline||!sameStack(undoStack,job.undo)||!sameStack(redoStack,job.redo)||JSON.stringify(captureAssetReplacementState().project)!==job.project)throw new Error('Authoring state changed during texture preparation; no variant added.');
      const ids=new Set(textureAssets.map(record=>record.id));let id;
      for(let attempt=0;attempt<=textureAssets.length;attempt++){id=generateTextureId();if(typeof id==='string'&&id&&!ids.has(id))break;id=null;}
      if(!id)throw new Error('Unique texture identity unavailable; library unchanged.');
      const copy={...source,id,name:OpusAuthoringPlumbing.uniqueAssetName(`${source.name} Variant`,textureAssets.map(record=>record.name)),image:buffer,textureHandle:null,pendingCallbacks:[]};
      state.history._phase198TextureVariant=true;
      textureAssets.push(copy);undoStack.push(state.history);if(undoStack.length>MAX_HISTORY)undoStack.shift();redoStack.length=0;updateUndoRedoButtons();renderTextureLibrary();
      showStatus(`Created "${copy.name}" independently. One Undo step; source bytes and references retained.`);
    }catch(error){showStatus(error.message||'Texture variant refused; unchanged.');}
    finally{clearTimeout(timer);if(job&&pendingResourceAssetVariant===job)pendingResourceAssetVariant=null;}
  };
}
function prepareModelAssetVariant(record, options) {
  if(!record||!['mesh','skinnedMesh'].includes(record.type)||!Array.isArray(record.positions)||record.positions.length>65536*3||!Array.isArray(record.indices)||record.indices.length>1000000)throw new Error('Model variant requires supported geometry up to65536 vertices and1000000 indices; source unchanged.');
  if(JSON.stringify(record).length>32*1024*1024)throw new Error('Model variant retained data exceeds32MiB; source unchanged.');
  completeModelImportDiagnostics({warnings:[],issues:[]},record);
  const vertices=record.positions.length/3;
  for(const [key,length,optional]of [['normals',record.positions.length,false],['uvs',vertices*2,true],...(record.type==='skinnedMesh'?[['joints',vertices*4,false],['weights',vertices*4,false]]:[])])if((!optional||record[key]!==undefined)&&(!Array.isArray(record[key])||record[key].length!==length))throw new Error('Model variant '+key+' does not match canonical geometry; source unchanged.');
  for(const key of ['positions','normals','uvs','joints','weights'])if(Array.isArray(record[key])&&record[key].some(value=>!Number.isFinite(value)||!Number.isFinite(Math.fround(value))))throw new Error('Model variant '+key+' requires finite float32 values; source unchanged.');
  if(record.indices.some(index=>index>65535))throw new Error('Model variant indices exceed canonical16-bit mesh storage; source unchanged.');
  const copy={...JSON.parse(JSON.stringify(record)),meshHandle:null};if(!options||options.allocate!==false)getAssetMeshHandle(copy);return copy;
}
function bindModelAssetVariant(button,asset) {
  if(!button||!asset)return;
  const portable=()=>captureAssetReplacementLibraryMetadata(serializeAssets(new Set([asset.id])),assets,['meshHandle']).records[0];
  let baseline;try{baseline=JSON.stringify(portable());}catch(error){baseline=null;}
  button.onclick=()=>{
    try{
      if(playMode)throw new Error('Stop Play before creating a Model variant.');
      if(pendingResourceAssetVariant||pendingAssetImport)throw new Error('An asset preparation is pending; wait or cancel the import.');
      const matches=assets.filter(record=>record?.id===asset.id);
      if(matches.length!==1||matches[0]!==asset||baseline===null||JSON.stringify(portable())!==baseline)throw new Error('Model changed since this button was opened; refresh and try again.');
      const state=captureAssetReplacementState();validateAssetReplacementRetainedData(state.project);
      const copy=prepareModelAssetVariant(JSON.parse(baseline)),ids=new Set(assets.map(record=>record.id));let id;
      for(let attempt=0;attempt<=assets.length;attempt++){id=generateAssetId();if(typeof id==='string'&&id&&!ids.has(id))break;id=null;}
      if(!id)throw new Error('Unique Model identity unavailable; library unchanged.');
      copy.id=id;copy.name=OpusAuthoringPlumbing.uniqueAssetName(`${asset.name} Variant`,assets.map(record=>record.name));
      state.history._phase198ModelVariant=true;assets.push(copy);undoStack.push(state.history);if(undoStack.length>MAX_HISTORY)undoStack.shift();redoStack.length=0;updateUndoRedoButtons();renderAssetLibrary();
      showStatus(`Created "${copy.name}" independently. One Undo step; source geometry and references retained.`);
    }catch(error){showStatus(error.message||'Model variant refused; unchanged.');}
  };
}
function createAssetContentEditGuard(asset,getLibrary) {
  let baseline;try{baseline=JSON.stringify(asset);}catch(error){baseline=null;}
  const allowed=()=>{
    try{if(playMode)throw new Error('Stop Play before editing asset content.');const matches=getLibrary().filter(record=>record?.id===asset.id);if(matches.length!==1||matches[0]!==asset||baseline===null||JSON.stringify(asset)!==baseline)throw new Error('Asset content changed; refresh before editing.');return true;}
    catch(error){showStatus(error.message||'Asset content edit refused.');return false;}
  };
  return {allowed,beforeChange(){if(!allowed())return false;try{const state=captureAssetReplacementState();validateAssetReplacementRetainedData(state.project);undoStack.push(state.history);if(undoStack.length>MAX_HISTORY)undoStack.shift();redoStack.length=0;updateUndoRedoButtons();return true;}catch(error){showStatus(error.message||'Asset content history unavailable; unchanged.');return false;}},updated(){baseline=JSON.stringify(asset);}};
}
function bindAssetNameInput(input,asset,getLibrary,render) {
  const guard=createAssetContentEditGuard(asset,getLibrary);let edited=false;
  input.oninput=()=>{
    const name=input.value.trim()||asset.name;if(name===asset.name)return;
    if(!guard.allowed()||(!edited&&!guard.beforeChange())){input.value=asset.name;return;}
    edited=true;asset.name=name;guard.updated();
    const label=document.querySelector(`[data-sprite-animation-id="${asset.id}"] .asset-row-name`);if(label)label.textContent=name;
  };
  input.onblur=()=>{input.value=asset.name;edited=false;render();};
}
function bindSpriteAnimationEventName(input,clip,frame,render) {
  const guard=createAssetContentEditGuard(clip,()=>spriteAnimationClips);
  const event=(frame.events||[]).find(entry=>entry.id===input.dataset.spriteAnimationEventName);
  input.onchange=()=>{
    if(!event||OpusAuthoringPlumbing.spriteAnimationEvents(clip).filter(entry=>entry.id===event.id).length!==1){showStatus('Animation Event is unavailable or ambiguous; unchanged.');render();return;}
    const used=new Set(OpusAuthoringPlumbing.spriteAnimationEvents(clip).filter(entry=>entry.id!==event.id).map(entry=>entry.name.toLowerCase()));
    const root=input.value.trim()||'Animation Event';let name=root,suffix=2;while(used.has(name.toLowerCase()))name=`${root} ${suffix++}`;
    if(name===event.name){input.value=event.name;return;}
    if(!guard.beforeChange()){input.value=event.name;return;}
    event.name=name;guard.updated();render();
  };
}
function bindSpriteNineSliceInput(input,asset,getLibrary,texture,render) {
  const guard=createAssetContentEditGuard(asset,getLibrary),key=input.dataset.nineSliceGuide;
  input.onchange=()=>{
    if(!asset.nineSlice||!['left','right','top','bottom'].includes(key))return;
    const value=Number(input.value),candidate={...asset,nineSlice:{...asset.nineSlice,[key]:value}};
    const issues=OpusAuthoringPlumbing.validateSpriteNineSlice(candidate,texture).filter(issue=>issue.severity!=='warning');
    if(!input.value.trim()||issues.length){input.value=asset.nineSlice[key];showStatus(issues[0]?.message||'Use a valid Nine-Slice guide; unchanged.');return;}
    if(value===asset.nineSlice[key])return;
    if(!guard.beforeChange()){input.value=asset.nineSlice[key];return;}
    asset.nineSlice[key]=value;guard.updated();render();
  };
}
function assetTagsRowHtml(asset,variant=false) {
  const tags = assetTagsOf(asset);
  const folder = assetFolderOf(asset);
  const chips = (folder ? [`📁 ${folder}`] : []).concat(tags);
  const chipsHtml = chips.length ? `<div class="asset-row-tags">${chips.map((c) => `<span class="asset-tag-chip">${escapeHtml(c)}</span>`).join('')}</div>` : '';
  return `${chipsHtml}<input type="text" class="asset-row-folder-tags-edit" data-asset-tagedit="${asset.id}" placeholder="Folder: tag1, tag2" value="${escapeHtml(formatAssetTagInput(asset))}">${variant?`<div class="asset-row-actions"><button data-create-asset-variant="${escapeHtml(asset.id)}" title="Create an independent editable copy with a new identity. Source and references stay unchanged; artwork dependencies stay shared.">Create Variant</button></div>`:''}`;
}

// Wave 8: `usedIds` now always comes from the one `collectProjectDependencies()`
// closure (computed once per `serializeProject()` call and threaded through
// to all three asset-kind serializers below), replacing this function's own
// previously-independent, narrower scan -- see that function's own comment
// for the concrete gap this closes (Player Visual's own `visual.assetId`
// was never found by the old scan).
function copyPortableAssetExtras(record,canonical) {
  // Canonical fields retain historical defaults and ownership; only opaque,
  // safely serializable authored extras roundtrip. Runtime handles never do.
  const result={...canonical},runtime=new Set(['meshHandle','image','textureHandle','audioBuffer','pendingCallbacks','decodeError']);
  for(const key of Object.keys(record||{})){
    if(runtime.has(key)||Object.prototype.hasOwnProperty.call(canonical,key)||record[key]===undefined)continue;
    try{
      const encoded=JSON.stringify(record[key],(name,value)=>{if(['__proto__','constructor','prototype'].includes(name)||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||(typeof value==='number'&&!Number.isFinite(value)))throw new Error();return value;});
      if(['__proto__','constructor','prototype'].includes(key))throw new Error();
      Object.defineProperty(result,key,{value:JSON.parse(encoded),enumerable:true,writable:true,configurable:true});
    }catch(error){throw new Error('Unsupported asset metadata; original library unchanged.');}
  }return result;
}
function validatePortableProjectAssetExtras(project) {
  // Full project replacement must reject structural corruption and all known
  // synchronous library-constructor failures BEFORE retiring current owners.
  // Partial reusable asset-pack metadata keeps its existing validation path.
  if(Array.isArray(project)||project&&typeof project==='object'&&('levels'in project||'objects'in project)){
    // Canonical in-memory DTOs contain optional undefined object fields that
    // JSON Save/export legitimately omit. Still refuse executable/non-finite
    // values rather than silently dropping them during preflight.
    const portable=JSON.parse(JSON.stringify(project,function(key,value){
      if(typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value==='number'&&!Number.isFinite(value))throw new Error('Project requires finite non-executable JSON.');
      if(value===undefined&&Array.isArray(this))throw new Error('Project arrays cannot contain undefined entries.');
      return value;
    }));
    OpusPlayerRebindScreen.copy(portable); // bounded plain JSON; no prototype keys
    if(!OpusPlayerRebindScreen.scopeKey(OpusPlayerRebindScreen.scope(project)))throw new Error('Invalid portable project identity; current document kept.');
    const arrays=['levels','assets','textures','spriteAssets','spriteAnimations','tilesets','tilemapChunks','audio','prefabs','materialAssets','componentPresets','uiTemplates','cameraTemplates','cinematicTemplates','controllerTemplates','aiArchetypes','combatEncounterTemplates','weaponDefinitions','inputDeviceMappings','inputActionSets','inputActionAssets','graphFunctions','signals','itemDefs','lootTables','inventoryTemplates'];
    for(const key of arrays)if(Object.prototype.hasOwnProperty.call(project,key)&&!Array.isArray(project[key]))throw new Error('Malformed '+key+': expected a list. Current document kept.');
    for(const level of project.levels||[])if(!level||typeof level!=='object'||!Array.isArray(level.objects))throw new Error('Malformed level objects; current document kept.');
    for(const family of ['assets','textures','spriteAssets','spriteAnimations','tilesets','tilemapChunks','audio','materialAssets']){
      const ids=new Set();for(const record of project[family]||[]){
        if(!record||typeof record!=='object'||typeof record.id!=='string'||!record.id||ids.has(record.id))throw new Error('Malformed or duplicate '+family+' identity; current document kept.');ids.add(record.id);
        if(family==='assets')for(const field of ['positions','normals','indices'])if(!Array.isArray(record[field])||!record[field].every(Number.isFinite))throw new Error('Malformed Model '+field+'; current document kept.');
        if(family==='textures'||family==='audio'){
          if(typeof record.dataURL!=='string'||!record.dataURL.startsWith('data:'))throw new Error('Portable media requires embedded data URLs; current document kept.');
          if(family==='audio')dataURLToArrayBuffer(record.dataURL);
          else {
            const comma=record.dataURL.indexOf(',');if(comma<0)throw new Error('Malformed embedded image data URL.');
            if(/;base64/i.test(record.dataURL.slice(0,comma)))atob(record.dataURL.slice(comma+1));
            else decodeURIComponent(record.dataURL.slice(comma+1)); // embedded SVG/UTF-8 starters are valid too
          }
        }
      }
    }
    copyMaterialAssets(project.materialAssets);copyComponentPresetLibrary(project.componentPresets);copyUiTemplateLibrary(project.uiTemplates);copyCameraTemplateLibrary(project.cameraTemplates);copyControllerTemplateLibrary(project.controllerTemplates);copyAiArchetypeLibrary(project.aiArchetypes);copyCombatEncounterLibrary(project.combatEncounterTemplates);copyWeaponDefinitionLibrary(project.weaponDefinitions);copyInputActionAssets(project.inputActionAssets);copyInputContexts(project.inputContexts);copyInputDeviceMappings(project.inputDeviceMappings);copyInputActionSets(project.inputActionSets);copyLootLibrary(project.lootTables);copyInventoryTemplateLibrary(project.inventoryTemplates);
    if(Array.isArray(project.graphFunctions))OpusGraphSchema.library(project.graphFunctions);
    for(const record of project.spriteAssets||[])OpusAuthoringPlumbing.createSpriteAsset(record);
    for(const record of project.tilesets||[])OpusAuthoringPlumbing.createTileset(record);
    for(const record of project.tilemapChunks||[])OpusAuthoringPlumbing.normalizeTilemapChunk(record);
  }
  // Preflight all opaque extras before full-project replacement starts. Known
  // geometry/source fields retain their existing validators and semantics.
  const families={
    assets:['id','name','type','positions','normals','indices','uvs','textureAssetId','joints','weights','skin','sockets','animationEvents','sourceFilename','folder','tags'],
    textures:['id','name','dataURL','sourceFilename','width','height','folder','tags'],
    audio:['id','name','dataURL','sourceFilename','folder','tags'],
  };
  for(const [family,keys] of Object.entries(families)){
    const canonical=Object.fromEntries(keys.map(key=>[key,undefined]));
    for(const record of Array.isArray(project?.[family])?project[family]:[])copyPortableAssetExtras(record,canonical);
  }
}
function serializeAssets(usedIds) {
  const used = usedIds || collectProjectDependencies().meshAssets;
  // Wave 6 (Priority C): a 'skinnedMesh' asset carries its rig data
  // (uvs/joints/weights/skin) alongside the same positions/normals/indices
  // every asset already serializes -- omitted entirely for an ordinary
  // 'mesh' asset, so a pre-Wave-6 asset's saved record stays byte-for-byte
  // identical to before this feature existed.
  return assets.filter((a) => used.has(a.id)).map((a) => copyPortableAssetExtras(a,{
    id: a.id, name: a.name, type: a.type, positions: a.positions, normals: a.normals, indices: a.indices,
    uvs: a.uvs,
    textureAssetId: a.textureAssetId || undefined,
    joints: a.type === 'skinnedMesh' ? a.joints : undefined,
    weights: a.type === 'skinnedMesh' ? a.weights : undefined,
    skin: a.type === 'skinnedMesh' ? a.skin : undefined,
    // Wave 7 (Priority A): named Sockets are authoring metadata on the
    // ASSET itself (a "RightHand" bone offset is a property of the rig, not
    // any one placed instance) -- omitted entirely for a non-skinned asset
    // or a skinned asset with none authored, matching the same "omit at
    // default" discipline `skin` above already follows.
    sockets: (a.type === 'skinnedMesh' && a.sockets && a.sockets.length) ? a.sockets : undefined,
    // Wave 7 (Priority B): same asset-level-metadata / omit-at-default
    // pattern as sockets above -- an event is a property of the CLIP, which
    // belongs to the rig, not to any one placed instance.
    animationEvents: (a.type === 'skinnedMesh' && a.animationEvents !== undefined && (!Array.isArray(a.animationEvents) || a.animationEvents.length)) ? JSON.parse(JSON.stringify(a.animationEvents)) : undefined,
    sourceFilename: a.sourceFilename, folder: a.folder || undefined, tags: (a.tags && a.tags.length) ? a.tags.slice() : undefined,
  }));
}
// Additive merge, like bundled-prefab import -- never overwrites a LOCAL
// asset of the same id, so importing a project that shares an asset id
// with something already in this library can't silently corrupt it.
function loadAssets(bundledAssets, reusableAssets = []) {
  if (!Array.isArray(bundledAssets)) return;
  for (const a of bundledAssets) {
    if (findAssetById(a.id)) continue;
    reconcileAssetIdCounter(a.id);
    assets.push(copyPortableAssetExtras(a,{
      id: a.id, name: a.name, type: a.type, positions: a.positions, normals: a.normals, indices: a.indices,
      uvs: a.uvs, textureAssetId: a.textureAssetId, joints: a.joints, weights: a.weights, skin: a.skin, sockets: a.sockets ? a.sockets.slice() : [],
      animationEvents: a.animationEvents === undefined ? [] : JSON.parse(JSON.stringify(a.animationEvents)),
      sourceFilename: a.sourceFilename, meshHandle: null, folder: a.folder || '', tags: a.tags ? a.tags.slice() : [],
    }));
    // Reuse geometry resources only, never the retired document's metadata.
    const structural=['id','type','positions','normals','indices','uvs','joints','weights','skin'];
    const matches=reusableAssets.filter(old=>old.id===a.id);
    if(matches.length===1&&matches[0].meshHandle&&JSON.stringify(structural.map(key=>matches[0][key]))===JSON.stringify(structural.map(key=>a[key])))assets[assets.length-1].meshHandle=matches[0].meshHandle;
  }
  renderAssetLibrary();
}

function renderAssetLibrary() {
  const listEl = document.getElementById('asset-library-list');
  if (!listEl) return;
  const searchEl = document.getElementById('asset-library-search');
  const folderEl = document.getElementById('asset-library-folder-filter');
  const query = searchEl ? searchEl.value.trim() : '';
  const folder = folderEl ? folderEl.value : '';
  if (folderEl) populateAssetFolderFilter(folderEl, assets, folder);
  if (assets.length === 0) {
    listEl.innerHTML = '<p class="onboarding-empty">No Model Assets yet. Use Import Model above; imported models become placeable objects.</p>';
    return;
  }
  const visible = assets.filter((a) => assetMatchesFilter(a, query, folder));
  if (visible.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No assets match this search.</p>';
    return;
  }
  listEl.innerHTML = visible.map((a) => {
    const usage = computeAssetUsageCount(a.id);
    return `
    <div class="asset-row" data-asset-id="${a.id}">
      <div class="asset-row-header">
        <span class="asset-row-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</span>
      </div>
      <div class="asset-row-meta">${escapeHtml((OpusAuthoringPlumbing.assetTypes.resolveType(a, 'mesh') || { displayName: a.type }).displayName)} · ${a.positions.length / 3} verts · used ${usage}×</div>
      ${assetTagsRowHtml(a,true)}
      <div class="asset-row-actions">
        <button data-place-asset="${a.id}">Place</button>
        <button data-rename-asset="${a.id}">Rename</button>
        <button data-delete-asset="${a.id}">Delete</button>
      </div>
    </div>`;
  }).join('');
  listEl.querySelectorAll('[data-create-asset-variant]').forEach(button=>bindModelAssetVariant(button,findAssetById(button.dataset.createAssetVariant)));
  listEl.querySelectorAll('[data-place-asset]').forEach((btn) => {
    btn.onclick = () => {
      const asset = findAssetById(btn.dataset.placeAsset);
      if (asset) placeAssetInstance(asset, new Opus.Vec3(0, 1, 0));
    };
  });
  listEl.querySelectorAll('[data-rename-asset]').forEach((btn) => {
    btn.onclick = () => {
      const asset = findAssetById(btn.dataset.renameAsset);
      if (!asset) return;
      const name = prompt('Asset name:', asset.name);
      if (name && name.trim()) { asset.name = name.trim(); renderAssetLibrary(); }
    };
  });
  listEl.querySelectorAll('[data-delete-asset]').forEach((btn) => {
    btn.onclick = () => {
      const asset = findAssetById(btn.dataset.deleteAsset);
      if (!asset) return;
      const usage = computeAssetUsageCount(asset.id);
      if (usage > 0) { showStatus(`Can't delete "${asset.name}" -- still used by ${usage} object${usage === 1 ? '' : 's'}`); return; }
      assets = assets.filter((a) => a.id !== asset.id);
      renderAssetLibrary();
      showStatus(`Deleted asset "${asset.name}"`);
    };
  });
  listEl.querySelectorAll('[data-asset-tagedit]').forEach((input) => {
    bindAssetMetadataInput(input,findAssetById(input.dataset.assetTagedit),()=>assets,renderAssetLibrary);
  });
}
renderAssetLibrary();
document.getElementById('asset-library-search').addEventListener('input', renderAssetLibrary);
document.getElementById('asset-library-folder-filter').addEventListener('change', renderAssetLibrary);

// --- Texture Asset Library (Wave 3) ---
// Deliberately bounded, NOT a PBR material system: one optional base-color
// texture per cube (see 07-shader.js's own comment), authored either by
// importing an image file directly or automatically from a glTF model's
// embedded base-color texture (see the Import Model handler below). Mirrors
// the mesh Asset Library's shape (id/name/usage-count/Place-Rename-Delete)
// on purpose -- same mental model, different payload (a decoded image + a
// lazily-built GPU texture handle instead of geometry arrays).
//
// Image decode is genuinely asynchronous (`new Image().onload`), which the
// rest of this editor's synchronous scene-load path (loadScene/
// instantiateCubeRecord) isn't built around and shouldn't be forced to be
// just for this. Bridged with a small pending-callback queue per asset:
// applyTextureToEntity() assigns the GPU texture immediately if the image
// has already finished decoding, or queues the assignment for the moment it
// does -- so a textured object loaded from a fresh project briefly renders
// untextured (a color-only tint) for at most one decode's worth of time,
// never blocks or breaks the load.
let textureAssets = [];
let materialAssets = [];
let nextMaterialAssetId = 1;
function copyMaterialAssets(value){return Array.isArray(value)?JSON.parse(JSON.stringify(value)):[];}
function materialTextureRef(item){return item.textureDisabled?null:item.textureAssetId||findAssetById(item.assetId)?.textureAssetId||null;}
function renderMaterialLibraryFields(){return `<p class="field-help">Capture a named reusable look, then Edit & Preview or Apply to another Mesh or Billboard. Apply copies values; later object edits stay independent. No live link or extra texture channels.</p><input id="material-capture-name" type="text" placeholder="Material name…" maxlength="80"><button id="material-capture-btn" class="toolbar-btn">Capture Material</button><select id="material-asset-picker"><option value="">Choose reusable Material…</option>${materialAssets.map(m=>`<option value="${escapeHtml(m?.id||'')}">${escapeHtml(m?.name||'Unavailable saved Material')}</option>`).join('')}</select><button id="material-edit-btn" class="toolbar-btn">Edit & Preview Material</button><button id="material-apply-btn" class="toolbar-btn">Apply Material</button>`;}
function captureNamedMaterial(name){
  if(playMode||selectedItem?.kind!=='cube'||!selectedItem.entity)return false;
  name=typeof name==='string'?name.trim():'';if(!name||name.length>80){showStatus('Give the Material a name (1–80 characters).');return false;}
  let descriptor;try{descriptor=Opus.Material.capture(selectedItem.entity,materialTextureRef(selectedItem));}catch(error){showStatus(error.message);return false;}
  pushUndo();let id;do{id='material-'+(nextMaterialAssetId++);}while(materialAssets.some(m=>m?.id===id));materialAssets.push({id,name,descriptor});renderInspector();if(typeof renderUnifiedAssetLibrary==='function')renderUnifiedAssetLibrary();showStatus('Captured Material: '+name);return true;
}
function applyNamedMaterial(id){
  if(playMode||selectedItem?.kind!=='cube'||!selectedItem.entity)return false;
  const matches=materialAssets.filter(m=>m?.id===id);if(matches.length!==1){showStatus('Choose one available named Material.');return false;}
  let descriptor;try{if(!matches[0].descriptor||typeof matches[0].descriptor!=='object')throw new Error('Missing material descriptor');descriptor=Opus.Material.create(matches[0].descriptor);}catch(error){showStatus('Saved Material is unavailable: '+error.message);return false;}
  const texture=descriptor.textureAssetRef&&findTextureAssetById(descriptor.textureAssetRef);
  if(descriptor.textureAssetRef&&!texture){showStatus('Material texture is unavailable; saved values were retained.');return false;}
  if(JSON.stringify(Opus.Material.capture(selectedItem.entity,materialTextureRef(selectedItem)))===JSON.stringify(descriptor)){showStatus('Material already matches this object.');return false;}
  pushUndo();clearTextureFromEntity(selectedItem.entity);Opus.Material.apply(selectedItem.entity,{...descriptor,textureAssetRef:null});selectedItem.textureAssetId=descriptor.textureAssetRef||undefined;selectedItem.textureDisabled=!descriptor.textureAssetRef;
  if(texture)applyTextureToEntity(selectedItem.entity,texture);
  renderInspector();showStatus('Applied independent Material values: '+matches[0].name);return true;
}
// Detached edit transaction: saved assets and placed objects are never preview state.
function materialDraftCandidate(id,expected,name,descriptor){
  if(playMode)return {ok:false,reason:'Stop Play before editing Materials.'};
  const matches=materialAssets.filter(m=>m?.id===id);
  if(matches.length!==1||JSON.stringify(matches[0])!==JSON.stringify(expected))return {ok:false,reason:'Saved Material changed or is unavailable. Close and reopen the editor.'};
  name=typeof name==='string'?name.trim():'';
  if(!name||name.length>80)return {ok:false,reason:'Give the Material a name (1–80 characters).'};
  let value;try{if(!descriptor||typeof descriptor!=='object')throw new Error('Missing descriptor');value=Opus.Material.create(descriptor);}catch(e){return {ok:false,reason:e.message};}
  if(value.textureAssetRef&&!findTextureAssetById(value.textureAssetRef))return {ok:false,reason:'Material texture is unavailable; choose an available texture or None.'};
  const record={...matches[0],name,descriptor:value};
  return {ok:true,record,changed:JSON.stringify(record)!==JSON.stringify(matches[0])};
}
function saveNamedMaterialDraft(id,expected,name,descriptor){
  const candidate=materialDraftCandidate(id,expected,name,descriptor);
  if(!candidate.ok||!candidate.changed)return candidate;
  pushUndo();materialAssets=materialAssets.map(m=>m?.id===id?candidate.record:m);if(typeof renderUnifiedAssetLibrary==='function')renderUnifiedAssetLibrary();return candidate;
}
let materialEditorSession=null;
// One transient canvas/context per page: App.destroy frees resources/listeners,
// but a fresh canvas per edit can evict the main editor's WebGL context.
let materialPreviewCanvas=null;
function closeMaterialEditor(){
  const session=materialEditorSession;if(!session)return;
  materialEditorSession=null;session.closed=true;session.revision++;
  window.removeEventListener('keydown',session.keyGuard,true);window.removeEventListener('keyup',session.keyGuard,true);
  session.preview?.destroy();session.preview?.canvas?.remove();session.host.remove();session.returnFocus?.focus();
}
function openMaterialEditor(id){
  if(playMode){showStatus('Stop Play before editing Materials.');return false;}
  const matches=materialAssets.filter(m=>m?.id===id);if(matches.length!==1){showStatus('Choose one available named Material.');return false;}
  let descriptor;try{if(!matches[0].descriptor||typeof matches[0].descriptor!=='object')throw new Error('Missing material descriptor');descriptor=Opus.Material.create(matches[0].descriptor);}catch(e){showStatus('Saved Material is unavailable: '+e.message);return false;}
  closeMaterialEditor();const expected=copyMaterialAssets(matches)[0],host=document.createElement('dialog');host.id='material-editor-dialog';
  const number=(key,label,value)=>`<label>${label}<input data-material-field="${key}" type="number" step="0.1" value="${value}"></label>`;
  host.innerHTML=`<header><h2>Material · Edit & Preview</h2><button data-material-cancel aria-label="Close Material editor">×</button></header><p>Preview a saved look without changing your scene. Save updates this asset only; Apply still copies independent values onto objects.</p><div class="material-editor-layout"><section><canvas id="material-preview-canvas" aria-label="Live Material preview"></canvas><p>Engine-rendered cube on a neutral floor. Texture RGB tints the surface; its alpha multiplies Opacity. Normal, metallic, roughness and emissive maps are not supported. Emission is surface color, not glow.</p></section><section class="material-editor-fields"><label>Look preset<select data-material-preset><option value="">Keep current look</option>${Opus.Material.PRESETS.map(p=>`<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('')}</select></label><label>Name<input data-material-name maxlength="80" value="${escapeHtml(expected.name||'')}"></label><label>Base color<input data-material-field="color" type="color" value="${rgbToHex(descriptor.color)}"></label><label>Color + transparency texture<select data-material-texture><option value="">None</option>${textureAssets.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.name||'Texture')}</option>`).join('')}${descriptor.textureAssetRef&&!findTextureAssetById(descriptor.textureAssetRef)?`<option value="${escapeHtml(descriptor.textureAssetRef)}">Unavailable saved texture</option>`:''}</select></label>${number('alpha','Opacity · 0 transparent / 1 opaque',descriptor.alpha)}<label><input data-material-field="unlit" type="checkbox"${descriptor.unlit?' checked':''}> Unlit · ignore scene lighting</label><label>Emissive color<input data-material-field="emissiveColor" type="color" value="${rgbToHex(descriptor.emissiveColor)}"></label>${number('emissiveIntensity','Emissive intensity',descriptor.emissiveIntensity)}${number('uvScale.0','UV repeat X',descriptor.uvScale[0])}${number('uvScale.1','UV repeat Y',descriptor.uvScale[1])}${number('uvOffset.0','UV offset X',descriptor.uvOffset[0])}${number('uvOffset.1','UV offset Y',descriptor.uvOffset[1])}</section></div><p data-material-status role="status"></p><footer><button data-material-cancel>Cancel</button><button data-material-save>Save Material</button></footer>`;
  document.body.appendChild(host);host.showModal();
  const previewCanvas=host.querySelector('canvas');
  if(materialPreviewCanvas)previewCanvas.replaceWith(materialPreviewCanvas);else materialPreviewCanvas=previewCanvas;
  const session={host,id,expected,draft:descriptor,closed:false,revision:0,preview:null,entity:null,projectLevels:levels,returnFocus:document.getElementById('material-edit-btn'),textures:new Map()};materialEditorSession=session;
  const q=s=>host.querySelector(s),status=q('[data-material-status]'),save=q('[data-material-save]');q('[data-material-texture]').value=descriptor.textureAssetRef||'';
  session.keyGuard=e=>{if(materialEditorSession!==session)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeMaterialEditor();return;}e.stopPropagation();};
  window.addEventListener('keydown',session.keyGuard,true);window.addEventListener('keyup',session.keyGuard,true);
  host.oncancel=e=>{e.preventDefault();closeMaterialEditor();};host.querySelectorAll('[data-material-cancel]').forEach(b=>b.onclick=closeMaterialEditor);
  const updatePreview=async()=>{
    const revision=++session.revision,candidate=materialDraftCandidate(id,expected,q('[data-material-name]').value,session.draft);save.disabled=true;
    if(!candidate.ok){status.textContent=candidate.reason+' Last valid preview retained.';return;}
    if(!session.preview){status.textContent='Preview unavailable. Saved asset and scene are untouched.';return;}
    let texture=null;const asset=candidate.record.descriptor.textureAssetRef&&findTextureAssetById(candidate.record.descriptor.textureAssetRef);
    try{if(asset){status.textContent='Loading preview texture…';texture=session.textures.get(asset.id);if(!texture){const image=asset.image||await decodeTextureImage(asset.dataURL);if(session.closed||session.revision!==revision)return;texture=session.preview.createTexture(image);session.textures.set(asset.id,texture);}}
      if(session.closed||session.revision!==revision)return;
      Opus.Material.apply(session.entity,candidate.record.descriptor,{texture});save.disabled=!candidate.changed;status.textContent=candidate.changed?'Live preview · unsaved changes. Save creates one Undo step.':'Saved Material · no changes.';
    }catch(e){if(!session.closed&&session.revision===revision)status.textContent='Preview unavailable: '+e.message+' Saved values were retained.';}
  };
  try{session.preview=Opus.create(q('canvas'),{hud:false,autoStart:false,dprCap:1,settingsNamespace:'doengine:material-preview',saveNamespace:'doengine:material-preview',defaultSettings:{muted:true}});session.preview.camera.setMode('fixed');session.preview.camera.setFixedOptions({eye:new Opus.Vec3(4,3,5),target:new Opus.Vec3(0,.4,0)});session.entity=new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(0,.8,0),scale:new Opus.Vec3(1.6,1.6,1.6)});session.preview.scene.add(session.entity);session.preview.scene.add(new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(0,-.15,0),scale:new Opus.Vec3(6,.2,6),color:[.32,.36,.42]}));session.preview.pause();session.preview.start();}catch(e){status.textContent='Preview unavailable: '+e.message;}
  q('[data-material-name]').oninput=updatePreview;q('[data-material-texture]').onchange=e=>{session.draft.textureAssetRef=e.target.value||null;updatePreview();};
  q('[data-material-preset]').onchange=e=>{
    if(!e.target.value)return;
    try{session.draft=Opus.Material.preset(e.target.value,session.draft);
      host.querySelectorAll('[data-material-field]').forEach(control=>{const [key,index]=control.dataset.materialField.split('.'),value=index===undefined?session.draft[key]:session.draft[key][Number(index)];if(control.type==='checkbox')control.checked=value;else control.value=control.type==='color'?rgbToHex(value):String(value);});
      updatePreview();
    }catch(error){status.textContent='Preset unavailable: '+error.message+' Saved values are untouched.';}
    e.target.value='';
  };
  host.querySelectorAll('[data-material-field]').forEach(control=>control.oninput=()=>{const [key,index]=control.dataset.materialField.split('.');let value=control.type==='checkbox'?control.checked:control.type==='color'?hexToRgb(control.value):control.value.trim()?Number(control.value):NaN;if(index!==undefined){session.draft[key]=session.draft[key].slice();session.draft[key][Number(index)]=value;}else session.draft[key]=value;updatePreview();});
  save.onclick=()=>{if(session.closed||session.projectLevels!==levels){status.textContent='Project changed. Close and reopen this editor.';return;}const result=saveNamedMaterialDraft(id,expected,q('[data-material-name]').value,session.draft);if(!result.ok){status.textContent=result.reason;return;}closeMaterialEditor();renderInspector();showStatus(result.changed?'Saved independent Material asset. Apply it to update an object.':'Material unchanged; no history entry.');};
  updatePreview();q('[data-material-name]').focus();return true;
}
let nextTextureId = 1;
let spriteAssets = [];
let nextSpriteAssetId = 1;
let selectedSpriteAssetId = null;
let spriteAnimationClips = [];
let nextSpriteAnimationId = 1;
let selectedSpriteAnimationId = null;
let tilesets = [];
let tilemapChunks = [];
let nextTilesetId = 1;
let selectedTilesetId = null;
let activeTilesetId = null;
let activeTileId = null;
let tilePaletteAddingSprites = false;
let tilePaletteMode = 'tiles';
let activeAutoTileSetId = null;
let activeAutoTileRuleMask = 0;
let activeTerrainBrushId = null;
function generateTextureId() { return `texture${nextTextureId++}`; }
function generateSpriteAssetId() { return `spriteAsset${nextSpriteAssetId++}`; }
function generateSpriteAnimationId() { return `spriteAnimation${nextSpriteAnimationId++}`; }
function generateTilesetId() { return `tileset${nextTilesetId++}`; }
function reconcileTextureIdCounter(id) {
  const match = /^texture(\d+)$/.exec(id);
  if (match) nextTextureId = Math.max(nextTextureId, Number(match[1]) + 1);
}
function findTextureAssetById(id) { return id ? textureAssets.find((t) => t.id === id) : undefined; }
function reconcileSpriteAssetIdCounter(id) {
  const match = /^spriteAsset(\d+)$/.exec(id);
  if (match) nextSpriteAssetId = Math.max(nextSpriteAssetId, Number(match[1]) + 1);
}
function findSpriteAssetById(id) { return id ? spriteAssets.find((asset) => asset.id === id) : undefined; }
function reconcileSpriteAnimationIdCounter(id) {
  const match = /^spriteAnimation(\d+)$/.exec(id);
  if (match) nextSpriteAnimationId = Math.max(nextSpriteAnimationId, Number(match[1]) + 1);
}
function findSpriteAnimationById(id) { return id ? spriteAnimationClips.find((clip) => clip.id === id) : undefined; }
function reconcileTilesetIdCounter(id) { const match = /^tileset(\d+)$/.exec(id); if (match) nextTilesetId = Math.max(nextTilesetId, Number(match[1]) + 1); }
function findTilesetById(id) { return OpusAuthoringPlumbing.getTilesetById(tilesets, id); }
function findActiveTile() { return OpusAuthoringPlumbing.getTileById(findTilesetById(activeTilesetId), activeTileId); }
function findActiveAutoTileSet() { return OpusAuthoringPlumbing.getAutoTileSetById(findTilesetById(activeTilesetId), activeAutoTileSetId); }
function liveAutoTileProject() { return { tilesets, tilemapChunks, levels: levels.map((level, index) => ({ ...level, objects: index === currentLevelIndex ? placed : (level.objects || []) })) }; }
function recomputeAutoTileSetEverywhere(tileset, setId) { const changes = OpusAuthoringPlumbing.recomputeAutoTileSetUsage(liveAutoTileProject(), tileset.id, setId); OpusAuthoringPlumbing.recomputeProjectTilemapChunks(liveAutoTileProject(), tileset.id); for (const item of placed) if (item.kind === 'tilemap' && item.tilesetRef === tileset.id) syncTilemapRenderer(item); renderTilemapChunkLibrary(); syncTilemapOverlay(); return changes; }
function sourceTextureForSpriteAsset(asset) { return asset ? findTextureAssetById(asset.sourceTexture) : undefined; }
function getTextureHandle(asset) {
  if (!asset.image) return null;
  if (!asset.textureHandle) asset.textureHandle = app.createTexture(asset.image);
  return asset.textureHandle;
}
// Transient ownership only: queued image decode must not undo a later rebind/clear.
const entityTextureRequests = new WeakMap();
function clearTextureFromEntity(entity) {
  entityTextureRequests.set(entity,{});entity.texture=null;
}
function applyTextureToEntity(entity, asset) {
  const request={};entityTextureRequests.set(entity,request);
  const handle = getTextureHandle(asset);
  if (handle) { entity.texture = handle; entity.spriteMissingTexture = false; return; }
  (asset.pendingCallbacks = asset.pendingCallbacks || []).push(() => { if (!entity.destroyed&&entityTextureRequests.get(entity)===request) { entity.texture = getTextureHandle(asset); entity.spriteMissingTexture = false; } });
}

function syncSpriteRenderer(item) {
  if (!item || item.kind !== 'sprite' || !item.entity) return;
  // Keep the live canonical component identity stable while Inspector
  // controls are mounted. ensureComponent() normalizes by replacing the
  // record object; doing that after every individual field input left the
  // remaining controls holding a stale object, so a later resize/pivot
  // operation appeared to revert tint, opacity, sorting, or geometry edits.
  const component = item.components && item.components['sprite-renderer']
    ? item.components['sprite-renderer']
    : OpusAuthoring.ensureComponent(item, 'sprite-renderer');
  if (!component) return;
  const [r, g, b] = hexToRgb(component.tint || '#ffffff');
  item.entity.color = [r, g, b];
  syncSpriteSortingForItem(item);
  item.entity.unlit = true;
  item.entity.visible = item._anim && typeof item._anim.visibilityPose === 'boolean'
    ? item._anim.visibilityPose : component.visible !== false;
  clearTextureFromEntity(item.entity);
  const playback = item._spriteAnimationPlayback;
  const clip = playback && playback.started ? findSpriteAnimationById(playback.clipId) : null;
  const frame = clip && clip.frames && clip.frames[playback.currentFrameIndex];
  // Once playback has started, including the deterministic completed/final
  // hold state, the frame reference is authoritative. A missing frame
  // Sprite Asset intentionally resolves to the visible missing-source
  // placeholder rather than silently substituting the static fallback.
  const spriteAsset = frame ? findSpriteAssetById(frame.spriteAsset) : findSpriteAssetById(component.spriteAssetRef);
  const texture = spriteAsset ? sourceTextureForSpriteAsset(spriteAsset) : findTextureAssetById(component.sourceTexture);
  // Asset-owned default. Legacy direct-Texture Sprites remain Smooth.
  // This selects a renderer sampler; it never mutates the shared Texture.
  item.entity.textureSampling = spriteAsset && spriteAsset.filtering === 'nearest' ? 'nearest' : 'linear';
  // Phase 018: region metadata remains owned by the Sprite Asset. This is
  // the one bridge into the renderer's existing UV uniforms, so scene and
  // Prefab records never duplicate atlas coordinates.
  const sourceUV = OpusAuthoringPlumbing.spriteSourceUV(spriteAsset, texture);
  const effectiveFlip = OpusAuthoringPlumbing.spriteEffectiveFlip(component, playback);
  const presentedUV = OpusAuthoringPlumbing.applySpriteUVFlip(sourceUV, effectiveFlip.flipX, effectiveFlip.flipY);
  item.entity.uvScale = presentedUV.scale;
  item.entity.uvOffset = presentedUV.offset;
  const renderMode = component.renderMode === 'nine-slice' ? 'nine-slice' : 'simple';
  const nineSliceCells = renderMode === 'nine-slice' ? OpusAuthoringPlumbing.spriteNineSliceCells(spriteAsset, texture, {
    width: component.width, height: component.height, pivotX: component.pivotX, pivotY: component.pivotY,
    flipX: effectiveFlip.flipX, flipY: effectiveFlip.flipY,
  }) : null;
  // null means the documented safe Simple fallback. Cells live only on the
  // runtime Entity; the scene/Prefab record remains one Sprite Renderer.
  item.entity.spriteNineSliceCells = nineSliceCells;
  item.entity.spriteRenderer = { width: component.width, height: component.height, pivotX: component.pivotX, pivotY: component.pivotY, renderMode, flipX: effectiveFlip.flipX, flipY: effectiveFlip.flipY };
  item.entity.spriteMissingTexture = !texture;
  if (texture) applyTextureToEntity(item.entity, texture);
}

// Resolve stable Tile/TileSet/Sprite Asset IDs into transient render cells.
// Scene data never stores GPU handles, UVs, or duplicated Sprite metadata.
function syncTilemapRenderer(item) {
  if (!item || item.kind !== 'tilemap' || !item.entity) return;
  const tileset = findTilesetById(item.tilesetRef);
  const size = OpusAuthoringPlumbing.safeTilesetCellSize(tileset);
  const tiles = new Map((tileset && tileset.tiles || []).map((tile) => [tile.id, tile]));
  item.layers = OpusAuthoringPlumbing.serializeTilemapLayers(item);
  OpusAuthoringPlumbing.invalidateTilemapCellIndex(item);
  // Canonical authored order is bottom to top. Flattening only visible Layers
  // here keeps every internal draw contiguous inside this Tilemap sort slot.
  const renderCells = item.layers.flatMap((layer) => layer.visible === false ? [] : layer.cells.map((cell) => ({ ...cell, layerId: layer.id })));
  item.entity.tilemapRenderer = { layerCount: item.layers.length, cells: renderCells.map((cell) => {
    const tile = tiles.get(cell.tileId); const sprite = tile && findSpriteAssetById(tile.spriteAssetRef);
    const texture = sprite && sourceTextureForSpriteAsset(sprite); const natural = OpusAuthoringPlumbing.spriteNaturalSize(sprite, texture);
    const sourceUV = OpusAuthoringPlumbing.spriteSourceUV(sprite, texture) || { scale: [1, 1], offset: [0, 0] };
    if (texture && !texture.image) {
      item._tilemapPendingTextures = item._tilemapPendingTextures || new Set();
      if (!item._tilemapPendingTextures.has(texture.id)) {
        item._tilemapPendingTextures.add(texture.id);
        (texture.pendingCallbacks = texture.pendingCallbacks || []).push(() => {
          item._tilemapPendingTextures.delete(texture.id);
          if (placed.includes(item)) syncTilemapRenderer(item);
        });
      }
    }
    return {
      centerX: (cell.x + 0.5) * size.width, centerY: (cell.y + 0.5) * size.height,
      artWidth: natural ? natural.width : size.width, artHeight: natural ? natural.height : size.height,
      texture: texture ? getTextureHandle(texture) : null,
      sampling: sprite && sprite.filtering === 'nearest' ? 'nearest' : 'linear',
      uvScale: sourceUV.scale,
      uvOffset: sourceUV.offset,
      missing: !tile || !sprite || !texture,
      layerId: cell.layerId,
    };
  }) };
  item.entity.unlit = true; item.entity.alpha = 1;
  item.entity.spriteSortingLayerRef = item.sortingLayerRef || DEFAULT_SPRITE_SORTING_LAYER_ID;
  item.entity.spriteSortingLayerOrder = spriteSortingLayerOrder(item.entity.spriteSortingLayerRef);
  item.entity.spriteOrderInLayer = Number.isInteger(item.orderInLayer) ? item.orderInLayer : 0;
  item.entity.spriteStableId = item.id || '';
}

function resetSpriteAnimationForItem(item, autoplay) {
  if (!item || item.kind !== 'sprite') return;
  const component = item.components && item.components['sprite-renderer'];
  item._spriteAnimationPlayback = OpusAuthoringPlumbing.createSpriteAnimationPlayback(null, false);
  if (component) OpusAuthoringPlumbing.setSpriteDirection(item._spriteAnimationPlayback, component, component.initialDirection || 'none', findSpriteAnimationById);
  if (autoplay && component && component.playOnStart && component.initialAnimationStateRef) setSpriteAnimationState(item, component.initialAnimationStateRef, { restartIfActive: true });
  syncSpriteRenderer(item);
}
function setSpriteAnimationState(item, stateId, options) {
  if (!item || item.kind !== 'sprite') return false;
  const component = item.components && item.components['sprite-renderer'];
  item._spriteAnimationPlayback = item._spriteAnimationPlayback || OpusAuthoringPlumbing.createSpriteAnimationPlayback(null, false);
  const runtimeOptions = { ...(options || {}) };
  if (playMode) { runtimeOptions.targetSpriteId = item.id; runtimeOptions.onEvent = dispatchSpriteAnimationEvent; }
  const ok = OpusAuthoringPlumbing.setSpriteAnimationState(item._spriteAnimationPlayback, component, stateId, findSpriteAnimationById, runtimeOptions);
  syncSpriteRenderer(item);
  return ok;
}
function getCurrentSpriteAnimationState(item) {
  return item && item.kind === 'sprite' ? OpusAuthoringPlumbing.getSpriteAnimationState(item._spriteAnimationPlayback) : null;
}
function setSpriteDirection(item, direction) {
  if (!item || item.kind !== 'sprite') return false;
  const component = item.components && item.components['sprite-renderer'];
  item._spriteAnimationPlayback = item._spriteAnimationPlayback || OpusAuthoringPlumbing.createSpriteAnimationPlayback(null, false);
  const runtimeOptions = playMode ? { targetSpriteId: item.id, onEvent: dispatchSpriteAnimationEvent } : null;
  const ok = OpusAuthoringPlumbing.setSpriteDirection(item._spriteAnimationPlayback, component, direction, findSpriteAnimationById, runtimeOptions);
  if (ok) syncSpriteRenderer(item);
  return ok;
}
function getSpriteDirection(item) {
  return item && item.kind === 'sprite' ? OpusAuthoringPlumbing.getSpriteDirection(item._spriteAnimationPlayback) : null;
}
function setSpriteFlip(item, flipX, flipY) {
  if (!item || item.kind !== 'sprite') return false;
  const component = item.components && item.components['sprite-renderer'];
  if (!component) return false;
  component.flipX = !!flipX; component.flipY = !!flipY;
  syncSpriteRenderer(item);
  return true;
}
function playSpriteAnimation(item, restart) {
  if (!item || item.kind !== 'sprite') return false;
  const component = item.components && item.components['sprite-renderer'];
  const stateId = getCurrentSpriteAnimationState(item) || (component && component.initialAnimationStateRef);
  return !!stateId && setSpriteAnimationState(item, stateId, { restartIfActive: restart !== false });
}
function stopSpriteAnimation(item) {
  if (!item || item.kind !== 'sprite') return;
  OpusAuthoringPlumbing.stopSpriteAnimation(item._spriteAnimationPlayback);
  syncSpriteRenderer(item);
}
function restartSpriteAnimation(item) { return playSpriteAnimation(item, true); }
// The engine API is intentionally frozen. Publish editor/runtime sprite
// controls through an immutable facade instead of silently assigning to the
// frozen object (which left exported games without these methods).
window.Opus = Object.freeze({
  ...Opus,
  setSpriteAnimationState,
  getCurrentSpriteAnimationState,
  setSpriteDirection,
  getSpriteDirection,
  setSpriteFlip,
});
function updateSpriteAnimations(dt) {
  for (const item of placed) {
    if (item.kind !== 'sprite' || !item._spriteAnimationPlayback || !item._spriteAnimationPlayback.playing) continue;
    const clip = findSpriteAnimationById(item._spriteAnimationPlayback.clipId);
    const before = item._spriteAnimationPlayback.currentFrameIndex;
    OpusAuthoringPlumbing.advanceSpriteAnimation(item._spriteAnimationPlayback, clip, dt, playMode ? { targetSpriteId: item.id, stateId: item._spriteAnimationPlayback.currentStateId, onEvent: dispatchSpriteAnimationEvent } : null);
    if (before !== item._spriteAnimationPlayback.currentFrameIndex || item._spriteAnimationPlayback.completed) syncSpriteRenderer(item);
  }
}
// Decodes a data: URL into an Image, resolving once loaded (or rejecting on
// a corrupt/unsupported image) -- the one place that knows how to turn
// texture-asset bytes into something app.createTexture can actually use.
function validateTexturePNGIntegrity(dataURL) {
  if(typeof dataURL!=='string'||!/^data:image\/png;base64,/i.test(dataURL))return;
  const raw=atob(dataURL.slice(dataURL.indexOf(',')+1)),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const signature=[137,80,78,71,13,10,26,10];
  if(bytes.length<20||!signature.every((v,i)=>bytes[i]===v))throw new Error('PNG signature is invalid');
  const uint32=p=>((bytes[p]*0x1000000)+(bytes[p+1]<<16)+(bytes[p+2]<<8)+bytes[p+3])>>>0;
  let ended=false;
  for(let p=8;p<bytes.length;){
    if(p+12>bytes.length)throw new Error('PNG chunk is truncated');
    const length=uint32(p),end=p+8+length;
    if(end+4>bytes.length)throw new Error('PNG chunk payload is truncated');
    let crc=0xffffffff;
    for(let i=p+4;i<end;i++){crc^=bytes[i];for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    if(((crc^0xffffffff)>>>0)!==uint32(end))throw new Error('PNG pixel data failed its integrity check');
    if(bytes[p+4]===73&&bytes[p+5]===69&&bytes[p+6]===78&&bytes[p+7]===68){ended=true;break;}
    p=end+4;
  }
  if(!ended)throw new Error('PNG end chunk is missing');
}
function decodeTextureImage(dataURL) {
  return new Promise((resolve, reject) => {
    try{validateTexturePNGIntegrity(dataURL);}catch(error){reject(error);return;}
    const img = new Image();
    // onload/naturalWidth can succeed for damaged PNGs whose pixel payload
    // cannot be uploaded. Require complete pixel decode before GPU ownership.
    img.onload = async () => {try {if(typeof img.decode==='function')await img.decode();resolve(img);}catch(error){reject(new Error('could not decode image pixels'));}};
    img.onerror = () => reject(new Error('could not decode image data'));
    img.src = dataURL;
  });
}
// Wave 6B (Priority D): a terrain's own textured paint layers (up to 3,
// `record.options.paintEdits.layers[li].textureAssetId`) are collected the
// same way as a cube's single `textureAssetId` -- both usage-counting
// (below) and serialization (serializeTextureAssets) recognize them, so a
// texture referenced ONLY by a terrain layer is never wrongly reported as
// unused or dropped from a portable export.
function terrainLayerTextureIds(record) {
  const paintEdits = record.options && record.options.paintEdits;
  if (!paintEdits || !paintEdits.layers) return [];
  return paintEdits.layers.map((l) => l.textureAssetId).filter(Boolean);
}
function computeTextureUsageCount(textureId) {
  syncCurrentLevelObjects();
  let count = 0;
  for (const level of levels) {
    count += (level.ui?.hudElements || []).filter(el => el.kind === 'image' && el.textureAssetId === textureId).length;
    for (const record of level.objects) {
      if (record.kind === 'cube' && record.textureAssetId === textureId) count++;
      else if (record.kind === 'sprite' && record.components && record.components['sprite-renderer'] && record.components['sprite-renderer'].sourceTexture === textureId) count++;
      else if (record.kind === 'terrain') count += terrainLayerTextureIds(record).filter((id) => id === textureId).length;
    }
  }
  count += spriteAssets.filter((asset) => asset.sourceTexture === textureId).length;
  count += (typeof materialAssets==='undefined'?[]:materialAssets).filter((asset) => asset?.descriptor?.textureAssetRef === textureId).length;
  return count;
}
function serializeTextureAssets(usedIds) {
  const used = usedIds || collectProjectDependencies().textureAssets;
  return textureAssets.filter((t) => used.has(t.id)).map((t) => copyPortableAssetExtras(t,{ id: t.id, name: t.name, dataURL: t.dataURL, sourceFilename: t.sourceFilename, width: t.width || (t.image && (t.image.naturalWidth || t.image.width)) || undefined, height: t.height || (t.image && (t.image.naturalHeight || t.image.height)) || undefined, folder: t.folder || undefined, tags: (t.tags && t.tags.length) ? t.tags.slice() : undefined }));
}
// Additive merge, same policy as loadAssets/portable prefabs. Starts the
// (async) image decode for each bundled texture immediately; any cube
// records already loaded that reference it get their entity.texture filled
// in once decode completes (see instantiateCubeRecord's applyTextureToEntity call).
function loadTextureAssets(bundledTextures, reusableTextures = []) {
  if (!Array.isArray(bundledTextures)) return;
  for (const t of bundledTextures) {
    if (findTextureAssetById(t.id)) continue;
    reconcileTextureIdCounter(t.id);
    const asset = copyPortableAssetExtras(t,{ id: t.id, name: t.name, dataURL: t.dataURL, sourceFilename: t.sourceFilename, width: t.width, height: t.height, image: null, textureHandle: null, pendingCallbacks: [], folder: t.folder || '', tags: t.tags ? t.tags.slice() : [] });
    textureAssets.push(asset);
    // Full-document replacement retires record identity, even when immutable
    // image bytes/GPU storage can be reused. Never carry old pending callbacks.
    const reusable=reusableTextures.filter(old=>old?.id===t.id&&old.dataURL===t.dataURL&&old.image&&old.textureHandle&&!old.decodeError);
    if(reusable.length===1){asset.image=reusable[0].image;asset.textureHandle=reusable[0].textureHandle;continue;}
    decodeTextureImage(t.dataURL).then((img) => {
      // History/project load can replace the library while decoding. Stable
      // IDs may be reused, so identity (not ID alone) owns deferred callbacks.
      if(findTextureAssetById(asset.id)!==asset){asset.pendingCallbacks=[];return;}
      asset.image = img;
      asset.width = img.naturalWidth || img.width;
      asset.height = img.naturalHeight || img.height;
      const callbacks = asset.pendingCallbacks || [];
      asset.pendingCallbacks = [];
      callbacks.forEach((cb) => cb());
      renderTextureLibrary();
      renderSpriteLibrary();
    }).catch((error) => {if(findTextureAssetById(asset.id)!==asset){asset.pendingCallbacks=[];return;}asset.decodeError=error.message;renderTextureLibrary();showStatus(`Texture "${asset.name}" failed to decode: ${error.message}. Source retained; reimport a valid image.`);});
  }
  renderTextureLibrary();
}

function assignTextureFromLibrary(assetId) {
  if (playMode) { showStatus('Stop Play before assigning a Texture.'); return false; }
  const item = selectedItem, asset = findTextureAssetById(assetId);
  if (selectedItems.size !== 1 || !item || item.kind !== 'cube' || !item.entity || !placed.includes(item)) { showStatus('Select one Mesh or Billboard to assign this Texture. Sprite textures belong to Sprite Assets.'); return false; }
  if (!asset || asset.decodeError) { showStatus('Texture is unavailable; selection unchanged.'); return false; }
  if (materialTextureRef(item) === assetId) { showStatus('Texture already assigned.'); return false; }
  pushUndo();
  applyTextureAssetToItem(item, assetId);
  renderInspector(); renderTextureLibrary();
  showStatus('Assigned Texture: ' + asset.name);
  return true;
}
function renderTextureLibrary() {
  // HUD Image authoring uses this same project-local asset library. Import,
  // rename and deletion must refresh the mounted chooser and missing previews.
  if (typeof renderHudElementList === 'function') renderHudElementList();
  // Wave 6 (Priority H): keep the Sky Panorama dropdown's option list
  // (built off this SAME textureAssets array) in sync with the Texture
  // Library any time it changes -- import, rename, delete -- rather than
  // only refreshing it when the Environment section happens to re-render
  // for an unrelated reason.
  if (typeof renderEnvironmentPanel === 'function') renderEnvironmentPanel();
  const listEl = document.getElementById('texture-library-list');
  if (!listEl) return;
  const searchEl = document.getElementById('texture-library-search');
  const folderEl = document.getElementById('texture-library-folder-filter');
  const query = searchEl ? searchEl.value.trim() : '';
  const folder = folderEl ? folderEl.value : '';
  if (folderEl) populateAssetFolderFilter(folderEl, textureAssets, folder);
  if (textureAssets.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No textures imported yet.</p>';
    return;
  }
  const visible = textureAssets.filter((t) => assetMatchesFilter(t, query, folder));
  if (visible.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No textures match this search.</p>';
    return;
  }
  listEl.innerHTML = visible.map((t) => {
    const usage = computeTextureUsageCount(t.id);
    const status = t.decodeError ? 'decode failed' : t.image ? `${t.image.naturalWidth}×${t.image.naturalHeight}` : 'decoding…';
    return `
    <div class="asset-row" data-texture-id="${t.id}">
      <div class="asset-row-header">
        <span class="asset-row-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>
      </div>
      <div class="asset-row-meta">${escapeHtml(OpusAuthoringPlumbing.assetTypes.get('texture').displayName)} · ${status} · used ${usage}×</div>
      ${t.decodeError ? `<div class="asset-row-meta" role="alert">${escapeHtml(t.decodeError)}. Source retained; reimport a valid image.</div>` : ''}
      ${assetTagsRowHtml(t,true)}
      <div class="asset-row-actions">
        <button type="button" data-apply-texture="${escapeHtml(t.id)}" title="Assign to one selected Mesh or Billboard; Sprite images are owned by Sprite Assets">Assign to selected Mesh</button>
        <button data-create-sprite-from-texture="${t.id}">Create Sprite</button>
        <button data-rename-texture="${t.id}">Rename</button>
        <button data-delete-texture="${t.id}">Delete</button>
      </div>
    </div>`;
  }).join('');
  listEl.querySelectorAll('[data-create-asset-variant]').forEach(button=>bindTextureAssetVariant(button,findTextureAssetById(button.dataset.createAssetVariant)));
  listEl.querySelectorAll('[data-apply-texture]').forEach(button => { button.onclick = () => assignTextureFromLibrary(button.dataset.applyTexture); });
  listEl.querySelectorAll('[data-create-sprite-from-texture]').forEach((btn) => {
    btn.onclick = () => createSpriteAssetFromTexture(findTextureAssetById(btn.dataset.createSpriteFromTexture), { select: true });
  });
  listEl.querySelectorAll('[data-rename-texture]').forEach((btn) => {
    btn.onclick = () => {
      const asset = findTextureAssetById(btn.dataset.renameTexture);
      if (!asset) return;
      const name = prompt('Texture name:', asset.name);
      if (name && name.trim()) { asset.name = name.trim(); renderTextureLibrary(); renderInspector(); }
    };
  });
  listEl.querySelectorAll('[data-delete-texture]').forEach((btn) => {
    btn.onclick = () => {
      const asset = findTextureAssetById(btn.dataset.deleteTexture);
      if (!asset) return;
      const usage = computeTextureUsageCount(asset.id);
      const dependentSprites = spriteAssets.filter((sprite) => sprite.sourceTexture === asset.id);
      if (usage > 0 && !confirm(`"${asset.name}" has ${usage} dependent use${usage === 1 ? '' : 's'}${dependentSprites.length ? `, including ${dependentSprites.length} Sprite Asset${dependentSprites.length === 1 ? '' : 's'}` : ''}. Delete the Texture and leave repairable missing references?`)) return;
      if (asset.textureHandle) app.destroyTexture(asset.textureHandle);
      textureAssets = textureAssets.filter((t) => t.id !== asset.id);
      renderTextureLibrary();
      renderSpriteLibrary();
      for (const item of placed) if (item.kind === 'sprite') syncSpriteRenderer(item);
      showStatus(`Deleted texture "${asset.name}"${usage ? '; dependent references remain for repair' : ''}`);
    };
  });
  listEl.querySelectorAll('[data-asset-tagedit]').forEach((input) => {
    bindAssetMetadataInput(input,findTextureAssetById(input.dataset.assetTagedit),()=>textureAssets,renderTextureLibrary);
  });
}
renderTextureLibrary();
document.getElementById('texture-library-search').addEventListener('input', renderTextureLibrary);
document.getElementById('texture-library-folder-filter').addEventListener('change', renderTextureLibrary);

// Phase 012: first-class Sprite metadata. Image bytes remain owned solely
// by Texture Assets; this collection contains stable references and small,
// reusable authoring values only.
function createSpriteAssetFromTexture(texture, options) {
  if (!texture) { showStatus('Choose a Texture Asset first'); return null; }
  const opts = options || {};
  const asset = OpusAuthoringPlumbing.createSpriteAsset({
    id: generateSpriteAssetId(), name: OpusAuthoringPlumbing.uniqueAssetName(opts.name || `${texture.name} Sprite`, spriteAssets.map((entry) => entry.name)), sourceTexture: texture.id,
    sourceRect: opts.sourceRect || null,
    pivot: opts.pivot || [0.5, 0.5], pixelsPerUnit: opts.pixelsPerUnit || 100, filtering: opts.filtering || 'linear',
    folder: texture.folder || undefined, tags: texture.tags || undefined,
  });
  spriteAssets.push(asset);
  if (opts.select !== false) selectedSpriteAssetId = asset.id;
  renderSpriteLibrary(); renderTextureLibrary();
  showStatus(`Created Sprite Asset "${asset.name}" from Texture "${texture.name}"`);
  return asset;
}
function serializeSpriteAssets(usedIds) {
  const used = usedIds || collectProjectDependencies().spriteAssets;
  return spriteAssets.filter((asset) => used.has(asset.id)).map((asset) => OpusAuthoringPlumbing.createSpriteAsset(asset));
}
function loadSpriteAssets(bundledSprites) {
  if (!Array.isArray(bundledSprites)) return;
  for (const record of bundledSprites) {
    if (findSpriteAssetById(record.id)) continue;
    reconcileSpriteAssetIdCounter(record.id);
    spriteAssets.push(OpusAuthoringPlumbing.createSpriteAsset(record));
  }
  renderSpriteLibrary();
}
function computeSpriteAssetUsageCount(id) {
  syncCurrentLevelObjects();
  let count = 0;
  for (const level of levels) for (const record of level.objects || []) {
    const renderer = record.kind === 'sprite' && record.components && record.components['sprite-renderer'];
    if (renderer && renderer.spriteAssetRef === id) count++;
  }
  for (const prefab of prefabs) for (const record of (prefab.records || (prefab.record ? [prefab.record] : []))) {
    const renderer = record.kind === 'sprite' && record.components && record.components['sprite-renderer'];
    if (renderer && renderer.spriteAssetRef === id) count++;
  }
  for (const clip of spriteAnimationClips) count += (clip.frames || []).filter((frame) => frame.spriteAsset === id).length;
  for (const tileset of tilesets) count += (tileset.tiles || []).filter((tile) => tile.spriteAssetRef === id).length;
  return count;
}
function placeSpriteAssetInstance(asset, position) {
  if (!asset) { showStatus('Sprite Asset is unavailable; nothing was placed'); return null; }
  const texture = sourceTextureForSpriteAsset(asset);
  const record = OpusAuthoringPlumbing.createSpritePlacementRecord(asset, texture, position, placed.map((entry) => entry.name));
  pushUndo();
  const item = instantiateSpriteRecord(record, position);
  item.name = record.name;
  addPlaced(item); selectItem(item); renderSceneList(); renderInspector();
  showStatus(`Placed ${item.name} using "${asset.name}"${texture ? ' at natural size' : ' with a repairable missing-source placeholder'}`);
  return item;
}

function wireSpriteAssetDragSource(row, asset, texture) {
  row.style.touchAction = 'none';
  row.addEventListener('pointerdown', (event) => {
    if (playMode || event.button !== 0 || event.target.closest('button,input,select,textarea')) return;
    const payload = OpusAuthoringPlumbing.createSpritePlacementPayload(asset.id);
    const previewHtml = `${spriteRegionPreviewHtml(asset, texture, 44)}<span>${escapeHtml(asset.name)}</span>`;
    beginPlacementPointerDrag(event, payload, asset.name, { previewHtml });
  });
  row.addEventListener('click', (event) => {
    if (event.target.closest('button,input,select,textarea')) return;
    selectedSpriteAssetId = asset.id;
    renderSpriteAssetInspector();
  });
}
function spriteRegionPreviewHtml(asset, texture, size) {
  if (!texture) return '<div class="sprite-thumbnail" role="img" aria-label="Missing source Texture" style="display:grid;place-items:center;color:#e08a63">Missing</div>';
  const dims = OpusAuthoringPlumbing.textureDimensions(texture);
  const region = OpusAuthoringPlumbing.spriteRegionPixels(asset, texture);
  const box = size || 52;
  if (!dims || !region) return `<img class="sprite-thumbnail" src="${texture.dataURL}" alt="Preview of ${escapeHtml(asset.name)}">`;
  const scale = Math.min(box / region.width, box / region.height);
  const left = -region.x * scale + (box - region.width * scale) / 2;
  const top = -region.y * scale + (box - region.height * scale) / 2;
  const guides = asset.nineSlice;
  const guideHtml = guides ? `<span class="nine-slice-guide vertical left" style="left:${guides.left / region.width * 100}%"></span><span class="nine-slice-guide vertical right" style="left:${(region.width - guides.right) / region.width * 100}%"></span><span class="nine-slice-guide horizontal top" style="top:${guides.top / region.height * 100}%"></span><span class="nine-slice-guide horizontal bottom" style="top:${(region.height - guides.bottom) / region.height * 100}%"></span>` : '';
  return `<div class="sprite-thumbnail sprite-region-thumbnail${guides ? ' has-nine-slice-guides' : ''}" role="img" aria-label="Region preview of ${escapeHtml(asset.name)}${guides ? ' with Nine-Slice Guides' : ''}" style="width:${box}px;height:${box}px;flex:0 0 ${box}px"><img src="${texture.dataURL}" alt="" style="width:${dims.width * scale}px;height:${dims.height * scale}px;left:${left}px;top:${top}px">${guideHtml}</div>`;
}
function renderSpriteAssetInspector() {
  const host = document.getElementById('sprite-asset-inspector');
  if (!host) return;
  const asset = findSpriteAssetById(selectedSpriteAssetId);
  if (!asset) { host.innerHTML = ''; return; }
  const texture = sourceTextureForSpriteAsset(asset);
  const dimensions = OpusAuthoringPlumbing.textureDimensions(texture);
  const region = OpusAuthoringPlumbing.spriteRegionPixels(asset, texture);
  const natural = OpusAuthoringPlumbing.spriteNaturalSize(asset, texture);
  const contentGuard=createAssetContentEditGuard(asset,()=>spriteAssets);
  host.innerHTML = `<div class="asset-row" data-sprite-inspector="${asset.id}"><strong>Sprite Asset Inspector</strong>
    <div class="sprite-asset-preview">${spriteRegionPreviewHtml(asset, texture, 160)}<span>${texture ? `${escapeHtml(texture.name)}<br>${dimensions ? `${dimensions.width} × ${dimensions.height} px source` : 'decoding…'}<br>${region ? `${region.width} × ${region.height} px region` : ''}` : 'Missing source Texture'}</span></div>
    <div data-sprite-asset-fields></div><div data-sprite-region-fields></div><div data-nine-slice-fields></div>
    ${texture && dimensions && region ? `<div class="sprite-region-editor" data-region-editor><div class="sprite-region-stage" style="aspect-ratio:${dimensions.width}/${dimensions.height}"><img src="${texture.dataURL}" alt="Full source Texture"><div class="sprite-region-selection" data-region-selection><span data-region-handle title="Resize Source Region"></span></div><div data-grid-preview></div></div><p class="field-help">Drag the rectangle to move it; drag its lower-right handle to resize. Coordinates use a top-left origin.</p></div>` : ''}
    <div class="field-pair"><button type="button" class="toolbar-btn" data-use-full-image ${texture ? '' : 'disabled'}>Use Full Image</button></div>
    ${texture && dimensions ? `<details class="sprite-grid-slicer"><summary>Slice as Grid</summary><div class="sprite-grid-inputs"><label>Cell W<input type="number" data-grid-cell-width min="1" step="1" value="${Math.max(1, Math.floor(dimensions.width / 4))}"></label><label>Cell H<input type="number" data-grid-cell-height min="1" step="1" value="${Math.max(1, Math.floor(dimensions.height / 4))}"></label><label>Margin X<input type="number" data-grid-margin-x min="0" step="1" value="0"></label><label>Margin Y<input type="number" data-grid-margin-y min="0" step="1" value="0"></label><label>Spacing X<input type="number" data-grid-spacing-x min="0" step="1" value="0"></label><label>Spacing Y<input type="number" data-grid-spacing-y min="0" step="1" value="0"></label></div><label>Base Name<input type="text" data-grid-base-name value="${escapeHtml(asset.name.replace(/\s+Sprite(?:\s+Copy)?$/i, '') || 'sprite')}"></label><p class="field-help" data-grid-summary></p><button type="button" class="toolbar-btn" data-create-grid-sprites>Create Sprite Assets</button></details>` : ''}
  </div>`;
  const fieldsHost = host.querySelector('[data-sprite-asset-fields]');
  const fields = [
    { key: 'name', label: 'Name', type: 'string', required: true, defaultValue: 'Sprite' },
    { key: 'sourceTexture', label: 'Source Texture', type: 'assetRef', allowedAssetTypes: ['texture'], nullable: true, defaultValue: null },
    { key: 'pivotX', label: 'Pivot X', type: 'number', min: 0, max: 1, step: 0.05, required: true, defaultValue: 0.5 },
    { key: 'pivotY', label: 'Pivot Y', type: 'number', min: 0, max: 1, step: 0.05, required: true, defaultValue: 0.5 },
    { key: 'pixelsPerUnit', label: 'Pixels Per Unit', type: 'number', min: 0.001, step: 1, required: true, defaultValue: 100 },
    { key: 'filtering', label: 'Sampling', help: 'Smooth blends neighboring pixels for normal artwork. Pixel / Nearest keeps hard pixel edges when scaled.', type: 'enum', choices: ['linear', 'nearest'], choiceLabels: { linear: 'Smooth', nearest: 'Pixel / Nearest' }, required: true, defaultValue: 'linear' },
  ];
  const values = {
    name: asset.name, sourceTexture: asset.sourceTexture,
    pivotX: asset.pivot[0], pivotY: asset.pivot[1], pixelsPerUnit: asset.pixelsPerUnit, filtering: asset.filtering,
  };
  OpusInspectorFields.mountSection(fieldsHost, {
    id: 'sprite-asset', label: 'Sprite Asset Metadata', category: 'Images', fields, values,
    canChange:contentGuard.allowed,onBeforeChange:contentGuard.beforeChange,
    optionsFor: (field) => field.key === 'sourceTexture' ? textureAssets.map((item) => ({ value: item.id, label: item.name })) : [],
    onChange: (field, value) => {
      if (field.key === 'name') asset.name = value.trim() || asset.name;
      else if (field.key === 'sourceTexture') asset.sourceTexture = value || null;
      else if (field.key === 'pivotX') asset.pivot[0] = value;
      else if (field.key === 'pivotY') asset.pivot[1] = value;
      else if (field.key === 'pixelsPerUnit') asset.pixelsPerUnit = value;
      else if (field.key === 'filtering') asset.filtering = value === 'nearest' ? 'nearest' : 'linear';
      contentGuard.updated();
      for (const item of placed) if (item.kind === 'sprite') syncSpriteRenderer(item);
      renderSpriteLibrary(field.key!=='sourceTexture');
      return OpusAuthoringPlumbing.assetTypes.get('sprite').validateMetadata(asset);
    },
  });
  const regionHost = host.querySelector('[data-sprite-region-fields]');
  const regionFields = [
    { key: 'sourceX', label: 'X', type: 'number', min: 0, step: 1, required: true, defaultValue: 0 },
    { key: 'sourceY', label: 'Y', type: 'number', min: 0, step: 1, required: true, defaultValue: 0 },
    { key: 'sourceRegionWidth', label: 'Width', type: 'number', min: 1, step: 1, required: true, defaultValue: 1 },
    { key: 'sourceRegionHeight', label: 'Height', type: 'number', min: 1, step: 1, required: true, defaultValue: 1 },
    { key: 'sourceDimensions', label: 'Source Texture', type: 'string', readOnly: true, defaultValue: 'Unavailable' },
    { key: 'regionNaturalSize', label: 'Region Natural Size', type: 'string', readOnly: true, defaultValue: 'Unavailable' },
  ];
  OpusInspectorFields.mountSection(regionHost, {
    id: 'sprite-source-region', label: 'Source Region', category: 'Images', fields: regionFields,
    canChange:contentGuard.allowed,onBeforeChange:contentGuard.beforeChange,
    values: { sourceX: region ? region.x : 0, sourceY: region ? region.y : 0, sourceRegionWidth: region ? region.width : 1, sourceRegionHeight: region ? region.height : 1, sourceDimensions: dimensions ? `${dimensions.width} × ${dimensions.height} px` : 'Unavailable', regionNaturalSize: natural ? `${natural.width.toFixed(3)} × ${natural.height.toFixed(3)} world units` : 'Unavailable' },
    onChange: (field, value) => {
      const current = OpusAuthoringPlumbing.spriteRegionPixels(asset, sourceTextureForSpriteAsset(asset)) || { x: 0, y: 0, width: 1, height: 1 };
      const key = { sourceX: 'x', sourceY: 'y', sourceRegionWidth: 'width', sourceRegionHeight: 'height' }[field.key];
      if (key) { asset.sourceRect = { ...current, [key]: value };contentGuard.updated(); for (const item of placed) if (item.kind === 'sprite') syncSpriteRenderer(item); renderSpriteLibrary(true); }
      return OpusAuthoringPlumbing.validateSpriteSourceRect(asset, sourceTextureForSpriteAsset(asset));
    },
  });
  const fullButton = host.querySelector('[data-use-full-image]');
  if (fullButton) fullButton.onclick = () => { if(asset.sourceRect==null)return;if(!contentGuard.beforeChange())return;asset.sourceRect = null;contentGuard.updated();for (const item of placed) if (item.kind === 'sprite') syncSpriteRenderer(item); renderSpriteLibrary(); showStatus(`"${asset.name}" now uses the full source image`); };
  const guidesHost = host.querySelector('[data-nine-slice-fields]');
  if (guidesHost) {
    const guides = asset.nineSlice;
    guidesHost.innerHTML = `<section class="inspector-section nine-slice-guide-editor"><h4>Nine-Slice Guides</h4><p class="field-help">Left/Right define fixed-width side regions; Top/Bottom define fixed-height regions. Values are source pixels inside the ${region ? `${region.width} × ${region.height} px region` : 'current source region'}.</p>${guides ? `<div class="nine-slice-guide-grid">${['left', 'right', 'top', 'bottom'].map((key) => `<label>${key[0].toUpperCase() + key.slice(1)}<input type="number" min="0" step="1" data-nine-slice-guide="${key}" value="${escapeHtml(guides[key])}"></label>`).join('')}</div><button type="button" class="toolbar-btn" data-clear-nine-slice>Clear Guides</button><p class="field-help">The preview lines show the 3 × 3 partition. Numeric editing is used instead of draggable lines to keep source-region dragging unambiguous.</p>` : '<button type="button" class="toolbar-btn" data-enable-nine-slice>Enable / Define Nine-Slice Guides</button><p class="field-help">Guides begin at zero; artwork intent is never guessed.</p>'}</section>`;
    const enable = guidesHost.querySelector('[data-enable-nine-slice]');
    if (enable) enable.onclick = () => { if(asset.nineSlice!=null)return;if(!contentGuard.beforeChange())return;asset.nineSlice = { left: 0, right: 0, top: 0, bottom: 0 };contentGuard.updated();renderSpriteLibrary(); validateCurrentProject(); showStatus(`Enabled Nine-Slice Guides for "${asset.name}"`); };
    const clear = guidesHost.querySelector('[data-clear-nine-slice]');
    if (clear) clear.onclick = () => { if(asset.nineSlice==null)return;if(!contentGuard.beforeChange())return;asset.nineSlice = null;contentGuard.updated();for (const item of placed) if (item.kind === 'sprite') syncSpriteRenderer(item); renderSpriteLibrary(); validateCurrentProject(); showStatus(`Cleared Nine-Slice Guides for "${asset.name}"`); };
    guidesHost.querySelectorAll('[data-nine-slice-guide]').forEach((input) => {
      bindSpriteNineSliceInput(input,asset,()=>spriteAssets,texture,()=>{for (const item of placed) if (item.kind === 'sprite') syncSpriteRenderer(item);renderSpriteLibrary();validateCurrentProject();});
    });
  }
  wireSpriteRegionEditor(host, asset, texture, dimensions);
  wireSpriteGridSlicer(host, asset, texture, dimensions);
}
function wireSpriteRegionEditor(host, asset, texture, dimensions) {
  const stage = host.querySelector('.sprite-region-stage');
  const selection = host.querySelector('[data-region-selection]');
  if (!stage || !selection || !texture || !dimensions) return;
  function bounded(rect) {
    const width = Math.max(1, Math.min(dimensions.width, Math.round(rect.width)));
    const height = Math.max(1, Math.min(dimensions.height, Math.round(rect.height)));
    return { x: Math.max(0, Math.min(dimensions.width - width, Math.round(rect.x))), y: Math.max(0, Math.min(dimensions.height - height, Math.round(rect.y))), width, height };
  }
  function paint(rect=OpusAuthoringPlumbing.spriteRegionPixels(asset, texture)) {
    selection.style.left = `${rect.x / dimensions.width * 100}%`; selection.style.top = `${rect.y / dimensions.height * 100}%`;
    selection.style.width = `${rect.width / dimensions.width * 100}%`; selection.style.height = `${rect.height / dimensions.height * 100}%`;
  }
  paint();
  selection.onpointerdown = (event) => {
    if(event.button!==0)return;
    const guard=createAssetContentEditGuard(asset,()=>spriteAssets);
    if(!guard.allowed()||sourceTextureForSpriteAsset(asset)!==texture)return;
    const start = { ...OpusAuthoringPlumbing.spriteRegionPixels(asset, texture) };
    let draft={...start},active=true;
    const stageRect=stage.getBoundingClientRect();if(!(stageRect.width>0&&stageRect.height>0))return;
    const originX = event.clientX; const originY = event.clientY;
    const resizing = !!event.target.closest('[data-region-handle]');
    const cleanup=()=>{active=false;selection.onpointermove=null;selection.onpointerup=null;selection.onpointercancel=null;selection.onlostpointercapture=null;window.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel);if(selection.hasPointerCapture(event.pointerId))selection.releasePointerCapture(event.pointerId);};
    const cancel=()=>{if(!active)return;cleanup();paint();};
    const escape=key=>{if(key.key==='Escape'){key.preventDefault();cancel();}};
    event.preventDefault();try{selection.setPointerCapture(event.pointerId);}catch(error){active=false;return;}
    window.addEventListener('keydown',escape);window.addEventListener('blur',cancel);
    selection.onpointermove = (move) => {
      if(move.pointerId!==event.pointerId||!active)return;
      if(!guard.allowed()||sourceTextureForSpriteAsset(asset)!==texture){cancel();return;}
      const dx = (move.clientX - originX) / stageRect.width * dimensions.width;
      const dy = (move.clientY - originY) / stageRect.height * dimensions.height;
      if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
      draft=bounded(resizing ? { ...start, width: start.width + dx, height: start.height + dy } : { ...start, x: start.x + dx, y: start.y + dy });
      paint(draft);
    };
    selection.onpointerup = up => { if(up.pointerId!==event.pointerId||!active)return;cleanup();if(JSON.stringify(draft)===JSON.stringify(start)){paint();return;}if(sourceTextureForSpriteAsset(asset)!==texture||!guard.beforeChange()){paint();return;}asset.sourceRect={...draft};guard.updated();for (const item of placed) if (item.kind === 'sprite') syncSpriteRenderer(item);renderSpriteLibrary();showStatus(`Updated source region for "${asset.name}"`); };
    selection.onpointercancel=cancel;selection.onlostpointercapture=cancel;
  };
}
function boundedSpriteGridRegions(dimensions,options) {
  for(const key of ['cellWidth','cellHeight','marginX','marginY','spacingX','spacingY'])if(!Number.isSafeInteger(options[key])||options[key]<(key.startsWith('cell')?1:0))throw new Error('Use positive whole-pixel cells and non-negative whole-pixel margins/spacing.');
  const columns=Math.max(0,1+Math.floor((dimensions.width-options.marginX-options.cellWidth)/(options.cellWidth+options.spacingX))),rows=Math.max(0,1+Math.floor((dimensions.height-options.marginY-options.cellHeight)/(options.cellHeight+options.spacingY)));
  if(!Number.isSafeInteger(columns*rows)||columns*rows>4096)throw new Error('Grid slicing supports at most 4096 Sprite Assets per operation; increase cell size.');
  return OpusAuthoringPlumbing.sliceSpriteGrid(dimensions.width,dimensions.height,options);
}
function wireSpriteGridSlicer(host, template, texture, dimensions) {
  const createButton = host.querySelector('[data-create-grid-sprites]');
  if (!createButton || !texture || !dimensions) return;
  const contentGuard=createAssetContentEditGuard(template,()=>spriteAssets);
  const read = () => ({
    cellWidth: Number(host.querySelector('[data-grid-cell-width]').value), cellHeight: Number(host.querySelector('[data-grid-cell-height]').value),
    marginX: Number(host.querySelector('[data-grid-margin-x]').value), marginY: Number(host.querySelector('[data-grid-margin-y]').value),
    spacingX: Number(host.querySelector('[data-grid-spacing-x]').value), spacingY: Number(host.querySelector('[data-grid-spacing-y]').value),
  });
  const previewHost = host.querySelector('[data-grid-preview]'); const summary = host.querySelector('[data-grid-summary]');
  function preview() {
    let rects;try{rects=boundedSpriteGridRegions(dimensions,read());}catch(error){summary.textContent=error.message;previewHost.innerHTML='';createButton.disabled=true;return [];}
    summary.textContent = `${rects.length} region${rects.length === 1 ? '' : 's'} will be created; the source Texture payload remains shared.`;
    previewHost.innerHTML = rects.slice(0, 256).map((rect) => `<span class="sprite-grid-cell-preview" style="left:${rect.x / dimensions.width * 100}%;top:${rect.y / dimensions.height * 100}%;width:${rect.width / dimensions.width * 100}%;height:${rect.height / dimensions.height * 100}%"></span>`).join('');
    createButton.disabled = rects.length === 0;
    return rects;
  }
  host.querySelectorAll('[data-grid-cell-width],[data-grid-cell-height],[data-grid-margin-x],[data-grid-margin-y],[data-grid-spacing-x],[data-grid-spacing-y]').forEach((input) => { input.oninput = preview; });
  createButton.onclick = () => {
    if(!contentGuard.allowed())return;
    const rects = preview(); if (!rects.length) return;
    const baseName = host.querySelector('[data-grid-base-name]').value;
    const names = OpusAuthoringPlumbing.spriteGridNames(baseName, rects.length, spriteAssets.map((entry) => entry.name));
    const used=new Set(spriteAssets.map(asset=>asset.id));let created;
    try{created=rects.map((sourceRect,index)=>{let id;for(let attempts=0;attempts<=used.size;attempts++){const candidate=generateSpriteAssetId();if(typeof candidate==='string'&&candidate&&!used.has(candidate)){id=candidate;break;}}if(!id)throw new Error('Could not allocate distinct Sprite identities; unchanged.');used.add(id);return OpusAuthoringPlumbing.createSpriteAsset({id,name:names[index],sourceTexture:texture.id,sourceRect,pivot:template.pivot,pixelsPerUnit:template.pixelsPerUnit,filtering:template.filtering,folder:template.folder,tags:template.tags});});}catch(error){showStatus(error.message||'Sprite preparation failed; unchanged.');return;}
    if(!contentGuard.beforeChange())return;
    spriteAssets.push(...created); selectedSpriteAssetId = created[0].id; renderSpriteLibrary(); renderTextureLibrary(); showStatus(`Created ${created.length} Sprite Assets from one shared Texture`);
  };
  preview();
}
function renderSpriteLibrary(skipInspector=false) {
  const listEl = document.getElementById('sprite-library-list');
  if (!listEl) return;
  const query = document.getElementById('sprite-library-search').value.trim();
  const folderEl = document.getElementById('sprite-library-folder-filter');
  const folder = folderEl.value;
  populateAssetFolderFilter(folderEl, spriteAssets, folder);
  const visible = spriteAssets.filter((asset) => assetMatchesFilter(asset, query, folder));
  listEl.innerHTML = visible.length ? visible.map((asset) => {
    const texture = sourceTextureForSpriteAsset(asset);
    const natural = OpusAuthoringPlumbing.spriteNaturalSize(asset, texture);
    return `<div class="asset-row sprite-placement-source" data-sprite-asset-id="${asset.id}" title="Drag into the viewport to place; click to inspect">
      <div class="sprite-asset-preview">${spriteRegionPreviewHtml(asset, texture)}<div><span class="asset-row-name">${escapeHtml(asset.name)}</span><div class="asset-row-meta">${escapeHtml(OpusAuthoringPlumbing.assetTypes.get('sprite').displayName)} v${asset.version} · ${natural ? `${natural.width.toFixed(2)}×${natural.height.toFixed(2)}` : 'broken source'} · used ${computeSpriteAssetUsageCount(asset.id)}×</div></div></div>
      ${assetTagsRowHtml(asset,true)}<div class="asset-row-actions"><button data-select-sprite-asset="${asset.id}">Inspect</button><button data-place-sprite-asset="${asset.id}">Place</button><button data-duplicate-sprite-asset="${asset.id}">Duplicate</button><button data-delete-sprite-asset="${asset.id}">Delete</button></div></div>`;
  }).join('') : `<p style="color:#66759a;font-size:11px;margin:2px 0">${spriteAssets.length ? 'No Sprite Assets match this search.' : 'No Sprite Assets yet. Use Create Sprite on a Texture.'}</p>`;
  listEl.querySelectorAll('[data-sprite-asset-id]').forEach((row) => {
    const asset = findSpriteAssetById(row.dataset.spriteAssetId);
    if (asset) wireSpriteAssetDragSource(row, asset, sourceTextureForSpriteAsset(asset));
  });
  listEl.querySelectorAll('[data-select-sprite-asset]').forEach((button) => { button.onclick = () => { selectedSpriteAssetId = button.dataset.selectSpriteAsset; renderSpriteAssetInspector(); }; });
  listEl.querySelectorAll('[data-place-sprite-asset]').forEach((button) => { button.onclick = () => {
    const asset = findSpriteAssetById(button.dataset.placeSpriteAsset);
    if (asset) armPlacement(OpusAuthoringPlumbing.createSpritePlacementPayload(asset.id), `Sprite "${asset.name}"`);
  }; });
  listEl.querySelectorAll('[data-duplicate-sprite-asset]').forEach((button) => { bindIndependentAssetCopy(button,findSpriteAssetById(button.dataset.duplicateSpriteAsset),()=>spriteAssets,OpusAuthoringPlumbing.duplicateSpriteAsset,generateSpriteAssetId,renderSpriteLibrary,id=>{selectedSpriteAssetId=id;}); });
  listEl.querySelectorAll('[data-delete-sprite-asset]').forEach((button) => { button.onclick = () => { const asset = findSpriteAssetById(button.dataset.deleteSpriteAsset); const usage = computeSpriteAssetUsageCount(asset.id); const tileUses = tilesets.flatMap((tileset) => (tileset.tiles || []).filter((tile) => tile.spriteAssetRef === asset.id).map((tile) => `Tileset "${tileset.name}" → Tile "${tile.name}"`)); if (usage && !confirm(`"${asset.name}" is referenced ${usage} time${usage === 1 ? '' : 's'}${tileUses.length ? `, including ${tileUses.slice(0, 3).join(', ')}` : ''}. Delete it and leave repairable Sprite references?`)) return; spriteAssets = spriteAssets.filter((entry) => entry.id !== asset.id); if (selectedSpriteAssetId === asset.id) selectedSpriteAssetId = null; for (const item of placed) if (item.kind === 'sprite') syncSpriteRenderer(item); renderSpriteLibrary(); renderTilesetLibrary(); if (document.getElementById('tile-palette-modal').classList.contains('visible')) renderTilePalette(); showStatus(`Deleted Sprite Asset "${asset.name}"${usage ? '; references remain for repair' : ''}`); }; });
  listEl.querySelectorAll('[data-asset-tagedit]').forEach((input) => { bindAssetMetadataInput(input,findSpriteAssetById(input.dataset.assetTagedit),()=>spriteAssets,renderSpriteLibrary); });
  listEl.querySelectorAll('[data-create-asset-variant]').forEach(button=>bindIndependentAssetCopy(button,findSpriteAssetById(button.dataset.createAssetVariant),()=>spriteAssets,OpusAuthoringPlumbing.duplicateSpriteAsset,generateSpriteAssetId,renderSpriteLibrary,id=>{selectedSpriteAssetId=id;},'Variant'));
  if(skipInspector!==true)renderSpriteAssetInspector();
}
renderSpriteLibrary();
document.getElementById('sprite-library-search').addEventListener('input', renderSpriteLibrary);
document.getElementById('sprite-library-folder-filter').addEventListener('change', renderSpriteLibrary);

// Phase 031: Tilesets are first-class authoring Assets. Their Tile records
// contain only stable Sprite Asset references; Texture bytes, atlas regions,
// filtering, pivots, and PPU remain canonical on Texture/Sprite Assets.
function createTileset(options) {
  const opts = options || {};
  const tileset = OpusAuthoringPlumbing.createTileset({
    id: generateTilesetId(), name: OpusAuthoringPlumbing.uniqueAssetName(opts.name || 'Tileset', tilesets.map((entry) => entry.name)),
    cellSize: opts.cellSize || { width: 1, height: 1 }, tiles: [], folder: opts.folder, tags: opts.tags,
  });
  tilesets.push(tileset); selectedTilesetId = tileset.id;
  if (opts.spriteAssets) OpusAuthoringPlumbing.addSpriteAssetsToTileset(tileset, opts.spriteAssets);
  renderTilesetLibrary();
  if (opts.open !== false) openTilePalette(tileset.id);
  showStatus(`Created Tileset "${tileset.name}" with ${tileset.tiles.length} Tile${tileset.tiles.length === 1 ? '' : 's'}`);
  return tileset;
}
function serializeTilesets() { return tilesets.map((tileset) => OpusAuthoringPlumbing.createTileset(tileset)); }
function loadTilesets(records) {
  if (!Array.isArray(records)) return;
  for (const record of records) {
    if (findTilesetById(record.id)) continue;
    reconcileTilesetIdCounter(record.id); tilesets.push(OpusAuthoringPlumbing.createTileset(record));
  }
  renderTilesetLibrary();
}
function tileProblemCount(tileset, tile) {
  const name = String(tile && tile.name || '').trim();
  return (!name ? 1 : 0) + ((tileset.tiles || []).filter((entry) => String(entry.name || '').trim().toLowerCase() === name.toLowerCase()).length > 1 ? 1 : 0) + (!tile.spriteAssetRef || !findSpriteAssetById(tile.spriteAssetRef) ? 1 : 0) + OpusAuthoringPlumbing.validateTileCollision(tile && tile.collision).length;
}
function bindTilesetCellSizeInput(input,tileset,key,render) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);let edited=false;
  const commit=()=>{
    const retained=()=>{input.value=tileset.cellSize[key];},next=input.value.trim()===''?NaN:Number(input.value);
    if(!Number.isFinite(next)||next<=0||!Number.isFinite(Math.fround(next))){retained();showStatus('Cell Size must be a positive finite world-unit value');return;}
    if(next===tileset.cellSize[key]){retained();return;}
    if(!guard.allowed()||(!edited&&!guard.beforeChange())){retained();return;}
    edited=true;tileset.cellSize[key]=next;guard.updated();
    for(const item of placed)if(item.kind==='tilemap'&&item.tilesetRef===tileset.id)syncTilemapRenderer(item);
    syncTilemapOverlay();
  };
  input.oninput=commit;
  input.onchange=()=>{commit();if(edited){render();validateCurrentProject();}edited=false;};
  input.onblur=()=>{edited=false;};
}
function renderTilesetInspector() {
  const host = document.getElementById('tileset-inspector'); if (!host) return;
  const tileset = findTilesetById(selectedTilesetId); if (!tileset) { host.innerHTML = ''; return; }
  const broken = (tileset.tiles || []).filter((tile) => tileProblemCount(tileset, tile)).length;
  host.innerHTML = `<div class="asset-row" data-tileset-inspector="${escapeHtml(tileset.id)}"><strong>Tileset Inspector</strong>
    <label>Name<input type="text" data-tileset-name value="${escapeHtml(tileset.name)}" aria-label="Tileset name"></label>
    <div class="field-pair"><label>Cell Width<input type="number" min="0.001" step="0.25" data-tileset-cell-width value="${escapeHtml(tileset.cellSize.width)}"></label><label>Cell Height<input type="number" min="0.001" step="0.25" data-tileset-cell-height value="${escapeHtml(tileset.cellSize.height)}"></label></div>
    <p class="field-help">Cell Size is the future grid footprint in world units. Sprite artwork may overhang it.</p>
    <div class="asset-row-meta">${tileset.tiles.length} Tile${tileset.tiles.length === 1 ? '' : 's'}${broken ? ` · ${broken} needs repair` : ''}</div>
    <button type="button" class="toolbar-btn" data-open-tileset-palette>Open Tile Palette</button></div>`;
  const nameInput = host.querySelector('[data-tileset-name]');
  bindAssetNameInput(nameInput,tileset,()=>tilesets,()=>{renderTilesetLibrary();validateCurrentProject();});
  for (const [selector, key] of [['[data-tileset-cell-width]', 'width'], ['[data-tileset-cell-height]', 'height']]) {
    bindTilesetCellSizeInput(host.querySelector(selector),tileset,key,renderTilesetLibrary);
  }
  host.querySelector('[data-open-tileset-palette]').onclick = () => openTilePalette(tileset.id);
}
function renderTilesetLibrary() {
  const list = document.getElementById('tileset-library-list'); if (!list) return;
  const search = document.getElementById('tileset-library-search'); const folderEl = document.getElementById('tileset-library-folder-filter');
  const query = search.value.trim(); const folder = folderEl.value; populateAssetFolderFilter(folderEl, tilesets, folder);
  const visible = tilesets.filter((tileset) => assetMatchesFilter(tileset, query, folder));
  list.innerHTML = visible.length ? visible.map((tileset) => {
    const broken = tileset.tiles.filter((tile) => tileProblemCount(tileset, tile)).length;
    return `<div class="asset-row" data-tileset-id="${escapeHtml(tileset.id)}"><div class="asset-row-header"><span class="asset-row-name">▦ ${escapeHtml(tileset.name || '(unnamed Tileset)')}</span><span>${tileset.tiles.length} Tiles · ${(tileset.autoTileSets || []).length} Auto Sets · ${(tileset.terrainBrushes || []).length} Terrain</span></div><div class="asset-row-meta">Tileset v${escapeHtml(tileset.version)} · Cell ${escapeHtml(tileset.cellSize.width)} × ${escapeHtml(tileset.cellSize.height)} world units${broken ? ` · ${broken} needs repair` : ''}</div>${assetTagsRowHtml(tileset,true)}<div class="asset-row-actions"><button data-open-tileset="${escapeHtml(tileset.id)}">Open Palette</button><button data-inspect-tileset="${escapeHtml(tileset.id)}">Inspect</button><button data-duplicate-tileset="${escapeHtml(tileset.id)}">Duplicate</button><button data-delete-tileset="${escapeHtml(tileset.id)}">Delete</button></div></div>`;
  }).join('') : `<p style="color:#66759a;font-size:11px;margin:2px 0">${tilesets.length ? 'No Tilesets match this search.' : 'No Tilesets yet. Create one to organize Sprite Assets for a future Tilemap.'}</p>`;
  list.querySelectorAll('[data-open-tileset]').forEach((button) => { button.onclick = () => openTilePalette(button.dataset.openTileset); });
  list.querySelectorAll('[data-inspect-tileset]').forEach((button) => { button.onclick = () => { selectedTilesetId = button.dataset.inspectTileset; renderTilesetInspector(); }; });
  list.querySelectorAll('[data-duplicate-tileset]').forEach((button) => { button.onclick = () => { const source = findTilesetById(button.dataset.duplicateTileset); if (!source) return; pushUndo(); const copy = OpusAuthoringPlumbing.duplicateTileset(source, generateTilesetId(), OpusAuthoringPlumbing.uniqueAssetName(`${source.name} Copy`, tilesets.map((entry) => entry.name))); tilesets.push(copy); selectedTilesetId = copy.id; renderTilesetLibrary(); showStatus(`Duplicated "${source.name}" with independent Tile records and retained local Tile IDs`); }; });
  list.querySelectorAll('[data-delete-tileset]').forEach((button) => { button.onclick = () => { const source = findTilesetById(button.dataset.deleteTileset); if (!source) return; const owners = placed.filter((item) => item.kind === 'tilemap' && item.tilesetRef === source.id); if (!confirm(`Delete Tileset "${source.name}"?${owners.length ? ` ${owners.length} Tilemap reference${owners.length === 1 ? '' : 's'} will remain repairable.` : ''} Shared Sprite Assets and Textures will remain.`)) return; pushUndo(); tilesets = tilesets.filter((entry) => entry.id !== source.id); if (selectedTilesetId === source.id) selectedTilesetId = null; if (activeTilesetId === source.id) closeTilePalette(); for (const owner of owners) syncTilemapRenderer(owner); renderTilesetLibrary(); showStatus(`Deleted Tileset "${source.name}" without deleting Sprite artwork`); }; });
  list.querySelectorAll('[data-asset-tagedit]').forEach((input) => { bindAssetMetadataInput(input,findTilesetById(input.dataset.assetTagedit),()=>tilesets,renderTilesetLibrary); });
  list.querySelectorAll('[data-create-asset-variant]').forEach(button=>bindIndependentAssetCopy(button,findTilesetById(button.dataset.createAssetVariant),()=>tilesets,OpusAuthoringPlumbing.duplicateTileset,generateTilesetId,renderTilesetLibrary,id=>{selectedTilesetId=id;},'Variant'));
  renderTilesetInspector();
}
function openTilePalette(tilesetId) {
  const tileset = findTilesetById(tilesetId); if (!tileset) return;
  selectedTilesetId = tileset.id; activeTilesetId = tileset.id; activeTileId = tileset.tiles[0] && tileset.tiles[0].id || null; activeAutoTileSetId = tileset.autoTileSets[0] && tileset.autoTileSets[0].id || null; activeTerrainBrushId = tileset.terrainBrushes[0] && tileset.terrainBrushes[0].id || null; tilePaletteAddingSprites = false; tilePaletteMode = 'tiles';
  if (selectedTilemap() && selectedTilemap().tilesetRef === tileset.id) tilemapBrushTileId = activeTileId;
  document.getElementById('tile-palette-search').value = ''; document.getElementById('tile-palette-modal').classList.add('visible');
  renderTilePalette();
}
function closeTilePalette() { document.getElementById('tile-palette-modal').classList.remove('visible'); tilePaletteAddingSprites = false; activeTilesetId = null; activeTileId = null; activeAutoTileSetId = null; activeTerrainBrushId = null; renderTilesetLibrary(); }
function renderTilePalette() {
  const tileset = findTilesetById(activeTilesetId); const modal = document.getElementById('tile-palette-modal'); if (!tileset || !modal.classList.contains('visible')) return;
  const query = document.getElementById('tile-palette-search').value.trim().toLowerCase(); const visible = tileset.tiles.filter((tile) => String(tile.name || '').toLowerCase().includes(query));
  const grid = document.getElementById('tile-palette-grid'); grid.style.setProperty('--tile-card-size', `${document.getElementById('tile-palette-size').value}px`);
  document.getElementById('tile-palette-tiles-tab').setAttribute('aria-pressed', tilePaletteMode === 'tiles'); document.getElementById('tile-palette-auto-tab').setAttribute('aria-pressed', tilePaletteMode === 'auto-tiles'); document.getElementById('tile-palette-terrain-tab').setAttribute('aria-pressed', tilePaletteMode === 'terrain');
  document.getElementById('tile-palette-add-tile').hidden = tilePaletteMode !== 'tiles'; document.getElementById('tile-palette-add-sprites').hidden = tilePaletteMode !== 'tiles'; document.getElementById('tile-palette-add-auto-set').hidden = tilePaletteMode !== 'auto-tiles'; document.getElementById('tile-palette-add-terrain').hidden = tilePaletteMode !== 'terrain';
  if (tilePaletteMode === 'auto-tiles') { renderAutoTilePalette(tileset, query, grid); return; }
  if (tilePaletteMode === 'terrain') { renderTerrainBrushPalette(tileset, query, grid); return; }
  grid.innerHTML = visible.length ? visible.map((tile) => { const sprite = findSpriteAssetById(tile.spriteAssetRef); const broken = tileProblemCount(tileset, tile); const index = tileset.tiles.indexOf(tile);
    const collision = OpusAuthoringPlumbing.resolveTileCollision(tile); const badge = collision.mode === 'slope' ? `Collision: Slope ${collision.slope === 'up-left' ? '↖' : '↗'}${collision.oneWay ? ' One-Way' : ''}` : collision.oneWay ? 'Collision: One-Way ↑' : collision.mode === 'full-cell' ? 'Collision: Full' : collision.mode === 'custom-rect' ? 'Collision: Custom' : '';
    return `<button type="button" role="option" aria-selected="${tile.id === activeTileId}" class="tile-palette-card${tile.id === activeTileId ? ' selected' : ''}${broken ? ' broken' : ''}${sprite && sprite.filtering === 'nearest' ? ' pixel' : ''}" data-palette-tile="${escapeHtml(tile.id)}">${sprite ? spriteRegionPreviewHtml(sprite, sourceTextureForSpriteAsset(sprite), 96) : '<span class="tile-palette-missing">Missing Sprite Asset</span>'}<span class="tile-palette-card-name">${escapeHtml(tile.name || '(unnamed Tile)')}</span><span class="tile-palette-card-meta">Tile ${index + 1}${broken ? ' · repair' : ''}</span>${badge ? `<span class="tile-collision-badge" aria-label="${badge}">${badge.replace('Collision: ', '')}</span>` : ''}</button>`;
  }).join('') : (tileset.tiles.length ? '<div class="tile-palette-empty"><strong>No Tiles match this search.</strong><span>Clear search to restore the Palette; ordering was not changed.</span></div>' : '<div class="tile-palette-empty"><strong>No tiles yet. Add Sprite Assets to build this Tileset.</strong><button type="button" data-empty-add-tile>+ Add Tile</button><button type="button" data-empty-add-sprites>Add Sprite Assets</button></div>');
  grid.querySelectorAll('[data-palette-tile]').forEach((button) => { button.onclick = () => { activeTileId = button.dataset.paletteTile; tilemapBrushKind = 'manual-tile'; tilemapBrushAutoTileSetId = null; tilemapBrushTerrainId = null; if (selectedTilemap() && selectedTilemap().tilesetRef === tileset.id) tilemapBrushTileId = activeTileId; tilePaletteAddingSprites = false; renderTilePalette(); syncTilemapOverlay(); }; });
  const emptyTile = grid.querySelector('[data-empty-add-tile]'); if (emptyTile) emptyTile.onclick = addEmptyTile;
  const emptySprites = grid.querySelector('[data-empty-add-sprites]'); if (emptySprites) emptySprites.onclick = () => { tilePaletteAddingSprites = true; renderTilePalette(); };
  document.getElementById('tile-palette-title').textContent = `Tile Palette — ${tileset.name}`;
  document.getElementById('tile-palette-summary').textContent = `${visible.length} shown · ${tileset.tiles.length} total · Cell ${tileset.cellSize.width} × ${tileset.cellSize.height}`;
  renderTilePaletteDetails(tileset);
}
function renderAutoTilePalette(tileset, query, grid) {
  const sets = (tileset.autoTileSets || []).filter((set) => String(set.name || '').toLowerCase().includes(query));
  grid.innerHTML = sets.length ? sets.map((set) => { const total = set.neighborMode === 'eight-way' ? 47 : 16; const fallback = OpusAuthoringPlumbing.getTileById(tileset, set.defaultTileId); return `<button type="button" role="option" aria-selected="${set.id === activeAutoTileSetId}" class="tile-palette-card${set.id === activeAutoTileSetId ? ' selected' : ''}${fallback ? '' : ' broken'}" data-auto-tile-set="${escapeHtml(set.id)}"><span class="tile-palette-missing">${set.neighborMode === 'eight-way' ? '8-Way' : '4-Way'}</span><span class="tile-palette-card-name">${escapeHtml(set.name || '(unnamed Auto-Tile Set)')}</span><span class="tile-palette-card-meta">Rules: ${(set.rules || []).length} / ${total} · Default: ${escapeHtml(fallback ? fallback.name : 'Missing')}</span></button>`; }).join('') : '<div class="tile-palette-empty"><strong>No Auto-Tile Sets yet.</strong><span>Create one to paint connectivity-aware cells. A selected Tile becomes its Default.</span><button type="button" data-empty-add-auto-set>+ Auto-Tile Set</button></div>';
  grid.querySelectorAll('[data-auto-tile-set]').forEach((button) => { button.onclick = () => { activeAutoTileSetId = button.dataset.autoTileSet; tilemapBrushKind = 'auto-tile'; tilemapBrushAutoTileSetId = activeAutoTileSetId; tilemapBrushTerrainId = null; activeAutoTileRuleMask = 0; renderTilePalette(); syncTilemapOverlay(); }; });
  grid.querySelector('[data-empty-add-auto-set]')?.addEventListener('click', addAutoTileSetFromPalette);
  document.getElementById('tile-palette-title').textContent = `Auto-Tile Sets — ${tileset.name}`; document.getElementById('tile-palette-summary').textContent = `${sets.length} shown · ${(tileset.autoTileSets || []).length} total · authoring-time resolution`;
  renderAutoTileSetDetails(tileset);
}
function recomputeTerrainBrushEverywhere(tileset, brushId) { const changes = OpusAuthoringPlumbing.recomputeTerrainBrushUsage(liveAutoTileProject(), tileset.id, brushId); OpusAuthoringPlumbing.recomputeProjectTilemapChunks(liveAutoTileProject(), tileset.id); for (const item of placed) if (item.kind === 'tilemap' && item.tilesetRef === tileset.id) syncTilemapRenderer(item); renderTilemapChunkLibrary(); syncTilemapOverlay(); return changes; }
function terrainPreviewGridHtml(tileset, brush) {
  if (!brush || brush.mode !== 'weighted-tiles') return '<p class="field-help">Connected Terrain previews through its canonical Auto-Tile Set in the viewport.</p>';
  return `<div class="terrain-preview-grid" role="img" aria-label="Deterministic 8 by 4 Terrain sample">${Array.from({length:32},(_,index)=>{ const tileId=OpusAuthoringPlumbing.resolveTerrainWeightedTile(tileset,brush,'terrain-preview',index%8,Math.floor(index/8)); const tile=OpusAuthoringPlumbing.getTileById(tileset,tileId); return `<span title="${escapeHtml(tile ? tile.name : 'Unresolved')}">${escapeHtml(tile ? tile.name.slice(0,2) : '—')}</span>`; }).join('')}</div>`;
}
function renderTerrainBrushPalette(tileset, query, grid) {
  const brushes=(tileset.terrainBrushes||[]).filter((brush)=>String(brush.name||'').toLowerCase().includes(query));
  grid.innerHTML=brushes.length?brushes.map((brush)=>{ const usage=OpusAuthoringPlumbing.terrainBrushUsage(liveAutoTileProject(),tileset.id,brush.id).reduce((sum,entry)=>sum+entry.cellCount,0); const valid=OpusAuthoringPlumbing.terrainBrushCanPaint(tileset,brush); const detail=brush.mode==='weighted-tiles'?`${(brush.variants||[]).length} Variants · Seed ${brush.seed}`:`${(OpusAuthoringPlumbing.getAutoTileSetById(tileset,brush.autoTileSetId)||{}).name||'Missing Auto-Tile Set'}`; return `<button type="button" role="option" aria-selected="${brush.id===activeTerrainBrushId}" class="tile-palette-card${brush.id===activeTerrainBrushId?' selected':''}${valid?'':' broken'}" data-terrain-brush="${escapeHtml(brush.id)}"><span class="terrain-brush-badge">${brush.mode==='weighted-tiles'?'Weighted':'Connected'}</span><span class="tile-palette-card-name">${escapeHtml(brush.name||'(unnamed Terrain Brush)')}</span><span class="tile-palette-card-meta">${escapeHtml(detail)} · ${usage} cells</span></button>`;}).join(''):'<div class="tile-palette-empty"><strong>No Terrain Brushes yet.</strong><span>Create Weighted Tiles or Connected Auto-Tile Terrain.</span><button type="button" data-empty-add-terrain>+ Terrain Brush</button></div>';
  grid.querySelectorAll('[data-terrain-brush]').forEach((button)=>{button.onclick=()=>{activeTerrainBrushId=button.dataset.terrainBrush;tilemapBrushKind='terrain';tilemapBrushTerrainId=activeTerrainBrushId;tilemapBrushAutoTileSetId=null;renderTilePalette();syncTilemapOverlay();};});
  grid.querySelector('[data-empty-add-terrain]')?.addEventListener('click',addTerrainBrushFromPalette);
  document.getElementById('tile-palette-title').textContent=`Terrain / Biome Brushes — ${tileset.name}`; document.getElementById('tile-palette-summary').textContent=`${brushes.length} shown · ${(tileset.terrainBrushes||[]).length} total · deterministic authoring`;
  renderTerrainBrushDetails(tileset);
}
function bindTerrainBrushAction(button,tileset,brush,prepare,confirmChange) {
  if(!button)return;
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);
  button.onclick=()=>{
    if((tileset.terrainBrushes||[]).filter(entry=>entry===brush).length!==1||!guard.allowed())return;
    const change=prepare();if(!change)return;
    if(confirmChange&&!confirmChange())return;
    if(!guard.beforeChange())return;
    change();guard.updated();
  };
}
function bindTerrainBrushChoiceInput(input,tileset,brush,getValue,setValue,valid,confirmChange,commit) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);
  input.onchange=()=>{
    const retained=getValue(),next=input.value||null,restore=()=>{input.value=retained||'';};
    if(next===retained){restore();return;}
    if(!valid(next)){restore();showStatus('Terrain choice is unavailable; unchanged.');return;}
    if((tileset.terrainBrushes||[]).filter(entry=>entry===brush).length!==1||!guard.allowed()){restore();return;}
    if(confirmChange&&!confirmChange()){restore();return;}
    if(!guard.beforeChange()){restore();return;}
    setValue(next);guard.updated();commit();
  };
}
function bindTerrainBrushNumberInput(input,tileset,brush,getValue,setValue,min,max,commit) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);
  input.onchange=()=>{
    const retained=getValue(),raw=input.value.trim(),number=Number(raw);
    if(!raw||!Number.isFinite(number)){input.value=retained;return;}
    const next=Math.max(min,Math.min(max,Math.round(number)));
    if(next===retained){input.value=retained;return;}
    if((tileset.terrainBrushes||[]).filter(entry=>entry===brush).length!==1||!guard.beforeChange()){input.value=retained;return;}
    setValue(next);guard.updated();commit();
  };
}
function bindTerrainBrushNameInput(input,tileset,brush,render) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);let edited=false;
  input.oninput=()=>{
    const next=OpusAuthoringPlumbing.uniqueTerrainBrushName(tileset,input.value.trim()||brush.name,brush.id);
    if(next===brush.name)return;
    if((tileset.terrainBrushes||[]).filter(entry=>entry===brush).length!==1||!guard.allowed()||(!edited&&!guard.beforeChange())){input.value=brush.name;return;}
    edited=true;brush.name=next;guard.updated();
  };
  input.onblur=()=>{input.value=brush.name;edited=false;render();};
}
function renderTerrainBrushDetails(tileset) {
  const host=document.getElementById('tile-palette-details'),brush=OpusAuthoringPlumbing.getTerrainBrushById(tileset,activeTerrainBrushId); if(!brush){host.innerHTML='<div class="tile-palette-empty">Select or create a Terrain Brush.</div>';return;}
  const usage=OpusAuthoringPlumbing.terrainBrushUsage(liveAutoTileProject(),tileset.id,brush.id),usageCount=usage.reduce((sum,entry)=>sum+entry.cellCount,0),total=(brush.variants||[]).reduce((sum,variant)=>sum+(Number.isInteger(variant.weight)&&variant.weight>0?variant.weight:0),0);
  const tileOptions=(selected)=>`<option value="">Select Tile…</option>${tileset.tiles.map((tile)=>`<option value="${escapeHtml(tile.id)}"${tile.id===selected?' selected':''}>${escapeHtml(tile.name)}</option>`).join('')}`;
  const setOptions=`<option value="">Select Auto-Tile Set…</option>${(tileset.autoTileSets||[]).map((set)=>`<option value="${escapeHtml(set.id)}"${set.id===brush.autoTileSetId?' selected':''}>${escapeHtml(set.name)}</option>`).join('')}`;
  const weighted=brush.mode==='weighted-tiles'?`<label>Seed<input data-terrain-seed type="number" step="1" min="-2147483648" max="2147483647" value="${escapeHtml(brush.seed)}"></label><strong>Variants</strong><div class="terrain-variant-list">${(brush.variants||[]).map((variant,index)=>`<div class="terrain-variant-row"><label>Tile<select data-terrain-variant-tile="${index}">${tileOptions(variant.tileId)}</select></label><label>Weight<input aria-label="Weight for variant ${index+1}" data-terrain-variant-weight="${index}" type="number" min="1" max="1000000" step="1" value="${escapeHtml(variant.weight)}"></label><span aria-label="Approximate percentage">≈ ${total?Math.round(variant.weight/total*100):0}%</span><button data-terrain-variant-remove="${index}" aria-label="Remove variant ${index+1}">×</button></div>`).join('')||'<p class="field-help">Add a Tile Variant before painting.</p>'}</div><button data-terrain-variant-add>+ Add Variant</button><p class="field-help">Total Weight ${total}. Resolution uses canonical Tile-ID order, independent of this display order.</p>${terrainPreviewGridHtml(tileset,brush)}`:`<label>Auto-Tile Set<select data-terrain-auto-set>${setOptions}</select></label><p class="field-help">Connectivity and Rules remain owned by the selected Phase 035 Auto-Tile Set.</p><button data-terrain-open-auto ${brush.autoTileSetId?'':'disabled'}>Open Auto-Tile Set</button>`;
  host.innerHTML=`<strong>Terrain Brush</strong><label>Name<input data-terrain-name value="${escapeHtml(brush.name)}"></label><label>Mode<select data-terrain-mode><option value="weighted-tiles"${brush.mode==='weighted-tiles'?' selected':''}>Weighted Tiles</option><option value="auto-tile"${brush.mode==='auto-tile'?' selected':''}>Connected Auto-Tile</option></select></label>${weighted}<p class="field-help">${usageCount} managed cell${usageCount===1?'':'s'} across ${usage.length} Layer use${usage.length===1?'':'s'}.</p><div class="tile-palette-actions"><button data-terrain-duplicate>Duplicate Brush</button><button data-terrain-manual ${usageCount?'':'disabled'}>Convert Cells to Manual</button><button data-terrain-delete>Delete Brush</button></div>`;
  const commit=(message)=>{const count=recomputeTerrainBrushEverywhere(tileset,brush.id).length;renderTilePalette();validateCurrentProject();showStatus(`${message}; ${count} resolved cell update${count===1?'':'s'}`);};
  bindTerrainBrushNameInput(host.querySelector('[data-terrain-name]'),tileset,brush,()=>{renderTilePalette();validateCurrentProject();});
  bindTerrainBrushChoiceInput(host.querySelector('[data-terrain-mode]'),tileset,brush,()=>brush.mode,next=>{brush.mode=next;if(next==='auto-tile'&&!brush.autoTileSetId)brush.autoTileSetId=(tileset.autoTileSets[0]||{}).id||null;},next=>next==='weighted-tiles'||next==='auto-tile',()=>!usageCount||confirm(`Changing mode will reinterpret ${usageCount} painted cell${usageCount===1?'':'s'}. Continue?`),()=>commit('Changed Terrain mode'));
  const seed=host.querySelector('[data-terrain-seed]');if(seed)bindTerrainBrushNumberInput(seed,tileset,brush,()=>brush.seed,value=>{brush.seed=value;},-2147483648,2147483647,()=>commit('Changed Terrain Seed'));
  host.querySelectorAll('[data-terrain-variant-weight]').forEach((input)=>{const variant=brush.variants[Number(input.dataset.terrainVariantWeight)];if(variant)bindTerrainBrushNumberInput(input,tileset,brush,()=>variant.weight,value=>{variant.weight=value;},1,1000000,()=>commit('Changed Variant weight'));});
  host.querySelectorAll('[data-terrain-variant-tile]').forEach((select)=>{const variant=brush.variants[Number(select.dataset.terrainVariantTile)];if(variant)bindTerrainBrushChoiceInput(select,tileset,brush,()=>variant.tileId,next=>{variant.tileId=next;},next=>!!next&&tileset.tiles.some(tile=>tile.id===next),null,()=>commit('Changed Variant Tile'));});
  host.querySelectorAll('[data-terrain-variant-remove]').forEach((button)=>{const index=Number(button.dataset.terrainVariantRemove);bindTerrainBrushAction(button,tileset,brush,()=>Number.isInteger(index)&&brush.variants[index]?()=>{brush.variants.splice(index,1);commit('Removed Variant');}:null);});
  bindTerrainBrushAction(host.querySelector('[data-terrain-variant-add]'),tileset,brush,()=>{const used=new Set(brush.variants.map((variant)=>variant.tileId)),tile=tileset.tiles.find((entry)=>!used.has(entry.id));if(!tile){showStatus('Every Tile is already a Variant');return null;}return ()=>{brush.variants.push({tileId:tile.id,weight:1});commit('Added Variant');};});
  const autoSelect=host.querySelector('[data-terrain-auto-set]');if(autoSelect)bindTerrainBrushChoiceInput(autoSelect,tileset,brush,()=>brush.autoTileSetId||null,next=>{brush.autoTileSetId=next;},next=>next===null||(tileset.autoTileSets||[]).some(set=>set.id===next),()=>!usageCount||confirm(`Changing Auto-Tile Set will retile ${usageCount} painted cell${usageCount===1?'':'s'}. Continue?`),()=>commit('Changed connected Auto-Tile Set'));
  const openAuto=host.querySelector('[data-terrain-open-auto]');if(openAuto)openAuto.onclick=()=>{tilePaletteMode='auto-tiles';activeAutoTileSetId=brush.autoTileSetId;activeAutoTileRuleMask=0;renderTilePalette();};
  bindTerrainBrushAction(host.querySelector('[data-terrain-duplicate]'),tileset,brush,()=>()=>{const copy=OpusAuthoringPlumbing.duplicateTerrainBrush(tileset,brush.id);activeTerrainBrushId=copy.id;renderTilePalette();showStatus(`Duplicated as "${copy.name}" with a new stable Brush ID and copied Seed`);});
  bindTerrainBrushAction(host.querySelector('[data-terrain-manual]'),tileset,brush,()=>usageCount?()=>{const count=OpusAuthoringPlumbing.convertTerrainCellsToManual(liveAutoTileProject(),tileset.id,brush.id);renderTilePalette();for(const item of placed)if(item.kind==='tilemap'&&item.tilesetRef===tileset.id)syncTilemapRenderer(item);validateCurrentProject();showStatus(`Converted ${count} Terrain cell${count===1?'':'s'} to Manual`);}:null,()=>confirm(`Convert ${usageCount} cell${usageCount===1?'':'s'} to Manual? Current resolved Tiles will be preserved.`));
  bindTerrainBrushAction(host.querySelector('[data-terrain-delete]'),tileset,brush,()=>()=>{OpusAuthoringPlumbing.removeTerrainBrush(tileset,brush.id);activeTerrainBrushId=(tileset.terrainBrushes[0]||{}).id||null;renderTilePalette();validateCurrentProject();showStatus(`Deleted "${brush.name}"${usageCount?'; cells retain missing identity and visible Tiles':''}`);},()=>!usageCount||confirm(`Terrain Brush "${brush.name}" is used by ${usageCount} cell${usageCount===1?'':'s'} across ${usage.length} Layer${usage.length===1?'':'s'}. Delete and retain repairable IDs plus visible Tiles?`));
}
function autoTileMaskGridHtml(set) {
  const positions = [['NW',128],['N',1],['NE',16],['W',8],['X',0],['E',2],['SW',64],['S',4],['SE',32]]; const diagonals = new Set([16,32,64,128]);
  return `<div class="auto-tile-mask-grid" role="group" aria-label="Neighbor mask mini-grid">${positions.map(([name, bit]) => { if (!bit) return '<button type="button" class="center" disabled aria-label="Current cell">X</button>'; const unavailable = set.neighborMode === 'four-way' && diagonals.has(bit); const active = !!(activeAutoTileRuleMask & bit); return `<button type="button" data-auto-mask-bit="${bit}" class="${active ? 'active' : ''}" aria-pressed="${active}" ${unavailable ? 'disabled' : ''}>${name}</button>`; }).join('')}</div>`;
}
function bindAutoTileSetAction(button,tileset,set,prepare,confirmChange) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);
  button.onclick=()=>{
    if((tileset.autoTileSets||[]).filter(entry=>entry===set).length!==1||(tileset.autoTileSets||[]).filter(entry=>entry.id===set.id).length!==1||!guard.allowed())return;
    const change=prepare();if(!change)return;
    if(confirmChange&&!confirmChange())return;
    if(!guard.beforeChange())return;
    change();guard.updated();
  };
}
function bindAutoTileSetChoice(input,tileset,set,getValue,valid,prepare,confirmChange) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);
  input.onchange=()=>{
    const next=input.value||null,old=getValue();
    if(next===old){input.value=old||'';return;}
    if(!valid(next)||(tileset.autoTileSets||[]).filter(entry=>entry===set).length!==1||!guard.allowed()){input.value=old||'';return;}
    const change=prepare(next);
    if(!change||(confirmChange&&!confirmChange(next))||!guard.beforeChange()){input.value=old||'';return;}
    change();guard.updated();
  };
}
function bindAutoTileSetNameInput(input,tileset,set,render) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);
  input.onchange=()=>{
    const next=OpusAuthoringPlumbing.uniqueAutoTileSetName(tileset,input.value,set.id);
    if(next===set.name){input.value=set.name;return;}
    if((tileset.autoTileSets||[]).filter(entry=>entry===set).length!==1||!guard.beforeChange()){input.value=set.name;return;}
    set.name=next;guard.updated();render(next);
  };
}
function renderAutoTileSetDetails(tileset) {
  const host = document.getElementById('tile-palette-details'); const set = findActiveAutoTileSet(); if (!set) { host.innerHTML = '<div class="tile-palette-empty">Select or create an Auto-Tile Set.</div>'; return; }
  const total = set.neighborMode === 'eight-way' ? 47 : 16; const usage = OpusAuthoringPlumbing.autoTileSetUsage(liveAutoTileProject(), tileset.id, set.id); const usageCount = usage.reduce((sum, entry) => sum + entry.cellCount, 0);
  const tileOptions = `<option value="">Select Tile…</option>${tileset.tiles.map((tile) => `<option value="${escapeHtml(tile.id)}">${escapeHtml(tile.name)}</option>`).join('')}`;
  host.innerHTML = `<strong>Auto-Tile Set</strong><label>Name<input data-auto-set-name value="${escapeHtml(set.name)}"></label><label>Neighbor Mode<select data-auto-set-mode><option value="four-way"${set.neighborMode === 'four-way' ? ' selected' : ''}>4-Way</option><option value="eight-way"${set.neighborMode === 'eight-way' ? ' selected' : ''}>8-Way / Corners</option></select></label><label>Default Tile<select data-auto-set-default>${tileOptions.replace(`value="${set.defaultTileId || ''}"`, `value="${set.defaultTileId || ''}" selected`)}</select></label><p class="field-help">${(set.rules || []).length} / ${total} explicit Rules. Every unmapped mask uses Default. ${usageCount} managed cell${usageCount === 1 ? '' : 's'}.</p><hr><strong>Rule Mask</strong>${autoTileMaskGridHtml(set)}<label>Rule Output Tile<select data-auto-rule-tile>${tileOptions}</select></label><div class="tile-palette-actions"><button data-auto-rule-save>${(set.rules || []).some((rule) => rule.mask === activeAutoTileRuleMask) ? 'Update Rule' : '+ Add Rule'}</button></div><div class="auto-tile-rule-list">${(set.rules || []).map((rule) => { const tile = OpusAuthoringPlumbing.getTileById(tileset, rule.tileId); return `<div class="auto-tile-rule-card"><button data-auto-rule-edit="${rule.mask}">Mask ${rule.mask} · ${escapeHtml(tile ? tile.name : 'Missing Tile')}</button><button data-auto-rule-delete="${rule.mask}" aria-label="Delete Rule mask ${rule.mask}">×</button></div>`; }).join('') || '<p class="field-help">No explicit Rules. Default resolves every mask.</p>'}</div><div class="tile-palette-actions"><button data-auto-set-duplicate>Duplicate Set</button><button data-auto-set-manual ${usageCount ? '' : 'disabled'}>Convert Cells to Manual</button><button data-auto-set-delete>Delete Set</button></div>`;
  const commitAndRetile = (message) => { const count = recomputeAutoTileSetEverywhere(tileset, set.id).length; renderTilePalette(); validateCurrentProject(); showStatus(`${message}; ${count} resolved cell${count === 1 ? '' : 's'} updated`); };
  bindAutoTileSetNameInput(host.querySelector('[data-auto-set-name]'),tileset,set,next=>{renderTilePalette();validateCurrentProject();showStatus(`Renamed Auto-Tile Set to "${next}"; stable ID preserved`);});
  bindAutoTileSetChoice(host.querySelector('[data-auto-set-mode]'),tileset,set,()=>set.neighborMode,next=>['four-way','eight-way'].includes(next),next=>()=>{set.neighborMode=next;set.rules=set.rules.filter(rule=>OpusAuthoringPlumbing.canonicalizeAutoTileMask(next,rule.mask)===rule.mask);activeAutoTileRuleMask=OpusAuthoringPlumbing.canonicalizeAutoTileMask(next,activeAutoTileRuleMask);commitAndRetile('Changed neighbor mode');},next=>{const incompatible=(set.rules||[]).filter(rule=>OpusAuthoringPlumbing.canonicalizeAutoTileMask(next,rule.mask)!==rule.mask);return !incompatible.length||confirm(`Switching to ${next==='four-way'?'4-Way':'8-Way'} will remove ${incompatible.length} incompatible Rule${incompatible.length===1?'':'s'}. Continue?`);});
  bindAutoTileSetChoice(host.querySelector('[data-auto-set-default]'),tileset,set,()=>set.defaultTileId||null,next=>!next||!!OpusAuthoringPlumbing.getTileById(tileset,next),next=>()=>{set.defaultTileId=next;commitAndRetile('Changed Default Tile');});
  host.querySelectorAll('[data-auto-mask-bit]').forEach((button) => { button.onclick = () => { activeAutoTileRuleMask = OpusAuthoringPlumbing.canonicalizeAutoTileMask(set.neighborMode, activeAutoTileRuleMask ^ Number(button.dataset.autoMaskBit)); renderAutoTileSetDetails(tileset); }; });
  bindAutoTileSetAction(host.querySelector('[data-auto-rule-save]'),tileset,set,()=>{const tileId=host.querySelector('[data-auto-rule-tile]').value,mask=activeAutoTileRuleMask;if(!tileId||!OpusAuthoringPlumbing.getTileById(tileset,tileId)){showStatus('Choose an available Rule output Tile');return null;}if(!Number.isInteger(mask)||OpusAuthoringPlumbing.canonicalizeAutoTileMask(set.neighborMode,mask)!==mask)return null;if(set.rules.some(rule=>rule.mask===mask&&rule.tileId===tileId))return null;return ()=>{OpusAuthoringPlumbing.setAutoTileRule(set,mask,tileId);commitAndRetile(`Saved Rule mask ${mask}`);};});
  host.querySelectorAll('[data-auto-rule-edit]').forEach((button) => { button.onclick = () => { activeAutoTileRuleMask = Number(button.dataset.autoRuleEdit); renderAutoTileSetDetails(tileset); const rule = set.rules.find((entry) => entry.mask === activeAutoTileRuleMask); host.querySelector('[data-auto-rule-tile]').value = rule ? rule.tileId : ''; }; });
  host.querySelectorAll('[data-auto-rule-delete]').forEach(button=>bindAutoTileSetAction(button,tileset,set,()=>{const mask=Number(button.dataset.autoRuleDelete);if(!set.rules.some(rule=>rule.mask===mask))return null;return ()=>{OpusAuthoringPlumbing.removeAutoTileRule(set,mask);commitAndRetile(`Deleted Rule mask ${mask}; affected cells use Default`);};}));
  bindAutoTileSetAction(host.querySelector('[data-auto-set-duplicate]'),tileset,set,()=>()=>{ const copy = OpusAuthoringPlumbing.duplicateAutoTileSet(tileset, set.id); activeAutoTileSetId = copy.id; renderTilePalette(); showStatus(`Duplicated as "${copy.name}" with a new stable Set ID; existing cells remain on "${set.name}"`); });
  let manualUsage=0;
  bindAutoTileSetAction(host.querySelector('[data-auto-set-manual]'),tileset,set,()=>{manualUsage=OpusAuthoringPlumbing.autoTileSetUsage(liveAutoTileProject(),tileset.id,set.id).reduce((sum,entry)=>sum+entry.cellCount,0);if(!manualUsage)return null;return ()=>{const count = OpusAuthoringPlumbing.convertAutoTileCellsToManual(liveAutoTileProject(), tileset.id, set.id); renderTilePalette(); for (const item of placed) if (item.kind === 'tilemap' && item.tilesetRef === tileset.id) syncTilemapRenderer(item); validateCurrentProject(); showStatus(`Converted ${count} cell${count === 1 ? '' : 's'} to Manual; current resolved Tiles preserved`); };},()=>confirm(`Convert ${manualUsage} cell${manualUsage===1?'':'s'} managed by "${set.name}" to Manual? Resolved Tile IDs will be preserved.`));
  let deleteUsage=0;
  bindAutoTileSetAction(host.querySelector('[data-auto-set-delete]'),tileset,set,()=>{deleteUsage=OpusAuthoringPlumbing.autoTileSetUsage(liveAutoTileProject(),tileset.id,set.id).reduce((sum,entry)=>sum+entry.cellCount,0);return ()=>{OpusAuthoringPlumbing.removeAutoTileSet(tileset, set.id); activeAutoTileSetId = tileset.autoTileSets[0] && tileset.autoTileSets[0].id || null; renderTilePalette(); validateCurrentProject(); showStatus(`Deleted "${set.name}"${deleteUsage ? '; cells retain missing identity and visible Tiles for repair' : ''}`); };},()=>!deleteUsage||confirm(`"${set.name}" manages ${deleteUsage} cell${deleteUsage===1?'':'s'}. Delete it and retain repairable Set IDs plus current resolved Tiles?`));
}
function bindTilesetPaletteAdd(button,tileset,getSprites,commit) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);
  button.onclick=()=>{
    if(!guard.allowed())return;
    const sprites=getSprites();if(!sprites||!sprites.length)return;
    if(sprites.some(sprite=>!sprite||findSpriteAssetById(sprite.id)!==sprite)){showStatus('Sprite selection changed; Tiles unchanged.');return;}
    if(!guard.beforeChange())return;
    const created=OpusAuthoringPlumbing.addSpriteAssetsToTileset(tileset,sprites);guard.updated();commit(created);
  };
}
function bindTilesetTileAction(button,tileset,tile,prepare,confirmChange) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);
  button.onclick=()=>{
    if(tileset.tiles.filter(entry=>entry===tile).length!==1||tileset.tiles.filter(entry=>entry.id===tile.id).length!==1||!guard.allowed())return;
    const change=prepare();if(!change)return;
    if(confirmChange&&!confirmChange())return;
    if(!guard.beforeChange())return;
    change();guard.updated();
  };
}
function bindTileCollisionRectangleInput(input,tileset,tile,preview,render) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets),field=input.dataset.tileCollisionField;let edited=false;
  const current=()=>tile.collision?.rect?.[field],restore=()=>{const value=current();input.value=Number.isFinite(value)?String(value):'';};
  input.oninput=()=>{
    const next=input.value===''?NaN:Number(input.value);
    if(Object.is(next,current()))return;
    if(!['minX','minY','maxX','maxY'].includes(field)||tile.collision?.mode!=='custom-rect'||!tile.collision.rect||tileset.tiles.filter(entry=>entry===tile).length!==1||!guard.allowed()||(!edited&&!guard.beforeChange())){restore();return;}
    edited=true;tile.collision.rect[field]=next;guard.updated();preview();
  };
  input.onchange=()=>{edited=false;render();};
}
function bindTileCollisionChoices(host,tileset,tile,render) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets),mode=host.querySelector('[data-tile-collision-mode]'),slope=host.querySelector('[data-tile-collision-slope]'),oneWay=host.querySelector('[data-tile-collision-one-way]');
  const current=()=>tile.collision||{mode:'none',oneWay:false};
  const commit=(input)=>{const draft={};OpusAuthoringPlumbing.setTileCollision(draft,input);const next=draft.collision;if(JSON.stringify(next)===JSON.stringify(current()))return true;if(tileset.tiles.filter(entry=>entry===tile).length!==1||!guard.beforeChange())return false;tile.collision=next;guard.updated();render();return true;};
  mode.onchange=()=>{const old=current(),next=mode.value;if(next===old.mode)return;if(!['none','full-cell','custom-rect','slope'].includes(next)){mode.value=old.mode;return;}const input=next==='custom-rect'?{mode:next,oneWay:old.oneWay,rect:{minX:0,minY:0,maxX:1,maxY:1}}:next==='slope'?{mode:next,oneWay:old.oneWay,slope:'up-right'}:{mode:next,oneWay:old.oneWay};if(!commit(input))mode.value=old.mode;};
  if(slope)slope.onchange=()=>{const old=current(),next=slope.value;if(next===old.slope)return;if(old.mode!=='slope'||!['up-left','up-right'].includes(next)||!commit({...old,slope:next}))slope.value=old.slope||'up-right';};
  oneWay.onchange=()=>{const old=current();if(oneWay.checked===(old.oneWay===true))return;if(old.mode==='none'||!commit({...old,oneWay:oneWay.checked}))oneWay.checked=old.oneWay===true;};
  const full=host.querySelector('[data-tile-collision-full]');if(full)full.onclick=()=>commit({mode:'full-cell',oneWay:current().oneWay});
}
function bindTilesetTileIdentityInputs(name,select,tileset,tile,render) {
  const guard=createAssetContentEditGuard(tileset,()=>tilesets);let edited=false;
  const present=()=>tileset.tiles.filter(entry=>entry===tile).length===1;
  name.oninput=()=>{
    const next=name.value.trim()||tile.name;if(next===tile.name)return;
    if(!present()||!guard.allowed()||(!edited&&!guard.beforeChange())){name.value=tile.name;return;}
    edited=true;tile.name=next;guard.updated();
  };
  name.onblur=()=>{name.value=tile.name;edited=false;render(false);};
  select.onchange=()=>{
    const next=select.value||null,retained=tile.spriteAssetRef||null;
    if(next===retained){select.value=retained||'';return;}
    if(next&&!findSpriteAssetById(next)){select.value=retained||'';showStatus('Sprite Asset is unavailable; Tile unchanged.');return;}
    if(!present()||!guard.beforeChange()){select.value=retained||'';return;}
    tile.spriteAssetRef=next;guard.updated();render(true);
  };
}
function renderTilePaletteDetails(tileset) {
  const host = document.getElementById('tile-palette-details');
  if (tilePaletteAddingSprites) {
    host.innerHTML = `<strong>Add Sprite Assets</strong><p class="field-help">Select one or more existing Sprite Assets. Tiles reference their stable IDs; atlas metadata and image bytes stay on the Sprite/Texture.</p><div data-tile-sprite-picker>${spriteAssets.length ? spriteAssets.map((sprite) => `<label><input type="checkbox" value="${escapeHtml(sprite.id)}">${spriteRegionPreviewHtml(sprite, sourceTextureForSpriteAsset(sprite), 42)} ${escapeHtml(sprite.name)}</label>`).join('') : '<p>No Sprite Assets are available.</p>'}</div><div class="tile-palette-actions"><button data-add-selected-sprites ${spriteAssets.length ? '' : 'disabled'}>Add Selected</button><button data-cancel-add-sprites>Cancel</button></div>`;
    host.querySelector('[data-cancel-add-sprites]').onclick = () => { tilePaletteAddingSprites = false; renderTilePalette(); };
    const add=host.querySelector('[data-add-selected-sprites]');if(add)bindTilesetPaletteAdd(add,tileset,()=>{const ids=[...host.querySelectorAll('[data-tile-sprite-picker] input:checked')].map(input=>input.value);if(!ids.length){showStatus('Select at least one Sprite Asset');return null;}return ids.map(findSpriteAssetById);},created=>{activeTileId=created[0].id;tilePaletteAddingSprites=false;renderTilePalette();renderTilesetLibrary();showStatus(`Added ${created.length} Sprite Asset${created.length===1?'':'s'} as Tiles in deterministic Asset Library order`);});
    return;
  }
  const tile = findActiveTile(); if (!tile) { host.innerHTML = '<div class="tile-palette-empty">Select a Tile to edit its name and Sprite Asset.</div>'; return; }
  const sprite = findSpriteAssetById(tile.spriteAssetRef); const index = tileset.tiles.indexOf(tile);
  const collision = tile.collision || { mode: 'none' }; const resolvedCollision = OpusAuthoringPlumbing.resolveTileCollision(tile); const rect = collision.rect || { minX: 0, minY: 0, maxX: 1, maxY: 1 }; const collisionProblems = OpusAuthoringPlumbing.validateTileCollision(collision);
  const shape = resolvedCollision.mode === 'none' ? '' : (() => { const r = resolvedCollision.mode === 'full-cell' || resolvedCollision.mode === 'slope' ? { minX: 0, minY: 0, maxX: 1, maxY: 1 } : resolvedCollision.rect;
    const fill = `<span class="tile-collision-preview-shape${resolvedCollision.oneWay && resolvedCollision.mode !== 'slope' ? ' one-way' : ''}${resolvedCollision.mode === 'slope' ? ` slope-${resolvedCollision.slope}` : ''}" style="left:${r.minX * 100}%;top:${(1 - r.maxY) * 100}%;width:${(r.maxX - r.minX) * 100}%;height:${(r.maxY - r.minY) * 100}%"></span>`;
    const edge = resolvedCollision.mode === 'slope' ? `<svg class="tile-slope-preview-edge${resolvedCollision.oneWay ? ' one-way' : ''}" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="${resolvedCollision.slope === 'up-left' ? '0' : '100'}" x2="100" y2="${resolvedCollision.slope === 'up-left' ? '100' : '0'}"></line></svg>` : '';
    return fill + edge + (resolvedCollision.oneWay ? '<span class="tile-one-way-indicator">↑ One-Way</span>' : ''); })();
  host.innerHTML = `<strong>Tile Details</strong><label>Tile Name<input type="text" data-tile-detail-name value="${escapeHtml(tile.name)}"></label><label>Sprite Asset<select data-tile-detail-sprite><option value="">Select Sprite Asset…</option>${tile.spriteAssetRef && !sprite ? `<option value="${escapeHtml(tile.spriteAssetRef)}" selected>Missing Sprite Asset (repair)</option>` : ''}${spriteAssets.map((asset) => `<option value="${escapeHtml(asset.id)}"${tile.spriteAssetRef === asset.id ? ' selected' : ''}>${escapeHtml(asset.name)}</option>`).join('')}</select></label><p class="field-help">Palette position ${index + 1}. Identity is stable inside this Tileset and is not based on this name or position.</p>
    <section class="tile-collision-editor" data-tile-collision-section><strong>Collision</strong><label>Mode<select data-tile-collision-mode><option value="none"${collision.mode === 'none' ? ' selected' : ''}>None</option><option value="full-cell"${collision.mode === 'full-cell' ? ' selected' : ''}>Full Cell</option><option value="custom-rect"${collision.mode === 'custom-rect' ? ' selected' : ''}>Custom Rectangle</option><option value="slope"${collision.mode === 'slope' ? ' selected' : ''}>Slope Triangle</option></select></label>
    <p class="field-help">Character Collision 2D consumes this Tile shape. One-Way permits upward passage and catches a descending Character on the walkable surface.</p><label>One-Way Platform<input type="checkbox" data-tile-collision-one-way ${collision.oneWay ? 'checked' : ''} ${collision.mode === 'none' ? 'disabled' : ''}></label>${collision.mode === 'slope' ? `<label>Rising Direction<select data-tile-collision-slope><option value="up-right"${collision.slope === 'up-right' ? ' selected' : ''}>Up Right ↗</option><option value="up-left"${collision.slope === 'up-left' ? ' selected' : ''}>Up Left ↖</option></select></label><p class="field-help">Triangle fills the lower half of the cell. Steepness follows the Tileset cell aspect ratio; Characters above their maximum slope angle cannot walk it.</p>` : collision.mode === 'custom-rect' ? `<div class="field-pair"><label>Left<input type="number" step="0.01" data-tile-collision-field="minX" value="${escapeHtml(rect.minX)}"></label><label>Bottom<input type="number" step="0.01" data-tile-collision-field="minY" value="${escapeHtml(rect.minY)}"></label><label>Right<input type="number" step="0.01" data-tile-collision-field="maxX" value="${escapeHtml(rect.maxX)}"></label><label>Top<input type="number" step="0.01" data-tile-collision-field="maxY" value="${escapeHtml(rect.maxY)}"></label></div><p class="field-help">Normalized cell edges: 0 is the near edge and 1 is the opposite edge.</p><button type="button" data-tile-collision-full>Use Full Cell</button>` : `<p class="field-help">${collision.mode === 'full-cell' ? 'Full Cell marks the entire grid cell as the collision area.' : 'None gives this Tile no collision metadata.'}</p>`}
    <div class="tile-collision-preview" style="--tile-cell-aspect:${Math.max(0.1, Number(tileset.cellSize.width) || 1) / Math.max(0.1, Number(tileset.cellSize.height) || 1)}"><div class="tile-collision-preview-art ${sprite && sprite.filtering === 'nearest' ? 'pixel' : ''}">${sprite ? spriteRegionPreviewHtml(sprite, sourceTextureForSpriteAsset(sprite), 180) : '<span class="tile-palette-missing">Missing artwork</span>'}</div>${shape}</div><div class="tile-collision-preview-label"><span>Cell / Art</span><span>Collision</span></div>${collisionProblems.length ? `<p class="field-help" role="alert">${escapeHtml(collisionProblems[0].message)} Safe preview resolves to None.</p>` : ''}</section>
    <div class="tile-palette-actions"><button data-tile-move-left ${index === 0 ? 'disabled' : ''}>← Move Left</button><button data-tile-move-right ${index === tileset.tiles.length - 1 ? 'disabled' : ''}>Move Right →</button><button data-tile-duplicate>Duplicate Tile</button><button data-tile-remove>Remove Tile</button></div>`;
  bindTilesetTileIdentityInputs(host.querySelector('[data-tile-detail-name]'),host.querySelector('[data-tile-detail-sprite]'),tileset,tile,(spriteChanged)=>{if(spriteChanged)for(const item of placed)if(item.kind==='tilemap'&&item.tilesetRef===tileset.id)syncTilemapRenderer(item);renderTilePalette();renderTilesetLibrary();validateCurrentProject();});
  bindTileCollisionChoices(host,tileset,tile,()=>{renderTilePalette();renderTilesetLibrary();syncTilemapOverlay();validateCurrentProject();});
  host.querySelectorAll('[data-tile-collision-field]').forEach((input) => bindTileCollisionRectangleInput(input,tileset,tile,()=>{syncTilemapOverlay();validateCurrentProject();},()=>{renderTilePalette();renderTilesetLibrary();}));
  for(const [selector,delta] of [['[data-tile-move-left]',-1],['[data-tile-move-right]',1]])bindTilesetTileAction(host.querySelector(selector),tileset,tile,()=>{const index=tileset.tiles.indexOf(tile),target=index+delta;if(target<0||target>=tileset.tiles.length)return null;return ()=>{OpusAuthoringPlumbing.reorderTilesetTile(tileset,tile.id,delta);renderTilePalette();renderTilesetLibrary();};});
  bindTilesetTileAction(host.querySelector('[data-tile-duplicate]'),tileset,tile,()=>()=>{const copy=OpusAuthoringPlumbing.duplicateTileInTileset(tileset,tile.id);activeTileId=copy.id;renderTilePalette();renderTilesetLibrary();showStatus(`Duplicated Tile as "${copy.name}" with a new local ID`);});
  let removalUses=0,removalAutoUses=[];
  bindTilesetTileAction(host.querySelector('[data-tile-remove]'),tileset,tile,()=>{const uses = placed.reduce((n, item) => n + (item.kind === 'tilemap' && item.tilesetRef === tileset.id ? (item.layers || []).reduce((sum, layer) => sum + (layer.cells || []).filter((cell) => cell.tileId === tile.id).length, 0) : 0), 0); const autoUses = (tileset.autoTileSets || []).flatMap((set) => [set.defaultTileId === tile.id ? `Auto-Tile Set "${set.name}" Default` : null, ...(set.rules || []).filter((rule) => rule.tileId === tile.id).map((rule) => `Auto-Tile Set "${set.name}" Rule mask ${rule.mask}`)]).filter(Boolean); removalUses=uses;removalAutoUses=autoUses;return ()=>{const removedIndex = tileset.tiles.indexOf(tile); OpusAuthoringPlumbing.removeTileFromTileset(tileset, tile.id); activeTileId = (tileset.tiles[Math.min(removedIndex, tileset.tiles.length - 1)] || {}).id || null; tilemapBrushTileId = activeTileId; for (const item of placed) if (item.kind === 'tilemap' && item.tilesetRef === tileset.id) syncTilemapRenderer(item); renderTilePalette(); renderTilesetLibrary(); validateCurrentProject(); showStatus(`Removed Tile "${tile.name}"${uses || autoUses.length ? '; references remain for repair' : '; its Sprite Asset remains'}`); };},()=>!(removalUses||removalAutoUses.length)||confirm(`Tile "${tile.name}" is used by ${removalUses} painted cell${removalUses === 1 ? '' : 's'}${removalAutoUses.length ? ` and ${removalAutoUses.slice(0, 4).join(', ')}` : ''}. Remove it and leave repairable references?`));
}
function addEmptyTile() { const tileset = findTilesetById(activeTilesetId); if (!tileset) return; if(!createAssetContentEditGuard(tileset,()=>tilesets).beforeChange())return; const tile = OpusAuthoringPlumbing.addTileToTileset(tileset, null); activeTileId = tile.id; tilePaletteAddingSprites = false; renderTilePalette(); renderTilesetLibrary(); showStatus('Added repairable Tile; choose a Sprite Asset before validation can pass'); }
function addAutoTileSetFromPalette() { const tileset = findTilesetById(activeTilesetId); if (!tileset) return; if(!createAssetContentEditGuard(tileset,()=>tilesets).beforeChange())return; const set = OpusAuthoringPlumbing.createAutoTileSet(tileset, { name: 'Auto-Tile Set', neighborMode: 'four-way', defaultTileId: activeTileId || null, rules: [] }); activeAutoTileSetId = set.id; activeAutoTileRuleMask = 0; tilePaletteMode = 'auto-tiles'; tilemapBrushKind = 'auto-tile'; tilemapBrushAutoTileSetId = set.id; renderTilePalette(); syncTilemapOverlay(); validateCurrentProject(); showStatus(set.defaultTileId ? `Created "${set.name}" using the selected Tile as Default` : `Created incomplete "${set.name}"; choose a Default Tile before painting`); }
function addTerrainBrushFromPalette() { const tileset=findTilesetById(activeTilesetId);if(!tileset)return;const useAuto=!!activeAutoTileSetId&&tilePaletteMode==='auto-tiles';if(!createAssetContentEditGuard(tileset,()=>tilesets).beforeChange())return;const brush=OpusAuthoringPlumbing.createTerrainBrush(tileset,useAuto?{name:'Connected Terrain',mode:'auto-tile',autoTileSetId:activeAutoTileSetId}:{name:'Terrain Brush',mode:'weighted-tiles',seed:0,variants:activeTileId?[{tileId:activeTileId,weight:1}]:[]});activeTerrainBrushId=brush.id;tilePaletteMode='terrain';tilemapBrushKind='terrain';tilemapBrushTerrainId=brush.id;tilemapBrushAutoTileSetId=null;renderTilePalette();syncTilemapOverlay();validateCurrentProject();showStatus(useAuto?`Created "${brush.name}" from selected Auto-Tile Set`:`Created "${brush.name}"${activeTileId?' from the selected Tile':''}`);}
document.getElementById('create-tileset-btn').onclick = () => { pushUndo(); createTileset(); };
document.getElementById('tileset-library-search').addEventListener('input', renderTilesetLibrary);
document.getElementById('tileset-library-folder-filter').addEventListener('change', renderTilesetLibrary);
document.getElementById('tile-palette-search').addEventListener('input', renderTilePalette);
document.getElementById('tile-palette-size').addEventListener('change', renderTilePalette);
document.getElementById('tile-palette-add-tile').onclick = addEmptyTile;
document.getElementById('tile-palette-add-sprites').onclick = () => { tilePaletteAddingSprites = true; renderTilePalette(); };
document.getElementById('tile-palette-add-auto-set').onclick = addAutoTileSetFromPalette;
document.getElementById('tile-palette-add-terrain').onclick = addTerrainBrushFromPalette;
document.getElementById('tile-palette-tiles-tab').onclick = () => { tilePaletteMode = 'tiles'; tilePaletteAddingSprites = false; renderTilePalette(); };
document.getElementById('tile-palette-auto-tab').onclick = () => { tilePaletteMode = 'auto-tiles'; tilePaletteAddingSprites = false; renderTilePalette(); };
document.getElementById('tile-palette-terrain-tab').onclick = () => { tilePaletteMode = 'terrain'; tilePaletteAddingSprites = false; renderTilePalette(); };
document.getElementById('tile-palette-close').onclick = closeTilePalette;
renderTilesetLibrary();

// Phase 038: Tilemap Chunks are project Assets whose contents are copied
// into Tilemaps by the authoring-only Stamp tool. They never create runtime
// Chunk instances or retain a link after stamping.
let nextTilemapChunkId = 1;
function reconcileTilemapChunkIdCounter(id) { const match = /^tilemap-chunk-(\d+)$/.exec(String(id || '')); if (match) nextTilemapChunkId = Math.max(nextTilemapChunkId, Number(match[1]) + 1); }
function bindTilemapChunkNameInput(input,chunk,render) {
  const guard=createAssetContentEditGuard(chunk,()=>tilemapChunks);
  input.onchange=()=>{
    const next=OpusAuthoringPlumbing.uniqueTilemapChunkName(tilemapChunks,input.value,chunk.id);
    if(next===chunk.name){input.value=chunk.name;return;}
    if(!guard.beforeChange()){input.value=chunk.name;return;}
    chunk.name=next;guard.updated();render();
  };
}
function generateTilemapChunkId() { return OpusAuthoringPlumbing.uniqueTilemapChunkId(tilemapChunks, `tilemap-chunk-${nextTilemapChunkId++}`); }
function findTilemapChunkById(id) { return id ? tilemapChunks.find((chunk) => chunk.id === id) : undefined; }
function serializeTilemapChunks() { return tilemapChunks.map((chunk) => OpusAuthoringPlumbing.normalizeTilemapChunk(chunk)); }
function loadTilemapChunks(records) { tilemapChunks = (Array.isArray(records) ? records : []).map((record) => OpusAuthoringPlumbing.normalizeTilemapChunk(record)); for (const chunk of tilemapChunks) reconcileTilemapChunkIdCounter(chunk.id); if (selectedTilemapChunkId && !findTilemapChunkById(selectedTilemapChunkId)) selectedTilemapChunkId = null; renderTilemapChunkLibrary(); }
function tilemapChunkPreviewHtml(chunk) { const colors = ['#2dd4bf', '#60a5fa', '#c084fc', '#f59e0b', '#fb7185']; const cells = []; for (let i = 0; i < chunk.layers.length; i++) for (const cell of chunk.layers[i].cells || []) cells.push(`<rect x="${cell.x}" y="${chunk.height - cell.y - 1}" width="1" height="1" fill="${colors[i % colors.length]}" opacity="${0.58 + Math.min(i, 3) * 0.1}"><title>${escapeHtml(chunk.layers[i].name)} · ${cell.x},${cell.y}</title></rect>`); const markers = (chunk.spawnMarkers || []).map((marker) => `<circle cx="${marker.x + 0.5}" cy="${chunk.height - marker.y - 0.5}" r=".22" fill="#ffd166"><title>${escapeHtml(marker.name)}</title></circle>`); return `<svg viewBox="0 0 ${chunk.width} ${chunk.height}" style="width:68px;height:54px;background:#111827;border:1px solid #334155;image-rendering:pixelated"><path d="M0 0H${chunk.width}V${chunk.height}H0Z" fill="none" stroke="#475569" stroke-width=".08"/>${cells.join('')}${markers.join('')}</svg>`; }
function renderTilemapChunkInspector() { const host = document.getElementById('tilemap-chunk-inspector'); if (!host) return; const chunk = findTilemapChunkById(selectedTilemapChunkId); if (!chunk) { host.innerHTML = ''; return; } const tileset = findTilesetById(chunk.tilesetRef); const issues = OpusAuthoringPlumbing.validateTilemapChunk(chunk, tileset, prefabs); const semantic = { auto: 0, terrain: 0, autoTerrain: 0 }; for (const layer of chunk.layers) for (const cell of layer.cells) { if (cell.autoTileSetId) semantic.auto++; if (cell.terrainBrushId) semantic.terrain++; if (cell.autoTileSetId && cell.terrainBrushId) semantic.autoTerrain++; }
  host.innerHTML = `<div class="asset-row"><strong>Tilemap Chunk Inspector</strong>${tilemapChunkPreviewHtml(chunk)}<label>Name<input data-chunk-name value="${escapeHtml(chunk.name)}"></label><p class="field-help">Tileset: ${escapeHtml(tileset ? tileset.name : `Missing (${chunk.tilesetRef})`)} · ${chunk.width}×${chunk.height} · ${chunk.layers.length} Layers · ${OpusAuthoringPlumbing.tilemapChunkCellCount(chunk)} Cells · ${chunk.spawnMarkers.length} Markers</p><p class="field-help">Semantic Cells: ${semantic.auto} Auto-Tile · ${semantic.terrain} Terrain · ${semantic.autoTerrain} Auto-Terrain. Bottom-left anchor; holes merge without erasing.</p>${issues.length ? `<div class="validation-error">${issues.map((entry) => escapeHtml(entry.message)).join('<br>')}</div>` : '<p class="field-help">Ready to stamp. Layer mapping is target-specific editor state.</p>'}<button data-chunk-stamp ${issues.length ? 'disabled' : ''}>Stamp Chunk</button><button data-chunk-export>Export Portable Chunk</button><button data-chunk-duplicate>Duplicate</button><button data-chunk-delete>Delete</button></div>`;
  bindTilemapChunkNameInput(host.querySelector('[data-chunk-name]'),chunk,renderTilemapChunkLibrary);
  host.querySelector('[data-chunk-stamp]').onclick = () => { const item = selectedTilemap(); if (!item) { showStatus('Select a target Tilemap, then choose Stamp Chunk'); return; } tilemapChunkMapping = null; setTilemapTool('stamp-chunk'); };
  host.querySelector('[data-chunk-export]').onclick = () => previewTilemapBundleExport('tilemap-chunk', chunk);
  host.querySelector('[data-chunk-duplicate]').onclick = () => { pushUndo(); const copy = OpusAuthoringPlumbing.duplicateTilemapChunk(chunk, generateTilemapChunkId(), OpusAuthoringPlumbing.uniqueTilemapChunkName(tilemapChunks, `${chunk.name} Copy`)); tilemapChunks.push(copy); selectedTilemapChunkId = copy.id; renderTilemapChunkLibrary(); showStatus(`Duplicated "${chunk.name}" as an independent Chunk Asset`); };
  host.querySelector('[data-chunk-delete]').onclick = () => { if (!confirm(`Delete Chunk "${chunk.name}"? Previously stamped Tilemaps are materialized and will not change.`)) return; pushUndo(); tilemapChunks = tilemapChunks.filter((entry) => entry.id !== chunk.id); selectedTilemapChunkId = null; tilemapChunkMapping = null; setTilemapTool(null); renderTilemapChunkLibrary(); showStatus(`Deleted Chunk "${chunk.name}"; stamped worlds remain unchanged`); };
}
function renderTilemapChunkLibrary() { const list = document.getElementById('tilemap-chunk-library-list'); if (!list) return; const search = document.getElementById('tilemap-chunk-library-search'); const folderEl = document.getElementById('tilemap-chunk-library-folder-filter'); const query = search ? search.value.trim() : ''; const folder = folderEl ? folderEl.value : ''; if (folderEl) populateAssetFolderFilter(folderEl, tilemapChunks, folder); const visible = tilemapChunks.filter((chunk) => assetMatchesFilter(chunk, query, folder)); list.innerHTML = visible.length ? visible.map((chunk) => { const tileset = findTilesetById(chunk.tilesetRef); const issues = OpusAuthoringPlumbing.validateTilemapChunk(chunk, tileset, prefabs); return `<div class="asset-row" data-tilemap-chunk-id="${escapeHtml(chunk.id)}"><div class="sprite-asset-preview">${tilemapChunkPreviewHtml(chunk)}<div><span class="asset-row-name">${escapeHtml(chunk.name)}</span><div class="asset-row-meta">Tilemap Chunk v1 · ${chunk.width}×${chunk.height} · ${chunk.layers.length} Layers · ${OpusAuthoringPlumbing.tilemapChunkCellCount(chunk)} Cells · ${chunk.spawnMarkers.length} Markers · ${escapeHtml(tileset ? tileset.name : 'Missing Tileset')}${issues.length ? ` · ${issues.length} issue${issues.length === 1 ? '' : 's'}` : ''}</div></div></div>${assetTagsRowHtml(chunk,true)}<div class="asset-row-actions"><button data-select-tilemap-chunk="${escapeHtml(chunk.id)}">Inspect</button><button data-stamp-tilemap-chunk="${escapeHtml(chunk.id)}" ${issues.length ? 'disabled' : ''}>Stamp Chunk</button></div></div>`; }).join('') : `<p style="color:#66759a;font-size:11px;margin:2px 0">${tilemapChunks.length ? 'No Tilemap Chunks match this search.' : 'No Tilemap Chunks yet. Select a Tilemap and use Capture Chunk.'}</p>`;
  list.querySelectorAll('[data-select-tilemap-chunk]').forEach((button) => { button.onclick = () => { selectedTilemapChunkId = button.dataset.selectTilemapChunk; renderTilemapChunkLibrary(); document.getElementById('tilemap-stamp-chunk-tool').disabled = false; }; });
  list.querySelectorAll('[data-stamp-tilemap-chunk]').forEach((button) => { button.onclick = () => { selectedTilemapChunkId = button.dataset.stampTilemapChunk; document.getElementById('tilemap-stamp-chunk-tool').disabled = false; const item = selectedTilemap(); if (!item) { showStatus('Chunk selected. Select a target Tilemap to stamp it.'); return; } tilemapChunkMapping = null; setTilemapTool('stamp-chunk'); }; });
  list.querySelectorAll('[data-asset-tagedit]').forEach((input) => { bindAssetMetadataInput(input,findTilemapChunkById(input.dataset.assetTagedit),()=>tilemapChunks,renderTilemapChunkLibrary); }); renderTilemapChunkInspector();
  list.querySelectorAll('[data-create-asset-variant]').forEach(button=>bindIndependentAssetCopy(button,findTilemapChunkById(button.dataset.createAssetVariant),()=>tilemapChunks,OpusAuthoringPlumbing.duplicateTilemapChunk,()=>OpusAuthoringPlumbing.uniqueTilemapChunkId(tilemapChunks,'Variant'),renderTilemapChunkLibrary,id=>{selectedTilemapChunkId=id;},'Variant'));
}
document.getElementById('tilemap-chunk-library-search').addEventListener('input', renderTilemapChunkLibrary);
document.getElementById('tilemap-chunk-library-folder-filter').addEventListener('change', renderTilemapChunkLibrary);
renderTilemapChunkLibrary();

// Phase 021: Sprite Animation Clips are ordinary registered Asset Library
// content. Frames contain only typed Sprite Asset IDs plus milliseconds;
// all Texture/sourceRect/PPU/filtering data stays owned by Sprite Assets.
function createSpriteAnimationClip(options) {
  const opts = options || {};
  const clip = OpusAuthoringPlumbing.createSpriteAnimationClip({
    id: generateSpriteAnimationId(),
    name: OpusAuthoringPlumbing.uniqueAssetName(opts.name || 'Sprite Animation', spriteAnimationClips.map((entry) => entry.name)),
    frames: opts.frames || [], folder: opts.folder, tags: opts.tags,
  });
  spriteAnimationClips.push(clip);
  selectedSpriteAnimationId = clip.id;
  renderSpriteAnimationLibrary();
  openSpriteAnimationEditor(clip.id);
  showStatus(`Created Sprite Animation Clip "${clip.name}"`);
  return clip;
}
function serializeSpriteAnimationClips(usedIds) {
  const used = usedIds || collectProjectDependencies().spriteAnimations;
  return spriteAnimationClips.filter((clip) => used.has(clip.id)).map((clip) => OpusAuthoringPlumbing.createSpriteAnimationClip(clip));
}
function loadSpriteAnimationClips(records) {
  if (!Array.isArray(records)) return;
  for (const record of records) {
    if (findSpriteAnimationById(record.id)) continue;
    reconcileSpriteAnimationIdCounter(record.id);
    spriteAnimationClips.push(OpusAuthoringPlumbing.createSpriteAnimationClip(record));
  }
  renderSpriteAnimationLibrary();
}
function computeSpriteAnimationUsageCount(id) {
  syncCurrentLevelObjects();
  let count = 0;
  const countRecord = (record) => {
    const renderer = record && record.kind === 'sprite' && record.components && record.components['sprite-renderer'];
    if (renderer) count += OpusAuthoringPlumbing.normalizeSpriteAnimationStates(renderer.animationStates).reduce((total, state) => total + (state.clipRef === id ? 1 : 0) + state.directionalVariants.filter((variant) => variant.clipRef === id).length, 0);
    count += (record && record.behaviors || []).filter((behavior) => behavior.trigger === 'spriteAnimationEvent' && behavior.eventRef && behavior.eventRef.clipId === id).length;
  };
  for (const level of levels) for (const record of level.objects || []) countRecord(record);
  for (const prefab of prefabs) for (const record of (prefab.records || (prefab.record ? [prefab.record] : []))) countRecord(record);
  return count;
}
function countSpriteAnimationEventListenerUses(clipId, eventId) {
  syncCurrentLevelObjects(); let count = 0;
  const scan = (record) => { count += (record && record.behaviors || []).filter((behavior) => behavior.trigger === 'spriteAnimationEvent' && behavior.eventRef && behavior.eventRef.clipId === clipId && behavior.eventRef.eventId === eventId).length; };
  for (const level of levels) for (const record of level.objects || []) scan(record);
  for (const prefab of prefabs) for (const record of (prefab.records || (prefab.record ? [prefab.record] : []))) scan(record);
  return count;
}
function spriteAnimationFramePreview(clip) {
  const first = clip && clip.frames && clip.frames[0];
  const asset = first && findSpriteAssetById(first.spriteAsset);
  return asset ? spriteRegionPreviewHtml(asset, sourceTextureForSpriteAsset(asset), 44) : '<div class="sprite-thumbnail" role="img" aria-label="Sprite Animation Clip">▶</div>';
}
function renderSpriteAnimationInspector() {
  const host = document.getElementById('sprite-animation-inspector');
  if (!host) return;
  const clip = findSpriteAnimationById(selectedSpriteAnimationId);
  if (!clip) { host.innerHTML = ''; return; }
  host.innerHTML = `<div class="asset-row" data-sprite-animation-inspector="${clip.id}"><strong>Sprite Animation Clip</strong>
    <div class="sprite-asset-preview">${spriteAnimationFramePreview(clip)}<span>${escapeHtml(clip.name)}<br>${clip.frames.length} frame${clip.frames.length === 1 ? '' : 's'} · ${clip.playbackMode === 'loop' ? 'loop' : 'once'} · ${OpusAuthoringPlumbing.spriteAnimationTotalDuration(clip)} ms</span></div>
    <div class="field-row"><label>Name</label><input type="text" data-sprite-animation-name value="${escapeHtml(clip.name)}"></div>
    <div class="field-row"><label>Folder / tags</label><input type="text" data-sprite-animation-tags value="${escapeHtml(formatAssetTagInput(clip))}" placeholder="Folder: tag1, tag2"></div>
    <p class="field-help">Open the dedicated visual editor to arrange frames, edit timing, preview, scrub, and choose Once or Loop.</p>
    <button type="button" class="toolbar-btn" data-open-sprite-animation-editor>Open Animation Editor</button>
  </div>`;
  const nameInput = host.querySelector('[data-sprite-animation-name]');
  bindAssetNameInput(nameInput,clip,()=>spriteAnimationClips,()=>{renderSpriteAnimationLibrary();renderInspector();});
  bindAssetMetadataInput(host.querySelector('[data-sprite-animation-tags]'),clip,()=>spriteAnimationClips,renderSpriteAnimationLibrary);
  host.querySelector('[data-open-sprite-animation-editor]').onclick = () => openSpriteAnimationEditor(clip.id);
}

// Dedicated Phase 022 Sprite Animation Editor. Preview state is deliberately
// local to this surface and uses the exact Phase 021/022 playback helpers;
// it never touches a scene Sprite's transient playback object or Undo stack.
let spriteAnimationEditorState = { clipId: null, selectedFrameIndex: 0, playback: null, rafId: 0, lastTimestamp: null, draggedFrameIndex: null, lastPreviewEvent: null };
function spriteAnimationEditorClip() { return findSpriteAnimationById(spriteAnimationEditorState.clipId); }
function stopSpriteAnimationPreview(reset) {
  if (spriteAnimationEditorState.rafId) cancelAnimationFrame(spriteAnimationEditorState.rafId);
  spriteAnimationEditorState.rafId = 0; spriteAnimationEditorState.lastTimestamp = null;
  const clip = spriteAnimationEditorClip();
  if (reset || !spriteAnimationEditorState.playback) { spriteAnimationEditorState.playback = OpusAuthoringPlumbing.createSpriteAnimationPlayback(clip && clip.id, false); spriteAnimationEditorState.lastPreviewEvent = null; }
  else spriteAnimationEditorState.playback.playing = false;
}
function resetSpriteAnimationPreview() { stopSpriteAnimationPreview(true); renderSpriteAnimationEditor(); }
function spriteAnimationPreviewArtworkHtml(asset) {
  if (!asset) return '<div class="sprite-animation-preview-missing">Missing Sprite Asset</div>';
  const texture = sourceTextureForSpriteAsset(asset);
  const dims = OpusAuthoringPlumbing.textureDimensions(texture);
  const region = OpusAuthoringPlumbing.spriteRegionPixels(asset, texture);
  if (!texture || !dims || !region) return '<div class="sprite-animation-preview-missing">Missing source Texture</div>';
  const box = 240; const scale = Math.min(box / region.width, box / region.height);
  const left = -region.x * scale + (box - region.width * scale) / 2;
  const top = -region.y * scale + (box - region.height * scale) / 2;
  return `<div class="sprite-animation-preview-art${asset.filtering === 'nearest' ? ' pixel' : ''}" role="img" aria-label="Preview of ${escapeHtml(asset.name)}"><img src="${texture.dataURL}" alt="" style="width:${dims.width * scale}px;height:${dims.height * scale}px;left:${left}px;top:${top}px"></div>`;
}
function renderSpriteAnimationPreview() {
  const clip = spriteAnimationEditorClip(); const playback = spriteAnimationEditorState.playback;
  const index = Math.max(0, Math.min((clip && clip.frames.length || 1) - 1, playback && playback.currentFrameIndex || 0));
  const frame = clip && clip.frames[index]; const asset = frame && findSpriteAssetById(frame.spriteAsset);
  const stage = document.getElementById('sprite-animation-preview-stage');
  if (stage) stage.innerHTML = clip && clip.frames.length ? spriteAnimationPreviewArtworkHtml(asset) : '<div class="sprite-animation-empty"><strong>Add Sprite frames to begin.</strong><span>Use + Add Frame or drag a Sprite Asset into the frame strip.</span></div>';
  const total = OpusAuthoringPlumbing.spriteAnimationTotalDuration(clip);
  const current = playback && playback.completed ? total : OpusAuthoringPlumbing.spriteAnimationPlaybackTime(playback, clip);
  const scrubber = document.getElementById('sprite-animation-scrubber');
  if (scrubber) { scrubber.max = String(total); scrubber.value = String(Math.max(0, Math.min(total, current))); scrubber.disabled = total <= 0; }
  const time = document.getElementById('sprite-animation-time');
  if (time) time.textContent = `${Math.round(current)} / ${total} ms${spriteAnimationEditorState.lastPreviewEvent ? ` · Event: ${spriteAnimationEditorState.lastPreviewEvent.eventName}` : ''}`;
  document.querySelectorAll('.sprite-animation-frame-card').forEach((card) => card.classList.toggle('current', Number(card.dataset.frameIndex) === index));
}
function spriteAnimationPreviewTick(timestamp) {
  const modal = document.getElementById('sprite-animation-editor-modal'); const clip = spriteAnimationEditorClip(); const state = spriteAnimationEditorState.playback;
  if (!modal.classList.contains('visible') || !clip || !state || !state.playing) { spriteAnimationEditorState.rafId = 0; return; }
  if (spriteAnimationEditorState.lastTimestamp != null) OpusAuthoringPlumbing.advanceSpriteAnimation(state, clip, Math.max(0, timestamp - spriteAnimationEditorState.lastTimestamp) / 1000, { onEvent: (context) => { spriteAnimationEditorState.lastPreviewEvent = context; } });
  spriteAnimationEditorState.lastTimestamp = timestamp; renderSpriteAnimationPreview();
  if (state.playing) spriteAnimationEditorState.rafId = requestAnimationFrame(spriteAnimationPreviewTick); else spriteAnimationEditorState.rafId = 0;
}
function playSpriteAnimationPreview() {
  const clip = spriteAnimationEditorClip(); if (!clip || !clip.frames.length) return;
  if (!spriteAnimationEditorState.playback) spriteAnimationEditorState.playback = OpusAuthoringPlumbing.createSpriteAnimationPlayback(clip.id, false);
  OpusAuthoringPlumbing.playSpriteAnimation(spriteAnimationEditorState.playback, clip, !spriteAnimationEditorState.playback.started || spriteAnimationEditorState.playback.completed, { onEvent: (context) => { spriteAnimationEditorState.lastPreviewEvent = context; } });
  spriteAnimationEditorState.lastTimestamp = null;
  if (!spriteAnimationEditorState.rafId) spriteAnimationEditorState.rafId = requestAnimationFrame(spriteAnimationPreviewTick);
  renderSpriteAnimationPreview();
}
function pauseSpriteAnimationPreview() { stopSpriteAnimationPreview(false); renderSpriteAnimationPreview(); }
function addSpriteAnimationFrame(spriteAssetId, insertAt) {
  const clip = spriteAnimationEditorClip(); if (!clip) return;
  if(spriteAssetId&&!findSpriteAssetById(spriteAssetId)){showStatus('Sprite Asset is unavailable; frame unchanged.');return;}
  const frame = { spriteAsset: spriteAssetId || null, durationMs: OpusAuthoringPlumbing.DEFAULT_SPRITE_FRAME_DURATION_MS, events: [] };
  const index = Number.isInteger(insertAt) ? Math.max(0, Math.min(clip.frames.length, insertAt)) : clip.frames.length;
  if(!createAssetContentEditGuard(clip,()=>spriteAnimationClips).beforeChange())return;
  clip.frames.splice(index, 0, frame); spriteAnimationEditorState.selectedFrameIndex = index; resetSpriteAnimationPreview(); renderSpriteAnimationLibrary(); renderSpriteAnimationEditor();
}
function reorderSpriteAnimationFrame(fromIndex, toIndex) {
  const clip = spriteAnimationEditorClip();
  if (!clip || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= clip.frames.length || toIndex >= clip.frames.length) return;
  if(!createAssetContentEditGuard(clip,()=>spriteAnimationClips).beforeChange())return;
  const [frame] = clip.frames.splice(fromIndex, 1); clip.frames.splice(toIndex, 0, frame); spriteAnimationEditorState.selectedFrameIndex = toIndex;
  resetSpriteAnimationPreview(); renderSpriteAnimationLibrary(); renderSpriteAnimationEditor();
}
function renderSpriteAnimationEditor() {
  const modal = document.getElementById('sprite-animation-editor-modal'); if (!modal || !modal.classList.contains('visible')) return;
  const clip = spriteAnimationEditorClip(); if (!clip) { closeSpriteAnimationEditor(); return; }
  if (!spriteAnimationEditorState.playback || spriteAnimationEditorState.playback.clipId !== clip.id) spriteAnimationEditorState.playback = OpusAuthoringPlumbing.createSpriteAnimationPlayback(clip.id, false);
  spriteAnimationEditorState.selectedFrameIndex = Math.max(0, Math.min(Math.max(0, clip.frames.length - 1), spriteAnimationEditorState.selectedFrameIndex));
  const selectedIndex = spriteAnimationEditorState.selectedFrameIndex; const selected = clip.frames[selectedIndex];
  const name = document.getElementById('sprite-animation-editor-name'); name.value = clip.name;
  bindAssetNameInput(name,clip,()=>spriteAnimationClips,renderSpriteAnimationLibrary);
  document.getElementById('sprite-animation-playback-mode').value = clip.playbackMode;
  const modeGuard=createAssetContentEditGuard(clip,()=>spriteAnimationClips);
  document.getElementById('sprite-animation-playback-mode').onchange=event=>{
    const value=event.target.value;if(value!== 'loop'&&value!=='once'){showStatus('Unsupported playback mode; unchanged.');renderSpriteAnimationEditor();return;}
    if(value===clip.playbackMode)return;
    if(!modeGuard.beforeChange()){event.target.value=clip.playbackMode;return;}
    clip.playbackMode=value;modeGuard.updated();resetSpriteAnimationPreview();renderSpriteAnimationLibrary();renderSpriteAnimationEditor();
  };
  const total = OpusAuthoringPlumbing.spriteAnimationTotalDuration(clip);
  document.getElementById('sprite-animation-editor-summary').textContent = `Frames: ${clip.frames.length} · Duration: ${total} ms / ${(total / 1000).toFixed(2)} s`;
  const strip = document.getElementById('sprite-animation-frame-strip');
  strip.innerHTML = clip.frames.length ? clip.frames.map((frame, index) => {
    const asset = findSpriteAssetById(frame.spriteAsset); const broken = !asset;
    const eventNames = (frame.events || []).map((event) => event.name).join(', ');
    return `<button type="button" draggable="true" class="sprite-animation-frame-card${index === selectedIndex ? ' selected' : ''}${broken ? ' broken' : ''}" data-frame-index="${index}" title="${escapeHtml(eventNames || 'No Animation Events')}" aria-label="Frame ${index + 1}, ${frame.durationMs} milliseconds${eventNames ? `, events ${escapeHtml(eventNames)}` : ''}${broken ? ', missing Sprite Asset' : ''}"><span class="sprite-animation-frame-number">Frame ${index + 1}${eventNames ? ` <span class="sprite-animation-event-badge">◆ ${(frame.events || []).length}</span>` : ''}</span>${asset ? spriteRegionPreviewHtml(asset, sourceTextureForSpriteAsset(asset), 78) : '<span class="sprite-animation-preview-missing">Missing</span>'}<span class="sprite-animation-frame-meta">${escapeHtml(asset && asset.name || frame.spriteAsset || 'Choose Sprite')}<br>${escapeHtml(frame.durationMs)} ms</span></button>`;
  }).join('') : '<div class="sprite-animation-empty"><strong>Add Sprite frames to begin.</strong><span>Click + Add Frame or drag Sprite Assets here.</span></div>';
  strip.querySelectorAll('.sprite-animation-frame-card').forEach((card) => {
    const index = Number(card.dataset.frameIndex);
    card.onclick = () => { pauseSpriteAnimationPreview(); spriteAnimationEditorState.selectedFrameIndex = index; const range = OpusAuthoringPlumbing.spriteAnimationFrameRanges(clip)[index]; OpusAuthoringPlumbing.seekSpriteAnimation(spriteAnimationEditorState.playback, clip, range && range.startMs || 0); renderSpriteAnimationEditor(); };
    card.ondragstart = (event) => { spriteAnimationEditorState.draggedFrameIndex = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/x-opus-frame-index', String(index)); };
    card.ondragover = (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; };
    card.ondrop = (event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/x-opus-frame-index')); if (Number.isInteger(from)) reorderSpriteAnimationFrame(from, index); };
  });
  strip.ondragover = (event) => { event.preventDefault(); strip.classList.add('drag-target'); };
  strip.ondragleave = () => strip.classList.remove('drag-target');
  strip.ondrop = (event) => { event.preventDefault(); strip.classList.remove('drag-target'); const assetId = event.dataTransfer.getData('application/x-opus-sprite-asset'); if (assetId) addSpriteAnimationFrame(assetId); };
  const details = document.getElementById('sprite-animation-frame-details');
  details.innerHTML = selected ? `<div class="sprite-animation-frame-details"><label>Sprite Asset<select data-sprite-animation-detail-sprite><option value="">Select Sprite Asset…</option>${spriteAssets.map((asset) => `<option value="${asset.id}"${selected.spriteAsset === asset.id ? ' selected' : ''}>${escapeHtml(asset.name)}</option>`).join('')}</select></label><label>Duration (ms)<input data-sprite-animation-detail-duration type="number" min="1" max="${OpusAuthoringPlumbing.MAX_SPRITE_FRAME_DURATION_MS}" step="1" value="${escapeHtml(selected.durationMs)}"></label></div><div class="sprite-animation-event-editor"><strong>Events on Frame ${selectedIndex + 1}</strong>${(selected.events || []).length ? (selected.events || []).map((event) => `<div class="sprite-animation-event-row"><input data-sprite-animation-event-name="${escapeHtml(event.id)}" value="${escapeHtml(event.name)}" aria-label="Animation Event name"><button data-sprite-animation-event-remove="${escapeHtml(event.id)}" title="Remove Animation Event">✕</button></div>`).join('') : '<p class="field-help">No events on this frame.</p>'}<button data-sprite-animation-event-add>+ Add Event</button></div><div class="sprite-animation-frame-actions"><button data-sprite-animation-move-left${selectedIndex === 0 ? ' disabled' : ''}>← Move Left</button><button data-sprite-animation-move-right${selectedIndex >= clip.frames.length - 1 ? ' disabled' : ''}>Move Right →</button><button data-sprite-animation-duplicate-frame>Duplicate Frame</button><button data-sprite-animation-remove-frame>Remove Frame</button></div>` : '<div class="onboarding-empty">Select or add a frame to edit its Sprite Asset, duration, and events.</div>';
  if (selected) {
    const frameGuard=createAssetContentEditGuard(clip,()=>spriteAnimationClips);
    details.querySelector('[data-sprite-animation-detail-sprite]').onchange = (event) => { const value=event.target.value||null;if(value===selected.spriteAsset)return;if(value&&!findSpriteAssetById(value)){showStatus('Sprite Asset is unavailable; frame unchanged.');renderSpriteAnimationEditor();return;}if(!frameGuard.beforeChange()){renderSpriteAnimationEditor();return;}selected.spriteAsset=value;frameGuard.updated();resetSpriteAnimationPreview();renderSpriteAnimationLibrary();renderSpriteAnimationEditor(); };
    const durationGuard=createAssetContentEditGuard(clip,()=>spriteAnimationClips);
    details.querySelector('[data-sprite-animation-detail-duration]').onchange = (event) => {
      const value=Number(event.target.value);if(!Number.isInteger(value)||value<1||value>OpusAuthoringPlumbing.MAX_SPRITE_FRAME_DURATION_MS){showStatus('Use a valid bounded frame duration; unchanged.');renderSpriteAnimationEditor();return;}
      if(value===selected.durationMs)return;
      if(!durationGuard.allowed()||!durationGuard.beforeChange()){renderSpriteAnimationEditor();return;}
      selected.durationMs=value;durationGuard.updated();resetSpriteAnimationPreview();renderSpriteAnimationLibrary();renderSpriteAnimationEditor();
    };
    details.querySelector('[data-sprite-animation-move-left]').onclick = () => reorderSpriteAnimationFrame(selectedIndex, selectedIndex - 1);
    details.querySelector('[data-sprite-animation-move-right]').onclick = () => reorderSpriteAnimationFrame(selectedIndex, selectedIndex + 1);
    details.querySelector('[data-sprite-animation-duplicate-frame]').onclick = () => { if(!frameGuard.allowed())return;const copy=OpusAuthoringPlumbing.duplicateSpriteAnimationFrame(clip, selected);if(!frameGuard.beforeChange())return;clip.frames.splice(selectedIndex + 1, 0, copy);frameGuard.updated();spriteAnimationEditorState.selectedFrameIndex = selectedIndex + 1; resetSpriteAnimationPreview(); renderSpriteAnimationLibrary(); renderSpriteAnimationEditor(); };
    details.querySelector('[data-sprite-animation-remove-frame]').onclick = () => { if(!frameGuard.beforeChange())return;clip.frames.splice(selectedIndex, 1);frameGuard.updated();spriteAnimationEditorState.selectedFrameIndex = Math.max(0, selectedIndex - 1); resetSpriteAnimationPreview(); renderSpriteAnimationLibrary(); renderSpriteAnimationEditor(); };
    details.querySelector('[data-sprite-animation-event-add]').onclick = () => { if(!frameGuard.allowed())return;const event=OpusAuthoringPlumbing.createSpriteAnimationEvent(clip,{name:'Animation Event'});if(!frameGuard.beforeChange())return;selected.events=selected.events||[];selected.events.push(event);frameGuard.updated();renderSpriteAnimationLibrary();renderSpriteAnimationEditor(); };
    details.querySelectorAll('[data-sprite-animation-event-name]').forEach(input=>bindSpriteAnimationEventName(input,clip,selected,()=>{renderSpriteAnimationLibrary();renderSpriteAnimationEditor();}));
    details.querySelectorAll('[data-sprite-animation-event-remove]').forEach((button) => { button.onclick = () => { if(!frameGuard.allowed())return;const event = (selected.events || []).find((entry) => entry.id === button.dataset.spriteAnimationEventRemove);if(!event)return;const uses = countSpriteAnimationEventListenerUses(clip.id, button.dataset.spriteAnimationEventRemove); if (uses && !confirm(`"${event.name}" has ${uses} listener${uses === 1 ? '' : 's'}. Remove it and leave repairable references?`)) return;if(!frameGuard.beforeChange())return;selected.events = (selected.events || []).filter((entry) => entry.id !== button.dataset.spriteAnimationEventRemove);frameGuard.updated();renderSpriteAnimationLibrary();renderSpriteAnimationEditor(); }; });
  }
  const tray = document.getElementById('sprite-animation-asset-tray');
  tray.innerHTML = spriteAssets.length ? spriteAssets.map((asset) => `<button type="button" draggable="true" class="sprite-animation-asset-choice" data-animation-asset-id="${asset.id}" title="Drag into the frame strip or click to add">${spriteRegionPreviewHtml(asset, sourceTextureForSpriteAsset(asset), 54)}<span>${escapeHtml(asset.name)}</span></button>`).join('') : '<span class="onboarding-empty">Import or create Sprite Assets first.</span>';
  tray.querySelectorAll('[data-animation-asset-id]').forEach((button) => { button.onclick = () => addSpriteAnimationFrame(button.dataset.animationAssetId); button.ondragstart = (event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-opus-sprite-asset', button.dataset.animationAssetId); }; });
  renderSpriteAnimationPreview();
}
function openSpriteAnimationEditor(clipId) {
  const clip = findSpriteAnimationById(clipId); if (!clip) return;
  stopSpriteAnimationPreview(true); spriteAnimationEditorState.clipId = clip.id; spriteAnimationEditorState.selectedFrameIndex = 0; spriteAnimationEditorState.playback = OpusAuthoringPlumbing.createSpriteAnimationPlayback(clip.id, false);
  document.getElementById('sprite-animation-editor-modal').classList.add('visible'); renderSpriteAnimationEditor();
}
function closeSpriteAnimationEditor() { stopSpriteAnimationPreview(false); document.getElementById('sprite-animation-editor-modal').classList.remove('visible'); spriteAnimationEditorState.clipId = null; }
document.getElementById('sprite-animation-editor-close').onclick = closeSpriteAnimationEditor;
document.getElementById('sprite-animation-preview-play').onclick = playSpriteAnimationPreview;
document.getElementById('sprite-animation-preview-pause').onclick = pauseSpriteAnimationPreview;
document.getElementById('sprite-animation-preview-stop').onclick = () => resetSpriteAnimationPreview();
document.getElementById('sprite-animation-add-frame').onclick = () => addSpriteAnimationFrame((findSpriteAssetById(selectedSpriteAssetId) || spriteAssets[0] || {}).id || null);
document.getElementById('sprite-animation-scrubber').oninput = (event) => { const clip = spriteAnimationEditorClip(); if (!clip) return; const requestedMs = Number(event.target.value); pauseSpriteAnimationPreview(); OpusAuthoringPlumbing.seekSpriteAnimation(spriteAnimationEditorState.playback, clip, requestedMs); const position = OpusAuthoringPlumbing.spriteAnimationFrameAtTime(clip, requestedMs, false); spriteAnimationEditorState.selectedFrameIndex = position.frameIndex; renderSpriteAnimationEditor(); };
window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.getElementById('sprite-animation-editor-modal').classList.contains('visible')) { event.preventDefault(); closeSpriteAnimationEditor(); } });
function renderSpriteAnimationLibrary() {
  const list = document.getElementById('sprite-animation-library-list');
  if (!list) return;
  const query = document.getElementById('sprite-animation-library-search').value.trim();
  const folderEl = document.getElementById('sprite-animation-library-folder-filter');
  const folder = folderEl.value;
  populateAssetFolderFilter(folderEl, spriteAnimationClips, folder);
  const visible = spriteAnimationClips.filter((clip) => assetMatchesFilter(clip, query, folder));
  list.innerHTML = visible.length ? visible.map((clip) => `<div class="asset-row" data-sprite-animation-id="${clip.id}"><div class="sprite-asset-preview">${spriteAnimationFramePreview(clip)}<div><span class="asset-row-name">${escapeHtml(clip.name)}</span><div class="asset-row-meta">Sprite Animation Clip v${clip.version} · ${clip.frames.length} frame${clip.frames.length === 1 ? '' : 's'} · ${clip.playbackMode === 'loop' ? 'Loop' : 'Once'} · used ${computeSpriteAnimationUsageCount(clip.id)}×</div></div></div>${assetTagsRowHtml(clip,true)}<div class="asset-row-actions"><button data-select-sprite-animation="${clip.id}">Inspect</button><button data-edit-sprite-animation="${clip.id}">Edit Animation</button><button data-duplicate-sprite-animation="${clip.id}">Duplicate</button><button data-delete-sprite-animation="${clip.id}">Delete</button></div></div>`).join('') : `<p style="color:#66759a;font-size:11px;margin:2px 0">${spriteAnimationClips.length ? 'No Sprite Animation Clips match this search.' : 'No Sprite Animation Clips yet.'}</p>`;
  list.querySelectorAll('[data-select-sprite-animation]').forEach((button) => { button.onclick = () => { selectedSpriteAnimationId = button.dataset.selectSpriteAnimation; renderSpriteAnimationInspector(); }; });
  list.querySelectorAll('[data-edit-sprite-animation]').forEach((button) => { button.onclick = () => { selectedSpriteAnimationId = button.dataset.editSpriteAnimation; renderSpriteAnimationInspector(); openSpriteAnimationEditor(selectedSpriteAnimationId); }; });
  list.querySelectorAll('[data-duplicate-sprite-animation]').forEach((button) => { bindIndependentAssetCopy(button,findSpriteAnimationById(button.dataset.duplicateSpriteAnimation),()=>spriteAnimationClips,OpusAuthoringPlumbing.duplicateSpriteAnimationClip,generateSpriteAnimationId,renderSpriteAnimationLibrary,id=>{selectedSpriteAnimationId=id;}); });
  list.querySelectorAll('[data-delete-sprite-animation]').forEach((button) => { button.onclick = () => { const clip = findSpriteAnimationById(button.dataset.deleteSpriteAnimation); if (!clip) return; const usage = computeSpriteAnimationUsageCount(clip.id); if (usage && !confirm(`"${clip.name}" is referenced ${usage} time${usage === 1 ? '' : 's'}. Delete it and leave repairable Sprite references?`)) return; spriteAnimationClips = spriteAnimationClips.filter((entry) => entry.id !== clip.id); if (selectedSpriteAnimationId === clip.id) selectedSpriteAnimationId = null; for (const item of placed) if (item.kind === 'sprite') { item._spriteAnimationPlayback = null; syncSpriteRenderer(item); } renderSpriteAnimationLibrary(); renderInspector(); showStatus(`Deleted Sprite Animation Clip "${clip.name}"${usage ? '; references remain for repair' : ''}`); }; });
  list.querySelectorAll('[data-asset-tagedit]').forEach((input) => { bindAssetMetadataInput(input,findSpriteAnimationById(input.dataset.assetTagedit),()=>spriteAnimationClips,renderSpriteAnimationLibrary); });
  list.querySelectorAll('[data-create-asset-variant]').forEach(button=>bindIndependentAssetCopy(button,findSpriteAnimationById(button.dataset.createAssetVariant),()=>spriteAnimationClips,OpusAuthoringPlumbing.duplicateSpriteAnimationClip,generateSpriteAnimationId,renderSpriteAnimationLibrary,id=>{selectedSpriteAnimationId=id;},'Variant'));
  renderSpriteAnimationInspector();
}
document.getElementById('create-sprite-animation-btn').addEventListener('click', () => createSpriteAnimationClip());
document.getElementById('sprite-animation-library-search').addEventListener('input', renderSpriteAnimationLibrary);
document.getElementById('sprite-animation-library-folder-filter').addEventListener('change', renderSpriteAnimationLibrary);
renderSpriteAnimationLibrary();

const assetTypeFilter = document.getElementById('asset-type-filter');
assetTypeFilter.innerHTML = '<option value="">All registered types</option>' + OpusAuthoringPlumbing.assetTypes.listTypes().map((type) => `<option value="${type.id}">${escapeHtml(type.displayName)}</option>`).join('');
assetTypeFilter.onchange = () => {document.querySelectorAll('[data-asset-kind]').forEach((section) => section.classList.toggle('asset-kind-hidden', !!assetTypeFilter.value && section.dataset.assetKind !== assetTypeFilter.value));renderUnifiedAssetLibrary();};

// --- Audio Asset Library (Wave 3) ---
// Same shape as the Texture Asset Library (id/name/usage-count/decode-then-
// use), same async-decode-bridged-with-pending-callbacks reasoning -- see
// that block's comment. Decoding here goes through the browser's OWN native
// audio decoder (AudioEngine.decodeAudio -> AudioContext.decodeAudioData),
// so whatever formats the browser itself supports (mp3/wav/ogg/...) just
// work, with no bundled codec and no format allowlist to maintain -- the
// "browser-native decode" investigation this section exists to prove out.
let audioAssets = [];
let nextAudioId = 1;
function generateAudioId() { return `audio${nextAudioId++}`; }
function reconcileAudioIdCounter(id) {
  const match = /^audio(\d+)$/.exec(id);
  if (match) nextAudioId = Math.max(nextAudioId, Number(match[1]) + 1);
}
function findAudioAssetById(id) { return id ? audioAssets.find((a) => a.id === id) : undefined; }
function dataURLToArrayBuffer(dataURL) {
  const base64 = dataURL.slice(dataURL.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function computeAudioUsageCount(audioId) {
  syncCurrentLevelObjects();
  let count = 0;
  for (const level of levels) {
    if (level.ambientAudio && level.ambientAudio.audioAssetId === audioId) count++;
    for (const record of level.objects) {
      if (record.kind === 'cube') {
        for (const b of record.behaviors || []) {
          if (b.action === 'sound' && b.params && b.params.audioAssetId === audioId) count++;
        }
      }
    }
  }
  return count;
}
function serializeAudioAssets(usedIds) {
  const used = usedIds || collectProjectDependencies().audioAssets;
  return audioAssets.filter((a) => used.has(a.id)).map((a) => copyPortableAssetExtras(a,{ id: a.id, name: a.name, dataURL: a.dataURL, sourceFilename: a.sourceFilename, folder: a.folder || undefined, tags: (a.tags && a.tags.length) ? a.tags.slice() : undefined }));
}
function loadAudioAssets(bundledAudio, reusableAudio = []) {
  if (!Array.isArray(bundledAudio)) return;
  for (const a of bundledAudio) {
    if (findAudioAssetById(a.id)) continue;
    reconcileAudioIdCounter(a.id);
    const asset = copyPortableAssetExtras(a,{ id: a.id, name: a.name, dataURL: a.dataURL, sourceFilename: a.sourceFilename, audioBuffer: null, pendingCallbacks: [], folder: a.folder || '', tags: a.tags ? a.tags.slice() : [] });
    audioAssets.push(asset);
    const matches=reusableAudio.filter(old=>old.id===a.id);
    if(matches.length===1&&matches[0].dataURL===a.dataURL&&matches[0].audioBuffer){asset.audioBuffer=matches[0].audioBuffer;continue;}
    app.audio.decodeAudio(dataURLToArrayBuffer(a.dataURL)).then((buf) => {
      if(findAudioAssetById(asset.id)!==asset){asset.pendingCallbacks=[];return;}
      asset.audioBuffer = buf;
      const callbacks = asset.pendingCallbacks || [];
      asset.pendingCallbacks = [];
      callbacks.forEach((cb) => cb());
      renderAudioLibrary();
    }).catch(() => {if(findAudioAssetById(asset.id)!==asset){asset.pendingCallbacks=[];return;}showStatus(`Audio "${asset.name}" failed to decode`);});
  }
  renderAudioLibrary();
}

function renderAudioLibrary() {
  const listEl = document.getElementById('audio-library-list');
  if (!listEl) return;
  const searchEl = document.getElementById('audio-library-search');
  const folderEl = document.getElementById('audio-library-folder-filter');
  const query = searchEl ? searchEl.value.trim() : '';
  const folder = folderEl ? folderEl.value : '';
  if (folderEl) populateAssetFolderFilter(folderEl, audioAssets, folder);
  if (audioAssets.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No audio imported yet.</p>';
    return;
  }
  const visible = audioAssets.filter((a) => assetMatchesFilter(a, query, folder));
  if (visible.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No audio matches this search.</p>';
    return;
  }
  listEl.innerHTML = visible.map((a) => {
    const usage = computeAudioUsageCount(a.id);
    const status = a.audioBuffer ? `${a.audioBuffer.duration.toFixed(1)}s` : 'decoding…';
    return `
    <div class="asset-row" data-audio-id="${a.id}">
      <div class="asset-row-header">
        <span class="asset-row-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</span>
      </div>
      <div class="asset-row-meta">${escapeHtml(OpusAuthoringPlumbing.assetTypes.get('audio').displayName)} · ${status} · used ${usage}×</div>
      ${assetTagsRowHtml(a,true)}
      <div class="asset-row-actions">
        <button data-preview-audio="${a.id}">▶ Preview</button>
        <button data-rename-audio="${a.id}">Rename</button>
        <button data-delete-audio="${a.id}">Delete</button>
      </div>
    </div>`;
  }).join('');
  listEl.querySelectorAll('[data-create-asset-variant]').forEach(button=>bindAudioAssetVariant(button,findAudioAssetById(button.dataset.createAssetVariant)));
  listEl.querySelectorAll('[data-preview-audio]').forEach((btn) => {
    btn.onclick = () => {
      const asset = findAudioAssetById(btn.dataset.previewAudio);
      if (asset && asset.audioBuffer) app.audio.playBuffer(asset.audioBuffer, { volume: 0.7 });
    };
  });
  listEl.querySelectorAll('[data-rename-audio]').forEach((btn) => {
    btn.onclick = () => {
      const asset = findAudioAssetById(btn.dataset.renameAudio);
      if (!asset) return;
      const name = prompt('Audio name:', asset.name);
      if (name && name.trim()) { asset.name = name.trim(); renderAudioLibrary(); renderInspector(); }
    };
  });
  listEl.querySelectorAll('[data-delete-audio]').forEach((btn) => {
    btn.onclick = () => {
      const asset = findAudioAssetById(btn.dataset.deleteAudio);
      if (!asset) return;
      const usage = computeAudioUsageCount(asset.id);
      if (usage > 0) { showStatus(`Can't delete "${asset.name}" -- still used by ${usage} place${usage === 1 ? '' : 's'}`); return; }
      audioAssets = audioAssets.filter((a) => a.id !== asset.id);
      renderAudioLibrary();
      showStatus(`Deleted audio "${asset.name}"`);
    };
  });
  listEl.querySelectorAll('[data-asset-tagedit]').forEach((input) => {
    bindAssetMetadataInput(input,findAudioAssetById(input.dataset.assetTagedit),()=>audioAssets,renderAudioLibrary);
  });
}
renderAudioLibrary();
document.getElementById('audio-library-search').addEventListener('input', renderAudioLibrary);
document.getElementById('audio-library-folder-filter').addEventListener('change', renderAudioLibrary);
unifiedAssetLibraryReady=true;
assetTypeFilter.insertAdjacentHTML('beforeend','<option value="material">Material looks</option>');
document.getElementById('asset-discovery-search').addEventListener('input',refreshAssetDiscovery);
document.getElementById('asset-discovery-folder').addEventListener('change',refreshAssetDiscovery);
document.getElementById('asset-discovery-clear').onclick=()=>{document.getElementById('asset-discovery-search').value='';document.getElementById('asset-discovery-folder').value='';assetTypeFilter.value='';document.querySelectorAll('#left-tab-assets .asset-filter-row input').forEach(input=>input.value='');document.querySelectorAll('#left-tab-assets .asset-filter-row select').forEach(select=>select.value='');assetTypeFilter.onchange();refreshAssetDiscovery();};
document.getElementById('asset-discovery-templates').onclick=()=>{document.querySelector('[data-right-tab="level"]').click();const body=document.querySelector('[data-section-body="sequences"]');if(body&&getComputedStyle(body).display==='none')document.querySelector('[data-section="sequences"]').click();const library=document.getElementById('cinematic-template-library');if(library){library.open=true;library.scrollIntoView({block:'nearest'});}};
renderUnifiedAssetLibrary();

