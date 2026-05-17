# Server Contracts

This folder documents the backend contract for rebuilding the frontend from scratch.

## What to read first

1. [Overview](./overview.md)
2. [HTTP API](./http-api.md)
3. [Socket.IO Contract](./socket-contract.md)
4. [Game Model](./game-model.md)
5. [Frontend Rebuild Notes](./frontend-rebuild-notes.md)

## Runtime facts

- Server package: `apps/server`
- Socket server: `ws://localhost:3000`
- HTTP server: `http://localhost:3000`
- CORS: open origin (`*`) for development
- Server authority: the server owns all game state and validates all commands
