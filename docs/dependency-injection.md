<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Dependency injection — Technical concept & lessons

**Project:** [dependency-injection](../src/api/dependency-injection/README.md)

## What it solves

Supplying dependencies (clients, repos, config) from the outside instead of constructing them inside a class. Enables testing with mocks and clear boundaries.

## Concepts

- **Singleton:** One instance for the app (e.g. config, logger, DB pool).
- **Scoped:** One instance per request (or per scope). Request-specific services.
- **Transient:** New instance per resolve. Stateless or short-lived services.
- **Container:** Registry that resolves dependencies; handles lifetimes and disposal.

## Lessons

1. **Depend on abstractions** — Code against interfaces (e.g. `UserRepository`), not concrete classes. Container injects the implementation.
2. **Request scope** — For per-request state (user context, transaction), use scoped services and ensure scope is created per request and disposed after.
3. **Circular dependencies** — Design to avoid A → B → A. If needed, use lazy resolution or break the cycle with an interface.
4. **Testing** — Swap real implementations for mocks in tests; no need to touch production code. DI makes this straightforward.

## Pros & cons

- **Pros:** Testability, explicit dependencies, swappable implementations, request-scoped services.
- **Cons:** Setup and conventions; can be overkill for tiny apps.

## When to use

- Medium or large services/APIs where you have multiple dependencies and want testability and clear boundaries.
- Skip or keep minimal for small scripts or single-file apps.

## See also

- Project README: [src/api/dependency-injection/README.md](../src/api/dependency-injection/README.md)
