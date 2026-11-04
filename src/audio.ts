/**
 * All sound is synthesized in the browser with Web Audio.
 * No samples, no third-party audio. Original to this project.
 */

type Kind = 'shot' | 'boom' | 'bigboom' | 'city' | 'ui' | 'wave' | 'upgrade' | 'clear' | 'over' | 'warn' | 'laser' | 'emp' | 'homing'

export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private muted = false
  private dead = false
  private last = new Map<string, number>()
  private ambientStarted = false

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.85
  }

  get isMuted(): boolean {
    return this.muted
  }

  unlock(): void {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    this.startAmbient()
  }

  play(kind: Kind): void {
    if (this.muted || this.dead) return
    const ctx = this.ensure()
    if (!ctx || ctx.state !== 'running') return
    switch (kind) {
      case 'shot':
        if (!this.allow('shot', 38)) return
        this.noiseBurst(0.02, 2400, 0.06, 'highpass')
        this.noiseBurst(0.05, 480, 0.07, 'lowpass')
        this.tone('triangle', 240, 70, 0.05, 0.05)
        break
      case 'homing':
        if (!this.allow('homing', 80)) return
        this.tone('sawtooth', 180, 90, 0.12, 0.04)
        this.noiseBurst(0.08, 600, 0.05, 'bandpass')
        break
      case 'laser':
        if (!this.allow('laser', 90)) return
        this.tone('sine', 880, 740, 0.08, 0.03)
        this.noiseBurst(0.06, 1800, 0.025, 'highpass')
        break
      case 'emp':
        this.noiseBurst(0.28, 2400, 0.08, 'bandpass')
        this.tone('sine', 220, 40, 0.32, 0.07)
        break
      case 'boom':
        if (!this.allow('boom', 55)) return
        this.noiseBurst(0.05, 1800, 0.08, 'highpass')
        this.noiseBurst(0.22, 700, 0.16, 'lowpass')
        this.tone('sine', 150, 48, 0.22, 0.1)
        break
      case 'bigboom':
        this.noiseBurst(0.08, 2000, 0.1, 'highpass')
        this.noiseBurst(0.4, 320, 0.22, 'lowpass')
        this.tone('sine', 90, 32, 0.45, 0.12)
        break
      case 'city':
        if (!this.allow('city', 80)) return
        this.noiseBurst(0.32, 380, 0.22, 'lowpass')
        this.tone('sawtooth', 90, 36, 0.28, 0.05)
        this.tone('triangle', 140, 50, 0.2, 0.04)
        break
      case 'ui':
        this.tone('sine', 740, 980, 0.06, 0.04)
        break
      case 'wave':
        this.tone('triangle', 392, 392, 0.09, 0.05)
        this.tone('triangle', 523, 660, 0.12, 0.05, 0.08)
        break
      case 'upgrade':
        this.tone('triangle', 523, 523, 0.09, 0.05)
        this.tone('triangle', 659, 659, 0.09, 0.05, 0.07)
        this.tone('triangle', 784, 988, 0.14, 0.05, 0.14)
        break
      case 'clear':
        this.tone('sine', 659, 659, 0.08, 0.045)
        this.tone('sine', 880, 880, 0.08, 0.045, 0.07)
        this.tone('sine', 1174, 1318, 0.16, 0.04, 0.14)
        break
      case 'over':
        this.tone('triangle', 311, 233, 0.22, 0.06)
        this.tone('sine', 196, 130, 0.4, 0.05, 0.12)
        break
      case 'warn':
        if (!this.allow('warn', 90)) return
        this.tone('square', 720, 720, 0.06, 0.03)
        this.tone('square', 960, 960, 0.07, 0.028, 0.09)
        break
    }
  }

  combo(mult: number): void {
    if (this.muted || this.dead) return
    if (!this.allow('combo', 45)) return
    const ctx = this.ensure()
    if (!ctx || ctx.state !== 'running') return
    const freq = 480 + Math.min(8, mult) * 48
    this.tone('triangle', freq, freq * 1.25, 0.07, 0.04)
  }

  private allow(name: string, gapMs: number): boolean {
    const now = performance.now()
    const prev = this.last.get(name) ?? 0
    if (now - prev < gapMs) return false
    this.last.set(name, now)
    return true
  }

  private ensure(): AudioContext | null {
    if (this.dead) return null
    if (this.ctx) return this.ctx
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
      this.dead = true
      return null
    }
    try {
      this.ctx = new Ctor()
    } catch {
      this.dead = true
      return null
    }
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 18
    comp.ratio.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.12
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.85
    this.master.connect(comp)
    comp.connect(this.ctx.destination)
    return this.ctx
  }

  private startAmbient(): void {
    if (this.ambientStarted || !this.ctx || !this.master) return
    this.ambientStarted = true
    const bed = this.ctx.createGain()
    bed.gain.value = 0.02
    bed.connect(this.master)
    const a = this.ctx.createOscillator()
    const b = this.ctx.createOscillator()
    a.type = 'sine'
    b.type = 'sine'
    a.frequency.value = 98
    b.frequency.value = 146.8
    b.detune.value = 7
    a.connect(bed)
    b.connect(bed)
    a.start()
    b.start()
  }

  private tone(
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    gain: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(30, from), t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur)
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(amp)
    amp.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noiseBurst(
    dur: number,
    freq: number,
    gain: number,
    filterType: BiquadFilterType,
  ): void {
    if (!this.ctx || !this.master) return
    const buffer = this.noiseBuffer()
    if (!buffer) return
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.value = freq
    filter.Q.value = filterType === 'bandpass' ? 0.7 : 0.6
    const amp = this.ctx.createGain()
    const t = this.ctx.currentTime
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(amp)
    amp.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  private noiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null
    if (this.noise) return this.noise
    const length = Math.floor(this.ctx.sampleRate * 0.5)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    this.noise = buffer
    return buffer
  }
}

export const audio = new AudioBus()
