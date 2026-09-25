import { Role, UserStatus } from 'shared-contracts';
import type { CallerIdentity } from 'shared-kernel';

/**
 * Admin caller identity injected into every CLI service context. Infra-level
 * trust boundary by design: whoever can run this CLI / reach the Mongo
 * connection is implicitly trusted — there is no in-app authorization check.
 * Single definition, shared by every command that needs a `ServiceContext`
 * caller (see `rules/local/architecture-backend.md`'s CLI privilege model).
 */
export const CLI_ADMIN_CALLER: CallerIdentity = {
  userId: 'cli-admin',
  status: UserStatus.ACTIVE,
  roles: [Role.SUPERADMIN],
};
