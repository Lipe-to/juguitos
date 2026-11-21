import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useHref, useParams } from 'react-router-dom'
import { Header } from '../../layout/SiteHeader'
import { BackLink } from '../../layout/Navigation'
import { message } from '../../lib/errors'
import { difficulty, flockCount, flockDuration, GUESS_MS, makeFlock, MAX_GUESS, otherSide, READY_MS, REVEAL_MS, tempo, type Side } from './engine'
import { joinSheepRoom, nextSheepRound, sendGuess, settleSheepRound, sheepRematch, startSheepMatch, syncClock, waitForUser, watchSheepRoom, type Clock, type SheepRoom } from './online'
import { SheepStage, type StageMood } from './Stage'
import { SheepSound } from './sound'
import './sheep.css'

const seconds = (ms: number) => Math.max(0, Math.ceil(ms / 1000))
const percent = (ratio: number) => Math.min(1, Math.max(0, ratio)) * 100

export default function SheepRoomPage() {
  const code = (useParams().codigo ?? '').toUpperCase()
  return <SheepRoomSession key={code} code={code}/>
}

function SheepRoomSession({ code }: { code: string }) {
  const inviteHref = useHref('/jogos/ovelhas/sala/' + code)
  const [room, setRoom] = useState<SheepRoom | null>(null)
  const [clock, setClock] = useState<Clock | null>(null)
  const [uid, setUid] = useState('')
  const [side, setSide] = useState<Side>('p1')
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const [connectAttempt, reconnect] = useState(0)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [copied, setCopied] = useState(false)
  const [audible, setAudible] = useState(true)
  const [audioReady, setAudioReady] = useState(false)
  const sound = useRef<SheepSound | null>(null)
  const [, tick] = useState(0)

  useEffect(() => {
    let active = true
    let stop: (() => void) | undefined
    async function connect() {
      try {
        const user = await waitForUser()
        if (!active) return
        const [member, synced] = await Promise.all([joinSheepRoom(code, user.uid), syncClock(user.uid)])
        if (!active) return
        setUid(user.uid); setSide(member); setClock(synced)
        stop = watchSheepRoom(code, (next, cached) => { setRoom(next); setOffline(cached) }, e => {
          setOffline(true); setError(message(e))
        })
      } catch (e) { if (active) setError(message(e)) }
    }
    void connect()
    return () => { active = false; stop?.() }
  }, [code, connectAttempt])

  const phase = room?.phase, round = room?.round ?? 0, seed = room?.seed ?? 0
  const version = room?.flockVersion ?? 1
  const anchor = room?.anchor.toMillis() ?? 0
  const startsAt = anchor + READY_MS
  const duration = flockDuration(round, version)
  const bpm = tempo(round, version)
  const guessesAt = startsAt + duration
  const deadline = guessesAt + GUESS_MS
  const flock = useMemo(() => round ? makeFlock(seed, round, version) : [], [seed, round, version])
  const now = clock?.now ?? Date.now
  const time = now()
  const bothMissed = !!room?.last && room.last.p1 === null && room.last.p2 === null

  useEffect(() => {
    if (phase !== 'run' && phase !== 'result') return
    const timer = window.setInterval(() => tick(x => x + 1), 90)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (!clock || !room || offline) return
    const waitingForGuesses = room.phase === 'run' && !(room.sent.p1 && room.sent.p2)
    const readyAt = room.phase === 'run' ? (waitingForGuesses ? deadline + 300 : 0) : anchor + REVEAL_MS + 300
    if (room.phase !== 'run' && (room.phase !== 'result' || bothMissed)) return
    let alive = true, tries = 0, timer: number
    async function advance() {
      if (!alive || !room || !clock) return
      try {
        if (room.phase === 'run') await settleSheepRound(code, room, clock)
        else await nextSheepRound(code, room, clock)
      } catch (e) {
        if (!alive) return
        if (++tries < 5) timer = window.setTimeout(() => void advance(), 850)
        else setError(message(e))
      }
    }
    timer = window.setTimeout(() => void advance(), Math.max(0, readyAt - clock.now()))
    return () => { alive = false; window.clearTimeout(timer) }
  }, [anchor, bothMissed, clock, code, deadline, offline, room])

  useEffect(() => {
    if (!audible) return
    const activate = () => {
      const player = sound.current ??= new SheepSound()
      void player.enable().then(() => setAudioReady(true)).catch(() => setError('Não foi possível ativar o som neste navegador.'))
    }
    document.addEventListener('pointerdown', activate)
    document.addEventListener('keydown', activate)
    return () => {
      document.removeEventListener('pointerdown', activate)
      document.removeEventListener('keydown', activate)
    }
  }, [audible])

  useEffect(() => {
    const player = sound.current
    if (!audible || !audioReady || !clock || !player) return
    if (phase === 'run') {
      if (clock.now() < startsAt) player.play('ready')
      player.startRound(clock.now, startsAt, duration, bpm, flock)
    } else if (phase === 'result' || phase === 'finished') {
      const total = flockCount(seed, round, version), other = otherSide(side)
      const errorOf = (guess: number | null | undefined) => guess == null ? 100 : Math.abs(total - guess)
      const own = errorOf(side === 'p1' ? room?.last?.p1 : room?.last?.p2)
      const rival = errorOf(other === 'p1' ? room?.last?.p1 : room?.last?.p2)
      player.play(own === rival ? 'tie' : own < rival ? 'win' : 'lost')
    }
    return () => player.stopRound()
  }, [audible, audioReady, bpm, clock, duration, flock, phase, room?.last?.p1, room?.last?.p2, round, seed, side, startsAt, version])
  useEffect(() => () => sound.current?.close(), [])

  async function toggleSound() {
    if (audible) { sound.current?.mute(); setAudible(false); return }
    try {
      const player = sound.current ??= new SheepSound()
      await player.enable(); player.play('click'); setAudible(true); setAudioReady(true)
    } catch { setError('Não foi possível ativar o som neste navegador.') }
  }

  async function act(task: () => Promise<void>) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try { await task() }
    catch (e) { setError(message(e)) }
    finally { locked.current = false; setBusy(false) }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(inviteHref, location.href).href)
      setCopied(true)
    } catch { setError('Não deu para copiar. Compartilhe o código que aparece na sala.') }
  }
  function retryConnection() { setError(''); reconnect(n => n + 1) }

  if (!room || !clock) return <main className="page-shell sheep-shell">
    <Header compact/>
    <section className="room-loading">
      <span className="loading-mark" aria-hidden="true">☾</span>
      <h1>{error ? 'Cadê o rebanho?' : 'Arrumando a cama…'}</h1>
      {error && <><p role="alert">{error}</p><button className="button button-outline" onClick={retryConnection}>Tentar novamente</button></>}
      <p><BackLink to="/jogos/ovelhas" label="Voltar a Conta, Ovelha!"/></p>
    </section>
  </main>

  const other = otherSide(side)
  const mood: StageMood = phase === 'waiting' ? 'idle' : phase !== 'run' ? 'result' : time < startsAt ? 'ready' : time < guessesAt ? 'count' : 'guess'
  const stageText = mood === 'ready' ? 'Vai começar' : mood === 'count' ? 'Conte as ovelhas!' : mood === 'guess' ? 'Hora do palpite' : 'Noite de contagem'
  const total = round ? flockCount(seed, round, version) : 0
  const canAdvance = time >= anchor + REVEAL_MS

  return <main className="page-shell sheep-shell">
    <Header compact/>
    <div className="sheep-room-nav">
      <BackLink to="/jogos/ovelhas" label="Voltar a Conta, Ovelha!"/>
      <button className="sheep-quiet" onClick={() => void toggleSound()} aria-pressed={audible}>{audible ? '♫ Som ligado' : '♪ Ativar som'}</button>
    </div>
    <div className="sheep-hud">
      <Hearts label="Você" lives={room.lives[side]} side={side}/>
      <div className="sheep-round"><span>{phase === 'waiting' ? 'MODO' : 'RODADA'}</span><strong>{phase === 'waiting' ? '☾' : String(round).padStart(2, '0')}</strong></div>
      <Hearts label="Outra pessoa" lives={room.lives[other]} side={other}/>
    </div>
    <div className="sheep-frame">
      <div className="sheep-stage-bar"><span><i/> {stageText}</span><span>{round ? `♫ ${bpm} BPM` : '☾ TURNO DA NOITE'}</span></div>
      <div className="sheep-stage">
        <SheepStage mood={mood} flock={flock} startsAt={startsAt} now={now}/>
        {mood === 'ready' && <div className="sheep-countdown" aria-label="Contagem para começar">
          <small>A SONECA VAI COMEÇAR</small><strong>{Math.min(3, seconds(startsAt - time))}</strong><span>Olhos no campo!</span>
        </div>}
      </div>
      <div className="sheep-timer" aria-hidden="true"><span style={{ width: mood === 'count' ? `${percent((guessesAt - time) / duration)}%` : mood === 'guess' ? `${percent((deadline - time) / GUESS_MS)}%` : '100%' }}/></div>
    </div>

    {phase === 'waiting' && <section className="sheep-panel sheep-waiting">
      <div><span className="eyebrow">CÓDIGO DA SALA</span><h1>{code}</h1><p>{room.guest ? 'O rebanho está pronto. É só começar!' : 'Mande o convite para a outra pessoa.'}</p></div>
      <div className="sheep-panel-actions">
        <button className="button button-outline" onClick={() => void copyLink()}>{copied ? 'Link copiado ✓' : 'Copiar convite'}</button>
        {side === 'p1' ? <button className="button button-primary" disabled={!room.guest || busy || offline} onClick={() => void act(() => startSheepMatch(code, uid))}>Começar <span aria-hidden="true">→</span></button> : <span className="sheep-wait-text">Esperando quem criou a sala começar…</span>}
      </div>
    </section>}
    {phase === 'run' && mood !== 'guess' && <section className="sheep-panel sheep-instruction">
      <div><span className="eyebrow">{version === 4 && difficulty(round) >= 6 ? 'CHUTE DE MESTRE' : difficulty(round) >= 3 && version >= 2 ? 'OLHO NAS MEIAS-VOLTAS' : 'CADA OVELHA CONTA'}</span><h1>{mood === 'ready' ? 'Preparando a soneca…' : 'Olhos nas ovelhas!'}</h1></div>
      <p>{version === 4 && difficulty(round) >= 6 ? 'Agora vale estimar: conte o que conseguir e vá no seu melhor palpite!' : 'Conte cada ovelha quando ela entrar. Se der meia-volta, continua valendo uma só.'}</p>
    </section>}
    {phase === 'run' && mood === 'guess' && <GuessPanel key={`${room.match}_${round}`} remaining={seconds(deadline - time)}
      sent={room.sent[side]} rivalSent={room.sent[other]} busy={busy || offline}
      onGuess={guess => void act(async () => { await sendGuess(code, uid, room, guess); if (audible) sound.current?.play('click') })}/>}
    {(phase === 'result' || phase === 'finished') && room.last && <ResultPanel room={room} side={side} total={total}
      busy={busy || offline} remaining={seconds(anchor + REVEAL_MS - time)}
      next={() => void act(() => nextSheepRound(code, room, clock))} canAdvance={canAdvance}
      rematch={() => void act(() => sheepRematch(code, uid, room.match))}/>}
    {offline && <p className="connection-banner">Reconectando à sala… <button className="sheep-quiet" onClick={retryConnection}>Tentar agora</button></p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <p className="sheep-foot">☾ Mesmo rebanho, dois palpites. <span>SALA {code}</span></p>
  </main>
}

function Hearts({ label, lives, side }: { label: string; lives: number; side: Side }) {
  return <div className={`sheep-hearts sheep-hearts-${side}`}>
    <span>{label}</span>
    <div className="hearts-row" aria-label={`${lives} de 3 vidas`}>{[0, 1, 2].map(i => <span key={i} className={i < lives ? '' : 'heart-empty'} aria-hidden="true">♥</span>)}</div>
  </div>
}

function GuessPanel({ remaining, sent, rivalSent, busy, onGuess }: { remaining: number; sent: boolean; rivalSent: boolean; busy: boolean; onGuess: (n: number) => void }) {
  const [value, setValue] = useState('')
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { panel.current?.scrollIntoView({ block: 'nearest' }) }, [])
  const enabled = remaining > 0 && !sent && !busy
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enabled && value !== '' && +value <= MAX_GUESS) onGuess(+value)
  }
  return <section ref={panel} className="sheep-panel sheep-guess">
    <div><span className="eyebrow">PALPITES EM SEGREDO</span><h1>{sent ? 'Palpite guardado!' : remaining ? 'Quantas passaram?' : 'O tempo acabou!'}</h1>
      <p>{sent ? 'Esperando a revelação.' : rivalSent ? 'A outra pessoa já respondeu.' : 'Seu número só aparece no resultado.'}</p></div>
    {!sent && remaining > 0 && <form onSubmit={submit} className="sheep-guess-form">
      <label className="sr-only" htmlFor="sheep-guess">Seu palpite</label>
      <input id="sheep-guess" inputMode="numeric" autoComplete="off" placeholder="?" value={value} maxLength={2} disabled={!enabled}
        onChange={e => setValue(e.target.value.replace(/\D/g, ''))}/>
      <button className="button button-primary" disabled={!enabled || value === ''}>{busy ? 'Enviando…' : 'Confirmar'}</button>
    </form>}
    <span className="sheep-clock" aria-label={`${remaining} segundos restantes`}>{remaining}s</span>
  </section>
}

function ResultPanel({ room, side, total, remaining, busy, canAdvance, next, rematch }: {
  room: SheepRoom; side: Side; total: number; remaining: number; busy: boolean; canAdvance: boolean; next: () => void; rematch: () => void
}) {
  const other = otherSide(side), guesses = room.last!
  const distance = (guess: number | null) => guess === null ? 100 : Math.abs(guess - total)
  const ownDistance = distance(guesses[side]), rivalDistance = distance(guesses[other])
  const finished = room.phase === 'finished'
  const paused = guesses.p1 === null && guesses.p2 === null
  const title = finished ? room.lives[side] ? 'Você venceu!' : 'O rebanho te pegou!' : ownDistance === rivalDistance
    ? paused ? 'Ninguém deu palpite' : 'Empate! Vidas intactas' : ownDistance < rivalDistance ? 'Coração salvo!' : 'Você perdeu uma vida'
  return <section className="sheep-panel sheep-result" aria-live="polite">
    <div className="sheep-result-number"><span>PASSARAM</span><strong>{total}</strong><small>ovelhas</small></div>
    <div className="sheep-result-copy"><span className="eyebrow">{finished ? 'FIM DA SONECA' : 'CONTAGEM REVELADA'}</span><h1>{title}</h1>
      <p>Você: <b>{guesses[side] ?? 'sem palpite'}</b> <span aria-hidden="true">·</span> Outra pessoa: <b>{guesses[other] ?? 'sem palpite'}</b></p>
    </div>
    {finished ? <button className="button button-primary" disabled={busy || room.replay[side]} onClick={rematch}>{room.replay[side] ? 'Esperando revanche…' : 'Revanche ↻'}</button>
      : paused ? <button className="button button-outline" disabled={busy || !canAdvance} onClick={next}>Próxima rodada →</button>
      : <span className="sheep-clock" title="Próxima rodada">{remaining ? `${remaining}s` : '…'}</span>}
  </section>
}
