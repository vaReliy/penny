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
 */
@Injectable({ providedIn: 'root' })
export class TransactionStore {
  private readonly client = inject(TransactionClient);
  private readonly dashboardStore = inject(DashboardStore);
  private readonly requestState = new BudgetRequestState(
    inject(BudgetSessionExpiryService),
  );
  private readonly transactionsSignal = signal<readonly TransactionView[]>([]);

  public get data(): Signal<readonly TransactionView[]> {
    return this.transactionsSignal;
  }

  public get loading(): Signal<boolean> {
    return this.requestState.loading;
  }

  public get error(): Signal<BudgetApiError | null> {
    return this.requestState.error;
  }

  public load(params: ListTransactionsParams = {}): void {
    this.requestState.run(this.client.list(params), (transactions) => {
      this.transactionsSignal.set(transactions);
    });
  }

  public record(params: RecordTransactionParams): void {
    this.requestState.run(this.client.record(params), (recorded) => {
      this.transactionsSignal.set([recorded, ...this.transactionsSignal()]);
      this.dashboardStore.refresh();
    });
  }
}
