import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { practicePath } from '../games/practice'
import { Header } from './SiteHeader'
import { BackLink } from './Navigation'

export interface GameIntroLayoutProps {
  gameId: string
  number: string
  category: string
  title: ReactNode
  tagline: string
  art: ReactNode
  summary: string
  description: string
  details: string[]
  actions: ReactNode
  joinForm: ReactNode
  status?: ReactNode
  footnote?: ReactNode
}

export function GameIntroLayout({ gameId, number, category, title, tagline, art, summary, description, details, actions, joinForm, status, footnote }: GameIntroLayoutProps) {
  return <main className="page-shell game-intro-shell">
    <Header compact/>
    <section className="game-intro-wrap">
      <BackLink label="Voltar ao catálogo"/>
      <div className="game-intro-card">
        <header className="game-intro-heading">
          <span className="eyebrow">JOGO Nº {number} · {category}</span>
          <h1>{title}</h1>
          <p>{tagline}</p>
        </header>
        <div className="game-intro-details">
          <div className="game-intro-art" aria-hidden="true">{art}</div>
          <div className="game-intro-copy">
            <p className="game-intro-summary">{summary}</p>
            <p>{description}</p>
            <div className="game-intro-pills">{details.map(item => <span key={item}>{item}</span>)}</div>
          </div>
        </div>
        <div className="game-intro-actions">
          <div className="game-intro-action-buttons">{actions}<Link className="button button-outline" to={practicePath(gameId)}>Treinar com bot</Link></div>
          <div className="game-intro-join">
            <span className="eyebrow">JÁ TEM UM CONVITE?</span>
            <p>Digite o código que a outra pessoa compartilhou.</p>
            {joinForm}
          </div>
        </div>
        {status}
      </div>
      {footnote && <p className="game-intro-footnote">{footnote}</p>}
    </section>
  </main>
}
