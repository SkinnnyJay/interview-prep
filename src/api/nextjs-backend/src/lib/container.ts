/**
 * Minimal Dependency Injection Container
 *
 * This is a simplified version for the Next.js backend example.
 * In a production app, you would expand this with actual services and repositories.
 */

import "reflect-metadata";
import { Container } from "inversify";
import { PrismaClient } from "@prisma/client";
import { Logger } from "@/utils/logger";

/**
 * Dependency Injection Symbols
 */
export const TYPES = {
  PrismaClient: Symbol.for("PrismaClient"),
  Logger: Symbol.for("Logger"),
} as const;

/**
 * Create and configure the IoC container
 */
export function createContainer(): Container {
  const container = new Container();

  // Database Configuration
  container
    .bind<PrismaClient>(TYPES.PrismaClient)
    .toDynamicValue(() => {
      return new PrismaClient({
        log:
          process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"],
        errorFormat: "pretty",
      });
    })
    .inSingletonScope();

  // Logger Service
  container.bind<Logger>(TYPES.Logger).to(Logger).inSingletonScope();

  return container;
}

/**
 * Global container instance
 */
export const container = createContainer();

/**
 * Helper functions for easier dependency resolution
 */
export const getService = <T>(serviceIdentifier: symbol): T => {
  return container.get<T>(serviceIdentifier);
};

/**
 * Async container initialization
 */
export async function initializeContainer(): Promise<void> {
  try {
    const prisma = container.get<PrismaClient>(TYPES.PrismaClient);
    await prisma.$connect();

    const logger = container.get<Logger>(TYPES.Logger);
    logger.info("Dependency injection container initialized successfully");
  } catch (error) {
    console.error("Failed to initialize container:", error);
    throw error;
  }
}

/**
 * Container cleanup
 */
export async function cleanupContainer(): Promise<void> {
  try {
    const prisma = container.get<PrismaClient>(TYPES.PrismaClient);
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error during container cleanup:", error);
  }
}
