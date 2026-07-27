import { Injectable, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import { RatesClient } from './rates.client';
import { BudgetRequestState } from './budget-request-state';
import { BudgetSessionExpiryService } from './budget-session-expiry.service';
import type { BudgetApiError } from './budget-api-error';
import type { ExchangeRatesView } from './budget-view-models';

/**
 * Signal-based state for the FX display-rate endpoint. `load()` and
 * `refresh()` are the same request — kept as two method names so callers
 * (e.g. a manual refresh button) can express intent, matching the legacy
 * `page-bill` UX this replaces.
 */
@Injectable({ providedIn: 'root' })
export class RatesStore {
  private readonly client = inject(RatesClient);
  private readonly requestState = new BudgetRequestState(
    inject(BudgetSessionExpiryService),
  );
  private readonly ratesSignal = signal<ExchangeRatesView | null>(null);

  public get rates(): Signal<ExchangeRatesView | null> {
    return this.ratesSignal;
  }

  public get loading(): Signal<boolean> {
    return this.requestState.loading;
  }

  public get error(): Signal<BudgetApiError | null> {
    return this.requestState.error;
  }

  public load(): void {
    this.requestState.run(this.client.get(), (rates) => {
      this.ratesSignal.set(rates);
    });
  }

  public refresh(): void {
    this.load();
  }
}
