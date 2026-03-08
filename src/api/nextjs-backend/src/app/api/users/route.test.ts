import { webcrypto as nodeCrypto } from "crypto";
import type { NextRequest } from "next/server";

jest.setTimeout(10000);

if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto as unknown as Crypto;
}

type RouteModule = typeof import("./route");

const withFreshModule = async (callback: (module: RouteModule) => Promise<void>): Promise<void> => {
  await jest.isolateModulesAsync(async () => {
    const module = await import("./route");
    await callback(module);
  });
};

const createRequest = (payload: unknown): Request =>
  ({
    json: async () => payload,
  }) as unknown as Request;

describe("/api/users route handlers", () => {
  it("returns an empty user list by default", async () => {
    await withFreshModule(async ({ GET }) => {
      const response = await GET();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  it("creates a new user with valid payload", async () => {
    await withFreshModule(async ({ POST, GET }) => {
      const request = createRequest({ email: "user@example.com", name: "Test User" });

      const createResponse = await POST(request as NextRequest);
      expect(createResponse.status).toBe(201);

      const createBody = await createResponse.json();
      expect(createBody.success).toBe(true);
      expect(createBody.data.email).toBe("user@example.com");
      expect(createBody.data.name).toBe("Test User");
      expect(typeof createBody.data.id).toBe("string");

      const listResponse = await GET();
      const listBody = await listResponse.json();
      expect(listBody.total).toBe(1);
      expect(listBody.data[0].email).toBe("user@example.com");
    });
  });

  it("returns validation errors for invalid payloads", async () => {
    await withFreshModule(async ({ POST }) => {
      const response = await POST(createRequest({ email: "invalid", name: "" }) as NextRequest);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Validation error");
      expect(Array.isArray(body.details)).toBe(true);
    });
  });
});
