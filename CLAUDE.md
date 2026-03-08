# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Overview

This is a monorepo containing production-ready implementations of common API
patterns and systems for learning and experimentation. Each system is a
self-contained project within `src/api/` with its own package.json, tests, and
documentation.

## Code Quality Standards

### Strong Typing

- **Strongly typed code**: Prefer `typed` over `any`
- Use explicit types for all function parameters and return values
- Avoid implicit `any` types
- Use TypeScript strict mode features

### Type Definitions

- **Prefer interfaces and types over inline dynamic class**
- Suffix interfaces and configuration shapes with `Props` or `Config`
- Define clear interfaces for all public APIs
- Use type aliases for complex type compositions
- Place shared types under each module's `src/lib` or `src/utils`

### Code Organization (DRY Principles)

- **Use DRY (Don't Repeat Yourself) principles**
- Extract common logic into shared utilities
- Place shared helpers under each module's `src/lib` or `src/utils`
- Avoid code duplication across modules
- Create reusable abstractions for repeated patterns

### Simplicity (KISS Principles)

- **Use KISS (Keep It Simple, Stupid) principles**
- Favor simple, readable solutions over clever ones
- Avoid over-engineering
- Keep functions small and focused
- Write self-documenting code

### Intentional Changes

- **Changes should be intentional and testable**
- Every change must have a clear purpose
- Write tests before or alongside implementation
- Ensure all changes can be validated through tests
- Run `tsc` before submitting changes

### Scratchpad Usage

- Use `./scratchpad/<name>/*` for temporary notes and task planning
- Keep working context organized and separate from production code

## Project Structure

The repository uses a hierarchical command structure where commands can be run
from either:

- **Root level**: Using namespaced commands (e.g., `npm run pagination:dev`)
- **Project level**: By cd'ing into the project directory and running local
  commands

Each project in `src/api/` is independent with:

- Its own `package.json` with local scripts
- A dedicated README.md with implementation details
- Source code in `src/` subdirectory
- Test files colocated with source code
- Build output to root-level `dist/` directory

## Common Commands

### Root Level (Monorepo)

```bash
# Installation
npm run install:all          # Install all dependencies

# Testing
npm run test:all             # Run all tests across all projects
npm run <project>:test       # Test a specific project (e.g., npm run pagination:test)
npm run <project>:test:watch # Watch mode for specific project
npm run <project>:test:coverage # Coverage for specific project

# Building
npm run build:all            # Build all projects
npm run <project>:build      # Build specific project

# Development
npm run <project>:dev        # Start dev server for specific project

# Production
npm run <project>:start      # Start production server for specific project

# Cleanup
npm run clean:all            # Remove all build artifacts and caches
npm run clean:build:all      # Clean and rebuild everything
```

### Available Projects

Projects follow the naming pattern `<project-name>:<command>`:

- `api-scenarios` - API scenario examples
- `autocomplete` - Autocomplete system
- `caching` - Cache implementations (LRU, LFU, TTL)
- `concurrency-parallel` - Concurrency patterns
- `dependency-injection` - DI container and patterns
- `nextjs-backend` - Next.js backend example
- `pagination` - Pagination strategies (page-based, offset-based)
- `rate-limiter` - Rate limiting algorithms (token bucket, sliding window, fixed
  window)
- `search-algorithms` - Search implementations
- `security` - Authentication and RBAC
- `validation` - Input validation patterns
- `websocket` - WebSocket implementations

### Redis-dependent Projects

Some projects (caching, rate-limiter) support Redis. Use these commands to
manage Redis:

```bash
npm run <project>:redis:start   # Start Redis in Docker
npm run <project>:redis:stop    # Stop and remove Redis container
```

## TypeScript Configuration

- Root `tsconfig.json` configures shared compiler options
- Outputs to `./dist` with `rootDir: ./src`
- Uses CommonJS modules for Node.js compatibility
- Jest uses ts-jest transformer for testing TypeScript files
- Some projects excluded from compilation (e.g., websocket) - check
  tsconfig.json

## Testing

- Tests are colocated with source code: `src/**/*.test.ts`
- Jest configuration at root level in `jest.config.js`
- Mock for `uuid` package at `__mocks__/uuid.js` to avoid ESM issues
- Optimized for low disk space (maxWorkers: 1, cache: false)
- Run tests from root using namespaced commands or from project directories

### Test Coverage Requirements

- **Maintain 95%+ code coverage** for all modules
- Unit tests for core logic
- Integration tests for API endpoints
- Performance tests for critical paths (some projects)
- Comparison tests for algorithm implementations (rate-limiter)

### Test Workflow Best Practices

- **When more than one test fails during a test suite, break down the work to
  only fix one test at a time**
- **Look for open handles in tests and fix them** (prevent memory leaks and
  hanging tests)
- Use `npm run <module>:test:watch` for TDD loops
- Run tests from root using namespaced commands or from project directories

## Architecture Patterns

### Monorepo with Independent Projects

Each API project is self-contained but shares:

- Root-level TypeScript configuration
- Root-level Jest configuration
- Common dependencies in root package.json
- Centralized build output in `dist/`

### Fastify-based APIs

Most projects use Fastify for HTTP servers:

- Server files typically in `src/server.ts`
- Development with `tsx` for TypeScript execution
- Production runs compiled JavaScript from `dist/`
- Ports vary by project (documented in individual READMEs)

### Storage backends

- In-memory for dev/test; Redis (ioredis) for production; mocks (e.g.
  ioredis-mock) when Docker is not used.

## Development workflow

1. **Starting a project**: Use `npm run <project>:dev` from root
2. **Running tests**: Use `npm run <project>:test` (with :watch for TDD)
3. **Building**: Run `npm run build:all` or specific project build
4. **Checking multiple projects**: Tests can be run in sequence with
   `npm run test:all`

## Important notes

- Pagination lives under `src/api/pagination/`. Build output is at root `dist/`;
  each project’s `main` points to `../../../dist/api/<project>/...`.
- Not every project has every script; check each `package.json` (e.g.
  `autocomplete:setup:frontend`).
