import type { IRepository } from 'shared-kernel';

import type { Account } from './account.js';

/**
 * Data access contract for {@link Account} aggregates. Extends the kernel's
 * generic {@link IRepository} (`findById`/`save`/`delete`) with
 * workspace-scoped lookups. Every finder takes `workspaceId` — accounts are
 * never looked up across workspace boundaries.
 */
export interface IAccountRepository extends IRepository<Account, string> {
  /** Finds all accounts belonging to `workspaceId`. */
  findByWorkspace(workspaceId: string): Promise<Account[]>;

  /** Finds an account by `id`, scoped to `workspaceId`, or `null` if none exists. */
  findByIdInWorkspace(id: string, workspaceId: string): Promise<Account | null>;
}
