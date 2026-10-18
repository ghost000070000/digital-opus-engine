class Input {
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this.pressed = new Set();
    this._framePressed = new Set();
    this._pressVersions = new Map();
    this._nextPressVersion = 0;
    this._codeOwners = new Map();
    this._keyboardOwner = Symbol('physical keyboard');
    this._mouseOwner = Symbol('physical mouse');
    this._mouseCodes = new Set();
    this.lastDevice = 'keyboard-mouse';
    this._gamepadActivity = null;
    this.dragging = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this.wheelDelta = 0;
    this._lastX = 0;
    this._lastY = 0;

    this._onKeyDown = (e) => {
      if (!e.repeat && typeof e.code === 'string' && e.code) this.markDevice('keyboard-mouse');
      this._holdCode(e.code, this._keyboardOwner);
    };
    this._onKeyUp = (e) => this._releaseCode(e.code, this._keyboardOwner);
    // Wave 6 (Priority D): mouse BUTTONS join the exact same `keys` Set
    // keyboard codes already live in, under synthetic codes 'Mouse0'/
    // 'Mouse1'/'Mouse2' (matching MouseEvent.button's own 0=left/1=middle/
    // 2=right numbering) -- isDown/wasPressed/simulateKeyDown all already
    // work identically for any code string, so a mouse button becomes a
    // fully first-class Input Action with ZERO new API surface, the same
    // way Wave 4's touch buttons already reused this Set instead of
    // inventing a second "touch button state" mechanism. Gated on
    // `e.pointerType === 'mouse'` specifically so an ordinary touch drag
    // (camera look, on-screen joystick) can never be misread as a
    // mouse-button press -- touch's own buttons are simulateKeyDown/Up'd
    // explicitly by HUD.addTouchButton instead, never inferred from a
    // touch pointer's `.button` value.
    this._onPointerDown = (e) => {
      this.dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      if (e.pointerType === 'mouse') {
        this.markDevice('keyboard-mouse');
        const code = `Mouse${e.button}`;
        this._mouseCodes.add(code);
        this._holdCode(code, this._mouseOwner);
      }
    };
    this._onPointerUp = (e) => {
      this.dragging = false;
      if (e && e.pointerType === 'mouse') {
        const code = `Mouse${e.button}`;
        this._mouseCodes.delete(code);
        this._releaseCode(code, this._mouseOwner);
      }
    };
    this._onPointerCancel = (e) => {
      this.dragging = false;
      // Touch/pen cancellation cannot release an independently held mouse.
      // Missing pointer metadata retains historical fixture/cleanup semantics.
      if (e && e.pointerType && e.pointerType !== 'mouse') return;
      for (const code of this._mouseCodes) this._releaseCode(code, this._mouseOwner);
      this._mouseCodes.clear();
    };
    this._onPointerMove = (e) => {
      if (!this.dragging) return;
      if (e.pointerType === 'mouse' && this._mouseCodes.size && (e.clientX !== this._lastX || e.clientY !== this._lastY)) this.markDevice('keyboard-mouse');
      this.dragDX += e.clientX - this._lastX;
      this.dragDY += e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onWheel = (e) => {
      this.wheelDelta += e.deltaY;
      e.preventDefault();
    };
    this._onBlur = () => this.clear();
    this._onVisibility = () => { if (document.hidden) this.clear(); };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('pointerdown', this._onPointerDown);
    target.addEventListener('pointerup', this._onPointerUp);
    target.addEventListener('pointerleave', this._onPointerCancel);
    target.addEventListener('pointercancel', this._onPointerCancel);
    target.addEventListener('pointermove', this._onPointerMove);
    target.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Presentation-only transient activity. Virtual key polling never owns it:
  // callers explicitly mark accepted touch gestures and observe the existing pad.
  markDevice(device) {
    if (device !== 'keyboard-mouse' && device !== 'touch' && device !== 'gamepad') return false;
    this.lastDevice = device;
    return true;
  }

  resetDevice() {
    this.lastDevice = 'keyboard-mouse';
    this._gamepadActivity = null;
  }

  observeGamepad(pad, deadzone = 0.25) {
    if (!pad || pad.connected === false) {
      this._gamepadActivity = null;
      if (this.lastDevice === 'gamepad') this.lastDevice = 'keyboard-mouse';
      return false;
    }
    const threshold = Number.isFinite(deadzone) && deadzone >= 0 && deadzone <= 1 ? deadzone : 0.25;
    const buttons = Array.from({length:17}, (_, i) => pad.buttons?.[i]?.pressed === true);
    const axes = Array.from({length:4}, (_, i) => {
      const value = pad.axes?.[i];
      return Number.isFinite(value) && Math.abs(value) <= 1 && Math.abs(value) > threshold ? value : 0;
    });
    const previous = this._gamepadActivity;
    const changed = buttons.some((held, i) => held && !previous?.buttons[i]) ||
      axes.some((axis, i) => axis !== 0 && axis !== (previous?.axes[i] || 0));
    // Fixed-size independent snapshots; neither pad identity nor raw device
    // arrays are retained, and repeated held polls cannot steal recent activity.
    this._gamepadActivity = {buttons, axes};
    if (changed) this.markDevice('gamepad');
    return changed;
  }

  // Touch devices have no physical keyboard, so game logic gated on
  // isDown/wasPressed('KeyW') etc. has nothing to read on touch -- this
  // lets an on-screen control (see HUD.addTouchButton) drive the exact
  // same key-state Sets, with zero changes needed to existing driving code.
  _holdCode(code, owner) {
    if (typeof code !== 'string' || !code) return;
    let owners = this._codeOwners.get(code);
    if (!owners) { owners = new Set(); this._codeOwners.set(code, owners); }
    if (!owners.size && !this.keys.has(code)) {
      this.pressed.add(code);
      this._framePressed.add(code);
      this._pressVersions.set(code, ++this._nextPressVersion);
    }
    owners.add(owner);
    this.keys.add(code);
  }

  _releaseCode(code, owner) {
    const owners = this._codeOwners.get(code);
    if (!owners || !owners.delete(owner)) return;
    if (!owners.size) {
      this._codeOwners.delete(code); this.keys.delete(code);
      if (!this.pressed.has(code)) this._pressVersions.delete(code);
    }
  }

  // Optional source leases let independent virtual controls share a code.
  // Omitted source retains the historical idempotent simulation owner.
  // Physical owners are Symbols, so a caller cannot accidentally release them.
  simulateKeyDown(code, source = 'legacy') {
    if (typeof source !== 'string' || !source || source.length > 256) return;
    this._holdCode(code, source);
  }

  simulateKeyUp(code, source = 'legacy') {
    if (typeof source !== 'string' || !source || source.length > 256) return;
    this._releaseCode(code, source);
  }

  wasPressed(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    if (!this.keys.has(code)) this._pressVersions.delete(code);
    return true;
  }
  // Non-consuming physical edge observation for event fan-out. The historical
  // wasPressed queue remains consuming; App closes this separate frame window.
  wasPressedThisFrame(code) { return this._framePressed.has(code); }
  endFrame() { this._framePressed.clear(); }

  // Logical context transitions can distinguish a new real aggregate press
  // without consuming it or interfering with independent physical leases.
  // Retention is bounded by the same held/unconsumed codes as keys/pressed.
  pressVersion(code) { return this._pressVersions.get(code) || 0; }

  consumeDrag() {
    const d = { dx: this.dragDX, dy: this.dragDY };
    this.dragDX = 0;
    this.dragDY = 0;
    return d;
  }

  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  clear() {
    this.resetDevice();
    this.keys.clear();
    this.pressed.clear();
    this._framePressed.clear();
    this._pressVersions.clear();
    this._codeOwners.clear();
    this._mouseCodes.clear();
    this.dragging = false;
    this.dragDX = this.dragDY = this.wheelDelta = 0;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('pointerdown', this._onPointerDown);
    this.target.removeEventListener('pointerup', this._onPointerUp);
    this.target.removeEventListener('pointerleave', this._onPointerCancel);
    this.target.removeEventListener('pointercancel', this._onPointerCancel);
    this.target.removeEventListener('pointermove', this._onPointerMove);
    this.target.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.clear();
  }
}
