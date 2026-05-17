/**
 * Game state initialization and factory functions.
 */

import type { Player, Token } from '@rune-race/shared'
import type { ServerGameState, ServerTurn } from './types'
import { generateTokenId, generateTurnId, TOKENS_PER_PLAYER } from './types'

/**
 * Create initial game state for a new room.
 */
export function createInitialGameState(
  roomId: string,
  players: Player[]
): ServerGameState {
  if (players.length < 2 || players.length > 4) {
    throw new Error('Must have between 2 and 4 players')
  }

  // Create tokens (4 per player, all in base)
  const tokens: Token[] = []
  for (const player of players) {
    for (let i = 0; i < TOKENS_PER_PLAYER; i++) {
      tokens.push({
        id: generateTokenId(player.id, i),
        playerId: player.id,
        position: 0,
        state: 'in_base',
      })
    }
  }

  // Create initial turn
  const initialTurn: ServerTurn = {
    id: generateTurnId(roomId, 1),
    currentPlayerId: players[0].id,
    diceResult: null,
    phase: 'waiting_roll',
    legalMoves: [],
    startTime: Date.now(),
  }

  const now = Date.now()

  const state: ServerGameState = {
    roomId,
    version: 1,
    players,
    tokens,
    turn: initialTurn,
    phase: 'waiting_roll',
    status: 'playing',
    currentPlayerIndex: 0,
    createdAt: now,
    updatedAt: now,
    events: [],
    turnHistory: [],
  }

  return state
}

/**
 * Create a test game state with 4 players.
 * Useful for tests and sandbox.
 */
export function createTestGameState(roomId: string = 'test-room'): ServerGameState {
  const players: Player[] = [
    { id: 'player:1', name: 'Alice', color: 'red' },
    { id: 'player:2', name: 'Bob', color: 'blue' },
    { id: 'player:3', name: 'Charlie', color: 'green' },
    { id: 'player:4', name: 'Diana', color: 'yellow' },
  ]

  return createInitialGameState(roomId, players)
}
