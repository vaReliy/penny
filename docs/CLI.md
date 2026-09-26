# CLI Command Reference

This document lists all available CLI commands. All commands are run via the NestJS CLI bootstrap:

```bash
set -a && source .env && set +a && pnpm nx build cli && node dist/apps/cli/main.js <command> [options]
```

Or in Docker:

```bash
docker compose exec app node dist/apps/cli/main.js <command> [options]
```

---

## User Management

### user:list

List users, optionally filtered by status and/or username.

**Syntax:**

```bash
user:list [--status <status>] [--username <substring>]
```

**Options:**

- `--status <status>` (optional): Filter by status. Valid values: `pending`, `active`, `rejected`.
- `--username <substring>` (optional): Case-insensitive substring match against username.

**Output:**

```
ID | Telegram ID | Username | Display name | Status
<userId> | <telegramId> | <username> | <displayName> | <status>
...
Total: N user(s)
```

**Exit codes:**

- `0`: Success.
- `1`: Error (e.g., invalid `--status` value).

**Example:**

```bash
node dist/apps/cli/main.js user:list --status pending
node dist/apps/cli/main.js user:list --username john
```

### user:approve

Approve a pending user, transitioning them to `active` status.

**Syntax:**

```bash
user:approve --telegram-id <telegramId>
```

**Options:**

- `--telegram-id <telegramId>` (required): Numeric Telegram ID of the user to approve.

**Output:**

```
User approved
```

**Exit codes:**

- `0`: Success.
- `1`: User not found or approval failed.

**Example:**

```bash
node dist/apps/cli/main.js user:approve --telegram-id 123456789
```

### user:reject

Reject a pending user, transitioning them to `rejected` status.

**Syntax:**

```bash
user:reject --telegram-id <telegramId>
```

**Options:**

- `--telegram-id <telegramId>` (required): Numeric Telegram ID of the user to reject.

**Output:**

```
User rejected
```

**Exit codes:**

- `0`: Success.
- `1`: User not found or rejection failed.

**Example:**

```bash
node dist/apps/cli/main.js user:reject --telegram-id 123456789
```

---

## Admin Management

### admin:promote

Grant `SUPERADMIN` role to an existing user by Telegram ID.

**Syntax:**

```bash
admin:promote --telegram-id <telegramId>
```

**Options:**

- `--telegram-id <telegramId>` (required): Numeric Telegram ID of the user to promote.

**Output:**

```
User promoted to superadmin
```

Or if already an admin:

```
User is already a superadmin; no-op
```

**Exit codes:**

- `0`: Success.
- `1`: User not found, user has no `User` row, or concurrent role modification (CAS conflict).

**Note:** The target user must have logged in via Telegram at least once (must have a `User` row in the database). There is no zero-user bootstrap path — the first user cannot be auto-created by this command.

**Example:**

```bash
node dist/apps/cli/main.js admin:promote --telegram-id 123456789
```

---

## Workspace Management

### workspace:create

Create a workspace and seed it with one ACTIVE admin member.

**Syntax:**

```bash
workspace:create --name <name> --admin-telegram-id <telegramId>
```

**Options:**

- `--name <name>` (required): Display name of the workspace.
- `--admin-telegram-id <telegramId>` (required): Numeric Telegram ID of the user to grant admin membership.

**Output:**

```
Created workspace "<name>" (<workspaceId>)
```

**Exit codes:**

- `0`: Success.
- `1`: Admin user not found, not active, or workspace creation failed.

**Note:** The admin must already exist and have `status: active`. The workspace is seeded atomically with this member.

**Example:**

```bash
node dist/apps/cli/main.js workspace:create --name "Family Budget" --admin-telegram-id 123456789
```

### workspace:list

List all workspaces, or only those belonging to a specific user.

**Syntax:**

```bash
workspace:list [--telegram-id <telegramId>]
```

**Options:**

- `--telegram-id <telegramId>` (optional): Restrict listing to workspaces this user belongs to.

**Output:**

```
<workspaceId> | <workspaceName> | N member(s)
  - <telegramId> | <username> | <role> | <status>
  ...
Total: N workspace(s)
```

**Exit codes:**

- `0`: Success.
- `1`: User not found (if `--telegram-id` is provided).

**Example:**

```bash
node dist/apps/cli/main.js workspace:list
node dist/apps/cli/main.js workspace:list --telegram-id 123456789
```

### workspace:add-member

Add an active user to a workspace with a specified role.

**Syntax:**

```bash
workspace:add-member --workspace <workspaceId> --telegram-id <telegramId> [--role <role>]
```

**Options:**

- `--workspace <workspaceId>` (required): MongoDB ObjectId of the workspace.
- `--telegram-id <telegramId>` (required): Numeric Telegram ID of the user to add.
- `--role <role>` (optional): Role to grant: `admin` or `member`. Defaults to `member`.

**Output:**

```
Added <telegramId> to <workspaceId> as <role>
```

**Exit codes:**

- `0`: Success.
- `1`: User not found, not active, workspace not found, or add failed.

**Note:** The user must have `status: active`. Cannot add the same user twice.

**Example:**

```bash
node dist/apps/cli/main.js workspace:add-member --workspace 507f1f77bcf86cd799439011 --telegram-id 123456789 --role member
```

### workspace:set-role

Change a workspace member's role.

**Syntax:**

```bash
workspace:set-role --workspace <workspaceId> --telegram-id <telegramId> --role <role>
```

**Options:**

- `--workspace <workspaceId>` (required): MongoDB ObjectId of the workspace.
- `--telegram-id <telegramId>` (required): Numeric Telegram ID of the member.
- `--role <role>` (required): New role: `admin` or `member`.

**Output:**

```
Set <telegramId>'s role to <role> in <workspaceId>
```

Or if unchanged:

```
Role unchanged
```

**Exit codes:**

- `0`: Success.
- `1`: User not found or role change failed.

**Example:**

```bash
node dist/apps/cli/main.js workspace:set-role --workspace 507f1f77bcf86cd799439011 --telegram-id 123456789 --role admin
```

### workspace:remove-member

Remove a member from a workspace.

**Syntax:**

```bash
workspace:remove-member --workspace <workspaceId> --telegram-id <telegramId>
```

**Options:**

- `--workspace <workspaceId>` (required): MongoDB ObjectId of the workspace.
- `--telegram-id <telegramId>` (required): Numeric Telegram ID of the member to remove.

**Output:**

```
Removed <telegramId> from <workspaceId>
```

**Exit codes:**

- `0`: Success.
- `1`: User not found or removal failed.

**Note:** Removing the last admin from a workspace is prevented — at least one admin must remain.

**Example:**

```bash
node dist/apps/cli/main.js workspace:remove-member --workspace 507f1f77bcf86cd799439011 --telegram-id 123456789
```

---

## Development Commands (Dev Only)

The following commands are **not available in production** and exit with status `1` if `NODE_ENV=production`.

### dev:create-user

Create a user without Telegram login, for local development.

**Syntax:**

```bash
dev:create-user --telegram-username <username> [--name <displayName>]
```

**Options:**

- `--telegram-username <username>` (required): Telegram username to register the dev user under. Must be unique.
- `--name <displayName>` (optional): Display name (firstName). Defaults to `--telegram-username` if omitted.

**Output:**

```
Dev user created
```

**Exit codes:**

- `0`: Success.
- `1`: User already exists or production mode.

**Example:**

```bash
node dist/apps/cli/main.js dev:create-user --telegram-username testuser --name "Test User"
```

### dev:token

Issue a 7-day JWT session token for a local dev user.

**Syntax:**

```bash
dev:token --telegram-username <username> [--status <status>]
```

**Options:**

- `--telegram-username <username>` (required): Username of the dev user to issue a token for.
- `--status <status>` (optional): Status to force-set before issuing the token. Valid values: `pending`, `active`, `rejected`. Defaults to `active`.

**Output:**

```
Set these cookies in DevTools (Application → Cookies):
token=<jwtToken>
XSRF-TOKEN=<xsrfToken>
```

**Exit codes:**

- `0`: Success.
- `1`: User not found, `JWT_SECRET` not set, `JWT_SECRET` too short, invalid `--status`, or production mode.

**Note:** Requires `JWT_SECRET` env var (≥32 characters). The issued token is valid for 7 days.

**Example:**

```bash
node dist/apps/cli/main.js dev:token --telegram-username testuser --status active
```

---

## Onboard a Family Member

This recipe walks through adding a new family member to a workspace from first login to active membership.

**Prerequisites:**

- A running Penny instance (web + API + CLI accessible).
- At least one admin user already set up and an existing workspace.

**Flow:**

1. **New user logs in via Telegram:** The user visits the web app and clicks the Telegram Login Widget. A new `pending` user is created.

2. **Operator approves the user:**

   ```bash
   node dist/apps/cli/main.js user:list --status pending
   ```

   Find the user's Telegram ID, then:

   ```bash
   node dist/apps/cli/main.js user:approve --telegram-id <newUserTelegramId>
   ```

   The user now has `status: active`.

3. **Add the user to the workspace (if not the first member):** If the user is the workspace's first member, use `workspace:create` instead. Otherwise:

   ```bash
   node dist/apps/cli/main.js workspace:add-member --workspace <workspaceId> --telegram-id <newUserTelegramId> --role member
   ```

4. **Verify membership:**

   ```bash
   node dist/apps/cli/main.js workspace:list --telegram-id <newUserTelegramId>
   ```

   The user should now appear in the workspace's member list.

5. **User logs in again:** The user reloads the web app. The session guard checks their active status, the workspace guard loads their memberships, and they land in the last-used workspace or the first by grant date.

---

## Operator Invariants

These constraints are enforced by the API and CLI and must hold at all times:

- **At least one workspace admin:** Every workspace must have at least one member with the `admin` role. The CLI prevents removing the last admin.
- **Cannot add non-active users:** `workspace:add-member` rejects users with `status: pending` or `rejected`.
- **Users identified by Telegram ID only:** All CLI commands that reference users accept `--telegram-id`, never username. Usernames are mutable and not durable keys.
- **Workspace IDs are MongoDB ObjectIds:** Workspaces are identified by their MongoDB ObjectId (e.g., `507f1f77bcf86cd799439011`), not by name.
