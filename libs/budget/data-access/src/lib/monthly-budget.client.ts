import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Money } from 'shared-util';
import type {
  MonthlyBudgetListResponse,
  MonthlyBudgetResponse,
  UpsertMonthlyBudgetRequest,
} from 'budget-contracts';

import type { MonthlyBudgetView } from './budget-view-models';

const MONTHLY_BUDGETS_BASE = '/api/budget/monthly-budgets';

function toMonthlyBudgetView(
  response: MonthlyBudgetResponse,
): MonthlyBudgetView {
  return {
    id: response.id,
    categoryId: response.categoryId,
    month: response.month,
    amount: Money.fromJSON(response.amount),
  };
}

/** Typed HTTP client for the budget vertical's `MonthlyBudget` operations. */
@Injectable({ providedIn: 'root' })
export class MonthlyBudgetClient {
  private readonly http = inject(HttpClient);

  public listByMonth(month: string): Observable<readonly MonthlyBudgetView[]> {
    return this.http
      .get<MonthlyBudgetListResponse>(MONTHLY_BUDGETS_BASE, {
        withCredentials: true,
        params: { month },
      })
      .pipe(map((budgets) => budgets.map(toMonthlyBudgetView)));
  }

  public upsert(
    request: UpsertMonthlyBudgetRequest,
  ): Observable<MonthlyBudgetView> {
    return this.http
      .put<MonthlyBudgetResponse>(MONTHLY_BUDGETS_BASE, request, {
        withCredentials: true,
      })
      .pipe(map(toMonthlyBudgetView));
  }
}
