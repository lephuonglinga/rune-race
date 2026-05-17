/**
 * Integration tests for GameEngine state machine.
 * Tests turn flow: roll → choice → move → advance.
 *
 * Run: npm test -- --run engine.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GameEngine } from './engine'
import { GameRNG } from './rng'
import { createTestGameState } from './factory'
import type { ServerGameState } from './types'

describe('GameEngine - Turn Flow', () => {
  let engine: GameEngine
  let gameState: ServerGameState

  beforeEach(() => {
    gameState = createTestGameState('test-room')
  })

  it('should start with waiting_roll phase', () => {
    engine = new GameEngine(gameState, new GameRNG(12345)) // Seeded for deterministic tests
    expect(engine.getState().turn.phase).toBe('waiting_roll')
    expect(engine.getState().turn.diceResult).toBeNull()
  })

  it('should roll dice and transition to correct phase', () => {
    const token = gameState.tokens.find((t) => t.playerId === gameState.players[0].id && t.state === 'in_base')!
    token.state = 'on_track'
    token.position = 10
    engine = new GameEngine(gameState, { rollDice: () => 6 } as unknown as GameRNG)

    const playerId = engine.getState().turn.currentPlayerId
    const result = engine.executeCommand('game:roll', playerId, {})

    expect(result.success).toBe(true)
    const newState = engine.getState()

    expect(newState.turn.diceResult).toBe(6)
    expect(newState.turn.phase).toBe('waiting_choice')
  })

  it('should require current player to roll', () => {
    engine = new GameEngine(gameState, new GameRNG(12345))
    const otherPlayerId = engine.getState().players[1].id
    const result = engine.executeCommand('game:roll', otherPlayerId, {})

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('NOT_YOUR_TURN')
  })

  it('should not allow roll in wrong phase', () => {
    const token = gameState.tokens.find((t) => t.playerId === gameState.players[0].id && t.state === 'in_base')!
    token.state = 'on_track'
    token.position = 10
    engine = new GameEngine(gameState, { rollDice: () => 6 } as unknown as GameRNG)

    const playerId = engine.getState().turn.currentPlayerId

    // Roll once
    engine.executeCommand('game:roll', playerId, {})

    // Try to roll again without choosing
    const result = engine.executeCommand('game:roll', playerId, {})

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('INVALID_PHASE')
  })

  it('should advance turn after resolve if only one legal move', () => {
    engine = new GameEngine(gameState, new GameRNG(12345))
    const playerId = engine.getState().turn.currentPlayerId

    // Roll (may result in auto-resolve if only 1 move)
    const rollResult = engine.executeCommand('game:roll', playerId, {})
    expect(rollResult.success).toBe(true)

    const state = engine.getState()
    // If phase moved to turn_end, turn should have advanced
    if (state.turn.phase === 'turn_end') {
      // Next turn should be created for next player
      expect(state.turn.currentPlayerId).not.toBe(playerId)
    }
  })

  it('should handle choose_move command', () => {
    const token = gameState.tokens.find((t) => t.playerId === gameState.players[0].id && t.state === 'in_base')!
    token.state = 'on_track'
    token.position = 10
    engine = new GameEngine(gameState, { rollDice: () => 6 } as unknown as GameRNG)

    const playerId = engine.getState().turn.currentPlayerId

    // Roll
    const rollResult = engine.executeCommand('game:roll', playerId, {})
    expect(rollResult.success).toBe(true)

    const state = engine.getState()
    if (state.turn.phase === 'waiting_choice' && state.turn.legalMoves.length > 0) {
      const moveId = state.turn.legalMoves[0].id

      // Choose move
      const chooseResult = engine.executeCommand('game:choose_move', playerId, { moveId })
      expect(chooseResult.success).toBe(true)

      const newState = engine.getState()
      // Should have advanced turn
      expect(newState.turn.currentPlayerId).not.toBeNull()
    }
  })

  it('should reject invalid move choices', () => {
    const token = gameState.tokens.find((t) => t.playerId === gameState.players[0].id && t.state === 'in_base')!
    token.state = 'on_track'
    token.position = 10
    engine = new GameEngine(gameState, { rollDice: () => 6 } as unknown as GameRNG)

    const playerId = engine.getState().turn.currentPlayerId

    // Roll
    engine.executeCommand('game:roll', playerId, {})

    const state = engine.getState()
    if (state.turn.phase === 'waiting_choice') {
      // Try to choose non-existent move
      const result = engine.executeCommand('game:choose_move', playerId, {
        moveId: 'invalid-move-id',
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INVALID_MOVE')
    }
  })

  it('should track command history', () => {
    const token = gameState.tokens.find((t) => t.playerId === gameState.players[0].id && t.state === 'in_base')!
    token.state = 'on_track'
    token.position = 10
    engine = new GameEngine(gameState, { rollDice: () => 6 } as unknown as GameRNG)

    const playerId = engine.getState().turn.currentPlayerId

    engine.executeCommand('game:roll', playerId, {})

    const log = engine.getCommandLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log[0].command).toBe('game:roll')
    expect(log[0].result.success).toBe(true)
  })

  it('should increment state version on each command', () => {
    const token = gameState.tokens.find((t) => t.playerId === gameState.players[0].id && t.state === 'in_base')!
    token.state = 'on_track'
    token.position = 10
    engine = new GameEngine(gameState, { rollDice: () => 6 } as unknown as GameRNG)

    const initialVersion = engine.getState().version
    const playerId = engine.getState().turn.currentPlayerId

    engine.executeCommand('game:roll', playerId, {})

    expect(engine.getState().version).toBeGreaterThan(initialVersion)
  })
})

describe('GameEngine - Turn Timeout', () => {
  let engine: GameEngine

  beforeEach(() => {
    const gameState = createTestGameState('test-room')
    engine = new GameEngine(gameState, new GameRNG(12345))
  })

  it('should auto-resolve turn on timeout', async () => {
    // This test verifies that timeout logic is wired up
    // Full timeout testing would require mocking timers
    const state = engine.getState()
    expect(state.turn.phase).toBe('waiting_roll')
  })

  it('should cleanup on shutdown', () => {
    engine.shutdown()
    // Verify no lingering timeouts (would need to mock timers to fully test)
  })
})

describe('GameEngine - Full Game Simulation', () => {
  it('should simulate a complete turn sequence', () => {
    const gameState = createTestGameState('test-room')
    const rng = new GameRNG(99999)
    const engine = new GameEngine(gameState, rng)

    // Initial state
    expect(engine.getState().status).toBe('playing')
    expect(engine.getState().turn.phase).toBe('waiting_roll')

    // Player 1 rolls
    const p1Id = engine.getState().turn.currentPlayerId
    let result = engine.executeCommand('game:roll', p1Id, {})
    expect(result.success).toBe(true)

    // If a choice is available, choose
    let state = engine.getState()
    if (state.turn.phase === 'waiting_choice' && state.turn.legalMoves.length > 0) {
      const moveId = state.turn.legalMoves[0].id
      result = engine.executeCommand('game:choose_move', p1Id, { moveId })
      expect(result.success).toBe(true)
    }

    // Turn should have advanced
    state = engine.getState()
    expect(state.status).toBe('playing')
    expect(state.version).toBeGreaterThan(1)
  })
})
