import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

const flushAsync = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const createServerMock = (
  label: string
): {
  label: string;
  mockCtor: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
} => {
  const start = jest.fn().mockResolvedValue(undefined);
  const stop = jest.fn().mockResolvedValue(undefined);
  const mockCtor = jest.fn().mockImplementation((_config: unknown, _hooks: unknown) => ({
    start,
    stop,
    broadcast: jest.fn(),
    sendToClient: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      activeConnections: 0,
      totalConnections: 0,
      rooms: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
    }),
  }));

  return { label, mockCtor, start, stop };
};

describe("websocket backend orchestrator", () => {
  const originalEnv = { ...process.env };
  let processOnSpy: jest.SpiedFunction<typeof process.on>;
  let processExitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    processOnSpy = jest
      .spyOn(process, "on")
      .mockImplementation((_event: string, _handler: () => void) => {
        return process;
      });
    processExitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as (code?: number) => never);
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("starts the basic server variant by default", async () => {
    const basic = createServerMock("basic");
    const advanced = createServerMock("advanced");
    const socketio = createServerMock("socketio");

    process.env.WS_SERVER_TYPE = "basic";
    process.env.PORT_OFFSET = "5";

    jest.doMock("./basic-websocket-server", () => ({ BasicWebSocketServer: basic.mockCtor }));
    jest.doMock("./advanced-websocket-server", () => ({
      AdvancedWebSocketServer: advanced.mockCtor,
    }));
    jest.doMock("./socketio-server", () => ({ SocketIOWebSocketServer: socketio.mockCtor }));

    await import("./server");
    await flushAsync();

    expect(basic.mockCtor).toHaveBeenCalledWith(
      expect.objectContaining({ port: 3006, host: "0.0.0.0" }),
      expect.any(Object)
    );
    expect(basic.start).toHaveBeenCalled();
    expect(advanced.mockCtor).not.toHaveBeenCalled();
    expect(socketio.mockCtor).not.toHaveBeenCalled();

    expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("instantiates the advanced server with enhanced configuration", async () => {
    const basic = createServerMock("basic");
    const advanced = createServerMock("advanced");
    const socketio = createServerMock("socketio");

    process.env.WS_SERVER_TYPE = "advanced";
    process.env.PORT_OFFSET = "1";

    jest.doMock("./basic-websocket-server", () => ({ BasicWebSocketServer: basic.mockCtor }));
    jest.doMock("./advanced-websocket-server", () => ({
      AdvancedWebSocketServer: advanced.mockCtor,
    }));
    jest.doMock("./socketio-server", () => ({ SocketIOWebSocketServer: socketio.mockCtor }));

    await import("./server");
    await flushAsync();

    expect(advanced.mockCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3003,
        enableRateLimit: true,
        enableMessageHistory: true,
        enablePresence: true,
      }),
      expect.any(Object)
    );
    expect(advanced.start).toHaveBeenCalled();
    expect(basic.mockCtor).not.toHaveBeenCalled();
    expect(socketio.mockCtor).not.toHaveBeenCalled();
  });

  it("instantiates the socket.io server option", async () => {
    const basic = createServerMock("basic");
    const advanced = createServerMock("advanced");
    const socketio = createServerMock("socketio");

    process.env.WS_SERVER_TYPE = "socketio";
    process.env.PORT_OFFSET = "2";

    jest.doMock("./basic-websocket-server", () => ({ BasicWebSocketServer: basic.mockCtor }));
    jest.doMock("./advanced-websocket-server", () => ({
      AdvancedWebSocketServer: advanced.mockCtor,
    }));
    jest.doMock("./socketio-server", () => ({ SocketIOWebSocketServer: socketio.mockCtor }));

    await import("./server");
    await flushAsync();

    expect(socketio.mockCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3005,
        enableNamespaces: true,
        transports: ["websocket", "polling"],
      }),
      expect.any(Object)
    );
    expect(socketio.start).toHaveBeenCalled();
    expect(basic.mockCtor).not.toHaveBeenCalled();
    expect(advanced.mockCtor).not.toHaveBeenCalled();
  });

  it("exits with code 1 when server type is unknown", async () => {
    const basic = createServerMock("basic");
    const advanced = createServerMock("advanced");
    const socketio = createServerMock("socketio");

    process.env.WS_SERVER_TYPE = "mystery";

    jest.doMock("./basic-websocket-server", () => ({ BasicWebSocketServer: basic.mockCtor }));
    jest.doMock("./advanced-websocket-server", () => ({
      AdvancedWebSocketServer: advanced.mockCtor,
    }));
    jest.doMock("./socketio-server", () => ({ SocketIOWebSocketServer: socketio.mockCtor }));

    await import("./server");
    await flushAsync();

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(basic.mockCtor).not.toHaveBeenCalled();
    expect(advanced.mockCtor).not.toHaveBeenCalled();
    expect(socketio.mockCtor).not.toHaveBeenCalled();
  });
});
