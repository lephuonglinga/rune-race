/**
 * Game state resolver: computes legal moves and resolves move commands.
 * Core game logic; all validation and state transitions happen here.
 * Server-authoritative: clients never trust client-computed state.
 */

import type { Token, GameEvent } from '@rune-race/shared'
import type { ServerGameState, ServerLegalMove } from './types'
import {
  BOARD_SIZE,
  HOME_LANE_SIZE,
  isSafeTile,
  isValidHomeLanePosition,
  canFinishExactly,
  getSpawnEntryPosition,
} from './board'
import { generateMoveId } from './types'

/**
 * Get all tokens belonging to a player.
 */
function getPlayerTokens(state: ServerGameState, playerId: string): Token[] {
  return state.tokens.filter((t) => t.playerId === playerId)
}

/**
 * Find token at a specific board position (on_track state).
 * @param state - Current game state
 * @param position - Main board position
 * @param excludeTokenId - Exclude a specific token (e.g., the one moving)
 * @returns Token if found, undefined otherwise
 */
function findTokenAtPosition(
  state: ServerGameState,
  position: number,
  excludeTokenId?: string
): Token | undefined {
  return state.tokens.find(
    (t) =>
      t.state === 'on_track' &&
      t.position === position &&
      (!excludeTokenId || t.id !== excludeTokenId)
  )
}

/**
 * Find token at home lane position.
 */
function findTokenAtHomeLanePosition(
  state: ServerGameState,
  color: string,
  position: number,
  excludeTokenId?: string
): Token | undefined {
  return state.tokens.find(
    (t) =>
      t.state === 'in_home_lane' &&
      t.playerId.split(':')[0] === color && // Extract player ID from token ID
      t.position === position &&
      (!excludeTokenId || t.id !== excludeTokenId)
  )
}

/**
 * Compute all legal moves for a player after dice roll.
 * Returns empty array if no moves available.
 *
 * Rules:
 * - Spawn (only if dice == 6 or have card): token in base → entry position
 * - Move: token in play → advance by dice, exact finish in home lane
 * - Cannot move if no valid destination
 * - Cannot move if destination is friendly token (blocked)
 */
export function getLegalMoves(
  state: ServerGameState,
  playerId: string,
  diceRoll: number
): ServerLegalMove[] {
  const moves: ServerLegalMove[] = []
  const playerTokens = getPlayerTokens(state, playerId)
  const playerObj = state.players.find((p) => p.id === playerId)
  if (!playerObj) return moves

  const playerColor = playerObj.color

  // Option 1: Spawn a token from base (only if dice == 6)
  if (diceRoll === 6) {
    const baseTokens = playerTokens.filter((t) => t.state === 'in_base')
    if (baseTokens.length > 0) {
      const spawnEntry = getSpawnEntryPosition(playerColor)
      // Check if spawn entry is blocked by friendly token
      const blockedByFriendly = state.tokens.find(
        (t) =>
          t.state === 'on_track' &&
          t.position === spawnEntry &&
          t.playerId === playerId
      )
      if (!blockedByFriendly) {
        // Allow spawn; use first base token
        const spawnToken = baseTokens[0]
        const moveId = generateMoveId(spawnToken.id, spawnEntry)
        moves.push({
          id: moveId,
          tokenId: spawnToken.id,
          destination: spawnEntry,
          moveType: 'spawn',
        })
      }
    }
  }

  // Option 2: Move existing tokens in play
  for (const token of playerTokens) {
    if (token.state === 'on_track') {
      // Token is on main board; try to advance
      const newPos = token.position + diceRoll
      if (newPos < BOARD_SIZE) {
        // Still on main board
        const targetToken = findTokenAtPosition(state, newPos, token.id)
        if (!targetToken) {
          // Empty tile
          const moveId = generateMoveId(token.id, newPos)
          moves.push({
            id: moveId,
            tokenId: token.id,
            destination: newPos,
            moveType: 'move',
          })
        } else if (targetToken.playerId !== playerId && !isSafeTile(newPos)) {
          // Enemy token on non-safe tile: capture allowed
          const moveId = generateMoveId(token.id, newPos)
          moves.push({
            id: moveId,
            tokenId: token.id,
            destination: newPos,
            moveType: 'capture',
            capturedTokenId: targetToken.id,
          })
        }
        // If friendly token at destination, this move is blocked
      } else if (newPos >= BOARD_SIZE) {
        // Leaving main board; transition to home lane
        const overshoot = newPos - BOARD_SIZE
        const homeLanePos = overshoot - 1 // Adjust index
        if (isValidHomeLanePosition(homeLanePos)) {
          // Check if can finish exactly
          if (homeLanePos === HOME_LANE_SIZE - 1) {
            // Exact finish; this is the move
            const moveId = generateMoveId(token.id, -1) // -1 signals finish
            moves.push({
              id: moveId,
              tokenId: token.id,
              destination: -1,
              moveType: 'move', // Treat as regular move, but will mark as finished
            })
          } else if (homeLanePos < HOME_LANE_SIZE) {
            // Move to home lane (not exact finish)
            const targetHomeLane = findTokenAtHomeLanePosition(
              state,
              playerId,
              homeLanePos,
              token.id
            )
            if (!targetHomeLane) {
              const moveId = generateMoveId(token.id, homeLanePos)
              moves.push({
                id: moveId,
                tokenId: token.id,
                destination: homeLanePos,
                moveType: 'move',
              })
            }
          }
        }
      }
    } else if (token.state === 'in_home_lane') {
      // Token is in home lane; try to advance or finish
      const newPos = token.position + diceRoll
      if (canFinishExactly(token.position, diceRoll)) {
        // Exact finish
        const moveId = generateMoveId(token.id, -1)
        moves.push({
          id: moveId,
          tokenId: token.id,
          destination: -1,
          moveType: 'move',
        })
      } else if (newPos < HOME_LANE_SIZE) {
        // Advance within home lane
        const targetToken = findTokenAtHomeLanePosition(
          state,
          playerId,
          newPos,
          token.id
        )
        if (!targetToken) {
          const moveId = generateMoveId(token.id, newPos)
          moves.push({
            id: moveId,
            tokenId: token.id,
            destination: newPos,
            moveType: 'move',
          })
        }
      }
      // Else: can't move (would overshoot finish)
    }
  }

  return moves
}

/**
 * Resolve a chosen move: apply it to the state and return new state with events.
 * Does NOT handle turn advancement; that's the engine's job.
 */
export function resolveMove(
  state: ServerGameState,
  moveId: string
): { newState: ServerGameState; events: GameEvent[] } {
  const events: GameEvent[] = []

  // Find the legal move that matches this moveId
  // (In real code, we'd pass legalMoves from turn context, but for simplicity we recompute)
  const lastSeparatorIndex = moveId.lastIndexOf(':')
  const tokenId = lastSeparatorIndex >= 0 ? moveId.slice(0, lastSeparatorIndex) : moveId
  const token = state.tokens.find((t) => t.id === tokenId)
  if (!token) {
    throw new Error(`Token not found: ${moveId}`)
  }

  const newState = JSON.parse(JSON.stringify(state)) as ServerGameState
  const newToken = newState.tokens.find((t) => t.id === token.id)!

  const destinationText = lastSeparatorIndex >= 0 ? moveId.slice(lastSeparatorIndex + 1) : ''
  const destination = Number(destinationText)

  // Determine new state based on token current state
  if (destination === -1) {
    // Finish move
    newToken.state = 'finished'
    newToken.position = HOME_LANE_SIZE - 1
    events.push({
      type: 'token_finished',
      timestamp: Date.now(),
      playerId: token.playerId,
      details: { tokenId: token.id },
    })
  } else if (token.state === 'in_base') {
    // Spawn move
    const player = newState.players.find((p) => p.id === token.playerId)!
    newToken.state = 'on_track'
    newToken.position = getSpawnEntryPosition(player.color)
    events.push({
      type: 'token_moved',
      timestamp: Date.now(),
      playerId: token.playerId,
      details: { tokenId: token.id, from: 'in_base', to: newToken.position },
    })
  } else if (token.state === 'on_track') {
    const oldPos = token.position
    if (destination < BOARD_SIZE) {
      // Stay on track
      newToken.position = destination

      // Check for capture
      const victim = state.tokens.find(
        (t) =>
          t.state === 'on_track' &&
          t.position === destination &&
          t.playerId !== token.playerId
      )
      if (victim && !isSafeTile(destination)) {
        // Capture!
        const newVictim = newState.tokens.find((t) => t.id === victim.id)!
        newVictim.state = 'in_base'
        newVictim.position = 0
        events.push({
          type: 'token_captured',
          timestamp: Date.now(),
          playerId: victim.playerId,
          details: { tokenId: victim.id, capturedBy: token.playerId },
        })
      }

      events.push({
        type: 'token_moved',
        timestamp: Date.now(),
        playerId: token.playerId,
        details: { tokenId: token.id, from: oldPos, to: destination, captured: !!victim },
      })
    } else {
      // Transition to home lane
      newToken.state = 'in_home_lane'
      const distPastEntry = destination - BOARD_SIZE
      newToken.position = distPastEntry
      events.push({
        type: 'token_moved',
        timestamp: Date.now(),
        playerId: token.playerId,
        details: { tokenId: token.id, from: `track:${oldPos}`, to: `homeLane:${distPastEntry}` },
      })
    }
  } else if (token.state === 'in_home_lane') {
    const oldPos = token.position
    if (destination === -1) {
      newToken.state = 'finished'
    } else {
      newToken.position = destination
    }
    events.push({
      type: 'token_moved',
      timestamp: Date.now(),
      playerId: token.playerId,
      details: { tokenId: token.id, from: oldPos, to: destination },
    })
  }

  newState.version++
  newState.updatedAt = Date.now()
  newState.events = [...newState.events, ...events].slice(-20) // Keep last 20 events

  return { newState, events }
}

/**
 * Check if a player has won (all 4 tokens finished).
 */
export function checkWin(state: ServerGameState, playerId: string): boolean {
  const playerTokens = getPlayerTokens(state, playerId)
  return playerTokens.length === 4 && playerTokens.every((t) => t.state === 'finished')
}

/**
 * Advance turn to next player.
 * Handles roll==6 extra turn rule (if no extra turn, advance).
 */
export function getNextPlayer(
  state: ServerGameState,
  diceRoll: number,
  hasExtraTurn: boolean
): number {
  if (diceRoll === 6 && !hasExtraTurn) {
    // Extra turn for current player
    return state.currentPlayerIndex
  }
  // Next player
  return (state.currentPlayerIndex + 1) % state.players.length
}
