import { Injectable, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { UpsertMonthlyBudgetRequest } from 'budget-contracts';

import { MonthlyBudgetClient } from './monthly-budget.client';
import { BudgetRequestState } from './budget-request-state';
import { BudgetSessionExpiryService } from './budget-session-expiry.service';
import type { BudgetApiError } from './budget-api-error';
import type { MonthlyBudgetView } from './budget-view-models';

/**
 * Signal-based state for one calendar month's `MonthlyBudget` list.
 *
 * One `BudgetRequestState` per operation (listByMonth / upsert) rather than
 * a single shared instance, so a settling operation's `loading`/`error`
 * clear can't clobber a sibling operation still in flight.
 */
@Injectable({ providedIn: 'root' })
export class MonthlyBudgetStore {
  private readonly client = inject(MonthlyBudgetClient);
  private readonly sessionExpiry = inject(BudgetSessionExpiryService);
  private readonly listByMonthRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly upsertRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly budgetsSignal = signal<readonly MonthlyBudgetView[]>([]);

  public get data(): Signal<readonly MonthlyBudgetView[]> {
    return this.budgetsSignal;
  }

  public get listByMonthLoading(): Signal<boolean> {
    return this.listByMonthRequestState.loading;
  }

  public get listByMonthError(): Signal<BudgetApiError | null> {
    return this.listByMonthRequestState.error;
  }

  public get upsertLoading(): Signal<boolean> {
    return this.upsertRequestState.loading;
  }

  public get upsertError(): Signal<BudgetApiError | null> {
    return this.upsertRequestState.error;
  }

  public loadByMonth(month: string): void {
    this.listByMonthRequestState.run(
      this.client.listByMonth(month),
      (budgets) => {
        this.budgetsSignal.set(budgets);
      },
    );
  }

  public upsert(request: UpsertMonthlyBudgetRequest): void {
    this.upsertRequestState.run(this.client.upsert(request), (upserted) => {
      const existingIndex = this.budgetsSignal().findIndex(
        (budget) => budget.id === upserted.id,
      );
      const next = [...this.budgetsSignal()];
      if (existingIndex === -1) {
        next.push(upserted);
      } else {
        next[existingIndex] = upserted;
      }
      this.budgetsSignal.set(next);
    });
  }
}
