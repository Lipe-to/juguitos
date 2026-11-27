export const PRACTICE_CODE = '0'
export const PRACTICE_USER = 'local-player'
export const PRACTICE_BOT = 'local-bot'

export function practicePath(game: string) {
  return `/jogos/${game}/sala/${PRACTICE_CODE}`
}

export function practiceSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}
