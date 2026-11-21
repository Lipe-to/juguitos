import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { firebaseReady, firebaseSetupMessage } from '../../firebase/config'
import { GameIntroLayout } from '../../layout/GameIntroLayout'
import { message } from '../../lib/errors'
import { DEFAULT_TARGET_SCORE } from './engine'
import TutorialDialog from './TutorialDialog'

export default function RastroIntroPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [guide, setGuide] = useState(false)
  const navigate = useNavigate()

  async function create() {
    setBusy(true); setError('')
    try {
      const { waitForUser, createRoom } = await import('./multiplayer')
      const user = await waitForUser(), room = await createRoom(user.uid)
      navigate(`/jogos/rastro/sala/${room}`)
    } catch (e) { setError(message(e)) }
    finally { setBusy(false) }
  }

  return <>
    <GameIntroLayout number="001" category="ESTRATÉGIA" title={<>RASTRO<span className="game-intro-title-dot">.</span></>}
      tagline="O próximo passo pode mudar tudo."
      art={<div className="intro-mark"><div className="intro-board"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><span>◆</span><b/></div>}
      summary="Um tabuleiro. Dois caminhos. E cristais para conquistar."
      description="Escolham os movimentos em segredo e revelem ao mesmo tempo. Cada passo deixa um rastro que muda o tabuleiro. Colete cristais, use seu salto especial e vença os duelos para chegar à meta."
      details={['↗ movimentos secretos', '◇ meta de 15 pontos · editável', '⚡ duelos de precisão']}
      actions={<>
        <button className="button button-primary button-large" onClick={() => void create()} disabled={busy || !firebaseReady}>{busy ? 'Preparando sala…' : 'Criar uma sala'}</button>
        <button className="button button-outline button-large" onClick={() => setGuide(true)}>Como jogar</button>
      </>}
      joinForm={<form className="game-intro-join-form" onSubmit={e => { e.preventDefault(); if (code.trim()) navigate(`/jogos/rastro/sala/${code.trim().toUpperCase()}`) }}>
        <label className="sr-only" htmlFor="intro-code">Código da sala</label>
        <input id="intro-code" value={code} onChange={e => setCode(e.target.value)} placeholder="Tenho um código" maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false}/>
        <button className="button button-outline" type="submit">Entrar</button>
      </form>}
      status={<>{!firebaseReady && <p className="setup-note">{firebaseSetupMessage()}</p>}{error && <p className="inline-error" role="alert">{error}</p>}</>}
      footnote={<><span>◇</span> Sem pressa. Joguem no tempo de vocês.</>}/>
    {guide && <TutorialDialog targetScore={DEFAULT_TARGET_SCORE} onFinish={() => setGuide(false)}/>}
  </>
}
