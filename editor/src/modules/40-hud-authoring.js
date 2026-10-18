// --- HUD/UI authoring ---
const HUD_KIND_LABELS = { label: 'Text Label', counter: 'Counter Display', timer: 'Timer Display', health: 'Health Bar', objective: 'Objective Text', button: 'Button', panel: 'Panel', image: 'Image', actionPrompt: 'Action Prompt', inventoryWidget: 'Inventory List', objectiveWidget: 'Objective List', dialogueWidget: 'Dialogue' };
const HUD_ANCHORS = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];

function applyLevelUiConfig(index) {
  const saved = levels[index].ui;
  currentUiConfig = copyUiConfig(saved);
  renderUiConfigPanel();
}
function applyLevelSequences(index) {
  currentSequences = (levels[index].sequences || []).map((s) => JSON.parse(JSON.stringify(s)));
  selectedSequenceId = currentSequences.find(s=>s&&findSequenceById(s.id)===s)?.id || null;
  renderSequencePanel();
}
function applyLevelObjectiveDefs(index) {
  currentObjectiveDefs = (levels[index].objectiveDefs || []).map((o) => JSON.parse(JSON.stringify(o)));
  renderObjectiveDefPanel();
  renderScatterPanel(); // Wave 7 (Priority G): cheap to refresh here too -- keeps the Prefab/Asset source dropdowns from ever going stale after a level switch
}
// Wave 9C: Scatter Layers are level-scoped -- deep-cloned like every other
// per-level array (Section 5's own "Duplicate Level must deep-clone it").
// Stable ids stay unique across levels because `generateScatterLayerId`'s
// counter is never reset per-level, matching every other id generator in
// this file (Objectives, Items, Sockets) -- the SAME reasoning Duplicate
// Level already relies on for objective/object ids.
function applyLevelScatterLayers(index) {
  currentScatterLayers = (levels[index].scatterLayers || []).map((l) => JSON.parse(JSON.stringify(l)));
  selectedScatterLayerId = currentScatterLayers.length ? currentScatterLayers[0].id : null;
  renderScatterLayerPanel();
}
function renderUiConfigPanel() {
  document.getElementById('start-screen-enabled').checked = currentUiConfig.startScreen.enabled;
  document.getElementById('start-screen-new-game').checked = currentUiConfig.startScreen.newGame === true;
  document.getElementById('start-screen-title').value = currentUiConfig.startScreen.title;
  document.getElementById('start-screen-subtitle').value = currentUiConfig.startScreen.subtitle;
  document.getElementById('start-screen-button').value = currentUiConfig.startScreen.buttonText;
  document.getElementById('start-screen-howtoplay').value = currentUiConfig.startScreen.howToPlay || '';
  document.getElementById('start-screen-credits').value = currentUiConfig.startScreen.credits || '';
  document.getElementById('start-screen-controls-hint').value = currentUiConfig.startScreen.controlsHint || '';
  document.getElementById('win-title').value = currentUiConfig.winTitle;
  document.getElementById('win-message').value = currentUiConfig.winMessage;
  document.getElementById('lose-title').value = currentUiConfig.loseTitle;
  document.getElementById('lose-message').value = currentUiConfig.loseMessage;
  for (const result of ['win', 'lose']) {
    const field = result + 'AudioAssetId';
    const select = document.getElementById(result + '-audio-asset');
    select.innerHTML = '<option value="">Default</option>' + audioAssets.map((asset) => `<option value="${escapeHtml(asset.id)}"${currentUiConfig[field] === asset.id ? ' selected' : ''}>${escapeHtml(asset.name)}</option>`).join('');
    select.onchange = () => { currentUiConfig[field] = select.value || undefined; };
  }
  renderHudElementList();
  if(typeof renderMenuPageEditor==='function')renderMenuPageEditor();
  renderPlayerRebindScreenEditor();
  if(typeof renderTouchLayoutEditor==='function')renderTouchLayoutEditor();
}
function setPlayerRebindScreen(config) {
  if (playMode) return false;
  const before = OpusPlayerRebindScreen.inspect(currentUiConfig.rebindScreen);
  const next = OpusPlayerRebindScreen.inspect(config);
  if (!before.ok || !next.ok) return false;
  const merged = OpusPlayerRebindScreen.inspect({ ...before.record, ...config });
  if (!merged.ok || JSON.stringify(before.record) === JSON.stringify(merged.record)) return false;
  pushUndo(); currentUiConfig.rebindScreen = merged.record;
  renderPlayerRebindScreenEditor(); return true;
}
function resetPlayerRebindScreen() {
  if (playMode || !Object.prototype.hasOwnProperty.call(currentUiConfig, 'rebindScreen') || !OpusPlayerRebindScreen.inspect(currentUiConfig.rebindScreen).ok) return false;
  pushUndo(); delete currentUiConfig.rebindScreen; renderPlayerRebindScreenEditor(); return true;
}
function previewPlayerRebindScreen() {
  if (playMode) return;
  const state = OpusPlayerRebindScreen.inspect(currentUiConfig.rebindScreen);
  const preview = document.getElementById('rebind-screen-preview');
  preview.hidden = false;
  preview.innerHTML = state.ok ? `<h3>${escapeHtml(state.record.title)}</h3><p>${escapeHtml(state.record.description)}</p>${controlsRowsHtml(true)}<p>Preview uses creator defaults. Rebinding is available during Play.</p>` : '<p>Retained configuration is unavailable in this editor.</p>';
}
function renderPlayerRebindScreenEditor() {
  const state = OpusPlayerRebindScreen.inspect(currentUiConfig.rebindScreen);
  const config = state.ok ? state.record : OpusPlayerRebindScreen.defaults();
  for (const field of ['enabled','title','description','launcherLabel']) {
    const element = document.getElementById('rebind-screen-'+field);
    if (!element) return;
    element[field === 'enabled' ? 'checked' : 'value'] = config[field];
    element.disabled = !state.ok || playMode;
  }
  document.getElementById('rebind-screen-status').textContent = state.ok ? 'Generated from this level’s controller and named Input Actions. Player choices do not change your project.' : 'Unsupported configuration retained unchanged; edit it in a compatible editor.';
  document.getElementById('rebind-screen-save').disabled = !state.ok || playMode;
  document.getElementById('rebind-screen-reset').disabled = !state.ok || playMode;
  document.getElementById('rebind-screen-preview').hidden = true;
}
document.getElementById('rebind-screen-save').onclick = () => {
  const config = OpusPlayerRebindScreen.defaults();
  for (const field of ['enabled','title','description','launcherLabel']) {
    const element = document.getElementById('rebind-screen-'+field);
    config[field] = element[field === 'enabled' ? 'checked' : 'value'];
  }
  if (!OpusPlayerRebindScreen.inspect(config).ok) { showStatus('Enter a title, launcher label and bounded explanatory text.'); return; }
  if (!setPlayerRebindScreen(config)) showStatus('Controls configuration unchanged.');
};
document.getElementById('rebind-screen-reset').onclick = resetPlayerRebindScreen;
document.getElementById('rebind-screen-preview-btn').onclick = previewPlayerRebindScreen;
function applyGameFlowSetup(draft, context) {
  if (playMode || !context || context.level !== levels[currentLevelIndex] || context.ui !== currentUiConfig || context.objects !== placed) return {ok:false,reason:'Level changed or Play active. Close and reopen game flow.'};
  if (!draft || typeof draft.enabled !== 'boolean' || typeof draft.newGame !== 'boolean' || ['title','buttonText','winTitle','winMessage','loseTitle','loseMessage'].some(key=>typeof draft[key]!=='string' || draft[key].length>512) || !draft.buttonText.trim()) return {ok:false,reason:'Enter bounded screen text, a button label and a valid fresh-session policy.'};
  const additions=[];
  for (const action of ['win','lose']) {
    const route=draft[action];
    if (!route || route.ownerId==='') continue;
    const owners=placed.filter(item=>item?.id===route.ownerId);
    if (owners.length!==1 || !context.owners?.includes(owners[0]) || !['cube','sprite'].includes(owners[0].kind) || owners[0].behaviors!==undefined&&!Array.isArray(owners[0].behaviors) || !['click','interact'].includes(route.trigger)) return {ok:false,reason:'Choose an available named Cube/Sprite and Click or Interact event. Reopen setup if the object changed.'};
    const owner=owners[0];
    const opposite=action==='win'?'lose':'win',other=draft[opposite];
    if (other?.ownerId===route.ownerId && other.trigger===route.trigger || (owner.behaviors||[]).some(b=>b?.action===opposite && b.trigger===route.trigger)) return {ok:false,reason:'One event cannot both Win and Lose. Choose a different object or event; existing routes are retained.'};
    if (!(owner.behaviors||[]).some(b=>b?.action===action && b.trigger===route.trigger)) additions.push({owner,behavior:{trigger:route.trigger,action,params:{}}});
  }
  const changed=currentUiConfig.startScreen.enabled!==draft.enabled || (currentUiConfig.startScreen.newGame===true)!==draft.newGame || currentUiConfig.startScreen.title!==draft.title || currentUiConfig.startScreen.buttonText!==draft.buttonText || ['winTitle','winMessage','loseTitle','loseMessage'].some(key=>currentUiConfig[key]!==draft[key]) || additions.length>0;
  if (!changed) return {ok:true,changed:false};
  pushUndo();
  Object.assign(currentUiConfig.startScreen,{enabled:draft.enabled,newGame:draft.newGame,title:draft.title,buttonText:draft.buttonText});
  for (const key of ['winTitle','winMessage','loseTitle','loseMessage']) currentUiConfig[key]=draft[key];
  for (const entry of additions) { entry.owner.behaviors=entry.owner.behaviors||[];entry.owner.behaviors.push(entry.behavior); }
  renderUiConfigPanel();if(selectedItem)renderBehaviorList(selectedItem);
  return {ok:true,changed:true};
}
function openGameFlowSetup() {
  if(playMode){showStatus('Stop Play before authoring game flow.');return;}
  document.getElementById('game-flow-modal')?.remove();
  const context={level:levels[currentLevelIndex],ui:currentUiConfig,objects:placed,owners:placed.slice()},ui=currentUiConfig,host=document.createElement('div');
  host.id='game-flow-modal';host.className='modal-overlay visible';
  const owners=placed.filter(item=>item&&['cube','sprite'].includes(item.kind)&&placed.filter(other=>other?.id===item.id).length===1),options='<option value="">No new ending route</option>'+owners.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name||item.kind)}</option>`).join('');
  const text=(key,label,value)=>`<div class="field-row"><label for="game-flow-${key}">${label}</label><input id="game-flow-${key}" maxlength="512" value="${escapeHtml(value||'')}"></div>`;
host.innerHTML=`<div class="modal" role="dialog" aria-label="Game flow setup"><h2>Game flow</h2><p>Use the existing opening menu, save slots and Win/Lose Actions. No script or separate game manager. Existing routes and sounds stay intact.</p><label><input id="game-flow-enabled" type="checkbox"${ui.startScreen.enabled?' checked':''}> Show opening menu</label><label><input id="game-flow-new-game" type="checkbox"${ui.startScreen.newGame===true?' checked':''}> Start button begins a fresh game session</label>${text('title','Game title',ui.startScreen.title)}${text('buttonText','Start / New Game label',ui.startScreen.buttonText)}${text('winTitle','Win title',ui.winTitle)}${text('winMessage','Win message',ui.winMessage)}${text('loseTitle','Lose title',ui.loseTitle)}${text('loseMessage','Lose message',ui.loseMessage)}${['win','lose'].map(action=>`<fieldset><legend>${action==='win'?'Win':'Lose'} event (optional)</legend><label>Object<select id="game-flow-${action}-owner">${options}</select></label><label>Event<select id="game-flow-${action}-event"><option value="interact">On Interact</option><option value="click">On Click</option></select></label></fieldset>`).join('')}<p>Interact needs a nearby Interactable; Click uses ordinary object input. Edit/remove routes in Inspector Behaviors. Continue appears only for readable default/auto saves on this device. Fresh game optionally resets session progress through normal fresh Play when returning from Main Menu; the initial opening does not repeat Start events. Leave off for historical Start/resume. Standalone Restart reloads a fresh attempt. This setup does not clear stored saves.</p><p id="game-flow-status" role="status"></p><button id="game-flow-apply">Apply setup</button><button id="game-flow-cancel">Cancel</button></div>`;
  document.body.appendChild(host);
  host.querySelector('#game-flow-cancel').onclick=()=>host.remove();
  host.querySelector('#game-flow-apply').onclick=()=>{const draft={enabled:host.querySelector('#game-flow-enabled').checked,newGame:host.querySelector('#game-flow-new-game').checked};for(const key of ['title','buttonText','winTitle','winMessage','loseTitle','loseMessage'])draft[key]=host.querySelector('#game-flow-'+key).value;for(const action of ['win','lose'])draft[action]={ownerId:host.querySelector('#game-flow-'+action+'-owner').value,trigger:host.querySelector('#game-flow-'+action+'-event').value};const result=applyGameFlowSetup(draft,context);if(result.ok){host.remove();showStatus(result.changed?'Game flow configured. Undo restores screens and Behaviors.':'Game flow unchanged.');}else host.querySelector('#game-flow-status').textContent=result.reason;};
}
document.getElementById('game-flow-open-btn').addEventListener('click',openGameFlowSetup);
bindUiAuthoringField('start-screen-enabled', () => currentUiConfig.startScreen, 'enabled', 'checked');
bindUiAuthoringField('start-screen-new-game', () => currentUiConfig.startScreen, 'newGame', 'checked');
bindUiAuthoringField('start-screen-title', () => currentUiConfig.startScreen, 'title', 'value');
bindUiAuthoringField('start-screen-subtitle', () => currentUiConfig.startScreen, 'subtitle', 'value');
bindUiAuthoringField('start-screen-button', () => currentUiConfig.startScreen, 'buttonText', 'value');
bindUiAuthoringField('start-screen-howtoplay', () => currentUiConfig.startScreen, 'howToPlay', 'value');
bindUiAuthoringField('start-screen-credits', () => currentUiConfig.startScreen, 'credits', 'value');
bindUiAuthoringField('start-screen-controls-hint', () => currentUiConfig.startScreen, 'controlsHint', 'value');
bindUiAuthoringField('win-title', () => currentUiConfig, 'winTitle', 'value');
bindUiAuthoringField('win-message', () => currentUiConfig, 'winMessage', 'value');
bindUiAuthoringField('lose-title', () => currentUiConfig, 'loseTitle', 'value');
bindUiAuthoringField('lose-message', () => currentUiConfig, 'loseMessage', 'value');

function menuPageRecords() { return Array.isArray(currentUiConfig.menuPages) ? currentUiConfig.menuPages : []; }
function availableMenuPages() {
  const pages = menuPageRecords();
  if (typeof OpusMenuScreenStack === 'undefined' || pages.length > 64) return [];
  return pages.filter(page => OpusMenuScreenStack.inspect(page).available && pages.filter(other => other?.id === page.id).length === 1);
}
function createMenuPage() {
  if (playMode || menuPageRecords().length >= 64) return null;
  const records=[...menuPageRecords(),...levels.flatMap(level=>Array.isArray(level.ui?.menuPages)?level.ui.menuPages:[])];
  const used = new Set(records.flatMap(page=>[page?.id,...(Array.isArray(page?.links)?page.links.map(link=>link?.pageId):[])]));
  let serial=1; while(used.has('menu'+serial)) serial++;
  pushUndo();
  const page={version:1,id:'menu'+serial,title:'New Menu',body:'Choose a page link below to connect your screens.',pauseSimulation:true,links:[]};
  currentUiConfig.menuPages=[...menuPageRecords(),page]; renderMenuPageEditor(); return page;
}
function changeMenuPage(index, key, value) {
  const page=menuPageRecords()[index];
  if(playMode || !page || !OpusMenuScreenStack.inspect(page).available || !['title','body','pauseSimulation','links'].includes(key)) return false;
  const candidate={...page,[key]:value};
  if(!OpusMenuScreenStack.inspect(candidate).available || JSON.stringify(page[key])===JSON.stringify(value)) return false;
  pushUndo();page[key]=value;renderMenuScreenLaunchers();return true;
}
function removeMenuPage(index) {
  if(playMode || index<0 || index>=menuPageRecords().length) return false;
  pushUndo();currentUiConfig.menuPages=menuPageRecords().filter((_,i)=>i!==index);renderMenuPageEditor();return true;
}
function moveMenuPage(index,direction) {
  const pages=menuPageRecords(),next=index+direction;
  if(playMode || ![-1,1].includes(direction) || index<0 || next<0 || index>=pages.length || next>=pages.length) return false;
  pushUndo();[pages[index],pages[next]]=[pages[next],pages[index]];renderMenuPageEditor();return true;
}
function renderMenuPageEditor() {
  const host=document.getElementById('menu-page-list');
  if(!host || typeof OpusMenuScreenStack==='undefined') return;
  const available=availableMenuPages();
  host.innerHTML=menuPageRecords().map((page,index)=>{
    const valid=available.includes(page),title=typeof page?.title==='string'?page.title:'Unsupported page';
    const header=`<strong>${escapeHtml(title||'Untitled Menu')}</strong><div style="display:flex;gap:6px;margin-top:8px"><button data-menu-up ${index===0?'disabled':''}>↑</button><button data-menu-down ${index===menuPageRecords().length-1?'disabled':''}>↓</button><button data-menu-remove>Remove</button></div>`;
    if(!valid) return `<div class="menu-page-editor" data-menu-index="${index}">${header}<p role="status">Unavailable or ambiguous page retained. Fix the source version/reference before using it.</p></div>`;
    const links=(page.links||[]).map((link,i)=>`<div><label>Page link ${i+1} label<input data-menu-link-label="${i}" maxlength="160" value="${escapeHtml(link.label)}"></label><span style="overflow-wrap:anywhere">→ ${escapeHtml(available.find(p=>p.id===link.pageId)?.title||'Missing page')}</span> <button data-menu-link-remove="${i}" aria-label="Remove page link">×</button></div>`).join('');
    return `<div class="menu-page-editor" data-menu-index="${index}">${header}<label>Title<input data-menu-field="title" maxlength="160" value="${escapeHtml(page.title)}"></label><label>Page text<textarea data-menu-field="body" maxlength="8192" rows="3">${escapeHtml(page.body)}</textarea></label><label><input type="checkbox" data-menu-field="pauseSimulation" ${page.pauseSimulation!==false?'checked':''}> Pause gameplay while this page is open</label><p style="font-size:11px;color:#9fb3d9">Page links push a screen. Back and Close are built in; gameplay button actions are a separate workflow.</p>${links}<label>Link to page<select data-menu-link-target><option value="">Choose another page…</option>${available.filter(p=>p.id!==page.id).map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.title||'Untitled Menu')}</option>`).join('')}</select></label><button data-menu-link-add>Add page link</button> <button data-menu-preview>Preview</button></div>`;
  }).join('') || '<p class="onboarding-empty">No Menu Pages yet. Add one, then choose another page to build a screen stack.</p>';
  host.querySelectorAll('[data-menu-index]').forEach(row=>{
    const index=Number(row.dataset.menuIndex),page=menuPageRecords()[index];
    row.querySelector('[data-menu-remove]').onclick=()=>removeMenuPage(index);
    row.querySelector('[data-menu-up]').onclick=()=>moveMenuPage(index,-1);
    row.querySelector('[data-menu-down]').onclick=()=>moveMenuPage(index,1);
    row.querySelectorAll('[data-menu-field]').forEach(input=>{
      let recorded=false;input.onfocus=()=>{recorded=false;};
      const handler=()=>{
        if(playMode)return;const key=input.dataset.menuField,value=input.type==='checkbox'?input.checked:input.value;
        if(page[key]===value || !OpusMenuScreenStack.inspect({...page,[key]:value}).available)return;
        if(!recorded || input.type==='checkbox'){pushUndo();recorded=true;}page[key]=value;renderMenuScreenLaunchers();
      };
      input.addEventListener(input.type==='checkbox'?'change':'input',handler);
    });
    row.querySelectorAll('[data-menu-link-label]').forEach(input=>bindMenuLinkLabel(input,page,Number(input.dataset.menuLinkLabel)));
    row.querySelectorAll('[data-menu-link-remove]').forEach(button=>{button.onclick=()=>{if(changeMenuPage(index,'links',(page.links||[]).filter((_,i)=>i!==Number(button.dataset.menuLinkRemove))))renderMenuPageEditor();};});
    const add=row.querySelector('[data-menu-link-add]');if(add)add.onclick=()=>{
      const target=availableMenuPages().find(p=>p.id===row.querySelector('[data-menu-link-target]').value);
      if(target && changeMenuPage(index,'links',[...(page.links||[]),{pageId:target.id,label:target.title||'Open page'}]))renderMenuPageEditor();
    };
    const preview=row.querySelector('[data-menu-preview]');if(preview)preview.onclick=()=>openMenuScreen(page.id,true);
  });
  document.getElementById('menu-page-add').disabled=playMode||menuPageRecords().length>=64;
  renderMenuScreenLaunchers();
}
function renderMenuScreenLaunchers() {
  const pages=availableMenuPages();
  document.querySelectorAll('[data-menu-launchers]').forEach(host=>{
    host.innerHTML=pages.map(page=>`<button data-menu-open="${escapeHtml(page.id)}">${escapeHtml(page.title||'Untitled Menu')}</button>`).join('');
    host.querySelectorAll('[data-menu-open]').forEach(button=>{button.onclick=()=>openMenuScreen(button.dataset.menuOpen,false);});
  });
}
function bindMenuLinkLabel(input,page,index) {
  const root=levels,level=levels[currentLevelIndex],config=currentUiConfig,links=page.links,link=links?.[index];
  let recorded=false,expected=JSON.stringify(page);
  input.disabled=playMode;
  input.onfocus=()=>{recorded=false;};input.onblur=()=>{recorded=false;};
  input.addEventListener('input',()=>{
    if(playMode||levels!==root||levels[currentLevelIndex]!==level||currentUiConfig!==config||!input.isConnected||!link||page.links!==links||links[index]!==link||menuPageRecords().filter(record=>record?.id===page.id).length!==1||!menuPageRecords().includes(page)||JSON.stringify(page)!==expected)return;
    const value=input.value;
    if(value===link.label)return;
    const candidate={...page,links:links.map((entry,i)=>i===index?{...entry,label:value}:entry)};
    if(!OpusMenuScreenStack.inspect(candidate).available)return;
    if(!recorded){pushUndo();recorded=true;}
    link.label=value;expected=JSON.stringify(page);renderMenuScreenLaunchers();
  });
}
function openMenuScreen(id, preview=false) {
  if(!preview&&!playMode)return false;
  if(!menuScreenStack){menuScreenStack=OpusMenuScreenStack.create(menuPageRecords(),{paused:app.paused});menuScreenPreview=preview&&!playMode;menuScreenReturnFocus=document.activeElement;}
  const result=menuScreenStack.push(id,{paused:app.paused});
  if(!result.available){showStatus(result.reason);if(!result.depth)menuScreenStack=null;return false;}
  renderMenuScreen(result);return result.changed;
}
function renderMenuScreen(result) {
  const host=document.getElementById('menu-screen-overlay');
  host.classList.toggle('visible',!!result.depth);
  if(!result.depth){
    host.innerHTML='';if(!menuScreenPreview)releaseGameplayScreenPause('menus');
    menuScreenStack=null;menuScreenPreview=false;menuScreenReturnFocus?.focus?.();menuScreenReturnFocus=null;return;
  }
  const page=result.top;
  host.innerHTML=`<section class="menu-screen-card"><h2 id="menu-screen-title">${escapeHtml(page.title||'Untitled Menu')}</h2><p>${escapeHtml(page.body)}</p><nav>${(page.links||[]).map(link=>`<button data-menu-push="${escapeHtml(link.pageId)}">${escapeHtml(link.label)}</button>`).join('')}<button id="menu-screen-back" ${result.depth<2?'disabled':''}>Back</button><button id="menu-screen-close">Close</button></nav><p style="font-size:11px;color:#9fb3d9">${menuScreenPreview?'Authoring preview · ':''}${result.depth} screen${result.depth===1?'':'s'} · Escape ${result.depth>1?'returns':'closes'}</p></section>`;
  host.querySelectorAll('[data-menu-push]').forEach(button=>{button.onclick=()=>openMenuScreen(button.dataset.menuPush,menuScreenPreview);});
  host.querySelector('#menu-screen-back').onclick=()=>renderMenuScreen(menuScreenStack.back({paused:app.paused}));
  host.querySelector('#menu-screen-close').onclick=()=>renderMenuScreen(menuScreenStack.close({paused:app.paused}));
  if(!menuScreenPreview){if(result.pauseRequired)acquireGameplayScreenPause('menus');else releaseGameplayScreenPause('menus');}
  if(menuScreenPreview&&!playMode) mountMenuPreviewReadability(host,page);
  host.querySelector('button:not([disabled])')?.focus();
}

function mountMenuPreviewReadability(host, page) {
  const card=host.querySelector('.menu-screen-card'),root=levels,level=levels[currentLevelIndex],config=currentUiConfig;
  const owners=menuPageRecords().filter(record=>record?.id===page.id),owner=owners.length===1?owners[0]:null;
  const signature=owner&&JSON.stringify(owner);
  const current=()=>!playMode&&menuScreenPreview&&menuScreenStack&&levels===root&&levels[currentLevelIndex]===level&&currentUiConfig===config&&card.isConnected&&host.querySelector('.menu-screen-card')===card&&owner&&menuPageRecords().filter(record=>record?.id===page.id).length===1&&menuPageRecords().includes(owner)&&JSON.stringify(owner)===signature;
  const check=document.createElement('button');check.type='button';check.id='menu-check-readability';check.textContent='Check preview readability';
  const output=document.createElement('div');output.id='menu-readability-results';output.setAttribute('aria-live','polite');
  card.append(check,output);
  const line=text=>{const p=document.createElement('p');p.style.fontSize='12px';p.style.overflowWrap='anywhere';p.textContent=text;output.append(p);return p;};
  check.onclick=()=>{
    output.replaceChildren();
    if(!current()||!host.getClientRects().length||host.clientWidth<=0||host.clientHeight<=0){line('Menu preview measurement unavailable or stale. Stop Play and reopen this authored preview. No verdict or project change.');return;}
    const viewport={width:host.clientWidth,height:host.clientHeight},issues=[];
    let repairSelector='[data-menu-field="title"]';
    const addIssue=(message,selector)=>{if(!issues.length&&selector)repairSelector=selector;issues.push(message);};
    const boxes=[{node:host.querySelector('#menu-screen-title'),label:'Title',selector:'[data-menu-field="title"]'},{node:card.querySelector('p'),label:'Page text',selector:'[data-menu-field="body"]'},...Array.from(card.querySelectorAll('[data-menu-push]')).slice(0,64).map((node,index)=>({node,label:`Page link ${index+1}`,selector:`[data-menu-link-label="${index}"]`}))];
    const outer=host.getBoundingClientRect(),bounds=card.getBoundingClientRect();
    let unavailable=0;
    for(const box of boxes){
      const n=box.node;if(!n||!n.getClientRects().length||n.clientWidth<=0||n.clientHeight<=0){unavailable++;continue;}
      if(n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1)addIssue(`${box.label} content exceeds its visible box.`,box.selector);
      const rect=n.getBoundingClientRect();
      if(rect.left<bounds.left-1||rect.right>bounds.right+1||rect.top<bounds.top-1||rect.bottom>bounds.bottom+1)addIssue(`${box.label} extends outside the visible Menu card; review size, wrapping or intentional scrolling.`,box.selector);
    }
    if(bounds.left<outer.left-1||bounds.top<outer.top-1||bounds.right>outer.right+1||bounds.bottom>outer.bottom+1)issues.push('Menu card extends outside the current preview viewport.');
    line(`Menu preview ${viewport.width} × ${viewport.height}: ${issues.length} advisory observation(s), ${unavailable} unavailable text box(es).`);
    line('Only this visible authored Menu Preview is measured; this is not accessibility certification or an export blocker. Intentional scrolling, other sizes, runtime text, dialogue states, contrast and transparent backgrounds require manual review. Nothing is repaired automatically.');
    if(!issues.length)line('No measured overflow here; this does not prove readability.');
    for(const issue of issues.slice(0,30))line(issue);
    const repair=document.createElement('button');repair.type='button';repair.textContent='Review Menu authoring controls';repair.id='menu-readability-review';output.append(repair);
    repair.onclick=()=>{
      if(!current()||host.clientWidth!==viewport.width||host.clientHeight!==viewport.height){line('The measured Menu preview changed. Reopen and check again. No project changes made.');return;}
      const index=menuPageRecords().indexOf(owner);
      renderMenuScreen(menuScreenStack.close({paused:app.paused}));activateTab('right-tab','ui');
      const section=document.querySelector('[data-section="menus"]');if(section?.nextElementSibling?.classList.contains('collapsed'))section.click();
      const row=document.querySelector(`#menu-page-list [data-menu-index="${index}"]`);
      row?.scrollIntoView({block:'nearest'});row?.querySelector(repairSelector)?.focus({preventScroll:true});
    };
  };
}
document.getElementById('menu-page-add').addEventListener('click',createMenuPage);
// Capture before App's legacy Escape toggle: a modal Back must not also
// resume gameplay. Native navigation keeps using the existing App loop.
window.addEventListener('keydown',event=>{
  const host=document.getElementById('menu-screen-overlay');
  if(event.code==='Tab'&&host.classList.contains('visible')){
    const controls=Array.from(host.querySelectorAll('button:not([disabled])'));
    if(controls.length){const index=controls.indexOf(document.activeElement),next=event.shiftKey?(index<=0?controls.length-1:index-1):(index+1)%controls.length;event.preventDefault();controls[next].focus();}return;
  }
  if(event.code!=='Escape')return;
  const visible=id=>document.getElementById(id)?.classList.contains('visible');
  if(!host.classList.contains('visible')||!menuScreenStack){
    if(!playMode)return;
    if(visible('controls-panel'))closeControlsPanel();
    else if(visible('howtoplay-overlay'))document.getElementById('howtoplay-overlay').classList.remove('visible');
    else if(visible('credits-overlay'))document.getElementById('credits-overlay').classList.remove('visible');
    else if(visible('inventory-overlay'))toggleInventory();
    else if(gameplayScreenPauseOwners.has('dialogue') || visible('dialogue-overlay'))closeDialogue();
    else if(!visible('start-overlay')&&!visible('end-overlay'))return;
    event.preventDefault();event.stopImmediatePropagation();return;
  }
  event.preventDefault();event.stopImmediatePropagation();
  const snapshot=menuScreenStack.snapshot();renderMenuScreen(snapshot.depth>1?menuScreenStack.back({paused:app.paused}):menuScreenStack.close({paused:app.paused}));
},true);

function bindUiAuthoringField(id, getRecord, key, valueKey = 'value') {
  const input = document.getElementById(id); let recorded = false;
  input.addEventListener('focus', () => { recorded = false; });
  const handler = () => {
    if (playMode) return;
    const record = getRecord(), value = input[valueKey];
    if (record[key] === value) return;
    if (!recorded) { pushUndo(); recorded = true; }
    record[key] = value;
  };
  if (valueKey === 'checked') input.onchange = handler; else input.oninput = handler;
}

function refreshHudBindingCatalog() {
  if (typeof OpusHudBindings === 'undefined') return;
  // Discovery is read-only. Save serialization synchronizes level state and
  // cannot run while import is still restoring UI/Sequences/Objectives.
  const project = {levels:levels.map((level,index) => index === currentLevelIndex
    ? {...level,objects:serializeScene(),sequences:currentSequences} : level),graphFunctions}, actions = [], graphs = [];
  visitAuthoredActions(project, (type, params) => actions.push({type,params}));
  for (const level of project.levels || []) for (const object of level.objects || [])
    for (const behavior of object.behaviors || []) if (behavior.action === 'graph' && behavior.graph) graphs.push(behavior.graph);
  for (const definition of project.graphFunctions || []) {
    if (!definition?.graph) continue;
    graphs.push(definition.graph);
    for (const node of definition.graph.nodes || []) actions.push({type:node.type,params:node});
  }
  hudBindingCatalog = OpusHudBindings.catalog({actions,graphs,objectives:project.levels.flatMap(level => level.objectives || level.objectiveDefs || [])});
}
function findHudBindingSource(binding) {
  return binding?.version === 1 && hudBindingCatalog.find(source => source.source === binding.source && (source.name || '') === (binding.name || '') && (!binding.type || source.type === binding.type));
}
function hudBindingState(preview) {
  if (!preview && currentUiConfig.hudElements.some(element => element.binding?.source === 'health' || element.binding?.source === 'maxHealth')) ensureHealthInit();
  return {game:preview?{}:window.__gameState||{},timers:preview?{}:window.__gameTimers||{},health:preview?100:window.__gameState?.health,maxHealth:preview?100:window.__gameState?.maxHealth,activeObjectiveTitle:preview?(currentObjectiveDefs[0]?.title||''):currentActiveObjectiveTitle()};
}
function resolveBoundHudText(element, preview) {
  if (typeof OpusHudBindings === 'undefined') return 'Binding unavailable';
  const result = OpusHudBindings.resolve(element.binding,hudBindingCatalog,hudBindingState(preview),{preview});
  if (!result.available) return 'Unavailable · '+(result.reason || element.binding?.name || 'HUD source');
  const value = element.binding?.source === 'timer' && typeof result.value === 'number' ? result.value.toFixed(1) : String(result.value ?? '');
  return String(element.bindingTemplate ?? '{value}').replaceAll('{value}',value);
}
function hudBindingFieldsHTML(element) {
  if (!['label','counter','timer','objective'].includes(element.kind)) return '';
  const hasBinding = Object.prototype.hasOwnProperty.call(element,'binding');
  const selected = findHudBindingSource(element.binding);
  const currentKey = hasBinding ? selected?.key || '__unavailable__' : '';
  const options = hudBindingCatalog.map(source => `<option value="${escapeHtml(source.key)}"${source.key === currentKey?' selected':''}${source.available===false?' disabled':''}>${escapeHtml(source.label)}${source.available===false?' · unavailable':''}</option>`).join('');
  const retained = hasBinding && !selected ? '<option value="__unavailable__" selected>Unavailable saved source — choose replacement</option>' : '';
  const resolved = hasBinding ? OpusHudBindings.resolve(element.binding,hudBindingCatalog,hudBindingState(true),{preview:true}) : null;
  return `<label>Display source<select data-hud-binding><option value="">Legacy text / tokens (unchanged)</option>${options}${retained}</select></label><label>Display template<input data-hud-binding-template type="text" value="${escapeHtml(element.bindingTemplate ?? '{value}')}"${!element.binding?' disabled':''}></label><p data-hud-binding-status class="field-help">${escapeHtml(resolved ? resolved.available ? 'Preview · '+String(resolved.value ?? '') : 'Unavailable · '+resolved.reason : 'Legacy mode. Choose a named source to display its value. Use {value} in the new display template. Local/Object variables are not global HUD state.')}</p>`;
}
function bindHudBindingControls(row, element) {
  const select = row.querySelector('[data-hud-binding]'), template = row.querySelector('[data-hud-binding-template]');
  if (!select || !template) return;
  select.disabled = playMode; template.disabled = playMode || !element.binding;
  select.onchange = () => {
    if (playMode) return;
    if (select.value === '') {
      if (!Object.prototype.hasOwnProperty.call(element,'binding')) return;
      pushUndo(); delete element.binding; renderHudElementList(); return;
    }
    const source = hudBindingCatalog.find(entry => entry.key === select.value && entry.available !== false);
    if (!source) return;
    const next = {version:1,source:source.source,...(source.name?{name:source.name}:{}),...(source.type?{type:source.type}:{})};
    if (JSON.stringify(element.binding) === JSON.stringify(next)) return;
    pushUndo(); element.binding = next; renderHudElementList();
  };
  let recorded = false;
  template.onfocus = () => {recorded=false;};
  template.oninput = () => {
    if (playMode || !element.binding || (element.bindingTemplate ?? '{value}') === template.value) return;
    if (!recorded) {pushUndo();recorded=true;}
    element.bindingTemplate=template.value; renderHudAuthoringCanvas();
  };
}

function hudElementFieldsHTML(el) {
  const anchorSelect = `<label>Anchor<select data-hud-field="anchor">${HUD_ANCHORS.map((a) => `<option value="${a}"${el.anchor === a ? ' selected' : ''}>${a}</option>`).join('')}</select></label><div class="field-triple"><label>Horizontal offset<input type="number" data-hud-field="offsetX" value="${Number(el.offsetX)||0}"></label><label>Vertical offset<input type="number" data-hud-field="offsetY" value="${Number(el.offsetY)||0}"></label></div><label><input type="checkbox" data-hud-field="keepInside"${el.keepInside===true?' checked':''}> Keep inside viewport / safe area</label>` + (['image','panel'].includes(el.kind) ? `<label>Width sizing<select data-hud-field="widthMode"><option value="fixed"${el.widthMode!=='percent'?' selected':''}>Fixed pixels (historical)</option><option value="percent"${el.widthMode==='percent'?' selected':''}>Percent of available width</option></select></label><div class="field-triple"><label>Width %<input type="number" data-hud-field="widthPercent" min="1" max="100" value="${Number(el.widthPercent)||50}"></label><label>Minimum px<input type="number" data-hud-field="minWidth" min="0" value="${Number(el.minWidth)||0}"></label><label>Maximum px (0 = none)<input type="number" data-hud-field="maxWidth" min="0" value="${Number(el.maxWidth)||0}"></label></div>` : '');
  if (el.kind === 'image') {
    const options = textureAssets.map(asset => `<option value="${escapeHtml(asset.id)}"${el.textureAssetId === asset.id ? ' selected' : ''}>${escapeHtml(asset.name)}</option>`).join('');
    const missing = el.textureAssetId && !findTextureAssetById(el.textureAssetId) ? `<option value="${escapeHtml(el.textureAssetId)}" selected>Missing image — choose replacement</option>` : '';
    return anchorSelect + `<label>Image asset<select data-hud-field="textureAssetId"><option value="">Choose Texture asset</option>${missing}${options}</select></label><label>Description<input type="text" data-hud-field="description" value="${escapeHtml(el.description || '')}"></label><div class="field-triple"><input type="number" aria-label="Image width" data-hud-field="imageWidth" min="1" value="${Number(el.imageWidth) || 128}"><input type="number" aria-label="Image height" data-hud-field="imageHeight" min="1" value="${Number(el.imageHeight) || 128}"></div>`;
  }
  if (el.kind === 'label' || el.kind === 'objective') {
    return anchorSelect + `<input type="text" data-hud-field="text" placeholder="Text (use {counterName} to bind)" value="${escapeHtml(el.text || '')}">`;
  }
  if (el.kind === 'counter') {
    return anchorSelect + `<input type="text" data-hud-field="counterName" placeholder="Counter name" value="${escapeHtml(el.counterName || '')}">`
      + `<input type="text" data-hud-field="text" placeholder="Label (use {value})" value="${escapeHtml(el.text || 'Score: {value}')}">`;
  }
  if (el.kind === 'timer') {
    return anchorSelect + `<input type="text" data-hud-field="timerName" placeholder="Timer name" value="${escapeHtml(el.timerName || '')}">`
      + `<input type="text" data-hud-field="text" placeholder="Label (use {value})" value="${escapeHtml(el.text || 'Time: {value}')}">`;
  }
  if (el.kind === 'health') return anchorSelect;
  if (el.kind === 'button') {
    const actionOptions = Object.keys(ACTION_TYPES).filter((t) => t !== 'script').map((t) => `<option value="${t}"${el.buttonAction === t ? ' selected' : ''}>${escapeHtml(ACTION_TYPES[t].label)}</option>`).join('');
    return anchorSelect + `<input type="text" data-hud-field="text" placeholder="Button label" value="${escapeHtml(el.text || 'Button')}">`
      + `<label>Button Action<select data-hud-field="buttonAction">${!Object.prototype.hasOwnProperty.call(ACTION_TYPES,el.buttonAction)||el.buttonAction==='script'?`<option value="${escapeHtml(el.buttonAction||'')}" selected disabled>Unavailable saved Action</option>`:''}${actionOptions}</select></label>` + hudButtonActionFieldsHTML(el);
  }
  if (el.kind === 'panel') {
    return anchorSelect + `<div class="field-triple"><input type="number" data-hud-field="panelWidth" placeholder="Width" value="${el.panelWidth || 120}"><input type="number" data-hud-field="panelHeight" placeholder="Height" value="${el.panelHeight || 60}"></div>`;
  }
  return anchorSelect;
}

function hudButtonActionField(field,params) {
  if(field.type==='signalPayload')return {...field,type:signalPayloadFieldType(params.signalId)};
  if(field.type==='comparisonValue')return {...field,type:({number:'number',text:'text',boolean:'checkbox',object:'target',color:'color'})[params.valueType||'number']};
  return field;
}
function hudWidgetFieldsHTML(element) {
  if (!['inventoryWidget','objectiveWidget','dialogueWidget'].includes(element.kind)) return '';
  const config = element.widget || {};
  if (typeof OpusHudWidgets === 'undefined' || !OpusHudWidgets.inspect(config).available) return '<p class="field-help">Unavailable saved widget settings retained.</p>';
  return `<label>Title<input data-hud-widget-field="title" maxlength="160" value="${escapeHtml(config.title || '')}"></label><label>Empty message<input data-hud-widget-field="emptyText" maxlength="320" value="${escapeHtml(config.emptyText || '')}"></label>${element.kind !== 'dialogueWidget' ? `<label>List limit<input type="number" min="1" max="20" step="1" data-hud-widget-field="maxEntries" value="${config.maxEntries ?? 6}"></label>` : ''}${element.kind === 'objectiveWidget' ? `<label>Show<select data-hud-widget-field="statusFilter"><option value="active"${config.statusFilter !== 'all' ? ' selected' : ''}>Active objectives</option><option value="all"${config.statusFilter === 'all' ? ' selected' : ''}>All objective states</option></select></label>` : ''}<p class="field-help">Reads existing gameplay data. Preview is a read-only sample.</p>`;
}
function bindHudWidgetControls(row, element) {
  row.querySelectorAll('[data-hud-widget-field]').forEach(input => {
    input.disabled = playMode;
    let recorded = false;
    input.addEventListener('focus', () => { recorded = false; });
    input.addEventListener('blur', () => { recorded = false; });
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (playMode || typeof OpusHudWidgets === 'undefined') return;
      const key = input.dataset.hudWidgetField;
      const value = input.type === 'number' ? Number(input.value) : input.value;
      if (input.type === 'number' && !input.value.trim()) return;
      const next = {...element.widget, [key]: value};
      if (!OpusHudWidgets.inspect(next).available || Object.is(element.widget[key], value)) return;
      if (!recorded || input.tagName === 'SELECT') { pushUndo(); recorded = true; }
      element.widget = next;
      renderHudAuthoringCanvas();
    });
  });
}
function hudButtonActionFieldsHTML(element) {
  if(typeof OpusHudButtonActions==='undefined')return '';
  const fields=OpusHudButtonActions.fields(element.buttonAction,ACTION_TYPES),params=element.buttonParams&&typeof element.buttonParams==='object'&&!Array.isArray(element.buttonParams)?element.buttonParams:{};
  if(!fields)return '<p class="field-help">Saved Action retained. Choose a supported no-code Action to edit.</p>';
  return `<div data-hud-button-params>${fields.map(original=>{
    const field=hudButtonActionField(original,params);
    if(!field.type)return '<p class="field-help">Declare a Signal value type before editing its value.</p>';
    let markup=renderActionFieldInput({...field,implicitSelf:false,nullable:field.nullable===true},params[field.key]??(field.cameraShakeScalar?'':field.type==='number'?0:field.type==='checkbox'?false:''),'',params,null);
    // Retain unavailable references visibly instead of displaying an unrelated first option.
    if(params[field.key]&&markup.startsWith('<select')&&!markup.includes(`value="${escapeHtml(String(params[field.key]))}"`))markup=markup.replace('>',`><option value="${escapeHtml(String(params[field.key]))}" selected disabled>Unavailable saved reference</option>`);
    return `<label>${escapeHtml(field.label||field.key)}${markup}</label>`;
  }).join('')}<small data-hud-button-status>One click runs this Action. Object targets must be explicit.</small></div>`;
}
function hudTweenPreviewFieldsHTML(element) {
  if (!['moveHudTo','fadeHudTo','scaleHudTo'].includes(element.buttonAction)) return '';
  return '<label>Read-only tween preview<input type="range" min="0" max="100" value="0" data-hud-tween-preview></label><button class="toolbar-btn" type="button" data-hud-tween-reset>Reset preview</button><small>Scrub the selected HUD target; no gameplay Action runs. Play tweens use simulation time and freeze while paused.</small>';
}
function bindHudTweenPreviewControls(row, element) {
  const input = row.querySelector('[data-hud-tween-preview]');
  if (!input) return;
  input.disabled = playMode;
  input.addEventListener('input', () => {
    hudTweenPreview.clear();
    if (playMode || typeof OpusHudTweens === 'undefined') return;
    const params = element.buttonParams || {}, target = currentUiConfig.hudElements.find(record => record.id === params.hudId);
    if (!target) return;
    const channel = {moveHudTo:'move',fadeHudTo:'fade',scaleHudTo:'scale'}[element.buttonAction];
    const temporary = OpusHudTweens.create(easeValue);
    if (temporary.start('preview',target.id,channel,params,{offsetX:target.offsetX ?? 0,offsetY:target.offsetY ?? 0,opacity:1,scale:1})) {
      temporary.tick(Number(input.value)/100*params.duration);
      hudTweenPreview.set(target.id,temporary.presentation('preview',target.id));
    }
    renderHudAuthoringCanvas();
  });
  const reset = row.querySelector('[data-hud-tween-reset]');
  reset.disabled = playMode;
  reset.onclick = () => { if (playMode) return; hudTweenPreview.clear(); input.value = '0'; renderHudAuthoringCanvas(); };
}
function bindHudButtonActionControls(row,element) {
  if(element.kind!=='button'||typeof OpusHudButtonActions==='undefined')return;
  const fields=OpusHudButtonActions.fields(element.buttonAction,ACTION_TYPES);
  if(!fields)return;
  row.querySelectorAll('[data-hud-button-params] [data-field]').forEach(input=>{
    const descriptor=fields.find(field=>field.key===input.dataset.field);
    input.disabled=playMode||!!(descriptor?.cameraShakeScalar&&element.buttonParams?.preset&&element.buttonParams.preset!=='Custom');let recorded=false;
    input.addEventListener('focus',()=>{recorded=false;});input.addEventListener('blur',()=>{recorded=false;});
    input.addEventListener(input.tagName==='SELECT'||input.type==='checkbox'?'change':'input',()=>{
      if(playMode)return;
      const original=fields.find(field=>field.key===input.dataset.field);if(!original)return;
      const params=element.buttonParams&&typeof element.buttonParams==='object'&&!Array.isArray(element.buttonParams)?element.buttonParams:{};
      const result=original.cameraShakeScalar?{valid:true,value:readActionFieldValue(original,input)}:OpusHudButtonActions.parse({...hudButtonActionField(original,params),implicitSelf:false,nullable:original.nullable===true},input);
      const status=row.querySelector('[data-hud-button-status]');
      if(!result.valid||(input.tagName==='SELECT'&&input.selectedOptions[0]?.disabled)){if(status)status.textContent=result.reason||'Choose an available reference';return;}
      if(element.buttonAction==='cameraShake'&&!resolveCameraShakePolicy({...params,[original.key]:result.value})){if(status)status.textContent='Choose an available Camera preset and finite nonnegative Custom values.';return;}
      if(Object.is(params[original.key],result.value))return;
      if(!recorded||input.tagName==='SELECT'||input.type==='checkbox'){pushUndo();recorded=true;}
      element.buttonParams={...params,[original.key]:result.value};
      hudTweenPreview.clear();
      if(status)status.textContent='Saved · one click runs this Action';
      if(['signalId','valueType','targetId'].includes(original.key)||element.buttonAction==='cameraShake'&&original.key==='preset')renderHudElementList();else renderHudAuthoringCanvas();
    });
  });
}

function elementPromptLabel(element,result) { return element.promptText || result.actionLabel || 'Action'; }
function resolveHudActionPrompt(element, preview) {
  if (typeof OpusHudActionPrompts === 'undefined') return {available:false,reason:'Action prompts unavailable'};
  const action = element.prompt?.action;
  const labels=inputActionLabels(),bindings=Object.prototype.hasOwnProperty.call(labels,action)?{[action]:inputActionBinding(action,preview)}:{};
  let device='keyboard-mouse',deviceMapping=null;
  if(element.prompt?.deviceMode==='auto') {
    if(!preview&&playMode)device=app.input.lastDevice||'keyboard-mouse';
    const state=getInputDeviceMapping(action);
    if(state.ok)deviceMapping=state.record||OpusInputDeviceMappings.defaults(action);
  }
  return OpusHudActionPrompts.resolve(element.prompt,{labels,bindings,keyLabel:keyCodeToLabel,controllerType:currentPlayerSettings.controllerType,device,deviceMapping});
}
function hudActionPromptFieldsHTML(element) {
  if (element.kind !== 'actionPrompt') return '';
  const labels=inputActionLabels(),prompt=element.prompt, valid=prompt?.version===1&&Object.prototype.hasOwnProperty.call(labels,prompt.action);
  const choices=Object.entries(labels).map(([action,label])=>`<option value="${escapeHtml(action)}"${valid&&prompt.action===action?' selected':''}>${escapeHtml(action==='jump'&&currentPlayerSettings.controllerType==='hovercraft'?'Boost':label)}</option>`).join('');
  const result=resolveHudActionPrompt(element,true);
  const mode=prompt?.deviceMode??'keyboard-mouse';
  return `<label>Input Action<select data-hud-prompt-action>${valid?'':'<option value="__unavailable__" selected>Unavailable saved Action — choose replacement</option>'}${choices}</select></label><label>Presentation<select data-hud-prompt-presentation>${['keycap','text'].includes(prompt?.presentation)?'':'<option value="__unavailable__" selected>Unavailable saved presentation</option>'}<option value="keycap"${prompt?.presentation==='keycap'?' selected':''}>Keycap</option><option value="text"${prompt?.presentation==='text'?' selected':''}>Text</option></select></label><label>Binding display<select data-hud-prompt-device-mode>${['keyboard-mouse','auto'].includes(mode)?'':'<option value="__unavailable__" selected>Unavailable saved device policy — choose replacement</option>'}<option value="keyboard-mouse"${mode==='keyboard-mouse'?' selected':''}>Keyboard/mouse</option><option value="auto"${mode==='auto'?' selected':''}>Last used device</option></select></label><label>Prompt label<input data-hud-prompt-text value="${escapeHtml(element.promptText??'')}" placeholder="Use Action name"></label><p class="field-help" data-hud-prompt-status>${escapeHtml(result.available?'Preview · '+result.keyLabel+' · '+result.actionLabel:'Unavailable · '+result.reason)}. Preview uses authored keyboard/mouse defaults. Last used device follows actual gameplay input and configured gamepad/touch mappings; player rebinds update during Play.</p>`;
}
function bindHudActionPromptControls(row,element) {
  if (element.kind !== 'actionPrompt') return;
  const action=row.querySelector('[data-hud-prompt-action]'),presentation=row.querySelector('[data-hud-prompt-presentation]'),deviceMode=row.querySelector('[data-hud-prompt-device-mode]'),text=row.querySelector('[data-hud-prompt-text]');
  for(const input of [action,presentation,deviceMode,text]) input.disabled=playMode;
  const change=()=>{
    if(playMode||!Object.prototype.hasOwnProperty.call(inputActionLabels(),action.value)||!['keycap','text'].includes(presentation.value)||!['keyboard-mouse','auto'].includes(deviceMode.value))return;
    const next={...(element.prompt&&typeof element.prompt==='object'?element.prompt:{}),version:1,action:action.value,presentation:presentation.value};
    if(deviceMode.value==='auto'||Object.prototype.hasOwnProperty.call(next,'deviceMode'))next.deviceMode=deviceMode.value;
    if(JSON.stringify(element.prompt)===JSON.stringify(next))return;
    pushUndo();element.prompt=next;renderHudElementList();
  };
  action.onchange=change;presentation.onchange=change;deviceMode.onchange=change;
  let recorded=false;text.onfocus=()=>{recorded=false;};text.oninput=()=>{
    if(playMode||(element.promptText??'')===text.value)return;
    if(!recorded){pushUndo();recorded=true;}element.promptText=text.value;renderHudAuthoringCanvas();
  };
}
function renderHudElementList() {
  hudTweenPreview.clear();
  if (typeof renderHudTemplateLibrary === 'function') renderHudTemplateLibrary();
  if (currentUiConfig.hudElements.length && typeof OpusHudBindings !== 'undefined') refreshHudBindingCatalog();
  renderHudAuthoringCanvas();
  const listEl = document.getElementById('hud-element-list');
  if (currentUiConfig.hudElements.length === 0) {
    listEl.innerHTML = '<p class="onboarding-empty">No HUD Elements yet. Choose a type below and add one; Counter Display can show a gameplay counter.</p>';
    return;
  }
  listEl.innerHTML = currentUiConfig.hudElements.map((el) => `
    <div class="hud-element-row" data-hud-id="${escapeHtml(el.id)}">
      <div class="hud-element-row-header">
        <span>${HUD_KIND_LABELS[el.kind]}</span>
        <button class="hud-remove-btn" data-hud-remove="${escapeHtml(el.id)}" title="Remove">✕</button>
      </div>
      ${hudElementFieldsHTML(el)}
      ${hudWidgetFieldsHTML(el)}
      ${hudTweenPreviewFieldsHTML(el)}
      ${typeof OpusHudBindings === 'undefined' ? '' : hudBindingFieldsHTML(el)}
      ${typeof OpusHudActionPrompts === 'undefined' ? '' : hudActionPromptFieldsHTML(el)}
    </div>
  `).join('');
  listEl.querySelectorAll('[data-hud-remove]').forEach((btn) => {
    btn.onclick = () => {
      if (playMode) return;
      pushUndo();
      currentUiConfig.hudElements = currentUiConfig.hudElements.filter((el) => String(el.id) !== btn.dataset.hudRemove);
      renderHudElementList();
    };
  });
  listEl.querySelectorAll('.hud-element-row').forEach((row) => {
    const el = currentUiConfig.hudElements.find((e) => String(e.id) === row.dataset.hudId);
    if (typeof OpusHudBindings !== 'undefined') bindHudBindingControls(row, el);
    if (typeof OpusHudActionPrompts !== 'undefined') bindHudActionPromptControls(row, el);
    bindHudButtonActionControls(row,el);
    bindHudWidgetControls(row,el);
    bindHudTweenPreviewControls(row,el);
    row.querySelectorAll('[data-hud-field]').forEach((input) => {
      let recorded = false;
      input.addEventListener('focus', () => { recorded = false; });
      const handler = () => {
        if (playMode) return;
        const key = input.dataset.hudField;
        const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
        if (input.type === 'number' && (!input.value.trim() || !Number.isFinite(value)
          || (['offsetX','offsetY'].includes(key) ? false : ['minWidth','maxWidth'].includes(key) ? value < 0 : value <= 0)
          || (key === 'widthPercent' && (value < 1 || value > 100)))) return;
        if (el[key] === value) return;
        if (!recorded || input.tagName === 'SELECT' || input.type === 'checkbox') { pushUndo(); recorded = true; }
        el[key] = value;
        if(key==='buttonAction'){hudTweenPreview.clear();renderHudElementList();return;}
        renderHudAuthoringCanvas();
      };
      input.addEventListener(input.tagName === 'SELECT' || input.type === 'checkbox' ? 'change' : 'input', handler);
    });
  });
}
document.getElementById('hud-add-btn').addEventListener('click', () => {
  if (playMode) return;
  const kind = document.getElementById('hud-add-kind').value;
  pushUndo();
  const element={ id: generateHudElementId(), kind, anchor: 'top-left', offsetX: 0, offsetY: 0, text: '', visible: true, buttonAction: 'message', panelWidth: 120, panelHeight: 60 };
  if(kind==='actionPrompt'){element.prompt={version:1,action:'interact',presentation:'keycap'};element.promptText='';}
  if (['inventoryWidget','objectiveWidget','dialogueWidget'].includes(kind)) element.widget = {version:1,maxEntries:6};
  currentUiConfig.hudElements.push(element);
  renderHudElementList();
});

function createHudElementAt(payload, x, y, viewport) {
  viewport = viewport || {width:1280,height:720};
  if (playMode || !payload || !['label', 'image', 'health', 'panel','inventoryWidget','objectiveWidget','dialogueWidget'].includes(payload.kind) || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > viewport.width || y < 0 || y > viewport.height) return null;
  if (payload.kind === 'image' && !findTextureAssetById(payload.assetId)) return null;
  pushUndo();
  const element = { id: generateHudElementId(), kind: payload.kind, anchor: 'top-left', offsetX: Math.round(x) - 12, offsetY: Math.round(y) - 12, visible: true };
  if (viewport.safeInsets) { element.offsetX -= viewport.safeInsets.left; element.offsetY -= viewport.safeInsets.top; }
  if (payload.kind === 'label') element.text = 'Text Label';
  if (['inventoryWidget','objectiveWidget','dialogueWidget'].includes(payload.kind)) element.widget = {version:1,maxEntries:6};
  if (payload.kind === 'panel') { element.panelWidth = 160; element.panelHeight = 100; }
  if (payload.kind === 'image') { element.textureAssetId = payload.assetId; element.imageWidth = 128; element.imageHeight = 128; element.description = findTextureAssetById(payload.assetId).name || 'Image'; }
  currentUiConfig.hudElements.push(element);
  renderHudElementList();
  hudAuthoringCanvas?.select(element.id);
  return element;
}
function renderHudAuthoringCanvas() {
  if (typeof OpusHudCanvas === 'undefined') return;
  const host = document.getElementById('hud-canvas-editor');
  if (!host) return;
  renderHudLayoutControls(host);
  const readability = document.getElementById('hud-readability-results');
  if (readability) readability.textContent = 'Preview changed. Check readability again; previous measurements are not retained.';
  if (!hudAuthoringCanvas) hudAuthoringCanvas = OpusHudCanvas.mount(host, {
    getElements: () => currentUiConfig.hudElements,
    getImageAssets: () => textureAssets.map(asset => ({ id: asset.id, name: asset.name })),
    onCreate: (payload, x, y, viewport) => createHudElementAt(payload, x, y, {...viewport,safeInsets:hudSafeInsets(viewport)}),
    renderMarkup: elements => renderHudLayer(true, elements),
    onAfterRender: (stage, viewport) => applyHudLayout(stage, viewport),
    getSafeInsets: viewport => hudSafeInsets(viewport),
    isEditable: () => !playMode,
    onSelect: id => {
      document.querySelectorAll('.hud-element-row').forEach(row => row.classList.toggle('hud-row-selected', row.dataset.hudId === id));
    },
    onCommitMove: (id, dx, dy) => {
      const element = currentUiConfig.hudElements.find(el => el.id === id);
      if (playMode || !element || !Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
      pushUndo();
      element.offsetX = (Number(element.offsetX) || 0) + dx;
      element.offsetY = (Number(element.offsetY) || 0) + dy;
      renderHudElementList();
    },
    onDelete: id => {
      if (playMode || !currentUiConfig.hudElements.some(el => el.id === id)) return;
      pushUndo(); currentUiConfig.hudElements = currentUiConfig.hudElements.filter(el => el.id !== id); renderHudElementList();
    },
  });
  hudAuthoringCanvas.render();
}

function renderHudLayoutControls(host) {
  let controls = document.getElementById('hud-layout-controls');
  if (!controls) {
    controls = document.createElement('div'); controls.id = 'hud-layout-controls';
    controls.innerHTML = '<label><input id="hud-safe-area" type="checkbox"> Respect safe areas</label><label>Safe padding (px)<input id="hud-safe-padding" type="number" min="0" value="16"></label><p class="field-help">Opt in to device safe insets plus this padding. Existing layouts stay fixed by default. Keep Inside prevents offscreen elements; percent widths adapt Panels and Images.</p>';
    host.before(controls);
    const refresh = document.createElement('button'); refresh.type='button'; refresh.className='toolbar-btn'; refresh.id='hud-refresh-binding-sources'; refresh.textContent='Refresh binding sources';
    refresh.onclick = () => {if (!playMode) renderHudElementList();}; controls.append(refresh);
    const check = document.createElement('button'); check.type='button'; check.className='toolbar-btn'; check.id='hud-check-readability'; check.textContent='Check preview readability';
    check.onclick = inspectHudPreviewReadability; controls.append(check);
    const results = document.createElement('div'); results.id='hud-readability-results'; results.setAttribute('aria-live','polite'); controls.append(results);
    for (const input of controls.querySelectorAll('input')) {
      let recorded = false;
      input.onfocus = () => { recorded = false; };
      const change = () => {
        if (playMode) return;
        const key = input.type === 'checkbox' ? 'safeArea' : 'padding';
        const value = input.type === 'checkbox' ? input.checked : Number(input.value);
        if (input.type !== 'checkbox' && (!input.value.trim() || !Number.isFinite(value) || value < 0)) return;
        const previous = currentUiConfig.hudLayout || {};
        if ((previous[key] ?? (key === 'safeArea' ? false : 16)) === value) return;
        if (!recorded || input.type === 'checkbox') { pushUndo(); recorded = true; }
        currentUiConfig.hudLayout = {...previous, [key]:value}; renderHudAuthoringCanvas();
      };
      input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', change);
    }
  }
  const policy = currentUiConfig.hudLayout || {};
  controls.querySelector('#hud-safe-area').checked = policy.safeArea === true;
  const padding = controls.querySelector('#hud-safe-padding');
  if (document.activeElement !== padding) padding.value = Number.isFinite(policy.padding) ? policy.padding : 16;
  controls.querySelectorAll('input').forEach(input => {input.disabled = playMode;});
  controls.querySelector('#hud-check-readability').disabled = playMode;
}

// Advisory observation of the existing authored preview, never part of pure
// project validation or export refusal. No repair is applied by this report.
function inspectHudPreviewReadability() {
  const host = document.getElementById('hud-readability-results');
  if (!host) return;
  host.replaceChildren();
  const line = text => {const p=document.createElement('p');p.className='field-help';p.style.overflowWrap='anywhere';p.textContent=text;host.append(p);return p;};
  if (playMode) {line('Stop Play before checking the authored HUD preview.');return;}
  const report = hudAuthoringCanvas?.inspectReadability?.();
  if (!report || !report.available) {line('Preview measurement unavailable. '+(report?.reason||'Open the HUD canvas, then check again.')+' No readability verdict was made.');return;}
  const config=currentUiConfig, level=levels[currentLevelIndex], root=levels, signature=JSON.stringify(config);
  line(`HUD preview ${report.viewport.width} × ${report.viewport.height}: ${report.issues.length} advisory observation(s). This is not an accessibility certification or export blocker.`);
  line('Only this authored preview is measured. Check other preview sizes and actual Play. Dynamic text, menus/dialogue states, transparent backgrounds and contrast are not verified. Hidden elements are excluded. Narrow wrapping can remain even when Keep Inside fits the bounds.');
  if(report.truncated) line('Only the first 256 authored HUD records were inspected; remaining records are not assessed.');
  const unavailable=(report.entries||[]).filter(entry=>entry.status==='unavailable'||entry.textStatus==='unavailable');
  if(unavailable.length) line(`${unavailable.length} owner(s) have unavailable measurements; no passing verdict was made for them. ${unavailable.slice(0,3).map(entry=>entry.reason||entry.textReason).join(' ')}`);
  if (!report.issues.length) line('No measured bounds or text-overflow issue in this preview; this does not prove readability.');
  for (const issue of report.issues.slice(0,30)) {
    const owner=config.hudElements.find(el=>String(el.id)===String(issue.id));
    const row=line(`${String(owner?.text||owner?.kind||'HUD').slice(0,80)} [${String(issue.id).slice(0,80)}]: ${String(issue.message)}`);
    const open=document.createElement('button');open.type='button';open.className='toolbar-btn';open.textContent='Review HUD controls';
    open.onclick=()=>{
      if(playMode||levels!==root||levels[currentLevelIndex]!==level||currentUiConfig!==config||JSON.stringify(config)!==signature){line('This preview report is stale or Play is active. Stop Play and check again. No project changes made.');return;}
      const current=hudAuthoringCanvas?.inspectReadability?.();
      if(!current?.available||current.viewport.width!==report.viewport.width||current.viewport.height!==report.viewport.height){line('The preview size or measurement availability changed. Check again. No project changes made.');return;}
      const matches=config.hudElements.filter(el=>String(el.id)===String(issue.id));
      if(matches.length!==1){line('The measured HUD owner is unavailable or ambiguous. Check again.');return;}
      const rows=Array.from(document.querySelectorAll('#hud-element-list [data-hud-id]')).filter(node=>node.dataset.hudId===String(issue.id));
      if(rows.length!==1){line('Open the HUD controls and check again.');return;}
      hudAuthoringCanvas.setSelection(issue.id);rows[0].scrollIntoView({block:'nearest'});
      rows[0].querySelector('[data-hud-field="offsetX"]')?.focus({preventScroll:true});
    };
    row.append(open);
  }
  if(report.issues.length>30) line(`${report.issues.length-30} more observations. Repair and check again.`);
}

// One bounded CSS env probe, not an authoring record or gameplay element.
function hudDeviceInsets() {
  let probe = document.getElementById('hud-safe-inset-probe');
  if (!probe) {
    probe = document.createElement('div'); probe.id = 'hud-safe-inset-probe'; probe.setAttribute('aria-hidden','true');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.append(probe);
  }
  const style = getComputedStyle(probe);
  return {top:parseFloat(style.paddingTop)||0,right:parseFloat(style.paddingRight)||0,bottom:parseFloat(style.paddingBottom)||0,left:parseFloat(style.paddingLeft)||0};
}
function hudSafeInsets(viewport) {
  const policy = currentUiConfig.hudLayout || {};
  if (policy.safeArea !== true) return null;
  const device = hudDeviceInsets(), padding = Number.isFinite(policy.padding) && policy.padding >= 0 ? policy.padding : 16;
  return Object.fromEntries(['left','right','top','bottom'].map(edge => [edge,Math.min(padding+device[edge],Math.max(0,((edge==='left'||edge==='right'?viewport.width:viewport.height)-1)/2))]));
}
function applyHudLayout(layer, viewport = {width:layer.clientWidth,height:layer.clientHeight}, uiConfig = currentUiConfig, includeTween = true) {
  if (typeof OpusHudLayout === 'undefined') return;
  const policy = uiConfig.hudLayout || {}, insets = policy.safeArea === true ? hudDeviceInsets() : {};
  for (const node of Array.from(layer.children)) {
    const authoredElement = uiConfig.hudElements.find(record => String(record.id) === node.dataset.hudId);
    const presentation = includeTween && typeof hudTweenPresentation === 'function' ? hudTweenPresentation(node.dataset.hudId,layer.classList.contains('hud-canvas-stage')) : null;
    const element = authoredElement && presentation ? {...authoredElement,offsetX:presentation.offsetX,offsetY:presentation.offsetY} : authoredElement;
    if (!element) continue;
    // Historical text max-width uses vw. Opted-in preview must instead use its
    // canonical device/container width, including when the editor is wider.
    if ((policy.safeArea === true || element.keepInside === true || element.widthMode === 'percent')
      && ['label','objective','counter','timer'].includes(element.kind)) node.style.maxWidth = Math.min(440,viewport.width*.42)+'px';
    let bounds = OpusHudLayout.resolve(element,viewport,policy,{width:node.offsetWidth,height:node.offsetHeight},insets);
    if (!bounds) continue; // No migration of historical fixed layouts.
    Object.assign(node.style,{boxSizing:'border-box',right:'auto',bottom:'auto',marginLeft:'0px',marginTop:'0px',transform:'none',width:bounds.width+'px'});
    // Width constraints can wrap text; position using the actual resulting height.
    if (!['image','panel'].includes(element.kind)) bounds = OpusHudLayout.resolve(element,viewport,policy,{width:node.offsetWidth,height:node.offsetHeight},insets);
    if (!bounds) continue;
    Object.assign(node.style,{left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px'});
  }
}

// Wave 6B (Priority E): Sequence Editor -- a simple LIST UI, deliberately
// not a timeline. Rebuilds the step list from `currentSequences` on every
// change (add/remove/reorder/edit), same "small enough to just re-render"
// approach the HUD element list above already uses. Per-step fields reuse
// `renderActionFieldInput` directly -- the exact same field renderer the
// fixed-dropdown Add Behavior UI and the Node Graph node UI already share,
// so a new field TYPE still only needs handling written once anywhere in
// this file.
// Wave 7 (Priority F): the Objectives editor -- same "build the DOM in JS,
// wire handlers after" list pattern every other Wave 7 list editor already
// established. Each row: Title, optional Description, and an optional
// Next Objective (a simple linear chain -- auto-activates on Complete, per
// the spec's own explicit bound on how far chaining should go).
function renderQuestFlowPanel() {
  const panel=document.getElementById('quest-flow-panel');if(!panel)return;
  const levelIndex=currentLevelIndex,level=levels[levelIndex],definitions=currentObjectiveDefs,objects=placed;
  const valid=d=>d&&typeof d.id==='string'&&d.id&&!['__proto__','constructor','prototype'].includes(d.id)&&(d.version===undefined||d.version===1)&&definitions.filter(x=>x?.id===d.id).length===1;
  const choices=Array.isArray(definitions)?definitions.filter(valid):[];
  const owners=objects.filter(o=>o&&typeof o.id==='string'&&o.id&&objects.filter(x=>x?.id===o.id).length===1);
  const current=()=>!playMode&&currentLevelIndex===levelIndex&&levels[levelIndex]===level&&currentObjectiveDefs===definitions&&placed===objects;
  const links=collectEditorReferenceUses({levels:[{id:level?.id,objects}]}).filter(use=>use.referenceType==='objective'&&use.referenceValue);
  const callers=links.map(use=>{const owner=owners.find(o=>o.id===use.objectId);const behavior=owner?.behaviors?.find(b=>b?.params===use.owner||b?.graph?.nodes?.includes(use.owner));const target=choices.find(d=>d.id===use.referenceValue);return {owner,behavior,target,use};});
  panel.innerHTML='<h4>Quest-lite flow</h4><p class="field-help">Start a named Objective or choose a conditional route using ordinary editable Graphs. Progress display never completes a step automatically. Item turn-in is also available in Graph Templates.</p><label>Logic owner<select id="quest-flow-owner" class="field-input"><option value="">Choose placed Object</option>'+owners.map(o=>'<option value="'+escapeHtml(o.id)+'">'+escapeHtml(o.name||o.kind||'Object')+'</option>').join('')+'</select></label><label>Objective<select id="quest-flow-source" class="field-input"><option value="">Choose named Objective</option>'+choices.map(d=>'<option value="'+escapeHtml(d.id)+'">'+escapeHtml(d.title||'Untitled Objective')+'</option>').join('')+'</select></label><button id="quest-flow-start" type="button" class="toolbar-btn">Set up initial activation</button><button id="quest-flow-branch" type="button" class="toolbar-btn">Compose named route</button><p class="field-help">Setup opens a draft, not a hidden runtime. Save Graph adds this explicit Event to the chosen owner; Cancel changes nothing.</p><div aria-label="Objective logic callers">'+(callers.length?callers.map((entry,i)=>'<p>'+escapeHtml(entry.target?.title||'Unavailable saved Objective')+' · '+escapeHtml(entry.owner?.name||entry.owner?.kind||'Unavailable owner')+' · '+escapeHtml(entry.behavior?.trigger||'Nested caller')+' / '+escapeHtml(entry.use.owner.type||entry.behavior?.action||'Reference')+(entry.owner&&entry.behavior?'<button type="button" data-quest-caller="'+i+'">Open logic</button>':'')+'</p>').join(''):'<p>No placed Objective callers yet. Set up initial activation first.</p>')+'</div>';
  const setup=(recipe,trigger)=>{if(!current())return;const owner=owners.find(o=>o.id===panel.querySelector('#quest-flow-owner').value),objective=choices.find(d=>d.id===panel.querySelector('#quest-flow-source').value);if(!owner||!objects.includes(owner)||objects.filter(o=>o?.id===owner.id).length!==1||!objective||!definitions.includes(objective)||!valid(objective)){showStatus('Choose an available named owner and Objective. No project changes made.');return;}selectItem(owner);openGraphEditor(owner,null,trigger);if(!graphEditorState)return;graphEditorState.templateChoice=recipe;graphEditorState.questFlowChoices={sourceId:objective.id,yesId:'',noId:'',itemId:'',quantity:1};renderGraphTemplates();};
  panel.querySelector('#quest-flow-start').onclick=()=>setup('quest-start','start');
  panel.querySelector('#quest-flow-branch').onclick=()=>setup('quest-item-branch','interact');
  panel.querySelectorAll('[data-quest-caller]').forEach(button=>{const entry=callers[Number(button.dataset.questCaller)];button.onclick=()=>{if(!current()||!entry?.owner||!objects.includes(entry.owner)||!entry.owner.behaviors?.includes(entry.behavior))return;selectItem(entry.owner);if(entry.behavior.action==='graph')openGraphEditor(entry.owner,entry.behavior);};});
  if(playMode)panel.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
}
function renderObjectiveDefPanel() {
  renderQuestFlowPanel();
  const listEl = document.getElementById('objective-def-list');
  if (!listEl) return;
  if (!Array.isArray(currentObjectiveDefs)) { listEl.innerHTML='<p>Unavailable saved Objective list retained. Restore valid data to edit it.</p>'; return; }
  const definitions=currentObjectiveDefs, levelIndex=currentLevelIndex, level=levels[levelIndex];
  const available=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&typeof o.id==='string'&&!!o.id&&(o.version===undefined||o.version===1)&&definitions.filter(d=>d?.id===o.id).length===1;
  const choices=definitions.filter(available);
  const owns=o=>!playMode&&currentLevelIndex===levelIndex&&levels[levelIndex]===level&&currentObjectiveDefs===definitions&&definitions.includes(o)&&available(o);
  const label=o=>typeof o?.title==='string'&&o.title?o.title:'Untitled Objective';
  const destination=o=>{const found=choices.find(d=>d.id===o.nextObjective);return found?label(found):o.nextObjective?'Unavailable saved Objective':'End of chain';};
  const inventoryItems=typeof currentItemDefs==='undefined'?[]:currentItemDefs.filter(d=>d&&typeof d.id==='string'&&currentItemDefs.filter(x=>x?.id===d.id).length===1);
  const itemAvailable=id=>typeof currentItemDefs!=='undefined'&&currentItemDefs.filter(d=>d?.id===id).length===1;
  const map='<div class="objective-chain-map" role="list" aria-label="Objective chain overview">'+choices.map(o=>'<div role="listitem"><strong>'+escapeHtml(label(o))+'</strong><span aria-hidden="true"> → </span><span>'+escapeHtml(destination(o))+'</span></div>').join('')+'</div>';
  listEl.innerHTML='<p class="field-help">Linear chains use the existing Objective Actions. Activate the first Objective from a visual event; completing it activates its named next Objective. Progress reads existing counters or Items; it does not automatically complete an Objective.</p>'+map+
    (definitions.length===0?'<p>No objectives yet — add one below.</p>':definitions.map((o,i)=>{
      if(!available(o))return '<div class="objective-unavailable" role="status">Unavailable or ambiguous saved Objective '+(i+1)+' retained. Restore valid data to edit it.</div>';
      const progress=o.progress,progressValid=progress===undefined||!!progress&&typeof progress==='object'&&!Array.isArray(progress);
      const type=progressValid?progress?.type||'':'',key=progressValid?progress?.key||'':'';
      const keyField=type==='inventory'?'<select class="field-input" data-objdef-progkey="'+i+'" aria-label="Progress Item"><option value="">Choose named Item</option>'+inventoryItems.map(d=>'<option value="'+escapeHtml(d.id)+'"'+(key===d.id?' selected':'')+'>'+escapeHtml(d.name||'Unnamed Item')+'</option>').join('')+(key&&!inventoryItems.some(d=>d.id===key)?'<option selected disabled value="'+escapeHtml(String(key))+'">Unavailable or legacy saved Item key — retained</option>':'')+'</select>':'<input class="field-input" type="text" data-objdef-progkey="'+i+'" value="'+escapeHtml(String(key))+'" placeholder="Counter name" aria-label="Progress counter">';
      return '<div class="hud-element-row" data-objdef-index="'+i+'"><div class="hud-element-row-header"><strong>'+escapeHtml(label(o))+'</strong><button data-objdef-remove="'+i+'" class="hud-remove-btn" title="Remove Objective">✕</button></div>'+
        '<label>Title<input class="field-input" type="text" data-objdef-title="'+i+'" value="'+escapeHtml(typeof o.title==='string'?o.title:'')+'" placeholder="e.g. Find the weapon"></label>'+
        '<label>Description<input class="field-input" type="text" data-objdef-desc="'+i+'" value="'+escapeHtml(typeof o.description==='string'?o.description:'')+'" placeholder="Optional instructions"></label>'+
        '<label>Next Objective<select class="field-input" data-objdef-next="'+i+'" aria-label="'+escapeHtml(label(o))+' next Objective"><option value="">End of chain</option>'+choices.filter(d=>d!==o).map(d=>'<option value="'+escapeHtml(d.id)+'"'+(o.nextObjective===d.id?' selected':'')+'>'+escapeHtml(label(d))+'</option>').join('')+(o.nextObjective&&!choices.some(d=>d!==o&&d.id===o.nextObjective)?'<option selected disabled value="'+escapeHtml(String(o.nextObjective))+'">Unavailable or self saved link — retained</option>':'')+'</select></label>'+
        '<fieldset'+(!progressValid?' disabled':'')+'><legend>Optional progress display</legend><label>Source<select class="field-input" data-objdef-progtype="'+i+'"><option value="">No progress</option><option value="counter"'+(type==='counter'?' selected':'')+'>Counter</option><option value="inventory"'+(type==='inventory'?' selected':'')+'>Named Inventory Item</option>'+(type&&!['counter','inventory'].includes(type)?'<option selected disabled value="'+escapeHtml(String(type))+'">Unavailable saved progress type</option>':'')+'</select></label>'+keyField+'<label>Target<input class="field-input" type="number" data-objdef-progtarget="'+i+'" value="'+escapeHtml(String(progressValid?(progress?.target??''):''))+'" placeholder="Optional target"></label></fieldset>'+
        '<details><summary>Signals on state changes (optional)</summary><p class="field-help">Send once per state change. No-value Signals use the Action owner; automatic next activation keeps that owner.</p>'+['active','complete','failed'].map(state=>{const reference=o.signals?.[state],valid=signalDefinitions.slice(0,128).filter(d=>OpusSignals.find(signalDefinitions,d?.id)&&OpusSignals.payloadType(d)==='none');return '<label>'+({active:'When activated',complete:'When completed',failed:'When failed'})[state]+'<select class="field-input" data-objdef-signal="'+i+'" data-objective-state="'+state+'"><option value="">No notification</option>'+valid.map(d=>'<option value="'+escapeHtml(d.id)+'"'+(reference===d.id?' selected':'')+'>'+escapeHtml(d.name)+'</option>').join('')+(reference&&!valid.some(d=>d.id===reference)?'<option selected disabled value="'+escapeHtml(String(reference))+'">Unavailable or requires no-value Signal — retained</option>':'')+'</select></label>';}).join('')+'</details></div>';
    }).join(''));
  const bind=(selector,key,read,write,event='input',validate=()=>true)=>listEl.querySelectorAll(selector).forEach(input=>{
    const o=definitions[Number(input.dataset[key])];
    bindLevelLogicHistory(input,()=>read(o),()=>input.value,value=>write(o,value),event,value=>owns(o)&&validate(value,o));
  });
  listEl.querySelectorAll('[data-objdef-remove]').forEach(btn=>{const o=definitions[Number(btn.dataset.objdefRemove)];btn.onclick=()=>{if(!owns(o))return;pushUndo();definitions.splice(definitions.indexOf(o),1);renderObjectiveDefPanel();};});
  bind('[data-objdef-title]','objdefTitle',o=>o.title,(o,value)=>{o.title=value;});
  bind('[data-objdef-desc]','objdefDesc',o=>o.description,(o,value)=>{o.description=value;});
  // Refresh linked names after committing text, without tearing down a focused field.
  listEl.querySelectorAll('[data-objdef-title]').forEach(input=>{const o=definitions[Number(input.dataset.objdefTitle)];input.addEventListener('change',()=>{if(owns(o))renderObjectiveDefPanel();});});
  listEl.querySelectorAll('[data-objdef-next]').forEach(sel=>{const o=definitions[Number(sel.dataset.objdefNext)];sel.onchange=()=>{
    const value=sel.value||undefined;if(!owns(o)||Object.is(o.nextObjective||undefined,value)||value&&!choices.some(d=>definitions.includes(d)&&available(d)&&d!==o&&d.id===value))return;
    pushUndo();o.nextObjective=value;renderObjectiveDefPanel();
  };});
  listEl.querySelectorAll('[data-objdef-progtype]').forEach(sel=>{const o=definitions[Number(sel.dataset.objdefProgtype)];sel.onchange=()=>{
    if(!owns(o)||!['','counter','inventory'].includes(sel.value)||o.progress!==undefined&&(!o.progress||typeof o.progress!=='object'||Array.isArray(o.progress))||(o.progress?.type||'')===sel.value)return;
    pushUndo();o.progress=sel.value?{...o.progress,type:sel.value,key:o.progress?.key??'',target:o.progress?.target??0}:undefined;renderObjectiveDefPanel();
  };});
  listEl.querySelectorAll('[data-objdef-progkey]').forEach(input=>{const o=definitions[Number(input.dataset.objdefProgkey)];if(!o?.progress||typeof o.progress!=='object'||Array.isArray(o.progress)){input.disabled=true;return;}
    bindLevelLogicHistory(input,()=>o.progress.key,()=>input.value,value=>{o.progress.key=value;},o.progress.type==='inventory'?'change':'input',value=>owns(o)&&(o.progress.type!=='inventory'||!value||itemAvailable(value)));
  });
  listEl.querySelectorAll('[data-objdef-progtarget]').forEach(input=>{const o=definitions[Number(input.dataset.objdefProgtarget)];if(!o?.progress||typeof o.progress!=='object'||Array.isArray(o.progress)){input.disabled=true;return;}
    bindLevelLogicHistory(input,()=>o.progress.target,()=>input.value.trim()===''?undefined:input.valueAsNumber,value=>{o.progress.target=value;},'input',value=>owns(o)&&(value===undefined||Number.isFinite(value)&&value>=0));
  });
  listEl.querySelectorAll('[data-objdef-signal]').forEach(input=>{const o=definitions[Number(input.dataset.objdefSignal)],state=input.dataset.objectiveState;
    if(o.signals!==undefined&&(!o.signals||typeof o.signals!=='object'||Array.isArray(o.signals))){input.disabled=true;return;}
    bindLevelLogicHistory(input,()=>o.signals?.[state]||'',()=>input.value,value=>{if(value){o.signals=o.signals||{};o.signals[state]=value;}else if(o.signals)delete o.signals[state];},'change',value=>owns(o)&&(!value||!!OpusSignals.find(signalDefinitions,value)&&OpusSignals.payloadType(OpusSignals.find(signalDefinitions,value))==='none'));
  });
  if(playMode)listEl.querySelectorAll('input,select,button').forEach(control=>control.disabled=true);
  const addBtn=document.getElementById('objective-def-add-btn');
  if(addBtn){addBtn.disabled=playMode;addBtn.onclick=()=>{if(playMode||currentLevelIndex!==levelIndex||levels[levelIndex]!==level||currentObjectiveDefs!==definitions)return;pushUndo();definitions.push({id:generateObjectiveDefId(),title:'Objective '+(definitions.length+1),description:'',nextObjective:undefined});renderObjectiveDefPanel();};}
}
// Wave 7 (Priority G/H): populates the Scatter source dropdowns (Prefab
// list + skinned/plain-mesh Asset list) -- called whenever the Level tab
// section renders, same lazy-populate pattern other dropdowns already use.
function renderScatterPanel() {
  const prefabSel = document.getElementById('scatter-prefab');
  const assetSel = document.getElementById('scatter-asset');
  if (!prefabSel || !assetSel) return;
  prefabSel.innerHTML = '<option value="">(none)</option>' + prefabs.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');
  assetSel.innerHTML = '<option value="">(none)</option>' + assets.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
}
