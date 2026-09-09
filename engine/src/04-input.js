class Input {
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this.pressed = new Set();
    this.dragging = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this.wheelDelta = 0;
    this._lastX = 0;
    this._lastY = 0;

    this._onKeyDown = (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
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
        const code = `Mouse${e.button}`;
        if (!this.keys.has(code)) this.pressed.add(code);
        this.keys.add(code);
      }
    };
    this._onPointerUp = (e) => {
      this.dragging = false;
      if (e && e.pointerType === 'mouse') this.keys.delete(`Mouse${e.button}`);
    };
    this._onPointerMove = (e) => {
      if (!this.dragging) return;
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
    target.addEventListener('pointerleave', this._onPointerUp);
    target.addEventListener('pointermove', this._onPointerMove);
    target.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Touch devices have no physical keyboard, so game logic gated on
  // isDown/wasPressed('KeyW') etc. has nothing to read on touch -- this
  // lets an on-screen control (see HUD.addTouchButton) drive the exact
  // same key-state Sets, with zero changes needed to existing driving code.
  simulateKeyDown(code) {
    if (!this.keys.has(code)) this.pressed.add(code);
    this.keys.add(code);
  }

  simulateKeyUp(code) {
    this.keys.delete(code);
  }

  wasPressed(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

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
    this.keys.clear();
    this.pressed.clear();
    this.dragging = false;
    this.dragDX = this.dragDY = this.wheelDelta = 0;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('pointerdown', this._onPointerDown);
    this.target.removeEventListener('pointerup', this._onPointerUp);
    this.target.removeEventListener('pointerleave', this._onPointerUp);
    this.target.removeEventListener('pointermove', this._onPointerMove);
    this.target.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.clear();
  }
}
