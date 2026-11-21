import { useEffect, useRef } from 'react'
import './minas.css'

export default function Guide({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog className="mine-guide" ref={dialog} onCancel={close} aria-labelledby="mine-guide-title">
    <h2 id="mine-guide-title">Como atravessar o campo</h2>
    <p>Comece em qualquer casa contornada da primeira linha acima da base: todas são seguras. Depois, cada passo abre uma vizinha de lado. O número conta as minas nas oito casas ao redor. Perto de um zero, casas conectadas ficam seguras.</p>
    <p>Alcance qualquer casa segura junto às bandeiras para marcar um ponto. Uma mina devolve você à largada desse campo e bloqueia seus passos por 5 segundos.</p>
    <p>Quem atravessar mais campos em 2 minutos vence. Em caso de empate, a próxima travessia decide.</p>
    <button className="button button-primary" onClick={close}>Entendi</button>
  </dialog>
}
