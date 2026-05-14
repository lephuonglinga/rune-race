import { z } from 'zod'

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.enum(['red', 'blue', 'green', 'yellow']),
})

export const GameStateSchema = z.object({
  roomId: z.string(),
  players: z.array(PlayerSchema),
  status: z.enum(['waiting', 'playing', 'finished']),
})
