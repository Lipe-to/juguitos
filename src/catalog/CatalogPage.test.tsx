// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CatalogPage from './CatalogPage'

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
})
afterEach(() => { cleanup(); localStorage.clear() })

describe('catalog tutorial entry', () => {
  it('opens all four lessons from the game card and returns to the catalog', () => {
    render(<MemoryRouter><CatalogPage/></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Como jogar' }))
    for (const heading of ['Cristais na mira!', 'Seu passo é segredo', 'Guarde seu salto', 'Mesmo cristal? Duelo!']) {
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: heading === 'Mesmo cristal? Duelo!' ? 'Vamos jogar!' : 'Próximo →' }))
    }
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('link', { name: 'Bora jogar' })).toBeTruthy()
  })
  it('does not offer resume for an old stored room and clears a code error while editing', () => {
    localStorage.setItem('juguitos-room', 'OLD234')
    render(<MemoryRouter><CatalogPage/></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /Retomar sala/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByRole('alert')).toBeTruthy()
    const input = screen.getByRole('textbox', { name: 'Código da sala' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc234' } })
    expect(input.value).toBe('abc234')
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('opens the game picker for the shared practice code', () => {
    render(<MemoryRouter><CatalogPage/></MemoryRouter>)
    fireEvent.change(screen.getByRole('textbox', { name: 'Código da sala' }), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByRole('heading', { name: 'Qual jogo você quer testar?' })).toBeTruthy()
    for (const [id, name] of [['rastro', 'RASTRO'], ['ovelhas', 'Conta, Ovelha!'], ['minas', 'Campo Minado x1']]) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(`/jogos/${id}/sala/0`)
    }
  })
})
