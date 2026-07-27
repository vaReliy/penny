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
  private readonly sessionExpiry = inject(BudgetSessionExpiryService);

  /**
   * One `BudgetRequestState` per concern (balance / summary / chart) rather
   * than a single shared instance. Each concern has its own `loading`/`error`
   * pair, so an in-flight balance request can't have its `loading` flag
   * clobbered by a summary request finishing first (and vice versa) — no
   * shared mutable state to race over in the first place.
   */
  private readonly balanceRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly summaryRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly chartRequestState = new BudgetRequestState(
    this.sessionExpiry,
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

  public get balanceLoading(): Signal<boolean> {
    return this.balanceRequestState.loading;
  }

  public get balanceError(): Signal<BudgetApiError | null> {
    return this.balanceRequestState.error;
  }

  public get summaryLoading(): Signal<boolean> {
    return this.summaryRequestState.loading;
  }

  public get summaryError(): Signal<BudgetApiError | null> {
    return this.summaryRequestState.error;
  }

  public get chartLoading(): Signal<boolean> {
    return this.chartRequestState.loading;
  }

  public get chartError(): Signal<BudgetApiError | null> {
    return this.chartRequestState.error;
  }

  public loadBalance(): void {
    this.balanceRequestState.run(this.client.getBalance(), (balance) => {
      this.balanceSignal.set(balance);
    });
  }

  public loadSummary(month: string): void {
    this.lastLoadedMonth = month;
    this.summaryRequestState.run(this.client.getSummary(month), (summary) => {
      this.summarySignal.set(summary);
    });
  }

  public loadChart(params: HistoryChartParams = {}): void {
    this.chartRequestState.run(this.client.getChart(params), (chart) => {
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
