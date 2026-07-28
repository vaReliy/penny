import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { formatMoney } from 'budget-data-access';

import { parseAmountToMinorUnits } from '../parse-amount.util';
import type { PlannerRowViewModel } from '../planner-rows.util';

const MINOR_UNIT_DECIMALS = 2;

/** Pre-fills the edit input with the current budgeted amount in major units — display-only, never fed back into money arithmetic (re-parsed exactly on submit via `parseAmountToMinorUnits`). */
function formatAmountInput(minorUnits: bigint): string {
  return (Number(minorUnits) / 10 ** MINOR_UNIT_DECIMALS).toFixed(
    MINOR_UNIT_DECIMALS,
  );
}

function buildAmountForm(initialMinorUnits: bigint): FormGroup<{
  amount: FormControl<string>;
}> {
  return new FormGroup({
    amount: new FormControl(formatAmountInput(initialMinorUnits), {
      nonNullable: true,
    }),
  });
}

/**
 * Dumb presentational row: one category's budgeted/spent/remaining, a
 * progress bar (legacy 60/90% thresholds, see `planner-progress.util`), and
 * an inline tap-to-edit affordance for the budgeted amount. Save/cancel are
 * plain outputs — the page owns `MonthlyBudgetStore` and which row is
 * currently being edited, per the per-action error-surfacing convention
 * (`code-style-angular.md`): `errorMessage`/`saving` are passed in so this
 * row can render its own operation's state next to its own affordance.
 */
@Component({
  selector: 'lib-planner-category-row',
  imports: [ReactiveFormsModule, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planner-category-row.html',
  styleUrl: './planner-category-row.css',
})
export class PlannerCategoryRowComponent {
  public readonly row = input.required<PlannerRowViewModel>();
  public readonly isEditing = input<boolean>(false);
  public readonly saving = input<boolean>(false);
  public readonly errorMessage = input<string | null>(null);

  public readonly startEdit = output<string>();
  public readonly cancelEdit = output<void>();
  public readonly save = output<{
    categoryId: string;
    amountMinorUnits: number;
  }>();

  protected form = buildAmountForm(0n);
  protected readonly validationError = signal(false);

  protected readonly formattedBudgeted = computed(() =>
    formatMoney(this.row().budgeted),
  );
  protected readonly formattedSpent = computed(() =>
    formatMoney(this.row().spent),
  );
  protected readonly formattedRemaining = computed(() =>
    formatMoney(this.row().remaining),
  );
  protected readonly barWidthPercent = computed(() =>
    Math.min(100, Math.max(0, this.row().percent)),
  );

  public constructor() {
    effect(() => {
      if (this.isEditing()) {
        this.form = buildAmountForm(this.row().budgeted.amount);
        this.validationError.set(false);
      }
    });
  }

  protected onStartEdit(): void {
    this.startEdit.emit(this.row().categoryId);
  }

  protected onCancel(): void {
    this.cancelEdit.emit();
  }

  protected onSubmit(): void {
    const amountMinorUnits = parseAmountToMinorUnits(
      this.form.getRawValue().amount,
    );
    if (amountMinorUnits === null) {
      this.validationError.set(true);
      return;
    }
    this.validationError.set(false);
    this.save.emit({ categoryId: this.row().categoryId, amountMinorUnits });
  }
}
