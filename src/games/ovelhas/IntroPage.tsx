import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { firebaseReady, firebaseSetupMessage } from '../../firebase/config'
import { GameIntroLayout } from '../../layout/GameIntroLayout'
import { message } from '../../lib/errors'
import SheepGuide from './Guide'
import { SHEEP_CODE } from './engine'
import { SheepStage } from './Stage'
import './sheep.css'

export default function SheepIntroPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [guide, setGuide] = useState(false)

  async function create() {
    setBusy(true); setError('')
    try {
      const { waitForUser, createSheepRoom } = await import('./online')
      const user = await waitForUser(), room = await createSheepRoom(user.uid)
      navigate(`/jogos/ovelhas/sala/${room}`)
    } catch (e) { setError(message(e)) }
    finally { setBusy(false) }
  }

  function enter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!SHEEP_CODE.test(clean)) { setError('Digite o código de seis caracteres da sala. Ele começa com a letra O.'); return }
    navigate(`/jogos/ovelhas/sala/${clean}`)
  }

  return <>
    <GameIntroLayout number="002" category="MEMÓRIA · ATENÇÃO" title={<>Conta, <em>Ovelha!</em></>}
      tagline="Uma soneca. Um rebanho cheio de truques. Quantas ovelhas entraram?"
      art={<div className="sheep-intro-art"><SheepStage mood="idle"/><span>☾ TURNO DA NOITE</span></div>}
      summary="Observe o campo enquanto a pessoa dorme. Cada ovelha só conta uma vez."
      description="O rebanho pode acelerar, parar ou até voltar. Depois, os dois enviam um palpite em segredo. Quem ficar mais longe perde um coração; no empate, ninguém perde vida."
      details={['♥ 3 vidas', '✦ ovelhas imprevisíveis', '♫ trilha e balidos']}
      actions={<>
        <button className="button button-primary button-large" onClick={() => void create()} disabled={!firebaseReady || busy}>{busy ? 'Arrumando a cama…' : 'Criar uma sala'}</button>
        <button className="button button-outline button-large" onClick={() => setGuide(true)}>Como jogar</button>
      </>}
      joinForm={<form className="game-intro-join-form" onSubmit={enter}>
        <label className="sr-only" htmlFor="sheep-code">Código da sala</label>
        <input id="sheep-code" value={code} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="EX.: O7KM2P" onChange={e => { setCode(e.target.value); setError('') }}/>
        <button className="button button-outline" type="submit">Entrar</button>
      </form>}
      status={<>{!firebaseReady && <p className="setup-note">{firebaseSetupMessage()}</p>}{error && <p className="inline-error" role="alert">{error}</p>}</>}
      footnote="Olho no rebanho: observe a cena até o fim antes de enviar seu palpite."/>
    {guide && <SheepGuide onClose={() => setGuide(false)}/>}
  </>
}
