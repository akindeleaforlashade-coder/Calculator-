import { VehicleType } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private engineRunning = false;
  private currentVehicleType: VehicleType = 'car';

  private driftSource: AudioBufferSourceNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;
  private driftGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  private sfxEnabled = true;
  private musicEnabled = true;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.75;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 1 : 0;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.34 : 0;
      this.musicGain.connect(this.masterGain);

      // Create reusable 2-second white noise buffer
      const length = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public setPreferences(sfx: boolean, music: boolean) {
    this.sfxEnabled = sfx;
    this.musicEnabled = music;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(sfx ? 1 : 0, this.ctx.currentTime, 0.04);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(music ? 0.34 : 0, this.ctx.currentTime, 0.08);
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public startEngine(vehicleType: VehicleType) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.stopEngine();

    this.currentVehicleType = vehicleType;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = vehicleType === 'bike' ? 650 : 380;
    this.engineFilter.Q.value = 3.2;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.001;

    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc2 = ctx.createOscillator();
    if (vehicleType === 'bike') {
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2.type = 'square';
      this.engineOsc1.frequency.value = 95;
      this.engineOsc2.frequency.value = 190;
    } else {
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2.type = 'triangle';
      this.engineOsc1.frequency.value = 58;
      this.engineOsc2.frequency.value = 116;
    }

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = vehicleType === 'bike' ? 0.35 : 0.55;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(osc2Gain);
    osc2Gain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineGain.gain.setTargetAtTime(0.14, ctx.currentTime, 0.12);

    // Drift tire screech loop
    if (this.noiseBuffer) {
      this.driftSource = ctx.createBufferSource();
      this.driftSource.buffer = this.noiseBuffer;
      this.driftSource.loop = true;

      this.driftFilter = ctx.createBiquadFilter();
      this.driftFilter.type = 'bandpass';
      this.driftFilter.frequency.value = 1350;
      this.driftFilter.Q.value = 4.5;

      this.driftGain = ctx.createGain();
      this.driftGain.gain.value = 0;

      this.driftSource.connect(this.driftFilter);
      this.driftFilter.connect(this.driftGain);
      this.driftGain.connect(this.sfxGain);
      this.driftSource.start();
    }

    this.engineRunning = true;
  }

  public updateEngine(rpmNorm: number, speedNorm: number, driftIntensity: number, nitroActive: boolean) {
    if (!this.engineRunning || !this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const clampedRpm = Math.max(0, Math.min(1.25, rpmNorm));
    const baseFreq = this.currentVehicleType === 'bike'
      ? 92 + clampedRpm * 215 + (nitroActive ? 35 : 0)
      : 54 + clampedRpm * 135 + (nitroActive ? 22 : 0);

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * (this.currentVehicleType === 'bike' ? 2.02 : 1.5), now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(
      (this.currentVehicleType === 'bike' ? 500 : 320) + clampedRpm * 1450 + (nitroActive ? 600 : 0),
      now,
      0.05
    );
    this.engineGain.gain.setTargetAtTime(0.11 + speedNorm * 0.09 + (nitroActive ? 0.05 : 0), now, 0.06);

    if (this.driftGain && this.driftFilter) {
      const targetDrift = Math.max(0, Math.min(1, driftIntensity)) * 0.16;
      this.driftGain.gain.setTargetAtTime(targetDrift, now, 0.05);
      this.driftFilter.frequency.setTargetAtTime(1150 + speedNorm * 650, now, 0.05);
    }
  }

  public stopEngine() {
    this.engineRunning = false;
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.driftSource?.stop();
    } catch {
      // Ignore already stopped
    }
    this.engineOsc1?.disconnect();
    this.engineOsc2?.disconnect();
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.driftSource?.disconnect();
    this.driftFilter?.disconnect();
    this.driftGain?.disconnect();

    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.driftSource = null;
    this.driftFilter = null;
    this.driftGain = null;
  }

  public playCountdownBeep(isGo: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    if (isGo) {
      osc.frequency.exponentialRampToValueAtTime(1174, now + 0.18);
    }
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.45 : 0.22));
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.46 : 0.24));
  }

  public playCollision(intensity = 0.7) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.15, Math.min(1, intensity));

    // Impact thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
    gain.gain.setValueAtTime(0.45 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.21);

    // Metallic crunch noise
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 950;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.28 * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.16);
    }
  }

  public playNitroBurst() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(1900, now + 0.25);
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.4);
  }

  public playCheckpoint() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      g.gain.setValueAtTime(0.14, now + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.2);
    });
  }

  public playFinishFanfare() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.04);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public startMusic() {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;
    if (this.musicTimer !== null) return;

    const bassPattern = [110, 110, 130.81, 110, 146.83, 146.83, 164.81, 130.81];
    const leadPattern = [440, 0, 523.25, 659.25, 587.33, 0, 659.25, 783.99];
    const stepMs = 155; // ~97 BPM 16th/8th drive

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || !this.musicEnabled || this.muted || this.ctx.state !== 'running') {
        return;
      }
      const now = this.ctx.currentTime;
      const idx = this.musicStep % bassPattern.length;

      // Driving synth bass
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassPattern[idx], now);
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(520, now);
      bassFilter.frequency.exponentialRampToValueAtTime(180, now + 0.13);
      bassGain.gain.setValueAtTime(0.26, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.145);

      // Punchy kick every 2 steps
      if (this.musicStep % 2 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(125, now);
        kick.frequency.exponentialRampToValueAtTime(38, now + 0.11);
        kGain.gain.setValueAtTime(0.38, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        kick.connect(kGain);
        kGain.connect(this.musicGain);
        kick.start(now);
        kick.stop(now + 0.125);
      }

      // Crisp off-beat hi-hat
      if (this.musicStep % 2 === 1 && this.noiseBuffer) {
        const hat = this.ctx.createBufferSource();
        hat.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6500;
        const hGain = this.ctx.createGain();
        hGain.gain.setValueAtTime(0.08, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        hat.connect(hp);
        hp.connect(hGain);
        hGain.connect(this.musicGain);
        hat.start(now);
        hat.stop(now + 0.05);
      }

      // Synth lead arp
      const leadFreq = leadPattern[(this.musicStep + Math.floor(this.musicStep / 8)) % leadPattern.length];
      if (leadFreq > 0 && this.musicStep % 2 === 0) {
        const lead = this.ctx.createOscillator();
        const lGain = this.ctx.createGain();
        lead.type = 'triangle';
        lead.frequency.setValueAtTime(leadFreq, now);
        lGain.gain.setValueAtTime(0.11, now);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        lead.connect(lGain);
        lGain.connect(this.musicGain);
        lead.start(now);
        lead.stop(now + 0.17);
      }

      this.musicStep++;
    }, stepMs);
  }

  public stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
