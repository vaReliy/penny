import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { CategoryStore, DashboardStore } from 'budget-data-access';
import { TransactionFormComponent } from './transaction-form';

const UK_TRANSLATIONS = { common: { loading: 'Завантаження...' } };
const BUDGET_UK_TRANSLATIONS = {
  records: {
    transactionForm: {
      title: 'Додати подію',
      typeLabel: 'Оберіть тип',
      typeIncome: 'Прибуток',
      typeExpense: 'Витрата',
      categoryLabel: 'Оберіть категорію',
      categoryPlaceholder: 'Оберіть категорію',
      noCategoriesHint:
        'Немає активних категорій. Спочатку створіть категорію нижче.',
      amountLabel: 'Введіть суму',
      dateLabel: 'Дата',
      descriptionLabel: 'Опис',
      submit: 'Додати',
      success: 'Подію успішно додано!',
      errorRequired: 'Поле не може бути пустим.',
      errorMaxLength: 'Довжина поля має бути не більшою за {{max}} символів.',
      errorInvalidAmount: 'Введіть коректну суму, напр. 123,45',
    },
  },
};

describe('TransactionFormComponent', () => {
  let fixture: ComponentFixture<TransactionFormComponent>;
  let httpController: HttpTestingController;
  let categoryStore: CategoryStore;
  let dashboardStore: DashboardStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TransactionFormComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpController = TestBed.inject(HttpTestingController);
    categoryStore = TestBed.inject(CategoryStore);
    dashboardStore = TestBed.inject(DashboardStore);
  });

  afterEach(() => {
    httpController.verify();
  });

  function loadStores(
    categories: readonly { id: string; name: string; archivedAt?: string }[] = [
      { id: 'c1', name: 'Продукти' },
    ],
  ): void {
    categoryStore.load();
    httpController.expectOne('/api/budget/categories').flush(categories);
    dashboardStore.loadBalance();
    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '0', currency: 'UAH' },
    });
  }

  it('shows an empty-state hint and no form when there are no active categories', async () => {
    fixture = TestBed.createComponent(TransactionFormComponent);
    fixture.detectChanges();
    loadStores([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Немає активних категорій');
    expect(el.querySelector('form')).toBeNull();
  });

  it('shows required-field validation messages after an invalid submit attempt', async () => {
    fixture = TestBed.createComponent(TransactionFormComponent);
    fixture.detectChanges();
    loadStores();
    await fixture.whenStable();
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Поле не може бути пустим.',
    );
    httpController.expectNone('/api/budget/transactions');
  });

  it('shows an invalid-amount message for a malformed amount', async () => {
    fixture = TestBed.createComponent(TransactionFormComponent);
    fixture.detectChanges();
    loadStores();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.form.controls.amount.setValue('abc');
    component.form.controls.amount.markAsTouched();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Введіть коректну суму',
    );
  });

  it('converts a comma-decimal amount to integer minor units on submit', async () => {
    fixture = TestBed.createComponent(TransactionFormComponent);
    fixture.detectChanges();
    loadStores();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.form.setValue({
      type: 'expense',
      categoryId: 'c1',
      amount: '123,45',
      date: '2026-07-28',
      description: '',
    });
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    const req = httpController.expectOne('/api/budget/transactions');
    expect(req.request.body).toEqual({
      accountId: 'a1',
      categoryId: 'c1',
      type: 'expense',
      amountMinorUnits: 12345,
      date: '2026-07-28',
    });
    req.flush({
      id: 't1',
      accountId: 'a1',
      categoryId: 'c1',
      type: 'expense',
      amount: { amount: '12345', currency: 'UAH' },
      date: '2026-07-28',
      createdBy: 'u1',
      createdAt: '2026-07-28T10:00:00.000Z',
    });
    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '-12345', currency: 'UAH' },
    });
  });

  it('resets the form and shows a confirmation after a successful submit', async () => {
    fixture = TestBed.createComponent(TransactionFormComponent);
    fixture.detectChanges();
    loadStores();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.form.setValue({
      type: 'expense',
      categoryId: 'c1',
      amount: '10',
      date: '2026-07-28',
      description: 'Test',
    });
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    httpController.expectOne('/api/budget/transactions').flush({
      id: 't1',
      accountId: 'a1',
      categoryId: 'c1',
      type: 'expense',
      amount: { amount: '1000', currency: 'UAH' },
      date: '2026-07-28',
      createdBy: 'u1',
      createdAt: '2026-07-28T10:00:00.000Z',
    });
    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '-1000', currency: 'UAH' },
    });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.form.controls.amount.value).toBe('');
    expect(component.form.controls.categoryId.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain(
      'Подію успішно додано!',
    );
  });

  it('renders an API validation error next to the submit action without discarding the categories list', async () => {
    fixture = TestBed.createComponent(TransactionFormComponent);
    fixture.detectChanges();
    loadStores();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.form.setValue({
      type: 'expense',
      categoryId: 'c1',
      amount: '10',
      date: '2026-07-28',
      description: '',
    });
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    httpController
      .expectOne('/api/budget/transactions')
      .flush(
        { code: 'VALIDATION_ERROR', message: 'categoryId is not eligible' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector(
      '[role="alert"]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('categoryId is not eligible');
    // The category select must still be populated — a record failure never
    // discards already-loaded sibling data.
    expect(
      fixture.nativeElement.querySelectorAll('option').length,
    ).toBeGreaterThan(1);
  });
});
