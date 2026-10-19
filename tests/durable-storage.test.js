'use strict';
// Durable project storage: routing, migration, persistence and cross-tab sync,
// with an in-memory IndexedDB stand-in (same async request/transaction shape).
const assert = require('assert');
const DurableStorage = require('../editor/src/00-durable-storage.js');

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => map.set(String(k), String(v)),
    removeItem: (k) => map.delete(String(k)),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
    _map: map,
  };
}
function fakeIndexedDB(shared = new Map(), flags = { failWrites: false }) {
  const later = (fn) => setTimeout(fn, 0);
  const req = (compute) => { const r = {}; later(() => { try { r.result = compute(); r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }); return r; };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore() {},
    transaction(_, mode) {
      const tx = {}; const ops = [];
      tx.objectStore = () => ({
        getAllKeys: () => req(() => [...shared.keys()]),
        getAll: () => req(() => [...shared.values()]),
        put: (v, k) => { ops.push(() => shared.set(k, v)); },
        delete: (k) => { ops.push(() => shared.delete(k)); },
      });
      later(() => later(() => {
        if (mode === 'readwrite' && flags.failWrites) { tx.error = new Error('QuotaExceededError'); tx.onerror && tx.onerror(); return; }
        ops.forEach((op) => op()); tx.oncomplete && tx.oncomplete();
      }));
      return tx;
    },
  };
  return { flags, open: () => { const r = {}; later(() => { r.result = db; r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess && r.onsuccess(); }); return r; }, _shared: shared };
}
function fakeRoot() {
  const events = [];
  const channels = [];
  class Channel { constructor() { channels.push(this); } postMessage(data) { for (const c of channels) if (c !== this && c.onmessage) c.onmessage({ data }); } }
  return {
    events, BroadcastChannel: Channel,
    dispatchEvent: (e) => events.push(e),
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    StorageEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    navigator: { storage: { persist: async () => true } },
  };
}
// install() targets the module's own root; run it against a fresh root each time.
async function installInto(root, options) {
  const fresh = require('vm');
  const ctx = Object.assign(root, { setTimeout, clearTimeout, Promise, Object, Map, Array, String, Error, module: undefined });
  ctx.globalThis = ctx;
  fresh.createContext(ctx);
  fresh.runInContext(require('fs').readFileSync(require.resolve('../editor/src/00-durable-storage.js'), 'utf8'), ctx);
  return ctx.OpusDurableStorage.install(options);
}
// Many short turns instead of one fixed wait: chained fake-IndexedDB timers
// still finish first when the machine is busy running the whole suite.
const settle = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 5)); };

(async () => {
  {
    // Routing + migration: project keys move to IndexedDB, preferences stay.
    const real = memoryStorage({ 'doengine:save:Old': '{"data":1}', 'opus-prefabs': '[]', 'doengine:onboarding': 'x' });
    const idb = fakeIndexedDB(), root = fakeRoot();
    const status = await installInto(root, { localStorage: real, indexedDB: idb });
    assert.strictEqual(status.installed, true);
    assert.strictEqual(status.migrated, 2);
    assert.strictEqual(real.getItem('doengine:save:Old'), null, 'migrated project removed from localStorage after commit');
    assert.strictEqual(real.getItem('doengine:onboarding'), 'x', 'preferences stay in localStorage');
    assert.strictEqual(idb._shared.get('doengine:save:Old'), '{"data":1}');
    const ls = root.localStorage;
    assert.strictEqual(ls.getItem('doengine:save:Old'), '{"data":1}', 'reads come from the durable copy');
    const big = 'x'.repeat(6 * 1024 * 1024); // larger than a typical localStorage quota
    ls.setItem('doengine:save:Huge', big);
    assert.strictEqual(ls.getItem('doengine:save:Huge'), big, 'writes are readable immediately (read-back verification)');
    ls.setItem('doengine:ui-pref', 'on');
    assert.strictEqual(real.getItem('doengine:ui-pref'), 'on', 'other keys go to real localStorage');
    const keys = []; for (let i = 0; i < ls.length; i++) keys.push(ls.key(i));
    assert.deepStrictEqual(keys.sort(), ['doengine:onboarding', 'doengine:save:Huge', 'doengine:save:Old', 'doengine:ui-pref', 'opus-prefabs'].sort(), 'enumeration covers both stores (Project Home listing)');
    await settle();
    assert.strictEqual(idb._shared.get('doengine:save:Huge'), big, 'persisted to IndexedDB');
    ls.removeItem('doengine:save:Old'); await settle();
    assert(!idb._shared.has('doengine:save:Old'), 'deletes persist');
    assert.strictEqual(status.persisted, true, 'persistent storage requested');
    assert.strictEqual(status.pending, 0);
  }
  {
    // A second page load hydrates from IndexedDB; a failed migration keeps localStorage data.
    const shared = new Map([['doengine:save:Kept', 'v']]);
    const second = fakeRoot();
    await installInto(second, { localStorage: memoryStorage(), indexedDB: fakeIndexedDB(shared) });
    assert.strictEqual(second.localStorage.getItem('doengine:save:Kept'), 'v', 'reload reads saved projects back');
    const real = memoryStorage({ 'doengine:save:Legacy': 'L' });
    await assert.rejects(installInto(fakeRoot(), { localStorage: real, indexedDB: fakeIndexedDB(new Map(), { failWrites: true }) }));
    assert.strictEqual(real.getItem('doengine:save:Legacy'), 'L', 'nothing is removed from localStorage if IndexedDB cannot store it');
  }
  {
    // Write failures after install are reported, not silent.
    const root = fakeRoot(), idb = fakeIndexedDB();
    const status = await installInto(root, { localStorage: memoryStorage(), indexedDB: idb });
    idb.flags.failWrites = true;
    root.localStorage.setItem('doengine:save:X', 'y'); await settle();
    assert(status.lastError, 'lastError recorded');
    assert(root.events.some((e) => e.type === 'durable-storage-error' && e.detail.key === 'doengine:save:X'), 'durable-storage-error event dispatched');
  }
  {
    // Cross-tab: a write in one tab updates the other tab and raises its storage event.
    // Two tabs share one IndexedDB and one BroadcastChannel registry.
    const shared = new Map(), tabA = fakeRoot(), tabB = fakeRoot(); tabB.BroadcastChannel = tabA.BroadcastChannel;
    await installInto(tabA, { localStorage: memoryStorage(), indexedDB: fakeIndexedDB(shared) });
    await installInto(tabB, { localStorage: memoryStorage(), indexedDB: fakeIndexedDB(shared) });
    tabA.localStorage.setItem('doengine:save:Shared', 'from A');
    assert.strictEqual(tabB.localStorage.getItem('doengine:save:Shared'), 'from A', 'other tab sees the write');
    assert(tabB.events.some((e) => e.type === 'storage' && e.key === 'doengine:save:Shared' && e.newValue === 'from A'), 'other tab receives a storage event for conflict detection');
  }
  console.log('Durable storage: routing, migration, persistence, failure reporting, cross-tab sync PASS');
})().catch((error) => { console.error(error); process.exit(1); });
