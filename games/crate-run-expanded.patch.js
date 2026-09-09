// Game A: Crate Run Expanded
//
// Not a from-scratch scene like games/temple-switch-puzzle.json and
// games/survival-arena.json -- this is the shipped Crate Run starter game
// (built by buildStarterGame() in editor/src/01-editor.js) PLUS a real
// evolution of its mechanics, not just more islands:
//   - A 3-life system: hazards cost a life and respawn you at your last
//     checkpoint, instead of ending the game on the first touch.
//   - Checkpoints near three of the farther islands.
//   - The existing 21-crate collection win condition is untouched.
//
// Applied as a patch rather than shipped as a second full scene export,
// since re-serializing all 47 starter-game objects (most of them identical
// crates/terrain the base game already has) to duplicate a ~49KB JSON file
// would mostly just be redundant copies of content that already exists --
// the actual NEW content here is small.
//
// Usage: open editor/index.html (the shipped Crate Run loads by default),
// open the browser console, paste this file's contents, then press Play.
// To keep it, use Project -> Export Project to save the result.
//
// Verified (see API-FRICTION.md, "Major Expansion Batch" section): the
// 3-hit lives/respawn/lose sequence fires correctly (including falling back
// to the normal spawn point before any checkpoint is touched, and to the
// most recent checkpoint after), and the full 21-crate win path is
// unaffected by these changes.

(function applyCrateRunExpandedPatch() {
  function makeGraph(actionNodes) {
    const nodes = []; const edges = []; let prev = 'start'; let idc = 1;
    for (const spec of actionNodes) {
      const id = `n${idc++}`;
      nodes.push({ id, type: spec.type, x: 60, y: 140, ...spec.fields });
      edges.push({ from: prev, to: id, kind: 'next' });
      if (spec.gate) {
        const gid = `n${idc++}`;
        nodes.push({ id: gid, type: spec.gate.type, x: 60, y: 300, ...spec.gate.fields });
        edges.push({ from: gid, to: id, kind: 'gate' });
      }
      prev = id;
    }
    return { nodes, edges };
  }

  placeItem('trigger', new Opus.Vec3(0, 0, 0));
  const manager = placed[placed.length - 1];
  manager.name = 'GameManager';
  manager.behaviors.push({ trigger: 'start', action: 'setCounter', params: { counter: 'lives', value: 3 } });
  manager.behaviors.push({
    trigger: 'start',
    action: 'objective',
    param: 'Collect all crates! Hazards cost a life (3) and send you back to your last checkpoint.',
  });

  const hazards = placed.filter((p) => p.kind === 'cube' && p.behaviors.some((b) => b.action === 'lose'));
  for (const hazard of hazards) {
    hazard.behaviors = hazard.behaviors.filter((b) => b.action !== 'lose');
    hazard.behaviors.push({
      trigger: 'enter',
      action: 'graph',
      graph: makeGraph([
        { type: 'decrementCounter', fields: { counter: 'lives', floorAtZero: true } },
        { type: 'message', fields: { text: 'Ouch! Back to your last checkpoint.' } },
        { type: 'respawnAtCheckpoint', fields: {} },
        { type: 'lose', gate: { type: 'counterAtMost', fields: { counter: 'lives', target: 0 } } },
      ]),
    });
  }

  const checkpointSpots = [[20, 0.5, 20], [-20, 0.5, -20], [-20, 0.5, 20]];
  for (const [x, , z] of checkpointSpots) {
    placeItem('trigger', new Opus.Vec3(x, 0, z));
    const cp = placed[placed.length - 1];
    cp.name = 'Checkpoint';
    cp.behaviors.push({ trigger: 'enter', action: 'setCheckpoint', params: {} });
  }

  renderSceneList();
  console.log(`Crate Run Expanded patch applied: ${hazards.length} hazards converted to lives/respawn, 3 checkpoints added.`);
})();
