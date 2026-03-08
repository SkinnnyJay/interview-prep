import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { StreamingService } from "./streaming-service";
import type { SocketStream } from "../types/common";
import { FastifyRequest } from "fastify";

class MockSocket extends EventEmitter {
  public sent: string[] = [];
  public closedWith?: { code?: number; reason?: string };
  public readyState = 1;
  public close = jest.fn((code?: number, reason?: string) => {
    this.closedWith = { code, reason };
    this.readyState = 3;
  });
  public send = jest.fn((payload: string) => {
    this.sent.push(payload);
  });
  public ping = jest.fn();
}

const createRequest = (context: Partial<FastifyRequest["requestContext"]> = {}): FastifyRequest =>
  ({
    requestContext: {
      requestId: "req-1",
      startTime: Date.now(),
      ip: "127.0.0.1",
      userId: "user-1",
      userRole: "member",
      ...context,
    },
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }) as unknown as FastifyRequest;

const createSocketStream = (): { stream: SocketStream; socket: MockSocket } => {
  const socket = new MockSocket();
  return { stream: { socket } as unknown as SocketStream, socket };
};

describe("StreamingService", () => {
  let service: StreamingService;

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe("handleConnection", () => {
    it("registers a connection and sends welcome message", async () => {
      service = new StreamingService({ heartbeatInterval: 60_000 });
      const { stream, socket } = createSocketStream();

      await service.handleConnection(stream, createRequest());

      const connections = (service as unknown as { connections: Map<string, SocketStream> })
        .connections;
      expect(connections.size).toBe(1);
      expect(socket.send).toHaveBeenCalled();

      const sent = JSON.parse(socket.sent[0]);
      expect(sent.type).toBe("connection.established");
      expect(sent.data.connectionId).toBeDefined();
    });

    it("closes the socket when connection limit exceeded", async () => {
      service = new StreamingService({ maxConnections: 0, heartbeatInterval: 60_000 });
      const { stream, socket } = createSocketStream();

      await service.handleConnection(stream, createRequest());

      expect(socket.close).toHaveBeenCalledWith(1008, "Connection limit exceeded");
      const connections = (service as unknown as { connections: Map<string, SocketStream> })
        .connections;
      expect(connections.size).toBe(0);
    });
  });

  describe("message handling", () => {
    let socket: MockSocket;

    beforeEach(async () => {
      service = new StreamingService({
        enablePersistence: false,
        heartbeatInterval: 60_000,
        messageRateLimit: 2,
      });
      const created = createSocketStream();
      socket = created.socket;
      await service.handleConnection(created.stream, createRequest());
    });

    it("creates subscriptions from subscribe messages", async () => {
      socket.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            data: { topic: "news", filters: { level: "info" } },
          })
        )
      );

      const subscriptions = (
        service as unknown as { subscriptions: Map<string, { id: string; topic: string }> }
      ).subscriptions;
      expect(subscriptions.size).toBe(1);
      const confirmation = JSON.parse(socket.sent[socket.sent.length - 1]);
      expect(confirmation.type).toBe("subscription.confirmed");
      expect(confirmation.data.topic).toBe("news");
    });

    it("enforces rate limiting", async () => {
      const message = Buffer.from(JSON.stringify({ type: "ping" }));
      socket.emit("message", message);
      socket.emit("message", message);
      socket.emit("message", message);

      const lastMessage = JSON.parse(socket.sent[socket.sent.length - 1]);
      expect(lastMessage.type).toBe("error");
      expect(lastMessage.data.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("handles invalid payloads gracefully", async () => {
      socket.emit("message", Buffer.from("not-json"));

      const errorMessage = JSON.parse(socket.sent[socket.sent.length - 1]);
      expect(errorMessage.type).toBe("error");
      expect(errorMessage.data.code).toBe("INVALID_MESSAGE");
    });
  });

  describe("handleDisconnection", () => {
    it("cleans connection state and notifies rooms", async () => {
      service = new StreamingService({ enablePersistence: false, heartbeatInterval: 60_000 });
      const { stream, socket } = createSocketStream();
      await service.handleConnection(stream, createRequest());
      const connectionId = Array.from(
        (service as unknown as { connections: Map<string, SocketStream> }).connections.keys()
      )[0];

      const svc = service as unknown as {
        connectionInfo: Map<string, { subscriptions: Set<string> }>;
        subscriptions: Map<string, unknown>;
        rooms: Map<
          string,
          { id: string; name: string; connections: Set<string>; messageHistory: unknown[] }
        >;
        handleDisconnection: (id: string) => void;
        connections: Map<string, unknown>;
      };
      const info = svc.connectionInfo.get(connectionId);
      if (info) info.subscriptions.add("sub-1");
      svc.subscriptions.set("sub-1", { id: "sub-1", topic: "news" });

      svc.rooms.set("room-1", {
        id: "room-1",
        name: "Room",
        connections: new Set([connectionId]),
        messageHistory: [],
      });

      svc.handleDisconnection(connectionId);

      expect(svc.connections.size).toBe(0);
      expect(svc.subscriptions.size).toBe(0);
      expect(svc.rooms.size).toBe(0);
      expect(socket.close).not.toHaveBeenCalled();
    });
  });

  describe("getStats and shutdown", () => {
    it("reports stats and clears state on shutdown", async () => {
      service = new StreamingService({ heartbeatInterval: 60_000 });
      const { stream } = createSocketStream();
      await service.handleConnection(stream, createRequest());

      const statsBefore = service.getStats();
      expect(statsBefore.connections).toBe(1);

      await service.shutdown();
      const statsAfter = service.getStats();
      expect(statsAfter.connections).toBe(0);
      expect(statsAfter.rooms).toBe(0);
    });
  });
});
