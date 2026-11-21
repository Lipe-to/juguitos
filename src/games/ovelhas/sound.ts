import type { SheepPass } from './engine'

const tune = [72, 0, 76, 79, 74, 0, 72, 67, 69, 0, 72, 76, 79, 77, 76, 0, 74, 0, 77, 81, 79, 0, 77, 74, 72, 0, 76, 79, 84, 79, 76, 0]
const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12)

export class SheepSound {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private music: GainNode | null = null
  private timer: number | undefined

  async enable() {
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = .29
      this.master.connect(this.context.destination)
    }
    await this.context.resume()
    if (this.master) this.master.gain.value = .29
  }

  private note(at: number, from: number, to: number, length: number, strength: number, type: OscillatorType, bus = this.master) {
    const context = this.context
    if (!context || !bus || context.state !== 'running') return
    const oscillator = context.createOscillator(), volume = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, at)
    oscillator.frequency.exponentialRampToValueAtTime(to, at + length)
    volume.gain.setValueAtTime(.0001, at)
    volume.gain.exponentialRampToValueAtTime(strength, at + .014)
    volume.gain.exponentialRampToValueAtTime(.0001, at + length)
    oscillator.connect(volume); volume.connect(bus)
    oscillator.start(at); oscillator.stop(at + length + .02)
    oscillator.onended = () => { oscillator.disconnect(); volume.disconnect() }
  }

  play(kind: 'click' | 'ready' | 'tie' | 'lost' | 'win') {
    if (!this.context) return
    const at = this.context.currentTime
    const notes = { click: [76, 84], ready: [60, 72, 79], tie: [72, 69, 72], lost: [69, 65, 57], win: [72, 76, 79, 84] }[kind]
    notes.forEach((n, i) => this.note(at + .015 + i * .083, frequency(n), frequency(n - .25), .18, .18, 'triangle'))
  }

  startRound(now: () => number, startsAt: number, duration: number, bpm: number, flock: SheepPass[]) {
    this.stopRound()
    const context = this.context
    if (!context || !this.master) return
    const bus = context.createGain()
    bus.connect(this.master); this.music = bus
    const step = 30000 / bpm
    let beat = Math.max(0, Math.ceil((now() - startsAt) / step))
    const bleats = flock.filter((_, i) => i % 3 === 1).map(s => s.at + 170)
    const landings = flock.flatMap(s => s.fall ? [s.at + s.fall.descendMs] : [])
    let bleat = bleats.findIndex(time => time >= now() - startsAt)
    let landing = landings.findIndex(time => time >= now() - startsAt)
    const schedule = () => {
      const elapsed = now() - startsAt
      if (elapsed >= duration) { this.stopRound(); return }
      const scheduleAt = (ms: number) => context.currentTime + Math.max(.01, (ms - elapsed) / 1000)
      while (beat * step < Math.min(elapsed + 115, duration)) {
        if (beat * step >= elapsed - 50) {
          const note = tune[beat % tune.length], at = scheduleAt(beat * step)
          if (note) this.note(at, frequency(note), frequency(note - .32), .135, .20, 'triangle', bus)
          if (beat % 4 === 0) {
            const bass = frequency([48, 45, 50, 43][Math.floor(beat / 8) % 4])
            this.note(at, bass * 1.35, bass, .19, .20, 'sine', bus)
          } else if (beat % 2 === 1) this.note(at, 720, 280, .055, .055, 'square', bus)
        }
        beat++
      }
      while (bleat >= 0 && bleat < bleats.length && bleats[bleat] < elapsed + 115) {
        if (bleats[bleat] >= elapsed - 45) {
          const at = scheduleAt(bleats[bleat])
          this.note(at, 340, 510, .086, .13, 'sawtooth', bus)
          this.note(at + .065, 520, 285, .138, .10, 'triangle', bus)
        }
        bleat++
      }
      while (landing >= 0 && landing < landings.length && landings[landing] < elapsed + 115) {
        if (landings[landing] >= elapsed - 45) {
          const at = scheduleAt(landings[landing])
          this.note(at, 175, 58, .19, .19, 'sine', bus)
          this.note(at + .015, 560, 260, .085, .07, 'triangle', bus)
        }
        landing++
      }
    }
    schedule(); this.timer = window.setInterval(schedule, 35)
  }

  stopRound() {
    if (this.timer !== undefined) window.clearInterval(this.timer)
    this.timer = undefined
    this.music?.disconnect(); this.music = null
  }

  mute() {
    this.stopRound()
    if (this.master) this.master.gain.value = 0
  }

  close() {
    this.stopRound()
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {})
    this.context = null; this.master = null
  }
}
