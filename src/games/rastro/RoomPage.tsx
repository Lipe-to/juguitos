import { useEffect, useMemo, useState } from 'react'
import { Link, useHref, useParams } from 'react-router-dom'
import { Header } from '../../layout/SiteHeader'
import { actionLabel, message } from '../../lib/errors'
import { DEFAULT_TARGET_SCORE, MAP_WALLS, normalizeAction, positionsEqual, type Action, type Direction, type PlayerId } from './engine'
import type { Room } from './multiplayer'
import DuelDialog from './DuelDialog'
import DuelResultDialog from './DuelResultDialog'

const directions: { direction: Direction; label: string; symbol: string }[] = [
  { direction: 'up', label: 'Cima', symbol: '↑' }, { direction: 'left', label: 'Esquerda', symbol: '←' },
  { direction: 'down', label: 'Baixo', symbol: '↓' }, { direction: 'right', label: 'Direita', symbol: '→' },
]
export default function RastroRoomPage() {
  const { codigo = '' } = useParams()
  const code = codigo.toUpperCase()
  const inviteHref = useHref('/jogos/rastro/sala/' + code)
  const [uid, setUid] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [slot, setSlot] = useState<PlayerId | null>(null)
  const [error, setError] = useState('')
  const [online, setOnline] = useState(true)
  const [action, setAction] = useState<Action>({ kind: 'stay' })
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [goal, setGoal] = useState(String(DEFAULT_TARGET_SCORE))
  const [dismissedDuel, setDismissedDuel] = useState('')
  const duelResultKey = room?.game?.lastDuel ? `${code}_${room.game.seed}_${room.game.lastDuel.turn}` : ''
  const duelResultOpen = !!slot && !!duelResultKey && dismissedDuel !== duelResultKey
    && !room?.game?.duel && room?.game?.lastDuel?.turn === (room?.game?.round ?? 0) - 1
  const overlayOpen = duelResultOpen

  useEffect(() => {
    let stop: (() => void) | undefined
    let active = true
    import('./multiplayer').then(async (multiplayer) => {
      const user = await multiplayer.waitForUser()
      if (!active) return
      setUid(user.uid)
      const player = await multiplayer.joinRoom(code, user.uid)
      if (!active) return
      setSlot(player)
      stop = multiplayer.subscribeRoom(code, (next) => { setRoom(next); setOnline(true); setError(next ? '' : 'Sala não encontrada.') }, (e) => { setOnline(false); setError(message(e)) })
    }).catch((e) => setError(message(e)))
    return () => { active = false; stop?.() }
  }, [code])

  useEffect(() => {
    if (room?.status === 'PLAYING' && room.confirmations.p1 && room.confirmations.p2) void import('./multiplayer').then(({ resolveIfReady }) => resolveIfReady(code)).catch((e) => setError(message(e)))
  }, [room, code])

  useEffect(() => {
    if (room?.game?.duel && room.duelConfirmations?.p1 && room.duelConfirmations.p2) void import('./multiplayer').then(({ resolveDuelIfReady }) => resolveDuelIfReady(code)).catch((e) => setError(message(e)))
  }, [room, code])

  useEffect(() => { setGoal(String(room?.targetScore ?? DEFAULT_TARGET_SCORE)) }, [room?.targetScore])
  useEffect(() => { setAction((a) => a.kind === 'move' ? { ...a, jump: false } : a) }, [room?.game?.round, room?.game?.seed])

  useEffect(() => {
    if (room?.status === 'FINISHED' && room.revenge.p1 && room.revenge.p2) void import('./multiplayer').then(({ beginRevengeIfReady }) => beginRevengeIfReady(code)).catch((e) => setError(message(e)))
  }, [room, code])

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || overlayOpen || room?.game?.duel || room?.status !== 'PLAYING' || busy) return
      if (slot && room?.confirmations[slot]) return
      const keys: Record<string, Direction> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }
      if (keys[event.key]) { event.preventDefault(); setAction({ kind: 'move', direction: keys[event.key] }) }
      else if (event.code === 'Space') { event.preventDefault(); setAction({ kind: 'stay' }) }
      else if (event.key.toLowerCase() === 'j' && slot && room.game?.jumps[slot]) setAction((a) => a.kind === 'move' ? { ...a, jump: !a.jump } : a)
      else if (event.key === 'Enter' && room?.status === 'PLAYING' && !room.confirmations[slot ?? 'p1']) void confirm()
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, slot, action, busy, overlayOpen])

  async function confirm() {
    if (!uid || busy || !slot || !room?.game || room.game.duel || overlayOpen) return
    setBusy(true); setError('')
    try { const { submitAction } = await import('./multiplayer'); await submitAction(code, uid, normalizeAction(action, room.game.jumps[slot])) }
    catch (e) { setError(message(e)) }
    finally { setBusy(false) }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(new URL(inviteHref, location.href).href); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { setError('Não foi possível copiar. Compartilhe o código da sala.') }
  }
  async function saveGoal() {
    const value = Number(goal)
    if (!Number.isInteger(value) || value < 5 || value > 100) { setError('Escolha uma meta de 5 a 100 pontos.'); return false }
    const { updateTargetScore } = await import('./multiplayer')
    if (value !== (room?.targetScore ?? DEFAULT_TARGET_SCORE)) await updateTargetScore(code, uid, value)
    return true
  }
  async function start() {
    if (!uid) return
    setBusy(true); setError('')
    try { if (await saveGoal()) { const { startRoom } = await import('./multiplayer'); await startRoom(code, uid) } } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function revenge() {
    if (!uid) return
    setBusy(true); setError('')
    try { const { requestRevenge } = await import('./multiplayer'); await requestRevenge(code, uid) } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }

  const myConfirmed = slot ? room?.confirmations[slot] ?? false : false
  const opponentSlot: PlayerId = slot === 'p1' ? 'p2' : 'p1'
  const opponentConfirmed = room?.confirmations[opponentSlot] ?? false
  const chosenDirection = action.kind === 'move' ? action.direction : null
  const isJump = action.kind === 'move' && !!action.jump && !!(slot && room?.game?.jumps[slot])
  const targetScore = room?.game?.targetScore ?? room?.targetScore ?? DEFAULT_TARGET_SCORE

  if (error && !room) return <main className="page-shell"><Header compact/><section className="room-loading"><span className="loading-mark">!</span><h1>Não deu para abrir a sala</h1><p>{error}</p><Link className="button button-outline" to="/">Voltar ao início</Link></section></main>
  if (!room || !slot) return <main className="page-shell"><Header compact/><section className="room-loading"><span className="loading-mark loading-spin">✳</span><h1>Preparando a sala</h1><p>{error || 'Só um instante…'}</p></section></main>

  if (room.status === 'WAITING') return <main className="page-shell">
    <Header compact/>
    <section className="waiting-panel">
      <Link to="/" className="back-link">← Catálogo</Link>
      <span className="eyebrow">SALA DE JOGO · RASTRO</span>
      <h1>{slot === 'p1' ? 'A sala está pronta.' : 'Você entrou na sala.'}</h1>
      <p>{room.players.p2 ? 'A pessoa que criou a sala vai iniciar a partida.' : 'Falta só a outra pessoa chegar.'}</p>
      <div className="room-code-label">CÓDIGO DA SALA</div>
      <button className="room-code" onClick={copyLink} title="Copiar link da sala">{code}<span>{copied ? 'Copiado!' : '⧉ Copiar link'}</span></button>
      <div className="waiting-players">
        <div className={`player-slot ${slot === 'p1' ? 'is-here' : ''}`}>
          <span className="player-avatar avatar-purple">1</span>
          <div><b>{slot === 'p1' ? 'Você' : 'Quem criou a sala'}</b><small>{slot === 'p1' ? 'Já está na sala' : 'Sala criada'}</small></div>
          {slot === 'p1' ? <i>✓</i> : <span className="slot-dots">···</span>}
        </div>
        <div className={`player-slot ${slot === 'p2' ? 'is-here' : ''}`}>
          <span className="player-avatar avatar-lilac">2</span>
          <div><b>{slot === 'p2' ? 'Você' : 'Convidado'}</b><small>{room.players.p2 ? slot === 'p2' ? 'Já está na sala' : 'Entrou na sala' : 'Aguardando chegada…'}</small></div>
          {room.players.p2 ? slot === 'p2' ? <i>✓</i> : <span className="slot-dots">···</span> : <span className="slot-dots">···</span>}
        </div>
      </div>
      <form className="match-settings" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await saveGoal() } catch (e) { setError(message(e)) } finally { setBusy(false) } }}>
        <label htmlFor="target-score"><b>Pontos para vencer</b><small>{room.creator === uid ? 'Escolha de 5 a 100 pontos' : 'O anfitrião escolhe a meta'}</small></label>
        <input id="target-score" type="number" min={5} max={100} step={1} value={goal} disabled={room.creator !== uid || busy} onChange={(e) => setGoal(e.target.value)} required/>
        {room.creator === uid && <button className="settings-save" disabled={busy || Number(goal) === (room.targetScore ?? DEFAULT_TARGET_SCORE)}>Salvar</button>}
      </form>
      {room.players.p2 && room.creator === uid
        ? <button className="button button-primary button-large full-button" disabled={busy} onClick={start}>Começar partida <span>↗</span></button>
        : <div className="waiting-message"><span className="pulse-dot"/> {room.players.p2 ? 'A pessoa que criou a sala já pode começar.' : 'Compartilhe o link para chamar alguém.'}</div>}
      {!online && <div className="connection-banner">Conexão instável. Tentando reconectar…</div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
  </main>

  if (!room.game) return <main className="page-shell"><Header compact/><section className="room-loading"><h1>Partida indisponível</h1><Link to="/">Voltar</Link></section></main>
  const game = room.game
  const isFinished = room.status === 'FINISHED' || game.finished
  const myName = slot === 'p1' ? 'Você' : 'Você'
  const opponentName = slot === 'p1' ? 'Convidado' : 'Quem criou a sala'
  const requestedRevenge = room.revenge[slot]

  return <main className="page-shell game-shell">
    <Header compact/><div className="game-page-head"><Link to="/" className="back-link">← Jogos</Link><h1 className="arena-title">RASTRO<span>.</span></h1><div className="game-room-id">SALA {code}</div></div>
    <div className="play-layout">
      <section className="board-panel">
        <div className="score-row"><ScoreCard label={myName} score={game.scores[slot]} color={slot === 'p1' ? 'purple' : 'lilac'} active={!myConfirmed && !isFinished} jumps={game.jumps[slot]}/><div className="round-count"><span>META</span><b>{targetScore}<small> pts</small></b></div><ScoreCard label={opponentName} score={game.scores[opponentSlot]} color={opponentSlot === 'p1' ? 'purple' : 'lilac'} active={!opponentConfirmed && !isFinished} jumps={game.jumps[opponentSlot]}/></div>
        {game.lastDuel?.turn === game.round - 1 && !isFinished && <div className="duel-result" role="status">{game.lastDuel.winner === slot ? 'Você venceu o duelo! +1 ponto' : 'A outra pessoa venceu o duelo. +1 ponto'} <span>⚡</span></div>}
        {isFinished && <div className="result-banner"><span className="result-spark">✳</span><div><b>{game.scores[slot] === game.scores[opponentSlot] ? 'Deu empate!' : game.scores[slot] > game.scores[opponentSlot] ? 'Você venceu!' : 'Boa partida!'}</b><small>{game.scores[slot] === game.scores[opponentSlot] ? 'Uma partida bem equilibrada.' : game.scores[slot] > game.scores[opponentSlot] ? 'Os cristais foram seus desta vez.' : 'A próxima pode ser diferente.'}</small></div><span className="final-score">{game.scores[slot]} <i>—</i> {game.scores[opponentSlot]}</span></div>}
        <Board game={game} player={slot} selected={chosenDirection} jump={isJump}/>
        <div className="board-legend"><span><i className="legend-wall"/> parede</span><span><i className="legend-trail"/> rastro</span><span><i className="legend-crystal"/> cristal +1</span><span><i className="legend-special"/> especial +2</span></div>
      </section>
      <aside className="controls-panel">
        {isFinished ? <><span className="eyebrow">FIM DE JOGO</span><h2>Mais uma?</h2><p className="control-hint">A revanche começa quando os dois aceitarem.</p><div className="revenge-status"><span className={requestedRevenge ? 'status-check done' : 'status-check'}>{requestedRevenge ? '✓' : '·'}</span><span>Você</span><b>{requestedRevenge ? 'aceitou' : 'ainda não aceitou'}</b></div><div className="revenge-status"><span className={room.revenge[opponentSlot] ? 'status-check done' : 'status-check'}>{room.revenge[opponentSlot] ? '✓' : '·'}</span><span>Outra pessoa</span><b>{room.revenge[opponentSlot] ? 'aceitou' : 'aguardando'}</b></div><button className="button button-primary button-large full-button" onClick={revenge} disabled={busy || requestedRevenge}>{requestedRevenge ? 'Pedido enviado ✓' : 'Pedir revanche'} <span>↗</span></button><Link className="catalog-link" to="/">Voltar ao catálogo</Link></>
      : <><span className="eyebrow">{myConfirmed ? 'JOGADA GUARDADA' : 'FAÇA SUA JOGADA'}</span><h2>{myConfirmed ? 'Agora é suspense…' : 'Pra onde vamos?'}</h2><p className="control-hint">Escolha seu caminho. Os dois movimentos são revelados juntos.</p><div className="direction-pad" aria-label="Escolha de movimento">{directions.map((item) => <button key={item.direction} disabled={myConfirmed || !!game.duel || overlayOpen || busy} className={`direction-button ${chosenDirection === item.direction ? 'selected' : ''}`} aria-label={item.label} aria-pressed={chosenDirection === item.direction} onClick={() => setAction({ kind: 'move', direction: item.direction, jump: isJump })}>{item.symbol}</button>)}<button disabled={myConfirmed || !!game.duel || overlayOpen || busy} className={`direction-button stay-button ${action.kind === 'stay' ? 'selected' : ''}`} aria-label="Permanecer parado" aria-pressed={action.kind === 'stay'} onClick={() => setAction({ kind: 'stay' })}>●</button></div><button className={`jump-card ${isJump ? 'jump-equipped' : ''}`} disabled={!game.jumps[slot] || action.kind === 'stay' || myConfirmed || !!game.duel || overlayOpen || busy} aria-pressed={isJump} onClick={() => setAction((a) => a.kind === 'move' ? { ...a, jump: !a.jump } : a)}><span className="jump-icon">↗</span><span><b>{isJump ? 'Salto equipado!' : 'Salto especial'}</b><small>{!game.jumps[slot] ? 'Já usado · siga andando' : action.kind === 'stay' ? 'Escolha uma direção primeiro' : 'Pule paredes e pessoas · 1 carga'}</small></span><span className="jump-badge">{!game.jumps[slot] ? '0/1' : isJump ? 'PRONTO' : '1/1'}</span></button><div className="selected-action"><span>SEU PLANO</span><b>{actionLabel(action)}</b><small>{myConfirmed ? 'Sua jogada está travada até a revelação.' : 'Pode mudar de ideia até confirmar.'}</small></div><button className="button button-primary button-large full-button confirm-button" disabled={busy || myConfirmed || !!game.duel || overlayOpen} onClick={confirm}>{myConfirmed ? 'Jogada confirmada ✓' : busy ? 'Enviando…' : 'Confirmar jogada'} {!myConfirmed && <span>→</span>}</button><div className="opponent-status"><span className={opponentConfirmed ? 'status-check done' : 'status-check'}>{opponentConfirmed ? '✓' : '·'}</span><span>{opponentConfirmed ? 'A outra pessoa já confirmou' : 'A outra pessoa está escolhendo'}</span></div><p className="keyboard-note">SETAS / WASD · ESPAÇO: PARAR<br/>J: SALTO · ENTER: CONFIRMAR</p></>}
        {!online && <div className="connection-banner">Conexão instável. Reconectando…</div>}{error && <p className="inline-error" role="alert">{error}</p>}
      </aside>
    </div>
    <footer className="game-footer"><span>Suas jogadas ficam em segredo até os dois confirmarem.</span><button onClick={copyLink}>{copied ? 'Link copiado ✓' : `Compartilhar sala ${code} ↗`}</button></footer>
    {duelResultOpen && game.lastDuel && <DuelResultDialog key={duelResultKey} won={game.lastDuel.winner === slot} score={game.scores[slot]} finished={isFinished} onContinue={() => setDismissedDuel(duelResultKey)}/>}
    {game.duel && <DuelDialog key={`${game.duel.id}_${game.duel.stage}`} duel={game.duel} confirmed={room.duelConfirmations?.[slot] ?? false} opponentConfirmed={room.duelConfirmations?.[opponentSlot] ?? false} onSubmit={async (position) => { const { submitDuelAttempt } = await import('./multiplayer'); await submitDuelAttempt(code, uid, game.duel!.id, game.duel!.stage, position) }}/>}
  </main>
}

function ScoreCard({ label, score, color, active, jumps }: { label: string; score: number; color: string; active: boolean; jumps: boolean }) {
  return <div className={`score-card score-card-${color} ${active ? 'score-active' : ''}`}><span className={`score-avatar score-${color}`}>{color === 'purple' ? '1' : '2'}</span><div><small>{label}</small><b>{score}<span> pts</span></b></div><span className={`jump-chip ${jumps ? 'jump-ready' : ''}`}>{jumps ? '↗ salto' : 'salto usado'}</span></div>
}

function Board({ game, player, selected, jump }: { game: NonNullable<Room['game']>; player: PlayerId; selected: Direction | null; jump: boolean }) {
  const trails = useMemo(() => new Set(game.trails.map((t) => `${t.x},${t.y}`)), [game.trails])
  const walls = useMemo(() => new Set(MAP_WALLS[game.mapId].map((p) => `${p.x},${p.y}`)), [game.mapId])
  const crystals = useMemo(() => new Map(game.crystals.map((c) => [`${c.x},${c.y}`, c])), [game.crystals])
  const cells = useMemo(() => Array.from({ length: 49 }, (_, i) => ({ x: i % 7, y: Math.floor(i / 7) })), [])
  const arrow = selected ? { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[selected] : null
  return <div className="board" role="grid" aria-label="Tabuleiro RASTRO">{cells.map((cell) => {
    const id = `${cell.x},${cell.y}`, p1 = positionsEqual(cell, game.positions.p1), p2 = positionsEqual(cell, game.positions.p2), crystal = crystals.get(id)
    const predicted = !!arrow && ((cell.x === game.positions[player].x + arrow[0] && cell.y === game.positions[player].y + arrow[1]) || (jump && cell.x === game.positions[player].x + arrow[0] * 2 && cell.y === game.positions[player].y + arrow[1] * 2))
    const classes = ['board-cell', (cell.x + cell.y) % 2 ? 'cell-shade' : '', walls.has(id) ? 'cell-wall' : '', trails.has(id) ? 'cell-trail' : '', p1 ? 'cell-p1' : '', p2 ? 'cell-p2' : '', predicted ? 'cell-predicted' : ''].filter(Boolean).join(' ')
    return <div className={classes} role="gridcell" key={id} aria-label={`${cell.x + 1}, ${cell.y + 1}${walls.has(id) ? ', parede' : ''}${crystal ? crystal.value === 2 ? ', cristal especial' : ', cristal' : ''}${p1 ? ', jogadora 1' : ''}${p2 ? ', jogadora 2' : ''}`}>
      {crystal && <span className={`crystal ${crystal.value === 2 ? 'crystal-special' : ''}`}>{crystal.value === 2 ? '✦' : '◆'}</span>}
      {trails.has(id) && <span className="trail-mark"/>}
      {p1 && <span className="player-piece piece-p1">1</span>}{p2 && <span className="player-piece piece-p2">2</span>}
    </div>
  })}</div>
}
