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

  // Enumerates every slot saved under this namespace -- save/load/has/delete
  // all require already knowing a slot's name, but nothing could discover
  // what slots exist at all (needed for e.g. a multi-project "open" list).
  // localStorage has no native prefix-listing, so this scans every key.
  list() {
    const prefix = `${this.namespace}:`;
    const slots = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        let savedAt = null;
        try { savedAt = JSON.parse(localStorage.getItem(key)).savedAt ?? null; } catch (e) { /* corrupt entry: still list it, just without a timestamp */ }
        slots.push({ slot: key.slice(prefix.length), savedAt });
      }
    } catch (e) { return []; }
    return slots.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  }
}
