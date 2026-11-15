/**
 * Web Audio API synthesizer for tactile mechanical feedback
 * Emulates bike mechanical clicks: shifters, ratchet hubs, lockouts.
 * Requires zero external audio files.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check localStorage for muted state
    try {
      const saved = localStorage.getItem('velovibe_sound_muted');
      if (saved !== null) {
        this.isMuted = saved === 'true';
      }
    } catch {
      this.isMuted = false;
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const w = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioCtx = window.AudioContext || w.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('velovibe_sound_muted', String(this.isMuted));
    } catch {}
    if (!this.isMuted) {
      this.playShifterClick();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /** Shifter / mechanical indexing click (Shimano / SRAM tactile click) */
  public playShifterClick() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.045);
    } catch {}
  }

  /**
   * Freehub coast: rapid low-frequency pawl hits (Hope Pro 4 / I9 Hydra density).
   * No samples — short square bursts through a bandpass.
   */
  public playRatchet() {
    if (this.isMuted) return;
    try {
      this.initContext();
      const ctx = this.ctx;
      if (!ctx) return;

      const now = ctx.currentTime;
      const clicks = 16;
      for (let i = 0; i < clicks; i++) {
        const time = now + i * 0.016;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(78 + (i % 4) * 14, time);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(360 + (i % 5) * 55, time);
        filter.Q.setValueAtTime(6, time);

        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.011);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.013);
      }
    } catch {
      /* AudioContext blocked or closed — stay silent */
    }
  }

  /** Discovery / Shovel Unlock chime */
  public playSecretUnlock() {
    if (this.isMuted) return;
    try {
      this.initContext();
      const ctx = this.ctx;
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C, E, G, High C
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const time = now + idx * 0.06;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        // Lowpass filter for smooth gold synth tone
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, time);

        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.2);
      });
    } catch {}
  }
}

export const sound = new SoundEngine();
