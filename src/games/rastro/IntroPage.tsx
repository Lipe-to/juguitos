import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { firebaseReady, firebaseSetupMessage } from '../../firebase/config'
import { Header } from '../../layout/SiteHeader'
import { message } from '../../lib/errors'

export default function RastroIntroPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  async function create() {
    setBusy(true); setError('')
    try { const { waitForUser, createRoom } = await import('./multiplayer'); const user = await waitForUser(); const room = await createRoom(user.uid); navigate(`/jogos/rastro/sala/${room}`) }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <main className="page-shell"><Header compact/><section className="intro-wrap"><Link to="/" className="back-link">← Voltar ao catálogo</Link><div className="intro-card"><div className="intro-title"><span className="eyebrow">JOGO Nº 001 · 2 PESSOAS</span><h1>RASTRO<span className="title-dot">.</span></h1><p>O próximo passo pode mudar tudo.</p></div><div className="intro-details"><div className="intro-mark"><div className="intro-board"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><span>◆</span><b/></div><div className="intro-copy"><p>Um tabuleiro. Dois caminhos. E cristais para conquistar.</p><p>Escolham os movimentos em segredo e revelem ao mesmo tempo. Cada passo deixa um rastro que muda o tabuleiro — pegue os cristais e vença os duelos por cristais. Use o salto especial para passar por cima de paredes e pessoas. Quem alcançar a meta de pontos vence!</p><div className="rules-pills"><span>↗ movimentos secretos</span><span>◇ meta de 15 pontos · editável</span><span>⚡ duelos de precisão</span></div></div></div><div className="intro-actions"><button className="button button-primary button-large" onClick={create} disabled={busy || !firebaseReady}>{busy ? 'Preparando sala…' : 'Criar uma sala'} <span>↗</span></button><form className="join-form join-form-intro" onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate(`/jogos/rastro/sala/${code.trim().toUpperCase()}`) }}><label className="sr-only" htmlFor="intro-code">Código da sala</label><input id="intro-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tenho um código" maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false}/><button className="button button-outline" type="submit">Entrar <span>→</span></button></form></div>{!firebaseReady && <p className="setup-note">{firebaseSetupMessage()}</p>}{error && <p className="inline-error" role="alert">{error}</p>}</div><p className="intro-footnote"><span>◇</span> Sem pressa. Joguem no tempo de vocês.</p></section></main>
}
