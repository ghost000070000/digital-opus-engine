'use strict';
// Variables panel scanning/rename and live graph debug pulses, against the actual module.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/53-logic-debugger.js'), 'utf8');
// Declarations only: the DOM-mounting IIFEs at the end of each section are skipped.
const declarations = source.slice(0, source.indexOf('// --- Variables section (Project tab) ---')) +
  source.slice(source.indexOf('// --- Live graph debugging ---'), source.indexOf('(function mountGraphWatch'));
const plain = (v) => JSON.parse(JSON.stringify(v));

function fixture() {
  let undo = 0;
  const graph = { nodes: [{ id: 'n1', type: 'counterReaches', counter: 'score', value: 3 }, { id: 'n2', type: 'readGraphVariable', variableId: 'v1' }],
    edges: [], variables: [{ id: 'v1', name: 'combo', type: 'number', scope: 'game' }, { id: 'v2', name: 'temp', type: 'number', scope: 'local' }, { id: 'v3', name: 'charge', type: 'number', scope: 'object' }] };
  const crate = { id: 'crate', kind: 'cube', name: 'Crate', variables: { charge: 1 }, behaviors: [
    { trigger: 'enter', action: 'incrementCounter', params: { counter: 'score' } },
    { trigger: 'click', action: 'setFlagTrue', params: { name: 'opened' } },
    { trigger: 'start', action: 'graph', graph },
    { trigger: 'start', action: 'script', params: { code: 'if (__gameFlags.opened) {}' } },
  ] };
  const ctx = {
    console, JSON, Object, Array, Set, Map, String, Number,
    ACTION_TYPES: { incrementCounter: { label: 'Increment Counter', fields: [{ key: 'counter', label: 'Counter name', type: 'text' }] }, setFlagTrue: { label: 'Set Flag True', fields: [{ key: 'name', label: 'Flag name', type: 'text' }] }, script: { label: 'Script', fields: [{ key: 'code', label: 'Script', type: 'text' }] } },
    CONDITION_TYPES: {},
    GRAPH_NODE_TYPES: { counterReaches: { label: 'Counter Reaches', fields: [{ key: 'counter', type: 'text', placeholder: 'Counter name' }] } },
    placed: [crate], currentLevelIndex: 0, playMode: false,
    currentSequences: [{ id: 's1', steps: [{ type: 'incrementCounter', params: { counter: 'score' } }] }],
    currentUiConfig: { hudElements: [{ id: 'h1', binding: { version: 1, source: 'counter', name: 'score' } }, { id: 'h2', binding: { version: 1, source: 'gameVariable', name: 'combo' } }] },
    levels: [{ name: 'One', objects: [] }, { name: 'Two', objects: [{ id: 'gate', kind: 'cube', name: 'Gate', variables: { charge: 5 }, behaviors: [{ trigger: 'enter', action: 'incrementCounter', params: { counter: 'score' } }] }], sequences: [], ui: { hudElements: [] } }],
    itemDisplayName: (item) => item.name || item.id,
    pushUndo: () => { undo++; },
    window: { __gameState: { score: 2, combo: 7 }, __gameFlags: { opened: true }, __gameTimers: {} },
  };
  vm.createContext(ctx);
  vm.runInContext(declarations, ctx);
  return { ctx, crate, graph, undo: () => undo };
}

{
  const { ctx } = fixture();
  const groups = plain(ctx.collectProjectVariables().map((g) => ({ kind: g.kind, name: g.name, uses: g.uses.length })));
  const find = (kind, name) => groups.find((g) => g.kind === kind && g.name === name);
  assert.strictEqual(find('counter', 'score').uses, 5, 'counter found in behaviors, graph node, sequence, HUD and other level');
  assert.strictEqual(find('flag', 'opened').uses, 1);
  assert.strictEqual(find('graph-game', 'combo').uses, 2, 'game variable definition and its HUD binding');
  assert.strictEqual(find('object', 'charge').uses, 3, 'object Graph variable and Object Variables on both levels share one name space');
  assert(find('graph-local', 'temp'), 'local graph variables are listed');
  assert(!groups.some((g) => g.name === 'if (__gameFlags.opened) {}'), 'script code is not a variable name');
}
{
  // Counter rename reaches every level, the sequence, the graph node and the HUD binding, in one Undo step.
  const { ctx, crate, graph, undo } = fixture();
  const group = ctx.collectProjectVariables().find((g) => g.kind === 'counter' && g.name === 'score');
  const result = plain(ctx.renameProjectVariable(group, 'points'));
  assert(result.ok && result.count === 5, JSON.stringify(result));
  assert.strictEqual(undo(), 1, 'one Undo step');
  assert.strictEqual(crate.behaviors[0].params.counter, 'points');
  assert.strictEqual(graph.nodes[0].counter, 'points');
  assert.strictEqual(ctx.currentSequences[0].steps[0].params.counter, 'points');
  assert.strictEqual(ctx.currentUiConfig.hudElements[0].binding.name, 'points');
  assert.strictEqual(ctx.levels[1].objects[0].behaviors[0].params.counter, 'points', 'other levels are updated in their records');
  assert(!ctx.collectProjectVariables().some((g) => g.name === 'score'));
}
{
  // Game variable rename updates the definition (nodes keep their variable id) and HUD gameVariable bindings.
  const { ctx, graph } = fixture();
  const group = ctx.collectProjectVariables().find((g) => g.kind === 'graph-game');
  assert(ctx.renameProjectVariable(group, 'streak').ok);
  assert.strictEqual(graph.variables[0].name, 'streak');
  assert.strictEqual(graph.nodes[1].variableId, 'v1', 'nodes reference the variable by id');
  assert.strictEqual(ctx.currentUiConfig.hudElements[1].binding.name, 'streak');
}
{
  // Object variables: keys move on live objects and stored records; flags report script mentions.
  const { ctx, crate, graph } = fixture();
  const group = ctx.collectProjectVariables().find((g) => g.kind === 'object' && g.name === 'charge');
  assert(ctx.renameProjectVariable(group, 'energy').ok);
  assert.deepStrictEqual(plain(crate.variables), { energy: 1 });
  assert.deepStrictEqual(plain(ctx.levels[1].objects[0].variables), { energy: 5 });
  assert.strictEqual(graph.variables[2].name, 'energy');
  const flag = ctx.collectProjectVariables().find((g) => g.kind === 'flag');
  assert.strictEqual(ctx.renameProjectVariable(flag, 'unlocked').scriptMentions, true, 'scripts mentioning the old name are reported, not rewritten');
  assert(!ctx.renameProjectVariable(flag, '  ').ok && !ctx.renameProjectVariable(ctx.collectProjectVariables().find((g) => g.kind === 'flag'), 'unlocked').ok, 'empty and unchanged names are refused');
  ctx.playMode = true;
  assert(!ctx.renameProjectVariable(ctx.collectProjectVariables().find((g) => g.kind === 'flag'), 'other').ok, 'no renames during Play');
}
{
  // Live values come from the running game's state.
  const { ctx } = fixture(); ctx.playMode = true;
  const groups = ctx.collectProjectVariables();
  assert.strictEqual(ctx.liveVariableValue(groups.find((g) => g.kind === 'counter')), '2');
  assert.strictEqual(ctx.liveVariableValue(groups.find((g) => g.kind === 'flag')), 'true');
  assert.strictEqual(ctx.liveVariableValue(groups.find((g) => g.kind === 'graph-game')), '7');
}
{
  // Debug pulses only reach the graph being watched, on its own object.
  const { ctx, crate, graph } = fixture();
  const classes = new Set();
  const el = { classList: { add: (c) => classes.add(c), remove: (...c) => c.forEach((x) => classes.delete(x)) }, offsetWidth: 1 };
  ctx.document = { querySelector: () => el };
  ctx.CSS = { escape: (s) => s };
  ctx.graphEditorState = { watching: true, item: crate, existingBehavior: crate.behaviors[2] };
  ctx.graphDebugPulse(graph, crate, 'n1', 'false');
  assert(classes.has('graph-node-pulse-false'), 'false conditions flash red');
  ctx.graphDebugPulse(graph, crate, 'n2', 'run');
  assert(classes.has('graph-node-pulse') && !classes.has('graph-node-pulse-false'));
  classes.clear();
  ctx.graphDebugPulse({ nodes: [] }, crate, 'n1', 'run');
  ctx.graphDebugPulse(graph, { id: 'other' }, 'n1', 'run');
  ctx.graphEditorState.watching = false; ctx.graphDebugPulse(graph, crate, 'n1', 'run');
  assert.strictEqual(classes.size, 0, 'other graphs, other objects and non-watching editors are ignored');
}
{
  // runGraph pulses through the shared hook without requiring the module (guarded).
  const runtime = fs.readFileSync(path.join(root, 'editor/src/modules/26-node-graph-runtime.js'), 'utf8');
  assert(runtime.includes("typeof graphDebugPulse === 'function'"), 'runGraph pulses are optional');
  const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
  assert(modules.indexOf('53-logic-debugger.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)), 'module assembles before the boot module');
}
console.log('Logic debugger: variable scan, safe rename, live values, graph debug pulses PASS');
