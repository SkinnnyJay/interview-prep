<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# WebSocket — Technical concept & lessons

**Project:** [websocket](../src/api/websocket/README.md)

## What it solves

Bidirectional, low-latency communication between client and server without repeated HTTP polling (chat, live updates, collaboration).

## Concepts

- **Raw WebSocket:** Single long-lived connection; frames in both directions. You implement reconnect, rooms, and application protocol.
- **Socket.IO:** Library with automatic reconnect, rooms, fallback transports (polling), and event-based API. Heavier; protocol lock-in.

## Lessons

1. **Reconnect is mandatory** — Connections drop. Use exponential backoff and max retries; expose connection state in the UI.
2. **Identify clients** — Use a stable id (e.g. after auth) so reconnects can reattach to the same logical client and recover state if needed.
3. **Rate limit per connection** — One client can flood the server. Limit message rate and payload size per client.
4. **WSS in production** — Use TLS (wss://). Same origin and CORS still apply for the initial HTTP handshake.

## Pros & cons

| Style      | Pros                         | Cons                    |
|------------|------------------------------|-------------------------|
| Raw WS     | Standard; minimal            | You build reconnect/rooms |
| Socket.IO | Reconnect, rooms, fallbacks  | Heavier; protocol lock-in |

## When to use

- **WebSocket:** Real-time bidirectional (chat, live feeds, games). Prefer when you want full control.
- **Socket.IO:** When you want built-in reconnect, rooms, and fallbacks and can accept the dependency.
- **SSE:** Server→client only (e.g. live logs); simpler than WebSocket.

## See also

- Project README: [src/api/websocket/README.md](../src/api/websocket/README.md)
- Rate-limiter and security for protecting WebSocket endpoints.
