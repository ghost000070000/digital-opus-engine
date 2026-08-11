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
    this._onPointerDown = (e) => {
      this.dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onPointerUp = () => (this.dragging = false);
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
