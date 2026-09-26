import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { CategoryStore, DashboardStore } from 'budget-data-access';
import { CurrentWorkspace } from 'shared-web-shell-data';

import { TransactionFormComponent } from '../transaction-form/transaction-form';
import { CategoryManagerComponent } from '../category-manager/category-manager';

/**
 * Route target for «Записи»: composes the add-transaction form and category
 * manager as stacked cards (mobile-first single column). Loads categories
 * and the account balance (for the transaction form's `accountId`) here —
 * both child components are already-populated-store readers, not fetchers.
 * The load is keyed on `CurrentWorkspace.currentId()` (not `ngOnInit`)
 * because the route is reused across a same-screen workspace switch.
 */
@Component({
  selector: 'lib-records-page',
  imports: [TranslocoPipe, TransactionFormComponent, CategoryManagerComponent],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './records-page.html',
  styleUrl: './records-page.css',
})
export class RecordsPageComponent {
  private readonly categoryStore = inject(CategoryStore);
  private readonly dashboardStore = inject(DashboardStore);
  private readonly currentWorkspace = inject(CurrentWorkspace);

  public constructor() {
    effect(() => {
      this.currentWorkspace.currentId();
      this.categoryStore.reset();
      this.dashboardStore.resetBalance();
      this.categoryStore.load();
      this.dashboardStore.loadBalance();
    });
  }
}
