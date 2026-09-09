const MAX_PARTICLES = 500;

class Renderer {
  constructor(gl) {
    this.gl = gl;
    this.program = createProgram(gl, LIT_VERT_SRC, LIT_FRAG_SRC);
    this.skyProgram = createProgram(gl, SKY_VERT_SRC, SKY_FRAG_SRC);
    this.skyQuad = createFullscreenQuad(gl);
    this.particleProgram = createProgram(gl, PARTICLE_VERT_SRC, PARTICLE_FRAG_SRC);
    this.particleGeom = createParticleGeometry(gl, MAX_PARTICLES);
    this._particlePosSize = new Float32Array(MAX_PARTICLES * 4);
    this._particleColorAlpha = new Float32Array(MAX_PARTICLES * 4);
    this.waterProgram = createProgram(gl, WATER_VERT_SRC, WATER_FRAG_SRC);
    this.terrainProgram = createProgram(gl, TERRAIN_VERT_SRC, TERRAIN_FRAG_SRC);
    this.shadowProgram = createProgram(gl, SHADOW_VERT_SRC, SHADOW_FRAG_SRC);
    this.uShadowModel = gl.getUniformLocation(this.shadowProgram, 'u_model');
    this.uShadowLightViewProj = gl.getUniformLocation(this.shadowProgram, 'u_lightViewProj');
    this._shadowFbo = null;
    this._shadowTexture = null;
    this._shadowSize = 0;
    this._createShadowTarget(gl, 1024);

    this.uModel = gl.getUniformLocation(this.program, 'u_model');
    this.uView = gl.getUniformLocation(this.program, 'u_view');
    this.uProjection = gl.getUniformLocation(this.program, 'u_projection');
    this.uLightDir = gl.getUniformLocation(this.program, 'u_lightDir');
    this.uBaseColor = gl.getUniformLocation(this.program, 'u_baseColor');
    this.uEyePos = gl.getUniformLocation(this.program, 'u_eyePos');
    this.uSkyColor = gl.getUniformLocation(this.program, 'u_skyColor');
    this.uGroundColor = gl.getUniformLocation(this.program, 'u_groundColor');
    this.uFogColor = gl.getUniformLocation(this.program, 'u_fogColor');
    this.uFogDensity = gl.getUniformLocation(this.program, 'u_fogDensity');
    this.uTexture = gl.getUniformLocation(this.program, 'u_texture');
    this.uUseTexture = gl.getUniformLocation(this.program, 'u_useTexture');
    this.uUnlit = gl.getUniformLocation(this.program, 'u_unlit');
    this.uAlpha = gl.getUniformLocation(this.program, 'u_alpha');
    this.uEmissiveColor = gl.getUniformLocation(this.program, 'u_emissiveColor');
    this.uEmissiveIntensity = gl.getUniformLocation(this.program, 'u_emissiveIntensity');
    this.uUvScale = gl.getUniformLocation(this.program, 'u_uvScale');
    this.uUvOffset = gl.getUniformLocation(this.program, 'u_uvOffset');
    this.uNumLights = gl.getUniformLocation(this.program, 'u_numLights');
    this.uLightPos = gl.getUniformLocation(this.program, 'u_lightPos');
    this.uLightColor = gl.getUniformLocation(this.program, 'u_lightColor');
    this.uLightIntensity = gl.getUniformLocation(this.program, 'u_lightIntensity');
    this.uLightRange = gl.getUniformLocation(this.program, 'u_lightRange');
    this.uLightIsSpot = gl.getUniformLocation(this.program, 'u_lightIsSpot');
    this.uLightSpotDir = gl.getUniformLocation(this.program, 'u_lightSpotDir');
    this.uLightSpotCos = gl.getUniformLocation(this.program, 'u_lightSpotCos');
    this.uLightViewProj = gl.getUniformLocation(this.program, 'u_lightViewProj');
    this.uShadowMap = gl.getUniformLocation(this.program, 'u_shadowMap');
    this.uShadowsEnabled = gl.getUniformLocation(this.program, 'u_shadowsEnabled');
    this.uShadowBias = gl.getUniformLocation(this.program, 'u_shadowBias');
    // Wave 6 (Priority C): a single location at index 0 of the array is
    // enough -- uniformMatrix4fv uploads consecutive array elements
    // starting there, the standard WebGL pattern for a whole uniform array.
    this.uJointMatrices = gl.getUniformLocation(this.program, 'u_jointMatrices[0]');
    this.uUseSkinning = gl.getUniformLocation(this.program, 'u_useSkinning');

    this.uSkyCamForward = gl.getUniformLocation(this.skyProgram, 'u_camForward');
    this.uSkyCamRight = gl.getUniformLocation(this.skyProgram, 'u_camRight');
    this.uSkyCamUp = gl.getUniformLocation(this.skyProgram, 'u_camUp');
    this.uSkyTanHalfFov = gl.getUniformLocation(this.skyProgram, 'u_tanHalfFov');
    this.uSkyAspect = gl.getUniformLocation(this.skyProgram, 'u_aspect');
    this.uSkyTop = gl.getUniformLocation(this.skyProgram, 'u_skyTop');
    this.uSkyHorizon = gl.getUniformLocation(this.skyProgram, 'u_skyHorizon');
    this.uSkyLightDir = gl.getUniformLocation(this.skyProgram, 'u_lightDir');
    this.uSunColor = gl.getUniformLocation(this.skyProgram, 'u_sunColor');
    this.uSkyTexture = gl.getUniformLocation(this.skyProgram, 'u_skyTexture');
    this.uUseSkyTexture = gl.getUniformLocation(this.skyProgram, 'u_useSkyTexture');

    this.uPView = gl.getUniformLocation(this.particleProgram, 'u_view');
    this.uPProjection = gl.getUniformLocation(this.particleProgram, 'u_projection');
    this.uPCamRight = gl.getUniformLocation(this.particleProgram, 'u_camRight');
    this.uPCamUp = gl.getUniformLocation(this.particleProgram, 'u_camUp');

    this.uWModel = gl.getUniformLocation(this.waterProgram, 'u_model');
    this.uWView = gl.getUniformLocation(this.waterProgram, 'u_view');
    this.uWProjection = gl.getUniformLocation(this.waterProgram, 'u_projection');
    this.uWEyePos = gl.getUniformLocation(this.waterProgram, 'u_eyePos');
    this.uWLightDir = gl.getUniformLocation(this.waterProgram, 'u_lightDir');
    this.uWDeepColor = gl.getUniformLocation(this.waterProgram, 'u_deepColor');
    this.uWReflectionColor = gl.getUniformLocation(this.waterProgram, 'u_reflectionColor');
    this.uWFoamColor = gl.getUniformLocation(this.waterProgram, 'u_foamColor');
    this.uWFogColor = gl.getUniformLocation(this.waterProgram, 'u_fogColor');
    this.uWFogDensity = gl.getUniformLocation(this.waterProgram, 'u_fogDensity');
    this.uWTime = gl.getUniformLocation(this.waterProgram, 'u_time');
    this.uWWaveA = gl.getUniformLocation(this.waterProgram, 'u_waveA');
    this.uWWaveB = gl.getUniformLocation(this.waterProgram, 'u_waveB');
    this.uWWaveC = gl.getUniformLocation(this.waterProgram, 'u_waveC');
    this.uWWaveAmp = gl.getUniformLocation(this.waterProgram, 'u_waveAmp');

    this.uTModel = gl.getUniformLocation(this.terrainProgram, 'u_model');
    this.uTView = gl.getUniformLocation(this.terrainProgram, 'u_view');
    this.uTProjection = gl.getUniformLocation(this.terrainProgram, 'u_projection');
    this.uTLightDir = gl.getUniformLocation(this.terrainProgram, 'u_lightDir');
    this.uTEyePos = gl.getUniformLocation(this.terrainProgram, 'u_eyePos');
    this.uTSkyColor = gl.getUniformLocation(this.terrainProgram, 'u_skyColor');
    this.uTGroundColor = gl.getUniformLocation(this.terrainProgram, 'u_groundColor');
    this.uTFogColor = gl.getUniformLocation(this.terrainProgram, 'u_fogColor');
    this.uTFogDensity = gl.getUniformLocation(this.terrainProgram, 'u_fogDensity');
    this.uTNumLights = gl.getUniformLocation(this.terrainProgram, 'u_numLights');
    this.uTLightPos = gl.getUniformLocation(this.terrainProgram, 'u_lightPos');
    this.uTLightColor = gl.getUniformLocation(this.terrainProgram, 'u_lightColor');
    this.uTLightIntensity = gl.getUniformLocation(this.terrainProgram, 'u_lightIntensity');
    this.uTLightRange = gl.getUniformLocation(this.terrainProgram, 'u_lightRange');
    this.uTLightIsSpot = gl.getUniformLocation(this.terrainProgram, 'u_lightIsSpot');
    this.uTLightSpotDir = gl.getUniformLocation(this.terrainProgram, 'u_lightSpotDir');
    this.uTLightSpotCos = gl.getUniformLocation(this.terrainProgram, 'u_lightSpotCos');
    this.uTLightViewProj = gl.getUniformLocation(this.terrainProgram, 'u_lightViewProj');
    this.uTShadowMap = gl.getUniformLocation(this.terrainProgram, 'u_shadowMap');
    this.uTShadowsEnabled = gl.getUniformLocation(this.terrainProgram, 'u_shadowsEnabled');
    this.uTShadowBias = gl.getUniformLocation(this.terrainProgram, 'u_shadowBias');
    // Wave 6B (Priority D): up to 3 optional textured paint layers -- see
    // TERRAIN_FRAG_SRC's own comment for the blend reasoning.
    this.uTTex = [
      gl.getUniformLocation(this.terrainProgram, 'u_terrainTex0'),
      gl.getUniformLocation(this.terrainProgram, 'u_terrainTex1'),
      gl.getUniformLocation(this.terrainProgram, 'u_terrainTex2'),
    ];
    this.uTHasTex = [
      gl.getUniformLocation(this.terrainProgram, 'u_terrainHasTex0'),
      gl.getUniformLocation(this.terrainProgram, 'u_terrainHasTex1'),
      gl.getUniformLocation(this.terrainProgram, 'u_terrainHasTex2'),
    ];
    this.uTUVScale = [
      gl.getUniformLocation(this.terrainProgram, 'u_terrainUVScale0'),
      gl.getUniformLocation(this.terrainProgram, 'u_terrainUVScale1'),
      gl.getUniformLocation(this.terrainProgram, 'u_terrainUVScale2'),
    ];
    this.MAX_LIGHTS = 8;

    this.skyTop = [0.06, 0.10, 0.24];
    this.skyHorizon = [0.62, 0.68, 0.80];
    this.groundColor = [0.16, 0.16, 0.14];
    this.sunColor = [1.0, 0.92, 0.75];
    this.fogDensity = 0.035;

    gl.enable(gl.DEPTH_TEST);
  }

  // Bounded Directional Shadows (Wave 5, Priority H): a single small
  // depth-only render target, no color attachment at all -- `drawBuffers`/
  // `readBuffer` explicitly set to NONE so the framebuffer is complete with
  // only a DEPTH_ATTACHMENT (WebGL2 permits this; a color attachment would
  // just be unused GPU memory). Recreated only when the resolution actually
  // changes (App.configureShadows -> setShadowResolution), never per frame.
  _createShadowTarget(gl, size) {
    if (this._shadowTexture) gl.deleteTexture(this._shadowTexture);
    if (this._shadowFbo) gl.deleteFramebuffer(this._shadowFbo);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._shadowTexture = tex;
    this._shadowFbo = fbo;
    this._shadowSize = size;
  }

  setShadowResolution(size) {
    if (size === this._shadowSize) return;
    this._createShadowTarget(this.gl, size);
  }

  // Renders every passed-in caster's depth into the shadow map from the
  // light's own view-projection -- callers (App._render) are responsible
  // for the "bounded" part: filtering `casters` down to entities within
  // App.configureShadows's distance before calling this, so an unbounded
  // scene never pays for shadow-casting geometry far outside the box.
  renderShadowPass(lightViewProj, casters) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadowFbo);
    gl.viewport(0, 0, this._shadowSize, this._shadowSize);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.shadowProgram);
    gl.uniformMatrix4fv(this.uShadowLightViewProj, false, lightViewProj.m);
    for (const entity of casters) {
      const mesh = getEntityRenderMesh(entity);
      if (!mesh) continue;
      gl.uniformMatrix4fv(this.uShadowModel, false, entity.modelMatrix.m);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Binds the shadow map + uploads its uniforms to whichever program is
  // currently bound -- shared by renderScene and renderTerrain the same
  // way _uploadLights already is, so both read the identical shadow state.
  _uploadShadowState(shadowInfo, u) {
    const gl = this.gl;
    const enabled = !!(shadowInfo && shadowInfo.enabled);
    gl.uniform1i(u.enabled, enabled ? 1 : 0);
    if (!enabled) return;
    gl.uniformMatrix4fv(u.lightViewProj, false, shadowInfo.lightViewProj.m);
    gl.uniform1f(u.bias, shadowInfo.bias);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._shadowTexture);
    gl.uniform1i(u.shadowMap, 1);
  }

  // Packs up to MAX_LIGHTS light handles into flat arrays and uploads them
  // to whichever program is currently bound -- shared by renderScene
  // (entities) and renderTerrain so both read the identical light set with
  // one packing implementation, not two that could drift apart. Lights
  // beyond MAX_LIGHTS are silently not rendered (App.createLight already
  // warns once when that happens -- see 22-api.js) rather than this
  // function throwing or truncating unpredictably differently per caller.
  _uploadLights(lights, u) {
    const gl = this.gl;
    const n = Math.min(lights.length, this.MAX_LIGHTS);
    gl.uniform1i(u.numLights, n);
    if (n === 0) return;
    const pos = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const intensity = new Float32Array(n);
    const range = new Float32Array(n);
    const isSpot = new Float32Array(n);
    const spotDir = new Float32Array(n * 3);
    const spotCos = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const l = lights[i];
      pos[i * 3] = l.position.x; pos[i * 3 + 1] = l.position.y; pos[i * 3 + 2] = l.position.z;
      color[i * 3] = l.color[0]; color[i * 3 + 1] = l.color[1]; color[i * 3 + 2] = l.color[2];
      intensity[i] = l.intensity;
      range[i] = l.range;
      isSpot[i] = l.type === 'spot' ? 1 : 0;
      const d = l.direction;
      spotDir[i * 3] = d.x; spotDir[i * 3 + 1] = d.y; spotDir[i * 3 + 2] = d.z;
      spotCos[i] = Math.cos(l.angle);
    }
    gl.uniform3fv(u.pos, pos);
    gl.uniform3fv(u.color, color);
    gl.uniform1fv(u.intensity, intensity);
    gl.uniform1fv(u.range, range);
    gl.uniform1fv(u.isSpot, isSpot);
    gl.uniform3fv(u.spotDir, spotDir);
    gl.uniform1fv(u.spotCos, spotCos);
  }

  renderScene(camera, aspect, scene, lightDir = new Vec3(-0.5, -1.0, -0.3), lights = [], shadowInfo = null) {
    const gl = this.gl;
    const eye = camera.eye;
    const { forward, right, up } = camera.getBasis();

    // renderShadowPass (if it ran this frame) points the viewport at the
    // small shadow-map framebuffer's own resolution -- restore the real
    // canvas viewport unconditionally here rather than depending on the
    // App's own resize() (which is a no-op whenever the canvas size itself
    // hasn't changed, so it can't be relied on to undo this).
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(this.skyProgram);
    gl.uniform3f(this.uSkyCamForward, forward.x, forward.y, forward.z);
    gl.uniform3f(this.uSkyCamRight, right.x, right.y, right.z);
    gl.uniform3f(this.uSkyCamUp, up.x, up.y, up.z);
    gl.uniform1f(this.uSkyTanHalfFov, Math.tan(camera.fovY / 2));
    gl.uniform1f(this.uSkyAspect, aspect);
    gl.uniform3f(this.uSkyTop, ...this.skyTop);
    gl.uniform3f(this.uSkyHorizon, ...this.skyHorizon);
    gl.uniform3f(this.uSkyLightDir, lightDir.x, lightDir.y, lightDir.z);
    gl.uniform3f(this.uSunColor, ...this.sunColor);
    // Wave 6 (Priority H): texture unit 0, the same unit the main lit
    // program's own u_texture already uses -- safe to reuse here since the
    // sky pass runs in its OWN program/draw call, entirely before the main
    // scene pass rebinds unit 0 to whatever entity it's currently drawing.
    if (this.skyTexture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.skyTexture);
      gl.uniform1i(this.uSkyTexture, 0);
      gl.uniform1i(this.uUseSkyTexture, 1);
    } else {
      gl.uniform1i(this.uUseSkyTexture, 0);
    }
    gl.bindVertexArray(this.skyQuad.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.skyQuad.vertexCount);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.uniformMatrix4fv(this.uView, false, camera.viewMatrix().m);
    gl.uniformMatrix4fv(this.uProjection, false, camera.projectionMatrix(aspect).m);
    gl.uniform3f(this.uLightDir, lightDir.x, lightDir.y, lightDir.z);
    gl.uniform3f(this.uEyePos, eye.x, eye.y, eye.z);
    gl.uniform3f(this.uSkyColor, ...this.skyTop);
    gl.uniform3f(this.uGroundColor, this.groundColor[0], this.groundColor[1], this.groundColor[2]);
    gl.uniform3f(this.uFogColor, ...this.skyHorizon);
    gl.uniform1f(this.uFogDensity, this.fogDensity);
    this._uploadLights(lights, {
      numLights: this.uNumLights, pos: this.uLightPos, color: this.uLightColor, intensity: this.uLightIntensity,
      range: this.uLightRange, isSpot: this.uLightIsSpot, spotDir: this.uLightSpotDir, spotCos: this.uLightSpotCos,
    });
    this._uploadShadowState(shadowInfo, {
      enabled: this.uShadowsEnabled, lightViewProj: this.uLightViewProj, bias: this.uShadowBias, shadowMap: this.uShadowMap,
    });

    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uTexture, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Materials 2.0 transparency: a bounded, deliberately-not-order-
    // independent draw strategy -- opaque entities (alpha >= 1, the
    // overwhelming majority, unaffected by any of this) draw first with
    // normal depth writes, exactly as before this feature existed.
    // Transparent entities draw AFTER, depth-write OFF (so two overlapping
    // transparent objects don't fight over which one is "in front" in the
    // depth buffer) and sorted back-to-front by distance from the camera,
    // which is the standard bounded approximation every non-OIT renderer
    // uses -- correct for the common cases this is meant to serve (a single
    // window, a force field, a ghost object), not guaranteed correct for
    // deeply overlapping transparent geometry.
    const opaque = [];
    const transparent = [];
    for (const entity of scene.entities) {
      if (!entity.visible) continue;
      if (!getEntityRenderMesh(entity)) continue;
      (entity.alpha < 1 ? transparent : opaque).push(entity);
    }
    for (const entity of opaque) this._drawEntity(entity);
    if (transparent.length > 0) {
      transparent.sort((a, b) => eye.sub(b.position).length() - eye.sub(a.position).length()); // farthest first
      gl.depthMask(false);
      for (const entity of transparent) this._drawEntity(entity);
      gl.depthMask(true);
    }
    gl.disable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
  }

  _drawEntity(entity) {
    const gl = this.gl;
    const mesh = getEntityRenderMesh(entity);
    gl.uniformMatrix4fv(this.uModel, false, entity.modelMatrix.m);
    gl.uniform3f(this.uBaseColor, entity.color[0], entity.color[1], entity.color[2]);
    gl.uniform1i(this.uUnlit, entity.unlit ? 1 : 0);
    gl.uniform1f(this.uAlpha, entity.alpha ?? 1);
    const em = entity.emissiveColor || [0, 0, 0];
    gl.uniform3f(this.uEmissiveColor, em[0], em[1], em[2]);
    gl.uniform1f(this.uEmissiveIntensity, entity.emissiveIntensity || 0);
    const uvScale = entity.uvScale || [1, 1];
    const uvOffset = entity.uvOffset || [0, 0];
    gl.uniform2f(this.uUvScale, uvScale[0], uvScale[1]);
    gl.uniform2f(this.uUvOffset, uvOffset[0], uvOffset[1]);
    if (entity.texture) {
      gl.bindTexture(gl.TEXTURE_2D, entity.texture);
      gl.uniform1i(this.uUseTexture, 1);
    } else {
      gl.uniform1i(this.uUseTexture, 0);
    }
    // Wave 6 (Priority C): entity.skin (set by App.addEntity only for a
    // skinned mesh description) plus entity._palette (recomputed every
    // frame by Entity.update, see 11-entity.js) drive the shader's skin
    // branch. u_useSkinning is explicitly set false for every OTHER entity
    // sharing this same program/draw call, not left at whatever the
    // previous draw call happened to leave it.
    if (entity.skin && entity._palette) {
      gl.uniform1i(this.uUseSkinning, 1);
      gl.uniformMatrix4fv(this.uJointMatrices, false, entity._palette);
    } else {
      gl.uniform1i(this.uUseSkinning, 0);
    }
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  renderTerrain(camera, aspect, terrain, lightDir = new Vec3(-0.5, -1.0, -0.3), lights = [], shadowInfo = null) {
    const gl = this.gl;
    const eye = camera.eye;

    gl.useProgram(this.terrainProgram);
    gl.uniformMatrix4fv(this.uTModel, false, Mat4.translation(terrain.position).m);
    gl.uniformMatrix4fv(this.uTView, false, camera.viewMatrix().m);
    gl.uniformMatrix4fv(this.uTProjection, false, camera.projectionMatrix(aspect).m);
    gl.uniform3f(this.uTLightDir, lightDir.x, lightDir.y, lightDir.z);
    gl.uniform3f(this.uTEyePos, eye.x, eye.y, eye.z);
    gl.uniform3f(this.uTSkyColor, ...this.skyTop);
    gl.uniform3f(this.uTGroundColor, ...this.groundColor);
    gl.uniform3f(this.uTFogColor, ...this.skyHorizon);
    gl.uniform1f(this.uTFogDensity, this.fogDensity);
    this._uploadLights(lights, {
      numLights: this.uTNumLights, pos: this.uTLightPos, color: this.uTLightColor, intensity: this.uTLightIntensity,
      range: this.uTLightRange, isSpot: this.uTLightIsSpot, spotDir: this.uTLightSpotDir, spotCos: this.uTLightSpotCos,
    });
    this._uploadShadowState(shadowInfo, {
      enabled: this.uTShadowsEnabled, lightViewProj: this.uTLightViewProj, bias: this.uTShadowBias, shadowMap: this.uTShadowMap,
    });

    // Wave 6B (Priority D): up to 3 optional textured paint layers. Texture
    // units 0/2/3 are used (never 1 -- the shadow map above already claimed
    // that unit for this same draw call). `terrain.layerTextures[li]` is a
    // GPU texture handle the EDITOR resolves from its own Texture Asset
    // Library and assigns directly (the same "editor owns asset->GPU-handle
    // resolution, engine just reads whatever's assigned" pattern
    // `entity.texture` already established) -- absent/null for every layer
    // that has no texture (or no paint layers at all), which correctly
    // leaves u_terrainHasTexN false and this whole block a no-op.
    const TEX_UNITS = [0, 2, 3];
    const layerTextures = terrain.layerTextures || [];
    const paintLayers = terrain.paintLayers || [];
    for (let li = 0; li < 3; li++) {
      const tex = layerTextures[li];
      if (tex) {
        gl.activeTexture(gl.TEXTURE0 + TEX_UNITS[li]);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(this.uTTex[li], TEX_UNITS[li]);
        gl.uniform1i(this.uTHasTex[li], 1);
        const uvScale = (paintLayers[li] && paintLayers[li].uvScale) || 4;
        gl.uniform1f(this.uTUVScale[li], uvScale);
      } else {
        gl.uniform1i(this.uTHasTex[li], 0);
      }
    }

    gl.bindVertexArray(terrain._mesh.vao);
    gl.drawElements(gl.TRIANGLES, terrain._mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  renderParticles(camera, aspect, particles) {
    if (particles.length === 0) return;
    const gl = this.gl;
    const count = Math.min(particles.length, MAX_PARTICLES);
    const { right, up } = camera.getBasis();

    const posSize = this._particlePosSize;
    const colorAlpha = this._particleColorAlpha;
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      posSize[i * 4] = p.position.x;
      posSize[i * 4 + 1] = p.position.y;
      posSize[i * 4 + 2] = p.position.z;
      posSize[i * 4 + 3] = p.size;
      colorAlpha[i * 4] = p.color[0];
      colorAlpha[i * 4 + 1] = p.color[1];
      colorAlpha[i * 4 + 2] = p.color[2];
      colorAlpha[i * 4 + 3] = p.alpha;
    }

    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.particleProgram);
    gl.uniformMatrix4fv(this.uPView, false, camera.viewMatrix().m);
    gl.uniformMatrix4fv(this.uPProjection, false, camera.projectionMatrix(aspect).m);
    gl.uniform3f(this.uPCamRight, right.x, right.y, right.z);
    gl.uniform3f(this.uPCamUp, up.x, up.y, up.z);

    gl.bindVertexArray(this.particleGeom.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleGeom.posSizeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, posSize, 0, count * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleGeom.colorAlphaBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, colorAlpha, 0, count * 4);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.particleGeom.vertexCount, count);

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }

  renderWater(camera, aspect, water, time, lightDir = new Vec3(-0.5, -1.0, -0.3)) {
    const gl = this.gl;
    const eye = camera.eye;

    gl.useProgram(this.waterProgram);
    gl.uniformMatrix4fv(this.uWModel, false, Mat4.translation(water.position).m);
    gl.uniformMatrix4fv(this.uWView, false, camera.viewMatrix().m);
    gl.uniformMatrix4fv(this.uWProjection, false, camera.projectionMatrix(aspect).m);
    gl.uniform3f(this.uWEyePos, eye.x, eye.y, eye.z);
    gl.uniform3f(this.uWLightDir, lightDir.x, lightDir.y, lightDir.z);
    gl.uniform3f(this.uWDeepColor, ...water.deepColor);
    gl.uniform3f(this.uWReflectionColor, ...this.skyHorizon);
    gl.uniform3f(this.uWFoamColor, 0.92, 0.96, 0.98);
    gl.uniform3f(this.uWFogColor, ...this.skyHorizon);
    gl.uniform1f(this.uWFogDensity, this.fogDensity);
    gl.uniform1f(this.uWTime, time);

    const [w0, w1, w2] = water.waves;
    gl.uniform4f(this.uWWaveA, w0.dir[0], w0.dir[1], w0.freq, w0.speed);
    gl.uniform4f(this.uWWaveB, w1.dir[0], w1.dir[1], w1.freq, w1.speed);
    gl.uniform4f(this.uWWaveC, w2.dir[0], w2.dir[1], w2.freq, w2.speed);
    gl.uniform3f(this.uWWaveAmp, w0.amp, w1.amp, w2.amp);

    gl.bindVertexArray(water._mesh.vao);
    gl.drawElements(gl.TRIANGLES, water._mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  destroy() {
    const gl = this.gl;
    const deleteResource = (resource, index) => {
      if (!resource) return;
      if (index === 0) gl.deleteVertexArray(resource);
      else gl.deleteBuffer(resource);
    };
    for (const mesh of [this.skyQuad, this.particleGeom]) {
      (mesh.resources || []).forEach(deleteResource);
    }
    for (const program of [this.program, this.skyProgram, this.particleProgram, this.waterProgram, this.terrainProgram, this.shadowProgram]) {
      if (program) gl.deleteProgram(program);
    }
    if (this._shadowTexture) gl.deleteTexture(this._shadowTexture);
    if (this._shadowFbo) gl.deleteFramebuffer(this._shadowFbo);
  }
}
