# HTTP API

## Base URL

`http://localhost:3000`

## Routes

### `GET /`

Returns a basic status payload.

```json
{
  "message": "Rune Race Server",
  "status": "running"
}
```

### `GET /health`

Returns a health check payload.

```json
{
  "status": "ok",
  "timestamp": "2026-05-17T12:00:00.000Z"
}
```

### `POST /dev/create-room`

Creates a lobby room for local development or testing.

Response:

```json
{
  "roomId": "room-1715940000000"
}
```

## Notes

- This endpoint only creates the room record.
- It does not join any player.
- The frontend should still use Socket.IO `game:join` to enter the room.
