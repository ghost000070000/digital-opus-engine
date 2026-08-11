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

    this.uSkyCamForward = gl.getUniformLocation(this.skyProgram, 'u_camForward');
    this.uSkyCamRight = gl.getUniformLocation(this.skyProgram, 'u_camRight');
    this.uSkyCamUp = gl.getUniformLocation(this.skyProgram, 'u_camUp');
    this.uSkyTanHalfFov = gl.getUniformLocation(this.skyProgram, 'u_tanHalfFov');
    this.uSkyAspect = gl.getUniformLocation(this.skyProgram, 'u_aspect');
    this.uSkyTop = gl.getUniformLocation(this.skyProgram, 'u_skyTop');
    this.uSkyHorizon = gl.getUniformLocation(this.skyProgram, 'u_skyHorizon');
    this.uSkyLightDir = gl.getUniformLocation(this.skyProgram, 'u_lightDir');
    this.uSunColor = gl.getUniformLocation(this.skyProgram, 'u_sunColor');

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

    this.skyTop = [0.06, 0.10, 0.24];
    this.skyHorizon = [0.62, 0.68, 0.80];
    this.groundColor = [0.16, 0.16, 0.14];
    this.sunColor = [1.0, 0.92, 0.75];
    this.fogDensity = 0.035;

    gl.enable(gl.DEPTH_TEST);
  }

  renderScene(camera, aspect, scene, lightDir = new Vec3(-0.5, -1.0, -0.3)) {
    const gl = this.gl;
    const eye = camera.eye;
    const { forward, right, up } = camera.getBasis();

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

    for (const entity of scene.entities) {
      if (!entity.visible) continue;
      const mesh = getEntityRenderMesh(entity);
      if (!mesh) continue;
      gl.uniformMatrix4fv(this.uModel, false, entity.modelMatrix.m);
      gl.uniform3f(this.uBaseColor, entity.color[0], entity.color[1], entity.color[2]);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  renderTerrain(camera, aspect, terrain, lightDir = new Vec3(-0.5, -1.0, -0.3)) {
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
    for (const program of [this.program, this.skyProgram, this.particleProgram, this.waterProgram, this.terrainProgram]) {
      if (program) gl.deleteProgram(program);
    }
  }
}
