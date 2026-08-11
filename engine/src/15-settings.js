class SettingsManager {
  constructor(key = 'doengine:settings', defaults = {}) {
    this.key = key;
    this.defaults = defaults;
    this.values = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return { ...this.defaults };
      return { ...this.defaults, ...JSON.parse(raw) };
    } catch (e) {
      return { ...this.defaults };
    }
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    this.values[key] = value;
    try {
      localStorage.setItem(this.key, JSON.stringify(this.values));
    } catch (e) {
      // localStorage unavailable (private browsing, quota) — setting stays in-memory only.
    }
  }
}
