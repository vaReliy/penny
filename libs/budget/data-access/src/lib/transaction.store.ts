import { Injectable, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import { TransactionClient } from './transaction.client';
import { DashboardStore } from './dashboard.store';
import { BudgetRequestState } from './budget-request-state';
import { BudgetSessionExpiryService } from './budget-session-expiry.service';
import type { BudgetApiError } from './budget-api-error';
import type {
  ListTransactionsParams,
  RecordTransactionParams,
  TransactionView,
} from './budget-view-models';

/**
 * Signal-based state for the budget vertical's `Transaction` list.
 * `record` refreshes `DashboardStore`'s balance/summary on success, since
 * recording a transaction changes both derived read models.
 *
 * One `BudgetRequestState` per operation (list / record) rather than a
 * single shared instance, so a settling operation's `loading`/`error` clear
 * can't clobber a sibling operation still in flight.
 */
@Injectable({ providedIn: 'root' })
export class TransactionStore {
  private readonly client = inject(TransactionClient);
  private readonly dashboardStore = inject(DashboardStore);
  private readonly sessionExpiry = inject(BudgetSessionExpiryService);
  private readonly listRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly recordRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly transactionsSignal = signal<readonly TransactionView[]>([]);

  public get data(): Signal<readonly TransactionView[]> {
    return this.transactionsSignal;
  }

  public get listLoading(): Signal<boolean> {
    return this.listRequestState.loading;
  }

  public get listError(): Signal<BudgetApiError | null> {
    return this.listRequestState.error;
  }

  public get recordLoading(): Signal<boolean> {
    return this.recordRequestState.loading;
  }

  public get recordError(): Signal<BudgetApiError | null> {
    return this.recordRequestState.error;
  }

  public load(params: ListTransactionsParams = {}): void {
    this.listRequestState.run(this.client.list(params), (transactions) => {
      this.transactionsSignal.set(transactions);
    });
  }

  public record(params: RecordTransactionParams): void {
    this.recordRequestState.run(this.client.record(params), (recorded) => {
      this.transactionsSignal.set([recorded, ...this.transactionsSignal()]);
      this.dashboardStore.refresh();
    });
  }
}
