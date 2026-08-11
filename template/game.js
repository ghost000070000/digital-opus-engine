/**
 * Digital Opus Engine — Starter Template game script.
 *
 * This starter project demonstrates how to:
 * 1. Initialize an Opus app instance bound to a canvas element.
 * 2. Create procedural terrain and animated water.
 * 3. Add lit 3D entities to the scene.
 * 4. Hook frame update callbacks and keyboard input.
 */

// 1. Get the canvas element and create a zero-config Opus engine instance
const canvas = document.getElementById('game');
const app = Opus.create(canvas);

// 2. Generate a small procedural terrain island
const terrain = app.createTerrain({
  size: 20,
  segments: 48,
  seed: 42,
  radius: 8,
  amplitude: 1.5,
  waterLevel: -1.6,
});

// 3. Create animated ocean water plane surrounding the island
const water = app.createWater({
  size: 32,
  segments: 48,
  position: new Opus.Vec3(0, -1.6, 0),
});

// 4. Create a cube mesh and add a spinning lit object at the island center
const cubeMesh = Opus.Mesh.cube();
const spinner = app.addEntity({
  mesh: cubeMesh,
  color: [0.35, 0.65, 0.95],
  position: new Opus.Vec3(0, 1.2, 0),
  scale: new Opus.Vec3(1, 1, 1),
});
spinner.spin = 1.0; // Spin 1 radian per second

// 5. Register a per-frame update callback to handle input or logic
app.onUpdate((dt, elapsed) => {
  // Move object slightly up and down using a sine wave
  spinner.position.y = 1.2 + Math.sin(elapsed * 2.0) * 0.3;

  // React to keyboard input (Space key changes cube color)
  if (app.input.isDown('Space')) {
    spinner.color = [0.95, 0.4, 0.35];
  } else {
    spinner.color = [0.35, 0.65, 0.95];
  }
});
