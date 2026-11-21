import { useEffect, useRef, useState } from 'react'

const steps = [
  { art: '☾ ✦', title: 'Boa noite, boa sorte!', text: 'Quando a pessoa dormir, conte cada ovelha quando ela entrar no campo, de qualquer lado. Se ela parar, pular de novo ou voltar pelo mesmo lado, continua sendo uma só!' },
  { art: '… 7? …', title: 'Qual é seu palpite?', text: 'O rebanho some e vocês têm 12 segundos para responder. O palpite fica em segredo até a revelação. Quem ficar mais longe da contagem perde um coração; empate não tira vidas.' },
  { art: '♥ ♥ ♥', title: 'Segure seus corações', text: 'Vocês começam com três vidas. Aos poucos aparecem ovelhas que passeiam devagar, param no campo ou dão meia-volta. Quando alguém chegar a zero, a outra pessoa vence. Ative o som na sala para entrar no ritmo!' },
]
export default function SheepGuide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const step = steps[index]
  return <dialog ref={dialog} className="game-dialog tutorial-dialog" aria-labelledby="sheep-guide-title" onCancel={e => { e.preventDefault(); onClose() }}>
    <span className="eyebrow">CONTA, OVELHA! · {index + 1} / {steps.length}</span>
    <div className="tutorial-art" aria-hidden="true">{step.art}</div>
    <h2 id="sheep-guide-title">{step.title}</h2><p>{step.text}</p>
    <div className="tutorial-dots" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === index ? 'current' : ''}/>)}</div>
    <div className="tutorial-actions">
      <button className="button button-outline" onClick={() => index ? setIndex(index - 1) : onClose()}>{index ? 'Voltar' : 'Fechar'}</button>
      <button className="button button-primary" onClick={() => index === steps.length - 1 ? onClose() : setIndex(index + 1)}>{index === steps.length - 1 ? 'Entendi!' : 'Próximo →'}</button>
    </div>
  </dialog>
}

export function SheepCardArt() {
  return <div className="game-art sheep-card-art" aria-hidden="true">
    <svg viewBox="0 0 220 185" width="220" height="185" fill="none">
      <g transform="rotate(-8 109 93)">
        <rect x="22" y="16" width="176" height="150" rx="19" fill="#4b287c"/>
        <rect x="22" y="12" width="176" height="148" rx="19" fill="#7651a2" stroke="#4b287c" strokeWidth="3"/>
        <path d="M23 113q42-36 85-14t89-10v53q0 17-18 17H40q-17 0-17-17Z" fill="#a984ce"/>
        <path d="M23 140q45-32 93-11t81-12v25q0 17-18 17H40q-17 0-17-17Z" fill="#c6a5e7"/>
        <circle cx="157" cy="49" r="20" fill="#f9e7a3"/>
        <circle cx="151" cy="52" r="3" fill="#e9ca84"/><circle cx="164" cy="43" r="4" fill="#efd797"/>
        <path d="M54 27l2 7 7 2-7 2-2 7-2-7-7-2 7-2ZM112 25l2 4 4 2-4 1-2 5-1-5-5-1 5-2ZM174 93l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fff2be"/>
        <path d="M62 127q25 9 60 2" stroke="#9267b7" strokeWidth="5" strokeLinecap="round"/>
        <path d="M86 103l-11 14m25-13 2 13m16-17 11 11" stroke="#57346d" strokeWidth="6" strokeLinecap="round"/>
        <path d="M64 94q-13-13-23-2m22 11q-8-5-15 0" stroke="#e5caf4" strokeWidth="3" strokeLinecap="round"/>
        <path d="M70 90c-4-12 8-20 18-16 1-15 24-19 32-5 17-7 29 10 21 22 7 15-12 25-27 19-13 8-33 3-38-8-11 1-15-8-6-12Z" fill="#fff8df" stroke="#57346d" strokeWidth="3"/>
        <ellipse cx="133" cy="85" rx="17" ry="13" fill="#694986"/>
        <ellipse cx="132" cy="72" rx="11" ry="6" fill="#fff8df"/>
        <ellipse cx="137" cy="81" rx="3" ry="3.6" fill="#fff9e8"/>
        <circle cx="138" cy="81" r="1.5" fill="#4b287c"/>
        <ellipse cx="144" cy="89" rx="4" ry="2.4" fill="#f0aac0"/>
      </g>
    </svg>
  </div>
}
