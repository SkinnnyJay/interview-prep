// WebSocket Manager - Core WebSocket functionality

import { v4 as uuidv4 } from "uuid";
import type {
  WebSocketClient,
  WebSocketRoom,
  WebSocketStats,
  AnyMessage,
  WebSocketHooks,
  WebSocketConfig,
} from "./types";
import { isRoomPayload } from "./types";
import { MessageType } from "./constants";

export class WebSocketManager {
  private clients = new Map<string, WebSocketClient>();
  private rooms = new Map<string, WebSocketRoom>();
  private stats = {
    totalConnections: 0,
    totalMessages: 0,
    startTime: Date.now(),
    messagesLastSecond: 0,
    lastMessageTime: Date.now(),
  };
  private hooks: WebSocketHooks = {};
  private pingInterval?: NodeJS.Timeout;

  constructor(
    private config: WebSocketConfig,
    hooks?: WebSocketHooks
  ) {
    this.hooks = hooks || {};
    // Skip ping interval in test environment to prevent Jest open handles
    const isTestEnv = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;
    if (!isTestEnv) {
      this.startPingInterval();
    }
  }

  /**
   * Add a new client connection
   */
  async addClient(
    socket: import("./types").Socket,
    metadata: Record<string, unknown> = {}
  ): Promise<WebSocketClient> {
    const client: WebSocketClient = {
      id: uuidv4(),
      socket,
      rooms: new Set(),
      metadata: { ...metadata, connectedAt: Date.now() },
      lastPing: Date.now(),
      connected: true,
    };

    this.clients.set(client.id, client);
    this.stats.totalConnections++;

    // Call onConnect hook
    if (this.hooks.onConnect) {
      await this.hooks.onConnect(client);
    }

    return client;
  }

  /**
   * Remove a client connection
   */
  async removeClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    for (const roomId of client.rooms) {
      await this.removeClientFromRoom(clientId, roomId);
    }

    client.connected = false;
    this.clients.delete(clientId);

    // Call onDisconnect hook
    if (this.hooks.onDisconnect) {
      await this.hooks.onDisconnect(client);
    }
  }

  /**
   * Handle incoming message from client
   */
  async handleMessage(
    clientId: string,
    rawMessage: string | Buffer | ArrayBuffer | AnyMessage
  ): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      let message: AnyMessage;

      if (typeof rawMessage === "string") {
        message = JSON.parse(rawMessage);
      } else if (Buffer.isBuffer(rawMessage) || rawMessage instanceof ArrayBuffer) {
        message = JSON.parse(
          Buffer.isBuffer(rawMessage) ? rawMessage.toString() : Buffer.from(rawMessage).toString()
        );
      } else {
        message = rawMessage;
      }

      // Ensure message has required fields
      if (!message.id) message.id = uuidv4();
      if (!message.timestamp) message.timestamp = Date.now();
      message.clientId = clientId;

      this.stats.totalMessages++;
      this.updateMessagesPerSecond();

      // Handle built-in message types
      await this.handleBuiltInMessages(client, message);

      // Call onMessage hook
      if (this.hooks.onMessage) {
        await this.hooks.onMessage(client, message);
      }
    } catch (error) {
      const errorMessage: AnyMessage = {
        id: uuidv4(),
        type: MessageType.ERROR,
        payload: { error: "Invalid message format" },
        timestamp: Date.now(),
        clientId,
      };

      this.sendToClient(clientId, errorMessage);

      if (this.hooks.onError && error instanceof Error) {
        await this.hooks.onError(client, error);
      }
    }
  }

  /**
   * Handle built-in message types
   */
  private async handleBuiltInMessages(client: WebSocketClient, message: AnyMessage): Promise<void> {
    switch (message.type) {
      case MessageType.PING:
        client.lastPing = Date.now();
        this.sendToClient(client.id, {
          id: uuidv4(),
          type: MessageType.PONG,
          payload: { timestamp: Date.now() },
          timestamp: Date.now(),
        });
        break;

      case MessageType.JOIN_ROOM: {
        if (isRoomPayload(message.payload)) {
          await this.addClientToRoom(client.id, message.payload.room);
        }
        break;
      }

      case MessageType.LEAVE_ROOM: {
        if (isRoomPayload(message.payload)) {
          await this.removeClientFromRoom(client.id, message.payload.room);
        }
        break;
      }

      case MessageType.ROOM_MESSAGE: {
        if (isRoomPayload(message.payload)) {
          this.broadcastToRoom(message.payload.room, message, client.id);
        }
        break;
      }
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: AnyMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || !client.connected) return false;

    try {
      const messageStr = JSON.stringify(message);

      // Handle different socket types
      if (client.socket.send) {
        // Standard WebSocket
        client.socket.send(messageStr);
      } else if ("emit" in client.socket && typeof client.socket.emit === "function") {
        // Socket.IO
        (client.socket as { emit: (event: string, data: unknown) => void }).emit(
          MessageType.MESSAGE,
          message
        );
      }

      return true;
    } catch (error) {
      console.error("Failed to send message to client:", error);
      return false;
    }
  }

  /**
   * Broadcast message to all clients or specific room
   */
  broadcast(message: AnyMessage, roomId?: string): void {
    if (roomId) {
      this.broadcastToRoom(roomId, message);
    } else {
      for (const client of this.clients.values()) {
        this.sendToClient(client.id, message);
      }
    }
  }

  /**
   * Broadcast message to specific room
   */
  broadcastToRoom(roomId: string, message: AnyMessage, excludeClientId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const clientId of room.clients) {
      if (excludeClientId && clientId === excludeClientId) continue;
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Add client to room
   */
  async addClientToRoom(clientId: string, roomId: string): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        name: roomId,
        clients: new Set(),
        metadata: {},
        created: Date.now(),
      });
    }

    const room = this.rooms.get(roomId)!;
    room.clients.add(clientId);
    client.rooms.add(roomId);

    // Call onRoomJoin hook
    if (this.hooks.onRoomJoin) {
      await this.hooks.onRoomJoin(client, roomId);
    }

    // Notify client
    this.sendToClient(clientId, {
      id: uuidv4(),
      type: MessageType.ROOM_JOINED,
      payload: { room: roomId, clientCount: room.clients.size },
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Remove client from room
   */
  async removeClientFromRoom(clientId: string, roomId: string): Promise<boolean> {
    const client = this.clients.get(clientId);
    const room = this.rooms.get(roomId);

    if (!client || !room) return false;

    room.clients.delete(clientId);
    client.rooms.delete(roomId);

    // Remove empty room
    if (room.clients.size === 0) {
      this.rooms.delete(roomId);
    }

    // Call onRoomLeave hook
    if (this.hooks.onRoomLeave) {
      await this.hooks.onRoomLeave(client, roomId);
    }

    // Notify client
    this.sendToClient(clientId, {
      id: uuidv4(),
      type: MessageType.ROOM_LEFT,
      payload: { room: roomId },
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Get current statistics
   */
  getStats(): WebSocketStats {
    const uptimeMs = Math.max(1, Date.now() - this.stats.startTime);
    return {
      totalConnections: this.stats.totalConnections,
      activeConnections: this.clients.size,
      totalMessages: this.stats.totalMessages,
      messagesPerSecond: this.stats.messagesLastSecond,
      rooms: this.rooms.size,
      uptime: uptimeMs,
    };
  }

  /**
   * Get all connected clients
   */
  getClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get all rooms
   */
  getRooms(): WebSocketRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Start ping interval to check client connections
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.pingTimeout;

      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastPing > timeout) {
          // Client hasn't responded to ping, disconnect
          this.removeClient(clientId);
        } else {
          // Send ping
          this.sendToClient(clientId, {
            id: uuidv4(),
            type: MessageType.PING,
            payload: { timestamp: now },
            timestamp: now,
          });
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * Update messages per second counter
   */
  private updateMessagesPerSecond(): void {
    const now = Date.now();
    if (now - this.stats.lastMessageTime >= 1000) {
      this.stats.messagesLastSecond = 0;
      this.stats.lastMessageTime = now;
    }
    this.stats.messagesLastSecond++;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Disconnect all clients
    for (const clientId of this.clients.keys()) {
      this.removeClient(clientId);
    }

    this.clients.clear();
    this.rooms.clear();
  }
}
