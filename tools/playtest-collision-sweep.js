// Real-game collision sweep, injected into a running public game page (browser
// console / automation). Random-walks the actual Player Controller with the
// same simulated key path touch controls use, and records two failure kinds:
//   solidPenetration - Player centre inside a solid collider (a real
//                      collision failure: tunnelling or bad depenetration);
//   visualGhost      - Player centre inside the visible shape of an object
//                      with no collision (looks solid, walks through).
// Visual bounds come from mesh vertex AABBs, so irregular models (trees,
// arches) can over-report ghosts; read the object names, not just counts.
// Usage: window.__collisionSweep({ seconds: 25, seed: 1 }) -> Promise<report>
(function () {
  function qrot(q, v) {
    const [x, y, z] = v, qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
    return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
  }
  const inv = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
  function meshBounds(cache, mesh) {
    let b = cache.get(mesh);
    if (b) return b;
    let arrays;
    try { arrays = Opus.Mesh.toArrays(mesh); } catch (e) { arrays = { positions: [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5] }; }
    const pos = arrays.positions || arrays.position;
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
    b = { mn, mx };
    cache.set(mesh, b);
    return b;
  }
  // Point-in-oriented-box with an inward margin on the horizontal axes.
  function inside(point, center, half, quat, margin) {
    const local = qrot(inv(quat), [point.x - center[0], point.y - center[1], point.z - center[2]]);
    return Math.abs(local[0]) < half[0] - margin && Math.abs(local[2]) < half[2] - margin && Math.abs(local[1]) < half[1];
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  window.__collisionSweep = async function ({ seconds = 25, seed = 1, turnEvery = 1.2 } = {}) {
    const tp = typeof thirdPersonEntity !== 'undefined' && thirdPersonEntity;
    const fp = typeof firstPersonEntity !== 'undefined' && firstPersonEntity;
    const ent = tp || fp || (player && player.entity);
    if (!ent) return { error: 'no player entity', controller: player && player.controllerType };
    const cache = new Map(), random = rng(seed), identity = { x: 0, y: 0, z: 0, w: 1 };
    const solids = [], visuals = [];
    for (const item of placed) {
      if (item.kind !== 'cube' || !item.entity || item.entity.visible === false || item.entity === ent) continue;
      const q = item.entity.quaternion || identity;
      if (item.entity.solid) {
        const c = itemColliderConfig(item);
        if (c.shape !== 'box' || item.isRamp) continue;
        const ctr = item.entity.position.add(c.offset);
        solids.push({ item, center: [ctr.x, ctr.y, ctr.z], half: [c.half.x, c.half.y, c.half.z], quat: q });
      } else {
        const b = meshBounds(cache, item.entity.mesh), s = item.entity.scale;
        const half = [(b.mx[0] - b.mn[0]) * s.x / 2, (b.mx[1] - b.mn[1]) * s.y / 2, (b.mx[2] - b.mn[2]) * s.z / 2];
        if (half[1] * 2 < 1 || Math.max(half[0], half[2]) * 2 < 0.5) continue; // too small to read as an obstacle
        const off = qrot(q, [(b.mx[0] + b.mn[0]) / 2 * s.x, (b.mx[1] + b.mn[1]) / 2 * s.y, (b.mx[2] + b.mn[2]) / 2 * s.z]);
        const p = item.entity.position;
        visuals.push({ item, center: [p.x + off[0], p.y + off[1], p.z + off[2]], half, quat: q });
      }
    }
    const report = { controller: player.controllerType, solids: solids.length, visualOnly: visuals.length, samples: 0, distance: 0, stuckSamples: 0, falls: 0, solidPenetration: {}, visualGhost: {} };
    let last = ent.position.clone(), lastProgress = performance.now(), heading = random() * Math.PI * 2;
    // Third/first person steer by camera yaw while holding W; top-down and
    // hovercraft have no yaw to set, so they steer with key combinations.
    const combos = player.controllerType === 'hovercraft'
      ? [['KeyW'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA']]
      : [['KeyW'], ['KeyS'], ['KeyA'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']];
    let held = [];
    const hold = (keys) => { for (const k of held) if (!keys.includes(k)) app.input.simulateKeyUp(k); for (const k of keys) if (!held.includes(k)) app.input.simulateKeyDown(k); held = keys; };
    const steer = () => {
      heading = random() * Math.PI * 2;
      if (tp) { tpCameraYaw = heading; tpCameraWrittenYaw = heading; app.camera.setChaseOptions({ bearingMode: 'fixed', bearingYaw: heading }); hold(['KeyW']); }
      else if (fp) { fpYaw = heading; hold(['KeyW']); }
      else hold(combos[Math.floor(random() * combos.length)]);
    };
    const jump = () => { app.input.simulateKeyDown('Space'); setTimeout(() => app.input.simulateKeyUp('Space'), 120); report.jumps++; };
    report.jumps = 0;
    steer();
    const t0 = performance.now();
    let nextTurn = t0 + turnEvery * 1000;
    try {
      while (performance.now() - t0 < seconds * 1000) {
        await new Promise((r) => requestAnimationFrame(r));
        if (app.paused || gameEnded) break;
        const p = ent.position;
        report.samples++;
        const step = Math.hypot(p.x - last.x, p.z - last.z);
        if (step > 5) report.falls++; // respawn/teleport, not walking
        else report.distance += step;
        if (step > 0.01) lastProgress = performance.now();
        else report.stuckSamples++;
        last = p.clone();
        for (const s of solids) if (inside(p, s.center, s.half, s.quat, 0.05)) { const n = s.item.name || s.item.id; report.solidPenetration[n] = (report.solidPenetration[n] || 0) + 1; }
        for (const v of visuals) if (inside(p, v.center, v.half, v.quat, 0.15)) { const n = v.item.name || v.item.id; report.visualGhost[n] = (report.visualGhost[n] || 0) + 1; }
        // Turn on schedule, or early when blocked so the walk keeps exploring.
        // Blocked: try a jump first (ledges are often meant to be jumped), then turn.
        const blockedFor = performance.now() - lastProgress;
        if (blockedFor > 250 && blockedFor < 300 && currentPlayerSettings.jumpEnabled) jump();
        if (performance.now() > nextTurn || blockedFor > 700) { steer(); nextTurn = performance.now() + turnEvery * 1000; lastProgress = performance.now(); }
      }
    } finally { hold([]); }
    report.distance = +report.distance.toFixed(1);
    return report;
  };
})();
