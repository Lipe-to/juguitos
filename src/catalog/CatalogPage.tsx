import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { firebaseReady, firebaseSetupMessage } from '../firebase/config'
import { games } from '../games/registry'
import { Header, Brand } from '../layout/SiteHeader'
import TutorialDialog from '../games/rastro/TutorialDialog'
import { DEFAULT_TARGET_SCORE } from '../games/rastro/engine'
import SheepGuide, { SheepCardArt } from '../games/ovelhas/Guide'
import MineGuide from '../games/minas/Guide'
import MinesArt from '../games/minas/MinesArt'
import { ArrowIcon } from '../layout/Navigation'
import { PRACTICE_CODE, practicePath } from '../games/practice'
const mines = games.find(game => game.id === 'minas')!
const rastro = games.find((game) => game.id === 'rastro')!
const sheep = games.find((game) => game.id === 'ovelhas')!

export default function CatalogPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [choosePractice, setChoosePractice] = useState(false)
  const [guide, setGuide] = useState<'rastro' | 'ovelhas' | 'minas' | null>(null)
  const navigate = useNavigate()
  function enter(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (clean === PRACTICE_CODE) { setChoosePractice(true); return }
    if (clean.length !== 6) { setError('O código precisa ter seis caracteres.'); return }
    navigate(`/jogos/${clean.startsWith('I') ? 'minas' : clean.startsWith('O') ? 'ovelhas' : 'rastro'}/sala/${clean}`)
  }
  return <main className="page-shell">
    <Header/>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">JOGUITOS PARA DOIS</span><h1>Vamos jogar <br/><em>alguma coisinha?</em></h1><p>bora escolher um joguito!</p><div className="hero-meta"><span>Sem cadastro</span><span>100% joguitos!</span></div></div>
    </section>
    <section className="catalog-section" aria-labelledby="games-heading">
      <div className="section-heading"><h2 id="games-heading">Escolha seu jogo</h2></div>
      <article className="game-card">
        <div className="game-art" aria-hidden="true"><div className="mini-grid"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><span className="art-crystal">◆</span><span className="art-player art-p1"/><span className="art-player art-p2"/><span className="art-spark">✦</span></div>
        <div className="game-content"><div className="game-topline"><span className="game-tag">ESTRATÉGIA</span><span className="game-index">Nº 001</span></div><h3>{rastro.name}</h3><p>{rastro.description}</p>
          <div className="game-actions"><Link className="button button-primary" to={rastro.route}>Bora jogar <ArrowIcon/></Link><button className="button button-outline" onClick={() => setGuide('rastro')}>Como jogar <span aria-hidden="true">?</span></button></div>
        </div>
        <div className="game-number">01</div>
      </article>
      <article className="game-card">
        <SheepCardArt/>
        <div className="game-content"><div className="game-topline"><span className="game-tag">MEMÓRIA · ATENÇÃO</span><span className="game-index">Nº 002</span></div><h3>{sheep.name}</h3><p>{sheep.description}</p>
          <div className="game-actions"><Link className="button button-primary" to={sheep.route}>Contar ovelhas <ArrowIcon/></Link><button className="button button-outline" aria-label="Como jogar Conta, Ovelha!" onClick={() => setGuide('ovelhas')}>Como jogar <span aria-hidden="true">?</span></button></div>
        </div>
      </article>
      <article className="game-card">
        <div className="game-art mine-card-art" aria-hidden="true"><MinesArt/></div>
        <div className="game-content"><div className="game-topline"><span className="game-tag">LÓGICA · CORRIDA</span><span className="game-index">Nº 003</span></div>
          <h3>{mines.name}</h3><p>{mines.description}</p><div className="game-actions"><Link className="button button-primary" to={mines.route}>Cruzar o campo <ArrowIcon/></Link>
          <button className="button button-outline" aria-label="Como jogar Campo Minado x1" onClick={() => setGuide('minas')}>Como jogar ?</button></div></div>
      </article>
      <section className="room-entry" aria-labelledby="room-heading"><div><span className="eyebrow">JÁ TEM UM CONVITE?</span><h2 id="room-heading">Entre em uma sala</h2><p>Use um convite ou digite {PRACTICE_CODE} para treinar com bot.</p></div><form className="join-form" onSubmit={enter}><label className="sr-only" htmlFor="room-code">Código da sala</label><input id="room-code" value={code} onChange={(e) => { setCode(e.target.value); setError(''); setChoosePractice(false) }} placeholder="EX.: A7KM2P" maxLength={PRACTICE_CODE.length} autoComplete="off" autoCapitalize="characters" spellCheck={false}/><button className="button button-outline" type="submit">Entrar <ArrowIcon/></button></form></section>
      {choosePractice && <section className="room-entry" aria-labelledby="practice-heading"><h2 id="practice-heading">Qual jogo você quer testar?</h2><div className="game-actions">{games.filter(game => game.available).map(game => <Link key={game.id} className="button button-outline" to={practicePath(game.id)}>{game.name}</Link>)}</div></section>}
      {!firebaseReady && <div className="setup-banner"><span>ⓘ</span><p>{firebaseSetupMessage()}</p></div>}
      {error && <div className="inline-error" role="alert">{error}</div>}
      <p className="coming-soon"><span>✦</span> Próximos jogos: ainda no forno.</p>
    </section>
    <footer className="site-footer"><Brand compact/><span>Feito por Lipeto <b>♥</b></span><span>JUGUITOS! © 2026</span></footer>
    {guide === 'minas' && <MineGuide close={() => setGuide(null)}/>}
    {guide === 'rastro' && <TutorialDialog targetScore={DEFAULT_TARGET_SCORE} onFinish={() => setGuide(null)}/>}
    {guide === 'ovelhas' && <SheepGuide onClose={() => setGuide(null)}/>}
  </main>
}
