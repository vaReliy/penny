import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import {
  CategoryStore,
  DashboardStore,
  MonthlyBudgetStore,
  formatMoney,
} from 'budget-data-access';

import { PlannerCategoryRowComponent } from '../planner-category-row/planner-category-row';
import {
  FALLBACK_CURRENCY,
  buildPlannerRows,
  isPlannerMonthEmpty,
  sumMoney,
} from '../planner-rows.util';
import {
  currentMonth,
  formatMonthLabel,
  shiftMonth,
} from '../planner-month.util';

/**
 * Route target for «Планувальник»: month selector, per-category
 * budgeted/spent/remaining with a progress bar (legacy 60/90% thresholds),
 * and inline budget editing (`PUT /api/budget/monthly-budgets` via
 * `MonthlyBudgetStore`). "Copy from previous month" is explicitly out of
 * scope for this screen (parked UX backlog).
 */
@Component({
  selector: 'lib-planner-page',
  imports: [PlannerCategoryRowComponent, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planner-page.html',
  styleUrl: './planner-page.css',
})
export class PlannerPageComponent {
  protected readonly categoryStore = inject(CategoryStore);
  protected readonly dashboardStore = inject(DashboardStore);
  protected readonly monthlyBudgetStore = inject(MonthlyBudgetStore);

  protected readonly month = signal(currentMonth(new Date()));
  protected readonly monthLabel = computed(() =>
    formatMonthLabel(this.month()),
  );
  protected readonly editingCategoryId = signal<string | null>(null);

  protected readonly rows = computed(() =>
    buildPlannerRows(this.categoryStore.data(), this.dashboardStore.summary()),
  );
  protected readonly isEmpty = computed(() => isPlannerMonthEmpty(this.rows()));

  protected readonly formattedTotalBudgeted = computed(() =>
    formatMoney(
      sumMoney(
        this.rows().map((row) => row.budgeted),
        FALLBACK_CURRENCY,
      ),
    ),
  );
  protected readonly formattedTotalSpent = computed(() =>
    formatMoney(
      sumMoney(
        this.rows().map((row) => row.spent),
        FALLBACK_CURRENCY,
      ),
    ),
  );

  private editSubmitted = false;

  public constructor() {
    this.categoryStore.load();

    effect(() => {
      this.dashboardStore.loadSummary(this.month());
    });

    effect(() => {
      const loading = this.monthlyBudgetStore.upsertLoading();
      const error = this.monthlyBudgetStore.upsertError();
      if (!loading && this.editSubmitted) {
        this.editSubmitted = false;
        if (error === null) {
          this.editingCategoryId.set(null);
          this.dashboardStore.loadSummary(this.month());
        }
      }
    });
  }

  protected goToPreviousMonth(): void {
    this.editingCategoryId.set(null);
    this.month.set(shiftMonth(this.month(), -1));
  }

  protected goToNextMonth(): void {
    this.editingCategoryId.set(null);
    this.month.set(shiftMonth(this.month(), 1));
  }

  protected onStartEdit(categoryId: string): void {
    this.editingCategoryId.set(categoryId);
  }

  protected onCancelEdit(): void {
    this.editingCategoryId.set(null);
  }

  protected onSave(event: {
    categoryId: string;
    amountMinorUnits: number;
  }): void {
    this.editSubmitted = true;
    this.monthlyBudgetStore.upsert({
      categoryId: event.categoryId,
      month: this.month(),
      amountMinorUnits: event.amountMinorUnits,
    });
  }
}
