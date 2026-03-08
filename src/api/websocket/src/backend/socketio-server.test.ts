import { describe, it, expect, beforeEach, jest } from "@jest/globals";

type FastifyRouteHandler = (request: unknown, reply: unknown) => unknown;

interface FastifyStub {
  getHandlers: Map<string, FastifyRouteHandler>;
  postHandlers: Map<string, FastifyRouteHandler>;
  hooks: Map<string, Array<(...args: unknown[]) => unknown>>;
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
    hooks: new Map<string, Array<(...args: unknown[]) => unknown>>(),
    register: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    addHook: jest.fn(),
    listen: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    server: {
      address: jest.fn().mockReturnValue({ port: 3003, address: "0.0.0.0", family: "IPv4" }),
    },
  };

  instance.get.mockImplementation((path: string, handler: FastifyRouteHandler) => {
    instance.getHandlers.set(path, handler);
    return instance;
  });

  instance.post.mockImplementation((path: string, handler: FastifyRouteHandler) => {
    instance.postHandlers.set(path, handler);
    return instance;
  });

  instance.addHook.mockImplementation((name: string, hook: (...args: unknown[]) => unknown) => {
    const existing = instance.hooks.get(name) || [];
    existing.push(hook);
    instance.hooks.set(name, existing);
    return instance;
  });

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

interface NamespaceStub {
  name: string;
  emit: jest.Mock;
  to: jest.Mock;
  sockets: Map<string, unknown>;
  adapter: { rooms: Map<string, Set<string>> };
  on: jest.Mock;
}

interface SocketIOServerStub {
  server: Record<string, unknown>;
  namespaces: Map<string, NamespaceStub>;
  sockets: Map<string, unknown>;
  connectionHandler?: (socket: unknown) => Promise<void> | void;
}

const socketIoInstances: SocketIOServerStub[] = [];

const createNamespace = (name: string): NamespaceStub => {
  const namespace: NamespaceStub = {
    name,
    emit: jest.fn(),
    to: jest.fn((_room: string) => ({ emit: jest.fn() })),
    sockets: new Map<string, unknown>(),
    adapter: { rooms: new Map<string, Set<string>>() },
    on: jest.fn(),
  };

  namespace.on.mockImplementation(() => undefined);
  return namespace;
};

const socketServerFactory = jest.fn(() => {
  const namespaces = new Map<string, NamespaceStub>();
  const sockets = new Map<string, unknown>();
  const namespace = createNamespace("/");
  namespaces.set("/", namespace);

  const stub: SocketIOServerStub = {
    namespaces,
    sockets,
    server: {
      on: jest.fn((event: string, handler: (socket: unknown) => void) => {
        if (event === "connection") {
          stub.connectionHandler = handler;
        }
      }),
      of: jest.fn((ns: string) => {
        if (!namespaces.has(ns)) {
          const newNs = createNamespace(ns);
          namespaces.set(ns, newNs);
        }
        return namespaces.get(ns);
      }),
      emit: jest.fn(),
      to: jest.fn((_room: string) => ({ emit: jest.fn() })),
      attach: jest.fn(),
      close: jest.fn(),
      engine: { clientsCount: 0 },
      sockets: {
        sockets,
        adapter: {
          rooms: new Map<string, Set<string>>(),
          size: 0,
        },
      },
    },
  };

  return stub;
});

jest.mock("socket.io", () => ({
  Server: jest.fn((_config: unknown) => {
    const instance = socketServerFactory();
    socketIoInstances.push(instance);
    return instance.server;
  }),
}));

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
  WebSocketManager: jest.fn((_config: unknown, hooks: unknown) => {
    const instance = {
      broadcast: jest.fn(),
      sendToClient: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        activeConnections: 2,
        totalConnections: 5,
        rooms: 3,
        messagesSent: 10,
        messagesReceived: 9,
        errors: 1,
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
import { SocketIOWebSocketServer } from "./socketio-server";

const getLastFastifyInstance = (): FastifyStub => {
  if (fastifyInstances.length === 0) {
    throw new Error("Fastify instance not created");
  }
  return fastifyInstances[fastifyInstances.length - 1];
};

const getLastSocketIoInstance = (): SocketIOServerStub => {
  if (socketIoInstances.length === 0) {
    throw new Error("Socket.IO instance not created");
  }
  return socketIoInstances[socketIoInstances.length - 1];
};

const getLastManagerCapture = (): ManagerCapture => {
  if (managerCaptures.length === 0) {
    throw new Error("WebSocketManager instance not created");
  }
  return managerCaptures[managerCaptures.length - 1];
};

describe("SocketIOWebSocketServer", () => {
  beforeEach(() => {
    fastifyInstances.length = 0;
    socketIoInstances.length = 0;
    managerCaptures.length = 0;
    jest.clearAllMocks();
  });

  it("starts and stops cleanly while wiring attach/close", async () => {
    const server = new SocketIOWebSocketServer({ enableNamespaces: false });
    const fastify = getLastFastifyInstance();
    const socketServer = getLastSocketIoInstance();
    const { instance: manager } = getLastManagerCapture();

    await server.start();
    expect(fastify.listen).toHaveBeenCalled();
    expect(socketServer.server.attach).toHaveBeenCalledWith(fastify.server);

    await server.stop();
    expect(manager.destroy).toHaveBeenCalled();
    expect(socketServer.server.close).toHaveBeenCalled();
    expect(fastify.close).toHaveBeenCalled();
  });

  it("broadcasts globally and to specific rooms", () => {
    const server = new SocketIOWebSocketServer();
    const socketServer = getLastSocketIoInstance();

    const message = { id: "1", type: "event", payload: {}, timestamp: Date.now() };
    server.broadcast(message);
    expect(socketServer.server.emit).toHaveBeenCalledWith("event", message);

    const roomEmitter = { emit: jest.fn() };
    socketServer.server.to.mockReturnValueOnce(roomEmitter);
    server.broadcast(message, "room-42");
    expect(roomEmitter.emit).toHaveBeenCalledWith("event", message);
  });

  it("sends targeted messages through Socket.IO sockets", () => {
    const server = new SocketIOWebSocketServer();
    const socketServer = getLastSocketIoInstance();

    const socket = { emit: jest.fn(), join: jest.fn(), leave: jest.fn() };
    socketServer.server.sockets.sockets.set("client-1", socket);

    const message = { id: "1", type: "ping", payload: {}, timestamp: Date.now() };
    expect(server.sendToClient("client-1", message)).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith("ping", message);

    expect(server.sendToClient("missing", message)).toBe(false);
  });

  it("mirrors room membership updates to underlying sockets", () => {
    const server = new SocketIOWebSocketServer();
    const socketServer = getLastSocketIoInstance();
    const { instance: manager } = getLastManagerCapture();

    const socket = { emit: jest.fn(), join: jest.fn(), leave: jest.fn() };
    socketServer.server.sockets.sockets.set("client-99", socket);

    expect(server.addClientToRoom("client-99", "room-alpha")).toBe(true);
    expect(socket.join).toHaveBeenCalledWith("room-alpha");
    expect(manager.addClientToRoom).toHaveBeenCalledWith("client-99", "room-alpha");

    expect(server.removeClientFromRoom("client-99", "room-alpha")).toBe(true);
    expect(socket.leave).toHaveBeenCalledWith("room-alpha");
    expect(manager.removeClientFromRoom).toHaveBeenCalledWith("client-99", "room-alpha");
  });

  it("exposes HTTP endpoints for stats, namespaces, and rooms", async () => {
    new SocketIOWebSocketServer();
    const fastify = getLastFastifyInstance();
    const socketServer = getLastSocketIoInstance();

    // Seed namespace and rooms
    const chatNamespace = socketServer.server.of("/chat");
    const roomMembers = new Set<string>(["client-1"]);
    chatNamespace.adapter.rooms.set("general", roomMembers);

    const statsHandler = fastify.getHandlers.get("/api/stats");
    const namespacesHandler = fastify.getHandlers.get("/api/namespaces");
    const roomsHandler = fastify.getHandlers.get("/api/rooms");

    if (!statsHandler || !namespacesHandler || !roomsHandler) {
      throw new Error("Expected handlers to be registered");
    }

    const statsResponse = await statsHandler({}, {});
    expect(statsResponse).toEqual(
      expect.objectContaining({
        socketIO: expect.objectContaining({ transports: expect.any(Array) }),
      })
    );

    const namespacesResponse = await namespacesHandler({}, {});
    expect(namespacesResponse.total).toBeGreaterThanOrEqual(1);

    const roomsResponse = await roomsHandler({ query: { namespace: "/chat" } }, {});
    expect(roomsResponse).toEqual(
      expect.objectContaining({
        namespace: "/chat",
        rooms: [expect.objectContaining({ id: "general", clients: 1 })],
      })
    );
  });

  it("validates emit and room management HTTP actions", async () => {
    new SocketIOWebSocketServer();
    const fastify = getLastFastifyInstance();
    const socketServer = getLastSocketIoInstance();

    const emitHandler = fastify.postHandlers.get("/api/emit");
    const roomHandler = fastify.postHandlers.get("/api/room");

    if (!emitHandler || !roomHandler) {
      throw new Error("Expected POST handlers to be registered");
    }

    const reply = {
      code: jest.fn(function (this: { send: jest.Mock }) {
        return this;
      }),
      send: jest.fn(),
    };

    await emitHandler({ body: { data: {} } }, reply);
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Event name is required" });

    const namespace = socketServer.server.of("/chat");
    const roomEmitter = { emit: jest.fn() };
    namespace.to.mockReturnValueOnce(roomEmitter);

    const emitResponse = await emitHandler(
      { body: { event: "notify", data: { ok: true }, namespace: "/chat", room: "general" } },
      reply
    );
    expect(emitResponse).toEqual(
      expect.objectContaining({ success: true, namespace: "/chat", room: "general" })
    );
    expect(roomEmitter.emit).toHaveBeenCalledWith("notify", { ok: true });

    const roomReply = {
      code: jest.fn(function (this: { send: jest.Mock }) {
        return this;
      }),
      send: jest.fn(),
    };

    await roomHandler(
      { body: { clientId: "missing", room: "general", action: "join" } },
      roomReply
    );
    expect(roomReply.code).toHaveBeenCalledWith(404);
    expect(roomReply.send).toHaveBeenCalledWith({ error: "Client not found" });

    const socket = { id: "client-7", join: jest.fn(), leave: jest.fn() };
    namespace.sockets.set("client-7", socket);

    roomReply.code.mockClear();
    roomReply.send.mockClear();

    const joinResponse = await roomHandler(
      { body: { clientId: "client-7", room: "general", action: "join", namespace: "/chat" } },
      roomReply
    );
    expect(joinResponse).toEqual(
      expect.objectContaining({ success: true, action: "join", namespace: "/chat" })
    );
    expect(socket.join).toHaveBeenCalledWith("general");

    const leaveResponse = await roomHandler(
      { body: { clientId: "client-7", room: "general", action: "leave", namespace: "/chat" } },
      roomReply
    );
    expect(leaveResponse).toEqual(expect.objectContaining({ success: true, action: "leave" }));
    expect(socket.leave).toHaveBeenCalledWith("general");
  });
});
