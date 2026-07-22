import { BaseService, ServiceValidationError } from 'shared-kernel';
import { TRANSACTION_FILTER_SCHEMA } from 'budget-validation';
import type { ITransactionRepository, Transaction } from 'budget-core';
import type { TransactionType } from 'budget-contracts';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import { resolveMonthRange } from './resolve-month-range.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Message used when a filter carries none of `month`/`from`+`to`. */
const MISSING_PERIOD_SCOPE_MESSAGE =
  'A month, or an explicit from/to date range, is required.';

/** Input for {@link ListTransactionsService}, matching `TRANSACTION_FILTER_SCHEMA`. All fields are optional narrowing filters. */
export interface ListTransactionsParams {
  readonly type?: TransactionType;
  readonly categoryId?: string;
  readonly accountId?: string;
  /** Inclusive range start, `'YYYY-MM-DD'`. Mutually exclusive with `month`. */
  readonly from?: string;
  /** Inclusive range end, `'YYYY-MM-DD'`. Mutually exclusive with `month`. */
  readonly to?: string;
  /** Calendar month shorthand for the range, `'YYYY-MM'`. Mutually exclusive with `from`/`to`. */
  readonly month?: string;
}

/** Dependencies {@link ListTransactionsService} needs, injected via its constructor. */
export interface ListTransactionsDeps {
  readonly transactionRepository: ITransactionRepository;
}

/** Sorts `transactions` newest-first by economic `date` (ties broken by `createdAt`, newest first). */
function sortNewestFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const byDate = b.date.getTime() - a.date.getTime();
    return byDate !== 0
      ? byDate
      : b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Lists a workspace's `Transaction` entries, newest-first, optionally
 * narrowed by type/category/account and a date range.
 *
 * Framework-free `application` service — no DI decorators. No pagination:
 * per the budget domain model ADR, transaction listing is a period-scoped
 * query (bounded by `month` or an explicit `from`/`to` range), not an
 * unbounded feed — family-scale data volumes make offset/cursor pagination
 * unnecessary at MVP. `month`, if given, is resolved to a half-open UTC
 * instant range in Europe/Kyiv (see `resolveMonthRange`) and takes
 * precedence over any `from`/`to` also supplied — callers are expected to
 * use one or the other, per the filter contract, but `month` winning is a
 * defined tie-break rather than undefined behavior.
 *
 * Period-scoping is mandatory, not just advisory: `authorize` rejects any
 * call carrying neither `month` nor both `from` and `to`, so a caller can
 * never trigger an unbounded `findByWorkspace` scan of the entire workspace
 * history. This is a cross-field constraint `TRANSACTION_FILTER_SCHEMA`
 * cannot express on its own (every field is independently optional), so it
 * is enforced here rather than at the LIVR schema layer.
 */
export class ListTransactionsService extends BaseService<
  ListTransactionsParams,
  readonly Transaction[]
> {
  private readonly transactionRepository: ITransactionRepository;

  public constructor(deps: ListTransactionsDeps) {
    super();
    this.transactionRepository = deps.transactionRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return TRANSACTION_FILTER_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
    params: ListTransactionsParams,
  ): void {
    assertActiveCaller(context);

    const isPeriodScoped =
      Boolean(params.month) || Boolean(params.from && params.to);
    if (!isPeriodScoped) {
      throw new ServiceValidationError(
        { month: 'REQUIRED_MONTH_OR_RANGE' },
        MISSING_PERIOD_SCOPE_MESSAGE,
      );
    }
  }

  protected override async execute(
    params: ListTransactionsParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<readonly Transaction[]> {
    const { workspaceId } = context.config;

    const range = params.month
      ? resolveMonthRange(params.month)
      : {
          from: params.from ? new Date(params.from) : undefined,
          to: params.to ? new Date(params.to) : undefined,
        };

    const transactions = await this.transactionRepository.findByWorkspace(
      workspaceId,
      {
        type: params.type,
        categoryId: params.categoryId,
        accountId: params.accountId,
        from: range.from,
        to: range.to,
      },
    );

    return sortNewestFirst(transactions);
  }
}
