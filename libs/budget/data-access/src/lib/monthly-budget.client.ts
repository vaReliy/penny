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
import { CurrentWorkspace } from 'shared-web-shell-data';

import type { MonthlyBudgetView } from './budget-view-models';

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
  private readonly currentWorkspace = inject(CurrentWorkspace);

  private monthlyBudgetsBase(): string {
    const workspaceId = this.currentWorkspace.currentId();
    if (workspaceId === null) {
      throw new Error('MonthlyBudgetClient called with no current workspace');
    }
    return `/api/workspaces/${workspaceId}/budget/monthly-budgets`;
  }

  public listByMonth(month: string): Observable<readonly MonthlyBudgetView[]> {
    return this.http
      .get<MonthlyBudgetListResponse>(this.monthlyBudgetsBase(), {
        withCredentials: true,
        params: { month },
      })
      .pipe(map((budgets) => budgets.map(toMonthlyBudgetView)));
  }

  public upsert(
    request: UpsertMonthlyBudgetRequest,
  ): Observable<MonthlyBudgetView> {
    return this.http
      .put<MonthlyBudgetResponse>(this.monthlyBudgetsBase(), request, {
        withCredentials: true,
      })
      .pipe(map(toMonthlyBudgetView));
  }
}
