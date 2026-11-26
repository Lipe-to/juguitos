import { useEffect, useRef } from 'react'
import './minas.css'

export default function Guide({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog className="mine-guide" ref={dialog} onCancel={close} aria-labelledby="mine-guide-title">
    <h2 id="mine-guide-title">Como atravessar o campo</h2>
    <p>Você começa com duas ou três casas abertas na base. Toque em uma casa com contorno para avançar. O número indica quantas minas estão nas oito casas ao redor. Ao abrir um zero, a área segura ao redor também se abre.</p>
    <p>Abra uma casa segura na linha da chegada para marcar um ponto. Uma mina devolve você à largada desse campo e bloqueia seus passos por 5 segundos.</p>
    <p>Quem atravessar mais campos em 2 minutos vence. Em caso de empate, a próxima travessia decide.</p>
    <button className="button button-primary" onClick={close}>Entendi</button>
  </dialog>
}
