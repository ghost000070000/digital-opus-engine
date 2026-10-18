/* Digital Opus reusable Inspector field editors. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OpusInspectorFields = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FIELD_TYPES = Object.freeze([
    'boolean', 'integer', 'number', 'string', 'multiline', 'enum', 'color', 'vec2', 'vec3',
    'assetRef', 'objectRef', 'levelRef', 'objectiveRef', 'prefabRef', 'sortingLayerRef', 'parallaxLayerRef', 'collisionLayerRef', 'collisionMaskRefs', 'itemRef', 'inputActionRef',
  ]);
  const REFERENCE_TYPES = Object.freeze(['asset', 'object', 'level', 'objective', 'prefab', 'sortingLayer', 'parallaxLayer', 'collisionLayer', 'item', 'inputAction']);

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function sameValue(left, right) {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
    return false;
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function descriptor(input, defaultValue) {
    if (!input || !input.key || !FIELD_TYPES.includes(input.type)) throw new Error('Inspector field needs a key and supported type');
    const referenceType = input.type.endsWith('Ref') ? input.type.slice(0, -3) : null;
    if (referenceType && !REFERENCE_TYPES.includes(referenceType)) throw new Error(`Unsupported reference type ${referenceType}`);
    if (input.min != null && input.max != null && Number(input.min) > Number(input.max)) throw new Error(`${input.key}: min may not exceed max`);
    return Object.freeze({
      label: input.key,
      help: '',
      required: false,
      nullable: input.required !== true,
      disabled: false,
      readOnly: false,
      precision: null,
      ...input,
      referenceType,
      defaultValue: clone(defaultValue !== undefined ? defaultValue : input.defaultValue),
    });
  }

  function issue(field, code, message) {
    return { field: field.key, severity: 'error', code, message };
  }

  function finiteNumber(field, raw, integer) {
    if (raw === '' || raw === null || raw === undefined) {
      return field.required
        ? { valid: false, empty: true, value: null, issues: [issue(field, 'required', `${field.label} is required.`)] }
        : { valid: true, empty: true, value: field.nullable ? null : clone(field.defaultValue), issues: [] };
    }
    let value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) return { valid: false, empty: false, value: null, issues: [issue(field, 'finite-number', `${field.label} must be a finite number.`)] };
    if (integer) value = Math.round(value);
    if (field.min != null) value = Math.max(Number(field.min), value);
    if (field.max != null) value = Math.min(Number(field.max), value);
    if (!integer && Number.isInteger(field.precision) && field.precision >= 0) value = Number(value.toFixed(field.precision));
    return { valid: true, empty: false, value, issues: [] };
  }

  function coerceValue(input, raw) {
    if (input.type === 'collisionMaskRefs') return Array.isArray(raw) ? { valid: true, empty: false, value: [...new Set(raw)].sort(), issues: [] } : { valid: false, value: raw, issues: [issue(input, 'invalid-mask', 'Select Collision Layers from the list.')] };
    const field = input.defaultValue !== undefined || Object.isFrozen(input) ? input : descriptor(input);
    if (field.type === 'boolean') return { valid: true, empty: false, value: !!raw, issues: [] };
    if (field.type === 'number') return finiteNumber(field, raw, false);
    if (field.type === 'integer') return finiteNumber(field, raw, true);
    if (field.type === 'vec2' || field.type === 'vec3') {
      const dimensions = field.type === 'vec2' ? 2 : 3;
      const source = Array.isArray(raw) ? raw : [];
      if (source.length < dimensions) return { valid: false, empty: false, value: null, issues: [issue(field, 'vector-size', `${field.label} requires ${dimensions} values.`)] };
      const values = [];
      const issues = [];
      for (let index = 0; index < dimensions; index++) {
        const result = finiteNumber({ ...field, key: field.key, label: `${field.label} ${'XYZ'[index]}`, required: true }, source[index], false);
        if (!result.valid) issues.push(...result.issues);
        else values.push(result.value);
      }
      return { valid: issues.length === 0, empty: false, value: issues.length ? null : values, issues };
    }
    if (raw === '' || raw === null || raw === undefined) {
      return field.required
        ? { valid: false, empty: true, value: field.nullable ? null : '', issues: [issue(field, 'required', `${field.label} is required.`)] }
        : { valid: true, empty: true, value: field.nullable ? null : clone(field.defaultValue), issues: [] };
    }
    if (field.type === 'enum') {
      if (!(field.choices || []).includes(raw)) return { valid: false, empty: false, value: raw, issues: [issue(field, 'invalid-choice', `${field.label} has an unsupported choice.`)] };
      return { valid: true, empty: false, value: raw, issues: [] };
    }
    if (field.type === 'color') {
      const value = String(raw).toLowerCase();
      return /^#[0-9a-f]{6}$/.test(value)
        ? { valid: true, empty: false, value, issues: [] }
        : { valid: false, empty: false, value, issues: [issue(field, 'invalid-color', `${field.label} must be a six-digit color.`)] };
    }
    return { valid: true, empty: false, value: String(raw), issues: [] };
  }

  function validateValue(input, value) {
    const field = input.defaultValue !== undefined || Object.isFrozen(input) ? input : descriptor(input);
    const result = coerceValue(field, value);
    if (result.valid && typeof field.validate === 'function') {
      const extra = field.validate(result.value) || [];
      result.issues.push(...extra.map((entry) => ({ field: field.key, severity: 'error', ...entry })));
      result.valid = result.issues.length === 0;
    }
    return result;
  }

  function isModified(input, value) {
    const field = input.defaultValue !== undefined || Object.isFrozen(input) ? input : descriptor(input);
    return !sameValue(value, field.defaultValue);
  }

  function resetValue(input) {
    const field = input.defaultValue !== undefined || Object.isFrozen(input) ? input : descriptor(input);
    return clone(field.defaultValue);
  }

  function attrs(field, accessibleLabel) {
    return `${field.disabled ? ' disabled' : ''}${field.readOnly ? ' readonly aria-readonly="true"' : ''} aria-label="${escapeHtml(accessibleLabel || field.label)}"`;
  }

  function referenceOptions(field, value, options) {
    const list = (options || []).map((entry) => typeof entry === 'string' ? { value: entry, label: entry } : entry);
    if (value != null && value !== '' && !list.some((entry) => entry.value === value)) list.unshift({ value, label: `(Missing) ${value}`, unavailable: true });
    const emptyLabel = field.required ? 'Select…' : 'None';
    return `<option value="">${emptyLabel}</option>${list.map((entry) => `<option value="${escapeHtml(entry.value)}"${entry.value === value ? ' selected' : ''}${entry.unavailable ? ' data-unavailable="true"' : ''}>${escapeHtml(entry.label)}</option>`).join('')}`;
  }

  function controlHtml(input, value, options) {
    const field = input.defaultValue !== undefined || Object.isFrozen(input) ? input : descriptor(input);
    const data = `data-field-editor-key="${escapeHtml(field.key)}" data-component-field="${escapeHtml(field.key)}"`;
    const common = attrs(field);
    if (field.type === 'collisionMaskRefs') {
      const selected = Array.isArray(value) ? value : [], list = (options || []).slice();
      for (const id of selected) if (!list.some((option) => option.value === id)) list.push({ value: id, label: `(Missing) ${id}` });
      return `<div data-mask-group="${escapeHtml(field.key)}"><input type="search" data-mask-search aria-label="Search accepted Collision Layers" placeholder="Search layers"><button type="button" data-mask-select="all"${common}>Select All</button><button type="button" data-mask-select="none"${common}>Clear All</button>${list.map((option) => `<label data-mask-option style="display:block"><input type="checkbox" ${data} value="${escapeHtml(option.value)}"${selected.includes(option.value) ? ' checked' : ''}${attrs(field, option.label)}>${escapeHtml(option.label)}</label>`).join('')}</div>`;
    }
    if (field.type === 'boolean') return `<input type="checkbox" ${data}${value ? ' checked' : ''}${common}>`;
    if (field.type === 'color') {
      const current = value || field.defaultValue || '#ffffff';
      return `<div class="field-editor-color"><input type="color" ${data} data-field-editor-color-role="picker" value="${escapeHtml(current)}"${attrs(field, `${field.label} picker`)}><input type="text" ${data} data-field-editor-color-role="text" value="${escapeHtml(current)}" pattern="#[0-9a-fA-F]{6}" spellcheck="false"${attrs(field, `${field.label} hex value`)}></div>`;
    }
    if (field.type === 'enum') return `<select ${data}${common}>${referenceOptions({ ...field, required: true }, value, (field.choices || []).map((choice) => ({ value: choice, label: (field.choiceLabels && field.choiceLabels[choice]) || choice })))}</select>`;
    if (field.type.endsWith('Ref')) return `<select ${data}${common}>${referenceOptions(field, value, options)}</select>`;
    if (field.type === 'vec2' || field.type === 'vec3') {
      const axes = field.type === 'vec2' ? ['x', 'y'] : ['x', 'y', 'z'];
      const current = Array.isArray(value) ? value : (Array.isArray(field.defaultValue) ? field.defaultValue : axes.map(() => 0));
      return `<div class="field-editor-vector">${axes.map((axis, index) => `<input type="number" ${data} data-field-editor-axis="${axis}" data-component-axis="${axis}" value="${escapeHtml(current[index])}"${field.min != null ? ` min="${field.min}"` : ''}${field.max != null ? ` max="${field.max}"` : ''}${field.step != null ? ` step="${field.step}"` : ''}${attrs(field, `${field.label} ${axis.toUpperCase()}`)}>`).join('')}</div>`;
    }
    if (field.type === 'multiline') return `<textarea ${data}${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}${common}>${escapeHtml(value == null ? '' : value)}</textarea>`;
    if (field.type === 'string') return `<input type="text" ${data} value="${escapeHtml(value == null ? '' : value)}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}${common}>`;
    return `<input type="number" ${data} value="${escapeHtml(value == null ? '' : value)}"${field.min != null ? ` min="${field.min}"` : ''}${field.max != null ? ` max="${field.max}"` : ''}${field.step != null ? ` step="${field.step}"` : ''}${common}>`;
  }

  function rawFromControl(container, field, control) {
    if (field.type === 'collisionMaskRefs') return [...container.querySelectorAll(`[data-field-editor-key="${field.key}"]:checked`)].map((entry) => entry.value);
    if (field.type === 'boolean') return control.checked;
    if (field.type === 'vec2' || field.type === 'vec3') {
      const axes = field.type === 'vec2' ? ['x', 'y'] : ['x', 'y', 'z'];
      return axes.map((axis) => container.querySelector(`[data-field-editor-key="${field.key}"][data-field-editor-axis="${axis}"]`).value);
    }
    return control.value;
  }

  function writeControls(container, field, value) {
    const controls = [...container.querySelectorAll(`[data-field-editor-key="${field.key}"]`)];
    if (field.type === 'collisionMaskRefs') controls.forEach((control) => { control.checked = (value || []).includes(control.value); });
    else if (field.type === 'boolean') controls[0].checked = !!value;
    else if (field.type === 'color') controls.forEach((control) => { control.value = value == null ? '' : value; });
    else if (field.type === 'vec2' || field.type === 'vec3') controls.forEach((control, index) => { control.value = value[index]; });
    else controls[0].value = value == null ? '' : value;
  }

  function renderIssues(container, issues) {
    const target = container.querySelector('[data-field-editor-issues]');
    if (!target) return;
    target.innerHTML = (issues || []).map((entry) => `<div class="authoring-issue authoring-issue-${escapeHtml(entry.severity || 'error')}" data-field-issue="${escapeHtml(entry.field || '')}">${escapeHtml(entry.message)}</div>`).join('');
  }

  function mountSection(container, config) {
    const fields = (config.fields || []).map((field) => descriptor(field, field.defaultValue));
    const values = config.values || {};
    const sectionDisabled = !!config.disabled;
    const rows = fields.map((field) => {
      const current = values[field.key];
      const modified = isModified(field, current);
      const effective = sectionDisabled ? { ...field, disabled: true } : field;
      const options = typeof config.optionsFor === 'function' ? config.optionsFor(field) : [];
      return `<div class="schema-component-field field-editor-row${modified ? ' is-modified' : ''}" data-field-editor-row="${escapeHtml(field.key)}" data-component-field-row="${escapeHtml(field.key)}"><div class="field-editor-heading"><label>${escapeHtml(field.label)}${field.required ? '<span class="field-editor-required" aria-label="required"> *</span>' : ''}</label><button type="button" class="field-editor-reset" data-field-editor-reset="${escapeHtml(field.key)}"${modified && !effective.disabled && !effective.readOnly ? '' : ' disabled'} title="Reset to default">Reset</button></div>${field.help ? `<div class="schema-component-help">${escapeHtml(field.help)}</div>` : ''}${controlHtml(effective, current, options)}<div aria-live="polite" data-field-editor-local-issues="${escapeHtml(field.key)}"></div></div>`;
    }).join('');
    container.classList.add('schema-component-section', 'field-editor-section');
    container.dataset.componentId = config.id || '';
    container.tabIndex = -1;
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', config.label || config.id || 'Component fields');
    container.innerHTML = `<div class="field-row"><div class="field-editor-section-heading"><label>${config.icon ? `<span aria-hidden="true">${escapeHtml(config.icon)}</span> ` : ''}${escapeHtml(config.label || config.id || 'Fields')}</label>${config.category ? `<span class="field-editor-category">${escapeHtml(config.category)}</span>` : ''}</div>${config.help ? `<div class="schema-component-help">${escapeHtml(config.help)}</div>` : ''}<div data-component-fields>${rows}</div><div aria-live="polite" data-field-editor-issues data-component-issues></div></div>`;
    const maskRow = container.querySelector('[data-field-editor-row="collisionMaskRefs"]');
    if (maskRow) maskRow.hidden = values.collisionMaskMode !== 'custom';

    // History belongs to a real valid mutation, not merely focusing a control.
    // Coalesce continuous typing within one field/focus session, while Tab into
    // an untouched next field creates no empty Undo transaction.
    const edited = new Set();
    container.addEventListener('focusout', (event) => {
      const control = event.target.closest('[data-field-editor-key]');
      const next = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest('[data-field-editor-key]') : null;
      if (control && (!next || next.dataset.fieldEditorKey !== control.dataset.fieldEditorKey)) edited.delete(control.dataset.fieldEditorKey);
    });

    const apply = (field, raw, syncControls) => {
      const result = validateValue(field, raw);
      const local = container.querySelector(`[data-field-editor-local-issues="${field.key}"]`);
      local.innerHTML = result.issues.map((entry) => `<div class="authoring-issue authoring-issue-${escapeHtml(entry.severity || 'error')}">${escapeHtml(entry.message)}</div>`).join('');
      const row = container.querySelector(`[data-field-editor-row="${field.key}"]`);
      if (!result.valid) {
        row.classList.add('has-error');
        row.querySelector('[data-field-editor-reset]').disabled = field.disabled || field.readOnly || sectionDisabled;
        return result;
      }
      row.classList.remove('has-error');
      const changed = !sameValue(values[field.key], result.value);
      if(changed&&config.canChange&&config.canChange(field)===false){writeControls(container,field,values[field.key]);return {...result,valid:false};}
      if (changed && !edited.has(field.key)) {
        if (config.onBeforeChange&&config.onBeforeChange(field)===false){writeControls(container,field,values[field.key]);return {...result,valid:false};}
        edited.add(field.key);
      }
      values[field.key] = clone(result.value);
      if (field.key === 'collisionMaskMode' && maskRow) maskRow.hidden = result.value !== 'custom';
      if (syncControls) writeControls(container, field, result.value);
      const external = changed && config.onChange
        ? config.onChange(field, clone(result.value), result) || []
        : typeof config.validate === 'function' ? config.validate() || [] : [];
      const modified = isModified(field, values[field.key]);
      row.classList.toggle('is-modified', modified);
      row.querySelector('[data-field-editor-reset]').disabled = !modified || field.disabled || field.readOnly || sectionDisabled;
      renderIssues(container, external);
      return result;
    };

    container.addEventListener('input', (event) => {
      if (event.target.matches('[data-mask-search]')) {
        const query = event.target.value.toLowerCase();
        event.target.closest('[data-mask-group]').querySelectorAll('[data-mask-option]').forEach((option) => { option.hidden = !option.textContent.toLowerCase().includes(query); });
        return;
      }
      const control = event.target.closest('[data-field-editor-key]');
      if (!control) return;
      const field = fields.find((entry) => entry.key === control.dataset.fieldEditorKey);
      if (!field || field.disabled || field.readOnly || sectionDisabled) return;
      apply(field, rawFromControl(container, field, control), false);
    });
    container.addEventListener('change', (event) => {
      const control = event.target.closest('[data-field-editor-key]');
      if (!control) return;
      const field = fields.find((entry) => entry.key === control.dataset.fieldEditorKey);
      if (!field || field.disabled || field.readOnly || sectionDisabled) return;
      apply(field, rawFromControl(container, field, control), true);
    });
    container.addEventListener('click', (event) => {
      const maskButton = event.target.closest('[data-mask-select]');
      if (maskButton) {
        const group = maskButton.closest('[data-mask-group]'), field = fields.find((entry) => entry.key === group.dataset.maskGroup);
        if (maskButton.disabled || sectionDisabled) return;
        edited.delete(field.key);
        const refs = maskButton.dataset.maskSelect === 'all' ? [...group.querySelectorAll('[data-field-editor-key]')].map((control) => control.value) : [];
        apply(field, refs, true); return;
      }
      const button = event.target.closest('[data-field-editor-reset]');
      if (!button || button.disabled) return;
      const field = fields.find((entry) => entry.key === button.dataset.fieldEditorReset);
      if (!field) return;
      edited.delete(field.key);
      const value = resetValue(field);
      writeControls(container, field, value);
      apply(field, value, true);
    });
    const validate = () => {
      const localIssues = fields.flatMap((field) => validateValue(field, values[field.key]).issues);
      const externalIssues = typeof config.validate === 'function' ? config.validate() || [] : [];
      const issues = [...localIssues, ...externalIssues];
      renderIssues(container, issues);
      return issues;
    };
    validate();
    return Object.freeze({ fields, values, validate });
  }

  return Object.freeze({ FIELD_TYPES, REFERENCE_TYPES, descriptor, coerceValue, validateValue, isModified, resetValue, controlHtml, mountSection, sameValue });
});
