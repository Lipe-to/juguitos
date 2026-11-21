import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import CatalogPage from './catalog/CatalogPage'
import RastroIntroPage from './games/rastro/IntroPage'
import RastroRoomPage from './games/rastro/RoomPage'
const MineIntro = lazy(() => import('./games/minas/Intro'))
const MineRoom = lazy(() => import('./games/minas/Room'))
const SheepIntroPage = lazy(() => import('./games/ovelhas/IntroPage'))
const SheepRoomPage = lazy(() => import('./games/ovelhas/RoomPage'))

export default function App() {
  return <Suspense fallback={<main className="page-shell"><section className="room-loading"><p>Carregando o jogo…</p></section></main>}>
    <Routes>
      <Route path="/" element={<CatalogPage/>}/>
      <Route path="/jogos/rastro" element={<RastroIntroPage/>}/>
      <Route path="/jogos/rastro/sala/:codigo" element={<RastroRoomPage/>}/>
      <Route path="/jogos/ovelhas" element={<SheepIntroPage/>}/>
      <Route path="/jogos/ovelhas/sala/:codigo" element={<SheepRoomPage/>}/>
      <Route path="/jogos/minas" element={<MineIntro/>}/>
      <Route path="/jogos/minas/sala/:codigo" element={<MineRoom/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  </Suspense>
}
