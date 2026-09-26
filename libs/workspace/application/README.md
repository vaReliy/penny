# workspace-application

**Tags:** `scope:workspace` · `type:application` · `platform:server`

Workspace domain services — the single entry point for all mutations and queries on the `Workspace` aggregate (used by the workspace CLI commands and the HTTP guard/controller).

## Services

All services extend `BaseService<TParams, TResult>` and follow a fixed pattern:

1. **Validate** — LIVR schema validation (inline, per service)
2. **Authorize** — role/status checks (via `workspace-authorization.ts` or inline)
3. **Execute** — aggregate mutation or query

### Mutation services (SUPERADMIN-gated)

- **`CreateWorkspaceService`** — creates a new workspace seeded with one admin membership (`adminUserId`)
- **`AddMemberService`** — adds a user to a workspace (role defaults to `member`)
- **`SetMemberRoleService`** — changes a member's role; returns `changed: boolean` to detect no-ops
- **`RemoveMemberService`** — removes a user from a workspace

### Query services

- **`ListWorkspacesService`** (SUPERADMIN-gated) — returns all workspaces or those containing a specific user
- **`ListMyWorkspacesService`** (ACTIVE caller required) — returns the caller's own workspaces, sorted by `grantedAt` ascending; grants no implicit superadmin access
- **`FindMembershipService`** (caller present) — returns membership info for a single workspace; returns `null` for malformed/non-existent/inaccessible workspaces so the HTTP guard can map all three to the same opaque 404

### Authorization helper

**`workspace-authorization.ts`** — exports `assertSuperadmin(context)`, shared by the five SUPERADMIN-gated services. Throws `AuthenticationError` with a fixed message matching `identity-application`'s equivalent.

## Invariants

- Mutations load the aggregate via the repository's `findByIdOrThrow()`, call the aggregate's domain method, and `save()` with optimistic version-counter CAS. Conflicts propagate as infrastructure errors.
- `workspace-application` **must not import `identity`** (layer boundary). Resolving user identities and checking status is the CLI's responsibility.
- Not-found workspace errors surface the domain layer's `NotFoundDomainError`.

## Validation

LIVR schemas are colocated per service. Key rules:

- `workspaceId`, `userId`, `adminUserId` — `ID_PATTERN` (except in `FindMembershipService`, which returns `null` on invalid input)
- `name` — required, trimmed, 1–64 chars
- `role` — `one_of ['admin','member']`
- `grantedBy` — required non-empty string (CLI passes `'cli'`)
