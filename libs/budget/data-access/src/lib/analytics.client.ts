import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Money } from 'shared-util';
import type {
  BalanceResponse,
  HistoryChartResponse,
  PlannerSummaryResponse,
} from 'budget-contracts';

import type {
  BalanceView,
  HistoryChartEntryView,
  HistoryChartParams,
  PlannerSummaryView,
} from './budget-view-models';
import { toIsoDateOnly } from './date-boundary.util';

const BALANCE_URL = '/api/budget/balance';
const SUMMARY_URL = '/api/budget/summary';
const CHART_URL = '/api/budget/chart';

function toBalanceView(response: BalanceResponse): BalanceView {
  return {
    accountId: response.accountId,
    balance: Money.fromJSON(response.balance),
  };
}

function toPlannerSummaryView(
  response: PlannerSummaryResponse,
): PlannerSummaryView {
  return {
    month: response.month,
    categories: response.categories.map((category) => ({
      categoryId: category.categoryId,
      budgeted: Money.fromJSON(category.budgeted),
      spent: Money.fromJSON(category.spent),
      remaining: Money.fromJSON(category.remaining),
    })),
  };
}

function toHistoryChartEntryViews(
  response: HistoryChartResponse,
): readonly HistoryChartEntryView[] {
  return response.map((entry) => ({
    categoryId: entry.categoryId,
    name: entry.name,
    value: Money.fromJSON(entry.value),
  }));
}

function toHistoryChartQuery(
  params: HistoryChartParams,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.from !== undefined) query['from'] = toIsoDateOnly(params.from);
  if (params.to !== undefined) query['to'] = toIsoDateOnly(params.to);
  if (params.month !== undefined) query['month'] = params.month;
  return query;
}

/** Typed HTTP client for the budget vertical's read-model/analytics endpoints. */
@Injectable({ providedIn: 'root' })
export class AnalyticsClient {
  private readonly http = inject(HttpClient);

  public getBalance(): Observable<BalanceView> {
    return this.http
      .get<BalanceResponse>(BALANCE_URL, { withCredentials: true })
      .pipe(map(toBalanceView));
  }

  public getSummary(month: string): Observable<PlannerSummaryView> {
    return this.http
      .get<PlannerSummaryResponse>(SUMMARY_URL, {
        withCredentials: true,
        params: { month },
      })
      .pipe(map(toPlannerSummaryView));
  }

  public getChart(
    params: HistoryChartParams = {},
  ): Observable<readonly HistoryChartEntryView[]> {
    return this.http
      .get<HistoryChartResponse>(CHART_URL, {
        withCredentials: true,
        params: toHistoryChartQuery(params),
      })
      .pipe(map(toHistoryChartEntryViews));
  }
}
