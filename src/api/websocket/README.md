# WebSocket

Three server styles: basic WebSocket, advanced (rate limit, history, presence),
and Socket.IO. Optional React frontend. Part of the
[API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run websocket:dev
# Or: WS_SERVER_TYPE=advanced npm run dev (3002), WS_SERVER_TYPE=socketio (3003)
npm run websocket:test
```

## Server types

| Type          | Pros                          | Cons                          |
| ------------- | ----------------------------- | ----------------------------- |
| **Basic**     | Standard WS; minimal          | You implement rooms/reconnect |
| **Advanced**  | Rate limit, history, presence | More logic                    |
| **Socket.IO** | Reconnect, rooms, fallbacks   | Heavier; protocol lock-in     |

**When:** Raw WebSocket for control and simplicity; Socket.IO when you want
built-in resilience and features.

## Endpoints (HTTP)

- `GET /health`, `GET /api/stats`, `GET /api/clients`, `GET /api/rooms`,
  `POST /api/broadcast`

## Practices

- Exponential backoff for reconnects; rate limit per client; structured message
  format (`id`, `type`, `payload`, `timestamp`); WSS and auth in production.

## Project structure

```text
src/
├── backend/
│   ├── server-basic.ts
│   ├── server-advanced.ts
│   ├── server-socketio.ts
│   └── websocket-manager.ts
└── frontend/   # React demo
```
