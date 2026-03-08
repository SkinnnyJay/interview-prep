import type winston from "winston";

jest.setTimeout(10000);

const infoMock = jest.fn();
const errorMock = jest.fn();
const warnMock = jest.fn();
const debugMock = jest.fn();

jest.mock("winston", () => {
  const timestamp = jest.fn();
  const errors = jest.fn();
  const json = jest.fn();
  const colorize = jest.fn();
  const simple = jest.fn();
  const combine = jest.fn((...args) => args.length);

  return {
    createLogger: jest.fn(() => ({
      info: infoMock,
      error: errorMock,
      warn: warnMock,
      debug: debugMock,
    })),
    format: {
      timestamp,
      errors,
      json,
      colorize,
      simple,
      combine,
    },
    transports: {
      Console: jest.fn(),
    },
  } as unknown as typeof winston;
});

describe("Logger", () => {
  let Logger: typeof import("./logger").Logger;

  beforeEach(() => {
    jest.resetModules();
    infoMock.mockClear();
    errorMock.mockClear();
    warnMock.mockClear();
    debugMock.mockClear();
    ({ Logger } = require("./logger"));
  });

  it("delegates to winston logger", () => {
    const logger = new Logger();

    logger.info("info", { foo: "bar" });
    logger.error("error", { foo: "bar" });
    logger.warn("warn", { foo: "bar" });
    logger.debug("debug", { foo: "bar" });

    expect(infoMock).toHaveBeenCalledWith("info", { foo: "bar" });
    expect(errorMock).toHaveBeenCalledWith("error", { foo: "bar" });
    expect(warnMock).toHaveBeenCalledWith("warn", { foo: "bar" });
    expect(debugMock).toHaveBeenCalledWith("debug", { foo: "bar" });
  });
});
