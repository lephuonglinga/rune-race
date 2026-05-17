# Game Model

## Core entities

### Player

```ts
{
  id: string
  name: string
  color: 'red' | 'blue' | 'green' | 'yellow'
}
```

### Token

```ts
{
  id: string
  playerId: string
  position: number
  state: 'in_base' | 'on_track' | 'in_home_lane' | 'finished'
}
```

### Turn

```ts
{
  id: string
  currentPlayerId: string
  diceResult: number | null
  phase: 'waiting_roll' | 'rolled' | 'waiting_choice' | 'resolving_move' | 'play_cards' | 'turn_end'
  legalMoves: LegalMove[]
  startTime: number
}
```

### LegalMove

```ts
{
  id: string
  tokenId: string
  destination: number
  moveType: 'spawn' | 'move' | 'capture'
  capturedTokenId?: string
}
```

### RoomSnapshot

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

### GameState

```ts
{
  roomId: string
  version: number
  players: Player[]
  tokens: Token[]
  turn: Turn
  phase: GamePhase
  status: 'waiting' | 'playing' | 'finished'
  currentPlayerIndex: number
  winnerId?: string
  createdAt: number
  updatedAt: number
  events: GameEvent[]
}
```

## Board rules

- Main ring size: 40 positions.
- Home lane size: 4 positions.
- Tokens per player: 4.
- Safe tiles: 0, 5, 10, 15, 20, 25, 30, 35.
- Spawn entry positions:
  - red -> 0
  - blue -> 10
  - green -> 20
  - yellow -> 30
- Home lane entry positions:
  - red -> 5
  - blue -> 15
  - green -> 25
  - yellow -> 35

## Turn flow

1. Turn starts in `waiting_roll`.
2. Current player emits `game:roll`.
3. Server rolls dice and computes legal moves.
4. If there are 0 legal moves, turn ends automatically.
5. If there is 1 legal move, server auto-resolves it.
6. If there are multiple legal moves, turn enters `waiting_choice`.
7. Current player emits `game:choose_move`.
8. Server resolves move, checks win, then advances turn.

## Move resolution rules

- Spawn only happens on a roll of 6.
- Tokens on the main track can move forward by dice value.
- Landing on an enemy token on a non-safe tile captures that token.
- Safe tiles cannot be captured.
- Tokens can enter the home lane after leaving the main board.
- Exact finishing is required in the home lane.
- A player wins when all 4 tokens are `finished`.

## Game events

The server appends recent events to `GameState.events` for animation and reconciliation.

Event types:

- `dice_roll`
- `token_moved`
- `token_captured`
- `token_finished`
- `turn_advanced`
- `error`

## Server-internal notes

- `GameEngine` is the authoritative state machine.
- `RoomManager` owns room membership and game lifecycle.
- Client code should never attempt to compute or mutate authoritative moves on its own.
- `moveId` is generated from token ID plus destination, and token IDs may contain `:`.
