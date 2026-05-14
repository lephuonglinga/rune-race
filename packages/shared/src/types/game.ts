// Game domain types
export interface Player {
  id: string
  name: string
  color: 'red' | 'blue' | 'green' | 'yellow'
}

export interface GameState {
  roomId: string
  players: Player[]
  status: 'waiting' | 'playing' | 'finished'
}

export interface Token {
  playerId: string
  position: number
  state: 'in_base' | 'in_play' | 'finished'
}
