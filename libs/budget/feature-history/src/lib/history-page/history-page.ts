import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import {
  CategoryStore,
  DashboardStore,
  TransactionStore,
  errorMessageKey,
} from 'budget-data-access';
import type { HistoryChartEntry } from 'budget-ui';
import { HistoryChartComponent } from 'budget-ui';

import { HistoryFilterPanelComponent } from '../history-filter-panel/history-filter-panel';
import { TransactionListComponent } from '../transaction-list/transaction-list';
import type { HistoryFilterState } from '../history-filter-state';
import {
  isHistoryFilterEmpty,
  parseHistoryFilter,
  toHistoryQueryParams,
} from '../history-filter-state';
import {
  toHistoryChartParams,
  toListTransactionsParams,
} from '../history-request-params.util';

/** Money's minor-unit decimals for every currency this platform handles (see `code-style-angular.md`). */
const MINOR_UNIT_DECIMALS = 2;

/**
 * Route target for «Історія»: server-driven filter (type/category/period)
 * synced to the URL via query params, a per-category outcome chart, and the
 * transaction list. Sort/text-search stay client-local (over the already
 * server-filtered page) — see `TransactionListComponent`.
 */
@Component({
  selector: 'lib-history-page',
  imports: [
    HistoryFilterPanelComponent,
    HistoryChartComponent,
    TransactionListComponent,
    TranslocoPipe,
  ],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-page.html',
  styleUrl: './history-page.css',
})
export class HistoryPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categoryStore = inject(CategoryStore);
  protected readonly transactionStore = inject(TransactionStore);
  protected readonly dashboardStore = inject(DashboardStore);

  protected readonly errorMessageKey = errorMessageKey;

  protected readonly isFilterSheetOpen = signal(false);
  protected readonly filter = signal<HistoryFilterState>({});

  protected readonly queryParams = computed(() => {
    const params = toHistoryQueryParams(this.filter());
    const entries = Object.entries(params).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    );
    return Object.fromEntries(entries);
  });

  protected readonly chartData = computed<readonly HistoryChartEntry[]>(() =>
    this.dashboardStore.chart().map((entry) => ({
      name: entry.name,
      value: Number(entry.value.amount) / 10 ** MINOR_UNIT_DECIMALS,
    })),
  );

  protected readonly emptyReason = computed<
    'none' | 'noneAtAll' | 'noneForFilter'
  >(() => {
    if (this.transactionStore.data().length > 0) {
      return 'none';
    }
    return isHistoryFilterEmpty(this.filter()) ? 'noneAtAll' : 'noneForFilter';
  });

  public constructor() {
    this.categoryStore.load();

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.filter.set(parseHistoryFilter(params));
      });

    effect(() => {
      const filter = this.filter();
      const today = new Date();
      this.transactionStore.load(toListTransactionsParams(filter, today));
      this.dashboardStore.loadChart(toHistoryChartParams(filter, today));
    });
  }

  protected onFilterChange(next: HistoryFilterState): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toHistoryQueryParams(next),
      queryParamsHandling: '',
    });
  }

  protected openFilterSheet(): void {
    this.isFilterSheetOpen.set(true);
  }

  protected closeFilterSheet(): void {
    this.isFilterSheetOpen.set(false);
  }
}
