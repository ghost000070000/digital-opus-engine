// --- Game/editor hybrid shell ---
// The shipped artifact opens as a real, complete, playable game (not a
// blank canvas) with the editor one click away — proof the shipped game
// is genuinely built from, and editable with, the same no-code tool.

// Boost pads: a fixed 'enter' trigger + a new 'boost' action, giving the
// craft a forward velocity impulse when driven through. Route/traversal
// variety (a shortcut lane worth aiming for) rather than pure collect-and-
// avoid — and exposed as a real palette-adjacent no-code action (the
// dropdown), not just something reachable via Custom Script.
function spawnBoostPad(position, force = 11) {
  const entity = app.addEntity({ mesh: boostMesh, color: [0.3, 0.85, 1], position: position.clone(), scale: new Opus.Vec3(1.3, 0.7, 1.3) });
  entity.spin = 1.5; // slow spin reads as "interactive", same trick crates already use
  const item = { kind: 'cube', entity, behaviors: [{ trigger: 'enter', action: 'boost', param: String(force) }] };
  addPlaced(item);
  return item;
}

function buildStarterGame() {
  // Two islands connected by open water — more area to actually drive
  // across, not just a bigger single landmass. Proves multi-terrain works,
  // not just a config tweak.
  const islandDefs = [
    { seed: 7, position: new Opus.Vec3(-11, 0, 0), crateOffsets: [[5, 1], [-4, 4], [3, -5]], hazardOffset: [-3, -2] },
    // Patrol hazard: the same static 'lose' cube, but oscillating along one
    // axis, so avoiding it takes timing, not just memorized position.
    { seed: 91, position: new Opus.Vec3(11, 0, 0), crateOffsets: [[5, 1], [-4, 4], [3, -5]], hazardOffset: [-3, -2], hazardPatrol: { axis: 'x', range: 2.5, speed: 1.1 } },
    // Off the east-west line, not just further out on it -- a triangular
    // layout gives real navigation choices, not just "further".
    { seed: 233, position: new Opus.Vec3(0, 0, 19), crateOffsets: [[4, 3], [-5, 2], [0, -4]], hazardOffset: [3, 4], hazardPatrol: { axis: 'z', range: 2.5, speed: 0.9 } },
    { seed: 458, position: new Opus.Vec3(0, 0, -19), crateOffsets: [[-3, -4], [4, -2], [-1, 5]], hazardOffset: [4, 3] },
    { seed: 612, position: new Opus.Vec3(20, 0, 20), crateOffsets: [[2, 5], [-5, -1], [4, -4]], hazardOffset: [-4, 2] },
    // Two more, filling out the SW/NW corners to balance island5's NE
    // corner -- same ~28-unit distance from origin, so both MAP_BOUNDARY
    // (40) and the water size (84) already have enough headroom to cover
    // them without adjustment.
    { seed: 799, position: new Opus.Vec3(-20, 0, -20), crateOffsets: [[3, 2], [-4, -3], [2, -5]], hazardOffset: [-3, 4], hazardPatrol: { axis: 'x', range: 2.5, speed: 1.0 } },
    { seed: 911, position: new Opus.Vec3(-20, 0, 20), crateOffsets: [[-2, 4], [4, -1], [-5, -3]], hazardOffset: [3, -4] },
  ];
  const TOTAL_CRATES = islandDefs.reduce((sum, def) => sum + def.crateOffsets.length, 0);
  // Recoloring the crate green on pickup was easy to miss at a glance or in
  // motion -- disappearing entirely is unambiguous. The visible-check guard
  // stops a re-entry (driving away and back over the same spot) from
  // double-counting; enterPlayMode resets every cube back to visible at the
  // start of each fresh session, so this isn't a one-way flag.
  const COLLECT_SCRIPT = "if(!entity.visible)return;entity.visible=false;"
    + "window.__gameState.crates=(window.__gameState.crates||0)+1;"
    + "app.audio.playBlip({frequency:660+window.__gameState.crates*40,duration:0.12,type:'sine'});"
    + `game.setObjective('Crates: '+window.__gameState.crates+'/${TOTAL_CRATES}');`
    + `if(window.__gameState.crates>=${TOTAL_CRATES})game.win();`;

  for (const def of islandDefs) {
    const terrainOpts = { seed: def.seed, size: 22, segments: 48, radius: 9, position: def.position };
    const terrain = app.createTerrain(terrainOpts);
    addPlaced({ kind: 'terrain', handle: terrain, options: terrainOpts });

    for (const [dx, dz] of def.crateOffsets) {
      const x = def.position.x + dx;
      const z = def.position.z + dz;
      const y = terrain.sampleHeight(x, z) + 0.5;
      const entity = app.addEntity({ mesh: cubeMesh, color: [1, 0.75, 0.15], position: new Opus.Vec3(x, y, z), scale: new Opus.Vec3(0.8, 0.8, 0.8) });
      entity.spin = 0.8;
      addPlaced({ kind: 'cube', entity, behaviors: [{ trigger: 'enter', action: 'script', param: COLLECT_SCRIPT }] });
    }

    const hx = def.position.x + def.hazardOffset[0];
    const hz = def.position.z + def.hazardOffset[1];
    const hy = terrain.sampleHeight(hx, hz) + 0.5;
    const hazard = app.addEntity({ mesh: mineMesh, color: [0.85, 0.2, 0.2], position: new Opus.Vec3(hx, hy, hz), scale: new Opus.Vec3(1.1, 1.1, 1.1) });
    if (def.hazardPatrol) {
      hazard.patrol = { base: hazard.position.clone(), phase: Math.random() * Math.PI * 2, ...def.hazardPatrol };
      hazard.spin = 2.2; // spinning + moving reads as "active danger" vs. the static hazards
    }
    addPlaced({ kind: 'cube', entity: hazard, behaviors: [{ trigger: 'enter', action: 'lose', param: '' }] });
  }

  // Landmark, imported via Opus.Mesh.fromGLTF -- a real model (multi-node,
  // see beaconMesh above) rather than another hand-built shape, on the
  // home island, clear of its crates/hazard.
  {
    const homeTerrainItem = placed.find((p) => p.kind === 'terrain' && p.options.seed === islandDefs[0].seed);
    const bx = islandDefs[0].position.x, bz = islandDefs[0].position.z + 6;
    const by = homeTerrainItem.handle.sampleHeight(bx, bz);
    const beacon = app.addEntity({ mesh: beaconMesh, color: [0.85, 0.82, 0.9], position: new Opus.Vec3(bx, by, bz), scale: new Opus.Vec3(1, 1, 1) });
    addPlaced({ kind: 'cube', entity: beacon, behaviors: [] });
  }

  // A bonus crate authored via the node graph (start -> Increment Counter
  // -> Message), not Custom Script -- proves the graph system on real
  // shipped content, not just the editor's own tests. Optional: doesn't
  // gate the main win condition, just a small discoverable extra.
  {
    const bonusIsland = islandDefs[1];
    const bx = bonusIsland.position.x, bz = bonusIsland.position.z - 6;
    const bonusTerrainItem = placed.find((p) => p.kind === 'terrain' && p.options.seed === bonusIsland.seed);
    const by = bonusTerrainItem.handle.sampleHeight(bx, bz) + 0.5;
    const bonusGraph = {
      nodes: [
        { id: 'b1', type: 'incrementCounter', counter: 'bonus' },
        { id: 'b2', type: 'message', text: '✨ Bonus crate found!' },
      ],
      edges: [
        { from: 'start', to: 'b1', kind: 'next' },
        { from: 'b1', to: 'b2', kind: 'next' },
      ],
    };
    const bonusEntity = app.addEntity({ mesh: cubeMesh, color: [0.85, 0.4, 1], position: new Opus.Vec3(bx, by, bz), scale: new Opus.Vec3(1, 1, 1) });
    bonusEntity.spin = 1.6;
    addPlaced({ kind: 'cube', entity: bonusEntity, behaviors: [{ trigger: 'enter', action: 'graph', graph: bonusGraph }] });
  }

  const waterOpts = { size: 84, segments: 48, position: new Opus.Vec3(0, -1.6, 0) };
  const water = app.createWater(waterOpts);
  addPlaced({ kind: 'water', handle: water, options: waterOpts });

  // Boost pads on the open-water routes between islands — a shortcut lane
  // worth steering for, not just open water to cross. Hover height over
  // water is waterY + 0.55, so pads sit close to that to be actually driven
  // through rather than under or over.
  spawnBoostPad(new Opus.Vec3(0, -1.0, 0));
  spawnBoostPad(new Opus.Vec3(-5, -1.0, 10));
  spawnBoostPad(new Opus.Vec3(10, -1.0, -10));
  spawnBoostPad(new Opus.Vec3(-15, -1.0, -10));
  spawnBoostPad(new Opus.Vec3(-15, -1.0, 10));

  renderSceneList();
}

const appEl = document.getElementById('app');
const chromeToggleBtn = document.getElementById('chrome-toggle-btn');
// Export Tiers: an "Export Playable Game" sets window.__OPUS_PLAYABLE_ONLY__
// (see the export handler below) before this same editor/runtime script
// runs -- the identical code executes either way (see that handler's own
// comment on why: NOT a second, divergent runtime), this flag only decides
// whether the ONE entry point back into editing (the chrome-toggle button)
// is left reachable. Checked inside the click handler itself, not just by
// hiding the button, so a button re-shown by some other bug still can't
// actually open the editor.
let playableOnlyMode = false;

function setEditorVisible(visible) {
  if (playableOnlyMode && visible) return;
  if(!visible){performanceProfilerToggle.checked=false;performanceCaptureRequested=false;app.setPerformanceCapture(false);syncPerformanceProfiler(true);}
  appEl.classList.toggle('editor-hidden', !visible);
  renderScriptTrustControls();
  chromeToggleBtn.textContent = visible ? '✕ Close Editor' : '🛠 Edit This Game';
  if (visible) {
    document.getElementById('script-trust-launch-gate').hidden = true;
    if (playMode) exitPlayMode();
  } else if (!playMode) {
    if (window.__OPUS_EMBEDDED_PROJECT__ && scriptTrustSeen && !scriptsTrusted) { showStandaloneScriptChoice(); return; }
    window.__gameState = {};
    enterPlayMode();
    // Starter-scene-specific initial readout; a generic "on level start"
    // objective hook is the natural next step once there's more than one
    // authored scenario to support.
    const collectibleCount = placed.filter((item) => item.kind === 'cube' && item.behaviors.some((b) => b.action === 'script' && b.param.includes('__gameState.crates'))).length;
    if (collectibleCount > 0) setObjective(`Crates: 0/${collectibleCount}`);
  }
}

chromeToggleBtn.addEventListener('click', () => setEditorVisible(appEl.classList.contains('editor-hidden')));

