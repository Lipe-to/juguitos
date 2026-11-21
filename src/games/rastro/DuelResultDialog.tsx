import { useLayoutEffect, useRef } from 'react'

export default function DuelResultDialog({ won, score, finished, onContinue }: { won: boolean; score: number; finished: boolean; onContinue: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className={`game-dialog duel-result-dialog ${won ? 'duel-victory' : ''}`} aria-labelledby="duel-result-title" onCancel={(event) => { event.preventDefault(); onContinue() }}>
    <span className="eyebrow">{won ? 'CRISTAL CONQUISTADO' : 'DUELO ENCERRADO'}</span>
    <div className="duel-prize" aria-hidden="true">{won ? '◆' : '⚡'}</div>
    <h2 id="duel-result-title">{won ? 'Você venceu o duelo!' : 'Essa foi por pouco!'}</h2>
    <p>{won ? 'O cristal é seu! Você também ganhou +1 ponto pela vitória no duelo.' : 'A outra pessoa venceu o duelo e ficou com o cristal e o ponto de bônus.'}</p>
    <div className="duel-result-score"><span>SEU PLACAR</span><b>{score}<small> pontos</small></b></div>
    <button className="button button-primary full-button" autoFocus onClick={onContinue}>{finished ? 'Ver resultado da partida →' : 'Continuar jogando →'}</button>
  </dialog>
}
