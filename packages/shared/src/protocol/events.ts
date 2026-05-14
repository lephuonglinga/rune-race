// WebSocket events protocol
export interface GameEvents {
  'game:join': { playerId: string; playerName: string; color: 'red' | 'blue' | 'green' | 'yellow' }
  'game:start': { roomId: string }
  'game:move': { playerId: string; steps: number }
  'game:state': { state: any }
  'game:error': { message: string }
}

export type GameEventKey = keyof GameEvents
export type GameEventPayload<K extends GameEventKey> = GameEvents[K]
