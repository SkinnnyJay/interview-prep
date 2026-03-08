import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

type FastifyRouteHandler = (request: unknown, reply: unknown) => unknown;

interface FastifyStub {
  getHandlers: Map<string, FastifyRouteHandler>;
  postHandlers: Map<string, FastifyRouteHandler>;
  hooks: Map<string, Array<(request: unknown, reply: unknown) => unknown>>;
  register: jest.Mock;
  get: jest.Mock;
  post: jest.Mock;
  addHook: jest.Mock;
  listen: jest.Mock;
  close: jest.Mock;
  server: Record<string, unknown>;
}

const fastifyInstances: FastifyStub[] = [];

const createFastifyInstance = (): FastifyStub => {
  const instance: FastifyStub = {
    getHandlers: new Map<string, FastifyRouteHandler>(),
    postHandlers: new Map<string, FastifyRouteHandler>(),
    hooks: new Map<string, Array<(request: unknown, reply: unknown) => unknown>>(),
    register: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    addHook: jest.fn(),
    listen: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    server: {},
  };

  instance.get.mockImplementation((path: string, handler: FastifyRouteHandler) => {
    instance.getHandlers.set(path, handler);
    return instance;
  });

  instance.post.mockImplementation((path: string, handler: FastifyRouteHandler) => {
    instance.postHandlers.set(path, handler);
    return instance;
  });

  instance.addHook.mockImplementation(
    (name: string, hook: (request: unknown, reply: unknown) => unknown) => {
      const existing = instance.hooks.get(name) || [];
      existing.push(hook);
      instance.hooks.set(name, existing);
      return instance;
    }
  );

  instance.register.mockImplementation((plugin: unknown) => {
    if (typeof plugin === "function") {
      const maybePromise = plugin(instance, {}, () => {});
      if (maybePromise && typeof maybePromise.then === "function") {
        return maybePromise;
      }
    }
    return instance;
  });

  return instance;
};

const fastifyFactoryMock = jest.fn(() => {
  const instance = createFastifyInstance();
  fastifyInstances.push(instance);
  return instance;
});

jest.mock("fastify", () => ({
  __esModule: true,
  default: fastifyFactoryMock,
}));

jest.mock("@fastify/websocket", () => jest.fn());

interface ManagerCapture {
  hooks: unknown;
  instance: {
    broadcast: jest.Mock;
    sendToClient: jest.Mock;
    getStats: jest.Mock;
    getClients: jest.Mock;
    getRooms: jest.Mock;
    addClient: jest.Mock;
    removeClient: jest.Mock;
    handleMessage: jest.Mock;
    addClientToRoom: jest.Mock;
    removeClientFromRoom: jest.Mock;
    destroy: jest.Mock;
  };
}

const managerCaptures: ManagerCapture[] = [];

jest.mock("./websocket-manager", () => ({
  WebSocketManager: jest.fn((config: unknown, hooks: unknown) => {
    const instance = {
      broadcast: jest.fn(),
      sendToClient: jest.fn().mockReturnValue(true),
      getStats: jest.fn().mockReturnValue({
        activeConnections: 0,
        totalConnections: 0,
        rooms: 0,
        messagesSent: 0,
        messagesReceived: 0,
        errors: 0,
      }),
      getClients: jest.fn().mockReturnValue([]),
      getRooms: jest.fn().mockReturnValue([]),
      addClient: jest.fn(),
      removeClient: jest.fn(),
      handleMessage: jest.fn(),
      addClientToRoom: jest.fn(),
      removeClientFromRoom: jest.fn(),
      destroy: jest.fn(),
    };
    managerCaptures.push({ hooks, instance });
    return instance;
  }),
}));

// Import after mocks
import { AdvancedWebSocketServer } from "./advanced-websocket-server";

const getLastFastifyInstance = (): FastifyStub => {
  if (fastifyInstances.length === 0) {
    throw new Error("Fastify instance not created");
  }
  return fastifyInstances[fastifyInstances.length - 1];
};

const getLastManagerCapture = (): ManagerCapture => {
  if (managerCaptures.length === 0) {
    throw new Error("WebSocketManager instance not created");
  }
  return managerCaptures[managerCaptures.length - 1];
};

const clearCleanupInterval = (server: AdvancedWebSocketServer): void => {
  const serverAny = server as unknown as Record<string, unknown>;
  if (serverAny.cleanupIntervalId) {
    clearInterval(serverAny.cleanupIntervalId);
    serverAny.cleanupIntervalId = null;
  }
};

describe("AdvancedWebSocketServer", () => {
  beforeEach(() => {
    fastifyInstances.length = 0;
    managerCaptures.length = 0;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("enforces rate limiting by sending an error after exceeding the window", async () => {
    const server = new AdvancedWebSocketServer({
      enableRateLimit: true,
      rateLimitRequests: 1,
      rateLimitWindow: 1000,
      enableMessageHistory: false,
      enablePresence: false,
    });

    const { hooks, instance: manager } = getLastManagerCapture();

    const message = {
      id: "msg-1",
      type: "chat",
      payload: { text: "hello" },
      timestamp: Date.now(),
    };

    await hooks.onMessage?.({ id: "client-1" }, message);
    expect(manager.sendToClient).not.toHaveBeenCalledWith(
      "client-1",
      expect.objectContaining({ type: "error" })
    );

    await hooks.onMessage?.({ id: "client-1" }, message);

    expect(manager.sendToClient).toHaveBeenCalledWith(
      "client-1",
      expect.objectContaining({
        type: "error",
        payload: expect.objectContaining({ error: "Rate limit exceeded", code: "RATE_LIMIT" }),
      })
    );

    clearCleanupInterval(server);
  });

  it("stores bounded message history per room", () => {
    const server = new AdvancedWebSocketServer({
      enableMessageHistory: true,
      maxHistorySize: 2,
      enableRateLimit: false,
      enablePresence: false,
    });

    const serverAny = server as unknown as Record<string, unknown>;

    serverAny.addToHistory(
      { id: "1", type: "chat", payload: { text: "first" }, timestamp: 1 },
      "room-a"
    );
    serverAny.addToHistory(
      { id: "2", type: "chat", payload: { text: "second" }, timestamp: 2 },
      "room-a"
    );
    serverAny.addToHistory(
      { id: "3", type: "chat", payload: { text: "third" }, timestamp: 3 },
      "room-a"
    );

    const history = serverAny.messageHistory.get("room-a");
    expect(history.messages).toHaveLength(2);
    expect(history.messages.map((m: { id: string }) => m.id)).toEqual(["2", "3"]);

    clearCleanupInterval(server);
  });

  it("tracks presence updates on connect and disconnect", async () => {
    const server = new AdvancedWebSocketServer({
      enablePresence: true,
      enableRateLimit: false,
      enableMessageHistory: false,
    });

    const { hooks } = getLastManagerCapture();
    const serverAny = server as unknown as Record<string, unknown>;

    await hooks.onConnect?.({ id: "client-42" });
    let presence = serverAny.presenceMap.get("client-42");
    expect(presence.status).toBe("online");

    await hooks.onDisconnect?.({ id: "client-42" });
    presence = serverAny.presenceMap.get("client-42");
    expect(presence.status).toBe("offline");
    expect(typeof presence.lastSeen).toBe("number");

    clearCleanupInterval(server);
  });

  it("cleans up resources on stop", async () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    const server = new AdvancedWebSocketServer({ enablePresence: false });
    const fastifyInstance = getLastFastifyInstance();
    const { instance: manager } = getLastManagerCapture();

    await server.start();
    expect(fastifyInstance.listen).toHaveBeenCalled();

    await server.stop();

    expect(manager.destroy).toHaveBeenCalled();
    expect(fastifyInstance.close).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();

    const serverAny = server as unknown as Record<string, unknown>;
    expect(serverAny.cleanupIntervalId).toBeNull();

    clearIntervalSpy.mockRestore();
  });

  it("exposes rate-limit insights via HTTP endpoint", async () => {
    const server = new AdvancedWebSocketServer({
      enableRateLimit: true,
      rateLimitRequests: 5,
      enableMessageHistory: false,
      enablePresence: false,
    });

    const fastifyInstance = getLastFastifyInstance();
    const handler = fastifyInstance.getHandlers.get("/api/rate-limit");
    if (!handler) {
      throw new Error("/api/rate-limit handler not registered");
    }

    const serverAny = server as unknown as Record<string, unknown>;
    serverAny.rateLimitMap.set("client-1", { count: 2, resetTime: Date.now() + 1000 });

    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const responseForClient = await handler({ query: { clientId: "client-1" } }, reply);
    expect(responseForClient).toEqual(
      expect.objectContaining({
        clientId: "client-1",
        requests: 2,
        remaining: 3,
      })
    );

    const allResponse = await handler({ query: {} }, reply);
    expect(allResponse).toEqual(
      expect.objectContaining({
        entries: [expect.objectContaining({ clientId: "client-1", requests: 2, remaining: 3 })],
        total: 1,
      })
    );

    clearCleanupInterval(server);
  });

  it("provides paginated message history when enabled", async () => {
    const server = new AdvancedWebSocketServer({
      enableMessageHistory: true,
      maxHistorySize: 10,
      enableRateLimit: false,
      enablePresence: false,
    });

    const fastifyInstance = getLastFastifyInstance();
    const handler = fastifyInstance.getHandlers.get("/api/history");
    if (!handler) {
      throw new Error("/api/history handler not registered");
    }

    const serverAny = server as unknown as Record<string, unknown>;
    serverAny.addToHistory({ id: "1", type: "chat", payload: {}, timestamp: 1 }, "room-1");
    serverAny.addToHistory({ id: "2", type: "chat", payload: {}, timestamp: 2 }, "room-1");

    const response = await handler({ query: { room: "room-1", limit: 1, offset: 0 } }, {});
    expect(response).toEqual(
      expect.objectContaining({
        room: "room-1",
        total: 2,
        messages: [expect.objectContaining({ id: "2" })],
      })
    );

    clearCleanupInterval(server);
  });

  it("validates broadcast payloads before delegating to manager", async () => {
    const server = new AdvancedWebSocketServer({ enableMessageHistory: false });
    const fastifyInstance = getLastFastifyInstance();
    const { instance: manager } = getLastManagerCapture();

    const handler = fastifyInstance.postHandlers.get("/api/broadcast");
    if (!handler) {
      throw new Error("/api/broadcast handler not registered");
    }

    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const payload = {
      message: {
        id: "msg-123",
        type: "notification",
        payload: { text: "hello" },
        timestamp: Date.now(),
      },
    };

    const response = await handler({ body: payload }, reply);
    expect(response).toEqual(
      expect.objectContaining({ success: true, broadcast: "all", savedToHistory: false })
    );
    expect(manager.broadcast).toHaveBeenCalledWith(payload.message, undefined);

    await handler({ body: { message: { payload: {} } } }, reply);
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Invalid message format" });

    clearCleanupInterval(server);
  });
});
