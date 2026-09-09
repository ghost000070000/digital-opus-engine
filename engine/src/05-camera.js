const CAMERA_MODES = ['orbit', 'chase', 'fixed', 'followLookAt'];

class Camera {
  constructor() {
    this.mode = 'orbit'; // 'orbit' | 'chase' | 'fixed' | 'followLookAt'
    this.yaw = 0.6;
    this.pitch = 0.4;
    this.distance = 6;
    this.target = new Vec3(0, 0, 0);
    this.fovY = Math.PI / 4;
    this.near = 0.1;
    this.far = 100;

    // Chase mode state
    this.targetEntity = null;
    this.chaseOptions = {
      distance: 8,
      height: 3,
      pitch: 0.2,
      lerpSpeed: 6.0,
      rotationLerpSpeed: 8.0,
      lookAhead: 0.5,
    };
    this._chaseEye = new Vec3(0, 5, 10);
    this._chaseTarget = new Vec3(0, 0, 0);
    this._chaseYaw = 0;
    this._lastTargetPosition = null;

    // Fixed mode: a static eye/target, e.g. a cinematic shot triggered by a
    // level event. Also the eye source for followLookAt (below) -- a fixed
    // camera position that keeps looking at a moving target, without moving
    // itself the way chase does.
    this.fixedOptions = { eye: new Vec3(0, 5, 10), target: new Vec3(0, 0, 0) };
    // followLookAt mode: eye stays at fixedOptions.eye, target smoothly
    // tracks targetEntity.position using chaseOptions.lerpSpeed (reusing
    // that one smoothing knob rather than adding a second, near-identical
    // "position smoothing" option).
    this._followTarget = null;

    // Wave 9 (Priority C): Camera Shake's transient additive offset -- see
    // the `eye` getter above. `null` means "no shake active" (distinct from
    // Vec3(0,0,0) only for clarity; both are no-ops either way).
    this.shakeOffset = null;
  }

  setMode(mode) {
    if (!CAMERA_MODES.includes(mode)) {
      throw new Error(`Camera.setMode: mode must be one of ${CAMERA_MODES.map((m) => `"${m}"`).join(', ')}, got "${mode}"`);
    }
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === 'chase') this.setTarget(this.targetEntity);
    if (mode === 'followLookAt') this._followTarget = this.targetEntity ? this.targetEntity.position.clone() : this.fixedOptions.target.clone();
  }

  setFixedOptions(opts = {}) {
    optionsObject(opts, 'options', 'Camera.setFixedOptions');
    if (opts.eye !== undefined) vector(opts.eye, 'options.eye', 'Camera.setFixedOptions');
    if (opts.target !== undefined) vector(opts.target, 'options.target', 'Camera.setFixedOptions');
    Object.assign(this.fixedOptions, opts);
  }

  setTarget(entity) {
    if (entity !== null && !(entity instanceof Entity)) fail('Camera.setTarget', 'entity', 'an Opus.Entity or null', entity);
    if (entity && entity.destroyed) fail('Camera.setTarget', 'entity', 'a live Opus.Entity or null', entity);
    this.targetEntity = entity;
    this._lastTargetPosition = entity ? entity.position.clone() : null;
    if (this.mode === 'chase' && entity) {
      const targetPos = entity.position;
      const rotY = entity.rotationY ?? 0;
      this._chaseYaw = rotY;
      this._chaseTarget = targetPos.clone();
      this._chaseEye = new Vec3(
        targetPos.x - Math.sin(rotY) * this.chaseOptions.distance,
        targetPos.y + this.chaseOptions.height + Math.sin(this.chaseOptions.pitch) * this.chaseOptions.distance,
        targetPos.z - Math.cos(rotY) * this.chaseOptions.distance
      );
    }
  }

  setChaseOptions(opts = {}) {
    optionsObject(opts, 'options', 'Camera.setChaseOptions');
    for (const name of ['distance', 'height', 'lerpSpeed', 'rotationLerpSpeed']) {
      if (opts[name] !== undefined) positive(opts[name], `options.${name}`, 'Camera.setChaseOptions');
    }
    for (const name of ['pitch', 'lookAhead']) {
      if (opts[name] !== undefined) finite(opts[name], `options.${name}`, 'Camera.setChaseOptions');
    }
    Object.assign(this.chaseOptions, opts);
  }

  get eye() {
    let base;
    if (this.mode === 'chase') {
      base = this._chaseEye;
    } else if (this.mode === 'fixed' || this.mode === 'followLookAt') {
      base = this.fixedOptions.eye;
    } else {
      const pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
      const x = this.distance * Math.cos(pitch) * Math.sin(this.yaw);
      const y = this.distance * Math.sin(pitch);
      const z = this.distance * Math.cos(pitch) * Math.cos(this.yaw);
      base = this.target.add(new Vec3(x, y, z));
    }
    // Wave 9 (Priority C, Sections 44-45): Camera Shake -- a TEMPORARY
    // additive offset on top of whatever mode/authored settings already
    // computed `base`, never mutating `target`/`_chaseEye`/`fixedOptions`
    // themselves. Zero (every pre-Wave-9 scene, and any frame with no
    // active shake) is a no-op add, so this is byte-identical to the old
    // getter until something actually calls Camera Shake.
    return this.shakeOffset ? base.add(this.shakeOffset) : base;
  }

  // The look-at point for every mode -- orbit/chase already had one each
  // (`this.target` / `this._chaseTarget`); fixed/followLookAt add the other
  // two so viewMatrix/getBasis/screenPointToRay can read one property
  // instead of repeating this same mode check four times each.
  get currentTarget() {
    if (this.mode === 'chase') return this._chaseTarget;
    if (this.mode === 'fixed') return this.fixedOptions.target;
    if (this.mode === 'followLookAt') return this._followTarget || this.fixedOptions.target;
    return this.target;
  }

  update(input, dt) {
    if (this.mode === 'followLookAt') {
      if (this.targetEntity) {
        if (this.targetEntity.destroyed) { this.setTarget(null); return; }
        const posFactor = Math.min(1.0, (this.chaseOptions.lerpSpeed ?? 6.0) * dt);
        this._followTarget = Vec3.lerp(this._followTarget || this.targetEntity.position, this.targetEntity.position, posFactor);
      }
      return;
    }
    if (this.mode === 'fixed') return;
    if (this.mode === 'chase') {
      if (this.targetEntity) {
        if (this.targetEntity.destroyed) { this.setTarget(null); return; }
        const targetPos = this.targetEntity.position;
        const rotY = this.targetEntity.rotationY ?? 0;

        // Smoothly interpolate chase yaw toward target rotation
        let diff = rotY - this._chaseYaw;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const rotFactor = Math.min(1.0, (this.chaseOptions.rotationLerpSpeed ?? 8.0) * dt);
        this._chaseYaw += diff * rotFactor;

        // Desired camera target (with slight forward lookahead)
        const forwardX = Math.sin(this._chaseYaw);
        const forwardZ = Math.cos(this._chaseYaw);
        const velocity = this._lastTargetPosition && dt > 0 ? targetPos.sub(this._lastTargetPosition).scale(1 / dt) : new Vec3();
        this._lastTargetPosition = targetPos.clone();
        const lookAhead = this.chaseOptions.lookAhead ?? 0.5;
        const desiredTarget = new Vec3(
          targetPos.x + velocity.x * lookAhead,
          targetPos.y + 0.5,
          targetPos.z + velocity.z * lookAhead
        );

        // Desired camera position behind and above craft
        const desiredEye = new Vec3(
          targetPos.x - forwardX * this.chaseOptions.distance,
          targetPos.y + this.chaseOptions.height + Math.sin(this.chaseOptions.pitch) * this.chaseOptions.distance,
          targetPos.z - forwardZ * this.chaseOptions.distance
        );

        const posFactor = Math.min(1.0, (this.chaseOptions.lerpSpeed ?? 6.0) * dt);
        this._chaseTarget = Vec3.lerp(this._chaseTarget, desiredTarget, posFactor);
        this._chaseEye = Vec3.lerp(this._chaseEye, desiredEye, posFactor);
        this.target = this._chaseTarget;
      }
      // Allow minor wheel zoom adjustments in chase mode
      if (input) {
        const wheel = input.consumeWheel();
        if (wheel !== 0) {
          this.chaseOptions.distance = Math.max(3, Math.min(25, this.chaseOptions.distance + wheel * 0.01));
        }
      }
      return;
    }

    // Orbit mode
    if (!input) return;
    const drag = input.consumeDrag();
    this.yaw -= drag.dx * 0.005;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + drag.dy * 0.005));

    const rotSpeed = 1.2;
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) this.yaw -= rotSpeed * dt;
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) this.yaw += rotSpeed * dt;
    if (input.isDown('ArrowUp') || input.isDown('KeyW')) this.pitch = Math.min(1.5, this.pitch + rotSpeed * dt);
    if (input.isDown('ArrowDown') || input.isDown('KeyS')) this.pitch = Math.max(-1.5, this.pitch - rotSpeed * dt);

    const wheel = input.consumeWheel();
    this.distance = Math.max(2, Math.min(30, this.distance + wheel * 0.01));
    if (input.isDown('KeyQ')) this.distance = Math.min(30, this.distance + 5 * dt);
    if (input.isDown('KeyE')) this.distance = Math.max(2, this.distance - 5 * dt);
  }

  viewMatrix() {
    return Mat4.lookAt(this.eye, this.currentTarget, new Vec3(0, 1, 0));
  }

  projectionMatrix(aspect) {
    return Mat4.perspective(this.fovY, aspect, this.near, this.far);
  }

  getBasis() {
    const eye = this.eye;
    const target = this.currentTarget;
    const forward = target.sub(eye).normalize();
    const worldUp = new Vec3(0, 1, 0);
    let right = forward.cross(worldUp);
    if (right.length() < 0.001) right = new Vec3(1, 0, 0);
    else right = right.normalize();
    const up = right.cross(forward);
    return { forward, right, up };
  }

  screenPointToRay(ndcX, ndcY, aspect) {
    const { forward, right, up } = this.getBasis();
    const tanHalfFov = Math.tan(this.fovY / 2);
    const direction = forward
      .add(right.scale(ndcX * aspect * tanHalfFov))
      .add(up.scale(ndcY * tanHalfFov))
      .normalize();
    return { origin: this.eye, direction };
  }
}
