import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameIntroLayout } from '../../layout/GameIntroLayout'
import MinesArt from './MinesArt'
import { createRoom } from './online'
import { unlock } from './sound'
import Guide from './Guide'

export default function Intro() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [guide, setGuide] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    unlock(); setBusy(true); setError('')
    try {
      const { code } = await createRoom()
      navigate('/jogos/minas/sala/' + code)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  function enter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!/^I[A-HJ-NP-Z2-9]{5}$/.test(clean)) { setError('Digite o código de seis caracteres da sala. Ele começa com a letra I.'); return }
    navigate(`/jogos/minas/sala/${clean}`)
  }

  return <>
    <GameIntroLayout number="003" category="LÓGICA · CORRIDA" title={<>Campo Minado <em>x1</em></>}
      tagline="Dois minutos. O mesmo mapa. Quem chega mais vezes às bandeiras?"
      art={<MinesArt className="game-intro-illustration mine-intro-illustration"/>}
      summary="Avance casa por casa e use as pistas para evitar as minas."
      description="Cada toque abre uma vizinha. Os números contam as minas ao redor; as bandeiras ajudam você a marcar suspeitas. Atravesse o campo antes do tempo acabar."
      details={['⏱ 2 minutos', '⚑ bandeiras por toque ou clique direito', '✹ uma explosão custa 5 segundos']}
      actions={<>
        <button disabled={busy} className="button button-primary button-large" onClick={() => void create()}>{busy ? 'Criando sala…' : 'Criar uma sala'}</button>
        <button className="button button-outline button-large" onClick={() => setGuide(true)}>Como jogar</button>
      </>}
      joinForm={<form className="game-intro-join-form" onSubmit={enter}>
        <label className="sr-only" htmlFor="mines-code">Código da sala</label>
        <input id="mines-code" value={code} onChange={e => { setCode(e.target.value); setError('') }} placeholder="EX.: I7KM2P" maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false}/>
        <button className="button button-outline" type="submit">Entrar</button>
      </form>}
      status={error && <p className="inline-error" role="alert">{error}</p>}
      footnote="Sua identidade e seu progresso ficam salvos neste navegador."/>
    {guide && <Guide close={() => setGuide(false)}/>}
  </>
}
