// Main Server Entry Point - Demonstrates all WebSocket implementations

import { BasicWebSocketServer } from "./basic-websocket-server";
import { AdvancedWebSocketServer } from "./advanced-websocket-server";
import { SocketIOWebSocketServer } from "./socketio-server";
import type { WebSocketHooks, AnyMessage } from "./types";
import { isRoomPayload, isPayloadObject } from "./types";
import { ServerType, MessageType, RoomAction, SOCKETIO_TRANSPORTS } from "./constants";

// Configuration for different server types
const SERVER_TYPE = (process.env.WS_SERVER_TYPE ||
  ServerType.BASIC) as import("./constants").ServerTypeValue;
const PORT_OFFSET = parseInt(process.env.PORT_OFFSET || "0");

// Pending server-info timers per client (cleared on disconnect to avoid dangling handlers)
const serverInfoTimers = new Map<string, NodeJS.Timeout>();

// Common hooks for all servers
const commonHooks: WebSocketHooks = {
  onConnect: async (client) => {
    console.warn(`Client connected: ${client.id} from ${client.metadata.ip}`);

    // Send server info message
    const serverInfo: AnyMessage = {
      id: crypto.randomUUID(),
      type: MessageType.SERVER_INFO,
      payload: {
        serverType: SERVER_TYPE,
        serverTime: Date.now(),
        clientId: client.id,
        features: getServerFeatures(SERVER_TYPE),
      },
      timestamp: Date.now(),
    };

    // Delay to ensure client is ready; store handle so we can clear on disconnect
    const timer = setTimeout(() => {
      serverInfoTimers.delete(client.id);
      if (client.connected) {
        sendToClient(client.id, serverInfo);
      }
    }, 100);
    serverInfoTimers.set(client.id, timer);
  },

  onDisconnect: async (client) => {
    const timer = serverInfoTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      serverInfoTimers.delete(client.id);
    }
    console.warn(`Client disconnected: ${client.id}`);
  },

  onMessage: async (client, message) => {
    console.warn(`Message from ${client.id}:`, message.type, message.payload);

    // Handle demo-specific message types
    switch (message.type) {
      case MessageType.ECHO:
        // Echo the message back to the sender
        sendToClient(client.id, {
          id: crypto.randomUUID(),
          type: MessageType.ECHO_RESPONSE,
          payload: {
            original: message.payload,
            echoed: true,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
        break;

      case MessageType.BROADCAST_TEST:
        // Broadcast a test message to all clients
        server.broadcast({
          id: crypto.randomUUID(),
          type: MessageType.BROADCAST_MESSAGE,
          payload: {
            message: `Broadcast test from ${client.id}`,
            sender: client.id,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
        break;

      case MessageType.ROOM_BROADCAST: {
        if (isRoomPayload(message.payload)) {
          const room = message.payload.room;
          const msg =
            isPayloadObject(message.payload) && "message" in message.payload
              ? String(message.payload.message)
              : "Room broadcast test";
          server.broadcast(
            {
              id: crypto.randomUUID(),
              type: MessageType.ROOM_MESSAGE,
              payload: {
                message: msg,
                sender: client.id,
                room,
                timestamp: Date.now(),
              },
              timestamp: Date.now(),
            },
            room
          );
        }
        break;
      }

      case MessageType.GET_SERVER_STATS:
        sendToClient(client.id, {
          id: crypto.randomUUID(),
          type: MessageType.SERVER_STATS,
          payload: server.getStats() as import("./types").MessagePayload,
          timestamp: Date.now(),
        });
        break;
    }
  },

  onError: async (client, error) => {
    console.warn(`Error from client ${client.id}:`, error.message);
  },

  onRoomJoin: async (client, room) => {
    console.warn(`Client ${client.id} joined room: ${room}`);

    // Notify other room members
    server.broadcast(
      {
        id: crypto.randomUUID(),
        type: MessageType.ROOM_NOTIFICATION,
        payload: {
          action: RoomAction.JOINED,
          clientId: client.id,
          room,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      },
      room
    );
  },

  onRoomLeave: async (client, room) => {
    console.warn(`Client ${client.id} left room: ${room}`);

    // Notify other room members
    server.broadcast(
      {
        id: crypto.randomUUID(),
        type: MessageType.ROOM_NOTIFICATION,
        payload: {
          action: RoomAction.LEFT,
          clientId: client.id,
          room,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      },
      room
    );
  },
};

// Global server reference for hooks
let server: BasicWebSocketServer | AdvancedWebSocketServer | SocketIOWebSocketServer;

// Demo broadcast interval (cleared on shutdown to avoid dangling handler)
let demoBroadcastIntervalId: NodeJS.Timeout | null = null;

// Helper function to send message to client
function sendToClient(clientId: string, message: AnyMessage): void {
  if (server) {
    server.sendToClient(clientId, message);
  }
}

// Get server-specific features
function getServerFeatures(serverType: string): Record<string, boolean> {
  switch (serverType) {
    case ServerType.BASIC:
      return {
        basicWebSocket: true,
        rooms: true,
        ping: true,
        broadcast: true,
      };
    case ServerType.ADVANCED:
      return {
        basicWebSocket: true,
        rooms: true,
        ping: true,
        broadcast: true,
        rateLimit: true,
        authentication: false, // Disabled by default
        messageHistory: true,
        presence: true,
      };
    case ServerType.SOCKETIO:
      return {
        socketIO: true,
        namespaces: true,
        rooms: true,
        events: true,
        transport: true,
        polling: true,
        websocket: true,
      };
    default:
      return {};
  }
}

// Create and start the appropriate server
async function startServer(): Promise<void> {
  console.warn(`Starting ${SERVER_TYPE} WebSocket server...`);

  try {
    switch (SERVER_TYPE) {
      case ServerType.BASIC:
        server = new BasicWebSocketServer(
          {
            port: 3001 + PORT_OFFSET,
            host: "0.0.0.0",
          },
          commonHooks
        );
        break;

      case ServerType.ADVANCED:
        server = new AdvancedWebSocketServer(
          {
            port: 3002 + PORT_OFFSET,
            host: "0.0.0.0",
            enableRateLimit: true,
            rateLimitRequests: 100,
            rateLimitWindow: 60000,
            enableAuth: false, // Disabled for demo
            enableMessageHistory: true,
            maxHistorySize: 100,
            enablePresence: true,
          },
          commonHooks
        );
        break;

      case ServerType.SOCKETIO:
        server = new SocketIOWebSocketServer(
          {
            port: 3003 + PORT_OFFSET,
            host: "0.0.0.0",
            enableNamespaces: true,
            transports: [...SOCKETIO_TRANSPORTS],
          },
          commonHooks
        );
        break;

      default:
        throw new Error(`Unknown server type: ${SERVER_TYPE}`);
    }

    await server.start();

    // Setup graceful shutdown
    const shutdown = async (): Promise<void> => {
      if (demoBroadcastIntervalId !== null) {
        clearInterval(demoBroadcastIntervalId);
        demoBroadcastIntervalId = null;
      }
      serverInfoTimers.forEach((t) => clearTimeout(t));
      serverInfoTimers.clear();
      await server.stop();
      process.exit(0);
    };

    process.on("SIGINT", () => {
      console.warn("\nReceived SIGINT, shutting down gracefully...");
      void shutdown();
    });

    process.on("SIGTERM", () => {
      console.warn("\nReceived SIGTERM, shutting down gracefully...");
      void shutdown();
    });

    // Demo: Send periodic broadcast messages
    if (process.env.ENABLE_DEMO_BROADCASTS && process.env.ENABLE_DEMO_BROADCASTS === "true") {
      demoBroadcastIntervalId = setInterval(() => {
        const stats = server.getStats();
        if (stats.activeConnections > 0) {
          server.broadcast({
            id: crypto.randomUUID(),
            type: MessageType.SERVER_HEARTBEAT,
            payload: {
              message: "Server heartbeat",
              stats,
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          });
        }
      }, 30000); // Every 30 seconds
    }
  } catch (error) {
    console.warn("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((err: unknown) => {
  console.warn("Server failed:", err);
});

// Export for testing
export { server, startServer };
