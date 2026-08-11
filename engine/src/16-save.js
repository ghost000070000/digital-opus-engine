class SaveSystem {
  constructor(namespace = 'doengine:save') {
    if (typeof namespace !== 'string' || !namespace.trim()) fail('Opus.SaveSystem', 'namespace', 'a non-empty string', namespace);
    this.namespace = namespace;
  }

  _key(slot, method) {
    if (typeof slot !== 'string' || !slot.trim()) fail(method, 'slot', 'a non-empty string', slot);
    return `${this.namespace}:${slot}`;
  }

  save(slot, data) {
    const key = this._key(slot, 'SaveSystem.save');
    try {
      localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
      return true;
    } catch (e) {
      return false;
    }
  }

  load(slot) {
    const key = this._key(slot, 'SaveSystem.load');
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw).data;
    } catch (e) {
      return null;
    }
  }

  has(slot) {
    const key = this._key(slot, 'SaveSystem.has');
    try {
      return localStorage.getItem(key) !== null;
    } catch (e) {
      return false;
    }
  }

  delete(slot) {
    const key = this._key(slot, 'SaveSystem.delete');
    try { localStorage.removeItem(key); } catch (e) {}
  }
}
