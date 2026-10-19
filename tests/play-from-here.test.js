'use strict';
// Play From Here: the spawn override applies only during that session on the
// level it was started from, faces the editor view, and is wired into Play.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = { window: { addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } };
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), c);
const O = c.window.Opus;
const source = fs.readFileSync(path.join(root, 'editor/src/modules/58-play-from-here.js'), 'utf8');

const camera = new O.Camera(); camera.yaw = -Math.PI / 2; camera.pitch = 0.5; camera.target = new O.Vec3(4, 0, 2); camera.distance = 10;
const entity = new O.Entity({ mesh: O.Mesh.cube() });
const ctx = {
  Opus: O, Math, Number, app: { camera }, playMode: false, currentLevelIndex: 1, player: null,
  canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
  screenSurfaceHit: () => ({ point: new O.Vec3(4, 0.5, 2) }),
};
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function startPlayFromHere')) + '\nthis.setPlayFromHere = (v) => { playFromHere = v; };', ctx);

const target = ctx.playFromHereTarget();
assert.deepStrictEqual([target.point.x, target.point.y, target.point.z], [4, 0.5, 2], 'surface under the view');
// Camera yaw -90° sits on -X looking toward +X: the player should face +X.
assert(Math.abs(target.yaw - Math.PI / 2) < 1e-9, 'faces the way the editor looks: ' + target.yaw);

ctx.setPlayFromHere({ point: target.point, yaw: target.yaw, levelIndex: 1 });
assert.strictEqual(ctx.playFromHereSpawn(), null, 'no override outside Play');
ctx.playMode = true;
assert.strictEqual(ctx.playFromHereSpawn().x, 4, 'used for the spawn and respawns during that session');
ctx.currentLevelIndex = 2;
assert.strictEqual(ctx.playFromHereSpawn(), null, 'another level uses its own spawn');
assert.strictEqual(ctx.playFromHereActive(), false);

ctx.player = { entity };
ctx.applyPlayFromHereFacing(1.2);
assert(Math.abs(entity.rotationY - 1.2) < 1e-9, 'the fresh player turns to the view');

// Wiring into the real Play path.
const spawn = fs.readFileSync(path.join(root, 'editor/src/modules/15-scatter-brush.js'), 'utf8');
assert(spawn.includes("typeof playFromHereSpawn === 'function' ? playFromHereSpawn() : null"), 'computeSpawnPoint honours the override');
const play = fs.readFileSync(path.join(root, 'editor/src/modules/30-play-mode-runtime.js'), 'utf8');
assert(play.includes('if (!fromHere && startLevelIndex !== currentLevelIndex'), 'stays on the edited level');
assert(play.includes("playFromHereActive()) return; // testing a spot"), 'skips the Start Screen');
assert(fs.readFileSync(path.join(root, 'editor/index.html'), 'utf8').includes('id="play-here-btn"'));
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('58-play-from-here.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Play From Here: target, facing, session/level scope and Play wiring PASS');
