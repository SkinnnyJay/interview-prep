# TypeScript Advanced Types — Full Review of `src/`

Review of `src/` against the TypeScript advanced types skill: generics, conditional types, mapped types, template literals, utility types, type guards, and type safety. This is the full list of findings and recommendations.

---

## 1. Summary

| Category | Status | Notes |
|----------|--------|--------|
| **Generics** | Good | Used in APIs, services, pagination, validation, DI, caching |
| **Utility types** | Good | `Omit`, `Partial`, `Pick`, `Record`, `keyof` in many modules |
| **Mapped / custom utility types** | Partial | `DeepPartial` in api-scenarios; no `DeepReadonly`; `DeepPartial` doesn’t exclude `Function` |
| **Discriminated unions** | Good | Auth (security), pagination, validation, autocomplete `DataSource` |
| **Type guards** | Partial | A few present; more could replace `as` casts |
| **Conditional types / infer** | Minimal | Only in validation-schemas (`Parameters<>`); no custom conditional helpers |
| **Template literal types** | None | No `on${Capitalize<Event>}`-style or path-building types |
| **Explicit `any`** | Minimal | One intentional `any` in `SocketStream` (eslint-disabled) |
| **`unknown` vs `any`** | Good | `unknown` used for payloads, details, and unvalidated data |

---

## 2. By Module — What’s in Place

### 2.1 `src/api/api-scenarios/`

**Types (`types/common.ts`, `types/entities.ts`)**

- **Generics:** `ApiResponse<T>`, `PaginatedResponse<T>`, `BulkOperation<T>`, `BulkResult<T>`, `StreamMessage<T>`, `CommandResult<T>`, `QueryResult<T>`.
- **Utility types:** `CreateEntityInput<T> = Omit<T, BaseEntitySystemFields>`, `DeepPartial<T>` (mapped type).
- **DeepPartial:** Defined as `{ [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }`. Does not exclude `Function` (per skill pattern, should avoid making functions optional/deep-partial).
- **Single explicit `any`:** `SocketStream.socket.on(event, listener: (...args: any[]) => void)` — documented and eslint-disabled for Fastify WebSocket event args.
- **Index signatures / Record:** `FilterQuery`, `[key: string]: unknown` in several entities; appropriate for flexible payloads.

**Constants (`constants.ts`)**

- **`keyof` pattern:** `(typeof X)[keyof typeof X]` for `CrudErrorCodeType`, `AuditActionType`, `UserRoleType`, `UserStatusType`, `UserThemeType`, `UserErrorCodeType`, `HealthStatusType`, `HealthDependencyStatus` — good use of const objects and derived types.

**Controllers / services**

- **Partial / Omit:** `Partial<User>`, `Partial<UserProfile>`, `Omit<User, "id" | "createdAt" | "updatedAt">` in user-controller and repositories.
- **Type guard:** `isUserRole(value: string): value is UserRoleType` in user-controller; `isHttpMethod(value: string): value is HttpMethod` in server.
- **Record:** `Record<string, RouteConfig>` in server route registration.

**Middleware (`request-context.ts`)**

- **Type guard:** `isRecord(value: unknown): value is Record<string, unknown>`.
- **Casts:** Some `obj as Record<string, unknown>`; could be narrowed via guards where possible.

**Streaming service**

- **Typing of message payloads:** Uses `Record<string, unknown> & { type?, data?, ... }` and repeated `as Record<string, unknown> & { ... }` for different message types. Good candidate for discriminated union or generic handler map by `type`.

---

### 2.2 `src/api/caching/`

**Types (`cache-types.ts`)**

- **Generics:** `CacheResult<T>`, `CacheEntry<T>`.
- **Interfaces:** Clear `CacheRedisClient`, `CacheConfig`, `MultiLevelCacheConfig`; no `any`.

**Cache manager**

- **Generics:** `get<T>`, `set<T>` with `Partial<CacheOptions>`; consistent use of `CacheResult<T>`.

---

### 2.3 `src/api/dependency-injection/`

**Types (`di-types.ts`)**

- **Generics:** `ServiceRegistration<T>`, `ServiceFactory<T>`, `resolve<T>`, `Repository<T, ID>`, `DIRouteHandler<TDependencies>`.
- **Standard interfaces:** `ServiceContainer`, `ScopedContainer`, `ServiceResolutionResult<T>`; well-typed.

**Implementation**

- **Registration storage:** `registration as ServiceRegistration<unknown>` for map storage; `resolve<T>` preserves type — correct pattern.
- **Record:** `Record<string, unknown>` for resolved deps and config; appropriate.

---

### 2.4 `src/api/security/`

**Types (`auth-types.ts`)**

- **Discriminated union:** `AuthResult = AuthSuccess | AuthFailure` with `success: true | false` — good for type-safe auth handling.
- **Utility types:** `Omit<JWTPayload, "iat" | "exp">`, `Omit<ApiKey, "keyHash">`, `Omit<BearerToken, "refreshToken">` in auth-methods.

**RBAC**

- Typed roles/permissions; no advanced types required for current design.

---

### 2.5 `src/api/pagination/`

**Types (`pagination-types.ts`)**

- **Discriminated unions:** `PaginationRequest = PageBasedRequest | OffsetBasedRequest`, `PaginationResult<T> = PageBasedResult<T> | OffsetBasedResult<T>` with `type: PaginationType.PAGE_BASED | OFFSET_BASED`.
- **Generics:** `BasePaginationResult<T>`, `PageBasedResult<T>`, `OffsetBasedResult<T>` with default `DataItem`.

---

### 2.6 `src/api/validation/`

**Types (`validation-types.ts`)**

- **Discriminated union:** `ValidationOutcome<T> = ValidationResult<T> | ValidationFailure` with `success: true | false`.
- **Generics:** `ValidationResult<T>`, `CustomValidator<T>`, `ValidationStep<T>`, `ValidationPipeline<T>`.
- **Zod:** `SchemaRegistry` as `Record<string, z.ZodSchema<unknown>>`; `CommonValidations` and `FieldLimits` as `const` — good.

**Validation engine**

- **Generics:** `validate<T>(schema, data, ...)` returning `ValidationOutcome<T>`.
- **Casts:** `schema.strip() as unknown as z.ZodSchema<T>` (Zod API limitation); `Object.keys(originalData as Record<string, unknown>)` — could use a small type guard for “record-like” objects.

**Validation schemas**

- **Advanced generics:** `pick`/`omit` with `<T extends z.ZodRawShape, K extends keyof T>` and `Parameters<z.ZodObject<T>["pick"]>[0]` for Zod — good use of utility types and inference.

---

### 2.7 `src/api/rate-limiter/`

- **Exhaustive switch:** `default: const _exhaustive: never = type` in `checkRateLimitByType` — excellent use of discriminated union exhaustiveness.

---

### 2.8 `src/api/websocket/`

**Backend types (`backend/types.ts`)**

- **Type guards:** `isRoomPayload`, `isPayloadObject(payload): payload is Record<string, unknown>`.
- **Union:** `Socket = WSWebSocket | SocketIOSocket`.
- **Index signatures:** `ClientMetadata`, `RoomMetadata` with `[key: string]: unknown`.

**Frontend (`frontend/src/types.ts`, `hooks/useWebSocket.ts`)**

- **Message type:** `WebSocketMessage` with `type: string`, `payload: unknown` — not discriminated by literal `type`; handlers use `message.payload as { clientId?, error? }`.
- **Omit:** `Omit<WebSocketMessage, "id" | "timestamp">` for `sendMessage` — correct.
- **Improvement:** If message kinds are fixed, a discriminated union by `type` (e.g. `type: "connect" | "error" | "chat" | ...`) would give stronger typing in `handleMessage` and avoid repeated `as` casts.

---

### 2.9 `src/api/autocomplete/`

**Types**

- **Discriminated union:** `DataSource` with `type: "static" | "file" | "api" | "database"` and corresponding `config` shapes — good.
- **Generics:** Used in search result types; `ApiDataSourceConfig.transform?: (raw: unknown) => AutocompleteItem` — appropriate use of `unknown`.

---

### 2.10 `src/api/search-algorithms/`

**Types (`types.ts`)**

- **Generics:** `SearchResult<T>`, `SearchResponse<T>` with default `SearchableItem`.
- **Record:** `Record<SearchAlgorithm, number>` for `algorithmUsage`; `Record<string, number>` for term scores and field boosts.
- **Literal union:** `SearchAlgorithm` as string union; well-defined.

**Engine**

- **Typed maps:** `algorithmUsage = {} as Record<SearchAlgorithm, number>` for initialization; return types use `Record<string, string>` for highlighted fields.

---

### 2.11 `src/api/concurrency-parallel/`

**Types (`concurrency-types.ts`)**

- **Generics:** `TaskResult<T>`, `TaskProcessor<T, R>`, `BatchProcessor<T, R>`, `QueuedTask<T, R>`.
- **Implementation:** Uses `Record<string, unknown>` for task data where structure is dynamic; reasonable.

---

### 2.12 `src/api/nextjs-backend/`

**Types (`types/index.ts`)**

- **Generics:** `ApiResponse<T>`, `PaginatedResponse<T>` extending `ApiResponse<T[]>`.
- **Classes:** `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError` with proper inheritance — standard OOP typing.

---

### 2.13 `src/algorithms/`

**Sorting (`sorting-algorithms.ts`)**

- **Generics and overloads:** `CompareFn<T>`, `InPlaceSortFn<T>`, `sortCopy<T>`, and public overloads e.g. `bubbleSort(arr: number[]): number[]` and `bubbleSort<T>(arr: T[], compare: CompareFn<T>): T[]` — clean and type-safe.

---

## 3. Gaps and Improvement Opportunities

### 3.1 DeepPartial and deep utility types

- **File:** `src/api/api-scenarios/src/types/common.ts`
- **Current:** `DeepPartial<T>` recurses into all `object` types.
- **Skill pattern:** Exclude `Function` from deep recursion so methods aren’t optional.
- **Recommendation:** Add a conditional to leave functions unchanged, e.g.  
  `T[P] extends Function ? T[P] : T[P] extends object ? DeepPartial<T[P]> : T[P]`.

### 3.2 DeepReadonly / DeepPartial for configs

- **Where:** Any module with nested config objects (e.g. api-scenarios `ServerConfig`, validation `ValidationConfig`).
- **Recommendation:** Add a `DeepReadonly<Config>` (or use the skill’s pattern) for config passed to functions that must not mutate it; use existing `DeepPartial` for optional overrides where appropriate.

### 3.3 WebSocket message discriminated union (frontend)

- **File:** `src/api/websocket/src/frontend/src/types.ts` and `useWebSocket.ts`
- **Current:** `WebSocketMessage.type: string`, `payload: unknown`; handlers use `message.payload as { clientId?, ... }`.
- **Recommendation:** Define a union of message variants, e.g.  
  `type ConnectMessage = { type: "connect"; payload: { clientId?: string; serverType?: string } };`  
  and `WebSocketMessage = ConnectMessage | ErrorMessage | ChatMessage | ...`. Then narrow in `handleMessage` with `switch (message.type)` and avoid `as` on payload.

### 3.4 Streaming service message payloads

- **File:** `src/api/api-scenarios/src/services/streaming-service.ts`
- **Current:** Many `message.data as Record<string, unknown> & { topic?, subscriptionId?, ... }` for different actions.
- **Recommendation:** Introduce a discriminated union by action/message type (e.g. `SubscribeMessage`, `UnsubscribeMessage`, `JoinRoomMessage`) and use type guards or a map of handlers so each branch is typed without repeated intersection casts.

### 3.5 Type guards instead of `as Record<string, unknown>`

- **Files:** Various (request-context, example-services, security/server, search-algorithms/server, streaming-service, etc.)
- **Current:** `request.body as Record<string, unknown>`, `obj as Record<string, unknown>`.
- **Recommendation:** Add a small guard, e.g. `function isRecord(value: unknown): value is Record<string, unknown>` (already present in request-context) and use it before indexing; reuse or centralize in a shared util where multiple modules need it.

### 3.6 Conditional types / infer

- **Current:** Only `Parameters<...>` in validation-schemas; no custom conditional types.
- **Optional:** For API or event layers, consider helpers such as:
  - `ExtractResponse<T>` / `ExtractBody<T>` for endpoint configs (as in the skill’s type-safe API client pattern) if you add centralized route typings.
  - `ReturnType`/`Parameters`-style helpers for handler signatures where useful.

### 3.7 Template literal types

- **Current:** None.
- **Optional:** If you add typed event names or routes (e.g. `"user:created"`, `"user:updated"`), consider `on${Capitalize<EventName>}`-style handler keys or path types for consistency and autocomplete; low priority unless you standardize on such a pattern.

### 3.8 Explicit `any`

- **Current:** Single intentional use in `SocketStream` (common.ts) with eslint-disable and comment.
- **Recommendation:** Leave as-is; document in this review that it’s the only exception. If Fastify/WebSocket types ever provide typed event args, replace with those types.

### 3.9 Validation engine Zod casts

- **File:** `src/api/validation/src/validation-engine.ts`
- **Current:** `schema.strip() as unknown as z.ZodSchema<T>` and similar for passthrough/strict.
- **Recommendation:** Keep if required by Zod’s API; optionally wrap in a small helper (e.g. `configureUnknownKeys<T>(schema, option)`) so the cast lives in one place and is documented.

### 3.10 Repository generic constraints

- **File:** `src/api/dependency-injection/src/di-types.ts`
- **Current:** `Repository<T, ID = string>` with `create(entity: Omit<T, "id">)`.
- **Note:** If some entities use numeric `id`, `ID` is already a generic parameter; ensure all repositories pass the correct `ID` (string | number) where used. No code change needed if already consistent.

---

## 4. Checklist (quick reference)

| Item | Location | Status |
|------|----------|--------|
| Generic API/response types | api-scenarios, nextjs-backend, validation, caching, pagination, search-algorithms | Done |
| Omit/Partial/Pick/Record | All over | Done |
| keyof typeof for const enums | api-scenarios/constants | Done |
| DeepPartial | api-scenarios/common | Done (consider excluding Function) |
| DeepReadonly | — | Not added |
| Discriminated unions (auth, pagination, validation, DataSource) | security, pagination, validation, autocomplete | Done |
| Exhaustive switch (never) | rate-limiter | Done |
| Type guards (isRecord, isUserRole, isHttpMethod, isPayloadObject, isRoomPayload) | api-scenarios, websocket/backend | Partial; expand where body/obj are cast to Record |
| WebSocket message union (frontend) | websocket/frontend | Recommended |
| Streaming message union | api-scenarios/streaming-service | Recommended |
| Conditional types / infer | validation-schemas only | Minimal; optional for API/event typings |
| Template literal types | — | None; optional |
| Explicit any | api-scenarios/common (SocketStream) | Single, documented exception |

---

## 5. Recommended order of work

1. **Low effort:** Harden `DeepPartial` (exclude `Function`) in api-scenarios `common.ts`.
2. **Medium effort:** Introduce discriminated union for WebSocket messages in websocket frontend types and `useWebSocket` handler.
3. **Medium effort:** Add discriminated union (or typed handler map) for streaming-service message payloads and reduce `as` casts.
4. **As you touch code:** Replace `x as Record<string, unknown>` with a shared `isRecord` (or equivalent) guard where multiple modules need it.
5. **Optional:** Add `DeepReadonly` for config types and consider conditional types only if you introduce centralized API/event typings.

This completes the TypeScript advanced types review and full list for `src/`.

---

## 6. Implemented (post-review)

The following were implemented and tested:

- **DeepPartial** (`src/api/api-scenarios/src/types/common.ts`): Excludes `Function` so methods are not optional; matches skill’s Pattern 4.
- **WebSocket frontend** (`src/api/websocket/src/frontend/src/types.ts`, `hooks/useWebSocket.ts`): Discriminated union `WebSocketMessage` (ConnectMessage, ErrorMessage, JoinRoomMessage, LeaveRoomMessage, GenericWebSocketMessage); `SendableWebSocketMessage` for sending; connect/error branches use typed payloads (with assertion where TS does not narrow due to `GenericWebSocketMessage.type: string`).
- **Streaming service** (`src/api/api-scenarios/src/services/streaming-service.ts`): `IncomingStreamMessage` discriminated union (subscribe, unsubscribe, join_room, leave_room, publish, ping); `handleIncomingMessage` validates `type` then uses union; handler methods take narrowed payload types (`IncomingSubscribe["data"]`, etc.).

**Verification:** `npm run api-scenarios:test` (82 tests), `npm run websocket:test` (includes frontend useWebSocket tests), and `npx tsc --noEmit` all pass. For full UI check, run `npm run websocket:dev` and open the demo frontend to confirm connect, messages, and rooms behave as expected.

**Integration tests:** `src/api/websocket/src/backend/connect-send-disconnect.test.ts` automates connect → send → disconnect against the real Basic WebSocket and Socket.IO servers (no mocks). Run with `npm run websocket:test:integration` or from repo root `npm run websocket:test:integration`.
