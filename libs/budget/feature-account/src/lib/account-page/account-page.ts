import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { DashboardStore, RatesStore } from 'budget-data-access';
import { BalanceCardComponent, RatesCardComponent } from 'budget-ui';

type AccountPageState = 'loading' | 'error' | 'ready';

/**
 * Feature page for the «Рахунок» screen: composes the dumb `budget-ui` cards
 * over `DashboardStore` (balance) and `RatesStore` (FX rates). Balance and
 * rates load independently on init; only the rates card's refresh action
 * re-fetches (mirrors the legacy `page-bill` UX — refresh never re-pulls the
 * balance itself).
 */
@Component({
  selector: 'lib-account-page',
  imports: [TranslocoPipe, BalanceCardComponent, RatesCardComponent],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-page.html',
  styleUrl: './account-page.css',
})
export class AccountPageComponent implements OnInit {
  protected readonly dashboardStore = inject(DashboardStore);
  protected readonly ratesStore = inject(RatesStore);

  protected readonly state = computed<AccountPageState>(() => {
    if (
      this.dashboardStore.balance() !== null &&
      this.ratesStore.rates() !== null
    ) {
      return 'ready';
    }
    if (
      this.dashboardStore.error() !== null ||
      this.ratesStore.error() !== null
    ) {
      return 'error';
    }
    return 'loading';
  });

  public ngOnInit(): void {
    this.dashboardStore.loadBalance();
    this.ratesStore.load();
  }

  protected onRetry(): void {
    this.dashboardStore.loadBalance();
    this.ratesStore.load();
  }

  protected onRatesRefresh(): void {
    this.ratesStore.refresh();
  }
}
