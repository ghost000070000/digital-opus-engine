function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'style') Object.assign(e.style, value);
    else if (key === 'text') e.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') e.addEventListener(key.slice(2).toLowerCase(), value);
    else e.setAttribute(key, value);
  }
  for (const child of children) e.appendChild(child);
  return e;
}

function hudButtonStyle() {
  return {
    position: 'absolute',
    top: '10px',
    background: 'rgba(20, 26, 40, 0.75)',
    color: '#dce6f5',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    padding: '6px 12px',
    font: '12px system-ui, sans-serif',
    cursor: 'pointer',
    pointerEvents: 'auto',
  };
}

class HUD {
  constructor() {
    this.root = el('div', {
      id: 'hud',
      style: {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        fontFamily: 'system-ui, sans-serif',
        color: '#dce6f5',
        userSelect: 'none',
      },
    });
    document.body.appendChild(this.root);

    this.fpsLabel = el('div', {
      text: 'FPS: --',
      style: {
        position: 'absolute', top: '10px', right: '14px',
        font: '12px/1.4 system-ui, sans-serif', opacity: '0.85',
      },
    });
    this.root.appendChild(this.fpsLabel);

    this.pauseBtn = el('button', {
      text: 'Pause',
      style: { ...hudButtonStyle(), left: '14px' },
      onclick: () => this._onPauseToggle && this._onPauseToggle(),
    });
    this.root.appendChild(this.pauseBtn);

    this.qualityBtn = el('button', {
      text: 'Quality: High',
      style: { ...hudButtonStyle(), left: '92px' },
      onclick: () => this._onQualityToggle && this._onQualityToggle(),
    });
    this.root.appendChild(this.qualityBtn);

    this.saveBtn = el('button', {
      text: 'Save',
      style: { ...hudButtonStyle(), left: '206px' },
      onclick: () => this._onSave && this._onSave(),
    });
    this.root.appendChild(this.saveBtn);

    this.loadBtn = el('button', {
      text: 'Load',
      style: { ...hudButtonStyle(), left: '260px' },
      onclick: () => this._onLoad && this._onLoad(),
    });
    this.root.appendChild(this.loadBtn);

    this.screenshotBtn = el('button', {
      text: 'Screenshot',
      style: { ...hudButtonStyle(), left: '314px' },
      onclick: () => this._onScreenshot && this._onScreenshot(),
    });
    this.root.appendChild(this.screenshotBtn);

    this.soundBtn = el('button', {
      text: 'Sound: On',
      style: { ...hudButtonStyle(), left: '404px' },
      onclick: () => this._onSoundToggle && this._onSoundToggle(),
    });
    this.root.appendChild(this.soundBtn);

    this.statusLabel = el('div', {
      style: {
        position: 'absolute', top: '44px', left: '14px',
        font: '12px/1.4 system-ui, sans-serif', opacity: '0',
        transition: 'opacity 0.2s',
      },
    });
    this.root.appendChild(this.statusLabel);

    this.pausedOverlay = el('div', {
      text: 'PAUSED',
      style: {
        position: 'absolute', inset: '0', display: 'none',
        alignItems: 'center', justifyContent: 'center',
        font: '32px/1 system-ui, sans-serif', letterSpacing: '0.2em',
        background: 'rgba(4, 6, 12, 0.35)', color: '#f0f4ff',
      },
    });
    this.root.appendChild(this.pausedOverlay);

    this._fpsAccum = 0;
    this._fpsFrames = 0;

    // Registry for custom dynamic primitives/overlays
    this._primitives = new Map();
    this._nextId = 1;
    this._timers = new Set();
  }

  _later(fn, delay) {
    const timer = setTimeout(() => { this._timers.delete(timer); fn(); }, delay);
    this._timers.add(timer);
    return timer;
  }

  onPauseToggle(fn) { this._onPauseToggle = fn; }
  onQualityToggle(fn) { this._onQualityToggle = fn; }
  onSave(fn) { this._onSave = fn; }
  onLoad(fn) { this._onLoad = fn; }
  onScreenshot(fn) { this._onScreenshot = fn; }
  onSoundToggle(fn) { this._onSoundToggle = fn; }

  setSoundLabel(on) {
    this.soundBtn.textContent = `Sound: ${on ? 'On' : 'Off'}`;
  }

  setPaused(paused) {
    this.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    this.pausedOverlay.style.display = paused ? 'flex' : 'none';
  }

  setQualityLabel(label) {
    this.qualityBtn.textContent = `Quality: ${label}`;
  }

  showStatus(text) {
    this.statusLabel.textContent = text;
    this.statusLabel.style.opacity = '0.85';
    clearTimeout(this._statusTimer);
    this._statusTimer = this._later(() => {
      this.statusLabel.style.opacity = '0';
    }, 1500);
  }

  reportFrame(dt) {
    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      const fps = Math.round(this._fpsFrames / this._fpsAccum);
      this.fpsLabel.textContent = `FPS: ${fps}`;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }
  }

  // --- Public HUD Primitives API ---

  _handle(id, node, update) {
    return {
      id,
      update: update || ((value) => { if (node.isConnected) node.textContent = String(value); }),
      show: () => { if (node.isConnected) node.style.display = ''; },
      hide: () => { if (node.isConnected) node.style.display = 'none'; },
      remove: () => this.removePrimitive(id, node),
    };
  }

  addLabel(props = {}) {
    const id = props.id ?? `label-${this._nextId++}`;
    this.removePrimitive(id);
    const labelEl = el('div', {
      id,
      text: props.text ?? '',
      style: {
        position: 'absolute',
        font: props.font ?? '14px/1.4 system-ui, sans-serif',
        color: props.color ?? '#dce6f5',
        pointerEvents: props.pointerEvents ? 'auto' : 'none',
        ...props.style,
      },
    });
    this.root.appendChild(labelEl);
    this._primitives.set(id, labelEl);
    const handle = this._handle(id, labelEl);
    handle.setText = handle.update;
    handle.setStyle = (styleObj) => { Object.assign(labelEl.style, styleObj); };
    return handle;
  }

  addPanel(props = {}) {
    const id = props.id ?? `panel-${this._nextId++}`;
    this.removePrimitive(id);
    const panelEl = el('div', {
      id,
      style: {
        position: 'absolute',
        background: 'rgba(15, 22, 36, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '8px',
        padding: '10px 16px',
        color: '#dce6f5',
        pointerEvents: props.pointerEvents ? 'auto' : 'none',
        ...props.style,
      },
    });
    this.root.appendChild(panelEl);
    this._primitives.set(id, panelEl);
    const handle = this._handle(id, panelEl, (content) => { panelEl.textContent = String(content); });
    handle.setStyle = (styleObj) => Object.assign(panelEl.style, styleObj);
    return handle;
  }

  addText(props = {}) { return this.addLabel(props); }
  addCounter(props = {}) { return this.addLabel({ ...props, text: props.text ?? `${props.label ?? ''}${props.value ?? 0}` }); }
  addTimer(props = {}) { return this.addLabel(props); }
  addSpeed(props = {}) { return this.addLabel(props); }
  addObjective(props = {}) { return this.addLabel(props); }

  addButton({ id, text = 'Button', onClick, style = {} } = {}) {
    callback(onClick, 'options.onClick', 'HUD.addButton', true);
    const key = id ?? `button-${this._nextId++}`;
    this.removePrimitive(key);
    const button = el('button', {
      id: key,
      text,
      style: { ...hudButtonStyle(), position: 'absolute', ...style },
      onclick: () => { if (onClick) onClick(); },
    });
    this.root.appendChild(button);
    this._primitives.set(key, button);
    return this._handle(key, button);
  }

  // A "held" button, not a click -- addButton's onClick only fires once a
  // press completes, which doesn't fit continuous input like a throttle or
  // a boost hold. Built for touch (Input.simulateKeyDown/Up covers the
  // common case of driving a keyboard-gated control from an on-screen
  // button), but works from mouse/pen input on the same element too, since
  // it's wired through Pointer Events rather than touch-specific ones.
  addTouchButton({ id, label = '', onStart, onEnd, style = {} } = {}) {
    callback(onStart, 'options.onStart', 'HUD.addTouchButton', true);
    callback(onEnd, 'options.onEnd', 'HUD.addTouchButton', true);
    const key = id ?? `touch-btn-${this._nextId++}`;
    this.removePrimitive(key);
    const press = (e) => { e.preventDefault(); if (onStart) onStart(); };
    const release = (e) => { e.preventDefault(); if (onEnd) onEnd(); };
    const button = el('button', {
      id: key,
      text: label,
      style: {
        ...hudButtonStyle(),
        position: 'absolute',
        fontSize: '22px',
        userSelect: 'none',
        touchAction: 'none',
        ...style,
      },
      onpointerdown: press,
      onpointerup: release,
      onpointerleave: release,
      onpointercancel: release,
      oncontextmenu: (e) => e.preventDefault(),
    });
    this.root.appendChild(button);
    this._primitives.set(key, button);
    return this._handle(key, button);
  }

  showTitleCard({ title = 'HOVERCRAFT DELIVERY RUN', subtitle = 'Deliver 5 crates before timer expires', buttonText = 'CLICK TO START', onStart }) {
    this.removePrimitive('title-card');
    const overlay = el('div', {
      id: 'title-card',
      style: {
        position: 'absolute', inset: '0', background: 'rgba(6, 10, 20, 0.88)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: '100', pointerEvents: 'auto',
      },
    }, [
      el('h1', { text: title, style: { margin: '0 0 10px', font: 'bold 32px system-ui, sans-serif', color: '#60a5fa' } }),
      el('p', { text: subtitle, style: { margin: '0 0 24px', font: '15px system-ui, sans-serif', color: '#94a3b8' } }),
      el('button', {
        text: buttonText,
        style: { background: '#2563eb', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '6px', font: 'bold 15px system-ui, sans-serif', cursor: 'pointer' },
        onclick: () => { this.removePrimitive('title-card'); if (onStart) onStart(); },
      }),
    ]);
    this.root.appendChild(overlay);
    this._primitives.set('title-card', overlay);
    return this._handle('title-card', overlay);
  }

  showControlsOverlay({ duration = 3.0 } = {}) {
    this.removePrimitive('controls-overlay');
    const overlay = el('div', {
      id: 'controls-overlay',
      style: {
        position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(96, 165, 250, 0.3)',
        borderRadius: '6px', padding: '10px 20px', font: '13px system-ui, sans-serif', color: '#e2e8f0',
        textAlign: 'center', zIndex: '90', transition: 'opacity 0.4s',
      },
      text: 'WASD / Arrows: Steer & Thrust  |  Space: Boost  |  Tab: Camera  |  R: Restart  |  Esc: Pause',
    });
    this.root.appendChild(overlay);
    this._primitives.set('controls-overlay', overlay);

    const fadeTimer = this._later(() => {
      overlay.style.opacity = '0';
      this._later(() => this.removePrimitive('controls-overlay', overlay), 400);
    }, duration * 1000);

    const handle = this._handle('controls-overlay', overlay);
    const remove = handle.remove;
    handle.remove = () => { clearTimeout(fadeTimer); remove(); };
    return handle;
  }

  showWinModal({ timeText = '', bestTimeText = '', isNewBest = false, onRestart }) {
    this.removePrimitive('modal');
    const modal = el('div', {
      id: 'modal',
      style: {
        position: 'absolute', inset: '0', background: 'rgba(4, 20, 12, 0.88)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: '100', pointerEvents: 'auto',
      },
    }, [
      el('h1', { text: 'MISSION COMPLETE!', style: { margin: '0 0 10px', font: 'bold 32px system-ui, sans-serif', color: '#4ade80' } }),
      el('p', { text: `Time: ${timeText}`, style: { margin: '0 0 6px', font: '16px system-ui, sans-serif', color: '#f1f5f9' } }),
      el('p', { text: `Best: ${bestTimeText} ${isNewBest ? '★ NEW BEST!' : ''}`, style: { margin: '0 0 20px', font: '14px system-ui, sans-serif', color: isNewBest ? '#fbbf24' : '#94a3b8' } }),
      el('button', {
        text: 'PLAY AGAIN (R)',
        style: { background: '#16a34a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', font: 'bold 15px system-ui, sans-serif', cursor: 'pointer' },
        onclick: () => { this.removePrimitive('modal'); if (onRestart) onRestart(); },
      }),
    ]);
    this.root.appendChild(modal);
    this._primitives.set('modal', modal);
    return this._handle('modal', modal);
  }

  showLoseModal({ reasonText = 'TIME EXPIRED', cratesText = '0/5', onRestart }) {
    this.removePrimitive('modal');
    const modal = el('div', {
      id: 'modal',
      style: {
        position: 'absolute', inset: '0', background: 'rgba(20, 6, 8, 0.88)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: '100', pointerEvents: 'auto',
      },
    }, [
      el('h1', { text: 'MISSION FAILED', style: { margin: '0 0 10px', font: 'bold 32px system-ui, sans-serif', color: '#f87171' } }),
      el('p', { text: reasonText, style: { margin: '0 0 6px', font: '16px system-ui, sans-serif', color: '#f1f5f9' } }),
      el('p', { text: `Crates Delivered: ${cratesText}`, style: { margin: '0 0 20px', font: '14px system-ui, sans-serif', color: '#94a3b8' } }),
      el('button', {
        text: 'RETRY (R)',
        style: { background: '#dc2626', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', font: 'bold 15px system-ui, sans-serif', cursor: 'pointer' },
        onclick: () => { this.removePrimitive('modal'); if (onRestart) onRestart(); },
      }),
    ]);
    this.root.appendChild(modal);
    this._primitives.set('modal', modal);
    return this._handle('modal', modal);
  }

  showWarning(text, intensity = 1.0) {
    let warnEl = this._primitives.get('warning');
    if (!warnEl) {
      warnEl = el('div', {
        id: 'warning',
        style: {
          position: 'absolute', top: '54px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(220, 38, 38, 0.9)', color: '#fff', font: 'bold 13px system-ui, sans-serif',
          padding: '6px 16px', borderRadius: '16px', pointerEvents: 'none', zIndex: '80', transition: 'opacity 0.15s',
        },
      });
      this.root.appendChild(warnEl);
      this._primitives.set('warning', warnEl);
    }
    warnEl.textContent = text;
    warnEl.style.opacity = `${Math.min(1.0, Math.max(0.2, intensity))}`;
    return this._handle('warning', warnEl);
  }

  showMessage(text, duration = 1500) {
    const handle = this.addLabel({
      id: 'temporary-message',
      text,
      style: { top: '18%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,.9)', padding: '8px 16px', borderRadius: '18px', fontWeight: 'bold' },
    });
    const timer = this._later(() => handle.remove(), duration);
    const remove = handle.remove;
    handle.remove = () => { clearTimeout(timer); remove(); };
    return handle;
  }

  showTitleOverlay(options) { return this.showTitleCard(options); }
  showModal(options = {}) {
    return options.kind === 'lose' ? this.showLoseModal(options) : this.showWinModal(options);
  }

  clearWarning() {
    this.removePrimitive('warning');
  }

  removePrimitive(id, expectedNode) {
    const node = this._primitives.get(id);
    if (node && (!expectedNode || node === expectedNode)) {
      if (node.parentNode) node.parentNode.removeChild(node);
      this._primitives.delete(id);
    }
  }

  destroy() {
    for (const timer of this._timers) clearTimeout(timer);
    this._timers.clear();
    for (const [id, node] of this._primitives) {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    this._primitives.clear();
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
