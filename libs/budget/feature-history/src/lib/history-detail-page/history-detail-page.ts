import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import {
  CategoryStore,
  TransactionStore,
  formatMoney,
} from 'budget-data-access';

const DATE_LOCALE = 'uk-UA';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Route target for a single transaction, `/history/:id`. The `history` list
 * page carries its own filter query params through when linking here (see
 * `TransactionListComponent`'s `detailQueryParams`) purely so this page's
 * own "back" link can hand them straight back — this page never reads or
 * applies them itself.
 */
@Component({
  selector: 'lib-history-detail-page',
  imports: [RouterLink, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-detail-page.html',
  styleUrl: './history-detail-page.css',
})
export class HistoryDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categoryStore = inject(CategoryStore);
  protected readonly transactionStore = inject(TransactionStore);

  protected readonly backQueryParams = this.route.snapshot.queryParams;

  protected readonly categoryName = computed(() => {
    const transaction = this.transactionStore.detail();
    if (transaction === null) {
      return null;
    }
    return (
      this.categoryStore
        .data()
        .find((category) => category.id === transaction.categoryId)?.name ??
      transaction.categoryId
    );
  });

  protected readonly formattedAmount = computed(() => {
    const transaction = this.transactionStore.detail();
    return transaction === null ? null : formatMoney(transaction.amount);
  });

  protected readonly formattedDate = computed(() => {
    const transaction = this.transactionStore.detail();
    return transaction === null ? null : formatDate(transaction.date);
  });

  public constructor() {
    this.categoryStore.load();

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (id !== null) {
          this.transactionStore.loadDetail(id);
        }
      });
  }
}
