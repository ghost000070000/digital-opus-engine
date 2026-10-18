'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Trigger = require('../editor/src/00-trigger-collider-2d.js');
const { createPrototype } = require('../tools/phase-044-dynamic-prototype.js');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { failed++; console.error(`  FAIL ${name}\n${error.stack}`); } }
const box = (size = [2, 2]) => ({ version: 1, enabled: true, offset: [0, 0], size });
const circle = (radius = 1) => ({ version: 1, enabled: true, offset: [0, 0], radius });
const body = (type = 'static', velocity = [0, 0]) => ({ version: 1, enabled: true, type, linearVelocity: velocity });
function item(id, x, y, components, rotation = 0) { return { id, kind: 'cube', components, entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0], rotation }) }; }
function mover(shape = 'box', x = 0, y = 5, velocity = [0, 0]) { return item('mover', x, y, { 'body-2d': body('kinematic', velocity), [shape === 'box' ? Collider.BOX_ID : Collider.CIRCLE_ID]: shape === 'box' ? box() : circle() }); }
function staticBody(shape = 'box', x = 0, y = -2, rotation = 0) { return item('static', x, y, { 'body-2d': body(), [shape === 'box' ? Collider.BOX_ID : Collider.CIRCLE_ID]: shape === 'box' ? box([100, .2]) : circle() }, rotation); }
function separated(a, b) { return Collider.enumerateCollider2DWorldShapes(a).every((one) => Collider.enumerateCollider2DWorldShapes(b).every((two) => Body.separation(one, two) >= -Body.CONTACT_EPSILON)); }
function run(m, wall, hz, seconds, gravity = [0, -9.81]) { const p = createPrototype(m, { gravity }); for (let i = 0; i < hz * seconds; i++) p.step(1 / hz, wall ? [wall] : []); return p; }

console.log('Phase 044 qualification-only Dynamic utility tests');
test('product schema remains Body v1 Static/Kinematic', () => { const source = fs.readFileSync(path.join(ROOT, 'editor/src/00-authoring-schema.js'), 'utf8'); const schema = require('../editor/src/00-authoring-schema.js').registry.get('body-2d'); assert.strictEqual(schema.version, 1); assert.deepStrictEqual(schema.fields.find((field) => field.key === 'type').choices, ['static', 'kinematic']); assert(!schema.ownedFields.includes('gravity')); assert(!source.includes("choices: ['static', 'kinematic', 'dynamic']")); });
test('analytic free fall matches 30/60/120/144/240 Hz', () => { for (const hz of [30, 60, 120, 144, 240]) { const m = mover('box', 0, 5); const p = run(m, null, hz, 10); assert(Math.abs(m.entity.position.y - (5 - 490.5)) < 1e-7, `${hz} position ${m.entity.position.y}`); assert(Math.abs(p.velocity[1] + 98.1) < 1e-7, `${hz} velocity`); } });
test('Box and Circle rest on floor for 60 simulated seconds', () => { for (const shape of ['box', 'circle']) { const m = mover(shape), wall = staticBody(); const p = run(m, wall, 60, 60); assert(separated(m, wall)); assert(Math.abs(m.entity.position.y + .9) < 1e-3, `${shape} rest ${m.entity.position.y}`); assert.strictEqual(p.velocity[1], 0); assert.strictEqual(p.manager.metrics.cappedSweeps, 0, `${shape} rest cap`); } });
test('floor-contact partition is within collision tolerance', () => { const results = [30, 60, 120, 144, 240].map((hz) => { const m = mover(), wall = staticBody(), p = run(m, wall, hz, 10); assert(separated(m, wall)); return { y: m.entity.position.y, vy: p.velocity[1], caps: p.manager.metrics.cappedSweeps }; }); assert(Math.max(...results.map((r) => r.y)) - Math.min(...results.map((r) => r.y)) < 1e-4, JSON.stringify(results)); assert(results.every((r) => r.vy === 0 && r.caps === 0)); });
test('tangential X velocity survives Y floor contact', () => { const m = mover('box', 0, 5, [2, 0]), wall = staticBody(), p = run(m, wall, 60, 10); assert(separated(m, wall)); assert(Math.abs(m.entity.position.x - 20) < 1e-6); assert.strictEqual(p.velocity[0], 2); assert.strictEqual(p.velocity[1], 0); });
test('horizontal gravity rests against wall without bounce', () => { const m = mover('circle', 0, 0), wall = staticBody('box', 4, 0); wall.components[Collider.BOX_ID].size = [.2, 100]; const p = run(m, wall, 60, 60, [9.81, 0]); assert(separated(m, wall)); assert(m.entity.position.x < 3); assert.strictEqual(p.velocity[0], 0); assert.strictEqual(p.manager.metrics.cappedSweeps, 0); });
test('thin floor blocks high-speed fall at clamped dt', () => { const m = mover('circle', 0, 10, [0, -1000]), wall = staticBody(); wall.components[Collider.BOX_ID].size = [100, .02]; const p = createPrototype(m); const result = p.step(1, [wall]); assert.strictEqual(result.dt, .1); assert(result.move.blockedY); assert(separated(m, wall)); assert(m.entity.position.y > -2); });
test('all four shape pairs block and stay legal', () => { for (const a of ['box', 'circle']) for (const b of ['box', 'circle']) { const m = mover(a, 0, 5, [0, -70]), wall = staticBody(b, 0, -2); const p = createPrototype(m); const result = p.step(.1, [wall]); assert(result.move.blockedY, `${a}/${b}`); assert(separated(m, wall), `${a}/${b}`); } });
test('rotated Static Box accepts bounded collision', () => { const m = mover('circle', 0, 5, [0, -50]), wall = staticBody('box', 0, -2, Math.PI / 5); wall.components[Collider.BOX_ID].size = [6, .5]; const p = createPrototype(m); for (let i = 0; i < 60; i++) { p.step(.1, [wall]); assert(separated(m, wall)); } });
test('multi-collider mover does not penetrate Static floor', () => { const m = mover('box', 0, 5), wall = staticBody(); m.components[Collider.CIRCLE_ID] = { ...circle(.6), offset: [0, -1] }; run(m, wall, 60, 10); assert(separated(m, wall)); });
test('Dynamic proxy does not physically respond to Dynamic/Kinematic', () => { const m = mover('box', 0, 0, [10, 0]); const other = mover('box', 2, 0); other.id = 'other'; const p = createPrototype(m, { gravity: [0, 0] }); p.step(.1, [other]); assert.strictEqual(m.entity.position.x, 1); assert(!separated(m, other)); });
test('ordinary Collider and Tilemap metadata do not obstruct', () => { const m = mover('box', 0, 5); const passive = item('passive', 0, 0, { [Collider.BOX_ID]: box([10, .2]) }); const p = run(m, passive, 60, 2); assert(m.entity.position.y < 0); assert.strictEqual(p.manager.metrics.narrowTests, 0); });
test('Trigger observes post-movement position', () => { const m = mover('box', 0, 0, [10, 0]); const sensor = item('sensor', 3, 0, { [Trigger.COMPONENT_ID]: { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [2, 2], radius: 1 } }); const events = []; const t = Trigger.createTriggerLifecycle({ emit: (event) => events.push(event.eventType) }); const p = createPrototype(m, { gravity: [0, 0] }); p.step(.1, [], () => t.tick([m, sensor])); assert.deepStrictEqual(events, [Trigger.ENTER]); });
test('singular parent-style translator fails safely', () => { const m = mover(), p = createPrototype(m, { translateWorld: () => false }); const result = p.step(.1); assert.deepStrictEqual(result.move.actualDelta, { x: 0, y: 0 }); assert.strictEqual(p.velocity[1], 0); assert.strictEqual(p.rejectedTranslations, 1); assert(Number.isFinite(m.entity.position.y)); });
test('zero gravity retains initial velocity', () => { const m = mover('box', 0, 0, [3, 4]), p = run(m, null, 60, 10, [0, 0]); assert(Math.abs(m.entity.position.x - 30) < 1e-7); assert(Math.abs(m.entity.position.y - 40) < 1e-7); assert.deepStrictEqual(p.velocity, [3, 4]); });

console.log(`Phase 044 Dynamic utility focused: ${passed}/${passed + failed} passed`);
if (failed) process.exitCode = 1;
