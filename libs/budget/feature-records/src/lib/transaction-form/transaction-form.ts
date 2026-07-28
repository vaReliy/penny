import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import {
  CategoryStore,
  DashboardStore,
  TransactionStore,
} from 'budget-data-access';
import type { TransactionType } from 'budget-data-access';

import { parseAmountToMinorUnits } from '../parse-amount.util';
import { todayIsoDate } from '../today-iso-date.util';

/**
 * Upper bound on the free-text description field. Mirrors
 * `budget-validation`'s `MAX_DESCRIPTION_LENGTH` — `type:feature` libs may
 * not depend on `type:validation` (see `eslint.config.mjs` depConstraints).
 */
const MAX_DESCRIPTION_LENGTH = 500;

/** How long the post-submit confirmation message stays visible, in ms. */
const SUCCESS_MESSAGE_DURATION_MS = 5000;

function amountValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const value = control.value;
  if (value === null || value.trim().length === 0) {
    return null;
  }
  return parseAmountToMinorUnits(value) === null
    ? { invalidAmount: true }
    : null;
}

function buildForm() {
  return new FormGroup({
    type: new FormControl<TransactionType>('expense', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    categoryId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, amountValidator],
    }),
    date: new FormControl(todayIsoDate(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_DESCRIPTION_LENGTH)],
    }),
  });
}

/**
 * Add-transaction form: category select, income/expense toggle, amount
 * (hryvnias with kopiyka precision, converted to minor units at this
 * boundary), optional date/description. Reads `CategoryStore`/`DashboardStore`
 * directly (both are app-singletons already populated by `RecordsPageComponent`)
 * rather than taking them as inputs — matches the account-page precedent of
 * feature-level components injecting stores themselves.
 */
@Component({
  selector: 'lib-transaction-form',
  imports: [ReactiveFormsModule, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.css',
})
export class TransactionFormComponent {
  private readonly categoryStore = inject(CategoryStore);
  private readonly dashboardStore = inject(DashboardStore);
  protected readonly transactionStore = inject(TransactionStore);

  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;
  protected readonly form = buildForm();
  private readonly submitted = signal(false);
  protected readonly showSuccess = signal(false);

  protected readonly activeCategories = computed(() =>
    this.categoryStore
      .data()
      .filter((category) => category.archivedAt === undefined),
  );

  protected readonly accountId = computed(
    () => this.dashboardStore.balance()?.accountId ?? null,
  );

  public constructor() {
    effect(() => {
      const loading = this.transactionStore.recordLoading();
      const error = this.transactionStore.recordError();
      if (!loading && this.submitted() && error === null) {
        this.submitted.set(false);
        this.form.reset({
          type: 'expense',
          categoryId: '',
          amount: '',
          date: todayIsoDate(),
          description: '',
        });
        this.showSuccess.set(true);
        setTimeout(
          () => this.showSuccess.set(false),
          SUCCESS_MESSAGE_DURATION_MS,
        );
      } else if (!loading && this.submitted() && error !== null) {
        this.submitted.set(false);
      }
    });
  }

  protected hasError(
    controlName: keyof ReturnType<typeof buildForm>['controls'],
  ): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.invalid;
  }

  protected onSubmit(): void {
    const accountId = this.accountId();
    if (this.form.invalid || accountId === null) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const amountMinorUnits = parseAmountToMinorUnits(raw.amount);
    if (amountMinorUnits === null) {
      return;
    }

    const description = raw.description.trim();
    this.submitted.set(true);
    this.transactionStore.record({
      accountId,
      categoryId: raw.categoryId,
      type: raw.type,
      amountMinorUnits,
      date: new Date(raw.date),
      ...(description.length > 0 ? { description } : {}),
    });
  }
}
