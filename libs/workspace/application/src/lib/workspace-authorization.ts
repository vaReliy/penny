import { AuthenticationError } from 'shared-errors';
import { Role } from 'shared-contracts';
import type { ServiceContext } from 'shared-kernel';

/** Role name a `CallerIdentity` must carry to manage workspaces/memberships. */
export const SUPERADMIN_ROLE = Role.SUPERADMIN;

/**
 * Message thrown when a non-superadmin caller attempts a superadmin-gated
 * workspace action. Byte-identical to `set-user-status.service.ts`'s
 * `NOT_ADMIN_MESSAGE` by requirement (AC-2) — copied rather than imported,
 * since `workspace-application` must not depend on `identity-application`.
 */
const NOT_SUPERADMIN_MESSAGE = 'Only an admin may approve or reject a user.';

/**
 * Rejects any caller that isn't an `ACTIVE` superadmin. Shared by every
 * SUPERADMIN-gated workspace service's `authorize()`. Fails closed: no `??`
 * or default-true fallback, mirroring `SetUserStatusService.authorize()`.
 */
export function assertSuperadmin(context: ServiceContext): void {
  if (!context.caller?.roles.includes(SUPERADMIN_ROLE)) {
    throw new AuthenticationError(NOT_SUPERADMIN_MESSAGE);
  }
}
