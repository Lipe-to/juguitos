import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Header } from '../../layout/SiteHeader'
import { joinRoom, openCell, roomState, setFlag, startRace, type Snapshot, type Runner } from './online'
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
  const [copied, setCopied] = useState(false), [retry, setRetry] = useState(0), [flagMode, setFlagMode] = useState(false)
  const [startBusy, setStartBusy] = useState(false)
  const busyRevision = useRef(-1), busyFlags = useRef(new Set<number>()), previous = useRef<Runner | undefined>(undefined)
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
      } catch (e) {
        if (active) setError((e as Error).message)
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
  const live = !!room && ['running', 'overtime'].includes(room.phase) && now >= room.starts
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
  async function toggleFlag(cell: number) {
    if (!player || !live || blocked || busyFlags.current.has(cell)) return
    busyFlags.current.add(cell)
    try { update(await setFlag(code, cell, !player.flags[cell])) }
    catch (e) { setError((e as Error).message) }
    finally { busyFlags.current.delete(cell) }
  }
  async function start() {
    if (startBusy) return
    setStartBusy(true)
    try { update(await startRace(code)); setError('') }
    catch (e) { setError((e as Error).message) }
    finally { setStartBusy(false) }
  }
  const seconds = room ? Math.max(0, Math.ceil((room.ends - now) / 1000)) : 0
  const tied = room && room.scores[0] === room.scores[1]
  const canFlag = live && !blocked

  return <main className="page-shell mine-page" onPointerDown={unlock} onKeyDown={unlock}><Header compact/>
    <div className="mine-title"><h1>Campo Minado <span>x1</span></h1><button className="button button-outline" aria-pressed={muted} onClick={() => { if (!muted) window.speechSynthesis?.cancel(); setMuted(!muted) }}>{muted ? 'Ativar som' : 'Silenciar'}</button></div>
    {error && <p className="mine-error" role="alert">{error} <button className="button button-outline" onClick={() => { setError(''); setRetry(r => r + 1) }}>Tentar novamente</button></p>}
    {!room && !error && <p className="mine-loading" role="status">Conectando à sala…</p>}
    {room?.phase === 'waiting' && <section className="mine-lobby mine-intro" aria-labelledby="mine-lobby-title">
      <span className="eyebrow">SALA DE ESPERA · {code}</span><h2 id="mine-lobby-title">Convide seu rival</h2>
      <p>Quando as duas vagas estiverem ocupadas, quem criou a sala pode iniciar a contagem regressiva. A vaga deste jogador fica salva neste navegador.</p>
      <button className="mine-invite" onClick={() => navigator.clipboard.writeText(location.href).then(() => setCopied(true)).catch(() => setError('Não foi possível copiar. Compartilhe o código ' + code + '.'))}>{copied ? 'Link copiado ✓' : 'Copiar link da sala'}</button>
      <div className="mine-seats" aria-label="Jogadores na sala">
        <div className="mine-seat"><span className="mine-avatar">1</span><span><b>Jogador 1 · Anfitrião</b><small>{seat === 0 ? 'Sua vaga' : 'Vaga ocupada'}</small></span><strong aria-label="Vaga ocupada">●</strong></div>
        <div className="mine-seat"><span className="mine-avatar mine-avatar-guest">2</span><span><b>Jogador 2</b><small>{snapshot && seat === 1 ? 'Sua vaga' : room.playerCount > 1 ? 'Vaga ocupada' : 'Aguardando o rival entrar…'}</small></span><strong className={room.playerCount > 1 ? '' : 'mine-seat-empty'} aria-label={room.playerCount > 1 ? 'Vaga ocupada' : 'Vaga livre'}>{room.playerCount > 1 ? '●' : '○'}</strong></div>
      </div>
      {seat === 0 ? <button className="button button-primary mine-full-button" disabled={startBusy || !snapshot || room.playerCount < 2} onClick={() => void start()}>{startBusy ? 'Preparando a largada…' : room.playerCount >= 2 ? 'Iniciar partida' : 'Aguardando o segundo jogador'}</button> : <p className="mine-waiting-note" role="status">Você entrou. O anfitrião iniciará a partida quando estiver pronto.</p>}
    </section>}
    {room && room.phase !== 'waiting' && player && <>
      <div className="mine-score" aria-label="Placar"><strong>{room.phase === 'overtime' ? 'Prorrogação' : Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')}</strong><span>Jogador {seat + 1} <b>{room.scores[seat]}</b></span><span>Jogador {2 - seat} <b>{room.scores[1-seat]}</b></span></div>
      {room.phase === 'finished' ? <section className="mine-intro mine-result"><h2>{room.winner === seat ? 'Você venceu!' : 'O rival venceu!'}</h2><p>Placar final: {room.scores[0]} a {room.scores[1]} campos.</p><Link className="button button-primary" to="/jogos/minas">Nova corrida</Link></section> : <>
        <div className="mine-status" role="status"><strong>Campo {player.stage}</strong> · {room.phase === 'countdown' ? 'Largada em ' + Math.max(0, Math.ceil((room.starts-now)/1000)) + ' s' : blocked ? 'Explosão! Aguarde ' + Math.ceil((player.blockedUntil-now)/1000) + ' s' : room.phase === 'overtime' ? 'A próxima travessia vence!' : seconds <= 10 && tied ? 'Empate leva à prorrogação!' : 'Avance até as bandeiras.'}</div>
        <div className="mine-controls"><button className={'button ' + (flagMode ? 'button-primary' : 'button-outline')} aria-pressed={flagMode} disabled={!canFlag} onClick={() => setFlagMode(v => !v)}>{flagMode ? 'Modo bandeira ligado ⚑' : 'Modo bandeira ⚑'}</button><span>Botão direito ou toque no modo bandeira · tecla F marca/desmarca</span></div>
        <div className="mine-legend" aria-label="Legenda do campo"><span><i className="legend-closed"/> Fechada</span><span><i className="legend-open"/> Revelada</span><span><i className="legend-ready"/> Próximo passo</span><span><i className="legend-flag"/> Bandeira</span></div>
        <div className="mine-scroll" ref={board} role="region" aria-label="Campo de minas. Deslize para navegar pelo tabuleiro." tabIndex={0}><div className="mine-grid" style={{ gridTemplateColumns: 'repeat(' + player.cols + ', minmax(44px, 1fr))', width: 'min(100%, calc(' + player.cols + ' * 64px + 16px))' }}>
          <div className="mine-flags" aria-label="Chegada">{Array.from({ length: player.cols }, (_, i) => <span key={i} aria-hidden="true">⚑</span>)}</div>
          {Array.from({ length: player.rows * player.cols }, (_, i) => {
            const clue = player.open[i], col = i % player.cols, flagged = !!player.flags[i]
            const adjacent = [i-player.cols, i+player.cols, col ? i-1 : -1, col < player.cols-1 ? i+1 : -1].some(n => player.open[n] !== undefined)
            const available = clue === undefined && !flagged && adjacent && (player.steps > 0 || i === player.firstStep)
            const firstStep = player.steps === 0 && i === player.firstStep
            const state = clue !== undefined ? 'revealed' : blocked && i === player.bomb ? 'exploded' : flagged ? 'flagged' : firstStep ? 'first-step' : available ? 'available' : 'closed'
            const label = clue !== undefined ? 'revelada, ' + (clue === 0 ? 'zero minas vizinhas' : clue + ' minas vizinhas') : blocked && player.bomb === i ? 'mina que explodiu' : flagged ? 'marcada com bandeira' : firstStep ? 'saída segura inicial' : available ? 'próximo passo disponível' : 'fechada'
            const activate = () => {
              if (flagMode) void toggleFlag(i)
              else if (flagged) return
              else if (available && live && !blocked) void open(i)
            }
            return <button key={i} type="button" data-cell={i} className={'mine-cell ' + state}
              aria-label={'Linha ' + (Math.floor(i/player.cols)+1) + ', coluna ' + (col+1) + ', ' + label}
              disabled={!live || blocked || clue !== undefined}
              onContextMenu={e => { e.preventDefault(); if (clue === undefined) void toggleFlag(i) }}
              onKeyDown={e => { if (e.key.toLowerCase() === 'f' && clue === undefined) { e.preventDefault(); void toggleFlag(i) } }}
              onClick={activate}>{clue ?? (flagged ? '⚑' : blocked && player.bomb === i ? '✹' : firstStep ? '↗' : '')}</button>
          })}
        </div></div>
      </>}
    </>}
  </main>
}
