import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '../../layout/SiteHeader'
import { firebaseReady, firebaseSetupMessage } from '../../firebase/config'
import { message } from '../../lib/errors'
import { SHEEP_CODE } from './engine'
import SheepGuide from './Guide'
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
  return <main className="page-shell sheep-shell">
    <Header compact/>
    <Link to="/" className="back-link">← Voltar ao catálogo</Link>
    <section className="sheep-intro">
      <div className="sheep-intro-copy">
        <span className="eyebrow">JOGO Nº 002 · OLHO NO REBANHO</span>
        <h1>Conta,<br/><em>Ovelha!</em></h1>
        <p>Uma soneca. Um rebanho cheio de truques. Quantas ovelhas entraram?</p>
        <div className="sheep-pills"><span>♥ 3 vidas</span><span>✦ ovelhas imprevisíveis</span><span>♫ trilha e balidos</span></div>
        <div className="sheep-intro-actions">
          <button className="button button-primary" onClick={() => void create()} disabled={!firebaseReady || busy}>{busy ? 'Arrumando a cama…' : 'Criar uma sala'} <span aria-hidden="true">→</span></button>
          <button className="button button-outline" onClick={() => setGuide(true)}>Como jogar <span aria-hidden="true">?</span></button>
        </div>
      </div>
      <div className="sheep-intro-art"><SheepStage mood="idle"/><span>☾ TURNO DA NOITE</span></div>
    </section>
    <section className="room-entry sheep-enter" aria-labelledby="sheep-enter-title">
      <div><span className="eyebrow">JÁ TEM UM CONVITE?</span><h2 id="sheep-enter-title">Encontre seu rebanho</h2><p>Use o código que a outra pessoa compartilhou.</p></div>
      <form className="join-form" onSubmit={enter}><label className="sr-only" htmlFor="sheep-code">Código da sala</label>
        <input id="sheep-code" value={code} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="EX.: O7KM2P" onChange={e => { setCode(e.target.value); setError('') }}/>
        <button className="button button-outline">Entrar <span aria-hidden="true">→</span></button>
      </form>
    </section>
    {!firebaseReady && <p className="setup-banner">{firebaseSetupMessage()}</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {guide && <SheepGuide onClose={() => setGuide(false)}/>}
  </main>
}
