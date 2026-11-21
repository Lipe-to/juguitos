import { Link } from 'react-router-dom'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="juguitos! início">juguitos<span>!</span></Link>
}

export function Header({ compact = false }: { compact?: boolean }) {
  return <header className={`site-header ${compact ? 'site-header-compact' : ''}`}><Brand compact={compact}/><span className="header-note">pequenos jogos, grandes disputas</span></header>
}
