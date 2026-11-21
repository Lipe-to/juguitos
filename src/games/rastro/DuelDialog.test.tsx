// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DuelDialog from './DuelDialog'
import DuelResultDialog from './DuelResultDialog'
import { duelParameters, type Duel } from './engine'

let frame: FrameRequestCallback
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
  vi.spyOn(performance, 'now').mockReturnValue(100)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frame = callback; return 1 })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const duel = (stage: number): Duel => ({ id: '77_1', stage, actions: { p1: { kind: 'move', direction: 'right' }, p2: { kind: 'move', direction: 'left' } }, ...duelParameters(77, 1, stage) })
describe('instant crystal duels and their result', () => {
  it.each([0, 1])('enables input and moves the marker immediately in stage %i', async (stage) => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const current = duel(stage)
    const { container } = render(<DuelDialog duel={current} confirmed={false} opponentConfirmed={false} onSubmit={submit}/>)
    const stop = screen.getByRole('button', { name: 'PARAR!' }) as HTMLButtonElement
    expect(stop.disabled).toBe(false)
    expect(screen.queryByText(/Prepare-se/)).toBeNull()
    act(() => frame(200))
    expect(parseFloat((container.querySelector('.qte-marker') as HTMLElement).style.left)).toBeGreaterThan(0)
    vi.mocked(performance.now).mockReturnValue(200)
    await act(async () => fireEvent.click(stop))
    expect(submit).toHaveBeenCalledWith(200 / current.periodMs)
  })
  it('shows duel victory and allows continuing to the final match result', () => {
    const onContinue = vi.fn()
    render(<DuelResultDialog won score={15} finished onContinue={onContinue}/>)
    expect(screen.getByRole('heading', { name: 'Você venceu o duelo!' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado da partida →' }))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
