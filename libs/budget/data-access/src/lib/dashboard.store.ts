import { Injectable, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import { AnalyticsClient } from './analytics.client';
import { BudgetRequestState } from './budget-request-state';
import { BudgetSessionExpiryService } from './budget-session-expiry.service';
import type { BudgetApiError } from './budget-api-error';
import type {
  BalanceView,
  HistoryChartEntryView,
  HistoryChartParams,
  PlannerSummaryView,
} from './budget-view-models';

/**
 * Signal-based state for the budget vertical's dashboard read models
 * (balance, planner summary, history chart). Remembers the last-loaded
 * month so `refresh()` — called by `TransactionStore` after a successful
 * mutation — can re-fetch balance and summary without the caller having to
 * re-supply the month.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly client = inject(AnalyticsClient);
  private readonly requestState = new BudgetRequestState(
    inject(BudgetSessionExpiryService),
  );
  private readonly balanceSignal = signal<BalanceView | null>(null);
  private readonly summarySignal = signal<PlannerSummaryView | null>(null);
  private readonly chartSignal = signal<readonly HistoryChartEntryView[]>([]);
  private lastLoadedMonth: string | null = null;

  public get balance(): Signal<BalanceView | null> {
    return this.balanceSignal;
  }

  public get summary(): Signal<PlannerSummaryView | null> {
    return this.summarySignal;
  }

  public get chart(): Signal<readonly HistoryChartEntryView[]> {
    return this.chartSignal;
  }

  public get loading(): Signal<boolean> {
    return this.requestState.loading;
  }

  public get error(): Signal<BudgetApiError | null> {
    return this.requestState.error;
  }

  public loadBalance(): void {
    this.requestState.run(this.client.getBalance(), (balance) => {
      this.balanceSignal.set(balance);
    });
  }

  public loadSummary(month: string): void {
    this.lastLoadedMonth = month;
    this.requestState.run(this.client.getSummary(month), (summary) => {
      this.summarySignal.set(summary);
    });
  }

  public loadChart(params: HistoryChartParams = {}): void {
    this.requestState.run(this.client.getChart(params), (chart) => {
      this.chartSignal.set(chart);
    });
  }

  /** Re-fetches balance and (if a month was previously loaded) the planner summary. */
  public refresh(): void {
    this.loadBalance();
    if (this.lastLoadedMonth !== null) {
      this.loadSummary(this.lastLoadedMonth);
    }
  }
}
