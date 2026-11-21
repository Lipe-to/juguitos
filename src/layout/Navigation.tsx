import { Link } from 'react-router-dom'

export function ArrowIcon({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return direction === 'left'
    ? <svg className="arrow-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5m7 7-7-7 7-7"/></svg>
    : <svg className="arrow-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
}

export function BackLink({ to = '/', label = 'Voltar' }: { to?: string; label?: string }) {
  return <Link to={to} className="back-link" aria-label={label} title={label}><ArrowIcon direction="left"/></Link>
}
