import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import type { CategoryView, TransactionType } from 'budget-data-access';

import type {
  HistoryFilterState,
  HistoryPeriod,
} from '../history-filter-state';
import { currentMonth } from '../history-period.util';

type TypeControlValue = '' | TransactionType;
type PeriodControlValue = '' | HistoryPeriod;

interface FormValue {
  readonly type: TypeControlValue;
  readonly categoryId: string;
  readonly period: PeriodControlValue;
  readonly month: string;
}

function buildForm() {
  return new FormGroup({
    type: new FormControl<TypeControlValue>('', { nonNullable: true }),
    categoryId: new FormControl('', { nonNullable: true }),
    period: new FormControl<PeriodControlValue>('', { nonNullable: true }),
    month: new FormControl('', { nonNullable: true }),
  });
}

function toFilterState(value: FormValue): HistoryFilterState {
  return {
    ...(value.type !== '' ? { type: value.type } : {}),
    ...(value.categoryId !== '' ? { categoryId: value.categoryId } : {}),
    ...(value.period !== '' ? { period: value.period } : {}),
    ...(value.period === 'month' && value.month !== ''
      ? { month: value.month }
      : {}),
  };
}

function toFormValue(filter: HistoryFilterState, today: Date): FormValue {
  return {
    type: filter.type ?? '',
    categoryId: filter.categoryId ?? '',
    period: filter.period ?? '',
    month:
      filter.period === 'month' ? (filter.month ?? currentMonth(today)) : '',
  };
}

/**
 * Dumb filter form: type / category / period preset + custom month. Emits
 * `filterChange` on every control change (no apply/cancel gate — this panel
 * is an inline/bottom-sheet control, not the legacy desktop modal). Two
 * instances of this component are rendered by the page (mobile sheet,
 * desktop rail); both stay in sync because both read the same `value` input.
 */
@Component({
  selector: 'lib-history-filter-panel',
  imports: [ReactiveFormsModule, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-filter-panel.html',
  styleUrl: './history-filter-panel.css',
})
export class HistoryFilterPanelComponent {
  private readonly destroyRef = inject(DestroyRef);

  public readonly value = input.required<HistoryFilterState>();
  public readonly categories = input<readonly CategoryView[]>([]);
  public readonly filterChange = output<HistoryFilterState>();

  protected readonly form = buildForm();

  public constructor() {
    effect(() => {
      const next = toFormValue(this.value(), new Date());
      this.form.patchValue(next, { emitEvent: false });
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.filterChange.emit(toFilterState(this.form.getRawValue()));
      });
  }

  protected clear(): void {
    this.form.reset(
      { type: '', categoryId: '', period: '', month: '' },
      { emitEvent: false },
    );
    this.filterChange.emit({});
  }
}
