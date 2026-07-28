import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { formatMoney } from 'budget-data-access';
import type { CategoryView, TransactionView } from 'budget-data-access';

type SortColumn = 'date' | 'amount' | 'category' | 'type';
type SortDirection = 'asc' | 'desc';

interface DisplayRow {
  readonly transaction: TransactionView;
  readonly categoryName: string;
  readonly formattedAmount: string;
  readonly formattedDate: string;
}

const DATE_LOCALE = 'uk-UA';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function compareRows(a: DisplayRow, b: DisplayRow, column: SortColumn): number {
  switch (column) {
    case 'date':
      return a.transaction.date.getTime() - b.transaction.date.getTime();
    case 'amount':
      return Number(a.transaction.amount.amount - b.transaction.amount.amount);
    case 'category':
      return a.categoryName.localeCompare(b.categoryName);
    case 'type':
      return a.transaction.type.localeCompare(b.transaction.type);
  }
}

/**
 * Feature-local presentational list: mobile cards (`<md`) + sortable desktop
 * table (`md+`), with a client-side text search over the already-loaded
 * page — server-side filtering already narrowed `transactions` by
 * type/category/period, per `budget-feature-history`'s task spec.
 */
@Component({
  selector: 'lib-transaction-list',
  imports: [RouterLink, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.css',
})
export class TransactionListComponent {
  public readonly transactions = input.required<readonly TransactionView[]>();
  public readonly categories = input<readonly CategoryView[]>([]);
  /** Distinguishes "no transactions at all" from "filter matched nothing" — decided by the caller. */
  public readonly emptyReason = input<'none' | 'noneAtAll' | 'noneForFilter'>(
    'none',
  );
  public readonly detailQueryParams = input<Record<string, string>>({});

  protected readonly searchTerm = signal('');
  protected readonly sortColumn = signal<SortColumn>('date');
  protected readonly sortDirection = signal<SortDirection>('desc');

  private readonly categoryNameById = computed(() => {
    const map = new Map<string, string>();
    for (const category of this.categories()) {
      map.set(category.id, category.name);
    }
    return map;
  });

  private readonly rows = computed<readonly DisplayRow[]>(() => {
    const names = this.categoryNameById();
    return this.transactions().map((transaction) => ({
      transaction,
      categoryName: names.get(transaction.categoryId) ?? transaction.categoryId,
      formattedAmount: formatMoney(transaction.amount),
      formattedDate: formatDate(transaction.date),
    }));
  });

  protected readonly filteredRows = computed<readonly DisplayRow[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const matched =
      term.length === 0
        ? this.rows()
        : this.rows().filter((row) =>
            [
              row.categoryName,
              row.formattedAmount,
              row.formattedDate,
              row.transaction.type,
              row.transaction.description ?? '',
            ]
              .join(' ')
              .toLowerCase()
              .includes(term),
          );

    const column = this.sortColumn();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...matched].sort((a, b) => compareRows(a, b, column) * direction);
  });

  protected setSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }
}
