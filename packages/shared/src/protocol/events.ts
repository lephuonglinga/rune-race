/**
 * WebSocket Events Protocol
 * Defines all events exchanged between client and server.
 * Server is the sole authority; clients send "intent" commands, not direct state updates.
 */

import type { GameState, GameEvent, RoomSnapshot } from '../types/game'

/**
 * Server -> Client events
 */
export interface ServerToClientEvents {
  /**
   * Snapshot of complete game state after any action.
   * Includes recent delta events for client-side animation/reconciliation.
   */
  'game:state_snapshot': (payload: {
    version: number
    state: GameState
    events: GameEvent[] // Recent events for animation
  }) => void

  /**
   * Error response to a client command.
   */
  'game:error': (payload: {
    message: string
    code: string // e.g., 'INVALID_PHASE', 'NOT_YOUR_TURN'
  }) => void

  /**
   * Acknowledge connection established.
   */
  'game:connected': (payload: {
    playerId: string
    roomId: string
  }) => void

  /**
   * Snapshot of a room in the lobby or finished state.
   * Used by the client to render player slots before game start.
   */
  'game:room_snapshot': (payload: RoomSnapshot) => void

  /**
   * Notify client that turn will auto-resolve if no action within timeout.
   */
  'game:turn_timeout_warning': (payload: {
    secondsRemaining: number
  }) => void
}

/**
 * Client -> Server events (commands/intents, never direct state)
 */
export interface ClientToServerEvents {
  /**
   * Join a game room.
   * Must happen before any other game action.
   */
  'game:join': (payload: {
    playerId: string
    playerName: string
    roomId: string
    color: 'red' | 'blue' | 'green' | 'yellow'
  }) => void

  /**
   * Roll the dice.
   * Valid only in 'waiting_roll' phase and current player.
   * Server will validate, generate RNG result, compute legalMoves.
   */
  'game:roll': (payload: {
    playerId: string
  }) => void

  /**
   * Choose a move from legalMoves.
   * Valid only in 'waiting_choice' phase.
   * Token to move and destination are determined by moveId server-side.
   */
  'game:choose_move': (payload: {
    playerId: string
    moveId: string // Index or unique ID from legalMoves array
  }) => void

  /**
   * Request full state snapshot (e.g., on reconnect or sync).
   * Server will send game:state_snapshot with current version.
   */
  'game:sync_request': (payload: {
    playerId: string
  }) => void

  /**
   * Start the game from the lobby.
   * Valid only when room has at least 2 players.
   */
  'game:start': (payload: {
    playerId: string
    roomId: string
  }) => void

  /**
   * Confirm player is still connected (heartbeat).
   */
  'game:ping': (payload: {
    playerId: string
  }) => void
}

/**
 * Socket event type unions for type-safe emit/on.
 */
export type GameEventKey = keyof ServerToClientEvents | keyof ClientToServerEvents

export type ServerToClientEventPayload<K extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[K]>[0]
export type ClientToServerEventPayload<K extends keyof ClientToServerEvents> = Parameters<ClientToServerEvents[K]>[0]

/**
 * Validation constants for client-side UI hints (not trusted by server).
 */
export const TURN_TIMEOUT_SECONDS = 30
export const TURN_WARNING_AT_SECONDS = 5
