import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { CategoryStore, DashboardStore } from 'budget-data-access';

import { TransactionFormComponent } from '../transaction-form/transaction-form';
import { CategoryManagerComponent } from '../category-manager/category-manager';

/**
 * Route target for «Записи»: composes the add-transaction form and category
 * manager as stacked cards (mobile-first single column). Loads categories
 * and the account balance (for the transaction form's `accountId`) once here
 * — both child components are already-populated-store readers, not fetchers,
 * so there is exactly one network round trip for each on page entry.
 */
@Component({
  selector: 'lib-records-page',
  imports: [TranslocoPipe, TransactionFormComponent, CategoryManagerComponent],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './records-page.html',
  styleUrl: './records-page.css',
})
export class RecordsPageComponent implements OnInit {
  private readonly categoryStore = inject(CategoryStore);
  private readonly dashboardStore = inject(DashboardStore);

  public ngOnInit(): void {
    this.categoryStore.load();
    this.dashboardStore.loadBalance();
  }
}
