import { GET } from "./route";

jest.setTimeout(10000);

describe("GET /api/health", () => {
  it("returns healthy status payload", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.uptime).toBe("number");
    expect(body.version).toBe("1.0.0");
  });
});
