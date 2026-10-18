// Digital Opus first-run onboarding state and progress contract.
// Editor preferences live in their own local key and never enter project or
// runtime game state. Plain UMD keeps the contract dependency-free/testable.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpusOnboarding = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const STORAGE_KEY = 'digital-opus:onboarding:v1';
  const VERSION = 2;
  const TARGETS = Object.freeze({
    'object.cube': Object.freeze({ selector: '#palette-cube', surface: 'objects' }),
    'viewport.move': Object.freeze({ selector: '#gizmo-mode-move', surface: 'viewport' }),
    'inspector.component': Object.freeze({ selector: '#add-component-btn', surface: 'inspector' }),
    'inspector.preset': Object.freeze({ selector: '#gameplay-preset-btn', surface: 'inspector' }),
    'level.player': Object.freeze({ selector: '#player-controller-type', surface: 'level' }),
    'ui.hud': Object.freeze({ selector: '#hud-add-btn', surface: 'ui' }),
    'top.play': Object.freeze({ selector: '#play-btn', surface: 'top' }),
    'top.save': Object.freeze({ selector: '#save-btn', surface: 'top' }),
    'project.export-playable': Object.freeze({ selector: '#export-playable-btn', surface: 'project' }),
  });
  const STEPS = Object.freeze([
    { id: 'place', title: 'Place an object', instruction: 'Drag a Cube from Objects into the viewport. This will be your first game object.', targetKey: 'object.cube', target: TARGETS['object.cube'].selector, ...TARGETS['object.cube'] },
    { id: 'move', title: 'Move it', instruction: 'Select the object, choose Move, and drag an axis handle—or edit Position in the Inspector.', targetKey: 'viewport.move', target: TARGETS['viewport.move'].selector, ...TARGETS['viewport.move'] },
    { id: 'component', title: 'Add a Component', instruction: 'Use Add Component to attach visible reusable data such as Health.', targetKey: 'inspector.component', target: TARGETS['inspector.component'].selector, ...TARGETS['inspector.component'] },
    { id: 'preset', title: 'Give it gameplay', instruction: 'Apply the Collectible gameplay preset. The resulting Behaviors stay visible and editable.', targetKey: 'inspector.preset', target: TARGETS['inspector.preset'].selector, ...TARGETS['inspector.preset'] },
    { id: 'player', title: 'Configure the Player', instruction: 'Open Level → Player Controller and choose how the Player moves. The Player is created when Play starts.', targetKey: 'level.player', target: TARGETS['level.player'].selector, ...TARGETS['level.player'] },
    { id: 'hud', title: 'Add simple HUD', instruction: 'Open UI and add a Counter Display so the collectible result is visible.', targetKey: 'ui.hud', target: TARGETS['ui.hud'].selector, ...TARGETS['ui.hud'] },
    { id: 'play', title: 'Play your game', instruction: 'Press Play and move into the collectible. Stop returns to authoring.', targetKey: 'top.play', target: TARGETS['top.play'].selector, ...TARGETS['top.play'] },
    { id: 'save', title: 'Save the project', instruction: 'Save stores this named project locally in your browser.', targetKey: 'top.save', target: TARGETS['top.save'].selector, ...TARGETS['top.save'] },
    { id: 'export', title: 'Export Playable', instruction: 'Open Project → Import / Export and export a real Playable Game HTML file.', targetKey: 'project.export-playable', target: TARGETS['project.export-playable'].selector, ...TARGETS['project.export-playable'] },
  ]);
  const fresh = () => ({ version: VERSION, firstRunSeen: false, doNotShowAgain: false, tutorial: { started: false, active: false, completed: false, projectName: '', startedAt: null, completedAt: null, cursorStepId: null, flags: {}, skipped: {} } });
  function normalize(value) {
    const base = fresh();
    if (!value || typeof value !== 'object') return base;
    const tutorial = value.tutorial && typeof value.tutorial === 'object' ? value.tutorial : {};
    const cursorStepId = STEPS.some((step) => step.id === tutorial.cursorStepId) ? tutorial.cursorStepId : null;
    return { ...base, ...value, version: VERSION, tutorial: { ...base.tutorial, ...tutorial, cursorStepId, flags: { ...(tutorial.flags || {}) }, skipped: { ...(tutorial.skipped || {}) } } };
  }
  function createStore(storage) {
    const backing = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const read = () => { try { return normalize(JSON.parse(backing && backing.getItem(STORAGE_KEY))); } catch (_) { return fresh(); } };
    const write = (state) => { const next = normalize(state); if (backing) backing.setItem(STORAGE_KEY, JSON.stringify(next)); return next; };
    const choose = (choice, doNotShowAgain) => { const state = read(); state.firstRunSeen = true; state.doNotShowAgain = !!doNotShowAgain; state.lastChoice = choice; return write(state); };
    const start = (projectName) => { const state = read(); state.firstRunSeen = true; state.tutorial = { started: true, active: true, completed: false, projectName: projectName || 'guided-first-game', startedAt: state.tutorial.startedAt || new Date().toISOString(), completedAt: null, cursorStepId: state.tutorial.cursorStepId || null, flags: state.tutorial.flags || {}, skipped: state.tutorial.skipped || {} }; return write(state); };
    const pause = () => { const state = read(); state.tutorial.active = false; return write(state); };
    const resume = () => { const state = read(); if (state.tutorial.started && !state.tutorial.completed) state.tutorial.active = true; return write(state); };
    const restart = (projectName) => { const state = read(); state.firstRunSeen = true; state.tutorial = { started: true, active: true, completed: false, projectName: projectName || 'guided-first-game', startedAt: new Date().toISOString(), completedAt: null, cursorStepId: null, flags: {}, skipped: {} }; return write(state); };
    const mark = (id, value = true) => { const state = read(); state.tutorial.flags[id] = value; state.tutorial.cursorStepId = null; return write(state); };
    const focus = (id) => { const state = read(); if (STEPS.some((step) => step.id === id)) state.tutorial.cursorStepId = id; return write(state); };
    const skip = (id) => { const state = read(); if (STEPS.some((step) => step.id === id)) state.tutorial.skipped[id] = true; state.tutorial.cursorStepId = null; return write(state); };
    const complete = () => { const state = read(); state.tutorial.active = false; state.tutorial.completed = true; state.tutorial.completedAt = new Date().toISOString(); return write(state); };
    const bindProject = (scopeId) => { const state = read(); if (typeof scopeId === 'string' && scopeId) state.tutorial.projectScopeId = scopeId; return write(state); };
    return { read, write, choose, start, pause, resume, restart, mark, focus, skip, complete, bindProject, shouldShowFirstRun: () => { const s = read(); return !s.firstRunSeen && !s.doNotShowAgain; } };
  }
  function evaluate(snapshot, state) {
    const tutorial = (state && state.tutorial) || {};
    const flags = tutorial.flags || {};
    const skipped = tutorial.skipped || {};
    const checks = {
      place: (snapshot.objectCount || 0) > 0,
      move: !!flags.move,
      component: (snapshot.componentCount || 0) > 0,
      preset: (snapshot.presetIds || []).includes('collectible'),
      player: !!flags.player,
      hud: (snapshot.hudCount || 0) > 0,
      play: !!flags.play,
      save: !!flags.save,
      export: !!flags.export,
    };
    const steps = STEPS.map((step) => ({ ...step, ...TARGETS[step.targetKey], performed: !!checks[step.id], skipped: !!skipped[step.id] && !checks[step.id], complete: !!checks[step.id] || !!skipped[step.id] }));
    const firstIncomplete = steps.findIndex((step) => !step.complete);
    const cursorIndex = steps.findIndex((step) => step.id === tutorial.cursorStepId);
    return { steps, completedCount: steps.filter((step) => step.complete).length, performedCount: steps.filter((step) => step.performed).length, skippedCount: steps.filter((step) => step.skipped).length, total: steps.length, currentIndex: cursorIndex >= 0 ? cursorIndex : (firstIncomplete === -1 ? steps.length - 1 : firstIncomplete), complete: firstIncomplete === -1 };
  }
  function resolveTarget(targetKey, query) {
    const target = TARGETS[targetKey];
    return target ? query(target.selector) : null;
  }
  return { STORAGE_KEY, VERSION, TARGETS, STEPS, fresh, normalize, createStore, evaluate, resolveTarget };
});
