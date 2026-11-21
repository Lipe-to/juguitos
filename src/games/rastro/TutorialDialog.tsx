import { useEffect, useRef, useState } from 'react'

export default function TutorialDialog({ targetScore, onFinish }: { targetScore: number; onFinish: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState(0)
  const lessons = [
    { art: '◆ ✦ ◆', title: 'Cristais na mira!', text: `Chegue a ${targetScore} pontos para vencer. Essa é a meta padrão; o anfitrião pode mudar antes de começar. Os seis cristais comuns valem 1 ponto; os dois especiais valem 2. Eles reaparecem depois de coletados.` },
    { art: '↑ ● →', title: 'Seu passo é segredo', text: 'Escolha uma direção ou fique parado. Depois confirme. Os dois movimentos acontecem juntos, só quando ambos estiverem prontos.' },
    { art: '● · · ↗', title: 'Guarde seu salto', text: 'Cada passo deixa um rastro que bloqueia a casa por dois movimentos. Ative a carta de salto para avançar duas casas, passando por cima de paredes, rastros e da outra pessoa. A casa onde você aterrissa precisa estar livre de paredes, rastros e pessoas. Você tem um salto por partida.' },
    { art: '1 ◆ 2', title: 'Mesmo cristal? Duelo!', text: 'Se os dois tentarem pegar o mesmo cristal, o duelo começa na hora! Pare o marcador perto do centro: quem chegar mais perto fica com o cristal e ganha 1 ponto de bônus. Se ambos acertarem, o alvo muda e a barra acelera. Toque em PARAR ou use Espaço. Colisões sem cristal só bloqueiam o movimento.' },
  ]
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const lesson = lessons[step]
  return <dialog ref={dialog} className="game-dialog tutorial-dialog" aria-labelledby="tutorial-title" onCancel={(e) => { e.preventDefault(); onFinish() }}>
    <span className="eyebrow">GUIA RÁPIDO · {step + 1} / {lessons.length}</span>
    <div className="tutorial-art" aria-hidden="true">{lesson.art}</div>
    <h2 id="tutorial-title">{lesson.title}</h2><p>{lesson.text}</p>
    <div className="tutorial-dots" aria-hidden="true">{lessons.map((_, i) => <i key={i} className={i === step ? 'current' : ''}/>)}</div>
    <div className="tutorial-actions"><button className="button button-outline" onClick={() => step ? setStep(step - 1) : onFinish()}>{step ? 'Voltar' : 'Pular'}</button><button className="button button-primary" onClick={() => step === lessons.length - 1 ? onFinish() : setStep(step + 1)}>{step === lessons.length - 1 ? 'Vamos jogar!' : 'Próximo →'}</button></div>
  </dialog>
}
