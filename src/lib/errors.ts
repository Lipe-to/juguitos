import type { Action, Direction } from '../games/rastro/engine'

export function actionLabel(action: Action): string {
  if (action.kind === 'stay') return 'Permanecer parado'
  const names: Record<Direction, string> = { up: 'Cima', down: 'Baixo', left: 'Esquerda', right: 'Direita' }
  return `${action.jump ? 'Salto para ' : 'Mover para '}${names[action.direction].toLowerCase()}`
}
export function message(error: unknown): string {
  if (!(error instanceof Error)) return 'Algo deu errado. Tente novamente.'
  if (error.message.includes('permission-denied')) return 'Não foi possível acessar a sala. Confira o link e tente novamente.'
  if (error.message.includes('resource-exhausted')) return 'O limite gratuito do Firebase foi atingido por agora. Tente mais tarde.'
  if (error.message.includes('unavailable') || error.message.includes('network')) return 'Sem conexão com a internet. Tentando novamente…'
  return error.message
}
