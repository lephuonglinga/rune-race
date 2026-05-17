# Socket.IO Contract

## Connection

- URL: `ws://localhost:3000`
- CORS origin: `*`
- Namespace: default namespace
- Transport: Socket.IO

## Connection lifecycle

1. Client connects.
2. Client emits `game:join`.
3. Server replies with `game:connected` and `game:room_snapshot`.
4. Client listens for `game:state_snapshot` and `game:error`.
5. Client can emit `game:sync_request` on reconnect.

## Client -> Server events

### `game:join`

```ts
{
  playerId: string
  playerName: string
  roomId: string
  color: 'red' | 'blue' | 'green' | 'yellow'
}
```

Semantics:

- Must be sent before any other gameplay action.
- Adds the player to a lobby room.
- First player becomes host.

Validation:

- `playerId` non-empty string
- `playerName` 1-50 chars
- `roomId` non-empty string
- `color` must be one of the 4 colors

### `game:start`

```ts
{
  playerId: string
  roomId: string
}
```

Semantics:

- Only valid in `lobby`.
- Only the room host can start the game.
- Room must have at least 2 players.
- Server creates the initial authoritative game state.

### `game:roll`

```ts
{
  playerId: string
}
```

Semantics:

- Only the current player can roll.
- Valid only while the game is playing.
- Server rolls the dice and computes legal moves.

### `game:choose_move`

```ts
{
  playerId: string
  moveId: string
}
```

Semantics:

- Valid only when the turn is waiting for a choice.
- `moveId` must match a legal move returned by the server.

### `game:sync_request`

```ts
{
  playerId: string
}
```

Semantics:

- Use after reconnect or when client state is stale.
- Server responds with the latest room or game snapshot.

### `game:ping`

```ts
{
  playerId: string
}
```

Semantics:

- Lightweight heartbeat command.
- Currently validated but otherwise ignored.

## Server -> Client events

### `game:connected`

```ts
{
  playerId: string
  roomId: string
}
```

### `game:room_snapshot`

```ts
{
  roomId: string
  status: 'lobby' | 'playing' | 'finished'
  players: Player[]
  maxPlayers: number
  hostPlayerId: string | null
  canStart: boolean
}
```

Use this for lobby UI.

### `game:state_snapshot`

```ts
{
  version: number
  state: GameState
  events: GameEvent[]
}
```

Use this as the authoritative game state payload.

### `game:error`

```ts
{
  message: string
  code: string
}
```

Common codes:

- `JOIN_FAILED`
- `START_FAILED`
- `NOT_IN_ROOM`
- `GAME_NOT_STARTED`
- `ROLL_ERROR`
- `MOVE_ERROR`
- `SYNC_ERROR`
- `ROOM_NOT_FOUND`

### `game:turn_timeout_warning`

```ts
{
  secondsRemaining: number
}
```

Defined in the shared protocol, but not actively emitted by the current server flow.

## Snapshot rules

- The server broadcasts snapshots after every accepted action.
- The frontend should not mutate the state locally as the source of truth.
- `version` increments on each authoritative update.
