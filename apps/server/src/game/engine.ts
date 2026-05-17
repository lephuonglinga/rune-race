/**
 * Game Engine: State machine and turn orchestration.
 * Coordinates command execution, validation, resolver calls, and turn timeouts.
 * Central coordinator for all game logic.
 */

import type { Turn } from '@rune-race/shared'
import type { ServerGameState, CommandResult } from './types'
import { generateTurnId } from './types'
import { GameRNG, globalRNG } from './rng'
import { getLegalMoves, resolveMove, checkWin, getNextPlayer } from './resolver'

/**
 * Turn timeout configuration (in milliseconds).
 */
const TURN_TIMEOUT_MS = 30 * 1000 // 30 seconds

/**
 * GameEngine class: orchestrates all turn logic.
 */
export class GameEngine {
  private state: ServerGameState
  private rng: GameRNG
  private turnTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private commandLog: Array<{
    turnId: string
    command: string
    payload: unknown
    result: CommandResult
    timestamp: number
  }> = []

  constructor(initialState: ServerGameState, rng?: GameRNG) {
    this.state = initialState
    this.rng = rng || globalRNG
  }

  /**
   * Get current game state.
   */
  getState(): ServerGameState {
    return this.state
  }

  /**
   * Execute a command (roll, choose_move, etc.).
   * Validates preconditions, routes to appropriate handler, logs result.
   */
  executeCommand(
    command: string,
    playerId: string,
    payload: unknown
  ): CommandResult {
    // Precondition: game must be playing
    if (this.state.status !== 'playing') {
      return {
        success: false,
        error: {
          code: 'GAME_NOT_PLAYING',
          message: 'Game is not in playing state',
        },
        events: [],
      }
    }

    // Precondition: it must be current player's turn
    if (this.state.turn.currentPlayerId !== playerId) {
      return {
        success: false,
        error: {
          code: 'NOT_YOUR_TURN',
          message: 'It is not your turn',
        },
        events: [],
      }
    }

    let result: CommandResult

    switch (command) {
      case 'game:roll':
        result = this.handleRoll(playerId)
        break
      case 'game:choose_move':
        result = this.handleChooseMove(playerId, payload as { moveId: string })
        break
      default:
        result = {
          success: false,
          error: {
            code: 'UNKNOWN_COMMAND',
            message: `Unknown command: ${command}`,
          },
          events: [],
        }
    }

    // Log command
    this.commandLog.push({
      turnId: this.state.turn.id,
      command,
      payload,
      result,
      timestamp: Date.now(),
    })

    // Update state if successful
    if (result.success && result.nextState) {
      this.state = result.nextState
    }

    return result
  }

  /**
   * Handle roll command.
   * Validates phase, rolls dice, computes legal moves, transitions to next phase.
   */
  private handleRoll(playerId: string): CommandResult {
    // Precondition: must be in waiting_roll phase
    if (this.state.turn.phase !== 'waiting_roll') {
      return {
        success: false,
        error: {
          code: 'INVALID_PHASE',
          message: `Cannot roll in ${this.state.turn.phase} phase`,
        },
        events: [],
      }
    }

    const newState = JSON.parse(JSON.stringify(this.state)) as ServerGameState

    // Roll dice server-side
    const diceRoll = this.rng.rollDice()
    newState.turn.diceResult = diceRoll

    // Compute legal moves
    const legalMoves = getLegalMoves(newState, playerId, diceRoll)

    // Update turn context
    newState.turn.legalMoves = legalMoves.map((m) => ({
      id: m.id,
      tokenId: m.tokenId,
      destination: m.destination,
      moveType: m.moveType,
      capturedTokenId: m.capturedTokenId,
    }))

    // Determine next phase
    if (legalMoves.length === 0) {
      // No legal moves; skip turn
      newState.turn.phase = 'turn_end'
    } else if (legalMoves.length === 1) {
      // Single move option; auto-resolve
      const moveId = legalMoves[0].id
      const { newState: resolvedState, events } = resolveMove(newState, moveId)
      newState.tokens = resolvedState.tokens
      newState.version = resolvedState.version
      newState.events = [...newState.events, ...events]
      newState.turn.phase = 'turn_end'

      // Check win condition
      if (checkWin(newState, playerId)) {
        newState.status = 'finished'
        newState.winnerId = playerId
      }
    } else {
      // Multiple move options; wait for choice
      newState.turn.phase = 'waiting_choice'
    }

    // Handle phase transition if ended
    if (newState.turn.phase === 'turn_end') {
      return this.endTurnAndAdvance(newState, playerId, diceRoll)
    }

    newState.version++
    newState.updatedAt = Date.now()

    // Set turn timeout
    this.setTurnTimeout(newState.turn.id, playerId)

    return {
      success: true,
      nextState: newState,
      events: [
        {
          type: 'dice_roll',
          timestamp: Date.now(),
          playerId,
          details: { diceRoll, legalMoves: legalMoves.length },
        },
      ],
    }
  }

  /**
   * Handle choose_move command.
   * Validates move choice, resolves it, checks win, advances turn.
   */
  private handleChooseMove(
    playerId: string,
    payload: { moveId: string }
  ): CommandResult {
    const { moveId } = payload

    // Precondition: must be in waiting_choice phase
    if (this.state.turn.phase !== 'waiting_choice') {
      return {
        success: false,
        error: {
          code: 'INVALID_PHASE',
          message: `Cannot choose move in ${this.state.turn.phase} phase`,
        },
        events: [],
      }
    }

    // Validate move exists in legal moves
    const legalMove = this.state.turn.legalMoves.find((m) => m.id === moveId)
    if (!legalMove) {
      return {
        success: false,
        error: {
          code: 'INVALID_MOVE',
          message: `Move ${moveId} is not legal`,
        },
        events: [],
      }
    }

    const newState = JSON.parse(JSON.stringify(this.state)) as ServerGameState

    // Resolve the move
    const { newState: resolvedState, events } = resolveMove(newState, moveId)
    newState.tokens = resolvedState.tokens
    newState.version = resolvedState.version
    newState.events = [...newState.events, ...events]

    // Check win condition
    if (checkWin(newState, playerId)) {
      newState.status = 'finished'
      newState.winnerId = playerId
      newState.turn.phase = 'turn_end'
      return {
        success: true,
        nextState: newState,
        events,
      }
    }

    // Move to turn end
    newState.turn.phase = 'turn_end'
    return this.endTurnAndAdvance(newState, playerId, this.state.turn.diceResult!)
  }

  /**
   * Handle end of turn and advance to next player.
   * Manages extra-turn logic for roll==6.
   */
  private endTurnAndAdvance(
    state: ServerGameState,
    currentPlayerId: string,
    diceRoll: number
  ): CommandResult {
    const newState = state

    // Determine if extra turn (roll==6)
    const hasAlreadyUsedExtraTurn = false // TODO: track multiple 6s if needed
    const nextPlayerIndex = getNextPlayer(newState, diceRoll, hasAlreadyUsedExtraTurn)
    const nextPlayerId = newState.players[nextPlayerIndex].id

    // Create new turn
    const turnNumber = (parseInt(newState.turn.id.split(':')[2], 10) || 0) + 1
    const newTurn: Turn = {
      id: generateTurnId(newState.roomId, turnNumber),
      currentPlayerId: nextPlayerId,
      diceResult: null,
      phase: 'waiting_roll',
      legalMoves: [],
      startTime: Date.now(),
    }

    newState.turn = newTurn
    newState.phase = 'waiting_roll'
    newState.currentPlayerIndex = nextPlayerIndex
    newState.version++
    newState.updatedAt = Date.now()

    // Clear old timeout
    this.clearTurnTimeout(state.turn.id)

    // Set timeout for new turn
    this.setTurnTimeout(newTurn.id, nextPlayerId)

    return {
      success: true,
      nextState: newState,
      events: [
        {
          type: 'turn_advanced',
          timestamp: Date.now(),
          playerId: currentPlayerId,
          details: { turnNumber, wasExtraTurn: nextPlayerId === currentPlayerId },
        },
      ],
    }
  }

  /**
   * Set turn timeout for auto-resolution if player doesn't act.
   */
  private setTurnTimeout(turnId: string, playerId: string): void {
    // Clear any existing timeout
    this.clearTurnTimeout(turnId)

    const handle = setTimeout(() => {
      // Auto-resolve: choose first legal move or pass
      if (this.state.turn.phase === 'waiting_choice' && this.state.turn.legalMoves.length > 0) {
        const result = this.executeCommand('game:choose_move', playerId, {
          moveId: this.state.turn.legalMoves[0].id,
        })
        console.log(`Auto-resolved turn ${turnId} for player ${playerId}:`, result)
      } else if (this.state.turn.phase === 'waiting_roll') {
        const result = this.executeCommand('game:roll', playerId, {})
        console.log(`Auto-rolled turn ${turnId} for player ${playerId}:`, result)
      }
    }, TURN_TIMEOUT_MS)

    this.turnTimeouts.set(turnId, handle)
  }

  /**
   * Clear turn timeout.
   */
  private clearTurnTimeout(turnId: string): void {
    const handle = this.turnTimeouts.get(turnId)
    if (handle) {
      clearTimeout(handle)
      this.turnTimeouts.delete(turnId)
    }
  }

  /**
   * Shutdown: clear all timeouts.
   */
  shutdown(): void {
    for (const handle of this.turnTimeouts.values()) {
      clearTimeout(handle)
    }
    this.turnTimeouts.clear()
  }

  /**
   * Get command log (for debugging/audit).
   */
  getCommandLog(): typeof this.commandLog {
    return this.commandLog
  }
}
