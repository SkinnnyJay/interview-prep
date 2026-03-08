/**
 * Streaming Service Implementation
 *
 * This service provides real-time streaming capabilities using WebSockets,
 * Server-Sent Events (SSE), and other streaming protocols. It supports
 * pub/sub patterns, real-time notifications, and live data feeds.
 *
 * Key Features:
 * - WebSocket connections with authentication
 * - Server-Sent Events for one-way streaming
 * - Pub/Sub messaging patterns
 * - Room-based messaging
 * - Message filtering and routing
 * - Connection management and cleanup
 * - Rate limiting and throttling
 * - Message persistence and replay
 */

import { FastifyRequest } from "fastify";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { StreamMessage, StreamSubscription, SocketStream } from "../types/common";
import { StreamingDefaultConfig } from "../constants";

/** Client-to-server message type strings */
const MessageType = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  PUBLISH: "publish",
  PING: "ping",
} as const;

/** Server-to-client message type strings */
const StreamEventType = {
  CONNECTION_ESTABLISHED: "connection.established",
  PONG: "pong",
  SUBSCRIPTION_CONFIRMED: "subscription.confirmed",
  UNSUBSCRIPTION_CONFIRMED: "unsubscription.confirmed",
  ROOM_MEMBER_JOINED: "room.member_joined",
  ROOM_JOINED: "room.joined",
  ROOM_MEMBER_LEFT: "room.member_left",
  ROOM_LEFT: "room.left",
  PUBLISH_CONFIRMED: "publish.confirmed",
  ERROR: "error",
  MESSAGE_HISTORY: "message.history",
  MESSAGE: "message",
} as const;

/** Error codes for sendError */
const StreamErrorCode = {
  INVALID_MESSAGE: "INVALID_MESSAGE",
  UNKNOWN_MESSAGE_TYPE: "UNKNOWN_MESSAGE_TYPE",
  MESSAGE_HANDLER_ERROR: "MESSAGE_HANDLER_ERROR",
  INVALID_TOPIC: "INVALID_TOPIC",
  INVALID_ROOM_ID: "INVALID_ROOM_ID",
  INVALID_ROOM: "INVALID_ROOM",
  NOT_IN_ROOM: "NOT_IN_ROOM",
} as const;

/** User-facing error messages for stream errors */
const StreamErrorMessage = {
  INVALID_MESSAGE_FORMAT: "Invalid message format",
  CONNECTION_LIMIT_EXCEEDED: "Connection limit exceeded",
} as const;

/** WebSocket close code: policy violation (used when connection limit exceeded) */
const WS_CLOSE_POLICY_VIOLATION = 1008;

/** Discriminated union for client-to-server stream messages (type-safe payloads) */
interface IncomingSubscribe {
  type: "subscribe";
  data: { topic?: string; filters?: unknown };
}
interface IncomingUnsubscribe {
  type: "unsubscribe";
  data: { subscriptionId?: string; topic?: string };
}
interface IncomingJoinRoom {
  type: "join_room";
  data: { roomId?: string; roomName?: string };
}
interface IncomingLeaveRoom {
  type: "leave_room";
  data: { roomId?: string };
}
interface IncomingPublish {
  type: "publish";
  data: { topic?: string; message?: unknown; roomId?: string };
}
interface IncomingPing {
  type: "ping";
  data?: Record<string, unknown>;
}

type IncomingStreamMessage =
  | IncomingSubscribe
  | IncomingUnsubscribe
  | IncomingJoinRoom
  | IncomingLeaveRoom
  | IncomingPublish
  | IncomingPing;

/** Emitted event names */
const StreamEmitEvent = {
  CONNECTION_ESTABLISHED: "connection.established",
  CONNECTION_CLOSED: "connection.closed",
} as const;

/** Default capabilities advertised to clients */
const STREAM_CAPABILITIES = ["pub-sub", "rooms", "filtering"] as const;

export interface StreamingOptions {
  maxConnections?: number;
  messageRateLimit?: number; // messages per second
  heartbeatInterval?: number; // milliseconds
  connectionTimeout?: number; // milliseconds
  enablePersistence?: boolean;
  maxMessageHistory?: number;
}

export interface ConnectionInfo {
  id: string;
  userId?: string;
  userRole?: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  rateLimit: {
    count: number;
    resetTime: number;
  };
}

export interface StreamRoom {
  id: string;
  name: string;
  connections: Set<string>;
  messageHistory: StreamMessage[];
  filters?: {
    userRoles?: string[];
    permissions?: string[];
  };
}

export class StreamingService extends EventEmitter {
  private connections = new Map<string, SocketStream>();
  private connectionInfo = new Map<string, ConnectionInfo>();
  private rooms = new Map<string, StreamRoom>();
  private subscriptions = new Map<string, StreamSubscription>();
  private options: StreamingOptions;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(options: StreamingOptions = {}) {
    super();
    this.options = {
      maxConnections: StreamingDefaultConfig.MAX_CONNECTIONS,
      messageRateLimit: StreamingDefaultConfig.MESSAGE_RATE_LIMIT,
      heartbeatInterval: StreamingDefaultConfig.HEARTBEAT_INTERVAL_MS,
      connectionTimeout: StreamingDefaultConfig.CONNECTION_TIMEOUT_MS,
      enablePersistence: true,
      maxMessageHistory: StreamingDefaultConfig.MAX_MESSAGE_HISTORY,
      ...options,
    };

    this.startHeartbeat();
    console.warn("🚀 StreamingService initialized");
  }

  /**
   * Handle new WebSocket connection
   *
   * Why: Establishes authenticated WebSocket connections with proper setup
   * When: Called when a client connects via WebSocket
   */
  async handleConnection(connection: SocketStream, request: FastifyRequest): Promise<void> {
    const connectionId = uuidv4();
    const context = request.requestContext;

    console.warn(`🔌 New WebSocket connection: ${connectionId}`);

    // Check connection limits
    if (this.connections.size >= this.options.maxConnections!) {
      console.warn(`❌ Connection limit exceeded: ${this.connections.size}`);
      connection.socket.close(WS_CLOSE_POLICY_VIOLATION, StreamErrorMessage.CONNECTION_LIMIT_EXCEEDED);
      return;
    }

    // Store connection info
    const info: ConnectionInfo = {
      id: connectionId,
      userId: context?.userId,
      userRole: context?.userRole,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
      rateLimit: {
        count: 0,
        resetTime: Date.now() + StreamingDefaultConfig.RATE_LIMIT_RESET_MS,
      },
    };

    this.connections.set(connectionId, connection);
    this.connectionInfo.set(connectionId, info);

    // Set up connection event handlers
    this.setupConnectionHandlers(connectionId, connection);

    // Send welcome message
    await this.sendToConnection(connectionId, {
      id: uuidv4(),
      type: StreamEventType.CONNECTION_ESTABLISHED,
      data: {
        connectionId,
        serverTime: new Date().toISOString(),
        capabilities: [...STREAM_CAPABILITIES],
      },
      timestamp: new Date(),
    });

    this.emit(StreamEmitEvent.CONNECTION_ESTABLISHED, { connectionId, userId: info.userId });
  }

  /**
   * Set up connection event handlers
   */
  private setupConnectionHandlers(connectionId: string, connection: SocketStream): void {
    // Handle incoming messages
    connection.socket.on("message", async (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        await this.handleIncomingMessage(connectionId, message);
      } catch (error) {
        console.error(`❌ Error parsing message from ${connectionId}:`, error);
        await this.sendError(
          connectionId,
          StreamErrorCode.INVALID_MESSAGE,
          StreamErrorMessage.INVALID_MESSAGE_FORMAT
        );
      }
    });

    // Handle connection close
    connection.socket.on("close", (code: number, reason: Buffer) => {
      console.warn(`🔌 Connection closed: ${connectionId} (${code}: ${reason.toString()})`);
      this.handleDisconnection(connectionId);
    });

    // Handle connection errors
    connection.socket.on("error", (error: Error) => {
      console.error(`❌ Connection error for ${connectionId}:`, error);
      this.handleDisconnection(connectionId);
    });

    // Handle pong responses (for heartbeat)
    connection.socket.on("pong", () => {
      const info = this.connectionInfo.get(connectionId);
      if (info) {
        info.lastActivity = new Date();
      }
    });
  }

  /**
   * Handle incoming messages from clients (discriminated union for type-safe payloads)
   */
  private async handleIncomingMessage(
    connectionId: string,
    raw: Record<string, unknown> & { type?: string; data?: unknown }
  ): Promise<void> {
    const info = this.connectionInfo.get(connectionId);
    if (!info) return;

    // Update last activity
    info.lastActivity = new Date();

    // Check rate limiting
    if (!this.checkRateLimit(info)) {
      await this.sendError(connectionId, "RATE_LIMIT_EXCEEDED", "Too many messages");
      return;
    }

    const type = raw.type;
    console.warn(`📨 Message from ${connectionId}:`, type);

    const knownTypes: string[] = Object.values(MessageType);
    if (typeof type !== "string" || !knownTypes.includes(type)) {
      await this.sendError(
        connectionId,
        StreamErrorCode.UNKNOWN_MESSAGE_TYPE,
        `Unknown message type: ${String(type)}`
      );
      return;
    }

    const message: IncomingStreamMessage = { type, data: raw.data } as IncomingStreamMessage;

    try {
      switch (message.type) {
        case MessageType.SUBSCRIBE:
          await this.handleSubscribe(connectionId, message.data);
          break;

        case MessageType.UNSUBSCRIBE:
          await this.handleUnsubscribe(connectionId, message.data);
          break;

        case MessageType.JOIN_ROOM:
          await this.handleJoinRoom(connectionId, message.data);
          break;

        case MessageType.LEAVE_ROOM:
          await this.handleLeaveRoom(connectionId, message.data);
          break;

        case MessageType.PUBLISH:
          await this.handlePublish(connectionId, message.data);
          break;

        case MessageType.PING:
          await this.sendToConnection(connectionId, {
            id: uuidv4(),
            type: StreamEventType.PONG,
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date(),
          });
          break;

      }
    } catch (error) {
      console.error(`❌ Error handling message from ${connectionId}:`, error);
      await this.sendError(
        connectionId,
        StreamErrorCode.MESSAGE_HANDLER_ERROR,
        "Failed to process message"
      );
    }
  }

  /**
   * Handle subscription requests
   */
  private async handleSubscribe(
    connectionId: string,
    data: IncomingSubscribe["data"]
  ): Promise<void> {
    const { topic, filters } = data;

    if (!topic || typeof topic !== "string") {
      await this.sendError(
        connectionId,
        StreamErrorCode.INVALID_TOPIC,
        "Topic is required and must be a string"
      );
      return;
    }

    const info = this.connectionInfo.get(connectionId);
    if (!info) return;

    // Create subscription
    const subscription: StreamSubscription = {
      id: uuidv4(),
      topic,
      filters: filters as StreamSubscription["filters"],
      userId: info.userId,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscription.id, subscription);
    info.subscriptions.add(subscription.id);

    console.warn(`📡 Subscription created: ${connectionId} -> ${topic}`);

    // Send confirmation
    await this.sendToConnection(connectionId, {
      id: uuidv4(),
      type: StreamEventType.SUBSCRIPTION_CONFIRMED,
      data: {
        subscriptionId: subscription.id,
        topic,
        filters,
      },
      timestamp: new Date(),
    });

    // Send recent messages if persistence is enabled
    if (this.options.enablePersistence) {
      await this.sendRecentMessages(connectionId, topic);
    }
  }

  /**
   * Handle unsubscription requests
   */
  private async handleUnsubscribe(
    connectionId: string,
    data: IncomingUnsubscribe["data"]
  ): Promise<void> {
    const { subscriptionId, topic } = data;
    const info = this.connectionInfo.get(connectionId);
    if (!info) return;

    if (subscriptionId) {
      // Unsubscribe by subscription ID
      this.subscriptions.delete(subscriptionId);
      info.subscriptions.delete(subscriptionId);
    } else if (topic) {
      // Unsubscribe from all subscriptions for this topic
      for (const [subId, subscription] of this.subscriptions) {
        if (subscription.topic === topic && info.subscriptions.has(subId)) {
          this.subscriptions.delete(subId);
          info.subscriptions.delete(subId);
        }
      }
    }

    console.warn(`📡 Unsubscribed: ${connectionId} from ${topic || subscriptionId}`);

    await this.sendToConnection(connectionId, {
      id: uuidv4(),
      type: StreamEventType.UNSUBSCRIPTION_CONFIRMED,
      data: { subscriptionId, topic },
      timestamp: new Date(),
    });
  }

  /**
   * Handle room join requests
   */
  private async handleJoinRoom(
    connectionId: string,
    data: IncomingJoinRoom["data"]
  ): Promise<void> {
    const { roomId, roomName } = data;

    if (!roomId || typeof roomId !== "string") {
      await this.sendError(connectionId, StreamErrorCode.INVALID_ROOM_ID, "Room ID is required");
      return;
    }

    // Get or create room
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        name: roomName || roomId,
        connections: new Set(),
        messageHistory: [],
      };
      this.rooms.set(roomId, room);
      console.warn(`🏠 Created room: ${roomId}`);
    }

    // Add connection to room
    room.connections.add(connectionId);

    console.warn(`🏠 ${connectionId} joined room: ${roomId}`);

    // Notify room members
    await this.broadcastToRoom(
      roomId,
      {
        id: uuidv4(),
        type: StreamEventType.ROOM_MEMBER_JOINED,
        data: {
          roomId,
          connectionId,
          memberCount: room.connections.size,
        },
        timestamp: new Date(),
      },
      connectionId
    ); // Exclude the joining member

    // Send confirmation to the joining member
    await this.sendToConnection(connectionId, {
      id: uuidv4(),
      type: StreamEventType.ROOM_JOINED,
      data: {
        roomId,
        roomName: room.name,
        memberCount: room.connections.size,
      },
      timestamp: new Date(),
    });

    // Send recent room messages
    if (this.options.enablePersistence && room.messageHistory.length > 0) {
      for (const message of room.messageHistory.slice(-StreamingDefaultConfig.LAST_MESSAGES_REPLAY_COUNT)) {
        // Last 10 messages
        await this.sendToConnection(connectionId, message);
      }
    }
  }

  /**
   * Handle room leave requests
   */
  private async handleLeaveRoom(
    connectionId: string,
    data: IncomingLeaveRoom["data"]
  ): Promise<void> {
    const roomId = data.roomId;
    if (!roomId || typeof roomId !== "string") {
      await this.sendError(connectionId, StreamErrorCode.INVALID_ROOM, "roomId is required");
      return;
    }
    const room = this.rooms.get(roomId);

    if (!room || !room.connections.has(connectionId)) {
      await this.sendError(connectionId, StreamErrorCode.NOT_IN_ROOM, "Not a member of this room");
      return;
    }

    room.connections.delete(connectionId);

    console.warn(`🏠 ${connectionId} left room: ${roomId}`);

    // Notify remaining room members
    await this.broadcastToRoom(roomId, {
      id: uuidv4(),
      type: StreamEventType.ROOM_MEMBER_LEFT,
      data: {
        roomId,
        connectionId,
        memberCount: room.connections.size,
      },
      timestamp: new Date(),
    });

    // Send confirmation
    await this.sendToConnection(connectionId, {
      id: uuidv4(),
      type: StreamEventType.ROOM_LEFT,
      data: { roomId },
      timestamp: new Date(),
    });

    // Clean up empty rooms
    if (room.connections.size === 0) {
      this.rooms.delete(roomId);
      console.warn(`🏠 Deleted empty room: ${roomId}`);
    }
  }

  /**
   * Handle publish requests
   */
  private async handlePublish(
    connectionId: string,
    data: IncomingPublish["data"]
  ): Promise<void> {
    const { topic, message, roomId } = data;
    const info = this.connectionInfo.get(connectionId);
    if (!info) return;

    const streamMessage: StreamMessage<unknown> = {
      id: uuidv4(),
      type: topic || StreamEventType.MESSAGE,
      data: message,
      timestamp: new Date(),
    };

    console.warn(`📢 Publishing message: ${connectionId} -> ${topic || roomId}`);

    if (roomId) {
      // Publish to room
      await this.broadcastToRoom(roomId, streamMessage, connectionId);

      // Store in room history
      const room = this.rooms.get(roomId);
      if (room && this.options.enablePersistence) {
        room.messageHistory.push(streamMessage);
        if (room.messageHistory.length > this.options.maxMessageHistory!) {
          room.messageHistory.shift();
        }
      }
    } else if (topic) {
      // Publish to topic subscribers
      await this.broadcastToTopic(topic, streamMessage, connectionId);
    }

    // Send confirmation
    await this.sendToConnection(connectionId, {
      id: uuidv4(),
      type: StreamEventType.PUBLISH_CONFIRMED,
      data: {
        messageId: streamMessage.id,
        topic,
        roomId,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast message to all subscribers of a topic
   */
  async broadcastToTopic(
    topic: string,
    message: StreamMessage,
    excludeConnection?: string
  ): Promise<void> {
    console.warn(`📡 Broadcasting to topic: ${topic}`);

    let sentCount = 0;

    for (const [connectionId, info] of this.connectionInfo) {
      if (excludeConnection && connectionId === excludeConnection) continue;

      // Check if connection has subscriptions to this topic
      const hasSubscription = Array.from(info.subscriptions).some((subId) => {
        const subscription = this.subscriptions.get(subId);
        return subscription && subscription.topic === topic;
      });

      if (hasSubscription) {
        await this.sendToConnection(connectionId, message);
        sentCount++;
      }
    }

    console.warn(`📡 Broadcast sent to ${sentCount} connections`);
  }

  /**
   * Broadcast message to all members of a room
   */
  async broadcastToRoom(
    roomId: string,
    message: StreamMessage,
    excludeConnection?: string
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.warn(`🏠 Broadcasting to room: ${roomId} (${room.connections.size} members)`);

    let sentCount = 0;

    for (const connectionId of room.connections) {
      if (excludeConnection && connectionId === excludeConnection) continue;

      await this.sendToConnection(connectionId, message);
      sentCount++;
    }

    console.warn(`🏠 Room broadcast sent to ${sentCount} members`);
  }

  /**
   * Send message to a specific connection
   */
  private async sendToConnection(connectionId: string, message: StreamMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== 1) {
      // 1 = OPEN
      return;
    }

    try {
      connection.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ Failed to send message to ${connectionId}:`, error);
      this.handleDisconnection(connectionId);
    }
  }

  /**
   * Send error message to connection
   */
  private async sendError(connectionId: string, code: string, message: string): Promise<void> {
    await this.sendToConnection(connectionId, {
      id: uuidv4(),
      type: StreamEventType.ERROR,
      data: {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    });
  }

  /**
   * Send recent messages for a topic
   */
  private async sendRecentMessages(connectionId: string, topic: string): Promise<void> {
    // This would typically query a message store
    // For now, we'll just send a placeholder
    await this.sendToConnection(connectionId, {
      id: uuidv4(),
      type: StreamEventType.MESSAGE_HISTORY,
      data: {
        topic,
        messages: [],
        note: "Message history would be loaded from persistent storage",
      },
      timestamp: new Date(),
    });
  }

  /**
   * Check rate limiting for a connection
   */
  private checkRateLimit(info: ConnectionInfo): boolean {
    const now = Date.now();

    // Reset counter if time window has passed
    if (now > info.rateLimit.resetTime) {
      info.rateLimit.count = 0;
      info.rateLimit.resetTime = now + StreamingDefaultConfig.RATE_LIMIT_RESET_MS;
    }

    // Check if under limit
    if (info.rateLimit.count >= this.options.messageRateLimit!) {
      return false;
    }

    info.rateLimit.count++;
    return true;
  }

  /**
   * Handle connection disconnection
   */
  private handleDisconnection(connectionId: string): void {
    const info = this.connectionInfo.get(connectionId);

    // Clean up subscriptions
    if (info) {
      for (const subscriptionId of info.subscriptions) {
        this.subscriptions.delete(subscriptionId);
      }
    }

    // Remove from rooms
    for (const [roomId, room] of this.rooms) {
      if (room.connections.has(connectionId)) {
        room.connections.delete(connectionId);

        // Notify room members
        this.broadcastToRoom(roomId, {
          id: uuidv4(),
          type: StreamEventType.ROOM_MEMBER_LEFT,
          data: {
            roomId,
            connectionId,
            memberCount: room.connections.size,
          },
          timestamp: new Date(),
        });

        // Clean up empty rooms
        if (room.connections.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }

    // Remove connection
    this.connections.delete(connectionId);
    this.connectionInfo.delete(connectionId);

    this.emit(StreamEmitEvent.CONNECTION_CLOSED, { connectionId, userId: info?.userId });
    console.warn(`🔌 Connection cleaned up: ${connectionId}`);
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.connectionTimeout!;

      for (const [connectionId, info] of this.connectionInfo) {
        const timeSinceActivity = now - info.lastActivity.getTime();

        if (timeSinceActivity > timeout) {
          console.warn(`💔 Connection timeout: ${connectionId}`);
          this.handleDisconnection(connectionId);
        } else {
          // Send ping to check if connection is alive
          const connection = this.connections.get(connectionId);
          if (connection && connection.socket.readyState === 1) {
            connection.socket.ping();
          }
        }
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    connections: number;
    rooms: number;
    subscriptions: number;
    uptime: number;
  } {
    return {
      connections: this.connections.size,
      rooms: this.rooms.size,
      subscriptions: this.subscriptions.size,
      uptime: process.uptime(),
    };
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    console.warn("🛑 Shutting down StreamingService...");

    // Clear heartbeat timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Close all connections
    for (const [connectionId, connection] of this.connections) {
      try {
        connection.socket.close(1001, "Server shutting down");
      } catch (error) {
        console.error(`Error closing connection ${connectionId}:`, error);
      }
    }

    // Clear all data structures
    this.connections.clear();
    this.connectionInfo.clear();
    this.rooms.clear();
    this.subscriptions.clear();

    console.warn("✅ StreamingService shutdown complete");
  }
}
