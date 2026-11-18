// 100% procedural Web Audio API sound effects

export class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  private playNoise(duration: number, filterFreq: number, volume: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playBlockBreak(): void {
    const pitch = 0.92 + Math.random() * 0.16;
    this.playNoise(0.11, 750 * pitch, 0.14);
    this.playTone(150 * pitch, 65, 0.09, 'triangle', 0.12);
  }

  public playBlockPlace(): void {
    const pitch = 0.92 + Math.random() * 0.16;
    this.playTone(220 * pitch, 110, 0.07, 'square', 0.08);
  }

  public playStep(inWater = false): void {
    const pitch = 0.9 + Math.random() * 0.2;
    if (inWater) {
      this.playNoise(0.09, 1100 * pitch, 0.08);
    } else {
      this.playNoise(0.05, 420 * pitch, 0.05);
    }
  }

  public playHit(): void {
    this.playTone(180, 70, 0.12, 'sawtooth', 0.12);
    this.playNoise(0.08, 900, 0.09);
  }

  public playHurt(): void {
    this.playTone(240, 110, 0.18, 'sawtooth', 0.16);
  }

  public playPickup(): void {
    this.playTone(540, 880, 0.09, 'sine', 0.08);
  }

  public playExplosion(): void {
    this.playNoise(0.55, 320, 0.26);
    this.playTone(110, 28, 0.45, 'sawtooth', 0.2);
  }

  public playThunder(): void {
    this.playNoise(0.9, 210, 0.18);
  }
}
