class Entity {
  constructor({ mesh, color = [1, 1, 1], position = new Vec3(), rotationY = 0, scale = new Vec3(1, 1, 1), texture = null } = {}) {
    if (!MESH_DATA.has(mesh)) fail('Opus.Entity', 'options.mesh', 'a mesh returned by Opus.Mesh', mesh);
    vector(position, 'options.position', 'Opus.Entity');
    vector(scale, 'options.scale', 'Opus.Entity');
    finite(rotationY, 'options.rotationY', 'Opus.Entity');
    if (!Array.isArray(color) || color.length !== 3 || color.some((n) => typeof n !== 'number' || !Number.isFinite(n))) fail('Opus.Entity', 'options.color', 'a three-number RGB array', color);
    this.mesh = mesh;
    this.color = color;
    this.position = position;
    // Full XYZ orientation (Wave 5): `_quat` is the real, authoritative
    // orientation; `_rotationY` is kept as a RAW stored number (not derived
    // from the quaternion on read) specifically so `entity.rotationY = v;
    // entity.rotationY === v` stays bit-exact -- a trig round-trip through
    // the quaternion (set -> sin/cos -> quaternion -> asin/atan2 -> get)
    // cannot generally reproduce the original double bit-for-bit, and every
    // pre-Wave-5 caller (the Hovercraft demo's own steering math among
    // them) depends on that exact equality holding. Setting `.rotationY`
    // still fully defines orientation (resets pitch/roll to 0), matching
    // its only possible meaning before pitch/roll existed at all.
    this._rotationY = rotationY;
    this._quat = Quat.fromEuler(0, rotationY, 0);
    this.scale = scale;
    this.spin = 0;
    this.visible = true;
    this.destroyed = false;
    // A GPU texture handle from App.createTexture, or null for an
    // untextured entity (the default -- acts as a plain tint via u_baseColor,
    // exactly like every entity before texturing existed). Freely
    // reassignable after construction, same convention as .color/.visible.
    this.texture = texture;
    // Materials 2.0: all freely reassignable after construction, same
    // convention as .color/.texture/.visible -- no separate "material"
    // object, just a few more plain fields on the entity itself, since this
    // engine already treats an entity's paintable properties this way.
    this.alpha = 1; // < 1 routes the entity through the renderer's separate depth-write-off, back-to-front transparent pass
    this.unlit = false; // skips ambient/diffuse/spec/local-lights entirely -- just baseColor * texture, for a UI-like flat look
    this.emissiveColor = [0, 0, 0];
    this.emissiveIntensity = 0; // added on top of the lit (or unlit) result, independent of any light -- self-illumination, not global illumination
    this.uvScale = [1, 1];
    this.uvOffset = [0, 0];
    // Wave 6 (Priority C): set by App.addEntity ONLY when `mesh` is a
    // skinned glTF description (Opus.Mesh.fromSkinnedGLTF) -- null for
    // every other entity, which is exactly what `_drawEntity`'s own
    // `entity.skin && entity._palette` check reads to decide whether to
    // engage the shader's skinning branch at all.
    this.skin = null;
    // Auto-plays clip 0 on loop the moment a skin exists -- the same
    // "just works, no extra author step" precedent particle Emitters
    // already established for their own continuous animation. Set to
    // `null` to freeze at the bind pose, or another valid clip index to
    // switch clips (takes effect the next `update()`, restarting at t=0).
    this.animationClip = 0;
    this.animationTime = 0;
    this.animationSpeed = 1;
    this._palette = null;
    this._lastAnimationClip = undefined;
    // Wave 6B (Priority B): bounded crossfade -- 0 (the default) is an
    // INSTANT cut, bit-identical to every entity's behavior before this
    // priority existed. Set to a positive number of seconds (e.g. 0.15) to
    // blend into the NEXT clip switch over that duration instead of
    // snapping. `_blendFromClip`/`_blendFromTime`/`_blendElapsed` are
    // internal crossfade-in-progress state, reset automatically -- nothing
    // else needs to touch them.
    this.animationBlendTime = 0;
    this._blendFromClip = null;
    this._blendFromTime = 0;
    this._blendElapsed = 0;
  }

  get rotationY() { return this._rotationY; }
  set rotationY(v) {
    finite(v, 'rotationY', 'Entity.rotationY');
    this._rotationY = v;
    this._quat = Quat.fromEuler(0, v, 0);
  }

  // The authoritative full orientation. Reading `.rotationY` after setting
  // `.quaternion` to something with pitch/roll returns a best-effort
  // derived yaw (via Quat.toEuler) -- fine for the one thing legacy Y-only
  // readers (chase-camera yaw-follow) actually need, not a promise that
  // pitch/roll round-trip through the Y-only field.
  get quaternion() { return this._quat; }
  set quaternion(q) {
    if (!(q instanceof Quat)) fail('Entity.quaternion', 'value', 'an Opus.Quat', q);
    this._quat = q;
    this._rotationY = q.toEuler().y;
  }

  get modelMatrix() {
    return Mat4.compose(this.position, this._quat, this.scale);
  }

  // Local-space axes rotated into world space by this entity's own
  // orientation -- the smallest public surface gameplay code needs to stop
  // hand-deriving `(sin(rotationY), 0, cos(rotationY))` itself (exactly
  // what the Hovercraft demo already did) once an object can also pitch/
  // roll. +Z is "forward" (0 rotation faces +Z), matching that existing
  // convention exactly, so a pure-yaw entity's `.forward` equals what the
  // demo's own hand-rolled formula already computed.
  get forward() { return this._quat.rotateVec3(new Vec3(0, 0, 1)); }
  get right() { return this._quat.rotateVec3(new Vec3(1, 0, 0)); }
  get up() { return this._quat.rotateVec3(new Vec3(0, 1, 0)); }

  update(dt) {
    if (this.destroyed) return;
    if (this.spin) this.rotationY += this.spin * dt;
    // Wave 6 (Priority C): CPU-sample the current clip's pose into a fresh
    // bone palette every frame -- computeSkinPalette (21-gltf.js) is cheap
    // by construction (joint count capped at GLTF_MAX_JOINTS), so there's
    // no need for dirty-tracking here. A clip switch restarts at t=0 rather
    // than continuing the old clip's timeline, the least-surprising default
    // for "I just told this entity to play a different animation."
    if (this.skin) {
      if (this.animationClip !== this._lastAnimationClip) {
        // Wave 6B (Priority B): a genuine clip SWITCH (not the very first
        // clip ever assigned, and only when a blend time is configured)
        // starts a crossfade FROM whatever pose was actually showing --
        // including mid-blend, so a rapid state change (Idle->Walk->Run in
        // quick succession) blends from the CURRENT visible pose, not a
        // stale snapshot. First assignment ever (_lastAnimationClip still
        // undefined) and animationBlendTime === 0 both stay an instant cut,
        // bit-identical to every entity's behavior before this priority.
        if (this._lastAnimationClip !== undefined && this.animationBlendTime > 0) {
          this._blendFromClip = this._lastAnimationClip;
          this._blendFromTime = this.animationTime;
          this._blendElapsed = 0;
        } else {
          this._blendFromClip = null;
        }
        this.animationTime = 0;
        this._lastAnimationClip = this.animationClip;
      }
      const clip = this.animationClip != null ? this.skin.clips[this.animationClip] : null;
      if (clip) {
        this.animationTime += dt * this.animationSpeed;
        if (clip.duration > 0) this.animationTime %= clip.duration;
      }
      if (this._blendFromClip !== null) {
        this._blendElapsed += dt;
        const fromClip = this.skin.clips[this._blendFromClip];
        if (fromClip) {
          this._blendFromTime += dt * this.animationSpeed;
          if (fromClip.duration > 0) this._blendFromTime %= fromClip.duration;
        }
        if (this._blendElapsed >= this.animationBlendTime) {
          this._blendFromClip = null; // blend finished -- fall through to a plain single-clip sample below
        } else {
          const blendT = this._blendElapsed / this.animationBlendTime;
          this._palette = computeSkinPaletteBlended(this.skin, this._blendFromClip, this._blendFromTime, this.animationClip, this.animationTime, blendT);
        }
      }
      if (this._blendFromClip === null) {
        this._palette = clip ? computeSkinPalette(this.skin, this.animationClip, this.animationTime) : computeSkinPalette(this.skin, null, 0);
      }
    }
  }

  destroy() { this.destroyed = true; this.visible = false; }
}
