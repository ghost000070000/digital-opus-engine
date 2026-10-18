'use strict';
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ROOT = path.resolve(__dirname, '..');
const collider = require('../editor/src/00-collider-2d.js');
const trigger2D = require('../editor/src/00-trigger-collider-2d.js');
const OUT = path.join(ROOT, 'qualification', 'phase-042');
fs.mkdirSync(OUT, { recursive: true });

function rng(seed) { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; }; }
function sensor() { return { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [2, 2], radius: 1 }; }
function box() { return { version: 1, enabled: true, offset: [0, 0], size: [2, 2] }; }
function object(id, x, components) { return { id, kind: 'cube', worldMatrix: collider.composeMatrix({ position: [x, 0, 0] }), components }; }

const seeds = Array.from({ length: 20 }, (_, index) => 0x420000 + index * 7919);
let transitions = 0; let callbackMutations = 0; let comparisons = 0;
const seedEvidence = [];
for (const seed of seeds) {
  const random = rng(seed);
  const trigger = object(`trigger-${seed}`, 0, { [trigger2D.COMPONENT_ID]: sensor() });
  const target = object(`target-${seed}`, 8, { [collider.BOX_ID]: box() });
  let triggerPresent = true; let targetPresent = true; let expectedPrevious = false;
  const manager = trigger2D.createTriggerLifecycle();
  manager.subscribe(trigger2D.ENTER, () => {
    if (random() < .015) { const component=target.components[collider.BOX_ID]||target.components[collider.CIRCLE_ID]; if(component){component.enabled=false;callbackMutations++;} }
  });
  for (let step = 0; step < 25000; step++) {
    const op = Math.floor(random() * 18);
    if (op <= 2) target.worldMatrix = collider.composeMatrix({ position: [(random()-.5)*16, 0, 0] });
    else if (op === 3) trigger.worldMatrix = collider.composeMatrix({ position: [(random()-.5)*8, 0, 0] });
    else if (op === 4) { const component=target.components[collider.BOX_ID]||target.components[collider.CIRCLE_ID]; if(component)component.enabled=!component.enabled; }
    else if (op === 5) { if (target.components[collider.BOX_ID]||target.components[collider.CIRCLE_ID]) { delete target.components[collider.BOX_ID]; delete target.components[collider.CIRCLE_ID]; } else target.components[collider.BOX_ID]=box(); }
    else if (op === 6) { const existing=target.components[collider.BOX_ID]||target.components[collider.CIRCLE_ID]; const enabled=existing?existing.enabled:true; delete target.components[collider.BOX_ID]; delete target.components[collider.CIRCLE_ID]; if(random()<.5)target.components[collider.BOX_ID]={...box(),enabled,size:[.2+random()*4,.5]};else target.components[collider.CIRCLE_ID]={version:1,enabled,offset:[0,0],radius:.1+random()*2}; }
    else if (op === 7) { const component=target.components[collider.BOX_ID]||target.components[collider.CIRCLE_ID]; if(component){if(component.size)component.size=[.2+random()*4,.5];else component.radius=.1+random()*2;} }
    else if (op === 8 && trigger.components[trigger2D.COMPONENT_ID]) trigger.components[trigger2D.COMPONENT_ID].enabled = !trigger.components[trigger2D.COMPONENT_ID].enabled;
    else if (op === 9) { if (trigger.components[trigger2D.COMPONENT_ID]) delete trigger.components[trigger2D.COMPONENT_ID]; else trigger.components[trigger2D.COMPONENT_ID] = sensor(); }
    else if (op === 10) targetPresent = !targetPresent;
    else if (op === 11) triggerPresent = !triggerPresent;
    else if (op === 12) { manager.reset(); expectedPrevious = false; }
    else if (op === 13 && trigger.components[trigger2D.COMPONENT_ID]) trigger.components[trigger2D.COMPONENT_ID].shape = trigger.components[trigger2D.COMPONENT_ID].shape === 'box' ? 'circle' : 'box';
    else if (op === 14 && trigger.components[trigger2D.COMPONENT_ID]) { trigger.components[trigger2D.COMPONENT_ID].size=[.2+random()*5,.5];trigger.components[trigger2D.COMPONENT_ID].radius=.1+random()*2.5; }
    else if (op === 15) { const component=target.components[collider.BOX_ID]||target.components[collider.CIRCLE_ID]; if(component)component.enabled=true; }
    else if (op === 16 && trigger.components[trigger2D.COMPONENT_ID]) trigger.components[trigger2D.COMPONENT_ID].offset=[(random()-.5)*2,0];
    else if (op === 17) { target.worldMatrix=collider.identityMatrix();trigger.worldMatrix=collider.identityMatrix(); }

    const triggerComponent = trigger.components[trigger2D.COMPONENT_ID];
    const targetComponent = target.components[collider.BOX_ID] || target.components[collider.CIRCLE_ID];
    const triggerX = trigger.worldMatrix[12] + (triggerComponent ? triggerComponent.offset[0] : 0), targetX = target.worldMatrix[12];
    const triggerExtent = triggerComponent ? (triggerComponent.shape==='box'?triggerComponent.size[0]/2:triggerComponent.radius) : 0;
    const targetExtent = targetComponent ? (targetComponent.size?targetComponent.size[0]/2:targetComponent.radius) : 0;
    const current = !!(triggerPresent && targetPresent && triggerComponent && triggerComponent.enabled && targetComponent && targetComponent.enabled && Math.abs(targetX-triggerX) <= triggerExtent+targetExtent+collider.EPSILON);
    let expected = null;
    if (current) expected = expectedPrevious ? trigger2D.STAY : trigger2D.ENTER;
    else if (expectedPrevious && triggerPresent && targetPresent) expected = trigger2D.EXIT;
    const list = []; if (triggerPresent) list.push(trigger); if (targetPresent) list.push(target);
    const events = manager.tick(list);
    const actual = events.length ? events[0].eventType : null;
    if (events.length > 1 || actual !== expected) throw new Error(`seed ${seed} step ${step}: expected ${expected}, got ${events.map((event) => event.eventType).join(',')}`);
    comparisons++;
    // Callback mutation is intentionally observed only after this snapshot.
    expectedPrevious = current;
    transitions++;
  }
  seedEvidence.push({ seed, transitions: 25000, metrics: { ...manager.metrics } });
}
const fuzz = { phase: 42, seeds, transitions, comparisons, callbackMutations, status: transitions === 500000 ? 'pass' : 'fail', seedEvidence };
fs.writeFileSync(path.join(OUT, 'trigger-fuzz.json'), JSON.stringify(fuzz, null, 2));

function fixture(triggerCount, targetCount) {
  const values = [];
  for (let index = 0; index < triggerCount; index++) values.push(object(`trigger-${String(index).padStart(4, '0')}`, index * 10000, { [trigger2D.COMPONENT_ID]: sensor() }));
  for (let index = 0; index < targetCount; index++) values.push(object(`target-${String(index).padStart(5, '0')}`, index * 10 + 5000000, { [collider.BOX_ID]: box() }));
  return values;
}
function measure(triggerCount, targetCount) {
  const values = fixture(triggerCount, targetCount); const times = []; let metrics;
  const index=values.slice(0,triggerCount); for (let iteration = 0; iteration < 6; iteration++) { const manager = trigger2D.createTriggerLifecycle(); const start = performance.now(); manager.tick(values,index); const elapsed = performance.now() - start; if (iteration) times.push(elapsed); metrics = { ...manager.metrics }; }
  return { triggerCount, targetCount, candidatePairs: triggerCount * targetCount, minMs: Math.min(...times), medianMs: times.sort((a, b) => a - b)[Math.floor(times.length / 2)], metrics };
}
const fixtures = [measure(10, 100), measure(50, 250), measure(100, 1000)];
const passive = trigger2D.createTriggerLifecycle(); passive.tick(fixture(0,1000),[]);
const noTargetValues=fixture(1000,0),noTargets=trigger2D.createTriggerLifecycle(); noTargets.tick(noTargetValues,noTargetValues);
const performanceEvidence = { phase: 42, recommendedBudgetMs: 50, fixtures, zeroTriggerPassive: { ...passive.metrics }, thousandTriggersZeroColliders: { ...noTargets.metrics }, status: passive.metrics.candidates === 0 && noTargets.metrics.narrowTests === 0 ? 'pass' : 'fail' };
fs.writeFileSync(path.join(OUT, 'trigger-performance.json'), JSON.stringify(performanceEvidence, null, 2));
console.log(JSON.stringify({ fuzz: { transitions, seeds: seeds.length, callbackMutations, status: fuzz.status }, performance: fixtures.map((entry) => ({ pairs: entry.candidatePairs, minMs: +entry.minMs.toFixed(3), medianMs: +entry.medianMs.toFixed(3) })), passiveCandidates: passive.metrics.candidates, zeroTargetNarrow: noTargets.metrics.narrowTests }, null, 2));
