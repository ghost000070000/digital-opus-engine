class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this.muted = false;
    this._ambientSource = null;

    // Engine hum nodes
    this._humOsc = null;
    this._humGain = null;
    this._humFilter = null;
    this._timers = new Set();
    this.destroyed = false;
  }

  _later(fn, delay) {
    const timer = setTimeout(() => {
      this._timers.delete(timer);
      if (this.ctx) fn();
    }, delay);
    this._timers.add(timer);
  }

  _ensureContext() {
    if (this.destroyed) fail('AudioEngine', 'instance', 'not destroyed', this);
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('AudioEngine: Web Audio is unavailable in this browser.');
    this.ctx = new Ctx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.connect(this.masterGain);

    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.listener = this.ctx.listener;
  }

  resume() {
    this._ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    if (typeof muted !== 'boolean') fail('AudioEngine.setMuted', 'muted', 'a boolean', muted);
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 1;
  }

  setVolume(category, value) {
    if (!['music', 'sfx', 'ambient'].includes(category)) fail('AudioEngine.setVolume', 'category', '"music", "sfx", or "ambient"', category);
    finite(value, 'value', 'AudioEngine.setVolume');
    if (value < 0 || value > 1) fail('AudioEngine.setVolume', 'value', 'between 0 and 1', value);
    this._ensureContext();
    const node = { music: this.musicGain, sfx: this.sfxGain, ambient: this.ambientGain }[category];
    if (node) node.gain.value = value;
  }

  playBlip({ frequency = 660, duration = 0.12, type = 'sine', position = null } = {}) {
    positive(frequency, 'options.frequency', 'AudioEngine.playBlip');
    positive(duration, 'options.duration', 'AudioEngine.playBlip');
    if (!['sine', 'square', 'sawtooth', 'triangle'].includes(type)) fail('AudioEngine.playBlip', 'options.type', 'a supported oscillator type', type);
    if (position !== null) vector(position, 'options.position', 'AudioEngine.playBlip');
    this._ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);

    let out = gain;
    if (position) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      gain.connect(panner);
      out = panner;
    }
    out.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  startEngineHum() {
    this._ensureContext();
    if (this._humOsc) return;

    this._humOsc = this.ctx.createOscillator();
    this._humOsc.type = 'sawtooth';
    this._humOsc.frequency.value = 65;

    this._humFilter = this.ctx.createBiquadFilter();
    this._humFilter.type = 'lowpass';
    this._humFilter.frequency.value = 280;

    this._humGain = this.ctx.createGain();
    this._humGain.gain.value = 0.05;

    this._humOsc.connect(this._humFilter);
    this._humFilter.connect(this._humGain);
    this._humGain.connect(this.sfxGain);

    this._humOsc.start();
  }

  updateEngineHum(pitchRatio = 1.0, volume = 0.15) {
    positive(pitchRatio, 'pitchRatio', 'AudioEngine.updateEngineHum', true);
    positive(volume, 'volume', 'AudioEngine.updateEngineHum', true);
    if (!this._humOsc || !this.ctx) return;
    const baseFreq = 65;
    const targetFreq = Math.max(30, Math.min(240, baseFreq * (0.8 + pitchRatio * 1.4)));
    const targetGain = Math.max(0, Math.min(0.35, volume * 0.2));

    this._humOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
    this._humGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    this._humFilter.frequency.setTargetAtTime(200 + pitchRatio * 300, this.ctx.currentTime, 0.05);
  }

  stopEngineHum() {
    for (const timer of this._timers) clearTimeout(timer);
    this._timers.clear();
    if (this._humOsc) {
      try {
        this._humOsc.stop();
        this._humOsc.disconnect();
      } catch (e) {}
      this._humOsc = null;
      this._humGain = null;
      this._humFilter = null;
    }
  }

  playPickup() {
    this.playBlip({ frequency: 880, duration: 0.08, type: 'sine' });
    this._later(() => {
      this.playBlip({ frequency: 1320, duration: 0.12, type: 'triangle' });
    }, 60);
  }

  playDelivery() {
    this.playBlip({ frequency: 523, duration: 0.1, type: 'triangle' });
    this._later(() => this.playBlip({ frequency: 659, duration: 0.1, type: 'triangle' }), 90);
    this._later(() => this.playBlip({ frequency: 784, duration: 0.15, type: 'triangle' }), 180);
    this._later(() => this.playBlip({ frequency: 1046, duration: 0.25, type: 'sine' }), 270);
  }

  playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      this._later(() => this.playBlip({ frequency: freq, duration: 0.2, type: 'triangle' }), i * 110);
    });
  }

  playLose() {
    const notes = [400, 350, 300, 220];
    notes.forEach((freq, i) => {
      this._later(() => this.playBlip({ frequency: freq, duration: 0.25, type: 'sawtooth' }), i * 130);
    });
  }

  playBoost() {
    this._ensureContext();
    this.playBlip({ frequency: 320, duration: 0.18, type: 'sawtooth' });
    this._later(() => this.playBlip({ frequency: 640, duration: 0.25, type: 'triangle' }), 50);
  }

  startAmbientDrone() {
    this._ensureContext();
    if (this._ambientSource) return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    noise.connect(filter);
    filter.connect(this.ambientGain);
    noise.start();
    this._ambientSource = noise;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const timer of this._timers) clearTimeout(timer);
    this._timers.clear();
    this.stopEngineHum();
    if (this._ambientSource) {
      try { this._ambientSource.stop(); } catch (e) {}
      this._ambientSource = null;
    }
    if (this.ctx && typeof this.ctx.close === 'function') {
      try { this.ctx.close(); } catch (e) {}
      this.ctx = null;
    }
    this.masterGain = this.musicGain = this.sfxGain = this.ambientGain = this.listener = null;
  }

  updateListener(camera) {
    if (!this.ctx) return;
    const eye = camera.eye;
    const { forward, up } = camera.getBasis();

    if (this.listener.positionX) {
      this.listener.positionX.value = eye.x;
      this.listener.positionY.value = eye.y;
      this.listener.positionZ.value = eye.z;
      this.listener.forwardX.value = forward.x;
      this.listener.forwardY.value = forward.y;
      this.listener.forwardZ.value = forward.z;
      this.listener.upX.value = up.x;
      this.listener.upY.value = up.y;
      this.listener.upZ.value = up.z;
    } else {
      this.listener.setPosition(eye.x, eye.y, eye.z);
      this.listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }
}
