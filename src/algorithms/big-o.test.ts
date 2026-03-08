import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
  BigO,
  constant,
  logarithmic,
  linear,
  linearithmic,
  quadratic,
  exponential,
  benchmark,
  type BenchmarkResult,
} from "./big-o";

beforeEach(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("BigO complexity functions", () => {
  describe("constant O(1)", () => {
    it("returns 1 for n > 0", () => {
      expect(constant(1)).toBe(1);
      expect(constant(1000)).toBe(1);
    });
    it("returns 0 for n <= 0", () => {
      expect(constant(0)).toBe(0);
      expect(constant(-1)).toBe(0);
    });
  });

  describe("logarithmic O(log n)", () => {
    it("returns floor(log2(n)) steps for n >= 1", () => {
      expect(logarithmic(1)).toBe(0);
      expect(logarithmic(2)).toBe(1);
      expect(logarithmic(4)).toBe(2);
      expect(logarithmic(8)).toBe(3);
      expect(logarithmic(1024)).toBe(10);
    });
  });

  describe("linear O(n)", () => {
    it("returns n for non-negative n", () => {
      expect(linear(0)).toBe(0);
      expect(linear(10)).toBe(10);
      expect(linear(100)).toBe(100);
    });
  });

  describe("linearithmic O(n log n)", () => {
    it("returns positive value scaling with n", () => {
      const a = linearithmic(10);
      const b = linearithmic(100);
      expect(a).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(a);
    });
  });

  describe("quadratic O(n²)", () => {
    it("returns n²", () => {
      expect(quadratic(0)).toBe(0);
      expect(quadratic(10)).toBe(100);
      expect(quadratic(100)).toBe(10_000);
    });
  });

  describe("exponential O(2^n)", () => {
    it("returns 2^n for small n", () => {
      expect(exponential(0)).toBe(1);
      expect(exponential(1)).toBe(2);
      expect(exponential(5)).toBe(32);
    });
  });

  describe("BigO namespace", () => {
    it("exposes all functions", () => {
      expect(BigO.constant(1)).toBe(1);
      expect(BigO.logarithmic(8)).toBe(3);
      expect(BigO.linear(5)).toBe(5);
      expect(BigO.linearithmic(4)).toBeGreaterThan(0);
      expect(BigO.quadratic(3)).toBe(9);
      expect(BigO.exponential(3)).toBe(8);
    });
  });
});

describe("benchmark", () => {
  it("returns results for each (name, n) and logs to console", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const sizes = [100, 1000];
    const results = benchmark(sizes);

    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Big-O benchmark");
    expect(output).toContain("O(1)");
    expect(output).toContain("O(n)");
    expect(output).toContain("O(n²)");
    expect(output).toContain("O(2^n)");

    const byName = (name: string): BenchmarkResult[] => results.filter((r) => r.name === name);
    expect(byName("constant").length).toBe(sizes.length);
    expect(byName("linear").length).toBe(sizes.length);
    expect(byName("exponential").length).toBe(4); // EXP_SIZES length

    results.forEach((r: BenchmarkResult) => {
      expect(r.name).toBeDefined();
      expect(r.complexity).toBeDefined();
      expect(r.n).toBeGreaterThanOrEqual(0);
      expect(r.ms).toBeGreaterThanOrEqual(0);
      expect(typeof r.result).toBe("number");
    });

    logSpy.mockRestore();
  });

  it("uses custom sizes when provided", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const customSizes = [50, 200];
    const results = benchmark(customSizes);

    const linearResults = results.filter((r) => r.name === "linear");
    expect(linearResults.map((r) => r.n)).toEqual(customSizes);
    logSpy.mockRestore();
  });
});
