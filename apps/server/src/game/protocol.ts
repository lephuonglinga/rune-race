/**
 * WebSocket event handlers and room management.
 * Supports lobby rooms with 2-4 players, then starts the authoritative game.
 */

import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { Player, RoomSnapshot, RoomStatus } from '@rune-race/shared'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@rune-race/shared'
import { validateCommand } from '@rune-race/shared'
import { GameEngine } from './engine'
import { createInitialGameState } from './factory'
import type { ServerGameState } from './types'

const MAX_PLAYERS_PER_ROOM = 4
const MIN_PLAYERS_TO_START = 2

interface RoomRecord {
  roomId: string
  status: RoomStatus
  players: Player[]
  hostPlayerId: string | null
  gameState: ServerGameState | null
  engine: GameEngine | null
}

function createRoomRecord(roomId: string): RoomRecord {
  return {
    roomId,
    status: 'lobby',
    players: [],
    hostPlayerId: null,
    gameState: null,
    engine: null,
  }
}

function toRoomSnapshot(room: RoomRecord): RoomSnapshot {
  return {
    roomId: room.roomId,
    status: room.status,
    players: room.players,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    hostPlayerId: room.hostPlayerId,
    canStart: room.status === 'lobby' && room.players.length >= MIN_PLAYERS_TO_START,
  }
}

/**
 * Room manager: tracks games and rooms per roomId.
 */
export class RoomManager {
  private rooms: Map<string, RoomRecord> = new Map()
  private players: Map<string, string> = new Map() // playerId -> roomId

  getRoom(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId)
  }

  getRoomSnapshot(roomId: string): RoomSnapshot | undefined {
    const room = this.rooms.get(roomId)
    return room ? toRoomSnapshot(room) : undefined
  }

  getPlayerRoom(playerId: string): string | undefined {
    return this.players.get(playerId)
  }

  ensureRoom(roomId: string): RoomRecord {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = createRoomRecord(roomId)
      this.rooms.set(roomId, room)
    }
    return room
  }

  joinRoom(player: Player, roomId: string): RoomSnapshot {
    const room = this.ensureRoom(roomId)

    if (room.status !== 'lobby') {
      throw new Error('Room has already started')
    }

    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      throw new Error('Room is full')
    }

    if (room.players.some((existingPlayer) => existingPlayer.id === player.id)) {
      return toRoomSnapshot(room)
    }

    if (room.players.some((existingPlayer) => existingPlayer.color === player.color)) {
      throw new Error('Color already taken in this room')
    }

    room.players.push(player)
    room.hostPlayerId ??= player.id
    this.players.set(player.id, roomId)
    return toRoomSnapshot(room)
  }

  startRoom(roomId: string, playerId: string): ServerGameState {
    const room = this.rooms.get(roomId)
    if (!room) {
      throw new Error('Room not found')
    }

    if (room.status !== 'lobby') {
      throw new Error('Room is not in lobby state')
    }

    if (room.hostPlayerId !== playerId) {
      throw new Error('Only the host can start the game')
    }

    if (room.players.length < MIN_PLAYERS_TO_START) {
      throw new Error('At least two players are required to start')
    }

    const state = createInitialGameState(roomId, room.players)
    room.status = 'playing'
    room.gameState = state
    room.engine = new GameEngine(state)
    return state
  }

  updateRoomState(roomId: string, state: ServerGameState): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.gameState = state
  }

  getEngine(roomId: string): GameEngine | undefined {
    return this.rooms.get(roomId)?.engine ?? undefined
  }

  getGameState(roomId: string): ServerGameState | undefined {
    return this.rooms.get(roomId)?.gameState ?? undefined
  }

  removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.engine?.shutdown()
    for (const player of room.players) {
      this.players.delete(player.id)
    }
    this.rooms.delete(roomId)
  }
}

/**
 * Setup Socket.IO event handlers.
 */
export function setupGameHandlers(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`[Socket] Client connected: ${socket.id}`)

    socket.on('game:join', async (payload) => {
      try {
        const command = validateCommand('game:join', payload)
        const { playerId, playerName, roomId, color } = command

        const player: Player = { id: playerId, name: playerName, color }
        const snapshot = roomManager.joinRoom(player, roomId)

        socket.join(roomId)
        socket.emit('game:connected', { playerId, roomId })
        socket.emit('game:room_snapshot', snapshot)
        io.to(roomId).emit('game:room_snapshot', snapshot)
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'Invalid join payload',
          code: 'JOIN_FAILED',
        })
      }
    })

    socket.on('game:start', async (payload) => {
      try {
        const command = validateCommand('game:start', payload)
        const { playerId, roomId } = command

        const state = roomManager.startRoom(roomId, playerId)
        roomManager.updateRoomState(roomId, state)

        const roomSnapshot = roomManager.getRoomSnapshot(roomId)
        if (roomSnapshot) {
          io.to(roomId).emit('game:room_snapshot', roomSnapshot)
        }

        io.to(roomId).emit('game:state_snapshot', {
          version: state.version,
          state,
          events: state.events,
        })
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'Start failed',
          code: 'START_FAILED',
        })
      }
    })

    socket.on('game:roll', async (payload) => {
      try {
        const command = validateCommand('game:roll', payload)
        const { playerId } = command

        const roomId = roomManager.getPlayerRoom(playerId)
        if (!roomId) {
          socket.emit('game:error', {
            message: 'Player not in a room',
            code: 'NOT_IN_ROOM',
          })
          return
        }

        const engine = roomManager.getEngine(roomId)
        if (!engine) {
          socket.emit('game:error', {
            message: 'Game has not started yet',
            code: 'GAME_NOT_STARTED',
          })
          return
        }

        const result = engine.executeCommand('game:roll', playerId, {})
        if (!result.success) {
          socket.emit('game:error', {
            message: result.error?.message || 'Roll failed',
            code: result.error?.code || 'UNKNOWN_ERROR',
          })
          return
        }

        if (result.nextState) {
          roomManager.updateRoomState(roomId, result.nextState)
          io.to(roomId).emit('game:state_snapshot', {
            version: result.nextState.version,
            state: result.nextState,
            events: result.events,
          })
        }
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'Roll failed',
          code: 'ROLL_ERROR',
        })
      }
    })

    socket.on('game:choose_move', async (payload) => {
      try {
        const command = validateCommand('game:choose_move', payload)
        const { playerId, moveId } = command

        const roomId = roomManager.getPlayerRoom(playerId)
        if (!roomId) {
          socket.emit('game:error', {
            message: 'Player not in a room',
            code: 'NOT_IN_ROOM',
          })
          return
        }

        const engine = roomManager.getEngine(roomId)
        if (!engine) {
          socket.emit('game:error', {
            message: 'Game has not started yet',
            code: 'GAME_NOT_STARTED',
          })
          return
        }

        const result = engine.executeCommand('game:choose_move', playerId, { moveId })
        if (!result.success) {
          socket.emit('game:error', {
            message: result.error?.message || 'Move choice failed',
            code: result.error?.code || 'UNKNOWN_ERROR',
          })
          return
        }

        if (result.nextState) {
          roomManager.updateRoomState(roomId, result.nextState)
          io.to(roomId).emit('game:state_snapshot', {
            version: result.nextState.version,
            state: result.nextState,
            events: result.events,
          })
        }
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'Move choice failed',
          code: 'MOVE_ERROR',
        })
      }
    })

    socket.on('game:sync_request', (payload) => {
      try {
        const command = validateCommand('game:sync_request', payload)
        const { playerId } = command

        const roomId = roomManager.getPlayerRoom(playerId)
        if (!roomId) {
          socket.emit('game:error', {
            message: 'Player not in a room',
            code: 'NOT_IN_ROOM',
          })
          return
        }

        const state = roomManager.getGameState(roomId)
        const roomSnapshot = roomManager.getRoomSnapshot(roomId)

        if (state) {
          socket.emit('game:state_snapshot', {
            version: state.version,
            state,
            events: state.events,
          })
          return
        }

        if (roomSnapshot) {
          socket.emit('game:room_snapshot', roomSnapshot)
          return
        }

        socket.emit('game:error', {
          message: 'Room not found',
          code: 'ROOM_NOT_FOUND',
        })
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'Sync failed',
          code: 'SYNC_ERROR',
        })
      }
    })

    socket.on('game:ping', (payload) => {
      try {
        validateCommand('game:ping', payload)
      } catch (error) {
        console.error('[Ping] Error:', error)
      }
    })

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
  })
}
