const CAMERA_MODES = ['orbit', 'chase', 'fixed', 'followLookAt'];
const CAMERA_PROJECTIONS = ['perspective', 'orthographic'];
const CAMERA_SCHEMA_VERSION = 2;

class Camera {
  // Pure portable effects; callers retain ownership of their simulation clock.
  static shakePreset(name = 'Custom') {
    const presets={Custom:{intensity:0.3,duration:0.3},SoftHit:{intensity:0.12,duration:0.25},HeavyImpact:{intensity:0.4,duration:0.45},Rumble:{intensity:0.16,duration:1},DirectionalImpulse:{intensity:0.3,duration:0.35}};
    if(!Object.prototype.hasOwnProperty.call(presets,name))throw new TypeError('Camera.shakePreset requires an available preset name.');
    return {preset:name,...presets[name],direction:'right'};
  }
  static sampleShake(policy,elapsed) {
    if(!policy||typeof policy!=='object'||Array.isArray(policy))throw new TypeError('Camera.sampleShake requires an effect policy.');
    if(typeof policy.preset!=='string')throw new TypeError('Camera.sampleShake requires a named preset.');
    Camera.shakePreset(policy.preset);
    if(policy.preset==='Custom')throw new TypeError('Camera.sampleShake samples named deterministic presets; Custom retains the historical caller-owned random shake.');
    for(const key of ['intensity','duration'])if(typeof policy[key]!=='number'||!Number.isFinite(policy[key])||policy[key]<0)throw new TypeError(`Camera.sampleShake ${key} must be finite and nonnegative.`);
    if(typeof elapsed!=='number'||!Number.isFinite(elapsed)||elapsed<0)throw new TypeError('Camera.sampleShake elapsed must be finite and nonnegative.');
    const axes={right:[1,0,0],left:[-1,0,0],up:[0,1,0],down:[0,-1,0],forward:[0,0,1],back:[0,0,-1]};
    if(!Object.prototype.hasOwnProperty.call(axes,policy.direction))throw new TypeError('Camera.sampleShake requires an available world-axis direction.');
    if(!policy.intensity||!policy.duration||elapsed>=policy.duration)return new Vec3();
    const t=elapsed/policy.duration,envelope=policy.intensity*(1-t)*(1-t);
    if(policy.preset==='DirectionalImpulse'){const axis=axes[policy.direction],amount=envelope*Math.sin(Math.PI*3*t);return new Vec3(axis[0]*amount,axis[1]*amount,axis[2]*amount);}
    const cycles=policy.preset==='Rumble'?12:policy.preset==='SoftHit'?3:5;
    return new Vec3(Math.sin(t*Math.PI*2*cycles)*envelope,Math.sin(t*Math.PI*2*(cycles+1.5))*envelope,Math.sin(t*Math.PI*2*(cycles+2.25))*envelope);
  }
  constructor() {
    this.mode = 'orbit'; // 'orbit' | 'chase' | 'fixed' | 'followLookAt'
    this.yaw = 0.6;
    this.pitch = 0.4;
    this.distance = 6;
    this.target = new Vec3(0, 0, 0);
    this.fovY = Math.PI / 4;
    this.projection = 'perspective';
    // Full vertical world-space span, not half-height. This remains stored
    // while Perspective is active so switching modes never destroys either
    // mode's authored framing value.
    this.orthographicHeight = 10;
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
      bearingMode: 'followTarget',
      bearingYaw: 0,
    };
    this._chaseEye = new Vec3(0, 5, 10);
    this._chaseTarget = new Vec3(0, 0, 0);
    this._chaseYaw = 0;
    this._lastTargetPosition = null;
    // Historical projects keep their exact framing until explicitly opted in.
    // The host supplies world geometry through a public read-only distance query;
    // obstruction never modifies authored pose, follow distance or Player state.
    this.obstructionOptions = { enabled: false, radius: 0.25, padding: 0.05 };
    this._obstructionQuery = null;

    // Fixed mode: a static eye/target, e.g. a cinematic shot triggered by a
    // level event. Also the eye source for followLookAt (below) -- a fixed
    // camera position that keeps looking at a moving target, without moving
    // itself the way chase does.
    this.fixedOptions = { eye: new Vec3(0, 5, 10), target: new Vec3(0, 0, 0), up: new Vec3(0, 1, 0) };
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
    if (opts.up !== undefined) vector(opts.up, 'options.up', 'Camera.setFixedOptions');
    Object.assign(this.fixedOptions, opts);
  }

  setProjection(projection) {
    if (!CAMERA_PROJECTIONS.includes(projection)) {
      throw new Error(`Camera.setProjection: projection must be one of ${CAMERA_PROJECTIONS.map((value) => `"${value}"`).join(', ')}, got "${projection}"`);
    }
    this.projection = projection;
  }

  setOrthographicHeight(height) {
    positive(height, 'height', 'Camera.setOrthographicHeight');
    this.orthographicHeight = height;
  }

  setTarget(entity) {
    if (entity !== null && !(entity instanceof Entity)) fail('Camera.setTarget', 'entity', 'an Opus.Entity or null', entity);
    if (entity && entity.destroyed) fail('Camera.setTarget', 'entity', 'a live Opus.Entity or null', entity);
    this.targetEntity = entity;
    this._lastTargetPosition = entity ? entity.position.clone() : null;
    if (this.mode === 'chase' && entity) {
      const targetPos = entity.position;
      const fixedBearing = this.chaseOptions.bearingMode === 'fixed';
      const rotY = fixedBearing
        ? Math.atan2(Math.sin(this.chaseOptions.bearingYaw), Math.cos(this.chaseOptions.bearingYaw))
        : entity.rotationY ?? 0;
      this._chaseYaw = rotY;
      // Fixed-bearing map presets start with the same target lift used by updates.
      // Historical follow-target acquisition retains its original framing.
      this._chaseTarget = fixedBearing ? targetPos.add(new Vec3(0, 0.5, 0)) : targetPos.clone();
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
    if (opts.bearingMode !== undefined && !['followTarget', 'fixed'].includes(opts.bearingMode)) {
      fail('Camera.setChaseOptions', 'options.bearingMode', '"followTarget" or "fixed"', opts.bearingMode);
    }
    if (opts.bearingYaw !== undefined) finite(opts.bearingYaw, 'options.bearingYaw', 'Camera.setChaseOptions');
    Object.assign(this.chaseOptions, opts);
  }

  setObstructionOptions(opts = {}) {
    const method = 'Camera.setObstructionOptions';
    optionsObject(opts, 'options', method);
    if (opts.enabled !== undefined && typeof opts.enabled !== 'boolean') fail(method, 'options.enabled', 'a boolean', opts.enabled);
    if (opts.radius !== undefined) positive(opts.radius, 'options.radius', method);
    if (opts.padding !== undefined) positive(opts.padding, 'options.padding', method, true);
    Object.assign(this.obstructionOptions, opts);
  }

  // query(origin: Vec3, desiredEye: Vec3, radius: number) -> nearest blocking
  // distance or null. Hosts can use Physics.cameraObstructionDistance with the
  // SAME authored geometry their gameplay uses. null releases the query.
  setObstructionQuery(query) {
    if (query !== null && typeof query !== 'function') fail('Camera.setObstructionQuery', 'query', 'a function or null', query);
    this._obstructionQuery = query;
  }

  get _baseEye() {
    if (this.mode === 'chase') {
      return this._chaseEye;
    } else if (this.mode === 'fixed' || this.mode === 'followLookAt') {
      return this.fixedOptions.eye;
    } else {
      const pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
      const x = this.distance * Math.cos(pitch) * Math.sin(this.yaw);
      const y = this.distance * Math.sin(pitch);
      const z = this.distance * Math.cos(pitch) * Math.cos(this.yaw);
      return this.target.add(new Vec3(x, y, z));
    }
  }

  get eye() {
    const base = this._baseEye;
    // Wave 9 (Priority C, Sections 44-45): Camera Shake -- a TEMPORARY
    // additive offset on top of whatever mode/authored settings already
    // computed `base`, never mutating `target`/`_chaseEye`/`fixedOptions`
    // themselves. Zero (every pre-Wave-9 scene, and any frame with no
    // active shake) is a no-op add, so this is byte-identical to the old
    // getter until something actually calls Camera Shake.
    const desired = this.shakeOffset ? base.add(this.shakeOffset) : base;
    if (this.mode !== 'chase' || !this.obstructionOptions.enabled || !this._obstructionQuery) return desired;
    const origin = this.currentTarget, delta = desired.sub(origin), length = delta.length();
    if (length < 1e-6) return desired;
    // Resolve at observation/render time: App updates Camera before controllers
    // and moving scenery. Caching the earlier ray could expose a stale unsafe eye.
    const hit = this._obstructionQuery(origin.clone(), desired.clone(), this.obstructionOptions.radius);
    if (hit === null) return desired;
    positive(hit, 'query result', 'Camera.obstructionQuery', true);
    if (hit > length) return desired;
    const distance = Math.max(1e-4, Math.min(length, hit - this.obstructionOptions.padding));
    return origin.add(delta.scale(distance / length));
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

  get currentUp() {
    if (this.mode === 'fixed' || this.mode === 'followLookAt') return this.fixedOptions.up || new Vec3(0, 1, 0);
    return new Vec3(0, 1, 0);
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
        const fixedBearing = this.chaseOptions.bearingMode === 'fixed';
        const rotY = fixedBearing
          ? Math.atan2(Math.sin(this.chaseOptions.bearingYaw), Math.cos(this.chaseOptions.bearingYaw))
          : this.targetEntity.rotationY ?? 0;
        // Normalize only the opt-in policy's transient angle. Finite authored yaw
        // is retained, and large angles cannot create unbounded wrap loops.
        if (fixedBearing) this._chaseYaw = Math.atan2(Math.sin(this._chaseYaw), Math.cos(this._chaseYaw));

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
    return Mat4.lookAt(this.eye, this.currentTarget, this.currentUp);
  }

  projectionMatrix(aspect) {
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    if (this.projection === 'orthographic') {
      const height = Number.isFinite(this.orthographicHeight) && this.orthographicHeight > 0 ? this.orthographicHeight : 10;
      const halfHeight = height / 2;
      const halfWidth = halfHeight * safeAspect;
      return Mat4.orthographic(-halfWidth, halfWidth, -halfHeight, halfHeight, this.near, this.far);
    }
    return Mat4.perspective(this.fovY, safeAspect, this.near, this.far);
  }

  orthographicBounds(aspect) {
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const height = Number.isFinite(this.orthographicHeight) && this.orthographicHeight > 0 ? this.orthographicHeight : 10;
    const width = height * safeAspect;
    return { left: -width / 2, right: width / 2, bottom: -height / 2, top: height / 2, width, height, aspect: safeAspect };
  }

  // Transient motion journal, not authored project data. Restore the rendered
  // smoothing pose without setMode/setTarget reacquiring a moving entity.
  captureMotionState() {
    return {version:1,mode:this.mode,target:this.target.clone(),targetEntity:this.targetEntity,
      chaseEye:this._chaseEye.clone(),chaseTarget:this._chaseTarget.clone(),chaseYaw:this._chaseYaw,
      lastTargetPosition:this._lastTargetPosition?this._lastTargetPosition.clone():null,
      followTarget:this._followTarget?this._followTarget.clone():null,shakeOffset:this.shakeOffset?this.shakeOffset.clone():null};
  }

  restoreMotionState(state) {
    const method='Camera.restoreMotionState';
    optionsObject(state,'state',method);
    if(state.version!==1)fail(method,'state.version','version 1',state.version);
    if(!CAMERA_MODES.includes(state.mode))fail(method,'state.mode','a supported Camera mode',state.mode);
    for(const name of ['target','chaseEye','chaseTarget'])vector(state[name],`state.${name}`,method);
    for(const name of ['lastTargetPosition','followTarget','shakeOffset'])if(state[name]!==null)vector(state[name],`state.${name}`,method);
    finite(state.chaseYaw,'state.chaseYaw',method);
    if(state.targetEntity!==null&&!(state.targetEntity instanceof Entity))fail(method,'state.targetEntity','an Opus.Entity or null',state.targetEntity);
    // Clone before committing anything. Entity identity is intentional; unlike
    // fresh setTarget acquisition, an entity destroyed since capture is allowed
    // and the existing next-update destroyed-target path releases it safely.
    const copies={};
    for(const name of ['target','chaseEye','chaseTarget','lastTargetPosition','followTarget','shakeOffset'])copies[name]=state[name]===null?null:state[name].clone();
    this.mode=state.mode;this.target=copies.target;this.targetEntity=state.targetEntity;
    this._chaseEye=copies.chaseEye;this._chaseTarget=copies.chaseTarget;this._chaseYaw=state.chaseYaw;
    this._lastTargetPosition=copies.lastTargetPosition;this._followTarget=copies.followTarget;this.shakeOffset=copies.shakeOffset;
  }

  // Pure framing query. Hosts own target membership and applying the returned
  // fixed pose; Camera owns projection geometry, not a second follow loop.
  computeFraming(worldCorners, opts = {}) {
    const method = 'Camera.computeFraming';
    optionsObject(opts, 'options', method);
    if (!Array.isArray(worldCorners) || worldCorners.length > 4096) fail(method, 'worldCorners', 'an array of at most 4096 Vec3 corners', worldCorners);
    for (let i = 0; i < worldCorners.length; i++) vector(worldCorners[i], `worldCorners[${i}]`, method);
    positive(opts.aspect, 'options.aspect', method);
    const padding = opts.padding === undefined ? 0.1 : opts.padding;
    finite(padding, 'options.padding', method);
    if (padding < 0 || padding >= 0.5) fail(method, 'options.padding', 'a number from zero to less than 0.5', padding);
    if (!worldCorners.length) return { ok:false, reason:'empty-targets' };
    if (!Number.isFinite(this.near) || this.near <= 0 || !Number.isFinite(this.far) || this.far <= this.near || !CAMERA_PROJECTIONS.includes(this.projection)) return { ok:false, reason:'camera-frustum-invalid' };
    let basis;
    try { basis = this._basisFromEye(this._baseEye); } catch (error) { return { ok:false, reason:'camera-basis-invalid' }; }
    const valid = v => v instanceof Vec3 && [v.x,v.y,v.z].every(Number.isFinite) && Math.abs(v.length()-1)<1e-5;
    if (!valid(basis.forward) || !valid(basis.right) || !valid(basis.up) || Math.abs(basis.forward.dot(basis.up))>1e-5 || Math.abs(basis.forward.dot(basis.right))>1e-5 || Math.abs(basis.up.dot(basis.right))>1e-5) return { ok:false, reason:'camera-basis-invalid' };
    const axes = [basis.right,basis.up,basis.forward], min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
    for (const corner of worldCorners) for(let axis=0;axis<3;axis++){const value=corner.dot(axes[axis]);if(!Number.isFinite(value))return{ok:false,reason:'geometry-overflow'};min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);}
    const middle=min.map((value,axis)=>value/2+max[axis]/2);
    const target=axes[0].scale(middle[0]).add(axes[1].scale(middle[1])).add(axes[2].scale(middle[2]));
    const clearance=Math.max(1e-6,this.near*1e-6),usable=1-2*padding,minDepth=min[2]-middle[2],maxDepth=max[2]-middle[2];
    let distance=Math.max(1e-4,this.near-minDepth+clearance),height=this.orthographicHeight;
    const maximumDistance=this.far-maxDepth-clearance;
    if(this.projection==='perspective'){
      const tan=Math.tan(this.fovY/2);
      if(!Number.isFinite(this.fovY)||this.fovY<=0||this.fovY>=Math.PI||!Number.isFinite(tan)||tan<=0)return{ok:false,reason:'camera-frustum-invalid'};
      for(const corner of worldCorners){const relative=corner.sub(target),depth=relative.dot(basis.forward);distance=Math.max(distance,Math.abs(relative.dot(basis.right))/(tan*opts.aspect*usable)-depth,Math.abs(relative.dot(basis.up))/(tan*usable)-depth);}
    }else{
      height=Math.max(1e-4,(max[1]-min[1])/usable,(max[0]-min[0])/(opts.aspect*usable));
      const existingDistance=this._baseEye.sub(target).dot(basis.forward)*-1;
      if(Number.isFinite(existingDistance))distance=Math.max(distance,Math.min(existingDistance,maximumDistance));
    }
    if(!Number.isFinite(distance)||!Number.isFinite(height)||!Number.isFinite(target.x)||!Number.isFinite(target.y)||!Number.isFinite(target.z))return{ok:false,reason:'geometry-overflow'};
    if(distance>maximumDistance)return{ok:false,reason:'frustum-depth-infeasible'};
    const eye=target.sub(basis.forward.scale(distance));
    if(![eye.x,eye.y,eye.z].every(Number.isFinite))return{ok:false,reason:'geometry-overflow'};
    return{ok:true,eye,target,up:basis.up.clone(),orthographicHeight:height,projection:this.projection,near:this.near,far:this.far};
  }

  getBasis() {
    return this._basisFromEye(this.eye);
  }

  _basisFromEye(eye) {
    const target = this.currentTarget;
    const forward = target.sub(eye).normalize();
    const preferredUp = this.currentUp;
    let right = forward.cross(preferredUp);
    if (right.length() < 0.001) right = new Vec3(1, 0, 0);
    else right = right.normalize();
    const up = right.cross(forward);
    return { forward, right, up };
  }

  screenPointToRay(ndcX, ndcY, aspect) {
    const { forward, right, up } = this.getBasis();
    if (this.projection === 'orthographic') {
      const bounds = this.orthographicBounds(aspect);
      const origin = this.eye.add(right.scale(ndcX * bounds.width / 2)).add(up.scale(ndcY * bounds.height / 2));
      return { origin, direction: forward };
    }
    const tanHalfFov = Math.tan(this.fovY / 2);
    const direction = forward
      .add(right.scale(ndcX * aspect * tanHalfFov))
      .add(up.scale(ndcY * tanHalfFov))
      .normalize();
    return { origin: this.eye, direction };
  }
}
