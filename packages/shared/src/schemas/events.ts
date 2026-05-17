/**
 * Runtime validation schemas for WebSocket events using Zod.
 * Server uses these to validate all incoming client commands.
 * Client can use for optional client-side validation.
 */

import { z } from 'zod'

// Player color enum
const PlayerColorSchema = z.enum(['red', 'blue', 'green', 'yellow'])

// Client -> Server command schemas (what server trusts)
export const JoinGameSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(50),
  roomId: z.string().min(1),
  color: PlayerColorSchema,
})
export type JoinGameCommand = z.infer<typeof JoinGameSchema>

export const RollDiceSchema = z.object({
  playerId: z.string().min(1),
})
export type RollDiceCommand = z.infer<typeof RollDiceSchema>

export const ChooseMoveSchema = z.object({
  playerId: z.string().min(1),
  moveId: z.string().min(1),
})
export type ChooseMoveCommand = z.infer<typeof ChooseMoveSchema>

export const SyncRequestSchema = z.object({
  playerId: z.string().min(1),
})
export type SyncRequestCommand = z.infer<typeof SyncRequestSchema>

export const StartGameSchema = z.object({
  playerId: z.string().min(1),
  roomId: z.string().min(1),
})
export type StartGameCommand = z.infer<typeof StartGameSchema>

export const PingSchema = z.object({
  playerId: z.string().min(1),
})
export type PingCommand = z.infer<typeof PingSchema>

// Utility: validate command payloads
export const validateCommand = (command: string, payload: unknown) => {
  const schemas: Record<string, z.ZodSchema> = {
    'game:join': JoinGameSchema,
    'game:roll': RollDiceSchema,
    'game:choose_move': ChooseMoveSchema,
    'game:sync_request': SyncRequestSchema,
    'game:start': StartGameSchema,
    'game:ping': PingSchema,
  }

  const schema = schemas[command]
  if (!schema) {
    throw new Error(`Unknown command: ${command}`)
  }

  return schema.parse(payload)
}
