/**
 * Integration test: connect → send → disconnect against the real WebSocket server.
 * Ensures the full client flow works with no mocks (basic WS and Socket.IO).
 */

import { BasicWebSocketServer } from "./basic-websocket-server";
import { SocketIOWebSocketServer } from "./socketio-server";
import WebSocket from "ws";
import { io, Socket } from "socket.io-client";
import type { WebSocketConfig } from "./types";
import { MessageType } from "./constants";

const host = "127.0.0.1";

function wsUrl(port: number): string {
  return `ws://${host}:${port}/ws`;
}

function once<T>(emitter: { on(e: string, fn: (arg: T) => void): void }, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 5000);
    emitter.on(event, (arg: T) => {
      clearTimeout(timer);
      resolve(arg);
    });
  });
}

describe("WebSocket integration: connect → send → disconnect", () => {
  describe("Basic WebSocket server", () => {
    let server: BasicWebSocketServer;
    let ws: WebSocket;

    beforeEach(async () => {
      server = new BasicWebSocketServer({
        port: 0,
        host,
        pingInterval: 5000,
        pingTimeout: 10000,
      } as Partial<WebSocketConfig> as WebSocketConfig);
      await server.start();
    });

    afterEach(async () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
        await once(ws, "close").catch(() => {});
      }
      if (server) {
        await server.stop();
      }
    });

    it("connects, receives welcome, joins room, receives room_joined, disconnects", async () => {
      const port = server.getPort();
      ws = new WebSocket(wsUrl(port));

      // Receive server welcome (same pattern as basic-websocket-server.test.ts)
      const welcomeData = await new Promise<unknown>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Timeout waiting for welcome")), 5000);
        ws.on("message", (data: Buffer) => {
          clearTimeout(t);
          resolve(JSON.parse(data.toString()));
        });
        ws.on("error", (err) => {
          clearTimeout(t);
          reject(err);
        });
      });
      expect((welcomeData as { type?: string }).type).toBe("connect");
      expect((welcomeData as { payload?: { clientId?: string } }).payload?.clientId).toBeDefined();

      // Join room (built-in; no demo hooks required)
      const roomName = "integration-test-room";
      ws.send(
        JSON.stringify({
          id: "join-1",
          type: MessageType.JOIN_ROOM,
          payload: { room: roomName },
          timestamp: Date.now(),
        })
      );

      const roomJoined = await once(ws, "message").then((data) =>
        JSON.parse((data as Buffer).toString())
      );
      expect(roomJoined.type).toBe(MessageType.ROOM_JOINED);
      expect(roomJoined.payload?.room).toBe(roomName);
      expect(typeof roomJoined.payload?.clientCount).toBe("number");

      ws.close();
      await once(ws, "close");
    });
  });

  describe("Socket.IO server", () => {
    let server: SocketIOWebSocketServer;
    let socket: Socket;

    beforeEach(async () => {
      server = new SocketIOWebSocketServer({
        port: 0,
        host,
        transports: ["websocket", "polling"],
      });
      await server.start();
      expect(server.getPort()).toBeGreaterThan(0);
    });

    afterEach(async () => {
      if (socket?.connected) {
        socket.disconnect();
        socket.removeAllListeners();
      }
      if (server) {
        await server.stop();
      }
    });

    it("connects, joins room, receives room_joined, disconnects", async () => {
      const port = server.getPort();
      socket = io(`http://${host}:${port}`, {
        transports: ["websocket"],
        autoConnect: true,
      });

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Connect timeout")), 5000);
        socket.on("connect", () => {
          clearTimeout(t);
          resolve();
        });
        socket.on("connect_error", (err) => {
          clearTimeout(t);
          reject(err);
        });
      });

      const roomName = "integration-test-room";
      const roomJoined = await new Promise<unknown>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("room_joined timeout")), 3000);
        const cleanup = (): void => {
          clearTimeout(t);
          socket.off(MessageType.ROOM_JOINED, onRoomJoined);
          socket.off("disconnect", onDisconnect);
          socket.off("error", onError);
        };
        const onRoomJoined = (data: unknown): void => {
          cleanup();
          resolve(data);
        };
        const onDisconnect = (): void => {
          cleanup();
          reject(new Error("Socket disconnected before room_joined"));
        };
        const onError = (err: Error): void => {
          cleanup();
          reject(err);
        };
        socket.once(MessageType.ROOM_JOINED, onRoomJoined);
        socket.once("disconnect", onDisconnect);
        socket.once("error", onError);
        socket.emit(MessageType.JOIN_ROOM, { payload: { room: roomName } });
      });
      expect(roomJoined).toBeDefined();
      expect((roomJoined as { room?: string }).room).toBe(roomName);

      socket.disconnect();
      await new Promise<void>((resolve) => {
        if (!socket.connected) return resolve();
        socket.once("disconnect", () => resolve());
      });
    });
  });
});
