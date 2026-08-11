function randRange([min, max]) {
  return min + Math.random() * (max - min);
}

class ParticleEmitter {
  constructor({
    position = new Vec3(),
    rate = 20,
    life = [1, 2],
    riseSpeed = [0.4, 1.0],
    spread = 0.6,
    size = [0.05, 0.12],
    color = [1, 0.85, 0.5],
    gravity = -0.15,
    maxParticles = 200,
  } = {}) {
    vector(position, 'options.position', 'Opus.ParticleEmitter');
    positive(rate, 'options.rate', 'Opus.ParticleEmitter', true);
    positive(spread, 'options.spread', 'Opus.ParticleEmitter', true);
    integer(maxParticles, 'options.maxParticles', 'Opus.ParticleEmitter');
    if (maxParticles > MAX_PARTICLES) fail('Opus.ParticleEmitter', 'options.maxParticles', `at most ${MAX_PARTICLES}`, maxParticles);
    for (const [name, range] of Object.entries({ life, riseSpeed, size })) {
      if (!Array.isArray(range) || range.length !== 2 || range.some((n) => typeof n !== 'number' || !Number.isFinite(n)) || range[0] > range[1]) fail('Opus.ParticleEmitter', `options.${name}`, 'an ascending two-number array', range);
    }
    if (!Array.isArray(color) || color.length !== 3 || color.some((n) => typeof n !== 'number' || !Number.isFinite(n))) fail('Opus.ParticleEmitter', 'options.color', 'a three-number RGB array', color);
    finite(gravity, 'options.gravity', 'Opus.ParticleEmitter');
    this.position = position;
    this.rate = rate;
    this.life = life;
    this.riseSpeed = riseSpeed;
    this.spread = spread;
    this.size = size;
    this.color = color;
    this.gravity = gravity;
    this.maxParticles = maxParticles;
    this.particles = [];
    this._accumulator = 0;
  }

  _spawn() {
    if (this.particles.length >= this.maxParticles) return;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * this.spread;
    this.particles.push({
      position: this.position.add(new Vec3(Math.cos(angle) * r, 0, Math.sin(angle) * r)),
      velocity: new Vec3((Math.random() - 0.5) * 0.2, randRange(this.riseSpeed), (Math.random() - 0.5) * 0.2),
      age: 0,
      life: randRange(this.life),
      size: randRange(this.size),
    });
  }

  emit(count = 1) {
    integer(count, 'count', 'ParticleEmitter.emit');
    for (let i = 0; i < count; i++) this._spawn();
    return this;
  }

  clear() {
    this.particles.length = 0;
    this._accumulator = 0;
  }

  destroy() {
    this.clear();
  }

  update(dt) {
    positive(dt, 'dt', 'ParticleEmitter.update', true);
    this._accumulator += this.rate * dt;
    while (this._accumulator >= 1) {
      this._accumulator -= 1;
      this._spawn();
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y += this.gravity * dt;
      p.position = p.position.add(p.velocity.scale(dt));
    }
  }

  appendRenderData(out) {
    for (const p of this.particles) {
      const t = p.age / p.life;
      out.push({
        position: p.position,
        size: p.size * (1 - t * 0.4),
        color: this.color,
        alpha: 1 - t,
      });
    }
  }
}
