import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Header } from '../../layout/SiteHeader'
import { joinRoom, openCell, roomState, type Snapshot, type Runner } from './online'
import { beat, cleared, unlock } from './sound'
import './minas.css'

export default function Room() {
  const code = (useParams().codigo ?? '').toUpperCase()
  return <RaceView key={code} code={code}/>
}
function RaceView({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const { room, player, seat = 0 } = snapshot ?? {}
  const [offset, setOffset] = useState(0), [now, setNow] = useState(Date.now)
  const [error, setError] = useState(''), [muted, setMuted] = useState(false)
  const [copied, setCopied] = useState(false), [retry, setRetry] = useState(0)
  const busyRevision = useRef(-1), previous = useRef<Runner | undefined>(undefined)
  const board = useRef<HTMLDivElement>(null)
  const update = useCallback((next: Snapshot) => {
    setSnapshot(current => {
      if (current && (next.version < current.version ||
        (next.version === current.version && next.now < current.now))) return current
      return next
    })
  }, [])
  useEffect(() => {
    let active = true, timer: ReturnType<typeof setTimeout>
    async function poll(joining: boolean) {
      try {
        const sent = Date.now()
        const next = await (joining ? joinRoom(code) : roomState(code))
        if (!active) return
        setOffset(next.now - (sent + Date.now()) / 2)
        update(next)
        if (next.room.phase === 'finished') return
      } catch (error) {
        if (active) setError((error as Error).message)
        return
      }
      timer = setTimeout(() => void poll(false), document.hidden ? 4000 : 1000)
    }
    void poll(true)
    return () => { active = false; clearTimeout(timer) }
  }, [code, retry, update])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), 125)
    return () => clearInterval(timer)
  }, [offset])
  const live = !!room && ['running','overtime'].includes(room.phase) && now >= room.starts
  useEffect(() => {
    if (!live || muted) return
    let step = 0
    const id = setInterval(() => beat(step++ % 4 === 0 ? 135 : 220, .08, .028), 480)
    return () => clearInterval(id)
  }, [live, muted])
  useEffect(() => {
    if (!player || !board.current) return
    const prior = previous.current
    if (prior?.revision !== player.revision) {
      const bomb = player.bomb >= 0
      const target = board.current.querySelector<HTMLElement>('[data-cell="' + (bomb ? player.bomb : player.last) + '"]')
      if (target) {
        const box = board.current.getBoundingClientRect(), cell = target.getBoundingClientRect()
        if (cell.top < box.top || cell.bottom > box.bottom) board.current.scrollTop += cell.top - box.top - box.height / 2
        if (cell.left < box.left || cell.right > box.right) board.current.scrollLeft += cell.left - box.left - box.width / 2
      }
      if (prior && !muted) {
        if (prior.stage < player.stage) cleared()
        else if (bomb) beat(100, .48, .15, true)
        else beat(300, .12, .07)
      }
      previous.current = player
    }
  }, [player, muted, room?.phase])
  const blocked = !!player && now < player.blockedUntil
  async function open(cell: number) {
    if (!player || busyRevision.current === player.revision) return
    const revision = player.revision
    busyRevision.current = revision
    try { update(await openCell(code, cell, revision)) }
    catch (e) { setError((e as Error).message) }
    finally { if (busyRevision.current === revision) busyRevision.current = -1 }
  }
  const seconds = room ? Math.max(0, Math.ceil((room.ends - now) / 1000)) : 0
  const tied = room && room.scores[0] === room.scores[1]
  return <main className="page-shell mine-page" onPointerDown={unlock} onKeyDown={unlock}><Header compact/>
    <div className="mine-title"><h1>Campo Minado x1</h1><button className="button button-outline" aria-pressed={muted} onClick={() => { if (!muted) window.speechSynthesis?.cancel(); setMuted(!muted) }}>{muted ? 'Ativar som' : 'Silenciar'}</button></div>
    {error && <p role="alert">{error} <button onClick={() => { setError(''); setRetry(r => r + 1) }}>Tentar novamente</button></p>}
    {!room && !error && <p>Entrando na sala…</p>}
    {room?.phase === 'waiting' && <section className="mine-intro"><h2>Convide seu rival</h2><p>A corrida começa quando a outra pessoa entrar.</p><strong className="mine-code">{code}</strong><button className="button button-primary" onClick={() => navigator.clipboard.writeText(location.href).then(() => setCopied(true)).catch(() => setError('Compartilhe o código acima.'))}>{copied ? 'Link copiado' : 'Copiar convite'}</button></section>}
    {room && room.phase !== 'waiting' && player && <>
      <div className="mine-score"><strong>{room.phase === 'overtime' ? 'Prorrogação' : Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')}</strong><span>Você <b>{room.scores[seat]}</b></span><span>Rival <b>{room.scores[1-seat]}</b></span></div>
      {room.phase === 'finished' ? <section className="mine-intro"><h2>{room.winner === seat ? 'Você venceu!' : 'O rival venceu!'}</h2><Link className="button button-primary" to="/jogos/minas">Nova corrida</Link></section> : <>
      <div className="mine-status" role="status"><strong>Campo {player.stage}</strong> · {now < room.starts ? 'Largada em ' + Math.ceil((room.starts-now)/1000) + ' s' : blocked ? 'Explosão! Aguarde ' + Math.ceil((player.blockedUntil-now)/1000) + ' s' : room.phase === 'overtime' ? 'A próxima travessia vence!' : seconds <= 10 && tied ? 'Empate leva à prorrogação!' : 'Avance até as bandeiras.'}</div>
      <div className="mine-scroll" ref={board}><div className="mine-grid" style={{ gridTemplateColumns: 'repeat(' + player.cols + ', 44px)' }}>
      <div className="mine-flags" aria-label="Chegada">{'⚑ '.repeat(player.cols)}</div>
      {Array.from({ length: player.rows * player.cols }, (_, i) => {
        const clue = player.open[i], col = i % player.cols
        const adjacent = [i-player.cols, i+player.cols, col ? i-1 : -1, col < player.cols-1 ? i+1 : -1].some(n => player.open[n] !== undefined)
        const available = clue === undefined && adjacent
        return <button key={i} data-cell={i} className={clue !== undefined ? 'revealed' : blocked && i === player.bomb ? 'exploded' : available ? 'available' : ''}
          disabled={!available || !live || blocked} aria-label={'Linha ' + (Math.floor(i/player.cols)+1) + ', coluna ' + (col+1) + ', ' + (clue ?? (available ? 'disponível' : 'fechada'))}
          onClick={e => { if (e.detail < 2) void open(i) }}>{clue ?? (blocked && player.bomb === i ? '✹' : '')}</button>
      })}</div></div></>}
    </>}
  </main>
}
