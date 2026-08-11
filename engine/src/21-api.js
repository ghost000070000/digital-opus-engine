/**
 * Digital Opus Engine public boundary. Only `window.Opus` leaves the build IIFE.
 * Public geometry objects are CPU-side descriptions; GPU objects remain private.
 */

function received(value) {
  if (typeof value === 'number') return String(value);
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  return value && value.constructor ? value.constructor.name : typeof value;
}

function fail(method, parameter, expected, value) {
  throw new TypeError(`${method}: "${parameter}" must be ${expected}; received ${received(value)}.`);
}

function finite(value, parameter, method) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(method, parameter, 'a number other than NaN or Infinity', value);
  return value;
}

function positive(value, parameter, method, allowZero = false) {
  finite(value, parameter, method);
  if (allowZero ? value < 0 : value <= 0) fail(method, parameter, allowZero ? 'a non-negative number' : 'greater than 0', value);
  return value;
}

function integer(value, parameter, method) {
  if (!Number.isInteger(value) || value <= 0) fail(method, parameter, 'a whole number greater than 0', value);
  return value;
}

function vector(value, parameter, method) {
  if (!(value instanceof Vec3)) fail(method, parameter, 'an Opus.Vec3', value);
  finite(value.x, `${parameter}.x`, method);
  finite(value.y, `${parameter}.y`, method);
  finite(value.z, `${parameter}.z`, method);
  return value;
}

function callback(value, parameter, method, optional = false) {
  if ((!optional || value !== undefined) && typeof value !== 'function') fail(method, parameter, 'a function', value);
  return value;
}

function canvasElement(value, method) {
  if (!value || typeof value.getContext !== 'function' || String(value.tagName).toLowerCase() !== 'canvas') {
    fail(method, 'canvas', 'an HTMLCanvasElement', value);
  }
}

function optionsObject(value, parameter, method) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(method, parameter, 'an options object', value);
}

function validateTerrainOptions(opts, method) {
  optionsObject(opts, 'options', method);
  if (opts.seed !== undefined) finite(opts.seed, 'options.seed', method);
  for (const name of ['size', 'radius', 'amplitude']) if (opts[name] !== undefined) positive(opts[name], `options.${name}`, method);
  for (const name of ['islandBase', 'oceanFloor', 'waterLevel']) if (opts[name] !== undefined) finite(opts[name], `options.${name}`, method);
  if (opts.segments !== undefined) {
    integer(opts.segments, 'options.segments', method);
    if (opts.segments > 254) fail(method, 'options.segments', 'a whole number from 1 through 254', opts.segments);
  }
  if (opts.position !== undefined) vector(opts.position, 'options.position', method);
}

function validateWaves(waves, method) {
  if (!Array.isArray(waves) || waves.length !== 3) fail(method, 'options.waves', 'an array of exactly 3 wave objects', waves);
  waves.forEach((wave, index) => {
    optionsObject(wave, `options.waves[${index}]`, method);
    if (!Array.isArray(wave.dir) || wave.dir.length !== 2) fail(method, `options.waves[${index}].dir`, 'a two-number array', wave.dir);
    finite(wave.dir[0], `options.waves[${index}].dir[0]`, method);
    finite(wave.dir[1], `options.waves[${index}].dir[1]`, method);
    if (Math.hypot(wave.dir[0], wave.dir[1]) === 0) fail(method, `options.waves[${index}].dir`, 'a non-zero direction', wave.dir);
    positive(wave.freq, `options.waves[${index}].freq`, method);
    finite(wave.speed, `options.waves[${index}].speed`, method);
    positive(wave.amp, `options.waves[${index}].amp`, method, true);
  });
}

function validateWaterOptions(opts, method) {
  optionsObject(opts, 'options', method);
  if (opts.size !== undefined) positive(opts.size, 'options.size', method);
  if (opts.segments !== undefined) {
    integer(opts.segments, 'options.segments', method);
    if (opts.segments > 254) fail(method, 'options.segments', 'a whole number from 1 through 254', opts.segments);
  }
  if (opts.position !== undefined) vector(opts.position, 'options.position', method);
  if (opts.waves !== undefined) validateWaves(opts.waves, method);
  if (opts.deepColor !== undefined && (!Array.isArray(opts.deepColor) || opts.deepColor.length !== 3 || opts.deepColor.some((n) => typeof n !== 'number' || !Number.isFinite(n)))) {
    fail(method, 'options.deepColor', 'a three-number RGB array', opts.deepColor);
  }
}

const DEFAULT_WAVES = Object.freeze([
  Object.freeze({ dir: [1, 0.2], freq: 0.6, speed: 1, amp: 0.1 }),
  Object.freeze({ dir: [-0.3, 1], freq: 1.3, speed: 0.7, amp: 0.06 }),
  Object.freeze({ dir: [0.6, -0.8], freq: 2.4, speed: 1.6, amp: 0.03 }),
]);

const MESH_DATA = new WeakMap();
const ENTITY_MESHES = new WeakMap();

function meshDescriptor(kind, data) {
  const descriptor = Object.freeze({ kind });
  MESH_DATA.set(descriptor, { kind, ...data });
  return descriptor;
}

function getEntityRenderMesh(entity) {
  return ENTITY_MESHES.get(entity);
}

/** CPU-side mesh factories. Returned descriptions are safe to share between App instances. */
const Mesh = Object.freeze({
  /** Returns a 1x1x1 cube description. */
  cube() { return meshDescriptor('cube', {}); },
  /** Returns a 1x1 plane description on the XZ plane. */
  plane() { return meshDescriptor('plane', {}); },
  /** Returns a subdivided XZ grid description. */
  grid(size = 30, segments = 48) {
    positive(size, 'size', 'Opus.Mesh.grid');
    integer(segments, 'segments', 'Opus.Mesh.grid');
    if (segments > 254) fail('Opus.Mesh.grid', 'segments', 'a whole number from 1 through 254', segments);
    return meshDescriptor('grid', { size, segments });
  },
  /** Returns a custom indexed mesh description. Input arrays are retained and must not be mutated. */
  fromArrays(positions, normals, indices) {
    const method = 'Opus.Mesh.fromArrays';
    if (!(positions instanceof Float32Array) || positions.length % 3) fail(method, 'positions', 'a Float32Array whose length is divisible by 3', positions);
    if (!(normals instanceof Float32Array) || normals.length !== positions.length) fail(method, 'normals', 'a Float32Array matching positions.length', normals);
    if (!(indices instanceof Uint16Array) || indices.length % 3) fail(method, 'indices', 'a Uint16Array of triangle indices', indices);
    return meshDescriptor('arrays', { positions, normals, indices });
  },
});

/** Procedural island creation and matching CPU sampling. */
const Terrain = Object.freeze({
  /** Creates a validated terrain description for `app.createTerrain`. */
  generate(options = {}) {
    validateTerrainOptions(options, 'Opus.Terrain.generate');
    return Object.freeze({ options: { ...options } });
  },
  /** Samples terrain height without mutation. Accepts a terrain handle or its options object. */
  sampleHeight(x, z, terrainOrOptions = {}) {
    finite(x, 'x', 'Opus.Terrain.sampleHeight');
    finite(z, 'z', 'Opus.Terrain.sampleHeight');
    const opts = terrainOrOptions && terrainOrOptions.options ? terrainOrOptions.options : terrainOrOptions;
    validateTerrainOptions(opts, 'Opus.Terrain.sampleHeight');
    const half = (opts.size ?? 22) * 0.5;
    return Math.abs(x) <= half && Math.abs(z) <= half ? islandHeight(x, z, opts) : (opts.oceanFloor ?? -2.4);
  },
  /** Samples the heightfield normal. */
  sampleNormal(x, z, terrainOrOptions = {}) {
    finite(x, 'x', 'Opus.Terrain.sampleNormal');
    finite(z, 'z', 'Opus.Terrain.sampleNormal');
    const opts = terrainOrOptions && terrainOrOptions.options ? terrainOrOptions.options : terrainOrOptions;
    validateTerrainOptions(opts, 'Opus.Terrain.sampleNormal');
    return sampleTerrainNormal(x, z, opts);
  },
});

/** Animated water creation and exact visible-wave sampling. */
const Water = Object.freeze({
  /** Creates a validated water description for `app.createWater`. */
  createSurface(options = {}) {
    validateWaterOptions(options, 'Opus.Water.createSurface');
    return Object.freeze({ options: { ...options } });
  },
  /** Returns world-space wave height for a water handle. */
  sampleHeight(water, x, z, time) {
    if (!water || !Array.isArray(water.waves) || !(water.position instanceof Vec3)) fail('Opus.Water.sampleHeight', 'water', 'a water handle returned by app.createWater', water);
    finite(x, 'x', 'Opus.Water.sampleHeight');
    finite(z, 'z', 'Opus.Water.sampleHeight');
    finite(time, 'time', 'Opus.Water.sampleHeight');
    return water.position.y + sampleWaveHeight(water.waves, x - water.position.x, z - water.position.z, time);
  },
  /** Returns surface height, normal, wave intensity, and foam factor. */
  sampleSurface(water, x, z, time) {
    const height = Water.sampleHeight(water, x, z, time);
    const d = 0.05;
    const hx = Water.sampleHeight(water, x + d, z, time) - Water.sampleHeight(water, x - d, z, time);
    const hz = Water.sampleHeight(water, x, z + d, time) - Water.sampleHeight(water, x, z - d, time);
    const normal = new Vec3(-hx / (2 * d), 1, -hz / (2 * d)).normalize();
    const amplitude = water.waves.reduce((sum, wave) => sum + wave.amp, 0) || 1;
    const intensity = Math.min(1, Math.abs(height - water.position.y) / amplitude);
    return { height, normal, intensity, foamFactor: Math.max(0, (height - water.position.y) / amplitude) };
  },
});

/** Validated collision, raycast, trigger, boundary, and buoyancy utilities. */
const Physics = Object.freeze({
  AABB,
  TriggerVolume,
  sphereSphereIntersect,
  raySphere,
  rayAABB,
  sampleWaveHeight,
  applyBuoyancy,
  resolveTerrainCollision(position, velocity, radius = 0.5, terrainOrOptions = {}) {
    vector(position, 'position', 'Opus.Physics.resolveTerrainCollision');
    vector(velocity, 'velocity', 'Opus.Physics.resolveTerrainCollision');
    positive(radius, 'radius', 'Opus.Physics.resolveTerrainCollision');
    const opts = terrainOrOptions && terrainOrOptions.options ? terrainOrOptions.options : terrainOrOptions;
    validateTerrainOptions(opts, 'Opus.Physics.resolveTerrainCollision');
    return resolveTerrainCollision(position, velocity, radius, opts);
  },
  applyMapBoundary(position, velocity, radius = 0.5, boundaryRadius = 18) {
    vector(position, 'position', 'Opus.Physics.applyMapBoundary');
    vector(velocity, 'velocity', 'Opus.Physics.applyMapBoundary');
    positive(radius, 'radius', 'Opus.Physics.applyMapBoundary');
    positive(boundaryRadius, 'boundaryRadius', 'Opus.Physics.applyMapBoundary');
    if (radius >= boundaryRadius) fail('Opus.Physics.applyMapBoundary', 'radius', 'less than boundaryRadius', radius);
    return applyMapBoundary(position, velocity, radius, boundaryRadius);
  },
});

/** Engine instance returned by `Opus.create`. */
class App {
  /** Creates an isolated engine instance around one canvas. */
  constructor(canvas, config = {}) {
    canvasElement(canvas, 'Opus.create');
    optionsObject(config, 'config', 'Opus.create');
    this.canvas = canvas;
    this.settings = new SettingsManager(config.settingsNamespace ?? 'doengine:settings', { quality: 'high', muted: false, ...config.defaultSettings });
    this.save = new SaveSystem(config.saveNamespace ?? 'doengine:save');
    this.audio = new AudioEngine();
    this.audio.setMuted(!!this.settings.get('muted'));

    const highQuality = this.settings.get('quality') !== 'low';
    this._qualitySettings = { dprCap: highQuality ? (config.dprCap ?? 2) : 1 };
    positive(this._qualitySettings.dprCap, 'config.dprCap', 'Opus.create');
    const context = initGL(canvas, this._qualitySettings);
    this._gl = context.gl;
    this._context = context;
    this._renderer = new Renderer(this._gl);
    this.camera = new Camera();
    this.input = new Input(canvas);
    this.scene = new Scene();
    this.scene._onAdd = (entity) => this._prepareEntity(entity);
    this.hud = config.hud === false ? null : new HUD();
    this.paused = false;
    this.destroyed = false;
    this._terrains = [];
    this._waters = [];
    this._emitters = [];
    this._callbacks = [];
    this._gpuMeshes = new Set();
    this._meshCache = new Map();
    this._pendingScreenshot = false;
    this._pauseCallbacks = [];
    this._elapsed = 0;

    if (this.hud) {
      this.hud.setQualityLabel(highQuality ? 'High' : 'Low');
      this.hud.setSoundLabel(!this.settings.get('muted'));
      this._wireHud();
    }

    this._loop = new GameLoop(
      (dt, elapsed) => {
        if (!this.paused) {
          this._elapsed += dt;
          this.camera.update(this.input, dt);
          this.scene.update(dt);
          for (const emitter of this._emitters) emitter.update(dt);
          for (const fn of this._callbacks) fn(dt, this._elapsed);
        }
        if (this.hud) this.hud.reportFrame(dt);
        this.audio.updateListener(this.camera);
      },
      () => this._render()
    );

    this._unlockAudio = () => {
      this.audio.resume();
      window.removeEventListener('pointerdown', this._unlockAudio);
      window.removeEventListener('keydown', this._unlockAudio);
    };
    window.addEventListener('pointerdown', this._unlockAudio);
    window.addEventListener('keydown', this._unlockAudio);
    this._escape = (event) => {
      if (event.code === 'Escape') this.paused ? this.resume() : this.pause();
    };
    window.addEventListener('keydown', this._escape);
    if (config.autoStart !== false) this.start();
  }

  _wireHud() {
    this.hud.onPauseToggle(() => this.paused ? this.resume() : this.pause());
    this.hud.onQualityToggle(() => {
      const high = this._qualitySettings.dprCap <= 1;
      this._qualitySettings.dprCap = high ? 2 : 1;
      this.settings.set('quality', high ? 'high' : 'low');
      this.hud.setQualityLabel(high ? 'High' : 'Low');
      this.resize();
    });
    this.hud.onSoundToggle(() => {
      const muted = !this.audio.muted;
      this.audio.setMuted(muted);
      this.settings.set('muted', muted);
      this.hud.setSoundLabel(!muted);
    });
    this.hud.onScreenshot(() => this.screenshot());
    this.hud.onSave(() => {
      this.save.save('quick', this.scene.entities.map((entity) => ({ position: [entity.position.x, entity.position.y, entity.position.z], rotationY: entity.rotationY })));
      this.hud.showStatus('Scene status saved');
    });
    this.hud.onLoad(() => {
      const state = this.save.load('quick');
      if (Array.isArray(state)) state.forEach((item, index) => {
        const entity = this.scene.entities[index];
        if (entity && item && Array.isArray(item.position)) entity.position.set(...item.position);
        if (entity && Number.isFinite(item.rotationY)) entity.rotationY = item.rotationY;
      });
      this.hud.showStatus(state ? 'Scene status loaded' : 'No saved scene status');
    });
  }

  _alive(method) {
    if (this.destroyed) fail(`App.${method}`, 'App', 'not destroyed', this);
  }

  _makeRenderMesh(description) {
    if (this._meshCache.has(description)) return this._meshCache.get(description);
    const data = MESH_DATA.get(description);
    if (!data) fail('App.addEntity', 'options.mesh', 'a mesh returned by Opus.Mesh', description);
    let mesh;
    if (data.kind === 'cube') mesh = createCubeMesh(this._gl);
    else if (data.kind === 'plane') mesh = createPlaneMesh(this._gl);
    else if (data.kind === 'grid') mesh = createGridMesh(this._gl, data.size, data.segments);
    else mesh = createMeshFromArrays(this._gl, data.positions, data.normals, data.indices);
    this._gpuMeshes.add(mesh);
    this._meshCache.set(description, mesh);
    return mesh;
  }

  _prepareEntity(entity) {
    if (!(entity instanceof Entity)) fail('Scene.add', 'entity', 'an Opus.Entity', entity);
    vector(entity.position, 'entity.position', 'Scene.add');
    vector(entity.scale, 'entity.scale', 'Scene.add');
    if (!MESH_DATA.has(entity.mesh)) fail('Scene.add', 'entity.mesh', 'a mesh returned by Opus.Mesh', entity.mesh);
    if (!ENTITY_MESHES.has(entity)) ENTITY_MESHES.set(entity, this._makeRenderMesh(entity.mesh));
  }

  _render() {
    this.resize();
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
    this._renderer.renderScene(this.camera, aspect, this.scene);
    for (const terrain of this._terrains) this._renderer.renderTerrain(this.camera, aspect, terrain);
    for (const water of this._waters) this._renderer.renderWater(this.camera, aspect, water, this._elapsed);
    const particles = [];
    for (const emitter of this._emitters) emitter.appendRenderData(particles);
    this._renderer.renderParticles(this.camera, aspect, particles);
    if (this._pendingScreenshot) {
      this._pendingScreenshot = false;
      captureScreenshot(this.canvas, this._screenshotFilename);
      this._screenshotFilename = undefined;
      if (this.hud) this.hud.showStatus('Screenshot saved');
    }
  }

  /** Creates and adds an Entity. */
  addEntity(options) {
    this._alive('addEntity');
    optionsObject(options, 'options', 'App.addEntity');
    if (!MESH_DATA.has(options.mesh)) fail('App.addEntity', 'options.mesh', 'a mesh returned by Opus.Mesh', options.mesh);
    if (options.position !== undefined) vector(options.position, 'options.position', 'App.addEntity');
    if (options.scale !== undefined) vector(options.scale, 'options.scale', 'App.addEntity');
    if (options.rotationY !== undefined) finite(options.rotationY, 'options.rotationY', 'App.addEntity');
    return this.scene.add(new Entity(options));
  }

  /** Creates and renders a procedural terrain handle. */
  createTerrain(options = {}) {
    this._alive('createTerrain');
    const description = Terrain.generate(options);
    const opts = description.options;
    const position = opts.position ? opts.position.clone() : new Vec3();
    const publicTerrain = {
      options: { ...opts },
      position,
      waterLevel: opts.waterLevel ?? -1.6,
      sampleHeight(x, z) { return Terrain.sampleHeight(x - position.x, z - position.z, opts) + position.y; },
      sampleNormal(x, z) { return Terrain.sampleNormal(x - position.x, z - position.z, opts); },
    };
    const renderTerrain = { _mesh: createTerrainMesh(this._gl, opts), position };
    this._gpuMeshes.add(renderTerrain._mesh);
    this._terrains.push(renderTerrain);
    return publicTerrain;
  }

  /** Creates and renders animated water with instance sampling helpers. */
  createWater(options = {}) {
    this._alive('createWater');
    const description = Water.createSurface(options);
    const opts = description.options;
    const handle = {
      position: opts.position ? opts.position.clone() : new Vec3(),
      deepColor: opts.deepColor ? opts.deepColor.slice() : [0.03, 0.14, 0.22],
      waves: (opts.waves ?? DEFAULT_WAVES).map((wave) => ({ ...wave, dir: wave.dir.slice() })),
      sampleHeight(x, z, time) { return Water.sampleHeight(handle, x, z, time); },
      sampleSurface(x, z, time) { return Water.sampleSurface(handle, x, z, time); },
    };
    const renderWater = { _mesh: createGridMesh(this._gl, opts.size ?? 34, opts.segments ?? 56), position: handle.position, deepColor: handle.deepColor, waves: handle.waves };
    this._gpuMeshes.add(renderWater._mesh);
    this._waters.push(renderWater);
    return handle;
  }

  /** Creates a capped particle emitter managed by the App. */
  createEmitter(options = {}) {
    this._alive('createEmitter');
    optionsObject(options, 'options', 'App.createEmitter');
    if (options.position !== undefined) vector(options.position, 'options.position', 'App.createEmitter');
    if (options.rate !== undefined) positive(options.rate, 'options.rate', 'App.createEmitter', true);
    if (options.spread !== undefined) positive(options.spread, 'options.spread', 'App.createEmitter', true);
    if (options.maxParticles !== undefined) {
      integer(options.maxParticles, 'options.maxParticles', 'App.createEmitter');
      if (options.maxParticles > MAX_PARTICLES) fail('App.createEmitter', 'options.maxParticles', `a whole number from 1 through ${MAX_PARTICLES}`, options.maxParticles);
    }
    const emitter = new ParticleEmitter(options);
    this._emitters.push(emitter);
    return emitter;
  }

  /** Registers a per-frame callback and returns an unsubscribe function. */
  onUpdate(fn) {
    this._alive('onUpdate');
    callback(fn, 'handler', 'App.onUpdate');
    this._callbacks.push(fn);
    return () => {
      const index = this._callbacks.indexOf(fn);
      if (index >= 0) this._callbacks.splice(index, 1);
    };
  }

  /** Registers a pause-state callback and returns an unsubscribe function. */
  onPauseChange(fn) {
    this._alive('onPauseChange');
    callback(fn, 'handler', 'App.onPauseChange');
    this._pauseCallbacks.push(fn);
    return () => {
      const index = this._pauseCallbacks.indexOf(fn);
      if (index >= 0) this._pauseCallbacks.splice(index, 1);
    };
  }

  /** Starts rendering; an optional callback is registered before starting. */
  start(update) {
    this._alive('start');
    if (update !== undefined) this.onUpdate(update);
    this._loop.start();
    return this;
  }

  /** Pauses simulation while rendering and input listeners remain active. */
  pause() {
    this._alive('pause');
    if (this.paused) return;
    this.paused = true;
    if (this.hud) this.hud.setPaused(true);
    this.audio.stopEngineHum();
    for (const fn of this._pauseCallbacks) fn(true);
  }

  /** Resumes simulation. */
  resume() {
    this._alive('resume');
    if (!this.paused) return;
    this.paused = false;
    if (this.hud) this.hud.setPaused(false);
    for (const fn of this._pauseCallbacks) fn(false);
  }

  /** Resizes the drawing buffer to the displayed canvas size. */
  resize() { this._alive('resize'); this._context.resize(); }

  /** Queues a PNG capture immediately after the next rendered frame. */
  screenshot(filename) {
    this._alive('screenshot');
    if (filename !== undefined && typeof filename !== 'string') fail('App.screenshot', 'filename', 'a string', filename);
    this._pendingScreenshot = true;
    this._screenshotFilename = filename;
  }

  /** Stops all owned work and releases listeners, audio, DOM, scene, particles, and GPU resources. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._loop.stop();
    window.removeEventListener('pointerdown', this._unlockAudio);
    window.removeEventListener('keydown', this._unlockAudio);
    window.removeEventListener('keydown', this._escape);
    this.input.destroy();
    this._context.destroy();
    this.audio.destroy();
    if (this.hud) this.hud.destroy();
    for (const emitter of this._emitters) emitter.destroy();
    const gl = this._gl;
    for (const mesh of this._gpuMeshes) (mesh.resources || []).forEach((resource, index) => {
      if (index === 0) gl.deleteVertexArray(resource);
      else gl.deleteBuffer(resource);
    });
    this._renderer.destroy();
    this.scene.clear();
    this.scene._onAdd = null;
    this._terrains.length = this._waters.length = this._emitters.length = this._callbacks.length = this._pauseCallbacks.length = 0;
    this._gpuMeshes.clear();
    this._meshCache.clear();
  }
}

/** Single supported browser namespace. */
const Opus = Object.freeze({
  VERSION: '0.1.0',
  Vec3,
  Mat4,
  Scene,
  Entity,
  Camera,
  Mesh,
  Terrain,
  Water,
  ParticleEmitter,
  Physics,
  AudioEngine,
  Input,
  HUD,
  SettingsManager,
  SaveSystem,
  App,
  /** Creates a zero-configuration WebGL2 App. */
  create(canvas, config = {}) { return new App(canvas, config); },
  /** Immediately downloads a canvas PNG; prefer `app.screenshot()` during a running loop. */
  screenshot(canvas, filename) {
    canvasElement(canvas, 'Opus.screenshot');
    if (filename !== undefined && typeof filename !== 'string') fail('Opus.screenshot', 'filename', 'a string', filename);
    return captureScreenshot(canvas, filename);
  },
});
