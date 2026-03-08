jest.setTimeout(10000);

const prismaConnectMock = jest.fn().mockResolvedValue(undefined);
const prismaDisconnectMock = jest.fn().mockResolvedValue(undefined);

const PrismaClientMock = jest.fn().mockImplementation(() => ({
  $connect: prismaConnectMock,
  $disconnect: prismaDisconnectMock,
}));

jest.mock("@prisma/client", () => ({
  PrismaClient: PrismaClientMock,
}));

const loggerInfoMock = jest.fn();

jest.mock("@/utils/logger", () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: loggerInfoMock,
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe("dependency injection container", () => {
  beforeEach(() => {
    jest.resetModules();
    PrismaClientMock.mockClear();
    prismaConnectMock.mockClear();
    prismaDisconnectMock.mockClear();
    loggerInfoMock.mockClear();
  });

  it("binds prisma and logger services", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- dynamic require for jest.resetModules()
    const { createContainer, TYPES } = require("./container");

    const testContainer = createContainer();

    const prisma = testContainer.get(TYPES.PrismaClient);
    expect(prisma).toBeDefined();
    expect(PrismaClientMock).toHaveBeenCalled();

    const logger = testContainer.get(TYPES.Logger);
    expect(logger).toBeDefined();
  });

  it("initializes global container and logs success", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- dynamic require for jest.resetModules()
    const containerModule = require("./container");

    await containerModule.initializeContainer();

    expect(prismaConnectMock).toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalled();
  });

  it("cleans up prisma connection", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- dynamic require for jest.resetModules()
    const containerModule = require("./container");

    await containerModule.cleanupContainer();

    expect(prismaDisconnectMock).toHaveBeenCalled();
  });

  it("resolves service using helper", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- dynamic require for jest.resetModules()
    const { getService, TYPES } = require("./container");

    const logger = getService(TYPES.Logger);
    expect(logger).toBeDefined();
  });
});
