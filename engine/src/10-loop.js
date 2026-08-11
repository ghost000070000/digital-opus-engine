class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.time = new Time();
    this._running = false;
    this._raf = 0;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.time._last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _frame() {
    if (!this._running) return;
    const dt = this.time.tick();
    this.update(dt, this.time.elapsed);
    if (!this._running) return;
    this.render();
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._frame);
  }
}
