import type { IRepository } from 'shared-kernel';
import type { CurrencyCode } from 'shared-util';

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

  /**
   * Finds the account named `name` in `workspaceId`, creating it with
   * `currency` if none exists yet — atomically, via an upsert (never a
   * separate read-then-create at the call site, which would race two
   * concurrent first-callers into two accounts). Backs the API/CLI
   * boundary's single-seeded-default-account resolution (`DECISIONS.md`
   * ADR-007 §4: "Defaulted to the seeded account at the API/CLI boundary,
   * never in the core aggregate").
   */
  findOrCreateDefault(
    workspaceId: string,
    name: string,
    currency: CurrencyCode,
  ): Promise<Account>;
}
