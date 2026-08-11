/**
 * Hovercraft Delivery Run. This file intentionally uses only window.Opus and
 * the documented App surface; the release build places it outside the engine IIFE.
 */
(function () {
  'use strict';

  const app = Opus.create(document.getElementById('game'));
  const V = Opus.Vec3;
  const WATER_LEVEL = -1.6;
  const BOUNDARY = 16;
  const DURATION = 90;
  const REQUIRED = 5;
  const terrainOptions = {
    size: 34, segments: 64, seed: 76421, radius: 14.5,
    amplitude: 1.45, islandBase: 0.35, oceanFloor: -2.4,
    waterLevel: WATER_LEVEL,
  };
  const terrain = app.createTerrain(terrainOptions);
  const water = app.createWater({
    size: 42, segments: 64, position: new V(0, WATER_LEVEL, 0),
  });
  const cube = Opus.Mesh.cube();

  // A deterministic mission generator rejects steep, overlapping, and unsafe points.
  function seeded(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function groundAt(x, z) {
    return terrain.sampleHeight(x, z);
  }

  function slopeAt(x, z) {
    return Math.acos(Math.max(-1, Math.min(1, terrain.sampleNormal(x, z).y)));
  }

  function missionLayout(seed) {
    const random = seeded(seed);
    const spawn = new V(0, Math.max(groundAt(0, 0), WATER_LEVEL) + 0.55, 0);
    const points = [];
    let attempts = 0;
    while (points.length < REQUIRED + 1 && attempts++ < 5000) {
      const angle = random() * Math.PI * 2;
      const radius = 4.5 + random() * 9.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.hypot(x, z) > BOUNDARY - 2.2 || slopeAt(x, z) > 0.62) continue;
      if (Math.hypot(x - spawn.x, z - spawn.z) < 3.5) continue;
      if (points.some((point) => Math.hypot(x - point.x, z - point.z) < 3.2)) continue;
      points.push(new V(x, Math.max(groundAt(x, z), WATER_LEVEL) + 0.7, z));
    }
    if (points.length !== REQUIRED + 1) throw new Error('Delivery Run: deterministic mission placement failed.');
    return { spawn, delivery: points[0], crates: points.slice(1) };
  }

  const layout = missionLayout(20260730);

  // The craft is assembled from reusable public primitive geometry.
  const craft = app.addEntity({
    mesh: cube, color: [0.08, 0.42, 0.85], position: layout.spawn.clone(),
    scale: new V(1.25, 0.28, 1.9),
  });
  const parts = [];
  function part(color, scale, offset) {
    const entity = app.addEntity({ mesh: cube, color, position: layout.spawn.clone(), scale });
    parts.push({ entity, offset });
    return entity;
  }
  part([0.35, 0.75, 1], new V(0.72, 0.28, 0.78), new V(0, 0.32, -0.22)); // cockpit
  part([0.08, 0.12, 0.18], new V(0.28, 0.2, 1.65), new V(-0.78, -0.12, 0)); // pad
  part([0.08, 0.12, 0.18], new V(0.28, 0.2, 1.65), new V(0.78, -0.12, 0)); // pad
  part([1, 0.3, 0.08], new V(0.24, 0.24, 0.38), new V(-0.42, 0.12, -1.02)); // thruster
  part([1, 0.3, 0.08], new V(0.24, 0.24, 0.38), new V(0.42, 0.12, -1.02)); // thruster
  part([0.8, 0.9, 1], new V(0.75, 0.08, 0.22), new V(0, 0.02, 1.08)); // stabilizer
  part([0.38, 0.24, 0.12], new V(0.72, 0.08, 0.55), new V(0, 0.34, 0.62)); // cargo deck

  function updateCraftParts() {
    const c = Math.cos(craft.rotationY);
    const s = Math.sin(craft.rotationY);
    for (const item of parts) {
      const offset = item.offset;
      item.entity.position.set(
        craft.position.x + offset.x * c + offset.z * s,
        craft.position.y + offset.y,
        craft.position.z - offset.x * s + offset.z * c
      );
      item.entity.rotationY = craft.rotationY;
    }
  }

  app.camera.setTarget(craft);
  app.camera.setChaseOptions({
    distance: 7.6, height: 3.2, pitch: 0.2,
    lerpSpeed: 6.5, rotationLerpSpeed: 8.5, lookAhead: 1.2,
  });
  app.camera.setMode('chase');

  // Delivery marker is visible for the entire mission.
  const deliveryY = layout.delivery.y - 0.62;
  app.addEntity({
    mesh: cube, color: [0.1, 0.95, 0.35],
    position: new V(layout.delivery.x, deliveryY, layout.delivery.z),
    scale: new V(2.3, 0.08, 2.3),
  });
  app.addEntity({
    mesh: cube, color: [0.2, 1, 0.48],
    position: new V(layout.delivery.x, deliveryY + 3.2, layout.delivery.z),
    scale: new V(0.18, 6.4, 0.18),
  });

  const exhaust = app.createEmitter({
    position: layout.spawn.clone(), rate: 10, life: [0.25, 0.65],
    riseSpeed: [0.1, 0.4], spread: 0.32, size: [0.06, 0.16],
    color: [0.3, 0.65, 1], gravity: -0.1, maxParticles: 90,
  });
  const spray = app.createEmitter({
    position: layout.spawn.clone(), rate: 0, life: [0.35, 0.75],
    riseSpeed: [0.6, 1.3], spread: 0.8, size: [0.08, 0.2],
    color: [0.8, 0.95, 1], gravity: -0.7, maxParticles: 90,
  });
  const foam = app.createEmitter({
    position: layout.spawn.clone(), rate: 0, life: [0.25, 0.5],
    riseSpeed: [0.03, 0.12], spread: 1.15, size: [0.12, 0.24],
    color: [0.94, 1, 1], gravity: 0, maxParticles: 70,
  });
  const pickupFx = app.createEmitter({
    position: layout.spawn.clone(), rate: 0, life: [0.4, 0.85],
    riseSpeed: [0.8, 1.8], spread: 0.7, size: [0.08, 0.2],
    color: [1, 0.76, 0.12], gravity: -0.25, maxParticles: 80,
  });
  const beaconFx = app.createEmitter({
    position: new V(layout.delivery.x, deliveryY, layout.delivery.z),
    rate: 26, life: [1, 2], riseSpeed: [1.2, 2.4], spread: 0.65,
    size: [0.08, 0.2], color: [0.15, 1, 0.42], gravity: 0.05, maxParticles: 90,
  });
  const winFx = app.createEmitter({
    position: new V(layout.delivery.x, deliveryY + 1, layout.delivery.z),
    rate: 0, life: [1, 2.2], riseSpeed: [1.5, 3.8], spread: 2.2,
    size: [0.12, 0.3], color: [0.35, 1, 0.55], gravity: -0.45, maxParticles: 120,
  });

  const crates = layout.crates.map((position, index) => {
    const entity = app.addEntity({
      mesh: cube, color: [1, 0.68, 0.08], position: position.clone(),
      scale: new V(0.62, 0.62, 0.62),
    });
    entity.spin = 0.8 + index * 0.12;
    return { entity, position, collected: false, trigger: null };
  });

  let state = 'title';
  let stateBeforePause = 'playing';
  let remaining = DURATION;
  let countdown = 3;
  let collected = 0;
  let velocity = new V();
  let steering = 0;
  let boostActive = 0;
  let boostCooldown = 0;
  let deliveryInside = false;
  let deliveryHold = 0;
  let controlsHud = null;

  const counterHud = app.hud.addCounter({
    text: 'Crates 0/5',
    style: { top: '52px', left: '14px', font: 'bold 16px system-ui', color: '#fbbf24' },
  });
  const timerHud = app.hud.addTimer({
    text: 'Time 90.0',
    style: { top: '52px', left: '132px', font: 'bold 16px system-ui', color: '#60a5fa' },
  });
  const speedHud = app.hud.addSpeed({
    text: 'Speed 0 km/h',
    style: { top: '52px', left: '244px', font: 'bold 14px system-ui' },
  });
  const objectiveHud = app.hud.addObjective({
    text: 'Collect 5 cargo crates',
    style: { top: '82px', left: '14px', font: 'bold 14px system-ui', color: '#d8e8ff' },
  });
  const boostHud = app.hud.addCounter({
    text: 'BOOST READY',
    style: { right: '18px', bottom: '18px', font: 'bold 14px system-ui', color: '#4ade80' },
  });
  const countdownHud = app.hud.addText({
    text: '', style: { left: '50%', top: '35%', transform: 'translate(-50%,-50%)', font: 'bold 72px system-ui', color: '#fff', textShadow: '0 3px 18px #000' },
  });
  countdownHud.hide();

  function message(text) {
    app.hud.showMessage(text, 1700);
  }

  function collect(crate) {
    if (state !== 'playing' || crate.collected) return;
    crate.collected = true;
    crate.entity.visible = false;
    collected++;
    counterHud.update(`Crates ${collected}/${REQUIRED}`);
    pickupFx.position = crate.position.clone();
    pickupFx.emit(28);
    app.audio.playPickup();
    if (collected === REQUIRED) {
      objectiveHud.update('Deliver cargo: hold inside green beacon');
      app.audio.playDelivery();
      message('ALL CARGO LOADED — REACH THE GREEN BEACON');
    } else {
      objectiveHud.update(`Collect ${REQUIRED - collected} more crate${REQUIRED - collected === 1 ? '' : 's'}`);
      message(`Cargo secured — ${collected}/${REQUIRED}`);
    }
  }

  for (const crate of crates) {
    crate.trigger = new Opus.Physics.TriggerVolume({
      center: crate.position, radius: 1.45,
      onEnter: () => collect(crate),
    });
  }
  const deliveryTrigger = new Opus.Physics.TriggerVolume({
    center: new V(layout.delivery.x, craft.position.y, layout.delivery.z),
    radius: 2.15,
    onEnter: () => {
      deliveryInside = true;
      if (collected < REQUIRED) message(`${REQUIRED - collected} cargo crate${REQUIRED - collected === 1 ? '' : 's'} remaining`);
    },
    onExit: () => {
      deliveryInside = false;
      deliveryHold = 0;
    },
  });

  function resetMission() {
    if (controlsHud) controlsHud.remove();
    app.hud.removePrimitive('modal');
    remaining = DURATION;
    countdown = 3;
    collected = 0;
    velocity = new V();
    steering = 0;
    boostActive = 0;
    boostCooldown = 0;
    deliveryInside = false;
    deliveryHold = 0;
    craft.position = layout.spawn.clone();
    craft.rotationY = 0;
    updateCraftParts();
    for (const crate of crates) {
      crate.collected = false;
      crate.entity.visible = true;
      crate.entity.position = crate.position.clone();
      crate.trigger.inside = false;
    }
    deliveryTrigger.inside = false;
    for (const emitter of [exhaust, spray, foam, pickupFx, winFx]) emitter.clear();
    counterHud.update('Crates 0/5');
    timerHud.update(`Time ${DURATION.toFixed(1)}`);
    speedHud.update('Speed 0 km/h');
    objectiveHud.update('Collect 5 cargo crates');
    boostHud.update('BOOST READY');
    app.camera.setTarget(craft);
    app.camera.setMode('chase');
    app.audio.stopEngineHum();
    app.audio.startEngineHum();
    countdownHud.show();
    countdownHud.update('3');
    state = 'countdown';
    controlsHud = app.hud.showControlsOverlay({ duration: 5 });
  }

  function win() {
    if (state !== 'playing') return;
    state = 'won';
    const completion = DURATION - remaining;
    remaining = Math.max(0, remaining);
    app.audio.stopEngineHum();
    app.audio.playWin();
    winFx.emit(110);
    const previous = app.save.load('delivery-best-time');
    const newBest = !Number.isFinite(previous) || previous <= 0 || completion < previous;
    if (newBest) app.save.save('delivery-best-time', completion);
    const best = newBest ? completion : previous;
    app.hud.showWinModal({
      timeText: `${completion.toFixed(1)}s`,
      bestTimeText: `${best.toFixed(1)}s`,
      isNewBest: newBest,
      onRestart: resetMission,
    });
  }

  function lose() {
    if (state !== 'playing') return;
    state = 'lost';
    remaining = 0;
    timerHud.update('Time 0.0');
    app.audio.stopEngineHum();
    app.audio.playLose();
    app.hud.showLoseModal({
      reasonText: 'TIME EXPIRED',
      cratesText: `${collected}/${REQUIRED}`,
      onRestart: resetMission,
    });
  }

  app.onPauseChange((paused) => {
    if (paused && (state === 'playing' || state === 'countdown')) {
      stateBeforePause = state;
      state = 'paused';
    } else if (!paused && state === 'paused') {
      state = stateBeforePause;
      app.audio.startEngineHum();
    }
  });

  app.hud.showTitleCard({
    title: 'HOVERCRAFT DELIVERY RUN',
    subtitle: 'Collect 5 crates, deliver to the green beacon before 90s. WASD/Arrows drive, Space boosts, Esc pauses. Click to begin and enable audio.',
    buttonText: 'CLICK TO START',
    onStart: resetMission,
  });

  app.onUpdate((dt, elapsed) => {
    if (controlsHud && ['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'Space'].some((code) => app.input.isDown(code))) {
      controlsHud.remove();
      controlsHud = null;
    }
    if (app.input.wasPressed('Tab')) {
      const mode = app.camera.mode === 'chase' ? 'orbit' : 'chase';
      app.camera.setMode(mode);
      message(`Camera: ${mode.toUpperCase()}`);
    }
    if (app.input.wasPressed('KeyR') && state !== 'title' && state !== 'countdown') resetMission();

    if (state === 'countdown') {
      countdown -= dt;
      countdownHud.update(countdown > 0 ? String(Math.ceil(countdown)) : 'GO!');
      if (countdown <= -0.45) {
        countdownHud.hide();
        state = 'playing';
        message('GO — COLLECT THE CARGO!');
      }
    }
    if (state !== 'playing' && state !== 'countdown') return;

    const playing = state === 'playing';
    if (playing) {
      remaining = Math.max(0, remaining - dt);
      timerHud.update(`Time ${remaining.toFixed(1)}`);
      if (remaining <= 0) {
        lose();
        return;
      }
    }

    const input = app.input;
    const throttle = playing
      ? ((input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 0.55 : 0))
      : 0;
    const steerInput = playing
      ? ((input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0) - (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0))
      : 0;

    const tapForward = playing && (input.wasPressed('KeyW') || input.wasPressed('ArrowUp'));
    const tapReverse = playing && (input.wasPressed('KeyS') || input.wasPressed('ArrowDown'));
    const tapLeft = playing && (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft'));
    const tapRight = playing && (input.wasPressed('KeyD') || input.wasPressed('ArrowRight'));
    steering += (steerInput * 1.8 - steering) * Math.min(1, dt * 5);
    if (tapLeft) steering += 0.55;
    if (tapRight) steering -= 0.55;
    const speedRatio = Math.min(1, velocity.length() / 16);
    craft.rotationY += steering * (0.35 + speedRatio * 0.85) * dt;
    if (playing && input.wasPressed('Space') && boostCooldown <= 0) {
      boostActive = 0.8;
      boostCooldown = 4;
      velocity = velocity.add(new V(Math.sin(craft.rotationY), 0, Math.cos(craft.rotationY)).scale(6));
      app.audio.playBoost();
      exhaust.emit(22);
    }
    boostActive = Math.max(0, boostActive - dt);
    boostCooldown = Math.max(0, boostCooldown - dt);
    boostHud.update(boostCooldown <= 0 ? 'BOOST READY' : `BOOST ${boostCooldown.toFixed(1)}s`);
    boostHud.setStyle({ color: boostCooldown <= 0 ? '#4ade80' : '#94a3b8' });

    const forward = new V(Math.sin(craft.rotationY), 0, Math.cos(craft.rotationY));
    const right = new V(Math.cos(craft.rotationY), 0, -Math.sin(craft.rotationY));
    const acceleration = throttle * 13 + (boostActive > 0 ? 9 : 0);
    velocity = velocity.add(forward.scale(acceleration * dt));
    if (tapForward) velocity = velocity.add(forward.scale(1.3));
    if (tapReverse) velocity = velocity.sub(forward.scale(0.8));
    const lateral = velocity.dot(right);
    velocity = velocity.sub(right.scale(lateral * Math.min(1, dt * 2.8)));
    velocity = velocity.scale(Math.exp(-0.55 * dt));
    const cap = boostActive > 0 ? 24 : 16;
    if (velocity.length() > cap) velocity = velocity.scale(cap / velocity.length());
    const previousPosition = craft.position.clone();
    craft.position = craft.position.add(velocity.scale(dt));

    const collision = Opus.Physics.resolveTerrainCollision(craft.position, velocity, 0.55, terrain);
    if (collision.collided) {
      craft.position = collision.correctedPosition;
      velocity = collision.correctedVelocity;
    }
    const boundary = Opus.Physics.applyMapBoundary(craft.position, velocity, 0.55, BOUNDARY);
    craft.position = boundary.correctedPosition;
    velocity = boundary.correctedVelocity;
    if (boundary.warning) app.hud.showWarning('MAP EDGE — TURN INWARD', boundary.intensity);
    else app.hud.clearWarning();

    const terrainHeight = terrain.sampleHeight(craft.position.x, craft.position.z);
    const waterHeight = water.sampleHeight(craft.position.x, craft.position.z, elapsed);
    const shore = Math.max(0, Math.min(1, (terrainHeight - waterHeight + 0.5) / 1));
    const blend = shore * shore * (3 - 2 * shore);
    const surface = waterHeight + (terrainHeight - waterHeight) * blend;
    const hoverTarget = surface + 0.55 + Math.sin(elapsed * 4.2) * 0.035;
    craft.position.y += (hoverTarget - craft.position.y) * Math.min(1, dt * 8);
    updateCraftParts();

    const speed = velocity.length();
    speedHud.update(`Speed ${Math.round(speed * 3.6)} km/h`);
    app.audio.updateEngineHum(speed / cap, 0.08 + Math.abs(throttle) * 0.3);
    const rear = craft.position.sub(forward.scale(1.1));
    exhaust.position = new V(rear.x, rear.y + 0.05, rear.z);
    exhaust.rate = 8 + Math.abs(throttle) * 42 + (boostActive > 0 ? 55 : 0);
    const overWater = terrainHeight < waterHeight + 0.15;
    spray.position = craft.position.clone();
    foam.position = craft.position.clone();
    spray.rate = overWater ? speed * 2.5 : 0;
    foam.rate = overWater && speed > 2 ? 18 : 0;

    for (let index = 0; index < crates.length; index++) {
      const crate = crates[index];
      if (!crate.collected) {
        crate.entity.position.y = crate.position.y + Math.sin(elapsed * 2.5 + index) * 0.16;
        if (playing) crate.trigger.update(craft.position, previousPosition);
      }
    }
    if (playing) {
      deliveryTrigger.center.y = craft.position.y;
      deliveryTrigger.update(craft.position, previousPosition);
    }
    if (playing && deliveryInside && collected === REQUIRED) {
      deliveryHold += dt;
      objectiveHud.update(`Delivering… ${Math.min(100, Math.round(deliveryHold / 1.25 * 100))}%`);
      if (deliveryHold >= 1.25) win();
    }
  });
})();
