/**
 * Unit tests for game resolver and board logic.
 * Tests critical game rules: moves, captures, home lane, finishes.
 *
 * Run: npm test -- --run resolver.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getLegalMoves, resolveMove, checkWin } from './resolver'
import { createTestGameState } from './factory'
import { GameRNG } from './rng'
import type { ServerGameState } from './types'
import { getSpawnEntryPosition, getHomeLaneEntryPosition } from './board'

describe('Game Resolver - Legal Moves', () => {
  let gameState: ServerGameState

  beforeEach(() => {
    gameState = createTestGameState('test-room')
    gameState.turn.diceResult = 3
  })

  it('should allow spawn move when rolling 6 from base', () => {
    gameState.turn.diceResult = 6
    const playerId = gameState.players[0].id
    const moves = getLegalMoves(gameState, playerId, 6)

    expect(moves).toHaveLength(1)
    expect(moves[0].moveType).toBe('spawn')
  })

  it('should not allow spawn move when rolling non-6 from base', () => {
    gameState.turn.diceResult = 3
    const playerId = gameState.players[0].id
    const moves = getLegalMoves(gameState, playerId, 3)

    // No tokens in play, no moves available
    expect(moves).toHaveLength(0)
  })

  it('should allow move from track when dice roll moves within board', () => {
    const playerId = gameState.players[0].id
    const playerToken = gameState.tokens.find((t) => t.playerId === playerId && t.state === 'in_base')!

    // Spawn token first
    playerToken.state = 'on_track'
    playerToken.position = 10

    gameState.turn.diceResult = 5
    const moves = getLegalMoves(gameState, playerId, 5)

    expect(moves).toHaveLength(1)
    expect(moves[0].moveType).toBe('move')
    expect(moves[0].destination).toBe(15)
  })

  it('should detect capture when landing on opponent token', () => {
    const playerId1 = gameState.players[0].id
    const playerId2 = gameState.players[1].id

    // Position player 1 token
    const token1 = gameState.tokens.find((t) => t.playerId === playerId1 && t.state === 'in_base')!
    token1.state = 'on_track'
    token1.position = 10

    // Position player 2 token at destination
    const token2 = gameState.tokens.find((t) => t.playerId === playerId2 && t.state === 'in_base')!
    token2.state = 'on_track'
    token2.position = 16

    gameState.turn.diceResult = 6
    const moves = getLegalMoves(gameState, playerId1, 6)

    const captureMove = moves.find((move) => move.moveType === 'capture')
    expect(captureMove).toBeDefined()
    expect(captureMove?.capturedTokenId).toBe(token2.id)
  })

  it('should not allow capture on safe tiles', () => {
    const playerId1 = gameState.players[0].id
    const playerId2 = gameState.players[1].id

    // SAFE_POSITIONS = [0, 5, 10, 15, 20, 25, 30, 35]
    // Position player 1 token
    const token1 = gameState.tokens.find((t) => t.playerId === playerId1 && t.state === 'in_base')!
    token1.state = 'on_track'
    token1.position = 10

    // Position player 2 token at safe tile
    const token2 = gameState.tokens.find((t) => t.playerId === playerId2 && t.state === 'in_base')!
    token2.state = 'on_track'
    token2.position = 15

    gameState.turn.diceResult = 5
    const moves = getLegalMoves(gameState, playerId1, 5)

    // Safe tile, so capture not available (friendly token blocks)
    expect(moves).toHaveLength(0)
  })

  it('should allow multiple move options when applicable', () => {
    const playerId = gameState.players[0].id

    // Spawn multiple tokens in play
    const tokens = gameState.tokens.filter((t) => t.playerId === playerId && t.state === 'in_base')
    tokens[0].state = 'on_track'
    tokens[0].position = 5

    tokens[1].state = 'on_track'
    tokens[1].position = 10

    gameState.turn.diceResult = 6
    const moves = getLegalMoves(gameState, playerId, 6)

    // Should be able to spawn or move either token
    expect(moves.length).toBeGreaterThan(1)
  })
})

describe('Game Resolver - Move Resolution', () => {
  let gameState: ServerGameState

  beforeEach(() => {
    gameState = createTestGameState('test-room')
  })

  it('should resolve a regular move', () => {
    const playerId = gameState.players[0].id
    const token = gameState.tokens.find((t) => t.playerId === playerId && t.state === 'in_base')!

    // Spawn token
    token.state = 'on_track'
    token.position = 10
    gameState.turn.diceResult = 5

    const moveId = `${token.id}:15`
    const { newState, events } = resolveMove(gameState, moveId)

    const updatedToken = newState.tokens.find((t) => t.id === token.id)!
    expect(updatedToken.position).toBe(15)
    expect(events.some((e) => e.type === 'token_moved')).toBe(true)
  })

  it('should resolve a capture', () => {
    const playerId1 = gameState.players[0].id
    const playerId2 = gameState.players[1].id

    // Position tokens
    const token1 = gameState.tokens.find((t) => t.playerId === playerId1 && t.state === 'in_base')!
    token1.state = 'on_track'
    token1.position = 10

    const token2 = gameState.tokens.find((t) => t.playerId === playerId2 && t.state === 'in_base')!
    token2.state = 'on_track'
    token2.position = 16

    gameState.turn.diceResult = 6

    const moveId = `${token1.id}:16`
    const { newState, events } = resolveMove(gameState, moveId)

    const updatedToken2 = newState.tokens.find((t) => t.id === token2.id)!
    expect(updatedToken2.state).toBe('in_base')
    expect(updatedToken2.position).toBe(0)
    expect(events.some((e) => e.type === 'token_captured')).toBe(true)
  })

  it('should mark token as finished on exact move', () => {
    const playerId = gameState.players[0].id
    const token = gameState.tokens.find((t) => t.playerId === playerId && t.state === 'in_base')!

    // Put token in home lane at position 2 (one away from finish at 3)
    token.state = 'in_home_lane'
    token.position = 2
    gameState.turn.diceResult = 1

    const moveId = `${token.id}:-1` // -1 signals finish
    const { newState, events } = resolveMove(gameState, moveId)

    const updatedToken = newState.tokens.find((t) => t.id === token.id)!
    expect(updatedToken.state).toBe('finished')
    expect(events.some((e) => e.type === 'token_finished')).toBe(true)
  })

  it('should increment state version on resolution', () => {
    const initialVersion = gameState.version
    const playerId = gameState.players[0].id
    const token = gameState.tokens.find((t) => t.playerId === playerId && t.state === 'in_base')!

    token.state = 'on_track'
    token.position = 10
    gameState.turn.diceResult = 3

    const moveId = `${token.id}:13`
    const { newState } = resolveMove(gameState, moveId)

    expect(newState.version).toBe(initialVersion + 1)
  })
})

describe('Game Resolver - Win Conditions', () => {
  let gameState: ServerGameState

  beforeEach(() => {
    gameState = createTestGameState('test-room')
  })

  it('should detect win when all 4 tokens finished', () => {
    const playerId = gameState.players[0].id
    const playerTokens = gameState.tokens.filter((t) => t.playerId === playerId)

    // Mark all tokens as finished
    for (const token of playerTokens) {
      token.state = 'finished'
    }

    const hasWon = checkWin(gameState, playerId)
    expect(hasWon).toBe(true)
  })

  it('should not detect win if any token not finished', () => {
    const playerId = gameState.players[0].id
    const playerTokens = gameState.tokens.filter((t) => t.playerId === playerId)

    // Mark 3 tokens as finished
    for (let i = 0; i < 3; i++) {
      playerTokens[i].state = 'finished'
    }
    // Leave last token in base
    playerTokens[3].state = 'in_base'

    const hasWon = checkWin(gameState, playerId)
    expect(hasWon).toBe(false)
  })
})

describe('Board Logic - Position Validation', () => {
  it('should return correct spawn entry positions', () => {
    expect(getSpawnEntryPosition('red')).toBe(0)
    expect(getSpawnEntryPosition('blue')).toBe(10)
    expect(getSpawnEntryPosition('green')).toBe(20)
    expect(getSpawnEntryPosition('yellow')).toBe(30)
  })

  it('should return correct home lane entry positions', () => {
    expect(getHomeLaneEntryPosition('red')).toBe(5)
    expect(getHomeLaneEntryPosition('blue')).toBe(15)
    expect(getHomeLaneEntryPosition('green')).toBe(25)
    expect(getHomeLaneEntryPosition('yellow')).toBe(35)
  })
})

describe('RNG - Seeded Randomness', () => {
  it('should generate deterministic sequence with same seed', () => {
    const rng1 = new GameRNG(12345)
    const rng2 = new GameRNG(12345)

    const values1 = [rng1.rollDice(), rng1.rollDice(), rng1.rollDice()]
    const values2 = [rng2.rollDice(), rng2.rollDice(), rng2.rollDice()]

    expect(values1).toEqual(values2)
  })

  it('should generate different sequences with different seeds', () => {
    const rng1 = new GameRNG(12345)
    const rng2 = new GameRNG(54321)

    const values1 = [rng1.rollDice(), rng1.rollDice(), rng1.rollDice()]
    const values2 = [rng2.rollDice(), rng2.rollDice(), rng2.rollDice()]

    expect(values1).not.toEqual(values2)
  })

  it('should generate values in valid d6 range', () => {
    const rng = new GameRNG(999)

    for (let i = 0; i < 100; i++) {
      const roll = rng.rollDice()
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(6)
    }
  })
})
