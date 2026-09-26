import { AuthenticationError, NOT_ADMIN_MESSAGE } from 'shared-errors';
import { Role } from 'shared-contracts';
import type { ServiceContext } from 'shared-kernel';

/** Role name a `CallerIdentity` must carry to manage workspaces/memberships. */
export const SUPERADMIN_ROLE = Role.SUPERADMIN;

/**
 * Rejects any caller that isn't an `ACTIVE` superadmin. Shared by every
 * SUPERADMIN-gated workspace service's `authorize()`. Fails closed: no `??`
 * or default-true fallback, mirroring `SetUserStatusService.authorize()`.
 */
export function assertSuperadmin(context: ServiceContext): void {
  if (!context.caller?.roles.includes(SUPERADMIN_ROLE)) {
    throw new AuthenticationError(NOT_ADMIN_MESSAGE);
  }
}
