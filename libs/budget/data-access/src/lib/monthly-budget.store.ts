import { Injectable, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { UpsertMonthlyBudgetRequest } from 'budget-contracts';

import { MonthlyBudgetClient } from './monthly-budget.client';
import { BudgetRequestState } from './budget-request-state';
import { BudgetSessionExpiryService } from './budget-session-expiry.service';
import type { BudgetApiError } from './budget-api-error';
import type { MonthlyBudgetView } from './budget-view-models';

/** Signal-based state for one calendar month's `MonthlyBudget` list. */
@Injectable({ providedIn: 'root' })
export class MonthlyBudgetStore {
  private readonly client = inject(MonthlyBudgetClient);
  private readonly requestState = new BudgetRequestState(
    inject(BudgetSessionExpiryService),
  );
  private readonly budgetsSignal = signal<readonly MonthlyBudgetView[]>([]);

  public get data(): Signal<readonly MonthlyBudgetView[]> {
    return this.budgetsSignal;
  }

  public get loading(): Signal<boolean> {
    return this.requestState.loading;
  }

  public get error(): Signal<BudgetApiError | null> {
    return this.requestState.error;
  }

  public loadByMonth(month: string): void {
    this.requestState.run(this.client.listByMonth(month), (budgets) => {
      this.budgetsSignal.set(budgets);
    });
  }

  public upsert(request: UpsertMonthlyBudgetRequest): void {
    this.requestState.run(this.client.upsert(request), (upserted) => {
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
