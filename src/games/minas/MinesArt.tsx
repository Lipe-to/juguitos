type Tile = { fill: string; number?: string; flag?: boolean; mine?: boolean }

const tiles: Tile[] = [
  { fill: '#fff8e7' }, { fill: '#d3b7f1' }, { fill: '#fff8e7', flag: true }, { fill: '#f9e5a1', mine: true },
  { fill: '#d3b7f1' }, { fill: '#fff8e7', number: '1' }, { fill: '#d3b7f1' }, { fill: '#fff8e7', number: '2' },
  { fill: '#fff8e7', number: '0' }, { fill: '#d3b7f1' }, { fill: '#fff8e7', flag: true }, { fill: '#d3b7f1' },
  { fill: '#d3b7f1' }, { fill: '#fff8e7', flag: true }, { fill: '#d3b7f1', number: '1' }, { fill: '#fff8e7' },
]

export default function MinesArt({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 220 185" fill="none" focusable="false" aria-hidden="true">
    <g transform="rotate(-8 110 92)">
      <rect x="31" y="20" width="158" height="148" rx="17" fill="#4b287c"/>
      <rect x="27" y="13" width="158" height="148" rx="17" fill="#7651a2" stroke="#4b287c" strokeWidth="3"/>
      <rect x="36" y="22" width="140" height="130" rx="8" fill="#59367f"/>
      {tiles.map((tile, i) => {
        const x = 40 + (i % 4) * 34.5, y = 26 + Math.floor(i / 4) * 31.5
        return <g key={i}>
          <rect x={x} y={y} width="31" height="28" rx="4" fill={tile.fill}/>
          {tile.number && <text x={x + 15.5} y={y + 20} textAnchor="middle" fill={tile.number === '0' ? '#8b5ac5' : '#4b287c'} fontFamily="Fredoka, sans-serif" fontSize="17" fontWeight="700">{tile.number}</text>}
          {tile.flag && <g transform={`translate(${x + 8} ${y + 6})`}>
            <path d="M1 1v17" stroke="#4b287c" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M3 2h13l-4 4 4 4H3z" fill="#8752e8" stroke="#4b287c" strokeWidth="1.4" strokeLinejoin="round"/>
          </g>}
          {tile.mine && <g transform={`translate(${x + 15.5} ${y + 14})`}>
            <circle r="7" fill="#58337e"/>
            <path d="M0-12v3m0 18v3m-12-12h3m18 0h3m-20-8 2 2m12 12 2 2m0-16-2 2M-8 8l-2 2" stroke="#58337e" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="2" cy="-2" r="1.8" fill="#fff4ce"/>
          </g>}
        </g>
      })}
    </g>
    <circle cx="178" cy="145" r="12" fill="#dfc9ff" stroke="#684696" strokeWidth="3"/>
    <circle cx="43" cy="144" r="11" fill="#8752e8" stroke="#fffdf6" strokeWidth="4"/>
    <path d="m199 37 2.8 7.2L209 47l-7.2 2.8L199 57l-2.8-7.2L189 47l7.2-2.8L199 37Z" fill="#efcf70"/>
    <path d="m183 168 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#9d70c6"/>
  </svg>
}
