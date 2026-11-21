let audio: AudioContext | undefined
export function unlock() {
  if (!window.AudioContext) return
  audio ??= new AudioContext()
  if (audio.state === 'suspended') void audio.resume().catch(() => {})
}
export function beat(freq: number, seconds: number, volume: number, rough = false) {
  if (!audio || audio.state !== 'running') return
  const t = audio.currentTime
  const osc = audio.createOscillator(), gain = audio.createGain()
  osc.type = rough ? 'sawtooth' : 'triangle'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(28, freq / 4), t + seconds)
  gain.gain.setValueAtTime(volume, t)
  gain.gain.exponentialRampToValueAtTime(.001, t + seconds)
  osc.connect(gain).connect(audio.destination)
  osc.start(t); osc.stop(t + seconds)
}
export function cleared() {
  beat(680, .22, .08)
  if ('speechSynthesis' in window) {
    const line = new SpeechSynthesisUtterance('Campo limpo. Avança!')
    line.lang = 'pt-BR'; line.rate = 1.15
    speechSynthesis.speak(line)
  }
}
