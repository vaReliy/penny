import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { DashboardStore, RatesStore } from 'budget-data-access';
import { BalanceCardComponent, RatesCardComponent } from 'budget-ui';
import { CurrentWorkspace } from 'shared-web-shell-data';

type AccountPageState = 'loading' | 'error' | 'ready';

/**
 * Feature page for the «Рахунок» screen: composes the dumb `budget-ui` cards
 * over `DashboardStore` (balance) and `RatesStore` (FX rates). Balance and
 * rates re-load whenever the current workspace changes (including the
 * initial load) — the route is reused across a workspace switch since the
 * route config itself doesn't change, only `:workspaceId`, so `ngOnInit`
 * alone would never re-fire. Only the rates card's refresh action
 * re-fetches on demand (mirrors the legacy `page-bill` UX — refresh never
 * re-pulls the balance itself).
 */
@Component({
  selector: 'lib-account-page',
  imports: [TranslocoPipe, BalanceCardComponent, RatesCardComponent],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-page.html',
  styleUrl: './account-page.css',
})
export class AccountPageComponent {
  protected readonly dashboardStore = inject(DashboardStore);
  protected readonly ratesStore = inject(RatesStore);
  private readonly currentWorkspace = inject(CurrentWorkspace);

  protected readonly state = computed<AccountPageState>(() => {
    if (
      this.dashboardStore.balance() !== null &&
      this.ratesStore.rates() !== null
    ) {
      return 'ready';
    }
    if (
      this.dashboardStore.balanceError() !== null ||
      this.ratesStore.error() !== null
    ) {
      return 'error';
    }
    return 'loading';
  });

  public constructor() {
    effect(() => {
      this.currentWorkspace.currentId();
      this.dashboardStore.resetBalance();
      this.ratesStore.reset();
      this.dashboardStore.loadBalance();
      this.ratesStore.load();
    });
  }

  protected onRetry(): void {
    this.dashboardStore.loadBalance();
    this.ratesStore.load();
  }

  protected onRatesRefresh(): void {
    this.ratesStore.refresh();
  }
}
