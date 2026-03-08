# Repository Guidelines

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

### Code Organization (DRY Principles)

- **Use DRY (Don't Repeat Yourself) principles**
- Extract common logic into shared utilities
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

### Scratchpad Usage

- Use `./scratchpad/<name>/*` for temporary notes and task planning
- Keep working context organized and separate from production code

## Project Structure & Module Organization

The repository groups each system under `src/api/<module>`. Each module has its
own `package.json`, `src/` implementation, and colocated tests. Shared mocks
live in `__mocks__/`; build artifacts go to root `dist/`. TypeScript and Jest
are configured at the repo root; module READMEs document architecture.
Pagination lives under `src/api/pagination/`.

## Build, Test, and Development Commands

Install dependencies once with `npm run install:all`. Generate production
bundles via `npm run build:all`. Run the entire test suite using
`npm run test:all`, which sequentially executes every module’s Jest suite. For
focused iteration, use commands like `npm run pagination:dev`,
`npm run rate-limiter:dev`, or `npm run websocket:dev` to boot Fastify services
with live reload. Clean artifacts through `npm run clean:all` or per-module
tools such as `npm run caching:clean`.

## Coding Style & Naming Conventions

All services are written in TypeScript targeting Node 18+. Use two-space
indentation, prefer `const` and named exports, and adopt double quotes for
strings as shown in existing files. Directories and scripts follow kebab-case
naming. Suffix interfaces and configuration shapes with `Props` or `Config`, and
place shared helpers under each module’s `src/lib` or `src/utils`. Run `tsc`
before submitting changes, and keep new scripts aligned with the
`npm run <module>:verb` pattern.

## Testing Guidelines

Jest powers unit and integration coverage across modules (`*.test.ts` within
each `src/`). Mirror filenames when authoring tests (`pagination.service.ts` →
`pagination.service.test.ts`) and colocate fixtures under `__mocks__` or
module-specific `test-data`. Use `npm run <module>:test:watch` for TDD loops,
`npm run <module>:test:coverage` to track thresholds, and maintain critical
suites above 90% statements.

### Test Coverage Requirements

- **Maintain 95%+ code coverage** for all modules
- Maintain critical suites above 90% statements (minimum)
- Include unit tests for core logic
- Include integration tests for API endpoints
- Extend performance or comparison tests when evolving caching or rate limiter
  strategies

### Test Workflow Best Practices

- **When more than one test fails during a test suite, break down the work to
  only fix one test at a time**
- **Look for open handles in tests and fix them** (prevent memory leaks and
  hanging tests)
- Use `npm run <module>:test:watch` for iterative development
- Run tests from root using namespaced commands or from project directories

## Commit and pull requests

Use concise, imperative commit messages and group by module (e.g.
`pagination: add redis sliding window`). Pull requests: summarize impact, list
test commands, include cURL or screenshots for new endpoints, and add a
checklist for config (ports, Redis).

## Security and configuration

- No secrets in repo; use `.env.local` (not committed).
- Redis: mock by default; set `REDIS_URL` for real Redis.
- Rate limiters: use `x-api-key` (or equivalent) for client keys; do not log
  tokens.
