/**
 * WebSocket server and message type constants.
 * Replaces magic string literals used across backend server, manager, and Socket.IO.
 */

/** Supported WebSocket server implementations */
export const ServerType = {
  BASIC: "basic",
  ADVANCED: "advanced",
  SOCKETIO: "socketio",
} as const;

export type ServerTypeValue = (typeof ServerType)[keyof typeof ServerType];

/** WebSocket message type strings for protocol and demo handlers */
export const MessageType = {
  MESSAGE: "message",
  PING: "ping",
  PONG: "pong",
  ERROR: "error",
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  SERVER_INFO: "server_info",
  ECHO: "echo",
  ECHO_RESPONSE: "echo_response",
  BROADCAST_TEST: "broadcast_test",
  BROADCAST_MESSAGE: "broadcast_message",
  ROOM_BROADCAST: "room_broadcast",
  ROOM_MESSAGE: "room_message",
  ROOM_NOTIFICATION: "room_notification",
  ROOM_JOINED: "room_joined",
  ROOM_LEFT: "room_left",
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  GET_SERVER_STATS: "get_server_stats",
  SERVER_STATS: "server_stats",
  SERVER_HEARTBEAT: "server_heartbeat",
  CHAT: "chat",
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/** Room notification action strings */
export const RoomAction = {
  JOINED: "joined",
  LEFT: "left",
} as const;

/** Default Socket.IO transports */
export const SOCKETIO_TRANSPORTS = ["websocket", "polling"] as const;

/** Max URL param length for Fastify (used by basic, advanced, socketio servers) */
export const MAX_PARAM_LENGTH = 200;

/** HTTP status codes used by WebSocket HTTP endpoints */
export const HttpStatus = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
} as const;
