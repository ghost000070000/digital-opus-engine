// Export Tiers -- Editable Game and Playable Game share this ONE builder
// (not two divergent copies): both inline the exact same engine bundle and
// the exact same editor/runtime script (this very file) into one file, and
// boot through the exact same loadProjectFull/enterPlayMode path Crate Run
// itself ships through. The only difference between tiers is one embedded
// boolean (window.__OPUS_PLAYABLE_ONLY__) that the SAME script reads at its
// own boot time to decide whether the chrome-toggle button stays reachable
// (see playableOnlyMode, set near setEditorVisible) -- deliberately not a
// second, separately-built "player-only" runtime, which would inevitably
// drift from whatever the real editor/gameplay code actually does. Assets
// (mesh/texture/audio, all embedded as base64 in project JSON already) are
// carried through for free since both tiers embed the full serialized
// project either way -- there's no separate "asset embedding" step tiers
// need to differ on.
// Wave 6B (Priority G) fixed a real, severe bug here once already (an
// export silently missing the entire engine bundle -- see git history/
// CHANGELOG for the full story if this block's own shape ever needs
// touching again: the dev-time cache-busting block below is matched by
// ONE regex in `composeExportHTML`, not two independent replaces that can
// drift out of sync with each other).
//
// Game-catalog pass: the actual templating logic (the regex-replace that
// assembles engine+editor+project into one HTML page) now lives in
// build/export-template.js's `composeExportHTML`, shared verbatim with the
// build-time catalog build script (build/build-games.js) -- ONE export
// implementation, not two. This function's own job is now just gathering
// the four inputs that only exist in a live browser (fetches + the current
// in-memory project) and handing them to that shared function.
let exportPreflightGeneration = 0;
function prepareExportPreflight(playableOnly) {
  if (playMode) throw new Error('Stop Play before reviewing an export.');
  const generation = ++exportPreflightGeneration;
  const projectJSON = JSON.stringify(serializeProject({ includeTilesets: !playableOnly }));
  const snapshot = JSON.parse(projectJSON);
  const review = collectStructuredProjectIssues(snapshot);
  const lease = Object.freeze({ levelsOwner: levels, levelIndex: currentLevelIndex,
    project: JSON.stringify(captureAssetReplacementState().project),
    undoOwner: undoStack, redoOwner: redoStack, undoLength: undoStack.length, redoLength: redoStack.length,
    undoTail: undoStack[undoStack.length - 1], redoTail: redoStack[redoStack.length - 1] });
  // The confirmed payload is an immutable string, not a mutable live project or
  // a second serialization that could silently replace the reviewed snapshot.
  const issues = Object.freeze(review.issues.map(entry => Object.freeze({ ...entry })));
  return Object.freeze({ generation, playableOnly, projectJSON,
    review: Object.freeze({ ...review, issues }), lease });
}
function cancelExportPreflight(prepared) {
  if (prepared && prepared.generation === exportPreflightGeneration) exportPreflightGeneration++;
}
function assertExportPreflightLease(prepared) {
  if (!prepared || prepared.generation !== exportPreflightGeneration) throw new Error('Export review canceled or superseded. Review the export again.');
  if (playMode) throw new Error('Stop Play before exporting the reviewed project.');
  const lease = prepared.lease;
  if (!lease || lease.levelsOwner !== levels || lease.levelIndex !== currentLevelIndex ||
      lease.undoOwner !== undoStack || lease.redoOwner !== redoStack ||
      lease.undoLength !== undoStack.length || lease.redoLength !== redoStack.length ||
      lease.undoTail !== undoStack[undoStack.length - 1] || lease.redoTail !== redoStack[redoStack.length - 1] ||
      lease.project !== JSON.stringify(captureAssetReplacementState().project)) {
    throw new Error('Export review is stale: project, assets, level or history changed. Review the export again.');
  }
}
async function buildReviewedExport(prepared) {
  assertExportPreflightLease(prepared);
  if (prepared.review.issues.some(entry => entry.severity === 'error')) throw new Error('Export preflight blocked: repair the listed structured errors before export. Save remains available for recovery.');
  const html = await buildExportHTML(prepared.playableOnly, prepared.projectJSON);
  assertExportPreflightLease(prepared);
  return html;
}
async function buildExportHTML(playableOnly) {
  // Both tiers inspect the exact portable project before fetching/composing.
  // Save stays available for recovery; invalid typed dependencies block export.
  const exportProject=arguments[1]===undefined?JSON.parse(JSON.stringify(serializeProject({ includeTilesets: !playableOnly }))):JSON.parse(arguments[1]);
  const lootIssues=collectLootTableIssues(exportProject);
  if(lootIssues.length){lastProjectValidation={issues:lootIssues};lastProjectValidationLevels=levels;renderProjectValidation(lootIssues);activateTab('right-tab','project');if(document.querySelector('[data-section-body="validation"]')?.classList.contains('collapsed'))document.querySelector('[data-section="validation"]')?.click();throw new Error('Loot Table validation found issues. Repair the named table, Pickup Prefabs or caller before export. Save remains available for recovery.');}
  const touchIssues=collectTouchLayoutIssues(exportProject);
  if(touchIssues.some(entry=>entry.severity==='error')){lastProjectValidation={issues:touchIssues};lastProjectValidationLevels=levels;renderProjectValidation(touchIssues);activateTab('right-tab','project');if(document.querySelector('[data-section-body="validation"]')?.classList.contains('collapsed'))document.querySelector('[data-section="validation"]')?.click();throw new Error('Touch layout validation found issues. Repair the named controls before export. Save remains available for recovery.');}
  const contextIssues=OpusInputContexts.collectIssues(exportProject);
  if(contextIssues.some(entry=>entry.severity==='error')) {
    lastProjectValidation={issues:contextIssues};lastProjectValidationLevels=levels;
    renderProjectValidation(contextIssues);activateTab('right-tab','project');
    if(document.querySelector('[data-section-body="validation"]')?.classList.contains('collapsed'))document.querySelector('[data-section="validation"]')?.click();
    throw new Error('Input context validation found issues. Restore or choose the named context and Actions before export. Save remains available for recovery.');
  }
  const signalReview=OpusSignals.collectDependencies(exportProject,{graphValueType:(node,graph)=>OpusGraphValues.outputType(node,GRAPH_NODE_TYPES,graph)});
  if(signalReview.issues.some(entry=>entry.severity==='error')){
    lastProjectValidation=signalReview;lastProjectValidationLevels=levels;
    renderProjectValidation(signalReview.issues);activateTab('right-tab','project');
    if(document.querySelector('[data-section-body="validation"]')?.classList.contains('collapsed'))document.querySelector('[data-section="validation"]')?.click();
    throw new Error('Signal dependency validation found issues. Review Project → Validate, repair the named references, then export again. Save remains available.');
  }
  const canonicalReview=collectStructuredProjectIssues(exportProject);
  if(canonicalReview.issues.some(entry=>entry.severity==='error')){
    lastProjectValidation=canonicalReview;lastProjectValidationLevels=levels;
    renderProjectValidation(canonicalReview.issues);activateTab('right-tab','project');
    if(document.querySelector('[data-section-body="validation"]')?.classList.contains('collapsed'))document.querySelector('[data-section="validation"]')?.click();
    throw new Error('Export preflight blocked '+(playableOnly?'Playable':'Editable')+': repair the listed structured errors before export. Warnings do not block; Save remains available for recovery.');
  }
  // Exported Editable documents own their original template and embedded
  // sources. Recompose those exact sources with the newly validated snapshot;
  // never fetch a repository beside a standalone document or nest prior HTML.
  if(typeof window!=='undefined'&&window.__OPUS_EMBEDDED_PROJECT__!==undefined){
    const template=document.getElementById('opus-export-template');
    const composer=document.getElementById('opus-export-composer');
    const engine=document.getElementById('opus-export-engine');
    const editor=document.getElementById('opus-export-editor');
    if(!template||!composer||!engine||!editor)throw new Error('Standalone export sources are unavailable. Open the saved project in the source editor to export.');
    const htmlTemplate=JSON.parse(template.textContent);
    return composeExportHTML({htmlTemplate,engineJS:engine.textContent.trim(),editorJS:editor.textContent.trim(),templateJS:composer.textContent.trim(),embeddedProjectJSON:JSON.stringify(exportProject),playableOnly,title:projectMeta.title||currentUiConfig.startScreen.title||'Digital Opus Game'});
  }
  const exportFetch=async path=>{const response=await fetch(path,{cache:'reload'});if(response.ok===false)throw new Error('Export source '+path+' failed: '+response.status);return response.text();};
const [engineJS, inspectorFieldsJS, collisionFilter2DJS, collider2DJS, triggerCollider2DJS, oneWay2DJS, characterSlope2DJS, movingPlatform2DJS, body2DJS, physicsDebug2DJS, authoringSchemaJS, authoringPlumbingJS, characterTileQueryJS, tilemapBundleJS, spriteAuthoringJS, authoringLanguageJS, graphValuesJS, graphVariablesJS, graphFunctionsJS, graphSchemaJS, graphTemplatesJS, graphTraceJS, signalsJS, gameplayPresetsJS, componentPresetsJS, hudCanvasJS, hudLayoutJS, hudBindingsJS, hudActionPromptsJS, menuScreenStackJS, hudButtonActionsJS, hudWidgetsJS, hudTweensJS, uiTemplatesJS, inputActionAssetsJS, inputActionSetsJS, inputDeviceMappingsJS, playerRebindScreenJS, inputTuningJS, inputContextsJS, onboardingJS, spriteStartersJS, worldStartersJS, editorCoreJS, htmlTemplate, templateJS] = await Promise.all([
    exportFetch('../dist/opus-engine.js'),
    exportFetch('src/00-inspector-fields.js'),
    exportFetch('src/00-collision-filter-2d.js'),
    exportFetch('src/00-collider-2d.js'),
    exportFetch('src/00-trigger-collider-2d.js'),
    exportFetch('src/00-one-way-2d.js'),
    exportFetch('src/00-character-slope-2d.js'),
    exportFetch('src/00-moving-platform-2d.js'),
    exportFetch('src/00-body-2d.js'),
    exportFetch('src/00-physics-debug-2d.js'),
    exportFetch('src/00-authoring-schema.js'),
    exportFetch('src/00-authoring-plumbing.js'),
    exportFetch('src/00-character-tile-query.js'),
    exportFetch('src/00-tilemap-bundle.js'),
    exportFetch('src/00-sprite-authoring.js'),
    exportFetch('src/00-authoring-language.js'),
    exportFetch('src/00-graph-values.js'),
    exportFetch('src/00-graph-variables.js'),
    exportFetch('src/00-graph-functions.js'),
    exportFetch('src/00-graph-schema.js'),
    exportFetch('src/00-graph-templates.js'),
    exportFetch('src/00-graph-trace.js'),
    exportFetch('src/00-signals.js'),
    exportFetch('src/00-gameplay-presets.js'),
    exportFetch('src/00-component-presets.js'),
    exportFetch('src/00-hud-canvas.js'),
    exportFetch('src/00-hud-layout.js'),
    exportFetch('src/00-hud-bindings.js'),
    exportFetch('src/00-hud-action-prompts.js'),
    exportFetch('src/00-menu-screen-stack.js'),
    exportFetch('src/00-hud-button-actions.js'),
    exportFetch('src/00-hud-widgets.js'),
    exportFetch('src/00-hud-tweens.js'),
    exportFetch('src/00-ui-templates.js'),
    exportFetch('src/00-input-action-assets.js'),
    exportFetch('src/00-input-action-sets.js'),
    exportFetch('src/00-input-device-mappings.js'),
    exportFetch('src/00-player-rebind-screen.js'),
    exportFetch('src/00-input-tuning.js'),
    exportFetch('src/00-input-contexts.js'),
    exportFetch('src/00-onboarding.js'),
    exportFetch('src/00-sprite-starters.js'),
    exportFetch('src/00-world-starters.js'),
    exportFetch('src/01-editor.js'),
    exportFetch('index.html'),
    exportFetch('../build/export-template.js'),
  ]);
const editorJS = `${inspectorFieldsJS}\n${collisionFilter2DJS}\n${collider2DJS}\n${triggerCollider2DJS}\n${oneWay2DJS}\n${characterSlope2DJS}\n${movingPlatform2DJS}\n${body2DJS}\n${physicsDebug2DJS}\n${authoringSchemaJS}\n${authoringPlumbingJS}\n${characterTileQueryJS}\n${playableOnly ? '' : tilemapBundleJS}\n${spriteAuthoringJS}\n${authoringLanguageJS}\n${graphValuesJS}\n${graphVariablesJS}\n${graphSchemaJS}\n${graphFunctionsJS}\n${graphTemplatesJS}\n${graphTraceJS}\n${signalsJS}\n${gameplayPresetsJS}\n${playableOnly ? '' : componentPresetsJS}\n${playableOnly ? '' : hudCanvasJS}\n${hudLayoutJS}\n${hudBindingsJS}\n${hudActionPromptsJS}\n${menuScreenStackJS}\n${hudButtonActionsJS}\n${hudWidgetsJS}\n${hudTweensJS}\n${playableOnly ? '' : uiTemplatesJS}\n${inputActionAssetsJS}\n${inputActionSetsJS}\n${inputDeviceMappingsJS}\n${playerRebindScreenJS}\n${inputTuningJS}\n${inputContextsJS}\n${onboardingJS}\n${worldStartersJS}\n${spriteStartersJS}\n${editorCoreJS}`;
  // Runtime controller is required by both export tiers, not just the source editor.
  const platformerController2DJS = await exportFetch('src/00-platformer-controller-2d.js');
  const topdownController2DJS = await exportFetch('src/00-topdown-controller-2d.js');
  const controllerStateEventsJS = await exportFetch('src/00-controller-state-events.js');
  const controllerAbilitiesJS = await exportFetch('src/00-controller-abilities.js');
  const controllerTemplatesJS = await exportFetch('src/00-controller-templates.js');
  const aiBrainJS = await exportFetch('src/00-ai-brain.js');
  const weaponDefinitionsJS = await exportFetch('src/00-weapon-definitions.js');
  const damagePolicyJS = await exportFetch('src/00-damage-policy.js');
  const combatVolumesJS = await exportFetch('src/00-combat-volumes.js');
  const lootTablesJS = await exportFetch('src/00-loot-tables.js');
  const inventoryTemplatesJS = await exportFetch('src/00-inventory-templates.js');
  const embedded = JSON.stringify(exportProject);
  // Dogfood-02 fix: the fallback here used to be the literal string
  // 'Digital Opus — Crate Run' -- the starter demo's own name -- so any
  // project whose author filled in the Start Screen's own Title (an
  // entirely separate field from this Project Meta title, easy to never
  // notice exists) but never touched the less-discoverable Project tab's
  // Title field shipped an exported .html carrying a COMPLETELY UNRELATED
  // other game's name in its browser tab, every time. Falls back to the
  // Start Screen's own title (something every dogfooded game so far has
  // actually set) before finally falling back to a neutral, non-demo-
  // specific name.
  const title = projectMeta.title || currentUiConfig.startScreen.title || 'Digital Opus Game';
  const touchControlLayoutJS=await exportFetch('src/00-touch-control-layout.js');
  const inputConflictsJS=await exportFetch('src/00-input-conflicts.js');
return composeExportHTML({ htmlTemplate, engineJS, editorJS:touchControlLayoutJS+'\n'+inputConflictsJS+'\n'+platformerController2DJS+'\n'+topdownController2DJS+'\n'+controllerStateEventsJS+'\n'+controllerAbilitiesJS+'\n'+controllerTemplatesJS+'\n'+aiBrainJS+'\n'+weaponDefinitionsJS+'\n'+damagePolicyJS+'\n'+combatVolumesJS+'\n'+lootTablesJS+'\n'+inventoryTemplatesJS+'\n'+editorJS, templateJS, embeddedProjectJSON: embedded, playableOnly, title });
}

// Export size safety warning -- shown regardless of tier (both embed the
// same assets), since a multi-megabyte export is still valid but worth
// flagging before someone emails it or hits a host's upload limit. 15MB is
// comfortably under common free-tier upload caps (itch.io: 1GB, but email/
// chat attachment limits are often 10-25MB) while being far above what any
// text-heavy or lightly-textured project should ever reach.
const EXPORT_SIZE_WARNING_BYTES = 15 * 1024 * 1024;
function checkExportSize(byteLength) {
  const warningEl = document.getElementById('export-size-warning');
  if (!warningEl) return;
  if (byteLength > EXPORT_SIZE_WARNING_BYTES) {
    warningEl.textContent = `⚠ This export is ${(byteLength / (1024 * 1024)).toFixed(1)}MB -- large for a single file (usually from embedded textures/audio/models). Still valid, but worth checking before sharing it.`;
    warningEl.style.display = '';
  } else {
    warningEl.style.display = 'none';
  }
}
function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  checkExportSize(blob.size);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
let exportPreflightSession = null;
function closeExportPreflight() {
  const session = exportPreflightSession;
  if (!session) return;
  exportPreflightSession = null;
  cancelExportPreflight(session.prepared);
  window.removeEventListener('keydown', session.keyGuard, true);
  window.removeEventListener('keyup', session.keyGuard, true);
  session.host.remove();
  session.returnFocus?.focus();
}
function openExportPreflight(playableOnly) {
  closeExportPreflight();
  let prepared;
  try { prepared = prepareExportPreflight(playableOnly); }
  catch (error) { showStatus(error.message); return false; }
  const tier = playableOnly ? 'Playable' : 'Editable', issues = prepared.review.issues;
  const errors = issues.filter(issue => issue.severity === 'error').length;
  const warnings = issues.filter(issue => issue.severity === 'warning').length;
  const sourceReview = typeof readCustomScriptReview === 'function' ? readCustomScriptReview(JSON.parse(prepared.projectJSON)) : null;
  const hostActionNotice = sourceReview && (sourceReview.limited || sourceReview.entries.some(text => text.includes('Host custom Action reference:')));
const host = document.createElement('dialog');host.id = 'export-preflight-dialog';
  host.setAttribute('aria-labelledby', 'export-preflight-title');
  host.setAttribute('aria-describedby', 'export-preflight-summary');
  host.style.cssText = 'width:min(520px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:auto;padding:22px;background:#111c2e;color:#e2e8f0;border:1px solid #52647e;border-radius:10px;box-shadow:0 18px 60px #0009';
  host.innerHTML = `<h2 id="export-preflight-title" style="margin:0 0 12px;font-size:20px">${tier} export · Preflight review</h2><p>${playableOnly ? 'Game-only HTML. Unused authoring dependencies are omitted; editor access is unavailable.' : 'Editable HTML. Includes reusable authoring libraries so another creator can continue editing.'}</p><p id="export-preflight-summary"></p><p>Structured errors block export. Warnings preserve retained data and do not block. Save Project remains available for recovery. Nothing is repaired or removed automatically.</p><ul id="export-preflight-issues" style="max-height:190px;overflow:auto;padding-left:20px"></ul><p id="export-preflight-status" role="status" aria-live="polite"></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="export-preflight-problems">Review Problems</button><button id="export-preflight-cancel">Cancel</button><button id="export-preflight-confirm">Export ${tier} HTML</button></div>`;
  const q = selector => host.querySelector(selector), confirm = q('#export-preflight-confirm'), status = q('#export-preflight-status');
  if (hostActionNotice) {
    const notice = document.createElement('p'); notice.id = 'export-host-action-notice';
    notice.textContent = 'Host-installed custom Action implementations are not embedded. IDs and parameters are retained. Install matching trusted host code separately in every exported page and review permission before Start; otherwise these Actions do not run. A limited source review may also require this warning.';
    q('#export-preflight-summary').after(notice);
  }
  q('#export-preflight-summary').textContent = `${errors} blocking error${errors === 1 ? '' : 's'} · ${warnings} warning${warnings === 1 ? '' : 's'} · ${issues.length} total issue${issues.length === 1 ? '' : 's'}`;
  for (const issue of issues.slice(0, 8)) {
    const item = document.createElement('li');
    item.textContent = `${issue.severity.toUpperCase()}: ${issue.message}${issue.prefabName ? ' · Prefab: ' + issue.prefabName : issue.objectId ? ' · Object: ' + issue.objectId : ''}`;
    q('#export-preflight-issues').appendChild(item);
  }
  if (issues.length > 8) { const item = document.createElement('li');item.textContent = 'More issues are available in Problems.';q('#export-preflight-issues').appendChild(item); }
  if (!issues.length) q('#export-preflight-issues').hidden = true;
  confirm.disabled = errors > 0;
  q('#export-preflight-problems').disabled = !issues.length;
  for (const button of host.querySelectorAll('button')) button.style.cssText = 'padding:9px 12px;border:1px solid #52647e;border-radius:5px;background:#20334d;color:#e2e8f0;font:inherit';
  const session = { prepared, host, returnFocus: document.activeElement, keyGuard: null };
  exportPreflightSession = session;
  session.keyGuard = event => {
    if (exportPreflightSession !== session) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault();closeExportPreflight(); }
    else if (event.key === 'Tab' && event.type === 'keydown') {
      const controls = [...host.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')].filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault();host.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault();last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault();first.focus(); }
    }
  };
  window.addEventListener('keydown', session.keyGuard, true);window.addEventListener('keyup', session.keyGuard, true);
  host.oncancel = event => { event.preventDefault();closeExportPreflight(); };
  q('#export-preflight-cancel').onclick = closeExportPreflight;
  q('#export-preflight-problems').onclick = () => {
    try {
      assertExportPreflightLease(prepared);
      lastProjectValidation = prepared.review;lastProjectValidationLevels = levels;
      // This explicit repair handoff must reveal its named blockers even when
      // an earlier ordinary Problems search or warning-only filter hid them.
      for (const [id, value] of [['project-problems-severity', 'all'], ['project-problems-scope', 'all'], ['project-problems-search', '']]) {
        const filter = document.getElementById(id);if (filter) filter.value = value;
      }
      closeExportPreflight();renderProjectValidation(lastProjectValidation.issues);activateTab('right-tab', 'project');
      if (document.querySelector('[data-section-body="validation"]')?.classList.contains('collapsed')) document.querySelector('[data-section="validation"]')?.click();
      document.querySelector('[data-section="validation"]')?.scrollIntoView({ block: 'start' });
    } catch (error) { status.textContent = error.message;confirm.disabled = true; }
  };
  confirm.onclick = async () => {
    confirm.disabled = true;status.textContent = `Building reviewed ${tier} HTML… Cancel still stops the download.`;
    try {
      const html = await buildReviewedExport(prepared);
      if (exportPreflightSession !== session) return;
      downloadHTML(html, playableOnly ? 'playable-game.html' : 'editable-game.html');
      closeExportPreflight();if (playableOnly) markOnboardingProgress('export');
      showStatus(`${tier} game exported${playableOnly ? ' (no editor access)' : ''}`);
    } catch (error) { if (exportPreflightSession === session) status.textContent = `${error.message} Close and prepare a fresh review.`; }
  };
  document.body.appendChild(host);host.showModal();
  (errors ? q('#export-preflight-problems') : confirm).focus();
  return true;
}
document.getElementById('export-standalone-btn').addEventListener('click', () => openExportPreflight(false));
document.getElementById('export-playable-btn').addEventListener('click', () => openExportPreflight(true));

