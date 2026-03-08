# Contributing to Interview Patterns Sandbox

Thanks for your interest in contributing. This document explains how to get set
up, run checks, and submit changes.

## Prerequisites

- **Node.js** 18 or later
- **npm** (comes with Node)

## Getting started

```bash
git clone https://github.com/SkinnnyJay/interview-prep.git
cd interview-prep
npm run install:all   # same as npm install; dependencies are hoisted to root
npm run test:all
npm run build:all
```

## Development workflow

- **Run all tests:** `npm run test:all`
- **Test one project:** `npm run <project>:test` (e.g.
  `npm run rate-limiter:test`)
- **Watch mode (TDD):** `npm run <project>:test:watch`
- **Coverage:** `npm run <project>:test:coverage` or `npm run test:coverage:all`
- **Lint:** `npm run lint:all` or `npm run <project>:lint`
- **Format:** `npm run format` or `npm run format:check`
- **Build:** `npm run build:all` or `npm run <project>:build`

Project names: `api-scenarios`, `autocomplete`, `caching`,
`concurrency-parallel`, `dependency-injection`, `nextjs-backend`, `pagination`,
`rate-limiter`, `search-algorithms`, `security`, `validation`, `websocket`.

## Code standards

- **TypeScript:** Strict typing; no `any`. Explicit types for parameters and
  return values.
- **Style:** Two-space indent, double quotes, `const`/named exports. Follow
  existing patterns in the repo.
- **Tests:** Colocated `*.test.ts`; maintain high coverage. Fix one failing test
  at a time; avoid open handles (clean up timers/servers).
- **Docs:** Update a project’s README and/or `docs/` when changing behavior or
  adding a pattern.

See [.cursorrules](.cursorrules), [AGENTS.md](AGENTS.md), and
[CLAUDE.md](CLAUDE.md) for more detail.

## Submitting changes

1. **Fork** the repo and create a branch from `main`.
2. **Make your changes** and run:
   - `npm run lint:all`
   - `npm run test:all`
   - `npm run build:all`
3. **Commit** with clear, imperative messages (e.g.
   `rate-limiter: add optional Redis key prefix`).
4. **Open a Pull Request** with a short description of what changed and why. If
   it touches config (ports, Redis, env), note it in the PR.

## Skipped tests / technical debt

- **Caching** (`src/api/caching/src/cache.test.ts`): The "Performance and Edge
  Cases" describe block is skipped due to hanging/timeout issues. Re-enabling
  and fixing (e.g. shorter runs, better cleanup) is tracked via CONTRIBUTING or
  a [GitHub issue](https://github.com/SkinnnyJay/interview-prep/issues).

## Reporting issues

Use the
[GitHub issue tracker](https://github.com/SkinnnyJay/interview-prep/issues).
Include:

- What you did (steps or command)
- What you expected
- What actually happened (output or error)
- Node version and OS (if relevant)

## Publishing to npm (maintainers)

To publish a new version:

1. Bump version in `package.json` (or run `npm version patch|minor|major`).
2. Run `npm run test:all` and `npm run build:all`.
3. `npm publish` (use `npm publish --access public` if the package is scoped,
   e.g. `@username/interview-patterns-sandbox`).

Ensure no secrets or `.env` files are in the published bundle; `files` in
`package.json` and `.npmignore` control what is included.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
