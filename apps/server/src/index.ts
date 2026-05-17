import Fastify from 'fastify'
import { Server as SocketIOServer } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@rune-race/shared'
import { setupGameHandlers, RoomManager } from './game/protocol'

const fastify = Fastify({ logger: true })
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
  cors: {
    origin: '*',
  },
})

// Game state manager
const roomManager = new RoomManager()

// HTTP Routes
fastify.get('/', async (_request, _reply) => {
  return { message: 'Rune Race Server', status: 'running' }
})

fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

/**
 * Create a lobby room for development/testing.
 * Endpoint: POST /dev/create-room
 * Response: { roomId }
 */
fastify.post('/dev/create-room', async (_request, _reply) => {
  const roomId = `room-${Date.now()}`
  roomManager.ensureRoom(roomId)

  return {
    roomId,
  }
})

// Setup WebSocket game handlers
setupGameHandlers(io, roomManager)

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('Server running on http://localhost:3000')
    console.log('Socket.IO enabled on ws://localhost:3000')
    console.log('Dev endpoint: POST http://localhost:3000/dev/create-room')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
