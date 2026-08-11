class Time {
  constructor() {
    this.elapsed = 0;
    this.delta = 0;
    this._last = performance.now();
  }

  tick() {
    const now = performance.now();
    this.delta = Math.min((now - this._last) / 1000, 0.1);
    this.elapsed += this.delta;
    this._last = now;
    return this.delta;
  }
}
