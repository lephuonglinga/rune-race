import Fastify from 'fastify'
import { Server as SocketIOServer } from 'socket.io'

const fastify = Fastify({ logger: true })
const io = new SocketIOServer(fastify.server, {
  cors: {
    origin: '*',
  },
})

// HTTP Routes
fastify.get('/', async (_request, _reply) => {
  return { message: 'Rune Race Server', status: 'running' }
})

fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('Server running on http://localhost:3000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
