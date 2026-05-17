# Frontend Rebuild Notes

This file is the shortest path for rebuilding the UI in another session.

## Recommended client bootstrap

1. Create a socket client wrapper.
2. Join a room through `game:join`.
3. Render lobby state from `game:room_snapshot`.
4. Switch to gameplay UI after `game:state_snapshot` arrives.
5. Treat every snapshot as authoritative.

## Suggested UI state

- `disconnected`
- `joining`
- `lobby`
- `playing`
- `finished`
- `error`

## Minimal commands the UI needs

- `game:join`
- `game:start`
- `game:roll`
- `game:choose_move`
- `game:sync_request`

## What to render from snapshots

### Room snapshot

- room ID
- player list
- host badge
- ready/start availability
- room capacity

### Game snapshot

- current player
- dice result
- legal moves
- token positions and states
- event feed for animation
- winner if game finished

## Practical advice

- Do not cache turn logic in the client.
- Do not derive legal moves locally as the only source of truth.
- Keep the client thin and snapshot-driven.
- On reconnect, call `game:sync_request` immediately.
