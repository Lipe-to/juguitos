// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import RoomPage from './RoomPage'

const services = vi.hoisted(() => ({ startRoom: vi.fn().mockResolvedValue(undefined), updateTargetScore: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./multiplayer', () => ({
  waitForUser: async () => ({ uid: 'host' }),
  joinRoom: async () => 'p1',
  subscribeRoom: (_code: string, next: (room: unknown) => void) => {
    next({ creator: 'host', players: { p1: 'host', p2: 'guest' }, status: 'WAITING', game: null, confirmations: { p1: false, p2: false }, revenge: { p1: false, p2: false }, targetScore: 15 })
    return () => {}
  },
  ...services,
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('saves the point goal and starts directly without a tutorial option or popup', async () => {
  render(<MemoryRouter initialEntries={['/jogos/rastro/sala/ABC234']}><Routes><Route path="/jogos/rastro/sala/:codigo" element={<RoomPage/>}/></Routes></MemoryRouter>)
  const start = await screen.findByRole('button', { name: 'Começar partida ↗' })
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } })
  fireEvent.click(start)
  await waitFor(() => expect(services.startRoom).toHaveBeenCalledWith('ABC234', 'host'))
  expect(services.updateTargetScore).toHaveBeenCalledWith('ABC234', 'host', 25)
  expect(screen.queryByRole('dialog')).toBeNull()
})
