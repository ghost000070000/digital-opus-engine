(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OpusSpriteStarters = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FORMAT = 'digital-opus-project';
  const VERSION = 6;
  const LAYERS = Object.freeze([
    Object.freeze({ id: 'sprite-layer-default', name: 'Default', order: -1000 }),
    Object.freeze({ id: 'sprite-layer-background', name: 'Background', order: -100 }),
    Object.freeze({ id: 'sprite-layer-world', name: 'World', order: 0 }),
    Object.freeze({ id: 'sprite-layer-foreground', name: 'Foreground', order: 100 }),
  ]);
  let instanceSequence = 0;

  function svgData(width, height, body) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`)}`;
  }
  function texture(id, name, width, height, body) {
    return { id, name, dataURL: svgData(width, height, body), sourceFilename: `${id}.svg`, width, height };
  }
  function spriteAsset(id, name, sourceTexture, options) {
    const opts = options || {};
    return { id, type: 'sprite', name, version: 4, sourceTexture, sourceRect: opts.sourceRect || null, nineSlice: opts.nineSlice || null, pivot: opts.pivot || [0.5, 0.5], pixelsPerUnit: opts.pixelsPerUnit || 32, filtering: opts.filtering === 'nearest' ? 'nearest' : 'linear' };
  }
  function renderer(spriteAssetRef, options) {
    const opts = options || {};
    return {
      version: 9, spriteAssetRef, renderMode: opts.renderMode || 'simple', animationStates: opts.animationStates || [],
      initialAnimationStateRef: opts.initialAnimationStateRef || null, initialDirection: opts.initialDirection || 'none', playOnStart: !!opts.playOnStart,
      sourceTexture: null, width: opts.width || 2, height: opts.height || 2, pivotX: 0.5, pivotY: 0.5,
      tint: opts.tint || '#ffffff', opacity: opts.opacity == null ? 1 : opts.opacity, visible: true,
      flipX: !!opts.flipX, flipY: !!opts.flipY, sortingLayerRef: opts.sortingLayerRef || 'sprite-layer-world',
      orderInLayer: opts.orderInLayer || 0, parallaxLayerRef: opts.parallaxLayerRef || null,
    };
  }
  function sprite(id, name, assetRef, position, options) {
    const opts = options || {};
    return { kind: 'sprite', id, name, position, scale: [1, 1, 1], rotationY: 0, behaviors: [], components: { 'sprite-renderer': renderer(assetRef, opts) } };
  }
  function camera(id, height) {
    return { kind: 'camera', id, name: '2D Camera', isActiveCamera: true, options: { version: 2, position: [0, 0, 10], mode: 'fixed', projection: 'orthographic', fovDegrees: 45, orthographicHeight: height || 12, near: 0.1, far: 100, rotationDegrees: { x: 0, y: 0, z: 0 }, chase: { distance: 8, height: 3, pitch: 0.2, lerpSpeed: 6, rotationLerpSpeed: 8, lookAhead: 0.5 }, lookAtTargetId: null } };
  }
  function cube(id, name, position, scale, color, options) {
    const opts = options || {};
    return { kind: 'cube', id, name, mesh: opts.mesh || 'cube', color, position, scale, rotationY: 0, behaviors: [], alpha: opts.alpha, isBillboard: opts.isBillboard, billboardMode: opts.billboardMode, spritePassRelation: opts.spritePassRelation };
  }
  function baseProject(title, objects, extra) {
    const opts = extra || {};
    return {
      format: FORMAT, version: VERSION,
      levels: [{ id: 'level1', name: 'Level 1', objects, environment: null, playerSettings: null, ui: null, description: opts.description || '', ambientAudio: null, sequences: [], objectiveDefs: [], scatterLayers: [] }],
      currentLevelIndex: 0, startLevelIndex: 0, levelTransition: { mode: 'instant', duration: 0.4 },
      spriteSortingLayers: LAYERS, parallaxLayers: opts.parallaxLayers || [], prefabs: [], assets: [], textures: opts.textures || [],
      spriteAssets: opts.spriteAssets || [], spriteAnimations: opts.spriteAnimations || [], audio: [],
      meta: { title, description: opts.description || '', author: '', version: '1.0.0', thumbnail: '', instructions: '' },
      inputActionMap: {}, itemDefs: [],
    };
  }
  function sceneStarter() {
    const tex = texture('starter-scene-texture', 'Starter Scene Art', 64, 64, '<rect width="64" height="64" rx="12" fill="#14364a"/><circle cx="32" cy="28" r="17" fill="#53d5c8"/><path d="M10 53h44" stroke="#f3c37a" stroke-width="6"/>');
    const art = spriteAsset('starter-scene-sprite', 'Scene Placeholder', tex.id, { filtering: 'nearest' });
    return baseProject('2D Sprite Scene', [camera('obj1', 12), sprite('obj2', 'World Sprite — replace or remove', art.id, [0, 0, 0], { sortingLayerRef: 'sprite-layer-world', parallaxLayerRef: 'parallax-far', width: 3, height: 3 })], {
      description: 'A minimal orthographic XY Sprite scene. Replace or remove the placeholder art.',
      parallaxLayers: [{ id: 'parallax-far', name: 'Far Background', factorX: 0.2, factorY: 0.2 }], textures: [tex], spriteAssets: [art],
    });
  }
  function animatedStarter() {
    const tex = texture('starter-character-texture', 'Generated Character Sheet', 96, 32, '<rect width="32" height="32" fill="#18324a"/><circle cx="16" cy="11" r="7" fill="#ffd18a"/><rect x="9" y="18" width="14" height="11" rx="4" fill="#4fd1c5"/><rect x="32" width="32" height="32" fill="#18324a"/><circle cx="48" cy="10" r="7" fill="#ffd18a"/><path d="M40 29l5-12h8l4 12" fill="#5de0d3"/><rect x="64" width="32" height="32" fill="#18324a"/><circle cx="78" cy="11" r="7" fill="#ffd18a"/><path d="M69 27h15l8-9-10 4-4-5z" fill="#f3a76f"/>');
    const assets = [
      spriteAsset('starter-character-idle-frame', 'Character Idle Frame', tex.id, { sourceRect: { x: 0, y: 0, width: 32, height: 32 }, filtering: 'nearest' }),
      spriteAsset('starter-character-walk-frame', 'Character Walk Frame', tex.id, { sourceRect: { x: 32, y: 0, width: 32, height: 32 }, filtering: 'nearest' }),
      spriteAsset('starter-character-attack-frame', 'Character Attack Frame', tex.id, { sourceRect: { x: 64, y: 0, width: 32, height: 32 }, filtering: 'nearest' }),
    ];
    const clips = [
      { id: 'starter-clip-idle', type: 'sprite-animation', name: 'Idle', version: 3, playbackMode: 'loop', frames: [{ spriteAsset: assets[0].id, durationMs: 450, events: [] }] },
      { id: 'starter-clip-walk', type: 'sprite-animation', name: 'Walk', version: 3, playbackMode: 'loop', frames: [{ spriteAsset: assets[1].id, durationMs: 110, events: [{ id: 'footstep', name: 'Footstep' }] }, { spriteAsset: assets[0].id, durationMs: 170, events: [] }] },
      { id: 'starter-clip-attack', type: 'sprite-animation', name: 'Attack', version: 3, playbackMode: 'once', frames: [{ spriteAsset: assets[2].id, durationMs: 90, events: [{ id: 'attack-hit', name: 'Attack Hit' }] }, { spriteAsset: assets[0].id, durationMs: 240, events: [] }] },
      { id: 'starter-clip-walk-left', type: 'sprite-animation', name: 'Walk Left Alternate', version: 3, playbackMode: 'loop', frames: [{ spriteAsset: assets[0].id, durationMs: 160, events: [] }, { spriteAsset: assets[1].id, durationMs: 120, events: [] }] },
    ];
    const states = [
      { id: 'idle', name: 'Idle', clipRef: clips[0].id, directionalVariants: [] },
      { id: 'walk', name: 'Walk', clipRef: clips[1].id, directionalVariants: [{ direction: 'left', clipRef: clips[3].id, mirrorX: true, mirrorY: false }, { direction: 'right', clipRef: null, mirrorX: false, mirrorY: false }] },
      { id: 'attack', name: 'Attack', clipRef: clips[2].id, directionalVariants: [{ direction: 'left', clipRef: null, mirrorX: true, mirrorY: false }] },
    ];
    return baseProject('Animated Character', [camera('obj1', 10), sprite('obj2', 'Animated Character — customize me', assets[0].id, [0, 0, 0], { width: 2, height: 2, animationStates: states, initialAnimationStateRef: 'idle', initialDirection: 'right', playOnStart: true })], {
      description: 'A generated local character with Idle, Walk, and Attack states, directional variants, Mirror X, and frame events.', textures: [tex], spriteAssets: assets, spriteAnimations: clips,
    });
  }
  function hybridStarter() {
    const bg = texture('starter-hybrid-bg-texture', 'Hybrid Background', 96, 64, '<defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#102b48"/><stop offset="1" stop-color="#1d706f"/></linearGradient></defs><rect width="96" height="64" fill="url(#g)"/><circle cx="70" cy="18" r="10" fill="#ffd88a"/>');
    const world = texture('starter-hybrid-world-texture', 'Hybrid World', 64, 32, '<rect width="64" height="32" fill="#214f45"/><path d="M0 24L15 8l13 12L42 5l22 20v7H0z" fill="#6ec49a"/>');
    const panel = texture('starter-hybrid-panel-texture', 'Hybrid Panel', 48, 48, '<rect width="48" height="48" rx="8" fill="#15243c" stroke="#edbd72" stroke-width="8"/><path d="M15 24h18" stroke="#6fe0cd" stroke-width="4"/>');
    const assets = [spriteAsset('starter-hybrid-bg', 'Background Smooth', bg.id, { filtering: 'linear' }), spriteAsset('starter-hybrid-world', 'World Pixel', world.id, { filtering: 'nearest' }), spriteAsset('starter-hybrid-panel', 'Nine-Slice Sign', panel.id, { filtering: 'nearest', nineSlice: { left: 10, right: 10, top: 10, bottom: 10 } })];
    return baseProject('Parallax Hybrid Scene', [
      camera('obj1', 14),
      sprite('obj2', 'Far Background — replace or remove', assets[0].id, [0, 1, -2], { width: 18, height: 12, sortingLayerRef: 'sprite-layer-background', parallaxLayerRef: 'parallax-far' }),
      sprite('obj3', 'Mid World — replace or remove', assets[1].id, [0, -1.5, -1], { width: 12, height: 6, sortingLayerRef: 'sprite-layer-world', parallaxLayerRef: 'parallax-mid' }),
      sprite('obj4', 'Nine-Slice World Sign', assets[2].id, [-3, 1.5, 0], { width: 5, height: 2.5, renderMode: 'nine-slice', sortingLayerRef: 'sprite-layer-foreground', orderInLayer: 5 }),
      cube('obj5', 'Opaque 3D Cube', [2.5, 0, 0], [1.4, 1.4, 1.4], [0.95, 0.53, 0.3]),
      cube('obj6', 'Transparent Billboard Behind Sprites', [0.5, 0.7, 1], [2, 2, 1], [0.3, 0.8, 0.95], { mesh: 'billboard', alpha: 0.48, isBillboard: true, billboardMode: 'full', spritePassRelation: 'behind-sprites' }),
    ], { description: 'Orthographic Sprites plus explicit bounded 3D layering. Replace or remove every placeholder.', parallaxLayers: [{ id: 'parallax-far', name: 'Far', factorX: 0.15, factorY: 0.15 }, { id: 'parallax-mid', name: 'Mid', factorX: 0.55, factorY: 0.55 }], textures: [bg, world, panel], spriteAssets: assets });
  }

  function platformerStarter() {
    const heroArt = texture('platformer-hero-art', 'Trail Runner', 32, 32, '<circle cx="16" cy="8" r="6" fill="#ffe0a0"/><rect x="9" y="14" width="14" height="12" rx="4" fill="#55dcc5"/><path d="M10 26v5m12-5v5" stroke="#effaff" stroke-width="5"/>');
    const heroAsset = spriteAsset('platformer-hero', 'Trail Runner', heroArt.id, { filtering: 'nearest' });
    const flatArt = texture('platformer-flat-art', 'Editable platform surface', 32, 32, '<rect width="32" height="32" fill="#ffffff"/>');
    const flatAsset = spriteAsset('platformer-flat', 'Platform and beacon surface', flatArt.id, { filtering: 'nearest' });
    const hero = sprite('obj2', 'Player — tune Run and Jump here', heroAsset.id, [-7, 0, 0], { width: .8, height: 1 });
    hero.components['box-collider-2d'] = { version: 2, enabled: true, offset: [0, 0], size: [.8, 1], collisionLayerRef: 'platformer-runner-layer', collisionMaskMode: 'all', collisionMaskRefs: [] };
    hero.components['body-2d'] = { version: 1, enabled: true, type: 'kinematic', linearVelocity: [0, 0] };
    hero.components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 };
    hero.components['platformer-controller-2d'] = { version: 1, enabled: true, moveSpeed: 5, gravity: 20, jumpSpeed: 8, moveLeftActionRef: 'moveLeft', moveRightActionRef: 'moveRight', jumpActionRef: 'jump' };
    hero.components.checkpoint = { version: 1, enabled: true, autosave: false, respawnPointRef: null, offset: [0, 0, 0], activatorRef: null };
    hero.behaviors = [{ trigger: 'start', action: 'setCheckpoint', params: {} }];
    function platform(id, name, x, y, width, height) {
      const item = sprite(id, name, flatAsset.id, [x, y, 0], { width, height, tint: '#368f88' });
      item.components['box-collider-2d'] = { version: 2, enabled: true, offset: [0, 0], size: [width, height], collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'all', collisionMaskRefs: [] };
      item.components['body-2d'] = { version: 1, enabled: true, type: 'static', linearVelocity: [0, 0] };
      return item;
    }
    function zone(id, name, position, size, action, tint) {
      const item = sprite(id, name, flatAsset.id, position, { width: size[0], height: size[1], tint, opacity: .65 });
      item.components['trigger-collider-2d'] = { version: 2, enabled: true, shape: 'box', offset: [0, 0], size, radius: .5, collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'custom', collisionMaskRefs: ['platformer-runner-layer'] };
      item.behaviors = [{ trigger: 'trigger2DEnter', action, params: {} }];
      if (action === 'respawnAtCheckpoint') item.components['sprite-renderer'].visible = false;
      return item;
    }
    const cam = camera('obj1', 26); cam.options.position = [-.5, 0, 10];
    const result = baseProject('2D Platformer — Sky Steps', [cam, hero,
      platform('obj3', 'Start island', -6, -2, 6, 1),
      platform('obj4', 'First jump', -1.5, -1, 2.5, .5),
      platform('obj5', 'Upper step', 2, .2, 2.5, .5),
      platform('obj6', 'Finish island', 6, 1.4, 4, .5),
      zone('obj7', 'Finish beacon — Win Game', [7, 2.4, 0], [1, 1.5], 'win', '#ffd879'),
      zone('obj8', 'Fall recovery — Respawn at Checkpoint', [0, -7, 0], [80, 2], 'respawnAtCheckpoint', '#334466'),
    ], { textures: [heroArt, flatArt], spriteAssets: [heroAsset, flatAsset], description: 'Run and jump between the named islands. Edit the Player component and platform sizes; all movement uses existing no-code components.' });
    result.levels[0].name = 'Sky Steps';
    result.levels[0].playerSettings = { controllerType: 'platformer2d', platformerObjectRef: hero.id, maxHealth: 100 };
    result.collisionLayers = [{ id: 'collision-layer-default', name: 'Default', order: 0 }, { id: 'platformer-runner-layer', name: 'Platformer Player', order: 1 }];
    result.levels[0].ui = { startScreen: { enabled: false }, winTitle: 'Sky Steps complete!', winMessage: 'You reached the beacon. Restart to try again, or edit the islands and Player tuning.', hudElements: [{ id: 'platformer-guide', kind: 'label', text: 'A/D: run · Space: jump · Gold beacon: finish', visible: true, anchor: 'bottom-center', offsetX: 0, offsetY: -52 }] };
    result.meta.instructions = 'A/D or Left/Right: run. Space: jump. Reach the upper island. Escape: pause/restart. Edit the named Player and platforms.';
    return result;
  }
  function topdownAdventureStarter() {
    const result = platformerStarter(), level = result.levels[0], hero = level.objects.find(x => x.id === 'obj2'), cam = level.objects.find(x => x.kind === 'camera'), surface = 'platformer-flat';
    hero.name = 'Explorer — tune Top-down movement here'; hero.position = [-6, -3, 0];
    result.textures.find(x => x.id === 'platformer-hero-art').name = 'Courtyard Explorer';
    result.spriteAssets.find(x => x.id === 'platformer-hero').name = 'Courtyard Explorer';
    result.collisionLayers.find(x => x.id === 'platformer-runner-layer').name = 'Adventure Player';
    delete hero.components['platformer-controller-2d'];
    hero.components['topdown-controller-2d'] = { version: 1, enabled: true, moveSpeed: 5, moveLeftActionRef: 'moveLeft', moveRightActionRef: 'moveRight', moveUpActionRef: 'moveForward', moveDownActionRef: 'moveBack' };
    Object.assign(hero.components['character-collision-2d'], { wallSlideEnabled: false, slopeHandlingEnabled: false, stepHandlingEnabled: false });
    hero.behaviors.push({ trigger: 'start', action: 'setCounter', params: { counter: 'relics', value: 0 } });
    function wall(id, name, position, size) {
      const item = sprite(id, name, surface, position, { width: size[0], height: size[1], tint: '#547e91' });
      item.components['box-collider-2d'] = { version: 2, enabled: true, offset: [0, 0], size, collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'all', collisionMaskRefs: [] };
      item.components['body-2d'] = { version: 1, enabled: true, type: 'static', linearVelocity: [0, 0] }; return item;
    }
    function zone(id, name, position, tint) {
      const item = sprite(id, name, surface, position, { width: 1, height: 1, tint });
      item.components['trigger-collider-2d'] = { version: 2, enabled: true, shape: 'box', offset: [0, 0], size: [1, 1], radius: .5, collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'custom', collisionMaskRefs: ['platformer-runner-layer'] }; return item;
    }
    const relic = zone('obj8', 'Relic — collect once', [-5, 3, 0], '#ffd879');
    relic.behaviors = [{ trigger: 'trigger2DEnter', action: 'incrementCounter', params: { counter: 'relics' } }, { trigger: 'trigger2DEnter', action: 'destroyObject', params: {} }];
    const exit = zone('obj9', 'Return beacon — requires Relic', [6, 3, 0], '#79dab7');
    exit.behaviors = [{ trigger: 'trigger2DStay', action: 'graph', graph: { graphVersion: 1, nodes: [{ id: 'has-relic', type: 'counterReaches', counter: 'relics', target: 1, x: 340, y: 20 }, { id: 'finish', type: 'win', x: 340, y: 260 }], edges: [{ from: 'start', to: 'finish', kind: 'next' }, { from: 'has-relic', to: 'finish', kind: 'gate' }], variables: [] } }];
    level.objects = [cam, hero, sprite('obj10', 'Courtyard floor — decorative', surface, [0, 0, -1], { width: 16, height: 10, tint: '#1c3946', sortingLayerRef: 'sprite-layer-background' }), wall('obj3', 'West boundary', [-8, 0, 0], [1, 11]), wall('obj4', 'East boundary', [8, 0, 0], [1, 11]), wall('obj5', 'North boundary', [0, 5.5, 0], [16, 1]), wall('obj6', 'South boundary', [0, -5.5, 0], [16, 1]), wall('obj7', 'Central ruin — go around', [0, 0, 0], [3, 6]), relic, exit];
    level.name = 'Relic Courtyard'; level.playerSettings = { controllerType: 'topdown2d', topdownObjectRef: hero.id, maxHealth: 100 };
    level.ui.winTitle = 'Relic returned!'; level.ui.winMessage = 'You explored the courtyard and returned the relic. Edit the Explorer, walls and ordinary goal Graph to make your own adventure.';
    level.ui.hudElements[0].text = 'WASD: move · Gold relic → green beacon · Relics: {relics}';
    result.meta.title = '2D Adventure — Relic Courtyard'; result.meta.description = 'Explore a bounded XY courtyard, collect the relic once and return to the gated beacon. Ordinary no-code components and Graph, no Script.'; result.meta.instructions = level.ui.hudElements[0].text;
    return result;
  }
  function topdownPuzzleStarter() {
    const result = topdownAdventureStarter(), level = result.levels[0], hero = level.objects.find(x => x.id === 'obj2'), amber = level.objects.find(x => x.id === 'obj8'), beacon = level.objects.find(x => x.id === 'obj9');
    hero.behaviors = hero.behaviors.filter(x => x.action !== 'setCounter');
    hero.behaviors.push({ trigger: 'start', action: 'setCounter', params: { counter: 'energy', value: 0 } });
    function padGraph(action, count) {
      const nodes = Array.from({ length: count }, (_, i) => ({ id: 'step-' + i, type: action, counter: 'energy', ...(action === 'decrementCounter' ? { floorAtZero: false } : {}), x: 340 + i * 280, y: 20 }));
      return { graphVersion: 1, nodes, edges: nodes.map((n, i) => ({ from: i ? nodes[i - 1].id : 'start', to: n.id, kind: 'next' })), variables: [] };
    }
    amber.name = 'Amber pad — adds four on entry';
    amber.behaviors = [{ trigger: 'trigger2DEnter', action: 'graph', graph: padGraph('incrementCounter', 4) }];
    const blue = JSON.parse(JSON.stringify(amber)); blue.id = 'obj11'; blue.name = 'Blue pad — subtracts three on entry'; blue.position = [5, -3, 0]; blue.components['sprite-renderer'].tint = '#78b9ff';
    blue.behaviors = [{ trigger: 'trigger2DEnter', action: 'graph', graph: padGraph('decrementCounter', 3) }];
    level.objects.push(blue);
    beacon.name = 'Balance beacon — requires exactly two';
    const condition = beacon.behaviors[0].graph.nodes.find(x => x.id === 'has-relic');
    condition.type = 'counterEquals'; condition.counter = 'energy'; condition.target = 2;
    level.name = 'Counter Balance'; level.ui.winTitle = 'Balance solved!'; level.ui.winMessage = 'Exactly two energy unlocks the beacon. Edit either pad Graph or the beacon threshold to design your own puzzle. Restart resets energy to zero.';
    level.ui.hudElements[0].text = 'WASD · Amber +4 · Blue −3 · Beacon needs 2 · Energy: {energy}';
    result.meta.title = 'Top-down Puzzle — Counter Balance'; result.meta.description = 'Repeatable entry pads add four or subtract three. Plan a route to exactly two energy; ordinary editable Graph Actions, no Script.'; result.meta.instructions = level.ui.hudElements[0].text;
    return result;
  }
  const BUILDERS = { 'sprite-2d-scene': sceneStarter, 'sprite-animated-character': animatedStarter, 'sprite-parallax-hybrid': hybridStarter, 'platformer-sky-steps': platformerStarter, 'topdown-relic-courtyard': topdownAdventureStarter, 'topdown-counter-balance': topdownPuzzleStarter };
  const CATALOG = Object.freeze([
    Object.freeze({ id: 'sprite-2d-scene', name: '2D Sprite Scene', description: 'Minimal orthographic XY scene with Background, World, Foreground, and Far Background parallax.' }),
    Object.freeze({ id: 'sprite-animated-character', name: 'Animated Character', description: 'Generated local art with Idle, Walk, Attack, direction variants, Mirror X, and animation events.' }),
    Object.freeze({ id: 'sprite-parallax-hybrid', name: 'Parallax Hybrid Scene', description: 'Far/Mid parallax, Nine-Slice signage, opaque 3D, and explicit transparent hybrid layering.' }),
  ]);
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function list() { return CATALOG.map((entry) => ({ ...entry })); }
  function instantiate(id) {
    const builder = BUILDERS[id];
    if (!builder) throw new Error(`Unknown Sprite starter: ${id}`);
    instanceSequence += 1;
    return { projectName: `sprite-project-${instanceSequence}`, project: clone(builder()) };
  }
  return Object.freeze({ FORMAT, VERSION, list, instantiate });
}));
