// Socket.IO Server Implementation

import Fastify, { FastifyInstance } from "fastify";
import { Server as SocketIOServer, Socket as SocketIOSocket } from "socket.io";
import { WebSocketManager } from "./websocket-manager";
import type {
  WebSocketServer,
  WebSocketConfig,
  WebSocketHooks,
  AnyMessage,
  WebSocketClient,
  WebSocketRoom,
  WebSocketStats,
} from "./types";
import { MessageType, SOCKETIO_TRANSPORTS, MAX_PARAM_LENGTH, HttpStatus } from "./constants";

interface SocketIOConfig extends WebSocketConfig {
  enableNamespaces: boolean;
  defaultNamespace: string;
  enableAdapter: boolean;
  transports: ("websocket" | "polling")[];
}

export class SocketIOWebSocketServer implements WebSocketServer {
  private app: FastifyInstance;
  private io!: SocketIOServer;
  private manager: WebSocketManager;
  private config: SocketIOConfig;
  private isRunning = false;
  private namespaces = new Map<string, import("socket.io").Namespace>();

  constructor(config: Partial<SocketIOConfig> = {}, hooks?: WebSocketHooks) {
    this.config = {
      port: 3003,
      host: "0.0.0.0",
      pingInterval: 25000,
      pingTimeout: 60000,
      maxConnections: 1000,
      enableCompression: true,
      enableCors: true,
      corsOrigin: "*",
      enableNamespaces: true,
      defaultNamespace: "/",
      enableAdapter: false,
      transports: [...SOCKETIO_TRANSPORTS],
      ...config,
    };

    this.app = Fastify({
      logger: true,
      maxParamLength: MAX_PARAM_LENGTH,
    });

    // Enhanced hooks for Socket.IO specific features
    const enhancedHooks: WebSocketHooks = {
      ...hooks,
      onConnect: async (client) => {
        // Emit connection event to all clients in the same namespace (Socket.IO socket)
        const socket = client.socket as SocketIOSocket;
        if (socket.nsp) {
          socket.nsp.emit("user_connected", {
            clientId: client.id,
            timestamp: Date.now(),
            namespace: socket.nsp.name,
          });
        }
        if (hooks?.onConnect) await hooks.onConnect(client);
      },
      onDisconnect: async (client) => {
        // Emit disconnection event (Socket.IO socket)
        const socket = client.socket as SocketIOSocket;
        if (socket.nsp) {
          socket.nsp.emit("user_disconnected", {
            clientId: client.id,
            timestamp: Date.now(),
            namespace: socket.nsp.name,
          });
        }
        if (hooks?.onDisconnect) await hooks.onDisconnect(client);
      },
      onRoomJoin: async (client, room) => {
        // Emit room join event to room members (Socket.IO socket)
        const socket = client.socket as SocketIOSocket;
        socket.to(room).emit("user_joined_room", {
          clientId: client.id,
          room,
          timestamp: Date.now(),
        });
        if (hooks?.onRoomJoin) await hooks.onRoomJoin(client, room);
      },
      onRoomLeave: async (client, room) => {
        // Emit room leave event to room members (Socket.IO socket)
        const socket = client.socket as SocketIOSocket;
        socket.to(room).emit("user_left_room", {
          clientId: client.id,
          room,
          timestamp: Date.now(),
        });
        if (hooks?.onRoomLeave) await hooks.onRoomLeave(client, room);
      },
    };

    this.manager = new WebSocketManager(this.config, enhancedHooks);
    this.setupServer();
  }

  /**
   * Setup Socket.IO server and Fastify integration
   */
  private setupServer(): void {
    // CORS handling for Fastify - simplified for demo
    if (this.config.enableCors) {
      this.app.addHook("onRequest", async (request, reply) => {
        reply.header("Access-Control-Allow-Origin", "*");
        reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      });
    }

    // Create Socket.IO server
    this.io = new SocketIOServer({
      cors: this.config.enableCors
        ? {
            origin: this.config.corsOrigin,
            methods: ["GET", "POST"],
          }
        : undefined,
      pingInterval: this.config.pingInterval,
      pingTimeout: this.config.pingTimeout,
      maxHttpBufferSize: 1e6, // 1MB
      transports: this.config.transports,
    });

    this.setupRoutes();
    this.setupSocketHandlers();
  }

  /**
   * Setup Fastify HTTP routes
   */
  private setupRoutes(): void {
    // Health check with Socket.IO specific info
    this.app.get("/health", async (_request, _reply) => {
      const stats = this.manager.getStats();
      const socketIOStats = {
        connectedSockets: this.io.engine.clientsCount,
        namespaces: Array.from(this.namespaces.keys()),
        rooms: Array.from(this.io.sockets.adapter.rooms.keys()),
      };

      return {
        status: "healthy",
        timestamp: Date.now(),
        stats,
        socketIO: socketIOStats,
      };
    });

    // Enhanced stats with Socket.IO metrics
    this.app.get("/api/stats", async (_request, _reply) => {
      const baseStats = this.manager.getStats();
      return {
        ...baseStats,
        socketIO: {
          connectedSockets: this.io.engine.clientsCount,
          namespaces: this.namespaces.size,
          rooms: this.io.sockets.adapter.rooms.size,
          transports: this.config.transports,
        },
      };
    });

    // Namespace management
    this.app.get("/api/namespaces", async (_request, _reply) => {
      const namespaces = Array.from(this.namespaces.entries()).map(([name, ns]) => ({
        name,
        clients: ns.sockets.size,
        rooms: Array.from(ns.adapter.rooms.keys()),
      }));

      return { namespaces, total: namespaces.length };
    });

    // Room management for specific namespace
    this.app.get<{
      Querystring: { namespace?: string };
    }>("/api/rooms", async (request, _reply) => {
      const { namespace = "/" } = request.query;
      const ns = this.io.of(namespace);

      const rooms = Array.from(ns.adapter.rooms.entries()).map(([roomId, room]) => ({
        id: roomId,
        clients: room.size,
        namespace,
      }));

      return { rooms, namespace, total: rooms.length };
    });

    // Emit to namespace
    this.app.post<{
      Body: {
        event: string;
        data: unknown;
        namespace?: string;
        room?: string;
      };
    }>("/api/emit", async (request, reply) => {
      const { event, data, namespace = "/", room } = request.body;

      if (!event) {
        return reply.code(HttpStatus.BAD_REQUEST).send({ error: "Event name is required" });
      }

      const ns = this.io.of(namespace);

      if (room) {
        ns.to(room).emit(event, data);
      } else {
        ns.emit(event, data);
      }

      return {
        success: true,
        event,
        namespace,
        room: room || "all",
        timestamp: Date.now(),
      };
    });

    // Join/leave room via HTTP
    this.app.post<{
      Body: {
        clientId: string;
        room: string;
        action: "join" | "leave";
        namespace?: string;
      };
    }>("/api/room", async (request, reply) => {
      const { clientId, room, action, namespace = "/" } = request.body;

      const ns = this.io.of(namespace);
      const socket = Array.from(ns.sockets.values()).find((s) => s.id === clientId);

      if (!socket) {
        return reply.code(HttpStatus.NOT_FOUND).send({ error: "Client not found" });
      }

      if (action === "join") {
        await socket.join(room);
      } else if (action === "leave") {
        await socket.leave(room);
      } else {
        return reply.code(HttpStatus.BAD_REQUEST).send({ error: "Invalid action" });
      }

      return {
        success: true,
        clientId,
        room,
        action,
        namespace,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    // Default namespace handler
    this.io.on("connection", (socket) => {
      this.handleSocketConnection(socket, "/");
    });

    // Setup additional namespaces if enabled
    if (this.config.enableNamespaces) {
      // Chat namespace
      const chatNamespace = this.io.of("/chat");
      this.namespaces.set("/chat", chatNamespace);

      chatNamespace.on("connection", (socket) => {
        this.handleSocketConnection(socket, "/chat");

        // Chat-specific events (accept { payload } or flat { username, message, room })
        socket.on("send_message", (data: { payload?: { username?: string; message?: string; room?: string }; username?: string; message?: string; room?: string }) => {
          const body = data.payload ?? data;
          const message: AnyMessage = {
            id: crypto.randomUUID(),
            type: MessageType.CHAT,
            payload: {
              username: body.username ?? "Anonymous",
              message: body.message ?? "",
              room: body.room,
            },
            timestamp: Date.now(),
            clientId: socket.id,
          };
          if (body.room) {
            socket.to(body.room).emit(MessageType.MESSAGE, message);
            socket.emit(MessageType.MESSAGE, message);
          } else {
            chatNamespace.emit(MessageType.MESSAGE, message);
          }
        });
      });

      // Notifications namespace
      const notificationNamespace = this.io.of("/notifications");
      this.namespaces.set("/notifications", notificationNamespace);

      notificationNamespace.on("connection", (socket) => {
        this.handleSocketConnection(socket, "/notifications");

        // Subscribe to notification types
        socket.on("subscribe", (types: string[]) => {
          types.forEach((type) => socket.join(`notifications:${type}`));
          socket.emit("subscribed", { types, timestamp: Date.now() });
        });

        socket.on("unsubscribe", (types: string[]) => {
          types.forEach((type) => socket.leave(`notifications:${type}`));
          socket.emit("unsubscribed", { types, timestamp: Date.now() });
        });
      });
    }
  }

  /**
   * Handle individual socket connection
   */
  private async handleSocketConnection(socket: SocketIOSocket, namespace: string): Promise<void> {
    const metadata = {
      namespace,
      transport: socket.conn.transport.name,
      userAgent: socket.handshake.headers["user-agent"],
      ip: socket.handshake.address,
      query: socket.handshake.query,
      connectedAt: Date.now(),
    };

    // Add client to manager
    const client = await this.manager.addClient(socket, metadata);

    // Handle generic messages
    socket.on(MessageType.MESSAGE, async (data: string | AnyMessage) => {
      try {
        let message: AnyMessage;

        if (typeof data === "string") {
          message = JSON.parse(data);
        } else {
          message = data;
        }

        await this.manager.handleMessage(client.id, message);
      } catch {
        socket.emit(MessageType.ERROR, {
          error: "Invalid message format",
          timestamp: Date.now(),
        });
      }
    });

    // Chat on default namespace so frontend (connecting to /) can use chat without /chat namespace
    socket.on("send_message", (data: { payload?: { username?: string; message?: string; room?: string }; username?: string; message?: string; room?: string }) => {
      const body = data.payload ?? data;
      const username = body.username ?? "Anonymous";
      const messageText = body.message ?? "";
      const room = body.room;
      const message: AnyMessage = {
        id: crypto.randomUUID(),
        type: MessageType.CHAT,
        payload: { username, message: messageText, room },
        timestamp: Date.now(),
        clientId: socket.id,
      };
      const ns = socket.nsp;
      if (room) {
        socket.to(room).emit(MessageType.MESSAGE, message);
        socket.emit(MessageType.MESSAGE, message); // so sender sees their own room message
      } else {
        ns.emit(MessageType.MESSAGE, message);
      }
    });

    // Handle room operations (accept { payload: { room } } or { room } from frontend)
    socket.on(MessageType.JOIN_ROOM, async (data: { payload?: { room?: string }; room?: string }) => {
      const room = data.payload?.room ?? data.room;
      if (!room) return;
      await socket.join(room);
      await this.manager.addClientToRoom(client.id, room);
      socket.emit(MessageType.ROOM_JOINED, {
        room,
        timestamp: Date.now(),
      });
    });

    socket.on(MessageType.LEAVE_ROOM, async (data: { payload?: { room?: string }; room?: string }) => {
      const room = data.payload?.room ?? data.room;
      if (!room) return;
      await socket.leave(room);
      await this.manager.removeClientFromRoom(client.id, room);
      socket.emit(MessageType.ROOM_LEFT, {
        room,
        timestamp: Date.now(),
      });
    });

    // Handle custom events
    socket.on(MessageType.PING, () => {
      socket.emit(MessageType.PONG, { timestamp: Date.now() });
    });

    socket.on(MessageType.ECHO, (data: { payload?: unknown }) => {
      const payload = data?.payload ?? data;
      socket.emit(MessageType.ECHO_RESPONSE, {
        id: crypto.randomUUID(),
        type: MessageType.ECHO_RESPONSE,
        payload: { original: payload, echoed: true, timestamp: Date.now() },
        timestamp: Date.now(),
      });
    });

    socket.on(MessageType.BROADCAST_TEST, (data: { payload?: { message?: string }; message?: string }) => {
      const msg = data?.payload?.message ?? (data as { message?: string }).message ?? "Broadcast test";
      this.io.emit(MessageType.BROADCAST_MESSAGE, {
        id: crypto.randomUUID(),
        type: MessageType.BROADCAST_MESSAGE,
        payload: { message: msg, sender: socket.id, timestamp: Date.now() },
        timestamp: Date.now(),
      });
    });

    socket.on("get_stats", () => {
      socket.emit("stats", this.getStats());
    });

    socket.on(MessageType.GET_SERVER_STATS, () => {
      socket.emit(MessageType.SERVER_STATS, {
        type: MessageType.SERVER_STATS,
        payload: this.getStats(),
        timestamp: Date.now(),
      });
    });

    socket.on("get_rooms", () => {
      const rooms = Array.from(socket.rooms);
      socket.emit("rooms", { rooms, timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on("disconnect", async (reason: string) => {
      this.app.log?.info(`Client ${client.id} disconnected: ${reason}`);
      await this.manager.removeClient(client.id);
    });

    // Send welcome message
    socket.emit("connected", {
      clientId: client.id,
      namespace,
      message: "Connected to Socket.IO server",
      serverTime: Date.now(),
      transport: socket.conn.transport.name,
    });
  }

  /**
   * Start the Socket.IO server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Server is already running");
    }

    try {
      await this.app.listen({
        port: this.config.port,
        host: this.config.host,
      });

      const addr = this.app.server?.address();
      if (addr && typeof addr === "object" && typeof (addr as { port: number }).port === "number") {
        this.config.port = (addr as { port: number }).port;
      }

      // Attach Socket.IO to the HTTP server
      this.io.attach(this.app.server);

      this.isRunning = true;
      this.app.log?.info(`Socket.IO server started on ${this.config.host}:${this.config.port}`);
      this.app.log?.info(`Namespaces: ${Array.from(this.namespaces.keys()).join(", ")}`);
      this.app.log?.info(`Transports: ${this.config.transports.join(", ")}`);
    } catch (error) {
      this.app.log?.error(error, "Failed to start Socket.IO server");
      throw error;
    }
  }

  /**
   * Get the port the server is listening on (after start(); when port was 0, returns OS-assigned port).
   */
  getPort(): number {
    return this.config.port;
  }

  /**
   * Stop the Socket.IO server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      this.manager.destroy();
      this.io.close();
      await this.app.close();
      this.isRunning = false;
      this.app.log?.info("Socket.IO server stopped");
    } catch (error) {
      this.app.log?.error(error, "Error stopping Socket.IO server");
      throw error;
    }
  }

  /**
   * Broadcast using Socket.IO
   */
  broadcast(message: AnyMessage, room?: string): void {
    const event = message.type;

    if (room) {
      this.io.to(room).emit(event, message);
    } else {
      this.io.emit(event, message);
    }
  }

  /**
   * Send to specific client using Socket.IO
   */
  sendToClient(clientId: string, message: AnyMessage): boolean {
    const socket = this.io.sockets.sockets.get(clientId);
    if (!socket) return false;

    try {
      socket.emit(message.type, message);
      return true;
    } catch (error) {
      this.app.log?.error(error, "Failed to send message to client");
      return false;
    }
  }

  /**
   * Emit to namespace
   */
  emitToNamespace(namespace: string, event: string, data: unknown): void {
    this.io.of(namespace).emit(event, data);
  }

  /**
   * Emit to room in namespace
   */
  emitToRoom(namespace: string, room: string, event: string, data: unknown): void {
    this.io.of(namespace).to(room).emit(event, data);
  }

  // Implement remaining WebSocketServer interface methods
  getStats(): WebSocketStats {
    return this.manager.getStats();
  }

  getClients(): WebSocketClient[] {
    return this.manager.getClients();
  }

  getRooms(): WebSocketRoom[] {
    return this.manager.getRooms();
  }

  addClientToRoom(clientId: string, room: string): boolean {
    // For Socket.IO, we also need to join the actual Socket.IO room
    const socket = this.io.sockets.sockets.get(clientId);
    if (socket) {
      socket.join(room);
    }
    this.manager.addClientToRoom(clientId, room);
    return true;
  }

  removeClientFromRoom(clientId: string, room: string): boolean {
    // For Socket.IO, we also need to leave the actual Socket.IO room
    const socket = this.io.sockets.sockets.get(clientId);
    if (socket) {
      socket.leave(room);
    }
    this.manager.removeClientFromRoom(clientId, room);
    return true;
  }

  /**
   * Get Socket.IO server instance for advanced usage
   */
  getSocketIOServer(): SocketIOServer {
    return this.io;
  }
}
