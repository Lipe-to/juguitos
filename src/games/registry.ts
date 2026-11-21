export type GameListing = {
  id: string
  name: string
  description: string
  players: number
  mode: 'competitive' | 'cooperative'
  route: string
  available: boolean
}

export const games: GameListing[] = [
  { id: 'minas', name: 'Campo Minado x1', description: 'Leia as pistas e atravesse mais campos que seu rival em dois minutos.', players: 2, mode: 'competitive', route: '/jogos/minas', available: true },
  {
    id: 'rastro',
    name: 'RASTRO',
    description: 'Colete cristais, planeje seus passos e descubra o caminho antes da outra pessoa.',
    players: 2,
    mode: 'competitive',
    route: '/jogos/rastro',
    available: true,
  },
  {
    id: 'ovelhas',
    name: 'Conta, Ovelha!',
    description: 'Uma soneca, um rebanho maluco e três corações. Algumas ovelhas passeiam, outras até dão meia-volta!',
    players: 2,
    mode: 'competitive',
    route: '/jogos/ovelhas',
    available: true,
  },
]
