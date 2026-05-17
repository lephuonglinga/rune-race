/**
 * Server-internal game types extending shared domain types.
 * Contains server-specific metadata and internal data structures.
 */

import type { GameState, Turn, PlayerColor, GameEvent } from '@rune-race/shared'

/**
 * Extended turn context with server-specific tracking.
 */
export interface ServerTurn extends Turn {
  commandId?: string // Track idempotency
  resolvedAt?: number // When turn was finalized
  autoResolvedAt?: number // If timeout forced resolution
}

/**
 * Server-internal game state with additional metadata.
 */
export interface ServerGameState extends GameState {
  /** Timeout handle for turn auto-resolution */
  turnTimeoutHandle?: NodeJS.Timeout
  /** Turn history for replay/audit (recent only, not full history) */
  turnHistory: Array<{
    turnId: string
    playerId: string
    diceResult: number
    moveResolved: boolean
    timestamp: number
  }>
}

/**
 * Result of executing a command on the game state.
 * Immutable: original state is never modified.
 */
export interface CommandResult {
  success: boolean
  /** New game state after command execution */
  nextState?: ServerGameState
  /** Events generated (for animation/broadcast) */
  events: GameEvent[]
  /** Error details if success=false */
  error?: {
    code: string
    message: string
  }
}

/**
 * Move option computed by resolver.
 * Includes additional server-side metadata.
 */
export interface ServerLegalMove {
  id: string
  tokenId: string
  destination: number
  moveType: 'spawn' | 'move' | 'capture'
  capturedTokenId?: string
}

/**
 * Constants for player token management.
 */
export const TOKENS_PER_PLAYER = 4
export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow']

/**
 * Helper to generate token ID.
 */
export const generateTokenId = (playerId: string, tokenIndex: number): string => {
  return `${playerId}:${tokenIndex}`
}

/**
 * Helper to generate turn ID.
 */
export const generateTurnId = (roomId: string, turnNumber: number): string => {
  return `${roomId}:turn:${turnNumber}`
}

/**
 * Helper to generate legal move ID.
 */
export const generateMoveId = (tokenId: string, destination: number): string => {
  return `${tokenId}:${destination}`
}
