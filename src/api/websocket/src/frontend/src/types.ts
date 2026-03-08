// Frontend WebSocket Types (discriminated union for type-safe handling)

export interface BaseWebSocketMessage {
  id: string;
  timestamp: number;
  clientId?: string;
}

export interface ConnectMessage extends BaseWebSocketMessage {
  type: "connect";
  payload: { clientId?: string; serverType?: string; message?: string };
}

export interface ErrorMessage extends BaseWebSocketMessage {
  type: "error";
  payload: { error?: string };
}

export interface JoinRoomMessage extends BaseWebSocketMessage {
  type: "join_room";
  payload: { room: string };
}

export interface LeaveRoomMessage extends BaseWebSocketMessage {
  type: "leave_room";
  payload: { room: string };
}

/** Unknown message types (e.g. chat, custom events from server) */
export interface GenericWebSocketMessage extends BaseWebSocketMessage {
  type: string;
  payload: unknown;
}

export type WebSocketMessage =
  | ConnectMessage
  | ErrorMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | GenericWebSocketMessage;

/** Message shape for sending (omit server-assigned id and timestamp) */
export type SendableWebSocketMessage = Omit<WebSocketMessage, "id" | "timestamp">;

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  clientId?: string;
  serverType?: string;
}

export interface ServerStats {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  messagesPerSecond: number;
  rooms: number;
  uptime: number;
}

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  room?: string;
}

export interface Room {
  id: string;
  name: string;
  clientCount: number;
  joined: boolean;
}

export type ServerType = "basic" | "advanced" | "socketio";

export interface WebSocketConfig {
  serverType: ServerType;
  url: string;
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}
