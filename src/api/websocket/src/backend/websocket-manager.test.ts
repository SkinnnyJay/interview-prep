// WebSocket Manager Tests

import { WebSocketManager } from "./websocket-manager";
import type { WebSocketConfig, WebSocketHooks, AnyMessage, WebSocketClient } from "./types";

// Mock WebSocket implementation
class MockWebSocket {
  public messages: string[] = [];
  public closed = false;
  public closeCode?: number;
  public closeReason?: string;

  send(data: string): void {
    if (this.closed) throw new Error("WebSocket is closed");
    this.messages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
  }

  getLastMessage(): unknown {
    const lastMsg = this.messages[this.messages.length - 1];
    return lastMsg ? JSON.parse(lastMsg) : null;
  }

  clearMessages(): void {
    this.messages = [];
  }
}

describe("WebSocketManager", () => {
  let manager: WebSocketManager;
  let config: WebSocketConfig;
  let hooks: WebSocketHooks;
  let mockSocket: MockWebSocket;

  beforeEach(() => {
    config = {
      port: 3001,
      host: "0.0.0.0",
      pingInterval: 1000,
      pingTimeout: 2000,
      maxConnections: 100,
      enableCompression: true,
      enableCors: true,
    };

    hooks = {
      onConnect: jest.fn(),
      onDisconnect: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onRoomJoin: jest.fn(),
      onRoomLeave: jest.fn(),
    };

    manager = new WebSocketManager(config, hooks);
    mockSocket = new MockWebSocket();
  });

  afterEach(async () => {
    // Destroy the manager and clean up all resources
    manager.destroy();

    // Clear any timers that might be running
    jest.clearAllTimers();

    // Clear all mocks
    jest.clearAllMocks();

    // Close any open sockets
    if (mockSocket && !mockSocket.closed) {
      mockSocket.close();
    }
  });

  describe("Client Management", () => {
    test("should add client successfully", async () => {
      const client = await manager.addClient(mockSocket, { test: "metadata" });

      expect(client.id).toBeDefined();
      expect(client.socket).toBe(mockSocket);
      expect(client.metadata.test).toBe("metadata");
      expect(client.connected).toBe(true);
      expect(client.rooms.size).toBe(0);
      expect(hooks.onConnect).toHaveBeenCalledWith(client);
    });

    test("should remove client successfully", async () => {
      const client = await manager.addClient(mockSocket, {});
      await manager.removeClient(client.id);

      expect(client.connected).toBe(false);
      expect(hooks.onDisconnect).toHaveBeenCalledWith(client);
    });

    test("should handle removing non-existent client", async () => {
      await expect(manager.removeClient("non-existent")).resolves.not.toThrow();
    });

    test("should get clients list", async () => {
      const client1 = await manager.addClient(new MockWebSocket(), {});
      const client2 = await manager.addClient(new MockWebSocket(), {});

      const clients = manager.getClients();
      expect(clients).toHaveLength(2);
      expect(clients.map((c) => c.id)).toContain(client1.id);
      expect(clients.map((c) => c.id)).toContain(client2.id);
    });
  });

  describe("Message Handling", () => {
    let client: WebSocketClient;

    beforeEach(async () => {
      client = await manager.addClient(mockSocket, {});
      mockSocket.clearMessages();
    });

    test("should handle valid JSON message", async () => {
      const message = {
        type: "test",
        payload: { data: "test" },
      };

      await manager.handleMessage(client.id, JSON.stringify(message));

      expect(hooks.onMessage).toHaveBeenCalled();
      const call = (hooks.onMessage as jest.Mock).mock.calls[0];
      expect(call[0]).toBe(client);
      expect(call[1].type).toBe("test");
      expect(call[1].payload.data).toBe("test");
      expect(call[1].clientId).toBe(client.id);
    });

    test("should handle object message", async () => {
      const message = {
        type: "test",
        payload: { data: "test" },
      };

      await manager.handleMessage(client.id, message);

      expect(hooks.onMessage).toHaveBeenCalled();
    });

    test("should handle invalid JSON message", async () => {
      await manager.handleMessage(client.id, "invalid json");

      const lastMessage = mockSocket.getLastMessage();
      expect(lastMessage.type).toBe("error");
      expect(lastMessage.payload.error).toBe("Invalid message format");
    });

    test("should handle ping message", async () => {
      const pingMessage = {
        type: "ping",
        payload: {},
      };

      await manager.handleMessage(client.id, pingMessage);

      const lastMessage = mockSocket.getLastMessage();
      expect(lastMessage.type).toBe("pong");
      expect(lastMessage.payload.timestamp).toBeDefined();
    });

    test("should handle non-existent client message", async () => {
      await expect(manager.handleMessage("non-existent", "test")).resolves.not.toThrow();
    });
  });

  describe("Room Management", () => {
    let client1: WebSocketClient;
    let client2: WebSocketClient;
    let mockSocket2: MockWebSocket;

    beforeEach(async () => {
      client1 = await manager.addClient(mockSocket, {});
      mockSocket2 = new MockWebSocket();
      client2 = await manager.addClient(mockSocket2, {});
      mockSocket.clearMessages();
      mockSocket2.clearMessages();
    });

    test("should add client to room", async () => {
      const result = await manager.addClientToRoom(client1.id, "test-room");

      expect(result).toBe(true);
      expect(client1.rooms.has("test-room")).toBe(true);
      expect(hooks.onRoomJoin).toHaveBeenCalledWith(client1, "test-room");

      const lastMessage = mockSocket.getLastMessage();
      expect(lastMessage.type).toBe("room_joined");
      expect(lastMessage.payload.room).toBe("test-room");
    });

    test("should remove client from room", async () => {
      await manager.addClientToRoom(client1.id, "test-room");
      mockSocket.clearMessages();

      const result = await manager.removeClientFromRoom(client1.id, "test-room");

      expect(result).toBe(true);
      expect(client1.rooms.has("test-room")).toBe(false);
      expect(hooks.onRoomLeave).toHaveBeenCalledWith(client1, "test-room");

      const lastMessage = mockSocket.getLastMessage();
      expect(lastMessage.type).toBe("room_left");
      expect(lastMessage.payload.room).toBe("test-room");
    });

    test("should broadcast to room", async () => {
      await manager.addClientToRoom(client1.id, "test-room");
      await manager.addClientToRoom(client2.id, "test-room");
      mockSocket.clearMessages();
      mockSocket2.clearMessages();

      const message: AnyMessage = {
        id: "test-id",
        type: "test",
        payload: { data: "room broadcast" },
        timestamp: Date.now(),
      };

      manager.broadcastToRoom("test-room", message);

      expect(mockSocket.messages).toHaveLength(1);
      expect(mockSocket2.messages).toHaveLength(1);
      expect(JSON.parse(mockSocket.messages[0]).payload.data).toBe("room broadcast");
    });

    test("should exclude sender from room broadcast", async () => {
      await manager.addClientToRoom(client1.id, "test-room");
      await manager.addClientToRoom(client2.id, "test-room");
      mockSocket.clearMessages();
      mockSocket2.clearMessages();

      const message: AnyMessage = {
        id: "test-id",
        type: "test",
        payload: { data: "room broadcast" },
        timestamp: Date.now(),
      };

      manager.broadcastToRoom("test-room", message, client1.id);

      expect(mockSocket.messages).toHaveLength(0);
      expect(mockSocket2.messages).toHaveLength(1);
    });

    test("should handle room join message", async () => {
      const joinMessage = {
        type: "join_room",
        payload: { room: "test-room" },
      };

      await manager.handleMessage(client1.id, joinMessage);

      expect(client1.rooms.has("test-room")).toBe(true);
    });

    test("should handle room leave message", async () => {
      await manager.addClientToRoom(client1.id, "test-room");

      const leaveMessage = {
        type: "leave_room",
        payload: { room: "test-room" },
      };

      await manager.handleMessage(client1.id, leaveMessage);

      expect(client1.rooms.has("test-room")).toBe(false);
    });

    test("should handle room message broadcast", async () => {
      await manager.addClientToRoom(client1.id, "test-room");
      await manager.addClientToRoom(client2.id, "test-room");
      mockSocket.clearMessages();
      mockSocket2.clearMessages();

      const roomMessage = {
        type: "room_message",
        payload: {
          room: "test-room",
          data: "hello room",
        },
      };

      await manager.handleMessage(client1.id, roomMessage);

      // Client1 should not receive the message (sender)
      expect(mockSocket.messages).toHaveLength(0);
      // Client2 should receive the message
      expect(mockSocket2.messages).toHaveLength(1);
    });

    test("should get rooms list", async () => {
      await manager.addClientToRoom(client1.id, "room1");
      await manager.addClientToRoom(client2.id, "room2");

      const rooms = manager.getRooms();
      expect(rooms).toHaveLength(2);
      expect(rooms.map((r) => r.id)).toContain("room1");
      expect(rooms.map((r) => r.id)).toContain("room2");
    });

    test("should remove empty room", async () => {
      await manager.addClientToRoom(client1.id, "test-room");
      await manager.removeClientFromRoom(client1.id, "test-room");

      const rooms = manager.getRooms();
      expect(rooms.map((r) => r.id)).not.toContain("test-room");
    });
  });

  describe("Broadcasting", () => {
    let client1: WebSocketClient;
    let mockSocket2: MockWebSocket;

    beforeEach(async () => {
      client1 = await manager.addClient(mockSocket, {});
      mockSocket2 = new MockWebSocket();
      await manager.addClient(mockSocket2, {});
      mockSocket.clearMessages();
      mockSocket2.clearMessages();
    });

    test("should broadcast to all clients", () => {
      const message: AnyMessage = {
        id: "test-id",
        type: "broadcast",
        payload: { data: "hello all" },
        timestamp: Date.now(),
      };

      manager.broadcast(message);

      expect(mockSocket.messages).toHaveLength(1);
      expect(mockSocket2.messages).toHaveLength(1);
      expect(JSON.parse(mockSocket.messages[0]).payload.data).toBe("hello all");
    });

    test("should send to specific client", () => {
      const message: AnyMessage = {
        id: "test-id",
        type: "direct",
        payload: { data: "hello client1" },
        timestamp: Date.now(),
      };

      const result = manager.sendToClient(client1.id, message);

      expect(result).toBe(true);
      expect(mockSocket.messages).toHaveLength(1);
      expect(mockSocket2.messages).toHaveLength(0);
      expect(JSON.parse(mockSocket.messages[0]).payload.data).toBe("hello client1");
    });

    test("should fail to send to non-existent client", () => {
      const message: AnyMessage = {
        id: "test-id",
        type: "direct",
        payload: { data: "hello" },
        timestamp: Date.now(),
      };

      const result = manager.sendToClient("non-existent", message);

      expect(result).toBe(false);
    });

    test("should fail to send to disconnected client", async () => {
      await manager.removeClient(client1.id);

      const message: AnyMessage = {
        id: "test-id",
        type: "direct",
        payload: { data: "hello" },
        timestamp: Date.now(),
      };

      const result = manager.sendToClient(client1.id, message);

      expect(result).toBe(false);
    });
  });

  describe("Statistics", () => {
    test("should return correct stats", async () => {
      const client1 = await manager.addClient(mockSocket, {});
      await manager.addClient(new MockWebSocket(), {});
      await manager.addClientToRoom(client1.id, "room1");

      const stats = manager.getStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.activeConnections).toBe(2);
      expect(stats.rooms).toBe(1);
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.totalMessages).toBe(0);
    });

    test("should track messages", async () => {
      const client = await manager.addClient(mockSocket, {});

      await manager.handleMessage(client.id, { type: "test", payload: {} });
      await manager.handleMessage(client.id, { type: "test2", payload: {} });

      const stats = manager.getStats();
      expect(stats.totalMessages).toBe(2);
    });
  });

  describe("Cleanup and Destruction", () => {
    test("should cleanup all resources on destroy", async () => {
      const client1 = await manager.addClient(mockSocket, {});
      await manager.addClient(new MockWebSocket(), {});
      await manager.addClientToRoom(client1.id, "room1");

      manager.destroy();

      const stats = manager.getStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.rooms).toBe(0);
    });

    test("should remove clients from all rooms on disconnect", async () => {
      const client = await manager.addClient(mockSocket, {});
      await manager.addClientToRoom(client.id, "room1");
      await manager.addClientToRoom(client.id, "room2");

      expect(manager.getRooms()).toHaveLength(2);

      await manager.removeClient(client.id);

      expect(manager.getRooms()).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    test("should handle socket send error gracefully", async () => {
      const errorSocket = {
        send: jest.fn().mockImplementation(() => {
          throw new Error("Send failed");
        }),
      };

      const client = await manager.addClient(errorSocket, {});
      const message: AnyMessage = {
        id: "test-id",
        type: "test",
        payload: {},
        timestamp: Date.now(),
      };

      const result = manager.sendToClient(client.id, message);

      expect(result).toBe(false);
    });

    test("should call error hook on message parsing error", async () => {
      const client = await manager.addClient(mockSocket, {});

      await manager.handleMessage(client.id, "invalid json");

      expect(hooks.onError).toHaveBeenCalled();
    });
  });
});
