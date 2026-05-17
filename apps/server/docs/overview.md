# Overview

Rune Race uses a server-authoritative lobby + room model.

## High-level flow

1. Client connects to Socket.IO.
2. Client joins a room with `game:join`.
3. Room stays in `lobby` until at least 2 players join.
4. Host can start the game with `game:start`.
5. Server creates the initial game state and broadcasts a `game:state_snapshot`.
6. Gameplay continues through `game:roll` and `game:choose_move`.
7. Every accepted action causes a new snapshot broadcast.

## Important rules

- Rooms support 2-4 players.
- The first player to join becomes host.
- Only the host can start the game.
- The server rejects direct state updates from clients.
- All commands are validated with Zod before execution.
- Client-side UI should treat server snapshots as the source of truth.

## Shared contracts

The frontend should import these shared types from `@rune-race/shared`:

- `ClientToServerEvents`
- `ServerToClientEvents`
- `GameState`
- `RoomSnapshot`
- `Player`
- `Token`
- `Turn`
- `LegalMove`
- `GameEvent`
- `validateCommand`

## URLs

- `GET /` -> server status
- `GET /health` -> health check
- `POST /dev/create-room` -> dev room helper
