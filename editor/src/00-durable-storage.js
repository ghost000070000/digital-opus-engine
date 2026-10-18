/* Digital Opus durable project storage.
 *
 * Browsers cap localStorage at roughly 5M characters per site, which held about
 * one medium project. This module moves project data into IndexedDB (gigabytes,
 * eligible for persistent storage) without changing any caller: it installs a
 * routing `window.localStorage` whose project keys live in an in-memory copy of
 * IndexedDB, while every other key (preferences, onboarding, runtime game saves)
 * stays in the real localStorage.
 *
 * - install() must finish before the editor script runs; editor/index.html
 *   awaits it, then loads the editor. Failure leaves real localStorage in place.
 * - Existing project keys are migrated from localStorage on first install and
 *   removed there only after the IndexedDB write commits.
 * - Writes update memory synchronously (so the existing synchronous save,
 *   read-back verification and conflict checks keep working) and persist
 *   asynchronously; failures are reported through status.lastError and a
 *   `durable-storage-error` window event.
 * - Other tabs are kept in step with a BroadcastChannel and receive the same
 *   `storage` events the editor already listens to.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OpusDurableStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const DB_NAME = 'doengine-durable', STORE = 'kv', CHANNEL = 'doengine-durable';
  // Project documents, their previous revision, version history and the Prefab library.
  const DEFAULT_PREFIXES = ['doengine:save:', 'doengine:previous-save:', 'doengine:project-history:', 'opus-prefabs'];

  function request(req) { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
  function transactionDone(tx) { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed')); tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted')); }); }
  function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timed out')), ms); })]).finally(() => clearTimeout(timer));
  }
  function openDatabase(indexedDB) {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
      req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
    });
  }
  async function readAll(db) {
    const tx = db.transaction(STORE, 'readonly'), store = tx.objectStore(STORE);
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
    const map = new Map();
    keys.forEach((key, i) => { if (typeof key === 'string' && typeof values[i] === 'string') map.set(key, values[i]); });
    return map;
  }

  // Storage-compatible router over the real localStorage and the durable map.
  function createRouter({ real, map, isManaged, persist, broadcast }) {
    let keysCache = null;
    const invalidate = () => { keysCache = null; };
    const keys = () => {
      if (keysCache) return keysCache;
      const out = [];
      for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k !== null && !isManaged(k)) out.push(k); }
      for (const k of map.keys()) out.push(k);
      return (keysCache = out);
    };
    return {
      getItem(key) { key = String(key); return isManaged(key) ? (map.has(key) ? map.get(key) : null) : real.getItem(key); },
      setItem(key, value) {
        key = String(key); value = String(value);
        if (!isManaged(key)) { real.setItem(key, value); invalidate(); return; }
        map.set(key, value); invalidate(); persist(key, value); broadcast(key, value);
      },
      removeItem(key) {
        key = String(key);
        if (!isManaged(key)) { real.removeItem(key); invalidate(); return; }
        if (!map.has(key)) return;
        map.delete(key); invalidate(); persist(key, null); broadcast(key, null);
      },
      clear() { real.clear(); for (const key of [...map.keys()]) { map.delete(key); persist(key, null); broadcast(key, null); } invalidate(); },
      key(index) { const list = keys(); return index >= 0 && index < list.length ? list[index] : null; },
      get length() { return keys().length; },
      _invalidate: invalidate,
    };
  }

  async function install(options = {}) {
    const prefixes = Array.isArray(options.prefixes) ? options.prefixes.slice() : DEFAULT_PREFIXES.slice();
    const isManaged = (key) => prefixes.some((p) => key === p || key.startsWith(p));
    const status = { installed: false, migrated: 0, keys: 0, pending: 0, persisted: null, lastError: null, reason: '' };
    const indexedDB = options.indexedDB || root.indexedDB;
    let real;
    try { real = options.localStorage || root.localStorage; void real.length; } catch (error) { status.reason = 'localStorage unavailable'; return status; }
    if (!indexedDB) { status.reason = 'IndexedDB unavailable'; return status; }
    const db = await withTimeout(openDatabase(indexedDB), options.timeoutMs || 4000, 'Opening IndexedDB');
    const map = await withTimeout(readAll(db), options.timeoutMs || 4000, 'Reading IndexedDB');

    // Migrate project keys still held in localStorage (first run or older pages).
    const legacy = [];
    for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k !== null && isManaged(k)) legacy.push(k); }
    if (legacy.length) {
      const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE);
      for (const key of legacy) {
        const value = real.getItem(key);
        if (value === null) continue;
        if (!map.has(key)) { map.set(key, value); store.put(value, key); }
      }
      await transactionDone(tx); // only free localStorage once IndexedDB holds the data
      for (const key of legacy) { try { real.removeItem(key); } catch (error) { /* left behind; durable copy wins */ } }
      status.migrated = legacy.length;
    }

    let channel = null;
    try { channel = typeof root.BroadcastChannel === 'function' ? new root.BroadcastChannel(CHANNEL) : null; } catch (error) { channel = null; }
    const report = (key, error) => {
      status.lastError = error || new Error('IndexedDB write failed');
      try { root.dispatchEvent(new root.CustomEvent('durable-storage-error', { detail: { key, message: String(status.lastError.message || status.lastError) } })); } catch (e) { /* no event target */ }
    };
    const persist = (key, value) => {
      status.pending++;
      let tx;
      try { tx = db.transaction(STORE, 'readwrite'); const store = tx.objectStore(STORE); if (value === null) store.delete(key); else store.put(value, key); }
      catch (error) { status.pending--; report(key, error); return; }
      transactionDone(tx).then(() => { status.pending--; }, (error) => { status.pending--; report(key, error); });
    };
    const broadcast = (key, value) => { try { if (channel) channel.postMessage({ key, value }); } catch (error) { /* best effort */ } };
    const router = createRouter({ real, map, isManaged, persist, broadcast });
    if (channel) channel.onmessage = (event) => {
      const data = event && event.data; if (!data || typeof data.key !== 'string' || !isManaged(data.key)) return;
      const oldValue = map.has(data.key) ? map.get(data.key) : null;
      if (data.value === null) map.delete(data.key); else if (typeof data.value === 'string') map.set(data.key, data.value); else return;
      router._invalidate();
      try { root.dispatchEvent(new root.StorageEvent('storage', { key: data.key, oldValue, newValue: data.value })); } catch (error) { /* older browsers */ }
    };

    Object.defineProperty(root, 'localStorage', { configurable: true, enumerable: true, get: () => router });
    status.installed = true; status.keys = map.size; status.prefixes = prefixes;
    Object.defineProperty(status, 'realStorage', { value: real }); // diagnostics: the browser's own localStorage
    root.__opusDurableStorage = status;
    try {
      const storage = root.navigator && root.navigator.storage;
      if (storage && typeof storage.persist === 'function') status.persisted = await withTimeout(storage.persist(), 2000, 'Persistent storage request');
    } catch (error) { status.persisted = false; }
    return status;
  }

  // editor/index.html: install, then load the editor script whatever happens.
  function bootEditor(src) {
    const load = () => { const script = root.document.createElement('script'); script.src = src; root.document.body.appendChild(script); };
    install().then((status) => { root.__opusDurableStorageResult = status; },
      (error) => { root.__opusDurableStorageResult = { installed: false, reason: String(error && error.message || error) }; }).then(load);
  }

  return Object.freeze({ install, bootEditor, DEFAULT_PREFIXES: Object.freeze(DEFAULT_PREFIXES.slice()), createRouter });
});
