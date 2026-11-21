import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { duelCursor, type Duel } from './engine'
import { message } from '../../lib/errors'

export default function DuelDialog({ duel, confirmed, opponentConfirmed, onSubmit }: { duel: Duel; confirmed: boolean; opponentConfirmed: boolean; onSubmit: (position: number | null) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const marker = useRef<HTMLSpanElement>(null)
  const start = useRef(0)
  const stopped = useRef(confirmed)
  const [phase, setPhase] = useState<'active' | 'stopped'>(confirmed ? 'stopped' : 'active')
  const [seconds, setSeconds] = useState(10)
  const [position, setPosition] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const submitRef = useRef(onSubmit)
  useEffect(() => { submitRef.current = onSubmit }, [onSubmit])

  useLayoutEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  useLayoutEffect(() => {
    let frame = 0
    let active = true
    start.current = performance.now()
    function animate(now: number) {
      if (!active || stopped.current) return
      const elapsed = now - start.current
      if (marker.current) marker.current.style.left = `${duelCursor(elapsed, duel.periodMs) * 100}%`
      setSeconds(Math.max(0, Math.ceil((10000 - elapsed) / 1000)))
      if (elapsed >= 10000) {
        stopped.current = true; setPhase('stopped')
        setSending(true)
        void submitRef.current(null).catch((e) => setError(message(e))).finally(() => setSending(false))
        return
      }
      frame = requestAnimationFrame(animate)
    }
    if (!stopped.current) frame = requestAnimationFrame(animate)
    return () => { active = false; cancelAnimationFrame(frame) }
  // Every stage mounts a fresh component. Opponent updates must not restart its clock.
  }, [duel.periodMs])

  const stop = useCallback(async () => {
    if (phase !== 'active' || stopped.current) return
    stopped.current = true
    const hit = duelCursor(performance.now() - start.current, duel.periodMs)
    setPosition(hit); setPhase('stopped'); setSending(true)
    if (marker.current) marker.current.style.left = `${hit * 100}%`
    try { await submitRef.current(hit) } catch (e) { setError(message(e)) } finally { setSending(false) }
  }, [phase, duel.periodMs])
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.repeat) return
      if (event.code === 'Space' || event.key === 'Enter') { event.preventDefault(); void stop() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [stop])

  const hit = position !== null && Math.abs(position - duel.center) <= duel.width / 2
  return <dialog ref={dialog} className="game-dialog duel-dialog" aria-labelledby="duel-title" onCancel={(e) => e.preventDefault()}>
    <span className="eyebrow">CRISTAL EM DISPUTA · DUELO {duel.stage + 1}</span>
    <div className="duel-versus" aria-hidden="true"><span>1</span><b>⚡</b><span>2</span></div>
    <h2 id="duel-title">{duel.stage ? 'Mais rápido!' : 'Duelo de precisão'}</h2>
    <p>{duel.stage ? 'O duelo continua: novo alvo, mais velocidade.' : 'Pare o marcador no centro do alvo. Quem chegar mais perto vence.'}</p>
    <div className="qte-track" aria-label="Barra de precisão"><span className="qte-zone" style={{left:`${(duel.center - duel.width / 2) * 100}%`,width:`${duel.width * 100}%`}}/><span className="qte-center" style={{left:`${duel.center * 100}%`}}/><span className="qte-marker" ref={marker}/></div>
    <div className="qte-status" aria-live="polite">{phase === 'active' ? `${seconds}s · mire no centro!` : position === null ? confirmed ? 'Tentativa guardada!' : 'Tempo esgotado!' : hit ? 'Na faixa! Será que os dois acertaram?' : `Parou a ${(Math.abs(position - duel.center) * 100).toFixed(1)}% do centro.`}</div>
    <button className="button button-primary qte-stop full-button" disabled={phase !== 'active'} onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); void stop() } }} onClick={() => void stop()}>{phase === 'stopped' ? 'Marcador parado ✓' : 'PARAR!'}</button>
    <p className="qte-help">Toque ou use Espaço / Enter.<br/>Se os dois acertarem a faixa, ela muda e o duelo acelera.</p>
    {phase === 'stopped' && <p className="duel-wait">{sending ? 'Guardando sua tentativa…' : opponentConfirmed ? 'Revelando o resultado…' : 'Aguardando a tentativa da outra pessoa…'}</p>}
    {error && <><p className="inline-error" role="alert">{error}</p><button className="button button-outline full-button" disabled={sending} onClick={async () => { setSending(true); setError(''); try { await onSubmit(position) } catch (e) { setError(message(e)) } finally { setSending(false) } }}>Tentar enviar novamente</button></>}
  </dialog>
}
