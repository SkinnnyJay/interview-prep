<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Validation — Technical concept & lessons

**Project:** [validation](../src/api/validation/README.md)

## What it solves

Ensuring request (and optionally response) data conforms to schemas and business rules before use, with clear errors and type safety.

## Concepts

- **Schema validation:** Declarative rules (e.g. Zod) for shape, types, and constraints. One place for “what is valid.”
- **Pipelines:** Multiple steps: schema → business rules → DB checks. Reusable and testable.
- **Batch validation:** Validate arrays; collect all errors or stop at first failure. Good for bulk imports.

## Lessons

1. **Validate at the boundary** — Validate all external input (body, query, params, headers). Never trust client data.
2. **Schema as contract** — Zod (or similar) gives TypeScript types and runtime checks. Use for API docs and client codegen.
3. **Structured errors** — Return field-level errors (field, code, message) so clients can highlight form fields.
4. **Pipelines for complexity** — When validation depends on DB or external services, use a pipeline so order and dependencies are explicit.

## Pros & cons

- **Pros:** Type-safe schemas, runtime safety, clear errors, reusable pipelines.
- **Cons:** Schema maintenance; strictness may require versioning or migration strategy.

## When to use

- **All public inputs:** Request bodies and critical query/params.
- **Pipelines:** Multi-step or business-rule validation (e.g. “email not already taken”).
- **Batch:** Bulk create/update; report all errors before applying changes.

## See also

- Project README: [src/api/validation/README.md](../src/api/validation/README.md)
- Security project for auth + validation together.
