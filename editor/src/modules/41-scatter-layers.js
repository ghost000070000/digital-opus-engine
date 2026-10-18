// --- Wave 9C (Priority A): Scatter Layers -- a real, persisted authoring
// surface over the existing weighted Scatter machinery. Same "build the
// DOM in JS, wire handlers after" pattern every other list editor already
// established (Sockets, Equipment, Objectives, Prefab Parameters). ---
function renderScatterLayerPanel() {
  const selectEl = document.getElementById('scatter-layer-select');
  const fieldsEl = document.getElementById('scatter-layer-fields');
  if (!selectEl || !fieldsEl) return;
  if (!selectedScatterLayerId || !findScatterLayerById(selectedScatterLayerId)) {
    selectedScatterLayerId = currentScatterLayers.length ? currentScatterLayers[0].id : null;
  }
  selectEl.innerHTML = currentScatterLayers.length === 0
    ? '<option value="">(no layers yet)</option>'
    : currentScatterLayers.map((l) => `<option value="${escapeHtml(l.id)}"${l.id === selectedScatterLayerId ? ' selected' : ''}>${escapeHtml(l.name)}</option>`).join('');
  const layer = findScatterLayerById(selectedScatterLayerId);
  if (!layer) { fieldsEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No layer selected -- Add one above.</p>'; return; }
  const ownedCount = placed.filter((p) => p.scatterLayerId === layer.id).length;
  fieldsEl.innerHTML = `
    <input type="text" id="sl-name" value="${escapeHtml(layer.name)}" placeholder="Layer name">
    <div style="font-size:10.5px;color:#66759a;margin-top:2px">${ownedCount} object${ownedCount === 1 ? '' : 's'} owned by this layer.</div>
    <div style="margin-top:6px;font-size:10px;color:#66759a">Sources (weighted):</div>
    <div id="sl-sources">${layer.sources.map((s, i) => `
      <div class="field-triple" style="margin-top:3px">
        <select data-sl-source-prefab="${i}">${prefabs.length === 0 ? '<option value="">(no prefabs)</option>' : prefabs.map((p) => `<option value="${escapeHtml(p.name)}"${s.prefabName === p.name ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select>
        <input type="number" min="0" step="1" data-sl-source-weight="${i}" value="${s.weight != null ? s.weight : 1}" placeholder="Weight">
        <button data-sl-source-remove="${i}" class="hud-remove-btn">✕</button>
      </div>`).join('') || '<p style="color:#8592a8;font-size:11px;margin:2px 0">No sources yet.</p>'}</div>
    <button id="sl-source-add-btn" class="toolbar-btn" style="margin-top:3px;padding:2px 8px">+ Add Source</button>
    <div class="field-triple" style="margin-top:6px">
      <div><label style="font-size:10px;color:#66759a">Seed</label><input type="number" id="sl-seed" value="${layer.seed}"></div>
      <div><label style="font-size:10px;color:#66759a">Brush Radius</label><input type="number" id="sl-brush-radius" step="0.5" min="0.5" value="${layer.brushRadius}"></div>
      <div><label style="font-size:10px;color:#66759a">Density</label><input type="number" id="sl-density" step="0.05" min="0.05" max="1" value="${layer.density}"></div>
    </div>
    <div class="field-triple" style="margin-top:4px">
      <div><label style="font-size:10px;color:#66759a">Min Spacing</label><input type="number" id="sl-min-spacing" step="0.1" min="0" value="${layer.minSpacing}"></div>
      <div><label style="font-size:10px;color:#66759a">Scale Min</label><input type="number" id="sl-scale-min" step="0.05" min="0.05" value="${layer.scaleMin}"></div>
      <div><label style="font-size:10px;color:#66759a">Scale Max</label><input type="number" id="sl-scale-max" step="0.05" min="0.05" value="${layer.scaleMax}"></div>
    </div>
    <div class="field-row" style="margin-top:4px"><label style="font-size:10px;color:#66759a">Max Slope (degrees)</label><input type="number" id="sl-max-slope" step="1" min="0" max="90" value="${layer.maxSlope}"></div>
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#c7d3ea;margin-top:4px"><input type="checkbox" id="sl-random-yaw"${layer.randomYaw ? ' checked' : ''}> Random Y Rotation</label>
    <div class="field-triple" style="margin-top:8px">
      <button id="sl-brush-paint-btn" class="toolbar-btn" style="margin-bottom:0${scatterBrushMode === 'paint' ? ';outline:2px solid #6fd6bd' : ''}">🖌 Paint</button>
      <button id="sl-brush-erase-btn" class="toolbar-btn" style="margin-bottom:0${scatterBrushMode === 'erase' ? ';outline:2px solid #d66f6f' : ''}">🧹 Erase</button>
      <button id="sl-brush-off-btn" class="toolbar-btn" style="margin-bottom:0${scatterBrushMode === null ? ';outline:2px solid #66759a' : ''}">Off</button>
    </div>
    <div class="field-help" style="margin-top:3px">Choose existing Prefabs as weighted sources, then Paint or Erase in the viewport. One changed drag = one Undo; Escape ends it. Erase only affects this layer's owned objects, never manual placement or another layer. Radius0.5–64; density0.05–1; at most128 candidates per dab. Scale Min must not exceed Max. Weight0 retains historical default weight1. Spacing is per dab, not a global foliage distribution.</div>
    ${selectedItem && selectedItem.scatterLayerId ? '<button id="sl-detach-btn" class="toolbar-btn" style="margin-top:6px">Detach Selected From Scatter Layer</button>' : ''}
  `;
  const fields={'sl-name':'name','sl-seed':'seed','sl-brush-radius':'brushRadius','sl-density':'density','sl-min-spacing':'minSpacing','sl-scale-min':'scaleMin','sl-scale-max':'scaleMax','sl-max-slope':'maxSlope'};
  for(const [id,key] of Object.entries(fields)) {
    const input=document.getElementById(id);if(!input)continue;let captured=false;
    input.disabled=playMode;input.onfocus=()=>{captured=false;};
    input.oninput=()=>{const value=key==='name'?input.value:input.value.trim()?Number(input.value):NaN;changeScatterLayerField(layer,key,value,()=>{if(!captured){pushUndo();captured=true;}});};
    input.onblur=()=>{input.value=String(layer[key]);};
    if(key==='name')input.onchange=()=>renderScatterLayerPanel();
  }
  const yawCb = document.getElementById('sl-random-yaw');
  if (yawCb) yawCb.onchange = (e) => { changeScatterLayerField(layer,'randomYaw',e.target.checked); };
  document.querySelectorAll('[data-sl-source-prefab]').forEach((sel) => { sel.onchange = () => { changeScatterLayerSource(layer,Number(sel.dataset.slSourcePrefab),'prefabName',sel.value); }; });
  document.querySelectorAll('[data-sl-source-weight]').forEach((input) => { let captured=false;input.onfocus=()=>{captured=false;};input.oninput=()=>changeScatterLayerSource(layer,Number(input.dataset.slSourceWeight),'weight',input.value.trim()?Number(input.value):NaN,()=>{if(!captured){pushUndo();captured=true;}});input.onblur=()=>{input.value=String(layer.sources[Number(input.dataset.slSourceWeight)].weight);}; });
  document.querySelectorAll('[data-sl-source-remove]').forEach((btn) => { btn.onclick = () => { pushUndo(); layer.sources.splice(Number(btn.dataset.slSourceRemove), 1); renderScatterLayerPanel(); }; });
  const addSourceBtn = document.getElementById('sl-source-add-btn');
  if (addSourceBtn) addSourceBtn.onclick = () => { pushUndo(); layer.sources.push({ prefabName: prefabs[0] ? prefabs[0].name : '', weight: 1 }); renderScatterLayerPanel(); };
  const paintBtn = document.getElementById('sl-brush-paint-btn');
  const eraseBtn = document.getElementById('sl-brush-erase-btn');
  const offBtn = document.getElementById('sl-brush-off-btn');
  if (paintBtn) paintBtn.onclick = () => { if(playMode)return;finishScatterBrushGesture();scatterBrushMode = 'paint';sculptMode=false;paintMode=false;renderScatterLayerPanel(); };
  if (eraseBtn) eraseBtn.onclick = () => { if(playMode)return;finishScatterBrushGesture();scatterBrushMode = 'erase';sculptMode=false;paintMode=false;renderScatterLayerPanel(); };
  if (offBtn) offBtn.onclick = () => { finishScatterBrushGesture();scatterBrushMode = null; renderScatterLayerPanel(); };
  const detachBtn = document.getElementById('sl-detach-btn');
  if (detachBtn) detachBtn.onclick = () => { pushUndo(); delete selectedItem.scatterLayerId; renderScatterLayerPanel(); showStatus('Detached from Scatter Layer'); };
}
document.getElementById('scatter-layer-select').onchange = (e) => { selectedScatterLayerId = e.target.value || null; renderScatterLayerPanel(); };
document.getElementById('scatter-layer-add-btn').onclick = () => {
  pushUndo();
  const layer = defaultScatterLayer();
  currentScatterLayers.push(layer);
  selectedScatterLayerId = layer.id;
  renderScatterLayerPanel();
};
document.getElementById('scatter-layer-delete-btn').onclick = () => {
  if (!selectedScatterLayerId) return;
  pushUndo();
  currentScatterLayers = currentScatterLayers.filter((l) => l.id !== selectedScatterLayerId);
  selectedScatterLayerId = currentScatterLayers.length ? currentScatterLayers[0].id : null;
  renderScatterLayerPanel();
  showStatus('Scatter Layer deleted (its generated objects were NOT removed -- Erase first if you want them gone too)');
};
document.getElementById('scatter-btn').onclick = () => {
  const config = {
    prefabName: document.getElementById('scatter-prefab').value || undefined,
    assetId: document.getElementById('scatter-asset').value || undefined,
    region: document.getElementById('scatter-region').value,
    centerX: parseFloat(document.getElementById('scatter-center-x').value) || 0,
    centerZ: parseFloat(document.getElementById('scatter-center-z').value) || 0,
    radius: parseFloat(document.getElementById('scatter-radius').value) || 10,
    width: parseFloat(document.getElementById('scatter-width').value) || 20,
    depth: parseFloat(document.getElementById('scatter-depth').value) || 20,
    count: Math.max(1, parseInt(document.getElementById('scatter-count').value, 10) || 1),
    minSpacing: parseFloat(document.getElementById('scatter-spacing').value) || 0,
    seed: parseInt(document.getElementById('scatter-seed').value, 10) || 1,
    scaleMin: parseFloat(document.getElementById('scatter-scale-min').value) || 1,
    scaleMax: parseFloat(document.getElementById('scatter-scale-max').value) || 1,
    maxSlopeDegrees: document.getElementById('scatter-max-slope').value !== '' ? parseFloat(document.getElementById('scatter-max-slope').value) : null,
    randomYRotation: document.getElementById('scatter-random-yrot').checked,
    terrainConform: document.getElementById('scatter-terrain-conform').checked,
  };
  if (!config.prefabName && !config.assetId) { showStatus('Choose a Prefab or Asset source first'); return; }
  const result = performScatter(config);
  renderSceneList();
  showStatus(`Scattered ${result.placedCount}/${config.count} (${result.attempts} attempts)`);
};
document.getElementById('array-mode').onchange = (e) => {
  const isGrid = e.target.value === 'grid';
  document.getElementById('array-linear-fields').style.display = isGrid ? 'none' : '';
  document.getElementById('array-grid-fields').style.display = isGrid ? '' : 'none';
  document.getElementById('array-grid-fields2').style.display = isGrid ? '' : 'none';
};
document.getElementById('array-btn').onclick = () => {
  if (!selectedItem || selectedItem.kind !== 'cube' || playMode) { showStatus('Select a current single Cube outside Play.'); return; }
  const mode = document.getElementById('array-mode').value;
  const number=id=>parseFloat(document.getElementById(id).value);
  const config = mode === 'grid'
    ? { mode: 'grid', countX:number('array-count-x'), countZ:number('array-count-z'), spacingX:number('array-spacing-x'), spacingZ:number('array-spacing-z') }
    : { mode: 'linear', axis: document.getElementById('array-axis').value, count:number('array-count'), spacing:number('array-spacing') };
  const plan=planArrayDuplicate(selectedItem,config);if(!plan.ok){showStatus(plan.reason);return;}
  if(!plan.points.length){showStatus('Array unchanged: count includes the original; no copies requested.');return;}
  const newItems = performArrayDuplicate(selectedItem, config);
  renderSceneList();
  showStatus(`Array created ${newItems.length} copies`);
};
// Wave 8 (Priority B): the Object Variables editor -- same "build the DOM
// in JS, wire handlers after" list pattern every other Wave 7/8 list
// editor already established. `item.variables` is a plain
// `{name: number|boolean|string}` map (Section 10's own explicit bound --
// no nested objects), authored directly on the placed item (or prefab
// record), separate from World-State's own opt-in persistence of it.
function objectVariableTypeOf(v) {
  return typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : 'string';
}
// Wave 8 (Priority C, Sections 15-24): Prefab Parameters editor -- two
// linked lists for the currently-selected LINKED instance's source prefab:
// the parameter DEFINITIONS themselves (shared by every instance -- Add
// Parameter/name/type/default/bound field, Section 17) and this ONE
// instance's own OVERRIDES (Section 20 -- only overridden values are ever
// stored on the instance; an un-overridden field just shows/edits the
// prefab's own default, and typing a value there creates the override).
let nextPrefabParamCounter = 1;
function generatePrefabParamStableId() { return `p${nextPrefabParamCounter++}_${Date.now().toString(36)}`; }
function clearPrefabParameterOverride(item,prefab,id) {
  if(playMode||selectedItem!==item||!placed.includes(item)||!prefab||item.sourcePrefabName!==prefab.name||prefabs.filter(p=>p?.name===prefab.name).length!==1||!prefabs.includes(prefab))return false;
  if(!Array.isArray(prefab.parameters)||prefab.parameters.filter(p=>p?.id===id).length!==1||!item.prefabParams||typeof item.prefabParams!=='object'||Array.isArray(item.prefabParams)||!Object.prototype.hasOwnProperty.call(item.prefabParams,id))return false;
  pushUndo();delete item.prefabParams[id];applyPrefabParameters(prefab,item);return true;
}
function renderPrefabParamPanel(item) {
  const defListEl = document.getElementById('prefab-param-def-list');
  const overrideListEl = document.getElementById('prefab-param-override-list');
  if (!defListEl || !overrideListEl || !item.sourcePrefabName) return;
  const prefab = prefabs.find((p) => p.name === item.sourcePrefabName);
  if (!prefab) { defListEl.innerHTML = ''; overrideListEl.innerHTML = ''; return; }
  const parameters = Array.isArray(prefab.parameters) ? prefab.parameters : [];
  if (parameters.length === 0) {
    defListEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No parameters defined yet -- add one below.</p>';
    overrideListEl.innerHTML = '';
  } else {
    defListEl.innerHTML = parameters.map((param) => `
      <div class="hud-element-row" data-param-id="${escapeHtml(param.id)}">
        <div class="hud-element-row-header">
          <span>${escapeHtml(param.label || param.id)} <span style="color:#66759a;font-size:10px">(${param.type})</span></span>
          <button data-param-remove="${escapeHtml(param.id)}" class="hud-remove-btn">✕</button>
        </div>
        <div class="field-triple">
          <input type="text" data-param-label="${escapeHtml(param.id)}" value="${escapeHtml(param.label || '')}" placeholder="Display label">
          <select data-param-bind="${escapeHtml(param.id)}">
            <option value="">(not bound to a field yet)</option>
            ${Object.entries(PREFAB_PARAM_BINDINGS).map(([k, def]) => `<option value="${k}"${param.bindingField === k ? ' selected' : ''}>${escapeHtml(def.label)}</option>`).join('')}
          </select>
          ${param.bindingField === 'variable' ? `<input type="text" data-param-varname="${escapeHtml(param.id)}" value="${escapeHtml(param.variableName || '')}" placeholder="variable name">` : '<span></span>'}
        </div>
        <div style="margin-top:3px">${renderActionFieldInput({ key: 'default', type: param.type === 'prefabReference' ? 'prefab' : param.type }, param.default, null)}</div>
      </div>`).join('');
    overrideListEl.innerHTML = `<label style="font-size:10.5px;color:#66759a">This instance's overrides (blank = use the prefab's default):</label>` + parameters.map((param) => {
      const hasOverride = item.prefabParams?.[param.id] !== undefined;
      const effective = resolveEffectivePrefabParamValue(item, param);
      // Wave 9D (Priority A/Section 8): Mesh/Texture/Audio Asset overrides
      // use the exact same real Asset Library dropdowns the parameter's own
      // Default row already renders (`renderActionFieldInput`), never a
      // raw-text-typed id -- the spec's own explicit "do not require typing
      // raw IDs." An empty first option keeps "blank = use the prefab's
      // default" working identically to every other override type.
      const isAssetType = param.type === 'meshAsset' || param.type === 'textureAsset' || param.type === 'audioAsset';
      const inputHtml = param.type === 'boolean'
        ? `<select data-override-value="${escapeHtml(param.id)}"><option value="">(default: ${param.default})</option><option value="true"${hasOverride && effective === true ? ' selected' : ''}>true</option><option value="false"${hasOverride && effective === false ? ' selected' : ''}>false</option></select>`
        : isAssetType
        ? renderActionFieldInput({ key: 'default', type: param.type }, hasOverride ? effective : '', null).replace('data-field="default"', `data-override-value="${escapeHtml(param.id)}"`)
        : `<input type="${param.type === 'number' ? 'number' : param.type === 'color' ? 'color' : 'text'}" data-override-value="${escapeHtml(param.id)}" value="${hasOverride ? escapeHtml(String(effective)) : ''}" placeholder="default: ${escapeHtml(String(param.default))}">`;
      return `<div class="field-triple" style="margin-top:3px"><span style="font-size:11px;color:#c7d3ea;align-self:center">${escapeHtml(param.label || param.id)}</span>${inputHtml}<button data-override-clear="${escapeHtml(param.id)}" class="hud-remove-btn" title="Clear override">✕</button></div>`;
    }).join('');
  }
  defListEl.querySelectorAll('[data-param-remove]').forEach((btn) => {
    btn.onclick = () => { pushUndo(); prefab.parameters = prefab.parameters.filter((pp) => pp.id !== btn.dataset.paramRemove); savePrefabs(); renderPrefabParamPanel(item); };
  });
  defListEl.querySelectorAll('[data-param-label]').forEach((input) => {
    input.oninput = () => { const pp = prefab.parameters.find((x) => x.id === input.dataset.paramLabel); if (pp && pp.label!==input.value) { pushUndo(); pp.label = input.value; savePrefabs(); } };
  });
  defListEl.querySelectorAll('[data-param-bind]').forEach((sel) => {
    sel.onchange = () => { pushUndo(); const pp = prefab.parameters.find((x) => x.id === sel.dataset.paramBind); if (pp) pp.bindingField = sel.value || undefined; savePrefabs(); renderPrefabParamPanel(item); };
  });
  defListEl.querySelectorAll('[data-param-varname]').forEach((input) => {
    input.oninput = () => { const pp = prefab.parameters.find((x) => x.id === input.dataset.paramVarname); if (pp && pp.variableName!==input.value) { pushUndo(); pp.variableName = input.value; savePrefabs(); } };
  });
  defListEl.querySelectorAll('[data-field="default"]').forEach((input) => {
    const row = input.closest('[data-param-id]');
    if (!row) return;
    const id = row.dataset.paramId;
    const handler = () => {
      const pp = prefab.parameters.find((x) => x.id === id);
      if (!pp) return;
      const value=pp.type === 'number' ? (parseFloat(input.value) || 0) : pp.type === 'boolean' ? input.checked : input.value;
      if(pp.default===value)return;pushUndo();pp.default=value;savePrefabs();
    };
    input.oninput = handler;
    input.onchange = handler;
  });
  overrideListEl.querySelectorAll('[data-override-value]').forEach((input) => {
    const handler = () => {
      const param = prefab.parameters.find((x) => x.id === input.dataset.overrideValue);
      if (!param) return;
      const value=input.value===''?undefined:param.type==='number'?(parseFloat(input.value)||0):param.type==='boolean'?input.value==='true':input.value;
      if(item.prefabParams?.[param.id]===value)return;pushUndo();
      item.prefabParams = item.prefabParams || {};
      if (input.value === '') { delete item.prefabParams[param.id]; }
      else {
        item.prefabParams[param.id] = param.type === 'number' ? (parseFloat(input.value) || 0) : param.type === 'boolean' ? input.value === 'true' : input.value;
      }
      applyPrefabParamBinding(item, param, resolveEffectivePrefabParamValue(item, param));
    };
    input.oninput = handler;
    input.onchange = handler;
  });
  overrideListEl.querySelectorAll('[data-override-clear]').forEach((btn) => {
    btn.onclick = () => { if(clearPrefabParameterOverride(item,prefab,btn.dataset.overrideClear))renderPrefabParamPanel(item); };
  });
  const addBtn = document.getElementById('param-add-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      const nameInput = document.getElementById('param-new-name');
      const label = nameInput.value.trim();
      if (!label) { showStatus('Name the parameter first'); return; }
      if (prefab.parameters != null && !Array.isArray(prefab.parameters)) { showStatus('This Prefab has an invalid parameter list. Original data has been retained; repair the project before adding parameters.'); return; }
      const type = document.getElementById('param-new-type').value;
      pushUndo();
      (prefab.parameters ||= []).push({ id: generatePrefabParamStableId(), label, type, default: type === 'number' ? 0 : type === 'boolean' ? false : type === 'color' ? '#ffffff' : '' });
      savePrefabs();
      nameInput.value = '';
      renderPrefabParamPanel(item);
    };
  }
}
function renderObjectVariableList(item) {
  const listEl = document.getElementById('object-variable-list');
  if (!listEl) return;
  item.variables = item.variables || {};
  const names = Object.keys(item.variables);
  if (names.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No variables yet -- add one below.</p>';
  } else {
    listEl.innerHTML = names.map((name) => {
      const v = item.variables[name];
      const type = objectVariableTypeOf(v);
      const inputHtml = type === 'boolean'
        ? `<select data-objvar-value="${escapeHtml(name)}"><option value="true"${v ? ' selected' : ''}>true</option><option value="false"${!v ? ' selected' : ''}>false</option></select>`
        : `<input type="${type === 'number' ? 'number' : 'text'}" data-objvar-value="${escapeHtml(name)}" value="${escapeHtml(String(v))}">`;
      return `
      <div class="field-triple" data-objvar-row="${escapeHtml(name)}" style="margin-top:3px">
        <span style="font-size:11.5px;color:#c7d3ea;align-self:center">${escapeHtml(name)} <span style="color:#66759a;font-size:10px">(${type})</span></span>
        ${inputHtml}
        <button data-objvar-remove="${escapeHtml(name)}" class="hud-remove-btn">✕</button>
      </div>`;
    }).join('');
  }
  listEl.querySelectorAll('[data-objvar-remove]').forEach((btn) => {
    btn.onclick = () => { pushUndo(); delete item.variables[btn.dataset.objvarRemove]; renderObjectVariableList(item); };
  });
  listEl.querySelectorAll('[data-objvar-value]').forEach((input) => {
    let captured=false;
    const handler = () => {
      const name = input.dataset.objvarValue;
      if(playMode||!placed.includes(item)||!Object.prototype.hasOwnProperty.call(item.variables||{},name)){
        input.value=String(item.variables?.[name]??'');return;
      }
      const type = objectVariableTypeOf(item.variables[name]);
      const next=type==='boolean'?input.value==='true':type==='number'?parseFloat(input.value):input.value;
      if(type==='number'&&!Number.isFinite(next)||Object.is(next,item.variables[name]))return;
      if(!captured){pushUndo();captured=true;}
      item.variables[name]=next;
    };
    input.oninput = handler;
    input.onchange = handler;
    input.onblur=()=>{captured=false;};
  });
  const addBtn = document.getElementById('objvar-add-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      const nameInput = document.getElementById('objvar-new-name');
      const name = nameInput.value.trim();
      if (!name) { showStatus('Name the variable first'); return; }
      if (name in item.variables) { showStatus(`"${name}" already exists`); return; }
      const type = document.getElementById('objvar-new-type').value;
      pushUndo();
      item.variables[name] = type === 'number' ? 0 : type === 'boolean' ? false : '';
      nameInput.value = '';
      renderObjectVariableList(item);
    };
  }
}
// Wave 8 (Priority D): the Item Definitions editor -- same list-row
// pattern every other Wave 7/8 list editor already established. Bounded
// (Section 28's own explicit "do not create spreadsheets or a giant
// database editor") -- Name/Description/Icon/Stackable+Max Stack/Equip
// Slot/an optional Use Action, nothing deeper.
function itemDefinitionAuthoringOwner(def) {
  return !playMode&&!!def&&typeof def==='object'&&!Array.isArray(def)&&currentItemDefs.includes(def)&&typeof def.id==='string'&&currentItemDefs.filter(d=>d?.id===def.id).length===1&&Object.values(Object.getOwnPropertyDescriptors(def)).every(d=>Object.prototype.hasOwnProperty.call(d,'value'));
}
function changeItemDefinition(def,key,value,beforeChange=pushUndo) {
  if(!itemDefinitionAuthoringOwner(def))return false;
  if(['name','description','equipSlot'].includes(key)){if(typeof value!=='string')return false;if(key==='equipSlot')value=value||undefined;}
  else if(key==='maxStack'){if(!Number.isSafeInteger(value)||value<1)return false;}
  else if(key==='stackable'){if(typeof value!=='boolean')return false;}
  else if(key==='iconTextureAssetId'){if(typeof value!=='string'||value&&textureAssets.filter(t=>t?.id===value).length!==1)return false;value=value||undefined;}
  else if(key==='hasUseAction'){
    if(typeof value!=='boolean')return false;if(!!def.useAction===value)return true;
    beforeChange();def.useAction=value?{action:'message',params:{}}:undefined;return true;
  }else if(key==='useActionType'){
    if(typeof value!=='string'||!Object.prototype.hasOwnProperty.call(ACTION_TYPES,value)||['graph','dialogueTree'].includes(value))return false;
    if(def.useAction?.action===value)return true;
    beforeChange();def.useAction={action:value,params:{}};return true;
  }else return false;
  if(Object.is(def[key],value))return true;beforeChange();def[key]=value;return true;
}
function changeItemUseActionParam(def,field,value,beforeChange=pushUndo) {
  if(!itemDefinitionAuthoringOwner(def)||!def.useAction||typeof def.useAction!=='object'||Array.isArray(def.useAction))return false;
  const action=Object.prototype.hasOwnProperty.call(ACTION_TYPES,def.useAction.action)?ACTION_TYPES[def.useAction.action]:null;if(!action||['graph','dialogueTree'].includes(def.useAction.action)||!action.fields.includes(field))return false;
  const params=def.useAction.params;
  if(params!==undefined&&(!params||typeof params!=='object'||Array.isArray(params)||Object.values(Object.getOwnPropertyDescriptors(params)).some(d=>!Object.prototype.hasOwnProperty.call(d,'value'))))return false;
  const valueType=field.type==='signalPayload'?signalPayloadFieldType(params?.signalId):field.type==='comparisonValue'?({number:'number',boolean:'checkbox',text:'text',object:'target',color:'color'})[params?.valueType||'number']:field.cameraShakeScalar?'number':field.type;
  if(valueType==='number'&&!Number.isFinite(value)||valueType==='checkbox'&&typeof value!=='boolean')return false;
  if(!['number','checkbox'].includes(valueType)&&typeof value!=='string'&&value!==undefined)return false;
  if(field.type==='select'&&Array.isArray(field.options)&&!field.options.some(o=>(typeof o==='object'?o.value:o)===value))return false;
  if(field.type==='itemDefRef'&&currentItemDefs.filter(d=>d?.id===value).length!==1)return false;
  if(field.type==='textureAsset'&&value&&textureAssets.filter(t=>t?.id===value).length!==1)return false;
  if(field.type==='audioAsset'&&value&&audioAssets.filter(t=>t?.id===value).length!==1)return false;
  if(Object.is(params?.[field.key],value))return true;
  beforeChange();def.useAction.params={...(params||{}),[field.key]:value};return true;
}
function bindItemDefinitionField(control,def,key,type,afterChange) {
  let captured=false;const discrete=type==='checkbox'||type==='select';control.disabled=!itemDefinitionAuthoringOwner(def);
  const commit=()=>{const value=typeof key==='object'?(control.type==='number'?(control.value.trim()?Number(control.value):NaN):readActionFieldValue(key,control)):type==='checkbox'?control.checked:type==='number'?(control.value.trim()?Number(control.value):NaN):control.value;
    const ok=typeof key==='object'?changeItemUseActionParam(def,key,value,()=>{if(discrete||!captured){pushUndo();captured=true;}}):changeItemDefinition(def,key,value,()=>{if(discrete||!captured){pushUndo();captured=true;}});
    if(ok)afterChange?.();else showStatus('Choose a valid Item value; stop Play before editing.');};
  if(discrete)control.onchange=commit;else{control.oninput=commit;control.addEventListener('blur',()=>{captured=false;});}
}
function lootTableAuthoringOwner(table) {
  return !playMode&&Array.isArray(lootTables)&&lootTables.includes(table)&&lootTableById(table?.id)===table;
}
function generateLootTableId() {
  let id;do{id='loot'+nextLootTableId++;}while(Array.isArray(lootTables)&&lootTables.some(table=>table?.id===id));return id;
}
function applyLootTableDraft(table,input) {
  const fail=reason=>({ok:false,reason});
  if(!lootTableAuthoringOwner(table))return fail('Stop Play and choose a current valid Loot Table. Retained invalid data is not overwritten.');
  if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120)return fail('Name must contain1–120 characters.');
  if(typeof input.seed!=='string'||!/^(0|[1-9][0-9]*)$/.test(input.seed))return fail('Seed must be a whole unsigned32-bit number;0 is valid.');
  const candidate={...OpusLootTables.copyData(table),name:input.name.trim(),seed:Number(input.seed),entries:input.entries};
  const state=inspectLootTable(candidate);if(!state.ok)return fail(state.reason);
  if(JSON.stringify(candidate)===JSON.stringify(table))return {ok:true,changed:false};
  const detached=OpusLootTables.copyData(candidate);
  pushUndo();Object.assign(table,detached);return {ok:true,changed:true};
}
function renderLootTableList() {
  const panel=document.getElementById('loot-table-list'),add=document.getElementById('loot-table-add');if(!panel||!add)return;
  add.disabled=playMode||!Array.isArray(lootTables)||lootTables.length>=OpusLootTables.MAX_TABLES;
  add.onclick=()=>{if(playMode||!Array.isArray(lootTables)||lootTables.length>=OpusLootTables.MAX_TABLES)return;pushUndo();lootTables.push({version:1,id:generateLootTableId(),name:'Loot Table '+(lootTables.length+1),seed:0,entries:[{kind:'none',weight:1}]});renderLootTableList();};
  if(!Array.isArray(lootTables)){panel.innerHTML='<p class="field-help">Unavailable saved Loot Table library retained. Load a repaired project to edit; it has not been erased.</p>';return;}
  panel.innerHTML='';
  const available=prefabs.filter(prefab=>lootPickupPrefab(prefab?.name).ok);
  for(const table of lootTables){
    const card=document.createElement('div');card.className='loot-table-card';panel.appendChild(card);
    if(lootTableById(table?.id)!==table){card.innerHTML='<p class="field-help">Unavailable saved Loot Table retained. Repair its version, identity, seed or outcomes before editing.</p>';continue;}
    card.innerHTML=`<label>Name<input data-loot-name aria-label="Loot Table name" value="${escapeHtml(table.name||'Unnamed Loot Table')}"></label><label>Seed<input data-loot-seed aria-label="Loot Table seed" type="number" min="0" max="4294967295" step="1" value="${table.seed}"></label><div data-loot-entries></div><div class="loot-table-buttons"><button type="button" data-loot-add-outcome>Add outcome</button><button type="button" data-loot-preview>Preview12 draws</button><button type="button" data-loot-apply>Apply table</button><button type="button" data-loot-revert>Revert draft</button><button type="button" data-loot-duplicate>Duplicate</button><button type="button" data-loot-remove>Remove</button></div><pre data-loot-proof class="field-help"></pre>`;
    const entries=card.querySelector('[data-loot-entries]');let draft=OpusLootTables.copyData(table.entries);
    const renderEntries=()=>{
      entries.innerHTML=draft.map((entry,index)=>`<div class="loot-outcome-row"><label>Outcome<select data-loot-outcome="${index}" aria-label="Loot outcome ${index+1}"><option value=""${entry.kind==='none'?' selected':''}>No drop</option>${entry.kind==='prefab'&&!available.some(prefab=>prefab.name===entry.prefabName)?`<option value="${escapeHtml(entry.prefabName)}" selected disabled>Unavailable: ${escapeHtml(entry.prefabName)}</option>`:''}${available.map(prefab=>`<option value="${escapeHtml(prefab.name)}"${entry.kind==='prefab'&&entry.prefabName===prefab.name?' selected':''}>${escapeHtml(prefab.name)}</option>`).join('')}</select></label><label>Weight<input data-loot-weight="${index}" aria-label="Loot weight ${index+1}" type="number" min="1" max="1000000" step="1" value="${entry.weight}"></label><button type="button" data-loot-remove-outcome="${index}" aria-label="Remove outcome ${index+1}">×</button></div>`).join('');
      entries.querySelectorAll('[data-loot-remove-outcome]').forEach(button=>button.onclick=()=>{if(playMode||!lootTableAuthoringOwner(table)||draft.length<2)return;readEntries();draft.splice(Number(button.dataset.lootRemoveOutcome),1);renderEntries();});
      entries.querySelectorAll('input,select,button').forEach(control=>control.disabled=playMode);
    };
    const readEntries=()=>{draft=draft.map((entry,index)=>{const name=entries.querySelector(`[data-loot-outcome="${index}"]`).value,raw=entries.querySelector(`[data-loot-weight="${index}"]`).value;const next={...entry,kind:name?'prefab':'none',weight:/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN};if(name)next.prefabName=name;else delete next.prefabName;return next;});return draft;};
    const input=()=>({name:card.querySelector('[data-loot-name]').value,seed:card.querySelector('[data-loot-seed]').value,entries:readEntries()});
    const proof=card.querySelector('[data-loot-proof]');const initial=inspectLootTable(table);proof.textContent=initial.ok?'Ready. Draft changes apply only with Apply table.':initial.reason;
    card.querySelector('[data-loot-add-outcome]').onclick=()=>{if(playMode||!lootTableAuthoringOwner(table)||draft.length>=OpusLootTables.MAX_ENTRIES)return;readEntries();draft.push({kind:'none',weight:1});renderEntries();};
    card.querySelector('[data-loot-preview]').onclick=()=>{if(playMode||!lootTableAuthoringOwner(table))return;const values=input(),candidate={...table,name:values.name,seed:Number(values.seed),entries:values.entries};const state=inspectLootTable(candidate);if(!/^(0|[1-9][0-9]*)$/.test(values.seed)||!state.ok){proof.textContent=state.reason||'Choose a whole unsigned seed.';return;}proof.textContent='Read-only preview from draw0 (no gameplay progress consumed):\n'+Array.from({length:12},(_,i)=>{const draw=OpusLootTables.sample(candidate,i);return (i+1)+'. '+(draw.kind==='none'?'No drop':draw.prefabName);}).join('\n');};
    card.querySelector('[data-loot-apply]').onclick=()=>{const result=applyLootTableDraft(table,input());if(!result.ok){proof.textContent=result.reason;return;}renderLootTableList();showStatus(result.changed?'Loot Table applied with Undo.':'Loot Table unchanged; no history entry.');};
    card.querySelector('[data-loot-revert]').onclick=()=>{if(!playMode&&lootTableAuthoringOwner(table))renderLootTableList();};
    card.querySelector('[data-loot-duplicate]').onclick=()=>{if(!lootTableAuthoringOwner(table)||lootTables.length>=OpusLootTables.MAX_TABLES)return;pushUndo();lootTables.push({...OpusLootTables.copyData(table),id:generateLootTableId(),name:(table.name||'Loot Table')+' copy'});renderLootTableList();};
    card.querySelector('[data-loot-remove]').onclick=()=>{if(!lootTableAuthoringOwner(table)||!confirm('Remove this Loot Table? Callers retain an unavailable reference. Undo restores it.'))return;pushUndo();lootTables.splice(lootTables.indexOf(table),1);renderLootTableList();};
    renderEntries();card.querySelectorAll('input,select,button').forEach(control=>control.disabled=playMode);
  }
}
function inspectInventoryTemplate(record) {
  const checked=OpusInventoryTemplates.inspect(record);if(!checked.ok)return checked;
  const settings=checked.template.settings;
  if(settings.iconTextureAssetId&&textureAssets.filter(asset=>asset?.id===settings.iconTextureAssetId).length!==1)return {ok:false,reason:'Choose an available unique icon texture.'};
  if(settings.useAction){
    const action=Object.prototype.hasOwnProperty.call(ACTION_TYPES,settings.useAction.action)?ACTION_TYPES[settings.useAction.action]:null;
    if(!action||!Array.isArray(action.fields)||['graph','dialogueTree'].includes(settings.useAction.action))return {ok:false,reason:'Template Use Action is unavailable.'};
    const uses=collectEditorReferenceUses({itemDefs:[{id:'template-preview',useAction:settings.useAction}]});
    const project={levels:[{id:'current',objects:placed}],itemDefs:currentItemDefs,prefabs,assets,textures:textureAssets,audio:audioAssets,signals:signalDefinitions,inputActionMap,inputActionAssets,lootTables,graphFunctions};
    if(OpusAuthoringPlumbing.buildReferenceIndex(project,{referenceUses:uses}).dangling.length)return {ok:false,reason:'Template Use Action contains an unavailable reference.'};
    for(const field of action.fields)if(field.type==='number'&&settings.useAction.params[field.key]!==undefined&&!Number.isFinite(settings.useAction.params[field.key]))return {ok:false,reason:'Template Use Action has an invalid numeric setting.'};
  }
  return checked;
}
function captureInventoryTemplate(def,name) {
  if(!itemDefinitionAuthoringOwner(def)||!Array.isArray(inventoryTemplates)||inventoryTemplates.length>=OpusInventoryTemplates.MAX_TEMPLATES)return {ok:false,reason:'Choose a current Item in Edit mode; at most128 saved templates.'};
  const checked=OpusInventoryTemplates.capture(typeof name==='string'?name.trim():name,def);if(!checked.ok)return checked;
  const valid=inspectInventoryTemplate(checked.template);if(!valid.ok)return valid;
  if(inventoryTemplates.some(record=>record?.name===valid.template.name))return {ok:false,reason:'Choose a unique template name. Existing templates were not replaced.'};
  if(def.useAction?.action==='useItem'&&itemUseActionHasCycle(def.id))return {ok:false,reason:'Repair the cyclic Item Use chain before capturing.'};
  pushUndo();inventoryTemplates.push(valid.template);return {ok:true,template:valid.template};
}
function applyInventoryTemplate(def,record) {
  if(!itemDefinitionAuthoringOwner(def))return {ok:false,reason:'Choose a current Item in Edit mode.'};
  const checked=inspectInventoryTemplate(record);if(!checked.ok)return checked;
  const result=OpusInventoryTemplates.candidate(checked.template,def);if(!result.ok)return result;
  const seen=new Set([def.id]);let id=result.item.useAction?.action==='useItem'?result.item.useAction.params?.itemId:null;
  while(id){if(seen.has(id))return {ok:false,reason:'Template would create a cyclic Item Use chain.'};seen.add(id);const next=findItemDefById(id);id=next?.useAction?.action==='useItem'?next.useAction.params?.itemId:null;}
  if(JSON.stringify(result.item)===JSON.stringify(def))return {ok:true,changed:false};
  pushUndo();for(const key of Object.keys(checked.template.settings))if(!Object.prototype.hasOwnProperty.call(result.item,key))delete def[key];Object.assign(def,result.item);
  return {ok:true,changed:true};
}
function renderInventoryTemplateLibrary(itemId='',templateValue='') {
  const host=document.getElementById('inventory-template-library');if(!host)return;
  if(!Array.isArray(inventoryTemplates)){host.innerHTML='<p>Unavailable saved Item template library retained. Load repaired data to edit it.</p>';return;}
  const definitions=currentItemDefs,library=inventoryTemplates;
  const items=definitions.filter(def=>itemDefinitionAuthoringOwner(def));
  const built=OpusInventoryTemplates.starters;
  host.innerHTML='<details open><summary>Item settings templates</summary><p>Apply settings to an existing Item; its name and stable identity stay unchanged. Templates do not grant inventory or create world Pickups.</p>'+
    '<label>Target Item<select id="inventory-template-item" class="field-input"><option value="">Choose Item…</option>'+items.map(def=>'<option value="'+escapeHtml(def.id)+'"'+(def.id===itemId?' selected':'')+'>'+escapeHtml(def.name||'Unnamed Item')+'</option>').join('')+'</select></label>'+
    '<label>Template<select id="inventory-template-choice" class="field-input"><option value="">Choose template…</option>'+[...built,...library].map((record,i)=>'<option value="'+i+'"'+(String(i)===templateValue?' selected':'')+'>'+escapeHtml((i<built.length?'Starter: ':'Saved: ')+(typeof record?.name==='string'?record.name:'Unavailable retained record'))+'</option>').join('')+'</select></label>'+
    '<p id="inventory-template-preview" role="status"></p><button id="inventory-template-apply" type="button" class="toolbar-btn">Apply settings — one Undo step</button>'+
    '<label>Capture current Item as<input id="inventory-template-name" class="field-input" maxlength="80" placeholder="e.g. Small healing supply"></label><div style="display:flex;gap:6px;flex-wrap:wrap"><button id="inventory-template-capture" type="button" class="toolbar-btn">Capture settings</button><button id="inventory-template-remove" type="button" class="toolbar-btn">Remove saved template</button></div>'+
    '<p>Capture includes description, capacity, icon, equipment slot and Use Action. It excludes Item identity/name, balances, equipped state and Loot progress. References stay project-local. Configure Pickup, equipment, key graphs, Loot Tables and Purchase Item separately.</p></details>';
  const q=suffix=>host.querySelector('#inventory-template-'+suffix);
  const owner=()=>!playMode&&currentItemDefs===definitions&&inventoryTemplates===library&&document.getElementById('inventory-template-library')===host&&q('item').isConnected;
  const target=()=>owner()?items.find(def=>def.id===q('item').value&&itemDefinitionAuthoringOwner(def)):null;
  const chosen=()=>q('choice').value!==''?[...built,...library][Number(q('choice').value)]:null;
  const preview=()=>{const record=chosen(),checked=record?inspectInventoryTemplate(record):null;q('preview').textContent=!record?'Choose a template to review authored settings.':!checked.ok?checked.reason:record.name+': '+(record.settings.stackable?'Stackable, capacity '+record.settings.maxStack:'Nonstackable, capacity1')+(record.settings.useAction?'; Use: '+ACTION_TYPES[record.settings.useAction.action].label:'; no Use Action')+'. Name/id and unrelated extensions are preserved.';q('apply').disabled=!target()||!checked?.ok;q('capture').disabled=!target()||library.length>=OpusInventoryTemplates.MAX_TEMPLATES;q('remove').disabled=!owner()||q('choice').value===''||Number(q('choice').value)<built.length;};
  q('item').onchange=preview;q('choice').onchange=preview;
  q('apply').onclick=()=>{const def=target();if(!def)return;const selected=q('choice').value,result=applyInventoryTemplate(def,chosen());if(result.ok){renderItemDefList();renderInventoryTemplateLibrary(def.id,selected);}showStatus(result.ok?(result.changed?'Item settings applied with Undo.':'Item settings unchanged; no history entry.'):result.reason);};
  q('capture').onclick=()=>{const def=target();if(!def)return;const result=captureInventoryTemplate(def,q('name').value);if(result.ok){renderInventoryTemplateLibrary(def.id,String(built.length+library.length-1));showStatus('Independent Item settings captured with Undo.');}else showStatus(result.reason);};
  q('remove').onclick=()=>{const i=Number(q('choice').value)-built.length;if(!owner()||q('choice').value===''||!Number.isInteger(i)||i<0||i>=library.length||!confirm('Remove this saved Item settings template? Existing Items stay unchanged.'))return;pushUndo();library.splice(i,1);renderInventoryTemplateLibrary(q('item').value);};
  preview();if(playMode)host.querySelectorAll('input,select,button').forEach(control=>control.disabled=true);
}

function renderItemDefList() {
  const listEl = document.getElementById('item-def-list');
  if (!listEl) return;
  if (currentItemDefs.length === 0) {
    listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No items yet -- add one below.</p>';
  } else {
    listEl.innerHTML = currentItemDefs.map((d, i) => !d||typeof d!=='object'||Array.isArray(d)?'<p class="field-help">Unavailable saved Item record retained. Import a repaired definition to edit it.</p>':`
      <div class="hud-element-row" data-itemdef-index="${i}">
        <div class="hud-element-row-header">
          <span>${escapeHtml(d.name || '(unnamed)')} <span style="color:#66759a;font-size:10px">(${escapeHtml(d.id)})</span></span>
          <button data-itemdef-remove="${i}" class="hud-remove-btn" title="Delete">✕</button>
        </div>
        <input type="text" data-itemdef-name="${i}" value="${escapeHtml(d.name || '')}" placeholder="Name">
        <input type="text" data-itemdef-desc="${i}" value="${escapeHtml(d.description || '')}" placeholder="Description (optional)" style="margin-top:4px">
        <div class="field-triple" style="margin-top:4px">
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#c7d3ea"><input type="checkbox" data-itemdef-stackable="${i}"${d.stackable !== false ? ' checked' : ''}> Stackable</label>
          <input type="number" data-itemdef-maxstack="${i}" value="${d.maxStack || 99}" placeholder="Max stack" min="1">
          <input type="text" data-itemdef-slot="${i}" value="${escapeHtml(d.equipSlot || '')}" placeholder="Equip slot (optional)">
        </div>
        <p class="field-help" data-itemdef-rules="${i}">Inventory capacity: ${d.stackable === false ? '1 (not stackable)' : escapeHtml(String(d.maxStack ?? 99))}. Pickup and Grant Item (capacity rules) refuse the whole grant when full. Legacy Give Item ignores this limit. Use Remove Item or Use Item to free capacity; no global slot or weight limit.</p>
        <div class="field-triple" style="margin-top:4px">
          ${textureAssets.length === 0 ? '<span style="font-size:10.5px;color:#8592a8">No textures imported (icon optional)</span>' : renderActionFieldInput({ key: 'iconTextureAssetId', type: 'textureAsset' }, d.iconTextureAssetId || '', `itemdef-icon-${i}`)}
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#c7d3ea"><input type="checkbox" data-itemdef-hasuse="${i}"${d.useAction ? ' checked' : ''}> Use Action</label>
        </div>
${d.useAction ? `<p class="field-help">Use consumes one Item after its Action. Inventory Use works while that overlay pauses gameplay; actions needing a world-object caller should be activated by its Behavior instead. Direct Use Item cycles are refused without consumption.</p>${itemUseActionHasCycle(d.id)?'<p class="field-help" role="alert" data-itemdef-use-cycle="'+i+'">This Use Action forms an Item cycle. Use is refused; choose another Item or effect to break the loop. Saved configuration is retained.</p>':''}<div class="field-triple" style="margin-top:4px"><select data-itemdef-useaction="${i}">${!Object.prototype.hasOwnProperty.call(ACTION_TYPES,d.useAction.action)?'<option selected disabled>Unavailable saved Use Action</option>':''}${Object.entries(ACTION_TYPES).filter(([t]) => t !== 'graph' && t !== 'dialogueTree').map(([t, def]) => `<option value="${t}"${d.useAction.action === t ? ' selected' : ''}>${escapeHtml(def.label)}</option>`).join('')}</select></div>${(Object.prototype.hasOwnProperty.call(ACTION_TYPES,d.useAction.action)?ACTION_TYPES[d.useAction.action]:null)?.fields.map(f=>`<div class="field-row"><label>${escapeHtml(f.label||f.key)}</label>${renderActionFieldInput(f,d.useAction.params?.[f.key],`itemdef-param-${i}-${f.key}`,d.useAction.params||{},null)}</div>`).join('')||''}` : ''}
      </div>`).join('');
  }
  listEl.querySelectorAll('[data-itemdef-remove]').forEach((btn) => { const def=currentItemDefs[Number(btn.dataset.itemdefRemove)];btn.disabled=!itemDefinitionAuthoringOwner(def);btn.onclick = () => { if(!itemDefinitionAuthoringOwner(def))return;pushUndo(); currentItemDefs.splice(currentItemDefs.indexOf(def), 1); renderItemDefList(); }; });
  for(const [attribute,key,type]of [['name','name','text'],['desc','description','text'],['stackable','stackable','checkbox'],['maxstack','maxStack','number'],['slot','equipSlot','text']])listEl.querySelectorAll(`[data-itemdef-${attribute}]`).forEach(input=>bindItemDefinitionField(input,currentItemDefs[Number(input.dataset['itemdef'+attribute[0].toUpperCase()+attribute.slice(1)])],key,type));
  listEl.querySelectorAll('[id^="itemdef-icon-"]').forEach(sel=>bindItemDefinitionField(sel,currentItemDefs[Number(sel.id.replace('itemdef-icon-',''))],'iconTextureAssetId','select'));
listEl.querySelectorAll('[id^="itemdef-param-"]').forEach(input=>{const [,index,key]=input.id.match(/^itemdef-param-(\d+)-(.+)$/)||[];const def=currentItemDefs[Number(index)],action=Object.prototype.hasOwnProperty.call(ACTION_TYPES,def?.useAction?.action)?ACTION_TYPES[def.useAction.action]:null,field=action?.fields.find(f=>f.key===key);if(field){const refresh=def.useAction.action==='useItem'&&key==='itemId'||field.type==='signalRef'||key==='valueType'||def.useAction.action==='cameraShake'&&key==='preset'||key==='targetId'&&action.fields.some(f=>f.type==='spriteAnimationState');bindItemDefinitionField(input,def,field,field.type==='checkbox'?'checkbox':input.tagName==='SELECT'?'select':field.type==='number'?'number':'text',refresh?renderItemDefList:undefined);}});
  listEl.querySelectorAll('[data-itemdef-hasuse]').forEach((cb) => {
    bindItemDefinitionField(cb,currentItemDefs[Number(cb.dataset.itemdefHasuse)],'hasUseAction','checkbox',renderItemDefList);
  });
  listEl.querySelectorAll('[data-itemdef-useaction]').forEach((sel) => {
    bindItemDefinitionField(sel,currentItemDefs[Number(sel.dataset.itemdefUseaction)],'useActionType','select',renderItemDefList);
  });
  renderInventoryTemplateLibrary();
  const addBtn = document.getElementById('item-def-add-btn');
  if (addBtn) {
    addBtn.disabled=playMode;
    addBtn.onclick = () => {
      if(playMode)return;
      const id = generateItemDefId();
      if (!id) { showStatus('Item identity allocator is unavailable. Existing Items and references were not changed.'); return; }
      pushUndo();
      currentItemDefs.push({ id, name: `Item ${currentItemDefs.length + 1}`, description: '', stackable: true, maxStack: 99 });
      renderItemDefList();
    };
  }
}
// A fresh blank editor must wire Add Item too, not only imported projects.
renderItemDefList();
renderLootTableList();
function renderSequencePanel() {
  renderCinematicTemplateLibrary();
  const select = document.getElementById('sequence-select');
  if (currentSequences.length === 0) {
    select.innerHTML = '<option value="">No sequences yet</option>';
  } else {
    if (!findSequenceById(selectedSequenceId)) selectedSequenceId = currentSequences.find(s=>s&&findSequenceById(s.id)===s)?.id || null;
    select.innerHTML = currentSequences.map((s) => s&&findSequenceById(s.id)===s ? `<option value="${escapeHtml(s.id)}"${s.id === selectedSequenceId ? ' selected' : ''}>${escapeHtml(s.name)}</option>` : '<option disabled>Unavailable saved Sequence (retained)</option>').join('');
  }
  // Every ACTION_TYPES entry works as a Sequence step EXCEPT the two that
  // open their own sub-editor (Node Graph/Dialogue Tree have no flat field
  // list a Sequence step could execute standalone) -- plus a synthetic
  // Delay/Wait choice, which isn't a real action at all.
  const stepTypeSelect = document.getElementById('sequence-add-step-type');
  const current = stepTypeSelect.value, query = document.getElementById('sequence-action-search').value;
  const choices = OpusAuthoringLanguage.logicEntries(ACTION_TYPES,{surface:'sequence'}).filter(meta=>meta.id===current||OpusAuthoringLanguage.matchesLogicEntry(meta,query));
  stepTypeSelect.innerHTML = choices.map(meta=>`<option value="${escapeHtml(meta.id)}" title="${escapeHtml(meta.help)}">${meta.kind==='delay'?'⏱ ':''}${escapeHtml(meta.label)}</option>`).join('');
  if (choices.some(meta=>meta.id===current)) stepTypeSelect.value = current;
  renderSequenceStepList();
}
function renderSequenceStepList() {
  const listEl = document.getElementById('sequence-step-list');
  const seq = findSequenceById(selectedSequenceId);
  if (!seq) { listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No sequence selected -- create one above.</p>'; return; }
  if (!Array.isArray(seq.steps)) { listEl.innerHTML = '<p class="field-help">Unavailable saved steps container. Retained unchanged; no automatic replacement.</p>'; return; }
  const authoredSteps = seq.steps;
  const renderedSteps = Array.isArray(authoredSteps) ? authoredSteps.slice() : [];
  const ownerLevelIndex = typeof currentLevelIndex === 'undefined' ? undefined : currentLevelIndex;
  // History restoration replaces records. Detached controls must not edit an old
  // Sequence, another selection/level, or a running preview.
  const ownsSteps = () => !playMode && selectedSequenceId === seq.id && findSequenceById(seq.id) === seq && seq.steps === authoredSteps && Array.isArray(seq.steps) && seq.steps.length === renderedSteps.length && seq.steps.every((step,index)=>step===renderedSteps[index]) && (ownerLevelIndex === undefined || currentLevelIndex === ownerLevelIndex);
  if (seq.steps.length === 0) { listEl.innerHTML = '<p style="color:#66759a;font-size:11px;margin:2px 0">No steps yet -- add one below.</p>'; return; }
  listEl.innerHTML = seq.steps.map((step, i) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) return `<div class="hud-element-row"><span>${i+1}. Unavailable saved step (retained unchanged)</span></div>`;
    if (step.kind !== undefined && step.kind !== 'action' && step.kind !== 'delay') return `<div class="hud-element-row"><span>${i+1}. Unavailable saved step kind (retained unchanged)</span></div>`;
    const isDelay = step.kind === 'delay';
    const def = !isDelay && Object.prototype.hasOwnProperty.call(ACTION_TYPES,step.actionType) ? ACTION_TYPES[step.actionType] : null;
    const validDelay = Number.isFinite(step.seconds) && step.seconds >= 0;
    const label = isDelay ? (validDelay ? `⏱ Delay ${step.seconds}s` : 'Unavailable saved Delay') : (def ? def.label : step.actionType);
    const fieldsHTML = isDelay
      ? `<div class="field-row"><label>Seconds</label><input type="number" step="0.1" min="0" data-seq-delay value="${validDelay ? step.seconds : ''}" placeholder="${validDelay ? 'Seconds' : 'Unavailable saved time'}"></div>${validDelay ? '' : '<p class="field-help">Saved time retained. Enter finite seconds, zero or greater, to replace it.</p>'}`
      : (step.params !== undefined && (!step.params || typeof step.params !== 'object' || Array.isArray(step.params)) ? '<p class="field-help">Unavailable saved parameters (retained unchanged).</p>' : def ? def.fields.map((f) => `<div class="field-row"><label>${escapeHtml(f.label || f.key)}</label>${renderActionFieldInput(f, step.params ? step.params[f.key] : undefined, null, step.params || {}, null)}</div>`).join('') : '<p style="color:#c0524f;font-size:11px;margin:2px 0">Unavailable saved action type (retained unchanged).</p>');
    return `
      <div class="hud-element-row" data-seq-step="${i}">
        <div class="hud-element-row-header">
          <span>${i + 1}. ${escapeHtml(label)}</span>
          <button class="hud-remove-btn" data-seq-step-remove="${i}" title="Delete step">✕</button>
        </div>
        <div class="field-triple" style="margin-bottom:4px">
          <button class="toolbar-btn" data-seq-step-up="${i}" style="margin-bottom:0"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="toolbar-btn" data-seq-step-down="${i}" style="margin-bottom:0"${i === seq.steps.length - 1 ? ' disabled' : ''}>↓</button>
          <button class="toolbar-btn" data-seq-step-dup="${i}" style="margin-bottom:0">⧉ Dup</button>
        </div>
        ${fieldsHTML}
      </div>`;
  }).join('');
  listEl.querySelectorAll('[data-seq-step]').forEach((row) => {
    const i = Number(row.dataset.seqStep);
    const step = seq.steps[i];
    if (!step || typeof step !== 'object' || Array.isArray(step)) return;
    row.querySelectorAll('[data-seq-delay]').forEach((input) => {
      bindLevelLogicHistory(input,()=>step.seconds,()=>input.value.trim()===''?NaN:Number(input.value),value=>{step.seconds=value;},'input',value=>ownsSteps()&&seq.steps[i]===step&&Number.isFinite(value)&&value>=0);
      input.addEventListener('change',()=>{if(ownsSteps()&&seq.steps[i]===step)input.value=Number.isFinite(step.seconds)&&step.seconds>=0?String(step.seconds):'';});
    });
    if (step.kind === 'action' && Object.prototype.hasOwnProperty.call(ACTION_TYPES,step.actionType)) {
      const def = ACTION_TYPES[step.actionType];
      row.querySelectorAll('[data-field]').forEach((input) => {
        const f = def.fields.find((fld) => fld.key === input.dataset.field);
        if (!f) return;
        let params = step.params;
        const handler = value => {
          step.params = step.params || {};
          step.params[f.key] = value;
          params = step.params;
          if(f.type==='signalRef'&&step.actionType==='sendSignal'&&step.params.payload===undefined)step.params.payload=signalPayloadDefault(value);
          if (f.type==='signalRef' || step.actionType==='cameraShake'&&f.key==='preset' || (f.key === 'targetId' && def.fields.some((field) => field.type === 'spriteAnimationState'))) renderSequenceStepList();
        };
        const validParams = () => step.params === params && (params === undefined || !!params && typeof params === 'object' && !Array.isArray(params));
        const readNext = () => input.type === 'number' && !f.cameraShakeScalar ? (input.value.trim() === '' ? NaN : Number(input.value)) : readActionFieldValue(f,input);
        bindLevelLogicHistory(input,()=>step.params?.[f.key],readNext,handler,input.tagName==='SELECT'?'change':'input',value=>ownsSteps()&&seq.steps[i]===step&&validParams()&&(input.type!=='number'||f.cameraShakeScalar||Number.isFinite(value))&&(step.actionType!=='cameraShake'||!!resolveCameraShakePolicy({...step.params,[f.key]:value})));
      });
    }
  });
  listEl.querySelectorAll('[data-seq-step-remove]').forEach((btn) => {
    const i = Number(btn.dataset.seqStepRemove), step = seq.steps[i];
    btn.onclick = () => { if(!ownsSteps()||seq.steps[i]!==step)return; pushUndo(); seq.steps.splice(i, 1); renderSequenceStepList(); };
  });
  listEl.querySelectorAll('[data-seq-step-up]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.seqStepUp);
      if (!ownsSteps() || !Number.isInteger(i) || i <= 0 || i >= seq.steps.length) return;
      pushUndo();
      [seq.steps[i - 1], seq.steps[i]] = [seq.steps[i], seq.steps[i - 1]];
      renderSequenceStepList();
    };
  });
  listEl.querySelectorAll('[data-seq-step-down]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.seqStepDown);
      if (!ownsSteps() || !Number.isInteger(i) || i < 0 || i >= seq.steps.length - 1) return;
      pushUndo();
      [seq.steps[i + 1], seq.steps[i]] = [seq.steps[i], seq.steps[i + 1]];
      renderSequenceStepList();
    };
  });
  listEl.querySelectorAll('[data-seq-step-dup]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.seqStepDup);
      if (!ownsSteps() || !Number.isInteger(i) || i < 0 || i >= seq.steps.length) return;
      const copy = JSON.parse(JSON.stringify(seq.steps[i]));
      pushUndo();
      seq.steps.splice(i + 1, 0, copy);
      renderSequenceStepList();
    };
  });
}
document.getElementById('sequence-action-search').addEventListener('input', renderSequencePanel);
document.getElementById('sequence-select').addEventListener('change', (e) => {
  selectedSequenceId = e.target.value || null;
  renderSequenceStepList();
});
document.getElementById('sequence-add-btn').addEventListener('click', () => {
  if (playMode || !Array.isArray(currentSequences)) return;
  pushUndo();
  const seq = defaultSequence();
  currentSequences.push(seq);
  selectedSequenceId = seq.id;
  renderSequencePanel();
});
document.getElementById('sequence-rename-btn').addEventListener('click', () => {
  const seq = findSequenceById(selectedSequenceId);
  if (playMode || !seq) return;
  const name = prompt('Rename sequence:', seq.name);
  if (name && name.trim() && name.trim() !== seq.name && !playMode && findSequenceById(selectedSequenceId) === seq) { pushUndo(); seq.name = name.trim(); renderSequencePanel(); }
});
document.getElementById('sequence-duplicate-btn').addEventListener('click', () => {
  const seq = findSequenceById(selectedSequenceId);
  if (playMode || !seq || !Array.isArray(seq.steps)) return;
  const copy = { id: generateSequenceId(), name: `${seq.name} Copy`, steps: JSON.parse(JSON.stringify(seq.steps)) };
  pushUndo();
  currentSequences.push(copy);
  selectedSequenceId = copy.id;
  renderSequencePanel();
});
document.getElementById('sequence-delete-btn').addEventListener('click', () => {
  const seq = findSequenceById(selectedSequenceId);
  if (playMode || !seq) return;
  pushUndo();
  currentSequences = currentSequences.filter((s) => s !== seq);
  selectedSequenceId = currentSequences.find(s=>s&&findSequenceById(s.id)===s)?.id || null;
  renderSequencePanel();
});
document.getElementById('sequence-add-step-btn').addEventListener('click', () => {
  const seq = findSequenceById(selectedSequenceId);
  if (!seq) { showStatus('Create a Sequence first'); return; }
  if (playMode || !Array.isArray(seq.steps)) return;
  const type = document.getElementById('sequence-add-step-type').value;
  if (type !== '__delay' && (!Object.prototype.hasOwnProperty.call(ACTION_TYPES,type) || type === 'graph' || type === 'dialogueTree')) return;
  pushUndo();
  if (type === '__delay') seq.steps.push({ kind: 'delay', seconds: 1 });
  else seq.steps.push({ kind: 'action', actionType: type, params: {} });
  renderSequenceStepList();
});

