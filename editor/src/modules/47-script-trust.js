// --- Custom Script trust gate (AUDIT.md finding #1) ---
// Defaults to trusted for the live authoring session -- building and
// testing your own project should just work, no friction. Re-gates to
// untrusted whenever a project is loaded from OUTSIDE the current
// session (localStorage or a file) and that project actually contains a
// Custom Script behavior. Node Graph is deliberately not gated: its nodes
// are a fixed, safe vocabulary (message/counter/win/...), not arbitrary
// code -- there's nothing in it to distrust.
let scriptsTrusted = true;
let scriptTrustRevoked = false;
let scriptTrustSeen = false;
let pendingScriptTrustReview = null;
const scriptTrustBanner = document.getElementById('script-trust-banner');

function projectHasScripts(data) {
  // Read-only, bounded inspection of the complete authored document, including
  // unplaced Prefabs, other levels and nested Graph/Sequence/library actions.
  // The execution owner accepts modern params.code as well as legacy param;
  // limiting this check to legacy Cube behaviors silently approved Sprite code.
  // Unknown/overlarge structured payloads fail closed, not implicitly trusted.
  const pending = [data], seen = new WeakSet(); let records = 0, fields = 0;
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (++records > 100000) return true;
    if ([value.action, value.type, value.actionType].some(type => type === 'script' || typeof type === 'string' && type.startsWith('custom_'))) return true;
    if (value.script && typeof value.script.code === 'string' && value.script.code.trim()) return true; // Script component
    for (const key of Object.keys(value)) {
      if (++fields > 1000000) return true;
      const child = value[key];
      if (child && typeof child === 'object') {
        if (pending.length >= 100000) return true;
        pending.push(child);
      }
    }
  }
  return false;
}

// Additive only: a bundled prefab whose name already exists locally is
// left alone (the local copy is treated as canonical), so importing
// someone else's project can never silently overwrite your own prefab of
// the same name.
function mergeBundledPrefabs(bundled) {
  if (!Array.isArray(bundled) || bundled.length === 0) return 0;
  let added = 0;
  for (const p of bundled) {
    if (!p || !p.name || !p.record) continue;
    if (prefabs.some((existing) => existing.name === p.name)) continue;
    // Multi-object prefabs (Prefabs 2.0) carry `records`/`rootId` alongside
    // `record` -- omitting them here silently downgraded EVERY multi-piece
    // prefab (a Spawner's own enemy assembly, a Save-as-Prefab'd Door/
    // Turret) to single-object-only the moment a player loaded a project
    // for the first time (or with a differently-shaped local copy already
    // merged), since a Spawner/Spawn Prefab action reads this SAME shared
    // `prefabs` array and only spawns the root when `records` is absent.
    // Found live during Wave 5's performance sweep: a fresh, empty-
    // localStorage load of a real shipped multi-level game (`Sentry`, a
    // tagged root + one parented child) merged in as `{name, record}` only
    // -- every Spawner-produced enemy from then on had zero children.
    // Preserve the complete portable definition, including configured
    // parameters and recoverable metadata. A whitelist silently dropped
    // creator settings on Save/reopen and fresh exported library loads.
    // Own the payload rather than aliasing the caller's imported project.
    const entry = JSON.parse(JSON.stringify(p));
    prefabs.push(entry);
    added++;
  }
  if (added > 0) { savePrefabs(); renderPrefabPalette(); }
  return added;
}

function loadProjectData(data, sourceLabel, bundledPrefabs, scriptSource = [data, bundledPrefabs]) {
  validateImportedSceneRecords(data, 'Scene');
  validateImportedPrefabs(bundledPrefabs);
  // A new document never inherits page-session approval, even if its own file
  // has no scripts. The retained local Prefab library may still contain code
  // from an earlier document; preserve that data without carrying permission.
  scriptsTrusted = false;
  scriptTrustRevoked = true;
  scriptTrustSeen = projectHasScripts(scriptSource) || projectHasScripts({ prefabs });
  loadScene(data);
  const addedPrefabCount = mergeBundledPrefabs(bundledPrefabs);
  if (typeof renderScriptTrustControls === 'function') renderScriptTrustControls();
  showStatus(`${sourceLabel} loaded${addedPrefabCount ? ` (+${addedPrefabCount} prefab${addedPrefabCount === 1 ? '' : 's'})` : ''}`);
}

function renderScriptTrustControls() {
  // Ordinary no-code documents need no warning banner; the Project permission
  // entry remains available if their creator later authors advanced code.
  scriptTrustBanner.classList.toggle('visible', scriptTrustSeen);
  document.getElementById('script-trust-state').textContent = scriptsTrusted ? 'Custom Script permission is ENABLED for this page session.' : 'Custom Script is DISABLED. No script permission granted.';
  document.getElementById('script-trust-revoke-btn').disabled = !scriptsTrusted;
  const embedded = typeof window !== 'undefined' && !!window.__OPUS_EMBEDDED_PROJECT__;
  const editing = document.getElementById('app')?.classList?.contains('editor-hidden') === false;
  document.getElementById('script-trust-runtime-access').hidden = !embedded || !scriptTrustSeen || editing;
  document.getElementById('script-trust-launch-state').textContent = scriptsTrusted ? 'Permission enabled for this page session. Start explicitly when ready.' : 'No script permission granted. Starting without permission keeps code disabled.';
  document.getElementById('script-trust-launch-play').textContent = scriptsTrusted ? 'Start game with scripts enabled' : 'Play with scripts disabled';
  document.getElementById('script-trust-launch-edit').hidden = !embedded || !!window.__OPUS_PLAYABLE_ONLY__;
}
function showStandaloneScriptChoice() {
  if (playMode) return false;
  document.getElementById('script-trust-launch-gate').hidden = false;
  renderScriptTrustControls(); document.getElementById('script-trust-launch-play').focus(); return true;
}
function startStandaloneWithScriptChoice() {
  if (playMode) return false;
  // A Start choice is not an approval. An untrusted project remains untrusted;
  // only the independently reviewed/confirmed permission path can enable code.
  document.getElementById('script-trust-launch-gate').hidden = true;
  window.__gameState = {}; enterPlayMode(); return true;
}
function readCustomScriptReview(data) {
  const pending = [{ value: data, path: 'Project' }], seen = new WeakSet(), entries = []; let records = 0, fields = 0, chars = 0, limited = false;
  while (pending.length) {
    const { value, path } = pending.pop(); if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value); if (++records > 100000 || path.length > 4096) { limited = true; break; }
    if ([value.action, value.type, value.actionType].some(type => type === 'script' || typeof type === 'string' && type.startsWith('custom_'))) {
      const custom = [value.action, value.type, value.actionType].find(type => typeof type === 'string' && type.startsWith('custom_'));
      const code = custom ? 'Host custom Action reference: ' + custom + '. Implementation is installed separately; missing extensions do not run. Copying without its host field schema preserves parameter bytes: verify Object references before enabling.' : value.params?.code ?? value.param ?? value.code ?? '(empty or indirect script source)';
      const text = typeof code === 'string' ? code : JSON.stringify(code);
      if (entries.length >= 64 || chars + text.length > 512 * 1024) { limited = true; break; }
      entries.push(path + '\n' + text); chars += text.length;
    }
    if (value.script && typeof value.script.code === 'string' && value.script.code.trim()) {
      const text = value.script.code;
      if (entries.length >= 64 || chars + text.length > 512 * 1024) { limited = true; break; }
      entries.push(path + '.script (Script component' + (value.name ? ' on ' + value.name : '') + ')\n' + text); chars += text.length;
    }
    for (const key of Object.keys(value)) {
      if (++fields > 1000000) { limited = true; break; }
      const child = value[key]; if (child && typeof child === 'object') { if (pending.length >= 100000) { limited = true; break; } pending.push({ value: child, path: path + (Array.isArray(value) ? '[' + key + ']' : '.' + key) }); }
    }
    if (limited) break;
  }
  if (typeof customActionReviewSources === 'function') for (const text of customActionReviewSources()) {
    if (entries.length >= 64 || chars + text.length > 512 * 1024) { limited = true; break; }
    entries.push(text); chars += text.length;
  }
  return { entries, limited };
}
function closeScriptTrustReview() {
  pendingScriptTrustReview = null;
  document.getElementById('script-trust-dialog').close();
}
function openScriptTrustReview() {
  try {
    if (playMode) throw new Error('Stop Play before reviewing or changing script permission.');
    const project = serializeProject(), review = readCustomScriptReview(project);
    pendingScriptTrustReview = { lease: captureTilemapBundleLease(), signature: JSON.stringify(project), identity: JSON.stringify([projectMeta, playerPreferenceScope]), limited: review.limited };
    scriptTrustSeen = scriptTrustSeen || review.entries.length > 0 || review.limited;
    document.getElementById('script-trust-code').textContent = review.entries.join('\n\n────────\n\n') || 'No Custom Script source markers found in this current project.';
    document.getElementById('script-trust-review-summary').textContent = review.limited ? 'Review limit reached (64 sources / 512 KiB code / bounded structured data). Permission cannot be granted from an incomplete review; use a smaller project.' : review.entries.length + ' potential script source(s). Review is read-only; no code is executed.';
    document.getElementById('script-trust-agree').checked = false;
    document.getElementById('script-trust-confirm').disabled = true;
    document.getElementById('script-trust-review-status').textContent = '';
    renderScriptTrustControls(); document.getElementById('script-trust-dialog').showModal();
  } catch (error) { showStatus(error.message); }
}
function assertScriptTrustReview(review) {
  if (playMode) throw new Error('Stop Play before changing script permission.');
  if (!review || review !== pendingScriptTrustReview || review.limited) throw new Error('Prepare a complete current script review first.');
  assertTilemapBundleLease(review.lease);
  if (review.identity !== JSON.stringify([projectMeta, playerPreferenceScope]) || review.signature !== JSON.stringify(serializeProject())) throw new Error('Project changed; close and prepare a fresh script review.');
}
function grantReviewedScriptTrust() {
  try {
    const review = pendingScriptTrustReview; assertScriptTrustReview(review);
    if (!document.getElementById('script-trust-agree').checked) throw new Error('Review the code and accept its full page privileges first.');
    if (!confirm('Enable UNSANDBOXED Custom Script for this current document session? It can access this page, browser storage and network APIs. Only continue if you trust all reviewed code.')) return false;
    assertScriptTrustReview(review);
    scriptTrustRevoked = false; scriptsTrusted = true; closeScriptTrustReview(); renderScriptTrustControls();
    showStatus('Custom Script enabled for this document session. No code executed by approval; Play or Restart explicitly.'); return true;
  } catch (error) { document.getElementById('script-trust-review-status').textContent = error.message; return false; }
}
function revokeScriptTrust() {
  if (playMode) { showStatus('Stop Play before changing script permission.'); return false; }
  scriptTrustRevoked = true; scriptsTrusted = false;
  closeScriptTrustReview(); renderScriptTrustControls(); showStatus('Custom Script permission revoked. Earlier code effects cannot be undone; Undo cannot restore permission.'); return true;
}
document.getElementById('script-trust-enable-btn').addEventListener('click', openScriptTrustReview);
document.getElementById('script-trust-project-btn').addEventListener('click', openScriptTrustReview);
document.getElementById('script-trust-revoke-btn').addEventListener('click', revokeScriptTrust);
document.getElementById('script-trust-review-revoke').addEventListener('click', revokeScriptTrust);
document.getElementById('script-trust-confirm').addEventListener('click', grantReviewedScriptTrust);
document.getElementById('script-trust-close').addEventListener('click', closeScriptTrustReview);
document.getElementById('script-trust-agree').addEventListener('change', () => { document.getElementById('script-trust-confirm').disabled = !document.getElementById('script-trust-agree').checked || !pendingScriptTrustReview || pendingScriptTrustReview.limited; });
document.getElementById('script-trust-dialog').addEventListener('cancel', () => { pendingScriptTrustReview = null; });
document.getElementById('script-trust-dialog').addEventListener('keydown', event => event.stopPropagation());
document.getElementById('script-trust-launch-review').addEventListener('click', openScriptTrustReview);
document.getElementById('script-trust-launch-play').addEventListener('click', startStandaloneWithScriptChoice);
document.getElementById('script-trust-launch-edit').addEventListener('click', () => setEditorVisible(true));
document.getElementById('script-trust-runtime-access').addEventListener('click', () => {
  // This explicit Stop action reuses canonical authored-state restoration. The
  // permission dialog never grants access while gameplay is still running.
  if (playMode) exitPlayMode();
  showStandaloneScriptChoice(); openScriptTrustReview();
});

function openSavedProject(name,readSource=()=>app.save.load(name)) {
  if(playMode){showStatus('Stop Play before opening another project.');return false;}
  if(typeof name!=='string'||!name.trim()){showStatus('No project selected');return false;}
  try{
    const root=levels,index=currentLevelIndex,undo=undoStack.slice(),redo=redoStack.slice(),signature=JSON.stringify(captureAssetReplacementState().project),identity=JSON.stringify([typeof projectMeta==='undefined'?null:projectMeta,typeof playerPreferenceScope==='undefined'?null:playerPreferenceScope]);
    const data=readSource();if(!data){showStatus('Saved project is missing or unreadable; current document kept.');return false;}
    // Reuse the canonical loader's existing read-only preflight, never a
    // second validator or migration/storage format. Reject before confirmation.
    const normalized=normalizeProjectData(data);if(!normalized.levels.length)throw new Error('Project must contain at least one level');
    normalized.levels.forEach((level,i)=>validateImportedSceneRecords(level.objects,'Level '+(i+1)));
    validateImportedPrefabs(normalized.prefabs);validatePortableProjectAssetExtras(data);
    const savedSignature=JSON.stringify(data);
    // Always explicit: some historical authoring fields are not represented
    // by Undo length, so absence of history is not proof of a clean document.
    if(!window.confirm('Open saved project "'+name+'"?\n\nThis replaces the current document. Save unsaved work first. Named saved projects are kept.')){showStatus('Current project kept.');return false;}
    if(playMode||levels!==root||currentLevelIndex!==index||undoStack.length!==undo.length||redoStack.length!==redo.length||!undoStack.every((entry,i)=>entry===undo[i])||!redoStack.every((entry,i)=>entry===redo[i])||JSON.stringify(captureAssetReplacementState().project)!==signature||JSON.stringify([typeof projectMeta==='undefined'?null:projectMeta,typeof playerPreferenceScope==='undefined'?null:playerPreferenceScope])!==identity||JSON.stringify(readSource())!==savedSignature){showStatus('Current or saved project changed; nothing opened. Refresh and choose again.');return false;}
    loadProjectFull(data,'Project "'+name+'"');
    document.getElementById('project-name-input').value=name;
    // Read back exact envelope ownership. If unavailable/changed, keep the
    // document open but never grant overwrite authority or claim Saved.
    try {
      const openedRaw=localStorage.getItem(app.save.namespace+':'+name);
      if(openedRaw&&JSON.stringify(JSON.parse(openedRaw).data)===savedSignature){
        projectDurability={signature:projectAuthoredSignature(),slot:name,raw:openedRaw,error:null,dirtyBeforePlay:false};renderProjectDurability();
      }
    } catch(error) {
      projectDurability.error='unavailable';renderProjectDurability();
      showStatus('Project opened in memory, but local storage could not be verified. Back Up Project now; no overwrite ownership granted.');
    }
    // A confirmed named-project open is a fresh document boundary, as for the
    // existing catalog/starter loaders; old-document history must not follow it.
    undoStack.length=0;redoStack.length=0;updateUndoRedoButtons();return true;
  }catch(error){showStatus('Project could not be opened: '+(error.message||'unavailable data'));return false;}
}
// A bounded read-only view of the existing SaveSystem namespace, not a new
// persistence layer. list() deliberately swallows access errors; Home must
// distinguish unavailable storage from a genuinely empty browser instead.
function readProjectBrowserPage(storage,namespace,query,offset) {
  const names=[],prefix=namespace+':',pageSize=10,maxKeys=1000,maxSlots=200;
  try {
    const count=storage.length;
    for(let i=0;i<Math.min(count,maxKeys);i++){
      const key=storage.key(i);
      if(key&&key.startsWith(prefix)&&key.length>prefix.length){names.push(key.slice(prefix.length));if(names.length===maxSlots)break;}
    }
    const bounded=count>maxKeys||names.length===maxSlots;
    names.sort((a,b)=>a.localeCompare(b));
    const needle=String(query||'').toLocaleLowerCase(),matches=names.filter(name=>name.toLocaleLowerCase().includes(needle));
    const start=Math.min(Math.max(0,Math.floor((Number(offset)||0)/pageSize)*pageSize),Math.max(0,Math.ceil(matches.length/pageSize)-1)*pageSize);
    let budget=16*1024*1024;
    const rows=matches.slice(start,start+pageSize).map(name=>{
      const row={name,status:'unreadable',detail:'Unreadable saved data; kept unchanged.'};
      try{
        const raw=storage.getItem(prefix+name);
        if(raw===null){row.detail='Save disappeared. Refresh to update the list.';return row;}
        if(raw.length>8*1024*1024||raw.length>budget){row.detail='Too large for this bounded preview. Use the existing Project Load controls.';return row;}
        budget-=raw.length;
        const envelope=JSON.parse(raw),data=envelope&&envelope.data;
        if(!Array.isArray(data)&&!(data&&(Array.isArray(data.levels)||Array.isArray(data.objects)))){row.status='other';row.detail='Other local save (not a project). Kept unchanged.';return row;}
        const normalized=normalizeProjectData(data);
        if(!normalized.levels.length)throw new Error('Project has no levels');
        normalized.levels.forEach((level,i)=>validateImportedSceneRecords(level.objects,'Level '+(i+1)));
        validateImportedPrefabs(normalized.prefabs);validatePortableProjectAssetExtras(data);
        row.status='project';row.detail=normalized.levels.length+' level'+(normalized.levels.length===1?'':'s');
        if(Number.isFinite(envelope.savedAt)&&envelope.savedAt>0){const date=new Date(envelope.savedAt);if(Number.isFinite(date.getTime()))row.detail+=' · Saved '+date.toLocaleString();}
      }catch(error){row.detail='Cannot preview/open this project: '+(error.message||'unreadable data');}
      return row;
    });
    return{rows,total:matches.length,start,pageSize,bounded,unavailable:false};
  }catch(error){return{rows:[],total:0,start:0,pageSize,unavailable:true,bounded:false};}
}

function prepareProjectCopy(slot) {
  if(playMode)throw new Error('Stop Play before copying a project.');
  const currentSignature=JSON.stringify(captureAssetReplacementState().project);
  // Diagnostic/history snapshots are NOT portable Save documents. The one
  // canonical authoring serializer owns metadata, preference scope and aliases.
  const data=slot===null?serializeProject():app.save.load(slot);
  const signature=JSON.stringify(data);
  if(!signature||signature.length>8*1024*1024)throw new Error('Project is missing or too large for bounded copy. Use Export for a portable backup.');
  const normalized=normalizeProjectData(data);if(!normalized.levels.length)throw new Error('Project must contain a level');
  normalized.levels.forEach((level,i)=>validateImportedSceneRecords(level.objects,'Level '+(i+1)));
  validateImportedPrefabs(normalized.prefabs);validatePortableProjectAssetExtras(data);
  return{slot,signature,currentSignature,metaSignature:JSON.stringify(projectMeta),scopeSignature:JSON.stringify(playerPreferenceScope),root:levels,index:currentLevelIndex,undo:undoStack.slice(),redo:redoStack.slice()};
}
async function commitProjectCopy(draft,name) {
  if(!draft||playMode)throw new Error('Stop Play and preview a project copy first.');
  if(typeof name!=='string'||!name.trim()||name.trim().length>160)throw new Error('Enter a new saved name (1–160 characters).');
  name=name.trim();
  const check=()=>{
    if(JSON.stringify(projectMeta)!==draft.metaSignature||JSON.stringify(playerPreferenceScope)!==draft.scopeSignature)throw new Error('Project identity changed. Preview a new copy; nothing saved.');
    if(playMode||levels!==draft.root||currentLevelIndex!==draft.index||JSON.stringify(captureAssetReplacementState().project)!==draft.currentSignature||undoStack.length!==draft.undo.length||redoStack.length!==draft.redo.length||!undoStack.every((entry,i)=>entry===draft.undo[i])||!redoStack.every((entry,i)=>entry===draft.redo[i]))throw new Error('Current document changed. Preview a new copy; nothing saved.');
    if(draft.slot!==null&&JSON.stringify(app.save.load(draft.slot))!==draft.signature)throw new Error('Source save changed. Refresh and preview again.');
    // Read directly: SaveSystem.has intentionally swallows denied storage.
    if(window.localStorage.getItem(app.save.namespace+':'+name)!==null)throw new Error('That saved name already exists. Choose another; no overwrite is allowed.');
  };
  check();
  if(!window.confirm('Save independent project copy "'+name+'"?\n\nCreates a new local save. Current document, Undo history and existing saves stay unchanged.'))return false;
  check();
  let copy=JSON.parse(draft.signature);
  // Canonical legacy scene normalization wraps records, never rewrites their
  // internal IDs/references. Separate projects do not share those namespaces.
  if(Array.isArray(copy))copy={levels:normalizeProjectData(copy).levels};
  else if(!Array.isArray(copy.levels))copy={...copy,levels:normalizeProjectData(copy).levels};
  copy.meta={...(copy.meta&&typeof copy.meta==='object'&&!Array.isArray(copy.meta)?copy.meta:{}),title:name};
  copy.playerPreferenceScope=OpusPlayerRebindScreen.freshScope();
  validatePortableProjectAssetExtras(copy);
  if(draft.upgradeSource){
    if(JSON.stringify(app.save.load(draft.upgradeSlot))!==JSON.stringify(draft.upgradeSource))throw new Error('Upgrade source save changed. Review its format again.');
    assertProjectSchemaRetention(draft.upgradeSource,copy);
  }
  const result=await withProjectStorageLock(()=>{check();return app.save.saveChecked(name,copy,null);});
  if(!result.ok)throw new Error('Copy could not be saved ('+result.code+'). Current document and existing saves kept.');
  return true;
}

function inspectProjectSchema(data) {
  const declared=data&&!Array.isArray(data)&&Object.prototype.hasOwnProperty.call(data,'version');
  const result={supported:PROJECT_FORMAT_VERSION,sourceVersion:declared?(typeof data.version==='number'||typeof data.version==='string'?String(data.version).slice(0,100):'unrecognized'):'not declared',shape:Array.isArray(data)?'legacy scene array':data&&Array.isArray(data.levels)?'level project':data&&Array.isArray(data.objects)?'legacy object scene':'not a project',compatible:false};
  try{
    const signature=JSON.stringify(data);if(!signature||signature.length>8*1024*1024)throw new Error('Missing data or project exceeds bounded 8Mi-unit review. Use a portable backup.');
    if(declared&&(!Number.isInteger(data.version)||data.version<0))throw new Error('Unrecognized version metadata. No automatic conversion is offered. Keep the original backup.');
    const normalized=normalizeProjectData(data);if(!normalized.levels.length)throw new Error('Project must contain a level');
    normalized.levels.forEach((level,i)=>validateImportedSceneRecords(level.objects,'Level '+(i+1)));
    validateImportedPrefabs(normalized.prefabs);validatePortableProjectAssetExtras(data);
    result.compatible=true;result.current=!Array.isArray(data)&&data.format===PROJECT_FORMAT&&data.version===PROJECT_FORMAT_VERSION;result.levels=normalized.levels.length;result.objects=normalized.levels.reduce((sum,level)=>sum+level.objects.length,0);
    result.message=result.current?'Already in the current project format. A separate copy is optional.':'Supported by the existing loader. Review/open first; a new copy can persist the current format only if retained data survives.';
  }catch(error){result.message='Cannot safely open/upgrade: '+(error.message||'unreadable data');}
  return result;
}
function assertProjectSchemaRetention(raw,copy) {
  const before=JSON.parse(JSON.stringify(raw));
  if(Array.isArray(before)){assertAssetReplacementRetention(before,copy.levels[0].objects,'legacy scene records');return;}
  // These are the only intentional identity/schema changes in a new copy.
  delete before.version;delete before.playerPreferenceScope;if(before.meta&&typeof before.meta==='object')delete before.meta.title;
  if(!Array.isArray(before.levels)&&Array.isArray(before.objects)){
    assertAssetReplacementRetention(before.objects,copy.levels[0].objects,'legacy object scene');delete before.objects;
  }
  assertAssetReplacementRetention(before,copy,'project schema upgrade');
}

function projectSnapshotOwner(){
  if(!OpusPlayerRebindScreen.scopeKey(playerPreferenceScope))throw new Error('Project identity unavailable; Save/export a valid project before using history.');
  return playerPreferenceScope.id;
}
function readProjectSnapshotPage(storage,owner,offset) {
  const prefix='doengine:project-history:'+owner+':',slots=[];
  const count=storage.length;for(let i=0;i<Math.min(count,1000);i++){const key=storage.key(i);if(key&&key.startsWith(prefix))slots.push(key.slice('doengine:project-history:'.length));}
  slots.sort().reverse();const start=Math.min(Math.max(0,Math.floor((Number(offset)||0)/5)*5),Math.max(0,Math.ceil(slots.length/5)-1)*5);let budget=16*1024*1024;
  const rows=slots.slice(start,start+5).map(slot=>{
    try{const raw=storage.getItem('doengine:project-history:'+slot);if(!raw||raw.length>8*1024*1024||raw.length>budget)throw new Error('Missing/large record or page preview budget reached.');budget-=raw.length;const record=JSON.parse(raw).data;
      if(!record||record.kind!=='OpusProjectSnapshot'||record.version!==1||record.owner!==owner||typeof record.label!=='string'||record.label.length>100||!Number.isFinite(record.createdAt)||record.project?.playerPreferenceScope?.id!==owner||!inspectProjectSchema(record.project).compatible)throw new Error('Unsupported/corrupt snapshot. Original record kept.');
      return{slot,record,signature:JSON.stringify(record)};
    }catch(error){return{slot,error:error.message};}
  });return{rows,total:slots.length,start,bounded:count>1000};
}
function captureProjectSnapshot(label,expectedOwner=projectSnapshotOwner()) {
  if(projectSnapshotOwner()!==expectedOwner)throw new Error('Project identity changed since history opened. Reopen history before capture.');
  const draft=prepareProjectCopy(null),owner=projectSnapshotOwner(),data=JSON.parse(draft.signature),createdAt=Date.now();
  label=String(label||'Version').trim()||'Version';if(label.length>100)throw new Error('Snapshot label must be at most 100 characters.');
  const slot=owner+':'+new Date(createdAt).toISOString()+'~'+OpusPlayerRebindScreen.freshScope().id;
  const record={kind:'OpusProjectSnapshot',version:1,owner,label,createdAt,project:data};
  if(JSON.stringify({data:record,savedAt:createdAt}).length>8*1024*1024)throw new Error('Snapshot exceeds the bounded 8Mi-unit record size. Export a portable backup.');
  const check=()=>{
    if(playMode||projectSnapshotOwner()!==owner||levels!==draft.root||currentLevelIndex!==draft.index||JSON.stringify(captureAssetReplacementState().project)!==draft.currentSignature||JSON.stringify(projectMeta)!==draft.metaSignature||JSON.stringify(playerPreferenceScope)!==draft.scopeSignature||undoStack.length!==draft.undo.length||redoStack.length!==draft.redo.length||!undoStack.every((entry,i)=>entry===draft.undo[i])||!redoStack.every((entry,i)=>entry===draft.redo[i]))throw new Error('Document changed. Capture a fresh version; nothing saved.');
    const page=readProjectSnapshotPage(window.localStorage,owner,0);if(page.bounded||page.total>=50)throw new Error('History scan/50-version limit reached. No existing snapshots were removed; export a backup.');
    if(window.localStorage.getItem('doengine:project-history:'+slot)!==null)throw new Error('Snapshot identity already exists; nothing overwritten.');
  };
  check();if(!window.confirm('Capture local version "'+label+'"?\n\nCurrent document and Undo stay unchanged. This is local authoring history, not a portable backup.'))return false;check();
  const result=projectHistoryStore.saveChecked(slot,record,null);
  if(!result.ok)throw new Error('Snapshot could not be saved/verified ('+result.code+'). Existing work and versions kept. Back Up Project JSON before leaving.');
  return true;
}
const projectHistoryStore=new Opus.SaveSystem('doengine:project-history');
let projectHistoryOwnerView=null,projectHistoryOffset=0;
function renderProjectHistory(){
  const status=document.getElementById('project-history-status'),list=document.getElementById('project-history-list');list.replaceChildren();
  try{
    if(playMode||projectSnapshotOwner()!==projectHistoryOwnerView)throw new Error('Stop Play / reopen history for the current project identity.');
    const page=readProjectSnapshotPage(window.localStorage,projectHistoryOwnerView,projectHistoryOffset);projectHistoryOffset=page.start;
    status.textContent=page.total?('Showing '+(page.start+1)+'–'+(page.start+page.rows.length)+' of '+page.total+' local versions, newest first.'):'No local versions yet. Capture one explicitly; ordinary Save does not make a snapshot.';if(page.bounded)status.textContent+=' Bounded scan: first1,000 browser keys only; capture is refused while this limit is exceeded.';
    page.rows.forEach(row=>{const card=document.createElement('div');card.style.cssText='border:1px solid #334155;border-radius:6px;padding:10px';const text=document.createElement('p');text.textContent=row.error||row.record.label+' · '+new Date(row.record.createdAt).toLocaleString();card.append(text);if(!row.error){const restore=document.createElement('button');restore.className='toolbar-btn';restore.textContent='Restore in editor…';restore.setAttribute('aria-label','Restore '+row.record.label);restore.onclick=()=>restoreProjectSnapshot(row.slot,row.signature,projectHistoryOwnerView);card.append(restore);}list.append(card);});
    document.getElementById('project-history-prev').disabled=page.start===0;document.getElementById('project-history-next').disabled=page.start+5>=page.total;
  }catch(error){status.textContent='History unavailable: '+error.message;document.getElementById('project-history-prev').disabled=true;document.getElementById('project-history-next').disabled=true;}
}
function showProjectHistory(){
  if(playMode){showStatus('Stop Play before opening authoring history.');return;}
  document.getElementById('project-history-panel').hidden=false;projectHistoryOffset=0;
  try{projectHistoryOwnerView=projectSnapshotOwner();}catch(error){projectHistoryOwnerView=null;}
  renderProjectHistory();document.getElementById('project-snapshot-label').focus();
}
function restoreProjectSnapshot(slot,signature,owner){
  try{
    if(playMode||projectSnapshotOwner()!==owner)throw new Error('Stop Play / reopen history for this project before restore.');
    let restoreName=null;
    const read=()=>{if(projectSnapshotOwner()!==owner)throw new Error('Project identity changed; restore refused.');if(restoreName&&window.localStorage.getItem(app.save.namespace+':'+restoreName)!==null)throw new Error('Restored Save-name became occupied; choose restore again.');const record=projectHistoryStore.load(slot);if(!record||record.owner!==owner||record.kind!=='OpusProjectSnapshot'||record.version!==1||record.project?.playerPreferenceScope?.id!==owner||JSON.stringify(record)!==signature)throw new Error('Snapshot changed or is unreadable; current document kept.');return record.project;};
    read();let name='Restored version',n=1;while(window.localStorage.getItem(app.save.namespace+':'+name)!==null&&n<100){name='Restored version '+n++;}if(window.localStorage.getItem(app.save.namespace+':'+name)!==null)throw new Error('No unused restored Save-name found. Current document kept.');restoreName=name;
    if(openSavedProject(name,read))closeProjectHome();
  }catch(error){document.getElementById('project-history-status').textContent=error.message;}
}

const projectHome=document.getElementById('project-home');
let projectSchemaReview=null;
function reviewProjectSchema(slot){
  if(playMode){showStatus('Stop Play before reviewing project formats.');return;}
  const panel=document.getElementById('project-schema-panel');panel.hidden=false;projectSchemaReview=null;
  document.getElementById('project-schema-open').hidden=true;
  document.getElementById('project-schema-source').textContent=slot===null?'Source: current document (canonical Save format).':'Source: local saved project '+slot;
  try{
    let data;
    if(slot===null)data=serializeProject();
    else{const raw=window.localStorage.getItem(app.save.namespace+':'+slot);if(raw===null||raw.length>8*1024*1024)throw new Error('Save is missing or too large for bounded review.');data=JSON.parse(raw).data;}
    const report=inspectProjectSchema(data);
    document.getElementById('project-schema-summary').textContent='Source version: '+report.sourceVersion+' · '+report.shape+' · This editor writes version '+report.supported+'. '+report.message+(report.compatible?' '+report.levels+' levels / '+report.objects+' objects.':'');
    if(report.compatible){projectSchemaReview={slot,signature:JSON.stringify(data),currentSignature:JSON.stringify(captureAssetReplacementState().project),meta:JSON.stringify(projectMeta),scope:JSON.stringify(playerPreferenceScope),root:levels,index:currentLevelIndex,undo:undoStack.slice(),redo:redoStack.slice()};document.getElementById('project-schema-open').hidden=false;document.getElementById('project-schema-open').textContent=slot===null?'Preview a separate current-format copy…':'Open source, then preview upgraded copy…';}
  }catch(error){document.getElementById('project-schema-summary').textContent='Format review unavailable: '+error.message+'. Current document and saved data kept.';}
  document.getElementById('project-schema-close').focus();
}
function openProjectSchemaReview(){
  const review=projectSchemaReview;
  try{
    if(review&&JSON.stringify(playerPreferenceScope)!==review.scope)throw new Error('Project preference identity changed. Review again.');
    if(!review||playMode||levels!==review.root||currentLevelIndex!==review.index||JSON.stringify(captureAssetReplacementState().project)!==review.currentSignature||JSON.stringify(projectMeta)!==review.meta||undoStack.length!==review.undo.length||redoStack.length!==review.redo.length||!undoStack.every((entry,i)=>entry===review.undo[i])||!redoStack.every((entry,i)=>entry===review.redo[i]))throw new Error('Current document changed. Review again before opening.');
    if(review.slot!==null&&JSON.stringify(app.save.load(review.slot))!==review.signature)throw new Error('Saved source changed. Refresh and review again.');
    if(review.slot!==null&&!openSavedProject(review.slot))return;
    const original=review.slot===null?null:JSON.parse(review.signature);
    showProjectHome();previewProjectCopy(null,original,review.slot);
    if(projectCopyDraft&&original)document.getElementById('project-copy-status').textContent='Upgrade copy preview. Original saved source kept. Retained-field preservation will be checked before any new save.';
  }catch(error){document.getElementById('project-schema-summary').textContent=error.message;}
}
let projectCopyDraft=null;
function previewProjectCopy(slot,upgradeSource=null,upgradeSlot=null){
  try{
    projectCopyDraft=prepareProjectCopy(slot);if(upgradeSource){projectCopyDraft.upgradeSource=upgradeSource;projectCopyDraft.upgradeSlot=upgradeSlot;}document.getElementById('project-copy-panel').hidden=false;
    document.getElementById('project-copy-source').textContent=slot===null?'Source: current document, including unsaved edits.':'Template source: saved project '+slot+'. Its saved contents are kept unchanged.';
    document.getElementById('project-copy-name').value=(slot===null?document.getElementById('project-name-input').value:slot)+' copy';
    document.getElementById('project-copy-status').textContent='Preview ready. Choose an unused saved name; no save is made until confirmation.';document.getElementById('project-copy-name').focus();
  }catch(error){projectCopyDraft=null;document.getElementById('project-copy-panel').hidden=true;document.getElementById('project-home-summary').textContent='Copy unavailable: '+error.message;}
}
let projectHomeOffset=0,projectHomeFocus=null;
function closeProjectHome(){projectHome.hidden=true;projectCopyDraft=null;projectSchemaReview=null;document.getElementById('project-history-panel').hidden=true;document.getElementById('project-schema-panel').hidden=true;document.getElementById('project-copy-panel').hidden=true;if(projectHomeFocus&&projectHomeFocus.isConnected)projectHomeFocus.focus();}
function renderProjectHome(){
  const list=document.getElementById('project-home-list');list.replaceChildren();
  let page;
  try{page=readProjectBrowserPage(window.localStorage,app.save.namespace,document.getElementById('project-home-search').value,projectHomeOffset);}
  catch(error){page={rows:[],total:0,start:0,pageSize:10,unavailable:true};}
  projectHomeOffset=page.start;
  const summary=document.getElementById('project-home-summary');
  summary.textContent=page.unavailable?'Local storage is unavailable. Current work is kept; use Export for a portable backup.':page.total?('Showing '+(page.start+1)+'–'+(page.start+page.rows.length)+' of '+page.total+' saved names, alphabetically.'):(document.getElementById('project-home-search').value?'No saved names match this search.':'No local saved projects yet. Continue your document and Save it, or choose a starter.');
  if(page.bounded)summary.textContent+=' Bounded to the first 200 saves / 1,000 storage keys; use Project Load for other saved names.';
  page.rows.forEach(row=>{
    const card=document.createElement('div');card.style.cssText='border:1px solid #334155;border-radius:8px;padding:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:center';
    const text=document.createElement('div');text.style.cssText='flex:1 1 160px;min-width:0';
    const title=document.createElement('strong');title.textContent=row.name;
    const detail=document.createElement('div');detail.textContent=row.detail;detail.style.cssText='font-size:12px;color:#a9b8ce;margin-top:4px';
    text.append(title,detail);card.append(text);
    if(row.status==='project'){
      const open=document.createElement('button');open.type='button';open.className='toolbar-btn';open.textContent='Open';open.setAttribute('aria-label','Open '+row.name);
      open.addEventListener('click',()=>{if(openSavedProject(row.name))closeProjectHome();else{renderProjectHome();document.getElementById('project-home-search').focus();}});card.append(open);
      const copy=document.createElement('button');copy.type='button';copy.className='toolbar-btn';copy.textContent='Copy…';copy.setAttribute('aria-label','Copy '+row.name);copy.addEventListener('click',()=>previewProjectCopy(row.name));card.append(copy);
    }
    const format=document.createElement('button');format.type='button';format.className='toolbar-btn';format.textContent='Format…';format.setAttribute('aria-label','Review format '+row.name);format.addEventListener('click',()=>reviewProjectSchema(row.name));card.append(format);
    list.append(card);
  });
  document.getElementById('project-home-prev').disabled=page.unavailable||page.start===0;
  document.getElementById('project-home-next').disabled=page.unavailable||page.start+page.pageSize>=page.total;
}
function showProjectHome(){
  if(playMode){showStatus('Stop Play before browsing projects.');return;}
  projectHomeFocus=document.activeElement;projectHomeOffset=0;
  projectCopyDraft=null;document.getElementById('project-copy-panel').hidden=true;
  projectSchemaReview=null;document.getElementById('project-schema-panel').hidden=true;
  document.getElementById('project-history-panel').hidden=true;
  document.getElementById('project-home-starters').hidden=true;document.getElementById('project-home-create').setAttribute('aria-expanded','false');
  document.getElementById('project-home-search').value='';
  document.getElementById('project-home-current').textContent='Current document: '+(projectMeta.title||'Untitled')+'. Unsaved edits stay here until you explicitly open or create another project.';
  projectHome.hidden=false;renderProjectHome();document.getElementById('project-home-search').focus();
}
document.getElementById('project-home-btn').addEventListener('click',showProjectHome);
document.getElementById('project-home-history').addEventListener('click',showProjectHistory);
document.getElementById('project-history-close').addEventListener('click',()=>{document.getElementById('project-history-panel').hidden=true;document.getElementById('project-home-history').focus();});
document.getElementById('project-snapshot-capture').addEventListener('click',()=>{try{if(captureProjectSnapshot(document.getElementById('project-snapshot-label').value,projectHistoryOwnerView)){renderProjectHistory();document.getElementById('project-history-status').textContent+=' Snapshot captured; current document kept.';}else document.getElementById('project-history-status').textContent='Capture cancelled; nothing saved.';}catch(error){document.getElementById('project-history-status').textContent=error.message;}});
document.getElementById('project-history-prev').addEventListener('click',()=>{projectHistoryOffset-=5;renderProjectHistory();});
document.getElementById('project-history-next').addEventListener('click',()=>{projectHistoryOffset+=5;renderProjectHistory();});
document.getElementById('project-home-schema').addEventListener('click',()=>reviewProjectSchema(null));
document.getElementById('project-schema-open').addEventListener('click',openProjectSchemaReview);
document.getElementById('project-schema-close').addEventListener('click',()=>{projectSchemaReview=null;document.getElementById('project-schema-panel').hidden=true;document.getElementById('project-home-schema').focus();});
document.getElementById('project-home-copy').addEventListener('click',()=>previewProjectCopy(null));
document.getElementById('project-copy-cancel').addEventListener('click',()=>{projectCopyDraft=null;document.getElementById('project-copy-panel').hidden=true;document.getElementById('project-home-copy').focus();});
document.getElementById('project-copy-save').addEventListener('click',async()=>{const button=document.getElementById('project-copy-save');if(button.disabled)return;button.disabled=true;try{if(!await commitProjectCopy(projectCopyDraft,document.getElementById('project-copy-name').value)){document.getElementById('project-copy-status').textContent='Copy cancelled; nothing saved.';return;}projectCopyDraft=null;document.getElementById('project-copy-panel').hidden=true;renderProjectList();renderProjectHome();document.getElementById('project-home-summary').textContent='Independent copy saved. Current document kept; find and Open the copy when ready.';}catch(error){document.getElementById('project-copy-status').textContent=error.message;}finally{button.disabled=false;}});
document.getElementById('project-home-close').addEventListener('click',closeProjectHome);
document.getElementById('project-home-search').addEventListener('input',()=>{projectHomeOffset=0;renderProjectHome();});
document.getElementById('project-home-refresh').addEventListener('click',renderProjectHome);
document.getElementById('project-home-prev').addEventListener('click',()=>{projectHomeOffset-=10;renderProjectHome();});
document.getElementById('project-home-next').addEventListener('click',()=>{projectHomeOffset+=10;renderProjectHome();});
document.getElementById('project-home-create').addEventListener('click',()=>{const choices=document.getElementById('project-home-starters');choices.hidden=!choices.hidden;document.getElementById('project-home-create').setAttribute('aria-expanded',String(!choices.hidden));if(!choices.hidden)document.getElementById('project-home-starter-choice').focus();});
document.getElementById('project-home-starter-confirm').addEventListener('click',()=>{const id=document.getElementById('project-home-starter-choice').value;const created=id==='firstperson-wayfinder'?createWorldStarterProject(id):createSpriteStarterProject(id);if(created)closeProjectHome();});
projectHome.addEventListener('keydown',event=>{
  // Home owns keyboard focus. Editor-wide Undo/Delete/Play shortcuts must not
  // mutate the document behind a read-only browser (native input Undo stays).
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeProjectHome();}
  else if(event.key==='Tab'){
    const controls=Array.from(projectHome.querySelectorAll('button:not([disabled]),input')).filter(node=>node.getClientRects().length);
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});

document.getElementById('load-btn').addEventListener('click',()=>openSavedProject(document.getElementById('project-list-select').value));
document.getElementById('recover-previous-project-btn').addEventListener('click',()=>{
  const slot=document.getElementById('project-list-select').value;
  if(!slot){showStatus('Select a saved project first.');return;}
  // Use the same validation, cancellation and stale-document guards as Load.
  // An unused recovery name cannot acquire ownership of the canonical slot.
  let name=slot+' recovered';let suffix=2;
  try {
    while(localStorage.getItem(app.save.namespace+':'+name)!==null&&suffix<100)name=slot+' recovered '+suffix++;
    if(localStorage.getItem(app.save.namespace+':'+name)!==null)throw Error('Choose a new recovery name');
    if(openSavedProject(name,()=>app.save.loadPrevious(slot)))showStatus('Previous local revision opened unsaved. Save under a new name or Back Up Project. Original records kept.');
  }catch(error){showStatus('Previous revision unavailable: '+(error.message||'storage unavailable')+'. Current work kept; use a portable backup.');}
});

document.getElementById('import-project-btn').addEventListener('click', () => {
  document.getElementById('import-project-input').click();
});
var projectBackupRestoreDialog;
function previewProjectBackupRestore(parsed,label,root,signature) {
  if(playMode||levels!==root||projectAuthoredSignature()!==signature)throw new Error('Current document changed while reading the file. Choose the backup again.');
  const normalized=normalizeProjectData(parsed);
  if(!normalized.levels.length)throw new Error('Project must contain at least one level');
  normalized.levels.forEach((level,i)=>validateImportedSceneRecords(level.objects,'Level '+(i+1)));
  validateImportedPrefabs(normalized.prefabs);validatePortableProjectAssetExtras(parsed);
  if(projectBackupRestoreDialog){projectBackupRestoreDialog.close();projectBackupRestoreDialog.remove();}
  const dialog=document.createElement('dialog');projectBackupRestoreDialog=dialog;dialog.id='project-backup-restore';dialog.style.cssText='max-width:560px;background:#152038;color:#e4eaff;border:1px solid #7185ac;padding:22px';
  dialog.innerHTML='<h2>Restore Project JSON</h2><p data-backup-summary></p><p>This replaces only the open in-memory document. Save or back up unsaved work before proceeding. Existing named local saves are not overwritten. Stable object and asset references are preserved.</p><p>Imported Custom Script is unsandboxed and starts unapproved. Review all code before enabling it.</p><p data-backup-status role="status"></p><button data-backup-replace>Replace open document</button> <button data-backup-duplicate>Restore independent copy</button> <button data-backup-cancel>Cancel — keep current work</button>';
  dialog.querySelector('[data-backup-summary]').textContent=label+' · '+normalized.levels.length+' level(s). Replacement preserves project identity; an independent copy receives a new player-save identity.';
  const dispose=()=>{dialog.close();dialog.remove();if(projectBackupRestoreDialog===dialog)projectBackupRestoreDialog=null;};
  const commit=duplicate=>{
    try{
      if(playMode||levels!==root||projectAuthoredSignature()!==signature)throw new Error('Current document changed. Cancel and choose the backup again.');
      const data=JSON.parse(JSON.stringify(parsed));if(duplicate)data.playerPreferenceScope=OpusPlayerRebindScreen.freshScope();
      loadProjectFull(data,'Imported '+label);
      document.getElementById('project-name-input').value='Restored '+(duplicate?'copy ':'')+label.replace(/\.json$/i,'');
      undoStack.length=0;redoStack.length=0;updateUndoRedoButtons();dispose();
      showStatus('Backup restored in memory, not saved locally yet. Choose an unused save name; review imported Custom Script before enabling it.');
    }catch(error){dialog.querySelector('[data-backup-status]').textContent='Restore refused: '+error.message;}
  };
  dialog.querySelector('[data-backup-replace]').onclick=()=>commit(false);dialog.querySelector('[data-backup-duplicate]').onclick=()=>commit(true);dialog.querySelector('[data-backup-cancel]').onclick=dispose;
  dialog.addEventListener('cancel',event=>{event.preventDefault();dispose();});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-backup-cancel]').focus();
}
document.getElementById('import-project-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if(playMode)throw new Error('Stop Play before restoring a backup.');
    if(file.size>64*1024*1024)throw new Error('Backup exceeds the bounded 64 MiB import limit. Current document kept.');
    const root=levels,signature=projectAuthoredSignature();
    const parsed = JSON.parse(await file.text());
    previewProjectBackupRestore(parsed,file.name,root,signature);
  } catch (err) {
    showStatus(`Import failed: ${err.message}`);
  }
});

// Geometry-only import (Opus.Mesh.fromGLTF, engine/src/21-gltf.js) for a
// static model -- no materials/textures beyond the one bounded base-color
// texture already extracted. Wave 6 (Priority C) added a genuine second
// case: a SKINNED model (Opus.Mesh.fromSkinnedGLTF), auto-detected by
// trying the skinned path FIRST and falling back to the static one --
// one Import Model button serves both, rather than asking the author to
// already know which kind of file they're dropping in. A real model still
// reads as "built with this editor" the same way a hand-authored one does:
// placed as an ordinary cube-kind item with the imported mesh, draggable,
// duplicable, deletable, and behavior-attachable exactly like any other --
// a skinned instance ALSO gets `entity.skin` set automatically by
// App.addEntity, so it's already animating (clip 0, looped) the moment
// it's placed, no extra author step.
document.getElementById('import-model-btn').addEventListener('click', () => {
  document.getElementById('import-model-input').click();
});
// Places one instance of a mesh asset -- shared by the import handler
// (first instance) and the Asset Library's own Place button (every
// subsequent one). Every instance shares the SAME mesh handle (see
// getAssetMeshHandle) -- one GPU buffer, however many placed copies.
function placeAssetInstance(asset, position, recordHistory = true) {
  if(recordHistory)pushUndo();
  const entity = app.addEntity({ mesh: getAssetMeshHandle(asset), color: [0.8, 0.8, 0.85], position, scale: new Opus.Vec3(1, 1, 1) });
  const item = { kind: 'cube', entity, behaviors: [], assetId: asset.id };
  if(asset.textureAssetId){item.textureAssetId=asset.textureAssetId;const texture=findTextureAssetById(asset.textureAssetId);if(texture)applyTextureToEntity(entity,texture);}
  addPlaced(item);
  selectItem(item);
  renderSceneList();
  return item;
}
document.getElementById('import-texture-btn').addEventListener('click', () => {
  document.getElementById('import-texture-input').click();
});
function assetImportPlan(files, intent, imageIntent) {
  const list=Array.from(files||[]);if(list.length>32)return {entries:[],reason:'Choose at most32 files per batch.'};
  let total=0;const entries=list.map(file=>{const name=typeof file?.name==='string'?file.name:'Unnamed file',size=file?.size;let kind=/\.(glb|gltf)$/i.test(name)?'model':/\.(png|jpe?g|webp)$/i.test(name)?(imageIntent==='sprite'?'sprite':'texture'):/\.(wav|mp3|ogg|m4a)$/i.test(name)?'audio':null;
    let reason=!Number.isFinite(size)||size<0?'Unavailable file size.':size>16*1024*1024?'File exceeds16MiB.':!kind?'Unsupported asset file. Project JSON and portable bundles use their separate preview/import controls.':intent!=='auto'&&intent!==kind?'File does not match the chosen type.':null;if(reason)kind=null;else total+=size;return {file,name,kind,reason};});
  return total>64*1024*1024?{entries:[],reason:'Batch exceeds64MiB; choose fewer files.'}:{entries};
}
function assetFileDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read file'));reader.readAsDataURL(file);});}
function renderImageImportDiagnostics(reports){
  const details=document.getElementById('image-import-diagnostics'),body=document.getElementById('image-import-diagnostics-body'),preview=document.getElementById('image-import-preview');if(!details||!body||!preview)return;
  body.textContent=reports.map(report=>report.name+'\n'+(report.diagnostics?`${report.diagnostics.width}×${report.diagnostics.height} pixels · ${report.diagnostics.mimeType}\n${report.diagnostics.intent} · ${report.diagnostics.pixelCount} pixels · estimated RGBA ${(report.diagnostics.estimatedRGBABytes/1048576).toFixed(2)} MiB (not total GPU/decoder memory)\n`+[...report.diagnostics.issues,...report.diagnostics.warnings].join('\n'):report.error)).join('\n\n');preview.replaceChildren();for(const report of reports.filter(report=>report.dataURL).slice(0,8)){const img=document.createElement('img');img.src=report.dataURL;img.alt='Prepared image: '+report.name;img.style.cssText='max-width:64px;max-height:64px;object-fit:contain;margin:4px;background:#334155';preview.appendChild(img);}details.hidden=!reports.length;details.open=!!reports.length;
}
function normalizeImageImportDataURL(dataURL,filename){
  if(typeof dataURL!=='string')return dataURL;
  if(!/^data:(?:application\/octet-stream)?;base64,/i.test(dataURL))return dataURL;
  const mime=/\.png$/i.test(filename)?'image/png':/\.jpe?g$/i.test(filename)?'image/jpeg':/\.webp$/i.test(filename)?'image/webp':null;
  return mime?dataURL.replace(/^data:[^;]*;base64,/i,'data:'+mime+';base64,'):dataURL;
}
function analyzeImageImport(record){
  const warnings=[],issues=[],width=record?.width,height=record?.height,mimeType=typeof record?.dataURL==='string'?(/^data:([^;,]+)/i.exec(record.dataURL)?.[1]||'').toLowerCase():'';
  if(!['image/png','image/jpeg','image/webp'].includes(mimeType))issues.push('Use a decoded PNG, JPEG or WebP image. Convert the original file and try again; originals are unchanged.');
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)issues.push('Image dimensions are invalid. Re-export a non-empty image.');
  else if(width>8192||height>8192||width*height>16777216)issues.push('Import diagnostic limit:8192 pixels per side and16 megapixels total. Resize a copy of the original image and try again.');
  if(record?.kind==='sprite')warnings.push('Creates one full-image Sprite Asset; a sheet is not automatically sliced into frames. Configure existing Sprite frames after import.');
  const powerOfTwo=n=>Number.isInteger(n)&&n>0&&(n&(n-1))===0;
  if(Number.isInteger(width)&&Number.isInteger(height)&&(!powerOfTwo(width)||!powerOfTwo(height)))warnings.push('Non-power-of-two image: existing texture behavior applies; no automatic resize or added repeating/mipmap guarantee.');
  const pixelCount=Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0?width*height:0;
  return {ok:issues.length===0,warnings,issues,width,height,pixelCount,estimatedRGBABytes:pixelCount*4,mimeType,intent:record?.kind==='sprite'?'Texture + Sprite':'Texture'};
}
function analyzeModelImportDocument(document){
  const warnings=[],issues=[];const result={ok:false,warnings,issues,meshCount:0,primitiveCount:0,skinnedNodeCount:0,clipCount:0};
  if(!document||typeof document!=='object'||!Array.isArray(document.meshes)){issues.push('No model meshes found. Export an indexed TRIANGLES glTF/GLB with embedded dependencies.');return result;}
  result.meshCount=document.meshes.length;if(document.meshes.length>128){issues.push('Diagnostic limit: at most128 meshes. Split this model into smaller files.');return result;}
  const primitives=[];for(const mesh of document.meshes){if(!mesh||!Array.isArray(mesh.primitives)){issues.push('A model mesh has no primitive list. Re-export the original model.');continue;}if(primitives.length+mesh.primitives.length>4096){issues.push('Diagnostic limit: at most4096 primitives. Split this model.');return result;}primitives.push(...mesh.primitives);}
  result.primitiveCount=primitives.length;if(!primitives.length)issues.push('No model geometry found. Export a mesh, not only a camera or scene.');
  if(primitives.some(p=>!p||p.indices===undefined||p.attributes?.POSITION===undefined||(p.mode!==undefined&&p.mode!==4)))issues.push('Only indexed TRIANGLES with POSITION are supported. Triangulate and export indices.');
  if(Array.isArray(document.accessors)&&document.accessors.some(a=>a?.sparse))issues.push('Sparse accessors are not supported by this reader. Expand sparse data when exporting; no model was added.');
  if(primitives.some(p=>p&&p.attributes?.NORMAL===undefined))warnings.push('Missing normals: the static reader generates face normals; skinned normals use its existing fallback.');
  if(primitives.some(p=>p&&p.attributes?.TEXCOORD_0===undefined))warnings.push('Missing UV0: zero UVs cannot display a mapped texture correctly. Export UV0 for textured models.');
  if(primitives.some(p=>p&&Array.isArray(p.targets)&&p.targets.length))warnings.push('Morph targets are not imported. Export a supported static or skeletal model.');
  if(Array.isArray(document.materials)&&document.materials.length)warnings.push('Bounded material support: one first embedded base-color texture, not multi-material or PBR maps.');
  result.skinnedNodeCount=Array.isArray(document.nodes)?document.nodes.filter(n=>n&&n.mesh!==undefined&&n.skin!==undefined).length:0;
  result.clipCount=Array.isArray(document.animations)?document.animations.length:0;
  if(result.skinnedNodeCount)warnings.push('Skinned import uses the first skinned mesh and its first primitive; additional mesh/primitive content is not combined.');
  else if(result.clipCount)warnings.push('Static import does not import node animation clips. Use a supported skeletal model for animation.');
  result.ok=issues.length===0;return result;
}
function completeModelImportDiagnostics(source,record){
  const positions=record.positions,indices=record.indices;if(!positions?.length||positions.length%3||!indices?.length||indices.length%3)throw new Error('Decoded geometry has no complete indexed triangles. Re-export a triangulated mesh.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i++){const n=positions[i];if(!Number.isFinite(n))throw new Error('Decoded model contains non-finite positions. Repair the source geometry and re-export.');const axis=i%3;min[axis]=Math.min(min[axis],n);max[axis]=Math.max(max[axis],n);}
  if(indices.some(index=>!Number.isInteger(index)||index<0||index>=positions.length/3))throw new Error('Decoded triangle indices exceed the vertex range. Re-export the original model.');
  return {...source,warnings:source.warnings.slice(),issues:source.issues.slice(),vertexCount:positions.length/3,triangleCount:indices.length/3,bounds:{min,max},jointCount:record.skin?.jointCount||0,importedClipCount:record.skin?.clips?.length||0};
}
function renderModelImportDiagnostics(reports){
  const details=document.getElementById('model-import-diagnostics'),body=document.getElementById('model-import-diagnostics-body');if(!details||!body)return;
  body.textContent=reports.map(report=>report.name+'\n'+(report.diagnostics?`${report.diagnostics.meshCount} source meshes · ${report.diagnostics.primitiveCount} source primitives · ${report.diagnostics.skinnedNodeCount} skinned nodes · ${report.diagnostics.clipCount} source clips\n${report.diagnostics.vertexCount} decoded vertices · ${report.diagnostics.triangleCount} triangles · ${report.diagnostics.jointCount} joints · ${report.diagnostics.importedClipCount} imported clips\nBounds: ${JSON.stringify(report.diagnostics.bounds)}\n`+[...report.diagnostics.issues,...report.diagnostics.warnings].join('\n'):report.error)).join('\n\n');details.hidden=!reports.length;details.open=!!reports.length;
}
function analyzeAudioImport(record){
  const buffer=record?.audioBuffer,issues=[],warnings=['Decoded sample rate is browser/context-dependent; original bytes are unchanged. PCM estimate excludes encoded data, browser and playback overhead.'];
  const duration=buffer?.duration,frameCount=buffer?.length,sampleRate=buffer?.sampleRate,channels=buffer?.numberOfChannels;
  if(!Number.isFinite(duration)||duration<=0)issues.push('Decoded audio has no valid positive duration. Re-export a playable audio file.');
  if(!Number.isSafeInteger(frameCount)||frameCount<=0||!Number.isSafeInteger(sampleRate)||sampleRate<=0||!Number.isSafeInteger(channels)||channels<=0)issues.push('Decoded audio frame count, sample rate or channel count is invalid.');
  const estimatedPCMBytes=frameCount*channels*4;
  if(!Number.isSafeInteger(estimatedPCMBytes)||estimatedPCMBytes>64*1024*1024)issues.push('Decoded audio exceeds64MiB PCM. Export a shorter or lower-channel copy; originals are unchanged.');
  if(channels>2)warnings.push('Multichannel source: playback mixing depends on the browser and output device; no channel-routing authoring is added.');
  return {ok:!issues.length,issues,warnings,duration,frameCount,sampleRate,channels,estimatedPCMBytes};
}
function renderAudioImportDiagnostics(reports){
  const details=document.getElementById('audio-import-diagnostics'),body=document.getElementById('audio-import-diagnostics-body');if(!details||!body)return;
  body.textContent=reports.map(report=>report.name+'\n'+(report.diagnostics?`${report.diagnostics.duration.toFixed(3)}s · ${report.diagnostics.channels} channels · ${report.diagnostics.sampleRate}Hz decoded\n${report.diagnostics.frameCount} frames · ${(report.diagnostics.estimatedPCMBytes/1048576).toFixed(2)}MiB estimated float32 PCM\n`+[...report.diagnostics.issues,...report.diagnostics.warnings].join('\n'):report.error)).join('\n\n');details.hidden=!reports.length;details.open=!!reports.length;
}
function reviewStagedModelImport(job){
  const button=document.getElementById('model-import-accept');button.hidden=false;
  return new Promise(resolve=>{job.reviewResolve=resolve;button.onclick=()=>resolve(true);}).finally(()=>{button.hidden=true;button.onclick=null;delete job.reviewResolve;});
}
function validateEmbeddedAssetImport(data){
  let document;
  if(typeof data==='string')document=JSON.parse(data);
  else if(data instanceof ArrayBuffer&&data.byteLength>=20){const view=new DataView(data);if(view.getUint32(0,true)===0x46546c67){const length=view.getUint32(12,true);if(view.getUint32(16,true)===0x4e4f534a&&20+length<=data.byteLength)document=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,length)).replace(/\0+$/,''));}}
  if(!document)return null;
  for(const record of [...(Array.isArray(document.buffers)?document.buffers:[]),...(Array.isArray(document.images)?document.images:[])])if(record?.uri&&!/^data:/i.test(record.uri))throw new Error('External glTF buffers/images are not imported. Embed dependencies in glTF/GLB and try again; originals are unchanged.');
  return document;
}
async function stageAssetImport(file, kind) {
  if(kind==='texture'||kind==='sprite'){const rawDataURL=await assetFileDataURL(file),dataURL=typeof normalizeImageImportDataURL==='function'?normalizeImageImportDataURL(rawDataURL,file.name):rawDataURL,image=await decodeTextureImage(dataURL),record={kind,name:file.name.replace(/\.[^.]+$/,''),sourceFilename:file.name,dataURL,image,width:image.naturalWidth||image.width,height:image.naturalHeight||image.height};if(typeof analyzeImageImport==='function'){record.imageDiagnostics=analyzeImageImport(record);if(!record.imageDiagnostics.ok)throw new Error(record.imageDiagnostics.issues.join(' '));}return record;}
  if(kind==='audio'){const dataURL=await assetFileDataURL(file),audioBuffer=await app.audio.decodeAudio(await file.arrayBuffer()),record={kind,name:file.name.replace(/\.[^.]+$/,''),sourceFilename:file.name,dataURL,audioBuffer};record.audioDiagnostics=analyzeAudioImport(record);if(!record.audioDiagnostics.ok)throw new Error(record.audioDiagnostics.issues.join(' '));return record;}
  const data=/\.glb$/i.test(file.name)?await file.arrayBuffer():await file.text();const diagnostics=analyzeModelImportDocument(validateEmbeddedAssetImport(data));if(!diagnostics.ok)throw new Error(diagnostics.issues.join(' '));let record,arrays;
  try{arrays=Opus.Mesh.toSkinnedArrays(Opus.Mesh.fromSkinnedGLTF(data));record={type:'skinnedMesh',positions:Array.from(arrays.positions),normals:Array.from(arrays.normals),indices:Array.from(arrays.indices),uvs:Array.from(arrays.uvs),joints:Array.from(arrays.joints),weights:Array.from(arrays.weights),skin:flattenSkinForStorage(arrays.skin)};}
  catch(error){if(!/no skinned mesh node found/.test(error.message))throw error;arrays=Opus.Mesh.toArrays(Opus.Mesh.fromGLTF(data));record={type:'mesh',positions:Array.from(arrays.positions),normals:Array.from(arrays.normals),indices:Array.from(arrays.indices),uvs:arrays.uvs?Array.from(arrays.uvs):undefined};}
  let texture=null;if(arrays.textureDataURL){const image=await decodeTextureImage(arrays.textureDataURL);texture={dataURL:arrays.textureDataURL,image,width:image.naturalWidth||image.width,height:image.naturalHeight||image.height};}
  return {kind,name:file.name.replace(/\.(glb|gltf)$/i,''),sourceFilename:file.name,record,texture,diagnostics:completeModelImportDiagnostics(diagnostics,record)};
}
let pendingAssetImport=null;
function commitStagedAssetImports(staged){
  const snapshot=captureTilemapBundleSnapshot(),undoBefore=undoStack.slice(),redoBefore=redoStack.slice();
  try{let modelIndex=0;for(const entry of staged){
    if(entry.kind==='audio'){audioAssets.push({id:generateAudioId(),name:entry.name,sourceFilename:entry.sourceFilename,dataURL:entry.dataURL,audioBuffer:entry.audioBuffer,pendingCallbacks:[]});continue;}
    if(entry.kind==='texture'||entry.kind==='sprite'){const texture={id:generateTextureId(),name:entry.name,sourceFilename:entry.sourceFilename,dataURL:entry.dataURL,image:entry.image,width:entry.width,height:entry.height,textureHandle:null,pendingCallbacks:[]};textureAssets.push(texture);if(entry.kind==='sprite')createSpriteAssetFromTexture(texture,{select:true});continue;}
    const asset={...entry.record,id:generateAssetId(),name:entry.name,sourceFilename:entry.sourceFilename,meshHandle:null};assets.push(asset);const item=placeAssetInstance(asset,new Opus.Vec3(modelIndex++*3,1,0),false);
    if(entry.texture){const texture={...entry.texture,id:generateTextureId(),name:entry.name+' texture',sourceFilename:entry.sourceFilename,textureHandle:null,pendingCallbacks:[]};textureAssets.push(texture);asset.textureAssetId=texture.id;item.textureAssetId=texture.id;applyTextureToEntity(item.entity,texture);}
  }refreshAssetDiscovery();renderAmbientAudioPanel();renderInspector();undoStack.push(snapshot);if(undoStack.length>MAX_HISTORY)undoStack.shift();redoStack.length=0;updateUndoRedoButtons();}
  catch(error){loadEditorSnapshot(snapshot);undoStack.splice(0,undoStack.length,...undoBefore);redoStack.splice(0,redoStack.length,...redoBefore);updateUndoRedoButtons();throw error;}
}
async function runAssetImportBatch(files,intent='auto'){
  const status=document.getElementById('asset-import-batch-status'),cancel=document.getElementById('asset-import-batch-cancel'),choose=document.getElementById('asset-import-batch-choose');
  if(pendingAssetImport){status.textContent='An import is already pending. Cancel it or wait.';return false;}if(playMode){status.textContent='Stop Play before importing assets.';return false;}
  const plan=assetImportPlan(files,intent,intent==='sprite'?'sprite':intent==='texture'?'texture':document.getElementById('asset-import-image-intent').value);if(plan.reason){status.textContent=plan.reason;return false;}if(!plan.entries.length)return false;
  const job={cancelled:false,levels,levelIndex:currentLevelIndex,undo:undoStack.length,undoTop:undoStack[undoStack.length-1],app},staged=[],outcomes=[],modelReports=[],imageReports=[],audioReports=[];pendingAssetImport=job;cancel.disabled=false;choose.disabled=true;
  const valid=()=>!job.cancelled&&!playMode&&levels===job.levels&&currentLevelIndex===job.levelIndex&&undoStack.length===job.undo&&undoStack[undoStack.length-1]===job.undoTop&&app===job.app;
  try{for(let i=0;i<plan.entries.length;i++){if(!valid())throw new Error('Import cancelled or authoring state changed; no batch assets were added.');const entry=plan.entries[i];status.textContent=`Preparing ${i+1}/${plan.entries.length}: ${entry.name}`;if(entry.reason){outcomes.push(entry.name+': '+entry.reason);continue;}
    try{const prepared=await stageAssetImport(entry.file,entry.kind);if(entry.kind==='audio'&&staged.reduce((sum,item)=>sum+(item.audioDiagnostics?.estimatedPCMBytes||0),0)+prepared.audioDiagnostics.estimatedPCMBytes>64*1024*1024)throw new Error('Prepared audio batch exceeds64MiB decoded PCM. Choose fewer or shorter audio files; originals are unchanged.');staged.push(prepared);if(entry.kind==='audio')audioReports.push({name:entry.name,diagnostics:prepared.audioDiagnostics});if(entry.kind==='model')modelReports.push({name:entry.name,diagnostics:prepared.diagnostics});if(entry.kind==='texture'||entry.kind==='sprite')imageReports.push({name:entry.name,diagnostics:prepared.imageDiagnostics,dataURL:prepared.dataURL});outcomes.push(entry.name+': prepared');}catch(error){if(entry.kind==='audio')audioReports.push({name:entry.name,error:error.message});if(entry.kind==='model')modelReports.push({name:entry.name,error:error.message});if(entry.kind==='texture'||entry.kind==='sprite')imageReports.push({name:entry.name,error:error.message});outcomes.push(entry.name+': failed — '+error.message);}if(typeof renderModelImportDiagnostics==='function')renderModelImportDiagnostics(modelReports);if(typeof renderImageImportDiagnostics==='function')renderImageImportDiagnostics(imageReports);if(typeof renderAudioImportDiagnostics==='function')renderAudioImportDiagnostics(audioReports);
  }if(!valid())throw new Error('Import cancelled or authoring state changed; no batch assets were added.');if(staged.some(entry=>['model','texture','sprite','audio'].includes(entry.kind))&&typeof reviewStagedModelImport==='function'){status.textContent=`Prepared ${staged.length}/${plan.entries.length} files. Review import diagnostics, then Import prepared files or Cancel. Nothing has been added yet.`;if(!await reviewStagedModelImport(job))job.cancelled=true;}if(!valid())throw new Error('Import cancelled or authoring state changed; no batch assets were added.');if(staged.length)commitStagedAssetImports(staged);status.textContent=`Imported ${staged.length}/${plan.entries.length} files${staged.length?' · one Undo step':''}. `+outcomes.map(x=>x.replace(/: prepared$/,': imported')).join(' | ');return !!staged.length;
  }catch(error){status.textContent=error.message;return false;}finally{if(pendingAssetImport===job)pendingAssetImport=null;cancel.disabled=true;choose.disabled=false;}
}
document.getElementById('asset-import-batch-choose').onclick=()=>document.getElementById('asset-import-batch-input').click();
document.getElementById('asset-import-batch-input').onchange=event=>{const files=Array.from(event.target.files||[]);event.target.value='';runAssetImportBatch(files);};
document.getElementById('asset-import-batch-cancel').onclick=()=>{if(pendingAssetImport){pendingAssetImport.cancelled=true;pendingAssetImport.reviewResolve?.(false);document.getElementById('asset-import-batch-status').textContent='Cancelling after the current decoder returns; no batch assets will be added.';}};
document.getElementById('left-tab-assets').addEventListener('dragover',event=>{if(Array.from(event.dataTransfer?.types||[]).includes('Files'))event.preventDefault();});
document.getElementById('left-tab-assets').addEventListener('drop',event=>{const files=Array.from(event.dataTransfer?.files||[]);if(!files.length)return;event.preventDefault();event.stopPropagation();runAssetImportBatch(files);});
async function importTextureFile(file) {
  const dataURL = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
  const img = await decodeTextureImage(dataURL);
  const asset = { id: generateTextureId(), name: file.name.replace(/\.[^.]+$/, ''), dataURL, sourceFilename: file.name, image: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, textureHandle: null, pendingCallbacks: [] };
  textureAssets.push(asset); renderTextureLibrary();
  return asset;
}
document.getElementById('import-texture-input').addEventListener('change', async (e) => {
  const files=Array.from(e.target.files||[]);e.target.value='';if(!files.length)return;await runAssetImportBatch(files,'texture');
});
document.getElementById('import-sprite-btn').addEventListener('click', () => document.getElementById('import-sprite-input').click());
document.getElementById('import-sprite-input').addEventListener('change', async (e) => {
  const files=Array.from(e.target.files||[]);e.target.value='';if(!files.length)return;await runAssetImportBatch(files,'sprite');
});
document.getElementById('import-model-input').addEventListener('change', async event=>{
  const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;await runAssetImportBatch(files,'model');
});

