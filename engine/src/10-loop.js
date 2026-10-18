class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.time = new Time();
    this._running = false;
    this._raf = 0;
    this._frame = this._frame.bind(this);
    // Transient, opt-in CPU diagnostics. Never use these readings as dt.
    this._performance = { enabled: false, records: [], total: 0, previousStart: null };
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.time._last = performance.now();
    this._performance.previousStart = null;
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _frame() {
    if (!this._running) return;
    const capture = this._performance.enabled;
    const frameStart = capture ? performance.now() : 0;
    const dt = this.time.tick();
    this.update(dt, this.time.elapsed);
    if (!this._running) return;
    const updatedAt = capture ? performance.now() : 0;
    this.render();
    if (!this._running) return;
    if (capture && this._performance.enabled) {
      const finishedAt = performance.now(), state = this._performance;
      const row = Object.freeze({ sequence: ++state.total,
        intervalMs: state.previousStart === null ? null : Math.max(0, frameStart - state.previousStart),
        updateMs: Math.max(0, updatedAt - frameStart), renderMs: Math.max(0, finishedAt - updatedAt),
        cpuMs: Math.max(0, finishedAt - frameStart) });
      state.previousStart = frameStart;
      if (state.records.length === 120) state.records.shift();
      state.records.push(row);
    }
    this._raf = requestAnimationFrame(this._frame);
  }

  setPerformanceCapture(enabled) {
    if (typeof enabled !== 'boolean') throw new TypeError('Performance capture requires a boolean');
    if (this._performance.enabled !== enabled) this._performance.previousStart = null;
    this._performance.enabled = enabled;
  }

  clearPerformanceCapture() {
    this._performance.records = [];
    this._performance.total = 0;
    this._performance.previousStart = null;
  }

  getPerformanceSnapshot() {
    const state = this._performance;
    return Object.freeze({ enabled: state.enabled, capacity: 120, total: state.total,
      dropped: Math.max(0, state.total - state.records.length), records: Object.freeze(state.records.slice()) });
  }
}
