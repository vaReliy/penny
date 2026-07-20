import type { IRepository } from 'shared-kernel';

import type { Transaction, TransactionProps } from './transaction.js';
import type { TransactionType } from 'budget-contracts';

/** Optional narrowing filter for {@link ITransactionRepository.findByWorkspace}. */
export interface TransactionFilter {
  readonly type?: TransactionType;
  readonly categoryId?: string;
  readonly accountId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

/** Optional narrowing filter for balance/analytics aggregation queries. */
export interface TransactionAggregationFilter {
  readonly accountId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

/** Mutable fields a caller may update via {@link ITransactionRepository.updateInWorkspace}. */
export type TransactionUpdateFields = Partial<
  Pick<
    TransactionProps,
    'accountId' | 'categoryId' | 'type' | 'amount' | 'date' | 'description'
  >
>;

/** Per-`type` totals, in **bigint minor units** — see {@link ITransactionRepository.sumAmountsByType}. */
export interface TransactionTypeTotals {
  readonly income: bigint;
  readonly expense: bigint;
}

/** Per-category expense total, in **bigint minor units** — see {@link ITransactionRepository.sumExpenseByCategory}. */
export interface CategoryExpenseTotal {
  readonly categoryId: string;
  readonly total: bigint;
}

/**
 * Data access contract for {@link Transaction} aggregates. Extends the
 * kernel's generic {@link IRepository} (`findById`/`save`/`delete`) with
 * workspace-scoped lookups and the aggregation queries balance derivation
 * and analytics need. Every finder takes `workspaceId`.
 *
 * Aggregation methods (`sumAmountsByType`, `sumExpenseByCategory`) return
 * **bigint minor units**, not `Money` — the application layer constructs
 * `Money(account.currency)` from them, keeping `Money` construction above
 * the infrastructure layer.
 */
export interface ITransactionRepository extends IRepository<
  Transaction,
  string
> {
  /** Finds transactions in `workspaceId`, optionally narrowed by `filter`. */
  findByWorkspace(
    workspaceId: string,
    filter?: TransactionFilter,
  ): Promise<Transaction[]>;

  /** Finds a transaction by `id`, scoped to `workspaceId`, or `null` if none exists. */
  findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Transaction | null>;

  /**
   * True if at least one transaction in `workspaceId` references
   * `categoryId`. Used to inform archive-validation UX.
   */
  existsForCategory(categoryId: string, workspaceId: string): Promise<boolean>;

  /**
   * Updates only the given `fields` on the transaction identified by `id`,
   * scoped to `workspaceId`. Deferred to the Q5 edit phase — no current
   * caller invokes this yet.
   */
  updateInWorkspace(
    id: string,
    workspaceId: string,
    fields: TransactionUpdateFields,
  ): Promise<void>;

  /**
   * Deletes the transaction identified by `id`, scoped to `workspaceId`.
   * Deferred to the Q5 edit phase — no current caller invokes this yet.
   */
  deleteInWorkspace(id: string, workspaceId: string): Promise<void>;

  /**
   * Sums transaction amounts in `workspaceId` by `type`, optionally
   * narrowed by `filter`. Feeds derived account-balance calculation
   * (`Σ(income) − Σ(expense)`).
   */
  sumAmountsByType(
    workspaceId: string,
    filter?: TransactionAggregationFilter,
  ): Promise<TransactionTypeTotals>;

  /**
   * Sums expense transaction amounts in `workspaceId`, grouped by
   * `categoryId`, optionally narrowed by `filter`. Feeds category
   * breakdown chart data.
   */
  sumExpenseByCategory(
    workspaceId: string,
    filter?: Pick<TransactionAggregationFilter, 'from' | 'to'>,
  ): Promise<CategoryExpenseTotal[]>;
}
