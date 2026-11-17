class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windStarted: boolean = false;

  constructor() {
    try {
      const saved = localStorage.getItem('spike_plunge_muted');
      if (saved === 'true') {
        this.muted = true;
      }
    } catch {
      // ignore storage errors
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('spike_plunge_muted', String(muted));
    } catch {
      // ignore
    }
    if (this.windGain && this.ctx) {
      this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.windStarted) {
      this.initWindLoop(ctx);
    }
  }

  private initWindLoop(ctx: AudioContext): void {
    try {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 300;
      filter.Q.value = 1.4;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      this.windFilter = filter;
      this.windGain = gain;
      this.windStarted = true;
    } catch {
      // ignore audio setup issues
    }
  }

  public updateWind(speedRatio: number, active: boolean): void {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    if (this.muted || !active) {
      this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      return;
    }
    const clamped = Math.max(0, Math.min(1, speedRatio));
    const targetVol = clamped * 0.14;
    const targetFreq = 220 + clamped * 950;
    this.windGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.06);
    this.windFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.06);
  }

  public playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.14);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playSpikeHit(severity: number = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Sub-bass crunch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.22);
    gain.gain.setValueAtTime(0.28 * Math.min(1.2, severity), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);

    // Metallic spike clang
    const clang = ctx.createOscillator();
    const clangGain = ctx.createGain();
    clang.type = 'square';
    clang.frequency.setValueAtTime(980 + Math.random() * 250, now);
    clang.frequency.exponentialRampToValueAtTime(240, now + 0.12);
    clangGain.gain.setValueAtTime(0.1, now);
    clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    clang.connect(clangGain);
    clangGain.connect(ctx.destination);
    clang.start(now);
    clang.stop(now + 0.14);

    // Wet splatter noise burst
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.25, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  public playFloorImpact(intensity: number = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);

    gain.gain.setValueAtTime(Math.min(0.35, 0.15 + intensity * 0.18), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playLevelClear(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }
}

export const soundEngine = new SoundEngine();
