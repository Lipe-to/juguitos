import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../layout/SiteHeader'
import { createRoom } from './online'
import { unlock } from './sound'
import Guide from './Guide'

export default function Intro() {
  const go = useNavigate()
  const [busy, setBusy] = useState(false), [guide, setGuide] = useState(false), [error, setError] = useState('')
  async function create() {
    unlock(); setBusy(true); setError('')
    try { const { code } = await createRoom(); go('/jogos/minas/sala/' + code) }
    catch (e) { setError((e as Error).message); setBusy(false) }
  }
  return <main className="page-shell"><Header/><section className="mine-intro">
    <span className="eyebrow">CORRIDA PARA DOIS</span><h1>Campo Minado x1</h1>
    <p>Dois minutos. O mesmo mapa. Quem chega mais vezes às bandeiras?</p>
    <div className="game-actions"><button disabled={busy} className="button button-primary" onClick={create}>{busy ? 'Criando sala…' : 'Criar sala'}</button>
    <button className="button button-outline" onClick={() => setGuide(true)}>Como jogar</button></div>
    {error && <p role="alert">{error}</p>}</section>{guide && <Guide close={() => setGuide(false)}/>}</main>
}
