// Runtime rendering -- rebuilt (not just updated) every play-mode frame
// from currentUiConfig.hudElements, since the authoring list itself can
// change live (add/remove) while iterating on a game. Bindings resolve
// against the same window.__gameState/__gameTimers/health every other
// Wave-2 system already reads, so a HUD label and a Node Graph condition
// can reference the exact same counter with no separate wiring.
function resolveHudBindingText(template, value) {
  return String(template || '').replace('{value}', value != null ? String(value) : '0');
}
// Wave 6B (Priority G): binding-aware HUD prompts -- `{bind:actionName}`
// resolves to the CURRENT effective binding's readable label (reusing the
// exact same `keyCodeToLabel` the Controls/rebind panel already uses, so a
// rebound key shows correctly here too -- e.g. authored "[{bind:interact}]
// Open Door" reads "[E] Open Door" by default, or "[Mouse 2] Open Door"
// once rebound, with zero icon art needed). Touch deliberately never shows
// a keyboard/mouse binding at all (there isn't one to show) -- it always
// reads a generic "Interact"/"Attack"/etc. label instead, per this
// priority's own explicit touch-prompt requirement. A referenced action
// name that doesn't exist in INPUT_ACTION_LABELS is left as literal text
// (`{bind:notReal}`) rather than silently vanishing, so an author notices
// the typo instead of shipping a blank prompt.
// Wave 7 (Priority F/Section 44): the current active objective's own
// title -- the FIRST objective def whose window.__gameObjectives state is
// 'active' (authored order), or '' if none is active. Bounded: no attempt
// to show multiple simultaneously-active objectives at once.
function currentActiveObjectiveTitle() {
  if (!window.__gameObjectives) return '';
  const def = currentObjectiveDefs.find((o) => o?.id && window.__gameObjectives[o.id] === 'active');
  return def ? def.title : '';
}
// Wave 9 (Priority A/Section 25): Ammo HUD via binding tokens -- reuses the
// exact same `{name}` HUD label mechanism every other counter already
// binds through, rather than a dedicated Ammo Display element type.
// `{ammo}`/`{reserveAmmo}` read the CURRENT active weapon's own runtime
// state (Infinite-ammo weapons show 'INF' rather than a bare 0, so an
// author's HUD doesn't misleadingly imply an empty gun); `{weaponName}`
// resolves the active Equipment slot's item name in Equipment Weapon mode,
// or the Fixed Weapon's own authored label otherwise.
function resolveWeaponHudTokens(text) {
  if (!/\{(ammo|reserveAmmo|weaponName)\}/.test(text)) return text;
  const weapon = resolveActivePlayerWeapon();
  let ammoStr = 'INF', reserveStr = '', nameStr = '';
  if (weapon) {
    if ((weapon.ammoMode || 'infinite') === 'magazine') {
      const rt = ensureWeaponRuntime(weapon);
      ammoStr = String(rt.magazine);
      reserveStr = String(rt.reserve);
    }
    const settingsWeapon = currentPlayerSettings.weapon;
    if (settingsWeapon && settingsWeapon.source === 'equipment') {
      const eq = playerEquipment[activeWeaponSlot];
      nameStr = eq ? eq.itemName : '(none)';
    } else {
      nameStr = 'Weapon';
    }
  }
  return text.replace(/\{ammo\}/g, ammoStr).replace(/\{reserveAmmo\}/g, reserveStr).replace(/\{weaponName\}/g, nameStr);
}
function resolveHudBindText(text) {
  return resolveWeaponHudTokens(String(text || '').replace(/\{bind:(\w+)\}/g, (whole, action) => {
    if (!INPUT_ACTION_LABELS[action]) return whole;
    if (isTouchDevice) return INPUT_ACTION_LABELS[action];
    return keyCodeToLabel(effectiveInputMap[action]);
  }).replace(/\{activeObjective\}/g, () => currentActiveObjectiveTitle()));
}
function renderHudWidget(element, preview) {
  if (typeof OpusHudWidgets === 'undefined') return escapeHtml('Unavailable widget runtime');
  const config = element.widget;
  let result;
  if (element.kind === 'inventoryWidget') result = OpusHudWidgets.inventory(config, preview
    ? {inventory:{sample:2},itemDefs:[{id:'sample',name:'Sample item'}],equipment:{}}
    : {inventory:window.__gameInventory,itemDefs:currentItemDefs,equipment:playerEquipment});
  else if (element.kind === 'objectiveWidget') result = OpusHudWidgets.objectives(config, preview
    ? {objectiveDefs:[{id:'sample',title:'Sample objective'}],objectiveStates:{sample:'active'}}
    : {objectiveDefs:currentObjectiveDefs,objectiveStates:window.__gameObjectives,game:window.__gameState,inventory:window.__gameInventory});
  else result = OpusHudWidgets.dialogue(config, {dialogue:preview
    ? {active:true,generation:0,speaker:'Sample speaker',text:'Dialogue appears here during Play.',choices:[{id:'sample',label:'Sample choice'}]}
    : dialoguePresentation});
  if (!result.available) return `<p>${escapeHtml(result.reason)}</p>`;
  const heading = `<strong>${escapeHtml(result.title)}</strong>`;
  if (element.kind === 'dialogueWidget') return heading + (result.active
    ? `<p><strong>${escapeHtml(result.speaker)}</strong></p><p style="white-space:pre-wrap">${escapeHtml(result.text)}</p>${result.choices.map(choice => `<button data-hud-dialogue-choice="${escapeHtml(choice.id)}" data-dialogue-generation="${result.generation}"${preview ? ' disabled' : ''}>${escapeHtml(choice.label)}</button>`).join('')}`
    : `<p>${escapeHtml(result.emptyText)}</p>`);
  return heading + (result.rows.length ? `<ul style="margin:8px 0;padding-left:20px">${result.rows.map(row => {
    if (element.kind === 'inventoryWidget') {
      const asset = row.iconTextureAssetId && findTextureAssetById(row.iconTextureAssetId);
      const icon = asset && typeof asset.dataURL === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(asset.dataURL)
        ? `<img src="${escapeHtml(asset.dataURL)}" alt="" style="width:24px;height:24px;object-fit:contain;vertical-align:middle"> ` : '';
      return `<li>${icon}${escapeHtml(row.name)} × ${row.quantity}${row.equipped ? ' · Equipped' : ''}${row.missingDefinition ? ' · Missing definition' : ''}</li>`;
    }
    const progress = row.progress ? ` · ${row.progress.current}${row.progress.target === null ? '' : ' / '+row.progress.target}` : row.progressUnavailable ? ' · Unavailable progress' : '';
    return `<li>${escapeHtml(row.name)} · ${escapeHtml(row.status)}${escapeHtml(progress)}${row.missingDefinition ? ' · Missing definition' : ''}</li>`;
  }).join('')}</ul>` : `<p>${escapeHtml(result.emptyText)}</p>`) + (result.truncated ? '<small>More entries not shown</small>' : '');
}
function renderHudLayer(preview = false, elements = currentUiConfig.hudElements, includeTween = true) {
  const layer = document.getElementById('hud-elements-layer');
  if (!preview && (!playMode || elements.length === 0)) { layer.innerHTML = ''; return; }
  const markup = elements.map((el) => {
    if (!preview && el.visible === false) return '';
    const presentation = includeTween ? hudTweenPresentation(el.id,preview) : null;
    if (presentation) el = {...el,offsetX:presentation.offsetX,offsetY:presentation.offsetY};
    // Dogfood-02 fix: this used to unconditionally emit `left:${offsetX||0}px;
    // top:${offsetY||0}px` for EVERY element, regardless of anchor. An inline
    // `left`/`top` always wins over a CSS class's own `right`/`bottom`/
    // `transform: translateX(-50%)` positioning (higher specificity), so
    // every anchor except literally top-left silently collapsed to the
    // viewport's top-left corner the instant this HUD layer started
    // rendering with the default offsetX/offsetY of 0 -- found live: an
    // Objective Text element explicitly anchored `top-right` rendered
    // directly overlapping a `top-left` Health Bar instead. `margin-left`/
    // `margin-top` (rather than `left`/`top`) apply as a pure nudge on top
    // of whatever position the anchor class already computed (via right/
    // bottom/transform) without ever overriding it, so this only emits
    // them at all when an author has actually set a nonzero offset --
    // the overwhelmingly common default (offset 0) now correctly renders
    // exactly at its anchor's own position for every anchor, not just
    // top-left.
    const styleParts = [];
    // Native081 RED: opposite margins do not move right/bottom-constrained
    // absolute boxes. Keep historical zero-offset anchors, but apply signed
    // offsets on the actual constrained edge in both preview and gameplay.
    if (el.offsetX) styleParts.push(String(el.anchor).endsWith('right') ? `right:calc(12px - ${Number(el.offsetX) || 0}px)` : `margin-left:${Number(el.offsetX) || 0}px`);
    if (el.offsetY) styleParts.push(String(el.anchor).startsWith('bottom') ? `bottom:calc(12px - ${Number(el.offsetY) || 0}px)` : `margin-top:${Number(el.offsetY) || 0}px`);
    const style = styleParts.join(';');
    if (['inventoryWidget','objectiveWidget','dialogueWidget'].includes(el.kind)) return `<div class="hud-element hud-anchor-${el.anchor}" data-kind="widget" data-hud-id="${escapeHtml(el.id)}" style="${style};width:280px;max-height:65vh;overflow:auto;white-space:normal">${renderHudWidget(el,preview)}</div>`;
    if (el.kind === 'actionPrompt') {
      const result=resolveHudActionPrompt(el,preview);
      const label=elementPromptLabel(el,result);
      const content=!result.available?escapeHtml('Unavailable · '+result.reason):result.presentation==='text'
        ?escapeHtml(result.keyLabel+' · '+label)
        :`<kbd class="hud-action-keycap" aria-label="${escapeHtml(result.keyLabel)}" style="display:inline-block;max-width:100%;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;border:1px solid #8195b4;border-bottom-width:3px;border-radius:5px;padding:3px 7px;margin-right:7px;font:inherit;background:#26364d;color:inherit">${escapeHtml(result.keyLabel)}</kbd><span>${escapeHtml(label)}</span>`;
      return `<div class="hud-element hud-anchor-${el.anchor}" data-hud-id="${el.id}" style="${style};white-space:normal;overflow-wrap:anywhere">${content}</div>`;
    }
    if (Object.prototype.hasOwnProperty.call(el,'binding') && ['label','counter','timer','objective'].includes(el.kind)) return `<div class="hud-element hud-anchor-${el.anchor}" data-hud-id="${el.id}" style="${style}">${escapeHtml(resolveBoundHudText(el,preview))}</div>`;
    if (el.kind === 'label') {
      let text = preview ? el.text || 'Text Label' : resolveHudBindText(el.text || '');
      if (!preview) text = text.replace(/\{(\w+)\}/g, (_, name) => (window.__gameState && window.__gameState[name] != null) ? window.__gameState[name] : '0');
      return `<div class="hud-element hud-anchor-${el.anchor}" data-hud-id="${el.id}" style="${style}">${escapeHtml(text)}</div>`;
    }
    if (el.kind === 'objective') {
      // Wave 7 (Priority F): an Objective Text element with no authored
      // text at all auto-displays the current active Objective's title
      // (matching the spec's own "auto-displays... when bound
      // appropriately" -- leaving it empty IS the binding). Any explicit
      // text still resolves {activeObjective} if the author includes it.
      return `<div class="hud-element hud-anchor-${el.anchor}" data-hud-id="${el.id}" style="${style}">${escapeHtml(preview ? el.text || '{activeObjective}' : resolveHudBindText(el.text || '{activeObjective}'))}</div>`;
    }
    if (el.kind === 'counter') {
      const value = preview ? '{value}' : (window.__gameState && window.__gameState[el.counterName]) || 0;
      return `<div class="hud-element hud-anchor-${el.anchor}" data-hud-id="${el.id}" style="${style}">${escapeHtml(resolveHudBindingText(el.text || 'Score: {value}', value))}</div>`;
    }
    if (el.kind === 'timer') {
      const t = !preview && window.__gameTimers && window.__gameTimers[el.timerName];
      const value = preview ? '{value}' : t ? t.elapsed.toFixed(1) : '0';
      return `<div class="hud-element hud-anchor-${el.anchor}" data-hud-id="${el.id}" style="${style}">${escapeHtml(resolveHudBindingText(el.text || 'Time: {value}', value))}</div>`;
    }
    if (el.kind === 'health') {
      if (!preview) ensureHealthInit();
      const health = preview ? 100 : window.__gameState.health, maxHealth = preview ? 100 : window.__gameState.maxHealth;
      const pct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
      return `<div class="hud-element hud-anchor-${el.anchor}" data-kind="healthBar" data-hud-id="${el.id}" style="${style}" role="meter" aria-label="Health" aria-valuenow="${Math.ceil(health)}" aria-valuemin="0" aria-valuemax="${maxHealth}"><div class="hud-health-fill" style="width:${pct}%"></div><span class="hud-health-label">Health ${Math.ceil(health)} / ${maxHealth}</span></div>`;
    }
    if (el.kind === 'panel') {
      return `<div class="hud-element hud-anchor-${el.anchor}" data-kind="panel" data-hud-id="${el.id}" style="${style};width:${el.panelWidth || 120}px;height:${el.panelHeight || 60}px"></div>`;
    }
    if (el.kind === 'image') {
      const asset = findTextureAssetById(el.textureAssetId);
      const width = Number.isFinite(Number(el.imageWidth)) && Number(el.imageWidth) > 0 ? Number(el.imageWidth) : 128;
      const height = Number.isFinite(Number(el.imageHeight)) && Number(el.imageHeight) > 0 ? Number(el.imageHeight) : 128;
      const available = asset && typeof asset.dataURL === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(asset.dataURL);
      const content = available ? `<img src="${escapeHtml(asset.dataURL)}" alt="${escapeHtml(el.description || asset.name || 'Image')}" draggable="false" style="width:100%;height:100%;object-fit:contain;display:block">` : `<span role="img" aria-label="Missing image">Missing image</span>`;
      return `<div class="hud-element hud-anchor-${el.anchor}" data-kind="image" data-hud-id="${escapeHtml(el.id)}" style="${style};width:${width}px;height:${height}px;padding:0;overflow:hidden">${content}</div>`;
    }
    if (el.kind === 'button') {
      return `<div class="hud-element hud-anchor-${el.anchor}" data-kind="button" data-hud-id="${el.id}" style="${style}"><button data-hud-button="${el.id}">${escapeHtml(el.text || 'Button')}</button></div>`;
    }
    return '';
  }).join('');
  // Keep interactive nodes alive across frames. Replacing the layer while a
  // timer changes used to detach focused buttons and pointer-down targets.
  const template = document.createElement('template');
  template.innerHTML = markup;
  Array.from(template.content.children).forEach(node => {
    const presentation = includeTween ? hudTweenPresentation(node.dataset.hudId,preview) : null;
    if (!presentation) return;
    // Layout owns the outer anchor; tween the complete painted visual box.
    const wrapper = node.cloneNode(true);
    wrapper.removeAttribute('data-hud-id');
    wrapper.className = wrapper.className.replace(/hud-anchor-\S+/g,'');
    wrapper.dataset.hudTweenContent = '';
    Object.assign(wrapper.style, { position:'relative', left:'auto', top:'auto', right:'auto', bottom:'auto',
      marginLeft:'0', marginTop:'0', width:'100%', height:'100%', opacity:'1',
      transform:`scale(${presentation.scale})`, transformOrigin:'center center' });
    node.innerHTML = '';
    Object.assign(node.style, { background:'transparent', border:'0', padding:'0', overflow:'visible', opacity:String(presentation.opacity) });
    if (presentation.opacity === 0) { node.setAttribute('inert',''); node.setAttribute('aria-hidden','true'); }
    node.appendChild(wrapper);
  });
  if (preview) return template.innerHTML;
  const retained = new Set();
  let cursor = layer.firstElementChild;
  Array.from(template.content.children).forEach((next) => {
    const definition = currentUiConfig.hudElements.find((el) => String(el.id) === next.dataset.hudId);
    const kind = definition ? definition.kind : '';
    next.dataset.hudRenderKind = kind;
    let node = Array.from(layer.children).find((old) => !retained.has(old)
      && old.dataset.hudId === next.dataset.hudId && old.dataset.hudRenderKind === kind);
    if (node) {
      Array.from(node.attributes).forEach((attr) => {
        if (!next.hasAttribute(attr.name)) node.removeAttribute(attr.name);
      });
      Array.from(next.attributes).forEach((attr) => {
        if (node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value);
      });
      if (kind === 'button') {
        const button = node.querySelector('[data-hud-button]');
        const nextButton = next.querySelector('[data-hud-button]');
        if (button && nextButton) {
          if (button.textContent !== nextButton.textContent) button.textContent = nextButton.textContent;
          const wrapper = node.querySelector('[data-hud-tween-content]'), nextWrapper = next.querySelector('[data-hud-tween-content]');
          if (wrapper && nextWrapper) wrapper.style.transform = nextWrapper.style.transform;
          else if (nextWrapper && !wrapper) { const copy = nextWrapper.cloneNode(false); button.replaceWith(copy); copy.appendChild(button); }
          else if (wrapper && !nextWrapper) { wrapper.replaceWith(button); }
        } else node.innerHTML = next.innerHTML;
      } else if (node.innerHTML !== next.innerHTML) node.innerHTML = next.innerHTML;
    } else node = next;
    if (node !== cursor) layer.insertBefore(node, cursor);
    retained.add(node);
    cursor = node.nextElementSibling;
  });
  Array.from(layer.children).forEach((node) => { if (!retained.has(node)) node.remove(); });
  applyHudLayout(layer);
  layer.querySelectorAll('[data-hud-dialogue-choice]').forEach(button => {
    button.onclick = () => {
      if (!playMode || gameEnded) return;
      chooseDialoguePresentation(Number(button.dataset.dialogueGeneration), button.dataset.hudDialogueChoice);
    };
  });
  layer.querySelectorAll('[data-hud-button]').forEach((btn) => {
    btn.onclick = () => {
      if (!playMode || gameEnded || app.paused) return;
      const el = currentUiConfig.hudElements.find((e) => e.id === btn.dataset.hudButton);
      if (el) executeAction(el.buttonAction, el.buttonParams || {}, null);
    };
  });
}

function switchToLevel(index) {
  releaseTouchInputControls();
  if (index === currentLevelIndex || index < 0 || index >= levels.length) return;
  if(typeof cancelLevelTransition==='function')cancelLevelTransition();
  clearHudTweens();
  syncCurrentLevelObjects();
  currentLevelIndex = index;
  deselectAll();
  loadScene(levels[index].objects);
  applyLevelEnvironment(index);
  applyLevelPlayerSettings(index);
  applyLevelUiConfig(index);
  applyLevelSequences(index);
  applyLevelObjectiveDefs(index);
  applyLevelScatterLayers(index);
  applyLevelAmbientAudio(index);
  // A level switch is as much a document boundary as loading a different
  // project entirely -- undoing past it into a DIFFERENT level's history
  // would be confusing, not useful, so the stack resets clean.
  undoStack.length = 0;
  redoStack.length = 0;
  updateUndoRedoButtons();
  renderLevelList();
  showStatus(`Switched to "${levels[index].name}"`);
}

